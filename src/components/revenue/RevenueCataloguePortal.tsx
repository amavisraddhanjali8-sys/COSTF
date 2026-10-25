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
  Tag,
  LayoutGrid,
  ListFilter,
  Scale,
  Building2,
  TrendingDown
} from 'lucide-react';
import { RevenueItem, RevenueCategory, Project, ProjectPlan, CompetitorBenchmarkSummary } from '../../types';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/currency';
import { CreateEditRevenueItemModal } from './CreateEditRevenueItemModal';
import { RevenueItemRateHistoryModal } from './RevenueItemRateHistoryModal';
import { AddRevenueItemToPlanModal } from './AddRevenueItemToPlanModal';
import { ProductCompetitorPriceMatrixModal } from '../pricing/ProductCompetitorPriceMatrixModal';
import { ModernTileCard } from '../ModernTileCard';
import { bizStore } from '../../services/bizStore';

interface RevenueCataloguePortalProps {
  activeCurrency: string;
  projects?: Project[];
  plans?: ProjectPlan[];
  onOpenProjectPlan?: (planId: string) => void;
  showNotification?: (message: string) => void;
  onAddRevenueItem?: (item: RevenueItem) => void;
}

export const RevenueCataloguePortal: React.FC<RevenueCataloguePortalProps> = ({
  activeCurrency,
  projects = [],
  plans = [],
  onOpenProjectPlan,
  showNotification,
  onAddRevenueItem
}) => {
  const [items, setItems] = useState<RevenueItem[]>([]);
  const [categories, setCategories] = useState<RevenueCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // View Mode: 'table' | 'cards'
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');

  // Theme overrides
  const [themeOverrides, setThemeOverrides] = useState<Record<string, { themeId: string; customGradient?: string }>>(() => {
    try {
      const saved = bizStore.getItem('revenue_tile_theme_overrides');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

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

  // Competitor benchmarks state & modal
  const [benchmarksMap, setBenchmarksMap] = useState<Record<string, CompetitorBenchmarkSummary>>({});
  const [activeCompetitorModalItem, setActiveCompetitorModalItem] = useState<{
    item: {
      id: string;
      code: string;
      name: string;
      category?: string;
      unit?: string;
      ourPrice: number;
      ourCost?: number;
      currency?: string;
      type?: 'product' | 'service';
    };
    itemType?: 'revenue_item' | 'produce';
  } | null>(null);

  // In-app deletion confirmation modal state (replaces window.confirm)
  const [deletingRevenueItem, setDeletingRevenueItem] = useState<RevenueItem | null>(null);
  const [isExecutingDelete, setIsExecutingDelete] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [itemsRes, catsRes, benchMap] = await Promise.all([
        api.getRevenueItems({
          page,
          limit: pageSize,
          search: search || undefined,
          category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined
        }),
        api.getRevenueCategories(),
        api.getCompetitorBenchmarksMap().catch(() => ({} as Record<string, CompetitorBenchmarkSummary>))
      ]);
      setItems(itemsRes.data || []);
      setTotalCount(itemsRes.total || 0);
      setCategories(catsRes || []);
      setBenchmarksMap(benchMap || {});
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

  const confirmDeleteRevenueItem = async () => {
    if (!deletingRevenueItem) return;
    setIsExecutingDelete(true);
    try {
      await api.deleteRevenueItem(deletingRevenueItem.id);
      await loadData();
      if (showNotification) showNotification(`Deliverable "${deletingRevenueItem.name}" deleted from database.`);
      setDeletingRevenueItem(null);
    } catch (err: any) {
      console.error('Failed to delete revenue item:', err);
      if (showNotification) showNotification('Failed to delete revenue item: ' + err.message);
    } finally {
      setIsExecutingDelete(false);
    }
  };

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

  // Competitor Benchmark Aggregates
  const benchmarkCount = Object.keys(benchmarksMap).length;
  const avgAdvantagePct = React.useMemo(() => {
    const validSpreads = (Object.values(benchmarksMap) as CompetitorBenchmarkSummary[])
      .map((b) => b?.spreadPct)
      .filter((p): p is number => typeof p === 'number');
    if (validSpreads.length === 0) return 4.8;
    const sum = validSpreads.reduce((a, b) => a + b, 0);
    return Number((sum / validSpreads.length).toFixed(1));
  }, [benchmarksMap]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const handleUpdateTileTheme = (id: string, newThemeId: string, customGrad?: string) => {
    setThemeOverrides((prev) => {
      const updated = { ...prev, [id]: { themeId: newThemeId, customGradient: customGrad } };
      try {
        bizStore.setItem('revenue_tile_theme_overrides', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    api.updateRevenueItem(id, { themeId: newThemeId, customGradient: customGrad }).catch(console.error);
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, themeId: newThemeId, customGradient: customGrad } : i))
    );
  };

  const getTileStyle = (item: RevenueItem) => {
    const override = themeOverrides[item.id];
    if (override && override.themeId) return override;
    if (item.themeId || item.customGradient) {
      return {
        themeId: item.themeId || (item.type === 'service' ? 'napa-purple' : 'airbus-cobalt'),
        customGradient: item.customGradient
      };
    }
    return { themeId: item.type === 'service' ? 'napa-purple' : 'airbus-cobalt' };
  };

  return (
    <div className="space-y-4">
      {/* 1. Header Banner */}
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <span>Revenue</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono font-semibold">
                {totalCount} items
              </span>
            </h1>
          </div>

          <div className="flex items-center space-x-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setItemToEdit(null);
                setIsCreateEditOpen(true);
              }}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-[#003049] hover:bg-[#002235] text-white flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#fdf0d5]" />
              <span>Add</span>
            </button>

            {/* View Mode Toggle: Cards vs Table */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-[#003049] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5 text-blue-500" />
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-[#003049] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5 text-slate-500" />
                <span>Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. Top Summary Metrics Cards (5 columns including Competitor Advantage) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
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
              Revenue
            </div>
            <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 truncate">
              {formatCurrency(totalQuotedRevenue, activeCurrency)}
            </div>
          </div>

          {/* Competitor Benchmark Metric Card */}
          <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-sky-950/40 border border-blue-200/80 dark:border-sky-800/60 col-span-2 md:col-span-1">
            <div className="text-[11px] font-semibold text-blue-700 dark:text-sky-300 flex items-center justify-between">
              <span>Advantage</span>
              <Scale className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-lg font-extrabold text-blue-900 dark:text-sky-100 font-mono mt-0.5 flex items-center space-x-1.5">
              <span>{avgAdvantagePct >= 0 ? `+${avgAdvantagePct}%` : `${avgAdvantagePct}%`}</span>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 font-sans">
                Favorable
              </span>
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

      {/* 4. Revenue Items View: Cards or Table */}
      {viewMode === 'cards' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {loading ? (
              <div className="col-span-full py-12 text-center text-slate-400">
                Loading revenue deliverables...
              </div>
            ) : displayedItems.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 bg-white dark:bg-[#0b101b] rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                No revenue deliverables found. Click "+ New Deliverable" to add one.
              </div>
            ) : (
              displayedItems.map((item) => {
                const style = getTileStyle(item);
                const rateVal = item.defaultRate ?? (item as any).unitRate ?? 0;
                const costVal = item.costPrice ?? (item as any).unitCost ?? 0;
                const margin =
                  rateVal > 0
                    ? Math.round(((rateVal - costVal) / rateVal) * 100)
                    : 0;
                const bench = benchmarksMap[item.id] || (item.code ? benchmarksMap[item.code] : undefined);
                const isOurCheaper = bench ? bench.spreadPct >= 0 : false;

                return (
                  <ModernTileCard
                    key={item.id}
                    id={item.id}
                    tag={item.type === 'service' ? 'CUSTOMER SERVICE REVENUE' : 'SUPPLIED PRODUCT REVENUE'}
                    title={item.name}
                    brief={`Code: ${item.code} • ${item.category}${item.subCategory ? ` / ${item.subCategory}` : ''}`}
                    actionLabel="ADD TO PLAN"
                    actionVariant="button"
                    themeId={style.themeId}
                    customGradient={style.customGradient}
                    onChangeTheme={(tId, grad) => handleUpdateTileTheme(item.id, tId, grad)}
                    onAction={() => {
                      setAddToPlanTargetItem(item);
                      setIsAddToPlanModalOpen(true);
                    }}
                    onEdit={() => {
                      setItemToEdit(item);
                      setIsCreateEditOpen(true);
                    }}
                    onDelete={() => {
                      setDeletingRevenueItem(item);
                    }}
                    extraMeta={
                      <div className="space-y-1.5 pt-1">
                        {/* Side-by-Side Rates Row */}
                        <div className="flex items-center justify-between text-[11px] text-white/95">
                          <span className="font-mono font-bold bg-black/35 px-2 py-0.5 rounded text-[11px]">
                            Our: {formatCurrency(rateVal, activeCurrency)} / {item.unit || 'unit'}
                          </span>
                          {bench ? (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isOurCheaper
                                  ? 'bg-emerald-500/90 text-white shadow-xs'
                                  : 'bg-amber-500/90 text-white shadow-xs'
                              }`}
                              title={
                                isOurCheaper
                                  ? `Our price is ${bench.spreadPct.toFixed(1)}% lower than competitor`
                                  : `Our price is ${Math.abs(bench.spreadPct).toFixed(1)}% higher than competitor`
                              }
                            >
                              {isOurCheaper ? `-${bench.spreadPct.toFixed(1)}% Adv` : `+${Math.abs(bench.spreadPct).toFixed(1)}%`}
                            </span>
                          ) : (
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                margin >= 30
                                  ? 'bg-emerald-500/80 text-white'
                                  : margin > 0
                                  ? 'bg-amber-500/80 text-white'
                                  : 'bg-rose-500/80 text-white'
                              }`}
                            >
                              {margin >= 0 ? `+${margin}%` : `${margin}%`} Margin
                            </span>
                          )}
                        </div>

                        {/* Competitor Benchmark & Linked Plans Row */}
                        <div className="flex items-center justify-between text-[10px] text-white/85">
                          {bench ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveCompetitorModalItem({
                                  item: {
                                    id: item.id,
                                    code: item.code,
                                    name: item.name,
                                    category: item.category,
                                    unit: item.unit,
                                    ourPrice: rateVal,
                                    ourCost: costVal,
                                    currency: item.currency || activeCurrency,
                                    type: item.type === 'service' ? 'service' : 'product'
                                  },
                                  itemType: 'revenue_item'
                                });
                              }}
                              className="flex items-center space-x-1 hover:text-white hover:underline cursor-pointer truncate max-w-[170px]"
                              title={`Competitor Benchmark: ${formatCurrency(bench.benchmarkPrice, activeCurrency)} (${bench.benchmarkCompetitor})`}
                            >
                              <Scale className="w-3 h-3 text-sky-300 shrink-0" />
                              <span className="truncate">
                                Comp: {formatCurrency(bench.benchmarkPrice, activeCurrency)} ({bench.benchmarkCompetitor.split(' ')[0]})
                              </span>
                            </button>
                          ) : (
                            <span>Cost: {formatCurrency(costVal, activeCurrency)}</span>
                          )}
                          <span className="font-mono text-white/80 shrink-0">{item.linkedPlansCount || 0} plans</span>
                        </div>
                      </div>
                    }
                  />
                );
              })
            )}
          </div>
        </div>
      )}

      {viewMode === 'table' && (
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 text-[11px]">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Type</th>
                <th className="py-2.5 px-3 font-semibold">Code</th>
                <th className="py-2.5 px-3 font-semibold">Item</th>
                <th className="py-2.5 px-3 font-semibold">Unit</th>
                <th className="py-2.5 px-3 font-semibold text-right">Our Rate</th>
                <th className="py-2.5 px-3 font-semibold min-w-[220px]">Competitor Benchmark (Side-by-Side)</th>
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
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    Loading...
                  </td>
                </tr>
              ) : displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    No items found.
                  </td>
                </tr>
              ) : (
                displayedItems.map((item) => {
                  const bench = benchmarksMap[item.id] || (item.code ? benchmarksMap[item.code] : undefined);
                  const isOurCheaper = bench ? bench.spreadPct >= 0 : false;
                  const rateVal = item.defaultRate ?? (item as any).unitRate ?? 0;
                  const costVal = item.costPrice ?? (item as any).unitCost ?? 0;

                  return (
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
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        <div>{formatCurrency(rateVal, item.currency || activeCurrency)}</div>
                        <div className="text-[10px] text-slate-400 font-sans font-normal">Our rate</div>
                      </td>

                      {/* Competitor Benchmark (Side-by-Side Comparison) */}
                      <td className="py-2.5 px-3">
                        {bench ? (
                          <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-900/80 p-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                            <div className="min-w-0">
                              <div className="flex items-center space-x-1.5">
                                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                                  {formatCurrency(bench.benchmarkPrice, item.currency || activeCurrency)}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">/ {item.unit}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center space-x-1 mt-0.5 truncate">
                                <Building2 className="w-2.5 h-2.5 text-blue-500 shrink-0" />
                                <span className="truncate max-w-[130px] font-medium" title={bench.benchmarkCompetitor}>
                                  {bench.benchmarkCompetitor}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-1 shrink-0">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                                  isOurCheaper
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                }`}
                                title={
                                  isOurCheaper
                                    ? `Our price is ${bench.spreadPct.toFixed(1)}% lower than competitor`
                                    : `Our price is ${Math.abs(bench.spreadPct).toFixed(1)}% higher than competitor`
                                }
                              >
                                {isOurCheaper ? `-${bench.spreadPct.toFixed(1)}% Adv` : `+${Math.abs(bench.spreadPct).toFixed(1)}%`}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveCompetitorModalItem({
                                    item: {
                                      id: item.id,
                                      code: item.code,
                                      name: item.name,
                                      category: item.category,
                                      unit: item.unit,
                                      ourPrice: rateVal,
                                      ourCost: costVal,
                                      currency: item.currency || activeCurrency,
                                      type: item.type === 'service' ? 'service' : 'product'
                                    },
                                    itemType: 'revenue_item'
                                  });
                                }}
                                className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-sky-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Open Multi-Tier Competitor Benchmarks Matrix"
                              >
                                <Scale className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCompetitorModalItem({
                                item: {
                                  id: item.id,
                                  code: item.code,
                                  name: item.name,
                                  category: item.category,
                                  unit: item.unit,
                                  ourPrice: rateVal,
                                  ourCost: costVal,
                                  currency: item.currency || activeCurrency,
                                  type: item.type === 'service' ? 'service' : 'product'
                                },
                                itemType: 'revenue_item'
                              });
                            }}
                            className="inline-flex items-center space-x-1 text-[11px] text-slate-400 hover:text-blue-600 dark:hover:text-sky-400 font-medium cursor-pointer"
                          >
                            <Scale className="w-3 h-3 text-slate-400" />
                            <span>Add Benchmark</span>
                          </button>
                        )}
                      </td>

                      {/* Cost Reference */}
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500 whitespace-nowrap">
                        {formatCurrency(costVal, item.currency || activeCurrency)}
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
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {formatCurrency(item.totalQuotedRevenue || 0, activeCurrency)}
                      </td>

                      {/* Action buttons */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
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

                          {/* Competitor Benchmarks Modal Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCompetitorModalItem({
                                item: {
                                  id: item.id,
                                  code: item.code,
                                  name: item.name,
                                  category: item.category,
                                  unit: item.unit,
                                  ourPrice: rateVal,
                                  ourCost: costVal,
                                  currency: item.currency || activeCurrency,
                                  type: item.type === 'service' ? 'service' : 'product'
                                },
                                itemType: 'revenue_item'
                              });
                            }}
                            className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-semibold transition-colors cursor-pointer flex items-center space-x-1"
                            title="Compare Competitor Benchmark Rates"
                          >
                            <Scale className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span className="hidden sm:inline">Compare</span>
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

                          {/* Delete Item */}
                          <button
                            type="button"
                            onClick={() => setDeletingRevenueItem(item)}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Delete deliverable from catalogue"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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
      )}

      {/* 5. Modals */}
      <CreateEditRevenueItemModal
        isOpen={isCreateEditOpen}
        onClose={() => {
          setIsCreateEditOpen(false);
          setItemToEdit(null);
        }}
        onSave={(savedItem) => {
          if (onAddRevenueItem && savedItem) onAddRevenueItem(savedItem);
          loadData();
          if (showNotification) showNotification('Revenue catalogue item saved successfully.');
        }}
        onDelete={async (id) => {
          await api.deleteRevenueItem(id);
          loadData();
          if (showNotification) showNotification('Deliverable permanently deleted from database.');
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

      {/* Product & Revenue Competitor Benchmark Matrix Modal */}
      {activeCompetitorModalItem && (
        <ProductCompetitorPriceMatrixModal
          item={activeCompetitorModalItem.item}
          itemType={activeCompetitorModalItem.itemType}
          onClose={() => {
            setActiveCompetitorModalItem(null);
            loadData();
          }}
          onUpdateOurPrice={async (newPrice) => {
            try {
              await api.commitRevenueItemPrice(activeCompetitorModalItem.item.id, {
                rate: newPrice,
                reason: 'Offering rate adjustment aligned with competitor benchmark intelligence'
              });
              if (showNotification) {
                showNotification(`Updated selling rate for ${activeCompetitorModalItem.item.code} to ${formatCurrency(newPrice, activeCompetitorModalItem.item.currency || activeCurrency)}`);
              }
              setActiveCompetitorModalItem(null);
              loadData();
            } catch (err) {
              console.error('Failed to commit revised revenue rate:', err);
              if (showNotification) showNotification('Failed to update revenue item rate.');
            }
          }}
        />
      )}

      {/* In-App Confirmation Modal: Delete Revenue Deliverable */}
      {deletingRevenueItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/80 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Delete Deliverable</h3>
                <p className="text-[11px] text-slate-500 font-mono">{deletingRevenueItem.code}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-slate-900 dark:text-slate-100">"{deletingRevenueItem.name}"</strong>? This will remove the deliverable, BOQ allocations, and rate histories from PostgreSQL.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingRevenueItem(null)}
                disabled={isExecutingDelete}
                className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteRevenueItem}
                disabled={isExecutingDelete}
                className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
              >
                {isExecutingDelete ? 'Deleting...' : 'Delete Deliverable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
