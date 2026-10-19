-- ============================================================================
-- Migration 004: Centralized Revenue Catalogue, Plan BOQ, & Historical Commercial Rate Tracking
-- ============================================================================

-- 1. Revenue Categories
CREATE TABLE IF NOT EXISTS revenue_categories (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'both' CHECK (type IN ('product', 'service', 'both')),
  description TEXT DEFAULT '',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Revenue Subcategories
CREATE TABLE IF NOT EXISTS revenue_subcategories (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES revenue_categories(id) ON DELETE CASCADE,
  category_name TEXT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Centralized Revenue Catalogue (revenue_items)
-- Distinguishes products sold by the company and services provided by the company.
-- Outsourced vendor services are strictly cost items and excluded.
CREATE TABLE IF NOT EXISTS revenue_items (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  barcode TEXT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('product', 'service')),
  category TEXT NOT NULL,
  sub_category TEXT DEFAULT '',
  description TEXT DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'unit',
  default_rate NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (default_rate >= 0),
  cost_price NUMERIC(18, 4) DEFAULT 0 CHECK (cost_price >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  tax_treatment TEXT DEFAULT 'Standard (0%)',
  tax_rate_pct NUMERIC(8, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Extend project_plan_boq_items with revenue links, snapshot data, and tax
ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS revenue_item_id TEXT REFERENCES revenue_items(id) ON DELETE SET NULL;
ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS rate NUMERIC(18, 4) DEFAULT 0;
ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS tax_treatment TEXT DEFAULT 'Standard (0%)';
ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS tax_rate_pct NUMERIC(8, 2) DEFAULT 0;
ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(18, 2) DEFAULT 0;
ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS snapshot_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS commercial_context TEXT DEFAULT '';

-- Compatibility view for plan_boq_items
CREATE OR REPLACE VIEW plan_boq_items AS SELECT * FROM project_plan_boq_items;

-- 5. Historical Commercial Rate Tracking (revenue_rate_history)
CREATE TABLE IF NOT EXISTS revenue_rate_history (
  id TEXT PRIMARY KEY,
  revenue_item_id TEXT NOT NULL REFERENCES revenue_items(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_plan_id TEXT NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
  plan_boq_item_id TEXT NOT NULL,
  previous_unit TEXT,
  new_unit TEXT NOT NULL,
  previous_quantity NUMERIC(18, 4),
  new_quantity NUMERIC(18, 4) NOT NULL,
  previous_rate NUMERIC(18, 4),
  new_rate NUMERIC(18, 4) NOT NULL,
  change_type TEXT NOT NULL DEFAULT 'initial_addition' CHECK (change_type IN ('initial_addition', 'rate_change', 'quantity_change', 'unit_change', 'rate_and_quantity_change', 'commercial_terms_update')),
  fields_changed JSONB DEFAULT '[]'::jsonb,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by TEXT NOT NULL DEFAULT 'System User',
  change_reason TEXT DEFAULT '',
  commercial_context TEXT DEFAULT '',
  idempotency_key TEXT UNIQUE
);

-- 6. Indexes for High-Performance Queries, Filtering, and History Views
CREATE INDEX IF NOT EXISTS idx_rev_items_code ON revenue_items(code);
CREATE INDEX IF NOT EXISTS idx_rev_items_name ON revenue_items(name);
CREATE INDEX IF NOT EXISTS idx_rev_items_type ON revenue_items(type);
CREATE INDEX IF NOT EXISTS idx_rev_items_category ON revenue_items(category);
CREATE INDEX IF NOT EXISTS idx_rev_items_status ON revenue_items(status);
CREATE INDEX IF NOT EXISTS idx_rev_rate_hist_item ON revenue_rate_history(revenue_item_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_rev_rate_hist_project ON revenue_rate_history(project_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_rev_rate_hist_plan ON revenue_rate_history(project_plan_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_rev_rate_hist_boq ON revenue_rate_history(plan_boq_item_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_rev_rate_hist_idempotency ON revenue_rate_history(idempotency_key);
