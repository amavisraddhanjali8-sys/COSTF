import React, { useState, useEffect } from 'react';
import {
  X,
  Package,
  Wrench,
  DollarSign,
  Plus,
  Search,
  Check,
  AlertCircle,
  Info,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import { RevenueItem, Project, ProjectPlan } from '../../types';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/currency';

interface AddRevenueItemToPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  planId?: string;
  projectId?: string;
  plans?: ProjectPlan[];
  projects?: Project[];
  preselectedRevenueItem?: RevenueItem | null;
  activeCurrency: string;
}

export const AddRevenueItemToPlanModal: React.FC<AddRevenueItemToPlanModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  planId: initialPlanId,
  projectId: initialProjectId,
  plans = [],
  projects = [],
  preselectedRevenueItem,
  activeCurrency
}) => {
  const [revenueItems, setRevenueItems] = useState<RevenueItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedItem, setSelectedItem] = useState<RevenueItem | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'product' | 'service'>('ALL');

  // Plan and Project Selection
  const [targetPlanId, setTargetPlanId] = useState(initialPlanId || '');
  const [targetProjectId, setTargetProjectId] = useState(initialProjectId || '');

  // Plan-Specific Commercial Terms (Requirements 9, 10, 11)
  const [planDescription, setPlanDescription] = useState('');
  const [planUnit, setPlanUnit] = useState('unit');
  const [planQuantity, setPlanQuantity] = useState<number | ''>(1);
  const [planRate, setPlanRate] = useState<number | ''>(0);
  const [planDiscountPct, setPlanDiscountPct] = useState<number | ''>(0);
  const [planTaxTreatment, setPlanTaxTreatment] = useState('Standard (0%)');
  const [commercialContext, setCommercialContext] = useState('');
  const [changeReason, setChangeReason] = useState('Initial plan commercial term assignment');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialPlanId) setTargetPlanId(initialPlanId);
    if (initialProjectId) setTargetProjectId(initialProjectId);
  }, [initialPlanId, initialProjectId]);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const fetchCatalogue = async () => {
      setLoadingItems(true);
      try {
        const res = await api.getRevenueItemsList({ limit: 1000 });
        if (mounted) {
          setRevenueItems(res);
        }
      } catch (err) {
        console.error('Failed to load revenue catalogue:', err);
      } finally {
        if (mounted) setLoadingItems(false);
      }
    };

    fetchCatalogue();
    return () => {
      mounted = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (preselectedRevenueItem) {
      applySelectedItem(preselectedRevenueItem);
    }
  }, [preselectedRevenueItem]);

  const applySelectedItem = (item: RevenueItem) => {
    setSelectedItem(item);
    setPlanDescription(item.description || item.name);
    setPlanUnit(item.unit || 'unit');
    setPlanRate(item.defaultRate ?? 0);
    setPlanTaxTreatment(item.taxTreatment || 'Standard (0%)');
    setPlanDiscountPct(0);
    setPlanQuantity(1);
    setCommercialContext(`Commercial BOQ item ${item.code} allocated to plan`);
  };

  if (!isOpen) return null;

  const filteredItems = revenueItems.filter((i) => {
    if (typeFilter !== 'ALL' && i.type !== typeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        i.name.toLowerCase().includes(q) ||
        i.code.toLowerCase().includes(q) ||
        (i.barcode && i.barcode.toLowerCase().includes(q)) ||
        (i.category && i.category.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const qtyNum = Number(planQuantity) || 0;
  const rateNum = Number(planRate) || 0;
  const discNum = Number(planDiscountPct) || 0;
  const discountedRate = rateNum * (1 - discNum / 100);
  const calculatedLineRevenue = qtyNum * discountedRate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPlanId) {
      setError('Please select a target Project Plan.');
      return;
    }
    if (!selectedItem) {
      setError('Please select a Revenue Catalogue item.');
      return;
    }
    if (qtyNum <= 0) {
      setError('Quantity must be greater than 0.');
      return;
    }
    if (rateNum < 0) {
      setError('Selling rate cannot be negative.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        revenueItemId: selectedItem.id,
        itemCode: selectedItem.code,
        name: selectedItem.name,
        type: selectedItem.type,
        category: selectedItem.category,
        description: planDescription.trim(),
        unit: planUnit.trim(),
        quantity: qtyNum,
        rate: rateNum,
        sellingRate: rateNum,
        discountPct: discNum,
        taxTreatment: planTaxTreatment,
        taxRatePct: planTaxTreatment.includes('18%') ? 18 : planTaxTreatment.includes('15%') ? 15 : planTaxTreatment.includes('8%') ? 8 : 0,
        commercialContext: commercialContext.trim(),
        changeReason: changeReason.trim(),
        effectiveDate,
        idempotencyKey: `init-${targetPlanId}-${selectedItem.id}-${Date.now()}`
      };

      await api.addRevenueItemToPlan(targetPlanId, payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to add revenue item to plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-150">
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Add BOQ Item
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 mx-4 mt-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Target Plan Selector (if not fixed) */}
          {!initialPlanId && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Project Plan <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={targetPlanId}
                onChange={(e) => setTargetPlanId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-medium"
              >
                <option value="">-- Select Project Plan --</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.planNumber || 'PLAN'}] {p.name} ({p.projectName || p.projectId})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Catalogue Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                <span>1. Select Catalogue Product or Service</span>
                <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setTypeFilter('ALL')}
                  className={`px-2 py-0.5 text-[11px] rounded font-semibold transition-colors ${
                    typeFilter === 'ALL'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  All ({revenueItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('product')}
                  className={`px-2 py-0.5 text-[11px] rounded font-semibold transition-colors ${
                    typeFilter === 'product'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Products
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('service')}
                  className={`px-2 py-0.5 text-[11px] rounded font-semibold transition-colors ${
                    typeFilter === 'service'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Services
                </button>
              </div>
            </div>

            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search products or services by name, code, barcode, or category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900/50">
              {loadingItems ? (
                <div className="py-6 text-center text-xs text-slate-400">Loading revenue catalogue...</div>
              ) : filteredItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">No matching revenue items found.</div>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = selectedItem?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => applySelectedItem(item)}
                      className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-100 font-medium'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                            item.type === 'service'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          }`}
                        >
                          {item.type === 'service' ? <Wrench className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
                        </span>
                        <div className="truncate">
                          <div className="font-bold flex items-center space-x-1.5">
                            <span className="font-mono text-blue-600 dark:text-sky-400">{item.code}</span>
                            <span>•</span>
                            <span className="truncate">{item.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {item.category} {item.subCategory ? `• ${item.subCategory}` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 shrink-0">
                        <div className="text-right font-mono">
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {formatCurrency(item.defaultRate, item.currency || activeCurrency)}
                          </div>
                          <div className="text-[10px] text-slate-400 font-sans">per {item.unit}</div>
                        </div>

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Plan-Specific Commercial Terms (Requirements 9, 10, 11) */}
          {selectedItem && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <span>2. Configure Project-Specific Commercial Terms</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Default Global Rate: {formatCurrency(selectedItem.defaultRate, selectedItem.currency || activeCurrency)}
                </span>
              </div>

              {/* Notice confirming Requirement 10: Changing project-specific rate does NOT change global default rate */}
              <div className="p-2.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 text-[11px] flex items-start space-x-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-sky-600" />
                <span>
                  <strong>Strict Commercial Separation:</strong> Project-specific quantity, unit, and selling rate are stored in this plan's BOQ and will <strong>not</strong> alter the global catalogue default rate of {formatCurrency(selectedItem.defaultRate, selectedItem.currency || activeCurrency)}.
                </span>
              </div>

              {/* Quantity, Unit, Selling Rate, Discount */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Plan Quantity <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    required
                    value={planQuantity}
                    onChange={(e) => setPlanQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Plan Unit <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={planUnit}
                    onChange={(e) => setPlanUnit(e.target.value)}
                    placeholder="e.g. No., pcs, m2"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Selling Rate <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={planRate}
                    onChange={(e) => setPlanRate(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Discount %
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={planDiscountPct}
                    onChange={(e) => setPlanDiscountPct(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Plan Description & Scope */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Plan-Specific Description / Scope Specification
                </label>
                <textarea
                  rows={2}
                  value={planDescription}
                  onChange={(e) => setPlanDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Commercial Summary Preview */}
              <div className="p-3 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-emerald-800 dark:text-emerald-300 font-semibold uppercase">
                    Quoted Line Revenue
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                    {qtyNum} {planUnit} @ {formatCurrency(discountedRate, activeCurrency)} {discNum > 0 ? `(${discNum}% off)` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-base font-extrabold font-mono text-emerald-700 dark:text-emerald-300">
                    {formatCurrency(calculatedLineRevenue, activeCurrency)}
                  </span>
                </div>
              </div>

              {/* Audit / History metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Initial Commercial Context
                  </label>
                  <input
                    type="text"
                    value={commercialContext}
                    onChange={(e) => setCommercialContext(e.target.value)}
                    placeholder="e.g. Main entrance aluminium door quote"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Effective Date
                  </label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !selectedItem}
            className="px-5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{saving ? 'Adding to Plan...' : 'Add Item to Plan BOQ'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
