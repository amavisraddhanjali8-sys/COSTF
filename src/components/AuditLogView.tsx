import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Search,
  Filter,
  Download,
  RefreshCw,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  User,
  Settings,
  Package,
  Layers,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Lock,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Sparkles,
  Tag,
  DollarSign,
  ArrowRight,
  FolderGit2,
  X,
  FileText,
  SlidersHorizontal,
  Code2
} from 'lucide-react';
import { AuditLogRecord, AppUser, Project } from '../types';
import { api } from '../services/api';

interface AuditLogViewProps {
  currentUser: AppUser;
  auditLogs?: AuditLogRecord[];
  projects?: Project[];
  users?: AppUser[];
  onRefresh?: () => void;
  showToast: (msg: string) => void;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({
  currentUser,
  auditLogs: initialLogs = [],
  projects = [],
  users = [],
  onRefresh,
  showToast
}) => {
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('ALL');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [selectedProject, setSelectedProject] = useState<string>('ALL');
  const [selectedPlan, setSelectedPlan] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [datePreset, setDatePreset] = useState<string>('ALL'); // ALL, TODAY, WEEK, MONTH

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Data & Expanded Row State
  const [logs, setLogs] = useState<AuditLogRecord[]>(initialLogs);
  const [loading, setLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // ACCESS GUARD: Only viewable by Admin
  if (currentUser.role !== 'ADMIN') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center shadow-xs space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-600 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Restricted Access: Enterprise Compliance Audit Log
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Under corporate compliance and security protocols, the system audit trail is classified and strictly viewable only by <strong className="text-slate-800 dark:text-slate-200">Administrators</strong>.
            </p>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-left text-xs max-w-sm mx-auto space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Your Session:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{currentUser.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Employee ID:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">{currentUser.employeeId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Assigned Role:</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                {currentUser.role}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400">
            If you need access to regulatory audit transcripts, please request authorization from an Administrator.
          </div>
        </div>
      </div>
    );
  }

  // Fetch paginated audit logs from server
  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Calculate effective date range if preset is active
      let effectiveFrom = fromDate;
      let effectiveTo = toDate;
      const todayStr = new Date().toISOString().slice(0, 10);

      if (datePreset === 'TODAY') {
        effectiveFrom = todayStr;
        effectiveTo = todayStr;
      } else if (datePreset === 'WEEK') {
        effectiveFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        effectiveTo = todayStr;
      } else if (datePreset === 'MONTH') {
        effectiveFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        effectiveTo = todayStr;
      }

      const res = await api.getAuditLogsPaginated({
        page: currentPage,
        limit: pageSize,
        search: searchQuery.trim() || undefined,
        actorId: selectedUser !== 'ALL' ? selectedUser : undefined,
        action: selectedAction !== 'ALL' ? selectedAction : undefined,
        entityType: selectedEntity !== 'ALL' ? selectedEntity : undefined,
        projectId: selectedProject !== 'ALL' ? selectedProject : undefined,
        planId: selectedPlan !== 'ALL' ? selectedPlan : undefined,
        fromDate: effectiveFrom || undefined,
        toDate: effectiveTo || undefined
      });

      if (res && Array.isArray(res.data)) {
        setLogs(res.data);
        setTotalCount(res.total);
        setTotalPages(res.totalPages || 1);
      }
    } catch (err: any) {
      console.warn('Could not fetch server audit logs, falling back to cached:', err);
      if (initialLogs.length > 0) {
        setLogs(initialLogs);
        setTotalCount(initialLogs.length);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLogs();
  }, [
    currentPage,
    pageSize,
    selectedUser,
    selectedAction,
    selectedEntity,
    selectedProject,
    selectedPlan,
    datePreset,
    fromDate,
    toDate
  ]);

  // Debounced search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      void fetchLogs();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Unique lists for filter dropdowns
  const availableUsers = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) map.set(u.id, u.name);
    for (const l of logs) if (l.actorId && l.actorName) map.set(l.actorId, l.actorName);
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [users, logs]);

  const availableActions = [
    'ALL',
    'UPDATE_PLAN_SELLING_RATE',
    'UPDATE_PROJECT_PLAN',
    'CREATE_PROJECT',
    'CREATE_PROJECT_PLAN',
    'ADD_PLAN_BOQ_ITEM',
    'DELETE_PLAN_BOQ_ITEM',
    'UPDATE_COMMERCIAL_RATE',
    'CREATE_TARIFF',
    'UPDATE_TARIFF',
    'CREATE_TARIFF_VERSION',
    'APPLY_TARIFF_TO_PLAN',
    'REMOVE_TARIFF_FROM_PLAN',
    'UPDATE_OVERHEAD_ALLOCATION',
    'UPDATE_MATERIAL',
    'RECORD_SUPPLIER_QUOTATION',
    'INVENTORY_IN',
    'INVENTORY_OUT',
    'USER_LOGIN',
    'USER_CREATED'
  ];

  const availableEntities = [
    'ALL',
    'PlanBoqItem',
    'ProjectPlan',
    'Project',
    'Tariff',
    'TariffVersion',
    'PlanTariff',
    'RevenueItem',
    'Material',
    'SupplierQuotation',
    'OverheadAllocation',
    'Inventory',
    'User'
  ];

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedUser('ALL');
    setSelectedAction('ALL');
    setSelectedEntity('ALL');
    setSelectedProject('ALL');
    setSelectedPlan('ALL');
    setFromDate('');
    setToDate('');
    setDatePreset('ALL');
    setCurrentPage(1);
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Audit Event ID',
      'Timestamp',
      'Actor ID',
      'Actor Name',
      'Actor Role',
      'Action Type',
      'Entity Type',
      'Entity ID',
      'Project ID',
      'Plan ID',
      'Change Reason',
      'Details',
      'IP Address',
      'Status'
    ];
    const rows = logs.map(l => [
      `"${l.id}"`,
      `"${l.timestamp}"`,
      `"${l.actorId}"`,
      `"${l.actorName}"`,
      `"${l.actorRole}"`,
      `"${l.actionType || l.action}"`,
      `"${l.entityType || l.module}"`,
      `"${l.entityId || l.recordId || ''}"`,
      `"${l.projectId || ''}"`,
      `"${l.planId || ''}"`,
      `"${(l.changeReason || '').replace(/"/g, '""')}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`,
      `"${l.ipAddress || '127.0.0.1'}"`,
      `"${l.status}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Enterprise_Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Audit trail exported to CSV.');
  };

  const getActionBadge = (action: string) => {
    if (action.includes('SELLING_RATE') || action.includes('COMMERCIAL')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          <DollarSign className="w-3 h-3 text-amber-500" />
          <span>{action}</span>
        </span>
      );
    }
    if (action.includes('TARIFF')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
          <Tag className="w-3 h-3 text-purple-500" />
          <span>{action}</span>
        </span>
      );
    }
    if (action.includes('PLAN') || action.includes('PROJECT')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          <FolderGit2 className="w-3 h-3 text-blue-500" />
          <span>{action}</span>
        </span>
      );
    }
    if (action.includes('INVENTORY')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <Package className="w-3 h-3 text-emerald-500" />
          <span>{action}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
        <span>{action}</span>
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
            <Shield className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Enterprise Regulatory Audit Trail
              </h1>
              <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold rounded">
                PostgreSQL Immutable
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive trace of financial rates, selling price changes, tariff versions, and enterprise project mutations.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer flex items-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Export Audit CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              void fetchLogs();
              showToast('Audit trail refreshed.');
            }}
            className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xs transition-colors cursor-pointer"
            title="Refresh logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Date Presets Row */}
      <div className="flex items-center gap-1.5 flex-wrap text-xs">
        <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center space-x-1">
          <Calendar className="w-3 h-3" />
          <span>Timeline:</span>
        </span>
        {['ALL', 'TODAY', 'WEEK', 'MONTH'].map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => {
              setDatePreset(preset);
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              datePreset === preset
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            {preset === 'ALL' ? 'All Time' : preset === 'TODAY' ? 'Today' : preset === 'WEEK' ? 'Last 7 Days' : 'Last 30 Days'}
          </button>
        ))}

        <div className="flex items-center space-x-1.5 ml-2">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setDatePreset('CUSTOM');
              setCurrentPage(1);
            }}
            className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] bg-white dark:bg-slate-900"
            title="From Date"
          />
          <span className="text-slate-400 text-xs">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setDatePreset('CUSTOM');
              setCurrentPage(1);
            }}
            className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] bg-white dark:bg-slate-900"
            title="To Date"
          />
        </div>

        {(searchQuery || selectedUser !== 'ALL' || selectedAction !== 'ALL' || selectedEntity !== 'ALL' || selectedProject !== 'ALL' || selectedPlan !== 'ALL' || datePreset !== 'ALL') && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-2.5 py-1 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all inline-flex items-center gap-1 ml-auto cursor-pointer"
          >
            <X className="w-3 h-3" /> Reset Filters
          </button>
        )}
      </div>

      {/* Structured Filter Controls Bar */}
      <div className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search audit events by action, reason, actor name, user ID, details, or record..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Multi-Dimensional Filter Dropdowns (User, Action, Entity, Project, Plan) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs">
          {/* User / Actor Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Actor / User
            </label>
            <select
              value={selectedUser}
              onChange={(e) => {
                setSelectedUser(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Actors</option>
              {availableUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.id})
                </option>
              ))}
            </select>
          </div>

          {/* Action Type Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Action Type
            </label>
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
            >
              {availableActions.map(act => (
                <option key={act} value={act}>
                  {act === 'ALL' ? 'All Action Types' : act}
                </option>
              ))}
            </select>
          </div>

          {/* Entity Type Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Entity Type
            </label>
            <select
              value={selectedEntity}
              onChange={(e) => {
                setSelectedEntity(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
            >
              {availableEntities.map(ent => (
                <option key={ent} value={ent}>
                  {ent === 'ALL' ? 'All Entities' : ent}
                </option>
              ))}
            </select>
          </div>

          {/* Related Project Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Related Project
            </label>
            <select
              value={selectedProject}
              onChange={(e) => {
                setSelectedProject(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  [{p.code || p.id}] {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Related Plan Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Plan ID / Filter
            </label>
            <input
              type="text"
              value={selectedPlan === 'ALL' ? '' : selectedPlan}
              onChange={(e) => {
                setSelectedPlan(e.target.value.trim() ? e.target.value.trim() : 'ALL');
                setCurrentPage(1);
              }}
              placeholder="e.g. plan-123..."
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Main Audit Trail Table */}
      <div className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 text-slate-500 font-bold uppercase text-[10px]">
                <th className="py-3 px-4 w-10"></th>
                <th className="py-3 px-4">Event Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action & Entity</th>
                <th className="py-3 px-4">Project & Plan</th>
                <th className="py-3 px-4">Audit Details & Reason</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                    <span>Loading audit records from PostgreSQL...</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Shield className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                    <p className="font-semibold text-slate-600 dark:text-slate-400">No audit records match filters</p>
                    <p className="text-[11px] text-slate-400 mt-1">Try resetting search criteria or broadening date bounds.</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const hasBeforeAfter = Boolean(log.beforeState || log.afterState);

                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className={`hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors cursor-pointer ${
                          isExpanded ? 'bg-amber-50/30 dark:bg-amber-950/20' : ''
                        }`}
                      >
                        {/* Toggle Icon */}
                        <td className="py-3 px-3 text-center text-slate-400">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-amber-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </td>

                        {/* Timestamp */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono text-[11px] text-slate-800 dark:text-slate-200">
                            {(log.timestamp || '').replace('T', ' ').slice(0, 19)}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {log.id}
                          </div>
                        </td>

                        {/* Actor */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            {log.actorName || 'System'}
                          </div>
                          <div className="flex items-center space-x-1.5 mt-0.5">
                            <span className="font-mono text-[10px] text-slate-400">
                              {log.actorId}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {log.actorRole}
                            </span>
                          </div>
                        </td>

                        {/* Action & Entity */}
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-1.5">
                            {getActionBadge(log.actionType || log.action)}
                          </div>
                          <div className="text-[10px] text-slate-500 font-semibold mt-1">
                            {log.entityType || log.module}: <span className="font-mono text-slate-700 dark:text-slate-300">{log.entityId || log.recordId || '—'}</span>
                          </div>
                        </td>

                        {/* Project & Plan */}
                        <td className="py-3 px-4">
                          {log.projectId ? (
                            <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                              Project: <span className="font-mono text-blue-600 dark:text-blue-400">{log.projectId}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                          {log.planId && (
                            <div className="text-[10px] text-slate-500 font-mono">
                              Plan: {log.planId}
                            </div>
                          )}
                        </td>

                        {/* Details & Change Reason */}
                        <td className="py-3 px-4 max-w-md">
                          <div className="text-slate-700 dark:text-slate-300 line-clamp-2">
                            {log.details}
                          </div>
                          {log.changeReason && (
                            <div className="text-[10px] text-amber-700 dark:text-amber-400 font-medium mt-0.5">
                              Reason: {log.changeReason}
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.status === 'Success'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>

                      {/* Expanded Before-and-After & Metadata Drawer */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
                          <td colSpan={7} className="p-4 pl-12 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Before State */}
                              <div className="p-3.5 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                                <div className="flex items-center space-x-1.5 text-slate-500 text-[10px] font-bold uppercase">
                                  <Clock className="w-3.5 h-3.5 text-rose-500" />
                                  <span>Before Mutation State</span>
                                </div>
                                {log.beforeState ? (
                                  <pre className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 font-mono text-[11px] text-slate-800 dark:text-slate-200 overflow-x-auto border border-slate-200 dark:border-slate-800">
                                    {JSON.stringify(log.beforeState, null, 2)}
                                  </pre>
                                ) : (
                                  <div className="text-[11px] text-slate-400 italic py-2">
                                    No prior state (Initial creation or record creation event).
                                  </div>
                                )}
                              </div>

                              {/* After State */}
                              <div className="p-3.5 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                                <div className="flex items-center space-x-1.5 text-slate-500 text-[10px] font-bold uppercase">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                  <span>After Mutation State (Applied)</span>
                                </div>
                                {log.afterState ? (
                                  <pre className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 font-mono text-[11px] text-slate-800 dark:text-slate-200 overflow-x-auto border border-slate-200 dark:border-slate-800">
                                    {JSON.stringify(log.afterState, null, 2)}
                                  </pre>
                                ) : (
                                  <div className="text-[11px] text-slate-400 italic py-2">
                                    No direct after-state snapshot recorded.
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Additional Context & Metadata */}
                            <div className="p-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] flex flex-wrap items-center gap-4 text-slate-500">
                              <div>
                                <span>Event ID:</span> <strong className="font-mono text-slate-700 dark:text-slate-300">{log.id}</strong>
                              </div>
                              <div>
                                <span>Actor User ID:</span> <strong className="font-mono text-slate-700 dark:text-slate-300">{log.actorId}</strong>
                              </div>
                              <div>
                                <span>IP Address:</span> <strong className="font-mono text-slate-700 dark:text-slate-300">{log.ipAddress || '127.0.0.1'}</strong>
                              </div>
                              {log.requestId && (
                                <div>
                                  <span>Correlation ID:</span> <strong className="font-mono text-slate-700 dark:text-slate-300">{log.requestId}</strong>
                                </div>
                              )}
                              {log.metadata && Object.keys(log.metadata).length > 0 && (
                                <div className="w-full mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                  <span className="font-bold">Contextual Metadata:</span>{' '}
                                  <code className="text-slate-700 dark:text-slate-300">{JSON.stringify(log.metadata)}</code>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 text-[11px]">
            Showing <strong className="text-slate-800 dark:text-slate-200">{logs.length}</strong> of{' '}
            <strong className="text-slate-800 dark:text-slate-200">{totalCount}</strong> audit events • Page{' '}
            <strong className="text-slate-800 dark:text-slate-200">{currentPage}</strong> of{' '}
            <strong className="text-slate-800 dark:text-slate-200">{totalPages}</strong>
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-[11px]"
            >
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
            </select>

            <button
              type="button"
              disabled={currentPage <= 1 || loading}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold disabled:opacity-40 cursor-pointer flex items-center space-x-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            <button
              type="button"
              disabled={currentPage >= totalPages || loading}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold disabled:opacity-40 cursor-pointer flex items-center space-x-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
