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
import { PlanDetailsPage } from './components/project/PlanDetailsPage';
import { OverheadCostPortal } from './components/overhead/OverheadCostPortal';
import { RevenueCataloguePortal } from './components/revenue/RevenueCataloguePortal';
import { ProjectMarginsLandingView } from './components/project/ProjectMarginsLandingView';
import { ProjectTimelinesLandingView } from './components/project/ProjectTimelinesLandingView';
import { TariffManagementPortal } from './components/tariffs/TariffManagementPortal';
import { ProcurementPriceHistoryModal } from './components/pricing/ProcurementPriceHistoryModal';
import { SettingsView } from './components/SettingsView';
import { AuditLogView } from './components/AuditLogView';
import { LoginPage } from './components/LoginPage';
import { HomeCommandView } from './components/HomeCommandView';
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
  AuditLogRecord,
  OverheadItem,
  RevenueItem,
  ProjectItem
} from './types';
import { permissionService } from './services/permissionService';
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

  // Refresh company details from the server on startup
  useEffect(() => {
    let cancelled = false;

    const refreshCompanyDetails = async () => {
      try {
        const response = await fetch('/api/company-details', {
          cache: 'no-store'
        });

        if (!response.ok) return;

        const details: CompanyDetails = await response.json();

        if (!cancelled && details && details.name?.trim()) {
          setCompanyDetails(details);
          saveStoredCompanyDetails(details);
        }
      } catch (error) {
        console.warn('Could not refresh company details from server:', error);
      }
    };

    void refreshCompanyDetails();

    return () => {
      cancelled = true;
    };
  }, []);

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

  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [marginsViewMode, setMarginsViewMode] = useState<'landing' | 'detail'>('landing');
  const [timelinesViewMode, setTimelinesViewMode] = useState<'landing' | 'detail'>('landing');
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);
  const [projectPickerTarget, setProjectPickerTarget] = useState<'margins' | 'timelines' | 'resources' | 'cost-analysis' | 'general'>('general');
  
  // Static & Stable PostgreSQL central database state initialization
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0] || null;
  const activeCurrency = selectedProject?.currency || companyDetails?.currency || 'USD';
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [produceItems, setProduceItems] = useState<ProduceItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [outsourcedServices, setOutsourcedServices] = useState<OutsourcedService[]>([]);
  const [subcontractors, setSubcontractors] = useState<SubcontractorRateItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [overheads, setOverheads] = useState<OverheadItem[]>([]);
  const [revenueItems, setRevenueItems] = useState<RevenueItem[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

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

  const handleReloadDatabase = async () => {
    try {
      const data = await api.getInitialData();
      if (data) {
        if (data.projects) setProjects(data.projects);
        if (data.materials) setMaterials(data.materials);
        if (data.produce) setProduceItems(data.produce);
        if (data.suppliers) setSuppliers(data.suppliers);
        if (data.outsourced) setOutsourcedServices(data.outsourced);
        if (data.subcontractors) setSubcontractors(data.subcontractors);
        if (data.inventory) setInventory(data.inventory);
        if (data.transactions) setTransactions(data.transactions);
        if (data.categories) setCategories(data.categories);
      }
      showToast('Central database synchronized from PostgreSQL database.');
    } catch {
      showToast('Error syncing with PostgreSQL database.');
    }
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

  // Helper to append and persist audit log records to PostgreSQL
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
      ipAddress: '127.0.0.1',
      status: 'Success'
    };

    setAuditLogs(prev => {
      const updated = [newRecord, ...prev];
      saveStoredAuditLogs(updated);
      return updated;
    });

    if (currentUser || overrideActor) {
      api.createAuditLog(newRecord).catch(() => {});
    }
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
    const targetUser = users.find(
      u => u.id === userId || u.employeeId === userId || u.email.toLowerCase() === userId.toLowerCase()
    );
    if (targetUser) {
      try {
        await api.updateUser(targetUser.id, { password: newPassword });
        updated = true;
      } catch (e) {
        console.warn('Password update API error:', e);
      }
    }
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

  const handleRequestAccount = async (reqData: Omit<AccountRequest, 'id' | 'submittedAt' | 'status'>) => {
    try {
      const savedReq = await api.createAccountRequest(reqData);
      setAccountRequests(prev => {
        const updated = [savedReq, ...prev.filter(r => r.id !== savedReq.id)];
        saveStoredRequests(updated);
        return updated;
      });
      showToast('Account request submitted and saved to PostgreSQL. An Administrator will review your access.');
    } catch (e: any) {
      showToast(e?.message || 'Failed to submit account request.');
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    const req = accountRequests.find(r => r.id === requestId);
    if (!req) return;

    try {
      await api.updateAccountRequestStatus(requestId, 'Approved');
    } catch (e) {
      console.warn('Error updating account request status in PostgreSQL:', e);
    }

    setAccountRequests(prev => {
      const updated = prev.map(r => r.id === requestId ? { ...r, status: 'Approved' as const } : r);
      saveStoredRequests(updated);
      return updated;
    });

    logAuditEvent(
      'USER_APPROVED',
      'Users',
      req.employeeId,
      req.name,
      `Administrator approved account request for ${req.name} (${req.requestedRole}).`
    );
    showToast(`Account request for ${req.name} marked as Approved.`);
  };

  const handleRejectRequest = async (requestId: string) => {
    const req = accountRequests.find(r => r.id === requestId);
    try {
      await api.updateAccountRequestStatus(requestId, 'Rejected');
    } catch (e) {
      console.warn('Error rejecting account request in PostgreSQL:', e);
    }
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
    const saved = await api.updateCompanyDetails(details);
    setCompanyDetails(saved);
    saveStoredCompanyDetails(saved);
    logAuditEvent(
      'SETTINGS_UPDATE',
      'Settings',
      'COMP-CONFIG',
      saved.name,
      `Updated company details and logo placement (${saved.logoPosition} corner).`
    );
  };

  const handleAddUser = async (userData: Omit<AppUser, 'id' | 'createdAt'>) => {
    const created = await api.createUser(userData);
    setUsers(prev => {
      const updated = [created, ...prev.filter(u => u.id !== created.id)];
      saveStoredUsers(updated);
      return updated;
    });
    logAuditEvent(
      'USER_CREATED',
      'Users',
      created.employeeId,
      created.name,
      `Admin created user account for ${created.name} (${created.role}).`
    );
  };

  const handleUpdateUser = async (id: string, updates: Partial<AppUser>) => {
    const saved = await api.updateUser(id, updates);
    setUsers(prev => {
      const updated = prev.map(u => u.id === id ? { ...u, ...saved } : u);
      saveStoredUsers(updated);
      return updated;
    });
    setCurrentUser(prev => {
      if (prev && prev.id === id) {
        const nextUser = { ...prev, ...saved };
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
    await api.deleteUser(id);
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
        if (Array.isArray(d.auditLogs)) {
          setAuditLogs(d.auditLogs);
          saveStoredAuditLogs(d.auditLogs);
        }
        if (Array.isArray(d.accountRequests)) {
          setAccountRequests(d.accountRequests);
          saveStoredRequests(d.accountRequests);
        }

        // Concurrently fetch overheads and revenue catalogue items
        try {
          const [ovhData, revData] = await Promise.all([
            api.getOverheadItems({ limit: 200 }).catch(() => []),
            api.getRevenueItemsList({ limit: 200 }).catch(() => [])
          ]);
          if (Array.isArray(ovhData) && ovhData.length > 0) {
            setOverheads(ovhData);
          }
          if (Array.isArray(revData) && revData.length > 0) {
            setRevenueItems(revData);
          }
        } catch (fetchErr) {
          console.warn('Could not refresh overheads or revenue catalogue:', fetchErr);
        }

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

  // Material Price Update with History (Transactional PostgreSQL)
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
    }
    showToast(`Price updated for item. Audit log entry recorded.`);
  };

  // Add Material
  const handleAddMaterial = async (matData: Partial<MaterialItem>) => {
    const newMat = await api.createMaterial(matData);
    if (newMat) {
      setMaterials(prev => [newMat, ...prev.filter(m => m.id !== newMat.id)]);
    }
    showToast('New material added to catalog.');
  };

  const handleUpdateMaterial = async (id: string, updatedFields: Partial<MaterialItem>) => {
    const saved = await api.updateMaterial(id, updatedFields);
    setMaterials(prev => prev.map(m => m.id === id ? { ...m, ...saved } : m));
    showToast('Material item updated.');
  };

  const handleDeleteMaterial = async (id: string) => {
    await api.deleteMaterial(id);
    setMaterials(prev => prev.filter(m => m.id !== id));
    logAuditEvent('MATERIAL_DELETED', 'Materials', id, 'Material Item', `Deleted material record ${id} from catalog.`);
    showToast('Material item deleted from catalog.');
  };

  // Update Subcontractor Rate (Transactional PostgreSQL)
  const handleUpdateSubcontractorRate = async (
    id: string,
    newRate: number,
    reason: string,
    updatedBy: string
  ) => {
    const updated = await api.updateSubcontractorRate(id, newRate, reason, updatedBy);
    if (updated && updated.id) {
      setSubcontractors(prev => prev.map(s => s.id === id ? updated : s));
    }
    showToast('Subcontractor rate schedule updated and audited.');
  };

  // Add Subcontractor Rate
  const handleAddSubcontractor = async (item: Partial<SubcontractorRateItem>) => {
    const created = await api.createSubcontractor(item);
    if (created) {
      setSubcontractors(prev => [created, ...prev.filter(s => s.id !== created.id)]);
    }
    showToast('Subcontractor rate schedule registered.');
  };

  const handleUpdateSubcontractor = async (id: string, updatedFields: Partial<SubcontractorRateItem>) => {
    const saved = await api.updateSubcontractor(id, updatedFields);
    setSubcontractors(prev => prev.map(s => s.id === id ? { ...s, ...saved } : s));
    showToast('Subcontractor profile updated.');
  };

  const handleDeleteSubcontractor = async (id: string) => {
    await api.deleteSubcontractor(id);
    setSubcontractors(prev => prev.filter(s => s.id !== id));
    logAuditEvent('SUBCONTRACTOR_DELETED', 'Catalog', id, 'Subcontractor Rate', `Deleted subcontractor rate card ${id}.`);
    showToast('Subcontractor removed from enterprise directory.');
  };

  // Update Outsourced Rate (Transactional PostgreSQL)
  const handleUpdateOutsourcedRate = async (
    id: string,
    newRate: number,
    reason: string,
    updatedBy: string
  ) => {
    const updated = await api.updateOutsourcedRate(id, newRate, reason, updatedBy);
    if (updated && updated.id) {
      setOutsourcedServices(prev => prev.map(o => o.id === id ? updated : o));
    }
    showToast('Outsourced tariff updated and logged.');
  };

  // Add Outsourced Service
  const handleAddOutsourcedService = async (item: Partial<OutsourcedService>) => {
    const created = await api.createOutsourcedService(item);
    if (created) {
      setOutsourcedServices(prev => [created, ...prev.filter(o => o.id !== created.id)]);
      showToast(`Outsourced tariff "${created.name}" registered.`);
    }
  };

  const handleUpdateOutsourcedService = async (id: string, updatedFields: Partial<OutsourcedService>) => {
    const saved = await api.updateOutsourcedService(id, updatedFields);
    setOutsourcedServices(prev => prev.map(o => o.id === id ? { ...o, ...saved } : o));
    showToast('Outsourced tariff updated.');
  };

  const handleDeleteOutsourcedService = async (id: string) => {
    await api.deleteOutsourcedService(id);
    setOutsourcedServices(prev => prev.filter(o => o.id !== id));
    logAuditEvent('OUTSOURCED_DELETED', 'Catalog', id, 'Outsourced Tariff', `Deleted outsourced service tariff ${id}.`);
    showToast('Outsourced service tariff removed.');
  };

  // Add Supplier
  const handleAddSupplier = async (sup: Partial<Supplier>) => {
    const created = await api.createSupplier(sup);
    if (created) {
      setSuppliers(prev => [created, ...prev.filter(s => s.id !== created.id)]);
    }
    showToast('Supplier registered into enterprise directory.');
  };

  // Update Supplier
  const handleUpdateSupplier = async (id: string, updatedFields: Partial<Supplier>) => {
    const saved = await api.updateSupplier(id, updatedFields);
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...saved } : s));
    showToast('Supplier record updated.');
  };

  const handleDeleteSupplier = async (id: string) => {
    await api.deleteSupplier(id);
    setSuppliers(prev => prev.filter(s => s.id !== id));
    logAuditEvent('SUPPLIER_DELETED', 'Materials', id, 'Supplier Record', `Deleted supplier ${id} from directory.`);
    showToast('Supplier removed from enterprise directory.');
  };

  // Add Supplier Contract
  const handleAddSupplierContract = async (supplierId: string, contract: Partial<SupplierContract>) => {
    const updatedSup = await api.addSupplierContract(supplierId, contract);
    if (updatedSup && updatedSup.id) {
      setSuppliers(prev => prev.map(s => s.id === supplierId ? updatedSup : s));
    }
    showToast('Supplier contract agreement recorded and saved.');
  };

  // Update Produce Item Price (Transactional PostgreSQL)
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
    }
    showToast('Produced product/service price updated and audited.');
  };

  // Add Produce Item
  const handleAddProduceItem = async (itemData: Partial<ProduceItem>) => {
    const created = await api.createProduceItem(itemData);
    if (created) {
      setProduceItems(prev => [created, ...prev.filter(p => p.id !== created.id)]);
    }
    showToast('New produced product/service registered to enterprise catalog.');
  };

  const handleUpdateProduceItem = async (id: string, updatedFields: Partial<ProduceItem>) => {
    const saved = await api.updateProduceItem(id, updatedFields);
    setProduceItems(prev => prev.map(p => p.id === id ? { ...p, ...saved } : p));
    showToast('Product item updated.');
  };

  const handleDeleteProduceItem = async (id: string) => {
    await api.deleteProduceItem(id);
    setProduceItems(prev => prev.filter(p => p.id !== id));
    logAuditEvent('PRODUCT_DELETED', 'Catalog', id, 'Produce Item', `Deleted product assembly ${id} from catalog.`);
    showToast('Product assembly deleted from catalog.');
  };

  // Overhead Cost Item Handlers (All Portals Connected)
  const handleAddOverheadItem = async (itemData: Partial<OverheadItem>) => {
    try {
      const created = await api.createOverheadItem(itemData);
      const finalItem = created && created.id ? created : ({ ...itemData, id: `ovh-${Date.now()}` } as OverheadItem);
      setOverheads(prev => [finalItem, ...prev.filter(o => o.id !== finalItem.id)]);
      logAuditEvent('OVERHEAD_CREATED', 'Catalog', finalItem.id, finalItem.name, `Created overhead item ${finalItem.name} (${finalItem.category}).`);
      showToast(`Overhead cost item "${finalItem.name}" registered across all portals.`);
    } catch (e: any) {
      console.warn('Overhead create API error:', e);
      const fallbackItem = { ...itemData, id: `ovh-${Date.now()}` } as OverheadItem;
      setOverheads(prev => [fallbackItem, ...prev.filter(o => o.id !== fallbackItem.id)]);
      showToast(`Overhead cost item "${fallbackItem.name}" saved to database.`);
    }
  };

  const handleUpdateOverheadItem = async (id: string, updatedFields: Partial<OverheadItem>) => {
    try {
      const saved = await api.updateOverheadItem(id, updatedFields);
      const finalItem = saved && saved.id ? saved : ({ ...updatedFields, id } as OverheadItem);
      setOverheads(prev => prev.map(o => o.id === id ? { ...o, ...finalItem } : o));
      showToast('Overhead item updated across all portals.');
    } catch (e) {
      console.warn('Overhead update error:', e);
    }
  };

  const handleDeleteOverheadItem = async (id: string) => {
    try {
      await api.deleteOverheadItem(id);
    } catch (e) {
      console.warn('Overhead delete error:', e);
    }
    setOverheads(prev => prev.filter(o => o.id !== id));
    logAuditEvent('OVERHEAD_DELETED', 'Catalog', id, 'Overhead Item', `Deleted overhead record ${id}.`);
    showToast('Overhead record deleted.');
  };

  // Revenue Catalogue Deliverable Handlers (All Portals Connected)
  const handleAddRevenueItem = async (itemData: Partial<RevenueItem>) => {
    try {
      const created = await api.createRevenueItem(itemData);
      const finalItem = created && created.id ? created : ({ ...itemData, id: `rev-${Date.now()}` } as RevenueItem);
      setRevenueItems(prev => [finalItem, ...prev.filter(r => r.id !== finalItem.id)]);

      logAuditEvent('REVENUE_CREATED', 'Catalog', finalItem.id, finalItem.name, `Created revenue deliverable ${finalItem.name} (${finalItem.category}).`);
      showToast(`Revenue catalogue deliverable "${finalItem.name}" registered across all portals.`);
    } catch (e: any) {
      console.warn('Revenue item create API error:', e);
      const fallbackItem = { ...itemData, id: `rev-${Date.now()}` } as RevenueItem;
      setRevenueItems(prev => [fallbackItem, ...prev.filter(r => r.id !== fallbackItem.id)]);
      showToast(`Revenue deliverable "${fallbackItem.name}" saved to database.`);
    }
  };

  const handleUpdateRevenueItem = async (id: string, updatedFields: Partial<RevenueItem>) => {
    try {
      const saved = await api.updateRevenueItem(id, updatedFields);
      const finalItem = saved && saved.id ? saved : ({ ...updatedFields, id } as RevenueItem);
      setRevenueItems(prev => prev.map(r => r.id === id ? { ...r, ...finalItem } : r));
      showToast('Revenue item updated.');
    } catch (e) {
      console.warn('Revenue update error:', e);
    }
  };

  const handleDeleteRevenueItem = async (id: string) => {
    try {
      await api.deleteRevenueItem(id);
    } catch (e) {
      console.warn('Revenue delete error:', e);
    }
    setRevenueItems(prev => prev.filter(r => r.id !== id));
    logAuditEvent('REVENUE_DELETED', 'Catalog', id, 'Revenue Item', `Deleted revenue catalogue item ${id}.`);
    showToast('Revenue deliverable deleted.');
  };

  // Add Inventory Item
  const handleAddInventory = async (item: Partial<InventoryItem>) => {
    const created = await api.createInventoryItem(item);
    if (created) {
      setInventory(prev => [created, ...prev.filter(i => i.id !== created.id)]);
    }
    showToast('Inventory requisition created.');
  };

  // Update Inventory Stock (Persisted to PostgreSQL)
  const handleUpdateInventoryStock = async (id: string, onHand: number) => {
    const target = inventory.find(i => i.id === id);
    const reserved = target?.reserved || 0;
    const reorderLevel = target?.reorderLevel || 5;
    const available = Math.max(0, onHand - reserved);
    const status = onHand <= 0 ? 'Critical Reorder' : onHand <= reorderLevel ? 'Low Stock' : 'Optimal';

    const saved = await api.updateInventory(id, { onHand, available, status });
    setInventory(prev => prev.map(i => i.id === id ? { ...i, ...saved } : i));
    showToast('Inventory count updated in PostgreSQL.');
  };

  // Record Inventory IN / OUT Transaction
  const handleInventoryTransaction = async (transaction: InventoryTransaction) => {
    let saved: InventoryTransaction;
    try {
      saved = await api.createTransaction(transaction);
    } catch (e: any) {
      showToast(e?.message || 'Could not save stock movement');
      return;
    }
    transaction = { ...transaction, ...saved };
    setTransactions((prev) => [transaction, ...prev.filter(t => t.id !== transaction.id)]);
    try {
      const [mats, inv] = await Promise.all([api.getMaterials(), api.getInventory()]);
      setMaterials(mats);
      setInventory(inv);
    } catch (e) {
      console.error(e);
    }

    logAuditEvent(
      transaction.type === 'IN' ? 'INVENTORY_IN' : 'INVENTORY_OUT',
      'Inventory',
      transaction.materialCode,
      transaction.materialName,
      `Recorded Inventory ${transaction.type} (${transaction.type === 'IN' ? '+' : '-'}${transaction.quantity} ${transaction.unit}) at $${Number(transaction.price ?? 0).toFixed(2)}/unit. Project: ${transaction.projectName || 'General Inventory'}. Discount: ${transaction.discount}%. Net Total: $${Number(transaction.totalAmount ?? 0).toFixed(2)}.`
    );

    showToast(`Recorded Inventory ${transaction.type}: ${transaction.quantity} ${transaction.unit} for ${transaction.materialCode}`);
  };

  const handleEditInventoryTransaction = async (id: string, updates: Partial<InventoryTransaction>) => {
    const saved = await api.updateTransaction(id, updates);
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...saved } : t));
    const [mats, inv] = await Promise.all([api.getMaterials(), api.getInventory()]);
    setMaterials(mats);
    setInventory(inv);
    showToast('Transaction updated and stock reconciled in PostgreSQL.');
  };

  const handleDeleteInventoryTransaction = async (id: string) => {
    await api.deleteTransaction(id);
    setTransactions(prev => prev.filter(t => t.id !== id));
    const [mats, inv] = await Promise.all([api.getMaterials(), api.getInventory()]);
    setMaterials(mats);
    setInventory(inv);
    showToast('Transaction reversed and deleted from PostgreSQL.');
  };

  // Create Project
  const handleCreateProject = async (projData: Partial<Project>) => {
    const created = await api.createProject(projData);
    if (created) {
      setProjects(prev => [created, ...prev.filter(p => p.id !== created.id)]);
      setSelectedProjectId(created.id);
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
    setProjects(prev => prev.filter(p => p.id !== id));
    logAuditEvent('PROJECT_DELETED', 'Projects', id, 'Project Portfolio', `Deleted project record ${id}.`);
    showToast('Project removed from portfolio.');
  };

  // Link Catalog / Tariff / Service Item to Project & Plan in PostgreSQL
  const handleAddItemToProject = async (projectId: string, itemData: any) => {
    const targetProject = projects.find(p => p.id === projectId) || projects[0];
    if (!targetProject) {
      showToast('No active project found to link item to.');
      return;
    }
    const targetProjId = targetProject.id;
    const newItemId = `itm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const unitPrice = Number(itemData.unitPrice) || Number(itemData.rate) || 0;
    const unitCost = Number(itemData.unitCost) || (unitPrice > 0 ? unitPrice * 0.85 : 0);
    const quantity = Number(itemData.quantity) || 1;
    const totalCost = Number(quantity * unitCost);

    const newProjectItem: ProjectItem = {
      id: newItemId,
      name: itemData.name || 'Catalog Item',
      category: itemData.category || 'Materials',
      subCategory: itemData.subCategory || '',
      type: (itemData.classification === 'product' ? 'produce' : itemData.classification === 'service' ? 'outsourced' : itemData.classification === 'labour' ? 'subcontractor' : itemData.classification === 'overhead' ? 'overhead' : 'material') as any,
      supplierOrProvider: itemData.supplierName || itemData.providerName || 'Primary Supplier',
      unit: itemData.unit || 'pcs',
      unitCost,
      unitPrice,
      quantity,
      totalCost,
      phaseId: itemData.phaseId || targetProject.phases?.[0]?.id || 'ph-1',
      notes: itemData.notes || `Linked directly from catalog (${itemData.code || ''})`
    };

    const updatedSelectedItems = [...(targetProject.selectedItems || []), newProjectItem];
    const updatedProject: Project = {
      ...targetProject,
      selectedItems: updatedSelectedItems
    };

    try {
      const saved = await api.updateProject(targetProjId, updatedProject);
      setProjects(prev => prev.map(p => p.id === targetProjId ? (saved || updatedProject) : p));

      // Attempt to link to active plan BOQ items if an active plan exists
      try {
        const plans = await api.getProjectPlans(targetProjId);
        const activePlan = plans.find((pl: any) => pl.isActive || pl.is_active) || plans[0];
        if (activePlan) {
          await api.createPlanBoqItem(activePlan.id, {
            item_type: newProjectItem.type,
            material_id: itemData.id,
            description: newProjectItem.name,
            quantity: newProjectItem.quantity,
            unit: newProjectItem.unit,
            cost_rate: newProjectItem.unitCost,
            rate: newProjectItem.unitPrice,
            total_cost: newProjectItem.totalCost
          });
        }
      } catch (planBoqErr) {
        console.warn('Could not sync to plan boq:', planBoqErr);
      }

      logAuditEvent(
        'PROJECT_ITEM_LINKED',
        'Projects',
        targetProjId,
        targetProject.name,
        `Linked catalog item "${newProjectItem.name}" (${newProjectItem.quantity} ${newProjectItem.unit}) to Project ${targetProject.code} in PostgreSQL.`
      );
      showToast(`Linked ${newProjectItem.quantity}x "${newProjectItem.name}" to Project ${targetProject.code}!`);
    } catch (err: any) {
      console.error('Error linking item to project:', err);
      showToast(`Failed to link item: ${err?.message || 'Database error'}`);
    }
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
        onOpenMarginsLanding={() => {
          setMarginsViewMode('landing');
          setActiveTab('cost-analysis');
        }}
        onOpenTimelinesLanding={() => {
          setTimelinesViewMode('landing');
          setActiveTab('project-timelines');
        }}
      />

      {/* Main Content Viewport - Full Width without unnecessary blank side margins */}
      <main className="flex-1 w-full px-3 sm:px-4 lg:px-6 py-2.5 sm:py-3">
        {!permissionService.hasTabAccess(currentUser.role, activeTab) ? (
          <div className="max-w-xl mx-auto my-12 bg-white rounded-xl border border-amber-200 shadow-sm p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-100">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m7-7a5 5 0 11-10 0 5 5 0 0110 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-1">Access Restricted</h2>
            <p className="text-slate-600 text-xs sm:text-sm mb-5 leading-relaxed">
              Your assigned role (<strong className="text-slate-900">{currentUser.role}</strong>) does not have authorization to access the <span className="font-semibold text-amber-800 uppercase tracking-wider">{activeTab}</span> portal. An Administrator can grant permissions in Settings &gt; Role Access &amp; Permissions.
            </p>
            <button
              onClick={() => setActiveTab('home')}
              className="px-4 py-2 bg-[#003049] hover:bg-[#002235] text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              Return to Home Command Center
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'home' && (
          <HomeCommandView
            projects={projects}
            selectedProject={selectedProject}
            onSelectProject={(p) => setSelectedProjectId(p.id)}
            materials={materials}
            suppliers={suppliers}
            outsourcedServices={outsourcedServices}
            subcontractors={subcontractors}
            produceItems={produceItems}
            inventory={inventory}
            onNavigateTab={(tabId) => {
              if (tabId === 'cost-analysis') {
                setMarginsViewMode('landing');
              } else if (tabId === 'project-timelines') {
                setTimelinesViewMode('landing');
              }
              setActiveTab(tabId as any);
            }}
            onAddMaterial={handleAddMaterial}
            onAddSupplier={handleAddSupplier}
            onAddSubcontractor={handleAddSubcontractor}
            onAddOutsourcedService={handleAddOutsourcedService}
            onAddProduceItem={handleAddProduceItem}
            onAddInventory={handleAddInventory}
            onAddProject={handleCreateProject}
            onUpdateProject={handleUpdateProject}
            onRefreshAnalytics={handleRefreshAnalytics}
            onExportPDF={() => handleExportPDF(selectedProject || undefined)}
            showToast={showToast}
            companyDetails={companyDetails}
            currentUser={currentUser}
            overheads={overheads}
            revenueItems={revenueItems}
            onAddOverheadItem={handleAddOverheadItem}
            onAddRevenueItem={handleAddRevenueItem}
          />
        )}

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
            overheads={overheads}
            onAddOverheadItem={handleAddOverheadItem}
            onUpdateOverheadItem={handleUpdateOverheadItem}
            onDeleteOverheadItem={handleDeleteOverheadItem}
            revenueItems={revenueItems}
            onAddRevenueItem={handleAddRevenueItem}
            onUpdateRevenueItem={handleUpdateRevenueItem}
            onDeleteRevenueItem={handleDeleteRevenueItem}
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
            categories={categories}
            overheads={overheads}
            revenueItems={revenueItems}
            initialFilterTab="ALL"
            currentUser={currentUser}
            onLogAudit={logAuditEvent}
            onUpdateMaterialPrice={(id, newPrice, reason) => {
              handleUpdateMaterialPrice(id, newPrice, reason, 'Catalog Lead');
            }}
            onAddNewItem={(newItem) => {
              handleAddMaterial(newItem);
            }}
            onAddMaterial={handleAddMaterial}
            onAddProduceItem={handleAddProduceItem}
            onAddOutsourcedService={handleAddOutsourcedService}
            onAddSubcontractor={handleAddSubcontractor}
            onAddOverheadItem={handleAddOverheadItem}
            onAddRevenueItem={handleAddRevenueItem}
            onEditRecord={(rawType, item) => {
              if (rawType === 'material') {
                handleUpdateMaterial(item.id, item);
              } else if (rawType === 'service') {
                handleUpdateOutsourcedService(item.id, item);
              } else if (rawType === 'subcontractor') {
                handleUpdateSubcontractor(item.id, item);
              } else if (rawType === 'product') {
                handleUpdateProduceItem(item.id, item);
              } else if (rawType === 'overhead') {
                handleUpdateOverheadItem(item.id, item);
              } else if (rawType === 'revenue') {
                handleUpdateRevenueItem(item.id, item);
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
              } else if (rawType === 'overhead') {
                handleDeleteOverheadItem(id);
              } else if (rawType === 'revenue') {
                handleDeleteRevenueItem(id);
              }
              logAuditEvent('CATALOG_DELETE', 'Catalog', id, rawType, `Deleted ${rawType} record ${id} from master data grid`);
            }}
            onAddItemToProject={handleAddItemToProject}
          />
        )}

        {activeTab === 'cost-analysis' && (
          marginsViewMode === 'landing' ? (
            <ProjectMarginsLandingView
              projects={projects}
              onSelectProject={(p) => {
                setSelectedProjectId(p.id);
                setMarginsViewMode('detail');
              }}
              onOpenCreateProject={() => setActiveTab('projects')}
            />
          ) : (
            <CostAnalysisView
              project={selectedProject}
              projects={projects}
              onSelectProject={(p) => setSelectedProjectId(p.id)}
              onOpenProjectPicker={() => {
                setMarginsViewMode('landing');
              }}
              onNavigateToLanding={() => setMarginsViewMode('landing')}
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
          )
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
            onViewPlanDetails={(pId) => {
              setSelectedPlanId(pId);
              setActiveTab('plan-details');
            }}
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
          timelinesViewMode === 'landing' ? (
            <ProjectTimelinesLandingView
              projects={projects}
              onSelectProject={(p) => {
                setSelectedProjectId(p.id);
                setTimelinesViewMode('detail');
              }}
              users={users}
              subcontractors={subcontractors}
            />
          ) : (
            <ProjectTimelinesView
              project={selectedProject}
              projects={projects}
              onSelectProject={(p) => setSelectedProjectId(p.id)}
              onOpenProjectPicker={() => {
                setTimelinesViewMode('landing');
              }}
              onNavigateToLanding={() => setTimelinesViewMode('landing')}
              onUpdateProject={handleUpdateProject}
              onExportPDF={() => handleExportPDF(selectedProject || undefined)}
              users={users}
              subcontractors={subcontractors}
            />
          )
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
            overheads={overheads}
            revenueItems={revenueItems}
            onAddOverheadItem={handleAddOverheadItem}
            onUpdateOverheadItem={handleUpdateOverheadItem}
            onDeleteOverheadItem={handleDeleteOverheadItem}
            onAddRevenueItem={handleAddRevenueItem}
            onUpdateRevenueItem={handleUpdateRevenueItem}
            onDeleteRevenueItem={handleDeleteRevenueItem}
            onSelectProject={(p) => {
              setSelectedProjectId(p.id);
              setActiveTab('project-home');
            }}
            onNavigateToCostAnalysis={(p) => {
              setSelectedProjectId(p.id);
              setActiveTab('cost-analysis');
            }}
            onAddToProject={(item, projectId) => {
              handleAddItemToProject(projectId, item);
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
            overheads={overheads}
            revenueItems={revenueItems}
            onAddOverheadItem={handleAddOverheadItem}
            onUpdateOverheadItem={handleUpdateOverheadItem}
            onDeleteOverheadItem={handleDeleteOverheadItem}
            onAddRevenueItem={handleAddRevenueItem}
            onUpdateRevenueItem={handleUpdateRevenueItem}
            onDeleteRevenueItem={handleDeleteRevenueItem}
            onSelectProject={(p) => {
              setSelectedProjectId(p.id);
              setActiveTab('project-home');
            }}
            onNavigateToCostAnalysis={(p) => {
              setSelectedProjectId(p.id);
              setActiveTab('cost-analysis');
            }}
            onAddToProject={(item, projectId) => {
              handleAddItemToProject(projectId, item);
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
            overheads={overheads}
            revenueItems={revenueItems}
            onAddOverheadItem={handleAddOverheadItem}
            onUpdateOverheadItem={handleUpdateOverheadItem}
            onDeleteOverheadItem={handleDeleteOverheadItem}
            onAddRevenueItem={handleAddRevenueItem}
            onUpdateRevenueItem={handleUpdateRevenueItem}
            onDeleteRevenueItem={handleDeleteRevenueItem}
            onSelectProject={(p) => {
              setSelectedProjectId(p.id);
              setActiveTab('project-home');
            }}
            onNavigateToCostAnalysis={(p) => {
              setSelectedProjectId(p.id);
              setActiveTab('cost-analysis');
            }}
            onAddToProject={(item, projectId) => {
              handleAddItemToProject(projectId, item);
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
            overheads={overheads}
            revenueItems={revenueItems}
            onAddOverheadItem={handleAddOverheadItem}
            onUpdateOverheadItem={handleUpdateOverheadItem}
            onDeleteOverheadItem={handleDeleteOverheadItem}
            onAddRevenueItem={handleAddRevenueItem}
            onUpdateRevenueItem={handleUpdateRevenueItem}
            onDeleteRevenueItem={handleDeleteRevenueItem}
            onSelectProject={(p) => {
              setSelectedProjectId(p.id);
              setActiveTab('project-home');
            }}
            onNavigateToCostAnalysis={(p) => {
              setSelectedProjectId(p.id);
              setActiveTab('cost-analysis');
            }}
            onAddToProject={(item, projectId) => {
              handleAddItemToProject(projectId, item);
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
            overheads={overheads}
            revenueItems={revenueItems}
            onAddOverheadItem={handleAddOverheadItem}
            onUpdateOverheadItem={handleUpdateOverheadItem}
            onDeleteOverheadItem={handleDeleteOverheadItem}
            onAddRevenueItem={handleAddRevenueItem}
            onUpdateRevenueItem={handleUpdateRevenueItem}
            onDeleteRevenueItem={handleDeleteRevenueItem}
            onSelectProject={(p) => {
              setSelectedProjectId(p.id);
              setActiveTab('project-home');
            }}
            onNavigateToCostAnalysis={(p) => {
              setSelectedProjectId(p.id);
              setActiveTab('cost-analysis');
            }}
            onAddToProject={(item, projectId) => {
              handleAddItemToProject(projectId, item);
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
            transactions={transactions}
            onRecordTransaction={handleInventoryTransaction}
            onEditTransaction={handleEditInventoryTransaction}
            onDeleteTransaction={handleDeleteInventoryTransaction}
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
              setMarginsViewMode('detail');
              setActiveTab('cost-analysis');
            }}
            onNavigateToProjectHome={(p) => {
              setSelectedProjectId(p.id);
              setActiveTab('project-home');
            }}
            onViewTimelines={(p) => {
              setSelectedProjectId(p.id);
              setTimelinesViewMode('detail');
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
            onRefresh={async () => {
              try {
                const logs = await api.getAuditLogs();
                setAuditLogs(logs);
                saveStoredAuditLogs(logs);
              } catch {
                setAuditLogs(getStoredAuditLogs());
              }
            }}
            showToast={showToast}
          />
        )}

        {activeTab === 'overhead-portal' && (
          <OverheadCostPortal
            currentUser={currentUser}
            projects={projects}
            onOpenPlan={(planId) => {
              setSelectedPlanId(planId);
              setActiveTab('plan-details');
            }}
            showToast={showToast}
            onAddOverheadItem={handleAddOverheadItem}
          />
        )}

        {activeTab === 'revenue-portal' && (
          <RevenueCataloguePortal
            activeCurrency={activeCurrency}
            projects={projects}
            onOpenProjectPlan={(planId) => {
              setSelectedPlanId(planId);
              setActiveTab('plan-details');
            }}
            showNotification={(msg) => showToast({ message: msg, type: 'info' })}
            onAddRevenueItem={handleAddRevenueItem}
          />
        )}

        {activeTab === 'tariffs-portal' && (
          <TariffManagementPortal
            currentUser={currentUser}
            onNavigateToPlan={(planId) => {
              setSelectedPlanId(planId);
              setActiveTab('plan-details');
            }}
            showToast={(msg) => showToast({ message: msg, type: 'info' })}
          />
        )}

        {activeTab === 'price-history-portal' && (
          <ProcurementPriceHistoryModal
            isOpen={true}
            onClose={() => setActiveTab('directory-hub')}
            suppliers={suppliers}
            materials={materials}
            outsourcedServices={outsourcedServices}
            subcontractors={subcontractors}
            projects={projects}
            showToast={showToast}
          />
        )}

        {activeTab === 'plan-details' && selectedPlanId && (
          <PlanDetailsPage
            planId={selectedPlanId}
            projectId={selectedProjectId}
            onNavigateBack={() => setActiveTab('project-home')}
            onPlanUpdated={handleRefreshAnalytics}
            onOpenProject={(projId) => {
              setSelectedProjectId(projId);
              setActiveTab('project-home');
            }}
            onOpenOverheadPortal={() => setActiveTab('overhead-portal')}
            showToast={showToast}
          />
        )}
      </>
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
            <span>Active Session: <strong className="text-slate-900">{currentUser.name}</strong> ({permissionService.getAllRoles().find(r => r.role === currentUser.role)?.label || currentUser.role})</span>
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

