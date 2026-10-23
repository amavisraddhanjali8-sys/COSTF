import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  RotateCw,
  Edit,
  Plus,
  Download,
  Upload,
  Mail,
  CheckSquare,
  Square,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Trash2,
  History,
  DollarSign,
  Layers,
  Boxes,
  Truck,
  Cpu,
  FileText,
  ChevronLeft,
  ChevronRight,
  X,
  ChevronDown,
  Building2,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  Tag,
  ArrowLeft,
  Maximize2,
  Minimize2,
  Sliders,
  LayoutGrid,
  List,
  Info,
  Scale
} from 'lucide-react';
import {
  MaterialItem,
  OutsourcedService,
  SubcontractorRateItem,
  Supplier,
  Project,
  ProduceItem,
  MaterialVendorQuote,
  VendorPriceChangeRecord,
  VolumePriceTier,
  OverheadItem,
  RevenueItem
} from '../types';
import { MaterialVendorPriceMatrixModal } from './MaterialVendorPriceMatrixModal';
import { ProductCompetitorPriceMatrixModal } from './pricing/ProductCompetitorPriceMatrixModal';
import { VendorLatestRangesModal } from './VendorLatestRangesModal';
import { RevisionChangesAuditModal } from './RevisionChangesAuditModal';
import { ItemImageViewerModal } from './ItemImageViewerModal';
import { ItemGridCard } from './ItemGridCard';
import { ItemDetailsAndPriceAuditModal } from './ItemDetailsAndPriceAuditModal';
import { FXTTPriceAuditLogFullScreenModal } from './FXTTPriceAuditLogFullScreenModal';
import { INITIAL_CATEGORY_HIERARCHY, CategoryNode } from '../data/categoriesAndProfiles';
import { exportCategoryCatalogPDF, exportPriceAuditLogPDF } from '../utils/pdfExport';
import { exportAllPriceHistoriesToCSV } from '../utils/csvExport';
import { DataImportExportModal } from './DataImportExportModal';
import { GoogleSearchPreviewModal, GoogleSearchPreviewItem } from './GoogleSearchPreviewModal';
import { api } from '../services/api';

export interface FXTTGridRow {
  id: string;
  code: string;
  name: string;
  itemType: 'material' | 'final_product' | 'full_contract' | 'service' | 'subcontractor' | 'produce' | 'project' | 'overhead' | 'revenue';
  status: 'In Stock' | 'Active' | 'Read only' | 'Enabled' | 'Lead Exist' | 'Under Review' | 'Completed' | 'Pending';
  category: string;
  subCategory: string;
  moreSubCategory?: string;
  supplierName: string;
  supplierCountry: string;
  email: string;
  phone: string;
  rate: number;
  retailPrice?: number;
  unit: string;
  stockOrScope: string;
  createdTime: string;
  assignedTo: string;
  imageUrl?: string;
  rawItem: any;
}

interface FXTTCardItemsListViewProps {
  cardType:
    | 'material_category'
    | 'product_category'
    | 'service_category'
    | 'service_provider'
    | 'outsourced'
    | 'supplier'
    | 'project'
    | 'subcontractor'
    | 'client'
    | 'produce'
    | 'overhead'
    | 'revenue';
  cardId?: string;
  cardTitle: string;
  cardSubtitle?: string;
  cardTag?: string;
  materials: MaterialItem[];
  suppliers: Supplier[];
  outsourcedServices: OutsourcedService[];
  subcontractors: SubcontractorRateItem[];
  projects: Project[];
  produceItems?: ProduceItem[];
  overheads?: OverheadItem[];
  revenueItems?: RevenueItem[];
  categories?: CategoryNode[];
  onClose?: () => void;
  onUpdatePrice?: (id: string, newPrice: number, reason: string) => void;
  onUpdateMaterialPrice?: (id: string, newPrice: number, reason: string) => void;
  onUpdateMaterial?: (id: string, updated: Partial<MaterialItem>) => void;
  onDeleteMaterial?: (id: string) => void;
  onAddMaterial?: (m: Partial<MaterialItem>) => void;
  onAddSupplier?: (s: Partial<Supplier>) => void;
  onUpdateSupplier?: (id: string, updated: Partial<Supplier>) => void;
  onDeleteSupplier?: (id: string) => void;
  onAddOutsourcedService?: (s: Partial<OutsourcedService>) => void;
  onUpdateOutsourcedService?: (id: string, updated: Partial<OutsourcedService>) => void;
  onDeleteOutsourcedService?: (id: string) => void;
  onAddSubcontractor?: (s: Partial<SubcontractorRateItem>) => void;
  onUpdateSubcontractor?: (id: string, updated: Partial<SubcontractorRateItem>) => void;
  onDeleteSubcontractor?: (id: string) => void;
  onAddProduceItem?: (item: Partial<ProduceItem>) => void;
  onUpdateProduceItem?: (id: string, item: Partial<ProduceItem>) => void;
  onDeleteProduceItem?: (id: string) => void;
  onAddOverheadItem?: (item: Partial<OverheadItem>) => void;
  onUpdateOverheadItem?: (id: string, item: Partial<OverheadItem>) => void;
  onDeleteOverheadItem?: (id: string) => void;
  onAddRevenueItem?: (item: Partial<RevenueItem>) => void;
  onUpdateRevenueItem?: (id: string, item: Partial<RevenueItem>) => void;
  onDeleteRevenueItem?: (id: string) => void;
  onAddToProject?: (item: any, projectId: string) => void;
  onSelectProject?: (project: Project) => void;
  onNavigateToCostAnalysis?: (project: Project) => void;
  onAddProject?: (project: Partial<Project>) => void;
  onUpdateProject?: (id: string, project: Partial<Project>) => void;
  onDeleteProject?: (id: string) => void;
  isModal?: boolean;
}

export const FXTTCardItemsListView: React.FC<FXTTCardItemsListViewProps> = ({
  cardType,
  cardId,
  cardTitle,
  cardSubtitle,
  cardTag,
  materials,
  suppliers,
  outsourcedServices,
  subcontractors,
  projects,
  produceItems = [],
  overheads = [],
  revenueItems = [],
  categories,
  onClose,
  onUpdatePrice,
  onUpdateMaterialPrice,
  onUpdateMaterial,
  onDeleteMaterial,
  onAddMaterial,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  onAddOutsourcedService,
  onUpdateOutsourcedService,
  onDeleteOutsourcedService,
  onAddSubcontractor,
  onUpdateSubcontractor,
  onDeleteSubcontractor,
  onAddToProject,
  onAddProduceItem,
  onUpdateProduceItem,
  onDeleteProduceItem,
  onAddOverheadItem,
  onUpdateOverheadItem,
  onDeleteOverheadItem,
  onAddRevenueItem,
  onUpdateRevenueItem,
  onDeleteRevenueItem,
  onSelectProject,
  onNavigateToCostAnalysis,
  onAddProject,
  onUpdateProject,
  onDeleteProject,
  isModal = true
}) => {
  // Display Mode: Table List View vs Cards Grid View
  const [displayMode, setDisplayMode] = useState<'list' | 'grid'>('list');

  // Dedicated project detail modal for client profile projects view
  const [activeProjectDetail, setActiveProjectDetail] = useState<Project | null>(null);

  // Full screen view state initialized from isModal prop
  const [isFullScreen, setIsFullScreen] = useState<boolean>(isModal);

  useEffect(() => {
    setIsFullScreen(isModal);
  }, [isModal]);

  // Handle Escape key to close modal/full screen view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Top Filter Tabs (matching FXTT screenshot: ALL, TODAY, LAST 7 DAYS, FUNDED ACCOUNTS, CUSTOM TAB)
  const [activeFilterTab, setActiveFilterTab] = useState<string>('ALL');

  // Multi-Vendor / Multi-Provider Price Matrix modal state
  const [activeVendorMatrixMaterial, setActiveVendorMatrixMaterial] = useState<MaterialItem | null>(null);

  // Dedicated Product & Revenue Competitor Benchmark Matrix Modal state
  const [activeCompetitorModalItem, setActiveCompetitorModalItem] = useState<{
    item: {
      id: string;
      code: string;
      name: string;
      category?: string;
      unit?: string;
      ourPrice: number;
      ourCost?: number;
      currency?: string;
      type?: 'product' | 'service';
    };
    itemType?: 'revenue_item' | 'produce';
  } | null>(null);

  // Dedicated Ranges Simulation Modal state
  const [activeRangesVendor, setActiveRangesVendor] = useState<{
    vendor: MaterialVendorQuote;
    material: MaterialItem;
  } | null>(null);

  // Dedicated Change Logs & Audit Modal state
  const [activeAuditRecord, setActiveAuditRecord] = useState<{
    material: MaterialItem;
    vendorQuotes: MaterialVendorQuote[];
  } | null>(null);

  // Full Screen FXTT Price Changes Audit Log Grid state
  const [fullScreenAuditItem, setFullScreenAuditItem] = useState<any | null>(null);

  // In-System Google & Google Lens Quick Search Modal state
  const [googleSearchItem, setGoogleSearchItem] = useState<GoogleSearchPreviewItem | null>(null);

  // Effective price commit function
  const handleCommitPrice = (id: string, newPrice: number, reason: string) => {
    if (onUpdatePrice) {
      onUpdatePrice(id, newPrice, reason);
    } else if (onUpdateMaterialPrice) {
      onUpdateMaterialPrice(id, newPrice, reason);
    }
  };

  // Filter By field selector dropdown
  const [filterByField, setFilterByField] = useState<string>('all');
  const [topQuickSearch, setTopQuickSearch] = useState<string>('');

  // Column search filters
  const [columnSearch, setColumnSearch] = useState({
    code: '',
    name: '',
    status: '',
    category: '',
    country: '',
    email: '',
    phone: '',
    date: '',
    assignedTo: ''
  });

  // Status operator menu popup: Equals, Not equal to, Starts with, Ends with, Does not contain
  const [statusOperator, setStatusOperator] = useState<string>('Contains');
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);

  // Category / Country filter dropdown popup
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set(['ALL']));

  // Sorting
  const [sortField, setSortField] = useState<keyof FXTTGridRow>('code');
  const [sortAsc, setSortAsc] = useState(true);

  // Multi-select rows
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState<number>(25);

  // Quick edit modal
  const [editingRow, setEditingRow] = useState<FXTTGridRow | null>(null);
  const [newRate, setNewRate] = useState<number>(0);
  const [editReason, setEditReason] = useState<string>('');
  const [addedRows, setAddedRows] = useState<FXTTGridRow[]>([]);
  const [editedRowsMap, setEditedRowsMap] = useState<Record<string, Partial<FXTTGridRow>>>({});

  // Reset ephemeral state when viewing card changes to prevent row leakage across subcategories
  useEffect(() => {
    setAddedRows([]);
    setEditedRowsMap({});
    setSelectedIds(new Set());
    setCurrentPage(1);
  }, [cardId, cardTitle, cardType, cardTag]);

  // Item Image Viewer Modal state
  const [activeImageViewerItem, setActiveImageViewerItem] = useState<FXTTGridRow | null>(null);

  // Item Details & Price Audit Modal state (triggered by bottom pill button or info commands)
  const [detailsAndAuditItem, setDetailsAndAuditItem] = useState<FXTTGridRow | null>(null);
  const [detailsAndAuditTab, setDetailsAndAuditTab] = useState<'details' | 'audit'>('details');
  const [deletedRowIds, setDeletedRowIds] = useState<Set<string>>(new Set());
  const [rowToDelete, setRowToDelete] = useState<FXTTGridRow | null>(null);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);

  const handleViewDetailsAndAudit = (row: FXTTGridRow, tab: 'details' | 'audit' = 'details') => {
    setDetailsAndAuditItem(row);
    setDetailsAndAuditTab(tab);
  };

  const handleDeleteRow = (row: FXTTGridRow) => {
    setRowToDelete(row);
  };

  const confirmDeleteRow = () => {
    if (!rowToDelete) return;
    const row = rowToDelete;
    if (row.itemType === 'material' || cardType === 'material_category') {
      onDeleteMaterial?.(row.id);
      api.deleteMaterial(row.id).catch(console.error);
    } else if (row.itemType === 'produce' || row.itemType === 'final_product' || cardType === 'product_category' || cardType === 'produce') {
      onDeleteProduceItem?.(row.id);
      api.deleteProduceItem(row.id).catch(console.error);
    } else if (row.itemType === 'subcontractor' || cardType === 'subcontractor') {
      onDeleteSubcontractor?.(row.id);
      api.deleteSubcontractor(row.id).catch(console.error);
    } else if (row.itemType === 'service' || cardType === 'service_provider' || cardType === 'outsourced') {
      onDeleteOutsourcedService?.(row.id);
      api.deleteOutsourcedService(row.id).catch(console.error);
    } else if (row.itemType === 'overhead' || cardType === 'overhead') {
      onDeleteOverheadItem?.(row.id);
      api.deleteOverheadItem(row.id).catch(console.error);
    } else if (row.itemType === 'revenue' || cardType === 'revenue') {
      onDeleteRevenueItem?.(row.id);
      api.deleteRevenueItem(row.id).catch(console.error);
    } else if (row.itemType === 'full_contract' || cardType === 'supplier') {
      onDeleteSupplier?.(row.id);
      api.deleteSupplier(row.id).catch(console.error);
    } else if (row.itemType === 'project' || cardType === 'client' || cardType === 'project') {
      onDeleteProject?.(row.id);
      api.deleteProject(row.id).catch(console.error);
    }
    setDeletedRowIds((prev) => new Set([...prev, row.id]));
    setAddedRows((prev) => prev.filter((r) => r.id !== row.id));
    showNotification(`Item ${row.code} (${row.name}) deleted successfully.`);
    setRowToDelete(null);
  };

  const handleConfirmBulkDelete = () => {
    selectedIds.forEach((id) => {
      const row = rows.find((r) => r.id === id);
      if (row) {
        if (row.itemType === 'material' || cardType === 'material_category') {
          onDeleteMaterial?.(row.id);
          api.deleteMaterial(row.id).catch(console.error);
        } else if (row.itemType === 'produce' || row.itemType === 'final_product' || cardType === 'product_category' || cardType === 'produce') {
          onDeleteProduceItem?.(row.id);
          api.deleteProduceItem(row.id).catch(console.error);
        } else if (row.itemType === 'subcontractor' || cardType === 'subcontractor') {
          onDeleteSubcontractor?.(row.id);
          api.deleteSubcontractor(row.id).catch(console.error);
        } else if (row.itemType === 'service' || cardType === 'service_provider' || cardType === 'outsourced') {
          onDeleteOutsourcedService?.(row.id);
          api.deleteOutsourcedService(row.id).catch(console.error);
        } else if (row.itemType === 'overhead' || cardType === 'overhead') {
          onDeleteOverheadItem?.(row.id);
          api.deleteOverheadItem(row.id).catch(console.error);
        } else if (row.itemType === 'revenue' || cardType === 'revenue') {
          onDeleteRevenueItem?.(row.id);
          api.deleteRevenueItem(row.id).catch(console.error);
        } else if (row.itemType === 'full_contract' || cardType === 'supplier') {
          onDeleteSupplier?.(row.id);
          api.deleteSupplier(row.id).catch(console.error);
        } else if (row.itemType === 'project' || cardType === 'client' || cardType === 'project') {
          onDeleteProject?.(row.id);
          api.deleteProject(row.id).catch(console.error);
        }
      }
    });

    setDeletedRowIds((prev) => new Set([...prev, ...selectedIds]));
    setAddedRows((prev) => prev.filter((r) => !selectedIds.has(r.id)));
    showNotification(`Deleted ${selectedIds.size} selected items from catalog.`);
    setSelectedIds(new Set());
    setIsBulkDeleteConfirmOpen(false);
  };

  // Toast notification
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Synthesizes or retrieves full MaterialItem and MaterialVendorQuote[] with complete volume ranges & change histories
  const buildItemMaterialAndQuotes = (
    row: FXTTGridRow
  ): { material: MaterialItem; quotes: MaterialVendorQuote[] } => {
    // 1. If row is already backed by a MaterialItem in materials:
    let existingMat = materials.find(
      (m) => m.id === row.id || m.code === row.code || m.name.toLowerCase() === row.name.toLowerCase()
    );
    if (!existingMat && row.rawItem && ('retailPrice' in row.rawItem && 'itemClassification' in row.rawItem)) {
      existingMat = row.rawItem as MaterialItem;
    }
    if (existingMat && existingMat.vendorQuotes && existingMat.vendorQuotes.length > 0) {
      return { material: existingMat, quotes: existingMat.vendorQuotes };
    }

    // 2. If row is a subcontractor
    if (row.itemType === 'subcontractor') {
      const rawSub = row.rawItem as SubcontractorRateItem | undefined;
      // Find all subcontractor quotes offering services in the same subCategory or same name
      const relatedSubs = subcontractors.filter(
        (s) =>
          (s.serviceSubCategory && s.serviceSubCategory.toLowerCase() === row.subCategory.toLowerCase()) ||
          (s.subCategory && s.subCategory.toLowerCase() === row.subCategory.toLowerCase()) ||
          (s.nicheServiceName && s.nicheServiceName.toLowerCase() === row.name.toLowerCase()) ||
          s.id === row.id
      );

      const itemsToMap = relatedSubs.length > 0 ? relatedSubs : rawSub ? [rawSub] : [];

      const quotes: MaterialVendorQuote[] = itemsToMap.map((s) => {
        const volumePricing: VolumePriceTier[] =
          s.bulkPricingRanges && s.bulkPricingRanges.length > 0
            ? s.bulkPricingRanges.map((bp) => ({
                minQty: bp.minVolume,
                maxQty: bp.maxVolume,
                unitPrice: bp.unitRate,
                discountPct: bp.discountPct,
                label: `${bp.minVolume}–${bp.maxVolume ? bp.maxVolume : '+'} ${s.unit.replace('per_', '')} ($${bp.unitRate})`
              }))
            : s.rateRanges && s.rateRanges.length > 0
            ? s.rateRanges.map((rr) => ({
                minQty: rr.minUnits,
                maxQty: rr.maxUnits,
                unitPrice: rr.rate,
                discountPct: 0,
                label: rr.label || `${rr.minUnits}–${rr.maxUnits ? rr.maxUnits : '+'} ${s.unit.replace('per_', '')} ($${rr.rate})`
              }))
            : [
                {
                  minQty: 1,
                  maxQty: 40,
                  unitPrice: s.rate ?? s.baseRate ?? 0,
                  discountPct: 0,
                  label: `1–40 ${s.unit} (Standard)`
                },
                {
                  minQty: 41,
                  maxQty: 120,
                  unitPrice: Number(((s.rate ?? s.baseRate ?? 0) * 0.92).toFixed(2)),
                  discountPct: 8,
                  label: `41–120 ${s.unit} (Volume Tier)`
                },
                {
                  minQty: 121,
                  unitPrice: Number(((s.rate ?? s.baseRate ?? 0) * 0.85).toFixed(2)),
                  discountPct: 15,
                  label: `121+ ${s.unit} (Full Master Lot)`
                }
              ];

        const priceHistory: VendorPriceChangeRecord[] =
          s.priceHistory && s.priceHistory.length > 0
            ? s.priceHistory.map((ph, phIdx) => ({
                id: ph.id || `hist-${s.id}-${phIdx}`,
                date: ph.date || '',
                price: ph.newPrice ?? ph.newRate ?? s.rate ?? s.baseRate ?? 100,
                previousPrice: ph.previousPrice ?? ph.previousRate ?? Number(((s.rate || 100) * 0.95).toFixed(2)),
                changePct: ph.changePct ?? 5.2,
                reason: ph.reason || 'Trade labor adjustment',
                updatedBy: ph.updatedBy || 'Operations'
              }))
            : [];

        return {
          vendorId: s.subcontractorId || s.id,
          vendorName: s.subcontractorName,
          country: (s as any).country || 'United States',
          currentPrice: s.rate ?? s.baseRate ?? 0,
          currency: 'USD',
          leadTimeDays: 3,
          moq: 1,
          isPreferred: s.id === row.id || s.subcontractorName === row.supplierName,
          status: 'Preferred',
          lastUpdated: s.lastUpdated || '',
          contactEmail: (s as any).contactEmail || 'contracts@subcontractor.com',
          contactPhone: (s as any).contactPhone || '+1 (800) 555-0188',
          notes: s.skillLevel || 'Certified field specialist trade labor.',
          volumePricing,
          priceHistory
        };
      });

      const material: MaterialItem = {
        id: row.id,
        code: row.code,
        name: row.name,
        category: row.category,
        subCategory: row.subCategory,
        moreSubCategory: row.moreSubCategory || 'Trade Specialty',
        itemClassification: 'full_contract',
        supplierId: quotes[0]?.vendorId || 'sub-01',
        supplierName: row.supplierName,
        unit: row.unit,
        retailPrice: row.rate,
        defaultDiscountPct: 5,
        volumePricing: quotes[0]?.volumePricing || [],
        vendorQuotes: quotes,
        inStock: 100,
        reorderPoint: 20,
        leadTimeDays: 3,
        lastUpdated: rawSub?.lastUpdated || '',
        priceHistory: (quotes[0]?.priceHistory || []).map((ph) => ({
          id: ph.id,
          date: ph.date,
          previousPrice: ph.previousPrice ?? 0,
          newPrice: ph.price,
          changePct: ph.changePct ?? 0,
          reason: ph.reason,
          updatedBy: ph.updatedBy
        }))
      };

      return { material, quotes };
    }

    // 3. If row is an outsourced service:
    if (row.itemType === 'service') {
      const rawOut = row.rawItem as OutsourcedService | undefined;
      const relatedOutsourced = outsourcedServices.filter(
        (o) =>
          o.subCategory.toLowerCase() === row.subCategory.toLowerCase() ||
          o.name.toLowerCase() === row.name.toLowerCase() ||
          o.id === row.id
      );

      const itemsToMap = relatedOutsourced.length > 0 ? relatedOutsourced : rawOut ? [rawOut] : [];

      const quotes: MaterialVendorQuote[] = itemsToMap.map((o) => {
        const volumePricing: VolumePriceTier[] =
          o.tierRates && o.tierRates.length > 0
            ? o.tierRates.map((tr) => ({
                minQty: tr.minVolume,
                maxQty: tr.maxVolume,
                unitPrice: tr.rate,
                discountPct: Number(((1 - tr.rate / (o.tierRates[0]?.rate || tr.rate)) * 100).toFixed(1)),
                label: tr.description || `${tr.minVolume}–${tr.maxVolume ? tr.maxVolume : '+'} ${o.baseUnitType.replace('per_', '')} ($${tr.rate})`
              }))
            : [
                {
                  minQty: 1,
                  maxQty: 100,
                  unitPrice: o.rate,
                  discountPct: 0,
                  label: `1–100 ${o.baseUnitType} (Base Rate)`
                },
                {
                  minQty: 101,
                  maxQty: 500,
                  unitPrice: Number((o.rate * 0.9).toFixed(2)),
                  discountPct: 10,
                  label: `101–500 ${o.baseUnitType} (Tier 2 Volume)`
                },
                {
                  minQty: 501,
                  unitPrice: Number((o.rate * 0.82).toFixed(2)),
                  discountPct: 18,
                  label: `501+ ${o.baseUnitType} (Tier 3 Enterprise)`
                }
              ];

        const priceHistory: VendorPriceChangeRecord[] =
          o.priceHistory && o.priceHistory.length > 0
            ? o.priceHistory.map((ph, phIdx) => ({
                id: ph.id || `hist-${o.id}-${phIdx}`,
                date: ph.date || '',
                price: ph.newRate,
                previousPrice: ph.oldRate,
                changePct: Number((((ph.newRate - ph.oldRate) / ph.oldRate) * 100).toFixed(1)),
                reason: ph.reason || 'Tariff indexing review',
                updatedBy: ph.updatedBy || 'Logistics'
              }))
            : [];

        return {
          vendorId: o.providerId || o.id,
          vendorName: o.providerName,
          country: (o as any).country || 'United States',
          currentPrice: o.rate,
          currency: 'USD',
          leadTimeDays: 2,
          moq: 1,
          isPreferred: o.id === row.id || o.providerName === row.supplierName,
          status: 'Preferred',
          lastUpdated: o.lastUpdated || '',
          contactEmail: (o as any).contactEmail || 'contracts@outsourced-provider.com',
          contactPhone: (o as any).contactPhone || '+1 (800) 555-0199',
          notes: o.slaLevel || 'Hired external contracted service.',
          volumePricing,
          priceHistory
        };
      });

      const material: MaterialItem = {
        id: row.id,
        code: row.code,
        name: row.name,
        category: row.category,
        subCategory: row.subCategory,
        moreSubCategory: row.moreSubCategory || 'Contracted Service',
        itemClassification: 'full_contract',
        supplierId: quotes[0]?.vendorId || 'out-01',
        supplierName: row.supplierName,
        unit: row.unit,
        retailPrice: row.rate,
        defaultDiscountPct: 5,
        volumePricing: quotes[0]?.volumePricing || [],
        vendorQuotes: quotes,
        inStock: 100,
        reorderPoint: 20,
        leadTimeDays: 2,
        lastUpdated: rawOut?.lastUpdated || '',
        priceHistory: (quotes[0]?.priceHistory || []).map((ph) => ({
          id: ph.id,
          date: ph.date,
          previousPrice: ph.previousPrice ?? 0,
          newPrice: ph.price,
          changePct: ph.changePct ?? 0,
          reason: ph.reason,
          updatedBy: ph.updatedBy
        }))
      };

      return { material, quotes };
    }

    // Product Variants (produced products)
    if (row.itemType === 'final_product' || cardType === 'product_category' || cardType === 'produce') {
      const rawProd = (row.rawItem as ProduceItem) || produceItems?.find((p) => p.id === row.id);
      const volumePricing: VolumePriceTier[] = (rawProd?.bundlesAndRanges || []).map((b) => ({
        minQty: b.minQty,
        unitPrice: b.unitPrice,
        discountPct: b.discountPct,
        label: b.label || `${b.minQty}+ ${rawProd?.unit || 'units'}`
      }));

      const priceHistory = (rawProd?.priceHistory || []).map((ph) => ({
        id: ph.id,
        date: ph.date,
        previousPrice: ph.previousPrice,
        newPrice: ph.newPrice,
        changePct: ph.changePct,
        reason: ph.reason,
        updatedBy: ph.updatedBy
      }));

      const quotes: MaterialVendorQuote[] = [
        {
          vendorId: 'sup-inhouse-01',
          vendorName: 'In-House Advanced Manufacturing & Assembly',
          country: 'United States',
          currentPrice: row.rate,
          currency: 'USD',
          leadTimeDays: rawProd?.leadTimeDays || 45,
          moq: 1,
          isPreferred: true,
          status: 'Preferred',
          lastUpdated: rawProd?.lastUpdated || '',
          contactEmail: 'production-ops@fxtt-enterprise.com',
          contactPhone: '+1 (415) 252-7217',
          notes: rawProd?.description || 'Manufactured in-house to certified aerospace standards.',
          volumePricing,
          priceHistory: priceHistory.map((ph) => ({
            id: ph.id,
            date: ph.date,
            price: ph.newPrice,
            previousPrice: ph.previousPrice,
            changePct: ph.changePct,
            reason: ph.reason,
            updatedBy: ph.updatedBy
          }))
        }
      ];

      const material: MaterialItem = {
        id: row.id,
        code: row.code,
        name: row.name,
        category: row.category,
        subCategory: row.subCategory,
        moreSubCategory: row.moreSubCategory || 'Precision Variant',
        itemClassification: 'final_product',
        supplierId: 'sup-inhouse-01',
        supplierName: 'In-House Advanced Manufacturing',
        unit: row.unit,
        retailPrice: row.retailPrice || row.rate,
        defaultDiscountPct: rawProd?.defaultDiscountPct || 5,
        volumePricing,
        vendorQuotes: quotes,
        inStock: 5,
        reorderPoint: 2,
        leadTimeDays: rawProd?.leadTimeDays || 45,
        lastUpdated: rawProd?.lastUpdated || '',
        priceHistory
      };

      return { material, quotes };
    }

    // Default material fallback
    const fallbackMat = existingMat || {
      id: row.id,
      code: row.code,
      name: row.name,
      category: row.category,
      subCategory: row.subCategory,
      moreSubCategory: row.moreSubCategory || 'Standard Grade',
      itemClassification: 'raw_material' as const,
      supplierId: 'sup-01',
      supplierName: row.supplierName || 'Apex Precision Metallurgy Corp',
      unit: row.unit || 'pcs',
      retailPrice: row.rate || 420,
      defaultDiscountPct: 5,
      volumePricing: [],
      inStock: 120,
      reorderPoint: 30,
      leadTimeDays: 7,
      lastUpdated: existingMat?.lastUpdated || '',
      priceHistory: []
    };
    return { material: fallbackMat, quotes: fallbackMat.vendorQuotes || [] };
  };

  // Open Multi-Vendor / Multi-Provider Price Matrix modal or Project Details or Competitor Benchmark
  const handleViewItem = (row: FXTTGridRow) => {
    if (cardType === 'client' || row.itemType === 'project') {
      if (row.rawItem) {
        setActiveProjectDetail(row.rawItem as Project);
      } else {
        const proj = projects.find((p) => p.id === row.id || p.code === row.code);
        if (proj) setActiveProjectDetail(proj);
      }
      return;
    }

    // Products and Revenue Deliverables do not have suppliers/vendors; they only have Our Rates vs Competitor Benchmarks
    if (
      row.itemType === 'final_product' ||
      row.itemType === 'produce' ||
      row.itemType === 'revenue' ||
      cardType === 'product_category' ||
      cardType === 'produce' ||
      cardType === 'revenue'
    ) {
      setActiveCompetitorModalItem({
        item: {
          id: row.id,
          code: row.code,
          name: row.name,
          category: row.category,
          unit: row.unit,
          ourPrice: row.retailPrice || Number((Number(row.rate) * 1.35).toFixed(2)),
          ourCost: row.rate,
          currency: 'USD',
          type: row.itemType === 'service' ? 'service' : 'product'
        },
        itemType: row.itemType === 'produce' || cardType === 'produce' ? 'produce' : 'revenue_item'
      });
      return;
    }

    const { material, quotes } = buildItemMaterialAndQuotes(row);
    material.vendorQuotes = quotes;
    setActiveVendorMatrixMaterial(material);
  };

  // Open Dedicated Volume Ranges Simulation Modal
  const handleOpenRangesModal = (row: FXTTGridRow) => {
    if (
      row.itemType === 'final_product' ||
      row.itemType === 'produce' ||
      row.itemType === 'revenue' ||
      cardType === 'product_category' ||
      cardType === 'produce' ||
      cardType === 'revenue'
    ) {
      setActiveCompetitorModalItem({
        item: {
          id: row.id,
          code: row.code,
          name: row.name,
          category: row.category,
          unit: row.unit,
          ourPrice: row.retailPrice || Number((Number(row.rate) * 1.35).toFixed(2)),
          ourCost: row.rate,
          currency: 'USD',
          type: row.itemType === 'service' ? 'service' : 'product'
        },
        itemType: row.itemType === 'produce' || cardType === 'produce' ? 'produce' : 'revenue_item'
      });
      return;
    }

    const { material, quotes } = buildItemMaterialAndQuotes(row);
    const targetVendor =
      quotes.find(
        (q) =>
          q.vendorName === row.supplierName ||
          q.vendorId === row.supplierName ||
          q.vendorName.toLowerCase() === row.supplierName.toLowerCase()
      ) || quotes[0];

    if (targetVendor) {
      setActiveRangesVendor({ vendor: targetVendor, material });
    }
  };

  // Open Dedicated Change Logs & Audit Modal
  const handleOpenAuditModal = (row: FXTTGridRow) => {
    const { material, quotes } = buildItemMaterialAndQuotes(row);
    setActiveAuditRecord({ material, vendorQuotes: quotes });
  };

  const handleUpdateMatrixMaterial = (updatedMat: MaterialItem) => {
    setActiveVendorMatrixMaterial(updatedMat);
    if (onUpdateMaterial) {
      onUpdateMaterial(updatedMat.id, updatedMat);
    }
    if (onUpdatePrice) {
      onUpdatePrice(
        updatedMat.id,
        updatedMat.retailPrice,
        `Price updated via Multi-Vendor Comparison Matrix (${updatedMat.supplierName})`
      );
    }
    showNotification(`Multi-vendor quote matrix updated for ${updatedMat.code}.`);
  };

  // Convert and filter card-specific items into uniform FXTT rows
  const rows: FXTTGridRow[] = useMemo(() => {
    const list: FXTTGridRow[] = [];
    const titleLower = cardTitle.toLowerCase();
    const idLower = (cardId || '').toLowerCase();

    const isSubCat =
      cardTag === 'SUB-CATEGORY' ||
      cardTag === 'DEEP MATERIAL SPEC' ||
      cardTag === 'PRODUCT SUB-CATEGORY' ||
      cardTag === 'OVERHEAD SUB-CATEGORY' ||
      cardTag === 'CUSTOMER SERVICE TARIFF' ||
      cardTag === 'HIRED SUBCONTRACTOR TRADE' ||
      (cardSubtitle && cardSubtitle.toLowerCase().includes('sub-category')) ||
      (categories || []).some(
        (c) =>
          (c.id === cardId || c.name.toLowerCase() === titleLower) &&
          (c.type === 'sub_category' || c.type === 'sub_sub_category')
      );

    // 1. SUPPLIER CARD: View all materials and supplies strictly relevant to this supplier only, or all suppliers
    if (cardType === 'supplier') {
      const isAll =
        !cardId ||
        cardId === 'all' ||
        cardId === 'all-suppliers' ||
        titleLower.includes('all') ||
        titleLower.includes('directory') ||
        titleLower.includes('catalog');

      if (isAll) {
        materials.forEach((m, idx) => {
          const sup = suppliers.find((s) => s.id === m.supplierId || s.name.toLowerCase() === m.supplierName.toLowerCase());
          list.push({
            id: m.id,
            code: m.code || `MAT-SUP-${1000 + idx}`,
            name: m.name,
            itemType:
              m.itemClassification === 'final_product'
                ? 'final_product'
                : m.itemClassification === 'full_contract'
                ? 'full_contract'
                : 'material',
            status: m.inStock > 20 ? 'In Stock' : m.inStock > 0 ? 'Lead Exist' : 'Active',
            category: m.category,
            subCategory: m.subCategory,
            moreSubCategory: m.moreSubCategory,
            supplierName: m.supplierName || sup?.name || 'Approved Supplier',
            supplierCountry: sup?.country || 'United States',
            email: sup?.email || 'procurement@supplier-portal.com',
            phone: sup?.phone || '+1 415 890 2100',
            rate: m.retailPrice,
            retailPrice: m.retailPrice,
            unit: m.unit,
            stockOrScope: `${m.inStock} ${m.unit}s in stock • Lead: ${m.leadTimeDays}d • Reorder: ${m.reorderPoint}`,
            createdTime: m.lastUpdated || '',
            assignedTo: 'Procurement Specialist',
            rawItem: m
          });
        });
      } else {
        const sup = suppliers.find(
          (s) => s.id === cardId || s.name.toLowerCase() === titleLower
        );
        const supName = sup ? sup.name : cardTitle;
        const supCountry = sup?.country || 'United States';
        const supEmail = sup?.email || 'procurement@supplier-portal.com';
        const supPhone = sup?.phone || '+1 415 890 2100';

        // 1A. Directly Supplied Materials & Raw Inventory
        materials
          .filter(
            (m) =>
              m.supplierId === cardId ||
              (sup && m.supplierId === sup.id) ||
              m.supplierName.toLowerCase() === supName.toLowerCase() ||
              (sup && m.supplierName.toLowerCase().includes(sup.name.toLowerCase())) ||
              (sup && sup.name.toLowerCase().includes(m.supplierName.toLowerCase()))
          )
          .forEach((m, idx) => {
            list.push({
              id: m.id,
              code: m.code || `MAT-SUP-${1000 + idx}`,
              name: m.name,
              itemType:
                m.itemClassification === 'final_product'
                  ? 'final_product'
                  : m.itemClassification === 'full_contract'
                  ? 'full_contract'
                  : 'material',
              status: m.inStock > 20 ? 'In Stock' : m.inStock > 0 ? 'Lead Exist' : 'Active',
              category: m.category,
              subCategory: m.subCategory,
              moreSubCategory: m.moreSubCategory,
              supplierName: supName,
              supplierCountry: supCountry,
              email: supEmail,
              phone: supPhone,
              rate: m.retailPrice,
              retailPrice: m.retailPrice,
              unit: m.unit,
              stockOrScope: `${m.inStock} ${m.unit}s in stock • Lead: ${m.leadTimeDays}d • Reorder: ${m.reorderPoint}`,
              createdTime: m.lastUpdated || '',
              assignedTo: 'Procurement Specialist',
              rawItem: m
            });
          });

        // 1B. Materials where this supplier provides an authorized vendor quote/supply
        materials.forEach((m) => {
          if (list.some((r) => r.id === m.id)) return; // already added above
          const quote = m.vendorQuotes?.find(
            (q) =>
              q.vendorId === cardId ||
              (sup && q.vendorId === sup.id) ||
              q.vendorName.toLowerCase() === supName.toLowerCase() ||
              (sup && q.vendorName.toLowerCase().includes(sup.name.toLowerCase())) ||
              (sup && sup.name.toLowerCase().includes(q.vendorName.toLowerCase()))
          );
          if (quote) {
            list.push({
              id: `${m.id}-${quote.vendorId || 'quote'}`,
              code: m.code || `MAT-QUO-${m.id}`,
              name: m.name,
              itemType:
                m.itemClassification === 'final_product'
                  ? 'final_product'
                  : m.itemClassification === 'full_contract'
                  ? 'full_contract'
                  : 'material',
              status: quote.status === 'Preferred' ? 'In Stock' : 'Active',
              category: m.category,
              subCategory: m.subCategory,
              moreSubCategory: m.moreSubCategory,
              supplierName: supName,
              supplierCountry: quote.country || supCountry,
              email: quote.contactEmail || supEmail,
              phone: quote.contactPhone || supPhone,
              rate: quote.currentPrice,
              retailPrice: m.retailPrice,
              unit: m.unit,
              stockOrScope: `Lead: ${quote.leadTimeDays}d • MOQ: ${quote.moq || 1} ${m.unit}s • Verified Quote`,
              createdTime: quote.lastUpdated || m.lastUpdated || '',
              assignedTo: 'Procurement Specialist',
              rawItem: m
            });
          }
        });

        // 1C. Supplied Outsourced Logistics, Utilities & Industrial Services
        outsourcedServices
          .filter(
            (o) =>
              o.providerId === cardId ||
              (sup && o.providerId === sup.id) ||
              o.providerName.toLowerCase() === supName.toLowerCase() ||
              (sup && o.providerName.toLowerCase().includes(sup.name.toLowerCase())) ||
              (sup && sup.name.toLowerCase().includes(o.providerName.toLowerCase()))
          )
          .forEach((o, idx) => {
            list.push({
              id: o.id,
              code: `SRV-OUT-${1000 + idx}`,
              name: o.name,
              itemType: 'service',
              status: 'Active',
              category: o.category,
              subCategory: o.subCategory,
              moreSubCategory: o.moreSubCategory,
              supplierName: supName,
              supplierCountry: supCountry,
              email: supEmail,
              phone: supPhone,
              rate: o.rate,
              retailPrice: o.retailPrice,
              unit: o.baseUnitType.replace('per_', ''),
              stockOrScope: `SLA: ${o.slaLevel} • Contract Scope`,
              createdTime: o.lastUpdated || '',
              assignedTo: 'Utilities Coordinator',
              rawItem: o
            });
          });

        // 1D. Supplied Specialist Subcontractor Labor Crews & Trade Operations
        subcontractors
          .filter(
            (s) =>
              s.subcontractorId === cardId ||
              (sup && s.subcontractorId === sup.id) ||
              s.subcontractorName.toLowerCase() === supName.toLowerCase() ||
              (sup && s.subcontractorName.toLowerCase().includes(sup.name.toLowerCase())) ||
              (sup && sup.name.toLowerCase().includes(s.subcontractorName.toLowerCase()))
          )
          .forEach((s, idx) => {
            list.push({
              id: s.id,
              code: s.code || `SUB-WELD-${100 + idx}`,
              name: s.name || 'Skilled Labour Crew',
              itemType: 'subcontractor',
              status: 'Active',
              category: s.category || 'Specialist Fabrication',
              subCategory: s.subCategory || 'General',
              moreSubCategory: s.moreSubCategory,
              supplierName: supName,
              supplierCountry: supCountry,
              email: supEmail,
              phone: supPhone,
              rate: s.rate ?? s.baseRate ?? 0,
              retailPrice: s.retailRate,
              unit: s.unit.replace('per_', ''),
              stockOrScope: `Skill: ${s.skillLevel} • Field Deployable`,
              createdTime: s.lastUpdated || '',
              assignedTo: 'Field Operations Lead',
              rawItem: s
            });
          });
      }
    }

    // 2. PROJECT CARD: View products, materials, and supplying vendors for this project
    else if (cardType === 'project') {
      const proj = projects.find(
        (p) => p.id === cardId || p.name.toLowerCase() === titleLower
      );
      if (proj) {
        // Target Product
        list.push({
          id: `prj-product-${proj.id}`,
          code: `PRD-${proj.code}`,
          name: `[Primary Product Target] ${proj.targetProduct || proj.name}`,
          itemType: 'final_product',
          status: 'Active',
          category: proj.productCategory || 'Heavy Industrial Equipment',
          subCategory: proj.productSubCategory || 'High-Spec Assembly',
          moreSubCategory: proj.productMoreSubCategory || proj.moreSubCategory,
          supplierName: `Enterprise Assembly Plant (Internal)`,
          supplierCountry: 'United States',
          email: 'engineering@enterprise-build.com',
          phone: '+1 800 555 0199',
          rate: proj.quotedPrice,
          retailPrice: proj.quotedPrice,
          unit: 'complete system',
          stockOrScope: `Target Margin: ${proj.targetMarginPct}%`,
          createdTime: proj.createdDate || '',
          assignedTo: 'Lead Project Architect',
          rawItem: proj
        });

        // Selected Items in Project Breakdown (Materials, Subcontractors, Outsourced)
        if (proj.selectedItems && proj.selectedItems.length > 0) {
          proj.selectedItems.forEach((item, idx) => {
            list.push({
              id: item.id || `proj-item-${idx}`,
              code: `ACC100${15850 + idx}`,
              name: item.name,
              itemType:
                item.type === 'material'
                  ? 'material'
                  : item.type === 'subcontractor'
                  ? 'subcontractor'
                  : 'service',
              status: 'Enabled',
              category: item.category,
              subCategory: `Phase: ${item.phaseId}`,
              supplierName: item.supplierOrProvider,
              supplierCountry: 'United States',
              email: 'procurement@fxtt-crm.com',
              phone: '+1 415 252 7217',
              rate: item.unitCost,
              retailPrice: item.totalCost,
              unit: item.unit,
              stockOrScope: `Qty: ${item.quantity} ${item.unit}s ($${(Number(item.totalCost) || 0).toLocaleString()})`,
              createdTime: proj.startDate || '',
              assignedTo: 'Project Estimator',
              rawItem: item
            });
          });
        }
      } else {
        // All Projects Portfolio
        projects.forEach((p, idx) => {
          list.push({
            id: p.id,
            code: p.code || `PRJ-${1000 + idx}`,
            name: p.name,
            itemType: 'project',
            status: p.status || 'Active',
            category: p.productCategory || 'Capital Projects',
            subCategory: p.productSubCategory || 'Engineering Build',
            moreSubCategory: p.clientName || 'Commercial Client',
            supplierName: p.clientName || 'Internal / Client Delivery',
            supplierCountry: 'United States',
            email: 'projects@enterprise.com',
            phone: '+1 800 555 0199',
            rate: p.totalCost || p.quotedPrice,
            retailPrice: p.quotedPrice,
            unit: 'project',
            stockOrScope: `Target Margin: ${p.targetMarginPct}% • ${p.selectedItems?.length || 0} Line Items`,
            createdTime: p.createdDate || '',
            assignedTo: 'Lead Project Architect',
            rawItem: p
          });
        });
      }
    }

    // 3. MATERIAL CATEGORY / SUBCATEGORY CARD: View all materials in this category
    else if (cardType === 'material_category') {
      materials
        .filter((m) => {
          if (!cardId && !cardTitle) return true;
          if (isSubCat) {
            // STRICT sub-category isolation: must match this specific sub-category only
            const mSub = (m.subCategory || '').toLowerCase().trim();
            const mDeep = (m.moreSubCategory || '').toLowerCase().trim();
            return (
              mSub === titleLower ||
              mDeep === titleLower ||
              mSub.includes(titleLower) ||
              titleLower.includes(mSub) ||
              (cardId && (m.subCategoryId === cardId || m.subCategory === cardId))
            );
          }
          // Top-level category card: match parent category
          const mCat = (m.category || '').toLowerCase().trim();
          return (
            mCat === titleLower ||
            mCat.includes(titleLower) ||
            titleLower.includes(mCat) ||
            (cardId && (m.categoryId === cardId || m.category === cardId))
          );
        })
        .forEach((m, idx) => {
          const sup = suppliers.find((s) => s.id === m.supplierId || s.name === m.supplierName);
          list.push({
            id: m.id,
            code: m.code || `ACC100${15840 + idx}`,
            name: m.name,
            itemType: m.itemClassification === 'final_product' ? 'final_product' : 'material',
            status: m.inStock > 25 ? 'In Stock' : m.inStock > 0 ? 'Lead Exist' : 'Under Review',
            category: m.category,
            subCategory: m.subCategory,
            moreSubCategory: m.moreSubCategory,
            supplierName: m.supplierName,
            supplierCountry: sup?.country || 'United States',
            email: sup?.email || 'procurement@fxtt-materials.com',
            phone: sup?.phone || '+1 415 252 7217',
            rate: m.retailPrice,
            retailPrice: m.retailPrice,
            unit: m.unit,
            stockOrScope: `${m.inStock} ${m.unit}s Available`,
            createdTime: m.lastUpdated || '',
            assignedTo: 'Materials Specialist',
            rawItem: m
          });
        });
    }

    // 4. PRODUCT CATEGORY OR PRODUCE CATALOG
    else if (cardType === 'product_category' || cardType === 'produce') {
      const targetCatNode = (categories || []).find((c) => c.id === cardId || c.name.toLowerCase() === titleLower);
      const isProductSub = isSubCat || targetCatNode?.type === 'sub_category' || targetCatNode?.type === 'sub_sub_category';
      const targetName = (targetCatNode?.name || cardTitle || '').toLowerCase().trim();

      const matchedProducts = produceItems.filter((p) => {
        // Exclusively products (product variants)
        if (p.type !== 'product') return false;

        // If viewing all supplied products
        if (
          !targetName ||
          targetName === 'all' ||
          targetName.includes('all supplied product') ||
          cardId === 'rev-prod-all' ||
          cardId === 'all-products'
        ) {
          return true;
        }

        const catLower = (p.category || '').toLowerCase().trim();
        const subLower = (p.subCategory || '').toLowerCase().trim();
        const deepLower = (p.moreSubCategory || '').toLowerCase().trim();

        if (isProductSub) {
          // Strictly match subCategory only - do not match parent category
          return (
            subLower === targetName ||
            deepLower === targetName ||
            subLower.includes(targetName) ||
            targetName.includes(subLower) ||
            deepLower.includes(targetName) ||
            targetName.includes(deepLower) ||
            (cardId && (p.subCategoryId === cardId || p.subCategory === cardId))
          );
        }

        return (
          catLower === targetName ||
          catLower.includes(targetName) ||
          targetName.includes(catLower) ||
          (cardId && (p.categoryId === cardId || p.category === cardId))
        );
      });

      matchedProducts.forEach((p, idx) => {
        list.push({
          id: p.id,
          code: p.code || `PRD-VAR-${1000 + idx}`,
          name: p.name,
          itemType: 'final_product',
          status: p.status || 'Active',
          category: p.category,
          subCategory: p.subCategory,
          moreSubCategory: p.moreSubCategory,
          supplierName: 'In-House Advanced Manufacturing',
          supplierCountry: 'United States',
          email: 'products@fxtt-enterprise.com',
          phone: '+1 415 252 7217',
          rate: p.costPrice,
          retailPrice: p.retailPrice,
          unit: p.unit,
          stockOrScope: `Lead: ${p.leadTimeDays}d • Qtd: $${(Number(p.retailPrice) || 0).toLocaleString()}`,
          createdTime: p.lastUpdated || '',
          assignedTo: 'Lead Product Engineer',
          rawItem: p
        });
      });
    }

    // 5A. OUTSOURCED SERVICE PROVIDER CARD (Relevant to that provider only)
    else if (cardType === 'service_provider') {
      const isAll =
        !cardTitle ||
        cardTitle.toLowerCase() === 'all outsourced services' ||
        cardTitle.toLowerCase() === 'all' ||
        cardId === 'all-service-providers' ||
        cardId === 'outsourced-catalog';

      let filteredOutsourced: OutsourcedService[] = [];

      if (isAll) {
        filteredOutsourced = outsourcedServices;
      } else {
        const prov = suppliers.find((s) => s.id === cardId || s.name.toLowerCase().trim() === titleLower.trim()) ||
                     suppliers.find((s) => cardId && s.id.toLowerCase() === cardId.toLowerCase());
        const provName = prov ? prov.name : cardTitle;
        const targetClean = provName.toLowerCase().trim();

        // Strictly match only items belonging to this provider only
        filteredOutsourced = outsourcedServices.filter((o) => {
          if (cardId && (o.providerId === cardId || (prov && o.providerId === prov.id))) {
            return true;
          }
          const oName = (o.providerName || '').toLowerCase().trim();
          if (oName === targetClean) return true;
          if (targetClean && (oName.includes(targetClean) || targetClean.includes(oName))) return true;
          return false;
        });
      }

      const prov = suppliers.find((s) => s.id === cardId || s.name.toLowerCase().trim() === titleLower.trim());
      const defaultCountry = prov?.country || 'United States';
      const defaultEmail = prov?.email || 'contracts@outsourced-provider.com';
      const defaultPhone = prov?.phone || '+1 (800) 555-0199';

      filteredOutsourced.forEach((o, idx) => {
        list.push({
          id: o.id,
          code: o.code || `OUT-SRV-${1000 + idx}`,
          name: o.name,
          itemType: 'service',
          status: 'Active',
          category: o.category,
          subCategory: o.subCategory,
          moreSubCategory: o.moreSubCategory,
          supplierName: o.providerName || (prov ? prov.name : cardTitle),
          supplierCountry: (o as any).country || defaultCountry,
          email: (o as any).contactEmail || defaultEmail,
          phone: (o as any).contactPhone || defaultPhone,
          rate: o.rate,
          retailPrice: o.retailPrice,
          unit: (o.baseUnitType || 'service').replace('per_', ''),
          stockOrScope: `SLA: ${o.slaLevel || 'Tier-1 SLA (99.5%)'} • ${o.tierRates?.length ? `${o.tierRates.length} Volume Tiers` : 'Standard Hired Tariff'} • ${(o as any).description || 'Contract Scope'}`,
          createdTime: o.lastUpdated || '',
          assignedTo: 'Procurement Specialist',
          rawItem: o
        });
      });
    }

    // 5B. SERVICE CATEGORY OR OUTSOURCED CATALOG
    else if (cardType === 'service_category' || cardType === 'outsourced') {
      const isAll =
        !cardTitle ||
        cardTitle.toLowerCase() === 'all outsourced services' ||
        cardTitle.toLowerCase() === 'all' ||
        cardId === 'all-outsourced';

      let filteredOutsourced: OutsourcedService[] = [];

      if (isAll) {
        filteredOutsourced = outsourcedServices;
      } else {
        const activeCategories = categories || INITIAL_CATEGORY_HIERARCHY;
        const catNode = activeCategories.find(
          (c) =>
            (cardId && c.id === cardId) ||
            c.name.trim().toLowerCase() === titleLower.trim()
        );

        const isServiceSub = isSubCat || catNode?.type === 'sub_category' || catNode?.type === 'sub_sub_category';
        const matchTarget = (catNode?.name || cardTitle).toLowerCase().trim();

        if (isServiceSub) {
          filteredOutsourced = outsourcedServices.filter((o) => {
            const oSub = (o.subCategory || '').toLowerCase().trim();
            const oDeep = (o.moreSubCategory || '').toLowerCase().trim();
            return (
              oSub === matchTarget ||
              oDeep === matchTarget ||
              oSub.includes(matchTarget) ||
              matchTarget.includes(oSub) ||
              (cardId && (o.subCategoryId === cardId || o.subCategory === cardId))
            );
          });
        } else {
          filteredOutsourced = outsourcedServices.filter((o) => {
            const oCat = (o.category || '').toLowerCase().trim();
            return (
              oCat === matchTarget ||
              oCat.includes(matchTarget) ||
              matchTarget.includes(oCat) ||
              (cardId && (o.categoryId === cardId || o.category === cardId))
            );
          });
        }
      }

      filteredOutsourced.forEach((o, idx) => {
        list.push({
          id: o.id,
          code: o.code || `OUT-SRV-${1000 + idx}`,
          name: o.name,
          itemType: 'service',
          status: 'Enabled',
          category: o.category,
          subCategory: o.subCategory,
          moreSubCategory: o.moreSubCategory,
          supplierName: o.providerName,
          supplierCountry: (o as any).country || 'United States',
          email: (o as any).contactEmail || 'contracts@outsourced-provider.com',
          phone: (o as any).contactPhone || '+1 (800) 555-0199',
          rate: o.rate,
          retailPrice: o.retailPrice,
          unit: (o.baseUnitType || 'service').replace('per_', ''),
          stockOrScope: o.slaLevel || (o as any).description || 'Contracted Service SLA',
          createdTime: o.lastUpdated || '',
          assignedTo: 'Procurement Specialist',
          rawItem: o
        });
      });
    }

    // 6. SUBCONTRACTOR PROFILE OR TRADE CARD
    else if (cardType === 'subcontractor') {
      const isAll =
        !cardTitle ||
        cardTitle.toLowerCase() === 'all subcontractor services' ||
        cardTitle.toLowerCase() === 'all materials & subcontractors' ||
        cardTitle.toLowerCase() === 'all' ||
        cardId === 'all-subcontractors' ||
        cardId === 'subcontractors-catalog';

      if (isAll) {
        subcontractors.forEach((s, idx) => {
          list.push({
            id: s.id,
            code: s.code || `SUB-SVC-${1000 + idx}`,
            name: s.nicheServiceName || s.name || s.serviceType || 'Specialist Field Crew',
            itemType: 'subcontractor',
            status: s.skillLevel ? 'Active' : 'Enabled',
            category: s.serviceCategory || s.category || 'Specialist Fabrication & Machining',
            subCategory: s.serviceSubCategory || s.subCategory || s.serviceType || 'Trade Operation',
            moreSubCategory: s.moreServiceSubCategory || s.moreSubCategory || s.skillLevel || 'Field Execution',
            supplierName: s.subcontractorName,
            supplierCountry: (s as any).country || 'United States',
            email: (s as any).contactEmail || 'crews@subcontractors.com',
            phone: (s as any).contactPhone || '+1 (800) 555-0188',
            rate: s.rate ?? s.baseRate ?? 0,
            retailPrice: s.retailRate || (s.rate ? Number((s.rate * 1.15).toFixed(2)) : 100),
            unit: (s.unit || 'hr').replace('per_', ''),
            stockOrScope: `Trade: ${s.serviceType || 'Specialist'} • Skill: ${s.skillLevel || 'Master Certified'} • Min Dispatch: ${s.minHoursPerDispatch || 4}h • Model: ${s.rateModel === 'hourly_labour' ? 'Hourly Labour Charge' : s.rateModel || 'Hourly Labour'}`,
            createdTime: s.lastUpdated || '',
            assignedTo: 'Lead Labour Estimator',
            rawItem: s
          });
        });
      } else {
        const targetClean = (cardTitle || '').toLowerCase().trim();
        const isTradeOrSubCat = isSubCat || cardTag === 'HIRED SUBCONTRACTOR TRADE';

        let filteredSubs: SubcontractorRateItem[] = [];

        if (isTradeOrSubCat) {
          filteredSubs = subcontractors.filter((s) => {
            const sTrade = (s.serviceType || '').toLowerCase().trim();
            const sSub = (s.serviceSubCategory || s.subCategory || '').toLowerCase().trim();
            const sName = (s.name || s.nicheServiceName || '').toLowerCase().trim();
            return (
              sTrade === targetClean ||
              sSub === targetClean ||
              sTrade.includes(targetClean) ||
              targetClean.includes(sTrade) ||
              sSub.includes(targetClean) ||
              targetClean.includes(sSub) ||
              sName === targetClean
            );
          });
        } else {
          filteredSubs = subcontractors.filter((s) => {
            if (cardId && (s.subcontractorId === cardId || s.id === cardId)) return true;
            const sName = (s.subcontractorName || '').toLowerCase().trim();
            return (
              sName === targetClean ||
              (targetClean && sName.includes(targetClean)) ||
              (sName && targetClean.includes(sName))
            );
          });
        }

        const matchingSub = filteredSubs[0];
        const subProfile = suppliers.find(
          (s) =>
            (cardId && s.id === cardId) ||
            s.name.toLowerCase().trim() === targetClean ||
            (targetClean && s.name.toLowerCase().includes(targetClean))
        );

        const subName = matchingSub?.subcontractorName || subProfile?.name || cardTitle;
        const subCountry = (matchingSub as any)?.country || subProfile?.country || 'United States';
        const subEmail = (matchingSub as any)?.contactEmail || subProfile?.email || 'dispatch@subcontractors.com';
        const subPhone = (matchingSub as any)?.contactPhone || subProfile?.phone || '+1 (800) 555-0188';

        filteredSubs.forEach((s, idx) => {
          list.push({
            id: s.id,
            code: s.code || `SUB-SVC-${1000 + idx}`,
            name: s.nicheServiceName || s.name || s.serviceType || 'Specialist Field Crew',
            itemType: 'subcontractor',
            status: s.skillLevel ? 'Active' : 'Enabled',
            category: s.serviceCategory || s.category || 'Specialist Fabrication & Machining',
            subCategory: s.serviceSubCategory || s.subCategory || s.serviceType || 'Trade Operation',
            moreSubCategory: s.moreServiceSubCategory || s.moreSubCategory || s.skillLevel || 'Field Execution',
            supplierName: s.subcontractorName || subName,
            supplierCountry: (s as any).country || subCountry,
            email: (s as any).contactEmail || subEmail,
            phone: (s as any).contactPhone || subPhone,
            rate: s.rate ?? s.baseRate ?? 0,
            retailPrice: s.retailRate || (s.rate ? Number((s.rate * 1.15).toFixed(2)) : 100),
            unit: (s.unit || 'hr').replace('per_', ''),
            stockOrScope: `Trade: ${s.serviceType || 'Specialist'} • Skill: ${s.skillLevel || 'Master Certified'} • Min Dispatch: ${s.minHoursPerDispatch || 4}h • Model: ${s.rateModel === 'hourly_labour' ? 'Hourly Labour Charge' : s.rateModel || 'Hourly Labour'}`,
            createdTime: s.lastUpdated || '',
            assignedTo: 'Lead Labour Estimator',
            rawItem: s
          });
        });
      }
    }

    // 6B. CLIENT PROFILE CARD: View all and only projects related to this specific client!
    else if (cardType === 'client') {
      const clientNameClean = cardTitle.toLowerCase().trim();
      const matchedProjects = projects.filter((p) => {
        if (!p.clientName) return false;
        const pClient = p.clientName.toLowerCase().trim();
        return (
          (cardId && p.clientId && p.clientId.toLowerCase() === cardId.toLowerCase()) ||
          pClient === clientNameClean ||
          pClient.includes(clientNameClean) ||
          clientNameClean.includes(pClient)
        );
      });

      matchedProjects.forEach((proj, idx) => {
        const marginPct = proj.targetMarginPct || 35;
        const phasesCount = (proj.phases || []).length;

        list.push({
          id: proj.id,
          code: proj.code || `PRJ-2026-${100 + idx}`,
          name: proj.name,
          itemType: 'project',
          status: proj.status === 'In Execution' ? 'Active' : proj.status === 'Completed' ? 'Completed' : 'Enabled',
          category: proj.productCategory || 'Heavy Industrial Equipment',
          subCategory: proj.productSubCategory || 'High-Spec Assembly',
          moreSubCategory: proj.targetProduct || proj.moreSubCategory,
          supplierName: proj.clientName || cardTitle,
          supplierCountry: (proj as any).location || 'United States',
          email:
            (proj as any).contactEmail ||
            `${(proj.clientName || cardTitle).toLowerCase().replace(/[^a-z0-9]/g, '')}@enterprise-partner.com`,
          phone: '+1 800 555 0199',
          rate: proj.quotedPrice,
          retailPrice: proj.quotedPrice,
          unit: 'Turnkey Contract',
          stockOrScope: `${phasesCount} Milestones • Target Margin: ${marginPct}% • Deadline: ${
            proj.deliveryDeadline || '—'
          }`,
          createdTime: proj.startDate || '',
          assignedTo: 'Lead Project Director',
          rawItem: proj
        });
      });
    }

    // 7. OVERHEADS PORTAL CARD: View all overhead cost items
    else if (cardType === 'overhead') {
      const activeOverheads = overheads || [];
      const isAll = !cardTitle || cardTitle.toLowerCase() === 'all' || cardId === 'all-overheads' || cardTitle.toLowerCase().includes('all overhead');
      const filtered = isAll
        ? activeOverheads
        : activeOverheads.filter((o) => {
            if (isSubCat) {
              const oSub = (o.subCategory || o.costType || '').toLowerCase().trim();
              return (
                oSub === titleLower ||
                oSub.includes(titleLower) ||
                titleLower.includes(oSub) ||
                (cardId && (o.subCategoryId === cardId || o.subCategory === cardId))
              );
            }
            const oCat = (o.category || '').toLowerCase().trim();
            return (
              oCat === titleLower ||
              oCat.includes(titleLower) ||
              titleLower.includes(oCat) ||
              (cardId && (o.id === cardId || o.category === cardId || o.categoryId === cardId))
            );
          });

      filtered.forEach((o, idx) => {
        list.push({
          id: o.id,
          code: o.code || `OVH-${1000 + idx}`,
          name: o.name,
          itemType: 'overhead',
          status: o.status === 'Inactive' ? 'Under Review' : 'Active',
          category: o.category || 'Operational Overhead',
          subCategory: o.subCategory || o.costType || 'General Facility',
          moreSubCategory: o.defaultCalculationMethod,
          supplierName: 'Internal Organization Overhead',
          supplierCountry: 'United States',
          email: 'finance@fxtt-enterprise.com',
          phone: '+1 415 252 7217',
          rate: Number(o.defaultRate) || 0,
          retailPrice: Number(o.defaultRate) || 0,
          unit: o.unitType || 'pct',
          stockOrScope: `Method: ${o.defaultCalculationMethod || 'percentage_of_direct'} • Base: ${o.defaultCostBase || 'total_direct_cost'}`,
          createdTime: o.effectiveDate || '',
          assignedTo: 'Financial Controller',
          rawItem: o
        });
      });
    }

    // 8. REVENUE STREAMS PORTAL CARD: View all revenue catalogue deliverables
    else if (cardType === 'revenue') {
      const activeRevenue = revenueItems || [];
      const isAll = !cardTitle || cardTitle.toLowerCase() === 'all' || cardId === 'rev-all' || cardTitle.toLowerCase().includes('all revenue');
      const filtered = isAll
        ? activeRevenue
        : activeRevenue.filter((r) => {
            if (isSubCat) {
              const rSub = (r.subCategory || '').toLowerCase().trim();
              return (
                rSub === titleLower ||
                rSub.includes(titleLower) ||
                titleLower.includes(rSub) ||
                (cardId && (r.subCategoryId === cardId || r.subCategory === cardId))
              );
            }
            const rCat = (r.category || '').toLowerCase().trim();
            return (
              rCat === titleLower ||
              rCat.includes(titleLower) ||
              titleLower.includes(rCat) ||
              (cardId && (r.id === cardId || r.category === cardId || r.categoryId === cardId))
            );
          });

      filtered.forEach((r, idx) => {
        list.push({
          id: r.id,
          code: r.code || `REV-${1000 + idx}`,
          name: r.name,
          itemType: r.type === 'product' ? 'final_product' : 'service',
          status: r.status === 'Inactive' ? 'Under Review' : 'Active',
          category: r.category || 'Commercial Deliverables',
          subCategory: r.subCategory || 'General Deliverable',
          moreSubCategory: r.type,
          supplierName: 'Commercial Operations',
          supplierCountry: 'United States',
          email: 'sales@fxtt-enterprise.com',
          phone: '+1 415 252 7217',
          rate: Number(r.costPrice) || 0,
          retailPrice: Number(r.defaultRate) || 0,
          unit: r.unit || 'unit',
          stockOrScope: `Deliverable Type: ${r.type || 'product'} • Commercial Status: ${r.status || 'Active'}`,
          createdTime: r.effectiveDate || '',
          assignedTo: 'Commercial Director',
          rawItem: r
        });
      });
    }

    // Strict addedRows filtering by active card
    const filteredAddedRows = addedRows.filter((r) => {
      // Deduplicate: If an item with matching id or code already exists in list (from props), do not include it from addedRows!
      const alreadyInList = list.some(
        (existing) =>
          existing.id === r.id ||
          (r.code && existing.code && existing.code.trim().toLowerCase() === r.code.trim().toLowerCase())
      );
      if (alreadyInList) return false;

      // Must match itemType
      if (cardType === 'material_category' && r.itemType !== 'material') return false;
      if ((cardType === 'product_category' || cardType === 'produce') && r.itemType !== 'final_product' && r.itemType !== 'produce') return false;
      if ((cardType === 'service_category' || cardType === 'outsourced') && r.itemType !== 'service') return false;
      if (cardType === 'subcontractor' && r.itemType !== 'subcontractor') return false;
      if (cardType === 'overhead' && r.itemType !== 'overhead') return false;
      if (cardType === 'revenue' && r.itemType !== 'revenue') return false;
      if (cardType === 'client' && r.itemType !== 'project') return false;
      if (cardType === 'supplier') {
        const supMatch = suppliers.find((s) => s.id === cardId || s.name.toLowerCase() === titleLower);
        const supName = supMatch ? supMatch.name.toLowerCase() : titleLower;
        return (r.supplierName || '').toLowerCase() === supName;
      }

      // Check subcategory isolation for added rows
      if (isSubCat) {
        const rSub = (r.subCategory || '').toLowerCase().trim();
        const rDeep = (r.moreSubCategory || '').toLowerCase().trim();
        return rSub === titleLower || rDeep === titleLower || rSub.includes(titleLower) || titleLower.includes(rSub);
      } else if (cardTitle && cardTitle.toLowerCase() !== 'all') {
        const rCat = (r.category || '').toLowerCase().trim();
        return rCat === titleLower || rCat.includes(titleLower) || titleLower.includes(rCat);
      }
      return true;
    });

    const combined = filteredAddedRows.length > 0 ? [...filteredAddedRows, ...list] : list;
    return combined.map((r) => {
      const edit = editedRowsMap[r.id];
      if (edit) {
        return { ...r, ...edit };
      }
      return r;
    });
  }, [
    cardType,
    cardId,
    cardTitle,
    materials,
    suppliers,
    outsourcedServices,
    subcontractors,
    projects,
    produceItems,
    addedRows,
    editedRowsMap
  ]);

  // Unique country list for dropdown filter
  const uniqueCountries = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.supplierCountry) set.add(r.supplierCountry);
    });
    return Array.from(set);
  }, [rows]);

  // Filtering based on top tabs & column inputs
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      // Exclude deleted items
      if (deletedRowIds.has(row.id)) return false;

      // Top tab filter
      if (activeFilterTab === 'TODAY') {
        if (!row.createdTime) return false;
        const todayStr = new Date().toISOString().split('T')[0];
        if (!row.createdTime.startsWith(todayStr)) return false;
      } else if (activeFilterTab === 'LAST 7 DAYS') {
        if (!row.createdTime) return false;
        const rowDate = new Date(row.createdTime.split(' ')[0]);
        if (isNaN(rowDate.getTime())) return false;
        const now = new Date();
        const diffDays = (now.getTime() - rowDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 7 || diffDays < 0) return false;
      } else if (activeFilterTab === 'FUNDED ACCOUNTS' || activeFilterTab === 'ACTIVE') {
        if (row.status !== 'Active' && row.status !== 'In Stock' && row.status !== 'Enabled') {
          return false;
        }
      }

      // Top bar universal search (matches all columns)
      if (topQuickSearch.trim()) {
        const q = topQuickSearch.toLowerCase().trim();
        const matchesAny =
          row.code.toLowerCase().includes(q) ||
          row.name.toLowerCase().includes(q) ||
          row.category.toLowerCase().includes(q) ||
          row.subCategory.toLowerCase().includes(q) ||
          (row.moreSubCategory && row.moreSubCategory.toLowerCase().includes(q)) ||
          row.supplierName.toLowerCase().includes(q) ||
          row.supplierCountry.toLowerCase().includes(q) ||
          row.email.toLowerCase().includes(q) ||
          row.phone.toLowerCase().includes(q) ||
          row.status.toLowerCase().includes(q) ||
          row.rate.toString().includes(q) ||
          (row.retailPrice && row.retailPrice.toString().includes(q)) ||
          row.createdTime.toLowerCase().includes(q) ||
          row.assignedTo.toLowerCase().includes(q);
        if (!matchesAny) return false;
      }

      // Column search ID
      if (columnSearch.code) {
        if (!row.code.toLowerCase().includes(columnSearch.code.toLowerCase())) return false;
      }

      // Column search Name
      if (columnSearch.name) {
        if (!row.name.toLowerCase().includes(columnSearch.name.toLowerCase())) return false;
      }

      // Status operator filter
      if (columnSearch.status) {
        const query = columnSearch.status.toLowerCase();
        const stat = row.status.toLowerCase();
        if (statusOperator === 'Equals' && stat !== query) return false;
        if (statusOperator === 'Not equal to' && stat === query) return false;
        if (statusOperator === 'Starts with' && !stat.startsWith(query)) return false;
        if (statusOperator === 'Ends with' && !stat.endsWith(query)) return false;
        if (statusOperator === 'Does not contain' && stat.includes(query)) return false;
        if (statusOperator === 'Contains' && !stat.includes(query)) return false;
      }

      // Category filter
      if (columnSearch.category) {
        const catQ = columnSearch.category.toLowerCase();
        const match =
          row.category.toLowerCase().includes(catQ) ||
          row.subCategory.toLowerCase().includes(catQ) ||
          (row.moreSubCategory && row.moreSubCategory.toLowerCase().includes(catQ));
        if (!match) return false;
      }

      // Country multi-select filter
      if (!selectedCountries.has('ALL') && selectedCountries.size > 0) {
        if (!selectedCountries.has(row.supplierCountry)) return false;
      }

      // Email filter
      if (columnSearch.email) {
        if (!row.email.toLowerCase().includes(columnSearch.email.toLowerCase())) return false;
      }

      // Phone / Rate filter
      if (columnSearch.phone) {
        const pQ = columnSearch.phone.toLowerCase();
        const match =
          row.phone.toLowerCase().includes(pQ) ||
          row.rate.toString().includes(pQ) ||
          (row.retailPrice && row.retailPrice.toString().includes(pQ));
        if (!match) return false;
      }

      // Date filter
      if (columnSearch.date) {
        if (!row.createdTime.toLowerCase().includes(columnSearch.date.toLowerCase())) return false;
      }

      // Assigned to filter
      if (columnSearch.assignedTo) {
        if (!row.assignedTo.toLowerCase().includes(columnSearch.assignedTo.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [rows, activeFilterTab, topQuickSearch, columnSearch, statusOperator, selectedCountries]);

  // Sorted rows
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA === undefined || valB === undefined) return 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredRows, sortField, sortAsc]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / recordsPerPage));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * recordsPerPage;
    return sortedRows.slice(start, start + recordsPerPage);
  }, [sortedRows, currentPage, recordsPerPage]);

  // Select all / toggle
  const isAllSelected =
    paginatedRows.length > 0 && paginatedRows.every((r) => selectedIds.has(r.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      const next = new Set(selectedIds);
      paginatedRows.forEach((r) => next.add(r.id));
      setSelectedIds(next);
    }
  };

  const handleToggleRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSort = (field: keyof FXTTGridRow) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow) return;

    if (editingRow.id.startsWith('new-')) {
      const finalCostRate = Number(newRate);
      const finalRetail = editingRow.retailPrice !== undefined && editingRow.retailPrice !== null
        ? Number(editingRow.retailPrice)
        : Number((finalCostRate * 1.35).toFixed(2));

      const isProduct = cardType === 'product_category' || cardType === 'produce' || editingRow.itemType === 'final_product' || editingRow.itemType === 'produce';
      const isSub = cardType === 'subcontractor' || editingRow.itemType === 'subcontractor';
      const isOut = cardType === 'outsourced' || cardType === 'service_category' || cardType === 'service_provider' || editingRow.itemType === 'service';
      const isOvh = cardType === 'overhead' || editingRow.itemType === 'overhead';
      const isRev = cardType === 'revenue' || editingRow.itemType === 'revenue';
      const isClientProj = cardType === 'client' || cardType === 'project' || editingRow.itemType === 'project';
      const isMaterial = !isProduct && !isSub && !isOut && !isOvh && !isRev && !isClientProj;

      // 1. MATERIAL ITEM
      if (isMaterial) {
        const primarySup = suppliers.find(s => s.name.toLowerCase() === (editingRow.supplierName || '').toLowerCase()) ||
                           (cardType === 'supplier' ? suppliers.find(s => s.id === cardId || s.name.toLowerCase() === cardTitle.toLowerCase()) : null) ||
                           suppliers[0];

        const newMaterial: MaterialItem = {
          id: editingRow.id.startsWith('new-') ? `mat-${Date.now()}` : editingRow.id,
          code: editingRow.code.trim(),
          name: editingRow.name.trim(),
          category: editingRow.category || cardTitle || 'Metals & Structural Alloys',
          subCategory: editingRow.subCategory || 'General Specification',
          moreSubCategory: editingRow.moreSubCategory,
          unit: editingRow.unit || 'pcs',
          currentPrice: finalCostRate,
          retailPrice: finalRetail,
          supplierId: primarySup?.id || 'sup-1',
          supplierName: primarySup?.name || editingRow.supplierName || 'Direct Verified Supplier',
          itemClassification: 'raw_material',
          inStock: 100,
          reorderPoint: 20,
          minOrderQty: 1,
          leadTimeDays: 7,
          defaultDiscountPct: 0,
          volumePricing: [],
          priceHistory: [],
          lastUpdated: new Date().toISOString().split('T')[0],
          vendorQuotes: [
            {
              id: `vq-${Date.now()}`,
              vendorId: primarySup?.id || 'sup-1',
              vendorName: primarySup?.name || editingRow.supplierName || 'Direct Verified Supplier',
              vendorPartNumber: editingRow.code.trim(),
              currentPrice: finalCostRate,
              currency: 'USD',
              minimumOrderQty: 1,
              leadTimeDays: 7,
              isPrimary: true,
              lastQuotedDate: new Date().toISOString().split('T')[0],
              priceChangeHistory: [
                {
                  id: `pch-${Date.now()}`,
                  changeDate: new Date().toISOString().split('T')[0],
                  previousPrice: finalCostRate,
                  newPrice: finalCostRate,
                  changePercentage: 0,
                  reason: editReason || 'Manual specification onboarding via FXTT CRM Data Grid',
                  updatedBy: 'Lead Materials Specialist'
                }
              ],
              volumeTiers: [
                { minQuantity: 1, maxQuantity: 49, unitPrice: finalCostRate, discountPercentage: 0, label: 'Standard Rate' },
                { minQuantity: 50, unitPrice: Number((finalCostRate * 0.95).toFixed(2)), discountPercentage: 5, label: 'Volume Tier (50+)' }
              ]
            }
          ]
        };

        if (onAddMaterial) {
          onAddMaterial(newMaterial);
        } else {
          api.createMaterial(newMaterial).catch((err) => console.warn('API create material error:', err));
        }
        showNotification(`Added new material ${newMaterial.code} (${newMaterial.name}) to database.`);
      }

      // 2. SUBCONTRACTOR RATE ITEM
      else if (isSub) {
        const subEntity = (cardType === 'subcontractor' ? suppliers.find(s => s.id === cardId || s.name.toLowerCase() === cardTitle.toLowerCase()) : null) ||
                          suppliers.find(s => s.name.toLowerCase() === (editingRow.supplierName || '').toLowerCase());

        const newSub: SubcontractorRateItem = {
          id: editingRow.id.startsWith('new-') ? `sub-${Date.now()}` : editingRow.id,
          code: editingRow.code.trim(),
          subcontractorId: subEntity?.id || (cardType === 'subcontractor' ? (cardId || 'sub-1') : 'sub-1'),
          subcontractorName: subEntity?.name || (cardType === 'subcontractor' ? cardTitle : (editingRow.supplierName || 'Specialist Field Crew')),
          serviceType: editingRow.subCategory || editingRow.category || 'Specialist Trade Operation',
          serviceCategory: editingRow.category || cardTitle || 'Specialist Fabrication & Machining',
          serviceSubCategory: editingRow.subCategory || 'Trade Operation',
          moreServiceSubCategory: editingRow.moreSubCategory || 'Field Execution',
          nicheServiceName: editingRow.name.trim(),
          name: editingRow.name.trim(),
          rate: finalCostRate,
          baseRate: finalCostRate,
          retailRate: finalRetail,
          unit: editingRow.unit || 'hr',
          rateModel: 'hourly_labour',
          minHoursPerDispatch: 4,
          skillLevel: 'Master Certified',
          lastUpdated: new Date().toISOString().split('T')[0],
          priceHistory: [
            {
              id: `sph-${Date.now()}`,
              date: new Date().toISOString().split('T')[0],
              previousRate: finalCostRate,
              newRate: finalCostRate,
              changePct: 0,
              reason: editReason || 'Manual labour onboarding via FXTT CRM Data Grid',
              updatedBy: 'Lead Labour Estimator'
            }
          ]
        };

        if (onAddSubcontractor) {
          onAddSubcontractor(newSub);
        } else {
          api.createSubcontractor(newSub).catch((err) => console.warn('API create subcontractor error:', err));
        }
        showNotification(`Added new subcontractor labour item ${newSub.code} (${newSub.name}) to database.`);
      }

      // 3. OUTSOURCED SERVICE / TARIFF ITEM
      else if (isOut) {
        const provEntity = (cardType === 'service_provider' ? suppliers.find(s => s.id === cardId || s.name.toLowerCase() === cardTitle.toLowerCase()) : null) ||
                           suppliers.find(s => s.name.toLowerCase() === (editingRow.supplierName || '').toLowerCase());

        const newOut: OutsourcedService = {
          id: editingRow.id.startsWith('new-') ? `out-${Date.now()}` : editingRow.id,
          code: editingRow.code.trim(),
          name: editingRow.name.trim(),
          providerId: provEntity?.id || (cardType === 'service_provider' ? (cardId || 'prov-1') : 'prov-1'),
          providerName: provEntity?.name || (cardType === 'service_provider' ? cardTitle : (editingRow.supplierName || 'Certified Service Provider')),
          category: editingRow.category || cardTitle || 'Surface Treatment & Finishing',
          subCategory: editingRow.subCategory || 'Contract Tariff',
          moreSubCategory: editingRow.moreSubCategory,
          rate: finalCostRate,
          retailPrice: finalRetail,
          baseUnitType: editingRow.unit || 'sqm',
          slaLevel: 'Tier-1 SLA (99.5%)',
          tierRates: [
            { minVolume: 1, maxVolume: 99, rate: finalCostRate, description: 'Standard Bracket' },
            { minVolume: 100, rate: Number((finalCostRate * 0.92).toFixed(2)), description: 'High-Volume Tariff' }
          ],
          lastUpdated: new Date().toISOString().split('T')[0],
          priceHistory: [
            {
              id: `oph-${Date.now()}`,
              date: new Date().toISOString().split('T')[0],
              oldRate: finalCostRate,
              newRate: finalCostRate,
              reason: editReason || 'Outsourced tariff onboarding via FXTT CRM Grid',
              updatedBy: 'Procurement Specialist'
            }
          ]
        };

        if (onAddOutsourcedService) {
          onAddOutsourcedService(newOut);
        } else {
          api.createOutsourcedService(newOut).catch((err) => console.warn('API create outsourced error:', err));
        }
        showNotification(`Added new outsourced tariff ${newOut.code} (${newOut.name}) to database.`);
      }

      // 4. PRODUCT / PRODUCE ITEM
      else if (isProduct) {
        const newProd: ProduceItem = {
          id: editingRow.id.startsWith('new-') ? `prod-${Date.now()}` : editingRow.id,
          code: editingRow.code.trim(),
          name: editingRow.name.trim(),
          type: 'product',
          category: editingRow.category || cardTitle || 'Precision Systems',
          subCategory: editingRow.subCategory || 'General Product Variant',
          moreSubCategory: editingRow.moreSubCategory || 'Custom Configured Specification',
          itemClassification: 'produced_product',
          description: `${editingRow.name} - Engineered turnkey variant specification.`,
          unit: editingRow.unit || 'unit',
          costPrice: finalCostRate,
          retailPrice: finalRetail,
          defaultDiscountPct: 5,
          bundlesAndRanges: [
            { minQty: 1, maxQty: 2, unitPrice: finalRetail, discountPct: 0, label: 'Base Unit (1-2)' },
            { minQty: 3, unitPrice: Number((finalRetail * 0.92).toFixed(2)), discountPct: 8, label: 'Volume Tier (3+)' }
          ],
          leadTimeDays: 45,
          status: 'Active',
          lastUpdated: new Date().toISOString().split('T')[0],
          priceHistory: [
            {
              id: `pph-${Date.now()}-init`,
              date: new Date().toISOString().split('T')[0],
              previousPrice: finalRetail,
              newPrice: finalRetail,
              changePct: 0,
              reason: editReason || 'Initial product variant onboarding rate',
              updatedBy: 'Lead Product Engineer'
            }
          ]
        };

        if (onAddProduceItem) {
          onAddProduceItem(newProd);
        } else {
          api.createProduce(newProd).catch((err) => console.warn('API create produce error:', err));
        }

        showNotification(`Added new product variant ${newProd.code} (${newProd.name}) to database.`);
      }

      // 5. OVERHEAD COST ITEM
      else if (isOvh) {
        const newOvh: OverheadItem = {
          id: editingRow.id.startsWith('new-') ? `ovh-${Date.now()}` : editingRow.id,
          code: editingRow.code.trim(),
          name: editingRow.name.trim(),
          category: editingRow.category || cardTitle || 'Operating Overheads',
          costType: 'facility',
          defaultCalculationMethod: 'percentage_of_direct',
          defaultRate: finalCostRate,
          defaultCostBase: 'total_direct_cost',
          unitType: editingRow.unit || 'pct',
          description: `${editingRow.name} - ${editReason || 'Overhead cost allocation'}`,
          effectiveDate: new Date().toISOString().slice(0, 10),
          status: 'Active'
        };

        if (onAddOverheadItem) {
          onAddOverheadItem(newOvh);
        } else {
          api.createOverheadItem(newOvh).catch((err) => console.warn('API create overhead error:', err));
        }
        showNotification(`Added new overhead cost item ${newOvh.code} (${newOvh.name}) to database.`);
      }

      // 6. REVENUE CATALOGUE ITEM
      else if (isRev) {
        const newRev: RevenueItem = {
          id: editingRow.id.startsWith('new-') ? `rev-${Date.now()}` : editingRow.id,
          code: editingRow.code.trim(),
          name: editingRow.name.trim(),
          type: 'product',
          category: editingRow.category || cardTitle || 'Commercial Deliverables',
          subCategory: editingRow.subCategory || 'General Deliverable',
          unit: editingRow.unit || 'unit',
          defaultRate: finalRetail,
          costPrice: finalCostRate,
          description: `${editingRow.name} - Commercial deliverable scope`,
          effectiveDate: new Date().toISOString().slice(0, 10),
          status: 'Active'
        };

        if (onAddRevenueItem) {
          onAddRevenueItem(newRev);
        } else {
          api.createRevenueItem(newRev).catch((err) => console.warn('API create revenue error:', err));
        }
        showNotification(`Added new revenue deliverable ${newRev.code} (${newRev.name}) to database.`);
      }

      // 7. CLIENT PROJECT
      else if (isClientProj) {
        const newProj: Project = {
          id: editingRow.id.startsWith('new-') ? `prj-${Date.now()}` : editingRow.id,
          code: editingRow.code.trim(),
          name: editingRow.name.trim(),
          clientName: cardTitle || 'Enterprise Client',
          status: 'In Execution',
          quotedPrice: finalCostRate,
          targetMarginPct: 35,
          overheadPct: 10,
          contingencyPct: 5,
          startDate: new Date().toISOString().split('T')[0],
          deliveryDeadline: '2026-12-31',
          createdDate: new Date().toISOString().split('T')[0],
          productCategory: editingRow.category || 'Turnkey Systems',
          productSubCategory: editingRow.subCategory || 'Custom Contract',
          moreSubCategory: editingRow.moreSubCategory || 'Specification Baseline',
          targetProduct: editingRow.name,
          notes: editReason || 'Initiated from FXTT table',
          selectedItems: [],
          phases: [
            {
              id: `ph-${Date.now()}-1`,
              name: 'Phase 1: Project Mobilization & Engineering Specification',
              description: 'Initial architectural specification and milestone baseline.',
              budget: Number((finalCostRate * 0.4).toFixed(2)),
              actualCost: 0,
              startDate: new Date().toISOString().split('T')[0],
              endDate: '2026-06-30',
              status: 'In Progress'
            }
          ]
        };

        if (onAddProject) {
          onAddProject(newProj);
        } else {
          api.createProject(newProj).catch((err) => console.warn('API create project error:', err));
        }
        showNotification(`Added new capital project ${newProj.code} (${newProj.name}) to database.`);
      }

      const completedRow: FXTTGridRow = {
        ...editingRow,
        rate: finalCostRate,
        retailPrice: finalRetail,
        stockOrScope:
          cardType === 'client'
            ? `1 Milestone • Margin: 35% • Deadline: 2026-12-31`
            : isProduct
            ? `Lead: 45d • Qtd: $${finalRetail.toLocaleString()}`
            : editingRow.stockOrScope || `${editingRow.unit || 'pcs'} Available`
      };

      setAddedRows((prev) => [completedRow, ...prev]);
    } else {
      const updatedCostRate = Number(newRate);
      const updatedRetail = editingRow.retailPrice !== undefined && editingRow.retailPrice !== null
        ? Number(editingRow.retailPrice)
        : Number((updatedCostRate * 1.35).toFixed(2));

      // 1. Projects
      if ((cardType === 'client' || editingRow.itemType === 'project') && onUpdateProject) {
        onUpdateProject(editingRow.id, {
          quotedPrice: updatedCostRate,
          name: editingRow.name,
          code: editingRow.code,
          productSubCategory: editingRow.subCategory
        });
        api.updateProject(editingRow.id, { quotedPrice: updatedCostRate, name: editingRow.name, code: editingRow.code }).catch(console.error);
      }

      // 2. Products / Produce
      if ((cardType === 'product_category' || cardType === 'produce' || editingRow.itemType === 'produce' || editingRow.itemType === 'final_product') && onUpdateProduceItem) {
        onUpdateProduceItem(editingRow.id, {
          name: editingRow.name,
          code: editingRow.code,
          subCategory: editingRow.subCategory,
          unit: editingRow.unit,
          costPrice: updatedCostRate,
          retailPrice: updatedRetail
        });
        api.updateProduceItem(editingRow.id, { name: editingRow.name, code: editingRow.code, costPrice: updatedCostRate, retailPrice: updatedRetail }).catch(console.error);
      }

      // 3. Materials
      if (editingRow.itemType === 'material' || cardType === 'material_category') {
        if (onUpdateMaterialPrice) {
          onUpdateMaterialPrice(editingRow.id, updatedCostRate, editReason || 'Rate update from FXTT CRM Grid');
        }
        if (onUpdatePrice) {
          onUpdatePrice(editingRow.id, updatedCostRate, editReason || 'Rate update from FXTT CRM Grid');
        }
        if (onUpdateMaterial) {
          onUpdateMaterial(editingRow.id, {
            name: editingRow.name,
            code: editingRow.code,
            subCategory: editingRow.subCategory,
            unit: editingRow.unit,
            currentPrice: updatedCostRate,
            retailPrice: updatedRetail
          });
        }
        api.updateMaterial(editingRow.id, { name: editingRow.name, code: editingRow.code, subCategory: editingRow.subCategory, unit: editingRow.unit, currentPrice: updatedCostRate, retailPrice: updatedRetail }).catch(console.error);
      }

      // 4. Subcontractors
      if (editingRow.itemType === 'subcontractor' || cardType === 'subcontractor') {
        if (onUpdateSubcontractor) {
          onUpdateSubcontractor(editingRow.id, {
            rate: updatedCostRate,
            baseRate: updatedCostRate,
            retailRate: updatedRetail,
            nicheServiceName: editingRow.name,
            name: editingRow.name,
            serviceSubCategory: editingRow.subCategory,
            unit: editingRow.unit
          });
        }
        api.updateSubcontractor(editingRow.id, { rate: updatedCostRate, baseRate: updatedCostRate, name: editingRow.name, unit: editingRow.unit }).catch(console.error);
      }

      // 5. Outsourced Services
      if (editingRow.itemType === 'service' || cardType === 'service_provider' || cardType === 'outsourced' || cardType === 'service_category') {
        if (onUpdateOutsourcedService) {
          onUpdateOutsourcedService(editingRow.id, {
            rate: updatedCostRate,
            retailPrice: updatedRetail,
            name: editingRow.name,
            subCategory: editingRow.subCategory,
            baseUnitType: editingRow.unit
          });
        }
        api.updateOutsourcedService(editingRow.id, { rate: updatedCostRate, retailPrice: updatedRetail, name: editingRow.name }).catch(console.error);
      }

      // 6. Overheads
      if (editingRow.itemType === 'overhead' || cardType === 'overhead') {
        if (onUpdateOverheadItem) {
          onUpdateOverheadItem(editingRow.id, {
            name: editingRow.name,
            code: editingRow.code,
            defaultRate: updatedCostRate,
            unitType: editingRow.unit
          });
        }
        api.updateOverheadItem(editingRow.id, { name: editingRow.name, code: editingRow.code, defaultRate: updatedCostRate }).catch(console.error);
      }

      // 7. Revenue Items
      if (editingRow.itemType === 'revenue' || cardType === 'revenue') {
        if (onUpdateRevenueItem) {
          onUpdateRevenueItem(editingRow.id, {
            name: editingRow.name,
            code: editingRow.code,
            subCategory: editingRow.subCategory,
            unit: editingRow.unit,
            costPrice: updatedCostRate,
            defaultRate: updatedRetail
          });
        }
        api.updateRevenueItem(editingRow.id, { name: editingRow.name, code: editingRow.code, defaultRate: updatedRetail, costPrice: updatedCostRate }).catch(console.error);
      }

      // 8. Suppliers
      if (editingRow.itemType === 'full_contract' || cardType === 'supplier') {
        if (onUpdateSupplier) {
          onUpdateSupplier(editingRow.id, {
            name: editingRow.name
          });
        }
        api.updateSupplier(editingRow.id, { name: editingRow.name }).catch(console.error);
      }

      // Update in editedRowsMap for instant rendering
      setEditedRowsMap((prev) => ({
        ...prev,
        [editingRow.id]: {
          code: editingRow.code,
          name: editingRow.name,
          subCategory: editingRow.subCategory,
          unit: editingRow.unit,
          rate: updatedCostRate,
          retailPrice: updatedRetail
        }
      }));

      // Update in addedRows if it was newly added
      setAddedRows((prev) =>
        prev.map((r) =>
          r.id === editingRow.id
            ? { ...r, ...editingRow, rate: updatedCostRate, retailPrice: updatedRetail }
            : r
        )
      );

      showNotification(`Updated ${editingRow.code} (${editingRow.name}) successfully.`);
    }
    setEditingRow(null);
  };

  const handleExportCSV = () => {
    const headers = [
      'Item ID',
      'Name',
      'Classification',
      'Category',
      'SubCategory',
      'Supplier',
      'Country',
      'Rate',
      'Unit',
      'Status',
      'Created Time'
    ];
    const csvContent = [
      headers.join(','),
      ...sortedRows.map((r) =>
        [
          `"${r.code}"`,
          `"${r.name.replace(/"/g, '""')}"`,
          `"${r.itemType}"`,
          `"${r.category}"`,
          `"${r.subCategory}"`,
          `"${r.supplierName}"`,
          `"${r.supplierCountry}"`,
          r.rate,
          `"${r.unit}"`,
          `"${r.status}"`,
          `"${r.createdTime}"`
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `FXTT_${cardTitle.replace(/\s+/g, '_')}_Items.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification(`Exported ${sortedRows.length} items to CSV`);
  };

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCsvMenuOpen, setIsCsvMenuOpen] = useState(false);
  const [isPdfMenuOpen, setIsPdfMenuOpen] = useState(false);

  const handleExportPDF = () => {
    exportCategoryCatalogPDF({
      title: `${cardTitle} Catalog Report`,
      subtitle: `${cardTag || 'Category'} Catalog Report`,
      categoryName: cardTitle,
      columns: [
        { header: 'Item Code', dataKey: 'code', width: 30 },
        { header: 'Item Name', dataKey: 'name', width: 60 },
        { header: 'Category', dataKey: 'category', width: 35 },
        { header: 'SubCategory', dataKey: 'subCategory', width: 35 },
        { header: 'Classification', dataKey: 'classification', width: 30 },
        { header: 'Unit Rate ($)', dataKey: 'rate', width: 25, align: 'right' },
        { header: 'Unit', dataKey: 'unit', width: 20 },
        { header: 'Supplier / Partner', dataKey: 'supplierName', width: 45 },
        { header: 'Status', dataKey: 'status', width: 25 }
      ],
      rows: sortedRows.map((r) => ({
        code: r.code,
        name: r.name,
        category: r.category,
        subCategory: r.subCategory,
        classification: r.itemType,
        rate: r.rate,
        unit: r.unit,
        supplierName: r.supplierName,
        status: r.status
      }))
    });
    showNotification(`Downloaded Executive PDF Catalog for ${cardTitle}`);
  };

  const handleExportPriceHistoryCSV = () => {
    const itemsWithHistory = sortedRows.map((r) => r.rawItem || r);
    exportAllPriceHistoriesToCSV(cardTitle, itemsWithHistory);
    showNotification(`Downloaded Price History Audit CSV for ${cardTitle}`);
  };

  const handleExportPriceHistoryPDF = () => {
    exportCategoryCatalogPDF({
      title: `${cardTitle} - Price Revision Audit Log`,
      subtitle: `Official Price History Trails & Rate Variation Register`,
      categoryName: cardTitle,
      columns: [
        { header: 'Item Code', dataKey: 'code', width: 30 },
        { header: 'Item Name', dataKey: 'name', width: 65 },
        { header: 'Category', dataKey: 'category', width: 40 },
        { header: 'SubCategory', dataKey: 'subCategory', width: 40 },
        { header: 'Current Rate ($)', dataKey: 'rate', width: 30, align: 'right' },
        { header: 'Unit', dataKey: 'unit', width: 25 },
        { header: 'Supplier / Partner', dataKey: 'supplierName', width: 50 },
        { header: 'Status', dataKey: 'status', width: 25 }
      ],
      rows: sortedRows.map((r) => ({
        code: r.code,
        name: r.name,
        category: r.category,
        subCategory: r.subCategory,
        rate: r.rate,
        unit: r.unit,
        supplierName: r.supplierName,
        status: r.status
      }))
    });
    showNotification(`Downloaded Price Histories Audit PDF for ${cardTitle}`);
  };

  // Status badge styling matching the FXTT CRM screenshot
  const renderStatusBadge = (status: string) => {
    let colorClasses = 'text-slate-700 bg-slate-100';
    if (status === 'Read only') colorClasses = 'text-slate-600 bg-slate-100 border border-slate-200';
    else if (status === 'Enabled' || status === 'Active' || status === 'In Stock')
      colorClasses = 'text-emerald-800 bg-emerald-50 border border-emerald-200';
    else if (status === 'Lead Exist' || status === 'Pending')
      colorClasses = 'text-blue-800 bg-blue-50 border border-blue-200';
    else if (status === 'Under Review')
      colorClasses = 'text-amber-800 bg-amber-50 border border-amber-200';

    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-normal whitespace-nowrap ${colorClasses}`}>
        {status}
      </span>
    );
  };

  return (
    <>
      {/* Backdrop when in modal fit-window mode */}
      {isModal && !isFullScreen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />
      )}
      <div
        className={`bg-[#f4f7fa] text-slate-800 flex flex-col ${
          isFullScreen || isModal
            ? 'fixed inset-0 z-50 overflow-hidden w-screen h-screen'
            : 'relative w-full rounded-lg border border-slate-300 shadow-md my-2'
        }`}
      >
        {/* 1. TOP FXTT CRM APPLICATION BAR (Matching the blue navbar in screenshot) */}
        <div className="bg-[#0077b6] text-white px-4 py-2 flex items-center justify-between border-b border-[#005f94] shadow-sm select-none shrink-0">
          <div className="flex items-center space-x-4">
            {/* Back Button */}
            {onClose && (
              <button
                onClick={onClose}
                className="flex items-center space-x-1 px-2.5 py-1 bg-[#005f94] hover:bg-[#004d7a] text-white rounded text-xs font-normal transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>
                  {cardType === 'subcontractor'
                    ? 'Back to Trades'
                    : cardType === 'outsourced'
                    ? 'Back to Outsourced Services'
                    : cardType === 'product_category' || cardType === 'produce'
                    ? 'Back to Product Sub-Categories'
                    : 'Back to Cards'}
                </span>
              </button>
            )}

          {/* Logo FXTT */}
          <div className="flex items-center space-x-2">
            <div className="bg-white text-[#0077b6] font-black text-sm px-1.5 py-0.5 rounded tracking-tighter">
              FXTT
            </div>
            <span className="font-normal text-xs uppercase tracking-wide text-white/90">
              CRM Enterprise Data Grid
            </span>
          </div>

          {/* Breadcrumb Context */}
          <div className="hidden md:flex items-center space-x-2 text-xs text-white/80 border-l border-white/20 pl-3">
            <span className="text-white/60">Viewing Card Items:</span>
            <span className="bg-[#005f94] text-white font-normal px-2 py-0.5 rounded">
              {cardTag ? `${cardTag}: ` : ''}{cardTitle}
            </span>
          </div>
        </div>

        {/* Right Menu Icons from FXTT bar */}
        <div className="flex items-center space-x-2">
          {/* Quick Search in top bar with notification */}
          <div className="relative hidden lg:block">
            <Search className="w-3.5 h-3.5 text-white/60 absolute left-2.5 top-2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search code, name, vendor, rate..."
              value={topQuickSearch}
              onChange={(e) => setTopQuickSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredRows.length > 0) {
                    showNotification(
                      `Found ${filteredRows.length} records matching "${topQuickSearch}"! Top result: [${filteredRows[0].code}] ${filteredRows[0].name}.`
                    );
                  } else {
                    showNotification(`No records found matching "${topQuickSearch}".`);
                  }
                }
              }}
              className="bg-[#005f94] text-white placeholder-white/60 border border-white/20 rounded pl-8 pr-7 py-1 text-xs focus:outline-none focus:bg-[#004d7a] w-56 transition-all"
            />
            {topQuickSearch && (
              <button
                type="button"
                onClick={() => setTopQuickSearch('')}
                className="absolute right-2 top-1.5 text-white/60 hover:text-white cursor-pointer"
                title="Clear"
              >
                &times;
              </button>
            )}
          </div>

          {/* Full Screen Toggle Button */}
          <button
            type="button"
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="flex items-center space-x-1 px-2 py-1 bg-[#005f94] hover:bg-[#004d7a] text-white rounded text-xs font-normal transition-colors cursor-pointer"
            title={isFullScreen ? 'Exit Full Screen' : 'View Full Screen'}
          >
            {isFullScreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Fit Window</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Full Screen</span>
              </>
            )}
          </button>

          {/* Notification / Close */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded text-white text-sm transition-colors cursor-pointer"
              title="Close List View"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. SUBHEADER FILTER PILL BAR (Exact layout from uploaded screenshot) */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-2xs shrink-0">
        {/* Left Segmented Filter Tabs */}
        <div className="flex items-center space-x-1 border border-slate-200 rounded p-0.5 bg-slate-50">
          {['ALL', 'TODAY', 'LAST 7 DAYS', 'ACTIVE / IN STOCK', 'CUSTOM TAB'].map((tab) => {
            const isActive = activeFilterTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveFilterTab(tab)}
                className={`px-3 py-1 text-xs uppercase font-normal transition-all rounded ${
                  isActive
                    ? 'bg-white text-[#0077b6] shadow-2xs border border-slate-200 font-normal'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Right Action Icons & Filter Dropdown */}
        <div className="flex items-center space-x-2 text-xs">
          {/* List vs Grid View Toggle */}
          <div className="inline-flex h-8 p-0.5 bg-slate-100/90 rounded-lg border border-slate-200/80 shadow-2xs">
            <button
              type="button"
              onClick={() => setDisplayMode('list')}
              className={`px-2.5 h-full rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                displayMode === 'list'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
              title="Table / Data Grid List View"
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('grid')}
              className={`px-2.5 h-full rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                displayMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
              title="Cards / Tile Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => {
              setColumnSearch({
                code: '',
                name: '',
                status: '',
                category: '',
                country: '',
                email: '',
                phone: '',
                date: '',
                assignedTo: ''
              });
              setSelectedCountries(new Set(['ALL']));
              showNotification('Grid filters refreshed to default view.');
            }}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer"
            title="Reset Filters"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          {/* Filter by Dropdown */}
          <div className="h-8 flex items-center space-x-1.5 bg-white border border-slate-200/90 rounded-lg px-2.5 shadow-2xs">
            <span className="text-slate-400 text-[11px] font-medium">Filter:</span>
            <select
              value={filterByField}
              onChange={(e) => setFilterByField(e.target.value)}
              className="text-xs text-slate-800 bg-transparent focus:outline-none cursor-pointer font-medium"
            >
              <option value="all">All Fields</option>
              <option value="code">Item Code</option>
              <option value="name">Item Name</option>
              <option value="status">Status</option>
              <option value="category">Category</option>
              <option value="supplier">Supplier / Provider</option>
            </select>
          </div>

          <div className="h-5 w-px bg-slate-200/80 mx-0.5 hidden sm:block" />

          {/* Primary Action Button */}
          <button
            type="button"
            onClick={() => {
              if (cardType === 'client') {
                const clientPrefix = cardTitle.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'PRJ';
                const uniqueNum = Math.floor(100 + Math.random() * 900);
                const newCode = `PRJ-2026-${clientPrefix}-${uniqueNum}`;

                setEditingRow({
                  id: `new-prj-${Date.now()}`,
                  code: newCode,
                  name: `New ${cardTitle} Capital Project`,
                  itemType: 'project',
                  status: 'Active',
                  category: 'Industrial Systems & Automation',
                  subCategory: 'Turnkey Contract',
                  moreSubCategory: 'Custom Engineering Specification',
                  supplierName: cardTitle,
                  supplierCountry: 'United States',
                  email: `${cardTitle.toLowerCase().replace(/[^a-z0-9]/g, '')}@enterprise.com`,
                  phone: '+1 800 555 0199',
                  rate: 450000,
                  retailPrice: 450000,
                  unit: 'Turnkey Contract',
                  stockOrScope: 'Scope: 1 Phase Baseline • Target Margin: 35%',
                  createdTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
                  assignedTo: 'Lead Project Director',
                  rawItem: {}
                });
                setNewRate(450000);
                setEditReason('New capital project initiated for client account');
                return;
              }

              const isOverhead = cardType === 'overhead';
              const isRevenue = cardType === 'revenue';
              const isSub = cardType === 'subcontractor';
              const isProduct = cardType === 'product_category' || cardType === 'produce';
              const isOut = cardType === 'outsourced' || cardType === 'service_category' || cardType === 'service_provider';

              const subCodePrefix = cardTitle.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'VAR';
              const uniqueRandom = Math.floor(100 + Math.random() * 900);
              const uniqueSuffix = String.fromCharCode(65 + (rows.length % 26));

              // Resolve category and subcategory intelligently from categories hierarchy
              const matchingCat = categories?.find(
                (c) => c.id === cardId || c.name.toLowerCase() === cardTitle.toLowerCase()
              );

              const isCurrentCardSubCat =
                cardTag === 'SUB-CATEGORY' ||
                cardTag === 'DEEP MATERIAL SPEC' ||
                cardTag === 'PRODUCT SUB-CATEGORY' ||
                cardTag === 'OVERHEAD SUB-CATEGORY' ||
                cardTag === 'CUSTOMER SERVICE TARIFF' ||
                cardTag === 'HIRED SUBCONTRACTOR TRADE' ||
                (cardSubtitle && cardSubtitle.toLowerCase().includes('sub-category')) ||
                matchingCat?.type === 'sub_category' ||
                matchingCat?.type === 'sub_sub_category' ||
                (categories || []).some(
                  (c) =>
                    (c.id === cardId || c.name.toLowerCase() === cardTitle.toLowerCase()) &&
                    (c.type === 'sub_category' || c.type === 'sub_sub_category')
                );

              let resolvedCategory = cardTitle;
              let resolvedSubCategory = cardTitle;

              if (isCurrentCardSubCat) {
                // Strictly lock subcategory to this card's title
                resolvedSubCategory = cardTitle;
                if (matchingCat && matchingCat.parentId) {
                  const parent = categories?.find((c) => c.id === matchingCat.parentId);
                  resolvedCategory = parent ? parent.name : (matchingCat.category || cardSubtitle || 'Metals & Structural Alloys');
                } else {
                  const anySub = categories?.find(
                    (c) => c.name.toLowerCase() === cardTitle.toLowerCase() && c.parentId
                  );
                  if (anySub && anySub.parentId) {
                    const parent = categories?.find((c) => c.id === anySub.parentId);
                    resolvedCategory = parent ? parent.name : 'Metals & Structural Alloys';
                  } else {
                    resolvedCategory = cardSubtitle || 'Metals & Structural Alloys';
                  }
                }
              } else {
                resolvedCategory = matchingCat ? matchingCat.name : cardTitle;
                if (matchingCat) {
                  const firstChild = categories?.find((c) => c.parentId === matchingCat.id);
                  resolvedSubCategory = firstChild ? firstChild.name : 'General Specification';
                } else {
                  resolvedSubCategory = 'General Specification';
                }
              }

              const newCode = isOverhead
                ? `OVH-${subCodePrefix}-${uniqueRandom}`
                : isRevenue
                ? `REV-${subCodePrefix}-${uniqueRandom}`
                : isProduct
                ? `PRD-${subCodePrefix}-${uniqueRandom}${uniqueSuffix}`
                : isSub
                ? `SUB-${uniqueRandom}${uniqueSuffix}`
                : isOut
                ? `SRV-${subCodePrefix}-${uniqueRandom}`
                : `ACC100${15900 + rows.length}`;

              const defaultCost = isOverhead ? 1500 : isRevenue ? 1800 : isProduct ? 120000 : isSub ? 135 : isOut ? 165 : 150;
              const defaultRetail = isOverhead ? 1500 : isRevenue ? 2500 : isProduct ? 165000 : undefined;
              const defaultUnit = isOverhead ? 'month' : isRevenue ? 'pcs' : isProduct ? 'unit' : isSub ? 'hr' : isOut ? 'tariff' : 'pcs';

              setEditingRow({
                id: `new-${Date.now()}`,
                code: newCode,
                name: isOverhead
                  ? `New ${cardTitle} Operational Expense`
                  : isRevenue
                  ? `New ${cardTitle} Contract Deliverable`
                  : isProduct
                  ? `New ${cardTitle} Engineered Variant`
                  : isSub
                  ? `New ${cardTitle} Specialist Operation`
                  : isOut
                  ? `New ${cardTitle} Contracted Tariff`
                  : `New ${cardTitle} Specification Item`,
                itemType: isOverhead
                  ? 'overhead'
                  : isRevenue
                  ? 'revenue'
                  : isProduct
                  ? 'final_product'
                  : isSub
                  ? 'subcontractor'
                  : isOut
                  ? 'service'
                  : 'material',
                status: 'Active',
                category: resolvedCategory,
                subCategory: resolvedSubCategory,
                moreSubCategory: isProduct ? 'Custom Configured Specification' : undefined,
                supplierName: isOverhead
                  ? 'Internal Facility / Admin'
                  : isRevenue
                  ? 'Client Commercial Deliverable'
                  : isProduct
                  ? 'In-House Advanced Manufacturing'
                  : isSub
                  ? 'Certified Subcontractor Partner'
                  : suppliers?.[0]?.name || 'Direct Verified Supplier',
                supplierCountry: 'United States',
                email: isProduct
                  ? 'products@fxtt-enterprise.com'
                  : isSub
                  ? 'crews@subcontractors.com'
                  : 'orders@fxtt-enterprise.com',
                phone: '+1 415 252 7217',
                rate: defaultCost,
                retailPrice: defaultRetail,
                unit: defaultUnit,
                stockOrScope: isOverhead
                  ? 'Fixed Cost Base'
                  : isRevenue
                  ? 'Billable Revenue Item'
                  : isProduct
                  ? 'Lead: 45d • Turnkey Assembly'
                  : isSub
                  ? 'Certified Master Crew'
                  : 'Immediate Available',
                createdTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
                assignedTo: isOverhead
                  ? 'Finance Officer'
                  : isRevenue
                  ? 'Commercial Lead'
                  : isProduct
                  ? 'Lead Product Engineer'
                  : isSub
                  ? 'Lead Estimator'
                  : 'Catalog Specialist',
                rawItem: {}
              });
              setNewRate(defaultCost);
              setEditReason(
                isOverhead
                  ? 'New overhead item added via FXTT table'
                  : isRevenue
                  ? 'New revenue deliverable added via FXTT table'
                  : isProduct
                  ? 'Manual product variant entry via FXTT CRM Data Grid'
                  : isSub
                  ? 'New subcontractor labor rate specification'
                  : isOut
                  ? 'New outsourced service tariff specification'
                  : 'New material specification added to catalog'
              );
            }}
            className="h-8 inline-flex items-center gap-1.5 px-3 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition-all duration-150 border border-slate-900 cursor-pointer select-none"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.2]" />
            <span className="hidden sm:inline">
              {cardType === 'client'
                ? 'Add Project'
                : cardType === 'product_category' || cardType === 'produce'
                ? 'Add Product Variant'
                : cardType === 'subcontractor'
                ? 'Add Subcontractor'
                : cardType === 'outsourced' || cardType === 'service_provider' || cardType === 'service_category'
                ? 'Add Service Tariff'
                : cardType === 'overhead'
                ? 'Add Overhead Item'
                : cardType === 'revenue'
                ? 'Add Revenue Item'
                : 'Add Item'}
            </span>
          </button>

          {/* Download CSV Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsCsvMenuOpen(!isCsvMenuOpen);
                setIsPdfMenuOpen(false);
              }}
              className={`h-8 inline-flex items-center gap-1.5 px-3 text-xs font-medium rounded-lg border transition-all duration-150 select-none cursor-pointer ${
                isCsvMenuOpen
                  ? 'bg-slate-100 text-slate-900 border-slate-300 shadow-xs'
                  : 'bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border-slate-200/90 hover:border-slate-300 shadow-2xs'
              }`}
              title="Download CSV Files"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>CSV</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-150 ${isCsvMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {isCsvMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-1 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
                <button
                  type="button"
                  onClick={() => {
                    setIsCsvMenuOpen(false);
                    handleExportCSV();
                  }}
                  className="w-full text-left px-2.5 py-2 hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <div className="p-1 rounded-md bg-emerald-50 text-emerald-600">
                    <Download className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">Download Items CSV</div>
                    <div className="text-[10px] text-slate-500">All current category rows</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCsvMenuOpen(false);
                    handleExportPriceHistoryCSV();
                  }}
                  className="w-full text-left px-2.5 py-2 hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer border-t border-slate-100 mt-1"
                >
                  <div className="p-1 rounded-md bg-emerald-50 text-emerald-600">
                    <History className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">Download Price History CSV</div>
                    <div className="text-[10px] text-slate-500">All price revision trails</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Download PDF Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsPdfMenuOpen(!isPdfMenuOpen);
                setIsCsvMenuOpen(false);
              }}
              className={`h-8 inline-flex items-center gap-1.5 px-3 text-xs font-medium rounded-lg border transition-all duration-150 select-none cursor-pointer ${
                isPdfMenuOpen
                  ? 'bg-slate-100 text-slate-900 border-slate-300 shadow-xs'
                  : 'bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border-slate-200/90 hover:border-slate-300 shadow-2xs'
              }`}
              title="Download PDF Reports"
            >
              <FileText className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>PDF</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-150 ${isPdfMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {isPdfMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-1 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
                <button
                  type="button"
                  onClick={() => {
                    setIsPdfMenuOpen(false);
                    handleExportPDF();
                  }}
                  className="w-full text-left px-2.5 py-2 hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <div className="p-1 rounded-md bg-rose-50 text-rose-600">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">Download Category PDF</div>
                    <div className="text-[10px] text-slate-500">Formal printable specification</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPdfMenuOpen(false);
                    handleExportPriceHistoryPDF();
                  }}
                  className="w-full text-left px-2.5 py-2 hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer border-t border-slate-100 mt-1"
                >
                  <div className="p-1 rounded-md bg-rose-50 text-rose-600">
                    <History className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">Download Price History PDF</div>
                    <div className="text-[10px] text-slate-500">Audited revision certificate</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Import Excel / CSV Button */}
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="h-8 inline-flex items-center gap-1.5 px-3 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-medium rounded-lg border border-slate-200/90 hover:border-slate-300 shadow-2xs transition-all duration-150 cursor-pointer select-none"
            title="Import items or price revisions from Excel / CSV"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>Import</span>
          </button>

          {/* Email Button */}
          <button
            type="button"
            onClick={() => showNotification('Data export sent to registered executive mailbox.')}
            className="h-8 w-8 inline-flex items-center justify-center bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/90 hover:border-slate-300 rounded-lg shadow-2xs transition-all duration-150 cursor-pointer"
            title="Email Selected Items"
          >
            <Mail className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Toast Notification Alert */}
      {toastMsg && (
        <div className="bg-[#0077b6] text-white px-4 py-1 text-xs flex items-center justify-between animate-in fade-in">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg(null)} className="text-white/80 hover:text-white">
            &times;
          </button>
        </div>
      )}
      {/* Floating Bulk Action Bar when items selected */}
      {selectedIds.size > 0 && (
        <div className="bg-[#eef4f8] border-b border-[#bcd3e6] px-4 py-1.5 flex items-center justify-between text-xs text-[#003049] animate-in fade-in shrink-0">
          <div className="flex items-center space-x-2">
            <span className="font-semibold px-2 py-0.5 bg-white rounded border border-[#bcd3e6]">
              {selectedIds.size} row{selectedIds.size > 1 ? 's' : ''} selected
            </span>
            <span className="text-slate-500 font-medium">Batch Operations:</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded text-slate-700 flex items-center space-x-1 cursor-pointer font-medium"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Selected</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBulkDeleteConfirmOpen(true)}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded flex items-center space-x-1 cursor-pointer font-medium shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedIds.size})</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="px-2 py-1 text-slate-600 hover:text-slate-900 underline cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* 3. MAIN CRM DATA GRID: TABLE LIST VIEW OR CARDS GRID VIEW */}
      {displayMode === 'list' ? (
        <div className="flex-1 min-h-0 overflow-auto bg-white">
          <table className="w-full text-left text-xs border-collapse">
          {/* ROW 1: COLUMN HEADERS */}
          <thead className="bg-[#f0f4f8] text-slate-700 sticky top-0 z-20 border-b border-slate-300 select-none text-[11px] font-normal">
            <tr>
              {/* Checkbox Column */}
              <th className="py-2 px-2.5 w-10 text-center border-r border-slate-200">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  {isAllSelected ? (
                    <CheckSquare className="w-4 h-4 text-[#0077b6]" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </th>

              {/* Client ID / Item Code */}
              <th
                onClick={() => handleSort('code')}
                className="py-2 px-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 whitespace-nowrap"
              >
                <div className="flex items-center justify-between space-x-1">
                  <span>
                    {cardType === 'client'
                      ? 'Project Code'
                      : cardType === 'supplier'
                      ? 'Item Code / SKU'
                      : cardType === 'service_provider'
                      ? 'Service Code'
                      : cardType === 'subcontractor'
                      ? 'Service / Labour Code'
                      : 'Client ID / Code'}
                  </span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* Info Column (Next to Item ID / Code) */}
              <th
                className="py-2 px-2 border-r border-slate-200 text-center whitespace-nowrap w-12 text-slate-700 select-none font-medium text-xs"
                title="Item Photo & Visual Info"
              >
                <span>Info</span>
              </th>

              {/* Client Name / Item Name */}
              <th
                onClick={() => handleSort('name')}
                className="py-2 px-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 whitespace-nowrap min-w-[200px]"
              >
                <div className="flex items-center justify-between space-x-1">
                  <span>
                    {cardType === 'client'
                      ? 'Project Title & Deliverables'
                      : cardType === 'supplier'
                      ? 'Material / Supply Description'
                      : cardType === 'service_provider'
                      ? 'Outsourced Service Description'
                      : cardType === 'subcontractor'
                      ? 'Subcontractor Service & Labour Operation'
                      : 'Client Name / Item Description'}
                  </span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* Client Status / Status */}
              <th
                onClick={() => handleSort('status')}
                className="py-2 px-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 whitespace-nowrap"
              >
                <div className="flex items-center justify-between space-x-1">
                  <span>
                    {cardType === 'client'
                      ? 'Execution Status'
                      : cardType === 'supplier'
                      ? 'Supply Status'
                      : cardType === 'service_provider'
                      ? 'Service Status'
                      : cardType === 'subcontractor'
                      ? 'Crew Status / Certification'
                      : 'Client Status'}
                  </span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* Lead Exist / Category & Subcategory */}
              <th
                onClick={() => handleSort('category')}
                className="py-2 px-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 whitespace-nowrap"
              >
                <div className="flex items-center justify-between space-x-1">
                  <span>
                    {cardType === 'client'
                      ? 'Industry Sector & Domain'
                      : cardType === 'supplier'
                      ? 'Category & Classification'
                      : cardType === 'service_provider'
                      ? 'Service Category & Domain'
                      : cardType === 'subcontractor'
                      ? 'Trade & Service Category'
                      : 'Lead Exist / Category'}
                  </span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* Country / Supplier & Location */}
              <th
                onClick={() => handleSort('supplierCountry')}
                className="py-2 px-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 whitespace-nowrap"
              >
                <div className="flex items-center justify-between space-x-1">
                  <span>
                    {cardType === 'client'
                      ? 'Client Enterprise'
                      : cardType === 'supplier'
                      ? 'Supplier Name & Origin'
                      : cardType === 'service_provider'
                      ? 'Service Provider Firm & Hub'
                      : cardType === 'subcontractor'
                      ? 'Subcontractor Partner & Crew Hub'
                      : cardType === 'product_category' || cardType === 'produce' || cardType === 'revenue'
                      ? 'Competitor Benchmark'
                      : 'Country / Supplier'}
                  </span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* Email / Contact */}
              <th
                onClick={() => handleSort('email')}
                className="py-2 px-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 whitespace-nowrap"
              >
                <div className="flex items-center justify-between space-x-1">
                  <span>
                    {cardType === 'client'
                      ? 'Invoicing Email'
                      : cardType === 'supplier'
                      ? 'Dispatch Email'
                      : cardType === 'service_provider'
                      ? 'Contracts & SLA Email'
                      : cardType === 'subcontractor'
                      ? 'Crew Dispatch & SLA Email'
                      : 'Email'}
                  </span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* Phone / Rate & Valuation */}
              <th
                onClick={() => handleSort('rate')}
                className="py-2 px-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 whitespace-nowrap"
              >
                <div className="flex items-center justify-between space-x-1">
                  <span>
                    {cardType === 'client'
                      ? 'Contract Budget ($)'
                      : cardType === 'supplier'
                      ? 'Unit Price / Rate ($)'
                      : cardType === 'service_provider'
                      ? 'Contract Tariff ($)'
                      : cardType === 'subcontractor'
                      ? 'Hourly Labour Charge ($/hr)'
                      : 'Phone / Rate ($)'}
                  </span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* Created Time */}
              <th
                onClick={() => handleSort('createdTime')}
                className="py-2 px-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 whitespace-nowrap"
              >
                <div className="flex items-center justify-between space-x-1">
                  <span>
                    {cardType === 'client'
                      ? 'Commencement Date'
                      : cardType === 'supplier'
                      ? 'Lead Time / Updated'
                      : cardType === 'service_provider'
                      ? 'SLA / Last Audit'
                      : cardType === 'subcontractor'
                      ? 'Rate Review / Certified'
                      : 'Created Time'}
                  </span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* Assigned To */}
              <th
                onClick={() => handleSort('assignedTo')}
                className="py-2 px-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 whitespace-nowrap text-right"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>
                    {cardType === 'client'
                      ? 'Director & Controls'
                      : cardType === 'supplier'
                      ? 'Actions & Analysis'
                      : cardType === 'service_provider'
                      ? 'Tariff Controls & Audit'
                      : cardType === 'subcontractor'
                      ? 'Labour Controls & Audit'
                      : 'Assigned To'}
                  </span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* Assigned To / Actions */}
              <th className="py-2 px-3 text-right whitespace-nowrap">
                <span>
                  {cardType === 'client'
                    ? 'Director & Controls'
                    : cardType === 'service_provider'
                    ? 'Tariff Controls'
                    : cardType === 'subcontractor'
                    ? 'Audit & Controls'
                    : 'Assigned To'}
                </span>
              </th>
            </tr>

            {/* ROW 2: SEARCH / FILTER INPUTS (Exact duplicate from uploaded screenshot) */}
            <tr className="bg-white border-b border-slate-300 font-normal text-slate-700">
              {/* Reset filter clear */}
              <th className="py-1 px-2 border-r border-slate-200 text-center">
                <button
                  type="button"
                  onClick={() =>
                    setColumnSearch({
                      code: '',
                      name: '',
                      status: '',
                      category: '',
                      country: '',
                      email: '',
                      phone: '',
                      date: '',
                      assignedTo: ''
                    })
                  }
                  className="text-slate-400 hover:text-slate-700 text-xs"
                  title="Clear Column Filters"
                >
                  &times;
                </button>
              </th>

              {/* Search by ID input */}
              <th className="py-1 px-1.5 border-r border-slate-200">
                <div className="relative">
                  <input
                    type="text"
                    placeholder={
                      cardType === 'client'
                        ? 'Search Project ID...'
                        : cardType === 'supplier'
                        ? 'Search SKU / Code...'
                        : cardType === 'service_provider'
                        ? 'Search Service Code...'
                        : cardType === 'subcontractor'
                        ? 'Search Service / Labour Code...'
                        : 'Search by ID...'
                    }
                    value={columnSearch.code}
                    onChange={(e) => setColumnSearch({ ...columnSearch, code: e.target.value })}
                    className="w-full bg-[#fbfcfd] border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0077b6]"
                  />
                  {columnSearch.code && (
                    <button
                      onClick={() => setColumnSearch({ ...columnSearch, code: '' })}
                      className="absolute right-1 top-1 text-slate-400 hover:text-slate-700 text-[10px]"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </th>

              {/* Info Column Filter Spacer */}
              <th className="py-1 px-1 border-r border-slate-200 text-center text-slate-300 text-[10px] select-none font-normal">
                -
              </th>

              {/* Search by Name input */}
              <th className="py-1 px-1.5 border-r border-slate-200">
                <div className="relative">
                  <input
                    type="text"
                    placeholder={
                      cardType === 'client'
                        ? 'Search Project Name...'
                        : cardType === 'supplier'
                        ? 'Search Material / Supply...'
                        : cardType === 'service_provider'
                        ? 'Search Service Description...'
                        : cardType === 'subcontractor'
                        ? 'Search Service / Labour...'
                        : 'Search by name...'
                    }
                    value={columnSearch.name}
                    onChange={(e) => setColumnSearch({ ...columnSearch, name: e.target.value })}
                    className="w-full bg-[#fbfcfd] border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0077b6]"
                  />
                  {columnSearch.name && (
                    <button
                      onClick={() => setColumnSearch({ ...columnSearch, name: '' })}
                      className="absolute right-1 top-1 text-slate-400 hover:text-slate-700 text-[10px]"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </th>

              {/* Search by Status input + Operator Menu Popup */}
              <th className="py-1 px-1.5 border-r border-slate-200 relative">
                <div className="flex items-center space-x-1">
                  <input
                    type="text"
                    placeholder={
                      cardType === 'client'
                        ? 'Status (Active...)...'
                        : cardType === 'supplier'
                        ? 'Status (In Stock...)...'
                        : cardType === 'service_provider'
                        ? 'Status (Active / Contracted)...'
                        : cardType === 'subcontractor'
                        ? 'Status (Active / Certified)...'
                        : 'Search by status...'
                    }
                    value={columnSearch.status}
                    onChange={(e) => setColumnSearch({ ...columnSearch, status: e.target.value })}
                    className="w-full bg-[#fbfcfd] border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0077b6]"
                  />
                  <button
                    type="button"
                    onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
                    className="p-1 border border-slate-300 rounded hover:bg-slate-100 text-slate-600 cursor-pointer"
                    title="Filter Operator Menu"
                  >
                    <Filter className="w-3 h-3 text-[#0077b6]" />
                  </button>
                </div>

                {/* Operator Menu Dropdown (Equals, Not equal to, Starts with, Ends with, Does not contain) */}
                {isStatusMenuOpen && (
                  <div className="absolute left-1 top-full mt-1 bg-white border border-slate-300 rounded shadow-lg z-30 p-1.5 text-xs w-36 animate-in fade-in select-none">
                    {['Equals', 'Not equal to', 'Starts with', 'Ends with', 'Does not contain', 'Contains'].map(
                      (op) => (
                        <button
                          key={op}
                          type="button"
                          onClick={() => {
                            setStatusOperator(op);
                            setIsStatusMenuOpen(false);
                          }}
                          className={`w-full text-left px-2 py-1 rounded flex items-center space-x-1.5 ${
                            statusOperator === op
                              ? 'bg-blue-50 text-[#0077b6] font-normal'
                              : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          <span>{op}</span>
                        </button>
                      )
                    )}
                  </div>
                )}
              </th>

              {/* Search by Lead / Category */}
              <th className="py-1 px-1.5 border-r border-slate-200">
                <input
                  type="text"
                  placeholder={
                    cardType === 'client'
                      ? 'Search Sector / Domain...'
                      : cardType === 'supplier'
                      ? 'Search Category...'
                      : cardType === 'service_provider'
                      ? 'Search Service Category...'
                      : cardType === 'subcontractor'
                      ? 'Search Trade Category...'
                      : 'Search by category...'
                  }
                  value={columnSearch.category}
                  onChange={(e) => setColumnSearch({ ...columnSearch, category: e.target.value })}
                  className="w-full bg-[#fbfcfd] border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0077b6]"
                />
              </th>

              {/* Select Country / Supplier Dropdown with Checkbox Options */}
              <th className="py-1 px-1.5 border-r border-slate-200 relative">
                <button
                  type="button"
                  onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                  className="w-full bg-[#fbfcfd] border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800 flex items-center justify-between text-left"
                >
                  <span className="truncate">
                    {selectedCountries.has('ALL')
                      ? 'Select country...'
                      : `${selectedCountries.size} selected`}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                </button>

                {/* Country dropdown popup from screenshot */}
                {isCountryDropdownOpen && (
                  <div className="absolute left-1 top-full mt-1 bg-white border border-slate-300 rounded shadow-lg z-30 p-2 text-xs w-44 max-h-56 overflow-y-auto animate-in fade-in select-none">
                    <label className="flex items-center space-x-1.5 py-1 hover:bg-slate-50 cursor-pointer font-normal text-slate-900 border-b border-slate-100 pb-1.5">
                      <input
                        type="checkbox"
                        checked={selectedCountries.has('ALL')}
                        onChange={() => setSelectedCountries(new Set(['ALL']))}
                        className="rounded text-[#0077b6]"
                      />
                      <span>Select all</span>
                    </label>
                    {uniqueCountries.map((c) => (
                      <label
                        key={c}
                        className="flex items-center space-x-1.5 py-0.5 hover:bg-slate-50 cursor-pointer text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCountries.has(c) && !selectedCountries.has('ALL')}
                          onChange={() => {
                            const next = new Set(selectedCountries);
                            next.delete('ALL');
                            if (next.has(c)) next.delete(c);
                            else next.add(c);
                            if (next.size === 0) next.add('ALL');
                            setSelectedCountries(next);
                          }}
                          className="rounded text-[#0077b6]"
                        />
                        <span>{c}</span>
                      </label>
                    ))}
                  </div>
                )}
              </th>

              {/* Search by Email */}
              <th className="py-1 px-1.5 border-r border-slate-200">
                <input
                  type="text"
                  placeholder="Search by email..."
                  value={columnSearch.email}
                  onChange={(e) => setColumnSearch({ ...columnSearch, email: e.target.value })}
                  className="w-full bg-[#fbfcfd] border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0077b6]"
                />
              </th>

              {/* Search by Phone / Rate */}
              <th className="py-1 px-1.5 border-r border-slate-200">
                <input
                  type="text"
                  placeholder="Search by rate / phone..."
                  value={columnSearch.phone}
                  onChange={(e) => setColumnSearch({ ...columnSearch, phone: e.target.value })}
                  className="w-full bg-[#fbfcfd] border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0077b6]"
                />
              </th>

              {/* Search by Date */}
              <th className="py-1 px-1.5 border-r border-slate-200">
                <input
                  type="text"
                  placeholder="Search by date..."
                  value={columnSearch.date}
                  onChange={(e) => setColumnSearch({ ...columnSearch, date: e.target.value })}
                  className="w-full bg-[#fbfcfd] border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0077b6]"
                />
              </th>

              {/* Search by Assigned */}
              <th className="py-1 px-1.5 text-right">
                <input
                  type="text"
                  placeholder="Select..."
                  value={columnSearch.assignedTo}
                  onChange={(e) => setColumnSearch({ ...columnSearch, assignedTo: e.target.value })}
                  className="w-full bg-[#fbfcfd] border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0077b6]"
                />
              </th>
            </tr>
          </thead>

          {/* TABLE BODY (Matching white rows with light zebra accents) */}
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400 text-xs">
                  No records matching the current column filters for {cardTitle}.
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, idx) => {
                const isSelected = selectedIds.has(row.id);
                return (
                  <tr
                    key={row.id}
                    className={`hover:bg-[#f3f7fb] transition-colors ${
                      isSelected ? 'bg-blue-50/70' : idx % 2 === 1 ? 'bg-[#fafbfc]' : 'bg-white'
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-2 px-2.5 text-center border-r border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleToggleRow(row.id)}
                        className="text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#0077b6]" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                      </button>
                    </td>

                    {/* Client ID (Blue link like ACC10015840 in screenshot) */}
                    <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleViewItem(row)}
                        className="flex items-center space-x-1.5 text-left group cursor-pointer"
                        title={`View Multi-Vendor Price Matrix for ${row.code}`}
                      >
                        <span className="font-mono text-xs text-[#0077b6] group-hover:underline font-normal">
                          {row.code}
                        </span>
                        <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-[#0077b6] transition-colors" />
                      </button>
                    </td>

                    {/* Info Column: Quick Google & Lens Search Box Trigger */}
                    <td className="py-2 px-2 border-r border-slate-100 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setGoogleSearchItem({
                            id: row.id,
                            code: row.code,
                            name: row.name,
                            category: row.category,
                            supplierName: row.supplierName,
                            rate: row.rate,
                            unit: row.unit
                          });
                        }}
                        className="p-1 text-slate-400 hover:text-[#0077b6] hover:bg-sky-50 rounded-full transition-all inline-flex items-center justify-center cursor-pointer group"
                        title={`Search Google & Lens for ${row.name || row.code}`}
                      >
                        <Search className="w-3.5 h-3.5 text-[#0077b6] group-hover:scale-115 transition-transform" />
                      </button>
                    </td>

                    {/* Client Name / Item Name with Search Icon next to it */}
                    <td className="py-2 px-3 border-r border-slate-100 max-w-[280px]">
                      <div className="flex items-center justify-between gap-1 group/item">
                        <button
                          type="button"
                          onClick={() => handleViewItem(row)}
                          className="text-left group cursor-pointer block min-w-0 flex-1"
                          title={`View Multi-Vendor Price Matrix for ${row.name}`}
                        >
                          <div className="font-normal text-slate-900 text-xs truncate group-hover:text-[#0077b6]">
                            {row.name}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">{row.stockOrScope}</div>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setGoogleSearchItem({
                              id: row.id,
                              code: row.code,
                              name: row.name,
                              category: row.category,
                              supplierName: row.supplierName,
                              rate: row.rate,
                              unit: row.unit
                            });
                          }}
                          className="p-1 text-slate-400 hover:text-[#0077b6] hover:bg-sky-50 rounded transition-colors cursor-pointer shrink-0"
                          title={`Quick Google & Lens Search for "${row.name}"`}
                        >
                          <Search className="w-3.5 h-3.5 text-[#0077b6]" />
                        </button>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap">
                      {renderStatusBadge(row.status)}
                    </td>

                    {/* Category & Subcategory */}
                    <td className="py-2 px-3 border-r border-slate-100 max-w-[220px]">
                      <div className="text-slate-900 text-xs truncate font-medium">{row.category}</div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {row.subCategory ? `› ${row.subCategory}` : ''}
                        {row.moreSubCategory ? ` › ${row.moreSubCategory}` : ''}
                      </div>
                    </td>

                    {/* Country & Supplier Name */}
                    <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs">
                          {row.supplierCountry === 'United States'
                            ? '🇺🇸'
                            : row.supplierCountry === 'Germany'
                            ? '🇩🇪'
                            : row.supplierCountry === 'Japan'
                            ? '🇯🇵'
                            : '🌐'}
                        </span>
                        <span className="text-slate-800 text-xs truncate max-w-[130px]">
                          {row.supplierName}
                        </span>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                      {row.email}
                    </td>

                    {/* Rate ($) / Phone */}
                    <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap">
                      <div className="font-normal text-[#003049] text-xs">
                        ${row.rate < 1 ? row.rate.toFixed(3) : row.rate.toLocaleString()}{' '}
                        <span className="text-[10px] text-slate-500 font-normal">/ {row.unit}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">{row.phone}</div>
                    </td>

                    {/* Created Time */}
                    <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap font-mono text-[11px] text-slate-600">
                      {row.createdTime || '—'}
                    </td>

                    {/* Assigned To & Actions */}
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5">
                        <span className="text-slate-700 text-xs mr-1">{row.assignedTo}</span>
                        {cardType === 'client' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleViewItem(row)}
                              className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-[#0077b6] border border-blue-200 rounded text-[10px] font-medium transition-colors cursor-pointer flex items-center space-x-1"
                              title="View Full Project Details & Phases"
                            >
                              <span>Overview</span>
                            </button>
                            {onNavigateToCostAnalysis && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (row.rawItem) {
                                    onNavigateToCostAnalysis(row.rawItem as Project);
                                  } else {
                                    const p = projects.find((proj) => proj.id === row.id || proj.code === row.code);
                                    if (p) onNavigateToCostAnalysis(p);
                                  }
                                }}
                                className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[10px] font-medium transition-colors cursor-pointer flex items-center space-x-1"
                                title="Open Cost Controls & Financial Margin Analysis"
                              >
                                <Sliders className="w-3 h-3 text-amber-600" />
                                <span>Cost Controls</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenAuditModal(row)}
                              className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-[10px] font-medium transition-colors cursor-pointer flex items-center space-x-1"
                              title="View Project Audit Log"
                            >
                              <History className="w-3 h-3 text-emerald-600" />
                              <span>Audit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRow(row);
                                setNewRate(row.rate);
                                setEditReason('Capital project budget update via FXTT CRM Grid');
                              }}
                              className="p-1 text-slate-400 hover:text-[#0077b6] hover:bg-blue-50 rounded transition-colors cursor-pointer"
                              title="Edit Project Budget / Details"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(row)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title="Delete Project Record"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleViewItem(row)}
                              className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-[#0077b6] border border-blue-200 rounded text-[10px] font-normal transition-colors cursor-pointer flex items-center space-x-1"
                              title={
                                row.itemType === 'final_product' || row.itemType === 'produce' || row.itemType === 'revenue' || cardType === 'product_category' || cardType === 'produce' || cardType === 'revenue'
                                  ? 'View Competitor Benchmark Matrix & Discount Ranges'
                                  : 'View Multi-Vendor / Multi-Provider Comparison Matrix'
                              }
                            >
                              {(row.itemType === 'final_product' || row.itemType === 'produce' || row.itemType === 'revenue' || cardType === 'product_category' || cardType === 'produce' || cardType === 'revenue') && (
                                <Scale className="w-3 h-3 text-[#0077b6]" />
                              )}
                              <span>
                                {row.itemType === 'final_product' || row.itemType === 'produce' || row.itemType === 'revenue' || cardType === 'product_category' || cardType === 'produce' || cardType === 'revenue'
                                  ? 'Competitors'
                                  : 'Matrix'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenRangesModal(row)}
                              className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[10px] font-normal transition-colors cursor-pointer flex items-center space-x-1"
                              title="View Volume Ranges & Rate Brackets"
                            >
                              <Sliders className="w-3 h-3 text-amber-600" />
                              <span>Ranges</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenAuditModal(row)}
                              className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-[10px] font-normal transition-colors cursor-pointer flex items-center space-x-1"
                              title="View Revision Change Logs & Historical Audit"
                            >
                              <History className="w-3 h-3 text-emerald-600" />
                              <span>Audit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRow(row);
                                setNewRate(row.rate);
                                setEditReason('Routine periodic price adjustment via FXTT Grid');
                              }}
                              className="p-1 text-slate-400 hover:text-[#0077b6] hover:bg-blue-50 rounded transition-colors cursor-pointer"
                              title="Edit Rate & Details"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(row)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto bg-[#f8fafc] p-4">
          {paginatedRows.length === 0 ? (
            <div className="py-16 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
              <div className="text-sm font-medium text-slate-600 mb-1">No items found matching active filters</div>
              <p className="text-xs text-slate-400">Try adjusting your search criteria or resetting filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3.5 sm:gap-4">
              {paginatedRows.map((row) => (
                <ItemGridCard
                  key={row.id}
                  item={row}
                  isSelected={selectedIds.has(row.id)}
                  onSelectToggle={handleToggleRow}
                  onViewDetailsAndAudit={(item, tab) => handleViewDetailsAndAudit(row, tab)}
                  onViewAuditLogFXTT={() => setFullScreenAuditItem(row)}
                  onOpenImageViewer={() => setActiveImageViewerItem(row)}
                  onEdit={() => {
                    setEditingRow(row);
                    setNewRate(row.rate);
                    setEditReason('Item rate & attribute update via Grid Card');
                  }}
                  onDelete={() => handleDeleteRow(row)}
                  onShowNotification={showNotification}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. FOOTER PAGINATION BAR (Exact layout from uploaded screenshot) */}
      <div className="bg-[#f0f4f8] border-t border-slate-300 px-4 py-2 flex flex-wrap items-center justify-between text-xs text-slate-600 select-none shrink-0">
        {/* Left: Copyright & System version */}
        <div>
          <span>© 2016 FXTopTech CRM v0.02</span>
          <span className="mx-2">•</span>
          <span>
            Displaying <strong className="text-slate-900">{filteredRows.length}</strong> items for card:{' '}
            <span className="text-[#0077b6] font-normal">{cardTitle}</span>
          </span>
        </div>

        {/* Right: Records per page & Page Selector */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <span>Records per page:</span>
            <select
              value={recordsPerPage}
              onChange={(e) => {
                setRecordsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-800 focus:outline-none"
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 py-0.5 bg-white border border-slate-300 rounded text-xs font-normal text-slate-900">
              {currentPage}
            </span>
            <span>of {totalPages}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. QUICK EDIT / ADD VARIANT MODAL */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
          <div className="bg-white border border-slate-300 rounded max-w-md w-full p-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">
                {editingRow.id.startsWith('new-')
                  ? cardType === 'product_category' || cardType === 'produce'
                    ? 'Add New Product Variant'
                    : 'Add Specification Item'
                  : 'Edit Item Specification'}
              </h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono font-medium border border-blue-200">
                {editingRow.code}
              </span>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 mb-0.5 font-medium">Unique Item Code</label>
                  <input
                    type="text"
                    required
                    value={editingRow.code}
                    onChange={(e) => setEditingRow({ ...editingRow, code: e.target.value })}
                    placeholder="e.g. ACC10015901, OVH-101"
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-900 focus:outline-none focus:border-[#0077b6] text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-0.5 font-medium">Unit</label>
                  <input
                    type="text"
                    value={editingRow.unit}
                    onChange={(e) => setEditingRow({ ...editingRow, unit: e.target.value })}
                    placeholder="pcs, kg, m, month, hr, unit"
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-[#0077b6] text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-0.5 font-medium">Item / Variant / Specification Name</label>
                <input
                  type="text"
                  required
                  value={editingRow.name}
                  onChange={(e) => setEditingRow({ ...editingRow, name: e.target.value })}
                  placeholder="e.g. 6061-T6 Structural Aluminium Extrusion Profile"
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-[#0077b6] text-xs"
                />
              </div>

              {/* Linked Category & Sub-Category Fields */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 mb-0.5 font-medium flex items-center justify-between">
                    <span>Category</span>
                    <span className="text-[10px] text-blue-600 font-normal">Auto-Linked</span>
                  </label>
                  <input
                    type="text"
                    list="fxtt-cat-datalist"
                    required
                    value={editingRow.category}
                    onChange={(e) => setEditingRow({ ...editingRow, category: e.target.value })}
                    placeholder="Select or enter Category..."
                    className="w-full bg-blue-50/30 border border-blue-200 rounded px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-[#0077b6] text-xs font-medium"
                  />
                  <datalist id="fxtt-cat-datalist">
                    {(categories || [])
                      .filter((c) => c.type === 'category')
                      .map((c) => (
                        <option key={c.id} value={c.name} />
                      ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-slate-700 mb-0.5 font-medium flex items-center justify-between">
                    <span>Sub-Category</span>
                    <span className="text-[10px] text-slate-500 font-normal">Filtered</span>
                  </label>
                  <input
                    type="text"
                    list="fxtt-subcat-datalist"
                    value={editingRow.subCategory}
                    onChange={(e) => setEditingRow({ ...editingRow, subCategory: e.target.value })}
                    placeholder="Select or enter Sub-Category..."
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-[#0077b6] text-xs"
                  />
                  <datalist id="fxtt-subcat-datalist">
                    {(categories || [])
                      .filter((c) => {
                        if (c.type !== 'sub_category') return false;
                        if (!editingRow.category) return true;
                        const parent = categories?.find((p) => p.name.toLowerCase() === editingRow.category.toLowerCase());
                        return parent ? c.parentId === parent.id : true;
                      })
                      .map((c) => (
                        <option key={c.id} value={c.name} />
                      ))}
                  </datalist>
                </div>
              </div>

              {/* Linked Supplier / Partner / Provider */}
              <div>
                <label className="block text-slate-700 mb-0.5 font-medium flex items-center justify-between">
                  <span>Supplier / Subcontractor / Partner</span>
                  <span className="text-[10px] text-slate-500 font-normal">Vendor Registry</span>
                </label>
                <input
                  type="text"
                  list="fxtt-supplier-datalist"
                  value={editingRow.supplierName}
                  onChange={(e) => setEditingRow({ ...editingRow, supplierName: e.target.value })}
                  placeholder="e.g. Apex Industrial Metals, Certified Master Crew..."
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-[#0077b6] text-xs"
                />
                <datalist id="fxtt-supplier-datalist">
                  {(suppliers || []).map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                  {(subcontractors || []).map((s) => (
                    <option key={s.id} value={s.contractorName} />
                  ))}
                </datalist>
              </div>

              {/* Rates */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 mb-0.5 font-medium">Unit Cost Rate ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newRate}
                    onChange={(e) => setNewRate(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 font-semibold focus:outline-none focus:border-[#0077b6] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-0.5 font-medium">Quoted / Retail Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingRow.retailPrice !== undefined ? editingRow.retailPrice : Number((newRate * 1.35).toFixed(2))}
                    onChange={(e) =>
                      setEditingRow({ ...editingRow, retailPrice: Number(e.target.value) })
                    }
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-[#0077b6] text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-0.5 font-medium">Modification / Onboarding Reason</label>
                <input
                  type="text"
                  required
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="e.g. New catalog addition auto-linked from FXTT grid"
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-[#0077b6] text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-300 font-medium cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0077b6] hover:bg-[#005f94] text-white font-semibold rounded-lg transition-colors cursor-pointer shadow-sm"
                >
                  {editingRow.id.startsWith('new-') ? 'Add to Catalog' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MULTI-VENDOR / MULTI-PROVIDER PRICE MATRIX MODAL */}
      {activeVendorMatrixMaterial && (
        <MaterialVendorPriceMatrixModal
          material={activeVendorMatrixMaterial}
          suppliers={suppliers}
          onClose={() => setActiveVendorMatrixMaterial(null)}
          onUpdateMaterial={handleUpdateMatrixMaterial}
          onUpdateMaterialPrice={handleCommitPrice}
          onAddSupplier={onAddSupplier}
        />
      )}

      {/* 6b. DEDICATED PRODUCT & REVENUE COMPETITOR BENCHMARK MATRIX MODAL */}
      {activeCompetitorModalItem && (
        <ProductCompetitorPriceMatrixModal
          item={activeCompetitorModalItem.item}
          itemType={activeCompetitorModalItem.itemType}
          onClose={() => setActiveCompetitorModalItem(null)}
          onUpdateOurPrice={(newPrice) => {
            handleCommitPrice(
              activeCompetitorModalItem.item.id,
              newPrice,
              'Offering price adjustment aligned with competitor benchmarks'
            );
            setActiveCompetitorModalItem(null);
            showNotification(`Updated rate for ${activeCompetitorModalItem.item.code} to $${newPrice.toLocaleString()}`);
          }}
        />
      )}

      {/* 7. DEDICATED VOLUME RANGES & RATES MODAL */}
      {activeRangesVendor && (
        <VendorLatestRangesModal
          vendor={activeRangesVendor.vendor}
          material={activeRangesVendor.material}
          onClose={() => setActiveRangesVendor(null)}
          onConfigureRanges={(updatedVendor) => {
            showNotification(`Updated volume ranges for ${updatedVendor.vendorName}`);
            setActiveRangesVendor(null);
          }}
          onCommitPriceChange={(updatedVendor) => {
            handleCommitPrice(
              activeRangesVendor.material.id,
              updatedVendor.currentPrice,
              `Volume range adjustment for ${updatedVendor.vendorName}`
            );
            showNotification(`Committed updated rate for ${updatedVendor.vendorName}`);
            setActiveRangesVendor(null);
          }}
        />
      )}

      {/* 8. DEDICATED REVISION CHANGE LOGS & AUDIT TRAIL MODAL */}
      {activeAuditRecord && (
        <RevisionChangesAuditModal
          date="all"
          materialCode={activeAuditRecord.material.code}
          materialName={activeAuditRecord.material.name}
          materialUnit={activeAuditRecord.material.unit}
          vendorQuotes={activeAuditRecord.vendorQuotes}
          initialVendorId={activeAuditRecord.vendorQuotes[0]?.vendorId}
          onClose={() => setActiveAuditRecord(null)}
          onOpenCommitForVendor={(vendor) => {
            setActiveAuditRecord(null);
            setActiveRangesVendor({
              vendor,
              material: activeAuditRecord.material
            });
          }}
        />
      )}

      {/* 8b. FULL-SCREEN PRICE CHANGES AUDIT LOG FXTT GRID VIEW MODAL */}
      {fullScreenAuditItem && (
        <FXTTPriceAuditLogFullScreenModal
          isOpen={!!fullScreenAuditItem}
          onClose={() => setFullScreenAuditItem(null)}
          item={fullScreenAuditItem}
          onOpenItemDetails={(item) => {
            setFullScreenAuditItem(null);
            handleViewDetailsAndAudit(item as any, 'details');
          }}
        />
      )}

      {/* 9. DEDICATED CLIENT PROJECT DETAILS & SCOPE OVERVIEW MODAL */}
      {activeProjectDetail && (
        <div
          className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setActiveProjectDetail(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#0077b6] text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-white/10 rounded-xl border border-white/20">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/20 font-medium">
                      {activeProjectDetail.code}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 font-medium">
                      {activeProjectDetail.status}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold mt-1 text-white tracking-tight">
                    {activeProjectDetail.name}
                  </h2>
                  <p className="text-xs text-white/80">
                    Client Account: {activeProjectDetail.clientName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveProjectDetail(null)}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Financial Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Quoted Revenue</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">
                    ${activeProjectDetail.quotedPrice?.toLocaleString()}
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Target Net Margin</div>
                  <div className="text-xl font-bold text-emerald-600 mt-1">
                    {activeProjectDetail.targetMarginPct}%
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Commencement Date</div>
                  <div className="text-sm font-semibold text-slate-800 mt-1.5 font-mono">
                    {activeProjectDetail.startDate || '2026-03-01'}
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Delivery Deadline</div>
                  <div className="text-sm font-semibold text-slate-800 mt-1.5 font-mono">
                    {activeProjectDetail.deliveryDeadline || '2026-12-31'}
                  </div>
                </div>
              </div>

              {/* Target Deliverable & Domain */}
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
                <div className="text-xs font-semibold text-blue-900 uppercase tracking-wider mb-1">
                  Target Product & Deliverable Scope
                </div>
                <p className="text-sm text-slate-800 font-medium">
                  {activeProjectDetail.targetProduct || activeProjectDetail.name}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-600">
                  <span className="bg-white px-2.5 py-1 rounded-md border border-slate-200">
                    Category: {activeProjectDetail.productCategory}
                  </span>
                  <span className="bg-white px-2.5 py-1 rounded-md border border-slate-200">
                    Sub-Category: {activeProjectDetail.productSubCategory}
                  </span>
                </div>
                {activeProjectDetail.notes && (
                  <p className="mt-3 text-xs text-slate-600 bg-white/70 p-2.5 rounded-lg border border-blue-100">
                    <span className="font-semibold text-slate-700">Execution Directives:</span> {activeProjectDetail.notes}
                  </p>
                )}
              </div>

              {/* Phases Breakdown */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
                  <span>Scheduled Project Phases & Milestones</span>
                  <span className="text-xs font-normal text-slate-500">
                    {activeProjectDetail.phases?.length || 0} Phases Configured
                  </span>
                </h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
                  {(activeProjectDetail.phases || []).map((ph, idx) => (
                    <div key={ph.id || idx} className="p-4 bg-white hover:bg-slate-50/50 transition-colors">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-[#0077b6]">Phase {idx + 1}:</span>
                          <span className="text-xs font-semibold text-slate-900">{ph.name}</span>
                        </div>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          ph.status === 'Completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ph.status === 'In Progress'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {ph.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mb-2">{ph.description}</p>
                      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg">
                        <span>Timeline: {ph.startDate} → {ph.endDate}</span>
                        <div className="space-x-3">
                          <span>Allocated Budget: <strong className="text-slate-800">${ph.budget?.toLocaleString()}</strong></span>
                          <span>Incurred Cost: <strong className="text-slate-800">${ph.actualCost?.toLocaleString()}</strong></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveProjectDetail(null)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-medium cursor-pointer"
              >
                Close
              </button>
              <div className="flex items-center space-x-2">
                {onNavigateToCostAnalysis && (
                  <button
                    type="button"
                    onClick={() => {
                      const proj = activeProjectDetail;
                      setActiveProjectDetail(null);
                      onNavigateToCostAnalysis(proj);
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-medium transition-colors shadow-sm cursor-pointer flex items-center space-x-1.5"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Cost Controls & Margin Analysis</span>
                  </button>
                )}
                {onSelectProject && (
                  <button
                    type="button"
                    onClick={() => {
                      const proj = activeProjectDetail;
                      setActiveProjectDetail(null);
                      onSelectProject(proj);
                    }}
                    className="px-4 py-2 bg-[#0077b6] hover:bg-[#005f94] text-white rounded-xl text-xs font-medium transition-colors shadow-sm cursor-pointer flex items-center space-x-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in Project Workspace</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item Image Viewer Lightbox Modal */}
      <ItemImageViewerModal
        isOpen={!!activeImageViewerItem}
        onClose={() => setActiveImageViewerItem(null)}
        item={activeImageViewerItem}
        onImageUpdated={(newUrl) => {
          if (activeImageViewerItem) {
            activeImageViewerItem.imageUrl = newUrl;
          }
          showNotification('Item image updated successfully');
        }}
      />

      {/* Item Details & Price Audit Modal (from Grid Card button or commands) */}
      <ItemDetailsAndPriceAuditModal
        isOpen={!!detailsAndAuditItem}
        onClose={() => setDetailsAndAuditItem(null)}
        initialTab={detailsAndAuditTab}
        item={detailsAndAuditItem}
        onEdit={(itm) => {
          if (detailsAndAuditItem) {
            setEditingRow(detailsAndAuditItem);
            setNewRate(detailsAndAuditItem.rate);
            setEditReason('Rate adjustment from Details & Audit modal');
          }
        }}
        onOpenImageViewer={() => {
          setActiveImageViewerItem(detailsAndAuditItem);
        }}
      />

      {/* Global & Category Data Import / Export Modal */}
      <DataImportExportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        targetType={
          cardType === 'produce'
            ? 'produce'
            : cardType === 'supplier'
            ? 'suppliers'
            : cardType === 'subcontractor'
            ? 'subcontractors'
            : cardType === 'outsourced'
            ? 'outsourced'
            : 'materials'
        }
        categoryScope={cardTitle}
        subCategoryScope={cardTitle}
        materials={materials}
        produceItems={produceItems}
        suppliers={suppliers}
        subcontractors={subcontractors}
        outsourcedServices={outsourcedServices}
        onImportMaterials={(items) => {
          items.forEach((m) => {
            if (onAddMaterial) {
              onAddMaterial(m as any);
            } else if (onUpdateMaterial) {
              onUpdateMaterial(m.id || `mat-${Date.now()}`, m);
            } else {
              api.createMaterial(m as any).catch(console.error);
            }
          });
          showNotification(`Imported ${items.length} items successfully into ${cardTitle}`);
        }}
        onImportProduce={(items) => {
          items.forEach((p) => {
            if (onAddProduceItem) onAddProduceItem(p);
            else api.createProduce(p as any).catch(console.error);
          });
          showNotification(`Imported ${items.length} produce products / assemblies`);
        }}
        onImportSubcontractors={(subs) => {
          subs.forEach((s) => {
            if (onAddSubcontractor) onAddSubcontractor(s);
            else api.createSubcontractor(s as any).catch(console.error);
          });
          showNotification(`Imported ${subs.length} subcontractor labor rates`);
        }}
        onImportOutsourced={(svcs) => {
          svcs.forEach((s) => {
            if (onAddOutsourcedService) onAddOutsourcedService(s);
            else api.createOutsourcedService(s as any).catch(console.error);
          });
          showNotification(`Imported ${svcs.length} outsourced service rates`);
        }}
        onImportSuppliers={(sups) => {
          sups.forEach((s) => {
            if (onAddSupplier) onAddSupplier(s);
            else api.createSupplier(s as any).catch(console.error);
          });
          showNotification(`Imported ${sups.length} suppliers`);
        }}
        onImportPriceHistory={(recs) => {
          recs.forEach((r) => {
            if (onUpdatePrice) onUpdatePrice(r.itemCode, r.record?.newPrice || 0, r.record?.reason || 'Batch Import');
            else if (onUpdateMaterialPrice) onUpdateMaterialPrice(r.itemCode, r.record?.newPrice || 0, r.record?.reason || 'Batch Import');
          });
          showNotification(`Imported and applied ${recs.length} price revisions`);
        }}
      />

      {/* Delete Confirmation Modal */}
      {rowToDelete && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Record</h3>
                <p className="text-xs text-slate-500">Confirm permanent deletion from database</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-slate-900">{rowToDelete.code} - {rowToDelete.name}</span>? This will permanently remove the record from your central catalog and persistent storage.
            </p>
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRowToDelete(null)}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-300 text-xs font-normal transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteRow}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium transition-colors shadow-xs cursor-pointer"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Google & Google Lens Quick Search Modal */}
      {googleSearchItem && (
        <GoogleSearchPreviewModal
          isOpen={Boolean(googleSearchItem)}
          onClose={() => setGoogleSearchItem(null)}
          item={googleSearchItem}
        />
      )}
    </div>
  </>
  );
};
