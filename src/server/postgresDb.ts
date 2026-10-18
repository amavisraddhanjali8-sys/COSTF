import pg from 'pg';

import {
  INITIAL_SUPPLIERS,
  INITIAL_MATERIALS,
  INITIAL_OUTSOURCED_SERVICES,
  INITIAL_SUBCONTRACTORS,
  INITIAL_INVENTORY,
  INITIAL_PROJECTS,
  INITIAL_PRODUCE_ITEMS
} from '../data/initialData';
import { INITIAL_CLIENT_PROFILES } from '../data/categoriesAndProfiles';
import { buildDefaultCategories } from '../services/persistentDatabase';
import { INITIAL_USERS, INITIAL_COMPANY_DETAILS, INITIAL_AUDIT_LOGS } from '../data/userAndAuditData';

// Numbers come back as JS numbers, not strings
pg.types.setTypeParser(20, (v: string) => parseInt(v, 10));
pg.types.setTypeParser(1700, (v: string) => parseFloat(v));

export interface Db {
  query(sql: string, params?: any[]): Promise<{ rows: any[] }>;
  exec(sql: string): Promise<void>;
}

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Example: postgresql://user:pass@localhost:5432/inno_cost');
  }
  return url;
}

export class PostgresService {
  private pool: pg.Pool | null = null;
  private db: Db | null = null;
  private isInitialized = false;
  private seeding = false;
  private initPromise: Promise<Db> | null = null;

  public async getDb(): Promise<Db> {
    if (this.db && (this.isInitialized || this.seeding)) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const pool = new pg.Pool({ connectionString: getDatabaseUrl(), max: 10 });
        pool.on('error', (e) => console.error('[PostgreSQL] pool error:', e.message));
        await pool.query('SELECT 1');
        this.pool = pool;
        this.db = {
          query: async (sql, params) => {
            const r = await pool.query(sql, params);
            return { rows: r.rows };
          },
          exec: async (sql) => {
            await pool.query(sql);
          }
        };
        this.seeding = true; // seed code calls getDb(); let it through
        try {
          await this.initSchemaAndSeed();
        } finally {
          this.seeding = false;
        }
        this.isInitialized = true;
        return this.db;
      } catch (err) {
        // Never delete data on error. Allow a clean retry on the next call.
        this.initPromise = null;
        this.pool = null;
        this.db = null;
        console.error('[PostgreSQL] connection failed:', (err as Error).message);
        throw err;
      }
    })();

    return this.initPromise;
  }

  // Run several queries as one all-or-nothing transaction
  public async withTransaction<T>(fn: (q: (sql: string, params?: any[]) => Promise<{ rows: any[] }>) => Promise<T>): Promise<T> {
    await this.getDb();
    const client = await this.pool!.connect();
    try {
      await client.query('BEGIN');
      const out = await fn(async (sql, params) => {
        const r = await client.query(sql, params);
        return { rows: r.rows };
      });
      await client.query('COMMIT');
      return out;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

  private async initSchemaAndSeed() {
    const db = this.db!;

    // 1. Create Tables
    await db.exec(`
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        tagline TEXT,
        industry TEXT,
        location TEXT,
        status TEXT DEFAULT 'Active Partner',
        active_projects_count INT DEFAULT 0,
        total_quoted_value NUMERIC DEFAULT 0,
        contact_person TEXT,
        email TEXT,
        phone TEXT,
        theme_id TEXT,
        custom_gradient TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        group_name TEXT NOT NULL,
        parent_id TEXT,
        parent_name TEXT,
        brief TEXT,
        item_count INT DEFAULT 0,
        theme_id TEXT,
        custom_gradient TEXT,
        icon TEXT,
        meta_badge TEXT,
        action_text TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY,
        code TEXT,
        name TEXT NOT NULL,
        category TEXT,
        supply_scope TEXT,
        rating NUMERIC DEFAULT 5.0,
        on_time_delivery_pct NUMERIC DEFAULT 100,
        quality_score_pct NUMERIC DEFAULT 100,
        lead_time_days INT DEFAULT 7,
        payment_terms TEXT,
        city TEXT,
        country TEXT,
        address TEXT,
        contact_person TEXT,
        email TEXT,
        phone TEXT,
        credit_limit NUMERIC DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        status TEXT DEFAULT 'Active',
        certifications JSONB DEFAULT '[]',
        contract_history JSONB DEFAULT '[]',
        notes TEXT,
        theme_id TEXT,
        custom_gradient TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
        client_name TEXT,
        product_category TEXT,
        product_sub_category TEXT,
        more_sub_category TEXT,
        target_product TEXT,
        quoted_price NUMERIC DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        target_margin_pct NUMERIC DEFAULT 25,
        overhead_pct NUMERIC DEFAULT 5,
        contingency_pct NUMERIC DEFAULT 3,
        status TEXT DEFAULT 'Proposal',
        start_date TEXT,
        delivery_deadline TEXT,
        created_date TEXT,
        contract_locked BOOLEAN DEFAULT false,
        theme_id TEXT,
        custom_gradient TEXT,
        phases JSONB DEFAULT '[]',
        selected_items JSONB DEFAULT '[]',
        alternative_options JSONB DEFAULT '[]',
        notes TEXT,
        analytics JSONB,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS materials (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT,
        sub_category TEXT,
        more_sub_category TEXT,
        unit TEXT DEFAULT 'pcs',
        current_price NUMERIC DEFAULT 0,
        last_price NUMERIC DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
        supplier_name TEXT,
        lead_time_days INT DEFAULT 7,
        in_stock NUMERIC DEFAULT 0,
        reorder_point NUMERIC DEFAULT 0,
        unit_cost NUMERIC DEFAULT 0,
        status TEXT DEFAULT 'Available',
        barcode TEXT,
        volume_pricing JSONB DEFAULT '[]',
        price_history JSONB DEFAULT '[]',
        theme_id TEXT,
        custom_gradient TEXT,
        last_updated TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS outsourced_services (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE,
        name TEXT NOT NULL,
        category TEXT,
        sub_category TEXT,
        more_sub_category TEXT,
        unit TEXT DEFAULT 'per_hour',
        base_unit_type TEXT DEFAULT 'per_hour',
        provider TEXT,
        provider_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
        provider_name TEXT,
        lead_time_days INT DEFAULT 7,
        rate NUMERIC DEFAULT 0,
        retail_price NUMERIC DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        quality_tier TEXT DEFAULT 'Standard',
        sla_level TEXT DEFAULT 'Tier-1 SLA (99.5%)',
        status TEXT DEFAULT 'Active',
        tier_rates JSONB DEFAULT '[]',
        price_history JSONB DEFAULT '[]',
        theme_id TEXT,
        custom_gradient TEXT,
        last_updated TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS subcontractors (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        subcontractor_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
        subcontractor_name TEXT NOT NULL,
        niche_service_name TEXT,
        service_type TEXT,
        service_category TEXT,
        service_sub_category TEXT,
        rate_model TEXT DEFAULT 'hourly_labour',
        skill_level TEXT,
        trade TEXT,
        tier TEXT,
        lead_time_days INT DEFAULT 7,
        base_rate NUMERIC DEFAULT 0,
        rate NUMERIC DEFAULT 0,
        retail_rate NUMERIC DEFAULT 0,
        shift_multiplier NUMERIC DEFAULT 1.0,
        full_contract_estimate NUMERIC DEFAULT 0,
        unit TEXT DEFAULT 'hr',
        currency TEXT DEFAULT 'USD',
        rating NUMERIC DEFAULT 4.9,
        quality_score_pct NUMERIC DEFAULT 99.0,
        weekly_capacity NUMERIC DEFAULT 160,
        crew_size INT DEFAULT 4,
        location TEXT,
        contact_phone TEXT,
        email TEXT,
        rate_range TEXT,
        status TEXT DEFAULT 'Active',
        bulk_pricing_ranges JSONB DEFAULT '[]',
        rate_history JSONB DEFAULT '[]',
        theme_id TEXT,
        custom_gradient TEXT,
        last_updated TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS produce_items (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'product',
        category TEXT,
        sub_category TEXT,
        more_sub_category TEXT,
        unit TEXT DEFAULT 'system',
        cost_price NUMERIC DEFAULT 0,
        retail_price NUMERIC DEFAULT 0,
        default_discount_pct NUMERIC DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        bundles_and_ranges JSONB DEFAULT '[]',
        lead_time_days INT DEFAULT 14,
        status TEXT DEFAULT 'Active',
        price_history JSONB DEFAULT '[]',
        theme_id TEXT,
        custom_gradient TEXT,
        last_updated TEXT,
        barcode TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS inventory (
        id TEXT PRIMARY KEY,
        sku TEXT NOT NULL,
        name TEXT NOT NULL,
        item_name TEXT,
        category TEXT,
        material_id TEXT REFERENCES materials(id) ON DELETE SET NULL,
        allocated_project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
        project_phase TEXT,
        on_hand NUMERIC DEFAULT 0,
        reserved NUMERIC DEFAULT 0,
        available NUMERIC DEFAULT 0,
        reorder_level NUMERIC DEFAULT 0,
        unit TEXT DEFAULT 'pcs',
        unit_cost NUMERIC DEFAULT 0,
        supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
        supplier_name TEXT,
        status TEXT DEFAULT 'Optimal',
        location TEXT,
        barcode TEXT,
        last_audit_date TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS inventory_transactions (
        id TEXT PRIMARY KEY,
        transaction_number TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        material_id TEXT,
        material_code TEXT,
        material_name TEXT,
        project_id TEXT,
        project_name TEXT,
        supplier_id TEXT,
        supplier_name TEXT,
        quantity NUMERIC NOT NULL,
        unit TEXT,
        price NUMERIC NOT NULL,
        discount NUMERIC DEFAULT 0,
        total_amount NUMERIC NOT NULL,
        previous_quantity NUMERIC,
        new_available_quantity NUMERIC,
        actor_name TEXT,
        actor_id TEXT,
        timestamp TEXT NOT NULL,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS custom_tiles (
        id TEXT PRIMARY KEY,
        group_name TEXT,
        tag TEXT,
        title TEXT NOT NULL,
        brief TEXT,
        action TEXT,
        theme_id TEXT,
        custom_gradient TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS company_details (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        registration_number TEXT,
        tax_id TEXT,
        address TEXT,
        city TEXT,
        country TEXT,
        phone TEXT,
        email TEXT,
        website TEXT,
        currency TEXT DEFAULT 'USD',
        logo_url TEXT,
        logo_position TEXT DEFAULT 'top_left',
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        employee_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL,
        department TEXT,
        password_hash TEXT,
        password_salt TEXT,
        password TEXT,
        status TEXT DEFAULT 'Active',
        theme_preference TEXT,
        two_factor_secret TEXT,
        two_factor_enabled BOOLEAN DEFAULT false,
        created_at TEXT,
        last_login TEXT
      );

      CREATE TABLE IF NOT EXISTS app_kv (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS security_settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL
      );
      ALTER TABLE users DROP COLUMN IF EXISTS password;

      CREATE TABLE IF NOT EXISTS account_requests (
        id TEXT PRIMARY KEY,
        employee_id TEXT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        requested_role TEXT NOT NULL,
        department TEXT,
        reason TEXT,
        submitted_date TEXT,
        status TEXT DEFAULT 'Pending'
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        actor_id TEXT,
        actor_name TEXT,
        actor_role TEXT,
        action TEXT NOT NULL,
        module TEXT NOT NULL,
        record_id TEXT,
        record_name TEXT,
        details TEXT,
        ip_address TEXT,
        status TEXT DEFAULT 'Success'
      );

      CREATE TABLE IF NOT EXISTS media_assets (
        id TEXT PRIMARY KEY,
        filename TEXT,
        mime_type TEXT,
        data_url TEXT,
        created_at TEXT
      );
    `);

    // 2. Check and Seed Initial Data if Tables are Empty
    await this.seedIfEmpty();
  }

  private async seedIfEmpty() {
    const db = this.db!;

    // Seed Categories
    const catCount = await db.query('SELECT COUNT(*) as cnt FROM categories');
    if (Number((catCount.rows[0] as any)?.cnt || 0) === 0) {
      const defaultCats = buildDefaultCategories();
      for (const cat of defaultCats) {
        await db.query(
          `INSERT INTO categories (id, name, type, group_name, parent_id, parent_name, brief, item_count, theme_id, custom_gradient, meta_badge, action_text, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            cat.id,
            cat.name,
            cat.type,
            cat.group,
            cat.parentId || null,
            cat.parentName || null,
            cat.brief || '',
            cat.itemCount || 0,
            cat.themeId || null,
            cat.customGradient || null,
            cat.metaBadge || null,
            cat.actionText || null,
            new Date().toISOString()
          ]
        );
      }
    }

    // Seed Company Details
    const compCount = await db.query('SELECT COUNT(*) as cnt FROM company_details');
    if (Number((compCount.rows[0] as any)?.cnt || 0) === 0) {
      await db.query(
        `INSERT INTO company_details (id, name, registration_number, tax_id, address, city, country, phone, email, website, currency, logo_position, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          'comp-01',
          INITIAL_COMPANY_DETAILS.name || 'FXTT Enterprise Solutions Ltd',
          INITIAL_COMPANY_DETAILS.registrationNumber || '',
          INITIAL_COMPANY_DETAILS.taxId || '',
          INITIAL_COMPANY_DETAILS.address || '',
          INITIAL_COMPANY_DETAILS.city || '',
          INITIAL_COMPANY_DETAILS.country || '',
          INITIAL_COMPANY_DETAILS.phone || '',
          INITIAL_COMPANY_DETAILS.email || '',
          INITIAL_COMPANY_DETAILS.website || '',
          INITIAL_COMPANY_DETAILS.currency || 'USD',
          INITIAL_COMPANY_DETAILS.logoPosition || 'top_left',
          new Date().toISOString()
        ]
      );
    }

    // Seed Users (Admin user for authentication)
    // Users are not seeded here. The server creates the first admin at startup.

    // Seed Outsourced Services Tariffs
    const outCount = await db.query('SELECT COUNT(*) as cnt FROM outsourced_services');
    if (Number((outCount.rows[0] as any)?.cnt || 0) === 0) {
      for (const item of INITIAL_OUTSOURCED_SERVICES) {
        await this.createOutsourced(item);
      }
    }

    // Seed Materials
    const matCount = await db.query('SELECT COUNT(*) as cnt FROM materials');
    if (Number((matCount.rows[0] as any)?.cnt || 0) === 0) {
      for (const item of INITIAL_MATERIALS) {
        await this.createMaterial(item);
      }
    }

    // Seed Suppliers
    const supCount = await db.query('SELECT COUNT(*) as cnt FROM suppliers');
    if (Number((supCount.rows[0] as any)?.cnt || 0) === 0) {
      for (const item of INITIAL_SUPPLIERS) {
        await this.createSupplier(item);
      }
    }

    // Seed Subcontractors
    const subCount = await db.query('SELECT COUNT(*) as cnt FROM subcontractors');
    if (Number((subCount.rows[0] as any)?.cnt || 0) === 0) {
      for (const item of INITIAL_SUBCONTRACTORS) {
        await this.createSubcontractor(item);
      }
    }

    // Seed Produce Items
    const prodCount = await db.query('SELECT COUNT(*) as cnt FROM produce_items');
    if (Number((prodCount.rows[0] as any)?.cnt || 0) === 0) {
      for (const item of INITIAL_PRODUCE_ITEMS) {
        await this.createProduce(item);
      }
    }

    // Seed Projects
    const projCount = await db.query('SELECT COUNT(*) as cnt FROM projects');
    if (Number((projCount.rows[0] as any)?.cnt || 0) === 0) {
      for (const item of INITIAL_PROJECTS) {
        await this.createProject(item);
      }
    }

    // Seed Clients
    const cliCount = await db.query('SELECT COUNT(*) as cnt FROM clients');
    if (Number((cliCount.rows[0] as any)?.cnt || 0) === 0) {
      for (const item of INITIAL_CLIENT_PROFILES) {
        await this.createClient(item);
      }
    }
  }

  public async clearDummyData(): Promise<void> {
    const db = await this.getDb();
    await db.exec(`
      DELETE FROM inventory_transactions;
      DELETE FROM inventory;
      DELETE FROM projects;
      DELETE FROM outsourced_services;
      DELETE FROM subcontractors;
      DELETE FROM produce_items;
      DELETE FROM materials;
      DELETE FROM suppliers;
      DELETE FROM clients;
      DELETE FROM custom_tiles;
      DELETE FROM audit_logs;
    `);
  }

  // --- Clients CRUD ---
  public async getClients(): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM clients ORDER BY created_at DESC');
    return res.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      tagline: r.tagline,
      industry: r.industry,
      location: r.location,
      status: r.status,
      activeProjectsCount: Number(r.active_projects_count || 0),
      totalQuotedValue: Number(r.total_quoted_value || 0),
      contactPerson: r.contact_person,
      email: r.email,
      phone: r.phone,
      themeId: r.theme_id,
      customGradient: r.custom_gradient
    }));
  }

  public async createClient(data: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `cli-${Date.now()}`;
    await db.query(
      `INSERT INTO clients (id, name, tagline, industry, location, status, active_projects_count, total_quoted_value, contact_person, email, phone, theme_id, custom_gradient, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         tagline = EXCLUDED.tagline,
         industry = EXCLUDED.industry,
         location = EXCLUDED.location,
         status = EXCLUDED.status,
         total_quoted_value = EXCLUDED.total_quoted_value,
         contact_person = EXCLUDED.contact_person,
         email = EXCLUDED.email,
         phone = EXCLUDED.phone,
         theme_id = EXCLUDED.theme_id,
         custom_gradient = EXCLUDED.custom_gradient`,
      [
        id,
        data.name || 'New Client',
        data.tagline || '',
        data.industry || '',
        data.location || '',
        data.status || 'Active Partner',
        Number(data.activeProjectsCount || 1),
        Number(data.totalQuotedValue || 0),
        data.contactPerson || '',
        data.email || '',
        data.phone || '',
        data.themeId || 'pacific-sky',
        data.customGradient || null,
        new Date().toISOString()
      ]
    );
    return { ...data, id };
  }

  public async updateClient(id: string, data: any): Promise<any> {
    const db = await this.getDb();
    const existing = (await this.getClients()).find(c => c.id === id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    await db.query(
      `UPDATE clients SET name=$1, tagline=$2, industry=$3, location=$4, status=$5, active_projects_count=$6, total_quoted_value=$7, contact_person=$8, email=$9, phone=$10, theme_id=$11, custom_gradient=$12 WHERE id=$13`,
      [
        merged.name,
        merged.tagline || '',
        merged.industry || '',
        merged.location || '',
        merged.status || 'Active Partner',
        Number(merged.activeProjectsCount || 0),
        Number(merged.totalQuotedValue || 0),
        merged.contactPerson || '',
        merged.email || '',
        merged.phone || '',
        merged.themeId || 'pacific-sky',
        merged.customGradient || null,
        id
      ]
    );
    return merged;
  }

  public async deleteClient(id: string): Promise<boolean> {
    const db = await this.getDb();
    await db.query('DELETE FROM clients WHERE id=$1', [id]);
    return true;
  }

  // --- Suppliers CRUD ---
  public async getSuppliers(): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM suppliers ORDER BY created_at DESC');
    return res.rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      category: r.category,
      supplyScope: r.supply_scope,
      rating: Number(r.rating || 5),
      onTimeDeliveryPct: Number(r.on_time_delivery_pct || 100),
      qualityScorePct: Number(r.quality_score_pct || 100),
      leadTimeDays: Number(r.lead_time_days || 7),
      paymentTerms: r.payment_terms,
      city: r.city,
      country: r.country,
      address: r.address,
      contactPerson: r.contact_person,
      email: r.email,
      phone: r.phone,
      creditLimit: Number(r.credit_limit || 0),
      currency: r.currency || 'USD',
      status: r.status,
      certifications: typeof r.certifications === 'string' ? JSON.parse(r.certifications) : r.certifications || [],
      contractHistory: typeof r.contract_history === 'string' ? JSON.parse(r.contract_history) : r.contract_history || [],
      notes: r.notes,
      themeId: r.theme_id,
      customGradient: r.custom_gradient
    }));
  }

  public async createSupplier(data: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `sup-${Date.now()}`;
    await db.query(
      `INSERT INTO suppliers (id, code, name, category, supply_scope, rating, on_time_delivery_pct, quality_score_pct, lead_time_days, payment_terms, city, country, address, contact_person, email, phone, credit_limit, currency, status, certifications, contract_history, notes, theme_id, custom_gradient, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         category = EXCLUDED.category,
         supply_scope = EXCLUDED.supply_scope,
         contact_person = EXCLUDED.contact_person,
         email = EXCLUDED.email,
         phone = EXCLUDED.phone,
         city = EXCLUDED.city,
         country = EXCLUDED.country,
         payment_terms = EXCLUDED.payment_terms,
         rating = EXCLUDED.rating,
         quality_score_pct = EXCLUDED.quality_score_pct,
         credit_limit = EXCLUDED.credit_limit,
         status = EXCLUDED.status,
         theme_id = EXCLUDED.theme_id,
         custom_gradient = EXCLUDED.custom_gradient`,
      [
        id,
        data.code || id.toUpperCase(),
        data.name || 'New Supplier',
        data.category || 'Materials',
        data.supplyScope || 'materials',
        Number(data.rating || 5.0),
        Number(data.onTimeDeliveryPct || 100),
        Number(data.qualityScorePct || 100),
        Number(data.leadTimeDays || 7),
        data.paymentTerms || 'Net 30',
        data.city || '',
        data.country || 'USA',
        data.address || '',
        data.contactPerson || '',
        data.email || '',
        data.phone || '',
        Number(data.creditLimit || 0),
        data.currency || 'USD',
        data.status || 'Active',
        JSON.stringify(data.certifications || []),
        JSON.stringify(data.contractHistory || []),
        data.notes || '',
        data.themeId || null,
        data.customGradient || null,
        new Date().toISOString()
      ]
    );
    return { ...data, id };
  }

  public async updateSupplier(id: string, data: any): Promise<any> {
    const db = await this.getDb();
    const existing = (await this.getSuppliers()).find(s => s.id === id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    await db.query(
      `UPDATE suppliers SET code=$1, name=$2, category=$3, supply_scope=$4, rating=$5, on_time_delivery_pct=$6, quality_score_pct=$7, lead_time_days=$8, payment_terms=$9, city=$10, country=$11, address=$12, contact_person=$13, email=$14, phone=$15, credit_limit=$16, currency=$17, status=$18, certifications=$19, contract_history=$20, notes=$21, theme_id=$22, custom_gradient=$23 WHERE id=$24`,
      [
        merged.code,
        merged.name,
        merged.category,
        merged.supplyScope,
        Number(merged.rating || 5),
        Number(merged.onTimeDeliveryPct || 100),
        Number(merged.qualityScorePct || 100),
        Number(merged.leadTimeDays || 7),
        merged.paymentTerms,
        merged.city,
        merged.country,
        merged.address,
        merged.contactPerson,
        merged.email,
        merged.phone,
        Number(merged.creditLimit || 0),
        merged.currency,
        merged.status,
        JSON.stringify(merged.certifications || []),
        JSON.stringify(merged.contractHistory || []),
        merged.notes || '',
        merged.themeId || null,
        merged.customGradient || null,
        id
      ]
    );
    return merged;
  }

  public async deleteSupplier(id: string): Promise<boolean> {
    const db = await this.getDb();
    await db.query('DELETE FROM suppliers WHERE id=$1', [id]);
    return true;
  }

  // --- Materials CRUD ---
  public async getMaterials(): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM materials ORDER BY created_at DESC');
    return res.rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      category: r.category,
      subCategory: r.sub_category,
      moreSubCategory: r.more_sub_category,
      unit: r.unit,
      currentPrice: Number(r.current_price || 0),
      lastPrice: Number(r.last_price || 0),
      retailPrice: Number(r.current_price || 0),
      currency: r.currency || 'USD',
      supplierName: r.supplier_name,
      leadTimeDays: Number(r.lead_time_days || 7),
      inStock: Number(r.in_stock || 0),
      reorderPoint: Number(r.reorder_point || 0),
      unitCost: Number(r.unit_cost || 0),
      status: r.status,
      barcode: r.barcode,
      volumePricing: typeof r.volume_pricing === 'string' ? JSON.parse(r.volume_pricing) : r.volume_pricing || [],
      priceHistory: typeof r.price_history === 'string' ? JSON.parse(r.price_history) : r.price_history || [],
      themeId: r.theme_id,
      customGradient: r.custom_gradient,
      lastUpdated: r.last_updated
    }));
  }

  public async createMaterial(data: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `mat-${Date.now()}`;
    const price = Number(data.currentPrice ?? data.retailPrice ?? data.unitPrice ?? 0);
    let code = (data.code || `MAT-${Math.floor(1000 + Math.random() * 9000)}`).trim();
    try {
      const existingCode = await db.query('SELECT id FROM materials WHERE code = $1 AND id != $2', [code, id]);
      if (existingCode.rows.length > 0) {
        code = `${code}-${Math.floor(100 + Math.random() * 900)}`;
      }
    } catch {
      // ignore
    }

    await db.query(
      `INSERT INTO materials (id, code, name, category, sub_category, more_sub_category, unit, current_price, last_price, currency, supplier_name, lead_time_days, in_stock, reorder_point, unit_cost, status, barcode, volume_pricing, price_history, theme_id, custom_gradient, last_updated, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         code = EXCLUDED.code,
         category = EXCLUDED.category,
         sub_category = EXCLUDED.sub_category,
         more_sub_category = EXCLUDED.more_sub_category,
         unit = EXCLUDED.unit,
         current_price = EXCLUDED.current_price,
         last_price = EXCLUDED.last_price,
         supplier_name = EXCLUDED.supplier_name,
         in_stock = EXCLUDED.in_stock,
         status = EXCLUDED.status,
         theme_id = EXCLUDED.theme_id,
         custom_gradient = EXCLUDED.custom_gradient,
         last_updated = EXCLUDED.last_updated`,
      [
        id,
        code,
        data.name || 'New Material',
        data.category || 'Raw Materials',
        data.subCategory || '',
        data.moreSubCategory || '',
        data.unit || 'pcs',
        price,
        price,
        data.currency || 'USD',
        data.supplierName || '',
        Number(data.leadTimeDays || 7),
        Number(data.inStock || 0),
        Number(data.reorderPoint || 0),
        Number(data.unitCost || price * 0.8),
        data.status || 'Available',
        data.barcode || '',
        JSON.stringify(data.volumePricing || []),
        JSON.stringify(data.priceHistory || []),
        data.themeId || null,
        data.customGradient || null,
        data.lastUpdated || new Date().toISOString().split('T')[0],
        new Date().toISOString()
      ]
    );
    return { ...data, id, code, currentPrice: price, retailPrice: price };
  }

  public async updateMaterial(id: string, data: any): Promise<any> {
    const db = await this.getDb();
    const existing = (await this.getMaterials()).find(m => m.id === id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    const price = Number(merged.currentPrice ?? merged.retailPrice ?? 0);
    await db.query(
      `UPDATE materials SET code=$1, name=$2, category=$3, sub_category=$4, more_sub_category=$5, unit=$6, current_price=$7, last_price=$8, currency=$9, supplier_name=$10, lead_time_days=$11, in_stock=$12, reorder_point=$13, unit_cost=$14, status=$15, barcode=$16, volume_pricing=$17, price_history=$18, theme_id=$19, custom_gradient=$20, last_updated=$21 WHERE id=$22`,
      [
        merged.code,
        merged.name,
        merged.category,
        merged.subCategory || '',
        merged.moreSubCategory || '',
        merged.unit || 'pcs',
        price,
        Number(merged.lastPrice || price),
        merged.currency || 'USD',
        merged.supplierName || '',
        Number(merged.leadTimeDays || 7),
        Number(merged.inStock || 0),
        Number(merged.reorderPoint || 0),
        Number(merged.unitCost || 0),
        merged.status || 'Available',
        merged.barcode || '',
        JSON.stringify(merged.volumePricing || []),
        JSON.stringify(merged.priceHistory || []),
        merged.themeId || null,
        merged.customGradient || null,
        new Date().toISOString().split('T')[0],
        id
      ]
    );
    return { ...merged, currentPrice: price, retailPrice: price };
  }

  public async deleteMaterial(id: string): Promise<boolean> {
    const db = await this.getDb();
    await db.query('DELETE FROM materials WHERE id=$1', [id]);
    return true;
  }

  // --- Outsourced Services CRUD ---
  public async getOutsourced(): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM outsourced_services ORDER BY created_at DESC');
    return res.rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      category: r.category,
      subCategory: r.sub_category,
      moreSubCategory: r.more_sub_category,
      unit: r.unit,
      baseUnitType: r.base_unit_type || r.unit,
      providerName: r.provider_name,
      leadTimeDays: Number(r.lead_time_days || 7),
      rate: Number(r.rate || 0),
      retailPrice: Number(r.retail_price || 0),
      currency: r.currency || 'USD',
      qualityTier: r.quality_tier,
      slaLevel: r.sla_level,
      status: r.status,
      tierRates: typeof r.tier_rates === 'string' ? JSON.parse(r.tier_rates) : r.tier_rates || [],
      priceHistory: typeof r.price_history === 'string' ? JSON.parse(r.price_history) : r.price_history || [],
      themeId: r.theme_id,
      customGradient: r.custom_gradient,
      lastUpdated: r.last_updated
    }));
  }

  public async createOutsourced(data: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `out-${Date.now()}`;
    await db.query(
      `INSERT INTO outsourced_services (id, code, name, category, sub_category, more_sub_category, unit, base_unit_type, provider_name, lead_time_days, rate, retail_price, currency, quality_tier, sla_level, status, tier_rates, price_history, theme_id, custom_gradient, last_updated, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         code = EXCLUDED.code,
         category = EXCLUDED.category,
         sub_category = EXCLUDED.sub_category,
         more_sub_category = EXCLUDED.more_sub_category,
         unit = EXCLUDED.unit,
         base_unit_type = EXCLUDED.base_unit_type,
         provider_name = EXCLUDED.provider_name,
         rate = EXCLUDED.rate,
         retail_price = EXCLUDED.retail_price,
         status = EXCLUDED.status,
         theme_id = EXCLUDED.theme_id,
         custom_gradient = EXCLUDED.custom_gradient,
         last_updated = EXCLUDED.last_updated`,
      [
        id,
        data.code || id.toUpperCase(),
        data.name || 'New Service',
        data.category || 'Outsourced Processing',
        data.subCategory || '',
        data.moreSubCategory || '',
        data.unit || 'per_hour',
        data.baseUnitType || data.unit || 'per_hour',
        data.providerName || '',
        Number(data.leadTimeDays || 7),
        Number(data.rate || 0),
        Number(data.retailPrice || (Number(data.rate || 0) * 1.35)),
        data.currency || 'USD',
        data.qualityTier || 'Standard',
        data.slaLevel || 'Tier-1 SLA (99.5%)',
        data.status || 'Active',
        JSON.stringify(data.tierRates || []),
        JSON.stringify(data.priceHistory || []),
        data.themeId || null,
        data.customGradient || null,
        data.lastUpdated || new Date().toISOString().split('T')[0],
        new Date().toISOString()
      ]
    );
    return { ...data, id };
  }

  public async updateOutsourced(id: string, data: any): Promise<any> {
    const db = await this.getDb();
    const existing = (await this.getOutsourced()).find(o => o.id === id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    await db.query(
      `UPDATE outsourced_services SET code=$1, name=$2, category=$3, sub_category=$4, more_sub_category=$5, unit=$6, base_unit_type=$7, provider_name=$8, lead_time_days=$9, rate=$10, retail_price=$11, currency=$12, quality_tier=$13, sla_level=$14, status=$15, tier_rates=$16, price_history=$17, theme_id=$18, custom_gradient=$19, last_updated=$20 WHERE id=$21`,
      [
        merged.code,
        merged.name,
        merged.category,
        merged.subCategory || '',
        merged.moreSubCategory || '',
        merged.unit || 'per_hour',
        merged.baseUnitType || merged.unit || 'per_hour',
        merged.providerName || '',
        Number(merged.leadTimeDays || 7),
        Number(merged.rate || 0),
        Number(merged.retailPrice || 0),
        merged.currency || 'USD',
        merged.qualityTier || 'Standard',
        merged.slaLevel || 'Tier-1 SLA (99.5%)',
        merged.status || 'Active',
        JSON.stringify(merged.tierRates || []),
        JSON.stringify(merged.priceHistory || []),
        merged.themeId || null,
        merged.customGradient || null,
        new Date().toISOString().split('T')[0],
        id
      ]
    );
    return merged;
  }

  public async deleteOutsourced(id: string): Promise<boolean> {
    const db = await this.getDb();
    await db.query('DELETE FROM outsourced_services WHERE id=$1', [id]);
    return true;
  }

  // --- Subcontractors CRUD ---
  public async getSubcontractors(): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM subcontractors ORDER BY created_at DESC');
    return res.rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      subcontractorName: r.subcontractor_name,
      nicheServiceName: r.niche_service_name,
      serviceType: r.service_type,
      serviceCategory: r.service_category,
      serviceSubCategory: r.service_sub_category,
      rateModel: r.rate_model,
      skillLevel: r.skill_level,
      trade: r.trade,
      tier: r.tier,
      leadTimeDays: Number(r.lead_time_days || 7),
      baseRate: Number(r.base_rate || 0),
      rate: Number(r.rate || r.base_rate || 0),
      retailRate: Number(r.retail_rate || 0),
      shiftMultiplier: Number(r.shift_multiplier || 1.0),
      fullContractEstimate: Number(r.full_contract_estimate || 0),
      unit: r.unit,
      currency: r.currency || 'USD',
      rating: Number(r.rating || 4.9),
      qualityScorePct: Number(r.quality_score_pct || 99.0),
      weeklyCapacity: Number(r.weekly_capacity || 160),
      crewSize: Number(r.crew_size || 4),
      location: r.location,
      contactPhone: r.contact_phone,
      email: r.email,
      rateRange: r.rate_range,
      status: r.status,
      bulkPricingRanges: typeof r.bulk_pricing_ranges === 'string' ? JSON.parse(r.bulk_pricing_ranges) : r.bulk_pricing_ranges || [],
      rateHistory: typeof r.rate_history === 'string' ? JSON.parse(r.rate_history) : r.rate_history || [],
      themeId: r.theme_id,
      customGradient: r.custom_gradient,
      lastUpdated: r.last_updated
    }));
  }

  public async createSubcontractor(data: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `sub-${Date.now()}`;
    const rate = Number(data.baseRate ?? data.rate ?? 0);
    let code = (data.code || `SUB-${Math.floor(1000 + Math.random() * 9000)}`).trim();
    try {
      const existingCode = await db.query('SELECT id FROM subcontractors WHERE code = $1 AND id != $2', [code, id]);
      if (existingCode.rows.length > 0) {
        code = `${code}-${Math.floor(100 + Math.random() * 900)}`;
      }
    } catch {
      // ignore
    }

    await db.query(
      `INSERT INTO subcontractors (id, code, subcontractor_name, niche_service_name, service_type, service_category, service_sub_category, rate_model, skill_level, trade, tier, lead_time_days, base_rate, rate, retail_rate, shift_multiplier, full_contract_estimate, unit, currency, rating, quality_score_pct, weekly_capacity, crew_size, location, contact_phone, email, rate_range, status, bulk_pricing_ranges, rate_history, theme_id, custom_gradient, last_updated, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34)
       ON CONFLICT (id) DO UPDATE SET
         subcontractor_name = EXCLUDED.subcontractor_name,
         code = EXCLUDED.code,
         niche_service_name = EXCLUDED.niche_service_name,
         service_type = EXCLUDED.service_type,
         service_category = EXCLUDED.service_category,
         service_sub_category = EXCLUDED.service_sub_category,
         base_rate = EXCLUDED.base_rate,
         rate = EXCLUDED.rate,
         retail_rate = EXCLUDED.retail_rate,
         unit = EXCLUDED.unit,
         status = EXCLUDED.status,
         theme_id = EXCLUDED.theme_id,
         custom_gradient = EXCLUDED.custom_gradient,
         last_updated = EXCLUDED.last_updated`,
      [
        id,
        code,
        data.subcontractorName || 'New Subcontractor',
        data.nicheServiceName || data.serviceType || '',
        data.serviceType || '',
        data.serviceCategory || '',
        data.serviceSubCategory || '',
        data.rateModel || 'hourly_labour',
        data.skillLevel || '',
        data.trade || '',
        data.tier || 'Master',
        Number(data.leadTimeDays || 7),
        rate,
        rate,
        Number(data.retailRate || rate * 1.4),
        Number(data.shiftMultiplier || 1.0),
        Number(data.fullContractEstimate || 0),
        data.unit || 'hr',
        data.currency || 'USD',
        Number(data.rating || 4.9),
        Number(data.qualityScorePct || 99.0),
        Number(data.weeklyCapacity || 160),
        Number(data.crewSize || 4),
        data.location || '',
        data.contactPhone || '',
        data.email || '',
        data.rateRange || '',
        data.status || 'Active',
        JSON.stringify(data.bulkPricingRanges || []),
        JSON.stringify(data.rateHistory || []),
        data.themeId || null,
        data.customGradient || null,
        data.lastUpdated || new Date().toISOString().split('T')[0],
        new Date().toISOString()
      ]
    );
    return { ...data, id, code, baseRate: rate, rate };
  }

  public async updateSubcontractor(id: string, data: any): Promise<any> {
    const db = await this.getDb();
    const existing = (await this.getSubcontractors()).find(s => s.id === id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    const rate = Number(merged.baseRate ?? merged.rate ?? 0);
    await db.query(
      `UPDATE subcontractors SET code=$1, subcontractor_name=$2, niche_service_name=$3, service_type=$4, service_category=$5, service_sub_category=$6, rate_model=$7, skill_level=$8, trade=$9, tier=$10, lead_time_days=$11, base_rate=$12, rate=$13, retail_rate=$14, shift_multiplier=$15, full_contract_estimate=$16, unit=$17, currency=$18, rating=$19, quality_score_pct=$20, weekly_capacity=$21, crew_size=$22, location=$23, contact_phone=$24, email=$25, rate_range=$26, status=$27, bulk_pricing_ranges=$28, rate_history=$29, theme_id=$30, custom_gradient=$31, last_updated=$32 WHERE id=$33`,
      [
        merged.code,
        merged.subcontractorName,
        merged.nicheServiceName || '',
        merged.serviceType || '',
        merged.serviceCategory || '',
        merged.serviceSubCategory || '',
        merged.rateModel || 'hourly_labour',
        merged.skillLevel || '',
        merged.trade || '',
        merged.tier || 'Master',
        Number(merged.leadTimeDays || 7),
        rate,
        rate,
        Number(merged.retailRate || 0),
        Number(merged.shiftMultiplier || 1.0),
        Number(merged.fullContractEstimate || 0),
        merged.unit || 'hr',
        merged.currency || 'USD',
        Number(merged.rating || 4.9),
        Number(merged.qualityScorePct || 99.0),
        Number(merged.weeklyCapacity || 160),
        Number(merged.crewSize || 4),
        merged.location || '',
        merged.contactPhone || '',
        merged.email || '',
        merged.rateRange || '',
        merged.status || 'Active',
        JSON.stringify(merged.bulkPricingRanges || []),
        JSON.stringify(merged.rateHistory || []),
        merged.themeId || null,
        merged.customGradient || null,
        new Date().toISOString().split('T')[0],
        id
      ]
    );
    return merged;
  }

  public async deleteSubcontractor(id: string): Promise<boolean> {
    const db = await this.getDb();
    await db.query('DELETE FROM subcontractors WHERE id=$1', [id]);
    return true;
  }

  // --- Produce Items CRUD ---
  public async getProduce(): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM produce_items ORDER BY created_at DESC');
    return res.rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      type: r.type,
      category: r.category,
      subCategory: r.sub_category,
      moreSubCategory: r.more_sub_category,
      unit: r.unit,
      costPrice: Number(r.cost_price || 0),
      retailPrice: Number(r.retail_price || 0),
      defaultDiscountPct: Number(r.default_discount_pct || 0),
      currency: r.currency || 'USD',
      bundlesAndRanges: typeof r.bundles_and_ranges === 'string' ? JSON.parse(r.bundles_and_ranges) : r.bundles_and_ranges || [],
      leadTimeDays: Number(r.lead_time_days || 14),
      status: r.status,
      priceHistory: typeof r.price_history === 'string' ? JSON.parse(r.price_history) : r.price_history || [],
      themeId: r.theme_id,
      customGradient: r.custom_gradient,
      lastUpdated: r.last_updated,
      barcode: r.barcode
    }));
  }

  public async createProduce(data: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `prd-${Date.now()}`;
    let code = (data.code || `PRD-${Math.floor(1000 + Math.random() * 9000)}`).trim();
    try {
      const existingCode = await db.query('SELECT id FROM produce_items WHERE code = $1 AND id != $2', [code, id]);
      if (existingCode.rows.length > 0) {
        code = `${code}-${Math.floor(100 + Math.random() * 900)}`;
      }
    } catch {
      // ignore
    }

    await db.query(
      `INSERT INTO produce_items (id, code, name, type, category, sub_category, more_sub_category, unit, cost_price, retail_price, default_discount_pct, currency, bundles_and_ranges, lead_time_days, status, price_history, theme_id, custom_gradient, last_updated, barcode, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         code = EXCLUDED.code,
         type = EXCLUDED.type,
         category = EXCLUDED.category,
         sub_category = EXCLUDED.sub_category,
         more_sub_category = EXCLUDED.more_sub_category,
         unit = EXCLUDED.unit,
         cost_price = EXCLUDED.cost_price,
         retail_price = EXCLUDED.retail_price,
         default_discount_pct = EXCLUDED.default_discount_pct,
         status = EXCLUDED.status,
         theme_id = EXCLUDED.theme_id,
         custom_gradient = EXCLUDED.custom_gradient,
         last_updated = EXCLUDED.last_updated`,
      [
        id,
        code,
        data.name || 'New Product / Produce Item',
        data.type || 'product',
        data.category || 'Manufactured Parts',
        data.subCategory || '',
        data.moreSubCategory || '',
        data.unit || 'system',
        Number(data.costPrice || 0),
        Number(data.retailPrice || 0),
        Number(data.defaultDiscountPct || 0),
        data.currency || 'USD',
        JSON.stringify(data.bundlesAndRanges || []),
        Number(data.leadTimeDays || 14),
        data.status || 'Active',
        JSON.stringify(data.priceHistory || []),
        data.themeId || null,
        data.customGradient || null,
        data.lastUpdated || new Date().toISOString().split('T')[0],
        data.barcode || '',
        new Date().toISOString()
      ]
    );
    return { ...data, id, code };
  }

  public async updateProduce(id: string, data: any): Promise<any> {
    const db = await this.getDb();
    const existing = (await this.getProduce()).find(p => p.id === id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    await db.query(
      `UPDATE produce_items SET code=$1, name=$2, type=$3, category=$4, sub_category=$5, more_sub_category=$6, unit=$7, cost_price=$8, retail_price=$9, default_discount_pct=$10, currency=$11, bundles_and_ranges=$12, lead_time_days=$13, status=$14, price_history=$15, theme_id=$16, custom_gradient=$17, last_updated=$18, barcode=$19 WHERE id=$20`,
      [
        merged.code,
        merged.name,
        merged.type,
        merged.category,
        merged.subCategory || '',
        merged.moreSubCategory || '',
        merged.unit || 'system',
        Number(merged.costPrice || 0),
        Number(merged.retailPrice || 0),
        Number(merged.defaultDiscountPct || 0),
        merged.currency || 'USD',
        JSON.stringify(merged.bundlesAndRanges || []),
        Number(merged.leadTimeDays || 14),
        merged.status || 'Active',
        JSON.stringify(merged.priceHistory || []),
        merged.themeId || null,
        merged.customGradient || null,
        new Date().toISOString().split('T')[0],
        merged.barcode || '',
        id
      ]
    );
    return merged;
  }

  public async deleteProduce(id: string): Promise<boolean> {
    const db = await this.getDb();
    await db.query('DELETE FROM produce_items WHERE id=$1', [id]);
    return true;
  }

  // --- Projects CRUD ---
  public async getProjects(): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM projects ORDER BY created_at DESC');
    return res.rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      clientId: r.client_id,
      clientName: r.client_name,
      productCategory: r.product_category,
      productSubCategory: r.product_sub_category,
      moreSubCategory: r.more_sub_category,
      targetProduct: r.target_product,
      quotedPrice: Number(r.quoted_price || 0),
      currency: r.currency || 'USD',
      targetMarginPct: Number(r.target_margin_pct || 25),
      overheadPct: Number(r.overhead_pct || 5),
      contingencyPct: Number(r.contingency_pct || 3),
      status: r.status,
      startDate: r.start_date,
      deliveryDeadline: r.delivery_deadline,
      createdDate: r.created_date,
      contractLocked: Boolean(r.contract_locked),
      themeId: r.theme_id,
      customGradient: r.custom_gradient,
      phases: typeof r.phases === 'string' ? JSON.parse(r.phases) : r.phases || [],
      selectedItems: typeof r.selected_items === 'string' ? JSON.parse(r.selected_items) : r.selected_items || [],
      alternativeOptions: typeof r.alternative_options === 'string' ? JSON.parse(r.alternative_options) : r.alternative_options || [],
      notes: r.notes,
      analytics: typeof r.analytics === 'string' ? JSON.parse(r.analytics) : r.analytics || null
    }));
  }

  public async createProject(data: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `proj-${Date.now()}`;
    let code = (data.code || `PRJ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`).trim();
    try {
      const existingCode = await db.query('SELECT id FROM projects WHERE code = $1 AND id != $2', [code, id]);
      if (existingCode.rows.length > 0) {
        code = `${code}-${Math.floor(100 + Math.random() * 900)}`;
      }
    } catch {
      // ignore
    }

    await db.query(
      `INSERT INTO projects (id, code, name, client_name, product_category, product_sub_category, more_sub_category, target_product, quoted_price, currency, target_margin_pct, overhead_pct, contingency_pct, status, start_date, delivery_deadline, created_date, contract_locked, theme_id, custom_gradient, phases, selected_items, alternative_options, notes, analytics, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         code = EXCLUDED.code,
         client_name = EXCLUDED.client_name,
         product_category = EXCLUDED.product_category,
         product_sub_category = EXCLUDED.product_sub_category,
         more_sub_category = EXCLUDED.more_sub_category,
         target_product = EXCLUDED.target_product,
         quoted_price = EXCLUDED.quoted_price,
         currency = EXCLUDED.currency,
         target_margin_pct = EXCLUDED.target_margin_pct,
         status = EXCLUDED.status,
         phases = EXCLUDED.phases,
         selected_items = EXCLUDED.selected_items,
         theme_id = EXCLUDED.theme_id,
         custom_gradient = EXCLUDED.custom_gradient,
         notes = EXCLUDED.notes`,
      [
        id,
        code,
        data.name || 'New Project',
        data.clientName || 'Valued Client',
        data.productCategory || '',
        data.productSubCategory || '',
        data.moreSubCategory || '',
        data.targetProduct || '',
        Number(data.quotedPrice || 100000),
        data.currency || 'USD',
        Number(data.targetMarginPct || 25),
        Number(data.overheadPct || 5),
        Number(data.contingencyPct || 3),
        data.status || 'Proposal',
        data.startDate || new Date().toISOString().split('T')[0],
        data.deliveryDeadline || '',
        data.createdDate || new Date().toISOString().split('T')[0],
        Boolean(data.contractLocked),
        data.themeId || null,
        data.customGradient || null,
        JSON.stringify(data.phases || []),
        JSON.stringify(data.selectedItems || []),
        JSON.stringify(data.alternativeOptions || []),
        data.notes || '',
        JSON.stringify(data.analytics || null),
        new Date().toISOString()
      ]
    );
    return { ...data, id, code };
  }

  public async updateProject(id: string, data: any): Promise<any> {
    const db = await this.getDb();
    const existing = (await this.getProjects()).find(p => p.id === id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    await db.query(
      `UPDATE projects SET code=$1, name=$2, client_name=$3, product_category=$4, product_sub_category=$5, more_sub_category=$6, target_product=$7, quoted_price=$8, currency=$9, target_margin_pct=$10, overhead_pct=$11, contingency_pct=$12, status=$13, start_date=$14, delivery_deadline=$15, contract_locked=$16, theme_id=$17, custom_gradient=$18, phases=$19, selected_items=$20, alternative_options=$21, notes=$22, analytics=$23 WHERE id=$24`,
      [
        merged.code,
        merged.name,
        merged.clientName,
        merged.productCategory || '',
        merged.productSubCategory || '',
        merged.moreSubCategory || '',
        merged.targetProduct || '',
        Number(merged.quotedPrice || 0),
        merged.currency || 'USD',
        Number(merged.targetMarginPct || 25),
        Number(merged.overheadPct || 5),
        Number(merged.contingencyPct || 3),
        merged.status || 'Proposal',
        merged.startDate || '',
        merged.deliveryDeadline || '',
        Boolean(merged.contractLocked),
        merged.themeId || null,
        merged.customGradient || null,
        JSON.stringify(merged.phases || []),
        JSON.stringify(merged.selectedItems || []),
        JSON.stringify(merged.alternativeOptions || []),
        merged.notes || '',
        JSON.stringify(merged.analytics || null),
        id
      ]
    );
    return merged;
  }

  public async deleteProject(id: string): Promise<boolean> {
    const db = await this.getDb();
    await db.query('DELETE FROM projects WHERE id=$1', [id]);
    return true;
  }

  // --- Categories CRUD ---
  public async getCategories(): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM categories ORDER BY created_at ASC');
    return res.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      group: r.group_name,
      parentId: r.parent_id,
      parentName: r.parent_name,
      brief: r.brief,
      itemCount: Number(r.item_count || 0),
      themeId: r.theme_id,
      customGradient: r.custom_gradient,
      icon: r.icon,
      metaBadge: r.meta_badge,
      actionText: r.action_text
    }));
  }

  // --- Inventory CRUD ---
  public async getInventory(): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM inventory ORDER BY created_at DESC');
    return res.rows.map((r: any) => ({
      id: r.id,
      sku: r.sku,
      name: r.name,
      itemName: r.item_name || r.name,
      category: r.category,
      materialId: r.material_id,
      allocatedProjectId: r.allocated_project_id,
      projectPhase: r.project_phase,
      onHand: Number(r.on_hand || 0),
      reserved: Number(r.reserved || 0),
      available: Number(r.available || 0),
      reorderLevel: Number(r.reorder_level || 0),
      unit: r.unit || 'pcs',
      unitCost: Number(r.unit_cost || 0),
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      status: r.status,
      location: r.location,
      barcode: r.barcode,
      lastAuditDate: r.last_audit_date
    }));
  }

  public async createInventory(data: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `inv-${Date.now()}`;
    await db.query(
      `INSERT INTO inventory (id, sku, name, item_name, category, material_id, allocated_project_id, project_phase, on_hand, reserved, available, reorder_level, unit, unit_cost, supplier_id, supplier_name, status, location, barcode, last_audit_date, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         sku = EXCLUDED.sku,
         category = EXCLUDED.category,
         on_hand = EXCLUDED.on_hand,
         reserved = EXCLUDED.reserved,
         available = EXCLUDED.available,
         unit_cost = EXCLUDED.unit_cost,
         status = EXCLUDED.status,
         location = EXCLUDED.location`,
      [
        id,
        data.sku || `SKU-${Date.now().toString().slice(-4)}`,
        data.name || data.itemName || 'Inventory Item',
        data.itemName || data.name || 'Inventory Item',
        data.category || 'Materials',
        data.materialId || null,
        data.allocatedProjectId || null,
        data.projectPhase || '',
        Number(data.onHand || 0),
        Number(data.reserved || 0),
        Number(data.available ?? (Number(data.onHand || 0) - Number(data.reserved || 0))),
        Number(data.reorderLevel || 5),
        data.unit || 'pcs',
        Number(data.unitCost || 0),
        data.supplierId || null,
        data.supplierName || '',
        data.status || 'Optimal',
        data.location || 'Warehouse',
        data.barcode || '',
        data.lastAuditDate || new Date().toISOString().split('T')[0],
        new Date().toISOString()
      ]
    );
    return { ...data, id };
  }

  public async updateInventory(id: string, data: any): Promise<any> {
    const db = await this.getDb();
    const existing = (await this.getInventory()).find(i => i.id === id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    await db.query(
      `UPDATE inventory SET sku=$1, name=$2, item_name=$3, category=$4, on_hand=$5, reserved=$6, available=$7, reorder_level=$8, unit=$9, unit_cost=$10, supplier_name=$11, status=$12, location=$13, barcode=$14, last_audit_date=$15 WHERE id=$16`,
      [
        merged.sku,
        merged.name,
        merged.itemName || merged.name,
        merged.category,
        Number(merged.onHand || 0),
        Number(merged.reserved || 0),
        Number(merged.available || 0),
        Number(merged.reorderLevel || 5),
        merged.unit,
        Number(merged.unitCost || 0),
        merged.supplierName || '',
        merged.status || 'Optimal',
        merged.location || '',
        merged.barcode || '',
        merged.lastAuditDate || new Date().toISOString().split('T')[0],
        id
      ]
    );
    return merged;
  }

  public async deleteInventory(id: string): Promise<boolean> {
    const db = await this.getDb();
    await db.query('DELETE FROM inventory WHERE id=$1', [id]);
    return true;
  }

  public async createCategory(data: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `cat-${Date.now()}`;
    await db.query(
      `INSERT INTO categories (id, name, type, group_name, parent_id, parent_name, brief, item_count, theme_id, custom_gradient, icon, meta_badge, action_text, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         type = EXCLUDED.type,
         group_name = EXCLUDED.group_name,
         parent_id = EXCLUDED.parent_id,
         parent_name = EXCLUDED.parent_name,
         brief = EXCLUDED.brief,
         theme_id = EXCLUDED.theme_id,
         custom_gradient = EXCLUDED.custom_gradient,
         meta_badge = EXCLUDED.meta_badge,
         action_text = EXCLUDED.action_text`,
      [
        id,
        data.name || 'New Category',
        data.type || 'category',
        data.group || data.groupName || 'material',
        data.parentId || null,
        data.parentName || null,
        data.brief || '',
        Number(data.itemCount || 0),
        data.themeId || null,
        data.customGradient || null,
        data.icon || null,
        data.metaBadge || null,
        data.actionText || null,
        new Date().toISOString()
      ]
    );
    return { ...data, id };
  }

  public async updateCategory(id: string, data: any): Promise<any> {
    const db = await this.getDb();
    const existing = (await this.getCategories()).find(c => c.id === id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    await db.query(
      `UPDATE categories SET name=$1, brief=$2, theme_id=$3, custom_gradient=$4, icon=$5, meta_badge=$6, action_text=$7 WHERE id=$8`,
      [
        merged.name,
        merged.brief || '',
        merged.themeId || null,
        merged.customGradient || null,
        merged.icon || null,
        merged.metaBadge || null,
        merged.actionText || null,
        id
      ]
    );
    return merged;
  }

  public async deleteCategory(id: string): Promise<boolean> {
    const db = await this.getDb();
    // Recursively delete children and item itself
    await db.query(
      'DELETE FROM categories WHERE id=$1 OR parent_id=$1 OR parent_id IN (SELECT id FROM categories WHERE parent_id=$1)',
      [id]
    );
    return true;
  }

  // --- Company Details CRUD ---
  public async getCompanyDetails(): Promise<any> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM company_details LIMIT 1');
    if (res.rows.length === 0) return INITIAL_COMPANY_DETAILS;
    const r = res.rows[0] as any;
    return {
      name: r.name,
      registrationNumber: r.registration_number,
      taxId: r.tax_id,
      address: r.address,
      city: r.city,
      country: r.country,
      phone: r.phone,
      email: r.email,
      website: r.website,
      currency: r.currency,
      logoUrl: r.logo_url,
      logoPosition: r.logo_position
    };
  }

  public async updateCompanyDetails(data: any): Promise<any> {
    const db = await this.getDb();
    const existing = await this.getCompanyDetails();
    const merged = { ...existing, ...data };
    await db.query(
      `INSERT INTO company_details (id, name, registration_number, tax_id, address, city, country, phone, email, website, currency, logo_url, logo_position, updated_at)
       VALUES ('comp-01', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         registration_number = EXCLUDED.registration_number,
         tax_id = EXCLUDED.tax_id,
         address = EXCLUDED.address,
         city = EXCLUDED.city,
         country = EXCLUDED.country,
         phone = EXCLUDED.phone,
         email = EXCLUDED.email,
         website = EXCLUDED.website,
         currency = EXCLUDED.currency,
         logo_url = EXCLUDED.logo_url,
         logo_position = EXCLUDED.logo_position,
         updated_at = EXCLUDED.updated_at`,
      [
        merged.name || 'FXTT Enterprise Solutions Ltd',
        merged.registrationNumber || '',
        merged.taxId || '',
        merged.address || '',
        merged.city || '',
        merged.country || '',
        merged.phone || '',
        merged.email || '',
        merged.website || '',
        merged.currency || 'USD',
        merged.logoUrl || null,
        merged.logoPosition || 'top_left',
        new Date().toISOString()
      ]
    );
    return merged;
  }

  // --- Users CRUD ---
  public async getUsers(): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query('SELECT id, employee_id, name, email, role, department, status, theme_preference, created_at, last_login FROM users ORDER BY created_at DESC');
    return res.rows.map((r: any) => ({
      id: r.id,
      employeeId: r.employee_id,
      name: r.name,
      email: r.email,
      role: r.role,
      department: r.department,
      status: r.status,
      themePreference: r.theme_preference,
      createdAt: r.created_at,
      lastLogin: r.last_login
    }));
  }

  public async createUser(data: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `usr-${Date.now()}`;
    await db.query(
      `INSERT INTO users (id, employee_id, name, email, role, department, status, theme_preference, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, email=EXCLUDED.email, role=EXCLUDED.role, department=EXCLUDED.department`,
      [
        id,
        data.employeeId || `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
        data.name,
        data.email,
        data.role || 'PROJECT_MANAGER',
        data.department || 'Operations',
        data.status || 'Active',
        data.themePreference || 'light',
        new Date().toISOString()
      ]
    );
    return { ...data, id };
  }

  public async updateUser(id: string, data: any): Promise<any> {
    const db = await this.getDb();
    const users = await this.getUsers();
    const existing = users.find(u => u.id === id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    await db.query(
      `UPDATE users SET name=$1, email=$2, role=$3, department=$4, status=$5, theme_preference=$6 WHERE id=$7`,
      [
        merged.name,
        merged.email,
        merged.role,
        merged.department,
        merged.status || 'Active',
        merged.themePreference || 'light',
        id
      ]
    );
    return merged;
  }

  // --- Auth users (full rows, server side only) ---
  public async getAuthUsers(): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM users ORDER BY created_at ASC');
    return res.rows.map((r: any) => ({
      id: r.id,
      employeeId: r.employee_id,
      name: r.name,
      email: r.email,
      role: r.role,
      department: r.department,
      status: r.status,
      themePreference: r.theme_preference,
      passwordHash: r.password_hash,
      passwordSalt: r.password_salt,
      twoFactorSecret: r.two_factor_secret,
      twoFactorEnabled: !!r.two_factor_enabled,
      createdAt: r.created_at,
      lastLogin: r.last_login
    }));
  }

  public async upsertAuthUser(u: any): Promise<void> {
    const db = await this.getDb();
    await db.query(
      `INSERT INTO users (id, employee_id, name, email, role, department, status, theme_preference,
                          password_hash, password_salt, two_factor_secret, two_factor_enabled, created_at, last_login)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (id) DO UPDATE SET
         employee_id=EXCLUDED.employee_id, name=EXCLUDED.name, email=EXCLUDED.email, role=EXCLUDED.role,
         department=EXCLUDED.department, status=EXCLUDED.status, theme_preference=EXCLUDED.theme_preference,
         password_hash=EXCLUDED.password_hash, password_salt=EXCLUDED.password_salt,
         two_factor_secret=EXCLUDED.two_factor_secret, two_factor_enabled=EXCLUDED.two_factor_enabled,
         last_login=EXCLUDED.last_login`,
      [
        u.id, u.employeeId, u.name, u.email, u.role || 'PROJECT_MANAGER', u.department || null,
        u.status || 'Active', u.themePreference || null, u.passwordHash || null, u.passwordSalt || null,
        u.twoFactorSecret || null, !!u.twoFactorEnabled,
        u.createdAt || new Date().toISOString(), u.lastLogin || null
      ]
    );
  }

  public async getKv(): Promise<Record<string, string>> {
    const db = await this.getDb();
    const res = await db.query('SELECT key, value FROM app_kv');
    const out: Record<string, string> = {};
    for (const r of res.rows) out[r.key] = r.value;
    return out;
  }

  public async setKv(key: string, value: string): Promise<void> {
    const db = await this.getDb();
    await db.query(
      `INSERT INTO app_kv (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`,
      [key, value]
    );
  }

  public async deleteKv(key: string): Promise<void> {
    const db = await this.getDb();
    await db.query('DELETE FROM app_kv WHERE key=$1', [key]);
  }

  public async getSecuritySettings(): Promise<any | null> {
    const db = await this.getDb();
    const res = await db.query("SELECT value FROM security_settings WHERE key='main'");
    return res.rows[0]?.value ?? null;
  }

  public async saveSecuritySettings(value: any): Promise<void> {
    const db = await this.getDb();
    await db.query(
      `INSERT INTO security_settings (key, value) VALUES ('main', $1::jsonb)
       ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`,
      [JSON.stringify(value)]
    );
  }

  public async deleteUser(id: string): Promise<boolean> {
    const db = await this.getDb();
    await db.query('DELETE FROM users WHERE id=$1', [id]);
    return true;
  }

  // --- Media Assets (Images / Logo in PostgreSQL) ---
  public async saveMediaAsset(filename: string, mimeType: string, dataUrl: string): Promise<{ id: string; url: string }> {
    const db = await this.getDb();
    const id = `img-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    await db.query(
      `INSERT INTO media_assets (id, filename, mime_type, data_url, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, filename || 'image.png', mimeType || 'image/png', dataUrl, new Date().toISOString()]
    );
    return { id, url: `/api/images/${id}` };
  }

  public async getMediaAsset(id: string): Promise<{ filename: string; mimeType: string; dataUrl: string } | null> {
    const db = await this.getDb();
    const res = await db.query('SELECT filename, mime_type, data_url FROM media_assets WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0] as any;
    return {
      filename: row.filename,
      mimeType: row.mime_type,
      dataUrl: row.data_url
    };
  }

  // --- Custom Tiles CRUD ---
  public async getCustomTiles(): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM custom_tiles ORDER BY created_at DESC');
    return res.rows.map((r: any) => ({
      id: r.id,
      group: r.group_name,
      tag: r.tag,
      title: r.title,
      brief: r.brief,
      action: r.action,
      themeId: r.theme_id,
      customGradient: r.custom_gradient,
      createdAt: r.created_at
    }));
  }

  public async createCustomTile(data: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `custom-tile-${Date.now()}`;
    await db.query(
      `INSERT INTO custom_tiles (id, group_name, tag, title, brief, action, theme_id, custom_gradient, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         group_name = EXCLUDED.group_name,
         tag = EXCLUDED.tag,
         title = EXCLUDED.title,
         brief = EXCLUDED.brief,
         action = EXCLUDED.action,
         theme_id = EXCLUDED.theme_id,
         custom_gradient = EXCLUDED.custom_gradient`,
      [
        id,
        data.group || data.groupName || 'general',
        data.tag || '',
        data.title || 'Custom Catalog Section',
        data.brief || '',
        data.action || 'OPEN CATALOG',
        data.themeId || null,
        data.customGradient || null,
        new Date().toISOString()
      ]
    );
    return { ...data, id };
  }

  public async deleteCustomTile(id: string): Promise<boolean> {
    const db = await this.getDb();
    await db.query('DELETE FROM custom_tiles WHERE id = $1', [id]);
    return true;
  }

  // --- Inventory Transactions CRUD ---
  public async getTransactions(): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM inventory_transactions ORDER BY timestamp DESC LIMIT 200');
    return res.rows.map((r: any) => ({
      id: r.id,
      transactionNumber: r.transaction_number,
      type: r.type,
      materialId: r.material_id,
      materialCode: r.material_code,
      materialName: r.material_name,
      projectId: r.project_id,
      projectName: r.project_name,
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      quantity: Number(r.quantity || 0),
      unit: r.unit || 'pcs',
      price: Number(r.price || 0),
      discount: Number(r.discount || 0),
      totalAmount: Number(r.total_amount || 0),
      previousQuantity: Number(r.previous_quantity || 0),
      newAvailableQuantity: Number(r.new_available_quantity || 0),
      actorName: r.actor_name,
      actorId: r.actor_id,
      timestamp: r.timestamp,
      notes: r.notes
    }));
  }

  public async createTransaction(data: any, actor?: { id?: string; name?: string }): Promise<any> {
    const type = String(data.type || '').toUpperCase();
    const qty = Number(data.quantity);
    if (!['IN', 'OUT'].includes(type)) throw Object.assign(new Error('Type must be IN or OUT'), { status: 400 });
    if (!Number.isFinite(qty) || qty <= 0) throw Object.assign(new Error('Quantity must be more than 0'), { status: 400 });

    const id = `txn-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const txNum = data.transactionNumber || `TXN-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

    return this.withTransaction(async (q) => {
      let previous = 0;
      let next = 0;
      let materialId: string | null = data.materialId || null;

      if (!materialId && data.materialCode) {
        const m = await q('SELECT id FROM materials WHERE code=$1', [data.materialCode]);
        materialId = m.rows[0]?.id || null;
      }
      if (!materialId) throw Object.assign(new Error('Material is required'), { status: 400 });

      // lock the material row so two people cannot change stock at once
      const mat = await q('SELECT in_stock, code, name, unit FROM materials WHERE id=$1 FOR UPDATE', [materialId]);
      if (!mat.rows[0]) throw Object.assign(new Error('Material not found'), { status: 404 });
      previous = Number(mat.rows[0].in_stock || 0);
      next = type === 'IN' ? previous + qty : previous - qty;
      if (next < 0) throw Object.assign(new Error(`Not enough stock. Available: ${previous}`), { status: 409 });

      await q('UPDATE materials SET in_stock=$1, last_updated=$2 WHERE id=$3', [next, new Date().toISOString().split('T')[0], materialId]);
      await q(
        'UPDATE inventory SET on_hand=$1, available=GREATEST(0, $1 - COALESCE(reserved,0)) WHERE material_id=$2',
        [next, materialId]
      );

      const price = Number(data.price || 0);
      const discount = Number(data.discount || 0);
      const total = Math.round(qty * price * (1 - discount / 100) * 100) / 100;

      await q(
        `INSERT INTO inventory_transactions (id, transaction_number, type, material_id, material_code, material_name, project_id, project_name, supplier_id, supplier_name, quantity, unit, price, discount, total_amount, previous_quantity, new_available_quantity, actor_name, actor_id, timestamp, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
        [
          id, txNum, type, materialId, mat.rows[0].code, mat.rows[0].name,
          data.projectId || null, data.projectName || '', data.supplierId || null, data.supplierName || '',
          qty, mat.rows[0].unit || data.unit || 'pcs', price, discount, total, previous, next,
          actor?.name || data.actorName || 'Unknown', actor?.id || data.actorId || null,
          new Date().toISOString(), data.notes || ''
        ]
      );

      return {
        ...data,
        id,
        transactionNumber: txNum,
        type,
        materialId,
        materialCode: mat.rows[0].code,
        materialName: mat.rows[0].name,
        quantity: qty,
        totalAmount: total,
        previousAvailableQuantity: previous,
        newAvailableQuantity: next
      };
    });
  }

  // --- Audit Logs CRUD ---
  public async getAuditLogs(): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 200');
    return res.rows.map((r: any) => ({
      id: r.id,
      timestamp: r.timestamp,
      actorId: r.actor_id,
      actorName: r.actor_name,
      actorRole: r.actor_role,
      action: r.action,
      module: r.module,
      recordId: r.record_id,
      recordName: r.record_name,
      details: r.details,
      ipAddress: r.ip_address,
      status: r.status
    }));
  }

  public async createAuditLog(data: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `log-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    await db.query(
      `INSERT INTO audit_logs (id, timestamp, actor_id, actor_name, actor_role, action, module, record_id, record_name, details, ip_address, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id,
        data.timestamp || new Date().toISOString(),
        data.actorId || 'usr-admin',
        data.actorName || 'System Auditor',
        data.actorRole || 'ADMIN',
        data.action || 'SYSTEM_EVENT',
        data.module || 'System',
        data.recordId || '',
        data.recordName || '',
        data.details || '',
        data.ipAddress || '127.0.0.1',
        data.status || 'Success'
      ]
    );
    return { ...data, id };
  }

  // --- Database Status ---
  public async getDbStats(): Promise<any> {
    const db = await this.getDb();
    const tables = [
      'clients', 'projects', 'suppliers', 'materials', 'outsourced_services',
      'subcontractors', 'produce_items', 'inventory', 'inventory_transactions',
      'categories', 'custom_tiles', 'company_details', 'users', 'media_assets', 'audit_logs'
    ];
    const counts: Record<string, number> = {};
    for (const t of tables) {
      try {
        const res = await db.query(`SELECT COUNT(*) as cnt FROM ${t}`);
        counts[t] = Number((res.rows[0] as any)?.cnt || 0);
      } catch {
        counts[t] = 0;
      }
    }
    return {
      connected: true,
      engine: 'PostgreSQL',
      database: 'inno_cost',
      isPrimary: true,
      soleDatabase: true,
      tableCounts: counts
    };
  }
}

export const postgresService = new PostgresService();
