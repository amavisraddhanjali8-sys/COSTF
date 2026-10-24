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
  AuditLogRecord as AuditLogEntry,
  OverheadCategory,
  OverheadItem,
  PlanOverheadAllocation,
  OverheadAuditLog,
  RevenueItem,
  RevenueCategory,
  RevenueSubcategory,
  RevenueRateHistoryRecord,
  ProjectPlanBoqItem,
  ProcurementPriceRecord,
  PriceComparisonSummary,
  Tariff,
  TariffVersion,
  PlanTariff,
  MeasurementUnit,
  Competitor,
  CompetitorRecord,
  CompetitorBenchmarkSummary,
  ProductCompetitorQuote,
  ProductCompetitorPriceHistoryRecord,
  ProjectDeliverableItem,
  EnterpriseResource,
  ResourceAlternative
} from '../types';
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
  subCategory?: string;
  status?: string;
  entityType?: string;
  entityId?: string;
  supplierId?: string;
  materialId?: string;
  itemId?: string;
  itemType?: string;
  priceType?: string;
  costStage?: string;
  currency?: string;
  projectPlanId?: string;
  planId?: string;
  projectId?: string;
  actorId?: string;
  action?: string;
  actionType?: string;
  tariffId?: string;
  calculationMethod?: string;
  applicableBase?: string;
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
  async getInitialData(): Promise<any> {
    const [
      projects,
      materials,
      produce,
      suppliers,
      outsourced,
      subcontractors,
      inventory,
      transactions,
      categories,
      overheads,
      revenueItems,
      resources
    ] = await Promise.all([
      this.getProjects().catch(() => []),
      this.getMaterials().catch(() => []),
      this.getProduce().catch(() => []),
      this.getSuppliers().catch(() => []),
      this.getOutsourcedServices().catch(() => []),
      this.getSubcontractors().catch(() => []),
      this.getInventory().catch(() => []),
      this.getTransactions().catch(() => []),
      this.getCategories().catch(() => []),
      this.getOverheadItems().catch(() => []),
      this.getRevenueItemsList().catch(() => []),
      this.getResources().catch(() => [])
    ]);
    return {
      projects,
      materials,
      produce,
      suppliers,
      outsourced,
      outsourcedServices: outsourced,
      subcontractors,
      inventory,
      transactions,
      inventoryTransactions: transactions,
      categories,
      overheads,
      revenueItems,
      resources
    };
  },

  // --- Enterprise Resources Portal (PostgreSQL inno_cost) ---
  // Labours and charges, machineries, equipments, tools, materials, subcontractors
  async getResources(params?: ListQueryParams): Promise<EnterpriseResource[]> {
    const res = await fetch(`/api/resources?${buildQueryString(params)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch enterprise resources');
    const data = await res.json();
    return Array.isArray(data) ? data : data.data || [];
  },

  async getResourcesPaginated(params?: ListQueryParams): Promise<PaginatedApiResponse<EnterpriseResource>> {
    const res = await fetch(`/api/resources?${buildQueryString(params, true)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch paginated enterprise resources');
    return await res.json();
  },

  async getResourceById(id: string): Promise<EnterpriseResource> {
    const res = await fetch(`/api/resources/${id}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch resource');
    return await res.json();
  },

  async createResource(data: Partial<EnterpriseResource>): Promise<EnterpriseResource> {
    const res = await fetch(`/api/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create resource in PostgreSQL');
    return await res.json();
  },

  async updateResource(id: string, data: Partial<EnterpriseResource>): Promise<EnterpriseResource> {
    const res = await fetch(`/api/resources/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update resource in PostgreSQL');
    return await res.json();
  },

  async deleteResource(id: string): Promise<any> {
    const res = await fetch(`/api/resources/${id}`, { method: 'DELETE' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete resource');
    return await res.json();
  },

  async getResourcePriceHistory(resourceId: string): Promise<any[]> {
    const res = await fetch(`/api/resources/${encodeURIComponent(resourceId)}/price-history`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch resource price history');
    return await res.json();
  },

  async commitResourcePrice(resourceId: string, data: { newRate: number; reason?: string; effectiveDate?: string; updatedBy?: string; currency?: string }): Promise<EnterpriseResource> {
    const res = await fetch(`/api/resources/${encodeURIComponent(resourceId)}/commit-price`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to commit resource price');
    return await res.json();
  },

  async createPriceHistoryRecord(data: any): Promise<any> {
    const res = await fetch('/api/price-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create price history record');
    return await res.json();
  },

  async updatePriceHistoryRecord(id: string, data: { newPrice?: number; reason?: string; effectiveDate?: string; updatedBy?: string }): Promise<any> {
    const res = await fetch(`/api/price-history/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update price history record');
    return await res.json();
  },

  async deletePriceHistoryRecord(id: string): Promise<any> {
    const res = await fetch(`/api/price-history/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete price history record');
    return await res.json();
  },

  async addResourceAlternative(resourceId: string, altData: Partial<ResourceAlternative>): Promise<EnterpriseResource> {
    const res = await fetch(`/api/resources/${resourceId}/alternatives`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(altData)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to add alternative');
    return await res.json();
  },

  async applyResourceAlternative(resourceId: string, alternativeId: string, reason?: string, actor?: string): Promise<EnterpriseResource> {
    const res = await fetch(`/api/resources/${resourceId}/apply-alternative`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alternativeId, reason, actor })
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to apply alternative');
    return await res.json();
  },

  async allocateResourceToProject(
    resourceId: string,
    projectId: string,
    phaseId: string,
    quantity: number,
    unit?: string,
    unitCost?: number,
    planId?: string
  ): Promise<any> {
    const res = await fetch(`/api/resources/${resourceId}/allocate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, phaseId, quantity, unit, unitCost, planId })
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to allocate resource to project');
    return await res.json();
  },

  async getPlanCostSummary(planId: string): Promise<any> {
    const res = await fetch(`/api/project-plans/${encodeURIComponent(planId)}/cost-summary`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch plan cost summary');
    return await res.json();
  },

  async getPlanResources(planId: string): Promise<any[]> {
    const res = await fetch(`/api/project-plans/${encodeURIComponent(planId)}/resources`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch plan resources');
    return await res.json();
  },

  async addResourceToPlan(planId: string, data: any): Promise<any> {
    const res = await fetch(`/api/project-plans/${encodeURIComponent(planId)}/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to add resource to plan');
    return await res.json();
  },

  async updatePlanResource(planId: string, resourceId: string, data: any): Promise<any> {
    const res = await fetch(`/api/project-plans/${encodeURIComponent(planId)}/resources/${encodeURIComponent(resourceId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update plan resource');
    return await res.json();
  },

  async deletePlanResource(planId: string, resourceId: string): Promise<void> {
    const res = await fetch(`/api/project-plans/${encodeURIComponent(planId)}/resources/${encodeURIComponent(resourceId)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete plan resource');
  },

  // --- Clients (PostgreSQL inno_cost) ---
  async getClients(params?: ListQueryParams): Promise<any[]> {
    const res = await fetch(`/api/clients?${buildQueryString(params)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch clients');
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.data || [];
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
    return saved;
  },

  async getClientById(id: string): Promise<any> {
    const res = await fetch(`/api/clients/${id}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch client details');
    return await res.json();
  },

  async archiveClient(id: string): Promise<any> {
    const res = await fetch(`/api/clients/${id}/archive`, { method: 'POST' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to archive client');
    const updated = await res.json();
    return updated;
  },

  async deleteClient(id: string): Promise<any> {
    const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete client');
    const out = await res.json().catch(() => ({ success: true }));
    return out;
  },

  async getClientProjects(clientId: string): Promise<any[]> {
    const res = await fetch(`/api/clients/${clientId}/projects`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch client projects');
    return await res.json();
  },

  async getClientContacts(clientId: string): Promise<any[]> {
    const res = await fetch(`/api/clients/${clientId}/contacts`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch client contacts');
    return await res.json();
  },

  async createClientContact(clientId: string, data: any): Promise<any> {
    const res = await fetch(`/api/clients/${clientId}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create client contact');
    return await res.json();
  },

  async updateClientContact(clientId: string, contactId: string, data: any): Promise<any> {
    const res = await fetch(`/api/clients/${clientId}/contacts/${contactId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update client contact');
    return await res.json();
  },

  async deleteClientContact(clientId: string, contactId: string): Promise<void> {
    const res = await fetch(`/api/clients/${clientId}/contacts/${contactId}`, { method: 'DELETE' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete client contact');
  },

  async getProjectClients(projectId: string): Promise<any[]> {
    const res = await fetch(`/api/projects/${projectId}/clients`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch project clients');
    return await res.json();
  },

  async addProjectClient(projectId: string, data: any): Promise<any> {
    const res = await fetch(`/api/projects/${projectId}/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to add project client');
    return await res.json();
  },

  async removeProjectClient(projectId: string, clientId: string, relationshipType?: string): Promise<void> {
    const url = `/api/projects/${projectId}/clients/${clientId}${relationshipType ? `?relationshipType=${encodeURIComponent(relationshipType)}` : ''}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to remove project client');
  },

  // --- Categories (PostgreSQL inno_cost) ---
  async getCategories(params?: ListQueryParams): Promise<any[]> {
    const res = await fetch(`/api/categories?${buildQueryString(params)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch categories');
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.data || [];
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
    return saved;
  },

  async deleteSupplier(id: string): Promise<void> {
    const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete supplier');
  },

  // --- Materials (PostgreSQL inno_cost) ---
  async getMaterials(params?: ListQueryParams): Promise<MaterialItem[]> {
    const res = await fetch(`/api/materials?${buildQueryString(params)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch materials');
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.data || [];
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
    return saved;
  },

  async deleteMaterial(id: string): Promise<void> {
    const res = await fetch(`/api/materials/${id}`, { method: 'DELETE' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete material');
  },

  // --- Material Vendor Quotes & Price Matrix APIs ---
  async getMaterialVendorQuotes(materialId: string): Promise<any[]> {
    const res = await fetch(`/api/materials/${materialId}/vendor-quotes`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch vendor quotes');
    return await res.json();
  },

  async createMaterialVendorQuote(materialId: string, quote: any): Promise<any> {
    const res = await fetch(`/api/materials/${materialId}/vendor-quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quote)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create vendor quote');
    return await res.json();
  },

  async updateMaterialVendorQuote(materialId: string, quoteId: string, quote: any): Promise<any> {
    const res = await fetch(`/api/materials/${materialId}/vendor-quotes/${quoteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quote)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update vendor quote');
    return await res.json();
  },

  async commitMaterialVendorPrice(materialId: string, quoteId: string, commitPayload: any): Promise<any> {
    const res = await fetch(`/api/materials/${materialId}/vendor-quotes/${quoteId}/commit-price`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(commitPayload)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to commit vendor price revision');
    return await res.json();
  },

  async deleteMaterialVendorQuote(materialId: string, quoteId: string, archivePayload?: any): Promise<any> {
    const res = await fetch(`/api/materials/${materialId}/vendor-quotes/${quoteId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(archivePayload || {})
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete vendor quote');
    return await res.json();
  },

  async archiveAndDeleteVendor(materialId: string, quoteId: string, payload: any): Promise<any> {
    const res = await fetch(`/api/materials/${materialId}/vendor-quotes/${quoteId}/archive-and-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to archive and delete vendor quote');
    return await res.json();
  },

  async getVendorArchives(materialId?: string): Promise<any[]> {
    const url = materialId ? `/api/materials/${materialId}/vendor-archives` : '/api/materials/archives';
    const res = await fetch(url);
    if (!res.ok) return [];
    return await res.json();
  },

  async getMeasurementUnits(): Promise<MeasurementUnit[]> {
    const res = await fetch('/api/measurement-units');
    if (!res.ok) return [];
    return await res.json();
  },

  // --- Outsourced Services (PostgreSQL inno_cost) ---
  async getOutsourced(params?: ListQueryParams): Promise<OutsourcedService[]> {
    const res = await fetch(`/api/outsourced?${buildQueryString(params)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch outsourced services');
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.data || [];
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
    return saved;
  },

  async deleteOutsourced(id: string): Promise<void> {
    const res = await fetch(`/api/outsourced/${id}`, { method: 'DELETE' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete outsourced service');
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
    return saved;
  },

  async deleteSubcontractor(id: string): Promise<void> {
    const res = await fetch(`/api/subcontractors/${id}`, { method: 'DELETE' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete subcontractor');
  },

  // --- Produce Catalog (PostgreSQL inno_cost) ---
  async getProduce(params?: ListQueryParams): Promise<ProduceItem[]> {
    const res = await fetch(`/api/produce?${buildQueryString(params)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch produce items');
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.data || [];
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
    return saved;
  },

  async updateInventoryItem(id: string, data: Partial<InventoryRecord>): Promise<InventoryRecord> {
    return this.updateInventory(id, data);
  },

  async deleteInventory(id: string): Promise<void> {
    const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete inventory record');
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

  async getInventoryTransactions(params?: ListQueryParams): Promise<any[]> {
    return this.getTransactions(params);
  },

  async getInventoryTransactionsPaginated(params?: ListQueryParams): Promise<PaginatedApiResponse<any>> {
    return this.getTransactionsPaginated(params);
  },

  async createInventoryTransaction(data: any): Promise<any> {
    return this.createTransaction(data);
  },

  async updateInventoryTransaction(id: string, data: any): Promise<any> {
    return this.updateTransaction(id, data);
  },

  async deleteInventoryTransaction(id: string): Promise<void> {
    return this.deleteTransaction(id);
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
    return saved;
  },

  async deleteProject(id: string): Promise<void> {
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete project');
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

  // --- Project Plans (PostgreSQL inno_cost) ---
  async getProjectPlans(projectId: string, params?: ListQueryParams): Promise<any[]> {
    const res = await fetch(`/api/projects/${projectId}/plans?${buildQueryString(params)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch project plans');
    const data = await res.json();
    return Array.isArray(data) ? data : data.data || [];
  },

  async getProjectPlansPaginated(projectId: string, params?: ListQueryParams): Promise<PaginatedApiResponse<any>> {
    const res = await fetch(`/api/projects/${projectId}/plans?${buildQueryString(params, true)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch paginated project plans');
    return await res.json();
  },

  async getAllProjectPlans(params?: ListQueryParams): Promise<any[]> {
    const res = await fetch(`/api/project-plans?${buildQueryString(params)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch all project plans');
    const data = await res.json();
    return Array.isArray(data) ? data : data.data || [];
  },

  async getAllProjectPlansPaginated(params?: ListQueryParams): Promise<PaginatedApiResponse<any>> {
    const res = await fetch(`/api/project-plans?${buildQueryString(params, true)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch paginated project plans');
    return await res.json();
  },

  async getProjectPlanById(id: string): Promise<any> {
    const res = await fetch(`/api/project-plans/${id}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch project plan details');
    return await res.json();
  },

  async createProjectPlan(projectId: string, planData: any): Promise<any> {
    const res = await fetch(`/api/projects/${projectId}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(planData)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create project plan');
    return await res.json();
  },

  async updateProjectPlan(id: string, planData: any): Promise<any> {
    const res = await fetch(`/api/project-plans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(planData)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update project plan');
    return await res.json();
  },

  async archiveProjectPlan(id: string, actor?: { id?: string; name?: string }, reason?: string): Promise<any> {
    const res = await fetch(`/api/project-plans/${id}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: actor?.id, userName: actor?.name, reason })
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to archive project plan');
    return await res.json();
  },

  async activateProjectPlan(id: string, actor?: { id?: string; name?: string }): Promise<any> {
    const res = await fetch(`/api/project-plans/${id}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: actor?.id, userName: actor?.name })
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to activate project plan');
    return await res.json();
  },

  async duplicateProjectPlan(id: string, overrides?: any): Promise<any> {
    const res = await fetch(`/api/project-plans/${id}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(overrides || {})
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to duplicate project plan');
    return await res.json();
  },

  async deleteProjectPlan(id: string): Promise<void> {
    const res = await fetch(`/api/project-plans/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete project plan');
  },

  async getProjectPlansComparison(projectId: string): Promise<any> {
    const res = await fetch(`/api/projects/${projectId}/plans/comparison`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch project plans comparison');
    return await res.json();
  },

  async getPlanCommercialHistory(planId: string, params?: ListQueryParams): Promise<any[]> {
    const res = await fetch(`/api/project-plans/${planId}/commercial-history?${buildQueryString(params)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch plan commercial history');
    const data = await res.json();
    return Array.isArray(data) ? data : data.data || [];
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
    return saved;
  },

  async deleteCustomTile(id: string): Promise<void> {
    const res = await fetch(`/api/custom-tiles/${id}`, { method: 'DELETE' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete custom tile');
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
  },

  // --- Overhead Cost Management Portal (TASK 2) ---
  async getOverheadCategories(): Promise<OverheadCategory[]> {
    const res = await fetch(`/api/overhead-categories`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch overhead categories');
    return await res.json();
  },

  async createOverheadCategory(data: Partial<OverheadCategory>): Promise<OverheadCategory> {
    const res = await fetch(`/api/overhead-categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create overhead category');
    return await res.json();
  },

  async updateOverheadCategory(id: string, data: Partial<OverheadCategory>): Promise<OverheadCategory> {
    const res = await fetch(`/api/overhead-categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update overhead category');
    return await res.json();
  },

  async deleteOverheadCategory(id: string): Promise<void> {
    const res = await fetch(`/api/overhead-categories/${id}`, { method: 'DELETE' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete overhead category');
  },

  async getOverheadItems(params?: ListQueryParams): Promise<OverheadItem[]> {
    const res = await fetch(`/api/overhead-items?${buildQueryString(params)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch overhead catalogue items');
    const data = await res.json();
    return Array.isArray(data) ? data : data.data || [];
  },

  async getOverheadItemsPaginated(params?: ListQueryParams): Promise<PaginatedApiResponse<OverheadItem>> {
    const res = await fetch(`/api/overhead-items?${buildQueryString(params, true)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch paginated overhead items');
    return await res.json();
  },

  async getOverheadItemById(id: string): Promise<OverheadItem> {
    const res = await fetch(`/api/overhead-items/${id}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch overhead item details');
    return await res.json();
  },

  async createOverheadItem(data: any): Promise<OverheadItem> {
    const res = await fetch(`/api/overhead-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create overhead catalogue item');
    return await res.json();
  },

  async updateOverheadItem(id: string, data: any): Promise<OverheadItem> {
    const res = await fetch(`/api/overhead-items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update overhead catalogue item');
    return await res.json();
  },

  async deleteOverheadItem(id: string): Promise<void> {
    const res = await fetch(`/api/overhead-items/${id}`, { method: 'DELETE' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete overhead catalogue item');
  },

  async getAllOverheadAllocations(params?: ListQueryParams): Promise<any[]> {
    const res = await fetch(`/api/overhead-allocations?${buildQueryString(params)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch all overhead allocations');
    return await res.json();
  },

  async getPlanOverheadAllocations(planId: string): Promise<PlanOverheadAllocation[]> {
    const res = await fetch(`/api/project-plans/${planId}/overheads`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch plan overhead allocations');
    return await res.json();
  },

  async addPlanOverheadAllocation(planId: string, data: any): Promise<PlanOverheadAllocation> {
    const res = await fetch(`/api/project-plans/${planId}/overheads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to allocate overhead to plan');
    return await res.json();
  },

  async updatePlanOverheadAllocation(planId: string, allocationId: string, data: any): Promise<PlanOverheadAllocation> {
    const res = await fetch(`/api/project-plans/${planId}/overheads/${allocationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update plan overhead allocation');
    return await res.json();
  },

  async deletePlanOverheadAllocation(planId: string, allocationId: string): Promise<void> {
    const res = await fetch(`/api/project-plans/${planId}/overheads/${allocationId}`, { method: 'DELETE' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to remove plan overhead allocation');
  },

  async recalculatePlanOverheads(planId: string): Promise<PlanOverheadAllocation[]> {
    const res = await fetch(`/api/project-plans/${planId}/recalculate-overheads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to recalculate plan overheads');
    return await res.json();
  },

  async getOverheadAuditLogs(params?: ListQueryParams): Promise<PaginatedApiResponse<OverheadAuditLog>> {
    const res = await fetch(`/api/overhead-audit-logs?${buildQueryString(params, true)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch overhead audit logs');
    return await res.json();
  },

  // ============================================================================
  // REVENUE CATALOGUE & COMMERCIAL RATE TRACKING API (TASK 3)
  // ============================================================================

  async getRevenueCategories(): Promise<RevenueCategory[]> {
    const res = await fetch('/api/revenue-categories');
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch revenue categories');
    return await res.json();
  },

  async createRevenueCategory(data: Partial<RevenueCategory>): Promise<RevenueCategory> {
    const res = await fetch('/api/revenue-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create revenue category');
    return await res.json();
  },

  async getRevenueSubcategories(categoryId?: string): Promise<RevenueSubcategory[]> {
    const url = categoryId ? `/api/revenue-subcategories?categoryId=${encodeURIComponent(categoryId)}` : '/api/revenue-subcategories';
    const res = await fetch(url);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch revenue subcategories');
    return await res.json();
  },

  async createRevenueSubcategory(data: Partial<RevenueSubcategory>): Promise<RevenueSubcategory> {
    const res = await fetch('/api/revenue-subcategories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create revenue subcategory');
    return await res.json();
  },

  async getRevenueItems(params?: ListQueryParams): Promise<PaginatedApiResponse<RevenueItem>> {
    const res = await fetch(`/api/revenue-items?${buildQueryString(params, true)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch revenue items');
    return await res.json();
  },

  async getRevenueItemsList(params?: ListQueryParams): Promise<RevenueItem[]> {
    const res = await fetch(`/api/revenue-items?${buildQueryString(params, false)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch revenue items');
    return await res.json();
  },

  async getRevenueItemById(id: string): Promise<RevenueItem & { linkedPlans: any[]; rateHistory: RevenueRateHistoryRecord[] }> {
    const res = await fetch(`/api/revenue-items/${encodeURIComponent(id)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch revenue item details');
    return await res.json();
  },

  async createRevenueItem(data: Partial<RevenueItem>): Promise<RevenueItem> {
    const res = await fetch('/api/revenue-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create revenue catalogue item');
    return await res.json();
  },

  async updateRevenueItem(id: string, data: Partial<RevenueItem>): Promise<RevenueItem> {
    const res = await fetch(`/api/revenue-items/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update revenue catalogue item');
    return await res.json();
  },

  async deleteRevenueItem(id: string): Promise<void> {
    const res = await fetch(`/api/revenue-items/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete revenue catalogue item');
  },

  async getRevenueServices(params?: ListQueryParams): Promise<RevenueItem[]> {
    const res = await fetch(`/api/revenue-services?${buildQueryString(params, false)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch revenue services');
    return await res.json();
  },

  async commitRevenueItemPrice(id: string, payload: {
    rate?: number;
    costPrice?: number;
    effectiveDate?: string;
    reason?: string;
    quoteRef?: string;
    updatedBy?: string;
  }): Promise<RevenueItem> {
    const res = await fetch(`/api/revenue-items/${encodeURIComponent(id)}/commit-price`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to commit revenue price revision');
    return await res.json();
  },

  async getRevenueItemPriceHistory(id: string): Promise<RevenueRateHistoryRecord[]> {
    const res = await fetch(`/api/revenue-items/${encodeURIComponent(id)}/price-history`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch revenue price history');
    return await res.json();
  },

  // --- Plan BOQ Items ---
  async getPlanBoqItems(planId: string, params?: ListQueryParams): Promise<ProjectPlanBoqItem[]> {
    const res = await fetch(`/api/project-plans/${encodeURIComponent(planId)}/boq-items?${buildQueryString(params, false)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch plan BOQ items');
    return await res.json();
  },

  async getPlanBoqItemById(planId: string, boqItemId: string): Promise<ProjectPlanBoqItem> {
    const res = await fetch(`/api/project-plans/${encodeURIComponent(planId)}/boq-items/${encodeURIComponent(boqItemId)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch plan BOQ item details');
    return await res.json();
  },

  async addRevenueItemToPlan(
    planId: string,
    data: any
  ): Promise<{ boqItem: ProjectPlanBoqItem; historyRecord?: RevenueRateHistoryRecord }> {
    const res = await fetch(`/api/project-plans/${encodeURIComponent(planId)}/boq-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to add item to project plan BOQ');
    return await res.json();
  },

  async createPlanBoqItem(
    planId: string,
    data: any
  ): Promise<{ boqItem: ProjectPlanBoqItem; historyRecord?: RevenueRateHistoryRecord }> {
    return this.addRevenueItemToPlan(planId, data);
  },

  async updatePlanBoqItem(
    planId: string,
    boqItemId: string,
    data: any
  ): Promise<{ boqItem: ProjectPlanBoqItem; historyRecord?: RevenueRateHistoryRecord }> {
    const res = await fetch(`/api/project-plans/${encodeURIComponent(planId)}/boq-items/${encodeURIComponent(boqItemId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update plan BOQ item');
    return await res.json();
  },

  async deletePlanBoqItem(planId: string, boqItemId: string): Promise<void> {
    const res = await fetch(`/api/project-plans/${encodeURIComponent(planId)}/boq-items/${encodeURIComponent(boqItemId)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to remove plan BOQ item');
  },

  // --- Historical Rate Tracking ---
  async getRevenueRateHistory(params?: ListQueryParams): Promise<PaginatedApiResponse<RevenueRateHistoryRecord>> {
    const res = await fetch(`/api/revenue-rate-history?${buildQueryString(params, true)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch revenue rate history');
    return await res.json();
  },

  async getRevenueItemRateHistory(revenueItemId: string, params?: ListQueryParams): Promise<PaginatedApiResponse<RevenueRateHistoryRecord>> {
    const res = await fetch(`/api/revenue-items/${encodeURIComponent(revenueItemId)}/rate-history?${buildQueryString(params, true)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch item rate history');
    return await res.json();
  },

  async getProjectCommercialHistory(projectId: string, params?: ListQueryParams): Promise<PaginatedApiResponse<RevenueRateHistoryRecord>> {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/commercial-history?${buildQueryString(params, true)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch project commercial history');
    return await res.json();
  },

  // --- TASK 5: Procurement Price History System API ---
  async getProcurementPriceHistory(params?: ListQueryParams): Promise<PaginatedApiResponse<ProcurementPriceRecord>> {
    const res = await fetch(`/api/procurement-price-history?${buildQueryString(params, true)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch procurement price history');
    return await res.json();
  },

  async getProcurementPriceHistoryList(params?: ListQueryParams): Promise<ProcurementPriceRecord[]> {
    const res = await fetch(`/api/procurement-price-history?${buildQueryString(params, false)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch procurement price history list');
    return await res.json();
  },

  async createProcurementPriceRecord(data: Partial<ProcurementPriceRecord>): Promise<ProcurementPriceRecord> {
    const res = await fetch('/api/procurement-price-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to record procurement price quotation');
    return await res.json();
  },

  async getProcurementPriceComparison(itemId: string, itemType?: string, unit?: string): Promise<PriceComparisonSummary> {
    const params = new URLSearchParams({ itemId });
    if (itemType) params.set('itemType', itemType);
    if (unit) params.set('unit', unit);
    const res = await fetch(`/api/procurement-price-history/comparison?${params.toString()}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch price comparison data');
    return await res.json();
  },

  async getSupplierPriceHistory(supplierId: string, params?: ListQueryParams): Promise<PaginatedApiResponse<ProcurementPriceRecord>> {
    const res = await fetch(`/api/suppliers/${encodeURIComponent(supplierId)}/price-history?${buildQueryString(params, true)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch supplier price history');
    return await res.json();
  },

  async getMaterialPriceHistory(materialId: string, params?: ListQueryParams): Promise<PaginatedApiResponse<ProcurementPriceRecord>> {
    const res = await fetch(`/api/materials/${encodeURIComponent(materialId)}/price-history?${buildQueryString(params, true)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch material price history');
    return await res.json();
  },

  async getOutsourcedPriceHistory(outsourcedId: string, params?: ListQueryParams): Promise<PaginatedApiResponse<ProcurementPriceRecord>> {
    const res = await fetch(`/api/outsourced/${encodeURIComponent(outsourcedId)}/price-history?${buildQueryString(params, true)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch outsourced price history');
    return await res.json();
  },

  async getSubcontractorPriceHistory(subcontractorId: string, params?: ListQueryParams): Promise<PaginatedApiResponse<ProcurementPriceRecord>> {
    const res = await fetch(`/api/subcontractors/${encodeURIComponent(subcontractorId)}/price-history?${buildQueryString(params, true)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch subcontractor price history');
    return await res.json();
  },

  // --- TASK 7: System-Wide Barcode Registry & Scanning System API ---
  async lookupBarcode(code: string): Promise<any> {
    const res = await fetch(`/api/barcodes/lookup?code=${encodeURIComponent(code)}`);
    if (!res.ok) {
      if (res.status === 404) return await res.json();
      throw await parseErrorResponse(res, 'Failed to lookup barcode');
    }
    return await res.json();
  },

  async searchBarcodes(q: string, opts?: { entityType?: string; limit?: number; offset?: number }): Promise<any[]> {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (opts?.entityType) params.set('entityType', opts.entityType);
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.offset) params.set('offset', String(opts.offset));
    const res = await fetch(`/api/barcodes/search?${params.toString()}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to search barcodes');
    return await res.json();
  },

  async generateBarcode(entityType: string, baseCode?: string): Promise<{ barcode: string; entityType: string }> {
    const res = await fetch('/api/barcodes/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType, baseCode })
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to generate barcode');
    return await res.json();
  },

  async registerBarcode(data: any): Promise<{ success: boolean; barcode: string }> {
    const res = await fetch('/api/barcodes/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to register barcode');
    return await res.json();
  },

  // ============================================================================
  // ENTERPRISE TARIFF MANAGEMENT API (TASK 9)
  // ============================================================================

  async getTariffs(params?: ListQueryParams): Promise<Tariff[]> {
    const res = await fetch(`/api/tariffs?${buildQueryString(params)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch tariffs');
    const data = await res.json();
    return Array.isArray(data) ? data : data.data || [];
  },

  async getTariffsPaginated(params?: ListQueryParams): Promise<PaginatedApiResponse<Tariff>> {
    const res = await fetch(`/api/tariffs?${buildQueryString(params, true)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch paginated tariffs');
    return await res.json();
  },

  async getTariffById(id: string): Promise<Tariff> {
    const res = await fetch(`/api/tariffs/${encodeURIComponent(id)}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch tariff details');
    return await res.json();
  },

  async createTariff(data: Partial<Tariff> & { changeReason?: string }): Promise<Tariff> {
    const res = await fetch('/api/tariffs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create tariff schedule');
    return await res.json();
  },

  async updateTariff(id: string, data: Partial<Tariff> & { changeReason?: string }): Promise<Tariff> {
    const res = await fetch(`/api/tariffs/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update tariff schedule');
    return await res.json();
  },

  async deleteTariff(id: string): Promise<boolean> {
    const res = await fetch(`/api/tariffs/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete tariff schedule');
    return true;
  },

  async deleteTariffVersion(tariffId: string, versionId: string): Promise<boolean> {
    const res = await fetch(`/api/tariffs/${encodeURIComponent(tariffId)}/versions/${encodeURIComponent(versionId)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete tariff version');
    return true;
  },

  async createTariffVersion(tariffId: string, data: Partial<TariffVersion>): Promise<TariffVersion> {
    const res = await fetch(`/api/tariffs/${encodeURIComponent(tariffId)}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create new tariff version');
    return await res.json();
  },

  async resolveTariffVersion(tariffId: string, date?: string): Promise<TariffVersion & { matchType?: string; resolvedDate?: string }> {
    const url = date
      ? `/api/tariffs/${encodeURIComponent(tariffId)}/resolve?date=${encodeURIComponent(date)}`
      : `/api/tariffs/${encodeURIComponent(tariffId)}/resolve`;
    const res = await fetch(url);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to resolve tariff version for date');
    return await res.json();
  },

  async getPlanTariffs(planId: string): Promise<PlanTariff[]> {
    const res = await fetch(`/api/project-plans/${encodeURIComponent(planId)}/tariffs`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch plan tariffs');
    return await res.json();
  },

  async applyTariffToPlan(planId: string, data: Partial<PlanTariff> & { effectiveDate?: string; quantity?: number }): Promise<PlanTariff> {
    const res = await fetch(`/api/project-plans/${encodeURIComponent(planId)}/tariffs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to apply tariff to plan');
    return await res.json();
  },

  async removePlanTariff(planId: string, planTariffId: string): Promise<void> {
    const res = await fetch(`/api/project-plans/${encodeURIComponent(planId)}/tariffs/${encodeURIComponent(planTariffId)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to remove tariff from plan');
  },

  // ============================================================================
  // PRODUCT & REVENUE COMPETITOR BENCHMARK & COMPARISON API
  // ============================================================================

  async getCompetitors(): Promise<Competitor[]> {
    const res = await fetch('/api/competitors');
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch competitors');
    return await res.json();
  },

  async createCompetitor(data: Partial<Competitor>): Promise<Competitor> {
    const res = await fetch('/api/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create competitor');
    return await res.json();
  },

  async updateCompetitor(id: string, data: Partial<Competitor>): Promise<Competitor> {
    const res = await fetch(`/api/competitors/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update competitor');
    return await res.json();
  },

  async deleteCompetitor(id: string): Promise<void> {
    const res = await fetch(`/api/competitors/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete competitor');
  },

  // --- Dedicated Competitor Table API (name, product/service association, pricing, timestamps) ---
  async getCompetitorEntries(params?: { itemId?: string; itemType?: string; search?: string }): Promise<CompetitorRecord[]> {
    const q = new URLSearchParams();
    if (params?.itemId) q.set('itemId', params.itemId);
    if (params?.itemType) q.set('itemType', params.itemType);
    if (params?.search) q.set('search', params.search);
    const qs = q.toString();
    const res = await fetch(`/api/competitor${qs ? `?${qs}` : ''}`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch competitor entries');
    return await res.json();
  },

  async getCompetitorBenchmarksMap(): Promise<Record<string, CompetitorBenchmarkSummary>> {
    const res = await fetch('/api/competitor/benchmarks-map');
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch competitor benchmarks map');
    return await res.json();
  },

  async createCompetitorEntry(data: Partial<CompetitorRecord>): Promise<CompetitorRecord> {
    const res = await fetch('/api/competitor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create competitor entry');
    return await res.json();
  },

  async updateCompetitorEntry(id: string, data: Partial<CompetitorRecord>): Promise<CompetitorRecord> {
    const res = await fetch(`/api/competitor/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update competitor entry');
    return await res.json();
  },

  async deleteCompetitorEntry(id: string): Promise<void> {
    const res = await fetch(`/api/competitor/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete competitor entry');
  },

  async getProductCompetitorQuotes(itemId: string, itemType?: string): Promise<ProductCompetitorQuote[]> {
    const url = itemType
      ? `/api/products/${encodeURIComponent(itemId)}/competitor-quotes?itemType=${encodeURIComponent(itemType)}`
      : `/api/products/${encodeURIComponent(itemId)}/competitor-quotes`;
    const res = await fetch(url);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch competitor quotes');
    return await res.json();
  },

  async createProductCompetitorQuote(itemId: string, data: Partial<ProductCompetitorQuote>): Promise<ProductCompetitorQuote> {
    const res = await fetch(`/api/products/${encodeURIComponent(itemId)}/competitor-quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create competitor quote');
    return await res.json();
  },

  async updateProductCompetitorQuote(itemId: string, quoteId: string, data: Partial<ProductCompetitorQuote>): Promise<ProductCompetitorQuote> {
    const res = await fetch(`/api/products/${encodeURIComponent(itemId)}/competitor-quotes/${encodeURIComponent(quoteId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update competitor quote');
    return await res.json();
  },

  async commitProductCompetitorPrice(itemId: string, quoteId: string, commitPayload: any): Promise<ProductCompetitorQuote> {
    const res = await fetch(`/api/products/${encodeURIComponent(itemId)}/competitor-quotes/${encodeURIComponent(quoteId)}/commit-price`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(commitPayload)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to commit competitor price revision');
    return await res.json();
  },

  async deleteProductCompetitorQuote(itemId: string, quoteId: string): Promise<void> {
    const res = await fetch(`/api/products/${encodeURIComponent(itemId)}/competitor-quotes/${encodeURIComponent(quoteId)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete competitor quote');
  },

  async getProductCompetitorHistory(itemId: string, itemType?: string): Promise<ProductCompetitorPriceHistoryRecord[]> {
    const url = itemType
      ? `/api/products/${encodeURIComponent(itemId)}/competitor-history?itemType=${encodeURIComponent(itemType)}`
      : `/api/products/${encodeURIComponent(itemId)}/competitor-history`;
    const res = await fetch(url);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch competitor price history');
    return await res.json();
  },

  // ============================================================================
  // PROJECT DELIVERABLES RELATIONAL API (PostgreSQL inno_cost)
  // ============================================================================

  async getProjectDeliverables(projectId: string): Promise<ProjectDeliverableItem[]> {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/deliverables`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch project deliverables');
    return await res.json();
  },

  async createProjectDeliverable(projectId: string, data: Partial<ProjectDeliverableItem>): Promise<ProjectDeliverableItem> {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/deliverables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to create project deliverable');
    return await res.json();
  },

  async updateProjectDeliverable(projectId: string, deliverableId: string, data: Partial<ProjectDeliverableItem>): Promise<ProjectDeliverableItem> {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/deliverables/${encodeURIComponent(deliverableId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update project deliverable');
    return await res.json();
  },

  async deleteProjectDeliverable(projectId: string, deliverableId: string): Promise<void> {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/deliverables/${encodeURIComponent(deliverableId)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to delete project deliverable');
  },

  // ============================================================================
  // KV STORE API (PostgreSQL / SQLite Key-Value Storage)
  // ============================================================================

  async getKv<T = any>(key: string): Promise<T | null> {
    try {
      const res = await fetch(`/api/kv/${encodeURIComponent(key)}`);
      if (!res.ok) return null;
      const body = await res.json();
      return body.value ?? null;
    } catch {
      return null;
    }
  },

  async setKv(key: string, value: any): Promise<void> {
    const res = await fetch(`/api/kv/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value })
    });
    if (!res.ok) throw await parseErrorResponse(res, `Failed to update KV store for ${key}`);
  },

  // ============================================================================
  // PROJECT PLAN COST CONTROLS API (PostgreSQL inno_cost)
  // ============================================================================

  async getPlanCostControls(planId: string): Promise<any> {
    const res = await fetch(`/api/project-plans/${encodeURIComponent(planId)}/cost-controls`);
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to fetch plan cost controls');
    return await res.json();
  },

  async updatePlanCostControls(planId: string, updates: any): Promise<any> {
    const res = await fetch(`/api/project-plans/${encodeURIComponent(planId)}/cost-controls`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to update plan cost controls');
    return await res.json();
  },

  async applyPlanCostControlAction(planId: string, action: string, payload?: any): Promise<any> {
    const res = await fetch(`/api/project-plans/${encodeURIComponent(planId)}/cost-controls/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload })
    });
    if (!res.ok) throw await parseErrorResponse(res, 'Failed to apply plan cost control action');
    return await res.json();
  }
};


