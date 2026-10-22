import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Search,
  Filter,
  Building2,
  DollarSign,
  Percent,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Layers,
  SlidersHorizontal,
  Package,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Flame,
  LayoutGrid,
  FileSpreadsheet
} from 'lucide-react';
import { Project, MaterialItem, Supplier, SubcontractorRateItem, OutsourcedService } from '../../types';
import { formatCurrency, getCurrencyInfo, getStoredCurrency } from '../../utils/currency';
import { getMarginThreshold } from '../../utils/profitabilityMonitor';

interface ProjectMarginsLandingViewProps {
  projects: Project[];
  onSelectProject: (project: Project, targetTab?: 'margins' | 'dashboard' | 'cost-controls') => void;
  onOpenCreateProject?: () => void;
}

export const ProjectMarginsLandingView: React.FC<ProjectMarginsLandingViewProps> = ({
  projects,
  onSelectProject,
  onOpenCreateProject
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [marginFilter, setMarginFilter] = useState<'all' | 'high' | 'target' | 'risk' | 'negative'>('all');
  const [sortBy, setSortBy] = useState<'margin_desc' | 'margin_asc' | 'revenue_desc' | 'cost_desc' | 'name' | 'code'>('margin_desc');
  const baseCurrency = getStoredCurrency();
  const threshold = getMarginThreshold();

  // Calculate detailed financial health for each project
  const projectMetrics = useMemo(() => {
    return projects.map((p) => {
      const activePlan = p.budgetaryPlans?.find((plan) => plan.id === p.activePlanId) || p.budgetaryPlans?.[0];
      const items = (activePlan?.selectedItems && activePlan.selectedItems.length > 0)
        ? activePlan.selectedItems
        : (p.selectedItems || []);

      let matCost = 0;
      let subCost = 0;
      let outCost = 0;
      let ovhCost = 0;

      items.forEach((it) => {
        const c = typeof it.totalCost === 'number' ? it.totalCost : ((it.quantity || 1) * (it.unitCost || 0));
        if (it.type === 'material') matCost += c;
        else if (it.type === 'subcontractor') subCost += c;
        else if (it.type === 'outsourced') outCost += c;
        else ovhCost += c;
      });

      const directCost = matCost + subCost + outCost;
      const overheadPct = activePlan?.overheadPct ?? p.overheadPct ?? 8.5;
      const contingencyPct = activePlan?.contingencyPct ?? p.contingencyPct ?? 5.0;
      const allocatedAddons = Math.round(directCost * ((overheadPct + contingencyPct) / 100)) + ovhCost;
      const totalProjectCost = directCost + allocatedAddons;

      const quotedRevenue = p.quotedPrice || (items.reduce((acc, it) => acc + (it.totalRevenue || 0), 0)) || 0;
      const grossProfit = quotedRevenue - directCost;
      const grossMarginPct = quotedRevenue > 0 ? Number(((grossProfit / quotedRevenue) * 100).toFixed(1)) : 0;

      const netProfit = quotedRevenue - totalProjectCost;
      const netMarginPct = quotedRevenue > 0 ? Number(((netProfit / quotedRevenue) * 100).toFixed(1)) : 0;

      const targetMargin = p.targetMarginPct || 35;
      const deliverablesCount = (p.deliverables && p.deliverables.length > 0)
        ? p.deliverables.length
        : items.length;

      let marginHealth: 'optimal' | 'target' | 'warning' | 'danger' = 'warning';
      if (grossMarginPct >= targetMargin) {
        marginHealth = 'optimal';
      } else if (grossMarginPct >= targetMargin * 0.8) {
        marginHealth = 'target';
      } else if (grossMarginPct > 0) {
        marginHealth = 'warning';
      } else {
        marginHealth = 'danger';
      }

      return {
        project: p,
        quotedRevenue,
        directCost,
        totalProjectCost,
        grossProfit,
        grossMarginPct,
        netProfit,
        netMarginPct,
        targetMargin,
        itemsCount: items.length,
        deliverablesCount,
        matCost,
        subCost,
        outCost,
        allocatedAddons,
        marginHealth,
        currency: p.currency || baseCurrency
      };
    });
  }, [projects, baseCurrency]);

  // Filter and sort
  const filteredMetrics = useMemo(() => {
    return projectMetrics
      .filter((m) => {
        const p = m.project;
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery =
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.clientName && p.clientName.toLowerCase().includes(q)) ||
          (p.productCategory && p.productCategory.toLowerCase().includes(q));

        if (!matchesQuery) return false;

        if (marginFilter === 'high') return m.grossMarginPct >= 35;
        if (marginFilter === 'target') return m.grossMarginPct >= m.targetMargin * 0.8 && m.grossMarginPct < 35;
        if (marginFilter === 'risk') return m.grossMarginPct < m.targetMargin * 0.8 && m.grossMarginPct > 0;
        if (marginFilter === 'negative') return m.grossMarginPct <= 0;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'margin_desc') return b.grossMarginPct - a.grossMarginPct;
        if (sortBy === 'margin_asc') return a.grossMarginPct - b.grossMarginPct;
        if (sortBy === 'revenue_desc') return b.quotedRevenue - a.quotedRevenue;
        if (sortBy === 'cost_desc') return b.totalProjectCost - a.totalProjectCost;
        if (sortBy === 'name') return a.project.name.localeCompare(b.project.name);
        if (sortBy === 'code') return a.project.code.localeCompare(b.project.code);
        return 0;
      });
  }, [projectMetrics, searchQuery, marginFilter, sortBy]);

  // Portfolio aggregates
  const portfolioSummary = useMemo(() => {
    const totalRev = projectMetrics.reduce((sum, m) => sum + m.quotedRevenue, 0);
    const totalCost = projectMetrics.reduce((sum, m) => sum + m.totalProjectCost, 0);
    const totalDirect = projectMetrics.reduce((sum, m) => sum + m.directCost, 0);
    const totalProfit = totalRev - totalCost;
    const avgMargin = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0;
    const meetingTargetCount = projectMetrics.filter((m) => m.grossMarginPct >= m.targetMargin).length;
    const atRiskCount = projectMetrics.filter((m) => m.grossMarginPct < threshold || m.grossMarginPct <= 0).length;

    return {
      totalRev,
      totalCost,
      totalDirect,
      totalProfit,
      avgMargin: Number(avgMargin.toFixed(1)),
      meetingTargetCount,
      atRiskCount,
      count: projectMetrics.length
    };
  }, [projectMetrics, threshold]);

  return (
    <div className="space-y-4 font-sans select-none animate-in fade-in duration-200">
      {/* 1. PORTFOLIO TELEMETRY HEADER */}
      <div className="bg-gradient-to-r from-[#003049] via-[#004e8a] to-[#0078d4] rounded-2xl p-4 sm:p-5 text-white shadow-md border border-[#002235]">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/15">
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-sky-200 uppercase tracking-wider">
              <TrendingUp className="w-4 h-4 text-[#fdf0d5]" />
              <span>Executive Margin Intelligence Portfolio</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
              Margins
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {onOpenCreateProject && (
              <button
                type="button"
                onClick={onOpenCreateProject}
                className="px-3 py-1.5 bg-[#fdf0d5] hover:bg-[#ecd5a8] text-[#003049] rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#003049]" />
                <span>+ New Project</span>
              </button>
            )}
          </div>
        </div>

        {/* 5-Column Portfolio KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-3">
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/15">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-200 block">Margin</span>
            <div className="text-xl sm:text-2xl font-black font-mono text-[#fdf0d5] mt-0.5">
              {portfolioSummary.avgMargin}%
            </div>
            <span className="text-[10px] text-sky-200 block mt-0.5">
              Target: 35%
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/15">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-200 block">Revenue</span>
            <div className="text-lg sm:text-xl font-black font-mono text-white mt-0.5">
              {formatCurrency(portfolioSummary.totalRev, baseCurrency)}
            </div>
            <span className="text-[10px] text-sky-200 block mt-0.5">
              {portfolioSummary.count} Projects
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/15">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-200 block">Cost</span>
            <div className="text-lg sm:text-xl font-black font-mono text-white mt-0.5">
              {formatCurrency(portfolioSummary.totalDirect, baseCurrency)}
            </div>
            <span className="text-[10px] text-sky-200 block mt-0.5">
              Direct
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/15">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-200 block">Profit</span>
            <div className="text-lg sm:text-xl font-black font-mono text-emerald-300 mt-0.5">
              +{formatCurrency(portfolioSummary.totalProfit, baseCurrency)}
            </div>
            <span className="text-[10px] text-emerald-200 block mt-0.5">
              Gross
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/15 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-200 block">Target</span>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <span className="text-lg sm:text-xl font-black text-emerald-300">
                {portfolioSummary.meetingTargetCount}
              </span>
              <span className="text-xs text-sky-200">/ {portfolioSummary.count}</span>
            </div>
            <span className="text-[10px] text-amber-200 block mt-0.5">
              {portfolioSummary.atRiskCount} at risk
            </span>
          </div>
        </div>
      </div>

      {/* 2. SEARCH & FILTER TOOLBAR */}
      <div className="bg-white dark:bg-[#0b101b] rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative min-w-[240px] max-w-md flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search project by code, name, client, category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0078d4]"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto text-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase mr-1">Filter:</span>
          {[
            { id: 'all', label: 'All', count: projectMetrics.length },
            { id: 'high', label: 'High', count: projectMetrics.filter(m => m.grossMarginPct >= 35).length },
            { id: 'target', label: 'Target', count: projectMetrics.filter(m => m.grossMarginPct >= m.targetMargin * 0.8 && m.grossMarginPct < 35).length },
            { id: 'risk', label: 'Risk', count: projectMetrics.filter(m => m.grossMarginPct < m.targetMargin * 0.8 && m.grossMarginPct > 0).length },
            { id: 'negative', label: 'Deficit', count: projectMetrics.filter(m => m.grossMarginPct <= 0).length }
          ].map((tab) => {
            const active = marginFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMarginFilter(tab.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center space-x-1 cursor-pointer ${
                  active
                    ? 'bg-[#003049] text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sort */}
        <div className="flex items-center space-x-1.5 text-xs text-slate-500">
          <span className="font-semibold text-[11px] uppercase">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            <option value="margin_desc">Highest Margin %</option>
            <option value="margin_asc">Lowest Margin %</option>
            <option value="revenue_desc">Highest Revenue</option>
            <option value="cost_desc">Highest Total Cost</option>
            <option value="name">Project Name</option>
            <option value="code">Project Code</option>
          </select>
        </div>
      </div>

      {/* 3. PROJECT CARDS GRID */}
      {filteredMetrics.length === 0 ? (
        <div className="bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-xs">
          <Package className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No matching projects found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search criteria or filter to see more projects.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setMarginFilter('all');
            }}
            className="mt-3 px-3.5 py-1.5 bg-[#0078d4] text-white text-xs font-bold rounded-lg cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {filteredMetrics.map((m) => {
            const p = m.project;
            const isHigh = m.grossMarginPct >= m.targetMargin;
            const isWarning = m.grossMarginPct < threshold && m.grossMarginPct > 0;
            const isNegative = m.grossMarginPct <= 0;

            const progressRatio = Math.min(100, Math.max(0, (m.grossMarginPct / (m.targetMargin || 35)) * 100));

            return (
              <div
                key={p.id}
                onClick={() => onSelectProject(p, 'margins')}
                className="bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-[#0078d4] dark:hover:border-sky-500 hover:shadow-md transition-all p-4 cursor-pointer flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Top Strip Accents */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1.5 ${
                    isNegative
                      ? 'bg-rose-500'
                      : isWarning
                      ? 'bg-amber-500'
                      : isHigh
                      ? 'bg-emerald-500'
                      : 'bg-[#0078d4]'
                  }`}
                />

                <div>
                  {/* Card Header: Code, Status & Client */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-bold text-[#003049] dark:text-sky-300 bg-blue-50 dark:bg-sky-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                      {p.code}
                    </span>

                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        p.status === 'Completed'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : p.status === 'In Progress' || p.status === 'In Assembly'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-sky-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {p.status || 'Active'}
                    </span>
                  </div>

                  {/* Project Title */}
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#0078d4] dark:group-hover:text-sky-400 transition-colors line-clamp-1">
                    {p.name}
                  </h3>

                  {/* Client & Category Subtitle */}
                  <div className="flex items-center space-x-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    <span className="flex items-center space-x-1 truncate max-w-[150px]">
                      <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{p.clientName || 'Enterprise Partner'}</span>
                    </span>
                    <span>•</span>
                    <span className="truncate">{p.productCategory || 'Engineering'}</span>
                  </div>

                  {/* MARGIN PROGRESS METER */}
                  <div className="mt-3.5 bg-slate-50 dark:bg-slate-900/80 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Gross Margin
                      </span>
                      <div className="flex items-baseline space-x-1.5">
                        <span
                          className={`text-xl font-black font-mono ${
                            isNegative
                              ? 'text-rose-600 dark:text-rose-400'
                              : isWarning
                              ? 'text-amber-600 dark:text-amber-400'
                              : isHigh
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {m.grossMarginPct}%
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          / Target {m.targetMargin}%
                        </span>
                      </div>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isNegative
                            ? 'bg-rose-500'
                            : isWarning
                            ? 'bg-amber-500'
                            : isHigh
                            ? 'bg-emerald-500'
                            : 'bg-[#0078d4]'
                        }`}
                        style={{ width: `${progressRatio}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
                      <span>
                        Net Margin: <strong className="font-mono text-slate-800 dark:text-slate-200">{m.netMarginPct}%</strong>
                      </span>
                      {isHigh ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center">
                          <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> Optimal Margin
                        </span>
                      ) : isWarning ? (
                        <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center">
                          <AlertTriangle className="w-2.5 h-2.5 mr-0.5" /> Below Target
                        </span>
                      ) : isNegative ? (
                        <span className="text-rose-600 dark:text-rose-400 font-bold">
                          Negative Yield
                        </span>
                      ) : (
                        <span className="text-blue-600 dark:text-blue-400 font-bold">
                          On Track
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 3-COLUMN FINANCIAL STATS */}
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Revenue</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(m.quotedRevenue, m.currency)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block">Total Cost</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                        {formatCurrency(m.totalProjectCost, m.currency)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block">Gross Profit</span>
                      <span
                        className={`font-mono font-bold ${
                          m.grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'
                        }`}
                      >
                        +{formatCurrency(m.grossProfit, m.currency)}
                      </span>
                    </div>
                  </div>

                  {/* Deliverables / Sourced Breakdown Strip */}
                  <div className="mt-3 py-1.5 px-2 bg-slate-50/70 dark:bg-slate-900/50 rounded-lg flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                    <span className="flex items-center space-x-1">
                      <Layers className="w-3 h-3 text-[#0078d4]" />
                      <span><strong>{m.itemsCount}</strong> Cost items linked</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Direct: {formatCurrency(m.directCost, m.currency)}
                    </span>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectProject(p, 'cost-controls');
                    }}
                    className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-[#0078d4] dark:hover:text-sky-300 transition-colors flex items-center space-x-1"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Controls</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectProject(p, 'margins');
                    }}
                    className="px-3 py-1.5 bg-[#003049] group-hover:bg-[#0078d4] text-white text-xs font-bold rounded-lg transition-colors flex items-center space-x-1 shadow-2xs cursor-pointer"
                  >
                    <span>Margins</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
