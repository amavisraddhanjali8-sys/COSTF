// Automated verification script for Product Competitor Comparison and Relational Project Deliverables
import assert from 'assert';

const BASE_URL = process.env.BASE || 'http://localhost:3000';
let TOKEN = '';

const req = async (method, path, body = null) => {
  const url = new URL(path, BASE_URL);
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  let data = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data };
};

async function run() {
  console.log('--- Starting Product Competitor & Project Deliverables Test ---');

  // Authenticate
  const adminId = process.env.ADMIN_EMAIL || 'ADMIN-01';
  const adminPass = process.env.ADMIN_PASSWORD || 'AdminPass123!';
  const adminCode = process.env.ADMIN_CODE || process.env.ADMIN_SECRET_CODE || '000000';

  const loginRes = await req('POST', '/api/auth/login', { identifier: adminId, password: adminPass });
  if (loginRes.data?.tempMfaToken) {
    const mfaRes = await req('POST', '/api/auth/verify-mfa', { tempMfaToken: loginRes.data.tempMfaToken, code: adminCode });
    TOKEN = mfaRes.data?.sessionToken || '';
  } else {
    TOKEN = loginRes.data?.sessionToken || '';
  }
  assert.ok(TOKEN, 'Should obtain authentication session token');
  console.log('   Authenticated successfully as Administrator.');

  // 1. Fetch competitors
  console.log('1. Fetching competitors...');
  const compRes = await req('GET', '/api/competitors');
  assert.strictEqual(compRes.status, 200, 'Competitors endpoint should return 200');
  const competitors = compRes.data;
  console.log(`   Found ${competitors.length} competitors in database.`);
  assert.ok(competitors.length >= 1, 'Should have at least 1 competitor seeded');

  // 2. Fetch or create a test product competitor quote
  const testItemId = 'prd-01';
  console.log(`2. Fetching competitor quotes for item ${testItemId}...`);
  const quotesRes = await req('GET', `/api/products/${testItemId}/competitor-quotes?itemType=produce`);
  assert.strictEqual(quotesRes.status, 200, 'Competitor quotes endpoint should return 200');
  let quotes = quotesRes.data;
  console.log(`   Found ${quotes.length} competitor quotes for ${testItemId}.`);

  // Create quote if none
  if (quotes.length === 0) {
    console.log(`   Creating competitor quote for ${testItemId}...`);
    const createRes = await req('POST', `/api/products/${testItemId}/competitor-quotes`, {
      itemType: 'produce',
      competitorName: 'Apex Industrial Dynamics',
      competitorPrice: 1350.00,
      volumePricing: [
        { minQty: 1, maxQty: 10, unitPrice: 1350.00, discountPct: 0, label: '1 - 10 pcs' },
        { minQty: 11, maxQty: 50, unitPrice: 1282.50, discountPct: 5, label: '11 - 50 pcs' },
        { minQty: 51, maxQty: 200, unitPrice: 1215.00, discountPct: 10, label: '51 - 200 pcs' }
      ],
      notes: 'Verified against current Q3 price schedule'
    });
    assert.strictEqual(createRes.status, 201, 'Should create competitor quote with 201');
    quotes = [createRes.data];
    console.log(`   Created competitor quote: ${quotes[0].id} ($${quotes[0].competitorPrice})`);
  }

  const quoteToCommit = quotes[0];
  assert.ok(quoteToCommit, 'Must have at least one quote to test price commit');

  // 3. Commit a price revision with ranges and driver
  console.log(`3. Committing price revision on quote ${quoteToCommit.id}...`);
  const newPrice = Number((quoteToCommit.competitorPrice * 1.04).toFixed(2));
  const commitRes = await req('POST', `/api/products/${testItemId}/competitor-quotes/${quoteToCommit.id}/commit-price`, {
    newPrice,
    effectiveDate: new Date().toISOString().slice(0, 10),
    reason: 'Raw Materials Surcharge Adjustment',
    quoteRef: `QT-COMP-${Date.now().toString().slice(-4)}`,
    volumePricing: [
      { minQty: 1, maxQty: 10, unitPrice: newPrice, discountPct: 0, label: '1 - 10 pcs' },
      { minQty: 11, maxQty: 50, unitPrice: Number((newPrice * 0.95).toFixed(2)), discountPct: 5, label: '11 - 50 pcs' }
    ],
    updatedBy: 'Test Automation Agent'
  });
  assert.strictEqual(commitRes.status, 200, 'Commit price change should return 200');
  console.log(`   Price committed successfully: New rate = $${commitRes.data.competitorPrice}`);

  // 4. Verify historical log in product_competitor_price_history
  console.log(`4. Fetching competitor price history for item ${testItemId}...`);
  const histRes = await req('GET', `/api/products/${testItemId}/competitor-history?itemType=produce`);
  assert.strictEqual(histRes.status, 200, 'History endpoint should return 200');
  const history = histRes.data;
  console.log(`   Found ${history.length} price change history records.`);
  assert.ok(history.length >= 1, 'Should have at least 1 history record logged in PostgreSQL');
  assert.strictEqual(history[0].reason, 'Raw Materials Surcharge Adjustment', 'History record reason should match');

  // 5. Test Project Deliverables Relational API
  let testProjectId = 'prj-01';
  const projsRes = await req('GET', '/api/projects');
  if (Array.isArray(projsRes.data) && projsRes.data.length > 0) {
    testProjectId = projsRes.data[0].id;
  } else {
    // Create a seed project in PostgreSQL so foreign key constraint passes
    const createProj = await req('POST', '/api/projects', {
      id: 'prj-01',
      code: 'PRJ-2026-001',
      name: 'Turnkey CNC Automation Facility',
      client: 'Apex Industrial Dynamics',
      status: 'In Progress',
      budget: 150000,
      currency: 'USD',
      startDate: '2026-01-01',
      endDate: '2026-12-31'
    });
    if (createProj.data?.id) {
      testProjectId = createProj.data.id;
    }
  }

  const delivsRes = await req('GET', `/api/projects/${testProjectId}/deliverables`);
  console.log('   delivsRes status:', delivsRes.status, 'data:', delivsRes.data);
  assert.strictEqual(delivsRes.status, 200, 'Project deliverables endpoint should return 200');
  console.log(`   Found ${delivsRes.data.length} deliverables for project ${testProjectId}.`);

  // 6. Create a new deliverable linked to revenue item
  console.log(`6. Creating deliverable for project ${testProjectId}...`);
  const newDelivPayload = {
    code: `DELIV-TEST-${Date.now().toString().slice(-4)}`,
    name: 'Precision High-Pressure Conveyor Unit',
    type: 'product',
    category: 'Industrial Machinery',
    quantity: 3,
    unit: 'units',
    costPrice: 4200.00,
    quotedPrice: 6500.00,
    competitorBenchmarkPrice: 6850.00,
    competitorName: 'Apex Industrial Dynamics',
    status: 'Planned',
    notes: 'Direct automated test deliverable'
  };

  const createDelivRes = await req('POST', `/api/projects/${testProjectId}/deliverables`, newDelivPayload);
  assert.strictEqual(createDelivRes.status, 201, 'Deliverable creation should return 201');
  const createdDeliv = createDelivRes.data;
  console.log(`   Created deliverable: ID=${createdDeliv.id}, Name=${createdDeliv.name}, Margin=${createdDeliv.marginPct}%`);
  assert.strictEqual(createdDeliv.name, newDelivPayload.name, 'Name should match');
  assert.strictEqual(Number(createdDeliv.quantity), 3, 'Quantity should match');

  // 7. Update deliverable
  console.log(`7. Updating deliverable ${createdDeliv.id}...`);
  const updateDelivRes = await req('PUT', `/api/projects/${testProjectId}/deliverables/${createdDeliv.id}`, {
    quantity: 5,
    quotedPrice: 6600.00
  });
  assert.strictEqual(updateDelivRes.status, 200, 'Deliverable update should return 200');
  console.log(`   Updated deliverable: Qty=${updateDelivRes.data.quantity}, QuotedPrice=$${updateDelivRes.data.quotedPrice}, Revenue=$${updateDelivRes.data.totalRevenue}`);
  assert.strictEqual(Number(updateDelivRes.data.quantity), 5, 'Updated quantity should be 5');

  // 8. Delete deliverable
  console.log(`8. Deleting test deliverable ${createdDeliv.id}...`);
  const delDelivRes = await req('DELETE', `/api/projects/${testProjectId}/deliverables/${createdDeliv.id}`);
  assert.strictEqual(delDelivRes.status, 200, 'Deliverable delete should return 200');
  console.log('   Deliverable deleted successfully.');

  console.log('\n--- ALL PRODUCT COMPETITOR & DELIVERABLES TESTS PASSED! ---');
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
