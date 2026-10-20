-- ============================================================================
-- Migration 010: Consistent Financial Calculation and Cost Control Engine (TASK 11)
-- ============================================================================
-- Adds missing financial columns, markup tracking, variance metrics,
-- and optimized indexes to project_plans and project_plan_cost_summaries.
-- Enforces PostgreSQL NUMERIC precision for all monetary metrics.
-- ============================================================================

-- 1. Ensure project_plans has full financial metric columns
ALTER TABLE project_plans ADD COLUMN IF NOT EXISTS direct_cost NUMERIC(18, 2) DEFAULT 0;
ALTER TABLE project_plans ADD COLUMN IF NOT EXISTS allocated_overhead NUMERIC(18, 2) DEFAULT 0;
ALTER TABLE project_plans ADD COLUMN IF NOT EXISTS total_planned_cost NUMERIC(18, 2) DEFAULT 0;
ALTER TABLE project_plans ADD COLUMN IF NOT EXISTS gross_profit NUMERIC(18, 2) DEFAULT 0;
ALTER TABLE project_plans ADD COLUMN IF NOT EXISTS gross_margin_pct NUMERIC(8, 2) DEFAULT 0;
ALTER TABLE project_plans ADD COLUMN IF NOT EXISTS planned_profit NUMERIC(18, 2) DEFAULT 0;
ALTER TABLE project_plans ADD COLUMN IF NOT EXISTS profit_margin_pct NUMERIC(8, 2) DEFAULT 0;
ALTER TABLE project_plans ADD COLUMN IF NOT EXISTS markup_pct NUMERIC(8, 2) DEFAULT 0;
ALTER TABLE project_plans ADD COLUMN IF NOT EXISTS direct_cost_markup_pct NUMERIC(8, 2) DEFAULT 0;

-- 2. Ensure project_plan_cost_summaries has markup, variance, and actuals columns
ALTER TABLE project_plan_cost_summaries ADD COLUMN IF NOT EXISTS markup_pct NUMERIC(8, 2) DEFAULT 0;
ALTER TABLE project_plan_cost_summaries ADD COLUMN IF NOT EXISTS direct_cost_markup_pct NUMERIC(8, 2) DEFAULT 0;
ALTER TABLE project_plan_cost_summaries ADD COLUMN IF NOT EXISTS total_budget NUMERIC(18, 2) DEFAULT 0;
ALTER TABLE project_plan_cost_summaries ADD COLUMN IF NOT EXISTS budget_variance NUMERIC(18, 2) DEFAULT 0;
ALTER TABLE project_plan_cost_summaries ADD COLUMN IF NOT EXISTS budget_variance_pct NUMERIC(8, 2) DEFAULT 0;
ALTER TABLE project_plan_cost_summaries ADD COLUMN IF NOT EXISTS actual_cost NUMERIC(18, 2) DEFAULT 0;
ALTER TABLE project_plan_cost_summaries ADD COLUMN IF NOT EXISTS remaining_budget NUMERIC(18, 2) DEFAULT 0;

-- 3. Optimized financial relationship indexes
CREATE INDEX IF NOT EXISTS idx_plan_boq_items_financial ON project_plan_boq_items(plan_id, item_type, total_cost, total_revenue);
CREATE INDEX IF NOT EXISTS idx_plan_resources_financial ON project_plan_resources(plan_id, resource_type, total_cost);
CREATE INDEX IF NOT EXISTS idx_plan_overhead_alloc_financial ON plan_overhead_allocations(plan_id, allocated_amount);
CREATE INDEX IF NOT EXISTS idx_project_plan_overhead_alloc_financial ON project_plan_overhead_allocations(plan_id, allocated_amount);
CREATE INDEX IF NOT EXISTS idx_project_plans_financial_metrics ON project_plans(project_id, planned_revenue, total_planned_cost, profit_margin_pct);
