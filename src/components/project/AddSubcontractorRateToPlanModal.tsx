import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  HardHat,
  Search,
  Building2,
  CheckCircle2,
  Clock,
  Plus,
  ShieldCheck,
  Star,
  DollarSign,
  Loader2
} from 'lucide-react';
import { SubcontractorRateItem } from '../../types';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/currency';
import { round2, round4, decAdd, decSub, decMul, decDiv } from '../../utils/decimalMath';

interface AddSubcontractorRateToPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  currency?: string;
  planCurrency?: string;
  subcontractors?: SubcontractorRateItem[];
  sections?: Array<{ id: string; phaseCode: string; name: string }>;
  onAddSubcontractorRate?: (itemData: any) => Promise<void>;
  onSuccess?: () => void;
  showToast?: (msg: string | { message: string; type?: string }) => void;
}

export const AddSubcontractorRateToPlanModal: React.FC<AddSubcontractorRateToPlanModalProps> = ({
  isOpen,
  onClose,
  planId,
  currency,
  planCurrency,
  subcontractors = [],
  sections = [],
  onAddSubcontractorRate,
  onSuccess,
  showToast
}) => {
  const activeCurrency = currency || planCurrency || 'LKR';
  const [internalSubs, setInternalSubs] = useState<SubcontractorRateItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if ((!subcontractors || subcontractors.length === 0) && internalSubs.length === 0) {
      setLoadingCatalog(true);
      api.getSubcontractors()
        .then((subs) => setInternalSubs(subs || []))
        .catch(() => setInternalSubs([]))
        .finally(() => setLoadingCatalog(false));
    }
  }, [isOpen, subcontractors]);

  const allSubcontractors = (subcontractors && subcontractors.length > 0) ? subcontractors : internalSubs;

  const [sourceMode, setSourceMode] = useState<'catalog' | 'custom'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubcontractorId, setSelectedSubcontractorId] = useState<string>('');

  // Form Fields
  const [subcontractorName, setSubcontractorName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('Heavy Structural Fabrication & Machining');
  const [rateModel, setRateModel] = useState<'hourly_labour' | 'daily_shift' | 'per_unit' | 'full_contract'>('hourly_labour');
  const [unit, setUnit] = useState('hr');
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [allocatedHours, setAllocatedHours] = useState<number>(40);
  const [shiftMultiplier, setShiftMultiplier] = useState<number>(1.0);
  const [leadTimeDays, setLeadTimeDays] = useState<number>(7);
  const [markupPct, setMarkupPct] = useState<number>(30);
  const [isBillableToClient, setIsBillableToClient] = useState<boolean>(true);
  const [selectedSectionId, setSelectedSectionId] = useState<string>(sections[0]?.id || '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Filter catalogue subcontractors
  const filteredSubcontractors = useMemo(() => {
    const list = allSubcontractors || [];
    if (!searchQuery.trim()) return list.slice(0, 15);
    const q = searchQuery.toLowerCase();
    return list.filter(
      (s) =>
        (s.subcontractorName || '').toLowerCase().includes(q) ||
        (s.nicheServiceName && s.nicheServiceName.toLowerCase().includes(q)) ||
        (s.trade && s.trade.toLowerCase().includes(q)) ||
        (s.serviceCategory && s.serviceCategory.toLowerCase().includes(q)) ||
        (s.code || '').toLowerCase().includes(q)
    ).slice(0, 20);
  }, [allSubcontractors, searchQuery]);

  // Handle catalogue selection
  const handleSelectSubcontractor = (s: SubcontractorRateItem) => {
    setSelectedSubcontractorId(s.id);
    setSubcontractorName(s.subcontractorName || '');
    setTradeName(s.nicheServiceName || s.trade || 'Specialized Subcontractor Trade');
    setCode(s.code || '');
    setCategory(s.serviceCategory || 'Subcontractor Trade Services');
    setUnit(s.unit || 'hr');
    const baseRate = Number(s.rate || s.baseRate || s.retailRate || 0);
    setHourlyRate(baseRate);
    setLeadTimeDays(Number(s.leadTimeDays || 7));
    setShiftMultiplier(Number(s.shiftMultiplier || 1.0));
  };

  // Calculations
  const calculated = useMemo(() => {
    const hours = Math.max(0, round4(allocatedHours));
    const rate = Math.max(0, round4(hourlyRate));
    const mult = Math.max(0.1, round4(shiftMultiplier));

    const effectiveUnitRate = round4(decMul(rate, mult));
    const totalSubcontractorCost = round2(decMul(hours, effectiveUnitRate));

    const mk = Math.max(0, round2(markupPct));
    const sellingRate = round4(decMul(effectiveUnitRate, decAdd(1, decDiv(mk, 100))));
    const totalRevenue = isBillableToClient ? round2(decMul(hours, sellingRate)) : 0;
    const grossProfit = round2(decSub(totalRevenue, totalSubcontractorCost));

    return {
      hours,
      effectiveUnitRate,
      totalSubcontractorCost,
      sellingRate,
      totalRevenue,
      grossProfit
    };
  }, [allocatedHours, hourlyRate, shiftMultiplier, markupPct, isBillableToClient]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subcontractorName.trim()) {
      showToast?.({ message: 'Subcontractor name is required', type: 'error' });
      return;
    }
    if (hourlyRate <= 0) {
      showToast?.({ message: 'Subcontractor rate must be greater than 0', type: 'error' });
      return;
    }
    if (allocatedHours <= 0) {
      showToast?.({ message: 'Allocated hours or units must be greater than 0', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      const lineName = `${tradeName.trim() || 'Subcontractor Trade'} [${subcontractorName.trim()}]`;
      const payload = {
        name: lineName,
        code: code || `SUB-${Date.now().toString().slice(-4)}`,
        type: 'subcontractor',
        category,
        supplierOrProvider: subcontractorName.trim(),
        subcontractorId: selectedSubcontractorId || null,
        subcontractorName: subcontractorName.trim(),
        subcontractorTrade: tradeName.trim() || 'Trade Services',
        subcontractorRate: calculated.effectiveUnitRate,
        leadTimeDays,
        sectionId: selectedSectionId || null,
        quantity: calculated.hours,
        unit,
        unitCost: calculated.effectiveUnitRate,
        discountPct: 0,
        totalCost: calculated.totalSubcontractorCost,
        rate: isBillableToClient ? calculated.sellingRate : 0,
        sellingRate: isBillableToClient ? calculated.sellingRate : 0,
        markupPct: isBillableToClient ? markupPct : 0,
        totalRevenue: calculated.totalRevenue,
        grossProfit: calculated.grossProfit,
        currency: activeCurrency,
        notes: `Subcontractor Rate Model: ${rateModel} | Multiplier: ${shiftMultiplier}x${notes ? ' | ' + notes : ''}`
      };

      if (onAddSubcontractorRate) {
        await onAddSubcontractorRate(payload);
      } else {
        await api.addRevenueItemToPlan(planId, payload);
      }
      showToast?.({ message: `Added subcontractor "${subcontractorName}" to plan costs.`, type: 'success' });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      showToast?.({ message: err?.message || 'Failed to add subcontractor rate', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-50 dark:bg-amber-950/60 rounded-xl text-amber-600 dark:text-amber-400">
              <HardHat className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Add Subcontractor Trade Rate to Plan
              </h2>
              <p className="text-[11px] text-slate-500">
                Engage specialized external contractors, fabricators, or turnkeys in {planCurrency}.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Source Toggle */}
        <div className="px-5 pt-3 flex gap-2 border-b border-slate-100 dark:border-slate-800/60">
          <button
            type="button"
            onClick={() => setSourceMode('catalog')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer ${
              sourceMode === 'catalog'
                ? 'border-[#0078d4] text-[#0078d4] dark:text-sky-400 font-bold bg-blue-50/50 dark:bg-blue-950/30'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Select from Subcontractors Directory
          </button>
          <button
            type="button"
            onClick={() => {
              setSourceMode('custom');
              setSelectedSubcontractorId('');
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer ${
              sourceMode === 'custom'
                ? 'border-[#0078d4] text-[#0078d4] dark:text-sky-400 font-bold bg-blue-50/50 dark:bg-blue-950/30'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Custom Subcontractor Quote
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {sourceMode === 'catalog' && (
            <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Browse Approved Subcontractors</span>
                <span className="text-[10px] text-slate-400">{subcontractors.length} registered contractors</span>
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by firm name, trade, specialty service, or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Match list */}
              <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80">
                {filteredSubcontractors.map((s) => {
                  const isSelected = selectedSubcontractorId === s.id;
                  const rate = Number(s.rate || s.baseRate || 0);
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSelectSubcontractor(s)}
                      className={`px-3 py-2 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-amber-50/80 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-700/40 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="font-semibold flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-slate-400">{s.code}</span>
                          <span className="truncate">{s.subcontractorName}</span>
                          {s.trade && (
                            <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 rounded font-normal">
                              {s.trade}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {s.nicheServiceName || s.serviceCategory} • Score: {s.qualityScorePct || 99}%
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(rate, planCurrency)} / {s.unit || 'hr'}
                        </div>
                        {isSelected && (
                          <span className="text-[10px] text-emerald-600 font-semibold flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Selected
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Core Info Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Subcontractor Firm / Company *
              </label>
              <input
                type="text"
                required
                value={subcontractorName}
                onChange={(e) => setSubcontractorName(e.target.value)}
                placeholder="e.g. Precision CNC Engineering Ltd"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Trade / Specialized Scope *
              </label>
              <input
                type="text"
                required
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                placeholder="e.g. 5-Axis Milling & TIG Welding"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Rate Structure Model
              </label>
              <select
                value={rateModel}
                onChange={(e: any) => {
                  setRateModel(e.target.value);
                  if (e.target.value === 'daily_shift') setUnit('shift');
                  else if (e.target.value === 'per_unit') setUnit('unit');
                  else if (e.target.value === 'full_contract') setUnit('contract');
                  else setUnit('hr');
                }}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="hourly_labour">Hourly Trade Labor (per hour)</option>
                <option value="daily_shift">Daily / Shift Crew Rate (per shift)</option>
                <option value="per_unit">Piece-Rate / Per-Unit Fabricated</option>
                <option value="full_contract">Lump-Sum Fixed Subcontract</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Phase / Section Assignment
              </label>
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="">General Project Subcontractor</option>
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    [{sec.phaseCode}] {sec.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pricing & Units */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-amber-50/40 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/40">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Allocated {unit === 'hr' ? 'Hours' : 'Units'} *
              </label>
              <input
                type="number"
                min="0.1"
                step="any"
                required
                value={allocatedHours}
                onChange={(e) => setAllocatedHours(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Unit Rate ({planCurrency}) *
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={hourlyRate}
                onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Shift / OT Multiplier
              </label>
              <input
                type="number"
                min="0.5"
                max="3"
                step="0.05"
                value={shiftMultiplier}
                onChange={(e) => setShiftMultiplier(parseFloat(e.target.value) || 1)}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Lead Time (Days)
              </label>
              <input
                type="number"
                min="1"
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(parseInt(e.target.value, 10) || 7)}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          {/* Billing Ribbon */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBillableToClient}
                  onChange={(e) => setIsBillableToClient(e.target.checked)}
                  className="rounded text-amber-600"
                />
                <span>Include in Client Quoted Revenue (Billable Subcontractor)</span>
              </label>
              {isBillableToClient && (
                <div className="flex items-center space-x-1 text-xs">
                  <span className="text-slate-500">Margin Markup:</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={markupPct}
                    onChange={(e) => setMarkupPct(parseFloat(e.target.value) || 0)}
                    className="w-16 px-1.5 py-0.5 text-xs font-mono font-bold rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-right"
                  />
                  <span className="text-slate-500">%</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200 dark:border-slate-800 text-center">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Subcontractor Cost</span>
                <div className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                  {formatCurrency(calculated.totalSubcontractorCost, planCurrency)}
                </div>
                <div className="text-[9px] text-slate-400">
                  {calculated.hours} {unit} @ {formatCurrency(calculated.effectiveUnitRate, planCurrency)}
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Billable Rate</span>
                <div className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                  {isBillableToClient ? `${formatCurrency(calculated.sellingRate, planCurrency)}/${unit}` : 'Direct Cost Only'}
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Gross Profit on Sub</span>
                <div className={`font-mono text-xs font-bold ${calculated.grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                  {formatCurrency(calculated.grossProfit, planCurrency)}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Scope of Work & Contract Terms
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Subcontractor delivers certified NDT test reports. Net 30 payment upon QA signoff."
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer shadow-sm flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{saving ? 'Adding to Plan...' : 'Add Subcontractor Rate to Plan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
