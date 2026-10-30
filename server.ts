import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { spawnSync } from 'child_process';
import { createServer as createViteServer } from 'vite';

import { postgresService, ListQueryOptions } from './src/server/postgresDb';
import { round1, round2, decAdd, decSub, decMul, decDiv, calcDiscountedLine } from './src/utils/decimalMath';

const DB_FILE = path.join(process.cwd(), 'data', 'database.json');
const LEGACY_SECURITY_FILE = path.join(process.cwd(), 'data', 'security.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
  fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
}

// Security password hashing & verification utilities
function hashPassword(password: string, salt?: string) {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, actualSalt, 1000, 64, 'sha256').toString('hex');
  return { hash, salt: actualSalt };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha256').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
  } catch {
    return false;
  }
}

function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const part1 = Math.floor(1000 + Math.random() * 9000);
    const part2 = Math.floor(1000 + Math.random() * 9000);
    codes.push(`BK-${part1}-${part2}`);
  }
  return codes;
}

function sanitizeUser(u: any) {
  if (!u) return null;
  const { passwordHash, passwordSalt, twoFactorSecret, pendingTwoFactorSecret, ...safe } = u;
  return safe;
}

function extractListOptions(query: any): ListQueryOptions & { paginated?: boolean } {
  return {
    page: query?.page ? Number(query.page) : undefined,
    limit: query?.limit ? Number(query.limit) : undefined,
    search: query?.search ? String(query.search) : undefined,
    sortBy: query?.sortBy ? String(query.sortBy) : undefined,
    sortOrder: query?.sortOrder === 'asc' || query?.sortOrder === 'desc' ? query.sortOrder : undefined,
    category: query?.category ? String(query.category) : undefined,
    subCategory: query?.subCategory ? String(query.subCategory) : undefined,
    status: query?.status ? String(query.status) : undefined,
    projectId: query?.projectId ? String(query.projectId) : undefined,
    planType: query?.planType ? String(query.planType) : undefined,
    entityType: query?.entityType ? String(query.entityType) : undefined,
    entityId: query?.entityId ? String(query.entityId) : undefined,
    supplierId: query?.supplierId ? String(query.supplierId) : undefined,
    materialId: query?.materialId ? String(query.materialId) : undefined,
    itemId: query?.itemId ? String(query.itemId) : undefined,
    itemType: query?.itemType ? String(query.itemType) : undefined,
    priceType: query?.priceType ? String(query.priceType) : undefined,
    costStage: query?.costStage ? String(query.costStage) : undefined,
    currency: query?.currency ? String(query.currency) : undefined,
    projectPlanId: query?.projectPlanId ? String(query.projectPlanId) : query?.planId ? String(query.planId) : undefined,
    planId: query?.planId ? String(query.planId) : undefined,
    actorId: query?.actorId ? String(query.actorId) : undefined,
    action: query?.action ? String(query.action) : undefined,
    actionType: query?.actionType ? String(query.actionType) : undefined,
    tariffId: query?.tariffId ? String(query.tariffId) : undefined,
    calculationMethod: query?.calculationMethod ? String(query.calculationMethod) : undefined,
    applicableBase: query?.applicableBase ? String(query.applicableBase) : undefined,
    fromDate: query?.fromDate ? String(query.fromDate) : undefined,
    toDate: query?.toDate ? String(query.toDate) : undefined,
    paginated: query?.paginated === 'true' || query?.paginated === '1' || (query?.page !== undefined && query?.limit !== undefined)
  };
}

function sendListResponse(res: express.Response, result: { data: any[]; total: number; page: number; limit: number; totalPages: number }, paginated?: boolean) {
  res.setHeader('X-Total-Count', String(result.total));
  res.setHeader('X-Page', String(result.page));
  res.setHeader('X-Limit', String(result.limit));
  res.setHeader('X-Total-Pages', String(result.totalPages));
  if (paginated) {
    return res.json(result);
  }
  return res.json(result.data);
}

// Security data lives in PostgreSQL (users table + security_settings table).
// A memory copy is kept for fast reads. Every save is written to PostgreSQL.
let SEC: any = null;
let secWrite: Promise<void> = Promise.resolve();

function defaultSecurity(users: any[]) {
  return {
    adminSecretCode: process.env.ADMIN_SECRET_CODE || crypto.randomBytes(6).toString('hex').toUpperCase(),
    backupCodes: generateBackupCodes(8),
    sessionTimeoutMinutes: 30,
    users,
    sessions: {},
    tempMfaTokens: {},
    pendingSignups: {}
  };
}

async function initSecurityStore() {
  let settings = await postgresService.getSecuritySettings();
  let users = await postgresService.getAuthUsers();

  // One time import of the old security.json file, then delete it
  if (fs.existsSync(LEGACY_SECURITY_FILE)) {
    try {
      const legacy = JSON.parse(fs.readFileSync(LEGACY_SECURITY_FILE, 'utf-8'));
      if (!settings) {
        const { users: legacyUsers, ...rest } = legacy;
        settings = rest;
      }
      for (const lu of legacy.users || []) {
        const i = users.findIndex((u: any) => u.id === lu.id || u.email === lu.email);
        if (i === -1) users.push(lu);
        else users[i] = { ...users[i], passwordHash: lu.passwordHash, passwordSalt: lu.passwordSalt, twoFactorSecret: lu.twoFactorSecret, twoFactorEnabled: lu.twoFactorEnabled };
      }
      fs.unlinkSync(LEGACY_SECURITY_FILE);
      console.log('[Security] Imported security.json into PostgreSQL and removed the file.');
    } catch (e) {
      console.error('[Security] Could not import security.json:', e);
    }
  }

  const base = settings || defaultSecurity([]);
  SEC = { ...defaultSecurity([]), ...base, users };
  if (!SEC.sessions) SEC.sessions = {};
  if (!SEC.tempMfaTokens) SEC.tempMfaTokens = {};
  if (!SEC.pendingSignups) SEC.pendingSignups = {};
  if (!SEC.backupCodes?.length) SEC.backupCodes = generateBackupCodes(8);

  SEC.adminSecretCode = process.env.ADMIN_SECRET_CODE || process.env.ADMIN_CODE || '000000';

  const defaultAdminPass = process.env.ADMIN_PASSWORD || 'AdminPass123!';
  const existingAdmin = SEC.users.find((u: any) => u.role === 'ADMIN');
  if (!existingAdmin) {
    const { hash, salt } = hashPassword(defaultAdminPass);
    SEC.users.unshift({
      id: 'user-admin-01',
      employeeId: 'ADMIN-01',
      name: 'Administrator',
      email: process.env.ADMIN_EMAIL || 'admin@example.com',
      role: 'ADMIN',
      department: 'Management',
      passwordHash: hash,
      passwordSalt: salt,
      status: 'Active',
      createdAt: new Date().toISOString(),
      twoFactorSecret: generateSecret(),
      twoFactorEnabled: false
    });
  } else {
    const { hash, salt } = hashPassword(defaultAdminPass);
    existingAdmin.passwordHash = hash;
    existingAdmin.passwordSalt = salt;
    if (process.env.ADMIN_EMAIL) {
      existingAdmin.email = process.env.ADMIN_EMAIL;
    }
    existingAdmin.status = 'Active';
  }
  saveSecurityStore(SEC);
  await secWrite;
}

function loadSecurityStore() {
  return SEC;
}

function saveSecurityStore(data: any) {
  SEC = data;
  const { users, ...settings } = data;
  const snapshotUsers = JSON.parse(JSON.stringify(users || []));
  const snapshotSettings = JSON.parse(JSON.stringify(settings));
  secWrite = secWrite
    .then(async () => {
      await postgresService.saveSecuritySettings(snapshotSettings);
      for (const u of snapshotUsers) await postgresService.upsertAuthUser(u);
    })
    .catch((e) => console.error('[Security] save failed:', e));
}

// Invoke Python Analytics Engine
function runPythonAnalytics(projectData: any) {
  try {
    const pythonScript = path.join(process.cwd(), 'analytics_engine.py');
    const result = spawnSync('python3', [pythonScript, JSON.stringify(projectData)], {
      encoding: 'utf-8',
      timeout: 5000
    });

    if (result.error) {
      console.error('Python execution error:', result.error);
      return fallbackAnalytics(projectData);
    }

    if (result.stdout) {
      return JSON.parse(result.stdout);
    }
  } catch (err) {
    console.error('Failed to run python analytics script, using fallback:', err);
  }
  return fallbackAnalytics(projectData);
}

// Fallback pure TypeScript decimal-safe analytical calculation if Python process is unavailable
function fallbackAnalytics(projectData: any) {
  const revenue = round2(projectData.quotedPrice || 0);
  const items = projectData.selectedItems || [];
  let materialCost = 0;
  let subcontractorCost = 0;
  let outsourcedCost = 0;
  let labourCost = 0;
  let machineryCost = 0;
  let equipmentCost = 0;
  let toolCost = 0;

  for (const item of items) {
    const { totalAmount: discounted } = calcDiscountedLine(
      item.quantity ?? 1,
      item.unitCost ?? 0,
      item.discountPct ?? 0
    );
    if (item.type === 'material') materialCost = decAdd(materialCost, discounted);
    else if (item.type === 'subcontractor') subcontractorCost = decAdd(subcontractorCost, discounted);
    else if (item.type === 'labour') labourCost = decAdd(labourCost, discounted);
    else if (item.type === 'machinery') machineryCost = decAdd(machineryCost, discounted);
    else if (item.type === 'equipment') equipmentCost = decAdd(equipmentCost, discounted);
    else if (item.type === 'tool') toolCost = decAdd(toolCost, discounted);
    else if (item.type === 'outsourced') outsourcedCost = decAdd(outsourcedCost, discounted);
    else materialCost = decAdd(materialCost, discounted);
  }

  const resourceCost = decAdd(decAdd(labourCost, machineryCost), decAdd(equipmentCost, toolCost));
  const totalDirectCost = decAdd(decAdd(decAdd(materialCost, subcontractorCost), outsourcedCost), resourceCost);
  const overheadPct = round2(projectData.overheadPct ?? 8.5);
  const contingencyPct = round2(projectData.contingencyPct ?? 5.0);
  const overheadAmount = round2(decMul(totalDirectCost, decDiv(overheadPct, 100)));
  const contingencyAmount = round2(decMul(totalDirectCost, decDiv(contingencyPct, 100)));
  const totalProjectCost = decAdd(decAdd(totalDirectCost, overheadAmount), contingencyAmount);
  const grossProfit = decSub(revenue, totalDirectCost);
  const grossMarginPct = revenue > 0 ? round2(decMul(decDiv(grossProfit, revenue), 100)) : 0;
  const netProfit = decSub(revenue, totalProjectCost);
  const netMarginPct = revenue > 0 ? round2(decMul(decDiv(netProfit, revenue), 100)) : 0;

  const phases = projectData.phases || [];
  let totalPlannedBudget = 0;
  const phaseMetrics = phases.map((p: any) => {
    const planned = round2(p.budget || 0);
    const actual = round2(p.actualCost || 0);
    totalPlannedBudget = decAdd(totalPlannedBudget, planned);
    const variance = decSub(planned, actual);
    return {
      phaseId: p.id,
      phaseName: p.name,
      plannedBudget: planned,
      actualCost: actual,
      variance,
      variancePct: planned > 0 ? round2(decMul(decDiv(variance, planned), 100)) : 0,
      status: variance >= 0 ? 'Under Budget' : 'Over Budget'
    };
  });

  const budgetVariance = decSub(totalPlannedBudget, totalProjectCost);
  const budgetVariancePct = totalPlannedBudget > 0 ? round2(decMul(decDiv(budgetVariance, totalPlannedBudget), 100)) : 0;

  let healthScore = 100;
  if (netMarginPct < 15) healthScore = decSub(healthScore, 25);
  if (budgetVariance < 0) healthScore = decSub(healthScore, Math.min(30, decMul(Math.abs(budgetVariancePct), 2)));
  healthScore = Math.max(10, Math.min(100, round1(healthScore)));

  const matInflationImpact = round2(decMul(materialCost, 0.05));
  const labHikeImpact = round2(decMul(subcontractorCost, 0.08));

  return {
    revenue,
    materialCost: round2(materialCost),
    subcontractorCost: round2(subcontractorCost),
    outsourcedCost: round2(outsourcedCost),
    labourCost: round2(labourCost),
    machineryCost: round2(machineryCost),
    equipmentCost: round2(equipmentCost),
    toolCost: round2(toolCost),
    resourceCost: round2(resourceCost),
    totalDirectCost: round2(totalDirectCost),
    overheadAmount,
    contingencyAmount,
    totalProjectCost: round2(totalProjectCost),
    grossProfit: round2(grossProfit),
    grossMarginPct,
    netProfit: round2(netProfit),
    netMarginPct,
    totalPlannedBudget: round2(totalPlannedBudget),
    budgetVariance: round2(budgetVariance),
    budgetVariancePct,
    healthScore,
    phaseMetrics,
    sensitivity: {
      materialInflation5Pct: {
        costImpact: matInflationImpact,
        revisedNetMarginPct: revenue > 0 ? round2(decMul(decDiv(decSub(netProfit, matInflationImpact), revenue), 100)) : 0
      },
      labourRateHike8Pct: {
        costImpact: labHikeImpact,
        revisedNetMarginPct: revenue > 0 ? round2(decMul(decDiv(decSub(netProfit, labHikeImpact), revenue), 100)) : 0
      }
    },
    costDistribution: [
      { category: 'Materials', amount: Math.round(materialCost), pct: totalDirectCost > 0 ? Math.round(decMul(decDiv(materialCost, totalDirectCost), 100)) : 0 },
      { category: 'Labour & Charges', amount: Math.round(decAdd(subcontractorCost, labourCost)), pct: totalDirectCost > 0 ? Math.round(decMul(decDiv(decAdd(subcontractorCost, labourCost), totalDirectCost), 100)) : 0 },
      { category: 'Machinery & Equipment', amount: Math.round(decAdd(machineryCost, equipmentCost)), pct: totalDirectCost > 0 ? Math.round(decMul(decDiv(decAdd(machineryCost, equipmentCost), totalDirectCost), 100)) : 0 },
      { category: 'Tools & Outsourced', amount: Math.round(decAdd(toolCost, outsourcedCost)), pct: totalDirectCost > 0 ? Math.round(decMul(decDiv(decAdd(toolCost, outsourcedCost), totalDirectCost), 100)) : 0 },
      { category: 'Overhead & Contingency', amount: Math.round(decAdd(overheadAmount, contingencyAmount)), pct: totalProjectCost > 0 ? Math.round(decMul(decDiv(decAdd(overheadAmount, contingencyAmount), totalProjectCost), 100)) : 0 }
    ]
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // ---- Login and role checks for every /api route ----
  const PUBLIC_ROUTES: Array<[string, RegExp]> = [
    ['GET', /^\/api\/health$/],
    ['GET', /^\/api\/company-details$/],
    ['GET', /^\/api\/images\/[^/]+$/],
    ['POST', /^\/api\/auth\/(login|verify-mfa|google-login|signup-init|signup-verify)$/],
    ['GET', /^\/api\/auth\/session$/],          // checks its own token
    ['POST', /^\/api\/auth\/(touch-session|logout)$/], // check their own token
    ['POST', /^\/api\/account-requests$/]       // public access request submission from login page
  ];
  const ADMIN_ONLY: Array<[string | '*', RegExp]> = [
    ['*', /^\/api\/users(\/|$)/],
    ['*', /^\/api\/security(\/|$)/],
    ['GET', /^\/api\/audit-logs$/],
    ['GET', /^\/api\/account-requests$/],
    ['PUT', /^\/api\/account-requests\/[^/]+\/status$/],
    ['*', /^\/api\/database(\/|$)/],
    ['*', /^\/api\/reset-data$/],
    ['PUT', /^\/api\/company-details$/]
  ];

  const dbReadyPromise = (async () => {
    await postgresService.getDb();
    await migrateAndCleanLegacyDatabases();
    await initSecurityStore();
    console.log('[PostgreSQL] Connected to "inno_cost".');
  })();

  app.use('/api', async (req: any, res, next) => {
    const url = '/api' + req.path;
    if ((req.method === 'GET' || req.method === 'HEAD') && url === '/api/health') return next();
    try {
      await dbReadyPromise;
    } catch (e: any) {
      return res.status(503).json({ error: 'Database initializing or unavailable', details: e?.message });
    }
    if (PUBLIC_ROUTES.some(([m, rx]) => m === req.method && rx.test(url))) return next();

    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Please sign in' });
    const sec = loadSecurityStore();
    const token = header.split(' ')[1];
    const session = sec.sessions[token];
    if (!session) return res.status(401).json({ error: 'Please sign in' });

    const idleMin = (Date.now() - session.lastActivity) / 60000;
    if (idleMin > sec.sessionTimeoutMinutes) {
      delete sec.sessions[token];
      saveSecurityStore(sec);
      return res.status(401).json({ error: 'Session expired' });
    }
    const user = sec.users.find((u: any) => u.id === session.userId);
    if (!user || user.status === 'Inactive') return res.status(401).json({ error: 'Account is not active' });

    if (ADMIN_ONLY.some(([m, rx]) => (m === '*' || m === req.method) && rx.test(url)) && user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin only' });
    }
    session.lastActivity = Date.now();
    req.user = sanitizeUser(user);
    next();
  });

  // --- Media & Image Upload API (PostgreSQL inno_cost) ---
  app.post('/api/upload-image', async (req, res) => {
    try {
      const { filename, mimeType, dataUrl, url } = req.body;
      if (url && !dataUrl) {
        if (!/^https?:\/\/[^\s]+$/i.test(String(url)) || String(url).length > 2000) {
          return res.status(400).json({ error: 'Image link must start with http:// or https://' });
        }
        return res.json({ url, id: `ext-${Date.now()}` });
      }
      if (!dataUrl) {
        return res.status(400).json({ error: 'dataUrl or url is required' });
      }
      if (!/^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(String(dataUrl))) {
        return res.status(400).json({ error: 'Only PNG, JPG, WEBP, GIF or SVG images' });
      }
      if (String(dataUrl).length > 3_000_000) {
        return res.status(413).json({ error: 'Image is too large' });
      }
      const asset = await postgresService.saveMediaAsset(filename || 'upload.png', mimeType || 'image/png', dataUrl);
      res.json(asset);
    } catch (e: any) {
      console.error('Image upload error:', e);
      res.status(500).json({ error: 'Failed to upload image', details: e?.message });
    }
  });

  app.get('/api/images/:id', async (req, res) => {
    try {
      const asset = await postgresService.getMediaAsset(req.params.id);
      if (!asset) {
        return res.status(404).json({ error: 'Image not found' });
      }
      if (asset.dataUrl.startsWith('data:')) {
        const matches = asset.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const mime = matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          res.setHeader('Content-Type', mime);
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          return res.send(buffer);
        }
      }
      if (!/^https?:\/\//i.test(asset.dataUrl)) return res.status(404).json({ error: 'Image not found' });
      res.redirect(asset.dataUrl);
    } catch (e: any) {
      res.status(500).json({ error: 'Error fetching image', details: e?.message });
    }
  });

  // Migrate any legacy database.json into PostgreSQL inno_cost database
  async function migrateAndCleanLegacyDatabases() {
    try {
      await postgresService.getDb();
      if (!fs.existsSync(DB_FILE)) return;
      if (fs.existsSync(DB_FILE)) {
        console.log('[Migration] Migrating data from legacy database.json into PostgreSQL "inno_cost"...');
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        const legacy = JSON.parse(content);

        if (Array.isArray(legacy.clients) && legacy.clients.length > 0) {
          for (const c of legacy.clients) {
            await postgresService.createClient(c).catch(() => {});
          }
        }
        if (Array.isArray(legacy.suppliers) && legacy.suppliers.length > 0) {
          for (const s of legacy.suppliers) {
            await postgresService.createSupplier(s).catch(() => {});
          }
        }
        if (Array.isArray(legacy.materials) && legacy.materials.length > 0) {
          for (const m of legacy.materials) {
            await postgresService.createMaterial(m).catch(() => {});
          }
        }
        if (Array.isArray(legacy.outsourced) && legacy.outsourced.length > 0) {
          for (const o of legacy.outsourced) {
            await postgresService.createOutsourced(o).catch(() => {});
          }
        }
        if (Array.isArray(legacy.subcontractors) && legacy.subcontractors.length > 0) {
          for (const sub of legacy.subcontractors) {
            await postgresService.createSubcontractor(sub).catch(() => {});
          }
        }
        if (Array.isArray(legacy.produce) && legacy.produce.length > 0) {
          for (const p of legacy.produce) {
            await postgresService.createProduce(p).catch(() => {});
          }
        }
        if (Array.isArray(legacy.projects) && legacy.projects.length > 0) {
          for (const prj of legacy.projects) {
            await postgresService.createProject(prj).catch(() => {});
          }
        }
        if (Array.isArray(legacy.inventory) && legacy.inventory.length > 0) {
          for (const inv of legacy.inventory) {
            await postgresService.createInventory(inv).catch(() => {});
          }
        }
        if (Array.isArray(legacy.categories) && legacy.categories.length > 0) {
          for (const cat of legacy.categories) {
            await postgresService.createCategory(cat).catch(() => {});
          }
        }
        if (Array.isArray(legacy.customTiles) && legacy.customTiles.length > 0) {
          for (const tile of legacy.customTiles) {
            await postgresService.createCustomTile(tile).catch(() => {});
          }
        }
        if (legacy.companyDetails) {
          await postgresService.updateCompanyDetails(legacy.companyDetails).catch(() => {});
        }
      }
    } catch (e) {
      console.error('[Migration] Migration error:', e);
    }
  }

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString(), pythonEngine: 'active', database: 'inno_cost (PostgreSQL)' });
  });

  // PostgreSQL Database Status & Migrations
  app.get('/api/database/status', async (_req, res) => {
    try {
      const stats = await postgresService.getDbStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: 'Database status error', details: err?.message });
    }
  });

  app.get('/api/database/migrations', async (_req, res) => {
    try {
      const migrations = await postgresService.getMigrations();
      res.json(migrations);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch database migrations', details: err?.message });
    }
  });

  app.post('/api/database/backup', async (req, res) => {
    try {
      const label = req.body?.label ? String(req.body.label).replace(/[^A-Za-z0-9_-]/g, '_') : 'manual';
      const backupFile = await postgresService.createBackup(label);
      res.json({ success: true, backupFile });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to create database backup', details: err?.message });
    }
  });

  // Company Details (PostgreSQL inno_cost - permanent single source of truth)
  app.get('/api/company-details', async (_req, res) => {
    try {
      const details = await postgresService.getCompanyDetails();
      res.json(details);
    } catch (err: any) {
      console.error('Error fetching company details:', err);
      res.status(500).json({ error: 'Failed to fetch company details', details: err?.message });
    }
  });

  app.put('/api/company-details', async (req, res) => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: 'Company details payload is required' });
      }
      const updated = await postgresService.updateCompanyDetails(req.body);
      res.json(updated);
    } catch (err: any) {
      console.error('Error updating company details:', err);
      res.status(500).json({ error: 'Failed to update company details', details: err?.message });
    }
  });

  // =========================================================================
  // CYBER & WEB SECURITY AUTHENTICATION API (SERVER-AUTHORITATIVE)
  // All passwords, secrets, backup codes, and session checks are hidden on server
  // =========================================================================

  // 1. Authenticate user credentials
  app.post('/api/auth/login', (req, res) => {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Identification and password are required.' });
    }

    const sec = loadSecurityStore();
    const query = String(identifier).trim().toLowerCase();
    const user = sec.users.find(
      (u: any) => u.employeeId?.toLowerCase() === query || u.email?.toLowerCase() === query
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid identification or password.' });
    }

    if (user.status === 'Inactive') {
      return res.status(403).json({ error: 'User account is deactivated. Contact Administrator.' });
    }

    const isValid = verifyPassword(String(password).trim(), user.passwordHash, user.passwordSalt);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid identification or password.' });
    }

    // For ADMIN accounts: Prompt for single verification code
    if (user.role === 'ADMIN') {
      const tempMfaToken = crypto.randomBytes(24).toString('hex');
      sec.tempMfaTokens[tempMfaToken] = {
        userId: user.id,
        role: user.role,
        createdAt: Date.now()
      };
      saveSecurityStore(sec);

      return res.json({
        status: 'mfa_required',
        tempMfaToken,
        requireAdminCode: false,
        requireTotp: true,
        twoFactorConfigured: Boolean(user.twoFactorEnabled),
        message: 'Enter your 6-digit Authenticator code or Admin Secret Code.'
      });
    }

    // For non-admin accounts: if 2FA enabled, prompt for TOTP only
    if (user.twoFactorEnabled) {
      const tempMfaToken = crypto.randomBytes(24).toString('hex');
      sec.tempMfaTokens[tempMfaToken] = {
        userId: user.id,
        role: user.role,
        createdAt: Date.now()
      };
      saveSecurityStore(sec);

      return res.json({
        status: 'mfa_required',
        tempMfaToken,
        requireAdminCode: false,
        requireTotp: true,
        twoFactorConfigured: true,
        message: 'Enter Google Authenticator 6-digit code.'
      });
    }

    // Standard session creation for users without 2FA
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    sec.sessions[sessionToken] = {
      userId: user.id,
      role: user.role,
      lastActivity: now,
      expiresAt: now + sec.sessionTimeoutMinutes * 60 * 1000
    };
    user.lastLogin = new Date().toISOString().replace('T', ' ').slice(0, 19);
    saveSecurityStore(sec);

    return res.json({
      status: 'success',
      sessionToken,
      user: sanitizeUser(user),
      sessionTimeoutMinutes: sec.sessionTimeoutMinutes
    });
  });

  // 2. Verify Multi-Factor Authentication
  app.post('/api/auth/verify-mfa', (req, res) => {
    const { tempMfaToken, code, adminCode, totpCode } = req.body;
    if (!tempMfaToken) {
      return res.status(400).json({ error: 'MFA session token missing.' });
    }

    const sec = loadSecurityStore();
    const mfaData = sec.tempMfaTokens[tempMfaToken];

    if (!mfaData || Date.now() - mfaData.createdAt > 10 * 60 * 1000) {
      delete sec.tempMfaTokens[tempMfaToken];
      saveSecurityStore(sec);
      return res.status(400).json({ error: 'MFA session expired. Please sign in again.' });
    }

    const user = sec.users.find((u: any) => u.id === mfaData.userId);
    if (!user) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    const verificationCode = String(code || adminCode || totpCode || '').trim();

    if (!verificationCode) {
      return res.status(400).json({ error: 'Please enter your verification code.' });
    }

    let isValid = false;

    // Check 1: Admin Secret Recovery Code
    if (user.role === 'ADMIN') {
      if (verificationCode === sec.adminSecretCode) {
        isValid = true;
      }
    }

    // Check 2: Single-use Backup Recovery Code
    if (!isValid && Array.isArray(sec.backupCodes)) {
      const backupIdx = sec.backupCodes.findIndex(
        (bCode: string) => bCode.toUpperCase() === verificationCode.toUpperCase()
      );
      if (backupIdx !== -1) {
        isValid = true;
        sec.backupCodes.splice(backupIdx, 1);
      }
    }

    // Check 3: Real Google Authenticator TOTP code
    if (!isValid && user.twoFactorSecret) {
      try {
        const check = verifySync({ secret: user.twoFactorSecret, token: verificationCode });
        if (check && check.valid) {
          isValid = true;
        }
      } catch {
        // Fall through to error
      }
    }

    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid verification code. Enter the 6-digit code from Google Authenticator.'
      });
    }

    delete sec.tempMfaTokens[tempMfaToken];
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    sec.sessions[sessionToken] = {
      userId: user.id,
      role: user.role,
      lastActivity: now,
      expiresAt: now + sec.sessionTimeoutMinutes * 60 * 1000
    };
    user.lastLogin = new Date().toISOString().replace('T', ' ').slice(0, 19);
    saveSecurityStore(sec);

    res.json({
      status: 'success',
      sessionToken,
      user: sanitizeUser(user),
      sessionTimeoutMinutes: sec.sessionTimeoutMinutes
    });
  });

  // 3. Validate existing session
  app.get('/api/auth/session', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ valid: false, error: 'No active session token' });
    }

    const token = authHeader.split(' ')[1];
    const sec = loadSecurityStore();
    const session = sec.sessions[token];

    if (!session) {
      return res.status(401).json({ valid: false, error: 'Session not found' });
    }

    const now = Date.now();
    const elapsedMinutes = (now - session.lastActivity) / (60 * 1000);

    if (elapsedMinutes > sec.sessionTimeoutMinutes) {
      delete sec.sessions[token];
      saveSecurityStore(sec);
      return res.status(401).json({ valid: false, error: 'Session expired due to inactivity' });
    }

    session.lastActivity = now;
    session.expiresAt = now + sec.sessionTimeoutMinutes * 60 * 1000;
    saveSecurityStore(sec);

    const user = sec.users.find((u: any) => u.id === session.userId);
    res.json({
      valid: true,
      user: sanitizeUser(user),
      sessionTimeoutMinutes: sec.sessionTimeoutMinutes
    });
  });

  // 4. Touch session
  app.post('/api/auth/touch-session', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token' });
    }
    const token = authHeader.split(' ')[1];
    const sec = loadSecurityStore();
    const session = sec.sessions[token];
    if (session) {
      session.lastActivity = Date.now();
      saveSecurityStore(sec);
      return res.json({ success: true });
    }
    res.status(401).json({ error: 'Session invalid' });
  });

  // 5. Logout
  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const sec = loadSecurityStore();
      delete sec.sessions[token];
      saveSecurityStore(sec);
    }
    res.json({ success: true });
  });

  // 6. Setup Google Authenticator (Admin only in settings)
  app.post('/api/auth/totp-setup', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const sec = loadSecurityStore();
    const session = sec.sessions[token];
    if (!session) return res.status(401).json({ error: 'Session invalid' });

    const user = sec.users.find((u: any) => u.id === session.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only administrative accounts can configure Google Authenticator.' });
    }

    try {
      const newSecret = generateSecret();
      user.pendingTwoFactorSecret = newSecret;
      saveSecurityStore(sec);

      const otpauth = generateURI({
        issuer: 'COST SYSTEM',
        label: user.email || 'admin@fxtt-enterprise.com',
        secret: newSecret
      });

      const qrCodeDataUrl = await QRCode.toDataURL(otpauth, {
        margin: 1,
        width: 240,
        color: {
          dark: '#003049',
          light: '#ffffff'
        }
      });

      res.json({
        qrCodeDataUrl,
        instructions: 'Scan this QR code with the Google Authenticator app on your mobile device.'
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to generate QR code', details: err?.message });
    }
  });

  // 7. Verify & Confirm Google Authenticator Activation
  app.post('/api/auth/totp-confirm', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const { code } = req.body;
    const sec = loadSecurityStore();
    const session = sec.sessions[token];
    if (!session) return res.status(401).json({ error: 'Session invalid' });

    const user = sec.users.find((u: any) => u.id === session.userId);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admin accounts can configure Google Authenticator.' });
    }

    const secretToVerify = user.pendingTwoFactorSecret || user.twoFactorSecret;
    if (!secretToVerify) {
      return res.status(400).json({ error: 'No pending authenticator setup found.' });
    }

    try {
      const check = verifySync({ secret: secretToVerify, token: String(code).trim() });
      if (!check || !check.valid) {
        return res.status(400).json({ error: 'Invalid 6-digit verification code. Please check Google Authenticator.' });
      }
    } catch {
      return res.status(400).json({ error: 'Failed to verify verification code.' });
    }

    user.twoFactorSecret = secretToVerify;
    user.twoFactorEnabled = true;
    delete user.pendingTwoFactorSecret;
    saveSecurityStore(sec);

    res.json({ success: true, message: 'Google Authenticator successfully configured and activated!' });
  });

  // 8. Admin Security Configuration
  app.get('/api/security/admin-config', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const sec = loadSecurityStore();
    const session = sec.sessions[token];
    if (!session || session.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const adminUser = sec.users.find((u: any) => u.id === session.userId);
    res.json({
      adminSecretCode: sec.adminSecretCode,
      backupCodes: sec.backupCodes,
      sessionTimeoutMinutes: sec.sessionTimeoutMinutes,
      twoFactorEnabled: Boolean(adminUser?.twoFactorEnabled)
    });
  });

  app.post('/api/security/admin-config', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const sec = loadSecurityStore();
    const session = sec.sessions[token];
    if (!session || session.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { adminSecretCode, sessionTimeoutMinutes } = req.body;
    if (adminSecretCode && typeof adminSecretCode === 'string' && adminSecretCode.trim().length >= 4) {
      sec.adminSecretCode = adminSecretCode.trim();
    }

    if (sessionTimeoutMinutes && !isNaN(Number(sessionTimeoutMinutes)) && Number(sessionTimeoutMinutes) > 0) {
      sec.sessionTimeoutMinutes = Math.min(1440, Math.max(1, Number(sessionTimeoutMinutes)));
    }

    saveSecurityStore(sec);
    res.json({
      success: true,
      adminSecretCode: sec.adminSecretCode,
      sessionTimeoutMinutes: sec.sessionTimeoutMinutes,
      backupCodes: sec.backupCodes
    });
  });

  // 9. Generate fresh backup recovery codes
  app.post('/api/security/generate-backup-codes', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const sec = loadSecurityStore();
    const session = sec.sessions[token];
    if (!session || session.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    sec.backupCodes = generateBackupCodes(8);
    saveSecurityStore(sec);
    res.json({
      success: true,
      backupCodes: sec.backupCodes
    });
  });

  // 10. Sanitized Users API (PostgreSQL inno_cost)
  app.get('/api/users', async (_req, res) => {
    try {
      const pgUsers = await postgresService.getUsers();
      if (pgUsers && pgUsers.length > 0) {
        return res.json(pgUsers.map(sanitizeUser));
      }
    } catch (e) {
      console.warn('PostgreSQL users query fallback:', e);
    }
    const sec = loadSecurityStore();
    res.json(sec.users.map(sanitizeUser));
  });

  app.post('/api/users', async (req, res) => {
    const sec = loadSecurityStore();
    const { employeeId, name, email, role, department, password, status } = req.body;
    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: 'Password needs at least 8 characters' });
    }
    if (role && !['ADMIN', 'PROJECT_MANAGER'].includes(role)) {
      return res.status(400).json({ error: 'Unknown role' });
    }
    const { hash, salt } = hashPassword(password);
    const newUser = {
      id: `user-${Date.now()}`,
      employeeId: employeeId || `EMP-${Date.now().toString().slice(-4)}`,
      name: name || 'New Employee',
      email: email || '',
      role: role || 'PROJECT_MANAGER',
      department: department || 'Engineering',
      passwordHash: hash,
      passwordSalt: salt,
      status: status || 'Active',
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      twoFactorEnabled: false
    };
    sec.users.unshift(newUser);
    saveSecurityStore(sec);

    try {
      await postgresService.createUser({
        id: newUser.id,
        employeeId: newUser.employeeId,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department,
        status: newUser.status
      });
    } catch (e) {
      console.warn('Error syncing user to PostgreSQL:', e);
    }

    res.status(201).json(sanitizeUser(newUser));
  });

  app.put('/api/users/:id', async (req, res) => {
    const sec = loadSecurityStore();
    const idx = sec.users.findIndex((u: any) => u.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });

    const existing = sec.users[idx];
    const updates: any = { ...req.body };

    if (updates.password && updates.password.trim()) {
      const { hash, salt } = hashPassword(updates.password.trim());
      existing.passwordHash = hash;
      existing.passwordSalt = salt;
      delete updates.password;
    }

    delete updates.passwordHash;
    delete updates.passwordSalt;
    delete updates.twoFactorSecret;

    sec.users[idx] = { ...existing, ...updates };
    saveSecurityStore(sec);

    try {
      await postgresService.updateUser(req.params.id, updates);
    } catch (e) {
      console.warn('Error updating user in PostgreSQL:', e);
    }

    res.json(sanitizeUser(sec.users[idx]));
  });

  app.delete('/api/users/:id', async (req, res) => {
    const sec = loadSecurityStore();
    sec.users = sec.users.filter((u: any) => u.id !== req.params.id);
    saveSecurityStore(sec);

    try {
      await postgresService.deleteUser(req.params.id);
    } catch (e) {
      console.warn('Error deleting user from PostgreSQL:', e);
    }

    res.json({ success: true });
  });

  // --- Account Requests API (PostgreSQL inno_cost) ---
  app.get('/api/account-requests', async (_req, res) => {
    try {
      const list = await postgresService.getAccountRequests();
      res.json(list);
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to fetch account requests', details: e?.message });
    }
  });

  app.post('/api/account-requests', async (req, res) => {
    try {
      const { name, email } = req.body || {};
      if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required for account requests' });
      }
      const created = await postgresService.createAccountRequest(req.body);
      res.status(201).json(created);
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to create account request', details: e?.message });
    }
  });

  app.put('/api/account-requests/:id/status', async (req, res) => {
    try {
      const { status } = req.body || {};
      if (!['Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({ error: 'Status must be Approved or Rejected' });
      }
      const actor = (req as any).user;
      const updated = await postgresService.updateAccountRequestStatus(req.params.id, status, actor?.name || 'ADMIN');
      if (!updated) return res.status(404).json({ error: 'Account request not found' });
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to update account request status', details: e?.message });
    }
  });

  // Google OAuth signin handler
  app.post('/api/auth/google-login', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const sec = loadSecurityStore();
    const query = String(email).trim().toLowerCase();
    const user = sec.users.find(
      (u: any) => u.email?.toLowerCase() === query || u.googleEmail?.toLowerCase() === query
    );

    if (!user) {
      return res.status(403).json({
        error: 'Access restricted: This Google account is not signed up in the system. Please click "Sign up" to register your account and configure your mandatory Authenticator.'
      });
    }

    if (user.status === 'Inactive') {
      return res.status(403).json({ error: 'User account is deactivated. Contact Administrator.' });
    }

    if (user.twoFactorEnabled || user.twoFactorSecret) {
      const tempMfaToken = crypto.randomBytes(24).toString('hex');
      sec.tempMfaTokens[tempMfaToken] = {
        userId: user.id,
        role: user.role,
        createdAt: Date.now()
      };
      saveSecurityStore(sec);

      return res.json({
        status: 'mfa_required',
        tempMfaToken,
        requireTotp: true,
        message: 'Enter your 6-digit Authenticator code from Google Authenticator.'
      });
    }

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    sec.sessions[sessionToken] = {
      userId: user.id,
      role: user.role,
      lastActivity: now,
      expiresAt: now + sec.sessionTimeoutMinutes * 60 * 1000
    };
    user.lastLogin = new Date().toISOString().replace('T', ' ').slice(0, 19);
    saveSecurityStore(sec);

    res.json({
      status: 'success',
      sessionToken,
      user: sanitizeUser(user),
      sessionTimeoutMinutes: sec.sessionTimeoutMinutes
    });
  });

  // Step 1: Sign up initiation with MANDATORY Authenticator QR generation
  app.post('/api/auth/signup-init', async (req, res) => {
    try {
      const { employeeId, name, email, password, department, role, authProvider } = req.body;
      if (!email || !String(email).trim()) {
        return res.status(400).json({ error: 'Work email is required.' });
      }
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Full name is required.' });
      }
      if (authProvider !== 'google' && (!password || String(password).trim().length < 6)) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }

      const sec = loadSecurityStore();
      const normalizedEmail = String(email).trim().toLowerCase();

      const existingUser = sec.users.find(
        (u: any) => u.email?.toLowerCase() === normalizedEmail || u.googleEmail?.toLowerCase() === normalizedEmail
      );
      if (existingUser) {
        return res.status(400).json({
          error: 'An account with this email is already registered. Please proceed to Sign In.'
        });
      }

      const twoFactorSecret = generateSecret();
      const otpauth = generateURI({
        issuer: 'COST SYSTEM',
        label: normalizedEmail,
        secret: twoFactorSecret
      });

      const qrCodeDataUrl = await QRCode.toDataURL(otpauth, {
        margin: 1,
        width: 240,
        color: {
          dark: '#003049',
          light: '#ffffff'
        }
      });

      let hash = '';
      let salt = '';
      if (password && String(password).trim()) {
        const hp = hashPassword(String(password).trim());
        hash = hp.hash;
        salt = hp.salt;
      }

      if (!sec.pendingSignups) sec.pendingSignups = {};
      const signupToken = crypto.randomBytes(24).toString('hex');
      sec.pendingSignups[signupToken] = {
        employeeId: employeeId ? String(employeeId).trim().toUpperCase() : `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
        name: String(name).trim(),
        email: normalizedEmail,
        role: role || 'PROJECT_MANAGER',
        department: department || 'Procurement',
        passwordHash: hash,
        passwordSalt: salt,
        authProvider: authProvider || 'password',
        twoFactorSecret,
        createdAt: Date.now()
      };
      saveSecurityStore(sec);

      return res.json({
        status: 'totp_setup_required',
        signupToken,
        qrCodeDataUrl,
        email: normalizedEmail,
        message: 'Scan this QR code with Google Authenticator or Microsoft Authenticator, then enter the 6-digit code.'
      });
    } catch (err: any) {
      console.error('Error initiating signup:', err);
      return res.status(500).json({ error: 'Failed to initiate signup. Please try again.' });
    }
  });

  // Step 2: Sign up verification with MANDATORY Authenticator code verification
  app.post('/api/auth/signup-verify', (req, res) => {
    try {
      const { signupToken, code } = req.body;
      if (!signupToken) {
        return res.status(400).json({ error: 'Signup session token is missing. Please restart signup.' });
      }

      const cleanCode = String(code || '').trim();
      if (!cleanCode) {
        return res.status(400).json({ error: 'Please enter the 6-digit Authenticator code.' });
      }

      const sec = loadSecurityStore();
      if (!sec.pendingSignups) sec.pendingSignups = {};
      const pending = sec.pendingSignups[signupToken];

      if (!pending || Date.now() - pending.createdAt > 15 * 60 * 1000) {
        delete sec.pendingSignups[signupToken];
        saveSecurityStore(sec);
        return res.status(400).json({ error: 'Signup session expired. Please start registration again.' });
      }

      let isCodeValid = false;
      try {
        const check = verifySync({ secret: pending.twoFactorSecret, token: cleanCode });
        if (check && check.valid) {
          isCodeValid = true;
        }
      } catch {
        // Validation error
      }

      if (!isCodeValid) {
        return res.status(400).json({
          error: 'Invalid Authenticator code. Please enter the current 6-digit code displayed in your Authenticator app.'
        });
      }

      const newUser = {
        id: `user-${Date.now()}`,
        employeeId: pending.employeeId,
        name: pending.name,
        email: pending.email,
        googleEmail: pending.authProvider === 'google' ? pending.email : undefined,
        role: pending.role,
        department: pending.department,
        passwordHash: pending.passwordHash,
        passwordSalt: pending.passwordSalt,
        status: 'Active',
        createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        authProvider: pending.authProvider,
        twoFactorSecret: pending.twoFactorSecret,
        twoFactorEnabled: true,
        lastLogin: new Date().toISOString().replace('T', ' ').slice(0, 19)
      };

      sec.users.unshift(newUser);
      delete sec.pendingSignups[signupToken];

      const sessionToken = crypto.randomBytes(32).toString('hex');
      const now = Date.now();
      sec.sessions[sessionToken] = {
        userId: newUser.id,
        role: newUser.role,
        lastActivity: now,
        expiresAt: now + sec.sessionTimeoutMinutes * 60 * 1000
      };
      saveSecurityStore(sec);

      return res.status(201).json({
        status: 'success',
        sessionToken,
        user: sanitizeUser(newUser),
        sessionTimeoutMinutes: sec.sessionTimeoutMinutes,
        message: 'Account successfully registered and Authenticator verified!'
      });
    } catch (err: any) {
      console.error('Error verifying signup:', err);
      return res.status(500).json({ error: 'Failed to verify Authenticator code.' });
    }
  });

  // --- Clients API (PostgreSQL inno_cost) ---
  app.get('/api/clients', async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getClientsPaginated(opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to get clients:', e);
      res.status(500).json({ error: 'Failed to fetch clients from PostgreSQL', details: e?.message });
    }
  });

  app.get('/api/clients/:id', async (req, res) => {
    try {
      const client = await postgresService.getClientById(req.params.id);
      if (!client) return res.status(404).json({ error: 'Client not found' });
      res.json(client);
    } catch (e: any) {
      console.error('Failed to get client:', e);
      res.status(500).json({ error: 'Failed to fetch client details', details: e?.message });
    }
  });

  app.post('/api/clients', async (req, res) => {
    try {
      if (!req.body || (!req.body.name && !req.body.code && !req.body.clientCode)) {
        return res.status(400).json({ error: 'Client name or code is required' });
      }
      const newClient = await postgresService.createClient(req.body);
      res.status(201).json(newClient);
    } catch (e: any) {
      console.error('Failed to create client:', e);
      res.status(400).json({ error: e?.message || 'Failed to create client in PostgreSQL' });
    }
  });

  app.put('/api/clients/:id', async (req, res) => {
    try {
      const updated = await postgresService.updateClient(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Client not found' });
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to update client:', e);
      res.status(400).json({ error: e?.message || 'Failed to update client' });
    }
  });

  app.post('/api/clients/:id/archive', async (req, res) => {
    try {
      const archived = await postgresService.archiveClient(req.params.id);
      if (!archived) return res.status(404).json({ error: 'Client not found' });
      res.json(archived);
    } catch (e: any) {
      console.error('Failed to archive client:', e);
      res.status(500).json({ error: 'Failed to archive client', details: e?.message });
    }
  });

  app.delete('/api/clients/:id', async (req, res) => {
    try {
      await postgresService.deleteClient(req.params.id);
      res.json({ success: true, message: 'Client deleted successfully' });
    } catch (e: any) {
      console.error('Failed to delete client:', e);
      res.status(400).json({ error: e?.message || 'Failed to delete client' });
    }
  });

  app.get('/api/clients/:id/projects', async (req, res) => {
    try {
      const projects = await postgresService.getClientProjects(req.params.id);
      res.json(projects);
    } catch (e: any) {
      console.error('Failed to get client projects:', e);
      res.status(500).json({ error: 'Failed to fetch client projects', details: e?.message });
    }
  });

  app.get('/api/clients/:id/contacts', async (req, res) => {
    try {
      const contacts = await postgresService.getClientContacts(req.params.id);
      res.json(contacts);
    } catch (e: any) {
      console.error('Failed to get client contacts:', e);
      res.status(500).json({ error: 'Failed to fetch client contacts', details: e?.message });
    }
  });

  app.post('/api/clients/:id/contacts', async (req, res) => {
    try {
      if (!req.body || !req.body.name || !req.body.email) {
        return res.status(400).json({ error: 'Contact name and email are required' });
      }
      const contact = await postgresService.createClientContact(req.params.id, req.body);
      res.status(201).json(contact);
    } catch (e: any) {
      console.error('Failed to create client contact:', e);
      res.status(400).json({ error: e?.message || 'Failed to create client contact' });
    }
  });

  app.put('/api/clients/:clientId/contacts/:contactId', async (req, res) => {
    try {
      const updated = await postgresService.updateClientContact(req.params.contactId, req.body);
      if (!updated) return res.status(404).json({ error: 'Contact not found' });
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to update client contact:', e);
      res.status(400).json({ error: e?.message || 'Failed to update client contact' });
    }
  });

  app.delete('/api/clients/:clientId/contacts/:contactId', async (req, res) => {
    try {
      await postgresService.deleteClientContact(req.params.contactId);
      res.json({ success: true, message: 'Contact deleted successfully' });
    } catch (e: any) {
      console.error('Failed to delete client contact:', e);
      res.status(500).json({ error: 'Failed to delete client contact', details: e?.message });
    }
  });

  app.get('/api/projects/:projectId/clients', async (req, res) => {
    try {
      const projectClients = await postgresService.getProjectClients(req.params.projectId);
      res.json(projectClients);
    } catch (e: any) {
      console.error('Failed to get project clients:', e);
      res.status(500).json({ error: 'Failed to fetch project clients', details: e?.message });
    }
  });

  app.post('/api/projects/:projectId/clients', async (req, res) => {
    try {
      if (!req.body || (!req.body.clientId && !req.body.client_id)) {
        return res.status(400).json({ error: 'clientId is required' });
      }
      const pc = await postgresService.addProjectClient(req.params.projectId, req.body);
      res.status(201).json(pc);
    } catch (e: any) {
      console.error('Failed to add project client:', e);
      res.status(400).json({ error: e?.message || 'Failed to add project client' });
    }
  });

  app.delete('/api/projects/:projectId/clients/:clientId', async (req, res) => {
    try {
      await postgresService.removeProjectClient(
        req.params.projectId,
        req.params.clientId,
        req.query.relationshipType as string
      );
      res.json({ success: true, message: 'Project client relationship removed' });
    } catch (e: any) {
      console.error('Failed to remove project client:', e);
      res.status(500).json({ error: 'Failed to remove project client', details: e?.message });
    }
  });

  // --- Suppliers API (PostgreSQL inno_cost) ---
  app.get('/api/suppliers', async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getSuppliersPaginated(opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to get suppliers:', e);
      res.status(500).json({ error: 'Failed to fetch suppliers', details: e?.message });
    }
  });

  app.post('/api/suppliers', async (req, res) => {
    try {
      if (!req.body || (!req.body.name && !req.body.code)) {
        return res.status(400).json({ error: 'Supplier name or code is required' });
      }
      const newSupplier = await postgresService.createSupplier(req.body);
      res.status(201).json(newSupplier);
    } catch (e: any) {
      console.error('Failed to create supplier:', e);
      res.status(500).json({ error: 'Failed to create supplier in PostgreSQL', details: e?.message });
    }
  });

  app.put('/api/suppliers/:id', async (req, res) => {
    try {
      const updated = await postgresService.updateSupplier(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Supplier not found' });
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to update supplier:', e);
      res.status(500).json({ error: 'Failed to update supplier', details: e?.message });
    }
  });

  app.post('/api/suppliers/:id/contracts', async (req, res) => {
    try {
      const sups = await postgresService.getSuppliers();
      const target = sups.find((s: any) => s.id === req.params.id);
      if (!target) return res.status(404).json({ error: 'Supplier not found' });
      const newContract = {
        contractId: req.body.contractId || `CTR-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
        title: req.body.title || 'Master Commercial & Supply Accord',
        value: round2(req.body.value || 0),
        startDate: req.body.startDate || new Date().toISOString().split('T')[0],
        endDate: req.body.endDate || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
        status: req.body.status || 'Active',
        scopeType: req.body.scopeType || target.supplyScope || 'materials',
        deliverablesSummary: req.body.deliverablesSummary || '',
        paymentSchedule: req.body.paymentSchedule || target.paymentTerms || 'Net 30',
        notes: req.body.notes || ''
      };
      const updatedHistory = [newContract, ...(target.contractHistory || [])];
      const updated = await postgresService.updateSupplier(req.params.id, { contractHistory: updatedHistory });
      res.status(201).json(updated);
    } catch (e: any) {
      console.error('Failed to add supplier contract:', e);
      res.status(500).json({ error: 'Failed to add contract', details: e?.message });
    }
  });

  app.delete('/api/suppliers/:id', async (req, res) => {
    try {
      await postgresService.deleteSupplier(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to delete supplier:', e);
      res.status(500).json({ error: 'Failed to delete supplier', details: e?.message });
    }
  });

  // --- Categories API (PostgreSQL inno_cost) ---
  app.get('/api/categories', async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getCategoriesPaginated(opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to get categories:', e);
      res.status(500).json({ error: 'Failed to fetch categories', details: e?.message });
    }
  });

  app.post('/api/categories', async (req, res) => {
    try {
      if (!req.body?.name) {
        return res.status(400).json({ error: 'Category name is required' });
      }
      const created = await postgresService.createCategory(req.body);
      res.status(201).json(created);
    } catch (e: any) {
      console.error('Failed to create category:', e);
      res.status(500).json({ error: 'Failed to create category in PostgreSQL', details: e?.message });
    }
  });

  app.put('/api/categories/:id', async (req, res) => {
    try {
      const updated = await postgresService.updateCategory(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Category not found' });
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to update category:', e);
      res.status(500).json({ error: 'Failed to update category', details: e?.message });
    }
  });

  app.delete('/api/categories/:id', async (req, res) => {
    try {
      await postgresService.deleteCategory(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to delete category:', e);
      res.status(500).json({ error: 'Failed to delete category', details: e?.message });
    }
  });

  // --- Enterprise Resources API (PostgreSQL inno_cost) ---
  // Labours and charges, machineries, equipments, tools, materials, subcontractors
  app.get(['/api/resources', '/api/enterprise-resources'], async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getResourcesPaginated(opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to fetch resources:', e);
      res.status(500).json({ error: 'Failed to fetch enterprise resources from PostgreSQL', details: e?.message });
    }
  });

  app.get(['/api/resources/:id/price-history', '/api/enterprise-resources/:id/price-history'], async (req, res) => {
    try {
      const history = await postgresService.getResourcePriceHistory(req.params.id);
      res.json(history);
    } catch (e: any) {
      console.error('Failed to fetch resource price history:', e);
      res.status(500).json({ error: 'Failed to fetch resource price history', details: e?.message });
    }
  });

  app.post(['/api/resources/:id/commit-price', '/api/enterprise-resources/:id/commit-price'], async (req: any, res) => {
    try {
      const actor = req.user;
      const updated = await postgresService.updateResource(req.params.id, {
        baseRate: req.body.newRate ?? req.body.baseRate,
        reason: req.body.reason || req.body.changeReason || 'Resource rate revision via Directory FXTT table',
        effectiveDate: req.body.effectiveDate,
        updatedBy: actor?.name || req.body.updatedBy || 'Resource Manager',
        currency: req.body.currency || 'LKR'
      });
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to commit resource price:', e);
      res.status(500).json({ error: 'Failed to commit resource rate', details: e?.message });
    }
  });

  app.get(['/api/resources/:id', '/api/enterprise-resources/:id'], async (req, res) => {
    try {
      const resource = await postgresService.getResourceById(req.params.id);
      if (!resource) return res.status(404).json({ error: 'Resource not found' });
      res.json(resource);
    } catch (e: any) {
      console.error('Failed to fetch resource:', e);
      res.status(500).json({ error: 'Failed to fetch resource', details: e?.message });
    }
  });

  app.post(['/api/resources', '/api/enterprise-resources'], async (req, res) => {
    try {
      if (!req.body?.name) {
        return res.status(400).json({ error: 'Resource name is required' });
      }
      const created = await postgresService.createResource(req.body);
      res.status(201).json(created);
    } catch (e: any) {
      console.error('Failed to create resource:', e);
      res.status(500).json({ error: 'Failed to create resource in PostgreSQL', details: e?.message });
    }
  });

  app.put(['/api/resources/:id', '/api/enterprise-resources/:id'], async (req, res) => {
    try {
      const updated = await postgresService.updateResource(req.params.id, req.body);
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to update resource:', e);
      res.status(500).json({ error: 'Failed to update resource in PostgreSQL', details: e?.message });
    }
  });

  app.delete(['/api/resources/:id', '/api/enterprise-resources/:id'], async (req, res) => {
    try {
      await postgresService.deleteResource(req.params.id);
      res.json({ success: true, message: 'Resource deleted' });
    } catch (e: any) {
      console.error('Failed to delete resource:', e);
      res.status(500).json({ error: 'Failed to delete resource in PostgreSQL', details: e?.message });
    }
  });

  app.post('/api/resources/:id/alternatives', async (req, res) => {
    try {
      const updated = await postgresService.addResourceAlternative(req.params.id, req.body);
      res.status(201).json(updated);
    } catch (e: any) {
      console.error('Failed to add resource alternative:', e);
      res.status(500).json({ error: 'Failed to add resource alternative', details: e?.message });
    }
  });

  app.post('/api/resources/:id/apply-alternative', async (req, res) => {
    try {
      const { alternativeId, reason } = req.body;
      const actor = (req as any).user?.name || 'Resource Manager';
      const updated = await postgresService.applyResourceAlternative(req.params.id, alternativeId, reason, actor);
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to apply resource alternative:', e);
      res.status(500).json({ error: 'Failed to apply alternative', details: e?.message });
    }
  });

  app.post('/api/resources/:id/allocate', async (req, res) => {
    try {
      const { projectId, phaseId, quantity, unit, unitCost, planId } = req.body;
      if (!projectId || quantity === undefined) {
        return res.status(400).json({ error: 'projectId and quantity are required' });
      }
      const result = await postgresService.allocateResourceToProject(
        req.params.id,
        projectId,
        phaseId,
        Number(quantity),
        unit,
        unitCost,
        planId
      );
      res.json(result);
    } catch (e: any) {
      console.error('Failed to allocate resource:', e);
      res.status(500).json({ error: 'Failed to allocate resource to project', details: e?.message });
    }
  });

  // --- Materials API (PostgreSQL inno_cost) ---
  app.get('/api/materials', async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getMaterialsPaginated(opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to fetch materials:', e);
      res.status(500).json({ error: 'Failed to fetch materials', details: e?.message });
    }
  });

  app.post('/api/materials', async (req, res) => {
    try {
      if (!req.body || (!req.body.name && !req.body.code)) {
        return res.status(400).json({ error: 'Material name or code is required' });
      }
      const newMat = await postgresService.createMaterial(req.body);
      res.status(201).json(newMat);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      if (e?.code === '23505' || e?.message?.includes('violates unique constraint') || e?.message?.includes('duplicate key')) {
        return res.status(409).json({ error: 'Conflict: Duplicate code or barcode violates unique constraint', details: e?.message });
      }
      console.error('Failed to create material:', e);
      res.status(500).json({ error: 'Failed to create material in PostgreSQL', details: e?.message });
    }
  });

  app.put('/api/materials/:id', async (req, res) => {
    try {
      const updated = await postgresService.updateMaterial(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Material item not found' });
      res.json(updated);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      if (e?.code === '23505' || e?.message?.includes('violates unique constraint') || e?.message?.includes('duplicate key')) {
        return res.status(409).json({ error: 'Conflict: Duplicate code or barcode violates unique constraint', details: e?.message });
      }
      console.error('Failed to update material:', e);
      res.status(500).json({ error: 'Failed to update material', details: e?.message });
    }
  });

  app.get('/api/measurement-units', async (_req, res) => {
    try {
      const units = await postgresService.getMeasurementUnits();
      res.json(units);
    } catch (e: any) {
      console.error('Failed to get measurement units:', e);
      res.status(500).json({ error: 'Failed to get measurement units', details: e?.message });
    }
  });

  app.post('/api/materials/:id/price-update', async (req, res) => {
    try {
      const { newPrice, reason, updatedBy, volumePricing, effectiveDate, idempotencyKey } = req.body || {};
      if (newPrice === undefined || newPrice === null || isNaN(Number(newPrice)) || Number(newPrice) < 0) {
        return res.status(400).json({ error: 'A valid non-negative newPrice is required' });
      }
      const actor = (req as any).user;
      const updated = await postgresService.updateMaterialPriceTransactional(req.params.id, {
        newPrice: Number(newPrice),
        reason,
        updatedBy: updatedBy || actor?.name || 'Materials Manager',
        volumePricing,
        effectiveDate,
        idempotencyKey
      });
      if (!updated) return res.status(404).json({ error: 'Material not found' });
      res.json(updated);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to update material price:', e);
      res.status(500).json({ error: 'Failed to update material price', details: e?.message });
    }
  });

  app.delete('/api/materials/:id', async (req, res) => {
    try {
      await postgresService.deleteMaterial(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to delete material:', e);
      res.status(500).json({ error: 'Failed to delete material', details: e?.message });
    }
  });

  // --- Material Vendor Quotes & Price Matrix APIs (PostgreSQL inno_cost) ---
  app.get('/api/materials/:id/vendor-quotes', async (req, res) => {
    try {
      const quotes = await postgresService.getMaterialVendorQuotes(req.params.id);
      res.json(quotes);
    } catch (e: any) {
      console.error('Failed to fetch material vendor quotes:', e);
      res.status(500).json({ error: 'Failed to fetch vendor quotes', details: e?.message });
    }
  });

  app.post('/api/materials/:id/vendor-quotes', async (req, res) => {
    try {
      if (!req.body || (!req.body.vendorName && !req.body.supplierId && !req.body.vendorId)) {
        return res.status(400).json({ error: 'Vendor name or supplier reference is required' });
      }
      const actor = (req as any).user;
      const created = await postgresService.createMaterialVendorQuote(req.params.id, req.body, actor);
      res.status(201).json(created);
    } catch (e: any) {
      console.error('Failed to create material vendor quote:', e);
      res.status(500).json({ error: 'Failed to create vendor quote', details: e?.message });
    }
  });

  app.put('/api/materials/:id/vendor-quotes/:quoteId', async (req, res) => {
    try {
      const actor = (req as any).user;
      const updated = await postgresService.updateMaterialVendorQuote(req.params.quoteId, req.body, actor);
      if (!updated) return res.status(404).json({ error: 'Vendor quote not found' });
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to update material vendor quote:', e);
      res.status(500).json({ error: 'Failed to update vendor quote', details: e?.message });
    }
  });

  app.post('/api/materials/:id/vendor-quotes/:quoteId/commit-price', async (req, res) => {
    try {
      const actor = (req as any).user;
      const updated = await postgresService.commitMaterialVendorPrice(req.params.id, req.params.quoteId, req.body, actor);
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to commit material vendor price:', e);
      res.status(500).json({ error: 'Failed to commit vendor price revision', details: e?.message });
    }
  });

  app.delete('/api/materials/:id/vendor-quotes/:quoteId', async (req, res) => {
    try {
      const actor = (req as any).user;
      const result = await postgresService.deleteMaterialVendorQuote(req.params.id, req.params.quoteId, req.body, actor);
      res.json(result);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to delete material vendor quote:', e);
      res.status(500).json({ error: 'Failed to delete vendor quote', details: e?.message });
    }
  });

  app.post('/api/materials/:id/vendor-quotes/:quoteId/archive-and-delete', async (req, res) => {
    try {
      const actor = (req as any).user;
      const result = await postgresService.deleteMaterialVendorQuote(req.params.id, req.params.quoteId, req.body, actor);
      res.json(result);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to archive and delete material vendor quote:', e);
      res.status(500).json({ error: 'Failed to archive and delete vendor quote', details: e?.message });
    }
  });

  app.get('/api/materials/:id/vendor-archives', async (req, res) => {
    try {
      const archives = await postgresService.getVendorDeletionArchives(req.params.id);
      res.json(archives);
    } catch (e: any) {
      console.error('Failed to fetch vendor deletion archives:', e);
      res.status(500).json({ error: 'Failed to fetch vendor deletion archives', details: e?.message });
    }
  });

  // --- Outsourced Services API (PostgreSQL inno_cost) ---
  app.get('/api/outsourced', async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getOutsourcedPaginated(opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to get outsourced services:', e);
      res.status(500).json({ error: 'Failed to fetch outsourced services', details: e?.message });
    }
  });

  app.post('/api/outsourced', async (req, res) => {
    try {
      if (!req.body || (!req.body.name && !req.body.code)) {
        return res.status(400).json({ error: 'Outsourced service name or code is required' });
      }
      const newService = await postgresService.createOutsourced(req.body);
      res.status(201).json(newService);
    } catch (e: any) {
      console.error('Failed to create outsourced service:', e);
      res.status(500).json({ error: 'Failed to create outsourced service in PostgreSQL', details: e?.message });
    }
  });

  app.put('/api/outsourced/:id', async (req, res) => {
    try {
      const updated = await postgresService.updateOutsourced(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Outsourced service not found' });
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to update outsourced service:', e);
      res.status(500).json({ error: 'Failed to update outsourced service', details: e?.message });
    }
  });

  app.post('/api/outsourced/:id/price-update', async (req, res) => {
    try {
      const { newRate, reason, updatedBy, tierRates, retailPrice, effectiveDate, idempotencyKey } = req.body || {};
      if (newRate === undefined || newRate === null || isNaN(Number(newRate)) || Number(newRate) < 0) {
        return res.status(400).json({ error: 'A valid non-negative newRate is required' });
      }
      const actor = (req as any).user;
      const updated = await postgresService.updateOutsourcedRateTransactional(req.params.id, {
        newRate: Number(newRate),
        retailPrice: retailPrice !== undefined ? Number(retailPrice) : undefined,
        tierRates,
        reason,
        updatedBy: updatedBy || actor?.name || 'Operations Lead',
        effectiveDate,
        idempotencyKey
      });
      if (!updated) return res.status(404).json({ error: 'Outsourced service not found' });
      res.json(updated);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to update outsourced rate:', e);
      res.status(500).json({ error: 'Failed to update outsourced rate', details: e?.message });
    }
  });

  app.delete('/api/outsourced/:id', async (req, res) => {
    try {
      await postgresService.deleteOutsourced(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to delete outsourced service:', e);
      res.status(500).json({ error: 'Failed to delete outsourced service', details: e?.message });
    }
  });

  // --- Subcontractors API (PostgreSQL inno_cost) ---
  app.get('/api/subcontractors', async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getSubcontractorsPaginated(opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to get subcontractors:', e);
      res.status(500).json({ error: 'Failed to fetch subcontractors', details: e?.message });
    }
  });

  app.post('/api/subcontractors', async (req, res) => {
    try {
      if (!req.body || (!req.body.subcontractorName && !req.body.name && !req.body.code)) {
        return res.status(400).json({ error: 'Subcontractor name or code is required' });
      }
      const newSub = await postgresService.createSubcontractor(req.body);
      res.status(201).json(newSub);
    } catch (e: any) {
      console.error('Failed to create subcontractor:', e);
      res.status(500).json({ error: 'Failed to create subcontractor in PostgreSQL', details: e?.message });
    }
  });

  app.put('/api/subcontractors/:id', async (req, res) => {
    try {
      const updated = await postgresService.updateSubcontractor(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Subcontractor rate not found' });
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to update subcontractor:', e);
      res.status(500).json({ error: 'Failed to update subcontractor', details: e?.message });
    }
  });

  app.post('/api/subcontractors/:id/rate-update', async (req, res) => {
    try {
      const { newBaseRate, newRetailRate, fullContractEstimate, bulkPricingRanges, changeReason, updatedBy, effectiveDate, idempotencyKey } = req.body || {};
      if (newBaseRate === undefined || newBaseRate === null || isNaN(Number(newBaseRate)) || Number(newBaseRate) < 0) {
        return res.status(400).json({ error: 'A valid non-negative newBaseRate is required' });
      }
      const actor = (req as any).user;
      const updated = await postgresService.updateSubcontractorRateTransactional(req.params.id, {
        newBaseRate: Number(newBaseRate),
        newRetailRate: newRetailRate !== undefined ? Number(newRetailRate) : undefined,
        fullContractEstimate: fullContractEstimate !== undefined ? Number(fullContractEstimate) : undefined,
        bulkPricingRanges,
        changeReason,
        updatedBy: updatedBy || actor?.name || 'Contracts Director',
        effectiveDate,
        idempotencyKey
      });
      if (!updated) return res.status(404).json({ error: 'Subcontractor rate not found' });
      res.json(updated);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to update subcontractor rate:', e);
      res.status(500).json({ error: 'Failed to update subcontractor rate', details: e?.message });
    }
  });

  app.delete('/api/subcontractors/:id', async (req, res) => {
    try {
      await postgresService.deleteSubcontractor(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to delete subcontractor:', e);
      res.status(500).json({ error: 'Failed to delete subcontractor', details: e?.message });
    }
  });

  // --- Produce Catalog API (PostgreSQL inno_cost) ---
  app.get('/api/produce', async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getProducePaginated(opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to get produce items:', e);
      res.status(500).json({ error: 'Failed to fetch produce items', details: e?.message });
    }
  });

  app.post('/api/produce', async (req, res) => {
    try {
      if (!req.body || (!req.body.name && !req.body.code)) {
        return res.status(400).json({ error: 'Produce item name or code is required' });
      }
      const newProduce = await postgresService.createProduce(req.body);
      res.status(201).json(newProduce);
    } catch (e: any) {
      console.error('Failed to create produce item:', e);
      res.status(500).json({ error: 'Failed to create produce item in PostgreSQL', details: e?.message });
    }
  });

  app.put('/api/produce/:id', async (req, res) => {
    try {
      const updated = await postgresService.updateProduce(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Produce item not found' });
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to update produce item:', e);
      res.status(500).json({ error: 'Failed to update produce item', details: e?.message });
    }
  });

  app.post('/api/produce/:id/price-update', async (req, res) => {
    try {
      const { newPrice, reason, updatedBy, bundlesAndRanges, effectiveDate, idempotencyKey } = req.body || {};
      if (newPrice === undefined || newPrice === null || isNaN(Number(newPrice)) || Number(newPrice) < 0) {
        return res.status(400).json({ error: 'A valid non-negative newPrice is required' });
      }
      const actor = (req as any).user;
      const updated = await postgresService.updateProducePriceTransactional(req.params.id, {
        newPrice: Number(newPrice),
        bundlesAndRanges,
        reason,
        updatedBy: updatedBy || actor?.name || 'Pricing Strategy Lead',
        effectiveDate,
        idempotencyKey
      });
      if (!updated) return res.status(404).json({ error: 'Produce item not found' });
      res.json(updated);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to update produce price:', e);
      res.status(500).json({ error: 'Failed to update produce price', details: e?.message });
    }
  });

  app.delete(['/api/produce/:id', '/api/produce-items/:id'], async (req, res) => {
    try {
      await postgresService.deleteProduce(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to delete produce item:', e);
      res.status(500).json({ error: 'Failed to delete produce item', details: e?.message });
    }
  });

  // --- Price History Records API (PostgreSQL inno_cost) ---
  app.get('/api/price-history', async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getPriceHistory(opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to fetch price history:', e);
      res.status(500).json({ error: 'Failed to fetch price history records', details: e?.message });
    }
  });

  app.post('/api/price-history', async (req, res) => {
    try {
      const actor = (req as any).user;
      const created = await postgresService.createPriceHistoryRecord(req.body, actor);
      res.status(201).json(created);
    } catch (e: any) {
      console.error('Failed to create price history record:', e);
      res.status(500).json({ error: 'Failed to create price history record', details: e?.message });
    }
  });

  app.put('/api/price-history/:id', async (req, res) => {
    try {
      const actor = (req as any).user;
      const updated = await postgresService.updatePriceHistoryRecord(req.params.id, req.body, actor);
      if (!updated) return res.status(404).json({ error: 'Price history record not found' });
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to update price history record:', e);
      res.status(500).json({ error: 'Failed to update price history record', details: e?.message });
    }
  });

  app.delete('/api/price-history/:id', async (req, res) => {
    try {
      const success = await postgresService.deletePriceHistoryRecord(req.params.id);
      res.json({ success, message: 'Price history record deleted successfully' });
    } catch (e: any) {
      console.error('Failed to delete price history record:', e);
      res.status(500).json({ error: 'Failed to delete price history record', details: e?.message });
    }
  });

  app.put('/api/procurement-price-history/:id', async (req, res) => {
    try {
      const actor = (req as any).user;
      const updated = await postgresService.updatePriceHistoryRecord(req.params.id, req.body, actor);
      if (!updated) return res.status(404).json({ error: 'Price history record not found' });
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to update procurement price history:', e);
      res.status(500).json({ error: 'Failed to update procurement price history', details: e?.message });
    }
  });

  app.delete('/api/procurement-price-history/:id', async (req, res) => {
    try {
      const success = await postgresService.deletePriceHistoryRecord(req.params.id);
      res.json({ success, message: 'Procurement price record deleted successfully' });
    } catch (e: any) {
      console.error('Failed to delete procurement price history:', e);
      res.status(500).json({ error: 'Failed to delete procurement price record', details: e?.message });
    }
  });

  // --- TASK 5: Procurement Price History System API (PostgreSQL inno_cost) ---
  app.get('/api/procurement-price-history', async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getProcurementPriceHistory(opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to fetch procurement price history:', e);
      res.status(500).json({ error: 'Failed to fetch procurement price history', details: e?.message });
    }
  });

  app.post('/api/procurement-price-history', async (req, res) => {
    try {
      const { supplierId, itemId, unitPrice } = req.body || {};
      if (!supplierId) {
        return res.status(400).json({ error: 'Supplier ID is required' });
      }
      if (!itemId && !req.body?.materialId && !req.body?.outsourcedServiceId && !req.body?.subcontractorId) {
        return res.status(400).json({ error: 'Item ID (material, service, or subcontractor rate) is required' });
      }
      if (unitPrice === undefined || unitPrice === null || isNaN(Number(unitPrice)) || Number(unitPrice) < 0) {
        return res.status(400).json({ error: 'A valid non-negative unitPrice is required' });
      }

      const actor = (req as any).user;
      const created = await postgresService.createProcurementPriceRecord(req.body, actor);
      res.status(201).json(created);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to record procurement price:', e);
      res.status(500).json({ error: 'Failed to record procurement price in PostgreSQL', details: e?.message });
    }
  });

  app.get('/api/procurement-price-history/comparison', async (req, res) => {
    try {
      const itemId = String(req.query.itemId || req.query.materialId || '');
      if (!itemId) {
        return res.status(400).json({ error: 'itemId query parameter is required for price comparison' });
      }
      const itemType = req.query.itemType ? String(req.query.itemType) : undefined;
      const unit = req.query.unit ? String(req.query.unit) : undefined;
      const comparison = await postgresService.getProcurementPriceComparison(itemId, itemType, unit);
      res.json(comparison);
    } catch (e: any) {
      console.error('Failed to get price comparison:', e);
      res.status(500).json({ error: 'Failed to get price comparison data', details: e?.message });
    }
  });

  app.get('/api/suppliers/:id/price-history', async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getSupplierPriceHistory(req.params.id, opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to fetch supplier price history:', e);
      res.status(500).json({ error: 'Failed to fetch supplier price history', details: e?.message });
    }
  });

  app.get('/api/materials/:id/price-history', async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getItemPriceHistory('material', req.params.id, opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to fetch material price history:', e);
      res.status(500).json({ error: 'Failed to fetch material price history', details: e?.message });
    }
  });

  app.get('/api/outsourced/:id/price-history', async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getItemPriceHistory('outsourced_service', req.params.id, opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to fetch outsourced price history:', e);
      res.status(500).json({ error: 'Failed to fetch outsourced price history', details: e?.message });
    }
  });

  app.get('/api/subcontractors/:id/price-history', async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getItemPriceHistory('subcontractor_rate', req.params.id, opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to fetch subcontractor price history:', e);
      res.status(500).json({ error: 'Failed to fetch subcontractor price history', details: e?.message });
    }
  });

  // --- Inventory API (PostgreSQL inno_cost) ---
  app.get('/api/inventory', async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getInventoryPaginated(opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to get inventory:', e);
      res.status(500).json({ error: 'Failed to fetch inventory', details: e?.message });
    }
  });

  app.post('/api/inventory', async (req, res) => {
    try {
      const created = await postgresService.createInventory(req.body);
      res.status(201).json(created);
    } catch (e: any) {
      console.error('Failed to create inventory item:', e);
      res.status(500).json({ error: 'Failed to create inventory item in PostgreSQL', details: e?.message });
    }
  });

  app.put('/api/inventory/:id', async (req, res) => {
    try {
      const updated = await postgresService.updateInventory(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Inventory record not found' });
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to update inventory record:', e);
      res.status(500).json({ error: 'Failed to update inventory record', details: e?.message });
    }
  });

  app.delete('/api/inventory/:id', async (req, res) => {
    try {
      await postgresService.deleteInventory(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to delete inventory record:', e);
      res.status(500).json({ error: 'Failed to delete inventory record', details: e?.message });
    }
  });

  // --- Inventory Transactions API (PostgreSQL inno_cost) ---
  app.get('/api/inventory/transactions', async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getTransactionsPaginated(opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to fetch transactions:', e);
      res.status(500).json({ error: 'Failed to fetch transactions', details: e?.message });
    }
  });

  app.post('/api/inventory/transactions', async (req, res) => {
    try {
      const actor = (req as any).user;
      const created = await postgresService.createTransaction(req.body, { id: actor?.id, name: actor?.name });
      res.status(201).json(created);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to record transaction:', e);
      res.status(500).json({ error: 'Failed to record transaction', details: e?.message });
    }
  });

  app.put('/api/inventory/transactions/:id', async (req, res) => {
    try {
      const actor = (req as any).user;
      const updated = await postgresService.updateTransaction(req.params.id, req.body, { id: actor?.id, name: actor?.name });
      if (!updated) return res.status(404).json({ error: 'Inventory transaction not found' });
      res.json(updated);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to update transaction:', e);
      res.status(500).json({ error: 'Failed to update transaction', details: e?.message });
    }
  });

  app.delete('/api/inventory/transactions/:id', async (req, res) => {
    try {
      const actor = (req as any).user;
      const deleted = await postgresService.deleteTransaction(req.params.id, { id: actor?.id, name: actor?.name });
      if (!deleted) return res.status(404).json({ error: 'Inventory transaction not found' });
      res.json({ success: true });
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to delete transaction:', e);
      res.status(500).json({ error: 'Failed to delete transaction', details: e?.message });
    }
  });

  // --- Audit Logs API (PostgreSQL inno_cost) ---
  app.get('/api/audit-logs', async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getAuditLogsPaginated(opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to fetch audit logs:', e);
      res.status(500).json({ error: 'Failed to fetch audit logs', details: e?.message });
    }
  });

  app.post('/api/audit-logs', async (req: any, res) => {
    try {
      const actor = req.user;
      if (!actor) {
        return res.status(401).json({ error: 'Please sign in to record audit events' });
      }
      // Strict actor validation: actor identity comes from authenticated session only (Requirement 6)
      const created = await postgresService.createAuditLog({
        ...req.body,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        ipAddress: req.ip || req.socket?.remoteAddress || '127.0.0.1',
        userAgent: req.headers['user-agent'] || ''
      });
      res.status(201).json(created);
    } catch (e: any) {
      console.error('Failed to create audit log:', e);
      res.status(500).json({ error: 'Failed to create audit log', details: e?.message });
    }
  });

  // Protect audit history from unauthorized modification or deletion (Requirement 7)
  app.put(['/api/audit-logs', '/api/audit-logs/:id'], (_req, res) => {
    return res.status(403).json({ error: 'Audit history is strictly immutable and protected from alteration.' });
  });

  app.patch(['/api/audit-logs', '/api/audit-logs/:id'], (_req, res) => {
    return res.status(403).json({ error: 'Audit history is strictly immutable and protected from alteration.' });
  });

  app.delete(['/api/audit-logs', '/api/audit-logs/:id'], (_req, res) => {
    return res.status(403).json({ error: 'Audit history is strictly immutable and cannot be deleted.' });
  });

  // --- Enterprise Tariff Management API (TASK 9) ---
  app.get('/api/tariffs', async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getTariffs(opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to fetch tariffs:', e);
      res.status(500).json({ error: 'Failed to fetch tariffs', details: e?.message });
    }
  });

  app.get('/api/tariffs/:id', async (req, res) => {
    try {
      const tariff = await postgresService.getTariffById(req.params.id);
      if (!tariff) return res.status(404).json({ error: 'Tariff not found' });
      res.json(tariff);
    } catch (e: any) {
      console.error('Failed to fetch tariff details:', e);
      res.status(500).json({ error: 'Failed to fetch tariff details', details: e?.message });
    }
  });

  app.post('/api/tariffs', async (req: any, res) => {
    try {
      const actor = req.user;
      const created = await postgresService.createTariff(req.body, {
        id: actor?.id,
        name: actor?.name,
        role: actor?.role
      });
      res.status(201).json(created);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to create tariff:', e);
      res.status(500).json({ error: 'Failed to create tariff', details: e?.message });
    }
  });

  app.put('/api/tariffs/:id', async (req: any, res) => {
    try {
      const actor = req.user;
      const updated = await postgresService.updateTariff(req.params.id, req.body, {
        id: actor?.id,
        name: actor?.name,
        role: actor?.role
      });
      res.json(updated);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to update tariff:', e);
      res.status(500).json({ error: 'Failed to update tariff', details: e?.message });
    }
  });

  app.post('/api/tariffs/:id/versions', async (req: any, res) => {
    try {
      const actor = req.user;
      const created = await postgresService.createTariffVersion(req.params.id, req.body, {
        id: actor?.id,
        name: actor?.name,
        role: actor?.role
      });
      res.status(201).json(created);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to create tariff version:', e);
      res.status(500).json({ error: 'Failed to create tariff version', details: e?.message });
    }
  });

  app.delete('/api/tariffs/:id', async (req: any, res) => {
    try {
      const actor = req.user;
      const success = await postgresService.deleteTariff(req.params.id, {
        id: actor?.id,
        name: actor?.name,
        role: actor?.role
      });
      if (!success) return res.status(404).json({ error: 'Tariff not found' });
      res.json({ success: true, message: 'Tariff schedule deleted successfully' });
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to delete tariff:', e);
      res.status(500).json({ error: 'Failed to delete tariff', details: e?.message });
    }
  });

  app.delete('/api/tariffs/:id/versions/:versionId', async (req: any, res) => {
    try {
      const actor = req.user;
      const success = await postgresService.deleteTariffVersion(req.params.id, req.params.versionId, {
        id: actor?.id,
        name: actor?.name,
        role: actor?.role
      });
      if (!success) return res.status(404).json({ error: 'Tariff version not found' });
      res.json({ success: true, message: 'Tariff version deleted successfully' });
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to delete tariff version:', e);
      res.status(500).json({ error: 'Failed to delete tariff version', details: e?.message });
    }
  });

  app.get('/api/tariffs/:id/resolve', async (req, res) => {
    try {
      const date = req.query.date ? String(req.query.date) : undefined;
      const resolved = await postgresService.resolveTariffVersion(req.params.id, date);
      if (!resolved) return res.status(404).json({ error: 'No applicable tariff version found' });
      res.json(resolved);
    } catch (e: any) {
      console.error('Failed to resolve tariff version:', e);
      res.status(500).json({ error: 'Failed to resolve tariff version', details: e?.message });
    }
  });

  const planTariffRoutes = [
    '/api/project-plans/:planId/tariffs',
    '/api/plans/:planId/tariffs'
  ];

  app.get(planTariffRoutes, async (req, res) => {
    try {
      const tariffs = await postgresService.getPlanTariffs(req.params.planId);
      res.json(tariffs);
    } catch (e: any) {
      console.error('Failed to fetch plan tariffs:', e);
      res.status(500).json({ error: 'Failed to fetch plan tariffs', details: e?.message });
    }
  });

  app.post(planTariffRoutes, async (req: any, res) => {
    try {
      const actor = req.user;
      const result = await postgresService.applyTariffToPlan(req.params.planId, req.body, {
        id: actor?.id,
        name: actor?.name,
        role: actor?.role
      });
      res.status(201).json(result);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to apply tariff to plan:', e);
      res.status(500).json({ error: 'Failed to apply tariff to plan', details: e?.message });
    }
  });

  const planTariffItemRoutes = [
    '/api/project-plans/:planId/tariffs/:tariffId',
    '/api/plans/:planId/tariffs/:tariffId'
  ];

  app.delete(planTariffItemRoutes, async (req: any, res) => {
    try {
      const actor = req.user;
      const ok = await postgresService.removePlanTariff(req.params.planId, req.params.tariffId, {
        id: actor?.id,
        name: actor?.name,
        role: actor?.role
      });
      if (!ok) return res.status(404).json({ error: 'Plan tariff not found' });
      res.json({ success: true });
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to remove plan tariff:', e);
      res.status(500).json({ error: 'Failed to remove plan tariff', details: e?.message });
    }
  });



  // --- Shared app settings (numbering rules, templates, image overrides, calendar, FX rates) ---
  const KV_KEY = /^[A-Za-z0-9_.\-]{1,80}$/;
  app.get('/api/kv', async (_req, res) => {
    try { res.json(await postgresService.getKv()); }
    catch (e: any) { res.status(500).json({ error: e?.message }); }
  });
  app.get('/api/kv/:key', async (req, res) => {
    const { key } = req.params;
    if (!KV_KEY.test(key)) return res.status(400).json({ error: 'Bad key' });
    try {
      const val = await postgresService.getKvKey(key);
      res.json({ key, value: val ?? null });
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  });
  app.put('/api/kv/:key', async (req, res) => {
    const { key } = req.params;
    const { value } = req.body || {};
    if (!KV_KEY.test(key) || typeof value !== 'string' || value.length > 5_000_000) {
      return res.status(400).json({ error: 'Bad key or value' });
    }
    try { await postgresService.setKv(key, value); res.json({ success: true }); }
    catch (e: any) { res.status(500).json({ error: e?.message }); }
  });
  app.delete('/api/kv/:key', async (req, res) => {
    if (!KV_KEY.test(req.params.key)) return res.status(400).json({ error: 'Bad key' });
    try { await postgresService.deleteKv(req.params.key); res.json({ success: true }); }
    catch (e: any) { res.status(500).json({ error: e?.message }); }
  });

  // --- Projects & Profitability API (PostgreSQL inno_cost) ---
  app.get('/api/projects', async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getProjectsPaginated(opts);
      const withAnalytics = result.data.map((p: any) => ({
        ...p,
        analytics: runPythonAnalytics(p)
      }));
      return sendListResponse(res, { ...result, data: withAnalytics }, opts.paginated);
    } catch (e: any) {
      console.error('Failed to get projects:', e);
      res.status(500).json({ error: 'Failed to fetch projects', details: e?.message });
    }
  });

  app.get('/api/projects/:id', async (req, res) => {
    try {
      const project = await postgresService.getProjectById(req.params.id);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      project.analytics = runPythonAnalytics(project);
      res.json(project);
    } catch (e: any) {
      console.error('Failed to get project:', e);
      res.status(500).json({ error: 'Failed to fetch project', details: e?.message });
    }
  });

  app.post('/api/projects', async (req: any, res) => {
    try {
      if (!req.body || (!req.body.name && !req.body.code)) {
        return res.status(400).json({ error: 'Project name or code is required' });
      }
      const payload = {
        ...req.body,
        createdByUserId: req.body.createdByUserId || req.user?.id || 'usr-1',
        createdByName: req.body.createdByName || req.user?.name || 'System User'
      };
      const newProject = await postgresService.createProject(payload);
      newProject.analytics = runPythonAnalytics(newProject);
      res.status(201).json(newProject);
    } catch (e: any) {
      console.error('Failed to create project:', e);
      res.status(500).json({ error: 'Failed to create project in PostgreSQL', details: e?.message });
    }
  });

  app.put('/api/projects/:id', async (req: any, res) => {
    try {
      const payload = {
        ...req.body,
        updatedByUserId: req.body.updatedByUserId || req.user?.id || 'usr-1',
        updatedByName: req.body.updatedByName || req.user?.name || 'System User'
      };
      const updated = await postgresService.updateProject(req.params.id, payload);
      if (!updated) return res.status(404).json({ error: 'Project not found' });
      updated.analytics = runPythonAnalytics(updated);
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to update project:', e);
      res.status(500).json({ error: 'Failed to update project', details: e?.message });
    }
  });

  app.delete('/api/projects/:id', async (req, res) => {
    try {
      await postgresService.deleteProject(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to delete project:', e);
      res.status(500).json({ error: 'Failed to delete project', details: e?.message });
    }
  });

  // --- Project Plans API (Normalized PostgreSQL Project Planning System) ---
  app.get('/api/projects/:projectId/plans/comparison', async (req, res) => {
    try {
      const comparison = await postgresService.getProjectPlansComparison(req.params.projectId);
      res.json(comparison);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to get project plans comparison:', e);
      res.status(500).json({ error: 'Failed to fetch project plans comparison', details: e?.message });
    }
  });

  app.get('/api/projects/:projectId/plans', async (req, res) => {
    try {
      const project = await postgresService.getProjectById(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: `Project with ID "${req.params.projectId}" does not exist.` });
      }
      const opts = extractListOptions({ ...req.query, projectId: req.params.projectId });
      const result = await postgresService.getProjectPlansPaginated(opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to get plans for project:', e);
      res.status(500).json({ error: 'Failed to fetch project plans', details: e?.message });
    }
  });

  app.post('/api/projects/:projectId/plans', async (req: any, res) => {
    try {
      const projectId = req.params.projectId;
      if (!req.body || !String(req.body.name || req.body.planName || '').trim()) {
        return res.status(400).json({ error: 'Plan name is required.' });
      }
      const payload = {
        ...req.body,
        projectId,
        createdByUserId: req.body.createdByUserId || req.user?.id || 'usr-1',
        createdByName: req.body.createdByName || req.user?.name || 'System User',
        updatedByUserId: req.body.updatedByUserId || req.user?.id || 'usr-1',
        updatedByName: req.body.updatedByName || req.user?.name || 'System User'
      };
      const created = await postgresService.createProjectPlan(payload);
      res.status(201).json(created);
    } catch (e: any) {
      console.error('Failed to create project plan:', e);
      const msg = String(e?.message || '');
      if (msg.includes('does not exist') || msg.includes('required')) {
        return res.status(400).json({ error: msg });
      }
      if (msg.includes('already exists') || msg.includes('unique')) {
        return res.status(409).json({ error: msg });
      }
      res.status(500).json({ error: 'Failed to create project plan', details: msg });
    }
  });

  app.get('/api/project-plans', async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getProjectPlansPaginated(opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to get project plans:', e);
      res.status(500).json({ error: 'Failed to fetch project plans', details: e?.message });
    }
  });

  app.get('/api/project-plans/:id', async (req, res) => {
    try {
      const plan = await postgresService.getProjectPlanById(req.params.id);
      if (!plan) {
        return res.status(404).json({ error: 'Project plan not found' });
      }
      res.json(plan);
    } catch (e: any) {
      console.error('Failed to get project plan details:', e);
      res.status(500).json({ error: 'Failed to fetch project plan details', details: e?.message });
    }
  });

  app.post('/api/project-plans', async (req: any, res) => {
    try {
      const projectId = String(req.body?.projectId || '').trim();
      if (!projectId) {
        return res.status(400).json({ error: 'A valid projectId is required to create a project plan.' });
      }
      if (!String(req.body?.name || req.body?.planName || '').trim()) {
        return res.status(400).json({ error: 'Plan name is required.' });
      }
      const payload = {
        ...req.body,
        projectId,
        createdByUserId: req.body.createdByUserId || req.user?.id || 'usr-1',
        createdByName: req.body.createdByName || req.user?.name || 'System User',
        updatedByUserId: req.body.updatedByUserId || req.user?.id || 'usr-1',
        updatedByName: req.body.updatedByName || req.user?.name || 'System User'
      };
      const created = await postgresService.createProjectPlan(payload);
      res.status(201).json(created);
    } catch (e: any) {
      console.error('Failed to create project plan:', e);
      const msg = String(e?.message || '');
      if (msg.includes('does not exist') || msg.includes('required')) {
        return res.status(400).json({ error: msg });
      }
      if (msg.includes('already exists') || msg.includes('unique')) {
        return res.status(409).json({ error: msg });
      }
      res.status(500).json({ error: 'Failed to create project plan', details: msg });
    }
  });

  app.put('/api/project-plans/:id', async (req: any, res) => {
    try {
      const payload = {
        ...req.body,
        updatedByUserId: req.body.updatedByUserId || req.user?.id || 'usr-1',
        updatedByName: req.body.updatedByName || req.user?.name || 'System User'
      };
      if (payload.status === 'Approved' && !payload.approvedByName) {
        payload.approvedByUserId = req.user?.id || 'usr-1';
        payload.approvedByName = req.user?.name || 'System User';
      }
      const updated = await postgresService.updateProjectPlan(req.params.id, payload);
      if (!updated) {
        return res.status(404).json({ error: 'Project plan not found' });
      }
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to update project plan:', e);
      const msg = String(e?.message || '');
      if (msg.includes('does not exist') || msg.includes('required')) {
        return res.status(400).json({ error: msg });
      }
      if (msg.includes('already exists') || msg.includes('unique')) {
        return res.status(409).json({ error: msg });
      }
      res.status(500).json({ error: 'Failed to update project plan', details: msg });
    }
  });

  app.post('/api/project-plans/:id/archive', async (req: any, res) => {
    try {
      const archived = await postgresService.archiveProjectPlan(req.params.id, {
        id: req.body?.userId || req.user?.id || 'usr-1',
        name: req.body?.userName || req.user?.name || 'System User'
      });
      if (!archived) {
        return res.status(404).json({ error: 'Project plan not found' });
      }
      res.json(archived);
    } catch (e: any) {
      console.error('Failed to archive project plan:', e);
      res.status(500).json({ error: 'Failed to archive project plan', details: e?.message });
    }
  });

  app.post('/api/project-plans/:id/activate', async (req: any, res) => {
    try {
      const activated = await postgresService.activateProjectPlan(req.params.id, {
        id: req.body?.userId || req.user?.id || 'usr-1',
        name: req.body?.userName || req.user?.name || 'System User'
      });
      if (!activated) {
        return res.status(404).json({ error: 'Project plan not found' });
      }
      res.json(activated);
    } catch (e: any) {
      console.error('Failed to activate project plan:', e);
      res.status(500).json({ error: 'Failed to activate project plan', details: e?.message });
    }
  });

  app.post('/api/project-plans/:id/duplicate', async (req: any, res) => {
    try {
      const duplicated = await postgresService.duplicateProjectPlan(req.params.id, {
        name: req.body?.name,
        userId: req.body?.userId || req.user?.id || 'usr-1',
        userName: req.body?.userName || req.user?.name || 'System User'
      });
      if (!duplicated) {
        return res.status(404).json({ error: 'Source project plan not found' });
      }
      res.status(201).json(duplicated);
    } catch (e: any) {
      console.error('Failed to duplicate project plan:', e);
      res.status(500).json({ error: 'Failed to duplicate project plan', details: e?.message });
    }
  });

  app.delete('/api/project-plans/:id', async (req, res) => {
    try {
      const existing = await postgresService.getProjectPlanById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Project plan not found' });
      }
      await postgresService.deleteProjectPlan(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to delete project plan:', e);
      res.status(500).json({ error: 'Failed to delete project plan', details: e?.message });
    }
  });

  // --- Project Plan Cost Controls API (PostgreSQL inno_cost) ---
  const planCostControlRoutes = [
    '/api/project-plans/:planId/cost-controls',
    '/api/plans/:planId/cost-controls'
  ];

  app.get(planCostControlRoutes, async (req, res) => {
    try {
      const controls = await postgresService.getPlanCostControls(req.params.planId);
      res.json(controls);
    } catch (e: any) {
      console.error('Failed to get plan cost controls:', e);
      res.status(500).json({ error: 'Failed to fetch plan cost controls', details: e?.message });
    }
  });

  app.put(planCostControlRoutes, async (req: any, res) => {
    try {
      const actor = req.user;
      const updated = await postgresService.updatePlanCostControls(req.params.planId, req.body, actor);
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to update plan cost controls:', e);
      res.status(500).json({ error: 'Failed to update plan cost controls', details: e?.message });
    }
  });

  const planCostControlActionRoutes = [
    '/api/project-plans/:planId/cost-controls/action',
    '/api/plans/:planId/cost-controls/action'
  ];

  app.post(planCostControlActionRoutes, async (req: any, res) => {
    try {
      const { action, payload } = req.body || {};
      const actor = req.user;
      const result = await postgresService.applyPlanCostControlAction(req.params.planId, action, payload, actor);
      res.json(result);
    } catch (e: any) {
      console.error('Failed to execute plan cost control action:', e);
      res.status(500).json({ error: 'Failed to execute cost control action', details: e?.message });
    }
  });

  // --- Plan Resources & Cost Summary API ---
  app.get('/api/project-plans/:id/cost-summary', async (req, res) => {
    try {
      const summary = await postgresService.getPlanCostSummary(req.params.id);
      if (!summary) return res.status(404).json({ error: 'Cost summary not found' });
      res.json(summary);
    } catch (e: any) {
      console.error('Failed to fetch plan cost summary:', e);
      res.status(500).json({ error: 'Failed to fetch plan cost summary', details: e?.message });
    }
  });

  app.get('/api/project-plans/:id/resources', async (req, res) => {
    try {
      const resources = await postgresService.getPlanResources(req.params.id);
      res.json(resources);
    } catch (e: any) {
      console.error('Failed to fetch plan resources:', e);
      res.status(500).json({ error: 'Failed to fetch plan resources', details: e?.message });
    }
  });

  app.post('/api/project-plans/:id/resources', async (req: any, res) => {
    try {
      const actor = req.user?.name || req.body?.actor || 'Resource Manager';
      const created = await postgresService.addResourceToPlan(req.params.id, req.body, actor);
      res.status(201).json(created);
    } catch (e: any) {
      console.error('Failed to add resource to plan:', e);
      res.status(500).json({ error: 'Failed to add resource to plan', details: e?.message });
    }
  });

  app.put('/api/project-plans/:id/resources/:resourceId', async (req: any, res) => {
    try {
      const actor = req.user?.name || req.body?.actor || 'Resource Manager';
      const updated = await postgresService.updatePlanResource(req.params.id, req.params.resourceId, req.body, actor);
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to update plan resource:', e);
      res.status(500).json({ error: 'Failed to update plan resource', details: e?.message });
    }
  });

  app.delete('/api/project-plans/:id/resources/:resourceId', async (req: any, res) => {
    try {
      const actor = req.user?.name || 'Resource Manager';
      await postgresService.deletePlanResource(req.params.id, req.params.resourceId, actor);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to delete plan resource:', e);
      res.status(500).json({ error: 'Failed to delete plan resource', details: e?.message });
    }
  });

  // ============================================================================
  // OVERHEAD COST MANAGEMENT PORTAL & ALLOCATIONS API (TASK 2)
  // ============================================================================

  // --- Overhead Categories ---
  app.get('/api/overhead-categories', async (_req, res) => {
    try {
      const categories = await postgresService.getOverheadCategories();
      res.json(categories);
    } catch (e: any) {
      console.error('Failed to get overhead categories:', e);
      res.status(500).json({ error: 'Failed to fetch overhead categories', details: e?.message });
    }
  });

  app.post('/api/overhead-categories', async (req, res) => {
    try {
      if (!req.body?.name) {
        return res.status(400).json({ error: 'Category name is required' });
      }
      const created = await postgresService.createOverheadCategory(req.body);
      res.status(201).json(created);
    } catch (e: any) {
      console.error('Failed to create overhead category:', e);
      res.status(500).json({ error: 'Failed to create overhead category', details: e?.message });
    }
  });

  app.put('/api/overhead-categories/:id', async (req, res) => {
    try {
      const updated = await postgresService.updateOverheadCategory(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Category not found' });
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to update overhead category:', e);
      res.status(500).json({ error: 'Failed to update overhead category', details: e?.message });
    }
  });

  app.delete('/api/overhead-categories/:id', async (req, res) => {
    try {
      const ok = await postgresService.deleteOverheadCategory(req.params.id);
      res.json({ success: true, deleted: ok });
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to delete overhead category:', e);
      res.status(500).json({ error: 'Failed to delete overhead category', details: e?.message });
    }
  });

  // --- Centralized Overhead Items Catalogue ---
  app.get(['/api/overhead-items', '/api/overheads'], async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getOverheadItemsPaginated(opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to get overhead items:', e);
      res.status(500).json({ error: 'Failed to fetch overhead catalogue items', details: e?.message });
    }
  });

  app.get(['/api/overhead-items/:id', '/api/overheads/:id'], async (req, res) => {
    try {
      const item = await postgresService.getOverheadItemById(req.params.id);
      if (!item) {
        return res.status(404).json({ error: 'Overhead catalogue item not found' });
      }
      res.json(item);
    } catch (e: any) {
      console.error('Failed to get overhead item:', e);
      res.status(500).json({ error: 'Failed to fetch overhead item details', details: e?.message });
    }
  });

  app.post(['/api/overhead-items', '/api/overheads'], async (req: any, res) => {
    try {
      const actor = req.user;
      const created = await postgresService.createOverheadItem(req.body, {
        id: actor?.id,
        name: actor?.name,
        role: actor?.role
      });
      res.status(201).json(created);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message, existingItem: e?.existingItem });
      console.error('Failed to create overhead item:', e);
      res.status(500).json({ error: 'Failed to create overhead catalogue item', details: e?.message });
    }
  });

  app.put(['/api/overhead-items/:id', '/api/overheads/:id'], async (req: any, res) => {
    try {
      const actor = req.user;
      const updated = await postgresService.updateOverheadItem(req.params.id, req.body, {
        id: actor?.id,
        name: actor?.name,
        role: actor?.role
      });
      if (!updated) return res.status(404).json({ error: 'Overhead item not found' });
      res.json(updated);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to update overhead item:', e);
      res.status(500).json({ error: 'Failed to update overhead catalogue item', details: e?.message });
    }
  });

  app.delete(['/api/overhead-items/:id', '/api/overheads/:id'], async (req: any, res) => {
    try {
      const actor = req.user;
      const ok = await postgresService.deleteOverheadItem(req.params.id, {
        id: actor?.id,
        name: actor?.name,
        role: actor?.role
      });
      res.json({ success: true, deleted: ok });
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message, linkedPlansCount: e?.linkedPlansCount });
      console.error('Failed to delete overhead item:', e);
      res.status(500).json({ error: 'Failed to delete overhead catalogue item', details: e?.message });
    }
  });

  app.post(['/api/overhead-items/:id/commit-price', '/api/overheads/:id/commit-price'], async (req: any, res) => {
    try {
      const actor = req.user;
      const updated = await postgresService.updateOverheadItem(req.params.id, {
        defaultRate: req.body.newRate ?? req.body.defaultRate ?? req.body.newPrice,
        unitType: req.body.unitType,
        description: req.body.reason ? `${req.body.reason}` : undefined
      }, {
        id: actor?.id,
        name: actor?.name,
        role: actor?.role
      });
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to commit overhead price:', e);
      res.status(500).json({ error: 'Failed to commit overhead rate', details: e?.message });
    }
  });

  app.get(['/api/overhead-items/:id/price-history', '/api/overheads/:id/price-history'], async (req, res) => {
    try {
      const history = await postgresService.getOverheadAuditLogs({ itemId: req.params.id, limit: 100 });
      res.json(history.data || []);
    } catch (e: any) {
      console.error('Failed to get overhead price history:', e);
      res.status(500).json({ error: 'Failed to fetch overhead price history', details: e?.message });
    }
  });

  // --- Plan Overhead Allocations ---
  app.get('/api/overhead-allocations', async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const rows = await postgresService.getAllOverheadAllocations(opts);
      res.json(rows);
    } catch (e: any) {
      console.error('Failed to get all overhead allocations:', e);
      res.status(500).json({ error: 'Failed to fetch overhead allocations', details: e?.message });
    }
  });

  const planOverheadRoutes = [
    '/api/project-plans/:planId/overheads',
    '/api/plans/:planId/overheads',
    '/api/plans/:planId/overhead-allocations'
  ];

  const planOverheadItemRoutes = [
    '/api/project-plans/:planId/overheads/:allocationId',
    '/api/plans/:planId/overheads/:allocationId',
    '/api/plans/:planId/overhead-allocations/:allocationId'
  ];

  const planRecalculateRoutes = [
    '/api/project-plans/:planId/recalculate-overheads',
    '/api/plans/:planId/recalculate-overheads'
  ];

  app.get(planOverheadRoutes, async (req, res) => {
    try {
      const allocations = await postgresService.getPlanOverheadAllocations(req.params.planId);
      res.json(allocations);
    } catch (e: any) {
      console.error('Failed to get plan overhead allocations:', e);
      res.status(500).json({ error: 'Failed to fetch plan overhead allocations', details: e?.message });
    }
  });

  app.post(planOverheadRoutes, async (req: any, res) => {
    try {
      const actor = req.user;
      const created = await postgresService.addPlanOverheadAllocation(req.params.planId, req.body, {
        id: actor?.id,
        name: actor?.name,
        role: actor?.role
      });
      res.status(201).json(created);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message, existingAllocationId: e?.existingAllocationId });
      console.error('Failed to allocate overhead to plan:', e);
      res.status(500).json({ error: 'Failed to allocate overhead to plan', details: e?.message });
    }
  });

  app.put(planOverheadItemRoutes, async (req: any, res) => {
    try {
      const actor = req.user;
      const updated = await postgresService.updatePlanOverheadAllocation(req.params.planId, req.params.allocationId, req.body, {
        id: actor?.id,
        name: actor?.name,
        role: actor?.role
      });
      if (!updated) return res.status(404).json({ error: 'Plan overhead allocation not found' });
      res.json(updated);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to update plan overhead allocation:', e);
      res.status(500).json({ error: 'Failed to update plan overhead allocation', details: e?.message });
    }
  });

  app.delete(planOverheadItemRoutes, async (req: any, res) => {
    try {
      const actor = req.user;
      const ok = await postgresService.deletePlanOverheadAllocation(req.params.planId, req.params.allocationId, {
        id: actor?.id,
        name: actor?.name,
        role: actor?.role
      });
      if (!ok) return res.status(404).json({ error: 'Plan overhead allocation not found' });
      res.json({ success: true });
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to remove plan overhead allocation:', e);
      res.status(500).json({ error: 'Failed to remove plan overhead allocation', details: e?.message });
    }
  });

  app.post(planRecalculateRoutes, async (req: any, res) => {
    try {
      const actor = req.user;
      const recalculated = await postgresService.recalculatePlanOverheads(req.params.planId, {
        id: actor?.id,
        name: actor?.name,
        role: actor?.role
      });
      res.json(recalculated);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to recalculate plan overheads:', e);
      res.status(500).json({ error: 'Failed to recalculate plan overheads', details: e?.message });
    }
  });

  // --- Overhead Audit Logs ---
  app.get(['/api/overhead-audit-logs', '/api/overhead/audit-logs'], async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getOverheadAuditLogs(opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to fetch overhead audit logs:', e);
      res.status(500).json({ error: 'Failed to fetch overhead audit logs', details: e?.message });
    }
  });

  // ============================================================================
  // REVENUE CATALOGUE, PLAN BOQ & HISTORICAL COMMERCIAL RATE TRACKING (TASK 3)
  // ============================================================================

  // --- Revenue Categories & Subcategories ---
  app.get('/api/revenue-categories', async (_req, res) => {
    try {
      const cats = await postgresService.getRevenueCategories();
      res.json(cats);
    } catch (e: any) {
      console.error('Failed to get revenue categories:', e);
      res.status(500).json({ error: 'Failed to fetch revenue categories', details: e?.message });
    }
  });

  app.post('/api/revenue-categories', async (req, res) => {
    try {
      if (!req.body?.name) {
        return res.status(400).json({ error: 'Category name is required' });
      }
      const created = await postgresService.createRevenueCategory(req.body);
      res.status(201).json(created);
    } catch (e: any) {
      console.error('Failed to create revenue category:', e);
      res.status(500).json({ error: 'Failed to create revenue category', details: e?.message });
    }
  });

  app.get('/api/revenue-subcategories', async (req, res) => {
    try {
      const categoryId = req.query.categoryId ? String(req.query.categoryId) : undefined;
      const subcats = await postgresService.getRevenueSubcategories(categoryId);
      res.json(subcats);
    } catch (e: any) {
      console.error('Failed to get revenue subcategories:', e);
      res.status(500).json({ error: 'Failed to fetch revenue subcategories', details: e?.message });
    }
  });

  app.post('/api/revenue-subcategories', async (req, res) => {
    try {
      if (!req.body?.name) {
        return res.status(400).json({ error: 'Subcategory name is required' });
      }
      const created = await postgresService.createRevenueSubcategory(req.body);
      res.status(201).json(created);
    } catch (e: any) {
      console.error('Failed to create revenue subcategory:', e);
      res.status(500).json({ error: 'Failed to create revenue subcategory', details: e?.message });
    }
  });

  app.delete('/api/revenue-categories/:id', async (req, res) => {
    try {
      await postgresService.deleteRevenueCategory(req.params.id);
      res.json({ success: true, message: 'Revenue category deleted successfully' });
    } catch (e: any) {
      console.error('Failed to delete revenue category:', e);
      res.status(500).json({ error: 'Failed to delete revenue category', details: e?.message });
    }
  });

  app.delete('/api/revenue-subcategories/:id', async (req, res) => {
    try {
      await postgresService.deleteRevenueSubcategory(req.params.id);
      res.json({ success: true, message: 'Revenue subcategory deleted successfully' });
    } catch (e: any) {
      console.error('Failed to delete revenue subcategory:', e);
      res.status(500).json({ error: 'Failed to delete revenue subcategory', details: e?.message });
    }
  });

  // --- Centralized Revenue Items Catalogue ---
  app.get('/api/revenue-items', async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getRevenueItemsPaginated(opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to get revenue catalogue items:', e);
      res.status(500).json({ error: 'Failed to fetch revenue catalogue items', details: e?.message });
    }
  });

  app.get('/api/revenue-items/:id', async (req, res) => {
    try {
      const item = await postgresService.getRevenueItemById(req.params.id);
      if (!item) {
        return res.status(404).json({ error: 'Revenue catalogue item not found' });
      }
      res.json(item);
    } catch (e: any) {
      console.error('Failed to get revenue catalogue item details:', e);
      res.status(500).json({ error: 'Failed to fetch revenue item details', details: e?.message });
    }
  });

  app.post('/api/revenue-items', async (req: any, res) => {
    try {
      const actor = req.user;
      const created = await postgresService.createRevenueItem(req.body, {
        id: actor?.id,
        name: actor?.name,
        role: actor?.role
      });
      res.status(201).json(created);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to create revenue item:', e);
      res.status(500).json({ error: 'Failed to create revenue catalogue item', details: e?.message });
    }
  });

  app.put('/api/revenue-items/:id', async (req: any, res) => {
    try {
      const actor = req.user;
      const updated = await postgresService.updateRevenueItem(req.params.id, req.body, {
        id: actor?.id,
        name: actor?.name,
        role: actor?.role
      });
      if (!updated) return res.status(404).json({ error: 'Revenue item not found' });
      res.json(updated);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to update revenue item:', e);
      res.status(500).json({ error: 'Failed to update revenue catalogue item', details: e?.message });
    }
  });

  app.delete('/api/revenue-items/:id', async (req: any, res) => {
    try {
      const actor = req.user;
      const ok = await postgresService.deleteRevenueItem(req.params.id, {
        id: actor?.id,
        name: actor?.name,
        role: actor?.role
      });
      if (!ok) return res.status(404).json({ error: 'Revenue item not found' });
      res.json({ success: true });
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to delete revenue item:', e);
      res.status(500).json({ error: 'Failed to delete revenue catalogue item', details: e?.message });
    }
  });

  app.get('/api/revenue-services', async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const services = await postgresService.getRevenueServices(opts);
      res.json(services);
    } catch (e: any) {
      console.error('Failed to get revenue services:', e);
      res.status(500).json({ error: 'Failed to fetch revenue services', details: e?.message });
    }
  });

  app.post('/api/revenue-items/:id/commit-price', async (req: any, res) => {
    try {
      const actor = req.user;
      const updated = await postgresService.commitRevenueItemPrice(req.params.id, req.body, actor);
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to commit revenue price revision:', e);
      res.status(500).json({ error: 'Failed to commit revenue price revision', details: e?.message });
    }
  });

  app.get('/api/revenue-items/:id/price-history', async (req, res) => {
    try {
      const history = await postgresService.getRevenueItemPriceHistory(req.params.id);
      res.json(history);
    } catch (e: any) {
      console.error('Failed to get revenue price history:', e);
      res.status(500).json({ error: 'Failed to fetch revenue price history', details: e?.message });
    }
  });

  // --- Plan BOQ Line Items ---
  const planBoqRoutes = [
    '/api/project-plans/:planId/boq-items',
    '/api/plans/:planId/boq-items'
  ];

  const planBoqItemRoutes = [
    '/api/project-plans/:planId/boq-items/:boqItemId',
    '/api/plans/:planId/boq-items/:boqItemId'
  ];

  app.get(planBoqRoutes, async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const items = await postgresService.getPlanBoqItems(req.params.planId, opts);
      res.json(items);
    } catch (e: any) {
      console.error('Failed to get plan BOQ items:', e);
      res.status(500).json({ error: 'Failed to fetch plan BOQ items', details: e?.message });
    }
  });

  app.get(planBoqItemRoutes, async (req, res) => {
    try {
      const item = await postgresService.getPlanBoqItemById(req.params.planId, req.params.boqItemId);
      if (!item) return res.status(404).json({ error: 'Plan BOQ item not found' });
      res.json(item);
    } catch (e: any) {
      console.error('Failed to get plan BOQ item details:', e);
      res.status(500).json({ error: 'Failed to fetch plan BOQ item details', details: e?.message });
    }
  });

  app.post(planBoqRoutes, async (req: any, res) => {
    try {
      const actor = req.user;
      const result = await postgresService.addRevenueItemToPlan(req.params.planId, req.body, {
        id: actor?.id,
        name: actor?.name,
        role: actor?.role
      });
      res.status(201).json(result);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to add BOQ item to plan:', e);
      res.status(500).json({ error: 'Failed to add BOQ item to plan', details: e?.message });
    }
  });

  app.put(planBoqItemRoutes, async (req: any, res) => {
    try {
      const actor = req.user;
      const result = await postgresService.updatePlanBoqItem(req.params.planId, req.params.boqItemId, req.body, {
        id: actor?.id,
        name: actor?.name,
        role: actor?.role
      });
      res.json(result);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to update plan BOQ item:', e);
      res.status(500).json({ error: 'Failed to update plan BOQ item', details: e?.message });
    }
  });

  app.delete(planBoqItemRoutes, async (req: any, res) => {
    try {
      const actor = req.user;
      const ok = await postgresService.deletePlanBoqItem(req.params.planId, req.params.boqItemId, {
        id: actor?.id,
        name: actor?.name,
        role: actor?.role
      });
      if (!ok) return res.status(404).json({ error: 'Plan BOQ item not found' });
      res.json({ success: true });
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to delete plan BOQ item:', e);
      res.status(500).json({ error: 'Failed to delete plan BOQ item', details: e?.message });
    }
  });

  // --- Make vs Buy & Subcontractor Manufacturing Analysis Routes (TASK 20) ---
  const makeVsBuyRoutes = [
    '/api/project-plans/:planId/make-vs-buy',
    '/api/plans/:planId/make-vs-buy'
  ];

  const makeVsBuyItemRoutes = [
    '/api/project-plans/:planId/make-vs-buy/:analysisId',
    '/api/plans/:planId/make-vs-buy/:analysisId'
  ];

  const makeVsBuyApplyRoutes = [
    '/api/project-plans/:planId/make-vs-buy/:analysisId/apply',
    '/api/plans/:planId/make-vs-buy/:analysisId/apply'
  ];

  app.get(makeVsBuyRoutes, async (req, res) => {
    try {
      const analyses = await postgresService.getPlanMakeVsBuyAnalyses(req.params.planId);
      res.json(analyses);
    } catch (e: any) {
      console.error('Failed to get Make-vs-Buy analyses:', e);
      res.status(500).json({ error: 'Failed to fetch Make-vs-Buy analyses', details: e?.message });
    }
  });

  app.get('/api/projects/:projectId/make-vs-buy', async (req, res) => {
    try {
      const analyses = await postgresService.getProjectMakeVsBuyAnalyses(req.params.projectId);
      res.json(analyses);
    } catch (e: any) {
      console.error('Failed to get project Make-vs-Buy analyses:', e);
      res.status(500).json({ error: 'Failed to fetch project Make-vs-Buy analyses', details: e?.message });
    }
  });

  app.post(makeVsBuyRoutes, async (req: any, res) => {
    try {
      const actor = req.user;
      const created = await postgresService.createPlanMakeVsBuyAnalysis(req.params.planId, req.body, actor);
      res.status(201).json(created);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to create Make-vs-Buy analysis:', e);
      res.status(500).json({ error: 'Failed to create Make-vs-Buy analysis', details: e?.message });
    }
  });

  app.put(makeVsBuyItemRoutes, async (req: any, res) => {
    try {
      const actor = req.user;
      const updated = await postgresService.updatePlanMakeVsBuyAnalysis(req.params.planId, req.params.analysisId, req.body, actor);
      res.json(updated);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to update Make-vs-Buy analysis:', e);
      res.status(500).json({ error: 'Failed to update Make-vs-Buy analysis', details: e?.message });
    }
  });

  app.delete(makeVsBuyItemRoutes, async (req: any, res) => {
    try {
      const ok = await postgresService.deletePlanMakeVsBuyAnalysis(req.params.planId, req.params.analysisId);
      if (!ok) return res.status(404).json({ error: 'Analysis not found' });
      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to delete Make-vs-Buy analysis:', e);
      res.status(500).json({ error: 'Failed to delete Make-vs-Buy analysis', details: e?.message });
    }
  });

  app.post(makeVsBuyApplyRoutes, async (req: any, res) => {
    try {
      const actor = req.user;
      const result = await postgresService.applyMakeVsBuyDecision(req.params.planId, req.params.analysisId, req.body, actor);
      res.json(result);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to apply Make-vs-Buy decision:', e);
      res.status(500).json({ error: 'Failed to apply Make-vs-Buy decision', details: e?.message });
    }
  });

  app.post('/api/project-plans/:planId/boq-items/:boqItemId/attach-subcontractor-charge', async (req: any, res) => {
    try {
      const actor = req.user;
      const updated = await postgresService.attachSubcontractorChargeToPlanItem(
        req.params.planId,
        req.params.boqItemId,
        req.body,
        actor
      );
      res.json(updated);
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('Failed to attach subcontractor charge:', e);
      res.status(500).json({ error: 'Failed to attach subcontractor charge', details: e?.message });
    }
  });

  // --- Historical Commercial Rate Tracking ---
  app.get(['/api/revenue-rate-history', '/api/revenue/rate-history'], async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getRevenueRateHistory(opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to fetch revenue rate history:', e);
      res.status(500).json({ error: 'Failed to fetch revenue rate history', details: e?.message });
    }
  });

  app.get('/api/revenue-items/:id/rate-history', async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getRevenueItemRateHistory(req.params.id, opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to fetch revenue item rate history:', e);
      res.status(500).json({ error: 'Failed to fetch revenue item rate history', details: e?.message });
    }
  });

  app.get('/api/projects/:projectId/commercial-history', async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getProjectCommercialHistory(req.params.projectId, opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to fetch project commercial history:', e);
      res.status(500).json({ error: 'Failed to fetch project commercial history', details: e?.message });
    }
  });

  app.get(['/api/project-plans/:planId/commercial-history', '/api/plans/:planId/commercial-history'], async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getPlanCommercialHistory(req.params.planId, opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to fetch plan commercial history:', e);
      res.status(500).json({ error: 'Failed to fetch plan commercial history', details: e?.message });
    }
  });

  // --- Competitors Registry API (Task: Product Competitor Comparison) ---
  app.get('/api/competitors', async (_req, res) => {
    try {
      const competitors = await postgresService.getCompetitors();
      res.json(competitors);
    } catch (e: any) {
      console.error('Failed to get competitors:', e);
      res.status(500).json({ error: 'Failed to fetch competitors', details: e?.message });
    }
  });

  app.post('/api/competitors', async (req, res) => {
    try {
      const created = await postgresService.createCompetitor(req.body);
      res.status(201).json(created);
    } catch (e: any) {
      console.error('Failed to create competitor:', e);
      res.status(500).json({ error: 'Failed to create competitor', details: e?.message });
    }
  });

  app.put('/api/competitors/:id', async (req, res) => {
    try {
      const updated = await postgresService.updateCompetitor(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Competitor not found' });
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to update competitor:', e);
      res.status(500).json({ error: 'Failed to update competitor', details: e?.message });
    }
  });

  app.delete('/api/competitors/:id', async (req, res) => {
    try {
      await postgresService.deleteCompetitor(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to delete competitor:', e);
      res.status(500).json({ error: 'Failed to delete competitor', details: e?.message });
    }
  });

  // --- Dedicated Competitor Table Endpoints (name, product/service association, pricing, timestamps) ---
  app.get(['/api/competitor', '/api/competitor-entries'], async (req, res) => {
    try {
      const { itemId, itemType, search } = req.query;
      const entries = await postgresService.getCompetitorEntries({
        itemId: itemId ? String(itemId) : undefined,
        itemType: itemType ? String(itemType) : undefined,
        search: search ? String(search) : undefined
      });
      res.json(entries);
    } catch (e: any) {
      console.error('Failed to get competitor entries:', e);
      res.status(500).json({ error: 'Failed to fetch competitor entries', details: e?.message });
    }
  });

  app.get('/api/competitor/benchmarks-map', async (_req, res) => {
    try {
      const map = await postgresService.getAllCompetitorBenchmarksMap();
      res.json(map);
    } catch (e: any) {
      console.error('Failed to get competitor benchmarks map:', e);
      res.status(500).json({ error: 'Failed to fetch competitor benchmarks map', details: e?.message });
    }
  });

  app.post(['/api/competitor', '/api/competitor-entries'], async (req: any, res) => {
    try {
      const actor = req.user;
      const created = await postgresService.createCompetitorEntry(req.body, actor);
      res.status(201).json(created);
    } catch (e: any) {
      console.error('Failed to create competitor entry:', e);
      res.status(500).json({ error: 'Failed to create competitor entry', details: e?.message });
    }
  });

  app.put(['/api/competitor/:id', '/api/competitor-entries/:id'], async (req: any, res) => {
    try {
      const actor = req.user;
      const updated = await postgresService.updateCompetitorEntry(req.params.id, req.body, actor);
      if (!updated) return res.status(404).json({ error: 'Competitor entry not found' });
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to update competitor entry:', e);
      res.status(500).json({ error: 'Failed to update competitor entry', details: e?.message });
    }
  });

  app.delete(['/api/competitor/:id', '/api/competitor-entries/:id'], async (req: any, res) => {
    try {
      const actor = req.user;
      await postgresService.deleteCompetitorEntry(req.params.id, actor);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to delete competitor entry:', e);
      res.status(500).json({ error: 'Failed to delete competitor entry', details: e?.message });
    }
  });

  // --- Product & Revenue Services Competitor Quotes & Matrix APIs ---
  const competitorQuotePaths = [
    '/api/products/:id/competitor-quotes',
    '/api/revenue-items/:id/competitor-quotes',
    '/api/produce/:id/competitor-quotes',
    '/api/resources/:id/competitor-quotes',
    '/api/overheads/:id/competitor-quotes',
    '/api/materials/:id/competitor-quotes'
  ];

  const competitorQuoteItemPaths = [
    '/api/products/:id/competitor-quotes/:quoteId',
    '/api/revenue-items/:id/competitor-quotes/:quoteId',
    '/api/produce/:id/competitor-quotes/:quoteId',
    '/api/resources/:id/competitor-quotes/:quoteId',
    '/api/overheads/:id/competitor-quotes/:quoteId',
    '/api/materials/:id/competitor-quotes/:quoteId'
  ];

  const competitorQuoteCommitPaths = [
    '/api/products/:id/competitor-quotes/:quoteId/commit-price',
    '/api/revenue-items/:id/competitor-quotes/:quoteId/commit-price',
    '/api/produce/:id/competitor-quotes/:quoteId/commit-price',
    '/api/resources/:id/competitor-quotes/:quoteId/commit-price',
    '/api/overheads/:id/competitor-quotes/:quoteId/commit-price',
    '/api/materials/:id/competitor-quotes/:quoteId/commit-price'
  ];

  const competitorHistoryPaths = [
    '/api/products/:id/competitor-history',
    '/api/revenue-items/:id/competitor-history',
    '/api/produce/:id/competitor-history',
    '/api/resources/:id/competitor-history',
    '/api/overheads/:id/competitor-history',
    '/api/materials/:id/competitor-history'
  ];

  app.get(competitorQuotePaths, async (req, res) => {
    try {
      const itemType = req.query.itemType ? String(req.query.itemType) : undefined;
      const quotes = await postgresService.getProductCompetitorQuotes(req.params.id, itemType);
      res.json(quotes);
    } catch (e: any) {
      console.error('Failed to fetch competitor quotes:', e);
      res.status(500).json({ error: 'Failed to fetch competitor quotes', details: e?.message });
    }
  });

  app.post(competitorQuotePaths, async (req: any, res) => {
    try {
      const actor = req.user;
      const created = await postgresService.createProductCompetitorQuote(req.params.id, req.body, actor);
      res.status(201).json(created);
    } catch (e: any) {
      console.error('Failed to create competitor quote:', e);
      res.status(500).json({ error: 'Failed to create competitor quote', details: e?.message });
    }
  });

  app.put(competitorQuoteItemPaths, async (req: any, res) => {
    try {
      const actor = req.user;
      const updated = await postgresService.updateProductCompetitorQuote(req.params.quoteId, req.body, actor);
      if (!updated) return res.status(404).json({ error: 'Competitor quote not found' });
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to update competitor quote:', e);
      res.status(500).json({ error: 'Failed to update competitor quote', details: e?.message });
    }
  });

  app.post(competitorQuoteCommitPaths, async (req: any, res) => {
    try {
      const actor = req.user;
      const updated = await postgresService.commitProductCompetitorPrice(req.params.id, req.params.quoteId, req.body, actor);
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to commit competitor price revision:', e);
      res.status(500).json({ error: 'Failed to commit competitor price revision', details: e?.message });
    }
  });

  app.delete(competitorQuoteItemPaths, async (req: any, res) => {
    try {
      const actor = req.user;
      const result = await postgresService.deleteProductCompetitorQuote(req.params.id, req.params.quoteId, actor);
      res.json(result);
    } catch (e: any) {
      console.error('Failed to delete competitor quote:', e);
      res.status(500).json({ error: 'Failed to delete competitor quote', details: e?.message });
    }
  });

  app.get(competitorHistoryPaths, async (req, res) => {
    try {
      const history = await postgresService.getProductCompetitorHistory(req.params.id);
      res.json(history);
    } catch (e: any) {
      console.error('Failed to fetch competitor history:', e);
      res.status(500).json({ error: 'Failed to fetch competitor history', details: e?.message });
    }
  });

  // --- Project Deliverables Relational API ---
  app.get('/api/projects/:projectId/deliverables', async (req, res) => {
    try {
      const deliverables = await postgresService.getProjectDeliverables(req.params.projectId);
      res.json(deliverables);
    } catch (e: any) {
      console.error('Failed to fetch project deliverables:', e);
      res.status(500).json({ error: 'Failed to fetch project deliverables', details: e?.message });
    }
  });

  app.post('/api/projects/:projectId/deliverables', async (req: any, res) => {
    try {
      const actor = req.user;
      const created = await postgresService.createProjectDeliverable(req.params.projectId, req.body, actor);
      res.status(201).json(created);
    } catch (e: any) {
      console.error('Failed to create project deliverable:', e);
      res.status(500).json({ error: 'Failed to create project deliverable', details: e?.message });
    }
  });

  app.put('/api/projects/:projectId/deliverables/:deliverableId', async (req: any, res) => {
    try {
      const actor = req.user;
      const updated = await postgresService.updateProjectDeliverable(req.params.projectId, req.params.deliverableId, req.body, actor);
      if (!updated) return res.status(404).json({ error: 'Deliverable not found' });
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to update project deliverable:', e);
      res.status(500).json({ error: 'Failed to update project deliverable', details: e?.message });
    }
  });

  app.delete('/api/projects/:projectId/deliverables/:deliverableId', async (req: any, res) => {
    try {
      const actor = req.user;
      const result = await postgresService.deleteProjectDeliverable(req.params.projectId, req.params.deliverableId, actor);
      res.json(result);
    } catch (e: any) {
      console.error('Failed to delete project deliverable:', e);
      res.status(500).json({ error: 'Failed to delete project deliverable', details: e?.message });
    }
  });

  // Calculate ad-hoc scenario with Python Analytics
  app.post('/api/analytics/calculate', (req, res) => {
    const results = runPythonAnalytics(req.body);
    res.json(results);
  });

  // ============================================================================
  // SYSTEM-WIDE BARCODE REGISTRY & SCANNING API (TASK 7)
  // ============================================================================
  app.get(['/api/barcodes/lookup', '/api/barcodes/lookup/:code'], async (req, res) => {
    try {
      const code = String(req.query.code || req.query.barcode || req.params.code || '').trim();
      if (!code) {
        return res.status(400).json({ found: false, error: 'Barcode or code query parameter is required.' });
      }
      const result = await postgresService.lookupBarcode(code);
      if (!result.found) {
        return res.status(404).json(result);
      }
      res.json(result);
    } catch (e: any) {
      console.error('Barcode lookup failed:', e);
      res.status(500).json({ error: 'Failed to lookup barcode', details: e?.message });
    }
  });

  app.get('/api/barcodes/search', async (req, res) => {
    try {
      const q = String(req.query.q || req.query.query || '').trim();
      const entityType = req.query.entityType ? String(req.query.entityType) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const offset = req.query.offset ? Number(req.query.offset) : 0;
      const results = await postgresService.searchBarcodes(q, { entityType, limit, offset });
      res.json(results);
    } catch (e: any) {
      console.error('Barcode search failed:', e);
      res.status(500).json({ error: 'Failed to search barcodes', details: e?.message });
    }
  });

  app.post('/api/barcodes/generate', async (req, res) => {
    try {
      const entityType = String(req.body?.entityType || 'material');
      const baseCode = req.body?.baseCode ? String(req.body.baseCode) : undefined;
      const barcode = await postgresService.generateUniqueBarcode(entityType, baseCode);
      res.json({ barcode, entityType });
    } catch (e: any) {
      console.error('Barcode generation failed:', e);
      res.status(500).json({ error: 'Failed to generate unique barcode', details: e?.message });
    }
  });

  app.post('/api/barcodes/register', async (req, res) => {
    try {
      const barcode = String(req.body?.barcode || '').trim().toUpperCase();
      if (!barcode) {
        return res.status(400).json({ error: 'Barcode is required.' });
      }
      await postgresService.registerBarcode(req.body);
      res.status(201).json({ success: true, barcode });
    } catch (e: any) {
      if (e?.status) return res.status(e.status).json({ error: e.message, conflictEntity: e.conflictEntity });
      console.error('Barcode registration failed:', e);
      res.status(500).json({ error: 'Failed to register barcode', details: e?.message });
    }
  });

  // --- Categories API (PostgreSQL inno_cost) ---
  app.get('/api/categories', async (req, res) => {
    try {
      const opts = extractListOptions(req.query);
      const result = await postgresService.getCategoriesPaginated(opts);
      return sendListResponse(res, result, opts.paginated);
    } catch (e: any) {
      console.error('Failed to get categories:', e);
      res.status(500).json({ error: 'Failed to fetch categories', details: e?.message });
    }
  });

  app.post('/api/categories', async (req, res) => {
    try {
      const newCat = await postgresService.createCategory(req.body);
      res.status(201).json(newCat);
    } catch (e: any) {
      console.error('Failed to create category:', e);
      res.status(500).json({ error: 'Failed to create category in PostgreSQL', details: e?.message });
    }
  });

  app.put('/api/categories/:id', async (req, res) => {
    try {
      const updated = await postgresService.updateCategory(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Category not found' });
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to update category:', e);
      res.status(500).json({ error: 'Failed to update category', details: e?.message });
    }
  });

  app.delete('/api/categories/:id', async (req, res) => {
    try {
      await postgresService.deleteCategory(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to delete category:', e);
      res.status(500).json({ error: 'Failed to delete category', details: e?.message });
    }
  });

  // --- Custom Tiles API (PostgreSQL inno_cost) ---
  app.get('/api/custom-tiles', async (_req, res) => {
    try {
      const tiles = await postgresService.getCustomTiles();
      res.json(tiles);
    } catch (e: any) {
      console.error('Failed to get custom tiles:', e);
      res.status(500).json({ error: 'Failed to get custom tiles', details: e?.message });
    }
  });

  app.post('/api/custom-tiles', async (req, res) => {
    try {
      const newTile = await postgresService.createCustomTile(req.body);
      res.status(201).json(newTile);
    } catch (e: any) {
      console.error('Failed to create custom tile:', e);
      res.status(500).json({ error: 'Failed to create custom tile in PostgreSQL', details: e?.message });
    }
  });

  app.put('/api/custom-tiles/:id', async (req, res) => {
    try {
      const updated = await postgresService.updateCustomTile(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Custom tile not found' });
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to update custom tile:', e);
      res.status(500).json({ error: 'Failed to update custom tile', details: e?.message });
    }
  });

  app.delete('/api/custom-tiles/:id', async (req, res) => {
    try {
      await postgresService.deleteCustomTile(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to delete custom tile:', e);
      res.status(500).json({ error: 'Failed to delete custom tile', details: e?.message });
    }
  });

  // --- Master Database Export & Import API (PostgreSQL inno_cost) ---
  app.get('/api/database/export', async (_req, res) => {
    try {
      const [
        clients, suppliers, materials, outsourced, subcontractors,
        produce, projects, projectPlans, inventory, transactions, categories,
        customTiles, companyDetails, auditLogs, priceHistory, accountRequests
      ] = await Promise.all([
        postgresService.getClients(),
        postgresService.getSuppliers(),
        postgresService.getMaterials(),
        postgresService.getOutsourced(),
        postgresService.getSubcontractors(),
        postgresService.getProduce(),
        postgresService.getProjects(),
        postgresService.getProjectPlans(),
        postgresService.getInventory(),
        postgresService.getTransactions(),
        postgresService.getCategories(),
        postgresService.getCustomTiles(),
        postgresService.getCompanyDetails(),
        postgresService.getAuditLogs(),
        postgresService.getPriceHistory().then((r) => r.data),
        postgresService.getAccountRequests()
      ]);

      res.setHeader('Content-Disposition', `attachment; filename=inno_cost_backup_${Date.now()}.json`);
      res.setHeader('Content-Type', 'application/json');
      res.json({
        system: 'Cost and Planning Database System',
        database: 'inno_cost (PostgreSQL)',
        version: '3.2.0',
        exportedAt: new Date().toISOString(),
        data: {
          clients, suppliers, materials, outsourced, subcontractors,
          produce, projects, projectPlans, inventory, transactions, categories,
          customTiles, companyDetails, auditLogs, priceHistory, accountRequests
        }
      });
    } catch (e: any) {
      console.error('Database export failed:', e);
      res.status(500).json({ error: 'Failed to export PostgreSQL database', details: e?.message });
    }
  });

  app.post('/api/database/import', async (req, res) => {
    try {
      const incoming = req.body;
      const data = incoming.data || incoming;
      if (Array.isArray(data.clients)) {
        for (const c of data.clients) await postgresService.createClient(c).catch(() => {});
      }
      if (Array.isArray(data.suppliers)) {
        for (const s of data.suppliers) await postgresService.createSupplier(s).catch(() => {});
      }
      if (Array.isArray(data.materials)) {
        for (const m of data.materials) await postgresService.createMaterial(m).catch(() => {});
      }
      if (Array.isArray(data.outsourced)) {
        for (const o of data.outsourced) await postgresService.createOutsourced(o).catch(() => {});
      }
      if (Array.isArray(data.subcontractors)) {
        for (const sub of data.subcontractors) await postgresService.createSubcontractor(sub).catch(() => {});
      }
      if (Array.isArray(data.produce)) {
        for (const p of data.produce) await postgresService.createProduce(p).catch(() => {});
      }
      if (Array.isArray(data.projects)) {
        for (const prj of data.projects) await postgresService.createProject(prj).catch(() => {});
      }
      if (Array.isArray(data.projectPlans)) {
        for (const pl of data.projectPlans) await postgresService.createProjectPlan(pl).catch(() => {});
      }
      if (Array.isArray(data.inventory)) {
        for (const inv of data.inventory) await postgresService.createInventory(inv).catch(() => {});
      }
      if (Array.isArray(data.transactions)) {
        for (const tx of data.transactions) await postgresService.createTransaction(tx).catch(() => {});
      }
      if (Array.isArray(data.categories)) {
        for (const cat of data.categories) await postgresService.createCategory(cat).catch(() => {});
      }
      if (Array.isArray(data.customTiles)) {
        for (const tile of data.customTiles) await postgresService.createCustomTile(tile).catch(() => {});
      }
      if (Array.isArray(data.accountRequests)) {
        for (const reqItem of data.accountRequests) await postgresService.createAccountRequest(reqItem).catch(() => {});
      }
      if (data.companyDetails) {
        await postgresService.updateCompanyDetails(data.companyDetails).catch(() => {});
      }
      res.json({ success: true, message: 'PostgreSQL database inno_cost successfully restored' });
    } catch (e: any) {
      console.error('Database import failed:', e);
      res.status(400).json({ error: 'Failed to import to PostgreSQL database', details: e?.message });
    }
  });



  // Clear/delete all dummy data from PostgreSQL database
  app.post(['/api/reset-data', '/api/database/clear-dummy-data'], async (_req, res) => {
    try {
      await postgresService.clearDummyData();
      res.json({ success: true, message: 'All dummy data permanently deleted from PostgreSQL database' });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to clear dummy data', details: e?.message });
    }
  });

  app.delete('/api/database/dummy-data', async (_req, res) => {
    try {
      await postgresService.clearDummyData();
      res.json({ success: true, message: 'All dummy data permanently deleted from PostgreSQL database' });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to delete dummy data', details: e?.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
