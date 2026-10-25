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
  Tag,
  LayoutGrid,
  ListFilter,
  ArrowLeft,
  FolderPlus,
  Sliders,
  CheckCircle2,
  Sparkles,
  Table,
  X
} from 'lucide-react';
import { OverheadItem, OverheadCategory, OverheadAuditLog, Project, CategoryNode } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, getStoredCurrency } from '../../utils/currency';
import { peekNextNumber, generateNextNumber } from '../../services/autoNumberingService';
import { CreateEditOverheadItemModal } from './CreateEditOverheadItemModal';
import { ModernTileCard } from '../ModernTileCard';
import { bizStore } from '../../services/bizStore';
import { FXTTPriceAuditLogFullScreenModal, FXTTPriceAuditEntry } from '../FXTTPriceAuditLogFullScreenModal';
import { FXTTCardItemsListView } from '../FXTTCardItemsListView';

interface OverheadCostPortalProps {
  currentUser?: any;
  projects?: Project[];
  onOpenPlan?: (planId: string) => void;
  showToast?: (msg: string | { message: string; type?: string }) => void;
  onAddOverheadItem?: (item: OverheadItem) => void;
}

export const OverheadCostPortal: React.FC<OverheadCostPortalProps> = ({
  currentUser,
  projects = [],
  onOpenPlan,
  showToast,
  onAddOverheadItem
}) => {
  const [items, setItems] = useState<OverheadItem[]>([]);
  const [overheadCategories, setOverheadCategories] = useState<OverheadCategory[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [auditLogs, setAuditLogs] = useState<OverheadAuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  // Top level views: Cards View (default), Catalogue Table, FXTT Table View, Audit Log
  const [activeSubTab, setActiveSubTab] = useState<'cards' | 'catalogue' | 'fxtt' | 'audit'>('cards');

  // FXTT Price Audit Log modal state for overheads
  const [fxttAuditItem, setFxttAuditItem] = useState<any | null>(null);
  const [fxttAuditHistory, setFxttAuditHistory] = useState<FXTTPriceAuditEntry[]>([]);
  const [isFxttAuditOpen, setIsFxttAuditOpen] = useState(false);

  // In-app deletion confirmation modals state (Replaces window.confirm)
  const [deletingCategory, setDeletingCategory] = useState<{ id: string; name: string } | null>(null);
  const [deletingOverheadItem, setDeletingOverheadItem] = useState<OverheadItem | null>(null);
  const [isExecutingDelete, setIsExecutingDelete] = useState(false);

  // Open FXTT price changes and rate audit modal for any overhead item
  const handleOpenOverheadPriceAudit = async (item: OverheadItem) => {
    setFxttAuditItem({
      id: item.id,
      code: item.code,
      name: item.name,
      rate: Number(item.defaultRate) || 0,
      unit: item.unitType === 'pct' ? '%' : (item.unitType || 'unit'),
      category: item.category || 'Operating Overheads',
      classification: 'overhead',
      stockOrScope: `Method: ${item.defaultCalculationMethod || 'percentage_of_direct'} • Base: ${item.defaultCostBase || 'total_direct_cost'}`
    });
    setIsFxttAuditOpen(true);

    try {
      const logs = await api.getOverheadAuditLogs({ limit: 100 });
      const itemLogs = (Array.isArray(logs) ? logs : (logs as any)?.data || []).filter(
        (l: any) => l.overheadItemId === item.id || l.id === item.id
      );

      if (itemLogs.length > 0) {
        setFxttAuditHistory(
          itemLogs.map((l: any, idx: number) => {
            const prev = Number(l.previousState?.defaultRate ?? item.defaultRate);
            const curr = Number(l.newState?.defaultRate ?? item.defaultRate);
            const changePct = prev > 0 ? Number((((curr - prev) / prev) * 100).toFixed(1)) : 0;
            return {
              id: l.id || `ovh-log-${idx}`,
              date: l.createdAt ? new Date(l.createdAt).toISOString().split('T')[0] : (item.effectiveDate || new Date().toISOString().split('T')[0]),
              previousRate: prev,
              newRate: curr,
              changePct,
              reason: l.changeDescription || `${l.action} - Overhead rate change`,
              approvedBy: l.actorName || 'Financial Controller',
              vendorOrContractor: 'Internal Organization Overhead',
              status: 'Approved',
              skuCode: item.code,
              itemName: item.name,
              unit: item.unitType || 'pct',
              notes: `Base: ${item.defaultCostBase || 'total_direct_cost'} • Method: ${item.defaultCalculationMethod || 'percentage_of_direct'}`
            };
          })
        );
      } else {
        const entries: FXTTPriceAuditEntry[] = (item.linkedPlans || []).map((lp, idx) => ({
          id: lp.allocationId || `alloc-${idx}`,
          date: lp.effectiveDate || new Date().toISOString().split('T')[0],
          previousRate: Number(lp.allocationRate) || item.defaultRate,
          newRate: Number(lp.allocationRate) || item.defaultRate,
          changePct: 0,
          reason: `Allocation to plan ${lp.planName || lp.planNumber} (${lp.allocationMethod})`,
          approvedBy: lp.allocatedBy || 'Financial Controller',
          vendorOrContractor: 'Internal Organization Overhead',
          status: 'Active',
          skuCode: item.code,
          itemName: item.name,
          unit: item.unitType || 'pct'
        }));

        if (entries.length === 0) {
          entries.push({
            id: `base-${item.id}`,
            date: item.effectiveDate || new Date().toISOString().split('T')[0],
            previousRate: Number(item.defaultRate) || 0,
            newRate: Number(item.defaultRate) || 0,
            changePct: 0,
            reason: 'Baseline overhead rate schedule established in PostgreSQL',
            approvedBy: item.createdBy || 'Financial Controller',
            vendorOrContractor: 'Internal Organization Overhead',
            status: 'Active',
            skuCode: item.code,
            itemName: item.name,
            unit: item.unitType || 'pct',
            notes: `Method: ${item.defaultCalculationMethod} • Base: ${item.defaultCostBase}`
          });
        }
        setFxttAuditHistory(entries);
      }
    } catch (e) {
      console.warn('Could not load overhead audit logs:', e);
    }
  };

  // Hierarchy drilldown state
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [selectedSubCatId, setSelectedSubCatId] = useState<string | null>(null);

  // Theme overrides
  const [themeOverrides, setThemeOverrides] = useState<Record<string, { themeId: string; customGradient?: string }>>(() => {
    try {
      const saved = bizStore.getItem('overhead_tile_theme_overrides');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Modals state
  const [isCreateEditOpen, setIsCreateEditOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<OverheadItem | null>(null);
  const [presetCategoryName, setPresetCategoryName] = useState<string | undefined>(undefined);
  const [presetSubCategoryName, setPresetSubCategoryName] = useState<string | undefined>(undefined);

  // Category and Subcategory Modals
  const [isCreateCategoryModalOpen, setIsCreateCategoryModalOpen] = useState(false);
  const [isCreateSubCatModalOpen, setIsCreateSubCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatCode, setNewCatCode] = useState('');
  const [newCatBrief, setNewCatBrief] = useState('');

  // Filtering
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const activeCurrency = getStoredCurrency();

  const loadData = async () => {
    setLoading(true);
    try {
      const [itemsRes, catsRes, allCategoriesRes, logsRes] = await Promise.all([
        api.getOverheadItems({ limit: 200 }),
        api.getOverheadCategories(),
        api.getCategories(),
        api.getOverheadAuditLogs({ limit: 50 })
      ]);
      setItems(Array.isArray(itemsRes) ? itemsRes : (itemsRes as any)?.data || []);
      setOverheadCategories(catsRes || []);
      setCategories(Array.isArray(allCategoriesRes) ? allCategoriesRes : (allCategoriesRes as any)?.data || []);
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

  const handleUpdateTileTheme = (id: string, newThemeId: string, customGrad?: string) => {
    setThemeOverrides((prev) => {
      const updated = { ...prev, [id]: { themeId: newThemeId, customGradient: customGrad } };
      try {
        bizStore.setItem('overhead_tile_theme_overrides', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // Check if category or item
    const isCat = categories.some((c) => c.id === id);
    if (isCat) {
      api.updateCategory(id, { themeId: newThemeId, customGradient: customGrad }).catch(console.error);
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, themeId: newThemeId, customGradient: customGrad } : c))
      );
    } else {
      api.updateOverheadItem(id, { themeId: newThemeId, customGradient: customGrad }).catch(console.error);
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, themeId: newThemeId, customGradient: customGrad } : i))
      );
    }
  };

  const getTileStyle = (id: string, defaultThemeId: string = 'amber-forge') => {
    const override = themeOverrides[id];
    if (override && override.themeId) return override;
    const cat = categories.find((c) => c.id === id);
    if (cat && (cat.themeId || cat.customGradient)) {
      return { themeId: cat.themeId || defaultThemeId, customGradient: cat.customGradient };
    }
    const item = items.find((i) => i.id === id);
    if (item && (item.themeId || item.customGradient)) {
      return { themeId: item.themeId || defaultThemeId, customGradient: item.customGradient };
    }
    return { themeId: defaultThemeId };
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      const catCode = newCatCode.trim() || generateNextNumber('overhead_categories', true);
      const payload = {
        name: newCatName.trim(),
        code: catCode,
        brief: newCatBrief.trim() || 'Overhead operations cost center',
        group: 'overhead',
        type: 'category',
        themeId: 'amber-forge'
      };

      await api.createCategory(payload);
      await api.createOverheadCategory({
        name: payload.name,
        code: payload.code,
        description: payload.brief
      });

      setNewCatName('');
      setNewCatCode('');
      setNewCatBrief('');
      setIsCreateCategoryModalOpen(false);
      await loadData();
      if (showToast) showToast(`Overhead category "${payload.name}" created successfully.`);
    } catch (err: any) {
      console.error('Failed to create overhead category:', err);
      if (showToast) showToast({ message: 'Failed to create category: ' + err.message, type: 'error' });
    }
  };

  const handleCreateSubCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || !selectedCatId) return;

    const parent = categories.find((c) => c.id === selectedCatId);
    try {
      const payload = {
        name: newCatName.trim(),
        code: newCatCode.trim() || `SUB-${Date.now().toString().slice(-4)}`,
        brief: newCatBrief.trim() || `Sub-category under ${parent?.name || 'Overheads'}`,
        group: 'overhead',
        type: 'sub_category',
        parentId: selectedCatId,
        parentName: parent?.name,
        themeId: 'sunset-amber'
      };

      await api.createCategory(payload);

      setNewCatName('');
      setNewCatCode('');
      setNewCatBrief('');
      setIsCreateSubCatModalOpen(false);
      await loadData();
      if (showToast) showToast(`Sub-category "${payload.name}" created under ${parent?.name}.`);
    } catch (err: any) {
      console.error('Failed to create sub-category:', err);
      if (showToast) showToast({ message: 'Failed to create sub-category: ' + err.message, type: 'error' });
    }
  };

  const handleDeleteCategory = (catId: string, catName: string) => {
    setDeletingCategory({ id: catId, name: catName });
  };

  const confirmDeleteCategory = async () => {
    if (!deletingCategory) return;
    setIsExecutingDelete(true);
    try {
      await api.deleteCategory(deletingCategory.id);
      await loadData();
      if (selectedCatId === deletingCategory.id) setSelectedCatId(null);
      if (selectedSubCatId === deletingCategory.id) setSelectedSubCatId(null);
      if (showToast) showToast(`Category "${deletingCategory.name}" removed from database.`);
      setDeletingCategory(null);
    } catch (err: any) {
      console.error('Failed to delete category:', err);
      if (showToast) showToast({ message: 'Failed to delete category: ' + err.message, type: 'error' });
    } finally {
      setIsExecutingDelete(false);
    }
  };

  const confirmDeleteOverheadItem = async () => {
    if (!deletingOverheadItem) return;
    setIsExecutingDelete(true);
    try {
      await api.deleteOverheadItem(deletingOverheadItem.id);
      await loadData();
      if (showToast) showToast(`Overhead item "${deletingOverheadItem.name}" permanently deleted.`);
      setDeletingOverheadItem(null);
    } catch (err: any) {
      console.error('Failed to delete overhead item:', err);
      if (showToast) showToast({ message: 'Failed to delete overhead item: ' + err.message, type: 'error' });
    } finally {
      setIsExecutingDelete(false);
    }
  };

  // Overhead categories list from DB
  const overheadCatNodes = categories.filter((c) => c.group === 'overhead' && c.type === 'category');
  const selectedCatNode = categories.find((c) => c.id === selectedCatId);
  const selectedSubCatNode = categories.find((c) => c.id === selectedSubCatId);

  // Subcategories for current selected category
  const overheadSubCatNodes = categories.filter(
    (c) =>
      c.group === 'overhead' &&
      c.type === 'sub_category' &&
      (c.parentId === selectedCatId || (selectedCatNode && c.parentName === selectedCatNode.name))
  );

  // Filtered catalogue items
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
      {/* 1. Top Banner */}
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-500 text-white flex items-center justify-center shadow-md">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <span>Overheads</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-mono font-semibold">
                  {overheadCatNodes.length} Categories • {items.length} Items
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setItemToEdit(null);
                setPresetCategoryName(selectedCatNode?.name);
                setPresetSubCategoryName(selectedSubCatNode?.name);
                setIsCreateEditOpen(true);
              }}
              className="px-3 py-1.5 bg-[#003049] hover:bg-[#002235] text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-[#fdf0d5]" />
              <span>Add</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setNewCatName('');
                setNewCatCode('');
                setNewCatBrief('');
                setIsCreateCategoryModalOpen(true);
              }}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5 text-amber-700" />
              <span>Category</span>
            </button>

            {/* View switcher: Cards | Table | Ledger | Audit */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveSubTab('cards')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeSubTab === 'cards'
                    ? 'bg-white dark:bg-[#003049] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5 text-amber-500" />
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('catalogue')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeSubTab === 'catalogue'
                    ? 'bg-white dark:bg-[#003049] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5 text-blue-500" />
                <span>Table</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('fxtt')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeSubTab === 'fxtt'
                    ? 'bg-white dark:bg-[#003049] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
                title="View full interactive FXTT Data Grid with Price Changes and Rate Revision Logs"
              >
                <Table className="w-3.5 h-3.5 text-emerald-500" />
                <span>Ledger</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('audit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeSubTab === 'audit'
                    ? 'bg-white dark:bg-[#003049] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <History className="w-3.5 h-3.5 text-indigo-500" />
                <span>Audit</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. TAB: CARDS VIEW (Hierarchical ModernTileCards with Gradient Themes) */}
      {activeSubTab === 'cards' && (
        <div className="space-y-4">
          {/* Breadcrumb Navigation Header */}
          <div className="bg-white dark:bg-[#0b101b] p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center space-x-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setSelectedCatId(null);
                  setSelectedSubCatId(null);
                }}
                className={`hover:text-[#003049] dark:hover:text-amber-400 transition-colors cursor-pointer ${
                  !selectedCatId ? 'font-bold text-[#003049] dark:text-white' : ''
                }`}
              >
                Categories
              </button>

              {selectedCatId && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setSelectedSubCatId(null)}
                    className={`hover:text-[#003049] dark:hover:text-amber-400 transition-colors cursor-pointer ${
                      !selectedSubCatId ? 'font-bold text-[#003049] dark:text-white' : ''
                    }`}
                  >
                    {selectedCatNode?.name || 'Category'}
                  </button>
                </>
              )}

              {selectedSubCatId && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-bold text-[#003049] dark:text-amber-400">
                    {selectedSubCatNode?.name || 'Items'}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {selectedCatId && !selectedSubCatId && (
                <button
                  type="button"
                  onClick={() => {
                    setNewCatName('');
                    setNewCatCode('');
                    setNewCatBrief('');
                    setIsCreateSubCatModalOpen(true);
                  }}
                  className="px-2.5 py-1 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Sub</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setItemToEdit(null);
                  setPresetCategoryName(selectedCatNode?.name);
                  setPresetSubCategoryName(selectedSubCatNode?.name);
                  setIsCreateEditOpen(true);
                }}
                className="px-2.5 py-1 text-xs bg-[#003049] hover:bg-[#002235] text-white rounded-lg font-semibold flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5 text-[#fdf0d5]" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Level 1: Categories Cards */}
          {!selectedCatId && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Categories
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {overheadCatNodes.length} categories
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {overheadCatNodes.map((cat) => {
                  const style = getTileStyle(cat.id, cat.themeId || 'amber-forge');
                  const subCats = categories.filter((s) => s.parentId === cat.id || s.parentName === cat.name);
                  const matchingItems = items.filter(
                    (item) => item.category?.toLowerCase().trim() === cat.name.toLowerCase().trim()
                  );

                  return (
                    <ModernTileCard
                      key={cat.id}
                      id={cat.id}
                      tag="CATEGORY"
                      title={cat.name}
                      brief={cat.brief || `${matchingItems.length} items`}
                      actionLabel="Explore"
                      actionVariant="button"
                      themeId={style.themeId}
                      customGradient={style.customGradient}
                      onChangeTheme={(tId, grad) => handleUpdateTileTheme(cat.id, tId, grad)}
                      onAction={() => setSelectedCatId(cat.id)}
                      onEdit={() => {
                        setNewCatName(cat.name);
                        setNewCatCode(cat.code || '');
                        setNewCatBrief(cat.brief || '');
                        setIsCreateCategoryModalOpen(true);
                      }}
                      onDelete={() => handleDeleteCategory(cat.id, cat.name)}
                      extraMeta={
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-[11px] text-white/95">
                            <span className="bg-black/30 px-2 py-0.5 rounded text-[10px] font-mono">
                              {matchingItems.length} Items • {subCats.length} Sub-Categories
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCatId(cat.id);
                                setIsCreateSubCatModalOpen(true);
                              }}
                              className="text-[10px] text-white hover:underline font-semibold bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded cursor-pointer transition-colors"
                            >
                              + Sub
                            </button>
                          </div>
                          {subCats.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {subCats.slice(0, 3).map((sub) => (
                                <span
                                  key={sub.id}
                                  className="text-[9px] px-1.5 py-0.5 bg-black/35 text-white/95 rounded backdrop-blur-xs font-medium"
                                >
                                  {sub.name}
                                </span>
                              ))}
                              {subCats.length > 3 && (
                                <span className="text-[9px] px-1.5 py-0.5 bg-black/45 text-white/85 rounded font-medium">
                                  +{subCats.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      }
                    />
                  );
                })}
              </div>

              {overheadCatNodes.length === 0 && (
                <div className="text-center py-12 bg-white dark:bg-[#0b101b] rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Overhead Categories</h3>
                  <p className="text-xs text-slate-400 mt-1">Create an overhead category to organize indirect costs.</p>
                  <button
                    type="button"
                    onClick={() => setIsCreateCategoryModalOpen(true)}
                    className="mt-3 px-3 py-1.5 bg-[#003049] text-white rounded-lg text-xs font-semibold"
                  >
                    + Create First Category
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Level 2: Sub-Categories Cards */}
          {selectedCatId && !selectedSubCatId && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCatId(null)}
                    className="text-xs text-[#003049] dark:text-sky-400 hover:underline flex items-center space-x-1 cursor-pointer font-semibold"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Categories</span>
                  </button>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                    {selectedCatNode?.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateSubCatModalOpen(true)}
                  className="px-2.5 py-1 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Sub</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {overheadSubCatNodes.map((subCat) => {
                  const style = getTileStyle(subCat.id, subCat.themeId || 'sunset-amber');
                  const matchingItems = items.filter(
                    (o) =>
                      (o.subCategory && o.subCategory.toLowerCase().trim() === subCat.name.toLowerCase().trim()) ||
                      o.subCategoryId === subCat.id
                  );

                  return (
                    <ModernTileCard
                      key={subCat.id}
                      id={subCat.id}
                      tag="SUB-CATEGORY"
                      title={subCat.name}
                      brief={subCat.brief || `${matchingItems.length} items`}
                      actionLabel="Explore"
                      actionVariant="button"
                      themeId={style.themeId}
                      customGradient={style.customGradient}
                      onChangeTheme={(tId, grad) => handleUpdateTileTheme(subCat.id, tId, grad)}
                      onAction={() => setSelectedSubCatId(subCat.id)}
                      onEdit={() => {
                        setSelectedCatId(subCat.parentId || selectedCatId);
                        setNewCatName(subCat.name);
                        setNewCatCode(subCat.code || '');
                        setNewCatBrief(subCat.brief || '');
                        setIsCreateSubCatModalOpen(true);
                      }}
                      onDelete={() => handleDeleteCategory(subCat.id, subCat.name)}
                      extraMeta={
                        <div className="flex items-center justify-between text-[11px] text-white/90 pt-1">
                          <span className="bg-black/25 px-2 py-0.5 rounded text-[10px] font-mono">
                            {matchingItems.length} Items
                          </span>
                        </div>
                      }
                    />
                  );
                })}
              </div>

              {overheadSubCatNodes.length === 0 && (
                <div className="text-center py-12 bg-white dark:bg-[#0b101b] rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <p className="text-xs text-slate-500">No sub-categories</p>
                  <button
                    type="button"
                    onClick={() => setIsCreateSubCatModalOpen(true)}
                    className="mt-2 px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-lg"
                  >
                    Sub
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Level 3: Overhead Items for Selected Sub-Category */}
          {selectedSubCatId && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSubCatId(null)}
                    className="text-xs text-[#003049] dark:text-sky-400 hover:underline flex items-center space-x-1 cursor-pointer font-semibold"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {selectedSubCatNode?.name}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setItemToEdit(null);
                    setPresetCategoryName(selectedCatNode?.name);
                    setPresetSubCategoryName(selectedSubCatNode?.name);
                    setIsCreateEditOpen(true);
                  }}
                  className="px-2.5 py-1 text-xs bg-[#003049] text-white rounded-lg font-semibold flex items-center space-x-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-[#fdf0d5]" />
                  <span>Add</span>
                </button>
              </div>

              {/* Overhead Items Grid Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {items
                  .filter((o) => {
                    const subName = selectedSubCatNode?.name.toLowerCase().trim();
                    const subId = selectedSubCatNode?.id;
                    const oSub = (o.subCategory || '').toLowerCase().trim();
                    return (subId && o.subCategoryId === subId) || (subName && oSub === subName);
                  })
                  .map((item) => {
                    const style = getTileStyle(item.id, item.themeId || 'copper-canyon');
                    return (
                      <ModernTileCard
                        key={item.id}
                        id={item.id}
                        tag={item.costType ? item.costType.replace(/_/g, ' ').toUpperCase() : 'TARIFF'}
                        title={item.name}
                        brief={`Code: ${item.code}`}
                        actionLabel="Edit"
                        actionVariant="button"
                        themeId={style.themeId}
                        customGradient={style.customGradient}
                        onChangeTheme={(tId, grad) => handleUpdateTileTheme(item.id, tId, grad)}
                        onAction={() => {
                          setItemToEdit(item);
                          setIsCreateEditOpen(true);
                        }}
                        onEdit={() => {
                          setItemToEdit(item);
                          setIsCreateEditOpen(true);
                        }}
                        onDelete={() => {
                          setDeletingOverheadItem(item);
                        }}
                        extraMeta={
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-[11px] text-white/95">
                              <span className="font-mono font-bold bg-black/30 px-2 py-0.5 rounded text-[11px]">
                                {item.defaultCalculationMethod === 'percentage_of_direct'
                                  ? `${item.defaultRate}%`
                                  : formatCurrency(item.defaultRate, activeCurrency)}
                              </span>
                              <span className="bg-emerald-500/80 text-white px-1.5 py-0.2 rounded text-[10px] font-bold">
                                {item.status || 'Active'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between pt-0.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenOverheadPriceAudit(item);
                                }}
                                className="text-[10px] bg-white/20 hover:bg-white/30 text-white font-semibold px-2 py-0.5 rounded cursor-pointer flex items-center space-x-1 transition-colors"
                                title="Audit"
                              >
                                <History className="w-3 h-3 text-[#fdf0d5]" />
                                <span>Audit</span>
                              </button>
                              <span className="text-[10px] text-white/70 font-mono">
                                {item.code}
                              </span>
                            </div>
                          </div>
                        }
                      />
                    );
                  })}
              </div>

              {items.filter((o) => {
                const subName = selectedSubCatNode?.name.toLowerCase().trim();
                const subId = selectedSubCatNode?.id;
                const oSub = (o.subCategory || '').toLowerCase().trim();
                return (subId && o.subCategoryId === subId) || (subName && oSub === subName);
              }).length === 0 && (
                <div className="p-8 text-center bg-white dark:bg-[#0b101b] rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <p className="text-xs text-slate-500">No overhead items registered under this sub-category yet.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setItemToEdit(null);
                      setPresetCategoryName(selectedCatNode?.name);
                      setPresetSubCategoryName(selectedSubCatNode?.name);
                      setIsCreateEditOpen(true);
                    }}
                    className="mt-2 px-3 py-1.5 bg-[#003049] text-white rounded-lg text-xs font-semibold"
                  >
                    + Add Item Now
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. TAB: CATALOGUE TABLE */}
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
                {overheadCatNodes.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2.5 py-1.5 focus:outline-none"
              >
                <option value="ALL">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
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
                  <th className="py-2.5 px-3 font-semibold">Sub-Category</th>
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
                    <td className="py-2.5 px-3 text-slate-500 font-medium">
                      {item.subCategory || '-'}
                    </td>
                    <td className="py-2.5 px-3 capitalize">{item.costType?.replace(/_/g, ' ')}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] capitalize">{item.defaultCalculationMethod?.replace(/_/g, ' ')}</td>
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
                          onClick={() => handleOpenOverheadPriceAudit(item)}
                          className="p-1 hover:bg-indigo-100 dark:hover:bg-indigo-950/40 rounded text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer"
                          title="View Price Changes & Rate Revision History in FXTT Table"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
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
                          onClick={() => {
                            setDeletingOverheadItem(item);
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
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No overhead items found matching the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. TAB: FXTT TABLE VIEW (Full interactive FXTT Grid with Price History & Rate Audit) */}
      {activeSubTab === 'fxtt' && (
        <div className="bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800 p-2 shadow-xs">
          <FXTTCardItemsListView
            cardType="overhead"
            cardId="all-overheads"
            cardTitle="Overhead Indirect Costs & Absorption Rates"
            cardSubtitle={`${items.length} Overhead Items, Facility Absorption, SG&A Burdens & Rate History`}
            cardTag="OVERHEAD DIRECTORY"
            materials={[]}
            suppliers={[]}
            outsourcedServices={[]}
            subcontractors={[]}
            projects={projects}
            overheads={items}
            onClose={() => setActiveSubTab('cards')}
            onUpdatePrice={async (id, price, reason) => {
              await api.updateOverheadItem(id, { defaultRate: price });
              await loadData();
              if (showToast) showToast(`Updated overhead rate to ${price}`);
            }}
            onDeleteOverheadItem={async (id) => {
              await api.deleteOverheadItem(id);
              await loadData();
              if (showToast) showToast('Overhead item deleted from PostgreSQL database.');
            }}
            onAddOverheadItem={async (newItem) => {
              await api.createOverheadItem(newItem as any);
              await loadData();
              if (showToast) showToast(`Added overhead item ${newItem.name}`);
            }}
            isModal={false}
          />
        </div>
      )}

      {/* 4. TAB: AUDIT LOG */}
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
            {auditLogs.length === 0 && (
              <div className="py-6 text-center text-slate-400">
                No audit entries recorded yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Create / Edit Overhead Category */}
      {isCreateCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#0b101b] rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <FolderPlus className="w-4 h-4 text-amber-500" />
                <span>New Overhead Category</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateCategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateCategory} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Corporate SG&A, Facility Utilities"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. OVH-SGA"
                  value={newCatCode}
                  onChange={(e) => setNewCatCode(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Brief Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Indirect operational and executive administration"
                  value={newCatBrief}
                  onChange={(e) => setNewCatBrief(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateCategoryModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create Sub-Category */}
      {isCreateSubCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#0b101b] rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Layers className="w-4 h-4 text-amber-500" />
                <span>New Sub-Category under {selectedCatNode?.name || 'Category'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateSubCatModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSubCategory} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sub-Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Legal & Compliance, Office Lease"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sub-Category Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. SUB-LGL"
                  value={newCatCode}
                  onChange={(e) => setNewCatCode(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Brief Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Retainers and regulatory audit expenses"
                  value={newCatBrief}
                  onChange={(e) => setNewCatBrief(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateSubCatModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold"
                >
                  Save Sub-Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create/Edit Overhead Item */}
      <CreateEditOverheadItemModal
        isOpen={isCreateEditOpen}
        onClose={() => {
          setIsCreateEditOpen(false);
          setItemToEdit(null);
          setPresetCategoryName(undefined);
          setPresetSubCategoryName(undefined);
        }}
        itemToEdit={itemToEdit}
        onSave={(saved) => {
          if (onAddOverheadItem) onAddOverheadItem(saved);
          loadData();
          if (showToast) showToast(`Overhead item "${saved.name}" saved successfully.`);
        }}
        onDelete={async (id) => {
          await api.deleteOverheadItem(id);
          loadData();
          if (showToast) showToast('Overhead item permanently deleted from PostgreSQL.');
        }}
      />

      {/* MODAL: FXTT Full Screen Price Changes Audit Log */}
      {isFxttAuditOpen && fxttAuditItem && (
        <FXTTPriceAuditLogFullScreenModal
          isOpen={isFxttAuditOpen}
          onClose={() => {
            setIsFxttAuditOpen(false);
            setFxttAuditItem(null);
          }}
          item={fxttAuditItem}
          customHistory={fxttAuditHistory}
          onOpenItemDetails={(it) => {
            setIsFxttAuditOpen(false);
            const found = items.find((o) => o.id === it.id);
            if (found) {
              setItemToEdit(found);
              setIsCreateEditOpen(true);
            }
          }}
        />
      )}

      {/* MODAL: Confirm Delete Category */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/80 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Delete Category</h3>
                <p className="text-[11px] text-slate-500 font-mono">Overhead Structure</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to delete category <strong className="text-slate-900 dark:text-slate-100">"{deletingCategory.name}"</strong>? This will remove it from PostgreSQL and unlink referenced overhead items.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingCategory(null)}
                disabled={isExecutingDelete}
                className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteCategory}
                disabled={isExecutingDelete}
                className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
              >
                {isExecutingDelete ? 'Deleting...' : 'Delete Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirm Delete Overhead Item */}
      {deletingOverheadItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/80 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Delete Overhead Item</h3>
                <p className="text-[11px] text-slate-500 font-mono">{deletingOverheadItem.code}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Permanently delete <strong className="text-slate-900 dark:text-slate-100">"{deletingOverheadItem.name}"</strong>? This will remove the overhead item and its plan allocations from PostgreSQL.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingOverheadItem(null)}
                disabled={isExecutingDelete}
                className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteOverheadItem}
                disabled={isExecutingDelete}
                className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
              >
                {isExecutingDelete ? 'Deleting...' : 'Delete Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
