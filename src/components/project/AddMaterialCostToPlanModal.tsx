import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Package,
  Layers,
  Search,
  Building2,
  DollarSign,
  Plus,
  CheckCircle2,
  Percent,
  Sliders,
  Info,
  Loader2
} from 'lucide-react';
import { MaterialItem, Supplier } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, getStoredCurrency, SUPPORTED_CURRENCIES } from '../../utils/currency';
import { round2, round4, decAdd, decSub, decMul, decDiv } from '../../utils/decimalMath';

interface AddMaterialCostToPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  currency?: string;
  planCurrency?: string;
  materials?: MaterialItem[];
  suppliers?: Supplier[];
  sections?: Array<{ id: string; phaseCode: string; name: string }>;
  onAddMaterialCost?: (itemData: any) => Promise<void>;
  onSuccess?: () => void;
  showToast?: (msg: string | { message: string; type?: string }) => void;
}

export const AddMaterialCostToPlanModal: React.FC<AddMaterialCostToPlanModalProps> = ({
  isOpen,
  onClose,
  planId,
  currency,
  planCurrency,
  materials = [],
  suppliers = [],
  sections = [],
  onAddMaterialCost,
  onSuccess,
  showToast
}) => {
  const activeCurrency = currency || planCurrency || 'LKR';
  const [internalMaterials, setInternalMaterials] = useState<MaterialItem[]>([]);
  const [internalSuppliers, setInternalSuppliers] = useState<Supplier[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if ((!materials || materials.length === 0) && internalMaterials.length === 0) {
      setLoadingCatalog(true);
      Promise.all([
        api.getMaterials().catch(() => []),
        api.getSuppliers().catch(() => [])
      ]).then(([mats, supps]) => {
        setInternalMaterials(mats || []);
        setInternalSuppliers(supps || []);
      }).finally(() => {
        setLoadingCatalog(false);
      });
    }
  }, [isOpen, materials]);

  const allMaterials = (materials && materials.length > 0) ? materials : internalMaterials;
  const allSuppliers = (suppliers && suppliers.length > 0) ? suppliers : internalSuppliers;

  const [sourceMode, setSourceMode] = useState<'catalog' | 'custom'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');

  // Form Fields
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('Raw Materials & Structural Alloys');
  const [supplierName, setSupplierName] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [unit, setUnit] = useState('kg');
  const [unitCost, setUnitCost] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(10);
  const [wastePct, setWastePct] = useState<number>(5); // 5% standard scrap/waste allowance
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [markupPct, setMarkupPct] = useState<number>(30); // 30% margin markup
  const [isBillableToClient, setIsBillableToClient] = useState<boolean>(true);
  const [selectedSectionId, setSelectedSectionId] = useState<string>(sections[0]?.id || '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Filter materials from catalog
  const filteredMaterials = useMemo(() => {
    const list = allMaterials || [];
    if (!searchQuery.trim()) return list.slice(0, 15);
    const q = searchQuery.toLowerCase();
    return list.filter(
      (m) =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.code || '').toLowerCase().includes(q) ||
        (m.category && m.category.toLowerCase().includes(q)) ||
        (m.supplierName && m.supplierName.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [allMaterials, searchQuery]);

  // Handle catalog material selection
  const handleSelectMaterial = (m: MaterialItem) => {
    setSelectedMaterialId(m.id);
    setName(m.name || '');
    setCode(m.code || '');
    setCategory(m.category || 'Raw Materials & Structural Alloys');
    setUnit(m.unit || 'pcs');
    setUnitCost(Number(m.currentPrice || m.retailPrice || m.unitCost || 0));
    setSupplierName(m.supplierName || '');
    setSupplierId(m.supplierId || '');
  };

  // Calculations
  const calculated = useMemo(() => {
    const qty = Math.max(0, round4(quantity));
    const baseCost = Math.max(0, round4(unitCost));
    const scrapMultiplier = decAdd(1, decDiv(Math.max(0, wastePct), 100));
    const effectiveQtyWithWaste = round4(decMul(qty, scrapMultiplier));

    // Base subtotal with waste
    const grossCost = round2(decMul(effectiveQtyWithWaste, baseCost));
    const disc = Math.max(0, Math.min(100, round2(discountPct)));
    const totalMaterialCost = round2(decMul(grossCost, decSub(1, decDiv(disc, 100))));

    // Billable rate to client
    const mk = Math.max(0, round2(markupPct));
    const sellingRate = round4(decMul(baseCost, decAdd(1, decDiv(mk, 100))));
    const totalRevenue = isBillableToClient ? round2(decMul(qty, sellingRate)) : 0;
    const grossProfit = round2(decSub(totalRevenue, totalMaterialCost));

    return {
      qty,
      effectiveQtyWithWaste,
      totalMaterialCost,
      sellingRate,
      totalRevenue,
      grossProfit
    };
  }, [quantity, unitCost, wastePct, discountPct, markupPct, isBillableToClient]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast?.({ message: 'Material name is required', type: 'error' });
      return;
    }
    if (unitCost <= 0) {
      showToast?.({ message: 'Unit cost must be greater than 0', type: 'error' });
      return;
    }
    if (quantity <= 0) {
      showToast?.({ message: 'Quantity must be greater than 0', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        code: code || `MAT-${Date.now().toString().slice(-4)}`,
        type: 'material',
        category,
        supplierOrProvider: supplierName || 'Direct Sourced',
        supplierId: supplierId || null,
        catalogItemId: selectedMaterialId || null,
        sectionId: selectedSectionId || null,
        quantity: calculated.qty,
        unit,
        unitCost,
        discountPct,
        totalCost: calculated.totalMaterialCost,
        rate: isBillableToClient ? calculated.sellingRate : 0,
        sellingRate: isBillableToClient ? calculated.sellingRate : 0,
        markupPct: isBillableToClient ? markupPct : 0,
        totalRevenue: calculated.totalRevenue,
        grossProfit: calculated.grossProfit,
        currency: activeCurrency,
        notes: `Waste allowance: ${wastePct}%${notes ? ' | ' + notes : ''}`
      };

      if (onAddMaterialCost) {
        await onAddMaterialCost(payload);
      } else {
        await api.addRevenueItemToPlan(planId, payload);
      }
      showToast?.({ message: `Added material "${name}" to plan costs.`, type: 'success' });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      showToast?.({ message: err?.message || 'Failed to add material cost', type: 'error' });
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
            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 rounded-xl text-blue-600 dark:text-sky-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Add Material & Manufacturing Cost Line
              </h2>
              <p className="text-[11px] text-slate-500">
                Record raw materials, components, and hardware in {planCurrency} directly to this project plan.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
            Select from Materials Database
          </button>
          <button
            type="button"
            onClick={() => {
              setSourceMode('custom');
              setSelectedMaterialId('');
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer ${
              sourceMode === 'custom'
                ? 'border-[#0078d4] text-[#0078d4] dark:text-sky-400 font-bold bg-blue-50/50 dark:bg-blue-950/30'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Custom / Direct Material Entry
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {sourceMode === 'catalog' && (
            <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Browse Materials Catalogue</span>
                <span className="text-[10px] text-slate-400">Total {materials.length} verified materials</span>
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by code, material name, alloy grade, or vendor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Match list */}
              <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80">
                {filteredMaterials.map((m) => {
                  const isSelected = selectedMaterialId === m.id;
                  const price = Number(m.currentPrice || m.retailPrice || m.unitCost || 0);
                  return (
                    <div
                      key={m.id}
                      onClick={() => handleSelectMaterial(m)}
                      className={`px-3 py-2 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50/80 dark:bg-blue-950/70 text-[#0078d4] dark:text-sky-300'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-700/40 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="font-semibold flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-slate-400">{m.code}</span>
                          <span className="truncate">{m.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {m.category} • Supplier: {m.supplierName || 'Primary'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(price, planCurrency)} / {m.unit || 'unit'}
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
                {filteredMaterials.length === 0 && (
                  <div className="py-4 text-center text-xs text-slate-400">
                    No materials matched "{searchQuery}". You can enter a custom material above.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Core Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Material / Item Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 6061-T6 Aluminum Structural Plate 10mm"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Material Category
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Metals & Structural Alloys"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Supplier / Vendor
              </label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="e.g. Lanka Metal Corp / Direct"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Phase / Section Assignment
              </label>
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="">General Project Cost (No Phase)</option>
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    [{sec.phaseCode}] {sec.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pricing & Quantity Inputs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50/70 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Quantity *
              </label>
              <input
                type="number"
                min="0.0001"
                step="any"
                required
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Unit of Measure
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="kg, pcs, m, ton"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Unit Cost ({planCurrency}) *
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={unitCost}
                onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-blue-600 dark:text-sky-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Waste / Scrap %
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={wastePct}
                onChange={(e) => setWastePct(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-amber-600"
              />
            </div>
          </div>

          {/* Revenue & Billing configuration */}
          <div className="p-3 bg-blue-50/40 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBillableToClient}
                  onChange={(e) => setIsBillableToClient(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>Include in Client Quoted Revenue (Billable Item)</span>
              </label>
              {isBillableToClient && (
                <div className="flex items-center space-x-1 text-xs">
                  <span className="text-slate-500">Markup:</span>
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

            {/* Financial Summary Ribbon */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-blue-100 dark:border-blue-900/50 text-center">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Direct Cost</span>
                <div className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(calculated.totalMaterialCost, planCurrency)}
                </div>
                <div className="text-[9px] text-slate-400 font-mono">
                  ({calculated.effectiveQtyWithWaste} {unit} incl. {wastePct}% scrap)
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Billable Rate</span>
                <div className="font-mono text-xs font-bold text-[#0078d4] dark:text-sky-400">
                  {isBillableToClient ? `${formatCurrency(calculated.sellingRate, planCurrency)}/${unit}` : 'Internal Cost Only'}
                </div>
                <div className="text-[9px] text-slate-400">
                  {isBillableToClient ? `${markupPct}% target markup` : 'Not billed separately'}
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Expected Gross Profit</span>
                <div className={`font-mono text-xs font-bold ${calculated.grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                  {formatCurrency(calculated.grossProfit, planCurrency)}
                </div>
                <div className="text-[9px] text-emerald-600 font-semibold">
                  {isBillableToClient && calculated.totalRevenue > 0
                    ? `${((calculated.grossProfit / calculated.totalRevenue) * 100).toFixed(1)}% margin`
                    : 'N/A'}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Procurement & Engineering Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Sourced per Mill Test Certificate MTC-2026; 10-day supplier delivery buffer."
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
              className="px-5 py-2 text-xs font-bold rounded-xl bg-[#0078d4] hover:bg-[#006cbd] text-white transition-colors cursor-pointer shadow-sm flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{saving ? 'Adding to Plan...' : 'Add Material Cost to Plan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
