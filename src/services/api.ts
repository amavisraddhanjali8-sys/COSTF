import {
  MaterialItem,
  OutsourcedService,
  Project,
  SubcontractorRateItem,
  Supplier,
  SupplierContract,
  InventoryItem,
  ProduceItem,
  AppUser,
  CompanyDetails,
  InventoryTransaction,
  AuditLogRecord
} from '../types';
import {
  INITIAL_SUPPLIERS,
  INITIAL_MATERIALS,
  INITIAL_OUTSOURCED_SERVICES,
  INITIAL_SUBCONTRACTORS,
  INITIAL_INVENTORY,
  INITIAL_PROJECTS,
  INITIAL_PRODUCE_ITEMS
} from '../data/initialData';
import { ClientProfile, INITIAL_CLIENT_PROFILES } from '../data/categoriesAndProfiles';
import { INITIAL_COMPANY_DETAILS, INITIAL_USERS, INITIAL_AUDIT_LOGS } from '../data/userAndAuditData';

// Helper for safe fetch with auto-retry and fallback
async function fetchWithFallback<T>(url: string, fallbackData: T, options?: RequestInit): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 250));
        continue;
      }
      console.warn(`API call to ${url} failed, using fallback:`, err);
      return fallbackData;
    }
  }
  return fallbackData;
}

// Read the JSON body. Throw the server message if the request failed.
async function readJson(res: Response): Promise<any> {
  let body: any = null;
  try { body = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    throw new Error((body && (body.error || body.message)) || `Request failed (${res.status})`);
  }
  return body;
}

// Same, for deletes
async function readOk(res: Response): Promise<boolean> {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { const b = await res.json(); msg = b.error || msg; } catch { /* no body */ }
    throw new Error(msg);
  }
  return true;
}

// Strict GET: throws instead of returning fake empty data
async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  return readJson(res);
}

export const api = {
  // Load every list the app needs. Throws if anything fails.
  loadAll: async () => {
    const [projects, materials, produce, suppliers, outsourced, subcontractors, inventory, clients, categories, company, users, transactions] = await Promise.all([
      getJson<any[]>('/api/projects'),
      getJson<any[]>('/api/materials'),
      getJson<any[]>('/api/produce'),
      getJson<any[]>('/api/suppliers'),
      getJson<any[]>('/api/outsourced'),
      getJson<any[]>('/api/subcontractors'),
      getJson<any[]>('/api/inventory'),
      getJson<any[]>('/api/clients'),
      getJson<any[]>('/api/categories'),
      getJson<any>('/api/company-details'),
      getJson<any[]>('/api/users').catch(() => null as any), // admin only
      getJson<any[]>('/api/inventory/transactions')
    ]);
    return { projects, materials, produce, suppliers, outsourced, subcontractors, inventory, clients, categories, company, users, transactions };
  },

  // Health
  checkHealth: async () => {
    return fetchWithFallback('/api/health', { status: 'ok', pythonEngine: 'active' });
  },

  // Suppliers
  getSuppliers: async (): Promise<Supplier[]> => {
    return fetchWithFallback('/api/suppliers', []);
  },
  createSupplier: async (data: Partial<Supplier>): Promise<Supplier> => {
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  updateSupplier: async (id: string, data: Partial<Supplier>): Promise<Supplier> => {
    try {
      const res = await fetch(`/api/suppliers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  addSupplierContract: async (supplierId: string, contract: Partial<SupplierContract>): Promise<Supplier> => {
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/contracts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contract)
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  deleteSupplier: async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' });
      return await readOk(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  // Produce Products & Services (Our Enterprise Supplied Catalog)
  getProduceItems: async (): Promise<ProduceItem[]> => {
    return fetchWithFallback('/api/produce', []);
  },
  createProduceItem: async (data: Partial<ProduceItem>): Promise<ProduceItem> => {
    try {
      const res = await fetch('/api/produce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  updateProduceItem: async (id: string, data: Partial<ProduceItem>): Promise<ProduceItem> => {
    try {
      const res = await fetch(`/api/produce/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  updateProduceItemPrice: async (id: string, newPrice: number, reason: string, updatedBy: string, bundlesAndRanges?: any[]): Promise<ProduceItem> => {
    try {
      const res = await fetch(`/api/produce/${id}/price-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPrice, reason, updatedBy, bundlesAndRanges })
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  deleteProduceItem: async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/produce/${id}`, { method: 'DELETE' });
      return await readOk(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  // Materials
  getMaterials: async (): Promise<MaterialItem[]> => {
    return fetchWithFallback('/api/materials', []);
  },
  createMaterial: async (data: Partial<MaterialItem>): Promise<MaterialItem> => {
    try {
      const res = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  updateMaterial: async (id: string, data: Partial<MaterialItem> & { priceChangeReason?: string; updatedBy?: string }): Promise<MaterialItem> => {
    try {
      const res = await fetch(`/api/materials/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  updateMaterialPrice: async (id: string, newPrice: number, reason: string, updatedBy: string, volumePricing?: any[]): Promise<MaterialItem> => {
    try {
      const res = await fetch(`/api/materials/${id}/price-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPrice, reason, updatedBy, volumePricing })
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  deleteMaterial: async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/materials/${id}`, { method: 'DELETE' });
      return await readOk(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  // Outsourced Services
  getOutsourcedServices: async (): Promise<OutsourcedService[]> => {
    return fetchWithFallback('/api/outsourced', []);
  },
  createOutsourcedService: async (data: Partial<OutsourcedService>): Promise<OutsourcedService> => {
    try {
      const res = await fetch('/api/outsourced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  updateOutsourcedService: async (id: string, data: Partial<OutsourcedService> & { priceChangeReason?: string; updatedBy?: string }): Promise<OutsourcedService> => {
    try {
      const res = await fetch(`/api/outsourced/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  deleteOutsourcedService: async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/outsourced/${id}`, { method: 'DELETE' });
      return await readOk(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  // Subcontractors
  getSubcontractors: async (): Promise<SubcontractorRateItem[]> => {
    return fetchWithFallback('/api/subcontractors', []);
  },
  createSubcontractor: async (data: Partial<SubcontractorRateItem>): Promise<SubcontractorRateItem> => {
    try {
      const res = await fetch('/api/subcontractors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  updateSubcontractor: async (id: string, data: Partial<SubcontractorRateItem> & { changeReason?: string; updatedBy?: string }): Promise<SubcontractorRateItem> => {
    try {
      const res = await fetch(`/api/subcontractors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  updateSubcontractorRate: async (
    id: string,
    newRate: number,
    reason: string,
    updatedBy: string,
    bulkPricingRanges?: any[],
    newRetailRate?: number,
    fullContractEstimate?: number
  ): Promise<SubcontractorRateItem> => {
    try {
      const res = await fetch(`/api/subcontractors/${id}/rate-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newBaseRate: newRate,
          changeReason: reason,
          updatedBy,
          bulkPricingRanges,
          newRetailRate,
          fullContractEstimate
        })
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  deleteSubcontractor: async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/subcontractors/${id}`, { method: 'DELETE' });
      return await readOk(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  updateOutsourcedRate: async (
    id: string,
    newRate: number,
    reason: string,
    updatedBy: string,
    tierRates?: any[],
    retailPrice?: number
  ): Promise<OutsourcedService> => {
    try {
      const res = await fetch(`/api/outsourced/${id}/price-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newRate,
          reason,
          updatedBy,
          tierRates,
          retailPrice
        })
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  // Inventory
  getInventory: async (): Promise<InventoryItem[]> => {
    return fetchWithFallback('/api/inventory', []);
  },
  createInventoryItem: async (data: Partial<InventoryItem>): Promise<InventoryItem> => {
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  updateInventory: async (id: string, data: Partial<InventoryItem>): Promise<InventoryItem> => {
    try {
      const res = await fetch(`/api/inventory/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  deleteInventoryItem: async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
      return await readOk(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  // Projects
  getProjects: async (): Promise<Project[]> => {
    return fetchWithFallback('/api/projects', []);
  },
  getProject: async (id: string): Promise<Project | null> => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  createProject: async (data: Partial<Project>): Promise<Project> => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  updateProject: async (id: string, data: Partial<Project>): Promise<Project> => {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  deleteProject: async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      return await readOk(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  // Python Analytics Engine Calculate
  calculateAnalytics: async (projectData: any) => {
    try {
      const res = await fetch('/api/analytics/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  calculateProjectProfitability: async (projectData: any) => {
    return api.calculateAnalytics(projectData);
  },

  resetDemoData: async () => {
    try {
      const res = await fetch('/api/reset-data', { method: 'POST' });
      return res.ok;
    } catch {
      return false;
    }
  },

  // Categories & Sub-Categories
  getCategories: async (): Promise<any[]> => {
    return fetchWithFallback('/api/categories', []);
  },
  createCategory: async (categoryData: any): Promise<any> => {
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryData)
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  updateCategory: async (id: string, categoryData: any): Promise<any> => {
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryData)
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  deleteCategory: async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      return await readOk(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  // Custom Hub Tiles
  getCustomTiles: async (): Promise<any[]> => {
    return fetchWithFallback('/api/custom-tiles', []);
  },
  createCustomTile: async (tileData: any): Promise<any> => {
    try {
      const res = await fetch('/api/custom-tiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tileData)
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  deleteCustomTile: async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/custom-tiles/${id}`, { method: 'DELETE' });
      return await readOk(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  // Database Export & Import
  exportDatabaseFromServer: async (): Promise<any> => {
    try {
      const res = await fetch('/api/database/export');
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  importDatabaseToServer: async (data: any): Promise<boolean> => {
    try {
      const res = await fetch('/api/database/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.ok;
    } catch (e) {
      console.error(e);
      return false;
    }
  },

  // Clients
  getClients: async (): Promise<ClientProfile[]> => {
    return fetchWithFallback('/api/clients', []);
  },
  createClient: async (data: Partial<ClientProfile>): Promise<ClientProfile> => {
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  updateClient: async (id: string, data: Partial<ClientProfile>): Promise<ClientProfile> => {
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  deleteClient: async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
      return await readOk(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  // Company Details
  getCompanyDetails: async (): Promise<CompanyDetails> => {
    return fetchWithFallback('/api/company-details', INITIAL_COMPANY_DETAILS);
  },
  updateCompanyDetails: async (data: Partial<CompanyDetails>): Promise<CompanyDetails> => {
    try {
      const res = await fetch('/api/company-details', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  // Users
  getUsers: async (): Promise<AppUser[]> => {
    return fetchWithFallback('/api/users', INITIAL_USERS);
  },
  createUser: async (data: Partial<AppUser>): Promise<AppUser> => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  updateUser: async (id: string, data: Partial<AppUser>): Promise<AppUser> => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  deleteUser: async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      return await readOk(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  // Inventory Transactions
  getTransactions: async (): Promise<InventoryTransaction[]> => {
    return fetchWithFallback('/api/inventory/transactions', []);
  },
  createTransaction: async (data: Partial<InventoryTransaction>): Promise<InventoryTransaction> => {
    try {
      const res = await fetch('/api/inventory/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  // Audit Logs
  getAuditLogs: async (): Promise<AuditLogRecord[]> => {
    return fetchWithFallback('/api/audit-logs', []);
  },
  createAuditLog: async (data: Partial<AuditLogRecord>): Promise<AuditLogRecord> => {
    try {
      const res = await fetch('/api/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await readJson(res);
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  // Media & Image Uploads (Stored in PostgreSQL inno_cost)
  uploadImage: async (dataUrlOrUrl: string, filename?: string): Promise<{ url: string; id: string }> => {
    try {
      const isDataUrl = dataUrlOrUrl.startsWith('data:');
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataUrl: isDataUrl ? dataUrlOrUrl : undefined,
          url: !isDataUrl ? dataUrlOrUrl : undefined,
          filename: filename || 'asset.png'
        })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.error('Image upload failed:', e);
    }
    return { url: dataUrlOrUrl, id: `img-${Date.now()}` };
  },

  // Database Connection Status
  getDbStatus: async () => {
    return fetchWithFallback('/api/database/status', {
      connected: true,
      engine: 'PostgreSQL (inno_cost)',
      database: 'inno_cost',
      tables: 15
    });
  }
};
