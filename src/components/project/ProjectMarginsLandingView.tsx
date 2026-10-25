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
import { ModernTileCard } from '../ModernTileCard';
import { getThemeById } from '../../data/tileThemes';
import { themeService } from '../../services/themeService';

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

  const [tileThemes, setTileThemes] = useState<Record<string, { themeId: string; customGradient?: string }>>({});

  const handleUpdateTileTheme = (id: string, themeId: string, customGradient?: string) => {
    setTileThemes((prev) => ({ ...prev, [id]: { themeId, customGradient } }));
    themeService.saveTileTheme(id, themeId, customGradient);
  };

  const getStyleForProject = (p: Project) => {
    if (tileThemes[p.id]) return tileThemes[p.id];
    const saved = themeService.getTileTheme(p.id);
    if (saved) return saved;
    return { themeId: p.themeId || 'pacific-sky', customGradient: p.customGradient };
  };

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
            <h1 className="text-xl sm:text-2xl font-black text-white">
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
                <span>New</span>
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
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/15">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-200 block">Revenue</span>
            <div className="text-lg sm:text-xl font-black font-mono text-white mt-0.5">
              {formatCurrency(portfolioSummary.totalRev, baseCurrency)}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/15">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-200 block">Cost</span>
            <div className="text-lg sm:text-xl font-black font-mono text-white mt-0.5">
              {formatCurrency(portfolioSummary.totalDirect, baseCurrency)}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/15">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-200 block">Profit</span>
            <div className="text-lg sm:text-xl font-black font-mono text-emerald-300 mt-0.5">
              +{formatCurrency(portfolioSummary.totalProfit, baseCurrency)}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/15 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-200 block">Target</span>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <span className="text-lg sm:text-xl font-black text-emerald-300">
                {portfolioSummary.meetingTargetCount}
              </span>
              <span className="text-xs text-sky-200">/ {portfolioSummary.count}</span>
            </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMetrics.map((m) => {
            const p = m.project;
            const isHigh = m.grossMarginPct >= m.targetMargin;
            const isWarning = m.grossMarginPct < threshold && m.grossMarginPct > 0;
            const isNegative = m.grossMarginPct <= 0;
            const progressRatio = Math.min(100, Math.max(0, (m.grossMarginPct / (m.targetMargin || 35)) * 100));
            const style = getStyleForProject(p);

            return (
              <ModernTileCard
                key={p.id}
                id={p.id}
                tag={`MARGIN ANALYSIS • ${p.code}`}
                title={p.name}
                brief={`Client: ${p.clientName || 'Enterprise Partner'} • Quoted: ${formatCurrency(m.quotedRevenue, m.currency)}`}
                actionLabel="MARGIN CONTROLS"
                actionVariant="button"
                themeId={style.themeId}
                customGradient={style.customGradient}
                onChangeTheme={(tId, grad) => handleUpdateTileTheme(p.id, tId, grad)}
                onClick={() => onSelectProject(p, 'margins')}
                onAction={() => onSelectProject(p, 'cost-controls')}
                listViewLabel="FXTT Grid"
                onViewListView={() => onSelectProject(p, 'margins')}
                onViewMargins={() => onSelectProject(p, 'margins')}
                onViewTimelines={() => onSelectProject(p, 'dashboard')}
                extraMeta={
                  <div className="space-y-2.5 pt-1 text-white">
                    {/* Gross Margin Meter Header */}
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">
                        Gross Margin
                      </span>
                      <div className="flex items-baseline space-x-1.5 font-mono">
                        <span className={`text-xl font-black ${isNegative ? 'text-rose-300' : isWarning ? 'text-amber-300' : isHigh ? 'text-emerald-300' : 'text-white'}`}>
                          {m.grossMarginPct}%
                        </span>
                        <span className="text-[11px] text-white/70">
                          / Target {m.targetMargin}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-black/35 h-2 rounded-full overflow-hidden backdrop-blur-xs">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isNegative
                            ? 'bg-rose-400'
                            : isWarning
                            ? 'bg-amber-400'
                            : isHigh
                            ? 'bg-emerald-400'
                            : 'bg-sky-300'
                        }`}
                        style={{ width: `${progressRatio}%` }}
                      />
                    </div>

                    {/* Health Status & Net Margin */}
                    <div className="flex items-center justify-between text-[10px] text-white/90 font-medium">
                      <span>
                        Net Margin: <strong className="font-mono text-white">{m.netMarginPct}%</strong>
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        isHigh
                          ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40'
                          : isWarning
                          ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40'
                          : isNegative
                          ? 'bg-rose-500/30 text-rose-200 border border-rose-400/40'
                          : 'bg-white/20 text-white'
                      }`}>
                        {isHigh ? 'Optimal Margin' : isWarning ? 'Below Target' : isNegative ? 'Negative Yield' : 'On Track'}
                      </span>
                    </div>

                    {/* 3-Column Financial Metrics Box */}
                    <div className="grid grid-cols-3 gap-1.5 pt-1 text-[10px] text-center font-mono">
                      <div className="bg-black/25 backdrop-blur-xs rounded-lg p-1.5 border border-white/10">
                        <div className="text-[8px] text-white/60 uppercase">Revenue</div>
                        <div className="font-bold text-white truncate">{formatCurrency(m.quotedRevenue, m.currency)}</div>
                      </div>
                      <div className="bg-black/25 backdrop-blur-xs rounded-lg p-1.5 border border-white/10">
                        <div className="text-[8px] text-white/60 uppercase">Total Cost</div>
                        <div className="font-bold text-white/90 truncate">{formatCurrency(m.totalProjectCost, m.currency)}</div>
                      </div>
                      <div className="bg-black/25 backdrop-blur-xs rounded-lg p-1.5 border border-white/10">
                        <div className="text-[8px] text-white/60 uppercase">Gross Profit</div>
                        <div className={`font-bold truncate ${m.grossProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                          +{formatCurrency(m.grossProfit, m.currency)}
                        </div>
                      </div>
                    </div>

                    {/* Linked Cost Items Strip */}
                    <div className="flex items-center justify-between text-[10px] text-white/80 pt-0.5">
                      <span className="flex items-center space-x-1">
                        <Layers className="w-3 h-3 text-white/70" />
                        <span><strong>{m.itemsCount}</strong> Cost items</span>
                      </span>
                      <span className="font-mono text-[9px] text-white/70">
                        Direct: {formatCurrency(m.directCost, m.currency)}
                      </span>
                    </div>
                  </div>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
