-- ============================================================================
-- Migration 014: Dedicated Competitor Table & Rate Benchmark Comparison System
-- Target Database: inno_cost (PostgreSQL / PGlite)
-- ============================================================================
-- 1. competitor: Tracks competitor name, product/service association, pricing, and timestamps
-- 2. Indexes for rapid lookups and catalogue side-by-side joins
-- 3. Realistic benchmark seed data across manufactured products and revenue services
-- ============================================================================

CREATE TABLE IF NOT EXISTS competitor (
  id TEXT PRIMARY KEY,
  competitor_name TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_code TEXT DEFAULT '',
  item_name TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'product' CHECK (item_type IN ('product', 'service', 'produce', 'revenue_item')),
  product_service_association TEXT DEFAULT '',
  pricing NUMERIC(18, 4) NOT NULL CHECK (pricing >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  our_price NUMERIC(18, 4) DEFAULT 0,
  price_delta NUMERIC(18, 4) DEFAULT 0,
  spread_pct NUMERIC(10, 2) DEFAULT 0,
  market_tier TEXT DEFAULT 'Primary Competitor',
  notes TEXT DEFAULT '',
  quoted_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing for fast side-by-side matrix lookups
CREATE INDEX IF NOT EXISTS idx_competitor_name ON competitor(competitor_name);
CREATE INDEX IF NOT EXISTS idx_competitor_item_id ON competitor(item_id);
CREATE INDEX IF NOT EXISTS idx_competitor_item_type ON competitor(item_type);
CREATE INDEX IF NOT EXISTS idx_competitor_created_at ON competitor(created_at DESC);

-- Seed initial competitor benchmarks for revenue items and produce items
INSERT INTO competitor (
  id, competitor_name, item_id, item_code, item_name, item_type,
  product_service_association, pricing, currency, our_price, price_delta, spread_pct,
  market_tier, notes, quoted_at, created_at, updated_at
) VALUES
  -- REV-SRV-001: FEA Structural Stress Analysis & Design Review (Our Price: $185/hr)
  ('comp-seed-01', 'Apex Industrial Dynamics', 'rev-srv-01', 'REV-SRV-001', 'FEA Structural Stress Analysis & Design Review', 'service', 'REV-SRV-001 • FEA Structural Stress Analysis', 195.00, 'USD', 185.00, 10.00, 5.41, 'Market Leader', 'Quoted for ASME Section VIII certified simulation', CURRENT_DATE, NOW(), NOW()),
  ('comp-seed-02', 'Global Core Systems Ltd', 'rev-srv-01', 'REV-SRV-001', 'FEA Structural Stress Analysis & Design Review', 'service', 'REV-SRV-001 • FEA Structural Stress Analysis', 210.00, 'USD', 185.00, 25.00, 13.51, 'Premium Rival', 'European engineering rates with Eurocode validation', CURRENT_DATE, NOW(), NOW()),
  ('comp-seed-03', 'Benchmark Industry Average', 'rev-srv-01', 'REV-SRV-001', 'FEA Structural Stress Analysis & Design Review', 'service', 'REV-SRV-001 • FEA Structural Stress Analysis', 190.00, 'USD', 185.00, 5.00, 2.70, 'Market Benchmark', 'Aggregated median engineering consultancy rate', CURRENT_DATE, NOW(), NOW()),

  -- REV-SRV-002: On-Site CMM Laser Calibration & Metrology (Our Price: $2,400/day)
  ('comp-seed-04', 'Apex Industrial Dynamics', 'rev-srv-02', 'REV-SRV-002', 'On-Site CMM Laser Calibration & Metrology', 'service', 'REV-SRV-002 • On-Site CMM Laser Calibration', 2550.00, 'USD', 2400.00, 150.00, 6.25, 'Market Leader', 'Field technician daily metrology day-rate', CURRENT_DATE, NOW(), NOW()),
  ('comp-seed-05', 'Vanguard Precision Tech', 'rev-srv-02', 'REV-SRV-002', 'On-Site CMM Laser Calibration & Metrology', 'service', 'REV-SRV-002 • On-Site CMM Laser Calibration', 2280.00, 'USD', 2400.00, -120.00, -5.00, 'Low-Cost Challenger', 'Rapid field calibration service without ISO certificate', CURRENT_DATE, NOW(), NOW()),

  -- REV-SRV-003: Turnkey Robotic Cell Commissioning & FAT (Our Price: $18,500/project)
  ('comp-seed-06', 'Apex Industrial Dynamics', 'rev-srv-03', 'REV-SRV-003', 'Turnkey Robotic Cell Commissioning & FAT', 'service', 'REV-SRV-003 • Turnkey Robotic Cell Commissioning', 19800.00, 'USD', 18500.00, 1300.00, 7.03, 'Primary Competitor', 'Standard robotic cell FAT and pilot signoff', CURRENT_DATE, NOW(), NOW()),
  ('comp-seed-07', 'Benchmark Industry Average', 'rev-srv-03', 'REV-SRV-003', 'Turnkey Robotic Cell Commissioning & FAT', 'service', 'REV-SRV-003 • Turnkey Robotic Cell Commissioning', 19000.00, 'USD', 18500.00, 500.00, 2.70, 'Market Benchmark', 'Median turnkey automation commissioning quote', CURRENT_DATE, NOW(), NOW()),

  -- REV-SRV-004: AS9100 / ISO Quality Audit & Compliance Support (Our Price: $220/hr)
  ('comp-seed-08', 'Global Core Systems Ltd', 'rev-srv-04', 'REV-SRV-004', 'AS9100 / ISO Quality Audit & Compliance Support', 'service', 'REV-SRV-004 • AS9100 / ISO Quality Audit', 240.00, 'USD', 220.00, 20.00, 9.09, 'Premium Rival', 'Accredited lead auditor hourly rate', CURRENT_DATE, NOW(), NOW()),
  ('comp-seed-09', 'Apex Industrial Dynamics', 'rev-srv-04', 'REV-SRV-004', 'AS9100 / ISO Quality Audit & Compliance Support', 'service', 'REV-SRV-004 • AS9100 / ISO Quality Audit', 230.00, 'USD', 220.00, 10.00, 4.55, 'Market Leader', 'Domestic compliance audit hourly rate', CURRENT_DATE, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
