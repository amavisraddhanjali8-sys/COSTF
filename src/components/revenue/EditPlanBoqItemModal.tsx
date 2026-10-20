import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Package,
  Wrench,
  DollarSign,
  AlertCircle,
  History,
  Info,
  ArrowRight
} from 'lucide-react';
import { ProjectPlanBoqItem } from '../../types';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/currency';

interface EditPlanBoqItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  planId: string;
  planNumber?: string;
  boqItem: ProjectPlanBoqItem | null;
  activeCurrency: string;
}

export const EditPlanBoqItemModal: React.FC<EditPlanBoqItemModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  planId,
  planNumber,
  boqItem,
  activeCurrency
}) => {
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('unit');
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [rate, setRate] = useState<number | ''>(0);
  const [discountPct, setDiscountPct] = useState<number | ''>(0);
  const [taxTreatment, setTaxTreatment] = useState('Standard (0%)');
  const [changeReason, setChangeReason] = useState('');
  const [commercialContext, setCommercialContext] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (boqItem) {
      setDescription(boqItem.description || boqItem.name);
      setUnit(boqItem.unit || 'unit');
      setQuantity(boqItem.quantity ?? 1);
      setRate(boqItem.rate ?? boqItem.sellingRate ?? boqItem.billableRate ?? 0);
      setDiscountPct(boqItem.discountPct ?? 0);
      setTaxTreatment(boqItem.taxTreatment || 'Standard (0%)');
      setChangeReason('');
      setCommercialContext(boqItem.commercialContext || '');
      setEffectiveDate(new Date().toISOString().slice(0, 10));
    }
    setError(null);
  }, [boqItem, isOpen]);

  if (!isOpen || !boqItem) return null;

  const oldRate = Number(boqItem.rate ?? boqItem.sellingRate ?? boqItem.billableRate ?? 0);
  const oldQty = Number(boqItem.quantity ?? 1);
  const oldUnit = boqItem.unit || 'unit';

  const newQty = Number(quantity) || 0;
  const newRate = Number(rate) || 0;
  const newDisc = Number(discountPct) || 0;

  const rateChanged = newRate !== oldRate;
  const qtyChanged = newQty !== oldQty;
  const unitChanged = unit !== oldUnit;

  const discountedRate = newRate * (1 - newDisc / 100);
  const newRevenue = newQty * discountedRate;
  const oldRevenue = oldQty * oldRate;
  const revenueDiff = newRevenue - oldRevenue;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newQty <= 0) {
      setError('Quantity must be greater than 0.');
      return;
    }
    if (newRate < 0) {
      setError('Selling rate cannot be negative.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        description: description.trim(),
        unit: unit.trim(),
        quantity: newQty,
        rate: newRate,
        sellingRate: newRate,
        discountPct: newDisc,
        taxTreatment,
        taxRatePct: taxTreatment.includes('18%') ? 18 : taxTreatment.includes('15%') ? 15 : taxTreatment.includes('8%') ? 8 : 0,
        changeReason: changeReason.trim() || (rateChanged && qtyChanged ? 'Rate and quantity revision' : rateChanged ? 'Rate revision' : qtyChanged ? 'Quantity revision' : 'Commercial update'),
        commercialContext: commercialContext.trim(),
        effectiveDate,
        idempotencyKey: `upd-${boqItem.id}-${Date.now()}`
      };

      await api.updatePlanBoqItem(planId, boqItem.id, payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update plan BOQ item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-150">
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Edit Item
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800">
                  {boqItem.itemCode || boqItem.revenueItemCode || 'BOQ'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {boqItem.name}
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
          {/* Isolation banner */}
          <div className="p-2.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 text-xs flex items-start space-x-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-sky-600" />
            <span>
              Adjusting this plan's selling rate or quantity will update PostgreSQL plan records and write an audit event into <strong className="font-mono">revenue_rate_history</strong>. The catalogue default rate remains intact.
            </span>
          </div>

          {/* Pricing & Units */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Selling Rate <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={rate}
                onChange={(e) => setRate(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              />
              {rateChanged && (
                <div className="text-[10px] text-emerald-600 font-mono mt-1 flex items-center space-x-1">
                  <span>Prev: {formatCurrency(oldRate, activeCurrency)}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Quantity <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.0001"
                min="0.0001"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              />
              {qtyChanged && (
                <div className="text-[10px] text-blue-600 font-mono mt-1">
                  Prev: {oldQty}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Unit <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
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
                value={discountPct}
                onChange={(e) => setDiscountPct(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Plan Scope / Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Comparison Card */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Commercial Impact Summary
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <div className="text-[10px] text-slate-400 uppercase font-sans">Previous Revenue</div>
                <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {formatCurrency(oldRevenue, activeCurrency)}
                </div>
                <div className="text-[10px] text-slate-400 font-sans">
                  {oldQty} {oldUnit} @ {formatCurrency(oldRate, activeCurrency)}
                </div>
              </div>

              <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <div className="text-[10px] text-slate-400 uppercase font-sans">Revised Revenue</div>
                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(newRevenue, activeCurrency)}
                </div>
                <div className="text-[10px] text-slate-400 font-sans">
                  {newQty} {unit} @ {formatCurrency(discountedRate, activeCurrency)}
                  {revenueDiff !== 0 && (
                    <span className={revenueDiff > 0 ? 'text-emerald-600 ml-1 font-bold' : 'text-rose-600 ml-1 font-bold'}>
                      ({revenueDiff > 0 ? '+' : ''}{formatCurrency(revenueDiff, activeCurrency)})
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Change Reason & Effective Date (Requirement 14) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Change Reason <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="e.g. Client requested rate concession, Scope revision"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
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
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Commercial Context / Negotiation Notes
            </label>
            <input
              type="text"
              value={commercialContext}
              onChange={(e) => setCommercialContext(e.target.value)}
              placeholder="e.g. Approved by Project Director under concession clause 4.2"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>
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
            disabled={saving}
            className="px-5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Plan Rate Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
