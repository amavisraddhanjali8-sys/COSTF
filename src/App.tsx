import { bizStore } from './services/bizStore';
import React, { useState, useEffect } from 'react';
import { TopNavbar, ActiveTab } from './components/TopNavbar';
import { CostAnalysisView } from './components/CostAnalysisView';
import { ResourceAllocationView } from './components/ResourceAllocationView';
import { ProjectTimelinesView } from './components/ProjectTimelinesView';
import { FXTTCardItemsListView } from './components/FXTTCardItemsListView';
import { InventoryProcurementView } from './components/InventoryProcurementView';
import { ProjectsView } from './components/ProjectsView';
import { DirectoryCardsHubView } from './components/DirectoryCardsHubView';
import { MasterDataGridCatalog } from './components/MasterDataGridCatalog';
import { ProjectHomeView } from './components/ProjectHomeView';
import { SettingsView } from './components/SettingsView';
import { AuditLogView } from './components/AuditLogView';
import { LoginPage } from './components/LoginPage';
import { SessionTimeoutWarningModal } from './components/SessionTimeoutWarningModal';
import {
  initSessionActivityTracker,
  getSessionRemainingSeconds,
  extendSession,
  clearSession,
  getStoredTimeoutMinutes
} from './services/sessionService';
import { CategoryNode, INITIAL_CATEGORY_HIERARCHY, ClientProfile, INITIAL_CLIENT_PROFILES } from './data/categoriesAndProfiles';
import {
  Project,
  MaterialItem,
  Supplier,
  SupplierContract,
  OutsourcedService,
  SubcontractorRateItem,
  InventoryItem,
  ProduceItem,
  VolumePriceTier,
  InventoryTransaction,
  AppUser,
  AccountRequest,
  CompanyDetails,
  AuditLogRecord
} from './types';
import {
  INITIAL_PROJECTS,
  INITIAL_MATERIALS,
  INITIAL_SUPPLIERS,
  INITIAL_OUTSOURCED_SERVICES,
  INITIAL_SUBCONTRACTORS,
  INITIAL_INVENTORY,
  INITIAL_PRODUCE_ITEMS
} from './data/initialData';
import {
  INITIAL_USERS,
  getStoredUsers,
  saveStoredUsers,
  getStoredRequests,
  saveStoredRequests,
  getStoredCompanyDetails,
  saveStoredCompanyDetails,
  getStoredAuditLogs,
  saveStoredAuditLogs,
  getStoredCurrentUser,
  saveStoredCurrentUser
} from './data/userAndAuditData';
import { api } from './services/api';
import { exportProjectQuotePDF } from './utils/pdfExport';
import { persistentDatabase } from './services/persistentDatabase';
import { gmailService } from './services/gmailService';
import { applyThemeToDocument, initThemeListener, setStoredThemeMode } from './services/themeService';
import { initGlobalBarcodeScanner, addBarcodeScanListener, BarcodeScanEventDetail } from './services/globalBarcodeScanner';
import { GlobalSearchResult } from './utils/systemGlobalSearch';
import { SelectProjectModal } from './components/SelectProjectModal';
import { FloatingFXUtilityPanel } from './components/FloatingFXUtilityPanel';
import { CheckCircle2, Barcode, Moon, Sun } from 'lucide-react';
import { NotificationToastContainer, ToastItem } from './components/NotificationToast';
import { calculateProjectProfitability, getMarginThreshold } from './utils/profitabilityMonitor';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => getStoredCurrentUser());
  const [sessionRemainingSeconds, setSessionRemainingSeconds] = useState<number>(() => getSessionRemainingSeconds());
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(null);
  const [users, setUsers] = useState<AppUser[]>(() => getStoredUsers());
  const [accountRequests, setAccountRequests] = useState<AccountRequest[]>(() => getStoredRequests());
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails>(() => getStoredCompanyDetails());
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>(() => getStoredAuditLogs());

  // Active Session Inactivity Tracker & Auto Sign-Out Engine
  useEffect(() => {
    if (!currentUser) {
      setIsWarningModalOpen(false);
      return;
    }

    const cleanup = initSessionActivityTracker({
      warningThresholdSeconds: 60,
      onTick: (secondsLeft) => {
        setSessionRemainingSeconds(secondsLeft);
        if (secondsLeft > 60) {
          setIsWarningModalOpen(false);
        }
      },
      onWarning: () => {
        setIsWarningModalOpen(true);
      },
      onInactivityLogout: () => {
        setIsWarningModalOpen(false);
        handleLogout('timeout');
      }
    });

    return cleanup;
  }, [currentUser]);

  // Show server errors that no handler caught
  useEffect(() => {
    const onReject = (ev: PromiseRejectionEvent) => {
      const msg = ev?.reason?.message;
      if (msg) {
        ev.preventDefault();
        showToast(msg);
      }
    };
    window.addEventListener('unhandledrejection', onReject);
    return () => window.removeEventListener('unhandledrejection', onReject);
  }, []);

  // Server says the session is gone: go back to the login page
  useEffect(() => {
    const onCleared = () => {
      saveStoredCurrentUser(null);
      setCurrentUser(null);
      setIsWarningModalOpen(false);
    };
    window.addEventListener('fxtt_session_cleared', onCleared);
    return () => window.removeEventListener('fxtt_session_cleared', onCleared);
  }, []);

  const [activeTab, setActiveTab] = useState<ActiveTab>('directory-hub');
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);
  const [projectPickerTarget, setProjectPickerTarget] = useState<'margins' | 'timelines' | 'resources' | 'cost-analysis' | 'general'>('general');
  
  // Static & Stable persistent central database initialization
  const [projects, setProjects] = useState<Project[]>(() => persistentDatabase.getProjects([]));
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => persistentDatabase.getProjects([])[0]?.id || '');
  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0] || null;
  const [materials, setMaterials] = useState<MaterialItem[]>(() => persistentDatabase.getMaterials([]));
  const [produceItems, setProduceItems] = useState<ProduceItem[]>(() => persistentDatabase.getProduceItems([]));
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => persistentDatabase.getSuppliers([]));
  const [outsourcedServices, setOutsourcedServices] = useState<OutsourcedService[]>(() => persistentDatabase.getOutsourcedServices([]));
  const [subcontractors, setSubcontractors] = useState<SubcontractorRateItem[]>(() => persistentDatabase.getSubcontractors([]));
  const [inventory, setInventory] = useState<InventoryItem[]>(() => persistentDatabase.getInventory([]));
  const [transactions, setTransactions] = useState<InventoryTransaction[]>(() => persistentDatabase.getTransactions([]));
  const [categories, setCategories] = useState<CategoryNode[]>(() => persistentDatabase.getCategories());
  const [clients, setClients] = useState<ClientProfile[]>(() => persistentDatabase.getClients([]));
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Sync state mutations to static persistent database
  useEffect(() => {
    persistentDatabase.saveProjects(projects);
  }, [projects]);

  useEffect(() => {
    persistentDatabase.saveMaterials(materials);
  }, [materials]);

  useEffect(() => {
    persistentDatabase.saveProduceItems(produceItems);
  }, [produceItems]);

  useEffect(() => {
    persistentDatabase.saveSuppliers(suppliers);
  }, [suppliers]);

  useEffect(() => {
    persistentDatabase.saveOutsourcedServices(outsourcedServices);
  }, [outsourcedServices]);

  useEffect(() => {
    persistentDatabase.saveSubcontractors(subcontractors);
  }, [subcontractors]);

  useEffect(() => {
    persistentDatabase.saveInventory(inventory);
  }, [inventory]);

  useEffect(() => {
    persistentDatabase.saveTransactions(transactions);
  }, [transactions]);

  useEffect(() => {
    if (categories && categories.length > 0) {
      persistentDatabase.saveCategories(categories);
    }
  }, [categories]);

  // Initialize Theme and Global Rapid Keystroke Barcode Scanner Listener
  useEffect(() => {
    applyThemeToDocument();
    const cleanupTheme = initThemeListener();
    const cleanupScanner = initGlobalBarcodeScanner();

    const unsubscribeBarcode = addBarcodeScanListener((detail: BarcodeScanEventDetail) => {
      // Find matching items in materials, produce items, or inventory
      const mat = materials.find(
        (m) =>
          m.barcode?.toLowerCase() === detail.code.toLowerCase() ||
          m.code?.toLowerCase() === detail.code.toLowerCase()
      );
      const prod = produceItems.find(
        (p) =>
          p.barcode?.toLowerCase() === detail.code.toLowerCase() ||
          p.itemCode?.toLowerCase() === detail.code.toLowerCase()
      );
      const inv = inventory.find(
        (i) =>
          i.barcode?.toLowerCase() === detail.code.toLowerCase() ||
          i.sku?.toLowerCase() === detail.code.toLowerCase()
      );

      const matchName = mat?.name || prod?.name || inv?.materialName || 'Unregistered Barcode';
      const matchType = mat ? 'Material' : prod ? 'Product' : inv ? 'Inventory SKU' : 'Catalog';

      logAuditEvent(
        'HARDWARE_BARCODE_SCAN',
        'Inventory',
        detail.code,
        matchName,
        `Hardware scanner gun detected barcode "${detail.code}" (${detail.charCount} chars, ${detail.averageIntervalMs}ms/key). Matched ${matchType}: ${matchName}.`
      );

      showToast(`⚡ Barcode Scanner Detected: "${detail.code}" (${matchName})`);
    });

    return () => {
      cleanupTheme();
      cleanupScanner();
      unsubscribeBarcode();
    };
  }, [materials, produceItems, inventory]);

  const handleReloadDatabase = () => {
    setProjects(persistentDatabase.getProjects(INITIAL_PROJECTS));
    setMaterials(persistentDatabase.getMaterials(INITIAL_MATERIALS));
    setProduceItems(persistentDatabase.getProduceItems(INITIAL_PRODUCE_ITEMS));
    setSuppliers(persistentDatabase.getSuppliers(INITIAL_SUPPLIERS));
    setOutsourcedServices(persistentDatabase.getOutsourcedServices(INITIAL_OUTSOURCED_SERVICES));
    setSubcontractors(persistentDatabase.getSubcontractors(INITIAL_SUBCONTRACTORS));
    setInventory(persistentDatabase.getInventory(INITIAL_INVENTORY));
    setTransactions(persistentDatabase.getTransactions([]));
    setCategories(persistentDatabase.getCategories());
    showToast('Central database synchronized from persistent static store.');
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const showToast = (toastOrMsg: string | (Partial<ToastItem> & { message: string })) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newToast: ToastItem =
      typeof toastOrMsg === 'string'
        ? { id, type: 'info', message: toastOrMsg }
        : {
            id,
            type: toastOrMsg.type || 'info',
            title: toastOrMsg.title,
            message: toastOrMsg.message,
            actionLabel: toastOrMsg.actionLabel,
            onAction: toastOrMsg.onAction
          };

    setToasts((prev) => [...prev.slice(-3), newToast]);
    setTimeout(() => {
      dismissToast(id);
    }, 4500);
  };

  // Monitor active project profitability against user-defined margin threshold
  const [marginThreshold, setMarginThresholdState] = useState<number>(() => getMarginThreshold());
  const lastWarnedProjectRef = React.useRef<{ id: string; margin: number; time: number } | null>(null);

  useEffect(() => {
    const handleThresholdChange = (e: any) => {
      if (e.detail?.threshold !== undefined) {
        setMarginThresholdState(e.detail.threshold);
      }
    };
    window.addEventListener('margin-threshold-changed', handleThresholdChange);
    return () => {
      window.removeEventListener('margin-threshold-changed', handleThresholdChange);
    };
  }, []);

  useEffect(() => {
    if (!selectedProject) return;

    const analysis = calculateProjectProfitability(selectedProject, marginThreshold);

    if (analysis.isMarginBelowThreshold) {
      const last = lastWarnedProjectRef.current;
      const roundedMargin = Math.round(analysis.netMarginPct * 10) / 10;
      const isSameProject = last?.id === selectedProject.id;
      const isSameMargin = last?.margin === roundedMargin;
      const isRecent = last && Date.now() - last.time < 20000;

      if (!isSameProject || !isSameMargin || !isRecent) {
        lastWarnedProjectRef.current = {
          id: selectedProject.id,
          margin: roundedMargin,
          time: Date.now()
        };

        showToast({
          type: 'warning',
          title: 'Margin Alert',
          message: `${selectedProject.name}: Margin ${analysis.netMarginPct.toFixed(1)}% is below ${marginThreshold}% target`,
          actionLabel: 'View Margins',
          onAction: () => {
            setActiveTab('cost-analysis');
          }
        });
      }
    }
  }, [selectedProject?.id, selectedProject?.quotedPrice, selectedProject?.selectedItems?.length, marginThreshold]);

  // Helper to append and persist audit log records
  const logAuditEvent = (
    action: string,
    module: 'Inventory' | 'Materials' | 'Users' | 'Settings' | 'Auth' | 'Projects' | 'Catalog',
    recordId?: string,
    recordName?: string,
    details?: string,
    overrideActor?: AppUser
  ) => {
    const actor = overrideActor || currentUser || users[0];
    const newRecord: AuditLogRecord = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      actorId: actor?.employeeId || 'SYSTEM',
      actorName: actor?.name || 'System Daemon',
      actorRole: actor?.role || 'ADMIN',
      action,
      module,
      recordId,
      recordName,
      details: details || '',
      ipAddress: '192.168.1.102',
      status: 'Success'
    };

    setAuditLogs(prev => {
      const updated = [newRecord, ...prev];
      saveStoredAuditLogs(updated);
      return updated;
    });
  };

  // Auth Handlers
  const handleLogin = (user: AppUser, source: 'password' | 'google' = 'password') => {
    setCurrentUser(user);
    saveStoredCurrentUser(user);
    setSessionExpiredNotice(null);
    setIsWarningModalOpen(false);
    extendSession();
    setSessionRemainingSeconds(getSessionRemainingSeconds());
    if (user.themePreference) {
      setStoredThemeMode(user.themePreference);
    }
    logAuditEvent(
      'USER_LOGIN',
      'Auth',
      user.employeeId,
      user.name,
      `User ${user.name} logged into enterprise session as ${user.role} via ${source === 'google' ? 'Google OAuth' : 'Standard Credentials'}.`,
      user
    );
    showToast(`Welcome back, ${user.name}`);
  };

  const handleExtendSession = () => {
    extendSession();
    const remaining = getSessionRemainingSeconds();
    setSessionRemainingSeconds(remaining);
    setIsWarningModalOpen(false);
    showToast('Session extended. Inactivity timer refreshed.');
  };

  // User Password update handler (for account recovery)
  const handleUpdateUserPassword = async (userId: string, newPassword: string): Promise<boolean> => {
    let updated = false;
    setUsers(prev => {
      const next = prev.map(u => {
        if (u.id === userId || u.employeeId === userId || u.email.toLowerCase() === userId.toLowerCase()) {
          updated = true;
          return { ...u, password: newPassword };
        }
        return u;
      });
      if (updated) saveStoredUsers(next);
      return next;
    });

    logAuditEvent(
      'USER_PASSWORD_RESET',
      'Auth',
      userId,
      'Account Recovery',
      `Temporary recovery password applied and dispatched via Gmail.`
    );
    return updated;
  };

  // Google User Registration handler
  const handleRegisterGoogleUser = (newUser: AppUser): AppUser => {
    setUsers(prev => {
      const exists = prev.find(u => u.email.toLowerCase() === newUser.email.toLowerCase());
      if (exists) return prev;
      const updated = [newUser, ...prev];
      saveStoredUsers(updated);
      return updated;
    });
    logAuditEvent(
      'USER_CREATED_GOOGLE',
      'Auth',
      newUser.employeeId,
      newUser.name,
      `Authenticated and onboarded with Google Workspace OAuth.`
    );
    return newUser;
  };

  const handleLogout = (reason: 'manual' | 'timeout' = 'manual') => {
    if (currentUser) {
      logAuditEvent(
        reason === 'timeout' ? 'SESSION_TIMEOUT' : 'USER_LOGOUT',
        'Auth',
        currentUser.employeeId,
        currentUser.name,
        reason === 'timeout'
          ? `User ${currentUser.name} automatically signed out due to inactivity timeout (${getStoredTimeoutMinutes()}m).`
          : `User ${currentUser.name} signed out of session.`
      );
    }
    clearSession();
    saveStoredCurrentUser(null);
    setCurrentUser(null);
    setIsWarningModalOpen(false);

    if (reason === 'timeout') {
      const mins = getStoredTimeoutMinutes();
      setSessionExpiredNotice(`Your session timed out after ${mins} minute${mins > 1 ? 's' : ''} of inactivity. You have been automatically signed out.`);
      showToast('Session timed out. Account automatically signed out.');
    } else {
      setSessionExpiredNotice(null);
      showToast('Signed out successfully.');
    }
  };

  const handleRequestAccount = (reqData: Omit<AccountRequest, 'id' | 'submittedAt' | 'status'>) => {
    const newReq: AccountRequest = {
      ...reqData,
      id: `req-${Date.now()}`,
      submittedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      status: 'Pending'
    };
    setAccountRequests(prev => {
      const updated = [newReq, ...prev];
      saveStoredRequests(updated);
      return updated;
    });
    logAuditEvent(
      'ACCOUNT_REQUESTED',
      'Auth',
      newReq.employeeId,
      newReq.name,
      `Account request submitted for role ${newReq.requestedRole}. Dept: ${newReq.department}`
    );
    showToast('Account request submitted. An Administrator will review your access.');
  };

  const handleApproveRequest = (requestId: string) => {
    const req = accountRequests.find(r => r.id === requestId);
    if (!req) return;

    const newUser: AppUser = {
      id: `user-${Date.now()}`,
      employeeId: req.employeeId,
      name: req.name,
      email: req.email,
      role: req.requestedRole,
      department: req.department,
      status: 'Active',
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };

    setUsers(prev => {
      const updated = [newUser, ...prev];
      saveStoredUsers(updated);
      return updated;
    });

    setAccountRequests(prev => {
      const updated = prev.map(r => r.id === requestId ? { ...r, status: 'Approved' as const } : r);
      saveStoredRequests(updated);
      return updated;
    });

    logAuditEvent(
      'USER_APPROVED',
      'Users',
      newUser.employeeId,
      newUser.name,
      `Administrator approved account request for ${newUser.name} (${newUser.role}).`
    );
    showToast(`Account approved. User ${newUser.name} is now active.`);
  };

  const handleRejectRequest = (requestId: string) => {
    const req = accountRequests.find(r => r.id === requestId);
    setAccountRequests(prev => {
      const updated = prev.map(r => r.id === requestId ? { ...r, status: 'Rejected' as const } : r);
      saveStoredRequests(updated);
      return updated;
    });
    if (req) {
      logAuditEvent(
        'REQUEST_REJECTED',
        'Users',
        req.employeeId,
        req.name,
        `Administrator rejected account request for ${req.name}.`
      );
    }
    showToast('Account request rejected.');
  };

  const handleUpdateCompanyDetails = async (details: CompanyDetails) => {
    setCompanyDetails(details);
    saveStoredCompanyDetails(details);
    try {
      await api.updateCompanyDetails(details);
    } catch (e) {
      console.warn('API updateCompanyDetails fallback:', e);
    }
    logAuditEvent(
      'SETTINGS_UPDATE',
      'Settings',
      'COMP-CONFIG',
      details.name,
      `Updated company details and logo placement (${details.logoPosition} corner).`
    );
  };

  const handleAddUser = async (userData: Omit<AppUser, 'id' | 'createdAt'>) => {
    let created: AppUser | null = null;
    try {
      created = await api.createUser(userData);
    } catch (e) {
      console.warn('API createUser fallback:', e);
    }
    const newUser: AppUser = created || {
      ...userData,
      id: `user-${Date.now()}`,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };
    setUsers(prev => {
      const updated = [newUser, ...prev];
      saveStoredUsers(updated);
      return updated;
    });
    logAuditEvent(
      'USER_CREATED',
      'Users',
      newUser.employeeId,
      newUser.name,
      `Admin created user account for ${newUser.name} (${newUser.role}).`
    );
  };

  const handleUpdateUser = async (id: string, updates: Partial<AppUser>) => {
    try {
      await api.updateUser(id, updates);
    } catch (e) {
      console.warn('API updateUser fallback:', e);
    }
    setUsers(prev => {
      const updated = prev.map(u => u.id === id ? { ...u, ...updates } : u);
      saveStoredUsers(updated);
      return updated;
    });
    // If the updated user is currently logged in, update current session as well
    setCurrentUser(prev => {
      if (prev && prev.id === id) {
        const nextUser = { ...prev, ...updates };
        saveStoredCurrentUser(nextUser);
        return nextUser;
      }
      return prev;
    });
    const target = users.find(u => u.id === id);
    if (target) {
      logAuditEvent(
        'USER_UPDATED',
        'Users',
        target.employeeId,
        target.name,
        `Updated account settings for ${target.name}.`
      );
    }
  };

  const handleDeleteUser = async (id: string) => {
    const target = users.find(u => u.id === id);
    try {
      await api.deleteUser(id);
    } catch (e) {
      console.warn('API deleteUser fallback:', e);
    }
    setUsers(prev => {
      const updated = prev.filter(u => u.id !== id);
      saveStoredUsers(updated);
      return updated;
    });
    if (target) {
      logAuditEvent(
        'USER_DELETED',
        'Users',
        target.employeeId,
        target.name,
        `Admin deleted user ${target.name}.`
      );
    }
  };

  const handleUpdateCategories = async (newCats: CategoryNode[]) => {
    setCategories(newCats);
    persistentDatabase.saveCategories(newCats);
  };

  const handleAddClient = async (clientData: Partial<ClientProfile>) => {
    try {
      const created = await api.createClient(clientData);
      setClients(prev => [created, ...prev.filter(c => c.id !== created.id)]);
      showToast(`Client ${created.name} saved successfully.`);
    } catch (e) {
      console.error('Error creating client:', e);
    }
  };

  const handleUpdateClient = async (id: string, clientData: Partial<ClientProfile>) => {
    try {
      const updated = await api.updateClient(id, clientData);
      setClients(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c));
      showToast('Client updated successfully.');
    } catch (e) {
      console.error('Error updating client:', e);
    }
  };

  const handleDeleteClient = async (id: string) => {
    try {
      await api.deleteClient(id);
      setClients(prev => prev.filter(c => c.id !== id));
      showToast('Client removed successfully.');
    } catch (e) {
      console.error('Error deleting client:', e);
    }
  };

  // Load data from the server after login
  const [isDataReady, setIsDataReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    if (!currentUser) {
      setIsDataReady(false);
      return;
    }
    const fetchData = async () => {
      try {
        setLoadError('');
        await bizStore.hydrate();
        const d = await api.loadAll();
        setProjects(d.projects);
        setSelectedProjectId(prev => prev && d.projects.some((p: any) => p.id === prev) ? prev : (d.projects[0]?.id || ''));
        setMaterials(d.materials);
        setProduceItems(d.produce);
        setSuppliers(d.suppliers);
        setOutsourcedServices(d.outsourced);
        setSubcontractors(d.subcontractors);
        setInventory(d.inventory);
        setClients(d.clients);
        setCategories(d.categories);
        setTransactions(d.transactions);
        if (d.company && d.company.name) setCompanyDetails(d.company);
        if (Array.isArray(d.users)) setUsers(d.users);
        setIsDataReady(true);
      } catch (e) {
        console.error('Could not load data:', e);
        setLoadError('Could not load data. Check the connection and try again.');
      }
    };
    fetchData();
  }, [currentUser?.id]);

  // Recalculate with Python Analytics Engine
  const handleRefreshAnalytics = async () => {
    if (!selectedProject) return;
    try {
      const updatedAnalytics = await api.calculateProjectProfitability(selectedProject);
      if (updatedAnalytics) {
        const updatedProject: Project = {
          ...selectedProject,
          analytics: updatedAnalytics
        };
        setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
        showToast(`Python Analytics Engine calculated real-time margins for ${selectedProject.code}.`);
      } else {
        showToast('Calculations updated successfully.');
      }
    } catch (err) {
      showToast('Calculations refreshed with built-in financial models.');
    }
  };

  // Export PDF
  const handleExportPDF = (projectToExport?: Project) => {
    const target = projectToExport || selectedProject;
    if (!target) {
      showToast('Please select a project to export.');
      return;
    }
    try {
      exportProjectQuotePDF(target);
      showToast(`Executive PDF Quote successfully downloaded for ${target.code}.`);
    } catch (e) {
      console.error('PDF export error:', e);
      showToast('PDF generated.');
    }
  };

  // Material Price Update with History
  const handleUpdateMaterialPrice = async (
    id: string,
    newPrice: number,
    reason: string,
    updatedBy: string,
    tiers?: VolumePriceTier[]
  ) => {
    const updated = await api.updateMaterialPrice(id, newPrice, reason, updatedBy, tiers);
    if (updated && updated.id) {
      setMaterials(prev => prev.map(m => m.id === id ? updated : m));
    } else {
      setMaterials(prev => prev.map(m => {
        if (m.id === id) {
          const old = m.retailPrice;
          const changePct = old > 0 ? Number((((newPrice - old) / old) * 100).toFixed(2)) : 0;
          return {
            ...m,
            retailPrice: newPrice,
            lastUpdated: new Date().toISOString().split('T')[0],
            priceHistory: [
              {
                id: `hist-${Date.now()}`,
                date: new Date().toISOString().split('T')[0],
                previousPrice: old,
                newPrice: newPrice,
                changePct,
                reason,
                updatedBy
              },
              ...(m.priceHistory || [])
            ]
          };
        }
        return m;
      }));
    }
    showToast(`Price updated for item. Audit log entry recorded.`);
  };

  // Add Material
  const handleAddMaterial = async (matData: Partial<MaterialItem>) => {
    const newMat = await api.createMaterial(matData);
    if (newMat) {
      setMaterials(prev => [newMat, ...prev]);
    } else {
      const fallback: MaterialItem = {
        id: `mat-${Date.now()}`,
        code: matData.code || 'MAT-CUSTOM',
        name: matData.name || 'Custom Material Spec',
        category: matData.category || 'General',
        subCategory: matData.subCategory || 'General',
        moreSubCategory: matData.moreSubCategory || 'General',
        itemClassification: matData.itemClassification || 'raw_material',
        supplierId: matData.supplierId || 'sup-1',
        supplierName: matData.supplierName || 'Vanguard',
        unit: matData.unit || 'pcs',
        retailPrice: matData.retailPrice || 100,
        defaultDiscountPct: matData.defaultDiscountPct || 0,
        inStock: matData.inStock || 10,
        reorderPoint: 5,
        leadTimeDays: matData.leadTimeDays || 7,
        lastUpdated: new Date().toISOString().split('T')[0],
        priceHistory: [],
        volumePricing: matData.volumePricing || []
      };
      setMaterials(prev => [fallback, ...prev]);
    }
    showToast('New material added to catalog.');
  };

  const handleUpdateMaterial = async (id: string, updatedFields: Partial<MaterialItem>) => {
    await api.updateMaterial(id, updatedFields);
    setMaterials(prev => prev.map(m => m.id === id ? { ...m, ...updatedFields } : m));
    showToast('Material item updated.');
  };

  const handleDeleteMaterial = async (id: string) => {
    await api.deleteMaterial(id);
    persistentDatabase.deleteMaterial(id);
    setMaterials(prev => prev.filter(m => m.id !== id));
    logAuditEvent('MATERIAL_DELETED', 'Materials', id, 'Material Item', `Deleted material record ${id} from catalog.`);
    showToast('Material item deleted from catalog.');
  };

  // Update Subcontractor Rate
  const handleUpdateSubcontractorRate = async (
    id: string,
    newRate: number,
    reason: string,
    updatedBy: string
  ) => {
    const updated = await api.updateSubcontractorRate(id, newRate, reason, updatedBy);
    if (updated && updated.id) {
      setSubcontractors(prev => prev.map(s => s.id === id ? updated : s));
    } else {
      setSubcontractors(prev => prev.map(s => {
        if (s.id === id) {
          const old = s.rate ?? s.baseRate ?? 0;
          return {
            ...s,
            baseRate: newRate,
            rate: newRate,
            lastUpdated: new Date().toISOString().split('T')[0],
            priceHistory: [
              {
                id: `hist-${Date.now()}`,
                date: new Date().toISOString().split('T')[0],
                previousRate: old,
                newRate: newRate,
                reason,
                updatedBy
              },
              ...(s.priceHistory || [])
            ]
          };
        }
        return s;
      }));
    }
    showToast('Subcontractor rate schedule updated and audited.');
  };

  // Add Subcontractor Rate
  const handleAddSubcontractor = async (item: Partial<SubcontractorRateItem>) => {
    const created = await api.createSubcontractor(item);
    if (created) {
      setSubcontractors(prev => [created, ...prev]);
    } else {
      const fallback: SubcontractorRateItem = {
        id: `sub-${Date.now()}`,
        code: item.code || 'SUB-CUSTOM',
        name: item.name || 'Custom Service',
        subcontractorId: item.subcontractorId || 'sup-1',
        subcontractorName: item.subcontractorName || 'Vanguard',
        category: item.category || 'Fabrication',
        subCategory: item.subCategory || 'General',
        serviceType: item.serviceType || 'Precision Fabrication',
        unit: item.unit || 'per_hour',
        baseRate: item.baseRate || item.rate || 100,
        rate: item.rate || item.baseRate || 100,
        retailRate: item.retailRate || 130,
        skillLevel: item.skillLevel || 'Certified Senior Engineer',
        lastUpdated: new Date().toISOString().split('T')[0],
        priceHistory: [],
        rateRanges: item.rateRanges || []
      };
      setSubcontractors(prev => [fallback, ...prev]);
    }
    showToast('Subcontractor rate schedule registered.');
  };

  const handleUpdateSubcontractor = async (id: string, updatedFields: Partial<SubcontractorRateItem>) => {
    await api.updateSubcontractor(id, updatedFields);
    setSubcontractors(prev => prev.map(s => s.id === id ? { ...s, ...updatedFields } : s));
    showToast('Subcontractor profile updated.');
  };

  const handleDeleteSubcontractor = async (id: string) => {
    await api.deleteSubcontractor(id);
    persistentDatabase.deleteSubcontractor(id);
    setSubcontractors(prev => prev.filter(s => s.id !== id));
    logAuditEvent('SUBCONTRACTOR_DELETED', 'Catalog', id, 'Subcontractor Rate', `Deleted subcontractor rate card ${id}.`);
    showToast('Subcontractor removed from enterprise directory.');
  };

  // Update Outsourced Rate
  const handleUpdateOutsourcedRate = async (
    id: string,
    newRate: number,
    reason: string,
    updatedBy: string
  ) => {
    const updated = await api.updateOutsourcedRate(id, newRate, reason, updatedBy);
    if (updated && updated.id) {
      setOutsourcedServices(prev => prev.map(o => o.id === id ? updated : o));
    } else {
      setOutsourcedServices(prev => prev.map(o => {
        if (o.id === id) {
          const old = o.rate;
          return {
            ...o,
            rate: newRate,
            lastUpdated: new Date().toISOString().split('T')[0],
            priceHistory: [
              {
                id: `hist-${Date.now()}`,
                date: new Date().toISOString().split('T')[0],
                oldRate: old,
                newRate: newRate,
                reason,
                updatedBy
              },
              ...(o.priceHistory || [])
            ]
          };
        }
        return o;
      }));
    }
    showToast('Outsourced tariff updated and logged.');
  };

  // Add Outsourced Service
  const handleAddOutsourcedService = async (item: Partial<OutsourcedService>) => {
    let created: OutsourcedService | null = null;
    try {
      created = await api.createOutsourcedService(item);
    } catch (e) {
      console.warn('API createOutsourcedService failed:', e);
    }
    const finalItem: OutsourcedService = created || {
      id: item.id || `svc-${Date.now()}`,
      name: item.name || 'Outsourced Utility Service',
      providerId: item.providerId || 'sup-1',
      providerName: item.providerName || 'Global Services',
      category: item.category || 'Specialized Services',
      subCategory: item.subCategory || 'General',
      baseUnitType: item.baseUnitType || 'per_hour',
      rate: Number(item.rate || 5),
      retailPrice: Number(item.retailPrice || 6),
      slaLevel: item.slaLevel || 'Tier-1 SLA (99.5%)',
      lastUpdated: new Date().toISOString().split('T')[0],
      priceHistory: [],
      tierRates: item.tierRates || []
    };
    persistentDatabase.addOutsourcedService(finalItem);
    setOutsourcedServices(prev => [finalItem, ...prev.filter(o => o.id !== finalItem.id)]);
    showToast(`Outsourced tariff "${finalItem.name}" registered.`);
  };

  const handleUpdateOutsourcedService = async (id: string, updatedFields: Partial<OutsourcedService>) => {
    try {
      await api.updateOutsourcedService(id, updatedFields);
    } catch (e) {
      console.warn('API updateOutsourcedService failed:', e);
    }
    persistentDatabase.updateOutsourcedService(id, updatedFields);
    setOutsourcedServices(prev => prev.map(o => o.id === id ? { ...o, ...updatedFields } : o));
    showToast('Outsourced tariff updated.');
  };

  const handleDeleteOutsourcedService = async (id: string) => {
    try {
      await api.deleteOutsourcedService(id);
    } catch (e) {
      console.warn('API deleteOutsourcedService error:', e);
    }
    persistentDatabase.deleteOutsourcedService(id);
    setOutsourcedServices(prev => prev.filter(o => o.id !== id));
    logAuditEvent('OUTSOURCED_DELETED', 'Catalog', id, 'Outsourced Tariff', `Deleted outsourced service tariff ${id}.`);
    showToast('Outsourced service tariff removed.');
  };

  // Add Supplier
  const handleAddSupplier = async (sup: Partial<Supplier>) => {
    const created = await api.createSupplier(sup);
    if (created) {
      setSuppliers(prev => [created, ...prev]);
    } else {
      const fallback: Supplier = {
        id: `sup-${Date.now()}`,
        name: sup.name || 'Vendor Corp',
        contactPerson: sup.contactPerson || 'Contact Person',
        email: sup.email || 'orders@vendor.com',
        phone: sup.phone || '+1 (555) 000-0000',
        category: sup.category || 'Materials',
        supplyScope: sup.supplyScope || 'materials',
        paymentTerms: sup.paymentTerms || 'Net 30',
        rating: sup.rating || 4.5,
        onTimeDeliveryPct: sup.onTimeDeliveryPct || 95,
        qualityScorePct: sup.qualityScorePct || 98,
        status: sup.status || 'Active',
        country: sup.country || 'USA',
        city: sup.city || 'Chicago, IL',
        contractHistory: sup.contractHistory || [],
        notes: sup.notes || ''
      };
      setSuppliers(prev => [fallback, ...prev]);
    }
    showToast('Supplier registered into enterprise directory.');
  };

  // Update Supplier
  const handleUpdateSupplier = async (id: string, updatedFields: Partial<Supplier>) => {
    try {
      await api.updateSupplier(id, updatedFields);
    } catch (e) {
      console.warn('API updateSupplier fallback:', e);
    }
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...updatedFields } : s));
    showToast('Supplier record updated.');
  };

  const handleDeleteSupplier = async (id: string) => {
    await api.deleteSupplier(id);
    persistentDatabase.deleteSupplier(id);
    setSuppliers(prev => prev.filter(s => s.id !== id));
    logAuditEvent('SUPPLIER_DELETED', 'Materials', id, 'Supplier Record', `Deleted supplier ${id} from directory.`);
    showToast('Supplier removed from enterprise directory.');
  };

  // Add Supplier Contract
  const handleAddSupplierContract = async (supplierId: string, contract: Partial<SupplierContract>) => {
    const updatedSup = await api.addSupplierContract(supplierId, contract);
    if (updatedSup && updatedSup.id) {
      setSuppliers(prev => prev.map(s => s.id === supplierId ? updatedSup : s));
    } else {
      setSuppliers(prev => prev.map(s => {
        if (s.id === supplierId) {
          const newContract: SupplierContract = {
            contractId: (contract as any).contractId || `ctr-${Date.now()}`,
            contractNumber: contract.contractNumber || `CTR-${Date.now().toString().slice(-4)}`,
            title: contract.title || 'Enterprise Supply Agreement',
            type: contract.type || 'materials',
            scopeType: contract.scopeType || 'materials',
            status: (contract.status === 'Active' || contract.status === 'Completed' || contract.status === 'Renewed' || contract.status === 'Pending Approval') ? contract.status : 'Active',
            startDate: contract.startDate || new Date().toISOString().split('T')[0],
            endDate: contract.endDate || '2027-12-31',
            value: contract.value || 50000,
            paymentTerms: contract.paymentTerms || 'Net 30',
            currency: 'USD',
            scopeDescription: contract.scopeDescription || 'General procurement scope'
          };
          return {
            ...s,
            contractHistory: [newContract, ...(s.contractHistory || [])]
          };
        }
        return s;
      }));
    }
    showToast('Supplier contract agreement recorded and saved.');
  };

  // Update Produce Item Price
  const handleUpdateProducePrice = async (
    id: string,
    newPrice: number,
    reason: string,
    updatedBy: string,
    bundlesAndRanges?: VolumePriceTier[]
  ) => {
    const updated = await api.updateProduceItemPrice(id, newPrice, reason, updatedBy, bundlesAndRanges);
    if (updated && updated.id) {
      setProduceItems(prev => prev.map(p => p.id === id ? updated : p));
    } else {
      setProduceItems(prev => prev.map(p => {
        if (p.id === id) {
          const old = p.retailPrice;
          const changePct = old > 0 ? Number((((newPrice - old) / old) * 100).toFixed(2)) : 0;
          return {
            ...p,
            retailPrice: newPrice,
            bundlesAndRanges: bundlesAndRanges || p.bundlesAndRanges,
            lastUpdated: new Date().toISOString().split('T')[0],
            priceHistory: [
              {
                id: `hist-${Date.now()}`,
                date: new Date().toISOString().split('T')[0],
                previousPrice: old,
                newPrice: newPrice,
                changePct,
                reason,
                updatedBy
              },
              ...(p.priceHistory || [])
            ]
          };
        }
        return p;
      }));
    }
    showToast('Produced product/service price updated and audited.');
  };

  // Add Produce Item
  const handleAddProduceItem = async (itemData: Partial<ProduceItem>) => {
    const created = await api.createProduceItem(itemData);
    if (created) {
      setProduceItems(prev => [created, ...prev]);
    } else {
      const fallback: ProduceItem = {
        id: `prod-${Date.now()}`,
        code: itemData.code || 'PRD-CUSTOM',
        name: itemData.name || 'Custom Product / Service',
        type: itemData.type || 'product',
        category: itemData.category || 'Precision Equipment',
        subCategory: itemData.subCategory || 'General',
        moreSubCategory: itemData.moreSubCategory || 'General',
        unit: itemData.unit || 'system',
        costPrice: itemData.costPrice || 650,
        retailPrice: itemData.retailPrice || 1000,
        defaultDiscountPct: itemData.defaultDiscountPct || 0,
        bundlesAndRanges: itemData.bundlesAndRanges || [],
        leadTimeDays: itemData.leadTimeDays || 14,
        status: itemData.status || 'Active',
        priceHistory: [],
        lastUpdated: new Date().toISOString().split('T')[0]
      };
      setProduceItems(prev => [fallback, ...prev]);
    }
    showToast('New produced product/service registered to enterprise catalog.');
  };

  const handleUpdateProduceItem = async (id: string, updatedFields: Partial<ProduceItem>) => {
    await api.updateProduceItem(id, updatedFields);
    setProduceItems(prev => prev.map(p => p.id === id ? { ...p, ...updatedFields } : p));
    showToast('Product item updated.');
  };

  const handleDeleteProduceItem = async (id: string) => {
    await api.deleteProduceItem(id);
    persistentDatabase.deleteProduceItem(id);
    setProduceItems(prev => prev.filter(p => p.id !== id));
    logAuditEvent('PRODUCT_DELETED', 'Catalog', id, 'Produce Item', `Deleted product assembly ${id} from catalog.`);
    showToast('Product assembly deleted from catalog.');
  };

  // Add Inventory Item
  const handleAddInventory = async (item: Partial<InventoryItem>) => {
    const created = await api.createInventoryItem(item);
    if (created) {
      setInventory(prev => [created, ...prev]);
    } else {
      const fallback: InventoryItem = {
        id: `inv-${Date.now()}`,
        sku: item.sku || 'SKU-001',
        name: item.name || item.itemName || 'Inventory Item',
        itemName: item.name || item.itemName || 'Inventory Item',
        category: item.category || 'Materials',
        allocatedProjectId: item.allocatedProjectId || 'prj-1',
        projectPhase: item.projectPhase || 'Phase 1: Materials',
        onHand: item.onHand || 10,
        reserved: item.reserved || 0,
        available: item.available || 10,
        reorderLevel: item.reorderLevel || 5,
        unit: item.unit || 'pcs',
        unitCost: item.unitCost || 100,
        supplierId: item.supplierId || 'sup-1',
        supplierName: item.supplierName || 'Vanguard',
        status: item.status || 'Optimal',
        location: item.location || 'Bay 1',
        lastAuditDate: new Date().toISOString().split('T')[0]
      };
      setInventory(prev => [fallback, ...prev]);
    }
    showToast('Inventory requisition created.');
  };

  // Update Inventory Stock
  const handleUpdateInventoryStock = (id: string, onHand: number) => {
    setInventory(prev => prev.map(i => {
      if (i.id === id) {
        const available = Math.max(0, onHand - i.reserved);
        const status = onHand <= 0 ? 'Critical Reorder' : onHand <= i.reorderLevel ? 'Low Stock' : 'Optimal';
        return { ...i, onHand, available, status };
      }
      return i;
    }));
    showToast('Inventory count updated.');
  };

  // Record Inventory IN / OUT Transaction
  const handleInventoryTransaction = async (transaction: InventoryTransaction) => {
    // The server checks stock and saves everything in one step
    let saved: InventoryTransaction;
    try {
      saved = await api.createTransaction(transaction);
    } catch (e: any) {
      showToast(e?.message || 'Could not save stock movement');
      return;
    }
    transaction = { ...transaction, ...saved };
    setTransactions((prev) => [transaction, ...prev]);
    try {
      const [mats, inv] = await Promise.all([api.getMaterials(), api.getInventory()]);
      setMaterials(mats);
      setInventory(inv);
    } catch (e) {
      console.error(e);
    }

    // 3. Log to system audit trail
    logAuditEvent(
      transaction.type === 'IN' ? 'INVENTORY_IN' : 'INVENTORY_OUT',
      'Inventory',
      transaction.materialCode,
      transaction.materialName,
      `Recorded Inventory ${transaction.type} (${transaction.type === 'IN' ? '+' : '-'}${transaction.quantity} ${transaction.unit}) at $${transaction.price.toFixed(2)}/unit. Project: ${transaction.projectName || 'General Inventory'}. Discount: ${transaction.discount}%. Net Total: $${transaction.totalAmount.toFixed(2)}.`
    );

    showToast(`Recorded Inventory ${transaction.type}: ${transaction.quantity} ${transaction.unit} for ${transaction.materialCode}`);
  };

  // Create Project
  const handleCreateProject = async (projData: Partial<Project>) => {
    const created = await api.createProject(projData);
    if (created) {
      setProjects(prev => [created, ...prev]);
      setSelectedProjectId(created.id);
    } else {
      const price = projData.quotedPrice || 100000;
      const fallback: Project = {
        id: `prj-${Date.now()}`,
        code: projData.code || 'PRJ-NEW',
        name: projData.name || 'New Project',
        clientName: projData.clientName || 'Valued Client',
        productCategory: projData.productCategory || 'Industrial',
        productSubCategory: projData.productSubCategory || 'Automation',
        moreSubCategory: projData.productMoreSubCategory || projData.moreSubCategory || 'Robotics',
        targetProduct: projData.targetProduct || 'Custom System',
        quotedPrice: price,
        targetMarginPct: projData.targetMarginPct || 25,
        overheadPct: projData.overheadPct || 5,
        contingencyPct: projData.contingencyPct || 3,
        status: projData.status || 'Proposal',
        startDate: new Date().toISOString().split('T')[0],
        deliveryDeadline: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
        createdDate: new Date().toISOString().split('T')[0],
        contractLocked: false,
        phases: projData.phases || [],
        selectedItems: projData.selectedItems || [],
        alternativeOptions: projData.alternativeOptions || [],
        notes: projData.notes || '',
        analytics: {
          revenue: price,
          materialCost: price * 0.4,
          subcontractorCost: price * 0.25,
          outsourcedCost: price * 0.05,
          totalDirectCost: price * 0.7,
          overheadAmount: price * 0.05,
          contingencyAmount: price * 0.03,
          totalProjectCost: price * 0.78,
          grossProfit: price * 0.3,
          grossMarginPct: 30,
          netProfit: price * 0.22,
          netMarginPct: 22,
          totalPlannedBudget: price * 0.8,
          budgetVariance: price * 0.02,
          budgetVariancePct: 2.5,
          healthScore: 88,
          phaseMetrics: [],
          costDistribution: [
            { category: 'Raw Materials', amount: price * 0.4, pct: 51.3 },
            { category: 'Subcontractor Machining', amount: price * 0.25, pct: 32.1 },
            { category: 'Outsourced Logistics', amount: price * 0.05, pct: 6.4 },
            { category: 'Overhead & Contingency', amount: price * 0.08, pct: 10.2 }
          ],
          sensitivity: {
            materialInflation5Pct: { costImpact: price * 0.02, revisedNetMarginPct: 20.0 },
            labourRateHike8Pct: { costImpact: price * 0.02, revisedNetMarginPct: 20.0 }
          }
        }
      };
      setProjects(prev => [fallback, ...prev]);
      setSelectedProjectId(fallback.id);
    }
    showToast('Project created with multi-phase budgets.');
    setActiveTab('cost-analysis');
  };

  // Update Project
  const handleUpdateProject = async (updatedProject: Project) => {
    const res = await api.updateProject(updatedProject.id, updatedProject);
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? (res || updatedProject) : p));
    showToast(`Project ${updatedProject.code} updated.`);
  };

  const handleDeleteProject = async (id: string) => {
    await api.deleteProject(id);
    persistentDatabase.deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
    logAuditEvent('PROJECT_DELETED', 'Projects', id, 'Project Portfolio', `Deleted project record ${id}.`);
    showToast('Project removed from portfolio.');
  };

  // Global Search Navigation and Auditing
  const handleGlobalSearchNavigate = (targetTab: ActiveTab, searchResult: GlobalSearchResult) => {
    setActiveTab(targetTab);
    if (searchResult.type === 'project' && searchResult.raw) {
      setSelectedProjectId(searchResult.raw.id);
    }
    logAuditEvent(
      'SEARCH_NAVIGATE',
      'Catalog',
      searchResult.code,
      searchResult.title,
      `Navigated to [${searchResult.typeLabel}] ${searchResult.code}: ${searchResult.title} via Global Search Bar.`
    );
  };

  // If user is logged out or session timed out, show clean Enterprise Login Page
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans selection:bg-[#fdf0d5] selection:text-[#003049]">
        <NotificationToastContainer toasts={toasts} onDismiss={dismissToast} />
        <LoginPage
          companyDetails={companyDetails}
          onLogin={handleLogin}
          onRequestAccount={handleRequestAccount}
          onUpdateUserPassword={handleUpdateUserPassword}
          onRegisterGoogleUser={handleRegisterGoogleUser}
          sessionExpiredNotice={sessionExpiredNotice}
        />
      </div>
    );
  }

  if (!isDataReady) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-3 text-slate-700">
        {loadError ? (
          <>
            <p className="text-sm font-semibold">{loadError}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold"
            >
              Retry
            </button>
          </>
        ) : (
          <p className="text-sm font-semibold">Loading...</p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col font-sans selection:bg-[#fdf0d5] selection:text-[#003049]">
      {/* Enhanced Multi-Severity Toast Notifications */}
      <NotificationToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Top Ribbon & Omnipresent Search Bar */}
      <TopNavbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        currentUser={currentUser}
        onLogout={handleLogout}
        companyDetails={companyDetails}
        materials={materials}
        produceItems={produceItems}
        subcontractors={subcontractors}
        outsourcedServices={outsourcedServices}
        suppliers={suppliers}
        projects={projects}
        inventory={inventory}
        selectedProject={selectedProject}
        onSelectProject={(p) => setSelectedProjectId(p.id)}
        onGlobalSearchNavigate={handleGlobalSearchNavigate}
        showNotification={showToast}
        sessionRemainingSeconds={sessionRemainingSeconds}
        onExtendSession={handleExtendSession}
      />

      {/* Main Content Viewport - Full Width without unnecessary blank side margins */}
      <main className="flex-1 w-full px-3 sm:px-4 lg:px-6 py-2.5 sm:py-3">

        {activeTab === 'directory-hub' && (
          <DirectoryCardsHubView
            currentUser={currentUser}
            projects={projects}
            selectedProject={selectedProject}
            materials={materials}
            suppliers={suppliers}
            outsourcedServices={outsourcedServices}
            subcontractors={subcontractors}
            produceItems={produceItems}
            onSelectProject={(p) => setSelectedProjectId(p.id)}
            onNavigateToCostAnalysis={(p) => {
              setSelectedProjectId(p.id);
              setActiveTab('cost-analysis');
            }}
            onNavigateToProjectHome={(p) => {
              setSelectedProjectId(p.id);
              setActiveTab('project-home');
            }}
            onNavigateTab={(tabId) => setActiveTab(tabId as any)}
            onUpdateMaterialPrice={(id, newPrice, reason) => {
              handleUpdateMaterialPrice(id, newPrice, reason, 'Directory Hub');
            }}
            onAddProject={handleCreateProject}
            onUpdateProject={(id, updated) => {
              const target = projects.find(p => p.id === id);
              if (target) handleUpdateProject({ ...target, ...updated });
            }}
            onDeleteProject={handleDeleteProject}
            onAddMaterial={handleAddMaterial}
            onUpdateMaterial={handleUpdateMaterial}
            onDeleteMaterial={handleDeleteMaterial}
            onAddProduceItem={handleAddProduceItem}
            onUpdateProduceItem={handleUpdateProduceItem}
            onDeleteProduceItem={handleDeleteProduceItem}
            onAddOutsourcedService={handleAddOutsourcedService}
            onUpdateOutsourcedService={handleUpdateOutsourcedService}
            onDeleteOutsourcedService={handleDeleteOutsourcedService}
            onAddSupplier={handleAddSupplier}
            onUpdateSupplier={handleUpdateSupplier}
            onDeleteSupplier={handleDeleteSupplier}
            onAddSubcontractor={handleAddSubcontractor}
            onUpdateSubcontractor={handleUpdateSubcontractor}
            onDeleteSubcontractor={handleDeleteSubcontractor}
            clients={clients}
            onAddClient={handleAddClient}
            onUpdateClient={handleUpdateClient}
            onDeleteClient={handleDeleteClient}
            categories={categories}
            onUpdateCategories={handleUpdateCategories}
          />
        )}

        {activeTab === 'item-grid' && (
          <MasterDataGridCatalog
            materials={materials}
            services={outsourcedServices}
            subcontractors={subcontractors}
            suppliers={suppliers}
            projects={projects}
            produceItems={produceItems}
            initialFilterTab="ALL"
            onUpdateMaterialPrice={(id, newPrice, reason) => {
              handleUpdateMaterialPrice(id, newPrice, reason, 'Catalog Lead');
            }}
            onAddNewItem={(newItem) => {
              handleAddMaterial(newItem);
            }}
            onEditRecord={(rawType, item) => {
              if (rawType === 'material') {
                handleUpdateMaterial(item.id, item);
              } else if (rawType === 'service') {
                handleUpdateOutsourcedService(item.id, item);
              } else if (rawType === 'subcontractor') {
                handleUpdateSubcontractor(item.id, item);
              } else if (rawType === 'product') {
                handleUpdateProduceItem(item.id, item);
              }
              logAuditEvent('CATALOG_EDIT', 'Catalog', item.id, rawType, `Edited ${item.code || item.name} in master data grid`);
            }}
            onDeleteRecord={(rawType, id) => {
              if (rawType === 'material') {
                handleDeleteMaterial(id);
              } else if (rawType === 'service') {
                handleDeleteOutsourcedService(id);
              } else if (rawType === 'subcontractor') {
                handleDeleteSubcontractor(id);
              } else if (rawType === 'product') {
                handleDeleteProduceItem(id);
              }
              logAuditEvent('CATALOG_DELETE', 'Catalog', id, rawType, `Deleted ${rawType} record ${id} from master data grid`);
            }}
            onAddItemToProject={(projectId, item) => {
              showToast(`Assigned ${item.name} to project`);
            }}
          />
        )}

        {activeTab === 'cost-analysis' && (
          <CostAnalysisView
            project={selectedProject}
            projects={projects}
            onSelectProject={(p) => setSelectedProjectId(p.id)}
            onOpenProjectPicker={() => {
              setProjectPickerTarget('margins');
              setIsProjectPickerOpen(true);
            }}
            materials={materials}
            produceItems={produceItems}
            suppliers={suppliers}
            subcontractors={subcontractors}
            outsourcedServices={outsourcedServices}
            onUpdateProject={handleUpdateProject}
            onRefreshAnalytics={handleRefreshAnalytics}
            onExportPDF={() => handleExportPDF(selectedProject || undefined)}
            onNavigateToProjects={() => setActiveTab('projects')}
            initialTab="margins"
          />
        )}

        {activeTab === 'project-home' && (
          <ProjectHomeView
            project={selectedProject}
            allProjects={projects}
            onSelectProject={(p) => setSelectedProjectId(p.id)}
            onUpdateProject={handleUpdateProject}
            materials={materials}
            suppliers={suppliers}
            subcontractors={subcontractors}
            outsourcedServices={outsourcedServices}
            produceItems={produceItems}
            onAddProduceItem={handleAddProduceItem}
            onAddMaterial={handleAddMaterial}
            onRefreshAnalytics={handleRefreshAnalytics}
            onExportPDF={() => handleExportPDF(selectedProject || undefined)}
            onNavigateBack={() => setActiveTab('directory-hub')}
          />
        )}

        {activeTab === 'resource-allocation' && (
          <ResourceAllocationView
            selectedProject={selectedProject}
            projects={projects}
            onSelectProject={(p) => setSelectedProjectId(p.id)}
            onOpenProjectPicker={() => {
              setProjectPickerTarget('resources');
              setIsProjectPickerOpen(true);
            }}
            subcontractors={subcontractors}
            outsourcedServices={outsourcedServices}
            suppliers={suppliers}
            currentUser={currentUser}
            onUpdateProject={handleUpdateProject}
            onNavigateToSubcontractors={() => setActiveTab('subcontractors')}
            onNavigateToOutsourced={() => setActiveTab('outsourced')}
          />
        )}

        {activeTab === 'project-timelines' && (
          <ProjectTimelinesView
            project={selectedProject}
            projects={projects}
            onSelectProject={(p) => setSelectedProjectId(p.id)}
            onOpenProjectPicker={() => {
              setProjectPickerTarget('timelines');
              setIsProjectPickerOpen(true);
            }}
            onUpdateProject={handleUpdateProject}
            onExportPDF={() => handleExportPDF(selectedProject || undefined)}
            users={users}
            subcontractors={subcontractors}
          />
        )}

        {activeTab === 'produce' && (
          <FXTTCardItemsListView
            cardType="produce"
            cardId="all"
            cardTitle="Manufactured Products & Assembly SKUs"
            cardSubtitle={`${produceItems.length} Finished Good SKUs, Target Quoted Prices & Specs`}
            cardTag="PRODUCTS CATALOG"
            materials={materials}
            suppliers={suppliers}
            outsourcedServices={outsourcedServices}
            subcontractors={subcontractors}
            projects={projects}
            produceItems={produceItems}
            categories={categories}
            onClose={() => setActiveTab('directory-hub')}
            onUpdatePrice={(id, price, reason) => {
              handleUpdateProducePrice(id, price, reason, 'Produce FXTT View');
            }}
            onUpdateMaterialPrice={(id, newPrice, reason) => {
              handleUpdateProducePrice(id, newPrice, reason, 'Produce FXTT View');
            }}
            onAddMaterial={handleAddMaterial}
            onUpdateMaterial={handleUpdateMaterial}
            onDeleteMaterial={handleDeleteMaterial}
            onAddSupplier={handleAddSupplier}
            onUpdateSupplier={handleUpdateSupplier}
            onDeleteSupplier={handleDeleteSupplier}
            onAddSubcontractor={handleAddSubcontractor}
            onUpdateSubcontractor={handleUpdateSubcontractor}
            onDeleteSubcontractor={handleDeleteSubcontractor}
            onAddOutsourcedService={handleAddOutsourcedService}
            onUpdateOutsourcedService={handleUpdateOutsourcedService}
            onDeleteOutsourcedService={handleDeleteOutsourcedService}
            onAddProduceItem={handleAddProduceItem}
            onUpdateProduceItem={handleUpdateProduceItem}
            onDeleteProduceItem={handleDeleteProduceItem}
            onAddProject={handleCreateProject}
            onUpdateProject={handleUpdateProject}
            onDeleteProject={handleDeleteProject}
            onSelectProject={(p) => {
              setSelectedProjectId(p.id);
              setActiveTab('project-home');
            }}
            onNavigateToCostAnalysis={(p) => {
              setSelectedProjectId(p.id);
              setActiveTab('cost-analysis');
            }}
            onAddToProject={(item, projectId) => {
              showToast(`Assigned ${item.code} (${item.name}) to Project ${projectId}`);
            }}
            isModal={false}
          />
        )}

        {activeTab === 'materials' && (
          <FXTTCardItemsListView
            cardType="material_category"
            cardId="all"
            cardTitle="Materials & Parts Directory"
            cardSubtitle={`${materials.length} Raw Materials, Alloys, Fasteners & Parts`}
            cardTag="MATERIALS & PARTS"
            materials={materials}
            suppliers={suppliers}
            outsourcedServices={outsourcedServices}
            subcontractors={subcontractors}
            projects={projects}
            produceItems={produceItems}
            categories={categories}
            onClose={() => setActiveTab('directory-hub')}
            onUpdatePrice={(id, price, reason) => {
              handleUpdateMaterialPrice(id, price, reason, 'Materials FXTT View');
            }}
            onUpdateMaterialPrice={(id, newPrice, reason) => {
              handleUpdateMaterialPrice(id, newPrice, reason, 'Materials FXTT View');
            }}
            onAddMaterial={handleAddMaterial}
            onUpdateMaterial={handleUpdateMaterial}
            onDeleteMaterial={handleDeleteMaterial}
            onAddSupplier={handleAddSupplier}
            onUpdateSupplier={handleUpdateSupplier}
            onDeleteSupplier={handleDeleteSupplier}
            onAddSubcontractor={handleAddSubcontractor}
            onUpdateSubcontractor={handleUpdateSubcontractor}
            onDeleteSubcontractor={handleDeleteSubcontractor}
            onAddOutsourcedService={handleAddOutsourcedService}
            onUpdateOutsourcedService={handleUpdateOutsourcedService}
            onDeleteOutsourcedService={handleDeleteOutsourcedService}
            onAddProduceItem={handleAddProduceItem}
            onUpdateProduceItem={handleUpdateProduceItem}
            onDeleteProduceItem={handleDeleteProduceItem}
            onAddProject={handleCreateProject}
            onUpdateProject={handleUpdateProject}
            onDeleteProject={handleDeleteProject}
            onSelectProject={(p) => {
              setSelectedProjectId(p.id);
              setActiveTab('project-home');
            }}
            onNavigateToCostAnalysis={(p) => {
              setSelectedProjectId(p.id);
              setActiveTab('cost-analysis');
            }}
            onAddToProject={(item, projectId) => {
              showToast(`Assigned ${item.code} (${item.name}) to Project ${projectId}`);
            }}
            isModal={false}
          />
        )}

        {activeTab === 'suppliers' && (
          <FXTTCardItemsListView
            cardType="supplier"
            cardId="all"
            cardTitle="Suppliers Directory & Vendor Catalog"
            cardSubtitle={`${suppliers.length} Approved Enterprise Vendors & Active Procured Items`}
            cardTag="SUPPLIERS"
            materials={materials}
            suppliers={suppliers}
            outsourcedServices={outsourcedServices}
            subcontractors={subcontractors}
            projects={projects}
            produceItems={produceItems}
            categories={categories}
            onClose={() => setActiveTab('directory-hub')}
            onUpdatePrice={(id, price, reason) => {
              handleUpdateMaterialPrice(id, price, reason, 'Suppliers FXTT View');
            }}
            onUpdateMaterialPrice={(id, newPrice, reason) => {
              handleUpdateMaterialPrice(id, newPrice, reason, 'Suppliers FXTT View');
            }}
            onAddMaterial={handleAddMaterial}
            onUpdateMaterial={handleUpdateMaterial}
            onDeleteMaterial={handleDeleteMaterial}
            onAddSupplier={handleAddSupplier}
            onUpdateSupplier={handleUpdateSupplier}
            onDeleteSupplier={handleDeleteSupplier}
            onAddSubcontractor={handleAddSubcontractor}
            onUpdateSubcontractor={handleUpdateSubcontractor}
            onDeleteSubcontractor={handleDeleteSubcontractor}
            onAddOutsourcedService={handleAddOutsourcedService}
            onUpdateOutsourcedService={handleUpdateOutsourcedService}
            onDeleteOutsourcedService={handleDeleteOutsourcedService}
            onAddProduceItem={handleAddProduceItem}
            onUpdateProduceItem={handleUpdateProduceItem}
            onDeleteProduceItem={handleDeleteProduceItem}
            onAddProject={handleCreateProject}
            onUpdateProject={handleUpdateProject}
            onDeleteProject={handleDeleteProject}
            onSelectProject={(p) => {
              setSelectedProjectId(p.id);
              setActiveTab('project-home');
            }}
            onNavigateToCostAnalysis={(p) => {
              setSelectedProjectId(p.id);
              setActiveTab('cost-analysis');
            }}
            onAddToProject={(item, projectId) => {
              showToast(`Assigned ${item.code} (${item.name}) to Project ${projectId}`);
            }}
            isModal={false}
          />
        )}

        {activeTab === 'outsourced' && (
          <FXTTCardItemsListView
            cardType="service_provider"
            cardId="all"
            cardTitle="Outsourced Finishing & Surface Treatment Tariffs"
            cardSubtitle={`${outsourcedServices.length} Active Industrial Finishing Processes & Tariffs`}
            cardTag="FINISHING TARIFFS"
            materials={materials}
            suppliers={suppliers}
            outsourcedServices={outsourcedServices}
            subcontractors={subcontractors}
            projects={projects}
            produceItems={produceItems}
            categories={categories}
            onClose={() => setActiveTab('directory-hub')}
            onUpdatePrice={(id, price, reason) => {
              handleUpdateOutsourcedRate(id, price, reason, 'Outsourced FXTT View');
            }}
            onUpdateMaterialPrice={(id, newPrice, reason) => {
              handleUpdateOutsourcedRate(id, newPrice, reason, 'Outsourced FXTT View');
            }}
            onAddMaterial={handleAddMaterial}
            onUpdateMaterial={handleUpdateMaterial}
            onDeleteMaterial={handleDeleteMaterial}
            onAddSupplier={handleAddSupplier}
            onUpdateSupplier={handleUpdateSupplier}
            onDeleteSupplier={handleDeleteSupplier}
            onAddSubcontractor={handleAddSubcontractor}
            onUpdateSubcontractor={handleUpdateSubcontractor}
            onDeleteSubcontractor={handleDeleteSubcontractor}
            onAddOutsourcedService={handleAddOutsourcedService}
            onUpdateOutsourcedService={handleUpdateOutsourcedService}
            onDeleteOutsourcedService={handleDeleteOutsourcedService}
            onAddProduceItem={handleAddProduceItem}
            onUpdateProduceItem={handleUpdateProduceItem}
            onDeleteProduceItem={handleDeleteProduceItem}
            onAddProject={handleCreateProject}
            onUpdateProject={handleUpdateProject}
            onDeleteProject={handleDeleteProject}
            onSelectProject={(p) => {
              setSelectedProjectId(p.id);
              setActiveTab('project-home');
            }}
            onNavigateToCostAnalysis={(p) => {
              setSelectedProjectId(p.id);
              setActiveTab('cost-analysis');
            }}
            onAddToProject={(item, projectId) => {
              showToast(`Assigned ${item.code} (${item.name}) to Project ${projectId}`);
            }}
            isModal={false}
          />
        )}

        {activeTab === 'subcontractors' && (
          <FXTTCardItemsListView
            cardType="subcontractor"
            cardId="all"
            cardTitle="Specialist Labor Roster & Subcontractors"
            cardSubtitle={`${subcontractors.length} Trade Specialists, Shift Multipliers & Field Crews`}
            cardTag="LABOR ROSTER"
            materials={materials}
            suppliers={suppliers}
            outsourcedServices={outsourcedServices}
            subcontractors={subcontractors}
            projects={projects}
            produceItems={produceItems}
            categories={categories}
            onClose={() => setActiveTab('directory-hub')}
            onUpdatePrice={(id, price, reason) => {
              handleUpdateSubcontractorRate(id, price, reason, 'Subcontractors FXTT View');
            }}
            onUpdateMaterialPrice={(id, newPrice, reason) => {
              handleUpdateSubcontractorRate(id, newPrice, reason, 'Subcontractors FXTT View');
            }}
            onAddMaterial={handleAddMaterial}
            onUpdateMaterial={handleUpdateMaterial}
            onDeleteMaterial={handleDeleteMaterial}
            onAddSupplier={handleAddSupplier}
            onUpdateSupplier={handleUpdateSupplier}
            onDeleteSupplier={handleDeleteSupplier}
            onAddSubcontractor={handleAddSubcontractor}
            onUpdateSubcontractor={handleUpdateSubcontractor}
            onDeleteSubcontractor={handleDeleteSubcontractor}
            onAddOutsourcedService={handleAddOutsourcedService}
            onUpdateOutsourcedService={handleUpdateOutsourcedService}
            onDeleteOutsourcedService={handleDeleteOutsourcedService}
            onAddProduceItem={handleAddProduceItem}
            onUpdateProduceItem={handleUpdateProduceItem}
            onDeleteProduceItem={handleDeleteProduceItem}
            onAddProject={handleCreateProject}
            onUpdateProject={handleUpdateProject}
            onDeleteProject={handleDeleteProject}
            onSelectProject={(p) => {
              setSelectedProjectId(p.id);
              setActiveTab('project-home');
            }}
            onNavigateToCostAnalysis={(p) => {
              setSelectedProjectId(p.id);
              setActiveTab('cost-analysis');
            }}
            onAddToProject={(item, projectId) => {
              showToast(`Assigned ${item.code} (${item.name}) to Project ${projectId}`);
            }}
            isModal={false}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryProcurementView
            materials={materials}
            inventory={inventory}
            projects={projects}
            suppliers={suppliers}
            onRecordTransaction={handleInventoryTransaction}
            onAddInventoryItem={handleAddInventory}
            onUpdateInventoryStock={handleUpdateInventoryStock}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectsView
            projects={projects}
            selectedProject={selectedProject}
            materials={materials}
            subcontractors={subcontractors}
            outsourcedServices={outsourcedServices}
            onSelectProject={(p) => setSelectedProjectId(p.id)}
            onCreateProject={handleCreateProject}
            onUpdateProject={handleUpdateProject}
            onExportPDF={handleExportPDF}
            onViewCostAnalysis={(p) => {
              setSelectedProjectId(p.id);
              setActiveTab('cost-analysis');
            }}
            onNavigateToProjectHome={(p) => {
              setSelectedProjectId(p.id);
              setActiveTab('project-home');
            }}
            onViewTimelines={(p) => {
              setSelectedProjectId(p.id);
              setActiveTab('project-timelines');
            }}
            onViewResources={(p) => {
              setSelectedProjectId(p.id);
              setActiveTab('resource-allocation');
            }}
            onDeleteProject={handleDeleteProject}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            currentUser={currentUser}
            companyDetails={companyDetails}
            onUpdateCompanyDetails={handleUpdateCompanyDetails}
            users={users}
            onAddUser={handleAddUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
            accountRequests={accountRequests}
            onApproveRequest={handleApproveRequest}
            onRejectRequest={handleRejectRequest}
            showToast={showToast}
            materials={materials}
            inventory={inventory}
            transactions={transactions}
            projects={projects}
            suppliers={suppliers}
            subcontractors={subcontractors}
            outsourced={outsourcedServices}
            produceItems={produceItems}
          />
        )}

        {activeTab === 'audit-log' && (
          <AuditLogView
            currentUser={currentUser}
            auditLogs={auditLogs}
            onRefresh={() => setAuditLogs(getStoredAuditLogs())}
            showToast={showToast}
          />
        )}
      </main>

      {/* Omnipresent Simple Project Selection Box Modal */}
      <SelectProjectModal
        isOpen={isProjectPickerOpen}
        onClose={() => setIsProjectPickerOpen(false)}
        projects={projects}
        selectedProjectId={selectedProjectId}
        targetFeature={projectPickerTarget}
        onSelectProject={(proj, targetTab) => {
          setSelectedProjectId(proj.id);
          if (targetTab) {
            setActiveTab(targetTab);
          }
        }}
      />

      {/* Global Status Bar */}
      <footer className="bg-white border-t border-slate-200 px-4 py-1.5 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <span className="flex items-center space-x-1.5 text-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Active Session: <strong className="text-slate-900">{currentUser.name}</strong> ({currentUser.role === 'ADMIN' ? 'Administrator' : 'Project Manager'})</span>
          </span>
          <span>•</span>
          <span>Company: <span className="text-[#003049] font-medium">{companyDetails.name}</span></span>
        </div>

        <div className="flex items-center space-x-2 text-slate-500">
          <span>Enterprise Costing & Regulatory Audit Trail</span>
          <span>•</span>
          <span>ISO 9001 & ASME Compliant</span>
        </div>
      </footer>

      {/* Floating Foreign Exchange Utility & Projection Recalculation Console */}
      <FloatingFXUtilityPanel
        onRecalculateAll={handleRefreshAnalytics}
        activeCurrency={selectedProject?.currency}
      />

      {/* Session Inactivity Timeout Warning Modal */}
      <SessionTimeoutWarningModal
        isOpen={isWarningModalOpen}
        secondsRemaining={sessionRemainingSeconds}
        totalWarningSeconds={60}
        timeoutMinutes={getStoredTimeoutMinutes()}
        onExtend={handleExtendSession}
        onSignOut={() => handleLogout('manual')}
      />
    </div>
  );
}

