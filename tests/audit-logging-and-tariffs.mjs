import { strict as assert } from 'assert';

const BASE = process.env.BASE || 'http://localhost:3000';
let adminSession = '';

async function req(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(adminSession ? { Authorization: `Bearer ${adminSession}` } : {}),
    ...(options.headers || {})
  };
  const res = await fetch(`${BASE}${path}`, {
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
    adminSession = loginRes.body.sessionToken;
  } else if (loginRes.body?.tempMfaToken) {
    const mfaRes = await req('/api/auth/verify-mfa', {
      method: 'POST',
      body: JSON.stringify({ tempMfaToken: loginRes.body.tempMfaToken, code: '000000' })
    });
    adminSession = mfaRes.body?.sessionToken || '';
  }
  assert.ok(adminSession, 'Failed to authenticate admin session');
  console.log('✓ Step 0: Authenticated as Administrator.');
}

async function runAcceptanceTest() {
  console.log('========================================================================');
  console.log('🚀 TASK 9 ACCEPTANCE TEST: AUDIT LOGGING & TARIFF MANAGEMENT IN POSTGRES');
  console.log('========================================================================\n');

  await loginAdmin();

  // --------------------------------------------------------------------------
  // PART 1: IMMUTABILITY & TAMPER RESISTANCE (Requirements 6, 7, 8)
  // --------------------------------------------------------------------------
  console.log('\n--- Part 1: Immutability and Security Protections ---');

  // Attempt PUT on audit logs (should return 403 Forbidden)
  const putRes = await req('/api/audit-logs/aud-test-attempt', {
    method: 'PUT',
    body: JSON.stringify({ changeReason: 'tampered reason' })
  });
  assert.equal(putRes.status, 403, 'PUT /api/audit-logs must be rejected with 403 Forbidden');
  console.log('✓ Verified: Direct modification of audit logs rejected with 403 Forbidden.');

  // Attempt DELETE on audit logs (should return 403 Forbidden)
  const delRes = await req('/api/audit-logs/aud-test-attempt', {
    method: 'DELETE'
  });
  assert.equal(delRes.status, 403, 'DELETE /api/audit-logs must be rejected with 403 Forbidden');
  console.log('✓ Verified: Deletion of audit logs rejected with 403 Forbidden.');

  // Attempt actor spoofing
  const spoofRes = await req('/api/audit-logs', {
    method: 'POST',
    body: JSON.stringify({
      actorId: 'usr-spoofed-attacker-999',
      actorName: 'Fake Superuser',
      action: 'SUSPICIOUS_MUTATION',
      module: 'Security'
    })
  });
  assert.equal(spoofRes.status, 201);
  assert.notEqual(spoofRes.body?.actorId, 'usr-spoofed-attacker-999', 'Actor ID must not be spoofed from client payload');
  console.log('✓ Verified: Client-supplied actor spoofing blocked; session identity enforced.');

  // --------------------------------------------------------------------------
  // PART 2: CHANGE PLAN SELLING RATE & VERIFY AUDIT TRAIL
  // (Acceptance Test Criteria 1)
  // --------------------------------------------------------------------------
  console.log('\n--- Part 2: Plan Selling Rate Change & Structured Audit Record ---');

  // Create Project
  const projRes = await req('/api/projects', {
    method: 'POST',
    body: JSON.stringify({
      code: `PRJ-AUDIT-${Date.now().toString().slice(-4)}`,
      name: 'Audit Acceptance Commercial Tower',
      client: 'Acme Developments',
      status: 'Active',
      budget: 1500000,
      currency: 'USD'
    })
  });
  const project = projRes.body;
  assert.ok(project?.id, 'Failed to create test project');
  console.log(`✓ Created test project [${project.id}] ${project.name}`);

  // Create Plan
  const planRes = await req(`/api/projects/${project.id}/plans`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Plan 1: Commercial Glazing Baseline',
      planType: 'Baseline',
      targetMarginPct: 28
    })
  });
  const plan = planRes.body;
  assert.ok(plan?.id, 'Failed to create test plan');
  console.log(`✓ Created test plan [${plan.id}] ${plan.planNumber}`);

  // Create Revenue Item
  const revItemRes = await req('/api/revenue-items', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Structural Curtain Wall System',
      code: `REV-WALL-${Date.now().toString().slice(-4)}`,
      type: 'product',
      category: 'Glazing & Facades',
      unit: 'm2',
      defaultRate: 25000,
      currency: 'USD',
      status: 'Active'
    })
  });
  assert.ok(revItemRes.ok, `Failed to create revenue item: ${JSON.stringify(revItemRes.body)}`);
  const revItem = revItemRes.body;
  console.log(`✓ Created Revenue Product: [${revItem.id}] ${revItem.name} with Default Rate: USD ${revItem.defaultRate}`);

  // Add BOQ item to plan with initial selling rate 25,000
  const boqRes = await req(`/api/project-plans/${plan.id}/boq-items`, {
    method: 'POST',
    body: JSON.stringify({
      revenueItemId: revItem.id,
      itemCode: revItem.code,
      name: revItem.name,
      category: revItem.category,
      unit: 'm2',
      quantity: 10,
      rate: 25000,
      discountPct: 0,
      changeReason: 'Initial baseline BOQ specification'
    })
  });
  assert.ok(boqRes.ok, `Failed to add BOQ item: ${JSON.stringify(boqRes.body)}`);
  const boqItem = boqRes.body.boqItem || boqRes.body;
  assert.ok(boqItem?.id, 'Failed to get created BOQ item ID');
  console.log(`✓ Added BOQ item [${boqItem.id}] initial rate: USD 25,000`);

  // CHANGE PLAN SELLING RATE from 25,000 to 29,500
  const updateRes = await req(`/api/project-plans/${plan.id}/boq-items/${boqItem.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      rate: 29500,
      sellingRate: 29500,
      quantity: 10,
      unit: 'm2',
      changeReason: 'Client requested upgraded thermal break spec'
    })
  });
  assert.ok(updateRes.ok, `Failed to update BOQ selling rate: ${JSON.stringify(updateRes.body)}`);
  console.log(`✓ Updated BOQ Item selling rate from USD 25,000 to USD 29,500.`);

  // QUERY AUDIT LOGS FOR THIS CHANGE
  const auditLogsRes = await req(`/api/audit-logs?entityId=${boqItem.id}&limit=10`);
  assert.ok(auditLogsRes.ok, 'Failed to query audit logs from PostgreSQL');
  const auditLogs = Array.isArray(auditLogsRes.body) ? auditLogsRes.body : auditLogsRes.body?.items || [];
  assert.ok(auditLogs.length > 0, 'No audit logs found for BOQ item modification');

  const rateChangeLog = auditLogs.find(l =>
    (l.actionType === 'UPDATE_PLAN_SELLING_RATE' || l.actionType === 'UPDATE_PLAN_BOQ_ITEM' || l.action === 'UPDATE_PLAN_SELLING_RATE' || l.action === 'UPDATE_PLAN_BOQ_ITEM')
  );
  assert.ok(rateChangeLog, 'Did not find UPDATE_PLAN_SELLING_RATE or UPDATE_PLAN_BOQ_ITEM audit log');

  console.log('\n--- Verifying Audit Log Acceptance Criteria ---');
  // 1. Correct user and timestamp
  assert.ok(rateChangeLog.actorId, 'Audit log must record actor user ID');
  assert.ok(rateChangeLog.actorName, 'Audit log must record actor user name');
  assert.ok(rateChangeLog.timestamp, 'Audit log must record event timestamp');
  console.log(`✓ Recorded by authenticated user: ${rateChangeLog.actorName} (${rateChangeLog.actorId}) at ${rateChangeLog.timestamp}`);

  // 2. Affected project and plan identified
  assert.equal(rateChangeLog.projectId, project.id, 'Audit log must identify affected project ID');
  assert.equal(rateChangeLog.planId, plan.id, 'Audit log must identify affected plan ID');
  console.log(`✓ Affected Project [${rateChangeLog.projectId}] and Plan [${rateChangeLog.planId}] verified.`);

  // 3. Before and after values available
  assert.ok(rateChangeLog.beforeState, 'Audit log must contain structured beforeState');
  assert.ok(rateChangeLog.afterState, 'Audit log must contain structured afterState');

  const beforeRate = Number(rateChangeLog.beforeState.sellingRate || rateChangeLog.beforeState.rate);
  const afterRate = Number(rateChangeLog.afterState.sellingRate || rateChangeLog.afterState.rate);
  assert.equal(beforeRate, 25000, `Expected beforeRate 25000, got ${beforeRate}`);
  assert.equal(afterRate, 29500, `Expected afterRate 29500, got ${afterRate}`);
  console.log(`✓ Before & after structured values verified: USD ${beforeRate} -> USD ${afterRate}`);

  if (rateChangeLog.diff) {
    console.log(`✓ Structured diff verified: rateChange = +${rateChangeLog.diff.rateChange}`);
  }

  // --------------------------------------------------------------------------
  // PART 3: TARIFF MANAGEMENT WITH MULTIPLE EFFECTIVE DATES
  // (Acceptance Test Criteria 2)
  // --------------------------------------------------------------------------
  console.log('\n--- Part 3: Tariff Management & Historical Version Resolution ---');

  // Create initial tariff schedule (Version 1: H1 2026, 5% ad valorem)
  const tariffCode = `TRF-PORT-${Date.now().toString().slice(-4)}`;
  const tariffRes = await req('/api/tariffs', {
    method: 'POST',
    body: JSON.stringify({
      code: tariffCode,
      name: 'Port Demurrage and Customs Clearance Tariff',
      category: 'Customs & Port Handling',
      calculationMethod: 'percentage',
      applicableBase: 'material_cost',
      rateOrPercentage: 5.0,
      fixedCharge: 250,
      unit: '% of CIF',
      currency: 'USD',
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-06-30',
      sourceReference: 'Sri Lanka Ports Authority Notice 2026/01',
      changeReason: 'Initial statutory tariff schedule for H1 2026'
    })
  });
  const tariff = tariffRes.body;
  assert.ok(tariff?.id, `Failed to create tariff schedule: status ${tariffRes.status}, body ${JSON.stringify(tariffRes.body)}`);
  console.log(`✓ Created Tariff [${tariff.id}] Code: ${tariff.code} - Version 1 (5% + USD 250) Effective 2026-01-01 -> 2026-06-30`);

  // Create second tariff version with different effective date (Version 2: H2 2026, 8.5% ad valorem)
  const v2Res = await req(`/api/tariffs/${tariff.id}/versions`, {
    method: 'POST',
    body: JSON.stringify({
      rateOrPercentage: 8.5,
      fixedCharge: 350,
      calculationMethod: 'percentage',
      applicableBase: 'material_cost',
      unit: '% of CIF',
      currency: 'USD',
      effectiveFrom: '2026-07-01',
      effectiveTo: '2026-12-31',
      sourceReference: 'Gazette Extraordinary No. 2400/18 Revised Port Duties',
      changeReason: 'Statutory fiscal revision for H2 2026'
    })
  });
  const version2 = v2Res.body;
  assert.ok(version2?.id, 'Failed to create tariff version 2');
  console.log(`✓ Created Tariff Version 2 [${version2.id}] (8.5% + USD 350) Effective 2026-07-01 -> 2026-12-31`);

  // Verify system retains BOTH versions
  const fullTariffRes = await req(`/api/tariffs/${tariff.id}`);
  assert.ok(fullTariffRes.ok);
  const fullTariff = fullTariffRes.body;
  const versions = fullTariff.versions || [];
  assert.equal(versions.length, 2, `System must retain both versions, found ${versions.length}`);
  console.log(`✓ Verified: System retains both tariff versions without overwriting historical rates.`);

  // Test resolution for H1 date: 2026-03-15
  const resH1 = await req(`/api/tariffs/${tariff.id}/resolve?date=2026-03-15`);
  assert.ok(resH1.ok);
  assert.equal(Number(resH1.body.rateOrPercentage), 5.0, 'Expected H1 rate 5.0% for date 2026-03-15');
  console.log(`✓ Date 2026-03-15 correctly resolved to Version 1 (Rate: ${resH1.body.rateOrPercentage}%, Fixed: USD ${resH1.body.fixedCharge})`);

  // Test resolution for H2 date: 2026-09-15
  const resH2 = await req(`/api/tariffs/${tariff.id}/resolve?date=2026-09-15`);
  assert.ok(resH2.ok);
  assert.equal(Number(resH2.body.rateOrPercentage), 8.5, 'Expected H2 rate 8.5% for date 2026-09-15');
  console.log(`✓ Date 2026-09-15 correctly resolved to Version 2 (Rate: ${resH2.body.rateOrPercentage}%, Fixed: USD ${resH2.body.fixedCharge})`);

  // --------------------------------------------------------------------------
  // PART 4: APPLY TARIFF TO PLAN WITH CALCULATION & AUDIT LINKAGE
  // (Requirements 18, 19, 20)
  // --------------------------------------------------------------------------
  console.log('\n--- Part 4: Apply Tariff to Plan & Verify Isolation ---');

  // Apply Tariff to Plan 1 on date 2026-09-15 (Targeting Version 2)
  const applyRes = await req(`/api/plans/${plan.id}/tariffs`, {
    method: 'POST',
    body: JSON.stringify({
      tariffId: tariff.id,
      effectiveDate: '2026-09-15',
      baseAmount: 100000,
      notes: 'Applied for overseas imported curtain wall profiles'
    })
  });
  assert.ok(applyRes.ok, `Failed to apply tariff: ${JSON.stringify(applyRes.body)}`);
  const appliedTariff = applyRes.body;
  console.log(`✓ Applied tariff to Plan 1: Calculated Amount = USD ${appliedTariff.calculatedTariffAmount}`);
  // Formula for percentage + fixed: (100,000 * 8.5%) + 350 = 8,500 + 350 = 8,850
  assert.equal(Number(appliedTariff.calculatedTariffAmount), 8850, `Expected 8850, got ${appliedTariff.calculatedTariffAmount}`);
  assert.equal(appliedTariff.tariffVersionId, version2.id, 'Must link to resolved Version 2');
  console.log(`✓ Linkage to resolved Version 2 [${appliedTariff.tariffVersionId}] verified.`);

  // Create Plan 2 (Unrelated plan) to verify NO automatic application (Requirement 20)
  const plan2Res = await req(`/api/projects/${project.id}/plans`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Plan 2: Value Engineering Option (Local Sourcing)'
    })
  });
  const plan2 = plan2Res.body;
  const plan2TariffsRes = await req(`/api/plans/${plan2.id}/tariffs`);
  const plan2Tariffs = plan2TariffsRes.body || [];
  assert.equal(plan2Tariffs.length, 0, 'Tariff must NOT be applied to every plan automatically (Requirement 20)');
  console.log(`✓ Verified Isolation: Plan 2 has 0 tariffs applied automatically.`);

  // Verify audit log for tariff application
  const applyAuditLogsRes = await req(`/api/audit-logs?planId=${plan.id}&entityType=PlanTariff`);
  const applyAuditLogs = Array.isArray(applyAuditLogsRes.body) ? applyAuditLogsRes.body : applyAuditLogsRes.body?.items || [];
  assert.ok(applyAuditLogs.length > 0, 'Audit log for APPLY_TARIFF_TO_PLAN must exist');
  console.log(`✓ Audit log verified for tariff application: ${applyAuditLogs[0].action} on Plan ${plan.id}`);

  console.log('\n========================================================================');
  console.log('🎉 ALL TASK 9 ACCEPTANCE CRITERIA PASSED WITH ZERO ERRORS!');
  console.log('========================================================================\n');
}

runAcceptanceTest().catch((err) => {
  console.error('\n❌ ACCEPTANCE TEST FAILED:', err);
  process.exit(1);
});
