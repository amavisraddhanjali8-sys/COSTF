import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  HardHat,
  Cpu,
  Truck,
  Wrench,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  FolderGit2,
  Calendar,
  Layers,
  ArrowRight,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { Project, BudgetaryPlan, EnterpriseResource, EnterpriseResourceType } from '../../types';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/currency';

interface ProjectResourcesTabProps {
  project: Project;
  activePlan: BudgetaryPlan | null;
  onPlanUpdated: () => void;
  onUpdateProject?: (updatedProject: Project) => void;
}

export const ProjectResourcesTab: React.FC<ProjectResourcesTabProps> = ({
  project,
  activePlan,
  onPlanUpdated,
  onUpdateProject
}) => {
  const [enterpriseResources, setEnterpriseResources] = useState<EnterpriseResource[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  // Assign Resource Modal state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState<string>('');
  const [assignPhaseId, setAssignPhaseId] = useState<string>('');
  const [assignHours, setAssignHours] = useState<number>(40);
  const [assignRate, setAssignRate] = useState<number>(0);
  const [assignUnit, setAssignUnit] = useState<string>('hr');
  const [assignNotes, setAssignNotes] = useState<string>('');
  const [submittingAssign, setSubmittingAssign] = useState(false);

  // Edit Allocated Resource Modal state
  const [editingPlanResource, setEditingPlanResource] = useState<any | null>(null);
  const [editHours, setEditHours] = useState<number>(0);
  const [editRate, setEditRate] = useState<number>(0);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [deletingResourceTarget, setDeletingResourceTarget] = useState<{ id: string; name: string } | null>(null);
  const [submittingRemove, setSubmittingRemove] = useState(false);

  const activeCurrency = project.currency || 'LKR';

  // Fetch available enterprise resources from PostgreSQL
  const fetchDbResources = async () => {
    try {
      setLoadingResources(true);
      const res = await api.getResources();
      setEnterpriseResources(Array.isArray(res) ? res : []);
    } catch (e) {
      console.warn('Could not load enterprise resources from DB:', e);
    } finally {
      setLoadingResources(false);
    }
  };

  useEffect(() => {
    void fetchDbResources();
  }, []);

  // When opening assign modal, default phase and rate
  useEffect(() => {
    if (project.phases && project.phases.length > 0 && !assignPhaseId) {
      setAssignPhaseId(project.phases[0].id);
    }
  }, [project.phases, assignPhaseId]);

  useEffect(() => {
    if (selectedResourceId) {
      const found = enterpriseResources.find(r => r.id === selectedResourceId);
      if (found) {
        setAssignRate(found.baseRate || 0);
        setAssignUnit(found.unit || 'hr');
      }
    }
  }, [selectedResourceId, enterpriseResources]);

  // Assigned resources come from the active plan's resources array or project selected items of resource types
  const assignedResources = useMemo(() => {
    if (!activePlan) return [];
    const planRes = (activePlan.resources || []).map((r: any) => ({
      id: r.id,
      resourceId: r.resourceId,
      name: r.name,
      type: r.resourceType || 'labour',
      roleOrTrade: r.roleOrTrade || '',
      allocatedHours: Number(r.allocatedHours || 0),
      hourlyRate: Number(r.hourlyRate || 0),
      totalCost: Number(r.totalCost || 0),
      unit: r.unit || 'hr',
      sectionId: r.sectionId,
      notes: r.notes || '',
      startDate: r.startDate,
      endDate: r.endDate
    }));

    return planRes;
  }, [activePlan]);

  // Filtered assigned resources
  const filteredAssigned = useMemo(() => {
    return assignedResources.filter(item => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          item.name.toLowerCase().includes(q) ||
          item.roleOrTrade.toLowerCase().includes(q) ||
          item.type.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [assignedResources, typeFilter, search]);

  // Aggregate metrics
  const totalCost = useMemo(() => {
    return assignedResources.reduce((sum, r) => sum + (r.totalCost || 0), 0);
  }, [assignedResources]);

  const totalHours = useMemo(() => {
    return assignedResources.reduce((sum, r) => sum + (r.allocatedHours || 0), 0);
  }, [assignedResources]);

  const countByType = useMemo(() => {
    const counts: Record<string, number> = { labour: 0, machinery: 0, equipment: 0, tool: 0 };
    assignedResources.forEach(r => {
      const t = r.type?.toLowerCase();
      if (counts[t] !== undefined) counts[t]++;
      else counts.labour = (counts.labour || 0) + 1;
    });
    return counts;
  }, [assignedResources]);

  // Handle assigning resource
  const handleExecuteAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResourceId || !activePlan) {
      alert('Please select an active resource and budget plan.');
      return;
    }
    setSubmittingAssign(true);
    try {
      const found = enterpriseResources.find(r => r.id === selectedResourceId);
      if (!found) throw new Error('Resource not found in database');

      await api.allocateResourceToProject(
        found.id,
        project.id,
        assignPhaseId || project.phases?.[0]?.id || 'phase-01',
        Number(assignHours),
        assignUnit || found.unit,
        Number(assignRate),
        activePlan.id
      );

      setIsAssignModalOpen(false);
      setSelectedResourceId('');
      setAssignHours(40);
      setAssignNotes('');
      onPlanUpdated();
    } catch (err: any) {
      alert(`Failed to allocate resource: ${err?.message || 'Database error'}`);
    } finally {
      setSubmittingAssign(false);
    }
  };

  // Handle removing assigned resource
  const handleConfirmRemoveResource = async () => {
    if (!activePlan || !deletingResourceTarget) return;
    setSubmittingRemove(true);
    try {
      await api.deletePlanResource(activePlan.id, deletingResourceTarget.id);
      setDeletingResourceTarget(null);
      onPlanUpdated();
    } catch (err: any) {
      console.error('Could not remove resource:', err);
    } finally {
      setSubmittingRemove(false);
    }
  };

  // Handle editing hours/rate
  const handleOpenEdit = (resItem: any) => {
    setEditingPlanResource(resItem);
    setEditHours(resItem.allocatedHours || 0);
    setEditRate(resItem.hourlyRate || 0);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlanResource || !activePlan) return;
    setSubmittingEdit(true);
    try {
      const newTotalCost = Number(editHours) * Number(editRate);
      await api.updatePlanResource(activePlan.id, editingPlanResource.id, {
        allocatedHours: Number(editHours),
        hourlyRate: Number(editRate),
        totalCost: newTotalCost
      });
      setEditingPlanResource(null);
      onPlanUpdated();
    } catch (err: any) {
      alert(`Failed to update resource: ${err?.message || 'Database error'}`);
    } finally {
      setSubmittingEdit(false);
    }
  };

  const getResourceTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'labour':
        return <HardHat className="w-3.5 h-3.5 text-indigo-500" />;
      case 'machinery':
        return <Cpu className="w-3.5 h-3.5 text-sky-500" />;
      case 'equipment':
        return <Truck className="w-3.5 h-3.5 text-amber-500" />;
      case 'tool':
        return <Wrench className="w-3.5 h-3.5 text-emerald-500" />;
      default:
        return <Users className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. RESOURCE KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#0b101b] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Spend</span>
            <Users className="w-4 h-4 text-[#0078d4]" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
            {formatCurrency(totalCost, activeCurrency)}
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">Live allocation total</span>
        </div>

        <div className="bg-white dark:bg-[#0b101b] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Allocated Units</span>
            <Calendar className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
            {totalHours.toLocaleString()} <span className="text-xs font-normal text-slate-500">hrs/units</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">Total project workload</span>
        </div>

        <div className="bg-white dark:bg-[#0b101b] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Resources</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
            {assignedResources.length}
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">
            {countByType.labour} labour • {countByType.machinery} mach • {countByType.equipment} eqp • {countByType.tool} tools
          </span>
        </div>

        <div className="bg-white dark:bg-[#0b101b] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Plan</span>
            <Layers className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate mt-1">
            {activePlan ? `${activePlan.planNumber || ''} - ${activePlan.name}` : 'No active plan'}
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold mt-1">PostgreSQL Synced</span>
        </div>
      </div>

      {/* 2. TOOLBAR: Search, Type Filters & Assign Button */}
      <div className="bg-white dark:bg-[#0b101b] p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Type Filter Pills */}
          <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            {['all', 'labour', 'machinery', 'equipment', 'tool'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(type)}
                className={`px-2.5 py-1 text-xs font-semibold capitalize rounded-md transition-all cursor-pointer ${
                  typeFilter === type
                    ? 'bg-[#0078d4] text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assigned resources..."
              className="pl-8 pr-3 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-[#0078d4]"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={fetchDbResources}
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Refresh resources from PostgreSQL"
          >
            <RefreshCw className={`w-4 h-4 ${loadingResources ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsAssignModalOpen(true)}
            disabled={!activePlan}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Assign Resource</span>
          </button>
        </div>
      </div>

      {/* 3. ASSIGNED RESOURCES TABLE */}
      <div className="bg-white dark:bg-[#0b101b] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Resource Name</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Role / Trade</th>
                <th className="py-2.5 px-3">Phase / Section</th>
                <th className="py-2.5 px-3 text-right">Allocated Qty</th>
                <th className="py-2.5 px-3 text-right">Unit Rate</th>
                <th className="py-2.5 px-3 text-right">Total Cost</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
              {filteredAssigned.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">No resources currently assigned to this project plan</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Click "+ Assign Resource" above to allocate labour, machinery, equipment, or tooling from PostgreSQL.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredAssigned.map((item) => {
                  const phaseObj = project.phases?.find((p) => p.id === item.sectionId);
                  const phaseName = phaseObj?.name || 'General';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                          {getResourceTypeIcon(item.type)}
                          <span>{item.name}</span>
                        </div>
                        {item.notes && (
                          <span className="text-[10px] text-slate-400 block mt-0.5 italic">{item.notes}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${
                          item.type === 'labour'
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200'
                            : item.type === 'machinery'
                            ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200'
                            : item.type === 'equipment'
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200'
                            : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200'
                        }`}>
                          {item.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        {item.roleOrTrade || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-medium">
                          {phaseName}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-800 dark:text-slate-200">
                        {item.allocatedHours} {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                        {formatCurrency(item.hourlyRate, activeCurrency)} / {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(item.totalCost, activeCurrency)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                            title="Edit allocated hours & rate"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingResourceTarget({ id: item.id, name: item.name })}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                            title="Unassign resource from project"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. MODAL: ASSIGN RESOURCE TO PROJECT */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#0b101b] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-lg w-full p-5 overflow-hidden animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-[#0078d4]" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Assign Resource to Project</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteAssign} className="mt-4 space-y-3.5">
              {/* Select Enterprise Resource */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Enterprise Resource (from PostgreSQL)
                </label>
                {enterpriseResources.length === 0 ? (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>No resources registered in the Enterprise Database. Please create a resource in the Resources Portal first.</span>
                  </div>
                ) : (
                  <select
                    value={selectedResourceId}
                    onChange={(e) => setSelectedResourceId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-[#0078d4]"
                  >
                    <option value="">-- Choose Resource --</option>
                    {enterpriseResources.map((res) => (
                      <option key={res.id} value={res.id}>
                        [{res.type.toUpperCase()}] {res.name} — {formatCurrency(res.baseRate, res.currency || activeCurrency)} / {res.unit}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Target Project Phase */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Project Phase / Section
                </label>
                <select
                  value={assignPhaseId}
                  onChange={(e) => setAssignPhaseId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-[#0078d4]"
                >
                  {(project.phases || []).map((ph) => (
                    <option key={ph.id} value={ph.id}>
                      {ph.name}
                    </option>
                  ))}
                  {(!project.phases || project.phases.length === 0) && (
                    <option value="phase-01">Phase 1: General</option>
                  )}
                </select>
              </div>

              {/* Workload Hours / Quantity & Unit Rate */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Allocated Quantity ({assignUnit})
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.5"
                    value={assignHours}
                    onChange={(e) => setAssignHours(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-hidden focus:border-[#0078d4]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Unit Rate ({activeCurrency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={assignRate}
                    onChange={(e) => setAssignRate(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-hidden focus:border-[#0078d4]"
                  />
                </div>
              </div>

              {/* Total Calculation Preview */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-800 text-xs flex items-center justify-between">
                <span className="font-semibold text-slate-600 dark:text-slate-400">Total Planned Spend:</span>
                <span className="font-mono text-sm font-bold text-[#0078d4] dark:text-sky-300">
                  {formatCurrency(Number(assignHours) * Number(assignRate), activeCurrency)}
                </span>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assignment Notes (Optional)
                </label>
                <input
                  type="text"
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="e.g., Primary site supervisor for Phase 1 erection"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-[#0078d4]"
                />
              </div>

              {/* Submit / Cancel */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAssign || !selectedResourceId}
                  className="px-4 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-2xs"
                >
                  {submittingAssign ? 'Allocating...' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: EDIT RESOURCE ALLOCATION */}
      {editingPlanResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#0b101b] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-sm w-full p-5 overflow-hidden animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <Edit2 className="w-4 h-4 text-[#0078d4]" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Edit Allocation</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPlanResource(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-3.5">
              <div>
                <p className="text-xs text-slate-500">Resource:</p>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{editingPlanResource.name}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Allocated Hours / Quantity ({editingPlanResource.unit || 'hr'})
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.5"
                  value={editHours}
                  onChange={(e) => setEditHours(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-hidden focus:border-[#0078d4]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Hourly Rate ({activeCurrency})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editRate}
                  onChange={(e) => setEditRate(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-hidden focus:border-[#0078d4]"
                />
              </div>

              <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs flex items-center justify-between font-mono">
                <span className="text-slate-500">New Total:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(Number(editHours) * Number(editRate), activeCurrency)}
                </span>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingPlanResource(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-4 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-2xs"
                >
                  {submittingEdit ? 'Saving...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Remove Resource Modal */}
      {deletingResourceTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/80 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Unassign Resource</h3>
                <p className="text-[11px] text-slate-500 font-mono">Project Plan Allocation</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to unassign resource <strong className="text-slate-900 dark:text-slate-100">"{deletingResourceTarget.name}"</strong> from this plan?
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingResourceTarget(null)}
                disabled={submittingRemove}
                className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveResource}
                disabled={submittingRemove}
                className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
              >
                {submittingRemove ? 'Removing...' : 'Remove Resource'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
