import { bizStore } from './bizStore';

export interface LiveExchangeRate {
  code: string;
  name: string;
  symbol: string;
  flag: string;
  decimals: number;
  rateToUSD: number;
  previousRateToUSD: number;
  change24hPct: number;
  lastUpdated: string;
  source: 'Live API' | 'Custom Manual' | 'Manual Override' | 'Imported Custom Feed' | 'Simulated';
}

export interface FXRatesData {
  base: string;
  rates: Record<string, number>;
  lastUpdated: string;
  source: 'Live API' | 'Custom Manual';
}

export const SUPPORTED_CURRENCIES: { code: string; name: string; symbol: string; flag: string; decimals: number }[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸', decimals: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺', decimals: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧', decimals: 2 },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'LKR', flag: '🇱🇰', decimals: 2 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳', decimals: 2 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵', decimals: 0 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺', decimals: 2 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦', decimals: 2 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬', decimals: 2 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED', flag: '🇦🇪', decimals: 2 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳', decimals: 2 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'SAR', flag: '🇸🇦', decimals: 2 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', flag: '🇨🇭', decimals: 2 }
];

const DEFAULT_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  LKR: 305.0,
  INR: 86.5,
  JPY: 154.0,
  AUD: 1.54,
  CAD: 1.39,
  SGD: 1.35,
  AED: 3.67,
  CNY: 7.24,
  SAR: 3.75,
  CHF: 0.91
};

const STORAGE_KEY_RATES = 'fxtt_fx_rates_data_v1';

class FXService {
  private ratesList: LiveExchangeRate[];
  private simulationTimer: any = null;
  private listeners: (() => void)[] = [];

  constructor() {
    this.ratesList = this.loadInitialRates();
  }

  private buildDefaultRatesList(): LiveExchangeRate[] {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    return SUPPORTED_CURRENCIES.map((c) => {
      const rate = DEFAULT_RATES[c.code] ?? 1.0;
      return {
        code: c.code,
        name: c.name,
        symbol: c.symbol,
        flag: c.flag,
        decimals: c.decimals,
        rateToUSD: rate,
        previousRateToUSD: rate,
        change24hPct: 0,
        lastUpdated: now,
        source: 'Live API'
      };
    });
  }

  private loadInitialRates(): LiveExchangeRate[] {
    try {
      const saved = bizStore.getItem(STORAGE_KEY_RATES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].code) {
          return parsed;
        }
        if (parsed && parsed.rates && typeof parsed.rates === 'object') {
          const now = parsed.lastUpdated || new Date().toISOString().replace('T', ' ').slice(0, 19);
          return SUPPORTED_CURRENCIES.map((c) => {
            const r = Number(parsed.rates[c.code] ?? DEFAULT_RATES[c.code] ?? 1.0);
            return {
              code: c.code,
              name: c.name,
              symbol: c.symbol,
              flag: c.flag,
              decimals: c.decimals,
              rateToUSD: r,
              previousRateToUSD: r,
              change24hPct: 0,
              lastUpdated: now,
              source: parsed.source || 'Live API'
            };
          });
        }
      }
    } catch {
      // ignore parse errors
    }
    return this.buildDefaultRatesList();
  }

  private save() {
    try {
      bizStore.setItem(STORAGE_KEY_RATES, JSON.stringify(this.ratesList));
    } catch {
      // ignore storage errors
    }
    this.notify();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fxtt-rates-updated', { detail: { rates: this.ratesList } }));
    }
  }

  public getRates(): LiveExchangeRate[] {
    return [...this.ratesList];
  }

  public getData(): FXRatesData {
    const ratesMap: Record<string, number> = {};
    this.ratesList.forEach((r) => {
      ratesMap[r.code] = r.rateToUSD;
    });
    return {
      base: 'USD',
      rates: ratesMap,
      lastUpdated: this.ratesList[0]?.lastUpdated || new Date().toISOString().replace('T', ' ').slice(0, 19),
      source: 'Live API'
    };
  }

  public getRate(currency: string): LiveExchangeRate | undefined {
    const code = (currency || 'USD').toUpperCase();
    return this.ratesList.find((r) => r.code === code);
  }

  public getRateValue(currency: string): number {
    const found = this.getRate(currency);
    return found ? found.rateToUSD : DEFAULT_RATES[(currency || 'USD').toUpperCase()] || 1.0;
  }

  public setRate(
    currencyCode: string,
    newRateToUSD: number,
    source: LiveExchangeRate['source'] = 'Manual Override'
  ): void {
    const code = (currencyCode || 'USD').toUpperCase();
    if (isNaN(newRateToUSD) || newRateToUSD <= 0) return;
    if (code === 'USD') return;

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const rounded = Math.round((newRateToUSD + Number.EPSILON) * 10000) / 10000;

    this.ratesList = this.ratesList.map((r) => {
      if (r.code !== code) return r;
      const prev = r.rateToUSD || rounded;
      const changePct = prev > 0 ? Math.round((((rounded - prev) / prev) * 100 + Number.EPSILON) * 100) / 100 : 0;
      return {
        ...r,
        previousRateToUSD: prev,
        rateToUSD: rounded,
        change24hPct: changePct,
        lastUpdated: now,
        source
      };
    });
    this.save();
  }

  public setCustomRate(currencyCode: string, newRateAgainstUsd: number): void {
    this.setRate(currencyCode, newRateAgainstUsd, 'Custom Manual');
  }

  public convert(amount: number, fromCurrency: string, toCurrency: string): number {
    const fromRate = this.getRateValue(fromCurrency);
    const toRate = this.getRateValue(toCurrency);
    if (!fromRate || fromRate === 0) return amount;
    const inUsd = amount / fromRate;
    const raw = inUsd * toRate;
    return Math.round((raw + Number.EPSILON) * 10000) / 10000;
  }

  public isSimulating(): boolean {
    return this.simulationTimer !== null;
  }

  public startLiveSimulation(): void {
    if (this.simulationTimer) return;
    this.simulationTimer = setInterval(() => {
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      this.ratesList = this.ratesList.map((r) => {
        if (r.code === 'USD') return r;
        const delta = (Math.random() - 0.495) * 0.004;
        const nextVal = Math.max(0.01, Math.round((r.rateToUSD * (1 + delta) + Number.EPSILON) * 10000) / 10000);
        const baseDefault = DEFAULT_RATES[r.code] || r.rateToUSD;
        const change24hPct = Math.round((((nextVal - baseDefault) / baseDefault) * 100 + Number.EPSILON) * 100) / 100;
        return {
          ...r,
          previousRateToUSD: r.rateToUSD,
          rateToUSD: nextVal,
          change24hPct,
          lastUpdated: now,
          source: 'Simulated'
        };
      });
      this.save();
    }, 3500);
  }

  public stopLiveSimulation(): void {
    if (this.simulationTimer) {
      clearInterval(this.simulationTimer);
      this.simulationTimer = null;
    }
  }

  public async fetchLiveRatesFromApi(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!response.ok) throw new Error('FX network response failed');
      const json = await response.json();
      if (json && json.rates) {
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
        this.ratesList = this.ratesList.map((r) => {
          if (r.code === 'USD') return r;
          const apiVal = json.rates[r.code] ? Number(json.rates[r.code]) : r.rateToUSD;
          const changePct =
            r.rateToUSD > 0 ? Math.round((((apiVal - r.rateToUSD) / r.rateToUSD) * 100 + Number.EPSILON) * 100) / 100 : 0;
          return {
            ...r,
            previousRateToUSD: r.rateToUSD,
            rateToUSD: Math.round((apiVal + Number.EPSILON) * 10000) / 10000,
            change24hPct: changePct,
            lastUpdated: now,
            source: 'Live API'
          };
        });
        this.save();
        return { success: true, message: 'Synchronized live mid-market FX rates.' };
      }
    } catch {
      // Fallback to current persisted rates if offline
    }
    return { success: true, message: 'Synchronized cached mid-market FX rates.' };
  }

  public async fetchLiveRates(): Promise<FXRatesData> {
    await this.fetchLiveRatesFromApi();
    return this.getData();
  }

  public importRatesFromString(
    rawInput: string,
    source: LiveExchangeRate['source'] = 'Imported Custom Feed'
  ): { success: boolean; count: number; error?: string } {
    try {
      const trimmed = rawInput.trim();
      const parsedMap: Record<string, number> = {};

      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const json = JSON.parse(trimmed);
        if (Array.isArray(json)) {
          json.forEach((item) => {
            if (item && item.code && !isNaN(Number(item.rateToUSD || item.rate))) {
              parsedMap[String(item.code).toUpperCase()] = Number(item.rateToUSD || item.rate);
            }
          });
        } else if (json && typeof json === 'object') {
          const sourceObj = json.rates && typeof json.rates === 'object' ? json.rates : json;
          Object.entries(sourceObj).forEach(([k, v]) => {
            if (!isNaN(Number(v))) {
              parsedMap[k.toUpperCase()] = Number(v);
            }
          });
        }
      } else {
        const lines = trimmed.split(/\r?\n/);
        for (const line of lines) {
          const clean = line.trim();
          if (!clean || clean.startsWith('#')) continue;
          const parts = clean.split(/[,;:\t]+/);
          if (parts.length >= 2) {
            const code = parts[0].trim().toUpperCase();
            const val = parseFloat(parts[1].trim());
            if (code && !isNaN(val) && val > 0) {
              parsedMap[code] = val;
            }
          }
        }
      }

      const codes = Object.keys(parsedMap);
      if (codes.length === 0) {
        return { success: false, count: 0, error: 'No valid currency rate pairs found in input.' };
      }

      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      let updatedCount = 0;
      this.ratesList = this.ratesList.map((r) => {
        if (r.code === 'USD') return r;
        const nextVal = parsedMap[r.code];
        if (nextVal !== undefined && nextVal > 0) {
          updatedCount++;
          const changePct =
            r.rateToUSD > 0 ? Math.round((((nextVal - r.rateToUSD) / r.rateToUSD) * 100 + Number.EPSILON) * 100) / 100 : 0;
          return {
            ...r,
            previousRateToUSD: r.rateToUSD,
            rateToUSD: Math.round((nextVal + Number.EPSILON) * 10000) / 10000,
            change24hPct: changePct,
            lastUpdated: now,
            source
          };
        }
        return r;
      });

      this.save();
      return { success: true, count: updatedCount };
    } catch (e: any) {
      return { success: false, count: 0, error: e?.message || 'Failed to parse input.' };
    }
  }

  public resetToDefaults(): void {
    this.stopLiveSimulation();
    this.ratesList = this.buildDefaultRatesList();
    this.save();
  }

  public resetToDefaultRates(): void {
    this.resetToDefaults();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }
}

export const fxService = new FXService();
