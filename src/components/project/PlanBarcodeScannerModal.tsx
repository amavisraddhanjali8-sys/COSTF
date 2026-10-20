import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Barcode,
  Camera,
  Keyboard,
  Search,
  CheckCircle2,
  AlertCircle,
  Package,
  Wrench,
  Layers,
  Building2,
  DollarSign,
  Plus,
  RefreshCw,
  Printer,
  Download,
  AlertTriangle,
  Info,
  TrendingUp,
  Tag
} from 'lucide-react';
import { api } from '../../services/api';
import { CameraBarcodeScanner } from '../CameraBarcodeScanner';
import { downloadItemBarcode } from '../../utils/barcodeGenerator';
import { formatCurrency } from '../../utils/currency';
import { addBarcodeScanListener, BarcodeScanEventDetail } from '../../services/globalBarcodeScanner';

interface PlanBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  planNumber?: string;
  projectId?: string;
  activeCurrency: string;
  existingBoqItems?: any[];
  onItemAddedToPlan: (item: any) => void;
  showToast?: (toast: { message: string; type?: 'success' | 'error' | 'info' | 'warning' }) => void;
}

export const PlanBarcodeScannerModal: React.FC<PlanBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  planId,
  planNumber = 'PLAN',
  projectId,
  activeCurrency,
  existingBoqItems = [],
  onItemAddedToPlan,
  showToast
}) => {
  const [scanMode, setScanMode] = useState<'camera' | 'manual' | 'hardware'>('manual');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupResult, setLookupResult] = useState<any | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Commercial / Plan Configuration for scanned item
  const [planQuantity, setPlanQuantity] = useState<number | ''>(1);
  const [planUnit, setPlanUnit] = useState<string>('unit');
  const [planRate, setPlanRate] = useState<number | ''>(0);
  const [planDiscountPct, setPlanDiscountPct] = useState<number | ''>(0);
  const [incrementIfExists, setIncrementIfExists] = useState<boolean>(true);
  const [isAdding, setIsAdding] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const manualInputRef = useRef<HTMLInputElement | null>(null);

  // Focus manual input on open
  useEffect(() => {
    if (isOpen) {
      setLookupResult(null);
      setLookupError(null);
      setSuccessMessage(null);
      setBarcodeInput('');
      setTimeout(() => {
        manualInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Hardware Scanner Listener
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = addBarcodeScanListener((detail: BarcodeScanEventDetail) => {
      setBarcodeInput(detail.code);
      handlePerformLookup(detail.code);
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePerformLookup = async (codeToLookup?: string) => {
    const code = String(codeToLookup || barcodeInput).trim();
    if (!code) {
      setLookupError('Please enter or scan a barcode.');
      return;
    }

    setIsLookingUp(true);
    setLookupError(null);
    setSuccessMessage(null);

    try {
      const res = await api.lookupBarcode(code);
      if (res && res.found) {
        setLookupResult(res);
        // Pre-fill plan fields
        setPlanUnit(res.unit || 'unit');
        setPlanQuantity(1);
        setPlanRate(res.sellingRate || res.unitCost || 0);
        setPlanDiscountPct(0);
      } else {
        setLookupResult(null);
        setLookupError(res?.message || `No record found matching barcode or item code "${code}".`);
      }
    } catch (err: any) {
      console.error('Barcode lookup failed:', err);
      setLookupResult(null);
      setLookupError(err?.message || `Failed to lookup barcode "${code}".`);
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleCameraScanDetected = (detectedCode: string) => {
    if (!detectedCode) return;
    setBarcodeInput(detectedCode);
    handlePerformLookup(detectedCode);
  };

  // Check if this item is already present in this plan
  const existingItemInPlan = lookupResult
    ? existingBoqItems.find(
        (b) =>
          (lookupResult.entityId && (b.revenueItemId === lookupResult.entityId || b.catalogItemId === lookupResult.entityId)) ||
          (lookupResult.entityCode && String(b.itemCode || '').toLowerCase() === String(lookupResult.entityCode).toLowerCase()) ||
          (lookupResult.barcode && String(b.barcode || '').toLowerCase() === String(lookupResult.barcode).toLowerCase())
      )
    : null;

  const handleAddItemToPlan = async () => {
    if (!lookupResult) return;
    const qty = Number(planQuantity) || 0;
    if (qty <= 0) {
      setLookupError('Quantity must be greater than 0.');
      return;
    }
    const rate = Number(planRate) || 0;
    if (rate < 0) {
      setLookupError('Selling rate cannot be negative.');
      return;
    }

    // Requirement 20: Do not add a supplier or directory contact directly as a BOQ item
    if (lookupResult.isDirectoryOnly || lookupResult.entityType === 'supplier' || lookupResult.entityType === 'client') {
      setLookupError(`Cannot add ${lookupResult.entityType} directly as a financial BOQ line item. Only eligible revenue products, services, materials, and subcontracted work items can be added.`);
      return;
    }

    setIsAdding(true);
    setLookupError(null);

    try {
      const isRevenue = lookupResult.entityType === 'revenue_service' || lookupResult.entityType === 'revenue_product';
      const itemType = isRevenue
        ? (lookupResult.entityType === 'revenue_service' ? 'service' : 'product')
        : lookupResult.entityType === 'subcontractor'
        ? 'subcontractor'
        : lookupResult.entityType === 'outsourced_service'
        ? 'outsourced'
        : 'material';

      const payload = {
        revenueItemId: isRevenue ? lookupResult.entityId : null,
        catalogItemId: !isRevenue ? lookupResult.entityId : null,
        itemCode: lookupResult.entityCode,
        barcode: lookupResult.barcode,
        name: lookupResult.entityName,
        type: itemType,
        category: lookupResult.category || 'General',
        description: `${lookupResult.entityName} (Scanned via Barcode ${lookupResult.barcode})`,
        unit: planUnit.trim() || 'unit',
        quantity: qty,
        rate: rate,
        sellingRate: rate,
        unitCost: lookupResult.unitCost || 0,
        discountPct: Number(planDiscountPct) || 0,
        taxTreatment: 'Standard (0%)',
        commercialContext: `Added to Plan ${planNumber} via Barcode Scanner (${lookupResult.barcode})`,
        incrementOnDuplicate: incrementIfExists,
        onDuplicate: incrementIfExists ? 'increment' : 'prevent'
      };

      const res: any = await api.addRevenueItemToPlan(planId, payload);

      if (res?.duplicatePrevented && !res?.incremented) {
        showToast?.({
          message: res.message || `Item '${lookupResult.entityName}' is already in plan BOQ. Duplicate financial line was prevented.`,
          type: 'warning'
        });
        setSuccessMessage(`Item is already in this plan. Duplicate financial line was prevented.`);
      } else if (res?.incremented) {
        showToast?.({
          message: res.message || `Incremented quantity of '${lookupResult.entityName}' to ${res.newQuantity} ${planUnit}.`,
          type: 'success'
        });
        setSuccessMessage(`Incremented existing item quantity to ${res.newQuantity} ${planUnit}.`);
        onItemAddedToPlan(res.boqItem);
      } else {
        showToast?.({
          message: `Added '${lookupResult.entityName}' (${lookupResult.barcode}) to plan BOQ.`,
          type: 'success'
        });
        setSuccessMessage(`Successfully added '${lookupResult.entityName}' to plan BOQ!`);
        onItemAddedToPlan(res.boqItem || res);
      }
    } catch (err: any) {
      console.error('Failed to add scanned item to plan:', err);
      setLookupError(err?.message || 'Failed to add item to plan.');
    } finally {
      setIsAdding(false);
    }
  };

  const getEntityBadge = (type: string) => {
    switch (type) {
      case 'material':
        return { label: 'Material', bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' };
      case 'revenue_product':
        return { label: 'Revenue Product', bg: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' };
      case 'revenue_service':
        return { label: 'Revenue Service', bg: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' };
      case 'overhead_item':
        return { label: 'Overhead Item', bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' };
      case 'supplier':
        return { label: 'Supplier (Directory)', bg: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' };
      case 'outsourced_service':
        return { label: 'Outsourced Service', bg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' };
      case 'subcontractor':
        return { label: 'Subcontractor Trade', bg: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300' };
      case 'produce_item':
        return { label: 'Fabricated Assembly', bg: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300' };
      case 'inventory_item':
        return { label: 'Inventory SKU', bg: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300' };
      default:
        return { label: type, bg: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-150">
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#003049] text-white flex items-center justify-center shadow-xs">
              <Barcode className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Scan Barcode into Plan</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-semibold">
                  {planNumber}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Scan or enter any item barcode, Code 128, or product SKU to select and add to plan
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input Mode Tabs */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 px-4 bg-slate-50/40 dark:bg-slate-900/40 gap-2">
          <button
            type="button"
            onClick={() => setScanMode('manual')}
            className={`py-2 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
              scanMode === 'manual'
                ? 'border-blue-600 text-blue-600 dark:text-sky-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Manual / USB Scanner</span>
          </button>

          <button
            type="button"
            onClick={() => setScanMode('camera')}
            className={`py-2 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
              scanMode === 'camera'
                ? 'border-blue-600 text-blue-600 dark:text-sky-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Camera Scanner</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Mode 1: Camera Scanner */}
          {scanMode === 'camera' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-950 p-2 text-center">
              <CameraBarcodeScanner
                autoStart={true}
                onBarcodeDetected={handleCameraScanDetected}
                className="w-full max-h-64 rounded-lg object-cover"
              />
              <p className="text-[11px] text-slate-400 mt-2">
                Align barcode within camera view. Camera will beep automatically upon recognition.
              </p>
            </div>
          )}

          {/* Mode 2: Manual / USB Scanner Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Barcode / SKU / Item Code
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={manualInputRef}
                  type="text"
                  data-barcode-input="true"
                  id="barcode-search-field"
                  placeholder="Scan with USB gun, or type barcode e.g. MAT-1001-A12B..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handlePerformLookup();
                    }
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono font-semibold border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="button"
                disabled={isLookingUp || !barcodeInput.trim()}
                onClick={() => handlePerformLookup()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                {isLookingUp ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                <span>Lookup</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              💡 Hardware USB scanners send keystrokes followed by Enter and trigger instant lookup automatically.
            </p>
          </div>

          {/* Alerts / Error */}
          {lookupError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{lookupError}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Scanned Record Details Card */}
          {lookupResult && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/50 space-y-4 animate-in fade-in-50 duration-150">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${getEntityBadge(lookupResult.entityType).bg}`}>
                      {getEntityBadge(lookupResult.entityType).label}
                    </span>
                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-sky-400">
                      {lookupResult.entityCode}
                    </span>
                    {lookupResult.matchType !== 'exact_barcode' && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 font-medium">
                        Matched via {lookupResult.matchType}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {lookupResult.entityName}
                  </h3>
                  {lookupResult.category && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                      Category: {lookupResult.category} {lookupResult.subCategory ? `› ${lookupResult.subCategory}` : ''}
                    </p>
                  )}
                </div>

                {/* Print/Download Barcode Button */}
                <button
                  type="button"
                  onClick={() => downloadItemBarcode(lookupResult.barcode, lookupResult.entityName)}
                  className="px-2 py-1 text-xs font-semibold rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 flex items-center space-x-1 cursor-pointer shrink-0"
                  title="Export high-contrast Code 128 barcode label PNG"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Barcode Label</span>
                </button>
              </div>

              {/* Barcode Visual Display */}
              <div className="bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Barcode className="w-5 h-5 text-slate-400" />
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Registered Barcode</div>
                    <div className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                      {lookupResult.barcode}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Standard Unit Cost</div>
                  <div className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                    {formatCurrency(lookupResult.unitCost || 0, activeCurrency)} / {lookupResult.unit || 'unit'}
                  </div>
                </div>
              </div>

              {/* Directory-Only Warning (Requirement 20) */}
              {lookupResult.isDirectoryOnly && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>
                    <strong>Directory Record:</strong> Suppliers and client contacts cannot be directly added as financial BOQ items unless an eligible product or service is selected.
                  </span>
                </div>
              )}

              {/* Existing Item In Plan Notice (Requirement 22, 23) */}
              {existingItemInPlan && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-xs space-y-1">
                  <div className="flex items-center space-x-2 font-bold">
                    <Info className="w-4 h-4 text-blue-600 dark:text-sky-400 shrink-0" />
                    <span>Item is already present in this plan BOQ (Qty: {existingItemInPlan.quantity} {existingItemInPlan.unit}).</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 pl-6">
                    Scanning the same barcode again will NOT create a duplicate financial line. You can configure whether to increase the existing item's quantity below.
                  </p>
                </div>
              )}

              {/* Plan Commercial Settings Form */}
              {!lookupResult.isDirectoryOnly && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Plan-Specific Commercial Terms</span>
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        min="0.001"
                        step="any"
                        value={planQuantity}
                        onChange={(e) => setPlanQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Unit
                      </label>
                      <input
                        type="text"
                        value={planUnit}
                        onChange={(e) => setPlanUnit(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Selling Rate ({activeCurrency}) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={planRate}
                        onChange={(e) => setPlanRate(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Discount %
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={planDiscountPct}
                        onChange={(e) => setPlanDiscountPct(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                  </div>

                  {/* Duplicate Behavior Configuration (Requirement 22, 23) */}
                  <div className="flex items-center space-x-2 pt-1">
                    <input
                      type="checkbox"
                      id="increment-duplicate-toggle"
                      checked={incrementIfExists}
                      onChange={(e) => setIncrementIfExists(e.target.checked)}
                      className="rounded text-blue-600 cursor-pointer"
                    />
                    <label htmlFor="increment-duplicate-toggle" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <strong>Repeated Scans:</strong> If this item already exists in this plan, increase existing quantity instead of adding a duplicate line.
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="text-xs text-slate-500">
            {lookupResult ? (
              <span>
                Selected: <strong className="text-slate-800 dark:text-slate-200">{lookupResult.entityName}</strong>
              </span>
            ) : (
              <span>Ready to scan or enter barcode.</span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              Close
            </button>

            {lookupResult && !lookupResult.isDirectoryOnly && (
              <button
                type="button"
                disabled={isAdding}
                onClick={handleAddItemToPlan}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                {isAdding ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>
                  {existingItemInPlan && incrementIfExists ? 'Increment Quantity' : 'Add to Plan BOQ'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
