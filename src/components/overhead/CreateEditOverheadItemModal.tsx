import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  DollarSign,
  Barcode as BarcodeIcon,
  Tag,
  Percent,
  CheckCircle2,
  Calendar,
  FileText
} from 'lucide-react';
import { OverheadItem, OverheadCostType, OverheadCalculationMethod, OverheadCostBase } from '../../types';
import { CategoryNode } from '../../data/categoriesAndProfiles';
import { SearchableCategoryPicker } from '../common/SearchableCategoryPicker';
import { api } from '../../services/api';
import { getStoredCurrency } from '../../utils/currency';

interface CreateEditOverheadItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (item: OverheadItem) => void;
  itemToEdit?: OverheadItem | null;
  categories?: CategoryNode[];
}

export const CreateEditOverheadItemModal: React.FC<CreateEditOverheadItemModalProps> = ({
  isOpen,
  onClose,
  onSave,
  itemToEdit,
  categories = []
}) => {
  const isEditing = Boolean(itemToEdit);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('Operating Overheads');
  const [subCategory, setSubCategory] = useState('');
  const [description, setDescription] = useState('');
  const [costType, setCostType] = useState<OverheadCostType>('facility');
  const [defaultCalculationMethod, setDefaultCalculationMethod] = useState<OverheadCalculationMethod>('percentage_of_direct');
  const [defaultCostBase, setDefaultCostBase] = useState<OverheadCostBase>('total_direct_cost');
  const [defaultRate, setDefaultRate] = useState<number>(5);
  const [unitType, setUnitType] = useState('pct');
  const [status, setStatus] = useState<'Active' | 'Inactive' | 'Archived' | 'Under Review'>('Active');
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCurrency = getStoredCurrency();

  useEffect(() => {
    if (itemToEdit) {
      setName(itemToEdit.name || '');
      setCode(itemToEdit.code || '');
      setBarcode(itemToEdit.barcode || '');
      setCategory(itemToEdit.category || 'Operating Overheads');
      setSubCategory('');
      setDescription(itemToEdit.description || '');
      setCostType(itemToEdit.costType || 'facility');
      setDefaultCalculationMethod(itemToEdit.defaultCalculationMethod || 'percentage_of_direct');
      setDefaultCostBase(itemToEdit.defaultCostBase || 'total_direct_cost');
      setDefaultRate(itemToEdit.defaultRate ?? 5);
      setUnitType(itemToEdit.unitType || 'pct');
      setStatus(itemToEdit.status || 'Active');
      setEffectiveDate(itemToEdit.effectiveDate || new Date().toISOString().slice(0, 10));
    } else {
      setName('');
      setCode(`OVH-${Math.floor(Math.random() * 9000 + 1000)}`);
      setBarcode('');
      setCategory('Indirect Materials & Factory Consumables');
      setSubCategory('Cutting Fluids & Chemical Agents');
      setDescription('');
      setCostType('facility');
      setDefaultCalculationMethod('percentage_of_direct');
      setDefaultCostBase('total_direct_cost');
      setDefaultRate(5);
      setUnitType('pct');
      setStatus('Active');
      setEffectiveDate(new Date().toISOString().slice(0, 10));
    }
    setError(null);
  }, [itemToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Item name is required.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: Partial<OverheadItem> = {
        name: name.trim(),
        code: code.trim().toUpperCase() || `OVH-${Math.floor(Math.random() * 9000 + 1000)}`,
        barcode: barcode.trim() || undefined,
        category: category.trim(),
        description: description.trim() || `${name} overhead allocation (${subCategory || category})`,
        costType,
        defaultCalculationMethod,
        defaultCostBase,
        defaultRate: Number(defaultRate) || 0,
        unitType: defaultCalculationMethod === 'percentage_of_direct' ? 'pct' : unitType,
        effectiveDate,
        status,
        createdBy: itemToEdit?.createdBy || 'System Administrator',
        updatedBy: 'System Administrator'
      };

      let result: OverheadItem;
      if (isEditing && itemToEdit) {
        result = await api.updateOverheadItem(itemToEdit.id, payload);
      } else {
        result = await api.createOverheadItem(payload);
      }

      if (onSave) onSave(result);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save overhead catalogue item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-150">
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {isEditing ? 'Edit Overhead Catalogue Item' : 'New Overhead Catalogue Record'}
              </h2>
              <p className="text-[11px] text-slate-500">
                Overhead allocations, factory indirect costs, and margin recovery
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-3.5 text-xs">
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs">
              {error}
            </div>
          )}

          {/* Name & Code */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="sm:col-span-2">
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Item Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Factory Electricity Peak Tariff or AS9100 Quality Compliance"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#003049]"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Custom Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Auto code"
                className="w-full px-2.5 py-1.5 text-xs font-mono uppercase rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#003049]"
              />
            </div>
          </div>

          {/* Category & Sub-Category via SearchableCategoryPicker */}
          <SearchableCategoryPicker
            categories={categories}
            selectedCategory={category}
            selectedSubCategory={subCategory}
            onCategoryChange={(catName) => setCategory(catName)}
            onSubCategoryChange={(subName) => setSubCategory(subName)}
            group="overhead"
            categoryLabel="Overhead Category"
            subCategoryLabel="Overhead Sub-Category"
            required={true}
          />

          {/* Cost Type & Calculation Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Overhead Cost Type
              </label>
              <select
                value={costType}
                onChange={(e) => setCostType(e.target.value as OverheadCostType)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#003049]"
              >
                <option value="indirect_material">Indirect Material (Coolants, Consumables)</option>
                <option value="indirect_labor">Indirect Labor (Supervision, Maintenance)</option>
                <option value="facility">Facility & Rent</option>
                <option value="equipment_depreciation">Equipment & CNC Depreciation</option>
                <option value="administrative">Administrative & Office</option>
                <option value="quality_compliance">Quality & ISO/AS Compliance</option>
                <option value="utility">Utilities (Electric, Gas, Water)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Calculation Method
              </label>
              <select
                value={defaultCalculationMethod}
                onChange={(e) => {
                  const m = e.target.value as OverheadCalculationMethod;
                  setDefaultCalculationMethod(m);
                  if (m === 'percentage_of_direct') setUnitType('pct');
                }}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#003049]"
              >
                <option value="percentage_of_direct">Percentage of Cost Base (%)</option>
                <option value="fixed_amount">Fixed Amount ({activeCurrency})</option>
                <option value="rate_per_unit">Rate Per Unit Produced</option>
                <option value="volume_tiered">Volume Tiered Bracket</option>
              </select>
            </div>
          </div>

          {/* Cost Base & Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Applicable Cost Base
              </label>
              <select
                value={defaultCostBase}
                onChange={(e) => setDefaultCostBase(e.target.value as OverheadCostBase)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#003049]"
              >
                <option value="total_direct_cost">Total Direct Cost (Materials + Subs + Outsourced)</option>
                <option value="material_cost">Material Cost Only</option>
                <option value="labor_cost">Labor Cost Only</option>
                <option value="subcontractor_cost">Subcontractor Cost Only</option>
                <option value="outsourced_cost">Outsourced Services Cost Only</option>
                <option value="planned_revenue">Planned Revenue (Commercial Quoted Price)</option>
                <option value="units_produced">Units Produced (Batch Size)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Default Rate / Amount {defaultCalculationMethod === 'percentage_of_direct' ? '(%)' : `(${activeCurrency})`}
              </label>
              <div className="relative">
                {defaultCalculationMethod === 'percentage_of_direct' ? (
                  <Percent className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                ) : (
                  <DollarSign className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                )}
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={defaultRate}
                  onChange={(e) => setDefaultRate(Number(e.target.value))}
                  className="w-full pl-8 pr-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#003049]"
                />
              </div>
            </div>
          </div>

          {/* Barcode & Effective Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Barcode / Tracking Tag
              </label>
              <div className="relative">
                <BarcodeIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="e.g. BC-OVH-ELEC-01"
                  className="w-full pl-8 pr-3 py-1.5 text-xs font-mono uppercase rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#003049]"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#003049]"
              >
                <option value="Active">Active</option>
                <option value="Under Review">Under Review</option>
                <option value="Inactive">Inactive</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Description & Allocation Guidelines
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Operational justification, tariff schedule basis, and accounting details..."
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#003049]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-[#003049] hover:bg-[#002235] text-white font-medium shadow-xs transition-colors cursor-pointer flex items-center space-x-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : isEditing ? 'Update Record' : 'Create Overhead Item'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
