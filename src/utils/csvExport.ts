/**
 * Universal CSV Export Utility for Portals, Grids, Categories, Items, and Price Histories
 */

import {
  MaterialItem,
  ProduceItem,
  Supplier,
  SubcontractorRateItem,
  OutsourcedService,
  InventoryItem,
  Project,
  PriceHistoryRecord,
  InventoryTransaction,
  OverheadItem,
  RevenueItem,
  Tariff,
  EnterpriseResource
} from '../types';

/**
 * Clean and escape string for CSV format
 */
function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Triggers browser download of a CSV file
 */
export function downloadCSV(filename: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]): void {
  const csvRows: string[] = [];
  csvRows.push(headers.map(escapeCSV).join(','));

  for (const row of rows) {
    csvRows.push(row.map(escapeCSV).join(','));
  }

  const csvContent = '\uFEFF' + csvRows.join('\r\n'); // BOM for Excel UTF-8 compatibility
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ----------------------------------------------------
// 1. MATERIALS EXPORT
// ----------------------------------------------------
export function exportMaterialsToCSV(materials: MaterialItem[], categoryFilter?: string): void {
  const filtered = categoryFilter && categoryFilter !== 'all'
    ? materials.filter(m => m.category.toLowerCase() === categoryFilter.toLowerCase())
    : materials;

  const headers = [
    'Item Code',
    'Item Name',
    'Category',
    'SubCategory',
    'More SubCategory',
    'Classification',
    'Supplier Name',
    'Retail Price',
    'Unit',
    'Default Discount %',
    'In Stock',
    'Reorder Point',
    'Lead Time Days',
    'Last Updated',
    'Price Revisions Count'
  ];

  const rows = filtered.map(m => [
    m.code,
    m.name,
    m.category,
    m.subCategory,
    m.moreSubCategory || '',
    m.itemClassification || 'raw_material',
    m.supplierName,
    m.retailPrice,
    m.unit,
    m.defaultDiscountPct || 0,
    m.inStock,
    m.reorderPoint,
    m.leadTimeDays,
    m.lastUpdated || '',
    (m.priceHistory || []).length
  ]);

  const catLabel = categoryFilter && categoryFilter !== 'all' ? `_${categoryFilter.replace(/\s+/g, '_')}` : '_All';
  downloadCSV(`Materials_Catalog${catLabel}_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

// ----------------------------------------------------
// 2. PRODUCE ITEMS EXPORT
// ----------------------------------------------------
export function exportProduceItemsToCSV(items: ProduceItem[], categoryFilter?: string): void {
  const filtered = categoryFilter && categoryFilter !== 'all'
    ? items.filter(p => p.category.toLowerCase() === categoryFilter.toLowerCase())
    : items;

  const headers = [
    'Product Code',
    'Item Name',
    'Type',
    'Category',
    'SubCategory',
    'More SubCategory',
    'Unit',
    'Cost Price',
    'Retail / Quoted Price',
    'Default Discount %',
    'Lead Time Days',
    'Status',
    'Last Updated',
    'Price Revisions Count'
  ];

  const rows = filtered.map(p => [
    p.code,
    p.name,
    p.type,
    p.category,
    p.subCategory,
    p.moreSubCategory || '',
    p.unit,
    p.costPrice,
    p.retailPrice,
    p.defaultDiscountPct || 0,
    p.leadTimeDays,
    p.status,
    p.lastUpdated || '',
    (p.priceHistory || []).length
  ]);

  const catLabel = categoryFilter && categoryFilter !== 'all' ? `_${categoryFilter.replace(/\s+/g, '_')}` : '_All';
  downloadCSV(`Produced_Products_Services${catLabel}_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

// ----------------------------------------------------
// 3. SUPPLIERS EXPORT
// ----------------------------------------------------
export function exportSuppliersToCSV(suppliers: Supplier[], categoryFilter?: string): void {
  const filtered = categoryFilter && categoryFilter !== 'all'
    ? suppliers.filter(s => s.category.toLowerCase() === categoryFilter.toLowerCase())
    : suppliers;

  const headers = [
    'Supplier ID',
    'Company Name',
    'Category',
    'Supply Scope',
    'Contact Person',
    'Email',
    'Phone',
    'Country',
    'City',
    'Payment Terms',
    'Rating',
    'On Time Delivery %',
    'Quality Score %',
    'Status',
    'Active Contracts Count',
    'Notes'
  ];

  const rows = filtered.map(s => [
    s.id,
    s.name,
    s.category,
    s.supplyScope,
    s.contactPerson,
    s.email,
    s.phone,
    s.country,
    s.city,
    s.paymentTerms,
    s.rating,
    s.onTimeDeliveryPct,
    s.qualityScorePct,
    s.status,
    (s.contractHistory || []).length,
    s.notes || ''
  ]);

  const catLabel = categoryFilter && categoryFilter !== 'all' ? `_${categoryFilter.replace(/\s+/g, '_')}` : '_All';
  downloadCSV(`Suppliers_Directory${catLabel}_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

// ----------------------------------------------------
// 4. SUBCONTRACTORS EXPORT
// ----------------------------------------------------
export function exportSubcontractorsToCSV(subcontractors: SubcontractorRateItem[], categoryFilter?: string): void {
  const filtered = categoryFilter && categoryFilter !== 'all'
    ? subcontractors.filter(s => (s.category || s.serviceCategory || '').toLowerCase() === categoryFilter.toLowerCase())
    : subcontractors;

  const headers = [
    'Rate Code',
    'Service Name',
    'Trade Category',
    'Trade SubCategory',
    'Subcontractor Firm',
    'Hourly / Base Rate',
    'Retail Quoted Rate',
    'Billing Unit',
    'Skill Level',
    'Last Updated',
    'Price Revisions Count'
  ];

  const rows = filtered.map(s => [
    s.code || s.id,
    s.name || s.serviceType,
    s.category || s.serviceCategory || 'Fabrication',
    s.subCategory || s.serviceSubCategory || '',
    s.subcontractorName,
    s.baseRate ?? s.rate ?? 0,
    s.retailRate ?? (s.baseRate ? s.baseRate * 1.3 : 130),
    s.unit,
    s.skillLevel,
    s.lastUpdated || '',
    (s.priceHistory || s.rateHistory || []).length
  ]);

  const catLabel = categoryFilter && categoryFilter !== 'all' ? `_${categoryFilter.replace(/\s+/g, '_')}` : '_All';
  downloadCSV(`Subcontractor_Labour_Rates${catLabel}_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

// ----------------------------------------------------
// 5. OUTSOURCED SERVICES EXPORT
// ----------------------------------------------------
export function exportOutsourcedServicesToCSV(services: OutsourcedService[], categoryFilter?: string): void {
  const filtered = categoryFilter && categoryFilter !== 'all'
    ? services.filter(s => s.category.toLowerCase() === categoryFilter.toLowerCase())
    : services;

  const headers = [
    'Service Code',
    'Service Name',
    'Sector / Category',
    'SubCategory',
    'Provider Name',
    'Unit Type',
    'Base Contract Rate',
    'Retail Price',
    'SLA Level',
    'Last Updated',
    'Price Revisions Count'
  ];

  const rows = filtered.map(s => [
    s.code || s.id,
    s.name,
    s.category,
    s.subCategory,
    s.providerName,
    s.baseUnitType,
    s.rate,
    s.retailPrice,
    s.slaLevel,
    s.lastUpdated || '',
    (s.priceHistory || []).length
  ]);

  const catLabel = categoryFilter && categoryFilter !== 'all' ? `_${categoryFilter.replace(/\s+/g, '_')}` : '_All';
  downloadCSV(`Outsourced_Utility_Services${catLabel}_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

// ----------------------------------------------------
// 6. INVENTORY EXPORT
// ----------------------------------------------------
export function exportInventoryToCSV(inventory: InventoryItem[], categoryFilter?: string): void {
  const filtered = categoryFilter && categoryFilter !== 'all'
    ? inventory.filter(i => i.category.toLowerCase() === categoryFilter.toLowerCase())
    : inventory;

  const headers = [
    'SKU',
    'Item Name',
    'Category',
    'Current On Hand',
    'Allocated / Reserved',
    'Available Stock',
    'Reorder Level',
    'Unit Cost',
    'Total Valuation',
    'Location',
    'Status',
    'Last Movement Date'
  ];

  const rows = filtered.map(i => {
    const onHand = i.currentStock ?? i.onHand ?? 0;
    const reserved = i.allocatedStock ?? i.reserved ?? 0;
    const available = i.availableStock ?? i.available ?? (onHand - reserved);
    const valuation = i.totalValuation ?? (onHand * (i.unitCost || 0));

    return [
      i.sku,
      i.itemName || i.name || 'Inventory Item',
      i.category,
      onHand,
      reserved,
      available,
      i.reorderLevel,
      i.unitCost,
      valuation,
      i.location,
      i.status,
      i.lastMovementDate || ''
    ];
  });

  const catLabel = categoryFilter && categoryFilter !== 'all' ? `_${categoryFilter.replace(/\s+/g, '_')}` : '_All';
  downloadCSV(`Inventory_Stock_Records${catLabel}_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

// ----------------------------------------------------
// 6B. INVENTORY TRANSACTIONS LOG EXPORT (IN / OUT)
// ----------------------------------------------------
export function exportInventoryTransactionsToCSV(transactions: InventoryTransaction[], typeFilter?: 'ALL' | 'IN' | 'OUT'): void {
  const filtered = typeFilter && typeFilter !== 'ALL'
    ? transactions.filter(t => t.type === typeFilter)
    : transactions;

  const headers = [
    'Transaction Ref / ID',
    'Transaction Type (IN/OUT)',
    'Date',
    'Timestamp',
    'Material Code',
    'Material Name',
    'Central Inventory SKU',
    'Batch / Lot #',
    'Requisition / PO Ref',
    'Project Code',
    'Project Name',
    'Supplier / Vendor',
    'Quantity',
    'Unit',
    'Unit Price (LKR)',
    'Discount %',
    'Discount Amount (LKR)',
    'Net Total Amount (LKR)',
    'Previous Stock',
    'New Stock',
    'Recorded By / Auditor',
    'Transaction Notes'
  ];

  const rows = filtered.map(t => [
    t.transactionNumber || t.id,
    t.type,
    t.date,
    t.timestamp || '',
    t.materialCode,
    t.materialName,
    t.inventorySku || '',
    t.batchLotNumber || '',
    t.requisitionRef || '',
    t.projectCode || 'GENERAL',
    t.projectName || 'General Inventory',
    t.supplierName || '',
    t.quantity,
    t.unit,
    t.price,
    t.discount || 0,
    t.discountAmount || 0,
    t.totalAmount,
    t.previousAvailableQuantity,
    t.newAvailableQuantity,
    t.recordedBy || 'System Auditor',
    t.notes || ''
  ]);

  const typeLabel = typeFilter && typeFilter !== 'ALL' ? `_${typeFilter}` : '_All';
  downloadCSV(`Inventory_Transactions_Log${typeLabel}_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

// ----------------------------------------------------
// 7. PROJECTS EXPORT
// ----------------------------------------------------
export function exportProjectsToCSV(projects: Project[], statusFilter?: string): void {
  const filtered = statusFilter && statusFilter !== 'all'
    ? projects.filter(p => p.status.toLowerCase() === statusFilter.toLowerCase())
    : projects;

  const headers = [
    'Project Code',
    'Project Name',
    'Client Name',
    'Target Product',
    'Product Category',
    'Contract Status',
    'Start Date',
    'Delivery Deadline',
    'Quoted Price (Revenue)',
    'Est Total Cost (COGS)',
    'Gross Margin %',
    'Net Margin %',
    'Phases Count',
    'Selected Items Count'
  ];

  const rows = filtered.map(p => [
    p.code,
    p.name,
    p.clientName,
    p.targetProduct,
    p.productCategory,
    p.status,
    p.startDate,
    p.deliveryDeadline,
    p.quotedPrice,
    p.analytics?.totalProjectCost || 0,
    (p.analytics?.grossMarginPct || p.targetMarginPct || 0).toFixed(1),
    (p.analytics?.netMarginPct || 0).toFixed(1),
    (p.phases || []).length,
    (p.selectedItems || []).length
  ]);

  downloadCSV(`Enterprise_Projects_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

// ----------------------------------------------------
// 8. ITEM PRICE HISTORY EXPORT (FOR INDIVIDUAL ITEM)
// ----------------------------------------------------
export function exportItemPriceHistoryToCSV(item: { code?: string; name?: string; category?: string }, history: any[]): void {
  const itemCode = item.code || 'ITEM';
  const itemName = item.name || 'Item';

  const headers = [
    'Revision Date',
    'Item Code',
    'Item Name',
    'Previous Rate',
    'New Approved Rate',
    'Variation (%)',
    'Change Reason / Business Justification',
    'Authorized Auditor / Approved By',
    'Status'
  ];

  const rows = (history || []).map((h, idx) => {
    const prev = typeof h.previousPrice === 'number' ? h.previousPrice : (h.previousRate ?? h.oldPrice ?? h.oldRate ?? 0);
    const curr = typeof h.newPrice === 'number' ? h.newPrice : (h.newRate ?? h.price ?? 0);
    const change = typeof h.changePct === 'number'
      ? h.changePct
      : typeof h.changePercent === 'number'
      ? h.changePercent
      : prev > 0 ? Number((((curr - prev) / prev) * 100).toFixed(2)) : 0;

    return [
      h.date || new Date().toISOString().slice(0, 10),
      itemCode,
      itemName,
      prev,
      curr,
      `${change > 0 ? '+' : ''}${change}%`,
      h.reason || h.changeReason || 'Scheduled price revision',
      h.updatedBy || h.approvedBy || 'Commercial Pricing Lead',
      h.status || 'Audited & Approved'
    ];
  });

  downloadCSV(`Price_Audit_History_${itemCode.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

export function exportPriceHistoryToCSV(code: string, name: string, history: any[]): void {
  exportItemPriceHistoryToCSV({ code, name }, history);
}

// ----------------------------------------------------
// 9. ALL PRICE HISTORIES EXPORT (FOR ALL ITEMS IN A CATEGORY OR PORTAL)
// ----------------------------------------------------
export function exportAllPriceHistoriesToCSV(
  portalOrCategoryName: string,
  items: Array<{ code?: string; name?: string; category?: string; subCategory?: string; priceHistory?: any[]; rateHistory?: any[] }>
): void {
  const headers = [
    'Revision Date',
    'Category',
    'Item Code',
    'Item Name',
    'Previous Rate',
    'New Approved Rate',
    'Variance %',
    'Revision Reason / Justification',
    'Authorized Auditor'
  ];

  const rows: (string | number)[][] = [];

  items.forEach(item => {
    const history = item.priceHistory || item.rateHistory || [];
    history.forEach(h => {
      const prev = typeof h.previousPrice === 'number' ? h.previousPrice : (h.previousRate ?? h.oldPrice ?? h.oldRate ?? 0);
      const curr = typeof h.newPrice === 'number' ? h.newPrice : (h.newRate ?? h.price ?? 0);
      const change = typeof h.changePct === 'number'
        ? h.changePct
        : typeof h.changePercent === 'number'
        ? h.changePercent
        : prev > 0 ? Number((((curr - prev) / prev) * 100).toFixed(2)) : 0;

      rows.push([
        h.date || '2026-01-01',
        item.category || portalOrCategoryName,
        item.code || 'ITEM',
        item.name || 'Catalog Item',
        prev,
        curr,
        `${change > 0 ? '+' : ''}${change}%`,
        h.reason || h.changeReason || 'General index tariff revision',
        h.updatedBy || h.approvedBy || 'Pricing Committee'
      ]);
    });
  });

  const safeName = portalOrCategoryName.replace(/[^a-zA-Z0-9_-]/g, '_');
  downloadCSV(`All_Price_Histories_${safeName}_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

// ----------------------------------------------------
// 10. OVERHEAD ITEMS EXPORT
// ----------------------------------------------------
export function exportOverheadsToCSV(items: OverheadItem[]): void {
  const headers = [
    'Code',
    'Name',
    'Category',
    'Cost Type',
    'Calculation Method',
    'Default Rate',
    'Unit Type',
    'Cost Base',
    'Currency',
    'Status',
    'Description'
  ];

  const rows = items.map(item => [
    item.code || '',
    item.name || '',
    item.category || '',
    item.costType || 'Fixed',
    item.defaultCalculationMethod || 'fixed_amount',
    item.defaultRate ?? 0,
    item.unitType || '',
    item.defaultCostBase || 'total_direct_cost',
    item.currency || 'USD',
    item.status || 'Active',
    item.description || ''
  ]);

  downloadCSV(`Overhead_Costing_Catalogue_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

// ----------------------------------------------------
// 11. REVENUE ITEMS EXPORT
// ----------------------------------------------------
export function exportRevenueItemsToCSV(items: RevenueItem[]): void {
  const headers = [
    'Code',
    'Name',
    'Category',
    'Type',
    'Default Rate',
    'Unit',
    'Currency',
    'Tax Rate (%)',
    'Status',
    'Description'
  ];

  const rows = items.map(item => [
    item.code || '',
    item.name || '',
    item.category || '',
    item.type || 'product',
    item.defaultRate ?? 0,
    item.unit || '',
    item.currency || 'USD',
    item.taxRatePct ?? 0,
    item.status || 'Active',
    item.description || ''
  ]);

  downloadCSV(`Commercial_Revenue_Catalogue_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

// ----------------------------------------------------
// 12. TARIFF MANAGEMENT EXPORT
// ----------------------------------------------------
export function exportTariffsToCSV(tariffs: (Tariff | OutsourcedService)[]): void {
  const headers = [
    'Tariff Code',
    'Tariff / Process Name',
    'Category',
    'Calculation Method / Provider',
    'Rate / Percentage',
    'Fixed Charge',
    'Unit',
    'Currency',
    'Applicable Base',
    'Status',
    'Description'
  ];

  const rows = tariffs.map(t => {
    if ('calculationMethod' in t) {
      const tariff = t as Tariff;
      return [
        tariff.code || '',
        tariff.name || '',
        tariff.category || '',
        tariff.calculationMethod || '',
        tariff.rateOrPercentage ?? 0,
        tariff.fixedCharge ?? 0,
        tariff.unit || '',
        tariff.currency || 'USD',
        tariff.applicableBase || '',
        tariff.status || 'Active',
        tariff.description || ''
      ];
    } else {
      const srv = t as OutsourcedService;
      return [
        srv.code || srv.id || '',
        srv.name || '',
        srv.category || '',
        srv.providerName || '',
        srv.rate ?? 0,
        0,
        srv.unit || '',
        'USD',
        srv.baseUnitType || '',
        srv.status || 'Active',
        srv.slaLevel || ''
      ];
    }
  });

  downloadCSV(`Industrial_Tariff_Schedule_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

// ----------------------------------------------------
// 13. ENTERPRISE RESOURCES EXPORT
// ----------------------------------------------------
export function exportEnterpriseResourcesToCSV(resources: EnterpriseResource[]): void {
  const headers = [
    'Resource Code',
    'Resource Name',
    'Resource Type',
    'Category',
    'SubCategory',
    'Base Rate',
    'Operational Charge',
    'Charge Type',
    'Unit',
    'Currency',
    'Supplier / Partner',
    'Barcode',
    'Status',
    'Notes'
  ];

  const rows = resources.map(res => [
    res.code || res.id || '',
    res.name || '',
    res.type || 'labour',
    res.category || '',
    res.subCategory || '',
    res.baseRate ?? 0,
    res.operationalCharge ?? 0,
    res.chargeType || 'hourly',
    res.unit || 'hr',
    res.currency || 'LKR',
    res.supplierName || '',
    res.barcode || '',
    res.status || 'Available',
    res.notes || ''
  ]);

  downloadCSV(`Enterprise_Resources_Catalog_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

