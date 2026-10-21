import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  Plus,
  Check,
  X,
  Building2,
  Users,
  ShieldCheck,
  Truck
} from 'lucide-react';

export interface PartnerOption {
  id: string;
  name: string;
  type?: 'supplier' | 'subcontractor' | 'provider' | 'client' | string;
  categoryOrTrade?: string;
  country?: string;
}

export interface SearchablePartnerPickerProps {
  label?: string;
  selectedPartner: string;
  onPartnerChange: (partnerName: string, partnerObj?: PartnerOption) => void;
  partners: PartnerOption[];
  placeholder?: string;
  partnerTypeLabel?: string;
  onAddNewPartner?: (name: string) => void;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

export const SearchablePartnerPicker: React.FC<SearchablePartnerPickerProps> = ({
  label = 'Assigned Supplier / Partner',
  selectedPartner,
  onPartnerChange,
  partners = [],
  placeholder = 'Select supplier / partner...',
  partnerTypeLabel = 'Partner',
  onAddNewPartner,
  required = false,
  className = '',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredPartners = useMemo(() => {
    if (!search.trim()) return partners;
    const q = search.toLowerCase();
    return partners.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.categoryOrTrade && p.categoryOrTrade.toLowerCase().includes(q)) ||
        (p.country && p.country.toLowerCase().includes(q))
    );
  }, [partners, search]);

  const handleCreatePartner = (customName: string) => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    if (onAddNewPartner) {
      onAddNewPartner(trimmed);
    }
    onPartnerChange(trimmed, {
      id: `partner-custom-${Date.now()}`,
      name: trimmed,
      type: 'partner'
    });
    setSearch('');
    setIsOpen(false);
  };

  const getPartnerIcon = (type?: string) => {
    if (type === 'subcontractor') return <Users className="w-3.5 h-3.5 text-indigo-500 shrink-0" />;
    if (type === 'provider') return <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
    return <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs flex items-center justify-between">
        <span>
          {label} {required && <span className="text-rose-500 font-bold">*</span>}
        </span>
        {selectedPartner && (
          <span className="text-[10px] text-blue-600 dark:text-sky-400 font-normal">
            Database Linked
          </span>
        )}
      </label>

      {/* Trigger Button */}
      <div
        onClick={() => {
          if (disabled) return;
          setIsOpen(!isOpen);
          setTimeout(() => searchInputRef.current?.focus(), 50);
        }}
        className={`w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-200'
            : isOpen
            ? 'border-blue-500 ring-1 ring-blue-500 bg-white dark:bg-slate-800'
            : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
        }`}
      >
        <div className="flex items-center space-x-1.5 truncate">
          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className={selectedPartner ? 'text-slate-900 dark:text-slate-100 font-medium' : 'text-slate-400'}>
            {selectedPartner || placeholder}
          </span>
        </div>
        <div className="flex items-center space-x-1 shrink-0">
          {selectedPartner && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPartnerChange('');
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>

      {/* Popover */}
      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 space-y-1.5 animate-in fade-in zoom-in-95">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${partnerTypeLabel.toLowerCase()}s...`}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* List */}
          <div className="max-h-48 overflow-y-auto space-y-0.5 pr-0.5">
            {filteredPartners.length > 0 ? (
              filteredPartners.map((p) => {
                const isSelected = selectedPartner.toLowerCase() === p.name.toLowerCase();
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      onPartnerChange(p.name, p);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-sky-300 font-semibold'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      {getPartnerIcon(p.type)}
                      <span className="truncate">{p.name}</span>
                      {p.categoryOrTrade && (
                        <span className="text-[10px] text-slate-400 truncate">
                          ({p.categoryOrTrade})
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400 shrink-0" />}
                  </div>
                );
              })
            ) : (
              <div className="py-2 px-3 text-center text-xs text-slate-400">
                No matching partner found.
              </div>
            )}
          </div>

          {/* Quick Create Custom Partner option */}
          {search.trim() && !filteredPartners.some((p) => p.name.toLowerCase() === search.trim().toLowerCase()) && (
            <button
              type="button"
              onClick={() => handleCreatePartner(search)}
              className="w-full mt-1 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-left px-2 py-1 text-xs font-semibold text-blue-600 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded flex items-center space-x-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Use &quot;{search.trim()}&quot; as {partnerTypeLabel}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
