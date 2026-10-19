// tests/revenue-catalogue-boq.mjs
// TASK 3 Comprehensive Acceptance Test
import assert from 'node:assert';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

let sessionToken = '';

async function req(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    ...(options.headers || {})
  };
  const res = await fetch(url, {
    ...options,
    headers
  });
  const text = await res.text();
  try {
    return { status: res.status, ok: res.ok, body: JSON.parse(text) };
  } catch {
    return { status: res.status, ok: res.ok, text };
  }
}

async function loginAdmin() {
  const creds = {
    identifier: process.env.ADMIN_EMAIL || 'admin@example.com',
    password: process.env.ADMIN_PASSWORD || 'AdminPass123!'
  };
  const loginRes = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(creds)
  });
  if (loginRes.body?.sessionToken) {
    sessionToken = loginRes.body.sessionToken;
  } else if (loginRes.body?.tempMfaToken) {
    const mfaRes = await req('/api/auth/verify-mfa', {
      method: 'POST',
      body: JSON.stringify({ tempMfaToken: loginRes.body.tempMfaToken, code: '000000' })
    });
    sessionToken = mfaRes.body?.sessionToken || '';
  }
  assert.ok(sessionToken, 'Failed to acquire admin session token');
  console.log('✓ Authenticated as Administrator for tests.');
}

async function run() {
  console.log('🚀 Running Task 3 Acceptance Test: Revenue Catalogue, Plan BOQ, and Historical Commercial Rate Tracking\n');

  console.log('Step 0: Authenticating...');
  await loginAdmin();

  // 1. Setup: Ensure we have a project and two plans (Plan A and Plan B)
  console.log('Step 1: Setting up projects and plans...');
  const projRes = await req('/api/projects');
  assert.ok(projRes.ok, 'Failed to fetch projects');
  let projects = Array.isArray(projRes.body) ? projRes.body : projRes.body?.data || [];
  let testProject = projects[0];

  if (!testProject) {
    const createPrj = await req('/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Enterprise Commercial Tower Project',
        clientName: 'Apex Commercial Ltd',
        currency: 'LKR',
        budget: 5000000
      })
    });
    assert.ok(createPrj.ok, 'Failed to create test project');
    testProject = createPrj.body;
  }
  console.log(`✓ Using Project: [${testProject.id}] ${testProject.name}`);

  // Ensure Plan A exists
  const planARes = await req(`/api/projects/${testProject.id}/plans`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Plan A: Primary Commercial Sourcing',
      planType: 'Baseline',
      currency: 'LKR',
      targetMarginPct: 25
    })
  });
  assert.ok(planARes.ok, 'Failed to create Plan A');
  const planA = planARes.body;
  console.log(`✓ Created Plan A: [${planA.id}] ${planA.name} (${planA.planNumber})`);

  // Ensure Plan B exists
  const planBRes = await req(`/api/projects/${testProject.id}/plans`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Plan B: Value Engineered Option',
      planType: 'Scenario',
      currency: 'LKR',
      targetMarginPct: 28
    })
  });
  assert.ok(planBRes.ok, 'Failed to create Plan B');
  const planB = planBRes.body;
  console.log(`✓ Created Plan B: [${planB.id}] ${planB.name} (${planB.planNumber})`);

  // 2. ACCEPTANCE TEST STEP 1:
  // "Create a product called Aluminium Door. Set its default selling rate to LKR 15,000 per unit."
  console.log('\nStep 2: Creating product "Aluminium Door" with default selling rate LKR 15,000...');
  const createProdRes = await req('/api/revenue-items', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Aluminium Door',
      code: `REV-DOOR-${Date.now().toString().slice(-4)}`,
      type: 'product',
      category: 'Architectural & Structural Aluminium',
      subCategory: 'Heavy Duty Sliding',
      description: 'Manufactured architectural grade aluminium door assembly with reinforced hinges.',
      unit: 'unit',
      defaultRate: 15000,
      currency: 'LKR',
      taxTreatment: 'Standard (0%)',
      taxRatePct: 0,
      status: 'Active'
    })
  });
  assert.ok(createProdRes.ok, `Failed to create Aluminium Door: ${JSON.stringify(createProdRes.body)}`);
  const doorProduct = createProdRes.body;
  assert.strictEqual(doorProduct.name, 'Aluminium Door');
  assert.strictEqual(Number(doorProduct.defaultRate), 15000, 'Default rate must be 15000');
  assert.strictEqual(doorProduct.type, 'product', 'Must be product type');
  assert.strictEqual(doorProduct.currency, 'LKR');
  console.log(`✓ Created Revenue Product: [${doorProduct.id}] ${doorProduct.name} (Code: ${doorProduct.code}) with Default Rate: LKR ${doorProduct.defaultRate}`);

  // 3. ACCEPTANCE TEST STEP 2:
  // "Add it to Plan A with:
  //  - Unit: No.
  //  - Quantity: 10.
  //  - Rate: LKR 16,500."
  console.log('\nStep 3: Adding Aluminium Door to Plan A with Unit: No., Quantity: 10, Rate: LKR 16,500...');
  const addPlanARes = await req(`/api/project-plans/${planA.id}/boq-items`, {
    method: 'POST',
    body: JSON.stringify({
      revenueItemId: doorProduct.id,
      itemCode: doorProduct.code,
      name: doorProduct.name,
      description: 'Aluminium Door installed at Tower A entrance',
      unit: 'No.',
      quantity: 10,
      rate: 16500,
      discountPct: 0,
      commercialContext: 'Initial tender submission for Tower A',
      changeReason: 'Tender opening rate specification',
      effectiveDate: '2026-10-19'
    })
  });
  assert.ok(addPlanARes.ok, `Failed to add Aluminium Door to Plan A: ${JSON.stringify(addPlanARes.body)}`);
  const boqItemA = addPlanARes.body.boqItem;
  assert.strictEqual(boqItemA.plan_id || boqItemA.planId, planA.id, 'Must connect to Plan A');
  assert.strictEqual(boqItemA.project_id || boqItemA.projectId, testProject.id, 'Must connect to Project');
  assert.strictEqual(boqItemA.revenue_item_id || boqItemA.revenueItemId, doorProduct.id, 'Must connect to Revenue Item');
  assert.strictEqual(boqItemA.unit, 'No.');
  assert.strictEqual(Number(boqItemA.quantity), 10);
  assert.strictEqual(Number(boqItemA.rate ?? boqItemA.billable_rate), 16500);
  assert.strictEqual(Number(boqItemA.total_revenue ?? boqItemA.totalRevenue), 165000); // 10 * 16500
  console.log(`✓ Added to Plan A: Quantity 10 No. @ LKR 16,500 = Total Revenue LKR ${boqItemA.total_revenue ?? boqItemA.totalRevenue}`);

  // Also add it to Plan B with different terms to test independence (Requirement 19)
  console.log('\nStep 3b: Adding Aluminium Door to Plan B with independent terms (Unit: No., Quantity: 5, Rate: LKR 18,000)...');
  const addPlanBRes = await req(`/api/project-plans/${planB.id}/boq-items`, {
    method: 'POST',
    body: JSON.stringify({
      revenueItemId: doorProduct.id,
      itemCode: doorProduct.code,
      name: doorProduct.name,
      description: 'Aluminium Door for Plan B special annex',
      unit: 'No.',
      quantity: 5,
      rate: 18000,
      discountPct: 0,
      commercialContext: 'Plan B custom quote',
      changeReason: 'Low volume premium rate'
    })
  });
  assert.ok(addPlanBRes.ok, `Failed to add to Plan B: ${JSON.stringify(addPlanBRes.body)}`);
  const boqItemB = addPlanBRes.body.boqItem;
  console.log(`✓ Added to Plan B: Quantity 5 No. @ LKR 18,000 = Total Revenue LKR ${boqItemB.total_revenue ?? boqItemB.totalRevenue}`);

  // 4. ACCEPTANCE TEST STEP 3:
  // "Then change the rate in Plan A to LKR 17,000."
  console.log('\nStep 4: Updating the rate in Plan A from LKR 16,500 to LKR 17,000...');
  const updatePlanARes = await req(`/api/project-plans/${planA.id}/boq-items/${boqItemA.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      rate: 17000,
      quantity: 10,
      unit: 'No.',
      changeReason: 'Client negotiated finish specification upgrade and rate increase',
      commercialContext: 'Signed Addendum 1 with client representative'
    })
  });
  assert.ok(updatePlanARes.ok, `Failed to update rate in Plan A: ${JSON.stringify(updatePlanARes.body)}`);
  const updatedBoqItemA = updatePlanARes.body.boqItem;
  assert.strictEqual(Number(updatedBoqItemA.rate ?? updatedBoqItemA.billable_rate), 17000);
  assert.strictEqual(Number(updatedBoqItemA.total_revenue ?? updatedBoqItemA.totalRevenue), 170000); // 10 * 17000
  console.log(`✓ Updated Plan A BOQ Item rate to LKR 17,000. New Total Revenue: LKR ${updatedBoqItemA.total_revenue ?? updatedBoqItemA.totalRevenue}`);

  // 5. ACCEPTANCE TEST VERIFICATIONS:
  console.log('\nStep 5: Verifying all Acceptance Test Assertions:');

  // Assertion 1: "The catalogue default remains LKR 15,000."
  console.log(' - Checking Catalogue Default Rate...');
  const catalogCheck = await req(`/api/revenue-items/${doorProduct.id}`);
  assert.ok(catalogCheck.ok, 'Failed to retrieve catalogue item');
  assert.strictEqual(
    Number(catalogCheck.body.defaultRate),
    15000,
    `CRITICAL REQUIREMENT FAILED: Catalogue default rate must remain 15000, got ${catalogCheck.body.defaultRate}`
  );
  console.log(`   ✓ Catalogue default rate remains untouched at LKR ${catalogCheck.body.defaultRate}`);

  // Assertion 2: "The plan retains its own commercial terms."
  console.log(' - Checking Plan A Commercial Terms...');
  const planABoqItemsRes = await req(`/api/project-plans/${planA.id}/boq-items`);
  assert.ok(planABoqItemsRes.ok, 'Failed to fetch Plan A BOQ items');
  const itemsInA = planABoqItemsRes.body;
  const itemInA = itemsInA.find((i) => i.id === boqItemA.id);
  assert.ok(itemInA, 'BOQ Item A not found in Plan A');
  assert.strictEqual(Number(itemInA.rate ?? itemInA.sellingRate), 17000, 'Plan A rate must be 17000');
  assert.strictEqual(Number(itemInA.quantity), 10, 'Plan A quantity must be 10');
  assert.strictEqual(itemInA.unit, 'No.', 'Plan A unit must be No.');
  assert.strictEqual(Number(itemInA.totalRevenue), 170000, 'Plan A total revenue must be 170000');
  console.log(`   ✓ Plan A retains commercial terms: ${itemInA.quantity} ${itemInA.unit} @ LKR ${itemInA.rate} = LKR ${itemInA.totalRevenue}`);

  // Assertion 3: "The original rate and revised rate are recorded in history."
  console.log(' - Checking Rate History in PostgreSQL...');
  const historyRes = await req(`/api/revenue-items/${doorProduct.id}/rate-history`);
  assert.ok(historyRes.ok, 'Failed to fetch revenue rate history');
  const historyList = historyRes.body.data || historyRes.body;
  assert.ok(Array.isArray(historyList) && historyList.length >= 2, `Expected at least 2 history records, found ${historyList?.length}`);

  const initialAddRecord = historyList.find((h) => h.changeType === 'initial_addition' && h.projectPlanId === planA.id);
  assert.ok(initialAddRecord, 'Initial addition history record must exist for Plan A');
  assert.strictEqual(Number(initialAddRecord.newRate), 16500, 'Initial rate must be 16500');
  assert.strictEqual(Number(initialAddRecord.newQuantity), 10, 'Initial quantity must be 10');
  assert.strictEqual(initialAddRecord.newUnit, 'No.');

  const rateChangeRecord = historyList.find((h) => (h.changeType === 'rate_change' || h.changeType === 'rate_and_quantity_change') && h.projectPlanId === planA.id);
  assert.ok(rateChangeRecord, 'Rate change history record must exist for Plan A');
  assert.strictEqual(Number(rateChangeRecord.previousRate), 16500, 'Previous rate must be 16500');
  assert.strictEqual(Number(rateChangeRecord.newRate), 17000, 'New rate must be 17000');
  assert.strictEqual(rateChangeRecord.changeReason, 'Client negotiated finish specification upgrade and rate increase');
  console.log(`   ✓ History records verified in PostgreSQL: Initial Rate LKR ${initialAddRecord.newRate} -> Revised Rate LKR ${rateChangeRecord.newRate} (Prev: LKR ${rateChangeRecord.previousRate})`);

  // Assertion 4: "The project and plan relationships are correct."
  assert.strictEqual(rateChangeRecord.projectId, testProject.id, 'History record must link to project');
  assert.strictEqual(rateChangeRecord.projectPlanId, planA.id, 'History record must link to plan');
  assert.strictEqual(rateChangeRecord.planBoqItemId, boqItemA.id, 'History record must link to BOQ item');
  assert.strictEqual(rateChangeRecord.revenueItemId, doorProduct.id, 'History record must link to Revenue Catalogue item');
  console.log(`   ✓ Foreign key linkages verified: Project [${rateChangeRecord.projectId}] • Plan [${rateChangeRecord.projectPlanId}] • BOQ Item [${rateChangeRecord.planBoqItemId}]`);

  // Assertion 5: "Another plan using the same catalogue item is not changed."
  console.log(' - Checking Plan B Commercial Terms Independence...');
  const planBBoqItemsRes = await req(`/api/project-plans/${planB.id}/boq-items`);
  assert.ok(planBBoqItemsRes.ok, 'Failed to fetch Plan B BOQ items');
  const itemsInB = planBBoqItemsRes.body;
  const itemInB = itemsInB.find((i) => i.id === boqItemB.id);
  assert.ok(itemInB, 'BOQ Item B not found in Plan B');
  assert.strictEqual(Number(itemInB.rate ?? itemInB.sellingRate), 18000, 'Plan B rate must remain 18000');
  assert.strictEqual(Number(itemInB.quantity), 5, 'Plan B quantity must remain 5');
  assert.strictEqual(Number(itemInB.totalRevenue), 90000, 'Plan B total revenue must remain 90000');
  console.log(`   ✓ Plan B is completely isolated: ${itemInB.quantity} ${itemInB.unit} @ LKR ${itemInB.rate} = LKR ${itemInB.totalRevenue}`);

  // Assertion 6: Project-Level Commercial History
  console.log(' - Checking Project-Level Commercial History API...');
  const projHistoryRes = await req(`/api/projects/${testProject.id}/commercial-history`);
  assert.ok(projHistoryRes.ok, 'Failed to fetch project commercial history');
  const projHistoryList = projHistoryRes.body.data || projHistoryRes.body;
  assert.ok(projHistoryList.length >= 2, 'Project commercial history must contain all BOQ rate changes for this project');
  console.log(`   ✓ Project commercial history retrieved ${projHistoryList.length} revision records across plans`);

  // Assertion 7: Pagination and Filtering
  console.log(' - Checking Pagination and Server-side Filtering...');
  const paginatedRes = await req('/api/revenue-items?limit=1&page=1');
  assert.ok(paginatedRes.ok, 'Failed to fetch paginated revenue items');
  assert.strictEqual(paginatedRes.body.data.length, 1, 'Limit=1 should return 1 item');
  assert.ok(paginatedRes.body.total >= 1, 'Total count should be at least 1');
  console.log(`   ✓ Pagination verified (Limit: 1, Total: ${paginatedRes.body.total})`);

  console.log('\n🎉 ALL ACCEPTANCE TEST CRITERIA COMPLETED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
