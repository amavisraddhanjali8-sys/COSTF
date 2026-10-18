/**
 * Persistent Static & Stable Central Database Service
 * Uses a robust local persistence layer with automatic initial seeding.
 * Ensures zero downtime on browser reload / system refresh.
 * Links all inventory transactions with unique numbers to central item, supplier, and project records.
 */

import {
  MaterialItem,
  Supplier,
  OutsourcedService,
  SubcontractorRateItem,
  InventoryItem,
  InventoryTransaction,
  Project,
  ProduceItem,
  CalendarEvent
} from '../types';

import {
  INITIAL_MATERIALS,
  INITIAL_SUPPLIERS,
  INITIAL_OUTSOURCED_SERVICES,
  INITIAL_SUBCONTRACTORS,
  INITIAL_INVENTORY,
  INITIAL_PROJECTS,
  INITIAL_PRODUCE_ITEMS
} from '../data/initialData';

import { CategoryNode, ClientProfile, INITIAL_CLIENT_PROFILES } from '../data/categoriesAndProfiles';
import { bizStore } from './bizStore';
import { getStoredAutoNumberRules, saveStoredAutoNumberRules } from './autoNumberingService';
import { getStoredCompanyDetails, saveStoredCompanyDetails } from '../data/userAndAuditData';

const DB_KEYS = {
  MATERIALS: 'remix_db_materials_v3',
  SUPPLIERS: 'remix_db_suppliers_v3',
  OUTSOURCED: 'remix_db_outsourced_v3',
  SUBCONTRACTORS: 'remix_db_subcontractors_v3',
  INVENTORY: 'remix_db_inventory_v3',
  TRANSACTIONS: 'remix_db_transactions_v3',
  PROJECTS: 'remix_db_projects_v3',
  PRODUCE: 'remix_db_produce_v3',
  CATEGORIES: 'remix_db_categories_v3',
  CUSTOM_TILES: 'remix_db_custom_tiles_v3',
  CALENDAR_EVENTS: 'remix_db_calendar_events_v3',
  CLIENTS: 'remix_db_clients_v3',
  INITIALIZED: 'remix_db_initialized_flag_v3'
};

export const INITIAL_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'ev-01',
    year: 2026,
    month: 9,
    day: 2,
    time: '10:00 AM',
    title: 'Tariff Audit',
    location: 'Audit Room 1',
    category: 'Tariff',
    badgeColor: 'bg-emerald-500'
  },
  {
    id: 'ev-02',
    year: 2026,
    month: 9,
    day: 8,
    time: '09:30 AM',
    title: 'Margin Review',
    location: 'Boardroom',
    category: 'Review',
    badgeColor: 'bg-blue-600'
  },
  {
    id: 'ev-03',
    year: 2026,
    month: 9,
    day: 14,
    time: '02:00 PM',
    title: 'Phase Signoff',
    location: 'Operations Center',
    category: 'Phase',
    badgeColor: 'bg-amber-500'
  },
  {
    id: 'ev-04',
    year: 2026,
    month: 9,
    day: 22,
    time: '11:00 AM',
    title: 'Stock Audit',
    location: 'Central Bay',
    category: 'Stock',
    badgeColor: 'bg-teal-600'
  },
  {
    id: 'ev-05',
    year: 2026,
    month: 9,
    day: 28,
    time: '03:30 PM',
    title: 'Budget Approval',
    location: 'Finance Suite',
    category: 'Audit',
    badgeColor: 'bg-purple-600'
  }
];

// Initial linked transactions in LKR
export const INITIAL_TRANSACTIONS: InventoryTransaction[] = [];

// Seed default categories if none exist in persistent storage
export function buildDefaultCategories(): CategoryNode[] {
  return [
    {
      id: 'mat-cat-01',
      name: 'Metals & Structural Alloys',
      type: 'category',
      group: 'material',
      brief: 'Aerospace grade aluminum, stainless steels, and tool alloys'
    },
    {
      id: 'mat-sub-01-01',
      name: 'Aluminum Bar & Sheet',
      type: 'sub_category',
      group: 'material',
      parentId: 'mat-cat-01',
      brief: '6061-T6 and 7075-T6 structural stocks'
    },
    {
      id: 'mat-sub-01-02',
      name: 'Stainless Steels',
      type: 'sub_category',
      group: 'material',
      parentId: 'mat-cat-01',
      brief: '304 and 316L corrosion resistant grades'
    },
    {
      id: 'mat-cat-02',
      name: 'Polymers & Engineering Plastics',
      type: 'category',
      group: 'material',
      brief: 'Acetal, PEEK, Nylon, and PTFE rods and sheets'
    },
    {
      id: 'mat-sub-02-01',
      name: 'Acetal & Delrin',
      type: 'sub_category',
      group: 'material',
      parentId: 'mat-cat-02',
      brief: 'High-rigidity machinable plastics'
    },
    {
      id: 'mat-cat-03',
      name: 'Fasteners & Precision Hardware',
      type: 'category',
      group: 'material',
      brief: 'Grade 8 socket head bolts, inserts, and dowel pins'
    },
    {
      id: 'mat-sub-03-01',
      name: 'Socket Head Cap Screws',
      type: 'sub_category',
      group: 'material',
      parentId: 'mat-cat-03',
      brief: 'High tensile metric fasteners'
    },
    {
      id: 'prod-cat-01',
      name: 'Precision CNC Machined Parts',
      type: 'category',
      group: 'product',
      brief: 'Tight tolerance aerospace and tooling assemblies'
    },
    {
      id: 'prod-sub-01-01',
      name: '5-Axis Aerospace Brackets',
      type: 'sub_category',
      group: 'product',
      parentId: 'prod-cat-01',
      brief: 'Lightweight high-strength aircraft structural mounts'
    },
    {
      id: 'prod-cat-02',
      name: 'Industrial Automation Fixtures',
      type: 'category',
      group: 'product',
      brief: 'Custom robotic end-effectors and inspection jigs'
    },
    {
      id: 'prod-sub-02-01',
      name: 'Pneumatic Gripper Assemblies',
      type: 'sub_category',
      group: 'product',
      parentId: 'prod-cat-02',
      brief: 'Modular vacuum and jaw pick-and-place end-effectors'
    },
    {
      id: 'sub-cat-01',
      name: 'Precision Machining & Toolmaking',
      type: 'category',
      group: 'subcontractor',
      brief: 'Master machinists and EDM wire specialists'
    },
    {
      id: 'sub-sub-01-01',
      name: 'CNC Milling Specialist',
      type: 'sub_category',
      group: 'subcontractor',
      parentId: 'sub-cat-01',
      brief: 'Level 4 certified aerospace machinist crew'
    },
    {
      id: 'sub-cat-02',
      name: 'Fabrication & TIG Welding',
      type: 'category',
      group: 'subcontractor',
      brief: 'ASME certified structural and pressure pipe welding'
    },
    {
      id: 'sub-sub-02-01',
      name: 'TIG Robotic & Manual Welding',
      type: 'sub_category',
      group: 'subcontractor',
      parentId: 'sub-cat-02',
      brief: 'Titanium and stainless sanitary pipe welding'
    },
    {
      id: 'serv-cat-01',
      name: 'Surface Treatment & Anodizing',
      type: 'category',
      group: 'outsourced',
      brief: 'MIL-A-8625 Hardcoat Type III and chemical conversion'
    },
    {
      id: 'serv-sub-01-01',
      name: 'Hard Anodize Type III',
      type: 'sub_category',
      group: 'outsourced',
      parentId: 'serv-cat-01',
      brief: 'Military specification 50-micron hardcoat'
    },
    {
      id: 'serv-cat-02',
      name: 'Metrology & NDT Inspection',
      type: 'category',
      group: 'outsourced',
      brief: 'Certified Zeiss CMM scan and ultrasonic testing'
    },
    {
      id: 'serv-sub-02-01',
      name: 'Zeiss CMM Inspection',
      type: 'sub_category',
      group: 'outsourced',
      parentId: 'serv-cat-02',
      brief: 'Sub-micron coordinate dimensional verification'
    }
  ];
}

// In memory copies of the lists loaded from the server (PostgreSQL).
// Nothing here is written to browser storage.
const memory = new Map<string, any>();
const SHARED_KEYS = new Set<string>([DB_KEYS.CUSTOM_TILES, DB_KEYS.CALENDAR_EVENTS]);

function getNonEmptyFallback<T>(passedFallback: T[] | undefined, _defaultData?: T[]): T[] {
  return Array.isArray(passedFallback) ? passedFallback : [];
}

function safeGet<T>(key: string, fallback: T): T {
  try {
    if (SHARED_KEYS.has(key)) {
      const raw = bizStore.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    }
    return memory.has(key) ? (memory.get(key) as T) : fallback;
  } catch (err) {
    console.warn(`Could not read ${key}:`, err);
    return fallback;
  }
}

export function syncToBackendDatabase() {
  // Saving is done by the REST API routes
}

function safeSet<T>(key: string, data: T): void {
  try {
    if (SHARED_KEYS.has(key)) bizStore.setItem(key, JSON.stringify(data));
    else memory.set(key, data);
  } catch (err) {
    console.error(`Could not save ${key}:`, err);
  }
}

export const persistentDatabase = {
  // 1. Materials
  getMaterials(fallback?: MaterialItem[]): MaterialItem[] {
    return safeGet<MaterialItem[]>(DB_KEYS.MATERIALS, getNonEmptyFallback(fallback, INITIAL_MATERIALS));
  },
  saveMaterials(items: MaterialItem[]): void {
    safeSet(DB_KEYS.MATERIALS, items);
  },

  // 2. Suppliers
  getSuppliers(fallback?: Supplier[]): Supplier[] {
    return safeGet<Supplier[]>(DB_KEYS.SUPPLIERS, getNonEmptyFallback(fallback, INITIAL_SUPPLIERS));
  },
  saveSuppliers(items: Supplier[]): void {
    safeSet(DB_KEYS.SUPPLIERS, items);
  },

  // 3. Outsourced Services
  getOutsourced(fallback?: OutsourcedService[]): OutsourcedService[] {
    return safeGet<OutsourcedService[]>(DB_KEYS.OUTSOURCED, getNonEmptyFallback(fallback, INITIAL_OUTSOURCED_SERVICES));
  },
  getOutsourcedServices(fallback?: OutsourcedService[]): OutsourcedService[] {
    return this.getOutsourced(fallback);
  },
  saveOutsourced(items: OutsourcedService[]): void {
    safeSet(DB_KEYS.OUTSOURCED, items);
  },
  saveOutsourcedServices(items: OutsourcedService[]): void {
    this.saveOutsourced(items);
  },

  // 4. Subcontractors
  getSubcontractors(fallback?: SubcontractorRateItem[]): SubcontractorRateItem[] {
    return safeGet<SubcontractorRateItem[]>(DB_KEYS.SUBCONTRACTORS, getNonEmptyFallback(fallback, INITIAL_SUBCONTRACTORS));
  },
  saveSubcontractors(items: SubcontractorRateItem[]): void {
    safeSet(DB_KEYS.SUBCONTRACTORS, items);
  },

  // 5. Inventory
  getInventory(fallback?: InventoryItem[]): InventoryItem[] {
    return safeGet<InventoryItem[]>(DB_KEYS.INVENTORY, getNonEmptyFallback(fallback, INITIAL_INVENTORY));
  },
  saveInventory(items: InventoryItem[]): void {
    safeSet(DB_KEYS.INVENTORY, items);
  },

  // 6. Transactions
  getTransactions(fallback?: InventoryTransaction[]): InventoryTransaction[] {
    return safeGet<InventoryTransaction[]>(DB_KEYS.TRANSACTIONS, fallback || INITIAL_TRANSACTIONS);
  },
  saveTransactions(items: InventoryTransaction[]): void {
    safeSet(DB_KEYS.TRANSACTIONS, items);
  },

  // 7. Projects
  getProjects(fallback?: Project[]): Project[] {
    return safeGet<Project[]>(DB_KEYS.PROJECTS, getNonEmptyFallback(fallback, INITIAL_PROJECTS));
  },
  saveProjects(items: Project[]): void {
    safeSet(DB_KEYS.PROJECTS, items);
  },

  // 8. Produce Items
  getProduce(fallback?: ProduceItem[]): ProduceItem[] {
    return safeGet<ProduceItem[]>(DB_KEYS.PRODUCE, getNonEmptyFallback(fallback, INITIAL_PRODUCE_ITEMS));
  },
  getProduceItems(fallback?: ProduceItem[]): ProduceItem[] {
    return this.getProduce(fallback);
  },
  saveProduce(items: ProduceItem[]): void {
    safeSet(DB_KEYS.PRODUCE, items);
  },
  saveProduceItems(items: ProduceItem[]): void {
    this.saveProduce(items);
  },

  // 9. Categories and Sub-categories
  getCategories(fallback?: CategoryNode[]): CategoryNode[] {
    return safeGet<CategoryNode[]>(DB_KEYS.CATEGORIES, getNonEmptyFallback(fallback, buildDefaultCategories()));
  },
  saveCategories(items: CategoryNode[]): void {
    safeSet(DB_KEYS.CATEGORIES, items);
  },

  // 9b. Clients & Customer Profiles
  getClients(fallback?: ClientProfile[]): ClientProfile[] {
    return safeGet<ClientProfile[]>(DB_KEYS.CLIENTS, getNonEmptyFallback(fallback, INITIAL_CLIENT_PROFILES));
  },
  saveClients(items: ClientProfile[]): void {
    safeSet(DB_KEYS.CLIENTS, items);
  },
  addClient(item: ClientProfile): void {
    const list = [item, ...this.getClients().filter(c => c.id !== item.id)];
    this.saveClients(list);
  },
  updateClient(id: string, partial: Partial<ClientProfile>): void {
    const list = this.getClients().map(c => c.id === id ? { ...c, ...partial } : c);
    this.saveClients(list);
  },
  deleteClient(id: string): void {
    const list = this.getClients().filter(c => c.id !== id);
    this.saveClients(list);
  },

  // 10. Custom Hub Tiles
  getCustomTiles<T = any>(fallback: T[] = []): T[] {
    return safeGet<T[]>(DB_KEYS.CUSTOM_TILES, fallback);
  },
  saveCustomTiles<T = any>(tiles: T[]): void {
    safeSet(DB_KEYS.CUSTOM_TILES, tiles);
  },

  // 11. Calendar Events (Persisted)
  getCalendarEvents(fallback?: CalendarEvent[]): CalendarEvent[] {
    return safeGet<CalendarEvent[]>(DB_KEYS.CALENDAR_EVENTS, fallback || []);
  },
  saveCalendarEvents(events: CalendarEvent[]): void {
    safeSet(DB_KEYS.CALENDAR_EVENTS, events);
  },
  addCalendarEvent(event: CalendarEvent): void {
    const list = [...this.getCalendarEvents().filter(e => e.id !== event.id), event];
    this.saveCalendarEvents(list);
  },
  deleteCalendarEvent(id: string): void {
    const list = this.getCalendarEvents().filter(e => e.id !== id);
    this.saveCalendarEvents(list);
  },

  // Direct entity deletion methods
  deleteMaterial(id: string): void {
    const list = this.getMaterials().filter(m => m.id !== id);
    this.saveMaterials(list);
  },
  deleteProduceItem(id: string): void {
    const list = this.getProduce().filter(p => p.id !== id);
    this.saveProduce(list);
  },
  deleteSupplier(id: string): void {
    const list = this.getSuppliers().filter(s => s.id !== id);
    this.saveSuppliers(list);
  },
  deleteOutsourcedService(id: string): void {
    const list = this.getOutsourced().filter(o => o.id !== id);
    this.saveOutsourced(list);
  },
  deleteSubcontractor(id: string): void {
    const list = this.getSubcontractors().filter(s => s.id !== id);
    this.saveSubcontractors(list);
  },
  deleteProject(id: string): void {
    const list = this.getProjects().filter(p => p.id !== id);
    this.saveProjects(list);
  },
  deleteCategory(id: string): void {
    const list = this.getCategories().filter(c => c.id !== id && c.parentId !== id);
    this.saveCategories(list);
  },
  deleteCustomTile(id: string): void {
    const list = this.getCustomTiles().filter((t: any) => t.id !== id);
    this.saveCustomTiles(list);
  },
  deleteTransaction(id: string): void {
    const list = this.getTransactions().filter(t => t.id !== id);
    this.saveTransactions(list);
  },
  updateTransaction(id: string, partial: Partial<InventoryTransaction>): void {
    const list = this.getTransactions().map(t => t.id === id ? { ...t, ...partial } : t);
    this.saveTransactions(list);
  },

  // Direct entity update methods
  updateMaterial(id: string, partial: Partial<MaterialItem>): void {
    const list = this.getMaterials().map(m => m.id === id ? { ...m, ...partial } : m);
    this.saveMaterials(list);
  },
  updateProduceItem(id: string, partial: Partial<ProduceItem>): void {
    const list = this.getProduce().map(p => p.id === id ? { ...p, ...partial } : p);
    this.saveProduce(list);
  },
  updateSupplier(id: string, partial: Partial<Supplier>): void {
    const list = this.getSuppliers().map(s => s.id === id ? { ...s, ...partial } : s);
    this.saveSuppliers(list);
  },
  updateOutsourcedService(id: string, partial: Partial<OutsourcedService>): void {
    const list = this.getOutsourced().map(o => o.id === id ? { ...o, ...partial } : o);
    this.saveOutsourced(list);
  },
  updateSubcontractor(id: string, partial: Partial<SubcontractorRateItem>): void {
    const list = this.getSubcontractors().map(s => s.id === id ? { ...s, ...partial } : s);
    this.saveSubcontractors(list);
  },
  updateProject(id: string, partial: Partial<Project>): void {
    const list = this.getProjects().map(p => p.id === id ? { ...p, ...partial } : p);
    this.saveProjects(list);
  },
  updateCategory(id: string, partial: Partial<CategoryNode>): void {
    const list = this.getCategories().map(c => c.id === id ? { ...c, ...partial } : c);
    this.saveCategories(list);
  },

  // Direct entity add methods
  addMaterial(item: MaterialItem): void {
    const list = [item, ...this.getMaterials().filter(m => m.id !== item.id)];
    this.saveMaterials(list);
  },
  addProduceItem(item: ProduceItem): void {
    const list = [item, ...this.getProduce().filter(p => p.id !== item.id)];
    this.saveProduce(list);
  },
  addSupplier(item: Supplier): void {
    const list = [item, ...this.getSuppliers().filter(s => s.id !== item.id)];
    this.saveSuppliers(list);
  },
  addOutsourcedService(item: OutsourcedService): void {
    const list = [item, ...this.getOutsourced().filter(o => o.id !== item.id)];
    this.saveOutsourced(list);
  },
  addSubcontractor(item: SubcontractorRateItem): void {
    const list = [item, ...this.getSubcontractors().filter(s => s.id !== item.id)];
    this.saveSubcontractors(list);
  },
  addProject(item: Project): void {
    const list = [item, ...this.getProjects().filter(p => p.id !== item.id)];
    this.saveProjects(list);
  },
  addCategory(node: CategoryNode): void {
    const list = [node, ...this.getCategories().filter(c => c.id !== node.id)];
    this.saveCategories(list);
  },

  // Database Connection Diagnostic Info
  getConnectionInfo(): {
    status: 'ONLINE' | 'STANDBY';
    engine: string;
    totalRecords: number;
    lastSaved: string;
  } {
    const materials = this.getMaterials();
    const inventory = this.getInventory();
    const txs = this.getTransactions();
    const projects = this.getProjects();
    const suppliers = this.getSuppliers();
    const sub = this.getSubcontractors();
    const out = this.getOutsourced();
    const produce = this.getProduce();
    const categories = this.getCategories();

    return {
      status: 'ONLINE',
      engine: 'Central Synchronized Engine (Stable Full-Stack & Local Persistence)',
      totalRecords:
        materials.length +
        inventory.length +
        txs.length +
        projects.length +
        suppliers.length +
        sub.length +
        out.length +
        produce.length +
        categories.length,
      lastSaved: new Date().toISOString()
    };
  },

  // 1-Click Master Database JSON Export with Auto-Download
  exportCompleteDatabase(triggerDownload: boolean = true): string {
    const backup = {
      system: 'Cost and Planning Database System',
      currency: 'LKR',
      exportDate: new Date().toISOString(),
      schemaVersion: '2.5.0',
      companyDetails: getStoredCompanyDetails(),
      autoNumberRules: getStoredAutoNumberRules(),
      data: {
        materials: persistentDatabase.getMaterials(),
        suppliers: persistentDatabase.getSuppliers(),
        outsourcedServices: persistentDatabase.getOutsourced(),
        subcontractors: persistentDatabase.getSubcontractors(),
        inventory: persistentDatabase.getInventory(),
        transactions: persistentDatabase.getTransactions(),
        projects: persistentDatabase.getProjects(),
        produceItems: persistentDatabase.getProduce(),
        categories: persistentDatabase.getCategories(),
        customTiles: persistentDatabase.getCustomTiles(),
        calendarEvents: persistentDatabase.getCalendarEvents()
      }
    };
    const jsonString = JSON.stringify(backup, null, 2);

    if (triggerDownload && typeof window !== 'undefined') {
      try {
        const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        link.download = `cost_planning_database_backup_${timestamp}.json`;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          if (link.parentNode) link.parentNode.removeChild(link);
          URL.revokeObjectURL(url);
        }, 300);
      } catch (err) {
        console.warn('Auto download error:', err);
      }
    }

    return jsonString;
  },

  // Restore Complete Database from JSON file
  restoreDatabase(jsonString: string): boolean {
    return persistentDatabase.restoreCompleteDatabase(jsonString);
  },

  restoreCompleteDatabase(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || !parsed.data) {
        throw new Error('Invalid database backup structure: missing data block');
      }

      if (Array.isArray(parsed.data.materials)) persistentDatabase.saveMaterials(parsed.data.materials);
      if (Array.isArray(parsed.data.suppliers)) persistentDatabase.saveSuppliers(parsed.data.suppliers);
      if (Array.isArray(parsed.data.outsourcedServices)) persistentDatabase.saveOutsourced(parsed.data.outsourcedServices);
      if (Array.isArray(parsed.data.subcontractors)) persistentDatabase.saveSubcontractors(parsed.data.subcontractors);
      if (Array.isArray(parsed.data.inventory)) persistentDatabase.saveInventory(parsed.data.inventory);
      if (Array.isArray(parsed.data.transactions)) persistentDatabase.saveTransactions(parsed.data.transactions);
      if (Array.isArray(parsed.data.projects)) persistentDatabase.saveProjects(parsed.data.projects);
      if (Array.isArray(parsed.data.produceItems)) persistentDatabase.saveProduce(parsed.data.produceItems);
      if (Array.isArray(parsed.data.categories)) persistentDatabase.saveCategories(parsed.data.categories);
      if (Array.isArray(parsed.data.customTiles)) persistentDatabase.saveCustomTiles(parsed.data.customTiles);
      if (Array.isArray(parsed.data.calendarEvents)) persistentDatabase.saveCalendarEvents(parsed.data.calendarEvents);

      if (parsed.companyDetails) saveStoredCompanyDetails(parsed.companyDetails);
      if (Array.isArray(parsed.autoNumberRules)) saveStoredAutoNumberRules(parsed.autoNumberRules);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fxtt-database-restored'));
      }

      return true;
    } catch (err) {
      console.error('Failed to restore database from backup:', err);
      return false;
    }
  },

  // Reset to Factory Default Seed Data
  resetToDefaults(): void {
    safeSet(DB_KEYS.MATERIALS, INITIAL_MATERIALS);
    safeSet(DB_KEYS.SUPPLIERS, INITIAL_SUPPLIERS);
    safeSet(DB_KEYS.OUTSOURCED, INITIAL_OUTSOURCED_SERVICES);
    safeSet(DB_KEYS.SUBCONTRACTORS, INITIAL_SUBCONTRACTORS);
    safeSet(DB_KEYS.INVENTORY, INITIAL_INVENTORY);
    safeSet(DB_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
    safeSet(DB_KEYS.PROJECTS, INITIAL_PROJECTS);
    safeSet(DB_KEYS.PRODUCE, INITIAL_PRODUCE_ITEMS);
    safeSet(DB_KEYS.CATEGORIES, buildDefaultCategories());
    safeSet(DB_KEYS.CUSTOM_TILES, []);
    safeSet(DB_KEYS.CALENDAR_EVENTS, []);
  },

  // Clear all dummy data
  clearAllData(): void {
    safeSet(DB_KEYS.MATERIALS, []);
    safeSet(DB_KEYS.SUPPLIERS, []);
    safeSet(DB_KEYS.OUTSOURCED, []);
    safeSet(DB_KEYS.SUBCONTRACTORS, []);
    safeSet(DB_KEYS.INVENTORY, []);
    safeSet(DB_KEYS.TRANSACTIONS, []);
    safeSet(DB_KEYS.PROJECTS, []);
    safeSet(DB_KEYS.PRODUCE, []);
    safeSet(DB_KEYS.CUSTOM_TILES, []);
    safeSet(DB_KEYS.CALENDAR_EVENTS, []);
    safeSet(DB_KEYS.CLIENTS, []);
  }
};
