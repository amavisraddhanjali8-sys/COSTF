import React, { useState, useEffect } from 'react';
import {
  Package,
  Wrench,
  Plus,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  History,
  FileSpreadsheet,
  Edit2,
  Trash2,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Info,
  CheckCircle2,
  Barcode as BarcodeIcon,
  Tag
} from 'lucide-react';
import { RevenueItem, RevenueCategory, Project, ProjectPlan } from '../../types';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/currency';
import { CreateEditRevenueItemModal } from './CreateEditRevenueItemModal';
import { RevenueItemRateHistoryModal } from './RevenueItemRateHistoryModal';
import { AddRevenueItemToPlanModal } from './AddRevenueItemToPlanModal';

interface RevenueCataloguePortalProps {
  activeCurrency: string;
  projects?: Project[];
  plans?: ProjectPlan[];
  onOpenProjectPlan?: (planId: string) => void;
  showNotification?: (message: string) => void;
}

export const RevenueCataloguePortal: React.FC<RevenueCataloguePortalProps> = ({
  activeCurrency,
  projects = [],
  plans = [],
  onOpenProjectPlan,
  showNotification
}) => {
  const [items, setItems] = useState<RevenueItem[]>([]);
  const [categories, setCategories] = useState<RevenueCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'product' | 'service'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Modals state
  const [isCreateEditOpen, setIsCreateEditOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<RevenueItem | null>(null);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyTargetItem, setHistoryTargetItem] = useState<RevenueItem | null>(null);

  const [isAddToPlanModalOpen, setIsAddToPlanModalOpen] = useState(false);
  const [addToPlanTargetItem, setAddToPlanTargetItem] = useState<RevenueItem | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [itemsRes, catsRes] = await Promise.all([
        api.getRevenueItems({
          page,
          limit: pageSize,
          search: search || undefined,
          category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined
        }),
        api.getRevenueCategories()
      ]);
      setItems(itemsRes.data || []);
      setTotalCount(itemsRes.total || 0);
      setCategories(catsRes || []);
    } catch (e) {
      console.error('Failed to load revenue catalogue:', e);
      if (showNotification) showNotification('Failed to load revenue catalogue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, search, categoryFilter, statusFilter]);

  // Client-side type filter
  const displayedItems = items.filter((item) => {
    if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
    return true;
  });

  // Aggregate stats
  const totalProducts = items.filter((i) => i.type === 'product').length;
  const totalServices = items.filter((i) => i.type === 'service').length;
  const totalQuotedRevenue = items.reduce((acc, curr) => acc + (curr.totalQuotedRevenue || 0), 0);
  const totalLinkedPlans = items.reduce((acc, curr) => acc + (curr.linkedPlansCount || 0), 0);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-4">
      {/* 1. Header Banner */}
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Revenue
            </h1>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={() => {
                setItemToEdit(null);
                setIsCreateEditOpen(true);
              }}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-[#003049] hover:bg-[#002235] text-white flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Item</span>
            </button>
          </div>
        </div>

        {/* 2. Top Summary Metrics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Products
            </div>
            <div className="text-lg font-extrabold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
              {totalProducts}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Services
            </div>
            <div className="text-lg font-extrabold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
              {totalServices}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Plans
            </div>
            <div className="text-lg font-extrabold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
              {totalLinkedPlans}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Total Revenue
            </div>
            <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
              {formatCurrency(totalQuotedRevenue, activeCurrency)}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filter Bar & Type Pills */}
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800 p-3 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Classification Filter Tabs */}
          <div className="flex items-center space-x-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                typeFilter === 'ALL'
                  ? 'bg-white dark:bg-[#003049] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('product')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                typeFilter === 'product'
                  ? 'bg-white dark:bg-[#003049] text-blue-700 dark:text-sky-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Products
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('service')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                typeFilter === 'service'
                  ? 'bg-white dark:bg-[#003049] text-purple-700 dark:text-purple-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Services
            </button>
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-wrap items-center gap-2 flex-1 max-w-xl justify-end">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search code, name, barcode, or category..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2.5 py-1.5 focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2.5 py-1.5 focus:outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Revenue Items Table */}
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 text-[11px]">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Type</th>
                <th className="py-2.5 px-3 font-semibold">Code</th>
                <th className="py-2.5 px-3 font-semibold">Item</th>
                <th className="py-2.5 px-3 font-semibold">Unit</th>
                <th className="py-2.5 px-3 font-semibold text-right">Rate</th>
                <th className="py-2.5 px-3 font-semibold text-right">Cost</th>
                <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                <th className="py-2.5 px-3 font-semibold text-center">Plans</th>
                <th className="py-2.5 px-3 font-semibold text-right">Total</th>
                <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans text-xs">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    Loading...
                  </td>
                </tr>
              ) : displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No items found.
                  </td>
                </tr>
              ) : (
                displayedItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-900/60 transition-colors"
                  >
                    {/* Classification */}
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${
                          item.type === 'service'
                            ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                            : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                        }`}
                      >
                        {item.type === 'service' ? (
                          <Wrench className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                        ) : (
                          <Package className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                        )}
                        <span>{item.type}</span>
                      </span>
                    </td>

                    {/* Code & Barcode */}
                    <td className="py-2.5 px-3 font-mono">
                      <div className="font-bold text-[#0078d4] dark:text-sky-400">{item.code}</div>
                      {item.barcode && (
                        <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                          <BarcodeIcon className="w-3 h-3" />
                          <span>{item.barcode}</span>
                        </div>
                      )}
                    </td>

                    {/* Item Name & Category */}
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900 dark:text-slate-100">{item.name}</div>
                      <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 mt-0.5">
                        <span>{item.category}</span>
                        {item.subCategory && (
                          <>
                            <span>•</span>
                            <span className="italic">{item.subCategory}</span>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Unit */}
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-600 dark:text-slate-300">
                      {item.unit}
                    </td>

                    {/* Default Selling Rate */}
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(item.defaultRate, item.currency || activeCurrency)}
                    </td>

                    {/* Cost Reference */}
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                      {formatCurrency(item.costPrice || 0, item.currency || activeCurrency)}
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded ${
                          item.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>

                    {/* Linked Plans Count */}
                    <td className="py-2.5 px-3 text-center font-mono">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300">
                        {item.linkedPlansCount || 0}
                      </span>
                    </td>

                    {/* Quoted Total */}
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(item.totalQuotedRevenue || 0, activeCurrency)}
                    </td>

                    {/* Action buttons */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {/* Quick Add to Plan */}
                        <button
                          type="button"
                          onClick={() => {
                            setAddToPlanTargetItem(item);
                            setIsAddToPlanModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-blue-50 dark:bg-sky-950/60 hover:bg-blue-100 dark:hover:bg-sky-900 text-blue-700 dark:text-sky-300 border border-blue-200 dark:border-blue-800 text-[11px] font-semibold transition-colors cursor-pointer flex items-center space-x-1"
                          title="Add this revenue item to a project plan BOQ"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Add to Plan</span>
                        </button>

                        {/* Rate History */}
                        <button
                          type="button"
                          onClick={() => {
                            setHistoryTargetItem(item);
                            setIsHistoryModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-semibold transition-colors cursor-pointer flex items-center space-x-1"
                          title="View historical commercial rates and quantities across plans"
                        >
                          <History className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          <span className="hidden sm:inline">History</span>
                        </button>

                        {/* Edit Item */}
                        <button
                          type="button"
                          onClick={() => {
                            setItemToEdit(item);
                            setIsCreateEditOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Edit catalogue item"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div>
            <span>{totalCount} records</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Modals */}
      <CreateEditRevenueItemModal
        isOpen={isCreateEditOpen}
        onClose={() => {
          setIsCreateEditOpen(false);
          setItemToEdit(null);
        }}
        onSave={() => {
          loadData();
          if (showNotification) showNotification('Revenue catalogue item saved successfully.');
        }}
        itemToEdit={itemToEdit}
        categories={categories}
        activeCurrency={activeCurrency}
      />

      <RevenueItemRateHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false);
          setHistoryTargetItem(null);
        }}
        revenueItem={historyTargetItem}
        activeCurrency={activeCurrency}
      />

      <AddRevenueItemToPlanModal
        isOpen={isAddToPlanModalOpen}
        onClose={() => {
          setIsAddToPlanModalOpen(false);
          setAddToPlanTargetItem(null);
        }}
        onSuccess={() => {
          loadData();
          if (showNotification) showNotification('Revenue item added to project plan BOQ successfully.');
        }}
        plans={plans}
        projects={projects}
        preselectedRevenueItem={addToPlanTargetItem}
        activeCurrency={activeCurrency}
      />
    </div>
  );
};
