-- ============================================================================
-- Migration 019: Dedicated Project Plan Cost Controls System
-- Target Database: inno_cost (PostgreSQL / PGlite)
-- ============================================================================
-- Stores comprehensive cost control targets, category budget ceilings,
-- cost stages, line freeze locks, escalation restrictions, and savings commitments
-- for each unique project plan.
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_plan_cost_controls (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE UNIQUE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  budget_ceiling NUMERIC(18, 2) DEFAULT 0,
  target_cost NUMERIC(18, 2) DEFAULT 0,
  material_cost_cap NUMERIC(18, 2) DEFAULT 0,
  labor_cost_cap NUMERIC(18, 2) DEFAULT 0,
  equipment_cost_cap NUMERIC(18, 2) DEFAULT 0,
  subcontractor_cost_cap NUMERIC(18, 2) DEFAULT 0,
  overhead_cost_cap NUMERIC(18, 2) DEFAULT 0,
  contingency_cap NUMERIC(18, 2) DEFAULT 0,
  cost_status TEXT DEFAULT 'Active' CHECK (cost_status IN ('Active', 'Under Review', 'Cost Frozen', 'Locked', 'Approved')),
  cost_stage TEXT DEFAULT 'Budget' CHECK (cost_stage IN ('Preliminary', 'Target', 'Budget', 'Committed', 'Actual')),
  freeze_cost_lines BOOLEAN DEFAULT false,
  escalation_lock BOOLEAN DEFAULT false,
  target_margin_pct NUMERIC(8, 2) DEFAULT 25.0,
  overhead_pct NUMERIC(8, 2) DEFAULT 8.5,
  contingency_pct NUMERIC(8, 2) DEFAULT 5.0,
  labor_burden_pct NUMERIC(8, 2) DEFAULT 0.0,
  committed_savings NUMERIC(18, 2) DEFAULT 0,
  cost_notes TEXT DEFAULT '',
  item_controls JSONB DEFAULT '[]'::jsonb,
  audit_trail JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_cost_controls_plan ON project_plan_cost_controls(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_cost_controls_project ON project_plan_cost_controls(project_id);
