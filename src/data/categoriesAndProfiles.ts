export interface CategoryNode {
  id: string;
  name: string;
  type: 'category' | 'sub_category' | 'sub_sub_category' | string;
  group: 'material' | 'product' | 'service' | 'subcontractor' | 'outsourced' | string;
  parentId?: string;
  parentName?: string;
  brief: string;
  itemCount?: number;
  themeId?: string;
  customGradient?: string;
  icon?: string;
  metaBadge?: string;
  actionText?: string;
}

export interface ClientProfile {
  id: string;
  name: string;
  tagline: string;
  industry: string;
  location: string;
  status: 'Active Partner' | 'Key Account' | 'Prospective' | 'Archived' | string;
  activeProjectsCount: number;
  totalQuotedValue: number;
  contactPerson: string;
  email: string;
  phone?: string;
  themeId?: string;
  customGradient?: string;
}

export const INITIAL_CLIENT_PROFILES: ClientProfile[] = [];

export const INITIAL_CATEGORY_HIERARCHY: CategoryNode[] = [
  {
    id: 'mat-cat-01',
    name: 'Metals & Structural Alloys',
    type: 'category',
    group: 'material',
    brief: 'Aerospace grade aluminum, stainless steels, and tool alloys',
    itemCount: 0,
    themeId: 'pacific-sky',
    metaBadge: 'CATALOG ROOT',
    actionText: 'EXPLORE SUB-CATEGORIES'
  },
  {
    id: 'mat-sub-01-01',
    name: 'Aluminum Bar & Sheet',
    type: 'sub_category',
    group: 'material',
    parentId: 'mat-cat-01',
    parentName: 'Metals & Structural Alloys',
    brief: '6061-T6 and 7075-T6 structural stocks',
    itemCount: 0,
    themeId: 'airbus-cobalt',
    metaBadge: 'SUB-CATEGORY',
    actionText: 'VIEW DEEP SPECS'
  },
  {
    id: 'mat-sub-01-02',
    name: 'Stainless Steels',
    type: 'sub_category',
    group: 'material',
    parentId: 'mat-cat-01',
    parentName: 'Metals & Structural Alloys',
    brief: '304 and 316L corrosion resistant grades',
    itemCount: 0,
    themeId: 'slate-titanium',
    metaBadge: 'SUB-CATEGORY',
    actionText: 'VIEW DEEP SPECS'
  },
  {
    id: 'mat-cat-02',
    name: 'Polymers & Engineering Plastics',
    type: 'category',
    group: 'material',
    brief: 'Acetal, PEEK, Nylon, and PTFE rods and sheets',
    itemCount: 0,
    themeId: 'emerald-oasis',
    metaBadge: 'CATALOG ROOT',
    actionText: 'EXPLORE SUB-CATEGORIES'
  },
  {
    id: 'mat-sub-02-01',
    name: 'Acetal & Delrin',
    type: 'sub_category',
    group: 'material',
    parentId: 'mat-cat-02',
    parentName: 'Polymers & Engineering Plastics',
    brief: 'High-rigidity machinable plastics',
    itemCount: 0,
    themeId: 'teal-deep',
    metaBadge: 'SUB-CATEGORY',
    actionText: 'VIEW DEEP SPECS'
  },
  {
    id: 'mat-cat-03',
    name: 'Fasteners & Precision Hardware',
    type: 'category',
    group: 'material',
    brief: 'Grade 8 socket head bolts, inserts, and dowel pins',
    itemCount: 0,
    themeId: 'amber-forge',
    metaBadge: 'CATALOG ROOT',
    actionText: 'EXPLORE SUB-CATEGORIES'
  },
  {
    id: 'mat-sub-03-01',
    name: 'Socket Head Cap Screws',
    type: 'sub_category',
    group: 'material',
    parentId: 'mat-cat-03',
    parentName: 'Fasteners & Precision Hardware',
    brief: 'High tensile metric fasteners',
    itemCount: 0,
    themeId: 'amber-forge',
    metaBadge: 'SUB-CATEGORY',
    actionText: 'VIEW DEEP SPECS'
  },
  {
    id: 'prod-cat-01',
    name: 'Precision CNC Machined Parts',
    type: 'category',
    group: 'product',
    brief: 'Tight tolerance aerospace and tooling assemblies',
    itemCount: 0,
    themeId: 'airbus-cobalt',
    metaBadge: 'CATALOG ROOT',
    actionText: 'EXPLORE SUB-CATEGORIES'
  },
  {
    id: 'prod-sub-01-01',
    name: '5-Axis Aerospace Brackets',
    type: 'sub_category',
    group: 'product',
    parentId: 'prod-cat-01',
    parentName: 'Precision CNC Machined Parts',
    brief: 'Lightweight high-strength aircraft structural mounts',
    itemCount: 0,
    themeId: 'pacific-sky',
    metaBadge: 'SUB-CATEGORY',
    actionText: 'VIEW DEEP SPECS'
  },
  {
    id: 'sub-cat-01',
    name: 'Precision Machining & Toolmaking',
    type: 'category',
    group: 'subcontractor',
    brief: 'Master machinists and EDM wire specialists',
    itemCount: 0,
    themeId: 'napa-purple',
    metaBadge: 'HIRED SUBCONTRACTOR',
    actionText: 'EXPLORE TRADES & RATES'
  },
  {
    id: 'sub-sub-01-01',
    name: 'CNC Milling Specialist',
    type: 'sub_category',
    group: 'subcontractor',
    parentId: 'sub-cat-01',
    parentName: 'Precision Machining & Toolmaking',
    brief: 'Level 4 certified aerospace machinist crew',
    itemCount: 0,
    themeId: 'indigo-night',
    metaBadge: 'SUB-CATEGORY',
    actionText: 'VIEW DEEP SPECS'
  },
  {
    id: 'serv-cat-01',
    name: 'Surface Treatment & Anodizing',
    type: 'category',
    group: 'outsourced',
    brief: 'MIL-A-8625 Hardcoat Type III and chemical conversion',
    itemCount: 0,
    themeId: 'teal-deep',
    metaBadge: 'OUTSOURCED',
    actionText: 'EXPLORE SUB-CATEGORIES'
  },
  {
    id: 'serv-sub-01-01',
    name: 'Hard Anodize Type III',
    type: 'sub_category',
    group: 'outsourced',
    parentId: 'serv-cat-01',
    parentName: 'Surface Treatment & Anodizing',
    brief: 'Military specification 50-micron hardcoat',
    itemCount: 0,
    themeId: 'emerald-oasis',
    metaBadge: 'SUB-CATEGORY',
    actionText: 'VIEW DEEP SPECS'
  }
];
