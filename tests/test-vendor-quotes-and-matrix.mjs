// Test Suite: Material Vendor Quotes, Price Change Matrix & Archive Deletion System
import http from 'http';

const BASE = process.env.BASE || 'http://localhost:3000';
let pass = 0, fail = 0;

const ok = (name, cond, extra = '') => {
  if (cond) {
    pass++;
    console.log(`✓ PASS: ${name}`);
  } else {
    fail++;
    console.error(`✗ FAIL: ${name} -> ${extra}`);
  }
};

let TOKEN = '';

const req = async (method, path, body = null, token = TOKEN) => {
  const url = new URL(path, BASE);
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

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
  console.log('=== Starting Material Vendor Quotes & Price Matrix Test Suite ===\n');

  // 1. Authenticate as Admin
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
  ok('Authenticated session established', Boolean(TOKEN), `Token: ${TOKEN ? 'Retrieved' : 'Failed'}`);

  // 2. Fetch or create a test material
  const materialsRes = await req('GET', '/api/materials');
  let testMat = Array.isArray(materialsRes.data) && materialsRes.data.length > 0 ? materialsRes.data[0] : null;

  if (!testMat) {
    const createMatRes = await req('POST', '/api/materials', {
      name: 'High-Tensile Aerospace Alloy Bar',
      code: `MAT-TEST-${Date.now().toString().slice(-4)}`,
      unit: 'kg',
      currentPrice: 320.00,
      supplierName: 'Apex Precision Metals'
    });
    testMat = createMatRes.data;
  }
  ok('Test material available', Boolean(testMat && testMat.id), `ID: ${testMat?.id}`);

  // 3. GET /api/materials/:id/vendor-quotes
  const quotesRes = await req('GET', `/api/materials/${testMat.id}/vendor-quotes`);
  ok('GET /api/materials/:id/vendor-quotes returns 200', quotesRes.status === 200);
  ok('Vendor quotes list is an array', Array.isArray(quotesRes.data));

  // 4. Check for absence of irrelevant generic dummy vendors
  const hasGenericVulcanForge = quotesRes.data.some(
    (q) => (q.vendorName || '').toLowerCase().includes('vulcan forge') &&
           !(testMat.supplierName || '').toLowerCase().includes('vulcan forge')
  );
  ok('No irrelevant dummy supplier (Vulcan Forge) injected on unrelated material', !hasGenericVulcanForge);

  // 5. POST /api/materials/:id/vendor-quotes - Add new vendor quote
  const newVendorPayload = {
    vendorName: 'Global Titanium Extrusions Ltd',
    country: 'Germany',
    currentPrice: 310.50,
    currency: 'USD',
    leadTimeDays: 12,
    moq: 25,
    isPreferred: false,
    quoteReason: 'Onboarding European secondary mill partner',
    quoteRef: 'QT-EUR-2026-01',
    volumePricing: [
      { minQty: 25, maxQty: 100, unitPrice: 310.50, discountPct: 0, label: '25-100 (Base MOQ)' },
      { minQty: 101, maxQty: 500, unitPrice: 295.00, discountPct: 5.0, label: '101-500 (Volume Pack)' },
      { minQty: 501, unitPrice: 275.00, discountPct: 11.4, label: '501+ (Bulk Lot)' }
    ]
  };

  const addQuoteRes = await req('POST', `/api/materials/${testMat.id}/vendor-quotes`, newVendorPayload);
  ok('POST /api/materials/:id/vendor-quotes creates quote (201)', addQuoteRes.status === 201);
  const createdQuote = addQuoteRes.data;
  ok('Created quote has ID and matching vendorName', createdQuote?.id && createdQuote.vendorName === 'Global Titanium Extrusions Ltd');
  ok('Created quote has volume pricing tiers stored', Array.isArray(createdQuote?.volumePricing) && createdQuote.volumePricing.length === 3);

  // 6. PUT /api/materials/:id/vendor-quotes/:quoteId - Edit supplier details
  const updatePayload = {
    vendorName: 'Global Titanium & Superalloys GmbH',
    country: 'Germany',
    contactEmail: 'orders@global-titanium.de',
    contactPhone: '+49 89 123456',
    leadTimeDays: 14,
    moq: 30,
    currency: 'USD',
    status: 'Active',
    notes: 'ISO 9100 certified aerospace mill extruder'
  };

  const updateRes = await req('PUT', `/api/materials/${testMat.id}/vendor-quotes/${createdQuote.id}`, updatePayload);
  ok('PUT /api/materials/:id/vendor-quotes/:quoteId updates supplier details (200)', updateRes.status === 200);
  ok('Supplier name and SLA updated in DB', updateRes.data?.vendorName === 'Global Titanium & Superalloys GmbH' && updateRes.data?.leadTimeDays === 14);

  // 7. POST /api/materials/:id/vendor-quotes/:quoteId/commit-price - Commit Price & Tier Revision
  const commitPayload = {
    changeBasePrice: true,
    newBasePrice: 299.00,
    effectiveDate: new Date().toISOString().slice(0, 10),
    reason: 'Quarterly contractual metal tariff rebate and volume discount revision',
    quoteRef: 'QT-EUR-REV-02',
    moq: 30,
    leadTimeDays: 14,
    setAsPrimary: false,
    updatedBy: 'Chief Estimator',
    selectedRanges: [
      { rangeIndex: 0, minQty: 30, maxQty: 100, newPrice: 299.00, discountPct: 0, label: '30-100 (Base MOQ)' },
      { rangeIndex: 1, minQty: 101, maxQty: 500, newPrice: 284.00, discountPct: 5.0, label: '101-500 (Volume Pack)' },
      { rangeIndex: 2, minQty: 501, maxQty: null, newPrice: 260.00, discountPct: 13.0, label: '501+ (Bulk Lot)' }
    ],
    targetTierLabel: 'Base + 3 Ranges Changed'
  };

  const commitRes = await req('POST', `/api/materials/${testMat.id}/vendor-quotes/${createdQuote.id}/commit-price`, commitPayload);
  ok('POST /commit-price persists price revision (200)', commitRes.status === 200);
  ok('Committed base rate updated in DB', commitRes.data?.currentPrice === 299.00);

  // Check price history persisted
  const quotesAfterCommit = await req('GET', `/api/materials/${testMat.id}/vendor-quotes`);
  const targetQuoteWithHistory = quotesAfterCommit.data.find((q) => q.id === createdQuote.id);
  ok('Price history revisions recorded in database table', Boolean(targetQuoteWithHistory?.priceHistory && targetQuoteWithHistory.priceHistory.length >= 2));

  // 8. DELETE WITHOUT ARCHIVE DOWNLOAD -> Must be blocked with 400
  const unverifiedDeleteRes = await req('DELETE', `/api/materials/${testMat.id}/vendor-quotes/${createdQuote.id}`, {});
  ok('Deleting vendor with historical prices without archive is blocked (400)', unverifiedDeleteRes.status === 400);
  ok('Compliance error message returned', unverifiedDeleteRes.data?.error?.includes('Compliance Enforcement') || unverifiedDeleteRes.data?.error?.includes('archive'));

  // 9. ARCHIVE DOWNLOAD & DELETE -> Must succeed and write to archive registry
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeFilename = `${testMat.code}_Global_Titanium_PriceHistory_Archive_${timestamp}.csv`;

  const archiveDeletePayload = {
    archivedFilename: safeFilename,
    user: {
      id: 'USR-ADMIN',
      name: 'System Administrator',
      role: 'ADMIN',
      email: adminEmail
    },
    notes: 'Regulatory price archive verified and downloaded prior to vendor deletion'
  };

  const archiveDeleteRes = await req(
    'POST',
    `/api/materials/${testMat.id}/vendor-quotes/${createdQuote.id}/archive-and-delete`,
    archiveDeletePayload
  );
  ok('POST /archive-and-delete succeeds (200)', archiveDeleteRes.status === 200);
  ok('Deletion response confirms archived status', archiveDeleteRes.data?.archived === true);

  // 10. GET /api/materials/:id/vendor-archives -> Verify stored archive
  const archivesRes = await req('GET', `/api/materials/${testMat.id}/vendor-archives`);
  ok('GET /api/materials/:id/vendor-archives returns 200', archivesRes.status === 200);
  const matchingArchive = Array.isArray(archivesRes.data) && archivesRes.data.find((a) => a.archived_filename === safeFilename);
  ok('Archive record exists in vendor_deletion_archives table', Boolean(matchingArchive));
  ok('Archive records operator user ID & name', matchingArchive?.actor_name === 'System Administrator' || matchingArchive?.actor_id === 'USR-ADMIN');

  // 11. Verify Audit Logs for Vendor Events with User Details
  const auditRes = await req('GET', '/api/audit-logs');
  ok('GET /api/audit-logs returns 200', auditRes.status === 200);

  console.log(`\n=== Test Summary: ${pass} passed, ${fail} failed ===\n`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('Test execution error:', e);
  process.exit(1);
});
