import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  DollarSign,
  Calendar,
  Building2,
  Package,
  Layers,
  FileText,
  Clock,
  TrendingUp,
  TrendingDown,
  Percent,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Tag
} from 'lucide-react';
import {
  Supplier,
  MaterialItem,
  OutsourcedService,
  SubcontractorRateItem,
  Project,
  ProcurementPriceType,
  ProcurementCostStage,
  ProcurementPriceRecord
} from '../../types';
import { api } from '../../services/api';
import { formatCurrency, SUPPORTED_CURRENCIES } from '../../utils/currency';
import { round4, calcPctChange } from '../../utils/decimalMath';

interface RecordPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (record: ProcurementPriceRecord) => void;
  initialSupplierId?: string;
  initialItemId?: string;
  initialItemType?: 'material' | 'outsourced_service' | 'subcontractor_rate';
  initialProjectId?: string;
  initialProjectPlanId?: string;
  suppliers: Supplier[];
  materials: MaterialItem[];
  outsourcedServices: OutsourcedService[];
  subcontractors: SubcontractorRateItem[];
  projects?: Project[];
  showToast?: (toast: { message: string; type?: 'success' | 'error' | 'info' | 'warning' }) => void;
}

export const RecordPriceModal: React.FC<RecordPriceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialSupplierId,
  initialItemId,
  initialItemType = 'material',
  initialProjectId,
  initialProjectPlanId,
  suppliers,
  materials,
  outsourcedServices,
  subcontractors,
  projects = [],
  showToast
}) => {
  // 1. Entity selections
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(initialSupplierId || '');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [selectedItemType, setSelectedItemType] = useState<'material' | 'outsourced_service' | 'subcontractor_rate'>(initialItemType);
  const [selectedItemId, setSelectedItemId] = useState<string>(initialItemId || '');
  const [itemSearch, setItemSearch] = useState('');

  // 2. Pricing terms
  const [unitPrice, setUnitPrice] = useState<number | ''>('');
  const [currency, setCurrency] = useState<string>('USD');
  const [unit, setUnit] = useState<string>('unit');
  const [priceType, setPriceType] = useState<ProcurementPriceType>('supplier_quotation');
  const [costStage, setCostStage] = useState<ProcurementCostStage>('quoted');
  const [isConfirmedPurchase, setIsConfirmedPurchase] = useState<boolean>(false);

  // 3. Dates & References
  const [effectiveDate, setEffectiveDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [validFrom, setValidFrom] = useState<string>('');
  const [validUntil, setValidUntil] = useState<string>('');
  const [quotationRef, setQuotationRef] = useState<string>('');
  const [leadTimeDays, setLeadTimeDays] = useState<number>(7);
  const [moq, setMoq] = useState<number>(1);

  // 4. Project linkage & notes
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || '');
  const [selectedPlanId, setSelectedPlanId] = useState<string>(initialProjectPlanId || '');
  const [notes, setNotes] = useState<string>('');

  // State for submitting & previous price checking
  const [submitting, setSubmitting] = useState(false);
  const [previousPriceRecord, setPreviousPriceRecord] = useState<ProcurementPriceRecord | null>(null);
  const [loadingPreviousPrice, setLoadingPreviousPrice] = useState(false);

  // Filtered suppliers
  const filteredSuppliers = useMemo(() => {
    const q = supplierSearch.toLowerCase().trim();
    return suppliers.filter((s) => {
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.code && s.code.toLowerCase().includes(q)) ||
        (s.city && s.city.toLowerCase().includes(q)) ||
        (s.category && s.category.toLowerCase().includes(q))
      );
    });
  }, [suppliers, supplierSearch]);

  // Selected supplier object
  const currentSupplier = useMemo(() => {
    return suppliers.find((s) => s.id === selectedSupplierId) || null;
  }, [suppliers, selectedSupplierId]);

  // Unified items list based on item type
  const availableItems = useMemo(() => {
    const q = itemSearch.toLowerCase().trim();
    if (selectedItemType === 'material') {
      return materials
        .filter((m) => {
          if (!q) return true;
          return (
            m.name.toLowerCase().includes(q) ||
            m.code.toLowerCase().includes(q) ||
            m.category.toLowerCase().includes(q)
          );
        })
        .map((m) => ({
          id: m.id,
          code: m.code,
          name: m.name,
          category: m.category,
          subCategory: m.subCategory,
          unit: m.unit || 'pcs',
          currentPrice: m.currentPrice ?? m.retailPrice ?? 0,
          currency: m.currency || 'USD',
          leadTimeDays: m.leadTimeDays || 7
        }));
    } else if (selectedItemType === 'outsourced_service') {
      return outsourcedServices
        .filter((o) => {
          if (!q) return true;
          return (
            o.name.toLowerCase().includes(q) ||
            (o.code && o.code.toLowerCase().includes(q)) ||
            o.category.toLowerCase().includes(q)
          );
        })
        .map((o) => ({
          id: o.id,
          code: o.code || o.id,
          name: o.name,
          category: o.category,
          subCategory: o.subCategory,
          unit: o.unit || o.baseUnitType || 'per_hour',
          currentPrice: o.rate ?? o.retailPrice ?? 0,
          currency: o.currency || 'USD',
          leadTimeDays: o.leadTimeDays || 7
        }));
    } else {
      return subcontractors
        .filter((s) => {
          if (!q) return true;
          return (
            (s.nicheServiceName && s.nicheServiceName.toLowerCase().includes(q)) ||
            (s.subcontractorName && s.subcontractorName.toLowerCase().includes(q)) ||
            (s.code && s.code.toLowerCase().includes(q)) ||
            (s.serviceCategory && s.serviceCategory.toLowerCase().includes(q))
          );
        })
        .map((s) => ({
          id: s.id,
          code: s.code || s.id,
          name: s.nicheServiceName || s.subcontractorName || 'Subcontractor Trade',
          category: s.serviceCategory || s.trade || 'Subcontractor',
          subCategory: s.serviceSubCategory || '',
          unit: s.unit || 'hr',
          currentPrice: s.baseRate ?? s.rate ?? 0,
          currency: s.currency || 'USD',
          leadTimeDays: s.leadTimeDays || 7
        }));
    }
  }, [selectedItemType, itemSearch, materials, outsourcedServices, subcontractors]);

  // Selected item object
  const currentItem = useMemo(() => {
    return availableItems.find((i) => i.id === selectedItemId) || null;
  }, [availableItems, selectedItemId]);

  // Sync item unit and currency when item changes
  useEffect(() => {
    if (currentItem) {
      setUnit(currentItem.unit || 'unit');
      if (currentItem.currency) setCurrency(currentItem.currency);
      if (currentItem.leadTimeDays) setLeadTimeDays(currentItem.leadTimeDays);
    }
  }, [currentItem]);

  // Sync supplier currency if item didn't set it
  useEffect(() => {
    if (currentSupplier?.currency && !currentItem?.currency) {
      setCurrency(currentSupplier.currency);
    }
  }, [currentSupplier, currentItem]);

  // Automatically update cost stage when price type changes
  useEffect(() => {
    if (priceType === 'actual_invoiced_price') {
      setCostStage('actual');
      setIsConfirmedPurchase(true);
    } else if (
      priceType === 'purchase_order_price' ||
      priceType === 'negotiated_price' ||
      priceType === 'agreed_subcontract_rate'
    ) {
      setCostStage('committed');
      setIsConfirmedPurchase(true);
    } else if (priceType === 'supplier_quotation' || priceType === 'subcontractor_quotation') {
      setCostStage('quoted');
      setIsConfirmedPurchase(false);
    } else {
      setCostStage('estimated');
      setIsConfirmedPurchase(false);
    }
  }, [priceType]);

  // Load previous price for selected supplier + item
  useEffect(() => {
    if (!selectedSupplierId || !selectedItemId) {
      setPreviousPriceRecord(null);
      return;
    }

    let isMounted = true;
    setLoadingPreviousPrice(true);

    api
      .getProcurementPriceHistory({
        supplierId: selectedSupplierId,
        itemId: selectedItemId,
        limit: 1,
        paginated: true
      })
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res) ? res : res.data || [];
        setPreviousPriceRecord(list[0] || null);
      })
      .catch((err) => {
        console.warn('Failed to load previous price for entity:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingPreviousPrice(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSupplierId, selectedItemId]);

  // Price difference calculation
  const numericPrice = typeof unitPrice === 'number' ? unitPrice : 0;
  const previousPrice = previousPriceRecord ? previousPriceRecord.unitPrice : null;
  const priceDiff = previousPrice !== null ? numericPrice - previousPrice : null;
  const priceDiffPct = previousPrice !== null && previousPrice > 0 ? calcPctChange(previousPrice, numericPrice, 1) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      showToast?.({ message: 'Please select a supplier or service provider.', type: 'warning' });
      return;
    }
    if (!selectedItemId) {
      showToast?.({ message: 'Please select an item (material or service).', type: 'warning' });
      return;
    }
    if (unitPrice === '' || Number(unitPrice) < 0) {
      showToast?.({ message: 'Please provide a valid non-negative unit price.', type: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      const payload: Partial<ProcurementPriceRecord> = {
        supplierId: selectedSupplierId,
        itemType: selectedItemType,
        itemId: selectedItemId,
        unitPrice: round4(Number(unitPrice)),
        currency,
        unit,
        priceType,
        costStage,
        isConfirmedPurchase,
        effectiveDate,
        validFrom: validFrom || undefined,
        validUntil: validUntil || undefined,
        quotationRef: quotationRef.trim() || undefined,
        leadTimeDays: Number(leadTimeDays || 7),
        moq: Number(moq || 1),
        projectId: selectedProjectId || undefined,
        projectPlanId: selectedPlanId || undefined,
        notes: notes.trim() || undefined
      };

      const created = await api.createProcurementPriceRecord(payload);
      showToast?.({
        message: `Price quotation recorded successfully (${currency} ${Number(unitPrice).toFixed(2)}/${unit}) for ${currentSupplier?.name}.`,
        type: 'success'
      });
      onSuccess?.(created);
      onClose();
    } catch (err: any) {
      console.error('Failed to record procurement price:', err);
      showToast?.({ message: err?.message || 'Failed to record procurement price', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Record Price
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* STEP 1: Supplier */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 dark:text-slate-200">
                Supplier *
              </label>
              {currentSupplier && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Linked to {currentSupplier.name} ({currentSupplier.code || currentSupplier.id})</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search existing suppliers by name, code, city..."
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                required
                className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
              >
                <option value="">-- Choose Existing Supplier --</option>
                {filteredSuppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code || s.id}) — {s.category || s.supplyScope || 'Supplier'} [{s.city}, {s.country}]
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* STEP 2: Item */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 dark:text-slate-200">
                Item *
              </label>
              <div className="flex items-center space-x-1 bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedItemType('material');
                    setSelectedItemId('');
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                    selectedItemType === 'material'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:text-blue-600'
                  }`}
                >
                  Materials
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedItemType('outsourced_service');
                    setSelectedItemId('');
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                    selectedItemType === 'outsourced_service'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:text-purple-600'
                  }`}
                >
                  Outsourced
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedItemType('subcontractor_rate');
                    setSelectedItemId('');
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                    selectedItemType === 'subcontractor_rate'
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:text-amber-600'
                  }`}
                >
                  Subcontractor
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={`Search ${selectedItemType.replace('_', ' ')}s by name, code...`}
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                required
                className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
              >
                <option value="">-- Choose Existing Item --</option>
                {availableItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code ? `[${item.code}] ` : ''}{item.name} ({item.unit}) — Current: ${Number(item.currentPrice ?? 0).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* STEP 3: Price, Currency, Price Type & Cost Stage */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Unit Price */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Unit Price *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">
                  {currency}
                </span>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  required
                  placeholder="0.00"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full pl-14 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-slate-100 text-sm"
                />
              </div>
            </div>

            {/* Currency */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol}) — {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Unit of Measurement */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Unit of Measurement
              </label>
              <input
                type="text"
                placeholder="e.g. sheet, kg, ton, hr, month"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* STEP 4: Price Classification & Source */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200 dark:border-amber-900/40">
            {/* Price Type (Requirement 11 & 12) */}
            <div>
              <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-200 mb-1 flex items-center space-x-1">
                <Tag className="w-3.5 h-3.5 text-amber-700" />
                <span>Price Type / Commercial Classification *</span>
              </label>
              <select
                value={priceType}
                onChange={(e) => setPriceType(e.target.value as ProcurementPriceType)}
                className="w-full px-3 py-1.5 border border-amber-300 dark:border-amber-800 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
              >
                <option value="supplier_quotation">Supplier Quotation (Formal Quote)</option>
                <option value="negotiated_price">Negotiated Price (Discount Accord)</option>
                <option value="purchase_order_price">Purchase Order Price (Committed PO)</option>
                <option value="actual_invoiced_price">Actual Invoiced Price (Settled Invoice)</option>
                <option value="subcontractor_quotation">Subcontractor Quotation (Tender Rate)</option>
                <option value="agreed_subcontract_rate">Agreed Subcontract Rate (Master Agreement)</option>
                <option value="catalog_price_revision">Catalog Price Revision (Periodic Update)</option>
              </select>
              <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-1">
                Quotations are kept as historical offers; actual purchases are confirmed on commitment.
              </p>
            </div>

            {/* Cost Stage (Requirement 19) */}
            <div>
              <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-200 mb-1 flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                <span>Financial Stage (Arch. Standard)</span>
              </label>
              <div className="grid grid-cols-4 gap-1 pt-0.5">
                {(['estimated', 'quoted', 'committed', 'actual'] as ProcurementCostStage[]).map((stg) => (
                  <button
                    key={stg}
                    type="button"
                    onClick={() => setCostStage(stg)}
                    className={`py-1 text-[10px] font-bold uppercase rounded border transition-colors cursor-pointer text-center ${
                      costStage === stg
                        ? stg === 'actual'
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : stg === 'committed'
                          ? 'bg-blue-600 text-white border-blue-700'
                          : stg === 'quoted'
                          ? 'bg-amber-600 text-white border-amber-700'
                          : 'bg-purple-600 text-white border-purple-700'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {stg}
                  </button>
                ))}
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <input
                  type="checkbox"
                  id="confirmPurchaseCheckbox"
                  checked={isConfirmedPurchase}
                  onChange={(e) => setIsConfirmedPurchase(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600"
                />
                <label htmlFor="confirmPurchaseCheckbox" className="text-[11px] text-slate-700 dark:text-slate-300">
                  Confirm as active agreed procurement price for purchase workflows
                </label>
              </div>
            </div>
          </div>

          {/* STEP 5: Dates, Quote Reference & Lead Times */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Effective Date *
              </label>
              <input
                type="date"
                required
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Valid From
              </label>
              <input
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Valid Until
              </label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Quote / PO Reference #
              </label>
              <input
                type="text"
                placeholder="e.g. Q-2026-881 / PO-901"
                value={quotationRef}
                onChange={(e) => setQuotationRef(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>
          </div>

          {/* STEP 6: Lead Time & Project/Plan Reference */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Lead Time (Days) & MOQ
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="number"
                  min="0"
                  placeholder="Days"
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  title="Lead time in days"
                />
                <input
                  type="number"
                  min="1"
                  placeholder="MOQ"
                  value={moq}
                  onChange={(e) => setMoq(parseFloat(e.target.value) || 1)}
                  className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  title="Minimum order quantity"
                />
              </div>
            </div>

            {/* Optional Project Reference */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Project Reference (Optional)
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="">-- General Procurement --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Notes & Terms
              </label>
              <input
                type="text"
                placeholder="Discounts, warranties, terms..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          {/* STEP 7: Live Comparison Preview Box */}
          <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>Price Comparison & Variance Analysis:</span>
              </div>
              {loadingPreviousPrice ? (
                <span className="text-[10px] text-slate-400">Checking historical quotes...</span>
              ) : previousPriceRecord ? (
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-slate-500">
                    Previous Quote ({previousPriceRecord.effectiveDate}):
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {formatCurrency(previousPriceRecord.unitPrice, previousPriceRecord.currency || currency)}
                  </span>
                  {numericPrice > 0 && priceDiff !== null && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center space-x-1 ${
                        priceDiff > 0
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : priceDiff < 0
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-slate-200 text-slate-800'
                      }`}
                    >
                      {priceDiff > 0 ? (
                        <>
                          <TrendingUp className="w-3 h-3" />
                          <span>+{priceDiffPct}% (+{formatCurrency(priceDiff, currency)})</span>
                        </>
                      ) : priceDiff < 0 ? (
                        <>
                          <TrendingDown className="w-3 h-3" />
                          <span>{priceDiffPct}% ({formatCurrency(priceDiff, currency)})</span>
                        </>
                      ) : (
                        <span>No Change (0%)</span>
                      )}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-[11px] text-slate-500 italic">
                  Initial baseline quote for this supplier and item.
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-[#0078d4] hover:bg-[#006cbd] text-white font-bold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
