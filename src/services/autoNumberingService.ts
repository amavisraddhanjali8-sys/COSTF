/**
 * Auto-Numbering Configuration and Sequence Generation Service
 * Enables customizable unique ID patterns across all enterprise entities.
 */
import { bizStore } from './bizStore';

export type AutoNumberEntityType =
  | 'materials'
  | 'inventory'
  | 'inventory_in'
  | 'inventory_out'
  | 'batch_lot'
  | 'projects'
  | 'plans'
  | 'revisions'
  | 'deliverables'
  | 'subcontractors'
  | 'outsourced'
  | 'suppliers'
  | 'contracts'
  | 'produce'
  | 'overheads'
  | 'overhead_categories'
  | 'revenue'
  | 'revenue_categories'
  | 'tariffs'
  | 'clients'
  | 'users'
  | 'resources'
  | 'quotes'
  | 'competitors'
  | 'barcodes'
  | string;

export interface AutoNumberRule {
  entityKey: AutoNumberEntityType;
  entityType?: AutoNumberEntityType;
  label: string;
  prefix: string;
  suffix: string;
  padding: number; // e.g. 4 -> "0001"
  paddingDigits?: number;
  nextNumber: number; // e.g. 1001
  description: string;
  sampleExample: string;
  categoryGroup?:
    | 'procurement_inventory'
    | 'projects_planning'
    | 'labor_services'
    | 'overheads_cost'
    | 'commercial_revenue'
    | 'tariffs_regulatory'
    | 'partners_vendors'
    | 'system_security'
    | string;
  active?: boolean;
  isCustom?: boolean;
}

/**
 * Enterprise Canonical Alias Mapping
 * Guarantees that any entity alias or plural/singular variant resolves to the correct rule.
 */
export const ENTITY_ALIAS_MAP: Record<string, string> = {
  material: 'materials',
  materials: 'materials',
  inventory: 'inventory',
  inventory_sku: 'inventory',
  inventory_item: 'inventory',
  inventory_in: 'inventory_in',
  grn: 'inventory_in',
  inventory_receipt: 'inventory_in',
  inventory_out: 'inventory_out',
  gin: 'inventory_out',
  inventory_dispatch: 'inventory_out',
  batch_lot: 'batch_lot',
  lot: 'batch_lot',
  batch: 'batch_lot',
  project: 'projects',
  projects: 'projects',
  plan: 'plans',
  plans: 'plans',
  project_plan: 'plans',
  project_plans: 'plans',
  budget_plan: 'plans',
  revision: 'revisions',
  revisions: 'revisions',
  plan_revision: 'revisions',
  plan_revisions: 'revisions',
  deliverable: 'deliverables',
  deliverables: 'deliverables',
  project_deliverable: 'deliverables',
  project_deliverables: 'deliverables',
  milestone: 'deliverables',
  subcontractor: 'subcontractors',
  subcontractors: 'subcontractors',
  trade: 'subcontractors',
  outsourced: 'outsourced',
  outsourced_service: 'outsourced',
  outsourced_services: 'outsourced',
  service: 'outsourced',
  supplier: 'suppliers',
  suppliers: 'suppliers',
  vendor: 'suppliers',
  contract: 'contracts',
  contracts: 'contracts',
  supplier_contract: 'contracts',
  supplier_contracts: 'contracts',
  produce: 'produce',
  product: 'produce',
  products: 'produce',
  overhead: 'overheads',
  overheads: 'overheads',
  overhead_item: 'overheads',
  overhead_items: 'overheads',
  overhead_category: 'overhead_categories',
  overhead_categories: 'overhead_categories',
  revenue: 'revenue',
  revenue_item: 'revenue',
  revenue_items: 'revenue',
  boq: 'revenue',
  boq_item: 'revenue',
  revenue_category: 'revenue_categories',
  revenue_categories: 'revenue_categories',
  tariff: 'tariffs',
  tariffs: 'tariffs',
  client: 'clients',
  clients: 'clients',
  customer: 'clients',
  user: 'users',
  users: 'users',
  employee: 'users',
  employees: 'users',
  resource: 'resources',
  resources: 'resources',
  enterprise_resource: 'resources',
  quote: 'quotes',
  quotes: 'quotes',
  vendor_quote: 'quotes',
  competitor: 'competitors',
  competitors: 'competitors',
  barcode: 'barcodes',
  barcodes: 'barcodes'
};

/**
 * All required Auto-Numbering Rules across the entire enterprise application
 */
export const DEFAULT_AUTONUMBER_RULES: AutoNumberRule[] = [
  {
    entityKey: 'materials',
    entityType: 'material',
    label: 'Materials Master Code',
    prefix: 'MAT-',
    suffix: '',
    padding: 4,
    paddingDigits: 4,
    nextNumber: 1045,
    description: 'Auto-assigned code for raw materials, engineering alloys, and hardware',
    sampleExample: 'MAT-1045',
    categoryGroup: 'procurement_inventory',
    active: true
  },
  {
    entityKey: 'inventory',
    entityType: 'inventory',
    label: 'Inventory Item SKU',
    prefix: 'SKU-INV-',
    suffix: '',
    padding: 4,
    paddingDigits: 4,
    nextNumber: 2050,
    description: 'Central inventory tracking number and storage location barcode tag',
    sampleExample: 'SKU-INV-2050',
    categoryGroup: 'procurement_inventory',
    active: true
  },
  {
    entityKey: 'inventory_in',
    entityType: 'inventory_in',
    label: 'Inventory IN Receipt (GRN)',
    prefix: 'GRN-',
    suffix: '-LKR',
    padding: 5,
    paddingDigits: 5,
    nextNumber: 5001,
    description: 'Goods Received Note unique reference for materials entering inventory',
    sampleExample: 'GRN-05001-LKR',
    categoryGroup: 'procurement_inventory',
    active: true
  },
  {
    entityKey: 'inventory_out',
    entityType: 'inventory_out',
    label: 'Inventory OUT Dispatch (GIN)',
    prefix: 'GIN-',
    suffix: '-DISP',
    padding: 5,
    paddingDigits: 5,
    nextNumber: 3001,
    description: 'Goods Issued Note unique reference for materials leaving inventory to projects',
    sampleExample: 'GIN-03001-DISP',
    categoryGroup: 'procurement_inventory',
    active: true
  },
  {
    entityKey: 'batch_lot',
    entityType: 'batch_lot',
    label: 'Batch & Lot Reference Number',
    prefix: 'LOT-',
    suffix: '',
    padding: 5,
    paddingDigits: 5,
    nextNumber: 8001,
    description: 'Unique batch traceability number linked across transactions and suppliers',
    sampleExample: 'LOT-08001',
    categoryGroup: 'procurement_inventory',
    active: true
  },
  {
    entityKey: 'projects',
    entityType: 'project',
    label: 'Project Identification Code',
    prefix: 'PRJ-LK-',
    suffix: '',
    padding: 3,
    paddingDigits: 3,
    nextNumber: 108,
    description: 'Commercial project reference code for budgeting, milestones, and deliverables',
    sampleExample: 'PRJ-LK-108',
    categoryGroup: 'projects_planning',
    active: true
  },
  {
    entityKey: 'plans',
    entityType: 'project_plan',
    label: 'Project Budget Plan Reference',
    prefix: 'PLN-',
    suffix: '',
    padding: 4,
    paddingDigits: 4,
    nextNumber: 1001,
    description: 'Master project multi-phase cost scenario and budgetary baseline plan reference',
    sampleExample: 'PLN-1001',
    categoryGroup: 'projects_planning',
    active: true
  },
  {
    entityKey: 'revisions',
    entityType: 'plan_revision',
    label: 'Budget Plan Revision ID',
    prefix: 'REV-',
    suffix: '',
    padding: 3,
    paddingDigits: 3,
    nextNumber: 101,
    description: 'Sequential revision snapshot tracking code for budget amendments and audits',
    sampleExample: 'REV-101',
    categoryGroup: 'projects_planning',
    active: true
  },
  {
    entityKey: 'deliverables',
    entityType: 'project_deliverable',
    label: 'Project Deliverable Code',
    prefix: 'DLV-',
    suffix: '',
    padding: 4,
    paddingDigits: 4,
    nextNumber: 1001,
    description: 'Work breakdown structure deliverable milestone and shipment release code',
    sampleExample: 'DLV-1001',
    categoryGroup: 'projects_planning',
    active: true
  },
  {
    entityKey: 'subcontractors',
    entityType: 'subcontractor',
    label: 'Subcontractor Rate Schedule ID',
    prefix: 'SUB-RATE-',
    suffix: '',
    padding: 4,
    paddingDigits: 4,
    nextNumber: 4015,
    description: 'Unique trade contractor labour code and SLA schedule reference',
    sampleExample: 'SUB-RATE-4015',
    categoryGroup: 'labor_services',
    active: true
  },
  {
    entityKey: 'outsourced',
    entityType: 'outsourced_service',
    label: 'Outsourced Service Tariff Code',
    prefix: 'OUT-SVC-',
    suffix: '',
    padding: 4,
    paddingDigits: 4,
    nextNumber: 6020,
    description: 'Unique carrier, utility, and external inspection service contract number',
    sampleExample: 'OUT-SVC-6020',
    categoryGroup: 'labor_services',
    active: true
  },
  {
    entityKey: 'resources',
    entityType: 'enterprise_resource',
    label: 'Enterprise Resource Master ID',
    prefix: 'RES-',
    suffix: '',
    padding: 4,
    paddingDigits: 4,
    nextNumber: 1001,
    description: 'Central plant machinery, specialized craft labor, and fabrication equipment code',
    sampleExample: 'RES-1001',
    categoryGroup: 'labor_services',
    active: true
  },
  {
    entityKey: 'suppliers',
    entityType: 'supplier',
    label: 'Supplier Registration ID',
    prefix: 'SUP-VEN-',
    suffix: '',
    padding: 4,
    paddingDigits: 4,
    nextNumber: 1012,
    description: 'Vendor master directory number and procurement account reference',
    sampleExample: 'SUP-VEN-1012',
    categoryGroup: 'partners_vendors',
    active: true
  },
  {
    entityKey: 'contracts',
    entityType: 'supplier_contract',
    label: 'Supplier Commercial Contract No',
    prefix: 'CNT-',
    suffix: '',
    padding: 4,
    paddingDigits: 4,
    nextNumber: 2001,
    description: 'Master vendor procurement framework agreement and legal contract identifier',
    sampleExample: 'CNT-2001',
    categoryGroup: 'partners_vendors',
    active: true
  },
  {
    entityKey: 'quotes',
    entityType: 'vendor_quote',
    label: 'Vendor Price Quote Ref',
    prefix: 'QTE-',
    suffix: '',
    padding: 4,
    paddingDigits: 4,
    nextNumber: 5001,
    description: 'Supplier price quotation reference and procurement audit record identifier',
    sampleExample: 'QTE-5001',
    categoryGroup: 'partners_vendors',
    active: true
  },
  {
    entityKey: 'competitors',
    entityType: 'competitor',
    label: 'Competitor Benchmark ID',
    prefix: 'CMP-',
    suffix: '',
    padding: 4,
    paddingDigits: 4,
    nextNumber: 1001,
    description: 'Market competitor enterprise tracking code and benchmark quote profile',
    sampleExample: 'CMP-1001',
    categoryGroup: 'partners_vendors',
    active: true
  },
  {
    entityKey: 'produce',
    entityType: 'produce',
    label: 'Produced Product / Service Code',
    prefix: 'PRD-SYS-',
    suffix: '',
    padding: 4,
    paddingDigits: 4,
    nextNumber: 7030,
    description: 'Internal manufacturing product catalogue and produced assembly reference',
    sampleExample: 'PRD-SYS-7030',
    categoryGroup: 'procurement_inventory',
    active: true
  },
  {
    entityKey: 'overheads',
    entityType: 'overhead_item',
    label: 'Overhead Cost Item Code',
    prefix: 'OVH-',
    suffix: '',
    padding: 4,
    paddingDigits: 4,
    nextNumber: 1001,
    description: 'Factory, indirect operational, and administrative overhead line item code',
    sampleExample: 'OVH-1001',
    categoryGroup: 'overheads_cost',
    active: true
  },
  {
    entityKey: 'overhead_categories',
    entityType: 'overhead_category',
    label: 'Overhead Category Code',
    prefix: 'OVH-CAT-',
    suffix: '',
    padding: 3,
    paddingDigits: 3,
    nextNumber: 101,
    description: 'Operational overhead cost center and category classification code',
    sampleExample: 'OVH-CAT-101',
    categoryGroup: 'overheads_cost',
    active: true
  },
  {
    entityKey: 'revenue',
    entityType: 'revenue_item',
    label: 'Revenue / BOQ Item Code',
    prefix: 'REV-',
    suffix: '',
    padding: 4,
    paddingDigits: 4,
    nextNumber: 2001,
    description: 'Commercial Bill of Quantities (BOQ) revenue catalogue item code',
    sampleExample: 'REV-2001',
    categoryGroup: 'commercial_revenue',
    active: true
  },
  {
    entityKey: 'revenue_categories',
    entityType: 'revenue_category',
    label: 'Revenue Category Code',
    prefix: 'REV-CAT-',
    suffix: '',
    padding: 3,
    paddingDigits: 3,
    nextNumber: 101,
    description: 'Commercial sales catalog and BOQ category grouping code',
    sampleExample: 'REV-CAT-101',
    categoryGroup: 'commercial_revenue',
    active: true
  },
  {
    entityKey: 'tariffs',
    entityType: 'tariff',
    label: 'Tariff / Regulatory Tariff Schedule',
    prefix: 'TRF-',
    suffix: '',
    padding: 4,
    paddingDigits: 4,
    nextNumber: 1001,
    description: 'Statutory customs duties, port handling charges, and regulatory tariff schedules',
    sampleExample: 'TRF-1001',
    categoryGroup: 'tariffs_regulatory',
    active: true
  },
  {
    entityKey: 'clients',
    entityType: 'client',
    label: 'Client Enterprise Account Code',
    prefix: 'CLI-',
    suffix: '',
    padding: 4,
    paddingDigits: 4,
    nextNumber: 1001,
    description: 'Commercial client enterprise account number and corporate buyer code',
    sampleExample: 'CLI-1001',
    categoryGroup: 'commercial_revenue',
    active: true
  },
  {
    entityKey: 'users',
    entityType: 'employee',
    label: 'Employee / User Staff ID',
    prefix: 'EMP-',
    suffix: '',
    padding: 4,
    paddingDigits: 4,
    nextNumber: 1001,
    description: 'Internal employee identification badge and system operator access code',
    sampleExample: 'EMP-1001',
    categoryGroup: 'system_security',
    active: true
  },
  {
    entityKey: 'barcodes',
    entityType: 'barcode',
    label: 'Universal System Barcode',
    prefix: 'BC-',
    suffix: '',
    padding: 5,
    paddingDigits: 5,
    nextNumber: 10001,
    description: 'Registered standard EAN/Code-128 physical barcode scanner label',
    sampleExample: 'BC-10001',
    categoryGroup: 'procurement_inventory',
    active: true
  }
];

const AUTONUMBER_STORAGE_KEY = 'remix_enterprise_autonumber_rules_v1';

/**
 * Normalizes rule to ensure backward and forward compatibility
 */
function normalizeRule(rule: Partial<AutoNumberRule>, defaultRule?: AutoNumberRule): AutoNumberRule {
  const entityKey = rule.entityKey || defaultRule?.entityKey || 'custom';
  const entityType = rule.entityType || defaultRule?.entityType || entityKey;
  const padding = rule.paddingDigits || rule.padding || defaultRule?.padding || 4;
  const nextNumber = typeof rule.nextNumber === 'number' && rule.nextNumber > 0 ? rule.nextNumber : defaultRule?.nextNumber || 1001;
  const prefix = rule.prefix !== undefined ? rule.prefix : defaultRule?.prefix || '';
  const suffix = rule.suffix !== undefined ? rule.suffix : defaultRule?.suffix || '';
  const label = rule.label || defaultRule?.label || entityKey;
  const description = rule.description || defaultRule?.description || '';
  const categoryGroup = rule.categoryGroup || defaultRule?.categoryGroup || 'procurement_inventory';
  const active = rule.active !== undefined ? rule.active : true;
  const isCustom = rule.isCustom !== undefined ? rule.isCustom : (defaultRule ? false : true);

  const normalized: AutoNumberRule = {
    entityKey,
    entityType,
    label,
    prefix,
    suffix,
    padding,
    paddingDigits: padding,
    nextNumber,
    description,
    categoryGroup,
    active,
    isCustom,
    sampleExample: ''
  };

  normalized.sampleExample = formatWithRule(normalized);
  return normalized;
}

/**
 * Resolves any alias to its canonical entityKey
 */
export function resolveCanonicalKey(keyOrAlias: string): string {
  const clean = String(keyOrAlias || '').trim().toLowerCase();
  return ENTITY_ALIAS_MAP[clean] || clean;
}

/**
 * Find rule in list matching key or alias
 */
export function findMatchingRule(rules: AutoNumberRule[], entityKeyOrType: string): AutoNumberRule | undefined {
  const canonical = resolveCanonicalKey(entityKeyOrType);
  return (
    rules.find((r) => r.entityKey === canonical) ||
    rules.find((r) => r.entityType === canonical) ||
    rules.find((r) => r.entityKey.toLowerCase() === entityKeyOrType.toLowerCase()) ||
    rules.find((r) => (r.entityType || '').toLowerCase() === entityKeyOrType.toLowerCase())
  );
}

/**
 * Get all configured auto-numbering rules from localStorage or defaults
 */
export function getStoredAutoNumberRules(): AutoNumberRule[] {
  try {
    const raw = bizStore.getItem(AUTONUMBER_STORAGE_KEY);
    if (!raw) return DEFAULT_AUTONUMBER_RULES;
    const parsed = JSON.parse(raw) as Partial<AutoNumberRule>[];
    if (!Array.isArray(parsed)) return DEFAULT_AUTONUMBER_RULES;

    // 1. Ensure all standard defaults are included with user customization preserved
    const merged = DEFAULT_AUTONUMBER_RULES.map((def) => {
      const existing = parsed.find(
        (p) =>
          p.entityKey === def.entityKey ||
          p.entityType === def.entityType ||
          (p.entityKey && resolveCanonicalKey(p.entityKey) === def.entityKey)
      );
      return normalizeRule(existing || def, def);
    });

    // 2. Preserve any user-created custom rules
    const defaultKeySet = new Set(DEFAULT_AUTONUMBER_RULES.map((d) => d.entityKey));
    const customRules = parsed
      .filter((p) => p.entityKey && !defaultKeySet.has(p.entityKey) && !defaultKeySet.has(resolveCanonicalKey(p.entityKey)))
      .map((p) => normalizeRule(p));

    return [...merged, ...customRules];
  } catch (err) {
    console.warn('Failed to load auto-number rules, using defaults', err);
    return DEFAULT_AUTONUMBER_RULES;
  }
}

/**
 * Save updated auto-numbering rules to localStorage and broadcast change event
 */
export function saveStoredAutoNumberRules(rules: AutoNumberRule[]): void {
  try {
    const normalized = rules.map((r) => {
      const def = DEFAULT_AUTONUMBER_RULES.find((d) => d.entityKey === r.entityKey || d.entityType === r.entityType);
      return normalizeRule(r, def);
    });
    bizStore.setItem(AUTONUMBER_STORAGE_KEY, JSON.stringify(normalized));

    // Broadcast across windows/tabs and components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fxtt_autonumber_rules_updated', { detail: normalized }));
    }
  } catch (err) {
    console.error('Failed to save auto-number rules', err);
  }
}

export const saveAutoNumberRules = saveStoredAutoNumberRules;

/**
 * Reset all auto-numbering rules to enterprise defaults
 */
export function resetAutoNumberRules(): AutoNumberRule[] {
  saveStoredAutoNumberRules(DEFAULT_AUTONUMBER_RULES);
  return DEFAULT_AUTONUMBER_RULES;
}

/**
 * Format a number using a rule's prefix, padding, and suffix
 */
export function formatWithRule(rule: AutoNumberRule, num?: number): string {
  const targetNum = num !== undefined ? num : rule.nextNumber;
  const padding = rule.paddingDigits || rule.padding || 4;
  const numStr = String(targetNum).padStart(Math.max(1, padding), '0');
  return `${rule.prefix || ''}${numStr}${rule.suffix || ''}`;
}

/**
 * Generate preview sample text for a rule
 */
export function generateSampleNumber(rule: AutoNumberRule): string {
  return formatWithRule(rule);
}

/**
 * Peek what the next number will look like without incrementing the counter
 */
export function peekNextNumber(entityKeyOrType: string): string {
  const rules = getStoredAutoNumberRules();
  const rule = findMatchingRule(rules, entityKeyOrType);
  if (!rule) {
    const canonical = resolveCanonicalKey(entityKeyOrType);
    return `${canonical.toUpperCase()}-0001`;
  }
  return formatWithRule(rule);
}

/**
 * Generate the next formatted unique number for an entity and increment its counter
 */
export function generateNextNumber(entityKeyOrType: string, increment: boolean = true): string {
  const rules = getStoredAutoNumberRules();
  const canonical = resolveCanonicalKey(entityKeyOrType);
  const index = rules.findIndex(
    (r) =>
      r.entityKey === canonical ||
      r.entityType === canonical ||
      r.entityKey.toLowerCase() === entityKeyOrType.toLowerCase() ||
      (r.entityType || '').toLowerCase() === entityKeyOrType.toLowerCase()
  );

  if (index === -1) {
    return `${canonical.toUpperCase()}-${Date.now().toString().slice(-4)}`;
  }

  const rule = rules[index];
  const generatedId = formatWithRule(rule);

  if (increment) {
    rules[index] = {
      ...rule,
      nextNumber: rule.nextNumber + 1
    };
    rules[index].sampleExample = formatWithRule(rules[index]);
    saveStoredAutoNumberRules(rules);
  }

  return generatedId;
}

/**
 * Update a specific auto-number rule in settings
 */
export function updateAutoNumberRule(
  entityKeyOrType: string,
  updates: Partial<AutoNumberRule>
): AutoNumberRule[] {
  const rules = getStoredAutoNumberRules();
  const canonical = resolveCanonicalKey(entityKeyOrType);
  const updated = rules.map((r) => {
    if (r.entityKey === canonical || r.entityType === canonical || r.entityKey === entityKeyOrType) {
      const def = DEFAULT_AUTONUMBER_RULES.find((d) => d.entityKey === r.entityKey);
      const merged = normalizeRule({ ...r, ...updates }, def);
      return merged;
    }
    return r;
  });
  saveStoredAutoNumberRules(updated);
  return updated;
}

/**
 * Reset a single auto-numbering rule back to default settings
 */
export function resetAutoNumberRule(entityKeyOrType: string): AutoNumberRule[] {
  const canonical = resolveCanonicalKey(entityKeyOrType);
  const defaultRule = DEFAULT_AUTONUMBER_RULES.find((r) => r.entityKey === canonical || r.entityType === canonical);
  if (!defaultRule) return getStoredAutoNumberRules();
  return updateAutoNumberRule(canonical, defaultRule);
}

/**
 * Add a new custom auto-number rule
 */
export function addCustomAutoNumberRule(rule: Partial<AutoNumberRule>): AutoNumberRule[] {
  const rules = getStoredAutoNumberRules();
  const entityKey = (rule.entityKey || `custom_${Date.now()}`).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const normalized = normalizeRule({
    ...rule,
    entityKey,
    entityType: entityKey,
    isCustom: true
  });
  const filtered = rules.filter((r) => r.entityKey !== entityKey);
  const updated = [...filtered, normalized];
  saveStoredAutoNumberRules(updated);
  return updated;
}

/**
 * Delete a custom auto-number rule
 */
export function deleteCustomAutoNumberRule(entityKey: string): AutoNumberRule[] {
  const rules = getStoredAutoNumberRules();
  const updated = rules.filter((r) => r.entityKey !== entityKey);
  saveStoredAutoNumberRules(updated);
  return updated;
}
