/**
 * Unified Project Plan Financial Calculation Service
 * Single source of truth for calculating plan BOQ line totals, direct costs,
 * overhead allocations, total planned cost, planned profit, and profit margins.
 * Used across both the PostgreSQL backend and frontend views to prevent duplicate
 * or inconsistent calculations (Requirement 21).
 */

import {
  ProjectCostItem,
  ProjectPlanBoqItem,
  ProjectPlanSection,
  ProjectPlanResource,
  ProjectPlanOverheadAllocation,
  ProjectPlanCostSummary
} from '../types';
import { round2, round4, decAdd, decSub, decMul, decDiv, calcDiscountedLine } from './decimalMath';

export interface PlanCalculationInput {
  planId?: string;
  projectId?: string;
  plannedRevenue?: number;
  projectQuotedPrice?: number;
  targetMarginPct?: number;
  overheadPct?: number;
  contingencyPct?: number;
  laborBurdenPct?: number;
  boqItems?: Array<Partial<ProjectPlanBoqItem & ProjectCostItem>>;
  sections?: Array<Partial<ProjectPlanSection>>;
  resources?: Array<Partial<ProjectPlanResource>>;
  overheadAllocations?: Array<Partial<ProjectPlanOverheadAllocation>>;
}

export interface NormalizedPlanCalculationResult {
  summary: ProjectPlanCostSummary;
  normalizedBoqItems: ProjectPlanBoqItem[];
  normalizedResources: ProjectPlanResource[];
  normalizedOverheadAllocations: ProjectPlanOverheadAllocation[];
}

export function calculatePlanFinancials(input: PlanCalculationInput): NormalizedPlanCalculationResult {
  const rawItems = Array.isArray(input.boqItems) ? input.boqItems : [];
  const rawResources = Array.isArray(input.resources) ? input.resources : [];
  const rawSections = Array.isArray(input.sections) ? input.sections : [];
  const rawOverheads = Array.isArray(input.overheadAllocations) ? input.overheadAllocations : [];

  let materialCost = 0;
  let subcontractorCost = 0;
  let outsourcedCost = 0;
  let itemsBilledRevenue = 0;

  const normalizedBoqItems: ProjectPlanBoqItem[] = rawItems.map((it, idx) => {
    const qty = Math.max(0, round4(it.quantity ?? 1));
    const unitCost = Math.max(0, round4(it.unitCost ?? 0));
    const discountPct = Math.max(0, Math.min(100, round2(it.discountPct ?? 0)));
    const { totalAmount } = calcDiscountedLine(qty, unitCost, discountPct);
    const lineCost = round2(totalAmount);

    const markupPct = round2(it.markupPct ?? 30);
    const defaultBillableRate = round4(decMul(unitCost, decAdd(1, decDiv(markupPct, 100))));
    const billableRate = it.billableRate !== undefined && Number(it.billableRate) > 0 ? round4(it.billableRate) : defaultBillableRate;
    const totalRevenue = it.totalRevenue !== undefined && Number(it.totalRevenue) > 0 ? round2(it.totalRevenue) : round2(decMul(qty, billableRate));
    const grossProfit = round2(decSub(totalRevenue, lineCost));

    const itemTypeRaw = String(it.type || 'material').toLowerCase();
    const itemType: ProjectPlanBoqItem['type'] =
      itemTypeRaw === 'subcontractor'
        ? 'subcontractor'
        : itemTypeRaw === 'outsourced'
        ? 'outsourced'
        : itemTypeRaw === 'produce'
        ? 'produce'
        : itemTypeRaw === 'equipment'
        ? 'equipment'
        : itemTypeRaw === 'other'
        ? 'other'
        : 'material';

    if (itemType === 'subcontractor') {
      subcontractorCost = round2(decAdd(subcontractorCost, lineCost));
    } else if (itemType === 'outsourced') {
      outsourcedCost = round2(decAdd(outsourcedCost, lineCost));
    } else {
      materialCost = round2(decAdd(materialCost, lineCost));
    }

    itemsBilledRevenue = round2(decAdd(itemsBilledRevenue, totalRevenue));

    return {
      id: it.id || `boq-${Date.now()}-${idx}`,
      planId: input.planId,
      projectId: input.projectId,
      sectionId: it.sectionId,
      phaseId: it.phaseId || 'phase-01',
      type: itemType,
      itemId: it.itemId || it.itemCode || `ITM-${idx + 1}`,
      itemCode: it.itemCode || it.itemId || `ITM-${idx + 1}`,
      name: String(it.name || 'Line Item').trim(),
      category: it.category || '',
      supplierOrProvider: it.supplierOrProvider || 'Approved Vendor',
      quantity: qty,
      unit: it.unit || 'pcs',
      unitCost,
      discountPct,
      totalCost: lineCost,
      markupPct,
      billableRate,
      totalRevenue,
      grossProfit,
      currency: it.currency || 'USD',
      nativeUnitCost: it.nativeUnitCost !== undefined ? round4(it.nativeUnitCost) : unitCost,
      consumptionRate: it.consumptionRate !== undefined ? round2(it.consumptionRate) : 100,
      notes: it.notes || '',
      lineOrder: it.lineOrder !== undefined ? Number(it.lineOrder) : idx + 1
    };
  });

  let resourceCost = 0;
  const normalizedResources: ProjectPlanResource[] = rawResources.map((r, idx) => {
    const allocatedHours = Math.max(0, round2(r.allocatedHours ?? 0));
    const hourlyRate = Math.max(0, round4(r.hourlyRate ?? 0));
    const totalCost = r.totalCost !== undefined && Number(r.totalCost) > 0
      ? round2(r.totalCost)
      : round2(decMul(allocatedHours, hourlyRate));
    resourceCost = round2(decAdd(resourceCost, totalCost));
    return {
      id: r.id || `res-${Date.now()}-${idx}`,
      planId: input.planId,
      projectId: input.projectId,
      sectionId: r.sectionId,
      resourceId: r.resourceId || `R-${idx + 1}`,
      resourceType: (r.resourceType === 'team_member' || r.resourceType === 'equipment' ? r.resourceType : 'subcontractor'),
      name: String(r.name || 'Assigned Resource').trim(),
      roleOrTrade: r.roleOrTrade || 'Specialist',
      allocatedHours,
      hourlyRate,
      totalCost,
      startDate: r.startDate,
      endDate: r.endDate,
      notes: r.notes || ''
    };
  });

  const directCost = round2(decAdd(decAdd(decAdd(materialCost, subcontractorCost), outsourcedCost), resourceCost));

  const overheadPct = round2(input.overheadPct ?? 8.5);
  const contingencyPct = round2(input.contingencyPct ?? 5.0);
  const laborBurdenPct = round2(input.laborBurdenPct ?? 0);
  const targetMarginPct = Math.min(90, Math.max(0, round2(input.targetMarginPct ?? 25)));

  const laborBurdenAmount = round2(decDiv(decMul(directCost, laborBurdenPct), 100));
  const effectiveDirectBase = round2(decAdd(directCost, laborBurdenAmount));
  const overheadAmount = round2(decDiv(decMul(effectiveDirectBase, overheadPct), 100));
  const contingencyAmount = round2(decDiv(decMul(effectiveDirectBase, contingencyPct), 100));

  // Build normalized overhead allocations (preserve explicit custom allocations + standard allocations)
  const customOverheads = rawOverheads.filter(
    (o) =>
      o &&
      o.category &&
      !['General Overhead', 'Contingency Reserve', 'Labor Burden'].includes(String(o.category))
  );

  let extraOverheadAmount = 0;
  const normalizedCustomOverheads: ProjectPlanOverheadAllocation[] = customOverheads.map((o, idx) => {
    const allocType = o.allocationType === 'fixed' ? 'fixed' : 'percentage';
    const ratePct = round2(o.ratePct ?? 0);
    const baseAmount = o.baseAmount !== undefined && Number(o.baseAmount) > 0 ? round2(o.baseAmount) : effectiveDirectBase;
    const allocatedAmount =
      allocType === 'fixed'
        ? round2(o.allocatedAmount ?? 0)
        : round2(decDiv(decMul(baseAmount, ratePct), 100));
    extraOverheadAmount = round2(decAdd(extraOverheadAmount, allocatedAmount));
    return {
      id: o.id || `ovh-custom-${Date.now()}-${idx}`,
      planId: input.planId,
      projectId: input.projectId,
      category: String(o.category || 'Custom Overhead'),
      allocationType: allocType,
      ratePct,
      baseAmount,
      allocatedAmount,
      notes: o.notes || ''
    };
  });

  const standardOverheads: ProjectPlanOverheadAllocation[] = [
    {
      id: `ovh-std-overhead-${input.planId || 'plan'}`,
      planId: input.planId,
      projectId: input.projectId,
      category: 'General Overhead',
      allocationType: 'percentage',
      ratePct: overheadPct,
      baseAmount: effectiveDirectBase,
      allocatedAmount: overheadAmount,
      notes: 'Standard corporate & administrative overhead allocation'
    },
    {
      id: `ovh-std-contingency-${input.planId || 'plan'}`,
      planId: input.planId,
      projectId: input.projectId,
      category: 'Contingency Reserve',
      allocationType: 'percentage',
      ratePct: contingencyPct,
      baseAmount: effectiveDirectBase,
      allocatedAmount: contingencyAmount,
      notes: 'Risk & price escalation contingency reserve'
    }
  ];

  if (laborBurdenPct > 0 || laborBurdenAmount > 0) {
    standardOverheads.push({
      id: `ovh-std-burden-${input.planId || 'plan'}`,
      planId: input.planId,
      projectId: input.projectId,
      category: 'Labor Burden',
      allocationType: 'percentage',
      ratePct: laborBurdenPct,
      baseAmount: directCost,
      allocatedAmount: laborBurdenAmount,
      notes: 'Payroll taxes, benefits & statutory labor burden'
    });
  }

  const normalizedOverheadAllocations = [...standardOverheads, ...normalizedCustomOverheads];

  const allocatedOverhead = round2(
    decAdd(decAdd(decAdd(overheadAmount, contingencyAmount), laborBurdenAmount), extraOverheadAmount)
  );
  const totalPlannedCost = round2(decAdd(directCost, allocatedOverhead));

  // Determine plannedRevenue:
  // 1. Explicit plannedRevenue if > 0
  // 2. Else projectQuotedPrice if > 0
  // 3. Else if totalPlannedCost > 0 and targetMarginPct > 0, compute recommended selling price: totalPlannedCost / (1 - targetMarginPct/100)
  let plannedRevenue = round2(input.plannedRevenue ?? 0);
  if (plannedRevenue <= 0 && (input.projectQuotedPrice ?? 0) > 0) {
    plannedRevenue = round2(input.projectQuotedPrice);
  }
  if (plannedRevenue <= 0 && totalPlannedCost > 0 && targetMarginPct > 0 && targetMarginPct < 95) {
    plannedRevenue = round2(decDiv(totalPlannedCost, decSub(1, decDiv(targetMarginPct, 100))));
  }

  const grossProfit = round2(decSub(plannedRevenue, directCost));
  const grossMarginPct = plannedRevenue > 0 ? round2(decDiv(decMul(grossProfit, 100), plannedRevenue)) : 0;

  const plannedProfit = round2(decSub(plannedRevenue, totalPlannedCost));
  const profitMarginPct = plannedRevenue > 0 ? round2(decDiv(decMul(plannedProfit, 100), plannedRevenue)) : 0;

  const summary: ProjectPlanCostSummary = {
    planId: input.planId,
    projectId: input.projectId,
    plannedRevenue,
    materialCost,
    subcontractorCost,
    outsourcedCost,
    resourceCost,
    directCost,
    overheadAmount,
    contingencyAmount,
    laborBurdenAmount,
    extraOverheadAmount,
    allocatedOverhead,
    totalPlannedCost,
    grossProfit,
    grossMarginPct,
    plannedProfit,
    profitMarginPct,
    boqItemCount: normalizedBoqItems.length,
    sectionCount: rawSections.length,
    resourceCount: normalizedResources.length,
    calculatedAt: new Date().toISOString()
  };

  return {
    summary,
    normalizedBoqItems,
    normalizedResources,
    normalizedOverheadAllocations
  };
}
