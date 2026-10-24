import React, { useState, useMemo, useEffect } from 'react';
import {
  FolderGit2,
  Sparkles,
  ArrowLeft,
  FileDown,
  RefreshCw,
  Plus,
  Copy,
  Layers,
  LayoutDashboard,
  SlidersHorizontal,
  Users,
  DollarSign,
  TrendingUp,
  Percent,
  CheckCircle2,
  Clock,
  Building2,
  ChevronDown,
  Trash2,
  ShieldCheck,
  Package,
  HardHat,
  Truck,
  ArrowRight,
  Palette,
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  FolderInput,
  AlertTriangle,
  Table,
  LayoutGrid,
  ExternalLink
} from 'lucide-react';
import { calculateProjectProfitability, getMarginThreshold } from '../utils/profitabilityMonitor';
import {
  Project,
  BudgetaryPlan,
  ProjectCostItem,
  MaterialItem,
  Supplier,
  SubcontractorRateItem,
  OutsourcedService,
  ProduceItem
} from '../types';
import { ProjectDashboardTab } from './project/ProjectDashboardTab';
import { ProjectCostControlsTab } from './project/ProjectCostControlsTab';
import { PlanCostControlsTab } from './project/PlanCostControlsTab';
import { CreateBudgetPlanModal } from './project/CreateBudgetPlanModal';
import { ImportPlanFromOtherProjectModal } from './project/ImportPlanFromOtherProjectModal';
import { PlanTemplatesLibraryModal } from './project/PlanTemplatesLibraryModal';
import { SavePlanAsTemplateModal } from './project/SavePlanAsTemplateModal';
import { PlanDetailsPage } from './project/PlanDetailsPage';
import { ProjectPlansListTable, ProjectPlanRow } from './project/ProjectPlansListTable';
import { ProjectResourcesTab } from './project/ProjectResourcesTab';
import { ModernTileCard } from './ModernTileCard';
import { calculateProjectMetrics } from '../utils/costCalculations';
import { getRandomThemeIndex, getThemeById } from '../data/tileThemes';
import { api } from '../services/api';
import { formatCurrency } from '../utils/currency';

export interface ProjectHomeViewProps {
  project: Project | null;
  allProjects: Project[];
  onSelectProject: (p: Project) => void;
  onUpdateProject: (updatedProject: Project) => void;
  materials: MaterialItem[];
  suppliers: Supplier[];
  subcontractors: SubcontractorRateItem[];
  outsourcedServices: OutsourcedService[];
  produceItems?: ProduceItem[];
  onAddProduceItem?: (item: any) => void;
  onAddMaterial?: (m: MaterialItem) => void;
  onRefreshAnalytics?: () => void;
  onExportPDF?: () => void;
  onNavigateBack?: () => void;
  onViewPlanDetails?: (planId: string) => void;
  initialSubTab?: 'plans' | 'dashboard' | 'cost-controls';
}

export const ProjectHomeView: React.FC<ProjectHomeViewProps> = ({
  project,
  allProjects,
  onSelectProject,
  onUpdateProject,
  materials,
  suppliers,
  subcontractors,
  outsourcedServices,
  produceItems = [],
  onAddProduceItem,
  onAddMaterial,
  onRefreshAnalytics,
  onExportPDF,
  onNavigateBack,
  onViewPlanDetails,
  initialSubTab = 'plans'
}) => {
  const [subTab, setSubTab] = useState<'plans' | 'plan-details' | 'dashboard' | 'resources' | 'cost-controls'>(initialSubTab as any);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planViewMode, setPlanViewMode] = useState<'table' | 'cards'>('table');
  const [costControlViewMode, setCostControlViewMode] = useState<'caps' | 'breakdown'>('caps');
  const [dbPlans, setDbPlans] = useState<any[]>([]);
  const [loadingDbPlans, setLoadingDbPlans] = useState(false);

  const [isCreatePlanModalOpen, setIsCreatePlanModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);
  const [planToSaveAsTemplate, setPlanToSaveAsTemplate] = useState<BudgetaryPlan | null>(null);
  const [marginThreshold, setMarginThresholdState] = useState<number>(() => getMarginThreshold());

  const fetchPlansFromPostgres = async () => {
    if (!project?.id) return;
    setLoadingDbPlans(true);
    try {
      const serverPlans = await api.getProjectPlans(project.id);
      if (Array.isArray(serverPlans)) {
        setDbPlans(serverPlans);
      }
    } catch (e) {
      console.warn('Could not load project plans from PostgreSQL:', e);
    } finally {
      setLoadingDbPlans(false);
    }
  };

  useEffect(() => {
    if (project?.id) {
      void fetchPlansFromPostgres();
    }
  }, [project?.id]);

  React.useEffect(() => {
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

  const marginAnalysis = useMemo(() => {
    if (!project) return null;
    return calculateProjectProfitability(project, marginThreshold);
  }, [project, marginThreshold]);

  const handleOpenSaveAsTemplate = (planToSave: BudgetaryPlan) => {
    setPlanToSaveAsTemplate(planToSave);
    setIsSaveTemplateModalOpen(true);
  };

  // Fallback if no project is selected
  if (!project) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 m-4 shadow-sm">
        <FolderGit2 className="w-12 h-12 text-[#003049]/40 mx-auto mb-3" />
        <h3 className="text-base font-normal text-slate-800">No project currently selected</h3>
        <p className="text-slate-500 text-xs mt-1 max-w-md mx-auto">
          Please select an enterprise project from your active portfolio or create a new contract.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          {allProjects.length > 0 && (
            <button
              onClick={() => onSelectProject(allProjects[0])}
              className="px-4 py-2 bg-[#003049] hover:bg-[#002235] text-white text-xs font-normal rounded-lg transition-colors shadow-2xs"
            >
              Open First Project ({allProjects[0].code})
            </button>
          )}
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-normal rounded-lg transition-colors border border-slate-200"
            >
              Back to Resource Center
            </button>
          )}
        </div>
      </div>
    );
  }

  // Ensure project plans are synchronized from PostgreSQL database
  const plans: BudgetaryPlan[] = useMemo(() => {
    if (dbPlans && dbPlans.length > 0) {
      return dbPlans.map((dp: any) => ({
        id: dp.id,
        planNumber: dp.planNumber,
        name: dp.name,
        description: dp.description || '',
        planType: dp.planType || 'Baseline',
        status: dp.status || 'Draft',
        revisionNumber: dp.revisionNumber || 1,
        versionLabel: dp.versionLabel || `v${dp.revisionNumber || 1}.0`,
        isBaseline: Boolean(dp.isBaseline),
        isActive: Boolean(dp.isActive),
        targetMarginPct: dp.targetMarginPct ?? project.targetMarginPct ?? 25,
        overheadPct: dp.overheadPct ?? project.overheadPct ?? 8.5,
        contingencyPct: dp.contingencyPct ?? project.contingencyPct ?? 5.0,
        laborBurdenPct: dp.laborBurdenPct ?? 0,
        selectedItems: dp.selectedItems || dp.boqItems || [],
        totalDirectCost: dp.directCost ?? dp.costSummary?.directCost,
        totalProjectCost: dp.totalPlannedCost ?? dp.costSummary?.totalPlannedCost,
        quotedRevenue: dp.plannedRevenue ?? dp.costSummary?.plannedRevenue ?? project.quotedPrice,
        grossMarginPct: dp.grossMarginPct ?? dp.costSummary?.grossMarginPct,
        createdAt: dp.createdAt || dp.createdDate || '',
        themeId: dp.themeId,
        customGradient: dp.customGradient,
        costSummary: dp.costSummary,
        sections: dp.sections,
        boqItems: dp.boqItems,
        resources: dp.resources,
        overheadAllocations: dp.overheadAllocations,
        revisions: dp.revisions,
        effectiveDate: dp.effectiveDate,
        lastUpdated: dp.lastUpdated || dp.updatedAt?.slice(0, 10)
      }));
    }

    if (project.budgetaryPlans && project.budgetaryPlans.length > 0) {
      return project.budgetaryPlans;
    }

    // No pre-created plans: all plans must be created through the database
    return [];
  }, [dbPlans, project.budgetaryPlans]);

  const activePlanId = project.activePlanId || plans.find(p => p.isActive)?.id || plans[0]?.id || null;
  const activePlan = useMemo(() => {
    return (activePlanId ? plans.find((p) => p.id === activePlanId) : null) || plans[0] || null;
  }, [plans, activePlanId]);

  // Handler to set active plan in PostgreSQL
  const handleSelectActivePlan = async (planId: string) => {
    try {
      await api.activateProjectPlan(planId);
      await fetchPlansFromPostgres();
    } catch (e) {
      console.warn('PostgreSQL plan activation error:', e);
    }

    const targetPlan = plans.find((p) => p.id === planId) || plans[0];
    const newMetrics = calculateProjectMetrics(
      project.quotedPrice,
      targetPlan.targetMarginPct,
      targetPlan.overheadPct,
      targetPlan.contingencyPct,
      targetPlan.selectedItems,
      project.phases || []
    );

    onUpdateProject({
      ...project,
      activePlanId: planId,
      budgetaryPlans: plans,
      analytics: newMetrics
    });
  };

  // Handler to duplicate a plan in PostgreSQL
  const handleDuplicatePlan = async (plan: BudgetaryPlan) => {
    try {
      const dup = await api.duplicateProjectPlan(plan.id, { name: `${plan.name} (Copy)` });
      await fetchPlansFromPostgres();
      if (dup?.id) {
        setSelectedPlanId(dup.id);
        setSubTab('plan-details');
      }
    } catch (e) {
      console.warn('PostgreSQL duplicate plan error, using local fallback:', e);
      const newId = `plan-${Date.now()}`;
      const duplicate: BudgetaryPlan = {
        ...plan,
        id: newId,
        name: `${plan.name} (Copy)`,
        isBaseline: false,
        selectedItems: (plan.selectedItems || []).map((item) => ({
          ...item,
          id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        })),
        createdAt: new Date().toISOString().split('T')[0]
      };
      const updatedPlans = [...plans, duplicate];
      onUpdateProject({
        ...project,
        budgetaryPlans: updatedPlans,
        activePlanId: newId
      });
    }
  };

  // Handler to archive a plan in PostgreSQL
  const handleArchivePlan = async (planId: string) => {
    try {
      await api.archiveProjectPlan(planId);
      await fetchPlansFromPostgres();
    } catch (e) {
      console.warn('PostgreSQL archive plan error:', e);
    }
  };

  // Handler to delete a plan in PostgreSQL
  const handleDeletePlan = async (planId: string) => {
    const targetPlanToDelete = plans.find((p) => p.id === planId);
    const planLabel = targetPlanToDelete ? `${targetPlanToDelete.planNumber} (${targetPlanToDelete.name})` : 'this plan';
    if (!window.confirm(`Are you sure you want to permanently delete project plan "${planLabel}"? This will delete all its BOQ items, resource allocations, and cost controls from PostgreSQL.`)) {
      return;
    }

    try {
      await api.deleteProjectPlan(planId);
      await fetchPlansFromPostgres();
    } catch (e: any) {
      console.warn('PostgreSQL delete plan error:', e);
      alert(`Could not delete plan: ${e?.message || 'Database error'}`);
      return;
    }

    const updatedPlans = plans.filter((p) => p.id !== planId);
    const newActiveId = updatedPlans.length > 0
      ? (activePlanId === planId ? updatedPlans[0].id : activePlanId)
      : null;
    const targetPlan = newActiveId ? (updatedPlans.find((p) => p.id === newActiveId) || updatedPlans[0]) : null;

    const newMetrics = targetPlan ? calculateProjectMetrics(
      project.quotedPrice,
      targetPlan.targetMarginPct,
      targetPlan.overheadPct,
      targetPlan.contingencyPct,
      targetPlan.selectedItems || [],
      project.phases || []
    ) : undefined;

    onUpdateProject({
      ...project,
      budgetaryPlans: updatedPlans,
      activePlanId: newActiveId || undefined,
      analytics: newMetrics || project.analytics
    });
  };

  // Handler to update a plan's theme
  const handleUpdatePlanTheme = (planId: string, themeId: string, customGrad?: string) => {
    const updatedPlans = plans.map((p) => {
      if (p.id === planId) {
        return {
          ...p,
          themeId,
          customGradient: customGrad
        };
      }
      return p;
    });

    onUpdateProject({
      ...project,
      budgetaryPlans: updatedPlans
    });
  };

  // Handler to create a new plan in PostgreSQL
  const handleCreateNewPlan = async (newPlan: BudgetaryPlan) => {
    try {
      const payload = {
        name: newPlan.name,
        description: newPlan.description,
        targetMarginPct: newPlan.targetMarginPct,
        overheadPct: newPlan.overheadPct,
        contingencyPct: newPlan.contingencyPct,
        boqItems: newPlan.selectedItems,
        isBaseline: false,
        isActive: true
      };
      const created = await api.createProjectPlan(project.id, payload);
      await fetchPlansFromPostgres();
      setIsCreatePlanModalOpen(false);

      if (created?.id) {
        setSelectedPlanId(created.id);
        setSubTab('plan-details');
      }

      onUpdateProject({
        ...project,
        activePlanId: created.id
      });
    } catch (err) {
      console.warn('PostgreSQL plan creation fallback:', err);
      const updatedPlans = [...plans, newPlan];
      const newMetrics = calculateProjectMetrics(
        project.quotedPrice,
        newPlan.targetMarginPct,
        newPlan.overheadPct,
        newPlan.contingencyPct,
        newPlan.selectedItems,
        project.phases || []
      );

      onUpdateProject({
        ...project,
        budgetaryPlans: updatedPlans,
        activePlanId: newPlan.id,
        analytics: newMetrics
      });
      setIsCreatePlanModalOpen(false);
    }
  };

  // Structured table rows for Requirement 10 & 11
  const structuredTableRows: ProjectPlanRow[] = useMemo(() => {
    return plans.map((p, idx) => {
      const metrics = calculateProjectMetrics(
        project.quotedPrice,
        p.targetMarginPct || project.targetMarginPct,
        p.overheadPct || 8.5,
        p.contingencyPct || 5.0,
        p.selectedItems || [],
        project.phases || []
      );
      const planNumber = (p as any).planNumber || `PLN-${project.code || 'PRJ'}-${String(idx + 1).padStart(2, '0')}`;
      const revNum = (p as any).revisionNumber || 1;
      const versLabel = (p as any).versionLabel || `v${revNum}.0`;

      const cs = (p as any).costSummary;
      const plannedRevenue = cs?.plannedRevenue ?? (p as any).plannedRevenue ?? (p as any).quotedRevenue ?? project.quotedPrice ?? 0;
      const directCost = cs?.directCost ?? (p as any).directCost ?? (p as any).totalDirectCost ?? metrics.totalDirectCost ?? 0;
      const allocatedOverhead = cs?.allocatedOverhead ?? (p as any).allocatedOverhead ?? ((metrics.overheadAmount || 0) + (metrics.contingencyAmount || 0));
      const totalPlannedCost = cs?.totalPlannedCost ?? (p as any).totalPlannedCost ?? (p as any).totalProjectCost ?? metrics.totalProjectCost ?? 0;
      const plannedProfit = cs?.plannedProfit ?? (p as any).plannedProfit ?? metrics.netProfit ?? 0;
      const profitMarginPct = cs?.profitMarginPct ?? (p as any).profitMarginPct ?? (p as any).grossMarginPct ?? metrics.grossMarginPct ?? 0;

      return {
        id: p.id,
        planNumber,
        name: p.name,
        projectId: project.id,
        projectCode: project.code,
        projectName: project.name,
        clientName: project.clientName,
        revisionNumber: revNum,
        versionLabel: versLabel,
        status: (p as any).status || (p.isBaseline ? 'Approved' : 'Draft'),
        isBaseline: Boolean(p.isBaseline),
        isActive: p.id === activePlanId,
        currency: project.currency || 'USD',
        plannedRevenue,
        directCost,
        allocatedOverhead,
        totalPlannedCost,
        plannedProfit,
        profitMarginPct,
        targetMarginPct: p.targetMarginPct || project.targetMarginPct,
        effectiveDate: (p as any).effectiveDate || p.createdAt,
        lastUpdated: (p as any).lastUpdated || (p as any).updatedAt?.slice(0, 10) || p.createdAt,
        costSummary: cs
      };
    });
  }, [plans, activePlanId, project]);

  // Compute metrics for all plans to show comparison
  const plansWithMetrics = useMemo(() => {
    return plans.map((p, idx) => {
      const metrics = calculateProjectMetrics(
        project.quotedPrice,
        p.targetMarginPct || project.targetMarginPct,
        p.overheadPct || 8.5,
        p.contingencyPct || 5.0,
        p.selectedItems || [],
        project.phases || []
      );
      const matCount = (p.selectedItems || []).filter((i) => i.type === 'material').length;
      const subCount = (p.selectedItems || []).filter((i) => i.type === 'subcontractor').length;
      const outCount = (p.selectedItems || []).filter((i) => i.type === 'outsourced').length;
      return {
        plan: p,
        metrics,
        matCount,
        subCount,
        outCount,
        defaultTheme: getRandomThemeIndex(idx)
      };
    });
  }, [plans, project.quotedPrice, project.targetMarginPct, project.phases]);

  return (
    <div className="space-y-4 pb-12">
      {/* 1. TOP HEADER & BREADCRUMB BAR - Simple UI like Home tab */}
      <div className="bg-white dark:bg-[#0b101b] p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {/* Breadcrumbs & Navigation Back */}
            <div className="flex items-center space-x-2 text-[11px] text-slate-500">
              {onNavigateBack && (
                <button
                  onClick={onNavigateBack}
                  className="flex items-center space-x-1 text-[#0078d4] hover:underline mr-1 font-semibold"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Projects</span>
                </button>
              )}
              <span>•</span>
              <span className="font-mono text-[#0078d4] font-bold uppercase">{project.code}</span>
              <span>•</span>
              <span className="text-slate-600 dark:text-slate-400">{project.clientName}</span>
            </div>

            {/* Project Title & Scope */}
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <span>{project.name}</span>
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {project.status || 'Active'}
              </span>
            </div>

            {/* Key Meta Stats Strip */}
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center space-x-1">
                <span className="text-slate-400">Quoted:</span>
                <span className="text-slate-900 dark:text-slate-100 font-bold">${Number(project.quotedPrice || 0).toLocaleString()}</span>
              </div>
              <span>•</span>
              <div className="flex items-center space-x-1">
                <span className="text-slate-400">Margin:</span>
                <span className="text-[#0078d4] font-bold">{Number(project.targetMarginPct || 0).toFixed(1)}%</span>
                {marginAnalysis?.isMarginBelowThreshold && (
                  <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[10px] font-bold ml-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Low Margin</span>
                  </span>
                )}
              </div>
              <span>•</span>
              <div className="flex items-center space-x-1">
                <span className="text-slate-400">Deadline:</span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">{project.deliveryDeadline || '2026-09-15'}</span>
              </div>
              {activePlan && (
                <>
                  <span>•</span>
                  <div className="flex items-center space-x-1 bg-blue-50 dark:bg-blue-950 text-[#0078d4] dark:text-sky-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded text-[11px] font-semibold">
                    <Sparkles className="w-3 h-3 text-[#0078d4]" />
                    <span>{activePlan.name.split(':')[0]}</span>
                  </div>
                </>
              )}
            </div>

            {/* Associated Client Banner (Requirement 13) */}
            <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-center space-x-1.5 px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 rounded border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-sky-300">
                <Building2 className="w-3.5 h-3.5 text-[#0078d4]" />
                <span className="font-semibold text-slate-500 dark:text-slate-400">Client:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{project.clientName}</span>
                {project.clientCode && (
                  <span className="font-mono text-[10px] px-1 bg-white dark:bg-slate-900 rounded border border-blue-200 dark:border-blue-700 text-[#0078d4]">
                    {project.clientCode}
                  </span>
                )}
              </div>
              {(project as any).clientIndustry && (
                <span className="text-slate-500 dark:text-slate-400">
                  Sector: <strong className="text-slate-700 dark:text-slate-300">{(project as any).clientIndustry}</strong>
                </span>
              )}
              {(project as any).clientContactPerson && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    Lead: <strong className="text-slate-700 dark:text-slate-300">{(project as any).clientContactPerson}</strong>
                  </span>
                </>
              )}
              {(project as any).clientEmail && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    Email: <a href={`mailto:${(project as any).clientEmail}`} className="text-[#0078d4] hover:underline font-medium">{(project as any).clientEmail}</a>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Action cluster: Recalculate, Export PDF */}
          <div className="flex flex-wrap items-center gap-2">
            {onRefreshAnalytics && (
              <button
                onClick={onRefreshAnalytics}
                className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs cursor-pointer"
                title="Recalculate"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Recalculate</span>
              </button>
            )}

            {onExportPDF && (
              <button
                onClick={onExportPDF}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Export PDF</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. THREE PRIMARY TABS - Simple Words */}
      <div className="bg-white dark:bg-[#0b101b] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs p-1.5 flex flex-wrap items-center justify-start gap-1.5">
        {/* Tab 1: Project Plans */}
        <button
          onClick={() => setSubTab('plans')}
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            subTab === 'plans'
              ? 'bg-[#0078d4] text-white shadow-xs'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Plans</span>
        </button>

        {/* Tab 2: Dashboard */}
        <button
          onClick={() => setSubTab('dashboard')}
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            subTab === 'dashboard'
              ? 'bg-[#0078d4] text-white shadow-xs'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Dashboard</span>
        </button>

        {/* Tab 3: Resources (Allocated Project & Plan Resources) */}
        <button
          onClick={() => setSubTab('resources')}
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            subTab === 'resources'
              ? 'bg-[#0078d4] text-white shadow-xs'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Resources</span>
          {activePlan?.resources && activePlan.resources.length > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
              subTab === 'resources' ? 'bg-white/20 text-white' : 'bg-blue-100 text-[#0078d4] dark:bg-blue-950 dark:text-sky-300'
            }`}>
              {activePlan.resources.length}
            </span>
          )}
        </button>

        {/* Tab 4: Cost Controls */}
        <button
          onClick={() => setSubTab('cost-controls')}
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            subTab === 'cost-controls'
              ? 'bg-[#0078d4] text-white shadow-xs'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Cost Controls</span>
        </button>

        {/* Tab 4: Plan Details (Dedicated Plan Portal) */}
        {subTab === 'plan-details' && (
          <button
            onClick={() => setSubTab('plan-details')}
            className="flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer bg-[#0078d4] text-white shadow-xs"
          >
            <Sparkles className="w-4 h-4" />
            <span>Plan Details</span>
          </button>
        )}
      </div>

      {/* 3. TAB CONTENT */}

      {/* DEDICATED PLAN DETAILS PAGE (Requirement 9 & 12) */}
      {subTab === 'plan-details' && selectedPlanId && (
        <div className="space-y-4">
          <PlanDetailsPage
            planId={selectedPlanId}
            projectId={project.id}
            onNavigateBack={() => setSubTab('plans')}
            onPlanUpdated={fetchPlansFromPostgres}
            onOpenProject={(projId) => {
              const p = allProjects.find((x) => x.id === projId);
              if (p) onSelectProject(p);
            }}
          />
        </div>
      )}

      {/* TAB 1: PROJECT PLANS VIEW (Requirement 10 & 11) */}
      {subTab === 'plans' && (
        <div className="space-y-4">
          {/* Action Buttons Toolbar with Table vs Cards Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* View Mode Toggle: Table View vs Card Tiles */}
            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setPlanViewMode('table')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  planViewMode === 'table'
                    ? 'bg-white dark:bg-slate-700 text-[#0078d4] dark:text-blue-400 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Table View</span>
              </button>
              <button
                type="button"
                onClick={() => setPlanViewMode('cards')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  planViewMode === 'cards'
                    ? 'bg-white dark:bg-slate-700 text-[#0078d4] dark:text-blue-400 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Card Tiles</span>
              </button>
            </div>

            {/* Plan Operations Toolbar */}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs"
              >
                <FolderInput className="w-3.5 h-3.5 text-[#003049] dark:text-blue-400" />
                <span>Import Plan</span>
                {allProjects.filter(p => p.id !== project.id).length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 bg-[#003049] text-white text-[10px] rounded-full font-mono">
                    {allProjects.filter(p => p.id !== project.id).length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setIsTemplatesModalOpen(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs"
              >
                <Bookmark className="w-3.5 h-3.5 text-[#c1121f]" />
                <span>Templates</span>
              </button>

              {activePlan && (
                <button
                  onClick={() => handleOpenSaveAsTemplate(activePlan)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold rounded-lg transition-colors border border-amber-200 cursor-pointer shadow-2xs"
                >
                  <BookmarkCheck className="w-3.5 h-3.5 text-amber-700" />
                  <span>Save Template</span>
                </button>
              )}

              <button
                onClick={() => setIsCreatePlanModalOpen(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Plan</span>
              </button>
            </div>
          </div>

          {/* Structured Table View (Requirement 10 & 11) */}
          {planViewMode === 'table' ? (
            <ProjectPlansListTable
              plans={structuredTableRows}
              activePlanId={activePlanId}
              currency={project.currency}
              onViewPlanDetails={(planId) => {
                setSelectedPlanId(planId);
                setSubTab('plan-details');
                onViewPlanDetails?.(planId);
              }}
              onActivatePlan={handleSelectActivePlan}
              onDuplicatePlan={(planId) => {
                const p = plans.find((x) => x.id === planId);
                if (p) void handleDuplicatePlan(p);
              }}
              onArchivePlan={handleArchivePlan}
              onDeletePlan={handleDeletePlan}
              onCreateNewPlan={() => setIsCreatePlanModalOpen(true)}
              isLoading={loadingDbPlans}
            />
          ) : (
            /* GRID OF PLAN TILES */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plansWithMetrics.map(({ plan, metrics, matCount, subCount, outCount, defaultTheme }, idx) => {
                const isActive = plan.id === activePlanId;
                const themeId = plan.themeId || (idx === 0 ? 'airbus-cobalt' : idx === 1 ? 'emerald-oasis' : defaultTheme.id);
                const customGrad = plan.customGradient;
                const planTag = plan.isBaseline
                  ? `PLAN ${String.fromCharCode(65 + idx)} • BASELINE`
                  : `PLAN ${String.fromCharCode(65 + idx)} • SCENARIO`;

                return (
                  <div key={plan.id} className="relative flex flex-col">
                    {/* Modern Tile Card Component */}
                    <ModernTileCard
                      id={plan.id}
                      tag={planTag}
                      title={plan.name}
                      brief={plan.description || ''}
                      actionLabel="COST CONTROLS"
                      actionVariant="link"
                      themeId={themeId}
                      customGradient={customGrad}
                      selected={isActive}
                      onChangeTheme={(tId, grad) => handleUpdatePlanTheme(plan.id, tId, grad)}
                      onDuplicate={() => handleDuplicatePlan(plan)}
                      onSaveAsTemplate={() => handleOpenSaveAsTemplate(plan)}
                      onDelete={plans.length > 1 ? () => handleDeletePlan(plan.id) : undefined}
                      onClick={() => {
                        handleSelectActivePlan(plan.id);
                        setSelectedPlanId(plan.id);
                        setSubTab('plan-details');
                        onViewPlanDetails?.(plan.id);
                      }}
                      onAction={() => {
                        handleSelectActivePlan(plan.id);
                        setSelectedPlanId(plan.id);
                        setSubTab('plan-details');
                        onViewPlanDetails?.(plan.id);
                      }}
                      extraMeta={
                        <div className="mt-2 space-y-2 bg-black/25 backdrop-blur-xs p-2.5 rounded-xl border border-white/20 text-white text-xs">
                          {/* Financial Metrics Strip */}
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-white/70 block text-[10px]">Cost</span>
                              <span className="font-semibold text-white">${(metrics?.totalDirectCost || 0).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-white/70 block text-[10px]">Margin</span>
                              <span className="font-semibold text-white">{(metrics?.grossMarginPct || 0).toFixed(1)}%</span>
                            </div>
                            <div>
                              <span className="text-white/70 block text-[10px]">Overhead</span>
                              <span className="font-semibold text-white">${((metrics?.overheadAmount || 0) + (metrics?.contingencyAmount || 0)).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-white/70 block text-[10px]">Net Profit</span>
                              <span className="font-semibold text-white">${(metrics?.netProfit || 0).toLocaleString()}</span>
                            </div>
                          </div>

                          {/* Breakdown count badge */}
                          <div className="pt-1.5 border-t border-white/20 flex items-center justify-between text-[10px] text-white/90">
                            <span className="flex items-center space-x-1">
                              <Package className="w-3 h-3" />
                              <span>{matCount} Mat</span>
                            </span>
                            <span>•</span>
                            <span className="flex items-center space-x-1">
                              <HardHat className="w-3 h-3" />
                              <span>{subCount} Sub</span>
                            </span>
                            <span>•</span>
                            <span className="flex items-center space-x-1">
                              <Truck className="w-3 h-3" />
                              <span>{outCount} Out</span>
                            </span>
                            <span>•</span>
                            <span className="font-semibold">{(plan.selectedItems || []).length} Items</span>
                          </div>
                        </div>
                      }
                    />

                    {/* Secondary Quick Action Bar below Tile */}
                    <div className="mt-2 bg-white dark:bg-[#0b101b] p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between gap-1.5 text-xs">
                      <div className="flex items-center space-x-1">
                        {isActive ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSelectActivePlan(plan.id)}
                            className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Select
                          </button>
                        )}
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPlanId(plan.id);
                            setSubTab('plan-details');
                            onViewPlanDetails?.(plan.id);
                          }}
                          className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-[11px] font-semibold transition-colors flex items-center space-x-1"
                          title="View Full Normalized Plan Details"
                        >
                          <ExternalLink className="w-3 h-3 text-[#0078d4]" />
                          <span>Details</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenSaveAsTemplate(plan)}
                          className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-semibold transition-colors flex items-center space-x-1"
                        >
                          <Bookmark className="w-3 h-3 text-amber-700" />
                          <span>Template</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectActivePlan(plan.id);
                            setSubTab('dashboard');
                          }}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors"
                        >
                          Dashboard →
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectActivePlan(plan.id);
                            setSubTab('cost-controls');
                          }}
                          className="px-2 py-1 rounded bg-[#0078d4] hover:bg-[#006cbd] text-white text-[11px] font-semibold transition-colors"
                        >
                          Cost Controls →
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Quick Add / Plan Options Tile */}
              <div className="min-h-[220px] rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4 flex flex-col justify-between text-center transition-all duration-200 shadow-2xs">
                <div className="pt-2">
                  <div className="w-10 h-10 rounded-full bg-[#0078d4]/10 flex items-center justify-center text-[#0078d4] mx-auto mb-2">
                    <Plus className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    New Plan
                  </h3>
                </div>

                <div className="space-y-1.5 my-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatePlanModalOpen(true)}
                    className="w-full py-1.5 px-2 bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#0078d4]" />
                    <span>Blank Plan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(true)}
                    className="w-full py-1.5 px-2 bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <FolderInput className="w-3.5 h-3.5 text-[#0078d4]" />
                    <span>Import Plan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTemplatesModalOpen(true)}
                    className="w-full py-1.5 px-2 bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Bookmark className="w-3.5 h-3.5 text-[#c1121f]" />
                    <span>From Template</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SIDE-BY-SIDE STRATEGIC PLAN COMPARISON BANNER */}
          {plansWithMetrics.length >= 2 && (
            <div className="bg-white dark:bg-[#0b101b] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs mt-6">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-900 dark:text-slate-100 mb-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#0078d4]" />
                <span>Plan Comparison</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-y border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Plan</th>
                      <th className="py-2.5 px-3 font-semibold">Type</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Cost</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Margin %</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Net Profit</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Variance</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {plansWithMetrics.map(({ plan, metrics }, idx) => {
                      const baselineMetrics = plansWithMetrics[0].metrics;
                      const costDiff = metrics.totalDirectCost - baselineMetrics.totalDirectCost;
                      const isBase = idx === 0;

                      return (
                        <tr key={plan.id} className={plan.id === activePlanId ? 'bg-amber-50/40' : 'hover:bg-slate-50'}>
                          <td className="py-2.5 px-3 font-medium text-slate-900">
                            {plan.name}
                            {plan.id === activePlanId && (
                              <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-normal">
                                Active
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">
                            {plan.isBaseline ? 'Approved Baseline' : 'Alternative Scenario'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-normal text-slate-900 dark:text-slate-100">
                            {formatCurrency(metrics?.totalDirectCost || 0, project.currency || 'LKR')}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-medium text-[#0078d4] dark:text-sky-300">
                            {(metrics?.grossMarginPct || 0).toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-normal text-slate-900 dark:text-slate-100">
                            {formatCurrency(metrics?.netProfit || 0, project.currency || 'LKR')}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            {isBase ? (
                              <span className="text-slate-400">Baseline (0.00)</span>
                            ) : costDiff < 0 ? (
                              <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                -{formatCurrency(Math.abs(costDiff || 0), project.currency || 'LKR')} (Saves {Math.abs(((costDiff || 0) / (baselineMetrics?.totalDirectCost || 1)) * 100).toFixed(1)}%)
                              </span>
                            ) : (
                              <span className="text-rose-700 dark:text-rose-400 font-medium">
                                +{formatCurrency(costDiff || 0, project.currency || 'LKR')}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenSaveAsTemplate(plan)}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] rounded transition-colors flex items-center space-x-1"
                                title="Save this plan scenario as a reusable template"
                              >
                                <Bookmark className="w-3 h-3 text-amber-700" />
                                <span>Save Template</span>
                              </button>
                              <button
                                onClick={() => {
                                  handleSelectActivePlan(plan.id);
                                  setSubTab('cost-controls');
                                }}
                                className="px-2.5 py-1 bg-[#003049] hover:bg-[#002235] text-white text-[11px] rounded transition-colors"
                              >
                                Cost Controls
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

      {/* TAB 2: PROJECT & PLAN DASHBOARD */}
      {subTab === 'dashboard' && (
        <div className="space-y-4">
          {/* Active Plan Selector Strip inside Dashboard */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500 font-normal">Dashboard Focused on:</span>
              <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-lg">
                {plans.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectActivePlan(p.id)}
                    className={`px-3 py-1 rounded-md text-xs font-normal transition-all ${
                      p.id === activePlanId
                        ? 'bg-[#003049] text-white shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {p.name.split(':')[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs text-slate-500">
              Contract Value: <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(project.quotedPrice || 0, project.currency || 'LKR')}</span>
            </div>
          </div>

          <ProjectDashboardTab
            project={project}
            produceItems={produceItems}
            materials={materials}
            onUpdateProject={onUpdateProject}
            onAddProduceItem={onAddProduceItem}
          />
        </div>
      )}

      {/* TAB 3: PROJECT RESOURCES TAB */}
      {subTab === 'resources' && (
        <div className="space-y-4">
          <ProjectResourcesTab
            project={project}
            activePlan={activePlan}
            onPlanUpdated={fetchPlansFromPostgres}
            onUpdateProject={onUpdateProject}
          />
        </div>
      )}

      {/* TAB 4: COST CONTROL PAGE (Strictly for this Project and Plan Only) */}
      {subTab === 'cost-controls' && (
        <div className="space-y-4">
          {/* Plan Selector & View Mode Switcher Header */}
          <div className="bg-white dark:bg-[#0b101b] p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500 font-semibold flex items-center space-x-1">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#0078d4]" />
                <span>Plan Cost Controls for:</span>
              </span>
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                {plans.map((p) => {
                  const isSelected = p.id === activePlanId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectActivePlan(p.id)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                        isSelected
                          ? 'bg-[#0078d4] text-white shadow-2xs font-bold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>{p.name.split(':')[0]}</span>
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Toggle: Budget Caps vs Item Breakdown */}
              <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setCostControlViewMode('caps')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                    costControlViewMode === 'caps'
                      ? 'bg-white dark:bg-slate-700 text-[#0078d4] dark:text-sky-300 shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Budget Caps & Ceilings</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCostControlViewMode('breakdown')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                    costControlViewMode === 'breakdown'
                      ? 'bg-white dark:bg-slate-700 text-[#0078d4] dark:text-sky-300 shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>Item Cost Breakdown</span>
                </button>
              </div>

              {/* Quick Jump to Dedicated Plan Page */}
              {activePlanId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPlanId(activePlanId);
                    setSubTab('plan-details');
                    onViewPlanDetails?.(activePlanId);
                  }}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 text-[#0078d4] dark:text-sky-300 text-xs font-semibold rounded-lg border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer shadow-2xs"
                  title="Open this plan in dedicated plan editor"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Full Plan</span>
                </button>
              )}
            </div>
          </div>

          {/* Active View: PostgreSQL Plan Cost Controls vs Item Cost Breakdown */}
          {!activePlan ? (
            <div className="py-12 px-4 text-center bg-white dark:bg-[#0b101b] rounded-xl border border-dashed border-slate-300 dark:border-slate-800">
              <SlidersHorizontal className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2.5" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Budget Plan Created Yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Create a budgetary plan from the database catalog to activate financial ceilings, direct cost caps, and line-item thresholds.
              </p>
              <button
                type="button"
                onClick={() => setIsCreatePlanModalOpen(true)}
                className="mt-3.5 px-3.5 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs cursor-pointer inline-flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Create First Budget Plan</span>
              </button>
            </div>
          ) : costControlViewMode === 'caps' ? (
            <PlanCostControlsTab
              planId={activePlan.id}
              projectId={project.id}
              planName={activePlan.name}
              planNumber={(activePlan as any).planNumber || (activePlan as any).plan_number || activePlan.id}
              currency={project.currency}
              onCostControlsUpdated={fetchPlansFromPostgres}
            />
          ) : (
            <ProjectCostControlsTab
              project={project}
              allProjects={allProjects}
              materials={materials}
              suppliers={suppliers}
              subcontractors={subcontractors}
              outsourcedServices={outsourcedServices}
              onUpdateProject={onUpdateProject}
              onAddMaterial={onAddMaterial}
            />
          )}
        </div>
      )}

      {/* Create Plan from Scratch Modal */}
      {isCreatePlanModalOpen && (
        <CreateBudgetPlanModal
          isOpen={isCreatePlanModalOpen}
          onClose={() => setIsCreatePlanModalOpen(false)}
          currentPlanItems={activePlan ? (activePlan.selectedItems || []) : []}
          onCreatePlan={handleCreateNewPlan}
        />
      )}

      {/* Include / Import Plan from Another Project Modal */}
      {isImportModalOpen && (
        <ImportPlanFromOtherProjectModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          currentProject={project}
          allProjects={allProjects}
          onImportPlan={handleCreateNewPlan}
        />
      )}

      {/* Budgetary Plan Templates Library Modal */}
      {isTemplatesModalOpen && (
        <PlanTemplatesLibraryModal
          isOpen={isTemplatesModalOpen}
          onClose={() => setIsTemplatesModalOpen(false)}
          currentProject={project}
          onApplyTemplate={handleCreateNewPlan}
          onOpenSaveCurrentPlan={() => {
            setIsTemplatesModalOpen(false);
            handleOpenSaveAsTemplate(activePlan);
          }}
        />
      )}

      {/* Save Plan as Template Modal */}
      {isSaveTemplateModalOpen && planToSaveAsTemplate && (
        <SavePlanAsTemplateModal
          isOpen={isSaveTemplateModalOpen}
          onClose={() => {
            setIsSaveTemplateModalOpen(false);
            setPlanToSaveAsTemplate(null);
          }}
          plan={planToSaveAsTemplate}
          projectCode={project.code}
          onSaved={() => {
            setIsSaveTemplateModalOpen(false);
            setPlanToSaveAsTemplate(null);
          }}
        />
      )}
    </div>
  );
};
