import React, { useState, useEffect, useMemo } from 'react';
import {
  Tag,
  Plus,
  Search,
  Filter,
  History,
  RefreshCw,
  Trash2,
  Edit2,
  Calendar,
  Layers,
  Calculator,
  AlertCircle,
  ShieldCheck,
  Check
} from 'lucide-react';
import { Tariff, TariffVersion, AppUser, TariffScopeType } from '../../types';
import { api } from '../../services/api';
import { CreateEditTariffModal } from './CreateEditTariffModal';
import { CreateTariffVersionModal } from './CreateTariffVersionModal';
import { formatCurrency, DEFAULT_CURRENCY_CODE } from '../../utils/currency';

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
  const [selectedScope, setSelectedScope] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);
  const [versionModalTariff, setVersionModalTariff] = useState<Tariff | null>(null);
  const [historyDrawerTariff, setHistoryDrawerTariff] = useState<Tariff | null>(null);

  // Deletion confirmation
  const [deletingTariff, setDeletingTariff] = useState<Tariff | null>(null);
  const [deletingVersion, setDeletingVersion] = useState<{ tariff: Tariff; version: any } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Test Sandbox
  const [testTariffId, setTestTariffId] = useState<string>('');
  const [testDate, setTestDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [testBaseAmount, setTestBaseAmount] = useState<number>(10000);
  const [resolvedResult, setResolvedResult] = useState<any>(null);

  const fetchTariffs = async () => {
    setLoading(true);
    try {
      const data = await api.getTariffs({
        search: searchQuery || undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined
      });
      setTariffs(data);
      if (data.length > 0 && !testTariffId) {
        setTestTariffId(data[0].id);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to load tariffs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTariffs();
  }, [selectedStatus]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchTariffs();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Sandbox resolution
  useEffect(() => {
    if (!testTariffId) return;
    let cancelled = false;
    const runResolve = async () => {
      try {
        const res = await api.resolveTariffVersion(testTariffId, testDate);
        if (!cancelled) setResolvedResult(res);
      } catch (e: any) {
        if (!cancelled) setResolvedResult(null);
      }
    };
    void runResolve();
    return () => {
      cancelled = true;
    };
  }, [testTariffId, testDate]);

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

  // Scope rules list
  const scopeTabs: Array<{ id: string; label: string }> = [
    { id: 'ALL', label: 'All' },
    { id: 'general', label: 'General' },
    { id: 'project', label: 'Project' },
    { id: 'product', label: 'Product' },
    { id: 'material', label: 'Material' },
    { id: 'subcontractor', label: 'Subcontractor' },
    { id: 'supplier', label: 'Supplier' },
    { id: 'overhead', label: 'Overhead' }
  ];

  // Filtered tariffs
  const filteredTariffs = useMemo(() => {
    return tariffs.filter((t) => {
      if (selectedScope !== 'ALL' && (t.scopeType || 'general') !== selectedScope) {
        return false;
      }
      return true;
    });
  }, [tariffs, selectedScope]);

  // Metrics
  const totalTariffs = tariffs.length;
  const activeTariffs = tariffs.filter((t) => t.status === 'Active').length;
  const totalVersions = tariffs.reduce((acc, t) => acc + (t.versionsCount || 1), 0);

  // Save Tariff (Create or Edit)
  const handleSaveTariff = async (data: any) => {
    if (editingTariff) {
      await api.updateTariff(editingTariff.id, data);
    } else {
      await api.createTariff(data);
    }
    await fetchTariffs();
  };

  // Delete Tariff
  const handleConfirmDeleteTariff = async () => {
    if (!deletingTariff) return;
    setIsDeleting(true);
    try {
      await api.deleteTariff(deletingTariff.id);
      setTariffs((prev) => prev.filter((t) => t.id !== deletingTariff.id));
      showToast(`Tariff "${deletingTariff.code}" deleted.`);
      setDeletingTariff(null);
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete tariff');
    } finally {
      setIsDeleting(false);
    }
  };

  // Delete Version
  const handleConfirmDeleteVersion = async () => {
    if (!deletingVersion) return;
    setIsDeleting(true);
    try {
      await api.deleteTariffVersion(deletingVersion.tariff.id, deletingVersion.version.id);
      showToast(`Version v${deletingVersion.version.versionNumber} deleted.`);
      setDeletingVersion(null);
      // Refresh drawer
      const updated = await api.getTariffById(deletingVersion.tariff.id);
      setHistoryDrawerTariff(updated);
      await fetchTariffs();
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete version');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenHistory = async (t: Tariff) => {
    try {
      const full = await api.getTariffById(t.id);
      setHistoryDrawerTariff(full || t);
    } catch {
      setHistoryDrawerTariff(t);
    }
  };

  const getScopeBadge = (scope?: string) => {
    switch (scope) {
      case 'project':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">Project</span>;
      case 'product':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">Product</span>;
      case 'material':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Material</span>;
      case 'subcontractor':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300">Subcontractor</span>;
      case 'supplier':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">Supplier</span>;
      case 'overhead':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Overhead</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">General</span>;
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Tariffs</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 font-semibold">
                  PostgreSQL
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={fetchTariffs}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingTariff(null);
                setIsCreateModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New</span>
            </button>
          </div>
        </div>

        {/* Minimal Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] uppercase font-bold text-slate-500">Total</div>
            <div className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5">
              {totalTariffs}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] uppercase font-bold text-slate-500">Active</div>
            <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
              {activeTariffs}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] uppercase font-bold text-slate-500">Versions</div>
            <div className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400 mt-0.5">
              {totalVersions}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] uppercase font-bold text-slate-500">Currency</div>
            <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
              LKR
            </div>
          </div>
        </div>
      </div>

      {/* Sandbox */}
      <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-300 mb-2">
          <Calculator className="w-4 h-4 text-amber-600" />
          <h2 className="text-xs font-bold uppercase tracking-wider">Test</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 text-xs">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Schedule</label>
            <select
              value={testTariffId}
              onChange={(e) => setTestTariffId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold"
            >
              {tariffs.map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.code}] {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Date</label>
            <input
              type="date"
              value={testDate}
              onChange={(e) => setTestDate(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Base Amount</label>
            <input
              type="number"
              value={testBaseAmount}
              onChange={(e) => setTestBaseAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono font-bold"
            />
          </div>

          <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-amber-200 dark:border-amber-900/60 flex flex-col justify-between">
            <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-between">
              <span>Result</span>
              {resolvedResult && (
                <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                  v{resolvedResult.versionNumber}
                </span>
              )}
            </div>
            <div className="text-base font-bold font-mono text-amber-600 dark:text-amber-400">
              {formatCurrency(calculatedTestAmount, resolvedResult?.currency || DEFAULT_CURRENCY_CODE)}
            </div>
          </div>
        </div>
      </div>

      {/* Search & Scope Tabs */}
      <div className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code or name..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
          >
            <option value="ALL">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Pending">Pending</option>
            <option value="Archived">Archived</option>
          </select>
        </div>

        {/* Scope Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto pt-1 border-t border-slate-100 dark:border-slate-800">
          {scopeTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedScope(tab.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedScope === tab.id
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-bold uppercase text-[10px]">
                <th className="py-2.5 px-3">Code</th>
                <th className="py-2.5 px-3">Name</th>
                <th className="py-2.5 px-3">Scope</th>
                <th className="py-2.5 px-3">Rule</th>
                <th className="py-2.5 px-3 text-right">Rate</th>
                <th className="py-2.5 px-3 text-right">Fixed</th>
                <th className="py-2.5 px-3">Currency</th>
                <th className="py-2.5 px-3">Range</th>
                <th className="py-2.5 px-3 text-center">Version</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && filteredTariffs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1 text-amber-500" />
                    <span>Loading...</span>
                  </td>
                </tr>
              ) : filteredTariffs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    <p className="font-semibold">No tariffs found.</p>
                  </td>
                </tr>
              ) : (
                filteredTariffs.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                    {/* Code */}
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {t.code}
                    </td>

                    {/* Name */}
                    <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                      <div>{t.name}</div>
                      {t.scopeTargetName && (
                        <div className="text-[10px] text-slate-400">Target: {t.scopeTargetName}</div>
                      )}
                    </td>

                    {/* Scope Badge */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {getScopeBadge(t.scopeType)}
                    </td>

                    {/* Rule (Method & Base) */}
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-400 capitalize">
                      {t.calculationMethod?.replace('_', ' ')}
                    </td>

                    {/* Rate */}
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {t.rateOrPercentage} {t.unit}
                    </td>

                    {/* Fixed */}
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {t.fixedCharge ? formatCurrency(t.fixedCharge, t.currency || DEFAULT_CURRENCY_CODE) : '—'}
                    </td>

                    {/* Currency */}
                    <td className="py-2.5 px-3 font-mono font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                      {t.currency || DEFAULT_CURRENCY_CODE}
                    </td>

                    {/* Range */}
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-500">
                      {t.effectiveFrom} → {t.effectiveTo || 'Open'}
                    </td>

                    {/* Version */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenHistory(t)}
                        className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 hover:bg-blue-100 cursor-pointer"
                        title="View version trail"
                      >
                        v{t.versionsCount || 1}
                      </button>
                    </td>

                    {/* Actions: Edit & Delete & Version */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-1">
                      <button
                        type="button"
                        onClick={() => setVersionModalTariff(t)}
                        className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] cursor-pointer"
                        title="Add New Version"
                      >
                        +V
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingTariff(t);
                          setIsCreateModalOpen(true);
                        }}
                        className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title="Edit Tariff"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingTariff(t)}
                        className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        title="Delete Tariff"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Tariff Modal */}
      {deletingTariff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 max-w-sm w-full space-y-4 shadow-xl">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Delete Tariff</h3>
                <p className="text-[11px] text-slate-500 font-mono">{deletingTariff.code}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Delete tariff <strong>"{deletingTariff.name}"</strong>? This will remove the schedule and all versions from PostgreSQL.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingTariff(null)}
                disabled={isDeleting}
                className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTariff}
                disabled={isDeleting}
                className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Version Modal */}
      {deletingVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 max-w-sm w-full space-y-4 shadow-xl">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Delete Version</h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  v{deletingVersion.version.versionNumber} • {deletingVersion.tariff.code}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Delete version v{deletingVersion.version.versionNumber}? Remaining versions will be retained in PostgreSQL.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingVersion(null)}
                disabled={isDeleting}
                className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteVersion}
                disabled={isDeleting}
                className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {historyDrawerTariff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#0b101b] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Versions
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {historyDrawerTariff.code} • {historyDrawerTariff.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryDrawerTariff(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2.5 flex-1 text-xs">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setVersionModalTariff(historyDrawerTariff)}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg cursor-pointer"
                >
                  + Add Version
                </button>
              </div>

              {(historyDrawerTariff.versions || [historyDrawerTariff.currentVersion]).filter(Boolean).map((v: any, idx: number) => (
                <div
                  key={v.id || idx}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-blue-700 dark:text-blue-300">
                        v{v.versionNumber}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {v.rateOrPercentage} {v.unit}
                      </span>
                      <span className="text-amber-700 dark:text-amber-400 font-mono font-semibold">
                        {v.currency || historyDrawerTariff.currency || DEFAULT_CURRENCY_CODE}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                      {v.effectiveFrom} → {v.effectiveTo || 'Open'}
                    </div>
                    {v.changeReason && (
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {v.changeReason}
                      </div>
                    )}
                  </div>

                  {/* Delete version button if multiple versions exist */}
                  {(historyDrawerTariff.versions?.length || 1) > 1 && (
                    <button
                      type="button"
                      onClick={() => setDeletingVersion({ tariff: historyDrawerTariff, version: v })}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded cursor-pointer"
                      title="Delete version"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Tariff Modal */}
      <CreateEditTariffModal
        isOpen={isCreateModalOpen}
        tariff={editingTariff}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingTariff(null);
        }}
        onSave={handleSaveTariff}
        onDelete={async (id) => {
          await api.deleteTariff(id);
          setTariffs((prev) => prev.filter((t) => t.id !== id));
          showToast('Tariff deleted.');
          setEditingTariff(null);
          setIsCreateModalOpen(false);
        }}
        showToast={showToast}
      />

      {/* Create Tariff Version Modal */}
      {versionModalTariff && (
        <CreateTariffVersionModal
          isOpen={Boolean(versionModalTariff)}
          tariff={versionModalTariff}
          onClose={() => setVersionModalTariff(null)}
          onSuccess={async () => {
            showToast(`New version recorded.`);
            setVersionModalTariff(null);
            await fetchTariffs();
            if (historyDrawerTariff) {
              const full = await api.getTariffById(historyDrawerTariff.id);
              setHistoryDrawerTariff(full);
            }
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
};
