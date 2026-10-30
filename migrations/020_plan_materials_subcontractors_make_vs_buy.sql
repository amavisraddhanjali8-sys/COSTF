-- ============================================================================
-- Migration 020: Project Plan Direct Materials, Subcontractor Rates & Make vs Buy Analysis
-- Target Database: inno_cost (PostgreSQL / PGlite)
-- ============================================================================
-- Enables project plans to:
-- 1. Add direct materials, subcontractor trade rates, and outsourced services.
-- 2. Embed specialized subcontractor charges into unit manufacturing costs.
-- 3. Perform Make vs Buy / In-House Manufacture vs Subcontractor comparative analysis.
-- 4. Establish LKR as the primary default currency with multi-currency selection.
-- ============================================================================

-- 1. Enhance project_plan_boq_items with manufacturing and subcontractor columns
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_plan_boq_items') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_plan_boq_items' AND column_name = 'is_manufactured') THEN
      ALTER TABLE project_plan_boq_items ADD COLUMN is_manufactured BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_plan_boq_items' AND column_name = 'manufacturing_mode') THEN
      ALTER TABLE project_plan_boq_items ADD COLUMN manufacturing_mode TEXT DEFAULT 'standard';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_plan_boq_items' AND column_name = 'manufacturing_cost_breakdown') THEN
      ALTER TABLE project_plan_boq_items ADD COLUMN manufacturing_cost_breakdown JSONB DEFAULT '{}'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_plan_boq_items' AND column_name = 'included_subcontractor_charges') THEN
      ALTER TABLE project_plan_boq_items ADD COLUMN included_subcontractor_charges NUMERIC(18, 4) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_plan_boq_items' AND column_name = 'subcontractor_id') THEN
      ALTER TABLE project_plan_boq_items ADD COLUMN subcontractor_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_plan_boq_items' AND column_name = 'subcontractor_name') THEN
      ALTER TABLE project_plan_boq_items ADD COLUMN subcontractor_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_plan_boq_items' AND column_name = 'subcontractor_trade') THEN
      ALTER TABLE project_plan_boq_items ADD COLUMN subcontractor_trade TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_plan_boq_items' AND column_name = 'subcontractor_rate') THEN
      ALTER TABLE project_plan_boq_items ADD COLUMN subcontractor_rate NUMERIC(18, 4) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_plan_boq_items' AND column_name = 'lead_time_days') THEN
      ALTER TABLE project_plan_boq_items ADD COLUMN lead_time_days INT DEFAULT 7;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_plan_boq_items' AND column_name = 'make_vs_buy_decision') THEN
      ALTER TABLE project_plan_boq_items ADD COLUMN make_vs_buy_decision TEXT DEFAULT 'direct';
    END IF;

    ALTER TABLE project_plan_boq_items ALTER COLUMN currency SET DEFAULT 'LKR';
  END IF;
END $$;

-- 2. Create Make vs Buy Analysis Table
CREATE TABLE IF NOT EXISTS project_plan_make_vs_buy_analyses (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  boq_item_id TEXT REFERENCES project_plan_boq_items(id) ON DELETE SET NULL,
  item_code TEXT,
  item_name TEXT NOT NULL,
  category TEXT DEFAULT 'Manufacturing & Assembly',
  quantity NUMERIC(18, 4) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'unit',
  currency TEXT NOT NULL DEFAULT 'LKR',
  
  -- In-House Manufacturing Breakdown
  material_cost_per_unit NUMERIC(18, 4) NOT NULL DEFAULT 0,
  labor_cost_per_unit NUMERIC(18, 4) NOT NULL DEFAULT 0,
  overhead_cost_per_unit NUMERIC(18, 4) NOT NULL DEFAULT 0,
  subcontractor_charges_per_unit NUMERIC(18, 4) NOT NULL DEFAULT 0,
  total_unit_manufacture_cost NUMERIC(18, 4) NOT NULL DEFAULT 0,
  total_manufacture_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
  
  -- Subcontractor / External Sourcing
  subcontractor_id TEXT,
  subcontractor_name TEXT,
  subcontractor_trade TEXT,
  subcontractor_unit_rate NUMERIC(18, 4) NOT NULL DEFAULT 0,
  subcontractor_lead_time_days INT DEFAULT 14,
  total_subcontractor_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
  
  -- Comparison & Decision
  cost_difference NUMERIC(18, 2) NOT NULL DEFAULT 0, -- positive = in-house is cheaper by this amount
  savings_pct NUMERIC(8, 2) NOT NULL DEFAULT 0,
  break_even_quantity NUMERIC(18, 2) DEFAULT 0,
  recommended_decision TEXT NOT NULL DEFAULT 'manufacture' CHECK (recommended_decision IN ('manufacture', 'subcontract', 'hybrid')),
  selected_decision TEXT NOT NULL DEFAULT 'manufacture' CHECK (selected_decision IN ('manufacture', 'subcontract', 'hybrid')),
  
  -- Detailed line breakdowns (JSONB)
  materials_breakdown JSONB DEFAULT '[]'::jsonb,
  labor_breakdown JSONB DEFAULT '[]'::jsonb,
  subcontractor_charges_breakdown JSONB DEFAULT '[]'::jsonb,
  
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Adopted', 'Archived')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_make_vs_buy_plan ON project_plan_make_vs_buy_analyses(plan_id);
CREATE INDEX IF NOT EXISTS idx_make_vs_buy_project ON project_plan_make_vs_buy_analyses(project_id);

-- 3. Ensure LKR is default currency everywhere
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_plans') THEN
    ALTER TABLE project_plans ALTER COLUMN currency SET DEFAULT 'LKR';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_plan_resources') THEN
    ALTER TABLE project_plan_resources ALTER COLUMN currency SET DEFAULT 'LKR';
  END IF;
END $$;
