import pg from 'pg';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { PGlite } from '@electric-sql/pglite';

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
import { round2, round4, calcDiscountedLine, calcPctChange, decAdd, decSub } from '../utils/decimalMath';
import { calculatePlanFinancials } from '../utils/planCalculationService';

// Parse PostgreSQL INT8 (OID 20), NUMERIC (OID 1700), and DATE (OID 1082)
pg.types.setTypeParser(20, (v: string) => parseInt(v, 10));
pg.types.setTypeParser(1700, (v: string) => parseFloat(v));
pg.types.setTypeParser(1082, (v: string) => String(v).slice(0, 10));

export interface Db {
  query(sql: string, params?: any[]): Promise<{ rows: any[] }>;
  exec(sql: string): Promise<void>;
}

export interface ListQueryOptions {
  page?: number;
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | 'ASC' | 'DESC';
  category?: string;
  subCategory?: string;
  status?: string;
  type?: string;
  group?: string;
  module?: string;
  action?: string;
  projectId?: string;
  planType?: string;
  supplierId?: string;
  materialId?: string;
  entityType?: string;
  entityId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const PGLITE_DATA_DIR = path.join(process.cwd(), 'data', 'inno_cost');
const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations');
const BACKUPS_DIR = path.join(process.cwd(), 'data', 'backups');

function formatSqlDate(val: any, fallback: string = ''): string {
  if (!val) return fallback ? String(fallback).slice(0, 10) : '';
  if (val instanceof Date || typeof val?.toISOString === 'function') {
    const t = typeof val.getTime === 'function' ? val.getTime() : NaN;
    return isNaN(t) ? (fallback ? String(fallback).slice(0, 10) : '') : val.toISOString().slice(0, 10);
  }
  const s = String(val);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return fallback ? String(fallback).slice(0, 10) : s.slice(0, 10);
}

function parseFilterPagination(
  rows: any[],
  opts?: ListQueryOptions,
  searchFields: string[] = ['name', 'code', 'category', 'status'],
  defaultSortField: string = ''
): PaginatedResult<any> {
  let filtered = rows;

  if (opts) {
    if (opts.category && opts.category !== 'ALL') {
      const catLower = opts.category.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          String(r.category || r.serviceCategory || r.productCategory || '').toLowerCase() === catLower
      );
    }
    if (opts.subCategory && opts.subCategory !== 'ALL') {
      const subLower = opts.subCategory.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          String(r.subCategory || r.serviceSubCategory || r.productSubCategory || '').toLowerCase() === subLower
      );
    }
    if (opts.status && opts.status !== 'ALL') {
      const stLower = opts.status.toLowerCase();
      filtered = filtered.filter((r) => String(r.status || '').toLowerCase() === stLower);
    }
    if (opts.type && opts.type !== 'ALL') {
      const tLower = opts.type.toLowerCase();
      filtered = filtered.filter((r) => String(r.type || r.planType || r.serviceType || '').toLowerCase() === tLower);
    }
    if (opts.planType && opts.planType !== 'ALL') {
      const ptLower = opts.planType.toLowerCase();
      filtered = filtered.filter((r) => String(r.planType || r.type || '').toLowerCase() === ptLower);
    }
    if (opts.group && opts.group !== 'ALL') {
      const gLower = opts.group.toLowerCase();
      filtered = filtered.filter((r) => String(r.group || '').toLowerCase() === gLower);
    }
    if (opts.module && opts.module !== 'ALL') {
      const mLower = opts.module.toLowerCase();
      filtered = filtered.filter((r) => String(r.module || '').toLowerCase() === mLower);
    }
    if (opts.action && opts.action !== 'ALL') {
      const aLower = opts.action.toLowerCase();
      filtered = filtered.filter((r) => String(r.action || '').toLowerCase() === aLower);
    }
    if (opts.projectId && opts.projectId !== 'ALL') {
      filtered = filtered.filter(
        (r) => r.projectId === opts.projectId || r.allocatedProjectId === opts.projectId || r.id === opts.projectId
      );
    }
    if (opts.supplierId && opts.supplierId !== 'ALL') {
      filtered = filtered.filter(
        (r) => r.supplierId === opts.supplierId || r.providerId === opts.supplierId || r.subcontractorId === opts.supplierId
      );
    }
    if (opts.materialId && opts.materialId !== 'ALL') {
      filtered = filtered.filter((r) => r.materialId === opts.materialId);
    }
    if (opts.entityType && opts.entityType !== 'ALL') {
      filtered = filtered.filter((r) => String(r.entityType || '').toLowerCase() === opts.entityType!.toLowerCase());
    }
    if (opts.entityId) {
      filtered = filtered.filter((r) => r.entityId === opts.entityId);
    }
    if (opts.fromDate) {
      filtered = filtered.filter((r) => {
        const d = String(r.effectiveDate || r.date || r.timestamp || r.lastUpdated || r.createdAt || '').slice(0, 10);
        return !d || d >= opts.fromDate!;
      });
    }
    if (opts.toDate) {
      filtered = filtered.filter((r) => {
        const d = String(r.effectiveDate || r.date || r.timestamp || r.lastUpdated || r.createdAt || '').slice(0, 10);
        return !d || d <= opts.toDate!;
      });
    }
    if (opts.search && opts.search.trim()) {
      const q = opts.search.trim().toLowerCase();
      filtered = filtered.filter((r) =>
        searchFields.some((f) => String(r[f] ?? '').toLowerCase().includes(q))
      );
    }

    const sortField = opts.sortBy || defaultSortField;
    if (sortField) {
      const dir = String(opts.sortOrder || 'asc').toLowerCase() === 'desc' ? -1 : 1;
      filtered = [...filtered].sort((a, b) => {
        const va = a[sortField];
        const vb = b[sortField];
        if (typeof va === 'number' && typeof vb === 'number') {
          return (va - vb) * dir;
        }
        return String(va ?? '').localeCompare(String(vb ?? ''), undefined, { numeric: true }) * dir;
      });
    }
  }

  const total = filtered.length;
  const limit = opts?.limit && opts.limit > 0 ? Math.min(1000, Number(opts.limit)) : total || 100;
  const page = opts?.page && opts.page > 0 ? Number(opts.page) : 1;
  const offset = opts?.offset !== undefined && opts.offset >= 0 ? Number(opts.offset) : (page - 1) * limit;

  const paged = opts?.limit || opts?.page || opts?.offset !== undefined ? filtered.slice(offset, offset + limit) : filtered;
  const totalPages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;

  return {
    data: paged,
    total,
    page,
    limit,
    totalPages
  };
}

export class PostgresService {
  private pool: pg.Pool | null = null;
  private pglite: PGlite | null = null;
  private db: Db | null = null;
  private isInitialized = false;
  private seeding = false;
  private initPromise: Promise<Db> | null = null;
  private txMutex: Promise<void> = Promise.resolve();

  public async getDb(): Promise<Db> {
    if (this.db && (this.isInitialized || this.seeding)) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const dbUrl = process.env.DATABASE_URL?.trim();
        if (dbUrl) {
          const pool = new pg.Pool({ connectionString: dbUrl, max: 10 });
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
        } else {
          if (!fs.existsSync(PGLITE_DATA_DIR)) {
            fs.mkdirSync(PGLITE_DATA_DIR, { recursive: true });
          }
          const lockFile = path.join(PGLITE_DATA_DIR, 'postmaster.pid');
          if (fs.existsSync(lockFile)) {
            try {
              fs.unlinkSync(lockFile);
            } catch {
              // ignore
            }
          }
          let pglite = new PGlite(PGLITE_DATA_DIR);
          try {
            await pglite.waitReady;
          } catch (lockErr) {
            console.warn('[PostgreSQL] Recovering local PGlite instance:', (lockErr as Error).message);
            pglite = new PGlite();
            await pglite.waitReady;
          }
          this.pglite = pglite;
          this.db = {
            query: async (sql, params) => {
              const r = await pglite.query(sql, params);
              return { rows: r.rows as any[] };
            },
            exec: async (sql) => {
              await pglite.exec(sql);
            }
          };
        }

        this.seeding = true;
        try {
          await this.initSchemaAndSeed();
          await this.runMigrations();
        } finally {
          this.seeding = false;
        }
        this.isInitialized = true;
        return this.db;
      } catch (err) {
        this.initPromise = null;
        this.pool = null;
        this.pglite = null;
        this.db = null;
        console.error('[PostgreSQL] connection failed:', (err as Error).message);
        throw err;
      }
    })();

    return this.initPromise;
  }

  // Run several queries as one atomic all-or-nothing transaction
  public async withTransaction<T>(fn: (q: (sql: string, params?: any[]) => Promise<{ rows: any[] }>) => Promise<T>): Promise<T> {
    await this.getDb();
    if (this.pool) {
      const client = await this.pool.connect();
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

    // Serialize transactions on single-connection PGlite
    let releaseMutex!: () => void;
    const prevMutex = this.txMutex;
    this.txMutex = new Promise<void>((resolve) => {
      releaseMutex = resolve;
    });
    await prevMutex;
    try {
      return await this.pglite!.transaction(async (tx) => {
        return await fn(async (sql, params) => {
          const r = await tx.query(sql, params);
          return { rows: r.rows as any[] };
        });
      });
    } finally {
      releaseMutex();
    }
  }

  private async initSchemaAndSeed() {
    const db = this.db!;
    try {
      const existing = await db.query("SELECT version FROM schema_migrations WHERE version = '002'");
      if (existing.rows.length > 0) {
        return;
      }
    } catch {
      // schema_migrations table does not exist yet; proceed with full baseline creation
    }

    // 1. Create Baseline Tables with NUMERIC precision and TIMESTAMPTZ
    await db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        checksum TEXT
      );

      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        tagline TEXT,
        industry TEXT,
        location TEXT,
        status TEXT DEFAULT 'Active Partner',
        active_projects_count INT DEFAULT 0,
        total_quoted_value NUMERIC(18, 2) DEFAULT 0,
        contact_person TEXT,
        email TEXT,
        phone TEXT,
        theme_id TEXT,
        custom_gradient TEXT,
        created_at TEXT,
        created_at_ts TIMESTAMPTZ DEFAULT NOW(),
        updated_at_ts TIMESTAMPTZ DEFAULT NOW()
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
        created_at TEXT,
        created_at_ts TIMESTAMPTZ DEFAULT NOW(),
        updated_at_ts TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY,
        code TEXT,
        name TEXT NOT NULL,
        category TEXT,
        supply_scope TEXT,
        rating NUMERIC(5, 2) DEFAULT 5.0,
        on_time_delivery_pct NUMERIC(6, 2) DEFAULT 100,
        quality_score_pct NUMERIC(6, 2) DEFAULT 100,
        lead_time_days INT DEFAULT 7,
        payment_terms TEXT,
        city TEXT,
        country TEXT,
        address TEXT,
        contact_person TEXT,
        email TEXT,
        phone TEXT,
        credit_limit NUMERIC(18, 2) DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        status TEXT DEFAULT 'Active',
        certifications JSONB DEFAULT '[]',
        contract_history JSONB DEFAULT '[]',
        notes TEXT,
        theme_id TEXT,
        custom_gradient TEXT,
        created_at TEXT,
        created_at_ts TIMESTAMPTZ DEFAULT NOW(),
        updated_at_ts TIMESTAMPTZ DEFAULT NOW()
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
        quoted_price NUMERIC(18, 2) DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        target_margin_pct NUMERIC(8, 2) DEFAULT 25,
        overhead_pct NUMERIC(8, 2) DEFAULT 5,
        contingency_pct NUMERIC(8, 2) DEFAULT 3,
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
        created_at TEXT,
        created_at_ts TIMESTAMPTZ DEFAULT NOW(),
        updated_at_ts TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS materials (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT,
        sub_category TEXT,
        more_sub_category TEXT,
        item_classification TEXT DEFAULT 'raw_material',
        unit TEXT DEFAULT 'pcs',
        current_price NUMERIC(18, 4) DEFAULT 0,
        last_price NUMERIC(18, 4) DEFAULT 0,
        default_discount_pct NUMERIC(8, 2) DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
        supplier_name TEXT,
        lead_time_days INT DEFAULT 7,
        in_stock NUMERIC(18, 4) DEFAULT 0,
        reorder_point NUMERIC(18, 4) DEFAULT 0,
        unit_cost NUMERIC(18, 4) DEFAULT 0,
        status TEXT DEFAULT 'Available',
        barcode TEXT,
        volume_pricing JSONB DEFAULT '[]',
        price_history JSONB DEFAULT '[]',
        theme_id TEXT,
        custom_gradient TEXT,
        effective_date DATE DEFAULT CURRENT_DATE,
        last_updated TEXT,
        created_at TEXT,
        created_at_ts TIMESTAMPTZ DEFAULT NOW(),
        updated_at_ts TIMESTAMPTZ DEFAULT NOW()
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
        rate NUMERIC(18, 4) DEFAULT 0,
        retail_price NUMERIC(18, 4) DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        quality_tier TEXT DEFAULT 'Standard',
        sla_level TEXT DEFAULT 'Tier-1 SLA (99.5%)',
        status TEXT DEFAULT 'Active',
        tier_rates JSONB DEFAULT '[]',
        price_history JSONB DEFAULT '[]',
        theme_id TEXT,
        custom_gradient TEXT,
        effective_date DATE DEFAULT CURRENT_DATE,
        last_updated TEXT,
        created_at TEXT,
        created_at_ts TIMESTAMPTZ DEFAULT NOW(),
        updated_at_ts TIMESTAMPTZ DEFAULT NOW()
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
        base_rate NUMERIC(18, 4) DEFAULT 0,
        rate NUMERIC(18, 4) DEFAULT 0,
        retail_rate NUMERIC(18, 4) DEFAULT 0,
        shift_multiplier NUMERIC(8, 4) DEFAULT 1.0,
        full_contract_estimate NUMERIC(18, 2) DEFAULT 0,
        unit TEXT DEFAULT 'hr',
        currency TEXT DEFAULT 'USD',
        rating NUMERIC(5, 2) DEFAULT 4.9,
        quality_score_pct NUMERIC(6, 2) DEFAULT 99.0,
        weekly_capacity NUMERIC(10, 2) DEFAULT 160,
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
        effective_date DATE DEFAULT CURRENT_DATE,
        last_updated TEXT,
        created_at TEXT,
        created_at_ts TIMESTAMPTZ DEFAULT NOW(),
        updated_at_ts TIMESTAMPTZ DEFAULT NOW()
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
        cost_price NUMERIC(18, 4) DEFAULT 0,
        retail_price NUMERIC(18, 4) DEFAULT 0,
        default_discount_pct NUMERIC(8, 2) DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        bundles_and_ranges JSONB DEFAULT '[]',
        lead_time_days INT DEFAULT 14,
        status TEXT DEFAULT 'Active',
        price_history JSONB DEFAULT '[]',
        theme_id TEXT,
        custom_gradient TEXT,
        effective_date DATE DEFAULT CURRENT_DATE,
        last_updated TEXT,
        barcode TEXT,
        created_at TEXT,
        created_at_ts TIMESTAMPTZ DEFAULT NOW(),
        updated_at_ts TIMESTAMPTZ DEFAULT NOW()
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
        on_hand NUMERIC(18, 4) DEFAULT 0,
        reserved NUMERIC(18, 4) DEFAULT 0,
        available NUMERIC(18, 4) DEFAULT 0,
        reorder_level NUMERIC(18, 4) DEFAULT 0,
        unit TEXT DEFAULT 'pcs',
        unit_cost NUMERIC(18, 4) DEFAULT 0,
        supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
        supplier_name TEXT,
        status TEXT DEFAULT 'Optimal',
        location TEXT,
        barcode TEXT,
        last_audit_date TEXT,
        created_at TEXT,
        created_at_ts TIMESTAMPTZ DEFAULT NOW(),
        updated_at_ts TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS inventory_transactions (
        id TEXT PRIMARY KEY,
        transaction_number TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        material_id TEXT,
        material_code TEXT,
        material_name TEXT,
        project_id TEXT,
        project_code TEXT,
        project_name TEXT,
        supplier_id TEXT,
        supplier_name TEXT,
        barcode TEXT,
        inventory_sku TEXT,
        batch_lot_number TEXT,
        requisition_number TEXT,
        currency TEXT DEFAULT 'USD',
        quantity NUMERIC(18, 4) NOT NULL,
        unit TEXT,
        price NUMERIC(18, 4) NOT NULL,
        discount NUMERIC(8, 2) DEFAULT 0,
        discount_amount NUMERIC(18, 2) DEFAULT 0,
        total_amount NUMERIC(18, 2) NOT NULL,
        previous_quantity NUMERIC(18, 4),
        new_available_quantity NUMERIC(18, 4),
        actor_name TEXT,
        actor_id TEXT,
        effective_date DATE DEFAULT CURRENT_DATE,
        timestamp TEXT NOT NULL,
        notes TEXT,
        idempotency_key TEXT,
        created_at_ts TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS price_history_records (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL CHECK (entity_type IN ('material', 'outsourced', 'subcontractor', 'produce')),
        entity_id TEXT NOT NULL,
        entity_code TEXT,
        entity_name TEXT,
        previous_price NUMERIC(18, 4) NOT NULL DEFAULT 0,
        new_price NUMERIC(18, 4) NOT NULL DEFAULT 0,
        retail_price NUMERIC(18, 4),
        change_pct NUMERIC(10, 2) NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'USD',
        effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
        recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reason TEXT,
        updated_by TEXT,
        idempotency_key TEXT UNIQUE
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
        created_at TEXT,
        created_at_ts TIMESTAMPTZ DEFAULT NOW(),
        updated_at_ts TIMESTAMPTZ DEFAULT NOW()
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
        submitted_at_ts TIMESTAMPTZ DEFAULT NOW(),
        reviewed_by TEXT,
        reviewed_at_ts TIMESTAMPTZ,
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
        status TEXT DEFAULT 'Success',
        created_at_ts TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS media_assets (
        id TEXT PRIMARY KEY,
        filename TEXT,
        mime_type TEXT,
        data_url TEXT,
        created_at TEXT
      );

      ALTER TABLE projects ADD COLUMN IF NOT EXISTS active_plan_id TEXT;

      CREATE TABLE IF NOT EXISTS project_plans (
        id TEXT PRIMARY KEY,
        plan_number TEXT UNIQUE NOT NULL,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        plan_type TEXT NOT NULL DEFAULT 'Baseline',
        status TEXT NOT NULL DEFAULT 'Draft',
        revision_number INT NOT NULL DEFAULT 1,
        version_label TEXT NOT NULL DEFAULT 'v1.0',
        is_baseline BOOLEAN NOT NULL DEFAULT false,
        is_active BOOLEAN NOT NULL DEFAULT false,
        currency TEXT NOT NULL DEFAULT 'USD',
        planned_revenue NUMERIC(18, 2) NOT NULL DEFAULT 0,
        target_margin_pct NUMERIC(8, 2) NOT NULL DEFAULT 25,
        overhead_pct NUMERIC(8, 2) NOT NULL DEFAULT 8.5,
        contingency_pct NUMERIC(8, 2) NOT NULL DEFAULT 5.0,
        labor_burden_pct NUMERIC(8, 2) NOT NULL DEFAULT 0,
        effective_date DATE DEFAULT CURRENT_DATE,
        approval_date DATE,
        approved_by TEXT,
        created_by TEXT NOT NULL DEFAULT 'System',
        updated_by TEXT NOT NULL DEFAULT 'System',
        theme_id TEXT,
        custom_gradient TEXT,
        template_id TEXT,
        source_project_id TEXT,
        source_project_code TEXT,
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS project_plan_revisions (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        revision_number INT NOT NULL DEFAULT 1,
        version_label TEXT NOT NULL DEFAULT 'v1.0',
        change_summary TEXT NOT NULL DEFAULT 'Initial plan creation',
        status_at_revision TEXT NOT NULL DEFAULT 'Draft',
        planned_revenue NUMERIC(18, 2) NOT NULL DEFAULT 0,
        direct_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
        allocated_overhead NUMERIC(18, 2) NOT NULL DEFAULT 0,
        total_planned_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
        planned_profit NUMERIC(18, 2) NOT NULL DEFAULT 0,
        profit_margin_pct NUMERIC(8, 2) NOT NULL DEFAULT 0,
        changed_by TEXT NOT NULL DEFAULT 'System',
        effective_date DATE DEFAULT CURRENT_DATE,
        snapshot_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS project_plan_sections (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        phase_code TEXT NOT NULL DEFAULT 'PH-01',
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        sequence_order INT NOT NULL DEFAULT 1,
        planned_budget NUMERIC(18, 2) NOT NULL DEFAULT 0,
        material_budget NUMERIC(18, 2) NOT NULL DEFAULT 0,
        labor_budget NUMERIC(18, 2) NOT NULL DEFAULT 0,
        outsourced_budget NUMERIC(18, 2) NOT NULL DEFAULT 0,
        actual_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
        start_date DATE,
        end_date DATE,
        status TEXT NOT NULL DEFAULT 'Not Started',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS project_plan_boq_items (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        section_id TEXT REFERENCES project_plan_sections(id) ON DELETE SET NULL,
        phase_id TEXT DEFAULT 'phase-01',
        item_type TEXT NOT NULL DEFAULT 'material',
        catalog_item_id TEXT,
        item_code TEXT,
        name TEXT NOT NULL,
        category TEXT DEFAULT '',
        supplier_or_provider TEXT DEFAULT '',
        quantity NUMERIC(18, 4) NOT NULL DEFAULT 1,
        unit TEXT NOT NULL DEFAULT 'pcs',
        unit_cost NUMERIC(18, 4) NOT NULL DEFAULT 0,
        discount_pct NUMERIC(8, 2) NOT NULL DEFAULT 0,
        total_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
        markup_pct NUMERIC(8, 2) NOT NULL DEFAULT 0,
        billable_rate NUMERIC(18, 4) NOT NULL DEFAULT 0,
        total_revenue NUMERIC(18, 2) NOT NULL DEFAULT 0,
        gross_profit NUMERIC(18, 2) NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'USD',
        native_unit_cost NUMERIC(18, 4),
        consumption_rate NUMERIC(8, 2) DEFAULT 100,
        notes TEXT DEFAULT '',
        line_order INT NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS project_plan_resources (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        section_id TEXT REFERENCES project_plan_sections(id) ON DELETE SET NULL,
        resource_id TEXT NOT NULL,
        resource_type TEXT NOT NULL DEFAULT 'subcontractor',
        name TEXT NOT NULL,
        role_or_trade TEXT DEFAULT '',
        allocated_hours NUMERIC(12, 2) NOT NULL DEFAULT 0,
        hourly_rate NUMERIC(18, 4) NOT NULL DEFAULT 0,
        total_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
        start_date DATE,
        end_date DATE,
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS project_plan_overhead_allocations (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        allocation_type TEXT NOT NULL DEFAULT 'percentage',
        rate_pct NUMERIC(8, 2) NOT NULL DEFAULT 0,
        base_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
        allocated_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS project_plan_cost_summaries (
        plan_id TEXT PRIMARY KEY REFERENCES project_plans(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        planned_revenue NUMERIC(18, 2) NOT NULL DEFAULT 0,
        material_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
        subcontractor_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
        outsourced_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
        resource_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
        direct_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
        overhead_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
        contingency_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
        labor_burden_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
        extra_overhead_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
        allocated_overhead NUMERIC(18, 2) NOT NULL DEFAULT 0,
        total_planned_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
        gross_profit NUMERIC(18, 2) NOT NULL DEFAULT 0,
        gross_margin_pct NUMERIC(8, 2) NOT NULL DEFAULT 0,
        planned_profit NUMERIC(18, 2) NOT NULL DEFAULT 0,
        profit_margin_pct NUMERIC(8, 2) NOT NULL DEFAULT 0,
        boq_item_count INT NOT NULL DEFAULT 0,
        section_count INT NOT NULL DEFAULT 0,
        resource_count INT NOT NULL DEFAULT 0,
        calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.seedIfEmpty();
  }

  private async seedIfEmpty() {
    // Intentionally do not seed unrelated demo-company data.
  }

  /**
   * Back up existing database records before applying new SQL migrations.
   */
  public async createPreMigrationBackup(migrationVersion: string): Promise<string | null> {
    try {
      const db = this.db!;
      const countRes = await db.query('SELECT COUNT(*) as cnt FROM materials');
      const matCount = Number(countRes.rows[0]?.cnt || 0);
      const prjRes = await db.query('SELECT COUNT(*) as cnt FROM projects');
      const prjCount = Number(prjRes.rows[0]?.cnt || 0);
      if (matCount === 0 && prjCount === 0) return null;

      if (!fs.existsSync(BACKUPS_DIR)) {
        fs.mkdirSync(BACKUPS_DIR, { recursive: true });
      }
      const backupFile = path.join(BACKUPS_DIR, `backup_pre_mig_${migrationVersion}_${Date.now()}.json`);
      const tables = [
        'clients', 'projects', 'suppliers', 'materials', 'outsourced_services',
        'subcontractors', 'produce_items', 'inventory', 'inventory_transactions',
        'categories', 'custom_tiles', 'company_details', 'account_requests', 'audit_logs'
      ];
      const snapshot: Record<string, any[]> = {};
      for (const t of tables) {
        try {
          const r = await db.query(`SELECT * FROM ${t}`);
          snapshot[t] = r.rows;
        } catch {
          snapshot[t] = [];
        }
      }
      fs.writeFileSync(backupFile, JSON.stringify({ backedUpAt: new Date().toISOString(), migrationVersion, snapshot }, null, 2));
      return backupFile;
    } catch (e) {
      console.warn('[PostgreSQL] Pre-migration backup warning:', (e as Error).message);
      return null;
    }
  }

  public async createBackup(label: string = 'manual'): Promise<{ backupPath: string; createdAt: string; tablesCount: number }> {
    const db = await this.getDb();
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
    const createdAt = new Date().toISOString();
    const safeLabel = String(label || 'manual').replace(/[^a-zA-Z0-9_-]/g, '_');
    const backupFile = path.join(BACKUPS_DIR, `backup_${safeLabel}_${Date.now()}.json`);
    const tables = [
      'clients', 'projects', 'suppliers', 'materials', 'outsourced_services',
      'subcontractors', 'produce_items', 'inventory', 'inventory_transactions',
      'price_history_records', 'categories', 'custom_tiles', 'company_details',
      'account_requests', 'audit_logs', 'schema_migrations'
    ];
    const snapshot: Record<string, any[]> = {};
    for (const t of tables) {
      try {
        const r = await db.query(`SELECT * FROM ${t}`);
        snapshot[t] = r.rows;
      } catch {
        snapshot[t] = [];
      }
    }
    fs.writeFileSync(backupFile, JSON.stringify({ backedUpAt: createdAt, label: safeLabel, snapshot }, null, 2));
    return {
      backupPath: backupFile,
      createdAt,
      tablesCount: tables.length
    };
  }

  /**
   * Apply additive SQL migrations from /migrations directory and backfill normalized tables.
   */
  public async runMigrations(): Promise<void> {
    const db = this.db!;
    if (!fs.existsSync(MIGRATIONS_DIR)) return;

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
      .sort();

    let appliedAny = false;
    for (const file of files) {
      const version = file.split('_')[0];
      const existing = await db.query('SELECT version FROM schema_migrations WHERE version = $1', [version]);
      if (existing.rows.length > 0) continue;

      const sqlPath = path.join(MIGRATIONS_DIR, file);
      const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
      const checksum = crypto.createHash('sha256').update(sqlContent).digest('hex');

      await this.createPreMigrationBackup(version);
      await db.exec(sqlContent);
      await db.query(
        `INSERT INTO schema_migrations (version, name, applied_at, checksum)
         VALUES ($1, $2, NOW(), $3)
         ON CONFLICT (version) DO NOTHING`,
        [version, file, checksum]
      );
      appliedAny = true;
      console.log(`[PostgreSQL] Applied migration ${file}`);
    }

    if (appliedAny) {
      // Backfill normalized price_history_records from existing JSONB price_history / rate_history arrays
      await this.backfillPriceHistoryRecords();
      // Backfill normalized project_plans from existing projects
      await this.backfillProjectPlans();
    }
  }

  private async backfillProjectPlans(): Promise<void> {
    const db = this.db!;
    try {
      const prjRes = await db.query('SELECT * FROM projects ORDER BY created_at ASC');
      for (const p of prjRes.rows) {
        const existingPlans = await db.query('SELECT id FROM project_plans WHERE project_id = $1', [p.id]);
        if (existingPlans.rows.length > 0) continue;

        const selectedItems = typeof p.selected_items === 'string' ? JSON.parse(p.selected_items) : p.selected_items || [];
        const phases = typeof p.phases === 'string' ? JSON.parse(p.phases) : p.phases || [];

        await this.createProjectPlan(
          {
            id: `plan-${p.id}-baseline`,
            planNumber: `PLN-${String(p.code || p.id).toUpperCase().replace(/[^A-Z0-9-]/g, '')}-01`,
            projectId: p.id,
            name: 'Plan A: Certified Enterprise Sourcing (Baseline)',
            description: 'Primary baseline plan migrated from project record.',
            planType: 'Baseline',
            status: p.contract_locked ? 'Locked' : 'Approved',
            revisionNumber: 1,
            versionLabel: 'v1.0',
            isBaseline: true,
            isActive: true,
            currency: p.currency || 'USD',
            plannedRevenue: round2(p.quoted_price || 0),
            targetMarginPct: round2(p.target_margin_pct || 25),
            overheadPct: round2(p.overhead_pct || 8.5),
            contingencyPct: round2(p.contingency_pct || 5.0),
            laborBurdenPct: 0,
            effectiveDate: formatSqlDate(p.start_date || p.created_date, new Date().toISOString().slice(0, 10)),
            approvalDate: formatSqlDate(p.created_date, new Date().toISOString().slice(0, 10)),
            approvedBy: 'Enterprise System Migration',
            createdBy: 'System Migration',
            updatedBy: 'System Migration',
            themeId: p.theme_id || 'airbus-cobalt',
            customGradient: p.custom_gradient || null,
            selectedItems,
            sections: phases.map((ph: any, idx: number) => ({
              id: ph.id || `sec-${p.id}-${idx + 1}`,
              phaseCode: `PH-0${idx + 1}`,
              name: ph.name || `Phase ${idx + 1}`,
              description: ph.description || '',
              sequenceOrder: idx + 1,
              plannedBudget: round2(ph.budget || 0),
              materialBudget: round2(ph.materialBudget || 0),
              laborBudget: round2(ph.laborBudget || 0),
              outsourcedBudget: round2(ph.outsourcedBudget || 0),
              actualCost: round2(ph.actualCost || 0),
              startDate: ph.startDate || null,
              endDate: ph.endDate || null,
              status: ph.status || 'Not Started'
            }))
          },
          { id: 'SYSTEM', name: 'System Migration' }
        ).catch((err) => {
          console.warn('[PostgreSQL] Could not backfill baseline plan for project', p.id, err?.message);
        });
      }
    } catch (e) {
      console.warn('[PostgreSQL] Backfill project plans warning:', (e as Error).message);
    }
  }

  private async backfillPriceHistoryRecords(): Promise<void> {
    const db = this.db!;
    try {
      const mats = await db.query('SELECT id, code, name, currency, price_history FROM materials');
      for (const m of mats.rows) {
        const hist = typeof m.price_history === 'string' ? JSON.parse(m.price_history) : m.price_history || [];
        for (const h of hist) {
          if (!h || !h.id) continue;
          await db.query(
            `INSERT INTO price_history_records
              (id, entity_type, entity_id, entity_code, entity_name, previous_price, new_price, change_pct, currency, effective_date, reason, updated_by, idempotency_key)
             VALUES ($1, 'material', $2, $3, $4, $5, $6, $7, $8, COALESCE($9::date, CURRENT_DATE), $10, $11, $12)
             ON CONFLICT (id) DO NOTHING`,
            [
              String(h.id),
              m.id,
              m.code,
              m.name,
              round4(h.previousPrice ?? h.oldPrice ?? 0),
              round4(h.newPrice ?? 0),
              round2(h.changePct ?? 0),
              m.currency || 'USD',
              (h.date || new Date().toISOString()).slice(0, 10),
              h.reason || '',
              h.updatedBy || 'System',
              `bf-mat-${m.id}-${h.id}`
            ]
          ).catch(() => {});
        }
      }
    } catch {
      // ignore backfill errors
    }
  }

  public async getMigrations(): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query('SELECT version, name, applied_at, checksum FROM schema_migrations ORDER BY version ASC');
    return res.rows;
  }

  public async clearDummyData(): Promise<void> {
    const db = await this.getDb();
    await db.exec(`
      DELETE FROM project_plan_cost_summaries;
      DELETE FROM project_plan_overhead_allocations;
      DELETE FROM project_plan_resources;
      DELETE FROM project_plan_boq_items;
      DELETE FROM project_plan_sections;
      DELETE FROM project_plan_revisions;
      DELETE FROM project_plans;
      DELETE FROM price_history_records;
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
  public async getClients(opts?: ListQueryOptions): Promise<any[]> {
    const res = await this.getClientsPaginated(opts);
    return res.data;
  }

  public async getClientsPaginated(opts?: ListQueryOptions): Promise<PaginatedResult<any>> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM clients ORDER BY created_at DESC');
    const rows = res.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      tagline: r.tagline,
      industry: r.industry,
      location: r.location,
      status: r.status,
      activeProjectsCount: Number(r.active_projects_count || 0),
      totalQuotedValue: round2(r.total_quoted_value || 0),
      contactPerson: r.contact_person,
      email: r.email,
      phone: r.phone,
      themeId: r.theme_id,
      customGradient: r.custom_gradient,
      createdAt: r.created_at
    }));
    return parseFilterPagination(rows, opts, ['name', 'industry', 'location', 'contactPerson', 'email', 'status']);
  }

  public async createClient(data: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `cli-${Date.now()}`;
    const name = String(data.name || 'New Client').trim();
    const totalQuotedValue = round2(data.totalQuotedValue || 0);
    const createdAt = data.createdAt || new Date().toISOString();

    await db.query(
      `INSERT INTO clients (id, name, tagline, industry, location, status, active_projects_count, total_quoted_value, contact_person, email, phone, theme_id, custom_gradient, created_at, updated_at_ts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
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
         custom_gradient = EXCLUDED.custom_gradient,
         updated_at_ts = NOW()`,
      [
        id,
        name,
        data.tagline || '',
        data.industry || '',
        data.location || '',
        data.status || 'Active Partner',
        Number(data.activeProjectsCount || 1),
        totalQuotedValue,
        data.contactPerson || '',
        data.email || '',
        data.phone || '',
        data.themeId || 'pacific-sky',
        data.customGradient || null,
        createdAt
      ]
    );
    return { ...data, id, name, totalQuotedValue };
  }

  public async updateClient(id: string, data: any): Promise<any> {
    const db = await this.getDb();
    const existing = (await this.getClients()).find((c) => c.id === id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    const totalQuotedValue = round2(merged.totalQuotedValue || 0);
    await db.query(
      `UPDATE clients SET name=$1, tagline=$2, industry=$3, location=$4, status=$5, active_projects_count=$6, total_quoted_value=$7, contact_person=$8, email=$9, phone=$10, theme_id=$11, custom_gradient=$12, updated_at_ts=NOW() WHERE id=$13`,
      [
        merged.name,
        merged.tagline || '',
        merged.industry || '',
        merged.location || '',
        merged.status || 'Active Partner',
        Number(merged.activeProjectsCount || 0),
        totalQuotedValue,
        merged.contactPerson || '',
        merged.email || '',
        merged.phone || '',
        merged.themeId || 'pacific-sky',
        merged.customGradient || null,
        id
      ]
    );
    return { ...merged, totalQuotedValue };
  }

  public async deleteClient(id: string): Promise<boolean> {
    const db = await this.getDb();
    await db.query('DELETE FROM clients WHERE id=$1', [id]);
    return true;
  }

  // --- Suppliers CRUD ---
  public async getSuppliers(opts?: ListQueryOptions): Promise<any[]> {
    const res = await this.getSuppliersPaginated(opts);
    return res.data;
  }

  public async getSuppliersPaginated(opts?: ListQueryOptions): Promise<PaginatedResult<any>> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM suppliers ORDER BY created_at DESC');
    const rows = res.rows.map((r: any) => ({
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
      creditLimit: round2(r.credit_limit || 0),
      currency: r.currency || 'USD',
      status: r.status,
      certifications: typeof r.certifications === 'string' ? JSON.parse(r.certifications) : r.certifications || [],
      contractHistory: typeof r.contract_history === 'string' ? JSON.parse(r.contract_history) : r.contract_history || [],
      notes: r.notes,
      themeId: r.theme_id,
      customGradient: r.custom_gradient,
      createdAt: r.created_at
    }));
    return parseFilterPagination(rows, opts, ['name', 'code', 'category', 'city', 'country', 'contactPerson', 'email']);
  }

  public async createSupplier(data: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `sup-${Date.now()}`;
    let code = String(data.code || id.toUpperCase()).trim();
    try {
      const existingCode = await db.query('SELECT id FROM suppliers WHERE code = $1 AND id != $2', [code, id]);
      if (existingCode.rows.length > 0) {
        code = `${code}-${Math.floor(100 + Math.random() * 900)}`;
      }
    } catch {
      // ignore
    }

    await db.query(
      `INSERT INTO suppliers (id, code, name, category, supply_scope, rating, on_time_delivery_pct, quality_score_pct, lead_time_days, payment_terms, city, country, address, contact_person, email, phone, credit_limit, currency, status, certifications, contract_history, notes, theme_id, custom_gradient, created_at, updated_at_ts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         code = EXCLUDED.code,
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
         custom_gradient = EXCLUDED.custom_gradient,
         updated_at_ts = NOW()`,
      [
        id,
        code,
        data.name || 'New Supplier',
        data.category || 'Materials',
        data.supplyScope || 'materials',
        round2(data.rating ?? 5.0),
        round2(data.onTimeDeliveryPct ?? 100),
        round2(data.qualityScorePct ?? 100),
        Number(data.leadTimeDays || 7),
        data.paymentTerms || 'Net 30',
        data.city || '',
        data.country || 'USA',
        data.address || '',
        data.contactPerson || '',
        data.email || '',
        data.phone || '',
        round2(data.creditLimit || 0),
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
    return { ...data, id, code };
  }

  public async updateSupplier(id: string, data: any): Promise<any> {
    const db = await this.getDb();
    const existing = (await this.getSuppliers()).find((s) => s.id === id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    await db.query(
      `UPDATE suppliers SET code=$1, name=$2, category=$3, supply_scope=$4, rating=$5, on_time_delivery_pct=$6, quality_score_pct=$7, lead_time_days=$8, payment_terms=$9, city=$10, country=$11, address=$12, contact_person=$13, email=$14, phone=$15, credit_limit=$16, currency=$17, status=$18, certifications=$19, contract_history=$20, notes=$21, theme_id=$22, custom_gradient=$23, updated_at_ts=NOW() WHERE id=$24`,
      [
        merged.code,
        merged.name,
        merged.category,
        merged.supplyScope,
        round2(merged.rating ?? 5),
        round2(merged.onTimeDeliveryPct ?? 100),
        round2(merged.qualityScorePct ?? 100),
        Number(merged.leadTimeDays || 7),
        merged.paymentTerms,
        merged.city,
        merged.country,
        merged.address,
        merged.contactPerson,
        merged.email,
        merged.phone,
        round2(merged.creditLimit || 0),
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
  public async getMaterials(opts?: ListQueryOptions): Promise<any[]> {
    const res = await this.getMaterialsPaginated(opts);
    return res.data;
  }

  public async getMaterialsPaginated(opts?: ListQueryOptions): Promise<PaginatedResult<any>> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM materials ORDER BY created_at DESC');
    const rows = res.rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      category: r.category,
      subCategory: r.sub_category,
      moreSubCategory: r.more_sub_category,
      itemClassification: r.item_classification || 'raw_material',
      unit: r.unit,
      currentPrice: round4(r.current_price || 0),
      lastPrice: round4(r.last_price || 0),
      retailPrice: round4(r.current_price || 0),
      defaultDiscountPct: round2(r.default_discount_pct || 0),
      currency: r.currency || 'USD',
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      leadTimeDays: Number(r.lead_time_days || 7),
      inStock: round4(r.in_stock || 0),
      reorderPoint: round4(r.reorder_point || 0),
      unitCost: round4(r.unit_cost || 0),
      status: r.status,
      barcode: r.barcode,
      volumePricing: typeof r.volume_pricing === 'string' ? JSON.parse(r.volume_pricing) : r.volume_pricing || [],
      priceHistory: typeof r.price_history === 'string' ? JSON.parse(r.price_history) : r.price_history || [],
      themeId: r.theme_id,
      customGradient: r.custom_gradient,
      effectiveDate: formatSqlDate(r.effective_date, r.last_updated),
      lastUpdated: r.last_updated
    }));
    return parseFilterPagination(rows, opts, ['name', 'code', 'category', 'subCategory', 'supplierName', 'barcode']);
  }

  public async createMaterial(data: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `mat-${Date.now()}`;
    const price = round4(data.currentPrice ?? data.retailPrice ?? data.unitPrice ?? 0);
    if (price < 0) throw Object.assign(new Error('Material price cannot be negative'), { status: 400 });

    let code = (data.code || `MAT-${Math.floor(1000 + Math.random() * 9000)}`).trim();
    try {
      const existingCode = await db.query('SELECT id FROM materials WHERE code = $1 AND id != $2', [code, id]);
      if (existingCode.rows.length > 0) {
        code = `${code}-${Math.floor(100 + Math.random() * 900)}`;
      }
    } catch {
      // ignore
    }

    const effectiveDate = (data.effectiveDate || data.lastUpdated || new Date().toISOString()).slice(0, 10);

    await db.query(
      `INSERT INTO materials (id, code, name, category, sub_category, more_sub_category, item_classification, unit, current_price, last_price, default_discount_pct, currency, supplier_id, supplier_name, lead_time_days, in_stock, reorder_point, unit_cost, status, barcode, volume_pricing, price_history, theme_id, custom_gradient, effective_date, last_updated, created_at, updated_at_ts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, NOW())
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
         effective_date = EXCLUDED.effective_date,
         last_updated = EXCLUDED.last_updated,
         updated_at_ts = NOW()`,
      [
        id,
        code,
        data.name || 'New Material',
        data.category || 'Raw Materials',
        data.subCategory || '',
        data.moreSubCategory || '',
        data.itemClassification || 'raw_material',
        data.unit || 'pcs',
        price,
        price,
        round2(data.defaultDiscountPct || 0),
        data.currency || 'USD',
        data.supplierId || null,
        data.supplierName || '',
        Number(data.leadTimeDays || 7),
        Math.max(0, round4(data.inStock || 0)),
        Math.max(0, round4(data.reorderPoint || 0)),
        round4(data.unitCost ?? price * 0.8),
        data.status || 'Available',
        data.barcode || code,
        JSON.stringify(data.volumePricing || []),
        JSON.stringify(data.priceHistory || []),
        data.themeId || null,
        data.customGradient || null,
        effectiveDate,
        effectiveDate,
        new Date().toISOString()
      ]
    );
    return { ...data, id, code, currentPrice: price, retailPrice: price, effectiveDate, lastUpdated: effectiveDate };
  }

  public async updateMaterial(id: string, data: any): Promise<any> {
    const db = await this.getDb();
    const existing = (await this.getMaterials()).find((m) => m.id === id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    const price = round4(merged.currentPrice ?? merged.retailPrice ?? 0);
    const effectiveDate = (data.effectiveDate || data.lastUpdated || new Date().toISOString()).slice(0, 10);

    await db.query(
      `UPDATE materials SET code=$1, name=$2, category=$3, sub_category=$4, more_sub_category=$5, unit=$6, current_price=$7, last_price=$8, currency=$9, supplier_name=$10, lead_time_days=$11, in_stock=$12, reorder_point=$13, unit_cost=$14, status=$15, barcode=$16, volume_pricing=$17, price_history=$18, theme_id=$19, custom_gradient=$20, effective_date=$21, last_updated=$22, updated_at_ts=NOW() WHERE id=$23`,
      [
        merged.code,
        merged.name,
        merged.category,
        merged.subCategory || '',
        merged.moreSubCategory || '',
        merged.unit || 'pcs',
        price,
        round4(merged.lastPrice ?? price),
        merged.currency || 'USD',
        merged.supplierName || '',
        Number(merged.leadTimeDays || 7),
        Math.max(0, round4(merged.inStock || 0)),
        Math.max(0, round4(merged.reorderPoint || 0)),
        round4(merged.unitCost || 0),
        merged.status || 'Available',
        merged.barcode || '',
        JSON.stringify(merged.volumePricing || []),
        JSON.stringify(merged.priceHistory || []),
        merged.themeId || null,
        merged.customGradient || null,
        effectiveDate,
        effectiveDate,
        id
      ]
    );
    return { ...merged, currentPrice: price, retailPrice: price, effectiveDate, lastUpdated: effectiveDate };
  }

  /**
   * Transactional, idempotent material price revision with relational price_history_records & audit trail.
   */
  public async updateMaterialPriceTransactional(
    id: string,
    payload: {
      newPrice: number;
      reason?: string;
      updatedBy?: string;
      volumePricing?: any[];
      effectiveDate?: string;
      idempotencyKey?: string;
    }
  ): Promise<any> {
    const newP = round4(payload.newPrice);
    if (!Number.isFinite(newP) || newP < 0) {
      throw Object.assign(new Error('Valid non-negative price is required'), { status: 400 });
    }

    return this.withTransaction(async (q) => {
      const rowRes = await q('SELECT * FROM materials WHERE id = $1 FOR UPDATE', [id]);
      if (rowRes.rows.length === 0) return null;
      const r = rowRes.rows[0];

      if (payload.idempotencyKey) {
        const dup = await q('SELECT id FROM price_history_records WHERE idempotency_key = $1', [payload.idempotencyKey]);
        if (dup.rows.length > 0) {
          const mats = await this.getMaterials();
          return mats.find((m) => m.id === id);
        }
      }

      const oldPrice = round4(r.current_price || 0);
      const changePct = calcPctChange(oldPrice, newP, 1);
      const effectiveDate = (payload.effectiveDate || new Date().toISOString()).slice(0, 10);
      const histId = `ph-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

      const historyRecord = {
        id: histId,
        date: effectiveDate,
        effectiveDate,
        previousPrice: oldPrice,
        newPrice: newP,
        changePct,
        reason: payload.reason || 'Vendor scheduled price revision',
        updatedBy: payload.updatedBy || 'Materials Manager'
      };

      const existingHistory = typeof r.price_history === 'string' ? JSON.parse(r.price_history) : r.price_history || [];
      const updatedHistory = [historyRecord, ...existingHistory];
      const updatedVol = payload.volumePricing !== undefined
        ? payload.volumePricing
        : (typeof r.volume_pricing === 'string' ? JSON.parse(r.volume_pricing) : r.volume_pricing || []);

      await q(
        `INSERT INTO price_history_records
          (id, entity_type, entity_id, entity_code, entity_name, previous_price, new_price, change_pct, currency, effective_date, reason, updated_by, idempotency_key)
         VALUES ($1, 'material', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          histId,
          id,
          r.code,
          r.name,
          oldPrice,
          newP,
          changePct,
          r.currency || 'USD',
          effectiveDate,
          historyRecord.reason,
          historyRecord.updatedBy,
          payload.idempotencyKey || null
        ]
      );

      await q(
        `UPDATE materials
         SET last_price = $1, current_price = $2, volume_pricing = $3, price_history = $4, effective_date = $5, last_updated = $6, updated_at_ts = NOW()
         WHERE id = $7`,
        [oldPrice, newP, JSON.stringify(updatedVol), JSON.stringify(updatedHistory), effectiveDate, effectiveDate, id]
      );

      await q(
        `INSERT INTO audit_logs (id, timestamp, actor_id, actor_name, actor_role, action, module, record_id, record_name, details, ip_address, status)
         VALUES ($1, $2, $3, $4, 'ADMIN', 'PRICE_UPDATE', 'Materials', $5, $6, $7, '127.0.0.1', 'Success')`,
        [
          `log-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
          new Date().toISOString(),
          historyRecord.updatedBy,
          historyRecord.updatedBy,
          r.code,
          r.name,
          `Updated material price from ${oldPrice} to ${newP} (${changePct}%). Effective: ${effectiveDate}. Reason: ${historyRecord.reason}`
        ]
      );

      return {
        id: r.id,
        code: r.code,
        name: r.name,
        category: r.category,
        subCategory: r.sub_category,
        moreSubCategory: r.more_sub_category,
        unit: r.unit,
        currentPrice: newP,
        lastPrice: oldPrice,
        retailPrice: newP,
        currency: r.currency || 'USD',
        supplierName: r.supplier_name,
        leadTimeDays: Number(r.lead_time_days || 7),
        inStock: round4(r.in_stock || 0),
        reorderPoint: round4(r.reorder_point || 0),
        unitCost: round4(r.unit_cost || 0),
        status: r.status,
        barcode: r.barcode,
        volumePricing: updatedVol,
        priceHistory: updatedHistory,
        themeId: r.theme_id,
        customGradient: r.custom_gradient,
        effectiveDate,
        lastUpdated: effectiveDate
      };
    });
  }

  public async deleteMaterial(id: string): Promise<boolean> {
    const db = await this.getDb();
    await db.query('DELETE FROM materials WHERE id=$1', [id]);
    return true;
  }

  // --- Outsourced Services CRUD ---
  public async getOutsourced(opts?: ListQueryOptions): Promise<any[]> {
    const res = await this.getOutsourcedPaginated(opts);
    return res.data;
  }

  public async getOutsourcedPaginated(opts?: ListQueryOptions): Promise<PaginatedResult<any>> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM outsourced_services ORDER BY created_at DESC');
    const rows = res.rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      category: r.category,
      subCategory: r.sub_category,
      moreSubCategory: r.more_sub_category,
      unit: r.unit,
      baseUnitType: r.base_unit_type || r.unit,
      providerId: r.provider_id,
      providerName: r.provider_name,
      leadTimeDays: Number(r.lead_time_days || 7),
      rate: round4(r.rate || 0),
      retailPrice: round4(r.retail_price || 0),
      currency: r.currency || 'USD',
      qualityTier: r.quality_tier,
      slaLevel: r.sla_level,
      status: r.status,
      tierRates: typeof r.tier_rates === 'string' ? JSON.parse(r.tier_rates) : r.tier_rates || [],
      priceHistory: typeof r.price_history === 'string' ? JSON.parse(r.price_history) : r.price_history || [],
      themeId: r.theme_id,
      customGradient: r.custom_gradient,
      effectiveDate: formatSqlDate(r.effective_date, r.last_updated),
      lastUpdated: r.last_updated
    }));
    return parseFilterPagination(rows, opts, ['name', 'code', 'category', 'subCategory', 'providerName']);
  }

  public async createOutsourced(data: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `out-${Date.now()}`;
    const rate = round4(data.rate || 0);
    const retailPrice = round4(data.retailPrice ?? rate * 1.35);
    const effectiveDate = (data.effectiveDate || data.lastUpdated || new Date().toISOString()).slice(0, 10);

    await db.query(
      `INSERT INTO outsourced_services (id, code, name, category, sub_category, more_sub_category, unit, base_unit_type, provider_id, provider_name, lead_time_days, rate, retail_price, currency, quality_tier, sla_level, status, tier_rates, price_history, theme_id, custom_gradient, effective_date, last_updated, created_at, updated_at_ts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, NOW())
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
         effective_date = EXCLUDED.effective_date,
         last_updated = EXCLUDED.last_updated,
         updated_at_ts = NOW()`,
      [
        id,
        data.code || id.toUpperCase(),
        data.name || 'New Service',
        data.category || 'Outsourced Processing',
        data.subCategory || '',
        data.moreSubCategory || '',
        data.unit || 'per_hour',
        data.baseUnitType || data.unit || 'per_hour',
        data.providerId || null,
        data.providerName || '',
        Number(data.leadTimeDays || 7),
        rate,
        retailPrice,
        data.currency || 'USD',
        data.qualityTier || 'Standard',
        data.slaLevel || 'Tier-1 SLA (99.5%)',
        data.status || 'Active',
        JSON.stringify(data.tierRates || []),
        JSON.stringify(data.priceHistory || []),
        data.themeId || null,
        data.customGradient || null,
        effectiveDate,
        effectiveDate,
        new Date().toISOString()
      ]
    );
    return { ...data, id, rate, retailPrice, effectiveDate, lastUpdated: effectiveDate };
  }

  public async updateOutsourced(id: string, data: any): Promise<any> {
    const db = await this.getDb();
    const existing = (await this.getOutsourced()).find((o) => o.id === id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    const effectiveDate = (data.effectiveDate || new Date().toISOString()).slice(0, 10);
    await db.query(
      `UPDATE outsourced_services SET code=$1, name=$2, category=$3, sub_category=$4, more_sub_category=$5, unit=$6, base_unit_type=$7, provider_name=$8, lead_time_days=$9, rate=$10, retail_price=$11, currency=$12, quality_tier=$13, sla_level=$14, status=$15, tier_rates=$16, price_history=$17, theme_id=$18, custom_gradient=$19, effective_date=$20, last_updated=$21, updated_at_ts=NOW() WHERE id=$22`,
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
        round4(merged.rate || 0),
        round4(merged.retailPrice || 0),
        merged.currency || 'USD',
        merged.qualityTier || 'Standard',
        merged.slaLevel || 'Tier-1 SLA (99.5%)',
        merged.status || 'Active',
        JSON.stringify(merged.tierRates || []),
        JSON.stringify(merged.priceHistory || []),
        merged.themeId || null,
        merged.customGradient || null,
        effectiveDate,
        effectiveDate,
        id
      ]
    );
    return { ...merged, effectiveDate, lastUpdated: effectiveDate };
  }

  public async updateOutsourcedRateTransactional(
    id: string,
    payload: {
      newRate: number;
      retailPrice?: number;
      tierRates?: any[];
      reason?: string;
      updatedBy?: string;
      effectiveDate?: string;
      idempotencyKey?: string;
    }
  ): Promise<any> {
    const newR = round4(payload.newRate);
    if (!Number.isFinite(newR) || newR < 0) {
      throw Object.assign(new Error('Valid non-negative rate is required'), { status: 400 });
    }

    return this.withTransaction(async (q) => {
      const rowRes = await q('SELECT * FROM outsourced_services WHERE id = $1 FOR UPDATE', [id]);
      if (rowRes.rows.length === 0) return null;
      const r = rowRes.rows[0];

      const oldRate = round4(r.rate || 0);
      const changePct = calcPctChange(oldRate, newR, 1);
      const effectiveDate = (payload.effectiveDate || new Date().toISOString()).slice(0, 10);
      const histId = `oph-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

      const historyRecord = {
        id: histId,
        date: effectiveDate,
        effectiveDate,
        oldRate,
        newRate: newR,
        changePct,
        reason: payload.reason || 'Tariff schedule renegotiation',
        updatedBy: payload.updatedBy || 'Operations Lead'
      };

      const existingHistory = typeof r.price_history === 'string' ? JSON.parse(r.price_history) : r.price_history || [];
      const updatedHistory = [historyRecord, ...existingHistory];
      const nextRetail = payload.retailPrice !== undefined ? round4(payload.retailPrice) : round4(r.retail_price || 0);
      const nextTierRates = payload.tierRates !== undefined
        ? payload.tierRates
        : (typeof r.tier_rates === 'string' ? JSON.parse(r.tier_rates) : r.tier_rates || []);

      await q(
        `INSERT INTO price_history_records
          (id, entity_type, entity_id, entity_code, entity_name, previous_price, new_price, retail_price, change_pct, currency, effective_date, reason, updated_by, idempotency_key)
         VALUES ($1, 'outsourced', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          histId,
          id,
          r.code,
          r.name,
          oldRate,
          newR,
          nextRetail,
          changePct,
          r.currency || 'USD',
          effectiveDate,
          historyRecord.reason,
          historyRecord.updatedBy,
          payload.idempotencyKey || null
        ]
      );

      await q(
        `UPDATE outsourced_services
         SET rate = $1, retail_price = $2, tier_rates = $3, price_history = $4, effective_date = $5, last_updated = $6, updated_at_ts = NOW()
         WHERE id = $7`,
        [newR, nextRetail, JSON.stringify(nextTierRates), JSON.stringify(updatedHistory), effectiveDate, effectiveDate, id]
      );

      await q(
        `INSERT INTO audit_logs (id, timestamp, actor_id, actor_name, actor_role, action, module, record_id, record_name, details, ip_address, status)
         VALUES ($1, $2, $3, $4, 'ADMIN', 'PRICE_UPDATE', 'Catalog', $5, $6, $7, '127.0.0.1', 'Success')`,
        [
          `log-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
          new Date().toISOString(),
          historyRecord.updatedBy,
          historyRecord.updatedBy,
          r.code,
          r.name,
          `Updated outsourced service rate from ${oldRate} to ${newR} (${changePct}%). Effective: ${effectiveDate}. Reason: ${historyRecord.reason}`
        ]
      );

      return true;
    });
    const list = await this.getOutsourced();
    return list.find((s) => s.id === id);
  }

  public async deleteOutsourced(id: string): Promise<boolean> {
    const db = await this.getDb();
    await db.query('DELETE FROM outsourced_services WHERE id=$1', [id]);
    return true;
  }

  // --- Subcontractors CRUD ---
  public async getSubcontractors(opts?: ListQueryOptions): Promise<any[]> {
    const res = await this.getSubcontractorsPaginated(opts);
    return res.data;
  }

  public async getSubcontractorsPaginated(opts?: ListQueryOptions): Promise<PaginatedResult<any>> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM subcontractors ORDER BY created_at DESC');
    const rows = res.rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      subcontractorId: r.subcontractor_id,
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
      baseRate: round4(r.base_rate || 0),
      rate: round4(r.rate || r.base_rate || 0),
      retailRate: round4(r.retail_rate || 0),
      shiftMultiplier: round4(r.shift_multiplier || 1.0),
      fullContractEstimate: round2(r.full_contract_estimate || 0),
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
      effectiveDate: formatSqlDate(r.effective_date, r.last_updated),
      lastUpdated: r.last_updated
    }));
    return parseFilterPagination(rows, opts, ['subcontractorName', 'code', 'nicheServiceName', 'serviceType', 'serviceCategory', 'trade']);
  }

  public async createSubcontractor(data: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `sub-${Date.now()}`;
    const rate = round4(data.baseRate ?? data.rate ?? 0);
    let code = (data.code || `SUB-${Math.floor(1000 + Math.random() * 9000)}`).trim();
    try {
      const existingCode = await db.query('SELECT id FROM subcontractors WHERE code = $1 AND id != $2', [code, id]);
      if (existingCode.rows.length > 0) {
        code = `${code}-${Math.floor(100 + Math.random() * 900)}`;
      }
    } catch {
      // ignore
    }

    const effectiveDate = (data.effectiveDate || data.lastUpdated || new Date().toISOString()).slice(0, 10);

    await db.query(
      `INSERT INTO subcontractors (id, code, subcontractor_id, subcontractor_name, niche_service_name, service_type, service_category, service_sub_category, rate_model, skill_level, trade, tier, lead_time_days, base_rate, rate, retail_rate, shift_multiplier, full_contract_estimate, unit, currency, rating, quality_score_pct, weekly_capacity, crew_size, location, contact_phone, email, rate_range, status, bulk_pricing_ranges, rate_history, theme_id, custom_gradient, effective_date, last_updated, created_at, updated_at_ts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, NOW())
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
         effective_date = EXCLUDED.effective_date,
         last_updated = EXCLUDED.last_updated,
         updated_at_ts = NOW()`,
      [
        id,
        code,
        data.subcontractorId || null,
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
        round4(data.retailRate ?? rate * 1.4),
        round4(data.shiftMultiplier || 1.0),
        round2(data.fullContractEstimate || 0),
        data.unit || 'hr',
        data.currency || 'USD',
        round2(data.rating || 4.9),
        round2(data.qualityScorePct || 99.0),
        round2(data.weeklyCapacity || 160),
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
        effectiveDate,
        effectiveDate,
        new Date().toISOString()
      ]
    );
    return { ...data, id, code, baseRate: rate, rate, effectiveDate, lastUpdated: effectiveDate };
  }

  public async updateSubcontractor(id: string, data: any): Promise<any> {
    const db = await this.getDb();
    const existing = (await this.getSubcontractors()).find((s) => s.id === id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    const rate = round4(merged.baseRate ?? merged.rate ?? 0);
    const effectiveDate = (data.effectiveDate || new Date().toISOString()).slice(0, 10);
    await db.query(
      `UPDATE subcontractors SET code=$1, subcontractor_name=$2, niche_service_name=$3, service_type=$4, service_category=$5, service_sub_category=$6, rate_model=$7, skill_level=$8, trade=$9, tier=$10, lead_time_days=$11, base_rate=$12, rate=$13, retail_rate=$14, shift_multiplier=$15, full_contract_estimate=$16, unit=$17, currency=$18, rating=$19, quality_score_pct=$20, weekly_capacity=$21, crew_size=$22, location=$23, contact_phone=$24, email=$25, rate_range=$26, status=$27, bulk_pricing_ranges=$28, rate_history=$29, theme_id=$30, custom_gradient=$31, effective_date=$32, last_updated=$33, updated_at_ts=NOW() WHERE id=$34`,
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
        round4(merged.retailRate || 0),
        round4(merged.shiftMultiplier || 1.0),
        round2(merged.fullContractEstimate || 0),
        merged.unit || 'hr',
        merged.currency || 'USD',
        round2(merged.rating || 4.9),
        round2(merged.qualityScorePct || 99.0),
        round2(merged.weeklyCapacity || 160),
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
        effectiveDate,
        effectiveDate,
        id
      ]
    );
    return { ...merged, baseRate: rate, rate, effectiveDate, lastUpdated: effectiveDate };
  }

  public async updateSubcontractorRateTransactional(
    id: string,
    payload: {
      newBaseRate: number;
      newRetailRate?: number;
      fullContractEstimate?: number;
      bulkPricingRanges?: any[];
      changeReason?: string;
      updatedBy?: string;
      effectiveDate?: string;
      idempotencyKey?: string;
    }
  ): Promise<any> {
    const newR = round4(payload.newBaseRate);
    if (!Number.isFinite(newR) || newR < 0) {
      throw Object.assign(new Error('Valid non-negative rate is required'), { status: 400 });
    }

    return this.withTransaction(async (q) => {
      const rowRes = await q('SELECT * FROM subcontractors WHERE id = $1 FOR UPDATE', [id]);
      if (rowRes.rows.length === 0) return null;
      const r = rowRes.rows[0];

      const oldRate = round4(r.base_rate || r.rate || 0);
      const changePct = calcPctChange(oldRate, newR, 1);
      const effectiveDate = (payload.effectiveDate || new Date().toISOString()).slice(0, 10);
      const histId = `srh-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

      const historyRecord = {
        id: histId,
        date: effectiveDate,
        effectiveDate,
        oldRate,
        newRate: newR,
        changePct,
        changeReason: payload.changeReason || 'Rate schedule review',
        updatedBy: payload.updatedBy || 'Contracts Director'
      };

      const existingHistory = typeof r.rate_history === 'string' ? JSON.parse(r.rate_history) : r.rate_history || [];
      const updatedHistory = [historyRecord, ...existingHistory];
      const nextRetail = payload.newRetailRate !== undefined ? round4(payload.newRetailRate) : round4(r.retail_rate || 0);
      const nextContractEst = payload.fullContractEstimate !== undefined ? round2(payload.fullContractEstimate) : round2(r.full_contract_estimate || 0);
      const nextBulkRanges = payload.bulkPricingRanges !== undefined
        ? payload.bulkPricingRanges
        : (typeof r.bulk_pricing_ranges === 'string' ? JSON.parse(r.bulk_pricing_ranges) : r.bulk_pricing_ranges || []);

      await q(
        `INSERT INTO price_history_records
          (id, entity_type, entity_id, entity_code, entity_name, previous_price, new_price, retail_price, change_pct, currency, effective_date, reason, updated_by, idempotency_key)
         VALUES ($1, 'subcontractor', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          histId,
          id,
          r.code,
          r.subcontractor_name,
          oldRate,
          newR,
          nextRetail,
          changePct,
          r.currency || 'USD',
          effectiveDate,
          historyRecord.changeReason,
          historyRecord.updatedBy,
          payload.idempotencyKey || null
        ]
      );

      await q(
        `UPDATE subcontractors
         SET base_rate = $1, rate = $2, retail_rate = $3, full_contract_estimate = $4, bulk_pricing_ranges = $5, rate_history = $6, effective_date = $7, last_updated = $8, updated_at_ts = NOW()
         WHERE id = $9`,
        [newR, newR, nextRetail, nextContractEst, JSON.stringify(nextBulkRanges), JSON.stringify(updatedHistory), effectiveDate, effectiveDate, id]
      );

      await q(
        `INSERT INTO audit_logs (id, timestamp, actor_id, actor_name, actor_role, action, module, record_id, record_name, details, ip_address, status)
         VALUES ($1, $2, $3, $4, 'ADMIN', 'PRICE_UPDATE', 'Catalog', $5, $6, $7, '127.0.0.1', 'Success')`,
        [
          `log-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
          new Date().toISOString(),
          historyRecord.updatedBy,
          historyRecord.updatedBy,
          r.code,
          r.subcontractor_name,
          `Updated subcontractor rate from ${oldRate} to ${newR} (${changePct}%). Effective: ${effectiveDate}. Reason: ${historyRecord.changeReason}`
        ]
      );

      return true;
    });
    const list = await this.getSubcontractors();
    return list.find((s) => s.id === id);
  }

  public async deleteSubcontractor(id: string): Promise<boolean> {
    const db = await this.getDb();
    await db.query('DELETE FROM subcontractors WHERE id=$1', [id]);
    return true;
  }

  // --- Produce Items CRUD ---
  public async getProduce(opts?: ListQueryOptions): Promise<any[]> {
    const res = await this.getProducePaginated(opts);
    return res.data;
  }

  public async getProducePaginated(opts?: ListQueryOptions): Promise<PaginatedResult<any>> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM produce_items ORDER BY created_at DESC');
    const rows = res.rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      type: r.type,
      category: r.category,
      subCategory: r.sub_category,
      moreSubCategory: r.more_sub_category,
      unit: r.unit,
      costPrice: round4(r.cost_price || 0),
      retailPrice: round4(r.retail_price || 0),
      defaultDiscountPct: round2(r.default_discount_pct || 0),
      currency: r.currency || 'USD',
      bundlesAndRanges: typeof r.bundles_and_ranges === 'string' ? JSON.parse(r.bundles_and_ranges) : r.bundles_and_ranges || [],
      leadTimeDays: Number(r.lead_time_days || 14),
      status: r.status,
      priceHistory: typeof r.price_history === 'string' ? JSON.parse(r.price_history) : r.price_history || [],
      themeId: r.theme_id,
      customGradient: r.custom_gradient,
      effectiveDate: formatSqlDate(r.effective_date, r.last_updated),
      lastUpdated: r.last_updated,
      barcode: r.barcode
    }));
    return parseFilterPagination(rows, opts, ['name', 'code', 'category', 'subCategory', 'barcode']);
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

    const effectiveDate = (data.effectiveDate || data.lastUpdated || new Date().toISOString()).slice(0, 10);

    await db.query(
      `INSERT INTO produce_items (id, code, name, type, category, sub_category, more_sub_category, unit, cost_price, retail_price, default_discount_pct, currency, bundles_and_ranges, lead_time_days, status, price_history, theme_id, custom_gradient, effective_date, last_updated, barcode, created_at, updated_at_ts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW())
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
         effective_date = EXCLUDED.effective_date,
         last_updated = EXCLUDED.last_updated,
         updated_at_ts = NOW()`,
      [
        id,
        code,
        data.name || 'New Product / Produce Item',
        data.type || 'product',
        data.category || 'Manufactured Parts',
        data.subCategory || '',
        data.moreSubCategory || '',
        data.unit || 'system',
        round4(data.costPrice || 0),
        round4(data.retailPrice || 0),
        round2(data.defaultDiscountPct || 0),
        data.currency || 'USD',
        JSON.stringify(data.bundlesAndRanges || []),
        Number(data.leadTimeDays || 14),
        data.status || 'Active',
        JSON.stringify(data.priceHistory || []),
        data.themeId || null,
        data.customGradient || null,
        effectiveDate,
        effectiveDate,
        data.barcode || code,
        new Date().toISOString()
      ]
    );
    return { ...data, id, code, effectiveDate, lastUpdated: effectiveDate };
  }

  public async updateProduce(id: string, data: any): Promise<any> {
    const db = await this.getDb();
    const existing = (await this.getProduce()).find((p) => p.id === id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    const effectiveDate = (data.effectiveDate || new Date().toISOString()).slice(0, 10);
    await db.query(
      `UPDATE produce_items SET code=$1, name=$2, type=$3, category=$4, sub_category=$5, more_sub_category=$6, unit=$7, cost_price=$8, retail_price=$9, default_discount_pct=$10, currency=$11, bundles_and_ranges=$12, lead_time_days=$13, status=$14, price_history=$15, theme_id=$16, custom_gradient=$17, effective_date=$18, last_updated=$19, barcode=$20, updated_at_ts=NOW() WHERE id=$21`,
      [
        merged.code,
        merged.name,
        merged.type,
        merged.category,
        merged.subCategory || '',
        merged.moreSubCategory || '',
        merged.unit || 'system',
        round4(merged.costPrice || 0),
        round4(merged.retailPrice || 0),
        round2(merged.defaultDiscountPct || 0),
        merged.currency || 'USD',
        JSON.stringify(merged.bundlesAndRanges || []),
        Number(merged.leadTimeDays || 14),
        merged.status || 'Active',
        JSON.stringify(merged.priceHistory || []),
        merged.themeId || null,
        merged.customGradient || null,
        effectiveDate,
        effectiveDate,
        merged.barcode || '',
        id
      ]
    );
    return { ...merged, effectiveDate, lastUpdated: effectiveDate };
  }

  public async updateProducePriceTransactional(
    id: string,
    payload: {
      newPrice: number;
      bundlesAndRanges?: any[];
      reason?: string;
      updatedBy?: string;
      effectiveDate?: string;
      idempotencyKey?: string;
    }
  ): Promise<any> {
    const newP = round4(payload.newPrice);
    if (!Number.isFinite(newP) || newP < 0) {
      throw Object.assign(new Error('Valid non-negative price is required'), { status: 400 });
    }

    return this.withTransaction(async (q) => {
      const rowRes = await q('SELECT * FROM produce_items WHERE id = $1 FOR UPDATE', [id]);
      if (rowRes.rows.length === 0) return null;
      const r = rowRes.rows[0];

      const oldPrice = round4(r.retail_price || 0);
      const changePct = calcPctChange(oldPrice, newP, 1);
      const effectiveDate = (payload.effectiveDate || new Date().toISOString()).slice(0, 10);
      const histId = `pph-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

      const historyRecord = {
        id: histId,
        date: effectiveDate,
        effectiveDate,
        previousPrice: oldPrice,
        newPrice: newP,
        changePct,
        reason: payload.reason || 'Commercial catalog price update',
        updatedBy: payload.updatedBy || 'Pricing Strategy Lead'
      };

      const existingHistory = typeof r.price_history === 'string' ? JSON.parse(r.price_history) : r.price_history || [];
      const updatedHistory = [historyRecord, ...existingHistory];
      const nextBundles = payload.bundlesAndRanges !== undefined
        ? payload.bundlesAndRanges
        : (typeof r.bundles_and_ranges === 'string' ? JSON.parse(r.bundles_and_ranges) : r.bundles_and_ranges || []);

      await q(
        `INSERT INTO price_history_records
          (id, entity_type, entity_id, entity_code, entity_name, previous_price, new_price, retail_price, change_pct, currency, effective_date, reason, updated_by, idempotency_key)
         VALUES ($1, 'produce', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          histId,
          id,
          r.code,
          r.name,
          oldPrice,
          newP,
          newP,
          changePct,
          r.currency || 'USD',
          effectiveDate,
          historyRecord.reason,
          historyRecord.updatedBy,
          payload.idempotencyKey || null
        ]
      );

      await q(
        `UPDATE produce_items
         SET retail_price = $1, bundles_and_ranges = $2, price_history = $3, effective_date = $4, last_updated = $5, updated_at_ts = NOW()
         WHERE id = $6`,
        [newP, JSON.stringify(nextBundles), JSON.stringify(updatedHistory), effectiveDate, effectiveDate, id]
      );

      await q(
        `INSERT INTO audit_logs (id, timestamp, actor_id, actor_name, actor_role, action, module, record_id, record_name, details, ip_address, status)
         VALUES ($1, $2, $3, $4, 'ADMIN', 'PRICE_UPDATE', 'Catalog', $5, $6, $7, '127.0.0.1', 'Success')`,
        [
          `log-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
          new Date().toISOString(),
          historyRecord.updatedBy,
          historyRecord.updatedBy,
          r.code,
          r.name,
          `Updated produce item price from ${oldPrice} to ${newP} (${changePct}%). Effective: ${effectiveDate}. Reason: ${historyRecord.reason}`
        ]
      );

      return true;
    });
    const prods = await this.getProduce();
    return prods.find((p) => p.id === id);
  }

  public async deleteProduce(id: string): Promise<boolean> {
    const db = await this.getDb();
    await db.query('DELETE FROM produce_items WHERE id=$1', [id]);
    return true;
  }

  // --- Price History Records Query ---
  public async getPriceHistory(opts?: ListQueryOptions): Promise<PaginatedResult<any>> {
    const db = await this.getDb();
    const res = await db.query('SELECT *, effective_date::text AS effective_date_iso FROM price_history_records ORDER BY effective_date DESC, recorded_at DESC');
    const rows = res.rows.map((r: any) => ({
      id: r.id,
      entityType: r.entity_type,
      entityId: r.entity_id,
      entityCode: r.entity_code,
      entityName: r.entity_name,
      previousPrice: round4(r.previous_price || 0),
      newPrice: round4(r.new_price || 0),
      retailPrice: r.retail_price !== null ? round4(r.retail_price) : undefined,
      changePct: round2(r.change_pct || 0),
      currency: r.currency || 'USD',
      effectiveDate: formatSqlDate(r.effective_date_iso || r.effective_date, ''),
      recordedAt: r.recorded_at,
      reason: r.reason,
      updatedBy: r.updated_by
    }));
    return parseFilterPagination(rows, opts, ['entityCode', 'entityName', 'reason', 'updatedBy', 'entityType']);
  }

  // --- Projects CRUD ---
  public async getProjects(opts?: ListQueryOptions): Promise<any[]> {
    const res = await this.getProjectsPaginated(opts);
    return res.data;
  }

  public async getProjectsPaginated(opts?: ListQueryOptions): Promise<PaginatedResult<any>> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM projects ORDER BY created_at DESC');
    const allPlans = await this.getProjectPlans();
    const plansByProject = new Map<string, any[]>();
    for (const pl of allPlans) {
      const list = plansByProject.get(pl.projectId) || [];
      list.push(pl);
      plansByProject.set(pl.projectId, list);
    }

    const rows = res.rows.map((r: any) => {
      const projectPlans = plansByProject.get(r.id) || [];
      const activePlan =
        projectPlans.find((p) => p.id === r.active_plan_id) ||
        projectPlans.find((p) => p.isActive) ||
        projectPlans[0] ||
        null;
      return {
        id: r.id,
        code: r.code,
        name: r.name,
        clientId: r.client_id,
        clientName: r.client_name,
        productCategory: r.product_category,
        productSubCategory: r.product_sub_category,
        moreSubCategory: r.more_sub_category,
        targetProduct: r.target_product,
        quotedPrice: round2(r.quoted_price || 0),
        currency: r.currency || 'USD',
        targetMarginPct: round2(r.target_margin_pct || 25),
        overheadPct: round2(r.overhead_pct || 5),
        contingencyPct: round2(r.contingency_pct || 3),
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
        budgetaryPlans: projectPlans,
        activePlanId: activePlan?.id || r.active_plan_id || undefined,
        notes: r.notes,
        analytics: typeof r.analytics === 'string' ? JSON.parse(r.analytics) : r.analytics || null
      };
    });
    return parseFilterPagination(rows, opts, ['name', 'code', 'clientName', 'productCategory', 'targetProduct', 'status']);
  }

  public async createProject(data: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `proj-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    let code = (data.code || `PRJ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`).trim();
    try {
      const existingCode = await db.query('SELECT id FROM projects WHERE code = $1 AND id != $2', [code, id]);
      if (existingCode.rows.length > 0) {
        code = `${code}-${Math.floor(100 + Math.random() * 900)}`;
      }
    } catch {
      // ignore
    }

    const quotedPrice = round2(data.quotedPrice ?? 100000);

    await db.query(
      `INSERT INTO projects (id, code, name, client_id, client_name, product_category, product_sub_category, more_sub_category, target_product, quoted_price, currency, target_margin_pct, overhead_pct, contingency_pct, status, start_date, delivery_deadline, created_date, contract_locked, theme_id, custom_gradient, phases, selected_items, alternative_options, active_plan_id, notes, analytics, created_at, updated_at_ts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, NOW())
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
         active_plan_id = COALESCE(EXCLUDED.active_plan_id, projects.active_plan_id),
         theme_id = EXCLUDED.theme_id,
         custom_gradient = EXCLUDED.custom_gradient,
         notes = EXCLUDED.notes,
         updated_at_ts = NOW()`,
      [
        id,
        code,
        data.name || 'New Project',
        data.clientId || null,
        data.clientName || 'Valued Client',
        data.productCategory || '',
        data.productSubCategory || '',
        data.moreSubCategory || '',
        data.targetProduct || '',
        quotedPrice,
        data.currency || 'USD',
        round2(data.targetMarginPct ?? 25),
        round2(data.overheadPct ?? 5),
        round2(data.contingencyPct ?? 3),
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
        data.activePlanId || null,
        data.notes || '',
        JSON.stringify(data.analytics || null),
        new Date().toISOString()
      ]
    );

    if (Array.isArray(data.budgetaryPlans) && data.budgetaryPlans.length > 0) {
      await this.syncProjectBudgetaryPlans(id, data.budgetaryPlans, data.activePlanId);
    }

    const saved = (await this.getProjects()).find((p) => p.id === id);
    return saved || { ...data, id, code, quotedPrice };
  }

  public async updateProject(id: string, data: any): Promise<any> {
    const db = await this.getDb();
    const existingRes = await db.query('SELECT * FROM projects WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) return null;
    const existingList = await this.getProjects();
    const existing = existingList.find((p) => p.id === id);
    if (!existing) return null;

    const merged = { ...existing, ...data };
    const quotedPrice = round2(merged.quotedPrice || 0);
    await db.query(
      `UPDATE projects SET code=$1, name=$2, client_name=$3, product_category=$4, product_sub_category=$5, more_sub_category=$6, target_product=$7, quoted_price=$8, currency=$9, target_margin_pct=$10, overhead_pct=$11, contingency_pct=$12, status=$13, start_date=$14, delivery_deadline=$15, contract_locked=$16, theme_id=$17, custom_gradient=$18, phases=$19, selected_items=$20, alternative_options=$21, active_plan_id=$22, notes=$23, analytics=$24, updated_at_ts=NOW() WHERE id=$25`,
      [
        merged.code,
        merged.name,
        merged.clientName,
        merged.productCategory || '',
        merged.productSubCategory || '',
        merged.moreSubCategory || '',
        merged.targetProduct || '',
        quotedPrice,
        merged.currency || 'USD',
        round2(merged.targetMarginPct ?? 25),
        round2(merged.overheadPct ?? 5),
        round2(merged.contingencyPct ?? 3),
        merged.status || 'Proposal',
        merged.startDate || '',
        merged.deliveryDeadline || '',
        Boolean(merged.contractLocked),
        merged.themeId || null,
        merged.customGradient || null,
        JSON.stringify(merged.phases || []),
        JSON.stringify(merged.selectedItems || []),
        JSON.stringify(merged.alternativeOptions || []),
        merged.activePlanId || null,
        merged.notes || '',
        JSON.stringify(merged.analytics || null),
        id
      ]
    );

    if (Array.isArray(data.budgetaryPlans)) {
      await this.syncProjectBudgetaryPlans(id, data.budgetaryPlans, merged.activePlanId);
    }

    const updated = (await this.getProjects()).find((p) => p.id === id);
    return updated || { ...merged, quotedPrice };
  }

  private async syncProjectBudgetaryPlans(projectId: string, incomingPlans: any[], activePlanId?: string): Promise<void> {
    const db = await this.getDb();
    const existingRes = await db.query('SELECT id FROM project_plans WHERE project_id = $1', [projectId]);
    const existingIds = new Set(existingRes.rows.map((r: any) => String(r.id)));

    for (let i = 0; i < incomingPlans.length; i++) {
      const pl = incomingPlans[i];
      if (!pl || !pl.name) continue;
      let targetPlanId = pl.id ? String(pl.id) : `plan-${projectId}-${Date.now()}-${i}`;
      // Avoid cross-project ID collisions from legacy generic IDs like 'plan-01'
      if (!existingIds.has(targetPlanId)) {
        const globalCheck = await db.query('SELECT project_id FROM project_plans WHERE id = $1', [targetPlanId]);
        if (globalCheck.rows.length > 0 && globalCheck.rows[0].project_id !== projectId) {
          targetPlanId = `${targetPlanId}-${projectId}`;
        }
      }

      if (existingIds.has(targetPlanId)) {
        await this.updateProjectPlan(targetPlanId, {
          ...pl,
          id: targetPlanId,
          projectId,
          isActive: activePlanId ? targetPlanId === activePlanId : Boolean(pl.isActive)
        }).catch(() => {});
      } else {
        await this.createProjectPlan({
          ...pl,
          id: targetPlanId,
          projectId,
          isActive: activePlanId ? targetPlanId === activePlanId : i === 0
        }).catch(() => {});
      }
    }
  }

  public async deleteProject(id: string): Promise<boolean> {
    const db = await this.getDb();
    await db.query('DELETE FROM projects WHERE id=$1', [id]);
    return true;
  }

  // --- Project Plans Normalized Relational CRUD ---
  private mapPlanRowToRecord(
    r: any,
    sections: any[],
    boqItems: any[],
    resources: any[],
    overheads: any[],
    revisions: any[]
  ): any {
    const plannedRevenue = round2(r.summary_planned_revenue ?? r.planned_revenue ?? r.project_quoted_price ?? 0);
    const materialCost = round2(r.material_cost ?? 0);
    const subcontractorCost = round2(r.subcontractor_cost ?? 0);
    const outsourcedCost = round2(r.outsourced_cost ?? 0);
    const resourceCost = round2(r.resource_cost ?? 0);
    const directCost = round2(r.direct_cost ?? 0);
    const overheadAmount = round2(r.overhead_amount ?? 0);
    const contingencyAmount = round2(r.contingency_amount ?? 0);
    const laborBurdenAmount = round2(r.labor_burden_amount ?? 0);
    const extraOverheadAmount = round2(r.extra_overhead_amount ?? 0);
    const allocatedOverhead = round2(r.allocated_overhead ?? 0);
    const totalPlannedCost = round2(r.total_planned_cost ?? 0);
    const grossProfit = round2(r.gross_profit ?? decSub(plannedRevenue, directCost));
    const grossMarginPct = round2(r.gross_margin_pct ?? 0);
    const plannedProfit = round2(r.planned_profit ?? decSub(plannedRevenue, totalPlannedCost));
    const profitMarginPct = round2(r.profit_margin_pct ?? 0);

    const mappedItems = boqItems.map((b: any) => ({
      id: b.id,
      planId: b.plan_id,
      projectId: b.project_id,
      sectionId: b.section_id || undefined,
      phaseId: b.phase_id || 'phase-01',
      type: b.item_type || 'material',
      itemId: b.item_code || b.catalog_item_id || b.id,
      itemCode: b.item_code || b.catalog_item_id || b.id,
      name: b.name,
      category: b.category || '',
      supplierOrProvider: b.supplier_or_provider || '',
      quantity: round4(b.quantity ?? 1),
      unit: b.unit || 'pcs',
      unitCost: round4(b.unit_cost ?? 0),
      discountPct: round2(b.discount_pct ?? 0),
      totalCost: round2(b.total_cost ?? 0),
      markupPct: round2(b.markup_pct ?? 0),
      billableRate: round4(b.billable_rate ?? 0),
      totalRevenue: round2(b.total_revenue ?? 0),
      grossProfit: round2(b.gross_profit ?? 0),
      currency: b.currency || r.currency || 'USD',
      nativeUnitCost: b.native_unit_cost !== null && b.native_unit_cost !== undefined ? round4(b.native_unit_cost) : round4(b.unit_cost ?? 0),
      consumptionRate: round2(b.consumption_rate ?? 100),
      notes: b.notes || '',
      lineOrder: Number(b.line_order || 1)
    }));

    const mappedSections = sections.map((s: any) => ({
      id: s.id,
      planId: s.plan_id,
      projectId: s.project_id,
      phaseCode: s.phase_code || 'PH-01',
      name: s.name,
      description: s.description || '',
      sequenceOrder: Number(s.sequence_order || 1),
      plannedBudget: round2(s.planned_budget ?? 0),
      materialBudget: round2(s.material_budget ?? 0),
      laborBudget: round2(s.labor_budget ?? 0),
      outsourcedBudget: round2(s.outsourced_budget ?? 0),
      actualCost: round2(s.actual_cost ?? 0),
      startDate: formatSqlDate(s.start_date_iso || s.start_date, ''),
      endDate: formatSqlDate(s.end_date_iso || s.end_date, ''),
      status: s.status || 'Not Started'
    }));

    const mappedResources = resources.map((resItem: any) => ({
      id: resItem.id,
      planId: resItem.plan_id,
      projectId: resItem.project_id,
      sectionId: resItem.section_id || undefined,
      resourceId: resItem.resource_id,
      resourceType: resItem.resource_type || 'subcontractor',
      name: resItem.name,
      roleOrTrade: resItem.role_or_trade || '',
      allocatedHours: round2(resItem.allocated_hours ?? 0),
      hourlyRate: round4(resItem.hourly_rate ?? 0),
      totalCost: round2(resItem.total_cost ?? 0),
      startDate: formatSqlDate(resItem.start_date_iso || resItem.start_date, ''),
      endDate: formatSqlDate(resItem.end_date_iso || resItem.end_date, ''),
      notes: resItem.notes || ''
    }));

    const mappedOverheads = overheads.map((ovh: any) => ({
      id: ovh.id,
      planId: ovh.plan_id,
      projectId: ovh.project_id,
      category: ovh.category,
      allocationType: ovh.allocation_type || 'percentage',
      ratePct: round2(ovh.rate_pct ?? 0),
      baseAmount: round2(ovh.base_amount ?? 0),
      allocatedAmount: round2(ovh.allocated_amount ?? 0),
      notes: ovh.notes || ''
    }));

    const mappedRevisions = revisions.map((rev: any) => ({
      id: rev.id,
      planId: rev.plan_id,
      projectId: rev.project_id,
      revisionNumber: Number(rev.revision_number || 1),
      versionLabel: rev.version_label || `v${rev.revision_number || 1}.0`,
      changeSummary: rev.change_summary || '',
      statusAtRevision: rev.status_at_revision || 'Draft',
      plannedRevenue: round2(rev.planned_revenue ?? 0),
      directCost: round2(rev.direct_cost ?? 0),
      allocatedOverhead: round2(rev.allocated_overhead ?? 0),
      totalPlannedCost: round2(rev.total_planned_cost ?? 0),
      plannedProfit: round2(rev.planned_profit ?? 0),
      profitMarginPct: round2(rev.profit_margin_pct ?? 0),
      changedBy: rev.changed_by || 'System',
      effectiveDate: formatSqlDate(rev.effective_date_iso || rev.effective_date, ''),
      snapshot: typeof rev.snapshot_json === 'string' ? JSON.parse(rev.snapshot_json) : rev.snapshot_json || {},
      createdAt: rev.created_at ? new Date(rev.created_at).toISOString() : new Date().toISOString()
    }));

    const costSummary = {
      planId: r.id,
      projectId: r.project_id,
      plannedRevenue,
      materialCost,
      subcontractorCost,
      outsourcedCost,
      resourceCost,
      directCost,
      overheadAmount,
      contingencyAmount,
      laborBurdenAmount,
      extraOverheadAmount,
      allocatedOverhead,
      totalPlannedCost,
      grossProfit,
      grossMarginPct,
      plannedProfit,
      profitMarginPct,
      boqItemCount: mappedItems.length,
      sectionCount: mappedSections.length,
      resourceCount: mappedResources.length,
      calculatedAt: r.calculated_at ? new Date(r.calculated_at).toISOString() : new Date().toISOString()
    };

    const createdAtIso = r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString();
    const updatedAtIso = r.updated_at ? new Date(r.updated_at).toISOString() : createdAtIso;

    return {
      id: r.id,
      planNumber: r.plan_number,
      projectId: r.project_id,
      projectCode: r.project_code || '',
      projectName: r.project_name || '',
      clientName: r.client_name || '',
      name: r.name,
      description: r.description || '',
      planType: r.plan_type || 'Baseline',
      status: r.status || 'Draft',
      revisionNumber: Number(r.revision_number || 1),
      versionLabel: r.version_label || `v${r.revision_number || 1}.0`,
      isBaseline: Boolean(r.is_baseline),
      isActive: Boolean(r.is_active),
      currency: r.currency || 'USD',
      createdAt: createdAtIso.slice(0, 10),
      createdAtIso,
      updatedAt: updatedAtIso,
      lastUpdated: updatedAtIso.slice(0, 10),
      createdBy: r.created_by || 'System',
      updatedBy: r.updated_by || 'System',
      effectiveDate: formatSqlDate(r.effective_date_iso || r.effective_date, createdAtIso.slice(0, 10)),
      approvalDate: formatSqlDate(r.approval_date_iso || r.approval_date, ''),
      approvedBy: r.approved_by || '',
      targetMarginPct: round2(r.target_margin_pct ?? 25),
      overheadPct: round2(r.overhead_pct ?? 8.5),
      contingencyPct: round2(r.contingency_pct ?? 5.0),
      laborBurdenPct: round2(r.labor_burden_pct ?? 0),
      plannedRevenue,
      directCost,
      allocatedOverhead,
      totalPlannedCost,
      plannedProfit,
      profitMarginPct,
      totalDirectCost: directCost,
      totalProjectCost: totalPlannedCost,
      totalEstimatedCost: directCost,
      quotedRevenue: plannedRevenue,
      grossMarginPct,
      themeId: r.theme_id || 'airbus-cobalt',
      customGradient: r.custom_gradient || undefined,
      templateId: r.template_id || undefined,
      sourceProjectId: r.source_project_id || undefined,
      sourceProjectCode: r.source_project_code || undefined,
      notes: r.notes || '',
      selectedItems: mappedItems,
      boqItems: mappedItems,
      sections: mappedSections,
      resources: mappedResources,
      overheadAllocations: mappedOverheads,
      revisions: mappedRevisions,
      costSummary
    };
  }

  public async getProjectPlans(opts?: ListQueryOptions): Promise<any[]> {
    const res = await this.getProjectPlansPaginated(opts);
    return res.data;
  }

  public async getProjectPlansPaginated(opts?: ListQueryOptions): Promise<PaginatedResult<any>> {
    const db = await this.getDb();
    const plansRes = await db.query(`
      SELECT
        pp.*,
        pp.effective_date::text AS effective_date_iso,
        pp.approval_date::text AS approval_date_iso,
        p.code AS project_code,
        p.name AS project_name,
        p.client_name AS client_name,
        p.quoted_price AS project_quoted_price,
        cs.planned_revenue AS summary_planned_revenue,
        cs.material_cost,
        cs.subcontractor_cost,
        cs.outsourced_cost,
        cs.resource_cost,
        cs.direct_cost,
        cs.overhead_amount,
        cs.contingency_amount,
        cs.labor_burden_amount,
        cs.extra_overhead_amount,
        cs.allocated_overhead,
        cs.total_planned_cost,
        cs.gross_profit,
        cs.gross_margin_pct,
        cs.planned_profit,
        cs.profit_margin_pct,
        cs.calculated_at
      FROM project_plans pp
      INNER JOIN projects p ON p.id = pp.project_id
      LEFT JOIN project_plan_cost_summaries cs ON cs.plan_id = pp.id
      ORDER BY pp.is_active DESC, pp.is_baseline DESC, pp.updated_at DESC, pp.created_at ASC
    `);

    const [sectionsRes, boqRes, resourcesRes, overheadsRes, revisionsRes] = await Promise.all([
      db.query('SELECT *, start_date::text AS start_date_iso, end_date::text AS end_date_iso FROM project_plan_sections ORDER BY sequence_order ASC'),
      db.query('SELECT * FROM project_plan_boq_items ORDER BY line_order ASC, created_at ASC'),
      db.query('SELECT *, start_date::text AS start_date_iso, end_date::text AS end_date_iso FROM project_plan_resources ORDER BY created_at ASC'),
      db.query('SELECT * FROM project_plan_overhead_allocations ORDER BY created_at ASC'),
      db.query('SELECT *, effective_date::text AS effective_date_iso FROM project_plan_revisions ORDER BY revision_number DESC, created_at DESC')
    ]);

    const groupByPlan = (rows: any[]) => {
      const map = new Map<string, any[]>();
      for (const row of rows) {
        const list = map.get(row.plan_id) || [];
        list.push(row);
        map.set(row.plan_id, list);
      }
      return map;
    };

    const sectionsByPlan = groupByPlan(sectionsRes.rows);
    const boqByPlan = groupByPlan(boqRes.rows);
    const resourcesByPlan = groupByPlan(resourcesRes.rows);
    const overheadsByPlan = groupByPlan(overheadsRes.rows);
    const revisionsByPlan = groupByPlan(revisionsRes.rows);

    const rows = plansRes.rows.map((r: any) =>
      this.mapPlanRowToRecord(
        r,
        sectionsByPlan.get(r.id) || [],
        boqByPlan.get(r.id) || [],
        resourcesByPlan.get(r.id) || [],
        overheadsByPlan.get(r.id) || [],
        revisionsByPlan.get(r.id) || []
      )
    );

    return parseFilterPagination(
      rows,
      opts,
      ['planNumber', 'name', 'description', 'projectCode', 'projectName', 'clientName', 'status', 'planType', 'createdBy', 'updatedBy'],
      ''
    );
  }

  public async getProjectPlanById(planId: string): Promise<any | null> {
    if (!planId) return null;
    const db = await this.getDb();
    const planRes = await db.query(
      `SELECT
        pp.*,
        pp.effective_date::text AS effective_date_iso,
        pp.approval_date::text AS approval_date_iso,
        p.code AS project_code,
        p.name AS project_name,
        p.client_name AS client_name,
        p.quoted_price AS project_quoted_price,
        cs.planned_revenue AS summary_planned_revenue,
        cs.material_cost,
        cs.subcontractor_cost,
        cs.outsourced_cost,
        cs.resource_cost,
        cs.direct_cost,
        cs.overhead_amount,
        cs.contingency_amount,
        cs.labor_burden_amount,
        cs.extra_overhead_amount,
        cs.allocated_overhead,
        cs.total_planned_cost,
        cs.gross_profit,
        cs.gross_margin_pct,
        cs.planned_profit,
        cs.profit_margin_pct,
        cs.calculated_at
      FROM project_plans pp
      INNER JOIN projects p ON p.id = pp.project_id
      LEFT JOIN project_plan_cost_summaries cs ON cs.plan_id = pp.id
      WHERE pp.id = $1`,
      [planId]
    );
    if (planRes.rows.length === 0) return null;

    const [sectionsRes, boqRes, resourcesRes, overheadsRes, revisionsRes] = await Promise.all([
      db.query('SELECT *, start_date::text AS start_date_iso, end_date::text AS end_date_iso FROM project_plan_sections WHERE plan_id = $1 ORDER BY sequence_order ASC', [planId]),
      db.query('SELECT * FROM project_plan_boq_items WHERE plan_id = $1 ORDER BY line_order ASC, created_at ASC', [planId]),
      db.query('SELECT *, start_date::text AS start_date_iso, end_date::text AS end_date_iso FROM project_plan_resources WHERE plan_id = $1 ORDER BY created_at ASC', [planId]),
      db.query('SELECT * FROM project_plan_overhead_allocations WHERE plan_id = $1 ORDER BY created_at ASC', [planId]),
      db.query('SELECT *, effective_date::text AS effective_date_iso FROM project_plan_revisions WHERE plan_id = $1 ORDER BY revision_number DESC, created_at DESC', [planId])
    ]);

    return this.mapPlanRowToRecord(
      planRes.rows[0],
      sectionsRes.rows,
      boqRes.rows,
      resourcesRes.rows,
      overheadsRes.rows,
      revisionsRes.rows
    );
  }

  public async createProjectPlan(data: any, actor?: { id?: string; name?: string }): Promise<any> {
    const projectId = String(data?.projectId || '').trim();
    if (!projectId) {
      throw Object.assign(new Error('projectId is required to create a project plan'), { status: 400 });
    }
    const planName = String(data?.name || '').trim();
    if (!planName) {
      throw Object.assign(new Error('Plan name is required'), { status: 400 });
    }

    const validStatuses = ['Draft', 'In Review', 'Approved', 'Active', 'Locked', 'Archived'];
    const status = validStatuses.includes(String(data?.status)) ? String(data.status) : 'Draft';

    const createdPlanId = await this.withTransaction(async (q) => {
      // 1. Validate project exists
      const projRes = await q('SELECT * FROM projects WHERE id = $1 FOR UPDATE', [projectId]);
      if (projRes.rows.length === 0) {
        throw Object.assign(new Error(`Referenced project '${projectId}' does not exist`), { status: 404 });
      }
      const proj = projRes.rows[0];

      // 2. Ensure unique plan ID
      const planId = data.id
        ? String(data.id).trim()
        : `plan-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const existingIdCheck = await q('SELECT id FROM project_plans WHERE id = $1', [planId]);
      if (existingIdCheck.rows.length > 0) {
        throw Object.assign(new Error(`Plan ID '${planId}' already exists`), { status: 409 });
      }

      // 3. Ensure unique human-readable plan_number
      let planNumber = data.planNumber ? String(data.planNumber).trim().toUpperCase() : '';
      if (planNumber) {
        const dupNum = await q('SELECT id FROM project_plans WHERE plan_number = $1', [planNumber]);
        if (dupNum.rows.length > 0) {
          throw Object.assign(new Error(`Plan number '${planNumber}' already exists`), { status: 409 });
        }
      } else {
        const countRes = await q('SELECT COUNT(*) AS cnt FROM project_plans WHERE project_id = $1', [projectId]);
        let seq = Number(countRes.rows[0]?.cnt || 0) + 1;
        const cleanProjCode = String(proj.code || projectId).toUpperCase().replace(/[^A-Z0-9-]/g, '');
        planNumber = `PLN-${cleanProjCode}-${String(seq).padStart(2, '0')}`;
        while (true) {
          const checkNum = await q('SELECT id FROM project_plans WHERE plan_number = $1', [planNumber]);
          if (checkNum.rows.length === 0) break;
          seq++;
          planNumber = `PLN-${cleanProjCode}-${String(seq).padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`;
        }
      }

      const existingPlanCountRes = await q('SELECT COUNT(*) AS cnt FROM project_plans WHERE project_id = $1', [projectId]);
      const isFirstPlan = Number(existingPlanCountRes.rows[0]?.cnt || 0) === 0;
      const isBaseline = data.isBaseline !== undefined ? Boolean(data.isBaseline) : isFirstPlan;
      const isActive = data.isActive !== undefined ? Boolean(data.isActive) : isFirstPlan;

      if (isActive) {
        await q('UPDATE project_plans SET is_active = false WHERE project_id = $1', [projectId]);
      }

      const rawItems = Array.isArray(data.boqItems)
        ? data.boqItems
        : Array.isArray(data.selectedItems)
        ? data.selectedItems
        : [];
      const projPhases = typeof proj.phases === 'string' ? JSON.parse(proj.phases) : proj.phases || [];
      const rawSections = Array.isArray(data.sections) && data.sections.length > 0
        ? data.sections
        : projPhases.map((ph: any, idx: number) => ({
            id: `sec-${planId}-${idx + 1}`,
            phaseCode: `PH-0${idx + 1}`,
            name: ph.name || `Phase ${idx + 1}`,
            description: ph.description || '',
            sequenceOrder: idx + 1,
            plannedBudget: round2(ph.budget || 0),
            materialBudget: round2(ph.materialBudget || 0),
            laborBudget: round2(ph.laborBudget || 0),
            outsourcedBudget: round2(ph.outsourcedBudget || 0),
            actualCost: round2(ph.actualCost || 0),
            startDate: ph.startDate || null,
            endDate: ph.endDate || null,
            status: ph.status || 'Not Started'
          }));

      const rawResources = Array.isArray(data.resources) ? data.resources : [];
      const rawOverheads = Array.isArray(data.overheadAllocations) ? data.overheadAllocations : [];

      const targetMarginPct = round2(data.targetMarginPct ?? proj.target_margin_pct ?? 25);
      const overheadPct = round2(data.overheadPct ?? proj.overhead_pct ?? 8.5);
      const contingencyPct = round2(data.contingencyPct ?? proj.contingency_pct ?? 5.0);
      const laborBurdenPct = round2(data.laborBurdenPct ?? 0);
      const explicitRevenue = round2(data.plannedRevenue ?? data.quotedRevenue ?? 0);

      const calc = calculatePlanFinancials({
        planId,
        projectId,
        plannedRevenue: explicitRevenue,
        projectQuotedPrice: round2(proj.quoted_price || 0),
        targetMarginPct,
        overheadPct,
        contingencyPct,
        laborBurdenPct,
        boqItems: rawItems,
        sections: rawSections,
        resources: rawResources,
        overheadAllocations: rawOverheads
      });

      const revisionNumber = Math.max(1, Number(data.revisionNumber || 1));
      const versionLabel = String(data.versionLabel || `v${revisionNumber}.0`);
      const actorName = actor?.name || data.createdBy || data.updatedBy || 'Enterprise Planner';
      const todayIso = new Date().toISOString().slice(0, 10);
      const effectiveDate = formatSqlDate(data.effectiveDate, todayIso);
      const approvalDate =
        data.approvalDate
          ? formatSqlDate(data.approvalDate, todayIso)
          : status === 'Approved' || status === 'Active' || status === 'Locked'
          ? todayIso
          : null;
      const approvedBy =
        data.approvedBy || (status === 'Approved' || status === 'Active' || status === 'Locked' ? actorName : null);

      const planType = String(
        data.planType || (isBaseline ? 'Baseline' : 'Alternative')
      ).trim();

      // 4. Insert project_plans row
      await q(
        `INSERT INTO project_plans (
          id, plan_number, project_id, name, description, plan_type, status,
          revision_number, version_label, is_baseline, is_active, currency,
          planned_revenue, target_margin_pct, overhead_pct, contingency_pct, labor_burden_pct,
          effective_date, approval_date, approved_by, created_by, updated_by,
          theme_id, custom_gradient, template_id, source_project_id, source_project_code, notes,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17,
          $18::date, $19::date, $20, $21, $22,
          $23, $24, $25, $26, $27, $28,
          NOW(), NOW()
        )`,
        [
          planId,
          planNumber,
          projectId,
          planName,
          String(data.description || ''),
          planType,
          status,
          revisionNumber,
          versionLabel,
          isBaseline,
          isActive,
          data.currency || proj.currency || 'USD',
          calc.summary.plannedRevenue,
          targetMarginPct,
          overheadPct,
          contingencyPct,
          laborBurdenPct,
          effectiveDate || todayIso,
          approvalDate,
          approvedBy,
          data.createdBy || actorName,
          data.updatedBy || actorName,
          data.themeId || 'airbus-cobalt',
          data.customGradient || null,
          data.templateId || null,
          data.sourceProjectId || null,
          data.sourceProjectCode || null,
          String(data.notes || '')
        ]
      );

      // 5. Insert sections
      const sectionIds = new Set<string>();
      for (let i = 0; i < rawSections.length; i++) {
        const s = rawSections[i];
        const secId = `sec-${planId}-${i + 1}-${Math.floor(100 + Math.random() * 900)}`;
        sectionIds.add(secId);
        await q(
          `INSERT INTO project_plan_sections (
            id, plan_id, project_id, phase_code, name, description, sequence_order,
            planned_budget, material_budget, labor_budget, outsourced_budget, actual_cost,
            start_date, end_date, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::date, $14::date, $15)`,
          [
            secId,
            planId,
            projectId,
            s.phaseCode || `PH-0${i + 1}`,
            s.name || `Section ${i + 1}`,
            s.description || '',
            Number(s.sequenceOrder || i + 1),
            round2(s.plannedBudget ?? s.budget ?? 0),
            round2(s.materialBudget ?? 0),
            round2(s.laborBudget ?? 0),
            round2(s.outsourcedBudget ?? 0),
            round2(s.actualCost ?? 0),
            s.startDate && /^\d{4}-\d{2}-\d{2}/.test(String(s.startDate)) ? String(s.startDate).slice(0, 10) : null,
            s.endDate && /^\d{4}-\d{2}-\d{2}/.test(String(s.endDate)) ? String(s.endDate).slice(0, 10) : null,
            s.status || 'Not Started'
          ]
        );
      }

      // 6. Insert BOQ items
      for (let i = 0; i < calc.normalizedBoqItems.length; i++) {
        const item = calc.normalizedBoqItems[i];
        const boqId = `boq-${planId}-${i + 1}-${Math.floor(1000 + Math.random() * 9000)}`;
        const validSecId = item.sectionId && sectionIds.has(item.sectionId) ? item.sectionId : null;
        await q(
          `INSERT INTO project_plan_boq_items (
            id, plan_id, project_id, section_id, phase_id, item_type, catalog_item_id, item_code,
            name, category, supplier_or_provider, quantity, unit, unit_cost, discount_pct,
            total_cost, markup_pct, billable_rate, total_revenue, gross_profit,
            currency, native_unit_cost, consumption_rate, notes, line_order
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25
          )`,
          [
            boqId,
            planId,
            projectId,
            validSecId,
            item.phaseId || 'phase-01',
            item.type,
            item.itemId || null,
            item.itemCode || item.itemId || `ITM-${i + 1}`,
            item.name,
            item.category || '',
            item.supplierOrProvider || '',
            item.quantity,
            item.unit || 'pcs',
            item.unitCost,
            item.discountPct,
            item.totalCost,
            item.markupPct ?? 30,
            item.billableRate ?? 0,
            item.totalRevenue ?? 0,
            item.grossProfit ?? 0,
            item.currency || data.currency || proj.currency || 'USD',
            item.nativeUnitCost ?? item.unitCost,
            item.consumptionRate ?? 100,
            item.notes || '',
            i + 1
          ]
        );
      }

      // 7. Insert plan resources
      for (let i = 0; i < calc.normalizedResources.length; i++) {
        const rItem = calc.normalizedResources[i];
        const resRowId = `res-${planId}-${i + 1}-${Math.floor(1000 + Math.random() * 9000)}`;
        const validSecId = rItem.sectionId && sectionIds.has(rItem.sectionId) ? rItem.sectionId : null;
        await q(
          `INSERT INTO project_plan_resources (
            id, plan_id, project_id, section_id, resource_id, resource_type,
            name, role_or_trade, allocated_hours, hourly_rate, total_cost,
            start_date, end_date, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::date, $13::date, $14)`,
          [
            resRowId,
            planId,
            projectId,
            validSecId,
            rItem.resourceId,
            rItem.resourceType,
            rItem.name,
            rItem.roleOrTrade || '',
            rItem.allocatedHours,
            rItem.hourlyRate,
            rItem.totalCost,
            rItem.startDate && /^\d{4}-\d{2}-\d{2}/.test(String(rItem.startDate)) ? String(rItem.startDate).slice(0, 10) : null,
            rItem.endDate && /^\d{4}-\d{2}-\d{2}/.test(String(rItem.endDate)) ? String(rItem.endDate).slice(0, 10) : null,
            rItem.notes || ''
          ]
        );
      }

      // 8. Insert overhead allocations
      for (let i = 0; i < calc.normalizedOverheadAllocations.length; i++) {
        const ovh = calc.normalizedOverheadAllocations[i];
        const ovhId = `ovh-${planId}-${i + 1}-${Math.floor(1000 + Math.random() * 9000)}`;
        await q(
          `INSERT INTO project_plan_overhead_allocations (
            id, plan_id, project_id, category, allocation_type, rate_pct, base_amount, allocated_amount, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            ovhId,
            planId,
            projectId,
            ovh.category,
            ovh.allocationType,
            ovh.ratePct,
            ovh.baseAmount,
            ovh.allocatedAmount,
            ovh.notes || ''
          ]
        );
      }

      // 9. Insert cost summary
      await q(
        `INSERT INTO project_plan_cost_summaries (
          plan_id, project_id, planned_revenue, material_cost, subcontractor_cost,
          outsourced_cost, resource_cost, direct_cost, overhead_amount,
          contingency_amount, labor_burden_amount, extra_overhead_amount,
          allocated_overhead, total_planned_cost, gross_profit, gross_margin_pct,
          planned_profit, profit_margin_pct, boq_item_count, section_count, resource_count, calculated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18, $19, $20, $21, NOW()
        )`,
        [
          planId,
          projectId,
          calc.summary.plannedRevenue,
          calc.summary.materialCost,
          calc.summary.subcontractorCost,
          calc.summary.outsourcedCost,
          calc.summary.resourceCost,
          calc.summary.directCost,
          calc.summary.overheadAmount,
          calc.summary.contingencyAmount,
          calc.summary.laborBurdenAmount,
          calc.summary.extraOverheadAmount,
          calc.summary.allocatedOverhead,
          calc.summary.totalPlannedCost,
          calc.summary.grossProfit,
          calc.summary.grossMarginPct,
          calc.summary.plannedProfit,
          calc.summary.profitMarginPct,
          calc.summary.boqItemCount,
          calc.summary.sectionCount,
          calc.summary.resourceCount
        ]
      );

      // 10. Insert initial revision history record
      await q(
        `INSERT INTO project_plan_revisions (
          id, plan_id, project_id, revision_number, version_label, change_summary,
          status_at_revision, planned_revenue, direct_cost, allocated_overhead,
          total_planned_cost, planned_profit, profit_margin_pct, changed_by, effective_date, snapshot_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::date, $16)`,
        [
          `rev-${planId}-${revisionNumber}-${Date.now()}`,
          planId,
          projectId,
          revisionNumber,
          versionLabel,
          String(data.changeSummary || 'Initial plan creation'),
          status,
          calc.summary.plannedRevenue,
          calc.summary.directCost,
          calc.summary.allocatedOverhead,
          calc.summary.totalPlannedCost,
          calc.summary.plannedProfit,
          calc.summary.profitMarginPct,
          actorName,
          effectiveDate || todayIso,
          JSON.stringify({
            name: planName,
            planType,
            targetMarginPct,
            overheadPct,
            contingencyPct,
            laborBurdenPct,
            boqItemCount: calc.summary.boqItemCount
          })
        ]
      );

      // 11. Update parent project active_plan_id if active
      if (isActive || !proj.active_plan_id) {
        await q('UPDATE projects SET active_plan_id = $1, updated_at_ts = NOW() WHERE id = $2', [planId, projectId]);
      }

      // 12. Record audit log
      await q(
        `INSERT INTO audit_logs (id, timestamp, actor_id, actor_name, actor_role, action, module, record_id, record_name, details, ip_address, status)
         VALUES ($1, $2, $3, $4, 'ADMIN', 'PLAN_CREATED', 'Projects', $5, $6, $7, '127.0.0.1', 'Success')`,
        [
          `log-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
          new Date().toISOString(),
          actor?.id || 'SYSTEM',
          actorName,
          planNumber,
          planName,
          `Created project plan ${planNumber} (${planName}) under project ${proj.code}. Total Planned Cost: ${calc.summary.totalPlannedCost}`
        ]
      );

      return planId;
    });

    return await this.getProjectPlanById(createdPlanId);
  }

  public async updateProjectPlan(planId: string, data: any, actor?: { id?: string; name?: string }): Promise<any | null> {
    if (!planId) return null;
    const existing = await this.getProjectPlanById(planId);
    if (!existing) return null;

    const targetProjectId = data.projectId !== undefined ? String(data.projectId).trim() : existing.projectId;
    if (!targetProjectId) {
      throw Object.assign(new Error('Valid projectId is required'), { status: 400 });
    }

    const validStatuses = ['Draft', 'In Review', 'Approved', 'Active', 'Locked', 'Archived'];
    const nextStatus =
      data.status && validStatuses.includes(String(data.status))
        ? String(data.status)
        : existing.status;

    await this.withTransaction(async (q) => {
      // 1. Verify project exists
      const projRes = await q('SELECT * FROM projects WHERE id = $1 FOR UPDATE', [targetProjectId]);
      if (projRes.rows.length === 0) {
        throw Object.assign(new Error(`Referenced project '${targetProjectId}' does not exist`), { status: 404 });
      }
      const proj = projRes.rows[0];

      // 2. Validate planNumber if changed
      const nextPlanNumber = data.planNumber
        ? String(data.planNumber).trim().toUpperCase()
        : existing.planNumber;
      if (nextPlanNumber !== existing.planNumber) {
        const dupRes = await q('SELECT id FROM project_plans WHERE plan_number = $1 AND id != $2', [nextPlanNumber, planId]);
        if (dupRes.rows.length > 0) {
          throw Object.assign(new Error(`Plan number '${nextPlanNumber}' already exists`), { status: 409 });
        }
      }

      const nextName = data.name !== undefined ? String(data.name).trim() : existing.name;
      if (!nextName) {
        throw Object.assign(new Error('Plan name cannot be empty'), { status: 400 });
      }

      const rawItems =
        data.boqItems !== undefined
          ? data.boqItems
          : data.selectedItems !== undefined
          ? data.selectedItems
          : existing.boqItems;
      const rawSections = data.sections !== undefined ? data.sections : existing.sections;
      const rawResources = data.resources !== undefined ? data.resources : existing.resources;
      const rawOverheads = data.overheadAllocations !== undefined ? data.overheadAllocations : existing.overheadAllocations;

      const targetMarginPct = round2(data.targetMarginPct ?? existing.targetMarginPct ?? 25);
      const overheadPct = round2(data.overheadPct ?? existing.overheadPct ?? 8.5);
      const contingencyPct = round2(data.contingencyPct ?? existing.contingencyPct ?? 5.0);
      const laborBurdenPct = round2(data.laborBurdenPct ?? existing.laborBurdenPct ?? 0);
      const explicitRevenue = round2(data.plannedRevenue ?? data.quotedRevenue ?? existing.plannedRevenue ?? 0);

      const calc = calculatePlanFinancials({
        planId,
        projectId: targetProjectId,
        plannedRevenue: explicitRevenue,
        projectQuotedPrice: round2(proj.quoted_price || 0),
        targetMarginPct,
        overheadPct,
        contingencyPct,
        laborBurdenPct,
        boqItems: rawItems,
        sections: rawSections,
        resources: rawResources,
        overheadAllocations: rawOverheads
      });

      const financialsChanged =
        calc.summary.totalPlannedCost !== existing.totalPlannedCost ||
        calc.summary.plannedRevenue !== existing.plannedRevenue ||
        calc.summary.boqItemCount !== (existing.boqItems?.length || 0);
      const shouldBumpRevision = Boolean(data.bumpRevision) || financialsChanged || (data.status && data.status !== existing.status);

      const nextRevisionNumber =
        data.revisionNumber !== undefined
          ? Math.max(1, Number(data.revisionNumber))
          : shouldBumpRevision
          ? Number(existing.revisionNumber || 1) + 1
          : Number(existing.revisionNumber || 1);
      const nextVersionLabel =
        data.versionLabel || (shouldBumpRevision ? `v${nextRevisionNumber}.0` : existing.versionLabel || `v${nextRevisionNumber}.0`);

      const actorName = actor?.name || data.updatedBy || existing.updatedBy || 'Enterprise Planner';
      const todayIso = new Date().toISOString().slice(0, 10);
      const effectiveDate = formatSqlDate(data.effectiveDate || existing.effectiveDate, todayIso);
      const approvalDate =
        data.approvalDate !== undefined
          ? formatSqlDate(data.approvalDate, '') || null
          : nextStatus === 'Approved' || nextStatus === 'Active' || nextStatus === 'Locked'
          ? existing.approvalDate || todayIso
          : existing.approvalDate || null;
      const approvedBy =
        data.approvedBy !== undefined
          ? data.approvedBy
          : nextStatus === 'Approved' || nextStatus === 'Active' || nextStatus === 'Locked'
          ? existing.approvedBy || actorName
          : existing.approvedBy || null;

      const isBaseline = data.isBaseline !== undefined ? Boolean(data.isBaseline) : Boolean(existing.isBaseline);
      const isActive = data.isActive !== undefined ? Boolean(data.isActive) : Boolean(existing.isActive);

      if (isActive) {
        await q('UPDATE project_plans SET is_active = false WHERE project_id = $1 AND id != $2', [targetProjectId, planId]);
        await q('UPDATE projects SET active_plan_id = $1, updated_at_ts = NOW() WHERE id = $2', [planId, targetProjectId]);
      }

      await q(
        `UPDATE project_plans SET
          plan_number = $1,
          project_id = $2,
          name = $3,
          description = $4,
          plan_type = $5,
          status = $6,
          revision_number = $7,
          version_label = $8,
          is_baseline = $9,
          is_active = $10,
          currency = $11,
          planned_revenue = $12,
          target_margin_pct = $13,
          overhead_pct = $14,
          contingency_pct = $15,
          labor_burden_pct = $16,
          effective_date = $17::date,
          approval_date = $18::date,
          approved_by = $19,
          updated_by = $20,
          theme_id = $21,
          custom_gradient = $22,
          notes = $23,
          updated_at = NOW()
        WHERE id = $24`,
        [
          nextPlanNumber,
          targetProjectId,
          nextName,
          data.description !== undefined ? String(data.description) : existing.description,
          data.planType !== undefined ? String(data.planType) : existing.planType,
          nextStatus,
          nextRevisionNumber,
          nextVersionLabel,
          isBaseline,
          isActive,
          data.currency || existing.currency || 'USD',
          calc.summary.plannedRevenue,
          targetMarginPct,
          overheadPct,
          contingencyPct,
          laborBurdenPct,
          effectiveDate || todayIso,
          approvalDate,
          approvedBy,
          actorName,
          data.themeId !== undefined ? data.themeId : existing.themeId,
          data.customGradient !== undefined ? data.customGradient : existing.customGradient || null,
          data.notes !== undefined ? String(data.notes) : existing.notes || '',
          planId
        ]
      );

      // Replace sections if provided
      await q('DELETE FROM project_plan_sections WHERE plan_id = $1', [planId]);
      const sectionIds = new Set<string>();
      for (let i = 0; i < rawSections.length; i++) {
        const s = rawSections[i];
        const secId = `sec-${planId}-${i + 1}-${Math.floor(100 + Math.random() * 900)}`;
        sectionIds.add(secId);
        await q(
          `INSERT INTO project_plan_sections (
            id, plan_id, project_id, phase_code, name, description, sequence_order,
            planned_budget, material_budget, labor_budget, outsourced_budget, actual_cost,
            start_date, end_date, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::date, $14::date, $15)`,
          [
            secId,
            planId,
            targetProjectId,
            s.phaseCode || `PH-0${i + 1}`,
            s.name || `Section ${i + 1}`,
            s.description || '',
            Number(s.sequenceOrder || i + 1),
            round2(s.plannedBudget ?? s.budget ?? 0),
            round2(s.materialBudget ?? 0),
            round2(s.laborBudget ?? 0),
            round2(s.outsourcedBudget ?? 0),
            round2(s.actualCost ?? 0),
            s.startDate && /^\d{4}-\d{2}-\d{2}/.test(String(s.startDate)) ? String(s.startDate).slice(0, 10) : null,
            s.endDate && /^\d{4}-\d{2}-\d{2}/.test(String(s.endDate)) ? String(s.endDate).slice(0, 10) : null,
            s.status || 'Not Started'
          ]
        );
      }

      // Replace BOQ items
      await q('DELETE FROM project_plan_boq_items WHERE plan_id = $1', [planId]);
      for (let i = 0; i < calc.normalizedBoqItems.length; i++) {
        const item = calc.normalizedBoqItems[i];
        const boqId = `boq-${planId}-${i + 1}-${Math.floor(1000 + Math.random() * 9000)}`;
        const validSecId = item.sectionId && sectionIds.has(item.sectionId) ? item.sectionId : null;
        await q(
          `INSERT INTO project_plan_boq_items (
            id, plan_id, project_id, section_id, phase_id, item_type, catalog_item_id, item_code,
            name, category, supplier_or_provider, quantity, unit, unit_cost, discount_pct,
            total_cost, markup_pct, billable_rate, total_revenue, gross_profit,
            currency, native_unit_cost, consumption_rate, notes, line_order
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25
          )`,
          [
            boqId,
            planId,
            targetProjectId,
            validSecId,
            item.phaseId || 'phase-01',
            item.type,
            item.itemId || null,
            item.itemCode || item.itemId || `ITM-${i + 1}`,
            item.name,
            item.category || '',
            item.supplierOrProvider || '',
            item.quantity,
            item.unit || 'pcs',
            item.unitCost,
            item.discountPct,
            item.totalCost,
            item.markupPct ?? 30,
            item.billableRate ?? 0,
            item.totalRevenue ?? 0,
            item.grossProfit ?? 0,
            item.currency || existing.currency || 'USD',
            item.nativeUnitCost ?? item.unitCost,
            item.consumptionRate ?? 100,
            item.notes || '',
            i + 1
          ]
        );
      }

      // Replace resources
      await q('DELETE FROM project_plan_resources WHERE plan_id = $1', [planId]);
      for (let i = 0; i < calc.normalizedResources.length; i++) {
        const rItem = calc.normalizedResources[i];
        const resRowId = `res-${planId}-${i + 1}-${Math.floor(1000 + Math.random() * 9000)}`;
        const validSecId = rItem.sectionId && sectionIds.has(rItem.sectionId) ? rItem.sectionId : null;
        await q(
          `INSERT INTO project_plan_resources (
            id, plan_id, project_id, section_id, resource_id, resource_type,
            name, role_or_trade, allocated_hours, hourly_rate, total_cost,
            start_date, end_date, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::date, $13::date, $14)`,
          [
            resRowId,
            planId,
            targetProjectId,
            validSecId,
            rItem.resourceId,
            rItem.resourceType,
            rItem.name,
            rItem.roleOrTrade || '',
            rItem.allocatedHours,
            rItem.hourlyRate,
            rItem.totalCost,
            rItem.startDate && /^\d{4}-\d{2}-\d{2}/.test(String(rItem.startDate)) ? String(rItem.startDate).slice(0, 10) : null,
            rItem.endDate && /^\d{4}-\d{2}-\d{2}/.test(String(rItem.endDate)) ? String(rItem.endDate).slice(0, 10) : null,
            rItem.notes || ''
          ]
        );
      }

      // Replace overhead allocations
      await q('DELETE FROM project_plan_overhead_allocations WHERE plan_id = $1', [planId]);
      for (let i = 0; i < calc.normalizedOverheadAllocations.length; i++) {
        const ovh = calc.normalizedOverheadAllocations[i];
        const ovhId = `ovh-${planId}-${i + 1}-${Math.floor(1000 + Math.random() * 9000)}`;
        await q(
          `INSERT INTO project_plan_overhead_allocations (
            id, plan_id, project_id, category, allocation_type, rate_pct, base_amount, allocated_amount, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            ovhId,
            planId,
            targetProjectId,
            ovh.category,
            ovh.allocationType,
            ovh.ratePct,
            ovh.baseAmount,
            ovh.allocatedAmount,
            ovh.notes || ''
          ]
        );
      }

      // Upsert cost summary
      await q(
        `INSERT INTO project_plan_cost_summaries (
          plan_id, project_id, planned_revenue, material_cost, subcontractor_cost,
          outsourced_cost, resource_cost, direct_cost, overhead_amount,
          contingency_amount, labor_burden_amount, extra_overhead_amount,
          allocated_overhead, total_planned_cost, gross_profit, gross_margin_pct,
          planned_profit, profit_margin_pct, boq_item_count, section_count, resource_count, calculated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18, $19, $20, $21, NOW()
        )
        ON CONFLICT (plan_id) DO UPDATE SET
          project_id = EXCLUDED.project_id,
          planned_revenue = EXCLUDED.planned_revenue,
          material_cost = EXCLUDED.material_cost,
          subcontractor_cost = EXCLUDED.subcontractor_cost,
          outsourced_cost = EXCLUDED.outsourced_cost,
          resource_cost = EXCLUDED.resource_cost,
          direct_cost = EXCLUDED.direct_cost,
          overhead_amount = EXCLUDED.overhead_amount,
          contingency_amount = EXCLUDED.contingency_amount,
          labor_burden_amount = EXCLUDED.labor_burden_amount,
          extra_overhead_amount = EXCLUDED.extra_overhead_amount,
          allocated_overhead = EXCLUDED.allocated_overhead,
          total_planned_cost = EXCLUDED.total_planned_cost,
          gross_profit = EXCLUDED.gross_profit,
          gross_margin_pct = EXCLUDED.gross_margin_pct,
          planned_profit = EXCLUDED.planned_profit,
          profit_margin_pct = EXCLUDED.profit_margin_pct,
          boq_item_count = EXCLUDED.boq_item_count,
          section_count = EXCLUDED.section_count,
          resource_count = EXCLUDED.resource_count,
          calculated_at = NOW()`,
        [
          planId,
          targetProjectId,
          calc.summary.plannedRevenue,
          calc.summary.materialCost,
          calc.summary.subcontractorCost,
          calc.summary.outsourcedCost,
          calc.summary.resourceCost,
          calc.summary.directCost,
          calc.summary.overheadAmount,
          calc.summary.contingencyAmount,
          calc.summary.laborBurdenAmount,
          calc.summary.extraOverheadAmount,
          calc.summary.allocatedOverhead,
          calc.summary.totalPlannedCost,
          calc.summary.grossProfit,
          calc.summary.grossMarginPct,
          calc.summary.plannedProfit,
          calc.summary.profitMarginPct,
          calc.summary.boqItemCount,
          calc.summary.sectionCount,
          calc.summary.resourceCount
        ]
      );

      // Append revision snapshot if revision bumped
      if (shouldBumpRevision) {
        await q(
          `INSERT INTO project_plan_revisions (
            id, plan_id, project_id, revision_number, version_label, change_summary,
            status_at_revision, planned_revenue, direct_cost, allocated_overhead,
            total_planned_cost, planned_profit, profit_margin_pct, changed_by, effective_date, snapshot_json
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::date, $16)`,
          [
            `rev-${planId}-${nextRevisionNumber}-${Date.now()}`,
            planId,
            targetProjectId,
            nextRevisionNumber,
            nextVersionLabel,
            String(data.changeSummary || `Updated plan (${nextVersionLabel})`),
            nextStatus,
            calc.summary.plannedRevenue,
            calc.summary.directCost,
            calc.summary.allocatedOverhead,
            calc.summary.totalPlannedCost,
            calc.summary.plannedProfit,
            calc.summary.profitMarginPct,
            actorName,
            effectiveDate || todayIso,
            JSON.stringify({
              name: nextName,
              planType: data.planType || existing.planType,
              targetMarginPct,
              overheadPct,
              contingencyPct,
              laborBurdenPct,
              boqItemCount: calc.summary.boqItemCount
            })
          ]
        );
      }

      await q(
        `INSERT INTO audit_logs (id, timestamp, actor_id, actor_name, actor_role, action, module, record_id, record_name, details, ip_address, status)
         VALUES ($1, $2, $3, $4, 'ADMIN', 'PLAN_UPDATED', 'Projects', $5, $6, $7, '127.0.0.1', 'Success')`,
        [
          `log-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
          new Date().toISOString(),
          actor?.id || 'SYSTEM',
          actorName,
          nextPlanNumber,
          nextName,
          `Updated plan ${nextPlanNumber} (${nextVersionLabel}) — Status: ${nextStatus}, Total Planned Cost: ${calc.summary.totalPlannedCost}`
        ]
      );
    });

    return await this.getProjectPlanById(planId);
  }

  public async archiveProjectPlan(planId: string, actor?: { id?: string; name?: string }, reason?: string): Promise<any | null> {
    const existing = await this.getProjectPlanById(planId);
    if (!existing) return null;
    const updated = await this.updateProjectPlan(
      planId,
      {
        status: 'Archived',
        isActive: false,
        bumpRevision: true,
        changeSummary: reason || 'Archived project plan'
      },
      actor
    );

    const db = await this.getDb();
    const otherActive = await db.query(
      "SELECT id FROM project_plans WHERE project_id = $1 AND status != 'Archived' AND id != $2 ORDER BY is_baseline DESC, updated_at DESC LIMIT 1",
      [existing.projectId, planId]
    );
    if (otherActive.rows[0]) {
      await db.query('UPDATE project_plans SET is_active = true WHERE id = $1', [otherActive.rows[0].id]);
      await db.query('UPDATE projects SET active_plan_id = $1 WHERE id = $2', [otherActive.rows[0].id, existing.projectId]);
    }
    return updated;
  }

  public async activateProjectPlan(planId: string, actor?: { id?: string; name?: string }): Promise<any | null> {
    const existing = await this.getProjectPlanById(planId);
    if (!existing) return null;
    await this.withTransaction(async (q) => {
      await q('UPDATE project_plans SET is_active = false WHERE project_id = $1', [existing.projectId]);
      await q(
        `UPDATE project_plans
         SET is_active = true,
             status = CASE WHEN status = 'Draft' THEN 'Active' ELSE status END,
             updated_by = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [actor?.name || 'Enterprise Planner', planId]
      );
      await q(
        `UPDATE projects
         SET active_plan_id = $1,
             selected_items = $2,
             target_margin_pct = $3,
             overhead_pct = $4,
             contingency_pct = $5,
             updated_at_ts = NOW()
         WHERE id = $6`,
        [
          planId,
          JSON.stringify(existing.selectedItems || []),
          round2(existing.targetMarginPct ?? 25),
          round2(existing.overheadPct ?? 8.5),
          round2(existing.contingencyPct ?? 5.0),
          existing.projectId
        ]
      );
    });
    return await this.getProjectPlanById(planId);
  }

  public async duplicateProjectPlan(planId: string, overrides?: any, actor?: { id?: string; name?: string }): Promise<any | null> {
    const source = await this.getProjectPlanById(planId);
    if (!source) return null;
    const targetProjectId = overrides?.projectId || source.projectId;
    return await this.createProjectPlan(
      {
        projectId: targetProjectId,
        name: overrides?.name || `${source.name} (Copy)`,
        description: overrides?.description ?? source.description,
        planType: overrides?.planType || 'Alternative',
        status: 'Draft',
        isBaseline: false,
        isActive: Boolean(overrides?.isActive),
        currency: source.currency,
        plannedRevenue: overrides?.plannedRevenue ?? source.plannedRevenue,
        targetMarginPct: overrides?.targetMarginPct ?? source.targetMarginPct,
        overheadPct: overrides?.overheadPct ?? source.overheadPct,
        contingencyPct: overrides?.contingencyPct ?? source.contingencyPct,
        laborBurdenPct: overrides?.laborBurdenPct ?? source.laborBurdenPct,
        themeId: overrides?.themeId || source.themeId,
        sourceProjectId: source.projectId,
        sourceProjectCode: source.projectCode,
        notes: overrides?.notes ?? source.notes,
        boqItems: (source.boqItems || []).map((item: any, idx: number) => ({
          ...item,
          id: undefined,
          lineOrder: idx + 1
        })),
        sections: (source.sections || []).map((sec: any, idx: number) => ({
          ...sec,
          id: undefined,
          sequenceOrder: idx + 1
        })),
        resources: (source.resources || []).map((resItem: any) => ({
          ...resItem,
          id: undefined
        })),
        overheadAllocations: (source.overheadAllocations || []).map((ovh: any) => ({
          ...ovh,
          id: undefined
        })),
        changeSummary: `Duplicated from plan ${source.planNumber}`
      },
      actor
    );
  }

  public async deleteProjectPlan(planId: string, actor?: { id?: string; name?: string }): Promise<boolean> {
    const existing = await this.getProjectPlanById(planId);
    if (!existing) return false;
    await this.withTransaction(async (q) => {
      await q('DELETE FROM project_plans WHERE id = $1', [planId]);
      const nextActive = await q(
        "SELECT id FROM project_plans WHERE project_id = $1 AND status != 'Archived' ORDER BY is_baseline DESC, updated_at DESC LIMIT 1",
        [existing.projectId]
      );
      const nextId = nextActive.rows[0]?.id || null;
      if (nextId) {
        await q('UPDATE project_plans SET is_active = true WHERE id = $1', [nextId]);
      }
      await q('UPDATE projects SET active_plan_id = $1 WHERE id = $2', [nextId, existing.projectId]);
      await q(
        `INSERT INTO audit_logs (id, timestamp, actor_id, actor_name, actor_role, action, module, record_id, record_name, details, ip_address, status)
         VALUES ($1, $2, $3, $4, 'ADMIN', 'PLAN_DELETED', 'Projects', $5, $6, $7, '127.0.0.1', 'Success')`,
        [
          `log-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
          new Date().toISOString(),
          actor?.id || 'SYSTEM',
          actor?.name || 'Enterprise Planner',
          existing.planNumber,
          existing.name,
          `Deleted project plan ${existing.planNumber} (${existing.name}) from project ${existing.projectCode}`
        ]
      );
    });
    return true;
  }

  // --- Categories CRUD ---
  public async getCategories(opts?: ListQueryOptions): Promise<any[]> {
    const res = await this.getCategoriesPaginated(opts);
    return res.data;
  }

  public async getCategoriesPaginated(opts?: ListQueryOptions): Promise<PaginatedResult<any>> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM categories ORDER BY created_at ASC');
    const rows = res.rows.map((r: any) => ({
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
    return parseFilterPagination(rows, opts, ['name', 'type', 'group', 'parentName', 'brief']);
  }

  public async createCategory(data: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `cat-${Date.now()}`;
    await db.query(
      `INSERT INTO categories (id, name, type, group_name, parent_id, parent_name, brief, item_count, theme_id, custom_gradient, icon, meta_badge, action_text, created_at, updated_at_ts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
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
         action_text = EXCLUDED.action_text,
         updated_at_ts = NOW()`,
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
    const existing = (await this.getCategories()).find((c) => c.id === id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    await db.query(
      `UPDATE categories SET name=$1, brief=$2, theme_id=$3, custom_gradient=$4, icon=$5, meta_badge=$6, action_text=$7, updated_at_ts=NOW() WHERE id=$8`,
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
    await db.query(
      'DELETE FROM categories WHERE id=$1 OR parent_id=$1 OR parent_id IN (SELECT id FROM categories WHERE parent_id=$1)',
      [id]
    );
    return true;
  }

  // --- Inventory CRUD ---
  public async getInventory(opts?: ListQueryOptions): Promise<any[]> {
    const res = await this.getInventoryPaginated(opts);
    return res.data;
  }

  public async getInventoryPaginated(opts?: ListQueryOptions): Promise<PaginatedResult<any>> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM inventory ORDER BY created_at DESC');
    const rows = res.rows.map((r: any) => ({
      id: r.id,
      sku: r.sku,
      name: r.name,
      itemName: r.item_name || r.name,
      category: r.category,
      materialId: r.material_id,
      allocatedProjectId: r.allocated_project_id,
      projectPhase: r.project_phase,
      onHand: round4(r.on_hand || 0),
      reserved: round4(r.reserved || 0),
      available: round4(r.available || 0),
      reorderLevel: round4(r.reorder_level || 0),
      unit: r.unit || 'pcs',
      unitCost: round4(r.unit_cost || 0),
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      status: r.status,
      location: r.location,
      barcode: r.barcode,
      lastAuditDate: r.last_audit_date
    }));
    return parseFilterPagination(rows, opts, ['sku', 'name', 'itemName', 'category', 'supplierName', 'location', 'barcode', 'status']);
  }

  public async createInventory(data: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `inv-${Date.now()}`;
    const onHand = Math.max(0, round4(data.onHand || 0));
    const reserved = Math.max(0, round4(data.reserved || 0));
    const available = Math.max(0, round4(data.available ?? decSub(onHand, reserved)));
    let sku = String(data.sku || `SKU-${Date.now().toString().slice(-4)}`).trim();
    try {
      const existingSku = await db.query('SELECT id FROM inventory WHERE sku = $1 AND id != $2', [sku, id]);
      if (existingSku.rows.length > 0) {
        sku = `${sku}-${Math.floor(100 + Math.random() * 900)}`;
      }
    } catch {
      // ignore
    }

    await db.query(
      `INSERT INTO inventory (id, sku, name, item_name, category, material_id, allocated_project_id, project_phase, on_hand, reserved, available, reorder_level, unit, unit_cost, supplier_id, supplier_name, status, location, barcode, last_audit_date, created_at, updated_at_ts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         sku = EXCLUDED.sku,
         category = EXCLUDED.category,
         on_hand = EXCLUDED.on_hand,
         reserved = EXCLUDED.reserved,
         available = EXCLUDED.available,
         unit_cost = EXCLUDED.unit_cost,
         status = EXCLUDED.status,
         location = EXCLUDED.location,
         updated_at_ts = NOW()`,
      [
        id,
        sku,
        data.name || data.itemName || 'Inventory Item',
        data.itemName || data.name || 'Inventory Item',
        data.category || 'Materials',
        data.materialId || null,
        data.allocatedProjectId || null,
        data.projectPhase || '',
        onHand,
        reserved,
        available,
        round4(data.reorderLevel || 5),
        data.unit || 'pcs',
        round4(data.unitCost || 0),
        data.supplierId || null,
        data.supplierName || '',
        data.status || 'Optimal',
        data.location || 'Warehouse',
        data.barcode || sku,
        data.lastAuditDate || new Date().toISOString().split('T')[0],
        new Date().toISOString()
      ]
    );
    return { ...data, id, sku, onHand, reserved, available };
  }

  public async updateInventory(id: string, data: any): Promise<any> {
    const db = await this.getDb();
    const existing = (await this.getInventory()).find((i) => i.id === id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    const onHand = Math.max(0, round4(merged.onHand || 0));
    const reserved = Math.max(0, round4(merged.reserved || 0));
    const available = Math.max(0, round4(merged.available ?? decSub(onHand, reserved)));
    await db.query(
      `UPDATE inventory SET sku=$1, name=$2, item_name=$3, category=$4, on_hand=$5, reserved=$6, available=$7, reorder_level=$8, unit=$9, unit_cost=$10, supplier_name=$11, status=$12, location=$13, barcode=$14, last_audit_date=$15, updated_at_ts=NOW() WHERE id=$16`,
      [
        merged.sku,
        merged.name,
        merged.itemName || merged.name,
        merged.category,
        onHand,
        reserved,
        available,
        round4(merged.reorderLevel || 5),
        merged.unit,
        round4(merged.unitCost || 0),
        merged.supplierName || '',
        merged.status || 'Optimal',
        merged.location || '',
        merged.barcode || '',
        merged.lastAuditDate || new Date().toISOString().split('T')[0],
        id
      ]
    );
    return { ...merged, onHand, reserved, available };
  }

  public async deleteInventory(id: string): Promise<boolean> {
    const db = await this.getDb();
    await db.query('DELETE FROM inventory WHERE id=$1', [id]);
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
    const existing = users.find((u) => u.id === id);
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

  public async deleteUser(id: string): Promise<boolean> {
    const db = await this.getDb();
    await db.query('DELETE FROM users WHERE id=$1', [id]);
    return true;
  }

  // --- Account Requests CRUD (PostgreSQL inno_cost) ---
  public async getAccountRequests(): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM account_requests ORDER BY submitted_at_ts DESC, submitted_date DESC');
    return res.rows.map((r: any) => ({
      id: r.id,
      employeeId: r.employee_id,
      name: r.name,
      email: r.email,
      requestedRole: r.requested_role,
      department: r.department,
      reason: r.reason,
      submittedAt: r.submitted_date,
      status: r.status || 'Pending',
      reviewedBy: r.reviewed_by
    }));
  }

  public async createAccountRequest(data: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `req-${Date.now()}`;
    const submittedDate = data.submittedAt || data.submittedDate || new Date().toISOString().replace('T', ' ').slice(0, 19);
    await db.query(
      `INSERT INTO account_requests (id, employee_id, name, email, requested_role, department, reason, submitted_date, submitted_at_ts, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         reason = EXCLUDED.reason`,
      [
        id,
        data.employeeId || `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
        data.name || 'Applicant',
        data.email || '',
        data.requestedRole || 'PROJECT_MANAGER',
        data.department || 'Operations',
        data.reason || '',
        submittedDate,
        data.status || 'Pending'
      ]
    );
    return {
      id,
      employeeId: data.employeeId || `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
      name: data.name,
      email: data.email,
      requestedRole: data.requestedRole || 'PROJECT_MANAGER',
      department: data.department || 'Operations',
      reason: data.reason || '',
      submittedAt: submittedDate,
      status: data.status || 'Pending'
    };
  }

  public async updateAccountRequestStatus(id: string, status: 'Approved' | 'Rejected', reviewedBy?: string): Promise<any> {
    const db = await this.getDb();
    await db.query(
      `UPDATE account_requests SET status = $1, reviewed_by = $2, reviewed_at_ts = NOW() WHERE id = $3`,
      [status, reviewedBy || 'ADMIN', id]
    );
    const reqs = await this.getAccountRequests();
    return reqs.find((r) => r.id === id) || null;
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
      `INSERT INTO custom_tiles (id, group_name, tag, title, brief, action, theme_id, custom_gradient, created_at, updated_at_ts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (id) DO UPDATE SET
         group_name = EXCLUDED.group_name,
         tag = EXCLUDED.tag,
         title = EXCLUDED.title,
         brief = EXCLUDED.brief,
         action = EXCLUDED.action,
         theme_id = EXCLUDED.theme_id,
         custom_gradient = EXCLUDED.custom_gradient,
         updated_at_ts = NOW()`,
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

  public async updateCustomTile(id: string, data: any): Promise<any> {
    const db = await this.getDb();
    const existing = (await this.getCustomTiles()).find((t) => t.id === id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    await db.query(
      `UPDATE custom_tiles SET group_name=$1, tag=$2, title=$3, brief=$4, action=$5, theme_id=$6, custom_gradient=$7, updated_at_ts=NOW() WHERE id=$8`,
      [
        merged.group || merged.groupName || 'general',
        merged.tag || '',
        merged.title,
        merged.brief || '',
        merged.action || 'OPEN CATALOG',
        merged.themeId || null,
        merged.customGradient || null,
        id
      ]
    );
    return merged;
  }

  public async deleteCustomTile(id: string): Promise<boolean> {
    const db = await this.getDb();
    await db.query('DELETE FROM custom_tiles WHERE id = $1', [id]);
    return true;
  }

  // --- Inventory Transactions CRUD ---
  public async getTransactions(opts?: ListQueryOptions): Promise<any[]> {
    const res = await this.getTransactionsPaginated(opts);
    return res.data;
  }

  public async getTransactionsPaginated(opts?: ListQueryOptions): Promise<PaginatedResult<any>> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM inventory_transactions ORDER BY created_at_ts DESC, timestamp DESC LIMIT 1000');
    const rows = res.rows.map((r: any) => ({
      id: r.id,
      transactionNumber: r.transaction_number,
      type: r.type,
      date: formatSqlDate(r.effective_date, r.timestamp),
      materialId: r.material_id,
      materialCode: r.material_code,
      materialName: r.material_name,
      projectId: r.project_id,
      projectCode: r.project_code || (r.project_id ? r.project_id : 'GENERAL'),
      projectName: r.project_name || 'General Inventory',
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      barcode: r.barcode || r.material_code,
      inventorySku: r.inventory_sku || (r.material_code ? `SKU-${r.material_code}` : ''),
      batchLotNumber: r.batch_lot_number || '',
      requisitionNumber: r.requisition_number || '',
      currency: r.currency || 'USD',
      quantity: round4(r.quantity || 0),
      unit: r.unit || 'pcs',
      price: round4(r.price || 0),
      discount: round2(r.discount || 0),
      discountAmount: round2(r.discount_amount || 0),
      totalAmount: round2(r.total_amount || 0),
      previousQuantity: round4(r.previous_quantity || 0),
      previousAvailableQuantity: round4(r.previous_quantity || 0),
      newAvailableQuantity: round4(r.new_available_quantity || 0),
      actorName: r.actor_name,
      actorId: r.actor_id,
      effectiveDate: formatSqlDate(r.effective_date, r.timestamp),
      timestamp: r.timestamp,
      notes: r.notes
    }));
    return parseFilterPagination(rows, opts, ['transactionNumber', 'materialCode', 'materialName', 'projectName', 'supplierName', 'batchLotNumber', 'requisitionNumber', 'notes']);
  }

  public async createTransaction(data: any, actor?: { id?: string; name?: string }): Promise<any> {
    const type = String(data.type || '').toUpperCase();
    const qty = round4(data.quantity);
    if (!['IN', 'OUT'].includes(type)) throw Object.assign(new Error('Type must be IN or OUT'), { status: 400 });
    if (!Number.isFinite(qty) || qty <= 0) throw Object.assign(new Error('Quantity must be more than 0'), { status: 400 });

    const id = data.id || `txn-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const txNum = String(data.transactionNumber || `TXN-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`).trim();
    const idempotencyKey = data.idempotencyKey ? String(data.idempotencyKey).trim() : txNum;

    return this.withTransaction(async (q) => {
      // Idempotency check: prevent duplicate financial transactions
      const existingTx = await q(
        'SELECT * FROM inventory_transactions WHERE transaction_number = $1 OR (idempotency_key IS NOT NULL AND idempotency_key = $2) LIMIT 1',
        [txNum, idempotencyKey]
      );
      if (existingTx.rows.length > 0) {
        const r = existingTx.rows[0];
        return {
          ...data,
          id: r.id,
          transactionNumber: r.transaction_number,
          type: r.type,
          materialId: r.material_id,
          materialCode: r.material_code,
          materialName: r.material_name,
          quantity: round4(r.quantity),
          discountAmount: round2(r.discount_amount || 0),
          totalAmount: round2(r.total_amount),
          previousAvailableQuantity: round4(r.previous_quantity),
          newAvailableQuantity: round4(r.new_available_quantity),
          idempotentReplay: true
        };
      }

      let materialId: string | null = data.materialId || null;
      if (!materialId && data.materialCode) {
        const m = await q('SELECT id FROM materials WHERE code=$1', [data.materialCode]);
        materialId = m.rows[0]?.id || null;
      }
      if (!materialId) throw Object.assign(new Error('Material is required'), { status: 400 });

      // Lock the material row so concurrent transactions cannot corrupt stock
      const mat = await q('SELECT in_stock, code, name, unit, current_price FROM materials WHERE id=$1 FOR UPDATE', [materialId]);
      if (!mat.rows[0]) throw Object.assign(new Error('Material not found'), { status: 404 });

      const previous = round4(mat.rows[0].in_stock || 0);
      const next = type === 'IN' ? round4(decAdd(previous, qty)) : round4(decSub(previous, qty));
      if (next < 0) throw Object.assign(new Error(`Not enough stock. Available: ${previous}`), { status: 409 });

      const effectiveDate = (data.effectiveDate || data.date || new Date().toISOString()).slice(0, 10);

      await q('UPDATE materials SET in_stock=$1, last_updated=$2, updated_at_ts=NOW() WHERE id=$3', [
        next,
        effectiveDate,
        materialId
      ]);
      await q(
        'UPDATE inventory SET on_hand=$1, available=GREATEST(0, $1 - COALESCE(reserved,0)), updated_at_ts=NOW() WHERE material_id=$2',
        [next, materialId]
      );

      const price = round4(data.price ?? mat.rows[0].current_price ?? 0);
      const discount = Math.max(0, Math.min(100, round2(data.discount ?? data.discountPct ?? 0)));
      const { discountAmount, totalAmount } = calcDiscountedLine(qty, price, discount);
      const isoTimestamp = new Date().toISOString();

      await q(
        `INSERT INTO inventory_transactions
          (id, transaction_number, type, material_id, material_code, material_name, project_id, project_code, project_name, supplier_id, supplier_name, barcode, inventory_sku, batch_lot_number, requisition_number, currency, quantity, unit, price, discount, discount_amount, total_amount, previous_quantity, new_available_quantity, actor_name, actor_id, effective_date, timestamp, notes, idempotency_key, created_at_ts)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,NOW())`,
        [
          id,
          txNum,
          type,
          materialId,
          mat.rows[0].code,
          mat.rows[0].name,
          data.projectId && data.projectId !== 'none' ? data.projectId : null,
          data.projectCode || 'GENERAL',
          data.projectName || 'General Inventory',
          data.supplierId || null,
          data.supplierName || '',
          data.barcode || mat.rows[0].code,
          data.inventorySku || `SKU-${mat.rows[0].code}`,
          data.batchLotNumber || '',
          data.requisitionNumber || '',
          data.currency || 'USD',
          qty,
          mat.rows[0].unit || data.unit || 'pcs',
          price,
          discount,
          discountAmount,
          totalAmount,
          previous,
          next,
          actor?.name || data.actorName || 'System User',
          actor?.id || data.actorId || null,
          effectiveDate,
          isoTimestamp,
          data.notes || '',
          idempotencyKey
        ]
      );

      return {
        ...data,
        id,
        transactionNumber: txNum,
        type,
        date: effectiveDate,
        effectiveDate,
        timestamp: isoTimestamp,
        materialId,
        materialCode: mat.rows[0].code,
        materialName: mat.rows[0].name,
        quantity: qty,
        price,
        discount,
        discountAmount,
        totalAmount,
        previousQuantity: previous,
        previousAvailableQuantity: previous,
        newAvailableQuantity: next
      };
    });
  }

  /**
   * Update an existing inventory transaction and atomically adjust material & inventory stock.
   */
  public async updateTransaction(id: string, data: any, actor?: { id?: string; name?: string }): Promise<any> {
    return this.withTransaction(async (q) => {
      const txRes = await q('SELECT * FROM inventory_transactions WHERE id = $1 FOR UPDATE', [id]);
      if (txRes.rows.length === 0) return null;
      const oldTx = txRes.rows[0];

      const newType = String(data.type || oldTx.type).toUpperCase();
      const newQty = round4(data.quantity ?? oldTx.quantity);
      if (!['IN', 'OUT'].includes(newType)) throw Object.assign(new Error('Type must be IN or OUT'), { status: 400 });
      if (!Number.isFinite(newQty) || newQty <= 0) throw Object.assign(new Error('Quantity must be > 0'), { status: 400 });

      const materialId = oldTx.material_id;
      let nextStock = round4(oldTx.new_available_quantity || 0);
      let prevStock = round4(oldTx.previous_quantity || 0);

      if (materialId) {
        const matRes = await q('SELECT in_stock FROM materials WHERE id = $1 FOR UPDATE', [materialId]);
        if (matRes.rows[0]) {
          const currentStock = round4(matRes.rows[0].in_stock || 0);
          // Reverse old transaction effect, then apply new transaction effect
          const oldSigned = oldTx.type === 'IN' ? round4(oldTx.quantity) : -round4(oldTx.quantity);
          const newSigned = newType === 'IN' ? newQty : -newQty;
          const reverted = decSub(currentStock, oldSigned);
          nextStock = round4(decAdd(reverted, newSigned));
          if (nextStock < 0) {
            throw Object.assign(new Error(`Insufficient stock to apply transaction edit. Available before edit: ${reverted}`), { status: 409 });
          }
          prevStock = round4(reverted);

          await q('UPDATE materials SET in_stock = $1, updated_at_ts = NOW() WHERE id = $2', [nextStock, materialId]);
          await q(
            'UPDATE inventory SET on_hand = $1, available = GREATEST(0, $1 - COALESCE(reserved,0)), updated_at_ts = NOW() WHERE material_id = $2',
            [nextStock, materialId]
          );
        }
      }

      const newPrice = round4(data.price ?? oldTx.price);
      const newDiscount = Math.max(0, Math.min(100, round2(data.discount ?? oldTx.discount ?? 0)));
      const { discountAmount, totalAmount } = calcDiscountedLine(newQty, newPrice, newDiscount);

      await q(
        `UPDATE inventory_transactions
         SET type = $1, quantity = $2, price = $3, discount = $4, discount_amount = $5, total_amount = $6,
             previous_quantity = $7, new_available_quantity = $8, batch_lot_number = $9, notes = $10
         WHERE id = $11`,
        [
          newType,
          newQty,
          newPrice,
          newDiscount,
          discountAmount,
          totalAmount,
          prevStock,
          nextStock,
          data.batchLotNumber ?? oldTx.batch_lot_number ?? '',
          data.notes ?? oldTx.notes ?? '',
          id
        ]
      );

      await q(
        `INSERT INTO audit_logs (id, timestamp, actor_id, actor_name, actor_role, action, module, record_id, record_name, details, ip_address, status)
         VALUES ($1, $2, $3, $4, 'ADMIN', 'TRANSACTION_UPDATED', 'Inventory', $5, $6, $7, '127.0.0.1', 'Success')`,
        [
          `log-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
          new Date().toISOString(),
          actor?.id || 'SYSTEM',
          actor?.name || 'System User',
          oldTx.transaction_number,
          oldTx.material_name,
          `Updated transaction ${oldTx.transaction_number}: ${newType} ${newQty} @ ${newPrice} (Total: ${totalAmount})`
        ]
      );

      return true;
    });
    const list = await this.getTransactions();
    return list.find((t) => t.id === id);
  }

  /**
   * Delete/reject an inventory transaction and atomically reverse its stock impact.
   */
  public async deleteTransaction(id: string, actor?: { id?: string; name?: string }): Promise<boolean> {
    return this.withTransaction(async (q) => {
      const txRes = await q('SELECT * FROM inventory_transactions WHERE id = $1 FOR UPDATE', [id]);
      if (txRes.rows.length === 0) return false;
      const oldTx = txRes.rows[0];

      if (oldTx.material_id) {
        const matRes = await q('SELECT in_stock FROM materials WHERE id = $1 FOR UPDATE', [oldTx.material_id]);
        if (matRes.rows[0]) {
          const currentStock = round4(matRes.rows[0].in_stock || 0);
          const qty = round4(oldTx.quantity || 0);
          const revertedStock = oldTx.type === 'IN' ? round4(decSub(currentStock, qty)) : round4(decAdd(currentStock, qty));
          if (revertedStock < 0) {
            throw Object.assign(new Error(`Cannot reverse IN transaction: reversing ${qty} would result in negative stock (${revertedStock}).`), { status: 409 });
          }
          await q('UPDATE materials SET in_stock = $1, updated_at_ts = NOW() WHERE id = $2', [revertedStock, oldTx.material_id]);
          await q(
            'UPDATE inventory SET on_hand = $1, available = GREATEST(0, $1 - COALESCE(reserved,0)), updated_at_ts = NOW() WHERE material_id = $2',
            [revertedStock, oldTx.material_id]
          );
        }
      }

      await q('DELETE FROM inventory_transactions WHERE id = $1', [id]);

      await q(
        `INSERT INTO audit_logs (id, timestamp, actor_id, actor_name, actor_role, action, module, record_id, record_name, details, ip_address, status)
         VALUES ($1, $2, $3, $4, 'ADMIN', 'TRANSACTION_REVERSED', 'Inventory', $5, $6, $7, '127.0.0.1', 'Success')`,
        [
          `log-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
          new Date().toISOString(),
          actor?.id || 'SYSTEM',
          actor?.name || 'System User',
          oldTx.transaction_number,
          oldTx.material_name,
          `Reversed and deleted inventory transaction ${oldTx.transaction_number} (${oldTx.type} ${oldTx.quantity}).`
        ]
      );

      return true;
    });
  }

  // --- Audit Logs CRUD ---
  public async getAuditLogs(opts?: ListQueryOptions): Promise<any[]> {
    const res = await this.getAuditLogsPaginated(opts);
    return res.data;
  }

  public async getAuditLogsPaginated(opts?: ListQueryOptions): Promise<PaginatedResult<any>> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM audit_logs ORDER BY created_at_ts DESC, timestamp DESC LIMIT 1000');
    const rows = res.rows.map((r: any) => ({
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
    return parseFilterPagination(rows, opts, ['actorName', 'actorId', 'action', 'module', 'recordId', 'recordName', 'details']);
  }

  public async createAuditLog(data: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `log-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const timestamp = data.timestamp || new Date().toISOString();
    await db.query(
      `INSERT INTO audit_logs (id, timestamp, actor_id, actor_name, actor_role, action, module, record_id, record_name, details, ip_address, status, created_at_ts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        id,
        timestamp,
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
    return { ...data, id, timestamp };
  }

  // --- Database Status ---
  public async getDbStats(): Promise<any> {
    const db = await this.getDb();
    const tables = [
      'clients', 'projects', 'project_plans', 'project_plan_revisions',
      'project_plan_sections', 'project_plan_boq_items', 'project_plan_resources',
      'project_plan_overhead_allocations', 'project_plan_cost_summaries',
      'suppliers', 'materials', 'outsourced_services',
      'subcontractors', 'produce_items', 'inventory', 'inventory_transactions',
      'price_history_records', 'categories', 'custom_tiles', 'company_details',
      'users', 'account_requests', 'media_assets', 'audit_logs', 'schema_migrations'
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
    const migrations = await this.getMigrations().catch(() => []);
    return {
      connected: true,
      engine: 'PostgreSQL',
      database: 'inno_cost',
      isPrimary: true,
      soleDatabase: true,
      tableCounts: counts,
      migrationsApplied: migrations.map((m) => m.name)
    };
  }
}

export const postgresService = new PostgresService();
