import React, { useState, useEffect, useRef } from 'react';
import {
  Layers,
  Building2,
  Users,
  Truck,
  Boxes,
  FolderGit2,
  MoreVertical,
  Table,
  Plus,
  ExternalLink,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import {
  MaterialItem,
  Supplier,
  SubcontractorRateItem,
  OutsourcedService,
  ProduceItem,
  Project
} from '../types';
import { ActiveTab } from './TopNavbar';

export interface FXTTOpenPayload {
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
    | 'produce';
  cardId?: string;
  cardTitle: string;
  cardSubtitle?: string;
  cardTag?: string;
}

interface HomeTelemetryCardsProps {
  materials: MaterialItem[];
  suppliers: Supplier[];
  subcontractors: SubcontractorRateItem[];
  outsourcedServices: OutsourcedService[];
  produceItems: ProduceItem[];
  projects: Project[];
  onOpenFXTT: (payload: FXTTOpenPayload) => void;
  onOpenAddModal: (portalType: string) => void;
  onNavigateTab: (tabId: ActiveTab) => void;
  showToast: (msg: string) => void;
}

interface TelemetryCardItem {
  id: string;
  label: string;
  count: number;
  icon: React.ReactNode;
  bgGradient: string;
  hasActiveDot?: boolean;
  trendText: string;
  fxttPayload: FXTTOpenPayload;
  addPortalType: string;
  entityName: string;
}

export const HomeTelemetryCards: React.FC<HomeTelemetryCardsProps> = ({
  materials,
  suppliers,
  subcontractors,
  outsourcedServices,
  produceItems,
  projects,
  onOpenFXTT,
  onOpenAddModal,
  onNavigateTab,
  showToast
}) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close popover when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenuId(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Compute live values and stats
  const activeProjectsCount = projects.filter(
    (p) => p.status === 'In Progress' || p.status === 'Planning'
  ).length || projects.length;

  const cardsData: TelemetryCardItem[] = [
    {
      id: 'materials',
      label: 'Materials',
      count: materials.length,
      icon: <Layers className="w-5 h-5 text-white" />,
      bgGradient: 'bg-gradient-to-br from-[#4f46e5] via-[#4338ca] to-[#3730a3]',
      hasActiveDot: false,
      trendText: 'Stocked',
      fxttPayload: {
        cardType: 'material_category',
        cardId: 'all',
        cardTitle: 'Materials & Parts Directory',
        cardSubtitle: `${materials.length} Raw Materials, Alloys, Fasteners & Parts`,
        cardTag: 'MATERIALS & PARTS'
      },
      addPortalType: 'material',
      entityName: 'Material Item'
    },
    {
      id: 'suppliers',
      label: 'Suppliers',
      count: suppliers.length,
      icon: <Building2 className="w-5 h-5 text-white" />,
      bgGradient: 'bg-gradient-to-br from-[#059669] via-[#047857] to-[#065f46]',
      hasActiveDot: true,
      trendText: 'Verified',
      fxttPayload: {
        cardType: 'supplier',
        cardId: 'all',
        cardTitle: 'Suppliers Directory & Vendor Catalog',
        cardSubtitle: `${suppliers.length} Approved Enterprise Vendors & Active Procured Items`,
        cardTag: 'SUPPLIERS'
      },
      addPortalType: 'supplier',
      entityName: 'Supplier'
    },
    {
      id: 'subcontractors',
      label: 'Trades',
      count: subcontractors.length,
      icon: <Users className="w-5 h-5 text-white" />,
      bgGradient: 'bg-gradient-to-br from-[#7c3aed] via-[#6d28d9] to-[#5b21b6]',
      hasActiveDot: false,
      trendText: 'Trades',
      fxttPayload: {
        cardType: 'subcontractor',
        cardId: 'all',
        cardTitle: 'Specialist Labor Roster & Subcontractors',
        cardSubtitle: `${subcontractors.length} Trade Specialists, Shift Multipliers & Field Crews`,
        cardTag: 'LABOR ROSTER'
      },
      addPortalType: 'subcontractor',
      entityName: 'Subcontractor'
    },
    {
      id: 'finishing',
      label: 'Tariffs',
      count: outsourcedServices.length,
      icon: <Truck className="w-5 h-5 text-white" />,
      bgGradient: 'bg-gradient-to-br from-[#d97706] via-[#b45309] to-[#92400e]',
      hasActiveDot: false,
      trendText: 'Tariffs',
      fxttPayload: {
        cardType: 'service_provider',
        cardId: 'all',
        cardTitle: 'Outsourced Finishing & Surface Treatment Tariffs',
        cardSubtitle: `${outsourcedServices.length} Active Industrial Finishing Processes & Tariffs`,
        cardTag: 'FINISHING TARIFFS'
      },
      addPortalType: 'outsourced',
      entityName: 'Finishing Service'
    },
    {
      id: 'produce',
      label: 'Products',
      count: produceItems.length,
      icon: <Boxes className="w-5 h-5 text-white" />,
      bgGradient: 'bg-gradient-to-br from-[#e11d48] via-[#be123c] to-[#9f1239]',
      hasActiveDot: false,
      trendText: 'Products',
      fxttPayload: {
        cardType: 'produce',
        cardId: 'all',
        cardTitle: 'Manufactured Products & Assembly SKUs',
        cardSubtitle: `${produceItems.length} Finished Good SKUs, Target Quoted Prices & Specs`,
        cardTag: 'PRODUCTS CATALOG'
      },
      addPortalType: 'produce',
      entityName: 'Product SKU'
    },
    {
      id: 'projects',
      label: 'Projects',
      count: projects.length,
      icon: <FolderGit2 className="w-5 h-5 text-white" />,
      bgGradient: 'bg-gradient-to-br from-[#0284c7] via-[#0369a1] to-[#075985]',
      hasActiveDot: true,
      trendText: 'Active',
      fxttPayload: {
        cardType: 'project',
        cardId: 'all',
        cardTitle: 'Capital Projects Portfolio & Quotations',
        cardSubtitle: `${projects.length} Active Industrial Deliverables & Commercial Contracts`,
        cardTag: 'PROJECTS'
      },
      addPortalType: 'project',
      entityName: 'Project'
    }
  ];

  return (
    <div className="space-y-2.5">
      {/* Cards Grid - Fully Colored Cards with One-Word Labels and No Lines */}
      <div
        id="home-telemetry-cards-container"
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5 sm:gap-4"
      >
        {cardsData.map((item) => (
          <div
            key={item.id}
            id={`telemetry-card-${item.id}`}
            onClick={() => onOpenFXTT(item.fxttPayload)}
            className={`group relative ${item.bgGradient} rounded-[22px] p-4 sm:p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer flex flex-col justify-between select-none text-white`}
          >
            {/* Top Row: Icon Container & Three-Dots Menu */}
            <div className="flex items-start justify-between mb-4">
              {/* Rounded Square Icon Badge */}
              <div
                className="relative w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs border border-white/25 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105"
              >
                {item.icon}
                {item.hasActiveDot && (
                  <span
                    className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white bg-emerald-300 shadow-xs"
                  />
                )}
              </div>

              {/* Three-Dots Menu */}
              <div className="relative" ref={openMenuId === item.id ? menuRef : null}>
                <button
                  id={`btn-card-menu-${item.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(openMenuId === item.id ? null : item.id);
                  }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
                  title="Card Options"
                  aria-label={`Options for ${item.label}`}
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {/* Dropdown Popover */}
                {openMenuId === item.id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-200"
                  >
                    <button
                      onClick={() => {
                        setOpenMenuId(null);
                        onOpenFXTT(item.fxttPayload);
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 flex items-center space-x-2 transition-colors cursor-pointer"
                    >
                      <Table className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span>Open Grid</span>
                    </button>
                    <button
                      onClick={() => {
                        setOpenMenuId(null);
                        onOpenAddModal(item.addPortalType);
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-emerald-600 flex items-center space-x-2 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Add Item</span>
                    </button>
                    <button
                      onClick={() => {
                        setOpenMenuId(null);
                        onNavigateTab('directory-hub');
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-sky-600 flex items-center space-x-2 transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      <span>Directory</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Row: Figure, One-word Status on Top, and Unclipped One-word Label Below */}
            <div className="pt-2">
              <div className="flex items-baseline justify-between gap-2">
                <div
                  id={`stat-count-${item.id}`}
                  className="text-2xl sm:text-[32px] font-black text-white tracking-tight leading-none tabular-nums"
                >
                  {item.count}
                </div>
                {item.trendText && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-white/20 backdrop-blur-xs border border-white/25 text-white whitespace-nowrap shadow-2xs">
                    {item.trendText}
                  </span>
                )}
              </div>
              <div className="text-xs sm:text-sm font-bold text-white/95 mt-2 uppercase tracking-wider overflow-visible whitespace-nowrap">
                {item.label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
