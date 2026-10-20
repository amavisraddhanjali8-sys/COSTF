import React, { useState, useEffect } from 'react';
import {
  X,
  SlidersHorizontal,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  Percent,
  Layers,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Info,
  RefreshCw
} from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency, getStoredCurrency } from '../../utils/currency';

export interface PlanComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectCode: string;
  projectName: string;
  currency?: string;
  activePlanId?: string;
  onViewPlanDetails?: (planId: string) => void;
  onActivatePlan?: (planId: string) => void;
  onEditPlan?: (plan: any) => void;
  fallbackPlans?: any[];
}

export const PlanComparisonModal: React.FC<PlanComparisonModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectCode,
  projectName,
  currency,
  activePlanId,
  onViewPlanDetails,
  onActivatePlan,
  onEditPlan,
  fallbackPlans = []
}) => {
  if (!isOpen) return null;

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const activeCurrency = currency || data?.currency || getStoredCurrency();

  const loadComparison = async () => {
    setLoading(true);
    try {
      const result = await api.getProjectPlansComparison(projectId);
      setData(result);
    } catch (e) {
      console.warn('Could not load plan comparison from API, computing from fallback:', e);
      // Construct fallback comparison from provided plans
      const activeId = activePlanId || fallbackPlans.find((p) => p.isActive)?.id || fallbackPlans[0]?.id;
      const baseline = fallbackPlans.find((p) => p.isBaseline) || fallbackPlans[0];
      const baseTotalCost = Number(baseline?.totalPlannedCost ?? baseline?.totalProjectCost ?? 0);
      const baseRevenue = Number(baseline?.plannedRevenue ?? baseline?.quotedRevenue ?? 0);
      const baseProfit = Number(baseline?.plannedProfit ?? (baseRevenue - baseTotalCost));

      const plans = fallbackPlans.map((p) => {
        const revenue = Number(p.plannedRevenue ?? p.quotedRevenue ?? 0);
        const directCost = Number(p.directCost ?? p.totalDirectCost ?? 0);
        const overhead = Number(p.allocatedOverhead ?? 0);
        const totalCost = Number(p.totalPlannedCost ?? p.totalProjectCost ?? (directCost + overhead));
        const grossProfit = Number(p.grossProfit ?? (revenue - directCost));
        const netPlannedProfit = Number(p.plannedProfit ?? (revenue - totalCost));
        const margin = Number(p.profitMarginPct ?? p.grossMarginPct ?? (revenue > 0 ? (grossProfit / revenue) * 100 : 0));
        const isBaseline = Boolean(p.isBaseline);
        const isActive = p.id === activeId;
        const isApproved = p.status === 'Approved' || Boolean(p.approvalDate);

        return {
          id: p.id,
          planNumber: p.planNumber || `PLN-${projectCode}`,
          name: p.name,
          planType: p.planType || (isBaseline ? 'Baseline' : 'Alternative'),
          status: p.status || (isBaseline ? 'Approved' : 'Draft'),
          isBaseline,
          isActive,
          isApproved,
          revisionNumber: Number(p.revisionNumber || 1),
          versionLabel: p.versionLabel || `v${p.revisionNumber || 1}.0`,
          currency: p.currency || currency || 'USD',
          revenue,
          directCost,
          overhead,
          totalCost,
          grossProfit,
          netPlannedProfit,
          margin,
          varianceToBaseline: {
            costDifference: totalCost - baseTotalCost,
            costDiffPct: baseTotalCost > 0 ? ((totalCost - baseTotalCost) / baseTotalCost) * 100 : 0,
            revenueDifference: revenue - baseRevenue,
            profitDifference: netPlannedProfit - baseProfit
          }
        };
      });

      setData({
        projectId,
        projectCode,
        projectName,
        currency: activeCurrency,
        activePlanId: activeId,
        approvedPlanId: baseline?.id,
        currentApprovedPlan: baseline,
        plans
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadComparison();
  }, [projectId]);

  const plans = data?.plans || [];
  const currentApprovedPlan = data?.currentApprovedPlan;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl max-w-5xl w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0078d4]/10 flex items-center justify-center text-[#0078d4]">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Project Alternative Plans Comparison
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-50 text-[#0078d4] font-bold">
                  {projectCode}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Side-by-side financial evaluation across baseline & alternative scenarios for {projectName}.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={loadComparison}
              disabled={loading}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              title="Refresh Comparison Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* Rules & Portfolio Inclusion Disclaimer Banner (Req 14, 15, 16) */}
          <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-start space-x-3 text-xs">
            <Info className="w-4 h-4 text-[#0078d4] shrink-0 mt-0.5" />
            <div className="space-y-1 text-slate-700 dark:text-slate-300">
              <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <span>Rules for Current / Approved Plan & Financial Isolation (Req 14, 15, 16)</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                • <strong>Inclusion Rule:</strong> Project portfolio summaries, client quotations, and commercial KPIs roll up strictly from the <strong>Approved / Active Baseline Plan</strong> ({currentApprovedPlan?.name || 'Active Plan'}).
              </p>
              <p className="text-[11px] leading-relaxed">
                • <strong>Financial Isolation:</strong> Alternative plans (Value-Engineered, Expedited, etc.) are trade scenarios for sensitivity analysis. Their financial values are <strong>never combined or double-counted</strong> into the project portfolio.
              </p>
            </div>
          </div>

          {/* Side-by-Side Comparison Matrix Table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
            <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 text-[11px]">
                <tr>
                  <th className="py-3 px-3.5 font-bold">Plan Scenario</th>
                  <th className="py-3 px-3 font-bold text-center">Status</th>
                  <th className="py-3 px-3 font-bold text-right">Revenue</th>
                  <th className="py-3 px-3 font-bold text-right">Direct Cost</th>
                  <th className="py-3 px-3 font-bold text-right">Overhead</th>
                  <th className="py-3 px-3 font-bold text-right">Total Cost</th>
                  <th className="py-3 px-3 font-bold text-right">Gross Profit</th>
                  <th className="py-3 px-3 font-bold text-right">Net Profit</th>
                  <th className="py-3 px-3 font-bold text-right">Margin %</th>
                  <th className="py-3 px-3 font-bold text-right">Variance</th>
                  <th className="py-3 px-3.5 font-bold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                {plans.map((p: any, idx: number) => {
                  const isActive = p.isActive || p.id === data?.activePlanId;
                  const isBase = p.isBaseline;
                  const costDiff = p.varianceToBaseline?.costDifference || 0;
                  const costDiffPct = p.varianceToBaseline?.costDiffPct || 0;

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors ${
                        isActive ? 'bg-blue-50/30 dark:bg-blue-950/20 font-medium' : ''
                      }`}
                    >
                      {/* Plan Scenario */}
                      <td className="py-3 px-3.5">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono text-[#0078d4] font-bold">{p.planNumber}</span>
                          <span className="text-slate-900 dark:text-slate-100 font-semibold">{p.name}</span>
                          {isActive && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[9px] font-bold">
                              ACTIVE
                            </span>
                          )}
                          {isBase && (
                            <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[9px] font-bold">
                              BASELINE
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Rev {p.revisionNumber} ({p.versionLabel}) • Type: {p.planType}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            p.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : p.status === 'Approved'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : p.status === 'Archived'
                              ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>

                      {/* Revenue */}
                      <td className="py-3 px-3 text-right font-mono font-medium text-slate-900 dark:text-slate-100">
                        {formatCurrency(p.revenue, activeCurrency)}
                      </td>

                      {/* Direct Cost */}
                      <td className="py-3 px-3 text-right font-mono text-[#0078d4] font-medium">
                        {formatCurrency(p.directCost, activeCurrency)}
                      </td>

                      {/* Overhead */}
                      <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                        {formatCurrency(p.overhead, activeCurrency)}
                      </td>

                      {/* Total Cost */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(p.totalCost, activeCurrency)}
                      </td>

                      {/* Gross Profit */}
                      <td className="py-3 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400 font-medium">
                        {formatCurrency(p.grossProfit, activeCurrency)}
                      </td>

                      {/* Net Planned Profit */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(p.netPlannedProfit, activeCurrency)}
                      </td>

                      {/* Margin % */}
                      <td className="py-3 px-3 text-right font-mono font-bold">
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            p.margin >= 25
                              ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {Number(p.margin).toFixed(1)}%
                        </span>
                      </td>

                      {/* Variance to Baseline */}
                      <td className="py-3 px-3 text-right font-mono text-[10px]">
                        {isBase ? (
                          <span className="text-slate-400">Baseline (0.00)</span>
                        ) : costDiff < 0 ? (
                          <span className="text-emerald-700 font-semibold">
                            -{formatCurrency(Math.abs(costDiff), activeCurrency)} ({Math.abs(costDiffPct).toFixed(1)}% savings)
                          </span>
                        ) : costDiff > 0 ? (
                          <span className="text-rose-700 font-semibold">
                            +{formatCurrency(costDiff, activeCurrency)} (+{costDiffPct.toFixed(1)}%)
                          </span>
                        ) : (
                          <span className="text-slate-500">Par (0.00)</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          {!isActive && onActivatePlan && (
                            <button
                              type="button"
                              onClick={() => {
                                onActivatePlan(p.id);
                                void loadComparison();
                              }}
                              className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold border border-emerald-200 transition-colors cursor-pointer"
                              title="Set this scenario as the active project plan"
                            >
                              Activate
                            </button>
                          )}

                          {onViewPlanDetails && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onViewPlanDetails(p.id);
                              }}
                              className="px-2 py-1 rounded bg-[#0078d4] hover:bg-[#006cbd] text-white text-[10px] font-semibold flex items-center space-x-1 transition-colors cursor-pointer shadow-2xs"
                              title="Open dedicated plan details portal"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Details</span>
                            </button>
                          )}

                          {onEditPlan && (
                            <button
                              type="button"
                              onClick={() => {
                                onEditPlan(p);
                              }}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold transition-colors cursor-pointer"
                              title="Quick edit plan parameters"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cards Breakdown Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {plans.map((p: any) => (
              <div
                key={p.id}
                className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                  p.isActive
                    ? 'border-[#0078d4] bg-blue-50/20 dark:bg-blue-950/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b101b]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[#0078d4] font-bold">{p.planNumber}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase bg-slate-100 text-slate-700">
                    {p.status}
                  </span>
                </div>
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{p.name}</h4>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Cost</span>
                    <span className="font-semibold">{formatCurrency(p.totalCost, activeCurrency)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Profit</span>
                    <span className="font-semibold">{formatCurrency(p.netPlannedProfit, activeCurrency)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Revenue</span>
                    <span className="font-semibold">{formatCurrency(p.revenue, activeCurrency)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Margin</span>
                    <span className="font-bold text-[#0078d4]">{Number(p.margin).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/60 text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <span className="font-mono">Comparing {plans.length} alternative plans</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold cursor-pointer"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
};
