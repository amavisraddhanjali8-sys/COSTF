import React, { useState, useEffect } from 'react';
import {
  X,
  Truck,
  DollarSign,
  Plus,
  Trash2,
  CheckCircle2,
  Building2,
  Tag,
  AlertCircle,
  FileText,
  Calculator,
  ArrowRight
} from 'lucide-react';
import { ProjectPlanBoqItem, MakeVsBuySubcontractorService } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, getStoredCurrency } from '../../utils/currency';
import { round2, round4 } from '../../utils/decimalMath';

interface AttachSubcontractorChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  currency?: string;
  initialBoqItem?: ProjectPlanBoqItem | null;
  boqItems?: ProjectPlanBoqItem[];
  onSuccess: () => void;
  showToast?: (msg: string | { message: string; type?: string }) => void;
}

const COMMON_SUBCONTRACTOR_SERVICES = [
  { name: 'Powder Coating & Industrial Painting', defaultRate: 850, unit: 'm²' },
  { name: 'Hot-Dip Galvanizing & Zinc Plating', defaultRate: 140, unit: 'kg' },
  { name: 'Precision CNC Machining / Wire EDM', defaultRate: 3500, unit: 'hr' },
  { name: 'Heat Treatment & Stress Relieving', defaultRate: 220, unit: 'kg' },
  { name: 'Non-Destructive Testing (NDT / Radiography)', defaultRate: 15000, unit: 'lot' },
  { name: 'Laser Cutting & CNC Bending', defaultRate: 2800, unit: 'hr' },
  { name: 'Specialized Welding & Certification', defaultRate: 4200, unit: 'hr' },
  { name: 'Sandblasting & Surface Preparation (Sa 2.5)', defaultRate: 650, unit: 'm²' },
  { name: 'Hard Anodizing & Chemical Passivation', defaultRate: 1100, unit: 'm²' }
];

export const AttachSubcontractorChargeModal: React.FC<AttachSubcontractorChargeModalProps> = ({
  isOpen,
  onClose,
  planId,
  currency = 'LKR',
  initialBoqItem,
  boqItems = [],
  onSuccess,
  showToast
}) => {
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [serviceName, setServiceName] = useState('');
  const [subcontractorName, setSubcontractorName] = useState('');
  const [subcontractorId, setSubcontractorId] = useState('');
  const [chargeType, setChargeType] = useState<'per_unit' | 'total_fixed'>('per_unit');
  const [rate, setRate] = useState<number>(0);
  const [leadTimeDays, setLeadTimeDays] = useState<number>(3);
  const [notes, setNotes] = useState('');
  const [subcontractors, setSubcontractors] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialBoqItem) {
      setSelectedItemId(initialBoqItem.id);
    } else if (boqItems.length > 0 && !selectedItemId) {
      setSelectedItemId(boqItems[0].id);
    }
  }, [initialBoqItem, boqItems]);

  useEffect(() => {
    if (isOpen) {
      api.getSubcontractorRates()
        .then((res: any) => {
          const rates = res?.rates || res || [];
          setSubcontractors(Array.isArray(rates) ? rates : []);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentItem = boqItems.find(i => i.id === selectedItemId) || initialBoqItem;
  const currentQuantity = currentItem?.quantity || 1;
  const currentUnitCost = currentItem?.unitCost || 0;

  const addedPerUnit = chargeType === 'per_unit'
    ? rate
    : (currentQuantity > 0 ? rate / currentQuantity : 0);

  const totalChargeAmount = chargeType === 'per_unit'
    ? rate * currentQuantity
    : rate;

  const newUnitCost = currentUnitCost + addedPerUnit;
  const currentSellingRate = currentItem?.sellingRate || 0;

  const handlePresetSelect = (preset: typeof COMMON_SUBCONTRACTOR_SERVICES[0]) => {
    setServiceName(preset.name);
    setRate(preset.defaultRate);
  };

  const handleSubcontractorSelect = (subId: string) => {
    setSubcontractorId(subId);
    const sub = subcontractors.find(s => s.id === subId);
    if (sub) {
      setSubcontractorName(sub.subcontractor_name || sub.service_name || sub.name);
      if (sub.rate_per_unit || sub.standard_rate) {
        setRate(Number(sub.rate_per_unit || sub.standard_rate));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) {
      setError('Please select a target plan item.');
      return;
    }
    if (!serviceName.trim()) {
      setError('Please provide a subcontractor service name or description.');
      return;
    }
    if (rate <= 0) {
      setError('Charge rate must be greater than zero.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const chargePayload = {
        serviceName: serviceName.trim(),
        subcontractorName: subcontractorName.trim() || 'Subcontractor Trade Partner',
        subcontractorId: subcontractorId || undefined,
        unitRate: round4(rate),
        rate: round4(rate),
        chargeType,
        totalCost: round4(totalChargeAmount),
        leadTimeDays: Number(leadTimeDays) || 0,
        notes: notes.trim()
      };

      await api.attachSubcontractorCharge(planId, selectedItemId, chargePayload);

      if (showToast) {
        showToast({
          message: `Attached subcontractor charge "${serviceName}" (+${formatCurrency(addedPerUnit, currency)}/unit) to item cost.`,
          type: 'success'
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to attach subcontractor charge');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 dark:from-slate-900 dark:to-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-600/10 text-amber-600 dark:text-amber-400 rounded-lg">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Attach Subcontractor Charge to Manufacturing Cost
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Incorporate specialized external treatments, plating, testing, or processing charges directly into the item unit cost.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Target Item Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Target Manufactured / BOQ Item *
            </label>
            <select
              value={selectedItemId}
              onChange={e => setSelectedItemId(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
            >
              <option value="">-- Select an Item from Plan BOQ --</option>
              {boqItems.map(item => (
                <option key={item.id} value={item.id}>
                  {item.code ? `[${item.code}] ` : ''}{item.name} (Qty: {item.quantity} {item.unit}, Unit Cost: {formatCurrency(item.unitCost, currency)})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Preset Services */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Common Subcontractor Processes (Quick Select)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_SUBCONTRACTOR_SERVICES.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handlePresetSelect(p)}
                  className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors text-slate-700 dark:text-slate-300"
                >
                  {p.name} ({formatCurrency(p.defaultRate, currency)}/{p.unit})
                </button>
              ))}
            </div>
          </div>

          {/* Subcontractor Service Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Service / Process Description *
            </label>
            <input
              type="text"
              value={serviceName}
              onChange={e => setServiceName(e.target.value)}
              placeholder="e.g. Surface Shot-Blasting & Epoxy Primer Coat"
              required
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Subcontractor Directory or Vendor Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Subcontractor Partner
              </label>
              {subcontractors.length > 0 ? (
                <div className="space-y-1.5">
                  <select
                    value={subcontractorId}
                    onChange={e => handleSubcontractorSelect(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">-- Choose from Subcontractor Directory --</option>
                    {subcontractors.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.subcontractor_name || s.service_name || s.name} ({s.trade_category || 'General'})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={subcontractorName}
                    onChange={e => {
                      setSubcontractorName(e.target.value);
                      setSubcontractorId('');
                    }}
                    placeholder="Or type vendor/partner name"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  />
                </div>
              ) : (
                <input
                  type="text"
                  value={subcontractorName}
                  onChange={e => setSubcontractorName(e.target.value)}
                  placeholder="e.g. Apex Industrial Coating Ltd"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Subcontractor Lead Time (Days)
              </label>
              <input
                type="number"
                min="0"
                value={leadTimeDays}
                onChange={e => setLeadTimeDays(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Charge Type & Rate */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Charging Basis *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setChargeType('per_unit')}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-all ${
                    chargeType === 'per_unit'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold'
                      : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Per Item Unit
                </button>
                <button
                  type="button"
                  onClick={() => setChargeType('total_fixed')}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-all ${
                    chargeType === 'total_fixed'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold'
                      : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Fixed Lot Charge
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {chargeType === 'per_unit'
                  ? 'Cost is added to each unit produced.'
                  : 'Total lot charge will be divided across the line item quantity.'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Subcontractor Rate ({currency}) *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={rate}
                onChange={e => setRate(parseFloat(e.target.value) || 0)}
                required
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Scope of Work / Technical Specifications
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Include 80 micron DFT coating certificate and salt spray test report"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Financial Impact Breakdown Card */}
          {currentItem && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-amber-500" />
                Unit Manufacturing Cost Impact Preview
              </h4>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Current Unit Cost</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white font-mono mt-0.5">
                    {formatCurrency(currentUnitCost, currency)}
                  </div>
                </div>

                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-amber-300 dark:border-amber-700/60">
                  <div className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-bold">+ Sub Charge/Unit</div>
                  <div className="text-sm font-bold text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                    +{formatCurrency(addedPerUnit, currency)}
                  </div>
                </div>

                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-emerald-300 dark:border-emerald-700/60">
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold">New Unit Cost</div>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                    {formatCurrency(newUnitCost, currency)}
                  </div>
                </div>

                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Total Batch Cost</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white font-mono mt-0.5">
                    {formatCurrency(newUnitCost * currentQuantity, currency)}
                  </div>
                </div>
              </div>

              {currentItem.includedSubcontractorCharges && currentItem.includedSubcontractorCharges.length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Existing Subcontractor Charges on this Item ({currentItem.includedSubcontractorCharges.length}):
                  </div>
                  <div className="space-y-1">
                    {currentItem.includedSubcontractorCharges.map((sc, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs text-slate-500 bg-white/70 dark:bg-slate-900/60 px-2 py-1 rounded">
                        <span>• {sc.serviceName} ({sc.subcontractorName})</span>
                        <span className="font-mono font-medium">+{formatCurrency(sc.rate, currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Attaching Charge...' : 'Attach Subcontractor Charge'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
