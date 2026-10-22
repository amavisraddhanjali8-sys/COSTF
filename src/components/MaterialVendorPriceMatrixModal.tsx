import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  DollarSign,
  Edit,
  Eye,
  FileText,
  Filter,
  Layers,
  Percent,
  Plus,
  Search,
  Tag,
  Trash2,
  Truck,
  User,
  Building2,
  X,
  AlertCircle,
  MoreVertical,
  Sliders,
  Star,
  History,
  Download,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import {
  MaterialItem,
  MaterialVendorQuote,
  VendorPriceChangeRecord,
  VolumePriceTier,
  Supplier,
  TierChangeDetail,
  AppUser,
  AuditLogRecord
} from '../types';
import { api } from '../services/api';
import { RevisionChangesAuditModal } from './RevisionChangesAuditModal';
import { VendorLatestRangesModal } from './VendorLatestRangesModal';
import { downloadCSV } from '../utils/csvExport';
import { getStoredCurrentUser, saveStoredAuditLogs, getStoredAuditLogs } from '../data/userAndAuditData';

interface MaterialVendorPriceMatrixModalProps {
  material: MaterialItem;
  suppliers: Supplier[];
  onClose: () => void;
  onUpdateMaterial: (updatedMaterial: MaterialItem) => void;
  onUpdateMaterialPrice?: (id: string, newPrice: number, reason: string) => void;
  onAddSupplier?: (supplier: Partial<Supplier>) => void;
  currentUser?: AppUser | null;
  onLogAudit?: (action: string, module: any, recordId?: string, recordName?: string, details?: string) => void;
}

// Sanitizes or initializes vendor quotes: strictly relevant vendors only, removes irrelevant dummy records
export const getOrInitializeVendorQuotes = (
  material: MaterialItem,
  suppliers: Supplier[]
): MaterialVendorQuote[] => {
  // Check if a vendor quote is one of the generic irrelevant dummy quotes injected by old template
  const isGenericDummyQuote = (vq: MaterialVendorQuote) => {
    const dummyNames = [
      'vulcan forge & billet works',
      'titan alloy sourcing international',
      'nippon precision metal ltd'
    ];
    const dummyIds = ['sup-02', 'sup-03', 'sup-04'];
    const vqNameLower = (vq.vendorName || '').toLowerCase().trim();
    const isNamedDummy = dummyNames.includes(vqNameLower);
    const isIdDummy = dummyIds.includes(vq.vendorId);

    // If the material's actual supplier has this name or ID, it is not a dummy
    const isActualMaterialSupplier =
      (material.supplierName && material.supplierName.toLowerCase().trim() === vqNameLower) ||
      (material.supplierId && material.supplierId === vq.vendorId);

    return (isNamedDummy || isIdDummy) && !isActualMaterialSupplier;
  };

  // If vendor quotes already exist on the material, filter out any irrelevant dummy quotes
  if (material.vendorQuotes && material.vendorQuotes.length > 0) {
    const relevantQuotes = material.vendorQuotes.filter((vq) => !isGenericDummyQuote(vq));
    if (relevantQuotes.length > 0) {
      return relevantQuotes.map((vq) => {
        if (!vq.volumePricing || vq.volumePricing.length === 0) {
          const p = vq.currentPrice;
          const moq = vq.moq || 1;
          return {
            ...vq,
            volumePricing: [
              { minQty: moq, maxQty: moq * 4, unitPrice: p, discountPct: 0, label: `${moq}-${moq * 4} (Base MOQ)` },
              { minQty: moq * 4 + 1, maxQty: moq * 15, unitPrice: Number((p * 0.92).toFixed(2)), discountPct: 8.0, label: `${moq * 4 + 1}-${moq * 15} (Volume Pack)` },
              { minQty: moq * 15 + 1, unitPrice: Number((p * 0.85).toFixed(2)), discountPct: 15.0, label: `${moq * 15 + 1}+ (Bulk Mill Lot)` }
            ]
          };
        }
        return vq;
      });
    }
  }

  // If no relevant vendor quotes exist yet, initialize ONLY the material's actual relevant supplier
  const basePrice = material.retailPrice || (material as any).rate || 100;
  const primarySupplierName = material.supplierName;

  if (primarySupplierName || material.supplierId) {
    const matchedSupplier = suppliers.find(
      (s) =>
        (material.supplierId && s.id === material.supplierId) ||
        (primarySupplierName && s.name.toLowerCase().trim() === primarySupplierName.toLowerCase().trim())
    );

    const supName = primarySupplierName || matchedSupplier?.name || 'Primary Supplier';
    const supId = material.supplierId || matchedSupplier?.id || `sup-${material.id}`;
    const moq = (material as any).moq || 1;
    const leadTime = material.leadTimeDays || matchedSupplier?.leadTimeDays || 7;

    // Use material's real price history if available, else 1 initial benchmark quote
    const realHistory: VendorPriceChangeRecord[] =
      material.priceHistory && material.priceHistory.length > 0
        ? material.priceHistory.map((ph, idx) => ({
            id: ph.id || `hist-${idx}-${ph.date}`,
            date: ph.date || new Date().toISOString().slice(0, 10),
            price: ph.newPrice,
            previousPrice: ph.previousPrice,
            changePct: ph.changePct,
            reason: ph.reason || 'Tariff & price adjustment',
            quoteRef: `QT-${material.code}-${ph.date}`,
            moq,
            leadTimeDays: leadTime,
            updatedBy: ph.updatedBy || 'Procurement Estimator',
            appliedChangesSummary: [
              `Base Quoted Rate: $${ph.previousPrice != null ? ph.previousPrice.toFixed(2) : '0.00'} → $${ph.newPrice != null ? ph.newPrice.toFixed(2) : '0.00'}`
            ]
          }))
        : [
            {
              id: `hist-init-${material.id}`,
              date: material.lastUpdated || new Date().toISOString().slice(0, 10),
              price: basePrice,
              reason: 'Initial catalog onboarding benchmark quote',
              quoteRef: `QT-${material.code}-INIT`,
              moq,
              leadTimeDays: leadTime,
              updatedBy: 'Catalog Lead',
              appliedChangesSummary: [
                `Initial Quoted Base Rate established at $${basePrice.toFixed(2)}`
              ]
            }
          ];

    return [
      {
        vendorId: supId,
        vendorName: supName,
        country: matchedSupplier?.country || 'United States',
        currentPrice: basePrice,
        currency: material.currency || 'USD',
        leadTimeDays: leadTime,
        moq,
        isPreferred: true,
        status: 'Preferred',
        lastUpdated: material.lastUpdated || new Date().toISOString().slice(0, 10),
        contactEmail: matchedSupplier?.email || `sales@${supName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
        contactPhone: matchedSupplier?.phone || '+1 415 252 7217',
        notes: matchedSupplier?.notes || 'Contracted primary vendor with certified mill test specification.',
        volumePricing: [
          { minQty: 1, maxQty: moq * 4, unitPrice: basePrice, discountPct: 0, label: `1–${moq * 4} (Base MOQ)` },
          { minQty: moq * 4 + 1, maxQty: moq * 15, unitPrice: Number((basePrice * 0.92).toFixed(2)), discountPct: 8.0, label: `${moq * 4 + 1}–${moq * 15} (-8%)` },
          { minQty: moq * 15 + 1, unitPrice: Number((basePrice * 0.85).toFixed(2)), discountPct: 15.0, label: `${moq * 15 + 1}+ (-15%)` }
        ],
        priceHistory: realHistory
      }
    ];
  }

  // If material has no supplier at all, return empty list (user can click + Add Vendor Column)
  return [];
};

export const MaterialVendorPriceMatrixModal: React.FC<MaterialVendorPriceMatrixModalProps> = ({
  material,
  suppliers,
  onClose,
  onUpdateMaterial,
  onUpdateMaterialPrice,
  onAddSupplier,
  currentUser,
  onLogAudit
}) => {
  // Vendor quotes state
  const [vendorQuotes, setVendorQuotes] = useState<MaterialVendorQuote[]>(() =>
    getOrInitializeVendorQuotes(material, suppliers)
  );

  // Sync vendor quotes from PostgreSQL database
  useEffect(() => {
    let isMounted = true;
    api.getMaterialVendorQuotes(material.id)
      .then((dbQuotes) => {
        if (isMounted && Array.isArray(dbQuotes) && dbQuotes.length > 0) {
          setVendorQuotes(dbQuotes);
        }
      })
      .catch((err) => {
        console.warn('[PriceMatrix] Database vendor quotes load warning:', err?.message);
      });
    return () => {
      isMounted = false;
    };
  }, [material.id]);

  const [searchFilter, setSearchFilter] = useState('');

  // Active Revision Audit Modal State
  const [activeAuditModal, setActiveAuditModal] = useState<{
    date: string;
    targetVendorId: string | null;
  } | null>(null);

  // View latest bulk price ranges and quantity tiers modal for a vendor (from header View button)
  const [viewingVendorBulkPrices, setViewingVendorBulkPrices] = useState<MaterialVendorQuote | null>(null);

  // Dropdown menu state for vendor column header actions menu button
  const [openVendorMenuId, setOpenVendorMenuId] = useState<string | null>(null);

  // Commit Price dialog state: supports changing base price and/or selected bulk price ranges, range sizes, and discount rates
  const [selectedVendorForCommit, setSelectedVendorForCommit] = useState<MaterialVendorQuote | null>(null);
  const [commitForm, setCommitForm] = useState<{
    changeBasePrice: boolean;
    newBasePrice: number;
    effectiveDate: string;
    reason: string;
    quoteRef: string;
    moq: number;
    leadTimeDays: number;
    setAsPrimary: boolean;
    updatedBy: string;
    selectedRanges: {
      rangeIndex: number;
      label: string;
      minQty: number;
      currentMinQty: number;
      maxQty?: number;
      currentMaxQty?: number;
      currentPrice: number;
      newPrice: number;
      currentDiscountPct: number;
      discountPct: number;
      selected: boolean;
    }[];
  }>({
    changeBasePrice: true,
    newBasePrice: 0,
    effectiveDate: new Date().toISOString().split('T')[0],
    reason: '',
    quoteRef: '',
    moq: 10,
    leadTimeDays: 7,
    setAsPrimary: false,
    updatedBy: 'Procurement Lead',
    selectedRanges: []
  });

  // "+ Add / Configure Ranges" modal state
  const [vendorForRangeConfig, setVendorForRangeConfig] = useState<MaterialVendorQuote | null>(null);
  const [rangesConfigList, setRangesConfigList] = useState<VolumePriceTier[]>([]);

  // "+ Add Vendor Column" modal state
  const [isAddVendorModalOpen, setIsAddVendorModalOpen] = useState(false);
  const [addVendorMode, setAddVendorMode] = useState<'select_existing' | 'create_new'>('select_existing');

  // "Edit Vendor Details" modal state
  const [editingVendor, setEditingVendor] = useState<MaterialVendorQuote | null>(null);
  const [editVendorForm, setEditVendorForm] = useState({
    vendorName: '',
    country: 'United States',
    contactEmail: '',
    contactPhone: '',
    leadTimeDays: 7,
    moq: 1,
    currency: 'USD',
    status: 'Active' as const,
    notes: ''
  });

  // "Delete Vendor" modal state with compliance archive download enforcement
  const [vendorToDelete, setVendorToDelete] = useState<MaterialVendorQuote | null>(null);
  const [isArchiveDownloaded, setIsArchiveDownloaded] = useState<boolean>(false);
  const [lastDownloadedFilename, setLastDownloadedFilename] = useState<string>('');

  const handleOpenEditVendor = (vendor: MaterialVendorQuote) => {
    setOpenVendorMenuId(null);
    setEditingVendor(vendor);
    setEditVendorForm({
      vendorName: vendor.vendorName,
      country: vendor.country || 'United States',
      contactEmail: vendor.contactEmail || '',
      contactPhone: vendor.contactPhone || '',
      leadTimeDays: vendor.leadTimeDays || 7,
      moq: vendor.moq || 1,
      currency: vendor.currency || 'USD',
      status: (vendor.status as any) || 'Active',
      notes: vendor.notes || ''
    });
  };

  const handleSaveVendorEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVendor) return;

    const oldName = editingVendor.vendorName;
    const newName = editVendorForm.vendorName.trim();
    if (!newName) return;

    const updatedQuotes = vendorQuotes.map((vq) => {
      if (vq.vendorId === editingVendor.vendorId) {
        return {
          ...vq,
          vendorName: newName,
          country: editVendorForm.country,
          contactEmail: editVendorForm.contactEmail,
          contactPhone: editVendorForm.contactPhone,
          leadTimeDays: Number(editVendorForm.leadTimeDays),
          moq: Number(editVendorForm.moq),
          currency: editVendorForm.currency,
          status: editVendorForm.status,
          notes: editVendorForm.notes
        };
      }
      return vq;
    });

    setVendorQuotes(updatedQuotes);

    const updatedMaterial: MaterialItem = {
      ...material,
      vendorQuotes: updatedQuotes,
      supplierName: editingVendor.isPreferred ? newName : material.supplierName
    };

    onUpdateMaterial(updatedMaterial);

    const actor = currentUser || getStoredCurrentUser() || {
      id: 'ADMIN-01',
      name: 'Administrator',
      role: 'ADMIN',
      employeeId: 'ADMIN-01'
    };

    const auditEntry: AuditLogRecord = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      actorId: actor.id || actor.employeeId || 'ADMIN-01',
      actorName: actor.name || 'Administrator',
      actorRole: actor.role || 'ADMIN',
      action: 'VENDOR_UPDATED',
      actionType: 'UPDATE',
      module: 'Materials',
      recordId: material.id,
      recordName: `${material.code} - ${material.name}`,
      entityType: 'MaterialVendorQuote',
      entityId: editingVendor.vendorId,
      details: `Updated supplier details for "${oldName}" ${oldName !== newName ? `(renamed to "${newName}")` : ''} on item ${material.code} (${material.name}). SLA: ${editVendorForm.leadTimeDays}d, MOQ: ${editVendorForm.moq}, Country: ${editVendorForm.country}. Operator: ${actor.name} (${actor.role}).`,
      ipAddress: '127.0.0.1',
      status: 'Success',
      metadata: {
        itemId: material.id,
        itemCode: material.code,
        vendorId: editingVendor.vendorId,
        oldName,
        newName,
        leadTimeDays: editVendorForm.leadTimeDays,
        moq: editVendorForm.moq,
        status: editVendorForm.status,
        user: {
          id: actor.id,
          name: actor.name,
          role: actor.role
        }
      }
    };

    saveStoredAuditLogs([auditEntry, ...getStoredAuditLogs()]);
    api.createAuditLog(auditEntry).catch(() => {});
    if (onLogAudit) {
      onLogAudit('VENDOR_UPDATED', 'Materials', material.id, material.name, auditEntry.details);
    }

    // Persist vendor quote modifications directly into PostgreSQL database
    const quoteDbId = editingVendor.id || editingVendor.vendorId;
    api.updateMaterialVendorQuote(material.id, quoteDbId, {
      vendorName: newName,
      country: editVendorForm.country,
      contactEmail: editVendorForm.contactEmail,
      contactPhone: editVendorForm.contactPhone,
      leadTimeDays: Number(editVendorForm.leadTimeDays),
      moq: Number(editVendorForm.moq),
      currency: editVendorForm.currency,
      status: editVendorForm.status,
      notes: editVendorForm.notes
    }).catch((err) => console.warn('[PriceMatrix] Update vendor quote API warning:', err?.message));

    setEditingVendor(null);
  };

  const handleDeleteVendorClick = (vendor: MaterialVendorQuote) => {
    setOpenVendorMenuId(null);
    setVendorToDelete(vendor);
    setIsArchiveDownloaded(false);
    setLastDownloadedFilename('');
  };

  const handleDownloadPriceHistoryArchive = () => {
    if (!vendorToDelete) return;

    const actor = currentUser || getStoredCurrentUser() || {
      id: 'ADMIN-01',
      name: 'Administrator',
      role: 'ADMIN',
      employeeId: 'ADMIN-01'
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeVendorName = vendorToDelete.vendorName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${material.code || material.id}_${safeVendorName}_PriceHistory_Archive_${timestamp}.csv`;

    const headers = [
      'Item ID',
      'Item Code',
      'Item Name',
      'Unit',
      'Vendor ID',
      'Vendor Name',
      'Vendor Country',
      'Currency',
      'Contact Email',
      'Contact Phone',
      'Lead Time Days',
      'MOQ',
      'Vendor Status',
      'Revision ID',
      'Revision Date',
      'Previous Price',
      'New Quoted Price',
      'Change %',
      'Reason',
      'Quote Ref',
      'Updated By',
      'Summary of Applied Changes',
      'Archived At Timestamp',
      'Archived By User ID',
      'Archived By User Name',
      'Archived By User Role'
    ];

    const revisions = vendorToDelete.priceHistory && vendorToDelete.priceHistory.length > 0
      ? vendorToDelete.priceHistory
      : [
          {
            id: `init-${vendorToDelete.vendorId}`,
            date: vendorToDelete.lastUpdated || new Date().toISOString().slice(0, 10),
            price: vendorToDelete.currentPrice,
            previousPrice: vendorToDelete.currentPrice,
            changePct: 0,
            reason: 'Current catalog rate (No prior revisions)',
            quoteRef: `QT-${material.code}-CURR`,
            updatedBy: 'Catalog Lead',
            appliedChangesSummary: [`Current rate at $${vendorToDelete.currentPrice.toFixed(2)}`]
          } as VendorPriceChangeRecord
        ];

    const nowIso = new Date().toISOString();
    const rows = revisions.map((r) => [
      material.id,
      material.code,
      material.name,
      material.unit,
      vendorToDelete.vendorId,
      vendorToDelete.vendorName,
      vendorToDelete.country || '',
      vendorToDelete.currency || 'USD',
      vendorToDelete.contactEmail || '',
      vendorToDelete.contactPhone || '',
      vendorToDelete.leadTimeDays || '',
      vendorToDelete.moq || '',
      vendorToDelete.status || '',
      r.id,
      r.date,
      r.previousPrice != null ? r.previousPrice : '',
      r.price != null ? r.price : '',
      r.changePct != null ? `${r.changePct}%` : '0%',
      r.reason || '',
      r.quoteRef || '',
      r.updatedBy || '',
      (r.appliedChangesSummary || []).join('; '),
      nowIso,
      actor.id || actor.employeeId || 'ADMIN-01',
      actor.name || 'Administrator',
      actor.role || 'ADMIN'
    ]);

    downloadCSV(filename, headers, rows);
    setIsArchiveDownloaded(true);
    setLastDownloadedFilename(filename);
  };

  const handleConfirmDeleteVendor = () => {
    if (!vendorToDelete) return;
    const historyCount = vendorToDelete.priceHistory?.length || 0;

    // Strict enforcement: if vendor has price history, download must occur
    if (historyCount > 0 && !isArchiveDownloaded) {
      handleDownloadPriceHistoryArchive();
    }

    const actor = currentUser || getStoredCurrentUser() || {
      id: 'ADMIN-01',
      name: 'Administrator',
      role: 'ADMIN',
      employeeId: 'ADMIN-01'
    };

    const safeFilename = lastDownloadedFilename || `${material.code}_${vendorToDelete.vendorName.replace(/[^a-zA-Z0-9_-]/g, '_')}_PriceHistory_Archive_${new Date().toISOString().slice(0, 10)}.csv`;

    const updatedQuotes = vendorQuotes.filter((vq) => vq.vendorId !== vendorToDelete.vendorId);

    // If deleted vendor was primary, promote next available vendor to primary
    let newSupplierName = material.supplierName;
    let newSupplierId = material.supplierId;
    let newRetailPrice = material.retailPrice;

    if (vendorToDelete.isPreferred && updatedQuotes.length > 0) {
      updatedQuotes[0].isPreferred = true;
      updatedQuotes[0].status = 'Preferred';
      newSupplierName = updatedQuotes[0].vendorName;
      newSupplierId = updatedQuotes[0].vendorId;
      newRetailPrice = updatedQuotes[0].currentPrice;
    } else if (updatedQuotes.length === 0) {
      newSupplierName = '';
      newSupplierId = '';
    }

    setVendorQuotes(updatedQuotes);

    const updatedMaterial: MaterialItem = {
      ...material,
      vendorQuotes: updatedQuotes,
      supplierName: newSupplierName,
      supplierId: newSupplierId,
      retailPrice: newRetailPrice
    };

    onUpdateMaterial(updatedMaterial);

    const auditEntry: AuditLogRecord = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      actorId: actor.id || actor.employeeId || 'ADMIN-01',
      actorName: actor.name || 'Administrator',
      actorRole: actor.role || 'ADMIN',
      action: historyCount > 0 ? 'VENDOR_PRICE_HISTORY_ARCHIVED_AND_DELETED' : 'VENDOR_DELETED',
      actionType: 'DELETE',
      module: 'Materials',
      recordId: material.id,
      recordName: `${material.code} - ${material.name}`,
      entityType: 'MaterialVendorQuote',
      entityId: vendorToDelete.vendorId,
      details: historyCount > 0
        ? `Archived and deleted vendor "${vendorToDelete.vendorName}" with ${historyCount} historical price revision(s) for item ${material.code} (${material.name}). Archive downloaded file: "${safeFilename}". Performed by: ${actor.name} (${actor.role}, ID: ${actor.id || actor.employeeId}).`
        : `Deleted vendor "${vendorToDelete.vendorName}" from item ${material.code} (${material.name}). No prior price revision history existed. Performed by: ${actor.name} (${actor.role}).`,
      ipAddress: '127.0.0.1',
      status: 'Success',
      metadata: {
        itemId: material.id,
        itemCode: material.code,
        itemName: material.name,
        vendorId: vendorToDelete.vendorId,
        vendorName: vendorToDelete.vendorName,
        historyCount,
        archivedFileName: safeFilename,
        user: {
          id: actor.id || actor.employeeId,
          name: actor.name,
          role: actor.role,
          email: (actor as any).email
        },
        deletedAt: new Date().toISOString()
      }
    };

    saveStoredAuditLogs([auditEntry, ...getStoredAuditLogs()]);
    api.createAuditLog(auditEntry).catch(() => {});
    if (onLogAudit) {
      onLogAudit(
        historyCount > 0 ? 'VENDOR_PRICE_HISTORY_ARCHIVED_AND_DELETED' : 'VENDOR_DELETED',
        'Materials',
        material.id,
        material.name,
        auditEntry.details
      );
    }

    // Persist archive record and delete quote from PostgreSQL database
    const quoteDbId = vendorToDelete.id || vendorToDelete.vendorId;
    api.archiveAndDeleteVendor(material.id, quoteDbId, {
      archivedFilename: safeFilename,
      user: {
        id: actor.id || actor.employeeId,
        name: actor.name,
        role: actor.role,
        email: (actor as any).email
      },
      notes: historyCount > 0
        ? `Archived ${historyCount} historical price revisions and deleted vendor`
        : 'Deleted vendor'
    }).catch((err) => {
      console.warn('[PriceMatrix] API archiveAndDeleteVendor warning:', err?.message);
    });

    setVendorToDelete(null);
    setIsArchiveDownloaded(false);
    setLastDownloadedFilename('');
  };

  const [newVendorForm, setNewVendorForm] = useState({
    supplierId: '',
    vendorName: '',
    country: 'United States',
    city: 'Chicago',
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',
    paymentTerms: 'Net 30',
    profileNotes: 'Direct manufacturing mill partner onboarded to multi-vendor comparison matrix.',
    startingPrice: material.retailPrice || 420,
    leadTimeDays: 7,
    moq: 10,
    quoteRef: `QT-${material.code}-NEW`,
    quoteReason: 'Onboarding new qualified vendor quote with multi-tier bulk pricing.',
    isPreferred: false,
    volumeTiers: [
      { minQty: 1, maxQty: 10, unitPrice: material.retailPrice || 420, discountPct: 0, label: '1–10 (Base MOQ)' },
      { minQty: 11, maxQty: 50, unitPrice: Number(((material.retailPrice || 420) * 0.92).toFixed(2)), discountPct: 8.0, label: '11–50 (-8%)' },
      { minQty: 51, maxQty: 200, unitPrice: Number(((material.retailPrice || 420) * 0.85).toFixed(2)), discountPct: 15.0, label: '51–200 (-15%)' }
    ] as VolumePriceTier[]
  });

  // Summary Market Metrics
  const metrics = useMemo(() => {
    const prices = vendorQuotes.map((vq) => vq.currentPrice).filter((p) => p > 0);
    const min = prices.length > 0 ? Math.min(...prices) : 0;
    const max = prices.length > 0 ? Math.max(...prices) : 0;
    const lowestVendor = vendorQuotes.find((vq) => vq.currentPrice === min);
    const preferredVendor = vendorQuotes.find((vq) => vq.isPreferred) || vendorQuotes[0];
    const preferredPrice = preferredVendor ? preferredVendor.currentPrice : min;
    const spread = max - min;
    const spreadPct = min > 0 ? (spread / min) * 100 : 0;

    return {
      lowestPrice: min,
      highestPrice: max,
      lowestVendor: lowestVendor ? lowestVendor.vendorName : 'None',
      preferredPrice,
      preferredVendor: preferredVendor ? preferredVendor.vendorName : 'None',
      spread,
      spreadPct
    };
  }, [vendorQuotes]);

  // Historical Revision Events Timeline
  const timelineRecords = useMemo(() => {
    const dateMap = new Map<
      string,
      {
        date: string;
        latestReason: string;
        quoteRefs: string[];
        changedVendors: string[];
      }
    >();

    vendorQuotes.forEach((v) => {
      (v.priceHistory || []).forEach((hist) => {
        if (!dateMap.has(hist.date)) {
          dateMap.set(hist.date, {
            date: hist.date,
            latestReason: hist.reason || 'Price revision',
            quoteRefs: hist.quoteRef ? [hist.quoteRef] : [],
            changedVendors: [v.vendorName]
          });
        } else {
          const entry = dateMap.get(hist.date)!;
          if (!entry.changedVendors.includes(v.vendorName)) {
            entry.changedVendors.push(v.vendorName);
          }
          if (hist.quoteRef && !entry.quoteRefs.includes(hist.quoteRef)) {
            entry.quoteRefs.push(hist.quoteRef);
          }
        }
      });
    });

    // Sort newest to oldest
    const sorted = Array.from(dateMap.values()).sort((a, b) => b.date.localeCompare(a.date));

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      return sorted.filter(
        (r) =>
          r.date.toLowerCase().includes(q) ||
          r.latestReason.toLowerCase().includes(q) ||
          r.changedVendors.some((vn) => vn.toLowerCase().includes(q)) ||
          r.quoteRefs.some((ref) => ref.toLowerCase().includes(q))
      );
    }

    return sorted;
  }, [vendorQuotes, searchFilter]);

  // Open Commit Price dialog for a vendor
  const handleOpenCommitPrice = (vendor: MaterialVendorQuote) => {
    setSelectedVendorForCommit(vendor);
    const today = new Date().toISOString().split('T')[0];

    const ranges = (vendor.volumePricing || []).map((t, idx) => ({
      rangeIndex: idx,
      label: t.label,
      minQty: t.minQty,
      currentMinQty: t.minQty,
      maxQty: t.maxQty,
      currentMaxQty: t.maxQty,
      currentPrice: t.unitPrice,
      newPrice: t.unitPrice,
      currentDiscountPct: t.discountPct,
      discountPct: t.discountPct,
      selected: false
    }));

    setCommitForm({
      changeBasePrice: true,
      newBasePrice: vendor.currentPrice,
      effectiveDate: today,
      reason: '',
      quoteRef: `QT-${material.code}-${Date.now().toString().slice(-4)}`,
      moq: vendor.moq || 10,
      leadTimeDays: vendor.leadTimeDays || 7,
      setAsPrimary: vendor.isPreferred || false,
      updatedBy: 'Procurement Lead',
      selectedRanges: ranges
    });
  };

  // Open Range Configuration Modal for a vendor
  const handleOpenRangeConfig = (vendor: MaterialVendorQuote) => {
    setVendorForRangeConfig(vendor);
    setRangesConfigList([...(vendor.volumePricing || [])]);
  };

  // Save Range Configuration
  const handleSaveRangesConfig = () => {
    if (!vendorForRangeConfig) return;

    const updatedQuotes = vendorQuotes.map((vq) => {
      if (vq.vendorId === vendorForRangeConfig.vendorId) {
        return {
          ...vq,
          volumePricing: rangesConfigList
        };
      }
      return vq;
    });

    setVendorQuotes(updatedQuotes);

    const updatedMaterial: MaterialItem = {
      ...material,
      vendorQuotes: updatedQuotes
    };
    onUpdateMaterial(updatedMaterial);
    setVendorForRangeConfig(null);
  };

  // Commit price change handler:
  // "when commit changes there could change discount rates , range sizes. that also must recoreded"
  // "all changes must be recorded"
  const handleSubmitPriceCommit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendorForCommit) return;

    const oldBasePrice = selectedVendorForCommit.currentPrice;
    const isBaseChanged = commitForm.changeBasePrice && commitForm.newBasePrice !== oldBasePrice;

    // Detect all selected ranges that changed: price, discount rate, or range sizes (minQty, maxQty)
    const changedRanges = commitForm.selectedRanges.filter((r) => {
      if (!r.selected) return false;
      const isPriceChanged = r.newPrice !== r.currentPrice;
      const isDiscountChanged = r.discountPct !== r.currentDiscountPct;
      const isRangeSizeChanged = r.minQty !== r.currentMinQty || r.maxQty !== r.currentMaxQty;
      return isPriceChanged || isDiscountChanged || isRangeSizeChanged;
    });

    // If neither base changed nor any selected range changed, don't record empty event
    if (!isBaseChanged && changedRanges.length === 0 && !commitForm.changeBasePrice) {
      setSelectedVendorForCommit(null);
      return;
    }

    const finalBasePrice = commitForm.changeBasePrice ? Number(commitForm.newBasePrice) : oldBasePrice;
    const baseChangePct =
      oldBasePrice > 0 ? Number((((finalBasePrice - oldBasePrice) / oldBasePrice) * 100).toFixed(2)) : 0;

    // Create detailed applied changes summary for audit tracking
    const appliedChangesSummary: string[] = [];

    if (isBaseChanged) {
      appliedChangesSummary.push(
        `Base Quoted Rate: $${oldBasePrice.toFixed(2)} → $${finalBasePrice.toFixed(2)} (${baseChangePct > 0 ? '+' : ''}${baseChangePct}%)`
      );
    }

    // Detailed tier change objects
    const tierChanges: TierChangeDetail[] = changedRanges.map((r) => {
      const isPriceChanged = r.newPrice !== r.currentPrice;
      const isDiscountChanged = r.discountPct !== r.currentDiscountPct;
      const isRangeSizeChanged = r.minQty !== r.currentMinQty || r.maxQty !== r.currentMaxQty;

      if (isRangeSizeChanged) {
        appliedChangesSummary.push(
          `Range Size for "${r.label}": ${r.currentMinQty}–${r.currentMaxQty || '+'} → ${r.minQty}–${r.maxQty || '+'}`
        );
      }
      if (isDiscountChanged) {
        appliedChangesSummary.push(
          `Discount Rate for "${r.label}": ${r.currentDiscountPct}% → ${r.discountPct}%`
        );
      }
      if (isPriceChanged) {
        appliedChangesSummary.push(
          `Bulk Unit Price for "${r.label}": $${r.currentPrice.toFixed(2)} → $${r.newPrice.toFixed(2)}`
        );
      }

      let changeType: 'price' | 'discount' | 'range_size' | 'all' = 'price';
      if (isRangeSizeChanged && (isDiscountChanged || isPriceChanged)) {
        changeType = 'all';
      } else if (isRangeSizeChanged) {
        changeType = 'range_size';
      } else if (isDiscountChanged) {
        changeType = 'discount';
      }

      return {
        tierLabel: r.label,
        previousMinQty: r.currentMinQty,
        newMinQty: r.minQty,
        previousMaxQty: r.currentMaxQty,
        newMaxQty: r.maxQty,
        previousPrice: r.currentPrice,
        newPrice: Number(r.newPrice),
        previousDiscountPct: r.currentDiscountPct,
        newDiscountPct: Number(r.discountPct),
        changeType
      };
    });

    // Create changed tiers array for recording
    const recordedChangedTiers: VolumePriceTier[] = changedRanges.map((r) => ({
      minQty: r.minQty,
      maxQty: r.maxQty,
      unitPrice: Number(r.newPrice),
      discountPct: Number(r.discountPct),
      label: r.label
    }));

    // Generate descriptive target tier label
    let targetTierLabel = '';
    if (isBaseChanged && changedRanges.length > 0) {
      targetTierLabel = `Base + ${changedRanges.length} Range(s)`;
    } else if (isBaseChanged) {
      targetTierLabel = 'Base Rate';
    } else if (changedRanges.length === 1) {
      targetTierLabel = `Range: ${changedRanges[0].label}`;
    } else {
      targetTierLabel = `${changedRanges.length} Ranges Changed`;
    }

    // Build comprehensive revision record capturing discount rates, range sizes, reasons and summaries
    const newRecord: VendorPriceChangeRecord = {
      id: `hist-vq-${Date.now()}`,
      date: commitForm.effectiveDate,
      price: finalBasePrice,
      previousPrice: oldBasePrice,
      changePct: baseChangePct,
      reason: commitForm.reason.trim() || 'Official vendor quotation adjustment and volume structure update.',
      quoteRef: commitForm.quoteRef.trim(),
      moq: commitForm.moq,
      leadTimeDays: commitForm.leadTimeDays,
      updatedBy: commitForm.updatedBy.trim() || 'Estimator',
      changedTiers: recordedChangedTiers.length > 0 ? recordedChangedTiers : undefined,
      targetTierLabel: targetTierLabel || undefined,
      tierChanges: tierChanges.length > 0 ? tierChanges : undefined,
      appliedChangesSummary: appliedChangesSummary.length > 0 ? appliedChangesSummary : undefined
    };

    // Update the vendor's active volume pricing tiers with new prices, discounts, and range sizes
    let updatedVendorTiers = [...(selectedVendorForCommit.volumePricing || [])];
    changedRanges.forEach((cr) => {
      if (updatedVendorTiers[cr.rangeIndex]) {
        updatedVendorTiers[cr.rangeIndex] = {
          ...updatedVendorTiers[cr.rangeIndex],
          minQty: cr.minQty,
          maxQty: cr.maxQty,
          unitPrice: Number(cr.newPrice),
          discountPct: Number(cr.discountPct),
          label: cr.label
        };
      }
    });

    // Update vendors list
    const updatedQuotes = vendorQuotes.map((vq) => {
      if (vq.vendorId === selectedVendorForCommit.vendorId) {
        const existingHistory = vq.priceHistory || [];
        return {
          ...vq,
          currentPrice: finalBasePrice,
          volumePricing: updatedVendorTiers,
          leadTimeDays: commitForm.leadTimeDays,
          moq: commitForm.moq,
          isPreferred: commitForm.setAsPrimary ? true : vq.isPreferred,
          status: commitForm.setAsPrimary ? ('Preferred' as const) : vq.status,
          lastUpdated: commitForm.effectiveDate,
          priceHistory: [newRecord, ...existingHistory]
        };
      } else {
        return {
          ...vq,
          isPreferred: commitForm.setAsPrimary ? false : vq.isPreferred,
          status: commitForm.setAsPrimary && vq.isPreferred ? ('Active' as const) : vq.status
        };
      }
    });

    setVendorQuotes(updatedQuotes);

    // If set as primary, synchronize material's active retailPrice
    const updatedMaterial: MaterialItem = {
      ...material,
      vendorQuotes: updatedQuotes,
      retailPrice: commitForm.setAsPrimary ? finalBasePrice : material.retailPrice,
      supplierId: commitForm.setAsPrimary ? selectedVendorForCommit.vendorId : material.supplierId,
      supplierName: commitForm.setAsPrimary ? selectedVendorForCommit.vendorName : material.supplierName,
      leadTimeDays: commitForm.setAsPrimary ? commitForm.leadTimeDays : material.leadTimeDays,
      lastUpdated: commitForm.effectiveDate,
      priceHistory:
        commitForm.setAsPrimary && isBaseChanged
          ? [
              {
                id: `ph-sync-${Date.now()}`,
                date: commitForm.effectiveDate,
                previousPrice: material.retailPrice,
                newPrice: finalBasePrice,
                changePct: baseChangePct,
                reason: `[${selectedVendorForCommit.vendorName}] ${commitForm.reason}`,
                updatedBy: commitForm.updatedBy
              },
              ...(material.priceHistory || [])
            ]
          : material.priceHistory
    };

    onUpdateMaterial(updatedMaterial);
    if (commitForm.setAsPrimary && onUpdateMaterialPrice && isBaseChanged) {
      onUpdateMaterialPrice(
        material.id,
        finalBasePrice,
        `[${selectedVendorForCommit.vendorName}] ${commitForm.reason}`
      );
    }

    // Persist price revision & volume tiers directly into PostgreSQL database
    const quoteDbId = selectedVendorForCommit.id || selectedVendorForCommit.vendorId;
    api.commitMaterialVendorPrice(material.id, quoteDbId, {
      changeBasePrice: isBaseChanged,
      newBasePrice: finalBasePrice,
      effectiveDate: commitForm.effectiveDate,
      reason: commitForm.reason,
      quoteRef: commitForm.quoteRef,
      moq: commitForm.moq,
      leadTimeDays: commitForm.leadTimeDays,
      setAsPrimary: commitForm.setAsPrimary,
      updatedBy: commitForm.updatedBy,
      selectedRanges: changedRanges,
      recordedChangedTiers,
      targetTierLabel,
      tierChanges,
      appliedChangesSummary
    }).catch((err) => console.warn('[PriceMatrix] API commitMaterialVendorPrice warning:', err?.message));

    setSelectedVendorForCommit(null);
  };

  // Set vendor as primary supplier directly
  const handleSetPrimaryVendor = (vendor: MaterialVendorQuote) => {
    const updatedQuotes = vendorQuotes.map((vq) => ({
      ...vq,
      isPreferred: vq.vendorId === vendor.vendorId,
      status: vq.vendorId === vendor.vendorId ? ('Preferred' as const) : ('Active' as const)
    }));

    setVendorQuotes(updatedQuotes);

    const updatedMaterial: MaterialItem = {
      ...material,
      vendorQuotes: updatedQuotes,
      retailPrice: vendor.currentPrice,
      supplierId: vendor.vendorId,
      supplierName: vendor.vendorName,
      leadTimeDays: vendor.leadTimeDays,
      lastUpdated: new Date().toISOString().split('T')[0]
    };

    onUpdateMaterial(updatedMaterial);
    if (onUpdateMaterialPrice) {
      onUpdateMaterialPrice(
        material.id,
        vendor.currentPrice,
        `Switched primary vendor to ${vendor.vendorName}`
      );
    }
  };

  // Add a new vendor column to the matrix:
  // "when add vendor columns we could add price ranges, retail prices, bulk prices with discounts. and we could create new vendor and it ust be in the vendor list and profiles"
  const handleAddVendorColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendorForm.vendorName.trim()) return;

    const today = new Date().toISOString().split('T')[0];
    let finalSupplierId = newVendorForm.supplierId;

    // If user selected "Create New Vendor Profile", onboard to global suppliers list and database
    if (addVendorMode === 'create_new' || !finalSupplierId) {
      const newSupData: Partial<Supplier> = {
        name: newVendorForm.vendorName.trim(),
        country: newVendorForm.country || 'United States',
        city: newVendorForm.city || 'Chicago',
        contactPerson: newVendorForm.contactPerson || 'Account Representative',
        email: newVendorForm.contactEmail || `sales@${newVendorForm.vendorName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
        phone: newVendorForm.contactPhone || '+1 800 555 0100',
        paymentTerms: newVendorForm.paymentTerms || 'Net 30',
        supplyScope: 'materials',
        category: 'Materials',
        rating: 5.0,
        status: 'Active',
        notes: newVendorForm.profileNotes
      };

      try {
        const createdSup = await api.createSupplier(newSupData);
        finalSupplierId = createdSup.id;
        if (onAddSupplier) {
          onAddSupplier(createdSup);
        }
      } catch (err) {
        console.error('Failed to create supplier:', err);
        finalSupplierId = `sup-${Date.now()}`;
        if (onAddSupplier) {
          onAddSupplier({ ...newSupData, id: finalSupplierId });
        }
      }
    }

    const startingPrice = Number(newVendorForm.startingPrice);

    const initialHistoryRecord: VendorPriceChangeRecord = {
      id: `hist-new-${Date.now()}`,
      date: today,
      price: startingPrice,
      reason: newVendorForm.quoteReason.trim() || 'Initial quote onboarded to multi-vendor comparison matrix',
      quoteRef: newVendorForm.quoteRef.trim() || `QT-${material.code}-INIT`,
      moq: Number(newVendorForm.moq),
      leadTimeDays: Number(newVendorForm.leadTimeDays),
      updatedBy: 'Sourcing Officer',
      appliedChangesSummary: [
        `Initial Quoted Retail Price established at $${startingPrice.toFixed(2)}`,
        `${newVendorForm.volumeTiers.length} Bulk Price Ranges with discounts configured`
      ],
      changedTiers: newVendorForm.volumeTiers
    };

    const newQuote: MaterialVendorQuote = {
      vendorId: finalSupplierId,
      vendorName: newVendorForm.vendorName.trim(),
      country: newVendorForm.country,
      currentPrice: startingPrice,
      currency: 'USD',
      leadTimeDays: Number(newVendorForm.leadTimeDays),
      moq: Number(newVendorForm.moq),
      isPreferred: newVendorForm.isPreferred,
      status: newVendorForm.isPreferred ? 'Preferred' : 'Active',
      lastUpdated: today,
      notes: newVendorForm.profileNotes,
      volumePricing: newVendorForm.volumeTiers,
      priceHistory: [initialHistoryRecord]
    };

    const updatedQuotes = newVendorForm.isPreferred
      ? [
          newQuote,
          ...vendorQuotes.map((vq) => ({
            ...vq,
            isPreferred: false,
            status: 'Active' as const
          }))
        ]
      : [...vendorQuotes, newQuote];

    setVendorQuotes(updatedQuotes);

    const updatedMaterial: MaterialItem = {
      ...material,
      vendorQuotes: updatedQuotes,
      retailPrice: newVendorForm.isPreferred ? startingPrice : material.retailPrice,
      supplierId: newVendorForm.isPreferred ? finalSupplierId : material.supplierId,
      supplierName: newVendorForm.isPreferred ? newVendorForm.vendorName : material.supplierName,
      lastUpdated: today
    };

    onUpdateMaterial(updatedMaterial);

    // Persist new vendor quote directly to PostgreSQL database
    api.createMaterialVendorQuote(material.id, {
      vendorId: finalSupplierId,
      vendorName: newVendorForm.vendorName.trim(),
      country: newVendorForm.country,
      currentPrice: startingPrice,
      currency: 'USD',
      leadTimeDays: Number(newVendorForm.leadTimeDays),
      moq: Number(newVendorForm.moq),
      isPreferred: newVendorForm.isPreferred,
      status: newVendorForm.isPreferred ? 'Preferred' : 'Active',
      quoteReason: newVendorForm.quoteReason.trim(),
      quoteRef: newVendorForm.quoteRef.trim(),
      volumePricing: newVendorForm.volumeTiers
    }).catch((err) => console.warn('[PriceMatrix] API createMaterialVendorQuote warning:', err?.message));

    setIsAddVendorModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 w-full h-full bg-white flex flex-col overflow-hidden select-none">
      {/* 1. PRECISE TOP BAR */}
      <header className="h-11 px-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center space-x-1 px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded text-xs transition-colors cursor-pointer"
            title="Close Matrix View"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="font-medium">Close</span>
          </button>

          <div className="h-4 w-px bg-slate-200" />

          {/* Item Identification */}
          <span className="font-mono text-xs font-semibold text-[#003049] bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0">
            {material.code}
          </span>

          <span className="text-xs font-medium text-slate-800 truncate max-w-xs md:max-w-md" title={material.name}>
            {material.name}
          </span>

          <span className="text-[11px] text-slate-400 shrink-0">
            ({material.unit || 'unit'})
          </span>

          {/* Market Summary Badges */}
          <div className="hidden lg:flex items-center space-x-2 text-[11px] pl-2 border-l border-slate-200">
            <span className="text-slate-600">
              Active: <strong className="text-slate-900 font-medium">${metrics.preferredPrice.toFixed(2)}</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-medium">
              Lowest: ${metrics.lowestPrice.toFixed(2)} ({metrics.lowestVendor.split(' ')[0]})
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">
              Spread: ${metrics.spread.toFixed(2)} ({metrics.spreadPct.toFixed(1)}%)
            </span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-2 shrink-0">
          <div className="relative">
            <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
            <input
              type="text"
              placeholder="Filter revision dates..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-6 pr-2 py-1 text-xs border border-slate-200 rounded bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#003049] focus:bg-white w-36 sm:w-44 transition-all"
            />
            {searchFilter && (
              <button
                type="button"
                onClick={() => setSearchFilter('')}
                className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-600 text-xs"
              >
                ×
              </button>
            )}
          </div>

          {/* VIEW CHANGES FOR ALL ROWS AND FIELDS */}
          <button
            type="button"
            onClick={() => setActiveAuditModal({ date: 'all', targetVendorId: null })}
            className="flex items-center space-x-1.5 px-2.5 py-1 bg-blue-50 hover:bg-[#003049] text-[#003049] hover:text-white border border-blue-200 rounded text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            title="View all changes and reasons across all rows and fields"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View Changes (All Rows)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddVendorModalOpen(true)}
            className="flex items-center space-x-1 px-2.5 py-1 bg-[#003049] hover:bg-[#002235] text-white rounded text-xs font-medium transition-colors cursor-pointer"
            title="Add a new vendor quote column to this material"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Vendor Column</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. HISTORICAL PRICE REVISIONS MATRIX WITH FINE UI DESIGN
          - Bulky card carousel removed per user instruction ("remove this marked area, use fine UI design for that")
          - Vendor profiles, current rates, ranges, and quick actions integrated into the matrix column headers
          - Strictly one line per row with minimum detail
          - "View Changes" button for all rows, per row, and per field
          - Smooth vertical scrolling to view all rows
      */}
      <div className="flex-1 overflow-auto bg-white min-h-[380px] max-h-[calc(100vh-210px)] border-b border-slate-200">
        <table className="w-full text-left border-collapse min-w-[860px]">
          {/* VENDOR COLUMN HEADERS WITH INTEGRATED FINE UI PROFILE & CONTROLS */}
          <thead className="bg-[#f8fafc] sticky top-0 z-20 border-b border-slate-300 shadow-2xs">
            <tr>
              {/* Fixed Left Column: Revision Timeline Date & Row "View Changes" */}
              <th className="py-2.5 px-3 border-r border-slate-200 w-60 min-w-[230px] max-w-[250px] bg-[#eef3f7] sticky left-0 z-30 align-bottom">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-[#003049] uppercase tracking-wider">
                      Revision Date
                    </div>
                    <div className="text-[10px] text-slate-500 font-normal">
                      Full Audit Events
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-[10px] text-slate-600 font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {timelineRecords.length} Rows
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveAuditModal({ date: 'all', targetVendorId: null })}
                      className="text-[10px] text-[#0077b6] hover:underline font-semibold cursor-pointer"
                      title="View all revision changes and reasons"
                    >
                      Audit
                    </button>
                  </div>
                </div>
              </th>

              {/* VENDOR COLUMNS WITH COMPACT FINE UI CONTROLS */}
              {vendorQuotes.map((vendor) => {
                const isPrimary = vendor.isPreferred;
                const isLowest = vendor.currentPrice === metrics.lowestPrice;
                const tiersCount = (vendor.volumePricing || []).length;
                const isMenuOpen = openVendorMenuId === vendor.vendorId;

                return (
                  <th
                    key={vendor.vendorId}
                    className={`py-2 px-3 border-r border-slate-200 min-w-[230px] align-top transition-colors ${
                      isPrimary ? 'bg-[#f0f7fa]' : 'bg-[#f8fafc]'
                    }`}
                  >
                    <div>
                      {/* Vendor Name & Badges */}
                      <div className="flex items-start justify-between gap-1">
                        <div className="truncate pr-1">
                          <span
                            className="text-xs font-bold text-slate-900 truncate block hover:text-[#003049]"
                            title={vendor.vendorName}
                          >
                            {vendor.vendorName}
                          </span>
                          <span className="text-[10px] text-slate-500 block truncate">
                            {vendor.country === 'United States' ? 'USA' : vendor.country || 'Global'} • {vendor.leadTimeDays}d SLA • MOQ {vendor.moq || 1}
                          </span>
                        </div>

                        <div className="shrink-0 flex items-center space-x-1">
                          {isPrimary && (
                            <span className="text-[9px] uppercase font-bold bg-[#003049] text-white px-1.5 py-0.5 rounded">
                              Primary
                            </span>
                          )}
                          {isLowest && !isPrimary && (
                            <span className="text-[9px] uppercase font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded">
                              Lowest
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Crisp Fine Line Divider */}
                      <div className="border-t border-slate-200/80 my-1.5" />

                      {/* Current Quoted Price & Action Buttons with Menu Button */}
                      <div className="flex items-center justify-between gap-1 relative">
                        <div className="text-xs font-bold font-mono text-[#003049] whitespace-nowrap">
                          ${vendor.currentPrice.toFixed(2)}{' '}
                          <span className="text-[10px] font-normal text-slate-400">/ {material.unit}</span>
                        </div>

                        {/* Fine UI Button Group with Lines & Menu Button for All Commands */}
                        <div className="inline-flex items-center rounded border border-slate-200 bg-white shadow-2xs divide-x divide-slate-200 shrink-0">
                          {/* 1. View Button */}
                          <button
                            type="button"
                            id={`btn-view-vendor-ranges-${vendor.vendorId}`}
                            onClick={() => setViewingVendorBulkPrices(vendor)}
                            className="px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:text-sky-800 hover:bg-sky-50 transition-colors flex items-center space-x-1 cursor-pointer"
                            title={`View all latest bulk price ranges and quantity breaks for ${vendor.vendorName}`}
                          >
                            <Eye className="w-3 h-3 text-sky-600" />
                            <span>View</span>
                          </button>

                          {/* 2. + Change Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenCommitPrice(vendor)}
                            className="px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors flex items-center space-x-0.5 cursor-pointer"
                            title={`Commit price, range, or discount changes for ${vendor.vendorName}`}
                          >
                            <span>+ Change</span>
                          </button>

                          {/* 3. Quick Edit Supplier Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditVendor(vendor)}
                            className="px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:text-blue-800 hover:bg-blue-50 transition-colors flex items-center cursor-pointer"
                            title={`Edit supplier profile & terms for ${vendor.vendorName}`}
                          >
                            <Edit className="w-3 h-3 text-blue-600" />
                          </button>

                          {/* 4. Quick Delete Supplier Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteVendorClick(vendor)}
                            className="px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:text-rose-800 hover:bg-rose-50 transition-colors flex items-center cursor-pointer"
                            title={`Delete supplier ${vendor.vendorName} (Requires archive download if price history exists)`}
                          >
                            <Trash2 className="w-3 h-3 text-rose-500" />
                          </button>

                          {/* 5. Menu Button Containing All Commands */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenVendorMenuId(isMenuOpen ? null : vendor.vendorId)}
                              className={`px-1.5 py-0.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center ${
                                isMenuOpen ? 'bg-slate-100 text-slate-900' : ''
                              }`}
                              title={`All commands for ${vendor.vendorName}`}
                              aria-label="Vendor commands menu"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {/* Dropdown Menu of All Commands */}
                            {isMenuOpen && (
                              <>
                                <div
                                  className="fixed inset-0 z-30"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenVendorMenuId(null);
                                  }}
                                />
                                <div className="absolute right-0 top-full mt-1.5 z-40 w-56 bg-white rounded-lg shadow-xl border border-slate-200 py-1 text-left text-xs divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
                                  <div className="px-3 py-1.5 bg-slate-50 flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                      Vendor Commands
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-mono truncate max-w-[90px]">
                                      {vendor.vendorName.split(' ')[0]}
                                    </span>
                                  </div>

                                  <div className="py-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenVendorMenuId(null);
                                        setViewingVendorBulkPrices(vendor);
                                      }}
                                      className="w-full px-3 py-1.5 flex items-start space-x-2 hover:bg-sky-50 text-slate-800 transition-colors cursor-pointer text-left"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                                      <div>
                                        <div className="font-semibold text-slate-900">View Ranges & Bulk Prices</div>
                                        <div className="text-[10px] text-slate-500">View {tiersCount} tiers & order simulator</div>
                                      </div>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenVendorMenuId(null);
                                        handleOpenCommitPrice(vendor);
                                      }}
                                      className="w-full px-3 py-1.5 flex items-start space-x-2 hover:bg-slate-50 text-slate-800 transition-colors cursor-pointer text-left"
                                    >
                                      <DollarSign className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                      <div>
                                        <div className="font-semibold text-slate-900">Commit Price Revision</div>
                                        <div className="text-[10px] text-slate-500">Revise base rate, MOQ or bulk tiers</div>
                                      </div>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenVendorMenuId(null);
                                        handleOpenRangeConfig(vendor);
                                      }}
                                      className="w-full px-3 py-1.5 flex items-start space-x-2 hover:bg-slate-50 text-slate-800 transition-colors cursor-pointer text-left"
                                    >
                                      <Sliders className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                                      <div>
                                        <div className="font-semibold text-slate-900">Configure Ranges ({tiersCount})</div>
                                        <div className="text-[10px] text-slate-500">Edit quantity brackets & discount %</div>
                                      </div>
                                    </button>
                                  </div>

                                  <div className="py-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenVendorMenuId(null);
                                        handleOpenEditVendor(vendor);
                                      }}
                                      className="w-full px-3 py-1.5 flex items-start space-x-2 hover:bg-blue-50 text-slate-800 transition-colors cursor-pointer text-left"
                                    >
                                      <Edit className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                                      <div>
                                        <div className="font-semibold text-slate-900">Edit Supplier Details</div>
                                        <div className="text-[10px] text-slate-500">Update company, SLA, MOQ & contact</div>
                                      </div>
                                    </button>

                                    {!isPrimary ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenVendorMenuId(null);
                                          handleSetPrimaryVendor(vendor);
                                        }}
                                        className="w-full px-3 py-1.5 flex items-start space-x-2 hover:bg-amber-50 text-slate-800 transition-colors cursor-pointer text-left"
                                      >
                                        <Star className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                        <div>
                                          <div className="font-semibold text-slate-900">Set as Primary Vendor</div>
                                          <div className="text-[10px] text-slate-500">Designate as default catalog source</div>
                                        </div>
                                      </button>
                                    ) : (
                                      <div className="px-3 py-1.5 flex items-center space-x-2 text-slate-400">
                                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />
                                        <span className="text-[11px] font-medium text-amber-700">Primary Catalog Vendor</span>
                                      </div>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenVendorMenuId(null);
                                        setActiveAuditModal({ date: 'all', targetVendorId: vendor.vendorId });
                                      }}
                                      className="w-full px-3 py-1.5 flex items-start space-x-2 hover:bg-slate-50 text-slate-800 transition-colors cursor-pointer text-left"
                                    >
                                      <History className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                                      <div>
                                        <div className="font-semibold text-slate-900">Revision History Log</div>
                                        <div className="text-[10px] text-slate-500">Inspect price audit diffs & dates</div>
                                      </div>
                                    </button>
                                  </div>

                                  <div className="py-1 border-t border-slate-100">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenVendorMenuId(null);
                                        handleDeleteVendorClick(vendor);
                                      }}
                                      className="w-full px-3 py-1.5 flex items-start space-x-2 hover:bg-rose-50 text-slate-800 transition-colors cursor-pointer text-left"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                                      <div>
                                        <div className="font-semibold text-rose-700">Delete Supplier</div>
                                        <div className="text-[10px] text-rose-500">
                                          {(vendor.priceHistory || []).length > 0
                                            ? 'Archive download required before delete'
                                            : 'Remove supplier column'}
                                        </div>
                                      </div>
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </th>
                );
              })}

              {/* Quick Add Vendor Column Header */}
              <th className="py-2 px-3 min-w-[130px] bg-slate-50 border-r border-slate-200 text-center align-middle">
                <button
                  type="button"
                  onClick={() => setIsAddVendorModalOpen(true)}
                  className="w-full py-2 px-2 bg-white hover:bg-slate-100 border border-dashed border-slate-300 hover:border-[#003049] text-slate-600 hover:text-[#003049] rounded text-[11px] font-medium transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                  title="Add another vendor column to compare prices, ranges & discounts"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Vendor</span>
                </button>
              </th>
            </tr>
          </thead>

          {/* ROWS - STRICTLY ONE LINE ROW WITH MINIMUM DETAIL */}
          <tbody className="divide-y divide-slate-200 text-xs">
            {vendorQuotes.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-12 text-center text-slate-500 bg-slate-50">
                  <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <div className="font-semibold text-slate-800 text-xs">No Qualified Vendors Linked Yet</div>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                    Click "+ Add Vendor" to link registered suppliers or onboard new vendors and track their price revisions.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsAddVendorModalOpen(true)}
                    className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#003049] text-white text-xs rounded font-medium hover:bg-[#002235] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Vendor Column</span>
                  </button>
                </td>
              </tr>
            ) : timelineRecords.length === 0 ? (
              <tr>
                <td colSpan={vendorQuotes.length + 2} className="py-8 text-center text-slate-400 text-xs">
                  No historical revision records found.
                </td>
              </tr>
            ) : (
              timelineRecords.map((timeline) => (
                <tr
                  key={timeline.date}
                  className="h-9 min-h-[36px] max-h-[36px] hover:bg-blue-50/40 transition-colors border-b border-slate-200 whitespace-nowrap"
                >
                  {/* Timeline Date Cell with prominent "[View Changes]" button for the entire row */}
                  <td
                    className="py-1 px-3 border-r border-slate-200 bg-white sticky left-0 z-10 whitespace-nowrap text-xs font-mono text-slate-700"
                  >
                    <div className="flex items-center justify-between space-x-2">
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-900">{timeline.date}</span>
                      </div>

                      {/* BUTTON: VIEW CHANGES FOR THIS ROW */}
                      <button
                        type="button"
                        onClick={() => setActiveAuditModal({ date: timeline.date, targetVendorId: null })}
                        className="px-2 py-0.5 text-[10px] bg-blue-50 hover:bg-[#003049] text-[#003049] hover:text-white rounded border border-blue-200 transition-colors font-semibold flex items-center space-x-1 cursor-pointer ml-auto shrink-0 shadow-2xs"
                        title={`View all field changes and reasons for ${timeline.date}`}
                      >
                        <Eye className="w-3 h-3" />
                        <span>View Changes</span>
                      </button>
                    </div>
                  </td>

                  {/* Vendor Cells - Minimum detail on one line (most important price change only) */}
                  {vendorQuotes.map((vendor) => {
                    const exactRecord = (vendor.priceHistory || []).find((h) => h.date === timeline.date);

                    if (!exactRecord) {
                      // NO CHANGE FOR THIS VENDOR ON THIS DATE: render clean dash "—"
                      return (
                        <td
                          key={vendor.vendorId}
                          className="py-1 px-3 border-r border-slate-200 whitespace-nowrap text-slate-300 text-center text-xs bg-white"
                          title="No price revision for this vendor on this date"
                        >
                          —
                        </td>
                      );
                    }

                    // There WAS a change for this vendor on this date!
                    const price = exactRecord.price;
                    const changePct = exactRecord.changePct;
                    const hasRangeOrDiscChange =
                      (exactRecord.tierChanges && exactRecord.tierChanges.length > 0) ||
                      (exactRecord.changedTiers && exactRecord.changedTiers.length > 0);

                    return (
                      <td
                        key={vendor.vendorId}
                        onClick={() => setActiveAuditModal({ date: timeline.date, targetVendorId: vendor.vendorId })}
                        className="py-1 px-3 border-r border-slate-200 whitespace-nowrap text-xs bg-amber-50/30 hover:bg-amber-100/50 transition-colors cursor-pointer group"
                        title={`Click to view all changes and reasons for ${vendor.vendorName} on ${exactRecord.date}`}
                      >
                        <div className="flex items-center justify-between">
                          {/* Minimum Detail: Most Important Price Change Only */}
                          <div className="flex items-center space-x-1.5 truncate">
                            <span className="text-slate-900 font-bold font-mono">
                              ${price.toFixed(2)}
                            </span>

                            {/* Minimal tag if range size or discount rate changed */}
                            {hasRangeOrDiscChange && (
                              <span
                                className="text-[9px] px-1 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium shrink-0"
                                title="Bulk ranges or discounts also modified on this date"
                              >
                                Range
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-1 shrink-0 ml-1.5">
                            {changePct !== undefined && changePct !== 0 ? (
                              <span
                                className={`text-[10px] font-semibold px-1 rounded ${
                                  changePct > 0
                                    ? 'text-rose-700 bg-rose-50 border border-rose-200'
                                    : 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                                }`}
                              >
                                {changePct > 0 ? `+${changePct}%` : `${changePct}%`}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-normal">
                                New
                              </span>
                            )}

                            {/* Hover Eye Icon for explicit field audit */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveAuditModal({ date: timeline.date, targetVendorId: vendor.vendorId });
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-[#003049] rounded transition-opacity"
                              title="View changes for this field"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </td>
                    );
                  })}

                  <td className="py-1 px-3 bg-slate-50/20" />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 4. SLIM FOOTER STATUS BAR */}
      <footer className="h-8 px-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
        <div className="flex items-center space-x-2">
          <span>{material.code}</span>
          <span>•</span>
          <span>{vendorQuotes.length} Qualified Vendors</span>
          <span>•</span>
          <span>{timelineRecords.length} Revision Events Logged</span>
        </div>
        <div className="text-slate-400">
          Scroll down to browse all historical price events • Click "View Changes" on any row or field to inspect full reasons and audit diffs.
        </div>
      </footer>

      {/* 5. MODAL: COMMIT PRICE CHANGE FOR A SPECIFIC VENDOR */}
      {/* Supports changing base price, bulk price ranges, range sizes, and discount rates */}
      {selectedVendorForCommit && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-3">
          <div className="bg-white border border-slate-300 rounded max-w-xl w-full p-4 shadow-2xl space-y-3 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center space-x-1.5 text-xs">
                <span className="font-semibold text-slate-900">Edit Price</span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-600 truncate max-w-xs">{selectedVendorForCommit.vendorName}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVendorForCommit(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitPriceCommit} className="space-y-3 text-xs">
              {/* SECTION A: BASE QUOTED PRICE */}
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commitForm.changeBasePrice}
                      onChange={(e) => setCommitForm({ ...commitForm, changeBasePrice: e.target.checked })}
                      className="rounded border-slate-300 text-[#003049] focus:ring-0"
                    />
                    <span className="font-semibold text-slate-800 text-xs">
                      Change Base Quoted Price
                    </span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Current: ${selectedVendorForCommit.currentPrice.toFixed(2)} / {material.unit}
                  </span>
                </div>

                {commitForm.changeBasePrice && (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                    <div>
                      <label className="block text-[10px] uppercase font-semibold text-[#003049] mb-0.5">
                        New Base Price ($) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required={commitForm.changeBasePrice}
                        value={commitForm.newBasePrice}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setCommitForm({ ...commitForm, newBasePrice: val });
                        }}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-bold focus:outline-none focus:border-[#003049]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-slate-500 mb-0.5">
                        Price Delta
                      </label>
                      <div className="py-1 text-xs">
                        {commitForm.newBasePrice > selectedVendorForCommit.currentPrice ? (
                          <span className="text-rose-600 font-semibold">
                            +${(commitForm.newBasePrice - selectedVendorForCommit.currentPrice).toFixed(2)} (+
                            {(
                              ((commitForm.newBasePrice - selectedVendorForCommit.currentPrice) /
                                selectedVendorForCommit.currentPrice) *
                              100
                            ).toFixed(1)}
                            %)
                          </span>
                        ) : commitForm.newBasePrice < selectedVendorForCommit.currentPrice ? (
                          <span className="text-emerald-600 font-semibold">
                            -${(selectedVendorForCommit.currentPrice - commitForm.newBasePrice).toFixed(2)} (
                            {(
                              ((commitForm.newBasePrice - selectedVendorForCommit.currentPrice) /
                                selectedVendorForCommit.currentPrice) *
                              100
                            ).toFixed(1)}
                            %)
                          </span>
                        ) : (
                          <span className="text-slate-400">No change</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION B: MULTIPLE RANGES / BULKS WITH RANGE SIZES & DISCOUNT RATES */}
              {/* "when commit changes there could change discount rates , range sizes. that also must recoreded" */}
              <div className="border border-slate-200 rounded p-2.5 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-800 text-xs">
                      Bulk Price Ranges, Range Sizes & Discount Rates
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Select ranges to commit. Edit range sizes, discount rates, or unit prices directly.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const lastTier = commitForm.selectedRanges[commitForm.selectedRanges.length - 1];
                      const nextMin = lastTier ? (lastTier.maxQty ? lastTier.maxQty + 1 : lastTier.minQty + 50) : 10;
                      const base = commitForm.changeBasePrice ? commitForm.newBasePrice : selectedVendorForCommit.currentPrice;
                      const newTierObj = {
                        rangeIndex: commitForm.selectedRanges.length,
                        label: `${nextMin}–${nextMin + 100} ${material.unit}s (-10%)`,
                        minQty: nextMin,
                        currentMinQty: nextMin,
                        maxQty: nextMin + 100,
                        currentMaxQty: nextMin + 100,
                        currentPrice: Number((base * 0.9).toFixed(2)),
                        newPrice: Number((base * 0.9).toFixed(2)),
                        currentDiscountPct: 10.0,
                        discountPct: 10.0,
                        selected: true
                      };
                      setCommitForm({
                        ...commitForm,
                        selectedRanges: [...commitForm.selectedRanges, newTierObj]
                      });
                    }}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium border border-slate-300 flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-[#003049]" />
                    <span>+ Add Range</span>
                  </button>
                </div>

                {commitForm.selectedRanges.length > 0 ? (
                  <div className="space-y-2 divide-y divide-slate-100">
                    {commitForm.selectedRanges.map((range, rIdx) => {
                      const base = commitForm.changeBasePrice ? commitForm.newBasePrice : selectedVendorForCommit.currentPrice;

                      return (
                        <div key={rIdx} className="pt-2 first:pt-0 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={range.selected}
                                onChange={(e) => {
                                  const updated = [...commitForm.selectedRanges];
                                  updated[rIdx].selected = e.target.checked;
                                  setCommitForm({ ...commitForm, selectedRanges: updated });
                                }}
                                className="rounded border-slate-300 text-[#003049] focus:ring-0"
                              />
                              <span className="font-semibold text-slate-900 text-xs">
                                Tier {rIdx + 1}: {range.label || `${range.minQty} - ${range.maxQty || '+'}`}
                              </span>
                            </label>

                            <div className="flex items-center space-x-2">
                              <span className="text-[10px] text-slate-500">
                                Current: ${range.currentPrice.toFixed(2)} (-{range.currentDiscountPct}%)
                              </span>

                              <button
                                type="button"
                                onClick={() => {
                                  setCommitForm({
                                    ...commitForm,
                                    selectedRanges: commitForm.selectedRanges.filter((_, i) => i !== rIdx)
                                  });
                                }}
                                className="text-slate-400 hover:text-rose-600 p-0.5"
                                title="Remove range tier"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {range.selected && (
                            <div className="bg-slate-50/80 p-2 rounded border border-slate-200 space-y-1.5">
                              {/* Range Sizes: Min Qty and Max Qty */}
                              <div className="grid grid-cols-4 gap-2">
                                <div>
                                  <label className="block text-[10px] uppercase font-semibold text-slate-600 mb-0.5">
                                    Min Qty (Size)
                                  </label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={range.minQty}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value) || 1;
                                      const updated = [...commitForm.selectedRanges];
                                      updated[rIdx].minQty = val;
                                      updated[rIdx].label = `${val}–${range.maxQty || '+'} ${material.unit}s (-${range.discountPct}%)`;
                                      setCommitForm({ ...commitForm, selectedRanges: updated });
                                    }}
                                    className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-900 font-mono"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] uppercase font-semibold text-slate-600 mb-0.5">
                                    Max Qty (Opt)
                                  </label>
                                  <input
                                    type="number"
                                    min="1"
                                    placeholder="No limit"
                                    value={range.maxQty || ''}
                                    onChange={(e) => {
                                      const val = e.target.value ? parseInt(e.target.value) : undefined;
                                      const updated = [...commitForm.selectedRanges];
                                      updated[rIdx].maxQty = val;
                                      updated[rIdx].label = `${range.minQty}–${val || '+'} ${material.unit}s (-${range.discountPct}%)`;
                                      setCommitForm({ ...commitForm, selectedRanges: updated });
                                    }}
                                    className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-900 font-mono"
                                  />
                                </div>

                                {/* Discount Rate (%) */}
                                <div>
                                  <label className="block text-[10px] uppercase font-semibold text-slate-600 mb-0.5">
                                    Discount Rate (%)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    value={range.discountPct}
                                    onChange={(e) => {
                                      const d = parseFloat(e.target.value) || 0;
                                      const updated = [...commitForm.selectedRanges];
                                      updated[rIdx].discountPct = d;
                                      if (base > 0) {
                                        updated[rIdx].newPrice = Number((base * (1 - d / 100)).toFixed(2));
                                      }
                                      setCommitForm({ ...commitForm, selectedRanges: updated });
                                    }}
                                    className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-emerald-700 font-semibold"
                                  />
                                </div>

                                {/* Bulk Unit Price ($) */}
                                <div>
                                  <label className="block text-[10px] uppercase font-semibold text-slate-600 mb-0.5">
                                    Unit Price ($)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={range.newPrice}
                                    onChange={(e) => {
                                      const p = parseFloat(e.target.value) || 0;
                                      const updated = [...commitForm.selectedRanges];
                                      updated[rIdx].newPrice = p;
                                      if (base > 0) {
                                        updated[rIdx].discountPct = Number((((base - p) / base) * 100).toFixed(1));
                                      }
                                      setCommitForm({ ...commitForm, selectedRanges: updated });
                                    }}
                                    className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-900 font-bold"
                                  />
                                </div>
                              </div>

                              {/* Tier change comparison tags */}
                              <div className="flex items-center space-x-2 text-[10px] pt-0.5 text-slate-500">
                                <span>Tier Label: <strong className="text-slate-700">{range.label}</strong></span>
                                {(range.minQty !== range.currentMinQty || range.maxQty !== range.currentMaxQty) && (
                                  <span className="text-blue-700 bg-blue-50 px-1 rounded font-medium border border-blue-200">
                                    Range size changed
                                  </span>
                                )}
                                {range.discountPct !== range.currentDiscountPct && (
                                  <span className="text-emerald-700 bg-emerald-50 px-1 rounded font-medium border border-emerald-200">
                                    Discount: was {range.currentDiscountPct}%
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic text-center py-2">
                    No bulk ranges configured. Click "+ Add Range" above to create tiers.
                  </div>
                )}
              </div>

              {/* SECTION C: REVISION METADATA */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-700 mb-1 font-normal">Effective Date *</label>
                  <input
                    type="date"
                    required
                    value={commitForm.effectiveDate}
                    onChange={(e) => setCommitForm({ ...commitForm, effectiveDate: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 focus:outline-none focus:border-[#003049]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1 font-normal">Quote Ref #</label>
                  <input
                    type="text"
                    required
                    value={commitForm.quoteRef}
                    onChange={(e) => setCommitForm({ ...commitForm, quoteRef: e.target.value })}
                    placeholder="e.g. QT-2026-904"
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 focus:outline-none focus:border-[#003049]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-normal">
                  Price Change Driver / Reason *
                </label>
                <input
                  type="text"
                  required
                  value={commitForm.reason}
                  onChange={(e) => setCommitForm({ ...commitForm, reason: e.target.value })}
                  placeholder="e.g. Bulk tier revision, raw ingot inflation or negotiated volume agreement"
                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 focus:outline-none focus:border-[#003049]"
                />
              </div>

              {/* Set as Primary Vendor & Catalog Price */}
              <div className="bg-blue-50/60 border border-blue-200 rounded p-2 flex items-start space-x-2">
                <input
                  type="checkbox"
                  id="setAsPrimary"
                  checked={commitForm.setAsPrimary}
                  onChange={(e) => setCommitForm({ ...commitForm, setAsPrimary: e.target.checked })}
                  className="mt-0.5 rounded border-slate-300 text-[#003049] focus:ring-0 cursor-pointer"
                />
                <label htmlFor="setAsPrimary" className="text-[11px] text-slate-800 cursor-pointer">
                  <strong>Set as Primary Supplier:</strong> Update this material's active catalog price to{' '}
                  <span className="font-semibold text-[#003049]">
                    ${commitForm.changeBasePrice ? commitForm.newBasePrice.toFixed(2) : selectedVendorForCommit.currentPrice.toFixed(2)}
                  </span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedVendorForCommit(null)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-300 font-normal cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#003049] hover:bg-[#002235] text-white rounded font-medium transition-colors cursor-pointer"
                >
                  Commit Price Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: CONFIGURE / ADD MULTIPLE BULK RANGES FOR A VENDOR */}
      {vendorForRangeConfig && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-3">
          <div className="bg-white border border-slate-300 rounded max-w-lg w-full p-4 shadow-2xl space-y-3 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center space-x-1.5 text-xs">
                <span className="font-semibold text-slate-900">Price Ranges</span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-600 truncate max-w-xs">{vendorForRangeConfig.vendorName}</span>
              </div>
              <button
                type="button"
                onClick={() => setVendorForRangeConfig(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-2">
                {rangesConfigList.map((tier, idx) => (
                  <div key={idx} className="bg-slate-50 p-2.5 rounded border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 text-xs">
                        Tier {idx + 1}: {tier.label || `Qty ${tier.minQty}+`}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setRangesConfigList(rangesConfigList.filter((_, i) => i !== idx));
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title="Remove tier"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Min Qty</label>
                        <input
                          type="number"
                          min="1"
                          value={tier.minQty}
                          onChange={(e) => {
                            const updated = [...rangesConfigList];
                            updated[idx].minQty = parseInt(e.target.value) || 1;
                            setRangesConfigList(updated);
                          }}
                          className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Max Qty (Opt)</label>
                        <input
                          type="number"
                          min="1"
                          placeholder="No max"
                          value={tier.maxQty || ''}
                          onChange={(e) => {
                            const updated = [...rangesConfigList];
                            updated[idx].maxQty = e.target.value ? parseInt(e.target.value) : undefined;
                            setRangesConfigList(updated);
                          }}
                          className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Unit Price ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={tier.unitPrice}
                          onChange={(e) => {
                            const p = parseFloat(e.target.value) || 0;
                            const updated = [...rangesConfigList];
                            updated[idx].unitPrice = p;
                            const base = vendorForRangeConfig.currentPrice;
                            if (base > 0) {
                              updated[idx].discountPct = Number((((base - p) / base) * 100).toFixed(1));
                            }
                            setRangesConfigList(updated);
                          }}
                          className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-900 font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Discount (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={tier.discountPct}
                          onChange={(e) => {
                            const d = parseFloat(e.target.value) || 0;
                            const updated = [...rangesConfigList];
                            updated[idx].discountPct = d;
                            const base = vendorForRangeConfig.currentPrice;
                            updated[idx].unitPrice = Number((base * (1 - d / 100)).toFixed(2));
                            setRangesConfigList(updated);
                          }}
                          className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-900 font-semibold text-emerald-700"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Tier Label</label>
                      <input
                        type="text"
                        value={tier.label}
                        onChange={(e) => {
                          const updated = [...rangesConfigList];
                          updated[idx].label = e.target.value;
                          setRangesConfigList(updated);
                        }}
                        placeholder="e.g. Fabrication Volume Lot (50-200)"
                        className="w-full bg-white border border-slate-300 rounded px-2 py-0.5 text-slate-900"
                      />
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    const lastTier = rangesConfigList[rangesConfigList.length - 1];
                    const nextMin = lastTier ? (lastTier.maxQty ? lastTier.maxQty + 1 : lastTier.minQty + 50) : 10;
                    const base = vendorForRangeConfig.currentPrice;
                    const newTier: VolumePriceTier = {
                      minQty: nextMin,
                      maxQty: nextMin + 100,
                      unitPrice: Number((base * 0.9).toFixed(2)),
                      discountPct: 10.0,
                      label: `${nextMin}–${nextMin + 100} ${material.unit}s (-10%)`
                    };
                    setRangesConfigList([...rangesConfigList, newTier]);
                  }}
                  className="w-full py-2 border border-dashed border-slate-300 hover:border-[#003049] text-slate-600 hover:text-[#003049] rounded font-medium flex items-center justify-center space-x-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add New Quantity Range</span>
                </button>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setVendorForRangeConfig(null)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-300 font-normal cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveRangesConfig}
                  className="px-4 py-1.5 bg-[#003049] hover:bg-[#002235] text-white rounded font-medium transition-colors cursor-pointer"
                >
                  Save Ranges
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: ADD NEW VENDOR COLUMN WITH PRICE RANGES, RETAIL PRICES, BULK PRICES & NEW VENDOR CREATION */}
      {/*
        USER DIRECTIVE:
        "when add vendor columns we could add price ranges, retail prices, bulk prices with discounts. and we could create new vendor and it ust be in the vendor list and profiles"
      */}
      {isAddVendorModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-3">
          <div className="bg-white border border-slate-300 rounded-lg max-w-xl w-full p-4 shadow-2xl space-y-3 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-semibold text-slate-900">Add Vendor</span>
              <button
                type="button"
                onClick={() => setIsAddVendorModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex border-b border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setAddVendorMode('select_existing')}
                className={`py-1.5 px-3 font-semibold border-b-2 transition-colors ${
                  addVendorMode === 'select_existing'
                    ? 'border-[#003049] text-[#003049]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Registered
              </button>

              <button
                type="button"
                onClick={() => setAddVendorMode('create_new')}
                className={`py-1.5 px-3 font-semibold border-b-2 transition-colors flex items-center space-x-1 ${
                  addVendorMode === 'create_new'
                    ? 'border-[#003049] text-[#003049]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
            </div>

            <form onSubmit={handleAddVendorColumn} className="space-y-3 text-xs">
              {/* MODE 1: SELECT REGISTERED SUPPLIER */}
              {addVendorMode === 'select_existing' ? (
                <div>
                  <label className="block text-slate-700 mb-1 font-semibold">Choose From Supplier Profiles</label>
                  <select
                    value={newVendorForm.supplierId}
                    onChange={(e) => {
                      const sup = suppliers.find((s) => s.id === e.target.value);
                      if (sup) {
                        setNewVendorForm({
                          ...newVendorForm,
                          supplierId: sup.id,
                          vendorName: sup.name,
                          country: sup.country || 'United States',
                          city: sup.city || 'Chicago'
                        });
                      } else {
                        setNewVendorForm({ ...newVendorForm, supplierId: '' });
                      }
                    }}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 focus:outline-none focus:border-[#003049]"
                  >
                    <option value="">-- Choose registered vendor --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.country || 'USA'}) • Rating: {s.rating || 5}★
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Or switch tabs above to create a brand new vendor profile and register it into the system.
                  </p>
                </div>
              ) : (
                /* MODE 2: CREATE NEW VENDOR PROFILE */
                <div className="bg-slate-50 p-2.5 rounded border border-slate-200 space-y-2">
                  <div className="text-[11px] font-bold text-[#003049] uppercase tracking-wider flex items-center space-x-1">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>New Vendor Profile Details (Saved to Vendor Registry)</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <label className="block text-[10px] uppercase font-semibold text-slate-700 mb-0.5">
                        Vendor Company Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={newVendorForm.vendorName}
                        onChange={(e) => setNewVendorForm({ ...newVendorForm, vendorName: e.target.value })}
                        placeholder="e.g. Kaiser Global Aluminum Alloys Ltd"
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-semibold text-slate-700 mb-0.5">
                        Contact Person
                      </label>
                      <input
                        type="text"
                        value={newVendorForm.contactPerson}
                        onChange={(e) => setNewVendorForm({ ...newVendorForm, contactPerson: e.target.value })}
                        placeholder="e.g. Sarah Jenkins"
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-semibold text-slate-700 mb-0.5">
                        Contact Email
                      </label>
                      <input
                        type="email"
                        value={newVendorForm.contactEmail}
                        onChange={(e) => setNewVendorForm({ ...newVendorForm, contactEmail: e.target.value })}
                        placeholder="sales@vendor.com"
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-semibold text-slate-700 mb-0.5">
                        Country / Region
                      </label>
                      <input
                        type="text"
                        value={newVendorForm.country}
                        onChange={(e) => setNewVendorForm({ ...newVendorForm, country: e.target.value })}
                        placeholder="e.g. United States"
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-semibold text-slate-700 mb-0.5">
                        Payment Terms
                      </label>
                      <select
                        value={newVendorForm.paymentTerms}
                        onChange={(e) => setNewVendorForm({ ...newVendorForm, paymentTerms: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900"
                      >
                        <option value="Net 30">Net 30 Days</option>
                        <option value="Net 60">Net 60 Days</option>
                        <option value="Immediate 2% 10">2% 10 Net 30</option>
                        <option value="Advance 50%">50% Advance / 50% Delivery</option>
                        <option value="Letter of Credit">Letter of Credit (LC)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* RETAIL / STARTING QUOTED PRICE & SLA */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-700 mb-0.5 font-semibold">
                    Retail / Base Price ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newVendorForm.startingPrice}
                    onChange={(e) => {
                      const p = parseFloat(e.target.value) || 0;
                      // Recalculate bulk tiers based on new starting price
                      const updatedTiers = newVendorForm.volumeTiers.map((t) => ({
                        ...t,
                        unitPrice: Number((p * (1 - t.discountPct / 100)).toFixed(2))
                      }));
                      setNewVendorForm({
                        ...newVendorForm,
                        startingPrice: p,
                        volumeTiers: updatedTiers
                      });
                    }}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-bold focus:outline-none focus:border-[#003049]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-0.5 font-semibold">Lead Time (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={newVendorForm.leadTimeDays}
                    onChange={(e) => setNewVendorForm({ ...newVendorForm, leadTimeDays: parseInt(e.target.value) || 1 })}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 focus:outline-none focus:border-[#003049]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-0.5 font-semibold">MOQ ({material.unit || 'units'})</label>
                  <input
                    type="number"
                    min="1"
                    value={newVendorForm.moq}
                    onChange={(e) => setNewVendorForm({ ...newVendorForm, moq: parseInt(e.target.value) || 1 })}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 focus:outline-none focus:border-[#003049]"
                  />
                </div>
              </div>

              {/* CONFIGURE PRICE RANGES, RETAIL PRICES & BULK PRICES WITH DISCOUNTS */}
              {/* "when add vendor columns we could add price ranges, retail prices, bulk prices with discounts" */}
              <div className="border border-slate-200 rounded p-2.5 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-800 text-xs">
                    Price Ranges & Bulk Prices with Discounts
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const lastTier = newVendorForm.volumeTiers[newVendorForm.volumeTiers.length - 1];
                      const nextMin = lastTier ? (lastTier.maxQty ? lastTier.maxQty + 1 : lastTier.minQty + 50) : 10;
                      const p = Number(newVendorForm.startingPrice);
                      const newTier: VolumePriceTier = {
                        minQty: nextMin,
                        maxQty: nextMin + 100,
                        discountPct: 12.0,
                        unitPrice: Number((p * 0.88).toFixed(2)),
                        label: `${nextMin}–${nextMin + 100} ${material.unit}s (-12%)`
                      };
                      setNewVendorForm({
                        ...newVendorForm,
                        volumeTiers: [...newVendorForm.volumeTiers, newTier]
                      });
                    }}
                    className="px-2 py-0.5 bg-white hover:bg-slate-100 text-[#003049] rounded border border-slate-300 text-[11px] font-medium flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Add Quantity Range</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  {newVendorForm.volumeTiers.map((tier, tIdx) => (
                    <div key={tIdx} className="bg-white p-2 rounded border border-slate-200 grid grid-cols-5 gap-2 items-center">
                      <div>
                        <label className="block text-[9px] uppercase font-semibold text-slate-500 mb-0.5">Min Qty</label>
                        <input
                          type="number"
                          min="1"
                          value={tier.minQty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            const updated = [...newVendorForm.volumeTiers];
                            updated[tIdx].minQty = val;
                            updated[tIdx].label = `${val}–${tier.maxQty || '+'} ${material.unit}s (-${tier.discountPct}%)`;
                            setNewVendorForm({ ...newVendorForm, volumeTiers: updated });
                          }}
                          className="w-full border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] uppercase font-semibold text-slate-500 mb-0.5">Max Qty</label>
                        <input
                          type="number"
                          min="1"
                          placeholder="No max"
                          value={tier.maxQty || ''}
                          onChange={(e) => {
                            const val = e.target.value ? parseInt(e.target.value) : undefined;
                            const updated = [...newVendorForm.volumeTiers];
                            updated[tIdx].maxQty = val;
                            updated[tIdx].label = `${tier.minQty}–${val || '+'} ${material.unit}s (-${tier.discountPct}%)`;
                            setNewVendorForm({ ...newVendorForm, volumeTiers: updated });
                          }}
                          className="w-full border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] uppercase font-semibold text-slate-500 mb-0.5">Discount (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={tier.discountPct}
                          onChange={(e) => {
                            const d = parseFloat(e.target.value) || 0;
                            const updated = [...newVendorForm.volumeTiers];
                            updated[tIdx].discountPct = d;
                            const p = Number(newVendorForm.startingPrice);
                            updated[tIdx].unitPrice = Number((p * (1 - d / 100)).toFixed(2));
                            setNewVendorForm({ ...newVendorForm, volumeTiers: updated });
                          }}
                          className="w-full border border-slate-200 rounded px-1.5 py-0.5 text-xs text-emerald-700 font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] uppercase font-semibold text-slate-500 mb-0.5">Bulk Price ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={tier.unitPrice}
                          onChange={(e) => {
                            const p = parseFloat(e.target.value) || 0;
                            const updated = [...newVendorForm.volumeTiers];
                            updated[tIdx].unitPrice = p;
                            const base = Number(newVendorForm.startingPrice);
                            if (base > 0) {
                              updated[tIdx].discountPct = Number((((base - p) / base) * 100).toFixed(1));
                            }
                            setNewVendorForm({ ...newVendorForm, volumeTiers: updated });
                          }}
                          className="w-full border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-900 font-bold"
                        />
                      </div>

                      <div className="flex items-center justify-end space-x-1 pt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setNewVendorForm({
                              ...newVendorForm,
                              volumeTiers: newVendorForm.volumeTiers.filter((_, i) => i !== tIdx)
                            });
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1"
                          title="Remove tier"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* QUOTE METADATA */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 mb-0.5 font-normal">Quote Ref #</label>
                  <input
                    type="text"
                    value={newVendorForm.quoteRef}
                    onChange={(e) => setNewVendorForm({ ...newVendorForm, quoteRef: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-0.5 font-normal">Onboarding Reason</label>
                  <input
                    type="text"
                    value={newVendorForm.quoteReason}
                    onChange={(e) => setNewVendorForm({ ...newVendorForm, quoteReason: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900"
                  />
                </div>
              </div>

              {/* Set as Primary Supplier */}
              <label className="flex items-center space-x-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={newVendorForm.isPreferred}
                  onChange={(e) => setNewVendorForm({ ...newVendorForm, isPreferred: e.target.checked })}
                  className="rounded border-slate-300 text-[#003049] focus:ring-0"
                />
                <span className="text-slate-800">
                  Set this vendor as the <strong>Primary Active Supplier</strong> for {material.code}
                </span>
              </label>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddVendorModalOpen(false)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-300 font-normal cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#003049] hover:bg-[#002235] text-white rounded font-medium transition-colors cursor-pointer"
                >
                  Add Vendor Column
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. DEDICATED "VIEW CHANGES" AUDIT MODAL FOR ALL ROWS AND FIELDS */}
      {/* "add button view changes for all rows and fields. include in that all changes and the reasons" */}
      {activeAuditModal && (
        <RevisionChangesAuditModal
          date={activeAuditModal.date}
          materialCode={material.code}
          materialName={material.name}
          materialUnit={material.unit}
          vendorQuotes={vendorQuotes}
          initialVendorId={activeAuditModal.targetVendorId}
          onClose={() => setActiveAuditModal(null)}
          onOpenCommitForVendor={(vendor) => {
            setActiveAuditModal(null);
            handleOpenCommitPrice(vendor);
          }}
        />
      )}

      {/* 9. VIEW ALL LATEST BULK PRICE RANGES MODAL */}
      {viewingVendorBulkPrices && (
        <VendorLatestRangesModal
          vendor={viewingVendorBulkPrices}
          material={material}
          onClose={() => setViewingVendorBulkPrices(null)}
          onConfigureRanges={(v) => {
            setViewingVendorBulkPrices(null);
            handleOpenRangeConfig(v);
          }}
          onCommitPriceChange={(v) => {
            setViewingVendorBulkPrices(null);
            handleOpenCommitPrice(v);
          }}
        />
      )}

      {/* 10. EDIT VENDOR DETAILS MODAL */}
      {editingVendor && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-3 animate-in fade-in">
          <div className="bg-white border border-slate-300 rounded-lg max-w-lg w-full p-4 shadow-2xl space-y-3 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Edit className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Edit Supplier / Vendor Details</h3>
                  <p className="text-[10px] text-slate-500">{editingVendor.vendorName} • {material.code}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingVendor(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVendorEdit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-700 mb-1">
                  Supplier / Vendor Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={editVendorForm.vendorName}
                  onChange={(e) => setEditVendorForm({ ...editVendorForm, vendorName: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 font-medium focus:outline-none focus:border-[#003049]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-700 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    value={editVendorForm.country}
                    onChange={(e) => setEditVendorForm({ ...editVendorForm, country: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-700 mb-1">
                    Status Badge
                  </label>
                  <select
                    value={editVendorForm.status}
                    onChange={(e) => setEditVendorForm({ ...editVendorForm, status: e.target.value as any })}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900"
                  >
                    <option value="Preferred">Preferred (Primary)</option>
                    <option value="Active">Active</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Best Price">Best Price</option>
                    <option value="Lead Exist">Lead Exist</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-700 mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={editVendorForm.contactEmail}
                    onChange={(e) => setEditVendorForm({ ...editVendorForm, contactEmail: e.target.value })}
                    placeholder="sales@supplier.com"
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-700 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={editVendorForm.contactPhone}
                    onChange={(e) => setEditVendorForm({ ...editVendorForm, contactPhone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-700 mb-1">
                    Lead Time SLA (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editVendorForm.leadTimeDays}
                    onChange={(e) => setEditVendorForm({ ...editVendorForm, leadTimeDays: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-700 mb-1">
                    Minimum Order Qty (MOQ)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editVendorForm.moq}
                    onChange={(e) => setEditVendorForm({ ...editVendorForm, moq: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-700 mb-1">
                  Notes & Mill Certification
                </label>
                <textarea
                  rows={2}
                  value={editVendorForm.notes}
                  onChange={(e) => setEditVendorForm({ ...editVendorForm, notes: e.target.value })}
                  placeholder="Contract terms, compliance certificates, warranty notes..."
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingVendor(null)}
                  className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#003049] hover:bg-[#002235] text-white rounded font-medium transition-colors cursor-pointer"
                >
                  Save Changes & Log Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 11. DELETE VENDOR MODAL (WITH COMPLIANCE ARCHIVE & DOWNLOAD REQUIREMENT) */}
      {vendorToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-3 animate-in fade-in">
          <div className="bg-white border border-slate-300 rounded-lg max-w-xl w-full p-4 shadow-2xl space-y-3 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">
                    Delete Supplier: {vendorToDelete.vendorName}
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Catalog Item: <span className="font-mono font-semibold">{material.code}</span> ({material.name})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setVendorToDelete(null);
                  setIsArchiveDownloaded(false);
                }}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(vendorToDelete.priceHistory && vendorToDelete.priceHistory.length > 0) ? (
              <div className="space-y-3">
                {/* Regulatory Compliance & Audit Notice */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start space-x-2.5">
                  <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 space-y-1">
                    <div className="font-bold">
                      Archive & Download Required Before Deletion ({vendorToDelete.priceHistory.length} Price Revisions)
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      This supplier contains <b>{vendorToDelete.priceHistory.length} historical price revision event(s)</b>.
                      In accordance with enterprise auditing standards, vendor price history cannot be deleted without first archiving and downloading the full audit record.
                    </p>
                  </div>
                </div>

                {/* Historical Revisions Preview Table */}
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-600 mb-1 flex items-center justify-between">
                    <span>Historical Price Changes to be Archived</span>
                    <span className="font-mono text-slate-500">{vendorToDelete.priceHistory.length} records</span>
                  </div>
                  <div className="border border-slate-200 rounded max-h-40 overflow-y-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 text-slate-600 font-medium">
                        <tr>
                          <th className="py-1 px-2">Date</th>
                          <th className="py-1 px-2">Prev Rate</th>
                          <th className="py-1 px-2">New Rate</th>
                          <th className="py-1 px-2">Change %</th>
                          <th className="py-1 px-2">Reason</th>
                          <th className="py-1 px-2">Approved By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[10px]">
                        {vendorToDelete.priceHistory.map((h, i) => (
                          <tr key={h.id || i} className="hover:bg-slate-50">
                            <td className="py-1 px-2 text-slate-800 whitespace-nowrap">{h.date}</td>
                            <td className="py-1 px-2 text-slate-500">${(h.previousPrice ?? 0).toFixed(2)}</td>
                            <td className="py-1 px-2 font-bold text-slate-900">${(h.price ?? 0).toFixed(2)}</td>
                            <td className="py-1 px-2 text-slate-700">{h.changePct ? `${h.changePct}%` : '0%'}</td>
                            <td className="py-1 px-2 text-slate-600 font-sans truncate max-w-[150px]" title={h.reason}>{h.reason || 'Benchmark rate'}</td>
                            <td className="py-1 px-2 text-slate-500 font-sans">{h.updatedBy || 'Estimator'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Archive Download Status */}
                <div className="p-2.5 rounded-lg border flex items-center justify-between transition-colors bg-slate-50 border-slate-200">
                  <div>
                    <div className="text-xs font-semibold text-slate-800">
                      {isArchiveDownloaded ? '✓ Archive Download Complete' : 'Step 1: Download Price History Archive'}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {isArchiveDownloaded
                        ? lastDownloadedFilename || 'CSV archive downloaded'
                        : 'Click below to download full CSV archive before deletion'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadPriceHistoryArchive}
                    className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center space-x-1.5 transition-colors cursor-pointer ${
                      isArchiveDownloaded
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-sky-700 hover:bg-sky-800 text-white shadow-xs'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isArchiveDownloaded ? 'Re-Download CSV' : 'Download Archive (CSV)'}</span>
                  </button>
                </div>

                {/* User Audit Confirmation Info */}
                <div className="p-2 bg-slate-100 rounded text-[10px] text-slate-600">
                  <b>Audit Log Notice:</b> This deletion will be logged under user <b>{(currentUser || getStoredCurrentUser())?.name || 'Administrator'}</b> ({(currentUser || getStoredCurrentUser())?.role || 'ADMIN'}) including timestamp, item SKU, and archive reference.
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setVendorToDelete(null);
                      setIsArchiveDownloaded(false);
                    }}
                    className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>

                  <div className="flex items-center space-x-2">
                    {!isArchiveDownloaded ? (
                      <button
                        type="button"
                        onClick={() => {
                          handleDownloadPriceHistoryArchive();
                          setTimeout(() => {
                            handleConfirmDeleteVendor();
                          }, 400);
                        }}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-medium transition-colors flex items-center space-x-1 cursor-pointer"
                        title="Downloads the archive file and immediately confirms deletion with audit log"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Archive & Delete</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleConfirmDeleteVendor}
                        className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Confirm Delete & Record in Audit Log</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* If no price history exists */
              <div className="space-y-3 text-xs">
                <p className="text-slate-700 leading-relaxed">
                  Are you sure you want to remove supplier <b>{vendorToDelete.vendorName}</b> from catalog item <b>{material.code}</b> ({material.name})?
                </p>
                <p className="text-[11px] text-slate-500">
                  No price change history has been logged for this supplier. The supplier column will be removed and an audit record created.
                </p>

                <div className="p-2 bg-slate-100 rounded text-[10px] text-slate-600">
                  <b>Audit Log Notice:</b> Action will be recorded by user <b>{(currentUser || getStoredCurrentUser())?.name || 'Administrator'}</b>.
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setVendorToDelete(null)}
                    className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteVendor}
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-medium transition-colors cursor-pointer"
                  >
                    Delete Supplier
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
