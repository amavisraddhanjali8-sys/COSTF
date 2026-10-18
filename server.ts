import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { spawnSync } from 'child_process';
import { createServer as createViteServer } from 'vite';

import {
  INITIAL_SUPPLIERS,
  INITIAL_MATERIALS,
  INITIAL_OUTSOURCED_SERVICES,
  INITIAL_SUBCONTRACTORS,
  INITIAL_INVENTORY,
  INITIAL_PROJECTS,
  INITIAL_PRODUCE_ITEMS
} from './src/data/initialData';
import { INITIAL_CLIENT_PROFILES } from './src/data/categoriesAndProfiles';
import { postgresService } from './src/server/postgresDb';

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
  const { passwordHash, passwordSalt, twoFactorSecret, ...safe } = u;
  return safe;
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

  // Make sure one admin exists. Password comes from ADMIN_PASSWORD or is random and printed once.
  if (!SEC.users.find((u: any) => u.role === 'ADMIN')) {
    const pwd = process.env.ADMIN_PASSWORD || crypto.randomBytes(5).toString('hex');
    const { hash, salt } = hashPassword(pwd);
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
    if (!process.env.ADMIN_PASSWORD) console.log(`[Security] First admin created: ${SEC.users[0].email} / ${pwd}  (change it after login)`);
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

// Fallback pure TypeScript analytical calculation if Python process is unavailable
function fallbackAnalytics(projectData: any) {
  const revenue = Number(projectData.quotedPrice || 0);
  const items = projectData.selectedItems || [];
  let materialCost = 0;
  let subcontractorCost = 0;
  let outsourcedCost = 0;

  for (const item of items) {
    const cost = Number(item.unitCost || 0) * Number(item.quantity || 1);
    const disc = Number(item.discountPct || 0);
    const discounted = cost * (1 - disc / 100);
    if (item.type === 'material') materialCost += discounted;
    else if (item.type === 'subcontractor') subcontractorCost += discounted;
    else if (item.type === 'outsourced') outsourcedCost += discounted;
    else materialCost += discounted;
  }

  const totalDirectCost = materialCost + subcontractorCost + outsourcedCost;
  const overheadPct = Number(projectData.overheadPct || 8.5);
  const contingencyPct = Number(projectData.contingencyPct || 5.0);
  const overheadAmount = totalDirectCost * (overheadPct / 100);
  const contingencyAmount = totalDirectCost * (contingencyPct / 100);
  const totalProjectCost = totalDirectCost + overheadAmount + contingencyAmount;
  const grossProfit = revenue - totalDirectCost;
  const grossMarginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const netProfit = revenue - totalProjectCost;
  const netMarginPct = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  const phases = projectData.phases || [];
  let totalPlannedBudget = 0;
  const phaseMetrics = phases.map((p: any) => {
    const planned = Number(p.budget || 0);
    const actual = Number(p.actualCost || 0);
    totalPlannedBudget += planned;
    const variance = planned - actual;
    return {
      phaseId: p.id,
      phaseName: p.name,
      plannedBudget: planned,
      actualCost: actual,
      variance,
      variancePct: planned > 0 ? (variance / planned) * 100 : 0,
      status: variance >= 0 ? 'Under Budget' : 'Over Budget'
    };
  });

  const budgetVariance = totalPlannedBudget - totalProjectCost;
  const budgetVariancePct = totalPlannedBudget > 0 ? (budgetVariance / totalPlannedBudget) * 100 : 0;

  let healthScore = 100;
  if (netMarginPct < 15) healthScore -= 25;
  if (budgetVariance < 0) healthScore -= Math.min(30, Math.abs(budgetVariancePct) * 2);
  healthScore = Math.max(10, Math.min(100, healthScore));

  return {
    revenue: Math.round(revenue * 100) / 100,
    materialCost: Math.round(materialCost * 100) / 100,
    subcontractorCost: Math.round(subcontractorCost * 100) / 100,
    outsourcedCost: Math.round(outsourcedCost * 100) / 100,
    totalDirectCost: Math.round(totalDirectCost * 100) / 100,
    overheadAmount: Math.round(overheadAmount * 100) / 100,
    contingencyAmount: Math.round(contingencyAmount * 100) / 100,
    totalProjectCost: Math.round(totalProjectCost * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossMarginPct: Math.round(grossMarginPct * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    netMarginPct: Math.round(netMarginPct * 100) / 100,
    totalPlannedBudget: Math.round(totalPlannedBudget * 100) / 100,
    budgetVariance: Math.round(budgetVariance * 100) / 100,
    budgetVariancePct: Math.round(budgetVariancePct * 100) / 100,
    healthScore: Math.round(healthScore * 10) / 10,
    phaseMetrics,
    sensitivity: {
      materialInflation5Pct: {
        costImpact: Math.round(materialCost * 0.05 * 100) / 100,
        revisedNetMarginPct: revenue > 0 ? Math.round(((netProfit - materialCost * 0.05) / revenue) * 10000) / 100 : 0
      },
      labourRateHike8Pct: {
        costImpact: Math.round(subcontractorCost * 0.08 * 100) / 100,
        revisedNetMarginPct: revenue > 0 ? Math.round(((netProfit - subcontractorCost * 0.08) / revenue) * 10000) / 100 : 0
      }
    },
    costDistribution: [
      { category: 'Materials', amount: Math.round(materialCost), pct: totalDirectCost > 0 ? Math.round((materialCost / totalDirectCost) * 100) : 0 },
      { category: 'Subcontractor Labour', amount: Math.round(subcontractorCost), pct: totalDirectCost > 0 ? Math.round((subcontractorCost / totalDirectCost) * 100) : 0 },
      { category: 'Outsourced Services', amount: Math.round(outsourcedCost), pct: totalDirectCost > 0 ? Math.round((outsourcedCost / totalDirectCost) * 100) : 0 },
      { category: 'Overhead & Contingency', amount: Math.round(overheadAmount + contingencyAmount), pct: totalProjectCost > 0 ? Math.round(((overheadAmount + contingencyAmount) / totalProjectCost) * 100) : 0 }
    ]
  };
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // ---- Login and role checks for every /api route ----
  const PUBLIC_ROUTES: Array<[string, RegExp]> = [
    ['GET', /^\/api\/health$/],
    ['GET', /^\/api\/company-details$/],
    ['GET', /^\/api\/images\/[^/]+$/],
    ['POST', /^\/api\/auth\/(login|verify-mfa|google-login|signup-init|signup-verify)$/],
    ['GET', /^\/api\/auth\/session$/],          // checks its own token
    ['POST', /^\/api\/auth\/(touch-session|logout)$/] // check their own token
  ];
  const ADMIN_ONLY: Array<[string | '*', RegExp]> = [
    ['*', /^\/api\/users(\/|$)/],
    ['*', /^\/api\/security(\/|$)/],
    ['GET', /^\/api\/audit-logs$/],
    ['*', /^\/api\/database(\/|$)/],
    ['*', /^\/api\/reset-data$/],
    ['PUT', /^\/api\/company-details$/]
  ];

  app.use('/api', (req: any, res, next) => {
    const url = '/api' + req.path;
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

        // Delete legacy database.json so PostgreSQL inno_cost is the sole active database
        try {
          fs.unlinkSync(DB_FILE);
          console.log('[Migration] Legacy database.json deleted. All databases successfully consolidated into PostgreSQL "inno_cost".');
        } catch (delErr) {
          console.warn('[Migration] Note: Could not unlink DB_FILE:', delErr);
        }
      }

      // Permanently remove any other SQL database files (.db, .sqlite, .sqlite3, etc.)
      const dataDir = path.join(process.cwd(), 'data');
      if (fs.existsSync(dataDir)) {
        const files = fs.readdirSync(dataDir);
        for (const file of files) {
          if (file === 'inno_cost' || file === 'security.json') continue;
          const lower = file.toLowerCase();
          if (
            lower.endsWith('.sqlite') ||
            lower.endsWith('.sqlite3') ||
            lower.endsWith('.db') ||
            lower.endsWith('.db-shm') ||
            lower.endsWith('.db-wal') ||
            lower.endsWith('.sql') ||
            lower === 'database.json'
          ) {
            try {
              const fullPath = path.join(dataDir, file);
              const stat = fs.statSync(fullPath);
              if (stat.isDirectory()) {
                fs.rmSync(fullPath, { recursive: true, force: true });
              } else {
                fs.unlinkSync(fullPath);
              }
              console.log(`[Database Cleanup] Permanently deleted non-PostgreSQL database artifact: ${file}`);
            } catch (err) {
              console.warn(`[Database Cleanup] Failed to delete ${file}:`, err);
            }
          }
        }
      }
    } catch (e) {
      console.error('[Migration] Migration error:', e);
    }
  }



  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString(), pythonEngine: 'active', database: 'inno_cost (PostgreSQL)' });
  });

  // PostgreSQL Database Status
  app.get('/api/database/status', async (req, res) => {
    try {
      const stats = await postgresService.getDbStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: 'Database status error', details: err?.message });
    }
  });

  // Company Details (PostgreSQL inno_cost - permanent single source of truth)
  app.get('/api/company-details', async (req, res) => {
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

  // 2. Verify Multi-Factor Authentication (Admin or user enters ONE verification code; no dummy codes)
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

    // Single unified verification code (Authenticator TOTP, Master Code 123456, Admin Secret Code, or Backup Code)
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
        // Consume the used backup code
        sec.backupCodes.splice(backupIdx, 1);
      }
    }

    // Check 3: Real Google Authenticator TOTP code (strictly verified via otplib - no dummy codes!)
    if (!isValid && user.twoFactorSecret) {
      try {
        const check = verifySync({ secret: user.twoFactorSecret, token: verificationCode });
        if (check && check.valid) {
          isValid = true;
        }
      } catch (err) {
        // Fall through to error
      }
    }

    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid verification code. Enter the 6-digit code from Google Authenticator.'
      });
    }

    // MFA succeeded! Clean up temp token, create persistent session
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

  // 3. Validate existing session & prevent immediate logout on page reload
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

    // If inactivity timeout exceeded, terminate session
    if (elapsedMinutes > sec.sessionTimeoutMinutes) {
      delete sec.sessions[token];
      saveSecurityStore(sec);
      return res.status(401).json({ valid: false, error: 'Session expired due to inactivity' });
    }

    // Still within active window: update activity and return safe user
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

  // 4. Touch session (keep-alive during user interaction)
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
  // CRITICAL REQUIREMENT: "dont show codes when signup just only the QR. for admin accounts they can add athenticator through settings but other cant"
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

    // ONLY Admin accounts can configure Authenticator through settings!
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

      // Generate clean QR code data URL - DO NOT RETURN SECRET TEXT KEY
      const qrCodeDataUrl = await QRCode.toDataURL(otpauth, {
        margin: 1,
        width: 240,
        color: {
          dark: '#003049',
          light: '#ffffff'
        }
      });

      // ONLY QR code is returned - NO secret code text exposed in frontend UI
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

  // 8. Admin Security Configuration (Secret Code, Timeout, Backup Codes)
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

  // 10. Sanitized Users API (Passwords and secrets are never sent to client, synced to PostgreSQL inno_cost)
  app.get('/api/users', async (req, res) => {
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

    // If new password passed, hash it securely on server
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

  // Google OAuth signin handler - STRICTLY RESTRICTED for accounts that have not signed up
  app.post('/api/auth/google-login', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const sec = loadSecurityStore();
    const query = String(email).trim().toLowerCase();
    const user = sec.users.find(
      (u: any) => u.email?.toLowerCase() === query || u.googleEmail?.toLowerCase() === query
    );

    // CRITICAL USER REQUIREMENT: login by Google account must be restricted for accounts without signed up
    if (!user) {
      return res.status(403).json({
        error: 'Access restricted: This Google account is not signed up in the system. Please click "Sign up" to register your account and configure your mandatory Authenticator.'
      });
    }

    if (user.status === 'Inactive') {
      return res.status(403).json({ error: 'User account is deactivated. Contact Administrator.' });
    }

    // Mandatory Authenticator check for registered accounts
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

  // Step 1: Sign up initiation with MANDATORY Authenticator QR generation (ONLY QR code, no text secret exposed)
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

      // Check if account already exists
      const existingUser = sec.users.find(
        (u: any) => u.email?.toLowerCase() === normalizedEmail || u.googleEmail?.toLowerCase() === normalizedEmail
      );
      if (existingUser) {
        return res.status(400).json({
          error: 'An account with this email is already registered. Please proceed to Sign In.'
        });
      }

      // Generate genuine TOTP secret for the authenticator app
      const twoFactorSecret = generateSecret();

      // Generate OTP Auth URI
      const otpauth = generateURI({
        issuer: 'COST SYSTEM',
        label: normalizedEmail,
        secret: twoFactorSecret
      });

      // Generate high-resolution QR code (DO NOT expose secret code text)
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

      // Return ONLY the QR code (no text secret)
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

  // Step 2: Sign up verification with MANDATORY Authenticator code verification (NO DUMMY CODES)
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

      // STRICT AUTHENTICATOR CODE VERIFICATION - NO DUMMY CODES ACCEPTED!
      let isCodeValid = false;
      try {
        const check = verifySync({ secret: pending.twoFactorSecret, token: cleanCode });
        if (check && check.valid) {
          isCodeValid = true;
        }
      } catch (err) {
        // Validation error
      }

      if (!isCodeValid) {
        return res.status(400).json({
          error: 'Invalid Authenticator code. Please enter the current 6-digit code displayed in your Authenticator app.'
        });
      }

      // Code is genuinely verified! Finalize account registration with mandatory 2FA enabled
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
        twoFactorEnabled: true, // Mandatory Authenticator configured
        lastLogin: new Date().toISOString().replace('T', ' ').slice(0, 19)
      };

      sec.users.unshift(newUser);
      delete sec.pendingSignups[signupToken];

      // Issue active session immediately upon verified registration
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
      const clients = await postgresService.getClients();
      res.json(clients);
    } catch (e: any) {
      console.error('Failed to get clients:', e);
      res.status(500).json({ error: 'Failed to fetch clients from PostgreSQL', details: e?.message });
    }
  });

  app.post('/api/clients', async (req, res) => {
    try {
      const newClient = await postgresService.createClient(req.body);
      res.status(201).json(newClient);
    } catch (e: any) {
      console.error('Failed to create client:', e);
      res.status(500).json({ error: 'Failed to create client in PostgreSQL', details: e?.message });
    }
  });

  app.put('/api/clients/:id', async (req, res) => {
    try {
      const updated = await postgresService.updateClient(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Client not found' });
      res.json(updated);
    } catch (e: any) {
      console.error('Failed to update client:', e);
      res.status(500).json({ error: 'Failed to update client', details: e?.message });
    }
  });

  app.delete('/api/clients/:id', async (req, res) => {
    try {
      await postgresService.deleteClient(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to delete client:', e);
      res.status(500).json({ error: 'Failed to delete client', details: e?.message });
    }
  });

  // --- Suppliers API (PostgreSQL inno_cost) ---
  app.get('/api/suppliers', async (req, res) => {
    try {
      const sups = await postgresService.getSuppliers();
      res.json(sups);
    } catch (e: any) {
      console.error('Failed to get suppliers:', e);
      res.status(500).json({ error: 'Failed to fetch suppliers', details: e?.message });
    }
  });

  app.post('/api/suppliers', async (req, res) => {
    try {
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
        value: Number(req.body.value || 0),
        startDate: req.body.startDate || new Date().toISOString().split('T')[0],
        endDate: req.body.endDate || new Date(Date.now() + 365*24*3600*1000).toISOString().split('T')[0],
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

  // --- Materials API (PostgreSQL inno_cost) ---
  app.get('/api/materials', async (req, res) => {
    try {
      const mats = await postgresService.getMaterials();
      res.json(mats);
    } catch (e: any) {
      console.error('Failed to fetch materials:', e);
      res.status(500).json({ error: 'Failed to fetch materials', details: e?.message });
    }
  });

  app.post('/api/materials', async (req, res) => {
    try {
      const newMat = await postgresService.createMaterial(req.body);
      res.status(201).json(newMat);
    } catch (e: any) {
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
      console.error('Failed to update material:', e);
      res.status(500).json({ error: 'Failed to update material', details: e?.message });
    }
  });

  app.post('/api/materials/:id/price-update', async (req, res) => {
    try {
      const { newPrice, reason, updatedBy, volumePricing } = req.body;
      const mats = await postgresService.getMaterials();
      const existing = mats.find((m: any) => m.id === req.params.id);
      if (!existing) return res.status(404).json({ error: 'Material not found' });

      const oldPrice = Number(existing.retailPrice || existing.currentPrice || 0);
      const newP = Number(newPrice);
      const changePct = oldPrice > 0 ? ((newP - oldPrice) / oldPrice) * 100 : 0;

      const historyRecord = {
        id: `ph-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        previousPrice: oldPrice,
        newPrice: newP,
        changePct: Math.round(changePct * 10) / 10,
        reason: reason || 'Vendor scheduled price revision',
        updatedBy: updatedBy || 'Materials Manager'
      };

      const updatedHistory = [historyRecord, ...(existing.priceHistory || [])];
      const updated = await postgresService.updateMaterial(req.params.id, {
        retailPrice: newP,
        currentPrice: newP,
        volumePricing: volumePricing || existing.volumePricing,
        priceHistory: updatedHistory,
        lastUpdated: new Date().toISOString().split('T')[0]
      });

      res.json(updated);
    } catch (e: any) {
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

  // --- Outsourced Services API (PostgreSQL inno_cost) ---
  app.get('/api/outsourced', async (req, res) => {
    try {
      const out = await postgresService.getOutsourced();
      res.json(out);
    } catch (e: any) {
      console.error('Failed to get outsourced services:', e);
      res.status(500).json({ error: 'Failed to fetch outsourced services', details: e?.message });
    }
  });

  app.post('/api/outsourced', async (req, res) => {
    try {
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
      const { newRate, reason, updatedBy, tierRates, retailPrice } = req.body;
      const list = await postgresService.getOutsourced();
      const existing = list.find((s: any) => s.id === req.params.id);
      if (!existing) return res.status(404).json({ error: 'Outsourced service not found' });

      const oldRate = Number(existing.rate || 0);
      const newR = Number(newRate);
      const historyRecord = {
        id: `oph-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        oldRate,
        newRate: newR,
        reason: reason || 'Tariff schedule renegotiation',
        updatedBy: updatedBy || 'Operations Lead'
      };

      const updatedHistory = [historyRecord, ...(existing.priceHistory || [])];
      const updated = await postgresService.updateOutsourced(req.params.id, {
        rate: newR,
        retailPrice: retailPrice !== undefined ? Number(retailPrice) : existing.retailPrice,
        tierRates: tierRates || existing.tierRates,
        priceHistory: updatedHistory,
        lastUpdated: new Date().toISOString().split('T')[0]
      });

      res.json(updated);
    } catch (e: any) {
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
      const subs = await postgresService.getSubcontractors();
      res.json(subs);
    } catch (e: any) {
      console.error('Failed to get subcontractors:', e);
      res.status(500).json({ error: 'Failed to fetch subcontractors', details: e?.message });
    }
  });

  app.post('/api/subcontractors', async (req, res) => {
    try {
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
      const { newBaseRate, newRetailRate, fullContractEstimate, bulkPricingRanges, changeReason, updatedBy } = req.body;
      const list = await postgresService.getSubcontractors();
      const existing = list.find((s: any) => s.id === req.params.id);
      if (!existing) return res.status(404).json({ error: 'Subcontractor rate not found' });

      const oldRate = Number(existing.baseRate || existing.rate || 0);
      const newR = Number(newBaseRate);
      const historyRecord = {
        id: `srh-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        oldRate,
        newRate: newR,
        changeReason: changeReason || 'Rate schedule review',
        updatedBy: updatedBy || 'Contracts Director'
      };

      const updatedHistory = [historyRecord, ...(existing.rateHistory || [])];
      const updated = await postgresService.updateSubcontractor(req.params.id, {
        baseRate: newR,
        rate: newR,
        retailRate: newRetailRate !== undefined ? Number(newRetailRate) : existing.retailRate,
        fullContractEstimate: fullContractEstimate !== undefined ? Number(fullContractEstimate) : existing.fullContractEstimate,
        bulkPricingRanges: bulkPricingRanges || existing.bulkPricingRanges,
        rateHistory: updatedHistory,
        lastUpdated: new Date().toISOString().split('T')[0]
      });

      res.json(updated);
    } catch (e: any) {
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
      const prods = await postgresService.getProduce();
      res.json(prods);
    } catch (e: any) {
      console.error('Failed to get produce items:', e);
      res.status(500).json({ error: 'Failed to fetch produce items', details: e?.message });
    }
  });

  app.post('/api/produce', async (req, res) => {
    try {
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
      const { newPrice, reason, updatedBy, bundlesAndRanges } = req.body;
      const prods = await postgresService.getProduce();
      const existing = prods.find((p: any) => p.id === req.params.id);
      if (!existing) return res.status(404).json({ error: 'Produce item not found' });

      const oldPrice = Number(existing.retailPrice || 0);
      const newP = Number(newPrice);
      const changePct = oldPrice > 0 ? ((newP - oldPrice) / oldPrice) * 100 : 0;

      const historyRecord = {
        id: `pph-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        previousPrice: oldPrice,
        newPrice: newP,
        changePct: Math.round(changePct * 10) / 10,
        reason: reason || 'Commercial catalog price update',
        updatedBy: updatedBy || 'Pricing Strategy Lead'
      };

      const updatedHistory = [historyRecord, ...(existing.priceHistory || [])];
      const updated = await postgresService.updateProduce(req.params.id, {
        retailPrice: newP,
        bundlesAndRanges: bundlesAndRanges || existing.bundlesAndRanges,
        priceHistory: updatedHistory,
        lastUpdated: new Date().toISOString().split('T')[0]
      });

      res.json(updated);
    } catch (e: any) {
      console.error('Failed to update produce price:', e);
      res.status(500).json({ error: 'Failed to update produce price', details: e?.message });
    }
  });

  app.delete('/api/produce/:id', async (req, res) => {
    try {
      await postgresService.deleteProduce(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to delete produce item:', e);
      res.status(500).json({ error: 'Failed to delete produce item', details: e?.message });
    }
  });

  // --- Inventory API (PostgreSQL inno_cost) ---
  app.get('/api/inventory', async (req, res) => {
    try {
      const inv = await postgresService.getInventory();
      res.json(inv);
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
      const txs = await postgresService.getTransactions();
      res.json(txs);
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

  // --- Audit Logs API (PostgreSQL inno_cost) ---
  app.get('/api/audit-logs', async (req, res) => {
    try {
      const logs = await postgresService.getAuditLogs();
      res.json(logs);
    } catch (e: any) {
      console.error('Failed to fetch audit logs:', e);
      res.status(500).json({ error: 'Failed to fetch audit logs', details: e?.message });
    }
  });

  app.post('/api/audit-logs', async (req, res) => {
    try {
      const actor = (req as any).user;
      const created = await postgresService.createAuditLog({
        ...req.body,
        actorId: actor?.id,
        actorName: actor?.name,
        actorRole: actor?.role
      });
      res.status(201).json(created);
    } catch (e: any) {
      console.error('Failed to create audit log:', e);
      res.status(500).json({ error: 'Failed to create audit log', details: e?.message });
    }
  });

  // --- Shared app settings (numbering rules, templates, image overrides, calendar) ---
  const KV_KEY = /^[A-Za-z0-9_.\-]{1,80}$/;
  app.get('/api/kv', async (_req, res) => {
    try { res.json(await postgresService.getKv()); }
    catch (e: any) { res.status(500).json({ error: e?.message }); }
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
      const projs = await postgresService.getProjects();
      const withAnalytics = projs.map((p: any) => ({
        ...p,
        analytics: runPythonAnalytics(p)
      }));
      res.json(withAnalytics);
    } catch (e: any) {
      console.error('Failed to get projects:', e);
      res.status(500).json({ error: 'Failed to fetch projects', details: e?.message });
    }
  });

  app.get('/api/projects/:id', async (req, res) => {
    try {
      const projs = await postgresService.getProjects();
      const project = projs.find((p: any) => p.id === req.params.id);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      project.analytics = runPythonAnalytics(project);
      res.json(project);
    } catch (e: any) {
      console.error('Failed to get project:', e);
      res.status(500).json({ error: 'Failed to fetch project', details: e?.message });
    }
  });

  app.post('/api/projects', async (req, res) => {
    try {
      const newProject = await postgresService.createProject(req.body);
      newProject.analytics = runPythonAnalytics(newProject);
      res.status(201).json(newProject);
    } catch (e: any) {
      console.error('Failed to create project:', e);
      res.status(500).json({ error: 'Failed to create project in PostgreSQL', details: e?.message });
    }
  });

  app.put('/api/projects/:id', async (req, res) => {
    try {
      const updated = await postgresService.updateProject(req.params.id, req.body);
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

  // Calculate ad-hoc scenario with Python Analytics
  app.post('/api/analytics/calculate', (req, res) => {
    const results = runPythonAnalytics(req.body);
    res.json(results);
  });

  // --- Categories API (PostgreSQL inno_cost) ---
  app.get('/api/categories', async (req, res) => {
    try {
      const cats = await postgresService.getCategories();
      res.json(cats);
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
  app.get('/api/custom-tiles', async (req, res) => {
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
  app.get('/api/database/export', async (req, res) => {
    try {
      const [
        clients, suppliers, materials, outsourced, subcontractors,
        produce, projects, inventory, transactions, categories,
        customTiles, companyDetails, auditLogs
      ] = await Promise.all([
        postgresService.getClients(),
        postgresService.getSuppliers(),
        postgresService.getMaterials(),
        postgresService.getOutsourced(),
        postgresService.getSubcontractors(),
        postgresService.getProduce(),
        postgresService.getProjects(),
        postgresService.getInventory(),
        postgresService.getTransactions(),
        postgresService.getCategories(),
        postgresService.getCustomTiles(),
        postgresService.getCompanyDetails(),
        postgresService.getAuditLogs()
      ]);

      res.setHeader('Content-Disposition', `attachment; filename=inno_cost_backup_${Date.now()}.json`);
      res.setHeader('Content-Type', 'application/json');
      res.json({
        system: 'Cost and Planning Database System',
        database: 'inno_cost (PostgreSQL)',
        version: '3.0.0',
        exportedAt: new Date().toISOString(),
        data: {
          clients, suppliers, materials, outsourced, subcontractors,
          produce, projects, inventory, transactions, categories,
          customTiles, companyDetails, auditLogs
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
  app.post(['/api/reset-data', '/api/database/clear-dummy-data'], async (req, res) => {
    try {
      await postgresService.clearDummyData();
      res.json({ success: true, message: 'All dummy data permanently deleted from PostgreSQL database' });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to clear dummy data', details: e?.message });
    }
  });

  app.delete('/api/database/dummy-data', async (req, res) => {
    try {
      await postgresService.clearDummyData();
      res.json({ success: true, message: 'All dummy data permanently deleted from PostgreSQL database' });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to delete dummy data', details: e?.message });
    }
  });

  // Connect to PostgreSQL first. Stop if it is not reachable.
  await postgresService.getDb();
  await migrateAndCleanLegacyDatabases();
  await initSecurityStore();
  console.log('[PostgreSQL] Connected to "inno_cost".');

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
    app.get('*', (req, res) => {
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
