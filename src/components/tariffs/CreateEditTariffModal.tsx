import React, { useState, useEffect } from 'react';
import { X, Tag, DollarSign, Calendar, Layers, Shield, AlertCircle, Trash2 } from 'lucide-react';
import { Tariff, TariffCalculationMethod, TariffApplicableBase, TariffStatus, TariffScopeType } from '../../types';
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY_CODE, getCurrencyInfo } from '../../utils/currency';
import { peekNextNumber, generateNextNumber } from '../../services/autoNumberingService';

interface CreateEditTariffModalProps {
  isOpen: boolean;
  tariff?: Tariff | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  showToast: (msg: string) => void;
}

export const CreateEditTariffModal: React.FC<CreateEditTariffModalProps> = ({
  isOpen,
  tariff,
  onClose,
  onSave,
  onDelete,
  showToast
}) => {
  const isEditing = Boolean(tariff);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General Enterprise');
  const [scopeType, setScopeType] = useState<TariffScopeType>('general');
  const [scopeTargetName, setScopeTargetName] = useState('');
  const [calculationMethod, setCalculationMethod] = useState<TariffCalculationMethod>('percentage');
  const [rateOrPercentage, setRateOrPercentage] = useState<number>(10);
  const [fixedCharge, setFixedCharge] = useState<number>(0);
  const [unit, setUnit] = useState('%');
  const [applicableBase, setApplicableBase] = useState<TariffApplicableBase>('material_cost');
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY_CODE);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [effectiveTo, setEffectiveTo] = useState('');
  const [status, setStatus] = useState<TariffStatus>('Active');
  const [sourceReference, setSourceReference] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCurrencyInfo = getCurrencyInfo(currency);

  useEffect(() => {
    if (tariff) {
      setCode(tariff.code);
      setName(tariff.name);
      setCategory(tariff.category || 'General Enterprise');
      setScopeType(tariff.scopeType || 'general');
      setScopeTargetName(tariff.scopeTargetName || '');
      setCalculationMethod(tariff.calculationMethod);
      setRateOrPercentage(tariff.rateOrPercentage);
      setFixedCharge(tariff.fixedCharge || 0);
      setUnit(tariff.unit || '%');
      setApplicableBase(tariff.applicableBase || 'material_cost');
      setCurrency(tariff.currency || DEFAULT_CURRENCY_CODE);
      setEffectiveFrom(tariff.effectiveFrom || new Date().toISOString().slice(0, 10));
      setEffectiveTo(tariff.effectiveTo || '');
      setStatus(tariff.status || 'Active');
      setSourceReference(tariff.sourceReference || '');
      setDescription(tariff.description || '');
      setNotes(tariff.notes || '');
    } else {
      setCode(peekNextNumber('tariffs'));
      setName('');
      setCategory('General Enterprise');
      setScopeType('general');
      setScopeTargetName('');
      setCalculationMethod('percentage');
      setRateOrPercentage(10);
      setFixedCharge(0);
      setUnit('%');
      setApplicableBase('material_cost');
      setCurrency(DEFAULT_CURRENCY_CODE);
      setEffectiveFrom(new Date().toISOString().slice(0, 10));
      setEffectiveTo('');
      setStatus('Active');
      setSourceReference('');
      setDescription('');
      setNotes('');
    }
    setError(null);
  }, [tariff, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!code.trim()) {
      setError('Code is required.');
      return;
    }
    if (rateOrPercentage < 0) {
      setError('Rate cannot be negative.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSave({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        category: category.trim(),
        scopeType,
        scopeTargetName: scopeTargetName.trim(),
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
        notes: notes.trim(),
        changeReason: isEditing ? 'Updated tariff parameters' : 'Created tariff schedule'
      });
      if (!isEditing) {
        generateNextNumber('tariffs', true);
      }
      showToast(isEditing ? `Tariff ${code} updated.` : `Tariff ${code} saved.`);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save tariff');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-150">
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {isEditing ? 'Edit Tariff' : 'New Tariff'}
              </h2>
              <p className="text-[11px] text-slate-500">
                Scope rule, active rate & currency
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-3.5 flex-1 text-xs">
          {error && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Row 1: Code & Scope Rule */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={code}
                disabled={isEditing}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. TRF-01"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono font-bold text-slate-800 dark:text-slate-200 disabled:opacity-60"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Scope <span className="text-rose-500">*</span>
              </label>
              <select
                value={scopeType}
                onChange={(e) => {
                  const s = e.target.value as TariffScopeType;
                  setScopeType(s);
                  if (s === 'material') setApplicableBase('material_cost');
                  else if (s === 'subcontractor') setApplicableBase('labour_cost');
                  else if (s === 'overhead') setApplicableBase('total_direct_cost');
                  else if (s === 'product') setApplicableBase('quantity');
                }}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-semibold"
              >
                <option value="general">General</option>
                <option value="project">Project</option>
                <option value="product">Product</option>
                <option value="material">Material</option>
                <option value="subcontractor">Subcontractor</option>
                <option value="supplier">Supplier</option>
                <option value="overhead">Overhead</option>
              </select>
            </div>
          </div>

          {/* Row 2: Name */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Customs Import Surcharge, Anodizing Surface Finish"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium"
              required
            />
          </div>

          {/* Row 3: Target Match / Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              >
                <option value="General Enterprise">General</option>
                <option value="Surface Finishing">Surface Finishing</option>
                <option value="Statutory & Customs">Statutory & Duties</option>
                <option value="Quality & Inspection">Quality & Inspection</option>
                <option value="Labour & Trades">Labour & Trades</option>
                <option value="Utility & Energy">Utility & Energy</option>
                <option value="Logistics & Freight">Logistics & Freight</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target
              </label>
              <input
                type="text"
                value={scopeTargetName}
                onChange={(e) => setScopeTargetName(e.target.value)}
                placeholder={
                  scopeType === 'project'
                    ? 'Project name/code'
                    : scopeType === 'material'
                    ? 'Material name/grade'
                    : scopeType === 'supplier'
                    ? 'Supplier name'
                    : 'Target name (optional)'
                }
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          {/* Row 4: Calculation Method, Rate & Currency */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Method
              </label>
              <select
                value={calculationMethod}
                onChange={(e) => {
                  const m = e.target.value as TariffCalculationMethod;
                  setCalculationMethod(m);
                  if (m === 'percentage') setUnit('%');
                }}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="unit_rate">Unit Rate</option>
                <option value="fixed_charge">Fixed Lump-Sum</option>
                <option value="hybrid">Hybrid (Fixed + %)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {calculationMethod === 'percentage' ? 'Rate (%)' : `Rate (${activeCurrencyInfo.symbol})`} <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={rateOrPercentage}
                onChange={(e) => setRateOrPercentage(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono text-slate-800 dark:text-slate-200 font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Currency <span className="text-rose-500">*</span>
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol}) - {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 5: Charge, Base, Unit */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Charge ({activeCurrencyInfo.symbol})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={fixedCharge}
                onChange={(e) => setFixedCharge(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono text-slate-800 dark:text-slate-200"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Base
              </label>
              <select
                value={applicableBase}
                onChange={(e) => setApplicableBase(e.target.value as TariffApplicableBase)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              >
                <option value="material_cost">Material Cost</option>
                <option value="labour_cost">Labour Cost</option>
                <option value="outsourced_cost">Outsourced Cost</option>
                <option value="total_direct_cost">Total Direct Cost</option>
                <option value="total_revenue">Total Revenue</option>
                <option value="quantity">Quantity / Units</option>
                <option value="fixed">Fixed Only</option>
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
                placeholder="%, pcs, hr, kg"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          {/* Row 6: From, To & Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                From <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                To
              </label>
              <input
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                placeholder="Open"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TariffStatus)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Pending">Pending</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
          </div>

          {/* Row 7: Notes */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional reference details"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              {isEditing && tariff?.id && onDelete && (
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm(`Delete tariff "${tariff.code}"? This will permanently remove it from the database.`)) {
                      setLoading(true);
                      try {
                        await onDelete(tariff.id);
                        onClose();
                      } catch (err: any) {
                        setError(err?.message || 'Failed to delete tariff');
                      } finally {
                        setLoading(false);
                      }
                    }
                  }}
                  disabled={loading}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-lg cursor-pointer transition-colors flex items-center space-x-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs cursor-pointer transition-all flex items-center space-x-1.5 disabled:opacity-50"
              >
                <span>{loading ? 'Saving...' : isEditing ? 'Update' : 'Save'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
