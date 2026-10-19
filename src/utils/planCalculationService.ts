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
    const explicitRate = it.rate !== undefined && Number(it.rate) > 0
      ? round4(it.rate)
      : it.sellingRate !== undefined && Number(it.sellingRate) > 0
      ? round4(it.sellingRate)
      : it.billableRate !== undefined && Number(it.billableRate) > 0
      ? round4(it.billableRate)
      : round4(decMul(unitCost, decAdd(1, decDiv(markupPct, 100))));

    const billableRate = explicitRate;
    const rate = explicitRate;

    // Line revenue: qty * rate discounted by discountPct
    const calcLineRevenue = round2(decMul(qty, decMul(rate, decSub(1, decDiv(discountPct, 100)))));
    const totalRevenue = it.totalRevenue !== undefined && Number(it.totalRevenue) > 0
      ? round2(it.totalRevenue)
      : calcLineRevenue;
    const grossProfit = round2(decSub(totalRevenue, lineCost));

    const itemTypeRaw = String(it.type || 'material').toLowerCase();
    const itemType: ProjectPlanBoqItem['type'] =
      itemTypeRaw === 'product'
        ? 'product'
        : itemTypeRaw === 'service'
        ? 'service'
        : itemTypeRaw === 'subcontractor'
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
      revenueItemId: (it as any).revenueItemId || undefined,
      name: String(it.name || 'Line Item').trim(),
      category: it.category || '',
      subCategory: (it as any).subCategory || '',
      supplierOrProvider: it.supplierOrProvider || 'Approved Vendor',
      description: it.description || '',
      quantity: qty,
      unit: it.unit || 'pcs',
      unitCost,
      discountPct,
      rate,
      sellingRate: rate,
      totalCost: lineCost,
      markupPct,
      billableRate,
      taxTreatment: (it as any).taxTreatment || 'Standard (0%)',
      taxRatePct: round2((it as any).taxRatePct ?? 0),
      taxAmount: round2((it as any).taxAmount ?? 0),
      totalRevenue,
      grossProfit,
      currency: it.currency || 'USD',
      nativeUnitCost: it.nativeUnitCost !== undefined ? round4(it.nativeUnitCost) : unitCost,
      consumptionRate: it.consumptionRate !== undefined ? round2(it.consumptionRate) : 100,
      notes: it.notes || '',
      lineOrder: it.lineOrder !== undefined ? Number(it.lineOrder) : idx + 1,
      snapshotData: (it as any).snapshotData || (it as any).snapshot_data || undefined,
      commercialContext: (it as any).commercialContext || (it as any).commercial_context || undefined
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
      (o.category || o.overheadItemName || o.overheadItemId) &&
      !['General Overhead', 'Contingency Reserve', 'Labor Burden'].includes(String(o.category || ''))
  );

  let extraOverheadAmount = 0;
  const normalizedCustomOverheads: ProjectPlanOverheadAllocation[] = customOverheads.map((o, idx) => {
    const rawMethod = String(o.allocationMethod || (o.allocationType === 'fixed' ? 'fixed_amount' : 'percentage_of_cost_base'));
    const method: ProjectPlanOverheadAllocation['allocationMethod'] =
      rawMethod === 'rate_per_unit'
        ? 'rate_per_unit'
        : rawMethod === 'fixed_amount' || rawMethod === 'fixed'
        ? 'fixed_amount'
        : rawMethod === 'proportional_defined_base'
        ? 'proportional_defined_base'
        : 'percentage_of_cost_base';

    const allocBase: ProjectPlanOverheadAllocation['allocationBase'] = (o.allocationBase as any) || 'total_direct_cost';
    const rate = round4(Number(o.allocationRate ?? o.ratePct ?? 0));
    const unitQty = Math.max(0, round4(Number(o.unitQuantity ?? 1)));

    // Determine relevant base dynamically based on allocation base
    let baseAmount = round2(Number(o.baseAmount || 0));
    if (allocBase === 'material_cost') {
      baseAmount = materialCost;
    } else if (allocBase === 'subcontractor_cost') {
      baseAmount = subcontractorCost;
    } else if (allocBase === 'outsourced_cost') {
      baseAmount = outsourcedCost;
    } else if (allocBase === 'labor_cost') {
      baseAmount = round2(decAdd(resourceCost, laborBurdenAmount));
    } else if (allocBase === 'planned_revenue') {
      baseAmount = round2(input.plannedRevenue ?? input.projectQuotedPrice ?? 0);
    } else if (allocBase === 'total_direct_cost') {
      baseAmount = effectiveDirectBase;
    } else if (baseAmount <= 0) {
      baseAmount = effectiveDirectBase;
    }

    let allocatedAmount = 0;
    if (method === 'fixed_amount') {
      allocatedAmount = round2(o.allocatedAmount !== undefined && Number(o.allocatedAmount) > 0 ? Number(o.allocatedAmount) : rate);
    } else if (method === 'rate_per_unit') {
      allocatedAmount = round2(decMul(rate, unitQty));
    } else if (method === 'percentage_of_cost_base' || method === 'proportional_defined_base') {
      allocatedAmount = round2(decDiv(decMul(baseAmount, rate), 100));
    } else {
      allocatedAmount = round2(decDiv(decMul(baseAmount, rate), 100));
    }

    extraOverheadAmount = round2(decAdd(extraOverheadAmount, allocatedAmount));

    return {
      id: o.id || `ovh-custom-${Date.now()}-${idx}`,
      planId: input.planId || '',
      projectId: input.projectId || '',
      overheadItemId: o.overheadItemId,
      overheadItemCode: o.overheadItemCode,
      overheadItemName: o.overheadItemName,
      barcode: o.barcode,
      category: String(o.category || o.overheadItemName || 'General Overhead'),
      costType: o.costType || 'Fixed',
      unitType: o.unitType || 'month',
      allocationMethod: method,
      allocationType: method === 'fixed_amount' ? 'fixed' : 'percentage',
      allocationBase: allocBase,
      baseAmount,
      allocationRate: rate,
      ratePct: round2(rate),
      unitQuantity: unitQty,
      allocatedAmount,
      effectiveDate: o.effectiveDate || new Date().toISOString().slice(0, 10),
      allocatedBy: o.allocatedBy || 'System',
      notes: o.notes || ''
    };
  });

  const standardOverheads: ProjectPlanOverheadAllocation[] = [
    {
      id: `ovh-std-overhead-${input.planId || 'plan'}`,
      planId: input.planId || '',
      projectId: input.projectId || '',
      category: 'General Overhead',
      allocationMethod: 'percentage_of_cost_base',
      allocationType: 'percentage',
      allocationBase: 'total_direct_cost',
      allocationRate: overheadPct,
      ratePct: overheadPct,
      unitQuantity: 1,
      baseAmount: effectiveDirectBase,
      allocatedAmount: overheadAmount,
      effectiveDate: new Date().toISOString().slice(0, 10),
      allocatedBy: 'System',
      notes: 'Standard corporate & administrative overhead allocation'
    },
    {
      id: `ovh-std-contingency-${input.planId || 'plan'}`,
      planId: input.planId || '',
      projectId: input.projectId || '',
      category: 'Contingency Reserve',
      allocationMethod: 'percentage_of_cost_base',
      allocationType: 'percentage',
      allocationBase: 'total_direct_cost',
      allocationRate: contingencyPct,
      ratePct: contingencyPct,
      unitQuantity: 1,
      baseAmount: effectiveDirectBase,
      allocatedAmount: contingencyAmount,
      effectiveDate: new Date().toISOString().slice(0, 10),
      allocatedBy: 'System',
      notes: 'Risk & price escalation contingency reserve'
    }
  ];

  if (laborBurdenPct > 0 || laborBurdenAmount > 0) {
    standardOverheads.push({
      id: `ovh-std-burden-${input.planId || 'plan'}`,
      planId: input.planId || '',
      projectId: input.projectId || '',
      category: 'Labor Burden',
      allocationMethod: 'percentage_of_cost_base',
      allocationType: 'percentage',
      allocationBase: 'total_direct_cost',
      allocationRate: laborBurdenPct,
      ratePct: laborBurdenPct,
      unitQuantity: 1,
      baseAmount: directCost,
      allocatedAmount: laborBurdenAmount,
      effectiveDate: new Date().toISOString().slice(0, 10),
      allocatedBy: 'System',
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
