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
  const [statusFilter, setStatusFilter] = useState<'all' | 'on_track' | 'critical' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'deadline_asc' | 'progress_desc' | 'name' | 'code'>('deadline_asc');

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
              <span>Project Schedules &amp; Milestone Tracking</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
              Project Timelines Portfolio
            </h1>
            <p className="text-xs text-sky-100/90 mt-0.5">
              Review critical path schedules, phase progress, delivery commitments, and subcontractor resource assignments across all enterprise projects.
            </p>
          </div>
        </div>

        {/* 4-Stat Telemetry Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3">
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/15">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-200 block">Total Active Projects</span>
            <div className="text-xl sm:text-2xl font-black font-mono text-white mt-0.5">
              {aggregateStats.totalProjects}
            </div>
            <span className="text-[10px] text-sky-200 block mt-0.5">
              Tracked in schedule calendar
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/15">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-200 block">Milestones Completed</span>
            <div className="text-lg sm:text-xl font-black font-mono text-[#fdf0d5] mt-0.5">
              {aggregateStats.completedMilestones} / {aggregateStats.totalMilestones}
            </div>
            <span className="text-[10px] text-sky-200 block mt-0.5">
              {aggregateStats.overallProgress}% Portfolio milestone rate
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/15">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-200 block">On Schedule</span>
            <div className="text-lg sm:text-xl font-black font-mono text-emerald-300 mt-0.5">
              {aggregateStats.onTrack} Projects
            </div>
            <span className="text-[10px] text-emerald-200 block mt-0.5">
              Milestone dates satisfied
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/15">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-200 block">Critical Path Alerts</span>
            <div className="text-lg sm:text-xl font-black font-mono text-amber-300 mt-0.5">
              {aggregateStats.critical} Projects
            </div>
            <span className="text-[10px] text-amber-200 block mt-0.5">
              Target delivery within 14 days
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
          <span className="text-[11px] font-semibold text-slate-400 uppercase mr-1">Status:</span>
          {[
            { id: 'all', label: 'All Projects', count: timelineCards.length },
            { id: 'on_track', label: 'On Schedule', count: aggregateStats.onTrack },
            { id: 'critical', label: 'Critical Path', count: aggregateStats.critical },
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {filteredCards.map((card) => {
            const p = card.project;
            const isCritical = card.scheduleStatus === 'critical';
            const isCompleted = card.scheduleStatus === 'completed';

            return (
              <div
                key={p.id}
                onClick={() => onSelectProject(p)}
                className="bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-[#0078d4] dark:hover:border-sky-500 hover:shadow-md transition-all p-4 cursor-pointer flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Status Color Strip */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1.5 ${
                    isCompleted
                      ? 'bg-emerald-500'
                      : isCritical
                      ? 'bg-amber-500'
                      : 'bg-[#0078d4]'
                  }`}
                />

                <div>
                  {/* Top Bar: Code, Schedule Badge, Client */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-bold text-[#003049] dark:text-sky-300 bg-blue-50 dark:bg-sky-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                      {p.code}
                    </span>

                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center space-x-1 ${
                        isCompleted
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : isCritical
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-sky-300'
                      }`}
                    >
                      {isCritical && <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />}
                      <span>{isCompleted ? 'Delivered' : isCritical ? 'Critical Path' : 'On Schedule'}</span>
                    </span>
                  </div>

                  {/* Title & Client */}
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#0078d4] dark:group-hover:text-sky-400 transition-colors line-clamp-1">
                    {p.name}
                  </h3>

                  <div className="flex items-center space-x-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    <span className="flex items-center space-x-1 truncate max-w-[150px]">
                      <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{p.clientName || 'Commercial Client'}</span>
                    </span>
                    <span>•</span>
                    <span className="truncate">{p.productCategory || 'Engineering Assembly'}</span>
                  </div>

                  {/* TIMELINE PROGRESS METER */}
                  <div className="mt-3.5 bg-slate-50 dark:bg-slate-900/80 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Schedule Completion
                      </span>
                      <span className="text-lg font-black font-mono text-slate-900 dark:text-slate-100">
                        {card.progressPct}%
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isCompleted
                            ? 'bg-emerald-500'
                            : isCritical
                            ? 'bg-amber-500'
                            : 'bg-[#0078d4]'
                        }`}
                        style={{ width: `${card.progressPct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
                      <span className="flex items-center space-x-1">
                        <Flag className="w-3 h-3 text-purple-600" />
                        <span><strong>{card.completedMilestones}</strong> of {card.totalMilestones || 4} Milestones</span>
                      </span>

                      <span className="flex items-center space-x-1">
                        <Layers className="w-3 h-3 text-blue-600" />
                        <span>{card.totalPhases || 3} Phases</span>
                      </span>
                    </div>
                  </div>

                  {/* TIMELINE DATES & COUNTDOWN */}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Start Date</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
                        {card.startDate}
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Delivery Deadline</span>
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
                          {card.deadline}
                        </span>
                        {!isCompleted && card.diffDays > 0 && (
                          <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                            card.diffDays <= 14 ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {card.diffDays}d left
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ACTIVE PHASE BANNER */}
                  {card.activePhase && (
                    <div className="mt-2.5 px-2.5 py-1.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex items-center justify-between text-[11px]">
                      <span className="text-slate-600 dark:text-slate-300 font-medium truncate">
                        Active: <strong className="text-[#003049] dark:text-sky-300">{card.activePhase.name}</strong>
                      </span>
                      <span className="text-[10px] text-blue-700 dark:text-sky-400 font-bold shrink-0 ml-1">
                        Phase {card.activePhase.order || 1}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Action Footer */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="text-[11px] text-slate-500 flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Gantt Schedule</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectProject(p);
                    }}
                    className="px-3 py-1.5 bg-[#003049] group-hover:bg-[#0078d4] text-white text-xs font-bold rounded-lg transition-colors flex items-center space-x-1 shadow-2xs cursor-pointer"
                  >
                    <span>Open Timeline &amp; Gantt</span>
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
