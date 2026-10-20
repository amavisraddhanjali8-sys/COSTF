-- ============================================================================
-- Migration 008: Structured Audit Logging & Enterprise Tariff Management System
-- Target Database: inno_cost (PostgreSQL / PGlite)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PART A: AUDIT LOGGING EXTENSIONS & PROTECTION
-- ----------------------------------------------------------------------------

-- 1. Extend audit_logs table with entity, project, plan, request, and state tracking
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action_type TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS plan_id TEXT REFERENCES project_plans(id) ON DELETE SET NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_id TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS correlation_id TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS change_reason TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS before_state JSONB DEFAULT NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS after_state JSONB DEFAULT NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS diff JSONB DEFAULT NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Backfill action_type and entity_id where empty
UPDATE audit_logs SET action_type = action WHERE action_type IS NULL;
UPDATE audit_logs SET entity_id = record_id WHERE entity_id IS NULL AND record_id IS NOT NULL;
UPDATE audit_logs SET entity_type = module WHERE entity_type IS NULL AND module IS NOT NULL;

-- 2. Performance & Search Indexes on audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_ts ON audit_logs(created_at_ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_project_id ON audit_logs(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_plan_id ON audit_logs(plan_id) WHERE plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON audit_logs(request_id) WHERE request_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- PART B: ENTERPRISE TARIFF MANAGEMENT SYSTEM
-- ----------------------------------------------------------------------------

-- 3. Tariffs Master Catalogue
CREATE TABLE IF NOT EXISTS tariffs (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  calculation_method TEXT NOT NULL DEFAULT 'percentage' CHECK (
    calculation_method IN ('percentage', 'unit_rate', 'fixed_charge', 'tiered_volume', 'hybrid')
  ),
  rate_or_percentage NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (rate_or_percentage >= 0),
  fixed_charge NUMERIC(18, 4) DEFAULT 0 CHECK (fixed_charge >= 0),
  unit TEXT NOT NULL DEFAULT 'unit',
  applicable_base TEXT NOT NULL DEFAULT 'material_cost' CHECK (
    applicable_base IN ('material_cost', 'labour_cost', 'outsourced_cost', 'total_direct_cost', 'total_revenue', 'quantity', 'fixed')
  ),
  currency TEXT NOT NULL DEFAULT 'USD',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Archived', 'Pending')),
  source_reference TEXT DEFAULT '',
  description TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_by TEXT NOT NULL DEFAULT 'System User',
  updated_by TEXT NOT NULL DEFAULT 'System User',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Historical Tariff Versions
CREATE TABLE IF NOT EXISTS tariff_versions (
  id TEXT PRIMARY KEY,
  tariff_id TEXT NOT NULL REFERENCES tariffs(id) ON DELETE CASCADE,
  tariff_code TEXT NOT NULL,
  version_number INT NOT NULL DEFAULT 1,
  rate_or_percentage NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (rate_or_percentage >= 0),
  fixed_charge NUMERIC(18, 4) DEFAULT 0 CHECK (fixed_charge >= 0),
  calculation_method TEXT NOT NULL DEFAULT 'percentage' CHECK (
    calculation_method IN ('percentage', 'unit_rate', 'fixed_charge', 'tiered_volume', 'hybrid')
  ),
  applicable_base TEXT NOT NULL DEFAULT 'material_cost' CHECK (
    applicable_base IN ('material_cost', 'labour_cost', 'outsourced_cost', 'total_direct_cost', 'total_revenue', 'quantity', 'fixed')
  ),
  unit TEXT NOT NULL DEFAULT 'unit',
  currency TEXT NOT NULL DEFAULT 'USD',
  effective_from DATE NOT NULL,
  effective_to DATE,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Superseded', 'Draft', 'Archived')),
  source_reference TEXT DEFAULT '',
  change_reason TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_by TEXT NOT NULL DEFAULT 'System User',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tariff_version UNIQUE (tariff_id, version_number)
);

-- 5. Tariffs Applied to Project Plans
CREATE TABLE IF NOT EXISTS plan_tariffs (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tariff_id TEXT NOT NULL REFERENCES tariffs(id) ON DELETE RESTRICT,
  tariff_version_id TEXT NOT NULL REFERENCES tariff_versions(id) ON DELETE RESTRICT,
  tariff_code TEXT NOT NULL,
  tariff_name TEXT NOT NULL,
  tariff_category TEXT NOT NULL,
  calculation_method TEXT NOT NULL,
  applicable_base TEXT NOT NULL,
  rate_or_percentage NUMERIC(18, 4) NOT NULL,
  fixed_charge NUMERIC(18, 4) DEFAULT 0,
  unit TEXT DEFAULT 'unit',
  currency TEXT NOT NULL DEFAULT 'USD',
  effective_from DATE NOT NULL,
  effective_to DATE,
  base_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  calculated_tariff_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  applied_date DATE NOT NULL DEFAULT CURRENT_DATE,
  applied_by TEXT NOT NULL DEFAULT 'System User',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Tariff Indexes for Fast Resolution, Filtering & History
CREATE INDEX IF NOT EXISTS idx_tariffs_code ON tariffs(code);
CREATE INDEX IF NOT EXISTS idx_tariffs_category ON tariffs(category);
CREATE INDEX IF NOT EXISTS idx_tariffs_status ON tariffs(status);
CREATE INDEX IF NOT EXISTS idx_tariffs_effective ON tariffs(effective_from, effective_to);

CREATE INDEX IF NOT EXISTS idx_tariff_ver_tariff_id ON tariff_versions(tariff_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_tariff_ver_lookup ON tariff_versions(tariff_id, effective_from, effective_to, status);
CREATE INDEX IF NOT EXISTS idx_tariff_ver_status ON tariff_versions(status);

CREATE INDEX IF NOT EXISTS idx_plan_tariffs_plan ON plan_tariffs(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_tariffs_project ON plan_tariffs(project_id);
CREATE INDEX IF NOT EXISTS idx_plan_tariffs_tariff ON plan_tariffs(tariff_id);
CREATE INDEX IF NOT EXISTS idx_plan_tariffs_version ON plan_tariffs(tariff_version_id);

-- 7. Seed Initial Enterprise Tariffs and Version Records
INSERT INTO tariffs (
  id, code, name, category, calculation_method, rate_or_percentage, fixed_charge,
  unit, applicable_base, currency, effective_from, effective_to, status,
  source_reference, description, created_by, updated_by
) VALUES
  (
    'trf-anod-01',
    'TRF-ANOD-01',
    'MIL-A-8625 Type III Hardcoat Anodizing Tariff',
    'Surface Finishing',
    'unit_rate',
    65.0000,
    150.0000,
    'pcs',
    'quantity',
    'USD',
    '2026-01-01',
    NULL,
    'Active',
    'Master Finishing Agreement 2026-V1',
    'Industrial hardcoat surface treatment tariff with batch handling fee.',
    'System Initializer',
    'System Initializer'
  ),
  (
    'trf-steel-duty',
    'TRF-STEEL-DUTY',
    'Structural Aerospace Alloy Import Customs Duty',
    'Statutory & Customs',
    'percentage',
    12.5000,
    0,
    '%',
    'material_cost',
    'USD',
    '2026-01-01',
    NULL,
    'Active',
    'National Customs Tariff Gazette Ref 2026/04',
    'Statutory customs tariff applied to imported billets and alloy sheets.',
    'System Initializer',
    'System Initializer'
  ),
  (
    'trf-ndt-insp',
    'TRF-NDT-INSP',
    'Aerospace Level III Ultrasonic & Dye-Penetrant NDT Tariff',
    'Quality & Inspection',
    'unit_rate',
    145.0000,
    200.0000,
    'run',
    'quantity',
    'USD',
    '2026-01-01',
    NULL,
    'Active',
    'NADCAP Accredited Inspection Tariff Schedule',
    'Certified non-destructive testing tariff for critical flight components.',
    'System Initializer',
    'System Initializer'
  ),
  (
    'trf-lab-crane',
    'TRF-LAB-CRANE',
    'Specialized Heavy Rigging & Mobile Crane Operator Tariff',
    'Labour & Trades',
    'unit_rate',
    95.0000,
    350.0000,
    'hr',
    'quantity',
    'USD',
    '2026-01-01',
    NULL,
    'Active',
    'Master Trade Union Tariff Schedule 2026',
    'Tier 1 certified heavy rigging crew and crane operator tariff.',
    'System Initializer',
    'System Initializer'
  ),
  (
    'trf-env-surch',
    'TRF-ENV-SURCH',
    'Hazardous Chemical Treatment & Environmental Surcharge',
    'Statutory & Customs',
    'percentage',
    3.0000,
    0,
    '%',
    'total_direct_cost',
    'USD',
    '2026-01-01',
    NULL,
    'Active',
    'EPA Compliance Directive Standard 2026',
    'Environmental remediation and hazardous materials handling tariff.',
    'System Initializer',
    'System Initializer'
  )
ON CONFLICT (id) DO NOTHING;

-- Seed Corresponding Tariff Version 1 Records
INSERT INTO tariff_versions (
  id, tariff_id, tariff_code, version_number, rate_or_percentage, fixed_charge,
  calculation_method, applicable_base, unit, currency, effective_from, effective_to,
  status, source_reference, change_reason, notes, created_by
) VALUES
  (
    'trfv-anod-01-v1',
    'trf-anod-01',
    'TRF-ANOD-01',
    1,
    65.0000,
    150.0000,
    'unit_rate',
    'quantity',
    'pcs',
    'USD',
    '2026-01-01',
    NULL,
    'Active',
    'Master Finishing Agreement 2026-V1',
    'Initial active baseline tariff schedule',
    'Applicable to all hardcoat anodizing contracts',
    'System Initializer'
  ),
  (
    'trfv-steel-duty-v1',
    'trf-steel-duty',
    'TRF-STEEL-DUTY',
    1,
    12.5000,
    0,
    'percentage',
    'material_cost',
    '%',
    'USD',
    '2026-01-01',
    NULL,
    'Active',
    'National Customs Tariff Gazette Ref 2026/04',
    'Initial statutory baseline rate',
    'Applied to raw aerospace alloys',
    'System Initializer'
  ),
  (
    'trfv-ndt-insp-v1',
    'trf-ndt-insp',
    'TRF-NDT-INSP',
    1,
    145.0000,
    200.0000,
    'unit_rate',
    'quantity',
    'run',
    'USD',
    '2026-01-01',
    NULL,
    'Active',
    'NADCAP Accredited Inspection Tariff Schedule',
    'Initial certified NDT rate schedule',
    'Includes calibration and baseline report',
    'System Initializer'
  ),
  (
    'trfv-lab-crane-v1',
    'trf-lab-crane',
    'TRF-LAB-CRANE',
    1,
    95.0000,
    350.0000,
    'unit_rate',
    'quantity',
    'hr',
    'USD',
    '2026-01-01',
    NULL,
    'Active',
    'Master Trade Union Tariff Schedule 2026',
    'Initial mobile crane tariff',
    'Minimum 4-hour mobilization charge applies',
    'System Initializer'
  ),
  (
    'trfv-env-surch-v1',
    'trf-env-surch',
    'TRF-ENV-SURCH',
    1,
    3.0000,
    0,
    'percentage',
    'total_direct_cost',
    '%',
    'USD',
    '2026-01-01',
    NULL,
    'Active',
    'EPA Compliance Directive Standard 2026',
    'Initial environmental levy rate',
    'Covers disposal and filtration',
    'System Initializer'
  )
ON CONFLICT (tariff_id, version_number) DO NOTHING;
