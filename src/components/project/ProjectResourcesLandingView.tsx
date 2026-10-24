import React, { useState, useMemo } from 'react';
import {
  Wrench,
  Search,
  Filter,
  Building2,
  FolderGit2,
  Layers,
  ArrowRight,
  Plus,
  Table as TableIcon,
  LayoutGrid,
  Users,
  Cpu,
  Truck,
  Cog,
  HardHat,
  CheckCircle2
} from 'lucide-react';
import { Project, EnterpriseResource } from '../../types';
import { formatCurrency, getStoredCurrency } from '../../utils/currency';

interface ProjectResourcesLandingViewProps {
  projects: Project[];
  resources: EnterpriseResource[];
  onSelectProject: (project: Project) => void;
  onOpenCreateResource?: () => void;
  onViewAllResources?: () => void;
}

export const ProjectResourcesLandingView: React.FC<ProjectResourcesLandingViewProps> = ({
  projects,
  resources,
  onSelectProject,
  onOpenCreateResource,
  onViewAllResources
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'with_resources'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const activeCurrency = getStoredCurrency() || 'LKR';

  // Compute resource links and metrics for each project
  const projectResourceStats = useMemo(() => {
    return projects.map((p) => {
      // 1. Project selected items
      const selected = p.selectedItems || [];
      
      // 2. Resources from postgres where connectedAllocations contains this project
      const linkedFromResources = resources.filter((r) =>
        (r.connectedAllocations || []).some(
          (a) => a.projectId === p.id || a.projectCode === p.code
        )
      );

      // Unique resource names/items
      const resourceNames = new Set<string>();
      let labourCount = 0;
      let machineryCount = 0;
      let equipmentCount = 0;
      let toolCount = 0;
      let materialCount = 0;
      let subCount = 0;
      let totalSpend = 0;

      selected.forEach((it) => {
        const cost = typeof it.totalCost === 'number' ? it.totalCost : ((it.quantity || 1) * (it.unitCost || 0));
        totalSpend += cost;
        resourceNames.add(it.name.toLowerCase());
        const t = (it.type || '').toLowerCase();
        if (t === 'labour') labourCount++;
        else if (t === 'machinery') machineryCount++;
        else if (t === 'equipment') equipmentCount++;
        else if (t === 'tool') toolCount++;
        else if (t === 'material') materialCount++;
        else if (t === 'subcontractor') subCount++;
      });

      linkedFromResources.forEach((r) => {
        if (!resourceNames.has(r.name.toLowerCase())) {
          resourceNames.add(r.name.toLowerCase());
          const alloc = (r.connectedAllocations || []).find(
            (a) => a.projectId === p.id || a.projectCode === p.code
          );
          if (alloc) {
            totalSpend += Number(alloc.totalCost || 0);
          }
          const t = (r.type || '').toLowerCase();
          if (t === 'labour') labourCount++;
          else if (t === 'machinery') machineryCount++;
          else if (t === 'equipment') equipmentCount++;
          else if (t === 'tool') toolCount++;
          else if (t === 'material') materialCount++;
          else if (t === 'subcontractor') subCount++;
        }
      });

      const totalItemsCount = Math.max(selected.length, resourceNames.size);
      const plansCount = (p.budgetaryPlans || []).length;

      return {
        project: p,
        totalItemsCount,
        labourCount,
        machineryCount,
        equipmentCount,
        toolCount,
        materialCount,
        subCount,
        totalSpend,
        plansCount
      };
    });
  }, [projects, resources]);

  // Overall aggregate metrics
  const totalAllocatedSpend = useMemo(() => {
    return projectResourceStats.reduce((acc, curr) => acc + curr.totalSpend, 0);
  }, [projectResourceStats]);

  const totalUniqueResources = useMemo(() => {
    return resources.length;
  }, [resources]);

  // Filtering
  const filteredProjectStats = useMemo(() => {
    return projectResourceStats.filter(({ project, totalItemsCount }) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        project.code.toLowerCase().includes(q) ||
        project.name.toLowerCase().includes(q) ||
        (project.clientName || '').toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (statusFilter === 'active') {
        return project.status?.toLowerCase() === 'active';
      }
      if (statusFilter === 'with_resources') {
        return totalItemsCount > 0;
      }
      return true;
    });
  }, [projectResourceStats, search, statusFilter]);

  return (
    <div className="space-y-4 font-sans animate-in fade-in pb-12">
      {/* 1. TOP HEADER & METRICS BAR */}
      <div className="bg-white dark:bg-[#0b101b] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-[#0078d4]/10 text-[#0078d4] dark:bg-sky-950/60 dark:text-sky-400">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Resources
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                PostgreSQL
              </span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-sky-300 border border-blue-200 dark:border-blue-800">
                {activeCurrency}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1 rounded-md font-medium cursor-pointer flex items-center space-x-1 ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-[#0f172a] text-[#0078d4] dark:text-sky-300 shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3 h-3" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded-md font-medium cursor-pointer flex items-center space-x-1 ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-[#0f172a] text-[#0078d4] dark:text-sky-300 shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3 h-3" />
              <span>Table</span>
            </button>
          </div>

          {onViewAllResources && (
            <button
              type="button"
              onClick={onViewAllResources}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              Catalog
            </button>
          )}

          {onOpenCreateResource && (
            <button
              type="button"
              onClick={onOpenCreateResource}
              className="px-3.5 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#0b101b] p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Projects
          </span>
          <span className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
            {projects.length}
          </span>
        </div>

        <div className="bg-white dark:bg-[#0b101b] p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Resources
          </span>
          <span className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
            {totalUniqueResources}
          </span>
        </div>

        <div className="bg-white dark:bg-[#0b101b] p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Spend
          </span>
          <span className="text-xl font-bold font-mono text-[#0078d4] dark:text-sky-400 mt-0.5 block truncate">
            {formatCurrency(totalAllocatedSpend, activeCurrency)}
          </span>
        </div>

        <div className="bg-white dark:bg-[#0b101b] p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Linked
          </span>
          <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
            {projectResourceStats.filter((s) => s.totalItemsCount > 0).length}
          </span>
        </div>
      </div>

      {/* 3. SEARCH & FILTERS BAR */}
      <div className="bg-white dark:bg-[#0b101b] p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#0078d4]"
          />
        </div>

        <div className="flex items-center space-x-1.5 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[#0078d4] text-white shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            All ({projects.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
              statusFilter === 'active'
                ? 'bg-[#0078d4] text-white shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Active ({projects.filter((p) => p.status?.toLowerCase() === 'active').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('with_resources')}
            className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
              statusFilter === 'with_resources'
                ? 'bg-[#0078d4] text-white shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Linked ({projectResourceStats.filter((s) => s.totalItemsCount > 0).length})
          </button>
        </div>
      </div>

      {/* 4. MAIN ALL PROJECTS CARDS CONTAINER */}
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredProjectStats.map(({ project, totalItemsCount, totalSpend, plansCount, labourCount, machineryCount, equipmentCount, toolCount, subCount }) => (
            <div
              key={project.id}
              onClick={() => onSelectProject(project)}
              className="group bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs hover:shadow-md hover:border-[#0078d4] transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                {/* Header: Project Code & Status */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-xs font-bold text-[#0078d4] dark:text-sky-400 uppercase tracking-wider">
                    {project.code}
                  </span>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {project.status || 'Active'}
                    </span>
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      {project.currency || activeCurrency}
                    </span>
                  </div>
                </div>

                {/* Project Name & Client */}
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#0078d4] transition-colors truncate">
                  {project.name}
                </h3>
                <div className="flex items-center space-x-1.5 text-xs text-slate-500 mt-1">
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{project.clientName || 'Commercial Client'}</span>
                </div>

                {/* Resource Category Badges Breakdown */}
                <div className="flex items-center flex-wrap gap-1 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
                  {labourCount > 0 && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-sky-300 border border-blue-200 dark:border-blue-800 font-semibold">
                      <Users className="w-3 h-3" />
                      <span>{labourCount}</span>
                    </span>
                  )}
                  {machineryCount > 0 && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-semibold">
                      <Cog className="w-3 h-3" />
                      <span>{machineryCount}</span>
                    </span>
                  )}
                  {equipmentCount > 0 && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-semibold">
                      <Cpu className="w-3 h-3" />
                      <span>{equipmentCount}</span>
                    </span>
                  )}
                  {toolCount > 0 && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-semibold">
                      <Wrench className="w-3 h-3" />
                      <span>{toolCount}</span>
                    </span>
                  )}
                  {subCount > 0 && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-semibold">
                      <Truck className="w-3 h-3" />
                      <span>{subCount}</span>
                    </span>
                  )}
                  {totalItemsCount === 0 && (
                    <span className="text-[11px] text-slate-400 italic">No resources allocated</span>
                  )}
                </div>
              </div>

              {/* Bottom Metrics & Action */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Spend
                  </span>
                  <span className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">
                    {formatCurrency(totalSpend, project.currency || activeCurrency)}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Plans
                    </span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {plansCount}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectProject(project);
                    }}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-[#0078d4] text-slate-600 dark:text-slate-300 group-hover:text-white transition-all cursor-pointer"
                    title="Open"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredProjectStats.length === 0 && (
            <div className="col-span-full py-12 text-center bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800">
              <FolderGit2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No projects found</p>
            </div>
          )}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase">
                <th className="px-4 py-2.5">Code</th>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Client</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-center">Resources</th>
                <th className="px-4 py-2.5 text-center">Plans</th>
                <th className="px-4 py-2.5 text-right">Spend</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProjectStats.map(({ project, totalItemsCount, totalSpend, plansCount }) => (
                <tr
                  key={project.id}
                  onClick={() => onSelectProject(project)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 font-mono font-bold text-[#0078d4] dark:text-sky-400">
                    {project.code}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                    {project.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {project.clientName || 'Commercial Client'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {project.status || 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-bold">
                    {totalItemsCount}
                  </td>
                  <td className="px-4 py-3 text-center font-bold">
                    {plansCount}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                    {formatCurrency(totalSpend, project.currency || activeCurrency)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProject(project);
                      }}
                      className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-[#0078d4] hover:text-white text-slate-700 dark:text-slate-300 font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
