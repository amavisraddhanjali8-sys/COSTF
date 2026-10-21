import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  Plus,
  Check,
  X,
  Layers,
  FolderTree
} from 'lucide-react';
import { CategoryNode } from '../../data/categoriesAndProfiles';
import { api } from '../../services/api';
import { persistentDatabase } from '../../services/persistentDatabase';

export interface SearchableCategoryPickerProps {
  categories: CategoryNode[];
  selectedCategory: string;
  selectedSubCategory?: string;
  onCategoryChange: (categoryName: string, categoryNode?: CategoryNode) => void;
  onSubCategoryChange?: (subCategoryName: string, subCategoryNode?: CategoryNode) => void;
  onAddNewCategory?: (newCategory: CategoryNode) => void;
  onAddNewSubCategory?: (newSubCategory: CategoryNode) => void;
  group?: 'material' | 'product' | 'service' | 'subcontractor' | 'outsourced' | 'overhead' | 'all';
  categoryLabel?: string;
  subCategoryLabel?: string;
  required?: boolean;
  className?: string;
  showSubCategory?: boolean;
  disabled?: boolean;
}

export const SearchableCategoryPicker: React.FC<SearchableCategoryPickerProps> = ({
  categories = [],
  selectedCategory,
  selectedSubCategory = '',
  onCategoryChange,
  onSubCategoryChange,
  onAddNewCategory,
  onAddNewSubCategory,
  group = 'all',
  categoryLabel = 'Category',
  subCategoryLabel = 'Sub-Category',
  required = false,
  className = '',
  showSubCategory = true,
  disabled = false
}) => {
  // Category dropdown state
  const [isCatOpen, setIsCatOpen] = useState(false);
  const [catSearch, setCatSearch] = useState('');
  const catRef = useRef<HTMLDivElement>(null);
  const catInputRef = useRef<HTMLInputElement>(null);

  // Sub-Category dropdown state
  const [isSubOpen, setIsSubOpen] = useState(false);
  const [subSearch, setSubSearch] = useState('');
  const subRef = useRef<HTMLDivElement>(null);
  const subInputRef = useRef<HTMLInputElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node)) {
        setIsCatOpen(false);
      }
      if (subRef.current && !subRef.current.contains(e.target as Node)) {
        setIsSubOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter Level-1 categories by group
  const availableCategories = useMemo(() => {
    return categories.filter((c) => {
      if (c.type === 'sub_category') return false;
      if (group === 'all') return true;
      if (group === 'service') return c.group === 'service' || c.group === 'outsourced' || c.group === 'subcontractor';
      if (group === 'product') return c.group === 'product' || c.group === 'revenue';
      return c.group === group;
    });
  }, [categories, group]);

  // Find currently selected category node
  const activeCategoryNode = useMemo(() => {
    return availableCategories.find(
      (c) => c.name.toLowerCase() === (selectedCategory || '').toLowerCase()
    ) || categories.find((c) => c.name.toLowerCase() === (selectedCategory || '').toLowerCase());
  }, [availableCategories, categories, selectedCategory]);

  // Filter Sub-categories under the selected category
  const availableSubCategories = useMemo(() => {
    if (!selectedCategory) {
      // Show all sub-categories for this group if no category is picked yet
      return categories.filter((c) => {
        if (c.type !== 'sub_category') return false;
        if (group === 'all') return true;
        if (group === 'service') return c.group === 'service' || c.group === 'outsourced' || c.group === 'subcontractor';
        if (group === 'product') return c.group === 'product' || c.group === 'revenue';
        return c.group === group;
      });
    }

    return categories.filter((c) => {
      if (c.type !== 'sub_category') return false;
      if (activeCategoryNode && c.parentId === activeCategoryNode.id) return true;
      if (c.parentName && c.parentName.toLowerCase() === selectedCategory.toLowerCase()) return true;
      return false;
    });
  }, [categories, selectedCategory, activeCategoryNode, group]);

  // Search filtered category list
  const filteredCategories = useMemo(() => {
    if (!catSearch.trim()) return availableCategories;
    const q = catSearch.toLowerCase();
    return availableCategories.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.brief && c.brief.toLowerCase().includes(q))
    );
  }, [availableCategories, catSearch]);

  // Search filtered sub-category list
  const filteredSubCategories = useMemo(() => {
    if (!subSearch.trim()) return availableSubCategories;
    const q = subSearch.toLowerCase();
    return availableSubCategories.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.brief && c.brief.toLowerCase().includes(q))
    );
  }, [availableSubCategories, subSearch]);

  // Handler: create a new category on the fly
  const handleCreateNewCategory = async (catName: string) => {
    const trimmed = catName.trim();
    if (!trimmed) return;

    const newId = `cat-user-${Date.now()}`;
    const targetGroup = group === 'all' ? 'material' : group;
    const newNode: CategoryNode = {
      id: newId,
      name: trimmed,
      type: 'category',
      group: targetGroup,
      brief: `${trimmed} catalogue category`,
      itemCount: 0,
      themeId: 'pacific-sky',
      metaBadge: 'CUSTOM CATEGORY',
      actionText: 'EXPLORE ITEMS'
    };

    // Persist to central storage
    persistentDatabase.addCategory(newNode);
    api.createCategory(newNode).catch((err) => console.warn('Could not sync new category to backend:', err));

    if (targetGroup === 'overhead') {
      api.createOverheadCategory({
        name: trimmed,
        description: newNode.brief,
        defaultAllocationMethod: 'percentage_of_direct',
        isActive: true
      }).catch((err) => console.warn('Could not sync overhead category to backend:', err));
    } else if (targetGroup === 'product' || targetGroup === 'revenue') {
      api.createRevenueCategory({
        name: trimmed,
        description: newNode.brief,
        isActive: true
      }).catch((err) => console.warn('Could not sync revenue category to backend:', err));
    }

    if (onAddNewCategory) {
      onAddNewCategory(newNode);
    }
    onCategoryChange(trimmed, newNode);
    setCatSearch('');
    setIsCatOpen(false);
  };

  // Handler: create a new sub-category on the fly
  const handleCreateNewSubCategory = async (subName: string) => {
    const trimmed = subName.trim();
    if (!trimmed) return;

    const newId = `subcat-user-${Date.now()}`;
    const targetGroup = activeCategoryNode ? activeCategoryNode.group : (group === 'all' ? 'material' : group);
    const newNode: CategoryNode = {
      id: newId,
      name: trimmed,
      type: 'sub_category',
      group: targetGroup,
      parentId: activeCategoryNode?.id,
      parentName: selectedCategory || activeCategoryNode?.name || 'General',
      brief: `${trimmed} sub-category classification`,
      itemCount: 0,
      themeId: 'napa-purple',
      metaBadge: 'SUB-CATEGORY',
      actionText: 'VIEW ITEMS'
    };

    // Persist to central storage
    persistentDatabase.addCategory(newNode);
    api.createCategory(newNode).catch((err) => console.warn('Could not sync new sub-category to backend:', err));

    if (targetGroup === 'product' || targetGroup === 'revenue') {
      api.createRevenueSubcategory({
        categoryId: activeCategoryNode?.id,
        name: trimmed,
        description: newNode.brief,
        isActive: true
      }).catch((err) => console.warn('Could not sync revenue subcategory to backend:', err));
    }

    if (onAddNewSubCategory) {
      onAddNewSubCategory(newNode);
    }
    if (onSubCategoryChange) {
      onSubCategoryChange(trimmed, newNode);
    }
    setSubSearch('');
    setIsSubOpen(false);
  };

  return (
    <div className={`grid grid-cols-1 ${showSubCategory ? 'sm:grid-cols-2' : ''} gap-2.5 ${className}`}>
      {/* 1. Category Field with Searchable Dropdown */}
      <div className="relative" ref={catRef}>
        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs flex items-center justify-between">
          <span>
            {categoryLabel} {required && <span className="text-rose-500 font-bold">*</span>}
          </span>
          {selectedCategory && (
            <span className="text-[10px] text-blue-600 dark:text-sky-400 font-normal">
              Database Linked
            </span>
          )}
        </label>

        {/* Display / Trigger Button */}
        <div
          onClick={() => {
            if (disabled) return;
            setIsCatOpen(!isCatOpen);
            setTimeout(() => catInputRef.current?.focus(), 50);
          }}
          className={`w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
            disabled
              ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-200'
              : isCatOpen
              ? 'border-blue-500 ring-1 ring-blue-500 bg-white dark:bg-slate-800'
              : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
          }`}
        >
          <div className="flex items-center space-x-1.5 truncate">
            <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className={selectedCategory ? 'text-slate-900 dark:text-slate-100 font-medium' : 'text-slate-400'}>
              {selectedCategory || 'Select category...'}
            </span>
          </div>
          <div className="flex items-center space-x-1 shrink-0">
            {selectedCategory && !disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCategoryChange('');
                  if (onSubCategoryChange) onSubCategoryChange('');
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>

        {/* Category Dropdown Popover */}
        {isCatOpen && !disabled && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 space-y-1.5 animate-in fade-in zoom-in-95 max-w-sm sm:max-w-none">
            {/* Search Input Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={catInputRef}
                type="text"
                value={catSearch}
                onChange={(e) => setCatSearch(e.target.value)}
                placeholder="Search database categories..."
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Category Options List */}
            <div className="max-h-48 overflow-y-auto space-y-0.5 pr-0.5">
              {filteredCategories.length > 0 ? (
                filteredCategories.map((c) => {
                  const isSelected = selectedCategory.toLowerCase() === c.name.toLowerCase();
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        onCategoryChange(c.name, c);
                        setIsCatOpen(false);
                        setCatSearch('');
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-sky-300 font-semibold'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <span className="truncate">{c.name}</span>
                        {c.group && (
                          <span className="text-[9px] uppercase px-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                            {c.group}
                          </span>
                        )}
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400 shrink-0" />}
                    </div>
                  );
                })
              ) : (
                <div className="py-2 px-3 text-center text-xs text-slate-400">
                  No matching category found in database.
                </div>
              )}
            </div>

            {/* Quick Add Custom Category button */}
            {catSearch.trim() && !filteredCategories.some((c) => c.name.toLowerCase() === catSearch.trim().toLowerCase()) && (
              <button
                type="button"
                onClick={() => handleCreateNewCategory(catSearch)}
                className="w-full mt-1 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-left px-2 py-1 text-xs font-semibold text-blue-600 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create category &quot;{catSearch.trim()}&quot;</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2. Sub-Category Field with Searchable Dropdown */}
      {showSubCategory && (
        <div className="relative" ref={subRef}>
          <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs flex items-center justify-between">
            <span>{subCategoryLabel}</span>
            {selectedSubCategory && (
              <span className="text-[10px] text-blue-600 dark:text-sky-400 font-normal">
                Sub-Tier Linked
              </span>
            )}
          </label>

          {/* Display / Trigger Button */}
          <div
            onClick={() => {
              if (disabled) return;
              setIsSubOpen(!isSubOpen);
              setTimeout(() => subInputRef.current?.focus(), 50);
            }}
            className={`w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
              disabled
                ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-200'
                : isSubOpen
                ? 'border-blue-500 ring-1 ring-blue-500 bg-white dark:bg-slate-800'
                : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
            }`}
          >
            <div className="flex items-center space-x-1.5 truncate">
              <FolderTree className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className={selectedSubCategory ? 'text-slate-900 dark:text-slate-100 font-medium' : 'text-slate-400'}>
                {selectedSubCategory || (selectedCategory ? 'Select sub-category...' : 'Choose category first...')}
              </span>
            </div>
            <div className="flex items-center space-x-1 shrink-0">
              {selectedSubCategory && !disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSubCategoryChange) onSubCategoryChange('');
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>

          {/* Sub-Category Dropdown Popover */}
          {isSubOpen && !disabled && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 space-y-1.5 animate-in fade-in zoom-in-95 max-w-sm sm:max-w-none">
              {/* Search Input Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={subInputRef}
                  type="text"
                  value={subSearch}
                  onChange={(e) => setSubSearch(e.target.value)}
                  placeholder={
                    selectedCategory
                      ? `Search sub-categories in ${selectedCategory}...`
                      : 'Search sub-categories...'
                  }
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Sub-Category Options List */}
              <div className="max-h-48 overflow-y-auto space-y-0.5 pr-0.5">
                {filteredSubCategories.length > 0 ? (
                  filteredSubCategories.map((sc) => {
                    const isSelected = selectedSubCategory.toLowerCase() === sc.name.toLowerCase();
                    return (
                      <div
                        key={sc.id}
                        onClick={() => {
                          if (onSubCategoryChange) {
                            onSubCategoryChange(sc.name, sc);
                          }
                          // If parent category is not yet selected, also auto-set parent
                          if (!selectedCategory && sc.parentName) {
                            onCategoryChange(sc.parentName);
                          }
                          setIsSubOpen(false);
                          setSubSearch('');
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-sky-300 font-semibold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <span className="truncate">{sc.name}</span>
                          {sc.parentName && !selectedCategory && (
                            <span className="text-[9px] text-slate-400">
                              (in {sc.parentName})
                            </span>
                          )}
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400 shrink-0" />}
                      </div>
                    );
                  })
                ) : (
                  <div className="py-2 px-3 text-center text-xs text-slate-400">
                    {selectedCategory
                      ? `No sub-categories defined under "${selectedCategory}" yet.`
                      : 'No matching sub-categories found.'}
                  </div>
                )}
              </div>

              {/* Quick Add Custom Sub-Category button */}
              {subSearch.trim() && !filteredSubCategories.some((c) => c.name.toLowerCase() === subSearch.trim().toLowerCase()) && (
                <button
                  type="button"
                  onClick={() => handleCreateNewSubCategory(subSearch)}
                  className="w-full mt-1 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-left px-2 py-1 text-xs font-semibold text-blue-600 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded flex items-center space-x-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    Create sub-category &quot;{subSearch.trim()}&quot;
                    {selectedCategory ? ` in ${selectedCategory}` : ''}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
