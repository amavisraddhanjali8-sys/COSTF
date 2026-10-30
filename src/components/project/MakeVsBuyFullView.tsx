import React, { useState, useEffect, useMemo } from 'react';
import {
  Scale,
  Factory,
  Truck,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Maximize2,
  Minimize2,
  Save,
  Check,
  RefreshCw,
  Sliders,
  DollarSign,
  Package,
  Layers
} from 'lucide-react';
import {
  Project,
  BudgetaryPlan,
  ProjectPlanBoqItem,
  MakeVsBuyAnalysis,
  MakeVsBuyMaterialLine,
  MakeVsBuyLaborLine,
  MakeVsBuySubcontractorService
} from '../../types';
import { api } from '../../services/api';
import { formatCurrency, getStoredCurrency } from '../../utils/currency';
import { round2, round4, decAdd, decSub, decMul, decDiv } from '../../utils/decimalMath';

interface MakeVsBuyFullViewProps {
  project?: Project | null;
  plans?: any[];
  activePlanId?: string | null;
  currency?: string;
  onPlanUpdated?: () => void;
  showToast?: (msg: string | { message: string; type?: string }) => void;
  onClose?: () => void;
  isModal?: boolean;
}

export const MakeVsBuyFullView: React.FC<MakeVsBuyFullViewProps> = ({
  project,
  plans = [],
  activePlanId,
  currency = 'LKR',
  onPlanUpdated,
  showToast,
  onClose,
  isModal = false
}) => {
  // Plan resolution
  const [selectedPlanId, setSelectedPlanId] = useState<string>(() => {
    return activePlanId || plans[0]?.id || '';
  });

  useEffect(() => {
    if (activePlanId) {
      setSelectedPlanId(activePlanId);
    } else if (plans.length > 0 && !selectedPlanId) {
      setSelectedPlanId(plans[0].id);
    }
  }, [activePlanId, plans]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [analyses, setAnalyses] = useState<MakeVsBuyAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);

  // Form State - One-word & minimal
  const [selectedBoqItemId, setSelectedBoqItemId] = useState<string>('');
  const [itemName, setItemName] = useState('Fabricated Enclosure');
  const [itemCode, setItemCode] = useState('MFG-001');
  const [quantity, setQuantity] = useState<number>(50);
  const [unit, setUnit] = useState('Nos');
  const [notes, setNotes] = useState('');

  // Make Side
  const [materials, setMaterials] = useState<MakeVsBuyMaterialLine[]>([
    { name: 'Mild Steel Plate 6mm', quantity: 20, unit: 'kg', unitCost: 450, totalCost: 9000 }
  ]);
  const [labors, setLabors] = useState<MakeVsBuyLaborLine[]>([
    { trade: 'Welding & Fitting', hours: 3, hourlyRate: 950, totalCost: 2850 }
  ]);
  const [subServices, setSubServices] = useState<MakeVsBuySubcontractorService[]>([
    { serviceName: 'Zinc Plating', subcontractorName: 'Apex Plating', rate: 450, chargeType: 'per_unit', totalCost: 22500, leadTimeDays: 2 }
  ]);
  const [inHouseOverheadPct, setInHouseOverheadPct] = useState<number>(10);
  const [inHouseLeadTimeDays, setInHouseLeadTimeDays] = useState<number>(5);

  // Buy Side
  const [subName, setSubName] = useState('Lanka Precision Machining');
  const [subTrade, setSubTrade] = useState('CNC Machining & Fab');
  const [subUnitRate, setSubUnitRate] = useState<number>(4500);
  const [subLeadTimeDays, setSubLeadTimeDays] = useState<number>(7);
  const [subLogisticsCost, setSubLogisticsCost] = useState<number>(2500);
  const [subWarranty, setSubWarranty] = useState('12 Months');

  // Decision State
  const [selectedDecision, setSelectedDecision] = useState<'manufacture' | 'subcontract' | 'hybrid'>('manufacture');

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected Plan Object & BOQ items
  const currentPlan = useMemo(() => {
    return plans.find(p => p.id === selectedPlanId) || plans[0] || null;
  }, [plans, selectedPlanId]);

  const boqItems: ProjectPlanBoqItem[] = useMemo(() => {
    return currentPlan?.boqItems || currentPlan?.selectedItems || [];
  }, [currentPlan]);

  // Load Analyses from Database
  const loadAnalyses = async () => {
    if (!selectedPlanId) return;
    try {
      setLoading(true);
      setError(null);
      const res: any = await api.getPlanMakeVsBuyAnalyses(selectedPlanId);
      const list = Array.isArray(res) ? res : res?.analyses || [];
      setAnalyses(list);
      if (list.length > 0 && !activeAnalysisId) {
        selectAnalysis(list[0]);
      }
    } catch (err: any) {
      console.warn('Error loading make-vs-buy analyses from database:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPlanId) {
      loadAnalyses();
    }
  }, [selectedPlanId]);

  const selectAnalysis = (analysis: MakeVsBuyAnalysis) => {
    setActiveAnalysisId(analysis.id);
    setSelectedBoqItemId(analysis.boqItemId || '');
    setItemName(analysis.itemName || '');
    setItemCode(analysis.itemCode || '');
    setQuantity(Number(analysis.quantity || 1));
    setUnit(analysis.unit || 'Nos');
    setNotes(analysis.notes || '');

    setMaterials(analysis.materialsBreakdown || analysis.inHouseMaterialsBreakdown || []);
    setLabors(analysis.laborBreakdown || analysis.inHouseLaborBreakdown || []);
    setSubServices(analysis.subcontractorChargesBreakdown || analysis.inHouseSubcontractorServices || []);
    setInHouseOverheadPct(Number(analysis.inHouseOverheadPct || 10));
    setInHouseLeadTimeDays(Number(analysis.inHouseLeadTimeDays || 5));

    setSubName(analysis.subcontractorName || '');
    setSubTrade(analysis.subcontractorTrade || '');
    setSubUnitRate(Number(analysis.subcontractorUnitRate || analysis.subcontractorRate || 0));
    setSubLeadTimeDays(Number(analysis.subcontractorLeadTimeDays || 7));
    setSubLogisticsCost(Number(analysis.subcontractorLogisticsCost || 0));
    setSubWarranty(analysis.subcontractorWarrantyNotes || '');

    const dec = (analysis.selectedDecision || analysis.decision || analysis.recommendedDecision || 'manufacture') as any;
    setSelectedDecision(dec.toLowerCase().includes('sub') ? 'subcontract' : dec.toLowerCase().includes('hyb') ? 'hybrid' : 'manufacture');
  };

  const startNewAnalysis = () => {
    setActiveAnalysisId(null);
    setSelectedBoqItemId('');
    setItemName(`Fabricated Component #${analyses.length + 1}`);
    setItemCode(`MFG-${String(Date.now()).slice(-4)}`);
    setQuantity(50);
    setUnit('Nos');
    setNotes('');

    setMaterials([
      { name: 'Mild Steel Plate', quantity: 15, unit: 'kg', unitCost: 450, totalCost: 6750 }
    ]);
    setLabors([
      { trade: 'Welding', hours: 2.5, hourlyRate: 950, totalCost: 2375 }
    ]);
    setSubServices([
      { serviceName: 'Surface Coating', subcontractorName: 'Apex Plating', rate: 350, chargeType: 'per_unit', totalCost: 17500, leadTimeDays: 2 }
    ]);
    setInHouseOverheadPct(10);
    setInHouseLeadTimeDays(5);

    setSubName('Precision Engineering Partner');
    setSubTrade('Turnkey Fabrication');
    setSubUnitRate(3800);
    setSubLeadTimeDays(7);
    setSubLogisticsCost(2000);
    setSubWarranty('12 Months');

    setSelectedDecision('manufacture');
  };

  // Calculations (Exact Decimal Financials)
  const safeQty = Math.max(1, round4(quantity));

  const totalMaterialsCost = useMemo(() => {
    return round2(materials.reduce((sum, m) => sum + (Number(m.totalCost) || 0), 0));
  }, [materials]);

  const totalLaborCost = useMemo(() => {
    return round2(labors.reduce((sum, l) => sum + (Number(l.totalCost) || 0), 0));
  }, [labors]);

  const totalSubServicesCost = useMemo(() => {
    return round2(
      subServices.reduce((sum, s) => {
        const r = Number(s.rate ?? s.unitRate ?? 0);
        const t = s.chargeType === 'total_fixed' ? r : r * safeQty;
        return sum + t;
      }, 0)
    );
  }, [subServices, safeQty]);

  const primeCost = round2(decAdd(decAdd(totalMaterialsCost, totalLaborCost), totalSubServicesCost));
  const overheadAmount = round2(decMul(primeCost, decDiv(Math.max(0, inHouseOverheadPct), 100)));
  const totalMakeCost = round2(decAdd(primeCost, overheadAmount));
  const makeUnitCost = round4(decDiv(totalMakeCost, safeQty));

  const subTotalPureQuote = round2(decMul(safeQty, Math.max(0, subUnitRate)));
  const totalBuyCost = round2(decAdd(subTotalPureQuote, Math.max(0, subLogisticsCost)));
  const buyUnitCost = round4(decDiv(totalBuyCost, safeQty));

  const costDifference = round2(decSub(totalBuyCost, totalMakeCost)); // positive = Make is cheaper
  const savingsPct = totalBuyCost > 0 ? round2(decMul(decDiv(costDifference, totalBuyCost), 100)) : 0;

  const recommendedDecision: 'manufacture' | 'subcontract' | 'hybrid' = useMemo(() => {
    if (subServices.length > 0 && makeUnitCost < buyUnitCost) {
      return 'hybrid';
    }
    return costDifference >= 0 ? 'manufacture' : 'subcontract';
  }, [subServices.length, makeUnitCost, buyUnitCost, costDifference]);

  // Handle Material edits
  const handleAddMaterial = () => {
    setMaterials([...materials, { name: '', quantity: 1, unit: 'kg', unitCost: 0, totalCost: 0 }]);
  };
  const handleUpdateMaterial = (idx: number, field: keyof MakeVsBuyMaterialLine, val: any) => {
    const list = [...materials];
    list[idx] = { ...list[idx], [field]: val };
    const q = Number(list[idx].quantity) || 0;
    const uc = Number(list[idx].unitCost) || 0;
    list[idx].totalCost = round2(q * uc);
    setMaterials(list);
  };
  const handleRemoveMaterial = (idx: number) => {
    setMaterials(materials.filter((_, i) => i !== idx));
  };

  // Handle Labor edits
  const handleAddLabor = () => {
    setLabors([...labors, { trade: '', hours: 1, hourlyRate: 850, totalCost: 850 }]);
  };
  const handleUpdateLabor = (idx: number, field: keyof MakeVsBuyLaborLine, val: any) => {
    const list = [...labors];
    list[idx] = { ...list[idx], [field]: val };
    const h = Number(list[idx].hours) || 0;
    const r = Number(list[idx].hourlyRate) || 0;
    list[idx].totalCost = round2(h * r);
    setLabors(list);
  };
  const handleRemoveLabor = (idx: number) => {
    setLabors(labors.filter((_, i) => i !== idx));
  };

  // Handle Sub Services edits
  const handleAddSubService = () => {
    setSubServices([
      ...subServices,
      { serviceName: '', subcontractorName: '', rate: 0, chargeType: 'per_unit', totalCost: 0, leadTimeDays: 1 }
    ]);
  };
  const handleUpdateSubService = (idx: number, field: keyof MakeVsBuySubcontractorService, val: any) => {
    const list = [...subServices];
    list[idx] = { ...list[idx], [field]: val };
    const r = Number(list[idx].rate ?? list[idx].unitRate ?? 0);
    const isFixed = list[idx].chargeType === 'total_fixed';
    list[idx].totalCost = isFixed ? round2(r) : round2(r * safeQty);
    setSubServices(list);
  };
  const handleRemoveSubService = (idx: number) => {
    setSubServices(subServices.filter((_, i) => i !== idx));
  };

  // Save to Database
  const handleSave = async () => {
    if (!selectedPlanId) {
      setError('Please select a project plan first.');
      return;
    }
    if (!itemName.trim()) {
      setError('Item name required.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        boqItemId: selectedBoqItemId || null,
        itemName: itemName.trim(),
        itemCode: itemCode.trim() || null,
        quantity: safeQty,
        unit: unit.trim() || 'Nos',
        currency,
        materialCostPerUnit: round4(decDiv(totalMaterialsCost, safeQty)),
        laborCostPerUnit: round4(decDiv(totalLaborCost, safeQty)),
        subcontractorChargesPerUnit: round4(decDiv(totalSubServicesCost, safeQty)),
        overheadCostPerUnit: round4(decDiv(overheadAmount, safeQty)),
        totalUnitManufactureCost: makeUnitCost,
        totalManufactureCost: totalMakeCost,
        inHouseOverheadPct,
        inHouseLeadTimeDays,
        subcontractorName: subName.trim(),
        subcontractorTrade: subTrade.trim(),
        subcontractorUnitRate: subUnitRate,
        subcontractorLeadTimeDays: subLeadTimeDays,
        subcontractorLogisticsCost: subLogisticsCost,
        subcontractorWarrantyNotes: subWarranty.trim(),
        totalSubcontractorCost: totalBuyCost,
        costDifference,
        savingsPct,
        recommendedDecision,
        selectedDecision,
        materialsBreakdown: materials,
        laborBreakdown: labors,
        subcontractorChargesBreakdown: subServices,
        notes: notes.trim()
      };

      let saved: MakeVsBuyAnalysis;
      if (activeAnalysisId) {
        saved = await api.updatePlanMakeVsBuyAnalysis(selectedPlanId, activeAnalysisId, payload);
        showToast?.({ message: `Saved "${itemName}"`, type: 'success' });
      } else {
        saved = await api.createPlanMakeVsBuyAnalysis(selectedPlanId, payload);
        setActiveAnalysisId(saved.id);
        showToast?.({ message: `Created "${itemName}"`, type: 'success' });
      }

      await loadAnalyses();
      onPlanUpdated?.();
    } catch (err: any) {
      setError(err?.message || 'Database save error');
      showToast?.({ message: err?.message || 'Save failed', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Delete from Database
  const handleDelete = async () => {
    if (!activeAnalysisId || !selectedPlanId) return;
    try {
      setDeleting(true);
      setError(null);
      await api.deletePlanMakeVsBuyAnalysis(selectedPlanId, activeAnalysisId);
      showToast?.({ message: `Deleted "${itemName}"`, type: 'info' });
      setActiveAnalysisId(null);
      await loadAnalyses();
      startNewAnalysis();
      onPlanUpdated?.();
    } catch (err: any) {
      setError(err?.message || 'Delete error');
      showToast?.({ message: err?.message || 'Delete failed', type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  // Apply to Plan in Database
  const handleApply = async () => {
    if (!activeAnalysisId || !selectedPlanId) {
      setError('Please save the analysis first.');
      return;
    }

    try {
      setApplying(true);
      setError(null);
      await api.applyMakeVsBuyDecision(selectedPlanId, activeAnalysisId, {
        decision: selectedDecision
      });
      showToast?.({ message: `Applied ${selectedDecision.toUpperCase()} to Plan BOQ`, type: 'success' });
      await loadAnalyses();
      onPlanUpdated?.();
    } catch (err: any) {
      setError(err?.message || 'Apply error');
      showToast?.({ message: err?.message || 'Apply failed', type: 'error' });
    } finally {
      setApplying(false);
    }
  };

  const containerClasses = isFullscreen
    ? 'fixed inset-0 z-50 bg-white dark:bg-[#0b101b] flex flex-col p-4 overflow-y-auto'
    : 'w-full bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col';

  return (
    <div className={containerClasses}>
      {/* Top Bar: Minimal One-Word Elements */}
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-900/40">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm text-slate-900 dark:text-white">Make vs Buy</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-sky-300 font-bold">
                {currency}
              </span>
            </div>
          </div>
        </div>

        {/* Plan Selector & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {plans.length > 0 && (
            <div className="flex items-center space-x-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1">
              <span className="text-[11px] font-semibold text-slate-500">Plan:</span>
              <select
                value={selectedPlanId}
                onChange={e => setSelectedPlanId(e.target.value)}
                className="text-xs font-semibold bg-transparent border-0 focus:ring-0 text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                {plans.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name || p.planNumber}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={startNewAnalysis}
            className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200 dark:border-slate-700"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#0078d4] hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving' : 'Save'}</span>
          </button>

          {activeAnalysisId && (
            <>
              <button
                type="button"
                onClick={handleApply}
                disabled={applying}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{applying ? 'Applying' : 'Apply'}</span>
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Analysis List Strip (One-Word Chips) */}
      {analyses.length > 0 && (
        <div className="px-5 py-2 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5 overflow-x-auto bg-slate-50/30 dark:bg-slate-900/20">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
            Saved:
          </span>
          {analyses.map(a => {
            const isSelected = a.id === activeAnalysisId;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => selectAnalysis(a)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-blue-400'
                }`}
              >
                {a.itemName}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div className="mx-5 mt-3 p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content: Full Screen Fit */}
      <div className="p-5 space-y-4 flex-1">
        {/* Row 1: Core Fields - Clean One-Word Labels */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Link Item
            </label>
            <select
              value={selectedBoqItemId}
              onChange={e => {
                const id = e.target.value;
                setSelectedBoqItemId(id);
                const b = boqItems.find(i => i.id === id);
                if (b) {
                  setItemName(b.name);
                  setItemCode((b as any).code || (b as any).itemCode || '');
                  setQuantity(Number(b.quantity) || 1);
                  setUnit(b.unit || 'Nos');
                }
              }}
              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold"
            >
              <option value="">Custom</option>
              {boqItems.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Item
            </label>
            <input
              type="text"
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Code
            </label>
            <input
              type="text"
              value={itemCode}
              onChange={e => setItemCode(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Quantity
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={e => setQuantity(Number(e.target.value) || 1)}
              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Unit
            </label>
            <input
              type="text"
              value={unit}
              onChange={e => setUnit(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
            />
          </div>
        </div>

        {/* Row 2: Make vs Buy Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* MAKE COLUMN */}
          <div className="p-4 rounded-xl border-2 border-blue-200 dark:border-blue-900/60 bg-blue-50/20 dark:bg-blue-950/20 space-y-3">
            <div className="flex items-center justify-between border-b border-blue-200 dark:border-blue-900 pb-2">
              <div className="flex items-center space-x-2">
                <Factory className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                <span className="font-bold text-sm text-slate-900 dark:text-white">Make</span>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-slate-400">Unit Cost</div>
                <div className="text-base font-extrabold text-blue-600 dark:text-sky-400 font-mono">
                  {formatCurrency(makeUnitCost, currency)}
                </div>
              </div>
            </div>

            {/* Materials */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  Materials ({formatCurrency(totalMaterialsCost, currency)})
                </span>
                <button
                  type="button"
                  onClick={handleAddMaterial}
                  className="text-blue-600 dark:text-sky-400 font-bold hover:underline inline-flex items-center gap-0.5 cursor-pointer text-xs"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {materials.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                    <input
                      type="text"
                      placeholder="Material"
                      value={m.name}
                      onChange={e => handleUpdateMaterial(idx, 'name', e.target.value)}
                      className="flex-1 bg-transparent border-b border-slate-200 dark:border-slate-700 px-1 py-0.5 text-xs"
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      value={m.quantity}
                      onChange={e => handleUpdateMaterial(idx, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-12 bg-transparent border-b border-slate-200 dark:border-slate-700 px-1 py-0.5 text-right font-mono text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Unit"
                      value={m.unit}
                      onChange={e => handleUpdateMaterial(idx, 'unit', e.target.value)}
                      className="w-10 bg-transparent border-b border-slate-200 dark:border-slate-700 px-1 py-0.5 text-center text-xs"
                    />
                    <input
                      type="number"
                      placeholder="Rate"
                      value={m.unitCost}
                      onChange={e => handleUpdateMaterial(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                      className="w-16 bg-transparent border-b border-slate-200 dark:border-slate-700 px-1 py-0.5 text-right font-mono text-xs"
                    />
                    <span className="w-16 text-right font-bold font-mono text-[11px] text-slate-700 dark:text-slate-300">
                      {formatCurrency(m.totalCost, currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMaterial(idx)}
                      className="text-rose-400 hover:text-rose-600 p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Labor */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  Labor ({formatCurrency(totalLaborCost, currency)})
                </span>
                <button
                  type="button"
                  onClick={handleAddLabor}
                  className="text-blue-600 dark:text-sky-400 font-bold hover:underline inline-flex items-center gap-0.5 cursor-pointer text-xs"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {labors.map((l, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                    <input
                      type="text"
                      placeholder="Trade"
                      value={l.trade}
                      onChange={e => handleUpdateLabor(idx, 'trade', e.target.value)}
                      className="flex-1 bg-transparent border-b border-slate-200 dark:border-slate-700 px-1 py-0.5 text-xs"
                    />
                    <input
                      type="number"
                      placeholder="Hours"
                      value={l.hours}
                      onChange={e => handleUpdateLabor(idx, 'hours', parseFloat(e.target.value) || 0)}
                      className="w-12 bg-transparent border-b border-slate-200 dark:border-slate-700 px-1 py-0.5 text-right font-mono text-xs"
                    />
                    <span className="text-[11px] text-slate-400">hrs @</span>
                    <input
                      type="number"
                      placeholder="Rate"
                      value={l.hourlyRate}
                      onChange={e => handleUpdateLabor(idx, 'hourlyRate', parseFloat(e.target.value) || 0)}
                      className="w-16 bg-transparent border-b border-slate-200 dark:border-slate-700 px-1 py-0.5 text-right font-mono text-xs"
                    />
                    <span className="w-16 text-right font-bold font-mono text-[11px] text-slate-700 dark:text-slate-300">
                      {formatCurrency(l.totalCost, currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLabor(idx)}
                      className="text-rose-400 hover:text-rose-600 p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Subcontractor Services Attached to Manufacturing */}
            <div className="space-y-1.5 pt-1 border-t border-blue-200 dark:border-blue-900/60">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  Services ({formatCurrency(totalSubServicesCost, currency)})
                </span>
                <button
                  type="button"
                  onClick={handleAddSubService}
                  className="text-amber-600 dark:text-amber-400 font-bold hover:underline inline-flex items-center gap-0.5 cursor-pointer text-xs"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {subServices.map((sc, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 bg-amber-500/10 dark:bg-amber-950/20 p-1.5 rounded-lg border border-amber-300/60 dark:border-amber-800/60 text-xs">
                    <input
                      type="text"
                      placeholder="Service"
                      value={sc.serviceName}
                      onChange={e => handleUpdateSubService(idx, 'serviceName', e.target.value)}
                      className="flex-1 bg-transparent border-b border-amber-300 dark:border-amber-700 px-1 py-0.5 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Partner"
                      value={sc.subcontractorName}
                      onChange={e => handleUpdateSubService(idx, 'subcontractorName', e.target.value)}
                      className="w-20 bg-transparent border-b border-amber-300 dark:border-amber-700 px-1 py-0.5 text-xs"
                    />
                    <select
                      value={sc.chargeType}
                      onChange={e => handleUpdateSubService(idx, 'chargeType', e.target.value as any)}
                      className="w-16 bg-transparent border-b border-amber-300 dark:border-amber-700 text-[10px]"
                    >
                      <option value="per_unit">Unit</option>
                      <option value="total_fixed">Fixed</option>
                    </select>
                    <input
                      type="number"
                      placeholder="Rate"
                      value={sc.rate ?? sc.unitRate}
                      onChange={e => handleUpdateSubService(idx, 'rate', parseFloat(e.target.value) || 0)}
                      className="w-16 bg-transparent border-b border-amber-300 dark:border-amber-700 px-1 py-0.5 text-right font-mono text-xs"
                    />
                    <span className="w-16 text-right font-bold font-mono text-[11px] text-amber-700 dark:text-amber-300">
                      {formatCurrency(sc.totalCost, currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubService(idx)}
                      className="text-rose-400 hover:text-rose-600 p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Overheads & Lead Time */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-blue-200 dark:border-blue-900/60 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                  Overhead %
                </label>
                <input
                  type="number"
                  value={inHouseOverheadPct}
                  onChange={e => setInHouseOverheadPct(Number(e.target.value) || 0)}
                  className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                  Lead Days
                </label>
                <input
                  type="number"
                  value={inHouseLeadTimeDays}
                  onChange={e => setInHouseLeadTimeDays(Number(e.target.value) || 1)}
                  className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs"
                />
              </div>
            </div>

            <div className="pt-1 flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 border-t border-blue-200 dark:border-blue-900/60">
              <span>Total Make</span>
              <span className="font-mono text-blue-600 dark:text-sky-400">{formatCurrency(totalMakeCost, currency)}</span>
            </div>
          </div>

          {/* BUY COLUMN */}
          <div className="p-4 rounded-xl border-2 border-amber-200 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/20 space-y-3">
            <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-900 pb-2">
              <div className="flex items-center space-x-2">
                <Truck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="font-bold text-sm text-slate-900 dark:text-white">Buy</span>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-slate-400">Unit Rate</div>
                <div className="text-base font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                  {formatCurrency(buyUnitCost, currency)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                  Partner
                </label>
                <input
                  type="text"
                  value={subName}
                  onChange={e => setSubName(e.target.value)}
                  className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                  Trade
                </label>
                <input
                  type="text"
                  value={subTrade}
                  onChange={e => setSubTrade(e.target.value)}
                  className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                  Rate
                </label>
                <input
                  type="number"
                  value={subUnitRate}
                  onChange={e => setSubUnitRate(Number(e.target.value) || 0)}
                  className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                  Logistics
                </label>
                <input
                  type="number"
                  value={subLogisticsCost}
                  onChange={e => setSubLogisticsCost(Number(e.target.value) || 0)}
                  className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                  Lead Days
                </label>
                <input
                  type="number"
                  value={subLeadTimeDays}
                  onChange={e => setSubLeadTimeDays(Number(e.target.value) || 1)}
                  className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                  Warranty
                </label>
                <input
                  type="text"
                  value={subWarranty}
                  onChange={e => setSubWarranty(e.target.value)}
                  className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="pt-8 flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 border-t border-amber-200 dark:border-amber-900/60">
              <span>Total Buy</span>
              <span className="font-mono text-amber-600 dark:text-amber-400">{formatCurrency(totalBuyCost, currency)}</span>
            </div>
          </div>
        </div>

        {/* Row 3: Result & Decision Panel - Clean One-Word Buttons */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-400">Savings</span>
              <div className={`text-base font-extrabold font-mono ${costDifference >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {costDifference >= 0 ? '+' : ''}{formatCurrency(costDifference, currency)} ({savingsPct}%)
              </div>
            </div>

            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-400">Recommendation</span>
              <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-sky-300">
                {recommendedDecision}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-400">Lead Delta</span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {inHouseLeadTimeDays}d vs {subLeadTimeDays}d
              </span>
            </div>
          </div>

          {/* Decision Selection Chips */}
          <div className="flex items-center space-x-1.5 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setSelectedDecision('manufacture')}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                selectedDecision === 'manufacture'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Make
            </button>
            <button
              type="button"
              onClick={() => setSelectedDecision('subcontract')}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                selectedDecision === 'subcontract'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => setSelectedDecision('hybrid')}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                selectedDecision === 'hybrid'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Hybrid
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
