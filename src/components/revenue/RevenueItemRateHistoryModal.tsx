import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  TrendingUp,
  TrendingDown,
  Calendar,
  User,
  FolderGit2,
  FileText,
  Search,
  DollarSign,
  ArrowRight,
  ShieldAlert,
  Download
} from 'lucide-react';
import { RevenueItem, RevenueRateHistoryRecord } from '../../types';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/currency';

interface RevenueItemRateHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  revenueItem: RevenueItem | null;
  activeCurrency: string;
}

export const RevenueItemRateHistoryModal: React.FC<RevenueItemRateHistoryModalProps> = ({
  isOpen,
  onClose,
  revenueItem,
  activeCurrency
}) => {
  const [historyRecords, setHistoryRecords] = useState<RevenueRateHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [changeTypeFilter, setChangeTypeFilter] = useState('ALL');

  useEffect(() => {
    if (!isOpen || !revenueItem) return;

    let mounted = true;
    const loadHistory = async () => {
      setLoading(true);
      try {
        const res = await api.getRevenueItemRateHistory(revenueItem.id, { limit: 100 });
        if (mounted) {
          setHistoryRecords(res.data || []);
        }
      } catch (err) {
        console.error('Failed to load item rate history:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadHistory();
    return () => {
      mounted = false;
    };
  }, [isOpen, revenueItem]);

  if (!isOpen || !revenueItem) return null;

  // Filter records
  const filtered = historyRecords.filter((rec) => {
    if (projectFilter !== 'ALL' && rec.projectId !== projectFilter) return false;
    if (changeTypeFilter !== 'ALL' && rec.changeType !== changeTypeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        (rec.projectName || '').toLowerCase().includes(q) ||
        (rec.projectCode || '').toLowerCase().includes(q) ||
        (rec.planNumber || '').toLowerCase().includes(q) ||
        (rec.planName || '').toLowerCase().includes(q) ||
        (rec.changedBy || '').toLowerCase().includes(q) ||
        (rec.changeReason || '').toLowerCase().includes(q) ||
        (rec.commercialContext || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Unique projects list for dropdown
  const projectsList = Array.from(
    new Map(
      historyRecords.map((r) => [r.projectId, { id: r.projectId, name: r.projectName || r.projectCode || r.projectId }])
    ).values()
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-150">
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-sky-950/60 text-blue-700 dark:text-sky-300 flex items-center justify-center border border-blue-200 dark:border-blue-800">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Commercial Rate History
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800">
                  {revenueItem.code}
                </span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {revenueItem.type}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {revenueItem.name} • Default Global Rate: <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{formatCurrency(revenueItem.defaultRate, revenueItem.currency || activeCurrency)}</span> / {revenueItem.unit}
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
                placeholder="Search plan, project, user, or reason..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2.5 py-1.5 focus:outline-none"
            >
              <option value="ALL">All Projects ({projectsList.length})</option>
              {projectsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <select
              value={changeTypeFilter}
              onChange={(e) => setChangeTypeFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2.5 py-1.5 focus:outline-none"
            >
              <option value="ALL">All Change Types</option>
              <option value="initial_addition">Initial Plan Assignment</option>
              <option value="rate_change">Rate Change</option>
              <option value="quantity_change">Quantity Change</option>
              <option value="rate_and_quantity_change">Rate & Quantity Change</option>
              <option value="commercial_terms_update">Terms Update</option>
            </select>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {filtered.length} of {historyRecords.length} historical events
          </div>
        </div>

        {/* Records List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading rate audit history...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No commercial rate history records found.
            </div>
          ) : (
            filtered.map((record) => {
              const hasPrevRate = record.previousRate !== null && record.previousRate !== undefined;
              const rateDiff = hasPrevRate ? record.newRate - (record.previousRate || 0) : 0;
              const rateDiffPct = hasPrevRate && record.previousRate ? (rateDiff / record.previousRate) * 100 : 0;

              return (
                <div
                  key={record.id}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${
                          record.changeType === 'initial_addition'
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                            : record.changeType === 'rate_change'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : record.changeType === 'quantity_change'
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                            : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                        }`}
                      >
                        {record.changeType.replace(/_/g, ' ')}
                      </span>

                      <div className="flex items-center space-x-1.5 text-xs text-slate-600 dark:text-slate-400">
                        <FolderGit2 className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {record.projectName || record.projectCode}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-blue-600 dark:text-sky-400 font-semibold">
                          {record.planNumber || record.planName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 text-[11px] text-slate-500 font-mono">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>Effective: {record.effectiveDate}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center space-x-1">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{record.changedBy}</span>
                      </span>
                    </div>
                  </div>

                  {/* Commercial Rate & Quantity Details */}
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Selling Rate</div>
                      <div className="flex items-center space-x-2 mt-0.5 font-mono">
                        {hasPrevRate ? (
                          <>
                            <span className="text-slate-400 line-through">
                              {formatCurrency(record.previousRate || 0, revenueItem.currency || activeCurrency)}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {formatCurrency(record.newRate, revenueItem.currency || activeCurrency)}
                            </span>
                            {rateDiff !== 0 && (
                              <span
                                className={`text-[10px] font-semibold flex items-center ${
                                  rateDiff > 0 ? 'text-emerald-600' : 'text-rose-600'
                                }`}
                              >
                                {rateDiff > 0 ? '+' : ''}
                                {rateDiffPct.toFixed(1)}%
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {formatCurrency(record.newRate, revenueItem.currency || activeCurrency)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Quantity & Unit</div>
                      <div className="flex items-center space-x-2 mt-0.5 font-mono">
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
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Line Revenue</div>
                      <div className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {formatCurrency(record.newRate * record.newQuantity, revenueItem.currency || activeCurrency)}
                      </div>
                    </div>
                  </div>

                  {/* Context and Reason */}
                  {(record.changeReason || record.commercialContext) && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      {record.changeReason && (
                        <div className="text-slate-700 dark:text-slate-300">
                          <span className="text-slate-400 font-semibold">Reason: </span>
                          <span>{record.changeReason}</span>
                        </div>
                      )}
                      {record.commercialContext && (
                        <div className="text-slate-500 italic">
                          <span className="text-slate-400 font-semibold not-italic">Context: </span>
                          <span>{record.commercialContext}</span>
                        </div>
                      )}
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
            All records permanently tracked in PostgreSQL <span className="font-mono text-blue-600 font-semibold">revenue_rate_history</span>
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
