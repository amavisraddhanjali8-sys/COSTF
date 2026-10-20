import React, { useState, useEffect } from 'react';
import { X, Calendar, Tag, DollarSign, History, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Tariff, TariffVersion, TariffCalculationMethod } from '../../types';

interface CreateTariffVersionModalProps {
  isOpen: boolean;
  tariff: Tariff | null;
  onClose: () => void;
  onSave: (tariffId: string, versionData: any) => Promise<void>;
  showToast: (msg: string) => void;
}

export const CreateTariffVersionModal: React.FC<CreateTariffVersionModalProps> = ({
  isOpen,
  tariff,
  onClose,
  onSave,
  showToast
}) => {
  const [rateOrPercentage, setRateOrPercentage] = useState<number>(0);
  const [fixedCharge, setFixedCharge] = useState<number>(0);
  const [calculationMethod, setCalculationMethod] = useState<TariffCalculationMethod>('percentage');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [sourceReference, setSourceReference] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tariff) {
      setRateOrPercentage(tariff.rateOrPercentage);
      setFixedCharge(tariff.fixedCharge || 0);
      setCalculationMethod(tariff.calculationMethod);
      setEffectiveFrom(new Date().toISOString().slice(0, 10));
      setEffectiveTo('');
      setSourceReference(tariff.sourceReference || '');
      setChangeReason('');
      setNotes('');
    }
    setError(null);
  }, [tariff, isOpen]);

  if (!isOpen || !tariff) return null;

  const currentRate = tariff.rateOrPercentage;
  const nextVerNumber = (tariff.versionsCount || tariff.versions?.length || 1) + 1;
  const rateDiff = rateOrPercentage - currentRate;
  const pctChange = currentRate > 0 ? (rateDiff / currentRate) * 100 : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rateOrPercentage < 0) {
      setError('Rate or percentage cannot be negative.');
      return;
    }
    if (!effectiveFrom) {
      setError('Effective from date is required.');
      return;
    }
    if (!changeReason.trim()) {
      setError('A formal revision reason is required for regulatory audit trail compliance.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSave(tariff.id, {
        rateOrPercentage: Number(rateOrPercentage),
        fixedCharge: Number(fixedCharge) || 0,
        calculationMethod,
        applicableBase: tariff.applicableBase,
        unit: tariff.unit,
        currency: tariff.currency,
        effectiveFrom,
        effectiveTo: effectiveTo.trim() || null,
        sourceReference: sourceReference.trim(),
        changeReason: changeReason.trim(),
        notes: notes.trim()
      });
      showToast(`Tariff version v${nextVerNumber} created successfully.`);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create tariff version');
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
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  New Version
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  v{nextVerNumber}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                {tariff.code} • {tariff.name}
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

          {/* Current Rate vs New Rate Banner */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-3 text-center">
            <div>
              <div className="text-[10px] text-slate-500 font-semibold uppercase">Current Rate</div>
              <div className="text-base font-bold text-slate-800 dark:text-slate-200 font-mono mt-0.5">
                {currentRate} {tariff.unit}
              </div>
              <div className="text-[10px] text-slate-400">Version v{nextVerNumber - 1}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-semibold uppercase">New Scheduled Rate</div>
              <div className="text-base font-bold text-blue-600 dark:text-blue-400 font-mono mt-0.5 flex items-center justify-center space-x-1">
                <span>{rateOrPercentage} {tariff.unit}</span>
                {rateDiff !== 0 && (
                  <span className={`text-[10px] font-semibold flex items-center ${rateDiff > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {rateDiff > 0 ? <ArrowUpRight className="w-3 h-3 inline" /> : <ArrowDownRight className="w-3 h-3 inline" />}
                    {Math.abs(pctChange).toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="text-[10px] text-blue-500 font-semibold">New Version v{nextVerNumber}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                New Rate / Percentage <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={rateOrPercentage}
                onChange={(e) => setRateOrPercentage(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono text-slate-800 dark:text-slate-200 font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Fixed Mobilization Charge ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={fixedCharge}
                onChange={(e) => setFixedCharge(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Effective From Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Effective To Date (Optional)
              </label>
              <input
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                placeholder="Leave blank for open-ended"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Source / Statutory Reference
            </label>
            <input
              type="text"
              value={sourceReference}
              onChange={(e) => setSourceReference(e.target.value)}
              placeholder="e.g. Revised SLA Q2 2026, Ministry Gazette Order 240/15"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Audit Change Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="Document the commercial, statutory, or inflation driver for this version rate revision..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              required
            />
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
            <strong>Historical Integrity Guarantee:</strong> Creating this version does not overwrite historical records. All past plans referencing version v{nextVerNumber - 1} will continue to evaluate using their historical tariff rates.
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
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs cursor-pointer disabled:opacity-60"
            >
              {loading ? 'Creating Version...' : `Publish Version v${nextVerNumber}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
