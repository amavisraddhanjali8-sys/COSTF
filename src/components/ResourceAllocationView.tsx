import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Cpu,
  Truck,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Briefcase,
  Layers,
  Search,
  Filter,
  ArrowRight,
  FolderGit2,
  AlertTriangle,
  Sliders,
  Sparkles,
  BarChart3,
  Check,
  ChevronDown,
  X,
  Edit2,
  Info,
  Trash2,
  Plus,
  RotateCcw,
  Wrench,
  Cog,
  HardHat,
  Scale,
  DollarSign,
  TrendingUp,
  TrendingDown,
  LayoutGrid,
  Table as TableIcon,
  Download,
  ExternalLink,
  ShieldAlert,
  ArrowUpDown
} from 'lucide-react';
import {
  Project,
  SubcontractorRateItem,
  OutsourcedService,
  Supplier,
  AppUser,
  ProjectPhase,
  ProjectCostItem,
  EnterpriseResource,
  EnterpriseResourceType,
  ResourceAlternative,
  ResourceAllocation
} from '../types';
import { formatCurrency } from '../utils/currency';
import { SubcontractorCapacityBarChart } from './SubcontractorCapacityBarChart';
import {
  calculatePhaseCapacityMetrics,
  ProjectCapacitySummary
} from '../utils/capacityCalculation';
import { api } from '../services/api';

interface ResourceAllocationViewProps {
  selectedProject?: Project | null;
  projects: Project[];
  subcontractors: SubcontractorRateItem[];
  outsourcedServices: OutsourcedService[];
  suppliers: Supplier[];
  currentUser?: AppUser;
  onSelectProject?: (proj: Project) => void;
  onOpenProjectPicker?: () => void;
  onNavigateToLanding?: () => void;
  onNavigateToSubcontractors: () => void;
  onNavigateToOutsourced: () => void;
  onUpdateProject?: (updatedProject: Project) => void;
  initialTypeFilter?: string;
}

export const ResourceAllocationView: React.FC<ResourceAllocationViewProps> = ({
  selectedProject,
  projects,
  subcontractors,
  outsourcedServices,
  suppliers,
  currentUser,
  onSelectProject,
  onOpenProjectPicker,
  onNavigateToLanding,
  onNavigateToSubcontractors,
  onNavigateToOutsourced,
  onUpdateProject,
  initialTypeFilter
}) => {
  const [scope, setScope] = useState<'selected' | 'all'>('selected');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  
  // Type filter: 'all' | 'labour' | 'machinery' | 'equipment' | 'tool' | 'material' | 'subcontractor'
  const [filterType, setFilterType] = useState<string>(initialTypeFilter || 'all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedSubCategoryFilter, setSelectedSubCategoryFilter] = useState<string>('all');
  const [selectedPhaseFilter, setSelectedPhaseFilter] = useState<string>('all');
  const [selectedCapacityFilter, setSelectedCapacityFilter] = useState<'all' | 'over_allocated' | 'near_capacity' | 'within_capacity'>('all');
  const [search, setSearch] = useState('');

  // PostgreSQL Resources State
  const [dbResources, setDbResources] = useState<EnterpriseResource[]>([]);
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Fetch real resources from PostgreSQL
  const fetchResources = async () => {
    try {
      setIsLoadingResources(true);
      const res = await api.getResources();
      if (Array.isArray(res)) {
        setDbResources(res);
      }
    } catch (e) {
      console.warn('Failed to fetch resources from PostgreSQL:', e);
    } finally {
      setIsLoadingResources(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, []);

  // Listen for navigation events with filters from HomeCommandView or Project cards
  useEffect(() => {
    const handleFilterEvent = (e: any) => {
      if (e.detail?.type) {
        setFilterType(e.detail.type);
      }
      if (e.detail?.viewMode) {
        setViewMode(e.detail.viewMode);
      }
      if (e.detail?.openCreate) {
        setIsCreateModalOpen(true);
      }
      if (e.detail?.openCompare) {
        if (dbResources.length > 0) {
          setComparisonResource(dbResources[0]);
        }
      }
    };
    window.addEventListener('fxtt-resource-filter', handleFilterEvent);
    return () => window.removeEventListener('fxtt-resource-filter', handleFilterEvent);
  }, [dbResources]);

  // Target project to inspect
  const activeProj = selectedProject || projects[0] || null;

  // Live D3 capacity metrics
  const capacitySummary: ProjectCapacitySummary = useMemo(() => {
    if (!activeProj) {
      return {
        projectCode: 'N/A',
        projectName: 'No Project Selected',
        totalCapacityHours: 0,
        totalAllocatedHours: 0,
        totalRemainingHours: 0,
        totalOverAllocatedHours: 0,
        overallUtilizationPct: 0,
        overAllocatedPhaseCount: 0,
        totalPhaseCount: 0,
        phases: []
      };
    }
    return calculatePhaseCapacityMetrics(activeProj);
  }, [activeProj]);

  // Combine PostgreSQL Enterprise Resources with any Project Allocated Items
  const allResources = useMemo(() => {
    // Start with dbResources as single source of truth from PostgreSQL
    const list: EnterpriseResource[] = [...dbResources];

    // Check project selected items and ensure any item not in dbResources is represented
    const targetProjects = (scope === 'selected' && activeProj) ? [activeProj] : projects;

    targetProjects.forEach((proj) => {
      (proj.selectedItems || []).forEach((item) => {
        const itemType = (
          item.type === 'labour' || item.type === 'machinery' || item.type === 'equipment' ||
          item.type === 'tool' || item.type === 'material' || item.type === 'subcontractor' ||
          item.type === 'outsourced'
        ) ? (item.type as EnterpriseResourceType) : 'material';

        const phaseObj = (proj.phases || []).find((p) => p.id === item.phaseId);
        const itemSpend = typeof item.totalCost === 'number' ? item.totalCost : ((item.quantity || 1) * (item.unitCost || 0));

        const existing = list.find(
          (r) => r.id === item.itemId || r.name.toLowerCase() === item.name.toLowerCase()
        );

        const allocation: ResourceAllocation = {
          projectId: proj.id,
          projectCode: proj.code,
          projectName: proj.name,
          phaseId: item.phaseId,
          phaseName: phaseObj ? phaseObj.name.split(':')[0] : 'General',
          quantity: item.quantity,
          unit: item.unit,
          totalCost: itemSpend,
          currency: proj.currency || 'LKR'
        };

        if (existing) {
          if (!existing.connectedAllocations) existing.connectedAllocations = [];
          const hasAlloc = existing.connectedAllocations.some(
            (a) => a.projectCode === proj.code && a.phaseId === item.phaseId
          );
          if (!hasAlloc) {
            existing.connectedAllocations.push(allocation);
          }
        } else {
          list.push({
            id: item.id,
            code: `RES-${itemType.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
            name: item.name,
            type: itemType,
            category: item.category || 'General',
            subCategory: item.subCategory || 'Standard',
            unit: item.unit || 'unit',
            baseRate: item.unitCost || 0,
            operationalCharge: 0,
            chargeType: 'hourly',
            currency: proj.currency || 'LKR',
            supplierName: item.supplierOrProvider || 'Assigned Provider',
            competitorCompany: 'Industry Standard',
            competitorRate: Math.round((item.unitCost || 0) * 1.15),
            industryBenchmarkRate: Math.round((item.unitCost || 0) * 1.08),
            status: 'Available',
            skillOrSla: itemType === 'subcontractor'
              ? 'Certified Specialist Labor'
              : itemType === 'labour'
              ? 'Skilled Technical Specialist'
              : itemType === 'machinery'
              ? 'Heavy Precision Machinery'
              : itemType === 'equipment'
              ? 'Precision Certified Rig'
              : itemType === 'tool'
              ? 'Tungsten Carbide Tooling'
              : 'Raw Material Supplier Stock',
            alternatives: [],
            connectedAllocations: [allocation]
          });
        }
      });
    });

    return list;
  }, [dbResources, projects, activeProj, scope]);

  // Unique categories and subcategories for filters
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    allResources.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set);
  }, [allResources]);

  const subCategoriesList = useMemo(() => {
    const set = new Set<string>();
    allResources.forEach((r) => {
      if (selectedCategoryFilter === 'all' || r.category === selectedCategoryFilter) {
        if (r.subCategory) set.add(r.subCategory);
      }
    });
    return Array.from(set);
  }, [allResources, selectedCategoryFilter]);

  // Filtered resources pipeline
  const filteredResources = useMemo(() => {
    return allResources.filter((r) => {
      // Type filter
      if (filterType !== 'all' && r.type !== filterType) return false;
      // Category filter
      if (selectedCategoryFilter !== 'all' && r.category !== selectedCategoryFilter) return false;
      // Sub-category filter
      if (selectedSubCategoryFilter !== 'all' && r.subCategory !== selectedSubCategoryFilter) return false;

      // Project scope filter
      if (scope === 'selected' && activeProj) {
        const hasProjectAllocation = (r.connectedAllocations || []).some(
          (a) => a.projectCode === activeProj.code || a.projectId === activeProj.id
        );
        // In selected project scope, also allow resources belonging to the active project
        if (!hasProjectAllocation && r.status === 'Allocated') return false;
      }

      // Phase filter
      if (selectedPhaseFilter !== 'all') {
        const matchesPhase = (r.connectedAllocations || []).some((a) => a.phaseId === selectedPhaseFilter);
        if (!matchesPhase) return false;
      }

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          r.name.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          (r.subCategory || '').toLowerCase().includes(q) ||
          (r.supplierName || '').toLowerCase().includes(q) ||
          (r.competitorCompany || '').toLowerCase().includes(q) ||
          r.type.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [allResources, filterType, selectedCategoryFilter, selectedSubCategoryFilter, scope, activeProj, selectedPhaseFilter, search]);

  // Total allocated spend breakdown across resource types for active project
  const costingBreakdown = useMemo(() => {
    let labour = 0;
    let machinery = 0;
    let equipment = 0;
    let tool = 0;
    let material = 0;
    let subcontractor = 0;
    let total = 0;

    const items = activeProj?.selectedItems || [];
    items.forEach((item) => {
      const spend = typeof item.totalCost === 'number' ? item.totalCost : ((item.quantity || 1) * (item.unitCost || 0));
      total += spend;
      if (item.type === 'labour') labour += spend;
      else if (item.type === 'machinery') machinery += spend;
      else if (item.type === 'equipment') equipment += spend;
      else if (item.type === 'tool') tool += spend;
      else if (item.type === 'subcontractor') subcontractor += spend;
      else material += spend;
    });

    return { labour, machinery, equipment, tool, material, subcontractor, total };
  }, [activeProj]);

  // Modal States
  // 1. Create Resource Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<EnterpriseResource>>({
    name: '',
    type: 'labour',
    category: 'General Engineering',
    subCategory: 'Specialist',
    unit: 'hr',
    baseRate: 75,
    operationalCharge: 0,
    chargeType: 'hourly',
    currency: activeProj?.currency || 'LKR',
    supplierName: '',
    competitorCompany: '',
    competitorRate: 85,
    industryBenchmarkRate: 80,
    status: 'Available',
    skillOrSla: 'Certified Industrial Grade',
    notes: ''
  });

  // 2. Edit Resource Modal
  const [editingResource, setEditingResource] = useState<EnterpriseResource | null>(null);

  // 3. Alternatives & Industry Comparison Modal
  const [comparisonResource, setComparisonResource] = useState<EnterpriseResource | null>(null);
  const [isAddAlternativeOpen, setIsAddAlternativeOpen] = useState(false);
  const [newAlternative, setNewAlternative] = useState<Partial<ResourceAlternative>>({
    name: '',
    providerOrCompetitor: '',
    type: 'supplier_alternative',
    rate: 70,
    unit: 'hr',
    operationalCharge: 0,
    leadTimeDays: 2,
    reliabilityRating: 4.8,
    isRecommended: true,
    notes: ''
  });

  // 4. Allocate Resource to Project Modal
  const [allocatingResource, setAllocatingResource] = useState<EnterpriseResource | null>(null);
  const [allocTargetProject, setAllocTargetProject] = useState<string>(activeProj?.id || '');
  const [allocTargetPhase, setAllocTargetPhase] = useState<string>(activeProj?.phases?.[0]?.id || 'phase-01');
  const [allocTargetPlan, setAllocTargetPlan] = useState<string>('');
  const [targetProjectPlans, setTargetProjectPlans] = useState<any[]>([]);
  const [allocQty, setAllocQty] = useState<number>(40);
  const [allocRate, setAllocRate] = useState<number>(75);

  useEffect(() => {
    if (allocTargetProject) {
      api.getProjectPlans(allocTargetProject)
        .then((plans) => {
          setTargetProjectPlans(plans || []);
          const activePlan = plans?.find((p: any) => p.is_active || p.isActive) || plans?.[0];
          if (activePlan) {
            setAllocTargetPlan(activePlan.id);
          } else {
            setAllocTargetPlan('');
          }
        })
        .catch(() => setTargetProjectPlans([]));
    }
  }, [allocTargetProject]);

  // 5. Delete confirmation
  const [resourceToDelete, setResourceToDelete] = useState<EnterpriseResource | null>(null);

  // 6. Capacity hours edit modal
  const [isEditCapacityModalOpen, setIsEditCapacityModalOpen] = useState(false);
  const [editingCapacities, setEditingCapacities] = useState<Record<string, number>>({});

  // Handlers
  const handleSaveNewResource = async () => {
    if (!formData.name?.trim()) return;
    try {
      const created = await api.createResource({
        ...formData,
        currency: formData.currency || activeProj?.currency || 'LKR'
      });
      setDbResources((prev) => [created, ...prev.filter((r) => r.id !== created.id)]);
      setIsCreateModalOpen(false);
      setSaveSuccess(`Resource "${created.name}" saved to PostgreSQL database.`);
      setTimeout(() => setSaveSuccess(null), 3500);
    } catch (e: any) {
      alert(`Error saving resource: ${e?.message || 'Database error'}`);
    }
  };

  const handleSaveEditedResource = async () => {
    if (!editingResource) return;
    try {
      const updated = await api.updateResource(editingResource.id, editingResource);
      setDbResources((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setEditingResource(null);
      setSaveSuccess(`Resource "${updated.name}" updated in PostgreSQL database.`);
      setTimeout(() => setSaveSuccess(null), 3500);
    } catch (e: any) {
      alert(`Error updating resource: ${e?.message || 'Database error'}`);
    }
  };

  const handleDeleteResource = async () => {
    if (!resourceToDelete) return;
    try {
      await api.deleteResource(resourceToDelete.id);
      setDbResources((prev) => prev.filter((r) => r.id !== resourceToDelete.id));
      setSaveSuccess(`Resource "${resourceToDelete.name}" deleted from database.`);
      setResourceToDelete(null);
      setTimeout(() => setSaveSuccess(null), 3500);
    } catch (e: any) {
      alert(`Error deleting resource: ${e?.message || 'Database error'}`);
    }
  };

  const handleAddAlternativeToResource = async () => {
    if (!comparisonResource || !newAlternative.name?.trim()) return;
    try {
      const updated = await api.addResourceAlternative(comparisonResource.id, newAlternative);
      setDbResources((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setComparisonResource(updated);
      setIsAddAlternativeOpen(false);
      setNewAlternative({
        name: '',
        providerOrCompetitor: '',
        type: 'supplier_alternative',
        rate: 70,
        unit: comparisonResource.unit,
        operationalCharge: 0,
        leadTimeDays: 2,
        reliabilityRating: 4.8,
        isRecommended: true,
        notes: ''
      });
      setSaveSuccess('Alternative added to PostgreSQL.');
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (e: any) {
      alert(`Error adding alternative: ${e?.message}`);
    }
  };

  const handleApplyAlternative = async (altId: string) => {
    if (!comparisonResource) return;
    try {
      const updated = await api.applyResourceAlternative(
        comparisonResource.id,
        altId,
        `Switched to industry alternative via comparison matrix`,
        currentUser?.name || 'Administrator'
      );
      setDbResources((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setComparisonResource(updated);

      // Also update project selected items if this resource was connected
      if (activeProj && onUpdateProject) {
        const updatedItems = (activeProj.selectedItems || []).map((item) => {
          if (item.itemId === updated.id || item.name.toLowerCase() === updated.name.toLowerCase()) {
            return {
              ...item,
              unitCost: updated.baseRate,
              supplierOrProvider: updated.supplierName || item.supplierOrProvider,
              totalCost: (item.quantity || 1) * updated.baseRate
            };
          }
          return item;
        });
        onUpdateProject({ ...activeProj, selectedItems: updatedItems });
      }

      setSaveSuccess(`Applied alternative rate: ${formatCurrency(updated.baseRate, updated.currency)} / ${updated.unit}`);
      setTimeout(() => setSaveSuccess(null), 3500);
    } catch (e: any) {
      alert(`Error applying alternative: ${e?.message}`);
    }
  };

  const handleExecuteAllocation = async () => {
    if (!allocatingResource || !allocTargetProject) return;
    try {
      await api.allocateResourceToProject(
        allocatingResource.id,
        allocTargetProject,
        allocTargetPhase,
        allocQty,
        allocatingResource.unit,
        allocRate,
        allocTargetPlan || undefined
      );

      // Refresh resources from PostgreSQL
      await fetchResources();

      // Update local project in React state
      const targetProj = projects.find((p) => p.id === allocTargetProject);
      if (targetProj && onUpdateProject) {
        const phase = targetProj.phases?.find((ph) => ph.id === allocTargetPhase) || targetProj.phases?.[0];
        const newItem: ProjectCostItem = {
          id: `cost-${Date.now()}`,
          phaseId: phase?.id || 'phase-01',
          type: allocatingResource.type,
          itemId: allocatingResource.id,
          name: allocatingResource.name,
          category: allocatingResource.category,
          subCategory: allocatingResource.subCategory,
          supplierOrProvider: allocatingResource.supplierName || 'Assigned Provider',
          quantity: allocQty,
          unit: allocatingResource.unit,
          unitCost: allocRate,
          totalCost: allocQty * allocRate,
          notes: `Allocated from Resource Portal: ${allocatingResource.code}`
        };
        onUpdateProject({
          ...targetProj,
          selectedItems: [...(targetProj.selectedItems || []), newItem]
        });
      }

      setAllocatingResource(null);
      setSaveSuccess(`Allocated ${allocQty} ${allocatingResource.unit} to project.`);
      setTimeout(() => setSaveSuccess(null), 3500);
    } catch (e: any) {
      alert(`Allocation error: ${e?.message}`);
    }
  };

  // Helper icon for resource type
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'labour':
        return <HardHat className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />;
      case 'machinery':
        return <Cog className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
      case 'equipment':
        return <Cpu className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />;
      case 'tool':
        return <Wrench className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />;
      case 'material':
        return <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
      case 'subcontractor':
        return <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />;
      default:
        return <Briefcase className="w-3.5 h-3.5 text-slate-600" />;
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'labour':
        return 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-sky-300 border-blue-200 dark:border-blue-800';
      case 'machinery':
        return 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'equipment':
        return 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'tool':
        return 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      case 'material':
        return 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'subcontractor':
        return 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-3.5 font-sans">
      {/* Toast Notification */}
      {saveSuccess && (
        <div className="bg-[#003049] dark:bg-slate-800 border border-[#0078d4] text-white px-4 py-2 rounded-xl text-xs flex items-center justify-between shadow-lg animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold">{saveSuccess}</span>
          </div>
          <button type="button" onClick={() => setSaveSuccess(null)} className="text-white/70 hover:text-white cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {/* 1. TOP HEADER & CONTROLS BAR (Matches screenshot layout) */}
      <div className="bg-white dark:bg-[#0b101b] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-[#0078d4]/10 text-[#0078d4]">
            <Wrench className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Resources
              </h2>
            </div>
            <div className="text-xs text-slate-500 mt-0.5 flex items-center space-x-2">
              <span>Spend:</span>
              <strong className="text-slate-900 dark:text-slate-100 font-bold">
                {formatCurrency(costingBreakdown.total, 'LKR')}
              </strong>
              <span>•</span>
              <span>{filteredResources.length}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* View Mode Toggle: Cards vs Table */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1 rounded-md transition-colors font-medium cursor-pointer flex items-center space-x-1 ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-[#0f172a] text-[#0078d4] dark:text-sky-300 shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3 h-3" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded-md transition-colors font-medium cursor-pointer flex items-center space-x-1 ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-[#0f172a] text-[#0078d4] dark:text-sky-300 shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3 h-3" />
              <span>Table</span>
            </button>
          </div>

          {/* Scope Toggle: Project vs All */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setScope('selected')}
              className={`px-2.5 py-1 rounded-md transition-colors font-medium cursor-pointer ${
                scope === 'selected'
                  ? 'bg-white dark:bg-[#0f172a] text-[#0078d4] dark:text-sky-300 shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Project
            </button>
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`px-2.5 py-1 rounded-md transition-colors font-medium cursor-pointer ${
                scope === 'all'
                  ? 'bg-white dark:bg-[#0f172a] text-[#0078d4] dark:text-sky-300 shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              All
            </button>
          </div>

          {/* Projects Navigation Button */}
          {onNavigateToLanding && (
            <button
              type="button"
              onClick={onNavigateToLanding}
              className="flex items-center space-x-1 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
              title="Projects"
            >
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              <span>Projects</span>
            </button>
          )}

          {/* Action Buttons with Simple One-Word Labels */}
          <button
            type="button"
            onClick={() => {
              setFormData({
                name: '',
                type: 'labour',
                category: 'General Engineering',
                subCategory: 'Specialist',
                unit: 'hr',
                baseRate: 75,
                operationalCharge: 0,
                chargeType: 'hourly',
                currency: activeProj?.currency || 'LKR',
                supplierName: '',
                competitorCompany: '',
                competitorRate: 85,
                industryBenchmarkRate: 80,
                status: 'Available',
                skillOrSla: 'Certified Industrial Grade',
                notes: ''
              });
              setIsCreateModalOpen(true);
            }}
            className="flex items-center space-x-1 px-3 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Resource</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const resWithAlts = allResources.find((r) => r.alternatives && r.alternatives.length > 0) || allResources[0];
              if (resWithAlts) setComparisonResource(resWithAlts);
            }}
            className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            <Scale className="w-3.5 h-3.5 text-[#0078d4]" />
            <span>Compare</span>
          </button>
        </div>
      </div>

      {/* 2. COST BREAKDOWN MINI DASHBOARD (Live Project Costing of Labours, Machineries, Equipments, Tools) */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
        <div className="bg-white dark:bg-[#0b101b] p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center space-x-1.5">
            <HardHat className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Labour</span>
          </div>
          <div className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
            {formatCurrency(costingBreakdown.labour, activeProj?.currency)}
          </div>
        </div>

        <div className="bg-white dark:bg-[#0b101b] p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center space-x-1.5">
            <Cog className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Machinery</span>
          </div>
          <div className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
            {formatCurrency(costingBreakdown.machinery, activeProj?.currency)}
          </div>
        </div>

        <div className="bg-white dark:bg-[#0b101b] p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center space-x-1.5">
            <Cpu className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Equipment</span>
          </div>
          <div className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
            {formatCurrency(costingBreakdown.equipment, activeProj?.currency)}
          </div>
        </div>

        <div className="bg-white dark:bg-[#0b101b] p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center space-x-1.5">
            <Wrench className="w-3.5 h-3.5 text-rose-500" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tools</span>
          </div>
          <div className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
            {formatCurrency(costingBreakdown.tool, activeProj?.currency)}
          </div>
        </div>

        <div className="bg-white dark:bg-[#0b101b] p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center space-x-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Materials</span>
          </div>
          <div className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
            {formatCurrency(costingBreakdown.material, activeProj?.currency)}
          </div>
        </div>

        <div className="bg-white dark:bg-[#0b101b] p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center space-x-1.5">
            <Users className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Subcontract</span>
          </div>
          <div className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
            {formatCurrency(costingBreakdown.subcontractor, activeProj?.currency)}
          </div>
        </div>
      </div>

      {/* 3. D3 SUBCONTRACTOR CAPACITY BAR CHART (From screenshot) */}
      {activeProj && (
        <div className="bg-white dark:bg-[#0b101b] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Phase:
                </span>
                <select
                  value={selectedPhaseFilter}
                  onChange={(e) => setSelectedPhaseFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0078d4] cursor-pointer"
                >
                  <option value="all">All Project Phases ({capacitySummary.phases.length})</option>
                  {capacitySummary.phases.map((p) => (
                    <option key={p.phaseId} value={p.phaseId}>
                      {p.phaseName} ({p.allocatedHours}h / {p.capacityHours}h) {p.isOverAllocated ? '⚠️ Over' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Segmented Buttons */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedCapacityFilter('all')}
                  className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                    selectedCapacityFilter === 'all'
                      ? 'bg-white dark:bg-[#0f172a] text-[#003049] dark:text-sky-300 shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  All ({capacitySummary.phases.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCapacityFilter('over_allocated')}
                  className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                    selectedCapacityFilter === 'over_allocated'
                      ? 'bg-red-600 text-white shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-red-600'
                  }`}
                >
                  Over ({capacitySummary.overAllocatedPhaseCount})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCapacityFilter('near_capacity')}
                  className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                    selectedCapacityFilter === 'near_capacity'
                      ? 'bg-amber-500 text-white shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-amber-600'
                  }`}
                >
                  Near Limit
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCapacityFilter('within_capacity')}
                  className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                    selectedCapacityFilter === 'within_capacity'
                      ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600'
                  }`}
                >
                  Within Limit
                </button>
              </div>

              {(selectedPhaseFilter !== 'all' || selectedCapacityFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPhaseFilter('all');
                    setSelectedCapacityFilter('all');
                  }}
                  className="text-xs text-[#0078d4] hover:underline font-semibold cursor-pointer ml-1"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <SubcontractorCapacityBarChart
            capacityData={capacitySummary}
            selectedPhaseId={selectedPhaseFilter === 'all' ? null : selectedPhaseFilter}
            onSelectPhase={(phaseId) => setSelectedPhaseFilter(phaseId || 'all')}
            highlightCategory={selectedCapacityFilter}
            height={280}
          />
        </div>
      )}

      {/* 4. SEARCH, FILTER PILLS & CATEGORIZATION TOOLBAR */}
      <div className="bg-white dark:bg-[#0b101b] p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search resource, trade, machinery, tool..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#0078d4]"
            />
          </div>

          {/* Categorizing Dropdown */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Category:</span>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => {
                setSelectedCategoryFilter(e.target.value);
                setSelectedSubCategoryFilter('all');
              }}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#0078d4] cursor-pointer"
            >
              <option value="all">All Categories</option>
              {categoriesList.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Sub-categorizing Dropdown */}
          {subCategoriesList.length > 0 && (
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Sub:</span>
              <select
                value={selectedSubCategoryFilter}
                onChange={(e) => setSelectedSubCategoryFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#0078d4] cursor-pointer"
              >
                <option value="all">All Sub-Categories</option>
                {subCategoriesList.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="text-xs text-slate-500 font-mono">
            <strong>{filteredResources.length}</strong> items
          </div>
        </div>

        {/* Cost Type Filter Pills (Labours, Machineries, Equipments, Tools, Materials, Subcontractors) */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          {[
            { id: 'all', label: 'All', icon: <Layers className="w-3 h-3" /> },
            { id: 'labour', label: 'Labour', icon: <HardHat className="w-3 h-3" /> },
            { id: 'machinery', label: 'Machinery', icon: <Cog className="w-3 h-3" /> },
            { id: 'equipment', label: 'Equipment', icon: <Cpu className="w-3 h-3" /> },
            { id: 'tool', label: 'Tools', icon: <Wrench className="w-3 h-3" /> },
            { id: 'material', label: 'Materials', icon: <Layers className="w-3 h-3" /> },
            { id: 'subcontractor', label: 'Subcontractors', icon: <Users className="w-3 h-3" /> }
          ].map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setFilterType(btn.id)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer ${
                filterType === btn.id
                  ? 'bg-[#0078d4] text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {btn.icon}
              <span>{btn.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 5A. CARDS VIEW (Matches screenshot format) */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredResources.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400 bg-white dark:bg-[#0b101b] rounded-xl border border-slate-200 dark:border-slate-800">
              No resources found matching the selected filter. Click "+ Resource" to add.
            </div>
          ) : (
            filteredResources.map((item) => {
              const hasAlternatives = item.alternatives && item.alternatives.length > 0;
              const allocations = item.connectedAllocations || [];
              const totalAllocSpend = allocations.reduce((sum, a) => sum + (a.totalCost || 0), 0);

              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-[#0b101b] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-2xs flex flex-col justify-between space-y-3"
                >
                  <div>
                    {/* Header tags and Rate */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${getTypeBadgeClass(
                              item.type
                            )}`}
                          >
                            {item.type}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {item.category || 'General'}
                          </span>
                          {item.subCategory && (
                            <span className="text-[10px] font-medium text-slate-400 bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                              {item.subCategory}
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1.5">
                          {item.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>{item.supplierName || item.competitorCompany || 'Assigned Supplier'}</span>
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 uppercase">Rate</div>
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
                          {formatCurrency(item.baseRate, item.currency)} / {item.unit}
                        </div>
                        {item.operationalCharge ? (
                          <div className="text-[10px] text-slate-400 font-mono">
                            +{formatCurrency(item.operationalCharge, item.currency)} ops
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Industry Competitor Benchmark Badge */}
                    {(item.competitorRate || item.industryBenchmarkRate) && (
                      <div className="mt-2 flex items-center justify-between text-[10px] bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded border border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500">Benchmark: {formatCurrency(item.industryBenchmarkRate || 0, item.currency)}</span>
                        {item.competitorRate ? (
                          <span className="text-slate-500">
                            Competitor: <strong className="text-slate-700 dark:text-slate-300">{formatCurrency(item.competitorRate, item.currency)}</strong>
                          </span>
                        ) : null}
                      </div>
                    )}

                    {/* CONNECTED ALLOCATIONS BOX (Matching Screenshot) */}
                    <div className="mt-3 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs">
                      <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                        Connected Allocations
                      </div>
                      {allocations.length === 0 ? (
                        <div className="text-[11px] text-slate-400 italic">No project allocations yet</div>
                      ) : (
                        allocations.map((p, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[11px]">
                            <span className="font-mono font-bold text-[#0078d4] dark:text-sky-400">
                              {p.projectCode}
                            </span>
                            <span className="text-slate-600 dark:text-slate-400 truncate max-w-[120px] font-mono">
                              {p.quantity} {p.unit}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                              {formatCurrency(p.totalCost, p.currency)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Card Bottom Row: Subtitle/SLA, Total Spend, Action Icons */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500 truncate max-w-[140px]">
                      {item.skillOrSla || item.category}
                    </span>
                    <div className="flex items-center space-x-2">
                      <div className="font-bold text-[#0078d4] dark:text-sky-400 font-mono">
                        Total: {formatCurrency(totalAllocSpend, item.currency)}
                      </div>
                      <div className="flex items-center space-x-1 pl-2 border-l border-slate-200 dark:border-slate-700">
                        {/* Compare Alternatives Button */}
                        <button
                          type="button"
                          onClick={() => setComparisonResource(item)}
                          className="p-1 text-slate-500 hover:text-[#0078d4] dark:hover:text-sky-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Compare Industry Alternatives"
                        >
                          <Scale className="w-3.5 h-3.5" />
                        </button>

                        {/* Allocate to Project Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setAllocatingResource(item);
                            setAllocTargetProject(activeProj?.id || projects[0]?.id || '');
                            setAllocTargetPhase(activeProj?.phases?.[0]?.id || 'phase-01');
                            setAllocRate(item.baseRate);
                            setAllocQty(40);
                          }}
                          className="p-1 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Allocate to Project"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => setEditingResource(item)}
                          className="p-1 text-slate-500 hover:text-[#0078d4] dark:hover:text-sky-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Edit Resource"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => setResourceToDelete(item)}
                          className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                          title="Delete Resource"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 5B. FXTT TABLES & RECORDS VIEW */}
      {viewMode === 'table' && (
        <div className="bg-white dark:bg-[#0b101b] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TableIcon className="w-4 h-4 text-[#0078d4]" />
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                FXTT Resources Records Grid
              </span>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              Total: <strong>{filteredResources.length}</strong> records
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Resource</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Sub-Category</th>
                  <th className="py-2.5 px-3 text-right">Rate</th>
                  <th className="py-2.5 px-3">Supplier / Provider</th>
                  <th className="py-2.5 px-3 text-right">Competitor</th>
                  <th className="py-2.5 px-3 text-right">Benchmark</th>
                  <th className="py-2.5 px-3 text-center">Alternatives</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredResources.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400">
                      No records found.
                    </td>
                  </tr>
                ) : (
                  filteredResources.map((res) => {
                    const altsCount = (res.alternatives || []).length;
                    return (
                      <tr key={res.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-[#0078d4] dark:text-sky-400">
                          {res.code}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                          {res.name}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${getTypeBadgeClass(res.type)}`}>
                            {res.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                          {res.category}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {res.subCategory || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(res.baseRate, res.currency)} / {res.unit}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                          {res.supplierName || res.competitorCompany || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                          {res.competitorRate ? formatCurrency(res.competitorRate, res.currency) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                          {res.industryBenchmarkRate ? formatCurrency(res.industryBenchmarkRate, res.currency) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => setComparisonResource(res)}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-[#0078d4] dark:text-sky-400 hover:bg-slate-200 cursor-pointer"
                          >
                            {altsCount} Alts
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              type="button"
                              onClick={() => {
                                setAllocatingResource(res);
                                setAllocTargetProject(activeProj?.id || projects[0]?.id || '');
                                setAllocTargetPhase(activeProj?.phases?.[0]?.id || 'phase-01');
                                setAllocRate(res.baseRate);
                                setAllocQty(40);
                              }}
                              className="p-1 text-slate-500 hover:text-emerald-600 rounded cursor-pointer"
                              title="Allocate"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingResource(res)}
                              className="p-1 text-slate-500 hover:text-[#0078d4] rounded cursor-pointer"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setResourceToDelete(res)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS & ACTION DIALOGS
         ========================================================================= */}

      {/* 1. CREATE RESOURCE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white dark:bg-[#0f172a] rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-[#0078d4]/10 rounded-lg text-[#0078d4]">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Add Resource
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Senior Avionics Specialist / CNC Machining Center"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:border-[#0078d4] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Type *
                </label>
                <select
                  value={formData.type || 'labour'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as EnterpriseResourceType })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:border-[#0078d4] focus:outline-none cursor-pointer"
                >
                  <option value="labour">Labour & Charges</option>
                  <option value="machinery">Machinery</option>
                  <option value="equipment">Equipment</option>
                  <option value="tool">Tools</option>
                  <option value="material">Materials</option>
                  <option value="subcontractor">Subcontractor</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Currency *
                </label>
                <select
                  value={formData.currency || activeProj?.currency || 'LKR'}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:border-[#0078d4] focus:outline-none cursor-pointer font-bold"
                >
                  <option value="LKR">LKR (Rs.)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="INR">INR (₹)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Charge Type
                </label>
                <select
                  value={formData.chargeType || 'hourly'}
                  onChange={(e) => setFormData({ ...formData, chargeType: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:border-[#0078d4] focus:outline-none cursor-pointer"
                >
                  <option value="hourly">Hourly Rate</option>
                  <option value="daily">Daily Rental</option>
                  <option value="shift">Shift Rate</option>
                  <option value="unit">Per Unit Consumable</option>
                  <option value="lump_sum">Lump Sum Contract</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Category *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Precision Engineering"
                  value={formData.category || ''}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:border-[#0078d4] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Sub-Category
                </label>
                <input
                  type="text"
                  placeholder="e.g. 5-Axis Milling"
                  value={formData.subCategory || ''}
                  onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:border-[#0078d4] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Base Rate ({formData.currency || activeProj?.currency || 'LKR'}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.baseRate || 0}
                  onChange={(e) => setFormData({ ...formData, baseRate: Number(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:border-[#0078d4] focus:outline-none font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Unit
                </label>
                <input
                  type="text"
                  placeholder="hr, day, pcs, kg"
                  value={formData.unit || 'hr'}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:border-[#0078d4] focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Operational Charge ({formData.currency || activeProj?.currency || 'LKR'})
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={formData.operationalCharge || 0}
                  onChange={(e) => setFormData({ ...formData, operationalCharge: Number(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:border-[#0078d4] focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Supplier / Vendor
                </label>
                <input
                  type="text"
                  placeholder="e.g. Valley Tech"
                  value={formData.supplierName || ''}
                  onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:border-[#0078d4] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Competitor Company
                </label>
                <input
                  type="text"
                  placeholder="e.g. AeroTech Global"
                  value={formData.competitorCompany || ''}
                  onChange={(e) => setFormData({ ...formData, competitorCompany: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:border-[#0078d4] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Competitor Rate ({formData.currency || activeProj?.currency || 'LKR'})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.competitorRate || 0}
                  onChange={(e) => setFormData({ ...formData, competitorRate: Number(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:border-[#0078d4] focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNewResource}
                className="px-4 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. ALTERNATIVES & INDUSTRY COMPARISON MODAL */}
      {comparisonResource && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white dark:bg-[#0f172a] rounded-2xl max-w-3xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <Scale className="w-4 h-4 text-[#0078d4]" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Compare Alternatives: {comparisonResource.name}
                  </h3>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Side-by-side comparison with competitor companies, alternative suppliers & machinery.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setComparisonResource(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Benchmark Stats */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Active Rate</span>
                <span className="text-sm font-bold font-mono text-[#0078d4] dark:text-sky-400">
                  {formatCurrency(comparisonResource.baseRate, comparisonResource.currency)} / {comparisonResource.unit}
                </span>
                <span className="text-[11px] text-slate-500 block truncate">{comparisonResource.supplierName || 'Primary'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Competitor Rate</span>
                <span className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200">
                  {comparisonResource.competitorRate ? formatCurrency(comparisonResource.competitorRate, comparisonResource.currency) : 'N/A'}
                </span>
                <span className="text-[11px] text-slate-500 block truncate">{comparisonResource.competitorCompany || 'Market average'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Industry Benchmark</span>
                <span className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200">
                  {comparisonResource.industryBenchmarkRate ? formatCurrency(comparisonResource.industryBenchmarkRate, comparisonResource.currency) : 'N/A'}
                </span>
                <span className="text-[11px] text-slate-500 block">Standard market index</span>
              </div>
            </div>

            {/* Alternatives Comparison List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Available Industry Alternatives
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddAlternativeOpen(!isAddAlternativeOpen)}
                  className="px-2.5 py-1 text-xs font-semibold bg-[#0078d4] text-white rounded-lg hover:bg-[#006cbd] cursor-pointer"
                >
                  {isAddAlternativeOpen ? 'Close Form' : '+ Add Alternative'}
                </button>
              </div>

              {/* Add Alternative Inline Form */}
              {isAddAlternativeOpen && (
                <div className="p-3 bg-blue-50/60 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900 space-y-2.5 text-xs">
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Alternative Option Name"
                      value={newAlternative.name || ''}
                      onChange={(e) => setNewAlternative({ ...newAlternative, name: e.target.value })}
                      className="bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Supplier or Competitor"
                      value={newAlternative.providerOrCompetitor || ''}
                      onChange={(e) => setNewAlternative({ ...newAlternative, providerOrCompetitor: e.target.value })}
                      className="bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs"
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder={`Rate (${comparisonResource?.currency || 'LKR'})`}
                      value={newAlternative.rate || 0}
                      onChange={(e) => setNewAlternative({ ...newAlternative, rate: Number(e.target.value) })}
                      className="bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono"
                    />
                  </div>
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsAddAlternativeOpen(false)}
                      className="px-2.5 py-1 text-xs text-slate-600 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddAlternativeToResource}
                      className="px-3 py-1 bg-[#0078d4] text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Save Alternative
                    </button>
                  </div>
                </div>
              )}

              {/* Alternatives List Table */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {(!comparisonResource.alternatives || comparisonResource.alternatives.length === 0) ? (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    No alternatives logged yet. Click "+ Add Alternative" to benchmark alternative suppliers or machinery.
                  </div>
                ) : (
                  comparisonResource.alternatives.map((alt) => {
                    const diff = comparisonResource.baseRate - alt.rate;
                    const pct = comparisonResource.baseRate > 0 ? (diff / comparisonResource.baseRate) * 100 : 0;
                    const isSaving = diff > 0;

                    return (
                      <div
                        key={alt.id}
                        className="p-3 bg-white dark:bg-[#0b101b] flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {alt.name}
                            </span>
                            {alt.isRecommended && (
                              <span className="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                                Recommended
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center space-x-2">
                            <span>{alt.providerOrCompetitor}</span>
                            <span>•</span>
                            <span>Rating: {alt.reliabilityRating || 4.5} ★</span>
                            <span>•</span>
                            <span>Lead: {alt.leadTimeDays || 1}d</span>
                          </div>
                          {alt.notes && (
                            <p className="text-[11px] text-slate-400 mt-1 italic">{alt.notes}</p>
                          )}
                        </div>

                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                              {formatCurrency(alt.rate, comparisonResource.currency)} / {alt.unit}
                            </div>
                            <div
                              className={`text-[10px] font-bold font-mono flex items-center justify-end space-x-0.5 ${
                                isSaving ? 'text-emerald-600' : 'text-red-500'
                              }`}
                            >
                              {isSaving ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                              <span>
                                {isSaving ? '-' : '+'}{Math.abs(diff).toFixed(2)} ({Math.abs(pct).toFixed(1)}%)
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleApplyAlternative(alt.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs cursor-pointer shadow-2xs"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setComparisonResource(null)}
                className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. ALLOCATE RESOURCE TO PROJECT MODAL */}
      {allocatingResource && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white dark:bg-[#0f172a] rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Allocate: {allocatingResource.name}
                </h3>
                <span className="text-[11px] text-slate-500 font-mono">
                  {allocatingResource.code} • {allocatingResource.category}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAllocatingResource(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Project *
                </label>
                <select
                  value={allocTargetProject}
                  onChange={(e) => {
                    setAllocTargetProject(e.target.value);
                    const p = projects.find((pr) => pr.id === e.target.value);
                    if (p?.phases?.[0]) setAllocTargetPhase(p.phases[0].id);
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:border-[#0078d4] focus:outline-none cursor-pointer font-semibold"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Project Plan
                </label>
                <select
                  value={allocTargetPlan}
                  onChange={(e) => setAllocTargetPlan(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:border-[#0078d4] focus:outline-none cursor-pointer"
                >
                  <option value="">Default Project Plan</option>
                  {targetProjectPlans.map((pl: any) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.name || pl.plan_name || 'Plan'} {pl.is_active || pl.isActive ? '(Active)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Phase *
                </label>
                <select
                  value={allocTargetPhase}
                  onChange={(e) => setAllocTargetPhase(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:border-[#0078d4] focus:outline-none cursor-pointer"
                >
                  {projects
                    .find((p) => p.id === allocTargetProject)
                    ?.phases?.map((ph) => (
                      <option key={ph.id} value={ph.id}>
                        {ph.name} ({ph.status})
                      </option>
                    )) || <option value="phase-01">Phase 1</option>}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Quantity ({allocatingResource.unit}) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={allocQty}
                    onChange={(e) => setAllocQty(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Rate ({allocatingResource.currency || 'LKR'} / {allocatingResource.unit})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={allocRate}
                    onChange={(e) => setAllocRate(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Total Cost</span>
                <span className="font-mono font-bold text-sm text-[#0078d4] dark:text-sky-400">
                  {formatCurrency(allocQty * allocRate, allocatingResource.currency || 'LKR')}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAllocatingResource(null)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteAllocation}
                className="px-4 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Allocate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. EDIT RESOURCE MODAL */}
      {editingResource && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white dark:bg-[#0f172a] rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Edit Resource: {editingResource.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingResource(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={editingResource.name}
                  onChange={(e) => setEditingResource({ ...editingResource, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:border-[#0078d4] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Currency
                </label>
                <select
                  value={editingResource.currency || 'LKR'}
                  onChange={(e) => setEditingResource({ ...editingResource, currency: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:border-[#0078d4] focus:outline-none font-bold text-[#0078d4]"
                >
                  <option value="LKR">LKR (Rs.)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="AED">AED (AED)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Rate ({editingResource.currency || 'LKR'} / {editingResource.unit})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editingResource.baseRate}
                  onChange={(e) => setEditingResource({ ...editingResource, baseRate: Number(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Unit
                </label>
                <input
                  type="text"
                  value={editingResource.unit}
                  onChange={(e) => setEditingResource({ ...editingResource, unit: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={editingResource.category}
                  onChange={(e) => setEditingResource({ ...editingResource, category: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Sub-Category
                </label>
                <input
                  type="text"
                  value={editingResource.subCategory || ''}
                  onChange={(e) => setEditingResource({ ...editingResource, subCategory: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Supplier / Vendor
                </label>
                <input
                  type="text"
                  value={editingResource.supplierName || ''}
                  onChange={(e) => setEditingResource({ ...editingResource, supplierName: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Competitor Rate ({editingResource.currency || 'LKR'})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editingResource.competitorRate || 0}
                  onChange={(e) => setEditingResource({ ...editingResource, competitorRate: Number(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingResource(null)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditedResource}
                className="px-4 py-1.5 bg-[#0078d4] text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. DELETE RESOURCE MODAL */}
      {resourceToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#0f172a] rounded-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Delete Resource
            </h3>
            <p className="text-xs text-slate-500">
              Are you sure you want to delete <strong>{resourceToDelete.name}</strong> from the database?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setResourceToDelete(null)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteResource}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
