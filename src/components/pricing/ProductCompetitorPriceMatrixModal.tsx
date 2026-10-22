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
  ExternalLink
} from 'lucide-react';
import {
  RevenueItem,
  ProduceItem,
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
}

export const ProductCompetitorPriceMatrixModal: React.FC<ProductCompetitorPriceMatrixModalProps> = ({
  item,
  itemType = 'revenue_item',
  onClose,
  onUpdateOurPrice,
  currentUser
}) => {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [quotes, setQuotes] = useState<ProductCompetitorQuote[]>([]);
  const [history, setHistory] = useState<ProductCompetitorPriceHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'matrix' | 'history'>('matrix');

  // Our Offering Rate States
  const [ourPrice, setOurPrice] = useState<number>(item.ourPrice || 100);
  const [ourCost, setOurCost] = useState<number>(item.ourCost || 65);
  const [isEditingOurRates, setIsEditingOurRates] = useState(false);
  const [ourPriceInput, setOurPriceInput] = useState(String(item.ourPrice || 100));
  const [ourCostInput, setOurCostInput] = useState(String(item.ourCost || 65));

  // Edit Competitor Price & Ranges Modal State
  const [editingQuote, setEditingQuote] = useState<ProductCompetitorQuote | null>(null);
  const [editPrice, setEditPrice] = useState<number>(100);
  const [editEffectiveDate, setEditEffectiveDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [editQuoteRef, setEditQuoteRef] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('Market Price Alignment');
  const [editTiers, setEditTiers] = useState<VolumePriceTier[]>([]);
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);

  // Add Competitor Quote Modal State
  const [isAddCompetitorOpen, setIsAddCompetitorOpen] = useState(false);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>('');
  const [newCompetitorName, setNewCompetitorName] = useState<string>('');
  const [newQuotePrice, setNewQuotePrice] = useState<number>(100);
  const [newQuoteNotes, setNewQuoteNotes] = useState<string>('');

  // Selected history record for audit diff inspection
  const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<ProductCompetitorPriceHistoryRecord | null>(null);

  // Fetch data on mount
  const loadData = async () => {
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
    } catch (err) {
      console.error('Failed to load competitor matrix data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [item.id]);

  // Our Offering Margin
  const ourMarginPct = useMemo(() => {
    if (ourPrice <= 0) return 0;
    return Number((((ourPrice - ourCost) / ourPrice) * 100).toFixed(1));
  }, [ourPrice, ourCost]);

  // Handle Save Our Rates
  const handleSaveOurRates = () => {
    const p = parseFloat(ourPriceInput) || 0;
    const c = parseFloat(ourCostInput) || 0;
    setOurPrice(p);
    setOurCost(c);
    setIsEditingOurRates(false);
    if (onUpdateOurPrice) {
      onUpdateOurPrice(p, c);
    }
  };

  // Open Edit Price / Ranges Modal for a competitor
  const handleOpenEditPrice = (quote: ProductCompetitorQuote) => {
    const p = quote.competitorPrice ?? quote.currentPrice ?? 0;
    setEditingQuote(quote);
    setEditPrice(p);
    setEditEffectiveDate(new Date().toISOString().slice(0, 10));
    setEditQuoteRef(`COMP-${item.code}-${Date.now().toString().slice(-4)}`);
    setEditReason('Quarterly Benchmark Update');

    // Clone or generate default volume tiers
    if (quote.volumePricing && quote.volumePricing.length > 0) {
      setEditTiers(JSON.parse(JSON.stringify(quote.volumePricing)));
    } else {
      setEditTiers([
        { minQty: 1, maxQty: 100, unitPrice: p, discountPct: 0, label: '1 - 100 (Standard)' },
        { minQty: 101, maxQty: 500, unitPrice: Number((p * 0.95).toFixed(2)), discountPct: 5, label: '101 - 500 (Mid Tier)' },
        { minQty: 501, maxQty: 2000, unitPrice: Number((p * 0.90).toFixed(2)), discountPct: 10, label: '501 - 2000 (Bulk Order)' }
      ]);
    }
  };

  // Add range row to editing tiers
  const handleAddRangeRow = () => {
    const lastTier = editTiers[editTiers.length - 1];
    const nextStart = lastTier ? (lastTier.maxQty || lastTier.minQty) + 1 : 1;
    const nextEnd = nextStart + 500;
    const nextDiscount = lastTier ? Math.min(30, (lastTier.discountPct || 0) + 5) : 5;
    const calcPrice = Number((editPrice * (1 - nextDiscount / 100)).toFixed(2));

    setEditTiers([
      ...editTiers,
      {
        minQty: nextStart,
        maxQty: nextEnd,
        unitPrice: calcPrice,
        discountPct: nextDiscount,
        label: `${nextStart} - ${nextEnd} (Tier ${editTiers.length + 1})`
      }
    ]);
  };

  // Update a tier row
  const handleUpdateTierRow = (index: number, field: keyof VolumePriceTier, value: any) => {
    const updated = [...editTiers];
    const current = { ...updated[index], [field]: value };

    // Recompute unitPrice if discountPct changes
    if (field === 'discountPct') {
      const disc = parseFloat(value) || 0;
      current.unitPrice = Number((editPrice * (1 - disc / 100)).toFixed(2));
    }
    // Recompute discountPct if unitPrice changes
    if (field === 'unitPrice') {
      const up = parseFloat(value) || 0;
      current.discountPct = editPrice > 0 ? Number((((editPrice - up) / editPrice) * 100).toFixed(1)) : 0;
    }

    current.label = `${current.minQty} - ${current.maxQty || '+'} pcs (${current.discountPct}% off)`;
    updated[index] = current;
    setEditTiers(updated);
  };

  // Remove a tier row
  const handleRemoveTierRow = (index: number) => {
    setEditTiers(editTiers.filter((_, i) => i !== index));
  };

  // Commit Competitor Price Change to PostgreSQL
  const handleCommitPriceChange = async () => {
    if (!editingQuote) return;
    setIsSubmittingRevision(true);

    try {
      const commitPayload = {
        newPrice: Number(editPrice),
        effectiveDate: editEffectiveDate,
        reason: editReason,
        quoteRef: editQuoteRef,
        volumePricing: editTiers,
        updatedBy: currentUser?.name || 'Commercial Analyst'
      };

      const updated = await api.commitProductCompetitorPrice(item.id, editingQuote.id, commitPayload);

      // Refresh list
      await loadData();
      setEditingQuote(null);
    } catch (err: any) {
      alert(`Failed to commit price change: ${err?.message || 'Server error'}`);
    } finally {
      setIsSubmittingRevision(false);
    }
  };

  // Add a new competitor quote
  const handleCreateCompetitorQuote = async () => {
    let compName = newCompetitorName.trim();
    if (selectedCompetitorId && selectedCompetitorId !== 'new') {
      const matched = competitors.find((c) => c.id === selectedCompetitorId);
      if (matched) compName = matched.name;
    }

    if (!compName) {
      alert('Please select or enter a competitor name');
      return;
    }

    try {
      const baseP = Number(newQuotePrice) || ourPrice;
      const initialTiers: VolumePriceTier[] = [
        { minQty: 1, maxQty: 100, unitPrice: baseP, discountPct: 0, label: '1 - 100 (Standard)' },
        { minQty: 101, maxQty: 500, unitPrice: Number((baseP * 0.95).toFixed(2)), discountPct: 5, label: '101 - 500 (Volume)' }
      ];

      await api.createProductCompetitorQuote(item.id, {
        itemType: (itemType as 'product' | 'service' | 'produce' | 'revenue_item') || 'revenue_item',
        competitorId: selectedCompetitorId !== 'new' ? selectedCompetitorId : undefined,
        competitorName: compName,
        competitorPrice: baseP,
        volumePricing: initialTiers,
        notes: newQuoteNotes
      });

      await loadData();
      setIsAddCompetitorOpen(false);
      setNewCompetitorName('');
      setSelectedCompetitorId('');
      setNewQuoteNotes('');
    } catch (err: any) {
      alert(`Failed to add competitor quote: ${err?.message || 'Server error'}`);
    }
  };

  // Delete a competitor quote
  const handleDeleteQuote = async (quote: ProductCompetitorQuote) => {
    if (!confirm(`Are you sure you want to remove competitor benchmark "${quote.competitorName}"?`)) return;
    try {
      await api.deleteProductCompetitorQuote(item.id, quote.id);
      await loadData();
    } catch (err: any) {
      alert(`Failed to delete competitor quote: ${err?.message || 'Server error'}`);
    }
  };

  // Export full competitor comparison CSV
  const handleExportCSV = () => {
    const headers = [
      'Product / Service Code',
      'Item Name',
      'Category',
      'Unit',
      'Our Selling Price',
      'Our Direct Cost',
      'Our Target Margin %',
      'Competitor Name',
      'Competitor Quoted Rate',
      'Price Spread ($)',
      'Spread vs Our Rate (%)',
      'Position',
      'Active Tiers Count',
      'Tier 1 (1-100)',
      'Tier 2 (101-500)',
      'Tier 3 (501+)',
      'Last Revision Date'
    ];

    const rows = quotes.map((q) => {
      const p = q.competitorPrice ?? q.currentPrice ?? 0;
      return [
        item.code,
        item.name,
        item.category || 'Direct Offering',
        item.unit || 'pcs',
        `$${Number(ourPrice || 0).toFixed(2)}`,
        `$${Number(ourCost || 0).toFixed(2)}`,
        `${ourMarginPct}%`,
        q.competitorName,
        `$${Number(p ?? 0).toFixed(2)}`,
        `$${Number(q.priceDelta ?? 0).toFixed(2)}`,
        `${Number(q.spreadPct ?? 0)}%`,
        p < ourPrice ? 'Competitor Cheaper' : 'Our Price Cheaper',
        q.volumePricing?.length || 0,
        q.volumePricing?.[0]?.unitPrice != null ? `$${Number(q.volumePricing[0].unitPrice).toFixed(2)}` : 'N/A',
        q.volumePricing?.[1]?.unitPrice != null ? `$${Number(q.volumePricing[1].unitPrice).toFixed(2)}` : 'N/A',
        q.volumePricing?.[2]?.unitPrice != null ? `$${Number(q.volumePricing[2].unitPrice).toFixed(2)}` : 'N/A',
        q.lastUpdatedDate || q.effectiveDate || q.lastQuotedDate || 'N/A'
      ];
    });

    downloadCSV(
      `${item.code}_Competitor_Rate_Comparison_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-7xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Top Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-cyan-950/80 text-cyan-300 border border-cyan-700/50">
                  {item.code}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase tracking-wider">
                  {item.type === 'service' ? 'Revenue Service' : 'Direct Product'}
                </span>
                <h2 className="text-lg font-bold text-white tracking-tight">{item.name}</h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Competitor Benchmark Matrix &amp; Multi-Tier Volume Pricing ({item.category || 'General'}) • Category Base Unit: <span className="text-cyan-400 font-semibold">{item.unit || 'pcs'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* View Tabs */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveTab('matrix')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  activeTab === 'matrix'
                    ? 'bg-cyan-500 text-slate-950 shadow-md font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                Comparison Matrix
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  activeTab === 'history'
                    ? 'bg-cyan-500 text-slate-950 shadow-md font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                Revision History ({history.length})
              </button>
            </div>

            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors flex items-center gap-1.5"
              title="Export Comparison to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'matrix' ? (
            <>
              {/* Context Summary Bar */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Our Quoted Selling Rate</span>
                    <span className="text-xl font-bold text-emerald-400">${Number(ourPrice || 0).toFixed(2)}</span>
                    <span className="text-[11px] text-slate-500 block">per {item.unit || 'unit'}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Our Internal Cost</span>
                    <span className="text-xl font-bold text-amber-400">${Number(ourCost || 0).toFixed(2)}</span>
                    <span className="text-[11px] text-slate-500 block">COGS / direct service cost</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Layers className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Target Gross Margin</span>
                    <span className={`text-xl font-bold ${ourMarginPct >= 25 ? 'text-cyan-400' : 'text-rose-400'}`}>
                      {ourMarginPct}%
                    </span>
                    <span className="text-[11px] text-slate-500 block">${(Number(ourPrice || 0) - Number(ourCost || 0)).toFixed(2)} gross profit</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <Percent className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Competitor Benchmarks</span>
                    <span className="text-xl font-bold text-white">{quotes.length} Quotes</span>
                    <span className="text-[11px] text-slate-500 block">PostgreSQL active records</span>
                  </div>
                  <button
                    onClick={() => setIsAddCompetitorOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Benchmark
                  </button>
                </div>
              </div>

              {/* Main Matrix: Our Rate vs Competitor Benchmarks (FXTT Multi-Column View) */}
              <div className="bg-slate-950/40 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
                <div className="px-5 py-3.5 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-semibold text-white tracking-wide uppercase">
                      Commercial Competitor Comparison Matrix (FXTT Protocol)
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400">
                    Products &amp; Revenue Services have no vendors — only our offering rates and market competitor benchmarks.
                  </span>
                </div>

                {loading ? (
                  <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
                    <span>Loading PostgreSQL competitor rates and volume tiers...</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/90 text-xs text-slate-400 uppercase tracking-wider font-semibold">
                          <th className="py-3 px-4 w-48 sticky left-0 bg-slate-900/95 z-10 border-r border-slate-800">
                            Comparison Dimension
                          </th>
                          {/* Our Rates Column (Highlighted) */}
                          <th className="py-3 px-5 w-64 bg-cyan-950/30 border-r border-cyan-800/40 text-cyan-300">
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <Star className="w-3.5 h-3.5 fill-cyan-400 text-cyan-400" />
                                OUR OFFERING RATE
                              </span>
                              <button
                                onClick={() => setIsEditingOurRates(true)}
                                className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-normal"
                              >
                                Edit
                              </button>
                            </div>
                          </th>
                          {/* Competitor Columns */}
                          {quotes.map((q) => (
                            <th key={q.id} className="py-3 px-5 w-64 border-r border-slate-800 text-slate-200">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-white truncate max-w-[150px]" title={q.competitorName}>
                                  {q.competitorName}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleOpenEditPrice(q)}
                                    className="p-1 hover:bg-slate-800 text-cyan-400 rounded"
                                    title="Edit Competitor Rate & Volume Ranges"
                                  >
                                    <Edit className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteQuote(q)}
                                    className="p-1 hover:bg-rose-950/50 text-rose-400 rounded"
                                    title="Remove Competitor"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-800 text-xs text-slate-300">
                        {/* Row: Base Rate */}
                        <tr className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-slate-400 bg-slate-950/50 sticky left-0 border-r border-slate-800">
                            Base Quoted Price
                          </td>
                          <td className="py-3.5 px-5 bg-cyan-950/20 border-r border-cyan-800/30">
                            <span className="text-base font-bold text-emerald-400">${Number(ourPrice || 0).toFixed(2)}</span>
                            <span className="text-[10px] text-slate-400 block">Our Active Standard Rate</span>
                          </td>
                          {quotes.map((q) => {
                            const compPrice = Number(q.competitorPrice ?? q.currentPrice ?? 0);
                            const isCheaper = compPrice < ourPrice;
                            return (
                              <td key={q.id} className="py-3.5 px-5 border-r border-slate-800">
                                <div className="flex items-baseline gap-2">
                                  <span className="text-base font-bold text-white">${compPrice.toFixed(2)}</span>
                                  <span
                                    className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                      isCheaper
                                        ? 'bg-rose-950/80 text-rose-300 border border-rose-800/50'
                                        : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
                                    }`}
                                  >
                                    {isCheaper ? 'Comp Lower' : 'Our Price Lower'}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                  Ref: {q.quoteRef || 'Benchmark'}
                                </span>
                              </td>
                            );
                          })}
                        </tr>

                        {/* Row: Price Spread vs Our Rate */}
                        <tr className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-slate-400 bg-slate-950/50 sticky left-0 border-r border-slate-800">
                            Price Spread ($ / %)
                          </td>
                          <td className="py-3.5 px-5 bg-cyan-950/20 border-r border-cyan-800/30 text-slate-400 italic">
                            Baseline Offering (0.0%)
                          </td>
                          {quotes.map((q) => {
                            const diff = Number(q.priceDelta ?? 0);
                            const spread = Number(q.spreadPct ?? 0);
                            const isPositive = diff > 0;
                            return (
                              <td key={q.id} className="py-3.5 px-5 border-r border-slate-800">
                                <div className="flex items-center gap-1.5">
                                  {isPositive ? (
                                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                                  )}
                                  <span className={`font-semibold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {isPositive ? '+' : ''}${diff.toFixed(2)} ({isPositive ? '+' : ''}{spread}%)
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                  {isPositive ? 'Competitor charges premium' : 'Competitor discounts price'}
                                </span>
                              </td>
                            );
                          })}
                        </tr>

                        {/* Row: Volume Tier 1 */}
                        <tr className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-400 bg-slate-950/50 sticky left-0 border-r border-slate-800">
                            Range 1: 1 - 100 pcs
                          </td>
                          <td className="py-3 px-5 bg-cyan-950/20 border-r border-cyan-800/30">
                            <span className="font-semibold text-white">${Number(ourPrice || 0).toFixed(2)}</span>
                            <span className="text-[10px] text-slate-400 ml-1.5">(0% off)</span>
                          </td>
                          {quotes.map((q) => {
                            const t1 = q.volumePricing?.[0];
                            const compBase = Number(q.competitorPrice ?? q.currentPrice ?? 0);
                            const price = Number(t1?.unitPrice != null ? t1.unitPrice : compBase);
                            const disc = Number(t1 ? t1.discountPct : 0);
                            return (
                              <td key={q.id} className="py-3 px-5 border-r border-slate-800">
                                <span className="font-semibold text-white">${price.toFixed(2)}</span>
                                <span className="text-[10px] text-slate-400 ml-1.5">({disc}% off)</span>
                              </td>
                            );
                          })}
                        </tr>

                        {/* Row: Volume Tier 2 */}
                        <tr className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-400 bg-slate-950/50 sticky left-0 border-r border-slate-800">
                            Range 2: 101 - 500 pcs
                          </td>
                          <td className="py-3 px-5 bg-cyan-950/20 border-r border-cyan-800/30">
                            <span className="font-semibold text-emerald-400">${(Number(ourPrice || 0) * 0.95).toFixed(2)}</span>
                            <span className="text-[10px] text-slate-400 ml-1.5">(5% discount)</span>
                          </td>
                          {quotes.map((q) => {
                            const t2 = q.volumePricing?.[1];
                            const compBase = Number(q.competitorPrice ?? q.currentPrice ?? ourPrice);
                            const price = Number(t2?.unitPrice != null ? t2.unitPrice : compBase * 0.95);
                            const disc = Number(t2 ? t2.discountPct : 5);
                            return (
                              <td key={q.id} className="py-3 px-5 border-r border-slate-800">
                                <span className="font-semibold text-cyan-300">${price.toFixed(2)}</span>
                                <span className="text-[10px] text-slate-400 ml-1.5">({disc}% off)</span>
                              </td>
                            );
                          })}
                        </tr>

                        {/* Row: Volume Tier 3 */}
                        <tr className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-400 bg-slate-950/50 sticky left-0 border-r border-slate-800">
                            Range 3: 501+ pcs (Bulk)
                          </td>
                          <td className="py-3 px-5 bg-cyan-950/20 border-r border-cyan-800/30">
                            <span className="font-semibold text-emerald-400">${(Number(ourPrice || 0) * 0.90).toFixed(2)}</span>
                            <span className="text-[10px] text-slate-400 ml-1.5">(10% bulk discount)</span>
                          </td>
                          {quotes.map((q) => {
                            const t3 = q.volumePricing?.[2];
                            const compBase = Number(q.competitorPrice ?? q.currentPrice ?? ourPrice);
                            const price = Number(t3?.unitPrice != null ? t3.unitPrice : compBase * 0.90);
                            const disc = Number(t3 ? t3.discountPct : 10);
                            return (
                              <td key={q.id} className="py-3 px-5 border-r border-slate-800">
                                <span className="font-semibold text-cyan-300">${price.toFixed(2)}</span>
                                <span className="text-[10px] text-slate-400 ml-1.5">({disc}% off)</span>
                              </td>
                            );
                          })}
                        </tr>

                        {/* Row: Minimum Order Qty & Lead Time */}
                        <tr className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-400 bg-slate-950/50 sticky left-0 border-r border-slate-800">
                            MOQ &amp; Delivery SLA
                          </td>
                          <td className="py-3 px-5 bg-cyan-950/20 border-r border-cyan-800/30 text-slate-300">
                            MOQ: 1 unit • SLA: 7 days
                          </td>
                          {quotes.map((q) => (
                            <td key={q.id} className="py-3 px-5 border-r border-slate-800 text-slate-300">
                              MOQ: {q.moq || 1} • SLA: {q.leadTimeDays || 14} days
                            </td>
                          ))}
                        </tr>

                        {/* Row: Last Revision & Effective Date */}
                        <tr className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-400 bg-slate-950/50 sticky left-0 border-r border-slate-800">
                            Last Price Revision
                          </td>
                          <td className="py-3 px-5 bg-cyan-950/20 border-r border-cyan-800/30 text-slate-400">
                            Active in Catalogue
                          </td>
                          {quotes.map((q) => (
                            <td key={q.id} className="py-3 px-5 border-r border-slate-800 text-slate-400">
                              {q.effectiveDate || q.lastUpdatedDate || 'Current'}
                              <span className="text-[10px] block text-cyan-400/80">Ref: {q.quoteRef || 'REV-INIT'}</span>
                            </td>
                          ))}
                        </tr>

                        {/* Row: Actions */}
                        <tr className="bg-slate-900/80">
                          <td className="py-3.5 px-4 font-semibold text-slate-400 bg-slate-950/50 sticky left-0 border-r border-slate-800">
                            Operational Actions
                          </td>
                          <td className="py-3.5 px-5 bg-cyan-950/20 border-r border-cyan-800/30">
                            <button
                              onClick={() => setIsEditingOurRates(true)}
                              className="w-full py-1.5 px-3 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-300 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              Update Our Price
                            </button>
                          </td>
                          {quotes.map((q) => (
                            <td key={q.id} className="py-3.5 px-5 border-r border-slate-800">
                              <button
                                onClick={() => handleOpenEditPrice(q)}
                                className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-xs transition-colors flex items-center justify-center gap-1.5"
                              >
                                <Edit className="w-3.5 h-3.5 text-cyan-400" />
                                Edit Price &amp; Ranges
                              </button>
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Revision History Tab */
            <div className="bg-slate-950/40 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
              <div className="px-5 py-3.5 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-white tracking-wide uppercase">
                    Competitor Price Revisions &amp; Tier Change Log
                  </h3>
                </div>
                <span className="text-xs text-slate-400">
                  Recorded in PostgreSQL table: <code className="text-cyan-400">product_competitor_price_history</code>
                </span>
              </div>

              {history.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <p>No historical revisions recorded for this item yet.</p>
                  <p className="text-xs text-slate-500 mt-1">
                    When you edit competitor rates and click "Commit Price Change", the audit record will be logged here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/90 text-xs text-slate-400 uppercase tracking-wider font-semibold">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Competitor</th>
                        <th className="py-3 px-4">Quote Ref</th>
                        <th className="py-3 px-4 text-right">Previous Price</th>
                        <th className="py-3 px-4 text-right">New Price</th>
                        <th className="py-3 px-4 text-right">Change %</th>
                        <th className="py-3 px-4">Reason / Driver</th>
                        <th className="py-3 px-4">Updated By</th>
                        <th className="py-3 px-4 text-center">Audit Diffs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-xs text-slate-300">
                      {history.map((h) => {
                        const changePctNum = Number(h.changePct || 0);
                        const isUp = changePctNum > 0;
                        const prevPriceNum = h.previousPrice != null ? Number(h.previousPrice) : null;
                        const currentPriceNum = Number(h.price ?? (h as any).newPrice ?? 0);
                        return (
                          <tr key={h.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="py-3 px-4 font-mono text-slate-400">{h.revisionDate}</td>
                            <td className="py-3 px-4 font-semibold text-white">{h.competitorName}</td>
                            <td className="py-3 px-4 text-cyan-400 font-mono text-[11px]">{h.quoteRef || '—'}</td>
                            <td className="py-3 px-4 text-right font-mono text-slate-400">
                              {prevPriceNum != null && !isNaN(prevPriceNum) ? `$${prevPriceNum.toFixed(2)}` : '—'}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-white">
                              ${currentPriceNum.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  isUp
                                    ? 'bg-rose-950/60 text-rose-300 border border-rose-800/40'
                                    : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                                }`}
                              >
                                {isUp ? '+' : ''}{changePctNum}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-300 max-w-xs truncate" title={h.reason}>
                              {h.reason || 'Benchmark calibration'}
                            </td>
                            <td className="py-3 px-4 text-slate-400">{h.updatedBy || 'Analyst'}</td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => setSelectedHistoryRecord(h)}
                                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-medium border border-slate-700"
                              >
                                View Diff
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Persisted in PostgreSQL database <code className="text-cyan-400">inno_cost</code> (schema v3.2.0)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>

      {/* MODAL 1: Edit Our Price / Cost Modal */}
      {isEditingOurRates && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit className="w-4 h-4 text-cyan-400" />
                Update Our Offering Rates
              </h3>
              <button onClick={() => setIsEditingOurRates(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Our Quoted Selling Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={ourPriceInput}
                  onChange={(e) => setOurPriceInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Our Internal Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={ourCostInput}
                  onChange={(e) => setOurCostInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Calculated Margin:</span>
                <span className="text-sm font-bold text-cyan-400">
                  {ourPriceInput && ourCostInput && parseFloat(ourPriceInput) > 0
                    ? `${(((parseFloat(ourPriceInput) - parseFloat(ourCostInput)) / parseFloat(ourPriceInput)) * 100).toFixed(1)}%`
                    : '0%'}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditingOurRates(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveOurRates}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs"
              >
                Apply Rates
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Competitor Price & Ranges Modal (Matches Screenshot_20261022-124641.png) */}
      {editingQuote && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-cyan-400" />
                  Edit Competitor Rate: {editingQuote.competitorName}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Update base quote, bulk range tiers, quote reference, and commit price change to PostgreSQL.
                </p>
              </div>
              <button onClick={() => setEditingQuote(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              {/* Base Price & Reference */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Change Base Quoted Price ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={editPrice}
                      onChange={(e) => {
                        const newP = parseFloat(e.target.value) || 0;
                        setEditPrice(newP);
                        // Recompute tier prices based on their discount percentages
                        setEditTiers(
                          editTiers.map((t) => ({
                            ...t,
                            unitPrice: Number((newP * (1 - (t.discountPct || 0) / 100)).toFixed(2))
                          }))
                        );
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-white font-mono text-sm focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Quote Ref #</label>
                  <input
                    type="text"
                    value={editQuoteRef}
                    onChange={(e) => setEditQuoteRef(e.target.value)}
                    placeholder="e.g. QT-COMP-2026-09"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Effective Date & Driver / Reason */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Effective Date</label>
                  <input
                    type="date"
                    value={editEffectiveDate}
                    onChange={(e) => setEditEffectiveDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Price Change Driver / Reason
                  </label>
                  <select
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="Market Price Alignment">Market Price Alignment</option>
                    <option value="Quarterly Benchmark Calibration">Quarterly Benchmark Calibration</option>
                    <option value="Supplier/Vendor Price Fluctuation">Supplier/Vendor Price Fluctuation</option>
                    <option value="Raw Materials Surcharge">Raw Materials Surcharge</option>
                    <option value="Contract Renegotiation">Contract Renegotiation</option>
                    <option value="Promotional Volume Rate">Promotional Volume Rate</option>
                  </select>
                </div>
              </div>

              {/* Bulk Price Ranges, Range Sizes & Discount Rates */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-200 font-semibold">
                    Bulk Price Ranges, Range Sizes &amp; Discount Rates
                  </label>
                  <button
                    type="button"
                    onClick={handleAddRangeRow}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-400 font-medium text-xs flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Range
                  </button>
                </div>

                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold">
                        <th className="py-2.5 px-3">Start Qty</th>
                        <th className="py-2.5 px-3">End Qty</th>
                        <th className="py-2.5 px-3">Discount %</th>
                        <th className="py-2.5 px-3">Unit Price ($)</th>
                        <th className="py-2.5 px-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {editTiers.map((tier, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40">
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              value={tier.minQty}
                              onChange={(e) => handleUpdateTierRow(idx, 'minQty', parseInt(e.target.value) || 1)}
                              className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              value={tier.maxQty || ''}
                              placeholder="+"
                              onChange={(e) =>
                                handleUpdateTierRow(idx, 'maxQty', e.target.value ? parseInt(e.target.value) : undefined)
                              }
                              className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <div className="relative w-24">
                              <input
                                type="number"
                                step="0.5"
                                value={tier.discountPct || 0}
                                onChange={(e) => handleUpdateTierRow(idx, 'discountPct', parseFloat(e.target.value) || 0)}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-cyan-300 font-mono text-xs pr-6"
                              />
                              <span className="absolute right-2 top-1 text-slate-500">%</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-emerald-400">
                            ${Number(tier.unitPrice ?? 0).toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveTierRow(idx)}
                              className="p-1 text-slate-500 hover:text-rose-400 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Change will be recorded in PostgreSQL audit history
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingQuote(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingRevision}
                  onClick={handleCommitPriceChange}
                  className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md disabled:opacity-50"
                >
                  {isSubmittingRevision ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Committing...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Commit Price Change
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Add Competitor Benchmark Quote */}
      {isAddCompetitorOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-cyan-400" />
                Add Competitor Benchmark
              </h3>
              <button onClick={() => setIsAddCompetitorOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Select Competitor</label>
                <select
                  value={selectedCompetitorId}
                  onChange={(e) => setSelectedCompetitorId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="">-- Choose Existing Competitor --</option>
                  {competitors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.country ? `(${c.country})` : ''}
                    </option>
                  ))}
                  <option value="new">+ Register New Competitor</option>
                </select>
              </div>

              {selectedCompetitorId === 'new' && (
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Competitor Legal Name</label>
                  <input
                    type="text"
                    value={newCompetitorName}
                    onChange={(e) => setNewCompetitorName(e.target.value)}
                    placeholder="e.g. Apex Industrial Dynamics"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-medium mb-1">Quoted Competitor Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newQuotePrice}
                  onChange={(e) => setNewQuotePrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Benchmark Notes / Specification</label>
                <textarea
                  rows={2}
                  value={newQuoteNotes}
                  onChange={(e) => setNewQuoteNotes(e.target.value)}
                  placeholder="e.g. Sourced from Q3 public catalog; includes delivery."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddCompetitorOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateCompetitorQuote}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs"
              >
                Save Benchmark
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: View History Record Diff Details */}
      {selectedHistoryRecord && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                Revision Diff Details
              </h3>
              <button onClick={() => setSelectedHistoryRecord(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-400 block">Competitor:</span>
                  <span className="font-semibold text-white">{selectedHistoryRecord.competitorName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Revision Date:</span>
                  <span className="font-semibold text-white">{selectedHistoryRecord.revisionDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Price Change:</span>
                  <span className="font-mono text-slate-300">
                    {selectedHistoryRecord.previousPrice != null ? `$${Number(selectedHistoryRecord.previousPrice).toFixed(2)}` : '—'} → ${Number(selectedHistoryRecord.price ?? (selectedHistoryRecord as any).newPrice ?? 0).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Change %:</span>
                  <span className="font-semibold text-cyan-400">{Number(selectedHistoryRecord.changePct || 0)}%</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block mb-1">Reason / Driver:</span>
                <p className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200">
                  {selectedHistoryRecord.reason || 'Benchmark calibration'}
                </p>
              </div>

              {selectedHistoryRecord.appliedChangesSummary && selectedHistoryRecord.appliedChangesSummary.length > 0 && (
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">Applied Changes:</span>
                  <ul className="space-y-1 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                    {selectedHistoryRecord.appliedChangesSummary.map((s, idx) => (
                      <li key={idx} className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedHistoryRecord(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
