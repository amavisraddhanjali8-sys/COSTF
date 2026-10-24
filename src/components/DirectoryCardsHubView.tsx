import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Search,
  PlusCircle,
  FolderTree,
  Briefcase,
  Layers,
  Box,
  Truck,
  Building2,
  Users,
  ShieldCheck,
  ChevronRight,
  Filter,
  CheckCircle2,
  Palette,
  X,
  ExternalLink,
  ArrowLeft,
  Table,
  Plus,
  LayoutGrid,
  ListFilter,
  FolderPlus,
  FilePlus,
  DollarSign,
  Cpu,
  TrendingUp,
  PackageCheck,
  HardHat,
  SlidersHorizontal,
  ChevronDown,
  Wrench,
  Check,
  Clock,
  Award,
  Edit,
  History,
  Zap,
  Radio,
  Landmark,
  ShieldAlert,
  Scale,
  Percent,
  Trash2,
  Upload,
  Package,
  Eye,
  Sliders
} from 'lucide-react';
import { round2 } from '../utils/decimalMath';
import { ModernTileCard } from './ModernTileCard';
import { ColorGradientPicker } from './ColorGradientPicker';
import { FXTTCardItemsListView } from './FXTTCardItemsListView';
import { DataImportExportModal } from './DataImportExportModal';
import { ImportEntityType } from '../utils/excelImport';
import { ProcurementPriceHistoryModal } from './pricing/ProcurementPriceHistoryModal';
import { CreateEditOverheadItemModal } from './overhead/CreateEditOverheadItemModal';
import { FXTTPriceAuditLogFullScreenModal, FXTTPriceAuditEntry } from './FXTTPriceAuditLogFullScreenModal';
import { TILE_GRADIENT_PRESETS, getThemeById, getRandomThemeIndex } from '../data/tileThemes';
import {
  INITIAL_CLIENT_PROFILES,
  INITIAL_CATEGORY_HIERARCHY,
  CategoryNode,
  ClientProfile
} from '../data/categoriesAndProfiles';
import { api } from '../services/api';
import { formatCurrency } from '../utils/currency';
import {
  Project,
  MaterialItem,
  Supplier,
  OutsourcedService,
  SubcontractorRateItem,
  ProduceItem,
  Competitor,
  AppUser,
  EnterpriseResource
} from '../types';
import { ProductCompetitorPriceMatrixModal } from './pricing/ProductCompetitorPriceMatrixModal';
import {
  CreateCategoryModal,
  CreateSubCategoryModal,
  AddItemModal,
  EditItemModal,
  DeleteConfirmModal
} from './DirectoryCRUDModals';
import {
  CreateEditResourceModal,
  DeleteResourceConfirmModal,
  ResourceDetailsModal,
  ResourcePriceChangeModal,
  ResourcePriceHistoryModal
} from './DirectoryResourceModals';
import { ResourcePriceRangesAndChangesModal } from './pricing/ResourcePriceRangesAndChangesModal';
import { bizStore } from '../services/bizStore';

export type DirectoryTab =
  | 'projects'
  | 'materials-hierarchy'
  | 'resources'
  | 'service-categories'
  | 'revenue-streams'
  | 'overheads-hierarchy'
  | 'products-hierarchy'
  | 'services-hierarchy'
  | 'clients'
  | 'suppliers'
  | 'service-providers'
  | 'subcontractors'
  | 'competitors';

export type RevenueStreamSubTab = 'all_records' | 'products' | 'services' | 'hierarchy';
export type ServiceCategorySubTab = 'subcontractor' | 'outsourced';

interface DirectoryCardsHubViewProps {
  projects: Project[];
  selectedProject: Project | null;
  materials: MaterialItem[];
  suppliers: Supplier[];
  outsourcedServices: OutsourcedService[];
  subcontractors: SubcontractorRateItem[];
  produceItems?: ProduceItem[];
  clients?: ClientProfile[];
  initialTab?: DirectoryTab;
  onSelectProject: (p: Project) => void;
  onNavigateToCostAnalysis: (p: Project) => void;
  onNavigateToProjectHome?: (p: Project) => void;
  onNavigateTab: (tabId: string) => void;
  onUpdateMaterialPrice?: (id: string, newPrice: number, reason: string) => void;
  onAddProject?: (p: Partial<Project>) => void;
  onUpdateProject?: (id: string, p: Partial<Project>) => void;
  onDeleteProject?: (id: string) => void;
  onAddMaterial?: (m: Partial<MaterialItem>) => void;
  onUpdateMaterial?: (id: string, m: Partial<MaterialItem>) => void;
  onDeleteMaterial?: (id: string) => void;
  onAddProduceItem?: (p: Partial<ProduceItem>) => void;
  onUpdateProduceItem?: (id: string, p: Partial<ProduceItem>) => void;
  onDeleteProduceItem?: (id: string) => void;
  onAddOutsourcedService?: (s: Partial<OutsourcedService>) => void;
  onUpdateOutsourcedService?: (id: string, s: Partial<OutsourcedService>) => void;
  onDeleteOutsourcedService?: (id: string) => void;
  onAddSupplier?: (s: Partial<Supplier>) => void;
  onUpdateSupplier?: (id: string, s: Partial<Supplier>) => void;
  onDeleteSupplier?: (id: string) => void;
  onAddSubcontractor?: (s: Partial<SubcontractorRateItem>) => void;
  onUpdateSubcontractor?: (id: string, s: Partial<SubcontractorRateItem>) => void;
  onDeleteSubcontractor?: (id: string) => void;
  overheads?: any[];
  onAddOverheadItem?: (item: any) => void;
  onUpdateOverheadItem?: (id: string, item: any) => void;
  onDeleteOverheadItem?: (id: string) => void;
  revenueItems?: any[];
  onAddRevenueItem?: (item: any) => void;
  onUpdateRevenueItem?: (id: string, item: any) => void;
  onDeleteRevenueItem?: (id: string) => void;
  onAddClient?: (c: Partial<ClientProfile>) => void;
  onUpdateClient?: (id: string, c: Partial<ClientProfile>) => void;
  onDeleteClient?: (id: string) => void;
  categories?: CategoryNode[];
  onUpdateCategories?: (cats: CategoryNode[]) => void;
  currentUser?: AppUser | null;
  competitors?: Competitor[];
  onAddCompetitor?: (c: Partial<Competitor>) => void;
  onUpdateCompetitor?: (id: string, c: Partial<Competitor>) => void;
  onDeleteCompetitor?: (id: string) => void;
}

export const DirectoryCardsHubView: React.FC<DirectoryCardsHubViewProps> = ({
  projects,
  selectedProject,
  materials,
  suppliers,
  outsourcedServices,
  subcontractors,
  produceItems = [],
  clients: clientsProp,
  categories: categoriesProp,
  onUpdateCategories,
  initialTab,
  onSelectProject,
  onNavigateToCostAnalysis,
  onNavigateToProjectHome,
  onNavigateTab,
  onUpdateMaterialPrice,
  onAddProject,
  onUpdateProject,
  onDeleteProject,
  onAddMaterial,
  onUpdateMaterial,
  onDeleteMaterial,
  onAddProduceItem,
  onUpdateProduceItem,
  onDeleteProduceItem,
  onAddOutsourcedService,
  onUpdateOutsourcedService,
  onDeleteOutsourcedService,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  onAddSubcontractor,
  onUpdateSubcontractor,
  onDeleteSubcontractor,
  onAddClient,
  onUpdateClient,
  onDeleteClient,
  overheads: overheadsProp,
  onAddOverheadItem,
  onUpdateOverheadItem,
  onDeleteOverheadItem,
  revenueItems: revenueItemsProp,
  onAddRevenueItem,
  onUpdateRevenueItem,
  onDeleteRevenueItem,
  currentUser,
  competitors: competitorsProp,
  onAddCompetitor,
  onUpdateCompetitor,
  onDeleteCompetitor
}) => {
  const [activeTab, setActiveTab] = useState<DirectoryTab>(initialTab || 'projects');
  const [revenueSubTab, setRevenueSubTab] = useState<RevenueStreamSubTab>('all_records');
  const [serviceSubTab, setServiceSubTab] = useState<ServiceCategorySubTab>('subcontractor');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Subcontractor & Outsourced view & drilldown states
  const [selectedSubcontractorCatId, setSelectedSubcontractorCatId] = useState<string | null>(null);
  const [selectedSubcontractorSubCatId, setSelectedSubcontractorSubCatId] = useState<string | null>(null);
  const [selectedOutsourcedCatId, setSelectedOutsourcedCatId] = useState<string | null>(null);
  const [selectedOutsourcedSubCatId, setSelectedOutsourcedSubCatId] = useState<string | null>(null);
  const [subcontractorViewMode, setSubcontractorViewMode] = useState<'hierarchy' | 'fxtt_grid' | 'items_table'>('hierarchy');
  const [outsourcedViewMode, setOutsourcedViewMode] = useState<'hierarchy' | 'fxtt_grid' | 'items_table'>('hierarchy');
  const [productViewMode, setProductViewMode] = useState<'hierarchy' | 'fxtt_grid' | 'items_table'>('hierarchy');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');
  const [isCommandsMenuOpen, setIsCommandsMenuOpen] = useState(false);

  // Overhead Cost view & drilldown states
  const [selectedOverheadCatId, setSelectedOverheadCatId] = useState<string | null>(null);
  const [selectedOverheadSubCatId, setSelectedOverheadSubCatId] = useState<string | null>(null);
  const [overheadViewMode, setOverheadViewMode] = useState<'hierarchy' | 'items_table'>('hierarchy');
  const [overheadItems, setOverheadItems] = useState<any[]>(overheadsProp || []);
  const [revenueItems, setRevenueItems] = useState<any[]>(revenueItemsProp || []);

  // Synchronize when props update
  useEffect(() => {
    if (overheadsProp && overheadsProp.length > 0) {
      setOverheadItems(overheadsProp);
    }
  }, [overheadsProp]);

  useEffect(() => {
    if (revenueItemsProp && revenueItemsProp.length > 0) {
      setRevenueItems(revenueItemsProp);
    }
  }, [revenueItemsProp]);

  // Load overhead & revenue items from database APIs to keep Directory strictly connected
  useEffect(() => {
    api.getOverheadItems({ limit: 100 })
      .then((res) => {
        const list = Array.isArray(res) ? res : (res as any)?.data || [];
        if (list.length > 0) setOverheadItems(list);
      })
      .catch((err) => console.warn('Could not load overhead items in directory:', err));

    Promise.all([
      api.getRevenueItems({ limit: 100 }).catch(() => []),
      api.getRevenueServices().catch(() => [])
    ]).then(([itemsRes, servicesRes]) => {
      const itemsList = Array.isArray(itemsRes) ? itemsRes : (itemsRes as any)?.data || [];
      const servicesList = Array.isArray(servicesRes) ? servicesRes : (servicesRes as any)?.data || [];
      const mergedMap = new Map<string, any>();
      itemsList.forEach((it: any) => mergedMap.set((it.code || it.id).toLowerCase(), it));
      servicesList.forEach((srv: any) => {
        const key = (srv.code || srv.id).toLowerCase();
        if (!mergedMap.has(key)) {
          mergedMap.set(key, { ...srv, type: 'service' });
        }
      });
      const combined = Array.from(mergedMap.values());
      if (combined.length > 0) setRevenueItems(combined);
    }).catch((err) => console.warn('Could not load revenue items & services in directory:', err));
  }, []);

  // Enterprise Resources State (Labour, Machinery, Equipment, Tools, Subcontractors, Materials)
  const [enterpriseResources, setEnterpriseResources] = useState<EnterpriseResource[]>([]);
  const [selectedResourceCategory, setSelectedResourceCategory] = useState<string | null>(null);
  const [selectedResourceSubCategory, setSelectedResourceSubCategory] = useState<string | null>(null);
  const [resourceViewMode, setResourceViewMode] = useState<'cards' | 'table'>('cards');
  const [isCreateResourceModalOpen, setIsCreateResourceModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<EnterpriseResource | null>(null);
  const [viewingResource, setViewingResource] = useState<EnterpriseResource | null>(null);
  const [priceChangeResource, setPriceChangeResource] = useState<EnterpriseResource | null>(null);
  const [priceHistoryResource, setPriceHistoryResource] = useState<EnterpriseResource | null>(null);
  const [deletingResource, setDeletingResource] = useState<EnterpriseResource | null>(null);
  const [rangesAndChangesResource, setRangesAndChangesResource] = useState<EnterpriseResource | null>(null);
  const [rangesAndChangesInitialTab, setRangesAndChangesInitialTab] = useState<'ranges' | 'changes' | 'details'>('ranges');

  const handleOpenRangesAndChanges = (res: EnterpriseResource, tab: 'ranges' | 'changes' | 'details' = 'ranges') => {
    setRangesAndChangesInitialTab(tab);
    setRangesAndChangesResource(res);
  };

  const handleOpenItemMatrix = (res: EnterpriseResource) => {
    setActiveCompetitorMatrixItem({
      item: {
        id: res.id,
        code: res.code,
        name: res.name,
        category: res.category,
        unit: res.unit,
        ourPrice: Number(res.baseRate) || 0,
        ourCost: Number(res.operationalCharge) || 0,
        currency: res.currency || globalCurrency || 'LKR',
        type: 'service'
      },
      itemType: 'resource' as any
    });
  };

  const handleDuplicateResource = async (res: EnterpriseResource) => {
    try {
      const copy: Partial<EnterpriseResource> = {
        name: `${res.name} (Copy)`,
        type: res.type,
        category: res.category,
        subCategory: res.subCategory,
        moreSubCategory: res.moreSubCategory,
        unit: res.unit,
        baseRate: res.baseRate,
        operationalCharge: res.operationalCharge,
        chargeType: res.chargeType,
        currency: res.currency || 'LKR',
        supplierId: res.supplierId,
        supplierName: res.supplierName,
        competitorCompany: res.competitorCompany,
        competitorRate: res.competitorRate,
        industryBenchmarkRate: res.industryBenchmarkRate,
        leadTimeDays: res.leadTimeDays,
        status: 'Available',
        skillOrSla: res.skillOrSla,
        notes: res.notes,
        priceRanges: res.priceRanges || []
      };
      const created = await api.createResource(copy);
      handleResourceSaved(created);
      showToast(`Resource duplicated as "${created.name}"`);
    } catch (err: any) {
      showToast(`Failed to duplicate resource: ${err?.message}`);
    }
  };

  useEffect(() => {
    api.getResources()
      .then((res) => {
        if (Array.isArray(res)) setEnterpriseResources(res);
      })
      .catch((err) => console.warn('Could not load enterprise resources in Directory Hub:', err));
  }, []);

  const handleResourceSaved = (saved: EnterpriseResource) => {
    setEnterpriseResources((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        return copy;
      }
      return [saved, ...prev];
    });
  };

  const handleResourceDeleted = (id: string) => {
    setEnterpriseResources((prev) => prev.filter((r) => r.id !== id));
  };

  const handleResourcePriceUpdated = (updated: EnterpriseResource) => {
    setEnterpriseResources((prev) => {
      const idx = prev.findIndex((r) => r.id === updated.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      }
      return prev;
    });
  };

  const resourceCategoriesData = useMemo(() => {
    const types: Array<{
      id: string;
      type: string;
      title: string;
      icon: React.ReactNode;
      unit: string;
    }> = [
      { id: 'cat-labour', type: 'labour', title: 'Labour', icon: <Users className="w-5 h-5" />, unit: 'hr' },
      { id: 'cat-machinery', type: 'machinery', title: 'Machinery', icon: <Cpu className="w-5 h-5" />, unit: 'hr' },
      { id: 'cat-equipment', type: 'equipment', title: 'Equipment', icon: <Zap className="w-5 h-5" />, unit: 'day' },
      { id: 'cat-tools', type: 'tool', title: 'Tools', icon: <Wrench className="w-5 h-5" />, unit: 'day' },
      { id: 'cat-subcontractors', type: 'subcontractor', title: 'Subcontractors', icon: <HardHat className="w-5 h-5" />, unit: 'sqft' },
      { id: 'cat-materials', type: 'material', title: 'Materials', icon: <Box className="w-5 h-5" />, unit: 'unit' }
    ];

    return types.map((t) => {
      const items = enterpriseResources.filter((r) => r.type === t.type);
      const avgRate = items.length > 0
        ? Math.round(items.reduce((sum, r) => sum + (Number(r.baseRate) || 0), 0) / items.length)
        : 0;
      return {
        ...t,
        count: items.length,
        avgRate
      };
    });
  }, [enterpriseResources]);

  const availableResourceSubCategories = useMemo(() => {
    const subs = new Set<string>();
    enterpriseResources.forEach((r) => {
      if (selectedResourceCategory && r.type !== selectedResourceCategory) return;
      if (r.subCategory && r.subCategory.trim()) {
        subs.add(r.subCategory.trim());
      }
    });
    return Array.from(subs).sort();
  }, [enterpriseResources, selectedResourceCategory]);

  const filteredCategoryResources = useMemo(() => {
    let list = enterpriseResources;
    if (selectedResourceCategory) {
      list = list.filter((r) => r.type === selectedResourceCategory);
    }
    if (selectedResourceSubCategory) {
      list = list.filter((r) => r.subCategory === selectedResourceSubCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.name?.toLowerCase().includes(q) ||
          r.code?.toLowerCase().includes(q) ||
          r.category?.toLowerCase().includes(q) ||
          (r.subCategory && r.subCategory.toLowerCase().includes(q)) ||
          r.supplierName?.toLowerCase().includes(q) ||
          r.type?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [enterpriseResources, selectedResourceCategory, selectedResourceSubCategory, searchQuery]);

  // Competitor Intelligence & Market Benchmark Directory States
  const [competitorsList, setCompetitorsList] = useState<Competitor[]>(competitorsProp || []);
  const [competitorFilterTier, setCompetitorFilterTier] = useState<string>('all');
  const [isCompetitorModalOpen, setIsCompetitorModalOpen] = useState(false);
  const [editingCompetitor, setEditingCompetitor] = useState<Competitor | null>(null);
  const [competitorForm, setCompetitorForm] = useState({
    name: '',
    code: '',
    country: 'United States',
    marketTier: 'Primary Competitor',
    contactPerson: '',
    email: '',
    website: '',
    notes: ''
  });
  const [activeCompetitorMatrixItem, setActiveCompetitorMatrixItem] = useState<{
    item: {
      id: string;
      code: string;
      name: string;
      category?: string;
      unit?: string;
      ourPrice: number;
      ourCost?: number;
      currency?: string;
      type?: 'product' | 'service';
    };
    itemType?: 'product' | 'service' | 'produce' | 'revenue_item' | 'resource' | 'overhead' | 'material';
  } | null>(null);

  // Sync competitors when prop changes
  useEffect(() => {
    if (competitorsProp && competitorsProp.length > 0) {
      setCompetitorsList(competitorsProp);
    }
  }, [competitorsProp]);

  // Load competitors directly from PostgreSQL database
  useEffect(() => {
    api.getCompetitors()
      .then((comps) => {
        if (Array.isArray(comps) && comps.length > 0) {
          setCompetitorsList(comps);
        }
      })
      .catch((err) => console.warn('Could not load competitors from PostgreSQL:', err));
  }, []);

  // Dedicated states for Revenue Portal all-records view
  const [revenueTableTypeFilter, setRevenueTableTypeFilter] = useState<'all' | 'product' | 'service'>('all');
  const [revenueTableCategoryFilter, setRevenueTableCategoryFilter] = useState<string>('all');

  // Combined Authoritative List of All Revenue Portal Records (Products & Services)
  const combinedAllRevenueRecords = useMemo(() => {
    const map = new Map<string, any>();
    const seenNames = new Set<string>();

    // 1. All revenue items from database
    revenueItems.forEach((r) => {
      const baseCodeKey = (r.code || r.id || '').replace(/-\d{3}$/, '').trim().toLowerCase();
      const nameKey = (r.name || '').trim().toLowerCase();
      if (!map.has(baseCodeKey) && !seenNames.has(nameKey)) {
        map.set(baseCodeKey, {
          id: r.id,
          code: r.code || `REV-${r.id.slice(0, 5)}`,
          name: r.name,
          type: (r.type || 'product') as 'product' | 'service',
          category: r.category || 'Commercial Deliverables',
          subCategory: r.subCategory || 'General Scope',
          unit: r.unit || 'pcs',
          costPrice: Number(r.costPrice) || 0,
          retailPrice: Number(r.defaultRate) || 0,
          taxTreatment: r.taxTreatment || 'Standard (0%)',
          status: r.status || 'Active',
          source: 'Revenue Catalogue'
        });
        seenNames.add(nameKey);
      }
    });

    // 2. Also ensure produceItems are represented without duplicating base codes or names
    produceItems.forEach((p) => {
      const baseCodeKey = (p.code || p.id || '').replace(/-\d{3}$/, '').trim().toLowerCase();
      const nameKey = (p.name || '').trim().toLowerCase();
      if (!map.has(baseCodeKey) && !seenNames.has(nameKey)) {
        map.set(baseCodeKey, {
          id: p.id,
          code: p.code || `PRD-${p.id.slice(0, 5)}`,
          name: p.name,
          type: 'product' as const,
          category: p.category || 'Manufactured Deliverables',
          subCategory: p.subCategory || 'General Product',
          unit: p.unit || 'pcs',
          costPrice: Number(p.costPrice) || 0,
          retailPrice: Number(p.retailPrice) || 0,
          taxTreatment: 'Standard (0%)',
          status: p.status || 'Active',
          source: 'Manufactured Product'
        });
        seenNames.add(nameKey);
      }
    });

    return Array.from(map.values());
  }, [revenueItems, produceItems]);

  // Dedicated states for Outsourced Services sub-portal
  const [outsourcedTableCategoryFilter, setOutsourcedTableCategoryFilter] = useState<string>('all');
  const [expandedOutsourcedHistoryIds, setExpandedOutsourcedHistoryIds] = useState<Set<string>>(new Set());
  const [expandedOutsourcedRangesIds, setExpandedOutsourcedRangesIds] = useState<Set<string>>(new Set());
  const [activeOutsourcedRateItem, setActiveOutsourcedRateItem] = useState<OutsourcedService | null>(null);
  const [activeOutsourcedAuditItem, setActiveOutsourcedAuditItem] = useState<OutsourcedService | null>(null);
  const [activeOutsourcedRangesItem, setActiveOutsourcedRangesItem] = useState<OutsourcedService | null>(null);

  const toggleOutsourcedHistory = (id: string) => {
    setExpandedOutsourcedHistoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleOutsourcedRanges = (id: string) => {
    setExpandedOutsourcedRangesIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Synchronize tabs if initialTab changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Synchronize revenue stream sub-tab if legacy tabs are requested
  useEffect(() => {
    if (activeTab === 'services-hierarchy') {
      setRevenueSubTab('services');
    } else if (activeTab === 'products-hierarchy') {
      setRevenueSubTab('products');
    }
  }, [activeTab]);

  // Reactive state for categories hierarchy & client profiles
  const [categories, setCategories] = useState<CategoryNode[]>(() => {
    if (categoriesProp && categoriesProp.length > 0) return categoriesProp;
    return INITIAL_CATEGORY_HIERARCHY;
  });
  const [clientProfiles, setClientProfiles] = useState<ClientProfile[]>(() => {
    if (clientsProp && clientsProp.length > 0) return clientsProp;
    return [];
  });

  // Synchronize when parent prop updates
  useEffect(() => {
    if (categoriesProp && categoriesProp.length > 0) {
      setCategories(categoriesProp);
    }
  }, [categoriesProp]);

  useEffect(() => {
    if (clientsProp) {
      setClientProfiles(clientsProp);
    }
  }, [clientsProp]);

  // Load clients and custom tiles from backend API on initial mount
  useEffect(() => {
    if (!clientsProp || clientsProp.length === 0) {
      api.getClients().then((res) => {
        if (res && res.length > 0) setClientProfiles(res);
      }).catch((e) => console.warn('Could not load clients from API:', e));
    }
    api.getCustomTiles().then((tiles) => {
      if (Array.isArray(tiles)) setCustomTiles(tiles);
    }).catch((e) => console.warn('Could not load custom tiles from API:', e));
  }, []);

  // Time-aware greeting for user
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Dynamic theme overrides so user can change colors of any tile on the fly (persisted to localStorage)
  const [themeOverrides, setThemeOverrides] = useState<Record<string, { themeId: string; customGradient?: string }>>(() => {
    try {
      const saved = bizStore.getItem('fxtt_tile_theme_overrides');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      'proj-01': { themeId: 'airbus-cobalt' },
      'proj-02': { themeId: 'pacific-sky' },
      'mat-cat-01': { themeId: 'pacific-sky' },
      'mat-cat-02': { themeId: 'napa-purple' },
      'client-01': { themeId: 'airbus-cobalt' },
      'client-02': { themeId: 'midnight-space' },
      'sup-01': { themeId: 'pacific-sky' },
      'sup-02': { themeId: 'sunset-amber' },
      'sub-01': { themeId: 'polymer-slate' },
      'serv-cat-01': { themeId: 'sunset-amber' }
    };
  });

  // Hierarchy drill-down states for 3-tier browsing
  const [selectedMaterialCatId, setSelectedMaterialCatId] = useState<string | null>(null);
  const [selectedMaterialSubCatId, setSelectedMaterialSubCatId] = useState<string | null>(null);

  const [selectedProductCatId, setSelectedProductCatId] = useState<string | null>(null);
  const [selectedProductSubCatId, setSelectedProductSubCatId] = useState<string | null>(null);

  const [selectedServiceCatId, setSelectedServiceCatId] = useState<string | null>(null);
  const [selectedServiceSubCatId, setSelectedServiceSubCatId] = useState<string | null>(null);

  // Modal: Create New Tile / Card (Generic)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createType, setCreateType] = useState<
    'project' | 'material-category' | 'product-category' | 'service-category' | 'client' | 'supplier' | 'service-provider' | 'subcontractor'
  >('project');
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardTag, setNewCardTag] = useState('PROJECT');
  const [newCardBrief, setNewCardBrief] = useState('');
  const [newCardAction, setNewCardAction] = useState('READ NOW');
  const [newCardThemeId, setNewCardThemeId] = useState('pacific-sky');
  const [newCardCustomGradient, setNewCardCustomGradient] = useState<string | undefined>();

  // DEDICATED CRUD MODALS STATE
  const [isCreateCategoryModalOpen, setIsCreateCategoryModalOpen] = useState(false);
  const [createCategoryGroup, setCreateCategoryGroup] = useState<'material' | 'product' | 'service'>('material');

  const [isCreateSubCategoryModalOpen, setIsCreateSubCategoryModalOpen] = useState(false);
  const [createSubCategoryGroup, setCreateSubCategoryGroup] = useState<'material' | 'product' | 'service'>('material');

  // Dedicated Bulk Import Modal State (Master dataset or Subcategory-wise)
  const [bulkImportConfig, setBulkImportConfig] = useState<{
    isOpen: boolean;
    targetType: ImportEntityType;
    categoryScope?: string;
    subCategoryScope?: string;
  } | null>(null);
  const [createSubCategoryParentId, setCreateSubCategoryParentId] = useState<string | undefined>();

  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [addItemPortal, setAddItemPortal] = useState<string>('materials-hierarchy');
  const [addItemCategoryId, setAddItemCategoryId] = useState<string | undefined>(undefined);
  const [addItemSubCategoryId, setAddItemSubCategoryId] = useState<string | undefined>(undefined);

  const [editModalData, setEditModalData] = useState<{
    isOpen: boolean;
    itemType: string;
    id: string;
    initialData: Record<string, any>;
  } | null>(null);

  const [deleteModalData, setDeleteModalData] = useState<{
    isOpen: boolean;
    title: string;
    entityType: string;
    onConfirm: () => void;
  } | null>(null);

  // Custom User-Created Tiles State (persisted to central database)
  const [customTiles, setCustomTiles] = useState<
    Array<{
      id: string;
      group: DirectoryTab;
      tag: string;
      title: string;
      brief: string;
      action: string;
      themeId: string;
      customGradient?: string;
    }>
  >([]);

  // Overhead Edit, Delete & FXTT Price Audit Log State
  const [editingOverheadItem, setEditingOverheadItem] = useState<any | null>(null);
  const [isEditOverheadModalOpen, setIsEditOverheadModalOpen] = useState(false);
  const [fxttOverheadModalOpen, setFxttOverheadModalOpen] = useState(false);
  const [fxttOverheadItem, setFxttOverheadItem] = useState<any | null>(null);
  const [fxttOverheadHistory, setFxttOverheadHistory] = useState<FXTTPriceAuditEntry[]>([]);
  const [loadingOverheadHistory, setLoadingOverheadHistory] = useState(false);

  // Open FXTT modal loaded with overhead's real audit logs from PostgreSQL
  const handleOpenOverheadFXTT = async (item: any) => {
    setLoadingOverheadHistory(true);
    setFxttOverheadItem({
      id: item.id,
      code: item.code,
      name: item.name,
      rate: Number(item.defaultRate) || 0,
      unit: item.unitType === 'pct' ? '%' : (item.unitType || 'unit'),
      category: item.category || 'Operating Overheads',
      classification: 'overhead',
      stockOrScope: `Method: ${item.defaultCalculationMethod || 'percentage_of_direct'} • Base: ${item.defaultCostBase || 'total_direct_cost'}`,
      itemClassification: 'overhead'
    });
    setFxttOverheadModalOpen(true);

    try {
      // 1. Fetch audit records from backend API
      const auditRes = await api.getOverheadAuditLogs({ limit: 100 });
      const logs = Array.isArray(auditRes) ? auditRes : (auditRes as any)?.data || [];
      const itemLogs = logs.filter((l: any) => l.overheadItemId === item.id || l.id === item.id);

      if (itemLogs.length > 0) {
        const mappedEntries: FXTTPriceAuditEntry[] = itemLogs.map((l: any, idx: number) => {
          const prev = Number(l.previousState?.defaultRate ?? l.previousRate ?? item.defaultRate);
          const curr = Number(l.newState?.defaultRate ?? l.newRate ?? item.defaultRate);
          const changePct = prev > 0 ? Number((((curr - prev) / prev) * 100).toFixed(1)) : 0;
          return {
            id: l.id || `ovh-audit-${idx}`,
            date: l.timestamp ? new Date(l.timestamp).toISOString().split('T')[0] : (item.effectiveDate || new Date().toISOString().split('T')[0]),
            previousRate: prev,
            newRate: curr,
            changePct,
            reason: l.action ? `${l.action.toUpperCase()} - Overhead rate revision` : 'Overhead schedule rate update',
            approvedBy: l.changedBy || 'Financial Controller',
            vendorOrContractor: 'Internal Organization Overhead',
            status: 'Approved',
            skuCode: item.code,
            itemName: item.name,
            unit: item.unitType || 'pct',
            notes: l.details || `Base: ${item.defaultCostBase || 'total_direct_cost'} • Method: ${item.defaultCalculationMethod || 'percentage_of_direct'}`
          };
        });
        setFxttOverheadHistory(mappedEntries);
      } else if (Array.isArray(item.priceHistory) && item.priceHistory.length > 0) {
        setFxttOverheadHistory(item.priceHistory.map((ph: any, idx: number) => ({
          id: ph.id || `ovh-hist-${idx}`,
          date: ph.date || new Date().toISOString().split('T')[0],
          previousRate: Number(ph.previousRate || ph.previousPrice || item.defaultRate),
          newRate: Number(ph.newRate || ph.newPrice || item.defaultRate),
          changePct: Number(ph.changePct || 0),
          reason: ph.reason || 'Overhead rate update',
          approvedBy: ph.updatedBy || ph.approvedBy || 'Financial Controller',
          skuCode: item.code,
          itemName: item.name,
          unit: item.unitType || 'pct'
        })));
      } else {
        // Baseline entry
        setFxttOverheadHistory([
          {
            id: `ovh-baseline-${item.id}`,
            date: item.effectiveDate || new Date().toISOString().split('T')[0],
            previousRate: Number(item.defaultRate) || 0,
            newRate: Number(item.defaultRate) || 0,
            changePct: 0,
            reason: 'Baseline overhead onboarding rate in PostgreSQL database',
            approvedBy: item.createdBy || 'Financial Controller',
            vendorOrContractor: 'Internal Organization Overhead',
            status: 'Active',
            skuCode: item.code,
            itemName: item.name,
            unit: item.unitType || 'pct',
            notes: `Calculation method: ${item.defaultCalculationMethod || 'percentage_of_direct'} on base ${item.defaultCostBase || 'total_direct_cost'}`
          }
        ]);
      }
    } catch (err) {
      console.warn('Failed to fetch overhead audit logs for FXTT table:', err);
      setFxttOverheadHistory([
        {
          id: `ovh-fallback-${item.id}`,
          date: item.effectiveDate || new Date().toISOString().split('T')[0],
          previousRate: Number(item.defaultRate) || 0,
          newRate: Number(item.defaultRate) || 0,
          changePct: 0,
          reason: 'Active overhead rate recorded in PostgreSQL',
          approvedBy: 'Financial Controller',
          skuCode: item.code,
          itemName: item.name,
          unit: item.unitType || 'pct'
        }
      ]);
    } finally {
      setLoadingOverheadHistory(false);
    }
  };

  // Delete overhead item handler
  const handleDeleteOverheadItemDirect = async (item: any) => {
    if (!window.confirm(`Are you sure you want to delete overhead item "${item.name}" (${item.code})? This will permanently remove it from the PostgreSQL database.`)) {
      return;
    }
    try {
      if (onDeleteOverheadItem) onDeleteOverheadItem(item.id);
      await api.deleteOverheadItem(item.id);
      setOverheadItems((prev) => prev.filter((o) => o.id !== item.id));
      showToast(`Overhead item "${item.name}" (${item.code}) deleted successfully.`);
    } catch (err: any) {
      console.error('Failed to delete overhead item:', err);
      showToast(err?.message || 'Failed to delete overhead item from database.');
    }
  };

  // Card Detail Quick Modal
  const [activeDetailItem, setActiveDetailItem] = useState<{
    title: string;
    tag: string;
    themeId: string;
    customGradient?: string;
    description: string;
    attributes: Array<{ label: string; value: string }>;
    primaryActionText?: string;
    onPrimaryAction?: () => void;
    onOpenListView?: () => void;
    supplierId?: string;
    itemId?: string;
    itemType?: 'material' | 'outsourced_service' | 'subcontractor_rate';
  } | null>(null);

  // Price History & Supplier Quotation Portal State (TASK 5)
  const [isPriceHistoryModalOpen, setIsPriceHistoryModalOpen] = useState(false);
  const [priceHistoryPresetSupplierId, setPriceHistoryPresetSupplierId] = useState<string | undefined>(undefined);
  const [priceHistoryPresetItemId, setPriceHistoryPresetItemId] = useState<string | undefined>(undefined);
  const [priceHistoryPresetItemType, setPriceHistoryPresetItemType] = useState<'material' | 'outsourced_service' | 'subcontractor_rate' | undefined>(undefined);

  const handleOpenPriceHistory = (opts?: {
    supplierId?: string;
    itemId?: string;
    itemType?: 'material' | 'outsourced_service' | 'subcontractor_rate';
  }) => {
    setPriceHistoryPresetSupplierId(opts?.supplierId);
    setPriceHistoryPresetItemId(opts?.itemId);
    setPriceHistoryPresetItemType(opts?.itemType);
    setIsPriceHistoryModalOpen(true);
  };

  // Active Card for FXTT CRM List View Modal / Dedicated Grid View
  const [activeFXTTCard, setActiveFXTTCard] = useState<{
    cardType:
      | 'material_category'
      | 'product_category'
      | 'service_category'
      | 'service_provider'
      | 'outsourced'
      | 'supplier'
      | 'project'
      | 'subcontractor'
      | 'client'
      | 'produce';
    cardId?: string;
    cardTitle: string;
    cardSubtitle?: string;
    cardTag?: string;
  } | null>(null);

  // Color change handler
  const handleUpdateTileTheme = (cardId: string, newThemeId: string, customGrad?: string) => {
    setThemeOverrides((prev) => {
      const updated = {
        ...prev,
        [cardId]: { themeId: newThemeId, customGradient: customGrad }
      };
      try {
        bizStore.setItem('fxtt_tile_theme_overrides', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // 1. Projects
    const proj = projects.find((p) => p.id === cardId);
    if (proj && onUpdateProject) {
      onUpdateProject(cardId, {
        ...proj,
        themeId: newThemeId,
        customGradient: customGrad
      });
    }

    // 2. Categories & Sub-Categories (persists theme to PostgreSQL database)
    const cat = categories.find((c) => c.id === cardId);
    if (cat) {
      const updatedCat: CategoryNode = { ...cat, themeId: newThemeId, customGradient: customGrad };
      const newCategories = categories.map((c) => (c.id === cardId ? updatedCat : c));
      setCategories(newCategories);
      onUpdateCategories?.(newCategories);
      api.updateCategory(cardId, { themeId: newThemeId, customGradient: customGrad }).catch(console.error);
    }

    // 3. Produce / Manufactured Deliverables
    const prod = produceItems.find((p) => p.id === cardId);
    if (prod) {
      if (onUpdateProduceItem) onUpdateProduceItem(cardId, { ...prod, themeId: newThemeId, customGradient: customGrad });
      api.updateProduce(cardId, { themeId: newThemeId, customGradient: customGrad }).catch(console.error);
    }

    // 4. Revenue Items
    const rev = revenueItems.find((r) => r.id === cardId);
    if (rev) {
      api.updateRevenueItem(cardId, { themeId: newThemeId, customGradient: customGrad }).catch(console.error);
    }

    // 5. Overhead Items
    const ovh = overheadItems.find((o) => o.id === cardId);
    if (ovh) {
      api.updateOverheadItem(cardId, { themeId: newThemeId, customGradient: customGrad }).catch(console.error);
    }
  };

  const getTileStyle = (cardId: string, defaultThemeId: string = 'pacific-sky') => {
    const override = themeOverrides[cardId];
    if (override && override.themeId) {
      return { themeId: override.themeId, customGradient: override.customGradient };
    }
    const cat = categories.find((c) => c.id === cardId);
    if (cat && (cat.themeId || cat.customGradient)) {
      return { themeId: cat.themeId || defaultThemeId, customGradient: cat.customGradient };
    }
    const proj = projects.find((p) => p.id === cardId);
    if (proj && (proj.themeId || proj.customGradient)) {
      return { themeId: proj.themeId || defaultThemeId, customGradient: proj.customGradient };
    }
    const prod = produceItems.find((p) => p.id === cardId);
    if (prod && (prod.themeId || prod.customGradient)) {
      return { themeId: prod.themeId || defaultThemeId, customGradient: prod.customGradient };
    }
    const rev = revenueItems.find((r) => r.id === cardId);
    if (rev && (rev.themeId || rev.customGradient)) {
      return { themeId: rev.themeId || defaultThemeId, customGradient: rev.customGradient };
    }
    const ovh = overheadItems.find((o) => o.id === cardId);
    if (ovh && (ovh.themeId || ovh.customGradient)) {
      return { themeId: ovh.themeId || defaultThemeId, customGradient: ovh.customGradient };
    }
    return { themeId: defaultThemeId };
  };

  // CRUD Handlers
  const handleSaveCategory = (nodeData: Partial<CategoryNode>) => {
    const newNode: CategoryNode = {
      id: `cat-${Date.now()}`,
      name: nodeData.name || 'New Category',
      type: 'category',
      group: nodeData.group || createCategoryGroup,
      brief: nodeData.brief || 'Category catalog branch',
      itemCount: 0,
      themeId: nodeData.themeId || 'pacific-sky',
      customGradient: nodeData.customGradient,
      metaBadge: 'CATALOG ROOT',
      actionText: 'EXPLORE SUB-CATEGORIES'
    };
    if (newNode.themeId || newNode.customGradient) {
      handleUpdateTileTheme(newNode.id, newNode.themeId, newNode.customGradient);
    }
    api.createCategory(newNode).catch(console.error);

    if (newNode.group === 'overhead') {
      api.createOverheadCategory({
        name: newNode.name,
        description: newNode.brief,
        defaultAllocationMethod: 'percentage_of_direct',
        isActive: true
      }).catch(console.error);
    } else if (newNode.group === 'product' || newNode.group === 'revenue') {
      api.createRevenueCategory({
        name: newNode.name,
        description: newNode.brief,
        isActive: true
      }).catch(console.error);
    }

    const updated = [newNode, ...categories.filter((c) => c.id !== newNode.id)];
    setCategories(updated);
    onUpdateCategories?.(updated);
    showToast(`Category "${newNode.name}" created and synced with database.`);
  };

  const handleSaveSubCategory = (nodeData: Partial<CategoryNode>) => {
    const newNode: CategoryNode = {
      id: `subcat-${Date.now()}`,
      name: nodeData.name || 'New Sub-Category',
      type: 'sub_category',
      group: nodeData.group || createSubCategoryGroup,
      parentId: nodeData.parentId,
      parentName: nodeData.parentName,
      brief: nodeData.brief || 'Sub-category classification',
      itemCount: 0,
      themeId: nodeData.themeId || 'napa-purple',
      customGradient: nodeData.customGradient,
      metaBadge: 'SUB-CATEGORY',
      actionText: 'VIEW DEEP SPECS'
    };
    if (newNode.themeId || newNode.customGradient) {
      handleUpdateTileTheme(newNode.id, newNode.themeId, newNode.customGradient);
    }
    api.createCategory(newNode).catch(console.error);

    if (newNode.group === 'product' || newNode.group === 'revenue') {
      api.createRevenueSubcategory({
        categoryId: newNode.parentId,
        name: newNode.name,
        description: newNode.brief,
        isActive: true
      }).catch(console.error);
    }

    const updated = [newNode, ...categories.filter((c) => c.id !== newNode.id)];
    setCategories(updated);
    onUpdateCategories?.(updated);
    showToast(`Sub-category "${newNode.name}" created and synced with database.`);
  };

  const handleSaveItem = (entityType: string, itemData: any) => {
    const assignedId = itemData.id || itemData.code;
    if (assignedId && (itemData.themeId || itemData.customGradient)) {
      handleUpdateTileTheme(assignedId, itemData.themeId || 'pacific-sky', itemData.customGradient);
    }

    if (entityType === 'material') {
      if (onAddMaterial) onAddMaterial(itemData);
      else api.createMaterial(itemData).catch(console.error);
      showToast(`Material "${itemData.name}" created and synced with database.`);
    } else if (entityType === 'produce' || entityType === 'product') {
      if (onAddProduceItem) onAddProduceItem(itemData);
      else api.createProduce(itemData).catch(console.error);
      showToast(`Product "${itemData.name}" created and stored in database.`);
    } else if (entityType === 'revenue') {
      const revPayload = {
        code: itemData.code || `REV-${Math.floor(Math.random() * 9000 + 1000)}`,
        name: itemData.name,
        type: (itemData.type || 'product') as 'product' | 'service',
        category: itemData.category || 'Commercial Deliverables',
        subCategory: itemData.subCategory || 'General Scope',
        unit: itemData.unit || 'unit',
        defaultRate: Number(itemData.price || itemData.defaultRate || 100),
        costPrice: Number(itemData.costPrice || 70),
        status: 'Active' as const
      };
      if (onAddRevenueItem) {
        onAddRevenueItem(revPayload);
      } else {
        api.createRevenueItem(revPayload).catch(console.error);
      }
      api.getRevenueItems({ limit: 100 }).then((res) => {
        setRevenueItems(Array.isArray(res) ? res : (res as any)?.data || []);
      }).catch(console.error);
      showToast(`Revenue deliverable "${itemData.name}" created and stored in database.`);
    } else if (entityType === 'overhead') {
      const overheadPayload = {
        code: itemData.code || `OVH-${Math.floor(Math.random() * 9000 + 1000)}`,
        name: itemData.name,
        category: itemData.category || 'Operating Overheads',
        description: itemData.description || `${itemData.name} overhead allocation (${itemData.subCategory || itemData.category})`,
        costType: itemData.costType || 'facility',
        defaultCalculationMethod: itemData.defaultCalculationMethod || 'percentage_of_direct',
        defaultRate: Number(itemData.price || itemData.defaultRate || 5),
        defaultCostBase: itemData.defaultCostBase || 'total_direct_cost',
        unitType: itemData.unit || 'pct',
        effectiveDate: new Date().toISOString().slice(0, 10),
        status: 'Active'
      };
      if (onAddOverheadItem) {
        onAddOverheadItem(overheadPayload);
      } else {
        api.createOverheadItem(overheadPayload).catch(console.error);
      }
      api.getOverheadItems({ limit: 100 }).then((res) => {
        setOverheadItems(Array.isArray(res) ? res : (res as any)?.data || []);
      }).catch(console.error);
      showToast(`Overhead item "${itemData.name}" created and stored in database.`);
    } else if (entityType === 'outsourced' || entityType === 'service-provider' || entityType === 'service') {
      if (onAddOutsourcedService) onAddOutsourcedService(itemData);
      else api.createOutsourced(itemData).catch(console.error);
      showToast(`Outsourced service "${itemData.name}" created and stored in database.`);
    } else if (entityType === 'supplier') {
      if (onAddSupplier) onAddSupplier(itemData);
      else api.createSupplier(itemData).catch(console.error);
      showToast(`Supplier "${itemData.name}" registered and stored in database.`);
    } else if (entityType === 'subcontractor') {
      if (onAddSubcontractor) onAddSubcontractor(itemData);
      else api.createSubcontractor(itemData).catch(console.error);
      showToast(`Subcontractor "${itemData.subcontractorName || itemData.name}" created and stored in database.`);
    } else if (entityType === 'project' && onAddProject) {
      onAddProject(itemData);
    } else if (entityType === 'client') {
      const newClient: ClientProfile = {
        id: `client-${Date.now()}`,
        name: itemData.name,
        tagline: itemData.tagline || 'Strategic Enterprise Partner',
        industry: itemData.industry || 'Manufacturing',
        location: itemData.location || 'Global',
        status: itemData.status || 'Active Partner',
        activeProjectsCount: 1,
        totalQuotedValue: itemData.totalQuotedValue || 250000,
        contactPerson: itemData.contactPerson || 'Procurement Executive',
        email: itemData.email || 'partner@enterprise.com',
        themeId: itemData.themeId || 'airbus-cobalt',
        customGradient: itemData.customGradient
      };
      if (itemData.themeId || itemData.customGradient) {
        handleUpdateTileTheme(newClient.id, itemData.themeId || 'airbus-cobalt', itemData.customGradient);
      }
      if (onAddClient) {
        onAddClient(newClient);
      } else {
        api.createClient(newClient).catch(console.error);
      }
      setClientProfiles((prev) => [newClient, ...prev]);
      showToast(`Client "${newClient.name}" added and stored in database.`);
    }
  };

  // Open Edit Dialog
  const handleOpenEdit = (itemType: string, id: string, initialData: Record<string, any>) => {
    const currentStyle = getTileStyle(id, initialData.themeId || 'pacific-sky');
    setEditModalData({
      isOpen: true,
      itemType,
      id,
      initialData: {
        ...initialData,
        themeId: initialData.themeId || currentStyle.themeId || 'pacific-sky',
        customGradient: initialData.customGradient !== undefined ? initialData.customGradient : currentStyle.customGradient
      }
    });
  };

  // Save Edit Dialog
  const handleSaveEdit = (id: string, updatedData: Record<string, any>) => {
    if (!editModalData) return;
    const { itemType } = editModalData;

    // Apply theme changes immediately to tile style overrides
    if (updatedData.themeId || updatedData.customGradient !== undefined) {
      handleUpdateTileTheme(id, updatedData.themeId || 'pacific-sky', updatedData.customGradient);
    }

    if (itemType === 'category' || itemType === 'sub_category' || itemType === 'sub_sub_category') {
      api.updateCategory(id, updatedData).catch(console.error);
      const updated = categories.map((c) =>
        c.id === id
          ? {
              ...c,
              name: updatedData.name || updatedData.title || c.name,
              brief: updatedData.brief || c.brief,
              themeId: updatedData.themeId || c.themeId,
              customGradient: updatedData.customGradient !== undefined ? updatedData.customGradient : c.customGradient
            }
          : c
      );
      setCategories(updated);
      onUpdateCategories?.(updated);
      showToast('Category updated in database.');
    } else if (itemType === 'client') {
      if (onUpdateClient) {
        onUpdateClient(id, updatedData);
      } else {
        api.updateClient(id, updatedData).catch(console.error);
      }
      setClientProfiles((prev) =>
        prev.map((cl) =>
          cl.id === id
            ? {
                ...cl,
                name: updatedData.name || updatedData.title || cl.name,
                tagline: updatedData.tagline || cl.tagline,
                industry: updatedData.industry || cl.industry,
                location: updatedData.location || cl.location,
                status: updatedData.status || cl.status,
                totalQuotedValue: updatedData.totalQuotedValue ?? cl.totalQuotedValue,
                contactPerson: updatedData.contactPerson || cl.contactPerson,
                email: updatedData.email || cl.email,
                themeId: updatedData.themeId || cl.themeId,
                customGradient: updatedData.customGradient !== undefined ? updatedData.customGradient : cl.customGradient
              }
            : cl
        )
      );
      showToast('Client record updated in database.');
    } else if (itemType === 'project' && onUpdateProject) {
      onUpdateProject(id, updatedData);
    } else if (itemType === 'material' && onUpdateMaterial) {
      onUpdateMaterial(id, updatedData);
    } else if (itemType === 'produce' && onUpdateProduceItem) {
      onUpdateProduceItem(id, updatedData);
    } else if ((itemType === 'service-provider' || itemType === 'outsourced' || itemType === 'service') && onUpdateOutsourcedService) {
      onUpdateOutsourcedService(id, updatedData);
    } else if (itemType === 'supplier' && onUpdateSupplier) {
      onUpdateSupplier(id, updatedData);
    } else if (itemType === 'subcontractor' && onUpdateSubcontractor) {
      onUpdateSubcontractor(id, updatedData);
    } else if (itemType === 'custom-tile') {
      setCustomTiles((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                title: updatedData.title || t.title,
                brief: updatedData.brief || t.brief,
                themeId: updatedData.themeId || t.themeId,
                customGradient: updatedData.customGradient !== undefined ? updatedData.customGradient : t.customGradient
              }
            : t
        )
      );
    }
  };

  // Open Delete Dialog
  const handleOpenDelete = (entityType: string, id: string, title: string, portalTab: DirectoryTab) => {
    setDeleteModalData({
      isOpen: true,
      title,
      entityType,
      onConfirm: () => {
        const isCategory =
          (entityType.toLowerCase().includes('category') ||
            entityType.toLowerCase().includes('spec') ||
            entityType.toLowerCase().includes('specialty') ||
            categories.some((c) => c.id === id)) &&
          !outsourcedServices.some((o) => o.id === id);

        if (isCategory) {
          api.deleteCategory(id).catch(console.error);

          // Recursively collect all descendant child category IDs
          const childIds = new Set<string>();
          const collectChildren = (parentId: string) => {
            categories.filter((c) => c.parentId === parentId).forEach((c) => {
              childIds.add(c.id);
              collectChildren(c.id);
            });
          };
          collectChildren(id);

          const updated = categories.filter((c) => c.id !== id && !childIds.has(c.id) && c.parentId !== id);
          setCategories(updated);
          onUpdateCategories?.(updated);

          // Find deleted category/subcategory node to clean up any associated tariffs
          const targetNode = categories.find((c) => c.id === id);
          const targetName = targetNode?.name || title;
          const matchingServices = outsourcedServices.filter(
            (o) =>
              o.category.toLowerCase().trim() === targetName.toLowerCase().trim() ||
              o.subCategory.toLowerCase().trim() === targetName.toLowerCase().trim()
          );
          matchingServices.forEach((s) => {
            onDeleteOutsourcedService?.(s.id);
          });

          // Reset drilldown state if active
          if (selectedMaterialCatId === id || childIds.has(selectedMaterialCatId || '')) setSelectedMaterialCatId(null);
          if (selectedMaterialSubCatId === id || childIds.has(selectedMaterialSubCatId || '')) setSelectedMaterialSubCatId(null);
          if (selectedSubcontractorCatId === id || childIds.has(selectedSubcontractorCatId || '')) setSelectedSubcontractorCatId(null);
          if (selectedSubcontractorSubCatId === id || childIds.has(selectedSubcontractorSubCatId || '')) setSelectedSubcontractorSubCatId(null);
          if (selectedOutsourcedCatId === id || childIds.has(selectedOutsourcedCatId || '')) setSelectedOutsourcedCatId(null);
          if (selectedOutsourcedSubCatId === id || childIds.has(selectedOutsourcedSubCatId || '')) setSelectedOutsourcedSubCatId(null);
          if (selectedProductCatId === id || childIds.has(selectedProductCatId || '')) setSelectedProductCatId(null);
          if (selectedProductSubCatId === id || childIds.has(selectedProductSubCatId || '')) setSelectedProductSubCatId(null);
          if (selectedServiceCatId === id || childIds.has(selectedServiceCatId || '')) setSelectedServiceCatId(null);
          if (selectedServiceSubCatId === id || childIds.has(selectedServiceSubCatId || '')) setSelectedServiceSubCatId(null);

          showToast(`${entityType} deleted successfully.`);
        } else if (
          entityType.toLowerCase().includes('outsourced') ||
          entityType.toLowerCase().includes('service tariff') ||
          entityType === 'Outsourced Service' ||
          outsourcedServices.some((o) => o.id === id)
        ) {
          api.deleteOutsourcedService(id).catch(console.error);
          if (onDeleteOutsourcedService) onDeleteOutsourcedService(id);
          showToast(`Service tariff "${title}" deleted.`);
        } else if (entityType === 'Service Provider') {
          const matchingSup = suppliers.filter(
            (s) => s.id === id || s.name.toLowerCase().trim() === title.toLowerCase().trim()
          );
          matchingSup.forEach((s) => onDeleteSupplier?.(s.id));
          const matching = outsourcedServices.filter(
            (o) => o.providerId === id || o.providerName.toLowerCase().trim() === title.toLowerCase().trim()
          );
          matching.forEach((o) => onDeleteOutsourcedService?.(o.id));
          showToast(`Service provider "${title}" deleted.`);
        } else if (entityType === 'Subcontractor Profile') {
          const matchingSup = suppliers.filter(
            (s) => s.id === id || s.name.toLowerCase().trim() === title.toLowerCase().trim()
          );
          matchingSup.forEach((s) => onDeleteSupplier?.(s.id));
          const matching = subcontractors.filter(
            (s) => s.subcontractorId === id || s.subcontractorName.toLowerCase().trim() === title.toLowerCase().trim() || s.id === id
          );
          matching.forEach((s) => onDeleteSubcontractor?.(s.id));
          showToast(`Subcontractor profile "${title}" deleted.`);
        } else if (entityType === 'Project' || portalTab === 'projects') {
          if (onDeleteProject) onDeleteProject(id);
          api.deleteProject(id).catch(console.error);
          showToast(`Project "${title}" deleted.`);
        } else if (entityType === 'Client Profile' || portalTab === 'clients') {
          if (onDeleteClient) onDeleteClient(id);
          else api.deleteClient(id).catch(console.error);
          setClientProfiles((prev) => prev.filter((cl) => cl.id !== id));
          showToast('Client deleted from database.');
        } else if (entityType === 'Supplier Profile' || portalTab === 'suppliers') {
          if (onDeleteSupplier) onDeleteSupplier(id);
          api.deleteSupplier(id).catch(console.error);
          showToast(`Supplier "${title}" deleted.`);
        } else if (portalTab === 'materials-hierarchy' || materials.some((m) => m.id === id)) {
          if (onDeleteMaterial) onDeleteMaterial(id);
        } else if (portalTab === 'revenue-streams' || (portalTab as string) === 'produce' || produceItems.some((p) => p.id === id)) {
          if (onDeleteProduceItem) onDeleteProduceItem(id);
        } else if (portalTab === 'service-providers' || (portalTab as string) === 'outsourced' || outsourcedServices.some((o) => o.id === id)) {
          if (onDeleteOutsourcedService) onDeleteOutsourcedService(id);
        } else if (portalTab === 'subcontractors' || subcontractors.some((s) => s.id === id)) {
          if (onDeleteSubcontractor) onDeleteSubcontractor(id);
        } else {
          setCustomTiles((prev) => prev.filter((t) => t.id !== id));
          api.deleteCustomTile(id).catch(console.error);
        }
      }
    });
  };

  // Duplicate Handler
  const handleDuplicate = (itemType: string, id: string) => {
    if (itemType === 'category' || itemType === 'sub_category' || itemType === 'sub_sub_category') {
      const match = categories.find((c) => c.id === id);
      if (match) {
        const copy: CategoryNode = {
          ...match,
          id: `cat-copy-${Date.now()}`,
          name: `${match.name} (Copy)`
        };
        const updated = [copy, ...categories];
        setCategories(updated);
        api.createCategory(copy).catch(console.error);
        onUpdateCategories?.(updated);
      }
    } else if (itemType === 'client') {
      const match = clientProfiles.find((c) => c.id === id);
      if (match) {
        const copy: ClientProfile = {
          ...match,
          id: `client-copy-${Date.now()}`,
          code: `${match.code || 'CLI'}-CPY`,
          name: `${match.name} (Copy)`
        };
        setClientProfiles((prev) => [copy, ...prev]);
        if (onAddClient) {
          onAddClient(copy);
        } else {
          api.createClient(copy).catch(console.error);
        }
      }
    } else if (itemType === 'project' && onAddProject) {
      const match = projects.find((p) => p.id === id);
      if (match) {
        onAddProject({
          ...match,
          code: `${match.code}-CPY`,
          name: `${match.name} (Copy)`
        });
      }
    } else if (itemType === 'supplier' && onAddSupplier) {
      const match = suppliers.find((s) => s.id === id);
      if (match) {
        onAddSupplier({
          ...match,
          name: `${match.name} (Copy)`
        });
      }
    } else if (itemType === 'service-provider' && onAddOutsourcedService) {
      const match = outsourcedServices.find((s) => s.id === id);
      if (match) {
        onAddOutsourcedService({
          ...match,
          providerName: `${match.providerName} (Copy)`
        });
      }
    } else if (itemType === 'subcontractor' && onAddSubcontractor) {
      const match = subcontractors.find((s) => s.id === id);
      if (match) {
        onAddSubcontractor({
          ...match,
          subcontractorName: `${match.subcontractorName} (Copy)`
        });
      }
    } else if (itemType === 'custom-tile') {
      const match = customTiles.find((t) => t.id === id);
      if (match) {
        setCustomTiles((prev) => [
          {
            ...match,
            id: `custom-tile-${Date.now()}`,
            title: `${match.title} (Copy)`
          },
          ...prev
        ]);
      }
    }
  };

  // List of unique Outsourced Service Provider entities
  const outsourcedProvidersList = useMemo(() => {
    const list: Array<{
      id: string;
      providerId: string;
      name: string;
      category: string;
      city: string;
      country: string;
      contactPerson: string;
      email: string;
      phone: string;
      paymentTerms: string;
      rating: number;
      qualityScorePct: number;
      slaLevel: string;
      services: typeof outsourcedServices;
    }> = [];

    const seenNames = new Set<string>();

    // 1. Check suppliers that specialize in Outsourced Services
    suppliers
      .filter((s) => s.category === 'Outsourced' || s.supplyScope === 'service' || s.supplyScope === 'hybrid' || s.name.toLowerCase().includes('logistics') || s.name.toLowerCase().includes('freight'))
      .forEach((sup) => {
        const svcs = outsourcedServices.filter(
          (o) =>
            o.providerId === sup.id ||
            o.providerName.toLowerCase().trim() === sup.name.toLowerCase().trim() ||
            o.providerName.toLowerCase().includes(sup.name.toLowerCase()) ||
            sup.name.toLowerCase().includes(o.providerName.toLowerCase())
        );
        seenNames.add(sup.name.toLowerCase().trim());
        list.push({
          id: sup.id,
          providerId: sup.id,
          name: sup.name,
          category: sup.category || 'Outsourced Logistics & Freight',
          city: sup.city || 'Regional Hub',
          country: sup.country || 'United States',
          contactPerson: sup.contactPerson || 'Logistics Coordinator',
          email: sup.email || 'contracts@outsourced-provider.com',
          phone: sup.phone || '+1 (800) 555-0199',
          paymentTerms: sup.paymentTerms || 'Net 30',
          rating: sup.rating || 4.8,
          qualityScorePct: sup.qualityScorePct || 99.0,
          slaLevel: svcs[0]?.slaLevel || 'Tier-1 SLA (99.5%)',
          services: svcs
        });
      });

    // 2. Also register any unique providerName from outsourcedServices not yet in list
    outsourcedServices.forEach((svc) => {
      const nameClean = (svc.providerName || '').trim();
      if (nameClean && !seenNames.has(nameClean.toLowerCase())) {
        seenNames.add(nameClean.toLowerCase());
        const matchingSup = suppliers.find(
          (s) =>
            s.id === svc.providerId ||
            s.name.toLowerCase().trim() === nameClean.toLowerCase() ||
            s.name.toLowerCase().includes(nameClean.toLowerCase()) ||
            nameClean.toLowerCase().includes(s.name.toLowerCase())
        );
        const svcs = outsourcedServices.filter(
          (o) =>
            (svc.providerId && o.providerId === svc.providerId) ||
            o.providerName.toLowerCase().trim() === nameClean.toLowerCase()
        );
        list.push({
          id: svc.providerId || `prov-${nameClean.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          providerId: svc.providerId || `prov-${nameClean.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          name: nameClean,
          category: svc.category || 'Outsourced Processing & Transport',
          city: matchingSup?.city || 'Regional Terminal',
          country: matchingSup?.country || (svc as any).country || 'United States',
          contactPerson: matchingSup?.contactPerson || 'Operations Lead',
          email: matchingSup?.email || (svc as any).contactEmail || `contracts@${nameClean.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
          phone: matchingSup?.phone || (svc as any).contactPhone || '+1 (800) 555-0199',
          paymentTerms: matchingSup?.paymentTerms || 'Net 30 / Escrow',
          rating: matchingSup?.rating || 4.8,
          qualityScorePct: matchingSup?.qualityScorePct || 99.2,
          slaLevel: svc.slaLevel || 'Tier-1 SLA (99.5%)',
          services: svcs
        });
      }
    });

    return list;
  }, [suppliers, outsourcedServices]);

  // List of unique Subcontractor Partner entities
  const subcontractorsList = useMemo(() => {
    const list: Array<{
      id: string;
      subcontractorId: string;
      name: string;
      serviceCategory: string;
      serviceType: string;
      skillLevel: string;
      city: string;
      country: string;
      contactPerson: string;
      email: string;
      phone: string;
      paymentTerms: string;
      rating: number;
      qualityScorePct: number;
      ratesCount: number;
      subcontractorItems: typeof subcontractors;
    }> = [];

    const seenNames = new Set<string>();

    // 1. Register all unique subcontractors from authoritative subcontractors dataset
    subcontractors.forEach((sub) => {
      const nameClean = (sub.subcontractorName || '').trim();
      if (nameClean && !seenNames.has(nameClean.toLowerCase())) {
        seenNames.add(nameClean.toLowerCase());

        const subItems = subcontractors.filter(
          (s) =>
            (sub.subcontractorId && s.subcontractorId === sub.subcontractorId) ||
            s.subcontractorName.toLowerCase().trim() === nameClean.toLowerCase()
        );

        const matchingSup = suppliers.find(
          (s) =>
            s.id === sub.subcontractorId ||
            s.name.toLowerCase().trim() === nameClean.toLowerCase() ||
            s.name.toLowerCase().includes(nameClean.toLowerCase()) ||
            nameClean.toLowerCase().includes(s.name.toLowerCase())
        );

        list.push({
          id: sub.subcontractorId || `sub-${nameClean.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          subcontractorId: sub.subcontractorId || `sub-${nameClean.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          name: nameClean,
          serviceCategory: sub.serviceCategory || 'Specialist Fabrication & Machining',
          serviceType: sub.serviceType || 'Trade Subcontractor',
          skillLevel: sub.skillLevel || 'Certified Master Crew',
          city: matchingSup?.city || 'Detroit, MI',
          country: matchingSup?.country || (sub as any).country || 'United States',
          contactPerson: matchingSup?.contactPerson || 'Field Operations Lead',
          email: matchingSup?.email || (sub as any).contactEmail || `dispatch@${nameClean.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
          phone: matchingSup?.phone || (sub as any).contactPhone || '+1 (800) 555-0188',
          paymentTerms: matchingSup?.paymentTerms || 'Milestone Progress Billing',
          rating: matchingSup?.rating || 4.9,
          qualityScorePct: matchingSup?.qualityScorePct || 99.4,
          ratesCount: subItems.length,
          subcontractorItems: subItems
        });
      }
    });

    // 2. Also register any supplier with category === 'Subcontractor' not already registered
    suppliers
      .filter((s) => s.category === 'Subcontractor' && !seenNames.has(s.name.toLowerCase().trim()))
      .forEach((sup) => {
        const subItems = subcontractors.filter(
          (s) =>
            s.subcontractorId === sup.id ||
            s.subcontractorName.toLowerCase().trim() === sup.name.toLowerCase().trim() ||
            s.subcontractorName.toLowerCase().includes(sup.name.toLowerCase()) ||
            sup.name.toLowerCase().includes(s.subcontractorName.toLowerCase())
        );

        if (subItems.length > 0) {
          seenNames.add(sup.name.toLowerCase().trim());
          list.push({
            id: sup.id,
            subcontractorId: sup.id,
            name: sup.name,
            serviceCategory: subItems[0]?.serviceCategory || sup.category || 'Specialist Fabrication & Machining',
            serviceType: subItems[0]?.serviceType || 'Specialist Trade Subcontractor',
            skillLevel: subItems[0]?.skillLevel || 'Certified Master Crew',
            city: sup.city || 'Detroit, MI',
            country: sup.country || 'United States',
            contactPerson: sup.contactPerson || 'Field Operations Lead',
            email: sup.email || 'crews@subcontractor.com',
            phone: sup.phone || '+1 (800) 555-0188',
            paymentTerms: sup.paymentTerms || 'Milestone Progress Billing',
            rating: sup.rating || 4.9,
            qualityScorePct: sup.qualityScorePct || 99.4,
            ratesCount: subItems.length,
            subcontractorItems: subItems
          });
        }
      });

    return list;
  }, [suppliers, subcontractors]);

  // Filter tabs definition with simple, concise words
  const navTabs: { id: DirectoryTab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'projects', label: 'Projects', icon: <Briefcase className="w-3.5 h-3.5" />, count: projects.length },
    { id: 'resources', label: 'Resources', icon: <Wrench className="w-3.5 h-3.5" />, count: enterpriseResources.length },
    {
      id: 'materials-hierarchy',
      label: 'Materials',
      icon: <Layers className="w-3.5 h-3.5" />,
      count: categories.filter((c) => c.group === 'material' && c.type === 'category').length
    },
    {
      id: 'service-categories',
      label: 'Services',
      icon: <HardHat className="w-3.5 h-3.5" />,
      count: categories.filter((c) => (c.group === 'subcontractor' || c.group === 'outsourced') && c.type === 'category').length
    },
    {
      id: 'revenue-streams',
      label: 'Revenue',
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      count: categories.filter((c) => (c.group === 'product' || c.group === 'service') && c.type === 'category').length
    },
    {
      id: 'overheads-hierarchy',
      label: 'Overheads',
      icon: <Layers className="w-3.5 h-3.5 text-amber-500" />,
      count: categories.filter((c) => c.group === 'overhead' && c.type === 'category').length
    },
    { id: 'clients', label: 'Clients', icon: <Users className="w-3.5 h-3.5" />, count: clientProfiles.length },
    { id: 'suppliers', label: 'Suppliers', icon: <Building2 className="w-3.5 h-3.5" />, count: suppliers.length },
    { id: 'service-providers', label: 'Providers', icon: <ShieldCheck className="w-3.5 h-3.5" />, count: outsourcedProvidersList.length },
    { id: 'subcontractors', label: 'Subcontractors', icon: <FolderTree className="w-3.5 h-3.5" />, count: subcontractorsList.length },
    { id: 'competitors', label: 'Competitors', icon: <Scale className="w-3.5 h-3.5 text-rose-500" />, count: competitorsList.length }
  ];

  // Handler to submit generic new tile
  const handleCreateTileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardTitle.trim()) return;

    let targetGroup: DirectoryTab = 'projects';
    if (createType === 'material-category') targetGroup = 'materials-hierarchy';
    else if (createType === 'subcontractor-category') {
      targetGroup = 'service-categories';
      setServiceSubTab('subcontractor');
    }
    else if (createType === 'outsourced-category') {
      targetGroup = 'service-categories';
      setServiceSubTab('outsourced');
    }
    else if (createType === 'product-category') {
      targetGroup = 'revenue-streams';
      setRevenueSubTab('products');
    }
    else if (createType === 'service-category') {
      targetGroup = 'revenue-streams';
      setRevenueSubTab('services');
    }
    else if (createType === 'overhead-category') {
      targetGroup = 'overheads-hierarchy';
    }
    else if (createType === 'client') targetGroup = 'clients';
    else if (createType === 'supplier') targetGroup = 'suppliers';
    else if (createType === 'service-provider') targetGroup = 'service-providers';
    else if (createType === 'subcontractor') targetGroup = 'subcontractors';

    const newTile = {
      id: `custom-tile-${Date.now()}`,
      group: targetGroup,
      tag: newCardTag.toUpperCase() || 'CUSTOM CARD',
      title: newCardTitle,
      brief: newCardBrief || 'Enterprise Verified Specification',
      action: newCardAction || 'VIEW DETAILS',
      themeId: newCardThemeId,
      customGradient: newCardCustomGradient
    };

    const updatedTiles = [newTile, ...customTiles];
    setCustomTiles(updatedTiles);
    api.createCustomTile(newTile).catch(console.error);

    // If tile represents a category type, also create a CategoryNode in the hierarchy
    let catGroup: 'material' | 'product' | 'subcontractor' | 'service' | 'outsourced' | undefined;
    if (createType === 'material-category') catGroup = 'material';
    else if (createType === 'subcontractor-category') catGroup = 'subcontractor';
    else if (createType === 'outsourced-category') catGroup = 'outsourced';
    else if (createType === 'product-category') catGroup = 'product';
    else if (createType === 'service-category') catGroup = 'service';

    if (catGroup) {
      const newCatNode: CategoryNode = {
        id: `cat-${Date.now()}`,
        name: newCardTitle,
        type: 'category',
        group: catGroup,
        brief: newCardBrief || 'Enterprise Verified Specification',
        itemCount: 0,
        themeId: newCardThemeId,
        customGradient: newCardCustomGradient,
        metaBadge: newCardTag || 'CATEGORY',
        actionText: 'VIEW ITEMS'
      };
      api.createCategory(newCatNode).catch(console.error);
      setCategories((prev) => [newCatNode, ...prev]);
      onUpdateCategories?.([newCatNode, ...categories]);
    }

    setIsCreateModalOpen(false);
    setNewCardTitle('');
    setNewCardBrief('');
  };

  // Reusable renderer for user-created custom cards in any directory portal tab
  const renderCustomTilesForTab = (group: DirectoryTab, subtitleDefault: string = 'Enterprise Specification') => {
    const tiles = customTiles.filter((t) => t.group === group);
    if (tiles.length === 0) return null;
    return (
      <div className="space-y-3 pt-2">
        <div className="flex items-center space-x-2">
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Custom Cards & Specifications ({tiles.length})
          </h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiles.map((t) => (
            <ModernTileCard
              key={t.id}
              id={t.id}
              tag={t.tag}
              title={t.title}
              brief={t.brief}
              actionLabel={t.action}
              actionVariant="link"
              themeId={t.themeId}
              customGradient={t.customGradient}
              onChangeTheme={(tId, grad) => handleUpdateTileTheme(t.id, tId, grad)}
              onEdit={() =>
                handleOpenEdit('custom-tile', t.id, {
                  title: t.title,
                  brief: t.brief,
                  tag: t.tag
                })
              }
              onDelete={() => handleOpenDelete('Custom Tile', t.id, t.title, group)}
              onDuplicate={() => handleDuplicate('custom-tile', t.id)}
              onAction={() => {
                setActiveDetailItem({
                  title: t.title,
                  tag: t.tag,
                  themeId: t.themeId,
                  customGradient: t.customGradient,
                  description: t.brief
                });
              }}
              onViewListView={() => {
                setActiveFXTTCard({
                  cardType:
                    group === 'materials-hierarchy'
                      ? 'material_category'
                      : group === 'clients'
                      ? 'client'
                      : group === 'suppliers'
                      ? 'supplier'
                      : group === 'subcontractors'
                      ? 'subcontractor'
                      : group === 'service-providers'
                      ? 'service_provider'
                      : 'product_category',
                  cardId: t.id,
                  cardTitle: t.title,
                  cardSubtitle: t.brief || subtitleDefault,
                  cardTag: t.tag
                });
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 pb-12 relative">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-4 right-4 z-50 bg-[#003049] border border-[#669bbc] text-white px-3 py-2 rounded-lg shadow-lg flex items-center space-x-2 animate-in slide-in-from-bottom-2 duration-150">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#fdf0d5] shrink-0" />
          <span className="text-xs font-normal text-white">{toastMsg}</span>
        </div>
      )}

      {/* 1. DIRECTORY HUB MAIN TABS BAR */}
      <div className="bg-white dark:bg-[#0b101b] p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-1 overflow-x-auto no-scrollbar">
        {[
          { id: 'projects', label: 'Projects', icon: <FolderTree className="w-3.5 h-3.5" />, count: projects.length },
          { id: 'materials-hierarchy', label: 'Materials', icon: <Box className="w-3.5 h-3.5" />, count: materials.length },
          { id: 'resources', label: 'Resources', icon: <Wrench className="w-3.5 h-3.5" />, count: enterpriseResources.length },
          { id: 'service-categories', label: 'Services', icon: <HardHat className="w-3.5 h-3.5" />, count: categories.filter(c => c.group === 'subcontractor' || c.group === 'outsourced').length },
          { id: 'revenue-streams', label: 'Revenue', icon: <TrendingUp className="w-3.5 h-3.5" />, count: combinedAllRevenueRecords.length },
          { id: 'overheads-hierarchy', label: 'Overheads', icon: <Scale className="w-3.5 h-3.5" />, count: overheadItems.length },
          { id: 'clients', label: 'Clients', icon: <Building2 className="w-3.5 h-3.5" />, count: clientProfiles.length },
          { id: 'suppliers', label: 'Suppliers', icon: <Truck className="w-3.5 h-3.5" />, count: suppliers.length },
          { id: 'competitors', label: 'Competitors', icon: <Users className="w-3.5 h-3.5" />, count: competitorsList.length }
        ].map((tab) => {
          const isActive = activeTab === tab.id || (tab.id === 'revenue-streams' && (activeTab === 'products-hierarchy' || activeTab === 'services-hierarchy'));
          return (
            <button
              key={tab.id}
              type="button"
              id={`dir-tab-${tab.id}`}
              onClick={() => {
                setActiveTab(tab.id as DirectoryTab);
                if (tab.id === 'resources') setSelectedResourceCategory(null);
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#0078d4] text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2.5 REVENUE STREAMS SUB TABS: 'All Records', 'Products', 'Services', 'Hierarchy' */}
      {(activeTab === 'revenue-streams' || activeTab === 'products-hierarchy' || activeTab === 'services-hierarchy') && (
        <div className="bg-white p-2 sm:p-2.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center space-x-1.5 text-xs text-slate-700">
              <TrendingUp className="w-4 h-4 text-[#003049]" />
              <span className="font-bold text-slate-900 text-xs">Revenue Streams:</span>
            </div>

            {/* Segmented Sub-Tabs */}
            <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 gap-1 flex-wrap">
              {/* 0. All Revenue Records Sub-Tab */}
              <button
                type="button"
                id="subtab-revenue-all-records"
                onClick={() => {
                  setRevenueSubTab('all_records');
                  setSelectedProductCatId(null);
                  setSelectedProductSubCatId(null);
                  setSelectedServiceCatId(null);
                }}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  revenueSubTab === 'all_records'
                    ? 'bg-[#003049] text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Table className={`w-3.5 h-3.5 ${revenueSubTab === 'all_records' ? 'text-[#fdf0d5]' : 'text-slate-500'}`} />
                <span>All Revenue Records</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    revenueSubTab === 'all_records' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {combinedAllRevenueRecords.length}
                </span>
              </button>

              {/* 1. Products Sub-Tab */}
              <button
                type="button"
                id="subtab-revenue-products"
                onClick={() => {
                  setRevenueSubTab('products');
                  setSelectedProductCatId(null);
                  setSelectedProductSubCatId(null);
                }}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  revenueSubTab === 'products'
                    ? 'bg-[#003049] text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Box className={`w-3.5 h-3.5 ${revenueSubTab === 'products' ? 'text-[#fdf0d5]' : 'text-slate-500'}`} />
                <span>Products</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    revenueSubTab === 'products' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {combinedAllRevenueRecords.filter((r) => r.type === 'product').length}
                </span>
              </button>

              {/* 2. Services Sub-Tab */}
              <button
                type="button"
                id="subtab-revenue-services"
                onClick={() => {
                  setRevenueSubTab('services');
                  setSelectedServiceCatId(null);
                }}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  revenueSubTab === 'services'
                    ? 'bg-[#003049] text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Truck className={`w-3.5 h-3.5 ${revenueSubTab === 'services' ? 'text-[#fdf0d5]' : 'text-slate-500'}`} />
                <span>Services</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    revenueSubTab === 'services' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {combinedAllRevenueRecords.filter((r) => r.type === 'service').length}
                </span>
              </button>

              {/* 3. Hierarchy Sub-Tab */}
              <button
                type="button"
                id="subtab-revenue-hierarchy"
                onClick={() => {
                  setRevenueSubTab('hierarchy');
                  setSelectedProductCatId(null);
                  setSelectedProductSubCatId(null);
                  setSelectedServiceCatId(null);
                }}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  revenueSubTab === 'hierarchy'
                    ? 'bg-[#003049] text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <FolderTree className={`w-3.5 h-3.5 ${revenueSubTab === 'hierarchy' ? 'text-[#fdf0d5]' : 'text-slate-500'}`} />
                <span>Categories &amp; Subcategories</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    revenueSubTab === 'hierarchy' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {categories.filter((c) => (c.group === 'product' || c.group === 'revenue' || c.group === 'service') && c.type === 'category').length}
                </span>
              </button>
            </div>
          </div>

          {/* Quick Creation Actions linked directly to Database */}
          <div className="flex items-center space-x-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setCreateCategoryGroup('product');
                setIsCreateCategoryModalOpen(true);
              }}
              className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-colors shadow-2xs cursor-pointer"
              title="Create a new Category for Products or Revenue in database"
            >
              <FolderPlus className="w-3.5 h-3.5 text-amber-600" />
              <span>+ Category</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCreateSubCategoryGroup('product');
                setIsCreateSubCategoryModalOpen(true);
              }}
              className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-colors shadow-2xs cursor-pointer"
              title="Create a new Sub-Category linked to parent category in database"
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>+ Sub-Category</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAddItemPortal('products-hierarchy');
                setIsAddItemModalOpen(true);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 bg-[#003049] hover:bg-[#002235] text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs cursor-pointer"
              title="Create product deliverable synchronized with Revenue Catalogue"
            >
              <Plus className="w-3.5 h-3.5 text-[#fdf0d5]" />
              <span>+ Add Product</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAddItemPortal('revenue');
                setIsAddItemModalOpen(true);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs cursor-pointer"
              title="Add deliverable or service to Revenue Catalogue"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              <span>+ Add Revenue Item</span>
            </button>
          </div>
        </div>
      )}

      {/* 2b. Sub-Portal Selector for Service Categories: Subcontractor vs Outsourced */}
      {activeTab === 'service-categories' && (
        <div className="bg-slate-100/80 dark:bg-slate-800/80 p-2 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider pl-1">
              Service:
            </span>
            <div className="inline-flex p-1 bg-slate-200/80 dark:bg-slate-700 rounded-lg space-x-1">
              {/* 1. Subcontractor Sub-Tab */}
              <button
                type="button"
                id="subtab-service-subcontractor"
                onClick={() => {
                  setServiceSubTab('subcontractor');
                  setSelectedSubcontractorCatId(null);
                  setSelectedSubcontractorSubCatId(null);
                }}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  serviceSubTab === 'subcontractor'
                    ? 'bg-[#0078d4] text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <HardHat className="w-3.5 h-3.5" />
                <span>Subcontractor</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    serviceSubTab === 'subcontractor' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {categories.filter((c) => c.group === 'subcontractor' && c.type === 'category').length}
                </span>
              </button>

              {/* 2. Outsourced Sub-Tab */}
              <button
                type="button"
                id="subtab-service-outsourced"
                onClick={() => {
                  setServiceSubTab('outsourced');
                  setSelectedOutsourcedCatId(null);
                  setSelectedOutsourcedSubCatId(null);
                }}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  serviceSubTab === 'outsourced'
                    ? 'bg-[#0078d4] text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Outsourced</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    serviceSubTab === 'outsourced' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {categories.filter((c) => c.group === 'outsourced' && c.type === 'category').length}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Refined Title Row - Simple UI like Home tab */}
      <div className="bg-white dark:bg-[#0b101b] px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-3 relative">
        {/* Left: Portal Identity */}
        <div className="flex items-center space-x-2.5 min-w-0">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-tight tracking-tight truncate">
            {activeTab === 'projects' && 'Projects'}
            {activeTab === 'materials-hierarchy' && 'Materials'}
            {activeTab === 'resources' && 'Resources'}
            {activeTab === 'service-categories' && (
              serviceSubTab === 'subcontractor' ? 'Subcontractors' : 'Outsourced'
            )}
            {(activeTab === 'revenue-streams' || activeTab === 'products-hierarchy' || activeTab === 'services-hierarchy') && (
              revenueSubTab === 'all_records' ? 'Revenue Portal Records (Products & Services)' :
              revenueSubTab === 'products' ? 'Products (Deliverables)' :
              revenueSubTab === 'services' ? 'Services (Commercial Scopes)' :
              'Revenue Categories & Hierarchy'
            )}
            {activeTab === 'clients' && 'Clients'}
            {activeTab === 'suppliers' && 'Suppliers'}
            {activeTab === 'service-providers' && 'Providers'}
            {activeTab === 'subcontractors' && 'Subcontractors'}
            {activeTab === 'overheads-hierarchy' && 'Overhead Costs'}
            {activeTab === 'competitors' && 'Competitor Intelligence & Market Benchmarks'}
          </h2>

          {/* Portal Scope Indicator Pill */}
          <span className="inline-flex items-center space-x-1 text-xs font-bold font-mono text-[#0078d4] dark:text-sky-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
            {activeTab === 'resources' && `${enterpriseResources.length} Total`}
            {activeTab === 'service-categories' && (
              serviceSubTab === 'subcontractor'
                ? `${categories.filter(c => c.group === 'subcontractor' && c.type === 'category').length} Categories`
                : `${categories.filter(c => c.group === 'outsourced' && c.type === 'category').length} Tariffs`
            )}
            {activeTab === 'materials-hierarchy' && `${categories.filter(c => c.group === 'material' && c.type === 'category').length} Categories`}
            {activeTab === 'revenue-streams' && (
              revenueSubTab === 'all_records'
                ? `${combinedAllRevenueRecords.length} Deliverables`
                : revenueSubTab === 'products'
                ? `${combinedAllRevenueRecords.filter(r => r.type === 'product').length} Products`
                : revenueSubTab === 'services'
                ? `${combinedAllRevenueRecords.filter(r => r.type === 'service').length} Services`
                : `${categories.filter(c => (c.group === 'product' || c.group === 'revenue' || c.group === 'service') && c.type === 'category').length} Categories`
            )}
            {activeTab === 'overheads-hierarchy' && `${categories.filter(c => c.group === 'overhead' && c.type === 'category').length} Categories`}
            {activeTab === 'projects' && `${projects.length} Total`}
            {activeTab === 'clients' && `${clientProfiles.length} Total`}
            {activeTab === 'suppliers' && `${suppliers.length} Total`}
            {activeTab === 'service-providers' && `${outsourcedServices.length} Total`}
            {activeTab === 'subcontractors' && `${subcontractors.length} Total`}
            {activeTab === 'competitors' && `${competitorsList.length} Registered`}
          </span>
        </div>

        {/* Right: Search and Actions */}
        <div className="flex items-center flex-wrap gap-2 ml-auto">
          {/* Simple Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search directory..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (searchQuery.trim()) {
                    showToast(`Filtering portal cards matching "${searchQuery}"`);
                  }
                }
              }}
              className="bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-[#003049] rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-44 sm:w-56 transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Fine Vertical Divider Line */}
          <span className="hidden sm:inline-block h-5 w-px bg-slate-200 mx-0.5" />

          {/* Primary Quick Action Button with Fine Lines */}
          {activeTab === 'resources' && (
            <button
              type="button"
              onClick={() => {
                setEditingResource(null);
                setIsCreateResourceModalOpen(true);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white text-xs font-semibold rounded-lg transition-all shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              <span>+ Resource</span>
            </button>
          )}

          {activeTab === 'materials-hierarchy' && (
            <button
              type="button"
              onClick={() => {
                setAddItemPortal('materials-hierarchy');
                setIsAddItemModalOpen(true);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white text-xs font-semibold rounded-lg transition-all shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              <span>+ Item</span>
            </button>
          )}

          {activeTab === 'service-categories' && (
            serviceSubTab === 'subcontractor' ? (
              <button
                type="button"
                onClick={() => {
                  setAddItemPortal('subcontractors');
                  setIsAddItemModalOpen(true);
                }}
                className="flex items-center space-x-1 px-3 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white text-xs font-semibold rounded-lg transition-all shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-white" />
                <span>+ Service</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAddItemPortal('service-providers');
                  setIsAddItemModalOpen(true);
                }}
                className="flex items-center space-x-1 px-3 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white text-xs font-semibold rounded-lg transition-all shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-white" />
                <span>+ Tariff</span>
              </button>
            )
          )}

          {(activeTab === 'revenue-streams' || activeTab === 'products-hierarchy' || activeTab === 'services-hierarchy') && (
            revenueSubTab === 'products' ? (
              <button
                type="button"
                onClick={() => {
                  setAddItemPortal('products-hierarchy');
                  setIsAddItemModalOpen(true);
                }}
                className="flex items-center space-x-1 px-3 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white text-xs font-semibold rounded-lg transition-all shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-white" />
                <span>+ Product</span>
              </button>
            ) : revenueSubTab === 'services' ? (
              <button
                type="button"
                onClick={() => {
                  setAddItemPortal('services-hierarchy');
                  setIsAddItemModalOpen(true);
                }}
                className="flex items-center space-x-1 px-3 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white text-xs font-semibold rounded-lg transition-all shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-white" />
                <span>+ Tariff</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAddItemPortal('revenue');
                  setIsAddItemModalOpen(true);
                }}
                className="flex items-center space-x-1 px-3 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white text-xs font-semibold rounded-lg transition-all shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-white" />
                <span>+ Deliverable</span>
              </button>
            )
          )}

          {activeTab === 'projects' && (
            <button
              type="button"
              onClick={() => {
                setAddItemPortal('projects');
                setIsAddItemModalOpen(true);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white text-xs font-semibold rounded-lg transition-all shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              <span>+ Project</span>
            </button>
          )}

          {activeTab === 'clients' && (
            <button
              type="button"
              onClick={() => {
                setAddItemPortal('clients');
                setIsAddItemModalOpen(true);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white text-xs font-semibold rounded-lg transition-all shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              <span>+ Client</span>
            </button>
          )}

          {activeTab === 'suppliers' && (
            <button
              type="button"
              onClick={() => {
                setAddItemPortal('suppliers');
                setIsAddItemModalOpen(true);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white text-xs font-semibold rounded-lg transition-all shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              <span>+ Supplier</span>
            </button>
          )}

          {activeTab === 'service-providers' && (
            <button
              type="button"
              onClick={() => {
                setAddItemPortal('service-providers');
                setIsAddItemModalOpen(true);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white text-xs font-semibold rounded-lg transition-all shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              <span>+ Provider</span>
            </button>
          )}

          {activeTab === 'subcontractors' && (
            <button
              type="button"
              onClick={() => {
                setAddItemPortal('subcontractors');
                setIsAddItemModalOpen(true);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white text-xs font-semibold rounded-lg transition-all shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              <span>+ Subcontractor</span>
            </button>
          )}

          {activeTab === 'overheads-hierarchy' && (
            <button
              type="button"
              onClick={() => {
                setAddItemPortal('overheads-hierarchy');
                setIsAddItemModalOpen(true);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white text-xs font-semibold rounded-lg transition-all shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              <span>+ Overhead Item</span>
            </button>
          )}

          {activeTab === 'competitors' && (
            <button
              type="button"
              onClick={() => {
                setEditingCompetitor(null);
                setCompetitorForm({
                  name: '',
                  code: `COMP-${Date.now().toString().slice(-4)}`,
                  country: 'United States',
                  marketTier: 'Primary Competitor',
                  contactPerson: '',
                  email: '',
                  website: '',
                  notes: ''
                });
                setIsCompetitorModalOpen(true);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 bg-[#003049] hover:bg-[#002235] text-white text-xs font-semibold rounded-lg transition-all shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              <span>+ Competitor</span>
            </button>
          )}

          {/* Connected Quick Category & Sub-Category Creation directly linked to Database */}
          <button
            type="button"
            id="portal-quick-add-category-btn"
            onClick={() => {
              let grp: 'material' | 'product' | 'service' | 'subcontractor' | 'outsourced' | 'overhead' = 'material';
              if (activeTab === 'materials-hierarchy') grp = 'material';
              else if (activeTab === 'revenue-streams' || activeTab === 'products-hierarchy') grp = revenueSubTab === 'products' ? 'product' : 'service';
              else if (activeTab === 'overheads-hierarchy') grp = 'overhead';
              else if (activeTab === 'service-categories') grp = serviceSubTab === 'subcontractor' ? 'subcontractor' : 'outsourced';
              else if (activeTab === 'subcontractors') grp = 'subcontractor';
              else if (activeTab === 'service-providers') grp = 'outsourced';
              setCreateCategoryGroup(grp);
              setIsCreateCategoryModalOpen(true);
            }}
            className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 transition-all shadow-2xs cursor-pointer"
            title="Create a new Category in database"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-600" />
            <span>+ Category</span>
          </button>

          <button
            type="button"
            id="portal-quick-add-subcategory-btn"
            onClick={() => {
              let grp: 'material' | 'product' | 'service' | 'subcontractor' | 'outsourced' | 'overhead' = 'material';
              if (activeTab === 'materials-hierarchy') grp = 'material';
              else if (activeTab === 'revenue-streams' || activeTab === 'products-hierarchy') grp = revenueSubTab === 'products' ? 'product' : 'service';
              else if (activeTab === 'overheads-hierarchy') grp = 'overhead';
              else if (activeTab === 'service-categories') grp = serviceSubTab === 'subcontractor' ? 'subcontractor' : 'outsourced';
              else if (activeTab === 'subcontractors') grp = 'subcontractor';
              else if (activeTab === 'service-providers') grp = 'outsourced';
              setCreateSubCategoryGroup(grp);
              setIsCreateSubCategoryModalOpen(true);
            }}
            className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 transition-all shadow-2xs cursor-pointer"
            title="Create a new Sub-Category linked to parent category in database"
          >
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>+ Sub-Category</span>
          </button>

          {/* Universal Bulk Import Button (Excel & CSV) */}
          <button
            type="button"
            id="portal-bulk-import-btn"
            onClick={() => {
              const target: ImportEntityType =
                activeTab === 'materials-hierarchy'
                  ? 'materials'
                  : activeTab === 'revenue-streams' || activeTab === 'products-hierarchy'
                  ? 'produce'
                  : activeTab === 'service-categories'
                  ? serviceSubTab === 'subcontractor'
                    ? 'subcontractors'
                    : 'outsourced'
                  : activeTab === 'suppliers'
                  ? 'suppliers'
                  : activeTab === 'subcontractors'
                  ? 'subcontractors'
                  : activeTab === 'service-providers'
                  ? 'outsourced'
                  : 'materials';

              let currentCat: string | undefined;
              let currentSub: string | undefined;

              if (activeTab === 'materials-hierarchy') {
                if (selectedMaterialCatId) {
                  currentCat = categories.find((c) => c.id === selectedMaterialCatId)?.name;
                }
                if (selectedMaterialSubCatId) {
                  currentSub = categories.find((c) => c.id === selectedMaterialSubCatId)?.name;
                }
              } else if (activeTab === 'service-categories' && serviceSubTab === 'subcontractor') {
                if (selectedSubcontractorCatId) {
                  currentCat = categories.find((c) => c.id === selectedSubcontractorCatId)?.name;
                }
                if (selectedSubcontractorSubCatId) {
                  currentSub = categories.find((c) => c.id === selectedSubcontractorSubCatId)?.name;
                }
              } else if (activeTab === 'service-categories' && serviceSubTab === 'outsourced') {
                if (selectedOutsourcedCatId) {
                  currentCat = categories.find((c) => c.id === selectedOutsourcedCatId)?.name;
                }
                if (selectedOutsourcedSubCatId) {
                  currentSub = categories.find((c) => c.id === selectedOutsourcedSubCatId)?.name;
                }
              }

              setBulkImportConfig({
                isOpen: true,
                targetType: target,
                categoryScope: currentCat,
                subCategoryScope: currentSub
              });
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-2xs cursor-pointer border border-emerald-600"
            title="Bulk import items via Excel / CSV (Master datasets or Sub-category wise)"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Bulk Import</span>
            <span className="sm:hidden">Import</span>
          </button>

          {/* Consolidated Commands Menu Button */}
          <div className="relative">
            <button
              type="button"
              id="portal-commands-menu-btn"
              onClick={() => setIsCommandsMenuOpen(!isCommandsMenuOpen)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-[#003049] border text-xs font-medium rounded-xl transition-all shadow-2xs cursor-pointer ${
                isCommandsMenuOpen ? 'border-[#003049] ring-2 ring-[#003049]/10 bg-slate-50' : 'border-slate-200'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#003049]" />
              <span>Commands</span>
              <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform duration-150 ${isCommandsMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Consolidated Dropdown Menu with Fine Dividers and Clean Layout */}
            {isCommandsMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsCommandsMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-150">
                  {/* Category / Creation Commands */}
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Create & Structure
                  </div>

                  {activeTab === 'service-categories' && (
                    <>
                      {serviceSubTab === 'subcontractor' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setIsCommandsMenuOpen(false);
                              setCreateCategoryGroup('subcontractor');
                              setIsCreateCategoryModalOpen(true);
                            }}
                            className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#003049] rounded-lg transition-colors cursor-pointer text-left"
                          >
                            <FolderPlus className="w-3.5 h-3.5 text-[#003049]" />
                            <span>Create Subcontractor Category</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setIsCommandsMenuOpen(false);
                              setCreateSubCategoryGroup('subcontractor');
                              setCreateSubCategoryParentId(selectedSubcontractorCatId || undefined);
                              setIsCreateSubCategoryModalOpen(true);
                            }}
                            className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#003049] rounded-lg transition-colors cursor-pointer text-left"
                          >
                            <Layers className="w-3.5 h-3.5 text-[#669bbc]" />
                            <span>Create Hired Trade (Sub-Category)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setIsCommandsMenuOpen(false);
                              setAddItemPortal('subcontractors');
                              setIsAddItemModalOpen(true);
                            }}
                            className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#003049] rounded-lg transition-colors cursor-pointer text-left"
                          >
                            <Plus className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Add Hired Service Item & Rates</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setIsCommandsMenuOpen(false);
                              setCreateCategoryGroup('outsourced');
                              setIsCreateCategoryModalOpen(true);
                            }}
                            className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#003049] rounded-lg transition-colors cursor-pointer text-left"
                          >
                            <FolderPlus className="w-3.5 h-3.5 text-[#003049]" />
                            <span>Create Outsourced Category</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setIsCommandsMenuOpen(false);
                              setCreateSubCategoryGroup('outsourced');
                              setCreateSubCategoryParentId(selectedOutsourcedCatId || undefined);
                              setIsCreateSubCategoryModalOpen(true);
                            }}
                            className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#003049] rounded-lg transition-colors cursor-pointer text-left"
                          >
                            <Layers className="w-3.5 h-3.5 text-[#669bbc]" />
                            <span>Create Outsourced Sub-Category</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setIsCommandsMenuOpen(false);
                              setAddItemPortal('service-providers');
                              setIsAddItemModalOpen(true);
                            }}
                            className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#003049] rounded-lg transition-colors cursor-pointer text-left"
                          >
                            <Plus className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Add Outsourced Tariff Item</span>
                          </button>
                        </>
                      )}
                    </>
                  )}

                  {activeTab === 'materials-hierarchy' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCommandsMenuOpen(false);
                          setCreateCategoryGroup('material');
                          setIsCreateCategoryModalOpen(true);
                        }}
                        className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#003049] rounded-lg transition-colors cursor-pointer text-left"
                      >
                        <FolderPlus className="w-3.5 h-3.5 text-[#003049]" />
                        <span>Create Category</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsCommandsMenuOpen(false);
                          setCreateSubCategoryGroup('material');
                          setCreateSubCategoryParentId(selectedMaterialCatId || undefined);
                          setIsCreateSubCategoryModalOpen(true);
                        }}
                        className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#003049] rounded-lg transition-colors cursor-pointer text-left"
                      >
                        <Layers className="w-3.5 h-3.5 text-[#669bbc]" />
                        <span>Create Sub-Category</span>
                      </button>
                    </>
                  )}

                  {(activeTab === 'revenue-streams' || activeTab === 'products-hierarchy' || activeTab === 'services-hierarchy') && (
                    revenueSubTab === 'products' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCommandsMenuOpen(false);
                            setCreateCategoryGroup('product');
                            setIsCreateCategoryModalOpen(true);
                          }}
                          className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#003049] rounded-lg transition-colors cursor-pointer text-left"
                        >
                          <FolderPlus className="w-3.5 h-3.5 text-[#003049]" />
                          <span>Create Product Category</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsCommandsMenuOpen(false);
                            setCreateSubCategoryGroup('product');
                            setCreateSubCategoryParentId(selectedProductCatId || undefined);
                            setIsCreateSubCategoryModalOpen(true);
                          }}
                          className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#003049] rounded-lg transition-colors cursor-pointer text-left"
                        >
                          <Layers className="w-3.5 h-3.5 text-[#669bbc]" />
                          <span>Create Sub-Category</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCommandsMenuOpen(false);
                            setCreateCategoryGroup('service');
                            setIsCreateCategoryModalOpen(true);
                          }}
                          className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#003049] rounded-lg transition-colors cursor-pointer text-left"
                        >
                          <FolderPlus className="w-3.5 h-3.5 text-[#003049]" />
                          <span>Create Service Scope</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsCommandsMenuOpen(false);
                            setCreateSubCategoryGroup('service');
                            setCreateSubCategoryParentId(selectedServiceCatId || undefined);
                            setIsCreateSubCategoryModalOpen(true);
                          }}
                          className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#003049] rounded-lg transition-colors cursor-pointer text-left"
                        >
                          <Layers className="w-3.5 h-3.5 text-[#669bbc]" />
                          <span>Create Sub-Scope / Tariff</span>
                        </button>
                      </>
                    )
                  )}

                  {activeTab === 'projects' && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCommandsMenuOpen(false);
                        setAddItemPortal('materials-hierarchy');
                        setIsAddItemModalOpen(true);
                      }}
                      className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#003049] rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <FilePlus className="w-3.5 h-3.5 text-slate-500" />
                      <span>Add BOM Item</span>
                    </button>
                  )}

                  {activeTab === 'clients' && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCommandsMenuOpen(false);
                        setAddItemPortal('projects');
                        setIsAddItemModalOpen(true);
                      }}
                      className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#003049] rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                      <span>Add Quote / Contract</span>
                    </button>
                  )}

                  {activeTab === 'suppliers' && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCommandsMenuOpen(false);
                        setAddItemPortal('materials-hierarchy');
                        setIsAddItemModalOpen(true);
                      }}
                      className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#003049] rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <Truck className="w-3.5 h-3.5 text-slate-500" />
                      <span>Add Supplied Material</span>
                    </button>
                  )}

                  {activeTab === 'service-providers' && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCommandsMenuOpen(false);
                        setAddItemPortal('services-hierarchy');
                        setIsAddItemModalOpen(true);
                      }}
                      className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#003049] rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <DollarSign className="w-3.5 h-3.5 text-slate-500" />
                      <span>Add Tariff Rate</span>
                    </button>
                  )}

                  {activeTab === 'subcontractors' && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCommandsMenuOpen(false);
                        setAddItemPortal('subcontractors');
                        setIsAddItemModalOpen(true);
                      }}
                      className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#003049] rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <Cpu className="w-3.5 h-3.5 text-slate-500" />
                      <span>Add Labor Rate Sheet</span>
                    </button>
                  )}

                  {/* Fine divider line */}
                  <div className="my-1.5 border-t border-slate-100" />

                  {/* View Switching & CRM Grids */}
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Views & Tools
                  </div>

                  {activeTab === 'service-categories' && serviceSubTab === 'outsourced' && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCommandsMenuOpen(false);
                        setOutsourcedViewMode(outsourcedViewMode === 'hierarchy' ? 'items_table' : 'hierarchy');
                      }}
                      className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#003049] rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <Table className="w-3.5 h-3.5 text-sky-600" />
                      <span>
                        {outsourcedViewMode === 'hierarchy'
                          ? 'Switch to All Outsourced Table'
                          : 'Switch to Category Cards'}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsCommandsMenuOpen(false);
                      if (activeTab === 'service-categories') {
                        if (serviceSubTab === 'subcontractor') {
                          setActiveFXTTCard({
                            cardType: 'subcontractor',
                            cardId: 'subcontractors-catalog',
                            cardTitle: 'Hired Subcontractor Labor Rate Grid',
                            cardSubtitle: 'Hourly Rates & Volume Brackets',
                            cardTag: 'HIRED SUB'
                          });
                        } else {
                          setActiveFXTTCard({
                            cardType: 'service_provider',
                            cardId: 'outsourced-catalog',
                            cardTitle: 'Outsourced Services & Utility Tariffs',
                            cardSubtitle: 'Contract Rates & SLAs',
                            cardTag: 'OUTSOURCED'
                          });
                        }
                      } else if (activeTab === 'materials-hierarchy') {
                        setActiveFXTTCard({
                          cardType: 'material_category',
                          cardId: 'mat-all',
                          cardTitle: 'Material Catalog & Vendor Grid',
                          cardSubtitle: 'Master CRM Price Matrix',
                          cardTag: 'MATERIALS'
                        });
                      } else if (activeTab === 'revenue-streams') {
                        setActiveFXTTCard({
                          cardType: 'project',
                          cardId: 'rev-all',
                          cardTitle: revenueSubTab === 'products' ? 'Supplied Product Catalog' : 'Customer Service Tariffs',
                          cardSubtitle: 'Master Revenue Streams Grid',
                          cardTag: 'REVENUE'
                        });
                      } else if (activeTab === 'suppliers') {
                        setActiveFXTTCard({
                          cardType: 'supplier',
                          cardId: 'all-suppliers',
                          cardTitle: 'All Material Suppliers & Supplies',
                          cardSubtitle: 'Master Material Suppliers & Supplies Matrix',
                          cardTag: 'SUPPLIER PORTAL'
                        });
                      } else if (activeTab === 'service-providers') {
                        setActiveFXTTCard({
                          cardType: 'service_provider',
                          cardId: 'all-service-providers',
                          cardTitle: 'All Outsourced Service Providers',
                          cardSubtitle: 'Master Outsourced Tariffs & SLAs Matrix',
                          cardTag: 'SERVICE PROVIDERS'
                        });
                      } else if (activeTab === 'subcontractors') {
                        setActiveFXTTCard({
                          cardType: 'subcontractor',
                          cardId: 'all-subcontractors',
                          cardTitle: 'All Subcontractor Services',
                          cardSubtitle: 'Master Subcontractor Services & Labour Charges Grid',
                          cardTag: 'SUBCONTRACTOR SERVICES'
                        });
                      } else {
                        setIsCreateModalOpen(true);
                      }
                    }}
                    className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#003049] rounded-lg transition-colors cursor-pointer text-left"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-amber-600" />
                    <span>Open in FXTT CRM Grid</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsCommandsMenuOpen(false);
                      setIsCreateModalOpen(true);
                    }}
                    className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#003049] rounded-lg transition-colors cursor-pointer text-left"
                  >
                    <Palette className="w-3.5 h-3.5 text-purple-600" />
                    <span>Design Custom Portal Tile</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 4. MAIN CONTENT GRIDS */}

      {/* TAB: ENTERPRISE RESOURCES (LABOUR, MACHINERY, EQUIPMENT, TOOLS, SUBCONTRACTORS, MATERIALS) */}
      {activeTab === 'resources' && (
        <div className="space-y-4">
          {/* Executive Sub-Header & Category Filter Pills */}
          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Category Filter Pills */}
            <div className="flex items-center flex-wrap gap-1.5">
              <span className="font-bold text-slate-700 dark:text-slate-300 mr-2 flex items-center space-x-1">
                <Wrench className="w-3.5 h-3.5 text-[#003049]" />
                <span>Resource Type:</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedResourceCategory(null);
                  setSelectedResourceSubCategory(null);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  !selectedResourceCategory
                    ? 'bg-[#003049] text-white shadow-2xs font-semibold'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                All Resources ({enterpriseResources.length})
              </button>
              {resourceCategoriesData.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedResourceCategory(cat.type);
                    setSelectedResourceSubCategory(null);
                  }}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    selectedResourceCategory === cat.type
                      ? 'bg-[#003049] text-white shadow-2xs font-semibold'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="w-3 h-3 flex items-center justify-center">{cat.icon}</span>
                  <span>{cat.title} ({cat.count})</span>
                </button>
              ))}
            </div>

            {/* Right Controls: View Mode Switcher, + Register Resource */}
            <div className="flex items-center space-x-2 ml-auto">
              {/* Cards / FXTT Table Switcher */}
              <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setResourceViewMode('cards')}
                  title="Cards View"
                  className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    resourceViewMode === 'cards'
                      ? 'bg-white dark:bg-slate-700 text-[#003049] dark:text-sky-400 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Cards</span>
                </button>
                <button
                  type="button"
                  onClick={() => setResourceViewMode('table')}
                  title="FXTT Table View"
                  className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    resourceViewMode === 'table'
                      ? 'bg-white dark:bg-slate-700 text-[#003049] dark:text-sky-400 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>FXTT Table</span>
                </button>
              </div>

              {/* + Register Resource Button */}
              <button
                type="button"
                onClick={() => {
                  setEditingResource(null);
                  setIsCreateResourceModalOpen(true);
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#003049] hover:bg-[#002235] text-white rounded-lg font-medium shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#fdf0d5]" />
                <span>+ Register Resource</span>
              </button>
            </div>
          </div>

          {/* Sub-Category Filter Chips (if available) */}
          {availableResourceSubCategories.length > 0 && (
            <div className="bg-slate-50/70 dark:bg-slate-900/40 px-3 py-2 rounded-xl border border-slate-200/60 dark:border-slate-800 flex items-center flex-wrap gap-1.5 text-xs">
              <span className="font-semibold text-slate-500 text-[11px] mr-1 flex items-center space-x-1">
                <Layers className="w-3 h-3 text-[#0078d4]" />
                <span>Sub-Category:</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedResourceSubCategory(null)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  !selectedResourceSubCategory
                    ? 'bg-[#0078d4] text-white shadow-2xs font-bold'
                    : 'bg-white dark:bg-slate-800 text-slate-600 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
                }`}
              >
                All Sub-Categories
              </button>
              {availableResourceSubCategories.map((subCat) => (
                <button
                  key={subCat}
                  type="button"
                  onClick={() => setSelectedResourceSubCategory(subCat)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    selectedResourceSubCategory === subCat
                      ? 'bg-[#0078d4] text-white shadow-2xs font-bold'
                      : 'bg-white dark:bg-slate-800 text-slate-600 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {subCat}
                </button>
              ))}
            </div>
          )}

          {/* CATEGORY CARDS VIEW: Keep resources strictly inside their category cards (e.g. equipment items in equipment card) */}
          {resourceViewMode === 'cards' && !selectedResourceCategory && !searchQuery.trim() && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {resourceCategoriesData.map((cat, idx) => {
                  const defaultTheme = getRandomThemeIndex(idx + 3);
                  const style = getTileStyle(cat.id, defaultTheme.id);
                  const items = enterpriseResources.filter((r) => r.type === cat.type);

                  return (
                    <div
                      key={cat.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-xs overflow-hidden flex flex-col transition-all hover:shadow-md"
                    >
                      {/* Category Header (One-word style, no wordy descriptions) */}
                      <div
                        className="p-3 text-white flex items-center justify-between"
                        style={{ background: style.customGradient || defaultTheme.gradient }}
                      >
                        <div className="flex items-center space-x-2">
                          <span className="p-1.5 rounded-lg bg-black/20 text-white shrink-0">
                            {cat.icon}
                          </span>
                          <div>
                            <h3 className="font-bold text-sm tracking-tight text-white capitalize">{cat.title}</h3>
                            <span className="text-[10px] text-white/80 font-mono">
                              {items.length} {items.length === 1 ? 'Item' : 'Items'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedResourceCategory(cat.type);
                              setResourceViewMode('table');
                            }}
                            className="px-2 py-1 rounded text-[11px] font-semibold bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
                            title="Table"
                          >
                            Table
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingResource({ type: cat.type } as any);
                              setIsCreateResourceModalOpen(true);
                            }}
                            className="px-2 py-1 rounded text-[11px] font-semibold bg-white text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shadow-xs"
                            title="Add"
                          >
                            + Add
                          </button>
                        </div>
                      </div>

                      {/* Items List Inside Category Card */}
                      <div className="p-2.5 flex-1 divide-y divide-slate-100 dark:divide-slate-800/60 overflow-y-auto max-h-[340px]">
                        {items.length === 0 ? (
                          <div className="py-8 text-center text-slate-400">
                            <span className="text-xs">No items</span>
                          </div>
                        ) : (
                          items.map((res) => (
                            <div
                              key={res.id}
                              className="py-2 px-1.5 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-900/40 rounded-lg transition-colors group"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center space-x-1.5">
                                  <span className="font-mono text-[10px] text-slate-400 shrink-0">
                                    {res.code}
                                  </span>
                                  <span
                                    onClick={() => handleOpenItemMatrix(res)}
                                    className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate hover:text-[#0078d4] cursor-pointer"
                                    title={res.name}
                                  >
                                    {res.name}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                  {formatCurrency(res.baseRate, res.currency || 'LKR')}/{res.unit}
                                </div>
                              </div>

                              <div className="flex items-center space-x-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenItemMatrix(res)}
                                  className="px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-950/60 hover:bg-[#003049] hover:text-white text-[#003049] dark:text-sky-300 text-[11px] font-semibold border border-blue-200 dark:border-blue-900 transition-colors cursor-pointer shadow-2xs"
                                  title="Matrix"
                                >
                                  Matrix
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingResource(res);
                                    setIsCreateResourceModalOpen(true);
                                  }}
                                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                  title="Edit"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingResource(res)}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Card Summary Footer */}
                      <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Avg: {formatCurrency(cat.avgRate, 'LKR')}/{cat.unit}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedResourceCategory(cat.type)}
                          className="text-[#0078d4] hover:underline font-semibold cursor-pointer"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* FILTERED CARDS VIEW: Shown ONLY when a category is selected or search query active */}
          {resourceViewMode === 'cards' && (selectedResourceCategory || searchQuery.trim()) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs px-1">
                <div className="flex items-center space-x-2">
                  <span className="font-bold capitalize text-slate-800 dark:text-slate-200 text-sm">
                    {selectedResourceCategory ? `${selectedResourceCategory} Resources` : 'Search Results'}
                    {selectedResourceSubCategory ? ` > ${selectedResourceSubCategory}` : ''}
                  </span>
                  <span className="text-slate-400 font-mono text-xs">
                    ({filteredCategoryResources.length} items)
                  </span>
                </div>
                {(selectedResourceCategory || selectedResourceSubCategory || searchQuery.trim()) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedResourceCategory(null);
                      setSelectedResourceSubCategory(null);
                    }}
                    className="text-xs text-[#0078d4] hover:underline font-semibold cursor-pointer"
                  >
                    Reset Filter
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {filteredCategoryResources.map((res, idx) => {
                  const defaultTheme = getRandomThemeIndex(idx + 12);
                  const style = getTileStyle(res.id, defaultTheme.id);
                  return (
                    <ModernTileCard
                      key={res.id}
                      id={res.id}
                      tag={(res.type || res.category || 'RESOURCE').toUpperCase()}
                      title={res.name}
                      brief={`${res.code} • Rate: ${formatCurrency(res.baseRate, res.currency || 'LKR')}/${res.unit}`}
                      actionLabel="Matrix"
                      actionVariant="button"
                      listViewLabel="Matrix"
                      themeId={style.themeId}
                      customGradient={style.customGradient}
                      onChangeTheme={(tId, grad) => handleUpdateTileTheme(res.id, tId, grad)}
                      onEdit={() => {
                        setEditingResource(res);
                        setIsCreateResourceModalOpen(true);
                      }}
                      onDelete={() => setDeletingResource(res)}
                      onDuplicate={() => handleDuplicateResource(res)}
                      onAction={() => handleOpenItemMatrix(res)}
                      onViewListView={() => handleOpenItemMatrix(res)}
                      onClick={() => handleOpenItemMatrix(res)}
                    />
                  );
                })}

                {filteredCategoryResources.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-400 bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800">
                    <Wrench className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-semibold">No resources match your search or filter.</p>
                    <p className="text-xs text-slate-400 mt-1">Try resetting filters or click "+ Register Resource" to create one.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* FXTT TABLE VIEW: All categories and subcategories shown in FXTT Table */}
          {resourceViewMode === 'table' && (
            <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
              <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/50 flex-wrap gap-2 text-xs">
                <div className="flex items-center space-x-2">
                  <Table className="w-4 h-4 text-[#003049] dark:text-sky-400" />
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    FXTT Central Resource Registry & Rate Matrix
                  </span>
                  <span className="font-mono text-slate-500">
                    ({filteredCategoryResources.length} records shown)
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Tip: Click any <span className="font-semibold text-[#0078d4]">Resource Name</span> to view & edit price ranges and rate change audit history.
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800 text-[11px]">
                    <tr>
                      <th className="px-3.5 py-2.5">Code</th>
                      <th className="px-3.5 py-2.5">Category & Sub-Category</th>
                      <th className="px-4 py-2.5">Resource Name (Click for Ranges & History)</th>
                      <th className="px-3 py-2.5">Unit</th>
                      <th className="px-3.5 py-2.5 text-right">Base Rate (LKR)</th>
                      <th className="px-3 py-2.5 text-right">Op. Charge</th>
                      <th className="px-3.5 py-2.5 text-right">Market Benchmark</th>
                      <th className="px-3 py-2.5 text-center">Spread %</th>
                      <th className="px-3.5 py-2.5 text-center">Price Ranges / Tiers</th>
                      <th className="px-3 py-2.5 text-center">Status</th>
                      <th className="px-3.5 py-2.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredCategoryResources.map((res) => {
                      const tierCount = res.priceRanges?.length || 4;
                      const delta = res.competitorRate ? Number(res.baseRate) - Number(res.competitorRate) : 0;
                      const spread = res.competitorRate && Number(res.competitorRate) > 0
                        ? round2((delta / Number(res.competitorRate)) * 100)
                        : 0;

                      return (
                        <tr key={res.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                          {/* Code */}
                          <td className="px-3.5 py-2.5 font-mono text-[11px] font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {res.code}
                          </td>

                          {/* Category & Sub-Category */}
                          <td className="px-3.5 py-2.5">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                                {res.type || res.category}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {res.subCategory || res.category || 'General'}
                              </span>
                            </div>
                          </td>

                          {/* Resource Name: Clickable to open FXTT Price Matrix */}
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => handleOpenItemMatrix(res)}
                              className="text-left font-bold text-slate-900 dark:text-slate-100 hover:text-[#0078d4] dark:hover:text-sky-400 hover:underline flex items-center space-x-1.5 cursor-pointer group-hover:text-[#0078d4]"
                              title="Matrix"
                            >
                              <span>{res.name}</span>
                              <ExternalLink className="w-3 h-3 text-[#0078d4] opacity-40 group-hover:opacity-100 transition-opacity" />
                            </button>
                            {res.supplierName && (
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                Vendor: {res.supplierName}
                              </span>
                            )}
                          </td>

                          {/* Unit */}
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                            {res.unit}
                          </td>

                          {/* Base Rate */}
                          <td className="px-3.5 py-2.5 font-mono font-bold text-[#0078d4] dark:text-sky-400 text-right whitespace-nowrap">
                            {formatCurrency(res.baseRate, res.currency || 'LKR')}
                          </td>

                          {/* Operational Charge */}
                          <td className="px-3 py-2.5 font-mono text-slate-600 dark:text-slate-400 text-right whitespace-nowrap">
                            {res.operationalCharge ? formatCurrency(res.operationalCharge, res.currency || 'LKR') : '-'}
                          </td>

                          {/* Market Benchmark */}
                          <td className="px-3.5 py-2.5 font-mono text-slate-600 dark:text-slate-400 text-right whitespace-nowrap">
                            {res.competitorRate ? formatCurrency(res.competitorRate, res.currency || 'LKR') : '-'}
                          </td>

                          {/* Spread % */}
                          <td className="px-3 py-2.5 text-center">
                            {res.competitorRate ? (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                spread <= 0
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                              }`}>
                                {spread <= 0 ? `${spread}%` : `+${spread}%`}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>

                          {/* Price Ranges Preview */}
                          <td className="px-3.5 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenItemMatrix(res)}
                              className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-50 hover:bg-blue-100 text-[#0078d4] border border-blue-200 dark:bg-blue-950/60 dark:text-sky-300 dark:border-blue-800 transition-colors cursor-pointer"
                              title="Matrix"
                            >
                              Matrix
                            </button>
                          </td>

                          {/* Status */}
                          <td className="px-3 py-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              res.status === 'Available'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            }`}>
                              {res.status || 'Available'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-3.5 py-2.5 text-center">
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                type="button"
                                onClick={() => handleOpenItemMatrix(res)}
                                className="px-2.5 py-1 rounded bg-blue-50 hover:bg-[#003049] hover:text-white dark:bg-blue-950/60 text-[#003049] dark:text-sky-300 font-semibold text-[11px] flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                                title="Matrix"
                              >
                                <Sliders className="w-3 h-3" />
                                <span>Matrix</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingResource(res);
                                  setIsCreateResourceModalOpen(true);
                                }}
                                className="p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                                title="Edit Resource Details"
                              >
                                <Edit className="w-3 h-3" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenRangesAndChanges(res, 'changes')}
                                className="p-1 rounded bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 text-purple-600 cursor-pointer"
                                title="Rate Revision & Price History"
                              >
                                <History className="w-3 h-3" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setDeletingResource(res)}
                                className="p-1 rounded bg-red-50 hover:bg-red-100 dark:bg-red-950/60 text-red-600 cursor-pointer"
                                title="Delete Resource"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredCategoryResources.length === 0 && (
                      <tr>
                        <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                          No {selectedResourceCategory || ''} resources found matching your criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: MATERIAL CATEGORIES, SUB CATEGORIES, DEEP SPECS (3-TIER HIERARCHY) */}
      {activeTab === 'materials-hierarchy' && (
        <div className="space-y-4">
          {/* Breadcrumbs for Hierarchy Navigation */}
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center space-x-2 text-xs text-slate-600">
            <button
              onClick={() => {
                setSelectedMaterialCatId(null);
                setSelectedMaterialSubCatId(null);
              }}
              className={`hover:text-[#003049] transition-colors ${!selectedMaterialCatId ? 'font-normal text-[#003049]' : ''}`}
            >
              All Material Categories (Level 1)
            </button>

            {selectedMaterialCatId && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <button
                  onClick={() => setSelectedMaterialSubCatId(null)}
                  className={`hover:text-[#003049] transition-colors ${!selectedMaterialSubCatId ? 'font-normal text-[#003049]' : ''}`}
                >
                  {categories.find((c) => c.id === selectedMaterialCatId)?.name} (Sub-Categories)
                </button>
              </>
            )}

            {selectedMaterialSubCatId && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-normal text-[#003049]">
                  {categories.find((c) => c.id === selectedMaterialSubCatId)?.name} (Deep Specs)
                </span>
              </>
            )}
          </div>

          {/* Level 1: Categories */}
          {!selectedMaterialCatId && (
            <div>
              <div className="text-xs text-slate-500 mb-2">
                Click any category card to drill down into sub-categories, or use edit/delete/duplicate to manage catalog:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {categories
                  .filter((c) => c.group === 'material' && c.type === 'category')
                  .filter((c) => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.brief.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((cat) => {
                    const style = getTileStyle(cat.id, cat.themeId);
                    return (
                      <ModernTileCard
                        key={cat.id}
                        id={cat.id}
                        tag="MATERIAL CATEGORY"
                        title={cat.name}
                        brief={cat.brief}
                        actionLabel="VIEW SUB-CATEGORIES"
                        actionVariant="link"
                        themeId={style.themeId}
                        customGradient={style.customGradient}
                        onChangeTheme={(tId, grad) => handleUpdateTileTheme(cat.id, tId, grad)}
                        onEdit={() =>
                          handleOpenEdit('category', cat.id, {
                            title: cat.name,
                            name: cat.name,
                            brief: cat.brief
                          })
                        }
                        onDelete={() => handleOpenDelete('Category', cat.id, cat.name, 'materials-hierarchy')}
                        onDuplicate={() => handleDuplicate('category', cat.id)}
                        onAction={() => setSelectedMaterialCatId(cat.id)}
                        onViewListView={() => {
                          setActiveFXTTCard({
                            cardType: 'material_category',
                            cardId: cat.id,
                            cardTitle: cat.name,
                            cardSubtitle: cat.brief,
                            cardTag: 'MATERIAL CATEGORY'
                          });
                        }}
                      />
                    );
                  })}
              </div>
              {renderCustomTilesForTab('materials-hierarchy', 'Material Specification')}
            </div>
          )}

          {/* Level 2: Sub-Categories */}
          {selectedMaterialCatId && !selectedMaterialSubCatId && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="text-xs text-slate-500">Sub-categories for selected parent category:</div>
                  <button
                    onClick={() => {
                      setCreateSubCategoryGroup('material');
                      setCreateSubCategoryParentId(selectedMaterialCatId);
                      setIsCreateSubCategoryModalOpen(true);
                    }}
                    className="text-xs text-emerald-700 hover:text-emerald-800 flex items-center space-x-1 font-normal"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Create Sub-Category</span>
                  </button>
                  <button
                    onClick={() => {
                      setAddItemPortal('materials-hierarchy');
                      setAddItemCategoryId(selectedMaterialCatId);
                      setAddItemSubCategoryId(undefined);
                      setIsAddItemModalOpen(true);
                    }}
                    className="text-xs text-[#003049] hover:underline flex items-center space-x-1 font-normal ml-2"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Item Here</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const parentCat = categories.find((c) => c.id === selectedMaterialCatId)?.name;
                      setBulkImportConfig({
                        isOpen: true,
                        targetType: 'materials',
                        categoryScope: parentCat
                      });
                    }}
                    className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-lg flex items-center space-x-1 font-semibold ml-2 cursor-pointer shadow-2xs"
                    title="Bulk import items using Excel or CSV file"
                  >
                    <Upload className="w-3 h-3 text-emerald-700" />
                    <span>Bulk Import Items</span>
                  </button>
                </div>
                <button
                  onClick={() => setSelectedMaterialCatId(null)}
                  className="text-xs text-[#003049] flex items-center space-x-1 hover:underline"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Back to All Categories</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {categories
                  .filter((c) => c.group === 'material' && c.type === 'sub_category' && c.parentId === selectedMaterialCatId)
                  .filter((c) => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((subCat) => {
                    const style = getTileStyle(subCat.id, subCat.themeId);
                    return (
                      <ModernTileCard
                        key={subCat.id}
                        id={subCat.id}
                        tag="SUB-CATEGORY"
                        title={subCat.name}
                        brief={subCat.brief}
                        actionLabel="VIEW DEEP SPECS"
                        actionVariant="link"
                        themeId={style.themeId}
                        customGradient={style.customGradient}
                        onChangeTheme={(tId, grad) => handleUpdateTileTheme(subCat.id, tId, grad)}
                        onEdit={() =>
                          handleOpenEdit('sub_category', subCat.id, {
                            title: subCat.name,
                            name: subCat.name,
                            brief: subCat.brief
                          })
                        }
                        onDelete={() => handleOpenDelete('Sub-Category', subCat.id, subCat.name, 'materials-hierarchy')}
                        onDuplicate={() => handleDuplicate('sub_category', subCat.id)}
                        onBulkImport={() => {
                          const parentCat = categories.find((c) => c.id === selectedMaterialCatId)?.name;
                          setBulkImportConfig({
                            isOpen: true,
                            targetType: 'materials',
                            categoryScope: parentCat,
                            subCategoryScope: subCat.name
                          });
                        }}
                        onAction={() => setSelectedMaterialSubCatId(subCat.id)}
                        onViewListView={() => {
                          setActiveFXTTCard({
                            cardType: 'material_category',
                            cardId: subCat.id,
                            cardTitle: subCat.name,
                            cardSubtitle: subCat.brief,
                            cardTag: 'SUB-CATEGORY'
                          });
                        }}
                      />
                    );
                  })}
              </div>
            </div>
          )}

          {/* Level 3: Sub-Sub Categories / Deep Spec */}
          {selectedMaterialSubCatId && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="text-xs text-slate-500">Sub-sub categories & deep material specifications:</div>
                  <button
                    onClick={() => {
                      setAddItemPortal('materials-hierarchy');
                      setAddItemCategoryId(selectedMaterialCatId);
                      setAddItemSubCategoryId(selectedMaterialSubCatId);
                      setIsAddItemModalOpen(true);
                    }}
                    className="text-xs text-emerald-700 hover:text-emerald-800 flex items-center space-x-1 font-normal"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Material Item to this Sub-Category</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const parentSubCat = categories.find((c) => c.id === selectedMaterialSubCatId);
                      const parentCat = categories.find((c) => c.id === parentSubCat?.parentId)?.name;
                      setBulkImportConfig({
                        isOpen: true,
                        targetType: 'materials',
                        categoryScope: parentCat,
                        subCategoryScope: parentSubCat?.name
                      });
                    }}
                    className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-lg flex items-center space-x-1 font-semibold ml-2 cursor-pointer shadow-2xs"
                    title="Bulk import items into this sub-sub category"
                  >
                    <Upload className="w-3 h-3 text-emerald-700" />
                    <span>Bulk Import Items</span>
                  </button>
                </div>
                <button
                  onClick={() => setSelectedMaterialSubCatId(null)}
                  className="text-xs text-[#003049] flex items-center space-x-1 hover:underline"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Back to Sub-Categories</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {categories
                  .filter((c) => c.group === 'material' && c.type === 'sub_sub_category' && c.parentId === selectedMaterialSubCatId)
                  .filter((c) => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((deep) => {
                    const style = getTileStyle(deep.id, deep.themeId);
                    return (
                      <ModernTileCard
                        key={deep.id}
                        id={deep.id}
                        tag="SUB-SUB-CATEGORY"
                        title={deep.name}
                        brief={deep.brief}
                        actionLabel="BROWSE ITEMS"
                        actionVariant="link"
                        themeId={style.themeId}
                        customGradient={style.customGradient}
                        onChangeTheme={(tId, grad) => handleUpdateTileTheme(deep.id, tId, grad)}
                        onEdit={() =>
                          handleOpenEdit('sub_sub_category', deep.id, {
                            title: deep.name,
                            name: deep.name,
                            brief: deep.brief
                          })
                        }
                        onDelete={() => handleOpenDelete('Deep Spec', deep.id, deep.name, 'materials-hierarchy')}
                        onDuplicate={() => handleDuplicate('sub_sub_category', deep.id)}
                        onBulkImport={() => {
                          const parentSubCat = categories.find((c) => c.id === selectedMaterialSubCatId);
                          const parentCat = categories.find((c) => c.id === parentSubCat?.parentId)?.name;
                          setBulkImportConfig({
                            isOpen: true,
                            targetType: 'materials',
                            categoryScope: parentCat,
                            subCategoryScope: deep.name
                          });
                        }}
                        onAction={() => {
                          setActiveFXTTCard({
                            cardType: 'material_category',
                            cardId: deep.id,
                            cardTitle: deep.name,
                            cardSubtitle: deep.brief,
                            cardTag: 'DEEP MATERIAL SPEC'
                          });
                        }}
                        onViewListView={() => {
                          setActiveFXTTCard({
                            cardType: 'material_category',
                            cardId: deep.id,
                            cardTitle: deep.name,
                            cardSubtitle: deep.brief,
                            cardTag: 'DEEP MATERIAL SPEC'
                          });
                        }}
                      />
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: SERVICE CATEGORIES (SUBCONTRACTOR HIRED SERVICES & OUTSOURCED PROVIDERS) */}
      {activeTab === 'service-categories' && (
        <div className="space-y-4">
          {/* ===================== SUB-PORTAL 1: SUBCONTRACTOR (Hired Only) ===================== */}
          {serviceSubTab === 'subcontractor' && (
            <div className="space-y-4">
              {/* Breadcrumb Navigation & View Mode Toggles */}
              <div className="bg-white p-2.5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 shadow-2xs">
                <div className="flex items-center space-x-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSubcontractorCatId(null);
                      setSelectedSubcontractorSubCatId(null);
                    }}
                    className={`hover:text-[#003049] transition-colors cursor-pointer ${
                      !selectedSubcontractorCatId ? 'font-bold text-[#003049]' : ''
                    }`}
                  >
                    All Hired Subcontractor Categories (Level 1)
                  </button>

                  {selectedSubcontractorCatId && (
                    <>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <button
                        type="button"
                        onClick={() => setSelectedSubcontractorSubCatId(null)}
                        className={`hover:text-[#003049] transition-colors cursor-pointer ${
                          !selectedSubcontractorSubCatId ? 'font-bold text-[#003049]' : ''
                        }`}
                      >
                        {categories.find((c) => c.id === selectedSubcontractorCatId)?.name || 'Category'}
                      </button>
                    </>
                  )}

                  {selectedSubcontractorSubCatId && (
                    <>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-bold text-[#003049]">
                        {categories.find((c) => c.id === selectedSubcontractorSubCatId)?.name || 'Sub-Category / Trade'}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* View 1: 3-Tier Hierarchy Cards */}
              {subcontractorViewMode === 'hierarchy' && (
                <>
                  {/* LEVEL 1: Subcontractor Categories (Hired Services only) */}
                  {!selectedSubcontractorCatId && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-slate-500 font-medium">
                          Select a hired subcontractor category to drill into trades, operations, rate cards, and range matrices:
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCreateCategoryGroup('subcontractor');
                            setIsCreateCategoryModalOpen(true);
                          }}
                          className="text-xs text-[#003049] hover:underline flex items-center space-x-1 font-medium cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Subcontractor Category</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {categories
                          .filter((c) => c.group === 'subcontractor' && c.type === 'category')
                          .filter((c) => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || (c.brief && c.brief.toLowerCase().includes(searchQuery.toLowerCase())))
                          .map((cat) => {
                            const style = getTileStyle(cat.id, cat.themeId);
                            const childTradesCount = categories.filter(
                              (c) => c.group === 'subcontractor' && c.type === 'sub_category' && c.parentId === cat.id
                            ).length;
                            return (
                              <ModernTileCard
                                key={cat.id}
                                id={cat.id}
                                tag="HIRED TRADE CATEGORY"
                                title={cat.name}
                                brief={cat.brief || `${childTradesCount} hired trades & rate schedules`}
                                actionLabel="EXPLORE TRADES"
                                actionVariant="link"
                                themeId={style.themeId}
                                customGradient={style.customGradient}
                                onChangeTheme={(tId, grad) => handleUpdateTileTheme(cat.id, tId, grad)}
                                onEdit={() =>
                                  handleOpenEdit('category', cat.id, {
                                    title: cat.name,
                                    name: cat.name,
                                    brief: cat.brief
                                  })
                                }
                                onDelete={() => handleOpenDelete('Subcontractor Category', cat.id, cat.name, 'subcontractors')}
                                onDuplicate={() => handleDuplicate('category', cat.id)}
                                onAction={() => setSelectedSubcontractorCatId(cat.id)}
                                onViewListView={() => {
                                  setActiveFXTTCard({
                                    cardType: 'subcontractor',
                                    cardId: cat.id,
                                    cardTitle: cat.name,
                                    cardSubtitle: cat.brief || 'Hired Subcontractor Rate Sheet',
                                    cardTag: 'HIRED SUB'
                                  });
                                }}
                              />
                            );
                          })}
                      </div>
                      {renderCustomTilesForTab('service-categories', 'Subcontractor Trade')}
                    </div>
                  )}

                  {/* LEVEL 2: Sub-Categories / Hired Specialist Trades */}
                  {selectedSubcontractorCatId && !selectedSubcontractorSubCatId && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span className="text-xs text-slate-700 font-semibold">
                            Hired Trades under "{categories.find((c) => c.id === selectedSubcontractorCatId)?.name}":
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setCreateSubCategoryGroup('subcontractor');
                              setCreateSubCategoryParentId(selectedSubcontractorCatId);
                              setIsCreateSubCategoryModalOpen(true);
                            }}
                            className="text-xs text-emerald-700 hover:text-emerald-800 flex items-center space-x-1 font-medium cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Hired Trade Specialization</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const parentCat = categories.find((c) => c.id === selectedSubcontractorCatId)?.name;
                              setBulkImportConfig({
                                isOpen: true,
                                targetType: 'subcontractors',
                                categoryScope: parentCat
                              });
                            }}
                            className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-lg flex items-center space-x-1 font-semibold cursor-pointer shadow-2xs"
                            title="Bulk import subcontractor items into this category"
                          >
                            <Upload className="w-3 h-3 text-emerald-700" />
                            <span>Bulk Import Trade Items</span>
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedSubcontractorCatId(null)}
                          className="text-xs text-[#003049] flex items-center space-x-1 hover:underline cursor-pointer font-medium"
                        >
                          <ArrowLeft className="w-3 h-3" />
                          <span>Back to Categories</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {categories
                          .filter((c) => c.group === 'subcontractor' && c.type === 'sub_category' && c.parentId === selectedSubcontractorCatId)
                          .filter((c) => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || (c.brief && c.brief.toLowerCase().includes(searchQuery.toLowerCase())))
                          .map((subCat) => {
                            const style = getTileStyle(subCat.id, subCat.themeId);
                            const rateRangeText = subCat.minRate && subCat.maxRate
                              ? `Rate Range: $${subCat.minRate.toFixed(2)} - $${subCat.maxRate.toFixed(2)} / ${subCat.rateUnit || 'hr'}`
                              : subCat.ratePerUnit
                              ? `Base Rate: $${subCat.ratePerUnit.toFixed(2)} / ${subCat.rateUnit || 'hr'}`
                              : subCat.brief || 'Specialist hired trade';

                            return (
                              <ModernTileCard
                                key={subCat.id}
                                id={subCat.id}
                                tag="HIRED TRADE SPECIALTY"
                                title={subCat.name}
                                brief={rateRangeText}
                                actionLabel="VIEW OPERATIONS & RATES"
                                actionVariant="link"
                                themeId={style.themeId}
                                customGradient={style.customGradient}
                                onChangeTheme={(tId, grad) => handleUpdateTileTheme(subCat.id, tId, grad)}
                                onEdit={() =>
                                  handleOpenEdit('sub_category', subCat.id, {
                                    title: subCat.name,
                                    name: subCat.name,
                                    brief: subCat.brief,
                                    ratePerUnit: subCat.ratePerUnit,
                                    minRate: subCat.minRate,
                                    maxRate: subCat.maxRate,
                                    rateUnit: subCat.rateUnit
                                  })
                                }
                                onDelete={() => handleOpenDelete('Trade Specialty', subCat.id, subCat.name, 'subcontractors')}
                                onDuplicate={() => handleDuplicate('sub_category', subCat.id)}
                                onBulkImport={() => {
                                  const parentCat = categories.find((c) => c.id === selectedSubcontractorCatId)?.name;
                                  setBulkImportConfig({
                                    isOpen: true,
                                    targetType: 'subcontractors',
                                    categoryScope: parentCat,
                                    subCategoryScope: subCat.name
                                  });
                                }}
                                onAction={() => setSelectedSubcontractorSubCatId(subCat.id)}
                                onViewListView={() => {
                                  setActiveFXTTCard({
                                    cardType: 'subcontractor',
                                    cardId: subCat.id,
                                    cardTitle: subCat.name,
                                    cardSubtitle: rateRangeText,
                                    cardTag: 'HIRED TRADE'
                                  });
                                }}
                              />
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* LEVEL 3: Deep Subcontractor Operations & Direct Rates */}
                  {selectedSubcontractorSubCatId && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span className="text-xs text-slate-700 font-semibold">
                            Operations & Rate Cards for "{categories.find((c) => c.id === selectedSubcontractorSubCatId)?.name}":
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setAddItemPortal('subcontractors');
                              setIsAddItemModalOpen(true);
                            }}
                            className="text-xs text-emerald-700 hover:text-emerald-800 flex items-center space-x-1 font-medium cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Hired Operation & Rate</span>
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedSubcontractorSubCatId(null)}
                          className="text-xs text-[#003049] flex items-center space-x-1 hover:underline cursor-pointer font-medium"
                        >
                          <ArrowLeft className="w-3 h-3" />
                          <span>Back to Trades</span>
                        </button>
                      </div>

                      {categories.filter((c) => c.group === 'subcontractor' && c.type === 'sub_sub_category' && c.parentId === selectedSubcontractorSubCatId).length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
                          {categories
                            .filter((c) => c.group === 'subcontractor' && c.type === 'sub_sub_category' && c.parentId === selectedSubcontractorSubCatId)
                            .filter((c) => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || (c.brief && c.brief.toLowerCase().includes(searchQuery.toLowerCase())))
                            .map((deep) => {
                              const style = getTileStyle(deep.id, deep.themeId);
                              const rateRangeText = deep.minRate && deep.maxRate
                                ? `Rate: $${deep.ratePerUnit || deep.minRate} / ${deep.rateUnit || 'hr'} (Range: $${deep.minRate} - $${deep.maxRate})`
                                : deep.ratePerUnit
                                ? `Rate: $${deep.ratePerUnit} / ${deep.rateUnit || 'hr'}`
                                : deep.brief || 'Direct hired operation';

                              return (
                                <ModernTileCard
                                  key={deep.id}
                                  id={deep.id}
                                  tag="HIRED OPERATION RATE"
                                  title={deep.name}
                                  brief={rateRangeText}
                                  actionLabel="RATE SHEET & SPECS"
                                  actionVariant="link"
                                  themeId={style.themeId}
                                  customGradient={style.customGradient}
                                  onChangeTheme={(tId, grad) => handleUpdateTileTheme(deep.id, tId, grad)}
                                  onEdit={() =>
                                    handleOpenEdit('sub_sub_category', deep.id, {
                                      title: deep.name,
                                      name: deep.name,
                                      brief: deep.brief,
                                      ratePerUnit: deep.ratePerUnit,
                                      minRate: deep.minRate,
                                      maxRate: deep.maxRate,
                                      rateUnit: deep.rateUnit
                                    })
                                  }
                                  onDelete={() => handleOpenDelete('Operation Rate', deep.id, deep.name, 'subcontractors')}
                                  onDuplicate={() => handleDuplicate('sub_sub_category', deep.id)}
                                  onAction={() => {
                                    setActiveFXTTCard({
                                      cardType: 'subcontractor',
                                      cardId: deep.id,
                                      cardTitle: deep.name,
                                      cardSubtitle: rateRangeText,
                                      cardTag: 'HIRED SUB'
                                    });
                                  }}
                                  onViewListView={() => {
                                    setActiveFXTTCard({
                                      cardType: 'subcontractor',
                                      cardId: deep.id,
                                      cardTitle: deep.name,
                                      cardSubtitle: rateRangeText,
                                      cardTag: 'HIRED SUB'
                                    });
                                  }}
                                />
                              );
                            })}
                        </div>
                      )}

                      {/* Full Screen FXTT CRM Grid for Subcontractor Trade Operations */}
                      <FXTTCardItemsListView
                        key={`fxtt-sub-${selectedSubcontractorSubCatId}`}
                        isModal={true}
                        cardType="subcontractor"
                        cardId={selectedSubcontractorSubCatId}
                        cardTitle={categories.find((c) => c.id === selectedSubcontractorSubCatId)?.name || 'Hired Trade Operations'}
                        cardSubtitle={categories.find((c) => c.id === selectedSubcontractorSubCatId)?.brief || 'Hired Trade Operations & Direct Rate Matrix'}
                        cardTag="HIRED SUBCONTRACTOR TRADE"
                        materials={materials}
                        suppliers={suppliers}
                        outsourcedServices={outsourcedServices}
                        subcontractors={subcontractors}
                        projects={projects}
                        produceItems={produceItems}
                        onClose={() => setSelectedSubcontractorSubCatId(null)}
                        onUpdatePrice={onUpdateMaterialPrice}
                        onUpdateMaterial={onUpdateMaterial}
                        onAddSupplier={onAddSupplier}
                      />
                    </div>
                  )}
                </>
              )}

              {/* View 2: FXTT Enterprise List & Grid View for Subcontractor Services */}
              {subcontractorViewMode === 'fxtt_grid' && (
                <FXTTCardItemsListView
                  key={`fxtt-sub-grid-${selectedSubcontractorSubCatId || selectedSubcontractorCatId || 'catalog'}`}
                  isModal={true}
                  cardType="subcontractor"
                    cardId={selectedSubcontractorSubCatId || selectedSubcontractorCatId || 'subcontractors-catalog'}
                    cardTitle={
                      selectedSubcontractorSubCatId
                        ? categories.find((c) => c.id === selectedSubcontractorSubCatId)?.name || 'Subcontractor Trade Operations'
                        : selectedSubcontractorCatId
                        ? categories.find((c) => c.id === selectedSubcontractorCatId)?.name || 'Subcontractor Category Items'
                        : 'All Hired Subcontractor Services'
                    }
                    cardSubtitle={
                      selectedSubcontractorSubCatId
                        ? categories.find((c) => c.id === selectedSubcontractorSubCatId)?.brief || 'Hired Trade Operations & Direct Rate Matrix'
                        : selectedSubcontractorCatId
                        ? categories.find((c) => c.id === selectedSubcontractorCatId)?.brief || 'Hired Trades & Rates'
                        : 'Direct Hired Trade Operations & Standard Rate Schedules'
                    }
                    cardTag="HIRED SUBCONTRACTOR"
                    materials={materials}
                    suppliers={suppliers}
                    outsourcedServices={outsourcedServices}
                    subcontractors={subcontractors}
                    projects={projects}
                    produceItems={produceItems}
                    onClose={() => setSubcontractorViewMode('hierarchy')}
                    onUpdatePrice={onUpdateMaterialPrice}
                    onUpdateMaterial={onUpdateMaterial}
                    onAddSupplier={onAddSupplier}
                  />
              )}

              {/* View 2: Comprehensive Subcontractor Rates, Ranges & Items Table */}
              {subcontractorViewMode === 'items_table' && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        Direct Hired Subcontractor Trade Operations, Standard Rates & Price Ranges
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Restricted strictly to subcontractor labor and specialist services hired for projects
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAddItemPortal('subcontractors');
                          setIsAddItemModalOpen(true);
                        }}
                        className="px-2.5 py-1 bg-[#003049] hover:bg-[#002235] text-white rounded-lg text-xs font-medium flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#fdf0d5]" />
                        <span>Add Rate Line</span>
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">Trade / Service Item</th>
                          <th className="py-2.5 px-3 font-semibold">Hierarchy Category</th>
                          <th className="py-2.5 px-3 font-semibold">Billing Unit</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Standard Rate</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Rate Range (Min - Max)</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Overtime / OT</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Min Callout</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {categories
                          .filter((c) => c.group === 'subcontractor' && (c.type === 'sub_category' || c.type === 'sub_sub_category'))
                          .filter((c) => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || (c.brief && c.brief.toLowerCase().includes(searchQuery.toLowerCase())))
                          .map((item) => {
                            const parentCat = categories.find((c) => c.id === item.parentId);
                            const minR = item.minRate ?? (item.ratePerUnit ? item.ratePerUnit * 0.85 : 85);
                            const maxR = item.maxRate ?? (item.ratePerUnit ? item.ratePerUnit * 1.25 : 140);
                            const baseR = item.ratePerUnit ?? (minR + maxR) / 2;
                            const unit = item.rateUnit || 'hr';

                            return (
                              <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold text-slate-900">{item.name}</div>
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                    {parentCat ? parentCat.name : 'Subcontractor Trade'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-medium text-slate-600">
                                  per {unit}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                                  ${baseR.toFixed(2)}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
                                    ${minR.toFixed(2)} – ${maxR.toFixed(2)}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center text-slate-600 font-medium">
                                  1.5x (1.8x Sat/Sun)
                                </td>
                                <td className="py-2.5 px-3 text-center text-slate-600 font-medium">
                                  4.0 hrs
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <div className="flex items-center justify-end space-x-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveFXTTCard({
                                          cardType: 'subcontractor',
                                          cardId: item.id,
                                          cardTitle: item.name,
                                          cardSubtitle: `Rate Range: $${minR.toFixed(2)} - $${maxR.toFixed(2)} / ${unit}`,
                                          cardTag: 'HIRED SUB'
                                        });
                                      }}
                                      className="p-1 hover:bg-slate-200 rounded text-[#003049] transition-colors cursor-pointer"
                                      title="Open in Rate Sheet Grid"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenEdit(item.type, item.id, {
                                          title: item.name,
                                          name: item.name,
                                          brief: item.brief,
                                          ratePerUnit: baseR,
                                          minRate: minR,
                                          maxRate: maxR,
                                          rateUnit: unit
                                        })
                                      }
                                      className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors cursor-pointer"
                                      title="Edit Rates"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===================== SUB-PORTAL 2: OUTSOURCED (Providers & Tariffs) ===================== */}
          {serviceSubTab === 'outsourced' && (
            <div className="space-y-4">
              {/* Executive Header Bar */}
              <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-xs border border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
                      <Truck className="w-5 h-5 text-sky-400" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-base font-bold text-white tracking-tight">Outsourced</h3>
                        <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 text-[10px] font-bold uppercase tracking-wider border border-sky-400/30">
                          Tariffs
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5 font-medium">
                        <span>{categories.filter((c) => c.group === 'outsourced' && c.type === 'category').length} Categories</span>
                        <span>•</span>
                        <span>{outsourcedServices.length} Tariffs</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveFXTTCard({
                          cardType: 'outsourced',
                          cardTitle: 'Outsourced Tariffs',
                          cardSubtitle: 'Contract Rates & Brackets',
                          cardTag: 'OUTSOURCED'
                        });
                      }}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold border border-white/15 flex items-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      <Table className="w-3.5 h-3.5 text-sky-300" />
                      <span>Grid View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddItemPortal('service-providers');
                        setAddItemCategoryId(selectedOutsourcedCatId || undefined);
                        setAddItemSubCategoryId(selectedOutsourcedSubCatId || undefined);
                        setIsAddItemModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Service</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Breadcrumb Navigation & View Mode Toggles */}
              <div className="bg-white p-2.5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 shadow-2xs">
                <div className="flex items-center space-x-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOutsourcedCatId(null);
                      setSelectedOutsourcedSubCatId(null);
                    }}
                    className={`hover:text-[#003049] transition-colors cursor-pointer px-2.5 py-1 rounded-md ${
                      !selectedOutsourcedCatId ? 'bg-slate-100 font-bold text-[#003049]' : 'text-slate-600'
                    }`}
                  >
                    Categories
                  </button>

                  {selectedOutsourcedCatId && (
                    <>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <button
                        type="button"
                        onClick={() => setSelectedOutsourcedSubCatId(null)}
                        className={`hover:text-[#003049] transition-colors cursor-pointer px-2.5 py-1 rounded-md ${
                          selectedOutsourcedCatId && !selectedOutsourcedSubCatId
                            ? 'bg-slate-100 font-bold text-[#003049]'
                            : 'text-slate-600'
                        }`}
                      >
                        {categories.find((c) => c.id === selectedOutsourcedCatId)?.name || 'Subcategories'}
                      </button>
                    </>
                  )}

                  {selectedOutsourcedSubCatId && (
                    <>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="px-2.5 py-1 rounded-md bg-sky-50 font-bold text-sky-900 border border-sky-200">
                        {categories.find((c) => c.id === selectedOutsourcedSubCatId)?.name || 'Items'}
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-[11px] text-slate-600 font-semibold px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200">
                    {categories.filter((c) => c.group === 'outsourced' && c.type === 'category').length} Categories •{' '}
                    {categories.filter((c) => c.group === 'outsourced' && c.type === 'sub_category').length} Subcategories •{' '}
                    {outsourcedServices.length} Tariffs
                  </span>
                  <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setOutsourcedViewMode('hierarchy')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                        outsourcedViewMode === 'hierarchy'
                          ? 'bg-white text-[#003049] shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Cards
                    </button>
                    <button
                      type="button"
                      onClick={() => setOutsourcedViewMode('fxtt_grid')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                        outsourcedViewMode === 'fxtt_grid'
                          ? 'bg-white text-[#003049] shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Grid
                    </button>
                    <button
                      type="button"
                      onClick={() => setOutsourcedViewMode('items_table')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                        outsourcedViewMode === 'items_table'
                          ? 'bg-white text-[#003049] shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Table
                    </button>
                  </div>
                </div>
              </div>

              {/* View 1: 3-Tier Hierarchy Cards (Level 1 -> Level 2 -> Level 3) */}
              {outsourcedViewMode === 'hierarchy' && (
                <>
                  {/* LEVEL 1: ALL OUTSOURCED SERVICE CATEGORIES */}
                  {!selectedOutsourcedCatId && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                            Categories
                          </h4>
                          <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            Level 1
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCreateCategoryGroup('outsourced');
                            setIsCreateCategoryModalOpen(true);
                          }}
                          className="text-xs text-[#003049] hover:underline flex items-center space-x-1 font-semibold cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>New Category</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {categories
                          .filter((c) => c.group === 'outsourced' && c.type === 'category')
                          .filter(
                            (c) =>
                              !searchQuery ||
                              c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              (c.brief && c.brief.toLowerCase().includes(searchQuery.toLowerCase()))
                          )
                          .map((cat) => {
                            const style = getTileStyle(cat.id, cat.themeId);
                            const childSubCategories = categories.filter(
                              (c) => c.group === 'outsourced' && c.type === 'sub_category' && c.parentId === cat.id
                            );
                            const matchingServices = outsourcedServices.filter(
                              (s) =>
                                s.category.toLowerCase().includes(cat.name.toLowerCase()) ||
                                cat.name.toLowerCase().includes(s.category.toLowerCase())
                            );

                            return (
                              <ModernTileCard
                                key={cat.id}
                                id={cat.id}
                                tag="OUTSOURCED"
                                title={cat.name}
                                actionLabel="EXPLORE"
                                actionVariant="link"
                                themeId={style.themeId}
                                customGradient={style.customGradient}
                                onChangeTheme={(tId, grad) => handleUpdateTileTheme(cat.id, tId, grad)}
                                onEdit={() =>
                                  handleOpenEdit('category', cat.id, {
                                    title: cat.name,
                                    name: cat.name,
                                    brief: cat.brief
                                  })
                                }
                                onDelete={() =>
                                  handleOpenDelete('Outsourced Category', cat.id, cat.name, 'service-providers')
                                }
                                onDuplicate={() => handleDuplicate('category', cat.id)}
                                onAction={() => {
                                  setSelectedOutsourcedCatId(cat.id);
                                  setSelectedOutsourcedSubCatId(null);
                                }}
                                onViewListView={() => {
                                  setActiveFXTTCard({
                                    cardType: 'outsourced',
                                    cardId: cat.id,
                                    cardTitle: cat.name,
                                    cardSubtitle: 'Outsourced Service Tariffs',
                                    cardTag: 'OUTSOURCED'
                                  });
                                }}
                              />
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* LEVEL 2: OUTSOURCED SUB-CATEGORIES */}
                  {selectedOutsourcedCatId && !selectedOutsourcedSubCatId && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                            {categories.find((c) => c.id === selectedOutsourcedCatId)?.name}
                          </h4>
                          <span className="text-[10px] bg-sky-100 text-sky-800 px-2 py-0.5 rounded font-semibold border border-sky-200">
                            Subcategories
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              setCreateSubCategoryGroup('outsourced');
                              setCreateSubCategoryParentId(selectedOutsourcedCatId);
                              setIsCreateSubCategoryModalOpen(true);
                            }}
                            className="text-xs text-emerald-700 hover:text-emerald-800 flex items-center space-x-1 font-semibold cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>New Subcategory</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const parentCat = categories.find((c) => c.id === selectedOutsourcedCatId)?.name;
                              setBulkImportConfig({
                                isOpen: true,
                                targetType: 'outsourced',
                                categoryScope: parentCat
                              });
                            }}
                            className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-lg flex items-center space-x-1 font-semibold cursor-pointer shadow-2xs"
                            title="Bulk import outsourced service items"
                          >
                            <Upload className="w-3 h-3 text-emerald-700" />
                            <span>Import</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOutsourcedCatId(null);
                              setSelectedOutsourcedSubCatId(null);
                            }}
                            className="text-xs text-[#003049] flex items-center space-x-1 hover:underline cursor-pointer font-medium"
                          >
                            <ArrowLeft className="w-3 h-3" />
                            <span>Back</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {categories
                          .filter(
                            (c) =>
                              c.group === 'outsourced' &&
                              c.type === 'sub_category' &&
                              c.parentId === selectedOutsourcedCatId
                          )
                          .filter(
                            (c) =>
                              !searchQuery ||
                              c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              (c.brief && c.brief.toLowerCase().includes(searchQuery.toLowerCase()))
                          )
                          .map((subCat) => {
                            const style = getTileStyle(subCat.id, subCat.themeId);
                            const matchingServices = outsourcedServices.filter(
                              (s) =>
                                (s.subCategory && s.subCategory.toLowerCase().trim() === subCat.name.toLowerCase().trim()) ||
                                s.subCategoryId === subCat.id
                            );
                            const tariffBrief = subCat.rateRange
                              ? `Tariff: ${subCat.rateRange} (${matchingServices.length} items)`
                              : `${matchingServices.length} Tariffs`;

                            return (
                              <ModernTileCard
                                key={subCat.id}
                                id={subCat.id}
                                tag="SUBCATEGORY"
                                title={subCat.name}
                                actionLabel="EXPLORE"
                                actionVariant="primary"
                                themeId={style.themeId}
                                customGradient={style.customGradient}
                                onChangeTheme={(tId, grad) => handleUpdateTileTheme(subCat.id, tId, grad)}
                                onEdit={() =>
                                  handleOpenEdit('sub_category', subCat.id, {
                                    title: subCat.name,
                                    name: subCat.name,
                                    brief: subCat.brief
                                  })
                                }
                                onDelete={() =>
                                  handleOpenDelete('Outsourced Sub-Category', subCat.id, subCat.name, 'service-providers')
                                }
                                onDuplicate={() => handleDuplicate('sub_category', subCat.id)}
                                onBulkImport={() => {
                                  const parentCat = categories.find((c) => c.id === selectedOutsourcedCatId)?.name;
                                  setBulkImportConfig({
                                    isOpen: true,
                                    targetType: 'outsourced',
                                    categoryScope: parentCat,
                                    subCategoryScope: subCat.name
                                  });
                                }}
                                onAction={() => {
                                  setSelectedOutsourcedSubCatId(subCat.id);
                                }}
                                onViewListView={() => {
                                  setActiveFXTTCard({
                                    cardType: 'outsourced',
                                    cardId: subCat.id,
                                    cardTitle: subCat.name,
                                    cardTag: 'OUTSOURCED'
                                  });
                                }}
                              />
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* LEVEL 3: CARDS VIEW FOR HIRED SERVICE TARIFFS IN SELECTED SUBCATEGORY */}
                  {selectedOutsourcedSubCatId && (
                    <div className="space-y-4">
                      {(() => {
                        const activeCat = categories.find((c) => c.id === selectedOutsourcedCatId);
                        const activeSubCat = categories.find((c) => c.id === selectedOutsourcedSubCatId);
                        const currentItems = outsourcedServices.filter((s) => {
                          if (!activeSubCat) return true;
                          return (
                            (s.subCategory && s.subCategory.toLowerCase().trim() === activeSubCat.name.toLowerCase().trim()) ||
                            s.subCategoryId === activeSubCat.id
                          );
                        });

                        return (
                          <>
                            <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-slate-200">
                              <div className="flex items-center space-x-2">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                                  {activeSubCat?.name || 'Tariffs'}
                                </h4>
                                <span className="text-[10px] bg-sky-100 text-sky-800 px-2 py-0.5 rounded font-bold border border-sky-200">
                                  {currentItems.length} Tariffs
                                </span>
                              </div>

                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveFXTTCard({
                                      cardType: 'outsourced',
                                      cardId: selectedOutsourcedSubCatId,
                                      cardTitle: activeSubCat?.name || 'Outsourced Tariffs',
                                      cardTag: 'OUTSOURCED'
                                    });
                                  }}
                                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-1 rounded-lg flex items-center space-x-1 font-semibold cursor-pointer border border-slate-200"
                                >
                                  <Table className="w-3.5 h-3.5 text-sky-600" />
                                  <span>Grid View</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedOutsourcedSubCatId(null)}
                                  className="text-xs text-[#003049] flex items-center space-x-1 hover:underline cursor-pointer font-medium"
                                >
                                  <ArrowLeft className="w-3 h-3" />
                                  <span>Back</span>
                                </button>
                              </div>
                            </div>

                            {/* Service Item Cards with Rates, Ranges & Change Logs */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {currentItems.map((svc) => {
                                const isHistoryExpanded = expandedOutsourcedHistoryIds.has(svc.id);
                                const isRangesExpanded = expandedOutsourcedRangesIds.has(svc.id);

                                return (
                                  <div
                                    key={svc.id}
                                    className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:shadow-md transition-shadow space-y-3"
                                  >
                                    {/* Card Header: Service Name & Provider */}
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded">
                                          TARIFF
                                        </span>
                                        <h4 className="text-sm font-bold text-slate-900 mt-1.5">{svc.name}</h4>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded uppercase">
                                          {svc.slaLevel}
                                        </span>
                                        <div className="text-[10px] text-slate-400 mt-1">
                                          Updated: {svc.lastUpdated}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Provider & Unit Information */}
                                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 flex items-center justify-between text-xs">
                                      <div className="flex items-center space-x-2">
                                        <Building2 className="w-4 h-4 text-[#003049] shrink-0" />
                                        <div>
                                          <div className="text-[10px] uppercase font-semibold text-slate-500">
                                            Provider
                                          </div>
                                          <div className="font-bold text-slate-900">{svc.providerName}</div>
                                        </div>
                                      </div>
                                      <span className="text-[10px] bg-white border border-slate-300 text-slate-700 px-2 py-0.5 rounded font-mono uppercase">
                                        Unit: {svc.baseUnitType.replace(/_/g, ' ')}
                                      </span>
                                    </div>

                                    {/* Rate vs Benchmark */}
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-2.5">
                                        <div className="text-[10px] uppercase tracking-wider font-semibold text-blue-800">
                                          Rate
                                        </div>
                                        <div className="text-base font-extrabold text-[#003049] mt-0.5">
                                          ${svc.rate < 1 ? svc.rate.toFixed(3) : svc.rate.toFixed(2)}
                                          <span className="text-xs font-normal text-slate-500 ml-1">
                                            / {svc.baseUnitType.replace('per_', '')}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                                        <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                                          Benchmark
                                        </div>
                                        <div className="text-base font-bold text-slate-800 mt-0.5">
                                          {svc.retailPrice ? `$${svc.retailPrice < 1 ? svc.retailPrice.toFixed(3) : svc.retailPrice.toFixed(2)}` : 'N/A'}
                                          <span className="text-xs font-normal text-slate-500 ml-1">
                                            / {svc.baseUnitType.replace('per_', '')}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* RANGES: Volume Pricing Tier Rates Section */}
                                    <div className="border border-amber-200 bg-[#fdf0d5]/30 rounded-xl p-2.5 space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-1 text-xs font-bold text-amber-900">
                                          <Scale className="w-3.5 h-3.5 text-amber-700" />
                                          <span>Volume Pricing Ranges ({svc.tierRates?.length || 1} Tiers)</span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => toggleOutsourcedRanges(svc.id)}
                                          className="text-[11px] text-[#003049] hover:underline font-semibold flex items-center space-x-0.5 cursor-pointer"
                                        >
                                          <span>{isRangesExpanded ? 'Hide Ranges' : 'Inspect Ranges'}</span>
                                          <ChevronDown
                                            className={`w-3 h-3 transition-transform ${
                                              isRangesExpanded ? 'rotate-180' : ''
                                            }`}
                                          />
                                        </button>
                                      </div>

                                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                                        {svc.tierRates && svc.tierRates.length > 0 ? (
                                          svc.tierRates.map((tr, idx) => (
                                            <span
                                              key={idx}
                                              className="text-[10px] px-2 py-0.5 bg-white rounded border border-[#ecd5a8] text-[#003049] font-medium shadow-2xs"
                                            >
                                              {tr.description}: <strong className="font-bold">${tr.rate}</strong>
                                            </span>
                                          ))
                                        ) : (
                                          <span className="text-[10px] text-slate-500 italic">
                                            Flat contract rate applies across all volumes.
                                          </span>
                                        )}
                                      </div>

                                      {/* Expanded Ranges Drawer */}
                                      {isRangesExpanded && svc.tierRates && (
                                        <div className="pt-2 mt-2 border-t border-amber-200/80 space-y-1.5">
                                          <div className="text-[10px] font-bold text-amber-900 uppercase">
                                            Detailed Volume Bracket Matrix:
                                          </div>
                                          <div className="bg-white rounded-lg border border-amber-200 overflow-hidden text-[11px]">
                                            <table className="w-full text-left">
                                              <thead className="bg-amber-50/60 text-slate-600 border-b border-amber-100">
                                                <tr>
                                                  <th className="py-1 px-2 font-semibold">Volume Range</th>
                                                  <th className="py-1 px-2 font-semibold">Tier Rate</th>
                                                  <th className="py-1 px-2 font-semibold">Scope Description</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-amber-100/60">
                                                {svc.tierRates.map((tr, idx) => (
                                                  <tr key={idx}>
                                                    <td className="py-1 px-2 font-mono font-medium text-slate-900">
                                                      {tr.minVolume} {tr.maxVolume ? `- ${tr.maxVolume}` : '+'} units
                                                    </td>
                                                    <td className="py-1 px-2 font-bold text-[#003049]">
                                                      ${tr.rate}
                                                    </td>
                                                    <td className="py-1 px-2 text-slate-600">{tr.description}</td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* CHANGE LOGS: Tariff Audit History Section */}
                                    <div className="border border-slate-200 bg-slate-50/80 rounded-xl p-2.5 space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
                                          <History className="w-3.5 h-3.5 text-[#003049]" />
                                          <span>Rate Change Logs ({svc.priceHistory?.length || 0} Revisions)</span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => toggleOutsourcedHistory(svc.id)}
                                          className="text-[11px] text-[#003049] hover:underline font-semibold flex items-center space-x-0.5 cursor-pointer"
                                        >
                                          <span>{isHistoryExpanded ? 'Collapse Change Log' : 'View Change Log'}</span>
                                          <ChevronDown
                                            className={`w-3 h-3 transition-transform ${
                                              isHistoryExpanded ? 'rotate-180' : ''
                                            }`}
                                          />
                                        </button>
                                      </div>

                                      {/* Most recent revision preview */}
                                      {svc.priceHistory && svc.priceHistory.length > 0 && !isHistoryExpanded && (
                                        <div className="text-[11px] text-slate-600 flex items-center justify-between bg-white px-2 py-1 rounded border border-slate-200">
                                          <span>
                                            Latest: <strong>{svc.priceHistory[0].date}</strong> — ${svc.priceHistory[0].oldRate} → ${svc.priceHistory[0].newRate}
                                          </span>
                                          <span className="text-[10px] text-slate-500 truncate max-w-[180px]" title={svc.priceHistory[0].reason}>
                                            "{svc.priceHistory[0].reason}"
                                          </span>
                                        </div>
                                      )}

                                      {/* Full Expanded Change Logs Drawer */}
                                      {isHistoryExpanded && (
                                        <div className="pt-2 mt-2 border-t border-slate-200 space-y-2">
                                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                            {svc.priceHistory && svc.priceHistory.length > 0 ? (
                                              svc.priceHistory.map((hist) => {
                                                const diff = hist.newRate - hist.oldRate;
                                                const pct = hist.oldRate > 0 ? (diff / hist.oldRate) * 100 : 0;
                                                return (
                                                  <div
                                                    key={hist.id}
                                                    className="bg-white rounded-lg border border-slate-200 p-2 text-xs space-y-1"
                                                  >
                                                    <div className="flex items-center justify-between">
                                                      <span className="font-semibold text-slate-900">{hist.date}</span>
                                                      <span
                                                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                          diff > 0
                                                            ? 'bg-amber-100 text-amber-800'
                                                            : diff < 0
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : 'bg-slate-100 text-slate-700'
                                                        }`}
                                                      >
                                                        ${hist.oldRate} → ${hist.newRate} ({diff >= 0 ? '+' : ''}
                                                        {pct.toFixed(2)}%)
                                                      </span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-600 font-normal">
                                                      <strong>Audit Reason:</strong> {hist.reason}
                                                    </p>
                                                    {hist.updatedBy && (
                                                      <div className="text-[10px] text-slate-400">
                                                        Authorized By: {hist.updatedBy}
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })
                                            ) : (
                                              <div className="text-[11px] text-slate-400 italic">
                                                No rate changes recorded yet. Initial baseline rate active.
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                                      <div className="flex items-center space-x-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setActiveOutsourcedRateItem(svc)}
                                          className="px-2.5 py-1 bg-[#003049] hover:bg-[#002235] text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer shadow-2xs"
                                        >
                                          <DollarSign className="w-3 h-3 text-[#fdf0d5]" />
                                          <span>Rate</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setActiveOutsourcedAuditItem(svc)}
                                          className="px-2.5 py-1 bg-[#fdf0d5] hover:bg-[#fae7bc] text-[#003049] border border-[#ecd5a8] rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer"
                                        >
                                          <History className="w-3 h-3 text-[#003049]" />
                                          <span>Audit</span>
                                        </button>
                                      </div>

                                      <div className="flex items-center space-x-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveFXTTCard({
                                              cardType: 'outsourced',
                                              cardId: svc.id,
                                              cardTitle: svc.name,
                                              cardTag: 'OUTSOURCED'
                                            });
                                          }}
                                          className="text-xs text-[#003049] hover:underline font-semibold flex items-center space-x-1 cursor-pointer"
                                        >
                                          <Table className="w-3 h-3 text-sky-600" />
                                          <span>Grid</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleOpenDelete('Outsourced Service', svc.id, svc.name, 'service-providers')}
                                          className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                                          title="Delete tariff"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </>
              )}

              {/* View 2: Full Screen FXTT CRM Grid View for All Outsourced Services */}
              {outsourcedViewMode === 'fxtt_grid' && (
                <FXTTCardItemsListView
                  isModal={true}
                  cardType="outsourced"
                  cardId={selectedOutsourcedSubCatId || selectedOutsourcedCatId || 'all-outsourced'}
                  cardTitle={
                    selectedOutsourcedSubCatId
                      ? categories.find((c) => c.id === selectedOutsourcedSubCatId)?.name || 'Outsourced Services'
                      : selectedOutsourcedCatId
                      ? categories.find((c) => c.id === selectedOutsourcedCatId)?.name || 'Outsourced Category'
                      : 'All Outsourced Services'
                  }
                  cardSubtitle={
                    selectedOutsourcedSubCatId
                      ? categories.find((c) => c.id === selectedOutsourcedSubCatId)?.brief || 'Tariffs & Rates'
                      : 'Tariffs & Rates'
                  }
                  cardTag="OUTSOURCED"
                  categories={categories}
                  materials={materials}
                  suppliers={suppliers}
                  outsourcedServices={outsourcedServices}
                  subcontractors={subcontractors}
                  projects={projects}
                  produceItems={produceItems}
                  onClose={() => setOutsourcedViewMode('hierarchy')}
                  onUpdatePrice={onUpdateMaterialPrice}
                  onUpdateMaterialPrice={onUpdateMaterialPrice}
                  onUpdateMaterial={onUpdateMaterial}
                  onAddSupplier={onAddSupplier}
                  onAddOutsourcedService={onAddOutsourcedService}
                  onUpdateOutsourcedService={onUpdateOutsourcedService}
                  onDeleteOutsourcedService={onDeleteOutsourcedService}
                />
              )}

              {/* View 3: Master Tariffs, Ranges, Rates & Change Logs Data Table */}
              {outsourcedViewMode === 'items_table' && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs space-y-0">
                  {/* Table Control Header */}
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                        Tariffs & Rates Table
                      </h3>
                      <span className="text-[10px] bg-sky-100 text-sky-800 px-2 py-0.5 rounded font-bold border border-sky-200">
                        {outsourcedServices.length} Items
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 flex-wrap">
                      {/* Category Filter Dropdown */}
                      <div className="flex items-center space-x-1 text-xs">
                        <Filter className="w-3.5 h-3.5 text-slate-500" />
                        <select
                          value={outsourcedTableCategoryFilter}
                          onChange={(e) => setOutsourcedTableCategoryFilter(e.target.value)}
                          className="text-xs bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#003049]"
                        >
                          <option value="all">All Outsourced Categories</option>
                          {Array.from(new Set(outsourcedServices.map((s) => s.category))).map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setAddItemPortal('service-providers');
                          setAddItemCategoryId(
                            selectedOutsourcedCatId ||
                            (outsourcedTableCategoryFilter !== 'all' ? categories.find((c) => c.name === outsourcedTableCategoryFilter)?.id : undefined)
                          );
                          setAddItemSubCategoryId(selectedOutsourcedSubCatId || undefined);
                          setIsAddItemModalOpen(true);
                        }}
                        className="px-2.5 py-1 bg-[#003049] hover:bg-[#002235] text-white rounded-lg text-xs font-medium flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#fdf0d5]" />
                        <span>Add Outsourced Item</span>
                      </button>
                    </div>
                  </div>

                  {/* Main Data Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-100/80 text-[11px] uppercase tracking-wider text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">Service Item & Provider</th>
                          <th className="py-2.5 px-3 font-semibold">Category & Sub-Category</th>
                          <th className="py-2.5 px-3 font-semibold">Billing Unit</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Contract Hired Rate</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Retail Benchmark</th>
                          <th className="py-2.5 px-3 font-semibold">Volume Pricing Ranges</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Change Logs</th>
                          <th className="py-2.5 px-3 font-semibold text-center">SLA & Updated</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {outsourcedServices
                          .filter((s) => {
                            if (
                              outsourcedTableCategoryFilter !== 'all' &&
                              s.category !== outsourcedTableCategoryFilter
                            )
                              return false;
                            if (searchQuery) {
                              const q = searchQuery.toLowerCase();
                              return (
                                s.name.toLowerCase().includes(q) ||
                                s.providerName.toLowerCase().includes(q) ||
                                s.category.toLowerCase().includes(q) ||
                                s.subCategory.toLowerCase().includes(q) ||
                                (s.moreSubCategory && s.moreSubCategory.toLowerCase().includes(q)) ||
                                s.baseUnitType.toLowerCase().includes(q)
                              );
                            }
                            return true;
                          })
                          .map((service) => {
                            const isHistoryOpen = expandedOutsourcedHistoryIds.has(service.id);
                            const isRangesOpen = expandedOutsourcedRangesIds.has(service.id);

                            return (
                              <React.Fragment key={service.id}>
                                <tr className="hover:bg-slate-50/80 transition-colors">
                                  {/* 1. Service Name & Provider */}
                                  <td className="py-2.5 px-3 align-top max-w-[240px]">
                                    <div className="font-bold text-slate-900">{service.name}</div>
                                    <div className="text-[11px] text-[#003049] font-medium flex items-center space-x-1 mt-0.5">
                                      <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span>Provider: {service.providerName}</span>
                                    </div>
                                    {service.moreSubCategory && (
                                      <div className="text-[10px] text-slate-500 italic mt-0.5 truncate">
                                        {service.moreSubCategory}
                                      </div>
                                    )}
                                  </td>

                                  {/* 2. Category & Sub-Category */}
                                  <td className="py-2.5 px-3 align-top max-w-[220px]">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                                      {service.category}
                                    </span>
                                    <div className="text-[11px] text-slate-700 font-medium mt-1">
                                      {service.subCategory}
                                    </div>
                                  </td>

                                  {/* 3. Billing Unit */}
                                  <td className="py-2.5 px-3 align-top whitespace-nowrap">
                                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-mono uppercase border border-slate-200">
                                      {service.baseUnitType.replace(/_/g, ' ')}
                                    </span>
                                  </td>

                                  {/* 4. Contract Hired Rate */}
                                  <td className="py-2.5 px-3 align-top text-right whitespace-nowrap">
                                    <div className="font-bold text-[#003049] text-sm">
                                      ${service.rate < 1 ? service.rate.toFixed(3) : service.rate.toFixed(2)}
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                      / {service.baseUnitType.replace('per_', '')}
                                    </div>
                                  </td>

                                  {/* 5. Retail Benchmark */}
                                  <td className="py-2.5 px-3 align-top text-right whitespace-nowrap">
                                    <div className="font-semibold text-slate-700">
                                      {service.retailPrice
                                        ? `$${service.retailPrice < 1 ? service.retailPrice.toFixed(3) : service.retailPrice.toFixed(2)}`
                                        : '—'}
                                    </div>
                                    <div className="text-[10px] text-slate-400">Benchmark</div>
                                  </td>

                                  {/* 6. Volume Pricing Ranges */}
                                  <td className="py-2.5 px-3 align-top max-w-[220px]">
                                    <div className="space-y-1">
                                      {service.tierRates && service.tierRates.length > 0 ? (
                                        service.tierRates.slice(0, 2).map((tr, idx) => (
                                          <div
                                            key={idx}
                                            className="text-[10px] px-1.5 py-0.5 bg-[#fdf0d5] text-[#003049] rounded border border-[#ecd5a8] truncate"
                                            title={`${tr.description}: $${tr.rate}`}
                                          >
                                            {tr.description}: <strong>${tr.rate}</strong>
                                          </div>
                                        ))
                                      ) : (
                                        <span className="text-[10px] text-slate-400 italic">Flat rate</span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => toggleOutsourcedRanges(service.id)}
                                        className="text-[10px] text-[#003049] hover:underline font-semibold flex items-center space-x-1"
                                      >
                                        <Scale className="w-2.5 h-2.5 text-amber-700" />
                                        <span>
                                          {isRangesOpen ? 'Hide Tiers' : `View All Ranges (${service.tierRates?.length || 1})`}
                                        </span>
                                      </button>
                                    </div>
                                  </td>

                                  {/* 7. Change Logs */}
                                  <td className="py-2.5 px-3 align-top text-center whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => toggleOutsourcedHistory(service.id)}
                                      className="inline-flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                                      title="Click to toggle full historical rate change logs"
                                    >
                                      <History className="w-3 h-3 text-amber-600" />
                                      <span>{service.priceHistory?.length || 0} Revisions</span>
                                      <ChevronDown
                                        className={`w-3 h-3 transition-transform ${isHistoryOpen ? 'rotate-180' : ''}`}
                                      />
                                    </button>
                                    {service.priceHistory && service.priceHistory[0] && (
                                      <div className="text-[10px] text-slate-500 mt-1">
                                        Last: {service.priceHistory[0].date}
                                      </div>
                                    )}
                                  </td>

                                  {/* 8. SLA & Updated */}
                                  <td className="py-2.5 px-3 align-top text-center whitespace-nowrap">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      {service.slaLevel}
                                    </span>
                                    <div className="text-[10px] text-slate-500 mt-1">
                                      {service.lastUpdated}
                                    </div>
                                  </td>

                                  {/* 9. Actions */}
                                  <td className="py-2.5 px-3 align-top text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end space-x-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setActiveOutsourcedRateItem(service)}
                                        className="p-1 px-2 bg-[#003049] hover:bg-[#002235] text-white rounded text-[11px] font-medium flex items-center space-x-1 transition-colors cursor-pointer shadow-2xs"
                                        title="Change contract rate and ranges"
                                      >
                                        <DollarSign className="w-3 h-3 text-[#fdf0d5]" />
                                        <span>Rate</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setActiveOutsourcedAuditItem(service)}
                                        className="p-1 px-2 bg-[#fdf0d5] hover:bg-[#fae7bc] text-[#003049] border border-[#ecd5a8] rounded text-[11px] font-semibold flex items-center space-x-1 transition-colors cursor-pointer"
                                        title="View comprehensive audit changelog"
                                      >
                                        <History className="w-3 h-3 text-[#003049]" />
                                        <span>Audit</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveFXTTCard({
                                            cardType: 'outsourced',
                                            cardId: service.id,
                                            cardTitle: service.name,
                                            cardSubtitle: `$${service.rate} / ${service.baseUnitType} • ${service.providerName}`,
                                            cardTag: 'OUTSOURCED'
                                          });
                                        }}
                                        className="p-1 hover:bg-slate-200 rounded text-[#003049] transition-colors cursor-pointer"
                                        title="Open in FXTT Grid"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>

                                {/* INLINE EXPANDED ROW: RANGES & CHANGE LOGS FOR THIS ITEM */}
                                {(isHistoryOpen || isRangesOpen) && (
                                  <tr key={`${service.id}-expanded-details`} className="bg-slate-50 border-b border-slate-200">
                                    <td colSpan={9} className="p-3">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
                                        {/* Left Panel: Volume Pricing Ranges */}
                                        <div className="space-y-2 border-b md:border-b-0 md:border-r border-slate-200 pb-3 md:pb-0 md:pr-4">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-1.5 text-xs font-bold text-[#003049]">
                                              <Scale className="w-3.5 h-3.5 text-amber-600" />
                                              <span>Contract Volume Pricing Ranges</span>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => setActiveOutsourcedRangesItem(service)}
                                              className="text-[11px] text-blue-700 hover:underline font-semibold cursor-pointer"
                                            >
                                              Open Simulator & Calculator
                                            </button>
                                          </div>

                                          <div className="overflow-hidden rounded-lg border border-slate-200">
                                            <table className="w-full text-left text-xs">
                                              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[10px] uppercase">
                                                <tr>
                                                  <th className="py-1 px-2 font-semibold">Tier Bracket</th>
                                                  <th className="py-1 px-2 font-semibold">Unit Rate</th>
                                                  <th className="py-1 px-2 font-semibold">Scope Description</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-100 text-[11px]">
                                                {service.tierRates && service.tierRates.length > 0 ? (
                                                  service.tierRates.map((t, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50">
                                                      <td className="py-1 px-2 font-mono font-semibold text-slate-800">
                                                        {t.minVolume} {t.maxVolume ? `- ${t.maxVolume}` : '+'} units
                                                      </td>
                                                      <td className="py-1 px-2 font-bold text-[#003049]">
                                                        ${t.rate} / {service.baseUnitType.replace('per_', '')}
                                                      </td>
                                                      <td className="py-1 px-2 text-slate-600">{t.description}</td>
                                                    </tr>
                                                  ))
                                                ) : (
                                                  <tr>
                                                    <td colSpan={3} className="py-2 px-2 text-slate-400 italic">
                                                      Flat rate schedule: ${service.rate} / {service.baseUnitType}
                                                    </td>
                                                  </tr>
                                                )}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>

                                        {/* Right Panel: Historical Change Logs */}
                                        <div className="space-y-2">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-1.5 text-xs font-bold text-[#003049]">
                                              <History className="w-3.5 h-3.5 text-amber-600" />
                                              <span>Tariff Rate Change Logs & Audit History</span>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => setActiveOutsourcedAuditItem(service)}
                                              className="text-[11px] text-blue-700 hover:underline font-semibold cursor-pointer"
                                            >
                                              Full Audit Modal
                                            </button>
                                          </div>

                                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                            {service.priceHistory && service.priceHistory.length > 0 ? (
                                              service.priceHistory.map((hist) => {
                                                const diff = hist.newRate - hist.oldRate;
                                                const pct = hist.oldRate > 0 ? (diff / hist.oldRate) * 100 : 0;
                                                return (
                                                  <div
                                                    key={hist.id}
                                                    className="bg-slate-50 rounded-lg border border-slate-200 p-2 text-xs space-y-0.5"
                                                  >
                                                    <div className="flex items-center justify-between">
                                                      <span className="font-bold text-slate-800">{hist.date}</span>
                                                      <span
                                                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                                          diff > 0
                                                            ? 'bg-amber-100 text-amber-900'
                                                            : diff < 0
                                                            ? 'bg-emerald-100 text-emerald-900'
                                                            : 'bg-slate-200 text-slate-700'
                                                        }`}
                                                      >
                                                        ${hist.oldRate} → ${hist.newRate} ({diff >= 0 ? '+' : ''}
                                                        {pct.toFixed(2)}%)
                                                      </span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-600">
                                                      <strong className="text-slate-700">Reason:</strong> {hist.reason}
                                                    </div>
                                                    {hist.updatedBy && (
                                                      <div className="text-[10px] text-slate-400">
                                                        Authorized by: {hist.updatedBy}
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })
                                            ) : (
                                              <div className="text-slate-400 italic text-xs py-2">
                                                No rate changes logged yet.
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB: REVENUE STREAMS (PRODUCTS SUPPLIED & SERVICES RENDERED TO CUSTOMERS) */}
      {(activeTab === 'revenue-streams' || activeTab === 'products-hierarchy' || activeTab === 'services-hierarchy') && (
        <>
          {/* SUB-PORTAL: ALL REVENUE RECORDS (PRODUCTS & SERVICES) */}
          {revenueSubTab === 'all_records' && (
            <div className="space-y-4">
              {/* Telemetry Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-2xs">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Deliverables</div>
                  <div className="text-xl font-bold text-[#003049] dark:text-sky-400 mt-1">{combinedAllRevenueRecords.length}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Commercial catalog items</div>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-2xs">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Manufactured Products</div>
                  <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                    {combinedAllRevenueRecords.filter(r => r.type === 'product').length}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Physical deliverables</div>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-2xs">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Customer Services</div>
                  <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {combinedAllRevenueRecords.filter(r => r.type === 'service').length}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Billable scopes & tariffs</div>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-2xs">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Avg Margin Spread</div>
                  <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                    {(() => {
                      const validMargins = combinedAllRevenueRecords
                        .filter(r => r.retailPrice > 0 && r.costPrice > 0)
                        .map(r => ((r.retailPrice - r.costPrice) / r.retailPrice) * 100);
                      if (validMargins.length === 0) return '35.0%';
                      const avg = validMargins.reduce((a, b) => a + b, 0) / validMargins.length;
                      return `${avg.toFixed(1)}%`;
                    })()}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Profit margin benchmark</div>
                </div>
              </div>

              {/* Controls bar: Type filter, Category filter, and Action buttons */}
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-500">Filter Type:</span>
                  <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setRevenueTableTypeFilter('all')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                        revenueTableTypeFilter === 'all'
                          ? 'bg-white dark:bg-slate-700 text-[#003049] dark:text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      All ({combinedAllRevenueRecords.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRevenueTableTypeFilter('product')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                        revenueTableTypeFilter === 'product'
                          ? 'bg-white dark:bg-slate-700 text-[#003049] dark:text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      Products ({combinedAllRevenueRecords.filter(r => r.type === 'product').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRevenueTableTypeFilter('service')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                        revenueTableTypeFilter === 'service'
                          ? 'bg-white dark:bg-slate-700 text-[#003049] dark:text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      Services ({combinedAllRevenueRecords.filter(r => r.type === 'service').length})
                    </button>
                  </div>

                  <span className="text-slate-300 dark:text-slate-700">|</span>

                  <select
                    value={revenueTableCategoryFilter}
                    onChange={(e) => setRevenueTableCategoryFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="all">All Categories</option>
                    {Array.from(new Set(combinedAllRevenueRecords.map((r) => r.category).filter(Boolean))).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAddItemPortal('products-hierarchy');
                      setAddItemCategoryId(
                        selectedProductCatId ||
                        (revenueTableCategoryFilter !== 'all' ? categories.find((c) => c.name === revenueTableCategoryFilter)?.id : undefined)
                      );
                      setAddItemSubCategoryId(selectedProductSubCatId || undefined);
                      setIsAddItemModalOpen(true);
                    }}
                    className="flex items-center space-x-1 px-2.5 py-1.5 bg-[#003049] hover:bg-[#002235] text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#fdf0d5]" />
                    <span>+ Add Product</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddItemPortal('revenue');
                      setAddItemCategoryId(
                        revenueTableCategoryFilter !== 'all' ? categories.find((c) => c.name === revenueTableCategoryFilter)?.id : undefined
                      );
                      setAddItemSubCategoryId(undefined);
                      setIsAddItemModalOpen(true);
                    }}
                    className="flex items-center space-x-1 px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-white" />
                    <span>+ Add Revenue Item</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFXTTCard({
                        cardType: 'product_category',
                        cardId: 'rev-all-grid',
                        cardTitle: 'Revenue Deliverables Matrix',
                        cardSubtitle: 'Full Master Revenue Streams & Deliverables Grid',
                        cardTag: 'REVENUE PORTAL'
                      });
                    }}
                    className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-amber-600" />
                    <span>FXTT Grid</span>
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                    <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Code</th>
                        <th className="py-2.5 px-3 font-semibold">Deliverable / Product</th>
                        <th className="py-2.5 px-3 font-semibold">Type</th>
                        <th className="py-2.5 px-3 font-semibold">Category</th>
                        <th className="py-2.5 px-3 font-semibold">Sub-Category</th>
                        <th className="py-2.5 px-3 font-semibold text-center">Unit</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Cost Rate</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Retail / Billable</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Margin %</th>
                        <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {combinedAllRevenueRecords
                        .filter((item) => {
                          if (revenueTableTypeFilter !== 'all' && item.type !== revenueTableTypeFilter) return false;
                          if (revenueTableCategoryFilter !== 'all' && item.category !== revenueTableCategoryFilter) return false;
                          if (!searchQuery) return true;
                          const q = searchQuery.toLowerCase();
                          return (
                            item.name?.toLowerCase().includes(q) ||
                            item.code?.toLowerCase().includes(q) ||
                            item.category?.toLowerCase().includes(q) ||
                            item.subCategory?.toLowerCase().includes(q)
                          );
                        })
                        .map((item) => {
                          const marginPct = item.retailPrice > 0
                            ? (((item.retailPrice - item.costPrice) / item.retailPrice) * 100).toFixed(1)
                            : '0.0';
                          return (
                            <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="py-2.5 px-3 font-mono font-bold text-[#003049] dark:text-sky-400">
                                {item.code}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-900 dark:text-slate-100">{item.name}</div>
                                <div className="text-[10px] text-slate-400">{item.source}</div>
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                    item.type === 'product'
                                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                  }`}
                                >
                                  {item.type}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{item.category}</td>
                              <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{item.subCategory || '—'}</td>
                              <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-500">{item.unit}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-300">
                                ${Number(item.costPrice).toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-[#003049] dark:text-sky-400">
                                ${Number(item.retailPrice).toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                                    Number(marginPct) >= 30
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                      : Number(marginPct) >= 15
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  }`}
                                >
                                  {marginPct}%
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                  {item.status || 'Active'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="flex items-center justify-end space-x-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveFXTTCard({
                                        cardType: 'product_category',
                                        cardId: item.id,
                                        cardTitle: item.name,
                                        cardSubtitle: `${item.code} • ${item.category} • Cost $${item.costPrice} / Sell $${item.retailPrice}`,
                                        cardTag: item.type === 'product' ? 'PRODUCT DELIVERABLE' : 'COMMERCIAL SERVICE'
                                      });
                                    }}
                                    className="p-1 px-2 bg-slate-100 hover:bg-[#0078d4] hover:text-white rounded text-[11px] font-medium text-slate-700 transition-colors cursor-pointer"
                                    title="Open in FXTT Grid"
                                  >
                                    FXTT
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleOpenEdit(
                                        item.type === 'product' ? 'produce' : 'revenue',
                                        item.id,
                                        {
                                          name: item.name,
                                          title: item.name,
                                          code: item.code,
                                          category: item.category,
                                          subCategory: item.subCategory,
                                          unit: item.unit,
                                          retailPrice: item.retailPrice,
                                          costPrice: item.costPrice
                                        }
                                      );
                                    }}
                                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 cursor-pointer"
                                    title="Edit Deliverable"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDelete('Revenue Deliverable', item.id, item.name, 'revenue-streams')}
                                    className="p-1 hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-600 rounded cursor-pointer"
                                    title="Delete Record"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      {combinedAllRevenueRecords.length === 0 && (
                        <tr>
                          <td colSpan={11} className="py-8 text-center text-slate-400">
                            No revenue records found in the database. Use "+ Add Product" or "+ Add Revenue Item" to create one.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SUB-PORTAL: PRODUCTS (Product categories which we supply) */}
          {/* SUB-PORTAL: PRODUCTS (Manufactured Products Supplied to Customers) */}
          {revenueSubTab === 'products' && (() => {
            const map = new Map<string, any>();
            const seenNames = new Set<string>();

            // Combine produceItems and product revenue items
            const rawProducts = [
              ...produceItems.filter((p) => !p.type || p.type === 'product').map((p) => ({
                id: p.id,
                code: p.code,
                name: p.name,
                category: p.category || 'Manufactured Deliverables',
                subCategory: p.subCategory || 'General Product',
                unit: p.unit || 'pcs',
                costPrice: Number(p.costPrice) || 0,
                retailPrice: Number(p.retailPrice) || 0,
                leadTimeDays: p.leadTimeDays || 30,
                status: p.status || 'Active',
                specifications: p.specifications,
                brief: p.specifications || `${p.category || 'Product'} • Cost $${(Number(p.costPrice) || 0).toLocaleString()} • Quoted $${(Number(p.retailPrice) || 0).toLocaleString()}`,
                themeId: p.themeId || 'airbus-cobalt',
                customGradient: p.customGradient,
                source: 'produce'
              })),
              ...revenueItems.filter((r) => !r.type || r.type === 'product').map((r) => ({
                id: r.id,
                code: r.code || `PRD-${r.id.slice(0, 5)}`,
                name: r.name,
                category: r.category || 'Manufactured Deliverables',
                subCategory: r.subCategory || 'General Product',
                unit: r.unit || 'pcs',
                costPrice: Number(r.costPrice) || 0,
                retailPrice: Number(r.defaultRate) || 0,
                leadTimeDays: 30,
                status: r.status || 'Active',
                specifications: r.description,
                brief: r.description || `${r.category || 'Product'} • Cost $${(Number(r.costPrice) || 0).toLocaleString()} • Quoted $${(Number(r.defaultRate) || 0).toLocaleString()}`,
                themeId: r.themeId || 'pacific-sky',
                customGradient: r.customGradient,
                source: 'revenue'
              }))
            ];

            // Sort non-suffixed base codes first (e.g. PRD-SYS-7030 before PRD-SYS-7030-790)
            rawProducts.sort((a, b) => {
              const aSuff = /-\d{3}$/.test(a.code || '') ? 1 : 0;
              const bSuff = /-\d{3}$/.test(b.code || '') ? 1 : 0;
              return aSuff - bSuff;
            });

            rawProducts.forEach((p) => {
              const baseCode = (p.code || p.id || '').replace(/-\d{3}$/, '').trim().toLowerCase();
              const nameKey = (p.name || '').trim().toLowerCase();

              if (!map.has(baseCode) && !seenNames.has(nameKey)) {
                map.set(baseCode, p);
                seenNames.add(nameKey);
              }
            });
            const allSuppliedProducts = Array.from(map.values());
            const productCategories = Array.from(new Set(allSuppliedProducts.map((p) => p.category).filter(Boolean)));
            const filteredProducts = allSuppliedProducts
              .filter((p) => productCategoryFilter === 'all' || p.category.toLowerCase() === productCategoryFilter.toLowerCase())
              .filter((p) => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.code.toLowerCase().includes(searchQuery.toLowerCase()) || p.category.toLowerCase().includes(searchQuery.toLowerCase()));

            return (
              <div className="space-y-4">
                {/* Portal Header: Breadcrumbs & View Switcher */}
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                  <div className="flex items-center space-x-2 flex-wrap">
                    <span className="font-bold text-[#003049] flex items-center space-x-1.5">
                      <Package className="w-4 h-4 text-[#0077b6]" />
                      <span>Manufactured Products & Commercial Deliverables</span>
                    </span>
                    <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {allSuppliedProducts.length} Products
                    </span>
                    {productCategoryFilter !== 'all' && (
                      <span className="bg-slate-100 text-slate-700 text-[10px] font-medium px-2 py-0.5 rounded-full">
                        Category: {productCategoryFilter}
                      </span>
                    )}
                  </div>

                  {/* View Mode Switcher */}
                  <div className="flex items-center space-x-1.5">
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                      <button
                        type="button"
                        onClick={() => setProductViewMode('hierarchy')}
                        className={`px-2.5 py-1 rounded-md transition-all flex items-center space-x-1.5 cursor-pointer ${
                          productViewMode === 'hierarchy'
                            ? 'bg-white text-[#003049] font-medium shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span>Product Cards</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductViewMode('fxtt_grid')}
                        className={`px-2.5 py-1 rounded-md transition-all flex items-center space-x-1.5 cursor-pointer ${
                          productViewMode === 'fxtt_grid'
                            ? 'bg-[#0077b6] text-white font-medium shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Table className="w-3.5 h-3.5" />
                        <span>FXTT Grid</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductViewMode('items_table')}
                        className={`px-2.5 py-1 rounded-md transition-all flex items-center space-x-1.5 cursor-pointer ${
                          productViewMode === 'items_table'
                            ? 'bg-white text-[#003049] font-medium shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <ListFilter className="w-3.5 h-3.5" />
                        <span>Variants Table</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* View 1: Product Cards View (NOT Categories) */}
                {productViewMode === 'hierarchy' && (
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-500">Filter Category:</span>
                        <select
                          value={productCategoryFilter}
                          onChange={(e) => setProductCategoryFilter(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none"
                        >
                          <option value="all">All Product Categories ({allSuppliedProducts.length})</option>
                          {productCategories.map((catName) => (
                            <option key={catName} value={catName}>
                              {catName}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAddItemPortal('products-hierarchy');
                            setIsAddItemModalOpen(true);
                          }}
                          className="text-xs text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg font-semibold flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Add Product Record</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBulkImportConfig({
                              isOpen: true,
                              targetType: 'produce'
                            });
                          }}
                          className="text-xs text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg font-semibold flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                          title="Bulk import product items"
                        >
                          <Upload className="w-3.5 h-3.5 text-blue-600" />
                          <span>Bulk Import Products</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {filteredProducts.map((prod) => {
                        const style = getTileStyle(prod.id, prod.themeId || 'airbus-cobalt');
                        const marginPct = prod.retailPrice && prod.costPrice
                          ? Math.round(((prod.retailPrice - prod.costPrice) / prod.retailPrice) * 100)
                          : 25;

                        return (
                          <ModernTileCard
                            key={prod.id}
                            id={prod.id}
                            tag="MANUFACTURED PRODUCT"
                            title={prod.name}
                            brief={prod.brief || `${prod.code} • ${prod.category}`}
                            actionLabel="COMPETITOR RATES"
                            actionVariant="button"
                            themeId={style.themeId}
                            customGradient={style.customGradient}
                            onChangeTheme={(tId, grad) => handleUpdateTileTheme(prod.id, tId, grad)}
                            onEdit={() =>
                              handleOpenEdit(prod.source === 'produce' ? 'produce' : 'revenue', prod.id, {
                                title: prod.name,
                                name: prod.name,
                                code: prod.code,
                                category: prod.category,
                                subCategory: prod.subCategory,
                                costPrice: prod.costPrice,
                                retailPrice: prod.retailPrice,
                                unit: prod.unit
                              })
                            }
                            onDelete={() => handleOpenDelete('Product Deliverable', prod.id, prod.name, 'revenue-streams')}
                            onDuplicate={() => handleDuplicate(prod.source === 'produce' ? 'produce' : 'revenue', prod.id)}
                            onAction={() => {
                              setActiveFXTTCard({
                                cardType: 'produce',
                                cardId: prod.id,
                                cardTitle: prod.name,
                                cardSubtitle: `${prod.code} • Cost: $${prod.costPrice.toLocaleString()} / Quoted: $${prod.retailPrice.toLocaleString()}`,
                                cardTag: 'PRODUCT DELIVERABLE'
                              });
                            }}
                            onViewListView={() => {
                              setActiveFXTTCard({
                                cardType: 'produce',
                                cardId: prod.id,
                                cardTitle: prod.name,
                                cardSubtitle: `${prod.code} • Cost: $${prod.costPrice.toLocaleString()} / Quoted: $${prod.retailPrice.toLocaleString()}`,
                                cardTag: 'PRODUCT DELIVERABLE'
                              });
                            }}
                            listViewLabel="FXTT & Competitors"
                            extraMeta={
                              <div className="space-y-1.5 pt-1">
                                <div className="flex items-center justify-between text-[11px] text-white/95">
                                  <span className="bg-black/35 px-2 py-0.5 rounded text-[10px] font-mono">
                                    Cost: ${prod.costPrice.toLocaleString()} / {prod.unit}
                                  </span>
                                  <span className="bg-emerald-500/80 px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-2xs">
                                    Sell: ${prod.retailPrice.toLocaleString()} (+{marginPct}%)
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-white/80 pt-0.5">
                                  <span>Code: <span className="font-mono text-white font-semibold">{prod.code}</span></span>
                                  <span>Lead: {prod.leadTimeDays || 30}d</span>
                                </div>
                              </div>
                            }
                          />
                        );
                      })}
                    </div>

                    {filteredProducts.length === 0 && (
                      <div className="bg-white p-8 text-center rounded-2xl border border-slate-200">
                        <p className="text-sm font-medium text-slate-700">No manufactured products found matching filter</p>
                        <p className="text-xs text-slate-400 mt-1">Categories (such as dfcc) are managed under the Categories & Subcategories subtab. Use "+ Add Product Record" above to register product variants.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* View 2: Full-Screen Direct FXTT Grid View for All Revenue Stream Products */}
                {productViewMode === 'fxtt_grid' && (
                  <FXTTCardItemsListView
                    isModal={true}
                    cardType="produce"
                    cardId={filteredProducts[0]?.id || 'all-products'}
                    cardTitle="Supplied Product Deliverables & Competitor Benchmarks"
                    cardSubtitle="Complete Manufactured Product Deliverables & Technical Specifications"
                    cardTag="REVENUE PRODUCT PORTAL"
                    categories={categories}
                    materials={materials}
                    suppliers={suppliers}
                    outsourcedServices={outsourcedServices}
                    subcontractors={subcontractors}
                    projects={projects}
                    produceItems={produceItems}
                    onClose={() => setProductViewMode('hierarchy')}
                    onUpdatePrice={(id, price, reason) => {
                      onUpdateProduceItem?.(id, { costPrice: price, retailPrice: Math.round(price * 1.35) });
                      onUpdateMaterialPrice?.(id, price, reason);
                    }}
                    onUpdateMaterialPrice={onUpdateMaterialPrice}
                    onUpdateMaterial={onUpdateMaterial}
                    onAddSupplier={onAddSupplier}
                    onAddProduceItem={onAddProduceItem}
                    onUpdateProduceItem={onUpdateProduceItem}
                  />
                )}

                {/* View 3: Master Product & Revenue Variants Table */}
                {productViewMode === 'items_table' && (() => {
                  return (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs space-y-0">
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center space-x-2">
                            <span>Manufactured Product Variants & Revenue Deliverables</span>
                            <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">
                              {allSuppliedProducts.length} Records
                            </span>
                          </h3>
                          <p className="text-[11px] text-slate-500">
                            Complete produced product deliverables & revenue portal records supplied to customers with unique item codes, tiered volume pricing, unit cost rates, and retail pricing.
                          </p>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveFXTTCard({
                                cardType: 'produce',
                                cardId: 'all-products',
                                cardTitle: 'Supplied Product Variants',
                                cardSubtitle: 'Turnkey Manufactured Deliverables & Sub-Categories',
                                cardTag: 'PRODUCT SUB-CATEGORY'
                              });
                            }}
                            className="px-2.5 py-1 bg-[#0077b6] hover:bg-[#005f94] text-white rounded-lg text-xs font-medium flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                          >
                            <Table className="w-3.5 h-3.5 text-white" />
                            <span>Open Full Screen FXTT Grid</span>
                          </button>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-700">
                          <thead className="bg-slate-100/80 text-[11px] uppercase tracking-wider text-slate-600 border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3 font-semibold">Unique Item Code</th>
                              <th className="py-2.5 px-3 font-semibold">Product Variant Name</th>
                              <th className="py-2.5 px-3 font-semibold">Category</th>
                              <th className="py-2.5 px-3 font-semibold">Sub-Category</th>
                              <th className="py-2.5 px-3 font-semibold">Unit</th>
                              <th className="py-2.5 px-3 font-semibold text-right">Unit Cost Rate</th>
                              <th className="py-2.5 px-3 font-semibold text-right">Quoted Retail</th>
                              <th className="py-2.5 px-3 font-semibold text-center">Lead Time</th>
                              <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                              <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredProducts.map((item) => {
                              const marginPct = item.retailPrice && item.costPrice
                                ? Math.round(((item.retailPrice - item.costPrice) / item.retailPrice) * 100)
                                : 25;

                              return (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="py-2.5 px-3 font-mono font-medium text-blue-700">
                                    {item.code}
                                  </td>
                                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                                    {item.name}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-600">{item.category}</td>
                                  <td className="py-2.5 px-3 text-slate-600 font-medium">{item.subCategory}</td>
                                  <td className="py-2.5 px-3 text-slate-500 font-mono">{item.unit}</td>
                                  <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                                    ${(Number(item.costPrice) || 0).toLocaleString()}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                                    ${(Number(item.retailPrice) || 0).toLocaleString()}
                                    <span className="ml-1 text-[10px] text-emerald-600 font-normal">
                                      (+{marginPct}%)
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center text-slate-600">
                                    {item.leadTimeDays || 30} days
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800">
                                      {item.status}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveFXTTCard({
                                          cardType: 'produce',
                                          cardId: item.id,
                                          cardTitle: item.name,
                                          cardSubtitle: `${item.code} • Cost: $${item.costPrice.toLocaleString()} / Quoted: $${item.retailPrice.toLocaleString()}`,
                                          cardTag: 'PRODUCT DELIVERABLE'
                                        });
                                      }}
                                      className="px-2 py-1 bg-slate-100 hover:bg-[#0077b6] hover:text-white rounded text-[11px] font-medium text-slate-700 transition-colors cursor-pointer"
                                    >
                                      Competitors
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* SUB-PORTAL: SERVICES (Service categories we render to the customer - not others) */}
          {revenueSubTab === 'services' && (
            <div className="space-y-4">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center space-x-2 text-xs text-slate-600">
                <button
                  onClick={() => setSelectedServiceCatId(null)}
                  className={`hover:text-[#003049] transition-colors ${!selectedServiceCatId ? 'font-normal text-[#003049]' : ''}`}
                >
                  All Customer Service Categories (Level 1)
                </button>

                {selectedServiceCatId && (
                  <>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-normal text-[#003049]">
                      {categories.find((c) => c.id === selectedServiceCatId)?.name} (Tariffs & Rates)
                    </span>
                  </>
                )}
              </div>

              {!selectedServiceCatId && (
                <div>
                  <div className="text-xs text-slate-500 mb-2">
                    Click any service category we render to the customer to view billable tariff rates (not outsourced supplier costs):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {categories
                      .filter((c) => c.group === 'service' && c.type === 'category')
                      .filter((c) => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.brief.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((cat) => {
                        const style = getTileStyle(cat.id, cat.themeId);
                        return (
                          <ModernTileCard
                            key={cat.id}
                            id={cat.id}
                            tag="CUSTOMER SERVICE SCOPE"
                            title={cat.name}
                            brief={cat.brief}
                            actionLabel="VIEW TARIFF RATES"
                            actionVariant="link"
                            themeId={style.themeId}
                            customGradient={style.customGradient}
                            onChangeTheme={(tId, grad) => handleUpdateTileTheme(cat.id, tId, grad)}
                            onEdit={() =>
                              handleOpenEdit('category', cat.id, {
                                title: cat.name,
                                name: cat.name,
                                brief: cat.brief
                              })
                            }
                            onDelete={() => handleOpenDelete('Customer Service Scope', cat.id, cat.name, 'revenue-streams')}
                            onDuplicate={() => handleDuplicate('category', cat.id)}
                            onAction={() => setSelectedServiceCatId(cat.id)}
                            onViewListView={() => {
                              setActiveFXTTCard({
                                cardType: 'service_category',
                                cardId: cat.id,
                                cardTitle: cat.name,
                                cardSubtitle: cat.brief,
                                cardTag: 'CUSTOMER SERVICE SCOPE'
                              });
                            }}
                          />
                        );
                      })}
                  </div>
                </div>
              )}

              {selectedServiceCatId && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="text-xs text-slate-500">Customer service tariffs & billable scopes rendered to clients:</div>
                      <button
                        onClick={() => {
                          setCreateSubCategoryGroup('service');
                          setCreateSubCategoryParentId(selectedServiceCatId);
                          setIsCreateSubCategoryModalOpen(true);
                        }}
                        className="text-xs text-emerald-700 hover:text-emerald-800 flex items-center space-x-1 font-normal"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Create Sub-Scope / Tariff</span>
                      </button>
                      <button
                        onClick={() => {
                          setAddItemPortal('services-hierarchy');
                          setAddItemCategoryId(selectedServiceCatId);
                          setAddItemSubCategoryId(undefined);
                          setIsAddItemModalOpen(true);
                        }}
                        className="text-xs text-[#003049] hover:underline flex items-center space-x-1 font-normal ml-2"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Service Tariff</span>
                      </button>
                    </div>
                    <button
                      onClick={() => setSelectedServiceCatId(null)}
                      className="text-xs text-[#003049] flex items-center space-x-1 hover:underline"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      <span>Back to Customer Service Scopes</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {categories
                      .filter((c) => c.group === 'service' && c.type === 'sub_category' && c.parentId === selectedServiceCatId)
                      .filter((c) => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((subCat) => {
                        const style = getTileStyle(subCat.id, subCat.themeId);
                        return (
                          <ModernTileCard
                            key={subCat.id}
                            id={subCat.id}
                            tag="CUSTOMER SERVICE TARIFF"
                            title={subCat.name}
                            brief={subCat.brief}
                            actionLabel="AUDIT TARIFFS"
                            actionVariant="link"
                            themeId={style.themeId}
                            customGradient={style.customGradient}
                            onChangeTheme={(tId, grad) => handleUpdateTileTheme(subCat.id, tId, grad)}
                            onEdit={() =>
                              handleOpenEdit('sub_category', subCat.id, {
                                title: subCat.name,
                                name: subCat.name,
                                brief: subCat.brief
                              })
                            }
                            onDelete={() => handleOpenDelete('Customer Service Tariff', subCat.id, subCat.name, 'revenue-streams')}
                            onDuplicate={() => handleDuplicate('sub_category', subCat.id)}
                            onAction={() => {
                              setActiveFXTTCard({
                                cardType: 'service_category',
                                cardId: subCat.id,
                                cardTitle: subCat.name,
                                cardSubtitle: subCat.brief,
                                cardTag: 'CUSTOMER SERVICE TARIFF'
                              });
                            }}
                            onViewListView={() => {
                              setActiveFXTTCard({
                                cardType: 'service_category',
                                cardId: subCat.id,
                                cardTitle: subCat.name,
                                cardSubtitle: subCat.brief,
                                cardTag: 'CUSTOMER SERVICE TARIFF'
                              });
                            }}
                          />
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SUB-PORTAL: HIERARCHY (CATEGORIES & SUB-CATEGORIES OF REVENUE & PRODUCTS) */}
          {revenueSubTab === 'hierarchy' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Revenue & Product Hierarchy</h3>
                  <p className="text-xs text-slate-500">
                    Product categories, sub-categories, and commercial scopes connected to database
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCreateCategoryGroup('product');
                      setIsCreateCategoryModalOpen(true);
                    }}
                    className="flex items-center space-x-1 px-2.5 py-1.5 bg-[#003049] text-white text-xs font-semibold rounded-lg hover:bg-[#002235] transition-colors cursor-pointer"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-[#fdf0d5]" />
                    <span>+ Category</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateSubCategoryGroup('product');
                      setIsCreateSubCategoryModalOpen(true);
                    }}
                    className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    <span>+ Sub-Category</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {categories
                  .filter((c) => (c.group === 'product' || c.group === 'revenue' || c.group === 'service') && c.type === 'category')
                  .filter((c) => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.brief.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((cat) => {
                    const defaultTheme = cat.group === 'service' ? 'napa-purple' : 'airbus-cobalt';
                    const style = getTileStyle(cat.id, cat.themeId || defaultTheme);
                    const subCats = categories.filter((s) => s.parentId === cat.id || s.parentName === cat.name);
                    const matchingRecords = combinedAllRevenueRecords.filter(
                      (r) => r.category.toLowerCase() === cat.name.toLowerCase()
                    );
                    return (
                      <ModernTileCard
                        key={cat.id}
                        id={cat.id}
                        tag={cat.group === 'service' ? 'CUSTOMER SERVICE REVENUE' : 'PRODUCT REVENUE CATEGORY'}
                        title={cat.name}
                        brief={cat.brief || `${matchingRecords.length} commercial deliverables`}
                        actionLabel="VIEW DELIVERABLES"
                        actionVariant="button"
                        themeId={style.themeId}
                        customGradient={style.customGradient}
                        onChangeTheme={(tId, grad) => handleUpdateTileTheme(cat.id, tId, grad)}
                        onEdit={() =>
                          handleOpenEdit('category', cat.id, {
                            title: cat.name,
                            name: cat.name,
                            brief: cat.brief
                          })
                        }
                        onDelete={() => handleOpenDelete('Revenue Category', cat.id, cat.name, 'revenue-streams')}
                        onDuplicate={() => handleDuplicate('category', cat.id)}
                        onAction={() => {
                          setSelectedProductCatId(cat.id);
                          setRevenueSubTab('products');
                        }}
                        onViewListView={() => {
                          setActiveFXTTCard({
                            cardType: cat.group === 'service' ? 'service_category' : 'product_category',
                            cardId: cat.id,
                            cardTitle: cat.name,
                            cardSubtitle: cat.brief,
                            cardTag: cat.group === 'service' ? 'CUSTOMER SERVICE REVENUE' : 'PRODUCT REVENUE CATEGORY'
                          });
                        }}
                        listViewLabel="FXTT Grid"
                        extraMeta={
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-[11px] text-white/95">
                              <span className="bg-black/30 px-2 py-0.5 rounded text-[10px] font-mono">
                                {matchingRecords.length} Items • {subCats.length} Sub-Categories
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCreateSubCategoryGroup(cat.group === 'service' ? 'service' : 'product');
                                  setCreateSubCategoryParentId(cat.id);
                                  setIsCreateSubCategoryModalOpen(true);
                                }}
                                className="text-[10px] text-white hover:underline font-semibold bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded cursor-pointer transition-colors"
                              >
                                + Sub
                              </button>
                            </div>
                            {subCats.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {subCats.slice(0, 3).map((sub) => (
                                  <span
                                    key={sub.id}
                                    className="text-[9px] px-1.5 py-0.5 bg-black/35 text-white/95 rounded backdrop-blur-xs font-medium"
                                  >
                                    {sub.name}
                                  </span>
                                ))}
                                {subCats.length > 3 && (
                                  <span className="text-[9px] px-1.5 py-0.5 bg-black/45 text-white/85 rounded font-medium">
                                    +{subCats.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        }
                      />
                    );
                  })}
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB: OVERHEADS HIERARCHY & REVENUE/DIRECT COST MAPPING */}
      {activeTab === 'overheads-hierarchy' && (
        <div className="space-y-4">
          {/* Top Breadcrumb & Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200">
            <div className="flex items-center space-x-1.5 text-xs text-slate-600">
              <button
                type="button"
                onClick={() => {
                  setSelectedOverheadCatId(null);
                  setSelectedOverheadSubCatId(null);
                }}
                className={`hover:text-[#003049] transition-colors cursor-pointer ${!selectedOverheadCatId ? 'font-bold text-[#003049]' : ''}`}
              >
                All Overhead Categories (Level 1)
              </button>

              {selectedOverheadCatId && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setSelectedOverheadSubCatId(null)}
                    className={`hover:text-[#003049] transition-colors cursor-pointer ${!selectedOverheadSubCatId ? 'font-bold text-[#003049]' : ''}`}
                  >
                    {categories.find((c) => c.id === selectedOverheadCatId)?.name || 'Sub-Categories'}
                  </button>
                </>
              )}

              {selectedOverheadSubCatId && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-bold text-[#003049]">
                    {categories.find((c) => c.id === selectedOverheadSubCatId)?.name || 'Overhead Items'}
                  </span>
                </>
              )}
            </div>

            {/* View Mode & Add Record Actions */}
            <div className="flex items-center space-x-2">
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setOverheadViewMode('hierarchy')}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center space-x-1.5 cursor-pointer ${
                    overheadViewMode === 'hierarchy'
                      ? 'bg-white text-[#003049] font-medium shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Cards View</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOverheadViewMode('items_table')}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center space-x-1.5 cursor-pointer ${
                    overheadViewMode === 'items_table'
                      ? 'bg-white text-[#003049] font-medium shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ListFilter className="w-3.5 h-3.5" />
                  <span>Overhead Items Table ({overheadItems.length})</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCreateCategoryGroup('overhead');
                  setIsCreateCategoryModalOpen(true);
                }}
                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Overhead Category</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAddItemPortal('overheads-hierarchy');
                  setAddItemCategoryId(selectedOverheadCatId || undefined);
                  setAddItemSubCategoryId(selectedOverheadSubCatId || undefined);
                  setIsAddItemModalOpen(true);
                }}
                className="px-2.5 py-1 bg-[#003049] hover:bg-[#002235] text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 text-[#fdf0d5]" />
                <span>Add Overhead Item</span>
              </button>
            </div>
          </div>

          {/* View 1: Cards Hierarchy */}
          {overheadViewMode === 'hierarchy' && (
            <>
              {/* Level 1: Categories */}
              {!selectedOverheadCatId && (
                <div>
                  <div className="text-xs text-slate-500 mb-2">
                    Click any overhead category to drill down into sub-categories & items:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {categories
                      .filter((c) => c.group === 'overhead' && c.type === 'category')
                      .filter((c) => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.brief.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((cat) => {
                        const style = getTileStyle(cat.id, cat.themeId || 'amber-forge');
                        const itemsCount = overheadItems.filter((o) => o.category?.toLowerCase() === cat.name.toLowerCase()).length;

                        return (
                          <ModernTileCard
                            key={cat.id}
                            id={cat.id}
                            tag="OVERHEAD CATEGORY"
                            title={cat.name}
                            brief={cat.brief}
                            actionLabel="EXPLORE SUB-CATEGORIES"
                            actionVariant="link"
                            listViewLabel="FXTT Items View"
                            onViewListView={() => {
                              setActiveFXTTCard({
                                cardId: cat.id,
                                cardTitle: cat.name,
                                cardSubtitle: cat.brief || 'Overhead Category',
                                cardType: 'overhead',
                                cardTag: 'OVERHEAD CATEGORY'
                              });
                            }}
                            themeId={style.themeId}
                            customGradient={style.customGradient}
                            onChangeTheme={(tId, grad) => handleUpdateTileTheme(cat.id, tId, grad)}
                            onEdit={() =>
                              handleOpenEdit('category', cat.id, {
                                title: cat.name,
                                name: cat.name,
                                brief: cat.brief
                              })
                            }
                            onDelete={() => handleOpenDelete('Overhead Category', cat.id, cat.name, 'overheads-hierarchy')}
                            onDuplicate={() => handleDuplicate('category', cat.id)}
                            onAction={() => setSelectedOverheadCatId(cat.id)}
                            extraMeta={
                              <div className="flex items-center justify-between text-[11px] text-white/90 pt-1">
                                <span className="bg-black/25 px-2 py-0.5 rounded text-[10px] font-mono">
                                  {itemsCount} Overhead Items
                                </span>
                              </div>
                            }
                          />
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Level 2: Sub-Categories */}
              {selectedOverheadCatId && !selectedOverheadSubCatId && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="text-xs text-slate-500">Sub-categories for selected overhead parent:</div>
                      <button
                        onClick={() => {
                          setCreateSubCategoryGroup('overhead');
                          setCreateSubCategoryParentId(selectedOverheadCatId);
                          setIsCreateSubCategoryModalOpen(true);
                        }}
                        className="text-xs text-amber-700 hover:text-amber-800 flex items-center space-x-1 font-semibold cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Create Sub-Category</span>
                      </button>
                      <button
                        onClick={() => {
                          setAddItemPortal('overheads-hierarchy');
                          setAddItemCategoryId(selectedOverheadCatId);
                          setAddItemSubCategoryId(undefined);
                          setIsAddItemModalOpen(true);
                        }}
                        className="text-xs text-[#003049] hover:underline flex items-center space-x-1 font-normal ml-2 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Item Here</span>
                      </button>
                    </div>
                    <button
                      onClick={() => setSelectedOverheadCatId(null)}
                      className="text-xs text-[#003049] flex items-center space-x-1 hover:underline cursor-pointer"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      <span>Back to All Categories</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {categories
                      .filter((c) => c.group === 'overhead' && c.type === 'sub_category' && c.parentId === selectedOverheadCatId)
                      .filter((c) => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((subCat) => {
                        const style = getTileStyle(subCat.id, subCat.themeId || 'sunset-amber');
                        const matchingItems = overheadItems.filter(
                          (o) =>
                            (o.subCategory && o.subCategory.toLowerCase().trim() === subCat.name.toLowerCase().trim()) ||
                            o.subCategoryId === subCat.id
                        );

                        return (
                          <ModernTileCard
                            key={subCat.id}
                            id={subCat.id}
                            tag="OVERHEAD SUB-CATEGORY"
                            title={subCat.name}
                            brief={subCat.brief}
                            actionLabel="VIEW ITEMS"
                            actionVariant="link"
                            listViewLabel="FXTT Items View"
                            onViewListView={() => {
                              setActiveFXTTCard({
                                cardId: subCat.id,
                                cardTitle: subCat.name,
                                cardSubtitle: subCat.brief || 'Overhead Sub-Category',
                                cardType: 'overhead',
                                cardTag: 'OVERHEAD SUB-CATEGORY'
                              });
                            }}
                            themeId={style.themeId}
                            customGradient={style.customGradient}
                            onChangeTheme={(tId, grad) => handleUpdateTileTheme(subCat.id, tId, grad)}
                            onEdit={() =>
                              handleOpenEdit('sub_category', subCat.id, {
                                title: subCat.name,
                                name: subCat.name,
                                brief: subCat.brief
                              })
                            }
                            onDelete={() => handleOpenDelete('Overhead Sub-Category', subCat.id, subCat.name, 'overheads-hierarchy')}
                            onDuplicate={() => handleDuplicate('sub_category', subCat.id)}
                            onAction={() => setSelectedOverheadSubCatId(subCat.id)}
                            extraMeta={
                              <div className="flex items-center justify-between text-[11px] text-white/90 pt-1">
                                <span className="bg-black/25 px-2 py-0.5 rounded text-[10px] font-mono">
                                  {matchingItems.length} Allocated Items
                                </span>
                              </div>
                            }
                          />
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Level 3: Overhead Items for selected Sub-Category */}
              {selectedOverheadSubCatId && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="text-xs text-slate-500 font-semibold">
                        Items in Sub-Category: {categories.find((c) => c.id === selectedOverheadSubCatId)?.name}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAddItemPortal('overheads-hierarchy');
                          setAddItemCategoryId(selectedOverheadCatId);
                          setAddItemSubCategoryId(selectedOverheadSubCatId);
                          setIsAddItemModalOpen(true);
                        }}
                        className="text-xs text-amber-700 hover:text-amber-800 flex items-center space-x-1 font-semibold cursor-pointer ml-2"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Item to this Sub-Category</span>
                      </button>
                    </div>
                    <button
                      onClick={() => setSelectedOverheadSubCatId(null)}
                      className="text-xs text-[#003049] flex items-center space-x-1 hover:underline cursor-pointer"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      <span>Back to Sub-Categories</span>
                    </button>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-100/80 text-[11px] uppercase tracking-wider text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">Code</th>
                          <th className="py-2.5 px-3 font-semibold">Overhead Item Name</th>
                          <th className="py-2.5 px-3 font-semibold">Category</th>
                          <th className="py-2.5 px-3 font-semibold">Cost Type</th>
                          <th className="py-2.5 px-3 font-semibold">Method</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Default Rate</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {overheadItems
                          .filter((o) => {
                            const subNode = categories.find((c) => c.id === selectedOverheadSubCatId);
                            const subName = subNode?.name.toLowerCase().trim();
                            const subId = subNode?.id;
                            const oSub = (o.subCategory || '').toLowerCase().trim();
                            return (
                              (subId && o.subCategoryId === subId) ||
                              (subName && oSub === subName)
                            );
                          })
                          .map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 px-3 font-mono font-bold text-amber-700">{item.code}</td>
                              <td className="py-2.5 px-3 font-semibold text-slate-900">{item.name}</td>
                              <td className="py-2.5 px-3 text-slate-600">{item.category}</td>
                              <td className="py-2.5 px-3 capitalize text-slate-600">{item.costType?.replace(/_/g, ' ')}</td>
                              <td className="py-2.5 px-3 capitalize text-slate-500">{item.defaultCalculationMethod?.replace(/_/g, ' ')}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800">
                                {item.defaultCalculationMethod === 'percentage_of_direct' ? `${item.defaultRate}%` : formatCurrency(item.defaultRate, item.currency || 'LKR')}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                  {item.status || 'Active'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right space-x-1 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingOverheadItem(item);
                                    setIsEditOverheadModalOpen(true);
                                  }}
                                  className="p-1 rounded text-slate-500 hover:text-amber-700 hover:bg-amber-50 cursor-pointer transition-colors"
                                  title="Edit Overhead Item"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteOverheadItemDirect(item)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                                  title="Delete Overhead Item"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        {overheadItems.length === 0 && (
                          <tr>
                            <td colSpan={8} className="py-6 text-center text-slate-400">
                              No overhead items found. Click "+ Add Overhead Item" to create one.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* View 2: Complete Overhead Items Table */}
          {overheadViewMode === 'items_table' && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs space-y-0">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center space-x-2">
                    <span>Overhead Catalogue Records & Database Allocations</span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">
                      {overheadItems.length} Records
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Operating facility, indirect materials, tooling depreciation, utility, and administrative overheads synced with budget planning engine.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setAddItemPortal('overheads-hierarchy');
                    setIsAddItemModalOpen(true);
                  }}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Overhead Record</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100/80 text-[11px] uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Code</th>
                      <th className="py-2.5 px-3 font-semibold">Overhead Name</th>
                      <th className="py-2.5 px-3 font-semibold">Category</th>
                      <th className="py-2.5 px-3 font-semibold">Cost Type</th>
                      <th className="py-2.5 px-3 font-semibold">Calculation Method</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Applicable Base</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Rate</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overheadItems
                      .filter((o) => !searchQuery || o.name?.toLowerCase().includes(searchQuery.toLowerCase()) || o.code?.toLowerCase().includes(searchQuery.toLowerCase()) || o.category?.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-700">{item.code}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{item.name}</td>
                          <td className="py-2.5 px-3 text-slate-600">{item.category}</td>
                          <td className="py-2.5 px-3 capitalize text-slate-600">{item.costType?.replace(/_/g, ' ')}</td>
                          <td className="py-2.5 px-3 capitalize text-slate-500">{item.defaultCalculationMethod?.replace(/_/g, ' ')}</td>
                          <td className="py-2.5 px-3 text-right capitalize text-slate-500 font-mono text-[11px]">{item.defaultCostBase?.replace(/_/g, ' ') || 'Direct'}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800">
                            {item.defaultCalculationMethod === 'percentage_of_direct' ? `${item.defaultRate}%` : formatCurrency(item.defaultRate, item.currency || 'LKR')}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              {item.status || 'Active'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-1 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingOverheadItem(item);
                                setIsEditOverheadModalOpen(true);
                              }}
                              className="p-1 rounded text-slate-500 hover:text-amber-700 hover:bg-amber-50 cursor-pointer transition-colors"
                              title="Edit Overhead Item"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteOverheadItemDirect(item)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                              title="Delete Overhead Item"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    {overheadItems.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-6 text-center text-slate-400">
                          No overhead items recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: PROJECT CONTRACTS */}
      {activeTab === 'projects' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {projects
              .filter((p) => {
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                return (
                  p.name.toLowerCase().includes(q) ||
                  p.code.toLowerCase().includes(q) ||
                  (p.clientName && p.clientName.toLowerCase().includes(q)) ||
                  (p.productCategory && p.productCategory.toLowerCase().includes(q))
                );
              })
              .map((proj, idx) => {
                const defaultTheme = getRandomThemeIndex(idx + 1);
                const style = getTileStyle(proj.id, proj.themeId || defaultTheme.id);
                const revenue = proj.quotedPrice || 0;
                const marginPct = proj.targetMarginPct || 35;

                return (
                  <ModernTileCard
                    key={proj.id}
                    id={proj.id}
                    tag={`PROJECT • ${proj.code}`}
                    title={proj.name}
                    brief={`Client: ${proj.clientName || 'General'} • Quoted: $${(revenue / 1000).toFixed(0)}k • ${marginPct}% Margin`}
                    actionLabel="View Project Workspace"
                    actionVariant="button"
                    listViewLabel="FXTT Grid"
                    themeId={style.themeId}
                    customGradient={style.customGradient}
                    onChangeTheme={(tId, grad) => handleUpdateTileTheme(proj.id, tId, grad)}
                    onEdit={() =>
                      handleOpenEdit('project', proj.id, {
                        title: proj.name,
                        name: proj.name,
                        code: proj.code,
                        clientName: proj.clientName,
                        quotedPrice: proj.quotedPrice,
                        status: proj.status
                      })
                    }
                    onDelete={() => handleOpenDelete('Project', proj.id, proj.name, 'projects')}
                    onDuplicate={() => handleDuplicate('project', proj.id)}
                    onAction={() => {
                      onSelectProject(proj);
                      onNavigateToProjectHome?.(proj);
                    }}
                    onViewListView={() => {
                      setActiveFXTTCard({
                        cardType: 'project',
                        cardId: proj.id,
                        cardTitle: proj.name,
                        cardSubtitle: `${proj.clientName || 'Client'} • Quoted: $${revenue.toLocaleString()}`,
                        cardTag: 'PROJECT CONTRACT'
                      });
                    }}
                  />
                );
              })}
          </div>
          {renderCustomTilesForTab('projects', 'Project Contract')}
        </div>
      )}

      {/* TAB: CLIENT ENTERPRISE PROFILES */}
      {activeTab === 'clients' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {clientProfiles
            .filter((c) => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.industry.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((client) => {
              const style = getTileStyle(client.id, client.themeId);
              return (
                <ModernTileCard
                  key={client.id}
                  id={client.id}
                  tag={client.status.toUpperCase()}
                  title={client.name}
                  brief={`${client.tagline} • Quoted: $${(client.totalQuotedValue / 1000).toFixed(0)}k`}
                  actionLabel="View Client Details"
                  actionVariant="button"
                  listViewLabel="View Projects"
                  themeId={style.themeId}
                  customGradient={style.customGradient}
                  onChangeTheme={(tId, grad) => handleUpdateTileTheme(client.id, tId, grad)}
                  onEdit={() =>
                    handleOpenEdit('client', client.id, {
                      title: client.name,
                      name: client.name,
                      tagline: client.tagline,
                      industry: client.industry,
                      location: client.location,
                      status: client.status,
                      totalQuotedValue: client.totalQuotedValue,
                      contactPerson: client.contactPerson,
                      email: client.email
                    })
                  }
                  onDelete={() => handleOpenDelete('Client Profile', client.id, client.name, 'clients')}
                  onDuplicate={() => handleDuplicate('client', client.id)}
                  onAction={() => {
                    const clientAssocProjects = projects.filter(
                      (p) =>
                        p.clientName &&
                        (p.clientName.toLowerCase().includes(client.name.toLowerCase()) ||
                          client.name.toLowerCase().includes(p.clientName.toLowerCase()))
                    );
                    setActiveDetailItem({
                      title: client.name,
                      tag: client.status,
                      themeId: style.themeId,
                      customGradient: style.customGradient,
                      description: client.tagline,
                      attributes: [
                        { label: 'Industry Sector', value: client.industry },
                        { label: 'Headquarters', value: client.location },
                        { label: 'Account Tier', value: client.status },
                        {
                          label: 'Active Projects',
                          value: `${clientAssocProjects.length || client.activeProjectsCount} Associated Contracts`
                        },
                        { label: 'Total Quoted Portfolio', value: `$${(Number(client.totalQuotedValue) || 0).toLocaleString()}` },
                        { label: 'Procurement Lead', value: client.contactPerson },
                        { label: 'Official Invoicing Email', value: client.email }
                      ],
                      primaryActionText: 'View Projects in FXTT Grid',
                      onOpenListView: () => {
                        setActiveFXTTCard({
                          cardType: 'client',
                          cardId: client.id,
                          cardTitle: client.name,
                          cardSubtitle: `${client.industry} • ${client.status}`,
                          cardTag: 'CLIENT ACCOUNT'
                        });
                      }
                    });
                  }}
                  onViewListView={() => {
                    setActiveFXTTCard({
                      cardType: 'client',
                      cardId: client.id,
                      cardTitle: client.name,
                      cardSubtitle: `${client.industry} • ${client.status}`,
                      cardTag: 'CLIENT ACCOUNT'
                    });
                  }}
                />
              );
            })}
        </div>
        {renderCustomTilesForTab('clients', 'Client Enterprise')}
      </div>
    )}

      {/* TAB: SUPPLIER PROFILES */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          {/* Supplier Directory Executive Toolbar */}
          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Verified Material & Equipment Suppliers
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950 text-[#0078d4] dark:text-sky-400 border border-blue-200 dark:border-blue-800">
                {suppliers.length} Registered
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  setAddItemPortal('suppliers');
                  setIsAddItemModalOpen(true);
                }}
                className="flex items-center space-x-1 px-3 py-1.5 bg-[#003049] hover:bg-[#002235] text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#fdf0d5]" />
                <span>+ Register New Supplier</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {suppliers
            .filter((s) => !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.supplyScope.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((sup, idx) => {
              const defaultTheme = getRandomThemeIndex(idx + 3);
              const style = getTileStyle(sup.id, defaultTheme.id);
              return (
                <ModernTileCard
                  key={sup.id}
                  id={sup.id}
                  tag={`SUPPLIER • ${sup.category.toUpperCase()}`}
                  title={sup.name}
                  brief={`${sup.supplyScope} • ${sup.city}, ${sup.country} • Terms: ${sup.paymentTerms}`}
                  actionLabel="View Supplier Details"
                  actionVariant="button"
                  listViewLabel="All Materials & Supplies"
                  themeId={style.themeId}
                  customGradient={style.customGradient}
                  onChangeTheme={(tId, grad) => handleUpdateTileTheme(sup.id, tId, grad)}
                  onEdit={() =>
                    handleOpenEdit('supplier', sup.id, {
                      title: sup.name,
                      name: sup.name,
                      category: sup.category,
                      supplyScope: sup.supplyScope,
                      city: sup.city,
                      country: sup.country,
                      paymentTerms: sup.paymentTerms,
                      rating: sup.rating,
                      qualityScorePct: sup.qualityScorePct
                    })
                  }
                  onDelete={() => handleOpenDelete('Supplier Profile', sup.id, sup.name, 'suppliers')}
                  onDuplicate={() => handleDuplicate('supplier', sup.id)}
                  onAction={() => {
                    const supAssocMaterials = materials.filter(
                      (m) =>
                        m.supplierId === sup.id ||
                        m.supplierName.toLowerCase() === sup.name.toLowerCase() ||
                        m.vendorQuotes?.some(
                          (vq) => vq.vendorId === sup.id || vq.vendorName.toLowerCase() === sup.name.toLowerCase()
                        )
                    );
                    const supAssocServices = outsourcedServices.filter(
                      (o) => o.providerId === sup.id || o.providerName.toLowerCase() === sup.name.toLowerCase()
                    );
                    const supAssocSubs = subcontractors.filter(
                      (s) => s.subcontractorId === sup.id || s.subcontractorName.toLowerCase() === sup.name.toLowerCase()
                    );
                    const totalItemsCount = supAssocMaterials.length + supAssocServices.length + supAssocSubs.length;

                    setActiveDetailItem({
                      title: sup.name,
                      tag: `SUPPLIER • ${sup.category.toUpperCase()}`,
                      themeId: style.themeId,
                      customGradient: style.customGradient,
                      description: `Primary supply scope: ${sup.supplyScope}. Operational Hub: ${sup.city}, ${sup.country}. Commercial terms: ${sup.paymentTerms}. Performance rating: ${sup.rating} / 5.0 ⭐ with ${sup.qualityScorePct}% quality compliance.`,
                      attributes: [
                        { label: 'Category & Domain', value: sup.category },
                        { label: 'Supply Scope', value: sup.supplyScope },
                        { label: 'Hub Location', value: `${sup.city}, ${sup.country}` },
                        { label: 'Commercial Payment Terms', value: sup.paymentTerms },
                        { label: 'Performance Audit Rating', value: `${sup.rating} / 5.0 ⭐` },
                        { label: 'On-Time Delivery SLA', value: `${sup.onTimeDeliveryPct}%` },
                        { label: 'Quality Acceptance Rate', value: `${sup.qualityScorePct}%` },
                        { label: 'Compliance Score', value: `${sup.complianceScorePct}%` },
                        { label: 'Risk Profile', value: sup.riskLevel },
                        { label: 'Operational Status', value: sup.status },
                        { label: 'Approved Credit Limit', value: `$${(sup.creditLimit || 500000).toLocaleString()} USD` },
                        { label: 'Tax ID / Registration', value: sup.vendorTaxId || 'US-EIN-VERIFIED' },
                        { label: 'Certifications', value: sup.certifications?.join(', ') || 'ISO 9001:2015' },
                        { label: 'Procurement Lead / Contact', value: sup.contactPerson },
                        { label: 'Order Dispatch Email', value: sup.email },
                        { label: 'Direct Phone', value: sup.phone },
                        { label: 'Relevant Materials & Supplies', value: `${totalItemsCount} Verified Items in Catalog` }
                      ],
                      primaryActionText: 'View All Materials & Supplies in FXTT Grid',
                      supplierId: sup.id,
                      onOpenListView: () => {
                        setActiveFXTTCard({
                          cardType: 'supplier',
                          cardId: sup.id,
                          cardTitle: sup.name,
                          cardSubtitle: `${sup.supplyScope} • ${sup.city}, ${sup.country}`,
                          cardTag: 'SUPPLIER PORTAL'
                        });
                      }
                    });
                  }}
                  onViewListView={() => {
                    setActiveFXTTCard({
                      cardType: 'supplier',
                      cardId: sup.id,
                      cardTitle: sup.name,
                      cardSubtitle: `${sup.supplyScope} • ${sup.city}, ${sup.country}`,
                      cardTag: 'SUPPLIER PORTAL'
                    });
                  }}
                />
              );
            })}
        </div>
        {renderCustomTilesForTab('suppliers', 'Material Supplier')}
      </div>
    )}

      {/* TAB: SERVICE PROVIDERS */}
      {activeTab === 'service-providers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {outsourcedProvidersList
            .filter((prov) => {
              if (!searchQuery) return true;
              const q = searchQuery.toLowerCase();
              return (
                prov.name.toLowerCase().includes(q) ||
                prov.category.toLowerCase().includes(q) ||
                prov.city.toLowerCase().includes(q) ||
                prov.country.toLowerCase().includes(q)
              );
            })
            .map((prov, idx) => {
              const defaultTheme = getRandomThemeIndex(idx + 5);
              const style = getTileStyle(prov.id, defaultTheme.id);
              return (
                <ModernTileCard
                  key={prov.id}
                  id={prov.id}
                  tag="SERVICE PROVIDER"
                  title={prov.name}
                  brief={`${prov.services.length} Outsourced Services • ${prov.city}, ${prov.country} • SLA: ${prov.slaLevel}`}
                  actionLabel="View Provider Details"
                  actionVariant="button"
                  listViewLabel="All Outsourced Services"
                  themeId={style.themeId}
                  customGradient={style.customGradient}
                  onChangeTheme={(tId, grad) => handleUpdateTileTheme(prov.id, tId, grad)}
                  onEdit={() =>
                    handleOpenEdit('service-provider', prov.id, {
                      title: prov.name,
                      providerName: prov.name,
                      name: prov.name,
                      category: prov.category,
                      city: prov.city,
                      country: prov.country,
                      slaLevel: prov.slaLevel,
                      paymentTerms: prov.paymentTerms
                    })
                  }
                  onDelete={() => handleOpenDelete('Service Provider', prov.id, prov.name, 'service-providers')}
                  onDuplicate={() => handleDuplicate('service-provider', prov.id)}
                  onAction={() => {
                    setActiveDetailItem({
                      title: prov.name,
                      tag: 'SERVICE PROVIDER',
                      themeId: style.themeId,
                      customGradient: style.customGradient,
                      description: `${prov.name} — Accredited external service provider specializing in ${prov.category}. Operational dispatch from ${prov.city}, ${prov.country} with contractual guarantee ${prov.slaLevel}.`,
                      attributes: [
                        { label: 'Provider Name', value: prov.name },
                        { label: 'Category & Domain', value: prov.category },
                        { label: 'Operations Hub', value: `${prov.city}, ${prov.country}` },
                        { label: 'Contract SLA Level', value: prov.slaLevel },
                        { label: 'Commercial Payment Terms', value: prov.paymentTerms },
                        { label: 'Performance Rating', value: `${prov.rating} / 5.0 ⭐` },
                        { label: 'Quality & Audit Compliance', value: `${prov.qualityScorePct}%` },
                        { label: 'Relevant Outsourced Services', value: `${prov.services.length} Contracted Services for this Provider only` },
                        { label: 'Primary Contact Person', value: prov.contactPerson },
                        { label: 'Dispatch / SLA Email', value: prov.email },
                        { label: 'Direct Operations Phone', value: prov.phone }
                      ],
                      primaryActionText: 'View All Outsourced Services in FXTT Grid',
                      supplierId: prov.providerId,
                      onOpenListView: () => {
                        setActiveFXTTCard({
                          cardType: 'service_provider',
                          cardId: prov.providerId,
                          cardTitle: prov.name,
                          cardSubtitle: `All Outsourced Services (${prov.services.length} items) • ${prov.city}, ${prov.country}`,
                          cardTag: 'SERVICE PROVIDER'
                        });
                      }
                    });
                  }}
                  onViewListView={() => {
                    setActiveFXTTCard({
                      cardType: 'service_provider',
                      cardId: prov.providerId,
                      cardTitle: prov.name,
                      cardSubtitle: `All Outsourced Services (${prov.services.length} items) • ${prov.city}, ${prov.country}`,
                      cardTag: 'SERVICE PROVIDER'
                    });
                  }}
                />
              );
            })}
        </div>
        {renderCustomTilesForTab('service-providers', 'Service Provider')}
      </div>
    )}

      {/* TAB: SUBCONTRACTOR PROFILES */}
      {activeTab === 'subcontractors' && (
        <div className="space-y-4">
          {/* Subcontractor Directory Executive Toolbar */}
          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Trade Subcontractors & Specialized Labor
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950 text-[#0078d4] dark:text-sky-400 border border-blue-200 dark:border-blue-800">
                {subcontractorsList.length} Certified Partners
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  setCreateCategoryGroup('subcontractor');
                  setIsCreateCategoryModalOpen(true);
                }}
                className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5 text-amber-600" />
                <span>+ Trade Category</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddItemPortal('subcontractors');
                  setIsAddItemModalOpen(true);
                }}
                className="flex items-center space-x-1 px-3 py-1.5 bg-[#003049] hover:bg-[#002235] text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#fdf0d5]" />
                <span>+ Register Subcontractor</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {subcontractorsList
            .filter((sub) => {
              if (!searchQuery) return true;
              const q = searchQuery.toLowerCase();
              return (
                sub.name.toLowerCase().includes(q) ||
                sub.serviceCategory.toLowerCase().includes(q) ||
                sub.serviceType.toLowerCase().includes(q) ||
                sub.city.toLowerCase().includes(q)
              );
            })
            .map((sub, idx) => {
              const defaultTheme = getRandomThemeIndex(idx + 7);
              const style = getTileStyle(sub.id, defaultTheme.id);
              return (
                <ModernTileCard
                  key={sub.id}
                  id={sub.id}
                  tag="SUBCONTRACTOR"
                  title={sub.name}
                  brief={`${sub.ratesCount} Subcontractor Services & Labour Charges • ${sub.city}, ${sub.country} • ${sub.skillLevel}`}
                  actionLabel="View Subcontractor Details"
                  actionVariant="button"
                  listViewLabel="All Subcontractor Services"
                  themeId={style.themeId}
                  customGradient={style.customGradient}
                  onChangeTheme={(tId, grad) => handleUpdateTileTheme(sub.id, tId, grad)}
                  onEdit={() =>
                    handleOpenEdit('subcontractor', sub.id, {
                      title: sub.name,
                      subcontractorName: sub.name,
                      serviceType: sub.serviceType,
                      serviceCategory: sub.serviceCategory,
                      skillLevel: sub.skillLevel,
                      city: sub.city,
                      country: sub.country,
                      paymentTerms: sub.paymentTerms
                    })
                  }
                  onDelete={() => handleOpenDelete('Subcontractor Profile', sub.id, sub.name, 'subcontractors')}
                  onDuplicate={() => handleDuplicate('subcontractor', sub.id)}
                  onAction={() => {
                    setActiveDetailItem({
                      title: sub.name,
                      tag: 'SUBCONTRACTOR PROFILE',
                      themeId: style.themeId,
                      customGradient: style.customGradient,
                      description: `${sub.name} — Specialized trade partner certified for ${sub.serviceCategory}. Operating crew status: ${sub.skillLevel}. Logistics dispatch out of ${sub.city}, ${sub.country}.`,
                      attributes: [
                        { label: 'Subcontractor Name', value: sub.name },
                        { label: 'Trade Category', value: sub.serviceCategory },
                        { label: 'Primary Service Type', value: sub.serviceType },
                        { label: 'Crew Certification Level', value: sub.skillLevel },
                        { label: 'Operations Base', value: `${sub.city}, ${sub.country}` },
                        { label: 'Commercial Payment Terms', value: sub.paymentTerms },
                        { label: 'Performance Audit Rating', value: `${sub.rating} / 5.0 ⭐` },
                        { label: 'Quality Acceptance Score', value: `${sub.qualityScorePct}%` },
                        { label: 'Relevant Subcontractor Services', value: `${sub.ratesCount} Trade Operations & Labour Charges (This Subcontractor Only)` },
                        { label: 'Operations Dispatch Lead', value: sub.contactPerson },
                        { label: 'Dispatch / SLA Email', value: sub.email },
                        { label: 'Direct Crew Phone', value: sub.phone }
                      ],
                      primaryActionText: 'View All Subcontractor Services in FXTT Grid',
                      supplierId: sub.subcontractorId,
                      onOpenListView: () => {
                        setActiveFXTTCard({
                          cardType: 'subcontractor',
                          cardId: sub.subcontractorId,
                          cardTitle: sub.name,
                          cardSubtitle: `All Subcontractor Services & Labour Charges (${sub.ratesCount} items) • ${sub.city}, ${sub.country}`,
                          cardTag: 'SUBCONTRACTOR SERVICES'
                        });
                      }
                    });
                  }}
                  onViewListView={() => {
                    setActiveFXTTCard({
                      cardType: 'subcontractor',
                      cardId: sub.subcontractorId,
                      cardTitle: sub.name,
                      cardSubtitle: `All Subcontractor Services & Labour Charges (${sub.ratesCount} items) • ${sub.city}, ${sub.country}`,
                      cardTag: 'SUBCONTRACTOR SERVICES'
                    });
                  }}
                />
              );
            })}
        </div>
        {renderCustomTilesForTab('subcontractors', 'Subcontractor Crew')}
      </div>
    )}

      {/* TAB: COMPETITORS DIRECTORY PORTAL */}
      {activeTab === 'competitors' && (
        <div className="space-y-4">
          {/* Executive Sub-Header & Tier Filter Pills */}
          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center flex-wrap gap-1.5">
              <span className="font-bold text-slate-700 dark:text-slate-300 mr-2 flex items-center space-x-1">
                <Scale className="w-3.5 h-3.5 text-[#003049]" />
                <span>Market Tier:</span>
              </span>
              {[
                { id: 'all', label: 'All Tiers' },
                { id: 'Market Leader', label: 'Market Leaders' },
                { id: 'Primary Competitor', label: 'Primary Competitors' },
                { id: 'Market Benchmark', label: 'Benchmarks' },
                { id: 'Low-Cost Challenger', label: 'Low-Cost Challengers' },
                { id: 'Premium Rival', label: 'Premium Rivals' },
                { id: 'Regional Specialist', label: 'Regional Specialists' }
              ].map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setCompetitorFilterTier(tier.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    competitorFilterTier === tier.id
                      ? 'bg-[#003049] text-white shadow-2xs font-semibold'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {tier.label}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  setEditingCompetitor(null);
                  setCompetitorForm({
                    name: '',
                    code: `COMP-${Date.now().toString().slice(-4)}`,
                    country: 'United States',
                    marketTier: 'Primary Competitor',
                    contactPerson: '',
                    email: '',
                    website: '',
                    notes: ''
                  });
                  setIsCompetitorModalOpen(true);
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#003049] hover:bg-[#002235] text-white rounded-lg font-medium shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#fdf0d5]" />
                <span>+ Register Competitor</span>
              </button>
            </div>
          </div>

          {/* Competitor Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {competitorsList
              .filter((comp) => {
                if (competitorFilterTier !== 'all' && comp.marketTier !== competitorFilterTier) return false;
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                return (
                  comp.name.toLowerCase().includes(q) ||
                  (comp.code && comp.code.toLowerCase().includes(q)) ||
                  (comp.country && comp.country.toLowerCase().includes(q)) ||
                  (comp.marketTier && comp.marketTier.toLowerCase().includes(q)) ||
                  (comp.notes && comp.notes.toLowerCase().includes(q))
                );
              })
              .map((comp, idx) => {
                const defaultTheme = getRandomThemeIndex(idx + 9);
                const style = getTileStyle(comp.id, defaultTheme.id);
                return (
                  <ModernTileCard
                    key={comp.id}
                    id={comp.id}
                    tag={`COMPETITOR • ${(comp.marketTier || 'Primary Rival').toUpperCase()}`}
                    title={comp.name}
                    brief={`${comp.country || 'Global'} • Code: ${comp.code || 'COMP'} • Contact: ${comp.contactPerson || comp.email || 'Commercial Sales'}`}
                    actionLabel="View Benchmark Rates / FXTT Matrix"
                    actionVariant="button"
                    listViewLabel="Open FXTT Price Matrix"
                    themeId={style.themeId}
                    customGradient={style.customGradient}
                    onChangeTheme={(tId, grad) => handleUpdateTileTheme(comp.id, tId, grad)}
                    onEdit={() => {
                      setEditingCompetitor(comp);
                      setCompetitorForm({
                        name: comp.name,
                        code: comp.code || '',
                        country: comp.country || 'United States',
                        marketTier: comp.marketTier || 'Primary Competitor',
                        contactPerson: comp.contactPerson || '',
                        email: comp.email || '',
                        website: comp.website || '',
                        notes: comp.notes || ''
                      });
                      setIsCompetitorModalOpen(true);
                    }}
                    onDelete={() => {
                      setDeleteModalData({
                        isOpen: true,
                        title: comp.name,
                        entityType: 'Competitor Profile',
                        onConfirm: async () => {
                          try {
                            await api.deleteCompetitor(comp.id);
                            setCompetitorsList((prev) => prev.filter((c) => c.id !== comp.id));
                            showToast(`Competitor "${comp.name}" removed from PostgreSQL database.`);
                          } catch (err: any) {
                            showToast(`Failed to delete competitor: ${err?.message}`);
                          }
                          setDeleteModalData(null);
                        }
                      });
                    }}
                    onDuplicate={async () => {
                      try {
                        const copy = await api.createCompetitor({
                          ...comp,
                          id: undefined,
                          name: `${comp.name} (Copy)`,
                          code: `${comp.code || 'COMP'}-CPY`
                        });
                        setCompetitorsList((prev) => [copy, ...prev]);
                        showToast(`Competitor "${comp.name}" duplicated.`);
                      } catch (err: any) {
                        showToast(`Failed to duplicate: ${err?.message}`);
                      }
                    }}
                    onAction={() => {
                      const defaultItem = combinedAllRevenueRecords[0] || {
                        id: 'rev-srv-01',
                        code: 'REV-SRV-001',
                        name: 'FEA Structural Stress Analysis & Design Review',
                        retailPrice: 185,
                        costPrice: 95,
                        type: 'service'
                      };
                      setActiveCompetitorMatrixItem({
                        item: {
                          id: defaultItem.id,
                          code: defaultItem.code,
                          name: defaultItem.name,
                          ourPrice: defaultItem.retailPrice || 100,
                          ourCost: defaultItem.costPrice || 60,
                          type: defaultItem.type || 'product'
                        },
                        itemType: defaultItem.type || 'product'
                      });
                    }}
                    onViewListView={() => {
                      const defaultItem = combinedAllRevenueRecords[0] || {
                        id: 'rev-srv-01',
                        code: 'REV-SRV-001',
                        name: 'FEA Structural Stress Analysis & Design Review',
                        retailPrice: 185,
                        costPrice: 95,
                        type: 'service'
                      };
                      setActiveCompetitorMatrixItem({
                        item: {
                          id: defaultItem.id,
                          code: defaultItem.code,
                          name: defaultItem.name,
                          ourPrice: defaultItem.retailPrice || 100,
                          ourCost: defaultItem.costPrice || 60,
                          type: defaultItem.type || 'product'
                        },
                        itemType: defaultItem.type || 'product'
                      });
                    }}
                  />
                );
              })}
          </div>
          {renderCustomTilesForTab('competitors', 'Market Competitor')}
        </div>
      )}

      {/* DEDICATED PRODUCT COMPETITOR FXTT PRICE MATRIX MODAL */}
      {activeCompetitorMatrixItem && (
        <ProductCompetitorPriceMatrixModal
          item={activeCompetitorMatrixItem.item}
          itemType={activeCompetitorMatrixItem.itemType}
          currentUser={currentUser}
          onClose={() => setActiveCompetitorMatrixItem(null)}
          onUpdateOurPrice={(newPrice, newCost) => {
            const itemId = activeCompetitorMatrixItem.item.id;
            if (itemId.startsWith('res-') || activeCompetitorMatrixItem.itemType === 'resource') {
              setEnterpriseResources((prev) =>
                prev.map((r) =>
                  r.id === itemId
                    ? { ...r, baseRate: newPrice, operationalCharge: newCost ?? r.operationalCharge }
                    : r
                )
              );
            }
            showToast(`Updated rate to ${formatCurrency(newPrice, activeCompetitorMatrixItem.item.currency || 'LKR')} in database.`);
            setActiveCompetitorMatrixItem(null);
          }}
        />
      )}

      {/* DEDICATED REGISTER / EDIT COMPETITOR MODAL */}
      {isCompetitorModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#003049] text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Scale className="w-4 h-4 text-[#fdf0d5]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  {editingCompetitor ? `Edit Competitor: ${editingCompetitor.name}` : 'Register New Competitor Profile'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCompetitorModalOpen(false)}
                className="text-white/70 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!competitorForm.name.trim()) return;

                if (editingCompetitor) {
                  try {
                    const updated = await api.updateCompetitor(editingCompetitor.id, competitorForm);
                    setCompetitorsList((prev) =>
                      prev.map((c) => (c.id === editingCompetitor.id ? { ...c, ...updated } : c))
                    );
                    showToast(`Competitor "${competitorForm.name}" updated in PostgreSQL.`);
                  } catch (err: any) {
                    showToast(`Error updating competitor: ${err?.message}`);
                  }
                } else {
                  try {
                    const created = await api.createCompetitor(competitorForm);
                    setCompetitorsList((prev) => [...prev, created]);
                    showToast(`Competitor "${competitorForm.name}" registered in PostgreSQL.`);
                  } catch (err: any) {
                    showToast(`Error creating competitor: ${err?.message}`);
                  }
                }
                setIsCompetitorModalOpen(false);
              }}
              className="p-4 space-y-3.5 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Company / Entity Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Industrial Dynamics"
                    value={competitorForm.name}
                    onChange={(e) => setCompetitorForm({ ...competitorForm, name: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-[#003049]"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Competitor Code</label>
                  <input
                    type="text"
                    placeholder="e.g. COMP-APEX"
                    value={competitorForm.code}
                    onChange={(e) => setCompetitorForm({ ...competitorForm, code: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-[#003049]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Country / Region</label>
                  <input
                    type="text"
                    value={competitorForm.country}
                    onChange={(e) => setCompetitorForm({ ...competitorForm, country: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-[#003049]"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Market Benchmark Tier</label>
                  <select
                    value={competitorForm.marketTier}
                    onChange={(e) => setCompetitorForm({ ...competitorForm, marketTier: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-[#003049]"
                  >
                    <option value="Primary Competitor">Primary Competitor</option>
                    <option value="Market Leader">Market Leader</option>
                    <option value="Market Benchmark">Market Benchmark</option>
                    <option value="Low-Cost Challenger">Low-Cost Challenger</option>
                    <option value="Premium Rival">Premium Rival</option>
                    <option value="Regional Specialist">Regional Specialist</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="Sales / Account Lead"
                    value={competitorForm.contactPerson}
                    onChange={(e) => setCompetitorForm({ ...competitorForm, contactPerson: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-[#003049]"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Commercial Email</label>
                  <input
                    type="email"
                    placeholder="sales@competitor.com"
                    value={competitorForm.email}
                    onChange={(e) => setCompetitorForm({ ...competitorForm, email: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-[#003049]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Website URL</label>
                <input
                  type="text"
                  placeholder="https://www.competitor.com"
                  value={competitorForm.website}
                  onChange={(e) => setCompetitorForm({ ...competitorForm, website: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-[#003049]"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Intelligence Notes & Market Positioning</label>
                <textarea
                  rows={2}
                  placeholder="Key differentiators, pricing strategy, known clients, warranty terms..."
                  value={competitorForm.notes}
                  onChange={(e) => setCompetitorForm({ ...competitorForm, notes: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-[#003049]"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCompetitorModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#003049] hover:bg-[#002235] text-white rounded font-medium cursor-pointer shadow-xs"
                >
                  {editingCompetitor ? 'Save Changes' : 'Register Competitor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: CREATE GENERIC NEW CARD / TILE */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <PlusCircle className="w-4 h-4 text-[#003049]" />
                <h3 className="text-sm font-normal text-slate-900">Create New Directory Card / Tile</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTileSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs text-slate-600 mb-1 font-normal">Target Portal Directory</label>
                <select
                  value={createType}
                  onChange={(e: any) => setCreateType(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003049]"
                >
                  <option value="project">Project Contracts</option>
                  <option value="material-category">Material Categories</option>
                  <option value="product-category">Revenue Streams (Products Supplied)</option>
                  <option value="service-category">Revenue Streams (Services Rendered)</option>
                  <option value="client">Client Enterprise Profiles</option>
                  <option value="supplier">Material Suppliers</option>
                  <option value="service-provider">Outsourced Service Providers</option>
                  <option value="subcontractor">Subcontractor Profiles</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1 font-normal">Card Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. High-Pressure Hydraulic Manifolds"
                    value={newCardTitle}
                    onChange={(e) => setNewCardTitle(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#003049]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1 font-normal">Top Pill Badge Tag</label>
                  <input
                    type="text"
                    placeholder="e.g. CRITICAL ASSEMBLY"
                    value={newCardTag}
                    onChange={(e) => setNewCardTag(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#003049]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1 font-normal">Brief Words / Description</label>
                <input
                  type="text"
                  placeholder="e.g. 7075-T6 Aerospace billet, 450 bar rated"
                  value={newCardBrief}
                  onChange={(e) => setNewCardBrief(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#003049]"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1 font-normal">Color Theme Preset or Custom Gradient</label>
                <ColorGradientPicker
                  selectedThemeId={newCardThemeId}
                  onSelectTheme={(tId, grad) => {
                    setNewCardThemeId(tId);
                    setNewCardCustomGradient(grad);
                  }}
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-[#003049] hover:bg-[#002235] text-white text-xs font-normal transition-colors shadow-xs"
                >
                  Publish Tile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: DEDICATED CREATE CATEGORY MODAL */}
      <CreateCategoryModal
        isOpen={isCreateCategoryModalOpen}
        onClose={() => setIsCreateCategoryModalOpen(false)}
        defaultGroup={createCategoryGroup}
        onSave={handleSaveCategory}
      />

      {/* 7. MODAL: DEDICATED CREATE SUB-CATEGORY MODAL */}
      <CreateSubCategoryModal
        isOpen={isCreateSubCategoryModalOpen}
        onClose={() => setIsCreateSubCategoryModalOpen(false)}
        defaultGroup={createSubCategoryGroup}
        parentCategories={categories}
        defaultParentId={createSubCategoryParentId}
        onSave={handleSaveSubCategory}
      />

      {/* 8. MODAL: DEDICATED ADD ITEM MODAL */}
      <AddItemModal
        isOpen={isAddItemModalOpen}
        onClose={() => {
          setIsAddItemModalOpen(false);
          setAddItemCategoryId(undefined);
          setAddItemSubCategoryId(undefined);
        }}
        portal={addItemPortal}
        categories={categories}
        suppliers={suppliers}
        initialCategoryId={addItemCategoryId}
        initialSubCategoryId={addItemSubCategoryId}
        onSave={handleSaveItem}
      />

      {/* 8B. MODAL: DEDICATED EDIT OVERHEAD ITEM MODAL */}
      <CreateEditOverheadItemModal
        isOpen={isEditOverheadModalOpen}
        itemToEdit={editingOverheadItem}
        categories={categories}
        onClose={() => {
          setIsEditOverheadModalOpen(false);
          setEditingOverheadItem(null);
        }}
        onDelete={async (id) => {
          await handleDeleteOverheadItemDirect(editingOverheadItem || { id, name: 'Item', code: '' });
          setIsEditOverheadModalOpen(false);
          setEditingOverheadItem(null);
        }}
        onSave={(updated) => {
          setOverheadItems((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
          if (onUpdateOverheadItem) onUpdateOverheadItem(updated.id, updated);
          showToast(`Overhead item "${updated.name}" updated in database.`);
          setIsEditOverheadModalOpen(false);
          setEditingOverheadItem(null);
        }}
      />

      {/* 9. MODAL: UNIVERSAL EDIT CARD MODAL */}
      {editModalData && (
        <EditItemModal
          isOpen={editModalData.isOpen}
          onClose={() => setEditModalData(null)}
          itemType={editModalData.itemType}
          id={editModalData.id}
          initialData={editModalData.initialData}
          onSave={handleSaveEdit}
        />
      )}

      {/* 10. MODAL: DELETE CONFIRMATION MODAL */}
      {deleteModalData && (
        <DeleteConfirmModal
          isOpen={deleteModalData.isOpen}
          onClose={() => setDeleteModalData(null)}
          title={deleteModalData.title}
          entityType={deleteModalData.entityType}
          onConfirm={deleteModalData.onConfirm}
        />
      )}

      {/* 10.5 DEDICATED BULK IMPORT MODAL (MASTER DATA SETS OR SUB-CATEGORY WISE) */}
      {bulkImportConfig && (
        <DataImportExportModal
          isOpen={bulkImportConfig.isOpen}
          onClose={() => setBulkImportConfig(null)}
          targetType={bulkImportConfig.targetType}
          categoryScope={bulkImportConfig.categoryScope}
          subCategoryScope={bulkImportConfig.subCategoryScope}
          materials={materials}
          produceItems={produceItems}
          suppliers={suppliers}
          subcontractors={subcontractors}
          outsourcedServices={outsourcedServices}
          onImportMaterials={(items) => {
            items.forEach((m) => {
              if (onAddMaterial) onAddMaterial(m as any);
            });
            showToast(`Successfully imported ${items.length} materials into database!`);
          }}
          onImportProduce={(items) => {
            items.forEach((p) => {
              if (onAddProduceItem) onAddProduceItem(p);
            });
            showToast(`Successfully imported ${items.length} product/produce items into database!`);
          }}
          onImportSubcontractors={(subs) => {
            subs.forEach((s) => {
              if (onAddSubcontractor) onAddSubcontractor(s);
            });
            showToast(`Successfully imported ${subs.length} subcontractor trade rates into database!`);
          }}
          onImportOutsourced={(svcs) => {
            svcs.forEach((s) => {
              if (onAddOutsourcedService) onAddOutsourcedService(s);
            });
            showToast(`Successfully imported ${svcs.length} outsourced service rates into database!`);
          }}
          onImportSuppliers={(sups) => {
            sups.forEach((s) => {
              if (onAddSupplier) onAddSupplier(s);
            });
            showToast(`Successfully imported ${sups.length} suppliers into database!`);
          }}
          onNotification={(msg) => showToast(msg)}
        />
      )}

      {/* 11. QUICK DETAIL ITEM POPUP */}
      {activeDetailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-normal uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {activeDetailItem.tag}
                </span>
                <h3 className="text-base font-normal text-slate-900">{activeDetailItem.title}</h3>
              </div>
              <button
                onClick={() => setActiveDetailItem(null)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 space-y-3">
              <div
                className="h-2 rounded-full"
                style={{
                  background:
                    activeDetailItem.customGradient ||
                    getThemeById(activeDetailItem.themeId)?.previewColor ||
                    '#003049'
                }}
              />

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2 text-xs">
                {activeDetailItem.attributes.map((attr, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-200/60 last:border-0">
                    <span className="text-slate-500">{attr.label}</span>
                    <span className="text-slate-900 font-normal">{attr.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                {activeDetailItem.onOpenListView && (
                  <button
                    type="button"
                    onClick={() => {
                      const cb = activeDetailItem.onOpenListView;
                      setActiveDetailItem(null);
                      cb?.();
                    }}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-normal transition-colors cursor-pointer shadow-xs"
                  >
                    <Table className="w-3.5 h-3.5 text-white/90" />
                    <span>Open in FXTT List View</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const sId = activeDetailItem.supplierId;
                    const itId = activeDetailItem.itemId;
                    const itType = activeDetailItem.itemType;
                    setActiveDetailItem(null);
                    handleOpenPriceHistory({ supplierId: sId, itemId: itId, itemType: itType });
                  }}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                  title="View verified historical prices and recorded quotations"
                >
                  <History className="w-3.5 h-3.5 text-white/90" />
                  <span>Price History & Quotes</span>
                </button>
              </div>

              <button
                onClick={() => setActiveDetailItem(null)}
                className="px-4 py-1.5 rounded-xl bg-[#003049] hover:bg-[#002235] text-white text-xs font-normal transition-colors cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 12. FXTT CRM LIST VIEW MODAL */}
      {activeFXTTCard && (
        <FXTTCardItemsListView
          key={`${activeFXTTCard.cardType}-${activeFXTTCard.cardId || ''}-${activeFXTTCard.cardTitle}`}
          isModal={true}
          cardType={activeFXTTCard.cardType}
          cardId={activeFXTTCard.cardId}
          cardTitle={activeFXTTCard.cardTitle}
          cardSubtitle={activeFXTTCard.cardSubtitle}
          cardTag={activeFXTTCard.cardTag}
          categories={categories}
          materials={materials}
          suppliers={suppliers}
          outsourcedServices={outsourcedServices}
          subcontractors={subcontractors}
          projects={projects}
          produceItems={produceItems}
          overheads={overheadItems}
          revenueItems={revenueItems}
          onClose={() => setActiveFXTTCard(null)}
          onUpdatePrice={(id, price, reason) => {
            if (activeFXTTCard?.cardType === 'product_category' && onUpdateProduceItem) {
              onUpdateProduceItem(id, { costPrice: price, retailPrice: Math.round(price * 1.35) });
            }
            onUpdateMaterialPrice?.(id, price, reason);
          }}
          onUpdateMaterialPrice={(id, price, reason) => {
            onUpdateMaterialPrice?.(id, price, reason);
          }}
          onUpdateMaterial={onUpdateMaterial}
          onDeleteMaterial={onDeleteMaterial}
          onAddMaterial={onAddMaterial}
          onAddSupplier={onAddSupplier}
          onUpdateSupplier={onUpdateSupplier}
          onDeleteSupplier={onDeleteSupplier}
          onAddProduceItem={onAddProduceItem}
          onUpdateProduceItem={onUpdateProduceItem}
          onDeleteProduceItem={onDeleteProduceItem}
          onAddSubcontractor={onAddSubcontractor}
          onUpdateSubcontractor={onUpdateSubcontractor}
          onDeleteSubcontractor={onDeleteSubcontractor}
          onAddOutsourcedService={onAddOutsourcedService}
          onUpdateOutsourcedService={onUpdateOutsourcedService}
          onDeleteOutsourcedService={onDeleteOutsourcedService}
          onAddOverheadItem={(item) => {
            setOverheadItems((prev) => [item, ...prev]);
            onAddOverheadItem?.(item);
          }}
          onUpdateOverheadItem={(id, item) => {
            setOverheadItems((prev) => prev.map((o) => (o.id === id ? { ...o, ...item } : o)));
            onUpdateOverheadItem?.(id, item);
          }}
          onDeleteOverheadItem={(id) => {
            setOverheadItems((prev) => prev.filter((o) => o.id !== id));
            onDeleteOverheadItem?.(id);
          }}
          onAddRevenueItem={(item) => {
            setRevenueItems((prev) => [item, ...prev]);
            onAddRevenueItem?.(item);
          }}
          onUpdateRevenueItem={(id, item) => {
            setRevenueItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...item } : r)));
            onUpdateRevenueItem?.(id, item);
          }}
          onDeleteRevenueItem={(id) => {
            setRevenueItems((prev) => prev.filter((r) => r.id !== id));
            onDeleteRevenueItem?.(id);
          }}
          onSelectProject={(p) => {
            onSelectProject(p);
            setActiveFXTTCard(null);
          }}
          onNavigateToCostAnalysis={(p) => {
            onNavigateToCostAnalysis(p);
            setActiveFXTTCard(null);
          }}
          onAddProject={onAddProject}
          onUpdateProject={onUpdateProject}
          onDeleteProject={onDeleteProject}
        />
      )}

      {/* 13. MODAL: OUTSOURCED RATE & RANGES EDIT MODAL */}
      {activeOutsourcedRateItem && (
        <OutsourcedRateEditModal
          service={activeOutsourcedRateItem}
          onClose={() => setActiveOutsourcedRateItem(null)}
          onSave={(updatedData, reason, auditor) => {
            const histEntry = {
              id: `hist-out-${Date.now()}`,
              date: new Date().toISOString().split('T')[0],
              oldRate: activeOutsourcedRateItem.rate,
              newRate: updatedData.rate,
              reason: reason || 'Contract tariff and volume schedule adjustment',
              updatedBy: auditor || 'Director of Logistics & Utilities'
            };
            onUpdateOutsourcedService?.(activeOutsourcedRateItem.id, {
              ...updatedData,
              lastUpdated: new Date().toISOString().split('T')[0],
              priceHistory: [histEntry, ...(activeOutsourcedRateItem.priceHistory || [])]
            });
            setActiveOutsourcedRateItem(null);
          }}
        />
      )}

      {/* 14. MODAL: OUTSOURCED AUDIT HISTORY CHANGE LOG MODAL */}
      {activeOutsourcedAuditItem && (
        <OutsourcedAuditHistoryModal
          service={activeOutsourcedAuditItem}
          onClose={() => setActiveOutsourcedAuditItem(null)}
        />
      )}

      {/* 15. MODAL: OUTSOURCED VOLUME RANGES & SIMULATOR MODAL */}
      {activeOutsourcedRangesItem && (
        <OutsourcedVolumeRangesModal
          service={activeOutsourcedRangesItem}
          onClose={() => setActiveOutsourcedRangesItem(null)}
        />
      )}

      {/* 16. MODAL: ENTERPRISE RESOURCE CREATE & EDIT */}
      <CreateEditResourceModal
        isOpen={isCreateResourceModalOpen || !!editingResource}
        onClose={() => {
          setIsCreateResourceModalOpen(false);
          setEditingResource(null);
        }}
        editingResource={editingResource}
        defaultType={selectedResourceCategory || 'machinery'}
        suppliers={suppliers}
        onSaved={handleResourceSaved}
        showToast={showToast}
      />

      {/* 17. MODAL: ENTERPRISE RESOURCE DELETE CONFIRM */}
      <DeleteResourceConfirmModal
        isOpen={!!deletingResource}
        resource={deletingResource}
        onClose={() => setDeletingResource(null)}
        onDeleted={handleResourceDeleted}
        showToast={showToast}
      />

      {/* 18. MODAL: ENTERPRISE RESOURCE DETAILS & METRICS */}
      <ResourceDetailsModal
        isOpen={!!viewingResource}
        resource={viewingResource}
        onClose={() => setViewingResource(null)}
        onEdit={(r) => {
          setViewingResource(null);
          setEditingResource(r);
        }}
        onPriceChange={(r) => {
          setViewingResource(null);
          setPriceChangeResource(r);
        }}
        onViewHistory={(r) => {
          setViewingResource(null);
          setPriceHistoryResource(r);
        }}
      />

      {/* 19. MODAL: ENTERPRISE RESOURCE PRICE / RATE CHANGE */}
      <ResourcePriceChangeModal
        isOpen={!!priceChangeResource}
        resource={priceChangeResource}
        onClose={() => setPriceChangeResource(null)}
        onPriceUpdated={handleResourcePriceUpdated}
        showToast={showToast}
      />

      {/* 20. MODAL: ENTERPRISE RESOURCE FXTT PRICE HISTORY */}
      <ResourcePriceHistoryModal
        isOpen={!!priceHistoryResource}
        resource={priceHistoryResource}
        onClose={() => setPriceHistoryResource(null)}
        onNewPriceChange={(r) => {
          setPriceHistoryResource(null);
          setPriceChangeResource(r);
        }}
      />

      {/* 21. MODAL: ENTERPRISE RESOURCE PRICE RANGES AND CHANGES (EDITABLE) */}
      {rangesAndChangesResource && (
        <ResourcePriceRangesAndChangesModal
          isOpen={!!rangesAndChangesResource}
          resource={rangesAndChangesResource}
          suppliers={suppliers}
          initialTab={rangesAndChangesInitialTab}
          onClose={() => setRangesAndChangesResource(null)}
          onResourceUpdated={(updated) => {
            handleResourceSaved(updated);
            setRangesAndChangesResource(updated);
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
};

/* ========================================================================= */
/* DEDICATED MODALS FOR OUTSOURCED SERVICES SUB-PORTAL                       */
/* ========================================================================= */

interface OutsourcedRateEditModalProps {
  service: OutsourcedService;
  onClose: () => void;
  onSave: (
    data: {
      rate: number;
      retailPrice?: number;
      tierRates?: Array<{ minVolume: number; maxVolume?: number; rate: number; description: string }>;
    },
    reason: string,
    auditor: string
  ) => void;
}

const OutsourcedRateEditModal: React.FC<OutsourcedRateEditModalProps> = ({
  service,
  onClose,
  onSave
}) => {
  const [rate, setRate] = useState<number>(service.rate);
  const [retailPrice, setRetailPrice] = useState<number>(service.retailPrice || service.rate * 1.15);
  const [reason, setReason] = useState('');
  const [auditor, setAuditor] = useState('Director of Logistics & Utilities');
  const [tiers, setTiers] = useState(
    service.tierRates ? JSON.parse(JSON.stringify(service.tierRates)) : []
  );

  const handleUpdateTier = (idx: number, field: string, val: any) => {
    setTiers((prev: any[]) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const handleAddTier = () => {
    const lastTier = tiers[tiers.length - 1];
    const minVol = lastTier ? (lastTier.maxVolume ? lastTier.maxVolume + 1 : lastTier.minVolume + 500) : 1;
    setTiers((prev: any[]) => [
      ...prev,
      {
        minVolume: minVol,
        rate: Number((rate * 0.9).toFixed(2)),
        description: `High-volume bracket (${minVol}+ units)`
      }
    ]);
  };

  const handleRemoveTier = (idx: number) => {
    setTiers((prev: any[]) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(
      {
        rate: Number(rate),
        retailPrice: Number(retailPrice),
        tierRates: tiers
      },
      reason.trim() || 'Index tariff benchmark and volume schedule adjustment',
      auditor.trim() || 'Director of Logistics & Utilities'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                RATE & RANGES REVISION
              </span>
              <span className="text-xs text-slate-500 font-mono">{service.id.toUpperCase()}</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1">{service.name}</h3>
            <p className="text-xs text-slate-500">
              Provider: <strong className="text-slate-700">{service.providerName}</strong> • Unit:{' '}
              <strong className="text-slate-700">{service.baseUnitType.replace(/_/g, ' ')}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contract Hired Rate ($ / unit) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400 text-xs">$</span>
                <input
                  type="number"
                  step="0.001"
                  required
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#003049] focus:outline-none font-bold text-[#003049]"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">What our organization pays to hire this service</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Commercial Benchmark ($)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400 text-xs">$</span>
                <input
                  type="number"
                  step="0.001"
                  value={retailPrice}
                  onChange={(e) => setRetailPrice(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#003049] focus:outline-none text-slate-800"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Typical third-party open market rate</p>
            </div>
          </div>

          {/* Volume Tier Ranges Editor */}
          <div className="border border-amber-200 bg-[#fdf0d5]/30 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-900">
                <Scale className="w-3.5 h-3.5 text-amber-700" />
                <span>Volume Pricing Tier Ranges ({tiers.length} Brackets)</span>
              </div>
              <button
                type="button"
                onClick={handleAddTier}
                className="text-[11px] bg-white border border-[#ecd5a8] text-[#003049] px-2 py-0.5 rounded font-semibold hover:bg-amber-50 cursor-pointer shadow-2xs"
              >
                + Add Range Tier
              </button>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto">
              {tiers.map((t: any, idx: number) => (
                <div key={idx} className="bg-white rounded-lg border border-amber-200 p-2 text-xs flex items-center gap-2">
                  <div className="w-20">
                    <span className="text-[10px] text-slate-500 block">Min Volume</span>
                    <input
                      type="number"
                      value={t.minVolume}
                      onChange={(e) => handleUpdateTier(idx, 'minVolume', parseInt(e.target.value) || 0)}
                      className="w-full px-1.5 py-0.5 border border-slate-300 rounded text-xs font-mono"
                    />
                  </div>
                  <div className="w-20">
                    <span className="text-[10px] text-slate-500 block">Max Volume</span>
                    <input
                      type="number"
                      placeholder="+"
                      value={t.maxVolume || ''}
                      onChange={(e) =>
                        handleUpdateTier(idx, 'maxVolume', e.target.value ? parseInt(e.target.value) : undefined)
                      }
                      className="w-full px-1.5 py-0.5 border border-slate-300 rounded text-xs font-mono"
                    />
                  </div>
                  <div className="w-24">
                    <span className="text-[10px] text-slate-500 block">Tier Rate ($)</span>
                    <input
                      type="number"
                      step="0.01"
                      value={t.rate}
                      onChange={(e) => handleUpdateTier(idx, 'rate', parseFloat(e.target.value) || 0)}
                      className="w-full px-1.5 py-0.5 border border-slate-300 rounded text-xs font-bold text-[#003049]"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="text-[10px] text-slate-500 block">Bracket Description</span>
                    <input
                      type="text"
                      value={t.description}
                      onChange={(e) => handleUpdateTier(idx, 'description', e.target.value)}
                      className="w-full px-1.5 py-0.5 border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveTier(idx)}
                    className="p-1 hover:bg-red-50 text-red-600 rounded cursor-pointer mt-3"
                    title="Remove Tier"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Audit Logging Details */}
          <div className="border border-slate-200 bg-slate-50 rounded-xl p-3 space-y-2">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
              <History className="w-3.5 h-3.5 text-[#003049]" />
              <span>Audit Change Log Requirements</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Reason for Tariff Revision <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Fuel surcharge index recalculation, annual contracted volume renegotiation..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#003049] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Authorized Auditor / Officer Name
              </label>
              <input
                type="text"
                value={auditor}
                onChange={(e) => setAuditor(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#003049] focus:outline-none"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-[#003049] hover:bg-[#002235] text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              Commit Revision & Log Change
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ========================================================================= */
/* OUTSOURCED AUDIT HISTORY CHANGE LOG MODAL                                 */
/* ========================================================================= */

interface OutsourcedAuditHistoryModalProps {
  service: OutsourcedService;
  onClose: () => void;
}

const OutsourcedAuditHistoryModal: React.FC<OutsourcedAuditHistoryModalProps> = ({
  service,
  onClose
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center space-x-1">
                <History className="w-3 h-3 text-amber-600" />
                <span>OFFICIAL TARIFF AUDIT LOG</span>
              </span>
              <span className="text-xs text-slate-500 font-mono">{service.id.toUpperCase()}</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1">{service.name}</h3>
            <p className="text-xs text-slate-500">
              Provider: <strong className="text-slate-700">{service.providerName}</strong> • Category:{' '}
              <strong className="text-slate-700">{service.category}</strong> &gt;{' '}
              <span className="text-slate-600">{service.subCategory}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Tariff Overview Banner */}
        <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs">
          <div>
            <span className="text-[10px] uppercase text-slate-500 font-semibold block">Current Hired Rate</span>
            <span className="text-base font-bold text-[#003049]">
              ${service.rate < 1 ? service.rate.toFixed(3) : service.rate.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 ml-1">/ {service.baseUnitType.replace('per_', '')}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-slate-500 font-semibold block">Commercial Benchmark</span>
            <span className="text-base font-semibold text-slate-700">
              {service.retailPrice ? `$${service.retailPrice < 1 ? service.retailPrice.toFixed(3) : service.retailPrice.toFixed(2)}` : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-slate-500 font-semibold block">Total Revisions</span>
            <span className="text-base font-bold text-amber-700">{service.priceHistory?.length || 0}</span>
            <span className="text-[10px] text-slate-400 ml-1">audited events</span>
          </div>
        </div>

        {/* Chronological Change Logs Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Chronological Rate Revisions & Authorized Reasons
            </h4>
            <span className="text-[11px] text-slate-500">ISO 9001 / Internal Audit Compliant</span>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3 font-semibold">Effective Date</th>
                  <th className="py-2 px-3 font-semibold">Rate Adjustment</th>
                  <th className="py-2 px-3 font-semibold">Audit Reason & Justification</th>
                  <th className="py-2 px-3 font-semibold">Audited By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {service.priceHistory && service.priceHistory.length > 0 ? (
                  service.priceHistory.map((h) => {
                    const diff = h.newRate - h.oldRate;
                    const pct = h.oldRate > 0 ? (diff / h.oldRate) * 100 : 0;
                    return (
                      <tr key={h.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-800 whitespace-nowrap">
                          {h.date}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="font-bold text-slate-900">
                            ${h.oldRate} → ${h.newRate}
                          </div>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.2 rounded inline-block mt-0.5 ${
                              diff > 0
                                ? 'bg-amber-100 text-amber-900'
                                : diff < 0
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {diff >= 0 ? '+' : ''}
                            {pct.toFixed(2)}% ({diff >= 0 ? '+$' : '-$'}{Math.abs(diff).toFixed(3)})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          <p className="text-xs leading-relaxed">{h.reason}</p>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                          {h.updatedBy || 'Director of Procurement'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-400 italic">
                      No historical rate revisions recorded. Initial contract baseline rate active.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#003049] hover:bg-[#002235] text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Close Audit Trail
          </button>
        </div>
      </div>
    </div>
  );
};

/* ========================================================================= */
/* OUTSOURCED VOLUME RANGES & SIMULATOR MODAL                                */
/* ========================================================================= */

interface OutsourcedVolumeRangesModalProps {
  service: OutsourcedService;
  onClose: () => void;
}

const OutsourcedVolumeRangesModal: React.FC<OutsourcedVolumeRangesModalProps> = ({
  service,
  onClose
}) => {
  const [simVolume, setSimVolume] = useState<number>(100);

  // Compute matched tier
  const tiers = service.tierRates || [];
  const matchedTier = tiers.find((t) => {
    if (t.maxVolume) {
      return simVolume >= t.minVolume && simVolume <= t.maxVolume;
    }
    return simVolume >= t.minVolume;
  }) || {
    rate: service.rate,
    description: 'Contract Standard Rate'
  };

  const totalCost = simVolume * matchedTier.rate;
  const baselineCost = simVolume * service.rate;
  const savings = baselineCost - totalCost;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-[#fdf0d5] border border-[#ecd5a8] px-2 py-0.5 rounded flex items-center space-x-1">
                <Scale className="w-3 h-3 text-amber-700" />
                <span>CONTRACT VOLUME RANGES</span>
              </span>
              <span className="text-xs text-slate-500 font-mono">{service.id.toUpperCase()}</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1">{service.name}</h3>
            <p className="text-xs text-slate-500">
              Provider: <strong className="text-slate-700">{service.providerName}</strong> • Unit:{' '}
              <strong className="text-slate-700">{service.baseUnitType.replace(/_/g, ' ')}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tier Range Matrix Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Contract Volume Tier Pricing Brackets
          </h4>
          <div className="overflow-hidden rounded-xl border border-slate-200 text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3 font-semibold">Tier Range</th>
                  <th className="py-2 px-3 font-semibold">Contract Rate</th>
                  <th className="py-2 px-3 font-semibold">Description</th>
                  <th className="py-2 px-3 font-semibold text-right">Discount vs Base</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tiers.length > 0 ? (
                  tiers.map((t, idx) => {
                    const discount = service.rate > 0 ? ((service.rate - t.rate) / service.rate) * 100 : 0;
                    const isCurrentMatched =
                      (t.maxVolume ? simVolume >= t.minVolume && simVolume <= t.maxVolume : simVolume >= t.minVolume);

                    return (
                      <tr
                        key={idx}
                        className={isCurrentMatched ? 'bg-amber-50/80 font-medium' : 'hover:bg-slate-50'}
                      >
                        <td className="py-2 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                          {t.minVolume} {t.maxVolume ? `- ${t.maxVolume}` : '+'} units
                        </td>
                        <td className="py-2 px-3 font-bold text-[#003049] whitespace-nowrap">
                          ${t.rate} / {service.baseUnitType.replace('per_', '')}
                        </td>
                        <td className="py-2 px-3 text-slate-600">{t.description}</td>
                        <td className="py-2 px-3 text-right font-semibold whitespace-nowrap">
                          {discount > 0 ? (
                            <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px]">
                              -{discount.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">Baseline</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="py-3 text-center text-slate-400 italic">
                      Single flat rate schedule (${service.rate} / {service.baseUnitType})
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Interactive Volume Cost Simulator */}
        <div className="bg-[#fdf0d5]/40 border border-[#ecd5a8] rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
              Interactive Volume Cost Calculator
            </span>
            <span className="text-[11px] text-amber-800 font-medium">
              Calculates cost at volume tier
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Test Volume Quantity ({service.baseUnitType.replace(/_/g, ' ')})
            </label>
            <input
              type="number"
              min="1"
              value={simVolume}
              onChange={(e) => setSimVolume(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#003049] focus:outline-none font-mono font-bold text-slate-900"
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs pt-1">
            <div className="bg-white p-2.5 rounded-lg border border-[#ecd5a8]">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Applied Rate</span>
              <span className="text-sm font-bold text-[#003049]">${matchedTier.rate}</span>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-[#ecd5a8]">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total Hired Cost</span>
              <span className="text-sm font-extrabold text-slate-900">
                ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-[#ecd5a8]">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Volume Savings</span>
              <span className="text-sm font-bold text-emerald-700">
                {savings > 0 ? `$${savings.toFixed(2)}` : '$0.00'}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#003049] hover:bg-[#002235] text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Close Calculator
          </button>
        </div>
      </div>
    </div>
  );
};
