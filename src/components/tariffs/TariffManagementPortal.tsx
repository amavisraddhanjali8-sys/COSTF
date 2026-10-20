import React, { useState, useEffect, useMemo } from 'react';
import {
  Tag,
  Plus,
  Search,
  Filter,
  History,
  RefreshCw,
  Download,
  Calendar,
  Layers,
  DollarSign,
  Percent,
  CheckCircle2,
  Clock,
  ArrowRight,
  Calculator,
  AlertCircle,
  HelpCircle,
  FileSpreadsheet,
  ChevronRight,
  ShieldCheck,
  Edit2,
  Sparkles
} from 'lucide-react';
import { Tariff, TariffVersion, AppUser } from '../../types';
import { api } from '../../services/api';
import { CreateEditTariffModal } from './CreateEditTariffModal';
import { CreateTariffVersionModal } from './CreateTariffVersionModal';
import { formatCurrency } from '../../utils/currency';

interface TariffManagementPortalProps {
  currentUser: AppUser;
  showToast: (msg: string) => void;
  onNavigateToPlan?: (planId: string) => void;
}

export const TariffManagementPortal: React.FC<TariffManagementPortalProps> = ({
  currentUser,
  showToast,
  onNavigateToPlan
}) => {
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);
  const [versionModalTariff, setVersionModalTariff] = useState<Tariff | null>(null);
  const [historyDrawerTariff, setHistoryDrawerTariff] = useState<Tariff | null>(null);

  // Interactive Test Sandbox State
  const [testTariffId, setTestTariffId] = useState<string>('');
  const [testDate, setTestDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [testBaseAmount, setTestBaseAmount] = useState<number>(25000);
  const [resolvedResult, setResolvedResult] = useState<any>(null);
  const [resolvingTest, setResolvingTest] = useState<boolean>(false);

  // Load tariffs
  const fetchTariffs = async () => {
    setLoading(true);
    try {
      const data = await api.getTariffs({
        search: searchQuery || undefined,
        category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        calculationMethod: selectedMethod !== 'ALL' ? selectedMethod : undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined
      });
      setTariffs(data);
      if (data.length > 0 && !testTariffId) {
        setTestTariffId(data[0].id);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to load tariffs from PostgreSQL');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTariffs();
  }, [selectedCategory, selectedMethod, selectedStatus]);

  // Handle Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchTariffs();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Test Sandbox Resolution
  useEffect(() => {
    if (!testTariffId) return;
    let cancelled = false;

    const runResolve = async () => {
      setResolvingTest(true);
      try {
        const res = await api.resolveTariffVersion(testTariffId, testDate);
        if (!cancelled) setResolvedResult(res);
      } catch (e: any) {
        if (!cancelled) setResolvedResult(null);
      } finally {
        if (!cancelled) setResolvingTest(false);
      }
    };

    void runResolve();
    return () => { cancelled = true; };
  }, [testTariffId, testDate]);

  // Compute test output amount
  const calculatedTestAmount = useMemo(() => {
    if (!resolvedResult) return 0;
    const rate = resolvedResult.rateOrPercentage || 0;
    const fixed = resolvedResult.fixedCharge || 0;
    const method = resolvedResult.calculationMethod;
    if (method === 'percentage') {
      return (testBaseAmount * rate) / 100;
    } else if (method === 'unit_rate') {
      return testBaseAmount * rate;
    } else if (method === 'fixed_charge') {
      return fixed;
    } else if (method === 'hybrid') {
      return fixed + (testBaseAmount * rate) / 100;
    }
    return (testBaseAmount * rate) / 100;
  }, [resolvedResult, testBaseAmount]);

  // Categories list
  const categories = [
    'ALL',
    'Surface Finishing',
    'Statutory & Customs',
    'Quality & Inspection',
    'Labour & Trades',
    'Utility & Energy',
    'Logistics & Freight'
  ];

  // Metric summaries
  const totalTariffs = tariffs.length;
  const totalVersions = tariffs.reduce((acc, t) => acc + (t.versionsCount || 1), 0);
  const activeTariffs = tariffs.filter(t => t.status === 'Active').length;
  const appliedCount = tariffs.reduce((acc, t) => acc + ((t as any).appliedPlansCount || 0), 0);

  // Handle Create / Edit save
  const handleSaveTariff = async (data: any) => {
    if (editingTariff) {
      await api.updateTariff(editingTariff.id, data);
    } else {
      await api.createTariff(data);
    }
    await fetchTariffs();
  };

  // Handle Create Version save
  const handleSaveVersion = async (tariffId: string, versionData: any) => {
    await api.createTariffVersion(tariffId, versionData);
    await fetchTariffs();
    if (historyDrawerTariff?.id === tariffId) {
      const full = await api.getTariffById(tariffId);
      setHistoryDrawerTariff(full);
    }
  };

  // View full version history drawer
  const handleOpenHistory = async (tariff: Tariff) => {
    try {
      const full = await api.getTariffById(tariff.id);
      setHistoryDrawerTariff(full);
    } catch {
      setHistoryDrawerTariff(tariff);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Tariff Code',
      'Name',
      'Category',
      'Calculation Method',
      'Rate/Percentage',
      'Fixed Charge',
      'Unit',
      'Applicable Base',
      'Effective From',
      'Effective To',
      'Status',
      'Source Reference',
      'Versions Count'
    ];
    const rows = tariffs.map(t => [
      `"${t.code}"`,
      `"${t.name}"`,
      `"${t.category}"`,
      `"${t.calculationMethod}"`,
      t.rateOrPercentage,
      t.fixedCharge || 0,
      `"${t.unit}"`,
      `"${t.applicableBase}"`,
      `"${t.effectiveFrom}"`,
      `"${t.effectiveTo || 'Current'}"`,
      `"${t.status}"`,
      `"${t.sourceReference || ''}"`,
      t.versionsCount || 1
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Enterprise_Tariff_Schedule_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Tariff schedules exported to CSV.');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Tag className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Enterprise Tariff & Surcharge Management System
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  POSTGRESQL AUDIT TRACKED
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Centralized statutory, outsourced finishing, and specialized trade tariffs. Every rate version preserves historical timestamps to guarantee zero retroactive pricing drift in past project budgets.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center space-x-1.5 cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={fetchTariffs}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shadow-2xs"
              title="Refresh tariffs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              id="btn-add-tariff"
              onClick={() => {
                setEditingTariff(null);
                setIsCreateModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Tariff</span>
            </button>
          </div>
        </div>

        {/* Telemetry Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
              <span>Active Schedules</span>
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
              {activeTariffs} <span className="text-xs font-normal text-slate-400">/ {totalTariffs}</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Enforced across project plans</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
              <span>Historical Versions</span>
              <History className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
              {totalVersions}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Retained immutable records</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
              <span>Attached Plan Tariffs</span>
              <Layers className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
              {appliedCount}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Explicitly opted-in budgets</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
              <span>Compliance Protocol</span>
              <DollarSign className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1 flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              <span>Zero Drift Guarantee</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Date-enclosed resolution</div>
          </div>
        </div>
      </div>

      {/* Interactive Version Resolver & Calculation Sandbox */}
      <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-slate-50 dark:from-slate-900 dark:via-blue-950/20 dark:to-slate-900 border border-blue-200 dark:border-blue-900/60 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center space-x-2 text-blue-900 dark:text-blue-300 mb-3">
          <Calculator className="w-4 h-4" />
          <h2 className="text-xs font-bold uppercase tracking-wide">
            Live Tariff Version Resolution & Calculation Sandbox
          </h2>
        </div>
        <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-4">
          Test which historical version takes effect on a specific plan date. The engine applies the active version whose effective date range encloses the evaluation timestamp without overwriting past versions.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Test Tariff Schedule
            </label>
            <select
              value={testTariffId}
              onChange={(e) => setTestTariffId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold"
            >
              {tariffs.map(t => (
                <option key={t.id} value={t.id}>
                  [{t.code}] {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Evaluation Date
            </label>
            <input
              type="date"
              value={testDate}
              onChange={(e) => setTestDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Base Amount / Qty ($)
            </label>
            <input
              type="number"
              value={testBaseAmount}
              onChange={(e) => setTestBaseAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono font-bold"
            />
          </div>

          {/* Resolved Result Box */}
          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-900 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-bold uppercase">Resolved Version</span>
              {resolvedResult && (
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                  v{resolvedResult.versionNumber} ({resolvedResult.matchType})
                </span>
              )}
            </div>
            <div className="text-base font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
              {formatCurrency(calculatedTestAmount, resolvedResult?.currency || 'USD')}
            </div>
            <div className="text-[10px] text-slate-500">
              Rate: <strong className="font-mono text-slate-800 dark:text-slate-200">{resolvedResult?.rateOrPercentage || 0} {resolvedResult?.unit || '%'}</strong>
              {resolvedResult?.fixedCharge ? ` + $${resolvedResult.fixedCharge} fixed` : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        {/* Search & Method / Status Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by code, title, process, or reference..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
            >
              <option value="ALL">All Calculation Methods</option>
              <option value="percentage">Percentage (%)</option>
              <option value="unit_rate">Unit Rate</option>
              <option value="fixed_charge">Fixed Charge</option>
              <option value="hybrid">Hybrid</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
            >
              <option value="ALL">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive</option>
              <option value="Archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pt-1 pb-0.5 border-t border-slate-100 dark:border-slate-800/80">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800'
              }`}
            >
              {cat === 'ALL' ? 'All Categories' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Tariffs Table */}
      <div className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 text-slate-500 font-bold uppercase text-[10px]">
                <th className="py-3 px-4">Tariff Schedule</th>
                <th className="py-3 px-4">Category & Scope</th>
                <th className="py-3 px-4">Method & Base</th>
                <th className="py-3 px-4 text-right">Active Rate</th>
                <th className="py-3 px-4 text-right">Fixed Charge</th>
                <th className="py-3 px-4">Effective Range</th>
                <th className="py-3 px-4 text-center">Version Audit</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading && tariffs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                    <span>Loading tariffs from PostgreSQL...</span>
                  </td>
                </tr>
              ) : tariffs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Tag className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                    <p className="font-semibold text-slate-600 dark:text-slate-400">No tariff schedules found</p>
                    <p className="text-[11px] text-slate-400 mt-1">Adjust filters or create a new tariff.</p>
                  </td>
                </tr>
              ) : (
                tariffs.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors">
                    {/* Code & Title */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                          {t.code}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 dark:text-slate-100 mt-1">
                        {t.name}
                      </div>
                      {t.sourceReference && (
                        <div className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">
                          Ref: {t.sourceReference}
                        </div>
                      )}
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800">
                        {t.category}
                      </span>
                    </td>

                    {/* Method & Base */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                        {t.calculationMethod?.replace('_', ' ')}
                      </div>
                      <div className="text-[10px] text-slate-400 capitalize">
                        Base: {t.applicableBase?.replace('_', ' ')}
                      </div>
                    </td>

                    {/* Rate */}
                    <td className="py-3 px-4 text-right">
                      <div className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {t.rateOrPercentage} {t.unit}
                      </div>
                    </td>

                    {/* Fixed Charge */}
                    <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                      {t.fixedCharge ? formatCurrency(t.fixedCharge, t.currency) : '—'}
                    </td>

                    {/* Effective Range */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1 text-[11px] font-mono text-slate-700 dark:text-slate-300">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{t.effectiveFrom}</span>
                        <span>→</span>
                        <span>{t.effectiveTo || 'Open'}</span>
                      </div>
                    </td>

                    {/* Versions Badge */}
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenHistory(t)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-mono font-bold text-[11px] cursor-pointer transition-colors"
                        title="View complete version history and audits"
                      >
                        <History className="w-3 h-3" />
                        <span>v{t.versionsCount || 1} ({t.versionsCount || 1} rev)</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setVersionModalTariff(t)}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] cursor-pointer shadow-2xs"
                        title="Add a new historical version with new rate without overwriting past rates"
                      >
                        + Version
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTariff(t);
                          setIsCreateModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title="Edit master details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Version History Drawer / Modal */}
      {historyDrawerTariff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-150">
          <div className="bg-white dark:bg-[#0b101b] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/60">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Historical Tariff Version Trail & Compliance Audit
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {historyDrawerTariff.code} • {historyDrawerTariff.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryDrawerTariff(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-[11px] text-amber-900 dark:text-amber-200 flex items-center justify-between">
                <span>
                  <strong>Master Rule:</strong> Historical tariff versions are retained immutably in PostgreSQL to guarantee that past project plan estimates never drift.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setVersionModalTariff(historyDrawerTariff);
                  }}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg cursor-pointer shrink-0 ml-3"
                >
                  + Add Version
                </button>
              </div>

              <div className="space-y-3">
                {(historyDrawerTariff.versions || [historyDrawerTariff.currentVersion]).filter(Boolean).map((v: any, idx: number) => (
                  <div
                    key={v.id || idx}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs px-2 py-0.5 rounded font-bold bg-blue-600 text-white">
                          v{v.versionNumber}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          v.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {v.status || 'Active'}
                        </span>
                        {idx === 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Current Standard
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        Effective: <strong>{v.effectiveFrom}</strong> → <strong>{v.effectiveTo || 'Open-ended'}</strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px]">
                      <div>
                        <span className="text-slate-400">Rate / Percentage:</span>
                        <div className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                          {v.rateOrPercentage} {v.unit || '%'}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">Fixed Charge:</span>
                        <div className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          {v.fixedCharge ? formatCurrency(v.fixedCharge, v.currency || 'USD') : '$0.00'}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">Calculation Method:</span>
                        <div className="font-semibold text-slate-700 dark:text-slate-300 capitalize">
                          {v.calculationMethod?.replace('_', ' ')}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">Recorded By:</span>
                        <div className="text-slate-700 dark:text-slate-300 truncate">
                          {v.createdBy || 'System User'}
                        </div>
                      </div>
                    </div>

                    {v.changeReason && (
                      <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300">
                        <strong className="text-slate-500">Audit Revision Reason:</strong> {v.changeReason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryDrawerTariff(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold cursor-pointer"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateEditTariffModal
        isOpen={isCreateModalOpen}
        tariff={editingTariff}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingTariff(null);
        }}
        onSave={handleSaveTariff}
        showToast={showToast}
      />

      <CreateTariffVersionModal
        isOpen={Boolean(versionModalTariff)}
        tariff={versionModalTariff}
        onClose={() => setVersionModalTariff(null)}
        onSave={handleSaveVersion}
        showToast={showToast}
      />
    </div>
  );
};
