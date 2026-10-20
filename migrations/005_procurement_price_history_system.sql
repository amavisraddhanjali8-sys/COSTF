-- ============================================================================
-- Migration 005: Normalized Supplier, Vendor, Outsourced & Subcontractor Price History System
-- Target Database: inno_cost (PostgreSQL / PGlite)
-- ============================================================================
-- Connects suppliers, vendors, outsourced service providers, and subcontractors
-- to a rigorous historical price-tracking system for materials and services.
-- Links every price record to verified existing entities via FOREIGN KEYS.
-- Supports distinct price types (quotation, negotiated, PO, invoiced, agreed rate)
-- and cost stages (estimated, quoted, committed, actual).
-- ============================================================================

-- 1. Main procurement_price_history table
CREATE TABLE IF NOT EXISTS procurement_price_history (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('material', 'outsourced_service', 'subcontractor_rate', 'procurement_item')),
  item_id TEXT NOT NULL,
  item_code TEXT,
  item_name TEXT NOT NULL,
  category TEXT DEFAULT '',
  sub_category TEXT DEFAULT '',
  material_id TEXT REFERENCES materials(id) ON DELETE CASCADE,
  outsourced_service_id TEXT REFERENCES outsourced_services(id) ON DELETE CASCADE,
  subcontractor_id TEXT REFERENCES subcontractors(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  project_plan_id TEXT REFERENCES project_plans(id) ON DELETE SET NULL,
  unit TEXT NOT NULL DEFAULT 'unit',
  unit_price NUMERIC(18, 4) NOT NULL CHECK (unit_price >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  quotation_ref TEXT,
  valid_from DATE,
  valid_until DATE,
  recorded_by TEXT NOT NULL DEFAULT 'System User',
  notes TEXT DEFAULT '',
  price_type TEXT NOT NULL DEFAULT 'supplier_quotation' CHECK (
    price_type IN (
      'supplier_quotation',
      'negotiated_price',
      'purchase_order_price',
      'actual_invoiced_price',
      'subcontractor_quotation',
      'agreed_subcontract_rate',
      'catalog_price_revision'
    )
  ),
  cost_stage TEXT NOT NULL DEFAULT 'quoted' CHECK (
    cost_stage IN ('estimated', 'quoted', 'committed', 'actual')
  ),
  is_confirmed_purchase BOOLEAN NOT NULL DEFAULT false,
  lead_time_days INT DEFAULT 7,
  moq NUMERIC(18, 4) DEFAULT 1,
  previous_price NUMERIC(18, 4),
  price_change_amount NUMERIC(18, 4),
  price_change_pct NUMERIC(10, 2),
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Performance & Referential Indexes for Queries, Filtering, and Comparisons
CREATE INDEX IF NOT EXISTS idx_proc_price_supplier ON procurement_price_history(supplier_id, effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_proc_price_item ON procurement_price_history(item_type, item_id, effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_proc_price_mat ON procurement_price_history(material_id) WHERE material_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proc_price_outsourced ON procurement_price_history(outsourced_service_id) WHERE outsourced_service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proc_price_subcontractor ON procurement_price_history(subcontractor_id) WHERE subcontractor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proc_price_project ON procurement_price_history(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proc_price_plan ON procurement_price_history(project_plan_id) WHERE project_plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proc_price_type ON procurement_price_history(price_type);
CREATE INDEX IF NOT EXISTS idx_proc_price_cost_stage ON procurement_price_history(cost_stage);
CREATE INDEX IF NOT EXISTS idx_proc_price_effective_date ON procurement_price_history(effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_proc_price_recorded_at ON procurement_price_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_proc_price_currency ON procurement_price_history(currency);

-- 3. Extend price_history_records additively for seamless backward compatibility
ALTER TABLE price_history_records ADD COLUMN IF NOT EXISTS supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL;
ALTER TABLE price_history_records ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE price_history_records ADD COLUMN IF NOT EXISTS price_type TEXT DEFAULT 'supplier_quotation';
ALTER TABLE price_history_records ADD COLUMN IF NOT EXISTS cost_stage TEXT DEFAULT 'quoted';
ALTER TABLE price_history_records ADD COLUMN IF NOT EXISTS quotation_ref TEXT;
ALTER TABLE price_history_records ADD COLUMN IF NOT EXISTS valid_from DATE;
ALTER TABLE price_history_records ADD COLUMN IF NOT EXISTS valid_until DATE;
ALTER TABLE price_history_records ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE price_history_records ADD COLUMN IF NOT EXISTS project_plan_id TEXT REFERENCES project_plans(id) ON DELETE SET NULL;
ALTER TABLE price_history_records ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'unit';
ALTER TABLE price_history_records ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE price_history_records ADD COLUMN IF NOT EXISTS is_confirmed_purchase BOOLEAN DEFAULT false;

-- 4. Extend project_plan_boq_items with price snapshot fields to isolate plan costs
ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL;
ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS price_history_id TEXT REFERENCES procurement_price_history(id) ON DELETE SET NULL;
ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS price_type TEXT DEFAULT 'supplier_quotation';
ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS cost_stage TEXT DEFAULT 'quoted';
ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS price_snapshot JSONB DEFAULT '{}'::jsonb;
