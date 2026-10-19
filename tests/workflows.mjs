// Workflow test: links between portals, run as project manager (and admin for database tools)
const B = process.env.BASE || 'http://localhost:3000';
const ADMIN = { id: process.env.ADMIN_EMAIL, pw: process.env.ADMIN_PASSWORD, code: process.env.ADMIN_CODE };
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n} ${c ? '' : x}`); };
const call = async (m, p, body, t) => {
  const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j, h: r.headers };
};

const l1 = await call('POST', '/api/auth/login', { identifier: ADMIN.id, password: ADMIN.pw });
const A = (await call('POST', '/api/auth/verify-mfa', { tempMfaToken: l1.j.tempMfaToken, code: ADMIN.code })).j?.sessionToken;
await call('POST', '/api/users', { name: 'WF PM', email: 'wf@test.local', employeeId: 'WF-01', role: 'PROJECT_MANAGER', password: 'WfTest#1234' }, A);
const P = (await call('POST', '/api/auth/login', { identifier: 'wf@test.local', password: 'WfTest#1234' })).j?.sessionToken;
ok('setup: PM session', !!A && !!P);

// 0. SQL Migrations & Pre-Migration Backup Verification
const migs = await call('GET', '/api/database/migrations', null, A);
ok('migrations table & 001 applied', migs.s === 200 && Array.isArray(migs.j) && migs.j.some(m => m.name === '001_enterprise_postgres_upgrade.sql'), JSON.stringify(migs.j));
const bkp = await call('POST', '/api/database/backup', { label: 'workflow_test' }, A);
ok('database backup created', bkp.s === 200 && bkp.j?.success === true);

// 1. supplier -> material -> inventory
const sup = await call('POST', '/api/suppliers', { name: 'WF Supplier' }, P);
ok('supplier created', sup.s === 201 || sup.s === 200, JSON.stringify(sup.j)?.slice(0, 150));
const mat = await call('POST', '/api/materials', { name: 'WF Material', code: 'WF-M1', unit: 'kg', currentPrice: 10, supplierName: 'WF Supplier', inStock: 0 }, P);
ok('material created', !!mat.j?.id);
const inv = await call('POST', '/api/inventory', { sku: 'WF-M1', name: 'WF Material', materialId: mat.j?.id, onHand: 0, available: 0, unit: 'kg', supplierId: sup.j?.id }, P);
ok('inventory item linked to material', !!inv.j?.id, `status ${inv.s} ${JSON.stringify(inv.j)?.slice(0, 150)}`);

// 2. stock movements & idempotency
const RUN_ID = Date.now();
const tx = (type, quantity, extra = {}) => call('POST', '/api/inventory/transactions', { type, quantity, materialId: mat.j.id, price: 10, newAvailableQuantity: 999999, ...extra }, P);
let r = await tx('IN', 100, { transactionNumber: `TXN-WF-IDEMP-${RUN_ID}`, idempotencyKey: `IDEMP-KEY-${RUN_ID}` });
ok('IN +100 saved', r.s === 201 && r.j.newAvailableQuantity === 100, JSON.stringify(r.j)?.slice(0, 160));
const dupTx = await tx('IN', 100, { transactionNumber: `TXN-WF-IDEMP-${RUN_ID}`, idempotencyKey: `IDEMP-KEY-${RUN_ID}` });
ok('duplicate idempotent transaction does not double-add stock', dupTx.s === 201 && dupTx.j.newAvailableQuantity === 100 && dupTx.j.idempotentReplay === true);

r = await tx('OUT', 30);
ok('OUT -30 saved, server math (browser value ignored)', r.s === 201 && r.j.previousAvailableQuantity === 100 && r.j.newAvailableQuantity === 70);
r = await tx('OUT', 100);
ok('OUT more than stock rejected (409)', r.s === 409, `status ${r.s}`);
ok('bad type rejected', (await call('POST', '/api/inventory/transactions', { type: 'XX', quantity: 1, materialId: mat.j.id }, P)).s === 400);
ok('zero quantity rejected', (await tx('IN', 0)).s === 400);
ok('negative quantity rejected', (await tx('OUT', -5)).s === 400);
ok('unknown material rejected', (await call('POST', '/api/inventory/transactions', { type: 'IN', quantity: 1, materialId: 'nope' }, P)).s === 404);
let m = (await call('GET', '/api/materials', null, P)).j.find(x => x.id === mat.j.id);
ok('material stock = 70', m?.inStock === 70, `got ${m?.inStock}`);
let iv = (await call('GET', '/api/inventory', null, P)).j.find(x => x.id === inv.j.id);
ok('inventory on hand follows stock = 70', iv?.onHand === 70, `got ${iv?.onHand}`);

// 10 people take 10 each at the same time from 70 -> exactly 7 win
const race = await Promise.all(Array.from({ length: 10 }, () => tx('OUT', 10)));
const won = race.filter(x => x.s === 201).length;
m = (await call('GET', '/api/materials', null, P)).j.find(x => x.id === mat.j.id);
ok('parallel stock-out: exactly 7 succeed', won === 7, `won ${won}`);
ok('parallel stock-out: final stock 0, never negative', m?.inStock === 0, `got ${m?.inStock}`);
const hist = (await call('GET', '/api/inventory/transactions', null, P)).j.filter(x => x.materialId === mat.j.id);
ok('history has every movement (1 IN + 1 OUT + 7 OUT)', hist.length === 9, `got ${hist.length}`);
ok('history shows actor from session', hist.every(h => h.actorName === 'WF PM'));

// 2b. Transaction edit and delete/reversal in PostgreSQL
const editTarget = hist.find(x => x.type === 'OUT' && x.quantity === 10);
const editRes = await call('PUT', `/api/inventory/transactions/${editTarget.id}`, { quantity: 4, price: 10, discount: 0 }, P);
m = (await call('GET', '/api/materials', null, P)).j.find(x => x.id === mat.j.id);
ok('transaction edit adjusts material stock (0 -> 6)', editRes.s === 200 && m?.inStock === 6, `got ${m?.inStock}`);

const delRes = await call('DELETE', `/api/inventory/transactions/${editTarget.id}`, null, P);
m = (await call('GET', '/api/materials', null, P)).j.find(x => x.id === mat.j.id);
ok('transaction delete reverses stock impact (6 -> 10)', delRes.s === 200 && m?.inStock === 10, `got ${m?.inStock}`);

// 3. price update keeps history & relational price_history_records with business-effective date
r = await call('POST', `/api/materials/${mat.j.id}/price-update`, {
  newPrice: 12.5,
  reason: 'Vendor contract Q4',
  updatedBy: 'WF PM',
  effectiveDate: '2026-10-01',
  idempotencyKey: `PRICE-UPD-WF-${RUN_ID}`
}, P);
ok('price update with business-effective date', r.s === 200 && r.j?.currentPrice === 12.5 && r.j?.effectiveDate === '2026-10-01' && r.j?.priceHistory?.length >= 1, JSON.stringify(r.j)?.slice(0, 140));

const phList = await call('GET', `/api/price-history?entityId=${mat.j.id}`, null, P);
ok('relational price_history_records persisted', phList.s === 200 && Array.isArray(phList.j) && phList.j.some(p => p.entityId === mat.j.id && p.newPrice === 12.5 && p.effectiveDate === '2026-10-01'), JSON.stringify(phList.j)?.slice(0, 140));

// 3b. Pagination, filtering, sorting, searching
const pag = await call('GET', '/api/materials?paginated=true&page=1&limit=2&sortBy=currentPrice&sortOrder=desc', null, P);
ok('paginated endpoint returns metadata & X-Total-Count header', pag.s === 200 && Array.isArray(pag.j?.data) && pag.j.data.length <= 2 && Number(pag.h.get('x-total-count')) >= 1);

// 4. project + decimal-safe analytics + links
const prj = await call('POST', '/api/projects', {
  code: 'WF-P1',
  name: 'WF Project',
  clientName: 'WF Client',
  quotedPrice: 1000,
  overheadPct: 10,
  contingencyPct: 5,
  selectedItems: [
    { id: 'i1', type: 'material', quantity: 3, unitCost: 0.1, discountPct: 0 },
    { id: 'i2', type: 'material', quantity: 3, unitCost: 0.2, discountPct: 0 }
  ]
}, P);
ok('project created', !!prj.j?.id, `status ${prj.s}`);
const an = await call('POST', '/api/analytics/calculate', prj.j || {}, P);
ok('decimal-safe analytics calculate (3*0.1 + 3*0.2 === 0.9)', an.s === 200 && an.j?.materialCost === 0.9, `status ${an.s} got materialCost=${an.j?.materialCost}`);
await call('PUT', `/api/inventory/${inv.j.id}`, { allocatedProjectId: prj.j.id }, P);
ok('delete project works', (await call('DELETE', `/api/projects/${prj.j.id}`, null, P)).s < 300);
iv = (await call('GET', '/api/inventory', null, P)).j.find(x => x.id === inv.j.id);
ok('inventory survives project delete', !!iv);

// 4b. Account Requests persistence in PostgreSQL
const accReq = await call('POST', '/api/account-requests', {
  employeeId: 'EMP-REQ-99',
  name: 'Requester User',
  email: 'req99@test.local',
  requestedRole: 'PROJECT_MANAGER',
  department: 'Costing',
  reason: 'Need access'
});
ok('public account request persisted to PostgreSQL', accReq.s === 201 && accReq.j?.id);
const accApprove = await call('PUT', `/api/account-requests/${accReq.j.id}/status`, { status: 'Approved' }, A);
ok('admin approves account request in PostgreSQL', accApprove.s === 200 && accApprove.j?.status === 'Approved');

// 5. delete supplier that is in use
ok('delete supplier in use does not crash', (await call('DELETE', `/api/suppliers/${sup.j.id}`, null, P)).s < 500);
ok('inventory survives supplier delete', !!(await call('GET', '/api/inventory', null, P)).j.find(x => x.id === inv.j.id));

// 6. database export / import round trip (admin)
const ex = await call('GET', '/api/database/export', null, A);
ok('export (admin)', ex.s === 200 && ex.j);
const before = (await call('GET', '/api/materials', null, A)).j.length;
const imp = await call('POST', '/api/database/import', ex.j, A);
ok('import (admin)', imp.s === 200, `status ${imp.s} ${JSON.stringify(imp.j)?.slice(0, 150)}`);
const after = (await call('GET', '/api/materials', null, A)).j.length;
ok('round trip keeps materials', before === after, `${before} -> ${after}`);
ok('login still works after import', !!(await call('POST', '/api/auth/login', { identifier: 'wf@test.local', password: 'WfTest#1234' })).j?.sessionToken);

// cleanup
await call('DELETE', `/api/inventory/${inv.j.id}`, null, A);
await call('DELETE', `/api/materials/${mat.j.id}`, null, A);
const allMats = (await call('GET', '/api/materials', null, A)).j || [];
for (const wm of allMats.filter(x => x.name === 'WF Material')) {
  await call('DELETE', `/api/materials/${wm.id}`, null, A);
}
const allInvs = (await call('GET', '/api/inventory', null, A)).j || [];
for (const wi of allInvs.filter(x => x.name === 'WF Material')) {
  await call('DELETE', `/api/inventory/${wi.id}`, null, A);
}
const allSups = (await call('GET', '/api/suppliers', null, A)).j || [];
for (const ws of allSups.filter(x => x.name === 'WF Supplier')) {
  await call('DELETE', `/api/suppliers/${ws.id}`, null, A);
}
const users = (await call('GET', '/api/users', null, A)).j || [];
const wf = users.find(u => u.email === 'wf@test.local'); if (wf) await call('DELETE', `/api/users/${wf.id}`, null, A);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
