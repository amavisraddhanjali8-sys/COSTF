import { UserRole } from '../types';
import { ActiveTab } from '../components/TopNavbar';
import { bizStore } from './bizStore';

export interface RolePermissionConfig {
  role: UserRole;
  label: string;
  description: string;
  badgeBg: string;
  badgeText: string;
  allowedTabs: ActiveTab[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  canViewFinancials: boolean;
  canManageTariffs: boolean;
  canManageInventory: boolean;
  canManageUsers: boolean;
  canManageSettings: boolean;
}

export const ALL_SYSTEM_TABS: { id: ActiveTab; label: string; group: 'Core' | 'Operations' | 'Finance' | 'Admin' }[] = [
  { id: 'home', label: 'Home Command Dashboard', group: 'Core' },
  { id: 'directory-hub', label: 'Directory Cards Hub', group: 'Core' },
  { id: 'item-grid', label: 'Master Data Grid Catalog', group: 'Core' },
  { id: 'projects', label: 'Projects & Portfolios', group: 'Operations' },
  { id: 'cost-analysis', label: 'Margins & Profitability', group: 'Finance' },
  { id: 'project-timelines', label: 'Timelines & Gantt Schedules', group: 'Operations' },
  { id: 'resource-allocation', label: 'Resource & Subcontractor Capacity', group: 'Operations' },
  { id: 'inventory', label: 'Inventory & Stock Movements', group: 'Operations' },
  { id: 'overhead-portal', label: 'Overhead Cost Management', group: 'Finance' },
  { id: 'revenue-portal', label: 'Revenue Streams & Deliverables', group: 'Finance' },
  { id: 'price-history-portal', label: 'Procurement Price History', group: 'Finance' },
  { id: 'tariffs-portal', label: 'Enterprise Tariffs & Rate Books', group: 'Finance' },
  { id: 'audit-log', label: 'System Audit Logs', group: 'Admin' },
  { id: 'settings', label: 'Settings & Security Portals', group: 'Admin' }
];

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, RolePermissionConfig> = {
  ADMIN: {
    role: 'ADMIN',
    label: 'Enterprise Administrator',
    description: 'Unrestricted enterprise access to all portals, database operations, user accounts, and security controls.',
    badgeBg: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800',
    badgeText: 'Admin',
    allowedTabs: [
      'home',
      'directory-hub',
      'item-grid',
      'projects',
      'cost-analysis',
      'project-timelines',
      'resource-allocation',
      'inventory',
      'overhead-portal',
      'revenue-portal',
      'price-history-portal',
      'tariffs-portal',
      'audit-log',
      'settings'
    ],
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canExport: true,
    canViewFinancials: true,
    canManageTariffs: true,
    canManageInventory: true,
    canManageUsers: true,
    canManageSettings: true
  },
  PROJECT_MANAGER: {
    role: 'PROJECT_MANAGER',
    label: 'Project Manager',
    description: 'Oversees end-to-end project planning, budgets, subcontractor allocations, and delivery schedules.',
    badgeBg: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800',
    badgeText: 'Project Mgr',
    allowedTabs: [
      'home',
      'directory-hub',
      'item-grid',
      'projects',
      'cost-analysis',
      'project-timelines',
      'resource-allocation',
      'inventory',
      'overhead-portal',
      'revenue-portal',
      'price-history-portal',
      'tariffs-portal'
    ],
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canExport: true,
    canViewFinancials: true,
    canManageTariffs: true,
    canManageInventory: true,
    canManageUsers: false,
    canManageSettings: false
  },
  QUANTITY_SURVEYOR: {
    role: 'QUANTITY_SURVEYOR',
    label: 'Quantity Surveyor (QS)',
    description: 'Manages Bill of Quantities (BOQ), material estimations, unit cost analysis, and tariff allocations.',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800',
    badgeText: 'Quantity Surveyor',
    allowedTabs: [
      'home',
      'directory-hub',
      'item-grid',
      'projects',
      'cost-analysis',
      'tariffs-portal',
      'overhead-portal',
      'revenue-portal',
      'price-history-portal',
      'inventory'
    ],
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canExport: true,
    canViewFinancials: true,
    canManageTariffs: true,
    canManageInventory: false,
    canManageUsers: false,
    canManageSettings: false
  },
  PROCUREMENT_OFFICER: {
    role: 'PROCUREMENT_OFFICER',
    label: 'Procurement Officer',
    description: 'Maintains supplier master data, vendor price quotes, inventory stock balances, and purchasing histories.',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800',
    badgeText: 'Procurement',
    allowedTabs: [
      'home',
      'directory-hub',
      'item-grid',
      'inventory',
      'price-history-portal'
    ],
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canExport: true,
    canViewFinancials: false,
    canManageTariffs: false,
    canManageInventory: true,
    canManageUsers: false,
    canManageSettings: false
  },
  ESTIMATOR: {
    role: 'ESTIMATOR',
    label: 'Cost Estimator',
    description: 'Builds competitive quotes, competitor price benchmarks, revenue deliverables, and project scenarios.',
    badgeBg: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800',
    badgeText: 'Estimator',
    allowedTabs: [
      'home',
      'directory-hub',
      'item-grid',
      'projects',
      'cost-analysis',
      'overhead-portal',
      'revenue-portal',
      'tariffs-portal'
    ],
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canExport: true,
    canViewFinancials: true,
    canManageTariffs: true,
    canManageInventory: false,
    canManageUsers: false,
    canManageSettings: false
  },
  FINANCE_AUDITOR: {
    role: 'FINANCE_AUDITOR',
    label: 'Finance Auditor & Controller',
    description: 'Audits cost margins, financial variances, system audit trails, and official PDF/CSV corporate filings.',
    badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800',
    badgeText: 'Finance Auditor',
    allowedTabs: [
      'home',
      'cost-analysis',
      'projects',
      'overhead-portal',
      'revenue-portal',
      'price-history-portal',
      'tariffs-portal',
      'audit-log'
    ],
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canExport: true,
    canViewFinancials: true,
    canManageTariffs: false,
    canManageInventory: false,
    canManageUsers: false,
    canManageSettings: false
  },
  VIEWER: {
    role: 'VIEWER',
    label: 'Read-Only Viewer',
    description: 'General stakeholder read-only access to browse catalog items, published project portfolios, and metrics.',
    badgeBg: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    badgeText: 'Viewer',
    allowedTabs: [
      'home',
      'directory-hub',
      'item-grid',
      'projects'
    ],
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canExport: false,
    canViewFinancials: false,
    canManageTariffs: false,
    canManageInventory: false,
    canManageUsers: false,
    canManageSettings: false
  }
};

const PERMISSIONS_STORAGE_KEY = 'fxtt_enterprise_role_permissions_v2';

class PermissionService {
  private permissions: Record<UserRole, RolePermissionConfig>;

  constructor() {
    this.permissions = this.loadPermissions();
  }

  private loadPermissions(): Record<UserRole, RolePermissionConfig> {
    try {
      const saved = bizStore.getItem(PERMISSIONS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with defaults to guarantee all roles and fields are present
        const merged: Record<UserRole, RolePermissionConfig> = { ...DEFAULT_ROLE_PERMISSIONS };
        (Object.keys(DEFAULT_ROLE_PERMISSIONS) as UserRole[]).forEach((role) => {
          if (parsed[role]) {
            merged[role] = {
              ...DEFAULT_ROLE_PERMISSIONS[role],
              ...parsed[role],
              allowedTabs: Array.isArray(parsed[role].allowedTabs)
                ? parsed[role].allowedTabs
                : DEFAULT_ROLE_PERMISSIONS[role].allowedTabs
            };
          }
        });
        return merged;
      }
    } catch (e) {
      console.warn('Error loading role permissions:', e);
    }
    return { ...DEFAULT_ROLE_PERMISSIONS };
  }

  public getAll(): Record<UserRole, RolePermissionConfig> {
    return { ...this.permissions };
  }

  public getRoleConfig(role?: UserRole): RolePermissionConfig {
    if (!role || !this.permissions[role]) {
      return this.permissions.VIEWER;
    }
    return this.permissions[role];
  }

  public updateRole(role: UserRole, updates: Partial<RolePermissionConfig>): void {
    const existing = this.getRoleConfig(role);
    const updated: RolePermissionConfig = {
      ...existing,
      ...updates
    };
    // Ensure Admin always has settings, audit log, and core permissions
    if (role === 'ADMIN') {
      updated.allowedTabs = Array.from(new Set([...updated.allowedTabs, 'settings', 'audit-log', 'home']));
      updated.canManageUsers = true;
      updated.canManageSettings = true;
    }

    this.permissions[role] = updated;
    this.persist();
  }

  public resetToDefaults(): void {
    this.permissions = { ...DEFAULT_ROLE_PERMISSIONS };
    this.persist();
  }

  private persist(): void {
    try {
      bizStore.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(this.permissions));
      window.dispatchEvent(
        new CustomEvent('fxtt-permissions-updated', { detail: { permissions: this.permissions } })
      );
    } catch (e) {
      console.warn('Error saving role permissions:', e);
    }
  }

  public hasTabAccess(role?: UserRole, tab?: ActiveTab): boolean {
    if (!role || !tab) return false;
    if (role === 'ADMIN') return true;
    const config = this.getRoleConfig(role);
    // Allow subtabs/portals that belong to a category
    if (tab === 'materials' || tab === 'produce' || tab === 'subcontractors' || tab === 'outsourced' || tab === 'suppliers') {
      return config.allowedTabs.includes('directory-hub') || config.allowedTabs.includes('item-grid') || config.allowedTabs.includes(tab);
    }
    if (tab === 'project-home' || tab === 'plan-details') {
      return config.allowedTabs.includes('projects');
    }
    return config.allowedTabs.includes(tab);
  }

  public hasCapability(
    role?: UserRole,
    capability?: 'create' | 'edit' | 'delete' | 'export' | 'financials' | 'tariffs' | 'inventory' | 'users' | 'settings'
  ): boolean {
    if (!role) return false;
    if (role === 'ADMIN') return true;
    const config = this.getRoleConfig(role);
    switch (capability) {
      case 'create':
        return config.canCreate;
      case 'edit':
        return config.canEdit;
      case 'delete':
        return config.canDelete;
      case 'export':
        return config.canExport;
      case 'financials':
        return config.canViewFinancials;
      case 'tariffs':
        return config.canManageTariffs;
      case 'inventory':
        return config.canManageInventory;
      case 'users':
        return config.canManageUsers;
      case 'settings':
        return config.canManageSettings;
      default:
        return false;
    }
  }
}

export const permissionService = new PermissionService();
