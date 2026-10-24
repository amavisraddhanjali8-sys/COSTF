-- Migration 018: Enhance competitor quotes and matrix schema for all resource categories and alternatives
ALTER TABLE product_competitor_quotes DROP CONSTRAINT IF EXISTS product_competitor_quotes_item_type_check;
ALTER TABLE product_competitor_quotes ADD CONSTRAINT product_competitor_quotes_item_type_check CHECK (
  item_type IN ('product', 'service', 'produce', 'revenue_item', 'resource', 'equipment', 'machinery', 'labour', 'tool', 'subcontractor', 'material', 'overhead')
);

ALTER TABLE product_competitor_quotes DROP CONSTRAINT IF EXISTS product_competitor_quotes_status_check;
ALTER TABLE product_competitor_quotes ADD CONSTRAINT product_competitor_quotes_status_check CHECK (
  status IN ('Active', 'Primary Competitor', 'Benchmark', 'Low Cost', 'Premium Rival', 'Archived', 'Alternative', 'Variable')
);

-- Drop foreign key so competitor_id can reference alternatives, custom rival profiles, or competitors without constraint failure
ALTER TABLE product_competitor_quotes DROP CONSTRAINT IF EXISTS product_competitor_quotes_competitor_id_fkey;

