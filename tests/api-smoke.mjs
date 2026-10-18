// Smoke test: every list route + create/update/delete on main entities
const B = process.env.BASE || 'http://localhost:3000';
let pass = 0, fail = 0;
const ok = (n, c, extra='') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n} ${c ? '' : extra}`); };
const TOKEN = process.env.TOKEN || '';
const call = async (m, p, body, token = TOKEN) => {
  const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const lists = ['clients','suppliers','materials','outsourced','subcontractors','produce','inventory','inventory/transactions','projects','categories','custom-tiles','audit-logs','users','company-details'];
for (const l of lists) { const r = await call('GET', '/api/' + l); ok(`GET /api/${l}`, r.s === 200, `status ${r.s}`); }

const cycles = [
  ['suppliers', { name: 'T Supplier', code: 'T-S1' }],
  ['materials', { name: 'T Material', code: 'T-M1', unit: 'kg', currentPrice: 12.5 }],
  ['clients',   { name: 'T Client' }],
  ['categories',{ name: 'T Cat', type: 'MATERIAL', group: 'G' }],
];
for (const [e, body] of cycles) {
  const c = await call('POST', '/api/' + e, body);
  ok(`POST /api/${e}`, c.s < 300 && c.j?.id, `status ${c.s} ${JSON.stringify(c.j)?.slice(0,120)}`);
  if (!c.j?.id) continue;
  const u = await call('PUT', `/api/${e}/${c.j.id}`, { ...c.j, name: 'T Updated' });
  ok(`PUT /api/${e}/:id`, u.s < 300, `status ${u.s}`);
  const g = await call('GET', '/api/' + e);
  ok(`  persisted ${e}`, Array.isArray(g.j) && g.j.some(x => x.id === c.j.id && x.name === 'T Updated'));
  const d = await call('DELETE', `/api/${e}/${c.j.id}`);
  ok(`DELETE /api/${e}/:id`, d.s < 300, `status ${d.s}`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
