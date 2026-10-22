-- ============================================================================
-- Migration 012: Material Vendor Quotes, Price Change Matrix & Archive Deletion System
-- Target Database: inno_cost (PostgreSQL / PGlite)
-- ============================================================================
-- Establishes fully relational tables for:
-- 1. material_vendor_quotes: multi-supplier quotation matrix linked to materials
-- 2. material_vendor_price_history: detailed historical price revisions & volume tiers
-- 3. vendor_deletion_archives: regulatory compliance audit store requiring downloaded
--    price history archive before allowing vendor deletion
-- ============================================================================

-- 1. Main material_vendor_quotes table
CREATE TABLE IF NOT EXISTS material_vendor_quotes (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  vendor_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  vendor_name TEXT NOT NULL,
  vendor_part_number TEXT DEFAULT '',
  country TEXT DEFAULT 'United States',
  current_price NUMERIC(18, 4) NOT NULL CHECK (current_price >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  lead_time_days INT DEFAULT 7,
  moq NUMERIC(18, 4) DEFAULT 1 CHECK (moq >= 0),
  is_preferred BOOLEAN NOT NULL DEFAULT false,
  last_quoted_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (
    status IN ('Active', 'Preferred', 'Secondary', 'Best Price', 'Under Review', 'Archived')
  ),
  contact_email TEXT DEFAULT '',
  contact_phone TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  volume_pricing JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Material vendor price history table (capturing revisions, discount rates & range sizes)
CREATE TABLE IF NOT EXISTS material_vendor_price_history (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES material_vendor_quotes(id) ON DELETE CASCADE,
  material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  vendor_id TEXT,
  vendor_name TEXT NOT NULL,
  revision_date DATE NOT NULL DEFAULT CURRENT_DATE,
  price NUMERIC(18, 4) NOT NULL CHECK (price >= 0),
  previous_price NUMERIC(18, 4),
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

-- 3. Vendor deletion archives table for regulatory download compliance
CREATE TABLE IF NOT EXISTS vendor_deletion_archives (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL,
  material_code TEXT DEFAULT '',
  material_name TEXT DEFAULT '',
  vendor_id TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  history_count INT NOT NULL DEFAULT 0,
  archived_filename TEXT NOT NULL,
  archive_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  actor_email TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. High performance query indexes
CREATE INDEX IF NOT EXISTS idx_mat_vendor_quotes_mat ON material_vendor_quotes(material_id);
CREATE INDEX IF NOT EXISTS idx_mat_vendor_quotes_vendor ON material_vendor_quotes(vendor_id);
CREATE INDEX IF NOT EXISTS idx_mat_vendor_quotes_pref ON material_vendor_quotes(material_id, is_preferred);
CREATE INDEX IF NOT EXISTS idx_mat_vendor_hist_quote ON material_vendor_price_history(quote_id, revision_date DESC);
CREATE INDEX IF NOT EXISTS idx_mat_vendor_hist_mat ON material_vendor_price_history(material_id, revision_date DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_del_arch_mat ON vendor_deletion_archives(material_id, archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_del_arch_vendor ON vendor_deletion_archives(vendor_id, archived_at DESC);
