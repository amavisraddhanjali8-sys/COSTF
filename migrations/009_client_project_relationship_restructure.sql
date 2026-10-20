-- Migration 009: Restructure Client and Project Database Relationships

-- 1. Ensure clients table has all enterprise client attributes
ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_code TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS legal_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS billing_email TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS billing_address TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS payment_terms TEXT DEFAULT 'Net 30';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(18, 2) DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

-- Populate client_code if missing
UPDATE clients SET client_code = 'CLI-' || SUBSTRING(MD5(id) FROM 1 FOR 6) WHERE client_code IS NULL;

-- Unique index on client_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_client_code ON clients(client_code);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);

-- 2. Client Contacts table (multiple contacts per client)
CREATE TABLE IF NOT EXISTS client_contacts (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role_or_title TEXT DEFAULT 'Primary Contact',
  email TEXT NOT NULL,
  phone TEXT DEFAULT '',
  is_primary BOOLEAN DEFAULT false,
  is_billing_contact BOOLEAN DEFAULT false,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_contacts_client_id ON client_contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_email ON client_contacts(email);

-- Seed primary contact from clients table into client_contacts if not present
INSERT INTO client_contacts (id, client_id, name, role_or_title, email, phone, is_primary, is_billing_contact, notes)
SELECT 
  'ct-' || c.id || '-primary',
  c.id,
  COALESCE(NULLIF(c.contact_person, ''), c.name || ' Contact'),
  'Primary Contact',
  COALESCE(NULLIF(c.email, ''), 'contact@' || LOWER(REGEXP_REPLACE(c.name, '[^a-zA-Z0-9]', '', 'g')) || '.com'),
  COALESCE(c.phone, ''),
  true,
  true,
  'Primary client contact'
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM client_contacts cc WHERE cc.client_id = c.id AND cc.is_primary = true
);

-- 3. Ensure projects table has billing_client_id
ALTER TABLE projects ADD COLUMN IF NOT EXISTS billing_client_id TEXT REFERENCES clients(id) ON DELETE RESTRICT;

-- 4. Junction Table for Multiple Client Entities / Legal Entities per Project
CREATE TABLE IF NOT EXISTS project_clients (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  relationship_type TEXT NOT NULL DEFAULT 'Primary Client',
  share_pct NUMERIC(6, 2) DEFAULT 100.00,
  billing_contact_id TEXT REFERENCES client_contacts(id) ON DELETE SET NULL,
  notes TEXT DEFAULT '',
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_project_client_rel UNIQUE (project_id, client_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_project_clients_project_id ON project_clients(project_id);
CREATE INDEX IF NOT EXISTS idx_project_clients_client_id ON project_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_billing_client_id ON projects(billing_client_id);

-- 5. Data Integrity & Migration: Ensure every project has a valid client_id referencing clients(id)
-- Match existing client by name if client_id is null or missing
UPDATE projects p
SET client_id = c.id
FROM clients c
WHERE (p.client_id IS NULL OR NOT EXISTS (SELECT 1 FROM clients c2 WHERE c2.id = p.client_id))
  AND LOWER(TRIM(p.client_name)) = LOWER(TRIM(c.name));

-- For remaining projects with no matching client in clients table, insert canonical clients (one per unique client_name)
INSERT INTO clients (id, client_code, name, tagline, industry, location, status, active_projects_count, total_quoted_value, contact_person, email, created_at, created_at_ts, updated_at_ts)
SELECT DISTINCT
  'cli-' || SUBSTRING(MD5(LOWER(TRIM(p.client_name))) FROM 1 FOR 8),
  'CLI-' || SUBSTRING(MD5(LOWER(TRIM(p.client_name))) FROM 1 FOR 6),
  TRIM(p.client_name),
  'Corporate Enterprise Partner',
  'Commercial Enterprise',
  'Headquarters',
  'Active Partner',
  0,
  0,
  'Account Director',
  'contact@' || LOWER(REGEXP_REPLACE(TRIM(p.client_name), '[^a-zA-Z0-9]', '', 'g')) || '.com',
  NOW()::text,
  NOW(),
  NOW()
FROM projects p
WHERE (p.client_id IS NULL OR NOT EXISTS (SELECT 1 FROM clients c WHERE c.id = p.client_id))
  AND p.client_name IS NOT NULL AND TRIM(p.client_name) != ''
ON CONFLICT (id) DO NOTHING;

-- Now link those remaining projects to the newly created canonical clients
UPDATE projects p
SET client_id = c.id
FROM clients c
WHERE (p.client_id IS NULL OR NOT EXISTS (SELECT 1 FROM clients c2 WHERE c2.id = p.client_id))
  AND LOWER(TRIM(p.client_name)) = LOWER(TRIM(c.name));

-- For any project that STILL has no client_id, link to a default enterprise client
INSERT INTO clients (id, client_code, name, tagline, industry, location, status, active_projects_count, total_quoted_value, contact_person, email, created_at, created_at_ts, updated_at_ts)
VALUES ('cli-default-corp', 'CLI-0001', 'General Enterprise Client', 'Commercial Corporate Client', 'Enterprise Systems', 'Corporate Center', 'Active Partner', 0, 0, 'Client Services', 'client-services@enterprise.com', NOW()::text, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

UPDATE projects
SET client_id = 'cli-default-corp', client_name = 'General Enterprise Client'
WHERE client_id IS NULL OR NOT EXISTS (SELECT 1 FROM clients c WHERE c.id = projects.client_id);

-- 6. Populate project_clients junction table for each project
INSERT INTO project_clients (id, project_id, client_id, relationship_type, share_pct, is_primary)
SELECT
  'pc-' || p.id || '-' || p.client_id,
  p.id,
  p.client_id,
  'Primary Client',
  100.00,
  true
FROM projects p
WHERE p.client_id IS NOT NULL
ON CONFLICT (project_id, client_id, relationship_type) DO NOTHING;

-- 7. Update client statistics (active_projects_count and total_quoted_value)
UPDATE clients c
SET
  active_projects_count = (
    SELECT COUNT(DISTINCT p.id)
    FROM projects p
    WHERE p.client_id = c.id
      AND p.status NOT IN ('Completed', 'Archived', 'Cancelled')
  ),
  total_quoted_value = COALESCE((
    SELECT SUM(p.quoted_price)
    FROM projects p
    WHERE p.client_id = c.id
  ), 0);
