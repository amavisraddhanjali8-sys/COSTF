/**
 * Unified Project Plan Financial Calculation and Cost Control Service (TASK 11)
 *
 * Single authoritative calculation service across backend (PostgreSQL) and frontend.
 * Defines standard commercial financial metrics, prevents double-counting, enforces
 * decimal-safe BigInt arithmetic (via decimalMath.ts), and provides zero-division safety.
 *
 * FINANCIAL METRICS DEFINITIONS & FORMULAS:
 * 1. Direct Costs:
 *    - Direct Material Costs: Sum of material, produce, and hardware lines.
 *    - Subcontractor Costs: Sum of subcontractor trade rates & external contract trades.
 *    - Outsourced Service Costs: Sum of third-party logistics, inspection, and utility contracts.
 *    - Direct Labour Costs: Sum of in-house team member allocated hours * hourly rate.
 *    - Other Direct Costs: Direct equipment rentals, site plant, and specialized direct expenses.
 *    - Total Direct Cost = Material + Subcontractor + Outsourced + Labour + Other Direct.
 *      (Strict rule: No double-counting between direct cost categories or into overhead).
 *
 * 2. Allocated Overhead:
 *    - Calculated strictly according to configured allocation method:
 *      * fixed_amount: Fixed monetary sum (e.g., LKR 10,000).
 *      * rate_per_unit: rate * unitQuantity.
 *      * percentage_of_cost_base / proportional_defined_base: baseAmount * (allocationRate / 100).
 *      * Standard statutory burden, corporate overhead, and contingency when configured.
 *
 * 3. Total Planned Cost:
 *    - Total Planned Cost = Total Direct Cost + Allocated Overhead.
 *
 * 4. Revenue & Profits:
 *    - Total Planned Revenue = Sum of BOQ line revenues (quantity * rate * (1 - discountPct / 100))
 *      or explicit project plan revenue.
 *    - Gross Profit = Total Planned Revenue - Total Direct Cost.
 *    - Gross Profit Margin (%) = (Gross Profit / Total Planned Revenue) * 100.
 *    - Planned Profit (Operating / Net Planned Profit) = Total Planned Revenue - Total Planned Cost.
 *    - Planned Profit Margin (%) = (Planned Profit / Total Planned Revenue) * 100.
 *      (Strict rule: If revenue <= 0, Profit Margin is 0% / N/A without division-by-zero).
 *
 * 5. Markup (Strictly distinguished from Margin):
 *    - Profit Margin = Profit / Revenue * 100.
 *    - Total Cost Markup (%) = Profit / Total Planned Cost * 100.
 *    - Direct Cost Markup (%) = Gross Profit / Total Direct Cost * 100.
 *      (Strict rule: If Cost == 0, markup is 0% if profit == 0, else 100% or pure-margin).
 *
 * 6. Budgets & Variance:
 *    - Budget Variance = Total Planned Budget - Total Planned Cost (positive = under budget).
 *    - Actual vs Planned Cost = Comparison of incurred cost against planned budget.
 *    - Remaining Budget = Total Planned Budget - Actual Cost.
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
import { convertCurrency } from './currency';

export interface PlanCalculationInput {
  planId?: string;
  projectId?: string;
  currency?: string;
  plannedRevenue?: number;
  projectQuotedPrice?: number;
  targetMarginPct?: number;
  overheadPct?: number;
  contingencyPct?: number;
  laborBurdenPct?: number;
  directCost?: number;
  allocatedOverhead?: number;
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

/**
 * 1. BOQ Line Total Cost calculation:
 * subtotal = quantity * unitCost
 * discountAmount = subtotal * (discountPct / 100)
 * totalCost = subtotal - discountAmount (ROUND_HALF_UP 2 decimal places)
 */
export function calculateBoqLineTotal(
  quantity: number | string | null | undefined,
  unitCost: number | string | null | undefined,
  discountPct: number | string | null | undefined = 0
): { subtotal: number; discountAmount: number; totalCost: number } {
  const safeQty = Math.max(0, round4(quantity));
  const safeUnitCost = Math.max(0, round4(unitCost));
  const safeDisc = Math.max(0, Math.min(100, round2(discountPct)));
  const { subtotal, discountAmount, totalAmount } = calcDiscountedLine(safeQty, safeUnitCost, safeDisc);
  return {
    subtotal: round2(subtotal),
    discountAmount: round2(discountAmount),
    totalCost: round2(totalAmount)
  };
}

/**
 * 2. BOQ Line Total Revenue calculation:
 * lineRevenue = quantity * rate * (1 - discountPct / 100)
 */
export function calculateBoqLineRevenue(
  quantity: number | string | null | undefined,
  rate: number | string | null | undefined,
  discountPct: number | string | null | undefined = 0
): number {
  const safeQty = Math.max(0, round4(quantity));
  const safeRate = Math.max(0, round4(rate));
  const safeDisc = Math.max(0, Math.min(100, round2(discountPct)));
  const discountedRate = round4(decMul(safeRate, decSub(1, decDiv(safeDisc, 100))));
  return round2(decMul(safeQty, discountedRate));
}

/**
 * 3. Gross Profit calculation:
 * Gross Profit = Planned Revenue - Direct Cost
 */
export function calculateGrossProfit(
  revenue: number | string | null | undefined,
  directCost: number | string | null | undefined
): number {
  return round2(decSub(round2(revenue), round2(directCost)));
}

/**
 * 4. Gross Profit Margin (%):
 * Gross Margin % = (Gross Profit / Planned Revenue) * 100
 * Division-by-zero rule: If revenue <= 0, returns 0.
 */
export function calculateGrossMarginPct(
  grossProfit: number | string | null | undefined,
  revenue: number | string | null | undefined
): number {
  const rev = round2(revenue);
  if (rev <= 0) return 0;
  return round2(decDiv(decMul(round2(grossProfit), 100), rev));
}

/**
 * 5. Planned / Net Profit calculation:
 * Planned Profit = Planned Revenue - Total Planned Cost
 */
export function calculateNetProfit(
  revenue: number | string | null | undefined,
  totalPlannedCost: number | string | null | undefined
): number {
  return round2(decSub(round2(revenue), round2(totalPlannedCost)));
}

/**
 * 6. Profit Margin (%):
 * Profit Margin % = (Profit / Revenue) * 100
 * Division-by-zero rule: If revenue <= 0, returns 0.
 * NOTE: Strictly distinguished from Markup.
 */
export function calculateProfitMarginPct(
  profit: number | string | null | undefined,
  revenue: number | string | null | undefined
): number {
  const rev = round2(revenue);
  if (rev <= 0) return 0;
  return round2(decDiv(decMul(round2(profit), 100), rev));
}

/**
 * 7. Markup on Total Cost (%):
 * Markup % = (Profit / Total Cost) * 100
 * Division-by-zero business rule:
 * - If cost <= 0 and profit <= 0 => 0%
 * - If cost <= 0 and profit > 0 => 100% (pure profit)
 * NOTE: Strictly distinguished from Margin.
 */
export function calculateMarkupPct(
  profit: number | string | null | undefined,
  totalCost: number | string | null | undefined
): number {
  const cost = round2(totalCost);
  const p = round2(profit);
  if (cost <= 0) {
    return p > 0 ? 100 : 0;
  }
  return round2(decDiv(decMul(p, 100), cost));
}

/**
 * 8. Direct Cost Markup (%):
 * Direct Cost Markup % = (Gross Profit / Total Direct Cost) * 100
 */
export function calculateDirectCostMarkupPct(
  grossProfit: number | string | null | undefined,
  directCost: number | string | null | undefined
): number {
  const cost = round2(directCost);
  const p = round2(grossProfit);
  if (cost <= 0) {
    return p > 0 ? 100 : 0;
  }
  return round2(decDiv(decMul(p, 100), cost));
}

/**
 * 9. Overhead Allocation calculation by configured method:
 * - fixed_amount: returns allocatedAmount or rate
 * - rate_per_unit: rate * unitQuantity
 * - percentage_of_cost_base / proportional_defined_base: baseAmount * (rate / 100)
 */
export function calculateOverheadAllocation(
  method: 'fixed_amount' | 'rate_per_unit' | 'percentage_of_cost_base' | 'proportional_defined_base' | string,
  rate: number | string | null | undefined,
  baseAmount: number | string | null | undefined,
  unitQuantity: number | string | null | undefined = 1,
  explicitAllocatedAmount?: number | string | null | undefined
): number {
  const safeRate = Math.max(0, round4(rate));
  const safeBase = Math.max(0, round2(baseAmount));
  const safeQty = Math.max(0, round4(unitQuantity));

  if (method === 'fixed_amount' || method === 'fixed') {
    if (explicitAllocatedAmount !== undefined && explicitAllocatedAmount !== null && Number(explicitAllocatedAmount) > 0) {
      return round2(Number(explicitAllocatedAmount));
    }
    return round2(safeRate > 0 ? safeRate : Number(explicitAllocatedAmount || 0));
  }
  if (method === 'rate_per_unit') {
    return round2(decMul(safeRate, safeQty));
  }
  // percentage_of_cost_base or proportional_defined_base
  return round2(decDiv(decMul(safeBase, safeRate), 100));
}

/**
 * 10. Budget Variance:
 * Budget Variance = Planned Budget - Actual / Planned Cost
 * (Positive = Under Budget, Negative = Over Budget)
 */
export function calculateBudgetVariance(
  budget: number | string | null | undefined,
  cost: number | string | null | undefined
): number {
  return round2(decSub(round2(budget), round2(cost)));
}

export function calculateBudgetVariancePct(
  variance: number | string | null | undefined,
  budget: number | string | null | undefined
): number {
  const b = round2(budget);
  if (b <= 0) return 0;
  return round2(decDiv(decMul(round2(variance), 100), b));
}

export function calculateRemainingBudget(
  budget: number | string | null | undefined,
  actualCost: number | string | null | undefined
): number {
  return round2(decSub(round2(budget), round2(actualCost)));
}

/**
 * Authoritative plan calculation function.
 */
export function calculatePlanFinancials(input: PlanCalculationInput): NormalizedPlanCalculationResult {
  const rawItems = Array.isArray(input.boqItems) ? input.boqItems : [];
  const rawResources = Array.isArray(input.resources) ? input.resources : [];
  const rawSections = Array.isArray(input.sections) ? input.sections : [];
  const rawOverheads = Array.isArray(input.overheadAllocations) ? input.overheadAllocations : [];

  let materialCost = 0;
  let subcontractorCost = 0;
  let outsourcedCost = 0;
  let otherDirectCost = 0;
  let itemsBilledRevenue = 0;

  // 1. Process BOQ Line Items
  const normalizedBoqItems: ProjectPlanBoqItem[] = rawItems.map((it, idx) => {
    const qty = Math.max(0, round4(it.quantity ?? 1));
    const targetCurrency = input.currency;
    const itemCurrency = it.currency || (it as any).originalCurrency;
    let baseUnitCost = Math.max(0, round4(it.unitCost ?? (it as any).unit_cost ?? 0));
    if (targetCurrency && itemCurrency && targetCurrency.toUpperCase() !== itemCurrency.toUpperCase()) {
      baseUnitCost = round4(convertCurrency(baseUnitCost, itemCurrency, targetCurrency));
    }
    const unitCost = baseUnitCost;
    const discountPct = Math.max(0, Math.min(100, round2(it.discountPct ?? (it as any).discount_pct ?? 0)));
    const { totalAmount } = calcDiscountedLine(qty, unitCost, discountPct);
    const lineCost = (it as any).total_cost !== undefined && Number((it as any).total_cost) > 0 && !(targetCurrency && itemCurrency && targetCurrency.toUpperCase() !== itemCurrency.toUpperCase())
      ? round2((it as any).total_cost)
      : round2(totalAmount);

    const markupPct = round2(it.markupPct ?? (it as any).markup_pct ?? 30);
    const explicitRate = it.rate !== undefined && Number(it.rate) > 0
      ? round4(it.rate)
      : it.sellingRate !== undefined && Number(it.sellingRate) > 0
      ? round4(it.sellingRate)
      : it.billableRate !== undefined && Number(it.billableRate) > 0
      ? round4(it.billableRate)
      : (it as any).billable_rate !== undefined && Number((it as any).billable_rate) > 0
      ? round4((it as any).billable_rate)
      : round4(decMul(unitCost, decAdd(1, decDiv(markupPct, 100))));

    const billableRate = explicitRate;
    const rate = explicitRate;

    // Line revenue: qty * rate discounted by discountPct
    const calcLineRevenue = round2(decMul(qty, decMul(rate, decSub(1, decDiv(discountPct, 100)))));
    const totalRevenue = it.totalRevenue !== undefined && Number(it.totalRevenue) > 0
      ? round2(it.totalRevenue)
      : (it as any).total_revenue !== undefined && Number((it as any).total_revenue) > 0
      ? round2((it as any).total_revenue)
      : calcLineRevenue;
    const grossProfit = round2(decSub(totalRevenue, lineCost));

    const itemTypeRaw = String(it.type || (it as any).item_type || 'material').toLowerCase();
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

    // Categorize direct costs without double counting
    if (itemType === 'subcontractor') {
      subcontractorCost = round2(decAdd(subcontractorCost, lineCost));
    } else if (itemType === 'outsourced') {
      outsourcedCost = round2(decAdd(outsourcedCost, lineCost));
    } else if (itemType === 'equipment' || itemType === 'other') {
      otherDirectCost = round2(decAdd(otherDirectCost, lineCost));
    } else {
      materialCost = round2(decAdd(materialCost, lineCost));
    }

    itemsBilledRevenue = round2(decAdd(itemsBilledRevenue, totalRevenue));

    return {
      id: it.id || `boq-${Date.now()}-${idx}`,
      planId: input.planId,
      projectId: input.projectId,
      sectionId: it.sectionId || (it as any).section_id,
      phaseId: it.phaseId || (it as any).phase_id || 'phase-01',
      type: itemType,
      itemId: it.itemId || it.itemCode || (it as any).catalog_item_id || (it as any).item_code || `ITM-${idx + 1}`,
      itemCode: it.itemCode || it.itemId || (it as any).item_code || (it as any).catalog_item_id || `ITM-${idx + 1}`,
      revenueItemId: (it as any).revenueItemId || (it as any).revenue_item_id || undefined,
      name: String(it.name || 'Line Item').trim(),
      category: it.category || '',
      subCategory: (it as any).subCategory || (it as any).sub_category || '',
      supplierOrProvider: it.supplierOrProvider || (it as any).supplier_or_provider || 'Approved Vendor',
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
      taxTreatment: (it as any).taxTreatment || (it as any).tax_treatment || 'Standard (0%)',
      taxRatePct: round2((it as any).taxRatePct ?? (it as any).tax_rate_pct ?? 0),
      taxAmount: round2((it as any).taxAmount ?? (it as any).tax_amount ?? 0),
      totalRevenue,
      grossProfit,
      currency: it.currency || 'USD',
      nativeUnitCost: it.nativeUnitCost !== undefined ? round4(it.nativeUnitCost) : (it as any).native_unit_cost !== undefined ? round4((it as any).native_unit_cost) : unitCost,
      consumptionRate: it.consumptionRate !== undefined ? round2(it.consumptionRate) : (it as any).consumption_rate !== undefined ? round2((it as any).consumption_rate) : 100,
      notes: it.notes || '',
      lineOrder: it.lineOrder !== undefined ? Number(it.lineOrder) : (it as any).line_order !== undefined ? Number((it as any).line_order) : idx + 1,
      snapshotData: (it as any).snapshotData || (it as any).snapshot_data || undefined,
      commercialContext: (it as any).commercialContext || (it as any).commercial_context || undefined
    };
  });

  // 2. Process Assigned Resources (Direct Labour, Subcontractor, Equipment)
  let resourceCost = 0;
  let labourCost = 0;
  const normalizedResources: ProjectPlanResource[] = rawResources.map((r, idx) => {
    const allocatedHours = Math.max(0, round2(r.allocatedHours ?? (r as any).allocated_hours ?? 0));
    const hourlyRate = Math.max(0, round4(r.hourlyRate ?? (r as any).hourly_rate ?? 0));
    const totalCost = r.totalCost !== undefined && Number(r.totalCost) > 0
      ? round2(r.totalCost)
      : (r as any).total_cost !== undefined && Number((r as any).total_cost) > 0
      ? round2((r as any).total_cost)
      : round2(decMul(allocatedHours, hourlyRate));

    const rawRType = String(r.resourceType || (r as any).resource_type || '').toLowerCase();
    const rType = (rawRType === 'team_member' || rawRType === 'labour' || rawRType === 'labor')
      ? 'team_member'
      : (rawRType === 'equipment' || rawRType === 'machinery' || rawRType === 'tools' || rawRType === 'tool')
      ? 'equipment'
      : (rawRType === 'material' || rawRType === 'materials')
      ? 'material'
      : 'subcontractor';

    if (rType === 'team_member') {
      labourCost = round2(decAdd(labourCost, totalCost));
    } else if (rType === 'equipment') {
      otherDirectCost = round2(decAdd(otherDirectCost, totalCost));
    } else if (rType === 'material') {
      materialCost = round2(decAdd(materialCost, totalCost));
    } else {
      subcontractorCost = round2(decAdd(subcontractorCost, totalCost));
    }

    resourceCost = round2(decAdd(resourceCost, totalCost));

    return {
      id: r.id || `res-${Date.now()}-${idx}`,
      planId: input.planId,
      projectId: input.projectId,
      sectionId: r.sectionId || (r as any).section_id,
      resourceId: r.resourceId || (r as any).resource_id || `R-${idx + 1}`,
      resourceType: rType,
      name: String(r.name || 'Assigned Resource').trim(),
      roleOrTrade: r.roleOrTrade || (r as any).role_or_trade || 'Specialist',
      allocatedHours,
      hourlyRate,
      totalCost,
      startDate: r.startDate || (r as any).start_date_iso || (r as any).start_date,
      endDate: r.endDate || (r as any).end_date_iso || (r as any).end_date,
      notes: r.notes || ''
    };
  });

  // Total Direct Cost (Prevent double counting)
  let directCost = round2(decAdd(decAdd(decAdd(materialCost, subcontractorCost), outsourcedCost), decAdd(otherDirectCost, labourCost)));
  if (directCost === 0 && (input.directCost !== undefined || (input as any).direct_cost !== undefined)) {
    directCost = Math.max(0, round2(Number(input.directCost ?? (input as any).direct_cost ?? 0)));
    materialCost = directCost;
  }

  const overheadPct = round2(input.overheadPct ?? 8.5);
  const contingencyPct = round2(input.contingencyPct ?? 5.0);
  const laborBurdenPct = round2(input.laborBurdenPct ?? 0);
  const targetMarginPct = Math.min(90, Math.max(0, round2(input.targetMarginPct ?? 25)));

  const laborBurdenAmount = round2(decDiv(decMul(directCost, laborBurdenPct), 100));
  const effectiveDirectBase = round2(decAdd(directCost, laborBurdenAmount));
  const overheadAmount = round2(decDiv(decMul(effectiveDirectBase, overheadPct), 100));
  const contingencyAmount = round2(decDiv(decMul(effectiveDirectBase, contingencyPct), 100));

  // 3. Process Overhead Allocations
  const customOverheads = rawOverheads.filter(
    (o: any) =>
      o &&
      (o.category || o.overheadItemName || o.overheadItemId || o.overhead_item_name || o.overhead_item_id || o.allocatedAmount !== undefined || o.allocated_amount !== undefined)
  );

  let extraOverheadAmount = 0;
  const normalizedCustomOverheads: ProjectPlanOverheadAllocation[] = customOverheads.map((o: any, idx) => {
    const rawMethod = String(
      o.allocationMethod || o.allocation_method ||
      (o.allocationType === 'fixed' || o.allocation_type === 'fixed' ? 'fixed_amount' : 'percentage_of_cost_base')
    );
    const method: ProjectPlanOverheadAllocation['allocationMethod'] =
      rawMethod === 'rate_per_unit'
        ? 'rate_per_unit'
        : rawMethod === 'fixed_amount' || rawMethod === 'fixed'
        ? 'fixed_amount'
        : rawMethod === 'proportional_defined_base'
        ? 'proportional_defined_base'
        : 'percentage_of_cost_base';

    const allocBase: ProjectPlanOverheadAllocation['allocationBase'] =
      (o.allocationBase || (o as any).allocation_base) || 'total_direct_cost';
    const rate = round4(Number(o.allocationRate ?? (o as any).allocation_rate ?? o.ratePct ?? (o as any).rate_pct ?? 0));
    const unitQty = Math.max(0, round4(Number(o.unitQuantity ?? (o as any).unit_quantity ?? 1)));

    // Determine relevant base dynamically based on allocation base
    let baseAmount = round2(Number(o.baseAmount ?? (o as any).base_amount ?? 0));
    if (allocBase === 'material_cost') {
      baseAmount = materialCost;
    } else if (allocBase === 'subcontractor_cost') {
      baseAmount = subcontractorCost;
    } else if (allocBase === 'outsourced_cost') {
      baseAmount = outsourcedCost;
    } else if (allocBase === 'labor_cost') {
      baseAmount = round2(decAdd(labourCost, laborBurdenAmount));
    } else if (allocBase === 'planned_revenue') {
      baseAmount = round2(input.plannedRevenue ?? input.projectQuotedPrice ?? 0);
    } else if (allocBase === 'total_direct_cost') {
      baseAmount = effectiveDirectBase;
    } else if (baseAmount <= 0) {
      baseAmount = effectiveDirectBase;
    }

    let allocatedAmount = 0;
    const existingAlloc = o.allocatedAmount !== undefined ? o.allocatedAmount : (o as any).allocated_amount;
    if (method === 'fixed_amount') {
      allocatedAmount = round2(existingAlloc !== undefined && Number(existingAlloc) > 0 ? Number(existingAlloc) : (rate > 0 ? rate : Number(existingAlloc || 0)));
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
      overheadItemId: o.overheadItemId || (o as any).overhead_item_id,
      overheadItemCode: o.overheadItemCode || (o as any).overhead_item_code,
      overheadItemName: o.overheadItemName || (o as any).overhead_item_name,
      barcode: o.barcode,
      category: String(o.category || o.overheadItemName || (o as any).overhead_item_name || 'General Overhead'),
      costType: o.costType || (o as any).cost_type || 'Fixed',
      unitType: o.unitType || (o as any).unit_type || 'month',
      allocationMethod: method,
      allocationType: method === 'fixed_amount' ? 'fixed' : 'percentage',
      allocationBase: allocBase,
      baseAmount,
      allocationRate: rate,
      ratePct: round2(rate),
      unitQuantity: unitQty,
      allocatedAmount,
      effectiveDate: o.effectiveDate || (o as any).effective_date_iso || (o as any).effective_date || new Date().toISOString().slice(0, 10),
      allocatedBy: o.allocatedBy || (o as any).allocated_by || 'System',
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

  const hasCustomOverheads = normalizedCustomOverheads.length > 0;
  const isExplicitAllocatedOverhead =
    (input.allocatedOverhead !== undefined && input.allocatedOverhead !== null && Number(input.allocatedOverhead) >= 0) ||
    ((input as any).allocated_overhead !== undefined && (input as any).allocated_overhead !== null && Number((input as any).allocated_overhead) >= 0);
  const isExplicitEmptyOverheads = Array.isArray(input.overheadAllocations) && input.overheadAllocations.length === 0 && !isExplicitAllocatedOverhead;

  let allocatedOverhead = 0;
  let normalizedOverheadAllocations: ProjectPlanOverheadAllocation[] = [];

  if (hasCustomOverheads) {
    allocatedOverhead = round2(decAdd(extraOverheadAmount, laborBurdenAmount));
    normalizedOverheadAllocations = normalizedCustomOverheads;
  } else if (isExplicitAllocatedOverhead) {
    allocatedOverhead = round2(Number(input.allocatedOverhead ?? (input as any).allocated_overhead));
    normalizedOverheadAllocations = [
      {
        id: `ovh-fixed-${input.planId || 'plan'}`,
        planId: input.planId || '',
        projectId: input.projectId || '',
        category: 'Allocated Overhead',
        allocationMethod: 'fixed_amount',
        allocationType: 'fixed',
        allocationBase: 'total_direct_cost',
        allocationRate: allocatedOverhead,
        ratePct: 0,
        unitQuantity: 1,
        baseAmount: directCost,
        allocatedAmount: allocatedOverhead,
        effectiveDate: new Date().toISOString().slice(0, 10),
        allocatedBy: 'System',
        notes: 'Direct allocated overhead'
      }
    ];
  } else if (isExplicitEmptyOverheads) {
    allocatedOverhead = 0;
    normalizedOverheadAllocations = [];
  } else {
    allocatedOverhead = round2(decAdd(decAdd(overheadAmount, contingencyAmount), laborBurdenAmount));
    normalizedOverheadAllocations = standardOverheads;
  }

  const totalPlannedCost = round2(decAdd(directCost, allocatedOverhead));

  // 4. Determine Planned Revenue
  let plannedRevenue = round2(input.plannedRevenue ?? (input as any).planned_revenue ?? 0);
  if (plannedRevenue <= 0 && itemsBilledRevenue > 0) {
    plannedRevenue = round2(itemsBilledRevenue);
  }
  if (plannedRevenue <= 0 && (input.projectQuotedPrice ?? 0) > 0) {
    plannedRevenue = round2(input.projectQuotedPrice);
  }
  if (plannedRevenue <= 0 && totalPlannedCost > 0 && targetMarginPct > 0 && targetMarginPct < 95) {
    plannedRevenue = round2(decDiv(totalPlannedCost, decSub(1, decDiv(targetMarginPct, 100))));
  }

  // 5. Calculate Gross Profit & Margin
  const grossProfit = calculateGrossProfit(plannedRevenue, directCost);
  const grossMarginPct = calculateGrossMarginPct(grossProfit, plannedRevenue);

  // 6. Calculate Planned Profit after Overhead & Profit Margin
  // Strictly defined: Profit Margin = Profit / Revenue * 100
  const plannedProfit = calculateNetProfit(plannedRevenue, totalPlannedCost);
  const profitMarginPct = calculateProfitMarginPct(plannedProfit, plannedRevenue);

  // 7. Calculate Markups (Strictly distinguished from Profit Margin)
  // Total Cost Markup (%) = Planned Profit / Total Planned Cost * 100
  const markupPct = calculateMarkupPct(plannedProfit, totalPlannedCost);

  // Direct Cost Markup (%) = Gross Profit / Total Direct Cost * 100
  const directCostMarkupPct = calculateDirectCostMarkupPct(grossProfit, directCost);

  // 8. Sections Planned Budget & Actual Cost
  let totalBudget = 0;
  let actualCost = 0;
  for (const s of rawSections) {
    totalBudget = round2(decAdd(totalBudget, Number(s.plannedBudget ?? (s as any).budget ?? 0)));
    actualCost = round2(decAdd(actualCost, Number(s.actualCost ?? (s as any).actual_cost ?? 0)));
  }
  const budgetVariance = round2(decSub(totalBudget, totalPlannedCost));
  const budgetVariancePct = totalBudget > 0 ? round2(decDiv(decMul(budgetVariance, 100), totalBudget)) : 0;
  const remainingBudget = round2(decSub(totalBudget, actualCost));

  const summary: ProjectPlanCostSummary = {
    planId: input.planId,
    projectId: input.projectId,
    plannedRevenue,
    materialCost,
    labourCost,
    subcontractorCost,
    outsourcedCost,
    otherDirectCost,
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
    netPlannedProfit: plannedProfit,
    plannedProfit,
    profitMarginPct,
    markupPct,
    directCostMarkupPct,
    totalBudget,
    budgetVariance,
    budgetVariancePct,
    actualCost,
    remainingBudget,
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
