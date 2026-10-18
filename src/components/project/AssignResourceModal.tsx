import React, { useState, useMemo } from 'react';
import {
  X,
  User,
  Wrench,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  ShieldCheck,
  ChevronRight,
  Info
} from 'lucide-react';
import {
  Project,
  ProjectPhase,
  AppUser,
  SubcontractorRateItem,
  PhaseResourceAssignment,
  ResourceScheduleConflict
} from '../../types';
import { checkCandidateAssignmentConflict } from '../../utils/resourceConflictDetector';

interface AssignResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  phase: ProjectPhase;
  allProjects?: Project[];
  users?: AppUser[];
  subcontractors?: SubcontractorRateItem[];
  onAssignResource: (phaseId: string, assignment: PhaseResourceAssignment) => void;
}

export const AssignResourceModal: React.FC<AssignResourceModalProps> = ({
  isOpen,
  onClose,
  project,
  phase,
  allProjects = [],
  users = [],
  subcontractors = [],
  onAssignResource
}) => {
  if (!isOpen) return null;

  const [resourceType, setResourceType] = useState<'team_member' | 'subcontractor'>('team_member');
  const [selectedResourceId, setSelectedResourceId] = useState<string>('');
  const [allocatedHours, setAllocatedHours] = useState<number>(40);
  const [customRole, setCustomRole] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(phase.startDate || project.startDate || '2026-10-15');
  const [endDate, setEndDate] = useState<string>(phase.endDate || project.deliveryDeadline || '2026-11-20');
  const [conflictAcknowledged, setConflictAcknowledged] = useState(false);
  const [conflictNotes, setConflictNotes] = useState('');

  // Currently selected resource object
  const selectedUser = useMemo(() => {
    return users.find((u) => u.id === selectedResourceId || u.employeeId === selectedResourceId);
  }, [users, selectedResourceId]);

  const selectedSub = useMemo(() => {
    return subcontractors.find((s) => s.id === selectedResourceId);
  }, [subcontractors, selectedResourceId]);

  const resourceName = selectedUser?.name || selectedSub?.name || selectedSub?.subcontractorName || '';
  const defaultRole = selectedUser?.role?.replace(/_/g, ' ') || selectedSub?.serviceType || selectedSub?.category || '';

  // Real-time conflict detection check against all existing assignments across projects
  const detectedConflicts: ResourceScheduleConflict[] = useMemo(() => {
    if (!selectedResourceId) return [];

    return checkCandidateAssignmentConflict(
      selectedResourceId,
      startDate,
      endDate,
      phase.id,
      project.id,
      phase.name,
      project.code,
      project.name,
      resourceName,
      resourceType,
      allProjects.length > 0 ? allProjects : [project]
    );
  }, [selectedResourceId, startDate, endDate, phase, project, allProjects, resourceName, resourceType]);

  const hasConflict = detectedConflicts.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResourceId || !resourceName) return;

    if (hasConflict && !conflictAcknowledged) {
      return;
    }

    const newAssignment: PhaseResourceAssignment = {
      id: `assign-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      resourceId: selectedResourceId,
      resourceType,
      name: resourceName,
      roleOrTrade: customRole.trim() || defaultRole || 'Specialist',
      email: selectedUser?.email,
      allocatedHours: Number(allocatedHours) || 40,
      startDate,
      endDate,
      assignedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      conflictNotes: hasConflict ? (conflictNotes.trim() || 'Schedule overlap acknowledged by manager.') : undefined
    };

    onAssignResource(phase.id, newAssignment);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-[#0078d4] dark:text-sky-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-[#0078d4] dark:bg-blue-900/60 dark:text-sky-300">
                  Resource Scheduling
                </span>
                <span className="text-xs text-slate-500 font-mono">{project.code}</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                Assign Resource to {phase.name}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          
          {/* Resource Type Selector: Team Member vs Subcontractor */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
              Select Resource Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setResourceType('team_member');
                  setSelectedResourceId('');
                }}
                className={`p-2.5 rounded-xl border text-left flex items-center space-x-2.5 transition-all cursor-pointer ${
                  resourceType === 'team_member'
                    ? 'border-[#0078d4] bg-blue-50/70 text-[#0078d4] dark:bg-blue-950/50 dark:text-sky-300 font-bold ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                <User className="w-4 h-4 shrink-0" />
                <div>
                  <span className="block font-bold">Team Member</span>
                  <span className="block text-[10px] text-slate-400 font-normal">Internal Engineering / PM</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setResourceType('subcontractor');
                  setSelectedResourceId('');
                }}
                className={`p-2.5 rounded-xl border text-left flex items-center space-x-2.5 transition-all cursor-pointer ${
                  resourceType === 'subcontractor'
                    ? 'border-[#0078d4] bg-blue-50/70 text-[#0078d4] dark:bg-blue-950/50 dark:text-sky-300 font-bold ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                <Wrench className="w-4 h-4 shrink-0" />
                <div>
                  <span className="block font-bold">Subcontractor Trade</span>
                  <span className="block text-[10px] text-slate-400 font-normal">Machining / Specialized Partner</span>
                </div>
              </button>
            </div>
          </div>

          {/* Resource Dropdown */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
              {resourceType === 'team_member' ? 'Select Team Member *' : 'Select Subcontractor / Trade Provider *'}
            </label>
            <select
              value={selectedResourceId}
              onChange={(e) => {
                setSelectedResourceId(e.target.value);
                setConflictAcknowledged(false);
              }}
              required
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#0078d4] focus:outline-none"
            >
              <option value="" disabled>-- Choose a resource --</option>
              {resourceType === 'team_member' ? (
                users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.role.replace(/_/g, ' ')} ({u.department || 'Operations'})
                  </option>
                ))
              ) : (
                subcontractors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.subcontractorName} — {s.serviceType || s.category} (${s.baseRate || s.rate || 0}/hr)
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Role / Assignment Details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                Role / Function on Phase
              </label>
              <input
                type="text"
                placeholder={defaultRole || 'Lead Engineer'}
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                Allocated Hours (Capacity)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={allocatedHours}
                  onChange={(e) => setAllocatedHours(Math.max(1, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono font-bold"
                />
                <span className="absolute right-3 top-2 text-slate-400 font-sans">hrs</span>
              </div>
            </div>
          </div>

          {/* Schedule Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                Assignment Start Date
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setConflictAcknowledged(false);
                }}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                Assignment End Date
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setConflictAcknowledged(false);
                }}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          {/* ===================================================================
              REAL-TIME CONFLICT DETECTION CHECK & OVERLAP WARNING CALLOUT
             =================================================================== */}
          {hasConflict ? (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 space-y-2.5 animate-in fade-in">
              <div className="flex items-start space-x-2.5">
                <div className="p-1.5 rounded-lg bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200 shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-950 dark:text-amber-200">
                    Schedule Conflict Detected! ({detectedConflicts.length} overlap{detectedConflicts.length > 1 ? 's' : ''})
                  </h4>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                    <strong>{resourceName}</strong> is already allocated to another project phase during these dates:
                  </p>
                </div>
              </div>

              {/* Overlapping phase details */}
              <div className="space-y-1.5 pl-7">
                {detectedConflicts.map((c, idx) => (
                  <div
                    key={`conf-${idx}`}
                    className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-amber-200 dark:border-amber-900 text-[11px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white">
                        [{c.phaseB.projectCode}] {c.phaseB.phaseName}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-200 font-mono font-bold text-[10px]">
                        {c.overlapDays} days overlap
                      </span>
                    </div>
                    <div className="text-slate-500 font-mono text-[10px] mt-0.5">
                      Overlap Period: {c.overlapStart} &rarr; {c.overlapEnd}
                    </div>
                  </div>
                ))}
              </div>

              {/* Conflict Override Option */}
              <div className="pt-2 border-t border-amber-200 dark:border-amber-900/60 space-y-2">
                <label className="flex items-start space-x-2 text-[11px] text-amber-950 dark:text-amber-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={conflictAcknowledged}
                    onChange={(e) => setConflictAcknowledged(e.target.checked)}
                    className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                  />
                  <span>
                    Acknowledge double-booking and schedule anyway (e.g. split capacity or partial hours).
                  </span>
                </label>

                {conflictAcknowledged && (
                  <input
                    type="text"
                    placeholder="Optional manager note (e.g. 50% split shift with PRJ-002)"
                    value={conflictNotes}
                    onChange={(e) => setConflictNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg text-xs"
                  />
                )}
              </div>
            </div>
          ) : selectedResourceId ? (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center space-x-2 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-[11px] font-semibold">
                Schedule Clear: No conflicting assignments detected for {resourceName} in this period.
              </span>
            </div>
          ) : null}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedResourceId || (hasConflict && !conflictAcknowledged)}
              className="px-5 py-2 bg-[#0078d4] hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm &amp; Assign Resource</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
