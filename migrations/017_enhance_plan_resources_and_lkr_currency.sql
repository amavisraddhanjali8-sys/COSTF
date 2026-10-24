-- Migration 017: Enhance Plan Resources Schema and Set Primary Currency to LKR across all Resources & Plans
-- Ensures PostgreSQL database compliance for unique project plan resource allocations and financial calculation

-- 1. Set Primary Currency on enterprise_resources to LKR
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'enterprise_resources') THEN
    ALTER TABLE enterprise_resources ALTER COLUMN currency SET DEFAULT 'LKR';
    UPDATE enterprise_resources SET currency = 'LKR' WHERE currency IS NULL OR currency = '' OR currency = 'USD';
  END IF;
END $$;

-- 2. Enhance project_plan_resources with unit and currency columns for cost calculation
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_plan_resources') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_plan_resources' AND column_name = 'unit') THEN
      ALTER TABLE project_plan_resources ADD COLUMN unit TEXT DEFAULT 'hr';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_plan_resources' AND column_name = 'currency') THEN
      ALTER TABLE project_plan_resources ADD COLUMN currency TEXT DEFAULT 'LKR';
    END IF;
    UPDATE project_plan_resources SET currency = 'LKR' WHERE currency IS NULL OR currency = '' OR currency = 'USD';
  END IF;
END $$;

-- 3. Ensure project_plans primary currency defaults to LKR
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_plans') THEN
    ALTER TABLE project_plans ALTER COLUMN currency SET DEFAULT 'LKR';
    UPDATE project_plans SET currency = 'LKR' WHERE currency IS NULL OR currency = '' OR currency = 'USD';
  END IF;
END $$;
