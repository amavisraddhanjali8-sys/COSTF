import {
  Project,
  Supplier,
  MaterialItem,
  OutsourcedService,
  SubcontractorRateItem as SubcontractorRate,
  ProduceItem,
  InventoryItem as InventoryRecord,
  CompanyDetails,
  AppUser as UserAccount,
  AccountRequest,
  AuditLogRecord as AuditLogEntry
} from '../types';
import { persistentDatabase } from './persistentDatabase';
import { saveStoredCompanyDetails } from '../data/userAndAuditData';
import { authFetch as fetch } from './http';

const API_BASE = '/api';

export interface ListQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  category?: string;
  status?: string;
  entityType?: string;
  entityId?: string;
  fromDate?: string;
  toDate?: string;
  paginated?: boolean;
}

export interface PaginatedApiResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function buildQueryString(params?: ListQueryParams, paginated?: boolean): string {
  const searchParams = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        searchParams.set(k, String(v));
      }
    }
  }
  if (paginated) {
    searchParams.set('paginated', 'true');
  }
  return searchParams.toString();
}

async function parseErrorResponse(res: Response, fallbackMsg: string): Promise<Error> {
  try {
    const errBody = await res.json();
    return new Error(errBody.error || errBody.details || fallbackMsg);
  } catch {
    return new Error(`${fallbackMsg} (HTTP ${res.status})`);
  }
}

export const api = {
  // --- Clients (PostgreSQL inno_cost) ---
  async getClients(params?: ListQueryParams): Promise<any[]> {
    const res = await fetch(`/api/clients?${buildQueryString(params)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch clients');
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.data || [];
    persistentDatabase.saveClients(list);
    return list;
  },

  async getClientsPaginated(params?: ListQueryParams): Promise<PaginatedApiResponse<any>> {
    const res = await fetch(`/api/clients?${buildQueryString(params, true)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch paginated clients');
    return await res.json();
  },

  async createClient(data: any): Promise<any> {
    const res = await fetch(`/api/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create client');
    const saved = await res.json();
    persistentDatabase.addClient(saved);
    return saved;
  },

  async updateClient(id: string, data: any): Promise<any> {
    const res = await fetch(`/api/clients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update client');
    const saved = await res.json();
    persistentDatabase.updateClient(id, saved);
    return saved;
  },

  async deleteClient(id: string): Promise<void> {
    const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete client');
    persistentDatabase.deleteClient(id);
  },

  // --- Categories (PostgreSQL inno_cost) ---
  async getCategories(params?: ListQueryParams): Promise<any[]> {
    const res = await fetch(`/api/categories?${buildQueryString(params)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch categories');
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.data || [];
    if (list.length > 0) persistentDatabase.saveCategories(list);
    return list;
  },

  async createCategory(data: any): Promise<any> {
    const res = await fetch(`/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create category');
    return await res.json();
  },

  async updateCategory(id: string, data: any): Promise<any> {
    const res = await fetch(`/api/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update category');
    return await res.json();
  },

  async deleteCategory(id: string): Promise<void> {
    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete category');
  },

  // --- Suppliers (PostgreSQL inno_cost) ---
  async getSuppliers(params?: ListQueryParams): Promise<Supplier[]> {
    const res = await fetch(`/api/suppliers?${buildQueryString(params)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch suppliers');
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.data || [];
    persistentDatabase.saveSuppliers(list);
    return list;
  },

  async getSuppliersPaginated(params?: ListQueryParams): Promise<PaginatedApiResponse<Supplier>> {
    const res = await fetch(`/api/suppliers?${buildQueryString(params, true)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch paginated suppliers');
    return await res.json();
  },

  async createSupplier(data: Partial<Supplier>): Promise<Supplier> {
    const res = await fetch(`/api/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create supplier');
    const saved = await res.json();
    persistentDatabase.addSupplier(saved);
    return saved;
  },

  async updateSupplier(id: string, data: Partial<Supplier>): Promise<Supplier> {
    const res = await fetch(`/api/suppliers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update supplier');
    const saved = await res.json();
    persistentDatabase.updateSupplier(id, saved);
    return saved;
  },

  async addSupplierContract(supplierId: string, contract: any): Promise<Supplier> {
    const res = await fetch(`/api/suppliers/${supplierId}/contracts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contract)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to add supplier contract');
    const saved = await res.json();
    persistentDatabase.updateSupplier(supplierId, saved);
    return saved;
  },

  async deleteSupplier(id: string): Promise<void> {
    const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete supplier');
    persistentDatabase.deleteSupplier(id);
  },

  // --- Materials (PostgreSQL inno_cost) ---
  async getMaterials(params?: ListQueryParams): Promise<MaterialItem[]> {
    const res = await fetch(`/api/materials?${buildQueryString(params)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch materials');
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.data || [];
    persistentDatabase.saveMaterials(list);
    return list;
  },

  async getMaterialsPaginated(params?: ListQueryParams): Promise<PaginatedApiResponse<MaterialItem>> {
    const res = await fetch(`/api/materials?${buildQueryString(params, true)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch paginated materials');
    return await res.json();
  },

  async createMaterial(data: Partial<MaterialItem>): Promise<MaterialItem> {
    const res = await fetch(`/api/materials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create material');
    const saved = await res.json();
    persistentDatabase.addMaterial(saved);
    return saved;
  },

  async updateMaterial(id: string, data: Partial<MaterialItem>): Promise<MaterialItem> {
    const res = await fetch(`/api/materials/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update material');
    const saved = await res.json();
    persistentDatabase.updateMaterial(id, saved);
    return saved;
  },

  async updateMaterialPrice(
    id: string,
    newPrice: number,
    reason: string,
    updatedBy?: string,
    volumePricing?: any[],
    effectiveDate?: string,
    idempotencyKey?: string
  ): Promise<MaterialItem> {
    const res = await fetch(`/api/materials/${id}/price-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPrice, reason, updatedBy, volumePricing, effectiveDate, idempotencyKey })
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update material price');
    const saved = await res.json();
    persistentDatabase.updateMaterial(id, saved);
    return saved;
  },

  async deleteMaterial(id: string): Promise<void> {
    const res = await fetch(`/api/materials/${id}`, { method: 'DELETE' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete material');
    persistentDatabase.deleteMaterial(id);
  },

  // --- Outsourced Services (PostgreSQL inno_cost) ---
  async getOutsourced(params?: ListQueryParams): Promise<OutsourcedService[]> {
    const res = await fetch(`/api/outsourced?${buildQueryString(params)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch outsourced services');
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.data || [];
    persistentDatabase.saveOutsourcedServices(list);
    return list;
  },

  async getOutsourcedServices(params?: ListQueryParams): Promise<OutsourcedService[]> {
    return this.getOutsourced(params);
  },

  async getOutsourcedPaginated(params?: ListQueryParams): Promise<PaginatedApiResponse<OutsourcedService>> {
    const res = await fetch(`/api/outsourced?${buildQueryString(params, true)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch paginated outsourced services');
    return await res.json();
  },

  async createOutsourced(data: Partial<OutsourcedService>): Promise<OutsourcedService> {
    const res = await fetch(`/api/outsourced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create outsourced service');
    const saved = await res.json();
    persistentDatabase.addOutsourcedService(saved);
    return saved;
  },

  async createOutsourcedService(data: Partial<OutsourcedService>): Promise<OutsourcedService> {
    return this.createOutsourced(data);
  },

  async updateOutsourced(id: string, data: Partial<OutsourcedService>): Promise<OutsourcedService> {
    const res = await fetch(`/api/outsourced/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update outsourced service');
    const saved = await res.json();
    persistentDatabase.updateOutsourcedService(id, saved);
    return saved;
  },

  async updateOutsourcedService(id: string, data: Partial<OutsourcedService>): Promise<OutsourcedService> {
    return this.updateOutsourced(id, data);
  },

  async updateOutsourcedRate(
    id: string,
    newRate: number,
    reason: string,
    updatedBy?: string,
    tierRates?: any[],
    retailPrice?: number,
    effectiveDate?: string,
    idempotencyKey?: string
  ): Promise<OutsourcedService> {
    const res = await fetch(`/api/outsourced/${id}/price-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newRate, reason, updatedBy, tierRates, retailPrice, effectiveDate, idempotencyKey })
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update outsourced rate');
    const saved = await res.json();
    persistentDatabase.updateOutsourcedService(id, saved);
    return saved;
  },

  async deleteOutsourced(id: string): Promise<void> {
    const res = await fetch(`/api/outsourced/${id}`, { method: 'DELETE' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete outsourced service');
    persistentDatabase.deleteOutsourcedService(id);
  },

  async deleteOutsourcedService(id: string): Promise<void> {
    return this.deleteOutsourced(id);
  },

  // --- Subcontractors (PostgreSQL inno_cost) ---
  async getSubcontractors(params?: ListQueryParams): Promise<SubcontractorRate[]> {
    const res = await fetch(`/api/subcontractors?${buildQueryString(params)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch subcontractors');
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.data || [];
    persistentDatabase.saveSubcontractors(list);
    return list;
  },

  async getSubcontractorsPaginated(params?: ListQueryParams): Promise<PaginatedApiResponse<SubcontractorRate>> {
    const res = await fetch(`/api/subcontractors?${buildQueryString(params, true)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch paginated subcontractors');
    return await res.json();
  },

  async createSubcontractor(data: Partial<SubcontractorRate>): Promise<SubcontractorRate> {
    const res = await fetch(`/api/subcontractors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create subcontractor');
    const saved = await res.json();
    persistentDatabase.addSubcontractor(saved);
    return saved;
  },

  async updateSubcontractor(id: string, data: Partial<SubcontractorRate>): Promise<SubcontractorRate> {
    const res = await fetch(`/api/subcontractors/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update subcontractor');
    const saved = await res.json();
    persistentDatabase.updateSubcontractor(id, saved);
    return saved;
  },

  async updateSubcontractorRate(
    id: string,
    newBaseRate: number,
    changeReason: string,
    updatedBy?: string,
    newRetailRate?: number,
    fullContractEstimate?: number,
    bulkPricingRanges?: any[],
    effectiveDate?: string,
    idempotencyKey?: string
  ): Promise<SubcontractorRate> {
    const res = await fetch(`/api/subcontractors/${id}/rate-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newBaseRate,
        changeReason,
        updatedBy,
        newRetailRate,
        fullContractEstimate,
        bulkPricingRanges,
        effectiveDate,
        idempotencyKey
      })
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update subcontractor rate');
    const saved = await res.json();
    persistentDatabase.updateSubcontractor(id, saved);
    return saved;
  },

  async deleteSubcontractor(id: string): Promise<void> {
    const res = await fetch(`/api/subcontractors/${id}`, { method: 'DELETE' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete subcontractor');
    persistentDatabase.deleteSubcontractor(id);
  },

  // --- Produce Catalog (PostgreSQL inno_cost) ---
  async getProduce(params?: ListQueryParams): Promise<ProduceItem[]> {
    const res = await fetch(`/api/produce?${buildQueryString(params)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch produce items');
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.data || [];
    persistentDatabase.saveProduceItems(list);
    return list;
  },

  async getProduceItems(params?: ListQueryParams): Promise<ProduceItem[]> {
    return this.getProduce(params);
  },

  async getProducePaginated(params?: ListQueryParams): Promise<PaginatedApiResponse<ProduceItem>> {
    const res = await fetch(`/api/produce?${buildQueryString(params, true)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch paginated produce items');
    return await res.json();
  },

  async createProduce(data: Partial<ProduceItem>): Promise<ProduceItem> {
    const res = await fetch(`/api/produce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create produce item');
    const saved = await res.json();
    persistentDatabase.addProduceItem(saved);
    return saved;
  },

  async createProduceItem(data: Partial<ProduceItem>): Promise<ProduceItem> {
    return this.createProduce(data);
  },

  async updateProduce(id: string, data: Partial<ProduceItem>): Promise<ProduceItem> {
    const res = await fetch(`/api/produce/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update produce item');
    const saved = await res.json();
    persistentDatabase.updateProduceItem(id, saved);
    return saved;
  },

  async updateProduceItem(id: string, data: Partial<ProduceItem>): Promise<ProduceItem> {
    return this.updateProduce(id, data);
  },

  async updateProducePrice(
    id: string,
    newPrice: number,
    reason: string,
    updatedBy?: string,
    bundlesAndRanges?: any[],
    effectiveDate?: string,
    idempotencyKey?: string
  ): Promise<ProduceItem> {
    const res = await fetch(`/api/produce/${id}/price-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPrice, reason, updatedBy, bundlesAndRanges, effectiveDate, idempotencyKey })
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update produce price');
    const saved = await res.json();
    persistentDatabase.updateProduceItem(id, saved);
    return saved;
  },

  async updateProduceItemPrice(
    id: string,
    newPrice: number,
    reason: string,
    updatedBy?: string,
    bundlesAndRanges?: any[],
    effectiveDate?: string,
    idempotencyKey?: string
  ): Promise<ProduceItem> {
    return this.updateProducePrice(id, newPrice, reason, updatedBy, bundlesAndRanges, effectiveDate, idempotencyKey);
  },

  async deleteProduce(id: string): Promise<void> {
    const res = await fetch(`/api/produce/${id}`, { method: 'DELETE' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete produce item');
    persistentDatabase.deleteProduceItem(id);
  },

  async deleteProduceItem(id: string): Promise<void> {
    return this.deleteProduce(id);
  },

  // --- Price History Records (PostgreSQL inno_cost) ---
  async getPriceHistory(params?: ListQueryParams): Promise<any[]> {
    const res = await fetch(`/api/price-history?${buildQueryString(params)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch price history');
    const data = await res.json();
    return Array.isArray(data) ? data : data.data || [];
  },

  async getPriceHistoryPaginated(params?: ListQueryParams): Promise<PaginatedApiResponse<any>> {
    const res = await fetch(`/api/price-history?${buildQueryString(params, true)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch paginated price history');
    return await res.json();
  },

  // --- Inventory (PostgreSQL inno_cost) ---
  async getInventory(params?: ListQueryParams): Promise<InventoryRecord[]> {
    const res = await fetch(`/api/inventory?${buildQueryString(params)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch inventory');
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.data || [];
    persistentDatabase.saveInventory(list);
    return list;
  },

  async getInventoryPaginated(params?: ListQueryParams): Promise<PaginatedApiResponse<InventoryRecord>> {
    const res = await fetch(`/api/inventory?${buildQueryString(params, true)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch paginated inventory');
    return await res.json();
  },

  async createInventory(data: Partial<InventoryRecord>): Promise<InventoryRecord> {
    const res = await fetch(`/api/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create inventory record');
    const saved = await res.json();
    persistentDatabase.saveInventory([saved, ...persistentDatabase.getInventory().filter((i) => i.id !== saved.id)]);
    return saved;
  },

  async createInventoryItem(data: Partial<InventoryRecord>): Promise<InventoryRecord> {
    return this.createInventory(data);
  },

  async updateInventory(id: string, data: Partial<InventoryRecord>): Promise<InventoryRecord> {
    const res = await fetch(`/api/inventory/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update inventory record');
    const saved = await res.json();
    persistentDatabase.saveInventory(persistentDatabase.getInventory().map((i) => (i.id === id ? saved : i)));
    return saved;
  },

  async updateInventoryItem(id: string, data: Partial<InventoryRecord>): Promise<InventoryRecord> {
    return this.updateInventory(id, data);
  },

  async deleteInventory(id: string): Promise<void> {
    const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete inventory record');
    persistentDatabase.saveInventory(persistentDatabase.getInventory().filter((i) => i.id !== id));
  },

  async deleteInventoryItem(id: string): Promise<void> {
    return this.deleteInventory(id);
  },

  // --- Inventory Transactions (PostgreSQL inno_cost) ---
  async getTransactions(params?: ListQueryParams): Promise<any[]> {
    const res = await fetch(`/api/inventory/transactions?${buildQueryString(params)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch inventory transactions');
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.data || [];
    persistentDatabase.saveTransactions(list);
    return list;
  },

  async getTransactionsPaginated(params?: ListQueryParams): Promise<PaginatedApiResponse<any>> {
    const res = await fetch(`/api/inventory/transactions?${buildQueryString(params, true)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch paginated inventory transactions');
    return await res.json();
  },

  async createTransaction(data: any): Promise<any> {
    const res = await fetch(`/api/inventory/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to record inventory transaction');
    return await res.json();
  },

  async updateTransaction(id: string, data: any): Promise<any> {
    const res = await fetch(`/api/inventory/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update inventory transaction');
    return await res.json();
  },

  async deleteTransaction(id: string): Promise<void> {
    const res = await fetch(`/api/inventory/transactions/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete inventory transaction');
  },

  // --- Audit Logs (PostgreSQL inno_cost) ---
  async getAuditLogs(params?: ListQueryParams): Promise<AuditLogEntry[]> {
    const res = await fetch(`/api/audit-logs?${buildQueryString(params)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch audit logs');
    const data = await res.json();
    return Array.isArray(data) ? data : data.data || [];
  },

  async getAuditLogsPaginated(params?: ListQueryParams): Promise<PaginatedApiResponse<AuditLogEntry>> {
    const res = await fetch(`/api/audit-logs?${buildQueryString(params, true)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch paginated audit logs');
    return await res.json();
  },

  async createAuditLog(data: Partial<AuditLogEntry>): Promise<AuditLogEntry> {
    const res = await fetch(`/api/audit-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create audit log');
    return await res.json();
  },

  // --- Projects & Profitability (PostgreSQL inno_cost) ---
  async getProjects(params?: ListQueryParams): Promise<Project[]> {
    const res = await fetch(`/api/projects?${buildQueryString(params)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch projects');
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.data || [];
    persistentDatabase.saveProjects(list);
    return list;
  },

  async getProjectsPaginated(params?: ListQueryParams): Promise<PaginatedApiResponse<Project>> {
    const res = await fetch(`/api/projects?${buildQueryString(params, true)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch paginated projects');
    return await res.json();
  },

  async getProject(id: string): Promise<Project> {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch project');
    return await res.json();
  },

  async createProject(data: Partial<Project>): Promise<Project> {
    const res = await fetch(`/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create project');
    const saved = await res.json();
    persistentDatabase.addProject(saved);
    return saved;
  },

  async updateProject(id: string, data: Partial<Project>): Promise<Project> {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update project');
    const saved = await res.json();
    persistentDatabase.updateProject(id, saved);
    return saved;
  },

  async deleteProject(id: string): Promise<void> {
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete project');
    persistentDatabase.deleteProject(id);
  },

  async calculateAnalytics(projectData: Partial<Project>): Promise<any> {
    const res = await fetch(`/api/analytics/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectData)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to calculate project analytics');
    return await res.json();
  },

  async calculateProjectProfitability(projectData: Partial<Project>): Promise<any> {
    return this.calculateAnalytics(projectData);
  },

  // --- Company Details (PostgreSQL inno_cost) ---
  async getCompanyDetails(): Promise<CompanyDetails> {
    const res = await fetch(`/api/company-details`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch company details');
    const data = await res.json();
    saveStoredCompanyDetails(data);
    return data;
  },

  async updateCompanyDetails(data: CompanyDetails): Promise<CompanyDetails> {
    const res = await fetch(`/api/company-details`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update company details');
    const saved = await res.json();
    saveStoredCompanyDetails(saved);
    return saved;
  },

  // --- Users & Account Requests (PostgreSQL inno_cost) ---
  async getUsers(): Promise<UserAccount[]> {
    const res = await fetch(`/api/users`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch users');
    return await res.json();
  },

  async createUser(data: Partial<UserAccount> & { password?: string }): Promise<UserAccount> {
    const res = await fetch(`/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create user');
    return await res.json();
  },

  async updateUser(id: string, data: Partial<UserAccount> & { password?: string }): Promise<UserAccount> {
    const res = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update user');
    return await res.json();
  },

  async deleteUser(id: string): Promise<void> {
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete user');
  },

  async getAccountRequests(): Promise<AccountRequest[]> {
    const res = await fetch(`/api/account-requests`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch account requests');
    return await res.json();
  },

  async createAccountRequest(data: Partial<AccountRequest>): Promise<AccountRequest> {
    const res = await fetch(`/api/account-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to submit account request');
    return await res.json();
  },

  async updateAccountRequestStatus(id: string, status: 'Approved' | 'Rejected'): Promise<AccountRequest> {
    const res = await fetch(`/api/account-requests/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update account request status');
    return await res.json();
  },

  // --- Image Upload (PostgreSQL Media Assets) ---
  async uploadImage(dataUrlOrUrl: string, filename: string = 'image.png', mimeType: string = 'image/png'): Promise<{ id: string; url: string }> {
    const isDataUrl = dataUrlOrUrl.startsWith('data:');
    const res = await fetch(`/api/upload-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename,
        mimeType,
        dataUrl: isDataUrl ? dataUrlOrUrl : undefined,
        url: !isDataUrl ? dataUrlOrUrl : undefined
      })
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to upload image');
    return await res.json();
  },

  // --- Custom Tiles (PostgreSQL inno_cost) ---
  async getCustomTiles(): Promise<any[]> {
    const res = await fetch(`/api/custom-tiles`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch custom tiles');
    const data = await res.json();
    persistentDatabase.saveCustomTiles(data);
    return data;
  },

  async createCustomTile(data: any): Promise<any> {
    const res = await fetch(`/api/custom-tiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create custom tile');
    const saved = await res.json();
    persistentDatabase.saveCustomTiles([saved, ...persistentDatabase.getCustomTiles().filter((t) => t.id !== saved.id)]);
    return saved;
  },

  async updateCustomTile(id: string, data: any): Promise<any> {
    const res = await fetch(`/api/custom-tiles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update custom tile');
    const saved = await res.json();
    persistentDatabase.saveCustomTiles(persistentDatabase.getCustomTiles().map((t) => (t.id === id ? saved : t)));
    return saved;
  },

  async deleteCustomTile(id: string): Promise<void> {
    const res = await fetch(`/api/custom-tiles/${id}`, { method: 'DELETE' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete custom tile');
    persistentDatabase.saveCustomTiles(persistentDatabase.getCustomTiles().filter((t) => t.id !== id));
  },

  // --- Database Export, Import, Migrations & Status (PostgreSQL inno_cost) ---
  async getDatabaseStatus(): Promise<any> {
    const res = await fetch(`/api/database/status`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch database status');
    return await res.json();
  },

  async getMigrations(): Promise<any[]> {
    const res = await fetch(`/api/database/migrations`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch migrations');
    return await res.json();
  },

  async exportDatabase(): Promise<any> {
    const res = await fetch(`/api/database/export`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to export database');
    return await res.json();
  },

  async importDatabase(backupJson: any): Promise<any> {
    const res = await fetch(`/api/database/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backupJson)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to import database');
    return await res.json();
  },

  async resetData(): Promise<void> {
    const res = await fetch(`/api/database/clear-dummy-data`, { method: 'POST' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to clear dummy data');
  },

  async resetAllData(): Promise<boolean> {
    await this.resetData();
    return true;
  },

  // --- Load All Enterprise Entities from PostgreSQL ---
  async loadAll() {
    const [
      projects,
      materials,
      produce,
      suppliers,
      outsourced,
      subcontractors,
      inventory,
      clients,
      categories,
      company,
      transactions,
      customTiles,
      users,
      auditLogs,
      accountRequests
    ] = await Promise.all([
      this.getProjects(),
      this.getMaterials(),
      this.getProduce(),
      this.getSuppliers(),
      this.getOutsourced(),
      this.getSubcontractors(),
      this.getInventory(),
      this.getClients(),
      this.getCategories(),
      this.getCompanyDetails(),
      this.getTransactions(),
      this.getCustomTiles(),
      this.getUsers().catch(() => null),
      this.getAuditLogs().catch(() => null),
      this.getAccountRequests().catch(() => null)
    ]);
    return {
      projects,
      materials,
      produce,
      suppliers,
      outsourced,
      subcontractors,
      inventory,
      clients,
      categories,
      company,
      transactions,
      customTiles,
      users,
      auditLogs,
      accountRequests
    };
  }
};
