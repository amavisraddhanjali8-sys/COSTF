-- Migration 015: Set Primary Currency to LKR for projects and update defaults
-- Sets LKR as the authoritative default currency in PostgreSQL

ALTER TABLE projects ALTER COLUMN currency SET DEFAULT 'LKR';

-- Update any existing projects with empty or null currency to primary LKR
UPDATE projects SET currency = 'LKR' WHERE currency IS NULL OR currency = '' OR currency = 'USD';

-- If project_deliverables table exists, set default to LKR
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_deliverables') THEN
    ALTER TABLE project_deliverables ALTER COLUMN currency SET DEFAULT 'LKR';
    UPDATE project_deliverables SET currency = 'LKR' WHERE currency IS NULL OR currency = '' OR currency = 'USD';
  END IF;
END $$;
