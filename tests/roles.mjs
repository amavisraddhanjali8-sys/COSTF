// Role test: no login / project manager / admin against every route group
const B = process.env.BASE || 'http://localhost:3000';
const ADMIN = { id: process.env.ADMIN_EMAIL, pw: process.env.ADMIN_PASSWORD, code: process.env.ADMIN_CODE };
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n} ${c ? '' : x}`); };
const call = async (m, p, body, t) => {
  const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};

// admin login (password + admin code)
let r = await call('POST', '/api/auth/login', { identifier: ADMIN.id, password: ADMIN.pw });
ok('admin login step 1', r.s === 200 && r.j?.tempMfaToken, JSON.stringify(r.j));
r = await call('POST', '/api/auth/verify-mfa', { tempMfaToken: r.j.tempMfaToken, code: 'WRONG-CODE' });
ok('admin wrong code rejected', r.s >= 400);
const l1 = await call('POST', '/api/auth/login', { identifier: ADMIN.id, password: ADMIN.pw });
r = await call('POST', '/api/auth/verify-mfa', { tempMfaToken: l1.j.tempMfaToken, code: ADMIN.code });
const A = r.j?.sessionToken;
ok('admin login step 2', !!A, JSON.stringify(r.j));
ok('old hardcoded code A9HF-4K28@ rejected', (await (async () => { const x = await call('POST', '/api/auth/login', { identifier: ADMIN.id, password: ADMIN.pw }); return call('POST', '/api/auth/verify-mfa', { tempMfaToken: x.j.tempMfaToken, code: 'A9HF-4K28@' }); })()).s >= 400);
r = await call('POST', '/api/auth/login', { identifier: ADMIN.id, password: 'bad' });
ok('wrong password rejected', r.s === 401);

// create project manager (admin only)
r = await call('POST', '/api/users', { name: 'PM Test', email: 'pm@test.local', employeeId: 'PM-01', role: 'PROJECT_MANAGER', password: 'short' }, A);
ok('weak password rejected', r.s === 400);
r = await call('POST', '/api/users', { name: 'PM Test', email: 'pm@test.local', employeeId: 'PM-01', role: 'PROJECT_MANAGER', password: 'PmTest#123' }, A);
ok('admin creates PM', r.s === 201, JSON.stringify(r.j));
const pmId = r.j?.id;
r = await call('POST', '/api/auth/login', { identifier: 'pm@test.local', password: 'PmTest#123' });
const P = r.j?.sessionToken;
ok('PM login', !!P, JSON.stringify(r.j));

const readOk = ['clients','suppliers','materials','outsourced','subcontractors','produce','inventory','inventory/transactions','projects','categories','custom-tiles','company-details'];
const adminOnlyRead = ['users','audit-logs','security/admin-config','database/status','database/export'];
for (const e of readOk) {
  ok(`none  GET ${e}`, (await call('GET', '/api/' + e)).s === (e === 'company-details' ? 200 : 401));
  ok(`PM    GET ${e}`, (await call('GET', '/api/' + e, null, P)).s === 200);
  ok(`admin GET ${e}`, (await call('GET', '/api/' + e, null, A)).s === 200);
}
for (const e of adminOnlyRead) {
  ok(`none  GET ${e} blocked`, (await call('GET', '/api/' + e)).s === 401);
  ok(`PM    GET ${e} blocked`, (await call('GET', '/api/' + e, null, P)).s === 403);
  ok(`admin GET ${e}`, (await call('GET', '/api/' + e, null, A)).s === 200);
}
// PM writes
for (const [e, b] of [['suppliers',{name:'PM Sup'}],['materials',{name:'PM Mat',unit:'kg',currentPrice:5}],['clients',{name:'PM Cli'}]]) {
  const c = await call('POST', '/api/' + e, b, P);
  ok(`PM    POST ${e}`, c.s < 300 && c.j?.id, `status ${c.s}`);
  if (c.j?.id) ok(`PM    DELETE ${e}`, (await call('DELETE', `/api/${e}/${c.j.id}`, null, P)).s < 300);
}
// PM must not do admin things
ok('PM cannot create user', (await call('POST', '/api/users', { name: 'x', email: 'x@x.com', password: 'Abcdefg#1' }, P)).s === 403);
ok('PM cannot delete user', (await call('DELETE', `/api/users/${pmId}`, null, P)).s === 403);
ok('PM cannot edit company', (await call('PUT', '/api/company-details', { name: 'Hack' }, P)).s === 403);
ok('PM cannot import database', (await call('POST', '/api/database/import', {}, P)).s === 403);
ok('PM cannot reset data', (await call('POST', '/api/reset-data', {}, P)).s === 403);
ok('no login cannot reset data', (await call('POST', '/api/reset-data', {})).s === 401);
// audit actor comes from session
await call('POST', '/api/audit-logs', { action: 'TEST', module: 'Test', actorRole: 'ADMIN', actorName: 'Fake' }, P);
const logs = await call('GET', '/api/audit-logs', null, A);
const mine = (logs.j || []).find(l => l.action === 'TEST');
ok('audit actor stamped from session (not spoofable)', mine && mine.actorRole === 'PROJECT_MANAGER' && mine.actorName === 'PM Test', JSON.stringify(mine));
// shared settings (database backed)
ok('none cannot read settings', (await call('GET', '/api/kv')).s === 401);
ok('PM saves setting', (await call('PUT', '/api/kv/test_setting', { value: '{"a":1}' }, P)).s === 200);
const kv = await call('GET', '/api/kv', null, A);
ok('admin sees PM setting', kv.j?.test_setting === '{"a":1}');
ok('bad key rejected', (await call('PUT', '/api/kv/bad key!', { value: 'x' }, P)).s === 400);
ok('PM deletes setting', (await call('DELETE', '/api/kv/test_setting', null, P)).s === 200);
// images: upload + URL
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
ok('none cannot upload image', (await call('POST', '/api/upload-image', { dataUrl: PNG })).s === 401);
const up = await call('POST', '/api/upload-image', { dataUrl: PNG, filename: 't.png', mimeType: 'image/png' }, P);
ok('PM uploads image', up.s === 200 && up.j?.url, JSON.stringify(up.j));
const img = await fetch(B + (up.j?.url || '/x'));
ok('image served publicly with right type', img.status === 200 && img.headers.get('content-type') === 'image/png' && img.headers.get('x-content-type-options') === 'nosniff');
ok('image URL accepted', (await call('POST', '/api/upload-image', { url: 'https://example.com/a.jpg' }, P)).s === 200);
ok('javascript: URL rejected', (await call('POST', '/api/upload-image', { url: 'javascript:alert(1)' }, P)).s === 400);
ok('html upload rejected', (await call('POST', '/api/upload-image', { dataUrl: 'data:text/html;base64,PGI+' }, P)).s === 400);
// logout kills token
await call('POST', '/api/auth/logout', {}, P);
ok('PM token dead after logout', (await call('GET', '/api/materials', null, P)).s === 401);
// deactivate
await call('PUT', `/api/users/${pmId}`, { status: 'Inactive' }, A);
ok('inactive PM cannot log in', (await call('POST', '/api/auth/login', { identifier: 'pm@test.local', password: 'PmTest#123' })).s === 403);
await call('DELETE', `/api/users/${pmId}`, null, A);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
