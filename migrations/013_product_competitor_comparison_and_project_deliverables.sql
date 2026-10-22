-- ============================================================================
-- Migration 013: Product Competitor Comparison Matrix & Project Deliverables System
-- Target Database: inno_cost (PostgreSQL / PGlite)
-- ============================================================================
-- 1. competitors: Master catalog of industry competitors and benchmark providers
-- 2. product_competitor_quotes: Competitor quotation matrix connected to revenue products & services
-- 3. product_competitor_price_history: Historical price revisions, tier variations and market tracking
-- 4. project_deliverables: Relational project deliverables directly linked to revenue items & produce catalog
-- ============================================================================

-- 1. Master Competitor Registry Table
CREATE TABLE IF NOT EXISTS competitors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  country TEXT DEFAULT 'United States',
  market_tier TEXT DEFAULT 'Market Benchmark' CHECK (
    market_tier IN ('Market Leader', 'Primary Competitor', 'Market Benchmark', 'Low-Cost Challenger', 'Premium Rival', 'Regional Specialist')
  ),
  contact_person TEXT DEFAULT '',
  email TEXT DEFAULT '',
  website TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default industry benchmarks if competitors table is empty
INSERT INTO competitors (id, name, code, country, market_tier, notes)
VALUES
  ('comp-01', 'Apex Industrial Dynamics', 'COMP-APEX', 'United States', 'Market Leader', 'Primary domestic competitor across automation and architectural lines.'),
  ('comp-02', 'Global Core Systems Ltd', 'COMP-GLOBAL', 'Germany', 'Premium Rival', 'High-end European precision engineering alternative.'),
  ('comp-03', 'Benchmark Industry Average', 'COMP-BENCH', 'Global', 'Market Benchmark', 'Aggregated median market reference rate.'),
  ('comp-04', 'Vanguard Precision Tech', 'COMP-VANG', 'Singapore', 'Low-Cost Challenger', 'Asian Pacific fast-turn competitive rates.')
ON CONFLICT (id) DO NOTHING;

-- 2. Product and Revenue Service Competitor Quotes Matrix
CREATE TABLE IF NOT EXISTS product_competitor_quotes (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'product' CHECK (item_type IN ('product', 'service', 'produce', 'revenue_item')),
  item_code TEXT DEFAULT '',
  item_name TEXT NOT NULL,
  competitor_id TEXT REFERENCES competitors(id) ON DELETE SET NULL,
  competitor_name TEXT NOT NULL,
  current_price NUMERIC(18, 4) NOT NULL CHECK (current_price >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  our_price NUMERIC(18, 4) NOT NULL DEFAULT 0,
  price_delta NUMERIC(18, 4) DEFAULT 0,
  spread_pct NUMERIC(10, 2) DEFAULT 0,
  moq NUMERIC(18, 4) DEFAULT 1 CHECK (moq >= 0),
  lead_time_days INT DEFAULT 7,
  is_benchmark BOOLEAN NOT NULL DEFAULT false,
  last_quoted_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (
    status IN ('Active', 'Primary Competitor', 'Benchmark', 'Low Cost', 'Premium Rival', 'Archived')
  ),
  contact_email TEXT DEFAULT '',
  contact_phone TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  volume_pricing JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Product Competitor Price History Table (Capturing revisions, discount rates & range sizes)
CREATE TABLE IF NOT EXISTS product_competitor_price_history (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES product_competitor_quotes(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'product',
  competitor_id TEXT,
  competitor_name TEXT NOT NULL,
  revision_date DATE NOT NULL DEFAULT CURRENT_DATE,
  price NUMERIC(18, 4) NOT NULL CHECK (price >= 0),
  previous_price NUMERIC(18, 4),
  our_price NUMERIC(18, 4),
  change_pct NUMERIC(10, 2) DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  quote_ref TEXT DEFAULT '',
  moq NUMERIC(18, 4) DEFAULT 1,
  lead_time_days INT DEFAULT 7,
  updated_by TEXT NOT NULL DEFAULT 'System User',
  target_tier_label TEXT DEFAULT '',
  changed_tiers JSONB DEFAULT '[]'::jsonb,
  tier_changes JSONB DEFAULT '[]'::jsonb,
  applied_changes_summary JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Project Deliverables Table (Relational link between projects and revenue items / produce)
CREATE TABLE IF NOT EXISTS project_deliverables (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  plan_id TEXT REFERENCES project_plans(id) ON DELETE SET NULL,
  revenue_item_id TEXT REFERENCES revenue_items(id) ON DELETE SET NULL,
  produce_item_id TEXT REFERENCES produce_items(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'product' CHECK (type IN ('product', 'service')),
  category TEXT DEFAULT '',
  sub_category TEXT DEFAULT '',
  quantity NUMERIC(18, 4) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'pcs',
  cost_price NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  quoted_price NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (quoted_price >= 0),
  total_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
  total_revenue NUMERIC(18, 2) NOT NULL DEFAULT 0,
  margin_pct NUMERIC(8, 2) NOT NULL DEFAULT 0,
  competitor_benchmark_price NUMERIC(18, 4) DEFAULT 0,
  competitor_name TEXT DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'Planned',
  lead_time_days INT DEFAULT 14,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Indexes for High Performance Queries
CREATE INDEX IF NOT EXISTS idx_competitors_name ON competitors(name);
CREATE INDEX IF NOT EXISTS idx_competitors_active ON competitors(is_active);
CREATE INDEX IF NOT EXISTS idx_prod_comp_quotes_item ON product_competitor_quotes(item_id);
CREATE INDEX IF NOT EXISTS idx_prod_comp_quotes_comp ON product_competitor_quotes(competitor_id);
CREATE INDEX IF NOT EXISTS idx_prod_comp_quotes_bench ON product_competitor_quotes(item_id, is_benchmark);
CREATE INDEX IF NOT EXISTS idx_prod_comp_hist_quote ON product_competitor_price_history(quote_id, revision_date DESC);
CREATE INDEX IF NOT EXISTS idx_prod_comp_hist_item ON product_competitor_price_history(item_id, revision_date DESC);
CREATE INDEX IF NOT EXISTS idx_proj_deliv_proj ON project_deliverables(project_id);
CREATE INDEX IF NOT EXISTS idx_proj_deliv_plan ON project_deliverables(plan_id);
CREATE INDEX IF NOT EXISTS idx_proj_deliv_rev_item ON project_deliverables(revenue_item_id);
CREATE INDEX IF NOT EXISTS idx_proj_deliv_prod_item ON project_deliverables(produce_item_id);

-- 6. Synchronized Deliverables Column on Projects Table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deliverables JSONB DEFAULT '[]'::jsonb;
