import React, { useState, useEffect } from 'react';
import { X, History, Sparkles, Calendar, User, DollarSign, Percent, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency, getStoredCurrency } from '../../utils/currency';

export interface PlanRevisionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  planNumber?: string;
  planName?: string;
  currency?: string;
}

export const PlanRevisionsModal: React.FC<PlanRevisionsModalProps> = ({
  isOpen,
  onClose,
  planId,
  planNumber,
  planName,
  currency
}) => {
  if (!isOpen) return null;

  const [revisions, setRevisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const activeCurrency = currency || getStoredCurrency();

  useEffect(() => {
    let cancelled = false;
    const fetchRevisions = async () => {
      setLoading(true);
      try {
        const planDetail = await api.getProjectPlanById(planId);
        if (!cancelled && planDetail?.revisions) {
          setRevisions(planDetail.revisions);
        }
      } catch (e) {
        console.warn('Could not load plan revisions:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchRevisions();
    return () => {
      cancelled = true;
    };
  }, [planId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <span>Plan Revision History</span>
                {planNumber && (
                  <span className="text-xs font-mono font-normal text-[#0078d4]">
                    ({planNumber})
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-500">
                Audited version history and parameter snapshots for {planName || 'Plan'}.
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

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-3">
          {loading ? (
            <div className="py-8 text-center text-slate-500 text-xs">Loading revision snapshots...</div>
          ) : revisions.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">No revision history found for this plan.</div>
          ) : (
            <div className="space-y-3">
              {revisions.map((rev: any, idx: number) => (
                <div
                  key={rev.id || idx}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded font-mono font-bold bg-[#0078d4] text-white text-[11px]">
                        {rev.versionLabel || `v${rev.revisionNumber || 1}.0`}
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {rev.changeSummary || 'Plan revision update'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3 text-[11px] text-slate-500">
                      <span className="flex items-center space-x-1">
                        <User className="w-3 h-3" />
                        <span>{rev.changedBy || 'System Planner'}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{rev.effectiveDate || rev.createdAt?.slice(0, 10)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Financial Snapshot Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Planned Revenue</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {formatCurrency(rev.plannedRevenue || 0, activeCurrency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Direct Cost</span>
                      <span className="font-mono font-semibold text-[#0078d4]">
                        {formatCurrency(rev.directCost || 0, activeCurrency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Total Planned Cost</span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(rev.totalPlannedCost || 0, activeCurrency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Profit Margin</span>
                      <span className="font-mono font-bold text-emerald-600">
                        {Number(rev.profitMarginPct || 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50/60 dark:bg-slate-900/60">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold cursor-pointer text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
