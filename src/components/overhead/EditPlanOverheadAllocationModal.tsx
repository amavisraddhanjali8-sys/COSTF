import React, { useState, useEffect } from 'react';
import { X, Save, Layers, DollarSign, AlertCircle } from 'lucide-react';
import { PlanOverheadAllocation } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, getStoredCurrency } from '../../utils/currency';

interface EditPlanOverheadAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  planNumber?: string;
  allocation: any;
  planFinancials: {
    plannedRevenue: number;
    directCost: number;
    materialCost: number;
    subcontractorCost: number;
    outsourcedCost: number;
    resourceCost: number;
  };
  onAllocationUpdated: () => void;
  showToast?: (msg: string | { message: string; type?: string }) => void;
}

export const EditPlanOverheadAllocationModal: React.FC<EditPlanOverheadAllocationModalProps> = ({
  isOpen,
  onClose,
  planId,
  planNumber,
  allocation,
  planFinancials,
  onAllocationUpdated,
  showToast
}) => {
  const [allocationMethod, setAllocationMethod] = useState<'fixed_amount' | 'percentage_of_direct' | 'unit_rate'>('fixed_amount');
  const [allocationBase, setAllocationBase] = useState('total_direct_cost');
  const [rate, setRate] = useState<number | ''>(0);
  const [unitQuantity, setUnitQuantity] = useState<number | ''>(1);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCurrency = getStoredCurrency();

  useEffect(() => {
    if (allocation) {
      setAllocationMethod(allocation.allocationMethod || 'fixed_amount');
      setAllocationBase(allocation.allocationBase || 'total_direct_cost');
      setRate(allocation.allocationRate ?? 0);
      setUnitQuantity(allocation.unitQuantity ?? 1);
      setNotes(allocation.notes || '');
    }
    setError(null);
  }, [allocation, isOpen]);

  if (!isOpen || !allocation) return null;

  const rateNum = Number(rate) || 0;
  const qtyNum = Number(unitQuantity) || 1;

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
      await api.updatePlanOverheadAllocation(planId, allocation.id, {
        allocationMethod,
        allocationBase,
        allocationRate: rateNum,
        unitQuantity: qtyNum,
        notes: notes.trim()
      });
      onAllocationUpdated();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update plan overhead allocation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-150">
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Edit Plan Overhead Allocation</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {allocation.overheadItemName || allocation.overheadItemCode || 'Overhead'}
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

        {error && (
          <div className="p-3 mx-4 mt-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Method
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

          <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-amber-800 dark:text-amber-300 font-semibold uppercase">
                Revised Allocation Impact
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Revision Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
            disabled={saving}
            className="px-5 py-2 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Allocation'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
