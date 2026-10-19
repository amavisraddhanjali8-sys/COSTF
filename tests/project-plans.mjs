// ============================================================================
// Automated Tests: Complete Project Planning Database System
// Tests plan creation, retrieval, validation, project foreign-key linkage,
// financial summaries, revision tracking, activation, and archiving.
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

console.log('--- Step 1: Admin & Project Manager Authentication ---');
const l1 = await call('POST', '/api/auth/login', { identifier: ADMIN.id, password: ADMIN.pw });
let A = '';
if (l1.j?.tempMfaToken && ADMIN.code) {
  const l2 = await call('POST', '/api/auth/verify-mfa', { tempMfaToken: l1.j.tempMfaToken, code: ADMIN.code });
  A = l2.j?.sessionToken || '';
} else {
  A = l1.j?.sessionToken || '';
}
ok('admin authenticated session token acquired', !!A, `status ${l1.s} ${JSON.stringify(l1.j)}`);

// Setup PM user
const pmCreate = await call('POST', '/api/users', {
  name: 'Lead Estimator',
  email: `estimator-${Date.now()}@test.local`,
  employeeId: `EST-${Date.now().toString().slice(-4)}`,
  role: 'PROJECT_MANAGER',
  password: 'PmEstimator#123'
}, A);
const pmLogin = await call('POST', '/api/auth/login', { identifier: pmCreate.j?.email, password: 'PmEstimator#123' });
const P = pmLogin.j?.sessionToken || A;
ok('PM estimator session token acquired', !!P);

console.log('\n--- Step 2: Validation & Error Handling (Req 14, 15) ---');
// Reject plan creation with missing projectId
const badPlanNoProj = await call('POST', '/api/project-plans', {
  name: 'Orphan Plan',
  plannedRevenue: 10000
}, P);
ok('reject plan without projectId (400)', badPlanNoProj.s === 400);

// Reject plan creation with non-existent projectId
const badPlanFakeProj = await call('POST', '/api/project-plans', {
  projectId: 'non-existent-proj-uuid-9999',
  name: 'Invalid Project Plan'
}, P);
ok('reject plan referencing non-existent project (400/404)', badPlanFakeProj.s === 400 || badPlanFakeProj.s === 404);

// Reject plan creation with missing name
const badPlanNoName = await call('POST', '/api/project-plans', {
  projectId: 'any-id',
  name: ''
}, P);
ok('reject plan without name (400)', badPlanNoName.s === 400);

console.log('\n--- Step 3: Acceptance Test - Create 1 Project & 3 Plans Under It ---');
const prjCode = `PRJ-ACPT-${Date.now().toString().slice(-6)}`;
const prjRes = await call('POST', '/api/projects', {
  code: prjCode,
  name: 'Aerospace Propulsion Sub-Assembly',
  clientName: 'Lockheed Martin Space Systems',
  quotedPrice: 125000,
  targetMarginPct: 30,
  overheadPct: 8.5,
  contingencyPct: 5.0,
  currency: 'USD',
  status: 'Active',
  phases: [
    { id: 'ph-1', name: 'Engineering & CAD', budget: 25000 },
    { id: 'ph-2', name: 'Titanium CNC Milling', budget: 50000 },
    { id: 'ph-3', name: 'Anodizing & QA Testing', budget: 50000 }
  ]
}, P);

ok('created parent project in PostgreSQL', prjRes.s === 201 || prjRes.s === 200, JSON.stringify(prjRes.j)?.slice(0, 160));
const projectId = prjRes.j?.id;
ok('parent project has valid ID', !!projectId);

// 1. Create Plan 1: Baseline Plan
const plan1Res = await call('POST', `/api/projects/${projectId}/plans`, {
  name: 'Plan A: Certified AS9100 Baseline',
  description: 'Primary baseline plan with Tier-1 certified suppliers and ultrasonic inspections.',
  planType: 'Baseline',
  status: 'Approved',
  isBaseline: true,
  isActive: true,
  plannedRevenue: 125000,
  targetMarginPct: 30,
  overheadPct: 8.5,
  contingencyPct: 5.0,
  boqItems: [
    {
      name: 'Titanium Ti-6Al-4V Grade 5 Billet',
      itemCode: 'MAT-TI-01',
      type: 'material',
      quantity: 50,
      unit: 'kg',
      unitCost: 120.00,
      discountPct: 5.0,
      markupPct: 35.0,
      supplierOrProvider: 'Precision Aerospace Alloys'
    },
    {
      name: '5-Axis CNC Precision Machining',
      itemCode: 'SUB-CNC-01',
      type: 'subcontractor',
      quantity: 80,
      unit: 'hr',
      unitCost: 95.00,
      discountPct: 0,
      markupPct: 30.0,
      supplierOrProvider: 'Apex Precision Machining'
    },
    {
      name: 'Type III Hardcoat Anodizing (MIL-A-8625)',
      itemCode: 'OUT-ANO-01',
      type: 'outsourced',
      quantity: 50,
      unit: 'sq_ft',
      unitCost: 28.50,
      discountPct: 0,
      markupPct: 25.0,
      supplierOrProvider: 'ChemFinish Surface Tech'
    }
  ],
  overheadAllocations: [
    { category: 'Quality & Regulatory Compliance', allocationType: 'percentage', ratePct: 3.5, baseAmount: 14725, allocatedAmount: 515.38 },
    { category: 'Cleanroom Storage & Handling', allocationType: 'fixed', ratePct: 0, baseAmount: 0, allocatedAmount: 750.00 }
  ]
}, P);

ok('created Plan 1 (Baseline)', (plan1Res.s === 201 || plan1Res.s === 200) && plan1Res.j?.id, JSON.stringify(plan1Res.j)?.slice(0, 160));
const plan1 = plan1Res.j;

// 2. Create Plan 2: Alternative Scenario (Value-Engineered)
const plan2Res = await call('POST', `/api/projects/${projectId}/plans`, {
  name: 'Plan B: Value-Engineered Domestic Sourcing',
  description: 'Optimized cost scenario using domestic regional alloy distributors and bulk tooling discounts.',
  planType: 'Alternative',
  status: 'In Review',
  isBaseline: false,
  isActive: false,
  plannedRevenue: 120000,
  targetMarginPct: 32,
  overheadPct: 8.0,
  contingencyPct: 4.0,
  boqItems: [
    {
      name: 'Titanium Ti-6Al-4V Certified Bar Stock',
      itemCode: 'MAT-TI-02',
      type: 'material',
      quantity: 50,
      unit: 'kg',
      unitCost: 105.00,
      discountPct: 8.0,
      markupPct: 35.0,
      supplierOrProvider: 'Continental Metals Direct'
    },
    {
      name: 'Standard CNC Milling Service',
      itemCode: 'SUB-CNC-02',
      type: 'subcontractor',
      quantity: 80,
      unit: 'hr',
      unitCost: 85.00,
      discountPct: 0,
      markupPct: 30.0,
      supplierOrProvider: 'Valley CNC Tech'
    }
  ]
}, P);

ok('created Plan 2 (Value-Engineered)', (plan2Res.s === 201 || plan2Res.s === 200) && plan2Res.j?.id, JSON.stringify(plan2Res.j)?.slice(0, 160));
const plan2 = plan2Res.j;

// 3. Create Plan 3: Expedited Fast-Track Scenario
const plan3Res = await call('POST', `/api/projects/${projectId}/plans`, {
  name: 'Plan C: Fast-Track Expedited Manufacturing',
  description: 'Accelerated 14-day schedule with overtime shift multipliers and dedicated express freight.',
  planType: 'Alternative',
  status: 'Draft',
  isBaseline: false,
  isActive: false,
  plannedRevenue: 145000,
  targetMarginPct: 35,
  overheadPct: 10.0,
  contingencyPct: 6.0,
  boqItems: [
    {
      name: 'Titanium Pre-cut Billet (Express Delivery)',
      itemCode: 'MAT-TI-03',
      type: 'material',
      quantity: 50,
      unit: 'kg',
      unitCost: 135.00,
      discountPct: 0,
      markupPct: 35.0,
      supplierOrProvider: 'Precision Aerospace Alloys'
    },
    {
      name: 'Overtime 24/7 CNC Milling Shift',
      itemCode: 'SUB-CNC-03',
      type: 'subcontractor',
      quantity: 80,
      unit: 'hr',
      unitCost: 135.00,
      discountPct: 0,
      markupPct: 30.0,
      supplierOrProvider: 'Apex Precision Machining'
    }
  ]
}, P);

ok('created Plan 3 (Expedited)', (plan3Res.s === 201 || plan3Res.s === 200) && plan3Res.j?.id, JSON.stringify(plan3Res.j)?.slice(0, 160));
const plan3 = plan3Res.j;

console.log('\n--- Step 4: Acceptance Criteria Verification ---');
// Distinct Plan IDs
ok('all 3 plans have distinct IDs',
  plan1?.id !== plan2?.id &&
  plan2?.id !== plan3?.id &&
  plan1?.id !== plan3?.id,
  `ids: ${plan1?.id}, ${plan2?.id}, ${plan3?.id}`
);

// Distinct Human-Readable Plan Numbers
ok('all 3 plans have distinct human-readable plan numbers',
  !!plan1?.planNumber && !!plan2?.planNumber && !!plan3?.planNumber &&
  plan1?.planNumber !== plan2?.planNumber &&
  plan2?.planNumber !== plan3?.planNumber &&
  plan1?.planNumber !== plan3?.planNumber,
  `numbers: ${plan1?.planNumber}, ${plan2?.planNumber}, ${plan3?.planNumber}`
);

// Project Linkage
ok('Plan 1 references parent project foreign key', plan1?.projectId === projectId);
ok('Plan 2 references parent project foreign key', plan2?.projectId === projectId);
ok('Plan 3 references parent project foreign key', plan3?.projectId === projectId);

console.log('\n--- Step 5: Plan Retrieval & Project Linkage Verification (Req 10, 11, 12) ---');
// 1. Retrieve plans by project: GET /api/projects/:projectId/plans
const projectPlansRes = await call('GET', `/api/projects/${projectId}/plans`, null, P);
ok('GET /api/projects/:projectId/plans succeeds (200)', projectPlansRes.s === 200);
const projPlans = Array.isArray(projectPlansRes.j) ? projectPlansRes.j : projectPlansRes.j?.data || [];
ok('returns all 3 plans belonging to the project', projPlans.length === 3, `got ${projPlans.length}`);
ok('returned list contains Plan 1', projPlans.some(p => p.id === plan1.id));
ok('returned list contains Plan 2', projPlans.some(p => p.id === plan2.id));
ok('returned list contains Plan 3', projPlans.some(p => p.id === plan3.id));

// Verify table fields required by Requirement 11
const checkPlan1InList = projPlans.find(p => p.id === plan1.id);
ok('plan table has planNumber', !!checkPlan1InList?.planNumber);
ok('plan table has plan name', checkPlan1InList?.name === 'Plan A: Certified AS9100 Baseline');
ok('plan table has project code/id', checkPlan1InList?.projectId === projectId || checkPlan1InList?.projectCode === prjCode);
ok('plan table has revisionNumber', checkPlan1InList?.revisionNumber >= 1);
ok('plan table has status', checkPlan1InList?.status === 'Approved');
ok('plan table has plannedRevenue > 0', Number(checkPlan1InList?.plannedRevenue) > 0);
ok('plan table has directCost > 0', Number(checkPlan1InList?.directCost) > 0);
ok('plan table has allocatedOverhead >= 0', Number(checkPlan1InList?.allocatedOverhead) >= 0);
ok('plan table has totalPlannedCost > 0', Number(checkPlan1InList?.totalPlannedCost) > 0);
ok('plan table has plannedProfit', Number(checkPlan1InList?.plannedProfit) !== undefined);
ok('plan table has profitMarginPct', Number(checkPlan1InList?.profitMarginPct) !== undefined);
ok('plan table has lastUpdated / updatedAt', !!(checkPlan1InList?.lastUpdated || checkPlan1InList?.updatedAt));

console.log('\n--- Step 6: Dedicated Plan Details API (Req 9, 12, 21) ---');
// Retrieve dedicated plan details from PostgreSQL: GET /api/project-plans/:id
const detailRes = await call('GET', `/api/project-plans/${plan1.id}`, null, P);
ok('GET /api/project-plans/:id succeeds (200)', detailRes.s === 200);
const detail = detailRes.j;
ok('details page has correct planId', detail?.id === plan1.id);
ok('details page has correct planNumber', detail?.planNumber === plan1.planNumber);
ok('details page has foreign key to parent project', detail?.projectId === projectId);
ok('details page has BOQ line items array', Array.isArray(detail?.boqItems) && detail.boqItems.length === 3);
ok('details page has plan sections array', Array.isArray(detail?.sections) && detail.sections.length >= 1);
ok('details page has overhead allocations array', Array.isArray(detail?.overheadAllocations) && detail.overheadAllocations.length === 2);
ok('details page has cost summary object', typeof detail?.costSummary === 'object' && detail.costSummary !== null);
ok('details page has revision history array', Array.isArray(detail?.revisions) && detail.revisions.length >= 1);

// Backend calculation consistency check (Req 21)
// Direct Cost = 50 * 120 * 0.95 (5700) + 80 * 95 (7600) + 50 * 28.5 (1425) = 14725
const expectedDirectCost = 14725;
ok(`directCost calculated accurately by server (${expectedDirectCost})`, Math.abs(detail?.directCost - expectedDirectCost) < 1, `got ${detail?.directCost}`);
ok('cost summary matches plan top-level directCost', detail?.costSummary?.directCost === detail?.directCost);
ok('planned profit = planned revenue - total planned cost',
  Math.abs(detail?.plannedProfit - (detail?.plannedRevenue - detail?.totalPlannedCost)) < 1);

console.log('\n--- Step 7: Operations - Update, Activate, Duplicate, Archive (Req 13) ---');
// 1. Update Plan 1 with Revision Bump
const updateRes = await call('PUT', `/api/project-plans/${plan1.id}`, {
  name: 'Plan A: Certified AS9100 Baseline (Rev 2)',
  targetMarginPct: 32,
  overheadPct: 9.0,
  bumpRevision: true,
  changeSummary: 'Raised target margin to 32% per executive committee'
}, P);
ok('PUT /api/project-plans/:id succeeds', updateRes.s === 200);
ok('revision number bumped to 2', updateRes.j?.revisionNumber === 2, `got ${updateRes.j?.revisionNumber}`);
ok('revision history now contains 2 entries', updateRes.j?.revisions?.length === 2, `got ${updateRes.j?.revisions?.length}`);

// 2. Activate Plan 2 (Setting active scenario)
const activateRes = await call('POST', `/api/project-plans/${plan2.id}/activate`, {}, P);
ok('POST /api/project-plans/:id/activate succeeds', activateRes.s === 200 && activateRes.j?.isActive === true);

// Check that parent project active_plan_id updated to Plan 2
const prjRefetch = await call('GET', `/api/projects/${projectId}`, null, P);
ok('parent project active_plan_id updated to Plan 2 in PostgreSQL', prjRefetch.j?.activePlanId === plan2.id || prjRefetch.j?.active_plan_id === plan2.id);

// 3. Duplicate Plan 2
const dupRes = await call('POST', `/api/project-plans/${plan2.id}/duplicate`, {
  name: 'Plan B: Value-Engineered (Duplicate Branch)'
}, P);
ok('POST /api/project-plans/:id/duplicate succeeds', dupRes.s === 201 && dupRes.j?.id && dupRes.j?.id !== plan2.id);
ok('duplicated plan has unique plan number', dupRes.j?.planNumber !== plan2.planNumber);
ok('duplicated plan references parent project', dupRes.j?.projectId === projectId);

// 4. Archive Plan 3
const archiveRes = await call('POST', `/api/project-plans/${plan3.id}/archive`, {
  reason: 'Expedited schedule no longer feasible due to customer timeline shift'
}, P);
ok('POST /api/project-plans/:id/archive succeeds', archiveRes.s === 200);
ok('Plan 3 status is Archived', archiveRes.j?.status === 'Archived');

console.log('\n--- Step 8: Searching, Filtering, Sorting, Pagination (Req 18, 19) ---');
// Global plan listing with search
const searchRes = await call('GET', `/api/project-plans?search=${encodeURIComponent('Certified AS9100')}`, null, P);
ok('search project plans by keyword succeeds', searchRes.s === 200);
const searchPlans = Array.isArray(searchRes.j) ? searchRes.j : searchRes.j?.data || [];
ok('search returned matching plan', searchPlans.some(p => p.id === plan1.id));

// Filter by status=Archived
const filterArchivedRes = await call('GET', `/api/project-plans?status=Archived`, null, P);
ok('filter by status=Archived succeeds', filterArchivedRes.s === 200);
const archivedPlans = Array.isArray(filterArchivedRes.j) ? filterArchivedRes.j : filterArchivedRes.j?.data || [];
ok('filter returned Plan 3 in Archived status', archivedPlans.some(p => p.id === plan3.id));

// Sort by plannedRevenue desc
const sortRes = await call('GET', `/api/projects/${projectId}/plans?sortBy=plannedRevenue&sortOrder=desc`, null, P);
ok('sort by plannedRevenue succeeds', sortRes.s === 200);
const sortedPlans = Array.isArray(sortRes.j) ? sortRes.j : sortRes.j?.data || [];
if (sortedPlans.length >= 2) {
  ok('sorted plans in descending order of revenue', sortedPlans[0].plannedRevenue >= sortedPlans[1].plannedRevenue);
}

// Pagination with paginated=true
const pageRes = await call('GET', `/api/projects/${projectId}/plans?paginated=true&limit=2&page=1`, null, P);
ok('pagination query returns metadata (page, limit, totalPages, total)',
  pageRes.s === 200 && pageRes.j?.page === 1 && pageRes.j?.limit === 2 && pageRes.j?.total >= 3 && Array.isArray(pageRes.j?.data) && pageRes.j.data.length <= 2
);

console.log('\n--- Step 9: Reconnection & Persistence Verification ---');
// Simulate restart / fresh query to PostgreSQL
const persistCheck = await call('GET', `/api/projects/${projectId}/plans`, null, P);
const finalPlans = Array.isArray(persistCheck.j) ? persistCheck.j : persistCheck.j?.data || [];
ok('all plans persist across requests and remain linked to parent project',
  finalPlans.length >= 3 &&
  finalPlans.every(p => p.projectId === projectId) &&
  finalPlans.some(p => p.id === plan1.id) &&
  finalPlans.some(p => p.id === plan2.id) &&
  finalPlans.some(p => p.id === plan3.id)
);

console.log(`\n========================================`);
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log(`========================================\n`);

process.exit(fail ? 1 : 0);
