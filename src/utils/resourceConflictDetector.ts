/**
 * Resource Conflict Detection Engine
 * Scans all project phase resource allocations across projects and detects
 * overlapping schedules for the same team member or subcontractor.
 */

import { Project, ProjectPhase, PhaseResourceAssignment, ResourceScheduleConflict } from '../types';

/**
 * Checks if two date ranges [startA, endA] and [startB, endB] overlap.
 */
export function areDatesOverlapping(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  if (!startA || !endA || !startB || !endB) return false;
  const sA = new Date(startA).getTime();
  const eA = new Date(endA).getTime();
  const sB = new Date(startB).getTime();
  const eB = new Date(endB).getTime();

  return sA <= eB && eA >= sB;
}

/**
 * Calculates overlap details between two date ranges
 */
export function calculateOverlapDetails(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): { overlapStart: string; overlapEnd: string; overlapDays: number } {
  const sA = new Date(startA).getTime();
  const eA = new Date(endA).getTime();
  const sB = new Date(startB).getTime();
  const eB = new Date(endB).getTime();

  const oStartMs = Math.max(sA, sB);
  const oEndMs = Math.min(eA, eB);

  const overlapDays = Math.max(1, Math.round((oEndMs - oStartMs) / (1000 * 60 * 60 * 24)) + 1);

  return {
    overlapStart: new Date(oStartMs).toISOString().split('T')[0],
    overlapEnd: new Date(oEndMs).toISOString().split('T')[0],
    overlapDays
  };
}

export interface FlattenedAssignment {
  assignment: PhaseResourceAssignment;
  projectId: string;
  projectCode: string;
  projectName: string;
  phaseId: string;
  phaseName: string;
  startDate: string;
  endDate: string;
}

/**
 * Extracts and flattens all resource assignments across all provided projects.
 */
export function getAllFlattenedAssignments(projects: Project[]): FlattenedAssignment[] {
  const result: FlattenedAssignment[] = [];

  projects.forEach((proj) => {
    (proj.phases || []).forEach((phase) => {
      (phase.assignedResources || []).forEach((res) => {
        const effStart = res.startDate || phase.startDate || proj.startDate;
        const effEnd = res.endDate || phase.endDate || proj.deliveryDeadline;
        result.push({
          assignment: res,
          projectId: proj.id,
          projectCode: proj.code,
          projectName: proj.name,
          phaseId: phase.id,
          phaseName: phase.name,
          startDate: effStart,
          endDate: effEnd
        });
      });
    });
  });

  return result;
}

/**
 * Scans all existing projects and finds all schedule conflicts (overlapping assignments for same resource).
 */
export function detectAllResourceConflicts(projects: Project[]): ResourceScheduleConflict[] {
  const allAssignments = getAllFlattenedAssignments(projects);
  const conflicts: ResourceScheduleConflict[] = [];

  for (let i = 0; i < allAssignments.length; i++) {
    for (let j = i + 1; j < allAssignments.length; j++) {
      const a = allAssignments[i];
      const b = allAssignments[j];

      // Same resource assigned to two different phases
      if (a.assignment.resourceId === b.assignment.resourceId && a.phaseId !== b.phaseId) {
        if (areDatesOverlapping(a.startDate, a.endDate, b.startDate, b.endDate)) {
          const { overlapStart, overlapEnd, overlapDays } = calculateOverlapDetails(
            a.startDate,
            a.endDate,
            b.startDate,
            b.endDate
          );

          conflicts.push({
            resourceId: a.assignment.resourceId,
            resourceName: a.assignment.name,
            resourceType: a.assignment.resourceType,
            phaseA: {
              projectId: a.projectId,
              projectCode: a.projectCode,
              projectName: a.projectName,
              phaseId: a.phaseId,
              phaseName: a.phaseName,
              startDate: a.startDate,
              endDate: a.endDate
            },
            phaseB: {
              projectId: b.projectId,
              projectCode: b.projectCode,
              projectName: b.projectName,
              phaseId: b.phaseId,
              phaseName: b.phaseName,
              startDate: b.startDate,
              endDate: b.endDate
            },
            overlapDays,
            overlapStart,
            overlapEnd
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Checks if a candidate assignment would conflict with any existing assignment in the projects portfolio.
 */
export function checkCandidateAssignmentConflict(
  resourceId: string,
  candidateStart: string,
  candidateEnd: string,
  targetPhaseId: string,
  targetProjectId: string,
  targetPhaseName: string,
  targetProjectCode: string,
  targetProjectName: string,
  resourceName: string,
  resourceType: 'team_member' | 'subcontractor',
  projects: Project[]
): ResourceScheduleConflict[] {
  const allAssignments = getAllFlattenedAssignments(projects);
  const conflicts: ResourceScheduleConflict[] = [];

  allAssignments.forEach((existing) => {
    // Check if same resource and not the exact same phase
    if (existing.assignment.resourceId === resourceId && existing.phaseId !== targetPhaseId) {
      if (areDatesOverlapping(candidateStart, candidateEnd, existing.startDate, existing.endDate)) {
        const { overlapStart, overlapEnd, overlapDays } = calculateOverlapDetails(
          candidateStart,
          candidateEnd,
          existing.startDate,
          existing.endDate
        );

        conflicts.push({
          resourceId,
          resourceName,
          resourceType,
          phaseA: {
            projectId: targetProjectId,
            projectCode: targetProjectCode,
            projectName: targetProjectName,
            phaseId: targetPhaseId,
            phaseName: targetPhaseName,
            startDate: candidateStart,
            endDate: candidateEnd
          },
          phaseB: {
            projectId: existing.projectId,
            projectCode: existing.projectCode,
            projectName: existing.projectName,
            phaseId: existing.phaseId,
            phaseName: existing.phaseName,
            startDate: existing.startDate,
            endDate: existing.endDate
          },
          overlapDays,
          overlapStart,
          overlapEnd
        });
      }
    }
  });

  return conflicts;
}
