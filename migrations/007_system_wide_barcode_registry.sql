-- ============================================================================
-- Migration 007: System-Wide Barcode Registry & Uniqueness Constraints
-- ============================================================================

-- 1. Ensure barcode columns exist across all applicable business entities
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE outsourced_services ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE subcontractors ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE produce_items ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS barcode TEXT;

-- 2. Centralized Normalized Barcode Registry
-- Enforces absolute global uniqueness of all barcodes across the entire enterprise system
CREATE TABLE IF NOT EXISTS barcode_registry (
  barcode TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_code TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  category TEXT DEFAULT '',
  sub_category TEXT DEFAULT '',
  unit TEXT DEFAULT '',
  unit_cost NUMERIC(18, 4) DEFAULT 0,
  selling_rate NUMERIC(18, 4) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  is_cost_eligible BOOLEAN DEFAULT false,
  is_boq_eligible BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. High-Performance Lookup and Integrity Indexes
CREATE INDEX IF NOT EXISTS idx_barcode_reg_entity ON barcode_registry(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_barcode_reg_code ON barcode_registry(entity_code);
CREATE INDEX IF NOT EXISTS idx_barcode_reg_name ON barcode_registry(entity_name);
CREATE INDEX IF NOT EXISTS idx_barcode_reg_type ON barcode_registry(entity_type);
CREATE INDEX IF NOT EXISTS idx_barcode_reg_boq_eligible ON barcode_registry(is_boq_eligible);
CREATE INDEX IF NOT EXISTS idx_barcode_reg_cost_eligible ON barcode_registry(is_cost_eligible);

-- 4. PostgreSQL Unique Constraints on Entity Tables (where barcode is non-null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_materials_barcode_unique 
  ON materials(barcode) 
  WHERE barcode IS NOT NULL AND barcode != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_revenue_items_barcode_unique 
  ON revenue_items(barcode) 
  WHERE barcode IS NOT NULL AND barcode != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_overhead_items_barcode_unique 
  ON overhead_items(barcode) 
  WHERE barcode IS NOT NULL AND barcode != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_barcode_unique 
  ON suppliers(barcode) 
  WHERE barcode IS NOT NULL AND barcode != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_outsourced_barcode_unique 
  ON outsourced_services(barcode) 
  WHERE barcode IS NOT NULL AND barcode != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_subcontractors_barcode_unique 
  ON subcontractors(barcode) 
  WHERE barcode IS NOT NULL AND barcode != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_produce_items_barcode_unique 
  ON produce_items(barcode) 
  WHERE barcode IS NOT NULL AND barcode != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_barcode_unique 
  ON inventory(barcode) 
  WHERE barcode IS NOT NULL AND barcode != '';
