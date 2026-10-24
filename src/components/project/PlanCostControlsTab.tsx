import React, { useState, useEffect, useMemo } from 'react';
import {
  SlidersHorizontal,
  Lock,
  Unlock,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Percent,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Edit,
  Save,
  X,
  Search,
  Filter,
  Layers,
  History,
  Tag,
  Clock,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency, getStoredCurrency } from '../../utils/currency';
import { round2 } from '../../utils/decimalMath';

interface PlanCostControlsTabProps {
  planId: string;
  projectId?: string;
  planName?: string;
  planNumber?: string;
  currency?: string;
  onCostControlsUpdated?: () => void;
  showToast?: (msg: string | { message: string; type?: string }) => void;
}

export const PlanCostControlsTab: React.FC<PlanCostControlsTabProps> = ({
  planId,
  projectId,
  planName,
  planNumber,
  currency,
  onCostControlsUpdated,
  showToast
}) => {
  const [controls, setControls] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditingCaps, setIsEditingCaps] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lineFilter, setLineFilter] = useState<'all' | 'material' | 'labour' | 'equipment' | 'subcontractor' | 'overhead'>('all');
  const [showAuditTrail, setShowAuditTrail] = useState(false);

  // Form state for editing ceilings and caps
  const [form, setForm] = useState({
    budgetCeiling: 0,
    targetCost: 0,
    materialCostCap: 0,
    laborCostCap: 0,
    equipmentCostCap: 0,
    subcontractorCostCap: 0,
    overheadCostCap: 0,
    contingencyCap: 0,
    targetMarginPct: 25,
    overheadPct: 8.5,
    contingencyPct: 5.0,
    costStage: 'Budget',
    costNotes: ''
  });

  const activeCurrency = currency || controls?.currency || getStoredCurrency() || 'LKR';

  const loadCostControls = async () => {
    if (!planId) return;
    setLoading(true);
    try {
      const data = await api.getPlanCostControls(planId);
      setControls(data);
      setForm({
        budgetCeiling: Number(data.budgetCeiling || 0),
        targetCost: Number(data.targetCost || 0),
        materialCostCap: Number(data.breakdown?.materials?.cap || 0),
        laborCostCap: Number(data.breakdown?.labor?.cap || 0),
        equipmentCostCap: Number(data.breakdown?.equipment?.cap || 0),
        subcontractorCostCap: Number(data.breakdown?.subcontractors?.cap || 0),
        overheadCostCap: Number(data.breakdown?.overheads?.cap || 0),
        contingencyCap: Number(data.contingencyCap || 0),
        targetMarginPct: Number(data.targetMarginPct || 25),
        overheadPct: Number(data.overheadPct || 8.5),
        contingencyPct: Number(data.contingencyPct || 5.0),
        costStage: data.costStage || 'Budget',
        costNotes: data.costNotes || ''
      });
    } catch (e: any) {
      console.warn('Could not load plan cost controls:', e);
      showToast?.({ message: 'Error loading plan cost controls', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCostControls();
  }, [planId]);

  const handleSaveCaps = async () => {
    setSaving(true);
    try {
      const updated = await api.updatePlanCostControls(planId, {
        budgetCeiling: Number(form.budgetCeiling),
        targetCost: Number(form.targetCost),
        materialCostCap: Number(form.materialCostCap),
        laborCostCap: Number(form.laborCostCap),
        equipmentCostCap: Number(form.equipmentCostCap),
        subcontractorCostCap: Number(form.subcontractorCostCap),
        overheadCostCap: Number(form.overheadCostCap),
        contingencyCap: Number(form.contingencyCap),
        targetMarginPct: Number(form.targetMarginPct),
        overheadPct: Number(form.overheadPct),
        contingencyPct: Number(form.contingencyPct),
        costStage: form.costStage,
        costNotes: form.costNotes,
        reason: 'Updated budget ceilings and category cost limits in PostgreSQL'
      });
      setControls(updated);
      setIsEditingCaps(false);
      onCostControlsUpdated?.();
      showToast?.({ message: 'Cost controls saved in PostgreSQL', type: 'success' });
    } catch (e: any) {
      showToast?.({ message: e?.message || 'Failed to save cost controls', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (action: string, payload?: any) => {
    setSaving(true);
    try {
      const updated = await api.applyPlanCostControlAction(planId, action, payload);
      setControls(updated);
      onCostControlsUpdated?.();
      showToast?.({ message: 'Cost control action applied and logged', type: 'success' });
    } catch (e: any) {
      showToast?.({ message: e?.message || 'Action failed', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Filter cost lines
  const filteredLines = useMemo(() => {
    if (!controls?.costLines) return [];
    let lines = controls.costLines as any[];

    if (lineFilter !== 'all') {
      lines = lines.filter((l) => {
        const it = String(l.itemType || '').toLowerCase();
        if (lineFilter === 'material') return it === 'material' || it === 'produce';
        if (lineFilter === 'labour') return it === 'labour' || it === 'labor';
        if (lineFilter === 'equipment') return it === 'equipment' || it === 'machinery' || it === 'tool';
        if (lineFilter === 'subcontractor') return it === 'subcontractor' || it === 'outsourced';
        if (lineFilter === 'overhead') return it === 'overhead';
        return true;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      lines = lines.filter(
        (l) =>
          l.name?.toLowerCase().includes(q) ||
          l.code?.toLowerCase().includes(q) ||
          l.category?.toLowerCase().includes(q) ||
          l.supplierOrProvider?.toLowerCase().includes(q)
      );
    }

    return lines;
  }, [controls?.costLines, lineFilter, searchQuery]);

  if (loading && !controls) {
    return (
      <div className="bg-white dark:bg-[#0b101b] p-8 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#0078d4] mb-2" />
        <span>Loading Cost Controls from PostgreSQL...</span>
      </div>
    );
  }

  const isFrozen = controls?.freezeCostLines;
  const isEscalationLocked = controls?.escalationLock;
  const ceilingVariance = controls?.ceilingVariance || 0;
  const isOverBudget = ceilingVariance < 0;

  return (
    <div className="space-y-4">
      {/* 1. TOP CONTROL BAR */}
      <div className="bg-white dark:bg-[#0b101b] p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-[#0078d4]/10 text-[#0078d4]">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Cost Controls</h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-[#0078d4] dark:text-sky-400 font-bold border border-blue-200 dark:border-blue-800">
                  {controls?.planNumber || planNumber || 'PLN-01'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    isFrozen
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                  }`}
                >
                  {isFrozen ? 'Frozen' : 'Active'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                  Stage: {controls?.costStage || 'Budget'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                PostgreSQL Plan Cost Ceilings, Variance Control & Category Limits
              </p>
            </div>
          </div>

          {/* One-Word Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {isFrozen ? (
              <button
                type="button"
                onClick={() => handleAction('unfreeze_all')}
                disabled={saving}
                className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
                title="Unlock cost lines for editing"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Unlock</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleAction('freeze_all')}
                disabled={saving}
                className="flex items-center space-x-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
                title="Freeze all cost lines against modifications"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Freeze</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleAction(isEscalationLocked ? 'unlock_escalation' : 'lock_escalation')}
              disabled={saving}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs border transition-colors ${
                isEscalationLocked
                  ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
              title="Toggle rate escalation lock against price creep"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isEscalationLocked ? 'Escalation Locked' : 'Lock Escalation'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleAction('apply_savings_target', { discountPct: 5 })}
              disabled={saving}
              className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
              title="Apply 5% value engineering target savings"
            >
              <TrendingDown className="w-3.5 h-3.5 text-indigo-600" />
              <span>-5% Savings</span>
            </button>

            <button
              type="button"
              onClick={() => setIsEditingCaps(!isEditingCaps)}
              className="flex items-center space-x-1 px-3 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white rounded-lg text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>{isEditingCaps ? 'Close Caps' : 'Edit Caps'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAuditTrail(!showAuditTrail)}
              className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200 transition-colors"
              title="View cost control audit logs"
            >
              <History className="w-3.5 h-3.5" />
              <span>Audit</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. COST TELEMETRY STRIP (5 Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Metric 1: Planned Direct Cost */}
        <div className="bg-white dark:bg-[#0b101b] p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Planned Direct Cost</span>
          <div className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
            {formatCurrency(controls?.directCostPlanned || 0, activeCurrency)}
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">Materials + Labour + Equipment</span>
        </div>

        {/* Metric 2: Total Planned Cost */}
        <div className="bg-white dark:bg-[#0b101b] p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Planned Cost</span>
          <div className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
            {formatCurrency(controls?.totalPlannedCost || 0, activeCurrency)}
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">Includes Overheads & Tariffs</span>
        </div>

        {/* Metric 3: Budget Ceiling & Variance */}
        <div
          className={`p-3 rounded-xl border shadow-2xs ${
            isOverBudget
              ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900'
              : 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Budget Ceiling</span>
            {isOverBudget ? (
              <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded">Over</span>
            ) : (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">Safe</span>
            )}
          </div>
          <div className="text-base font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5">
            {formatCurrency(controls?.budgetCeiling || 0, activeCurrency)}
          </div>
          <div className="text-[11px] font-mono mt-1 font-semibold flex items-center space-x-1">
            <span className={isOverBudget ? 'text-rose-600' : 'text-emerald-600'}>
              {ceilingVariance >= 0 ? '+' : ''}{formatCurrency(ceilingVariance, activeCurrency)}
            </span>
            <span className="text-slate-400 text-[10px]">({controls?.ceilingVariancePct || 0}%)</span>
          </div>
        </div>

        {/* Metric 4: Target Cost */}
        <div className="bg-white dark:bg-[#0b101b] p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Target Cost</span>
          <div className="text-base font-bold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
            {formatCurrency(controls?.targetCost || 0, activeCurrency)}
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">
            Target Margin: <strong>{controls?.targetMarginPct || 25}%</strong>
          </span>
        </div>

        {/* Metric 5: Committed Savings */}
        <div className="bg-white dark:bg-[#0b101b] p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Committed Savings</span>
          <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
            {formatCurrency(controls?.committedSavings || 0, activeCurrency)}
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">Value Engineering Reductions</span>
        </div>
      </div>

      {/* 3. CATEGORY COST CAPS & LIMITS MATRIX (5 Pillars) */}
      <div className="bg-white dark:bg-[#0b101b] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Tag className="w-3.5 h-3.5 text-[#0078d4]" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Category Budget Caps</h4>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">PostgreSQL Enforced Ceilings</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            {
              label: 'Materials',
              planned: controls?.breakdown?.materials?.planned || 0,
              cap: controls?.breakdown?.materials?.cap || 0,
              variance: controls?.breakdown?.materials?.variance || 0
            },
            {
              label: 'Labour',
              planned: controls?.breakdown?.labor?.planned || 0,
              cap: controls?.breakdown?.labor?.cap || 0,
              variance: controls?.breakdown?.labor?.variance || 0
            },
            {
              label: 'Equipment',
              planned: controls?.breakdown?.equipment?.planned || 0,
              cap: controls?.breakdown?.equipment?.cap || 0,
              variance: controls?.breakdown?.equipment?.variance || 0
            },
            {
              label: 'Subcontractors',
              planned: controls?.breakdown?.subcontractors?.planned || 0,
              cap: controls?.breakdown?.subcontractors?.cap || 0,
              variance: controls?.breakdown?.subcontractors?.variance || 0
            },
            {
              label: 'Overheads',
              planned: controls?.breakdown?.overheads?.planned || 0,
              cap: controls?.breakdown?.overheads?.cap || 0,
              variance: controls?.breakdown?.overheads?.variance || 0
            }
          ].map((cat) => {
            const pct = cat.cap > 0 ? Math.min(100, Math.round((cat.planned / cat.cap) * 100)) : 0;
            const isOver = cat.variance < 0;

            return (
              <div key={cat.label} className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{cat.label}</span>
                  <span className={`font-mono text-[10px] font-bold ${isOver ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {isOver ? 'Over Cap' : 'Under Cap'}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1 text-[11px] font-mono">
                  <span className="text-slate-600 dark:text-slate-400">Planned: {formatCurrency(cat.planned, activeCurrency)}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-500">Cap: {formatCurrency(cat.cap, activeCurrency)}</span>
                  <span className={isOver ? 'text-rose-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                    {cat.variance >= 0 ? '+' : ''}{formatCurrency(cat.variance, activeCurrency)}
                  </span>
                </div>
                {/* Progress track */}
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isOver ? 'bg-rose-500' : pct > 85 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. EDIT CEILINGS & CAPS PANEL */}
      {isEditingCaps && (
        <div className="bg-white dark:bg-[#0b101b] p-4 rounded-xl border border-[#0078d4] shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center space-x-2">
              <Edit className="w-4 h-4 text-[#0078d4]" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Edit Budget Ceilings & Control Limits</h4>
            </div>
            <button
              type="button"
              onClick={() => setIsEditingCaps(false)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Overall Budget Ceiling ({activeCurrency})</label>
              <input
                type="number"
                value={form.budgetCeiling}
                onChange={(e) => setForm({ ...form, budgetCeiling: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Target Cost Cap ({activeCurrency})</label>
              <input
                type="number"
                value={form.targetCost}
                onChange={(e) => setForm({ ...form, targetCost: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Materials Cap ({activeCurrency})</label>
              <input
                type="number"
                value={form.materialCostCap}
                onChange={(e) => setForm({ ...form, materialCostCap: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Labour Cap ({activeCurrency})</label>
              <input
                type="number"
                value={form.laborCostCap}
                onChange={(e) => setForm({ ...form, laborCostCap: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Equipment Cap ({activeCurrency})</label>
              <input
                type="number"
                value={form.equipmentCostCap}
                onChange={(e) => setForm({ ...form, equipmentCostCap: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Subcontractors Cap ({activeCurrency})</label>
              <input
                type="number"
                value={form.subcontractorCostCap}
                onChange={(e) => setForm({ ...form, subcontractorCostCap: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Overhead Cap ({activeCurrency})</label>
              <input
                type="number"
                value={form.overheadCostCap}
                onChange={(e) => setForm({ ...form, overheadCostCap: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Cost Stage</label>
              <select
                value={form.costStage}
                onChange={(e) => setForm({ ...form, costStage: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs font-semibold"
              >
                <option value="Preliminary">Preliminary</option>
                <option value="Target">Target</option>
                <option value="Budget">Budget</option>
                <option value="Committed">Committed</option>
                <option value="Actual">Actual</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditingCaps(false)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveCaps}
              disabled={saving}
              className="px-4 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white text-xs font-semibold rounded cursor-pointer transition-colors shadow-2xs"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* 5. AUDIT TRAIL COLLAPSIBLE DRAWER */}
      {showAuditTrail && (
        <div className="bg-white dark:bg-[#0b101b] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center space-x-2">
              <History className="w-4 h-4 text-[#0078d4]" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Cost Control Audit Logs</h4>
            </div>
            <button
              type="button"
              onClick={() => setShowAuditTrail(false)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              Close
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
            {controls?.auditTrail && controls.auditTrail.length > 0 ? (
              controls.auditTrail.map((log: any, idx: number) => (
                <div key={idx} className="py-1.5 flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{log.action || 'UPDATE'}:</span>{' '}
                    <span className="text-slate-600 dark:text-slate-400">{log.details}</span>
                  </div>
                  <div className="text-slate-400 text-[10px] shrink-0">
                    <span>{log.actor || 'User'}</span> • <span>{String(log.date || '').slice(0, 16).replace('T', ' ')}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-3 text-center text-slate-400">No audit events recorded yet.</div>
            )}
          </div>
        </div>
      )}

      {/* 6. ALL COST LINES CONTROL TABLE */}
      <div className="bg-white dark:bg-[#0b101b] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        {/* Table Filters & Search */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: 'all', label: 'All' },
              { id: 'material', label: 'Materials' },
              { id: 'labour', label: 'Labour' },
              { id: 'equipment', label: 'Equipment' },
              { id: 'subcontractor', label: 'Subcontractors' },
              { id: 'overhead', label: 'Overheads' }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setLineFilter(t.id as any)}
                className={`px-2.5 py-1 text-xs rounded font-semibold cursor-pointer transition-colors ${
                  lineFilter === t.id
                    ? 'bg-[#0078d4] text-white shadow-2xs'
                    : 'bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search plan lines..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0078d4]"
              />
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {filteredLines.length} Lines
            </span>
          </div>
        </div>

        {/* FXTT Cost Lines Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 font-semibold text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Code</th>
                <th className="py-2.5 px-3">Item / Description</th>
                <th className="py-2.5 px-3">Provider / Trade</th>
                <th className="py-2.5 px-3 text-right">Quantity</th>
                <th className="py-2.5 px-3">Unit</th>
                <th className="py-2.5 px-3 text-right">Unit Rate</th>
                <th className="py-2.5 px-3 text-right">Total Cost</th>
                <th className="py-2.5 px-3 text-center">Stage</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
              {filteredLines.map((line: any, idx: number) => {
                return (
                  <tr
                    key={line.id || idx}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors"
                  >
                    <td className="py-2 px-3 font-semibold text-slate-500 uppercase text-[10px]">
                      {line.itemType || line.category}
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-[#0078d4]">
                      {line.code || `LINE-${idx + 1}`}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100 max-w-xs truncate">
                      {line.name}
                    </td>
                    <td className="py-2 px-3 text-slate-500 max-w-[150px] truncate">
                      {line.supplierOrProvider || line.roleOrTrade || 'Internal'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-medium">
                      {line.quantity}
                    </td>
                    <td className="py-2 px-3 text-slate-500 text-[10px]">
                      {line.unit}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                      {formatCurrency(line.unitCost, activeCurrency)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(line.totalCost, activeCurrency)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                        {line.costStage || 'Budget'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      {isFrozen ? (
                        <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded text-[10px] bg-amber-50 text-amber-800 font-semibold">
                          <Lock className="w-2.5 h-2.5 text-amber-600" />
                          <span>Frozen</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded text-[10px] bg-emerald-50 text-emerald-800 font-semibold">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                          <span>Active</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredLines.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400 font-sans">
                    No cost items found for the selected category.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
