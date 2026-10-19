-- ============================================================================
-- Migration 002: Complete Normalized Project Planning Database System
-- Target Database: inno_cost (PostgreSQL / PGlite)
-- ============================================================================
-- Connects every project plan to its parent project via FOREIGN KEY,
-- separates plans, revisions, sections/phases, BOQ items, resources,
-- overhead allocations, and materialized cost summaries into normalized tables,
-- and adds indexes for fast filtering, sorting, and lookups.
-- ============================================================================

-- 1. Add active_plan_id column to projects if not present
ALTER TABLE projects ADD COLUMN IF NOT EXISTS active_plan_id TEXT;

-- 2. Main project_plans table
CREATE TABLE IF NOT EXISTS project_plans (
  id TEXT PRIMARY KEY,
  plan_number TEXT UNIQUE NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  plan_type TEXT NOT NULL DEFAULT 'Baseline',
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'In Review', 'Approved', 'Active', 'Locked', 'Archived')),
  revision_number INT NOT NULL DEFAULT 1 CHECK (revision_number >= 1),
  version_label TEXT NOT NULL DEFAULT 'v1.0',
  is_baseline BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT false,
  currency TEXT NOT NULL DEFAULT 'USD',
  planned_revenue NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (planned_revenue >= 0),
  target_margin_pct NUMERIC(8, 2) NOT NULL DEFAULT 25,
  overhead_pct NUMERIC(8, 2) NOT NULL DEFAULT 8.5 CHECK (overhead_pct >= 0),
  contingency_pct NUMERIC(8, 2) NOT NULL DEFAULT 5.0 CHECK (contingency_pct >= 0),
  labor_burden_pct NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (labor_burden_pct >= 0),
  effective_date DATE DEFAULT CURRENT_DATE,
  approval_date DATE,
  approved_by TEXT,
  created_by TEXT NOT NULL DEFAULT 'System',
  updated_by TEXT NOT NULL DEFAULT 'System',
  theme_id TEXT,
  custom_gradient TEXT,
  template_id TEXT,
  source_project_id TEXT,
  source_project_code TEXT,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Plan Revisions Table (project_plan_revisions)
CREATE TABLE IF NOT EXISTS project_plan_revisions (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  revision_number INT NOT NULL CHECK (revision_number >= 1),
  version_label TEXT NOT NULL DEFAULT 'v1.0',
  change_summary TEXT NOT NULL DEFAULT 'Initial plan creation',
  status_at_revision TEXT NOT NULL DEFAULT 'Draft',
  planned_revenue NUMERIC(18, 2) NOT NULL DEFAULT 0,
  direct_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
  allocated_overhead NUMERIC(18, 2) NOT NULL DEFAULT 0,
  total_planned_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
  planned_profit NUMERIC(18, 2) NOT NULL DEFAULT 0,
  profit_margin_pct NUMERIC(8, 2) NOT NULL DEFAULT 0,
  changed_by TEXT NOT NULL DEFAULT 'System',
  effective_date DATE DEFAULT CURRENT_DATE,
  snapshot_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Plan Sections / Phases Table (project_plan_sections)
CREATE TABLE IF NOT EXISTS project_plan_sections (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_code TEXT NOT NULL DEFAULT 'PH-01',
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  sequence_order INT NOT NULL DEFAULT 1,
  planned_budget NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (planned_budget >= 0),
  material_budget NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (material_budget >= 0),
  labor_budget NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (labor_budget >= 0),
  outsourced_budget NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (outsourced_budget >= 0),
  actual_cost NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (actual_cost >= 0),
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'Not Started',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Plan BOQ Line Items Table (project_plan_boq_items)
CREATE TABLE IF NOT EXISTS project_plan_boq_items (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section_id TEXT REFERENCES project_plan_sections(id) ON DELETE SET NULL,
  phase_id TEXT DEFAULT 'phase-01',
  item_type TEXT NOT NULL DEFAULT 'material' CHECK (item_type IN ('material', 'subcontractor', 'outsourced', 'produce', 'equipment', 'other')),
  catalog_item_id TEXT,
  item_code TEXT,
  name TEXT NOT NULL,
  category TEXT DEFAULT '',
  supplier_or_provider TEXT DEFAULT '',
  quantity NUMERIC(18, 4) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit TEXT NOT NULL DEFAULT 'pcs',
  unit_cost NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  discount_pct NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 100),
  total_cost NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
  markup_pct NUMERIC(8, 2) NOT NULL DEFAULT 0,
  billable_rate NUMERIC(18, 4) NOT NULL DEFAULT 0,
  total_revenue NUMERIC(18, 2) NOT NULL DEFAULT 0,
  gross_profit NUMERIC(18, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  native_unit_cost NUMERIC(18, 4),
  consumption_rate NUMERIC(8, 2) DEFAULT 100,
  notes TEXT DEFAULT '',
  line_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Plan Resources Table (project_plan_resources)
CREATE TABLE IF NOT EXISTS project_plan_resources (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section_id TEXT REFERENCES project_plan_sections(id) ON DELETE SET NULL,
  resource_id TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'subcontractor' CHECK (resource_type IN ('team_member', 'subcontractor', 'equipment')),
  name TEXT NOT NULL,
  role_or_trade TEXT DEFAULT '',
  allocated_hours NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (allocated_hours >= 0),
  hourly_rate NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (hourly_rate >= 0),
  total_cost NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
  start_date DATE,
  end_date DATE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Plan Overhead Allocations Table (project_plan_overhead_allocations)
CREATE TABLE IF NOT EXISTS project_plan_overhead_allocations (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  allocation_type TEXT NOT NULL DEFAULT 'percentage' CHECK (allocation_type IN ('percentage', 'fixed')),
  rate_pct NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (rate_pct >= 0),
  base_amount NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (base_amount >= 0),
  allocated_amount NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (allocated_amount >= 0),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Plan Cost Summaries Table (project_plan_cost_summaries)
CREATE TABLE IF NOT EXISTS project_plan_cost_summaries (
  plan_id TEXT PRIMARY KEY REFERENCES project_plans(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  planned_revenue NUMERIC(18, 2) NOT NULL DEFAULT 0,
  material_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
  subcontractor_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
  outsourced_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
  resource_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
  direct_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
  overhead_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  contingency_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  labor_burden_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  extra_overhead_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  allocated_overhead NUMERIC(18, 2) NOT NULL DEFAULT 0,
  total_planned_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
  gross_profit NUMERIC(18, 2) NOT NULL DEFAULT 0,
  gross_margin_pct NUMERIC(8, 2) NOT NULL DEFAULT 0,
  planned_profit NUMERIC(18, 2) NOT NULL DEFAULT 0,
  profit_margin_pct NUMERIC(8, 2) NOT NULL DEFAULT 0,
  boq_item_count INT NOT NULL DEFAULT 0,
  section_count INT NOT NULL DEFAULT 0,
  resource_count INT NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Indexes for project_id, status, plan_number, and frequently queried fields
CREATE INDEX IF NOT EXISTS idx_project_plans_project_id ON project_plans(project_id);
CREATE INDEX IF NOT EXISTS idx_project_plans_status ON project_plans(status);
CREATE INDEX IF NOT EXISTS idx_project_plans_plan_number ON project_plans(plan_number);
CREATE INDEX IF NOT EXISTS idx_project_plans_updated_at ON project_plans(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_plans_project_status ON project_plans(project_id, status);
CREATE INDEX IF NOT EXISTS idx_project_plans_plan_type ON project_plans(plan_type);

CREATE INDEX IF NOT EXISTS idx_plan_revisions_plan_id ON project_plan_revisions(plan_id, revision_number DESC);
CREATE INDEX IF NOT EXISTS idx_plan_revisions_project_id ON project_plan_revisions(project_id);

CREATE INDEX IF NOT EXISTS idx_plan_sections_plan_id ON project_plan_sections(plan_id, sequence_order ASC);
CREATE INDEX IF NOT EXISTS idx_plan_sections_project_id ON project_plan_sections(project_id);

CREATE INDEX IF NOT EXISTS idx_plan_boq_items_plan_id ON project_plan_boq_items(plan_id, line_order ASC);
CREATE INDEX IF NOT EXISTS idx_plan_boq_items_project_id ON project_plan_boq_items(project_id);
CREATE INDEX IF NOT EXISTS idx_plan_boq_items_item_type ON project_plan_boq_items(item_type);

CREATE INDEX IF NOT EXISTS idx_plan_resources_plan_id ON project_plan_resources(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_resources_project_id ON project_plan_resources(project_id);

CREATE INDEX IF NOT EXISTS idx_plan_overheads_plan_id ON project_plan_overhead_allocations(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_overheads_project_id ON project_plan_overhead_allocations(project_id);

CREATE INDEX IF NOT EXISTS idx_plan_summaries_project_id ON project_plan_cost_summaries(project_id);
