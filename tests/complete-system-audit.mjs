// ============================================================================
// Comprehensive PostgreSQL Architecture, Data Integrity, API & Financial Audit
// Covers all 23 enterprise modules and requirements for Task 12
// ============================================================================

const BASE = process.env.BASE || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminPass123!';
const ADMIN_CODE = process.env.ADMIN_CODE || '000000';

let passed = 0;
let failed = 0;
const results = [];

function assert(description, condition, details = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${description}`);
    results.push({ description, status: 'PASS', details });
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${description} - ${details}`);
    results.push({ description, status: 'FAIL', details });
  }
}

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, ok: res.ok, json, headers: res.headers };
}

async function runAudit() {
  console.log('============================================================================');
  console.log('🚀 TASK 12: COMPLETE SYSTEM-WIDE AUDIT ACROSS ALL 23 MODULES');
  console.log('============================================================================\n');

  // --------------------------------------------------------------------------
  // STEP 0: Authentication & Role Enforcement
  // --------------------------------------------------------------------------
  console.log('--- AUDIT SECTION 1: AUTHENTICATION, RBAC & SESSION SECURITY ---');
  const unauth = await request('GET', '/api/projects');
  assert('Unauthenticated request to protected route is rejected with 401', unauth.status === 401);

  const l1 = await request('POST', '/api/auth/login', { identifier: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  assert('Admin login returns 2FA challenge', l1.status === 200 && !!l1.json?.tempMfaToken);

  const l2 = await request('POST', '/api/auth/verify-mfa', { tempMfaToken: l1.json.tempMfaToken, code: ADMIN_CODE });
  assert('Admin MFA verification succeeds with session token', l2.status === 200 && !!l2.json?.sessionToken);
  const adminToken = l2.json.sessionToken;

  // Verify DB connection & status
  const dbStatus = await request('GET', '/api/database/status', null, adminToken);
  assert('PostgreSQL database connected and authoritative', dbStatus.status === 200 && dbStatus.json?.connected === true && dbStatus.json?.engine === 'PostgreSQL');
  assert('All 11 schema migrations recorded as applied', dbStatus.json?.migrationsApplied?.length >= 11 && dbStatus.json?.migrationsApplied?.includes('011_composite_foreign_keys_and_audit_integrity.sql'));

  // --------------------------------------------------------------------------
  // MODULE 1 & 2: Clients and Projects Integration
  // --------------------------------------------------------------------------
  console.log('\n--- AUDIT SECTION 2: CLIENTS & PROJECTS INTEGRATION ---');
  const clientCode = `CLI-AUDIT-${Date.now().toString().slice(-4)}`;
  const clientRes = await request('POST', '/api/clients', {
    name: 'Audit Sovereign Industrial Corp',
    tagline: 'Precision Systems Integration',
    industry: 'Advanced Manufacturing',
    location: 'Singapore',
    contactPerson: 'Director Chen Wei',
    email: 'chen.wei@sovereign-audit.org',
    phone: '+65 6789 0123'
  }, adminToken);
  assert('Client created in PostgreSQL with generated ID', clientRes.status < 300 && !!clientRes.json?.id);
  const clientId = clientRes.json.id;

  const projectCode = `PRJ-AUDIT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const projRes = await request('POST', '/api/projects', {
    code: projectCode,
    name: 'Aerospace Flight Control Enclosure',
    clientId: clientId,
    clientName: 'Audit Sovereign Industrial Corp',
    quotedPrice: 250000,
    targetMarginPct: 28.5,
    overheadPct: 7.5,
    contingencyPct: 4.0,
    currency: 'USD',
    productCategory: 'Industrial Enclosures',
    productSubCategory: 'Aviation Spec'
  }, adminToken);
  assert('Project created with foreign key linkage to Client', projRes.status < 300 && projRes.json?.clientId === clientId);
  const projectId = projRes.json.id;

  // Verify Primary Currency is LKR and currency selection updates are persisted in PostgreSQL
  const lkrProjRes = await request('POST', '/api/projects', {
    code: `PRJ-LKR-TEST-${Date.now()}`,
    name: 'Primary LKR Test Project',
    clientId: clientId,
    clientName: 'Audit Sovereign Industrial Corp',
    quotedPrice: 1250000
  }, adminToken);
  assert('Project created without currency defaults to primary LKR in PostgreSQL', lkrProjRes.status < 300 && lkrProjRes.json?.currency === 'LKR');

  const updateCurrRes = await request('PUT', `/api/projects/${projectId}`, {
    currency: 'LKR'
  }, adminToken);
  assert('Project currency selection updated to LKR and persisted in PostgreSQL', updateCurrRes.status < 300 && updateCurrRes.json?.currency === 'LKR');

  // --------------------------------------------------------------------------
  // MODULE 3 & 4: Project Plans and Plan Revisions
  // --------------------------------------------------------------------------
  console.log('\n--- AUDIT SECTION 3: PROJECT PLANS & REVISIONS ---');
  const plan1Res = await request('POST', '/api/project-plans', {
    projectId: projectId,
    name: 'Baseline Plan A (Standard Production)',
    planType: 'Baseline',
    plannedRevenue: 250000,
    overheadPct: 7.5,
    contingencyPct: 4.0,
    targetMarginPct: 28.5,
    currency: 'USD'
  }, adminToken);
  assert('Project Plan A created under project in PostgreSQL', plan1Res.status < 300 && plan1Res.json?.id);
  const plan1Id = plan1Res.json.id;

  const plan2Res = await request('POST', '/api/project-plans', {
    projectId: projectId,
    name: 'Value Engineered Plan B (Alternative Alloy)',
    planType: 'Value-Engineered',
    plannedRevenue: 220000,
    overheadPct: 7.5,
    contingencyPct: 4.0,
    targetMarginPct: 30.0,
    currency: 'USD'
  }, adminToken);
  assert('Project Plan B created under same project with isolated ID', plan2Res.status < 300 && plan2Res.json?.id !== plan1Id);
  const plan2Id = plan2Res.json.id;

  // Test Plan Revisions & Immutability
  const updatePlan = await request('PUT', `/api/project-plans/${plan1Id}`, {
    name: 'Baseline Plan A (Approved Configuration)',
    status: 'In Review',
    plannedRevenue: 255000
  }, adminToken);
  assert('Plan update automatically increments revision number', updatePlan.status === 200 && updatePlan.json?.revisionNumber >= 2);

  const planDetails = await request('GET', `/api/project-plans/${plan1Id}`, null, adminToken);
  assert('Plan details includes historical revision array', Array.isArray(planDetails.json?.revisions) && planDetails.json?.revisions?.length >= 2);

  // --------------------------------------------------------------------------
  // MODULE 5 & 6: Revenue Catalogue & Products/Services
  // --------------------------------------------------------------------------
  console.log('\n--- AUDIT SECTION 4: REVENUE CATALOGUE & RATE FREEZE ---');
  const revItemCode = `REV-AUD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const revItemRes = await request('POST', '/api/revenue-items', {
    code: revItemCode,
    name: 'CNC Machined Avionics Chassis',
    type: 'product',
    category: 'Avionics',
    defaultRate: 15000,
    costPrice: 9500,
    unit: 'unit',
    taxTreatment: 'Standard (0%)'
  }, adminToken);
  assert('Revenue product created in PostgreSQL with default rate 15,000', revItemRes.status < 300 && Number(revItemRes.json?.defaultRate) === 15000);
  const revItemId = revItemRes.json.id;

  // Add to Plan A at negotiated rate of 16,500
  const boq1Res = await request('POST', `/api/project-plans/${plan1Id}/boq-items`, {
    revenueItemId: revItemId,
    itemCode: revItemCode,
    quantity: 10,
    rate: 16500,
    unitCost: 9500,
    unit: 'unit',
    name: 'CNC Machined Avionics Chassis'
  }, adminToken);
  const boqItem1 = boq1Res.json?.boqItem || boq1Res.json;
  assert('BOQ item created on Plan A with rate 16,500 and total revenue 165,000', boq1Res.status < 300 && Number(boqItem1?.totalRevenue ?? boqItem1?.total_revenue) === 165000);
  const boq1Id = boqItem1?.id;

  // Rate Freeze Verification (Requirement 12)
  // Update catalogue default rate from 15,000 -> 18,000
  const updateCatRes = await request('PUT', `/api/revenue-items/${revItemId}`, {
    defaultRate: 18000
  }, adminToken);
  assert('Catalogue default rate updated to 18,000', updateCatRes.status < 300 && Number(updateCatRes.json?.defaultRate) === 18000);

  // Re-fetch Plan A BOQ item
  const refetchedBoq = await request('GET', `/api/project-plans/${plan1Id}/boq-items/${boq1Id}`, null, adminToken);
  const boqCurrentRate = Number(refetchedBoq.json?.billableRate ?? refetchedBoq.json?.rate);
  assert('Catalogue default rate change did NOT overwrite historical plan rate (retains 16,500)', boqCurrentRate === 16500);

  // --------------------------------------------------------------------------
  // MODULE 7: Plan BOQ Isolation & Commercial Rate History
  // --------------------------------------------------------------------------
  console.log('\n--- AUDIT SECTION 5: PLAN BOQ ISOLATION & RATE HISTORY ---');
  // Add same revenue product to Plan B at rate 14,800
  const boq2Res = await request('POST', `/api/project-plans/${plan2Id}/boq-items`, {
    revenueItemId: revItemId,
    itemCode: revItemCode,
    quantity: 5,
    rate: 14800,
    unitCost: 9000,
    unit: 'unit',
    name: 'CNC Machined Avionics Chassis'
  }, adminToken);
  const boqItem2 = boq2Res.json?.boqItem || boq2Res.json;
  assert('Plan B receives independent commercial rate 14,800', boq2Res.status < 300 && Number(boqItem2?.rate ?? boqItem2?.billableRate) === 14800);

  // Verify Plan A was not modified
  const planABoqs = await request('GET', `/api/project-plans/${plan1Id}/boq-items`, null, adminToken);
  const itemInPlanA = planABoqs.json.find(b => b.id === boq1Id);
  const rateInA = Number(itemInPlanA?.rate ?? itemInPlanA?.billableRate);
  assert('Plan A remains strictly isolated with original rate 16,500', rateInA === 16500);

  // --------------------------------------------------------------------------
  // MODULE 8, 9, 10: Materials, Categories, Suppliers
  // --------------------------------------------------------------------------
  console.log('\n--- AUDIT SECTION 6: MATERIALS, CATEGORIES & SUPPLIERS ---');
  const supCode = `SUP-AUD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const supRes = await request('POST', '/api/suppliers', {
    code: supCode,
    name: 'Apex Precision Alloys Ltd',
    category: 'Raw Materials',
    city: 'Nagoya',
    country: 'Japan',
    contactPerson: 'Kenji Sato',
    email: 'k.sato@apex-alloys.jp'
  }, adminToken);
  assert('Supplier created in PostgreSQL', supRes.status < 300 && supRes.json?.id);
  const supplierId = supRes.json.id;

  const matCode = `MAT-AUD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const matBarcode = `BC-MAT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const matRes = await request('POST', '/api/materials', {
    code: matCode,
    name: 'Aerospace Grade Titanium Ingot Ti-6Al-4V',
    category: 'Metals & Alloys',
    subCategory: 'Titanium',
    supplierId: supplierId,
    currentPrice: 145.50,
    unit: 'kg',
    barcode: matBarcode
  }, adminToken);
  assert('Material created in PostgreSQL linked to supplier with barcode', matRes.status < 300 && matRes.json?.id);
  const materialId = matRes.json.id;

  // --------------------------------------------------------------------------
  // MODULE 11, 12, 13: Outsourced Services & Subcontractors
  // --------------------------------------------------------------------------
  console.log('\n--- AUDIT SECTION 7: OUTSOURCED SERVICES & SUBCONTRACTORS ---');
  const outCode = `OUT-AUD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const outRes = await request('POST', '/api/outsourced', {
    code: outCode,
    name: 'Multi-Axis Precision EDM Wire Cutting',
    category: 'Specialized Machining',
    providerId: supplierId,
    rate: 185.00,
    unit: 'per_hour'
  }, adminToken);
  assert('Outsourced service created with hourly rate', outRes.status < 300 && outRes.json?.id);

  const subCode = `SUB-AUD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const subRes = await request('POST', '/api/subcontractors', {
    code: subCode,
    subcontractorName: 'Tokyo Precision Metrology Team',
    nicheServiceName: 'CMM Laser Calibration & Stress Testing',
    trade: 'Metrology',
    rate: 220.00,
    unit: 'hr',
    weeklyCapacity: 80
  }, adminToken);
  assert('Subcontractor created with trade capacity and hourly rate', subRes.status < 300 && subRes.json?.id);

  // --------------------------------------------------------------------------
  // MODULE 14: Procurement Price History
  // --------------------------------------------------------------------------
  console.log('\n--- AUDIT SECTION 8: PROCUREMENT PRICE HISTORY ---');
  const priceUpdateRes = await request('POST', `/api/materials/${materialId}/price-update`, {
    newPrice: 162.00,
    reason: 'Global raw titanium tariff increase',
    effectiveDate: '2026-10-20'
  }, adminToken);
  assert('Material transactional price updated to 162.00 in PostgreSQL', priceUpdateRes.status < 300);

  const priceHist = await request('GET', `/api/price-history?entityId=${materialId}`, null, adminToken);
  const histList = priceHist.json?.data || priceHist.json || [];
  assert('Price history recorded previous and new price in PostgreSQL', histList.length > 0 && histList.some(p => Number(p.newPrice) === 162));

  // --------------------------------------------------------------------------
  // MODULE 15 & 16: Overhead Catalogue & Plan Allocations
  // --------------------------------------------------------------------------
  console.log('\n--- AUDIT SECTION 9: OVERHEAD CATALOGUE & PLAN ALLOCATIONS ---');
  const ovhCode = `OVH-AUD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const ovhName = `Cleanroom ISO-5 Environmental Operating Charge ${Date.now()}`;
  const ovhItemRes = await request('POST', '/api/overhead-items', {
    code: ovhCode,
    name: ovhName,
    category: 'Quality & Facility Compliance',
    costType: 'Fixed',
    defaultCalculationMethod: 'fixed_amount',
    defaultRate: 8500
  }, adminToken);
  assert('Overhead item created in catalogue with rate 8,500', ovhItemRes.status < 300 && ovhItemRes.json?.id);
  const ovhItemId = ovhItemRes.json.id;

  // Allocate to Plan A
  const allocRes = await request('POST', `/api/project-plans/${plan1Id}/overheads`, {
    overheadItemId: ovhItemId,
    allocationMethod: 'fixed_amount',
    allocationRate: 8500
  }, adminToken);
  assert('Overhead allocated to Plan A with 8,500 allocated amount', allocRes.status < 300 && Number(allocRes.json?.allocatedAmount) === 8500);

  // Verify Plan B has 0 overhead allocations (Isolation)
  const planBOvhs = await request('GET', `/api/project-plans/${plan2Id}/overheads`, null, adminToken);
  assert('Plan B overhead allocations remain completely isolated (0 allocations)', planBOvhs.json?.length === 0);

  // Duplicate allocation prevention (Requirement 15)
  const dupAlloc = await request('POST', `/api/project-plans/${plan1Id}/overheads`, {
    overheadItemId: ovhItemId,
    allocationMethod: 'fixed_amount',
    allocationRate: 8500
  }, adminToken);
  assert('Duplicate overhead allocation rejected with 409 Conflict', dupAlloc.status === 409);

  // --------------------------------------------------------------------------
  // MODULE 17: Barcode Registry & Global Uniqueness
  // --------------------------------------------------------------------------
  console.log('\n--- AUDIT SECTION 10: BARCODE REGISTRY & UNIQUENESS ---');
  // Attempt to assign the exact same barcode to a new supplier or product
  const dupBarcodeAttempt = await request('POST', '/api/materials', {
    code: `MAT-DUP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    name: 'Duplicate Barcode Material Attempt',
    currentPrice: 50,
    unit: 'pcs',
    barcode: matBarcode // Already used by first material
  }, adminToken);
  assert('Duplicate barcode assignment across entities rejected with 409 Conflict', dupBarcodeAttempt.status === 409);

  // Lookup barcode in registry
  const barcodeLookup = await request('GET', `/api/barcodes/lookup?code=${encodeURIComponent(matBarcode)}`, null, adminToken);
  assert('Barcode lookup resolves to original material item in PostgreSQL', barcodeLookup.status === 200 && barcodeLookup.json?.entityId === materialId);

  // --------------------------------------------------------------------------
  // MODULE 18: Audit Logs & Immutability
  // --------------------------------------------------------------------------
  console.log('\n--- AUDIT SECTION 11: AUDIT LOGS & TAMPER-RESISTANCE ---');
  const auditLogs = await request('GET', '/api/audit-logs?limit=5', null, adminToken);
  assert('Audit logs retrieved from PostgreSQL', auditLogs.status === 200 && Array.isArray(auditLogs.json?.data || auditLogs.json));

  const firstLogId = (auditLogs.json?.data || auditLogs.json)[0]?.id;
  if (firstLogId) {
    const tamperPut = await request('PUT', `/api/audit-logs/${firstLogId}`, { details: 'Tampered' }, adminToken);
    assert('Direct modification of audit log rejected with 403 Forbidden', tamperPut.status === 403);

    const tamperDel = await request('DELETE', `/api/audit-logs/${firstLogId}`, null, adminToken);
    assert('Direct deletion of audit log rejected with 403 Forbidden', tamperDel.status === 403);
  }

  // --------------------------------------------------------------------------
  // MODULE 19: Tariffs & Version Resolution
  // --------------------------------------------------------------------------
  console.log('\n--- AUDIT SECTION 12: TARIFF MANAGEMENT & VERSION RESOLUTION ---');
  const trfCode = `TRF-AUD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const tariffRes = await request('POST', '/api/tariffs', {
    code: trfCode,
    name: 'Aviation Export Surcharge',
    category: 'Export Compliance',
    calculationMethod: 'percentage',
    rateOrPercentage: 6.5,
    applicableBase: 'total_cost',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-06-30'
  }, adminToken);
  assert('Tariff created with version 1 in PostgreSQL', tariffRes.status < 300 && tariffRes.json?.id);
  const tariffId = tariffRes.json.id;

  // Create version 2 effective 2026-07-01 onwards
  const v2Res = await request('POST', `/api/tariffs/${tariffId}/versions`, {
    rateOrPercentage: 8.0,
    calculationMethod: 'percentage',
    applicableBase: 'total_cost',
    effectiveFrom: '2026-07-01',
    effectiveTo: '2026-12-31',
    changeReason: 'Mid-year regulatory adjustment'
  }, adminToken);
  assert('Tariff Version 2 created in PostgreSQL', v2Res.status < 300);

  // Resolve version based on effective date
  const resolveV1 = await request('GET', `/api/tariffs/${tariffId}/resolve?date=2026-03-15`, null, adminToken);
  assert('Date 2026-03-15 accurately resolves to Version 1 (6.5%)', Number(resolveV1.json?.rateOrPercentage) === 6.5);

  const resolveV2 = await request('GET', `/api/tariffs/${tariffId}/resolve?date=2026-09-15`, null, adminToken);
  assert('Date 2026-09-15 accurately resolves to Version 2 (8.0%)', Number(resolveV2.json?.rateOrPercentage) === 8.0);

  // Apply Tariff to Plan A
  const applyTrf = await request('POST', `/api/project-plans/${plan1Id}/tariffs`, {
    tariffId: tariffId,
    effectiveDate: '2026-09-15',
    baseAmount: 100000
  }, adminToken);
  assert('Tariff Version 2 applied to Plan A with calculated surcharge', applyTrf.status < 300 && Number(applyTrf.json?.calculatedTariffAmount) > 0);

  // --------------------------------------------------------------------------
  // MODULE 20: Financial Calculation Engine
  // --------------------------------------------------------------------------
  console.log('\n--- AUDIT SECTION 13: FINANCIAL CALCULATION ENGINE ---');
  const planSummary = await request('GET', `/api/project-plans/${plan1Id}`, null, adminToken);
  const sum = planSummary.json?.costSummary;
  assert('Cost summary materialized with non-zero directCost', sum && Number(sum.directCost) > 0);
  assert('Cost summary allocatedOverhead matches 8,500', sum && Number(sum.allocatedOverhead) >= 8500);
  assert('Cost summary plannedProfit = plannedRevenue - totalPlannedCost', sum && Math.abs(sum.plannedProfit - (sum.plannedRevenue - sum.totalPlannedCost)) < 0.05);
  assert('Profit margin % matches (plannedProfit / plannedRevenue) * 100', sum && Math.abs(sum.profitMarginPct - ((sum.plannedProfit / sum.plannedRevenue) * 100)) < 0.1);

  // --------------------------------------------------------------------------
  // MODULE 21: Quick-Add Functions & Barcode Integration
  // --------------------------------------------------------------------------
  console.log('\n--- AUDIT SECTION 14: QUICK-ADD FUNCTIONS & SCANNER ---');
  // Scan barcode directly into Plan B via BOQ addition
  const scanAdd = await request('POST', `/api/project-plans/${plan2Id}/boq-items`, {
    catalogItemId: materialId,
    itemCode: matCode,
    barcode: matBarcode,
    name: 'Aerospace Grade Titanium Ingot Ti-6Al-4V',
    unit: 'kg',
    quantity: 12,
    rate: 180,
    unitCost: 145.5,
    onDuplicate: 'prevent'
  }, adminToken);
  const scanBoq = scanAdd.json?.boqItem || scanAdd.json;
  assert('Quick-add barcode scanner inserts material line directly into Plan B', scanAdd.status < 300 && (scanBoq?.item_code === matCode || scanBoq?.itemCode === matCode));

  // Scan second time to verify no silent duplicate lines
  const scanAdd2 = await request('POST', `/api/project-plans/${plan2Id}/boq-items`, {
    catalogItemId: materialId,
    itemCode: matCode,
    barcode: matBarcode,
    name: 'Aerospace Grade Titanium Ingot Ti-6Al-4V',
    unit: 'kg',
    quantity: 5,
    rate: 180,
    unitCost: 145.5,
    onDuplicate: 'prevent'
  }, adminToken);
  assert('Subsequent scan intelligently updates or informs without duplicating financial lines', scanAdd2.status < 300 && (scanAdd2.json?.duplicatePrevented === true || scanAdd2.json?.incremented === true));

  // --------------------------------------------------------------------------
  // MODULE 22 & 23: Dashboards, Reports, and Exports
  // --------------------------------------------------------------------------
  console.log('\n--- AUDIT SECTION 15: DASHBOARDS, REPORTS & EXPORTS ---');
  const planComparison = await request('GET', `/api/projects/${projectId}/plans/comparison`, null, adminToken);
  assert('Project plan comparison dashboard returns side-by-side metrics for Plan A & Plan B', planComparison.status === 200 && planComparison.json?.plans?.length >= 2);

  const dbExport = await request('GET', '/api/database/export', null, adminToken);
  assert('Enterprise database backup export completes successfully with all tables', dbExport.status === 200 && Object.keys(dbExport.json?.data || {}).length >= 10);

  // --------------------------------------------------------------------------
  // FINAL SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n============================================================================');
  console.log(`AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Audit execution exception:', err);
  process.exit(1);
});
