import React, { useState, useMemo } from 'react';
import {
  Layers,
  Search,
  Filter,
  Plus,
  ArrowUpDown,
  CheckCircle2,
  Copy,
  Archive,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  SlidersHorizontal,
  FolderGit2,
  Calendar,
  AlertCircle,
  Edit,
  History
} from 'lucide-react';
import { formatCurrency, getStoredCurrency } from '../../utils/currency';

export interface ProjectPlanRow {
  id: string;
  planNumber: string;
  name: string;
  projectId: string;
  projectCode?: string;
  projectName?: string;
  clientName?: string;
  revisionNumber: number;
  versionLabel: string;
  status: 'Draft' | 'In Review' | 'Approved' | 'Active' | 'Locked' | 'Archived' | string;
  isBaseline: boolean;
  isActive: boolean;
  currency: string;
  plannedRevenue: number;
  directCost: number;
  allocatedOverhead: number;
  totalPlannedCost: number;
  plannedProfit: number;
  profitMarginPct: number;
  targetMarginPct?: number;
  effectiveDate?: string;
  lastUpdated?: string;
  updatedAt?: string;
  createdAt?: string;
  costSummary?: any;
}

interface ProjectPlansListTableProps {
  plans: ProjectPlanRow[];
  activePlanId?: string;
  currency?: string;
  onViewPlanDetails: (planId: string) => void;
  onEditPlan?: (plan: ProjectPlanRow) => void;
  onViewRevisions?: (plan: ProjectPlanRow) => void;
  onOpenComparison?: () => void;
  onActivatePlan?: (planId: string) => void;
  onDuplicatePlan?: (planId: string) => void;
  onArchivePlan?: (planId: string) => void;
  onDeletePlan?: (planId: string) => void;
  onCreateNewPlan?: () => void;
  isLoading?: boolean;
}

export const ProjectPlansListTable: React.FC<ProjectPlansListTableProps> = ({
  plans,
  activePlanId,
  currency,
  onViewPlanDetails,
  onEditPlan,
  onViewRevisions,
  onOpenComparison,
  onActivatePlan,
  onDuplicatePlan,
  onArchivePlan,
  onDeletePlan,
  onCreateNewPlan,
  isLoading = false
}) => {
  const activeCurrency = currency || getStoredCurrency();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Sorting state
  const [sortField, setSortField] = useState<string>('planNumber');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filter and sort plans
  const filteredAndSortedPlans = useMemo(() => {
    let result = [...plans];

    // Status filter
    if (statusFilter !== 'ALL') {
      result = result.filter((p) => String(p.status).toLowerCase() === statusFilter.toLowerCase());
    }

    // Type filter
    if (typeFilter === 'BASELINE') {
      result = result.filter((p) => p.isBaseline);
    } else if (typeFilter === 'ALTERNATIVE') {
      result = result.filter((p) => !p.isBaseline);
    } else if (typeFilter === 'ACTIVE') {
      result = result.filter((p) => p.isActive);
    }

    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.planNumber?.toLowerCase().includes(q) ||
          p.name?.toLowerCase().includes(q) ||
          p.projectCode?.toLowerCase().includes(q) ||
          p.projectName?.toLowerCase().includes(q) ||
          p.status?.toLowerCase().includes(q)
      );
    }

    // Sorting
    result.sort((a: any, b: any) => {
      let va = a[sortField];
      let vb = b[sortField];

      // Handle numbers vs strings
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortOrder === 'asc' ? va - vb : vb - va;
      }
      va = String(va || '').toLowerCase();
      vb = String(vb || '').toLowerCase();
      return sortOrder === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    return result;
  }, [plans, statusFilter, typeFilter, searchTerm, sortField, sortOrder]);

  // Paginated items
  const total = filteredAndSortedPlans.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedPlans = filteredAndSortedPlans.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="bg-white dark:bg-[#0b101b] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
      {/* Table Toolbar */}
      <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-[#0078d4]" />
          <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">Project Plans Summary Table</h2>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
            {total} {total === 1 ? 'plan' : 'plans'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search plan # or name..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 w-48 sm:w-56 focus:outline-none focus:ring-1 focus:ring-[#0078d4]"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Statuses</option>
            <option value="Active">Active Only</option>
            <option value="Approved">Approved</option>
            <option value="Draft">Draft</option>
            <option value="In Review">In Review</option>
            <option value="Locked">Locked</option>
            <option value="Archived">Archived</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Types</option>
            <option value="BASELINE">Baseline Plans</option>
            <option value="ALTERNATIVE">Alternative Scenarios</option>
            <option value="ACTIVE">Currently Active</option>
          </select>

          {/* New Plan Button */}
          {onCreateNewPlan && (
            <button
              onClick={onCreateNewPlan}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white text-xs font-bold rounded-lg transition-colors shadow-2xs cursor-pointer ml-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ New Plan</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Structured Table (Requirement 11) */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
          <thead className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 text-[11px]">
            <tr>
              {/* 1. Plan Number */}
              <th
                onClick={() => handleSort('planNumber')}
                className="py-2.5 px-3 font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60"
              >
                <div className="flex items-center space-x-1">
                  <span>Plan #</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* 2. Plan Name */}
              <th
                onClick={() => handleSort('name')}
                className="py-2.5 px-3 font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60"
              >
                <div className="flex items-center space-x-1">
                  <span>Plan Name</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* 3. Project */}
              <th className="py-2.5 px-3 font-semibold">Project</th>

              {/* 4. Revision */}
              <th className="py-2.5 px-3 font-semibold text-center">Rev</th>

              {/* 5. Status */}
              <th className="py-2.5 px-3 font-semibold">Status</th>

              {/* 6. Planned Revenue */}
              <th
                onClick={() => handleSort('plannedRevenue')}
                className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>Planned Revenue</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* 7. Direct Cost */}
              <th
                onClick={() => handleSort('directCost')}
                className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>Direct Cost</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* 8. Allocated Overhead */}
              <th
                onClick={() => handleSort('allocatedOverhead')}
                className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>Overhead</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* 9. Total Planned Cost */}
              <th
                onClick={() => handleSort('totalPlannedCost')}
                className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>Total Planned Cost</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* 10. Planned Profit */}
              <th
                onClick={() => handleSort('plannedProfit')}
                className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>Planned Profit</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* 11. Profit Margin */}
              <th
                onClick={() => handleSort('profitMarginPct')}
                className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>Margin %</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* 12. Last Updated Date */}
              <th
                onClick={() => handleSort('lastUpdated')}
                className="py-2.5 px-3 font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60"
              >
                <div className="flex items-center space-x-1">
                  <span>Last Updated</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* 13. Available Actions */}
              <th className="py-2.5 px-3 font-semibold text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
            {pagedPlans.map((plan) => {
              const isActive = plan.isActive || plan.id === activePlanId;
              const margin = Number(plan.profitMarginPct ?? plan.costSummary?.profitMarginPct ?? 0);
              const target = Number(plan.targetMarginPct || 25);
              const marginGood = margin >= target;

              return (
                <tr
                  key={plan.id}
                  onClick={() => onViewPlanDetails(plan.id)}
                  className={`hover:bg-blue-50/50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer ${
                    isActive ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''
                  }`}
                  title={`Click to open ${plan.name} (${plan.planNumber})`}
                >
                  {/* 1. Plan Number */}
                  <td className="py-2.5 px-3 font-mono font-bold text-[#0078d4]">
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewPlanDetails(plan.id);
                        }}
                        className="hover:underline text-[#0078d4] font-bold text-left cursor-pointer flex items-center space-x-1"
                        title={`Open Plan ${plan.planNumber}`}
                      >
                        <span>{plan.planNumber}</span>
                      </button>
                      {plan.isBaseline && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-sans font-semibold">
                          B
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 2. Plan Name */}
                  <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100 max-w-[200px] truncate">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewPlanDetails(plan.id);
                      }}
                      className="text-left hover:underline text-[#0078d4] font-semibold truncate block cursor-pointer"
                      title={plan.name}
                    >
                      {plan.name}
                    </button>
                    {isActive && (
                      <span className="inline-flex items-center space-x-0.5 text-[9px] text-emerald-600 font-semibold mt-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>Active Plan</span>
                      </span>
                    )}
                  </td>

                  {/* 3. Project */}
                  <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                    <div>{plan.projectCode || plan.projectId}</div>
                    {plan.clientName && <div className="font-sans text-[10px] text-slate-400">{plan.clientName}</div>}
                  </td>

                  {/* 4. Revision */}
                  <td className="py-2.5 px-3 text-center font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                      {plan.versionLabel || `v${plan.revisionNumber}.0`}
                    </span>
                  </td>

                  {/* 5. Status */}
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        plan.status === 'Active'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : plan.status === 'Approved'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : plan.status === 'Archived'
                          ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {plan.status}
                    </span>
                  </td>

                  {/* 6. Planned Revenue */}
                  <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-900 dark:text-slate-100">
                    {formatCurrency(plan.plannedRevenue, activeCurrency)}
                  </td>

                  {/* 7. Direct Cost */}
                  <td className="py-2.5 px-3 text-right font-mono text-[#0078d4] dark:text-sky-400 font-medium">
                    {formatCurrency(plan.directCost, activeCurrency)}
                  </td>

                  {/* 8. Allocated Overhead */}
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                    {formatCurrency(plan.allocatedOverhead, activeCurrency)}
                  </td>

                  {/* 9. Total Planned Cost */}
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                    {formatCurrency(plan.totalPlannedCost, activeCurrency)}
                  </td>

                  {/* 10. Planned Profit */}
                  <td
                    className={`py-2.5 px-3 text-right font-mono font-bold ${
                      plan.plannedProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatCurrency(plan.plannedProfit, activeCurrency)}
                  </td>

                  {/* 11. Profit Margin */}
                  <td className="py-2.5 px-3 text-right font-mono font-bold">
                    <span
                      className={`px-1.5 py-0.5 rounded ${
                        marginGood
                          ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}
                    >
                      {margin.toFixed(1)}%
                    </span>
                  </td>

                  {/* 12. Last Updated Date */}
                  <td className="py-2.5 px-3 font-mono text-slate-500 text-[10px]">
                    {plan.lastUpdated || plan.updatedAt?.slice(0, 10) || plan.effectiveDate || '-'}
                  </td>

                  {/* 13. Available Actions */}
                  <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center space-x-1">
                      {/* View Details */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewPlanDetails(plan.id);
                        }}
                        className="px-2 py-1 text-xs font-semibold text-[#0078d4] bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-md transition-colors flex items-center space-x-1 cursor-pointer border border-blue-200 dark:border-blue-800"
                        title="View Full Plan Details & Cost Controls"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Open</span>
                      </button>

                      {/* Activate */}
                      {!isActive && plan.status !== 'Archived' && onActivatePlan && (
                        <button
                          type="button"
                          onClick={() => onActivatePlan(plan.id)}
                          className="px-1.5 py-0.5 text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded border border-emerald-200 font-semibold transition-colors"
                          title="Set as Active Plan"
                        >
                          Activate
                        </button>
                      )}

                      {/* Duplicate */}
                      {onDuplicatePlan && (
                        <button
                          type="button"
                          onClick={() => onDuplicatePlan(plan.id)}
                          className="p-1 text-slate-600 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                          title="Duplicate Plan"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Archive */}
                      {plan.status !== 'Archived' && onArchivePlan && (
                        <button
                          type="button"
                          onClick={() => onArchivePlan(plan.id)}
                          className="p-1 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                          title="Archive Plan"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Delete */}
                      {!isActive && !plan.isBaseline && onDeletePlan && (
                        <button
                          type="button"
                          onClick={() => onDeletePlan(plan.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                          title="Delete Plan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {pagedPlans.length === 0 && (
              <tr>
                <td colSpan={13} className="py-8 text-center text-slate-400 font-sans">
                  {isLoading ? 'Loading project plans from PostgreSQL...' : 'No project plans found matching criteria.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50/40 dark:bg-slate-900/40">
        <div>
          Showing {total === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, total)} of {total} records
        </div>

        <div className="flex items-center space-x-2">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-800"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>

          <div className="flex items-center space-x-1 ml-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
