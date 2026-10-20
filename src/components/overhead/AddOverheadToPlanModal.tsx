import React, { useState, useEffect } from 'react';
import { X, Plus, Layers, DollarSign, AlertCircle, Info, Calculator } from 'lucide-react';
import { OverheadItem, PlanOverheadAllocation } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, getStoredCurrency } from '../../utils/currency';

interface AddOverheadToPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  planNumber?: string;
  planName?: string;
  planFinancials: {
    plannedRevenue: number;
    directCost: number;
    materialCost: number;
    subcontractorCost: number;
    outsourcedCost: number;
    resourceCost: number;
  };
  existingAllocatedItemIds?: string[];
  onAllocationAdded: () => void;
  showToast?: (msg: string | { message: string; type?: string }) => void;
}

export const AddOverheadToPlanModal: React.FC<AddOverheadToPlanModalProps> = ({
  isOpen,
  onClose,
  planId,
  planNumber,
  planName,
  planFinancials,
  existingAllocatedItemIds = [],
  onAllocationAdded,
  showToast
}) => {
  const [overheadItems, setOverheadItems] = useState<OverheadItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [allocationMethod, setAllocationMethod] = useState<'fixed_amount' | 'percentage_of_direct' | 'unit_rate'>('fixed_amount');
  const [allocationBase, setAllocationBase] = useState('total_direct_cost');
  const [rate, setRate] = useState<number | ''>(0);
  const [unitQuantity, setUnitQuantity] = useState<number | ''>(1);
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<'select_existing' | 'create_new'>('select_existing');
  const [newItemCode, setNewItemCode] = useState(() => `OVH-${Math.floor(1000 + Math.random() * 9000)}`);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Facilities & Site Operations');
  const [newItemCostType, setNewItemCostType] = useState<'Fixed' | 'Variable' | 'Semi-Variable'>('Fixed');
  const [newItemUnitType, setNewItemUnitType] = useState('monthly');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCurrency = getStoredCurrency();

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    const loadItems = async () => {
      setLoading(true);
      try {
        const res = await api.getOverheadItems({ limit: 100 });
        if (mounted) {
          const available = (res.data || []).filter((i) => !existingAllocatedItemIds.includes(i.id));
          setOverheadItems(available);
          if (available.length > 0 && !selectedItemId) {
            applySelectedItem(available[0]);
          } else if (available.length === 0) {
            setMode('create_new');
          }
        }
      } catch (e: any) {
        console.error('Failed to load overhead items:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadItems();
    return () => {
      mounted = false;
    };
  }, [isOpen, existingAllocatedItemIds]);

  const applySelectedItem = (item: OverheadItem) => {
    setSelectedItemId(item.id);
    const method = item.defaultCalculationMethod === 'percentage_of_direct' ? 'percentage_of_direct' : item.defaultCalculationMethod === 'unit_rate' ? 'unit_rate' : 'fixed_amount';
    setAllocationMethod(method);
    setAllocationBase(item.defaultCostBase || 'total_direct_cost');
    setRate(item.defaultRate ?? 0);
    setUnitQuantity(1);
    setNotes(item.description || '');
  };

  if (!isOpen) return null;

  const rateNum = Number(rate) || 0;
  const qtyNum = Number(unitQuantity) || 1;

  // Compute calculated allocation amount
  let calculatedAmount = 0;
  if (allocationMethod === 'fixed_amount') {
    calculatedAmount = rateNum;
  } else if (allocationMethod === 'percentage_of_direct') {
    let base = planFinancials.directCost || 0;
    if (allocationBase === 'material_cost') base = planFinancials.materialCost;
    else if (allocationBase === 'labor_cost') base = planFinancials.subcontractorCost + planFinancials.resourceCost;
    calculatedAmount = (base * rateNum) / 100;
  } else if (allocationMethod === 'unit_rate') {
    calculatedAmount = rateNum * qtyNum;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let targetItemId = selectedItemId;

      if (mode === 'create_new') {
        if (!newItemName.trim()) {
          throw new Error('Please enter a name for the new overhead cost item.');
        }
        // Requirement 2: Creating a new cost item in the overhead portal database
        const createdItem = await api.createOverheadItem({
          code: newItemCode.trim(),
          name: newItemName.trim(),
          category: newItemCategory,
          costType: newItemCostType,
          defaultCalculationMethod: allocationMethod,
          defaultCostBase: allocationBase,
          defaultRate: rateNum,
          unitType: newItemUnitType,
          description: notes.trim() || `Overhead created via Project Plan ${planNumber || planName}`,
          status: 'Active'
        });
        targetItemId = createdItem.id;
        showToast?.({ message: `Created new overhead item "${createdItem.name}" in portal database.`, type: 'success' });
      }

      if (!targetItemId) {
        throw new Error('Please select or create an overhead item.');
      }

      await api.addPlanOverheadAllocation(planId, {
        overheadItemId: targetItemId,
        allocationMethod,
        allocationBase,
        allocationRate: rateNum,
        unitQuantity: qtyNum,
        notes: notes.trim()
      });

      onAllocationAdded();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to allocate overhead to plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-150">
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Add Overhead Cost to Plan</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Plan {planNumber || planName}
              </p>
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

        {/* Mode Selector Tabs */}
        <div className="px-4 pt-3 flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setMode('select_existing')}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              mode === 'select_existing'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Select Existing Item ({overheadItems.length})
          </button>
          <button
            type="button"
            onClick={() => setMode('create_new')}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              mode === 'create_new'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            + Create New Cost Item in Portal
          </button>
        </div>

        {error && (
          <div className="p-3 mx-4 mt-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {mode === 'create_new' ? (
            <div className="space-y-3 bg-amber-50/40 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200/60 dark:border-amber-800/40">
              <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                New Cost Item Definition (Saved in Overhead Portal)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Cost Item Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Site Quality & Safety Engineering"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Code
                  </label>
                  <input
                    type="text"
                    value={newItemCode}
                    onChange={(e) => setNewItemCode(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Overhead Category
                  </label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="Facilities & Site Operations">Facilities & Site Operations</option>
                    <option value="Engineering & Design Supervision">Engineering & Design Supervision</option>
                    <option value="Quality Assurance & ASME Compliance">Quality Assurance & ASME Compliance</option>
                    <option value="Logistics, Packaging & Freight">Logistics, Packaging & Freight</option>
                    <option value="Tooling, Calibrations & Machinery Depreciation">Tooling, Calibrations & Depreciation</option>
                    <option value="Corporate Governance & Administration">Corporate Governance & Administration</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Cost Type
                  </label>
                  <select
                    value={newItemCostType}
                    onChange={(e) => setNewItemCostType(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="Fixed">Fixed Cost</option>
                    <option value="Variable">Variable Cost</option>
                    <option value="Semi-Variable">Semi-Variable</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Select Overhead Catalogue Item <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={selectedItemId}
                onChange={(e) => {
                  const item = overheadItems.find((i) => i.id === e.target.value);
                  if (item) applySelectedItem(item);
                  else setSelectedItemId(e.target.value);
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
              >
                <option value="">-- Choose Catalogue Item --</option>
                {overheadItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    [{item.code}] {item.name} ({item.category}) - Def: {item.defaultRate} ({item.defaultCalculationMethod})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Allocation Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Calculation Method
              </label>
              <select
                value={allocationMethod}
                onChange={(e) => setAllocationMethod(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
              >
                <option value="fixed_amount">Fixed Amount</option>
                <option value="percentage_of_direct">Percentage of Direct Cost</option>
                <option value="unit_rate">Unit Rate (Qty × Rate)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {allocationMethod === 'percentage_of_direct' ? 'Rate (%)' : 'Rate / Amount'}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={rate}
                onChange={(e) => setRate(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {allocationMethod === 'unit_rate' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Unit Quantity
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={unitQuantity}
                onChange={(e) => setUnitQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>
          )}

          {/* Allocation Calculation Preview */}
          <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-amber-800 dark:text-amber-300 font-semibold uppercase">
                Allocated Overhead Impact
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                {allocationMethod === 'percentage_of_direct' ? `${rateNum}% of Direct Cost` : `${qtyNum} unit(s) @ ${rateNum}`}
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-extrabold font-mono text-amber-700 dark:text-amber-300">
                {formatCurrency(calculatedAmount, activeCurrency)}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Allocation Notes / Reason
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Standard site office allocation for duration of project"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
            />
          </div>
        </form>

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
            disabled={saving || (mode === 'select_existing' && !selectedItemId) || (mode === 'create_new' && !newItemName.trim())}
            className="px-5 py-2 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : mode === 'create_new' ? 'Create & Allocate Overhead' : 'Allocate to Plan'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
