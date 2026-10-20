import React, { useState } from 'react';
import { X, Save, Edit3, ShieldCheck, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';

export interface EditBudgetPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: any;
  projectId: string;
  onPlanUpdated: () => void;
  showToast?: (msg: string | { message: string; type?: string }) => void;
}

export const EditBudgetPlanModal: React.FC<EditBudgetPlanModalProps> = ({
  isOpen,
  onClose,
  plan,
  projectId,
  onPlanUpdated,
  showToast
}) => {
  if (!isOpen || !plan) return null;

  const [name, setName] = useState(plan.name || '');
  const [description, setDescription] = useState(plan.description || '');
  const [planType, setPlanType] = useState(plan.planType || (plan.isBaseline ? 'Baseline' : 'Alternative'));
  const [status, setStatus] = useState(plan.status || 'Draft');
  const [targetMarginPct, setTargetMarginPct] = useState<number>(Number(plan.targetMarginPct ?? 25));
  const [overheadPct, setOverheadPct] = useState<number>(Number(plan.overheadPct ?? 8.5));
  const [contingencyPct, setContingencyPct] = useState<number>(Number(plan.contingencyPct ?? 5.0));
  const [laborBurdenPct, setLaborBurdenPct] = useState<number>(Number(plan.laborBurdenPct ?? 0));
  const [bumpRevision, setBumpRevision] = useState(false);
  const [changeSummary, setChangeSummary] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Plan name cannot be empty.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await api.updateProjectPlan(plan.id, {
        projectId,
        name: name.trim(),
        description: description.trim(),
        planType,
        status,
        targetMarginPct: Number(targetMarginPct),
        overheadPct: Number(overheadPct),
        contingencyPct: Number(contingencyPct),
        laborBurdenPct: Number(laborBurdenPct),
        bumpRevision,
        changeSummary: bumpRevision ? (changeSummary.trim() || 'Plan parameters modified') : undefined
      });

      showToast?.(`Plan ${plan.planNumber || plan.name} updated successfully.`);
      onPlanUpdated();
      onClose();
    } catch (err: any) {
      console.error('Error updating project plan:', err);
      setError(err?.message || 'Failed to update plan. Please check input parameters.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/60">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-[#0078d4]/10 flex items-center justify-center text-[#0078d4]">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <span>Edit Project Plan</span>
                {plan.planNumber && (
                  <span className="text-xs font-mono font-normal text-[#0078d4]">
                    ({plan.planNumber})
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-500">
                Update plan attributes, strategic margins, and regulatory review status.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-3.5 text-xs">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Plan Name */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Plan Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Plan B: Value-Engineered Domestic Sourcing"
              className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#0078d4]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Scope & Commercial Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Summary of supplier assumptions, engineering deviations, and schedule multipliers..."
              className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#0078d4]"
            />
          </div>

          {/* Plan Type & Status Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Plan Scenario Type
              </label>
              <select
                value={planType}
                onChange={(e) => setPlanType(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium"
              >
                <option value="Baseline">Baseline Scenario</option>
                <option value="Alternative">Alternative Scenario</option>
                <option value="Value-Engineered">Value-Engineered</option>
                <option value="Expedited">Expedited Fast-Track</option>
                <option value="Contract Final">Contract Final</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Plan Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium"
              >
                <option value="Draft">Draft</option>
                <option value="In Review">In Review</option>
                <option value="Approved">Approved (Official Baseline)</option>
                <option value="Active">Active (In Execution)</option>
                <option value="Locked">Locked</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
          </div>

          {/* Strategic Margins & Overhead Multipliers Grid */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <h3 className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0078d4]" />
              <span>Financial Markup & Overhead Rates</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Target Margin %</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="90"
                  value={targetMarginPct}
                  onChange={(e) => setTargetMarginPct(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Overhead %</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="50"
                  value={overheadPct}
                  onChange={(e) => setOverheadPct(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Contingency %</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="30"
                  value={contingencyPct}
                  onChange={(e) => setContingencyPct(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Labor Burden %</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="50"
                  value={laborBurdenPct}
                  onChange={(e) => setLaborBurdenPct(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Revision Bump Checkbox */}
          <div className="pt-1 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <label className="flex items-center space-x-2 cursor-pointer text-slate-700 dark:text-slate-300 text-xs">
              <input
                type="checkbox"
                checked={bumpRevision}
                onChange={(e) => setBumpRevision(e.target.checked)}
                className="rounded border-slate-300 text-[#0078d4] focus:ring-[#0078d4]"
              />
              <span className="font-semibold">Bump Revision (creates historical audit snapshot v{(plan.revisionNumber || 1) + 1}.0)</span>
            </label>

            {bumpRevision && (
              <input
                type="text"
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder="Reason for revision bump (e.g. Revised target margin to 32% per executive committee)"
                className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-[#0078d4]"
              />
            )}
          </div>

          {/* Form Actions */}
          <div className="pt-2 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 rounded-lg bg-[#0078d4] hover:bg-[#006cbd] text-white font-semibold flex items-center space-x-1.5 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Plan Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
