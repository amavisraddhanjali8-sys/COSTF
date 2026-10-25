import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Edit,
  Trash2,
  DollarSign,
  History,
  Eye,
  Check,
  AlertTriangle,
  Building2,
  Users,
  Cpu,
  Zap,
  Wrench,
  HardHat,
  Box,
  TrendingUp,
  Scale,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import { EnterpriseResource, Supplier } from '../types';
import { api } from '../services/api';
import { formatCurrency } from '../utils/currency';
import { calcPctChange, round2, round4 } from '../utils/decimalMath';
import { peekNextNumber, generateNextNumber } from '../services/autoNumberingService';

// ============================================================================
// 1. CREATE / EDIT RESOURCE MODAL
// ============================================================================
interface CreateEditResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingResource?: EnterpriseResource | null;
  defaultType?: string;
  suppliers: Supplier[];
  onSaved: (resource: EnterpriseResource) => void;
  showToast: (msg: string) => void;
}

export const CreateEditResourceModal: React.FC<CreateEditResourceModalProps> = ({
  isOpen,
  onClose,
  editingResource,
  defaultType = 'machinery',
  suppliers,
  onSaved,
  showToast
}) => {
  const isEdit = !!editingResource;

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState(defaultType);
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [unit, setUnit] = useState('hr');
  const [baseRate, setBaseRate] = useState<number>(0);
  const [operationalCharge, setOperationalCharge] = useState<number>(0);
  const [chargeType, setChargeType] = useState('hourly');
  const [currency, setCurrency] = useState('LKR');
  const [supplierName, setSupplierName] = useState('');
  const [competitorCompany, setCompetitorCompany] = useState('');
  const [competitorRate, setCompetitorRate] = useState<number>(0);
  const [industryBenchmarkRate, setIndustryBenchmarkRate] = useState<number>(0);
  const [status, setStatus] = useState('Available');
  const [skillOrSla, setSkillOrSla] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (editingResource) {
      setCode(editingResource.code || '');
      setName(editingResource.name || '');
      setType(editingResource.type || defaultType);
      setCategory(editingResource.category || '');
      setSubCategory(editingResource.subCategory || '');
      setUnit(editingResource.unit || 'hr');
      setBaseRate(Number(editingResource.baseRate) || 0);
      setOperationalCharge(Number(editingResource.operationalCharge) || 0);
      setChargeType(editingResource.chargeType || 'hourly');
      setCurrency(editingResource.currency || 'LKR');
      setSupplierName(editingResource.supplierName || '');
      setCompetitorCompany(editingResource.competitorCompany || '');
      setCompetitorRate(Number(editingResource.competitorRate) || 0);
      setIndustryBenchmarkRate(Number(editingResource.industryBenchmarkRate) || 0);
      setStatus(editingResource.status || 'Available');
      setSkillOrSla(editingResource.skillOrSla || '');
      setNotes(editingResource.notes || '');
    } else {
      setCode(peekNextNumber('resources'));
      setName('');
      setType(defaultType);
      setCategory(defaultType === 'machinery' ? 'Heavy Centers' : defaultType === 'labour' ? 'Operations' : 'General');
      setSubCategory('');
      setUnit(defaultType === 'equipment' || defaultType === 'tool' ? 'day' : 'hr');
      setBaseRate(100);
      setOperationalCharge(15);
      setChargeType('hourly');
      setCurrency('LKR');
      setSupplierName(suppliers[0]?.name || 'Internal / Primary');
      setCompetitorCompany('');
      setCompetitorRate(0);
      setIndustryBenchmarkRate(0);
      setStatus('Available');
      setSkillOrSla('Standard SLA');
      setNotes('');
    }
  }, [isOpen, editingResource, defaultType]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Please provide a resource name');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<EnterpriseResource> = {
        code: code.trim(),
        name: name.trim(),
        type,
        category: category.trim() || 'General',
        subCategory: subCategory.trim() || undefined,
        unit: unit.trim() || 'hr',
        baseRate: Number(baseRate) || 0,
        operationalCharge: Number(operationalCharge) || 0,
        chargeType,
        currency: currency || 'LKR',
        supplierName: supplierName.trim() || undefined,
        competitorCompany: competitorCompany.trim() || undefined,
        competitorRate: Number(competitorRate) || 0,
        industryBenchmarkRate: Number(industryBenchmarkRate) || 0,
        status,
        skillOrSla: skillOrSla.trim() || undefined,
        notes: notes.trim()
      };

      let result: EnterpriseResource;
      if (isEdit && editingResource) {
        result = await api.updateResource(editingResource.id, payload);
        showToast(`Resource "${result.name}" updated successfully`);
      } else {
        result = await api.createResource(payload);
        generateNextNumber('resources', true);
        showToast(`Resource "${result.name}" created in PostgreSQL database`);
      }

      onSaved(result);
      onClose();
    } catch (err: any) {
      console.error('Failed to save resource:', err);
      showToast(err?.message || 'Error saving resource');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/40">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-[#0078d4]">
              {isEdit ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {isEdit ? 'Edit Resource' : 'Create Enterprise Resource'}
              </h2>
              <p className="text-[11px] text-slate-500 font-mono">
                PostgreSQL inno_cost central database
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Row 1: Code, Name, Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Resource Code *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#0078d4]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Resource Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g., CAT 320 Hydraulic Excavator"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#0078d4]"
              />
            </div>
          </div>

          {/* Row 2: Type, Category, SubCategory */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Type *
              </label>
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  if (e.target.value === 'equipment' || e.target.value === 'tool') setUnit('day');
                  else if (e.target.value === 'subcontractor') setUnit('sqft');
                  else if (e.target.value === 'material') setUnit('unit');
                  else setUnit('hr');
                }}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#0078d4] cursor-pointer"
              >
                <option value="machinery">Machinery</option>
                <option value="labour">Labour</option>
                <option value="equipment">Equipment</option>
                <option value="tool">Tools</option>
                <option value="subcontractor">Subcontractor</option>
                <option value="material">Materials</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Category *
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Earthmoving & Construction"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#0078d4]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Sub-Category
              </label>
              <input
                type="text"
                placeholder="e.g., Excavators & Crawlers"
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#0078d4]"
              />
            </div>
          </div>

          {/* Row 3: Base Rate, Unit, Currency, Operational Charge */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-blue-50/40 dark:bg-slate-900/60 p-3 rounded-xl border border-blue-100 dark:border-slate-800">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#0078d4] mb-1">
                Rate (LKR) *
              </label>
              <input
                type="number"
                required
                min="0"
                step="any"
                value={baseRate}
                onChange={(e) => setBaseRate(parseFloat(e.target.value) || 0)}
                className="w-full bg-white dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#0078d4]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Unit *
              </label>
              <input
                type="text"
                required
                placeholder="hr, day, sqft"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#0078d4]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Op. Charge (LKR)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={operationalCharge}
                onChange={(e) => setOperationalCharge(parseFloat(e.target.value) || 0)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#0078d4]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Charge Model
              </label>
              <select
                value={chargeType}
                onChange={(e) => setChargeType(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#0078d4] cursor-pointer"
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="fixed">Fixed</option>
                <option value="per_unit">Per Unit</option>
              </select>
            </div>
          </div>

          {/* Row 4: Supplier, Status, Skill/SLA */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Supplier / Provider
              </label>
              <input
                type="text"
                list="suppliers-list-datalist"
                placeholder="e.g. HeavyEquip Rentals"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#0078d4]"
              />
              <datalist id="suppliers-list-datalist">
                {suppliers.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#0078d4] cursor-pointer"
              >
                <option value="Available">Available</option>
                <option value="In Use">In Use</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Reserved">Reserved</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Skill Level / SLA
              </label>
              <input
                type="text"
                placeholder="e.g. Tier-1 Operator / 99.5% Uptime"
                value={skillOrSla}
                onChange={(e) => setSkillOrSla(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#0078d4]"
              />
            </div>
          </div>

          {/* Row 5: Competitor Intelligence Benchmark */}
          <div className="bg-slate-50/70 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center space-x-1">
              <Scale className="w-3.5 h-3.5 text-purple-600" />
              <span>Competitor & Market Benchmark</span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">
                  Competitor Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Global Operators Ltd"
                  value={competitorCompany}
                  onChange={(e) => setCompetitorCompany(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-1">
                  Competitor Rate (LKR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={competitorRate}
                  onChange={(e) => setCompetitorRate(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-1">
                  Market Benchmark (LKR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={industryBenchmarkRate}
                  onChange={(e) => setIndustryBenchmarkRate(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>
          </div>

          {/* Row 6: Notes */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Technical Specifications & Notes
            </label>
            <textarea
              rows={2}
              placeholder="Operational parameters, safety certifications, engine specs, fuel consumption..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#0078d4]"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-[#0078d4] hover:bg-[#006cbd] text-white transition-all shadow-2xs cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Resource'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 2. DELETE CONFIRMATION MODAL
// ============================================================================
interface DeleteResourceConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: EnterpriseResource | null;
  onConfirmed?: () => void;
  onDeleted?: (id: string) => void;
  showToast: (msg: string) => void;
}

export const DeleteResourceConfirmModal: React.FC<DeleteResourceConfirmModalProps> = ({
  isOpen,
  onClose,
  resource,
  onConfirmed,
  onDeleted,
  showToast
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !resource) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.deleteResource(resource.id);
      showToast(`Resource "${resource.name}" [${resource.code}] deleted from PostgreSQL`);
      if (onDeleted) {
        onDeleted(resource.id);
      }
      if (onConfirmed) {
        onConfirmed();
      }
      onClose();
    } catch (err: any) {
      console.error('Delete error:', err);
      showToast(err?.message || 'Failed to delete resource');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center space-x-3 text-rose-600">
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Delete Resource
            </h3>
            <p className="text-xs text-slate-500">
              Permanent removal from central directory
            </p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">Code:</span>
            <span className="font-mono font-bold">{resource.code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Name:</span>
            <span className="font-semibold">{resource.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Rate:</span>
            <span className="font-mono font-bold text-[#0078d4]">
              {formatCurrency(resource.baseRate, resource.currency || 'LKR')} / {resource.unit}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400">
          Are you sure you want to delete this resource? Any historical allocation logs will be preserved.
        </p>

        <div className="flex items-center justify-end space-x-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleDelete}
            className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-2xs flex items-center space-x-1.5 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Deleting...' : 'Confirm Delete'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. RESOURCE DETAILS MODAL
// ============================================================================
interface ResourceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: EnterpriseResource | null;
  onEdit: (resource: EnterpriseResource) => void;
  onPriceChange: (resource: EnterpriseResource) => void;
  onShowPriceHistory: (resource: EnterpriseResource) => void;
}

export const ResourceDetailsModal: React.FC<ResourceDetailsModalProps> = ({
  isOpen,
  onClose,
  resource,
  onEdit,
  onPriceChange,
  onShowPriceHistory
}) => {
  if (!isOpen || !resource) return null;

  const getTypeIcon = (t: string) => {
    switch (t) {
      case 'machinery': return <Cpu className="w-5 h-5 text-indigo-500" />;
      case 'labour': return <Users className="w-5 h-5 text-blue-500" />;
      case 'equipment': return <Zap className="w-5 h-5 text-amber-500" />;
      case 'tool': return <Wrench className="w-5 h-5 text-emerald-500" />;
      case 'subcontractor': return <HardHat className="w-5 h-5 text-purple-500" />;
      default: return <Box className="w-5 h-5 text-slate-500" />;
    }
  };

  const delta = resource.competitorRate ? Number(resource.baseRate) - Number(resource.competitorRate) : 0;
  const spreadPct = resource.competitorRate && Number(resource.competitorRate) > 0
    ? round2((delta / Number(resource.competitorRate)) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/40">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
              {getTypeIcon(resource.type)}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-bold text-slate-500">
                  {resource.code}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  {resource.status || 'Available'}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                {resource.name}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {/* Rate Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900">
              <span className="text-[10px] uppercase font-bold text-[#0078d4]">Current Rate</span>
              <div className="text-base font-mono font-bold text-[#0078d4] mt-1">
                {formatCurrency(resource.baseRate, resource.currency || 'LKR')}
              </div>
              <span className="text-[10px] text-slate-500">per {resource.unit}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-500">Operational</span>
              <div className="text-base font-mono font-bold text-slate-800 dark:text-slate-200 mt-1">
                {formatCurrency(resource.operationalCharge || 0, resource.currency || 'LKR')}
              </div>
              <span className="text-[10px] text-slate-500 capitalize">{resource.chargeType || 'Hourly'}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-500">Market Rate</span>
              <div className="text-base font-mono font-bold text-slate-700 dark:text-slate-300 mt-1">
                {resource.competitorRate ? formatCurrency(resource.competitorRate, resource.currency || 'LKR') : '-'}
              </div>
              <span className="text-[10px] text-slate-500">{resource.competitorCompany || 'Market average'}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-500">Price Spread</span>
              <div className={`text-base font-mono font-bold mt-1 ${spreadPct <= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {spreadPct > 0 ? `+${spreadPct}%` : `${spreadPct}%`}
              </div>
              <span className="text-[10px] text-slate-500">{spreadPct <= 0 ? 'Cost advantage' : 'Premium'}</span>
            </div>
          </div>

          {/* Details Specifications Grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-3.5 rounded-xl bg-slate-50/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Category</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200">{resource.category || '-'}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Sub-Category</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200">{resource.subCategory || '-'}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Supplier / Vendor</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200">{resource.supplierName || 'Primary / Company Direct'}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Skill Level / SLA</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200">{resource.skillOrSla || 'Standard Enterprise SLA'}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Base Currency</span>
              <p className="font-mono font-bold text-slate-800 dark:text-slate-200">{resource.currency || 'LKR'}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Lead Time</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200">{resource.leadTimeDays || 1} day(s)</p>
            </div>
          </div>

          {/* Connected Allocations */}
          {resource.connectedAllocations && resource.connectedAllocations.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Connected Project Allocations ({resource.connectedAllocations.length})
              </span>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {resource.connectedAllocations.map((alloc: any, idx: number) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between bg-white dark:bg-slate-900 text-[11px]">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        Project ID: {alloc.projectId || alloc.project_id}
                      </span>
                      <span className="text-slate-400 ml-2">Phase: {alloc.phaseId || 'General'}</span>
                    </div>
                    <div className="font-mono font-bold text-[#0078d4]">
                      {alloc.quantity} {alloc.unit || 'hr'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {resource.notes && (
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Specifications & Notes</span>
              <p className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 mt-1">
                {resource.notes}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/40">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onShowPriceHistory(resource);
              }}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center space-x-1 cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span>History</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onPriceChange(resource);
              }}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center space-x-1 cursor-pointer shadow-2xs"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Change Rate</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(resource);
              }}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#0078d4] hover:bg-[#006cbd] text-white flex items-center space-x-1 cursor-pointer shadow-2xs"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. RESOURCE PRICE CHANGE / RATE REVISION MODAL
// ============================================================================
interface ResourcePriceChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: EnterpriseResource | null;
  onPriceCommitted: (updated: EnterpriseResource) => void;
  showToast: (msg: string) => void;
}

export const ResourcePriceChangeModal: React.FC<ResourcePriceChangeModalProps> = ({
  isOpen,
  onClose,
  resource,
  onPriceCommitted,
  showToast
}) => {
  const [newRate, setNewRate] = useState<number>(0);
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('Annual contract rate indexation');
  const [updatedBy, setUpdatedBy] = useState('Resource Manager');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (resource && isOpen) {
      setNewRate(Number(resource.baseRate) || 0);
      setEffectiveDate(new Date().toISOString().slice(0, 10));
      setReason('Annual rate revision');
    }
  }, [resource, isOpen]);

  if (!isOpen || !resource) return null;

  const currentRate = Number(resource.baseRate) || 0;
  const delta = newRate - currentRate;
  const pctChange = currentRate > 0 ? calcPctChange(currentRate, newRate) : 0;

  const handleCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newRate <= 0) {
      showToast('Please specify a positive rate');
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await api.commitResourcePrice(resource.id, {
        newRate,
        reason: reason.trim() || 'Resource rate revision via FXTT table',
        effectiveDate,
        updatedBy: updatedBy.trim() || 'Resource Manager',
        currency: resource.currency || 'LKR'
      });

      showToast(`Rate updated to ${formatCurrency(newRate, resource.currency || 'LKR')} for ${resource.name}`);
      onPriceCommitted(updated);
      onClose();
    } catch (err: any) {
      console.error('Failed to commit price:', err);
      showToast(err?.message || 'Failed to commit price revision');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-emerald-50/50 dark:bg-emerald-950/30">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-600 text-white">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Record Rate Revision
              </h3>
              <p className="text-[11px] font-mono text-slate-500">
                {resource.code} • {resource.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCommit} className="p-5 space-y-4 text-xs">
          {/* Current vs New Rate Comparison */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Current Rate</span>
              <div className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                {formatCurrency(currentRate, resource.currency || 'LKR')}
              </div>
              <span className="text-[10px] text-slate-400">per {resource.unit}</span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-600">New Rate</span>
              <div className="text-sm font-mono font-bold text-emerald-600 mt-0.5">
                {formatCurrency(newRate, resource.currency || 'LKR')}
              </div>
              <div className={`text-[10px] font-mono font-bold ${delta >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {delta >= 0 ? `+${formatCurrency(delta, resource.currency || 'LKR')}` : formatCurrency(delta, resource.currency || 'LKR')} ({pctChange > 0 ? `+${pctChange}%` : `${pctChange}%`})
              </div>
            </div>
          </div>

          {/* New Rate Input */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              New Base Rate (LKR) *
            </label>
            <input
              type="number"
              required
              min="0"
              step="any"
              value={newRate}
              onChange={(e) => setNewRate(parseFloat(e.target.value) || 0)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600"
            />
          </div>

          {/* Effective Date */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Effective Date *
            </label>
            <input
              type="date"
              required
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-600"
            />
          </div>

          {/* Change Reason & Quick Tags */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Audit Change Reason *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Fuel escalation, Annual indexation, Supplier rate review"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-600"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {['Annual indexation', 'Contract renewal', 'Market adjustment', 'Supplier escalation'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setReason(tag)}
                  className="px-2 py-0.5 text-[10px] rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 cursor-pointer"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-2xs flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Committing...' : 'Commit Revision'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 5. RESOURCE PRICE HISTORY AUDIT MODAL
// ============================================================================
interface ResourcePriceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: EnterpriseResource | null;
  onOpenPriceChange: (resource: EnterpriseResource) => void;
}

export const ResourcePriceHistoryModal: React.FC<ResourcePriceHistoryModalProps> = ({
  isOpen,
  onClose,
  resource,
  onOpenPriceChange
}) => {
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && resource) {
      setIsLoading(true);
      api.getResourcePriceHistory(resource.id)
        .then((data) => setHistory(Array.isArray(data) ? data : []))
        .catch((err) => console.warn('Could not load resource price history:', err))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, resource]);

  if (!isOpen || !resource) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/40">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                Rate Change History Audit
              </h3>
              <p className="text-[11px] font-mono text-slate-500">
                {resource.code} • {resource.name} • PostgreSQL Audited
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading audit records...</div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <History className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                No historical price revisions recorded yet for this resource.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPriceChange(resource);
                }}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white cursor-pointer inline-flex items-center space-x-1"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Record First Rate Revision</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-3.5 py-2">Effective Date</th>
                    <th className="px-3.5 py-2 text-right">Previous (LKR)</th>
                    <th className="px-3.5 py-2 text-right">New (LKR)</th>
                    <th className="px-3.5 py-2 text-center">Variance</th>
                    <th className="px-3.5 py-2">Reason</th>
                    <th className="px-3.5 py-2">Updated By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {history.map((rec) => {
                    const pct = Number(rec.changePct || 0);
                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-3.5 py-2 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                          {rec.effectiveDate || String(rec.recordedAt || '').slice(0, 10)}
                        </td>
                        <td className="px-3.5 py-2 font-mono text-right text-slate-500">
                          {formatCurrency(rec.previousPrice, rec.currency || 'LKR')}
                        </td>
                        <td className="px-3.5 py-2 font-mono font-bold text-right text-slate-900 dark:text-slate-100">
                          {formatCurrency(rec.newPrice, rec.currency || 'LKR')}
                        </td>
                        <td className="px-3.5 py-2 text-center font-mono text-[11px] font-bold">
                          <span className={`px-1.5 py-0.5 rounded ${pct > 0 ? 'bg-rose-50 text-rose-600' : pct < 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                            {pct > 0 ? `+${pct}%` : `${pct}%`}
                          </span>
                        </td>
                        <td className="px-3.5 py-2 text-slate-700 dark:text-slate-300 max-w-[180px] truncate" title={rec.reason}>
                          {rec.reason || 'Rate adjustment'}
                        </td>
                        <td className="px-3.5 py-2 text-slate-500 text-[11px]">
                          {rec.updatedBy || 'Resource Manager'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/40">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenPriceChange(resource);
            }}
            className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-2xs flex items-center space-x-1"
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>New Rate Revision</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
