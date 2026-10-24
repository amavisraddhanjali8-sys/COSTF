import React, { useState, useRef, useEffect } from 'react';
import {
  Building2,
  Users,
  Shield,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Edit2,
  Search,
  Lock,
  Mail,
  Phone,
  Globe,
  MapPin,
  RefreshCw,
  Hash,
  Download,
  FileText,
  FileSpreadsheet,
  RotateCcw,
  ShieldCheck,
  HardDrive,
  Sun,
  Moon,
  Monitor,
  Printer,
  X
} from 'lucide-react';
import jsPDF from 'jspdf';
import { api } from '../services/api';
import { permissionService, ALL_SYSTEM_TABS, RolePermissionConfig } from '../services/permissionService';
import { getStoredThemeMode, setStoredThemeMode, ThemeMode } from '../services/themeService';
import { getStoredSessionToken, setStoredTimeoutMinutes, getStoredTimeoutMinutes } from '../services/sessionService';
import {
  AppUser,
  AccountRequest,
  CompanyDetails,
  UserRole,
  MaterialItem,
  InventoryItem,
  InventoryTransaction,
  Project,
  Supplier,
  SubcontractorRateItem,
  OutsourcedService,
  ProduceItem
} from '../types';
import {
  AutoNumberRule,
  AutoNumberEntityType,
  getStoredAutoNumberRules,
  saveAutoNumberRules,
  resetAutoNumberRules,
  generateSampleNumber,
  peekNextNumber,
  generateNextNumber,
  formatWithRule,
  resetAutoNumberRule,
  addCustomAutoNumberRule,
  deleteCustomAutoNumberRule,
  DEFAULT_AUTONUMBER_RULES,
  resolveCanonicalKey
} from '../services/autoNumberingService';
import { exportMasterExecutiveReportPDF } from '../utils/pdfExport';
import {
  exportMaterialsToCSV,
  exportProduceItemsToCSV,
  exportInventoryToCSV,
  exportInventoryTransactionsToCSV,
  exportSubcontractorsToCSV,
  exportOutsourcedServicesToCSV,
  exportProjectsToCSV,
  exportSuppliersToCSV
} from '../utils/csvExport';

interface SettingsViewProps {
  currentUser: AppUser;
  companyDetails: CompanyDetails;
  onUpdateCompanyDetails: (details: CompanyDetails) => void;
  users: AppUser[];
  onAddUser: (user: Omit<AppUser, 'id' | 'createdAt'>) => void;
  onUpdateUser: (id: string, updates: Partial<AppUser>) => void;
  onDeleteUser: (id: string) => void;
  accountRequests: AccountRequest[];
  onApproveRequest: (requestId: string) => void;
  onRejectRequest: (requestId: string) => void;
  showToast: (msg: string) => void;
  materials?: MaterialItem[];
  inventory?: InventoryItem[];
  transactions?: InventoryTransaction[];
  projects?: Project[];
  suppliers?: Supplier[];
  subcontractors?: SubcontractorRateItem[];
  outsourced?: OutsourcedService[];
  produceItems?: ProduceItem[];
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  companyDetails,
  onUpdateCompanyDetails,
  users,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  accountRequests,
  onApproveRequest,
  onRejectRequest,
  showToast,
  materials = [],
  inventory = [],
  transactions = [],
  projects = [],
  suppliers = [],
  subcontractors = [],
  outsourced = [],
  produceItems = []
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'company' | 'auto_numbering' | 'export_data' | 'users' | 'permissions' | 'appearance' | 'security'>('company');

  // Company Details State
  const [compForm, setCompForm] = useState<CompanyDetails>({ ...companyDetails });
  const [isLogoDragging, setIsLogoDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-Numbering Rules State
  const [rules, setRules] = useState<AutoNumberRule[]>(() => getStoredAutoNumberRules());
  const [isSyncingCounters, setIsSyncingCounters] = useState(false);
  const [rulesSearch, setRulesSearch] = useState('');
  const [rulesCategoryFilter, setRulesCategoryFilter] = useState<string>('all');
  const [isAddCustomRuleModalOpen, setIsAddCustomRuleModalOpen] = useState(false);
  const [customRuleKey, setCustomRuleKey] = useState('');
  const [customRuleLabel, setCustomRuleLabel] = useState('');
  const [customRuleGroup, setCustomRuleGroup] = useState('procurement_inventory');
  const [customRulePrefix, setCustomRulePrefix] = useState('');
  const [customRuleSuffix, setCustomRuleSuffix] = useState('');
  const [customRuleDigits, setCustomRuleDigits] = useState<number>(4);
  const [customRuleNextNum, setCustomRuleNextNum] = useState<number>(1001);
  const [customRuleDesc, setCustomRuleDesc] = useState('');

  // Keep rules in sync if updated from another component or window
  useEffect(() => {
    const handleRulesUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setRules(e.detail);
      }
    };
    window.addEventListener('fxtt_autonumber_rules_updated', handleRulesUpdate);
    return () => window.removeEventListener('fxtt_autonumber_rules_updated', handleRulesUpdate);
  }, []);

  // Export State
  const [isExportingAll, setIsExportingAll] = useState(false);

  // Users Management State
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userFormEmpId, setUserFormEmpId] = useState('');
  const [userFormName, setUserFormName] = useState('');
  const [userFormEmail, setUserFormEmail] = useState('');
  const [userFormRole, setUserFormRole] = useState<UserRole>('PROJECT_MANAGER');
  const [userFormDept, setUserFormDept] = useState('');
  const [userFormStatus, setUserFormStatus] = useState<'Active' | 'Inactive'>('Active');

  // Role Permissions Management State
  const [selectedPermRole, setSelectedPermRole] = useState<UserRole>('PROJECT_MANAGER');
  const [allPermConfigs, setAllPermConfigs] = useState<Record<UserRole, RolePermissionConfig>>(() => permissionService.getAll());
  const [permSuccessNotice, setPermSuccessNotice] = useState<string | null>(null);

  const handleToggleTabPermission = (tabId: any) => {
    if (selectedPermRole === 'ADMIN') return; // Admin always retains all tabs
    setAllPermConfigs((prev) => {
      const currentConfig = prev[selectedPermRole];
      const hasTab = currentConfig.allowedTabs.includes(tabId);
      const newTabs = hasTab
        ? currentConfig.allowedTabs.filter((t) => t !== tabId)
        : [...currentConfig.allowedTabs, tabId];
      return {
        ...prev,
        [selectedPermRole]: {
          ...currentConfig,
          allowedTabs: newTabs
        }
      };
    });
  };

  const handleToggleCapability = (capKey: keyof RolePermissionConfig) => {
    if (selectedPermRole === 'ADMIN') return;
    setAllPermConfigs((prev) => {
      const currentConfig = prev[selectedPermRole];
      return {
        ...prev,
        [selectedPermRole]: {
          ...currentConfig,
          [capKey]: !currentConfig[capKey]
        }
      };
    });
  };

  const handleSaveRolePermissions = () => {
    Object.entries(allPermConfigs).forEach(([role, cfg]) => {
      permissionService.updateRole(role as UserRole, cfg);
    });
    setPermSuccessNotice(`Role access permissions for "${allPermConfigs[selectedPermRole].label}" successfully updated and synchronized across all portals.`);
    setTimeout(() => setPermSuccessNotice(null), 4000);
  };

  const handleResetRolePermissions = () => {
    permissionService.resetToDefaults();
    setAllPermConfigs(permissionService.getAll());
    setPermSuccessNotice('Role permissions have been reset to factory defaults.');
    setTimeout(() => setPermSuccessNotice(null), 4000);
  };

  // Appearance State
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredThemeMode());

  // Security & 2FA State
  const [sessionTimeout, setSessionTimeout] = useState<number>(() => getStoredTimeoutMinutes());
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [totpQrModalOpen, setTotpQrModalOpen] = useState(false);
  const [totpQrDataUrl, setTotpQrDataUrl] = useState<string | null>(null);
  const [totpVerifyCode, setTotpVerifyCode] = useState('');
  const [totpConfigured, setTotpConfigured] = useState(false);
  const [isSecurityLoading, setIsSecurityLoading] = useState(false);

  // Load Admin Security Configuration & Role Permissions
  useEffect(() => {
    // Synchronize role permissions from server
    permissionService.syncWithServer().then(() => {
      setAllPermConfigs(permissionService.getAll());
    }).catch(() => {});

    if (currentUser.role === 'ADMIN') {
      const token = getStoredSessionToken();
      fetch('/api/security/admin-config', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((r) => r.json())
        .then((data) => {
          if (data && !data.error) {
            setTotpConfigured(Boolean(data.twoFactorEnabled));
            if (Array.isArray(data.backupCodes)) {
              setBackupCodes(data.backupCodes);
            }
          }
        })
        .catch(() => {});
    }
  }, [currentUser]);

  // Company Details Handlers
  const handleSaveCompanyDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateCompanyDetails(compForm);
    try {
      await api.updateCompanyDetails(compForm);
      showToast('Company details & logo saved.');
    } catch {
      showToast('Company details updated.');
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      showToast('File exceeds 25MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      if (result) {
        try {
          const uploaded = await api.uploadImage(result, file.name);
          setCompForm((prev) => ({ ...prev, logoUrl: uploaded.url }));
          showToast('Company logo uploaded successfully.');
        } catch {
          setCompForm((prev) => ({ ...prev, logoUrl: result }));
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLogoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsLogoDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      showToast('File exceeds 25MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      if (result) {
        try {
          const uploaded = await api.uploadImage(result, file.name);
          setCompForm((prev) => ({ ...prev, logoUrl: uploaded.url }));
          showToast('Company logo uploaded successfully.');
        } catch {
          setCompForm((prev) => ({ ...prev, logoUrl: result }));
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Auto-Number Handlers
  const handleUpdateRule = (key: string, field: keyof AutoNumberRule, value: any) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.entityKey === key || r.entityType === key) {
          const updated = { ...r, [field]: value };
          if (
            field === 'prefix' ||
            field === 'suffix' ||
            field === 'padding' ||
            field === 'paddingDigits' ||
            field === 'nextNumber'
          ) {
            if (field === 'padding') updated.paddingDigits = value;
            updated.sampleExample = formatWithRule(updated);
          }
          return updated;
        }
        return r;
      })
    );
  };

  const handleResetSingleRule = (key: string) => {
    const canonical = resolveCanonicalKey(key);
    const def = DEFAULT_AUTONUMBER_RULES.find((d) => d.entityKey === canonical);
    if (!def) return;
    setRules((prev) =>
      prev.map((r) => (r.entityKey === canonical || r.entityType === canonical ? { ...def } : r))
    );
    showToast(`Rule for "${def.label}" reset to factory default.`);
  };

  const handleDeleteCustomRule = (key: string) => {
    deleteCustomAutoNumberRule(key);
    setRules((prev) => prev.filter((r) => r.entityKey !== key));
    showToast(`Custom rule "${key}" removed.`);
  };

  const handleSaveCustomRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customRuleKey.trim() || !customRuleLabel.trim()) {
      showToast('Key and Label are required.');
      return;
    }
    const cleanKey = customRuleKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const newRule: AutoNumberRule = {
      entityKey: cleanKey,
      entityType: cleanKey,
      label: customRuleLabel.trim(),
      prefix: customRulePrefix.trim().toUpperCase(),
      suffix: customRuleSuffix.trim().toUpperCase(),
      padding: Math.max(1, Math.min(8, Number(customRuleDigits) || 4)),
      paddingDigits: Math.max(1, Math.min(8, Number(customRuleDigits) || 4)),
      nextNumber: Math.max(1, Number(customRuleNextNum) || 1),
      description: customRuleDesc.trim() || `${customRuleLabel.trim()} sequence identifier`,
      categoryGroup: customRuleGroup,
      sampleExample: '',
      isCustom: true,
      active: true
    };
    newRule.sampleExample = formatWithRule(newRule);
    const updated = addCustomAutoNumberRule(newRule);
    setRules(updated);
    setIsAddCustomRuleModalOpen(false);
    setCustomRuleKey('');
    setCustomRuleLabel('');
    setCustomRulePrefix('');
    setCustomRuleSuffix('');
    setCustomRuleDesc('');
    showToast(`Custom numbering rule "${newRule.label}" created.`);
  };

  const handleSaveRules = () => {
    saveAutoNumberRules(rules);
    showToast('Auto-number rules saved and applied across all modules.');
  };

  const handleResetRules = () => {
    const defaults = resetAutoNumberRules();
    setRules(defaults);
    showToast('All numbering rules reset to enterprise defaults.');
  };

  const handleSyncCounters = async () => {
    setIsSyncingCounters(true);
    try {
      // Asynchronously inspect real-time database datasets
      let allPlans: any[] = [];
      let allOverheadItems: any[] = [];
      let allRevenueItems: any[] = [];
      let allTariffs: any[] = [];
      let allResources: any[] = [];
      try {
        const [plansRes, ovhRes, revRes, trfRes, resRes] = await Promise.allSettled([
          api.getAllProjectPlans(),
          api.getOverheadItems(),
          api.getRevenueItems(),
          api.getTariffs(),
          api.getResources()
        ]);
        if (plansRes.status === 'fulfilled' && Array.isArray(plansRes.value)) allPlans = plansRes.value;
        if (ovhRes.status === 'fulfilled' && Array.isArray(ovhRes.value)) allOverheadItems = ovhRes.value;
        if (revRes.status === 'fulfilled' && Array.isArray(revRes.value)) allRevenueItems = revRes.value;
        if (trfRes.status === 'fulfilled' && Array.isArray(trfRes.value)) allTariffs = trfRes.value;
        if (resRes.status === 'fulfilled' && Array.isArray(resRes.value)) allResources = resRes.value;
      } catch (e) {
        console.warn('Sync counters partial remote fetch:', e);
      }

      const updatedRules = rules.map((rule) => {
        let maxFound = 0;
        const key = resolveCanonicalKey(rule.entityKey || rule.entityType || '');

        const extractMax = (val?: string | null | number) => {
          if (val === undefined || val === null) return;
          const match = String(val).match(/\d+/g);
          if (match) {
            const num = parseInt(match[match.length - 1], 10);
            if (!isNaN(num) && num > maxFound) maxFound = num;
          }
        };

        if (key === 'materials') {
          materials.forEach((m) => extractMax(m.code));
        } else if (key === 'inventory') {
          inventory.forEach((i) => {
            extractMax(i.sku);
            extractMax(i.code);
          });
        } else if (key === 'inventory_in') {
          transactions.filter((t) => t.type === 'IN').forEach((t) => extractMax(t.transactionNumber || t.id));
        } else if (key === 'inventory_out') {
          transactions.filter((t) => t.type === 'OUT').forEach((t) => extractMax(t.transactionNumber || t.id));
        } else if (key === 'batch_lot') {
          transactions.forEach((t) => extractMax(t.batchLotNumber));
          inventory.forEach((i) => extractMax(i.batchNumber));
        } else if (key === 'projects') {
          projects.forEach((p) => extractMax(p.code));
        } else if (key === 'plans') {
          allPlans.forEach((p) => extractMax(p.planNumber || p.plan_number || p.name));
        } else if (key === 'revisions') {
          allPlans.forEach((p) => {
            if (p.revisions && Array.isArray(p.revisions)) {
              p.revisions.forEach((r: any) => extractMax(r.versionLabel || r.revisionNumber));
            }
          });
        } else if (key === 'deliverables') {
          projects.forEach((p) => {
            if ((p as any).deliverables && Array.isArray((p as any).deliverables)) {
              (p as any).deliverables.forEach((d: any) => extractMax(d.code));
            }
          });
        } else if (key === 'subcontractors') {
          subcontractors.forEach((s) => extractMax(s.code || s.id));
        } else if (key === 'outsourced') {
          outsourced.forEach((o) => extractMax(o.code || o.serviceCode || o.id));
        } else if (key === 'resources') {
          allResources.forEach((r) => extractMax(r.code || r.id));
        } else if (key === 'suppliers') {
          suppliers.forEach((s) => extractMax(s.code || s.id));
        } else if (key === 'contracts') {
          suppliers.forEach((s) => {
            if (s.contractHistory) {
              s.contractHistory.forEach((c) => extractMax(c.contractNumber || c.contractId));
            }
          });
        } else if (key === 'produce') {
          produceItems.forEach((p) => extractMax(p.code || p.id));
        } else if (key === 'overheads') {
          allOverheadItems.forEach((item) => extractMax(item.code || item.id));
        } else if (key === 'overhead_categories') {
          // categories scan
        } else if (key === 'revenue') {
          allRevenueItems.forEach((item) => extractMax(item.code || item.id));
        } else if (key === 'revenue_categories') {
          // categories scan
        } else if (key === 'tariffs') {
          allTariffs.forEach((t) => extractMax(t.code));
        } else if (key === 'clients') {
          projects.forEach((p) => extractMax((p as any).clientCode || p.clientName));
        } else if (key === 'users') {
          users.forEach((u) => extractMax(u.employeeId));
        } else if (key === 'barcodes') {
          materials.forEach((m) => extractMax(m.barcode));
          inventory.forEach((i) => extractMax(i.barcode));
        }

        const newNext = Math.max(rule.nextNumber, maxFound > 0 ? maxFound + 1 : rule.nextNumber);
        return {
          ...rule,
          nextNumber: newNext,
          sampleExample: formatWithRule({ ...rule, nextNumber: newNext })
        };
      });

      setRules(updatedRules);
      saveAutoNumberRules(updatedRules);
      showToast('All enterprise auto-number counters synchronized with database.');
    } catch (err: any) {
      console.error('Error syncing counters:', err);
      showToast('Counter synchronization completed.');
    } finally {
      setIsSyncingCounters(false);
    }
  };

  // Export All Datasets
  const handleMasterExportAll = () => {
    setIsExportingAll(true);
    try {
      exportMasterExecutiveReportPDF(
        companyDetails,
        materials,
        inventory,
        transactions,
        projects,
        subcontractors,
        outsourced,
        suppliers
      );

      setTimeout(() => exportMaterialsToCSV(materials), 200);
      setTimeout(() => exportInventoryToCSV(inventory), 400);
      setTimeout(() => exportInventoryTransactionsToCSV(transactions), 600);
      setTimeout(() => exportSubcontractorsToCSV(subcontractors), 800);
      setTimeout(() => exportOutsourcedServicesToCSV(outsourced), 1000);
      setTimeout(() => exportProjectsToCSV(projects), 1200);
      setTimeout(() => exportSuppliersToCSV(suppliers), 1400);
      setTimeout(() => exportProduceItemsToCSV(produceItems), 1600);

      setTimeout(() => {
        setIsExportingAll(false);
        showToast('All exports downloaded.');
      }, 1800);
    } catch {
      setIsExportingAll(false);
      showToast('Export failed.');
    }
  };

  // User Management Handlers
  const handleOpenAddUser = () => {
    setEditingUserId(null);
    setUserFormEmpId(peekNextNumber('users'));
    setUserFormName('');
    setUserFormEmail('');
    setUserFormRole('PROJECT_MANAGER');
    setUserFormDept('Engineering');
    setUserFormStatus('Active');
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (user: AppUser) => {
    setEditingUserId(user.id);
    setUserFormEmpId(user.employeeId);
    setUserFormName(user.name);
    setUserFormEmail(user.email);
    setUserFormRole(user.role);
    setUserFormDept(user.department);
    setUserFormStatus(user.status);
    setIsUserModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormEmpId || !userFormName || !userFormEmail) return;

    if (editingUserId) {
      onUpdateUser(editingUserId, {
        employeeId: userFormEmpId.trim().toUpperCase(),
        name: userFormName.trim(),
        email: userFormEmail.trim(),
        role: userFormRole,
        department: userFormDept.trim(),
        status: userFormStatus
      });
      showToast('User updated.');
    } else {
      onAddUser({
        employeeId: userFormEmpId.trim().toUpperCase(),
        name: userFormName.trim(),
        email: userFormEmail.trim(),
        role: userFormRole,
        department: userFormDept.trim(),
        status: userFormStatus
      });
      generateNextNumber('users', true);
      showToast('User created.');
    }

    setIsUserModalOpen(false);
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.employeeId.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const pendingRequests = accountRequests.filter((r) => r.status === 'Pending');

  // Appearance Theme Handler
  const handleSelectTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    setStoredThemeMode(mode);
    onUpdateUser(currentUser.id, { themePreference: mode });
    showToast(`Theme set to ${mode}.`);
  };

  // Google Authenticator Setup
  const handleOpenGoogleAuthSetup = async () => {
    setIsSecurityLoading(true);
    const token = getStoredSessionToken();
    try {
      const res = await fetch('/api/auth/totp-setup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setTotpQrDataUrl(data.qrCodeDataUrl);
      setTotpVerifyCode('');
      setTotpQrModalOpen(true);
    } catch {
      showToast('Error setting up 2FA.');
    } finally {
      setIsSecurityLoading(false);
    }
  };

  const handleConfirmTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpVerifyCode.trim()) return;

    setIsSecurityLoading(true);
    const token = getStoredSessionToken();
    try {
      const res = await fetch('/api/auth/totp-confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code: totpVerifyCode.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setTotpConfigured(true);
      setTotpQrModalOpen(false);
      showToast('2FA activated.');
    } catch {
      showToast('Invalid verification code.');
    } finally {
      setIsSecurityLoading(false);
    }
  };

  const handleDownloadBackupCodesPdf = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Emergency Backup Codes', 14, 20);
      doc.setFontSize(10);
      doc.text(`User: ${currentUser.name} (${currentUser.employeeId})`, 14, 28);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 34);

      backupCodes.forEach((code, idx) => {
        doc.text(`[${idx + 1}] ${code}`, 14, 46 + idx * 8);
      });

      doc.save('backup_codes.pdf');
      showToast('Backup codes downloaded.');
    } catch {
      showToast('Failed to download PDF.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-12">
      {/* 1. TOP HEADER & TABS - WHITE BOX */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Building2 className="w-5 h-5 text-slate-700" />
          <h1 className="text-base font-bold text-slate-900">Settings</h1>
        </div>

        {/* Simple Tab Pills */}
        <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveSubTab('company')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
              activeSubTab === 'company'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Company
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('auto_numbering')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
              activeSubTab === 'auto_numbering'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Auto Numbers
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('export_data')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
              activeSubTab === 'export_data'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Exports
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('users')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors flex items-center space-x-1 ${
              activeSubTab === 'users'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Users</span>
            {pendingRequests.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500" />
            )}
          </button>

          {currentUser.role === 'ADMIN' && (
            <button
              type="button"
              id="subtab-role-permissions"
              onClick={() => setActiveSubTab('permissions')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors flex items-center space-x-1 ${
                activeSubTab === 'permissions'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Role Permissions</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveSubTab('appearance')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
              activeSubTab === 'appearance'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Appearance
          </button>

          {currentUser.role === 'ADMIN' && (
            <button
              type="button"
              onClick={() => setActiveSubTab('security')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                activeSubTab === 'security'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Security
            </button>
          )}
        </div>
      </div>

      {/* SUB-TAB 1: COMPANY */}
      {activeSubTab === 'company' && (
        <form onSubmit={handleSaveCompanyDetails} className="space-y-4">
          {/* Card: Logo */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                Company Logo
              </span>
              <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Asset Storage Link
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {compForm.logoUrl ? (
                <div className="w-24 h-16 bg-slate-50 border border-slate-200 rounded-lg p-2 flex items-center justify-center shrink-0 overflow-hidden">
                  <img
                    src={compForm.logoUrl}
                    alt="Logo"
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                <div className="w-24 h-16 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-xs font-medium shrink-0">
                  No Logo
                </div>
              )}

              <div className="flex-1 min-w-[260px] space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Upload Logo Image
                  </button>
                  {compForm.logoUrl && (
                    <button
                      type="button"
                      onClick={() => setCompForm((prev) => ({ ...prev, logoUrl: '' }))}
                      className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                    Logo Link / Permanent URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://example.com/logo.png or /api/images/img-..."
                    value={compForm.logoUrl || ''}
                    onChange={(e) => setCompForm((prev) => ({ ...prev, logoUrl: e.target.value }))}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs font-mono focus:bg-white focus:outline-none focus:border-[#003049]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card: Profile Fields */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
              Company Profile
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Company Name</label>
                <input
                  type="text"
                  value={compForm.name}
                  onChange={(e) => setCompForm({ ...compForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Registration #</label>
                <input
                  type="text"
                  value={compForm.registrationNumber || ''}
                  onChange={(e) => setCompForm({ ...compForm, registrationNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Email</label>
                <input
                  type="email"
                  value={compForm.email}
                  onChange={(e) => setCompForm({ ...compForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Phone</label>
                <input
                  type="text"
                  value={compForm.phone}
                  onChange={(e) => setCompForm({ ...compForm, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Website</label>
                <input
                  type="text"
                  value={compForm.website}
                  onChange={(e) => setCompForm({ ...compForm, website: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Currency</label>
                <input
                  type="text"
                  value={compForm.currency}
                  onChange={(e) => setCompForm({ ...compForm, currency: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-600 font-semibold mb-1">Address</label>
                <input
                  type="text"
                  value={compForm.address}
                  onChange={(e) => setCompForm({ ...compForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm"
              >
                Save Changes
              </button>
            </div>
          </div>
        </form>
      )}

      {/* SUB-TAB 2: AUTO NUMBERS */}
      {activeSubTab === 'auto_numbering' && (
        <div className="space-y-4">
          {/* Top Control Header Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <Hash className="w-4 h-4 text-[#003049]" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Enterprise Auto Numbering Rules & Sequence Engine
                  </span>
                </div>
                <span className="text-xs text-slate-500 mt-0.5 block">
                  Configure prefix patterns, padding digits, and real-time sequence counters for all 25 enterprise modules and custom records.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCustomRuleModalOpen(true)}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg cursor-pointer flex items-center space-x-1.5 transition-colors shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-600" />
                  <span>Add Custom Rule</span>
                </button>

                <button
                  type="button"
                  onClick={handleSyncCounters}
                  disabled={isSyncingCounters}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer flex items-center space-x-1.5 transition-colors border border-slate-200"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isSyncingCounters ? 'animate-spin' : ''}`} />
                  <span>{isSyncingCounters ? 'Scanning Records...' : 'Sync Counters'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetRules}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer flex items-center space-x-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Reset Defaults</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveRules}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer shadow-sm flex items-center space-x-1.5 transition-all"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Save Rules</span>
                </button>
              </div>
            </div>

            {/* Filter Pills & Fast Search */}
            <div className="pt-2 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Category Filter Pills */}
              <div className="flex items-center flex-wrap gap-1.5 text-xs">
                {[
                  { id: 'all', label: `All Rules (${rules.length})` },
                  { id: 'procurement_inventory', label: 'Materials & Inventory' },
                  { id: 'projects_planning', label: 'Projects & Planning' },
                  { id: 'labor_services', label: 'Labor & Services' },
                  { id: 'overheads_cost', label: 'Overheads & Cost' },
                  { id: 'commercial_revenue', label: 'Commercial & Revenue' },
                  { id: 'tariffs_regulatory', label: 'Tariffs & Regulatory' },
                  { id: 'partners_vendors', label: 'Suppliers & Vendors' },
                  { id: 'system_security', label: 'Personnel & Security' }
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setRulesCategoryFilter(cat.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-colors ${
                      rulesCategoryFilter === cat.id
                        ? 'bg-[#003049] text-white shadow-2xs font-bold'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div className="relative min-w-[240px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search entity, prefix, suffix..."
                  value={rulesSearch}
                  onChange={(e) => setRulesSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#003049] focus:bg-white"
                />
                {rulesSearch && (
                  <button
                    type="button"
                    onClick={() => setRulesSearch('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Rules Master Table Card */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-800">
                <thead className="bg-slate-50 uppercase text-[10px] text-slate-600 border-b border-slate-200 font-semibold tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 min-w-[220px]">Entity & Scope</th>
                    <th className="py-2.5 px-3 min-w-[110px]">Prefix</th>
                    <th className="py-2.5 px-3 min-w-[100px]">Suffix</th>
                    <th className="py-2.5 px-3 min-w-[80px]">Digits</th>
                    <th className="py-2.5 px-3 min-w-[120px]">Next Number</th>
                    <th className="py-2.5 px-3 min-w-[150px]">Sample Preview</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rules
                    .filter((rule) => {
                      const matchesCategory =
                        rulesCategoryFilter === 'all' ||
                        rule.categoryGroup === rulesCategoryFilter ||
                        (rulesCategoryFilter === 'custom' && rule.isCustom);
                      const q = rulesSearch.trim().toLowerCase();
                      const matchesSearch =
                        !q ||
                        rule.label.toLowerCase().includes(q) ||
                        rule.entityKey.toLowerCase().includes(q) ||
                        rule.prefix.toLowerCase().includes(q) ||
                        (rule.suffix || '').toLowerCase().includes(q) ||
                        (rule.description || '').toLowerCase().includes(q);
                      return matchesCategory && matchesSearch;
                    })
                    .map((rule) => {
                      const ruleKey = rule.entityKey || rule.entityType || '';
                      return (
                        <tr key={ruleKey} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="space-y-0.5">
                              <div className="flex items-center space-x-1.5 flex-wrap">
                                <span className="font-semibold text-slate-900">{rule.label}</span>
                                {rule.isCustom && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    CUSTOM
                                  </span>
                                )}
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-100 text-slate-600">
                                  {rule.entityKey}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 leading-tight">
                                {rule.description}
                              </p>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={rule.prefix}
                              onChange={(e) => handleUpdateRule(ruleKey, 'prefix', e.target.value.toUpperCase())}
                              className="w-24 px-2 py-1 bg-white border border-slate-300 rounded-md font-mono font-bold text-xs text-slate-900 focus:outline-hidden focus:border-[#003049]"
                              placeholder="PREFIX-"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={rule.suffix || ''}
                              onChange={(e) => handleUpdateRule(ruleKey, 'suffix', e.target.value.toUpperCase())}
                              className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-md font-mono text-xs text-slate-900 focus:outline-hidden focus:border-[#003049]"
                              placeholder="SUFFIX"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              min="1"
                              max="8"
                              value={rule.padding || 4}
                              onChange={(e) =>
                                handleUpdateRule(ruleKey, 'padding', Math.max(1, Math.min(8, parseInt(e.target.value, 10) || 4)))
                              }
                              className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-md text-xs text-center text-slate-900 focus:outline-hidden focus:border-[#003049]"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              min="1"
                              value={rule.nextNumber}
                              onChange={(e) =>
                                handleUpdateRule(ruleKey, 'nextNumber', Math.max(1, parseInt(e.target.value, 10) || 1))
                              }
                              className="w-24 px-2 py-1 bg-white border border-slate-300 rounded-md font-mono font-bold text-xs text-slate-900 focus:outline-hidden focus:border-[#003049]"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-block px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-md font-mono font-bold text-slate-900 text-xs">
                              {generateSampleNumber(rule)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="inline-flex items-center space-x-1">
                              <button
                                type="button"
                                title="Reset this rule to default"
                                onClick={() => handleResetSingleRule(ruleKey)}
                                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                              {rule.isCustom && (
                                <button
                                  type="button"
                                  title="Delete custom rule"
                                  onClick={() => handleDeleteCustomRule(rule.entityKey)}
                                  className="p-1 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>

              {/* Empty Search Result */}
              {rules.filter((rule) => {
                const matchesCategory =
                  rulesCategoryFilter === 'all' ||
                  rule.categoryGroup === rulesCategoryFilter ||
                  (rulesCategoryFilter === 'custom' && rule.isCustom);
                const q = rulesSearch.trim().toLowerCase();
                const matchesSearch =
                  !q ||
                  rule.label.toLowerCase().includes(q) ||
                  rule.entityKey.toLowerCase().includes(q) ||
                  rule.prefix.toLowerCase().includes(q);
                return matchesCategory && matchesSearch;
              }).length === 0 && (
                <div className="py-8 text-center text-slate-500 text-xs space-y-1">
                  <p className="font-semibold text-slate-700">No auto-numbering rules found matching your filter.</p>
                  <p className="text-[11px] text-slate-400">Try adjusting your search query or reset filter category.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setRulesSearch('');
                      setRulesCategoryFilter('all');
                    }}
                    className="mt-2 text-xs font-semibold text-[#003049] hover:underline cursor-pointer"
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Information & Integrity Guarantee Footer Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-slate-900 block">
                Enterprise Numbering & Sequential Audit Guarantee
              </span>
              <p className="text-[11px] leading-relaxed text-slate-500">
                All auto-generated IDs are immediately bound to new records created in Material Registration, Inventory GRN/GIN, Multi-phase Budget Plans, Deliverable Breakdowns, Overheads, Revenue BOQ, Regulatory Tariffs, and Personnel Security. Clicking <strong>Save Rules</strong> permanently persists customized numbering schemas. Clicking <strong>Sync Counters</strong> audits the database to ensure zero collision with existing historic records.
              </p>
            </div>
          </div>

          {/* Add Custom Auto-Number Rule Modal */}
          {isAddCustomRuleModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <Plus className="w-4 h-4 text-[#003049]" />
                    <h3 className="text-sm font-bold text-slate-900">Add Custom Auto Number Rule</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddCustomRuleModalOpen(false)}
                    className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveCustomRule} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Entity Label *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Factory Work Order, QC Inspection Tag"
                      value={customRuleLabel}
                      onChange={(e) => {
                        setCustomRuleLabel(e.target.value);
                        if (!customRuleKey) {
                          setCustomRuleKey(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                        }
                      }}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:border-[#003049]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Entity Key *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. work_orders"
                        value={customRuleKey}
                        onChange={(e) => setCustomRuleKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-hidden focus:border-[#003049]"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Category Group</label>
                      <select
                        value={customRuleGroup}
                        onChange={(e) => setCustomRuleGroup(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:border-[#003049]"
                      >
                        <option value="procurement_inventory">Materials & Inventory</option>
                        <option value="projects_planning">Projects & Planning</option>
                        <option value="labor_services">Labor & Services</option>
                        <option value="overheads_cost">Overheads & Cost</option>
                        <option value="commercial_revenue">Commercial & Revenue</option>
                        <option value="tariffs_regulatory">Tariffs & Regulatory</option>
                        <option value="partners_vendors">Partners & Vendors</option>
                        <option value="system_security">Personnel & Security</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Prefix</label>
                      <input
                        type="text"
                        placeholder="e.g. WO-, QC-"
                        value={customRulePrefix}
                        onChange={(e) => setCustomRulePrefix(e.target.value.toUpperCase())}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900 uppercase focus:outline-hidden focus:border-[#003049]"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Suffix (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. -2026"
                        value={customRuleSuffix}
                        onChange={(e) => setCustomRuleSuffix(e.target.value.toUpperCase())}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 uppercase focus:outline-hidden focus:border-[#003049]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Padding Digits</label>
                      <input
                        type="number"
                        min="1"
                        max="8"
                        value={customRuleDigits}
                        onChange={(e) => setCustomRuleDigits(parseInt(e.target.value, 10) || 4)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:border-[#003049]"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Starting Number</label>
                      <input
                        type="number"
                        min="1"
                        value={customRuleNextNum}
                        onChange={(e) => setCustomRuleNextNum(parseInt(e.target.value, 10) || 1)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:outline-hidden focus:border-[#003049]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Description</label>
                    <input
                      type="text"
                      placeholder="Operational purpose of this identifier sequence"
                      value={customRuleDesc}
                      onChange={(e) => setCustomRuleDesc(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:border-[#003049]"
                    />
                  </div>

                  {/* Sample Preview */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Sample Preview:</span>
                    <span className="font-mono font-bold text-slate-900 px-2 py-0.5 bg-white border border-slate-200 rounded shadow-2xs">
                      {customRulePrefix || ''}
                      {String(customRuleNextNum || 1).padStart(Math.max(1, customRuleDigits || 4), '0')}
                      {customRuleSuffix || ''}
                    </span>
                  </div>

                  <div className="pt-2 flex justify-end space-x-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsAddCustomRuleModalOpen(false)}
                      className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold cursor-pointer shadow-sm"
                    >
                      Create Custom Rule
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}


      {/* SUB-TAB 3: EXPORTS */}
      {activeSubTab === 'export_data' && (
        <div className="space-y-4">
          {/* Master Download Box */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-sm font-bold text-slate-900 block">
                Master Executive Dossier & Complete Dataset Export
              </span>
              <span className="text-xs text-slate-500 mt-0.5 block">
                Generate and download comprehensive executive PDF report and itemized CSV datasets.
              </span>
            </div>
            <button
              type="button"
              onClick={handleMasterExportAll}
              disabled={isExportingAll}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm whitespace-nowrap self-start sm:self-auto"
            >
              {isExportingAll ? 'Generating Export...' : 'Download All Datasets (PDF + CSV)'}
            </button>
          </div>

          {/* Individual Module Exports */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
              Individual Datasets
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  exportMaterialsToCSV(materials);
                  showToast('Materials CSV downloaded.');
                }}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left text-xs font-semibold text-slate-800 cursor-pointer"
              >
                Materials ({materials.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  exportInventoryToCSV(inventory);
                  showToast('Inventory CSV downloaded.');
                }}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left text-xs font-semibold text-slate-800 cursor-pointer"
              >
                Inventory ({inventory.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  exportInventoryTransactionsToCSV(transactions);
                  showToast('Transactions CSV downloaded.');
                }}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left text-xs font-semibold text-slate-800 cursor-pointer"
              >
                Transactions ({transactions.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  exportProjectsToCSV(projects);
                  showToast('Projects CSV downloaded.');
                }}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left text-xs font-semibold text-slate-800 cursor-pointer"
              >
                Projects ({projects.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  exportSubcontractorsToCSV(subcontractors);
                  showToast('Subcontractors CSV downloaded.');
                }}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left text-xs font-semibold text-slate-800 cursor-pointer"
              >
                Subcontractors ({subcontractors.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  exportOutsourcedServicesToCSV(outsourced);
                  showToast('Outsourced CSV downloaded.');
                }}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left text-xs font-semibold text-slate-800 cursor-pointer"
              >
                Outsourced ({outsourced.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  exportSuppliersToCSV(suppliers);
                  showToast('Suppliers CSV downloaded.');
                }}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left text-xs font-semibold text-slate-800 cursor-pointer"
              >
                Suppliers ({suppliers.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  exportMasterExecutiveReportPDF(
                    companyDetails,
                    materials,
                    inventory,
                    transactions,
                    projects,
                    subcontractors,
                    outsourced,
                    suppliers
                  );
                  showToast('Executive PDF downloaded.');
                }}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left text-xs font-semibold text-slate-800 cursor-pointer"
              >
                Audit PDF
              </button>
            </div>
          </div>
        </div>
      )}


      {/* SUB-TAB 4: USERS */}
      {activeSubTab === 'users' && (
        <div className="space-y-4">
          {/* Pending Account Requests (if any) */}
          {pendingRequests.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wider block">
                Pending Access Requests ({pendingRequests.length})
              </span>
              <div className="space-y-1.5">
                {pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-2.5 bg-white rounded-lg border border-amber-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900">{req.name}</span>
                      <span className="text-slate-500 ml-2">({req.email})</span>
                      <span className="text-slate-400 ml-2 font-mono">Role: {req.requestedRole}</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => onApproveRequest(req.id)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold cursor-pointer"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => onRejectRequest(req.id)}
                        className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded font-semibold cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User List White Box */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Search user..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-52"
                />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700"
                >
                  <option value="ALL">All Roles</option>
                  <option value="ADMIN">Admin</option>
                  <option value="PROJECT_MANAGER">Project Manager</option>
                  <option value="QUANTITY_SURVEYOR">Quantity Surveyor</option>
                  <option value="PROCUREMENT_OFFICER">Procurement Officer</option>
                  <option value="ESTIMATOR">Estimator</option>
                  <option value="FINANCE_AUDITOR">Finance Auditor</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleOpenAddUser}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add User</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-800">
                <thead className="bg-slate-50 uppercase text-[10px] text-slate-600 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Emp ID</th>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {u.employeeId}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {u.name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {u.email}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-800">
                          {u.role.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {u.department}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            u.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="inline-flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditUser(u)}
                            className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {u.id !== currentUser.id && (
                            <button
                              type="button"
                              onClick={() => onDeleteUser(u.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add / Edit User Modal */}
          {isUserModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
              <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingUserId ? 'Edit User' : 'Add New User'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsUserModalOpen(false)}
                    className="text-slate-400 hover:text-slate-700 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveUser} className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Employee ID</label>
                      <input
                        type="text"
                        value={userFormEmpId}
                        onChange={(e) => setUserFormEmpId(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Name</label>
                      <input
                        type="text"
                        value={userFormName}
                        onChange={(e) => setUserFormName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Email</label>
                    <input
                      type="email"
                      value={userFormEmail}
                      onChange={(e) => setUserFormEmail(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Role</label>
                      <select
                        value={userFormRole}
                        onChange={(e) => setUserFormRole(e.target.value as UserRole)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded"
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="PROJECT_MANAGER">Project Manager</option>
                        <option value="QUANTITY_SURVEYOR">Quantity Surveyor</option>
                        <option value="PROCUREMENT_OFFICER">Procurement Officer</option>
                        <option value="ESTIMATOR">Estimator</option>
                        <option value="FINANCE_AUDITOR">Finance Auditor</option>
                        <option value="VIEWER">Viewer</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Status</label>
                      <select
                        value={userFormStatus}
                        onChange={(e) => setUserFormStatus(e.target.value as any)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Department</label>
                    <input
                      type="text"
                      value={userFormDept}
                      onChange={(e) => setUserFormDept(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded"
                    />
                  </div>


                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setIsUserModalOpen(false)}
                      className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded font-semibold cursor-pointer shadow-sm"
                    >
                      Save User
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB: ROLE ACCESS & PERMISSIONS (ADMIN ONLY) */}
      {activeSubTab === 'permissions' && currentUser.role === 'ADMIN' && (
        <div className="space-y-4">
          {/* Header Banner */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Role Permissions &amp; Portal Access Control
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Configure module viewing permissions and data editing capabilities for every employee account type.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleResetRolePermissions}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                title="Reset all role permissions to standard enterprise defaults"
              >
                Reset Defaults
              </button>
              <button
                type="button"
                id="btn-save-role-permissions"
                onClick={handleSaveRolePermissions}
                className="px-4 py-1.5 bg-[#003049] hover:bg-[#002235] text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-sm flex items-center space-x-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Save Permissions</span>
              </button>
            </div>
          </div>

          {permSuccessNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{permSuccessNotice}</span>
            </div>
          )}

          {/* Account Types Pill Selector */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex flex-wrap gap-1.5">
            {(
              [
                'ADMIN',
                'PROJECT_MANAGER',
                'QUANTITY_SURVEYOR',
                'PROCUREMENT_OFFICER',
                'ESTIMATOR',
                'FINANCE_AUDITOR',
                'VIEWER'
              ] as UserRole[]
            ).map((roleKey) => {
              const cfg = allPermConfigs[roleKey];
              const isSelected = selectedPermRole === roleKey;
              const roleUserCount = users.filter((u) => u.role === roleKey).length;
              return (
                <button
                  key={roleKey}
                  type="button"
                  onClick={() => setSelectedPermRole(roleKey)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center space-x-2 ${
                    isSelected
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200 ring-2 ring-[#003049]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${roleKey === 'ADMIN' ? 'bg-rose-500' : roleKey === 'PROJECT_MANAGER' ? 'bg-blue-500' : 'bg-slate-400'}`} />
                  <span>{cfg.label}</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700">
                    {roleUserCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected Role Permission Matrix Box */}
          {(() => {
            const activeCfg = allPermConfigs[selectedPermRole];
            const isAdminRole = selectedPermRole === 'ADMIN';

            return (
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-6">
                {/* Role Profile Info Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-base font-bold text-slate-900">{activeCfg.label}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${activeCfg.badgeBg}`}>
                        {activeCfg.badgeText}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{activeCfg.description}</p>
                  </div>

                  {isAdminRole ? (
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200 self-start">
                      Full Root Access (Unrestricted)
                    </span>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAllPermConfigs((prev) => ({
                            ...prev,
                            [selectedPermRole]: {
                              ...activeCfg,
                              allowedTabs: ALL_SYSTEM_TABS.map((t) => t.id)
                            }
                          }));
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 cursor-pointer"
                      >
                        Allow All Tabs
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAllPermConfigs((prev) => ({
                            ...prev,
                            [selectedPermRole]: {
                              ...activeCfg,
                              allowedTabs: ['home']
                            }
                          }));
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 cursor-pointer"
                      >
                        Reset to Minimal
                      </button>
                    </div>
                  )}
                </div>

                {/* Section 1: Navigation Portals & Tabs Access */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                      1. Authorized Module &amp; Portal View Access
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {activeCfg.allowedTabs.length} of {ALL_SYSTEM_TABS.length} portals accessible
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {ALL_SYSTEM_TABS.map((tab) => {
                      const isAllowed = activeCfg.allowedTabs.includes(tab.id);
                      return (
                        <label
                          key={tab.id}
                          className={`p-3 rounded-lg border flex items-center justify-between text-xs transition-colors ${
                            isAdminRole
                              ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-90'
                              : isAllowed
                              ? 'bg-blue-50/70 border-blue-200 text-slate-900 cursor-pointer'
                              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                            <input
                              type="checkbox"
                              checked={isAllowed}
                              disabled={isAdminRole || tab.id === 'home'}
                              onChange={() => handleToggleTabPermission(tab.id)}
                              className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                            />
                            <div className="truncate">
                              <span className="font-semibold block truncate">{tab.label}</span>
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                                {tab.group}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                              isAllowed
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {isAllowed ? 'Allowed' : 'Hidden'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Section 2: Operational Data Mutation Capabilities */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                    2. Data Mutation &amp; Commercial Capabilities
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {[
                      { key: 'canCreate', label: 'Create New Records', desc: 'Can add materials, produce items, suppliers, trades, or projects' },
                      { key: 'canEdit', label: 'Edit / Update Rates & Specs', desc: 'Can adjust prices, rates, contact details, and BOQ parameters' },
                      { key: 'canDelete', label: 'Delete Records', desc: 'Can permanently remove records from the catalog and projects' },
                      { key: 'canExport', label: 'Export Reports (PDF / CSV)', desc: 'Can download executive quotes, audit summaries, and spreadsheets' },
                      { key: 'canViewFinancials', label: 'View Cost Margins & Profits', desc: 'Can see net profit margins, markups, and project cost analyses' },
                      { key: 'canManageTariffs', label: 'Manage Tariffs & Overheads', desc: 'Can define official tariff rates and project overhead allocations' },
                      { key: 'canManageInventory', label: 'Record Stock IN / OUT', desc: 'Can process warehouse receipts, dispatches, and stock adjustments' },
                      { key: 'canManageUsers', label: 'Manage User Accounts', desc: 'Can create accounts, approve requests, and reset credentials' },
                      { key: 'canManageSettings', label: 'Configure System Settings', desc: 'Can modify company details, numbering rules, and appearance' }
                    ].map((cap) => {
                      const isCapEnabled = Boolean(activeCfg[cap.key as keyof RolePermissionConfig]);
                      return (
                        <label
                          key={cap.key}
                          className={`p-3 rounded-lg border text-xs transition-colors flex items-start space-x-2.5 ${
                            isAdminRole
                              ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-90'
                              : isCapEnabled
                              ? 'bg-emerald-50/60 border-emerald-200 cursor-pointer'
                              : 'bg-white border-slate-200 hover:bg-slate-50 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isCapEnabled}
                            disabled={isAdminRole}
                            onChange={() => handleToggleCapability(cap.key as keyof RolePermissionConfig)}
                            className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 mt-0.5"
                          />
                          <div>
                            <span className="font-bold text-slate-900 block">{cap.label}</span>
                            <span className="text-[11px] text-slate-500 block mt-0.5 leading-snug">{cap.desc}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Save Action */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    Changes take effect immediately for active and future user sessions.
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveRolePermissions}
                    className="px-5 py-2 bg-[#003049] hover:bg-[#002235] text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-sm flex items-center space-x-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Apply &amp; Save Role Permissions</span>
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* SUB-TAB 5: APPEARANCE */}
      {activeSubTab === 'appearance' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
            Theme
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => handleSelectTheme('light')}
              className={`p-4 rounded-xl border text-left cursor-pointer transition-colors ${
                themeMode === 'light'
                  ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <Sun className="w-5 h-5 text-amber-500 mb-2" />
              <div className="font-bold text-xs text-slate-900">Light</div>
              <span className="text-[11px] text-slate-500">Day mode</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTheme('dark')}
              className={`p-4 rounded-xl border text-left cursor-pointer transition-colors ${
                themeMode === 'dark'
                  ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <Moon className="w-5 h-5 text-slate-800 mb-2" />
              <div className="font-bold text-xs text-slate-900">Dark</div>
              <span className="text-[11px] text-slate-500">Night mode</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTheme('system')}
              className={`p-4 rounded-xl border text-left cursor-pointer transition-colors ${
                themeMode === 'system'
                  ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <Monitor className="w-5 h-5 text-blue-500 mb-2" />
              <div className="font-bold text-xs text-slate-900">System</div>
              <span className="text-[11px] text-slate-500">Follow device</span>
            </button>
          </div>
        </div>
      )}

      {/* SUB-TAB 6: SECURITY */}
      {activeSubTab === 'security' && currentUser.role === 'ADMIN' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Box 1: Session Timeout */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                  System Session Timeout
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Auto Sign-Out Active
                </span>
              </div>
              <p className="text-xs text-slate-500">
                At the end of this inactivity period, the logged account will automatically be signed out to protect system data.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <select
                  value={sessionTimeout}
                  onChange={(e) => {
                    const min = parseInt(e.target.value, 10);
                    setSessionTimeout(min);
                    setStoredTimeoutMinutes(min);
                    const token = getStoredSessionToken();
                    if (token) {
                      fetch('/api/security/admin-config', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({ sessionTimeoutMinutes: min })
                      }).catch(() => {});
                    }
                    showToast(`Session timeout configured to ${min} minute${min > 1 ? 's' : ''}. Auto sign-out enabled.`);
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value={1}>1 Minute (Fast Test & Strict Security)</option>
                  <option value={5}>5 Minutes (High Security)</option>
                  <option value={10}>10 Minutes</option>
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes (Recommended)</option>
                  <option value={60}>60 Minutes (1 Hour)</option>
                  <option value={120}>120 Minutes (2 Hours)</option>
                  <option value={480}>480 Minutes (8 Hours / Full Shift)</option>
                </select>
              </div>
            </div>

            {/* Box 2: Two-Factor Auth */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                Two-Factor Auth (2FA)
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleOpenGoogleAuthSetup}
                  disabled={isSecurityLoading}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm"
                >
                  {totpConfigured ? 'Reconfigure 2FA' : 'Set Up 2FA'}
                </button>
                {totpConfigured && (
                  <span className="text-xs text-emerald-600 font-bold">Active</span>
                )}
              </div>
            </div>
          </div>

          {/* Backup Codes */}
          {backupCodes.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Backup Codes
                </span>
                <button
                  type="button"
                  onClick={handleDownloadBackupCodesPdf}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-semibold cursor-pointer"
                >
                  Download PDF
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {backupCodes.map((code, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-slate-50 border border-slate-200 rounded text-xs font-mono font-bold text-center text-slate-800"
                  >
                    {code}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2FA QR Code Modal */}
          {totpQrModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
              <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 text-center">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="text-sm font-bold text-slate-900">Scan QR Code</h3>
                  <button
                    type="button"
                    onClick={() => setTotpQrModalOpen(false)}
                    className="text-slate-400 hover:text-slate-700 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {totpQrDataUrl && (
                  <div className="p-3 bg-white border border-slate-200 rounded-xl inline-block mx-auto">
                    <img src={totpQrDataUrl} alt="2FA QR" className="w-48 h-48 mx-auto" />
                  </div>
                )}

                <form onSubmit={handleConfirmTotp} className="space-y-3 text-xs">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit code"
                    value={totpVerifyCode}
                    onChange={(e) => setTotpVerifyCode(e.target.value)}
                    className="w-full text-center tracking-widest text-base font-mono font-bold py-2 border border-slate-300 rounded-lg"
                    autoFocus
                  />
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setTotpQrModalOpen(false)}
                      className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSecurityLoading}
                      className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded font-semibold cursor-pointer shadow-sm"
                    >
                      Verify & Activate
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
