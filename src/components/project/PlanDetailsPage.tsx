import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Layers,
  Sparkles,
  CheckCircle2,
  Clock,
  Calendar,
  DollarSign,
  TrendingUp,
  Percent,
  FileDown,
  Copy,
  Archive,
  RefreshCw,
  FolderGit2,
  Package,
  HardHat,
  Truck,
  Building2,
  AlertTriangle,
  History,
  ShieldCheck,
  Edit,
  Save,
  X,
  Search,
  Filter,
  SlidersHorizontal,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency, getStoredCurrency } from '../../utils/currency';
import { calculatePlanFinancials } from '../../utils/planCalculationService';

interface PlanDetailsPageProps {
  planId: string;
  projectId?: string;
  onNavigateBack: () => void;
  onPlanUpdated?: () => void;
  onOpenProject?: (projectId: string) => void;
  showToast?: (msg: string | { message: string; type?: string }) => void;
}

export const PlanDetailsPage: React.FC<PlanDetailsPageProps> = ({
  planId,
  projectId,
  onNavigateBack,
  onPlanUpdated,
  onOpenProject,
  showToast
}) => {
  const [plan, setPlan] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'boq' | 'sections' | 'resources' | 'overheads' | 'revisions'>('boq');
  const [boqSearch, setBoqSearch] = useState('');
  const [boqTypeFilter, setBoqTypeFilter] = useState<string>('ALL');

  // Edit Metadata Modal state
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPlanType, setEditPlanType] = useState('Baseline');
  const [editStatus, setEditStatus] = useState('Draft');
  const [editTargetMarginPct, setEditTargetMarginPct] = useState(25);
  const [editOverheadPct, setEditOverheadPct] = useState(8.5);
  const [editContingencyPct, setEditContingencyPct] = useState(5.0);
  const [editLaborBurdenPct, setEditLaborBurdenPct] = useState(0);
  const [savingEdit, setSavingEdit] = useState(false);

  const activeCurrency = plan?.currency || getStoredCurrency();

  const loadPlan = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getProjectPlanById(planId);
      if (!data) throw new Error('Plan not found in PostgreSQL database.');
      setPlan(data);
      setEditName(data.name || '');
      setEditDescription(data.description || '');
      setEditPlanType(data.planType || 'Baseline');
      setEditStatus(data.status || 'Draft');
      setEditTargetMarginPct(data.targetMarginPct ?? 25);
      setEditOverheadPct(data.overheadPct ?? 8.5);
      setEditContingencyPct(data.contingencyPct ?? 5.0);
      setEditLaborBurdenPct(data.laborBurdenPct ?? 0);
    } catch (err: any) {
      console.error('Failed to load project plan details:', err);
      setError(err?.message || 'Failed to load plan details from PostgreSQL');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (planId) {
      void loadPlan();
    }
  }, [planId]);

  const handleActivate = async () => {
    if (!plan) return;
    try {
      await api.activateProjectPlan(plan.id);
      showToast?.({ message: `Plan "${plan.name}" is now the active baseline for project.`, type: 'success' });
      await loadPlan();
      onPlanUpdated?.();
    } catch (err: any) {
      showToast?.({ message: err?.message || 'Failed to activate plan', type: 'error' });
    }
  };

  const handleArchive = async () => {
    if (!plan) return;
    if (!window.confirm(`Are you sure you want to archive plan ${plan.planNumber} (${plan.name})?`)) return;
    try {
      await api.archiveProjectPlan(plan.id, undefined, 'Archived by user from plan details portal');
      showToast?.({ message: `Plan ${plan.planNumber} archived in PostgreSQL.`, type: 'info' });
      await loadPlan();
      onPlanUpdated?.();
    } catch (err: any) {
      showToast?.({ message: err?.message || 'Failed to archive plan', type: 'error' });
    }
  };

  const handleDuplicate = async () => {
    if (!plan) return;
    try {
      const dup = await api.duplicateProjectPlan(plan.id, { name: `${plan.name} (Copy)` });
      showToast?.({ message: `Plan duplicated as ${dup.planNumber} in PostgreSQL.`, type: 'success' });
      onPlanUpdated?.();
      onNavigateBack();
    } catch (err: any) {
      showToast?.({ message: err?.message || 'Failed to duplicate plan', type: 'error' });
    }
  };

  const handleSaveMetadata = async () => {
    if (!plan || !editName.trim()) return;
    setSavingEdit(true);
    try {
      const updated = await api.updateProjectPlan(plan.id, {
        name: editName.trim(),
        description: editDescription,
        planType: editPlanType,
        status: editStatus,
        targetMarginPct: Number(editTargetMarginPct),
        overheadPct: Number(editOverheadPct),
        contingencyPct: Number(editContingencyPct),
        laborBurdenPct: Number(editLaborBurdenPct),
        bumpRevision: true,
        changeSummary: 'Updated plan parameters and metadata'
      });
      setPlan(updated);
      setIsEditingModalOpen(false);
      showToast?.({ message: `Plan ${updated.planNumber} updated with revision bump.`, type: 'success' });
      onPlanUpdated?.();
    } catch (err: any) {
      showToast?.({ message: err?.message || 'Failed to update plan', type: 'error' });
    } finally {
      setSavingEdit(false);
    }
  };

  // Filtered BOQ items
  const filteredBoq = useMemo(() => {
    if (!plan?.boqItems) return [];
    return (plan.boqItems as any[]).filter((item) => {
      const matchType = boqTypeFilter === 'ALL' || String(item.type).toLowerCase() === boqTypeFilter.toLowerCase();
      const q = boqSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        String(item.name || '').toLowerCase().includes(q) ||
        String(item.itemCode || '').toLowerCase().includes(q) ||
        String(item.supplierOrProvider || '').toLowerCase().includes(q) ||
        String(item.category || '').toLowerCase().includes(q);
      return matchType && matchSearch;
    });
  }, [plan?.boqItems, boqSearch, boqTypeFilter]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#0b101b] p-12 rounded-xl border border-slate-200 dark:border-slate-800 text-center shadow-2xs">
        <RefreshCw className="w-8 h-8 text-[#0078d4] animate-spin mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Loading plan from PostgreSQL...</h3>
        <p className="text-xs text-slate-500 mt-1">Retrieving normalized relational plan records, BOQ, sections, and revisions.</p>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="bg-white dark:bg-[#0b101b] p-8 rounded-xl border border-rose-200 dark:border-rose-900/50 text-center shadow-2xs">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Unable to load project plan</h3>
        <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 max-w-md mx-auto">{error || 'Record does not exist'}</p>
        <button
          onClick={onNavigateBack}
          className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold"
        >
          Return to Plans
        </button>
      </div>
    );
  }

  const cost = plan.costSummary || {
    plannedRevenue: plan.plannedRevenue || 0,
    materialCost: 0,
    subcontractorCost: 0,
    outsourcedCost: 0,
    resourceCost: 0,
    directCost: plan.directCost || 0,
    overheadAmount: 0,
    contingencyAmount: 0,
    laborBurdenAmount: 0,
    allocatedOverhead: plan.allocatedOverhead || 0,
    totalPlannedCost: plan.totalPlannedCost || 0,
    grossProfit: 0,
    grossMarginPct: plan.grossMarginPct || 0,
    plannedProfit: plan.plannedProfit || 0,
    profitMarginPct: plan.profitMarginPct || 0
  };

  const marginHealthy = Number(cost.profitMarginPct || 0) >= Number(plan.targetMarginPct || 25);

  return (
    <div className="space-y-4 pb-12">
      {/* 1. TOP BREADCRUMB & ACTION HEADER */}
      <div className="bg-white dark:bg-[#0b101b] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2 text-[11px] text-slate-500">
              <button
                onClick={onNavigateBack}
                className="flex items-center space-x-1 text-[#0078d4] hover:underline font-semibold cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Plans</span>
              </button>
              <span>•</span>
              {plan.projectCode && (
                <button
                  onClick={() => onOpenProject && onOpenProject(plan.projectId)}
                  className="font-mono text-[#0078d4] hover:underline font-bold uppercase cursor-pointer"
                >
                  {plan.projectCode}
                </button>
              )}
              <span>•</span>
              <span className="text-slate-600 dark:text-slate-400 font-medium">{plan.projectName || 'Project'}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">
                {plan.planNumber}
              </span>
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">{plan.name}</h1>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${
                  plan.status === 'Active'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                    : plan.status === 'Approved'
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-[#0078d4] dark:text-sky-300 border-blue-200 dark:border-blue-800'
                    : plan.status === 'Archived'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700'
                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                }`}
              >
                {plan.status}
              </span>
              {plan.isBaseline && (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Baseline
                </span>
              )}
              {plan.isActive && (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Current Active Plan</span>
                </span>
              )}
            </div>

            {/* Subtitle & Metadata details */}
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span>Type: <strong className="text-slate-700 dark:text-slate-300">{plan.planType}</strong></span>
              <span>•</span>
              <span>Rev: <strong className="text-slate-700 dark:text-slate-300">{plan.versionLabel} (Rev {plan.revisionNumber})</strong></span>
              <span>•</span>
              <span>Effective: <strong className="text-slate-700 dark:text-slate-300">{plan.effectiveDate || 'Immediate'}</strong></span>
              <span>•</span>
              <span>Created by: <strong className="text-slate-700 dark:text-slate-300">{plan.createdBy || 'System'}</strong></span>
              <span>•</span>
              <span>Updated: <strong className="text-slate-700 dark:text-slate-300">{plan.lastUpdated || plan.updatedAt?.slice(0, 10)}</strong></span>
            </div>
            {plan.description && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 max-w-3xl italic">{plan.description}</p>
            )}
          </div>

          {/* Action Button Cluster */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsEditingModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 transition-colors shadow-2xs cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5 text-slate-600" />
              <span>Edit Details</span>
            </button>

            {!plan.isActive && plan.status !== 'Archived' && (
              <button
                onClick={handleActivate}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span>Activate Plan</span>
              </button>
            )}

            <button
              onClick={handleDuplicate}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-[#0078d4]" />
              <span>Duplicate</span>
            </button>

            {plan.status !== 'Archived' && (
              <button
                onClick={handleArchive}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5 text-rose-600" />
                <span>Archive</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. FINANCIAL SUMMARY RIBBON - Central Truth from PostgreSQL project_plan_cost_summaries */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3 bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Planned Revenue</span>
          <span className="font-mono text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
            {formatCurrency(cost.plannedRevenue, activeCurrency)}
          </span>
          <span className="text-[10px] text-slate-500">Quoted target</span>
        </div>

        <div className="p-3 bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Direct Cost</span>
          <span className="font-mono text-base font-bold text-[#0078d4] dark:text-sky-400 mt-0.5 block">
            {formatCurrency(cost.directCost, activeCurrency)}
          </span>
          <span className="text-[10px] text-slate-500">Materials, trades, outsourcing</span>
        </div>

        <div className="p-3 bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Allocated Overhead</span>
          <span className="font-mono text-base font-bold text-slate-700 dark:text-slate-300 mt-0.5 block">
            {formatCurrency(cost.allocatedOverhead, activeCurrency)}
          </span>
          <span className="text-[10px] text-slate-500">{plan.overheadPct}% ovh + {plan.contingencyPct}% ctg</span>
        </div>

        <div className="p-3 bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Planned Cost</span>
          <span className="font-mono text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
            {formatCurrency(cost.totalPlannedCost, activeCurrency)}
          </span>
          <span className="text-[10px] text-slate-500">Direct + Burden + Overhead</span>
        </div>

        <div className="p-3 bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Planned Profit</span>
          <span className={`font-mono text-base font-bold mt-0.5 block ${cost.plannedProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {formatCurrency(cost.plannedProfit, activeCurrency)}
          </span>
          <span className="text-[10px] text-slate-500">Revenue minus total cost</span>
        </div>

        <div className={`p-3 bg-white dark:bg-[#0b101b] border rounded-xl shadow-2xs ${marginHealthy ? 'border-emerald-300 dark:border-emerald-800' : 'border-amber-300 dark:border-amber-800'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Profit Margin</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${marginHealthy ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              Target {plan.targetMarginPct}%
            </span>
          </div>
          <span className={`font-mono text-base font-bold mt-0.5 block ${marginHealthy ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {Number(cost.profitMarginPct || 0).toFixed(1)}%
          </span>
          <span className="text-[10px] text-slate-500 flex items-center space-x-1">
            {marginHealthy ? <CheckCircle2 className="w-3 h-3 text-emerald-600 inline mr-1" /> : <AlertTriangle className="w-3 h-3 text-amber-600 inline mr-1" />}
            <span>{marginHealthy ? 'Target achieved' : 'Below target'}</span>
          </span>
        </div>
      </div>

      {/* 3. TABS NAVIGATION */}
      <div className="bg-white dark:bg-[#0b101b] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs p-1.5 flex flex-wrap items-center justify-start gap-1.5">
        <button
          onClick={() => setActiveTab('boq')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'boq' ? 'bg-[#0078d4] text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>BOQ Items ({(plan.boqItems || []).length})</span>
        </button>

        <button
          onClick={() => setActiveTab('sections')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'sections' ? 'bg-[#0078d4] text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Sections & Phases ({(plan.sections || []).length})</span>
        </button>

        <button
          onClick={() => setActiveTab('resources')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'resources' ? 'bg-[#0078d4] text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <HardHat className="w-3.5 h-3.5" />
          <span>Resources ({(plan.resources || []).length})</span>
        </button>

        <button
          onClick={() => setActiveTab('overheads')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'overheads' ? 'bg-[#0078d4] text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Overhead Allocations ({(plan.overheadAllocations || []).length})</span>
        </button>

        <button
          onClick={() => setActiveTab('revisions')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'revisions' ? 'bg-[#0078d4] text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Revision History ({(plan.revisions || []).length})</span>
        </button>
      </div>

      {/* 4. TAB CONTENTS */}
      {/* 4A. BOQ ITEMS */}
      {activeTab === 'boq' && (
        <div className="bg-white dark:bg-[#0b101b] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center space-x-2">
              <Package className="w-4 h-4 text-[#0078d4]" />
              <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">Bill of Quantities (BOQ)</h2>
              <span className="text-[11px] text-slate-500">
                {filteredBoq.length} of {(plan.boqItems || []).length} items
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Type Filter */}
              <select
                value={boqTypeFilter}
                onChange={(e) => setBoqTypeFilter(e.target.value)}
                className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 bg-white dark:bg-slate-800"
              >
                <option value="ALL">All Types</option>
                <option value="material">Materials</option>
                <option value="subcontractor">Subcontractor Trades</option>
                <option value="outsourced">Outsourced Services</option>
                <option value="produce">Assemblies / Produce</option>
                <option value="equipment">Equipment</option>
              </select>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter BOQ items..."
                  value={boqSearch}
                  onChange={(e) => setBoqSearch(e.target.value)}
                  className="pl-8 pr-3 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 w-48"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">#</th>
                  <th className="py-2.5 px-3 font-semibold">Type</th>
                  <th className="py-2.5 px-3 font-semibold">Code</th>
                  <th className="py-2.5 px-3 font-semibold">Name & Category</th>
                  <th className="py-2.5 px-3 font-semibold">Supplier / Vendor</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Quantity</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Unit Cost</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Disc %</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Total Cost</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Markup %</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Total Revenue</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Gross Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                {filteredBoq.map((item: any, idx: number) => {
                  const lineCost = Number(item.totalCost || 0);
                  const rev = Number(item.totalRevenue || 0);
                  const profit = Number(item.grossProfit || rev - lineCost);

                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors">
                      <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.5 text-[9px] uppercase font-bold rounded ${
                            item.type === 'subcontractor'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : item.type === 'outsourced'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          }`}
                        >
                          {item.type}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-[#0078d4] font-semibold">{item.itemCode || item.itemId || '-'}</td>
                      <td className="py-2 px-3 font-sans font-medium text-slate-900 dark:text-slate-100">
                        <div>{item.name}</div>
                        {item.category && <div className="text-[10px] text-slate-400">{item.category}</div>}
                      </td>
                      <td className="py-2 px-3 font-sans text-slate-600 dark:text-slate-400">
                        {item.supplierOrProvider || '-'}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {Number(item.quantity || 0).toLocaleString()} <span className="font-sans text-[10px] text-slate-400">{item.unit || 'pcs'}</span>
                      </td>
                      <td className="py-2 px-3 text-right">{formatCurrency(item.unitCost, activeCurrency)}</td>
                      <td className="py-2 px-3 text-right text-slate-500">
                        {item.discountPct ? `${item.discountPct}%` : '0%'}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(lineCost, activeCurrency)}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-500">
                        {item.markupPct ? `${item.markupPct}%` : '30%'}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-800 dark:text-slate-200">
                        {formatCurrency(rev, activeCurrency)}
                      </td>
                      <td className={`py-2 px-3 text-right font-semibold ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {formatCurrency(profit, activeCurrency)}
                      </td>
                    </tr>
                  );
                })}
                {filteredBoq.length === 0 && (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-slate-400 font-sans">
                      No BOQ line items match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4B. SECTIONS & PHASES */}
      {activeTab === 'sections' && (
        <div className="bg-white dark:bg-[#0b101b] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">Plan Phase Sections (Normalized PostgreSQL Records)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Phase Code</th>
                  <th className="py-2.5 px-3 font-semibold">Section Name & Scope</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Planned Budget</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Material Budget</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Labor Budget</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Outsourced Budget</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Actual Cost</th>
                  <th className="py-2.5 px-3 font-semibold">Dates</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                {(plan.sections || []).map((sec: any) => (
                  <tr key={sec.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                    <td className="py-2.5 px-3 font-bold text-[#0078d4]">{sec.phaseCode}</td>
                    <td className="py-2.5 px-3 font-sans font-medium text-slate-900 dark:text-slate-100">
                      <div>{sec.name}</div>
                      {sec.description && <div className="text-[10px] text-slate-400">{sec.description}</div>}
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-medium">
                        {sec.status || 'Planned'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(sec.plannedBudget, activeCurrency)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                      {formatCurrency(sec.materialBudget, activeCurrency)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                      {formatCurrency(sec.laborBudget, activeCurrency)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                      {formatCurrency(sec.outsourcedBudget, activeCurrency)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                      {formatCurrency(sec.actualCost, activeCurrency)}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-[10px] text-slate-500">
                      {sec.startDate || 'TBD'} → {sec.endDate || 'TBD'}
                    </td>
                  </tr>
                ))}
                {(plan.sections || []).length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 font-sans">
                      No phase sections defined for this plan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4C. RESOURCES */}
      {activeTab === 'resources' && (
        <div className="bg-white dark:bg-[#0b101b] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">Assigned Resources (project_plan_resources)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Type</th>
                  <th className="py-2.5 px-3 font-semibold">Resource Name</th>
                  <th className="py-2.5 px-3 font-semibold">Role / Trade</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Allocated Hours</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Hourly Rate</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Total Cost</th>
                  <th className="py-2.5 px-3 font-semibold">Dates</th>
                  <th className="py-2.5 px-3 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                {(plan.resources || []).map((res: any) => (
                  <tr key={res.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        {res.resourceType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-slate-100">{res.name}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400">{res.roleOrTrade || '-'}</td>
                    <td className="py-2.5 px-3 text-right">{Number(res.allocatedHours || 0).toLocaleString()} hrs</td>
                    <td className="py-2.5 px-3 text-right">{formatCurrency(res.hourlyRate, activeCurrency)}/hr</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(res.totalCost, activeCurrency)}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-[10px] text-slate-500">
                      {res.startDate || '-'} → {res.endDate || '-'}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-[10px] text-slate-500">{res.notes || '-'}</td>
                  </tr>
                ))}
                {(plan.resources || []).length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                      No dedicated resource schedule records linked to this plan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4D. OVERHEAD ALLOCATIONS */}
      {activeTab === 'overheads' && (
        <div className="bg-white dark:bg-[#0b101b] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">Overhead & Burden Allocations (project_plan_overhead_allocations)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Category</th>
                  <th className="py-2.5 px-3 font-semibold">Allocation Type</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Rate %</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Base Amount</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Allocated Amount</th>
                  <th className="py-2.5 px-3 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                {(plan.overheadAllocations || []).map((ovh: any) => (
                  <tr key={ovh.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                    <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-slate-100">{ovh.category}</td>
                    <td className="py-2.5 px-3 font-sans capitalize text-slate-600 dark:text-slate-400">{ovh.allocationType}</td>
                    <td className="py-2.5 px-3 text-right">{ovh.ratePct ? `${ovh.ratePct}%` : '-'}</td>
                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                      {formatCurrency(ovh.baseAmount, activeCurrency)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#0078d4] dark:text-sky-400">
                      {formatCurrency(ovh.allocatedAmount, activeCurrency)}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-[10px] text-slate-500">{ovh.notes || '-'}</td>
                  </tr>
                ))}
                {(plan.overheadAllocations || []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                      No customized overhead allocations recorded. Using default plan percentages.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4E. REVISION HISTORY */}
      {activeTab === 'revisions' && (
        <div className="bg-white dark:bg-[#0b101b] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">Revision History Audit (project_plan_revisions)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Rev #</th>
                  <th className="py-2.5 px-3 font-semibold">Version Label</th>
                  <th className="py-2.5 px-3 font-semibold">Change Summary</th>
                  <th className="py-2.5 px-3 font-semibold">Status at Rev</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Planned Revenue</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Direct Cost</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Total Cost</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Margin %</th>
                  <th className="py-2.5 px-3 font-semibold">Changed By</th>
                  <th className="py-2.5 px-3 font-semibold">Effective Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                {(plan.revisions || []).map((rev: any) => (
                  <tr key={rev.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">{rev.revisionNumber}</td>
                    <td className="py-2.5 px-3 font-bold text-[#0078d4]">{rev.versionLabel}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-800 dark:text-slate-200">{rev.changeSummary}</td>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                        {rev.statusAtRevision || 'Draft'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">{formatCurrency(rev.plannedRevenue, activeCurrency)}</td>
                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                      {formatCurrency(rev.directCost, activeCurrency)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(rev.totalPlannedCost, activeCurrency)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                      {Number(rev.profitMarginPct || 0).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400">{rev.changedBy}</td>
                    <td className="py-2.5 px-3 font-sans text-[10px] text-slate-500">{rev.effectiveDate || '-'}</td>
                  </tr>
                ))}
                {(plan.revisions || []).length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400 font-sans">
                      Initial revision history record pending.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. EDIT DETAILS MODAL */}
      {isEditingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Edit className="w-5 h-5 text-[#0078d4]" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Edit Plan Parameters</h3>
              </div>
              <button
                onClick={() => setIsEditingModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Plan Name *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Plan Type</label>
                  <select
                    value={editPlanType}
                    onChange={(e) => setEditPlanType(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="Baseline">Baseline</option>
                    <option value="Alternative">Alternative Scenario</option>
                    <option value="Cost Reduction">Cost Reduction</option>
                    <option value="Contingency">Contingency Plan</option>
                    <option value="Executive Review">Executive Review</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="Draft">Draft</option>
                    <option value="In Review">In Review</option>
                    <option value="Approved">Approved</option>
                    <option value="Active">Active</option>
                    <option value="Locked">Locked</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Target %</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editTargetMarginPct}
                    onChange={(e) => setEditTargetMarginPct(Number(e.target.value))}
                    className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Overhead %</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editOverheadPct}
                    onChange={(e) => setEditOverheadPct(Number(e.target.value))}
                    className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Contingency %</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editContingencyPct}
                    onChange={(e) => setEditContingencyPct(Number(e.target.value))}
                    className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Labor Burden %</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editLaborBurdenPct}
                    onChange={(e) => setEditLaborBurdenPct(Number(e.target.value))}
                    className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditingModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMetadata}
                disabled={savingEdit || !editName.trim()}
                className="flex items-center space-x-1.5 px-4 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white rounded-lg text-xs font-bold disabled:opacity-50"
              >
                {savingEdit ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
