/**
 * Types and interfaces for Cost, Supplier, Rate, Project Profitability, and Inventory Management
 */

export type EntityId = string;

export interface SupplierContract {
  contractId: string;
  contractNumber?: string;
  title: string;
  value: number;
  startDate: string;
  endDate: string;
  status: 'Completed' | 'Active' | 'Renewed' | 'Pending Approval';
  scopeType?: 'materials' | 'final_product' | 'full_contract' | 'hybrid' | 'service';
  type?: string;
  deliverablesSummary?: string;
  scopeDescription?: string;
  paymentSchedule?: string;
  paymentTerms?: string;
  currency?: string;
  attachmentUrl?: string;
  notes?: string;
}

export interface Supplier {
  id: EntityId;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  category: 'Materials' | 'Outsourced' | 'Subcontractor' | 'Turnkey Project';
  supplyScope: 'materials' | 'final_product' | 'full_contract' | 'hybrid';
  paymentTerms: 'Immediate' | 'Net 15' | 'Net 30' | 'Net 60' | 'Net 90' | 'Advance 50%' | 'Milestone Based' | 'LC / Commercial Escrow' | string;
  rating: number; // 1 to 5
  onTimeDeliveryPct: number;
  qualityScorePct: number;
  complianceScorePct?: number;
  riskLevel?: 'Low' | 'Medium' | 'High';
  status: 'Active' | 'Under Review' | 'Preferred' | 'Suspended';
  country: string;
  city: string;
  code?: string;
  barcode?: string;
  leadTimeDays?: number;
  vendorTaxId?: string;
  certifications?: string[];
  creditLimit?: number;
  currency?: string;
  contractHistory: SupplierContract[];
  imageUrl?: string;
  notes: string;
}

export interface VolumePriceTier {
  minQty: number;
  maxQty?: number;
  unitPrice: number;
  discountPct: number;
  label: string;
}

export interface PriceHistoryRecord {
  id: string;
  date: string;
  previousPrice: number;
  newPrice: number;
  changePct: number;
  reason: string;
  updatedBy: string;
}

export interface TierChangeDetail {
  tierLabel: string;
  previousMinQty?: number;
  newMinQty?: number;
  previousMaxQty?: number;
  newMaxQty?: number;
  previousPrice?: number;
  newPrice?: number;
  previousDiscountPct?: number;
  newDiscountPct?: number;
  changeType?: 'price' | 'discount' | 'range_size' | 'all';
}

/**
 * Individual price change record for a specific vendor quote over time
 */
export interface VendorPriceChangeRecord {
  id: string;
  date: string;
  price: number;
  previousPrice?: number;
  changePct?: number;
  reason: string;
  quoteRef?: string;
  moq?: number;
  leadTimeDays?: number;
  updatedBy: string;
  changedTiers?: VolumePriceTier[];
  targetTierLabel?: string;
  tierChanges?: TierChangeDetail[];
  appliedChangesSummary?: string[];
}

/**
 * Supplier / Vendor quote supplying a specific material with distinct pricing and history
 */
export interface MaterialVendorQuote {
  vendorId: string;
  vendorName: string;
  country?: string;
  currentPrice: number;
  currency?: string;
  leadTimeDays: number;
  moq?: number; // Minimum Order Quantity
  isPreferred?: boolean;
  status: 'Active' | 'Preferred' | 'Secondary' | 'Best Price' | 'Under Review';
  priceHistory: VendorPriceChangeRecord[];
  lastUpdated: string;
  volumePricing?: VolumePriceTier[];
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
}

/**
 * Produced / Supplied Product or Service by our enterprise
 * 4-Tier Hierarchy: Category -> Subcategory -> More Subcategory -> Product/Service Item
 */
export interface ProduceItem {
  id: EntityId;
  code: string;
  itemCode?: string;
  name: string;
  type: 'product' | 'service';
  category: string; // e.g. Industrial Automation & Machinery
  subCategory: string; // e.g. Aerospace Stamping & Hydro-Forming
  moreSubCategory: string; // e.g. Turnkey Closed-Loop Servo Press
  itemClassification?: 'produced_product' | 'delivered_service' | 'turnkey_system' | string;
  description?: string;
  unit: string; // unit, assembly, system, month, hr
  costPrice: number; // internal production cost
  retailPrice: number; // quoted/retail price
  defaultDiscountPct: number;
  bundlesAndRanges?: VolumePriceTier[];
  leadTimeDays: number;
  status: 'Active' | 'In Production' | 'Custom Order' | 'Archived';
  specSheetUrl?: string;
  imageUrl?: string;
  barcode?: string;
  priceHistory: PriceHistoryRecord[];
  lastUpdated: string;
  currency?: string;
}

export interface MeasurementUnit {
  id: string;
  code: string;
  name: string;
  symbol: string;
  category?: string;
  isActive?: boolean;
}

export interface MaterialItem {
  id: EntityId;
  code: string;
  name: string;
  categoryId?: string;
  subCategoryId?: string;
  category: string; // e.g., Metals & Structural Alloys
  subCategory: string; // e.g., Aircraft & Marine Alloys
  moreSubCategory?: string; // e.g., Pre-Tempered Extrusions & Plates
  itemClassification: 'raw_material' | 'final_product' | 'full_contract' | 'hardware' | string;
  supplierId: EntityId;
  supplierName: string;
  unit: string; // kg, m, pcs, ton, sheet, bundle
  defaultUnitId?: string;
  description?: string;
  retailPrice: number;
  currentPrice?: number;
  lastPrice?: number;
  unitCost?: number;
  status?: string;
  barcode?: string;
  defaultDiscountPct: number;
  volumePricing: VolumePriceTier[];
  inStock: number;
  reorderPoint: number;
  leadTimeDays: number;
  priceHistory: PriceHistoryRecord[];
  vendorQuotes?: MaterialVendorQuote[];
  specSheetUrl?: string;
  imageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  lastUpdated: string;
  effectiveDate?: string;
  classificationReviewRequired?: boolean;
  classificationReviewNotes?: string;
  themeId?: string;
  customGradient?: string;
}

export interface OutsourcedService {
  id: EntityId;
  code?: string;
  barcode?: string;
  name: string;
  providerId: EntityId;
  providerName: string;
  category: 'Banking & Financial' | 'Telecommunications' | 'Enterprise Internet' | 'Heavy Transportation & Logistics' | 'Grid & Industrial Power' | 'Quality & NDT Inspection' | 'Legal & Compliance' | string;
  subCategory: string;
  moreSubCategory?: string;
  unit?: string;
  baseUnitType: 'per_km' | 'per_kwh' | 'per_month' | 'per_transaction' | 'per_hour' | 'per_gb' | 'fixed_per_contract' | string;
  rate: number;
  retailPrice: number;
  leadTimeDays?: number;
  qualityTier?: string;
  status?: string;
  tierRates: Array<{
    minVolume: number;
    maxVolume?: number;
    rate: number;
    description: string;
  }>;
  slaLevel: 'Standard SLA' | 'Premium 99.9%' | 'Mission Critical 24/7' | string;
  imageUrl?: string;
  priceHistory: Array<{
    id: string;
    date: string;
    oldRate: number;
    newRate: number;
    reason: string;
    updatedBy: string;
  }>;
  lastUpdated: string;
}

export interface AlternativeOption {
  id: string;
  title: string;
  description: string;
  adjustedCost: number;
  adjustedPrice: number;
  projectedMarginPct: number;
  isRecommended: boolean;
}

export type ProjectItem = ProjectCostItem;

export interface SubcontractorRateItem {
  id: EntityId;
  code?: string;
  barcode?: string;
  name?: string;
  subcontractorId: EntityId;
  subcontractorName: string;
  serviceType: string;
  serviceCategory?: string;
  serviceSubCategory?: string;
  moreServiceSubCategory?: string;
  category?: string;
  subCategory?: string;
  nicheServiceName?: string;
  rateModel?: 'hourly_labour' | 'daily_rate' | 'bulk_volume' | 'retail_rate' | 'full_contract_lump_sum';
  baseRate: number;
  rate?: number;
  retailRate?: number;
  trade?: string;
  tier?: string;
  leadTimeDays?: number;
  shiftMultiplier?: number;
  rating?: number;
  qualityScorePct?: number;
  weeklyCapacity?: number;
  crewSize?: number;
  location?: string;
  contactPhone?: string;
  email?: string;
  rateRange?: string;
  status?: string;
  unit: string;
  bulkPricingRanges?: Array<{
    minVolume: number;
    maxVolume?: number;
    unitRate: number;
    discountPct: number;
  }>;
  rateRanges?: Array<{
    minUnits: number;
    maxUnits?: number;
    rate: number;
    label: string;
  }>;
  fullContractEstimate?: number;
  fullContractPrice?: number;
  skillLevel: string;
  imageUrl?: string;
  rateHistory?: Array<{
    id: string;
    date: string;
    oldRate: number;
    newRate: number;
    changeReason: string;
    updatedBy: string;
  }>;
  priceHistory?: Array<{
    id: string;
    date: string;
    previousRate: number;
    previousPrice?: number;
    newRate: number;
    newPrice?: number;
    changePct?: number;
    changeReason?: string;
    reason: string;
    updatedBy: string;
  }>;
  lastUpdated: string;
}

export interface InventoryItem {
  id: EntityId;
  materialId?: EntityId;
  itemName?: string;
  name?: string;
  sku: string;
  category: string;
  currentStock?: number;
  allocatedStock?: number;
  availableStock?: number;
  onHand?: number;
  reserved?: number;
  available?: number;
  reorderLevel: number;
  unitCost: number;
  totalValuation?: number;
  unit?: string;
  supplierId?: EntityId;
  supplierName?: string;
  allocatedProjectId?: EntityId;
  projectPhase?: string;
  location: string;
  stage?: string;
  status: string;
  barcode?: string;
  lastMovementDate?: string;
  lastAuditDate?: string;
}

export interface InventoryTransaction {
  id: string;
  transactionNumber?: string;
  type: 'IN' | 'OUT';
  date: string;
  timestamp: string;
  projectId?: string;
  projectCode?: string;
  projectName?: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  inventorySku?: string;
  inventoryItemId?: string;
  barcode: string;
  batchLotNumber?: string;
  requisitionRef?: string;
  requisitionNumber?: string;
  supplierId?: string;
  supplierName?: string;
  recordedBy?: string;
  notes?: string;
  currency?: string;
  quantity: number;
  unit: string;
  price: number;
  discount: number; // percentage (e.g. 5 for 5%)
  discountAmount?: number;
  totalAmount: number;
  previousAvailableQuantity: number;
  newAvailableQuantity: number;
}

export interface ProjectPhase {
  id: string;
  name: string;
  description?: string;
  budget?: number;
  actualCost: number;
  plannedCost?: number;
  materialBudget?: number;
  laborBudget?: number;
  outsourcedBudget?: number;
  startDate: string;
  endDate: string;
  status: 'Not Started' | 'In Progress' | 'Completed';
  phaseNumber?: number;
  items?: ProjectCostItem[];
  projectedCost?: number;
  consumptionPct?: number;
  isOverrun?: boolean;
  capacityHours?: number;
  allocatedHours?: number;
  assignedResources?: PhaseResourceAssignment[];
}

export interface PhaseResourceAssignment {
  id: string;
  resourceId: string;
  resourceType: 'team_member' | 'subcontractor';
  name: string;
  roleOrTrade: string;
  email?: string;
  allocatedHours?: number;
  startDate?: string;
  endDate?: string;
  assignedAt: string;
  avatarUrl?: string;
  conflictNotes?: string;
}

export interface ResourceScheduleConflict {
  resourceId: string;
  resourceName: string;
  resourceType: 'team_member' | 'subcontractor';
  phaseA: {
    projectId: string;
    projectCode: string;
    projectName: string;
    phaseId: string;
    phaseName: string;
    startDate: string;
    endDate: string;
  };
  phaseB: {
    projectId: string;
    projectCode: string;
    projectName: string;
    phaseId: string;
    phaseName: string;
    startDate: string;
    endDate: string;
  };
  overlapDays: number;
  overlapStart: string;
  overlapEnd: string;
}

export interface ProjectCostItem {
  id: string;
  phaseId: string;
  type: 'material' | 'subcontractor' | 'outsourced';
  itemId?: string;
  name: string;
  category?: string;
  supplierOrProvider: string;
  quantity: number;
  unit: string;
  unitCost: number;
  discountPct?: number;
  totalCost: number;
  notes?: string;
  selectedOptionIndex?: number;
  alternativeOptions?: Array<{
    provider: string;
    unitCost: number;
    savingsDiff: number;
    notes: string;
  }>;
  billableRate?: number;
  totalRevenue?: number;
  grossProfit?: number;
  markupPct?: number;
  bulkTierLabel?: string;
  currency?: string;
  nativeUnitCost?: number;
  originalCurrency?: string;
  consumptionRate?: number; // e.g. 100 (%) or pace multiplier
  actualConsumedUnits?: number;
  projectedCost?: number;
  isOverrunWarning?: boolean;
  warningReason?: string;
}

export interface ProjectProfitabilityMetrics {
  revenue: number;
  materialCost: number;
  subcontractorCost: number;
  outsourcedCost: number;
  totalDirectCost: number;
  overheadAmount: number;
  contingencyAmount: number;
  totalProjectCost: number;
  grossProfit: number;
  grossMarginPct: number;
  netProfit: number;
  netMarginPct: number;
  totalPlannedBudget: number;
  budgetVariance: number;
  budgetVariancePct: number;
  healthScore: number;
  phaseMetrics: Array<{
    phaseId: string;
    phaseName: string;
    plannedBudget: number;
    actualCost: number;
    variance: number;
    variancePct: number;
    status: 'Under Budget' | 'Over Budget';
  }>;
  sensitivity: {
    materialInflation5Pct: {
      costImpact: number;
      revisedNetMarginPct: number;
    };
    labourRateHike8Pct: {
      costImpact: number;
      revisedNetMarginPct: number;
    };
  };
  costDistribution: Array<{
    category: string;
    amount: number;
    pct: number;
  }>;
}

export interface ProjectDeliverableItem {
  id: string;
  code: string;
  name: string;
  type: 'product' | 'service';
  category: string;
  subCategory?: string;
  description?: string;
  quantity: number;
  unit: string;
  costPrice: number;
  quotedPrice: number;
  totalRevenue: number;
  totalCost: number;
  marginPct: number;
  leadTimeDays?: number;
  status?: 'Planned' | 'In Assembly' | 'Completed' | 'Delivered' | string;
  currency?: string;
}

export interface PlanTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags?: string[];
  targetMarginPct: number;
  overheadPct: number;
  contingencyPct: number;
  items: ProjectCostItem[];
  themeId?: string;
  customGradient?: string;
  createdAt: string;
  updatedAt?: string;
  isBuiltIn?: boolean;
  sourcePlanName?: string;
  sourceProjectCode?: string;
  sourceClientName?: string;
}

export interface ProjectPlanRevision {
  id: string;
  planId: string;
  projectId: string;
  revisionNumber: number;
  versionLabel: string;
  changeSummary: string;
  statusAtRevision: string;
  plannedRevenue: number;
  directCost: number;
  allocatedOverhead: number;
  totalPlannedCost: number;
  plannedProfit: number;
  profitMarginPct: number;
  changedBy: string;
  effectiveDate?: string;
  snapshot?: any;
  createdAt: string;
}

export interface ProjectPlanSection {
  id: string;
  planId?: string;
  projectId?: string;
  phaseCode: string;
  name: string;
  description?: string;
  sequenceOrder: number;
  plannedBudget: number;
  materialBudget: number;
  laborBudget: number;
  outsourcedBudget: number;
  actualCost: number;
  startDate?: string;
  endDate?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectPlanBoqItem {
  id: string;
  planId?: string;
  projectId?: string;
  sectionId?: string;
  phaseId?: string;
  type: 'product' | 'service' | 'material' | 'subcontractor' | 'outsourced' | 'produce' | 'equipment' | 'other';
  itemId?: string;
  itemCode?: string;
  barcode?: string;
  revenueItemId?: string;
  name: string;
  category?: string;
  subCategory?: string;
  supplierOrProvider: string;
  description?: string;
  quantity: number;
  unit: string;
  unitCost: number;
  discountPct: number;
  rate?: number; // selling rate per unit in plan
  sellingRate?: number;
  billableRate?: number;
  taxTreatment?: string;
  taxRatePct?: number;
  taxAmount?: number;
  totalCost: number;
  markupPct?: number;
  totalRevenue?: number;
  grossProfit?: number;
  currency?: string;
  nativeUnitCost?: number;
  consumptionRate?: number;
  notes?: string;
  lineOrder?: number;
  snapshotData?: any;
  commercialContext?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectPlanResource {
  id: string;
  planId?: string;
  projectId?: string;
  sectionId?: string;
  resourceId: string;
  resourceType: 'team_member' | 'subcontractor' | 'equipment';
  name: string;
  roleOrTrade: string;
  allocatedHours: number;
  hourlyRate: number;
  totalCost: number;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export type OverheadCostType = 'Fixed' | 'Variable' | 'Semi-Variable' | 'Stepped';

export type OverheadCalculationMethod =
  | 'fixed_amount'
  | 'percentage_of_cost_base'
  | 'rate_per_unit'
  | 'proportional_defined_base';

export type OverheadCostBase =
  | 'total_direct_cost'
  | 'material_cost'
  | 'labor_cost'
  | 'subcontractor_cost'
  | 'outsourced_cost'
  | 'planned_revenue'
  | 'units_produced'
  | 'custom_base';

export interface OverheadCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  sortOrder?: number;
  createdAt?: string;
}

export interface OverheadItem {
  id: string;
  code: string;
  barcode?: string;
  name: string;
  category: string;
  description?: string;
  costType: OverheadCostType;
  defaultCalculationMethod: OverheadCalculationMethod;
  defaultRate: number;
  defaultCostBase: OverheadCostBase;
  unitType?: string;
  effectiveDate: string;
  status: 'Active' | 'Inactive' | 'Archived' | 'Under Review';
  createdBy: string;
  updatedBy: string;
  createdAt?: string;
  updatedAt?: string;
  activeAllocationsCount?: number;
  totalAllocatedAmount?: number;
  linkedPlans?: Array<{
    allocationId: string;
    planId: string;
    planNumber: string;
    planName: string;
    projectId: string;
    projectCode?: string;
    projectName?: string;
    allocationMethod: OverheadCalculationMethod;
    allocationBase: OverheadCostBase;
    baseAmount: number;
    allocationRate: number;
    allocatedAmount: number;
    effectiveDate?: string;
    allocatedBy?: string;
  }>;
}

export interface PlanOverheadAllocation {
  id: string;
  planId: string;
  projectId: string;
  overheadItemId?: string;
  overheadItemCode?: string;
  overheadItemName?: string;
  barcode?: string;
  category: string;
  costType?: OverheadCostType;
  unitType?: string;
  allocationMethod: OverheadCalculationMethod;
  allocationType?: 'percentage' | 'fixed'; // backwards compatibility
  allocationBase: OverheadCostBase;
  baseAmount: number;
  allocationRate: number;
  ratePct?: number; // backwards compatibility
  unitQuantity?: number;
  allocatedAmount: number;
  effectiveDate?: string;
  allocatedBy?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OverheadAuditLog {
  id: string;
  overheadItemId?: string;
  overheadItemCode?: string;
  overheadItemName?: string;
  planId?: string;
  planNumber?: string;
  allocationId?: string;
  action: 'ITEM_CREATED' | 'ITEM_UPDATED' | 'ITEM_DELETED' | 'ALLOCATION_CREATED' | 'ALLOCATION_UPDATED' | 'ALLOCATION_REMOVED' | 'BASE_RECALCULATED' | string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  previousState?: any;
  newState?: any;
  changeDescription: string;
  createdAt: string;
}

export interface ProjectPlanOverheadAllocation extends PlanOverheadAllocation {}

export interface ProjectPlanCostSummary {
  planId?: string;
  projectId?: string;
  plannedRevenue: number;
  materialCost: number;
  subcontractorCost: number;
  outsourcedCost: number;
  resourceCost: number;
  directCost: number;
  overheadAmount: number;
  contingencyAmount: number;
  laborBurdenAmount: number;
  extraOverheadAmount: number;
  allocatedOverhead: number;
  totalPlannedCost: number;
  grossProfit: number;
  grossMarginPct: number;
  plannedProfit: number;
  profitMarginPct: number;
  boqItemCount: number;
  sectionCount: number;
  resourceCount: number;
  calculatedAt?: string;
}

export interface BudgetaryPlan {
  id: string;
  planNumber?: string;
  projectId?: string;
  projectCode?: string;
  projectName?: string;
  clientName?: string;
  name: string;
  description?: string;
  planType?: string;
  status?: string;
  revisionNumber?: number;
  versionLabel?: string;
  isBaseline?: boolean;
  isActive?: boolean;
  currency?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  effectiveDate?: string;
  approvalDate?: string;
  approvedBy?: string;
  targetMarginPct: number;
  overheadPct: number;
  contingencyPct: number;
  laborBurdenPct?: number;
  selectedItems: ProjectCostItem[];
  plannedRevenue?: number;
  directCost?: number;
  allocatedOverhead?: number;
  totalPlannedCost?: number;
  plannedProfit?: number;
  profitMarginPct?: number;
  totalDirectCost?: number;
  totalProjectCost?: number;
  quotedRevenue?: number;
  grossMarginPct?: number;
  themeId?: string;
  customGradient?: string;
  templateId?: string;
  sourceProjectId?: string;
  sourceProjectCode?: string;
  totalEstimatedCost?: number;
  notes?: string;
  costSummary?: ProjectPlanCostSummary;
  sections?: ProjectPlanSection[];
  boqItems?: ProjectPlanBoqItem[];
  resources?: ProjectPlanResource[];
  overheadAllocations?: ProjectPlanOverheadAllocation[];
  revisions?: ProjectPlanRevision[];
}

export type ProjectPlanRecord = BudgetaryPlan;

export interface Project {
  id: EntityId;
  code: string;
  name: string;
  clientName: string;
  targetProduct: string;
  productCategory: string;
  productSubCategory: string;
  moreSubCategory: string;
  productMoreSubCategory?: string;
  status: 'Draft' | 'Budget Approved' | 'In Execution' | 'Review' | 'Completed' | 'Proposal' | 'Contract Signed & Locked' | string;
  startDate: string;
  deliveryDeadline: string;
  quotedPrice: number;
  targetMarginPct: number;
  overheadPct: number;
  contingencyPct: number;
  phases: ProjectPhase[];
  selectedItems: ProjectCostItem[];
  alternativeOptions?: AlternativeOption[];
  deliverables?: ProjectDeliverableItem[];
  budgetaryPlans?: BudgetaryPlan[];
  activePlanId?: string;
  contractLocked?: boolean;
  analytics?: ProjectProfitabilityMetrics;
  themeId?: string;
  customGradient?: string;
  imageUrl?: string;
  currency?: string;
  notes: string;
  createdDate: string;
}

export type UserRole = 'ADMIN' | 'PROJECT_MANAGER';

export interface AppUser {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  password?: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
  lastLogin?: string;
  avatarUrl?: string;
  authProvider?: 'password' | 'google';
  googleEmail?: string;
  themePreference?: 'light' | 'dark' | 'system';
}

export interface AccountRequest {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  requestedRole: UserRole;
  reason: string;
  submittedAt: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

export interface CompanyDetails {
  name: string;
  registrationNumber: string;
  taxId: string;
  email: string;
  phone: string;
  address: string;
  city?: string;
  country?: string;
  website: string;
  currency: string;
  logoUrl?: string;
  logoPosition: 'left' | 'right' | 'top_left' | string;
  tagline?: string;
}

export interface AuditLogRecord {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole | string;
  action: string;
  actionType?: string;
  module: 'Inventory' | 'Materials' | 'Users' | 'Settings' | 'Auth' | 'Projects' | 'Catalog' | 'Commercial' | 'Overheads' | 'Procurement' | 'Tariffs' | string;
  recordId?: string;
  recordName?: string;
  entityType?: string;
  entityId?: string;
  projectId?: string;
  planId?: string;
  requestId?: string;
  correlationId?: string;
  changeReason?: string;
  beforeState?: Record<string, any> | null;
  afterState?: Record<string, any> | null;
  diff?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  userAgent?: string;
  details: string;
  ipAddress: string;
  status: 'Success' | 'Warning' | 'Failed';
  createdAtTs?: string;
}

export interface CalendarEvent {
  id: string;
  year: number;
  month: number; // 0-indexed (9 = Oct)
  day: number;
  time: string;
  title: string;
  location: string;
  category: 'Audit' | 'Review' | 'Phase' | 'Stock' | 'Tariff' | 'Deadline' | 'Milestone' | 'Deliverable';
  badgeColor?: string;
  projectId?: string;
  projectCode?: string;
  projectName?: string;
  phaseId?: string;
  phaseName?: string;
  milestoneType?: 'project_deadline' | 'phase_start' | 'phase_end' | 'deliverable' | 'event';
  status?: string;
  budget?: number;
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: 'project_deadline' | 'project_start' | 'phase_start' | 'phase_end' | 'deliverable' | 'custom';
  phaseId?: string;
  phaseName?: string;
  status: 'Completed' | 'In Progress' | 'Not Started' | 'Overdue';
  budget?: number;
  description?: string;
}

// ============================================================================
// Centralized Revenue Catalogue & Commercial Rate Tracking (TASK 3)
// ============================================================================

export interface RevenueCategory {
  id: string;
  code: string;
  name: string;
  type?: 'product' | 'service' | 'both';
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RevenueSubcategory {
  id: string;
  categoryId: string;
  categoryName?: string;
  code: string;
  name: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RevenueItem {
  id: string;
  code: string;
  barcode?: string;
  name: string;
  type: 'product' | 'service';
  category: string;
  subCategory?: string;
  description?: string;
  unit: string;
  defaultRate: number; // default selling rate
  costPrice?: number;
  currency?: string;
  taxTreatment?: string;
  taxRatePct?: number;
  status: 'Active' | 'Inactive' | 'Archived';
  createdAt?: string;
  updatedAt?: string;
  linkedPlansCount?: number;
  totalQuotedRevenue?: number;
}

export interface RevenueRateHistoryRecord {
  id: string;
  revenueItemId: string;
  revenueItemCode?: string;
  revenueItemName?: string;
  revenueItemType?: 'product' | 'service';
  projectId: string;
  projectCode?: string;
  projectName?: string;
  projectPlanId: string;
  planNumber?: string;
  planName?: string;
  planBoqItemId: string;
  previousUnit?: string | null;
  newUnit: string;
  previousQuantity?: number | null;
  newQuantity: number;
  previousRate?: number | null;
  newRate: number;
  changeType: 'initial_addition' | 'rate_change' | 'quantity_change' | 'unit_change' | 'rate_and_quantity_change' | 'commercial_terms_update' | string;
  fieldsChanged: string[];
  effectiveDate: string;
  recordedAt: string;
  changedBy: string;
  changeReason?: string;
  commercialContext?: string;
  idempotencyKey?: string;
}

export type ProcurementPriceType =
  | 'supplier_quotation'
  | 'negotiated_price'
  | 'purchase_order_price'
  | 'actual_invoiced_price'
  | 'subcontractor_quotation'
  | 'agreed_subcontract_rate'
  | 'catalog_price_revision';

export type ProcurementCostStage = 'estimated' | 'quoted' | 'committed' | 'actual';

export type ProcurementItemType = 'material' | 'outsourced_service' | 'subcontractor_rate' | 'procurement_item';

export interface ProcurementPriceRecord {
  id: string;
  supplierId: string;
  supplierName: string;
  itemType: ProcurementItemType;
  itemId: string;
  itemCode?: string;
  itemName: string;
  category?: string;
  subCategory?: string;
  materialId?: string;
  outsourcedServiceId?: string;
  subcontractorId?: string;
  projectId?: string;
  projectCode?: string;
  projectName?: string;
  projectPlanId?: string;
  planNumber?: string;
  planName?: string;
  unit: string;
  unitPrice: number;
  currency: string;
  effectiveDate: string;
  recordedAt: string;
  quotationRef?: string;
  validFrom?: string;
  validUntil?: string;
  recordedBy: string;
  notes?: string;
  priceType: ProcurementPriceType;
  costStage: ProcurementCostStage;
  isConfirmedPurchase: boolean;
  leadTimeDays?: number;
  moq?: number;
  previousPrice?: number;
  priceChangeAmount?: number;
  priceChangePct?: number;
  idempotencyKey?: string;
}

export interface PriceComparisonSummary {
  itemId: string;
  itemCode?: string;
  itemName: string;
  itemType: string;
  unit: string;
  currentPrice: number;
  previousPrice?: number;
  priceChangePct?: number;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  currency: string;
  totalRecordsCount: number;
  latestRecord?: ProcurementPriceRecord;
  history: ProcurementPriceRecord[];
}

// ============================================================================
// SYSTEM-WIDE BARCODE REGISTRY & SCANNING INTERFACES (TASK 7)
// ============================================================================

export type BarcodeEntityType =
  | 'material'
  | 'revenue_product'
  | 'revenue_service'
  | 'overhead_item'
  | 'supplier'
  | 'outsourced_service'
  | 'subcontractor'
  | 'produce_item'
  | 'inventory_item'
  | 'client';

export interface BarcodeRegistryEntry {
  barcode: string;
  entityType: BarcodeEntityType;
  entityId: string;
  entityCode: string;
  entityName: string;
  category?: string;
  subCategory?: string;
  unit?: string;
  unitCost?: number;
  sellingRate?: number;
  currency?: string;
  isCostEligible: boolean;
  isBoqEligible: boolean;
  isDirectoryOnly?: boolean;
  metadata?: any;
  createdAt?: string;
  updatedAt?: string;
}

export interface BarcodeLookupResult {
  found: boolean;
  exactBarcodeMatch?: boolean;
  matchType?: 'exact_barcode' | 'entity_code' | 'name_fallback' | 'multiple_matches';
  barcode?: string;
  entityType?: BarcodeEntityType;
  entityId?: string;
  entityCode?: string;
  entityName?: string;
  category?: string;
  subCategory?: string;
  unit?: string;
  unitCost?: number;
  sellingRate?: number;
  currency?: string;
  isCostEligible?: boolean;
  isBoqEligible?: boolean;
  isDirectoryOnly?: boolean;
  rawRecord?: any;
  message?: string;
  code?: string;
  otherMatches?: Array<{
    barcode: string;
    entityType: BarcodeEntityType;
    entityId: string;
    entityCode: string;
    entityName: string;
  }>;
}

// ============================================================================
// TARIFF MANAGEMENT INTERFACES (TASK 9)
// ============================================================================

export type TariffCalculationMethod = 'percentage' | 'unit_rate' | 'fixed_charge' | 'tiered_volume' | 'hybrid';
export type TariffApplicableBase = 'material_cost' | 'labour_cost' | 'outsourced_cost' | 'total_direct_cost' | 'total_revenue' | 'quantity' | 'fixed';
export type TariffStatus = 'Active' | 'Inactive' | 'Archived' | 'Pending';

export interface Tariff {
  id: string;
  code: string;
  name: string;
  category: string;
  calculationMethod: TariffCalculationMethod;
  rateOrPercentage: number;
  fixedCharge?: number;
  unit: string;
  applicableBase: TariffApplicableBase;
  currency: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: TariffStatus;
  sourceReference?: string;
  description?: string;
  notes?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  versionsCount?: number;
  currentVersion?: TariffVersion;
  versions?: TariffVersion[];
}

export interface TariffVersion {
  id: string;
  tariffId: string;
  tariffCode: string;
  versionNumber: number;
  rateOrPercentage: number;
  fixedCharge?: number;
  calculationMethod: TariffCalculationMethod;
  applicableBase: TariffApplicableBase;
  unit: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: 'Active' | 'Superseded' | 'Draft' | 'Archived';
  sourceReference?: string;
  changeReason?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanTariff {
  id: string;
  planId: string;
  projectId: string;
  tariffId: string;
  tariffVersionId: string;
  tariffCode: string;
  tariffName: string;
  tariffCategory: string;
  calculationMethod: TariffCalculationMethod;
  applicableBase: TariffApplicableBase;
  rateOrPercentage: number;
  fixedCharge?: number;
  unit?: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  baseAmount: number;
  calculatedTariffAmount: number;
  appliedDate: string;
  appliedBy: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
