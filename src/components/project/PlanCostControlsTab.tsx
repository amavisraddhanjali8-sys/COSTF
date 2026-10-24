import React, { useState, useEffect, useMemo } from 'react';
import {
  SlidersHorizontal,
  Lock,
  Unlock,
  ShieldCheck,
  TrendingDown,
  RefreshCw,
  Edit,
  Save,
  X,
  Search,
  History,
  Tag,
  Plus,
  Trash2,
  Edit2,
  Check,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency, getStoredCurrency } from '../../utils/currency';
import { round2 } from '../../utils/decimalMath';
import { EnterpriseResource } from '../../types';
import { AddPlanResourceModal } from './AddPlanResourceModal';

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
  const [enterpriseResources, setEnterpriseResources] = useState<EnterpriseResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditingCaps, setIsEditingCaps] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lineFilter, setLineFilter] = useState<'all' | 'material' | 'labour' | 'equipment' | 'subcontractor' | 'overhead'>('all');
  const [showAuditTrail, setShowAuditTrail] = useState(false);

  // Resource modal state
  const [isAddResourceModalOpen, setIsAddResourceModalOpen] = useState(false);
  const [selectedResourceToEdit, setSelectedResourceToEdit] = useState<any | null>(null);

  // Inline editing state for cost lines
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [inlineForm, setInlineForm] = useState<{ quantity: number; unitCost: number }>({ quantity: 1, unitCost: 0 });

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
      const [data, resources] = await Promise.all([
        api.getPlanCostControls(planId),
        api.getResources().catch(() => [])
      ]);
      setControls(data);
      setEnterpriseResources(resources || []);
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
        reason: 'Updated budget ceilings and category cost limits'
      });
      setControls(updated);
      setIsEditingCaps(false);
      onCostControlsUpdated?.();
      showToast?.({ message: 'Saved', type: 'success' });
    } catch (e: any) {
      showToast?.({ message: e?.message || 'Failed to save', type: 'error' });
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
      showToast?.({ message: 'Applied', type: 'success' });
    } catch (e: any) {
      showToast?.({ message: e?.message || 'Action failed', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Start inline editing a line
  const handleStartInlineEdit = (line: any) => {
    setEditingLineId(line.id);
    setInlineForm({
      quantity: Number(line.quantity || 1),
      unitCost: Number(line.unitCost || 0)
    });
  };

  // Save inline edit
  const handleSaveInlineEdit = async (line: any) => {
    setSaving(true);
    try {
      const qty = Math.max(0, Number(inlineForm.quantity || 0));
      const rate = Math.max(0, Number(inlineForm.unitCost || 0));
      const total = round2(qty * rate);

      if (line.lineType === 'resource') {
        await api.updatePlanResource(planId, line.id, {
          allocatedHours: qty,
          hourlyRate: rate,
          totalCost: total
        });
      } else if (line.lineType === 'boq') {
        await api.updatePlanBoqItem(planId, line.id, {
          quantity: qty,
          unitCost: rate,
          totalCost: total
        });
      }

      setEditingLineId(null);
      await loadCostControls();
      onCostControlsUpdated?.();
      showToast?.({ message: 'Rate updated', type: 'success' });
    } catch (err: any) {
      showToast?.({ message: err?.message || 'Failed to update rate', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Delete line
  const handleDeleteLine = async (line: any) => {
    setSaving(true);
    try {
      if (line.lineType === 'resource') {
        await api.deletePlanResource(planId, line.id);
      } else if (line.lineType === 'boq') {
        await api.deletePlanBoqItem(planId, line.id);
      } else if (line.lineType === 'overhead') {
        await api.deletePlanOverheadAllocation(planId, line.id);
      }
      showToast?.({ message: 'Removed', type: 'info' });
      await loadCostControls();
      onCostControlsUpdated?.();
    } catch (err: any) {
      showToast?.({ message: err?.message || 'Failed to remove line', type: 'error' });
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
        <span>Loading...</span>
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
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Controls</h3>
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
                  {controls?.costStage || 'Budget'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Add Resource Button */}
            <button
              type="button"
              onClick={() => {
                setSelectedResourceToEdit(null);
                setIsAddResourceModalOpen(true);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white rounded-lg text-xs font-bold cursor-pointer shadow-2xs transition-colors"
              title="Add or assign a resource"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Resource</span>
            </button>

            {isFrozen ? (
              <button
                type="button"
                onClick={() => handleAction('unfreeze_all')}
                disabled={saving}
                className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
                title="Unlock"
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
                title="Freeze"
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
              title="Escalation Lock"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isEscalationLocked ? 'Locked' : 'Escalation'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleAction('apply_savings_target', { discountPct: 5 })}
              disabled={saving}
              className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
              title="Apply -5% Savings Target"
            >
              <TrendingDown className="w-3.5 h-3.5 text-indigo-600" />
              <span>-5% Savings</span>
            </button>

            <button
              type="button"
              onClick={() => setIsEditingCaps(!isEditingCaps)}
              className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>{isEditingCaps ? 'Close' : 'Caps'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAuditTrail(!showAuditTrail)}
              className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200 transition-colors"
              title="Audit"
            >
              <History className="w-3.5 h-3.5" />
              <span>Audit</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. SIMPLE COST METRICS (5 Minimal Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Direct */}
        <div className="bg-white dark:bg-[#0b101b] p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Direct</span>
          <div className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
            {formatCurrency(controls?.directCostPlanned || 0, activeCurrency)}
          </div>
        </div>

        {/* Cost */}
        <div className="bg-white dark:bg-[#0b101b] p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Cost</span>
          <div className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
            {formatCurrency(controls?.totalPlannedCost || 0, activeCurrency)}
          </div>
        </div>

        {/* Ceiling */}
        <div
          className={`p-3 rounded-xl border shadow-2xs ${
            isOverBudget
              ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900'
              : 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Ceiling</span>
            <span
              className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                isOverBudget ? 'text-rose-700 bg-rose-100' : 'text-emerald-700 bg-emerald-100'
              }`}
            >
              {isOverBudget ? 'Over' : 'Safe'}
            </span>
          </div>
          <div className="text-base font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5">
            {formatCurrency(controls?.budgetCeiling || 0, activeCurrency)}
          </div>
          <div className="text-[10px] font-mono mt-0.5 font-bold flex items-center space-x-1">
            <span className={isOverBudget ? 'text-rose-600' : 'text-emerald-600'}>
              {ceilingVariance >= 0 ? '+' : ''}
              {formatCurrency(ceilingVariance, activeCurrency)}
            </span>
          </div>
        </div>

        {/* Target */}
        <div className="bg-white dark:bg-[#0b101b] p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Target</span>
          <div className="text-base font-bold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
            {formatCurrency(controls?.targetCost || 0, activeCurrency)}
          </div>
        </div>

        {/* Savings */}
        <div className="bg-white dark:bg-[#0b101b] p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Savings</span>
          <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
            {formatCurrency(controls?.committedSavings || 0, activeCurrency)}
          </div>
        </div>
      </div>

      {/* 3. CATEGORY CAPS (5 Pillars) */}
      <div className="bg-white dark:bg-[#0b101b] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center space-x-2">
            <Tag className="w-3.5 h-3.5 text-[#0078d4]" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Category Caps</h4>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
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
              <div
                key={cat.label}
                className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{cat.label}</span>
                  <span className={`font-mono text-[9px] font-bold ${isOver ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {isOver ? 'Over' : 'Under'}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1 text-[11px] font-mono">
                  <span className="text-slate-600 dark:text-slate-400">
                    {formatCurrency(cat.planned, activeCurrency)}
                  </span>
                  <span className="text-slate-400">/ {formatCurrency(cat.cap, activeCurrency)}</span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isOver ? 'bg-rose-500' : pct > 85 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
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
        <div className="bg-white dark:bg-[#0b101b] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Edit Caps</h4>
            <button
              type="button"
              onClick={() => setIsEditingCaps(false)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Budget Ceiling</label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.budgetCeiling}
                onChange={(e) => setForm({ ...form, budgetCeiling: parseFloat(e.target.value) || 0 })}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Target Cost</label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.targetCost}
                onChange={(e) => setForm({ ...form, targetCost: parseFloat(e.target.value) || 0 })}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Materials Cap</label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.materialCostCap}
                onChange={(e) => setForm({ ...form, materialCostCap: parseFloat(e.target.value) || 0 })}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Labour Cap</label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.laborCostCap}
                onChange={(e) => setForm({ ...form, laborCostCap: parseFloat(e.target.value) || 0 })}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Equipment Cap</label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.equipmentCostCap}
                onChange={(e) => setForm({ ...form, equipmentCostCap: parseFloat(e.target.value) || 0 })}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Subcontractors Cap</label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.subcontractorCostCap}
                onChange={(e) => setForm({ ...form, subcontractorCostCap: parseFloat(e.target.value) || 0 })}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Overhead Cap</label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.overheadCostCap}
                onChange={(e) => setForm({ ...form, overheadCostCap: parseFloat(e.target.value) || 0 })}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Stage</label>
              <select
                value={form.costStage}
                onChange={(e) => setForm({ ...form, costStage: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <option value="Conceptual">Conceptual</option>
                <option value="Budget">Budget</option>
                <option value="Tender">Tender</option>
                <option value="Awarded">Awarded</option>
                <option value="Execution">Execution</option>
                <option value="Final">Final</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditingCaps(false)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-lg font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveCaps}
              disabled={saving}
              className="px-4 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors shadow-2xs"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* 5. AUDIT DRAWER */}
      {showAuditTrail && (
        <div className="bg-white dark:bg-[#0b101b] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center space-x-2">
              <History className="w-4 h-4 text-[#0078d4]" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Audit Logs</h4>
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
              <div className="py-3 text-center text-slate-400">No logs.</div>
            )}
          </div>
        </div>
      )}

      {/* 6. COST LINES TABLE */}
      <div className="bg-white dark:bg-[#0b101b] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        {/* Filters & Search */}
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
                className={`px-2.5 py-1 text-xs rounded-lg font-semibold cursor-pointer transition-colors ${
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
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0078d4]"
              />
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {filteredLines.length} Lines
            </span>
          </div>
        </div>

        {/* Lines Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 font-semibold text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Item</th>
                <th className="py-2.5 px-3">Provider</th>
                <th className="py-2.5 px-3 text-right">Quantity</th>
                <th className="py-2.5 px-3">Unit</th>
                <th className="py-2.5 px-3 text-right">Rate</th>
                <th className="py-2.5 px-3 text-right">Cost</th>
                <th className="py-2.5 px-3 text-center">Stage</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
              {filteredLines.map((line: any, idx: number) => {
                const isEditingThisLine = editingLineId === line.id;
                // Find corresponding enterprise resource if this line is linked
                const matchedResource = enterpriseResources.find(
                  (r) => r.id === line.resourceId || r.code === line.code || r.name === line.name
                );

                return (
                  <tr
                    key={line.id || idx}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors"
                  >
                    <td className="py-2 px-3 font-semibold text-slate-500 uppercase text-[10px]">
                      {line.itemType || line.category}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100 max-w-xs truncate">
                      <div>{line.name}</div>
                      {line.code && (
                        <span className="font-mono text-[9px] text-slate-400">{line.code}</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-500 max-w-[150px] truncate">
                      {line.supplierOrProvider || line.roleOrTrade || '-'}
                    </td>

                    {/* Quantity - Inline editable */}
                    <td className="py-2 px-3 text-right font-mono font-medium">
                      {isEditingThisLine ? (
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={inlineForm.quantity}
                          onChange={(e) =>
                            setInlineForm({ ...inlineForm, quantity: parseFloat(e.target.value) || 0 })
                          }
                          className="w-16 px-1 py-0.5 text-xs text-right bg-white dark:bg-slate-900 border border-[#0078d4] rounded"
                        />
                      ) : (
                        Number(line.quantity || 0).toLocaleString()
                      )}
                    </td>

                    <td className="py-2 px-3 text-slate-500 text-[10px]">
                      {line.unit || '-'}
                    </td>

                    {/* Rate - Inline editable with range selector */}
                    <td className="py-2 px-3 text-right font-mono">
                      {isEditingThisLine ? (
                        <div className="space-y-1">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={inlineForm.unitCost}
                            onChange={(e) =>
                              setInlineForm({ ...inlineForm, unitCost: parseFloat(e.target.value) || 0 })
                            }
                            className="w-20 px-1 py-0.5 text-xs text-right bg-white dark:bg-slate-900 border border-[#0078d4] rounded font-bold"
                          />
                          {/* Quick Rate Ranges if matched resource has them */}
                          {matchedResource && (
                            <div className="flex items-center justify-end gap-1">
                              {matchedResource.baseRate > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setInlineForm({ ...inlineForm, unitCost: matchedResource.baseRate })}
                                  className="px-1 py-0.2 rounded text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-700"
                                  title={`Base: ${matchedResource.baseRate}`}
                                >
                                  Base
                                </button>
                              )}
                              {matchedResource.industryBenchmarkRate ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setInlineForm({ ...inlineForm, unitCost: matchedResource.industryBenchmarkRate! })
                                  }
                                  className="px-1 py-0.2 rounded text-[9px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
                                  title={`Benchmark: ${matchedResource.industryBenchmarkRate}`}
                                >
                                  Bench
                                </button>
                              ) : null}
                              {Array.isArray(matchedResource.priceRanges) &&
                                matchedResource.priceRanges.map((tier, tidx) => (
                                  <button
                                    key={tidx}
                                    type="button"
                                    onClick={() => setInlineForm({ ...inlineForm, unitCost: tier.unitRate })}
                                    className="px-1 py-0.2 rounded text-[9px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                                    title={`${tier.label}: ${tier.unitRate}`}
                                  >
                                    Tier
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-600 dark:text-slate-400">
                          {formatCurrency(line.unitCost, activeCurrency)}
                        </span>
                      )}
                    </td>

                    {/* Total Cost */}
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      {isEditingThisLine
                        ? formatCurrency(round2(inlineForm.quantity * inlineForm.unitCost), activeCurrency)
                        : formatCurrency(line.totalCost, activeCurrency)}
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

                    {/* Actions Column */}
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1 font-sans">
                        {isEditingThisLine ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSaveInlineEdit(line)}
                              disabled={saving}
                              className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                              title="Save"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingLineId(null)}
                              className="p-1 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            {line.lineType === 'resource' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedResourceToEdit({
                                    id: line.id,
                                    resourceId: line.code || line.resourceId,
                                    name: line.name,
                                    resourceType: line.itemType || 'labour',
                                    roleOrTrade: line.roleOrTrade || line.supplierOrProvider || '',
                                    allocatedHours: line.quantity,
                                    hourlyRate: line.unitCost,
                                    unit: line.unit,
                                    notes: line.notes || ''
                                  });
                                  setIsAddResourceModalOpen(true);
                                }}
                                className="p-1 rounded text-slate-500 hover:text-[#0078d4] hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Edit Resource"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleStartInlineEdit(line)}
                                className="p-1 rounded text-slate-500 hover:text-[#0078d4] hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Edit Rate & Quantity"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteLine(line)}
                              disabled={saving}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredLines.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400 font-sans">
                    <div className="max-w-xs mx-auto space-y-2">
                      <p className="text-xs">No cost items found.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedResourceToEdit(null);
                          setIsAddResourceModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-[#0078d4] text-white rounded-lg text-xs font-bold inline-flex items-center space-x-1 shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Resource</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Resource Modal */}
      <AddPlanResourceModal
        isOpen={isAddResourceModalOpen}
        onClose={() => {
          setIsAddResourceModalOpen(false);
          setSelectedResourceToEdit(null);
        }}
        onSave={async (resourceData) => {
          if (selectedResourceToEdit?.id) {
            await api.updatePlanResource(planId, selectedResourceToEdit.id, resourceData);
            showToast?.({ message: 'Resource updated', type: 'success' });
          } else {
            await api.addResourceToPlan(planId, resourceData);
            showToast?.({ message: 'Resource added', type: 'success' });
          }
          setIsAddResourceModalOpen(false);
          setSelectedResourceToEdit(null);
          await loadCostControls();
          onCostControlsUpdated?.();
        }}
        initialData={selectedResourceToEdit}
        enterpriseResources={enterpriseResources}
        currency={activeCurrency}
      />
    </div>
  );
};
