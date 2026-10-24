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
import { INITIAL_CLIENT_PROFILES, INITIAL_CATEGORY_HIERARCHY, buildDefaultCategories } from '../data/categoriesAndProfiles';
import { INITIAL_USERS, INITIAL_COMPANY_DETAILS, INITIAL_AUDIT_LOGS } from '../data/userAndAuditData';
import { round2, round4, calcDiscountedLine, calcPctChange, decAdd, decSub, decMul, decDiv } from '../utils/decimalMath';
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
  categoryId?: string;
  subCategoryId?: string;
  barcode?: string;
  code?: string;
  reviewRequired?: boolean | string;
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
  priceType?: string;
  costStage?: string;
  itemType?: string;
  itemId?: string;
  projectPlanId?: string;
  planId?: string;
  actorId?: string;
  actionType?: string;
  tariffId?: string;
  calculationMethod?: string;
  applicableBase?: string;
  currency?: string;
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
    if (opts.categoryId && opts.categoryId !== 'ALL') {
      filtered = filtered.filter(
        (r) => r.categoryId === opts.categoryId || r.category_id === opts.categoryId
      );
    }
    if (opts.subCategoryId && opts.subCategoryId !== 'ALL') {
      filtered = filtered.filter(
        (r) => r.subCategoryId === opts.subCategoryId || r.subcategory_id === opts.subCategoryId
      );
    }
    if (opts.category && opts.category !== 'ALL') {
      const catLower = opts.category.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          String(r.category || r.serviceCategory || r.productCategory || '').toLowerCase() === catLower ||
          r.categoryId === opts.category ||
          r.category_id === opts.category
      );
    }
    if (opts.subCategory && opts.subCategory !== 'ALL') {
      const subLower = opts.subCategory.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          String(r.subCategory || r.serviceSubCategory || r.productSubCategory || '').toLowerCase() === subLower ||
          r.subCategoryId === opts.subCategory ||
          r.subcategory_id === opts.subCategory
      );
    }
    if (opts.barcode && opts.barcode !== 'ALL') {
      const bLower = opts.barcode.toLowerCase();
      filtered = filtered.filter((r) => String(r.barcode || '').toLowerCase().includes(bLower));
    }
    if (opts.code && opts.code !== 'ALL') {
      const cLower = opts.code.toLowerCase();
      filtered = filtered.filter((r) => String(r.code || '').toLowerCase().includes(cLower));
    }
    if (opts.reviewRequired !== undefined) {
      const reqBool = opts.reviewRequired === true || opts.reviewRequired === 'true' || opts.reviewRequired === '1';
      filtered = filtered.filter((r) => Boolean(r.classificationReviewRequired || r.classification_review_required) === reqBool);
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
      filtered = filtered.filter((r) => r.entityId === opts.entityId || r.revenueItemId === opts.entityId || r.itemId === opts.entityId || r.materialId === opts.entityId);
    }
    if (opts.priceType && opts.priceType !== 'ALL') {
      const ptLower = opts.priceType.toLowerCase();
      filtered = filtered.filter((r) => String(r.priceType || '').toLowerCase() === ptLower);
    }
    if (opts.costStage && opts.costStage !== 'ALL') {
      const csLower = opts.costStage.toLowerCase();
      filtered = filtered.filter((r) => String(r.costStage || '').toLowerCase() === csLower);
    }
    if (opts.itemType && opts.itemType !== 'ALL') {
      const itLower = opts.itemType.toLowerCase();
      filtered = filtered.filter((r) => String(r.itemType || r.entityType || '').toLowerCase() === itLower);
    }
    if (opts.itemId && opts.itemId !== 'ALL') {
      filtered = filtered.filter((r) => r.itemId === opts.itemId || r.materialId === opts.itemId || r.outsourcedServiceId === opts.itemId || r.subcontractorId === opts.itemId);
    }
    if (opts.currency && opts.currency !== 'ALL') {
      const cUpper = opts.currency.toUpperCase();
      filtered = filtered.filter((r) => String(r.currency || '').toUpperCase() === cUpper);
    }
    if ((opts.projectPlanId || opts.planId) && (opts.projectPlanId !== 'ALL' && opts.planId !== 'ALL')) {
      const targetPlan = opts.projectPlanId || opts.planId;
      filtered = filtered.filter((r) => r.projectPlanId === targetPlan || r.planId === targetPlan);
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

  public async query(sql: string, params?: any[]): Promise<{ rows: any[] }> {
    const db = await this.getDb();
    return db.query(sql, params);
  }

  public async exec(sql: string): Promise<void> {
    const db = await this.getDb();
    return db.exec(sql);
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
        currency TEXT DEFAULT 'LKR',
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

      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action_type TEXT;
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type TEXT;
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id TEXT;
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS project_id TEXT;
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS plan_id TEXT;
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_id TEXT;
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS correlation_id TEXT;
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS change_reason TEXT;
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS before_state JSONB DEFAULT NULL;
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS after_state JSONB DEFAULT NULL;
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS diff JSONB DEFAULT NULL;
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;

      CREATE TABLE IF NOT EXISTS tariffs (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        calculation_method TEXT NOT NULL DEFAULT 'percentage',
        rate_or_percentage NUMERIC(18, 4) NOT NULL DEFAULT 0,
        fixed_charge NUMERIC(18, 4) DEFAULT 0,
        unit TEXT NOT NULL DEFAULT 'unit',
        applicable_base TEXT NOT NULL DEFAULT 'material_cost',
        currency TEXT NOT NULL DEFAULT 'USD',
        effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
        effective_to DATE,
        status TEXT NOT NULL DEFAULT 'Active',
        source_reference TEXT DEFAULT '',
        description TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        created_by TEXT NOT NULL DEFAULT 'System User',
        updated_by TEXT NOT NULL DEFAULT 'System User',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tariff_versions (
        id TEXT PRIMARY KEY,
        tariff_id TEXT NOT NULL REFERENCES tariffs(id) ON DELETE CASCADE,
        tariff_code TEXT NOT NULL,
        version_number INT NOT NULL DEFAULT 1,
        rate_or_percentage NUMERIC(18, 4) NOT NULL DEFAULT 0,
        fixed_charge NUMERIC(18, 4) DEFAULT 0,
        calculation_method TEXT NOT NULL DEFAULT 'percentage',
        applicable_base TEXT NOT NULL DEFAULT 'material_cost',
        unit TEXT NOT NULL DEFAULT 'unit',
        currency TEXT NOT NULL DEFAULT 'USD',
        effective_from DATE NOT NULL,
        effective_to DATE,
        status TEXT NOT NULL DEFAULT 'Active',
        source_reference TEXT DEFAULT '',
        change_reason TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        created_by TEXT NOT NULL DEFAULT 'System User',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_tariff_version UNIQUE (tariff_id, version_number)
      );

      ALTER TABLE tariffs ADD COLUMN IF NOT EXISTS scope_type TEXT DEFAULT 'general';
      ALTER TABLE tariffs ADD COLUMN IF NOT EXISTS scope_target_id TEXT DEFAULT '';
      ALTER TABLE tariffs ADD COLUMN IF NOT EXISTS scope_target_name TEXT DEFAULT '';
      ALTER TABLE tariff_versions ADD COLUMN IF NOT EXISTS scope_type TEXT DEFAULT 'general';
      ALTER TABLE tariff_versions ADD COLUMN IF NOT EXISTS scope_target_id TEXT DEFAULT '';
      ALTER TABLE tariff_versions ADD COLUMN IF NOT EXISTS scope_target_name TEXT DEFAULT '';

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

      CREATE TABLE IF NOT EXISTS plan_tariffs (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        tariff_id TEXT NOT NULL REFERENCES tariffs(id) ON DELETE RESTRICT,
        tariff_version_id TEXT NOT NULL REFERENCES tariff_versions(id) ON DELETE RESTRICT,
        tariff_code TEXT NOT NULL,
        tariff_name TEXT NOT NULL,
        tariff_category TEXT NOT NULL,
        calculation_method TEXT NOT NULL,
        applicable_base TEXT NOT NULL,
        rate_or_percentage NUMERIC(18, 4) NOT NULL,
        fixed_charge NUMERIC(18, 4) DEFAULT 0,
        unit TEXT DEFAULT 'unit',
        currency TEXT NOT NULL DEFAULT 'USD',
        effective_from DATE NOT NULL,
        effective_to DATE,
        base_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
        calculated_tariff_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
        applied_date DATE NOT NULL DEFAULT CURRENT_DATE,
        applied_by TEXT NOT NULL DEFAULT 'System User',
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS enterprise_resources (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        sub_category TEXT,
        more_sub_category TEXT,
        unit TEXT NOT NULL DEFAULT 'hr',
        base_rate NUMERIC(18, 4) NOT NULL DEFAULT 0,
        operational_charge NUMERIC(18, 4) DEFAULT 0,
        charge_type TEXT DEFAULT 'hourly',
        currency TEXT NOT NULL DEFAULT 'LKR',
        supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
        supplier_name TEXT,
        competitor_company TEXT,
        competitor_rate NUMERIC(18, 4) DEFAULT 0,
        industry_benchmark_rate NUMERIC(18, 4) DEFAULT 0,
        lead_time_days INT DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'Available',
        skill_or_sla TEXT,
        alternatives JSONB DEFAULT '[]',
        specifications JSONB DEFAULT '{}',
        connected_allocations JSONB DEFAULT '[]',
        notes TEXT DEFAULT '',
        effective_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.seedEnterpriseResourcesIfEmpty();
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
    }
    // Backfill normalized project_plans from existing projects if not yet present
    await this.backfillProjectPlans();
    // Ensure all overhead and revenue tables & schemas exist
    await this.ensureOverheadAndRevenueTables();
    // Ensure procurement price history tables & schema exist (Task 5)
    await this.ensureProcurementPriceTables();
    // Ensure material catalogue and category restructure exist (Task 6)
    await this.ensureMaterialCatalogueSchema();
    // Ensure system-wide barcode registry exists (Task 7)
    await this.ensureBarcodeRegistrySchema();
    // Ensure client and project database relationships exist (Task 10)
    await this.ensureClientProjectRelationships();
    // Ensure material vendor quotes, price change matrix & archive tables exist
    await this.ensureMaterialVendorQuotesSchema();
    // Ensure product competitor quotes, price matrix & project deliverables schema exist
    await this.ensureProductCompetitorSchema();
    // Ensure enterprise resources portal schema exists (Labours, Machineries, Equipments, Tools)
    await this.ensureEnterpriseResourcesSchema();
    // Ensure project plan cost controls schema exists
    await this.ensureProjectPlanCostControlsSchema();
  }

  public async ensureEnterpriseResourcesSchema(): Promise<void> {
    const db = this.db!;
    try {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS enterprise_resources (
          id TEXT PRIMARY KEY,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          category TEXT NOT NULL,
          sub_category TEXT,
          more_sub_category TEXT,
          unit TEXT NOT NULL DEFAULT 'hr',
          base_rate NUMERIC(18, 4) NOT NULL DEFAULT 0,
          operational_charge NUMERIC(18, 4) DEFAULT 0,
          charge_type TEXT DEFAULT 'hourly',
          currency TEXT NOT NULL DEFAULT 'LKR',
          supplier_id TEXT,
          supplier_name TEXT,
          competitor_company TEXT,
          competitor_rate NUMERIC(18, 4) DEFAULT 0,
          industry_benchmark_rate NUMERIC(18, 4) DEFAULT 0,
          lead_time_days INT DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'Available',
          skill_or_sla TEXT,
          alternatives JSONB DEFAULT '[]',
          specifications JSONB DEFAULT '{}',
          connected_allocations JSONB DEFAULT '[]',
          notes TEXT DEFAULT '',
          effective_date DATE DEFAULT CURRENT_DATE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        DO $$
        BEGIN
          ALTER TABLE enterprise_resources ALTER COLUMN currency SET DEFAULT 'LKR';
          UPDATE enterprise_resources SET currency = 'LKR' WHERE currency IS NULL OR currency = '' OR currency = 'USD';
        END $$;
      `);

      await this.seedEnterpriseResourcesIfEmpty();
    } catch (e: any) {
      console.warn('[PostgreSQL] ensureEnterpriseResourcesSchema warning:', e?.message);
    }
  }

  public async ensureOverheadAndRevenueTables(): Promise<void> {
    const db = this.db!;
    try {
      await db.exec(`
        -- Ensure project_plans has full financial metric columns
        ALTER TABLE project_plans ADD COLUMN IF NOT EXISTS direct_cost NUMERIC(18, 2) DEFAULT 0;
        ALTER TABLE project_plans ADD COLUMN IF NOT EXISTS allocated_overhead NUMERIC(18, 2) DEFAULT 0;
        ALTER TABLE project_plans ADD COLUMN IF NOT EXISTS total_planned_cost NUMERIC(18, 2) DEFAULT 0;
        ALTER TABLE project_plans ADD COLUMN IF NOT EXISTS gross_profit NUMERIC(18, 2) DEFAULT 0;
        ALTER TABLE project_plans ADD COLUMN IF NOT EXISTS gross_margin_pct NUMERIC(8, 2) DEFAULT 0;
        ALTER TABLE project_plans ADD COLUMN IF NOT EXISTS planned_profit NUMERIC(18, 2) DEFAULT 0;
        ALTER TABLE project_plans ADD COLUMN IF NOT EXISTS profit_margin_pct NUMERIC(8, 2) DEFAULT 0;
        ALTER TABLE project_plans ADD COLUMN IF NOT EXISTS markup_pct NUMERIC(8, 2) DEFAULT 0;
        ALTER TABLE project_plans ADD COLUMN IF NOT EXISTS direct_cost_markup_pct NUMERIC(8, 2) DEFAULT 0;

        -- Ensure project_plan_cost_summaries has markup, variance, and actuals columns
        ALTER TABLE project_plan_cost_summaries ADD COLUMN IF NOT EXISTS markup_pct NUMERIC(8, 2) DEFAULT 0;
        ALTER TABLE project_plan_cost_summaries ADD COLUMN IF NOT EXISTS direct_cost_markup_pct NUMERIC(8, 2) DEFAULT 0;
        ALTER TABLE project_plan_cost_summaries ADD COLUMN IF NOT EXISTS total_budget NUMERIC(18, 2) DEFAULT 0;
        ALTER TABLE project_plan_cost_summaries ADD COLUMN IF NOT EXISTS budget_variance NUMERIC(18, 2) DEFAULT 0;
        ALTER TABLE project_plan_cost_summaries ADD COLUMN IF NOT EXISTS budget_variance_pct NUMERIC(8, 2) DEFAULT 0;
        ALTER TABLE project_plan_cost_summaries ADD COLUMN IF NOT EXISTS actual_cost NUMERIC(18, 2) DEFAULT 0;
        ALTER TABLE project_plan_cost_summaries ADD COLUMN IF NOT EXISTS remaining_budget NUMERIC(18, 2) DEFAULT 0;

        -- Ensure project_plan_overhead_allocations has backwards-compatibility columns
        ALTER TABLE project_plan_overhead_allocations ADD COLUMN IF NOT EXISTS overhead_item_id TEXT;
        ALTER TABLE project_plan_overhead_allocations ADD COLUMN IF NOT EXISTS allocation_method TEXT DEFAULT 'fixed_amount';
        ALTER TABLE project_plan_overhead_allocations ADD COLUMN IF NOT EXISTS allocation_base TEXT DEFAULT 'total_direct_cost';
        ALTER TABLE project_plan_overhead_allocations ADD COLUMN IF NOT EXISTS allocation_rate NUMERIC(18, 4) DEFAULT 0;
        ALTER TABLE project_plan_overhead_allocations ADD COLUMN IF NOT EXISTS unit_quantity NUMERIC(18, 4) DEFAULT 1;
        ALTER TABLE project_plan_overhead_allocations ADD COLUMN IF NOT EXISTS effective_date DATE DEFAULT CURRENT_DATE;
        ALTER TABLE project_plan_overhead_allocations ADD COLUMN IF NOT EXISTS allocated_by TEXT DEFAULT 'System';

        -- Overhead Cost System
        CREATE TABLE IF NOT EXISTS overhead_categories (
          id TEXT PRIMARY KEY,
          code TEXT UNIQUE NOT NULL,
          name TEXT UNIQUE NOT NULL,
          description TEXT DEFAULT '',
          is_default BOOLEAN DEFAULT false,
          sort_order INT DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS overhead_items (
          id TEXT PRIMARY KEY,
          code TEXT UNIQUE NOT NULL,
          barcode TEXT,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          description TEXT DEFAULT '',
          cost_type TEXT NOT NULL DEFAULT 'Fixed',
          default_calculation_method TEXT NOT NULL DEFAULT 'fixed_amount',
          default_rate NUMERIC(18, 4) NOT NULL DEFAULT 0,
          default_cost_base TEXT NOT NULL DEFAULT 'total_direct_cost',
          currency TEXT DEFAULT 'LKR',
          unit_type TEXT DEFAULT 'month',
          effective_date DATE DEFAULT CURRENT_DATE,
          status TEXT NOT NULL DEFAULT 'Active',
          created_by TEXT NOT NULL DEFAULT 'System',
          updated_by TEXT NOT NULL DEFAULT 'System',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        ALTER TABLE overhead_items ADD COLUMN IF NOT EXISTS sub_category TEXT DEFAULT '';
        ALTER TABLE overhead_items ADD COLUMN IF NOT EXISTS category_id TEXT;
        ALTER TABLE overhead_items ADD COLUMN IF NOT EXISTS sub_category_id TEXT;
        ALTER TABLE overhead_items ADD COLUMN IF NOT EXISTS theme_id TEXT;
        ALTER TABLE overhead_items ADD COLUMN IF NOT EXISTS custom_gradient TEXT;
        ALTER TABLE overhead_items ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'LKR';

        CREATE TABLE IF NOT EXISTS plan_overhead_allocations (
          id TEXT PRIMARY KEY,
          plan_id TEXT NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          overhead_item_id TEXT REFERENCES overhead_items(id) ON DELETE RESTRICT,
          allocation_method TEXT NOT NULL DEFAULT 'fixed_amount',
          allocation_base TEXT NOT NULL DEFAULT 'total_direct_cost',
          base_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
          allocation_rate NUMERIC(18, 4) NOT NULL DEFAULT 0,
          unit_quantity NUMERIC(18, 4) NOT NULL DEFAULT 1,
          allocated_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
          effective_date DATE DEFAULT CURRENT_DATE,
          allocated_by TEXT DEFAULT 'System',
          notes TEXT DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS overhead_audit_logs (
          id TEXT PRIMARY KEY,
          overhead_item_id TEXT,
          overhead_item_code TEXT,
          overhead_item_name TEXT,
          plan_id TEXT,
          plan_number TEXT,
          allocation_id TEXT,
          action TEXT NOT NULL,
          actor_id TEXT,
          actor_name TEXT,
          actor_role TEXT,
          previous_state JSONB,
          new_state JSONB,
          change_description TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- TASK 3: Revenue Catalogue System
        CREATE TABLE IF NOT EXISTS revenue_categories (
          id TEXT PRIMARY KEY,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          type TEXT DEFAULT 'both',
          description TEXT DEFAULT '',
          sort_order INT DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS revenue_subcategories (
          id TEXT PRIMARY KEY,
          category_id TEXT REFERENCES revenue_categories(id) ON DELETE CASCADE,
          category_name TEXT,
          code TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          sort_order INT DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS revenue_items (
          id TEXT PRIMARY KEY,
          code TEXT UNIQUE NOT NULL,
          barcode TEXT,
          name TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'product',
          category TEXT NOT NULL,
          sub_category TEXT DEFAULT '',
          description TEXT DEFAULT '',
          unit TEXT NOT NULL DEFAULT 'unit',
          default_rate NUMERIC(18, 4) NOT NULL DEFAULT 0,
          cost_price NUMERIC(18, 4) DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'USD',
          tax_treatment TEXT DEFAULT 'Standard (0%)',
          tax_rate_pct NUMERIC(8, 2) DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'Active',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        ALTER TABLE revenue_items ADD COLUMN IF NOT EXISTS theme_id TEXT;
        ALTER TABLE revenue_items ADD COLUMN IF NOT EXISTS custom_gradient TEXT;
        ALTER TABLE revenue_items ADD COLUMN IF NOT EXISTS category_id TEXT;
        ALTER TABLE revenue_items ADD COLUMN IF NOT EXISTS sub_category_id TEXT;

        ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS revenue_item_id TEXT REFERENCES revenue_items(id) ON DELETE SET NULL;
        ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS rate NUMERIC(18, 4) DEFAULT 0;
        ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS tax_treatment TEXT DEFAULT 'Standard (0%)';
        ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS tax_rate_pct NUMERIC(8, 2) DEFAULT 0;
        ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(18, 2) DEFAULT 0;
        ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
        ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS snapshot_data JSONB DEFAULT '{}'::jsonb;
        ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS commercial_context TEXT DEFAULT '';

        CREATE OR REPLACE VIEW plan_boq_items AS SELECT * FROM project_plan_boq_items;

        CREATE TABLE IF NOT EXISTS revenue_rate_history (
          id TEXT PRIMARY KEY,
          revenue_item_id TEXT NOT NULL REFERENCES revenue_items(id) ON DELETE CASCADE,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          project_plan_id TEXT NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
          plan_boq_item_id TEXT NOT NULL,
          previous_unit TEXT,
          new_unit TEXT NOT NULL,
          previous_quantity NUMERIC(18, 4),
          new_quantity NUMERIC(18, 4) NOT NULL,
          previous_rate NUMERIC(18, 4),
          new_rate NUMERIC(18, 4) NOT NULL,
          change_type TEXT NOT NULL DEFAULT 'initial_addition',
          fields_changed JSONB DEFAULT '[]'::jsonb,
          effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
          recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          changed_by TEXT NOT NULL DEFAULT 'System User',
          change_reason TEXT DEFAULT '',
          commercial_context TEXT DEFAULT '',
          idempotency_key TEXT UNIQUE
        );
      `);

      // Seed default revenue categories if empty
      const catCountRes = await db.query('SELECT COUNT(*) as cnt FROM revenue_categories');
      if (Number(catCountRes.rows[0]?.cnt || 0) === 0) {
        await db.exec(`
          INSERT INTO revenue_categories (id, code, name, type, description, sort_order) VALUES
            ('revcat-01', 'CAT-ALUM', 'Architectural & Structural Aluminium', 'product', 'Manufactured aluminium architectural assemblies, doors, windows, curtain walls, and structural frames', 1),
            ('revcat-02', 'CAT-AUTO', 'Industrial Automation & Machinery', 'product', 'Custom robotic cells, CNC automated lines, and servo-press assemblies', 2),
            ('revcat-03', 'CAT-MECH', 'Mechanical Fabrication & Systems', 'product', 'Heavy structural frames, pressure vessels, and pre-engineered steel fabrications', 3),
            ('revcat-04', 'CAT-ENGR', 'Engineering & Design Consultancy', 'service', 'Structural PE engineering calculations, FEA analysis, and CAD detailing', 4),
            ('revcat-05', 'CAT-INST', 'Site Installation & Commissioning', 'service', 'Turnkey on-site mechanical erection, electrical wiring, and performance testing', 5),
            ('revcat-06', 'CAT-MAINT', 'Facility Integration & Maintenance', 'service', 'Scheduled preventive servicing, calibration, and 24/7 SLA operational response', 6)
          ON CONFLICT (code) DO NOTHING;
        `);
      }

      // Seed default revenue subcategories if empty
      const subcatCountRes = await db.query('SELECT COUNT(*) as cnt FROM revenue_subcategories');
      if (Number(subcatCountRes.rows[0]?.cnt || 0) === 0) {
        await db.exec(`
          INSERT INTO revenue_subcategories (id, category_id, category_name, code, name, description, sort_order) VALUES
            ('revsub-01', 'revcat-01', 'Architectural & Structural Aluminium', 'SUB-FAC', 'Curtain Wall Profiles & Facades', 'Thermally broken curtain walls', 1),
            ('revsub-02', 'revcat-01', 'Architectural & Structural Aluminium', 'SUB-EXT', 'Heavy Structural Extrusions', 'Custom alloy structural profiles', 2),
            ('revsub-03', 'revcat-02', 'Industrial Automation & Machinery', 'SUB-ROB', 'Custom Robotic End-Effectors', 'Grippers and servo actuators', 1),
            ('revsub-04', 'revcat-02', 'Industrial Automation & Machinery', 'SUB-JIG', 'Inspection Jigs & Tooling', 'Precision nestings and fixtures', 2),
            ('revsub-05', 'revcat-04', 'Engineering & Design Consultancy', 'SUB-FEA', 'FEA Analysis & Structural PE', 'Finite element structural simulation', 1),
            ('revsub-06', 'revcat-05', 'Site Installation & Commissioning', 'SUB-CAL', 'Turnkey Laser Calibration', 'On-site installation and alignment', 1)
          ON CONFLICT (id) DO NOTHING;
        `);
      }

      // Seed default overhead categories if empty
      const ovhCatCountRes = await db.query('SELECT COUNT(*) as cnt FROM overhead_categories');
      if (Number(ovhCatCountRes.rows[0]?.cnt || 0) === 0) {
        await db.exec(`
          INSERT INTO overhead_categories (id, code, name, description, is_default, sort_order) VALUES
            ('ovh-cat-01', 'CAT-IND', 'Indirect Materials & Factory Consumables', 'Coolants, lubricants, tooling inserts, and PPE safety gear', true, 1),
            ('ovh-cat-02', 'CAT-UTIL', 'Utilities & Plant Facilities', 'Electricity, industrial gas, facility lease, and environmental HVAC', false, 2),
            ('ovh-cat-03', 'CAT-ADM', 'Administrative & Quality Assurance', 'ISO 9001/AS9100 quality certifications, ERP licenses, insurance', false, 3)
          ON CONFLICT (name) DO NOTHING;
        `);
      }

      // Seed standard overhead and revenue nodes in categories table
      const overheadInCats = await db.query("SELECT COUNT(*) as cnt FROM categories WHERE group_name = 'overhead'");
      if (Number(overheadInCats.rows[0]?.cnt || 0) === 0) {
        await db.exec(`
          INSERT INTO categories (id, name, type, group_name, parent_id, parent_name, brief, theme_id, meta_badge, action_text, created_at) VALUES
            ('oh-cat-01', 'Indirect Materials & Factory Consumables', 'category', 'overhead', NULL, NULL, 'Coolants, lubricants, tooling inserts, and PPE safety gear', 'amber-forge', 'OVERHEAD ROOT', 'EXPLORE SUB-CATEGORIES', NOW()),
            ('oh-sub-01-01', 'Cutting Fluids & Chemical Agents', 'sub_category', 'overhead', 'oh-cat-01', 'Indirect Materials & Factory Consumables', 'High-pressure CNC coolant and solvent cleaners', 'sunset-amber', 'SUB-CATEGORY', 'VIEW ITEMS', NOW()),
            ('oh-sub-01-02', 'PPE & Operational Safety', 'sub_category', 'overhead', 'oh-cat-01', 'Indirect Materials & Factory Consumables', 'Respirators, safety glasses, and cut-resistant gloves', 'amber-forge', 'SUB-CATEGORY', 'VIEW ITEMS', NOW()),
            ('oh-cat-02', 'Utilities & Plant Facilities', 'category', 'overhead', NULL, NULL, 'Electricity, industrial gas, facility lease, and environmental HVAC', 'pacific-sky', 'OVERHEAD ROOT', 'EXPLORE SUB-CATEGORIES', NOW()),
            ('oh-sub-02-01', 'Industrial Three-Phase Power', 'sub_category', 'overhead', 'oh-cat-02', 'Utilities & Plant Facilities', 'Machine peak electrical draw and substation fees', 'pacific-sky', 'SUB-CATEGORY', 'VIEW ITEMS', NOW()),
            ('oh-sub-02-02', 'Facility Leasing & Depreciation', 'sub_category', 'overhead', 'oh-cat-02', 'Utilities & Plant Facilities', 'Square footage lease and plant maintenance', 'teal-deep', 'SUB-CATEGORY', 'VIEW ITEMS', NOW()),
            ('oh-cat-03', 'Administrative & Quality Assurance', 'category', 'overhead', NULL, NULL, 'ISO 9001/AS9100 quality certifications, ERP licenses, insurance', 'airbus-cobalt', 'OVERHEAD ROOT', 'EXPLORE SUB-CATEGORIES', NOW()),
            ('oh-sub-03-01', 'Quality Audits & Compliance Testing', 'sub_category', 'overhead', 'oh-cat-03', 'Administrative & Quality Assurance', 'CMM calibration, ultrasonic NDT tests, and standard audits', 'airbus-cobalt', 'SUB-CATEGORY', 'VIEW ITEMS', NOW()),
            ('oh-sub-03-02', 'ERP Software & Cloud Infrastructure', 'sub_category', 'overhead', 'oh-cat-03', 'Administrative & Quality Assurance', 'Compute licensing and enterprise database servers', 'indigo-night', 'SUB-CATEGORY', 'VIEW ITEMS', NOW()),
            ('rev-serv-cat-01', 'Engineering & Design Consultancy', 'category', 'service', NULL, NULL, 'Structural PE engineering calculations, FEA analysis, and CAD detailing', 'napa-purple', 'SERVICE ROOT', 'EXPLORE SUB-CATEGORIES', NOW()),
            ('rev-serv-sub-01-01', 'FEA Stress Analysis & Simulation', 'sub_category', 'service', 'rev-serv-cat-01', 'Engineering & Design Consultancy', 'Non-linear finite element structural simulation', 'napa-purple', 'SUB-CATEGORY', 'VIEW ITEMS', NOW()),
            ('rev-serv-cat-02', 'Site Installation & Commissioning', 'category', 'service', NULL, NULL, 'Turnkey on-site mechanical erection, electrical wiring, and performance testing', 'crimson-horizon', 'SERVICE ROOT', 'EXPLORE SUB-CATEGORIES', NOW()),
            ('rev-serv-sub-02-01', 'On-Site Machine Calibration & Commissioning', 'sub_category', 'service', 'rev-serv-cat-02', 'Site Installation & Commissioning', 'Laser alignment, hydraulic pressure testing, and pilot handover', 'crimson-horizon', 'SUB-CATEGORY', 'VIEW ITEMS', NOW())
          ON CONFLICT (id) DO NOTHING;
        `);
      }

      // Seed initial overhead items if empty or only 1 item
      const ovhItemCountRes = await db.query('SELECT COUNT(*) as cnt FROM overhead_items');
      if (Number(ovhItemCountRes.rows[0]?.cnt || 0) <= 1) {
        await db.exec(`
          INSERT INTO overhead_items (
            id, code, barcode, name, category, sub_category, description, cost_type,
            default_calculation_method, default_rate, default_cost_base, unit_type,
            effective_date, status, created_by, updated_by, theme_id
          ) VALUES
            ('ovh-seed-01', 'OVH-IND-001', 'BC-OVH-IND-001', 'High-Pressure CNC Coolants & Chemical Solvents', 'Indirect Materials & Factory Consumables', 'Cutting Fluids & Chemical Agents', 'Semi-synthetic aerospace cutting coolant and ultrasonic bath detergents', 'Variable', 'fixed_amount', 4500.00, 'total_direct_cost', 'month', CURRENT_DATE, 'Active', 'System Finance', 'System Finance', 'amber-forge'),
            ('ovh-seed-02', 'OVH-IND-002', 'BC-OVH-IND-002', 'Plant Safety Equipment & PPE Re-issuance', 'Indirect Materials & Factory Consumables', 'PPE & Operational Safety', 'Respirators, safety goggles, welding shields, and cut-resistant Kevlar gloves', 'Variable', 'fixed_amount', 2200.00, 'total_direct_cost', 'month', CURRENT_DATE, 'Active', 'System Finance', 'System Finance', 'sunset-amber'),
            ('ovh-seed-03', 'OVH-UTL-001', 'BC-OVH-UTL-001', 'Industrial Three-Phase Electricity & Machine Draw', 'Utilities & Plant Facilities', 'Industrial Three-Phase Power', 'Substation electrical utility consumption for high-speed machining centers', 'Semi-Variable', 'percentage_of_cost_base', 4.50, 'total_direct_cost', 'month', CURRENT_DATE, 'Active', 'System Finance', 'System Finance', 'pacific-sky'),
            ('ovh-seed-04', 'OVH-ADM-001', 'BC-OVH-ADM-001', 'ISO 9001 / AS9100 Annual Quality Audits & NDT', 'Administrative & Quality Assurance', 'Quality Audits & Compliance Testing', 'Accredited third-party quality systems audit, ISO surveillance, and CMM laser calibration', 'Fixed', 'fixed_amount', 12500.00, 'total_direct_cost', 'year', CURRENT_DATE, 'Active', 'System Finance', 'System Finance', 'airbus-cobalt')
          ON CONFLICT (code) DO NOTHING;
        `);
      }

      // Seed/backfill revenue_items from produce_items where type IN ('product', 'service')
      // STRICT REQUIREMENT: Only products sold by company and services provided by company.
      // NEVER include outsourced third-party services.
      const revItemCountRes = await db.query('SELECT COUNT(*) as cnt FROM revenue_items');
      if (Number(revItemCountRes.rows[0]?.cnt || 0) === 0) {
        const prodRes = await db.query("SELECT * FROM produce_items WHERE type IN ('product', 'service')");
        for (const p of prodRes.rows) {
          await db.query(
            `INSERT INTO revenue_items (
              id, code, barcode, name, type, category, sub_category, description, unit,
              default_rate, cost_price, currency, tax_treatment, tax_rate_pct, status, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Standard (0%)', 0, 'Active', NOW(), NOW())
            ON CONFLICT (code) DO NOTHING`,
            [
              `rev-${p.id}`,
              p.code,
              p.barcode || `BC-${p.code}`,
              p.name,
              p.type || 'product',
              p.category || 'Architectural & Structural Aluminium',
              p.sub_category || '',
              `Commercial product/service: ${p.name}`,
              p.unit || 'unit',
              round4(p.retail_price || p.cost_price || 0),
              round4(p.cost_price || 0),
              p.currency || 'USD'
            ]
          ).catch(() => {});
        }
      }

      // Ensure dedicated customer revenue services exist in revenue_items
      const revServiceCount = await db.query("SELECT COUNT(*) as cnt FROM revenue_items WHERE type = 'service'");
      if (Number(revServiceCount.rows[0]?.cnt || 0) === 0) {
        await db.exec(`
          INSERT INTO revenue_items (
            id, code, barcode, name, type, category, sub_category, description, unit,
            default_rate, cost_price, currency, tax_treatment, tax_rate_pct, status, created_at, updated_at
          ) VALUES
            ('rev-srv-01', 'REV-SRV-001', 'BC-REV-SRV-001', 'FEA Structural Stress Analysis & Design Review', 'service', 'Engineering & Design Consultancy', 'FEA Stress Analysis & Simulation', 'Comprehensive non-linear finite element structural simulation and certification report', 'hours', 185.00, 95.00, 'USD', 'Standard (0%)', 0, 'Active', NOW(), NOW()),
            ('rev-srv-02', 'REV-SRV-002', 'BC-REV-SRV-002', 'On-Site CMM Laser Calibration & Metrology', 'service', 'Site Installation & Commissioning', 'On-Site Machine Calibration & Commissioning', 'High-precision coordinate measuring laser tracking and sub-micron spatial calibration', 'day', 2400.00, 1200.00, 'USD', 'Standard (0%)', 0, 'Active', NOW(), NOW()),
            ('rev-srv-03', 'REV-SRV-003', 'BC-REV-SRV-003', 'Turnkey Robotic Cell Commissioning & FAT', 'service', 'Site Installation & Commissioning', 'On-Site Machine Calibration & Commissioning', 'Field acceptance testing, safety interlock commissioning, and robotic trajectory optimization', 'project', 18500.00, 9800.00, 'USD', 'Standard (0%)', 0, 'Active', NOW(), NOW()),
            ('rev-srv-04', 'REV-SRV-004', 'BC-REV-SRV-004', 'AS9100 / ISO Quality Audit & Compliance Support', 'service', 'Engineering & Design Consultancy', 'Quality & Compliance Verification', 'Accredited third-party aerospace & defense quality surveillance and documentation package', 'hours', 220.00, 110.00, 'USD', 'Standard (0%)', 0, 'Active', NOW(), NOW())
          ON CONFLICT (code) DO NOTHING;
        `);
      }
    } catch (e) {
      console.warn('[PostgreSQL] ensureOverheadAndRevenueTables warning:', (e as Error).message);
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
      DELETE FROM revenue_rate_history;
      DELETE FROM project_plan_cost_summaries;
      DELETE FROM plan_overhead_allocations;
      DELETE FROM project_plan_overhead_allocations;
      DELETE FROM project_plan_resources;
      DELETE FROM project_plan_boq_items;
      DELETE FROM project_plan_sections;
      DELETE FROM project_plan_revisions;
      DELETE FROM project_plans;
      DELETE FROM overhead_audit_logs;
      DELETE FROM overhead_items;
      DELETE FROM overhead_categories;
      DELETE FROM revenue_items;
      DELETE FROM revenue_subcategories;
      DELETE FROM revenue_categories;
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

  public async getClientById(id: string): Promise<any | null> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM clients WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];

    // Fetch contacts
    const contactsRes = await db.query(
      'SELECT * FROM client_contacts WHERE client_id = $1 ORDER BY is_primary DESC, created_at ASC',
      [id]
    );
    const contacts = contactsRes.rows.map((c: any) => ({
      id: c.id,
      clientId: c.client_id,
      name: c.name,
      roleOrTitle: c.role_or_title,
      email: c.email,
      phone: c.phone || '',
      isPrimary: Boolean(c.is_primary),
      isBillingContact: Boolean(c.is_billing_contact),
      notes: c.notes || '',
      createdAt: c.created_at,
      updatedAt: c.updated_at
    }));

    // Fetch associated projects
    const prjRes = await db.query(
      `SELECT DISTINCT p.id, p.code, p.name, p.status, p.quoted_price, p.currency, p.target_margin_pct,
              p.start_date, p.delivery_deadline, p.active_plan_id, p.created_at,
              COALESCE(pc.relationship_type, 'Primary Client') as relationship_type,
              COALESCE(pc.share_pct, 100) as share_pct,
              COALESCE(pc.is_primary, (p.client_id = $1)) as is_primary
       FROM projects p
       LEFT JOIN project_clients pc ON pc.project_id = p.id AND pc.client_id = $1
       WHERE p.client_id = $1 OR pc.client_id = $1
       ORDER BY p.created_at DESC`,
      [id]
    );

    const associatedProjects = prjRes.rows.map((p: any) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      status: p.status,
      quotedPrice: round2(p.quoted_price || 0),
      currency: p.currency || 'USD',
      targetMarginPct: round2(p.target_margin_pct || 25),
      startDate: p.start_date || '',
      deliveryDeadline: p.delivery_deadline || '',
      activePlanId: p.active_plan_id,
      relationshipType: p.relationship_type || 'Primary Client',
      sharePct: Number(p.share_pct || 100),
      isPrimary: Boolean(p.is_primary),
      createdAt: p.created_at
    }));

    const activeCount = associatedProjects.filter(p => !['Completed', 'Archived', 'Cancelled'].includes(p.status)).length;
    const totalVal = associatedProjects.reduce((sum, p) => decAdd(sum, p.quotedPrice), 0);

    return {
      id: r.id,
      clientCode: r.client_code || `CLI-${r.id.slice(0, 6).toUpperCase()}`,
      name: r.name,
      legalName: r.legal_name || r.name,
      taxId: r.tax_id || '',
      tagline: r.tagline || '',
      industry: r.industry || '',
      location: r.location || '',
      address: r.address || '',
      city: r.city || '',
      country: r.country || '',
      status: r.status || 'Active Partner',
      activeProjectsCount: activeCount,
      totalQuotedValue: round2(totalVal),
      contactPerson: r.contact_person || (contacts[0]?.name || ''),
      email: r.email || (contacts[0]?.email || ''),
      phone: r.phone || (contacts[0]?.phone || ''),
      billingEmail: r.billing_email || '',
      billingAddress: r.billing_address || '',
      paymentTerms: r.payment_terms || 'Net 30',
      creditLimit: round2(r.credit_limit || 0),
      currency: r.currency || 'USD',
      notes: r.notes || '',
      themeId: r.theme_id || 'pacific-sky',
      customGradient: r.custom_gradient || null,
      contacts,
      associatedProjects,
      createdAt: r.created_at
    };
  }

  public async getClientsPaginated(opts?: ListQueryOptions): Promise<PaginatedResult<any>> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM clients ORDER BY created_at DESC');

    // Get all contacts grouped by client_id
    let contactsByClient = new Map<string, any[]>();
    try {
      const contactsRes = await db.query('SELECT * FROM client_contacts ORDER BY is_primary DESC, created_at ASC');
      for (const c of contactsRes.rows) {
        const list = contactsByClient.get(c.client_id) || [];
        list.push({
          id: c.id,
          clientId: c.client_id,
          name: c.name,
          roleOrTitle: c.role_or_title,
          email: c.email,
          phone: c.phone || '',
          isPrimary: Boolean(c.is_primary),
          isBillingContact: Boolean(c.is_billing_contact),
          notes: c.notes || '',
          createdAt: c.created_at
        });
        contactsByClient.set(c.client_id, list);
      }
    } catch {
      // client_contacts table may be in creation
    }

    // Get all projects with client linkages
    let projectsByClient = new Map<string, any[]>();
    try {
      const prjRes = await db.query(`
        SELECT p.id, p.code, p.name, p.client_id, p.client_name, p.status, p.quoted_price, p.currency, p.target_margin_pct, p.start_date, p.delivery_deadline, p.active_plan_id,
               pc.client_id as junction_client_id, pc.relationship_type
        FROM projects p
        LEFT JOIN project_clients pc ON pc.project_id = p.id
      `);

      for (const p of prjRes.rows) {
        const targetClientIds = new Set<string>();
        if (p.client_id) targetClientIds.add(p.client_id);
        if (p.junction_client_id) targetClientIds.add(p.junction_client_id);

        for (const cId of targetClientIds) {
          const list = projectsByClient.get(cId) || [];
          if (!list.some(existing => existing.id === p.id)) {
            list.push({
              id: p.id,
              code: p.code,
              name: p.name,
              status: p.status,
              quotedPrice: round2(p.quoted_price || 0),
              currency: p.currency || 'USD',
              targetMarginPct: round2(p.target_margin_pct || 25),
              startDate: p.start_date || '',
              deliveryDeadline: p.delivery_deadline || '',
              relationshipType: p.relationship_type || 'Primary Client',
              activePlanId: p.active_plan_id
            });
            projectsByClient.set(cId, list);
          }
        }
      }
    } catch {
      // projects or project_clients table may be in creation
    }

    const rows = res.rows.map((r: any) => {
      const clientContacts = contactsByClient.get(r.id) || [];
      const clientProjects = projectsByClient.get(r.id) || [];
      const activeProjectsCount = clientProjects.filter(p => !['Completed', 'Archived', 'Cancelled'].includes(p.status)).length;
      const totalQuotedValue = clientProjects.reduce((sum, p) => decAdd(sum, p.quotedPrice), 0);

      return {
        id: r.id,
        clientCode: r.client_code || `CLI-${r.id.slice(0, 6).toUpperCase()}`,
        name: r.name,
        legalName: r.legal_name || r.name,
        taxId: r.tax_id || '',
        tagline: r.tagline || '',
        industry: r.industry || '',
        location: r.location || '',
        address: r.address || '',
        city: r.city || '',
        country: r.country || '',
        status: r.status || 'Active Partner',
        activeProjectsCount: activeProjectsCount || Number(r.active_projects_count || 0),
        totalQuotedValue: round2(totalQuotedValue || r.total_quoted_value || 0),
        contactPerson: r.contact_person || (clientContacts[0]?.name || ''),
        email: r.email || (clientContacts[0]?.email || ''),
        phone: r.phone || (clientContacts[0]?.phone || ''),
        billingEmail: r.billing_email || '',
        billingAddress: r.billing_address || '',
        paymentTerms: r.payment_terms || 'Net 30',
        creditLimit: round2(r.credit_limit || 0),
        currency: r.currency || 'USD',
        notes: r.notes || '',
        themeId: r.theme_id || 'pacific-sky',
        customGradient: r.custom_gradient || null,
        contacts: clientContacts,
        associatedProjects: clientProjects,
        createdAt: r.created_at
      };
    });

    return parseFilterPagination(rows, opts, ['name', 'clientCode', 'industry', 'location', 'contactPerson', 'email', 'status', 'tagline']);
  }

  public async createClient(data: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `cli-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const name = String(data.name || 'New Client').trim();
    if (!name) throw new Error('Client name is required');

    // Auto-generate clientCode if not given
    let clientCode = data.clientCode ? String(data.clientCode).trim().toUpperCase() : '';
    if (!clientCode) {
      const countRes = await db.query('SELECT COUNT(*) as cnt FROM clients');
      const nextNum = Number(countRes.rows[0]?.cnt || 0) + 1;
      clientCode = `CLI-${String(nextNum).padStart(4, '0')}`;
      const checkCode = await db.query('SELECT id FROM clients WHERE client_code = $1', [clientCode]);
      if (checkCode.rows.length > 0) {
        clientCode = `CLI-${Date.now().toString().slice(-4)}`;
      }
    }

    const createdAt = data.createdAt || new Date().toISOString();

    await db.query(
      `INSERT INTO clients (id, client_code, name, legal_name, tax_id, tagline, industry, location, address, city, country, status, active_projects_count, total_quoted_value, contact_person, email, phone, billing_email, billing_address, payment_terms, credit_limit, currency, notes, theme_id, custom_gradient, created_at, updated_at_ts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         client_code = COALESCE(EXCLUDED.client_code, clients.client_code),
         legal_name = EXCLUDED.legal_name,
         tax_id = EXCLUDED.tax_id,
         tagline = EXCLUDED.tagline,
         industry = EXCLUDED.industry,
         location = EXCLUDED.location,
         address = EXCLUDED.address,
         city = EXCLUDED.city,
         country = EXCLUDED.country,
         status = EXCLUDED.status,
         contact_person = EXCLUDED.contact_person,
         email = EXCLUDED.email,
         phone = EXCLUDED.phone,
         billing_email = EXCLUDED.billing_email,
         billing_address = EXCLUDED.billing_address,
         payment_terms = EXCLUDED.payment_terms,
         credit_limit = EXCLUDED.credit_limit,
         currency = EXCLUDED.currency,
         notes = EXCLUDED.notes,
         theme_id = EXCLUDED.theme_id,
         custom_gradient = EXCLUDED.custom_gradient,
         updated_at_ts = NOW()`,
      [
        id,
        clientCode,
        name,
        data.legalName || name,
        data.taxId || '',
        data.tagline || '',
        data.industry || 'Commercial Enterprise',
        data.location || 'Headquarters',
        data.address || '',
        data.city || '',
        data.country || '',
        data.status || 'Active Partner',
        0,
        0,
        data.contactPerson || '',
        data.email || '',
        data.phone || '',
        data.billingEmail || data.email || '',
        data.billingAddress || data.address || '',
        data.paymentTerms || 'Net 30',
        round2(data.creditLimit || 0),
        data.currency || 'USD',
        data.notes || '',
        data.themeId || 'pacific-sky',
        data.customGradient || null,
        createdAt
      ]
    );

    // Save contacts if supplied
    if (Array.isArray(data.contacts) && data.contacts.length > 0) {
      for (const ct of data.contacts) {
        if (!ct.name || !ct.email) continue;
        const ctId = ct.id || `ct-${id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await db.query(
          `INSERT INTO client_contacts (id, client_id, name, role_or_title, email, phone, is_primary, is_billing_contact, notes, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
           ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, role_or_title=EXCLUDED.role_or_title, email=EXCLUDED.email, phone=EXCLUDED.phone, is_primary=EXCLUDED.is_primary, is_billing_contact=EXCLUDED.is_billing_contact, notes=EXCLUDED.notes, updated_at=NOW()`,
          [
            ctId,
            id,
            ct.name.trim(),
            ct.roleOrTitle || 'Primary Contact',
            ct.email.trim(),
            ct.phone || '',
            Boolean(ct.isPrimary),
            Boolean(ct.isBillingContact),
            ct.notes || ''
          ]
        );
      }
    } else if (data.contactPerson && data.email) {
      const ctId = `ct-${id}-primary`;
      await db.query(
        `INSERT INTO client_contacts (id, client_id, name, role_or_title, email, phone, is_primary, is_billing_contact, notes)
         VALUES ($1, $2, $3, $4, $5, $6, true, true, 'Primary contact')
         ON CONFLICT (id) DO NOTHING`,
        [ctId, id, data.contactPerson.trim(), 'Primary Contact', data.email.trim(), data.phone || '']
      );
    }

    return await this.getClientById(id);
  }

  public async updateClient(id: string, data: any): Promise<any> {
    const db = await this.getDb();
    const existing = await this.getClientById(id);
    if (!existing) return null;

    const merged = { ...existing, ...data };
    const name = String(merged.name || existing.name).trim();

    await db.query(
      `UPDATE clients SET
         name=$1, client_code=COALESCE($2, client_code), legal_name=$3, tax_id=$4,
         tagline=$5, industry=$6, location=$7, address=$8, city=$9, country=$10,
         status=$11, contact_person=$12, email=$13, phone=$14,
         billing_email=$15, billing_address=$16, payment_terms=$17, credit_limit=$18,
         currency=$19, notes=$20, theme_id=$21, custom_gradient=$22, updated_at_ts=NOW()
       WHERE id=$23`,
      [
        name,
        merged.clientCode || null,
        merged.legalName || name,
        merged.taxId || '',
        merged.tagline || '',
        merged.industry || '',
        merged.location || '',
        merged.address || '',
        merged.city || '',
        merged.country || '',
        merged.status || 'Active Partner',
        merged.contactPerson || '',
        merged.email || '',
        merged.phone || '',
        merged.billingEmail || '',
        merged.billingAddress || '',
        merged.paymentTerms || 'Net 30',
        round2(merged.creditLimit || 0),
        merged.currency || 'USD',
        merged.notes || '',
        merged.themeId || 'pacific-sky',
        merged.customGradient || null,
        id
      ]
    );

    // Keep denormalized client_name on projects in sync if name changed
    if (name !== existing.name) {
      await db.query('UPDATE projects SET client_name = $1 WHERE client_id = $2', [name, id]);
    }

    // Save contacts if supplied
    if (Array.isArray(data.contacts)) {
      for (const ct of data.contacts) {
        if (!ct.name || !ct.email) continue;
        const ctId = ct.id || `ct-${id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await db.query(
          `INSERT INTO client_contacts (id, client_id, name, role_or_title, email, phone, is_primary, is_billing_contact, notes, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
           ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, role_or_title=EXCLUDED.role_or_title, email=EXCLUDED.email, phone=EXCLUDED.phone, is_primary=EXCLUDED.is_primary, is_billing_contact=EXCLUDED.is_billing_contact, notes=EXCLUDED.notes, updated_at=NOW()`,
          [
            ctId,
            id,
            ct.name.trim(),
            ct.roleOrTitle || 'Primary Contact',
            ct.email.trim(),
            ct.phone || '',
            Boolean(ct.isPrimary),
            Boolean(ct.isBillingContact),
            ct.notes || ''
          ]
        );
      }
    }

    return await this.getClientById(id);
  }

  public async deleteClient(id: string): Promise<boolean> {
    const db = await this.getDb();
    
    // Check if client has associated projects (Requirement 17 & 18)
    const checkPrj = await db.query(
      `SELECT COUNT(DISTINCT p.id) as cnt, COUNT(DISTINCT pl.id) as plan_cnt
       FROM projects p
       LEFT JOIN project_plans pl ON pl.project_id = p.id
       LEFT JOIN project_clients pc ON pc.project_id = p.id
       WHERE p.client_id = $1 OR pc.client_id = $1`,
      [id]
    );

    const projectCount = Number(checkPrj.rows[0]?.cnt || 0);
    const planCount = Number(checkPrj.rows[0]?.plan_cnt || 0);

    if (projectCount > 0) {
      throw new Error(
        `Cannot delete client: Client is linked to ${projectCount} project(s) and ${planCount} budgetary plan(s). To preserve historical quotes, plans, and financial records, archive this client instead.`
      );
    }

    await db.query('DELETE FROM client_contacts WHERE client_id = $1', [id]);
    await db.query('DELETE FROM project_clients WHERE client_id = $1', [id]);
    await db.query('DELETE FROM clients WHERE id = $1', [id]);
    return true;
  }

  public async archiveClient(id: string): Promise<any> {
    const db = await this.getDb();
    await db.query("UPDATE clients SET status = 'Archived', updated_at_ts = NOW() WHERE id = $1", [id]);
    return await this.getClientById(id);
  }

  public async refreshClientStats(clientId: string): Promise<void> {
    if (!clientId) return;
    const db = await this.getDb();
    await db.query(
      `UPDATE clients SET
         active_projects_count = (
           SELECT COUNT(DISTINCT p.id)
           FROM projects p
           LEFT JOIN project_clients pc ON pc.project_id = p.id
           WHERE (p.client_id = $1 OR pc.client_id = $1)
             AND p.status NOT IN ('Completed', 'Archived', 'Cancelled')
         ),
         total_quoted_value = COALESCE((
           SELECT SUM(p.quoted_price)
           FROM projects p
           WHERE p.client_id = $1
         ), 0),
         updated_at_ts = NOW()
       WHERE id = $1`,
      [clientId]
    ).catch((e) => console.warn('[PostgreSQL] refreshClientStats warning:', e.message));
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
      barcode: r.barcode || '',
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
    return parseFilterPagination(rows, opts, ['name', 'code', 'barcode', 'category', 'city', 'country', 'contactPerson', 'email']);
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

    let barcode = data.barcode ? String(data.barcode).trim().toUpperCase() : '';
    if (!barcode) {
      barcode = await this.generateUniqueBarcode('supplier', code);
    }

    await db.query(
      `INSERT INTO suppliers (id, code, barcode, name, category, supply_scope, rating, on_time_delivery_pct, quality_score_pct, lead_time_days, payment_terms, city, country, address, contact_person, email, phone, credit_limit, currency, status, certifications, contract_history, notes, theme_id, custom_gradient, created_at, updated_at_ts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         code = EXCLUDED.code,
         barcode = EXCLUDED.barcode,
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
        barcode,
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

    await this.registerBarcode({
      barcode,
      entityType: 'supplier',
      entityId: id,
      entityCode: code,
      entityName: data.name || 'New Supplier',
      category: data.category || 'Materials',
      isCostEligible: false,
      isBoqEligible: false
    }).catch((err) => console.warn('[Barcode] Register supplier barcode warning:', err?.message));

    return { ...data, id, code, barcode };
  }

  public async updateSupplier(id: string, data: any): Promise<any> {
    const db = await this.getDb();
    const existing = (await this.getSuppliers()).find((s) => s.id === id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    const barcode = (merged.barcode || existing.barcode || '').trim().toUpperCase();

    await db.query(
      `UPDATE suppliers SET code=$1, barcode=$2, name=$3, category=$4, supply_scope=$5, rating=$6, on_time_delivery_pct=$7, quality_score_pct=$8, lead_time_days=$9, payment_terms=$10, city=$11, country=$12, address=$13, contact_person=$14, email=$15, phone=$16, credit_limit=$17, currency=$18, status=$19, certifications=$20, contract_history=$21, notes=$22, theme_id=$23, custom_gradient=$24, updated_at_ts=NOW() WHERE id=$25`,
      [
        merged.code,
        barcode,
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

    if (barcode) {
      await this.registerBarcode({
        barcode,
        entityType: 'supplier',
        entityId: id,
        entityCode: merged.code,
        entityName: merged.name,
        category: merged.category || 'Materials',
        isCostEligible: false,
        isBoqEligible: false
      }).catch((err) => console.warn('[Barcode] Update supplier barcode warning:', err?.message));
    }

    return { ...merged, barcode };
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
    const res = await db.query(`
      SELECT
        m.*,
        cat.name AS resolved_category_name,
        cat.id AS resolved_category_id,
        sub.name AS resolved_subcategory_name,
        sub.id AS resolved_subcategory_id
      FROM materials m
      LEFT JOIN categories cat ON m.category_id = cat.id
      LEFT JOIN categories sub ON m.subcategory_id = sub.id
      ORDER BY m.created_at_ts DESC NULLS LAST, m.created_at DESC
    `);
    const rows = res.rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      categoryId: r.category_id || r.resolved_category_id || null,
      subCategoryId: r.subcategory_id || r.resolved_subcategory_id || null,
      category: r.resolved_category_name || r.category || '',
      subCategory: r.resolved_subcategory_name || r.sub_category || '',
      categoryName: r.resolved_category_name || r.category || '',
      subCategoryName: r.resolved_subcategory_name || r.sub_category || '',
      moreSubCategory: r.more_sub_category,
      itemClassification: r.item_classification || 'raw_material',
      unit: r.unit || 'pcs',
      defaultUnitId: r.default_unit_id || null,
      description: r.description || '',
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
      status: r.status || 'Available',
      barcode: r.barcode || r.code || '',
      volumePricing: typeof r.volume_pricing === 'string' ? JSON.parse(r.volume_pricing) : r.volume_pricing || [],
      priceHistory: typeof r.price_history === 'string' ? JSON.parse(r.price_history) : r.price_history || [],
      classificationReviewRequired: Boolean(r.classification_review_required),
      classificationReviewNotes: r.classification_review_notes || '',
      themeId: r.theme_id,
      customGradient: r.custom_gradient,
      effectiveDate: formatSqlDate(r.effective_date, r.last_updated),
      lastUpdated: r.last_updated,
      createdAt: r.created_at || (r.created_at_ts ? formatSqlDate(r.created_at_ts) : ''),
      updatedAt: r.last_updated || (r.updated_at_ts ? formatSqlDate(r.updated_at_ts) : '')
    }));
    return parseFilterPagination(rows, opts, ['name', 'code', 'category', 'subCategory', 'supplierName', 'barcode', 'description']);
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

    let categoryId: string | null = data.categoryId || data.category_id || null;
    let subCategoryId: string | null = data.subCategoryId || data.subcategory_id || null;
    let categoryName: string = data.category || data.categoryName || '';
    let subCategoryName: string = data.subCategory || data.subcategoryName || data.subcategory || '';

    // If categoryId is provided, verify it exists
    if (categoryId) {
      const catCheck = await db.query('SELECT id, name, type, parent_id FROM categories WHERE id = $1', [categoryId]);
      if (catCheck.rows.length === 0) {
        throw Object.assign(new Error(`Category not found with ID ${categoryId}`), { status: 400 });
      }
      categoryName = catCheck.rows[0].name;
    } else if (categoryName) {
      // Try to find matching category by name in database
      const catCheck = await db.query(
        "SELECT id, name FROM categories WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND (type = 'category' OR parent_id IS NULL) LIMIT 1",
        [categoryName]
      );
      if (catCheck.rows.length > 0) {
        categoryId = catCheck.rows[0].id;
        categoryName = catCheck.rows[0].name;
      }
    }

    // If subCategoryId is provided, verify it exists and belongs to categoryId
    if (subCategoryId) {
      const subCheck = await db.query('SELECT id, name, type, parent_id FROM categories WHERE id = $1', [subCategoryId]);
      if (subCheck.rows.length === 0) {
        throw Object.assign(new Error(`Subcategory not found with ID ${subCategoryId}`), { status: 400 });
      }
      const subRow = subCheck.rows[0];
      if (categoryId && subRow.parent_id !== categoryId) {
        throw Object.assign(new Error(`Selected subcategory "${subRow.name}" does not belong to the selected category`), { status: 400 });
      }
      if (!categoryId && subRow.parent_id) {
        categoryId = subRow.parent_id;
        const parentCheck = await db.query('SELECT name FROM categories WHERE id = $1', [categoryId]);
        if (parentCheck.rows.length > 0) categoryName = parentCheck.rows[0].name;
      }
      subCategoryName = subRow.name;
    } else if (subCategoryName && categoryId) {
      // Try to find matching subcategory under this category
      const subCheck = await db.query(
        'SELECT id, name FROM categories WHERE parent_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) LIMIT 1',
        [categoryId, subCategoryName]
      );
      if (subCheck.rows.length > 0) {
        subCategoryId = subCheck.rows[0].id;
        subCategoryName = subCheck.rows[0].name;
      }
    }

    const effectiveDate = (data.effectiveDate || data.lastUpdated || new Date().toISOString()).slice(0, 10);
    let barcode = data.barcode ? String(data.barcode).trim().toUpperCase() : '';
    if (!barcode) {
      barcode = await this.generateUniqueBarcode('material', code);
    } else {
      await this.validateBarcodeUnique(barcode, id, 'material');
    }
    const description = (data.description || '').trim();
    const unit = (data.unit || 'pcs').trim();
    const defaultUnitId = data.defaultUnitId || null;
    const status = data.status || 'Available';

    await db.query(
      `INSERT INTO materials (
        id, code, name, category, sub_category, more_sub_category, item_classification, unit,
        current_price, last_price, default_discount_pct, currency, supplier_id, supplier_name,
        lead_time_days, in_stock, reorder_point, unit_cost, status, barcode, volume_pricing,
        price_history, theme_id, custom_gradient, effective_date, last_updated, created_at,
        category_id, subcategory_id, description, default_unit_id,
        classification_review_required, classification_review_notes, created_at_ts, updated_at_ts
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21,
        $22, $23, $24, $25, $26, $27,
        $28, $29, $30, $31,
        $32, $33, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        code = EXCLUDED.code,
        category = EXCLUDED.category,
        sub_category = EXCLUDED.sub_category,
        category_id = EXCLUDED.category_id,
        subcategory_id = EXCLUDED.subcategory_id,
        description = EXCLUDED.description,
        default_unit_id = EXCLUDED.default_unit_id,
        barcode = EXCLUDED.barcode,
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
        categoryName,
        subCategoryName,
        data.moreSubCategory || '',
        data.itemClassification || 'raw_material',
        unit,
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
        status,
        barcode,
        JSON.stringify(data.volumePricing || []),
        JSON.stringify(data.priceHistory || []),
        data.themeId || null,
        data.customGradient || null,
        effectiveDate,
        effectiveDate,
        new Date().toISOString(),
        categoryId,
        subCategoryId,
        description,
        defaultUnitId,
        Boolean(data.classificationReviewRequired),
        data.classificationReviewNotes || ''
      ]
    );

    await this.registerBarcode({
      barcode,
      entityType: 'material',
      entityId: id,
      entityCode: code,
      entityName: data.name || 'New Material',
      category: categoryName,
      subCategory: subCategoryName,
      unit,
      unitCost: price,
      sellingRate: price,
      currency: data.currency || 'USD',
      isCostEligible: true,
      isBoqEligible: true
    }).catch((err) => console.warn('[Barcode] Register material barcode warning:', err?.message));

    return {
      ...data,
      id,
      code,
      barcode,
      description,
      categoryId,
      subCategoryId,
      category: categoryName,
      subCategory: subCategoryName,
      categoryName,
      subCategoryName,
      unit,
      status,
      currentPrice: price,
      retailPrice: price,
      effectiveDate,
      lastUpdated: effectiveDate,
      createdAt: effectiveDate,
      updatedAt: effectiveDate
    };
  }

  public async updateMaterial(id: string, data: any): Promise<any> {
    const db = await this.getDb();
    const existingList = await this.getMaterials();
    const existing = existingList.find((m) => m.id === id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    const price = round4(merged.currentPrice ?? merged.retailPrice ?? 0);
    const effectiveDate = (data.effectiveDate || data.lastUpdated || new Date().toISOString()).slice(0, 10);

    let categoryId = merged.categoryId !== undefined ? merged.categoryId : (existing.categoryId || null);
    let subCategoryId = merged.subCategoryId !== undefined ? merged.subCategoryId : (existing.subCategoryId || null);
    let categoryName = merged.category || existing.category || '';
    let subCategoryName = merged.subCategory || existing.subCategory || '';

    // If category changed and subcategory is incompatible:
    if (data.categoryId && data.categoryId !== existing.categoryId && data.subCategoryId === undefined) {
      if (subCategoryId) {
        const check = await db.query('SELECT parent_id FROM categories WHERE id = $1', [subCategoryId]);
        if (check.rows.length === 0 || check.rows[0].parent_id !== data.categoryId) {
          subCategoryId = null;
          subCategoryName = '';
        }
      }
    }

    if (categoryId) {
      const catCheck = await db.query('SELECT id, name FROM categories WHERE id = $1', [categoryId]);
      if (catCheck.rows.length > 0) categoryName = catCheck.rows[0].name;
    }

    if (subCategoryId) {
      const subCheck = await db.query('SELECT id, name, parent_id FROM categories WHERE id = $1', [subCategoryId]);
      if (subCheck.rows.length === 0) {
        throw Object.assign(new Error(`Subcategory not found with ID ${subCategoryId}`), { status: 400 });
      }
      if (categoryId && subCheck.rows[0].parent_id !== categoryId) {
        throw Object.assign(new Error(`Selected subcategory does not belong to the selected category`), { status: 400 });
      }
      subCategoryName = subCheck.rows[0].name;
    }

    const barcode = (merged.barcode || merged.code || '').trim();
    const description = (merged.description || '').trim();
    const unit = (merged.unit || 'pcs').trim();
    const status = merged.status || 'Available';

    await db.query(
      `UPDATE materials SET
        code=$1, name=$2, category=$3, sub_category=$4, more_sub_category=$5, unit=$6,
        current_price=$7, last_price=$8, currency=$9, supplier_name=$10, lead_time_days=$11,
        in_stock=$12, reorder_point=$13, unit_cost=$14, status=$15, barcode=$16,
        volume_pricing=$17, price_history=$18, theme_id=$19, custom_gradient=$20,
        effective_date=$21, last_updated=$22, category_id=$23, subcategory_id=$24,
        description=$25, default_unit_id=$26, classification_review_required=$27,
        classification_review_notes=$28, updated_at_ts=NOW()
      WHERE id=$29`,
      [
        merged.code,
        merged.name,
        categoryName,
        subCategoryName,
        merged.moreSubCategory || '',
        unit,
        price,
        round4(merged.lastPrice ?? price),
        merged.currency || 'USD',
        merged.supplierName || '',
        Number(merged.leadTimeDays || 7),
        Math.max(0, round4(merged.inStock || 0)),
        Math.max(0, round4(merged.reorderPoint || 0)),
        round4(merged.unitCost || 0),
        status,
        barcode,
        JSON.stringify(merged.volumePricing || []),
        JSON.stringify(merged.priceHistory || []),
        merged.themeId || null,
        merged.customGradient || null,
        effectiveDate,
        effectiveDate,
        categoryId,
        subCategoryId,
        description,
        merged.defaultUnitId || null,
        Boolean(merged.classificationReviewRequired),
        merged.classificationReviewNotes || '',
        id
      ]
    );

    if (barcode) {
      await this.registerBarcode({
        barcode,
        entityType: 'material',
        entityId: id,
        entityCode: merged.code,
        entityName: merged.name,
        category: categoryName,
        subCategory: subCategoryName,
        unit,
        unitCost: price,
        sellingRate: price,
        currency: merged.currency || 'USD',
        isCostEligible: true,
        isBoqEligible: true
      }).catch((err) => console.warn('[Barcode] Update material barcode warning:', err?.message));
    }

    return {
      ...merged,
      categoryId,
      subCategoryId,
      category: categoryName,
      subCategory: subCategoryName,
      categoryName,
      subCategoryName,
      barcode,
      description,
      unit,
      status,
      currentPrice: price,
      retailPrice: price,
      effectiveDate,
      lastUpdated: effectiveDate,
      updatedAt: effectiveDate
    };
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
    const res = await db.query(`
      SELECT p.*,
             c.client_code,
             c.industry as client_industry,
             c.location as client_location,
             c.contact_person as client_contact_person,
             c.email as client_email,
             c.status as client_status
      FROM projects p
      LEFT JOIN clients c ON c.id = p.client_id
      ORDER BY p.created_at DESC
    `);

    // Fetch project_clients junction table for each project
    let clientsByProject = new Map<string, any[]>();
    try {
      const pcRes = await db.query(`
        SELECT pc.*, c.name as client_name, c.client_code, c.industry, c.location, c.status as client_status
        FROM project_clients pc
        JOIN clients c ON c.id = pc.client_id
        ORDER BY pc.is_primary DESC, pc.share_pct DESC
      `);
      for (const row of pcRes.rows) {
        const list = clientsByProject.get(row.project_id) || [];
        list.push({
          id: row.id,
          projectId: row.project_id,
          clientId: row.client_id,
          clientCode: row.client_code,
          clientName: row.client_name,
          industry: row.industry,
          location: row.location,
          clientStatus: row.client_status,
          relationshipType: row.relationship_type,
          sharePct: Number(row.share_pct || 100),
          isPrimary: Boolean(row.is_primary),
          notes: row.notes || ''
        });
        clientsByProject.set(row.project_id, list);
      }
    } catch {
      // project_clients table may be initializing
    }

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
      const associatedClients = clientsByProject.get(r.id) || [];

      return {
        id: r.id,
        code: r.code,
        name: r.name,
        clientId: r.client_id,
        clientCode: r.client_code || '',
        clientName: r.client_name,
        billingClientId: r.billing_client_id || r.client_id,
        clientDetails: r.client_id ? {
          id: r.client_id,
          code: r.client_code,
          name: r.client_name,
          industry: r.client_industry,
          location: r.client_location,
          contactPerson: r.client_contact_person,
          email: r.client_email,
          status: r.client_status
        } : null,
        associatedClients,
        productCategory: r.product_category,
        productSubCategory: r.product_sub_category,
        moreSubCategory: r.more_sub_category,
        targetProduct: r.target_product,
        quotedPrice: round2(r.quoted_price || 0),
        currency: r.currency || 'LKR',
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
    return parseFilterPagination(rows, opts, ['name', 'code', 'clientName', 'clientCode', 'productCategory', 'targetProduct', 'status']);
  }

  public async getProjectById(id: string): Promise<any | null> {
    const projects = await this.getProjects();
    return projects.find((p) => p.id === id) || null;
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

    // Determine and validate Client relationship (Requirement 4, 5, 7, 16)
    let clientId = data.clientId || data.client_id || null;
    let clientName = (data.clientName || data.client_name || '').trim();

    if (clientId) {
      // Validate that client reference exists before saving dependent records (Requirement 16)
      const clientCheck = await db.query('SELECT id, name, client_code FROM clients WHERE id = $1', [clientId]);
      if (clientCheck.rows.length === 0) {
        throw new Error(`Invalid client reference: Client with id "${clientId}" does not exist in the database.`);
      }
      clientName = clientCheck.rows[0].name;
    } else if (clientName) {
      // Look up existing client by name to prevent duplicate clients (Requirement 7)
      const matchClient = await db.query('SELECT id, name, client_code FROM clients WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))', [clientName]);
      if (matchClient.rows.length > 0) {
        clientId = matchClient.rows[0].id;
        clientName = matchClient.rows[0].name;
      } else {
        // Create canonical client record
        const newCli = await this.createClient({
          name: clientName,
          industry: data.productCategory || 'Commercial Enterprise',
          location: 'Corporate Partner'
        });
        clientId = newCli.id;
        clientName = newCli.name;
      }
    } else {
      // Default to general enterprise client
      const defClient = await db.query("SELECT id, name FROM clients WHERE id = 'cli-default-corp' OR name = 'General Enterprise Client' LIMIT 1");
      if (defClient.rows.length > 0) {
        clientId = defClient.rows[0].id;
        clientName = defClient.rows[0].name;
      } else {
        const newCli = await this.createClient({
          name: 'General Enterprise Client',
          industry: 'Commercial Enterprise'
        });
        clientId = newCli.id;
        clientName = newCli.name;
      }
    }

    const quotedPrice = round2(data.quotedPrice ?? 100000);

    await db.query(
      `INSERT INTO projects (id, code, name, client_id, client_name, billing_client_id, product_category, product_sub_category, more_sub_category, target_product, quoted_price, currency, target_margin_pct, overhead_pct, contingency_pct, status, start_date, delivery_deadline, created_date, contract_locked, theme_id, custom_gradient, phases, selected_items, alternative_options, active_plan_id, notes, analytics, created_at, updated_at_ts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         code = EXCLUDED.code,
         client_id = EXCLUDED.client_id,
         client_name = EXCLUDED.client_name,
         billing_client_id = EXCLUDED.billing_client_id,
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
        clientId,
        clientName,
        data.billingClientId || clientId,
        data.productCategory || '',
        data.productSubCategory || '',
        data.moreSubCategory || '',
        data.targetProduct || '',
        quotedPrice,
        data.currency || 'LKR',
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

    // Populate project_clients junction table (Requirement 6)
    await db.query(
      `INSERT INTO project_clients (id, project_id, client_id, relationship_type, share_pct, is_primary, updated_at)
       VALUES ($1, $2, $3, 'Primary Client', 100.00, true, NOW())
       ON CONFLICT (project_id, client_id, relationship_type) DO UPDATE SET is_primary = true, updated_at = NOW()`,
      [`pc-${id}-${clientId}-primary`, id, clientId]
    );

    // If additional client entities were specified, sync them
    if (Array.isArray(data.associatedClients)) {
      for (const ac of data.associatedClients) {
        if (!ac.clientId || ac.clientId === clientId) continue;
        await db.query(
          `INSERT INTO project_clients (id, project_id, client_id, relationship_type, share_pct, is_primary, notes, updated_at)
           VALUES ($1, $2, $3, $4, $5, false, $6, NOW())
           ON CONFLICT (project_id, client_id, relationship_type) DO UPDATE SET share_pct = EXCLUDED.share_pct, notes = EXCLUDED.notes, updated_at = NOW()`,
          [
            `pc-${id}-${ac.clientId}-${(ac.relationshipType || 'Partner').replace(/[^a-zA-Z0-9]/g, '_')}`,
            id,
            ac.clientId,
            ac.relationshipType || 'Consortium Partner',
            round2(ac.sharePct || 50),
            ac.notes || ''
          ]
        );
      }
    }

    await this.refreshClientStats(clientId);

    if (Array.isArray(data.budgetaryPlans) && data.budgetaryPlans.length > 0) {
      await this.syncProjectBudgetaryPlans(id, data.budgetaryPlans, data.activePlanId);
    }

    const saved = (await this.getProjects()).find((p) => p.id === id);
    return saved || { ...data, id, code, clientId, clientName, quotedPrice };
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

    // Determine and validate client
    let clientId = merged.clientId || merged.client_id || existing.clientId;
    let clientName = (merged.clientName || merged.client_name || existing.clientName || '').trim();

    if (clientId) {
      const clientCheck = await db.query('SELECT id, name FROM clients WHERE id = $1', [clientId]);
      if (clientCheck.rows.length > 0) {
        clientName = clientCheck.rows[0].name;
      }
    } else if (clientName) {
      const matchClient = await db.query('SELECT id, name FROM clients WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))', [clientName]);
      if (matchClient.rows.length > 0) {
        clientId = matchClient.rows[0].id;
        clientName = matchClient.rows[0].name;
      }
    }

    await db.query(
      `UPDATE projects SET
         code=$1, name=$2, client_id=$3, client_name=$4, billing_client_id=$5,
         product_category=$6, product_sub_category=$7, more_sub_category=$8, target_product=$9,
         quoted_price=$10, currency=$11, target_margin_pct=$12, overhead_pct=$13, contingency_pct=$14,
         status=$15, start_date=$16, delivery_deadline=$17, contract_locked=$18, theme_id=$19,
         custom_gradient=$20, phases=$21, selected_items=$22, alternative_options=$23, active_plan_id=$24,
         notes=$25, analytics=$26, updated_at_ts=NOW()
       WHERE id=$27`,
      [
        merged.code,
        merged.name,
        clientId,
        clientName,
        merged.billingClientId || clientId,
        merged.productCategory || '',
        merged.productSubCategory || '',
        merged.moreSubCategory || '',
        merged.targetProduct || '',
        quotedPrice,
        merged.currency || 'LKR',
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

    // Update primary junction record
    if (clientId) {
      await db.query(
        `INSERT INTO project_clients (id, project_id, client_id, relationship_type, share_pct, is_primary, updated_at)
         VALUES ($1, $2, $3, 'Primary Client', 100.00, true, NOW())
         ON CONFLICT (project_id, client_id, relationship_type) DO UPDATE SET is_primary = true, updated_at = NOW()`,
        [`pc-${id}-${clientId}-primary`, id, clientId]
      );
      await this.refreshClientStats(clientId);
    }
    if (existing.clientId && existing.clientId !== clientId) {
      await this.refreshClientStats(existing.clientId);
    }

    if (Array.isArray(data.budgetaryPlans)) {
      await this.syncProjectBudgetaryPlans(id, data.budgetaryPlans, merged.activePlanId);
    }

    const updated = (await this.getProjects()).find((p) => p.id === id);
    return updated || { ...merged, clientId, clientName, quotedPrice };
  }

  public async deleteProject(id: string): Promise<boolean> {
    const db = await this.getDb();
    const existing = await this.getProjectById(id);
    const clientId = existing?.clientId;

    await db.query('DELETE FROM project_clients WHERE project_id = $1', [id]);
    await db.query('DELETE FROM projects WHERE id = $1', [id]);

    if (clientId) {
      await this.refreshClientStats(clientId);
    }
    return true;
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
      revenueItemId: b.revenue_item_id || undefined,
      name: b.name,
      category: b.category || '',
      subCategory: b.sub_category || '',
      supplierOrProvider: b.supplier_or_provider || '',
      description: b.description || '',
      quantity: round4(b.quantity ?? 1),
      unit: b.unit || 'pcs',
      unitCost: round4(b.unit_cost ?? 0),
      discountPct: round2(b.discount_pct ?? 0),
      rate: round4(b.rate ?? b.billable_rate ?? 0),
      sellingRate: round4(b.rate ?? b.billable_rate ?? 0),
      totalCost: round2(b.total_cost ?? 0),
      markupPct: round2(b.markup_pct ?? 0),
      billableRate: round4(b.rate ?? b.billable_rate ?? 0),
      taxTreatment: b.tax_treatment || 'Standard (0%)',
      taxRatePct: round2(b.tax_rate_pct ?? 0),
      taxAmount: round2(b.tax_amount ?? 0),
      totalRevenue: round2(b.total_revenue ?? 0),
      grossProfit: round2(b.gross_profit ?? 0),
      currency: b.currency || r.currency || 'USD',
      nativeUnitCost: b.native_unit_cost !== null && b.native_unit_cost !== undefined ? round4(b.native_unit_cost) : round4(b.unit_cost ?? 0),
      consumptionRate: round2(b.consumption_rate ?? 100),
      notes: b.notes || '',
      lineOrder: Number(b.line_order || 1),
      snapshotData: typeof b.snapshot_data === 'string' ? JSON.parse(b.snapshot_data) : b.snapshot_data || {},
      commercialContext: b.commercial_context || ''
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
      overheadItemId: ovh.overhead_item_id || undefined,
      overheadItemCode: ovh.overhead_item_code || ovh.code || undefined,
      overheadItemName: ovh.overhead_item_name || ovh.name || ovh.category || 'Overhead Item',
      barcode: ovh.barcode || undefined,
      costType: ovh.cost_type || 'Fixed',
      unitType: ovh.unit_type || 'month',
      category: ovh.category || 'General Overhead',
      allocationMethod: ovh.allocation_method || (ovh.allocation_type === 'fixed' ? 'fixed_amount' : 'percentage_of_cost_base'),
      allocationType: (ovh.allocation_method === 'fixed_amount' || ovh.allocation_type === 'fixed') ? 'fixed' : 'percentage',
      allocationBase: ovh.allocation_base || 'total_direct_cost',
      allocationRate: round4(ovh.allocation_rate ?? ovh.rate_pct ?? 0),
      ratePct: round2(ovh.rate_pct ?? ovh.allocation_rate ?? 0),
      unitQuantity: round4(ovh.unit_quantity ?? 1),
      baseAmount: round2(ovh.base_amount ?? 0),
      allocatedAmount: round2(ovh.allocated_amount ?? 0),
      effectiveDate: formatSqlDate(ovh.effective_date_iso || ovh.effective_date, ''),
      allocatedBy: ovh.allocated_by || 'System',
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
      clientId: r.client_id || '',
      clientCode: r.client_code || '',
      clientName: r.client_name || '',
      clientIndustry: r.client_industry || '',
      clientContactPerson: r.client_contact_person || '',
      clientEmail: r.client_email || '',
      name: r.name,
      planName: r.name,
      plan_name: r.name,
      description: r.description || '',
      planType: r.plan_type || 'Baseline',
      status: r.status || 'Draft',
      revisionNumber: Number(r.revision_number || 1),
      versionLabel: r.version_label || `v${r.revision_number || 1}.0`,
      isBaseline: Boolean(r.is_baseline),
      isActive: Boolean(r.is_active),
      currency: r.currency || 'LKR',
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
        p.client_id AS client_id,
        p.client_name AS client_name,
        c.client_code AS client_code,
        c.industry AS client_industry,
        c.contact_person AS client_contact_person,
        c.email AS client_email,
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
      LEFT JOIN clients c ON c.id = p.client_id
      LEFT JOIN project_plan_cost_summaries cs ON cs.plan_id = pp.id
      ORDER BY pp.is_active DESC, pp.is_baseline DESC, pp.updated_at DESC, pp.created_at ASC
    `);

    const [sectionsRes, boqRes, resourcesRes, overheadsRes, revisionsRes] = await Promise.all([
      db.query('SELECT *, start_date::text AS start_date_iso, end_date::text AS end_date_iso FROM project_plan_sections ORDER BY sequence_order ASC'),
      db.query('SELECT * FROM project_plan_boq_items ORDER BY line_order ASC, created_at ASC'),
      db.query('SELECT *, start_date::text AS start_date_iso, end_date::text AS end_date_iso FROM project_plan_resources ORDER BY created_at ASC'),
      db.query(
        `SELECT
          poa.*,
          poa.effective_date::text AS effective_date_iso,
          oi.code AS overhead_item_code,
          oi.name AS overhead_item_name,
          oi.barcode,
          oi.category,
          oi.cost_type,
          oi.unit_type
        FROM plan_overhead_allocations poa
        LEFT JOIN overhead_items oi ON oi.id = poa.overhead_item_id
        ORDER BY poa.created_at ASC`
      ).then(async (r) => {
        if (r.rows.length > 0) return r;
        return await db.query('SELECT * FROM project_plan_overhead_allocations ORDER BY created_at ASC');
      }).catch(() => db.query('SELECT * FROM project_plan_overhead_allocations ORDER BY created_at ASC')),
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
    let planRes = await db.query(
      `SELECT
        pp.*,
        pp.effective_date::text AS effective_date_iso,
        pp.approval_date::text AS approval_date_iso,
        p.code AS project_code,
        p.name AS project_name,
        p.client_id AS client_id,
        p.client_name AS client_name,
        c.client_code AS client_code,
        c.industry AS client_industry,
        c.contact_person AS client_contact_person,
        c.email AS client_email,
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
      LEFT JOIN projects p ON p.id = pp.project_id
      LEFT JOIN clients c ON c.id = p.client_id
      LEFT JOIN project_plan_cost_summaries cs ON cs.plan_id = pp.id
      WHERE pp.id = $1`,
      [planId]
    );

    // Fallback 1: If not found by planId, check if planId was a projectId (e.g. caller passed project ID)
    if (planRes.rows.length === 0) {
      planRes = await db.query(
        `SELECT
          pp.*,
          pp.effective_date::text AS effective_date_iso,
          pp.approval_date::text AS approval_date_iso,
          p.code AS project_code,
          p.name AS project_name,
          p.client_id AS client_id,
          p.client_name AS client_name,
          c.client_code AS client_code,
          c.industry AS client_industry,
          c.contact_person AS client_contact_person,
          c.email AS client_email,
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
        LEFT JOIN projects p ON p.id = pp.project_id
        LEFT JOIN clients c ON c.id = p.client_id
        LEFT JOIN project_plan_cost_summaries cs ON cs.plan_id = pp.id
        WHERE pp.project_id = $1
        ORDER BY pp.is_active DESC, pp.is_baseline DESC, pp.created_at DESC
        LIMIT 1`,
        [planId]
      );
    }

    // Fallback 2: If still not found, check if a project exists with this ID in projects table, and auto-initialize its baseline plan
    if (planRes.rows.length === 0) {
      const prjRes = await db.query('SELECT * FROM projects WHERE id = $1 OR code = $1 LIMIT 1', [planId]);
      if (prjRes.rows.length > 0) {
        const prj = prjRes.rows[0];
        const newPlanId = `plan-${prj.id}-baseline`;
        await this.createProjectPlan({
          id: newPlanId,
          planNumber: `PLN-${String(prj.code || prj.id).toUpperCase().replace(/[^A-Z0-9-]/g, '')}-01`,
          projectId: prj.id,
          name: 'Plan A: Certified Enterprise Sourcing (Baseline)',
          description: 'Initial project baseline plan created automatically.',
          planType: 'Baseline',
          status: 'Active',
          revisionNumber: 1,
          versionLabel: 'v1.0',
          isBaseline: true,
          isActive: true,
          currency: prj.currency || 'USD',
          plannedRevenue: Number(prj.quoted_price || 0),
          targetMarginPct: Number(prj.target_margin_pct || 25),
          overheadPct: Number(prj.overhead_pct || 8.5),
          contingencyPct: Number(prj.contingency_pct || 5.0)
        }).catch(() => {});

        planRes = await db.query(
          `SELECT
            pp.*,
            pp.effective_date::text AS effective_date_iso,
            pp.approval_date::text AS approval_date_iso,
            p.code AS project_code,
            p.name AS project_name,
            p.client_id AS client_id,
            p.client_name AS client_name,
            c.client_code AS client_code,
            c.industry AS client_industry,
            c.contact_person AS client_contact_person,
            c.email AS client_email,
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
          LEFT JOIN projects p ON p.id = pp.project_id
          LEFT JOIN clients c ON c.id = p.client_id
          LEFT JOIN project_plan_cost_summaries cs ON cs.plan_id = pp.id
          WHERE pp.id = $1`,
          [newPlanId]
        );
      }
    }

    if (planRes.rows.length === 0) return null;
    const actualPlanId = planRes.rows[0].id;

    const [sectionsRes, boqRes, resourcesRes, overheadsRes, revisionsRes] = await Promise.all([
      db.query('SELECT *, start_date::text AS start_date_iso, end_date::text AS end_date_iso FROM project_plan_sections WHERE plan_id = $1 ORDER BY sequence_order ASC', [actualPlanId]),
      db.query('SELECT * FROM project_plan_boq_items WHERE plan_id = $1 ORDER BY line_order ASC, created_at ASC', [actualPlanId]),
      db.query('SELECT *, start_date::text AS start_date_iso, end_date::text AS end_date_iso FROM project_plan_resources WHERE plan_id = $1 ORDER BY created_at ASC', [actualPlanId]),
      db.query(
        `SELECT
          poa.*,
          poa.effective_date::text AS effective_date_iso,
          oi.code AS overhead_item_code,
          oi.name AS overhead_item_name,
          oi.barcode,
          oi.category,
          oi.cost_type,
          oi.unit_type
        FROM plan_overhead_allocations poa
        LEFT JOIN overhead_items oi ON oi.id = poa.overhead_item_id
        WHERE poa.plan_id = $1
        ORDER BY poa.created_at ASC`,
        [actualPlanId]
      ).then(async (r) => {
        if (r.rows.length > 0) return r;
        return await db.query('SELECT * FROM project_plan_overhead_allocations WHERE plan_id = $1 ORDER BY created_at ASC', [actualPlanId]);
      }).catch(() => db.query('SELECT * FROM project_plan_overhead_allocations WHERE plan_id = $1 ORDER BY created_at ASC', [actualPlanId])),
      db.query('SELECT *, effective_date::text AS effective_date_iso FROM project_plan_revisions WHERE plan_id = $1 ORDER BY revision_number DESC, created_at DESC', [actualPlanId])
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
    const planName = String(data?.name || data?.planName || data?.plan_name || '').trim();
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
        const revenueItemId = item.revenueItemId || (item.type === 'product' || item.type === 'service' ? (item.itemId || item.itemCode) : null);
        const rate = round4(item.rate ?? item.sellingRate ?? item.billableRate ?? 0);

        await q(
          `INSERT INTO project_plan_boq_items (
            id, plan_id, project_id, section_id, phase_id, item_type, catalog_item_id, item_code,
            revenue_item_id, rate, description, tax_treatment, tax_rate_pct, tax_amount,
            name, category, supplier_or_provider, quantity, unit, unit_cost, discount_pct,
            total_cost, markup_pct, billable_rate, total_revenue, gross_profit,
            currency, native_unit_cost, consumption_rate, notes, line_order, snapshot_data, commercial_context
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14,
            $15, $16, $17, $18, $19, $20, $21,
            $22, $23, $24, $25, $26,
            $27, $28, $29, $30, $31, $32, $33
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
            revenueItemId,
            rate,
            item.description || '',
            item.taxTreatment || 'Standard (0%)',
            item.taxRatePct ?? 0,
            item.taxAmount ?? 0,
            item.name,
            item.category || '',
            item.supplierOrProvider || '',
            item.quantity,
            item.unit || 'pcs',
            item.unitCost,
            item.discountPct,
            item.totalCost,
            item.markupPct ?? 30,
            rate,
            item.totalRevenue ?? 0,
            item.grossProfit ?? 0,
            item.currency || data.currency || proj.currency || 'USD',
            item.nativeUnitCost ?? item.unitCost,
            item.consumptionRate ?? 100,
            item.notes || '',
            i + 1,
            JSON.stringify(item.snapshotData || {}),
            item.commercialContext || ''
          ]
        );

        if (revenueItemId && (item.type === 'product' || item.type === 'service')) {
          const histId = `rrh-${planId}-${i + 1}-${Date.now()}`;
          await q(
            `INSERT INTO revenue_rate_history (
              id, revenue_item_id, project_id, project_plan_id, plan_boq_item_id,
              previous_unit, new_unit, previous_quantity, new_quantity, previous_rate, new_rate,
              change_type, fields_changed, effective_date, recorded_at, changed_by, change_reason, commercial_context, idempotency_key
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::date, NOW(), $15, $16, $17, $18)
            ON CONFLICT (idempotency_key) DO NOTHING`,
            [
              histId,
              revenueItemId,
              projectId,
              planId,
              boqId,
              null,
              item.unit || 'pcs',
              null,
              item.quantity,
              null,
              rate,
              'initial_addition',
              JSON.stringify(['initial_addition', 'rate', 'quantity', 'unit']),
              effectiveDate || todayIso,
              actorName,
              'Initial addition to project plan BOQ',
              item.commercialContext || `Plan ${planNumber} initial allocation`,
              `init-${planId}-${boqId}`
            ]
          ).catch(() => {});
        }
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
      if (Array.isArray(data.overheadAllocations) && data.overheadAllocations.length > 0) {
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

  public async archiveProjectPlan(planId: string, actor?: { id?: string; name?: string; userId?: string; userName?: string }, reason?: string): Promise<any | null> {
    const existing = await this.getProjectPlanById(planId);
    if (!existing) return null;
    const resolvedActor = actor ? {
      id: actor.id || actor.userId,
      name: actor.name || actor.userName
    } : undefined;
    const updated = await this.updateProjectPlan(
      planId,
      {
        status: 'Archived',
        isActive: false,
        bumpRevision: true,
        changeSummary: reason || 'Archived project plan'
      },
      resolvedActor
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

  public async setActiveProjectPlan(planId: string, actor?: { id?: string; name?: string; userId?: string; userName?: string }): Promise<any | null> {
    return this.activateProjectPlan(planId, actor);
  }

  public async activateProjectPlan(planId: string, actor?: { id?: string; name?: string; userId?: string; userName?: string }): Promise<any | null> {
    const existing = await this.getProjectPlanById(planId);
    if (!existing) return null;
    const actorName = actor?.name || actor?.userName || 'Enterprise Planner';
    await this.withTransaction(async (q) => {
      await q('UPDATE project_plans SET is_active = false WHERE project_id = $1', [existing.projectId]);
      await q(
        `UPDATE project_plans
         SET is_active = true,
             status = CASE WHEN status = 'Draft' THEN 'Active' ELSE status END,
             updated_by = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [actorName, planId]
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

  public async duplicateProjectPlan(planId: string, overrides?: any, actor?: { id?: string; name?: string; userId?: string; userName?: string }): Promise<any | null> {
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

  /**
   * Project-Level Multiple Plans Comparison (TASK 8)
   * Evaluates all plans belonging to a project side-by-side with revenue, direct cost,
   * overhead, total cost, gross profit, net planned profit, margin, status, and baseline variance.
   * Enforces rules for identifying current/approved plan and isolating alternative scenario figures.
   */
  public async getProjectPlansComparison(projectId: string): Promise<any> {
    const db = await this.getDb();
    const projRes = await db.query('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (projRes.rows.length === 0) {
      throw Object.assign(new Error(`Project with ID "${projectId}" not found`), { status: 404 });
    }
    const proj = projRes.rows[0];

    const plansRes = await db.query(`
      SELECT
        pp.*,
        pp.effective_date::text AS effective_date_iso,
        pp.approval_date::text AS approval_date_iso,
        cs.planned_revenue AS cs_planned_revenue,
        cs.material_cost,
        cs.subcontractor_cost,
        cs.outsourced_cost,
        cs.resource_cost,
        cs.direct_cost,
        cs.overhead_amount,
        cs.contingency_amount,
        cs.allocated_overhead,
        cs.total_planned_cost,
        cs.gross_profit,
        cs.gross_margin_pct,
        cs.planned_profit,
        cs.profit_margin_pct,
        cs.boq_item_count,
        cs.section_count,
        cs.resource_count
      FROM project_plans pp
      LEFT JOIN project_plan_cost_summaries cs ON cs.plan_id = pp.id
      WHERE pp.project_id = $1
      ORDER BY pp.is_active DESC, pp.is_baseline DESC, pp.created_at ASC
    `, [projectId]);

    const rawPlans = plansRes.rows;

    // Rules for current or approved plan (Req 14)
    const activePlanRow = rawPlans.find((p) => p.is_active) || rawPlans[0];
    const baselinePlanRow = rawPlans.find((p) => p.is_baseline) || rawPlans[0];
    const approvedPlanRow =
      rawPlans.find((p) => p.status === 'Approved' && p.is_active) ||
      rawPlans.find((p) => p.status === 'Approved') ||
      baselinePlanRow;

    const baseRevenue = round2(baselinePlanRow?.cs_planned_revenue ?? baselinePlanRow?.planned_revenue ?? 0);
    const baseDirectCost = round2(baselinePlanRow?.direct_cost ?? 0);
    const baseOverhead = round2(baselinePlanRow?.allocated_overhead ?? 0);
    const baseTotalCost = round2(baselinePlanRow?.total_planned_cost ?? 0);
    const baseProfit = round2(baselinePlanRow?.planned_profit ?? 0);

    const plans = rawPlans.map((r: any) => {
      const revenue = round2(r.cs_planned_revenue ?? r.planned_revenue ?? 0);
      const directCost = round2(r.direct_cost ?? 0);
      const overhead = round2(r.allocated_overhead ?? 0);
      const totalCost = round2(r.total_planned_cost ?? 0);
      const grossProfit = round2(r.gross_profit ?? decSub(revenue, directCost));
      const netPlannedProfit = round2(r.planned_profit ?? decSub(revenue, totalCost));
      const margin = round2(r.profit_margin_pct ?? (revenue > 0 ? decMul(decDiv(grossProfit, revenue), 100) : 0));
      const isBaseline = Boolean(r.is_baseline);
      const isActive = Boolean(r.is_active);
      const isApproved = r.status === 'Approved' || Boolean(r.approval_date);

      const costVarianceToBaseline = round2(decSub(totalCost, baseTotalCost));
      const revenueVarianceToBaseline = round2(decSub(revenue, baseRevenue));
      const profitVarianceToBaseline = round2(decSub(netPlannedProfit, baseProfit));

      return {
        id: r.id,
        planNumber: r.plan_number,
        name: r.name,
        description: r.description || '',
        planType: r.plan_type || (isBaseline ? 'Baseline' : 'Alternative'),
        status: r.status || 'Draft',
        isBaseline,
        isActive,
        isApproved,
        revisionNumber: Number(r.revision_number || 1),
        versionLabel: r.version_label || `v${r.revision_number || 1}.0`,
        currency: r.currency || proj.currency || 'USD',
        revenue,
        directCost,
        overhead,
        totalCost,
        grossProfit,
        netPlannedProfit,
        margin,
        targetMarginPct: round2(r.target_margin_pct || 25),
        overheadPct: round2(r.overhead_pct || 8.5),
        contingencyPct: round2(r.contingency_pct || 5.0),
        boqItemCount: Number(r.boq_item_count || 0),
        effectiveDate: formatSqlDate(r.effective_date_iso, ''),
        updatedAt: r.updated_at,
        varianceToBaseline: {
          costDifference: costVarianceToBaseline,
          costDiffPct: baseTotalCost > 0 ? round2(decMul(decDiv(costVarianceToBaseline, baseTotalCost), 100)) : 0,
          revenueDifference: revenueVarianceToBaseline,
          profitDifference: profitVarianceToBaseline
        }
      };
    });

    return {
      projectId: proj.id,
      projectCode: proj.code,
      projectName: proj.name,
      clientName: proj.client_name,
      quotedPrice: round2(proj.quoted_price || 0),
      currency: proj.currency || 'USD',
      activePlanId: activePlanRow?.id || null,
      approvedPlanId: approvedPlanRow?.id || null,
      currentApprovedPlan: approvedPlanRow
        ? {
            id: approvedPlanRow.id,
            planNumber: approvedPlanRow.plan_number,
            name: approvedPlanRow.name,
            status: approvedPlanRow.status,
            versionLabel: approvedPlanRow.version_label,
            totalPlannedCost: round2(approvedPlanRow.total_planned_cost ?? 0),
            plannedRevenue: round2(approvedPlanRow.cs_planned_revenue ?? approvedPlanRow.planned_revenue ?? 0)
          }
        : null,
      rules: {
        inclusionRule: 'Project portfolio roll-ups and quote summaries use exclusively the Approved/Active plan.',
        alternativePlansIsolationRule:
          'Alternative plans (B, C, etc.) are maintained as independent trade scenarios and are NOT combined or summed into project portfolio totals.',
        childRecordLinkageRule:
          'Child records (BOQ line items, overhead allocations, resource assignments, and commercial rates) reference their specific planId with cascade protections.'
      },
      plans
    };
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

  // --- Audit Logs CRUD & Immutability (TASK 9) ---
  public async getAuditLogs(opts?: ListQueryOptions): Promise<any[]> {
    const res = await this.getAuditLogsPaginated(opts);
    return res.data;
  }

  public async getAuditLogsPaginated(opts?: ListQueryOptions): Promise<PaginatedResult<any>> {
    const db = await this.getDb();
    const page = Math.max(1, Number(opts?.page || 1));
    const limit = Math.max(1, Math.min(500, Number(opts?.limit || 50)));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (opts?.actorId && opts.actorId !== 'ALL') {
      conditions.push(`actor_id = $${paramIdx++}`);
      params.push(opts.actorId);
    }
    if (opts?.action && opts.action !== 'ALL') {
      conditions.push(`(action = $${paramIdx} OR action_type = $${paramIdx})`);
      paramIdx++;
      params.push(opts.action);
    }
    if (opts?.actionType && opts.actionType !== 'ALL') {
      conditions.push(`(action_type = $${paramIdx} OR action = $${paramIdx})`);
      paramIdx++;
      params.push(opts.actionType);
    }
    if (opts?.module && opts.module !== 'ALL') {
      conditions.push(`module = $${paramIdx++}`);
      params.push(opts.module);
    }
    if (opts?.entityType && opts.entityType !== 'ALL') {
      conditions.push(`entity_type = $${paramIdx++}`);
      params.push(opts.entityType);
    }
    if (opts?.entityId && opts.entityId !== 'ALL') {
      conditions.push(`(entity_id = $${paramIdx} OR record_id = $${paramIdx})`);
      paramIdx++;
      params.push(opts.entityId);
    }
    if (opts?.projectId && opts.projectId !== 'ALL') {
      conditions.push(`project_id = $${paramIdx++}`);
      params.push(opts.projectId);
    }
    if (opts?.planId && opts.planId !== 'ALL') {
      conditions.push(`plan_id = $${paramIdx++}`);
      params.push(opts.planId);
    }
    if (opts?.status && opts.status !== 'ALL') {
      conditions.push(`status = $${paramIdx++}`);
      params.push(opts.status);
    }
    if (opts?.fromDate) {
      conditions.push(`(timestamp >= $${paramIdx} OR created_at_ts >= $${paramIdx}::date)`);
      paramIdx++;
      params.push(opts.fromDate);
    }
    if (opts?.toDate) {
      conditions.push(`(timestamp <= ($${paramIdx} || ' 23:59:59') OR created_at_ts <= ($${paramIdx}::date + INTERVAL '1 day'))`);
      paramIdx++;
      params.push(opts.toDate);
    }
    if (opts?.search && opts.search.trim()) {
      const s = `%${opts.search.trim().toLowerCase()}%`;
      conditions.push(`(
        LOWER(action) LIKE $${paramIdx} OR
        LOWER(COALESCE(action_type, '')) LIKE $${paramIdx} OR
        LOWER(module) LIKE $${paramIdx} OR
        LOWER(COALESCE(entity_type, '')) LIKE $${paramIdx} OR
        LOWER(COALESCE(entity_id, '')) LIKE $${paramIdx} OR
        LOWER(COALESCE(record_name, '')) LIKE $${paramIdx} OR
        LOWER(COALESCE(actor_name, '')) LIKE $${paramIdx} OR
        LOWER(COALESCE(actor_id, '')) LIKE $${paramIdx} OR
        LOWER(COALESCE(details, '')) LIKE $${paramIdx} OR
        LOWER(COALESCE(change_reason, '')) LIKE $${paramIdx}
      )`);
      paramIdx++;
      params.push(s);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await db.query(`SELECT COUNT(*)::int as total FROM audit_logs ${whereSql}`, params);
    const total = Number(countRes.rows[0]?.total || 0);
    const totalPages = Math.ceil(total / limit) || 1;

    const dataQuery = `
      SELECT * FROM audit_logs
      ${whereSql}
      ORDER BY created_at_ts DESC, timestamp DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;
    const dataRes = await db.query(dataQuery, [...params, limit, offset]);

    const data = dataRes.rows.map((r: any) => ({
      id: r.id,
      timestamp: r.timestamp,
      createdAtTs: r.created_at_ts ? new Date(r.created_at_ts).toISOString() : r.timestamp,
      actorId: r.actor_id,
      actorName: r.actor_name,
      actorRole: r.actor_role,
      action: r.action,
      actionType: r.action_type || r.action,
      module: r.module,
      entityType: r.entity_type || r.module,
      entityId: r.entity_id || r.record_id,
      recordId: r.record_id || r.entity_id,
      recordName: r.record_name,
      projectId: r.project_id,
      planId: r.plan_id,
      requestId: r.request_id,
      correlationId: r.correlation_id,
      changeReason: r.change_reason,
      beforeState: typeof r.before_state === 'string' ? JSON.parse(r.before_state) : r.before_state,
      afterState: typeof r.after_state === 'string' ? JSON.parse(r.after_state) : r.after_state,
      diff: typeof r.diff === 'string' ? JSON.parse(r.diff) : r.diff,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata || {}),
      userAgent: r.user_agent,
      details: r.details,
      ipAddress: r.ip_address,
      status: r.status
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages
    };
  }

  public async createAuditLog(
    data: any,
    txQuery?: (sql: string, params?: any[]) => Promise<any>
  ): Promise<any> {
    const q = txQuery || (await this.getDb()).query.bind(await this.getDb());
    const id = data.id || `aud-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const timestamp = data.timestamp || new Date().toISOString();
    const actorId = String(data.actorId || 'usr-system');
    const actorName = String(data.actorName || 'System User');
    const actorRole = String(data.actorRole || 'ADMIN');
    const action = String(data.action || data.actionType || 'SYSTEM_EVENT');
    const actionType = String(data.actionType || action);
    const module = String(data.module || 'System');
    const entityType = String(data.entityType || module);
    const entityId = String(data.entityId || data.recordId || '');
    const recordId = data.recordId ? String(data.recordId) : entityId;
    const recordName = data.recordName ? String(data.recordName) : '';
    const projectId = data.projectId ? String(data.projectId) : null;
    const planId = data.planId ? String(data.planId) : null;
    const requestId = data.requestId ? String(data.requestId) : null;
    const correlationId = data.correlationId ? String(data.correlationId) : null;
    const changeReason = String(data.changeReason || data.reason || '');

    // Scrub sensitive credentials, keys, passwords, and tokens
    const sanitizeObj = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(sanitizeObj);
      const clean: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (/password|token|secret|mfa|auth|cookie|hash|salt|key/i.test(k)) {
          clean[k] = '[REDACTED]';
        } else if (v && typeof v === 'object') {
          clean[k] = sanitizeObj(v);
        } else {
          clean[k] = v;
        }
      }
      return clean;
    };

    const beforeState = data.beforeState ? sanitizeObj(data.beforeState) : null;
    const afterState = data.afterState ? sanitizeObj(data.afterState) : null;
    const diff = data.diff ? sanitizeObj(data.diff) : null;
    const metadata = data.metadata ? sanitizeObj(data.metadata) : {};
    const userAgent = String(data.userAgent || '');
    const details = typeof data.details === 'string' ? data.details : JSON.stringify(data.details || '');
    const ipAddress = String(data.ipAddress || '127.0.0.1');
    const status = String(data.status || 'Success');

    await q(
      `INSERT INTO audit_logs (
        id, timestamp, actor_id, actor_name, actor_role, action, action_type, module,
        entity_type, entity_id, record_id, record_name, project_id, plan_id,
        request_id, correlation_id, change_reason, before_state, after_state, diff,
        metadata, user_agent, details, ip_address, status, created_at_ts
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, NOW()
      ) ON CONFLICT (id) DO NOTHING`,
      [
        id,
        timestamp,
        actorId,
        actorName,
        actorRole,
        action,
        actionType,
        module,
        entityType,
        entityId,
        recordId,
        recordName,
        projectId,
        planId,
        requestId,
        correlationId,
        changeReason,
        beforeState ? JSON.stringify(beforeState) : null,
        afterState ? JSON.stringify(afterState) : null,
        diff ? JSON.stringify(diff) : null,
        JSON.stringify(metadata),
        userAgent,
        details,
        ipAddress,
        status
      ]
    );

    return {
      id,
      timestamp,
      actorId,
      actorName,
      actorRole,
      action,
      actionType,
      module,
      entityType,
      entityId,
      recordId,
      recordName,
      projectId,
      planId,
      requestId,
      correlationId,
      changeReason,
      beforeState,
      afterState,
      diff,
      metadata,
      userAgent,
      details,
      ipAddress,
      status
    };
  }

  // ============================================================================
  // ENTERPRISE TARIFF MANAGEMENT METHODS (TASK 9)
  // ============================================================================

  public async getTariffs(opts?: ListQueryOptions): Promise<PaginatedResult<any>> {
    const db = await this.getDb();
    const page = Math.max(1, Number(opts?.page || 1));
    const limit = Math.max(1, Math.min(200, Number(opts?.limit || 50)));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (opts?.category && opts.category !== 'ALL') {
      conditions.push(`LOWER(t.category) = LOWER($${paramIdx++})`);
      params.push(opts.category);
    }
    if (opts?.status && opts.status !== 'ALL') {
      conditions.push(`t.status = $${paramIdx++}`);
      params.push(opts.status);
    }
    if (opts?.calculationMethod && opts.calculationMethod !== 'ALL') {
      conditions.push(`t.calculation_method = $${paramIdx++}`);
      params.push(opts.calculationMethod);
    }
    if (opts?.applicableBase && opts.applicableBase !== 'ALL') {
      conditions.push(`t.applicable_base = $${paramIdx++}`);
      params.push(opts.applicableBase);
    }
    if (opts?.search && opts.search.trim()) {
      const s = `%${opts.search.trim().toLowerCase()}%`;
      conditions.push(`(
        LOWER(t.code) LIKE $${paramIdx} OR
        LOWER(t.name) LIKE $${paramIdx} OR
        LOWER(t.category) LIKE $${paramIdx} OR
        LOWER(COALESCE(t.description, '')) LIKE $${paramIdx} OR
        LOWER(COALESCE(t.source_reference, '')) LIKE $${paramIdx}
      )`);
      paramIdx++;
      params.push(s);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await db.query(`SELECT COUNT(*)::int as total FROM tariffs t ${whereSql}`, params);
    const total = Number(countRes.rows[0]?.total || 0);
    const totalPages = Math.ceil(total / limit) || 1;

    const query = `
      SELECT t.*,
        (SELECT COUNT(*)::int FROM tariff_versions tv WHERE tv.tariff_id = t.id) as versions_count,
        (SELECT COUNT(*)::int FROM plan_tariffs pt WHERE pt.tariff_id = t.id) as applied_plans_count
      FROM tariffs t
      ${whereSql}
      ORDER BY t.created_at DESC, t.code ASC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;

    const dataRes = await db.query(query, [...params, limit, offset]);

    const data = await Promise.all(
      dataRes.rows.map(async (r: any) => {
        // Fetch current active version
        const curVerRes = await db.query(
          `SELECT * FROM tariff_versions
           WHERE tariff_id = $1 AND status = 'Active'
           ORDER BY effective_from DESC, version_number DESC LIMIT 1`,
          [r.id]
        );
        const curVer = curVerRes.rows[0] || null;

        return {
          id: r.id,
          code: r.code,
          name: r.name,
          category: r.category,
          calculationMethod: r.calculation_method,
          rateOrPercentage: Number(r.rate_or_percentage || 0),
          fixedCharge: Number(r.fixed_charge || 0),
          unit: r.unit,
          applicableBase: r.applicable_base,
          currency: r.currency || 'LKR',
          scopeType: r.scope_type || 'general',
          scopeTargetId: r.scope_target_id || '',
          scopeTargetName: r.scope_target_name || '',
          effectiveFrom: r.effective_from ? String(r.effective_from).slice(0, 10) : '',
          effectiveTo: r.effective_to ? String(r.effective_to).slice(0, 10) : null,
          status: r.status,
          sourceReference: r.source_reference || '',
          description: r.description || '',
          notes: r.notes || '',
          createdBy: r.created_by,
          updatedBy: r.updated_by,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
          versionsCount: Number(r.versions_count || 1),
          appliedPlansCount: Number(r.applied_plans_count || 0),
          currentVersion: curVer ? {
            id: curVer.id,
            tariffId: curVer.tariff_id,
            tariffCode: curVer.tariff_code,
            versionNumber: Number(curVer.version_number),
            rateOrPercentage: Number(curVer.rate_or_percentage || 0),
            fixedCharge: Number(curVer.fixed_charge || 0),
            calculationMethod: curVer.calculation_method,
            applicableBase: curVer.applicable_base,
            unit: curVer.unit,
            currency: curVer.currency || 'LKR',
            scopeType: curVer.scope_type || r.scope_type || 'general',
            scopeTargetId: curVer.scope_target_id || '',
            scopeTargetName: curVer.scope_target_name || '',
            effectiveFrom: curVer.effective_from ? String(curVer.effective_from).slice(0, 10) : '',
            effectiveTo: curVer.effective_to ? String(curVer.effective_to).slice(0, 10) : null,
            status: curVer.status,
            sourceReference: curVer.source_reference,
            changeReason: curVer.change_reason,
            notes: curVer.notes,
            createdBy: curVer.created_by,
            createdAt: curVer.created_at ? new Date(curVer.created_at).toISOString() : new Date().toISOString()
          } : undefined
        };
      })
    );

    return {
      data,
      total,
      page,
      limit,
      totalPages
    };
  }

  public async getTariffById(id: string): Promise<any | null> {
    const db = await this.getDb();
    const tRes = await db.query('SELECT * FROM tariffs WHERE id = $1 OR code = $1', [id]);
    if (tRes.rows.length === 0) return null;
    const r = tRes.rows[0];

    const vRes = await db.query(
      'SELECT * FROM tariff_versions WHERE tariff_id = $1 ORDER BY version_number DESC, effective_from DESC',
      [r.id]
    );

    const versions = vRes.rows.map((v: any) => ({
      id: v.id,
      tariffId: v.tariff_id,
      tariffCode: v.tariff_code,
      versionNumber: Number(v.version_number),
      rateOrPercentage: Number(v.rate_or_percentage || 0),
      fixedCharge: Number(v.fixed_charge || 0),
      calculationMethod: v.calculation_method,
      applicableBase: v.applicable_base,
      unit: v.unit,
      currency: v.currency || 'LKR',
      scopeType: v.scope_type || r.scope_type || 'general',
      scopeTargetId: v.scope_target_id || '',
      scopeTargetName: v.scope_target_name || '',
      effectiveFrom: v.effective_from ? String(v.effective_from).slice(0, 10) : '',
      effectiveTo: v.effective_to ? String(v.effective_to).slice(0, 10) : null,
      status: v.status,
      sourceReference: v.source_reference || '',
      changeReason: v.change_reason || '',
      notes: v.notes || '',
      createdBy: v.created_by,
      createdAt: v.created_at ? new Date(v.created_at).toISOString() : new Date().toISOString()
    }));

    const appliedRes = await db.query('SELECT COUNT(*)::int as cnt FROM plan_tariffs WHERE tariff_id = $1', [r.id]);

    return {
      id: r.id,
      code: r.code,
      name: r.name,
      category: r.category,
      calculationMethod: r.calculation_method,
      rateOrPercentage: Number(r.rate_or_percentage || 0),
      fixedCharge: Number(r.fixed_charge || 0),
      unit: r.unit,
      applicableBase: r.applicable_base,
      currency: r.currency || 'LKR',
      scopeType: r.scope_type || 'general',
      scopeTargetId: r.scope_target_id || '',
      scopeTargetName: r.scope_target_name || '',
      effectiveFrom: r.effective_from ? String(r.effective_from).slice(0, 10) : '',
      effectiveTo: r.effective_to ? String(r.effective_to).slice(0, 10) : null,
      status: r.status,
      sourceReference: r.source_reference || '',
      description: r.description || '',
      notes: r.notes || '',
      createdBy: r.created_by,
      updatedBy: r.updated_by,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
      versionsCount: versions.length,
      appliedPlansCount: Number(appliedRes.rows[0]?.cnt || 0),
      versions,
      currentVersion: versions[0] || null
    };
  }

  public async createTariff(data: any, actor?: { id?: string; name?: string; role?: string }): Promise<any> {
    return this.withTransaction(async (q) => {
      const id = data.id || `trf-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      const code = String(data.code || `TRF-${Date.now().toString().slice(-6)}`).trim().toUpperCase();
      const name = String(data.name || '').trim();
      if (!name) {
        throw Object.assign(new Error('Tariff name is required'), { status: 400 });
      }

      // Check code uniqueness
      const dup = await q('SELECT id FROM tariffs WHERE code = $1', [code]);
      if (dup.rows.length > 0) {
        throw Object.assign(new Error(`Tariff code '${code}' already exists`), { status: 409 });
      }

      const category = String(data.category || 'Surface Finishing').trim();
      const calculationMethod = String(data.calculationMethod || 'percentage');
      const rateOrPercentage = round4(Number(data.rateOrPercentage ?? data.rate ?? 0));
      const fixedCharge = round4(Number(data.fixedCharge ?? 0));
      const unit = String(data.unit || '%').trim();
      const applicableBase = String(data.applicableBase || 'material_cost');
      const currency = String(data.currency || 'LKR');
      const scopeType = String(data.scopeType || data.scope || 'general');
      const scopeTargetId = String(data.scopeTargetId || '');
      const scopeTargetName = String(data.scopeTargetName || '');
      const todayIso = new Date().toISOString().slice(0, 10);
      const effectiveFrom = formatSqlDate(data.effectiveFrom, todayIso);
      const effectiveTo = data.effectiveTo ? formatSqlDate(data.effectiveTo, '') : null;
      const status = String(data.status || 'Active');
      const sourceReference = String(data.sourceReference || '');
      const description = String(data.description || '');
      const notes = String(data.notes || '');
      const actorName = actor?.name || 'System User';
      const actorId = actor?.id || 'usr-system';
      const actorRole = actor?.role || 'PROJECT_MANAGER';

      // 1. Insert master tariff record
      await q(
        `INSERT INTO tariffs (
          id, code, name, category, calculation_method, rate_or_percentage, fixed_charge,
          unit, applicable_base, currency, scope_type, scope_target_id, scope_target_name,
          effective_from, effective_to, status,
          source_reference, description, notes, created_by, updated_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13,
          $14::date, $15::date, $16,
          $17, $18, $19, $20, $21, NOW(), NOW()
        )`,
        [
          id, code, name, category, calculationMethod, rateOrPercentage, fixedCharge,
          unit, applicableBase, currency, scopeType, scopeTargetId, scopeTargetName,
          effectiveFrom, effectiveTo, status,
          sourceReference, description, notes, actorName, actorName
        ]
      );

      // 2. Insert initial version 1
      const versionId = `trfv-${id}-v1`;
      await q(
        `INSERT INTO tariff_versions (
          id, tariff_id, tariff_code, version_number, rate_or_percentage, fixed_charge,
          calculation_method, applicable_base, unit, currency, scope_type, scope_target_id, scope_target_name,
          effective_from, effective_to, status, source_reference, change_reason, notes, created_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, 1, $4, $5,
          $6, $7, $8, $9, $10, $11, $12,
          $13::date, $14::date,
          'Active', $15, $16, $17, $18, NOW(), NOW()
        )`,
        [
          versionId, id, code, rateOrPercentage, fixedCharge,
          calculationMethod, applicableBase, unit, currency, scopeType, scopeTargetId, scopeTargetName,
          effectiveFrom, effectiveTo,
          sourceReference, data.changeReason || 'Initial baseline tariff version', notes, actorName
        ]
      );

      // 3. Record audit log in same transaction
      const auditLogId = `aud-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await q(
        `INSERT INTO audit_logs (
          id, timestamp, actor_id, actor_name, actor_role, action, action_type, module,
          entity_type, entity_id, record_id, record_name, change_reason, after_state, details, ip_address, status, created_at_ts
        ) VALUES (
          $1, $2, $3, $4, $5, 'CREATE_TARIFF', 'CREATE_TARIFF', 'Tariffs',
          'Tariff', $6, $6, $7, $8, $9, $10, '127.0.0.1', 'Success', NOW()
        )`,
        [
          auditLogId,
          new Date().toISOString(),
          actorId,
          actorName,
          actorRole,
          id,
          name,
          data.changeReason || 'Created enterprise tariff definition',
          JSON.stringify({ code, name, category, calculationMethod, rateOrPercentage, fixedCharge, currency, scopeType, effectiveFrom, effectiveTo }),
          `Created tariff schedule '${code}' - ${name} (${rateOrPercentage} ${unit}, ${currency}, scope: ${scopeType})`
        ]
      );

      return {
        id,
        code,
        name,
        category,
        calculationMethod,
        rateOrPercentage,
        fixedCharge,
        unit,
        applicableBase,
        currency,
        scopeType,
        scopeTargetId,
        scopeTargetName,
        effectiveFrom,
        effectiveTo,
        status,
        sourceReference,
        description,
        notes,
        createdBy: actorName,
        updatedBy: actorName,
        versionsCount: 1
      };
    });
  }

  public async updateTariff(id: string, data: any, actor?: { id?: string; name?: string; role?: string }): Promise<any> {
    return this.withTransaction(async (q) => {
      const curRes = await q('SELECT * FROM tariffs WHERE id = $1 FOR UPDATE', [id]);
      if (curRes.rows.length === 0) {
        throw Object.assign(new Error(`Tariff '${id}' not found`), { status: 404 });
      }
      const existing = curRes.rows[0];

      const name = data.name !== undefined ? String(data.name).trim() : existing.name;
      const category = data.category !== undefined ? String(data.category).trim() : existing.category;
      const description = data.description !== undefined ? String(data.description) : (existing.description || '');
      const status = data.status !== undefined ? String(data.status) : existing.status;
      const sourceReference = data.sourceReference !== undefined ? String(data.sourceReference) : (existing.source_reference || '');
      const notes = data.notes !== undefined ? String(data.notes) : (existing.notes || '');

      const calculationMethod = data.calculationMethod !== undefined ? String(data.calculationMethod) : existing.calculation_method;
      const rateOrPercentage = data.rateOrPercentage !== undefined ? round4(Number(data.rateOrPercentage)) : Number(existing.rate_or_percentage);
      const fixedCharge = data.fixedCharge !== undefined ? round4(Number(data.fixedCharge)) : Number(existing.fixed_charge || 0);
      const unit = data.unit !== undefined ? String(data.unit) : existing.unit;
      const applicableBase = data.applicableBase !== undefined ? String(data.applicableBase) : existing.applicable_base;
      const currency = data.currency !== undefined ? String(data.currency) : (existing.currency || 'LKR');
      const scopeType = data.scopeType !== undefined ? String(data.scopeType) : (existing.scope_type || 'general');
      const scopeTargetId = data.scopeTargetId !== undefined ? String(data.scopeTargetId) : (existing.scope_target_id || '');
      const scopeTargetName = data.scopeTargetName !== undefined ? String(data.scopeTargetName) : (existing.scope_target_name || '');
      const effectiveFrom = data.effectiveFrom !== undefined ? formatSqlDate(data.effectiveFrom, String(existing.effective_from).slice(0, 10)) : String(existing.effective_from).slice(0, 10);
      const effectiveTo = data.effectiveTo !== undefined ? (data.effectiveTo ? formatSqlDate(data.effectiveTo, '') : null) : existing.effective_to;

      const actorName = actor?.name || 'System User';
      const actorId = actor?.id || 'usr-system';
      const actorRole = actor?.role || 'PROJECT_MANAGER';

      await q(
        `UPDATE tariffs SET
          name = $1, category = $2, description = $3, status = $4,
          source_reference = $5, notes = $6, calculation_method = $7,
          rate_or_percentage = $8, fixed_charge = $9, unit = $10,
          applicable_base = $11, currency = $12, scope_type = $13,
          scope_target_id = $14, scope_target_name = $15,
          effective_from = $16::date, effective_to = $17::date,
          updated_by = $18, updated_at = NOW()
         WHERE id = $19`,
        [
          name, category, description, status,
          sourceReference, notes, calculationMethod,
          rateOrPercentage, fixedCharge, unit,
          applicableBase, currency, scopeType,
          scopeTargetId, scopeTargetName,
          effectiveFrom, effectiveTo,
          actorName, id
        ]
      );

      // Sync latest version in tariff_versions
      const latestVerRes = await q('SELECT id FROM tariff_versions WHERE tariff_id = $1 ORDER BY version_number DESC LIMIT 1', [id]);
      if (latestVerRes.rows.length > 0) {
        await q(
          `UPDATE tariff_versions SET
            rate_or_percentage = $1, fixed_charge = $2, calculation_method = $3,
            applicable_base = $4, unit = $5, currency = $6, scope_type = $7,
            scope_target_id = $8, scope_target_name = $9,
            effective_from = $10::date, effective_to = $11::date, status = $12,
            source_reference = $13, notes = $14, updated_at = NOW()
           WHERE id = $15`,
          [
            rateOrPercentage, fixedCharge, calculationMethod,
            applicableBase, unit, currency, scopeType,
            scopeTargetId, scopeTargetName,
            effectiveFrom, effectiveTo, status,
            sourceReference, notes, latestVerRes.rows[0].id
          ]
        );
      }

      // Record audit event in same transaction
      const auditLogId = `aud-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await q(
        `INSERT INTO audit_logs (
          id, timestamp, actor_id, actor_name, actor_role, action, action_type, module,
          entity_type, entity_id, record_id, record_name, change_reason, before_state, after_state, details, ip_address, status, created_at_ts
        ) VALUES (
          $1, $2, $3, $4, $5, 'UPDATE_TARIFF', 'UPDATE_TARIFF', 'Tariffs',
          'Tariff', $6, $6, $7, $8, $9, $10, $11, '127.0.0.1', 'Success', NOW()
        )`,
        [
          auditLogId,
          new Date().toISOString(),
          actorId,
          actorName,
          actorRole,
          id,
          name,
          data.changeReason || 'Updated tariff master definition',
          JSON.stringify({ name: existing.name, rate: existing.rate_or_percentage, currency: existing.currency, status: existing.status }),
          JSON.stringify({ name, rate: rateOrPercentage, currency, status, scopeType }),
          `Updated tariff schedule '${existing.code}': rate ${existing.rate_or_percentage} -> ${rateOrPercentage} (${currency}, scope: ${scopeType})`
        ]
      );

      return {
        id,
        code: existing.code,
        name,
        category,
        calculationMethod,
        rateOrPercentage,
        fixedCharge,
        unit,
        applicableBase,
        currency,
        scopeType,
        scopeTargetId,
        scopeTargetName,
        effectiveFrom,
        effectiveTo,
        status,
        description,
        sourceReference,
        notes,
        updatedBy: actorName
      };
    });
  }

  public async deleteTariff(id: string, actor?: { id?: string; name?: string; role?: string }): Promise<boolean> {
    return this.withTransaction(async (q) => {
      const curRes = await q('SELECT * FROM tariffs WHERE id = $1 FOR UPDATE', [id]);
      if (curRes.rows.length === 0) return false;
      const existing = curRes.rows[0];

      await q('DELETE FROM plan_tariffs WHERE tariff_id = $1', [id]);
      await q('DELETE FROM tariff_versions WHERE tariff_id = $1', [id]);
      await q('DELETE FROM tariffs WHERE id = $1', [id]);

      const actorName = actor?.name || 'System User';
      const actorId = actor?.id || 'usr-system';
      const actorRole = actor?.role || 'PROJECT_MANAGER';
      const auditLogId = `aud-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      await q(
        `INSERT INTO audit_logs (
          id, timestamp, actor_id, actor_name, actor_role, action, action_type, module,
          entity_type, entity_id, record_id, record_name, change_reason, details, ip_address, status, created_at_ts
        ) VALUES (
          $1, $2, $3, $4, $5, 'DELETE_TARIFF', 'DELETE_TARIFF', 'Tariffs',
          'Tariff', $6, $6, $7, 'Deleted tariff schedule from database', $8, '127.0.0.1', 'Success', NOW()
        )`,
        [
          auditLogId,
          new Date().toISOString(),
          actorId,
          actorName,
          actorRole,
          id,
          existing.name,
          `Deleted tariff schedule '${existing.code}' - ${existing.name}`
        ]
      );

      return true;
    });
  }

  public async deleteTariffVersion(
    tariffId: string,
    versionId: string,
    actor?: { id?: string; name?: string; role?: string }
  ): Promise<boolean> {
    return this.withTransaction(async (q) => {
      const vRes = await q('SELECT * FROM tariff_versions WHERE id = $1 AND tariff_id = $2 FOR UPDATE', [versionId, tariffId]);
      if (vRes.rows.length === 0) return false;
      const ver = vRes.rows[0];

      const countRes = await q('SELECT COUNT(*)::int as cnt FROM tariff_versions WHERE tariff_id = $1', [tariffId]);
      if (Number(countRes.rows[0]?.cnt || 0) <= 1) {
        throw Object.assign(new Error('Cannot delete the only remaining version of a tariff schedule. Delete the entire tariff instead.'), { status: 400 });
      }

      await q('DELETE FROM tariff_versions WHERE id = $1', [versionId]);

      const latestRes = await q('SELECT * FROM tariff_versions WHERE tariff_id = $1 ORDER BY version_number DESC LIMIT 1', [tariffId]);
      if (latestRes.rows.length > 0) {
        const latest = latestRes.rows[0];
        await q(
          `UPDATE tariffs SET
            rate_or_percentage = $1, fixed_charge = $2, calculation_method = $3,
            applicable_base = $4, unit = $5, effective_from = $6::date, effective_to = $7::date,
            updated_at = NOW()
           WHERE id = $8`,
          [latest.rate_or_percentage, latest.fixed_charge, latest.calculation_method, latest.applicable_base, latest.unit, latest.effective_from, latest.effective_to, tariffId]
        );
      }

      const actorName = actor?.name || 'System User';
      const actorId = actor?.id || 'usr-system';
      const actorRole = actor?.role || 'PROJECT_MANAGER';
      const auditLogId = `aud-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      await q(
        `INSERT INTO audit_logs (
          id, timestamp, actor_id, actor_name, actor_role, action, action_type, module,
          entity_type, entity_id, record_id, record_name, change_reason, details, ip_address, status, created_at_ts
        ) VALUES (
          $1, $2, $3, $4, $5, 'DELETE_TARIFF_VERSION', 'DELETE_TARIFF_VERSION', 'Tariffs',
          'TariffVersion', $6, $6, $7, 'Deleted tariff version', $8, '127.0.0.1', 'Success', NOW()
        )`,
        [
          auditLogId,
          new Date().toISOString(),
          actorId,
          actorName,
          actorRole,
          versionId,
          `Version ${ver.version_number}`,
          `Deleted version v${ver.version_number} of tariff schedule ${ver.tariff_code}`
        ]
      );

      return true;
    });
  }

  /**
   * Create a new historical Tariff Version (Requirements 15, 16, 17, 18).
   * Does NOT overwrite past rates. Retains all versions for historical audit.
   */
  public async createTariffVersion(
    tariffId: string,
    data: any,
    actor?: { id?: string; name?: string; role?: string }
  ): Promise<any> {
    return this.withTransaction(async (q) => {
      const curRes = await q('SELECT * FROM tariffs WHERE id = $1 FOR UPDATE', [tariffId]);
      if (curRes.rows.length === 0) {
        throw Object.assign(new Error(`Tariff '${tariffId}' not found`), { status: 404 });
      }
      const tariff = curRes.rows[0];

      // Find max version number
      const vCountRes = await q(
        'SELECT COALESCE(MAX(version_number), 0) as max_v FROM tariff_versions WHERE tariff_id = $1',
        [tariffId]
      );
      const nextVersionNumber = Number(vCountRes.rows[0]?.max_v || 0) + 1;

      // Find previous active version
      const prevVerRes = await q(
        `SELECT * FROM tariff_versions WHERE tariff_id = $1 ORDER BY version_number DESC LIMIT 1`,
        [tariffId]
      );
      const prevVer = prevVerRes.rows[0] || null;

      const rateOrPercentage = round4(Number(data.rateOrPercentage ?? data.rate ?? tariff.rate_or_percentage ?? 0));
      const fixedCharge = round4(Number(data.fixedCharge ?? tariff.fixed_charge ?? 0));
      const calculationMethod = String(data.calculationMethod || tariff.calculation_method || 'percentage');
      const applicableBase = String(data.applicableBase || tariff.applicable_base || 'material_cost');
      const unit = String(data.unit || tariff.unit || 'unit');
      const currency = String(data.currency || tariff.currency || 'USD');
      const todayIso = new Date().toISOString().slice(0, 10);
      const effectiveFrom = formatSqlDate(data.effectiveFrom, todayIso);
      const effectiveTo = data.effectiveTo ? formatSqlDate(data.effectiveTo, '') : null;
      const status = String(data.status || 'Active');
      const sourceReference = String(data.sourceReference || tariff.source_reference || '');
      const changeReason = String(data.changeReason || `New tariff version ${nextVersionNumber} schedule adjustment`);
      const notes = String(data.notes || '');
      const actorName = actor?.name || 'System User';
      const actorId = actor?.id || 'usr-system';
      const actorRole = actor?.role || 'PROJECT_MANAGER';

      // If previous version was open-ended (effective_to is null) and earlier than new effectiveFrom,
      // close previous version effective_to to the day before new effectiveFrom (Requirement 17, 18)
      if (prevVer && !prevVer.effective_to && effectiveFrom > String(prevVer.effective_from).slice(0, 10)) {
        const fromDateObj = new Date(effectiveFrom);
        fromDateObj.setDate(fromDateObj.getDate() - 1);
        const dayBefore = fromDateObj.toISOString().slice(0, 10);
        await q(
          'UPDATE tariff_versions SET effective_to = $1::date, updated_at = NOW() WHERE id = $2',
          [dayBefore, prevVer.id]
        );
      }

      const versionId = `trfv-${tariffId}-v${nextVersionNumber}-${Date.now()}`;
      await q(
        `INSERT INTO tariff_versions (
          id, tariff_id, tariff_code, version_number, rate_or_percentage, fixed_charge,
          calculation_method, applicable_base, unit, currency, effective_from, effective_to,
          status, source_reference, change_reason, notes, created_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11::date, $12::date,
          $13, $14, $15, $16, $17, NOW(), NOW()
        )`,
        [
          versionId, tariffId, tariff.code, nextVersionNumber, rateOrPercentage, fixedCharge,
          calculationMethod, applicableBase, unit, currency, effectiveFrom, effectiveTo,
          status, sourceReference, changeReason, notes, actorName
        ]
      );

      // Update current rates on master tariff
      await q(
        `UPDATE tariffs SET
          rate_or_percentage = $1, fixed_charge = $2, calculation_method = $3,
          applicable_base = $4, unit = $5, effective_from = $6::date, effective_to = $7::date,
          updated_by = $8, updated_at = NOW()
         WHERE id = $9`,
        [
          rateOrPercentage, fixedCharge, calculationMethod,
          applicableBase, unit, effectiveFrom, effectiveTo,
          actorName, tariffId
        ]
      );

      // Record audit log in same transaction (Requirement 4, 9, 15)
      const auditLogId = `aud-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await q(
        `INSERT INTO audit_logs (
          id, timestamp, actor_id, actor_name, actor_role, action, action_type, module,
          entity_type, entity_id, record_id, record_name, change_reason, before_state, after_state, diff, details, ip_address, status, created_at_ts
        ) VALUES (
          $1, $2, $3, $4, $5, 'CREATE_TARIFF_VERSION', 'CREATE_TARIFF_VERSION', 'Tariffs',
          'TariffVersion', $6, $6, $7, $8, $9, $10, $11, $12, '127.0.0.1', 'Success', NOW()
        )`,
        [
          auditLogId,
          new Date().toISOString(),
          actorId,
          actorName,
          actorRole,
          versionId,
          `${tariff.name} (v${nextVersionNumber})`,
          changeReason,
          prevVer ? JSON.stringify({
            versionNumber: prevVer.version_number,
            rateOrPercentage: Number(prevVer.rate_or_percentage),
            effectiveFrom: String(prevVer.effective_from).slice(0, 10),
            effectiveTo: prevVer.effective_to ? String(prevVer.effective_to).slice(0, 10) : null
          }) : null,
          JSON.stringify({
            versionNumber: nextVersionNumber,
            rateOrPercentage,
            fixedCharge,
            effectiveFrom,
            effectiveTo,
            calculationMethod
          }),
          JSON.stringify({
            previousRate: prevVer ? Number(prevVer.rate_or_percentage) : null,
            newRate: rateOrPercentage,
            changePct: prevVer && Number(prevVer.rate_or_percentage) > 0 ? round2(((rateOrPercentage - Number(prevVer.rate_or_percentage)) / Number(prevVer.rate_or_percentage)) * 100) : null
          }),
          `Created tariff version v${nextVersionNumber} for ${tariff.code}: rate ${prevVer ? prevVer.rate_or_percentage : 'None'} -> ${rateOrPercentage} (Effective: ${effectiveFrom})`
        ]
      );

      return {
        id: versionId,
        tariffId,
        tariffCode: tariff.code,
        versionNumber: nextVersionNumber,
        rateOrPercentage,
        fixedCharge,
        calculationMethod,
        applicableBase,
        unit,
        currency,
        effectiveFrom,
        effectiveTo,
        status,
        sourceReference,
        changeReason,
        notes,
        createdBy: actorName
      };
    });
  }

  /**
   * Resolve appropriate tariff version based on effective date and business rules (Requirements 17, 18)
   */
  public async resolveTariffVersion(
    tariffId: string,
    targetDate?: string,
    queryRunner?: (sql: string, params?: any[]) => Promise<{ rows: any[] }>
  ): Promise<any | null> {
    const db = await this.getDb();
    const qFn = queryRunner || ((sql: string, params?: any[]) => (db as any).query(sql, params));
    const dateStr = formatSqlDate(targetDate, new Date().toISOString().slice(0, 10));

    // 1. Look for active version that encloses the target date:
    // effective_from <= dateStr AND (effective_to IS NULL OR effective_to >= dateStr)
    const activeRes = await qFn(
      `SELECT tv.*, t.name as tariff_name, t.category as tariff_category
       FROM tariff_versions tv
       JOIN tariffs t ON t.id = tv.tariff_id
       WHERE (tv.tariff_id = $1 OR tv.tariff_code = $1)
         AND tv.status = 'Active'
         AND tv.effective_from <= $2::date
         AND (tv.effective_to IS NULL OR tv.effective_to >= $2::date)
       ORDER BY tv.effective_from DESC, tv.version_number DESC
       LIMIT 1`,
      [tariffId, dateStr]
    );

    if (activeRes.rows.length > 0) {
      const r = activeRes.rows[0];
      return {
        id: r.id,
        tariffId: r.tariff_id,
        tariffCode: r.tariff_code,
        tariffName: r.tariff_name,
        tariffCategory: r.tariff_category,
        versionNumber: Number(r.version_number),
        rateOrPercentage: Number(r.rate_or_percentage || 0),
        fixedCharge: Number(r.fixed_charge || 0),
        calculationMethod: r.calculation_method,
        applicableBase: r.applicable_base,
        unit: r.unit,
        currency: r.currency,
        effectiveFrom: formatSqlDate(r.effective_from),
        effectiveTo: r.effective_to ? formatSqlDate(r.effective_to) : null,
        status: r.status,
        resolvedDate: dateStr,
        matchType: 'exact_effective_range'
      };
    }

    // 2. Fall back to the most recent version effective on or before dateStr
    const fallbackRes = await qFn(
      `SELECT tv.*, t.name as tariff_name, t.category as tariff_category
       FROM tariff_versions tv
       JOIN tariffs t ON t.id = tv.tariff_id
       WHERE (tv.tariff_id = $1 OR tv.tariff_code = $1)
         AND tv.effective_from <= $2::date
       ORDER BY tv.effective_from DESC, tv.version_number DESC
       LIMIT 1`,
      [tariffId, dateStr]
    );

    if (fallbackRes.rows.length > 0) {
      const r = fallbackRes.rows[0];
      return {
        id: r.id,
        tariffId: r.tariff_id,
        tariffCode: r.tariff_code,
        tariffName: r.tariff_name,
        tariffCategory: r.tariff_category,
        versionNumber: Number(r.version_number),
        rateOrPercentage: Number(r.rate_or_percentage || 0),
        fixedCharge: Number(r.fixed_charge || 0),
        calculationMethod: r.calculation_method,
        applicableBase: r.applicable_base,
        unit: r.unit,
        currency: r.currency,
        effectiveFrom: formatSqlDate(r.effective_from),
        effectiveTo: r.effective_to ? formatSqlDate(r.effective_to) : null,
        status: r.status,
        resolvedDate: dateStr,
        matchType: 'prior_effective_version'
      };
    }

    // 3. Last fallback: latest available version
    const latestRes = await qFn(
      `SELECT tv.*, t.name as tariff_name, t.category as tariff_category
       FROM tariff_versions tv
       JOIN tariffs t ON t.id = tv.tariff_id
       WHERE tv.tariff_id = $1 OR tv.tariff_code = $1
       ORDER BY tv.version_number DESC LIMIT 1`,
      [tariffId]
    );

    if (latestRes.rows.length > 0) {
      const r = latestRes.rows[0];
      return {
        id: r.id,
        tariffId: r.tariff_id,
        tariffCode: r.tariff_code,
        tariffName: r.tariff_name,
        tariffCategory: r.tariff_category,
        versionNumber: Number(r.version_number),
        rateOrPercentage: Number(r.rate_or_percentage || 0),
        fixedCharge: Number(r.fixed_charge || 0),
        calculationMethod: r.calculation_method,
        applicableBase: r.applicable_base,
        unit: r.unit,
        currency: r.currency,
        effectiveFrom: formatSqlDate(r.effective_from),
        effectiveTo: r.effective_to ? formatSqlDate(r.effective_to) : null,
        status: r.status,
        resolvedDate: dateStr,
        matchType: 'latest_fallback'
      };
    }

    return null;
  }

  /**
   * Get all tariffs applied to a specific project plan (Requirements 19, 20)
   */
  public async getPlanTariffs(planId: string): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query(
      `SELECT pt.*, t.name as current_tariff_name
       FROM plan_tariffs pt
       LEFT JOIN tariffs t ON t.id = pt.tariff_id
       WHERE pt.plan_id = $1
       ORDER BY pt.created_at ASC`,
      [planId]
    );

    return res.rows.map((r: any) => ({
      id: r.id,
      planId: r.plan_id,
      projectId: r.project_id,
      tariffId: r.tariff_id,
      tariffVersionId: r.tariff_version_id,
      tariffCode: r.tariff_code,
      tariffName: r.tariff_name,
      tariffCategory: r.tariff_category,
      calculationMethod: r.calculation_method,
      applicableBase: r.applicable_base,
      rateOrPercentage: Number(r.rate_or_percentage || 0),
      fixedCharge: Number(r.fixed_charge || 0),
      unit: r.unit,
      currency: r.currency || 'USD',
      effectiveFrom: r.effective_from ? String(r.effective_from).slice(0, 10) : '',
      effectiveTo: r.effective_to ? String(r.effective_to).slice(0, 10) : null,
      baseAmount: Number(r.base_amount || 0),
      calculatedTariffAmount: Number(r.calculated_tariff_amount || 0),
      appliedDate: r.applied_date ? String(r.applied_date).slice(0, 10) : '',
      appliedBy: r.applied_by,
      notes: r.notes || '',
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
    }));
  }

  /**
   * Apply an explicit tariff to a project plan (Requirements 19, 20)
   * Records the exact tariff version, calculation parameters, and values used.
   */
  public async applyTariffToPlan(
    planId: string,
    data: any,
    actor?: { id?: string; name?: string; role?: string }
  ): Promise<any> {
    return this.withTransaction(async (q) => {
      // 1. Verify plan exists
      const planRes = await q('SELECT * FROM project_plans WHERE id = $1 FOR UPDATE', [planId]);
      if (planRes.rows.length === 0) {
        throw Object.assign(new Error(`Project plan '${planId}' not found`), { status: 404 });
      }
      const plan = planRes.rows[0];
      const projectId = plan.project_id;

      // 2. Resolve tariff version based on effective date
      const tariffId = data.tariffId;
      if (!tariffId) {
        throw Object.assign(new Error('tariffId is required to apply a tariff'), { status: 400 });
      }

      const targetDate = formatSqlDate(data.effectiveDate || data.appliedDate || plan.effective_date, new Date().toISOString().slice(0, 10));
      const resolvedVersion = await this.resolveTariffVersion(tariffId, targetDate, q);
      if (!resolvedVersion) {
        throw Object.assign(new Error(`No active tariff version found for '${tariffId}' on date '${targetDate}'`), { status: 404 });
      }

      // 3. Calculate base amount according to applicable_base
      let baseAmount = 0;
      if (data.baseAmount !== undefined && Number(data.baseAmount) >= 0) {
        baseAmount = round2(Number(data.baseAmount));
      } else {
        // Compute dynamically from plan items
        const applicableBase = resolvedVersion.applicableBase;
        if (applicableBase === 'material_cost') {
          const matRes = await q(
            `SELECT COALESCE(SUM(total_cost), 0) as total FROM project_plan_boq_items
             WHERE plan_id = $1 AND (LOWER(category) LIKE '%material%' OR item_type = 'material')`,
            [planId]
          );
          baseAmount = round2(Number(matRes.rows[0]?.total || 0));
        } else if (applicableBase === 'labour_cost') {
          const labRes = await q(
            `SELECT COALESCE(SUM(total_cost), 0) as total FROM project_plan_boq_items
             WHERE plan_id = $1 AND (LOWER(category) LIKE '%subcontract%' OR LOWER(category) LIKE '%labour%' OR item_type = 'subcontractor')`,
            [planId]
          );
          baseAmount = round2(Number(labRes.rows[0]?.total || 0));
        } else if (applicableBase === 'outsourced_cost') {
          const outRes = await q(
            `SELECT COALESCE(SUM(total_cost), 0) as total FROM project_plan_boq_items
             WHERE plan_id = $1 AND (LOWER(category) LIKE '%outsourced%' OR item_type = 'outsourced')`,
            [planId]
          );
          baseAmount = round2(Number(outRes.rows[0]?.total || 0));
        } else if (applicableBase === 'total_direct_cost') {
          const dirRes = await q('SELECT COALESCE(SUM(total_cost), 0) as total FROM project_plan_boq_items WHERE plan_id = $1', [planId]);
          baseAmount = round2(Number(dirRes.rows[0]?.total || 0));
        } else if (applicableBase === 'total_revenue') {
          baseAmount = round2(Number(plan.planned_revenue || 0));
        } else if (applicableBase === 'quantity') {
          baseAmount = round2(Number(data.quantity || 1));
        }
      }

      // 4. Calculate tariff cost
      let calculatedTariffAmount = 0;
      const rate = resolvedVersion.rateOrPercentage;
      const fixedCharge = resolvedVersion.fixedCharge || 0;

      if (resolvedVersion.calculationMethod === 'percentage') {
        calculatedTariffAmount = round2(decAdd(decMul(baseAmount, decDiv(rate, 100)), fixedCharge));
      } else if (resolvedVersion.calculationMethod === 'unit_rate') {
        const qty = Number(data.quantity || baseAmount || 1);
        calculatedTariffAmount = round2(decAdd(decMul(qty, rate), fixedCharge));
      } else if (resolvedVersion.calculationMethod === 'fixed_charge') {
        calculatedTariffAmount = round2(fixedCharge);
      } else if (resolvedVersion.calculationMethod === 'hybrid') {
        calculatedTariffAmount = round2(decAdd(fixedCharge, decMul(baseAmount, decDiv(rate, 100))));
      } else {
        calculatedTariffAmount = round2(decAdd(decMul(baseAmount, decDiv(rate, 100)), fixedCharge));
      }

      const planTariffId = data.id || `plt-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      const actorName = actor?.name || 'System User';
      const actorId = actor?.id || 'usr-system';
      const actorRole = actor?.role || 'PROJECT_MANAGER';

      // 5. Insert plan_tariffs record
      await q(
        `INSERT INTO plan_tariffs (
          id, plan_id, project_id, tariff_id, tariff_version_id, tariff_code, tariff_name,
          tariff_category, calculation_method, applicable_base, rate_or_percentage, fixed_charge,
          unit, currency, effective_from, effective_to, base_amount, calculated_tariff_amount,
          applied_date, applied_by, notes, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14, $15::date, $16::date, $17, $18,
          $19::date, $20, $21, NOW(), NOW()
        )`,
        [
          planTariffId, planId, projectId, resolvedVersion.tariffId, resolvedVersion.id,
          resolvedVersion.tariffCode, resolvedVersion.tariffName, resolvedVersion.tariffCategory,
          resolvedVersion.calculationMethod, resolvedVersion.applicableBase, rate, fixedCharge,
          resolvedVersion.unit, resolvedVersion.currency, formatSqlDate(resolvedVersion.effectiveFrom), resolvedVersion.effectiveTo ? formatSqlDate(resolvedVersion.effectiveTo) : null,
          baseAmount, calculatedTariffAmount, targetDate, actorName, data.notes || ''
        ]
      );

      // 6. Record audit log in same transaction (Requirements 4, 9, 19)
      const auditLogId = `aud-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await q(
        `INSERT INTO audit_logs (
          id, timestamp, actor_id, actor_name, actor_role, action, action_type, module,
          entity_type, entity_id, record_id, record_name, project_id, plan_id,
          change_reason, after_state, details, ip_address, status, created_at_ts
        ) VALUES (
          $1, $2, $3, $4, $5, 'APPLY_TARIFF_TO_PLAN', 'APPLY_TARIFF_TO_PLAN', 'Tariffs',
          'PlanTariff', $6, $6, $7, $8, $9, $10, $11, $12, '127.0.0.1', 'Success', NOW()
        )`,
        [
          auditLogId,
          new Date().toISOString(),
          actorId,
          actorName,
          actorRole,
          planTariffId,
          `${resolvedVersion.tariffName} (${resolvedVersion.tariffCode})`,
          projectId,
          planId,
          `Applied tariff schedule '${resolvedVersion.tariffCode}' to plan ${plan.plan_number || planId}`,
          JSON.stringify({
            tariffCode: resolvedVersion.tariffCode,
            versionNumber: resolvedVersion.versionNumber,
            rateOrPercentage: rate,
            baseAmount,
            calculatedTariffAmount,
            appliedDate: targetDate
          }),
          `Applied tariff ${resolvedVersion.tariffCode} (v${resolvedVersion.versionNumber}) to Plan ${plan.plan_number || planId}: calculated ${calculatedTariffAmount} ${resolvedVersion.currency}`
        ]
      );

      return {
        id: planTariffId,
        planId,
        projectId,
        tariffId: resolvedVersion.tariffId,
        tariffVersionId: resolvedVersion.id,
        tariffCode: resolvedVersion.tariffCode,
        tariffName: resolvedVersion.tariffName,
        tariffCategory: resolvedVersion.tariffCategory,
        calculationMethod: resolvedVersion.calculationMethod,
        applicableBase: resolvedVersion.applicableBase,
        rateOrPercentage: rate,
        fixedCharge,
        baseAmount,
        calculatedTariffAmount,
        appliedDate: targetDate,
        appliedBy: actorName
      };
    });
  }

  public async removePlanTariff(
    planId: string,
    planTariffId: string,
    actor?: { id?: string; name?: string; role?: string }
  ): Promise<boolean> {
    return this.withTransaction(async (q) => {
      const curRes = await q('SELECT * FROM plan_tariffs WHERE id = $1 AND plan_id = $2 FOR UPDATE', [planTariffId, planId]);
      if (curRes.rows.length === 0) return false;
      const existing = curRes.rows[0];

      await q('DELETE FROM plan_tariffs WHERE id = $1', [planTariffId]);

      // Record audit log in same transaction
      const auditLogId = `aud-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await q(
        `INSERT INTO audit_logs (
          id, timestamp, actor_id, actor_name, actor_role, action, action_type, module,
          entity_type, entity_id, record_id, record_name, project_id, plan_id,
          change_reason, before_state, details, ip_address, status, created_at_ts
        ) VALUES (
          $1, $2, $3, $4, $5, 'REMOVE_TARIFF_FROM_PLAN', 'REMOVE_TARIFF_FROM_PLAN', 'Tariffs',
          'PlanTariff', $6, $6, $7, $8, $9, 'Removed tariff from plan', $10, $11, '127.0.0.1', 'Success', NOW()
        )`,
        [
          auditLogId,
          new Date().toISOString(),
          actor?.id || 'usr-system',
          actor?.name || 'System User',
          actor?.role || 'PROJECT_MANAGER',
          planTariffId,
          existing.tariff_name,
          existing.project_id,
          planId,
          JSON.stringify({ tariffCode: existing.tariff_code, calculatedAmount: existing.calculated_tariff_amount }),
          `Removed applied tariff ${existing.tariff_code} from plan ${planId}`
        ]
      );

      return true;
    });
  }

  // ============================================================================
  // OVERHEAD COST MANAGEMENT PORTAL & ALLOCATION METHODS (TASK 2)
  // ============================================================================

  // --- Overhead Categories (Requirement 5) ---
  public async getOverheadCategories(): Promise<any[]> {
    const db = await this.getDb();
    try {
      const res = await db.query('SELECT * FROM overhead_categories ORDER BY sort_order ASC, name ASC');
      return res.rows.map((r: any) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description || '',
        isDefault: Boolean(r.is_default),
        sortOrder: Number(r.sort_order || 0),
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
      }));
    } catch {
      return [];
    }
  }

  public async createOverheadCategory(data: any): Promise<any> {
    const db = await this.getDb();
    const name = String(data?.name || '').trim();
    if (!name) {
      throw Object.assign(new Error('Category name is required'), { status: 400 });
    }
    const id = data.id || `ovh-cat-${Date.now()}`;
    const code = String(data.code || `CAT-${name.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '')}`).trim();
    await db.query(
      `INSERT INTO overhead_categories (id, code, name, description, is_default, sort_order, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, sort_order = EXCLUDED.sort_order`,
      [id, code, name, String(data.description || ''), Boolean(data.isDefault), Number(data.sortOrder || 0)]
    );
    return { id, code, name, description: data.description || '', isDefault: Boolean(data.isDefault), sortOrder: Number(data.sortOrder || 0) };
  }

  public async updateOverheadCategory(id: string, data: any): Promise<any | null> {
    const db = await this.getDb();
    const cats = await this.getOverheadCategories();
    const existing = cats.find((c) => c.id === id);
    if (!existing) return null;
    const name = String(data.name || existing.name).trim();
    const code = String(data.code || existing.code).trim();
    const desc = data.description !== undefined ? String(data.description) : existing.description;
    const sortOrder = data.sortOrder !== undefined ? Number(data.sortOrder) : existing.sortOrder;

    await db.query(
      `UPDATE overhead_categories SET code = $1, name = $2, description = $3, sort_order = $4 WHERE id = $5`,
      [code, name, desc, sortOrder, id]
    );
    return { ...existing, code, name, description: desc, sortOrder };
  }

  public async deleteOverheadCategory(id: string): Promise<boolean> {
    const db = await this.getDb();
    const catRes = await db.query('SELECT name FROM overhead_categories WHERE id = $1', [id]);
    if (catRes.rows.length === 0) return false;
    const catName = catRes.rows[0].name;

    const inUse = await db.query('SELECT COUNT(*) as cnt FROM overhead_items WHERE category = $1', [catName]);
    if (Number(inUse.rows[0]?.cnt || 0) > 0) {
      throw Object.assign(
        new Error(`Cannot delete category '${catName}' because it is in use by ${inUse.rows[0].cnt} overhead catalogue item(s).`),
        { status: 400 }
      );
    }
    await db.query('DELETE FROM overhead_categories WHERE id = $1', [id]);
    return true;
  }

  // --- Centralized Overhead Items Catalogue (Requirement 3, 4, 17) ---
  public async getOverheadItems(opts?: ListQueryOptions): Promise<any[]> {
    const result = await this.getOverheadItemsPaginated({ ...(opts || {}), limit: 10000 });
    return result.data;
  }

  public async getOverheadItemsPaginated(opts?: ListQueryOptions): Promise<PaginatedResult<any>> {
    const db = await this.getDb();
    // Query overhead items with aggregation of active allocations across project plans
    const res = await db.query(`
      SELECT 
        oi.*,
        oi.effective_date::text AS effective_date_iso,
        COUNT(DISTINCT poa.plan_id) AS active_allocations_count,
        COALESCE(SUM(poa.allocated_amount), 0) AS total_allocated_amount
      FROM overhead_items oi
      LEFT JOIN plan_overhead_allocations poa ON poa.overhead_item_id = oi.id
      GROUP BY oi.id
      ORDER BY oi.created_at DESC
    `);

    const rows = res.rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      barcode: r.barcode || `BC-${r.code}`,
      name: r.name,
      category: r.category,
      subCategory: r.sub_category || '',
      categoryId: r.category_id || null,
      subCategoryId: r.sub_category_id || null,
      themeId: r.theme_id || null,
      customGradient: r.custom_gradient || null,
      description: r.description || '',
      costType: r.cost_type || 'Fixed',
      defaultCalculationMethod: r.default_calculation_method || 'fixed_amount',
      defaultRate: round4(Number(r.default_rate || 0)),
      defaultCostBase: r.default_cost_base || 'total_direct_cost',
      unitType: r.unit_type || 'month',
      effectiveDate: formatSqlDate(r.effective_date_iso || r.effective_date, new Date().toISOString().slice(0, 10)),
      status: r.status || 'Active',
      createdBy: r.created_by || 'System',
      updatedBy: r.updated_by || 'System',
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
      activeAllocationsCount: Number(r.active_allocations_count || 0),
      totalAllocatedAmount: round2(Number(r.total_allocated_amount || 0))
    }));

    return parseFilterPagination(
      rows,
      opts,
      ['name', 'code', 'barcode', 'category', 'description', 'costType', 'status'],
      'name'
    );
  }

  public async getOverheadItemById(id: string): Promise<any | null> {
    if (!id) return null;
    const db = await this.getDb();
    const itemRes = await db.query(
      `SELECT oi.*, oi.effective_date::text AS effective_date_iso
       FROM overhead_items oi WHERE oi.id = $1`,
      [id]
    );
    if (itemRes.rows.length === 0) return null;
    const r = itemRes.rows[0];

    // Linked plans where this item is allocated
    const linkedPlansRes = await db.query(
      `SELECT 
        poa.id AS allocation_id,
        poa.plan_id,
        pp.plan_number,
        pp.name AS plan_name,
        poa.project_id,
        p.code AS project_code,
        p.name AS project_name,
        poa.allocation_method,
        poa.allocation_base,
        poa.base_amount,
        poa.allocation_rate,
        poa.unit_quantity,
        poa.allocated_amount,
        poa.effective_date::text AS effective_date_iso,
        poa.allocated_by,
        poa.notes
      FROM plan_overhead_allocations poa
      INNER JOIN project_plans pp ON pp.id = poa.plan_id
      INNER JOIN projects p ON p.id = poa.project_id
      WHERE poa.overhead_item_id = $1
      ORDER BY pp.updated_at DESC`,
      [id]
    );

    // Recent item audit logs
    const auditRes = await db.query(
      `SELECT * FROM overhead_audit_logs WHERE overhead_item_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [id]
    );

    const linkedPlans = linkedPlansRes.rows.map((lp: any) => ({
      allocationId: lp.allocation_id,
      planId: lp.plan_id,
      planNumber: lp.plan_number,
      planName: lp.plan_name,
      projectId: lp.project_id,
      projectCode: lp.project_code,
      projectName: lp.project_name,
      allocationMethod: lp.allocation_method,
      allocationBase: lp.allocation_base,
      baseAmount: round2(Number(lp.base_amount || 0)),
      allocationRate: round4(Number(lp.allocation_rate || 0)),
      unitQuantity: round4(Number(lp.unit_quantity || 1)),
      allocatedAmount: round2(Number(lp.allocated_amount || 0)),
      effectiveDate: formatSqlDate(lp.effective_date_iso, ''),
      allocatedBy: lp.allocated_by || 'System',
      notes: lp.notes || ''
    }));

    const totalAllocatedAmount = round2(linkedPlans.reduce((sum, p) => decAdd(sum, p.allocatedAmount), 0));

    return {
      id: r.id,
      code: r.code,
      barcode: r.barcode || `BC-${r.code}`,
      name: r.name,
      category: r.category,
      subCategory: r.sub_category || '',
      categoryId: r.category_id || null,
      subCategoryId: r.sub_category_id || null,
      themeId: r.theme_id || null,
      customGradient: r.custom_gradient || null,
      description: r.description || '',
      costType: r.cost_type || 'Fixed',
      defaultCalculationMethod: r.default_calculation_method || 'fixed_amount',
      defaultRate: round4(Number(r.default_rate || 0)),
      defaultCostBase: r.default_cost_base || 'total_direct_cost',
      unitType: r.unit_type || 'month',
      effectiveDate: formatSqlDate(r.effective_date_iso || r.effective_date, new Date().toISOString().slice(0, 10)),
      status: r.status || 'Active',
      createdBy: r.created_by || 'System',
      updatedBy: r.updated_by || 'System',
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
      activeAllocationsCount: linkedPlans.length,
      totalAllocatedAmount,
      linkedPlans,
      auditHistory: auditRes.rows.map((a: any) => ({
        id: a.id,
        action: a.action,
        actorId: a.actor_id,
        actorName: a.actor_name,
        actorRole: a.actor_role,
        previousState: typeof a.previous_state === 'string' ? JSON.parse(a.previous_state) : a.previous_state,
        newState: typeof a.new_state === 'string' ? JSON.parse(a.new_state) : a.new_state,
        changeDescription: a.change_description,
        createdAt: a.created_at ? new Date(a.created_at).toISOString() : new Date().toISOString()
      }))
    };
  }

  public async createOverheadItem(data: any, actor?: { id?: string; name?: string; role?: string }): Promise<any> {
    const db = await this.getDb();
    const name = String(data?.name || '').trim();
    if (!name) {
      throw Object.assign(new Error('Overhead item name is required.'), { status: 400 });
    }
    const category = String(data?.category || 'Office Rent').trim();

    // Check whether an equivalent item already exists (Requirement 14a, 14e)
    const existingCheck = await db.query(
      `SELECT * FROM overhead_items WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) OR (code IS NOT NULL AND LOWER(TRIM(code)) = LOWER(TRIM($2)))`,
      [name, data?.code || '']
    );
    if (existingCheck.rows.length > 0) {
      if (data?.reuseIfExisting) {
        return await this.getOverheadItemById(existingCheck.rows[0].id);
      }
      throw Object.assign(
        new Error(`An equivalent overhead item with name '${existingCheck.rows[0].name}' or code '${existingCheck.rows[0].code}' already exists in the centralized catalogue.`),
        { status: 409, existingItem: existingCheck.rows[0] }
      );
    }

    const id = data.id || `ovh-item-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    // Auto-generate unique code if not provided
    let code = data.code ? String(data.code).trim().toUpperCase() : '';
    if (!code) {
      const catPrefix = category.slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '');
      const countRes = await db.query('SELECT COUNT(*) as cnt FROM overhead_items');
      const seq = Number(countRes.rows[0]?.cnt || 0) + 1;
      code = `OVH-${catPrefix}-${String(seq).padStart(3, '0')}`;
      let attempt = 1;
      while (true) {
        const dup = await db.query('SELECT id FROM overhead_items WHERE code = $1', [code]);
        if (dup.rows.length === 0) break;
        attempt++;
        code = `OVH-${catPrefix}-${String(seq + attempt).padStart(3, '0')}`;
      }
    }

    // Auto-generate unique barcode
    let barcode = data.barcode ? String(data.barcode).trim().toUpperCase() : '';
    if (!barcode) {
      barcode = await this.generateUniqueBarcode('overhead_item', code);
    }

    const costTypes = ['Fixed', 'Variable', 'Semi-Variable', 'Stepped'];
    const costType = costTypes.includes(data.costType) ? data.costType : 'Fixed';

    const validMethods = ['fixed_amount', 'percentage_of_cost_base', 'rate_per_unit', 'proportional_defined_base'];
    let rawMethod = data.defaultCalculationMethod || data.defaultAllocationMethod || data.allocationMethod;
    if (rawMethod === 'percentage') rawMethod = 'percentage_of_cost_base';
    const defaultCalculationMethod = validMethods.includes(rawMethod)
      ? rawMethod
      : 'fixed_amount';

    const defaultRate = round4(Number(data.defaultRate ?? data.rate ?? 0));
    let defaultCostBase = data.defaultCostBase || data.costBase || 'total_direct_cost';
    if (defaultCostBase === 'total_direct_costs') defaultCostBase = 'total_direct_cost';
    const unitType = data.unitType || data.defaultUnit || 'month';
    const todayIso = new Date().toISOString().slice(0, 10);
    const effectiveDate = formatSqlDate(data.effectiveDate, todayIso);
    const status = ['Active', 'Inactive', 'Archived', 'Under Review'].includes(data.status) ? data.status : 'Active';
    const actorName = actor?.name || data.createdBy || 'System Finance';

    await db.query(
      `INSERT INTO overhead_items (
        id, code, barcode, name, category, sub_category, category_id, sub_category_id,
        theme_id, custom_gradient, description, cost_type, default_calculation_method,
        default_rate, default_cost_base, unit_type, effective_date, status, created_by, updated_by,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::date, $18, $19, $20, NOW(), NOW())`,
      [
        id, code, barcode, name, category, String(data.subCategory || ''),
        data.categoryId || null, data.subCategoryId || null,
        data.themeId || null, data.customGradient || null,
        String(data.description || ''),
        costType, defaultCalculationMethod, defaultRate, defaultCostBase,
        unitType, effectiveDate, status, actorName, actorName
      ]
    );

    // Record audit log (Requirement 21)
    await this.createOverheadAuditLog({
      overheadItemId: id,
      overheadItemCode: code,
      overheadItemName: name,
      action: 'ITEM_CREATED',
      actorId: actor?.id,
      actorName,
      actorRole: actor?.role || 'ADMIN',
      newState: { id, code, barcode, name, category, costType, defaultCalculationMethod, defaultRate, defaultCostBase, status },
      changeDescription: `Created centralized overhead catalogue item '${name}' (${code}) with default ${defaultCalculationMethod} rate ${defaultRate}.`
    });

    await this.registerBarcode({
      barcode,
      entityType: 'overhead_item',
      entityId: id,
      entityCode: code,
      entityName: name,
      category,
      unitCost: defaultRate,
      sellingRate: defaultRate,
      currency: 'USD',
      isCostEligible: false,
      isBoqEligible: false
    }).catch((err) => console.warn('[Barcode] Register overhead barcode warning:', err?.message));

    return await this.getOverheadItemById(id);
  }

  public async updateOverheadItem(id: string, data: any, actor?: { id?: string; name?: string; role?: string }): Promise<any | null> {
    const db = await this.getDb();
    const existing = await this.getOverheadItemById(id);
    if (!existing) return null;

    const name = data.name !== undefined ? String(data.name).trim() : existing.name;
    if (!name) {
      throw Object.assign(new Error('Overhead item name cannot be empty.'), { status: 400 });
    }

    const code = data.code !== undefined ? String(data.code).trim().toUpperCase() : existing.code;
    if (code !== existing.code) {
      const dup = await db.query('SELECT id FROM overhead_items WHERE code = $1 AND id != $2', [code, id]);
      if (dup.rows.length > 0) {
        throw Object.assign(new Error(`Overhead item code '${code}' already exists.`), { status: 409 });
      }
    }

    const barcode = data.barcode !== undefined ? String(data.barcode).trim().toUpperCase() : existing.barcode;
    const category = data.category !== undefined ? String(data.category).trim() : existing.category;
    const subCategory = data.subCategory !== undefined ? String(data.subCategory) : (existing.subCategory || '');
    const categoryId = data.categoryId !== undefined ? data.categoryId : (existing.categoryId || null);
    const subCategoryId = data.subCategoryId !== undefined ? data.subCategoryId : (existing.subCategoryId || null);
    const themeId = data.themeId !== undefined ? data.themeId : (existing.themeId || null);
    const customGradient = data.customGradient !== undefined ? data.customGradient : (existing.customGradient || null);
    const description = data.description !== undefined ? String(data.description) : existing.description;
    const costType = data.costType !== undefined ? data.costType : existing.costType;
    const defaultCalculationMethod = data.defaultCalculationMethod !== undefined ? data.defaultCalculationMethod : existing.defaultCalculationMethod;
    const defaultRate = data.defaultRate !== undefined ? round4(Number(data.defaultRate)) : existing.defaultRate;
    const defaultCostBase = data.defaultCostBase !== undefined ? data.defaultCostBase : existing.defaultCostBase;
    const unitType = data.unitType !== undefined ? data.unitType : existing.unitType;
    const effectiveDate = formatSqlDate(data.effectiveDate || existing.effectiveDate, existing.effectiveDate);
    const status = data.status !== undefined ? data.status : existing.status;
    const actorName = actor?.name || data.updatedBy || 'System Finance';

    await db.query(
      `UPDATE overhead_items SET
        code = $1, barcode = $2, name = $3, category = $4, sub_category = $5,
        category_id = $6, sub_category_id = $7, theme_id = $8, custom_gradient = $9,
        description = $10, cost_type = $11, default_calculation_method = $12, default_rate = $13,
        default_cost_base = $14, unit_type = $15, effective_date = $16::date,
        status = $17, updated_by = $18, updated_at = NOW()
       WHERE id = $19`,
      [
        code, barcode, name, category, subCategory,
        categoryId, subCategoryId, themeId, customGradient,
        description, costType, defaultCalculationMethod, defaultRate,
        defaultCostBase, unitType, effectiveDate,
        status, actorName, id
      ]
    );

    // Record audit log
    await this.createOverheadAuditLog({
      overheadItemId: id,
      overheadItemCode: code,
      overheadItemName: name,
      action: 'ITEM_UPDATED',
      actorId: actor?.id,
      actorName,
      actorRole: actor?.role || 'ADMIN',
      previousState: { name: existing.name, defaultRate: existing.defaultRate, defaultCalculationMethod: existing.defaultCalculationMethod, status: existing.status },
      newState: { name, defaultRate, defaultCalculationMethod, status },
      changeDescription: `Updated overhead catalogue item '${name}' (${code}). Rate: ${defaultRate}, Status: ${status}.`
    });

    if (barcode) {
      await this.registerBarcode({
        barcode,
        entityType: 'overhead_item',
        entityId: id,
        entityCode: code,
        entityName: name,
        category,
        unitCost: defaultRate,
        sellingRate: defaultRate,
        currency: 'USD',
        isCostEligible: false,
        isBoqEligible: false
      }).catch((err) => console.warn('[Barcode] Update overhead barcode warning:', err?.message));
    }

    return await this.getOverheadItemById(id);
  }

  public async deleteOverheadItem(id: string, actor?: { id?: string; name?: string; role?: string }): Promise<boolean> {
    const db = await this.getDb();
    const existing = await this.getOverheadItemById(id);
    if (!existing) return false;

    // Verify whether any plans are actively using this item (Requirement 17, 20)
    const inUse = await db.query('SELECT COUNT(*) as cnt FROM plan_overhead_allocations WHERE overhead_item_id = $1', [id]);
    const cnt = Number(inUse.rows[0]?.cnt || 0);
    if (cnt > 0) {
      throw Object.assign(
        new Error(`Cannot delete overhead item '${existing.name}' (${existing.code}) because it is actively allocated in ${cnt} project plan(s). To maintain plan historical integrity, archive the item or remove the allocations first.`),
        { status: 400, linkedPlansCount: cnt }
      );
    }

    await db.query('DELETE FROM overhead_items WHERE id = $1', [id]);

    await this.createOverheadAuditLog({
      overheadItemId: id,
      overheadItemCode: existing.code,
      overheadItemName: existing.name,
      action: 'ITEM_DELETED',
      actorId: actor?.id,
      actorName: actor?.name || 'System Finance',
      actorRole: actor?.role || 'ADMIN',
      previousState: existing,
      changeDescription: `Deleted overhead catalogue item '${existing.name}' (${existing.code}).`
    });

    return true;
  }

  // --- Plan Overhead Allocations (Requirement 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20) ---
  public async getPlanOverheadAllocations(planId: string): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query(
      `SELECT 
        poa.*,
        poa.effective_date::text AS effective_date_iso,
        oi.code AS overhead_item_code,
        oi.name AS overhead_item_name,
        oi.barcode,
        oi.category,
        oi.cost_type,
        oi.unit_type
      FROM plan_overhead_allocations poa
      LEFT JOIN overhead_items oi ON oi.id = poa.overhead_item_id
      WHERE poa.plan_id = $1
      ORDER BY poa.created_at ASC`,
      [planId]
    );

    return res.rows.map((ovh: any) => ({
      id: ovh.id,
      planId: ovh.plan_id,
      projectId: ovh.project_id,
      overheadItemId: ovh.overhead_item_id,
      overheadItemCode: ovh.overhead_item_code || ovh.code,
      overheadItemName: ovh.overhead_item_name || ovh.name || ovh.category,
      barcode: ovh.barcode,
      category: ovh.category || 'General Overhead',
      costType: ovh.cost_type || 'Fixed',
      unitType: ovh.unit_type || 'month',
      allocationMethod: ovh.allocation_method,
      allocationType: ovh.allocation_method === 'fixed_amount' ? 'fixed' : 'percentage',
      allocationBase: ovh.allocation_base,
      baseAmount: round2(Number(ovh.base_amount || 0)),
      allocationRate: round4(Number(ovh.allocation_rate || 0)),
      ratePct: round2(Number(ovh.allocation_rate || 0)),
      unitQuantity: round4(Number(ovh.unit_quantity || 1)),
      allocatedAmount: round2(Number(ovh.allocated_amount || 0)),
      effectiveDate: formatSqlDate(ovh.effective_date_iso || ovh.effective_date, ''),
      allocatedBy: ovh.allocated_by || 'System',
      notes: ovh.notes || '',
      createdAt: ovh.created_at ? new Date(ovh.created_at).toISOString() : new Date().toISOString()
    }));
  }

  public async getAllOverheadAllocations(opts?: ListQueryOptions): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query(`
      SELECT 
        poa.*,
        poa.effective_date::text AS effective_date_iso,
        oi.code AS overhead_item_code,
        oi.name AS overhead_item_name,
        oi.barcode,
        oi.category,
        oi.cost_type,
        oi.unit_type,
        pp.plan_number,
        pp.name AS plan_name,
        p.code AS project_code,
        p.name AS project_name
      FROM plan_overhead_allocations poa
      INNER JOIN overhead_items oi ON oi.id = poa.overhead_item_id
      INNER JOIN project_plans pp ON pp.id = poa.plan_id
      INNER JOIN projects p ON p.id = poa.project_id
      ORDER BY poa.created_at DESC
    `);

    return res.rows.map((ovh: any) => ({
      id: ovh.id,
      planId: ovh.plan_id,
      planNumber: ovh.plan_number,
      planName: ovh.plan_name,
      projectId: ovh.project_id,
      projectCode: ovh.project_code,
      projectName: ovh.project_name,
      overheadItemId: ovh.overhead_item_id,
      overheadItemCode: ovh.overhead_item_code,
      overheadItemName: ovh.overhead_item_name,
      barcode: ovh.barcode,
      category: ovh.category,
      costType: ovh.cost_type,
      unitType: ovh.unit_type,
      allocationMethod: ovh.allocation_method,
      allocationBase: ovh.allocation_base,
      baseAmount: round2(Number(ovh.base_amount || 0)),
      allocationRate: round4(Number(ovh.allocation_rate || 0)),
      unitQuantity: round4(Number(ovh.unit_quantity || 1)),
      allocatedAmount: round2(Number(ovh.allocated_amount || 0)),
      effectiveDate: formatSqlDate(ovh.effective_date_iso, ''),
      allocatedBy: ovh.allocated_by,
      notes: ovh.notes || ''
    }));
  }

  /**
   * Adds an overhead item to a project plan.
   * Atomically creates both the centralized overhead catalogue item (if new)
   * and links it to the current plan in a single transaction (Requirement 14d).
   * Checks for duplicate catalogue items (Requirement 14a,e) and prevents double-counting (Requirement 20).
   */
  public async addPlanOverheadAllocation(planId: string, payload: any, actor?: { id?: string; name?: string; role?: string }): Promise<any> {
    if (!planId) {
      throw Object.assign(new Error('planId is required'), { status: 400 });
    }

    return await this.withTransaction(async (q) => {
      // 1. Validate plan exists
      const planRes = await q('SELECT * FROM project_plans WHERE id = $1 FOR UPDATE', [planId]);
      if (planRes.rows.length === 0) {
        throw Object.assign(new Error(`Project plan '${planId}' does not exist`), { status: 404 });
      }
      const plan = planRes.rows[0];
      const projectId = plan.project_id;

      let targetItemId = payload.overheadItemId ? String(payload.overheadItemId).trim() : '';
      let targetItem: any = null;

      // 2. Identify or create catalogue item (Requirement 14)
      if (targetItemId) {
        const itemRes = await q('SELECT * FROM overhead_items WHERE id = $1', [targetItemId]);
        if (itemRes.rows.length === 0) {
          throw Object.assign(new Error(`Overhead catalogue item '${targetItemId}' not found`), { status: 404 });
        }
        targetItem = itemRes.rows[0];
      } else if (payload.newItem && String(payload.newItem.name || '').trim()) {
        const newItemName = String(payload.newItem.name).trim();
        // Check whether equivalent exists (Requirement 14a)
        const eqRes = await q(
          'SELECT * FROM overhead_items WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) OR (code IS NOT NULL AND LOWER(TRIM(code)) = LOWER(TRIM($2)))',
          [newItemName, payload.newItem.code || '']
        );
        if (eqRes.rows.length > 0) {
          // Reuse existing item! (Requirement 14b, 14e)
          targetItem = eqRes.rows[0];
          targetItemId = targetItem.id;
        } else {
          // Create new centralized overhead item in this same transaction! (Requirement 14c, 14d)
          targetItemId = `ovh-item-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
          const cat = String(payload.newItem.category || 'Office Rent').trim();
          const catPrefix = cat.slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '');
          const countRes = await q('SELECT COUNT(*) as cnt FROM overhead_items');
          const code = payload.newItem.code
            ? String(payload.newItem.code).trim().toUpperCase()
            : `OVH-${catPrefix}-${String(Number(countRes.rows[0]?.cnt || 0) + 1).padStart(3, '0')}`;
          const barcode = payload.newItem.barcode
            ? String(payload.newItem.barcode).trim().toUpperCase()
            : `BC-OVH-${Date.now().toString().slice(-6)}`;
          const costType = payload.newItem.costType || 'Fixed';
          const defaultMethod = payload.newItem.defaultCalculationMethod || payload.allocationMethod || 'fixed_amount';
          const defaultRate = round4(Number(payload.newItem.defaultRate ?? payload.allocationRate ?? 0));
          const defaultBase = payload.newItem.defaultCostBase || payload.allocationBase || 'total_direct_cost';
          const unitType = payload.newItem.unitType || 'month';
          const effectiveDate = formatSqlDate(payload.newItem.effectiveDate || payload.effectiveDate, new Date().toISOString().slice(0, 10));
          const actorName = actor?.name || 'System Finance';

          await q(
            `INSERT INTO overhead_items (
              id, code, barcode, name, category, description, cost_type, default_calculation_method,
              default_rate, default_cost_base, unit_type, effective_date, status, created_by, updated_by,
              created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::date, 'Active', $13, $14, NOW(), NOW())`,
            [
              targetItemId, code, barcode, newItemName, cat, String(payload.newItem.description || ''),
              costType, defaultMethod, defaultRate, defaultBase, unitType, effectiveDate, actorName, actorName
            ]
          );

          targetItem = {
            id: targetItemId,
            code,
            barcode,
            name: newItemName,
            category: cat,
            cost_type: costType,
            default_calculation_method: defaultMethod,
            default_rate: defaultRate,
            default_cost_base: defaultBase,
            unit_type: unitType
          };

          // Audit log for item creation
          await q(
            `INSERT INTO overhead_audit_logs (id, overhead_item_id, overhead_item_code, overhead_item_name, action, actor_id, actor_name, actor_role, new_state, change_description, created_at)
             VALUES ($1, $2, $3, $4, 'ITEM_CREATED', $5, $6, $7, $8, $9, NOW())`,
            [
              `oal-${Date.now()}-1`, targetItemId, code, newItemName,
              actor?.id || null, actorName, actor?.role || 'ADMIN',
              JSON.stringify(targetItem),
              `Created new centralized overhead catalogue item '${newItemName}' (${code}) via Plan ${plan.plan_number}.`
            ]
          );
        }
      } else {
        throw Object.assign(new Error('Either an existing overheadItemId or newItem details must be provided.'), { status: 400 });
      }

      // 3. Prevent double-counting: Check if already allocated to this plan (Requirement 20)
      const dupAllocCheck = await q(
        'SELECT id FROM plan_overhead_allocations WHERE plan_id = $1 AND overhead_item_id = $2',
        [planId, targetItemId]
      );
      if (dupAllocCheck.rows.length > 0) {
        throw Object.assign(
          new Error(`Overhead item '${targetItem.name}' (${targetItem.code}) is already allocated to plan '${plan.plan_number}'. You can edit the existing allocation parameters instead of adding a duplicate.`),
          { status: 409, existingAllocationId: dupAllocCheck.rows[0].id }
        );
      }

      // 4. Validate and compute allocation parameters (Requirement 10, 11)
      const validMethods = ['fixed_amount', 'percentage_of_cost_base', 'rate_per_unit', 'proportional_defined_base'];
      let rawMethod = payload.allocationMethod || targetItem.default_calculation_method;
      if (rawMethod === 'percentage') rawMethod = 'percentage_of_cost_base';
      const allocMethod = validMethods.includes(rawMethod)
        ? rawMethod
        : 'fixed_amount';

      let rawBase = payload.allocationBase || payload.costBase || targetItem.default_cost_base || 'total_direct_cost';
      if (rawBase === 'total_direct_costs') rawBase = 'total_direct_cost';
      const allocBase = rawBase;

      const rawRate = payload.allocationRate !== undefined
        ? payload.allocationRate
        : (payload.rateOrAmount !== undefined ? payload.rateOrAmount : (targetItem.default_rate || 0));
      const allocRate = round4(Number(rawRate));
      const unitQty = Math.max(0, round4(Number(payload.unitQuantity !== undefined ? payload.unitQuantity : 1)));

      if (allocRate < 0) {
        throw Object.assign(new Error('Allocation rate must be non-negative'), { status: 400 });
      }

      // Evaluate plan direct costs to compute accurate base amount
      const summaryRes = await q('SELECT * FROM project_plan_cost_summaries WHERE plan_id = $1', [planId]);
      const curSummary = summaryRes.rows[0] || {};
      const directCost = Number(curSummary.direct_cost || 0);
      const materialCost = Number(curSummary.material_cost || 0);
      const subCost = Number(curSummary.subcontractor_cost || 0);
      const outCost = Number(curSummary.outsourced_cost || 0);
      const resCost = Number(curSummary.resource_cost || 0);
      const plannedRev = Number(curSummary.planned_revenue || plan.planned_revenue || 0);

      let baseAmount = round2(Number(payload.baseAmount || 0));
      if (allocBase === 'material_cost') {
        baseAmount = materialCost;
      } else if (allocBase === 'subcontractor_cost') {
        baseAmount = subCost;
      } else if (allocBase === 'outsourced_cost') {
        baseAmount = outCost;
      } else if (allocBase === 'labor_cost') {
        baseAmount = resCost;
      } else if (allocBase === 'planned_revenue') {
        baseAmount = plannedRev;
      } else if (allocBase === 'total_direct_cost' || baseAmount <= 0) {
        baseAmount = directCost;
      }

      let allocatedAmount = 0;
      if (allocMethod === 'fixed_amount') {
        allocatedAmount = allocRate;
      } else if (allocMethod === 'rate_per_unit') {
        allocatedAmount = round2(decMul(allocRate, unitQty));
      } else if (allocMethod === 'percentage_of_cost_base' || allocMethod === 'proportional_defined_base') {
        allocatedAmount = round2(decDiv(decMul(baseAmount, allocRate), 100));
      }

      if (payload.allocatedAmount !== undefined && Number(payload.allocatedAmount) > 0 && allocMethod === 'fixed_amount') {
        allocatedAmount = round2(Number(payload.allocatedAmount));
      }

      const allocationId = payload.id || `poa-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      const todayIso = new Date().toISOString().slice(0, 10);
      const effectiveDate = formatSqlDate(payload.effectiveDate, todayIso);
      const actorName = actor?.name || 'System Finance';

      // 5. Insert plan_overhead_allocations
      await q(
        `INSERT INTO plan_overhead_allocations (
          id, plan_id, project_id, overhead_item_id, allocation_method, allocation_base,
          base_amount, allocation_rate, unit_quantity, allocated_amount, effective_date,
          allocated_by, notes, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::date, $12, $13, NOW(), NOW())`,
        [
          allocationId, planId, projectId, targetItemId, allocMethod, allocBase,
          baseAmount, allocRate, unitQty, allocatedAmount, effectiveDate,
          actorName, String(payload.notes || '')
        ]
      );

      // Sync into project_plan_overhead_allocations for backwards compatibility
      await q(
        `INSERT INTO project_plan_overhead_allocations (
          id, plan_id, project_id, overhead_item_id, category, allocation_type, allocation_method,
          allocation_base, allocation_rate, rate_pct, base_amount, unit_quantity, allocated_amount,
          effective_date, allocated_by, notes, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::date, $15, $16, NOW())
        ON CONFLICT (id) DO UPDATE SET
          allocated_amount = EXCLUDED.allocated_amount,
          base_amount = EXCLUDED.base_amount,
          allocation_rate = EXCLUDED.allocation_rate`,
        [
          allocationId, planId, projectId, targetItemId, targetItem.category,
          allocMethod === 'fixed_amount' ? 'fixed' : 'percentage',
          allocMethod, allocBase, allocRate, allocRate, baseAmount, unitQty, allocatedAmount,
          effectiveDate, actorName, String(payload.notes || '')
        ]
      );

      // 6. Recalculate plan cost summaries
      await this.internalRecalculatePlanCostSummary(q, planId);

      // 7. Record audit log (Requirement 21)
      await q(
        `INSERT INTO overhead_audit_logs (
          id, overhead_item_id, overhead_item_code, overhead_item_name, plan_id, plan_number,
          allocation_id, action, actor_id, actor_name, actor_role, new_state, change_description, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ALLOCATION_CREATED', $8, $9, $10, $11, $12, NOW())`,
        [
          `oal-${Date.now()}-2`, targetItemId, targetItem.code, targetItem.name,
          planId, plan.plan_number, allocationId,
          actor?.id || null, actorName, actor?.role || 'ADMIN',
          JSON.stringify({ allocationId, allocMethod, allocBase, allocRate, baseAmount, allocatedAmount }),
          `Allocated overhead '${targetItem.name}' to Plan ${plan.plan_number} using ${allocMethod} (Allocated Amount: ${allocatedAmount}).`
        ]
      );

      return {
        id: allocationId,
        planId,
        projectId,
        overheadItemId: targetItemId,
        overheadItemCode: targetItem.code,
        overheadItemName: targetItem.name,
        barcode: targetItem.barcode,
        category: targetItem.category,
        costType: targetItem.cost_type,
        unitType: targetItem.unit_type,
        allocationMethod: allocMethod,
        allocationType: allocMethod === 'fixed_amount' ? 'fixed' : 'percentage',
        allocationBase: allocBase,
        baseAmount,
        allocationRate: allocRate,
        ratePct: round2(allocRate),
        unitQuantity: unitQty,
        allocatedAmount,
        effectiveDate,
        allocatedBy: actorName,
        notes: payload.notes || ''
      };
    });
  }

  /**
   * Update plan-specific allocation parameters without modifying default catalogue item (Requirement 15, 18).
   */
  public async updatePlanOverheadAllocation(
    planId: string,
    allocationId: string,
    payload: any,
    actor?: { id?: string; name?: string; role?: string }
  ): Promise<any | null> {
    return await this.withTransaction(async (q) => {
      const planRes = await q('SELECT * FROM project_plans WHERE id = $1', [planId]);
      if (planRes.rows.length === 0) return null;
      const plan = planRes.rows[0];

      const allocRes = await q(
        `SELECT poa.*, oi.name as item_name, oi.code as item_code, oi.category as item_cat
         FROM plan_overhead_allocations poa
         LEFT JOIN overhead_items oi ON oi.id = poa.overhead_item_id
         WHERE poa.id = $1 AND poa.plan_id = $2`,
        [allocationId, planId]
      );
      if (allocRes.rows.length === 0) return null;
      const existing = allocRes.rows[0];

      const validMethods = ['fixed_amount', 'percentage_of_cost_base', 'rate_per_unit', 'proportional_defined_base'];
      let rawMethod = payload.allocationMethod || existing.allocation_method;
      if (rawMethod === 'percentage') rawMethod = 'percentage_of_cost_base';
      const allocMethod = validMethods.includes(rawMethod) ? rawMethod : existing.allocation_method;

      let rawBase = payload.allocationBase || payload.costBase || existing.allocation_base;
      if (rawBase === 'total_direct_costs') rawBase = 'total_direct_cost';
      const allocBase = rawBase;

      const rawRate = payload.allocationRate !== undefined
        ? payload.allocationRate
        : (payload.rateOrAmount !== undefined ? payload.rateOrAmount : existing.allocation_rate);
      const allocRate = round4(Number(rawRate));
      const unitQty = payload.unitQuantity !== undefined ? Math.max(0, round4(Number(payload.unitQuantity))) : Number(existing.unit_quantity || 1);
      const notes = payload.notes !== undefined ? String(payload.notes) : existing.notes;
      const effectiveDate = formatSqlDate(payload.effectiveDate || existing.effective_date, existing.effective_date);

      // Re-evaluate base amount if applicable
      const summaryRes = await q('SELECT * FROM project_plan_cost_summaries WHERE plan_id = $1', [planId]);
      const curSummary = summaryRes.rows[0] || {};
      let baseAmount = payload.baseAmount !== undefined ? round2(Number(payload.baseAmount)) : Number(existing.base_amount);

      if (allocBase === 'material_cost') baseAmount = Number(curSummary.material_cost || 0);
      else if (allocBase === 'subcontractor_cost') baseAmount = Number(curSummary.subcontractor_cost || 0);
      else if (allocBase === 'outsourced_cost') baseAmount = Number(curSummary.outsourced_cost || 0);
      else if (allocBase === 'labor_cost') baseAmount = Number(curSummary.resource_cost || 0);
      else if (allocBase === 'planned_revenue') baseAmount = Number(curSummary.planned_revenue || plan.planned_revenue || 0);
      else if (allocBase === 'total_direct_cost' || baseAmount <= 0) baseAmount = Number(curSummary.direct_cost || 0);

      let allocatedAmount = 0;
      if (allocMethod === 'fixed_amount') {
        allocatedAmount = allocRate;
      } else if (allocMethod === 'rate_per_unit') {
        allocatedAmount = round2(decMul(allocRate, unitQty));
      } else {
        allocatedAmount = round2(decDiv(decMul(baseAmount, allocRate), 100));
      }

      if (payload.allocatedAmount !== undefined && Number(payload.allocatedAmount) > 0 && allocMethod === 'fixed_amount') {
        allocatedAmount = round2(Number(payload.allocatedAmount));
      }

      await q(
        `UPDATE plan_overhead_allocations SET
          allocation_method = $1, allocation_base = $2, base_amount = $3,
          allocation_rate = $4, unit_quantity = $5, allocated_amount = $6,
          effective_date = $7::date, notes = $8, updated_at = NOW()
         WHERE id = $9 AND plan_id = $10`,
        [allocMethod, allocBase, baseAmount, allocRate, unitQty, allocatedAmount, effectiveDate, notes, allocationId, planId]
      );

      // Sync legacy table
      await q(
        `UPDATE project_plan_overhead_allocations SET
          allocation_method = $1, allocation_type = $2, allocation_base = $3, base_amount = $4,
          allocation_rate = $5, rate_pct = $6, unit_quantity = $7, allocated_amount = $8,
          effective_date = $9::date, notes = $10
         WHERE id = $11 AND plan_id = $12`,
        [
          allocMethod, allocMethod === 'fixed_amount' ? 'fixed' : 'percentage', allocBase, baseAmount,
          allocRate, allocRate, unitQty, allocatedAmount, effectiveDate, notes, allocationId, planId
        ]
      );

      // Recalculate plan financials
      await this.internalRecalculatePlanCostSummary(q, planId);

      // Audit log
      await q(
        `INSERT INTO overhead_audit_logs (
          id, overhead_item_id, overhead_item_code, overhead_item_name, plan_id, plan_number,
          allocation_id, action, actor_id, actor_name, actor_role, previous_state, new_state, change_description, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ALLOCATION_UPDATED', $8, $9, $10, $11, $12, $13, NOW())`,
        [
          `oal-${Date.now()}-3`, existing.overhead_item_id, existing.item_code, existing.item_name,
          planId, plan.plan_number, allocationId,
          actor?.id || null, actor?.name || 'System Finance', actor?.role || 'ADMIN',
          JSON.stringify({ allocMethod: existing.allocation_method, allocRate: existing.allocation_rate, allocatedAmount: existing.allocated_amount }),
          JSON.stringify({ allocMethod, allocRate, allocatedAmount }),
          `Updated Plan ${plan.plan_number} overhead allocation for '${existing.item_name}'. New allocated amount: ${allocatedAmount}.`
        ]
      );

      return {
        id: allocationId,
        planId,
        overheadItemId: existing.overhead_item_id,
        overheadItemCode: existing.item_code,
        overheadItemName: existing.item_name,
        allocationMethod: allocMethod,
        allocationBase: allocBase,
        baseAmount,
        allocationRate: allocRate,
        unitQuantity: unitQty,
        allocatedAmount,
        effectiveDate,
        notes
      };
    });
  }

  public async deletePlanOverheadAllocation(planId: string, allocationId: string, actor?: { id?: string; name?: string; role?: string }): Promise<boolean> {
    return await this.withTransaction(async (q) => {
      const planRes = await q('SELECT * FROM project_plans WHERE id = $1', [planId]);
      if (planRes.rows.length === 0) return false;
      const plan = planRes.rows[0];

      const allocRes = await q(
        `SELECT poa.*, oi.name as item_name, oi.code as item_code
         FROM plan_overhead_allocations poa
         LEFT JOIN overhead_items oi ON oi.id = poa.overhead_item_id
         WHERE poa.id = $1 AND poa.plan_id = $2`,
        [allocationId, planId]
      );
      if (allocRes.rows.length === 0) return false;
      const existing = allocRes.rows[0];

      await q('DELETE FROM plan_overhead_allocations WHERE id = $1 AND plan_id = $2', [allocationId, planId]);
      await q('DELETE FROM project_plan_overhead_allocations WHERE id = $1 AND plan_id = $2', [allocationId, planId]);

      // Recalculate plan financials
      await this.internalRecalculatePlanCostSummary(q, planId);

      // Audit log
      await q(
        `INSERT INTO overhead_audit_logs (
          id, overhead_item_id, overhead_item_code, overhead_item_name, plan_id, plan_number,
          allocation_id, action, actor_id, actor_name, actor_role, change_description, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ALLOCATION_REMOVED', $8, $9, $10, $11, NOW())`,
        [
          `oal-${Date.now()}-4`, existing.overhead_item_id, existing.item_code, existing.item_name,
          planId, plan.plan_number, allocationId,
          actor?.id || null, actor?.name || 'System Finance', actor?.role || 'ADMIN',
          `Removed overhead allocation '${existing.item_name}' (${existing.item_code}) from Plan ${plan.plan_number}.`
        ]
      );

      return true;
    });
  }

  /**
   * Recalculates all overhead allocations for a plan when relevant cost base changes (Requirement 19).
   */
  public async recalculatePlanOverheads(planId: string, actor?: { id?: string; name?: string; role?: string }): Promise<any> {
    return await this.withTransaction(async (q) => {
      const planRes = await q('SELECT * FROM project_plans WHERE id = $1', [planId]);
      if (planRes.rows.length === 0) {
        throw Object.assign(new Error(`Project plan '${planId}' not found`), { status: 404 });
      }
      const plan = planRes.rows[0];

      // Direct costs from BOQ items & resources
      const summaryRes = await q('SELECT * FROM project_plan_cost_summaries WHERE plan_id = $1', [planId]);
      const curSummary = summaryRes.rows[0] || {};
      const directCost = Number(curSummary.direct_cost || 0);
      const materialCost = Number(curSummary.material_cost || 0);
      const subCost = Number(curSummary.subcontractor_cost || 0);
      const outCost = Number(curSummary.outsourced_cost || 0);
      const resCost = Number(curSummary.resource_cost || 0);
      const plannedRev = Number(curSummary.planned_revenue || plan.planned_revenue || 0);

      const allocsRes = await q('SELECT * FROM plan_overhead_allocations WHERE plan_id = $1', [planId]);
      for (const a of allocsRes.rows) {
        let baseAmount = Number(a.base_amount || 0);
        if (a.allocation_base === 'material_cost') baseAmount = materialCost;
        else if (a.allocation_base === 'subcontractor_cost') baseAmount = subCost;
        else if (a.allocation_base === 'outsourced_cost') baseAmount = outCost;
        else if (a.allocation_base === 'labor_cost') baseAmount = resCost;
        else if (a.allocation_base === 'planned_revenue') baseAmount = plannedRev;
        else if (a.allocation_base === 'total_direct_cost' || baseAmount <= 0) baseAmount = directCost;

        let allocatedAmount = Number(a.allocated_amount || 0);
        const rate = Number(a.allocation_rate || 0);
        const qty = Number(a.unit_quantity || 1);

        if (a.allocation_method === 'fixed_amount') {
          allocatedAmount = rate;
        } else if (a.allocation_method === 'rate_per_unit') {
          allocatedAmount = round2(decMul(rate, qty));
        } else if (a.allocation_method === 'percentage_of_cost_base' || a.allocation_method === 'proportional_defined_base') {
          allocatedAmount = round2(decDiv(decMul(baseAmount, rate), 100));
        }

        await q(
          `UPDATE plan_overhead_allocations SET base_amount = $1, allocated_amount = $2, updated_at = NOW() WHERE id = $3`,
          [baseAmount, allocatedAmount, a.id]
        );
        await q(
          `UPDATE project_plan_overhead_allocations SET base_amount = $1, allocated_amount = $2 WHERE id = $3`,
          [baseAmount, allocatedAmount, a.id]
        );
      }

      await this.internalRecalculatePlanCostSummary(q, planId);

      // Audit log
      await q(
        `INSERT INTO overhead_audit_logs (
          id, plan_id, plan_number, action, actor_id, actor_name, actor_role, change_description, created_at
        ) VALUES ($1, $2, $3, 'BASE_RECALCULATED', $4, $5, $6, $7, NOW())`,
        [
          `oal-${Date.now()}-5`, planId, plan.plan_number,
          actor?.id || null, actor?.name || 'System Finance', actor?.role || 'ADMIN',
          `Recalculated all overhead allocations on Plan ${plan.plan_number} against updated cost bases.`
        ]
      );

      return await this.getPlanOverheadAllocations(planId);
    });
  }

  public async recalculatePlanFinancials(planId: string, q?: any): Promise<any> {
    const queryFn = q || (async (sql: string, params?: any[]) => {
      const db = await this.getDb();
      return db.query(sql, params);
    });
    return await this.internalRecalculatePlanCostSummary(queryFn, planId);
  }

  private async internalRecalculatePlanCostSummary(q: (sql: string, params?: any[]) => Promise<{ rows: any[] }>, planId: string): Promise<any> {
    const planRes = await q('SELECT * FROM project_plans WHERE id = $1', [planId]);
    if (!planRes.rows || planRes.rows.length === 0) return null;
    const plan = planRes.rows[0];

    const boqRes = await q('SELECT * FROM project_plan_boq_items WHERE plan_id = $1 ORDER BY line_order ASC', [planId]).catch(() => ({ rows: [] }));
    const resRes = await q('SELECT * FROM project_plan_resources WHERE plan_id = $1 ORDER BY created_at ASC', [planId]).catch(() => ({ rows: [] }));
    const secRes = await q('SELECT * FROM project_plan_sections WHERE plan_id = $1 ORDER BY sequence_order ASC', [planId]).catch(() => ({ rows: [] }));
    const ovhRes = await q(`SELECT poa.*, oi.category FROM plan_overhead_allocations poa LEFT JOIN overhead_items oi ON oi.id = poa.overhead_item_id WHERE poa.plan_id = $1`, [planId]).catch(() => ({ rows: [] }));
    const projRes = await q('SELECT * FROM projects WHERE id = $1', [plan.project_id]).catch(() => ({ rows: [] }));
    const proj = projRes.rows[0] || {};

    const boqTotalRevenue = boqRes.rows.reduce((sum: number, b: any) => sum + Number(b.total_revenue || 0), 0);
    const plannedRevenue = boqTotalRevenue > 0 ? boqTotalRevenue : Number(plan.planned_revenue || proj.quoted_price || 0);

    const calc = calculatePlanFinancials({
      planId,
      projectId: plan.project_id,
      currency: plan.currency || proj.currency || 'LKR',
      plannedRevenue: round2(plannedRevenue),
      projectQuotedPrice: round2(proj.quoted_price || 0),
      targetMarginPct: round2(plan.target_margin_pct ?? 25),
      overheadPct: round2(plan.overhead_pct ?? 8.5),
      contingencyPct: round2(plan.contingency_pct ?? 5.0),
      laborBurdenPct: round2(plan.labor_burden_pct ?? 0),
      boqItems: boqRes.rows,
      sections: secRes.rows,
      resources: resRes.rows.map((r: any) => ({
        id: r.id,
        planId: r.plan_id || r.planId,
        projectId: r.project_id || r.projectId,
        sectionId: r.section_id || r.sectionId,
        resourceId: r.resource_id || r.resourceId,
        resourceType: r.resource_type || r.resourceType,
        name: r.name,
        roleOrTrade: r.role_or_trade || r.roleOrTrade,
        allocatedHours: Number(r.allocated_hours ?? r.allocatedHours ?? 0),
        hourlyRate: Number(r.hourly_rate ?? r.hourlyRate ?? 0),
        totalCost: Number(r.total_cost ?? r.totalCost ?? 0),
        startDate: r.start_date || r.startDate,
        endDate: r.end_date || r.endDate,
        notes: r.notes || ''
      })),
      overheadAllocations: ovhRes.rows
    });

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
        planId, plan.project_id,
        calc.summary.plannedRevenue, calc.summary.materialCost, calc.summary.subcontractorCost,
        calc.summary.outsourcedCost, calc.summary.resourceCost, calc.summary.directCost,
        calc.summary.overheadAmount, calc.summary.contingencyAmount, calc.summary.laborBurdenAmount,
        calc.summary.extraOverheadAmount, calc.summary.allocatedOverhead, calc.summary.totalPlannedCost,
        calc.summary.grossProfit, calc.summary.grossMarginPct, calc.summary.plannedProfit,
        calc.summary.profitMarginPct, calc.summary.boqItemCount, calc.summary.sectionCount,
        calc.summary.resourceCount
      ]
    );

    // Update project_plans summary cache
    await q(
      `UPDATE project_plans SET
        direct_cost = $1,
        allocated_overhead = $2,
        total_planned_cost = $3,
        gross_profit = $4,
        gross_margin_pct = $5,
        planned_profit = $6,
        profit_margin_pct = $7,
        updated_at = NOW()
       WHERE id = $8`,
      [
        calc.summary.directCost,
        calc.summary.allocatedOverhead,
        calc.summary.totalPlannedCost,
        calc.summary.grossProfit,
        calc.summary.grossMarginPct,
        calc.summary.plannedProfit,
        calc.summary.profitMarginPct,
        planId
      ]
    ).catch(() => {});

    return calc.summary;
  }

  // --- Overhead Audit Logs (Requirement 21) ---
  public async getOverheadAuditLogs(opts?: ListQueryOptions): Promise<PaginatedResult<any>> {
    const db = await this.getDb();
    let query = `SELECT * FROM overhead_audit_logs ORDER BY created_at DESC`;
    const res = await db.query(query);

    const rows = res.rows.map((r: any) => ({
      id: r.id,
      overheadItemId: r.overhead_item_id,
      overheadItemCode: r.overhead_item_code,
      overheadItemName: r.overhead_item_name,
      planId: r.plan_id,
      planNumber: r.plan_number,
      allocationId: r.allocation_id,
      action: r.action,
      actorId: r.actor_id,
      actorName: r.actor_name,
      actorRole: r.actor_role,
      previousState: typeof r.previous_state === 'string' ? JSON.parse(r.previous_state) : r.previous_state,
      newState: typeof r.new_state === 'string' ? JSON.parse(r.new_state) : r.new_state,
      changeDescription: r.change_description,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
    }));

    return parseFilterPagination(
      rows,
      opts,
      ['overheadItemName', 'overheadItemCode', 'planNumber', 'action', 'actorName', 'changeDescription'],
      ''
    );
  }

  public async createOverheadAuditLog(data: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `oal-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    await db.query(
      `INSERT INTO overhead_audit_logs (
        id, overhead_item_id, overhead_item_code, overhead_item_name, plan_id, plan_number,
        allocation_id, action, actor_id, actor_name, actor_role, previous_state, new_state,
        change_description, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())`,
      [
        id, data.overheadItemId || null, data.overheadItemCode || null, data.overheadItemName || null,
        data.planId || null, data.planNumber || null, data.allocationId || null,
        data.action || 'OVERHEAD_CHANGE', data.actorId || null, data.actorName || 'System Finance',
        data.actorRole || 'ADMIN', JSON.stringify(data.previousState || {}),
        JSON.stringify(data.newState || {}), data.changeDescription || ''
      ]
    );
    return { ...data, id };
  }

  // ============================================================================
  // REVENUE CATALOGUE, PLAN BOQ & COMMERCIAL RATE TRACKING (TASK 3)
  // ============================================================================

  // --- Revenue Categories ---
  public async getRevenueCategories(): Promise<any[]> {
    const db = await this.getDb();
    try {
      const res = await db.query('SELECT * FROM revenue_categories ORDER BY sort_order ASC, name ASC');
      return res.rows.map((r: any) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        type: r.type || 'both',
        description: r.description || '',
        sortOrder: Number(r.sort_order || 0),
        isActive: Boolean(r.is_active),
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString()
      }));
    } catch {
      return [];
    }
  }

  public async createRevenueCategory(data: any): Promise<any> {
    const db = await this.getDb();
    const name = String(data?.name || '').trim();
    if (!name) {
      throw Object.assign(new Error('Category name is required.'), { status: 400 });
    }
    const id = data.id || `revcat-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const code = String(data.code || `CAT-${name.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '')}`).trim();
    const type = ['product', 'service', 'both'].includes(data.type) ? data.type : 'both';
    await db.query(
      `INSERT INTO revenue_categories (id, code, name, type, description, sort_order, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, sort_order = EXCLUDED.sort_order, updated_at = NOW()`,
      [id, code, name, type, String(data.description || ''), Number(data.sortOrder || 0), data.isActive !== false]
    );
    return { id, code, name, type, description: data.description || '', sortOrder: Number(data.sortOrder || 0), isActive: data.isActive !== false };
  }

  public async updateRevenueCategory(id: string, data: any): Promise<any | null> {
    const db = await this.getDb();
    const cats = await this.getRevenueCategories();
    const existing = cats.find((c) => c.id === id);
    if (!existing) return null;
    const name = data.name !== undefined ? String(data.name).trim() : existing.name;
    const code = data.code !== undefined ? String(data.code).trim().toUpperCase() : existing.code;
    const type = data.type !== undefined ? data.type : existing.type;
    const desc = data.description !== undefined ? String(data.description) : existing.description;
    const sortOrder = data.sortOrder !== undefined ? Number(data.sortOrder) : existing.sortOrder;
    const isActive = data.isActive !== undefined ? Boolean(data.isActive) : existing.isActive;

    await db.query(
      `UPDATE revenue_categories SET code = $1, name = $2, type = $3, description = $4, sort_order = $5, is_active = $6, updated_at = NOW() WHERE id = $7`,
      [code, name, type, desc, sortOrder, isActive, id]
    );
    return { ...existing, code, name, type, description: desc, sortOrder, isActive };
  }

  public async deleteRevenueCategory(id: string): Promise<boolean> {
    const db = await this.getDb();
    const catRes = await db.query('SELECT name FROM revenue_categories WHERE id = $1', [id]);
    if (catRes.rows.length === 0) return false;
    const catName = catRes.rows[0].name;

    const inUse = await db.query('SELECT COUNT(*) as cnt FROM revenue_items WHERE category = $1', [catName]);
    if (Number(inUse.rows[0]?.cnt || 0) > 0) {
      throw Object.assign(
        new Error(`Cannot delete category '${catName}' because it is in use by ${inUse.rows[0].cnt} revenue catalogue item(s).`),
        { status: 400 }
      );
    }
    await db.query('DELETE FROM revenue_categories WHERE id = $1', [id]);
    return true;
  }

  // --- Revenue Subcategories ---
  public async getRevenueSubcategories(categoryId?: string): Promise<any[]> {
    const db = await this.getDb();
    try {
      const sql = categoryId
        ? 'SELECT * FROM revenue_subcategories WHERE category_id = $1 ORDER BY sort_order ASC, name ASC'
        : 'SELECT * FROM revenue_subcategories ORDER BY sort_order ASC, name ASC';
      const params = categoryId ? [categoryId] : [];
      const res = await db.query(sql, params);
      return res.rows.map((r: any) => ({
        id: r.id,
        categoryId: r.category_id,
        categoryName: r.category_name,
        code: r.code,
        name: r.name,
        description: r.description || '',
        sortOrder: Number(r.sort_order || 0),
        isActive: Boolean(r.is_active)
      }));
    } catch {
      return [];
    }
  }

  public async createRevenueSubcategory(data: any): Promise<any> {
    const db = await this.getDb();
    const name = String(data?.name || '').trim();
    if (!name) {
      throw Object.assign(new Error('Subcategory name is required.'), { status: 400 });
    }
    const id = data.id || `revsub-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const code = String(data.code || `SUB-${name.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '')}`).trim();
    await db.query(
      `INSERT INTO revenue_subcategories (id, category_id, category_name, code, name, description, sort_order, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
      [id, data.categoryId || null, data.categoryName || '', code, name, String(data.description || ''), Number(data.sortOrder || 0), data.isActive !== false]
    );
    return { id, categoryId: data.categoryId, categoryName: data.categoryName, code, name, description: data.description || '', sortOrder: Number(data.sortOrder || 0), isActive: data.isActive !== false };
  }

  // --- Centralized Revenue Catalogue Items (Requirements 2, 3, 4, 5, 6, 20) ---
  public async getRevenueItems(opts?: ListQueryOptions): Promise<any[]> {
    const result = await this.getRevenueItemsPaginated({ ...(opts || {}), limit: 10000 });
    return result.data;
  }

  public async getRevenueItemsPaginated(opts?: ListQueryOptions): Promise<PaginatedResult<any>> {
    const db = await this.getDb();
    // Query revenue items with active plans count and total quoted revenue aggregation
    const res = await db.query(`
      SELECT 
        ri.*,
        COUNT(DISTINCT boq.plan_id) AS linked_plans_count,
        COALESCE(SUM(boq.total_revenue), 0) AS total_quoted_revenue
      FROM revenue_items ri
      LEFT JOIN project_plan_boq_items boq ON boq.revenue_item_id = ri.id
      GROUP BY ri.id
      ORDER BY ri.created_at DESC
    `);

    const rows = res.rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      barcode: r.barcode || `BC-${r.code}`,
      name: r.name,
      type: r.type,
      category: r.category,
      subCategory: r.sub_category || '',
      categoryId: r.category_id || null,
      subCategoryId: r.sub_category_id || null,
      themeId: r.theme_id || null,
      customGradient: r.custom_gradient || null,
      description: r.description || '',
      unit: r.unit || 'unit',
      defaultRate: round4(Number(r.default_rate || 0)),
      costPrice: round4(Number(r.cost_price || 0)),
      currency: r.currency || 'USD',
      taxTreatment: r.tax_treatment || 'Standard (0%)',
      taxRatePct: round2(Number(r.tax_rate_pct || 0)),
      status: r.status || 'Active',
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
      linkedPlansCount: Number(r.linked_plans_count || 0),
      totalQuotedRevenue: round2(Number(r.total_quoted_revenue || 0))
    }));

    return parseFilterPagination(
      rows,
      opts,
      ['name', 'code', 'barcode', 'category', 'subCategory', 'type', 'description', 'status'],
      'name'
    );
  }

  public async getRevenueItemById(id: string): Promise<any | null> {
    if (!id) return null;
    const db = await this.getDb();
    const itemRes = await db.query(`SELECT * FROM revenue_items WHERE id = $1`, [id]);
    if (itemRes.rows.length === 0) return null;
    const r = itemRes.rows[0];

    const [linkedPlansRes, historyRes] = await Promise.all([
      db.query(`
        SELECT 
          boq.id as boq_item_id,
          boq.plan_id,
          pp.plan_number,
          pp.name as plan_name,
          boq.project_id,
          p.code as project_code,
          p.name as project_name,
          boq.quantity,
          boq.unit,
          boq.rate,
          boq.discount_pct,
          boq.total_revenue,
          boq.created_at
        FROM project_plan_boq_items boq
        INNER JOIN project_plans pp ON pp.id = boq.plan_id
        INNER JOIN projects p ON p.id = boq.project_id
        WHERE boq.revenue_item_id = $1
        ORDER BY pp.updated_at DESC
      `, [id]),
      db.query(`
        SELECT 
          rrh.*,
          rrh.effective_date::text AS effective_date_iso,
          p.code AS project_code,
          p.name AS project_name,
          pp.plan_number,
          pp.name AS plan_name
        FROM revenue_rate_history rrh
        INNER JOIN projects p ON p.id = rrh.project_id
        INNER JOIN project_plans pp ON pp.id = rrh.project_plan_id
        WHERE rrh.revenue_item_id = $1
        ORDER BY rrh.recorded_at DESC
      `, [id])
    ]);

    return {
      id: r.id,
      code: r.code,
      barcode: r.barcode || `BC-${r.code}`,
      name: r.name,
      type: r.type,
      category: r.category,
      subCategory: r.sub_category || '',
      categoryId: r.category_id || null,
      subCategoryId: r.sub_category_id || null,
      themeId: r.theme_id || null,
      customGradient: r.custom_gradient || null,
      description: r.description || '',
      unit: r.unit || 'unit',
      defaultRate: round4(Number(r.default_rate || 0)),
      costPrice: round4(Number(r.cost_price || 0)),
      currency: r.currency || 'USD',
      taxTreatment: r.tax_treatment || 'Standard (0%)',
      taxRatePct: round2(Number(r.tax_rate_pct || 0)),
      status: r.status || 'Active',
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
      linkedPlansCount: linkedPlansRes.rows.length,
      totalQuotedRevenue: round2(linkedPlansRes.rows.reduce((sum: number, row: any) => sum + Number(row.total_revenue || 0), 0)),
      linkedPlans: linkedPlansRes.rows.map((row: any) => ({
        boqItemId: row.boq_item_id,
        planId: row.plan_id,
        planNumber: row.plan_number,
        planName: row.plan_name,
        projectId: row.project_id,
        projectCode: row.project_code,
        projectName: row.project_name,
        quantity: round4(row.quantity),
        unit: row.unit,
        rate: round4(row.rate),
        discountPct: round2(row.discount_pct || 0),
        totalRevenue: round2(row.total_revenue),
        createdAt: row.created_at
      })),
      rateHistory: historyRes.rows.map((h: any) => ({
        id: h.id,
        revenueItemId: h.revenue_item_id,
        projectId: h.project_id,
        projectCode: h.project_code,
        projectName: h.project_name,
        projectPlanId: h.project_plan_id,
        planNumber: h.plan_number,
        planName: h.plan_name,
        planBoqItemId: h.plan_boq_item_id,
        previousUnit: h.previous_unit,
        newUnit: h.new_unit,
        previousQuantity: h.previous_quantity !== null ? round4(h.previous_quantity) : null,
        newQuantity: round4(h.new_quantity),
        previousRate: h.previous_rate !== null ? round4(h.previous_rate) : null,
        newRate: round4(h.new_rate),
        changeType: h.change_type,
        fieldsChanged: typeof h.fields_changed === 'string' ? JSON.parse(h.fields_changed) : h.fields_changed || [],
        effectiveDate: formatSqlDate(h.effective_date_iso || h.effective_date, ''),
        recordedAt: h.recorded_at ? new Date(h.recorded_at).toISOString() : new Date().toISOString(),
        changedBy: h.changed_by,
        changeReason: h.change_reason || '',
        commercialContext: h.commercial_context || ''
      }))
    };
  }

  public async createRevenueItem(data: any, actor?: { id?: string; name?: string; role?: string }): Promise<any> {
    const db = await this.getDb();
    const name = String(data?.name || '').trim();
    if (!name) {
      throw Object.assign(new Error('Revenue item name is required.'), { status: 400 });
    }
    const type = data.type === 'service' ? 'service' : 'product';
    const category = String(data?.category || (type === 'service' ? 'Engineering & Design Consultancy' : 'Architectural & Structural Aluminium')).trim();
    const id = data.id || `rev-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    // Auto-generate unique code if not provided
    let code = data.code ? String(data.code).trim().toUpperCase() : '';
    if (!code) {
      const prefix = type === 'service' ? 'REV-SRV' : 'REV-PRD';
      const countRes = await db.query('SELECT COUNT(*) as cnt FROM revenue_items');
      const seq = Number(countRes.rows[0]?.cnt || 0) + 1;
      code = `${prefix}-${String(seq).padStart(3, '0')}`;
      let attempt = 1;
      while (true) {
        const dup = await db.query('SELECT id FROM revenue_items WHERE code = $1', [code]);
        if (dup.rows.length === 0) break;
        attempt++;
        code = `${prefix}-${String(seq + attempt).padStart(3, '0')}`;
      }
    } else {
      const dup = await db.query('SELECT id FROM revenue_items WHERE code = $1', [code]);
      if (dup.rows.length > 0) {
        throw Object.assign(new Error(`Revenue item code '${code}' already exists.`), { status: 409 });
      }
    }

    // Auto-generate barcode if not provided
    const eType = type === 'service' ? 'revenue_service' : 'revenue_product';
    let barcode = data.barcode ? String(data.barcode).trim().toUpperCase() : '';
    if (!barcode) {
      barcode = await this.generateUniqueBarcode(eType, code);
    }

    const defaultRate = round4(Number(data.defaultRate ?? data.sellingRate ?? data.rate ?? 0));
    if (!Number.isFinite(defaultRate) || defaultRate < 0) {
      throw Object.assign(new Error('Default selling rate must be a non-negative number.'), { status: 400 });
    }
    const costPrice = round4(Number(data.costPrice ?? 0));
    const unit = String(data.unit || 'unit').trim();
    const currency = String(data.currency || 'USD').trim().toUpperCase();
    const status = ['Active', 'Inactive', 'Archived'].includes(data.status) ? data.status : 'Active';

    await db.query(
      `INSERT INTO revenue_items (
        id, code, barcode, name, type, category, sub_category, category_id, sub_category_id,
        theme_id, custom_gradient, description, unit,
        default_rate, cost_price, currency, tax_treatment, tax_rate_pct, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW())`,
      [
        id, code, barcode, name, type, category, String(data.subCategory || ''),
        data.categoryId || null, data.subCategoryId || null,
        data.themeId || null, data.customGradient || null,
        String(data.description || ''), unit, defaultRate, costPrice, currency,
        data.taxTreatment || 'Standard (0%)', round2(Number(data.taxRatePct ?? 0)), status
      ]
    );

    await this.registerBarcode({
      barcode,
      entityType: eType,
      entityId: id,
      entityCode: code,
      entityName: name,
      category,
      subCategory: String(data.subCategory || ''),
      unit,
      unitCost: costPrice,
      sellingRate: defaultRate,
      currency,
      isCostEligible: false,
      isBoqEligible: true
    }).catch((err) => console.warn('[Barcode] Register revenue barcode warning:', err?.message));

    return await this.getRevenueItemById(id);
  }

  public async updateRevenueItem(id: string, data: any, actor?: { id?: string; name?: string; role?: string }): Promise<any | null> {
    const db = await this.getDb();
    const existing = await this.getRevenueItemById(id);
    if (!existing) return null;

    const name = data.name !== undefined ? String(data.name).trim() : existing.name;
    if (!name) {
      throw Object.assign(new Error('Revenue item name cannot be empty.'), { status: 400 });
    }

    const code = data.code !== undefined ? String(data.code).trim().toUpperCase() : existing.code;
    if (code !== existing.code) {
      const dup = await db.query('SELECT id FROM revenue_items WHERE code = $1 AND id != $2', [code, id]);
      if (dup.rows.length > 0) {
        throw Object.assign(new Error(`Revenue item code '${code}' already exists.`), { status: 409 });
      }
    }

    const type = data.type !== undefined ? (data.type === 'service' ? 'service' : 'product') : existing.type;
    const category = data.category !== undefined ? String(data.category).trim() : existing.category;
    const subCategory = data.subCategory !== undefined ? String(data.subCategory) : (existing.subCategory || '');
    const categoryId = data.categoryId !== undefined ? data.categoryId : (existing.categoryId || null);
    const subCategoryId = data.subCategoryId !== undefined ? data.subCategoryId : (existing.subCategoryId || null);
    const themeId = data.themeId !== undefined ? data.themeId : (existing.themeId || null);
    const customGradient = data.customGradient !== undefined ? data.customGradient : (existing.customGradient || null);
    const description = data.description !== undefined ? String(data.description) : existing.description;
    const unit = data.unit !== undefined ? String(data.unit).trim() : existing.unit;
    const defaultRate = data.defaultRate !== undefined ? round4(Number(data.defaultRate)) : existing.defaultRate;
    const costPrice = data.costPrice !== undefined ? round4(Number(data.costPrice)) : existing.costPrice;
    const currency = data.currency !== undefined ? String(data.currency).trim().toUpperCase() : existing.currency;
    const taxTreatment = data.taxTreatment !== undefined ? data.taxTreatment : existing.taxTreatment;
    const taxRatePct = data.taxRatePct !== undefined ? round2(Number(data.taxRatePct)) : existing.taxRatePct;
    const status = data.status !== undefined ? data.status : existing.status;
    const barcode = data.barcode !== undefined ? String(data.barcode).trim().toUpperCase() : existing.barcode;

    // Requirement 10: Changing catalogue default selling rate DOES NOT alter existing plan BOQ items
    await db.query(
      `UPDATE revenue_items SET
        code = $1, barcode = $2, name = $3, type = $4, category = $5, sub_category = $6,
        category_id = $7, sub_category_id = $8, theme_id = $9, custom_gradient = $10,
        description = $11, unit = $12, default_rate = $13, cost_price = $14, currency = $15,
        tax_treatment = $16, tax_rate_pct = $17, status = $18, updated_at = NOW()
       WHERE id = $19`,
      [
        code, barcode, name, type, category, subCategory,
        categoryId, subCategoryId, themeId, customGradient,
        description, unit, defaultRate, costPrice, currency,
        taxTreatment, taxRatePct, status, id
      ]
    );

    if (barcode) {
      await this.registerBarcode({
        barcode,
        entityType: type === 'service' ? 'revenue_service' : 'revenue_product',
        entityId: id,
        entityCode: code,
        entityName: name,
        category,
        subCategory,
        unit,
        unitCost: costPrice,
        sellingRate: defaultRate,
        currency,
        isCostEligible: false,
        isBoqEligible: true
      }).catch((err) => console.warn('[Barcode] Update revenue barcode warning:', err?.message));
    }

    // Record rate change history if rate or cost was modified
    if (defaultRate !== existing.defaultRate || costPrice !== existing.costPrice) {
      const histId = `rrh-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      const fields = [];
      if (defaultRate !== existing.defaultRate) fields.push('default_rate');
      if (costPrice !== existing.costPrice) fields.push('cost_price');
      await db.query(
        `INSERT INTO revenue_rate_history (
          id, revenue_item_id, previous_rate, new_rate, change_type, fields_changed,
          effective_date, recorded_at, changed_by, change_reason, commercial_context
        ) VALUES ($1, $2, $3, $4, 'rate_change', $5, CURRENT_DATE, NOW(), $6, $7, $8)`,
        [
          histId,
          id,
          existing.defaultRate,
          defaultRate,
          JSON.stringify(fields),
          actor?.name || 'System User',
          data.changeReason || data.reason || 'Catalogue commercial rate revised',
          'Revenue Catalogue Rate Update'
        ]
      ).catch((err) => console.warn('[PostgreSQL] Revenue rate history record warning:', err?.message));
    }

    return await this.getRevenueItemById(id);
  }

  public async commitRevenueItemPrice(
    id: string,
    data: any,
    actor?: { id?: string; name?: string; role?: string }
  ): Promise<any> {
    const db = await this.getDb();
    const existing = await this.getRevenueItemById(id);
    if (!existing) throw Object.assign(new Error(`Revenue item '${id}' not found.`), { status: 404 });

    const newRate = data.rate !== undefined ? round4(Number(data.rate)) : (data.defaultRate !== undefined ? round4(Number(data.defaultRate)) : existing.defaultRate);
    const newCost = data.costPrice !== undefined ? round4(Number(data.costPrice)) : existing.costPrice;
    const effectiveDate = formatSqlDate(data.effectiveDate, new Date().toISOString().slice(0, 10));
    const reason = String(data.reason || data.changeReason || 'Revenue price revision committed');
    const quoteRef = String(data.quoteRef || `QT-${existing.code || 'REV'}-${Date.now().toString().slice(-4)}`);
    const actorName = actor?.name || data.updatedBy || 'Pricing Manager';

    await db.query(
      `UPDATE revenue_items SET default_rate = $1, cost_price = $2, updated_at = NOW() WHERE id = $3`,
      [newRate, newCost, id]
    );

    const histId = `rrh-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    await db.query(
      `INSERT INTO revenue_rate_history (
        id, revenue_item_id, previous_rate, new_rate, change_type, fields_changed,
        effective_date, recorded_at, changed_by, change_reason, commercial_context
      ) VALUES ($1, $2, $3, $4, 'rate_change', $5, $6::date, NOW(), $7, $8, $9)`,
      [
        histId,
        id,
        existing.defaultRate,
        newRate,
        JSON.stringify(['default_rate', 'cost_price']),
        effectiveDate,
        actorName,
        reason,
        `Price revision ref: ${quoteRef}`
      ]
    );

    return await this.getRevenueItemById(id);
  }

  public async getRevenueItemPriceHistory(id: string): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query(
      `SELECT * FROM revenue_rate_history WHERE revenue_item_id = $1 ORDER BY effective_date DESC, recorded_at DESC`,
      [id]
    );
    return res.rows.map((r: any) => ({
      id: r.id,
      revenueItemId: r.revenue_item_id,
      projectId: r.project_id,
      projectPlanId: r.project_plan_id,
      planBoqItemId: r.plan_boq_item_id,
      previousUnit: r.previous_unit,
      newUnit: r.new_unit,
      previousQuantity: r.previous_quantity != null ? Number(r.previous_quantity) : null,
      newQuantity: r.new_quantity != null ? Number(r.new_quantity) : null,
      previousRate: r.previous_rate != null ? round4(r.previous_rate) : null,
      newRate: round4(r.new_rate),
      changeType: r.change_type,
      fieldsChanged: typeof r.fields_changed === 'string' ? JSON.parse(r.fields_changed) : r.fields_changed || [],
      effectiveDate: formatSqlDate(r.effective_date, new Date().toISOString().slice(0, 10)),
      recordedAt: r.recorded_at,
      changedBy: r.changed_by,
      changeReason: r.change_reason,
      commercialContext: r.commercial_context
    }));
  }

  public async getRevenueServices(opts?: ListQueryOptions): Promise<any[]> {
    const all = await this.getRevenueItems({ ...opts, type: 'service' });
    return all.filter((i) => i.type === 'service');
  }

  public async deleteRevenueItem(id: string, actor?: { id?: string; name?: string; role?: string }): Promise<boolean> {
    const db = await this.getDb();
    const existing = await this.getRevenueItemById(id);
    if (!existing) return false;

    // If linked to active plans, soft-delete by setting status = 'Archived' (to preserve historical integrity)
    if (existing.linkedPlansCount > 0) {
      await db.query(`UPDATE revenue_items SET status = 'Archived', updated_at = NOW() WHERE id = $1`, [id]);
      return true;
    }

    await db.query('DELETE FROM revenue_items WHERE id = $1', [id]);
    return true;
  }

  // --- Plan BOQ Line Items (Requirements 8, 9, 10, 11, 12, 18, 19, 22) ---
  public async getPlanBoqItems(planId: string, opts?: ListQueryOptions): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query(
      `SELECT boq.*, ri.code as revenue_item_code, ri.name as revenue_item_name
       FROM project_plan_boq_items boq
       LEFT JOIN revenue_items ri ON ri.id = boq.revenue_item_id
       WHERE boq.plan_id = $1
       ORDER BY boq.line_order ASC, boq.created_at ASC`,
      [planId]
    );

    const rows = res.rows.map((b: any) => ({
      id: b.id,
      planId: b.plan_id,
      projectId: b.project_id,
      sectionId: b.section_id || undefined,
      phaseId: b.phase_id || 'phase-01',
      type: b.item_type || 'product',
      itemId: b.catalog_item_id || b.item_code || b.id,
      itemCode: b.item_code || b.catalog_item_id || b.id,
      revenueItemId: b.revenue_item_id || undefined,
      revenueItemCode: b.revenue_item_code || undefined,
      revenueItemName: b.revenue_item_name || undefined,
      name: b.name,
      category: b.category || '',
      subCategory: b.sub_category || '',
      supplierOrProvider: b.supplier_or_provider || '',
      description: b.description || '',
      quantity: round4(b.quantity ?? 1),
      unit: b.unit || 'unit',
      unitCost: round4(b.unit_cost ?? 0),
      discountPct: round2(b.discount_pct ?? 0),
      rate: round4(b.rate ?? b.billable_rate ?? 0),
      sellingRate: round4(b.rate ?? b.billable_rate ?? 0),
      billableRate: round4(b.rate ?? b.billable_rate ?? 0),
      taxTreatment: b.tax_treatment || 'Standard (0%)',
      taxRatePct: round2(b.tax_rate_pct ?? 0),
      taxAmount: round2(b.tax_amount ?? 0),
      totalCost: round2(b.total_cost ?? 0),
      markupPct: round2(b.markup_pct ?? 0),
      totalRevenue: round2(b.total_revenue ?? 0),
      grossProfit: round2(b.gross_profit ?? 0),
      currency: b.currency || 'USD',
      nativeUnitCost: b.native_unit_cost !== null && b.native_unit_cost !== undefined ? round4(b.native_unit_cost) : round4(b.unit_cost ?? 0),
      consumptionRate: round2(b.consumption_rate ?? 100),
      notes: b.notes || '',
      lineOrder: Number(b.line_order || 1),
      snapshotData: typeof b.snapshot_data === 'string' ? JSON.parse(b.snapshot_data) : b.snapshot_data || {},
      commercialContext: b.commercial_context || '',
      createdAt: b.created_at ? new Date(b.created_at).toISOString() : new Date().toISOString()
    }));

    if (opts) {
      return parseFilterPagination(rows, opts, ['name', 'itemCode', 'revenueItemCode', 'category', 'type', 'description'], '').data;
    }
    return rows;
  }

  public async getPlanBoqItemById(planId: string, boqItemId: string): Promise<any | null> {
    const items = await this.getPlanBoqItems(planId);
    return items.find((i) => i.id === boqItemId) || null;
  }

  public async addRevenueItemToPlan(
    planId: string,
    data: any,
    actor?: { id?: string; name?: string; role?: string }
  ): Promise<{ boqItem: any; historyRecord: any }> {
    return this.withTransaction(async (q) => {
      // 1. Validate plan exists and lock it
      const planRes = await q('SELECT * FROM project_plans WHERE id = $1 FOR UPDATE', [planId]);
      if (planRes.rows.length === 0) {
        throw Object.assign(new Error(`Project plan '${planId}' does not exist.`), { status: 404 });
      }
      const plan = planRes.rows[0];
      const projectId = plan.project_id;

      // 2. Resolve revenue catalogue item if provided
      let revItem: any = null;
      const revItemId = data.revenueItemId || data.itemId;
      if (revItemId) {
        const itemRes = await q('SELECT * FROM revenue_items WHERE id = $1', [revItemId]);
        if (itemRes.rows.length > 0) {
          revItem = itemRes.rows[0];
        }
      }

      // If item code or name is provided without revenueItemId, try lookup by code/name
      if (!revItem && (data.code || data.itemCode || data.name)) {
        const itemRes = await q(
          'SELECT * FROM revenue_items WHERE (code IS NOT NULL AND LOWER(code) = LOWER($1)) OR LOWER(name) = LOWER($2)',
          [data.code || data.itemCode || '', data.name || '']
        );
        if (itemRes.rows.length > 0) {
          revItem = itemRes.rows[0];
        }
      }

      // Snapshot original catalogue commercial details (Requirement 12)
      const snapshotData = revItem
        ? {
            catalogueItemId: revItem.id,
            catalogueCode: revItem.code,
            catalogueName: revItem.name,
            catalogueType: revItem.type,
            catalogueDefaultRate: round4(revItem.default_rate),
            catalogueUnit: revItem.unit,
            catalogueCategory: revItem.category,
            catalogueCurrency: revItem.currency
          }
        : (data.snapshotData || {});

      const boqId = data.id || `boq-${planId}-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      const itemType = revItem ? revItem.type : (data.type || 'product');
      const itemCode = revItem ? revItem.code : (data.code || data.itemCode || `BOQ-${Date.now().toString().slice(-4)}`);
      const name = String(data.name || revItem?.name || 'BOQ Item').trim();
      if (!name) {
        throw Object.assign(new Error('Item name is required for BOQ item.'), { status: 400 });
      }

      const description = data.description !== undefined ? String(data.description) : (revItem?.description || '');
      const unit = String(data.unit || revItem?.unit || 'unit').trim();
      const quantity = Math.max(0, round4(Number(data.quantity || 1)));
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw Object.assign(new Error('Quantity must be a positive number greater than 0.'), { status: 400 });
      }

      // Project-specific selling rate (Requirement 9, 10, 11)
      const rate = round4(Number(data.rate ?? data.sellingRate ?? revItem?.default_rate ?? 0));
      if (!Number.isFinite(rate) || rate < 0) {
        throw Object.assign(new Error('Selling rate must be a non-negative number.'), { status: 400 });
      }

      const unitCost = round4(Number(data.unitCost ?? revItem?.cost_price ?? 0));
      const discountPct = Math.max(0, Math.min(100, round2(Number(data.discountPct ?? 0))));
      const { totalAmount: directCostTotal } = calcDiscountedLine(quantity, unitCost, 0);
      const totalCost = round2(directCostTotal);

      // Line Revenue calculation
      const discountedRate = round4(decMul(rate, decSub(1, decDiv(discountPct, 100))));
      const totalRevenue = round2(decMul(quantity, discountedRate));
      const grossProfit = round2(decSub(totalRevenue, totalCost));

      const taxTreatment = String(data.taxTreatment || revItem?.tax_treatment || 'Standard (0%)');
      const taxRatePct = round2(Number(data.taxRatePct ?? revItem?.tax_rate_pct ?? 0));
      const taxAmount = round2(decMul(totalRevenue, decDiv(taxRatePct, 100)));

      // Check for duplicate item in plan BOQ (Requirements 22, 23)
      const targetRevId = revItem ? revItem.id : (data.revenueItemId || null);
      const existingBoqRes = await q(
        `SELECT * FROM project_plan_boq_items
         WHERE plan_id = $1 AND (
           (revenue_item_id IS NOT NULL AND revenue_item_id = $2)
           OR (catalog_item_id IS NOT NULL AND catalog_item_id = $2)
           OR (item_code IS NOT NULL AND LOWER(item_code) = LOWER($3))
         )
         LIMIT 1`,
        [planId, targetRevId || '__none__', itemCode]
      );

      if (existingBoqRes.rows.length > 0) {
        const existingRow = existingBoqRes.rows[0];
        // If caller explicitly requested to increment on duplicate/repeat scan
        if (data.incrementOnDuplicate || data.incrementIfExists || data.onDuplicate === 'increment') {
          const newQty = round4(Number(existingRow.quantity || 0) + quantity);
          const currentRate = round4(Number(existingRow.rate || 0));
          const currentUnitCost = round4(Number(existingRow.unit_cost || 0));
          const currentDisc = round2(Number(existingRow.discount_pct || 0));
          const discountedRate = round4(decMul(currentRate, decSub(1, decDiv(currentDisc, 100))));
          const newTotalCost = round2(decMul(newQty, currentUnitCost));
          const newTotalRev = round2(decMul(newQty, discountedRate));
          const newGrossProfit = round2(decSub(newTotalRev, newTotalCost));

          await q(
            `UPDATE project_plan_boq_items SET
              quantity = $1, total_cost = $2, total_revenue = $3, gross_profit = $4
             WHERE id = $5`,
            [newQty, newTotalCost, newTotalRev, newGrossProfit, existingRow.id]
          );

          await this.recalculatePlanFinancials(planId, q);

          const updatedBoq = await q('SELECT * FROM project_plan_boq_items WHERE id = $1', [existingRow.id]);
          return {
            boqItem: updatedBoq.rows[0],
            historyRecord: null,
            duplicatePrevented: true,
            incremented: true,
            previousQuantity: Number(existingRow.quantity),
            newQuantity: newQty,
            message: `Incremented quantity of existing BOQ item '${existingRow.name}' to ${newQty} ${existingRow.unit}.`
          };
        } else if (data.failOnDuplicate) {
          throw Object.assign(
            new Error(`Item '${existingRow.name}' (${existingRow.item_code}) is already in this plan's BOQ. Scanning again did not create duplicate financial lines.`),
            { status: 409, existingBoqItemId: existingRow.id }
          );
        } else {
          // Never silently duplicate a financial line (Requirement 22, 23)
          return {
            boqItem: existingRow,
            historyRecord: null,
            duplicatePrevented: true,
            incremented: false,
            message: `Item '${existingRow.name}' (${existingRow.item_code}) is already present in this plan's BOQ. Scanning again did not create duplicate financial lines.`
          };
        }
      }

      // Line order
      const lineOrder = Number(data.lineOrder || (await q('SELECT COUNT(*) as cnt FROM project_plan_boq_items WHERE plan_id = $1', [planId])).rows[0]?.cnt || 0) + 1;

      // Insert BOQ Item
      await q(
        `INSERT INTO project_plan_boq_items (
          id, plan_id, project_id, section_id, phase_id, item_type, catalog_item_id, item_code,
          revenue_item_id, rate, description, tax_treatment, tax_rate_pct, tax_amount,
          name, category, supplier_or_provider, quantity, unit, unit_cost, discount_pct,
          total_cost, markup_pct, billable_rate, total_revenue, gross_profit,
          currency, native_unit_cost, consumption_rate, notes, line_order, snapshot_data, commercial_context
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20, $21,
          $22, $23, $24, $25, $26,
          $27, $28, $29, $30, $31, $32, $33
        )`,
        [
          boqId,
          planId,
          projectId,
          data.sectionId || null,
          data.phaseId || 'phase-01',
          itemType,
          revItem ? revItem.id : (data.catalogItemId || null),
          itemCode,
          revItem ? revItem.id : null,
          rate,
          description,
          taxTreatment,
          taxRatePct,
          taxAmount,
          name,
          data.category || revItem?.category || 'General',
          data.supplierOrProvider || 'Company Direct',
          quantity,
          unit,
          unitCost,
          discountPct,
          totalCost,
          round2(Number(data.markupPct || 30)),
          rate,
          totalRevenue,
          grossProfit,
          data.currency || plan.currency || 'USD',
          unitCost,
          round2(Number(data.consumptionRate || 100)),
          String(data.notes || ''),
          lineOrder,
          JSON.stringify(snapshotData),
          String(data.commercialContext || `Initial plan commercial terms`)
        ]
      );

      // Record initial historical commercial rate record in revenue_rate_history (Requirement 13, 14, 18)
      const histId = data.historyId || `rrh-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      const todayIso = new Date().toISOString().slice(0, 10);
      const effectiveDate = formatSqlDate(data.effectiveDate, todayIso);
      const actorName = actor?.name || data.changedBy || 'System User';
      const commercialContext = String(data.commercialContext || `Initial addition to Plan ${plan.plan_number || plan.name}`);
      const changeReason = String(data.changeReason || 'Initial BOQ commercial term assignment');

      let historyRecord: any = null;
      if (revItem || data.revenueItemId) {
        const targetRevId = revItem ? revItem.id : data.revenueItemId;
        await q(
          `INSERT INTO revenue_rate_history (
            id, revenue_item_id, project_id, project_plan_id, plan_boq_item_id,
            previous_unit, new_unit, previous_quantity, new_quantity, previous_rate, new_rate,
            change_type, fields_changed, effective_date, recorded_at, changed_by, change_reason, commercial_context, idempotency_key
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::date, NOW(), $15, $16, $17, $18)
          ON CONFLICT (idempotency_key) DO NOTHING`,
          [
            histId,
            targetRevId,
            projectId,
            planId,
            boqId,
            null,
            unit,
            null,
            quantity,
            null,
            rate,
            'initial_addition',
            JSON.stringify(['initial_addition', 'rate', 'quantity', 'unit']),
            effectiveDate,
            actorName,
            changeReason,
            commercialContext,
            data.idempotencyKey || `init-${planId}-${boqId}`
          ]
        );

        historyRecord = {
          id: histId,
          revenueItemId: targetRevId,
          projectId,
          projectPlanId: planId,
          planBoqItemId: boqId,
          previousUnit: null,
          newUnit: unit,
          previousQuantity: null,
          newQuantity: quantity,
          previousRate: null,
          newRate: rate,
          changeType: 'initial_addition',
          fieldsChanged: ['initial_addition', 'rate', 'quantity', 'unit'],
          effectiveDate,
          changedBy: actorName,
          changeReason,
          commercialContext
        };
      }

      // Recalculate plan financials
      await this.recalculatePlanFinancials(planId, q);

      const boqRow = await q('SELECT * FROM project_plan_boq_items WHERE id = $1', [boqId]);
      return {
        boqItem: boqRow.rows[0],
        historyRecord
      };
    });
  }

  public async updatePlanBoqItem(
    planId: string,
    boqItemId: string,
    data: any,
    actor?: { id?: string; name?: string; role?: string }
  ): Promise<{ boqItem: any; historyRecord?: any }> {
    return this.withTransaction(async (q) => {
      const boqRes = await q('SELECT * FROM project_plan_boq_items WHERE id = $1 AND plan_id = $2 FOR UPDATE', [boqItemId, planId]);
      if (boqRes.rows.length === 0) {
        throw Object.assign(new Error(`BOQ item '${boqItemId}' not found in plan '${planId}'.`), { status: 404 });
      }
      const existing = boqRes.rows[0];
      const planRes = await q('SELECT * FROM project_plans WHERE id = $1', [planId]);
      const plan = planRes.rows[0];
      const projectId = existing.project_id || plan.project_id;

      const oldRate = round4(existing.rate ?? existing.billable_rate ?? 0);
      const oldQty = round4(existing.quantity ?? 1);
      const oldUnit = String(existing.unit || 'unit');

      const newRate = data.rate !== undefined
        ? round4(Number(data.rate))
        : (data.sellingRate !== undefined ? round4(Number(data.sellingRate)) : oldRate);
      if (!Number.isFinite(newRate) || newRate < 0) {
        throw Object.assign(new Error('Selling rate must be a non-negative number.'), { status: 400 });
      }

      const newQty = data.quantity !== undefined ? round4(Number(data.quantity)) : oldQty;
      if (!Number.isFinite(newQty) || newQty <= 0) {
        throw Object.assign(new Error('Quantity must be greater than 0.'), { status: 400 });
      }

      const newUnit = data.unit !== undefined ? String(data.unit).trim() : oldUnit;
      const newDiscountPct = data.discountPct !== undefined ? Math.max(0, Math.min(100, round2(Number(data.discountPct)))) : round2(existing.discount_pct || 0);
      const newDescription = data.description !== undefined ? String(data.description) : (existing.description || '');
      const newTaxTreatment = data.taxTreatment !== undefined ? String(data.taxTreatment) : (existing.tax_treatment || 'Standard (0%)');
      const newTaxRatePct = data.taxRatePct !== undefined ? round2(Number(data.taxRatePct)) : round2(existing.tax_rate_pct || 0);

      const rateChanged = newRate !== oldRate;
      const qtyChanged = newQty !== oldQty;
      const unitChanged = newUnit !== oldUnit;
      const discountChanged = newDiscountPct !== round2(existing.discount_pct || 0);

      const fieldsChanged: string[] = [];
      if (rateChanged) fieldsChanged.push('rate');
      if (qtyChanged) fieldsChanged.push('quantity');
      if (unitChanged) fieldsChanged.push('unit');
      if (discountChanged) fieldsChanged.push('discount_pct');

      const changeType =
        rateChanged && qtyChanged ? 'rate_and_quantity_change' :
        rateChanged ? 'rate_change' :
        qtyChanged ? 'quantity_change' :
        unitChanged ? 'unit_change' :
        'commercial_terms_update';

      // Financial line recalculation
      const unitCost = round4(existing.unit_cost || 0);
      const { totalAmount: directCostTotal } = calcDiscountedLine(newQty, unitCost, 0);
      const totalCost = round2(directCostTotal);
      const discountedRate = round4(decMul(newRate, decSub(1, decDiv(newDiscountPct, 100))));
      const totalRevenue = round2(decMul(newQty, discountedRate));
      const grossProfit = round2(decSub(totalRevenue, totalCost));
      const taxAmount = round2(decMul(totalRevenue, decDiv(newTaxRatePct, 100)));

      // Update project_plan_boq_items
      await q(
        `UPDATE project_plan_boq_items SET
          quantity = $1, unit = $2, rate = $3, billable_rate = $3, discount_pct = $4,
          description = $5, tax_treatment = $6, tax_rate_pct = $7, tax_amount = $8,
          total_cost = $9, total_revenue = $10, gross_profit = $11, updated_at = NOW()
         WHERE id = $12`,
        [
          newQty, newUnit, newRate, newDiscountPct,
          newDescription, newTaxTreatment, newTaxRatePct, taxAmount,
          totalCost, totalRevenue, grossProfit, boqItemId
        ]
      );

      // Record in revenue_rate_history (Requirement 13, 14, 15, 16, 17)
      let historyRecord: any = null;
      const revenueItemId = existing.revenue_item_id || data.revenueItemId;
      if (revenueItemId && (fieldsChanged.length > 0 || data.changeReason)) {
        const histId = data.historyId || `rrh-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
        const todayIso = new Date().toISOString().slice(0, 10);
        const effectiveDate = formatSqlDate(data.effectiveDate, todayIso);
        const actorName = actor?.name || data.changedBy || 'System User';
        const changeReason = String(data.changeReason || `Commercial terms update (${fieldsChanged.join(', ') || 'details'})`);
        const commercialContext = String(data.commercialContext || `Plan ${plan.plan_number || plan.name} commercial terms revised`);

        await q(
          `INSERT INTO revenue_rate_history (
            id, revenue_item_id, project_id, project_plan_id, plan_boq_item_id,
            previous_unit, new_unit, previous_quantity, new_quantity, previous_rate, new_rate,
            change_type, fields_changed, effective_date, recorded_at, changed_by, change_reason, commercial_context, idempotency_key
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::date, NOW(), $15, $16, $17, $18)
          ON CONFLICT (idempotency_key) DO NOTHING`,
          [
            histId,
            revenueItemId,
            projectId,
            planId,
            boqItemId,
            oldUnit,
            newUnit,
            oldQty,
            newQty,
            oldRate,
            newRate,
            changeType,
            JSON.stringify(fieldsChanged),
            effectiveDate,
            actorName,
            changeReason,
            commercialContext,
            data.idempotencyKey || null
          ]
        );

        historyRecord = {
          id: histId,
          revenueItemId,
          projectId,
          projectPlanId: planId,
          planBoqItemId: boqItemId,
          previousUnit: oldUnit,
          newUnit: newUnit,
          previousQuantity: oldQty,
          newQuantity: newQty,
          previousRate: oldRate,
          newRate: newRate,
          changeType,
          fieldsChanged,
          effectiveDate,
          changedBy: actorName,
          changeReason,
          commercialContext
        };
      }

      // Record in audit_logs inside same transaction (Task 9 Requirements 3, 4, 9)
      const auditLogId = `aud-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const auditAction = rateChanged ? 'UPDATE_PLAN_SELLING_RATE' : 'UPDATE_PLAN_BOQ_ITEM';
      const beforeState = {
        sellingRate: oldRate,
        rate: oldRate,
        quantity: oldQty,
        unit: oldUnit,
        discountPct: round2(existing.discount_pct || 0),
        taxTreatment: existing.tax_treatment || 'Standard (0%)',
        totalRevenue: round2(decMul(oldQty, oldRate))
      };
      const afterState = {
        sellingRate: newRate,
        rate: newRate,
        quantity: newQty,
        unit: newUnit,
        discountPct: newDiscountPct,
        taxTreatment: newTaxTreatment,
        totalRevenue: totalRevenue
      };
      const diff = {
        rateChange: round4(decSub(newRate, oldRate)),
        revenueChange: round2(decSub(totalRevenue, round2(decMul(oldQty, oldRate)))),
        fieldsChanged
      };
      const auditChangeReason = String(data.changeReason || (rateChanged ? `Revised plan selling rate from ${oldRate} to ${newRate}` : 'Updated plan BOQ terms'));

      await q(
        `INSERT INTO audit_logs (
          id, timestamp, actor_id, actor_name, actor_role, action, action_type, module,
          entity_type, entity_id, record_id, record_name, project_id, plan_id,
          change_reason, before_state, after_state, diff, metadata, details, ip_address, status, created_at_ts
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20, $21, $22, NOW()
        ) ON CONFLICT (id) DO NOTHING`,
        [
          auditLogId,
          new Date().toISOString(),
          actor?.id || 'usr-system',
          actor?.name || 'System User',
          actor?.role || 'PROJECT_MANAGER',
          auditAction,
          auditAction,
          'Commercial',
          'PlanBoqItem',
          boqItemId,
          boqItemId,
          existing.name || existing.description || 'Plan Commercial BOQ Item',
          projectId,
          planId,
          auditChangeReason,
          JSON.stringify(beforeState),
          JSON.stringify(afterState),
          JSON.stringify(diff),
          JSON.stringify({ planNumber: plan?.plan_number, projectName: plan?.name, revenueItemId }),
          `Plan ${plan?.plan_number || planId}: BOQ item ${boqItemId} selling rate changed from ${oldRate} to ${newRate} (${auditChangeReason})`,
          '127.0.0.1',
          'Success'
        ]
      );

      // Recalculate plan financials
      await this.recalculatePlanFinancials(planId, q);

      const updatedRow = await q('SELECT * FROM project_plan_boq_items WHERE id = $1', [boqItemId]);
      return {
        boqItem: updatedRow.rows[0],
        historyRecord
      };
    });
  }

  public async deletePlanBoqItem(
    planId: string,
    boqItemId: string,
    actor?: { id?: string; name?: string; role?: string }
  ): Promise<boolean> {
    const db = await this.getDb();
    return this.withTransaction(async (q) => {
      const boqRes = await q('SELECT * FROM project_plan_boq_items WHERE id = $1 AND plan_id = $2 FOR UPDATE', [boqItemId, planId]);
      if (boqRes.rows.length === 0) return false;
      await q('DELETE FROM project_plan_boq_items WHERE id = $1', [boqItemId]);
      await this.recalculatePlanFinancials(planId, q);
      return true;
    });
  }

  // --- Historical Commercial Rate Tracking (Requirements 13, 14, 15, 16, 20, 21) ---
  public async getRevenueRateHistory(opts?: ListQueryOptions): Promise<PaginatedResult<any>> {
    const db = await this.getDb();
    const res = await db.query(`
      SELECT 
        rrh.*,
        rrh.effective_date::text AS effective_date_iso,
        ri.code AS revenue_item_code,
        ri.name AS revenue_item_name,
        ri.type AS revenue_item_type,
        p.code AS project_code,
        p.name AS project_name,
        pp.plan_number,
        pp.name AS plan_name
      FROM revenue_rate_history rrh
      INNER JOIN revenue_items ri ON ri.id = rrh.revenue_item_id
      INNER JOIN projects p ON p.id = rrh.project_id
      INNER JOIN project_plans pp ON pp.id = rrh.project_plan_id
      ORDER BY rrh.recorded_at DESC, rrh.effective_date DESC
    `);

    let rows: any[] = res.rows.map((r: any) => ({
      id: r.id,
      entityId: r.revenue_item_id,
      revenueItemId: r.revenue_item_id,
      revenueItemCode: r.revenue_item_code,
      revenueItemName: r.revenue_item_name,
      revenueItemType: r.revenue_item_type,
      projectId: r.project_id,
      projectCode: r.project_code,
      projectName: r.project_name,
      projectPlanId: r.project_plan_id,
      planNumber: r.plan_number,
      planName: r.plan_name,
      planBoqItemId: r.plan_boq_item_id,
      previousUnit: r.previous_unit,
      newUnit: r.new_unit,
      previousQuantity: r.previous_quantity !== null ? round4(r.previous_quantity) : null,
      newQuantity: round4(r.new_quantity),
      previousRate: r.previous_rate !== null ? round4(r.previous_rate) : null,
      newRate: round4(r.new_rate),
      changeType: r.change_type,
      fieldsChanged: typeof r.fields_changed === 'string' ? JSON.parse(r.fields_changed) : r.fields_changed || [],
      effectiveDate: formatSqlDate(r.effective_date_iso || r.effective_date, ''),
      recordedAt: r.recorded_at ? new Date(r.recorded_at).toISOString() : new Date().toISOString(),
      changedBy: r.changed_by,
      changeReason: r.change_reason || '',
      commercialContext: r.commercial_context || '',
      idempotencyKey: r.idempotency_key || undefined
    }));

    if (opts) {
      if (opts.entityId || opts.materialId) {
        const id = opts.entityId || opts.materialId;
        rows = rows.filter((r) => r.revenueItemId === id || r.planBoqItemId === id);
      }
      if (opts.projectId && opts.projectId !== 'ALL') {
        rows = rows.filter((r) => r.projectId === opts.projectId);
      }
      if (opts.planId || (opts as any).projectPlanId) {
        const pid = opts.planId || (opts as any).projectPlanId;
        rows = rows.filter((r) => r.projectPlanId === pid);
      }
    }

    return parseFilterPagination(
      rows,
      opts,
      ['revenueItemCode', 'revenueItemName', 'projectName', 'projectCode', 'planNumber', 'planName', 'changedBy', 'changeReason', 'changeType'],
      ''
    );
  }

  public async getProjectCommercialHistory(projectId: string, opts?: ListQueryOptions): Promise<PaginatedResult<any>> {
    return this.getRevenueRateHistory({ ...(opts || {}), projectId });
  }

  public async getPlanCommercialHistory(planId: string, opts?: ListQueryOptions): Promise<PaginatedResult<any>> {
    return this.getRevenueRateHistory({ ...(opts || {}), planId });
  }

  public async getRevenueItemRateHistory(revenueItemId: string, opts?: ListQueryOptions): Promise<PaginatedResult<any>> {
    return this.getRevenueRateHistory({ ...(opts || {}), entityId: revenueItemId });
  }

  // --- TASK 5: Supplier, Vendor, Outsourced Service & Subcontractor Price History System ---
  public async ensureProcurementPriceTables(): Promise<void> {
    const db = this.db!;
    try {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS procurement_price_history (
          id TEXT PRIMARY KEY,
          supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
          supplier_name TEXT NOT NULL,
          item_type TEXT NOT NULL CHECK (item_type IN ('material', 'outsourced_service', 'subcontractor_rate', 'procurement_item')),
          item_id TEXT NOT NULL,
          item_code TEXT,
          item_name TEXT NOT NULL,
          category TEXT DEFAULT '',
          sub_category TEXT DEFAULT '',
          material_id TEXT REFERENCES materials(id) ON DELETE CASCADE,
          outsourced_service_id TEXT REFERENCES outsourced_services(id) ON DELETE CASCADE,
          subcontractor_id TEXT REFERENCES subcontractors(id) ON DELETE CASCADE,
          project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
          project_plan_id TEXT REFERENCES project_plans(id) ON DELETE SET NULL,
          unit TEXT NOT NULL DEFAULT 'unit',
          unit_price NUMERIC(18, 4) NOT NULL CHECK (unit_price >= 0),
          currency TEXT NOT NULL DEFAULT 'USD',
          effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
          recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          quotation_ref TEXT,
          valid_from DATE,
          valid_until DATE,
          recorded_by TEXT NOT NULL DEFAULT 'System User',
          notes TEXT DEFAULT '',
          price_type TEXT NOT NULL DEFAULT 'supplier_quotation' CHECK (
            price_type IN (
              'supplier_quotation',
              'negotiated_price',
              'purchase_order_price',
              'actual_invoiced_price',
              'subcontractor_quotation',
              'agreed_subcontract_rate',
              'catalog_price_revision'
            )
          ),
          cost_stage TEXT NOT NULL DEFAULT 'quoted' CHECK (
            cost_stage IN ('estimated', 'quoted', 'committed', 'actual')
          ),
          is_confirmed_purchase BOOLEAN NOT NULL DEFAULT false,
          lead_time_days INT DEFAULT 7,
          moq NUMERIC(18, 4) DEFAULT 1,
          previous_price NUMERIC(18, 4),
          price_change_amount NUMERIC(18, 4),
          price_change_pct NUMERIC(10, 2),
          idempotency_key TEXT UNIQUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_proc_price_supplier ON procurement_price_history(supplier_id, effective_date DESC);
        CREATE INDEX IF NOT EXISTS idx_proc_price_item ON procurement_price_history(item_type, item_id, effective_date DESC);
        CREATE INDEX IF NOT EXISTS idx_proc_price_mat ON procurement_price_history(material_id) WHERE material_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_proc_price_outsourced ON procurement_price_history(outsourced_service_id) WHERE outsourced_service_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_proc_price_subcontractor ON procurement_price_history(subcontractor_id) WHERE subcontractor_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_proc_price_project ON procurement_price_history(project_id) WHERE project_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_proc_price_plan ON procurement_price_history(project_plan_id) WHERE project_plan_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_proc_price_type ON procurement_price_history(price_type);
        CREATE INDEX IF NOT EXISTS idx_proc_price_cost_stage ON procurement_price_history(cost_stage);
        CREATE INDEX IF NOT EXISTS idx_proc_price_effective_date ON procurement_price_history(effective_date DESC);
        CREATE INDEX IF NOT EXISTS idx_proc_price_recorded_at ON procurement_price_history(recorded_at DESC);
        CREATE INDEX IF NOT EXISTS idx_proc_price_currency ON procurement_price_history(currency);

        ALTER TABLE price_history_records ADD COLUMN IF NOT EXISTS supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL;
        ALTER TABLE price_history_records ADD COLUMN IF NOT EXISTS supplier_name TEXT;
        ALTER TABLE price_history_records ADD COLUMN IF NOT EXISTS price_type TEXT DEFAULT 'supplier_quotation';
        ALTER TABLE price_history_records ADD COLUMN IF NOT EXISTS cost_stage TEXT DEFAULT 'quoted';
        ALTER TABLE price_history_records ADD COLUMN IF NOT EXISTS quotation_ref TEXT;
        ALTER TABLE price_history_records ADD COLUMN IF NOT EXISTS valid_from DATE;
        ALTER TABLE price_history_records ADD COLUMN IF NOT EXISTS valid_until DATE;
        ALTER TABLE price_history_records ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;
        ALTER TABLE price_history_records ADD COLUMN IF NOT EXISTS project_plan_id TEXT REFERENCES project_plans(id) ON DELETE SET NULL;
        ALTER TABLE price_history_records ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'unit';
        ALTER TABLE price_history_records ADD COLUMN IF NOT EXISTS notes TEXT;
        ALTER TABLE price_history_records ADD COLUMN IF NOT EXISTS is_confirmed_purchase BOOLEAN DEFAULT false;

        ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL;
        ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS price_history_id TEXT REFERENCES procurement_price_history(id) ON DELETE SET NULL;
        ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS price_type TEXT DEFAULT 'supplier_quotation';
        ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS cost_stage TEXT DEFAULT 'quoted';
        ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS price_snapshot JSONB DEFAULT '{}'::jsonb;
      `);
    } catch (e) {
      console.warn('[PostgreSQL] ensureProcurementPriceTables warning:', (e as Error).message);
    }
  }

  public async createProcurementPriceRecord(data: any, actor?: any): Promise<any> {
    const db = await this.getDb();
    const supplierId = data.supplierId;
    if (!supplierId) {
      throw Object.assign(new Error('Supplier ID is required'), { status: 400 });
    }
    const supRes = await db.query('SELECT id, name, code, currency FROM suppliers WHERE id = $1', [supplierId]);
    if (supRes.rows.length === 0) {
      throw Object.assign(new Error(`Supplier "${supplierId}" not found`), { status: 404 });
    }
    const supplier = supRes.rows[0];

    const rawItemType = String(data.itemType || 'material').toLowerCase();
    const itemType =
      rawItemType === 'outsourced' || rawItemType === 'service' || rawItemType === 'outsourced_service'
        ? 'outsourced_service'
        : rawItemType === 'subcontractor' || rawItemType === 'subcontractor_rate'
        ? 'subcontractor_rate'
        : 'material';

    const itemId = data.itemId || data.materialId || data.outsourcedServiceId || data.subcontractorId;
    if (!itemId) {
      throw Object.assign(new Error('Item ID (material, outsourced service, or subcontractor rate) is required'), { status: 400 });
    }

    let itemCode = data.itemCode || '';
    let itemName = data.itemName || '';
    let category = data.category || '';
    let subCategory = data.subCategory || '';
    let unit = data.unit || '';
    let materialId: string | null = null;
    let outsourcedServiceId: string | null = null;
    let subcontractorId: string | null = null;

    if (itemType === 'material') {
      const matRes = await db.query(
        'SELECT id, code, name, category, sub_category, unit, currency, current_price, retail_price FROM materials WHERE id = $1',
        [itemId]
      );
      if (matRes.rows.length === 0) {
        throw Object.assign(new Error(`Material item "${itemId}" not found`), { status: 404 });
      }
      const mat = matRes.rows[0];
      materialId = mat.id;
      itemCode = mat.code || itemCode;
      itemName = mat.name || itemName;
      category = mat.category || category;
      subCategory = mat.sub_category || subCategory;
      if (!unit) unit = mat.unit || 'pcs';
    } else if (itemType === 'outsourced_service') {
      const outRes = await db.query(
        'SELECT id, code, name, category, sub_category, unit, base_unit_type, currency, rate FROM outsourced_services WHERE id = $1',
        [itemId]
      );
      if (outRes.rows.length === 0) {
        throw Object.assign(new Error(`Outsourced service "${itemId}" not found`), { status: 404 });
      }
      const out = outRes.rows[0];
      outsourcedServiceId = out.id;
      itemCode = out.code || out.id || itemCode;
      itemName = out.name || itemName;
      category = out.category || category;
      subCategory = out.sub_category || subCategory;
      if (!unit) unit = out.unit || out.base_unit_type || 'per_hour';
    } else if (itemType === 'subcontractor_rate') {
      const subRes = await db.query(
        'SELECT id, code, subcontractor_name, niche_service_name, service_category, service_sub_category, unit, currency, base_rate, rate FROM subcontractors WHERE id = $1',
        [itemId]
      );
      if (subRes.rows.length === 0) {
        throw Object.assign(new Error(`Subcontractor rate item "${itemId}" not found`), { status: 404 });
      }
      const sub = subRes.rows[0];
      subcontractorId = sub.id;
      itemCode = sub.code || sub.id || itemCode;
      itemName = sub.niche_service_name || sub.subcontractor_name || itemName;
      category = sub.service_category || category;
      subCategory = sub.service_sub_category || subCategory;
      if (!unit) unit = sub.unit || 'hr';
    }

    if (!unit) unit = 'unit';

    const unitPrice = round4(Number(data.unitPrice));
    if (isNaN(unitPrice) || unitPrice < 0) {
      throw Object.assign(new Error('Valid non-negative unit price is required'), { status: 400 });
    }

    const priceType = data.priceType || 'supplier_quotation';
    const validPriceTypes = [
      'supplier_quotation',
      'negotiated_price',
      'purchase_order_price',
      'actual_invoiced_price',
      'subcontractor_quotation',
      'agreed_subcontract_rate',
      'catalog_price_revision'
    ];
    if (!validPriceTypes.includes(priceType)) {
      throw Object.assign(new Error(`Invalid priceType "${priceType}". Must be one of: ${validPriceTypes.join(', ')}`), { status: 400 });
    }

    let costStage = data.costStage;
    if (!costStage) {
      if (priceType === 'actual_invoiced_price') costStage = 'actual';
      else if (
        priceType === 'purchase_order_price' ||
        priceType === 'negotiated_price' ||
        priceType === 'agreed_subcontract_rate'
      )
        costStage = 'committed';
      else if (priceType === 'supplier_quotation' || priceType === 'subcontractor_quotation') costStage = 'quoted';
      else costStage = 'estimated';
    }

    const isConfirmedPurchase = Boolean(data.isConfirmedPurchase || costStage === 'committed' || costStage === 'actual');
    const currency = data.currency || supplier.currency || 'USD';
    const effectiveDate = (data.effectiveDate || new Date().toISOString()).slice(0, 10);
    const recordedAt = data.recordedAt || new Date().toISOString();
    const validFrom = data.validFrom ? String(data.validFrom).slice(0, 10) : null;
    const validUntil = data.validUntil ? String(data.validUntil).slice(0, 10) : null;
    const recordedBy = data.recordedBy || actor?.name || 'System User';
    const notes = data.notes || '';
    const quotationRef = data.quotationRef || data.referenceNumber || null;
    const leadTimeDays = Number(data.leadTimeDays || 7);
    const moq = Number(data.moq || 1);
    const projectId = data.projectId || null;
    const projectPlanId = data.projectPlanId || data.planId || null;

    // Fetch previous price for same item & supplier to compute differential
    const prevRes = await db.query(
      `SELECT unit_price FROM procurement_price_history
       WHERE supplier_id = $1 AND item_id = $2
       ORDER BY effective_date DESC, recorded_at DESC
       LIMIT 1`,
      [supplierId, itemId]
    );

    let previousPrice: number | null = null;
    let priceChangeAmount: number | null = null;
    let priceChangePct: number | null = null;

    if (prevRes.rows.length > 0) {
      previousPrice = round4(prevRes.rows[0].unit_price);
      priceChangeAmount = round4(unitPrice - previousPrice);
      priceChangePct = calcPctChange(previousPrice, unitPrice, 1);
    }

    const id = data.id || `ppr-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    return this.withTransaction(async (q) => {
      // 1. Insert into procurement_price_history
      await q(
        `INSERT INTO procurement_price_history (
          id, supplier_id, supplier_name, item_type, item_id, item_code, item_name,
          category, sub_category, material_id, outsourced_service_id, subcontractor_id,
          project_id, project_plan_id, unit, unit_price, currency, effective_date,
          recorded_at, quotation_ref, valid_from, valid_until, recorded_by, notes,
          price_type, cost_stage, is_confirmed_purchase, lead_time_days, moq,
          previous_price, price_change_amount, price_change_pct, idempotency_key, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23, $24,
          $25, $26, $27, $28, $29,
          $30, $31, $32, $33, NOW(), NOW()
        )`,
        [
          id, supplierId, supplier.name, itemType, itemId, itemCode, itemName,
          category, subCategory, materialId, outsourcedServiceId, subcontractorId,
          projectId, projectPlanId, unit, unitPrice, currency, effectiveDate,
          recordedAt, quotationRef, validFrom, validUntil, recordedBy, notes,
          priceType, costStage, isConfirmedPurchase, leadTimeDays, moq,
          previousPrice, priceChangeAmount, priceChangePct, data.idempotencyKey || null
        ]
      );

      // 2. Insert into price_history_records for universal backward compatibility
      await q(
        `INSERT INTO price_history_records (
          id, entity_type, entity_id, entity_code, entity_name,
          previous_price, new_price, retail_price, change_pct, currency,
          effective_date, recorded_at, reason, updated_by, supplier_id, supplier_name,
          price_type, cost_stage, quotation_ref, valid_from, valid_until,
          project_id, project_plan_id, unit, notes, is_confirmed_purchase, idempotency_key
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21,
          $22, $23, $24, $25, $26, $27
        ) ON CONFLICT (id) DO NOTHING`,
        [
          `phr-${id}`,
          itemType === 'material' ? 'material' : itemType === 'outsourced_service' ? 'outsourced' : 'subcontractor',
          itemId, itemCode, itemName,
          previousPrice || 0, unitPrice, unitPrice, priceChangePct || 0, currency,
          effectiveDate, recordedAt, notes || `${priceType.replace(/_/g, ' ')} recorded`, recordedBy, supplierId, supplier.name,
          priceType, costStage, quotationRef, validFrom, validUntil,
          projectId, projectPlanId, unit, notes, isConfirmedPurchase, data.idempotencyKey ? `phr-${data.idempotencyKey}` : null
        ]
      );

      // 3. Log audit event
      await q(
        `INSERT INTO audit_logs (id, timestamp, actor_id, actor_name, actor_role, action, module, record_id, record_name, details, ip_address, status)
         VALUES ($1, NOW(), $2, $3, 'PROCUREMENT', 'RECORD_PRICE', 'Procurement', $4, $5, $6, '127.0.0.1', 'Success')`,
        [
          `log-price-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
          recordedBy,
          recordedBy,
          id,
          `${supplier.name} - ${itemName}`,
          `Recorded ${priceType} for ${itemName} (${itemCode}) from ${supplier.name}: ${currency} ${unitPrice}/${unit}. Ref: ${quotationRef || 'N/A'}. Stage: ${costStage}.`
        ]
      );

      return {
        id,
        supplierId,
        supplierName: supplier.name,
        itemType,
        itemId,
        itemCode,
        itemName,
        category,
        subCategory,
        materialId,
        outsourcedServiceId,
        subcontractorId,
        projectId,
        projectPlanId,
        unit,
        unitPrice,
        currency,
        effectiveDate,
        recordedAt,
        quotationRef,
        validFrom,
        validUntil,
        recordedBy,
        notes,
        priceType,
        costStage,
        isConfirmedPurchase,
        leadTimeDays,
        moq,
        previousPrice,
        priceChangeAmount,
        priceChangePct
      };
    });
  }

  public async getProcurementPriceHistory(opts?: ListQueryOptions): Promise<PaginatedResult<any>> {
    const db = await this.getDb();
    const res = await db.query(
      `SELECT
        h.*,
        h.effective_date::text AS effective_date_iso,
        p.code AS project_code,
        p.name AS project_name,
        pl.plan_number,
        pl.name AS plan_name
       FROM procurement_price_history h
       LEFT JOIN projects p ON h.project_id = p.id
       LEFT JOIN project_plans pl ON h.project_plan_id = pl.id
       ORDER BY h.effective_date DESC, h.recorded_at DESC`
    );

    const rows = res.rows.map((r: any) => ({
      id: r.id,
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      itemType: r.item_type,
      itemId: r.item_id,
      itemCode: r.item_code,
      itemName: r.item_name,
      category: r.category || '',
      subCategory: r.sub_category || '',
      materialId: r.material_id,
      outsourcedServiceId: r.outsourced_service_id,
      subcontractorId: r.subcontractor_id,
      projectId: r.project_id,
      projectCode: r.project_code,
      projectName: r.project_name,
      projectPlanId: r.project_plan_id,
      planNumber: r.plan_number,
      planName: r.plan_name,
      unit: r.unit,
      unitPrice: round4(r.unit_price),
      currency: r.currency || 'USD',
      effectiveDate: formatSqlDate(r.effective_date_iso || r.effective_date, ''),
      recordedAt: r.recorded_at ? new Date(r.recorded_at).toISOString() : new Date().toISOString(),
      quotationRef: r.quotation_ref,
      validFrom: r.valid_from ? formatSqlDate(r.valid_from, '') : undefined,
      validUntil: r.valid_until ? formatSqlDate(r.valid_until, '') : undefined,
      recordedBy: r.recorded_by,
      notes: r.notes || '',
      priceType: r.price_type,
      costStage: r.cost_stage,
      isConfirmedPurchase: Boolean(r.is_confirmed_purchase),
      leadTimeDays: Number(r.lead_time_days || 7),
      moq: Number(r.moq || 1),
      previousPrice: r.previous_price !== null && r.previous_price !== undefined ? round4(r.previous_price) : undefined,
      priceChangeAmount: r.price_change_amount !== null && r.price_change_amount !== undefined ? round4(r.price_change_amount) : undefined,
      priceChangePct: r.price_change_pct !== null && r.price_change_pct !== undefined ? round2(r.price_change_pct) : undefined,
      idempotencyKey: r.idempotency_key
    }));

    return parseFilterPagination(
      rows,
      opts,
      ['itemName', 'itemCode', 'supplierName', 'quotationRef', 'notes', 'category', 'subCategory', 'projectCode', 'projectName', 'planNumber'],
      'effectiveDate'
    );
  }

  public async getProcurementPriceComparison(itemId: string, itemType?: string, unit?: string): Promise<any> {
    const db = await this.getDb();
    let sql = `
      SELECT
        h.*,
        h.effective_date::text AS effective_date_iso,
        p.code AS project_code,
        p.name AS project_name,
        pl.plan_number,
        pl.name AS plan_name
      FROM procurement_price_history h
      LEFT JOIN projects p ON h.project_id = p.id
      LEFT JOIN project_plans pl ON h.project_plan_id = pl.id
      WHERE (h.item_id = $1 OR h.material_id = $1 OR h.outsourced_service_id = $1 OR h.subcontractor_id = $1)
    `;
    const params: any[] = [itemId];

    if (unit && unit !== 'ALL') {
      sql += ` AND LOWER(h.unit) = LOWER($2)`;
      params.push(unit);
    }
    sql += ` ORDER BY h.effective_date DESC, h.recorded_at DESC`;

    const res = await db.query(sql, params);
    const records = res.rows.map((r: any) => ({
      id: r.id,
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      itemType: r.item_type,
      itemId: r.item_id,
      itemCode: r.item_code,
      itemName: r.item_name,
      category: r.category || '',
      subCategory: r.sub_category || '',
      materialId: r.material_id,
      outsourcedServiceId: r.outsourced_service_id,
      subcontractorId: r.subcontractor_id,
      projectId: r.project_id,
      projectCode: r.project_code,
      projectName: r.project_name,
      projectPlanId: r.project_plan_id,
      planNumber: r.plan_number,
      planName: r.plan_name,
      unit: r.unit,
      unitPrice: round4(r.unit_price),
      currency: r.currency || 'USD',
      effectiveDate: formatSqlDate(r.effective_date_iso || r.effective_date, ''),
      recordedAt: r.recorded_at ? new Date(r.recorded_at).toISOString() : new Date().toISOString(),
      quotationRef: r.quotation_ref,
      validFrom: r.valid_from ? formatSqlDate(r.valid_from, '') : undefined,
      validUntil: r.valid_until ? formatSqlDate(r.valid_until, '') : undefined,
      recordedBy: r.recorded_by,
      notes: r.notes || '',
      priceType: r.price_type,
      costStage: r.cost_stage,
      isConfirmedPurchase: Boolean(r.is_confirmed_purchase),
      leadTimeDays: Number(r.lead_time_days || 7),
      moq: Number(r.moq || 1),
      previousPrice: r.previous_price !== null && r.previous_price !== undefined ? round4(r.previous_price) : undefined,
      priceChangeAmount: r.price_change_amount !== null && r.price_change_amount !== undefined ? round4(r.price_change_amount) : undefined,
      priceChangePct: r.price_change_pct !== null && r.price_change_pct !== undefined ? round2(r.price_change_pct) : undefined
    }));

    if (records.length === 0) {
      // Try resolving item info from base tables
      const [mat, out, sub] = await Promise.all([
        db.query('SELECT id, code, name, unit, currency, current_price FROM materials WHERE id = $1', [itemId]),
        db.query('SELECT id, code, name, unit, base_unit_type, currency, rate FROM outsourced_services WHERE id = $1', [itemId]),
        db.query('SELECT id, code, subcontractor_name, unit, currency, rate FROM subcontractors WHERE id = $1', [itemId])
      ]);
      const base = mat.rows[0] || out.rows[0] || sub.rows[0];
      return {
        itemId,
        itemCode: base?.code || itemId,
        itemName: base?.name || base?.subcontractor_name || 'Item',
        itemType: itemType || 'material',
        unit: base?.unit || 'unit',
        currentPrice: base ? round4(base.current_price ?? base.rate ?? 0) : 0,
        currency: base?.currency || 'USD',
        minPrice: base ? round4(base.current_price ?? base.rate ?? 0) : 0,
        maxPrice: base ? round4(base.current_price ?? base.rate ?? 0) : 0,
        avgPrice: base ? round4(base.current_price ?? base.rate ?? 0) : 0,
        totalRecordsCount: 0,
        history: []
      };
    }

    const latestRecord = records[0];
    const previousRecord = records.length > 1 ? records[1] : undefined;
    const currentPrice = latestRecord.unitPrice;
    const previousPrice = previousRecord ? previousRecord.unitPrice : undefined;
    const priceChangePct = previousPrice ? calcPctChange(previousPrice, currentPrice, 1) : 0;
    const allPrices = records.map((r: any) => r.unitPrice);
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const avgPrice = round4(allPrices.reduce((a: number, b: number) => a + b, 0) / allPrices.length);

    return {
      itemId,
      itemCode: latestRecord.itemCode,
      itemName: latestRecord.itemName,
      itemType: latestRecord.itemType,
      unit: latestRecord.unit,
      currentPrice,
      previousPrice,
      priceChangePct,
      minPrice,
      maxPrice,
      avgPrice,
      currency: latestRecord.currency,
      totalRecordsCount: records.length,
      latestRecord,
      history: records
    };
  }

  public async getSupplierPriceHistory(supplierId: string, opts?: ListQueryOptions): Promise<PaginatedResult<any>> {
    return this.getProcurementPriceHistory({ ...(opts || {}), supplierId });
  }

  public async getItemPriceHistory(itemType: string, itemId: string, opts?: ListQueryOptions): Promise<PaginatedResult<any>> {
    return this.getProcurementPriceHistory({ ...(opts || {}), itemType, itemId });
  }

  // --- Database Status ---
  // --- TASK 6: Material Catalogue & Category Restructure ---
  public async ensureMaterialCatalogueSchema(): Promise<void> {
    const db = this.db!;
    try {
      await db.exec(`
        -- 1. Standard Units of Measurement
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

        -- 2. Upgrade materials table
        ALTER TABLE materials ADD COLUMN IF NOT EXISTS category_id TEXT;
        ALTER TABLE materials ADD COLUMN IF NOT EXISTS subcategory_id TEXT;
        ALTER TABLE materials ADD COLUMN IF NOT EXISTS default_unit_id TEXT REFERENCES measurement_units(id) ON DELETE SET NULL;
        ALTER TABLE materials ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
        ALTER TABLE materials ADD COLUMN IF NOT EXISTS classification_review_required BOOLEAN DEFAULT false;
        ALTER TABLE materials ADD COLUMN IF NOT EXISTS classification_review_notes TEXT DEFAULT '';
        ALTER TABLE materials ADD COLUMN IF NOT EXISTS created_at_ts TIMESTAMPTZ DEFAULT NOW();
        ALTER TABLE materials ADD COLUMN IF NOT EXISTS updated_at_ts TIMESTAMPTZ DEFAULT NOW();

        -- 3. Ensure categories table has unique (id, parent_id)
        CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_id_parent ON categories(id, parent_id);
        CREATE INDEX IF NOT EXISTS idx_categories_type_group ON categories(group_name, type);
        CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);

        CREATE INDEX IF NOT EXISTS idx_materials_category_id ON materials(category_id);
        CREATE INDEX IF NOT EXISTS idx_materials_subcategory_id ON materials(subcategory_id);
        CREATE INDEX IF NOT EXISTS idx_materials_barcode ON materials(barcode);
        CREATE INDEX IF NOT EXISTS idx_materials_review_required ON materials(classification_review_required);
      `);

      // Seed categories from INITIAL_CATEGORY_HIERARCHY if table is empty
      const catCountRes = await db.query('SELECT count(*) as cnt FROM categories');
      const catCount = Number((catCountRes.rows[0] as any)?.cnt || 0);
      if (catCount === 0) {
        const defaultCats = buildDefaultCategories();
        for (const c of defaultCats) {
          await db.query(
            `INSERT INTO categories (id, name, type, group_name, parent_id, parent_name, brief, item_count, theme_id, custom_gradient, icon, meta_badge, action_text, created_at, created_at_ts, updated_at_ts)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
             ON CONFLICT (id) DO NOTHING`,
            [
              c.id,
              c.name,
              c.type || 'category',
              c.group || 'material',
              c.parentId || null,
              c.parentName || null,
              c.brief || '',
              Number(c.itemCount || 0),
              c.themeId || null,
              c.customGradient || null,
              c.icon || null,
              c.metaBadge || null,
              c.actionText || null,
              new Date().toISOString()
            ]
          ).catch(() => {});
        }
      }

      // Safe Migration & Classification for existing material records
      // Requirement 16, 17, 18:
      // - Preserve existing material records
      // - Match to category / subcategory by exact/case-insensitive name
      // - If uncertain / unmatched: DO NOT automatically assign to an arbitrary category!
      // - Flag classification_review_required = true for manual review.
      const unlinkedMaterials = await db.query('SELECT id, code, name, category, sub_category FROM materials WHERE category_id IS NULL');
      for (const m of unlinkedMaterials.rows) {
        const catName = String(m.category || '').trim();
        const subName = String(m.sub_category || '').trim();

        if (catName) {
          const catRes = await db.query(
            "SELECT id, name FROM categories WHERE LOWER(TRIM(name)) = LOWER($1) AND (type = 'category' OR parent_id IS NULL) LIMIT 1",
            [catName]
          );
          if (catRes.rows.length > 0) {
            const catId = catRes.rows[0].id;
            let subId: string | null = null;
            let reviewReq = false;
            let reviewNote = '';

            if (subName) {
              const subRes = await db.query(
                "SELECT id, name FROM categories WHERE parent_id = $1 AND LOWER(TRIM(name)) = LOWER($2) LIMIT 1",
                [catId, subName]
              );
              if (subRes.rows.length > 0) {
                subId = subRes.rows[0].id;
              } else {
                reviewReq = true;
                reviewNote = `Subcategory "${subName}" not found under category "${catRes.rows[0].name}". Awaiting classification review.`;
              }
            }

            await db.query(
              `UPDATE materials SET
                category_id = $1,
                subcategory_id = $2,
                classification_review_required = $3,
                classification_review_notes = $4,
                updated_at_ts = NOW()
               WHERE id = $5`,
              [catId, subId, reviewReq, reviewNote, m.id]
            );
          } else {
            // Category text doesn't match known category: DO NOT assign arbitrary category (Requirement 18)
            await db.query(
              `UPDATE materials SET
                category_id = NULL,
                subcategory_id = NULL,
                classification_review_required = true,
                classification_review_notes = $1,
                updated_at_ts = NOW()
               WHERE id = $2`,
              [`Legacy category "${catName}" not found in catalogue. Manual review required.`, m.id]
            );
          }
        } else {
          // No category: leave null and flag for review
          await db.query(
            `UPDATE materials SET
              category_id = NULL,
              subcategory_id = NULL,
              classification_review_required = true,
              classification_review_notes = 'Missing category classification. Manual assignment required.',
              updated_at_ts = NOW()
             WHERE id = $1`,
            [m.id]
          );
        }
      }

      // Foreign keys & Hierarchy Validation Trigger
      try {
        await db.exec(`
          DO $$
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_materials_category_id') THEN
              ALTER TABLE materials ADD CONSTRAINT fk_materials_category_id FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_materials_subcategory_id') THEN
              ALTER TABLE materials ADD CONSTRAINT fk_materials_subcategory_id FOREIGN KEY (subcategory_id) REFERENCES categories(id) ON DELETE RESTRICT;
            END IF;
          EXCEPTION
            WHEN OTHERS THEN NULL;
          END $$;

          CREATE OR REPLACE FUNCTION fn_validate_material_category_hierarchy()
          RETURNS TRIGGER AS $func$
          DECLARE
            v_sub_parent TEXT;
            v_cat_type TEXT;
            v_sub_type TEXT;
          BEGIN
            IF NEW.category_id IS NOT NULL THEN
              SELECT type INTO v_cat_type FROM categories WHERE id = NEW.category_id;
              IF v_cat_type IS NULL THEN
                RAISE EXCEPTION 'Category ID % does not exist in categories catalogue', NEW.category_id;
              END IF;
            END IF;

            IF NEW.subcategory_id IS NOT NULL THEN
              SELECT parent_id, type INTO v_sub_parent, v_sub_type FROM categories WHERE id = NEW.subcategory_id;
              IF v_sub_type IS NULL THEN
                RAISE EXCEPTION 'Subcategory ID % does not exist in categories catalogue', NEW.subcategory_id;
              END IF;

              IF v_sub_parent IS NULL THEN
                RAISE EXCEPTION 'Category node % is a root category, not a subcategory', NEW.subcategory_id;
              END IF;

              IF NEW.category_id IS NOT NULL AND v_sub_parent != NEW.category_id THEN
                RAISE EXCEPTION 'Subcategory (ID: %) belongs to parent %, not selected Category %',
                  NEW.subcategory_id, v_sub_parent, NEW.category_id;
              END IF;

              IF NEW.category_id IS NULL THEN
                NEW.category_id := v_sub_parent;
              END IF;
            END IF;

            IF NEW.barcode IS NULL OR TRIM(NEW.barcode) = '' THEN
              NEW.barcode := NEW.code;
            END IF;

            RETURN NEW;
          END;
          $func$ LANGUAGE plpgsql;

          DROP TRIGGER IF EXISTS trg_validate_material_category_hierarchy ON materials;
          CREATE TRIGGER trg_validate_material_category_hierarchy
          BEFORE INSERT OR UPDATE ON materials
          FOR EACH ROW
          EXECUTE FUNCTION fn_validate_material_category_hierarchy();
        `);
      } catch (triggerErr) {
        console.warn('[PostgreSQL] trigger setup warning:', (triggerErr as Error).message);
      }
    } catch (e) {
      console.warn('[PostgreSQL] ensureMaterialCatalogueSchema warning:', (e as Error).message);
    }
  }

  // ============================================================================
  // TASK 7: SYSTEM-WIDE BARCODE REGISTRY, UNIQUENESS & LOOKUP SYSTEM
  // ============================================================================

  public async generateUniqueBarcode(entityType: string, _baseCode?: string): Promise<string> {
    const db = await this.getDb();
    let prefix = 'BAR';
    switch (entityType) {
      case 'material': prefix = 'MAT'; break;
      case 'revenue_product': prefix = 'REV-PRD'; break;
      case 'revenue_service': prefix = 'REV-SRV'; break;
      case 'overhead_item': prefix = 'OVH'; break;
      case 'supplier': prefix = 'SUP'; break;
      case 'outsourced_service': prefix = 'OUT'; break;
      case 'subcontractor': prefix = 'SUB'; break;
      case 'produce_item': prefix = 'PRD'; break;
      case 'inventory_item': prefix = 'INV'; break;
      case 'client': prefix = 'CLI'; break;
    }

    let attempts = 0;
    while (attempts < 25) {
      attempts++;
      const seq = Math.floor(1000 + Math.random() * 9000);
      const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
      const candidate = `${prefix}-${seq}-${rand}`;

      const existing = await db.query('SELECT barcode FROM barcode_registry WHERE barcode = $1', [candidate]);
      if (existing.rows.length === 0) {
        return candidate;
      }
    }
    return `${prefix}-${Date.now().toString().slice(-6)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }

  public async validateBarcodeUnique(barcode: string, entityId?: string, entityType?: string): Promise<void> {
    const clean = String(barcode || '').trim().toUpperCase();
    if (!clean) return;
    const db = await this.getDb();
    const existing = await db.query(
      'SELECT entity_type, entity_id, entity_name, entity_code FROM barcode_registry WHERE barcode = $1',
      [clean]
    );
    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      if (row.entity_id !== entityId || (entityType && row.entity_type !== entityType)) {
        throw Object.assign(
          new Error(`Barcode '${clean}' is already assigned to ${row.entity_type} '${row.entity_name}' (${row.entity_code}). Barcodes must be globally unique across all business entities.`),
          { status: 409, conflictEntity: row }
        );
      }
    }
  }

  public async registerBarcode(data: {
    barcode: string;
    entityType: string;
    entityId: string;
    entityCode: string;
    entityName: string;
    category?: string;
    subCategory?: string;
    unit?: string;
    unitCost?: number;
    sellingRate?: number;
    currency?: string;
    isCostEligible?: boolean;
    isBoqEligible?: boolean;
    metadata?: any;
  }): Promise<void> {
    const db = await this.getDb();
    const barcode = String(data.barcode || '').trim().toUpperCase();
    if (!barcode) return;

    // Check if barcode already belongs to a different entity (Requirement 5, 8)
    const existing = await db.query(
      'SELECT entity_type, entity_id, entity_name, entity_code FROM barcode_registry WHERE barcode = $1',
      [barcode]
    );
    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      if (row.entity_id !== data.entityId || row.entity_type !== data.entityType) {
        throw Object.assign(
          new Error(`Barcode '${barcode}' is already assigned to ${row.entity_type} '${row.entity_name}' (${row.entity_code}). Barcodes must be globally unique across all business entities.`),
          { status: 409, conflictEntity: row }
        );
      }
    }

    await db.query(
      `INSERT INTO barcode_registry (
        barcode, entity_type, entity_id, entity_code, entity_name,
        category, sub_category, unit, unit_cost, selling_rate,
        currency, is_cost_eligible, is_boq_eligible, metadata, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      ON CONFLICT (barcode) DO UPDATE SET
        entity_code = EXCLUDED.entity_code,
        entity_name = EXCLUDED.entity_name,
        category = EXCLUDED.category,
        sub_category = EXCLUDED.sub_category,
        unit = EXCLUDED.unit,
        unit_cost = EXCLUDED.unit_cost,
        selling_rate = EXCLUDED.selling_rate,
        currency = EXCLUDED.currency,
        is_cost_eligible = EXCLUDED.is_cost_eligible,
        is_boq_eligible = EXCLUDED.is_boq_eligible,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()`,
      [
        barcode,
        data.entityType,
        data.entityId,
        data.entityCode,
        data.entityName,
        data.category || '',
        data.subCategory || '',
        data.unit || '',
        round4(Number(data.unitCost || 0)),
        round4(Number(data.sellingRate || 0)),
        data.currency || 'USD',
        Boolean(data.isCostEligible),
        Boolean(data.isBoqEligible),
        JSON.stringify(data.metadata || {})
      ]
    );
  }

  public async lookupBarcode(code: string): Promise<any> {
    if (!code || !String(code).trim()) {
      return { found: false, message: 'Barcode is required' };
    }
    const clean = String(code).trim();
    const db = await this.getDb();

    // 1. Exact match in barcode_registry (case-insensitive)
    let res = await db.query(
      `SELECT * FROM barcode_registry WHERE LOWER(barcode) = LOWER($1) OR barcode = $1`,
      [clean]
    );

    let matchType = 'exact_barcode';
    let exactBarcodeMatch = true;

    // 2. Fallback: Exact match on entity_code
    if (res.rows.length === 0) {
      res = await db.query(
        `SELECT * FROM barcode_registry WHERE LOWER(entity_code) = LOWER($1) OR entity_code = $1`,
        [clean]
      );
      matchType = 'entity_code';
      exactBarcodeMatch = false;
    }

    // 3. Fallback: Search by name or partial code
    if (res.rows.length === 0) {
      res = await db.query(
        `SELECT * FROM barcode_registry 
         WHERE LOWER(entity_name) LIKE LOWER($1) OR LOWER(entity_code) LIKE LOWER($1)
         ORDER BY (CASE WHEN LOWER(entity_name) = LOWER($2) THEN 0 ELSE 1 END), updated_at DESC
         LIMIT 6`,
        [`%${clean}%`, clean]
      );
      matchType = 'name_fallback';
      exactBarcodeMatch = false;
    }

    if (res.rows.length === 0) {
      return { found: false, code: clean, message: `No item found matching barcode or code '${clean}'` };
    }

    const regRow = res.rows[0];
    const isMultiple = res.rows.length > 1 && matchType === 'name_fallback';

    // Retrieve underlying raw record from source table
    let rawRecord: any = null;
    try {
      if (regRow.entity_type === 'material') {
        const mat = await this.getMaterials();
        rawRecord = mat.find((m: any) => m.id === regRow.entity_id || m.code === regRow.entity_code);
      } else if (regRow.entity_type === 'revenue_product' || regRow.entity_type === 'revenue_service') {
        rawRecord = await this.getRevenueItemById(regRow.entity_id);
      } else if (regRow.entity_type === 'overhead_item') {
        rawRecord = await this.getOverheadItemById(regRow.entity_id);
      } else if (regRow.entity_type === 'supplier') {
        const sups = await this.getSuppliers();
        rawRecord = sups.find((s: any) => s.id === regRow.entity_id || s.code === regRow.entity_code);
      } else if (regRow.entity_type === 'outsourced_service') {
        const outs = await this.getOutsourced();
        rawRecord = outs.find((o: any) => o.id === regRow.entity_id || o.code === regRow.entity_code);
      } else if (regRow.entity_type === 'subcontractor') {
        const subs = await this.getSubcontractors();
        rawRecord = subs.find((s: any) => s.id === regRow.entity_id || s.code === regRow.entity_code);
      } else if (regRow.entity_type === 'produce_item') {
        const prods = await this.getProduce();
        rawRecord = prods.find((p: any) => p.id === regRow.entity_id || p.code === regRow.entity_code);
      } else if (regRow.entity_type === 'inventory_item') {
        const invs = await this.getInventory();
        rawRecord = invs.find((i: any) => i.id === regRow.entity_id || i.sku === regRow.entity_code);
      }
    } catch {
      // ignore
    }

    const isDirectoryOnly = regRow.entity_type === 'supplier' || regRow.entity_type === 'client';

    return {
      found: true,
      exactBarcodeMatch,
      matchType,
      barcode: regRow.barcode,
      entityType: regRow.entity_type,
      entityId: regRow.entity_id,
      entityCode: regRow.entity_code,
      entityName: regRow.entity_name,
      category: regRow.category,
      subCategory: regRow.sub_category,
      unit: regRow.unit,
      unitCost: Number(regRow.unit_cost || 0),
      sellingRate: Number(regRow.selling_rate || 0),
      currency: regRow.currency || 'USD',
      isCostEligible: Boolean(regRow.is_cost_eligible),
      isBoqEligible: Boolean(regRow.is_boq_eligible),
      isDirectoryOnly,
      rawRecord: rawRecord || regRow,
      otherMatches: isMultiple ? res.rows.slice(1).map((r: any) => ({
        barcode: r.barcode,
        entityType: r.entity_type,
        entityId: r.entity_id,
        entityCode: r.entity_code,
        entityName: r.entity_name
      })) : undefined
    };
  }

  public async searchBarcodes(q: string, opts?: { entityType?: string; limit?: number; offset?: number }): Promise<any[]> {
    const db = await this.getDb();
    const query = String(q || '').trim();
    const limit = Math.min(Number(opts?.limit || 50), 100);
    const offset = Math.max(Number(opts?.offset || 0), 0);

    let sql = `SELECT * FROM barcode_registry WHERE 1=1`;
    const params: any[] = [];

    if (query) {
      params.push(`%${query}%`);
      sql += ` AND (LOWER(barcode) LIKE LOWER($${params.length}) OR LOWER(entity_code) LIKE LOWER($${params.length}) OR LOWER(entity_name) LIKE LOWER($${params.length}) OR LOWER(category) LIKE LOWER($${params.length}))`;
    }

    if (opts?.entityType && opts.entityType !== 'ALL') {
      params.push(opts.entityType);
      sql += ` AND entity_type = $${params.length}`;
    }

    sql += ` ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const res = await db.query(sql, params);
    return res.rows.map((r: any) => ({
      barcode: r.barcode,
      entityType: r.entity_type,
      entityId: r.entity_id,
      entityCode: r.entity_code,
      entityName: r.entity_name,
      category: r.category,
      subCategory: r.sub_category,
      unit: r.unit,
      unitCost: Number(r.unit_cost || 0),
      sellingRate: Number(r.selling_rate || 0),
      currency: r.currency || 'USD',
      isCostEligible: Boolean(r.is_cost_eligible),
      isBoqEligible: Boolean(r.is_boq_eligible),
      isDirectoryOnly: r.entity_type === 'supplier' || r.entity_type === 'client'
    }));
  }

  public async ensureBarcodeRegistrySchema(): Promise<void> {
    const db = this.db!;
    try {
      // 1. Ensure columns exist on tables
      await db.exec(`
        ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS barcode TEXT;
        ALTER TABLE outsourced_services ADD COLUMN IF NOT EXISTS barcode TEXT;
        ALTER TABLE subcontractors ADD COLUMN IF NOT EXISTS barcode TEXT;
        ALTER TABLE clients ADD COLUMN IF NOT EXISTS barcode TEXT;
        ALTER TABLE materials ADD COLUMN IF NOT EXISTS barcode TEXT;
        ALTER TABLE produce_items ADD COLUMN IF NOT EXISTS barcode TEXT;
        ALTER TABLE inventory ADD COLUMN IF NOT EXISTS barcode TEXT;
        ALTER TABLE project_plan_boq_items ADD COLUMN IF NOT EXISTS barcode TEXT;

        CREATE TABLE IF NOT EXISTS barcode_registry (
          barcode TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          entity_code TEXT NOT NULL,
          entity_name TEXT NOT NULL,
          category TEXT DEFAULT '',
          sub_category TEXT DEFAULT '',
          unit TEXT DEFAULT '',
          unit_cost NUMERIC(18, 4) DEFAULT 0,
          selling_rate NUMERIC(18, 4) DEFAULT 0,
          currency TEXT DEFAULT 'USD',
          is_cost_eligible BOOLEAN DEFAULT false,
          is_boq_eligible BOOLEAN DEFAULT false,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_barcode_reg_entity ON barcode_registry(entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS idx_barcode_reg_code ON barcode_registry(entity_code);
        CREATE INDEX IF NOT EXISTS idx_barcode_reg_name ON barcode_registry(entity_name);
        CREATE INDEX IF NOT EXISTS idx_barcode_reg_type ON barcode_registry(entity_type);
      `);

      // 2. Backfill materials
      const mats = await db.query('SELECT id, code, name, category, sub_category, unit, current_price, barcode FROM materials');
      for (const m of mats.rows) {
        let b = m.barcode && String(m.barcode).trim();
        if (!b) {
          b = await this.generateUniqueBarcode('material', m.code);
          await db.query('UPDATE materials SET barcode = $1 WHERE id = $2', [b, m.id]);
        }
        await this.registerBarcode({
          barcode: b,
          entityType: 'material',
          entityId: m.id,
          entityCode: m.code,
          entityName: m.name,
          category: m.category || '',
          subCategory: m.sub_category || '',
          unit: m.unit || 'pcs',
          unitCost: Number(m.current_price || 0),
          sellingRate: Number(m.current_price || 0),
          isCostEligible: true,
          isBoqEligible: true
        }).catch(() => {});
      }

      // 3. Backfill revenue_items
      const revs = await db.query('SELECT id, code, name, type, category, sub_category, unit, default_rate, cost_price, barcode FROM revenue_items');
      for (const r of revs.rows) {
        let b = r.barcode && String(r.barcode).trim();
        const eType = r.type === 'service' ? 'revenue_service' : 'revenue_product';
        if (!b) {
          b = await this.generateUniqueBarcode(eType, r.code);
          await db.query('UPDATE revenue_items SET barcode = $1 WHERE id = $2', [b, r.id]);
        }
        await this.registerBarcode({
          barcode: b,
          entityType: eType,
          entityId: r.id,
          entityCode: r.code,
          entityName: r.name,
          category: r.category || '',
          subCategory: r.sub_category || '',
          unit: r.unit || 'unit',
          unitCost: Number(r.cost_price || 0),
          sellingRate: Number(r.default_rate || 0),
          isCostEligible: false,
          isBoqEligible: true
        }).catch(() => {});
      }

      // 4. Backfill overhead_items
      const ovhs = await db.query('SELECT id, code, name, category, default_rate, barcode FROM overhead_items');
      for (const o of ovhs.rows) {
        let b = o.barcode && String(o.barcode).trim();
        if (!b) {
          b = await this.generateUniqueBarcode('overhead_item', o.code);
          await db.query('UPDATE overhead_items SET barcode = $1 WHERE id = $2', [b, o.id]);
        }
        await this.registerBarcode({
          barcode: b,
          entityType: 'overhead_item',
          entityId: o.id,
          entityCode: o.code,
          entityName: o.name,
          category: o.category || '',
          unitCost: Number(o.default_rate || 0),
          sellingRate: Number(o.default_rate || 0),
          isCostEligible: false,
          isBoqEligible: false
        }).catch(() => {});
      }

      // 5. Backfill suppliers
      const sups = await db.query('SELECT id, code, name, category, barcode FROM suppliers');
      for (const s of sups.rows) {
        let b = s.barcode && String(s.barcode).trim();
        if (!b) {
          b = await this.generateUniqueBarcode('supplier', s.code);
          await db.query('UPDATE suppliers SET barcode = $1 WHERE id = $2', [b, s.id]);
        }
        await this.registerBarcode({
          barcode: b,
          entityType: 'supplier',
          entityId: s.id,
          entityCode: s.code || s.id,
          entityName: s.name,
          category: s.category || '',
          isCostEligible: false,
          isBoqEligible: false
        }).catch(() => {});
      }

      // 6. Backfill outsourced_services
      const outs = await db.query('SELECT id, code, name, category, sub_category, unit, rate, retail_price, barcode FROM outsourced_services');
      for (const o of outs.rows) {
        let b = o.barcode && String(o.barcode).trim();
        if (!b) {
          b = await this.generateUniqueBarcode('outsourced_service', o.code);
          await db.query('UPDATE outsourced_services SET barcode = $1 WHERE id = $2', [b, o.id]);
        }
        await this.registerBarcode({
          barcode: b,
          entityType: 'outsourced_service',
          entityId: o.id,
          entityCode: o.code || o.id,
          entityName: o.name,
          category: o.category || '',
          subCategory: o.sub_category || '',
          unit: o.unit || 'per_hour',
          unitCost: Number(o.rate || 0),
          sellingRate: Number(o.retail_price || o.rate || 0),
          isCostEligible: true,
          isBoqEligible: true
        }).catch(() => {});
      }

      // 7. Backfill subcontractors
      const scs = await db.query('SELECT id, code, subcontractor_name, niche_service_name, base_rate, unit, barcode FROM subcontractors');
      for (const s of scs.rows) {
        let b = s.barcode && String(s.barcode).trim();
        if (!b) {
          b = await this.generateUniqueBarcode('subcontractor', s.code);
          await db.query('UPDATE subcontractors SET barcode = $1 WHERE id = $2', [b, s.id]);
        }
        await this.registerBarcode({
          barcode: b,
          entityType: 'subcontractor',
          entityId: s.id,
          entityCode: s.code || s.id,
          entityName: s.niche_service_name || s.subcontractor_name || 'Subcontractor',
          unit: s.unit || 'hr',
          unitCost: Number(s.base_rate || 0),
          sellingRate: Number(s.base_rate || 0),
          isCostEligible: true,
          isBoqEligible: true
        }).catch(() => {});
      }

      // 8. Backfill produce_items
      const prods = await db.query('SELECT id, code, name, category, sub_category, unit, cost_price, retail_price, barcode FROM produce_items');
      for (const p of prods.rows) {
        let b = p.barcode && String(p.barcode).trim();
        if (!b) {
          b = await this.generateUniqueBarcode('produce_item', p.code);
          await db.query('UPDATE produce_items SET barcode = $1 WHERE id = $2', [b, p.id]);
        }
        await this.registerBarcode({
          barcode: b,
          entityType: 'produce_item',
          entityId: p.id,
          entityCode: p.code,
          entityName: p.name,
          category: p.category || '',
          subCategory: p.sub_category || '',
          unit: p.unit || 'unit',
          unitCost: Number(p.cost_price || 0),
          sellingRate: Number(p.retail_price || 0),
          isCostEligible: true,
          isBoqEligible: true
        }).catch(() => {});
      }

      // 9. Backfill inventory
      const invs = await db.query('SELECT id, sku, name, item_name, unit_cost, barcode FROM inventory');
      for (const i of invs.rows) {
        let b = i.barcode && String(i.barcode).trim();
        if (!b) {
          b = await this.generateUniqueBarcode('inventory_item', i.sku);
          await db.query('UPDATE inventory SET barcode = $1 WHERE id = $2', [b, i.id]);
        }
        await this.registerBarcode({
          barcode: b,
          entityType: 'inventory_item',
          entityId: i.id,
          entityCode: i.sku || i.id,
          entityName: i.name || i.item_name || 'Inventory Item',
          unitCost: Number(i.unit_cost || 0),
          sellingRate: Number(i.unit_cost || 0),
          isCostEligible: true,
          isBoqEligible: false
        }).catch(() => {});
      }

      // 10. PostgreSQL partial unique constraints (Requirement 5)
      await db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_materials_barcode_unique ON materials(barcode) WHERE barcode IS NOT NULL AND barcode != '';
        CREATE UNIQUE INDEX IF NOT EXISTS idx_revenue_items_barcode_unique ON revenue_items(barcode) WHERE barcode IS NOT NULL AND barcode != '';
        CREATE UNIQUE INDEX IF NOT EXISTS idx_overhead_items_barcode_unique ON overhead_items(barcode) WHERE barcode IS NOT NULL AND barcode != '';
        CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_barcode_unique ON suppliers(barcode) WHERE barcode IS NOT NULL AND barcode != '';
        CREATE UNIQUE INDEX IF NOT EXISTS idx_outsourced_barcode_unique ON outsourced_services(barcode) WHERE barcode IS NOT NULL AND barcode != '';
        CREATE UNIQUE INDEX IF NOT EXISTS idx_subcontractors_barcode_unique ON subcontractors(barcode) WHERE barcode IS NOT NULL AND barcode != '';
        CREATE UNIQUE INDEX IF NOT EXISTS idx_produce_items_barcode_unique ON produce_items(barcode) WHERE barcode IS NOT NULL AND barcode != '';
        CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_barcode_unique ON inventory(barcode) WHERE barcode IS NOT NULL AND barcode != '';
      `).catch(() => {});
    } catch (e) {
      console.warn('[PostgreSQL] ensureBarcodeRegistrySchema warning:', (e as Error).message);
    }
  }

  public async ensureClientProjectRelationships(): Promise<void> {
    const db = this.db!;
    try {
      await db.exec(`
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

        -- 3. Projects client foreign keys
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
      `);

      // Populate client_code if missing
      await db.query(`
        UPDATE clients SET client_code = 'CLI-' || SUBSTRING(MD5(id) FROM 1 FOR 6)
        WHERE client_code IS NULL OR client_code = ''
      `);

      // Seed primary contacts from existing clients
      await db.query(`
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
        )
      `).catch(() => {});

      // Data Integrity: Match existing client by name if client_id is null or missing
      await db.query(`
        UPDATE projects p
        SET client_id = c.id
        FROM clients c
        WHERE (p.client_id IS NULL OR NOT EXISTS (SELECT 1 FROM clients c2 WHERE c2.id = p.client_id))
          AND LOWER(TRIM(p.client_name)) = LOWER(TRIM(c.name))
      `);

      // For remaining projects with no matching client, insert canonical clients (one per unique client_name)
      await db.query(`
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
        ON CONFLICT (id) DO NOTHING
      `);

      // Link remaining projects to newly created canonical clients
      await db.query(`
        UPDATE projects p
        SET client_id = c.id
        FROM clients c
        WHERE (p.client_id IS NULL OR NOT EXISTS (SELECT 1 FROM clients c2 WHERE c2.id = p.client_id))
          AND LOWER(TRIM(p.client_name)) = LOWER(TRIM(c.name))
      `);

      // Default fallback client if any project still has no client_id
      await db.query(`
        INSERT INTO clients (id, client_code, name, tagline, industry, location, status, active_projects_count, total_quoted_value, contact_person, email, created_at, created_at_ts, updated_at_ts)
        VALUES ('cli-default-corp', 'CLI-0001', 'General Enterprise Client', 'Commercial Corporate Client', 'Enterprise Systems', 'Corporate Center', 'Active Partner', 0, 0, 'Client Services', 'client-services@enterprise.com', NOW()::text, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `);

      await db.query(`
        UPDATE projects
        SET client_id = 'cli-default-corp', client_name = 'General Enterprise Client'
        WHERE client_id IS NULL OR NOT EXISTS (SELECT 1 FROM clients c WHERE c.id = projects.client_id)
      `);

      // Populate project_clients junction table
      await db.query(`
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
        ON CONFLICT (project_id, client_id, relationship_type) DO NOTHING
      `);

      // Refresh stats for all clients
      await db.query(`
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
          ), 0)
      `);
    } catch (e) {
      console.warn('[PostgreSQL] ensureClientProjectRelationships warning:', (e as Error).message);
    }
  }

  // --- Client Contacts Management ---
  public async getClientContacts(clientId: string): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query(
      'SELECT * FROM client_contacts WHERE client_id = $1 ORDER BY is_primary DESC, created_at ASC',
      [clientId]
    );
    return res.rows.map((r: any) => ({
      id: r.id,
      clientId: r.client_id,
      name: r.name,
      roleOrTitle: r.role_or_title,
      email: r.email,
      phone: r.phone || '',
      isPrimary: Boolean(r.is_primary),
      isBillingContact: Boolean(r.is_billing_contact),
      notes: r.notes || '',
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  public async createClientContact(clientId: string, data: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `ct-${clientId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const name = String(data.name || '').trim();
    const email = String(data.email || '').trim();
    if (!name || !email) throw new Error('Contact name and email are required');

    if (data.isPrimary) {
      await db.query('UPDATE client_contacts SET is_primary = false WHERE client_id = $1', [clientId]);
    }

    await db.query(
      `INSERT INTO client_contacts (id, client_id, name, role_or_title, email, phone, is_primary, is_billing_contact, notes, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         role_or_title = EXCLUDED.role_or_title,
         email = EXCLUDED.email,
         phone = EXCLUDED.phone,
         is_primary = EXCLUDED.is_primary,
         is_billing_contact = EXCLUDED.is_billing_contact,
         notes = EXCLUDED.notes,
         updated_at = NOW()`,
      [
        id,
        clientId,
        name,
        data.roleOrTitle || 'Contact',
        email,
        data.phone || '',
        Boolean(data.isPrimary),
        Boolean(data.isBillingContact),
        data.notes || ''
      ]
    );

    // If marked primary, sync to client header
    if (data.isPrimary) {
      await db.query(
        'UPDATE clients SET contact_person = $1, email = $2, phone = COALESCE(NULLIF($3, \'\'), phone), updated_at_ts = NOW() WHERE id = $4',
        [name, email, data.phone || '', clientId]
      );
    }

    const contacts = await this.getClientContacts(clientId);
    return contacts.find((c) => c.id === id) || { ...data, id, clientId, name, email };
  }

  public async updateClientContact(contactId: string, data: any): Promise<any> {
    const db = await this.getDb();
    const existingRes = await db.query('SELECT * FROM client_contacts WHERE id = $1', [contactId]);
    if (existingRes.rows.length === 0) return null;
    const existing = existingRes.rows[0];

    const name = data.name ? String(data.name).trim() : existing.name;
    const email = data.email ? String(data.email).trim() : existing.email;
    const isPrimary = data.isPrimary !== undefined ? Boolean(data.isPrimary) : Boolean(existing.is_primary);

    if (isPrimary && !existing.is_primary) {
      await db.query('UPDATE client_contacts SET is_primary = false WHERE client_id = $1', [existing.client_id]);
    }

    await db.query(
      `UPDATE client_contacts SET
         name = $1,
         role_or_title = $2,
         email = $3,
         phone = $4,
         is_primary = $5,
         is_billing_contact = $6,
         notes = $7,
         updated_at = NOW()
       WHERE id = $8`,
      [
        name,
        data.roleOrTitle !== undefined ? data.roleOrTitle : existing.role_or_title,
        email,
        data.phone !== undefined ? data.phone : existing.phone,
        isPrimary,
        data.isBillingContact !== undefined ? Boolean(data.isBillingContact) : Boolean(existing.is_billing_contact),
        data.notes !== undefined ? data.notes : existing.notes,
        contactId
      ]
    );

    if (isPrimary) {
      await db.query(
        'UPDATE clients SET contact_person = $1, email = $2, phone = COALESCE(NULLIF($3, \'\'), phone), updated_at_ts = NOW() WHERE id = $4',
        [name, email, data.phone || existing.phone || '', existing.client_id]
      );
    }

    const contacts = await this.getClientContacts(existing.client_id);
    return contacts.find((c) => c.id === contactId) || null;
  }

  public async deleteClientContact(contactId: string): Promise<boolean> {
    const db = await this.getDb();
    await db.query('DELETE FROM client_contacts WHERE id = $1', [contactId]);
    return true;
  }

  // --- Project Clients Junction Management ---
  public async getProjectClients(projectId: string): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query(
      `SELECT pc.*, c.name as client_name, c.client_code, c.industry, c.location, c.status as client_status,
              cc.name as billing_contact_name, cc.email as billing_contact_email
       FROM project_clients pc
       JOIN clients c ON c.id = pc.client_id
       LEFT JOIN client_contacts cc ON cc.id = pc.billing_contact_id
       WHERE pc.project_id = $1
       ORDER BY pc.is_primary DESC, pc.share_pct DESC`,
      [projectId]
    );

    return res.rows.map((r: any) => ({
      id: r.id,
      projectId: r.project_id,
      clientId: r.client_id,
      clientCode: r.client_code,
      clientName: r.client_name,
      industry: r.industry,
      location: r.location,
      clientStatus: r.client_status,
      relationshipType: r.relationship_type,
      sharePct: Number(r.share_pct || 100),
      billingContactId: r.billing_contact_id,
      billingContactName: r.billing_contact_name,
      billingContactEmail: r.billing_contact_email,
      notes: r.notes || '',
      isPrimary: Boolean(r.is_primary),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  public async addProjectClient(projectId: string, data: any): Promise<any> {
    const db = await this.getDb();
    const clientId = data.clientId || data.client_id;
    if (!clientId) throw new Error('Client ID is required');

    // Verify client exists
    const clientCheck = await db.query('SELECT id, name FROM clients WHERE id = $1', [clientId]);
    if (clientCheck.rows.length === 0) {
      throw new Error(`Client with ID "${clientId}" does not exist.`);
    }

    const relationshipType = data.relationshipType || 'Consortium Partner';
    const id = data.id || `pc-${projectId}-${clientId}-${relationshipType.replace(/[^a-zA-Z0-9]/g, '_')}`;

    await db.query(
      `INSERT INTO project_clients (id, project_id, client_id, relationship_type, share_pct, billing_contact_id, notes, is_primary, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (project_id, client_id, relationship_type) DO UPDATE SET
         share_pct = EXCLUDED.share_pct,
         billing_contact_id = EXCLUDED.billing_contact_id,
         notes = EXCLUDED.notes,
         is_primary = EXCLUDED.is_primary,
         updated_at = NOW()`,
      [
        id,
        projectId,
        clientId,
        relationshipType,
        round2(data.sharePct || 100),
        data.billingContactId || null,
        data.notes || '',
        Boolean(data.isPrimary)
      ]
    );

    await this.refreshClientStats(clientId);
    const list = await this.getProjectClients(projectId);
    return list.find((c) => c.clientId === clientId && c.relationshipType === relationshipType) || list[0];
  }

  public async removeProjectClient(projectId: string, clientId: string, relationshipType?: string): Promise<boolean> {
    const db = await this.getDb();
    if (relationshipType) {
      await db.query(
        'DELETE FROM project_clients WHERE project_id = $1 AND client_id = $2 AND relationship_type = $3',
        [projectId, clientId, relationshipType]
      );
    } else {
      await db.query(
        'DELETE FROM project_clients WHERE project_id = $1 AND client_id = $2',
        [projectId, clientId]
      );
    }
    await this.refreshClientStats(clientId);
    return true;
  }

  public async getClientProjects(clientId: string): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query(
      `SELECT DISTINCT p.id, p.code, p.name, p.status, p.quoted_price, p.currency, p.target_margin_pct,
              p.start_date, p.delivery_deadline, p.active_plan_id, p.created_at,
              COALESCE(pc.relationship_type, 'Primary Client') as relationship_type,
              COALESCE(pc.share_pct, 100) as share_pct,
              COALESCE(pc.is_primary, (p.client_id = $1)) as is_primary
       FROM projects p
       LEFT JOIN project_clients pc ON pc.project_id = p.id AND pc.client_id = $1
       WHERE p.client_id = $1 OR pc.client_id = $1
       ORDER BY p.created_at DESC`,
      [clientId]
    );

    return res.rows.map((p: any) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      status: p.status,
      quotedPrice: round2(p.quoted_price || 0),
      currency: p.currency || 'USD',
      targetMarginPct: round2(p.target_margin_pct || 25),
      startDate: p.start_date || '',
      deliveryDeadline: p.delivery_deadline || '',
      activePlanId: p.active_plan_id,
      relationshipType: p.relationship_type || 'Primary Client',
      sharePct: Number(p.share_pct || 100),
      isPrimary: Boolean(p.is_primary),
      createdAt: p.created_at
    }));
  }

  public async getMeasurementUnits(): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM measurement_units WHERE is_active = true ORDER BY name ASC');
    return res.rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      symbol: r.symbol,
      category: r.category,
      isActive: r.is_active
    }));
  }

  // --- Material Vendor Quotes & Price Matrix Schema ---
  public async ensureMaterialVendorQuotesSchema(): Promise<void> {
    const db = this.db!;
    try {
      await db.exec(`
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
          status TEXT NOT NULL DEFAULT 'Active',
          contact_email TEXT DEFAULT '',
          contact_phone TEXT DEFAULT '',
          notes TEXT DEFAULT '',
          volume_pricing JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

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

        CREATE INDEX IF NOT EXISTS idx_mat_vendor_quotes_mat ON material_vendor_quotes(material_id);
        CREATE INDEX IF NOT EXISTS idx_mat_vendor_quotes_vendor ON material_vendor_quotes(vendor_id);
        CREATE INDEX IF NOT EXISTS idx_mat_vendor_quotes_pref ON material_vendor_quotes(material_id, is_preferred);
        CREATE INDEX IF NOT EXISTS idx_mat_vendor_hist_quote ON material_vendor_price_history(quote_id, revision_date DESC);
        CREATE INDEX IF NOT EXISTS idx_mat_vendor_hist_mat ON material_vendor_price_history(material_id, revision_date DESC);
        CREATE INDEX IF NOT EXISTS idx_vendor_del_arch_mat ON vendor_deletion_archives(material_id, archived_at DESC);
      `);
    } catch (e: any) {
      console.warn('[PostgreSQL] ensureMaterialVendorQuotesSchema warning:', e?.message);
    }
  }

  public async getMaterialVendorQuotes(materialId: string): Promise<any[]> {
    const db = await this.getDb();

    // Query existing vendor quotes
    const quotesRes = await db.query(
      `SELECT * FROM material_vendor_quotes WHERE material_id = $1 ORDER BY is_preferred DESC, current_price ASC, created_at ASC`,
      [materialId]
    );

    let quotes = quotesRes.rows;

    // If none exist yet in table, seed strictly from material's existing data (no dummy quotes)
    if (quotes.length === 0) {
      const matRes = await db.query('SELECT * FROM materials WHERE id = $1', [materialId]);
      if (matRes.rows.length > 0) {
        const mat = matRes.rows[0];
        const supplierName = (mat.supplier_name || '').trim() || 'Primary Supplier';
        const supplierId = mat.supplier_id || null;
        const price = round4(mat.current_price || 0);
        const leadTime = Number(mat.lead_time_days || 7);
        const volumePricing = typeof mat.volume_pricing === 'string' ? JSON.parse(mat.volume_pricing) : mat.volume_pricing || [];
        const rawHistory = typeof mat.price_history === 'string' ? JSON.parse(mat.price_history) : mat.price_history || [];

        const defaultVolumePricing = (volumePricing && volumePricing.length > 0)
          ? volumePricing
          : [
              { minQty: 1, maxQty: 10, unitPrice: price, discountPct: 0, label: '1–10 (Base MOQ)' },
              { minQty: 11, maxQty: 50, unitPrice: round2(price * 0.92), discountPct: 8.0, label: '11–50 (Volume Pack)' },
              { minQty: 51, unitPrice: round2(price * 0.85), discountPct: 15.0, label: '51+ (Bulk Mill Lot)' }
            ];

        const initialQuoteId = `vq-${materialId}-${Date.now()}`;
        await db.query(
          `INSERT INTO material_vendor_quotes (
            id, material_id, vendor_id, vendor_name, vendor_part_number, country,
            current_price, currency, lead_time_days, moq, is_preferred, last_quoted_date,
            status, contact_email, contact_phone, notes, volume_pricing, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_DATE, $12, $13, $14, $15, $16, NOW(), NOW()
          ) ON CONFLICT (id) DO NOTHING`,
          [
            initialQuoteId,
            materialId,
            supplierId,
            supplierName,
            mat.code || '',
            'United States',
            price,
            mat.currency || 'USD',
            leadTime,
            1,
            true,
            'Preferred',
            '',
            '',
            'Initial supplier quote migrated from catalog benchmark.',
            JSON.stringify(defaultVolumePricing)
          ]
        );

        // Seed price history if material had any
        if (rawHistory.length > 0) {
          for (let idx = 0; idx < rawHistory.length; idx++) {
            const h = rawHistory[idx];
            await db.query(
              `INSERT INTO material_vendor_price_history (
                id, quote_id, material_id, vendor_id, vendor_name, revision_date,
                price, previous_price, change_pct, reason, quote_ref, moq, lead_time_days,
                updated_by, target_tier_label, changed_tiers, tier_changes, applied_changes_summary, created_at
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW()
              ) ON CONFLICT (id) DO NOTHING`,
              [
                h.id || `hist-${initialQuoteId}-${idx}`,
                initialQuoteId,
                materialId,
                supplierId,
                supplierName,
                formatSqlDate(h.date, new Date().toISOString().slice(0, 10)),
                round4(h.newPrice ?? price),
                round4(h.previousPrice ?? price),
                round2(h.changePct ?? 0),
                h.reason || 'Catalog price adjustment',
                `QT-${mat.code}-${h.date || idx}`,
                1,
                leadTime,
                h.updatedBy || 'Estimator',
                'Base Rate',
                '[]',
                '[]',
                JSON.stringify([`Quoted rate: $${round2(h.previousPrice ?? price)} -> $${round2(h.newPrice ?? price)}`])
              ]
            );
          }
        } else {
          // Add 1 initial benchmark record
          await db.query(
            `INSERT INTO material_vendor_price_history (
              id, quote_id, material_id, vendor_id, vendor_name, revision_date,
              price, previous_price, change_pct, reason, quote_ref, moq, lead_time_days,
              updated_by, target_tier_label, changed_tiers, tier_changes, applied_changes_summary, created_at
            ) VALUES (
              $1, $2, $3, $4, $5, CURRENT_DATE, $6, $7, 0, $8, $9, 1, $10, $11, 'Base MOQ', '[]', '[]', $12, NOW()
            ) ON CONFLICT (id) DO NOTHING`,
            [
              `hist-init-${initialQuoteId}`,
              initialQuoteId,
              materialId,
              supplierId,
              supplierName,
              price,
              price,
              'Initial benchmark quotation onboarding',
              `QT-${mat.code}-INIT`,
              leadTime,
              'Catalog Lead',
              JSON.stringify([`Initial Quoted Base Rate established at $${price.toFixed(2)}`])
            ]
          );
        }

        const refreshedRes = await db.query(
          `SELECT * FROM material_vendor_quotes WHERE material_id = $1 ORDER BY is_preferred DESC, current_price ASC`,
          [materialId]
        );
        quotes = refreshedRes.rows;
      }
    }

    const result: any[] = [];
    for (const q of quotes) {
      const histRes = await db.query(
        `SELECT * FROM material_vendor_price_history WHERE quote_id = $1 ORDER BY revision_date DESC, created_at DESC`,
        [q.id]
      );

      const priceHistory = histRes.rows.map((h: any) => ({
        id: h.id,
        quoteId: h.quote_id,
        materialId: h.material_id,
        vendorId: h.vendor_id,
        vendorName: h.vendor_name,
        date: formatSqlDate(h.revision_date, ''),
        price: round4(h.price),
        previousPrice: h.previous_price != null ? round4(h.previous_price) : undefined,
        changePct: h.change_pct != null ? round2(h.change_pct) : undefined,
        reason: h.reason || '',
        quoteRef: h.quote_ref || '',
        moq: Number(h.moq || 1),
        leadTimeDays: Number(h.lead_time_days || 7),
        updatedBy: h.updated_by || 'System',
        targetTierLabel: h.target_tier_label || '',
        changedTiers: typeof h.changed_tiers === 'string' ? JSON.parse(h.changed_tiers) : h.changed_tiers || [],
        tierChanges: typeof h.tier_changes === 'string' ? JSON.parse(h.tier_changes) : h.tier_changes || [],
        appliedChangesSummary: typeof h.applied_changes_summary === 'string' ? JSON.parse(h.applied_changes_summary) : h.applied_changes_summary || []
      }));

      result.push({
        id: q.id,
        materialId: q.material_id,
        vendorId: q.vendor_id || q.id,
        vendorName: q.vendor_name,
        vendorPartNumber: q.vendor_part_number || '',
        country: q.country || 'United States',
        currentPrice: round4(q.current_price),
        currency: q.currency || 'USD',
        leadTimeDays: Number(q.lead_time_days || 7),
        moq: Number(q.moq || 1),
        isPreferred: Boolean(q.is_preferred),
        isPrimary: Boolean(q.is_preferred),
        lastQuotedDate: formatSqlDate(q.last_quoted_date, ''),
        status: q.status || 'Active',
        contactEmail: q.contact_email || '',
        contactPhone: q.contact_phone || '',
        notes: q.notes || '',
        volumePricing: typeof q.volume_pricing === 'string' ? JSON.parse(q.volume_pricing) : q.volume_pricing || [],
        priceHistory,
        createdAt: q.created_at,
        updatedAt: q.updated_at
      });
    }

    return result;
  }

  public async createMaterialVendorQuote(materialId: string, data: any, actor?: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `vq-${materialId}-${Date.now()}`;
    const price = round4(data.currentPrice ?? data.price ?? data.startingPrice ?? 0);
    const moq = Number(data.moq || 1);
    const leadTime = Number(data.leadTimeDays || 7);
    const isPreferred = Boolean(data.isPreferred);
    const volumePricing = data.volumePricing || data.volumeTiers || [
      { minQty: moq, maxQty: moq * 4, unitPrice: price, discountPct: 0, label: `${moq}-${moq * 4} (Base MOQ)` },
      { minQty: moq * 4 + 1, maxQty: moq * 15, unitPrice: round2(price * 0.92), discountPct: 8.0, label: `${moq * 4 + 1}-${moq * 15} (Volume Pack)` },
      { minQty: moq * 15 + 1, unitPrice: round2(price * 0.85), discountPct: 15.0, label: `${moq * 15 + 1}+ (Bulk Mill Lot)` }
    ];

    if (isPreferred) {
      await db.query(`UPDATE material_vendor_quotes SET is_preferred = false, status = 'Active' WHERE material_id = $1`, [materialId]);
    }

    await db.query(
      `INSERT INTO material_vendor_quotes (
        id, material_id, vendor_id, vendor_name, vendor_part_number, country,
        current_price, currency, lead_time_days, moq, is_preferred, last_quoted_date,
        status, contact_email, contact_phone, notes, volume_pricing, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_DATE, $12, $13, $14, $15, $16, NOW(), NOW()
      )`,
      [
        id,
        materialId,
        data.vendorId || data.supplierId || null,
        data.vendorName || 'New Supplier',
        data.vendorPartNumber || '',
        data.country || 'United States',
        price,
        data.currency || 'USD',
        leadTime,
        moq,
        isPreferred,
        data.status || (isPreferred ? 'Preferred' : 'Active'),
        data.contactEmail || '',
        data.contactPhone || '',
        data.notes || '',
        JSON.stringify(volumePricing)
      ]
    );

    // Initial price history record
    const histId = `hist-${id}-init`;
    await db.query(
      `INSERT INTO material_vendor_price_history (
        id, quote_id, material_id, vendor_id, vendor_name, revision_date,
        price, previous_price, change_pct, reason, quote_ref, moq, lead_time_days,
        updated_by, target_tier_label, changed_tiers, tier_changes, applied_changes_summary, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, CURRENT_DATE, $6, $7, 0, $8, $9, $10, $11, $12, 'Base Rate', '[]', '[]', $13, NOW()
      )`,
      [
        histId,
        id,
        materialId,
        data.vendorId || data.supplierId || null,
        data.vendorName || 'New Supplier',
        price,
        price,
        data.quoteReason || 'Initial qualified vendor quote onboarding with multi-tier pricing structure.',
        data.quoteRef || `QT-ONBOARD-${Date.now().toString().slice(-4)}`,
        moq,
        leadTime,
        actor?.name || 'Catalog Lead',
        JSON.stringify([`Initial quote onboarding established at $${price.toFixed(2)}`])
      ]
    );

    // If preferred, also update material's supplier
    if (isPreferred) {
      await db.query(
        `UPDATE materials SET supplier_name = $1, current_price = $2, last_updated = CURRENT_DATE, updated_at_ts = NOW() WHERE id = $3`,
        [data.vendorName, price, materialId]
      );
    }

    const quotes = await this.getMaterialVendorQuotes(materialId);
    return quotes.find((q) => q.id === id) || quotes[0];
  }

  public async updateMaterialVendorQuote(quoteId: string, data: any, actor?: any): Promise<any> {
    const db = await this.getDb();
    const existingRes = await db.query('SELECT * FROM material_vendor_quotes WHERE id = $1', [quoteId]);
    if (existingRes.rows.length === 0) return null;
    const existing = existingRes.rows[0];

    const vendorName = (data.vendorName ?? existing.vendor_name).trim();
    const country = data.country ?? existing.country;
    const contactEmail = data.contactEmail ?? existing.contact_email;
    const contactPhone = data.contactPhone ?? existing.contact_phone;
    const leadTime = Number(data.leadTimeDays ?? existing.lead_time_days ?? 7);
    const moq = Number(data.moq ?? existing.moq ?? 1);
    const status = data.status ?? existing.status;
    const notes = data.notes ?? existing.notes;
    const currency = data.currency ?? existing.currency;
    const volumePricing = data.volumePricing ? JSON.stringify(data.volumePricing) : existing.volume_pricing;
    const isPreferred = data.isPreferred !== undefined ? Boolean(data.isPreferred) : Boolean(existing.is_preferred);

    if (isPreferred && !existing.is_preferred) {
      await db.query(`UPDATE material_vendor_quotes SET is_preferred = false, status = 'Active' WHERE material_id = $1`, [existing.material_id]);
    }

    await db.query(
      `UPDATE material_vendor_quotes SET
        vendor_name = $1,
        country = $2,
        contact_email = $3,
        contact_phone = $4,
        lead_time_days = $5,
        moq = $6,
        status = $7,
        notes = $8,
        currency = $9,
        volume_pricing = $10,
        is_preferred = $11,
        updated_at = NOW()
      WHERE id = $12`,
      [vendorName, country, contactEmail, contactPhone, leadTime, moq, status, notes, currency, volumePricing, isPreferred, quoteId]
    );

    if (isPreferred) {
      await db.query(`UPDATE materials SET supplier_name = $1, updated_at_ts = NOW() WHERE id = $2`, [vendorName, existing.material_id]);
    }

    const quotes = await this.getMaterialVendorQuotes(existing.material_id);
    return quotes.find((q) => q.id === quoteId);
  }

  public async commitMaterialVendorPrice(materialId: string, quoteId: string, commitData: any, actor?: any): Promise<any> {
    const db = await this.getDb();
    const existingRes = await db.query('SELECT * FROM material_vendor_quotes WHERE id = $1', [quoteId]);
    if (existingRes.rows.length === 0) throw new Error('Vendor quote not found');
    const existing = existingRes.rows[0];

    const oldPrice = round4(existing.current_price);
    const newPrice = commitData.changeBasePrice ? round4(commitData.newBasePrice) : oldPrice;
    const changePct = oldPrice > 0 ? round2(((newPrice - oldPrice) / oldPrice) * 100) : 0;
    const setAsPrimary = Boolean(commitData.setAsPrimary);
    const effectiveDate = formatSqlDate(commitData.effectiveDate, new Date().toISOString().slice(0, 10));
    const moq = Number(commitData.moq || existing.moq || 1);
    const leadTime = Number(commitData.leadTimeDays || existing.lead_time_days || 7);

    // Build volume pricing update
    let updatedTiers = typeof existing.volume_pricing === 'string' ? JSON.parse(existing.volume_pricing) : existing.volume_pricing || [];
    if (commitData.selectedRanges && Array.isArray(commitData.selectedRanges)) {
      commitData.selectedRanges.forEach((cr: any) => {
        if (updatedTiers[cr.rangeIndex]) {
          updatedTiers[cr.rangeIndex] = {
            ...updatedTiers[cr.rangeIndex],
            minQty: Number(cr.minQty),
            maxQty: cr.maxQty ? Number(cr.maxQty) : undefined,
            unitPrice: round4(cr.newPrice),
            discountPct: round2(cr.discountPct),
            label: cr.label
          };
        }
      });
    }

    if (setAsPrimary) {
      await db.query(`UPDATE material_vendor_quotes SET is_preferred = false, status = 'Active' WHERE material_id = $1`, [materialId]);
    }

    await db.query(
      `UPDATE material_vendor_quotes SET
        current_price = $1,
        volume_pricing = $2,
        lead_time_days = $3,
        moq = $4,
        is_preferred = $5,
        status = $6,
        last_quoted_date = $7,
        updated_at = NOW()
      WHERE id = $8`,
      [
        newPrice,
        JSON.stringify(updatedTiers),
        leadTime,
        moq,
        setAsPrimary ? true : existing.is_preferred,
        setAsPrimary ? 'Preferred' : existing.status,
        effectiveDate,
        quoteId
      ]
    );

    // Insert record into material_vendor_price_history
    const histId = `hist-vq-${Date.now()}`;
    await db.query(
      `INSERT INTO material_vendor_price_history (
        id, quote_id, material_id, vendor_id, vendor_name, revision_date,
        price, previous_price, change_pct, reason, quote_ref, moq, lead_time_days,
        updated_by, target_tier_label, changed_tiers, tier_changes, applied_changes_summary, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW()
      )`,
      [
        histId,
        quoteId,
        materialId,
        existing.vendor_id,
        existing.vendor_name,
        effectiveDate,
        newPrice,
        oldPrice,
        changePct,
        commitData.reason || 'Official vendor quotation adjustment and volume structure update.',
        commitData.quoteRef || `QT-${Date.now()}`,
        moq,
        leadTime,
        actor?.name || commitData.updatedBy || 'Estimator',
        commitData.targetTierLabel || 'Base Rate',
        JSON.stringify(commitData.recordedChangedTiers || []),
        JSON.stringify(commitData.tierChanges || []),
        JSON.stringify(commitData.appliedChangesSummary || [])
      ]
    );

    if (setAsPrimary) {
      await db.query(
        `UPDATE materials SET
          current_price = $1,
          last_price = $2,
          supplier_name = $3,
          supplier_id = $4,
          lead_time_days = $5,
          effective_date = $6,
          last_updated = $6,
          updated_at_ts = NOW()
        WHERE id = $7`,
        [newPrice, oldPrice, existing.vendor_name, existing.vendor_id, leadTime, effectiveDate, materialId]
      );
    }

    const quotes = await this.getMaterialVendorQuotes(materialId);
    return quotes.find((q) => q.id === quoteId);
  }

  public async deleteMaterialVendorQuote(
    materialId: string,
    quoteId: string,
    archivePayload?: any,
    actor?: any
  ): Promise<{ success: boolean; archived: boolean; archiveRecord?: any }> {
    const db = await this.getDb();
    const existingRes = await db.query('SELECT * FROM material_vendor_quotes WHERE id = $1 AND material_id = $2', [quoteId, materialId]);
    if (existingRes.rows.length === 0) {
      throw new Error('Material vendor quote not found');
    }
    const quote = existingRes.rows[0];

    // Check count of price history revisions
    const histRes = await db.query('SELECT * FROM material_vendor_price_history WHERE quote_id = $1', [quoteId]);
    const historyCount = histRes.rows.length;

    // Strict compliance requirement: If history exists, archive payload with downloaded filename and user info is mandatory!
    if (historyCount > 0) {
      if (!archivePayload || !archivePayload.archivedFilename) {
        throw Object.assign(new Error('Compliance Enforcement: Deletion is strictly blocked until price history archive is downloaded.'), { status: 400 });
      }
    }

    let archiveRecord: any = null;
    const actorUser = (archivePayload?.user && (archivePayload.user.name || archivePayload.user.id))
      ? archivePayload.user
      : (actor || { id: 'ADMIN-01', name: 'Administrator', role: 'ADMIN' });

    if (historyCount > 0) {
      const matRes = await db.query('SELECT code, name FROM materials WHERE id = $1', [materialId]);
      const matCode = matRes.rows[0]?.code || '';
      const matName = matRes.rows[0]?.name || '';

      const archiveId = `vda-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await db.query(
        `INSERT INTO vendor_deletion_archives (
          id, material_id, material_code, material_name, vendor_id, vendor_name,
          history_count, archived_filename, archive_data, actor_id, actor_name, actor_role, actor_email, notes, archived_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()
        )`,
        [
          archiveId,
          materialId,
          matCode,
          matName,
          quote.vendor_id || quote.id,
          quote.vendor_name,
          historyCount,
          archivePayload.archivedFilename,
          JSON.stringify(histRes.rows),
          actorUser.id || actorUser.employeeId || 'ADMIN-01',
          actorUser.name || 'Administrator',
          actorUser.role || 'ADMIN',
          actorUser.email || '',
          archivePayload.notes || 'Vendor price history archived prior to deletion'
        ]
      );

      archiveRecord = {
        id: archiveId,
        materialId,
        vendorName: quote.vendor_name,
        historyCount,
        archivedFilename: archivePayload.archivedFilename,
        archivedAt: new Date().toISOString()
      };
    }

    await db.query('DELETE FROM material_vendor_quotes WHERE id = $1', [quoteId]);

    // If deleted quote was preferred, promote remaining
    if (quote.is_preferred) {
      const remainingRes = await db.query('SELECT * FROM material_vendor_quotes WHERE material_id = $1 ORDER BY current_price ASC LIMIT 1', [materialId]);
      if (remainingRes.rows.length > 0) {
        const nextPreferred = remainingRes.rows[0];
        await db.query(`UPDATE material_vendor_quotes SET is_preferred = true, status = 'Preferred' WHERE id = $1`, [nextPreferred.id]);
        await db.query(
          `UPDATE materials SET supplier_name = $1, supplier_id = $2, current_price = $3, updated_at_ts = NOW() WHERE id = $4`,
          [nextPreferred.vendor_name, nextPreferred.vendor_id, nextPreferred.current_price, materialId]
        );
      } else {
        await db.query(`UPDATE materials SET supplier_name = '', supplier_id = NULL, updated_at_ts = NOW() WHERE id = $1`, [materialId]);
      }
    }

    return {
      success: true,
      archived: historyCount > 0,
      archiveRecord
    };
  }

  public async ensureProductCompetitorSchema(): Promise<void> {
    const db = this.db!;
    try {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS competitors (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          code TEXT UNIQUE,
          country TEXT DEFAULT 'United States',
          market_tier TEXT DEFAULT 'Market Benchmark',
          contact_person TEXT DEFAULT '',
          email TEXT DEFAULT '',
          website TEXT DEFAULT '',
          notes TEXT DEFAULT '',
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        INSERT INTO competitors (id, name, code, country, market_tier, notes)
        VALUES
          ('comp-01', 'Apex Industrial Dynamics', 'COMP-APEX', 'United States', 'Market Leader', 'Primary domestic competitor across automation and architectural lines.'),
          ('comp-02', 'Global Core Systems Ltd', 'COMP-GLOBAL', 'Germany', 'Premium Rival', 'High-end European precision engineering alternative.'),
          ('comp-03', 'Benchmark Industry Average', 'COMP-BENCH', 'Global', 'Market Benchmark', 'Aggregated median market reference rate.'),
          ('comp-04', 'Vanguard Precision Tech', 'COMP-VANG', 'Singapore', 'Low-Cost Challenger', 'Asian Pacific fast-turn competitive rates.')
        ON CONFLICT (id) DO NOTHING;

        CREATE TABLE IF NOT EXISTS product_competitor_quotes (
          id TEXT PRIMARY KEY,
          item_id TEXT NOT NULL,
          item_type TEXT NOT NULL DEFAULT 'product',
          item_code TEXT DEFAULT '',
          item_name TEXT NOT NULL,
          competitor_id TEXT REFERENCES competitors(id) ON DELETE SET NULL,
          competitor_name TEXT NOT NULL,
          current_price NUMERIC(18, 4) NOT NULL CHECK (current_price >= 0),
          currency TEXT NOT NULL DEFAULT 'USD',
          our_price NUMERIC(18, 4) NOT NULL DEFAULT 0,
          price_delta NUMERIC(18, 4) DEFAULT 0,
          spread_pct NUMERIC(10, 2) DEFAULT 0,
          moq NUMERIC(18, 4) DEFAULT 1,
          lead_time_days INT DEFAULT 7,
          is_benchmark BOOLEAN NOT NULL DEFAULT false,
          last_quoted_date DATE NOT NULL DEFAULT CURRENT_DATE,
          status TEXT NOT NULL DEFAULT 'Active',
          contact_email TEXT DEFAULT '',
          contact_phone TEXT DEFAULT '',
          notes TEXT DEFAULT '',
          volume_pricing JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

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

        CREATE TABLE IF NOT EXISTS project_deliverables (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          plan_id TEXT REFERENCES project_plans(id) ON DELETE SET NULL,
          revenue_item_id TEXT REFERENCES revenue_items(id) ON DELETE SET NULL,
          produce_item_id TEXT REFERENCES produce_items(id) ON DELETE SET NULL,
          code TEXT NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'product',
          category TEXT DEFAULT '',
          sub_category TEXT DEFAULT '',
          quantity NUMERIC(18, 4) NOT NULL DEFAULT 1,
          unit TEXT NOT NULL DEFAULT 'pcs',
          cost_price NUMERIC(18, 4) NOT NULL DEFAULT 0,
          quoted_price NUMERIC(18, 4) NOT NULL DEFAULT 0,
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

        CREATE INDEX IF NOT EXISTS idx_competitors_name ON competitors(name);
        CREATE INDEX IF NOT EXISTS idx_prod_comp_quotes_item ON product_competitor_quotes(item_id);
        CREATE INDEX IF NOT EXISTS idx_prod_comp_quotes_comp ON product_competitor_quotes(competitor_id);
        CREATE INDEX IF NOT EXISTS idx_prod_comp_hist_quote ON product_competitor_price_history(quote_id, revision_date DESC);
        CREATE INDEX IF NOT EXISTS idx_proj_deliv_proj ON project_deliverables(project_id);

        -- Ensure deliverables column exists on projects table for synchronized storage
        ALTER TABLE projects ADD COLUMN IF NOT EXISTS deliverables JSONB DEFAULT '[]'::jsonb;

        -- Enhance competitor quotes check constraints for enterprise resources and alternatives
        ALTER TABLE product_competitor_quotes DROP CONSTRAINT IF EXISTS product_competitor_quotes_item_type_check;
        ALTER TABLE product_competitor_quotes ADD CONSTRAINT product_competitor_quotes_item_type_check CHECK (
          item_type IN ('product', 'service', 'produce', 'revenue_item', 'resource', 'equipment', 'machinery', 'labour', 'tool', 'subcontractor', 'material', 'overhead')
        );
        ALTER TABLE product_competitor_quotes DROP CONSTRAINT IF EXISTS product_competitor_quotes_status_check;
        ALTER TABLE product_competitor_quotes ADD CONSTRAINT product_competitor_quotes_status_check CHECK (
          status IN ('Active', 'Primary Competitor', 'Benchmark', 'Low Cost', 'Premium Rival', 'Archived', 'Alternative', 'Variable')
        );
        ALTER TABLE product_competitor_quotes DROP CONSTRAINT IF EXISTS product_competitor_quotes_competitor_id_fkey;

        -- 7. Dedicated Competitor Table tracking competitor name, product/service association, pricing, and timestamps
        CREATE TABLE IF NOT EXISTS competitor (
          id TEXT PRIMARY KEY,
          competitor_name TEXT NOT NULL,
          item_id TEXT NOT NULL,
          item_code TEXT DEFAULT '',
          item_name TEXT NOT NULL,
          item_type TEXT NOT NULL DEFAULT 'product',
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

        CREATE INDEX IF NOT EXISTS idx_competitor_name ON competitor(competitor_name);
        CREATE INDEX IF NOT EXISTS idx_competitor_item_id ON competitor(item_id);
        CREATE INDEX IF NOT EXISTS idx_competitor_item_type ON competitor(item_type);
        CREATE INDEX IF NOT EXISTS idx_competitor_created_at ON competitor(created_at DESC);
      `);

      // Seed initial competitor records if empty
      const compCountRes = await db.query('SELECT COUNT(*) as cnt FROM competitor');
      if (Number(compCountRes.rows[0]?.cnt || 0) === 0) {
        await db.exec(`
          INSERT INTO competitor (
            id, competitor_name, item_id, item_code, item_name, item_type,
            product_service_association, pricing, currency, our_price, price_delta, spread_pct,
            market_tier, notes, quoted_at, created_at, updated_at
          ) VALUES
            -- Revenue Services Benchmarks
            ('comp-c01', 'Apex Industrial Dynamics', 'rev-srv-01', 'REV-SRV-001', 'FEA Structural Stress Analysis & Design Review', 'service', 'REV-SRV-001 • FEA Structural Stress Analysis', 195.00, 'USD', 185.00, 10.00, 5.41, 'Market Leader', 'Quoted for ASME Section VIII certified simulation', CURRENT_DATE, NOW(), NOW()),
            ('comp-c02', 'Global Core Systems Ltd', 'rev-srv-01', 'REV-SRV-001', 'FEA Structural Stress Analysis & Design Review', 'service', 'REV-SRV-001 • FEA Structural Stress Analysis', 210.00, 'USD', 185.00, 25.00, 13.51, 'Premium Rival', 'European engineering rates with Eurocode validation', CURRENT_DATE, NOW(), NOW()),
            ('comp-c03', 'Benchmark Industry Average', 'rev-srv-01', 'REV-SRV-001', 'FEA Structural Stress Analysis & Design Review', 'service', 'REV-SRV-001 • FEA Structural Stress Analysis', 190.00, 'USD', 185.00, 5.00, 2.70, 'Market Benchmark', 'Aggregated median engineering consultancy rate', CURRENT_DATE, NOW(), NOW()),

            ('comp-c04', 'Apex Industrial Dynamics', 'rev-srv-02', 'REV-SRV-002', 'On-Site CMM Laser Calibration & Metrology', 'service', 'REV-SRV-002 • On-Site CMM Laser Calibration', 2550.00, 'USD', 2400.00, 150.00, 6.25, 'Market Leader', 'Field technician daily metrology day-rate', CURRENT_DATE, NOW(), NOW()),
            ('comp-c05', 'Vanguard Precision Tech', 'rev-srv-02', 'REV-SRV-002', 'On-Site CMM Laser Calibration & Metrology', 'service', 'REV-SRV-002 • On-Site CMM Laser Calibration', 2280.00, 'USD', 2400.00, -120.00, -5.00, 'Low-Cost Challenger', 'Rapid field calibration service without ISO certificate', CURRENT_DATE, NOW(), NOW()),

            ('comp-c06', 'Apex Industrial Dynamics', 'rev-srv-03', 'REV-SRV-003', 'Turnkey Robotic Cell Commissioning & FAT', 'service', 'REV-SRV-003 • Turnkey Robotic Cell Commissioning', 19800.00, 'USD', 18500.00, 1300.00, 7.03, 'Primary Competitor', 'Standard robotic cell FAT and pilot signoff', CURRENT_DATE, NOW(), NOW()),
            ('comp-c07', 'Benchmark Industry Average', 'rev-srv-03', 'REV-SRV-003', 'Turnkey Robotic Cell Commissioning & FAT', 'service', 'REV-SRV-003 • Turnkey Robotic Cell Commissioning', 19000.00, 'USD', 18500.00, 500.00, 2.70, 'Market Benchmark', 'Median turnkey automation commissioning quote', CURRENT_DATE, NOW(), NOW()),

            ('comp-c08', 'Global Core Systems Ltd', 'rev-srv-04', 'REV-SRV-004', 'AS9100 / ISO Quality Audit & Compliance Support', 'service', 'REV-SRV-004 • AS9100 / ISO Quality Audit', 240.00, 'USD', 220.00, 20.00, 9.09, 'Premium Rival', 'Accredited lead auditor hourly rate', CURRENT_DATE, NOW(), NOW()),
            ('comp-c09', 'Apex Industrial Dynamics', 'rev-srv-04', 'REV-SRV-004', 'AS9100 / ISO Quality Audit & Compliance Support', 'service', 'REV-SRV-004 • AS9100 / ISO Quality Audit', 230.00, 'USD', 220.00, 10.00, 4.55, 'Market Leader', 'Domestic compliance audit hourly rate', CURRENT_DATE, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING;
        `);
      }
    } catch (e: any) {
      console.warn('[PostgreSQL] ensureProductCompetitorSchema warning:', e?.message);
    }
  }

  // --- Competitors Registry CRUD ---
  public async getCompetitors(): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM competitors WHERE is_active = true ORDER BY name ASC');
    return res.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      country: r.country,
      marketTier: r.market_tier,
      contactPerson: r.contact_person,
      email: r.email,
      website: r.website,
      notes: r.notes,
      isActive: r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  public async createCompetitor(data: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `comp-${Date.now()}`;
    const code = data.code || `COMP-${String(data.name || 'NEW').slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const res = await db.query(
      `INSERT INTO competitors (id, name, code, country, market_tier, contact_person, email, website, notes, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       RETURNING *`,
      [
        id,
        data.name,
        code,
        data.country || 'United States',
        data.marketTier || 'Primary Competitor',
        data.contactPerson || '',
        data.email || '',
        data.website || '',
        data.notes || '',
        data.isActive !== false
      ]
    );
    const r = res.rows[0];
    return {
      id: r.id,
      name: r.name,
      code: r.code,
      country: r.country,
      marketTier: r.market_tier,
      contactPerson: r.contact_person,
      email: r.email,
      website: r.website,
      notes: r.notes,
      isActive: r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  public async updateCompetitor(id: string, data: any): Promise<any> {
    const db = await this.getDb();
    const existing = await db.query('SELECT * FROM competitors WHERE id = $1', [id]);
    if (existing.rows.length === 0) return null;

    const res = await db.query(
      `UPDATE competitors SET
        name = COALESCE($1, name),
        code = COALESCE($2, code),
        country = COALESCE($3, country),
        market_tier = COALESCE($4, market_tier),
        contact_person = COALESCE($5, contact_person),
        email = COALESCE($6, email),
        website = COALESCE($7, website),
        notes = COALESCE($8, notes),
        is_active = COALESCE($9, is_active),
        updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        data.name,
        data.code,
        data.country,
        data.marketTier,
        data.contactPerson,
        data.email,
        data.website,
        data.notes,
        data.isActive,
        id
      ]
    );
    const r = res.rows[0];
    return {
      id: r.id,
      name: r.name,
      code: r.code,
      country: r.country,
      marketTier: r.market_tier,
      contactPerson: r.contact_person,
      email: r.email,
      website: r.website,
      notes: r.notes,
      isActive: r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  public async deleteCompetitor(id: string): Promise<boolean> {
    const db = await this.getDb();
    await db.query('DELETE FROM competitors WHERE id = $1', [id]);
    return true;
  }

  // --- Competitor Table (Tracking competitor name, product/service association, pricing, timestamps) ---
  public async getCompetitorEntries(opts?: { itemId?: string; itemType?: string; search?: string }): Promise<any[]> {
    const db = await this.getDb();
    let sql = 'SELECT * FROM competitor WHERE 1=1';
    const params: any[] = [];
    if (opts?.itemId) {
      params.push(opts.itemId);
      sql += ` AND item_id = $${params.length}`;
    }
    if (opts?.itemType) {
      params.push(opts.itemType);
      sql += ` AND item_type = $${params.length}`;
    }
    if (opts?.search) {
      params.push(`%${opts.search.toLowerCase()}%`);
      sql += ` AND (LOWER(competitor_name) LIKE $${params.length} OR LOWER(item_name) LIKE $${params.length} OR LOWER(item_code) LIKE $${params.length})`;
    }
    sql += ' ORDER BY created_at DESC';
    const res = await db.query(sql, params);
    return res.rows.map((r: any) => ({
      id: r.id,
      competitorName: r.competitor_name,
      itemId: r.item_id,
      itemCode: r.item_code,
      itemName: r.item_name,
      itemType: r.item_type,
      productServiceAssociation: r.product_service_association,
      pricing: round4(r.pricing),
      currency: r.currency || 'USD',
      ourPrice: round4(r.our_price || 0),
      priceDelta: round4(r.price_delta || 0),
      spreadPct: round2(r.spread_pct || 0),
      marketTier: r.market_tier,
      notes: r.notes,
      quotedAt: formatSqlDate(r.quoted_at, new Date().toISOString().slice(0, 10)),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  public async createCompetitorEntry(data: any, actor?: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `comp-entry-${Date.now()}`;
    const pricing = round4(data.pricing || data.price || 0);
    const ourPrice = round4(data.ourPrice || 0);
    const delta = round4(pricing - ourPrice);
    const spreadPct = ourPrice > 0 ? round2(((pricing - ourPrice) / ourPrice) * 100) : 0;
    const assoc = data.productServiceAssociation || `${data.itemCode || data.itemId} • ${data.itemName || 'Direct Offering'}`;
    const quotedAt = formatSqlDate(data.quotedAt || data.quoted_at, new Date().toISOString().slice(0, 10));

    await db.query(
      `INSERT INTO competitor (
        id, competitor_name, item_id, item_code, item_name, item_type,
        product_service_association, pricing, currency, our_price, price_delta, spread_pct,
        market_tier, notes, quoted_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())`,
      [
        id,
        data.competitorName || 'Competitor',
        data.itemId,
        data.itemCode || '',
        data.itemName || 'Offering',
        data.itemType || 'product',
        assoc,
        pricing,
        data.currency || 'USD',
        ourPrice,
        delta,
        spreadPct,
        data.marketTier || 'Primary Competitor',
        data.notes || '',
        quotedAt
      ]
    );

    const rows = await this.getCompetitorEntries({ itemId: data.itemId });
    return rows.find((r) => r.id === id) || rows[0];
  }

  public async updateCompetitorEntry(id: string, data: any, actor?: any): Promise<any> {
    const db = await this.getDb();
    const pricing = data.pricing !== undefined ? round4(data.pricing) : undefined;
    const ourPrice = data.ourPrice !== undefined ? round4(data.ourPrice) : undefined;

    await db.query(
      `UPDATE competitor SET
        competitor_name = COALESCE($1, competitor_name),
        pricing = COALESCE($2, pricing),
        our_price = COALESCE($3, our_price),
        market_tier = COALESCE($4, market_tier),
        notes = COALESCE($5, notes),
        quoted_at = COALESCE($6, quoted_at),
        updated_at = NOW()
      WHERE id = $7`,
      [
        data.competitorName,
        pricing,
        ourPrice,
        data.marketTier,
        data.notes,
        data.quotedAt ? formatSqlDate(data.quotedAt) : null,
        id
      ]
    );
    const rows = await db.query('SELECT * FROM competitor WHERE id = $1', [id]);
    return rows.rows[0] || null;
  }

  public async deleteCompetitorEntry(id: string, actor?: any): Promise<boolean> {
    const db = await this.getDb();
    await db.query('DELETE FROM competitor WHERE id = $1', [id]);
    return true;
  }

  public async getAllCompetitorBenchmarksMap(): Promise<Record<string, any>> {
    const db = await this.getDb();
    const map: Record<string, any> = {};

    try {
      // 1. Fetch all rows from competitor table
      const compRes = await db.query('SELECT * FROM competitor ORDER BY created_at ASC');
      // 2. Fetch all quotes from product_competitor_quotes
      const quotesRes = await db.query('SELECT * FROM product_competitor_quotes ORDER BY created_at ASC');

      // 3. Fetch all produce items and revenue items to know our rates
      const [revRes, prodRes] = await Promise.all([
        db.query('SELECT id, code, name, default_rate, cost_price, type FROM revenue_items'),
        db.query('SELECT id, code, name, retail_price, cost_price, type FROM produce_items')
      ]);

      const itemInfo: Record<string, { code: string; name: string; ourPrice: number; ourCost: number; type: string }> = {};
      for (const r of revRes.rows) {
        itemInfo[r.id] = {
          code: r.code || '',
          name: r.name || '',
          ourPrice: round4(r.default_rate || 0),
          ourCost: round4(r.cost_price || 0),
          type: r.type || 'service'
        };
        if (r.code) itemInfo[r.code] = itemInfo[r.id];
      }
      for (const p of prodRes.rows) {
        itemInfo[p.id] = {
          code: p.code || '',
          name: p.name || '',
          ourPrice: round4(p.retail_price || (p.cost_price ? p.cost_price * 1.35 : 100)),
          ourCost: round4(p.cost_price || 0),
          type: p.type || 'product'
        };
        if (p.code) itemInfo[p.code] = itemInfo[p.id];
      }

      // Group quotes/entries by itemId
      const itemQuotes: Record<string, Array<{ id: string; competitorName: string; pricing: number; marketTier?: string; quotedAt?: string }>> = {};

      for (const c of compRes.rows) {
        if (!c.item_id) continue;
        if (!itemQuotes[c.item_id]) itemQuotes[c.item_id] = [];
        itemQuotes[c.item_id].push({
          id: c.id,
          competitorName: c.competitor_name,
          pricing: round4(c.pricing),
          marketTier: c.market_tier || 'Primary Competitor',
          quotedAt: formatSqlDate(c.quoted_at, new Date().toISOString().slice(0, 10))
        });
      }

      for (const q of quotesRes.rows) {
        if (!q.item_id) continue;
        if (!itemQuotes[q.item_id]) itemQuotes[q.item_id] = [];
        // Avoid duplicate competitor entry if already recorded
        const exists = itemQuotes[q.item_id].some(
          (ex) => ex.competitorName.toLowerCase() === (q.competitor_name || '').toLowerCase()
        );
        if (!exists) {
          itemQuotes[q.item_id].push({
            id: q.id,
            competitorName: q.competitor_name,
            pricing: round4(q.current_price),
            marketTier: q.is_benchmark ? 'Market Benchmark' : q.status || 'Competitor',
            quotedAt: formatSqlDate(q.last_quoted_date, new Date().toISOString().slice(0, 10))
          });
        }
      }

      // For every known item in itemInfo, or items in itemQuotes:
      const allItemIds = Array.from(new Set([...Object.keys(itemInfo), ...Object.keys(itemQuotes)]));

      for (const itemId of allItemIds) {
        const info = itemInfo[itemId];
        let quotes = itemQuotes[itemId] || [];
        const ourPrice = info?.ourPrice || 100;

        // If no quotes exist yet for a product or revenue item, generate realistic benchmark quotes
        if (quotes.length === 0 && info && ourPrice > 0) {
          const apexPrice = round2(ourPrice * 1.055);
          const benchPrice = round2(ourPrice * 1.025);
          quotes = [
            {
              id: `bench-${itemId}-apex`,
              competitorName: 'Apex Industrial Dynamics',
              pricing: apexPrice,
              marketTier: 'Market Leader',
              quotedAt: new Date().toISOString().slice(0, 10)
            },
            {
              id: `bench-${itemId}-median`,
              competitorName: 'Benchmark Industry Average',
              pricing: benchPrice,
              marketTier: 'Market Benchmark',
              quotedAt: new Date().toISOString().slice(0, 10)
            }
          ];
        }

        if (quotes.length > 0) {
          const prices = quotes.map((q) => q.pricing).sort((a, b) => a - b);
          const lowest = quotes.find((q) => q.pricing === prices[0])!;
          const highest = quotes.find((q) => q.pricing === prices[prices.length - 1])!;
          const benchmark =
            quotes.find((q) => q.marketTier === 'Market Benchmark' || q.competitorName.includes('Benchmark')) ||
            quotes.find((q) => q.marketTier === 'Market Leader' || q.competitorName.includes('Apex')) ||
            quotes[0];

          const benchPrice = benchmark.pricing;
          const priceDelta = round4(benchPrice - ourPrice);
          const spreadPct = ourPrice > 0 ? round2(((benchPrice - ourPrice) / ourPrice) * 100) : 0;

          const summary = {
            itemId,
            itemCode: info?.code || '',
            itemName: info?.name || '',
            itemType: info?.type || 'product',
            ourPrice,
            benchmarkPrice: benchPrice,
            benchmarkCompetitor: benchmark.competitorName,
            lowestPrice: lowest.pricing,
            lowestCompetitor: lowest.competitorName,
            highestPrice: highest.pricing,
            highestCompetitor: highest.competitorName,
            spreadPct,
            priceDelta,
            quotesCount: quotes.length,
            quotes: quotes.map((q) => ({
              ...q,
              spreadPct: ourPrice > 0 ? round2(((q.pricing - ourPrice) / ourPrice) * 100) : 0
            }))
          };

          map[itemId] = summary;
          if (info?.code) {
            map[info.code] = summary;
          }
        }
      }
    } catch (e: any) {
      console.warn('[PostgreSQL] getAllCompetitorBenchmarksMap error:', e?.message);
    }

    return map;
  }

  public async getVendorDeletionArchives(materialId?: string): Promise<any[]> {
    const db = await this.getDb();
    try {
      if (materialId) {
        const res = await db.query(
          'SELECT * FROM vendor_deletion_archives WHERE material_id = $1 ORDER BY archived_at DESC',
          [materialId]
        );
        return res.rows;
      }
      const res = await db.query('SELECT * FROM vendor_deletion_archives ORDER BY archived_at DESC');
      return res.rows;
    } catch (e: any) {
      console.warn('[PostgreSQL] vendor_deletion_archives query fallback:', e?.message);
      return [];
    }
  }

  // --- Product & Revenue Service Competitor Quotes & Matrix ---
  public async getProductCompetitorQuotes(itemId: string, itemType?: string): Promise<any[]> {
    const db = await this.getDb();

    // Fetch existing competitor quotes for this product/service
    const quotesRes = await db.query(
      `SELECT * FROM product_competitor_quotes WHERE item_id = $1 ORDER BY is_benchmark DESC, current_price ASC, created_at ASC`,
      [itemId]
    );

    let quotes = quotesRes.rows;

    // Resolve our own active product rate to establish baseline comparison
    let ourRate = 0;
    let ourCost = 0;
    let itemCode = '';
    let itemName = '';
    let resolvedItemType = itemType || 'product';

    // Check revenue_items first
    const revRes = await db.query('SELECT * FROM revenue_items WHERE id = $1', [itemId]);
    if (revRes.rows.length > 0) {
      const ri = revRes.rows[0];
      ourRate = round4(ri.default_rate || 0);
      ourCost = round4(ri.cost_price || 0);
      itemCode = ri.code || '';
      itemName = ri.name || '';
      resolvedItemType = ri.type || 'product';
    } else {
      // Check produce_items
      const prodRes = await db.query('SELECT * FROM produce_items WHERE id = $1', [itemId]);
      if (prodRes.rows.length > 0) {
        const pi = prodRes.rows[0];
        ourRate = round4(pi.retail_price || 0);
        ourCost = round4(pi.cost_price || 0);
        itemCode = pi.code || '';
        itemName = pi.name || '';
        resolvedItemType = pi.type || 'product';
      } else {
        // Check enterprise_resources
        const resRes = await db.query('SELECT * FROM enterprise_resources WHERE id = $1', [itemId]);
        if (resRes.rows.length > 0) {
          const r = resRes.rows[0];
          ourRate = round4(r.base_rate || 0);
          ourCost = round4(r.operational_charge || 0);
          itemCode = r.code || '';
          itemName = r.name || '';
          resolvedItemType = r.type || 'resource';

          // If quotes are empty and resource has alternatives JSONB, seed from alternatives
          if (quotes.length === 0) {
            const alts = typeof r.alternatives === 'string' ? JSON.parse(r.alternatives || '[]') : (r.alternatives || []);
            if (Array.isArray(alts) && alts.length > 0) {
              for (const alt of alts) {
                const altPrice = Number(alt.rate || ourRate * 1.05);
                const altQuoteId = `pcq-${itemId}-${alt.id || Date.now()}`;
                const altDelta = round4(altPrice - ourRate);
                const altSpread = ourRate > 0 ? round2(((altPrice - ourRate) / ourRate) * 100) : 0;
                const altTiers = [
                  { minQty: 1, maxQty: 4, unitPrice: altPrice, discountPct: 0, label: '1–4 (Base Rate)' },
                  { minQty: 5, unitPrice: round2(altPrice * 0.94), discountPct: 6.0, label: '5+ (Volume Tier)' }
                ];
                await db.query(
                  `INSERT INTO product_competitor_quotes (
                    id, item_id, item_type, item_code, item_name, competitor_id, competitor_name,
                    current_price, currency, our_price, price_delta, spread_pct, moq, lead_time_days,
                    is_benchmark, last_quoted_date, status, notes, volume_pricing, created_at, updated_at
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'LKR', $9, $10, $11, 1, $12, false, CURRENT_DATE, 'Alternative', $13, $14, NOW(), NOW())
                  ON CONFLICT (id) DO NOTHING`,
                  [
                    altQuoteId, itemId, resolvedItemType, itemCode, itemName,
                    alt.id || 'comp-alt', alt.providerOrCompetitor || alt.name || 'Competitor Alternative',
                    altPrice, ourRate, altDelta, altSpread, Number(alt.leadTimeDays || 7),
                    alt.notes || 'Alternative option recorded in database', JSON.stringify(altTiers)
                  ]
                );
                await db.query(
                  `INSERT INTO product_competitor_price_history (
                    id, quote_id, item_id, item_type, competitor_id, competitor_name, revision_date,
                    price, previous_price, our_price, change_pct, reason, quote_ref, moq, lead_time_days,
                    updated_by, target_tier_label, changed_tiers, tier_changes, applied_changes_summary, created_at
                  ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, $7, $7, $8, 0, $9, $10, 1, $11, 'Pricing Engine', 'Base Rate', '[]', '[]', $12, NOW())
                  ON CONFLICT (id) DO NOTHING`,
                  [
                    `hist-${altQuoteId}-init`, altQuoteId, itemId, resolvedItemType,
                    alt.id || 'comp-alt', alt.providerOrCompetitor || alt.name || 'Competitor Alternative',
                    altPrice, ourRate, 'Initial competitor alternative benchmark',
                    `QT-ALT-${itemCode || 'RES'}`, Number(alt.leadTimeDays || 7),
                    JSON.stringify([`Initial alternative rate logged at LKR ${altPrice.toFixed(2)}`])
                  ]
                );
              }
            }
          }
        } else {
          // Check overhead_items
          const ovhRes = await db.query('SELECT * FROM overhead_items WHERE id = $1', [itemId]);
          if (ovhRes.rows.length > 0) {
            const ovh = ovhRes.rows[0];
            ourRate = round4(ovh.amount || 0);
            ourCost = round4(ovh.cost_baseline || 0);
            itemCode = ovh.code || '';
            itemName = ovh.name || '';
            resolvedItemType = 'overhead';
          } else {
            // Check materials
            const matRes = await db.query('SELECT * FROM materials WHERE id = $1', [itemId]);
            if (matRes.rows.length > 0) {
              const mat = matRes.rows[0];
              ourRate = round4(mat.cost_per_unit || 0);
              itemCode = mat.code || '';
              itemName = mat.name || '';
              resolvedItemType = 'material';
            }
          }
        }
      }
    }

    // Refresh quotes if we seeded from alternatives
    const refreshedQuotesRes = await db.query(
      `SELECT * FROM product_competitor_quotes WHERE item_id = $1 ORDER BY is_benchmark DESC, current_price ASC, created_at ASC`,
      [itemId]
    );
    quotes = refreshedQuotesRes.rows;

    // If still none exist yet, seed initial realistic competitor quotes & benchmarks
    if (quotes.length === 0 && (ourRate > 0 || itemName)) {
      const baseCompPrice1 = ourRate > 0 ? round2(ourRate * 1.05) : 5000;
      const baseCompPrice2 = ourRate > 0 ? round2(ourRate * 0.96) : 4800;

      const q1Id = `pcq-${itemId}-apex-${Date.now()}`;
      const q2Id = `pcq-${itemId}-bench-${Date.now() + 1}`;

      const tiers1 = [
        { minQty: 1, maxQty: 4, unitPrice: baseCompPrice1, discountPct: 0, label: '1–4 (Base Rate)' },
        { minQty: 5, maxQty: 15, unitPrice: round2(baseCompPrice1 * 0.94), discountPct: 6.0, label: '5–15 (Volume Tier)' },
        { minQty: 16, unitPrice: round2(baseCompPrice1 * 0.88), discountPct: 12.0, label: '16+ (Enterprise Volume)' }
      ];

      const tiers2 = [
        { minQty: 1, maxQty: 4, unitPrice: baseCompPrice2, discountPct: 0, label: '1–4 (Base Rate)' },
        { minQty: 5, maxQty: 15, unitPrice: round2(baseCompPrice2 * 0.95), discountPct: 5.0, label: '5–15 (Volume Tier)' },
        { minQty: 16, unitPrice: round2(baseCompPrice2 * 0.90), discountPct: 10.0, label: '16+ (Enterprise Volume)' }
      ];

      await db.query(
        `INSERT INTO product_competitor_quotes (
          id, item_id, item_type, item_code, item_name, competitor_id, competitor_name,
          current_price, currency, our_price, price_delta, spread_pct, moq, lead_time_days,
          is_benchmark, last_quoted_date, status, notes, volume_pricing, created_at, updated_at
        ) VALUES
          ($1, $2, $3, $4, $5, 'comp-01', 'Apex Industrial Dynamics', $6, 'USD', $7, $8, $9, 1, 14, false, CURRENT_DATE, 'Primary Competitor', 'Direct market competitor offering standard commercial warranty.', $10, NOW(), NOW()),
          ($11, $2, $3, $4, $5, 'comp-03', 'Benchmark Industry Average', $12, 'USD', $7, $13, $14, 1, 7, true, CURRENT_DATE, 'Benchmark', 'Aggregated median industry benchmark quote.', $15, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING`,
        [
          q1Id, itemId, resolvedItemType, itemCode, itemName,
          baseCompPrice1, ourRate, round4(baseCompPrice1 - ourRate),
          ourRate > 0 ? round2(((baseCompPrice1 - ourRate) / ourRate) * 100) : 0,
          JSON.stringify(tiers1),
          q2Id, baseCompPrice2, round4(baseCompPrice2 - ourRate),
          ourRate > 0 ? round2(((baseCompPrice2 - ourRate) / ourRate) * 100) : 0,
          JSON.stringify(tiers2)
        ]
      );

      // Seed initial history records for both
      await db.query(
        `INSERT INTO product_competitor_price_history (
          id, quote_id, item_id, item_type, competitor_id, competitor_name, revision_date,
          price, previous_price, our_price, change_pct, reason, quote_ref, moq, lead_time_days,
          updated_by, target_tier_label, changed_tiers, tier_changes, applied_changes_summary, created_at
        ) VALUES
          ($1, $2, $3, $4, 'comp-01', 'Apex Industrial Dynamics', CURRENT_DATE, $5, $5, $6, 0, 'Initial competitor catalog benchmark onboarding', $7, 1, 14, 'Market Intelligence', 'Base Rate', '[]', '[]', $8, NOW()),
          ($9, $10, $3, $4, 'comp-03', 'Benchmark Industry Average', CURRENT_DATE, $11, $11, $6, 0, 'Initial industry median rate capture', $12, 1, 7, 'Market Intelligence', 'Base Rate', '[]', '[]', $13, NOW())
        ON CONFLICT (id) DO NOTHING`,
        [
          `hist-${q1Id}-init`, q1Id, itemId, resolvedItemType, baseCompPrice1, ourRate, `QT-COMP-APEX-${itemCode || 'PROD'}`,
          JSON.stringify([`Initial competitor rate established at $${baseCompPrice1.toFixed(2)} (vs our price $${ourRate.toFixed(2)})`]),
          `hist-${q2Id}-init`, q2Id, baseCompPrice2, `QT-COMP-BENCH-${itemCode || 'PROD'}`,
          JSON.stringify([`Industry benchmark established at $${baseCompPrice2.toFixed(2)} (vs our price $${ourRate.toFixed(2)})`])
        ]
      );

      // Re-fetch seeded rows
      const reRes = await db.query(
        `SELECT * FROM product_competitor_quotes WHERE item_id = $1 ORDER BY is_benchmark DESC, current_price ASC, created_at ASC`,
        [itemId]
      );
      quotes = reRes.rows;
    }

    // Attach price_history to each quote
    const enrichedQuotes = [];
    for (const q of quotes) {
      const histRes = await db.query(
        `SELECT * FROM product_competitor_price_history WHERE quote_id = $1 ORDER BY revision_date DESC, created_at DESC`,
        [q.id]
      );

      const volumePricing = typeof q.volume_pricing === 'string' ? JSON.parse(q.volume_pricing) : q.volume_pricing || [];

      // Re-evaluate spread vs our current price
      const cPrice = round4(q.current_price);
      const delta = round4(cPrice - ourRate);
      const spreadPct = ourRate > 0 ? round2(((cPrice - ourRate) / ourRate) * 100) : 0;

      enrichedQuotes.push({
        id: q.id,
        itemId: q.item_id,
        itemType: q.item_type,
        itemCode: q.item_code,
        itemName: q.item_name,
        competitorId: q.competitor_id,
        competitorName: q.competitor_name,
        currentPrice: cPrice,
        competitorPrice: cPrice,
        currency: q.currency || 'USD',
        ourPrice: ourRate,
        ourCost: ourCost,
        priceDelta: delta,
        spreadPct: spreadPct,
        moq: Number(q.moq || 1),
        leadTimeDays: Number(q.lead_time_days || 7),
        isBenchmark: Boolean(q.is_benchmark),
        lastQuotedDate: formatSqlDate(q.last_quoted_date, new Date().toISOString().slice(0, 10)),
        status: q.status || 'Active',
        contactEmail: q.contact_email,
        contactPhone: q.contact_phone,
        notes: q.notes,
        volumePricing,
        priceHistory: histRes.rows.map((h: any) => ({
          id: h.id,
          quoteId: h.quote_id,
          itemId: h.item_id,
          itemType: h.item_type,
          competitorId: h.competitor_id,
          competitorName: h.competitor_name,
          revisionDate: formatSqlDate(h.revision_date, new Date().toISOString().slice(0, 10)),
          price: round4(h.price),
          previousPrice: h.previous_price != null ? round4(h.previous_price) : undefined,
          ourPrice: h.our_price != null ? round4(h.our_price) : undefined,
          changePct: round2(h.change_pct || 0),
          reason: h.reason,
          quoteRef: h.quote_ref,
          moq: Number(h.moq || 1),
          leadTimeDays: Number(h.lead_time_days || 7),
          updatedBy: h.updated_by,
          targetTierLabel: h.target_tier_label,
          changedTiers: typeof h.changed_tiers === 'string' ? JSON.parse(h.changed_tiers) : h.changed_tiers || [],
          tierChanges: typeof h.tier_changes === 'string' ? JSON.parse(h.tier_changes) : h.tier_changes || [],
          appliedChangesSummary: typeof h.applied_changes_summary === 'string' ? JSON.parse(h.applied_changes_summary) : h.applied_changes_summary || [],
          createdAt: h.created_at
        })),
        createdAt: q.created_at,
        updatedAt: q.updated_at
      });
    }

    return enrichedQuotes;
  }

  public async createProductCompetitorQuote(itemId: string, data: any, actor?: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `pcq-${itemId}-${Date.now()}`;
    const price = round4(data.currentPrice ?? data.competitorPrice ?? data.price ?? 0);
    const ourPrice = round4(data.ourPrice || 0);
    const delta = round4(price - ourPrice);
    const spreadPct = ourPrice > 0 ? round2(((price - ourPrice) / ourPrice) * 100) : 0;
    const moq = Number(data.moq || 1);
    const leadTime = Number(data.leadTimeDays || 7);
    const currency = data.currency || 'USD';

    const defaultVolumePricing = (data.volumePricing && Array.isArray(data.volumePricing) && data.volumePricing.length > 0)
      ? data.volumePricing
      : [
          { minQty: moq, maxQty: moq * 4, unitPrice: price, discountPct: 0, label: `${moq}–${moq * 4} (Base MOQ)` },
          { minQty: moq * 4 + 1, maxQty: moq * 15, unitPrice: round2(price * 0.94), discountPct: 6.0, label: `${moq * 4 + 1}–${moq * 15} (Volume Pack)` },
          { minQty: moq * 15 + 1, unitPrice: round2(price * 0.88), discountPct: 12.0, label: `${moq * 15 + 1}+ (Enterprise Tier)` }
        ];

    await db.query(
      `INSERT INTO product_competitor_quotes (
        id, item_id, item_type, item_code, item_name, competitor_id, competitor_name,
        current_price, currency, our_price, price_delta, spread_pct, moq, lead_time_days,
        is_benchmark, last_quoted_date, status, contact_email, contact_phone, notes, volume_pricing, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_DATE, $16, $17, $18, $19, $20, NOW(), NOW()
      )`,
      [
        id,
        itemId,
        data.itemType || 'product',
        data.itemCode || '',
        data.itemName || 'Product Offering',
        data.competitorId || null,
        data.competitorName || 'Competitor',
        price,
        currency,
        ourPrice,
        delta,
        spreadPct,
        moq,
        leadTime,
        Boolean(data.isBenchmark),
        data.status || 'Active',
        data.contactEmail || '',
        data.contactPhone || '',
        data.notes || '',
        JSON.stringify(defaultVolumePricing)
      ]
    );

    // Initial history event
    const histId = `hist-${id}-${Date.now()}`;
    const actorName = actor?.name || 'Pricing Analyst';
    await db.query(
      `INSERT INTO product_competitor_price_history (
        id, quote_id, item_id, item_type, competitor_id, competitor_name, revision_date,
        price, previous_price, our_price, change_pct, reason, quote_ref, moq, lead_time_days,
        updated_by, target_tier_label, changed_tiers, tier_changes, applied_changes_summary, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, CURRENT_DATE, $7, $7, $8, 0, $9, $10, $11, $12, $13, 'Base Rate', '[]', '[]', $14, NOW()
      )`,
      [
        histId,
        id,
        itemId,
        data.itemType || 'product',
        data.competitorId || null,
        data.competitorName || 'Competitor',
        price,
        ourPrice,
        data.reason || 'Initial competitor rate onboarding',
        data.quoteRef || `QT-${data.competitorName || 'COMP'}-${Date.now().toString().slice(-4)}`,
        moq,
        leadTime,
        actorName,
        JSON.stringify([`Initial competitor rate quoted at $${price.toFixed(2)}`])
      ]
    );

    const quotes = await this.getProductCompetitorQuotes(itemId, data.itemType);
    return quotes.find((q) => q.id === id) || quotes[0];
  }

  public async updateProductCompetitorQuote(quoteId: string, data: any, actor?: any): Promise<any> {
    const db = await this.getDb();
    const existing = await db.query('SELECT * FROM product_competitor_quotes WHERE id = $1', [quoteId]);
    if (existing.rows.length === 0) return null;
    const prev = existing.rows[0];

    const price = data.currentPrice !== undefined
      ? round4(data.currentPrice)
      : (data.competitorPrice !== undefined ? round4(data.competitorPrice) : (data.price !== undefined ? round4(data.price) : round4(prev.current_price)));
    const ourPrice = data.ourPrice !== undefined ? round4(data.ourPrice) : round4(prev.our_price);
    const delta = round4(price - ourPrice);
    const spreadPct = ourPrice > 0 ? round2(((price - ourPrice) / ourPrice) * 100) : 0;
    const moq = data.moq !== undefined ? Number(data.moq) : Number(prev.moq);
    const leadTime = data.leadTimeDays !== undefined ? Number(data.leadTimeDays) : Number(prev.lead_time_days);
    const vp = data.volumePricing ? JSON.stringify(data.volumePricing) : prev.volume_pricing;

    await db.query(
      `UPDATE product_competitor_quotes SET
        competitor_name = COALESCE($1, competitor_name),
        competitor_id = COALESCE($2, competitor_id),
        current_price = $3,
        our_price = $4,
        price_delta = $5,
        spread_pct = $6,
        moq = $7,
        lead_time_days = $8,
        is_benchmark = COALESCE($9, is_benchmark),
        status = COALESCE($10, status),
        notes = COALESCE($11, notes),
        volume_pricing = $12,
        updated_at = NOW()
      WHERE id = $13`,
      [
        data.competitorName,
        data.competitorId,
        price,
        ourPrice,
        delta,
        spreadPct,
        moq,
        leadTime,
        data.isBenchmark,
        data.status,
        data.notes,
        vp,
        quoteId
      ]
    );

    const quotes = await this.getProductCompetitorQuotes(prev.item_id, prev.item_type);
    return quotes.find((q) => q.id === quoteId) || null;
  }

  public async commitProductCompetitorPrice(itemId: string, quoteId: string, data: any, actor?: any): Promise<any> {
    const db = await this.getDb();
    const existing = await db.query('SELECT * FROM product_competitor_quotes WHERE id = $1', [quoteId]);
    if (existing.rows.length === 0) throw new Error('Competitor quote not found');
    const quote = existing.rows[0];

    const newPrice = round4(data.price ?? data.newPrice ?? quote.current_price);
    const prevPrice = round4(quote.current_price);
    const ourPrice = round4(quote.our_price || 0);
    const changePct = prevPrice > 0 ? round2(((newPrice - prevPrice) / prevPrice) * 100) : 0;
    const delta = round4(newPrice - ourPrice);
    const spreadPct = ourPrice > 0 ? round2(((newPrice - ourPrice) / ourPrice) * 100) : 0;

    const revisionDate = formatSqlDate(data.revisionDate || data.effectiveDate, new Date().toISOString().slice(0, 10));
    const reason = data.reason || 'Competitor pricing revision';
    const quoteRef = data.quoteRef || `QT-${quote.competitor_name}-${Date.now().toString().slice(-4)}`;
    const moq = Number(data.moq || quote.moq || 1);
    const leadTime = Number(data.leadTimeDays || quote.lead_time_days || 7);
    const actorName = actor?.name || data.updatedBy || 'Pricing Estimator';

    const volumePricing = (data.volumePricing && Array.isArray(data.volumePricing))
      ? data.volumePricing
      : (typeof quote.volume_pricing === 'string' ? JSON.parse(quote.volume_pricing) : quote.volume_pricing || []);

    const appliedSummary = Array.isArray(data.appliedChangesSummary) && data.appliedChangesSummary.length > 0
      ? data.appliedChangesSummary
      : [`Price revision: $${prevPrice.toFixed(2)} → $${newPrice.toFixed(2)} (${changePct >= 0 ? '+' : ''}${changePct}%)`];

    const currency = data.currency || quote.currency || 'USD';

    // 1. Update product_competitor_quotes
    await db.query(
      `UPDATE product_competitor_quotes SET
        current_price = $1,
        price_delta = $2,
        spread_pct = $3,
        volume_pricing = $4,
        moq = $5,
        lead_time_days = $6,
        last_quoted_date = $7,
        currency = $8,
        updated_at = NOW()
      WHERE id = $9`,
      [newPrice, delta, spreadPct, JSON.stringify(volumePricing), moq, leadTime, revisionDate, currency, quoteId]
    );

    // 2. Insert into product_competitor_price_history
    const histId = `hist-${quoteId}-${Date.now()}`;
    await db.query(
      `INSERT INTO product_competitor_price_history (
        id, quote_id, item_id, item_type, competitor_id, competitor_name, revision_date,
        price, previous_price, our_price, change_pct, reason, quote_ref, moq, lead_time_days,
        updated_by, target_tier_label, changed_tiers, tier_changes, applied_changes_summary, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW()
      )`,
      [
        histId,
        quoteId,
        itemId,
        quote.item_type || 'product',
        quote.competitor_id,
        quote.competitor_name,
        revisionDate,
        newPrice,
        prevPrice,
        ourPrice,
        changePct,
        reason,
        quoteRef,
        moq,
        leadTime,
        actorName,
        data.targetTierLabel || 'Base Rate',
        JSON.stringify(data.changedTiers || []),
        JSON.stringify(data.tierChanges || []),
        JSON.stringify(appliedSummary)
      ]
    );

    // Keep enterprise_resources synced with latest competitor quote
    await db.query(
      `UPDATE enterprise_resources SET competitor_rate = $1, competitor_company = $2, updated_at = NOW() WHERE id = $3`,
      [newPrice, quote.competitor_name, itemId]
    ).catch(() => {});

    const quotes = await this.getProductCompetitorQuotes(itemId, quote.item_type);
    return quotes.find((q) => q.id === quoteId) || quotes[0];
  }

  public async deleteProductCompetitorQuote(itemId: string, quoteId: string, actor?: any): Promise<any> {
    const db = await this.getDb();
    await db.query('DELETE FROM product_competitor_quotes WHERE id = $1', [quoteId]);
    return { success: true };
  }

  public async getProductCompetitorHistory(itemId: string): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query(
      `SELECT * FROM product_competitor_price_history WHERE item_id = $1 ORDER BY revision_date DESC, created_at DESC`,
      [itemId]
    );
    return res.rows.map((h: any) => ({
      id: h.id,
      quoteId: h.quote_id,
      itemId: h.item_id,
      itemType: h.item_type,
      competitorId: h.competitor_id,
      competitorName: h.competitor_name,
      revisionDate: formatSqlDate(h.revision_date, new Date().toISOString().slice(0, 10)),
      price: round4(h.price),
      previousPrice: h.previous_price != null ? round4(h.previous_price) : undefined,
      ourPrice: h.our_price != null ? round4(h.our_price) : undefined,
      changePct: round2(h.change_pct || 0),
      reason: h.reason,
      quoteRef: h.quote_ref,
      moq: Number(h.moq || 1),
      leadTimeDays: Number(h.lead_time_days || 7),
      updatedBy: h.updated_by,
      targetTierLabel: h.target_tier_label,
      changedTiers: typeof h.changed_tiers === 'string' ? JSON.parse(h.changed_tiers) : h.changed_tiers || [],
      tierChanges: typeof h.tier_changes === 'string' ? JSON.parse(h.tier_changes) : h.tier_changes || [],
      appliedChangesSummary: typeof h.applied_changes_summary === 'string' ? JSON.parse(h.applied_changes_summary) : h.applied_changes_summary || [],
      createdAt: h.created_at
    }));
  }

  // --- Project Deliverables Relational Database Operations ---
  public async getProjectDeliverables(projectId: string): Promise<any[]> {
    const db = await this.getDb();

    // Query relational deliverables table
    const res = await db.query(
      `SELECT * FROM project_deliverables WHERE project_id = $1 ORDER BY created_at ASC`,
      [projectId]
    );

    let deliverables = res.rows;

    // If none exist in project_deliverables yet, backfill from project's JSON deliverables or BOQ items
    if (deliverables.length === 0) {
      try {
        const prjRes = await db.query('SELECT deliverables, selected_items, currency FROM projects WHERE id = $1', [projectId]);
        if (prjRes.rows.length > 0) {
          const p = prjRes.rows[0];
          const rawDelivs = typeof p.deliverables === 'string' ? JSON.parse(p.deliverables) : p.deliverables || [];

          if (Array.isArray(rawDelivs) && rawDelivs.length > 0) {
            for (const d of rawDelivs) {
              const did = d.id || `deliv-${projectId}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
              const costPrice = round4(d.costPrice || d.cost || 0);
              const quotedPrice = round4(d.quotedPrice || d.price || (costPrice > 0 ? costPrice * 1.35 : 100));
              const qty = Number(d.quantity || d.qty || 1);
              const totCost = round2(costPrice * qty);
              const totRev = round2(quotedPrice * qty);
              const margin = totRev > 0 ? round2(((totRev - totCost) / totRev) * 100) : 35;

              await db.query(
                `INSERT INTO project_deliverables (
                  id, project_id, plan_id, revenue_item_id, produce_item_id, code, name, type,
                  category, sub_category, quantity, unit, cost_price, quoted_price, total_cost,
                  total_revenue, margin_pct, competitor_benchmark_price, competitor_name, currency,
                  status, lead_time_days, notes, created_at, updated_at
                ) VALUES (
                  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW(), NOW()
                ) ON CONFLICT (id) DO NOTHING`,
                [
                  did,
                  projectId,
                  d.planId || null,
                  d.revenueItemId || null,
                  d.produceItemId || null,
                  d.code || `DELIV-${Math.floor(100 + Math.random() * 900)}`,
                  d.name || 'Deliverable Item',
                  d.type === 'service' ? 'service' : 'product',
                  d.category || 'Direct Offering',
                  d.subCategory || '',
                  qty,
                  d.unit || 'pcs',
                  costPrice,
                  quotedPrice,
                  totCost,
                  totRev,
                  margin,
                  round4(d.competitorBenchmarkPrice || (quotedPrice > 0 ? quotedPrice * 1.05 : 0)),
                  d.competitorName || 'Apex Industrial Dynamics',
                  d.currency || p.currency || 'USD',
                  d.status || 'Planned',
                  Number(d.leadTimeDays || 14),
                  d.notes || ''
                ]
              );
            }

            const reRes = await db.query(
              `SELECT * FROM project_deliverables WHERE project_id = $1 ORDER BY created_at ASC`,
              [projectId]
            );
            deliverables = reRes.rows;
          }
        }
      } catch (err: any) {
        console.warn('[PostgreSQL] Optional deliverables backfill skipped:', err?.message);
      }
    }

    // If still empty, automatically link to available master revenue items (products and services)
    if (deliverables.length === 0) {
      try {
        const revItemsRes = await db.query("SELECT * FROM revenue_items ORDER BY created_at ASC LIMIT 4");
        if (revItemsRes.rows.length > 0) {
          for (const r of revItemsRes.rows) {
            const did = `deliv-${projectId}-${r.code || r.id}`;
            const costPrice = round4(r.cost_price || 0);
            const quotedPrice = round4(r.default_rate || (costPrice > 0 ? costPrice * 1.35 : 100));
            const qty = r.type === 'service' ? 10 : 2;
            const totCost = round2(costPrice * qty);
            const totRev = round2(quotedPrice * qty);
            const margin = totRev > 0 ? round2(((totRev - totCost) / totRev) * 100) : 35;
            const compBench = round4(quotedPrice > 0 ? quotedPrice * 1.05 : 150);

            await db.query(
              `INSERT INTO project_deliverables (
                id, project_id, plan_id, revenue_item_id, produce_item_id, code, name, type,
                category, sub_category, quantity, unit, cost_price, quoted_price, total_cost,
                total_revenue, margin_pct, competitor_benchmark_price, competitor_name, currency,
                status, lead_time_days, notes, created_at, updated_at
              ) VALUES (
                $1, $2, null, $3, null, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'USD', 'Planned', 14, 'Project deliverable linked to revenue catalogue', NOW(), NOW()
              ) ON CONFLICT (id) DO NOTHING`,
              [
                did, projectId, r.id, r.code, r.name, r.type || 'product',
                r.category || 'Commercial Deliverables', r.sub_category || '',
                qty, r.unit || 'pcs', costPrice, quotedPrice, totCost, totRev, margin,
                compBench, 'Apex Industrial Dynamics'
              ]
            ).catch(() => {});
          }

          const seededRes = await db.query(
            `SELECT * FROM project_deliverables WHERE project_id = $1 ORDER BY created_at ASC`,
            [projectId]
          );
          deliverables = seededRes.rows;
        }
      } catch (e: any) {
        console.warn('[PostgreSQL] Revenue deliverable auto-link error:', e?.message);
      }
    }

    return deliverables.map((r: any) => ({
      id: r.id,
      projectId: r.project_id,
      planId: r.plan_id,
      revenueItemId: r.revenue_item_id,
      produceItemId: r.produce_item_id,
      code: r.code,
      name: r.name,
      type: r.type,
      category: r.category,
      subCategory: r.sub_category,
      quantity: Number(r.quantity),
      unit: r.unit,
      costPrice: round4(r.cost_price),
      quotedPrice: round4(r.quoted_price),
      totalCost: round2(r.total_cost),
      totalRevenue: round2(r.total_revenue),
      marginPct: round2(r.margin_pct),
      competitorBenchmarkPrice: round4(r.competitor_benchmark_price || 0),
      competitorName: r.competitor_name || '',
      currency: r.currency || 'USD',
      status: r.status || 'Planned',
      leadTimeDays: Number(r.lead_time_days || 14),
      notes: r.notes || '',
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  public async createProjectDeliverable(projectId: string, data: any, actor?: any): Promise<any> {
    const db = await this.getDb();
    const id = data.id || `deliv-${projectId}-${Date.now()}`;
    const code = data.code || `DELIV-${Math.floor(100 + Math.random() * 900)}`;
    const name = String(data.name || 'Deliverable Item').trim();
    const type = data.type === 'service' ? 'service' : 'product';
    const qty = Math.max(1, Number(data.quantity || 1));
    const unit = data.unit || 'pcs';
    const costPrice = round4(data.costPrice || 0);
    const quotedPrice = round4(data.quotedPrice || (costPrice > 0 ? costPrice * 1.35 : 100));
    const totalCost = round2(costPrice * qty);
    const totalRevenue = round2(quotedPrice * qty);
    const margin = totalRevenue > 0 ? round2(((totalRevenue - totalCost) / totalRevenue) * 100) : 35;
    const compPrice = round4(data.competitorBenchmarkPrice || (quotedPrice > 0 ? quotedPrice * 1.05 : 0));
    const compName = data.competitorName || 'Apex Industrial Dynamics';
    const currency = data.currency || 'USD';
    const status = data.status || 'Planned';
    const leadTime = Number(data.leadTimeDays || 14);

    await db.query(
      `INSERT INTO project_deliverables (
        id, project_id, plan_id, revenue_item_id, produce_item_id, code, name, type,
        category, sub_category, quantity, unit, cost_price, quoted_price, total_cost,
        total_revenue, margin_pct, competitor_benchmark_price, competitor_name, currency,
        status, lead_time_days, notes, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW(), NOW()
      )`,
      [
        id,
        projectId,
        data.planId || null,
        data.revenueItemId || null,
        data.produceItemId || null,
        code,
        name,
        type,
        data.category || 'Direct Offering',
        data.subCategory || '',
        qty,
        unit,
        costPrice,
        quotedPrice,
        totalCost,
        totalRevenue,
        margin,
        compPrice,
        compName,
        currency,
        status,
        leadTime,
        data.notes || ''
      ]
    );

    // Sync project deliverables JSON column safely
    const all = await this.getProjectDeliverables(projectId);
    try {
      await db.query('UPDATE projects SET deliverables = $1, updated_at_ts = NOW() WHERE id = $2', [
        JSON.stringify(all),
        projectId
      ]);
    } catch (e: any) {
      console.warn('[PostgreSQL] Syncing projects.deliverables warning:', e?.message);
    }

    return all.find((d) => d.id === id) || all[0];
  }

  public async updateProjectDeliverable(projectId: string, deliverableId: string, data: any, actor?: any): Promise<any> {
    const db = await this.getDb();
    const existing = await db.query('SELECT * FROM project_deliverables WHERE id = $1 AND project_id = $2', [deliverableId, projectId]);
    if (existing.rows.length === 0) return null;
    const prev = existing.rows[0];

    const qty = data.quantity !== undefined ? Math.max(1, Number(data.quantity)) : Number(prev.quantity);
    const costPrice = data.costPrice !== undefined ? round4(data.costPrice) : round4(prev.cost_price);
    const quotedPrice = data.quotedPrice !== undefined ? round4(data.quotedPrice) : round4(prev.quoted_price);
    const totalCost = round2(costPrice * qty);
    const totalRevenue = round2(quotedPrice * qty);
    const margin = totalRevenue > 0 ? round2(((totalRevenue - totalCost) / totalRevenue) * 100) : 35;
    const compPrice = data.competitorBenchmarkPrice !== undefined ? round4(data.competitorBenchmarkPrice) : round4(prev.competitor_benchmark_price);

    await db.query(
      `UPDATE project_deliverables SET
        name = COALESCE($1, name),
        type = COALESCE($2, type),
        category = COALESCE($3, category),
        quantity = $4,
        unit = COALESCE($5, unit),
        cost_price = $6,
        quoted_price = $7,
        total_cost = $8,
        total_revenue = $9,
        margin_pct = $10,
        competitor_benchmark_price = $11,
        competitor_name = COALESCE($12, competitor_name),
        status = COALESCE($13, status),
        notes = COALESCE($14, notes),
        updated_at = NOW()
      WHERE id = $15 AND project_id = $16`,
      [
        data.name,
        data.type,
        data.category,
        qty,
        data.unit,
        costPrice,
        quotedPrice,
        totalCost,
        totalRevenue,
        margin,
        compPrice,
        data.competitorName,
        data.status,
        data.notes,
        deliverableId,
        projectId
      ]
    );

    // Sync project deliverables JSON column safely
    const all = await this.getProjectDeliverables(projectId);
    try {
      await db.query('UPDATE projects SET deliverables = $1, updated_at_ts = NOW() WHERE id = $2', [
        JSON.stringify(all),
        projectId
      ]);
    } catch (e: any) {
      console.warn('[PostgreSQL] Syncing projects.deliverables warning:', e?.message);
    }

    return all.find((d) => d.id === deliverableId) || null;
  }

  public async deleteProjectDeliverable(projectId: string, deliverableId: string, actor?: any): Promise<any> {
    const db = await this.getDb();
    await db.query('DELETE FROM project_deliverables WHERE id = $1 AND project_id = $2', [deliverableId, projectId]);

    const all = await this.getProjectDeliverables(projectId);
    try {
      await db.query('UPDATE projects SET deliverables = $1, updated_at_ts = NOW() WHERE id = $2', [
        JSON.stringify(all),
        projectId
      ]);
    } catch (e: any) {
      console.warn('[PostgreSQL] Syncing projects.deliverables warning:', e?.message);
    }

    return { success: true };
  }

  // =========================================================================
  // ENTERPRISE RESOURCES PORTAL (LABOURS, MACHINERIES, EQUIPMENTS, TOOLS)
  // =========================================================================

  public async seedEnterpriseResourcesIfEmpty(): Promise<void> {
    const db = await this.getDb();
    try {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS enterprise_resources (
          id TEXT PRIMARY KEY,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          category TEXT NOT NULL,
          sub_category TEXT,
          more_sub_category TEXT,
          unit TEXT NOT NULL DEFAULT 'hr',
          base_rate NUMERIC(18, 4) NOT NULL DEFAULT 0,
          operational_charge NUMERIC(18, 4) DEFAULT 0,
          charge_type TEXT DEFAULT 'hourly',
          currency TEXT NOT NULL DEFAULT 'USD',
          supplier_id TEXT,
          supplier_name TEXT,
          competitor_company TEXT,
          competitor_rate NUMERIC(18, 4) DEFAULT 0,
          industry_benchmark_rate NUMERIC(18, 4) DEFAULT 0,
          lead_time_days INT DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'Available',
          skill_or_sla TEXT,
          alternatives JSONB DEFAULT '[]',
          specifications JSONB DEFAULT '{}',
          connected_allocations JSONB DEFAULT '[]',
          notes TEXT DEFAULT '',
          effective_date DATE DEFAULT CURRENT_DATE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      const chk = await db.query('SELECT COUNT(*) as cnt FROM enterprise_resources');
      if (Number(chk.rows[0]?.cnt || 0) > 0) return;

      const initialResources = [
        {
          id: 'res-lab-01',
          code: 'RES-LAB-01',
          name: 'Senior Avionics Systems Engineer',
          type: 'labour',
          category: 'Aerospace & Avionics',
          sub_category: 'Navigation & Telemetry',
          more_sub_category: 'ASME Certified',
          unit: 'hr',
          base_rate: 95.00,
          operational_charge: 0,
          charge_type: 'hourly',
          currency: 'USD',
          supplier_name: 'Continental Metals Direct',
          competitor_company: 'AeroTech Global',
          competitor_rate: 110.00,
          industry_benchmark_rate: 102.00,
          status: 'Available',
          skill_or_sla: 'Certified Avionics Specialist Level 4',
          alternatives: JSON.stringify([
            {
              id: 'alt-lab-01',
              name: 'Boeing Subcontract Specialist',
              providerOrCompetitor: 'Boeing Contractor Alliance',
              type: 'labour_option',
              rate: 92.00,
              unit: 'hr',
              savingsDiff: 3.00,
              savingsPct: 3.2,
              leadTimeDays: 2,
              reliabilityRating: 4.9,
              isRecommended: true,
              notes: 'ITAR compliant, available for immediate project phase dispatch.'
            },
            {
              id: 'alt-lab-02',
              name: 'Raytheon Defense Partner',
              providerOrCompetitor: 'Raytheon Technical Services',
              type: 'competitor_benchmark',
              rate: 99.00,
              unit: 'hr',
              savingsDiff: -4.00,
              savingsPct: -4.2,
              leadTimeDays: 5,
              reliabilityRating: 4.8,
              isRecommended: false,
              notes: 'Defense contractor standard benchmark.'
            }
          ]),
          connected_allocations: JSON.stringify([
            {
              projectId: 'proj-01',
              projectCode: 'PRJ-ACPT-907446',
              projectName: 'Aerospace Propulsion Sub-Assembly',
              phaseName: 'Engineering & CAD',
              quantity: 60,
              unit: 'hr',
              totalCost: 5700.00,
              currency: 'USD'
            }
          ]),
          notes: 'Primary avionics engineer for flight control computing and telemetry.'
        },
        {
          id: 'res-lab-02',
          code: 'RES-LAB-02',
          name: 'Certified ASME Precision Welder',
          type: 'labour',
          category: 'Fabrication & Welding',
          sub_category: 'TIG & Exotic Alloys',
          more_sub_category: 'Vacuum Chamber Spec',
          unit: 'hr',
          base_rate: 78.00,
          operational_charge: 0,
          charge_type: 'hourly',
          currency: 'USD',
          supplier_name: 'Valley CNC Tech',
          competitor_company: 'Precision Weld Corp',
          competitor_rate: 88.00,
          industry_benchmark_rate: 82.00,
          status: 'Available',
          skill_or_sla: 'ASME Section IX & ISO 9606 Certified',
          alternatives: JSON.stringify([
            {
              id: 'alt-lab-03',
              name: 'Titanium Arc Specialist',
              providerOrCompetitor: 'AeroWelding Solutions',
              type: 'labour_option',
              rate: 74.00,
              unit: 'hr',
              savingsDiff: 4.00,
              savingsPct: 5.1,
              leadTimeDays: 3,
              reliabilityRating: 4.7,
              isRecommended: true,
              notes: 'Qualified on Titanium Grade 5 and Inconel 718.'
            }
          ]),
          connected_allocations: JSON.stringify([
            {
              projectId: 'proj-01',
              projectCode: 'PRJ-ACPT-907446',
              projectName: 'Aerospace Propulsion Sub-Assembly',
              phaseName: 'Phase 2',
              quantity: 45,
              unit: 'hr',
              totalCost: 3510.00,
              currency: 'USD'
            }
          ]),
          notes: 'Exotic metal chamber welding with argon shielding.'
        },
        {
          id: 'res-mac-01',
          code: 'RES-MAC-01',
          name: 'DMG Mori 5-Axis CNC Milling Center',
          type: 'machinery',
          category: 'CNC Heavy Centers',
          sub_category: 'Simultaneous 5-Axis',
          more_sub_category: '20,000 RPM Spindle',
          unit: 'hr',
          base_rate: 145.00,
          operational_charge: 25.00,
          charge_type: 'hourly',
          currency: 'USD',
          supplier_name: 'Valley CNC Tech',
          competitor_company: 'Precision CNC Machining',
          competitor_rate: 165.00,
          industry_benchmark_rate: 152.00,
          status: 'In Use',
          skill_or_sla: 'High Precision +/- 2 Micron Tolerance',
          alternatives: JSON.stringify([
            {
              id: 'alt-mac-01',
              name: 'Haas UMC-750 5-Axis',
              providerOrCompetitor: 'Apex Machinery Rentals',
              type: 'machinery_option',
              rate: 120.00,
              unit: 'hr',
              operationalCharge: 20.00,
              savingsDiff: 25.00,
              savingsPct: 17.2,
              leadTimeDays: 1,
              reliabilityRating: 4.6,
              isRecommended: true,
              notes: 'Lower hourly rate, suitable for non-critical roughing & secondary profiling.'
            },
            {
              id: 'alt-mac-02',
              name: 'Mazak Variaxis i-700',
              providerOrCompetitor: 'Mazak Partner Hub',
              type: 'supplier_alternative',
              rate: 155.00,
              unit: 'hr',
              operationalCharge: 30.00,
              savingsDiff: -10.00,
              savingsPct: -6.9,
              leadTimeDays: 2,
              reliabilityRating: 4.9,
              isRecommended: false,
              notes: 'Heavy duty titanium hogging with extreme torque.'
            }
          ]),
          connected_allocations: JSON.stringify([
            {
              projectId: 'proj-01',
              projectCode: 'PRJ-ACPT-907446',
              projectName: 'Aerospace Propulsion Sub-Assembly',
              phaseName: 'Phase 2',
              quantity: 80,
              unit: 'hr',
              totalCost: 11600.00,
              currency: 'USD'
            }
          ]),
          notes: 'High-spec CNC center dedicated to propulsion turbine casing.'
        },
        {
          id: 'res-mac-02',
          code: 'RES-MAC-02',
          name: 'CAT 320 Hydraulic Excavator',
          type: 'machinery',
          category: 'Earthmoving & Construction',
          sub_category: 'Tracked Hydraulic Excavation',
          more_sub_category: '20-Ton Class',
          unit: 'hr',
          base_rate: 120.00,
          operational_charge: 35.00,
          charge_type: 'hourly',
          currency: 'USD',
          supplier_name: 'HeavyEquip Rentals',
          competitor_company: 'TerraWorks Plant Hire',
          competitor_rate: 135.00,
          industry_benchmark_rate: 128.00,
          status: 'Available',
          skill_or_sla: 'Grade Control & Telematics Included',
          alternatives: JSON.stringify([
            {
              id: 'alt-mac-03',
              name: 'Komatsu PC200-11',
              providerOrCompetitor: 'Komatsu Direct Rental',
              type: 'machinery_option',
              rate: 112.00,
              unit: 'hr',
              operationalCharge: 32.00,
              savingsDiff: 8.00,
              savingsPct: 6.7,
              leadTimeDays: 1,
              reliabilityRating: 4.8,
              isRecommended: true,
              notes: 'Tier 4 final eco-engine with high fuel economy.'
            }
          ]),
          connected_allocations: JSON.stringify([]),
          notes: 'Heavy foundation trenching and earthworks machine.'
        },
        {
          id: 'res-eqp-01',
          code: 'RES-EQP-01',
          name: 'Zeiss Optical CMM 3D Metrology Rig',
          type: 'equipment',
          category: 'Precision Metrology',
          sub_category: 'Coordinate Measuring Machines',
          more_sub_category: 'Sub-Micron Laser Probe',
          unit: 'hr',
          base_rate: 110.00,
          operational_charge: 10.00,
          charge_type: 'hourly',
          currency: 'USD',
          supplier_name: 'MetroCal Tech',
          competitor_company: 'Hexagon Metrology Labs',
          competitor_rate: 125.00,
          industry_benchmark_rate: 118.00,
          status: 'Available',
          skill_or_sla: 'ISO 17025 Calibrated & Audited',
          alternatives: JSON.stringify([
            {
              id: 'alt-eqp-01',
              name: 'Mitutoyo Crysta-Apex V',
              providerOrCompetitor: 'Mitutoyo Partner Lab',
              type: 'supplier_alternative',
              rate: 98.00,
              unit: 'hr',
              savingsDiff: 12.00,
              savingsPct: 10.9,
              leadTimeDays: 2,
              reliabilityRating: 4.8,
              isRecommended: true,
              notes: 'Temperature compensated scanning probe.'
            }
          ]),
          connected_allocations: JSON.stringify([
            {
              projectId: 'proj-01',
              projectCode: 'PRJ-ACPT-907446',
              projectName: 'Aerospace Propulsion Sub-Assembly',
              phaseName: 'Phase 3',
              quantity: 25,
              unit: 'hr',
              totalCost: 2750.00,
              currency: 'USD'
            }
          ]),
          notes: 'Precision inspection of aerospace dimensional compliance.'
        },
        {
          id: 'res-eqp-02',
          code: 'RES-EQP-02',
          name: 'Lincoln Electric Robotic MIG/TIG Welder',
          type: 'equipment',
          category: 'Welding Systems',
          sub_category: 'Automated 6-Axis Cell',
          more_sub_category: 'Pulsed Arc Tech',
          unit: 'hr',
          base_rate: 55.00,
          operational_charge: 8.00,
          charge_type: 'hourly',
          currency: 'USD',
          supplier_name: 'WeldTech Solutions',
          competitor_company: 'Miller Automated Cells',
          competitor_rate: 62.00,
          industry_benchmark_rate: 58.00,
          status: 'Available',
          skill_or_sla: 'Automated Continuous Seam 99.8% Yield',
          alternatives: JSON.stringify([
            {
              id: 'alt-eqp-02',
              name: 'Miller Auto-Axcess 450',
              providerOrCompetitor: 'RoboWeld Hire',
              type: 'machinery_option',
              rate: 50.00,
              unit: 'hr',
              savingsDiff: 5.00,
              savingsPct: 9.1,
              leadTimeDays: 3,
              reliabilityRating: 4.7,
              isRecommended: true,
              notes: 'Lower hourly equipment lease cost.'
            }
          ]),
          connected_allocations: JSON.stringify([]),
          notes: 'Automated longitudinal pipe and structural frame welding.'
        },
        {
          id: 'res-tol-01',
          code: 'RES-TOL-01',
          name: 'Sandvik Coromant Solid Carbide Endmill Set',
          type: 'tool',
          category: 'Cutting Tools',
          sub_category: 'High-Feed Endmills',
          more_sub_category: 'TiAlN Coated',
          unit: 'unit',
          base_rate: 35.00,
          operational_charge: 0,
          charge_type: 'unit',
          currency: 'USD',
          supplier_name: 'Continental Tooling',
          competitor_company: 'Kennametal Direct',
          competitor_rate: 42.00,
          industry_benchmark_rate: 39.00,
          status: 'Available',
          skill_or_sla: 'Titanium & Heat-Resistant Superalloy Milling',
          alternatives: JSON.stringify([
            {
              id: 'alt-tol-01',
              name: 'Kennametal Harvi I TE',
              providerOrCompetitor: 'Kennametal Direct',
              type: 'supplier_alternative',
              rate: 31.00,
              unit: 'unit',
              savingsDiff: 4.00,
              savingsPct: 11.4,
              leadTimeDays: 1,
              reliabilityRating: 4.9,
              isRecommended: true,
              notes: 'Asymmetrical flutes dampen vibration at high depth of cut.'
            },
            {
              id: 'alt-tol-02',
              name: 'Iscar HeliQuad Inserts',
              providerOrCompetitor: 'Iscar Tooling Hub',
              type: 'competitor_benchmark',
              rate: 37.00,
              unit: 'unit',
              savingsDiff: -2.00,
              savingsPct: -5.7,
              leadTimeDays: 2,
              reliabilityRating: 4.8,
              isRecommended: false,
              notes: 'Indexable 4-edge carbide inserts.'
            }
          ]),
          connected_allocations: JSON.stringify([
            {
              projectId: 'proj-01',
              projectCode: 'PRJ-ACPT-907446',
              projectName: 'Aerospace Propulsion Sub-Assembly',
              phaseName: 'Phase 2',
              quantity: 20,
              unit: 'unit',
              totalCost: 700.00,
              currency: 'USD'
            }
          ]),
          notes: 'High-performance endmill tooling for aerospace alloys.'
        },
        {
          id: 'res-tol-02',
          code: 'RES-TOL-02',
          name: 'Hilti TE-70 Heavy Rotary Hammer Drill',
          type: 'tool',
          category: 'Power Tools',
          sub_category: 'Demolition & Anchoring',
          more_sub_category: 'SDS Max Chuck',
          unit: 'hr',
          base_rate: 18.00,
          operational_charge: 2.00,
          charge_type: 'hourly',
          currency: 'USD',
          supplier_name: 'ToolHire Pro',
          competitor_company: 'DeWalt Industrial Tool Rental',
          competitor_rate: 22.00,
          industry_benchmark_rate: 20.00,
          status: 'Available',
          skill_or_sla: 'Heavy Duty Structural Concrete Drilling',
          alternatives: JSON.stringify([
            {
              id: 'alt-tol-03',
              name: 'Bosch Professional GBH 8-45',
              providerOrCompetitor: 'Bosch Pro Tool Rental',
              type: 'supplier_alternative',
              rate: 15.00,
              unit: 'hr',
              savingsDiff: 3.00,
              savingsPct: 16.7,
              leadTimeDays: 1,
              reliabilityRating: 4.7,
              isRecommended: true,
              notes: '1500W motor with vibration control.'
            }
          ]),
          connected_allocations: JSON.stringify([]),
          notes: 'Industrial rotary hammer for heavy anchor bolting.'
        },
        {
          id: 'res-mat-01',
          code: 'RES-MAT-01',
          name: 'Titanium Ti-6Al-4V Certified Bar Stock',
          type: 'material',
          category: 'Metals & Structural Alloys',
          sub_category: 'Aerospace Grade Titanium',
          more_sub_category: 'AMS 4928 Spec',
          unit: 'kg',
          base_rate: 105.00,
          operational_charge: 0,
          charge_type: 'unit',
          currency: 'USD',
          supplier_name: 'Continental Metals Direct',
          competitor_company: 'ThyssenKrupp Aerospace',
          competitor_rate: 118.00,
          industry_benchmark_rate: 112.00,
          status: 'Available',
          skill_or_sla: 'Raw Material Supplier Stock',
          alternatives: JSON.stringify([
            {
              id: 'alt-mat-01',
              name: 'Precision Titanium Billets',
              providerOrCompetitor: 'Allegheny Technologies (ATI)',
              type: 'supplier_alternative',
              rate: 98.00,
              unit: 'kg',
              savingsDiff: 7.00,
              savingsPct: 6.7,
              leadTimeDays: 4,
              reliabilityRating: 4.9,
              isRecommended: true,
              notes: 'Direct mill stock with full trace certification.'
            }
          ]),
          connected_allocations: JSON.stringify([
            {
              projectId: 'proj-01',
              projectCode: 'PRJ-ACPT-907446',
              projectName: 'Aerospace Propulsion Sub-Assembly',
              phaseName: 'Phase 1',
              quantity: 50,
              unit: 'kg',
              totalCost: 4830.00,
              currency: 'USD'
            }
          ]),
          notes: 'Flight-certified titanium bar stock for turbine shafts.'
        },
        {
          id: 'res-sub-01',
          code: 'RES-SUB-01',
          name: 'Standard CNC Milling Service',
          type: 'subcontractor',
          category: 'Precision Machining Services',
          sub_category: 'Production Milling',
          more_sub_category: 'Turnkey Contract',
          unit: 'hr',
          base_rate: 85.00,
          operational_charge: 0,
          charge_type: 'hourly',
          currency: 'USD',
          supplier_name: 'Valley CNC Tech',
          competitor_company: 'Apex Precision Engineering',
          competitor_rate: 95.00,
          industry_benchmark_rate: 90.00,
          status: 'Available',
          skill_or_sla: 'Certified Specialist Labor',
          alternatives: JSON.stringify([
            {
              id: 'alt-sub-01',
              name: 'Rapid CNC Batch Machining',
              providerOrCompetitor: 'Prototurn Engineering',
              type: 'supplier_alternative',
              rate: 80.00,
              unit: 'hr',
              savingsDiff: 5.00,
              savingsPct: 5.9,
              leadTimeDays: 2,
              reliabilityRating: 4.8,
              isRecommended: true,
              notes: 'High throughput batch runs with quick changeover.'
            }
          ]),
          connected_allocations: JSON.stringify([
            {
              projectId: 'proj-01',
              projectCode: 'PRJ-ACPT-907446',
              projectName: 'Aerospace Propulsion Sub-Assembly',
              phaseName: 'Phase 2',
              quantity: 80,
              unit: 'hr',
              totalCost: 6800.00,
              currency: 'USD'
            }
          ]),
          notes: 'Outsourced specialist milling subcontractor.'
        }
      ];

      for (const res of initialResources) {
        await db.query(
          `INSERT INTO enterprise_resources (
            id, code, name, type, category, sub_category, more_sub_category,
            unit, base_rate, operational_charge, charge_type, currency,
            supplier_name, competitor_company, competitor_rate, industry_benchmark_rate,
            status, skill_or_sla, alternatives, connected_allocations, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
          ON CONFLICT (id) DO NOTHING`,
          [
            res.id, res.code, res.name, res.type, res.category, res.sub_category, res.more_sub_category,
            res.unit, res.base_rate, res.operational_charge, res.charge_type, res.currency,
            res.supplier_name, res.competitor_company, res.competitor_rate, res.industry_benchmark_rate,
            res.status, res.skill_or_sla, res.alternatives, res.connected_allocations, res.notes
          ]
        );
      }
      console.log('[PostgreSQL] Seeded initial enterprise resources (labour, machineries, equipments, tools).');
    } catch (e: any) {
      console.warn('[PostgreSQL] Error seeding enterprise resources:', e?.message);
    }
  }

  public async getResourcesPaginated(opts?: ListQueryOptions): Promise<PaginatedResult<any>> {
    const db = await this.getDb();
    await this.ensureEnterpriseResourcesSchema();
    const rowsRes = await db.query('SELECT * FROM enterprise_resources ORDER BY type ASC, name ASC');
    const records = (rowsRes.rows || []).map((r: any) => ({
      ...r,
      baseRate: Number(r.base_rate || 0),
      operationalCharge: Number(r.operational_charge || 0),
      chargeType: r.charge_type || 'hourly',
      subCategory: r.sub_category,
      moreSubCategory: r.more_sub_category,
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      competitorCompany: r.competitor_company,
      competitorRate: Number(r.competitor_rate || 0),
      industryBenchmarkRate: Number(r.industry_benchmark_rate || 0),
      leadTimeDays: Number(r.lead_time_days || 1),
      skillOrSla: r.skill_or_sla,
      effectiveDate: formatSqlDate(r.effective_date),
      alternatives: typeof r.alternatives === 'string' ? JSON.parse(r.alternatives || '[]') : (r.alternatives || []),
      specifications: typeof r.specifications === 'string' ? JSON.parse(r.specifications || '{}') : (r.specifications || {}),
      priceRanges: (typeof r.specifications === 'string' ? JSON.parse(r.specifications || '{}') : (r.specifications || {}))?.priceRanges || [],
      connectedAllocations: typeof r.connected_allocations === 'string' ? JSON.parse(r.connected_allocations || '[]') : (r.connected_allocations || [])
    }));

    return parseFilterPagination(records, opts, ['name', 'code', 'category', 'subCategory', 'type', 'supplierName', 'competitorCompany']);
  }

  public async getResources(opts?: ListQueryOptions): Promise<any[]> {
    const res = await this.getResourcesPaginated(opts);
    return res.data;
  }

  public async getResourceById(id: string): Promise<any | null> {
    const db = await this.getDb();
    await this.ensureEnterpriseResourcesSchema();
    const res = await db.query('SELECT * FROM enterprise_resources WHERE id = $1', [id]);
    if (!res.rows || res.rows.length === 0) return null;
    const r = res.rows[0];
    const parsedSpecs = typeof r.specifications === 'string' ? JSON.parse(r.specifications || '{}') : (r.specifications || {});
    return {
      ...r,
      baseRate: Number(r.base_rate || 0),
      operationalCharge: Number(r.operational_charge || 0),
      chargeType: r.charge_type || 'hourly',
      subCategory: r.sub_category,
      moreSubCategory: r.more_sub_category,
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      competitorCompany: r.competitor_company,
      competitorRate: Number(r.competitor_rate || 0),
      industryBenchmarkRate: Number(r.industry_benchmark_rate || 0),
      leadTimeDays: Number(r.lead_time_days || 1),
      skillOrSla: r.skill_or_sla,
      effectiveDate: formatSqlDate(r.effective_date),
      alternatives: typeof r.alternatives === 'string' ? JSON.parse(r.alternatives || '[]') : (r.alternatives || []),
      specifications: parsedSpecs,
      priceRanges: parsedSpecs?.priceRanges || [],
      connectedAllocations: typeof r.connected_allocations === 'string' ? JSON.parse(r.connected_allocations || '[]') : (r.connected_allocations || [])
    };
  }

  public async createResource(data: any): Promise<any> {
    const db = await this.getDb();
    await this.ensureEnterpriseResourcesSchema();
    const id = data.id || `res-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const prefix = data.type ? String(data.type).slice(0, 3).toUpperCase() : 'RES';
    const code = data.code || `RES-${prefix}-${Math.floor(100 + Math.random() * 900)}`;
    const baseRate = Number(data.baseRate ?? data.rate ?? 0);
    const operationalCharge = Number(data.operationalCharge ?? 0);
    const competitorRate = Number(data.competitorRate ?? 0);
    const benchmarkRate = Number(data.industryBenchmarkRate ?? 0);

    const altsJson = JSON.stringify(data.alternatives || []);
    const specs = data.specifications || {};
    if (data.priceRanges) {
      specs.priceRanges = data.priceRanges;
    }
    const specsJson = JSON.stringify(specs);
    const allocsJson = JSON.stringify(data.connectedAllocations || []);

    await db.query(
      `INSERT INTO enterprise_resources (
        id, code, name, type, category, sub_category, more_sub_category,
        unit, base_rate, operational_charge, charge_type, currency,
        supplier_id, supplier_name, competitor_company, competitor_rate,
        industry_benchmark_rate, lead_time_days, status, skill_or_sla,
        alternatives, specifications, connected_allocations, notes, effective_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)`,
      [
        id, code, data.name || 'Untitled Resource', data.type || 'labour',
        data.category || 'General', data.subCategory || null, data.moreSubCategory || null,
        data.unit || 'hr', baseRate, operationalCharge, data.chargeType || 'hourly',
        data.currency || 'LKR', data.supplierId || null, data.supplierName || null,
        data.competitorCompany || null, competitorRate, benchmarkRate,
        data.leadTimeDays || 1, data.status || 'Available', data.skillOrSla || null,
        altsJson, specsJson, allocsJson, data.notes || '', data.effectiveDate || new Date().toISOString().slice(0, 10)
      ]
    );

    return this.getResourceById(id);
  }

  public async updateResource(id: string, data: any): Promise<any> {
    const db = await this.getDb();
    const existing = await this.getResourceById(id);
    if (!existing) throw new Error('Resource not found');

    const name = data.name !== undefined ? data.name : existing.name;
    const type = data.type !== undefined ? data.type : existing.type;
    const category = data.category !== undefined ? data.category : existing.category;
    const subCategory = data.subCategory !== undefined ? data.subCategory : existing.subCategory;
    const unit = data.unit !== undefined ? data.unit : existing.unit;
    const baseRate = data.baseRate !== undefined ? Number(data.baseRate) : existing.baseRate;
    const operationalCharge = data.operationalCharge !== undefined ? Number(data.operationalCharge) : existing.operationalCharge;
    const chargeType = data.chargeType !== undefined ? data.chargeType : existing.chargeType;
    const supplierName = data.supplierName !== undefined ? data.supplierName : existing.supplierName;
    const competitorCompany = data.competitorCompany !== undefined ? data.competitorCompany : existing.competitorCompany;
    const competitorRate = data.competitorRate !== undefined ? Number(data.competitorRate) : existing.competitorRate;
    const industryBenchmarkRate = data.industryBenchmarkRate !== undefined ? Number(data.industryBenchmarkRate) : existing.industryBenchmarkRate;
    const status = data.status !== undefined ? data.status : existing.status;
    const skillOrSla = data.skillOrSla !== undefined ? data.skillOrSla : existing.skillOrSla;
    const notes = data.notes !== undefined ? data.notes : existing.notes;
    const altsJson = data.alternatives !== undefined ? JSON.stringify(data.alternatives) : JSON.stringify(existing.alternatives);
    const allocsJson = data.connectedAllocations !== undefined ? JSON.stringify(data.connectedAllocations) : JSON.stringify(existing.connectedAllocations);
    const specs = data.specifications !== undefined ? data.specifications : (existing.specifications || {});
    if (data.priceRanges !== undefined) {
      specs.priceRanges = data.priceRanges;
    }
    const specsJson = JSON.stringify(specs);

    // If price changed, record in price_history_records
    if (data.baseRate !== undefined && Number(data.baseRate) !== existing.baseRate) {
      const prev = existing.baseRate;
      const next = Number(data.baseRate);
      const diff = calcPctChange(prev, next);
      await db.query(
        `INSERT INTO price_history_records (
          id, entity_type, entity_id, entity_code, entity_name,
          previous_price, new_price, change_pct, currency, effective_date, reason, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          `ph-${Date.now()}`, 'material', id, existing.code, existing.name,
          prev, next, diff, data.currency || existing.currency || 'LKR', data.effectiveDate || new Date().toISOString().slice(0, 10),
          data.reason || 'Resource rate revision via portal', data.updatedBy || 'Resource Manager'
        ]
      ).catch((err: any) => console.warn('Could not record resource price history:', err));
    }

    await db.query(
      `UPDATE enterprise_resources SET
        name = $1, type = $2, category = $3, sub_category = $4,
        unit = $5, base_rate = $6, operational_charge = $7, charge_type = $8,
        supplier_name = $9, competitor_company = $10, competitor_rate = $11,
        industry_benchmark_rate = $12, status = $13, skill_or_sla = $14,
        notes = $15, alternatives = $16, connected_allocations = $17, specifications = $18, updated_at = NOW()
       WHERE id = $19`,
      [
        name, type, category, subCategory, unit, baseRate, operationalCharge,
        chargeType, supplierName, competitorCompany, competitorRate,
        industryBenchmarkRate, status, skillOrSla, notes, altsJson, allocsJson, specsJson, id
      ]
    );

    return this.getResourceById(id);
  }

  public async getResourcePriceHistory(resourceId: string): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query(
      `SELECT *, effective_date::text as effective_date_iso FROM price_history_records
       WHERE entity_id = $1
       ORDER BY effective_date DESC, recorded_at DESC`,
      [resourceId]
    );
    return res.rows.map((r: any) => ({
      id: r.id,
      entityType: r.entity_type,
      entityId: r.entity_id,
      entityCode: r.entity_code,
      entityName: r.entity_name,
      previousPrice: round4(r.previous_price || 0),
      newPrice: round4(r.new_price || 0),
      changePct: round2(r.change_pct || 0),
      currency: r.currency || 'LKR',
      effectiveDate: formatSqlDate(r.effective_date_iso || r.effective_date, ''),
      recordedAt: r.recorded_at ? new Date(r.recorded_at).toISOString() : new Date().toISOString(),
      reason: r.reason || '',
      updatedBy: r.updated_by || 'Resource Manager'
    }));
  }

  public async updatePriceHistoryRecord(historyId: string, data: any): Promise<any> {
    const db = await this.getDb();
    const existing = await db.query('SELECT * FROM price_history_records WHERE id = $1', [historyId]);
    if (!existing.rows || existing.rows.length === 0) throw new Error('Price history record not found');
    const r = existing.rows[0];
    const newPrice = data.newPrice !== undefined ? Number(data.newPrice) : Number(r.new_price);
    const prevPrice = Number(r.previous_price || 0);
    const changePct = prevPrice > 0 ? calcPctChange(prevPrice, newPrice) : Number(r.change_pct || 0);
    const reason = data.reason !== undefined ? data.reason : r.reason;
    const effectiveDate = data.effectiveDate !== undefined ? data.effectiveDate : r.effective_date;
    const updatedBy = data.updatedBy !== undefined ? data.updatedBy : r.updated_by;

    await db.query(
      `UPDATE price_history_records SET new_price = $1, change_pct = $2, reason = $3, effective_date = $4, updated_by = $5 WHERE id = $6`,
      [newPrice, changePct, reason, effectiveDate, updatedBy, historyId]
    );

    return {
      id: historyId,
      entityId: r.entity_id,
      previousPrice: prevPrice,
      newPrice,
      changePct,
      reason,
      effectiveDate,
      updatedBy
    };
  }

  public async deleteResource(id: string): Promise<boolean> {
    const db = await this.getDb();
    await this.ensureEnterpriseResourcesSchema();
    await db.query('DELETE FROM enterprise_resources WHERE id = $1', [id]);
    return true;
  }

  public async addResourceAlternative(resourceId: string, altData: any): Promise<any> {
    const resource = await this.getResourceById(resourceId);
    if (!resource) throw new Error('Resource not found');

    const newAlt = {
      id: altData.id || `alt-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      name: altData.name || 'Alternative Option',
      providerOrCompetitor: altData.providerOrCompetitor || 'Industry Supplier',
      type: altData.type || 'supplier_alternative',
      rate: Number(altData.rate || 0),
      unit: altData.unit || resource.unit,
      operationalCharge: Number(altData.operationalCharge || 0),
      savingsDiff: resource.baseRate - Number(altData.rate || 0),
      savingsPct: resource.baseRate > 0 ? Math.round(((resource.baseRate - Number(altData.rate || 0)) / resource.baseRate) * 1000) / 10 : 0,
      leadTimeDays: Number(altData.leadTimeDays || 1),
      reliabilityRating: Number(altData.reliabilityRating || 4.5),
      isRecommended: Boolean(altData.isRecommended),
      notes: altData.notes || ''
    };

    const updatedAlternatives = [...(resource.alternatives || []), newAlt];
    return this.updateResource(resourceId, { alternatives: updatedAlternatives });
  }

  public async applyResourceAlternative(resourceId: string, alternativeId: string, reason?: string, actor?: string): Promise<any> {
    const resource = await this.getResourceById(resourceId);
    if (!resource) throw new Error('Resource not found');

    const alt = (resource.alternatives || []).find((a: any) => a.id === alternativeId);
    if (!alt) throw new Error('Alternative not found');

    const previousRate = resource.baseRate;
    const newRate = alt.rate;
    const updatedAlternatives = (resource.alternatives || []).map((a: any) => ({
      ...a,
      isRecommended: a.id === alternativeId
    }));

    return this.updateResource(resourceId, {
      baseRate: newRate,
      supplierName: alt.providerOrCompetitor,
      operationalCharge: alt.operationalCharge !== undefined ? alt.operationalCharge : resource.operationalCharge,
      alternatives: updatedAlternatives,
      reason: reason || `Applied industry alternative: ${alt.name} (${alt.providerOrCompetitor})`,
      updatedBy: actor || 'Resource Manager'
    });
  }

  public async allocateResourceToProject(
    resourceId: string,
    projectId: string,
    phaseId: string,
    quantity: number,
    unit?: string,
    unitCost?: number,
    planId?: string
  ): Promise<any> {
    const db = await this.getDb();
    await this.ensureEnterpriseResourcesSchema();
    const resource = await this.getResourceById(resourceId);
    if (!resource) throw new Error('Resource not found');

    const projRes = await db.query('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (!projRes.rows || projRes.rows.length === 0) throw new Error('Project not found');
    const project = projRes.rows[0];

    const selectedItems = typeof project.selected_items === 'string' ? JSON.parse(project.selected_items || '[]') : (project.selected_items || []);
    const phases = typeof project.phases === 'string' ? JSON.parse(project.phases || '[]') : (project.phases || []);
    const targetPhase = phases.find((p: any) => p.id === phaseId) || phases[0];

    const effectiveCost = unitCost !== undefined ? Number(unitCost) : Number(resource.baseRate || 0);
    const totalCost = Number(quantity) * effectiveCost;

    const newItem = {
      id: `cost-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      phaseId: targetPhase?.id || 'phase-01',
      type: resource.type,
      itemId: resource.id,
      name: resource.name,
      category: resource.category,
      subCategory: resource.subCategory,
      supplierOrProvider: resource.supplierName || 'Assigned Provider',
      quantity: Number(quantity),
      unit: unit || resource.unit,
      unitCost: effectiveCost,
      totalCost,
      notes: `Allocated from Resource Portal: ${resource.code}`
    };

    selectedItems.push(newItem);

    // Recalculate direct cost
    await db.query(
      'UPDATE projects SET selected_items = $1, updated_at_ts = NOW() WHERE id = $2',
      [JSON.stringify(selectedItems), projectId]
    );

    // Update resource's connectedAllocations
    const existingAllocations = resource.connectedAllocations || [];
    const allocIdx = existingAllocations.findIndex((a: any) => a.projectId === projectId && a.phaseId === targetPhase?.id);
    if (allocIdx >= 0) {
      existingAllocations[allocIdx].quantity += Number(quantity);
      existingAllocations[allocIdx].totalCost += totalCost;
    } else {
      existingAllocations.push({
        projectId: project.id,
        projectCode: project.code,
        projectName: project.name,
        phaseId: targetPhase?.id,
        phaseName: targetPhase?.name || 'General',
        quantity: Number(quantity),
        unit: unit || resource.unit,
        totalCost,
        currency: project.currency || 'LKR'
      });
    }

    await db.query(
      'UPDATE enterprise_resources SET connected_allocations = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(existingAllocations), resourceId]
    );

    // Connect to target project plan if provided or active plan in project_plans
    let targetPlanId = planId;
    if (!targetPlanId) {
      const planRes = await db.query(
        'SELECT id FROM project_plans WHERE project_id = $1 AND (is_active = TRUE OR is_active IS NULL) ORDER BY created_at DESC LIMIT 1',
        [projectId]
      );
      if (planRes.rows && planRes.rows.length > 0) {
        targetPlanId = planRes.rows[0].id;
      }
    }

    if (targetPlanId) {
      const planResId = `ppr-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      await db.query(
        `INSERT INTO project_plan_resources (
          id, plan_id, project_id, resource_id, resource_type,
          name, role_or_trade, allocated_hours, hourly_rate, total_cost, notes, unit, currency
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          planResId, targetPlanId, projectId, resource.id, resource.type,
          resource.name, resource.subCategory || resource.category || '',
          Number(quantity), effectiveCost, totalCost,
          `Allocated from Resource Portal: ${resource.code}`,
          unit || resource.unit || 'hr',
          project.currency || 'LKR'
        ]
      ).catch((err: any) => console.warn('Could not insert project_plan_resources:', err));

      // Recalculate plan financials
      await this.recalculatePlanFinancials(targetPlanId).catch((err: any) => console.warn('Recalculate plan error:', err));
    }

    return {
      resource: await this.getResourceById(resourceId),
      allocatedItem: newItem
    };
  }

  public async getPlanCostSummary(planId: string): Promise<any | null> {
    const db = await this.getDb();
    let res = await db.query('SELECT * FROM project_plan_cost_summaries WHERE plan_id = $1', [planId]);
    if (!res.rows || res.rows.length === 0) {
      const summary = await this.recalculatePlanFinancials(planId);
      if (summary) return summary;
      res = await db.query('SELECT * FROM project_plan_cost_summaries WHERE plan_id = $1', [planId]);
      if (!res.rows || res.rows.length === 0) return null;
    }
    const r = res.rows[0];
    return {
      planId: r.plan_id,
      projectId: r.project_id,
      plannedRevenue: round2(r.planned_revenue || 0),
      materialCost: round2(r.material_cost || 0),
      subcontractorCost: round2(r.subcontractor_cost || 0),
      outsourcedCost: round2(r.outsourced_cost || 0),
      resourceCost: round2(r.resource_cost || 0),
      directCost: round2(r.direct_cost || 0),
      overheadAmount: round2(r.overhead_amount || 0),
      contingencyAmount: round2(r.contingency_amount || 0),
      laborBurdenAmount: round2(r.labor_burden_amount || 0),
      extraOverheadAmount: round2(r.extra_overhead_amount || 0),
      allocatedOverhead: round2(r.allocated_overhead || 0),
      totalPlannedCost: round2(r.total_planned_cost || 0),
      grossProfit: round2(r.gross_profit || 0),
      grossMarginPct: round2(r.gross_margin_pct || 0),
      plannedProfit: round2(r.planned_profit || 0),
      profitMarginPct: round2(r.profit_margin_pct || 0),
      boqItemCount: Number(r.boq_item_count || 0),
      sectionCount: Number(r.section_count || 0),
      resourceCount: Number(r.resource_count || 0),
      calculatedAt: r.calculated_at
    };
  }

  public async getPlanResources(planId: string): Promise<any[]> {
    const db = await this.getDb();
    const res = await db.query('SELECT * FROM project_plan_resources WHERE plan_id = $1 ORDER BY created_at ASC', [planId]);
    return res.rows.map((r: any) => ({
      id: r.id,
      planId: r.plan_id,
      projectId: r.project_id,
      sectionId: r.section_id,
      resourceId: r.resource_id,
      resourceType: r.resource_type,
      name: r.name,
      roleOrTrade: r.role_or_trade,
      allocatedHours: Number(r.allocated_hours || 0),
      hourlyRate: Number(r.hourly_rate || 0),
      totalCost: Number(r.total_cost || 0),
      unit: r.unit || 'hr',
      currency: r.currency || 'LKR',
      startDate: formatSqlDate(r.start_date),
      endDate: formatSqlDate(r.end_date),
      notes: r.notes || '',
      createdAt: r.created_at
    }));
  }

  public async addResourceToPlan(planId: string, data: any, actor?: string): Promise<any> {
    const db = await this.getDb();
    const planRes = await db.query('SELECT * FROM project_plans WHERE id = $1', [planId]);
    if (planRes.rows.length === 0) throw new Error(`Plan '${planId}' not found`);
    const plan = planRes.rows[0];

    const id = data.id || `ppr-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const quantity = Math.max(0, Number(data.allocatedHours ?? data.quantity ?? 1));
    const rate = Math.max(0, Number(data.hourlyRate ?? data.unitCost ?? 0));
    const totalCost = round2(quantity * rate);

    await db.query(
      `INSERT INTO project_plan_resources (
        id, plan_id, project_id, section_id, resource_id, resource_type,
        name, role_or_trade, allocated_hours, hourly_rate, total_cost,
        unit, currency, start_date, end_date, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::date, $15::date, $16)`,
      [
        id,
        planId,
        plan.project_id,
        data.sectionId || null,
        data.resourceId || `res-${Date.now()}`,
        data.resourceType || 'labour',
        data.name || 'Plan Resource',
        data.roleOrTrade || data.subCategory || '',
        quantity,
        rate,
        totalCost,
        data.unit || 'hr',
        data.currency || plan.currency || 'LKR',
        data.startDate ? String(data.startDate).slice(0, 10) : null,
        data.endDate ? String(data.endDate).slice(0, 10) : null,
        data.notes || ''
      ]
    );

    const costSummary = await this.recalculatePlanFinancials(planId);
    return {
      id,
      planId,
      projectId: plan.project_id,
      sectionId: data.sectionId || null,
      resourceId: data.resourceId,
      resourceType: data.resourceType || 'labour',
      name: data.name,
      roleOrTrade: data.roleOrTrade || '',
      allocatedHours: quantity,
      hourlyRate: rate,
      totalCost,
      unit: data.unit || 'hr',
      currency: data.currency || plan.currency || 'LKR',
      costSummary
    };
  }

  public async updatePlanResource(planId: string, resourceId: string, data: any, actor?: string): Promise<any> {
    const db = await this.getDb();
    const existingRes = await db.query('SELECT * FROM project_plan_resources WHERE plan_id = $1 AND id = $2', [planId, resourceId]);
    if (existingRes.rows.length === 0) throw new Error('Plan resource not found');
    const existing = existingRes.rows[0];

    const quantity = data.allocatedHours !== undefined ? Math.max(0, Number(data.allocatedHours)) : Number(existing.allocated_hours || 0);
    const rate = data.hourlyRate !== undefined ? Math.max(0, Number(data.hourlyRate)) : Number(existing.hourly_rate || 0);
    const totalCost = round2(quantity * rate);

    await db.query(
      `UPDATE project_plan_resources SET
        section_id = $1,
        name = $2,
        role_or_trade = $3,
        allocated_hours = $4,
        hourly_rate = $5,
        total_cost = $6,
        unit = $7,
        currency = $8,
        start_date = $9::date,
        end_date = $10::date,
        notes = $11
       WHERE plan_id = $12 AND id = $13`,
      [
        data.sectionId !== undefined ? data.sectionId : existing.section_id,
        data.name || existing.name,
        data.roleOrTrade !== undefined ? data.roleOrTrade : existing.role_or_trade,
        quantity,
        rate,
        totalCost,
        data.unit || existing.unit || 'hr',
        data.currency || existing.currency || 'LKR',
        data.startDate ? String(data.startDate).slice(0, 10) : existing.start_date,
        data.endDate ? String(data.endDate).slice(0, 10) : existing.end_date,
        data.notes !== undefined ? data.notes : existing.notes,
        planId,
        resourceId
      ]
    );

    const costSummary = await this.recalculatePlanFinancials(planId);
    return {
      id: resourceId,
      planId,
      totalCost,
      allocatedHours: quantity,
      hourlyRate: rate,
      costSummary
    };
  }

  public async deletePlanResource(planId: string, resourceId: string, actor?: string): Promise<boolean> {
    const db = await this.getDb();
    await db.query('DELETE FROM project_plan_resources WHERE plan_id = $1 AND id = $2', [planId, resourceId]);
    await this.recalculatePlanFinancials(planId);
    return true;
  }

  // --- Project Plan Cost Controls Engine ---
  public async ensureProjectPlanCostControlsSchema(): Promise<void> {
    const db = this.db!;
    try {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS project_plan_cost_controls (
          id TEXT PRIMARY KEY,
          plan_id TEXT NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE UNIQUE,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          budget_ceiling NUMERIC(18, 2) DEFAULT 0,
          target_cost NUMERIC(18, 2) DEFAULT 0,
          material_cost_cap NUMERIC(18, 2) DEFAULT 0,
          labor_cost_cap NUMERIC(18, 2) DEFAULT 0,
          equipment_cost_cap NUMERIC(18, 2) DEFAULT 0,
          subcontractor_cost_cap NUMERIC(18, 2) DEFAULT 0,
          overhead_cost_cap NUMERIC(18, 2) DEFAULT 0,
          contingency_cap NUMERIC(18, 2) DEFAULT 0,
          cost_status TEXT DEFAULT 'Active',
          cost_stage TEXT DEFAULT 'Budget',
          freeze_cost_lines BOOLEAN DEFAULT false,
          escalation_lock BOOLEAN DEFAULT false,
          target_margin_pct NUMERIC(8, 2) DEFAULT 25.0,
          overhead_pct NUMERIC(8, 2) DEFAULT 8.5,
          contingency_pct NUMERIC(8, 2) DEFAULT 5.0,
          labor_burden_pct NUMERIC(8, 2) DEFAULT 0.0,
          committed_savings NUMERIC(18, 2) DEFAULT 0,
          cost_notes TEXT DEFAULT '',
          item_controls JSONB DEFAULT '[]'::jsonb,
          audit_trail JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_plan_cost_controls_plan ON project_plan_cost_controls(plan_id);
        CREATE INDEX IF NOT EXISTS idx_plan_cost_controls_project ON project_plan_cost_controls(project_id);
      `);
    } catch (e: any) {
      console.warn('[PostgreSQL] ensureProjectPlanCostControlsSchema warning:', e?.message);
    }
  }

  public async getPlanCostControls(planId: string): Promise<any> {
    const db = await this.getDb();
    const planRes = await db.query('SELECT * FROM project_plans WHERE id = $1', [planId]);
    if (planRes.rows.length === 0) {
      throw new Error(`Project plan '${planId}' not found`);
    }
    const plan = planRes.rows[0];

    // Check existing cost controls
    let ctrlRes = await db.query('SELECT * FROM project_plan_cost_controls WHERE plan_id = $1', [planId]);
    let row: any = ctrlRes.rows[0];

    // Compute live planned elements
    const [boqRes, resRes, ovhRes, tarRes, sumRes] = await Promise.all([
      db.query('SELECT * FROM project_plan_boq_items WHERE plan_id = $1 ORDER BY line_order ASC', [planId]),
      db.query('SELECT * FROM project_plan_resources WHERE plan_id = $1 ORDER BY created_at ASC', [planId]),
      db.query('SELECT * FROM project_plan_overhead_allocations WHERE plan_id = $1', [planId]),
      db.query('SELECT * FROM plan_tariffs WHERE plan_id = $1', [planId]),
      db.query('SELECT * FROM project_plan_cost_summaries WHERE plan_id = $1', [planId])
    ]);

    const boqItems = boqRes.rows;
    const resources = resRes.rows;
    const overheads = ovhRes.rows;
    const tariffs = tarRes.rows;
    const summary = sumRes.rows[0];

    let matCostPlanned = 0;
    let laborCostPlanned = 0;
    let eqCostPlanned = 0;
    let machCostPlanned = 0;
    let toolCostPlanned = 0;
    let subCostPlanned = 0;
    let outCostPlanned = 0;

    for (const b of boqItems) {
      const tc = Number(b.total_cost || 0);
      const t = String(b.item_type || '').toLowerCase();
      if (t === 'material' || t === 'produce') matCostPlanned += tc;
      else if (t === 'subcontractor') subCostPlanned += tc;
      else if (t === 'outsourced' || t === 'service') outCostPlanned += tc;
      else matCostPlanned += tc;
    }

    for (const r of resources) {
      const tc = Number(r.total_cost || 0);
      const t = String(r.resource_type || '').toLowerCase();
      if (t === 'labour' || t === 'labor') laborCostPlanned += tc;
      else if (t === 'machinery') machCostPlanned += tc;
      else if (t === 'equipment') eqCostPlanned += tc;
      else if (t === 'tool') toolCostPlanned += tc;
      else if (t === 'subcontractor') subCostPlanned += tc;
      else laborCostPlanned += tc;
    }

    let ovhCostPlanned = 0;
    for (const o of overheads) {
      ovhCostPlanned += Number(o.allocated_amount || 0);
    }

    let tariffCostPlanned = 0;
    for (const tf of tariffs) {
      tariffCostPlanned += Number(tf.calculated_tariff_amount || 0);
    }

    const equipmentGroupCostPlanned = round2(eqCostPlanned + machCostPlanned + toolCostPlanned);
    const directCostPlanned = round2(matCostPlanned + laborCostPlanned + equipmentGroupCostPlanned + subCostPlanned + outCostPlanned);
    const totalPlannedCost = summary
      ? Number(summary.total_planned_cost || 0)
      : round2(directCostPlanned + ovhCostPlanned + tariffCostPlanned);
    const plannedRevenue = summary
      ? Number(summary.planned_revenue || 0)
      : Number(plan.planned_revenue || 0);

    // If no row exists, initialize realistic defaults based on the plan
    if (!row) {
      const id = `pcc-${planId}`;
      const ceiling = totalPlannedCost > 0 ? round2(totalPlannedCost * 1.10) : 100000;
      const target = totalPlannedCost > 0 ? round2(totalPlannedCost * 0.95) : 85000;
      const matCap = matCostPlanned > 0 ? round2(matCostPlanned * 1.05) : round2(ceiling * 0.4);
      const labCap = laborCostPlanned > 0 ? round2(laborCostPlanned * 1.05) : round2(ceiling * 0.25);
      const eqCap = equipmentGroupCostPlanned > 0 ? round2(equipmentGroupCostPlanned * 1.05) : round2(ceiling * 0.15);
      const subCap = subCostPlanned > 0 ? round2(subCostPlanned * 1.05) : round2(ceiling * 0.1);
      const ovhCap = ovhCostPlanned > 0 ? round2(ovhCostPlanned * 1.05) : round2(ceiling * 0.1);

      await db.query(
        `INSERT INTO project_plan_cost_controls (
          id, plan_id, project_id, budget_ceiling, target_cost,
          material_cost_cap, labor_cost_cap, equipment_cost_cap, subcontractor_cost_cap, overhead_cost_cap,
          contingency_cap, cost_status, cost_stage, freeze_cost_lines, escalation_lock,
          target_margin_pct, overhead_pct, contingency_pct, labor_burden_pct, committed_savings,
          cost_notes, item_controls, audit_trail, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, 'Active', 'Budget', false, false,
          $12, $13, $14, $15, 0,
          $16, '[]'::jsonb, $17::jsonb, NOW(), NOW()
        ) ON CONFLICT (plan_id) DO NOTHING`,
        [
          id, planId, plan.project_id, ceiling, target,
          matCap, labCap, eqCap, subCap, ovhCap,
          round2(ceiling * 0.05),
          Number(plan.target_margin_pct || 25),
          Number(plan.overhead_pct || 8.5),
          Number(plan.contingency_pct || 5.0),
          Number(plan.labor_burden_pct || 0),
          'Baseline budget ceilings and cost stage initialized in PostgreSQL',
          JSON.stringify([{
            date: new Date().toISOString(),
            action: 'INITIALIZED',
            actor: 'System Cost Engine',
            details: `Initialized budget ceiling at ${ceiling} and target cost at ${target}`
          }])
        ]
      );

      const reRes = await db.query('SELECT * FROM project_plan_cost_controls WHERE plan_id = $1', [planId]);
      row = reRes.rows[0];
    }

    const budgetCeiling = Number(row.budget_ceiling || 0);
    const targetCost = Number(row.target_cost || 0);
    const materialCostCap = Number(row.material_cost_cap || 0);
    const laborCostCap = Number(row.labor_cost_cap || 0);
    const equipmentCostCap = Number(row.equipment_cost_cap || 0);
    const subcontractorCostCap = Number(row.subcontractor_cost_cap || 0);
    const overheadCostCap = Number(row.overhead_cost_cap || 0);
    const contingencyCap = Number(row.contingency_cap || 0);

    const ceilingVariance = round2(budgetCeiling - totalPlannedCost);
    const ceilingVariancePct = budgetCeiling > 0 ? round2(((budgetCeiling - totalPlannedCost) / budgetCeiling) * 100) : 0;
    const targetVariance = round2(targetCost - totalPlannedCost);

    const materialVariance = round2(materialCostCap - matCostPlanned);
    const laborVariance = round2(laborCostCap - laborCostPlanned);
    const equipmentVariance = round2(equipmentCostCap - equipmentGroupCostPlanned);
    const subcontractorVariance = round2(subcontractorCostCap - subCostPlanned);
    const overheadVariance = round2(overheadCostCap - ovhCostPlanned);

    // Build unified cost lines
    const costLines: any[] = [
      ...boqItems.map((b: any) => ({
        id: b.id,
        lineType: 'boq',
        category: b.category || b.item_type || 'Material',
        itemType: b.item_type || 'material',
        code: b.item_code || '',
        name: b.name,
        supplierOrProvider: b.supplier_or_provider || '',
        quantity: Number(b.quantity || 1),
        unit: b.unit || 'pcs',
        unitCost: Number(b.unit_cost || 0),
        totalCost: Number(b.total_cost || 0),
        costStage: b.cost_stage || row.cost_stage || 'Budget',
        isFrozen: Boolean(row.freeze_cost_lines),
        notes: b.notes || ''
      })),
      ...resources.map((r: any) => ({
        id: r.id,
        lineType: 'resource',
        category: r.resource_type ? r.resource_type.toUpperCase() : 'RESOURCE',
        itemType: r.resource_type || 'labour',
        code: r.resource_id || '',
        name: r.name,
        roleOrTrade: r.role_or_trade || '',
        supplierOrProvider: r.supplier_name || '',
        quantity: Number(r.allocated_hours || 1),
        unit: r.unit || 'hr',
        unitCost: Number(r.hourly_rate || 0),
        totalCost: Number(r.total_cost || 0),
        costStage: row.cost_stage || 'Budget',
        isFrozen: Boolean(row.freeze_cost_lines),
        notes: r.notes || ''
      })),
      ...overheads.map((o: any) => ({
        id: o.id,
        lineType: 'overhead',
        category: 'OVERHEAD',
        itemType: 'overhead',
        code: o.category || '',
        name: o.category || 'Plan Overhead Allocation',
        quantity: 1,
        unit: 'allocation',
        unitCost: Number(o.allocated_amount || 0),
        totalCost: Number(o.allocated_amount || 0),
        costStage: row.cost_stage || 'Budget',
        isFrozen: Boolean(row.freeze_cost_lines),
        notes: o.notes || ''
      }))
    ];

    const auditTrail = typeof row.audit_trail === 'string'
      ? JSON.parse(row.audit_trail || '[]')
      : (row.audit_trail || []);

    return {
      id: row.id,
      planId: row.plan_id,
      projectId: row.project_id,
      planNumber: plan.plan_number,
      planName: plan.name,
      currency: plan.currency || 'LKR',
      plannedRevenue,
      totalPlannedCost,
      directCostPlanned,
      overheadCostPlanned: round2(ovhCostPlanned + tariffCostPlanned),
      budgetCeiling,
      targetCost,
      ceilingVariance,
      ceilingVariancePct,
      targetVariance,
      isOverBudget: ceilingVariance < 0,
      breakdown: {
        materials: { planned: round2(matCostPlanned), cap: materialCostCap, variance: materialVariance },
        labor: { planned: round2(laborCostPlanned), cap: laborCostCap, variance: laborVariance },
        equipment: { planned: round2(equipmentGroupCostPlanned), cap: equipmentCostCap, variance: equipmentVariance },
        subcontractors: { planned: round2(subCostPlanned), cap: subcontractorCostCap, variance: subcontractorVariance },
        overheads: { planned: round2(ovhCostPlanned + tariffCostPlanned), cap: overheadCostCap, variance: overheadVariance }
      },
      contingencyCap,
      costStatus: row.cost_status || 'Active',
      costStage: row.cost_stage || 'Budget',
      freezeCostLines: Boolean(row.freeze_cost_lines),
      escalationLock: Boolean(row.escalation_lock),
      targetMarginPct: Number(row.target_margin_pct || 25),
      overheadPct: Number(row.overhead_pct || 8.5),
      contingencyPct: Number(row.contingency_pct || 5.0),
      laborBurdenPct: Number(row.labor_burden_pct || 0),
      committedSavings: Number(row.committed_savings || 0),
      costNotes: row.cost_notes || '',
      costLines,
      auditTrail,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public async updatePlanCostControls(planId: string, updates: any, actor?: any): Promise<any> {
    const db = await this.getDb();
    const existing = await this.getPlanCostControls(planId);
    if (!existing) throw new Error(`Plan '${planId}' cost controls not found`);

    const actorName = actor?.name || actor || 'Cost Controller';

    const budgetCeiling = updates.budgetCeiling !== undefined ? Math.max(0, Number(updates.budgetCeiling)) : existing.budgetCeiling;
    const targetCost = updates.targetCost !== undefined ? Math.max(0, Number(updates.targetCost)) : existing.targetCost;
    const materialCostCap = updates.materialCostCap !== undefined ? Math.max(0, Number(updates.materialCostCap)) : existing.breakdown.materials.cap;
    const laborCostCap = updates.laborCostCap !== undefined ? Math.max(0, Number(updates.laborCostCap)) : existing.breakdown.labor.cap;
    const equipmentCostCap = updates.equipmentCostCap !== undefined ? Math.max(0, Number(updates.equipmentCostCap)) : existing.breakdown.equipment.cap;
    const subcontractorCostCap = updates.subcontractorCostCap !== undefined ? Math.max(0, Number(updates.subcontractorCostCap)) : existing.breakdown.subcontractors.cap;
    const overheadCostCap = updates.overheadCostCap !== undefined ? Math.max(0, Number(updates.overheadCostCap)) : existing.breakdown.overheads.cap;
    const contingencyCap = updates.contingencyCap !== undefined ? Math.max(0, Number(updates.contingencyCap)) : existing.contingencyCap;

    const costStatus = updates.costStatus !== undefined ? String(updates.costStatus) : existing.costStatus;
    const costStage = updates.costStage !== undefined ? String(updates.costStage) : existing.costStage;
    const freezeCostLines = updates.freezeCostLines !== undefined ? Boolean(updates.freezeCostLines) : existing.freezeCostLines;
    const escalationLock = updates.escalationLock !== undefined ? Boolean(updates.escalationLock) : existing.escalationLock;
    const targetMarginPct = updates.targetMarginPct !== undefined ? Number(updates.targetMarginPct) : existing.targetMarginPct;
    const overheadPct = updates.overheadPct !== undefined ? Number(updates.overheadPct) : existing.overheadPct;
    const contingencyPct = updates.contingencyPct !== undefined ? Number(updates.contingencyPct) : existing.contingencyPct;
    const laborBurdenPct = updates.laborBurdenPct !== undefined ? Number(updates.laborBurdenPct) : existing.laborBurdenPct;
    const committedSavings = updates.committedSavings !== undefined ? Math.max(0, Number(updates.committedSavings)) : existing.committedSavings;
    const costNotes = updates.costNotes !== undefined ? String(updates.costNotes) : existing.costNotes;

    const auditEntry = {
      date: new Date().toISOString(),
      action: 'UPDATED',
      actor: actorName,
      details: updates.reason || `Updated cost control caps (Ceiling: ${budgetCeiling}, Stage: ${costStage}, Frozen: ${freezeCostLines})`
    };

    const newAuditTrail = [auditEntry, ...(existing.auditTrail || [])].slice(0, 50);

    await db.query(
      `UPDATE project_plan_cost_controls SET
        budget_ceiling = $1,
        target_cost = $2,
        material_cost_cap = $3,
        labor_cost_cap = $4,
        equipment_cost_cap = $5,
        subcontractor_cost_cap = $6,
        overhead_cost_cap = $7,
        contingency_cap = $8,
        cost_status = $9,
        cost_stage = $10,
        freeze_cost_lines = $11,
        escalation_lock = $12,
        target_margin_pct = $13,
        overhead_pct = $14,
        contingency_pct = $15,
        labor_burden_pct = $16,
        committed_savings = $17,
        cost_notes = $18,
        audit_trail = $19::jsonb,
        updated_at = NOW()
      WHERE plan_id = $20`,
      [
        budgetCeiling, targetCost,
        materialCostCap, laborCostCap, equipmentCostCap, subcontractorCostCap, overheadCostCap,
        contingencyCap, costStatus, costStage, freezeCostLines, escalationLock,
        targetMarginPct, overheadPct, contingencyPct, laborBurdenPct, committedSavings,
        costNotes, JSON.stringify(newAuditTrail), planId
      ]
    );

    // If margin/overhead/contingency changed, sync back to project_plans
    if (
      targetMarginPct !== existing.targetMarginPct ||
      overheadPct !== existing.overheadPct ||
      contingencyPct !== existing.contingencyPct ||
      laborBurdenPct !== existing.laborBurdenPct
    ) {
      await db.query(
        `UPDATE project_plans SET
          target_margin_pct = $1,
          overhead_pct = $2,
          contingency_pct = $3,
          labor_burden_pct = $4,
          updated_at_ts = NOW()
        WHERE id = $5`,
        [targetMarginPct, overheadPct, contingencyPct, laborBurdenPct, planId]
      );
      await this.recalculatePlanFinancials(planId);
    }

    return await this.getPlanCostControls(planId);
  }

  public async applyPlanCostControlAction(planId: string, action: string, payload: any, actor?: any): Promise<any> {
    if (action === 'freeze_all') {
      return await this.updatePlanCostControls(planId, {
        freezeCostLines: true,
        costStatus: 'Cost Frozen',
        reason: 'Administrator engaged comprehensive cost freeze across all plan cost lines'
      }, actor);
    }

    if (action === 'unfreeze_all') {
      return await this.updatePlanCostControls(planId, {
        freezeCostLines: false,
        costStatus: 'Active',
        reason: 'Administrator unlocked cost lines for budgeting and estimation revisions'
      }, actor);
    }

    if (action === 'lock_escalation') {
      return await this.updatePlanCostControls(planId, {
        escalationLock: true,
        reason: 'Rate escalation barrier enabled against vendor price creep'
      }, actor);
    }

    if (action === 'unlock_escalation') {
      return await this.updatePlanCostControls(planId, {
        escalationLock: false,
        reason: 'Rate escalation restriction removed'
      }, actor);
    }

    if (action === 'apply_savings_target') {
      const discountPct = Number(payload?.discountPct || 5);
      const existing = await this.getPlanCostControls(planId);
      const targetSavings = round2(existing.totalPlannedCost * (discountPct / 100));
      const newTargetCost = round2(existing.totalPlannedCost - targetSavings);

      return await this.updatePlanCostControls(planId, {
        committedSavings: round2((existing.committedSavings || 0) + targetSavings),
        targetCost: newTargetCost,
        reason: `Committed value engineering cost reduction target of ${discountPct}% (Savings: ${targetSavings} ${existing.currency})`
      }, actor);
    }

    if (action === 'set_cost_stage') {
      const newStage = String(payload?.stage || 'Budget');
      return await this.updatePlanCostControls(planId, {
        costStage: newStage,
        reason: `Advanced plan cost stage to ${newStage}`
      }, actor);
    }

    return await this.getPlanCostControls(planId);
  }

  public async getDbStats(): Promise<any> {
    const db = await this.getDb();
    const tables = [
      'clients', 'projects', 'project_plans', 'project_plan_revisions',
      'project_plan_sections', 'project_plan_boq_items', 'project_plan_resources',
      'project_plan_overhead_allocations', 'project_plan_cost_summaries', 'project_plan_cost_controls',
      'project_plan_overhead_allocations', 'project_plan_cost_summaries',
      'overhead_categories', 'overhead_items', 'plan_overhead_allocations', 'overhead_audit_logs',
      'revenue_categories', 'revenue_subcategories', 'revenue_items', 'revenue_rate_history',
      'competitors', 'product_competitor_quotes', 'product_competitor_price_history', 'project_deliverables',
      'suppliers', 'materials', 'material_vendor_quotes', 'material_vendor_price_history', 'vendor_deletion_archives', 'outsourced_services',
      'subcontractors', 'produce_items', 'inventory', 'inventory_transactions',
      'price_history_records', 'procurement_price_history', 'categories', 'custom_tiles', 'company_details',
      'users', 'account_requests', 'media_assets', 'audit_logs', 'tariffs', 'tariff_versions', 'plan_tariffs',
      'enterprise_resources', 'schema_migrations'
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

