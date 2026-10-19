export interface TileTheme {
  id: string;
  name: string;
  gradientClass: string;
  previewColor: string;
}

export const TILE_GRADIENT_PRESETS: TileTheme[] = [
  {
    id: 'pacific-sky',
    name: 'Pacific Sky',
    gradientClass: 'bg-gradient-to-br from-[#0284c7] via-[#0369a1] to-[#1e3a8a]',
    previewColor: '#0284c7'
  },
  {
    id: 'airbus-cobalt',
    name: 'Airbus Cobalt',
    gradientClass: 'bg-gradient-to-br from-[#003049] via-[#1d4ed8] to-[#312e81]',
    previewColor: '#003049'
  },
  {
    id: 'emerald-oasis',
    name: 'Emerald Oasis',
    gradientClass: 'bg-gradient-to-br from-[#059669] via-[#047857] to-[#064e3b]',
    previewColor: '#059669'
  },
  {
    id: 'napa-purple',
    name: 'Napa Purple',
    gradientClass: 'bg-gradient-to-br from-[#7c3aed] via-[#5b21b6] to-[#312e81]',
    previewColor: '#7c3aed'
  },
  {
    id: 'crimson-horizon',
    name: 'Crimson Horizon',
    gradientClass: 'bg-gradient-to-br from-[#dc2626] via-[#991b1b] to-[#450a0a]',
    previewColor: '#dc2626'
  },
  {
    id: 'amber-forge',
    name: 'Amber Forge',
    gradientClass: 'bg-gradient-to-br from-[#d97706] via-[#b45309] to-[#78350f]',
    previewColor: '#d97706'
  },
  {
    id: 'slate-titanium',
    name: 'Slate Titanium',
    gradientClass: 'bg-gradient-to-br from-[#334155] via-[#1e293b] to-[#0f172a]',
    previewColor: '#334155'
  },
  {
    id: 'teal-deep',
    name: 'Teal Deep',
    gradientClass: 'bg-gradient-to-br from-[#0d9488] via-[#115e59] to-[#134e4a]',
    previewColor: '#0d9488'
  },
  {
    id: 'indigo-night',
    name: 'Indigo Night',
    gradientClass: 'bg-gradient-to-br from-[#4f46e5] via-[#3730a3] to-[#1e1b4b]',
    previewColor: '#4f46e5'
  },
  {
    id: 'rose-quartz',
    name: 'Rose Quartz',
    gradientClass: 'bg-gradient-to-br from-[#e11d48] via-[#9f1239] to-[#4c0519]',
    previewColor: '#e11d48'
  }
];

export function getThemeById(id?: string): TileTheme {
  if (!id) return TILE_GRADIENT_PRESETS[0];
  return TILE_GRADIENT_PRESETS.find((t) => t.id === id) || TILE_GRADIENT_PRESETS[0];
}

export function getRandomThemeIndex(index: number = 0): TileTheme {
  const safeIdx = Math.abs(index) % TILE_GRADIENT_PRESETS.length;
  return TILE_GRADIENT_PRESETS[safeIdx];
}
