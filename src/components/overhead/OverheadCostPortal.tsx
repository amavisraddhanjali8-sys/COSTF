import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  History,
  FileSpreadsheet,
  Edit2,
  Trash2,
  Info,
  ChevronLeft,
  ChevronRight,
  Shield,
  Tag
} from 'lucide-react';
import { OverheadItem, OverheadCategory, OverheadAuditLog, Project } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, getStoredCurrency } from '../../utils/currency';
import { CreateEditOverheadItemModal } from './CreateEditOverheadItemModal';

interface OverheadCostPortalProps {
  currentUser?: any;
  projects?: Project[];
  onOpenPlan?: (planId: string) => void;
  showToast?: (msg: string | { message: string; type?: string }) => void;
}

export const OverheadCostPortal: React.FC<OverheadCostPortalProps> = ({
  currentUser,
  projects = [],
  onOpenPlan,
  showToast
}) => {
  const [items, setItems] = useState<OverheadItem[]>([]);
  const [categories, setCategories] = useState<OverheadCategory[]>([]);
  const [auditLogs, setAuditLogs] = useState<OverheadAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'catalogue' | 'audit'>('catalogue');
  const [isCreateEditOpen, setIsCreateEditOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<OverheadItem | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const activeCurrency = getStoredCurrency();

  const loadData = async () => {
    setLoading(true);
    try {
      const [itemsRes, catsRes, logsRes] = await Promise.all([
        api.getOverheadItems({ limit: 100 }),
        api.getOverheadCategories(),
        api.getOverheadAuditLogs({ limit: 50 })
      ]);
      setItems(Array.isArray(itemsRes) ? itemsRes : (itemsRes as any)?.data || []);
      setCategories(catsRes || []);
      setAuditLogs(Array.isArray(logsRes) ? logsRes : (logsRes as any)?.data || []);
    } catch (e: any) {
      console.error('Failed to load overhead portal data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredItems = items.filter((item) => {
    if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
    if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Overheads</h1>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                setItemToEdit(null);
                setIsCreateEditOpen(true);
              }}
              className="px-3 py-1.5 bg-[#003049] hover:bg-[#002235] text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-[#fdf0d5]" />
              <span>New Overhead Item</span>
            </button>

            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveSubTab('catalogue')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeSubTab === 'catalogue'
                    ? 'bg-white dark:bg-[#003049] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Catalogue ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('audit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeSubTab === 'audit'
                    ? 'bg-white dark:bg-[#003049] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Audit ({auditLogs.length})
              </button>
            </div>
          </div>
        </div>
      </div>

      {activeSubTab === 'catalogue' && (
        <div className="bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search overheads..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2.5 py-1.5 focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  setItemToEdit(null);
                  setIsCreateEditOpen(true);
                }}
                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Record</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Code</th>
                  <th className="py-2.5 px-3 font-semibold">Name & Category</th>
                  <th className="py-2.5 px-3 font-semibold">Cost Type</th>
                  <th className="py-2.5 px-3 font-semibold">Calculation Method</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Default Rate</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Linked Plans</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans text-xs">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/60 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-amber-600">{item.code}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900 dark:text-slate-100">{item.name}</div>
                      <div className="text-[10px] text-slate-400">{item.category}</div>
                    </td>
                    <td className="py-2.5 px-3">{item.costType}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">{item.defaultCalculationMethod}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      {item.defaultCalculationMethod === 'percentage_of_direct' ? `${item.defaultRate}%` : formatCurrency(item.defaultRate, activeCurrency)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                        {item.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-semibold">
                      {item.linkedPlansCount || 0}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          type="button"
                          onClick={() => {
                            setItemToEdit(item);
                            setIsCreateEditOpen(true);
                          }}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
                          title="Edit Overhead Item"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (window.confirm(`Delete overhead item ${item.name}?`)) {
                              await api.deleteOverheadItem(item.id);
                              loadData();
                              if (showToast) showToast(`Overhead item ${item.name} removed.`);
                            }
                          }}
                          className="p-1 hover:bg-rose-100 dark:hover:bg-rose-950/40 rounded text-rose-500 transition-colors cursor-pointer"
                          title="Delete Overhead Item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'audit' && (
        <div className="bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs">
          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center space-x-2">
            <Shield className="w-4 h-4 text-indigo-500" />
            <span>Overhead Allocation Audit History</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {auditLogs.map((log) => (
              <div key={log.id} className="py-2.5 flex items-start justify-between">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    [{log.action}] {log.changeDescription}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Actor: {log.actorName} ({log.actorRole}) • {log.createdAt}
                  </div>
                </div>
                <span className="font-mono text-[10px] text-slate-400">{log.id}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      <CreateEditOverheadItemModal
        isOpen={isCreateEditOpen}
        onClose={() => {
          setIsCreateEditOpen(false);
          setItemToEdit(null);
        }}
        itemToEdit={itemToEdit}
        onSave={(saved) => {
          loadData();
          if (showToast) showToast(`Overhead item "${saved.name}" saved successfully.`);
        }}
      />
    </div>
  );
};
