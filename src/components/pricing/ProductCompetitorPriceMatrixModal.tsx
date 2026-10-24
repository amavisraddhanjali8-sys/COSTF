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
  TrendingDown,
  TrendingUp,
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
  AlertTriangle,
  Scale,
  RefreshCw,
  ExternalLink,
  Package
} from 'lucide-react';
import {
  Competitor,
  ProductCompetitorQuote,
  ProductCompetitorPriceHistoryRecord,
  VolumePriceTier,
  TierChangeDetail,
  AppUser,
  AuditLogRecord
} from '../../types';
import { api } from '../../services/api';
import { downloadCSV } from '../../utils/csvExport';
import { getStoredCurrentUser, saveStoredAuditLogs, getStoredAuditLogs } from '../../data/userAndAuditData';

export const CURRENCY_OPTIONS = [
  { code: 'LKR', symbol: 'LKR', label: 'LKR - Sri Lanka Rupee' },
  { code: 'USD', symbol: '$', label: 'USD ($) - US Dollar' },
  { code: 'EUR', symbol: '€', label: 'EUR (€) - Euro' },
  { code: 'GBP', symbol: '£', label: 'GBP (£) - British Pound' },
  { code: 'JPY', symbol: '¥', label: 'JPY (¥) - Japanese Yen' },
  { code: 'CAD', symbol: 'CA$', label: 'CAD (CA$) - Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', label: 'AUD (A$) - Australian Dollar' },
  { code: 'CHF', symbol: 'CHF', label: 'CHF - Swiss Franc' },
  { code: 'INR', symbol: '₹', label: 'INR (₹) - Indian Rupee' },
  { code: 'CNY', symbol: '¥', label: 'CNY (¥) - Chinese Yuan' },
  { code: 'SGD', symbol: 'S$', label: 'SGD (S$) - Singapore Dollar' }
];

export function getCurrencySymbol(code?: string): string {
  const match = CURRENCY_OPTIONS.find((c) => c.code === (code || 'LKR'));
  return match ? match.symbol : 'LKR';
}

export interface ProductCompetitorPriceMatrixModalProps {
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
    volumePricing?: VolumePriceTier[];
  };
  itemType?: 'product' | 'service' | 'produce' | 'revenue_item';
  onClose: () => void;
  onUpdateOurPrice?: (newPrice: number, newCost?: number) => void;
  currentUser?: AppUser | null;
  onLogAudit?: (action: string, module: any, recordId?: string, recordName?: string, details?: string) => void;
}

export const ProductCompetitorPriceMatrixModal: React.FC<ProductCompetitorPriceMatrixModalProps> = ({
  item,
  itemType = 'product',
  onClose,
  onUpdateOurPrice,
  currentUser,
  onLogAudit
}) => {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [quotes, setQuotes] = useState<ProductCompetitorQuote[]>([]);
  const [history, setHistory] = useState<ProductCompetitorPriceHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');

  // Active Matrix Currency (defaults to item currency or LKR, selectable in UI)
  const [activeCurrency, setActiveCurrency] = useState<string>(item.currency || 'LKR');

  // Our Offering Rates state
  const [ourPrice, setOurPrice] = useState<number>(Number(item.ourPrice || 100));
  const [ourCost, setOurCost] = useState<number>(Number(item.ourCost || 65));
  const [ourVolumePricing, setOurVolumePricing] = useState<VolumePriceTier[]>(() => {
    if (item.volumePricing && item.volumePricing.length > 0) return item.volumePricing;
    const p = Number(item.ourPrice || 100);
    return [
      { minQty: 1, maxQty: 10, unitPrice: p, discountPct: 0, label: '1–10 (Base Rate)' },
      { minQty: 11, maxQty: 50, unitPrice: Number((p * 0.94).toFixed(2)), discountPct: 6.0, label: '11–50 (Volume Tier)' },
      { minQty: 51, unitPrice: Number((p * 0.88).toFixed(2)), discountPct: 12.0, label: '51+ (Enterprise Tier)' }
    ];
  });

  // History for our price changes
  const [ourPriceHistory, setOurPriceHistory] = useState<Array<{
    id: string;
    date: string;
    price: number;
    cost?: number;
    changePct?: number;
    reason: string;
    quoteRef?: string;
    updatedBy: string;
    volumePricing?: VolumePriceTier[];
  }>>([
    {
      id: `our-hist-init-${item.id}`,
      date: new Date().toISOString().slice(0, 10),
      price: Number(item.ourPrice || 100),
      cost: Number(item.ourCost || 65),
      changePct: 0,
      reason: 'Active baseline offering rate in PostgreSQL database',
      quoteRef: `STD-${item.code || 'PRD'}`,
      updatedBy: 'Lead Cost Estimator',
      volumePricing: ourVolumePricing
    }
  ]);

  // Dropdown menu state for column headers
  const [openColumnMenuId, setOpenColumnMenuId] = useState<string | null>(null);

  // Active Revision Audit Diff Modal State (triggered by View Changes)
  const [activeAuditModal, setActiveAuditModal] = useState<{
    date: string;
    targetQuoteId: string | 'our' | null;
  } | null>(null);

  // View latest volume tiers modal (triggered by View button)
  const [viewingRangesEntity, setViewingRangesEntity] = useState<{
    isOur: boolean;
    name: string;
    basePrice: number;
    moq: number;
    currency: string;
    tiers: VolumePriceTier[];
    targetQuote?: ProductCompetitorQuote;
  } | null>(null);

  // Commit Price dialog state (+ Change button)
  const [selectedQuoteForCommit, setSelectedQuoteForCommit] = useState<{
    isOur: boolean;
    quote?: ProductCompetitorQuote;
  } | null>(null);

  const [commitForm, setCommitForm] = useState<{
    changeBasePrice: boolean;
    newBasePrice: number;
    newCost: number;
    currency: string;
    effectiveDate: string;
    reason: string;
    quoteRef: string;
    moq: number;
    leadTimeDays: number;
    updatedBy: string;
    selectedRanges: Array<{
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
    }>;
  }>({
    changeBasePrice: true,
    newBasePrice: 100,
    newCost: 65,
    currency: 'USD',
    effectiveDate: new Date().toISOString().slice(0, 10),
    reason: 'Market Rate Calibration',
    quoteRef: `QT-${item.code || 'PRD'}-${Date.now().toString().slice(-4)}`,
    moq: 1,
    leadTimeDays: 7,
    updatedBy: currentUser?.name || 'Lead Estimator',
    selectedRanges: []
  });

  // Add Competitor Column Dialog State
  const [isAddCompetitorModalOpen, setIsAddCompetitorModalOpen] = useState(false);
  const [addCompetitorMode, setAddCompetitorMode] = useState<'existing' | 'create_new'>('existing');
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>('');
  const [newCompetitorForm, setNewCompetitorForm] = useState({
    name: '',
    country: 'United States',
    marketTier: 'Primary Competitor',
    contactPerson: '',
    email: '',
    website: '',
    notes: 'Direct market rival tracked for product quotation benchmarking.',
    startingPrice: ourPrice > 0 ? Number((ourPrice * 1.05).toFixed(2)) : 5000,
    currency: activeCurrency,
    moq: 1,
    leadTimeDays: 14,
    quoteRef: `QT-COMP-${Date.now().toString().slice(-4)}`,
    quoteReason: 'Market competitor rate benchmark onboarding',
    volumeTiers: [
      { minQty: 1, maxQty: 10, unitPrice: ourPrice > 0 ? Number((ourPrice * 1.05).toFixed(2)) : 5000, discountPct: 0, label: '1–10 (Base Rate)' },
      { minQty: 11, maxQty: 50, unitPrice: ourPrice > 0 ? Number((ourPrice * 0.98).toFixed(2)) : 4700, discountPct: 6.0, label: '11–50 (Volume Tier)' },
      { minQty: 51, unitPrice: ourPrice > 0 ? Number((ourPrice * 0.92).toFixed(2)) : 4400, discountPct: 12.0, label: '51+ (Enterprise Tier)' }
    ] as VolumePriceTier[]
  });

  // Load from PostgreSQL database on mount
  const loadDatabaseData = async () => {
    setLoading(true);
    try {
      const [comps, qts, hist] = await Promise.all([
        api.getCompetitors().catch(() => []),
        api.getProductCompetitorQuotes(item.id, itemType).catch(() => []),
        api.getProductCompetitorHistory(item.id, itemType).catch(() => [])
      ]);

      setCompetitors(comps);
      setQuotes(qts);
      setHistory(hist);
    } catch (e: any) {
      console.warn('[PriceMatrix] Error loading competitor matrix data from PostgreSQL:', e?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatabaseData();
  }, [item.id]);

  // Market Metrics (Lowest, Highest, Active, Spread)
  const metrics = useMemo(() => {
    const compPrices = quotes.map((q) => Number(q.currentPrice)).filter((p) => p > 0);
    const allPrices = [ourPrice, ...compPrices].filter((p) => p > 0);
    const min = allPrices.length > 0 ? Math.min(...allPrices) : ourPrice;
    const max = allPrices.length > 0 ? Math.max(...allPrices) : ourPrice;

    // Lowest entity
    let lowestName = 'Our Offering';
    if (min < ourPrice) {
      const match = quotes.find((q) => Number(q.currentPrice) === min);
      if (match) lowestName = match.competitorName;
    }

    const spread = min > 0 ? ourPrice - min : 0;
    const spreadPct = min > 0 ? ((ourPrice - min) / min) * 100 : 0;

    return {
      activeOurPrice: ourPrice,
      lowestPrice: min,
      lowestName,
      highestPrice: max,
      spread,
      spreadPct
    };
  }, [quotes, ourPrice]);

  // Timeline Records (Distinct Revision Dates grouped across our price & competitor quotes)
  const timelineRecords = useMemo(() => {
    const dateMap = new Map<string, {
      date: string;
      latestReason: string;
      entitiesChanged: string[];
    }>();

    // 1. Add our price history dates
    ourPriceHistory.forEach((h) => {
      if (!dateMap.has(h.date)) {
        dateMap.set(h.date, {
          date: h.date,
          latestReason: h.reason || 'Our quoted rate adjustment',
          entitiesChanged: ['Our Quoted Selling Rate']
        });
      } else {
        const r = dateMap.get(h.date)!;
        if (!r.entitiesChanged.includes('Our Quoted Selling Rate')) {
          r.entitiesChanged.push('Our Quoted Selling Rate');
        }
      }
    });

    // 2. Add competitor price history dates
    quotes.forEach((q) => {
      (q.priceHistory || []).forEach((hist) => {
        const d = (hist.revisionDate || (hist as any).date || '').slice(0, 10);
        if (!d) return;
        if (!dateMap.has(d)) {
          dateMap.set(d, {
            date: d,
            latestReason: hist.reason || 'Competitor rate adjustment',
            entitiesChanged: [q.competitorName]
          });
        } else {
          const r = dateMap.get(d)!;
          if (!r.entitiesChanged.includes(q.competitorName)) {
            r.entitiesChanged.push(q.competitorName);
          }
        }
      });
    });

    let list = Array.from(dateMap.values());
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      list = list.filter((r) => r.date.toLowerCase().includes(q) || r.latestReason.toLowerCase().includes(q));
    }

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [ourPriceHistory, quotes, searchFilter]);

  // Handle open commit price revision dialog (+ Change button)
  const handleOpenCommitPrice = (isOur: boolean, quote?: ProductCompetitorQuote) => {
    const today = new Date().toISOString().slice(0, 10);
    if (isOur) {
      const ranges = ourVolumePricing.map((t, idx) => ({
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
        selected: true
      }));

      setSelectedQuoteForCommit({ isOur: true });
      setCommitForm({
        changeBasePrice: true,
        newBasePrice: ourPrice,
        newCost: ourCost,
        currency: activeCurrency,
        effectiveDate: today,
        reason: 'Offering price calibration aligned with competitor benchmarks',
        quoteRef: `QT-${item.code || 'PRD'}-${Date.now().toString().slice(-4)}`,
        moq: 1,
        leadTimeDays: 7,
        updatedBy: currentUser?.name || 'Lead Estimator',
        selectedRanges: ranges
      });
    } else if (quote) {
      const tiers = quote.volumePricing || [];
      const ranges = tiers.map((t, idx) => ({
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
        selected: true
      }));

      setSelectedQuoteForCommit({ isOur: false, quote });
      setCommitForm({
        changeBasePrice: true,
        newBasePrice: Number(quote.currentPrice),
        newCost: 0,
        currency: quote.currency || activeCurrency,
        effectiveDate: today,
        reason: 'Market competitor rate revision and volume restructuring',
        quoteRef: `QT-${quote.competitorName.slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-4)}`,
        moq: quote.moq || 1,
        leadTimeDays: quote.leadTimeDays || 14,
        updatedBy: currentUser?.name || 'Market Intelligence Lead',
        selectedRanges: ranges
      });
    }
  };

  // Add new volume tier range
  const handleAddNewRangeToCommit = () => {
    setCommitForm((prev) => {
      const ranges = prev.selectedRanges;
      let nextMin = 1;
      let nextMax: number | undefined = 10;
      let prevDiscount = 0;
      if (ranges.length > 0) {
        const last = ranges[ranges.length - 1];
        nextMin = (last.maxQty || last.minQty || 0) + 1;
        nextMax = nextMin + 25;
        prevDiscount = Math.min(60, (last.discountPct || 0) + 5);
      }
      const newPrice = Number((prev.newBasePrice * (1 - prevDiscount / 100)).toFixed(2));
      const newRange = {
        rangeIndex: ranges.length,
        label: `${nextMin}–${nextMax} (Volume Tier)`,
        minQty: nextMin,
        currentMinQty: nextMin,
        maxQty: nextMax,
        currentMaxQty: nextMax,
        currentPrice: newPrice,
        newPrice: newPrice,
        currentDiscountPct: prevDiscount,
        discountPct: prevDiscount,
        selected: true
      };
      return { ...prev, selectedRanges: [...ranges, newRange] };
    });
  };

  // Delete volume tier range
  const handleDeleteRangeFromCommit = (indexToDelete: number) => {
    setCommitForm((prev) => ({
      ...prev,
      selectedRanges: prev.selectedRanges
        .filter((_, idx) => idx !== indexToDelete)
        .map((r, i) => ({ ...r, rangeIndex: i }))
    }));
  };

  // Update volume tier field
  const handleUpdateRangeField = (
    idx: number,
    field: 'minQty' | 'maxQty' | 'label' | 'newPrice' | 'discountPct' | 'selected',
    val: any
  ) => {
    setCommitForm((prev) => {
      const updated = [...prev.selectedRanges];
      const target = { ...updated[idx] };
      if (field === 'newPrice') {
        const p = parseFloat(val) || 0;
        target.newPrice = p;
        if (prev.newBasePrice > 0) {
          target.discountPct = Number((((prev.newBasePrice - p) / prev.newBasePrice) * 100).toFixed(1));
        }
      } else if (field === 'discountPct') {
        const disc = parseFloat(val) || 0;
        target.discountPct = disc;
        target.newPrice = Number((prev.newBasePrice * (1 - disc / 100)).toFixed(2));
      } else if (field === 'minQty') {
        target.minQty = parseInt(val, 10) || 1;
        if (target.label.includes('–') || target.label.includes('+')) {
          target.label = `${target.minQty}–${target.maxQty || '+'} (Volume Tier)`;
        }
      } else if (field === 'maxQty') {
        target.maxQty = val === '' ? undefined : parseInt(val, 10) || undefined;
        if (target.label.includes('–') || target.label.includes('+')) {
          target.label = `${target.minQty}–${target.maxQty || '+'} (Volume Tier)`;
        }
      } else if (field === 'label') {
        target.label = val;
      } else if (field === 'selected') {
        target.selected = Boolean(val);
      }
      updated[idx] = target;
      return { ...prev, selectedRanges: updated };
    });
  };

  // Add Competitor Column volume tier helpers
  const handleAddNewTierToAddCompetitor = () => {
    setNewCompetitorForm((prev) => {
      const existing = prev.volumeTiers || [];
      const last = existing[existing.length - 1];
      const nextMin = last && last.maxQty ? last.maxQty + 1 : (last ? last.minQty + 50 : 1);
      const nextMax = nextMin + 49;
      const base = Number(prev.startingPrice) || 100;
      const nextDisc = (last ? (last.discountPct || 0) + 5 : 5);
      const nextPrice = Number((base * (1 - nextDisc / 100)).toFixed(2));
      return {
        ...prev,
        volumeTiers: [
          ...existing,
          {
            minQty: nextMin,
            maxQty: nextMax,
            unitPrice: nextPrice,
            discountPct: nextDisc,
            label: `${nextMin}–${nextMax} (Volume Tier)`
          }
        ]
      };
    });
  };

  const handleDeleteTierFromAddCompetitor = (idxToDelete: number) => {
    setNewCompetitorForm((prev) => ({
      ...prev,
      volumeTiers: (prev.volumeTiers || []).filter((_, i) => i !== idxToDelete)
    }));
  };

  const handleUpdateTierInAddCompetitor = (
    idx: number,
    field: 'minQty' | 'maxQty' | 'label' | 'unitPrice' | 'discountPct',
    val: any
  ) => {
    setNewCompetitorForm((prev) => {
      const updated = [...(prev.volumeTiers || [])];
      const target = { ...updated[idx] };
      const base = Number(prev.startingPrice) || 100;

      if (field === 'unitPrice') {
        const p = parseFloat(val) || 0;
        target.unitPrice = p;
        if (base > 0) {
          target.discountPct = Number((((base - p) / base) * 100).toFixed(1));
        }
      } else if (field === 'discountPct') {
        const d = parseFloat(val) || 0;
        target.discountPct = d;
        target.unitPrice = Number((base * (1 - d / 100)).toFixed(2));
      } else if (field === 'minQty') {
        target.minQty = parseInt(val, 10) || 1;
      } else if (field === 'maxQty') {
        target.maxQty = val === '' ? undefined : parseInt(val, 10) || undefined;
      } else if (field === 'label') {
        target.label = val;
      }
      updated[idx] = target;
      return { ...prev, volumeTiers: updated };
    });
  };

  // Submit commit price revision
  const handleSubmitPriceCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuoteForCommit) return;

    const today = commitForm.effectiveDate || new Date().toISOString().slice(0, 10);
    const newPrice = Number(commitForm.newBasePrice);
    const activeCurr = commitForm.currency || activeCurrency;

    // Build finalized VolumePriceTier list from commitForm.selectedRanges
    const selectedRanges = commitForm.selectedRanges.filter((r) => r.selected);
    const finalRangesSource = selectedRanges.length > 0 ? selectedRanges : commitForm.selectedRanges;
    const updatedTiers: VolumePriceTier[] = finalRangesSource.map((r) => ({
      minQty: Number(r.minQty) || 1,
      maxQty: r.maxQty ? Number(r.maxQty) : undefined,
      unitPrice: Number(r.newPrice),
      discountPct: Number(r.discountPct),
      label: r.label || `${r.minQty}–${r.maxQty || '+'} Tier`
    }));

    if (selectedQuoteForCommit.isOur) {
      // 1. Revision for Our Offering Rate
      const oldPrice = ourPrice;
      const changePct = oldPrice > 0 ? Number((((newPrice - oldPrice) / oldPrice) * 100).toFixed(2)) : 0;

      setOurPrice(newPrice);
      setOurCost(Number(commitForm.newCost));
      setActiveCurrency(activeCurr);
      setOurVolumePricing(updatedTiers);

      const newHist = {
        id: `our-hist-${Date.now()}`,
        date: today,
        price: newPrice,
        cost: Number(commitForm.newCost),
        changePct,
        reason: commitForm.reason || 'Offering rate update',
        quoteRef: commitForm.quoteRef,
        updatedBy: commitForm.updatedBy || 'Pricing Lead',
        volumePricing: updatedTiers
      };
      setOurPriceHistory([newHist, ...ourPriceHistory]);

      // Call parent callback if provided
      if (onUpdateOurPrice) {
        onUpdateOurPrice(newPrice, Number(commitForm.newCost));
      }

      // Persist to PostgreSQL database directly
      try {
        if (itemType === 'revenue_item' || item.id.startsWith('rev-')) {
          await api.commitRevenueItemPrice(item.id, {
            rate: newPrice,
            costPrice: Number(commitForm.newCost),
            effectiveDate: today,
            reason: commitForm.reason,
            quoteRef: commitForm.quoteRef,
            updatedBy: commitForm.updatedBy
          });
          await api.updateRevenueItem(item.id, {
            defaultRate: newPrice,
            costPrice: Number(commitForm.newCost),
            currency: activeCurr
          });
        } else if (itemType === 'resource' || item.id.startsWith('res-')) {
          await api.commitResourcePrice(item.id, {
            newRate: newPrice,
            effectiveDate: today,
            reason: commitForm.reason,
            updatedBy: commitForm.updatedBy,
            currency: activeCurr
          }).catch(() => {});
          await api.updateResource(item.id, {
            baseRate: newPrice,
            operationalCharge: Number(commitForm.newCost),
            currency: activeCurr
          }).catch(() => {});
        } else if (itemType === 'overhead' || item.id.startsWith('ovh-')) {
          await api.updateOverheadItem(item.id, {
            amount: newPrice,
            currency: activeCurr
          }).catch(() => {});
        } else if (itemType === 'material' || item.id.startsWith('mat-')) {
          await api.updateMaterialPrice(
            item.id,
            newPrice,
            commitForm.reason || 'Price update from competitor matrix',
            commitForm.updatedBy,
            undefined,
            today
          ).catch(() => {});
          await api.updateMaterial(item.id, {
            unitCost: newPrice,
            retailPrice: newPrice,
            currency: activeCurr
          }).catch(() => {});
        } else {
          await api.updateProduceItem(item.id, {
            retailPrice: newPrice,
            costPrice: Number(commitForm.newCost),
            currency: activeCurr,
            bundlesAndRanges: updatedTiers.map((t) => ({
              minQty: t.minQty,
              unitPrice: t.unitPrice,
              discountPct: t.discountPct,
              label: t.label
            }))
          });
        }
      } catch (err: any) {
        console.warn('[PriceMatrix] PostgreSQL database price sync notice:', err?.message);
      }

      setSelectedQuoteForCommit(null);
    } else if (selectedQuoteForCommit.quote) {
      // 2. Revision for Competitor Quote
      const q = selectedQuoteForCommit.quote;
      const oldPrice = Number(q.currentPrice);
      const changePct = oldPrice > 0 ? Number((((newPrice - oldPrice) / oldPrice) * 100).toFixed(2)) : 0;
      const currSymbol = getCurrencySymbol(activeCurr);

      const appliedSummary: string[] = [
        `Competitor base rate revised: ${currSymbol}${oldPrice.toFixed(2)} → ${currSymbol}${newPrice.toFixed(2)} (${changePct >= 0 ? '+' : ''}${changePct}%)`,
        `Volume tiers updated: ${updatedTiers.length} quantity breaks active`
      ];

      try {
        await api.commitProductCompetitorPrice(item.id, q.id, {
          price: newPrice,
          ourPrice: ourPrice,
          currency: activeCurr,
          revisionDate: today,
          reason: commitForm.reason || 'Competitor market quote update',
          quoteRef: commitForm.quoteRef,
          moq: Number(commitForm.moq),
          leadTimeDays: Number(commitForm.leadTimeDays),
          updatedBy: commitForm.updatedBy || 'Pricing Estimator',
          volumePricing: updatedTiers,
          appliedChangesSummary: appliedSummary
        });

        // Reload fresh data from PostgreSQL database
        await loadDatabaseData();
      } catch (err: any) {
        console.error('Failed to commit competitor price revision to PostgreSQL:', err);
        // Fallback local update
        setQuotes((prev) =>
          prev.map((quote) =>
            quote.id === q.id
              ? {
                  ...quote,
                  currentPrice: newPrice,
                  currency: activeCurr,
                  volumePricing: updatedTiers,
                  priceHistory: [
                    {
                      id: `hist-${Date.now()}`,
                      quoteId: q.id,
                      itemId: item.id,
                      itemType: itemType,
                      competitorName: q.competitorName,
                      revisionDate: today,
                      price: newPrice,
                      previousPrice: oldPrice,
                      ourPrice: ourPrice,
                      changePct,
                      reason: commitForm.reason,
                      quoteRef: commitForm.quoteRef,
                      updatedBy: commitForm.updatedBy,
                      appliedChangesSummary: appliedSummary
                    },
                    ...(quote.priceHistory || [])
                  ]
                }
              : quote
          )
        );
      }

      setSelectedQuoteForCommit(null);
    }
  };

  // Add Competitor Column Submit
  const handleAddCompetitorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let compId = selectedCompetitorId;
    let compName = '';

    if (addCompetitorMode === 'create_new' || !compId) {
      if (!newCompetitorForm.name.trim()) return;
      try {
        const created = await api.createCompetitor({
          name: newCompetitorForm.name.trim(),
          country: newCompetitorForm.country,
          marketTier: newCompetitorForm.marketTier,
          contactPerson: newCompetitorForm.contactPerson,
          email: newCompetitorForm.email,
          website: newCompetitorForm.website,
          notes: newCompetitorForm.notes
        });
        compId = created.id;
        compName = created.name;
        setCompetitors((prev) => [...prev, created]);
      } catch (err) {
        console.error('Failed to create competitor profile:', err);
        compId = `comp-${Date.now()}`;
        compName = newCompetitorForm.name.trim();
      }
    } else {
      const match = competitors.find((c) => c.id === compId);
      compName = match ? match.name : 'Industry Competitor';
    }

    const price = Number(newCompetitorForm.startingPrice);

    try {
      const validItemType: 'product' | 'service' | 'produce' | 'revenue_item' =
        itemType === 'service' || itemType === 'produce' || itemType === 'revenue_item' ? itemType : 'product';

      await api.createProductCompetitorQuote(item.id, {
        itemType: validItemType,
        itemCode: item.code,
        itemName: item.name,
        competitorId: compId,
        competitorName: compName,
        currentPrice: price,
        ourPrice: ourPrice,
        moq: Number(newCompetitorForm.moq),
        leadTimeDays: Number(newCompetitorForm.leadTimeDays),
        currency: newCompetitorForm.currency || activeCurrency || 'USD',
        notes: newCompetitorForm.notes,
        reason: newCompetitorForm.quoteReason,
        quoteRef: newCompetitorForm.quoteRef,
        volumePricing: newCompetitorForm.volumeTiers
      });

      // Reload fresh matrix from PostgreSQL database
      await loadDatabaseData();
    } catch (err: any) {
      console.error('Failed to create competitor quote:', err);
    }

    setIsAddCompetitorModalOpen(false);
  };

  // Delete Competitor Quote
  const handleDeleteCompetitorQuote = async (quote: ProductCompetitorQuote) => {
    if (!window.confirm(`Are you sure you want to delete the quote column for "${quote.competitorName}"?`)) return;
    try {
      await api.deleteProductCompetitorQuote(item.id, quote.id);
      await loadDatabaseData();
    } catch (err: any) {
      console.error('Failed to delete competitor quote:', err);
      setQuotes((prev) => prev.filter((q) => q.id !== quote.id));
    }
  };

  // Gross Margin Calculation for Our Rate
  const grossMarginPct = ourPrice > 0 ? Number((((ourPrice - ourCost) / ourPrice) * 100).toFixed(1)) : 0;

  return (
    <div className="fixed inset-0 z-50 w-full h-full bg-white flex flex-col overflow-hidden select-none">
      {/* 1. TOP HEADER BAR (EXACT FXTT TEMPLATE) */}
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

          {/* Item Identification Badge */}
          <span className="font-mono text-xs font-semibold text-[#003049] bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0">
            {item.code || 'PRD-001'}
          </span>

          <span className="text-xs font-medium text-slate-800 truncate max-w-xs md:max-w-md" title={item.name}>
            {item.name}
          </span>

          <span className="text-[11px] text-slate-400 shrink-0">
            ({item.unit || 'unit'})
          </span>

          {/* Market Summary Badges */}
          <div className="hidden lg:flex items-center space-x-2 text-[11px] pl-2 border-l border-slate-200">
            <span className="text-slate-600">
              Active: <strong className="text-slate-900 font-medium">{getCurrencySymbol(activeCurrency)}{ourPrice.toFixed(2)}</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-medium">
              Lowest: {getCurrencySymbol(activeCurrency)}{metrics.lowestPrice.toFixed(2)} ({metrics.lowestName.split(' ')[0]})
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">
              Spread: {metrics.spread >= 0 ? `+${getCurrencySymbol(activeCurrency)}${metrics.spread.toFixed(2)}` : `-${getCurrencySymbol(activeCurrency)}${Math.abs(metrics.spread).toFixed(2)}`} ({metrics.spreadPct.toFixed(1)}%)
            </span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Matrix Currency Selector */}
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded px-1.5 py-1">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Currency:</span>
            <select
              value={activeCurrency}
              onChange={(e) => setActiveCurrency(e.target.value)}
              className="text-xs font-bold text-[#003049] bg-transparent border-0 focus:ring-0 cursor-pointer p-0 pr-1"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.symbol})
                </option>
              ))}
            </select>
          </div>

          {/* Revision dates search input */}
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

          {/* CHANGES BUTTON */}
          <button
            type="button"
            onClick={() => setActiveAuditModal({ date: 'all', targetQuoteId: null })}
            className="flex items-center space-x-1.5 px-2.5 py-1 bg-blue-50 hover:bg-[#003049] text-[#003049] hover:text-white border border-blue-200 rounded text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            title="Changes"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Changes</span>
          </button>

          {/* ADD COLUMN BUTTON */}
          <button
            type="button"
            onClick={() => setIsAddCompetitorModalOpen(true)}
            className="flex items-center space-x-1 px-2.5 py-1 bg-[#003049] hover:bg-[#002235] text-white rounded text-xs font-medium transition-colors cursor-pointer"
            title="Add Column"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Column</span>
          </button>

          {/* Close X */}
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

      {/* 2. MAIN TABLE MATRIX (EXACT FXTT PROTOCOL TEMPLATE) */}
      <div className="flex-1 overflow-auto bg-white min-h-[380px] max-h-[calc(100vh-80px)] border-b border-slate-200">
        <table className="w-full text-left border-collapse min-w-[860px]">
          {/* COLUMN HEADERS */}
          <thead className="bg-[#f8fafc] sticky top-0 z-20 border-b border-slate-300 shadow-2xs">
            <tr>
              {/* Left Column: Revision Timeline Date Header */}
              <th className="py-2.5 px-3 border-r border-slate-200 w-60 min-w-[230px] max-w-[250px] bg-[#eef3f7] sticky left-0 z-30 align-bottom">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-[#003049] uppercase tracking-wider">
                      Date
                    </div>
                    <div className="text-[10px] text-slate-500 font-normal">
                      Audit
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-[10px] text-slate-600 font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {timelineRecords.length} Rows
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveAuditModal({ date: 'all', targetQuoteId: null })}
                      className="text-[10px] text-[#0077b6] hover:underline font-semibold cursor-pointer"
                      title="Inspect full revision audit log"
                    >
                      Audit
                    </button>
                  </div>
                </div>
              </th>

              {/* PRIMARY COLUMN: OUR QUOTED SELLING RATE (INTERNAL ACTIVE STANDARD RATE) */}
              <th className="py-2 px-3 border-r border-slate-200 min-w-[240px] align-top bg-[#f0f7fa]">
                <div>
                  <div className="flex items-start justify-between gap-1">
                    <div className="truncate pr-1">
                      <span className="text-xs font-bold text-slate-900 truncate block hover:text-[#003049]">
                        Our Quoted Selling Rate
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        Internal Cost: {getCurrencySymbol(activeCurrency)}{ourCost.toFixed(2)} • Margin: {grossMarginPct}%
                      </span>
                    </div>

                    <div className="shrink-0 flex items-center space-x-1">
                      <span className="text-[9px] uppercase font-bold bg-[#003049] text-white px-1.5 py-0.5 rounded">
                        Primary
                      </span>
                    </div>
                  </div>

                  {/* Fine Line Divider */}
                  <div className="border-t border-slate-200/80 my-1.5" />

                  {/* Active Rate & Action Buttons */}
                  <div className="flex items-center justify-between gap-1 relative">
                    <div className="text-xs font-bold font-mono text-[#003049] whitespace-nowrap">
                      {getCurrencySymbol(activeCurrency)}{ourPrice.toFixed(2)}{' '}
                      <span className="text-[10px] font-normal text-slate-400">/ {item.unit || 'unit'}</span>
                    </div>

                    {/* Fine UI Button Group */}
                    <div className="inline-flex items-center rounded border border-slate-200 bg-white shadow-2xs divide-x divide-slate-200 shrink-0">
                      {/* View Button */}
                      <button
                        type="button"
                        onClick={() =>
                          setViewingRangesEntity({
                            isOur: true,
                            name: 'Our Quoted Selling Rate',
                            basePrice: ourPrice,
                            moq: 1,
                            tiers: ourVolumePricing
                          })
                        }
                        className="px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:text-sky-800 hover:bg-sky-50 transition-colors flex items-center space-x-1 cursor-pointer"
                        title="View volume pricing breaks for our quoted rate"
                      >
                        <Eye className="w-3 h-3 text-sky-600" />
                        <span>View</span>
                      </button>

                      {/* + Change Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenCommitPrice(true)}
                        className="px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors flex items-center space-x-0.5 cursor-pointer"
                        title="Commit price revision for our offering rate"
                      >
                        <span>+ Change</span>
                      </button>

                      {/* Edit Rate Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenCommitPrice(true)}
                        className="px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:text-blue-800 hover:bg-blue-50 transition-colors flex items-center cursor-pointer"
                        title="Edit internal rate & COGS"
                      >
                        <Edit className="w-3 h-3 text-blue-600" />
                      </button>

                      {/* Menu Button */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenColumnMenuId(openColumnMenuId === 'our' ? null : 'our')}
                          className="px-1.5 py-0.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {openColumnMenuId === 'our' && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setOpenColumnMenuId(null)} />
                            <div className="absolute right-0 top-full mt-1.5 z-40 w-52 bg-white rounded-lg shadow-xl border border-slate-200 py-1 text-left text-xs divide-y divide-slate-100 animate-in fade-in zoom-in-95">
                              <div className="px-3 py-1.5 bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500">
                                Internal Rate Commands
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenColumnMenuId(null);
                                  handleOpenCommitPrice(true);
                                }}
                                className="w-full px-3 py-1.5 flex items-center space-x-2 hover:bg-slate-50 text-slate-800 text-left cursor-pointer"
                              >
                                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Commit Price Revision</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenColumnMenuId(null);
                                  setActiveAuditModal({ date: 'all', targetQuoteId: 'our' });
                                }}
                                className="w-full px-3 py-1.5 flex items-center space-x-2 hover:bg-slate-50 text-slate-800 text-left cursor-pointer"
                              >
                                <History className="w-3.5 h-3.5 text-slate-500" />
                                <span>Revision History Diff</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </th>

              {/* COMPETITOR COLUMNS */}
              {quotes.map((quote) => {
                const compPrice = Number(quote.currentPrice);
                const isLowerThanOur = compPrice < ourPrice;
                const spreadDiff = compPrice - ourPrice;
                const spreadPct = ourPrice > 0 ? ((compPrice - ourPrice) / ourPrice) * 100 : 0;
                const isMenuOpen = openColumnMenuId === quote.id;

                return (
                  <th
                    key={quote.id}
                    className="py-2 px-3 border-r border-slate-200 min-w-[240px] align-top bg-[#f8fafc]"
                  >
                    <div>
                      {/* Competitor Name & Badge */}
                      <div className="flex items-start justify-between gap-1">
                        <div className="truncate pr-1">
                          <span
                            className="text-xs font-bold text-slate-900 truncate block hover:text-[#003049]"
                            title={quote.competitorName}
                          >
                            {quote.competitorName}
                          </span>
                          <span className="text-[10px] text-slate-500 block truncate">
                            {quote.leadTimeDays ? `${quote.leadTimeDays}d SLA` : '14d SLA'} • MOQ {quote.moq || 1}
                          </span>
                        </div>

                        <div className="shrink-0 flex items-center space-x-1">
                          <span className={`text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded border ${
                            quote.isBenchmark
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : isLowerThanOur
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {quote.isBenchmark ? 'Benchmark' : 'Competitor'}
                          </span>
                        </div>
                      </div>

                      {/* Fine Line Divider */}
                      <div className="border-t border-slate-200/80 my-1.5" />

                      {/* Quoted Price & Action Buttons */}
                      <div className="flex items-center justify-between gap-1 relative">
                        <div>
                          <div className="text-xs font-bold font-mono text-[#003049] whitespace-nowrap">
                            {getCurrencySymbol(activeCurrency)}{compPrice.toFixed(2)}{' '}
                            <span className="text-[10px] font-normal text-slate-400">/ {item.unit || 'unit'}</span>
                          </div>
                          {/* Comparison delta pill */}
                          <div className="text-[10px] font-medium mt-0.5 flex items-center space-x-1">
                            {isLowerThanOur ? (
                              <span className="text-rose-600 bg-rose-50 px-1 py-0.2 rounded border border-rose-200">
                                {spreadPct.toFixed(1)}% (Comp Lower)
                              </span>
                            ) : (
                              <span className="text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                                +{spreadPct.toFixed(1)}% (Our Price Lower)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Fine UI Button Group */}
                        <div className="inline-flex items-center rounded border border-slate-200 bg-white shadow-2xs divide-x divide-slate-200 shrink-0">
                          {/* View Button */}
                          <button
                            type="button"
                            onClick={() =>
                              setViewingRangesEntity({
                                isOur: false,
                                name: quote.competitorName,
                                basePrice: compPrice,
                                moq: quote.moq || 1,
                                tiers: quote.volumePricing || []
                              })
                            }
                            className="px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:text-sky-800 hover:bg-sky-50 transition-colors flex items-center space-x-1 cursor-pointer"
                            title={`View volume pricing breaks for ${quote.competitorName}`}
                          >
                            <Eye className="w-3 h-3 text-sky-600" />
                            <span>View</span>
                          </button>

                          {/* + Change Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenCommitPrice(false, quote)}
                            className="px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors flex items-center space-x-0.5 cursor-pointer"
                            title={`Commit price revision for ${quote.competitorName}`}
                          >
                            <span>+ Change</span>
                          </button>

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenCommitPrice(false, quote)}
                            className="px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:text-blue-800 hover:bg-blue-50 transition-colors flex items-center cursor-pointer"
                            title="Edit competitor quote"
                          >
                            <Edit className="w-3 h-3 text-blue-600" />
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteCompetitorQuote(quote)}
                            className="px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:text-rose-800 hover:bg-rose-50 transition-colors flex items-center cursor-pointer"
                            title="Delete competitor quote"
                          >
                            <Trash2 className="w-3 h-3 text-rose-500" />
                          </button>

                          {/* Menu Button */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenColumnMenuId(isMenuOpen ? null : quote.id)}
                              className="px-1.5 py-0.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {isMenuOpen && (
                              <>
                                <div className="fixed inset-0 z-30" onClick={() => setOpenColumnMenuId(null)} />
                                <div className="absolute right-0 top-full mt-1.5 z-40 w-52 bg-white rounded-lg shadow-xl border border-slate-200 py-1 text-left text-xs divide-y divide-slate-100 animate-in fade-in zoom-in-95">
                                  <div className="px-3 py-1.5 bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500">
                                    Competitor Commands
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenColumnMenuId(null);
                                      handleOpenCommitPrice(false, quote);
                                    }}
                                    className="w-full px-3 py-1.5 flex items-center space-x-2 hover:bg-slate-50 text-slate-800 text-left cursor-pointer"
                                  >
                                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Commit Price Revision</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenColumnMenuId(null);
                                      setActiveAuditModal({ date: 'all', targetQuoteId: quote.id });
                                    }}
                                    className="w-full px-3 py-1.5 flex items-center space-x-2 hover:bg-slate-50 text-slate-800 text-left cursor-pointer"
                                  >
                                    <History className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Revision History Diff</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenColumnMenuId(null);
                                      handleDeleteCompetitorQuote(quote);
                                    }}
                                    className="w-full px-3 py-1.5 flex items-center space-x-2 hover:bg-rose-50 text-rose-700 text-left cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                    <span>Delete Competitor Quote</span>
                                  </button>
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

              {/* Quick Add Competitor Column Header */}
              <th className="py-2 px-3 min-w-[130px] bg-slate-50 border-r border-slate-200 text-center align-middle">
                <button
                  type="button"
                  onClick={() => setIsAddCompetitorModalOpen(true)}
                  className="w-full py-2 px-2 bg-white hover:bg-slate-100 border border-dashed border-slate-300 hover:border-[#003049] text-slate-600 hover:text-[#003049] rounded text-[11px] font-medium transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                  title="Add competitor column to compare quotes, ranges & benchmarks"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Competitor</span>
                </button>
              </th>
            </tr>
          </thead>

          {/* TABLE ROWS - ONE ROW PER REVISION DATE */}
          <tbody className="divide-y divide-slate-200 text-xs">
            {timelineRecords.length === 0 ? (
              <tr>
                <td colSpan={quotes.length + 3} className="py-12 text-center text-slate-500 bg-slate-50">
                  <Scale className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <div className="font-semibold text-slate-800 text-xs">No Historical Revision Events Recorded</div>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                    Click "+ Change" on any rate column or "+ Add Competitor Column" to start tracking market price revisions.
                  </p>
                </td>
              </tr>
            ) : (
              timelineRecords.map((timeline) => {
                // Find our price record on this date if any
                const ourRec = ourPriceHistory.find((h) => h.date === timeline.date);

                return (
                  <tr
                    key={timeline.date}
                    className="h-9 min-h-[36px] max-h-[36px] hover:bg-blue-50/40 transition-colors border-b border-slate-200 whitespace-nowrap"
                  >
                    {/* Date Cell with [View Changes] button */}
                    <td className="py-1 px-3 border-r border-slate-200 bg-white sticky left-0 z-10 whitespace-nowrap text-xs font-mono text-slate-700">
                      <div className="flex items-center justify-between space-x-2">
                        <div className="flex items-center space-x-1.5 shrink-0">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-900">{timeline.date}</span>
                        </div>

                        {/* BUTTON: CHANGES FOR THIS ROW */}
                        <button
                          type="button"
                          onClick={() => setActiveAuditModal({ date: timeline.date, targetQuoteId: null })}
                          className="px-2 py-0.5 text-[10px] bg-blue-50 hover:bg-[#003049] text-[#003049] hover:text-white rounded border border-blue-200 transition-colors font-semibold flex items-center space-x-1 cursor-pointer ml-auto shrink-0 shadow-2xs"
                          title={`Changes on ${timeline.date}`}
                        >
                          <Eye className="w-3 h-3" />
                          <span>Changes</span>
                        </button>
                      </div>
                    </td>

                    {/* Cell under Our Quoted Selling Rate */}
                    <td
                      onClick={() => setActiveAuditModal({ date: timeline.date, targetQuoteId: 'our' })}
                      className="py-1 px-3 border-r border-slate-200 whitespace-nowrap text-xs bg-amber-50/20 hover:bg-amber-100/40 transition-colors cursor-pointer"
                      title="Inspect our offering rate on this date"
                    >
                      {ourRec ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5 truncate">
                            <span className="text-slate-900 font-bold font-mono">
                              ${ourRec.price.toFixed(2)}
                            </span>
                            {ourRec.cost !== undefined && ourRec.cost > 0 && (
                              <span className="text-[10px] text-slate-400">
                                (c: ${ourRec.cost.toFixed(0)})
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-semibold px-1 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            {ourRec.changePct !== undefined && ourRec.changePct !== 0
                              ? `${ourRec.changePct > 0 ? '+' : ''}${ourRec.changePct}%`
                              : 'Active'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-center block">—</span>
                      )}
                    </td>

                    {/* Cells under Competitor Columns */}
                    {quotes.map((quote) => {
                      const exactRecord = (quote.priceHistory || []).find((h) => {
                        const d = (h.revisionDate || (h as any).date || '').slice(0, 10);
                        return d === timeline.date;
                      });

                      if (!exactRecord) {
                        return (
                          <td
                            key={quote.id}
                            className="py-1 px-3 border-r border-slate-200 whitespace-nowrap text-slate-300 text-center text-xs bg-white"
                          >
                            —
                          </td>
                        );
                      }

                      const price = Number(exactRecord.price);
                      const changePct = exactRecord.changePct;
                      const isLowerThanOur = price < ourPrice;

                      return (
                        <td
                          key={quote.id}
                          onClick={() => setActiveAuditModal({ date: timeline.date, targetQuoteId: quote.id })}
                          className="py-1 px-3 border-r border-slate-200 whitespace-nowrap text-xs bg-amber-50/30 hover:bg-amber-100/50 transition-colors cursor-pointer"
                          title={`Click to view audit diff for ${quote.competitorName} on ${timeline.date}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1.5 truncate">
                              <span className="text-slate-900 font-bold font-mono">
                                ${price.toFixed(2)}
                              </span>
                              {isLowerThanOur ? (
                                <span className="text-[9px] px-1 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                  Comp Lower
                                </span>
                              ) : (
                                <span className="text-[9px] px-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Our Lower
                                </span>
                              )}
                            </div>

                            <span className="text-[10px] font-semibold px-1 rounded bg-slate-100 text-slate-600">
                              {changePct !== undefined && changePct !== 0
                                ? `${changePct > 0 ? '+' : ''}${changePct}%`
                                : 'New'}
                            </span>
                          </div>
                        </td>
                      );
                    })}

                    {/* Empty placeholder column cell */}
                    <td className="py-1 px-3 border-r border-slate-200 whitespace-nowrap text-slate-300 text-center text-xs bg-slate-50/50">
                      —
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 3. FOOTER STATUS BAR */}
      <footer className="h-8 px-4 bg-slate-50 border-t border-slate-200 text-slate-500 text-[11px] flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <span className="font-mono font-medium text-slate-700">{item.code || 'PRD-001'}</span>
          <span>•</span>
          <span>{quotes.length} Competitors</span>
          <span>•</span>
          <span>{timelineRecords.length} Revisions</span>
          <span>•</span>
          <span className="text-emerald-700 font-medium">PostgreSQL Active</span>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* 4. MODALS & SUB-DIALOGS                                                   */}
      {/* ========================================================================= */}

      {/* MODAL 1: COMMIT PRICE REVISION DIALOG (+ Change button) */}
      {selectedQuoteForCommit && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#003049] text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-[#fdf0d5]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Commit Price Revision: {selectedQuoteForCommit.isOur ? 'Our Quoted Selling Rate' : selectedQuoteForCommit.quote?.competitorName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedQuoteForCommit(null)}
                className="text-white/70 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitPriceCommit} className="p-4 space-y-3.5 text-xs">
              {/* Currency Selector & Selling Rate */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">
                    Currency Type
                  </label>
                  <select
                    value={commitForm.currency}
                    onChange={(e) => setCommitForm({ ...commitForm, currency: e.target.value })}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded font-semibold text-xs text-slate-800 bg-white focus:outline-none focus:border-[#003049]"
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">
                    New Selling Rate ({item.unit || 'unit'})
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-slate-500 font-bold text-xs pointer-events-none">
                      {getCurrencySymbol(commitForm.currency)}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={commitForm.newBasePrice}
                      onChange={(e) => {
                        const newBase = parseFloat(e.target.value) || 0;
                        const updatedRanges = commitForm.selectedRanges.map((r) => ({
                          ...r,
                          newPrice: Number((newBase * (1 - (r.discountPct || 0) / 100)).toFixed(2))
                        }));
                        setCommitForm({ ...commitForm, newBasePrice: newBase, selectedRanges: updatedRanges });
                      }}
                      className="w-full pl-6 pr-2 py-1.5 border border-slate-300 rounded font-mono text-xs focus:outline-none focus:border-[#003049]"
                    />
                  </div>
                </div>

                {selectedQuoteForCommit.isOur ? (
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      Direct Unit Cost / COGS
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-slate-500 font-bold text-xs pointer-events-none">
                        {getCurrencySymbol(commitForm.currency)}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={commitForm.newCost}
                        onChange={(e) => setCommitForm({ ...commitForm, newCost: parseFloat(e.target.value) || 0 })}
                        className="w-full pl-6 pr-2 py-1.5 border border-slate-300 rounded font-mono text-xs focus:outline-none focus:border-[#003049]"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      Lead Time (Days SLA)
                    </label>
                    <input
                      type="number"
                      value={commitForm.leadTimeDays}
                      onChange={(e) => setCommitForm({ ...commitForm, leadTimeDays: parseInt(e.target.value, 10) || 7 })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono text-xs focus:outline-none focus:border-[#003049]"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">
                    Effective Revision Date
                  </label>
                  <input
                    type="date"
                    required
                    value={commitForm.effectiveDate}
                    onChange={(e) => setCommitForm({ ...commitForm, effectiveDate: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-[#003049]"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">
                    Quote / Tariff Ref #
                  </label>
                  <input
                    type="text"
                    required
                    value={commitForm.quoteRef}
                    onChange={(e) => setCommitForm({ ...commitForm, quoteRef: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-[#003049]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Revision Reason & Market Context
                </label>
                <textarea
                  rows={2}
                  required
                  value={commitForm.reason}
                  onChange={(e) => setCommitForm({ ...commitForm, reason: e.target.value })}
                  placeholder="Explain reason for price modification, benchmark adjustment or inflationary update..."
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-[#003049]"
                />
              </div>

              {/* Volume Ranges / Quantity Breaks section (Fully Editable, Addable, Deletable) */}
              <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50 space-y-2">
                <div className="font-semibold text-slate-700 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#003049]" />
                    <span>Volume Pricing & Quantity Breaks ({commitForm.selectedRanges.length})</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] text-slate-400 hidden sm:inline">Every range can be edited, added or deleted</span>
                    <button
                      type="button"
                      onClick={handleAddNewRangeToCommit}
                      className="px-2 py-0.5 bg-[#003049] hover:bg-[#002235] text-white rounded text-[11px] font-semibold flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                      title="Add a new volume pricing tier range"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ Add Range</span>
                    </button>
                  </div>
                </div>

                {commitForm.selectedRanges.length > 0 ? (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                    {commitForm.selectedRanges.map((rng, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-wrap items-center gap-1.5 text-[11px] p-1.5 rounded border transition-colors ${
                          rng.selected ? 'bg-white border-slate-300 shadow-2xs' : 'bg-slate-100/70 border-slate-200 opacity-60'
                        }`}
                      >
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={rng.selected}
                          onChange={(e) => handleUpdateRangeField(idx, 'selected', e.target.checked)}
                          className="rounded text-[#003049] cursor-pointer"
                          title="Toggle tier active status"
                        />

                        {/* Quantity Range Inputs: Min Qty - Max Qty */}
                        <div className="flex items-center space-x-1 shrink-0 bg-slate-50 px-1 py-0.5 rounded border border-slate-200">
                          <span className="text-[10px] text-slate-400">Qty:</span>
                          <input
                            type="number"
                            min="1"
                            value={rng.minQty}
                            onChange={(e) => handleUpdateRangeField(idx, 'minQty', e.target.value)}
                            className="w-11 px-1 py-0.5 text-center border border-slate-300 rounded font-mono text-[11px] bg-white text-slate-800"
                            title="Minimum quantity threshold"
                          />
                          <span className="text-slate-400">–</span>
                          <input
                            type="number"
                            min={rng.minQty}
                            placeholder="+"
                            value={rng.maxQty ?? ''}
                            onChange={(e) => handleUpdateRangeField(idx, 'maxQty', e.target.value)}
                            className="w-11 px-1 py-0.5 text-center border border-slate-300 rounded font-mono text-[11px] bg-white text-slate-800"
                            title="Maximum quantity threshold (leave blank for unlimited +)"
                          />
                        </div>

                        {/* Label input */}
                        <input
                          type="text"
                          value={rng.label}
                          onChange={(e) => handleUpdateRangeField(idx, 'label', e.target.value)}
                          placeholder="Tier description"
                          className="flex-1 min-w-[90px] px-1.5 py-0.5 border border-slate-300 rounded font-sans text-[11px] bg-white text-slate-800 focus:outline-none focus:border-[#003049]"
                          title="Custom label for this tier"
                        />

                        {/* Unit Price input with currency symbol */}
                        <div className="flex items-center space-x-1 shrink-0">
                          <span className="text-slate-400 text-[10px]">Price:</span>
                          <div className="relative">
                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 font-mono text-slate-500 text-[10px] pointer-events-none">
                              {getCurrencySymbol(commitForm.currency)}
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              value={rng.newPrice}
                              onChange={(e) => handleUpdateRangeField(idx, 'newPrice', e.target.value)}
                              className="w-20 pl-4 pr-1 py-0.5 border border-slate-300 rounded font-mono text-[11px] bg-white text-slate-900 font-semibold focus:outline-none focus:border-[#003049]"
                            />
                          </div>
                        </div>

                        {/* Discount % input */}
                        <div className="flex items-center space-x-0.5 shrink-0">
                          <span className="text-slate-400 text-[10px]">Disc:</span>
                          <input
                            type="number"
                            step="0.1"
                            value={rng.discountPct}
                            onChange={(e) => handleUpdateRangeField(idx, 'discountPct', e.target.value)}
                            className="w-12 px-1 py-0.5 border border-slate-300 rounded font-mono text-[11px] bg-white text-slate-800 text-right focus:outline-none focus:border-[#003049]"
                          />
                          <span className="text-slate-500 text-[10px]">%</span>
                        </div>

                        {/* Delete Range Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteRangeFromCommit(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer shrink-0 ml-auto"
                          title={`Delete quantity tier "${rng.label}"`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-4 text-center bg-white rounded border border-dashed border-slate-300 p-3 space-y-1.5">
                    <p className="text-[11px] text-slate-500">
                      No quantity tiers defined for this offering yet.
                    </p>
                    <button
                      type="button"
                      onClick={handleAddNewRangeToCommit}
                      className="px-2.5 py-1 bg-[#003049] text-white rounded text-[11px] font-semibold cursor-pointer inline-flex items-center space-x-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ Add First Quantity Tier</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedQuoteForCommit(null)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#003049] hover:bg-[#002235] text-white rounded font-medium cursor-pointer shadow-xs"
                >
                  Save & Commit Revision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD COMPETITOR COLUMN DIALOG */}
      {isAddCompetitorModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#003049] text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Plus className="w-4 h-4 text-[#fdf0d5]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Add Competitor Column to Comparison Matrix
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCompetitorModalOpen(false)}
                className="text-white/70 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCompetitorSubmit} className="p-4 space-y-3.5 text-xs">
              {/* Mode Toggle */}
              <div className="flex rounded border border-slate-200 p-0.5 bg-slate-100">
                <button
                  type="button"
                  onClick={() => setAddCompetitorMode('existing')}
                  className={`flex-1 py-1 text-center font-medium rounded ${
                    addCompetitorMode === 'existing' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Select from Registry ({competitors.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAddCompetitorMode('create_new')}
                  className={`flex-1 py-1 text-center font-medium rounded ${
                    addCompetitorMode === 'create_new' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  + Create New Competitor
                </button>
              </div>

              {addCompetitorMode === 'existing' ? (
                <div>
                  <label className="block text-slate-600 font-medium mb-1">
                    Select Registered Competitor / Benchmark
                  </label>
                  <select
                    required
                    value={selectedCompetitorId}
                    onChange={(e) => {
                      setSelectedCompetitorId(e.target.value);
                      const c = competitors.find((comp) => comp.id === e.target.value);
                      if (c) {
                        setNewCompetitorForm({
                          ...newCompetitorForm,
                          name: c.name,
                          country: c.country || 'United States',
                          marketTier: c.marketTier || 'Primary Competitor'
                        });
                      }
                    }}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-[#003049]"
                  >
                    <option value="">-- Choose Competitor --</option>
                    {competitors.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.marketTier || 'Competitor'} • {c.country || 'Global'})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Competitor Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Apex Industrial Dynamics"
                        value={newCompetitorForm.name}
                        onChange={(e) => setNewCompetitorForm({ ...newCompetitorForm, name: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-[#003049]"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Country</label>
                      <input
                        type="text"
                        value={newCompetitorForm.country}
                        onChange={(e) => setNewCompetitorForm({ ...newCompetitorForm, country: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-[#003049]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Market Tier</label>
                    <select
                      value={newCompetitorForm.marketTier}
                      onChange={(e) => setNewCompetitorForm({ ...newCompetitorForm, marketTier: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-[#003049]"
                    >
                      <option value="Primary Competitor">Primary Competitor</option>
                      <option value="Market Leader">Market Leader</option>
                      <option value="Market Benchmark">Market Benchmark</option>
                      <option value="Low-Cost Challenger">Low-Cost Challenger</option>
                      <option value="Premium Rival">Premium Rival</option>
                      <option value="Regional Specialist">Regional Specialist</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Currency & Parameters */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Currency Type</label>
                  <select
                    value={newCompetitorForm.currency}
                    onChange={(e) => setNewCompetitorForm({ ...newCompetitorForm, currency: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-semibold text-xs text-slate-800 bg-white focus:outline-none focus:border-[#003049]"
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">
                    Quoted Price ({item.unit || 'unit'})
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-slate-500 font-bold text-xs pointer-events-none">
                      {getCurrencySymbol(newCompetitorForm.currency)}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={newCompetitorForm.startingPrice}
                      onChange={(e) => {
                        const newBase = parseFloat(e.target.value) || 0;
                        const updated = (newCompetitorForm.volumeTiers || []).map((t) => ({
                          ...t,
                          unitPrice: Number((newBase * (1 - (t.discountPct || 0) / 100)).toFixed(2))
                        }));
                        setNewCompetitorForm({ ...newCompetitorForm, startingPrice: newBase, volumeTiers: updated });
                      }}
                      className="w-full pl-6 pr-2.5 py-1.5 border border-slate-300 rounded font-mono text-xs focus:outline-none focus:border-[#003049]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">MOQ</label>
                  <input
                    type="number"
                    value={newCompetitorForm.moq}
                    onChange={(e) => setNewCompetitorForm({ ...newCompetitorForm, moq: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono text-xs focus:outline-none focus:border-[#003049]"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Lead Time (Days)</label>
                  <input
                    type="number"
                    value={newCompetitorForm.leadTimeDays}
                    onChange={(e) => setNewCompetitorForm({ ...newCompetitorForm, leadTimeDays: parseInt(e.target.value, 10) || 7 })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono text-xs focus:outline-none focus:border-[#003049]"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Quote Reference #</label>
                  <input
                    type="text"
                    required
                    value={newCompetitorForm.quoteRef}
                    onChange={(e) => setNewCompetitorForm({ ...newCompetitorForm, quoteRef: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-[#003049]"
                  />
                </div>
              </div>

              {/* Volume Pricing & Quantity Breaks Section (Editable, Addable, Deletable) */}
              <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50 space-y-2">
                <div className="font-semibold text-slate-700 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#003049]" />
                    <span>Volume Pricing & Quantity Breaks ({(newCompetitorForm.volumeTiers || []).length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddNewTierToAddCompetitor}
                    className="px-2 py-0.5 bg-[#003049] hover:bg-[#002235] text-white rounded text-[11px] font-semibold flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Add Range</span>
                  </button>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
                  {(newCompetitorForm.volumeTiers || []).map((tier, idx) => (
                    <div
                      key={idx}
                      className="flex flex-wrap items-center gap-1.5 text-[11px] p-1.5 rounded border bg-white border-slate-300 shadow-2xs"
                    >
                      <div className="flex items-center space-x-1 shrink-0 bg-slate-50 px-1 py-0.5 rounded border border-slate-200">
                        <span className="text-[10px] text-slate-400">Qty:</span>
                        <input
                          type="number"
                          min="1"
                          value={tier.minQty}
                          onChange={(e) => handleUpdateTierInAddCompetitor(idx, 'minQty', e.target.value)}
                          className="w-11 px-1 py-0.5 text-center border border-slate-300 rounded font-mono text-[11px] bg-white text-slate-800"
                        />
                        <span className="text-slate-400">–</span>
                        <input
                          type="number"
                          min={tier.minQty}
                          placeholder="+"
                          value={tier.maxQty ?? ''}
                          onChange={(e) => handleUpdateTierInAddCompetitor(idx, 'maxQty', e.target.value)}
                          className="w-11 px-1 py-0.5 text-center border border-slate-300 rounded font-mono text-[11px] bg-white text-slate-800"
                        />
                      </div>

                      <input
                        type="text"
                        value={tier.label}
                        onChange={(e) => handleUpdateTierInAddCompetitor(idx, 'label', e.target.value)}
                        placeholder="Tier description"
                        className="flex-1 min-w-[75px] px-1.5 py-0.5 border border-slate-300 rounded font-sans text-[11px] bg-white text-slate-800 focus:outline-none focus:border-[#003049]"
                      />

                      <div className="flex items-center space-x-1 shrink-0">
                        <span className="text-slate-400 text-[10px]">Price:</span>
                        <div className="relative">
                          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 font-mono text-slate-500 text-[10px] pointer-events-none">
                            {getCurrencySymbol(newCompetitorForm.currency)}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            value={tier.unitPrice}
                            onChange={(e) => handleUpdateTierInAddCompetitor(idx, 'unitPrice', e.target.value)}
                            className="w-18 pl-4 pr-1 py-0.5 border border-slate-300 rounded font-mono text-[11px] bg-white text-slate-900 font-semibold focus:outline-none focus:border-[#003049]"
                          />
                        </div>
                      </div>

                      <div className="flex items-center space-x-0.5 shrink-0">
                        <span className="text-slate-400 text-[10px]">Disc:</span>
                        <input
                          type="number"
                          step="0.1"
                          value={tier.discountPct}
                          onChange={(e) => handleUpdateTierInAddCompetitor(idx, 'discountPct', e.target.value)}
                          className="w-11 px-1 py-0.5 border border-slate-300 rounded font-mono text-[11px] bg-white text-slate-800 text-right focus:outline-none focus:border-[#003049]"
                        />
                        <span className="text-slate-500 text-[10px]">%</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteTierFromAddCompetitor(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer shrink-0 ml-auto"
                        title="Delete tier"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddCompetitorModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#003049] hover:bg-[#002235] text-white rounded font-medium cursor-pointer shadow-xs"
                >
                  Add Competitor Column
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: VIEW VOLUME PRICING BREAKS & RANGES (View button) */}
      {viewingRangesEntity && (() => {
        const entityCurr = viewingRangesEntity.currency || activeCurrency;
        const currSym = getCurrencySymbol(entityCurr);
        return (
          <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-[#003049] text-white px-4 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-[#fdf0d5]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    Volume Price Ranges: {viewingRangesEntity.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingRangesEntity(null)}
                  className="text-white/70 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Standard Base Rate ({entityCurr})</span>
                    <span className="text-sm font-bold font-mono text-[#003049]">
                      {currSym}{viewingRangesEntity.basePrice.toFixed(2)} / {item.unit || 'unit'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Base MOQ</span>
                    <span className="text-xs font-semibold text-slate-800 font-mono">
                      {viewingRangesEntity.moq} {item.unit || 'unit'}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Quantity Brackets & Discount Tiers</span>
                    <span className="text-[10px] font-mono text-slate-400">{entityCurr}</span>
                  </h4>
                  <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                    {viewingRangesEntity.tiers.map((t, idx) => (
                      <div key={idx} className="p-2 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <div className="font-semibold text-slate-800">{t.label}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Quantity: {t.minQty} {t.maxQty ? `– ${t.maxQty}` : '+'} {item.unit || 'units'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold font-mono text-[#003049]">
                            {currSym}{t.unitPrice.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-emerald-600 font-semibold">
                            {t.discountPct > 0 ? `-${t.discountPct}% Discount` : 'Base Tier (0%)'}
                          </div>
                        </div>
                      </div>
                    ))}
                    {viewingRangesEntity.tiers.length === 0 && (
                      <div className="p-3 text-center text-slate-400 text-[11px]">
                        No volume break tiers configured for this quote.
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      const quoteToEdit = quotes.find((q) => q.competitorName === viewingRangesEntity.name);
                      const isOur = viewingRangesEntity.isOur ?? (viewingRangesEntity.name.toLowerCase().includes('our') || viewingRangesEntity.name.toLowerCase().includes('in-house'));
                      setViewingRangesEntity(null);
                      handleOpenCommitPrice(isOur, quoteToEdit);
                    }}
                    className="px-3 py-1.5 bg-[#003049] hover:bg-[#002235] text-white rounded font-medium cursor-pointer flex items-center space-x-1.5 shadow-2xs text-xs"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit Ranges & Rates</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingRangesEntity(null)}
                    className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-medium cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL 4: VIEW CHANGES / AUDIT DIFF MODAL */}
      {activeAuditModal && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#003049] text-white px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <Eye className="w-4 h-4 text-[#fdf0d5]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Audit Diff Inspection: {activeAuditModal.date === 'all' ? 'All Revision Dates' : `Date: ${activeAuditModal.date}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveAuditModal(null)}
                className="text-white/70 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3 text-xs">
              <div className="text-[11px] text-slate-500 pb-1 border-b border-slate-100 flex items-center justify-between">
                <span>Item: <strong className="text-slate-800">{item.code} - {item.name}</strong></span>
                <span>Unit: <strong className="text-slate-800">{item.unit || 'unit'}</strong></span>
              </div>

              {/* Show Our Price Revision Diff if relevant */}
              {(activeAuditModal.targetQuoteId === null || activeAuditModal.targetQuoteId === 'our') && (
                <div className="border border-blue-200 rounded-lg p-3 bg-blue-50/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#003049] uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                      <Star className="w-3.5 h-3.5 text-amber-500" />
                      <span>Our Quoted Selling Rate</span>
                    </span>
                    <span className="text-[10px] bg-white text-slate-600 px-1.5 py-0.5 rounded border border-blue-200 font-mono">
                      Current: ${ourPrice.toFixed(2)}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {ourPriceHistory
                      .filter((h) => activeAuditModal.date === 'all' || h.date === activeAuditModal.date)
                      .map((h, idx) => (
                        <div key={idx} className="bg-white p-2 rounded border border-slate-200 text-xs">
                          <div className="flex items-center justify-between text-slate-800 font-medium">
                            <span className="font-mono text-slate-500">{h.date} • Ref: {h.quoteRef || 'STD'}</span>
                            <span className="font-bold font-mono text-[#003049]">
                              ${h.price.toFixed(2)} ({h.changePct !== undefined && h.changePct !== 0 ? `${h.changePct > 0 ? '+' : ''}${h.changePct}%` : 'Baseline'})
                            </span>
                          </div>
                          <div className="text-slate-600 mt-1">{h.reason}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Updated by: {h.updatedBy}</div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Show Competitor Revision Diffs */}
              {quotes
                .filter((q) => activeAuditModal.targetQuoteId === null || activeAuditModal.targetQuoteId === q.id)
                .map((q) => {
                  const matchingHist = (q.priceHistory || []).filter(
                    (h) => activeAuditModal.date === 'all' || ((h.revisionDate || (h as any).date || '').slice(0, 10) === activeAuditModal.date)
                  );

                  if (matchingHist.length === 0) return null;

                  return (
                    <div key={q.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>{q.competitorName}</span>
                        </span>
                        <span className="text-[10px] bg-white text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                          Current: ${Number(q.currentPrice).toFixed(2)}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {matchingHist.map((h, idx) => (
                          <div key={idx} className="bg-white p-2 rounded border border-slate-200 text-xs">
                            <div className="flex items-center justify-between text-slate-800 font-medium">
                              <span className="font-mono text-slate-500">
                                {(h.revisionDate || (h as any).date || '').slice(0, 10)} • Ref: {h.quoteRef || 'QT'}
                              </span>
                              <span className="font-bold font-mono text-slate-900">
                                ${Number(h.price).toFixed(2)}{' '}
                                {h.previousPrice !== undefined && (
                                  <span className="text-slate-400 font-normal line-through ml-1">
                                    ${Number(h.previousPrice).toFixed(2)}
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="text-slate-600 mt-1">{h.reason}</div>
                            {h.appliedChangesSummary && h.appliedChangesSummary.length > 0 && (
                              <ul className="mt-1 list-disc list-inside text-[11px] text-slate-500">
                                {h.appliedChangesSummary.map((sum, sIdx) => (
                                  <li key={sIdx}>{sum}</li>
                                ))}
                              </ul>
                            )}
                            <div className="text-[10px] text-slate-400 mt-0.5">Recorded by: {h.updatedBy || 'Pricing Analyst'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setActiveAuditModal(null)}
                className="px-4 py-1.5 bg-[#003049] text-white rounded text-xs font-medium hover:bg-[#002235] cursor-pointer"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
