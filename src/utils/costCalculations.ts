import { ProjectCostItem, ProjectPhase, ProjectProfitabilityMetrics } from '../types';
import { round1, round2, decAdd, decSub, decMul, decDiv, calcDiscountedLine } from './decimalMath';
import { calculatePlanFinancials } from './planCalculationService';

export function calculateProjectMetrics(
  quotedPrice: number,
  targetMarginPct: number,
  overheadPct: number,
  contingencyPct: number,
  selectedItems: ProjectCostItem[],
  phases: ProjectPhase[],
  resources: any[] = []
): ProjectProfitabilityMetrics {
  const { summary } = calculatePlanFinancials({
    plannedRevenue: quotedPrice,
    projectQuotedPrice: quotedPrice,
    targetMarginPct,
    overheadPct,
    contingencyPct,
    laborBurdenPct: 0,
    boqItems: selectedItems || [],
    sections: [],
    resources: resources || []
  });

  const {
    plannedRevenue: revenue,
    materialCost,
    subcontractorCost,
    outsourcedCost,
    directCost: totalDirectCost,
    overheadAmount,
    contingencyAmount,
    totalPlannedCost: totalProjectCost,
    grossProfit,
    grossMarginPct,
    plannedProfit: netProfit,
    profitMarginPct: netMarginPct
  } = summary;

  let totalPlannedBudget = 0;
  const phaseMetrics = (phases || []).map(p => {
    const planned = round2(p.budget || 0);
    const phaseItemsCost = (selectedItems || [])
      .filter(i => i.phaseId === p.id)
      .reduce((sum, i) => {
        const lineCost =
          Number(i.totalCost || 0) > 0
            ? round2(i.totalCost)
            : calcDiscountedLine(i.quantity ?? 1, i.unitCost ?? 0, i.discountPct ?? 0).totalAmount;
        return round2(decAdd(sum, lineCost));
      }, 0);

    const phaseResourcesCost = (resources || [])
      .filter((r: any) => r.phaseId === p.id)
      .reduce((sum: number, r: any) => round2(decAdd(sum, Number(r.totalCost || 0))), 0);

    const totalPhaseCalculated = round2(decAdd(phaseItemsCost, phaseResourcesCost));
    const actual = totalPhaseCalculated > 0 ? totalPhaseCalculated : round2(p.actualCost || 0);
    totalPlannedBudget = round2(decAdd(totalPlannedBudget, planned));
    const variance = round2(decSub(planned, actual));
    const variancePct = planned > 0 ? round2(decDiv(decMul(variance, 100), planned)) : 0;
    return {
      phaseId: p.id,
      phaseName: p.name,
      plannedBudget: planned,
      actualCost: actual,
      variance,
      variancePct,
      status: (variance >= 0 ? 'Under Budget' : 'Over Budget') as 'Under Budget' | 'Over Budget'
    };
  });

  const budgetVariance = round2(decSub(totalPlannedBudget, totalProjectCost));
  const budgetVariancePct = totalPlannedBudget > 0 ? round2(decDiv(decMul(budgetVariance, 100), totalPlannedBudget)) : 0;

  let healthScore = 100;
  if (netMarginPct < 10) {
    healthScore -= 30;
  } else if (netMarginPct < (targetMarginPct || 20)) {
    healthScore -= 10;
  }
  if (budgetVariance < 0) {
    healthScore -= Math.min(35, Math.abs(budgetVariancePct) * 2);
  }
  healthScore = round1(Math.max(5, Math.min(100, healthScore)));

  const matInflationImpact = round2(decMul(materialCost, 0.05));
  const labourHikeImpact = round2(decMul(subcontractorCost, 0.08));
  const overheadPlusContingency = round2(decAdd(overheadAmount, contingencyAmount));

  return {
    revenue,
    materialCost,
    subcontractorCost,
    outsourcedCost,
    totalDirectCost,
    overheadAmount,
    contingencyAmount,
    totalProjectCost,
    grossProfit,
    grossMarginPct,
    netProfit,
    netMarginPct,
    totalPlannedBudget,
    budgetVariance,
    budgetVariancePct,
    healthScore,
    phaseMetrics,
    sensitivity: {
      materialInflation5Pct: {
        costImpact: matInflationImpact,
        revisedNetMarginPct: revenue > 0 ? round2(decDiv(decMul(decSub(netProfit, matInflationImpact), 100), revenue)) : 0
      },
      labourRateHike8Pct: {
        costImpact: labourHikeImpact,
        revisedNetMarginPct: revenue > 0 ? round2(decDiv(decMul(decSub(netProfit, labourHikeImpact), 100), revenue)) : 0
      }
    },
    costDistribution: [
      { category: 'Materials', amount: materialCost, pct: totalDirectCost > 0 ? round1(decDiv(decMul(materialCost, 100), totalDirectCost)) : 0 },
      { category: 'Subcontractor Labour', amount: subcontractorCost, pct: totalDirectCost > 0 ? round1(decDiv(decMul(subcontractorCost, 100), totalDirectCost)) : 0 },
      { category: 'Outsourced Services', amount: outsourcedCost, pct: totalDirectCost > 0 ? round1(decDiv(decMul(outsourcedCost, 100), totalDirectCost)) : 0 },
      { category: 'Overhead & Contingency', amount: overheadPlusContingency, pct: totalProjectCost > 0 ? round1(decDiv(decMul(overheadPlusContingency, 100), totalProjectCost)) : 0 }
    ]
  };
}
