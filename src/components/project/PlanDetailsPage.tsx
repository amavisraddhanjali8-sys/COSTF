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
  ExternalLink,
  Plus,
  Trash2,
  Edit2,
  Calculator,
  Barcode as BarcodeIcon,
  Tag,
  Info
} from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency, getStoredCurrency } from '../../utils/currency';
import { calculatePlanFinancials } from '../../utils/planCalculationService';
import { AddOverheadToPlanModal } from '../overhead/AddOverheadToPlanModal';
import { EditPlanOverheadAllocationModal } from '../overhead/EditPlanOverheadAllocationModal';
import { AddRevenueItemToPlanModal } from '../revenue/AddRevenueItemToPlanModal';
import { EditPlanBoqItemModal } from '../revenue/EditPlanBoqItemModal';
import { RevenueItemRateHistoryModal } from '../revenue/RevenueItemRateHistoryModal';
import { ProjectCommercialHistoryModal } from '../revenue/ProjectCommercialHistoryModal';
import { ProcurementPriceHistoryModal } from '../pricing/ProcurementPriceHistoryModal';
import { PlanBarcodeScannerModal } from './PlanBarcodeScannerModal';
import { AddPlanResourceModal } from './AddPlanResourceModal';
import { PlanCostControlsTab } from './PlanCostControlsTab';
import { round2 } from '../../utils/decimalMath';
import { ApplyTariffToPlanModal } from '../tariffs/ApplyTariffToPlanModal';
import {
  RevenueItem,
  ProjectPlanBoqItem,
  ProcurementPriceRecord,
  Supplier,
  MaterialItem,
  OutsourcedService,
  SubcontractorRateItem,
  Tariff,
  PlanTariff,
  EnterpriseResource
} from '../../types';

interface PlanDetailsPageProps {
  planId: string;
  projectId?: string;
  initialTab?: 'boq' | 'sections' | 'resources' | 'overheads' | 'tariffs' | 'revisions' | 'cost-controls';
  onNavigateBack: () => void;
  onPlanUpdated?: () => void;
  onOpenProject?: (projectId: string) => void;
  onOpenOverheadPortal?: () => void;
  showToast?: (msg: string | { message: string; type?: string }) => void;
}

export const PlanDetailsPage: React.FC<PlanDetailsPageProps> = ({
  planId,
  projectId,
  initialTab = 'boq',
  onNavigateBack,
  onPlanUpdated,
  onOpenProject,
  onOpenOverheadPortal,
  showToast
}) => {
  const [plan, setPlan] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'boq' | 'sections' | 'resources' | 'overheads' | 'tariffs' | 'revisions' | 'cost-controls'>(initialTab);
  const [boqSearch, setBoqSearch] = useState('');
  const [boqTypeFilter, setBoqTypeFilter] = useState<string>('ALL');

  // Tariffs allocation management state (TASK 9)
  const [planTariffs, setPlanTariffs] = useState<PlanTariff[]>([]);
  const [availableTariffs, setAvailableTariffs] = useState<Tariff[]>([]);
  const [isApplyTariffModalOpen, setIsApplyTariffModalOpen] = useState(false);
  const [deletingPlanTariffId, setDeletingPlanTariffId] = useState<string | null>(null);

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

  // Overhead allocation management state
  const [isAddOverheadModalOpen, setIsAddOverheadModalOpen] = useState(false);
  const [isEditOverheadModalOpen, setIsEditOverheadModalOpen] = useState(false);
  const [selectedAllocationToEdit, setSelectedAllocationToEdit] = useState<any | null>(null);
  const [recalculatingOverheads, setRecalculatingOverheads] = useState(false);
  const [deletingAllocationId, setDeletingAllocationId] = useState<string | null>(null);

  // Revenue and BOQ modals state (Task 3)
  const [isAddRevenueItemModalOpen, setIsAddRevenueItemModalOpen] = useState(false);
  const [isEditBoqItemModalOpen, setIsEditBoqItemModalOpen] = useState(false);
  const [selectedBoqItemToEdit, setSelectedBoqItemToEdit] = useState<ProjectPlanBoqItem | null>(null);
  const [isProjectCommercialHistoryModalOpen, setIsProjectCommercialHistoryModalOpen] = useState(false);
  const [isItemHistoryModalOpen, setIsItemHistoryModalOpen] = useState(false);
  const [historyTargetRevenueItem, setHistoryTargetRevenueItem] = useState<RevenueItem | null>(null);
  const [deletingBoqItemId, setDeletingBoqItemId] = useState<string | null>(null);

  // Procurement Price History & Quotation selection (TASK 5)
  const [isProcurementQuotesModalOpen, setIsProcurementQuotesModalOpen] = useState(false);

  // Enterprise Resources state for Plan Resource assignment
  const [enterpriseResources, setEnterpriseResources] = useState<EnterpriseResource[]>([]);
  const [isAddResourceModalOpen, setIsAddResourceModalOpen] = useState(false);
  const [editingPlanResource, setEditingPlanResource] = useState<any | null>(null);

  // Barcode Scanning and Selection Modal (TASK 7)
  const [isBarcodeScannerModalOpen, setIsBarcodeScannerModalOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [outsourcedServices, setOutsourcedServices] = useState<OutsourcedService[]>([]);
  const [subcontractors, setSubcontractors] = useState<SubcontractorRateItem[]>([]);

  const handleApplyPriceSnapshotToPlan = async (record: ProcurementPriceRecord) => {
    if (!plan) return;
    try {
      const type = record.itemType === 'material'
        ? 'material'
        : record.itemType === 'subcontractor_rate'
        ? 'subcontractor'
        : 'outsourced';
      const sellingRate = round2(record.unitPrice * 1.3);
      await api.addRevenueItemToPlan(plan.id, {
        name: `${record.itemName} [${record.supplierName}]`,
        type,
        category: record.category || 'Direct Sourced Procurement',
        quantity: 1,
        unit: record.unit || 'unit',
        unitCost: record.unitPrice,
        sellingRate: sellingRate,
        rate: sellingRate,
        supplierOrProvider: record.supplierName,
        supplierId: record.supplierId,
        itemId: record.itemId,
        quotationRef: record.quotationRef,
        costStage: record.costStage,
        priceType: record.priceType,
        priceHistoryId: record.id,
        priceSnapshot: {
          priceHistoryId: record.id,
          supplierId: record.supplierId,
          supplierName: record.supplierName,
          unitPrice: record.unitPrice,
          currency: record.currency,
          unit: record.unit,
          effectiveDate: record.effectiveDate,
          quotationRef: record.quotationRef,
          costStage: record.costStage,
          priceType: record.priceType,
          capturedAt: new Date().toISOString()
        },
        notes: `Sourced from ${record.supplierName} (${record.priceType.replace(/_/g, ' ')}${record.quotationRef ? ', Ref: ' + record.quotationRef : ''})`
      });
      await loadPlan();
      onPlanUpdated?.();
      showToast?.({
        message: `Applied price snapshot of ${formatCurrency(record.unitPrice, record.currency)}/${record.unit} from ${record.supplierName} to ${plan.planNumber}.`,
        type: 'success'
      });
    } catch (err: any) {
      showToast?.({ message: err?.message || 'Failed to apply price snapshot to plan', type: 'error' });
    }
  };

  const activeCurrency = plan?.currency || getStoredCurrency();

  const loadPlan = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, tariffsData, resourcesData] = await Promise.all([
        api.getProjectPlanById(planId),
        api.getPlanTariffs(planId).catch(() => []),
        api.getResources().catch(() => [])
      ]);
      if (!data) throw new Error('Plan not found in PostgreSQL database.');
      setPlan(data);
      setPlanTariffs(tariffsData || []);
      setEnterpriseResources(resourcesData || []);
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

  const handleSavePlanResource = async (resourceData: any) => {
    if (!plan) return;
    try {
      if (editingPlanResource?.id) {
        await api.updatePlanResource(plan.id, editingPlanResource.id, resourceData);
        showToast?.({ message: 'Resource updated', type: 'success' });
      } else {
        await api.addResourceToPlan(plan.id, resourceData);
        showToast?.({ message: 'Resource assigned', type: 'success' });
      }
      setIsAddResourceModalOpen(false);
      setEditingPlanResource(null);
      await loadPlan();
      onPlanUpdated?.();
    } catch (err: any) {
      showToast?.({ message: err?.message || 'Failed to save resource', type: 'error' });
    }
  };

  const handleDeletePlanResource = async (resourceId: string) => {
    if (!plan) return;
    try {
      await api.deletePlanResource(plan.id, resourceId);
      showToast?.({ message: 'Resource removed', type: 'info' });
      await loadPlan();
      onPlanUpdated?.();
    } catch (err: any) {
      showToast?.({ message: err?.message || 'Failed to remove resource', type: 'error' });
    }
  };

  const loadAvailableTariffs = async () => {
    try {
      const list = await api.getTariffs();
      setAvailableTariffs(list || []);
    } catch (e) {
      console.error('Failed to load available tariffs:', e);
    }
  };

  const handleRemovePlanTariff = async (tariffScheduleId: string, name: string) => {
    if (!plan) return;
    if (!window.confirm(`Are you sure you want to remove tariff schedule "${name}" from this plan?`)) return;
    setDeletingPlanTariffId(tariffScheduleId);
    try {
      await api.removePlanTariff(plan.id, tariffScheduleId);
      showToast?.({ message: `Removed tariff "${name}" from plan.`, type: 'info' });
      const refreshed = await api.getPlanTariffs(plan.id);
      setPlanTariffs(refreshed || []);
      onPlanUpdated?.();
    } catch (err: any) {
      showToast?.({ message: err?.message || 'Failed to remove plan tariff', type: 'error' });
    } finally {
      setDeletingPlanTariffId(null);
    }
  };

  useEffect(() => {
    if (planId) {
      void loadPlan();
    }
    api.getInitialData().then((data) => {
      if (data?.suppliers) setSuppliers(data.suppliers);
      if (data?.materials) setMaterials(data.materials);
      if (data?.outsourcedServices || data?.outsourced) setOutsourcedServices(data.outsourcedServices || data.outsourced);
      if (data?.subcontractors) setSubcontractors(data.subcontractors);
    }).catch((err) => {
      console.warn('Initial data load warning:', err);
    });
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

  const handleDeleteBoqItem = async (boqItemId: string, itemName: string) => {
    if (!plan) return;
    if (!window.confirm(`Are you sure you want to remove "${itemName}" from this plan's BOQ?`)) return;
    setDeletingBoqItemId(boqItemId);
    try {
      await api.deletePlanBoqItem(plan.id, boqItemId);
      showToast?.({ message: `Removed "${itemName}" from plan BOQ.`, type: 'info' });
      await loadPlan();
      onPlanUpdated?.();
    } catch (err: any) {
      showToast?.({ message: err?.message || 'Failed to remove BOQ item', type: 'error' });
    } finally {
      setDeletingBoqItemId(null);
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

  const handleRecalculateOverheads = async () => {
    if (!plan) return;
    setRecalculatingOverheads(true);
    try {
      await api.recalculatePlanOverheads(plan.id);
      await loadPlan();
      onPlanUpdated?.();
      showToast?.({ message: 'Overhead allocations recalculated against current cost bases.', type: 'success' });
    } catch (err: any) {
      showToast?.({ message: err?.message || 'Failed to recalculate overheads', type: 'error' });
    } finally {
      setRecalculatingOverheads(false);
    }
  };

  const handleDeleteAllocation = async (allocationId: string, itemName: string) => {
    if (!plan) return;
    if (!window.confirm(`Are you sure you want to remove overhead allocation '${itemName}' from this plan?`)) return;
    setDeletingAllocationId(allocationId);
    try {
      await api.deletePlanOverheadAllocation(plan.id, allocationId);
      await loadPlan();
      onPlanUpdated?.();
      showToast?.({ message: `Overhead allocation '${itemName}' removed.`, type: 'info' });
    } catch (err: any) {
      showToast?.({ message: err?.message || 'Failed to remove overhead allocation', type: 'error' });
    } finally {
      setDeletingAllocationId(null);
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

            {/* Associated Client Banner (Requirement 13) */}
            <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
              <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 rounded-lg border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-sky-300">
                <Building2 className="w-3.5 h-3.5 text-[#0078d4]" />
                <span className="font-semibold text-slate-500 dark:text-slate-400">Associated Client:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{plan.clientName || 'General Enterprise Client'}</span>
                {plan.clientCode && (
                  <span className="font-mono text-[10px] px-1.5 py-0.2 bg-white dark:bg-slate-900 rounded border border-blue-200 dark:border-blue-700 text-[#0078d4]">
                    {plan.clientCode}
                  </span>
                )}
              </div>
              {plan.clientIndustry && (
                <span className="text-slate-500 dark:text-slate-400">
                  Sector: <strong className="text-slate-700 dark:text-slate-300">{plan.clientIndustry}</strong>
                </span>
              )}
              {plan.clientContactPerson && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    Lead: <strong className="text-slate-700 dark:text-slate-300">{plan.clientContactPerson}</strong>
                  </span>
                </>
              )}
              {plan.clientEmail && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    Email: <a href={`mailto:${plan.clientEmail}`} className="text-[#0078d4] hover:underline font-medium">{plan.clientEmail}</a>
                  </span>
                </>
              )}
            </div>
            {plan.description && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 max-w-3xl italic">{plan.description}</p>
            )}
          </div>

          {/* Action Button Cluster */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setIsEditingModalOpen(true)}
              className="flex items-center space-x-1 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 transition-colors shadow-2xs cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5 text-slate-600" />
              <span>Edit</span>
            </button>

            {!plan.isActive && plan.status !== 'Archived' && (
              <button
                onClick={handleActivate}
                className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span>Activate</span>
              </button>
            )}

            <button
              onClick={handleDuplicate}
              className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-[#0078d4]" />
              <span>Copy</span>
            </button>

            {plan.status !== 'Archived' && (
              <button
                onClick={handleArchive}
                className="flex items-center space-x-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5 text-rose-600" />
                <span>Archive</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. FINANCIAL SUMMARY RIBBON - Clean & Simple */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3 bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Revenue</span>
          <span className="font-mono text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
            {formatCurrency(cost.plannedRevenue, activeCurrency)}
          </span>
        </div>

        <div className="p-3 bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Direct</span>
          <span className="font-mono text-base font-bold text-[#0078d4] dark:text-sky-400 mt-0.5 block">
            {formatCurrency(cost.directCost, activeCurrency)}
          </span>
        </div>

        <div className="p-3 bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Overhead</span>
          <span className="font-mono text-base font-bold text-slate-700 dark:text-slate-300 mt-0.5 block">
            {formatCurrency(cost.allocatedOverhead, activeCurrency)}
          </span>
        </div>

        <div className="p-3 bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Cost</span>
          <span className="font-mono text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
            {formatCurrency(cost.totalPlannedCost, activeCurrency)}
          </span>
        </div>

        <div className="p-3 bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Profit</span>
          <span className={`font-mono text-base font-bold mt-0.5 block ${cost.plannedProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {formatCurrency(cost.plannedProfit, activeCurrency)}
          </span>
        </div>

        <div className={`p-3 bg-white dark:bg-[#0b101b] border rounded-xl shadow-2xs ${marginHealthy ? 'border-emerald-300 dark:border-emerald-800' : 'border-amber-300 dark:border-amber-800'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Margin</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${marginHealthy ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              Target {plan.targetMarginPct}%
            </span>
          </div>
          <span className={`font-mono text-base font-bold mt-0.5 block ${marginHealthy ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {Number(cost.profitMarginPct || 0).toFixed(1)}%
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
          <span>BOQ ({(plan.boqItems || []).length})</span>
        </button>

        <button
          onClick={() => setActiveTab('sections')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'sections' ? 'bg-[#0078d4] text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Phases ({(plan.sections || []).length})</span>
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
          <span>Overheads ({(plan.overheadAllocations || []).length})</span>
        </button>

        <button
          id="tab-plan-tariffs"
          onClick={() => setActiveTab('tariffs')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'tariffs' ? 'bg-[#0078d4] text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>Tariffs ({planTariffs.length})</span>
        </button>

        <button
          id="tab-plan-cost-controls"
          onClick={() => setActiveTab('cost-controls')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'cost-controls' ? 'bg-[#0078d4] text-white shadow-2xs font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Controls</span>
        </button>

        <button
          onClick={() => setActiveTab('revisions')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'revisions' ? 'bg-[#0078d4] text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>History ({(plan.revisions || []).length})</span>
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
              {/* Add Revenue Item Button */}
              <button
                type="button"
                onClick={() => setIsAddRevenueItemModalOpen(true)}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center space-x-1 cursor-pointer shadow-xs"
                title="Add a revenue product or service from catalogue to plan BOQ"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Revenue Item</span>
              </button>

              {/* Scan Barcode Button (TASK 7) */}
              <button
                type="button"
                onClick={() => setIsBarcodeScannerModalOpen(true)}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#003049] hover:bg-[#002235] text-white flex items-center space-x-1 cursor-pointer shadow-xs border border-sky-500/40"
                title="Scan or search barcode with camera, USB scanner, or manual code to add item to plan BOQ"
              >
                <BarcodeIcon className="w-3.5 h-3.5 text-sky-400" />
                <span>Scan Barcode</span>
              </button>

              {/* Project Commercial History */}
              <button
                type="button"
                onClick={() => setIsProjectCommercialHistoryModalOpen(true)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center space-x-1 cursor-pointer"
                title="View project commercial audit history across all plans"
              >
                <History className="w-3.5 h-3.5" />
                <span>Commercial History</span>
              </button>

              {/* Sourced Procurement Quotes & Rates (TASK 5) */}
              <button
                type="button"
                onClick={() => setIsProcurementQuotesModalOpen(true)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center space-x-1 cursor-pointer shadow-2xs"
                title="Browse and select verified supplier, vendor, and subcontractor quotations to add as price snapshot items"
              >
                <Tag className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Procurement Quotes & Rates</span>
              </button>

              {/* Type Filter */}
              <select
                value={boqTypeFilter}
                onChange={(e) => setBoqTypeFilter(e.target.value)}
                className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 bg-white dark:bg-slate-800"
              >
                <option value="ALL">All Types</option>
                <option value="product">Products Sold</option>
                <option value="service">Services Provided</option>
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
                  className="pl-8 pr-3 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 w-44"
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
                  <th className="py-2.5 px-3 font-semibold">Name & Scope</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Quantity</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Selling Rate</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Unit Cost</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Disc %</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Total Revenue</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Gross Profit</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                {filteredBoq.map((item: any, idx: number) => {
                  const lineCost = Number(item.totalCost || 0);
                  const rev = Number(item.totalRevenue || 0);
                  const profit = Number(item.grossProfit || rev - lineCost);
                  const sellingRate = Number(item.rate ?? item.billableRate ?? item.sellingRate ?? 0);

                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors">
                      <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.5 text-[9px] uppercase font-bold rounded ${
                            item.type === 'service'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                              : item.type === 'product'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : item.type === 'subcontractor'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : item.type === 'outsourced'
                              ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                              : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {item.type}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-[#0078d4] font-semibold">{item.itemCode || item.revenueItemCode || item.itemId || '-'}</td>
                      <td className="py-2 px-3 font-sans font-medium text-slate-900 dark:text-slate-100 max-w-[220px]">
                        <div className="truncate font-semibold">{item.name}</div>
                        {item.description && item.description !== item.name && (
                          <div className="text-[10px] text-slate-400 truncate">{item.description}</div>
                        )}
                        {item.category && <div className="text-[10px] text-slate-500 italic">{item.category}</div>}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {Number(item.quantity || 0).toLocaleString()} <span className="font-sans text-[10px] text-slate-400">{item.unit || 'pcs'}</span>
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(sellingRate, activeCurrency)}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-500">
                        {formatCurrency(item.unitCost || 0, activeCurrency)}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-500">
                        {item.discountPct ? `${item.discountPct}%` : '0%'}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(rev, activeCurrency)}
                      </td>
                      <td className={`py-2 px-3 text-right font-semibold ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {formatCurrency(profit, activeCurrency)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end space-x-1 font-sans">
                          {/* Edit commercial terms */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBoqItemToEdit(item);
                              setIsEditBoqItemModalOpen(true);
                            }}
                            className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Edit plan commercial terms (rate, quantity, discount, scope)"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Rate history */}
                          {(item.revenueItemId || item.itemId) && (
                            <button
                              type="button"
                              onClick={() => {
                                setHistoryTargetRevenueItem({
                                  id: item.revenueItemId || item.itemId,
                                  code: item.itemCode || item.revenueItemCode || item.name,
                                  barcode: '',
                                  name: item.name,
                                  type: item.type === 'service' ? 'service' : 'product',
                                  category: item.category || 'General',
                                  description: item.description || '',
                                  unit: item.unit || 'unit',
                                  defaultRate: sellingRate,
                                  currency: item.currency || activeCurrency,
                                  status: 'Active',
                                  createdAt: new Date().toISOString(),
                                  updatedAt: new Date().toISOString()
                                });
                                setIsItemHistoryModalOpen(true);
                              }}
                              className="p-1 rounded text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="View commercial rate history for this item across projects/plans"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete item */}
                          <button
                            type="button"
                            disabled={deletingBoqItemId === item.id}
                            onClick={() => handleDeleteBoqItem(item.id, item.name)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                            title="Remove item from plan BOQ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredBoq.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400 font-sans">
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
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <HardHat className="w-4 h-4 text-[#0078d4]" />
              <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">Resources</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingPlanResource(null);
                setIsAddResourceModalOpen(true);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Resource</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Type</th>
                  <th className="py-2.5 px-3 font-semibold">Name</th>
                  <th className="py-2.5 px-3 font-semibold">Role</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Hours</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Rate</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Cost</th>
                  <th className="py-2.5 px-3 font-semibold">Dates</th>
                  <th className="py-2.5 px-3 font-semibold">Notes</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Actions</th>
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
                    <td className="py-2.5 px-3 text-right">{Number(res.allocatedHours || 0).toLocaleString()} {res.unit || 'hrs'}</td>
                    <td className="py-2.5 px-3 text-right">{formatCurrency(res.hourlyRate, activeCurrency)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(res.totalCost, activeCurrency)}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-[10px] text-slate-500">
                      {res.startDate || '-'} → {res.endDate || '-'}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-[10px] text-slate-500">{res.notes || '-'}</td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1 font-sans">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPlanResource(res);
                            setIsAddResourceModalOpen(true);
                          }}
                          className="p-1 rounded text-slate-500 hover:text-[#0078d4] hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePlanResource(res.id)}
                          className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(plan.resources || []).length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 font-sans">
                      <div className="max-w-xs mx-auto space-y-2">
                        <p className="text-xs">No resources assigned.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPlanResource(null);
                            setIsAddResourceModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-[#0078d4] text-white rounded-lg text-xs font-bold inline-flex items-center space-x-1 shadow-xs cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Resource</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4D. OVERHEAD ALLOCATIONS (TASK 2) */}
      {activeTab === 'overheads' && (
        <div className="space-y-4">
          {/* Overhead Overview Metric Tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-white dark:bg-[#0b101b] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Allocated Overhead</span>
              <div className="text-lg font-bold text-[#0078d4] dark:text-sky-400 font-mono mt-0.5">
                {formatCurrency(plan.summary?.allocatedOverhead || 0, activeCurrency)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                <Layers className="w-3 h-3 text-[#0078d4]" />
                <span>Centralized & custom overheads</span>
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-[#0b101b] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Direct Cost Base</span>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
                {formatCurrency(plan.summary?.directCost || 0, activeCurrency)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                BOQ direct materials + subs + services
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-[#0b101b] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Overhead / Direct Ratio</span>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
                {Number(plan.summary?.directCost || 0) > 0
                  ? ((Number(plan.summary?.allocatedOverhead || 0) / Number(plan.summary?.directCost)) * 100).toFixed(1)
                  : '0.0'}%
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Effective burden on project direct cost
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-[#0b101b] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Allocations</span>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
                {(plan.overheadAllocations || []).length} Items
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Individually allocated to this plan</span>
              </div>
            </div>
          </div>

          {/* Allocation Actions & Table */}
          <div className="bg-white dark:bg-[#0b101b] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#0078d4]" />
                  <span>Plan Overhead Allocations (plan_overhead_allocations)</span>
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Connect centralized overhead items to this plan with custom rates, bases, or fixed amounts.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                {onOpenOverheadPortal && (
                  <button
                    type="button"
                    onClick={onOpenOverheadPortal}
                    className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
                    title="Open Centralized Overhead Catalogue"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Catalogue Portal</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleRecalculateOverheads}
                  disabled={recalculatingOverheads}
                  className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                  title="Recalculate allocations against latest project cost bases"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${recalculatingOverheads ? 'animate-spin text-[#0078d4]' : ''}`} />
                  <span>{recalculatingOverheads ? 'Recalculating...' : 'Recalculate'}</span>
                </button>

                <button
                  type="button"
                  id="btn-add-overhead-item"
                  onClick={() => setIsAddOverheadModalOpen(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#0078d4] hover:bg-[#006cbd] text-white text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Overhead Item</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Code & Barcode</th>
                    <th className="py-2.5 px-3 font-semibold">Overhead Item & Category</th>
                    <th className="py-2.5 px-3 font-semibold">Allocation Method</th>
                    <th className="py-2.5 px-3 font-semibold">Allocation Base</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Rate / Pct</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Base Amount</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Allocated Amount</th>
                    <th className="py-2.5 px-3 font-semibold">Effective Date</th>
                    <th className="py-2.5 px-3 font-semibold">Notes</th>
                    <th className="py-2.5 px-3 font-semibold text-center w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                  {(plan.overheadAllocations || []).map((ovh: any) => {
                    const method = ovh.allocationMethod || (ovh.allocationType === 'fixed' ? 'fixed_amount' : 'percentage_of_cost_base');
                    const base = ovh.allocationBase || 'total_direct_cost';
                    const code = ovh.overheadItemCode || ovh.code || '-';
                    const barcode = ovh.barcode;
                    const name = ovh.overheadItemName || ovh.name || ovh.category;

                    return (
                      <tr key={ovh.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-[#0078d4] dark:text-sky-400">{code}</div>
                          {barcode && (
                            <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                              <BarcodeIcon className="w-3 h-3 text-slate-400" />
                              <span>{barcode}</span>
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 font-sans">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {ovh.category}
                            </span>
                            {ovh.costType && (
                              <span className="text-[9px] text-slate-400 font-mono">• {ovh.costType}</span>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 font-sans">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              method === 'fixed_amount'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : method === 'rate_per_unit'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                : method === 'proportional_defined_base'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            }`}
                          >
                            {method === 'fixed_amount'
                              ? 'Fixed Amount'
                              : method === 'rate_per_unit'
                              ? 'Rate per Unit'
                              : method === 'proportional_defined_base'
                              ? 'Proportional Base'
                              : '% of Cost Base'}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400">
                          {method === 'fixed_amount' ? (
                            <span className="text-slate-400 italic">Not applicable</span>
                          ) : (
                            <span className="capitalize">
                              {base.replace(/_/g, ' ')}
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          {method === 'fixed_amount' ? (
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {formatCurrency(ovh.allocationRate || ovh.allocatedAmount, activeCurrency)}
                            </span>
                          ) : method === 'rate_per_unit' ? (
                            <span>
                              {formatCurrency(ovh.allocationRate, activeCurrency)} / {ovh.unitType || 'unit'}
                              {ovh.unitQuantity && <span className="text-[10px] text-slate-400 ml-1">×{ovh.unitQuantity}</span>}
                            </span>
                          ) : (
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {Number(ovh.allocationRate ?? ovh.ratePct ?? 0).toFixed(2)}%
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                          {method === 'fixed_amount' ? '-' : formatCurrency(ovh.baseAmount, activeCurrency)}
                        </td>

                        <td className="py-2.5 px-3 text-right font-bold text-[#0078d4] dark:text-sky-400 text-xs">
                          {formatCurrency(ovh.allocatedAmount, activeCurrency)}
                        </td>

                        <td className="py-2.5 px-3 font-sans text-slate-500 text-[10px]">
                          {ovh.effectiveDate || '-'}
                        </td>

                        <td className="py-2.5 px-3 font-sans text-slate-500 text-[10px] max-w-[120px] truncate" title={ovh.notes}>
                          {ovh.notes || '-'}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAllocationToEdit(ovh);
                                setIsEditOverheadModalOpen(true);
                              }}
                              className="p-1 text-slate-500 hover:text-[#0078d4] dark:hover:text-sky-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                              title="Edit plan-specific allocation parameters"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAllocation(ovh.id, name)}
                              disabled={deletingAllocationId === ovh.id}
                              className="p-1 text-slate-500 hover:text-rose-600 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors disabled:opacity-50"
                              title="Remove allocation from this plan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {(plan.overheadAllocations || []).length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400 font-sans">
                        <Layers className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                        <div className="font-semibold text-slate-700 dark:text-slate-300">No overhead items allocated to this plan yet.</div>
                        <div className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                          Click "Add Overhead Item" above to select from the centralized catalogue or create a new overhead cost for this plan.
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsAddOverheadModalOpen(true)}
                          className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white rounded-lg text-xs font-bold cursor-pointer shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add First Overhead Allocation</span>
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>

                {(plan.overheadAllocations || []).length > 0 && (
                  <tfoot className="bg-slate-50 dark:bg-slate-900/90 font-mono border-t-2 border-slate-200 dark:border-slate-800">
                    <tr>
                      <td colSpan={6} className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-slate-100 text-right">
                        Total Allocated Plan Overhead:
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-sm text-[#0078d4] dark:text-sky-400">
                        {formatCurrency(plan.summary?.allocatedOverhead || 0, activeCurrency)}
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4E. APPLIED TARIFFS (TASK 9) */}
      {activeTab === 'tariffs' && (
        <div className="bg-white dark:bg-[#0b101b] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-900/50">
            <div>
              <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-indigo-500" />
                <span>Applied Tariff Schedules (plan_tariffs)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  {planTariffs.length} Active
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Enterprise tariff schedules applied to this plan with version-resolved rates, base amounts, and audit trail.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                id="btn-apply-tariff-to-plan"
                onClick={async () => {
                  await loadAvailableTariffs();
                  setIsApplyTariffModalOpen(true);
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Apply Tariff Schedule</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Tariff Code</th>
                  <th className="py-2.5 px-3 font-semibold">Tariff Name & Category</th>
                  <th className="py-2.5 px-3 font-semibold">Method & Base</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Applied Rate / Fee</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Base Amount</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Calculated Tariff</th>
                  <th className="py-2.5 px-3 font-semibold">Effective Window</th>
                  <th className="py-2.5 px-3 font-semibold">Notes</th>
                  <th className="py-2.5 px-3 font-semibold text-center w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                {planTariffs.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-indigo-600 dark:text-indigo-400">
                      {t.tariffCode}
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      <div className="font-bold text-slate-900 dark:text-slate-100">{t.tariffName}</div>
                      <div className="text-[10px] text-slate-400">{t.tariffCategory}</div>
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {t.calculationMethod.replace(/_/g, ' ')}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{t.applicableBase}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {t.calculationMethod === 'percentage' ? (
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{t.rateOrPercentage}%</span>
                      ) : t.calculationMethod === 'fixed_charge' ? (
                        <span className="font-bold">{formatCurrency(t.fixedCharge, t.currency || activeCurrency)}</span>
                      ) : (
                        <span>{t.rateOrPercentage}% + {formatCurrency(t.fixedCharge, t.currency || activeCurrency)}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                      {formatCurrency(t.baseAmount, t.currency || activeCurrency)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-sm text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(t.calculatedTariffAmount, t.currency || activeCurrency)}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-[10px] text-slate-500">
                      {t.effectiveFrom} {t.effectiveTo ? `→ ${t.effectiveTo}` : '(Ongoing)'}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-[11px] text-slate-500 max-w-[200px] truncate" title={t.notes}>
                      {t.notes || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemovePlanTariff(t.id, t.tariffName)}
                        disabled={deletingPlanTariffId === t.id}
                        className="p-1 text-slate-500 hover:text-rose-600 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors disabled:opacity-50"
                        title="Remove tariff from plan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}

                {planTariffs.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-sans">
                      <Calculator className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                      <div className="font-semibold text-slate-700 dark:text-slate-300">No tariffs applied to this plan.</div>
                      <div className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                        Tariffs are not automatically applied unless explicitly assigned to this plan. Click below to apply a tariff schedule.
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await loadAvailableTariffs();
                          setIsApplyTariffModalOpen(true);
                        }}
                        className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Apply Tariff Schedule</span>
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>

              {planTariffs.length > 0 && (
                <tfoot className="bg-slate-50 dark:bg-slate-900/90 font-mono border-t-2 border-slate-200 dark:border-slate-800">
                  <tr>
                    <td colSpan={5} className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-slate-100 text-right">
                      Total Applied Plan Tariffs:
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-sm text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(
                        planTariffs.reduce((sum, item) => sum + (Number(item.calculatedTariffAmount) || 0), 0),
                        activeCurrency
                      )}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* 4F. REVISION HISTORY */}
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

      {/* 4G. PLAN COST CONTROLS & BUDGET CEILINGS (PostgreSQL inno_cost) */}
      {activeTab === 'cost-controls' && (
        <PlanCostControlsTab
          planId={plan.id}
          projectId={plan.projectId || plan.project_id || projectId}
          planName={plan.name}
          planNumber={plan.planNumber || plan.plan_number}
          currency={activeCurrency}
          onCostControlsUpdated={async () => {
            await loadPlan();
            onPlanUpdated?.();
          }}
          showToast={showToast}
        />
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

      {/* Add Overhead Item to Plan Modal */}
      {isAddOverheadModalOpen && (
        <AddOverheadToPlanModal
          isOpen={isAddOverheadModalOpen}
          onClose={() => setIsAddOverheadModalOpen(false)}
          planId={plan.id}
          planNumber={plan.planNumber}
          planName={plan.name}
          planFinancials={{
            plannedRevenue: Number(plan.summary?.plannedRevenue || plan.plannedRevenue || 0),
            directCost: Number(plan.summary?.directCost || 0),
            materialCost: Number(plan.summary?.materialCost || 0),
            subcontractorCost: Number(plan.summary?.subcontractorCost || 0),
            outsourcedCost: Number(plan.summary?.outsourcedCost || 0),
            resourceCost: Number(plan.summary?.resourceCost || 0)
          }}
          existingAllocatedItemIds={(plan.overheadAllocations || [])
            .map((o: any) => o.overheadItemId)
            .filter(Boolean)}
          onAllocationAdded={async () => {
            await loadPlan();
            onPlanUpdated?.();
            showToast?.({ message: 'Overhead item successfully allocated to plan.', type: 'success' });
          }}
          showToast={showToast}
        />
      )}

      {/* Edit Plan Overhead Allocation Modal */}
      {isEditOverheadModalOpen && selectedAllocationToEdit && (
        <EditPlanOverheadAllocationModal
          isOpen={isEditOverheadModalOpen}
          onClose={() => {
            setIsEditOverheadModalOpen(false);
            setSelectedAllocationToEdit(null);
          }}
          planId={plan.id}
          planNumber={plan.planNumber}
          allocation={selectedAllocationToEdit}
          planFinancials={{
            plannedRevenue: Number(plan.summary?.plannedRevenue || plan.plannedRevenue || 0),
            directCost: Number(plan.summary?.directCost || 0),
            materialCost: Number(plan.summary?.materialCost || 0),
            subcontractorCost: Number(plan.summary?.subcontractorCost || 0),
            outsourcedCost: Number(plan.summary?.outsourcedCost || 0),
            resourceCost: Number(plan.summary?.resourceCost || 0)
          }}
          onAllocationUpdated={async () => {
            await loadPlan();
            onPlanUpdated?.();
            showToast?.({ message: 'Plan overhead allocation parameters updated.', type: 'success' });
          }}
          showToast={showToast}
        />
      )}

      {/* Add Revenue Item to Plan Modal (Task 3) */}
      {isAddRevenueItemModalOpen && (
        <AddRevenueItemToPlanModal
          isOpen={isAddRevenueItemModalOpen}
          onClose={() => setIsAddRevenueItemModalOpen(false)}
          onSuccess={async () => {
            await loadPlan();
            onPlanUpdated?.();
            showToast?.({ message: 'Revenue item successfully added to plan BOQ.', type: 'success' });
          }}
          planId={plan.id}
          projectId={plan.projectId}
          activeCurrency={activeCurrency}
        />
      )}

      {/* Edit Plan BOQ Item Commercial Terms Modal (Task 3) */}
      {isEditBoqItemModalOpen && selectedBoqItemToEdit && (
        <EditPlanBoqItemModal
          isOpen={isEditBoqItemModalOpen}
          onClose={() => {
            setIsEditBoqItemModalOpen(false);
            setSelectedBoqItemToEdit(null);
          }}
          onSuccess={async () => {
            await loadPlan();
            onPlanUpdated?.();
            showToast?.({ message: 'Plan commercial terms and rate history updated.', type: 'success' });
          }}
          planId={plan.id}
          planNumber={plan.planNumber}
          boqItem={selectedBoqItemToEdit}
          activeCurrency={activeCurrency}
        />
      )}

      {/* Item Rate History Modal (Task 3) */}
      {isItemHistoryModalOpen && historyTargetRevenueItem && (
        <RevenueItemRateHistoryModal
          isOpen={isItemHistoryModalOpen}
          onClose={() => {
            setIsItemHistoryModalOpen(false);
            setHistoryTargetRevenueItem(null);
          }}
          revenueItem={historyTargetRevenueItem}
          activeCurrency={activeCurrency}
        />
      )}

      {/* Project Commercial History Modal (Task 3) */}
      {isProjectCommercialHistoryModalOpen && (
        <ProjectCommercialHistoryModal
          isOpen={isProjectCommercialHistoryModalOpen}
          onClose={() => setIsProjectCommercialHistoryModalOpen(false)}
          projectId={plan.projectId}
          projectCode={plan.projectCode}
          projectName={plan.projectName}
          activeCurrency={activeCurrency}
        />
      )}

      {/* Sourced Procurement Price History & Quotation Modal (TASK 5) */}
      {isProcurementQuotesModalOpen && (
        <ProcurementPriceHistoryModal
          isOpen={isProcurementQuotesModalOpen}
          onClose={() => setIsProcurementQuotesModalOpen(false)}
          initialProjectId={plan.projectId}
          planNumber={plan.planNumber}
          suppliers={suppliers}
          materials={materials}
          outsourcedServices={outsourcedServices}
          subcontractors={subcontractors}
          onSelectPriceForPlan={handleApplyPriceSnapshotToPlan}
          showToast={showToast}
        />
      )}

      {/* Plan Barcode Scanner & Rapid Item Selection Modal (TASK 7) */}
      {isBarcodeScannerModalOpen && (
        <PlanBarcodeScannerModal
          isOpen={isBarcodeScannerModalOpen}
          onClose={() => setIsBarcodeScannerModalOpen(false)}
          planId={plan.id}
          planNumber={plan.planNumber}
          projectId={plan.projectId}
          activeCurrency={activeCurrency}
          existingBoqItems={plan.boqItems || []}
          onItemAddedToPlan={async () => {
            await loadPlan();
            onPlanUpdated?.();
          }}
          showToast={showToast}
        />
      )}

      {/* Apply Tariff To Plan Modal (TASK 9) */}
      {isApplyTariffModalOpen && (
        <ApplyTariffToPlanModal
          isOpen={isApplyTariffModalOpen}
          onClose={() => setIsApplyTariffModalOpen(false)}
          planId={plan.id}
          projectId={plan.projectId}
          planName={plan.name}
          projectCurrency={activeCurrency}
          tariffs={availableTariffs}
          onSuccess={async () => {
            setIsApplyTariffModalOpen(false);
            const refreshed = await api.getPlanTariffs(plan.id);
            setPlanTariffs(refreshed || []);
            onPlanUpdated?.();
            showToast?.({ message: 'Applied tariff schedule to plan successfully.', type: 'success' });
          }}
          showToast={(msg) => showToast?.(msg)}
        />
      )}

      {/* Add / Edit Plan Resource Modal */}
      <AddPlanResourceModal
        isOpen={isAddResourceModalOpen}
        onClose={() => {
          setIsAddResourceModalOpen(false);
          setEditingPlanResource(null);
        }}
        onSave={handleSavePlanResource}
        initialData={editingPlanResource}
        enterpriseResources={enterpriseResources}
        currency={activeCurrency}
      />
    </div>
  );
};
