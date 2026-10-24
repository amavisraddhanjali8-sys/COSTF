import { postgresService } from '../src/server/postgresDb.ts';

async function runTest() {
  console.log('Testing Enterprise Resources, Project Plan Allocation, and Primary Currency (LKR)...');

  // 1. Check Resources Schema and Create Resource in LKR
  const testResource = await postgresService.createResource({
    name: 'Senior Heavy Equipment Operator',
    type: 'labour',
    category: 'Heavy Operations',
    subCategory: 'Excavation Specialists',
    unit: 'hr',
    baseRate: 2500, // LKR 2500/hr
    operationalCharge: 200,
    chargeType: 'hourly',
    currency: 'LKR',
    supplierName: 'Lanka Industrial Operators',
    competitorCompany: 'Global Operators Ltd',
    competitorRate: 2800,
    industryBenchmarkRate: 2600,
    status: 'Available'
  });

  console.log('✓ Resource created:', testResource.code, testResource.name, 'Currency:', testResource.currency);
  if (testResource.currency !== 'LKR') {
    throw new Error(`Expected currency LKR but got ${testResource.currency}`);
  }

  // 2. Fetch all resources
  const allResources = await postgresService.getResources();
  console.log(`✓ Fetched ${allResources.length} resources from PostgreSQL`);

  // 3. Create a test project and plan
  const testProject = await postgresService.createProject({
    code: `PRJ-LKR-${Date.now().toString().slice(-4)}`,
    name: 'Colombo Commercial Complex',
    status: 'Planning',
    currency: 'LKR',
    budget: 50000000,
    phases: [
      { id: 'ph-foundation', name: 'Foundation Works', status: 'Active' },
      { id: 'ph-structure', name: 'Superstructure', status: 'Pending' }
    ]
  });
  console.log('✓ Project created:', testProject.code, 'Currency:', testProject.currency);

  const testPlan = await postgresService.createProjectPlan({
    projectId: testProject.id,
    planName: 'Optimal Cost Plan 2026',
    isApproved: false,
    currency: 'LKR'
  });
  console.log('✓ Plan created:', testPlan.id, testPlan.plan_name);

  // 4. Allocate resource to project and plan
  const allocation = await postgresService.allocateResourceToProject(
    testResource.id,
    testProject.id,
    'ph-foundation',
    120, // 120 hours
    'hr',
    2500, // unit cost
    testPlan.id // target plan
  );
  console.log('✓ Resource allocated to plan:', allocation);

  // 5. Verify plan cost summary has direct costs recalculated
  const summary = await postgresService.getPlanCostSummary(testPlan.id);
  console.log('✓ Plan Cost Summary recalculated:', summary);
  if (!summary || Number(summary.directCost) < 300000) {
    throw new Error(`Expected direct cost >= 300,000 LKR (120 * 2500 = 300,000), got: ${summary?.directCost}`);
  }

  console.log('ALL TESTS PASSED SUCCESSFULLY! PostgreSQL schema and allocation in LKR validated.');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
