-- ============================================================================
-- Migration 011: Strict Composite Foreign Keys, Referential Integrity & Performance Indexes
-- ============================================================================
-- Enforces that all plan-specific child entities (BOQ line items, revisions,
-- sections, overhead allocations, tariffs, cost summaries, and commercial rate history)
-- strictly reference both the exact plan_id AND its parent project_id via composite
-- foreign keys, guaranteeing zero possibility of parent-project mismatch.
-- ============================================================================

-- 1. Ensure composite unique constraint on project_plans(id, project_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_project_plans_id_project'
  ) THEN
    ALTER TABLE project_plans ADD CONSTRAINT uq_project_plans_id_project UNIQUE (id, project_id);
  END IF;
END $$;

-- 2. Composite Foreign Key on project_plan_boq_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_boq_items_plan_project_comp'
  ) THEN
    ALTER TABLE project_plan_boq_items 
      ADD CONSTRAINT fk_boq_items_plan_project_comp 
      FOREIGN KEY (plan_id, project_id) 
      REFERENCES project_plans(id, project_id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Composite Foreign Key on project_plan_revisions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_revisions_plan_project_comp'
  ) THEN
    ALTER TABLE project_plan_revisions 
      ADD CONSTRAINT fk_revisions_plan_project_comp 
      FOREIGN KEY (plan_id, project_id) 
      REFERENCES project_plans(id, project_id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- 4. Composite Foreign Key on project_plan_sections
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sections_plan_project_comp'
  ) THEN
    ALTER TABLE project_plan_sections 
      ADD CONSTRAINT fk_sections_plan_project_comp 
      FOREIGN KEY (plan_id, project_id) 
      REFERENCES project_plans(id, project_id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- 5. Composite Foreign Key on project_plan_overhead_allocations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_overhead_alloc_plan_project_comp'
  ) THEN
    ALTER TABLE project_plan_overhead_allocations 
      ADD CONSTRAINT fk_overhead_alloc_plan_project_comp 
      FOREIGN KEY (plan_id, project_id) 
      REFERENCES project_plans(id, project_id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- 6. Composite Foreign Key on plan_overhead_allocations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_plan_overhead_plan_project_comp'
  ) THEN
    ALTER TABLE plan_overhead_allocations 
      ADD CONSTRAINT fk_plan_overhead_plan_project_comp 
      FOREIGN KEY (plan_id, project_id) 
      REFERENCES project_plans(id, project_id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- 7. Composite Foreign Key on plan_tariffs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_plan_tariffs_plan_project_comp'
  ) THEN
    ALTER TABLE plan_tariffs 
      ADD CONSTRAINT fk_plan_tariffs_plan_project_comp 
      FOREIGN KEY (plan_id, project_id) 
      REFERENCES project_plans(id, project_id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- 8. Composite Foreign Key on project_plan_cost_summaries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cost_summaries_plan_project_comp'
  ) THEN
    ALTER TABLE project_plan_cost_summaries 
      ADD CONSTRAINT fk_cost_summaries_plan_project_comp 
      FOREIGN KEY (plan_id, project_id) 
      REFERENCES project_plans(id, project_id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- 9. Composite Foreign Key on revenue_rate_history
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_rev_rate_history_plan_project_comp'
  ) THEN
    ALTER TABLE revenue_rate_history 
      ADD CONSTRAINT fk_rev_rate_history_plan_project_comp 
      FOREIGN KEY (project_plan_id, project_id) 
      REFERENCES project_plans(id, project_id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- 10. Composite Indexes to prevent N+1 query bottlenecks and optimize filtered plan queries
CREATE INDEX IF NOT EXISTS idx_boq_items_plan_project_type ON project_plan_boq_items(plan_id, project_id, item_type);
CREATE INDEX IF NOT EXISTS idx_overhead_alloc_plan_project ON plan_overhead_allocations(plan_id, project_id);
CREATE INDEX IF NOT EXISTS idx_plan_tariffs_plan_project ON plan_tariffs(plan_id, project_id);
CREATE INDEX IF NOT EXISTS idx_plan_revisions_plan_project ON project_plan_revisions(plan_id, project_id, revision_number DESC);
CREATE INDEX IF NOT EXISTS idx_rev_rate_hist_plan_project ON revenue_rate_history(project_plan_id, project_id, recorded_at DESC);
