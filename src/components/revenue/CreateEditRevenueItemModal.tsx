import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Save,
  Package,
  Wrench,
  DollarSign,
  Barcode as BarcodeIcon,
  Tag,
  AlertCircle,
  FileText,
  Trash2
} from 'lucide-react';
import { RevenueItem, RevenueCategory } from '../../types';
import { api } from '../../services/api';
import { SearchableCategoryPicker } from '../common/SearchableCategoryPicker';
import { CategoryNode, INITIAL_CATEGORY_HIERARCHY } from '../../data/categoriesAndProfiles';
import { peekNextNumber, generateNextNumber } from '../../services/autoNumberingService';

interface CreateEditRevenueItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: RevenueItem) => void;
  onDelete?: (id: string) => Promise<void> | void;
  itemToEdit: RevenueItem | null;
  categories: RevenueCategory[];
  activeCurrency: string;
}

export const CreateEditRevenueItemModal: React.FC<CreateEditRevenueItemModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  itemToEdit,
  categories,
  activeCurrency
}) => {
  const isEditing = !!itemToEdit;

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [type, setType] = useState<'product' | 'service'>('product');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('unit');
  const [defaultRate, setDefaultRate] = useState<number | ''>(0);
  const [costPrice, setCostPrice] = useState<number | ''>(0);
  const [currency, setCurrency] = useState(activeCurrency || 'USD');
  const [taxTreatment, setTaxTreatment] = useState('Standard (0%)');
  const [taxRatePct, setTaxRatePct] = useState<number>(0);
  const [status, setStatus] = useState<'Active' | 'Inactive' | 'Archived'>('Active');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setShowDeleteConfirm(false);
    if (itemToEdit) {
      setName(itemToEdit.name || '');
      setCode(itemToEdit.code || '');
      setBarcode(itemToEdit.barcode || '');
      setType(itemToEdit.type || 'product');
      setCategory(itemToEdit.category || '');
      setSubCategory(itemToEdit.subCategory || '');
      setDescription(itemToEdit.description || '');
      setUnit(itemToEdit.unit || 'unit');
      setDefaultRate(itemToEdit.defaultRate ?? 0);
      setCostPrice(itemToEdit.costPrice ?? 0);
      setCurrency(itemToEdit.currency || activeCurrency || 'USD');
      setTaxTreatment(itemToEdit.taxTreatment || 'Standard (0%)');
      setTaxRatePct(itemToEdit.taxRatePct ?? 0);
      setStatus(itemToEdit.status || 'Active');
    } else {
      setName('');
      setCode(peekNextNumber('revenue'));
      setBarcode('');
      setType('product');
      setCategory(categories[0]?.name || 'Architectural & Structural Aluminium');
      setSubCategory('');
      setDescription('');
      setUnit('unit');
      setDefaultRate(0);
      setCostPrice(0);
      setCurrency(activeCurrency || 'USD');
      setTaxTreatment('Standard (0%)');
      setTaxRatePct(0);
      setStatus('Active');
    }
    setError(null);
  }, [itemToEdit, isOpen, categories, activeCurrency]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Item name is required.');
      return;
    }
    const rateNum = Number(defaultRate);
    if (!Number.isFinite(rateNum) || rateNum < 0) {
      setError('Default selling rate must be a non-negative number.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const catTrimmed = category.trim();
      const subTrimmed = subCategory.trim();
      const matchedCat = categories.find((c) => c.name.toLowerCase() === catTrimmed.toLowerCase());
      const matchedSub = categories.find(
        (c) =>
          c.name.toLowerCase() === subTrimmed.toLowerCase() &&
          (!matchedCat || c.parentId === matchedCat.id)
      ) || categories.find((c) => c.name.toLowerCase() === subTrimmed.toLowerCase());

      const payload: Partial<RevenueItem> = {
        name: name.trim(),
        code: code.trim().toUpperCase() || undefined,
        barcode: barcode.trim().toUpperCase() || undefined,
        type,
        category: catTrimmed,
        categoryId: itemToEdit?.categoryId || matchedCat?.id || undefined,
        subCategory: subTrimmed,
        subCategoryId: itemToEdit?.subCategoryId || matchedSub?.id || undefined,
        description: description.trim(),
        unit: unit.trim() || 'unit',
        defaultRate: rateNum,
        costPrice: Number(costPrice) || 0,
        currency,
        taxTreatment,
        taxRatePct: Number(taxRatePct) || 0,
        status
      };

      let result: RevenueItem;
      if (isEditing && itemToEdit) {
        result = await api.updateRevenueItem(itemToEdit.id, payload);
      } else {
        result = await api.createRevenueItem(payload);
        generateNextNumber('revenue', true);
        // Synchronize with Produce table so revenue and produce portals both have the product
        if (payload.type === 'product') {
          api.createProduce({
            code: result.code,
            name: result.name,
            category: result.category,
            categoryId: result.categoryId,
            subCategory: result.subCategory || 'General',
            subCategoryId: result.subCategoryId,
            unit: result.unit,
            retailPrice: result.defaultRate,
            costPrice: result.costPrice || 0,
            status: 'Active'
          }).catch((e) => console.warn('Could not sync produce record:', e));
        }
      }

      onSave(result);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save revenue catalogue item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-150">
      <div className="bg-white dark:bg-[#0b101b] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/60">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {isEditing ? 'Edit Item' : 'New Item'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div className="p-3 mx-4 mt-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Item Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Type <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('product')}
                className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer font-bold text-xs ${
                  type === 'product'
                    ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 text-slate-700 dark:text-slate-300'
                }`}
              >
                Product
              </button>

              <button
                type="button"
                onClick={() => setType('service')}
                className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer font-bold text-xs ${
                  type === 'service'
                    ? 'border-purple-500 bg-purple-50/60 dark:bg-purple-950/40 text-purple-900 dark:text-purple-100 ring-2 ring-purple-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 text-slate-700 dark:text-slate-300'
                }`}
              >
                Service
              </button>
            </div>
          </div>

          {/* Item Name & Code */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Item name"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Auto code"
                className="w-full px-3 py-2 text-xs font-mono uppercase rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Barcode & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Barcode / Identifier
              </label>
              <div className="relative">
                <BarcodeIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="e.g. BC-ALUM-DOOR"
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono uppercase rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
          </div>

          {/* Category & Subcategory via SearchableCategoryPicker */}
          <SearchableCategoryPicker
            categories={INITIAL_CATEGORY_HIERARCHY}
            selectedCategory={category}
            selectedSubCategory={subCategory}
            onCategoryChange={(catName) => setCategory(catName)}
            onSubCategoryChange={(subName) => setSubCategory(subName)}
            onAddNewCategory={(newCat) => {
              api.createCategory(newCat).catch(console.error);
              setCategory(newCat.name);
            }}
            onAddNewSubCategory={(newSub) => {
              api.createCategory(newSub).catch(console.error);
              setSubCategory(newSub.name);
            }}
            group={type === 'product' ? 'product' : 'service'}
            categoryLabel="Category (Connected to Database)"
            subCategoryLabel="Sub-Category (Connected to Database)"
            required={true}
          />

          {/* Pricing: Default Selling Rate, Unit, Currency */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              <span>Standard Commercial Pricing</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Default Selling Rate <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={defaultRate}
                    onChange={(e) => setDefaultRate(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Default Unit of Measurement <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  list="units-list"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="unit, No., m2, sqft, hr, job"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
                <datalist id="units-list">
                  <option value="unit" />
                  <option value="No." />
                  <option value="pcs" />
                  <option value="set" />
                  <option value="sqft" />
                  <option value="m2" />
                  <option value="linear m" />
                  <option value="hr" />
                  <option value="day" />
                  <option value="job" />
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Currency
                </label>
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  placeholder="LKR, USD, EUR"
                  className="w-full px-3 py-2 text-xs font-mono uppercase font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Base Production Cost <span className="text-slate-400 font-normal">(Internal ref)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Default Tax Treatment
                </label>
                <select
                  value={taxTreatment}
                  onChange={(e) => {
                    setTaxTreatment(e.target.value);
                    if (e.target.value.includes('18%')) setTaxRatePct(18);
                    else if (e.target.value.includes('15%')) setTaxRatePct(15);
                    else if (e.target.value.includes('8%')) setTaxRatePct(8);
                    else setTaxRatePct(0);
                  }}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="Standard (0%)">Standard VAT / Tax (0%)</option>
                  <option value="VAT Standard (18%)">VAT Standard (18%)</option>
                  <option value="VAT Reduced (8%)">VAT Reduced (8%)</option>
                  <option value="Exempt">Exempt from Tax</option>
                  <option value="Zero Rated">Zero Rated</option>
                </select>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Detailed Description & Commercial Scope
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide technical specifications, standard inclusions, finishes, or scope details..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/60">
          <div>
            {isEditing && itemToEdit?.id && onDelete && (
              showDeleteConfirm ? (
                <div className="flex items-center space-x-1.5 p-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 animate-in fade-in">
                  <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 pl-1">
                    Delete deliverable permanently?
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      setSaving(true);
                      try {
                        await onDelete(itemToEdit.id);
                        onClose();
                      } catch (err: any) {
                        setError(err?.message || 'Failed to delete revenue item');
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving}
                    className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {saving ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={saving}
                    className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors cursor-pointer flex items-center space-x-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Deliverable</span>
                </button>
              )
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="px-5 py-2 text-xs font-bold rounded-lg bg-[#003049] hover:bg-[#002235] text-white flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : isEditing ? 'Save Catalogue Changes' : 'Create Catalogue Item'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
