import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Layers,
  FolderPlus,
  FilePlus,
  Check,
  AlertTriangle,
  Briefcase,
  DollarSign,
  Truck,
  Cpu,
  Building2,
  Users,
  ShieldCheck,
  Award,
  Clock,
  MapPin,
  Mail,
  Phone
} from 'lucide-react';
import { CategoryNode, ClientProfile } from '../data/categoriesAndProfiles';
import {
  MaterialItem,
  Supplier,
  OutsourcedService,
  SubcontractorRateItem,
  Project,
  ProduceItem
} from '../types';
import { ColorGradientPicker } from './ColorGradientPicker';
import { peekNextNumber, generateNextNumber } from '../services/autoNumberingService';
import { formatCurrency, formatLKR, SUPPORTED_CURRENCIES, getStoredCurrency } from '../utils/currency';
import { SearchableCategoryPicker } from './common/SearchableCategoryPicker';
import { SearchablePartnerPicker, PartnerOption } from './common/SearchablePartnerPicker';
import { INITIAL_CATEGORY_HIERARCHY } from '../data/categoriesAndProfiles';
import { api } from '../services/api';

// ==========================================
// 1. CREATE CATEGORY MODAL (LEVEL 1)
// ==========================================
interface CreateCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultGroup: 'material' | 'product' | 'service' | 'subcontractor' | 'outsourced' | 'overhead';
  onSave: (node: Partial<CategoryNode>) => void;
}

export const CreateCategoryModal: React.FC<CreateCategoryModalProps> = ({
  isOpen,
  onClose,
  defaultGroup,
  onSave
}) => {
  const [group, setGroup] = useState<'material' | 'product' | 'service' | 'subcontractor' | 'outsourced' | 'overhead'>(defaultGroup);
  const [name, setName] = useState('');
  const [brief, setBrief] = useState('');
  const [themeId, setThemeId] = useState('pacific-sky');
  const [customGradient, setCustomGradient] = useState<string | undefined>();

  useEffect(() => {
    setGroup(defaultGroup);
    setName('');
    setBrief('');
  }, [defaultGroup, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      group,
      type: 'category',
      brief: brief.trim() || `${name} catalog category`,
      themeId,
      customGradient,
      itemCount: 0,
      metaBadge: group === 'subcontractor' ? 'HIRED SUBCONTRACTOR' : group === 'outsourced' ? 'OUTSOURCED' : group === 'overhead' ? 'OVERHEAD ROOT' : 'CATALOG ROOT',
      actionText: group === 'subcontractor' ? 'EXPLORE TRADES & RATES' : 'EXPLORE SUB-CATEGORIES'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">New Category</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs text-slate-600 mb-1 font-normal">Group</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setGroup('material')}
                className={`py-1.5 px-2 text-xs rounded-xl border transition-all ${
                  group === 'material'
                    ? 'border-[#003049] bg-[#003049] text-white font-normal shadow-xs'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Materials
              </button>
              <button
                type="button"
                onClick={() => setGroup('subcontractor')}
                className={`py-1.5 px-2 text-xs rounded-xl border transition-all ${
                  group === 'subcontractor'
                    ? 'border-[#003049] bg-[#003049] text-white font-normal shadow-xs'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Subcontractor
              </button>
              <button
                type="button"
                onClick={() => setGroup('outsourced')}
                className={`py-1.5 px-2 text-xs rounded-xl border transition-all ${
                  group === 'outsourced'
                    ? 'border-[#003049] bg-[#003049] text-white font-normal shadow-xs'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Outsourced
              </button>
              <button
                type="button"
                onClick={() => setGroup('product')}
                className={`py-1.5 px-2 text-xs rounded-xl border transition-all ${
                  group === 'product'
                    ? 'border-[#003049] bg-[#003049] text-white font-normal shadow-xs'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Products
              </button>
              <button
                type="button"
                onClick={() => setGroup('service')}
                className={`py-1.5 px-2 text-xs rounded-xl border transition-all ${
                  group === 'service'
                    ? 'border-[#003049] bg-[#003049] text-white font-normal shadow-xs'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Services
              </button>
              <button
                type="button"
                onClick={() => setGroup('overhead')}
                className={`py-1.5 px-2 text-xs rounded-xl border transition-all ${
                  group === 'overhead'
                    ? 'border-[#003049] bg-[#003049] text-white font-normal shadow-xs'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Overheads
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-700 mb-1 font-medium">
              Name *
            </label>
            <input
              type="text"
              required
              placeholder="Category Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003049]"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-700 mb-1 font-medium">Theme</label>
            <ColorGradientPicker
              compact
              selectedThemeId={themeId}
              onSelectTheme={(tId, grad) => {
                setThemeId(tId);
                setCustomGradient(grad);
              }}
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-[#003049] hover:bg-[#002235] text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 2. CREATE SUB-CATEGORY MODAL (LEVEL 2)
// ==========================================
interface CreateSubCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultGroup: 'material' | 'product' | 'service' | 'subcontractor' | 'outsourced' | 'overhead';
  parentCategories: CategoryNode[];
  defaultParentId?: string;
  onSave: (node: Partial<CategoryNode>) => void;
}

export const CreateSubCategoryModal: React.FC<CreateSubCategoryModalProps> = ({
  isOpen,
  onClose,
  defaultGroup,
  parentCategories,
  defaultParentId,
  onSave
}) => {
  const [group, setGroup] = useState<'material' | 'product' | 'service' | 'subcontractor' | 'outsourced' | 'overhead'>(defaultGroup);
  const [parentId, setParentId] = useState<string>(defaultParentId || '');
  const [name, setName] = useState('');
  const [brief, setBrief] = useState('');
  const [themeId, setThemeId] = useState('napa-purple');
  const [customGradient, setCustomGradient] = useState<string | undefined>();

  useEffect(() => {
    setGroup(defaultGroup);
    setName('');
    setBrief('');
    if (defaultParentId) {
      setParentId(defaultParentId);
    } else {
      const firstParent = parentCategories.find((c) => {
        if (c.type !== 'category') return false;
        if (defaultGroup === 'product') return c.group === 'product' || c.group === 'revenue';
        if (defaultGroup === 'service') return c.group === 'service' || c.group === 'outsourced' || c.group === 'subcontractor';
        return c.group === defaultGroup;
      });
      if (firstParent) setParentId(firstParent.id);
    }
  }, [defaultGroup, defaultParentId, isOpen, parentCategories]);

  if (!isOpen) return null;

  const validParents = parentCategories.filter((c) => {
    if (c.type !== 'category') return false;
    if (group === 'product') return c.group === 'product' || c.group === 'revenue';
    if (group === 'overhead') return c.group === 'overhead';
    if (group === 'subcontractor') return c.group === 'subcontractor';
    if (group === 'outsourced') return c.group === 'outsourced';
    if (group === 'service') return c.group === 'service' || c.group === 'outsourced' || c.group === 'subcontractor';
    return c.group === group;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const parentNode = parentCategories.find((c) => c.id === parentId);

    onSave({
      name: name.trim(),
      group,
      type: 'sub_category',
      parentId: parentId || (validParents[0]?.id || ''),
      parentName: parentNode ? parentNode.name : 'General Category',
      brief: brief.trim() || `${name} sub-division`,
      themeId,
      customGradient,
      itemCount: 0,
      metaBadge: group === 'subcontractor' ? 'HIRED TRADE' : group === 'outsourced' ? 'OUTSOURCED SCOPE' : group === 'overhead' ? 'OVERHEAD SUB-CATEGORY' : 'SUB-CATEGORY',
      actionText: group === 'subcontractor' ? 'VIEW SERVICE ITEMS & RATES' : 'VIEW DEEP SPECS'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">New Subcategory</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs text-slate-600 mb-1 font-normal">Group</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(['material', 'product', 'service', 'subcontractor', 'outsourced', 'overhead'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    setGroup(g);
                    const matching = parentCategories.filter((c) => {
                      if (c.type !== 'category') return false;
                      if (g === 'product') return c.group === 'product' || c.group === 'revenue';
                      if (g === 'overhead') return c.group === 'overhead';
                      if (g === 'subcontractor') return c.group === 'subcontractor';
                      if (g === 'outsourced') return c.group === 'outsourced';
                      if (g === 'service') return c.group === 'service' || c.group === 'outsourced' || c.group === 'subcontractor';
                      return c.group === g;
                    });
                    if (matching.length > 0) setParentId(matching[0].id);
                  }}
                  className={`py-1.5 px-2 text-xs rounded-xl border capitalize transition-all ${
                    group === g
                      ? 'border-[#003049] bg-[#003049] text-white font-normal shadow-xs'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {g === 'overhead' ? 'Overheads' : g === 'outsourced' ? 'Outsourced' : `${g}s`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1 font-normal">Parent Category *</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              required
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003049]"
            >
              {validParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-700 mb-1 font-medium">Name *</label>
            <input
              type="text"
              required
              placeholder="Sub-Category Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003049]"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-700 mb-1 font-medium">Theme</label>
            <ColorGradientPicker
              compact
              selectedThemeId={themeId}
              onSelectTheme={(tId, grad) => {
                setThemeId(tId);
                setCustomGradient(grad);
              }}
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-[#003049] hover:bg-[#002235] text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 3. ADD ITEM MODAL (ACCORDING TO PORTAL)
// ==========================================
export const STANDARD_MEASUREMENT_UNITS = [
  { id: 'unit-pcs', code: 'pcs', name: 'Pieces / Units', symbol: 'pcs' },
  { id: 'unit-kg', code: 'kg', name: 'Kilograms', symbol: 'kg' },
  { id: 'unit-g', code: 'g', name: 'Grams', symbol: 'g' },
  { id: 'unit-m', code: 'm', name: 'Meters', symbol: 'm' },
  { id: 'unit-mm', code: 'mm', name: 'Millimeters', symbol: 'mm' },
  { id: 'unit-m2', code: 'm2', name: 'Square Meters', symbol: 'm²' },
  { id: 'unit-m3', code: 'm3', name: 'Cubic Meters', symbol: 'm³' },
  { id: 'unit-ton', code: 'ton', name: 'Metric Tons', symbol: 't' },
  { id: 'unit-sheet', code: 'sheet', name: 'Sheets / Plates', symbol: 'sheet' },
  { id: 'unit-bundle', code: 'bundle', name: 'Bundles', symbol: 'bdl' },
  { id: 'unit-box', code: 'box', name: 'Boxes / Cartons', symbol: 'box' },
  { id: 'unit-roll', code: 'roll', name: 'Rolls / Coils', symbol: 'roll' },
  { id: 'unit-liter', code: 'liter', name: 'Liters', symbol: 'L' },
  { id: 'unit-hr', code: 'hr', name: 'Hours', symbol: 'hr' },
  { id: 'unit-set', code: 'set', name: 'Assemblies / Sets', symbol: 'set' }
];

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  portal: string;
  categories: CategoryNode[];
  suppliers: Supplier[];
  onSave: (entityType: string, itemData: any) => void;
  initialCategoryId?: string;
  initialSubCategoryId?: string;
}

export const AddItemModal: React.FC<AddItemModalProps> = ({
  isOpen,
  onClose,
  portal,
  categories,
  suppliers,
  onSave,
  initialCategoryId,
  initialSubCategoryId
}) => {
  const normalizePortal = (p: string) => {
    if (!p) return 'material';
    if (p === 'materials-hierarchy' || p === 'materials') return 'material';
    if (p === 'suppliers' || p === 'supplier') return 'supplier';
    if (p === 'subcontractors' || p === 'subcontractor' || p === 'subcontractor-categories') return 'subcontractor';
    if (p === 'outsourced-categories' || p === 'outsourced' || p === 'service-providers') return 'outsourced';
    if (p === 'products-hierarchy' || p === 'product' || p === 'produce') return 'produce';
    if (p === 'revenue' || p === 'revenue-portal' || p === 'revenue-streams') return 'revenue';
    if (p === 'projects' || p === 'project') return 'project';
    if (p === 'clients' || p === 'client') return 'client';
    return p;
  };

  const [selectedType, setSelectedType] = useState(() => normalizePortal(portal));

  // Common Form states
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [barcode, setBarcode] = useState('');
  const [description, setDescription] = useState('');
  const [materialStatus, setMaterialStatus] = useState('Available');
  const [defaultUnitId, setDefaultUnitId] = useState('unit-pcs');
  const [unit, setUnit] = useState('pcs');
  const [price, setPrice] = useState<number>(15000);
  const [costPrice, setCostPrice] = useState<number>(11000);
  const [stock, setStock] = useState<number>(25);
  const [themeId, setThemeId] = useState('pacific-sky');
  const [customGradient, setCustomGradient] = useState<string | undefined>();

  // Supplier Specific Form States
  const [supplierScope, setSupplierScope] = useState<'materials' | 'final_product' | 'full_contract' | 'hybrid'>('materials');
  const [supplierContact, setSupplierContact] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('+94 11 234 5678');
  const [supplierCity, setSupplierCity] = useState('Colombo');
  const [supplierCountry, setSupplierCountry] = useState('Sri Lanka');
  const [supplierAddress, setSupplierAddress] = useState('Industrial Zone, Peliyagoda');
  const [supplierPaymentTerms, setSupplierPaymentTerms] = useState('Net 30');
  const [supplierRating, setSupplierRating] = useState<number>(4.8);
  const [supplierQualityScore, setSupplierQualityScore] = useState<number>(98);
  const [supplierCreditLimit, setSupplierCreditLimit] = useState<number>(2500000); // LKR
  const [supplierCertifications, setSupplierCertifications] = useState('ISO 9001:2015, CE Certified');
  const [supplierNotes, setSupplierNotes] = useState('');

  // Subcontractor Specific Form States
  const [subcontractorTrade, setSubcontractorTrade] = useState('Precision CNC 5-Axis Milling & Turning');
  const [subcontractorSkillLevel, setSubcontractorSkillLevel] = useState('Certified Master Journeyman');
  const [subcontractorRateModel, setSubcontractorRateModel] = useState<
    'hourly_labour' | 'daily_rate' | 'bulk_volume' | 'retail_rate' | 'full_contract_lump_sum'
  >('hourly_labour');
  const [subcontractorBaseRate, setSubcontractorBaseRate] = useState<number>(4500); // LKR / hr
  const [subcontractorRetailRate, setSubcontractorRetailRate] = useState<number>(6800); // LKR / hr
  const [subcontractorUnit, setSubcontractorUnit] = useState('hr');
  const [subcontractorShiftMultiplier, setSubcontractorShiftMultiplier] = useState<number>(1.25);
  const [subcontractorLocation, setSubcontractorLocation] = useState('Colombo, Western Province');
  const [subcontractorWeeklyCapacity, setSubcontractorWeeklyCapacity] = useState<number>(160);
  const [subcontractorCrewSize, setSubcontractorCrewSize] = useState<number>(4);
  const [subcontractorNotes, setSubcontractorNotes] = useState('');

  // Outsourced & Misc States
  const [supplierName, setSupplierName] = useState('');
  const [clientName, setClientName] = useState('');
  const [industry, setIndustry] = useState('Industrial Automation');
  const [location, setLocation] = useState('Colombo, Sri Lanka');
  const [slaLevel, setSlaLevel] = useState('Premium 99.9%');
  const [currency, setCurrency] = useState<string>(() => getStoredCurrency());
  const currSymbol = SUPPORTED_CURRENCIES.find((c) => c.code === currency)?.symbol || 'Rs.';

  // Memoized partner options for SearchablePartnerPicker
  const partnerOptions: PartnerOption[] = useMemo(() => {
    return suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      country: s.country || s.city,
      rating: s.rating
    }));
  }, [suppliers]);

  // Auto-Numbering Synchronization
  useEffect(() => {
    const normalized = normalizePortal(portal);
    setSelectedType(normalized);
    setCurrency(getStoredCurrency());
  }, [portal, isOpen]);

  useEffect(() => {
    // Determine auto-number entity key
    let entityKey = selectedType;
    if (selectedType === 'material') entityKey = 'materials';
    else if (selectedType === 'supplier') entityKey = 'suppliers';
    else if (selectedType === 'subcontractor') entityKey = 'subcontractors';
    else if (selectedType === 'project') entityKey = 'projects';

    const autoCode = peekNextNumber(entityKey);
    setCode(autoCode);
    if (selectedType === 'material') {
      setBarcode(autoCode);
    }
    setName('');
    // Resolve category and subcategory from props if provided, for ANY entity type
    if (initialCategoryId) {
      setCategoryId(initialCategoryId);
      const cat = categories.find((c) => c.id === initialCategoryId);
      if (cat) setCategory(cat.name);
    } else {
      const targetGroup =
        selectedType === 'produce'
          ? 'product'
          : selectedType === 'outsourced'
          ? 'outsourced'
          : selectedType === 'subcontractor'
          ? 'subcontractor'
          : selectedType === 'overhead'
          ? 'overhead'
          : selectedType === 'revenue'
          ? 'revenue'
          : 'material';
      const catList = categories.filter(
        (c) => (c.group === targetGroup || !c.parentId) && (c.type === 'category' || !c.parentId)
      );
      if (catList.length > 0) {
        setCategoryId(catList[0].id);
        setCategory(catList[0].name);
      } else if (selectedType === 'subcontractor') {
        setCategory('Specialist Industrial Labor');
      } else if (selectedType === 'supplier') {
        setCategory('Raw Stock Materials & Alloys');
      }
    }

    if (initialSubCategoryId) {
      setSubCategoryId(initialSubCategoryId);
      const sub = categories.find((c) => c.id === initialSubCategoryId);
      if (sub) setSubCategory(sub.name);
    } else if (initialCategoryId) {
      const firstSub = categories.find((c) => c.parentId === initialCategoryId);
      if (firstSub) {
        setSubCategoryId(firstSub.id);
        setSubCategory(firstSub.name);
      }
    } else {
      if (selectedType === 'subcontractor') {
        setSubCategory('Precision Tooling & CNC Services');
      } else if (selectedType === 'supplier') {
        setSubCategory('Aerospace & Engineering Metals');
      }
    }

    if (suppliers.length > 0) setSupplierName(suppliers[0].name);
  }, [selectedType, isOpen, categories, suppliers, initialCategoryId, initialSubCategoryId]);

  const handleCategoryChange = (newCatId: string) => {
    setCategoryId(newCatId);
    const catNode = categories.find((c) => c.id === newCatId);
    setCategory(catNode ? catNode.name : '');

    // Requirement 11: If the category changes, validate or clear an incompatible subcategory.
    if (subCategoryId) {
      const subNode = categories.find((c) => c.id === subCategoryId);
      if (!subNode || subNode.parentId !== newCatId) {
        setSubCategoryId('');
        setSubCategory('');
      }
    }
  };

  const handleSubCategoryChange = (newSubId: string) => {
    setSubCategoryId(newSubId);
    const subNode = categories.find((c) => c.id === newSubId);
    setSubCategory(subNode ? subNode.name : '');
    if (subNode?.parentId && !categoryId) {
      setCategoryId(subNode.parentId);
      const parentNode = categories.find((c) => c.id === subNode.parentId);
      if (parentNode) setCategory(parentNode.name);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let entityKey = selectedType;
    if (selectedType === 'material') entityKey = 'materials';
    else if (selectedType === 'supplier') entityKey = 'suppliers';
    else if (selectedType === 'subcontractor') entityKey = 'subcontractors';
    else if (selectedType === 'project') entityKey = 'projects';

    if (selectedType === 'supplier') {
      // DEDICATED APPROVED SUPPLIER REGISTRATION
      onSave('supplier', {
        id: code.trim(),
        name: name.trim(),
        category: category || 'Raw Stock Materials',
        supplyScope: supplierScope,
        contactPerson: supplierContact || 'Procurement Contact',
        email: supplierEmail || `procurement@${name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'supplier'}.lk`,
        phone: supplierPhone || '+94 11 234 5678',
        city: supplierCity || 'Colombo',
        country: supplierCountry || 'Sri Lanka',
        paymentTerms: supplierPaymentTerms,
        rating: Number(supplierRating) || 4.8,
        qualityScorePct: Number(supplierQualityScore) || 98,
        creditLimit: Number(supplierCreditLimit) || 2500000,
        certifications: supplierCertifications.split(',').map((s) => s.trim()).filter(Boolean),
        currency,
        status: 'Active',
        contractHistory: [],
        notes: supplierNotes || `Registered vendor for ${category || 'industrial supplies'} in ${currency}.`,
        themeId,
        customGradient
      });
      generateNextNumber('suppliers', true);
    } else if (selectedType === 'subcontractor') {
      // DEDICATED SUBCONTRACTOR & LABOR SPECIALIST REGISTRATION
      const baseNum = Number(subcontractorBaseRate) || 4500;
      const retailNum = Number(subcontractorRetailRate) || 6800;
      onSave('subcontractor', {
        id: `sub-${Date.now()}`,
        code: code.trim(),
        subcontractorName: name.trim(),
        nicheServiceName: (subcontractorTrade || name).trim(),
        serviceType: (subcontractorTrade || name).trim(),
        categoryId: categoryId || undefined,
        subCategoryId: subCategoryId || undefined,
        serviceCategory: category || 'Specialist Industrial Labor',
        serviceSubCategory: subCategory || 'General Hired Scope',
        rateModel: subcontractorRateModel,
        baseRate: baseNum,
        retailRate: retailNum,
        currency,
        unit: subcontractorUnit || 'hr',
        skillLevel: subcontractorSkillLevel || 'Certified Senior Specialist',
        location: subcontractorLocation || 'Operations Base',
        rateRange: `${currSymbol} ${Math.round(baseNum * 0.9).toLocaleString()} – ${currSymbol} ${Math.round(baseNum).toLocaleString()} / ${subcontractorUnit || 'hr'}`,
        bulkPricingRanges: [
          { minVolume: 1, maxVolume: 50, unitRate: baseNum, discountPct: 0 },
          { minVolume: 51, maxVolume: 200, unitRate: Math.round(baseNum * 0.9), discountPct: 10 },
          { minVolume: 201, unitRate: Math.round(baseNum * 0.82), discountPct: 18 }
        ],
        fullContractEstimate: baseNum * (subcontractorWeeklyCapacity || 160),
        themeId,
        customGradient
      });
      generateNextNumber('subcontractors', true);
    } else if (selectedType === 'material') {
      const finalBarcode = barcode.trim() || code.trim();
      onSave('material', {
        code: code.trim(),
        name: name.trim(),
        categoryId: categoryId || undefined,
        subCategoryId: subCategoryId || undefined,
        category: category || 'Raw Materials',
        subCategory: subCategory || '',
        barcode: finalBarcode,
        description: description.trim(),
        unit: unit.trim() || 'pcs',
        defaultUnitId: defaultUnitId || undefined,
        unitPrice: Number(price),
        currentPrice: Number(price),
        retailPrice: Number(price),
        unitCost: Number(costPrice),
        currency,
        inStock: Number(stock),
        supplierName: supplierName || (suppliers[0]?.name ?? 'Approved Supplier'),
        supplierId: suppliers.find((s) => s.name === supplierName)?.id || undefined,
        status: materialStatus || 'Available',
        leadTimeDays: 7,
        themeId,
        customGradient
      });
      generateNextNumber('materials', true);
    } else if (selectedType === 'produce') {
      onSave('produce', {
        code: code.trim(),
        name: name.trim(),
        categoryId: categoryId || undefined,
        subCategoryId: subCategoryId || undefined,
        category: category || 'Standard Assemblies',
        subCategory: subCategory || 'General',
        unit,
        currency,
        costPrice: Number(costPrice),
        retailPrice: Number(price),
        leadTimeDays: 14,
        status: 'Active',
        themeId,
        customGradient
      });
      generateNextNumber('produce', true);
    } else if (selectedType === 'outsourced') {
      onSave('outsourced', {
        name: name.trim(),
        providerName: supplierName || 'Specialized Service Partner',
        categoryId: categoryId || undefined,
        subCategoryId: subCategoryId || undefined,
        category: category || 'Specialized Finishing & Heat Treatment',
        subCategory: subCategory || 'General Service',
        baseUnitType: unit || 'per_hour',
        currency,
        rate: Number(costPrice || price * 0.8),
        retailPrice: Number(price),
        slaLevel: slaLevel || 'Standard Guaranteed',
        themeId,
        customGradient
      });
      generateNextNumber('outsourced', true);
    } else if (selectedType === 'project') {
      onSave('project', {
        code: code.trim(),
        name: name.trim(),
        clientName: clientName || 'Valued Client Enterprise',
        productCategory: category || 'Industrial Equipment',
        quotedPrice: Number(price),
        currency,
        targetMarginPct: 28,
        status: 'Proposal',
        themeId,
        customGradient
      });
      generateNextNumber('projects', true);
    } else if (selectedType === 'overhead') {
      onSave('overhead', {
        code: code.trim(),
        name: name.trim(),
        categoryId: categoryId || undefined,
        subCategoryId: subCategoryId || undefined,
        category: category || 'Indirect Materials & Factory Consumables',
        subCategory: subCategory || '',
        costType: 'facility',
        defaultCalculationMethod: 'percentage_of_direct',
        defaultRate: Number(price) || 5,
        defaultCostBase: 'total_direct_cost',
        unitType: unit || 'pct',
        status: 'Active',
        themeId,
        customGradient
      });
      generateNextNumber('overheads', true);
    } else if (selectedType === 'revenue') {
      onSave('revenue', {
        code: code.trim(),
        name: name.trim(),
        type: 'product',
        categoryId: categoryId || undefined,
        subCategoryId: subCategoryId || undefined,
        category: category || 'Commercial Deliverables',
        subCategory: subCategory || 'General Scope',
        unit: unit || 'unit',
        defaultRate: Number(price) || 100,
        costPrice: Number(costPrice) || 70,
        currency,
        status: 'Active',
        themeId,
        customGradient
      });
      generateNextNumber('revenue', true);
    } else if (selectedType === 'client') {
      onSave('client', {
        name: name.trim(),
        tagline: `${industry} Enterprise Partner`,
        industry: industry || 'Technology & Manufacturing',
        location: location || 'Colombo, Sri Lanka',
        status: 'Active Partner',
        totalQuotedValue: Number(price),
        contactPerson: 'Lead Commercial Buyer',
        email: `procurement@${name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'client'}.lk`,
        themeId,
        customGradient
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
        {/* Simple Top Row - Header removed as requested */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">
            {selectedType === 'supplier'
              ? 'Add Supplier'
              : selectedType === 'subcontractor'
              ? 'Add Subcontractor'
              : selectedType === 'material'
              ? 'Add Material'
              : selectedType === 'outsourced'
              ? 'Add Service'
              : selectedType === 'produce'
              ? 'Add Product'
              : selectedType === 'overhead'
              ? 'Add Overhead'
              : 'Add Item'}
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Target Portal Selector & Currency Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-[#003049] focus:bg-white"
              >
                <option value="supplier">Supplier</option>
                <option value="subcontractor">Subcontractor</option>
                <option value="material">Material</option>
                <option value="outsourced">Service</option>
                <option value="produce">Product</option>
                <option value="revenue">Revenue Deliverable</option>
                <option value="overhead">Overhead</option>
                <option value="project">Project</option>
                <option value="client">Client</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-[#003049] focus:bg-white"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 1. SUPPLIER FORM */}
          {selectedType === 'supplier' && (
            <div className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">

              {/* Supplier Name & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Company / Supplier Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lanka Precision Metals (Pvt) Ltd"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Vendor Code (Auto)
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-sky-50/70 border border-sky-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-sky-950 focus:outline-none focus:border-sky-600"
                  />
                </div>
              </div>

              {/* Supply Scope & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">Supply Scope</label>
                  <select
                    value={supplierScope}
                    onChange={(e) => setSupplierScope(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-sky-600"
                  >
                    <option value="materials">Raw Materials & Alloys Only</option>
                    <option value="final_product">Final Manufactured Assemblies</option>
                    <option value="full_contract">Turnkey Full Contract</option>
                    <option value="hybrid">Hybrid Materials & Specialized Processing</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Commodity Category
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Structural Alloys & Fasteners"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-sky-600"
                  />
                </div>
              </div>

              {/* Contact Person, Email, Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sunil Perera"
                    value={supplierContact}
                    onChange={(e) => setSupplierContact(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-sky-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Business Email
                  </label>
                  <input
                    type="email"
                    placeholder="orders@supplier.lk"
                    value={supplierEmail}
                    onChange={(e) => setSupplierEmail(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-sky-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Business Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+94 11 234 5678"
                    value={supplierPhone}
                    onChange={(e) => setSupplierPhone(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-sky-600"
                  />
                </div>
              </div>

              {/* Location: City, Country, Address */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">City</label>
                  <input
                    type="text"
                    value={supplierCity}
                    onChange={(e) => setSupplierCity(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-sky-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">Country</label>
                  <input
                    type="text"
                    value={supplierCountry}
                    onChange={(e) => setSupplierCountry(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-sky-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Payment Terms
                  </label>
                  <select
                    value={supplierPaymentTerms}
                    onChange={(e) => setSupplierPaymentTerms(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-sky-600"
                  >
                    <option value="Net 30">Net 30 Days</option>
                    <option value="Net 60">Net 60 Days</option>
                    <option value="Net 15">Net 15 Days</option>
                    <option value="Immediate">Immediate / Advance</option>
                    <option value="LC Escrow">LC / Commercial Escrow</option>
                  </select>
                </div>
              </div>

              {/* Financials & Quality: Credit Limit (LKR), Rating, Certifications */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Credit Limit (LKR / Rs.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50000"
                    value={supplierCreditLimit}
                    onChange={(e) => setSupplierCreditLimit(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-sky-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Quality Score (%)
                  </label>
                  <input
                    type="number"
                    min="50"
                    max="100"
                    value={supplierQualityScore}
                    onChange={(e) => setSupplierQualityScore(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-sky-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Quality Rating (1-5)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="0.1"
                    value={supplierRating}
                    onChange={(e) => setSupplierRating(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-sky-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-700 font-medium mb-1">
                  Certifications & Standards
                </label>
                <input
                  type="text"
                  placeholder="e.g. ISO 9001:2015, SLS Certified, CE Certified"
                  value={supplierCertifications}
                  onChange={(e) => setSupplierCertifications(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-sky-600"
                />
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. SUBCONTRACTOR FORM */}
          {selectedType === 'subcontractor' && (
            <div className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
              {/* Contractor Name & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Subcontractor name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#003049]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Code
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#003049]"
                  />
                </div>
              </div>

              {/* Trade / Specialty & Skill Level */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Trade / Service Specialty *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Precision CNC 5-Axis Milling"
                    value={subcontractorTrade}
                    onChange={(e) => setSubcontractorTrade(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Certified Skill Level
                  </label>
                  <select
                    value={subcontractorSkillLevel}
                    onChange={(e) => setSubcontractorSkillLevel(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-purple-600"
                  >
                    <option value="Certified Master Journeyman">Certified Master Journeyman (Level 4)</option>
                    <option value="Senior Certified Specialist">Senior Certified Specialist (Level 3)</option>
                    <option value="Class A Heavy Operator">Class A Heavy Operator / Technician</option>
                    <option value="Associate Trade Craftsman">Associate Trade Craftsman (Level 2)</option>
                  </select>
                </div>
              </div>

              {/* Subcontractor Category & Sub-Category via SearchableCategoryPicker */}
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <SearchableCategoryPicker
                  categories={categories && categories.length > 0 ? categories : INITIAL_CATEGORY_HIERARCHY}
                  selectedCategory={category}
                  selectedSubCategory={subCategory}
                  onCategoryChange={(catName, node) => {
                    setCategory(catName);
                    if (node) setCategoryId(node.id);
                  }}
                  onSubCategoryChange={(subName, node) => {
                    setSubCategory(subName);
                    if (node) setSubCategoryId(node.id);
                  }}
                  onAddNewCategory={(newCat) => {
                    api.createCategory(newCat).catch(console.error);
                    setCategory(newCat.name);
                    setCategoryId(newCat.id);
                  }}
                  onAddNewSubCategory={(newSub) => {
                    api.createCategory(newSub).catch(console.error);
                    setSubCategory(newSub.name);
                    setSubCategoryId(newSub.id);
                  }}
                  group="subcontractor"
                  categoryLabel="Subcontractor Category (Connected to Database)"
                  subCategoryLabel="Trade Sub-Category (Connected to Database)"
                  required={true}
                />
              </div>

              {/* Rate Model & Rates in LKR */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Rate Model
                  </label>
                  <select
                    value={subcontractorRateModel}
                    onChange={(e) => setSubcontractorRateModel(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-purple-600"
                  >
                    <option value="hourly_labour">Hourly Billable (hr)</option>
                    <option value="daily_rate">Daily Shift Rate (day)</option>
                    <option value="bulk_volume">Tiered Volume Schedule</option>
                    <option value="retail_rate">Commercial Retail Schedule</option>
                    <option value="full_contract_lump_sum">Full Contract Lump Sum</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Internal Base Cost ({currSymbol} / {subcontractorUnit}) *
                  </label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={subcontractorBaseRate}
                    onChange={(e) => setSubcontractorBaseRate(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Retail Client Billable ({currSymbol} / {subcontractorUnit}) *
                  </label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={subcontractorRetailRate}
                    onChange={(e) => setSubcontractorRetailRate(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              {/* Unit, Multiplier, Crew, Location */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">Unit</label>
                  <input
                    type="text"
                    value={subcontractorUnit}
                    onChange={(e) => setSubcontractorUnit(e.target.value)}
                    placeholder="hr, day, unit"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Night Multiplier
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="1.0"
                    value={subcontractorShiftMultiplier}
                    onChange={(e) => setSubcontractorShiftMultiplier(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">Crew Size</label>
                  <input
                    type="number"
                    min="1"
                    value={subcontractorCrewSize}
                    onChange={(e) => setSubcontractorCrewSize(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Capacity (Hrs/Wk)
                  </label>
                  <input
                    type="number"
                    min="10"
                    value={subcontractorWeeklyCapacity}
                    onChange={(e) => setSubcontractorWeeklyCapacity(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-700 font-medium mb-1">
                  Operating Base / Region
                </label>
                <input
                  type="text"
                  value={subcontractorLocation}
                  onChange={(e) => setSubcontractorLocation(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>
            </div>
          )}

          {/* 3. MATERIAL FORM */}
          {selectedType === 'material' && (
            <div className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
              {/* Name, Code & Barcode */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 50mm Aluminium Frame Profile"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#003049]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      if (!barcode || barcode === code) setBarcode(e.target.value);
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#003049]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Barcode
                  </label>
                  <input
                    type="text"
                    placeholder="Auto or scan barcode"
                    value={barcode || code}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#003049]"
                  />
                </div>
              </div>

              {/* Connected Category & Sub-Category via SearchableCategoryPicker with search bar connected to DB */}
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <SearchableCategoryPicker
                  categories={categories && categories.length > 0 ? categories : INITIAL_CATEGORY_HIERARCHY}
                  selectedCategory={category}
                  selectedSubCategory={subCategory}
                  onCategoryChange={(catName, node) => {
                    setCategory(catName);
                    if (node) setCategoryId(node.id);
                  }}
                  onSubCategoryChange={(subName, node) => {
                    setSubCategory(subName);
                    if (node) setSubCategoryId(node.id);
                  }}
                  onAddNewCategory={(newCat) => {
                    api.createCategory(newCat).catch(console.error);
                    setCategory(newCat.name);
                    setCategoryId(newCat.id);
                  }}
                  onAddNewSubCategory={(newSub) => {
                    api.createCategory(newSub).catch(console.error);
                    setSubCategory(newSub.name);
                    setSubCategoryId(newSub.id);
                  }}
                  group="material"
                  categoryLabel="Category (Connected to Database)"
                  subCategoryLabel="Sub-Category (Connected to Database)"
                  required={true}
                />
              </div>

              {/* Description & Specifications */}
              <div>
                <label className="block text-xs text-slate-700 font-medium mb-1">Description &amp; Technical Specifications</label>
                <textarea
                  rows={2}
                  placeholder="Material specifications, dimensions, tolerances, and quality compliance"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600"
                />
              </div>

              {/* Price, Cost, Unit, Status */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Retail Price ({currSymbol})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Cost Price ({currSymbol})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={costPrice}
                    onChange={(e) => setCostPrice(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">Unit of Measure</label>
                  <select
                    value={unit}
                    onChange={(e) => {
                      const selUnit = e.target.value;
                      setUnit(selUnit);
                      const found = STANDARD_MEASUREMENT_UNITS.find(u => u.code === selUnit);
                      if (found) setDefaultUnitId(found.id);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                  >
                    {STANDARD_MEASUREMENT_UNITS.map(u => (
                      <option key={u.code} value={u.code}>
                        {u.name} ({u.symbol})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">Status</label>
                  <select
                    value={materialStatus}
                    onChange={(e) => setMaterialStatus(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="Available">Available</option>
                    <option value="In Stock">In Stock</option>
                    <option value="Lead Exist">Lead Exist</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>

              {/* Stock & Supplier */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">In Stock Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <SearchablePartnerPicker
                    label="Approved Preferred Supplier / Partner"
                    selectedPartner={supplierName}
                    onPartnerChange={(pName) => setSupplierName(pName)}
                    partners={partnerOptions}
                    onAddNewPartner={(pName) => {
                      api.createSupplier({ name: pName, country: 'Sri Lanka' }).catch(console.error);
                      setSupplierName(pName);
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 4. PRODUCT / REVENUE DELIVERABLE FORM */}
          {/* ========================================================================= */}
          {selectedType === 'produce' && (
            <div className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>Manufactured Product / Revenue Deliverable</span>
                </span>
                <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded">
                  Connected to Database & Revenue Catalogue
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Product / Deliverable Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 5-Axis Precision Aerospace Bracket"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#003049]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">Product Code (Auto)</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#003049]"
                  />
                </div>
              </div>

              {/* Connected Category & Sub-Category via SearchableCategoryPicker */}
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <SearchableCategoryPicker
                  categories={categories && categories.length > 0 ? categories : INITIAL_CATEGORY_HIERARCHY}
                  selectedCategory={category}
                  selectedSubCategory={subCategory}
                  onCategoryChange={(catName, node) => {
                    setCategory(catName);
                    if (node) setCategoryId(node.id);
                  }}
                  onSubCategoryChange={(subName, node) => {
                    setSubCategory(subName);
                    if (node) setSubCategoryId(node.id);
                  }}
                  onAddNewCategory={(newCat) => {
                    api.createCategory(newCat).catch(console.error);
                    setCategory(newCat.name);
                    setCategoryId(newCat.id);
                  }}
                  onAddNewSubCategory={(newSub) => {
                    api.createCategory(newSub).catch(console.error);
                    setSubCategory(newSub.name);
                    setSubCategoryId(newSub.id);
                  }}
                  group="product"
                  categoryLabel="Product Category (Connected to Database)"
                  subCategoryLabel="Sub-Category (Connected to Database)"
                  required={true}
                />
              </div>

              {/* Pricing & Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Quoted Selling Rate ({currSymbol}) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-emerald-700 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Internal Unit Cost ({currSymbol})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={costPrice}
                    onChange={(e) => setCostPrice(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-semibold text-slate-700 focus:outline-none focus:border-[#003049]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">Unit of Measure</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="pcs, unit, assembly"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003049]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 5. OVERHEAD COST ALLOCATION RECORD FORM */}
          {/* ========================================================================= */}
          {selectedType === 'overhead' && (
            <div className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-600" />
                  <span>Overhead Cost Allocation Record</span>
                </span>
                <span className="text-[10px] bg-amber-100 text-amber-900 font-semibold px-2 py-0.5 rounded">
                  Connected to Database & Overhead Portal
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Overhead Item Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CNC Cutting Fluids & Chemical Agents"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">Code (Auto)</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
              </div>

              {/* Connected Category & Sub-Category via SearchableCategoryPicker */}
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <SearchableCategoryPicker
                  categories={categories && categories.length > 0 ? categories : INITIAL_CATEGORY_HIERARCHY}
                  selectedCategory={category}
                  selectedSubCategory={subCategory}
                  onCategoryChange={(catName, node) => {
                    setCategory(catName);
                    if (node) setCategoryId(node.id);
                  }}
                  onSubCategoryChange={(subName, node) => {
                    setSubCategory(subName);
                    if (node) setSubCategoryId(node.id);
                  }}
                  onAddNewCategory={(newCat) => {
                    api.createCategory(newCat).catch(console.error);
                    setCategory(newCat.name);
                    setCategoryId(newCat.id);
                  }}
                  onAddNewSubCategory={(newSub) => {
                    api.createCategory(newSub).catch(console.error);
                    setSubCategory(newSub.name);
                    setSubCategoryId(newSub.id);
                  }}
                  group="overhead"
                  categoryLabel="Overhead Category (Connected to Database)"
                  subCategoryLabel="Overhead Sub-Category (Connected to Database)"
                  required={true}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Rate Base / Percentage (%) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-amber-800 focus:outline-none focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">Unit Type</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="pct, unit, month, hr"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 6. OUTSOURCED SERVICE / TARIFF FORM */}
          {/* ========================================================================= */}
          {selectedType === 'outsourced' && (
            <div className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                  <span>Outsourced Service Provider & Tariff</span>
                </span>
                <span className="text-[10px] bg-teal-100 text-teal-900 font-semibold px-2 py-0.5 rounded">
                  Connected to Database & Service Tariffs
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Service / Tariff Process Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hard Anodize Type III Mil-Spec Finishing"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">Code (Auto)</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              {/* Connected Category & Sub-Category via SearchableCategoryPicker */}
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <SearchableCategoryPicker
                  categories={categories && categories.length > 0 ? categories : INITIAL_CATEGORY_HIERARCHY}
                  selectedCategory={category}
                  selectedSubCategory={subCategory}
                  onCategoryChange={(catName, node) => {
                    setCategory(catName);
                    if (node) setCategoryId(node.id);
                  }}
                  onSubCategoryChange={(subName, node) => {
                    setSubCategory(subName);
                    if (node) setSubCategoryId(node.id);
                  }}
                  onAddNewCategory={(newCat) => {
                    api.createCategory(newCat).catch(console.error);
                    setCategory(newCat.name);
                    setCategoryId(newCat.id);
                  }}
                  onAddNewSubCategory={(newSub) => {
                    api.createCategory(newSub).catch(console.error);
                    setSubCategory(newSub.name);
                    setSubCategoryId(newSub.id);
                  }}
                  group="outsourced"
                  categoryLabel="Service Category (Connected to Database)"
                  subCategoryLabel="Service Sub-Category (Connected to Database)"
                  required={true}
                />
              </div>

              {/* Provider via SearchablePartnerPicker */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <SearchablePartnerPicker
                  label="Assigned Service Provider / Partner"
                  selectedPartner={supplierName}
                  onPartnerChange={(pName) => setSupplierName(pName)}
                  partners={partnerOptions}
                  onAddNewPartner={(pName) => {
                    api.createSupplier({ name: pName, country: 'Sri Lanka' }).catch(console.error);
                    setSupplierName(pName);
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Direct Tariff Cost ({currSymbol}) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={costPrice}
                    onChange={(e) => setCostPrice(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Quoted Retail ({currSymbol}) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-teal-800 focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">Base Unit</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="per_hour, per_km, per_unit"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 7. OTHER ENTITIES (PROJECT, CLIENT) */}
          {/* ========================================================================= */}
          {(selectedType === 'project' || selectedType === 'client') && (
            <div className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    {selectedType === 'client' ? 'Client Enterprise Name *' : 'Project Title *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003049]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">Code (Auto)</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#003049]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">Industry / Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003049]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">Location / Base</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003049]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    Target Quoted Value ({currSymbol})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#003049]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">Currency</label>
                  <input
                    type="text"
                    disabled
                    value={currency}
                    className="w-full bg-slate-100 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Card Color & Gradient Theme Selector for New Item */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="block text-xs font-medium text-slate-700 mb-2">
              Card Color &amp; Gradient Theme
            </label>
            <ColorGradientPicker
              compact
              selectedThemeId={themeId}
              onSelectTheme={(newTheme, newCustom) => {
                setThemeId(newTheme);
                setCustomGradient(newCustom);
              }}
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-[#0078d4] hover:bg-[#006cbd] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 4. UNIVERSAL EDIT CARD MODAL
// ==========================================
interface EditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: string;
  id: string;
  initialData: Record<string, any>;
  categories?: CategoryNode[];
  onSave: (id: string, updatedData: Record<string, any>) => void;
}

export const EditItemModal: React.FC<EditItemModalProps> = ({
  isOpen,
  onClose,
  itemType,
  id,
  initialData,
  categories,
  onSave
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    setFormData({
      currency: initialData?.currency || 'LKR',
      ...initialData
    });
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const currentCurrency = formData.currency || 'LKR';
  const currencyInfo = SUPPORTED_CURRENCIES.find((c) => c.code === currentCurrency) || { symbol: 'Rs.', code: 'LKR', name: 'Sri Lanka Rupee' };

  const handleChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(id, formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">
            Edit {formData.name || formData.title || itemType}
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {itemType === 'project' ? (
            <div className="space-y-3">
              {/* Project Name & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-600 mb-1 font-normal">Project Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name || formData.title || ''}
                    onChange={(e) => {
                      handleChange('name', e.target.value);
                      handleChange('title', e.target.value);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003049]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1 font-normal">Project Code</label>
                  <input
                    type="text"
                    required
                    value={formData.code || ''}
                    onChange={(e) => handleChange('code', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-[#003049]"
                  />
                </div>
              </div>

              {/* Client Name, Status & Currency Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1 font-normal">Client Organization</label>
                  <input
                    type="text"
                    value={formData.clientName || ''}
                    onChange={(e) => handleChange('clientName', e.target.value)}
                    placeholder="e.g. Boeing Tier-1 Aero Structures"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003049]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1 font-normal">Project Status</label>
                  <select
                    value={formData.status || 'Proposal'}
                    onChange={(e) => handleChange('status', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003049]"
                  >
                    <option value="Proposal">Proposal</option>
                    <option value="Quoted">Quoted</option>
                    <option value="Budget Approved">Budget Approved</option>
                    <option value="In Execution">In Execution</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Contract Signed & Locked">Contract Signed & Locked</option>
                    <option value="Review">Review</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1 font-normal">Currency Selection *</label>
                  <select
                    value={formData.currency || 'LKR'}
                    onChange={(e) => handleChange('currency', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#003049]"
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} ({c.symbol}) - {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Target Product / Deliverable */}
              <div>
                <label className="block text-xs text-slate-600 mb-1 font-normal">Target Product / Machine System</label>
                <input
                  type="text"
                  value={formData.targetProduct || ''}
                  onChange={(e) => handleChange('targetProduct', e.target.value)}
                  placeholder="e.g. Hydraulic Multi-Axis Precision Forming Station"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003049]"
                />
              </div>

              {/* Financials: Quoted Price, Target Margin %, Overhead %, Contingency % */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1 font-normal">
                    Quoted Price ({currentCurrency === 'LKR' ? 'LKR / Rs.' : `${currentCurrency} (${currencyInfo.symbol})`})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.quotedPrice ?? 0}
                    onChange={(e) => handleChange('quotedPrice', Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#003049]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1 font-normal">Target Margin (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.targetMarginPct ?? 35}
                    onChange={(e) => handleChange('targetMarginPct', Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003049]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1 font-normal">Overhead (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.overheadPct ?? 8.5}
                    onChange={(e) => handleChange('overheadPct', Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003049]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1 font-normal">Contingency (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.contingencyPct ?? 5.0}
                    onChange={(e) => handleChange('contingencyPct', Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003049]"
                  />
                </div>
              </div>

              {/* Start Date & Delivery Deadline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1 font-normal">Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate || ''}
                    onChange={(e) => handleChange('startDate', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003049]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1 font-normal">Delivery Deadline</label>
                  <input
                    type="date"
                    value={formData.deliveryDeadline || ''}
                    onChange={(e) => handleChange('deliveryDeadline', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003049]"
                  />
                </div>
              </div>

              {/* Scope Notes */}
              <div>
                <label className="block text-xs text-slate-600 mb-1 font-normal">Project Scope Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes || ''}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-900 focus:outline-none focus:border-[#003049]"
                />
              </div>
            </div>
          ) : (
            <>
              {/* Main Title / Name */}
              <div>
                <label className="block text-xs text-slate-600 mb-1 font-normal">Card / Entity Name</label>
                <input
                  type="text"
                  required
                  value={formData.title || formData.name || formData.subcontractorName || formData.providerName || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (formData.title !== undefined) handleChange('title', val);
                    if (formData.name !== undefined) handleChange('name', val);
                    if (formData.subcontractorName !== undefined) handleChange('subcontractorName', val);
                    if (formData.providerName !== undefined) handleChange('providerName', val);
                  }}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003049]"
                />
              </div>

              {/* Brief Words / Subtitle */}
              {(formData.brief !== undefined || formData.tagline !== undefined) && (
                <div>
                  <label className="block text-xs text-slate-600 mb-1 font-normal">Brief Words / Description</label>
                  <input
                    type="text"
                    value={formData.brief || formData.tagline || ''}
                    onChange={(e) => {
                      if (formData.brief !== undefined) handleChange('brief', e.target.value);
                      if (formData.tagline !== undefined) handleChange('tagline', e.target.value);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003049]"
                  />
                </div>
              )}

              {/* Category / Scope */}
              {itemType === 'material' && categories ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-700 font-medium mb-1">Category *</label>
                      <select
                        value={
                          formData.categoryId ||
                          categories.find((c) => c.name.toLowerCase() === (formData.category || '').toLowerCase())?.id ||
                          ''
                        }
                        onChange={(e) => {
                          const newCatId = e.target.value;
                          const catNode = categories.find((c) => c.id === newCatId);
                          handleChange('categoryId', newCatId || null);
                          handleChange('category', catNode?.name || '');

                          // Requirement 11: Validate or clear incompatible subcategory
                          if (formData.subCategoryId) {
                            const currentSub = categories.find((c) => c.id === formData.subCategoryId);
                            if (!currentSub || currentSub.parentId !== newCatId) {
                              handleChange('subCategoryId', null);
                              handleChange('subCategory', '');
                            }
                          }
                        }}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003049]"
                      >
                        <option value="">-- Select Category --</option>
                        {categories
                          .filter((c) => (c.group === 'material' || !c.parentId) && (c.type === 'category' || !c.parentId))
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-700 font-medium mb-1">Sub-Category</label>
                      {(() => {
                        const curCatId =
                          formData.categoryId ||
                          categories.find((c) => c.name.toLowerCase() === (formData.category || '').toLowerCase())?.id;
                        const subCats = categories.filter(
                          (c) => c.parentId === curCatId && (c.type === 'sub_category' || c.type === 'subcategory')
                        );
                        return (
                          <select
                            value={formData.subCategoryId || ''}
                            disabled={!curCatId}
                            onChange={(e) => {
                              const newSubId = e.target.value;
                              const subNode = categories.find((c) => c.id === newSubId);
                              handleChange('subCategoryId', newSubId || null);
                              handleChange('subCategory', subNode?.name || '');
                            }}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003049] disabled:bg-slate-100"
                          >
                            <option value="">{curCatId ? '-- Select Subcategory --' : '-- Select Category First --'}</option>
                            {subCats.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-700 font-medium mb-1">Barcode</label>
                      <input
                        type="text"
                        value={formData.barcode || ''}
                        onChange={(e) => handleChange('barcode', e.target.value)}
                        placeholder="Barcode identifier"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#003049]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-700 font-medium mb-1">Unit of Measure</label>
                      <select
                        value={formData.unit || 'pcs'}
                        onChange={(e) => {
                          handleChange('unit', e.target.value);
                          const found = STANDARD_MEASUREMENT_UNITS.find((u) => u.code === e.target.value);
                          if (found) handleChange('defaultUnitId', found.id);
                        }}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003049]"
                      >
                        {STANDARD_MEASUREMENT_UNITS.map((u) => (
                          <option key={u.code} value={u.code}>
                            {u.name} ({u.symbol})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-700 font-medium mb-1">Description &amp; Specifications</label>
                    <textarea
                      rows={2}
                      value={formData.description || ''}
                      onChange={(e) => handleChange('description', e.target.value)}
                      placeholder="Material specifications, grade, and tolerances"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003049]"
                    />
                  </div>
                </div>
              ) : (formData.category || formData.serviceType || formData.supplyScope) ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1 font-normal">Category / Classification</label>
                    <input
                      type="text"
                      value={formData.category || formData.serviceType || ''}
                      onChange={(e) => {
                        if (formData.category !== undefined) handleChange('category', e.target.value);
                        if (formData.serviceType !== undefined) handleChange('serviceType', e.target.value);
                      }}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003049]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1 font-normal">Sub-Scope / Sub-Category</label>
                    <input
                      type="text"
                      value={formData.subCategory || formData.supplyScope || formData.location || ''}
                      onChange={(e) => {
                        if (formData.subCategory !== undefined) handleChange('subCategory', e.target.value);
                        if (formData.supplyScope !== undefined) handleChange('supplyScope', e.target.value);
                        if (formData.location !== undefined) handleChange('location', e.target.value);
                      }}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003049]"
                    />
                  </div>
                </div>
              ) : null}

              {/* Pricing / Values / Rates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(formData.quotedPrice !== undefined || formData.unitPrice !== undefined || formData.retailPrice !== undefined || formData.totalQuotedValue !== undefined || formData.rate !== undefined || formData.baseRate !== undefined) && (
                  <div>
                    <label className="block text-xs text-slate-600 mb-1 font-normal">
                      {formData.quotedPrice !== undefined
                        ? `Quoted Price (${currencyInfo.symbol})`
                        : formData.totalQuotedValue !== undefined
                        ? `Total Quoted Value (${currencyInfo.symbol})`
                        : formData.baseRate !== undefined
                        ? `Base Hourly Rate (${currencyInfo.symbol})`
                        : `Unit / Retail Rate (${currencyInfo.symbol})`}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={
                        formData.quotedPrice ??
                        formData.unitPrice ??
                        formData.retailPrice ??
                        formData.totalQuotedValue ??
                        formData.rate ??
                        formData.baseRate ??
                        0
                      }
                      onChange={(e) => {
                        const num = Number(e.target.value);
                        if (formData.quotedPrice !== undefined) handleChange('quotedPrice', num);
                        if (formData.unitPrice !== undefined) handleChange('unitPrice', num);
                        if (formData.retailPrice !== undefined) handleChange('retailPrice', num);
                        if (formData.totalQuotedValue !== undefined) handleChange('totalQuotedValue', num);
                        if (formData.rate !== undefined) handleChange('rate', num);
                        if (formData.baseRate !== undefined) handleChange('baseRate', num);
                      }}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003049]"
                    />
                  </div>
                )}

                {(formData.costPrice !== undefined || formData.inStock !== undefined || formData.targetMarginPct !== undefined || formData.rating !== undefined || formData.skillLevel !== undefined) && (
                  <div>
                    <label className="block text-xs text-slate-600 mb-1 font-normal">
                      {formData.targetMarginPct !== undefined
                        ? 'Target Margin (%)'
                        : formData.inStock !== undefined
                        ? 'In Stock Qty'
                        : formData.rating !== undefined
                        ? 'Rating (out of 5.0)'
                        : formData.costPrice !== undefined
                        ? 'Unit Cost ($)'
                        : 'Certification / Skill Level'}
                    </label>
                    <input
                      type={formData.skillLevel !== undefined ? 'text' : 'number'}
                      step="any"
                      value={
                        formData.targetMarginPct ??
                        formData.inStock ??
                        formData.rating ??
                        formData.costPrice ??
                        formData.skillLevel ??
                        ''
                      }
                      onChange={(e) => {
                        const val = formData.skillLevel !== undefined ? e.target.value : Number(e.target.value);
                        if (formData.targetMarginPct !== undefined) handleChange('targetMarginPct', val);
                        if (formData.inStock !== undefined) handleChange('inStock', val);
                        if (formData.rating !== undefined) handleChange('rating', val);
                        if (formData.costPrice !== undefined) handleChange('costPrice', val);
                        if (formData.skillLevel !== undefined) handleChange('skillLevel', val);
                      }}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#003049]"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {/* Universal Card Color & Gradient Theme Selector (All Cards, Categories, Subcategories, Items & Records) */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="block text-xs font-medium text-slate-700 mb-2">
              Card Color &amp; Gradient Theme
            </label>
            <ColorGradientPicker
              compact
              selectedThemeId={formData.themeId || 'pacific-sky'}
              onSelectTheme={(newTheme, newCustom) => {
                handleChange('themeId', newTheme);
                handleChange('customGradient', newCustom);
              }}
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-[#0078d4] hover:bg-[#006cbd] text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 5. DELETE CONFIRMATION MODAL
// ==========================================
interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  entityType: string;
  onConfirm: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  title,
  entityType,
  onConfirm
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Delete {entityType}?</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-600 py-3">
          Delete <strong className="text-slate-900">{title}</strong>?
        </p>

        <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
