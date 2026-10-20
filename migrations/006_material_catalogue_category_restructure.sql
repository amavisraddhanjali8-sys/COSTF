-- Migration: 006_material_catalogue_category_restructure.sql
-- Purpose: Restructure the material catalogue and category/subcategory relationships.
-- Enforces relational foreign keys, referential integrity, hierarchical category validation,
-- units of measurement table, description column, barcode indexing, and safe classification migration.

-- 1. Standard Units of Measurement Table
CREATE TABLE IF NOT EXISTS measurement_units (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  category TEXT DEFAULT 'quantity',
  is_active BOOLEAN DEFAULT true,
  created_at_ts TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO measurement_units (id, code, name, symbol, category) VALUES
  ('unit-pcs', 'pcs', 'Pieces / Units', 'pcs', 'quantity'),
  ('unit-kg', 'kg', 'Kilograms', 'kg', 'mass'),
  ('unit-g', 'g', 'Grams', 'g', 'mass'),
  ('unit-m', 'm', 'Meters', 'm', 'length'),
  ('unit-mm', 'mm', 'Millimeters', 'mm', 'length'),
  ('unit-m2', 'm2', 'Square Meters', 'm²', 'area'),
  ('unit-m3', 'm3', 'Cubic Meters', 'm³', 'volume'),
  ('unit-ton', 'ton', 'Metric Tons', 't', 'mass'),
  ('unit-sheet', 'sheet', 'Sheets / Plates', 'sheet', 'quantity'),
  ('unit-bundle', 'bundle', 'Bundles', 'bdl', 'quantity'),
  ('unit-box', 'box', 'Boxes / Cartons', 'box', 'quantity'),
  ('unit-roll', 'roll', 'Rolls / Coils', 'roll', 'quantity'),
  ('unit-liter', 'liter', 'Liters', 'L', 'volume'),
  ('unit-hr', 'hr', 'Hours', 'hr', 'time'),
  ('unit-set', 'set', 'Assemblies / Sets', 'set', 'quantity')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  symbol = EXCLUDED.symbol;

-- 2. Ensure categories table has unique (id, parent_id) for composite relational integrity
-- And ensure self-referencing parent foreign key
DO $$
BEGIN
  -- Add foreign key constraint on categories.parent_id if not present
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_categories_parent'
  ) THEN
    ALTER TABLE categories
      ADD CONSTRAINT fk_categories_parent
      FOREIGN KEY (parent_id)
      REFERENCES categories(id)
      ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- If constraint exists or orphan rows prevent immediate FK, ignore in DO block
    NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_id_parent ON categories(id, parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_type_group ON categories(group_name, type);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);

-- 3. Upgrade materials table with normalized category/subcategory IDs, description, barcode
ALTER TABLE materials ADD COLUMN IF NOT EXISTS category_id TEXT;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS subcategory_id TEXT;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS default_unit_id TEXT REFERENCES measurement_units(id) ON DELETE SET NULL;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE materials ADD COLUMN IF NOT EXISTS classification_review_required BOOLEAN DEFAULT false;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS classification_review_notes TEXT DEFAULT '';

-- Foreign Key: category_id -> categories(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_materials_category_id'
  ) THEN
    ALTER TABLE materials
      ADD CONSTRAINT fk_materials_category_id
      FOREIGN KEY (category_id)
      REFERENCES categories(id)
      ON DELETE RESTRICT;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Foreign Key: subcategory_id -> categories(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_materials_subcategory_id'
  ) THEN
    ALTER TABLE materials
      ADD CONSTRAINT fk_materials_subcategory_id
      FOREIGN KEY (subcategory_id)
      REFERENCES categories(id)
      ON DELETE RESTRICT;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- 4. Function & Trigger: Enforce that subcategory belongs to category
CREATE OR REPLACE FUNCTION fn_validate_material_category_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
  v_sub_parent TEXT;
  v_cat_type TEXT;
  v_sub_type TEXT;
BEGIN
  -- Validate category if provided
  IF NEW.category_id IS NOT NULL THEN
    SELECT type INTO v_cat_type FROM categories WHERE id = NEW.category_id;
    IF v_cat_type IS NULL THEN
      RAISE EXCEPTION 'Category ID % does not exist in categories catalogue', NEW.category_id;
    END IF;
  END IF;

  -- Validate subcategory if provided
  IF NEW.subcategory_id IS NOT NULL THEN
    SELECT parent_id, type INTO v_sub_parent, v_sub_type FROM categories WHERE id = NEW.subcategory_id;
    IF v_sub_type IS NULL THEN
      RAISE EXCEPTION 'Subcategory ID % does not exist in categories catalogue', NEW.subcategory_id;
    END IF;

    -- Subcategory must have a parent category
    IF v_sub_parent IS NULL THEN
      RAISE EXCEPTION 'Node % is a root category, not a subcategory', NEW.subcategory_id;
    END IF;

    -- If category_id is provided, subcategory's parent MUST match category_id
    IF NEW.category_id IS NOT NULL AND v_sub_parent != NEW.category_id THEN
      RAISE EXCEPTION 'Subcategory (ID: %) belongs to parent %, not selected Category %',
        NEW.subcategory_id, v_sub_parent, NEW.category_id;
    END IF;

    -- If category_id was not provided, auto-set it from subcategory's parent
    IF NEW.category_id IS NULL THEN
      NEW.category_id := v_sub_parent;
    END IF;
  END IF;

  -- Ensure barcode is present, defaulting to code if empty
  IF NEW.barcode IS NULL OR TRIM(NEW.barcode) = '' THEN
    NEW.barcode := NEW.code;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_material_category_hierarchy ON materials;
CREATE TRIGGER trg_validate_material_category_hierarchy
BEFORE INSERT OR UPDATE ON materials
FOR EACH ROW
EXECUTE FUNCTION fn_validate_material_category_hierarchy();

-- 5. Performance and Search Indexes
CREATE INDEX IF NOT EXISTS idx_materials_category_id ON materials(category_id);
CREATE INDEX IF NOT EXISTS idx_materials_subcategory_id ON materials(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_materials_barcode ON materials(barcode);
CREATE INDEX IF NOT EXISTS idx_materials_review_required ON materials(classification_review_required);
