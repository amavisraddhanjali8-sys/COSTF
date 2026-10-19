#!/usr/bin/env python3
"""
Python Analytics Engine for Cost & Project Profitability Management System.
Uses decimal.Decimal with ROUND_HALF_UP for exact commercial financial calculations.
"""
import sys
import json
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation

TWO_PLACES = Decimal('0.01')
ONE_PLACE = Decimal('0.1')
HUNDRED = Decimal('100')
ZERO = Decimal('0')


def to_dec(val, default='0'):
    if val is None or val == '':
        return Decimal(default)
    try:
        return Decimal(str(val))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal(default)


def r2(val: Decimal) -> float:
    return float(val.quantize(TWO_PLACES, rounding=ROUND_HALF_UP))


def r1(val: Decimal) -> float:
    return float(val.quantize(ONE_PLACE, rounding=ROUND_HALF_UP))


def calculate_project_profitability(project_data):
    """
    Computes comprehensive decimal-safe financial metrics for a project:
    - Materials Cost
    - Subcontractor Labour & Services Cost
    - Outsourced Services Cost
    - Total Direct Cost & Total Project Cost (with Overhead & Contingency)
    - Phase-by-phase Budget vs Actuals & Variance
    - Gross Profit & Gross Margin %
    - Net Profit & Net Margin %
    - Profitability Health Score (5.0 - 100.0)
    """
    revenue = to_dec(project_data.get('quotedPrice', 0))
    phases = project_data.get('phases', []) or []
    items = project_data.get('selectedItems', []) or []

    material_cost = ZERO
    subcontractor_cost = ZERO
    outsourced_cost = ZERO

    for item in items:
        explicit_total = to_dec(item.get('totalCost', 0))
        if explicit_total > ZERO:
            discounted_cost = explicit_total.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        else:
            unit_cost = to_dec(item.get('unitCost', 0))
            quantity = to_dec(item.get('quantity', 1), '1')
            discount_pct = to_dec(item.get('discountPct', 0))
            subtotal = (unit_cost * quantity).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
            discount_amt = (subtotal * discount_pct / HUNDRED).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
            discounted_cost = max(ZERO, subtotal - discount_amt)

        item_type = item.get('type', 'material')
        if item_type == 'material':
            material_cost += discounted_cost
        elif item_type == 'subcontractor':
            subcontractor_cost += discounted_cost
        elif item_type == 'outsourced':
            outsourced_cost += discounted_cost
        else:
            material_cost += discounted_cost

    total_direct_cost = (material_cost + subcontractor_cost + outsourced_cost).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
    overhead_pct = to_dec(project_data.get('overheadPct', '8.5'), '8.5')
    contingency_pct = to_dec(project_data.get('contingencyPct', '5.0'), '5.0')

    overhead_amount = (total_direct_cost * (overhead_pct / HUNDRED)).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
    contingency_amount = (total_direct_cost * (contingency_pct / HUNDRED)).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
    total_project_cost = (total_direct_cost + overhead_amount + contingency_amount).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)

    gross_profit = (revenue - total_direct_cost).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
    gross_margin_pct = ((gross_profit * HUNDRED) / revenue).quantize(TWO_PLACES, rounding=ROUND_HALF_UP) if revenue > ZERO else ZERO

    net_profit = (revenue - total_project_cost).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
    net_margin_pct = ((net_profit * HUNDRED) / revenue).quantize(TWO_PLACES, rounding=ROUND_HALF_UP) if revenue > ZERO else ZERO

    phase_metrics = []
    total_planned_budget = ZERO
    for phase in phases:
        planned = to_dec(phase.get('budget', 0)).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        actual = to_dec(phase.get('actualCost', 0)).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        total_planned_budget += planned
        variance = (planned - actual).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        variance_pct = ((variance * HUNDRED) / planned).quantize(TWO_PLACES, rounding=ROUND_HALF_UP) if planned > ZERO else ZERO
        phase_metrics.append({
            'phaseId': phase.get('id'),
            'phaseName': phase.get('name'),
            'plannedBudget': r2(planned),
            'actualCost': r2(actual),
            'variance': r2(variance),
            'variancePct': r2(variance_pct),
            'status': 'Under Budget' if variance >= ZERO else 'Over Budget'
        })

    budget_variance = (total_planned_budget - total_project_cost).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
    budget_variance_pct = ((budget_variance * HUNDRED) / total_planned_budget).quantize(TWO_PLACES, rounding=ROUND_HALF_UP) if total_planned_budget > ZERO else ZERO

    health_score = Decimal('100.0')
    if net_margin_pct < Decimal('10'):
        health_score -= Decimal('30')
    elif net_margin_pct < Decimal('20'):
        health_score -= Decimal('10')

    if budget_variance < ZERO:
        penalty = min(Decimal('35'), abs(budget_variance_pct) * Decimal('2'))
        health_score -= penalty

    health_score = max(Decimal('5.0'), min(Decimal('100.0'), health_score))

    mat_inflation_impact = (material_cost * Decimal('0.05')).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
    labour_hike_impact = (subcontractor_cost * Decimal('0.08')).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)

    sensitivity = {
        'materialInflation5Pct': {
            'costImpact': r2(mat_inflation_impact),
            'revisedNetMarginPct': r2(((net_profit - mat_inflation_impact) * HUNDRED) / revenue) if revenue > ZERO else 0.0
        },
        'labourRateHike8Pct': {
            'costImpact': r2(labour_hike_impact),
            'revisedNetMarginPct': r2(((net_profit - labour_hike_impact) * HUNDRED) / revenue) if revenue > ZERO else 0.0
        }
    }

    overhead_plus_contingency = overhead_amount + contingency_amount

    return {
        'revenue': r2(revenue),
        'materialCost': r2(material_cost),
        'subcontractorCost': r2(subcontractor_cost),
        'outsourcedCost': r2(outsourced_cost),
        'totalDirectCost': r2(total_direct_cost),
        'overheadAmount': r2(overhead_amount),
        'contingencyAmount': r2(contingency_amount),
        'totalProjectCost': r2(total_project_cost),
        'grossProfit': r2(gross_profit),
        'grossMarginPct': r2(gross_margin_pct),
        'netProfit': r2(net_profit),
        'netMarginPct': r2(net_margin_pct),
        'totalPlannedBudget': r2(total_planned_budget),
        'budgetVariance': r2(budget_variance),
        'budgetVariancePct': r2(budget_variance_pct),
        'healthScore': r1(health_score),
        'phaseMetrics': phase_metrics,
        'sensitivity': sensitivity,
        'costDistribution': [
            {
                'category': 'Materials',
                'amount': r2(material_cost),
                'pct': r1((material_cost * HUNDRED) / total_direct_cost) if total_direct_cost > ZERO else 0.0
            },
            {
                'category': 'Subcontractor Labour',
                'amount': r2(subcontractor_cost),
                'pct': r1((subcontractor_cost * HUNDRED) / total_direct_cost) if total_direct_cost > ZERO else 0.0
            },
            {
                'category': 'Outsourced Services',
                'amount': r2(outsourced_cost),
                'pct': r1((outsourced_cost * HUNDRED) / total_direct_cost) if total_direct_cost > ZERO else 0.0
            },
            {
                'category': 'Overheads & Contingency',
                'amount': r2(overhead_plus_contingency),
                'pct': r1((overhead_plus_contingency * HUNDRED) / total_project_cost) if total_project_cost > ZERO else 0.0
            }
        ]
    }


def main():
    if len(sys.argv) > 1:
        raw_input = sys.argv[1]
    else:
        raw_input = sys.stdin.read()

    try:
        data = json.loads(raw_input)
        results = calculate_project_profitability(data)
        print(json.dumps(results, indent=2))
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
