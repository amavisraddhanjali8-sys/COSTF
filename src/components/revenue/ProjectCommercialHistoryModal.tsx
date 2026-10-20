import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  TrendingUp,
  FolderGit2,
  Calendar,
  User,
  Search,
  Filter,
  ArrowRight,
  Package,
  Layers
} from 'lucide-react';
import { RevenueRateHistoryRecord } from '../../types';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/currency';

interface ProjectCommercialHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string;
  projectCode?: string;
  activeCurrency: string;
}

export const ProjectCommercialHistoryModal: React.FC<ProjectCommercialHistoryModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  projectCode,
  activeCurrency
}) => {
  const [records, setRecords] = useState<RevenueRateHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('ALL');

  useEffect(() => {
    if (!isOpen || !projectId) return;

    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.getProjectCommercialHistory(projectId, { limit: 200 });
        if (mounted) {
          setRecords(res.data || []);
        }
      } catch (e) {
        console.error('Failed to load project commercial history:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const plansList = Array.from(
    new Map<string, { id: string; label: string }>(
      records.map((r) => [r.projectPlanId, { id: r.projectPlanId, label: r.planNumber || r.planName || r.projectPlanId }])
    ).values()
  );

  const filtered = records.filter((rec) => {
    if (planFilter !== 'ALL' && rec.projectPlanId !== planFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        (rec.revenueItemName || '').toLowerCase().includes(q) ||
        (rec.revenueItemCode || '').toLowerCase().includes(q) ||
        (rec.planNumber || '').toLowerCase().includes(q) ||
        (rec.changedBy || '').toLowerCase().includes(q) ||
        (rec.changeReason || '').toLowerCase().includes(q) ||
        (rec.commercialContext || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-150">
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center border border-purple-200 dark:border-purple-800">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Commercial History
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800">
                  {projectCode || 'PROJECT'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {projectName || 'Project'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/40 dark:bg-slate-900/40">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search item, plan, reason, or user..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-purple-500"
              />
            </div>

            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2.5 py-1.5 focus:outline-none"
            >
              <option value="ALL">All Project Plans ({plansList.length})</option>
              {plansList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {filtered.length} commercial revision events
          </div>
        </div>

        {/* List of events */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading project commercial history...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No commercial changes recorded for this project yet.
            </div>
          ) : (
            filtered.map((record) => {
              const hasPrevRate = record.previousRate !== null && record.previousRate !== undefined;
              const rateDiff = hasPrevRate ? record.newRate - (record.previousRate || 0) : 0;

              return (
                <div
                  key={record.id}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-sky-300 font-bold border border-blue-200 dark:border-blue-800">
                        {record.revenueItemCode || 'ITEM'}
                      </span>
                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                        {record.revenueItemName}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                        {record.revenueItemType || 'product'}
                      </span>
                      <span>•</span>
                      <span className="font-mono text-xs text-[#0078d4] font-semibold">
                        Plan {record.planNumber || record.planName}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-mono">
                      <span>{record.effectiveDate}</span>
                      <span>•</span>
                      <span>{record.changedBy}</span>
                    </div>
                  </div>

                  {/* Commercial diff table */}
                  <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Selling Rate</div>
                      <div className="flex items-center space-x-1.5 mt-0.5 font-mono">
                        {hasPrevRate ? (
                          <>
                            <span className="text-slate-400 line-through">
                              {formatCurrency(record.previousRate || 0, activeCurrency)}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {formatCurrency(record.newRate, activeCurrency)}
                            </span>
                          </>
                        ) : (
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {formatCurrency(record.newRate, activeCurrency)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Quantity & Unit</div>
                      <div className="flex items-center space-x-1.5 mt-0.5 font-mono">
                        {record.previousQuantity !== null && record.previousQuantity !== undefined ? (
                          <>
                            <span className="text-slate-400 line-through">
                              {record.previousQuantity} {record.previousUnit || ''}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {record.newQuantity} {record.newUnit}
                            </span>
                          </>
                        ) : (
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {record.newQuantity} {record.newUnit}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Revised Line Revenue</div>
                      <div className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {formatCurrency(record.newRate * record.newQuantity, activeCurrency)}
                      </div>
                    </div>
                  </div>

                  {record.changeReason && (
                    <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400 font-semibold">Change Reason: </span>
                      {record.changeReason}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 text-xs">
          <div className="text-slate-500">
            Chronological audit records immutable in PostgreSQL <span className="font-mono text-purple-600 font-semibold">revenue_rate_history</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
