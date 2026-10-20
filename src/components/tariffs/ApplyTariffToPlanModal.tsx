import React, { useState, useEffect } from 'react';
import { X, Tag, Calendar, DollarSign, Calculator, Layers, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Tariff, Project, ProjectPlan } from '../../types';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/currency';

interface ApplyTariffToPlanModalProps {
  isOpen: boolean;
  planId: string;
  projectId: string;
  planName?: string;
  projectCurrency?: string;
  tariffs: Tariff[];
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string) => void;
}

export const ApplyTariffToPlanModal: React.FC<ApplyTariffToPlanModalProps> = ({
  isOpen,
  planId,
  projectId,
  planName = 'Active Plan',
  projectCurrency = 'USD',
  tariffs,
  onClose,
  onSuccess,
  showToast
}) => {
  const [selectedTariffId, setSelectedTariffId] = useState<string>(tariffs[0]?.id || '');
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState<number>(1);
  const [customBaseAmount, setCustomBaseAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [resolvedVersion, setResolvedVersion] = useState<any>(null);
  const [resolving, setResolving] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tariffs.length > 0 && !selectedTariffId) {
      setSelectedTariffId(tariffs[0].id);
    }
  }, [tariffs, selectedTariffId]);

  useEffect(() => {
    if (!selectedTariffId) return;

    let cancelled = false;
    const resolve = async () => {
      setResolving(true);
      setError(null);
      try {
        const res = await api.resolveTariffVersion(selectedTariffId, effectiveDate);
        if (!cancelled) setResolvedVersion(res);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to resolve tariff version');
      } finally {
        if (!cancelled) setResolving(false);
      }
    };

    void resolve();
    return () => { cancelled = true; };
  }, [selectedTariffId, effectiveDate]);

  if (!isOpen) return null;

  const selectedTariff = tariffs.find(t => t.id === selectedTariffId) || tariffs[0];

  // Calculate estimated tariff cost
  const rate = resolvedVersion?.rateOrPercentage ?? selectedTariff?.rateOrPercentage ?? 0;
  const fixed = resolvedVersion?.fixedCharge ?? selectedTariff?.fixedCharge ?? 0;
  const method = resolvedVersion?.calculationMethod ?? selectedTariff?.calculationMethod ?? 'percentage';
  const parsedBase = customBaseAmount !== '' ? Number(customBaseAmount) : 10000;

  let estimatedTariff = 0;
  if (method === 'percentage') {
    estimatedTariff = (parsedBase * rate) / 100;
  } else if (method === 'unit_rate') {
    estimatedTariff = quantity * rate;
  } else if (method === 'fixed_charge') {
    estimatedTariff = fixed;
  } else if (method === 'hybrid') {
    estimatedTariff = fixed + (parsedBase * rate) / 100;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTariffId) {
      setError('Please select a tariff schedule.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.applyTariffToPlan(planId, {
        tariffId: selectedTariffId,
        effectiveDate,
        quantity: Number(quantity) || 1,
        baseAmount: customBaseAmount !== '' ? Number(customBaseAmount) : undefined,
        notes: notes.trim()
      });
      showToast(`Tariff ${selectedTariff?.code || ''} applied to plan.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to apply tariff to plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-150">
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Apply Enterprise Tariff to Plan
              </h2>
              <p className="text-[11px] text-slate-500">
                Attaching to: <span className="font-semibold text-slate-700 dark:text-slate-300">{planName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Tariff Schedule <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedTariffId}
              onChange={(e) => setSelectedTariffId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium"
            >
              {tariffs.map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.code}] {t.name} ({t.category})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Evaluation / Effective Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Units / Quantity (if applicable)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          {/* Resolved Version Banner */}
          <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-slate-800 dark:text-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-400">
                Resolved Historical Version
              </span>
              {resolvedVersion && (
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                  Version v{resolvedVersion.versionNumber} ({resolvedVersion.matchType})
                </span>
              )}
            </div>

            {resolving ? (
              <div className="text-[11px] text-slate-500">Resolving date matching rules...</div>
            ) : resolvedVersion ? (
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500">Applicable Rate:</span>{' '}
                  <strong className="font-mono text-amber-900 dark:text-amber-200">
                    {resolvedVersion.rateOrPercentage} {resolvedVersion.unit}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Method:</span>{' '}
                  <span className="font-semibold capitalize">{resolvedVersion.calculationMethod?.replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="text-slate-500">Applicable Base:</span>{' '}
                  <span className="font-semibold capitalize">{resolvedVersion.applicableBase?.replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="text-slate-500">Effective Range:</span>{' '}
                  <span className="font-mono text-[10px]">
                    {resolvedVersion.effectiveFrom} → {resolvedVersion.effectiveTo || 'Current'}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Custom Base Amount Override (Optional)
            </label>
            <input
              type="number"
              step="0.01"
              value={customBaseAmount}
              onChange={(e) => setCustomBaseAmount(e.target.value)}
              placeholder="Leave blank to automatically calculate from plan cost"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              If omitted, system auto-sums the plan's direct items matching '{selectedTariff?.applicableBase?.replace('_', ' ')}'.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Commercial / Project Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Applied for client customs clearance at port Colombo"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
            />
          </div>

          {/* Real-Time Preview */}
          <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-xl flex items-center justify-between border border-slate-200 dark:border-slate-800">
            <div>
              <div className="text-[10px] text-slate-500 font-semibold uppercase">Estimated Tariff Charge</div>
              <div className="text-[11px] text-slate-400">Based on resolved v{resolvedVersion?.versionNumber || 1} rate</div>
            </div>
            <div className="text-base font-mono font-bold text-amber-600 dark:text-amber-400">
              {formatCurrency(estimatedTariff, projectCurrency)}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || resolving}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-xs cursor-pointer disabled:opacity-60 flex items-center space-x-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Attaching...' : 'Attach Tariff to Plan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
