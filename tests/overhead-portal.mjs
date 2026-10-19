// ============================================================================
// Automated Tests: Complete Overhead Cost Management Portal (TASK 2)
// Verifies central overhead catalogue, plan allocations, multi-method calculation,
// plan isolation, double-counting protections, and audit logging.
// ============================================================================
const B = process.env.BASE || 'http://localhost:3000';
const ADMIN = {
  id: process.env.ADMIN_EMAIL || 'admin@example.com',
  pw: process.env.ADMIN_PASSWORD || 'AdminPass123!',
  code: process.env.ADMIN_CODE || '000000'
};

let pass = 0, fail = 0;
const ok = (n, c, x = '') => {
  if (c) {
    pass++;
    console.log(`PASS  ${n}`);
  } else {
    fail++;
    console.log(`FAIL  ${n} ${x}`);
  }
};

const call = async (m, p, body, token) => {
  const r = await fetch(B + p, {
    method: m,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let j = null;
  try {
    j = await r.json();
  } catch {}
  return { s: r.status, j, h: r.headers };
};

async function run() {
  console.log('--- Step 1: Admin Authentication ---');
  const l1 = await call('POST', '/api/auth/login', { identifier: ADMIN.id, password: ADMIN.pw });
  let token = '';
  if (l1.j?.tempMfaToken && ADMIN.code) {
    const l2 = await call('POST', '/api/auth/verify-mfa', { tempMfaToken: l1.j.tempMfaToken, code: ADMIN.code });
    token = l2.j?.sessionToken || '';
  } else {
    token = l1.j?.sessionToken || '';
  }
  ok('admin authenticated session token acquired', !!token, `status ${l1.s}`);

  console.log('\n--- Step 2: Create Overhead Items in Central Catalogue ---');
  const codeSuffix = Date.now().toString().slice(-4);
  const fixedItemRes = await call('POST', '/api/overhead-items', {
    code: `OVH-FIX-${codeSuffix}`,
    name: `General Site Facilities ${codeSuffix}`,
    category: 'Facilities & Utilities',
    description: 'Fixed facilities and trailer cost',
    defaultCalculationMethod: 'fixed_amount',
    defaultRate: 15000,
    costType: 'Fixed',
    status: 'Active'
  }, token);
  ok('create fixed overhead item in catalogue', fixedItemRes.s === 200 || fixedItemRes.s === 201, `status: ${fixedItemRes.s} ${JSON.stringify(fixedItemRes.j)}`);
  const fixedItem = fixedItemRes.j;

  const pctItemRes = await call('POST', '/api/overhead-items', {
    code: `OVH-PCT-${codeSuffix}`,
    name: `Corporate Insurance & Bonding ${codeSuffix}`,
    category: 'Insurance & Bonding',
    description: '6.5% of total direct cost base',
    defaultCalculationMethod: 'percentage_of_cost_base',
    defaultCostBase: 'total_direct_cost',
    defaultRate: 6.5,
    costType: 'Variable',
    status: 'Active'
  }, token);
  ok('create percentage overhead item in catalogue', pctItemRes.s === 200 || pctItemRes.s === 201, `status: ${pctItemRes.s} ${JSON.stringify(pctItemRes.j)}`);
  const pctItem = pctItemRes.j;

  const unitItemRes = await call('POST', '/api/overhead-items', {
    code: `OVH-UNT-${codeSuffix}`,
    name: `Heavy Crane Inspection Fee ${codeSuffix}`,
    category: 'Plant & Equipment',
    description: '$120 per operating hour',
    defaultCalculationMethod: 'rate_per_unit',
    defaultRate: 120,
    unitType: 'hour',
    costType: 'Variable',
    status: 'Active'
  }, token);
  ok('create unit-rate overhead item in catalogue', unitItemRes.s === 200 || unitItemRes.s === 201, `status: ${unitItemRes.s} ${JSON.stringify(unitItemRes.j)}`);
  const unitItem = unitItemRes.j;

  console.log('\n--- Step 3: Query & Filter Overhead Items in Catalogue ---');
  const listRes = await call('GET', '/api/overhead-items', null, token);
  ok('get all overhead items', listRes.s === 200 && Array.isArray(listRes.j), `count: ${listRes.j?.length}`);
  const foundFixed = listRes.j?.find(it => it.code === `OVH-FIX-${codeSuffix}`);
  ok('newly created fixed item found in list', !!foundFixed);

  console.log('\n--- Step 4: Setup Two Isolated Test Project Plans (Plan A and Plan B) ---');
  const projectsRes = await call('GET', '/api/projects', null, token);
  let projectId = projectsRes.j?.[0]?.id;
  if (!projectId) {
    const newProj = await call('POST', '/api/projects', {
      name: `Overhead Test Project ${codeSuffix}`,
      clientName: 'Global Client',
      type: 'commercial',
      status: 'Active'
    }, token);
    projectId = newProj.j?.id;
  }
  ok('have target projectId for testing', !!projectId);

  // Create Plan A with $100,000 direct cost
  const planARes = await call('POST', `/api/projects/${projectId}/plans`, {
    name: `Plan A Overhead Test ${codeSuffix}`,
    status: 'Draft',
    currency: 'USD',
    plannedRevenue: 150000,
    boqItems: [
      {
        name: 'Structural Steel Columns',
        itemCode: `MAT-STL-${codeSuffix}`,
        type: 'material',
        quantity: 100,
        unit: 'ton',
        unitCost: 1000,
        discountPct: 0,
        markupPct: 20
      }
    ]
  }, token);
  ok('create Plan A with 100k direct cost', planARes.s === 200 || planARes.s === 201, `status: ${planARes.s}`);
  const planAId = planARes.j?.id;

  // Create Plan B (completely isolated)
  const planBRes = await call('POST', `/api/projects/${projectId}/plans`, {
    name: `Plan B Isolated Overhead Test ${codeSuffix}`,
    status: 'Draft',
    currency: 'USD',
    plannedRevenue: 200000
  }, token);
  ok('create Plan B', planBRes.s === 200 || planBRes.s === 201, `status: ${planBRes.s}`);
  const planBId = planBRes.j?.id;

  console.log('\n--- Step 5: Allocate Overhead Items to Plan A and Recalculate ---');
  // Allocate fixed item to Plan A ($15,000)
  const allocFixedRes = await call('POST', `/api/project-plans/${planAId}/overheads`, {
    overheadItemId: fixedItem.id,
    allocationMethod: 'fixed_amount',
    allocationRate: 15000
  }, token);
  ok('allocate fixed item to Plan A', allocFixedRes.s === 200 || allocFixedRes.s === 201, `status: ${allocFixedRes.s} ${JSON.stringify(allocFixedRes.j)}`);
  const allocFixed = allocFixedRes.j;

  // Allocate percentage item to Plan A (6.5% of total direct cost base ($100,000) = $6,500)
  const allocPctRes = await call('POST', `/api/project-plans/${planAId}/overheads`, {
    overheadItemId: pctItem.id,
    allocationMethod: 'percentage_of_cost_base',
    allocationBase: 'total_direct_cost',
    allocationRate: 6.5
  }, token);
  ok('allocate percentage item to Plan A', allocPctRes.s === 200 || allocPctRes.s === 201, `status: ${allocPctRes.s} ${JSON.stringify(allocPctRes.j)}`);

  // Fetch Plan A details to verify overhead allocations and summary update
  const planAFetch = await call('GET', `/api/project-plans/${planAId}`, null, token);
  ok('fetch Plan A details', planAFetch.s === 200);
  const planAData = planAFetch.j;
  const allocationsA = planAData?.overheadAllocations || [];
  ok('Plan A has 2 overhead allocations', allocationsA.length === 2, `actual: ${allocationsA.length}`);
  const totalAllocA = allocationsA.reduce((sum, a) => sum + Number(a.allocatedAmount || 0), 0);
  ok('Plan A overhead sum is 21,500', totalAllocA === 21500, `actual: ${totalAllocA}`);
  const planAOverheadSummary = Number(planAData?.allocatedOverhead ?? planAData?.costSummary?.allocatedOverhead ?? 0);
  ok('Plan A summary overhead matches 21,500', planAOverheadSummary === 21500, `actual: ${planAOverheadSummary}`);

  console.log('\n--- Step 6: Verify Plan B Isolation (Plan B must have ZERO overhead allocations) ---');
  const planBFetch = await call('GET', `/api/project-plans/${planBId}`, null, token);
  ok('fetch Plan B details', planBFetch.s === 200);
  const allocationsB = planBFetch.j?.overheadAllocations || [];
  ok('Plan B has zero overhead allocations', allocationsB.length === 0, `actual: ${allocationsB.length}`);
  const planBOverheadSummary = Number(planBFetch.j?.allocatedOverhead ?? planBFetch.j?.costSummary?.allocatedOverhead ?? 0);
  ok('Plan B summary allocatedOverhead is 0', planBOverheadSummary === 0, `actual: ${planBOverheadSummary}`);

  console.log('\n--- Step 7: Prevent Double Counting / Duplicate Allocation ---');
  const dupAllocRes = await call('POST', `/api/project-plans/${planAId}/overheads`, {
    overheadItemId: fixedItem.id,
    allocationMethod: 'fixed_amount',
    allocationRate: 15000
  }, token);
  ok('duplicate allocation returns conflict error (409)', dupAllocRes.s === 409, `status: ${dupAllocRes.s}`);

  console.log('\n--- Step 8: Update / Edit Overhead Allocation on Plan A ---');
  if (allocFixed?.id) {
    const updateAllocRes = await call('PUT', `/api/project-plans/${planAId}/overheads/${allocFixed.id}`, {
      allocationRate: 18000
    }, token);
    ok('update allocation rate to 18,000 on Plan A', updateAllocRes.s === 200, `status: ${updateAllocRes.s}`);

    const planAFetchAfterUpdate = await call('GET', `/api/project-plans/${planAId}`, null, token);
    const updatedOverhead = Number(planAFetchAfterUpdate.j?.allocatedOverhead ?? planAFetchAfterUpdate.j?.costSummary?.allocatedOverhead ?? 0);
    ok('Plan A summary overhead updated to 24,500 (18000 + 6500)', updatedOverhead === 24500, `actual: ${updatedOverhead}`);
  }

  console.log('\n--- Step 9: Delete Overhead Allocation on Plan A ---');
  if (allocFixed?.id) {
    const deleteAllocRes = await call('DELETE', `/api/project-plans/${planAId}/overheads/${allocFixed.id}`, null, token);
    ok('delete fixed allocation from Plan A', deleteAllocRes.s === 200, `status: ${deleteAllocRes.s}`);

    const planAFetchAfterDelete = await call('GET', `/api/project-plans/${planAId}`, null, token);
    const allocationsAfterDelete = planAFetchAfterDelete.j?.overheadAllocations || [];
    ok('Plan A now has 1 allocation remaining', allocationsAfterDelete.length === 1);
    const remainingOverhead = Number(planAFetchAfterDelete.j?.allocatedOverhead ?? planAFetchAfterDelete.j?.costSummary?.allocatedOverhead ?? 0);
    ok('Plan A overhead total updated to 6,500', remainingOverhead === 6500, `actual: ${remainingOverhead}`);
  }

  console.log('\n--- Step 10: Overhead Audit Trail Logs ---');
  const auditLogsRes = await call('GET', '/api/overhead-audit-logs?limit=10', null, token);
  ok('fetch overhead audit logs', auditLogsRes.s === 200, `status: ${auditLogsRes.s}`);
  const logs = auditLogsRes.j?.data || (Array.isArray(auditLogsRes.j) ? auditLogsRes.j : []);
  ok('audit logs contain entries for created items and allocations', logs.length > 0, `count: ${logs.length}`);

  console.log(`\n============================================================================`);
  console.log(`TEST SUMMARY: ${pass} PASSED, ${fail} FAILED`);
  console.log(`============================================================================\n`);

  if (fail > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error running overhead tests:', err);
  process.exit(1);
});
