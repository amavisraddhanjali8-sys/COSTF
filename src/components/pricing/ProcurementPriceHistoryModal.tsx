import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  Filter,
  Calendar,
  Building2,
  Package,
  Layers,
  FileText,
  Clock,
  TrendingUp,
  TrendingDown,
  Plus,
  ArrowUpDown,
  Download,
  Table as TableIcon,
  LayoutGrid,
  History,
  CheckCircle2,
  Tag,
  DollarSign,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  Scale
} from 'lucide-react';
import {
  Supplier,
  MaterialItem,
  OutsourcedService,
  SubcontractorRateItem,
  Project,
  ProcurementPriceRecord,
  PriceComparisonSummary
} from '../../types';
import { api } from '../../services/api';
import { formatCurrency, SUPPORTED_CURRENCIES } from '../../utils/currency';
import { RecordPriceModal } from './RecordPriceModal';

interface ProcurementPriceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSupplierId?: string;
  initialItemId?: string;
  initialItemType?: 'material' | 'outsourced_service' | 'subcontractor_rate';
  initialProjectId?: string;
  suppliers: Supplier[];
  materials: MaterialItem[];
  outsourcedServices: OutsourcedService[];
  subcontractors: SubcontractorRateItem[];
  projects?: Project[];
  showToast?: (toast: { message: string; type?: 'success' | 'error' | 'info' | 'warning' }) => void;
  onSelectPriceForPlan?: (record: ProcurementPriceRecord) => void;
  planNumber?: string;
}

export const ProcurementPriceHistoryModal: React.FC<ProcurementPriceHistoryModalProps> = ({
  isOpen,
  onClose,
  initialSupplierId,
  initialItemId,
  initialItemType,
  initialProjectId,
  suppliers,
  materials,
  outsourcedServices,
  subcontractors,
  projects = [],
  showToast,
  onSelectPriceForPlan,
  planNumber
}) => {
  const [activeTab, setActiveTab] = useState<'history' | 'comparison'>('history');
  const [records, setRecords] = useState<ProcurementPriceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters (Requirement 14)
  const [search, setSearch] = useState<string>('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(initialSupplierId || 'ALL');
  const [selectedItemType, setSelectedItemType] = useState<string>(initialItemType || 'ALL');
  const [selectedItemId, setSelectedItemId] = useState<string>(initialItemId || 'ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || 'ALL');
  const [selectedPriceType, setSelectedPriceType] = useState<string>('ALL');
  const [selectedCostStage, setSelectedCostStage] = useState<string>('ALL');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('effectiveDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Comparison specific state (Requirement 15)
  const [comparisonItemId, setComparisonItemId] = useState<string>(initialItemId || '');
  const [comparisonSummary, setComparisonSummary] = useState<PriceComparisonSummary | null>(null);
  const [loadingComparison, setLoadingComparison] = useState<boolean>(false);

  // Record modal trigger
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordPresetSupplierId, setRecordPresetSupplierId] = useState<string | undefined>(initialSupplierId);
  const [recordPresetItemId, setRecordPresetItemId] = useState<string | undefined>(initialItemId);
  const [recordPresetItemType, setRecordPresetItemType] = useState<'material' | 'outsourced_service' | 'subcontractor_rate' | undefined>(initialItemType);

  // Fetch price history records from PostgreSQL
  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getProcurementPriceHistory({
        search: search.trim() || undefined,
        supplierId: selectedSupplierId !== 'ALL' ? selectedSupplierId : undefined,
        itemType: selectedItemType !== 'ALL' ? selectedItemType : undefined,
        itemId: selectedItemId !== 'ALL' ? selectedItemId : undefined,
        category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        projectId: selectedProjectId !== 'ALL' ? selectedProjectId : undefined,
        priceType: selectedPriceType !== 'ALL' ? selectedPriceType : undefined,
        costStage: selectedCostStage !== 'ALL' ? selectedCostStage : undefined,
        currency: selectedCurrency !== 'ALL' ? selectedCurrency : undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        sortBy,
        sortOrder,
        paginated: true
      });
      const data = Array.isArray(res) ? res : res.data || [];
      setRecords(data);
    } catch (err: any) {
      console.error('Failed to load procurement price history:', err);
      setError(err?.message || 'Failed to fetch price history records');
    } finally {
      setLoading(false);
    }
  };

  // Fetch comparison data when comparison tab is active or comparison item changes
  const loadComparison = async (itemIdToCompare?: string) => {
    const targetId = itemIdToCompare || comparisonItemId || (records[0]?.itemId) || (materials[0]?.id);
    if (!targetId) return;
    setLoadingComparison(true);
    try {
      const summary = await api.getProcurementPriceComparison(targetId);
      setComparisonSummary(summary);
      setComparisonItemId(targetId);
    } catch (err: any) {
      console.warn('Failed to load price comparison data:', err);
    } finally {
      setLoadingComparison(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadHistory();
    }
  }, [
    isOpen,
    search,
    selectedSupplierId,
    selectedItemType,
    selectedItemId,
    selectedCategory,
    selectedProjectId,
    selectedPriceType,
    selectedCostStage,
    selectedCurrency,
    fromDate,
    toDate,
    sortBy,
    sortOrder
  ]);

  useEffect(() => {
    if (isOpen && activeTab === 'comparison') {
      void loadComparison();
    }
  }, [isOpen, activeTab, comparisonItemId]);

  // Unique categories for filtering
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    materials.forEach((m) => m.category && set.add(m.category));
    outsourcedServices.forEach((o) => o.category && set.add(o.category));
    subcontractors.forEach((s) => s.serviceCategory && set.add(s.serviceCategory));
    return Array.from(set).sort();
  }, [materials, outsourcedServices, subcontractors]);

  // Export CSV
  const handleExportCSV = () => {
    if (records.length === 0) {
      showToast?.({ message: 'No records to export.', type: 'info' });
      return;
    }
    const headers = [
      'ID',
      'Effective Date',
      'Recorded Timestamp',
      'Supplier Code / Name',
      'Item Type',
      'Item Code',
      'Item Name',
      'Category',
      'Price Type',
      'Cost Stage',
      'Unit Price',
      'Currency',
      'Unit',
      'Previous Price',
      'Price Change %',
      'Quotation Ref',
      'Valid From',
      'Valid Until',
      'Project',
      'Recorded By',
      'Notes'
    ];
    const rows = records.map((r) => [
      r.id,
      r.effectiveDate,
      r.recordedAt,
      `"${r.supplierName.replace(/"/g, '""')}"`,
      r.itemType,
      r.itemCode || '',
      `"${r.itemName.replace(/"/g, '""')}"`,
      `"${(r.category || '').replace(/"/g, '""')}"`,
      r.priceType,
      r.costStage,
      r.unitPrice,
      r.currency,
      r.unit,
      r.previousPrice ?? '',
      r.priceChangePct ?? '',
      r.quotationRef || '',
      r.validFrom || '',
      r.validUntil || '',
      r.projectCode || r.projectId || '',
      r.recordedBy,
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `procurement_price_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast?.({ message: `Exported ${records.length} price records to CSV.`, type: 'success' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl max-w-6xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 max-h-[94vh] flex flex-col">
        {/* TOP BAR */}
        <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center border border-blue-200 dark:border-blue-800 text-[#0078d4]">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Procurement Price & Rate History
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                  Task 5 Central System
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Connected supplier, vendor, outsourced service & subcontractor price quotations, negotiated rates & PO pricing.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* View Mode Tabs */}
            <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'history'
                    ? 'bg-white dark:bg-slate-700 text-[#0078d4] shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Price History Records ({records.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('comparison');
                  void loadComparison();
                }}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'comparison'
                    ? 'bg-white dark:bg-slate-700 text-[#0078d4] shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Price Comparison View (Req 15)</span>
              </button>
            </div>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 flex items-center space-x-1 cursor-pointer"
              title="Export filtered records to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            {/* Record New Price Button (Req 7, 8, 9) */}
            <button
              type="button"
              onClick={() => {
                setRecordPresetSupplierId(selectedSupplierId !== 'ALL' ? selectedSupplierId : undefined);
                setRecordPresetItemId(selectedItemId !== 'ALL' ? selectedItemId : undefined);
                setIsRecordModalOpen(true);
              }}
              className="px-3 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Price Quote</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* FILTER BAR (Requirement 14) */}
        <div className="py-3 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 text-xs">
          {/* Search */}
          <div className="col-span-2 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search item, code, supplier, quote ref..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Supplier Filter */}
          <div>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 truncate"
              title="Filter by supplier / provider"
            >
              <option value="ALL">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Item Type */}
          <div>
            <select
              value={selectedItemType}
              onChange={(e) => setSelectedItemType(e.target.value)}
              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="ALL">All Types</option>
              <option value="material">Materials</option>
              <option value="outsourced_service">Outsourced Services</option>
              <option value="subcontractor_rate">Subcontractor Rates</option>
            </select>
          </div>

          {/* Category */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 truncate"
            >
              <option value="ALL">All Categories</option>
              {categoriesList.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Price Type */}
          <div>
            <select
              value={selectedPriceType}
              onChange={(e) => setSelectedPriceType(e.target.value)}
              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 truncate"
            >
              <option value="ALL">All Price Types</option>
              <option value="supplier_quotation">Supplier Quotation</option>
              <option value="negotiated_price">Negotiated Price</option>
              <option value="purchase_order_price">Purchase Order Price</option>
              <option value="actual_invoiced_price">Actual Invoiced Price</option>
              <option value="subcontractor_quotation">Subcontractor Quotation</option>
              <option value="agreed_subcontract_rate">Agreed Subcontract Rate</option>
              <option value="catalog_price_revision">Catalog Revision</option>
            </select>
          </div>

          {/* Currency */}
          <div>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="ALL">All Currencies</option>
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          <div>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedSupplierId('ALL');
                setSelectedItemType('ALL');
                setSelectedItemId('ALL');
                setSelectedCategory('ALL');
                setSelectedProjectId('ALL');
                setSelectedPriceType('ALL');
                setSelectedCostStage('ALL');
                setSelectedCurrency('ALL');
                setFromDate('');
                setToDate('');
              }}
              className="w-full py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg font-semibold text-center cursor-pointer transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* TAB 1: ALL PRICE HISTORY RECORDS TABLE */}
        {activeTab === 'history' && (
          <div className="flex-1 overflow-auto mt-3 border border-slate-200 dark:border-slate-800 rounded-xl">
            {loading ? (
              <div className="p-12 text-center text-slate-500">
                <RefreshCw className="w-7 h-7 text-[#0078d4] animate-spin mx-auto mb-2" />
                <p className="text-xs font-semibold">Loading price history from PostgreSQL...</p>
              </div>
            ) : error ? (
              <div className="p-8 text-center text-rose-500">
                <p className="text-xs font-bold">{error}</p>
              </div>
            ) : records.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  No price history records match the selected criteria.
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Click "Record Price Quote" above to record quotes from existing suppliers.
                </p>
              </div>
            ) : (
              <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 text-[11px] sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Date</th>
                    <th className="py-2.5 px-3 font-semibold">Supplier / Vendor</th>
                    <th className="py-2.5 px-3 font-semibold">Item & Type</th>
                    <th className="py-2.5 px-3 font-semibold">Price Type & Stage</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Unit Price</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Change vs Prev</th>
                    <th className="py-2.5 px-3 font-semibold">Quote / PO Ref</th>
                    <th className="py-2.5 px-3 font-semibold">Project</th>
                    <th className="py-2.5 px-3 font-semibold">Recorded By</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                  {records.map((r) => {
                    const diffPct = r.priceChangePct;
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors">
                        <td className="py-2.5 px-3 font-sans font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {r.effectiveDate}
                          <div className="text-[10px] text-slate-400 font-mono">
                            {r.recordedAt ? r.recordedAt.slice(11, 16) : ''}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 font-sans max-w-[180px]">
                          <div className="font-bold text-slate-900 dark:text-slate-100 truncate" title={r.supplierName}>
                            {r.supplierName}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">ID: {r.supplierId}</div>
                        </td>

                        <td className="py-2.5 px-3 font-sans max-w-[200px]">
                          <div className="font-semibold text-blue-600 dark:text-blue-400 truncate" title={r.itemName}>
                            {r.itemCode ? `[${r.itemCode}] ` : ''}{r.itemName}
                          </div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                            {r.itemType.replace(/_/g, ' ')} • {r.unit}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 font-sans">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              r.costStage === 'actual'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : r.costStage === 'committed'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                : r.costStage === 'quoted'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                            }`}
                          >
                            {r.costStage}
                          </span>
                          <div className="text-[10px] text-slate-500 capitalize mt-0.5">
                            {r.priceType.replace(/_/g, ' ')}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {formatCurrency(r.unitPrice, r.currency)} <span className="text-[10px] text-slate-400 font-sans">/{r.unit}</span>
                        </td>

                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {diffPct !== undefined && diffPct !== null ? (
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                diffPct > 0
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : diffPct < 0
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {diffPct > 0 ? `+${diffPct}%` : `${diffPct}%`}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-sans">Baseline</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {r.quotationRef || '-'}
                          {r.validUntil && (
                            <div className="text-[9px] text-slate-400 font-sans">
                              Expires: {r.validUntil}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 font-sans max-w-[120px] truncate text-slate-600 dark:text-slate-300">
                          {r.projectCode || r.planNumber ? (
                            <span className="text-purple-700 dark:text-purple-300 font-semibold" title={r.projectName || r.planName}>
                              {r.projectCode || r.planNumber}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">Global</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 font-sans text-slate-500 whitespace-nowrap">
                          {r.recordedBy}
                        </td>

                        <td className="py-2.5 px-3 text-center font-sans">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setComparisonItemId(r.itemId);
                                setActiveTab('comparison');
                                void loadComparison(r.itemId);
                              }}
                              className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 text-[#0078d4] rounded text-[10px] font-bold cursor-pointer transition-colors"
                              title="Compare all historical prices for this item"
                            >
                              Compare
                            </button>
                            {onSelectPriceForPlan && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectPriceForPlan(r);
                                  onClose();
                                }}
                                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold cursor-pointer transition-colors whitespace-nowrap shadow-2xs"
                                title={`Apply verified price snapshot (${formatCurrency(r.unitPrice, r.currency)}/${r.unit}) to ${planNumber || 'plan'}`}
                              >
                                Use in Plan
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 2: PRICE COMPARISON VIEW (Requirement 15) */}
        {activeTab === 'comparison' && (
          <div className="flex-1 overflow-auto mt-3 space-y-4">
            {/* Comparison Item Selector */}
            <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Select Item to Compare Historical Prices:
                </span>
                <select
                  value={comparisonItemId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setComparisonItemId(id);
                    void loadComparison(id);
                  }}
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                >
                  <optgroup label="Materials">
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        [MAT] {m.code ? `[${m.code}] ` : ''}{m.name} ({m.unit})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Outsourced Services">
                    {outsourcedServices.map((o) => (
                      <option key={o.id} value={o.id}>
                        [OUT] {o.code ? `[${o.code}] ` : ''}{o.name} ({o.unit || 'unit'})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Subcontractor Rates">
                    {subcontractors.map((s) => (
                      <option key={s.id} value={s.id}>
                        [SUB] {s.subcontractorName} - {s.nicheServiceName || s.serviceType} ({s.unit})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {comparisonSummary && (
                <div className="flex items-center space-x-4 text-xs">
                  <div>
                    <span className="text-slate-500">Total Recorded Quotes: </span>
                    <strong className="text-slate-900 dark:text-slate-100">{comparisonSummary.totalRecordsCount}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Unit: </span>
                    <strong className="text-slate-900 dark:text-slate-100 uppercase">{comparisonSummary.unit}</strong>
                  </div>
                </div>
              )}
            </div>

            {loadingComparison ? (
              <div className="p-12 text-center text-slate-500">
                <RefreshCw className="w-7 h-7 text-[#0078d4] animate-spin mx-auto mb-2" />
                <p className="text-xs font-semibold">Aggregating comparison matrix...</p>
              </div>
            ) : !comparisonSummary || comparisonSummary.history.length === 0 ? (
              <div className="p-12 text-center text-slate-400 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800">
                <Scale className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  No historical quotation records found for this item yet.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setRecordPresetItemId(comparisonItemId);
                    setIsRecordModalOpen(true);
                  }}
                  className="mt-3 px-3 py-1.5 bg-[#0078d4] text-white rounded-lg text-xs font-bold inline-flex items-center space-x-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Record First Quotation for this Item</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Comparison KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Latest Quoted Price
                    </span>
                    <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
                      {formatCurrency(comparisonSummary.currentPrice, comparisonSummary.currency)}
                      <span className="text-xs font-normal text-slate-500 ml-1">/{comparisonSummary.unit}</span>
                    </div>
                    {comparisonSummary.previousPrice !== undefined && (
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center space-x-1">
                        <span>Previous: {formatCurrency(comparisonSummary.previousPrice, comparisonSummary.currency)}</span>
                        {comparisonSummary.priceChangePct !== undefined && (
                          <span
                            className={`font-bold ${
                              comparisonSummary.priceChangePct > 0 ? 'text-rose-600' : 'text-emerald-600'
                            }`}
                          >
                            ({comparisonSummary.priceChangePct > 0 ? '+' : ''}
                            {comparisonSummary.priceChangePct}%)
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                      Lowest Historical Quote
                    </span>
                    <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                      {formatCurrency(comparisonSummary.minPrice, comparisonSummary.currency)}
                      <span className="text-xs font-normal text-slate-500 ml-1">/{comparisonSummary.unit}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Best recorded commercial pricing</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                      Average Quoted Price
                    </span>
                    <div className="text-lg font-bold text-amber-700 dark:text-amber-400 mt-1">
                      {formatCurrency(comparisonSummary.avgPrice, comparisonSummary.currency)}
                      <span className="text-xs font-normal text-slate-500 ml-1">/{comparisonSummary.unit}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Market benchmark average</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                      Highest Recorded Quote
                    </span>
                    <div className="text-lg font-bold text-rose-700 dark:text-rose-400 mt-1">
                      {formatCurrency(comparisonSummary.maxPrice, comparisonSummary.currency)}
                      <span className="text-xs font-normal text-slate-500 ml-1">/{comparisonSummary.unit}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Peak inflation / rush rate</p>
                  </div>
                </div>

                {/* Chronological Price Comparison Table for this Item */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                      Quotation Timeline & Supplier Comparison ({comparisonSummary.itemName})
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setRecordPresetItemId(comparisonItemId);
                        setIsRecordModalOpen(true);
                      }}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Quote for this Item</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
                      <thead className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">Effective Date</th>
                          <th className="py-2.5 px-3 font-semibold">Supplier Name</th>
                          <th className="py-2.5 px-3 font-semibold">Price Type & Stage</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Unit Price</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Variance vs Latest</th>
                          <th className="py-2.5 px-3 font-semibold">Quote Ref</th>
                          <th className="py-2.5 px-3 font-semibold">Valid Period</th>
                          <th className="py-2.5 px-3 font-semibold">Notes</th>
                          {onSelectPriceForPlan && (
                            <th className="py-2.5 px-3 font-semibold text-center">Plan Action</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                        {comparisonSummary.history.map((h, idx) => {
                          const diffFromCurrent = h.unitPrice - comparisonSummary.currentPrice;
                          const pctFromCurrent =
                            comparisonSummary.currentPrice > 0
                              ? calcPctChange(comparisonSummary.currentPrice, h.unitPrice, 1)
                              : 0;

                          return (
                            <tr
                              key={h.id}
                              className={`hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors ${
                                idx === 0 ? 'bg-blue-50/40 dark:bg-blue-950/20 font-bold' : ''
                              }`}
                            >
                              <td className="py-2.5 px-3 font-sans">
                                <div className="flex items-center space-x-1.5">
                                  <span>{h.effectiveDate}</span>
                                  {idx === 0 && (
                                    <span className="px-1.5 py-0.2 bg-blue-600 text-white rounded text-[9px] font-bold uppercase">
                                      Latest
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="py-2.5 px-3 font-sans font-semibold text-slate-900 dark:text-slate-100">
                                {h.supplierName}
                              </td>

                              <td className="py-2.5 px-3 font-sans">
                                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                                  {h.costStage}
                                </span>
                                <span className="text-[10px] text-slate-500 capitalize ml-1.5">
                                  {h.priceType.replace(/_/g, ' ')}
                                </span>
                              </td>

                              <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">
                                {formatCurrency(h.unitPrice, h.currency)} /{h.unit}
                              </td>

                              <td className="py-2.5 px-3 text-center">
                                {idx === 0 ? (
                                  <span className="text-slate-400 text-[10px] font-sans">Current Baseline</span>
                                ) : (
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      diffFromCurrent > 0
                                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                        : diffFromCurrent < 0
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                        : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {diffFromCurrent > 0 ? `+${pctFromCurrent}%` : `${pctFromCurrent}%`}
                                  </span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                                {h.quotationRef || '-'}
                              </td>

                              <td className="py-2.5 px-3 font-sans text-[10px] text-slate-500">
                                {h.validFrom && h.validUntil ? `${h.validFrom} → ${h.validUntil}` : '-'}
                              </td>

                              <td className="py-2.5 px-3 font-sans text-slate-500 max-w-[200px] truncate" title={h.notes}>
                                {h.notes || '-'}
                              </td>

                              {onSelectPriceForPlan && (
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onSelectPriceForPlan(h);
                                      onClose();
                                    }}
                                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold cursor-pointer transition-colors whitespace-nowrap shadow-2xs"
                                    title={`Apply verified price snapshot (${formatCurrency(h.unitPrice, h.currency)}/${h.unit}) to ${planNumber || 'plan'}`}
                                  >
                                    Use in Plan
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BOTTOM FOOTER */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <strong className="text-slate-900 dark:text-slate-100">{records.length}</strong> verified historical price records from PostgreSQL.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Record New Price Modal */}
      {isRecordModalOpen && (
        <RecordPriceModal
          isOpen={isRecordModalOpen}
          onClose={() => setIsRecordModalOpen(false)}
          onSuccess={(newRecord) => {
            void loadHistory();
            if (activeTab === 'comparison') {
              void loadComparison(newRecord.itemId);
            }
          }}
          initialSupplierId={recordPresetSupplierId}
          initialItemId={recordPresetItemId}
          initialItemType={recordPresetItemType}
          suppliers={suppliers}
          materials={materials}
          outsourcedServices={outsourcedServices}
          subcontractors={subcontractors}
          projects={projects}
          showToast={showToast}
        />
      )}
    </div>
  );
};
