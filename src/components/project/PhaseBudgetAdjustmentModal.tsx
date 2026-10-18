import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Layers,
  Wrench,
  Boxes,
  CheckCircle2,
  Sliders,
  DollarSign,
  TrendingDown,
  Percent,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { Project, ProjectPhase, ProjectCostItem, MaterialItem, SubcontractorRateItem } from '../../types';
import { PhaseWarningSummary, ItemWarningAnalysis } from '../../utils/budgetWarningEngine';
import { formatCurrency } from '../../utils/currency';

interface PhaseBudgetAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  phaseSummary: PhaseWarningSummary | null;
  onUpdateProject: (updatedProject: Project) => void;
  materials?: MaterialItem[];
  subcontractors?: SubcontractorRateItem[];
  onShowToast?: (msg: string) => void;
}

export const PhaseBudgetAdjustmentModal: React.FC<PhaseBudgetAdjustmentModalProps> = ({
  isOpen,
  onClose,
  project,
  phaseSummary,
  onUpdateProject,
  materials = [],
  subcontractors = [],
  onShowToast
}) => {
  if (!isOpen || !phaseSummary) return null;

  const currency = project.currency || 'USD';
  const targetPhase = project.phases?.find((p) => p.id === phaseSummary.phaseId);

  // Editable Phase Budgets
  const [materialBudget, setMaterialBudget] = useState<number>(
    targetPhase?.materialBudget ?? phaseSummary.materialBudget ?? Math.round((phaseSummary.budget || 0) * 0.5)
  );
  const [laborBudget, setLaborBudget] = useState<number>(
    targetPhase?.laborBudget ?? phaseSummary.laborBudget ?? Math.round((phaseSummary.budget || 0) * 0.5)
  );
  const [totalPhaseBudget, setTotalPhaseBudget] = useState<number>(
    targetPhase?.budget ?? phaseSummary.budget ?? 0
  );

  // Editable phase item adjustments (itemId -> { consumptionRate, discountPct, unitCost })
  const phaseItems = (project.selectedItems || []).filter((i) => i.phaseId === phaseSummary.phaseId);
  const [itemModifications, setItemModifications] = useState<
    Record<string, { consumptionRate: number; discountPct: number; unitCost: number }>
  >(() => {
    const init: Record<string, { consumptionRate: number; discountPct: number; unitCost: number }> = {};
    phaseItems.forEach((i) => {
      init[i.id] = {
        consumptionRate: i.consumptionRate || 100,
        discountPct: i.discountPct || 0,
        unitCost: i.unitCost || 0
      };
    });
    return init;
  });

  const [activeTab, setActiveTab] = useState<'budget' | 'items' | 'quick_fixes'>('quick_fixes');

  // Handle Quick Fix: Normalize All Consumption Rates to 100%
  const handleNormalizeConsumption = () => {
    setItemModifications((prev) => {
      const next = { ...prev };
      phaseItems.forEach((i) => {
        if (next[i.id]) {
          next[i.id].consumptionRate = 100;
        }
      });
      return next;
    });
    if (onShowToast) {
      onShowToast(`Normalized consumption rates for ${phaseSummary.phaseName} to baseline 100%.`);
    }
  };

  // Handle Quick Fix: Apply 7% Enterprise Vendor Rebate to Material Items
  const handleApplyMaterialDiscount = () => {
    setItemModifications((prev) => {
      const next = { ...prev };
      phaseItems.forEach((i) => {
        if (i.type === 'material' && next[i.id]) {
          next[i.id].discountPct = Math.max(next[i.id].discountPct, 7.5);
        }
      });
      return next;
    });
    if (onShowToast) {
      onShowToast(`Applied 7.5% volume discount to material items in ${phaseSummary.phaseName}.`);
    }
  };

  // Handle Quick Fix: Auto-Expand Phase Budget to Absorb Projected Cost
  const handleAutoAdjustBudget = () => {
    const neededMat = Math.ceil(phaseSummary.materialProjectedCost * 1.05);
    const neededLabor = Math.ceil(phaseSummary.laborProjectedCost * 1.05);
    setMaterialBudget(neededMat);
    setLaborBudget(neededLabor);
    setTotalPhaseBudget(neededMat + neededLabor);
    if (onShowToast) {
      onShowToast(`Expanded phase budget caps with 5% contingency buffer.`);
    }
  };

  // Save changes to Project
  const handleSaveAdjustments = () => {
    // 1. Update Project Phase
    const updatedPhases = (project.phases || []).map((p) => {
      if (p.id === phaseSummary.phaseId) {
        return {
          ...p,
          budget: totalPhaseBudget,
          plannedCost: totalPhaseBudget,
          materialBudget: materialBudget,
          laborBudget: laborBudget
        };
      }
      return p;
    });

    // 2. Update Items in phase
    const updatedItems = (project.selectedItems || []).map((item) => {
      if (item.phaseId === phaseSummary.phaseId && itemModifications[item.id]) {
        const mod = itemModifications[item.id];
        const factor = 1 - (mod.discountPct || 0) / 100;
        const newTotal = (item.quantity || 1) * mod.unitCost * factor;
        const newProjected = newTotal * ((mod.consumptionRate || 100) / 100);
        return {
          ...item,
          consumptionRate: mod.consumptionRate,
          discountPct: mod.discountPct,
          unitCost: mod.unitCost,
          totalCost: newTotal,
          projectedCost: newProjected
        };
      }
      return item;
    });

    const updatedProject: Project = {
      ...project,
      phases: updatedPhases,
      selectedItems: updatedItems
    };

    onUpdateProject(updatedProject);
    if (onShowToast) {
      onShowToast(`Proactive adjustments successfully applied to ${phaseSummary.phaseName}.`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-950/70 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300">
                  {phaseSummary.healthLabel}
                </span>
                <span className="text-xs text-slate-500 font-mono">{project.code}</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                Proactive Adjustments: {phaseSummary.phaseName}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Cost Overrun Telemetry Cards */}
        <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-red-50/40 dark:bg-red-950/20 border-b border-slate-200 dark:border-slate-800 shrink-0">
          {/* Material Overrun Card */}
          <div
            className={`p-3.5 rounded-xl border ${
              phaseSummary.isMaterialOverrun
                ? 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-900'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center space-x-1.5">
                <Boxes className="w-4 h-4 text-amber-500" />
                <span>Material Cost Status</span>
              </span>
              {phaseSummary.isMaterialOverrun ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-600 text-white">
                  Overrun +{formatCurrency(phaseSummary.materialOverrunAmount, currency)}
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Within Budget
                </span>
              )}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Budget Cap</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">
                  {formatCurrency(phaseSummary.materialBudget, currency)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Projected Cost</span>
                <span
                  className={`font-bold font-mono ${
                    phaseSummary.isMaterialOverrun ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {formatCurrency(phaseSummary.materialProjectedCost, currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Labor / Subcontractor Overrun Card */}
          <div
            className={`p-3.5 rounded-xl border ${
              phaseSummary.isLaborOverrun
                ? 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-900'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center space-x-1.5">
                <Wrench className="w-4 h-4 text-purple-500" />
                <span>Labor / Subcontractor Status</span>
              </span>
              {phaseSummary.isLaborOverrun ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-600 text-white">
                  Overrun +{formatCurrency(phaseSummary.laborOverrunAmount, currency)}
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Within Budget
                </span>
              )}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Budget Cap</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">
                  {formatCurrency(phaseSummary.laborBudget, currency)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Projected Cost</span>
                <span
                  className={`font-bold font-mono ${
                    phaseSummary.isLaborOverrun ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {formatCurrency(phaseSummary.laborProjectedCost, currency)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('quick_fixes')}
            className={`px-3 py-1.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'quick_fixes'
                ? 'border-[#0078d4] text-[#0078d4] dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 inline mr-1" />
            1-Click Proactive Actions
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={`px-3 py-1.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'items'
                ? 'border-[#0078d4] text-[#0078d4] dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 inline mr-1" />
            Item Rates &amp; Consumption ({phaseItems.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('budget')}
            className={`px-3 py-1.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'budget'
                ? 'border-[#0078d4] text-[#0078d4] dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 inline mr-1" />
            Phase Budget Caps
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: 1-Click Proactive Actions */}
          {activeTab === 'quick_fixes' && (
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block uppercase tracking-wider">
                Automated Remediation Actions
              </span>

              {/* Action 1: Normalize Burn Rate */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4 text-emerald-600" />
                    <span>Normalize Elevated Consumption Burn Rate to 100%</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Resets accelerated pace multipliers on over-consuming materials and labor to standard baseline.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleNormalizeConsumption}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer shrink-0 shadow-2xs"
                >
                  Apply 100% Pace
                </button>
              </div>

              {/* Action 2: Vendor Volume Discount */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Percent className="w-4 h-4 text-blue-600" />
                    <span>Apply 7.5% Material Volume Rebate</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Simulates negotiated tier rebate on high-cost aerospace titanium and structural plate supplies.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleApplyMaterialDiscount}
                  className="px-3 py-1.5 bg-[#0078d4] hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer shrink-0 shadow-2xs"
                >
                  Apply 7.5% Discount
                </button>
              </div>

              {/* Action 3: Auto-Expand Phase Budget Buffer */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-purple-600" />
                    <span>Auto-Adjust Phase Budget Caps (+5% Contingency)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Expands Material &amp; Labor budget caps to fully cover current consumption with a 5% safety margin.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAutoAdjustBudget}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg cursor-pointer shrink-0 shadow-2xs"
                >
                  Reallocate Budget
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Item Rates & Consumption Rates */}
          {activeTab === 'items' && (
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block uppercase tracking-wider">
                Phase Cost Items Breakdown
              </span>

              <div className="space-y-2">
                {phaseItems.map((item) => {
                  const mod = itemModifications[item.id] || {
                    consumptionRate: item.consumptionRate || 100,
                    discountPct: item.discountPct || 0,
                    unitCost: item.unitCost || 0
                  };

                  const isMaterial = item.type === 'material';
                  const isLabor = item.type === 'subcontractor';

                  return (
                    <div
                      key={item.id}
                      className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isMaterial
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : isLabor
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {isMaterial ? 'Material' : isLabor ? 'Labor' : 'Outsourced'}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">{item.name}</span>
                          <span className="text-slate-400 font-mono">({item.supplierOrProvider})</span>
                        </div>

                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          Qty: {item.quantity} {item.unit}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                            Unit Cost ({currency})
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={mod.unitCost}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setItemModifications((prev) => ({
                                ...prev,
                                [item.id]: { ...mod, unitCost: val }
                              }));
                            }}
                            className="w-full px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                            Burn Pace / Consumption Rate (%)
                          </label>
                          <input
                            type="number"
                            min="50"
                            max="300"
                            value={mod.consumptionRate}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 100;
                              setItemModifications((prev) => ({
                                ...prev,
                                [item.id]: { ...mod, consumptionRate: val }
                              }));
                            }}
                            className="w-full px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono font-bold text-red-600 dark:text-red-400"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                            Discount (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={mod.discountPct}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setItemModifications((prev) => ({
                                ...prev,
                                [item.id]: { ...mod, discountPct: val }
                              }));
                            }}
                            className="w-full px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: Phase Budget Caps */}
          {activeTab === 'budget' && (
            <div className="space-y-4">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block uppercase tracking-wider">
                Phase Budget Caps ({currency})
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-900 dark:text-white">
                    <Boxes className="w-4 h-4 text-amber-500" />
                    <span>Material Budget Allocation</span>
                  </div>
                  <input
                    type="number"
                    value={materialBudget}
                    onChange={(e) => setMaterialBudget(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-bold font-mono text-slate-900 dark:text-white"
                  />
                  <p className="text-[11px] text-slate-400">
                    Current Projected: {formatCurrency(phaseSummary.materialProjectedCost, currency)}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-900 dark:text-white">
                    <Wrench className="w-4 h-4 text-purple-500" />
                    <span>Labor / Subcontractor Budget Allocation</span>
                  </div>
                  <input
                    type="number"
                    value={laborBudget}
                    onChange={(e) => setLaborBudget(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-bold font-mono text-slate-900 dark:text-white"
                  />
                  <p className="text-[11px] text-slate-400">
                    Current Projected: {formatCurrency(phaseSummary.laborProjectedCost, currency)}
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl text-xs flex items-center justify-between">
                <span className="font-bold text-blue-900 dark:text-blue-200">
                  Total Phase Budget Cap:
                </span>
                <span className="font-mono font-bold text-blue-900 dark:text-blue-200 text-sm">
                  {formatCurrency(materialBudget + laborBudget, currency)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveAdjustments}
            className="px-5 py-2 bg-[#0078d4] hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center space-x-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Apply Proactive Adjustments</span>
          </button>
        </div>

      </div>
    </div>
  );
};
