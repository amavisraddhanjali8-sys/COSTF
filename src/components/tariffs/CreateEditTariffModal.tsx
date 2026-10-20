import React, { useState, useEffect } from 'react';
import { X, Tag, DollarSign, Calendar, Layers, Shield, HelpCircle, AlertCircle } from 'lucide-react';
import { Tariff, TariffCalculationMethod, TariffApplicableBase, TariffStatus } from '../../types';

interface CreateEditTariffModalProps {
  isOpen: boolean;
  tariff?: Tariff | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  showToast: (msg: string) => void;
}

export const CreateEditTariffModal: React.FC<CreateEditTariffModalProps> = ({
  isOpen,
  tariff,
  onClose,
  onSave,
  showToast
}) => {
  const isEditing = Boolean(tariff);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Surface Finishing');
  const [calculationMethod, setCalculationMethod] = useState<TariffCalculationMethod>('percentage');
  const [rateOrPercentage, setRateOrPercentage] = useState<number>(10);
  const [fixedCharge, setFixedCharge] = useState<number>(0);
  const [unit, setUnit] = useState('%');
  const [applicableBase, setApplicableBase] = useState<TariffApplicableBase>('material_cost');
  const [currency, setCurrency] = useState('USD');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [effectiveTo, setEffectiveTo] = useState('');
  const [status, setStatus] = useState<TariffStatus>('Active');
  const [sourceReference, setSourceReference] = useState('');
  const [description, setDescription] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tariff) {
      setCode(tariff.code);
      setName(tariff.name);
      setCategory(tariff.category);
      setCalculationMethod(tariff.calculationMethod);
      setRateOrPercentage(tariff.rateOrPercentage);
      setFixedCharge(tariff.fixedCharge || 0);
      setUnit(tariff.unit || '%');
      setApplicableBase(tariff.applicableBase || 'material_cost');
      setCurrency(tariff.currency || 'USD');
      setEffectiveFrom(tariff.effectiveFrom || new Date().toISOString().slice(0, 10));
      setEffectiveTo(tariff.effectiveTo || '');
      setStatus(tariff.status || 'Active');
      setSourceReference(tariff.sourceReference || '');
      setDescription(tariff.description || '');
      setNotes(tariff.notes || '');
      setChangeReason('');
    } else {
      const rnd = Math.floor(100 + Math.random() * 900);
      setCode(`TRF-CAT-${rnd}`);
      setName('');
      setCategory('Surface Finishing');
      setCalculationMethod('percentage');
      setRateOrPercentage(10);
      setFixedCharge(0);
      setUnit('%');
      setApplicableBase('material_cost');
      setCurrency('USD');
      setEffectiveFrom(new Date().toISOString().slice(0, 10));
      setEffectiveTo('');
      setStatus('Active');
      setSourceReference('');
      setDescription('');
      setNotes('');
      setChangeReason('Initial tariff registration');
    }
    setError(null);
  }, [tariff, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Tariff name is required.');
      return;
    }
    if (!code.trim()) {
      setError('Tariff code is required.');
      return;
    }
    if (rateOrPercentage < 0) {
      setError('Rate or percentage cannot be negative.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSave({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        category: category.trim(),
        calculationMethod,
        rateOrPercentage: Number(rateOrPercentage),
        fixedCharge: Number(fixedCharge) || 0,
        unit: unit.trim(),
        applicableBase,
        currency,
        effectiveFrom,
        effectiveTo: effectiveTo.trim() || null,
        status,
        sourceReference: sourceReference.trim(),
        description: description.trim(),
        changeReason: changeReason.trim() || (isEditing ? 'Tariff details updated' : 'Initial tariff registration'),
        notes: notes.trim()
      });
      showToast(isEditing ? `Tariff ${code} updated.` : `Tariff ${code} registered successfully.`);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save tariff schedule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-150">
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {isEditing ? 'Edit Enterprise Tariff Master' : 'Create New Enterprise Tariff'}
              </h2>
              <p className="text-[11px] text-slate-500">
                {isEditing ? 'Modify tariff metadata, categorization, or status' : 'Define new statutory, treatment, or trade tariff schedule'}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tariff Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={code}
                disabled={isEditing}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. TRF-ANOD-01, TRF-STEEL-DUTY"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono font-bold text-slate-800 dark:text-slate-200 disabled:opacity-60"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tariff Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  if (e.target.value === 'Statutory & Customs') {
                    setCalculationMethod('percentage');
                    setUnit('%');
                    setApplicableBase('material_cost');
                  } else if (e.target.value === 'Surface Finishing') {
                    setCalculationMethod('unit_rate');
                    setUnit('pcs');
                    setApplicableBase('quantity');
                  }
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              >
                <option value="Surface Finishing">Surface Finishing & Treatments</option>
                <option value="Statutory & Customs">Statutory, Customs & Import Duties</option>
                <option value="Quality & Inspection">Quality & Non-Destructive Testing (NDT)</option>
                <option value="Labour & Trades">Specialized Labour & Heavy Trades</option>
                <option value="Utility & Energy">Utility, Facility & Cleanroom Overhead</option>
                <option value="Logistics & Freight">Logistics, Handling & Port Surcharge</option>
                <option value="General Enterprise">General Enterprise Tariff</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tariff Name / Description <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. MIL-A-8625 Type III Hardcoat Anodizing Baseline Tariff"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Calculation Method
              </label>
              <select
                value={calculationMethod}
                onChange={(e) => {
                  const m = e.target.value as TariffCalculationMethod;
                  setCalculationMethod(m);
                  if (m === 'percentage') setUnit('%');
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              >
                <option value="percentage">Percentage of Base (%)</option>
                <option value="unit_rate">Unit Rate (per Unit/Qty)</option>
                <option value="fixed_charge">Fixed Lump-Sum Charge</option>
                <option value="hybrid">Hybrid (Fixed + Percentage)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {calculationMethod === 'percentage' ? 'Rate / Percentage (%)' : 'Unit Rate ($)'}
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Applicable Base
              </label>
              <select
                value={applicableBase}
                onChange={(e) => setApplicableBase(e.target.value as TariffApplicableBase)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              >
                <option value="material_cost">Direct Material Cost</option>
                <option value="labour_cost">Subcontractor Labour Cost</option>
                <option value="outsourced_cost">Outsourced Services Cost</option>
                <option value="total_direct_cost">Total Direct Cost (Mat + Lab + Out)</option>
                <option value="total_revenue">Total Quoted Revenue</option>
                <option value="quantity">Item Quantity / Units</option>
                <option value="fixed">Fixed Charge Only</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Unit
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="%, pcs, hr, kg, run"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TariffStatus)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Pending">Pending Approval</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              Statutory or Source Reference
            </label>
            <input
              type="text"
              value={sourceReference}
              onChange={(e) => setSourceReference(e.target.value)}
              placeholder="e.g. National Gazette 2026/04, Supplier Contract Ref SLA-2026-V1"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Reason for Creation / Modification <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="e.g. Q1 annual tariff revision, gazetted customs escalation, SLA update"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              required
            />
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
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-xs cursor-pointer disabled:opacity-60"
            >
              {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Register Tariff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
