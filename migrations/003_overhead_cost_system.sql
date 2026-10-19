-- ============================================================================
-- Migration 003: Overhead Cost Management System & Plan Allocation
-- ============================================================================

CREATE TABLE IF NOT EXISTS overhead_categories (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  is_default BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS overhead_items (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  barcode TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  cost_type TEXT NOT NULL DEFAULT 'Fixed' CHECK (cost_type IN ('Fixed', 'Variable', 'Semi-Variable', 'Stepped')),
  default_calculation_method TEXT NOT NULL DEFAULT 'fixed_amount' CHECK (default_calculation_method IN ('fixed_amount', 'percentage_of_cost_base', 'rate_per_unit', 'proportional_defined_base')),
  default_rate NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (default_rate >= 0),
  default_cost_base TEXT NOT NULL DEFAULT 'total_direct_cost',
  unit_type TEXT DEFAULT 'month',
  effective_date DATE DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Archived', 'Under Review')),
  created_by TEXT NOT NULL DEFAULT 'System',
  updated_by TEXT NOT NULL DEFAULT 'System',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plan_overhead_allocations (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  overhead_item_id TEXT REFERENCES overhead_items(id) ON DELETE RESTRICT,
  allocation_method TEXT NOT NULL DEFAULT 'fixed_amount',
  allocation_base TEXT NOT NULL DEFAULT 'total_direct_cost',
  base_amount NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (base_amount >= 0),
  allocation_rate NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (allocation_rate >= 0),
  unit_quantity NUMERIC(18, 4) NOT NULL DEFAULT 1 CHECK (unit_quantity >= 0),
  allocated_amount NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (allocated_amount >= 0),
  effective_date DATE DEFAULT CURRENT_DATE,
  allocated_by TEXT DEFAULT 'System',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS overhead_audit_logs (
  id TEXT PRIMARY KEY,
  overhead_item_id TEXT,
  overhead_item_code TEXT,
  overhead_item_name TEXT,
  plan_id TEXT,
  plan_number TEXT,
  allocation_id TEXT,
  action TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT,
  actor_role TEXT,
  previous_state JSONB,
  new_state JSONB,
  change_description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_overhead_items_category ON overhead_items(category);
CREATE INDEX IF NOT EXISTS idx_overhead_items_status ON overhead_items(status);
CREATE INDEX IF NOT EXISTS idx_plan_ovh_plan_id ON plan_overhead_allocations(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_ovh_project_id ON plan_overhead_allocations(project_id);
CREATE INDEX IF NOT EXISTS idx_plan_ovh_item_id ON plan_overhead_allocations(overhead_item_id);
