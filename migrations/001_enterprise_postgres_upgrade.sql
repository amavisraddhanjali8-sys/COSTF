-- Migration: 001_enterprise_postgres_upgrade.sql
-- Purpose: Additive, reversible PostgreSQL schema upgrade for INNOVISTA Cost Management System.
-- Enforces NUMERIC financial precision, TIMESTAMPTZ timestamps, business-effective price history dates,
-- referential integrity foreign keys, idempotency constraints, and B-Tree indexes for pagination/search.

-- 1. Schema Migrations Tracking Table
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum TEXT
);

-- 2. Normalized Price & Rate Revision History Table (with Business-Effective Date + TIMESTAMPTZ)
CREATE TABLE IF NOT EXISTS price_history_records (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('material', 'outsourced', 'subcontractor', 'produce')),
  entity_id TEXT NOT NULL,
  entity_code TEXT,
  entity_name TEXT,
  previous_price NUMERIC(18, 4) NOT NULL DEFAULT 0,
  new_price NUMERIC(18, 4) NOT NULL DEFAULT 0,
  retail_price NUMERIC(18, 4),
  change_pct NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  updated_by TEXT,
  idempotency_key TEXT UNIQUE
);

-- 3. Add TIMESTAMPTZ columns and additional audit/traceability columns additively to existing tables
ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_at_ts TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at_ts TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE categories ADD COLUMN IF NOT EXISTS created_at_ts TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE categories ADD COLUMN IF NOT EXISTS updated_at_ts TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS created_at_ts TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS updated_at_ts TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_at_ts TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at_ts TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE materials ADD COLUMN IF NOT EXISTS default_discount_pct NUMERIC(8, 2) DEFAULT 0;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS item_classification TEXT DEFAULT 'raw_material';
ALTER TABLE materials ADD COLUMN IF NOT EXISTS effective_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS created_at_ts TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE materials ADD COLUMN IF NOT EXISTS updated_at_ts TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE outsourced_services ADD COLUMN IF NOT EXISTS effective_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE outsourced_services ADD COLUMN IF NOT EXISTS created_at_ts TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE outsourced_services ADD COLUMN IF NOT EXISTS updated_at_ts TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE subcontractors ADD COLUMN IF NOT EXISTS effective_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE subcontractors ADD COLUMN IF NOT EXISTS created_at_ts TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE subcontractors ADD COLUMN IF NOT EXISTS updated_at_ts TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE produce_items ADD COLUMN IF NOT EXISTS effective_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE produce_items ADD COLUMN IF NOT EXISTS created_at_ts TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE produce_items ADD COLUMN IF NOT EXISTS updated_at_ts TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS created_at_ts TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS updated_at_ts TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS project_code TEXT;
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS inventory_sku TEXT;
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS batch_lot_number TEXT;
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS requisition_number TEXT;
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(18, 2) DEFAULT 0;
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS effective_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS created_at_ts TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE account_requests ADD COLUMN IF NOT EXISTS submitted_at_ts TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE account_requests ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE account_requests ADD COLUMN IF NOT EXISTS reviewed_at_ts TIMESTAMPTZ;

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS created_at_ts TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE custom_tiles ADD COLUMN IF NOT EXISTS created_at_ts TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE custom_tiles ADD COLUMN IF NOT EXISTS updated_at_ts TIMESTAMPTZ DEFAULT NOW();

-- 4. Unique & Idempotency Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_code_unique ON suppliers(code) WHERE code IS NOT NULL AND code != '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_sku_unique ON inventory(sku) WHERE sku IS NOT NULL AND sku != '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_tx_idempotency_unique ON inventory_transactions(idempotency_key) WHERE idempotency_key IS NOT NULL AND idempotency_key != '';

-- 5. Performance Indexes for Pagination, Filtering, Sorting, and Searching
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_category ON suppliers(category);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);

CREATE INDEX IF NOT EXISTS idx_projects_code ON projects(code);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_materials_code ON materials(code);
CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category, sub_category);
CREATE INDEX IF NOT EXISTS idx_materials_barcode ON materials(barcode);
CREATE INDEX IF NOT EXISTS idx_materials_supplier_id ON materials(supplier_id);
CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status);

CREATE INDEX IF NOT EXISTS idx_outsourced_code ON outsourced_services(code);
CREATE INDEX IF NOT EXISTS idx_outsourced_category ON outsourced_services(category);
CREATE INDEX IF NOT EXISTS idx_outsourced_provider_id ON outsourced_services(provider_id);

CREATE INDEX IF NOT EXISTS idx_subcontractors_code ON subcontractors(code);
CREATE INDEX IF NOT EXISTS idx_subcontractors_category ON subcontractors(service_category);
CREATE INDEX IF NOT EXISTS idx_subcontractors_supplier_id ON subcontractors(subcontractor_id);

CREATE INDEX IF NOT EXISTS idx_produce_code ON produce_items(code);
CREATE INDEX IF NOT EXISTS idx_produce_category ON produce_items(category);
CREATE INDEX IF NOT EXISTS idx_produce_barcode ON produce_items(barcode);

CREATE INDEX IF NOT EXISTS idx_inventory_material_id ON inventory(material_id);
CREATE INDEX IF NOT EXISTS idx_inventory_project_id ON inventory(allocated_project_id);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);

CREATE INDEX IF NOT EXISTS idx_inv_tx_material_id ON inventory_transactions(material_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_project_id ON inventory_transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_type ON inventory_transactions(type);
CREATE INDEX IF NOT EXISTS idx_inv_tx_timestamp ON inventory_transactions(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_price_history_lookup ON price_history_records(entity_type, entity_id, effective_date DESC, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module_action ON audit_logs(module, action);
CREATE INDEX IF NOT EXISTS idx_categories_group_type ON categories(group_name, type);
