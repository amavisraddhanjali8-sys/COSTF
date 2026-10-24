import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Edit,
  Trash2,
  DollarSign,
  History,
  Check,
  AlertTriangle,
  Sliders,
  TrendingDown,
  TrendingUp,
  Layers,
  Calculator,
  Calendar,
  User,
  Tag,
  Building2,
  Sparkles,
  Info,
  Save,
  RotateCw,
  Cpu,
  Users,
  Zap,
  Wrench,
  HardHat,
  Box,
  CheckCircle2,
  Scale
} from 'lucide-react';
import { EnterpriseResource, ResourcePriceRange, Supplier } from '../../types';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/currency';
import { calcPctChange, round2, round4 } from '../../utils/decimalMath';

interface ResourcePriceRangesAndChangesModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: EnterpriseResource | null;
  suppliers?: Supplier[];
  onResourceUpdated: (updated: EnterpriseResource) => void;
  showToast: (msg: string) => void;
  initialTab?: 'ranges' | 'changes' | 'details';
}

export const ResourcePriceRangesAndChangesModal: React.FC<ResourcePriceRangesAndChangesModalProps> = ({
  isOpen,
  onClose,
  resource,
  suppliers = [],
  onResourceUpdated,
  showToast,
  initialTab = 'ranges'
}) => {
  const [activeTab, setActiveTab] = useState<'ranges' | 'changes' | 'details'>(initialTab);

  // Price Ranges State
  const [ranges, setRanges] = useState<ResourcePriceRange[]>([]);
  const [isSavingRanges, setIsSavingRanges] = useState(false);
  const [editingRangeIndex, setEditingRangeIndex] = useState<number | null>(null);
  const [simQty, setSimQty] = useState<number>(10);

  // Price Changes & History State
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isCommittingChange, setIsCommittingChange] = useState(false);
  const [newRateInput, setNewRateInput] = useState<number>(0);
  const [changeDate, setChangeDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [changeReason, setChangeReason] = useState<string>('Market rate adjustment');
  const [changeAuthor, setChangeAuthor] = useState<string>('Resource Manager');

  // Editing existing history record
  const [editingHistoryItem, setEditingHistoryItem] = useState<any | null>(null);
  const [editHistoryReason, setEditHistoryReason] = useState<string>('');
  const [editHistoryDate, setEditHistoryDate] = useState<string>('');
  const [editHistoryPrice, setEditHistoryPrice] = useState<number>(0);
  const [isUpdatingHistory, setIsUpdatingHistory] = useState(false);

  // Resource Details Form State
  const [detailName, setDetailName] = useState('');
  const [detailCategory, setDetailCategory] = useState('');
  const [detailSubCategory, setDetailSubCategory] = useState('');
  const [detailUnit, setDetailUnit] = useState('hr');
  const [detailBaseRate, setDetailBaseRate] = useState<number>(0);
  const [detailOperationalCharge, setDetailOperationalCharge] = useState<number>(0);
  const [detailChargeType, setDetailChargeType] = useState('hourly');
  const [detailSupplierName, setDetailSupplierName] = useState('');
  const [detailCompetitorCompany, setDetailCompetitorCompany] = useState('');
  const [detailCompetitorRate, setDetailCompetitorRate] = useState<number>(0);
  const [detailBenchmarkRate, setDetailBenchmarkRate] = useState<number>(0);
  const [detailStatus, setDetailStatus] = useState<'Available' | 'Allocated' | 'Under Maintenance' | 'In Use' | 'Reserved'>('Available');
  const [detailSkillOrSla, setDetailSkillOrSla] = useState('');
  const [detailNotes, setDetailNotes] = useState('');
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  // Load resource details and price history when modal opens
  useEffect(() => {
    if (!isOpen || !resource) return;

    setActiveTab(initialTab);

    // Initial Details
    setDetailName(resource.name || '');
    setDetailCategory(resource.category || 'General');
    setDetailSubCategory(resource.subCategory || '');
    setDetailUnit(resource.unit || 'hr');
    setDetailBaseRate(Number(resource.baseRate) || 0);
    setDetailOperationalCharge(Number(resource.operationalCharge) || 0);
    setDetailChargeType(resource.chargeType || 'hourly');
    setDetailSupplierName(resource.supplierName || '');
    setDetailCompetitorCompany(resource.competitorCompany || '');
    setDetailCompetitorRate(Number(resource.competitorRate) || 0);
    setDetailBenchmarkRate(Number(resource.industryBenchmarkRate) || 0);
    setDetailStatus((resource.status as any) || 'Available');
    setDetailSkillOrSla(resource.skillOrSla || '');
    setDetailNotes(resource.notes || '');

    // Initial Rates for committing change
    setNewRateInput(Number(resource.baseRate) || 0);
    setChangeDate(new Date().toISOString().slice(0, 10));
    setChangeReason('Market rate adjustment');
    setChangeAuthor('Resource Manager');

    // Load price ranges from resource or fallback to defaults
    if (resource.priceRanges && resource.priceRanges.length > 0) {
      setRanges(resource.priceRanges);
    } else {
      const base = Number(resource.baseRate) || 1000;
      setRanges([
        {
          id: 'tier-1',
          label: 'Tier 1: Standard Base (1–10 units)',
          minQty: 1,
          maxQty: 10,
          unitRate: base,
          discountPct: 0,
          notes: 'Standard spot rate'
        },
        {
          id: 'tier-2',
          label: 'Tier 2: Medium Project (11–50 units)',
          minQty: 11,
          maxQty: 50,
          unitRate: round2(base * 0.95),
          discountPct: 5.0,
          notes: '5% volume commitment discount'
        },
        {
          id: 'tier-3',
          label: 'Tier 3: Long-term Allocation (51–150 units)',
          minQty: 51,
          maxQty: 150,
          unitRate: round2(base * 0.90),
          discountPct: 10.0,
          notes: '10% extended phase discount'
        },
        {
          id: 'tier-4',
          label: 'Tier 4: Enterprise Bulk (151+ units)',
          minQty: 151,
          maxQty: undefined,
          unitRate: round2(base * 0.85),
          discountPct: 15.0,
          notes: '15% master agreement framework'
        }
      ]);
    }

    // Fetch Price History
    loadPriceHistory(resource.id);
  }, [isOpen, resource, initialTab]);

  const loadPriceHistory = async (resourceId: string) => {
    setIsLoadingHistory(true);
    try {
      const data = await api.getResourcePriceHistory(resourceId);
      setHistory(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.warn('Could not load resource price history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Rate Simulator calculations (Hook must be declared before any conditional return)
  const activeSimTier = useMemo(() => {
    if (!ranges || ranges.length === 0) return null;
    return (
      ranges.find((t) => {
        const min = t.minQty;
        const max = t.maxQty !== undefined ? t.maxQty : Infinity;
        return simQty >= min && simQty <= max;
      }) || ranges[ranges.length - 1]
    );
  }, [ranges, simQty]);

  if (!isOpen || !resource) return null;

  const currentRate = Number(resource.baseRate) || 0;
  const currCurrency = resource.currency || 'LKR';

  const simEffectiveRate = activeSimTier ? activeSimTier.unitRate : currentRate;
  const simTotalDirect = simQty * simEffectiveRate;
  const simTotalBase = simQty * currentRate;
  const simSavings = simTotalBase - simTotalDirect;

  // Add new range tier
  const handleAddRangeTier = () => {
    const lastTier = ranges[ranges.length - 1];
    const nextMin = lastTier && lastTier.maxQty ? lastTier.maxQty + 1 : 100;
    const nextRate = lastTier ? round2(lastTier.unitRate * 0.95) : round2(currentRate * 0.9);
    const newTier: ResourcePriceRange = {
      id: `tier-${Date.now()}`,
      label: `Tier ${ranges.length + 1}: Volume Range (${nextMin}+ ${resource.unit})`,
      minQty: nextMin,
      maxQty: undefined,
      unitRate: nextRate,
      discountPct: round2(((currentRate - nextRate) / (currentRate || 1)) * 100),
      notes: 'Custom negotiated tier'
    };
    setRanges([...ranges, newTier]);
  };

  // Update existing range tier
  const handleUpdateRangeTier = (index: number, field: keyof ResourcePriceRange, value: any) => {
    const updated = [...ranges];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-recalculate discount % if unitRate changed
    if (field === 'unitRate' && currentRate > 0) {
      const rateNum = Number(value) || 0;
      updated[index].discountPct = round2(((currentRate - rateNum) / currentRate) * 100);
    }
    setRanges(updated);
  };

  // Remove range tier
  const handleDeleteRangeTier = (index: number) => {
    if (ranges.length <= 1) {
      showToast('At least one price range tier is required');
      return;
    }
    setRanges(ranges.filter((_, idx) => idx !== index));
  };

  // Save Price Ranges to PostgreSQL
  const handleSavePriceRanges = async () => {
    setIsSavingRanges(true);
    try {
      const updated = await api.updateResource(resource.id, {
        priceRanges: ranges,
        specifications: {
          ...(resource.specifications || {}),
          priceRanges: ranges
        }
      });
      showToast(`Price ranges for "${resource.name}" saved to PostgreSQL.`);
      onResourceUpdated(updated);
      setEditingRangeIndex(null);
    } catch (err: any) {
      console.error('Failed to save price ranges:', err);
      showToast(err?.message || 'Failed to save price ranges');
    } finally {
      setIsSavingRanges(false);
    }
  };

  // Reset to auto-calculated standard tiers
  const handleAutoGenerateTiers = () => {
    const base = currentRate || 1000;
    setRanges([
      {
        id: `tier-auto-1`,
        label: 'Tier 1: Standard Base (1–10)',
        minQty: 1,
        maxQty: 10,
        unitRate: base,
        discountPct: 0,
        notes: 'Standard spot rate'
      },
      {
        id: `tier-auto-2`,
        label: 'Tier 2: Medium Project (11–50)',
        minQty: 11,
        maxQty: 50,
        unitRate: round2(base * 0.95),
        discountPct: 5.0,
        notes: '5% volume commitment discount'
      },
      {
        id: `tier-auto-3`,
        label: 'Tier 3: Long-term Allocation (51–150)',
        minQty: 51,
        maxQty: 150,
        unitRate: round2(base * 0.90),
        discountPct: 10.0,
        notes: '10% extended phase discount'
      },
      {
        id: `tier-auto-4`,
        label: 'Tier 4: Enterprise Bulk (151+)',
        minQty: 151,
        maxQty: undefined,
        unitRate: round2(base * 0.85),
        discountPct: 15.0,
        notes: '15% master agreement framework'
      }
    ]);
    showToast('Generated 4 standard benchmark volume tiers. Click "Save Ranges" to commit.');
  };

  // Commit New Price Change
  const handleCommitPriceChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newRateInput <= 0) {
      showToast('Please enter a valid positive rate');
      return;
    }

    setIsCommittingChange(true);
    try {
      const updated = await api.commitResourcePrice(resource.id, {
        newRate: newRateInput,
        effectiveDate: changeDate,
        reason: changeReason.trim() || 'Rate change revision recorded via FXTT table',
        updatedBy: changeAuthor.trim() || 'Resource Manager',
        currency: currCurrency
      });

      showToast(`Rate revised to ${formatCurrency(newRateInput, currCurrency)} for "${resource.name}".`);
      onResourceUpdated(updated);
      await loadPriceHistory(resource.id);
    } catch (err: any) {
      console.error('Failed to commit price change:', err);
      showToast(err?.message || 'Failed to commit price change');
    } finally {
      setIsCommittingChange(false);
    }
  };

  // Save Edited History Item
  const handleSaveEditedHistory = async () => {
    if (!editingHistoryItem) return;
    setIsUpdatingHistory(true);
    try {
      await api.updatePriceHistoryRecord(editingHistoryItem.id, {
        newPrice: editHistoryPrice,
        reason: editHistoryReason,
        effectiveDate: editHistoryDate,
        updatedBy: changeAuthor || 'Resource Manager'
      });
      showToast('Price change history audit record updated.');
      setEditingHistoryItem(null);
      await loadPriceHistory(resource.id);
    } catch (err: any) {
      console.error('Failed to update history record:', err);
      showToast(err?.message || 'Failed to update record');
    } finally {
      setIsUpdatingHistory(false);
    }
  };

  // Delete History Record
  const handleDeleteHistoryRecord = async (historyId: string) => {
    try {
      await api.deletePriceHistoryRecord(historyId);
      showToast('Price history record deleted.');
      setHistory((prev) => prev.filter((h) => h.id !== historyId));
    } catch (err: any) {
      console.error('Failed to delete history record:', err);
      showToast(err?.message || 'Failed to delete record');
    }
  };

  // Save Resource Master Details
  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDetails(true);
    try {
      const updated = await api.updateResource(resource.id, {
        name: detailName,
        category: detailCategory,
        subCategory: detailSubCategory,
        unit: detailUnit,
        baseRate: detailBaseRate,
        operationalCharge: detailOperationalCharge,
        chargeType: detailChargeType,
        supplierName: detailSupplierName,
        competitorCompany: detailCompetitorCompany,
        competitorRate: detailCompetitorRate,
        industryBenchmarkRate: detailBenchmarkRate,
        status: detailStatus,
        skillOrSla: detailSkillOrSla,
        notes: detailNotes
      });
      showToast(`Resource "${detailName}" updated in PostgreSQL.`);
      onResourceUpdated(updated);
    } catch (err: any) {
      console.error('Failed to update resource details:', err);
      showToast(err?.message || 'Failed to update resource');
    } finally {
      setIsSavingDetails(false);
    }
  };

  const getTypeIcon = (t: string) => {
    switch (t) {
      case 'machinery': return <Cpu className="w-5 h-5 text-indigo-500" />;
      case 'labour': return <Users className="w-5 h-5 text-blue-500" />;
      case 'equipment': return <Zap className="w-5 h-5 text-amber-500" />;
      case 'tool': return <Wrench className="w-5 h-5 text-emerald-500" />;
      case 'subcontractor': return <HardHat className="w-5 h-5 text-purple-500" />;
      default: return <Box className="w-5 h-5 text-slate-500" />;
    }
  };

  const deltaBenchmark = resource.competitorRate ? Number(resource.baseRate) - Number(resource.competitorRate) : 0;
  const spreadPct = resource.competitorRate && Number(resource.competitorRate) > 0
    ? round2((deltaBenchmark / Number(resource.competitorRate)) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl overflow-hidden my-4 flex flex-col max-h-[92vh]">
        
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/50">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800">
              {getTypeIcon(resource.type)}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {resource.code}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  {resource.category} {resource.subCategory ? `• ${resource.subCategory}` : ''}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                  resource.status === 'Available'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                }`}>
                  {resource.status || 'Available'}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {resource.name}
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-4 sm:px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('ranges')}
            className={`flex items-center space-x-2 py-3 px-3.5 border-b-2 font-bold cursor-pointer transition-all ${
              activeTab === 'ranges'
                ? 'border-[#0078d4] text-[#0078d4]'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Price Ranges & Tiers ({ranges.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('changes')}
            className={`flex items-center space-x-2 py-3 px-3.5 border-b-2 font-bold cursor-pointer transition-all ${
              activeTab === 'changes'
                ? 'border-[#0078d4] text-[#0078d4]'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Price Changes & Audit Log ({history.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`flex items-center space-x-2 py-3 px-3.5 border-b-2 font-bold cursor-pointer transition-all ${
              activeTab === 'details'
                ? 'border-[#0078d4] text-[#0078d4]'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Edit className="w-4 h-4" />
            <span>Resource Master Data</span>
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          
          {/* ================================================================ */}
          {/* TAB 1: PRICE RANGES & VOLUME TIERS (EDITABLE)                    */}
          {/* ================================================================ */}
          {activeTab === 'ranges' && (
            <div className="space-y-5">
              
              {/* Metric Highlights Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Current Base Rate</span>
                  <div className="text-sm sm:text-base font-mono font-bold text-[#0078d4] dark:text-blue-400 mt-1">
                    {formatCurrency(currentRate, currCurrency)}
                    <span className="text-xs font-normal text-slate-500 ml-1">/ {resource.unit}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Operational Charge</span>
                  <div className="text-sm sm:text-base font-mono font-bold text-slate-800 dark:text-slate-200 mt-1">
                    {formatCurrency(Number(resource.operationalCharge) || 0, currCurrency)}
                    <span className="text-xs font-normal text-slate-500 ml-1">/ {resource.chargeType || 'hr'}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Market Benchmark</span>
                  <div className="text-sm sm:text-base font-mono font-bold text-slate-700 dark:text-slate-300 mt-1">
                    {formatCurrency(Number(resource.competitorRate || resource.industryBenchmarkRate) || currentRate * 1.08, currCurrency)}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Effective Tiers</span>
                  <div className="text-sm sm:text-base font-mono font-bold text-emerald-600 mt-1">
                    {ranges.length} Ranges Configured
                  </div>
                </div>
              </div>

              {/* Price Ranges Table & Toolbar */}
              <div className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
                <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2 bg-slate-50/50 dark:bg-slate-900/40">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-xs flex items-center space-x-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#0078d4]" />
                      <span>Volume & Duration Price Range Brackets</span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      (Editable tiers stored in PostgreSQL)
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleAutoGenerateTiers}
                      className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center space-x-1 cursor-pointer"
                      title="Generate 4 standard benchmark tiers"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>Auto Presets</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAddRangeTier}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 flex items-center space-x-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#0078d4]" />
                      <span>+ Add Tier</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSavePriceRanges}
                      disabled={isSavingRanges}
                      className="px-3 py-1 text-xs font-bold rounded-lg bg-[#0078d4] hover:bg-[#006cbd] text-white flex items-center space-x-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSavingRanges ? 'Saving...' : 'Save Price Ranges'}</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800 text-[11px]">
                      <tr>
                        <th className="px-3.5 py-2">Tier Bracket</th>
                        <th className="px-3 py-2">Min Qty</th>
                        <th className="px-3 py-2">Max Qty</th>
                        <th className="px-3 py-2 text-right">Unit Rate ({currCurrency})</th>
                        <th className="px-3 py-2 text-right">Discount %</th>
                        <th className="px-3.5 py-2">Description / Shift SLA</th>
                        <th className="px-3 py-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-normal">
                      {ranges.map((tier, idx) => (
                        <tr key={tier.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          {/* Label */}
                          <td className="px-3.5 py-2 font-medium">
                            <input
                              type="text"
                              value={tier.label || ''}
                              onChange={(e) => handleUpdateRangeTier(idx, 'label', e.target.value)}
                              placeholder={`Tier ${idx + 1}`}
                              className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#0078d4] focus:outline-none text-slate-900 dark:text-slate-100 text-xs py-0.5"
                            />
                          </td>

                          {/* Min Qty */}
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              value={tier.minQty}
                              onChange={(e) => handleUpdateRangeTier(idx, 'minQty', parseInt(e.target.value) || 0)}
                              className="w-16 font-mono text-xs px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                            />
                          </td>

                          {/* Max Qty */}
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              placeholder="∞"
                              value={tier.maxQty !== undefined ? tier.maxQty : ''}
                              onChange={(e) => handleUpdateRangeTier(idx, 'maxQty', e.target.value === '' ? undefined : parseInt(e.target.value) || 0)}
                              className="w-16 font-mono text-xs px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                            />
                          </td>

                          {/* Unit Rate */}
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              step="any"
                              value={tier.unitRate}
                              onChange={(e) => handleUpdateRangeTier(idx, 'unitRate', parseFloat(e.target.value) || 0)}
                              className="w-24 font-mono font-bold text-xs px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-right text-[#0078d4]"
                            />
                          </td>

                          {/* Discount % */}
                          <td className="px-3 py-2 text-right">
                            <span className={`font-mono font-semibold ${tier.discountPct && tier.discountPct > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {tier.discountPct !== undefined ? `${tier.discountPct}%` : '0%'}
                            </span>
                          </td>

                          {/* Notes */}
                          <td className="px-3.5 py-2">
                            <input
                              type="text"
                              value={tier.notes || ''}
                              onChange={(e) => handleUpdateRangeTier(idx, 'notes', e.target.value)}
                              placeholder="Notes / SLA condition"
                              className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#0078d4] focus:outline-none text-slate-600 dark:text-slate-400 text-xs py-0.5"
                            />
                          </td>

                          {/* Delete */}
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteRangeTier(idx)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
                              title="Delete Tier"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Interactive Rate Simulator Card */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-slate-900/60 dark:to-slate-900/90 border border-blue-200/70 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Calculator className="w-4 h-4 text-[#0078d4]" />
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                      Live Usage & Range Simulator
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
                    Active Tier: <span className="font-bold text-[#0078d4]">{activeSimTier?.label || 'Base'}</span>
                  </span>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Project Allocation Volume ({resource.unit})
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="300"
                      value={simQty}
                      onChange={(e) => setSimQty(parseInt(e.target.value) || 1)}
                      className="w-full accent-[#0078d4] cursor-pointer"
                    />
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      min="1"
                      value={simQty}
                      onChange={(e) => setSimQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full font-mono font-bold text-sm text-center px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-xs">
                  <div className="p-2 rounded-lg bg-white/70 dark:bg-slate-800/60">
                    <span className="text-[10px] text-slate-500">Effective Unit Rate:</span>
                    <div className="font-mono font-bold text-[#0078d4] text-sm">
                      {formatCurrency(simEffectiveRate, currCurrency)} / {resource.unit}
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-white/70 dark:bg-slate-800/60">
                    <span className="text-[10px] text-slate-500">Total Direct Estimate ({simQty} {resource.unit}):</span>
                    <div className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {formatCurrency(simTotalDirect, currCurrency)}
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-white/70 dark:bg-slate-800/60">
                    <span className="text-[10px] text-slate-500">Volume Cost Savings:</span>
                    <div className={`font-mono font-bold text-sm ${simSavings > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {simSavings > 0 ? `+${formatCurrency(simSavings, currCurrency)}` : 'Standard Rate'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 2: PRICE CHANGES & AUDIT LOG (EDITABLE)                      */}
          {/* ================================================================ */}
          {activeTab === 'changes' && (
            <div className="space-y-5">
              
              {/* Commit New Price Revision Card */}
              <form onSubmit={handleCommitPriceChange} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                      Commit New Rate Revision
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Audited into PostgreSQL price history ledger
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      New Base Rate ({currCurrency}) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      value={newRateInput}
                      onChange={(e) => setNewRateInput(parseFloat(e.target.value) || 0)}
                      className="w-full font-mono font-bold text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Effective Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={changeDate}
                      onChange={(e) => setChangeDate(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Audit Reason & Justification *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Fuel escalation, Annual wage review, Supplier adjustment"
                      value={changeReason}
                      onChange={(e) => setChangeReason(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Quick Chips for reason */}
                <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                  <div className="flex flex-wrap gap-1">
                    {['Annual indexation', 'Fuel escalation', 'Supplier renegotiation', 'Quarterly review', 'Market correction'].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setChangeReason(chip)}
                        className="px-2 py-0.5 text-[10px] rounded bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 cursor-pointer"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={isCommittingChange}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center space-x-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isCommittingChange ? 'Committing...' : 'Commit Revision'}</span>
                  </button>
                </div>
              </form>

              {/* Inline Edit Historical Item Form */}
              {editingHistoryItem && (
                <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-900 dark:text-amber-200 text-xs flex items-center space-x-1">
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit Historical Record #{editingHistoryItem.id.slice(-6)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingHistoryItem(null)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500">Rate ({currCurrency})</label>
                      <input
                        type="number"
                        step="any"
                        value={editHistoryPrice}
                        onChange={(e) => setEditHistoryPrice(parseFloat(e.target.value) || 0)}
                        className="w-full text-xs font-mono font-bold px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500">Date</label>
                      <input
                        type="date"
                        value={editHistoryDate}
                        onChange={(e) => setEditHistoryDate(e.target.value)}
                        className="w-full text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500">Reason</label>
                      <input
                        type="text"
                        value={editHistoryReason}
                        onChange={(e) => setEditHistoryReason(e.target.value)}
                        className="w-full text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingHistoryItem(null)}
                      className="px-2.5 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingHistory}
                      onClick={handleSaveEditedHistory}
                      className="px-3 py-1 text-xs font-bold rounded bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                    >
                      {isUpdatingHistory ? 'Updating...' : 'Save Change'}
                    </button>
                  </div>
                </div>
              )}

              {/* Historical Changes Audit Table */}
              <div className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
                <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-xs flex items-center space-x-1.5">
                    <History className="w-3.5 h-3.5 text-purple-600" />
                    <span>Price Change History Audit Log</span>
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {history.length} records found
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800 text-[11px]">
                      <tr>
                        <th className="px-3.5 py-2">Effective Date</th>
                        <th className="px-3 py-2 text-right">Previous Rate</th>
                        <th className="px-3 py-2 text-right">New Rate</th>
                        <th className="px-3 py-2 text-center">Change %</th>
                        <th className="px-3.5 py-2">Reason</th>
                        <th className="px-3 py-2">Author</th>
                        <th className="px-3 py-2 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-normal">
                      {history.map((record) => {
                        const isUp = Number(record.changePct || 0) >= 0;
                        return (
                          <tr key={record.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                            <td className="px-3.5 py-2 font-mono text-slate-700 dark:text-slate-300">
                              {record.effectiveDate || 'Initial Setup'}
                            </td>
                            <td className="px-3 py-2 font-mono text-right text-slate-500">
                              {formatCurrency(record.previousPrice, currCurrency)}
                            </td>
                            <td className="px-3 py-2 font-mono font-bold text-right text-slate-900 dark:text-slate-100">
                              {formatCurrency(record.newPrice, currCurrency)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                isUp
                                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              }`}>
                                {isUp ? `+${record.changePct}%` : `${record.changePct}%`}
                              </span>
                            </td>
                            <td className="px-3.5 py-2 text-slate-600 dark:text-slate-400">
                              {record.reason || 'Annual rate revision'}
                            </td>
                            <td className="px-3 py-2 text-slate-500 text-[11px]">
                              {record.updatedBy || 'Resource Manager'}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <div className="flex items-center justify-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingHistoryItem(record);
                                    setEditHistoryPrice(Number(record.newPrice) || 0);
                                    setEditHistoryDate(record.effectiveDate || '');
                                    setEditHistoryReason(record.reason || '');
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-[#0078d4] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                  title="Edit Historical Record"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteHistoryRecord(record.id)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                  title="Delete Record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {history.length === 0 && !isLoadingHistory && (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-400">
                            No price change revisions recorded yet. Commit your first revision above.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 3: RESOURCE MASTER DATA (EDITABLE)                           */}
          {/* ================================================================ */}
          {activeTab === 'details' && (
            <form onSubmit={handleSaveDetails} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Resource Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={detailName}
                    onChange={(e) => setDetailName(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Status
                  </label>
                  <select
                    value={detailStatus}
                    onChange={(e) => setDetailStatus(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    <option value="Available">Available</option>
                    <option value="Allocated">Allocated</option>
                    <option value="In Use">In Use</option>
                    <option value="Under Maintenance">Under Maintenance</option>
                    <option value="Reserved">Reserved</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Category *
                  </label>
                  <input
                    type="text"
                    required
                    value={detailCategory}
                    onChange={(e) => setDetailCategory(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Sub-Category
                  </label>
                  <input
                    type="text"
                    value={detailSubCategory}
                    onChange={(e) => setDetailSubCategory(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Unit *
                  </label>
                  <input
                    type="text"
                    required
                    value={detailUnit}
                    onChange={(e) => setDetailUnit(e.target.value)}
                    placeholder="hr, day, shift, sqft, unit"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Base Rate ({currCurrency}) *
                  </label>
                  <input
                    type="number"
                    required
                    step="any"
                    value={detailBaseRate}
                    onChange={(e) => setDetailBaseRate(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs font-mono font-bold px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-[#0078d4]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Operational Charge ({currCurrency})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={detailOperationalCharge}
                    onChange={(e) => setDetailOperationalCharge(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Charge Basis
                  </label>
                  <select
                    value={detailChargeType}
                    onChange={(e) => setDetailChargeType(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    <option value="hourly">Hourly Rate</option>
                    <option value="daily">Daily Flat</option>
                    <option value="shift">Shift Rate</option>
                    <option value="unit">Per Unit</option>
                    <option value="lump_sum">Lump Sum</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Supplier / Vendor
                  </label>
                  <input
                    type="text"
                    value={detailSupplierName}
                    onChange={(e) => setDetailSupplierName(e.target.value)}
                    placeholder="Supplier or Direct Fleet"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Competitor / Rival
                  </label>
                  <input
                    type="text"
                    value={detailCompetitorCompany}
                    onChange={(e) => setDetailCompetitorCompany(e.target.value)}
                    placeholder="Competitor benchmark company"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Market Benchmark Rate ({currCurrency})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={detailBenchmarkRate}
                    onChange={(e) => setDetailBenchmarkRate(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Skills, Certifications & SLA
                </label>
                <input
                  type="text"
                  value={detailSkillOrSla}
                  onChange={(e) => setDetailSkillOrSla(e.target.value)}
                  placeholder="e.g. ISO 9001, ASME Certified, Operator Level 4"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Notes & Terms
                </label>
                <textarea
                  rows={2}
                  value={detailNotes}
                  onChange={(e) => setDetailNotes(e.target.value)}
                  placeholder="Additional contractual notes..."
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  disabled={isSavingDetails}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-[#0078d4] hover:bg-[#006cbd] text-white flex items-center space-x-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingDetails ? 'Saving Changes...' : 'Save Resource Details'}</span>
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/50">
          <div className="flex items-center space-x-2 text-[11px] text-slate-500">
            <span>Resource ID: <span className="font-mono">{resource.id}</span></span>
            <span>•</span>
            <span>Currency: <span className="font-bold">{currCurrency}</span></span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
