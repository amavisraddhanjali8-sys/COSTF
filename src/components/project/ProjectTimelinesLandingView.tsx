import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Search,
  Filter,
  Building2,
  Users,
  Target,
  Sparkles,
  Layers,
  Flag,
  Check,
  ChevronRight,
  PlayCircle
} from 'lucide-react';
import { Project, ProjectPhase, ProjectMilestone, AppUser, SubcontractorRateItem } from '../../types';
import { ModernTileCard } from '../ModernTileCard';
import { themeService } from '../../services/themeService';

interface ProjectTimelinesLandingViewProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  users?: AppUser[];
  subcontractors?: SubcontractorRateItem[];
}

export const ProjectTimelinesLandingView: React.FC<ProjectTimelinesLandingViewProps> = ({
  projects,
  onSelectProject,
  users = [],
  subcontractors = []
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'deadline_asc' | 'progress_desc' | 'name' | 'code'>('deadline_asc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'on_track' | 'critical' | 'completed'>('all');

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

  // Compute timeline metrics for each project
  const timelineCards = useMemo(() => {
    return projects.map((p) => {
      const phases: ProjectPhase[] = p.phases || [];
      const totalPhases = phases.length;

      // Collect all milestones across phases
      const allMilestones: ProjectMilestone[] = [];
      phases.forEach((ph) => {
        if (ph.milestones && ph.milestones.length > 0) {
          allMilestones.push(...ph.milestones);
        }
      });

      const totalMilestones = allMilestones.length;
      const completedMilestones = allMilestones.filter((m) => m.completed).length;

      // Completion % derived from milestones or phases
      let progressPct = 0;
      if (totalMilestones > 0) {
        progressPct = Math.round((completedMilestones / totalMilestones) * 100);
      } else if (totalPhases > 0) {
        // Fallback: estimate from phases actual vs budget
        const totalBudget = phases.reduce((acc, ph) => acc + (ph.budget || 0), 0);
        const totalActual = phases.reduce((acc, ph) => acc + (ph.actual || 0), 0);
        progressPct = totalBudget > 0 ? Math.min(100, Math.round((totalActual / totalBudget) * 100)) : 25;
      } else {
        progressPct = p.status === 'Completed' ? 100 : p.status === 'In Progress' ? 45 : 15;
      }

      // Check dates
      const startDate = p.startDate || '2026-03-01';
      const deadline = p.deliveryDeadline || '2026-11-30';
      const now = new Date('2026-10-22');
      const targetDate = new Date(deadline);
      const diffTime = targetDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let scheduleStatus: 'on_track' | 'critical' | 'completed' = 'on_track';
      if (p.status === 'Completed' || progressPct === 100) {
        scheduleStatus = 'completed';
      } else if (diffDays <= 14 && progressPct < 80) {
        scheduleStatus = 'critical';
      } else {
        scheduleStatus = 'on_track';
      }

      // Find active phase
      const activePhase = phases.find((ph) => (ph.actual || 0) < (ph.budget || 0)) || phases[0];

      return {
        project: p,
        phases,
        totalPhases,
        totalMilestones,
        completedMilestones,
        progressPct,
        startDate,
        deadline,
        diffDays,
        scheduleStatus,
        activePhase
      };
    });
  }, [projects]);

  // Filtered and sorted
  const filteredCards = useMemo(() => {
    return timelineCards
      .filter((card) => {
        const p = card.project;
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery =
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.clientName && p.clientName.toLowerCase().includes(q)) ||
          (p.productCategory && p.productCategory.toLowerCase().includes(q));

        if (!matchesQuery) return false;

        if (statusFilter === 'on_track') return card.scheduleStatus === 'on_track';
        if (statusFilter === 'critical') return card.scheduleStatus === 'critical';
        if (statusFilter === 'completed') return card.scheduleStatus === 'completed';
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'deadline_asc') return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        if (sortBy === 'progress_desc') return b.progressPct - a.progressPct;
        if (sortBy === 'name') return a.project.name.localeCompare(b.project.name);
        if (sortBy === 'code') return a.project.code.localeCompare(b.project.code);
        return 0;
      });
  }, [timelineCards, searchQuery, statusFilter, sortBy]);

  // Aggregate stats
  const aggregateStats = useMemo(() => {
    const totalProjects = timelineCards.length;
    const onTrack = timelineCards.filter((c) => c.scheduleStatus === 'on_track').length;
    const critical = timelineCards.filter((c) => c.scheduleStatus === 'critical').length;
    const completed = timelineCards.filter((c) => c.scheduleStatus === 'completed').length;
    const totalMilestones = timelineCards.reduce((acc, c) => acc + c.totalMilestones, 0);
    const completedMilestones = timelineCards.reduce((acc, c) => acc + c.completedMilestones, 0);

    return {
      totalProjects,
      onTrack,
      critical,
      completed,
      totalMilestones,
      completedMilestones,
      overallProgress: totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 62
    };
  }, [timelineCards]);

  return (
    <div className="space-y-4 font-sans select-none animate-in fade-in duration-200">
      {/* 1. PORTFOLIO TIMELINES HERO / TELEMETRY */}
      <div className="bg-gradient-to-r from-[#003049] via-[#004e8a] to-[#0078d4] rounded-2xl p-4 sm:p-5 text-white shadow-md border border-[#002235]">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/15">
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-sky-200 uppercase tracking-wider">
              <Calendar className="w-4 h-4 text-[#fdf0d5]" />
              <span>Schedules</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
              Timelines
            </h1>
          </div>
        </div>

        {/* 4-Stat Telemetry Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3">
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/15">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-200 block">Projects</span>
            <div className="text-xl sm:text-2xl font-black font-mono text-white mt-0.5">
              {aggregateStats.totalProjects}
            </div>
            <span className="text-[10px] text-sky-200 block mt-0.5">
              Active
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/15">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-200 block">Milestones</span>
            <div className="text-lg sm:text-xl font-black font-mono text-[#fdf0d5] mt-0.5">
              {aggregateStats.completedMilestones} / {aggregateStats.totalMilestones}
            </div>
            <span className="text-[10px] text-sky-200 block mt-0.5">
              {aggregateStats.overallProgress}% done
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/15">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-200 block">On Schedule</span>
            <div className="text-lg sm:text-xl font-black font-mono text-emerald-300 mt-0.5">
              {aggregateStats.onTrack}
            </div>
            <span className="text-[10px] text-emerald-200 block mt-0.5">
              Normal
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/15">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-200 block">Critical</span>
            <div className="text-lg sm:text-xl font-black font-mono text-amber-300 mt-0.5">
              {aggregateStats.critical}
            </div>
            <span className="text-[10px] text-amber-200 block mt-0.5">
              Urgent
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
            placeholder="Search project timelines by code, name, client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0078d4]"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto text-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase mr-1">Filter:</span>
          {[
            { id: 'all', label: 'All', count: timelineCards.length },
            { id: 'on_track', label: 'On Schedule', count: aggregateStats.onTrack },
            { id: 'critical', label: 'Critical', count: aggregateStats.critical },
            { id: 'completed', label: 'Delivered', count: aggregateStats.completed }
          ].map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
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
            <option value="deadline_asc">Upcoming Delivery Date</option>
            <option value="progress_desc">Highest Progress %</option>
            <option value="name">Project Name</option>
            <option value="code">Project Code</option>
          </select>
        </div>
      </div>

      {/* 3. TIMELINES PROJECT CARDS GRID */}
      {filteredCards.length === 0 ? (
        <div className="bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-xs">
          <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No matching timeline schedules found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search query or schedule filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCards.map((card) => {
            const p = card.project;
            const isCritical = card.scheduleStatus === 'critical';
            const isCompleted = card.scheduleStatus === 'completed';
            const style = getStyleForProject(p);

            return (
              <ModernTileCard
                key={p.id}
                id={p.id}
                tag={`TIMELINE • ${p.code}`}
                title={p.name}
                brief={`Client: ${p.clientName || 'Commercial Client'} • ${isCompleted ? 'Delivered' : isCritical ? 'Critical Path' : 'On Schedule'}`}
                actionLabel="VIEW TIMELINE"
                actionVariant="button"
                themeId={style.themeId}
                customGradient={style.customGradient}
                onChangeTheme={(tId, grad) => handleUpdateTileTheme(p.id, tId, grad)}
                onClick={() => onSelectProject(p)}
                onAction={() => onSelectProject(p)}
                listViewLabel="FXTT Grid"
                onViewListView={() => onSelectProject(p)}
                onViewMargins={() => onSelectProject(p)}
                onViewTimelines={() => onSelectProject(p)}
                extraMeta={
                  <div className="space-y-2.5 pt-1 text-white">
                    {/* Completion Meter Header */}
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">
                        Schedule Completion
                      </span>
                      <span className="text-xl font-black font-mono text-white">
                        {card.progressPct}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-black/35 h-2 rounded-full overflow-hidden backdrop-blur-xs">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isCompleted
                            ? 'bg-emerald-400'
                            : isCritical
                            ? 'bg-amber-400'
                            : 'bg-sky-300'
                        }`}
                        style={{ width: `${card.progressPct}%` }}
                      />
                    </div>

                    {/* Milestones & Phases Stats */}
                    <div className="flex items-center justify-between text-[10px] text-white/90 font-medium">
                      <span className="flex items-center space-x-1">
                        <Flag className="w-3 h-3 text-white/80" />
                        <span><strong>{card.completedMilestones}</strong> of {card.totalMilestones || 4} Milestones</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Layers className="w-3 h-3 text-white/80" />
                        <span>{card.totalPhases || 3} Phases</span>
                      </span>
                    </div>

                    {/* Start Date & Deadline Countdown Box */}
                    <div className="grid grid-cols-2 gap-1.5 pt-0.5 text-[10px]">
                      <div className="bg-black/25 backdrop-blur-xs rounded-lg p-1.5 border border-white/10">
                        <span className="text-[8px] text-white/60 block uppercase">Start Date</span>
                        <span className="font-mono font-semibold text-white truncate block">
                          {card.startDate}
                        </span>
                      </div>
                      <div className="bg-black/25 backdrop-blur-xs rounded-lg p-1.5 border border-white/10">
                        <span className="text-[8px] text-white/60 block uppercase">Deadline</span>
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold text-white truncate">
                            {card.deadline}
                          </span>
                          {!isCompleted && card.diffDays > 0 && (
                            <span className={`text-[8px] px-1 py-0.2 rounded font-bold ${
                              card.diffDays <= 14 ? 'bg-amber-400/30 text-amber-200 border border-amber-300/40' : 'bg-white/20 text-white'
                            }`}>
                              {card.diffDays}d
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Active Phase Pill */}
                    {card.activePhase && (
                      <div className="bg-black/25 backdrop-blur-xs rounded-lg px-2 py-1 border border-white/10 flex items-center justify-between text-[10px]">
                        <span className="text-white/90 truncate font-medium">
                          Active: <strong>{card.activePhase.name}</strong>
                        </span>
                        <span className="text-[9px] text-white/70 font-mono shrink-0 ml-1">
                          Phase {card.activePhase.order || 1}
                        </span>
                      </div>
                    )}
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
