import { Project, InventoryItem } from '../types';
import { bizStore } from '../services/bizStore';
import { round1, round2, decAdd, decSub, decMul, decDiv, calcDiscountedLine } from './decimalMath';

export const MARGIN_THRESHOLD_KEY = 'fxtt_margin_warning_threshold';
export const DISMISSED_ALERTS_KEY = 'fxtt_dismissed_system_alerts_v1';
export const DEFAULT_MARGIN_THRESHOLD = 15; // 15% default target margin threshold

export function getMarginThreshold(): number {
  try {
    const saved = bizStore.getItem(MARGIN_THRESHOLD_KEY);
    if (saved !== null) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_MARGIN_THRESHOLD;
}

export function setMarginThreshold(threshold: number): void {
  try {
    const clamped = Math.max(0, Math.min(100, threshold));
    bizStore.setItem(MARGIN_THRESHOLD_KEY, String(clamped));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('margin-threshold-changed', { detail: { threshold: clamped } }));
    }
  } catch {
    // ignore storage errors
  }
}

export interface ProjectProfitabilityAnalysis {
  projectId: string;
  projectCode: string;
  projectName: string;
  quotedPrice: number;
  totalDirectCost: number;
  overheadCost: number;
  contingencyCost: number;
  totalEstimatedCost: number;
  netProfit: number;
  netMarginPct: number;
  grossMarginPct: number;
  targetMarginPct: number;
  thresholdPct: number;
  isMarginBelowThreshold: boolean;
  isMarginBelowTarget: boolean;
  marginShortfallPct: number;
}

export function calculateProjectProfitability(
  project: Project,
  customThresholdPct?: number
): ProjectProfitabilityAnalysis {
  const thresholdPct = customThresholdPct !== undefined ? customThresholdPct : getMarginThreshold();
  const quotedPrice = round2(project.quotedPrice || 0);
  const targetMarginPct = round2(project.targetMarginPct || 25);

  const items = project.selectedItems || [];
  let directCost = 0;

  if (items.length > 0) {
    for (const item of items) {
      const { totalAmount } = calcDiscountedLine(
        item.quantity ?? 1,
        item.unitCost ?? 0,
        item.discountPct ?? 0
      );
      directCost = decAdd(directCost, totalAmount);
    }
  } else if (project.analytics?.totalDirectCost !== undefined) {
    directCost = round2(project.analytics.totalDirectCost);
  }

  const overheadPct = round2(project.overheadPct ?? 8.5);
  const contingencyPct = round2(project.contingencyPct ?? 5.0);

  const overheadCost = round2(decMul(directCost, decDiv(overheadPct, 100)));
  const contingencyCost = round2(decMul(directCost, decDiv(contingencyPct, 100)));
  const totalEstimatedCost = decAdd(decAdd(directCost, overheadCost), contingencyCost);

  const grossProfit = decSub(quotedPrice, directCost);
  const grossMarginPct = quotedPrice > 0 ? round2(decMul(decDiv(grossProfit, quotedPrice), 100)) : 0;

  const netProfit = decSub(quotedPrice, totalEstimatedCost);
  const netMarginPct = quotedPrice > 0 ? round2(decMul(decDiv(netProfit, quotedPrice), 100)) : 0;

  const isMarginBelowThreshold = netMarginPct < thresholdPct;
  const isMarginBelowTarget = netMarginPct < targetMarginPct;
  const marginShortfallPct = Math.max(0, round2(decSub(thresholdPct, netMarginPct)));

  return {
    projectId: project.id,
    projectCode: project.code,
    projectName: project.name,
    quotedPrice,
    totalDirectCost: round2(directCost),
    overheadCost,
    contingencyCost,
    totalEstimatedCost: round2(totalEstimatedCost),
    netProfit: round2(netProfit),
    netMarginPct,
    grossMarginPct,
    targetMarginPct,
    thresholdPct,
    isMarginBelowThreshold,
    isMarginBelowTarget,
    marginShortfallPct
  };
}

export interface PhaseMarginTrendItem {
  phaseId: string;
  phaseName: string;
  phaseShortName: string;
  status: 'Completed' | 'In Progress' | 'Upcoming' | 'Delayed' | 'Not Started' | string;
  budget: number;
  recordedCost: number;
  estimatedCost: number;
  totalCost: number;
  allocatedRevenue: number;
  phaseProfit: number;
  phaseMarginPct: number;
  cumulativeRevenue: number;
  cumulativeCost: number;
  cumulativeMarginPct: number;
  isMarginBelowThreshold: boolean;
  isRecorded: boolean;
  startDate?: string;
  endDate?: string;
}

export interface PhaseMarginTrendAnalysis {
  projectId: string;
  phases: PhaseMarginTrendItem[];
  latestRecordedMarginPct: number;
  recordedPhasesCount: number;
  totalPhasesCount: number;
  isCurrentBelowThreshold: boolean;
  trendDirection: 'improving' | 'declining' | 'stable';
}

export function calculatePhaseMarginTrend(
  project: Project,
  customThresholdPct?: number
): PhaseMarginTrendAnalysis {
  const threshold = customThresholdPct !== undefined ? customThresholdPct : getMarginThreshold();
  const phases = project.phases || [];
  const items = project.selectedItems || [];
  const quotedPrice = round2(project.quotedPrice || 0);

  const totalBudget = phases.reduce((acc, p) => decAdd(acc, p.budget || 0), 0);
  const overheadMultiplier = decAdd(
    1,
    decDiv(decAdd(project.overheadPct ?? 8.5, project.contingencyPct ?? 5.0), 100)
  );

  let cumulativeRevenue = 0;
  let cumulativeCost = 0;
  const trendPhases: PhaseMarginTrendItem[] = [];

  phases.forEach((p, idx) => {
    const phaseItems = items.filter((i) => i.phaseId === p.id);
    const itemsCost = phaseItems.reduce((acc, i) => {
      const { totalAmount } = calcDiscountedLine(i.quantity ?? 1, i.unitCost ?? 0, i.discountPct ?? 0);
      return decAdd(acc, totalAmount);
    }, 0);

    const recordedRaw = p.actualCost !== undefined && p.actualCost > 0 ? round2(p.actualCost) : itemsCost;
    const isRecorded = p.status === 'Completed' || p.status === 'In Progress' || recordedRaw > 0;
    const directPhaseCost = recordedRaw > 0 ? recordedRaw : round2(decMul(p.budget || 0, 0.85));
    const totalCost = round2(decMul(directPhaseCost, overheadMultiplier));

    const budgetShare =
      totalBudget > 0
        ? decDiv(p.budget || 0, totalBudget)
        : phases.length > 0
        ? decDiv(1, phases.length)
        : 1;
    const allocatedRevenue = round2(decMul(quotedPrice, budgetShare));
    const phaseProfit = decSub(allocatedRevenue, totalCost);
    const phaseMarginPct =
      allocatedRevenue > 0 ? round1(decMul(decDiv(phaseProfit, allocatedRevenue), 100)) : round1(project.targetMarginPct || 25);

    cumulativeRevenue = decAdd(cumulativeRevenue, allocatedRevenue);
    cumulativeCost = decAdd(cumulativeCost, totalCost);
    const cumProfit = decSub(cumulativeRevenue, cumulativeCost);
    const cumulativeMarginPct =
      cumulativeRevenue > 0 ? round1(decMul(decDiv(cumProfit, cumulativeRevenue), 100)) : phaseMarginPct;

    const shortName = p.name.includes(':') ? p.name.split(':')[0].trim() : `Phase ${idx + 1}`;

    trendPhases.push({
      phaseId: p.id,
      phaseName: p.name,
      phaseShortName: shortName,
      status: p.status || 'Upcoming',
      budget: round2(p.budget || 0),
      recordedCost: round2(recordedRaw),
      estimatedCost: round2(itemsCost),
      totalCost,
      allocatedRevenue,
      phaseProfit: round2(phaseProfit),
      phaseMarginPct,
      cumulativeRevenue: round2(cumulativeRevenue),
      cumulativeCost: round2(cumulativeCost),
      cumulativeMarginPct,
      isMarginBelowThreshold: phaseMarginPct < threshold,
      isRecorded,
      startDate: p.startDate,
      endDate: p.endDate
    });
  });

  const recordedList = trendPhases.filter((tp) => tp.isRecorded);
  const latestRecorded =
    recordedList.length > 0
      ? recordedList[recordedList.length - 1]
      : trendPhases[trendPhases.length - 1];

  const latestRecordedMarginPct = latestRecorded
    ? latestRecorded.phaseMarginPct
    : round1(project.targetMarginPct || 25);

  let trendDirection: 'improving' | 'declining' | 'stable' = 'stable';
  if (recordedList.length >= 2) {
    const first = recordedList[0].phaseMarginPct;
    const last = recordedList[recordedList.length - 1].phaseMarginPct;
    if (last - first > 1.0) trendDirection = 'improving';
    else if (first - last > 1.0) trendDirection = 'declining';
  }

  return {
    projectId: project.id,
    phases: trendPhases,
    latestRecordedMarginPct,
    recordedPhasesCount: recordedList.length,
    totalPhasesCount: trendPhases.length,
    isCurrentBelowThreshold: latestRecordedMarginPct < threshold,
    trendDirection
  };
}

export interface SystemAlert {
  id: string;
  type: 'margin' | 'budget' | 'inventory';
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  projectId?: string;
  inventoryId?: string;
  timestamp: string;
}

export function getDismissedAlertIds(): string[] {
  try {
    const saved = bizStore.getItem(DISMISSED_ALERTS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export function dismissAlert(alertId: string): void {
  try {
    const current = getDismissedAlertIds();
    if (!current.includes(alertId)) {
      bizStore.setItem(DISMISSED_ALERTS_KEY, JSON.stringify([...current, alertId]));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('system-alerts-updated'));
      }
    }
  } catch {
    // ignore
  }
}

export function resetDismissedAlerts(): void {
  try {
    bizStore.removeItem(DISMISSED_ALERTS_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('system-alerts-updated'));
    }
  } catch {
    // ignore
  }
}

export function compileSystemAlerts(
  projects: Project[],
  inventory: InventoryItem[],
  customThresholdPct?: number
): SystemAlert[] {
  const threshold = customThresholdPct !== undefined ? customThresholdPct : getMarginThreshold();
  const dismissed = new Set(getDismissedAlertIds());
  const alerts: SystemAlert[] = [];
  const now = new Date().toISOString();

  for (const proj of projects || []) {
    const analysis = calculateProjectProfitability(proj, threshold);
    const marginAlertId = `margin-${proj.id}`;
    if (analysis.isMarginBelowThreshold && !dismissed.has(marginAlertId)) {
      alerts.push({
        id: marginAlertId,
        type: 'margin',
        severity: analysis.netMarginPct < threshold * 0.5 ? 'critical' : 'warning',
        title: `Low Margin: ${proj.code}`,
        message: `${proj.name} net margin (${analysis.netMarginPct.toFixed(1)}%) is below the ${threshold}% floor.`,
        projectId: proj.id,
        timestamp: now
      });
    }

    for (const phase of proj.phases || []) {
      const actual = Number(phase.actualCost || 0);
      const budget = Number(phase.budget || 0);
      const budgetAlertId = `budget-${proj.id}-${phase.id}`;
      if (budget > 0 && actual > budget && !dismissed.has(budgetAlertId)) {
        const overrunPct = round1(decMul(decDiv(decSub(actual, budget), budget), 100));
        alerts.push({
          id: budgetAlertId,
          type: 'budget',
          severity: overrunPct > 15 ? 'critical' : 'warning',
          title: `Phase Overrun: ${proj.code}`,
          message: `${phase.name} exceeded budget by ${overrunPct.toFixed(1)}%.`,
          projectId: proj.id,
          timestamp: now
        });
      }
    }
  }

  for (const inv of inventory || []) {
    const stockAlertId = `inv-${inv.id}`;
    const qty = Number(inv.currentStock ?? inv.onHand ?? 0);
    const reorder = Number(inv.reorderLevel ?? 0);
    if (qty <= reorder && !dismissed.has(stockAlertId)) {
      alerts.push({
        id: stockAlertId,
        type: 'inventory',
        severity: qty === 0 ? 'critical' : 'warning',
        title: `Low Stock: ${inv.sku}`,
        message: `${inv.itemName || inv.name || inv.sku} is at ${qty} ${inv.unit || 'units'} (Reorder point: ${reorder}).`,
        inventoryId: inv.id,
        timestamp: now
      });
    }
  }

  return alerts;
}
