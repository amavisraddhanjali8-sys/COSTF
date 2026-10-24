-- Migration 016: Enterprise Resources Portal (Labours, Machineries, Equipments, Tools)
-- Real PostgreSQL inno_cost persistence

CREATE TABLE IF NOT EXISTS enterprise_resources (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  sub_category TEXT,
  more_sub_category TEXT,
  unit TEXT NOT NULL DEFAULT 'hr',
  base_rate NUMERIC(18, 4) NOT NULL DEFAULT 0,
  operational_charge NUMERIC(18, 4) DEFAULT 0,
  charge_type TEXT DEFAULT 'hourly',
  currency TEXT NOT NULL DEFAULT 'USD',
  supplier_id TEXT,
  supplier_name TEXT,
  competitor_company TEXT,
  competitor_rate NUMERIC(18, 4) DEFAULT 0,
  industry_benchmark_rate NUMERIC(18, 4) DEFAULT 0,
  lead_time_days INT DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'Available',
  skill_or_sla TEXT,
  alternatives JSONB DEFAULT '[]',
  specifications JSONB DEFAULT '{}',
  connected_allocations JSONB DEFAULT '[]',
  notes TEXT DEFAULT '',
  effective_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_resources_type ON enterprise_resources(type);
CREATE INDEX IF NOT EXISTS idx_enterprise_resources_category ON enterprise_resources(category);
CREATE INDEX IF NOT EXISTS idx_enterprise_resources_code ON enterprise_resources(code);
