/**
 * Visual Warning System & Projected Cost Analysis Engine
 * Calculates item consumption run-rates, projected cost trajectories,
 * and detects phase budget overruns (overall, material, and labor/subcontractor)
 * to flag high-risk budget items in bold red and enable proactive project adjustments.
 */

import { Project, ProjectPhase, ProjectCostItem } from '../types';
import { convertCurrency, getCurrencyInfo } from './currency';

export interface ItemWarningAnalysis {
  itemId: string;
  itemName: string;
  itemType: 'material' | 'subcontractor' | 'outsourced';
  phaseId: string;
  phaseName: string;
  phaseBudget: number;
  phaseProjectedTotal: number;
  itemBaseCost: number;
  itemProjectedCost: number;
  consumptionRatePct: number;
  currency: string;
  nativeCost: number;
  isOverrunWarning: boolean;
  varianceAmount: number; // phaseBudget - phaseProjected
  variancePct: number;
  overrunExcessAmount: number; // how much projected exceeds budget
  severity: 'normal' | 'caution' | 'warning' | 'critical';
  reason: string;
}

export interface PhaseWarningSummary {
  phaseId: string;
  phaseName: string;
  budget: number;
  actualCost: number;
  projectedCost: number;
  variance: number;
  variancePct: number;
  consumptionPct: number;
  isOverrun: boolean;

  // Dedicated Material Cost Controls
  materialBudget: number;
  materialActualCost: number;
  materialProjectedCost: number;
  materialVariance: number;
  isMaterialOverrun: boolean;
  materialOverrunAmount: number;
  flaggedMaterialItems: ItemWarningAnalysis[];

  // Dedicated Labor (Subcontractor) Cost Controls
  laborBudget: number;
  laborActualCost: number;
  laborProjectedCost: number;
  laborVariance: number;
  isLaborOverrun: boolean;
  laborOverrunAmount: number;
  flaggedLaborItems: ItemWarningAnalysis[];

  // Dedicated Outsourced Services Controls
  outsourcedBudget: number;
  outsourcedActualCost: number;
  outsourcedProjectedCost: number;
  outsourcedVariance: number;
  isOutsourcedOverrun: boolean;

  healthStatus: 'optimal' | 'on_target' | 'caution' | 'high_risk' | 'critical';
  healthLabel: string;
  colorClass: {
    bg: string;
    border: string;
    text: string;
    badgeBg: string;
    badgeText: string;
  };
  flaggedItemCount: number;
  flaggedItems: ItemWarningAnalysis[];
}

export interface ProjectWarningRollup {
  totalEstablishedBudget: number;
  totalActualCost: number;
  totalProjectedCost: number;
  totalVariance: number;
  totalVariancePct: number;
  hasOverruns: boolean;
  criticalItemCount: number;

  // Material & Labor Granular Overrun Tracking
  hasMaterialOverruns: boolean;
  hasLaborOverruns: boolean;
  materialOverrunPhases: PhaseWarningSummary[];
  laborOverrunPhases: PhaseWarningSummary[];
  totalMaterialOverrunAmount: number;
  totalLaborOverrunAmount: number;

  phases: PhaseWarningSummary[];
  itemAnalyses: Map<string, ItemWarningAnalysis>;
}

/**
 * Analyze all items in a project or plan for phase budget overruns based on consumption rates,
 * specifically distinguishing between material and labor / subcontractor cost overruns.
 */
export function analyzeProjectBudgetWarnings(
  project: Project,
  customItems?: ProjectCostItem[],
  projectCurrency: string = 'USD'
): ProjectWarningRollup {
  const items = customItems || project.selectedItems || [];
  const phases = project.phases || [];

  const itemAnalyses = new Map<string, ItemWarningAnalysis>();

  const phaseSummaries: PhaseWarningSummary[] = phases.map((phase) => {
    const phaseBudget = phase.budget ?? phase.plannedCost ?? 0;
    const phaseItems = items.filter((i) => i.phaseId === phase.id);

    // Compute base cost and projected cost by item type
    let phaseCalculatedActual = 0;
    let phaseTotalProjected = 0;

    let matActual = 0;
    let matProjected = 0;
    let laborActual = 0;
    let laborProjected = 0;
    let outActual = 0;
    let outProjected = 0;

    const itemCalcs = phaseItems.map((item) => {
      const itemCurr = item.currency || 'USD';
      
      // Calculate unit cost in project currency
      let unitCostInProjectCurrency = item.unitCost;
      if (itemCurr !== projectCurrency) {
        unitCostInProjectCurrency = convertCurrency(item.unitCost, itemCurr, projectCurrency);
      }

      const discountFactor = 1 - (item.discountPct || 0) / 100;
      const baseTotalCost = (item.quantity || 1) * unitCostInProjectCurrency * discountFactor;
      
      // Consumption rate: default is 100% (burn matches plan). If 125%, burning 25% faster.
      const consumptionRate = item.consumptionRate !== undefined && item.consumptionRate > 0 
        ? item.consumptionRate 
        : 100;

      // Projected cost based on current consumption rate
      const projectedCost = baseTotalCost * (consumptionRate / 100);

      phaseCalculatedActual += baseTotalCost;
      phaseTotalProjected += projectedCost;

      if (item.type === 'material') {
        matActual += baseTotalCost;
        matProjected += projectedCost;
      } else if (item.type === 'subcontractor') {
        laborActual += baseTotalCost;
        laborProjected += projectedCost;
      } else if (item.type === 'outsourced') {
        outActual += baseTotalCost;
        outProjected += projectedCost;
      }

      return {
        item,
        baseTotalCost,
        projectedCost,
        consumptionRate,
        unitCostInProjectCurrency,
        itemCurr
      };
    });

    // Determine established material and labor budgets for the phase
    const totalItemBase = matActual + laborActual + outActual;
    let materialBudget = phase.materialBudget && phase.materialBudget > 0 ? phase.materialBudget : 0;
    let laborBudget = phase.laborBudget && phase.laborBudget > 0 ? phase.laborBudget : 0;
    let outsourcedBudget = phase.outsourcedBudget && phase.outsourcedBudget > 0 ? phase.outsourcedBudget : 0;

    // If explicit breakdown isn't given, derive baseline allocation from items or phase name
    if (materialBudget === 0 && laborBudget === 0 && phaseBudget > 0) {
      if (totalItemBase > 0) {
        materialBudget = Math.round((matActual / totalItemBase) * phaseBudget);
        laborBudget = Math.round((laborActual / totalItemBase) * phaseBudget);
        outsourcedBudget = phaseBudget - materialBudget - laborBudget;
      } else {
        const pNameLower = (phase.name || '').toLowerCase();
        if (pNameLower.includes('material') || pNameLower.includes('procurement') || pNameLower.includes('ingot')) {
          materialBudget = Math.round(phaseBudget * 0.70);
          laborBudget = Math.round(phaseBudget * 0.30);
        } else if (pNameLower.includes('machining') || pNameLower.includes('edm') || pNameLower.includes('assembly') || pNameLower.includes('labor')) {
          materialBudget = Math.round(phaseBudget * 0.30);
          laborBudget = Math.round(phaseBudget * 0.70);
        } else {
          materialBudget = Math.round(phaseBudget * 0.50);
          laborBudget = Math.round(phaseBudget * 0.50);
        }
      }
    }

    // Material and Labor Overrun Calculations
    const isMaterialOverrun = materialBudget > 0 && matProjected > materialBudget;
    const materialOverrunAmount = isMaterialOverrun ? matProjected - materialBudget : 0;
    const materialVariance = materialBudget - matProjected;

    const isLaborOverrun = laborBudget > 0 && laborProjected > laborBudget;
    const laborOverrunAmount = isLaborOverrun ? laborProjected - laborBudget : 0;
    const laborVariance = laborBudget - laborProjected;

    const isOutsourcedOverrun = outsourcedBudget > 0 && outProjected > outsourcedBudget;
    const outsourcedVariance = outsourcedBudget - outProjected;

    // Overall Phase Calculations
    const effectiveActual = phaseCalculatedActual > 0 ? phaseCalculatedActual : (phase.actualCost || 0);
    const effectiveProjected = phaseTotalProjected > 0 ? phaseTotalProjected : effectiveActual;
    const variance = phaseBudget - effectiveProjected;
    const variancePct = phaseBudget > 0 ? (variance / phaseBudget) * 100 : 0;
    const isPhaseOverrun = (phaseBudget > 0 && effectiveProjected > phaseBudget) || isMaterialOverrun || isLaborOverrun;
    const consumptionPct = phaseBudget > 0 ? (effectiveProjected / phaseBudget) * 100 : 100;

    const flaggedItems: ItemWarningAnalysis[] = [];
    const flaggedMaterialItems: ItemWarningAnalysis[] = [];
    const flaggedLaborItems: ItemWarningAnalysis[] = [];

    itemCalcs.forEach(({ item, baseTotalCost, projectedCost, consumptionRate, itemCurr }) => {
      let isWarning = false;
      let reason = '';
      let severity: ItemWarningAnalysis['severity'] = 'normal';

      const isMat = item.type === 'material';
      const isLabor = item.type === 'subcontractor';
      const specificBudget = isMat ? materialBudget : isLabor ? laborBudget : outsourcedBudget;
      const specificProjected = isMat ? matProjected : isLabor ? laborProjected : outProjected;
      const isSpecificOverrun = isMat ? isMaterialOverrun : isLabor ? isLaborOverrun : isOutsourcedOverrun;

      if (isSpecificOverrun) {
        const excess = specificProjected - specificBudget;
        if (consumptionRate > 105) {
          isWarning = true;
          severity = 'critical';
          reason = `${isMat ? 'Material' : 'Labor'} burn rate is ${consumptionRate}%. Drives phase ${isMat ? 'material' : 'labor'} budget overrun by +$${Math.round(excess).toLocaleString()}.`;
        } else if (specificBudget > 0 && (projectedCost / specificBudget) > 0.25) {
          isWarning = true;
          severity = 'warning';
          reason = `Major ${isMat ? 'material' : 'labor'} driver (${Math.round((projectedCost / specificBudget) * 100)}% of ${isMat ? 'material' : 'labor'} budget). Exceeds budget by +$${Math.round(excess).toLocaleString()}.`;
        } else {
          isWarning = true;
          severity = 'caution';
          reason = `Contributing to phase ${isMat ? 'material' : 'labor'} cost overrun of +$${Math.round(excess).toLocaleString()}.`;
        }
      } else if (isPhaseOverrun) {
        if (consumptionRate > 105) {
          isWarning = true;
          severity = 'warning';
          reason = `Elevated consumption rate (${consumptionRate}%). Phase is projected over budget.`;
        }
      } else if (consumptionRate > 125) {
        isWarning = true;
        severity = 'caution';
        reason = `Burn rate alert: Consuming at ${consumptionRate}% pace.`;
      }

      const analysis: ItemWarningAnalysis = {
        itemId: item.id,
        itemName: item.name,
        itemType: item.type,
        phaseId: phase.id,
        phaseName: phase.name,
        phaseBudget,
        phaseProjectedTotal: effectiveProjected,
        itemBaseCost: baseTotalCost,
        itemProjectedCost: projectedCost,
        consumptionRatePct: consumptionRate,
        currency: itemCurr,
        nativeCost: item.unitCost,
        isOverrunWarning: isWarning,
        varianceAmount: variance,
        variancePct,
        overrunExcessAmount: isWarning ? Math.max(0, projectedCost - baseTotalCost) : 0,
        severity,
        reason
      };

      itemAnalyses.set(item.id, analysis);
      if (isWarning) {
        flaggedItems.push(analysis);
        if (isMat) flaggedMaterialItems.push(analysis);
        if (isLabor) flaggedLaborItems.push(analysis);
      }
    });

    // Phase Health Categorization
    let healthStatus: PhaseWarningSummary['healthStatus'] = 'optimal';
    let healthLabel = 'Optimal';
    let colorClass = {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-300 dark:border-emerald-800',
      text: 'text-emerald-800 dark:text-emerald-300',
      badgeBg: 'bg-emerald-100 dark:bg-emerald-900/60',
      badgeText: 'text-emerald-700 dark:text-emerald-300'
    };

    if (isPhaseOverrun || consumptionPct >= 115 || isMaterialOverrun || isLaborOverrun) {
      healthStatus = 'critical';
      healthLabel = isMaterialOverrun && isLaborOverrun
        ? 'Material & Labor Overrun'
        : isMaterialOverrun
        ? 'Material Overrun'
        : isLaborOverrun
        ? 'Labor Overrun'
        : 'Budget Overrun';
      colorClass = {
        bg: 'bg-red-50 dark:bg-red-950/40',
        border: 'border-red-400 dark:border-red-800',
        text: 'text-red-900 dark:text-red-200',
        badgeBg: 'bg-red-100 dark:bg-red-900/70',
        badgeText: 'text-red-700 dark:text-red-300'
      };
    } else if (consumptionPct >= 105) {
      healthStatus = 'high_risk';
      healthLabel = 'High Risk';
      colorClass = {
        bg: 'bg-orange-50 dark:bg-orange-950/40',
        border: 'border-orange-300 dark:border-orange-800',
        text: 'text-orange-900 dark:text-orange-200',
        badgeBg: 'bg-orange-100 dark:bg-orange-900/60',
        badgeText: 'text-orange-700 dark:text-orange-300'
      };
    } else if (consumptionPct >= 95) {
      healthStatus = 'caution';
      healthLabel = 'Near Budget Cap';
      colorClass = {
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        border: 'border-amber-300 dark:border-amber-800',
        text: 'text-amber-900 dark:text-amber-200',
        badgeBg: 'bg-amber-100 dark:bg-amber-900/60',
        badgeText: 'text-amber-700 dark:text-amber-300'
      };
    } else if (consumptionPct >= 80) {
      healthStatus = 'on_target';
      healthLabel = 'On Target';
      colorClass = {
        bg: 'bg-teal-50 dark:bg-teal-950/40',
        border: 'border-teal-300 dark:border-teal-800',
        text: 'text-teal-900 dark:text-teal-200',
        badgeBg: 'bg-teal-100 dark:bg-teal-900/60',
        badgeText: 'text-teal-700 dark:text-teal-300'
      };
    }

    return {
      phaseId: phase.id,
      phaseName: phase.name,
      budget: phaseBudget,
      actualCost: effectiveActual,
      projectedCost: effectiveProjected,
      variance,
      variancePct,
      consumptionPct,
      isOverrun: isPhaseOverrun,

      // Material Breakdown
      materialBudget,
      materialActualCost: matActual,
      materialProjectedCost: matProjected,
      materialVariance,
      isMaterialOverrun,
      materialOverrunAmount,
      flaggedMaterialItems,

      // Labor Breakdown
      laborBudget,
      laborActualCost: laborActual,
      laborProjectedCost: laborProjected,
      laborVariance,
      isLaborOverrun,
      laborOverrunAmount,
      flaggedLaborItems,

      // Outsourced Breakdown
      outsourcedBudget,
      outsourcedActualCost: outActual,
      outsourcedProjectedCost: outProjected,
      outsourcedVariance,
      isOutsourcedOverrun,

      healthStatus,
      healthLabel,
      colorClass,
      flaggedItemCount: flaggedItems.length,
      flaggedItems
    };
  });

  const totalEstablishedBudget = phaseSummaries.reduce((sum, p) => sum + p.budget, 0);
  const totalActualCost = phaseSummaries.reduce((sum, p) => sum + p.actualCost, 0);
  const totalProjectedCost = phaseSummaries.reduce((sum, p) => sum + p.projectedCost, 0);
  const totalVariance = totalEstablishedBudget - totalProjectedCost;
  const totalVariancePct = totalEstablishedBudget > 0 ? (totalVariance / totalEstablishedBudget) * 100 : 0;
  const criticalItemCount = Array.from(itemAnalyses.values()).filter((a) => a.isOverrunWarning).length;

  const materialOverrunPhases = phaseSummaries.filter((p) => p.isMaterialOverrun);
  const laborOverrunPhases = phaseSummaries.filter((p) => p.isLaborOverrun);
  const totalMaterialOverrunAmount = materialOverrunPhases.reduce((sum, p) => sum + p.materialOverrunAmount, 0);
  const totalLaborOverrunAmount = laborOverrunPhases.reduce((sum, p) => sum + p.laborOverrunAmount, 0);

  return {
    totalEstablishedBudget,
    totalActualCost,
    totalProjectedCost,
    totalVariance,
    totalVariancePct,
    hasOverruns: phaseSummaries.some((p) => p.isOverrun),
    criticalItemCount,
    hasMaterialOverruns: materialOverrunPhases.length > 0,
    hasLaborOverruns: laborOverrunPhases.length > 0,
    materialOverrunPhases,
    laborOverrunPhases,
    totalMaterialOverrunAmount,
    totalLaborOverrunAmount,
    phases: phaseSummaries,
    itemAnalyses
  };
}
