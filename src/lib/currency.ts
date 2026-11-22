import { CURRENCIES, CurrencyCode, SUPPORTED_COUNTRIES } from '../types/marketplace';

export const DEFAULT_EXCHANGE_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  INR: 84.5,
  GBP: 0.79,
  EUR: 0.94,
  AED: 3.67,
  CAD: 1.4,
  AUD: 1.54,
};

export function detectLocaleCountryAndCurrency(): {
  country: string;
  currency: CurrencyCode;
} {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const lang = (navigator.language || '').toUpperCase();

    if (tz.includes('Kolkata') || tz.includes('Calcutta') || lang.endsWith('-IN')) {
      return { country: 'India', currency: 'INR' };
    }
    if (tz.includes('London') || lang.endsWith('-GB')) {
      return { country: 'United Kingdom', currency: 'GBP' };
    }
    if (tz.includes('Dubai') || lang.endsWith('-AE')) {
      return { country: 'United Arab Emirates', currency: 'AED' };
    }
    if (tz.includes('Toronto') || tz.includes('Vancouver') || lang.endsWith('-CA')) {
      return { country: 'Canada', currency: 'CAD' };
    }
    if (tz.includes('Sydney') || tz.includes('Melbourne') || lang.endsWith('-AU')) {
      return { country: 'Australia', currency: 'AUD' };
    }
    if (tz.includes('Berlin') || tz.includes('Paris') || tz.includes('Amsterdam')) {
      return { country: 'Germany', currency: 'EUR' };
    }
  } catch {
    // Fallback to US / USD
  }
  return { country: 'United States', currency: 'USD' };
}

export function getCurrencyForCountry(countryName: string): CurrencyCode {
  const match = SUPPORTED_COUNTRIES.find((c) => c.name === countryName);
  return match ? match.defaultCurrency : 'USD';
}

export function isIndiaCountry(countryName: string): boolean {
  return countryName === 'India';
}

export function convertUsdToCurrency(
  amountUsd: number,
  targetCurrency: CurrencyCode,
  rates: Record<string, number>
): number {
  const rate = rates[targetCurrency] || DEFAULT_EXCHANGE_RATES[targetCurrency] || 1;
  return Number((amountUsd * rate).toFixed(2));
}

export function convertCurrencyToUsd(
  amount: number,
  sourceCurrency: CurrencyCode,
  rates: Record<string, number>
): number {
  const rate = rates[sourceCurrency] || DEFAULT_EXCHANGE_RATES[sourceCurrency] || 1;
  if (rate <= 0) return amount;
  return Number((amount / rate).toFixed(2));
}

export function formatFromUsd(
  amountUsd: number,
  currency: CurrencyCode,
  rates: Record<string, number>
): string {
  const converted = convertUsdToCurrency(amountUsd, currency, rates);
  const info = CURRENCIES[currency] || CURRENCIES.USD;
  const formatted = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    minimumFractionDigits: converted >= 100 ? 0 : 2,
    maximumFractionDigits: converted >= 100 ? 0 : 2,
  }).format(converted);
  return `${info.symbol}${formatted}`;
}

export function formatExactCurrency(amount: number, currency: CurrencyCode): string {
  const info = CURRENCIES[currency] || CURRENCIES.USD;
  const formatted = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    minimumFractionDigits: amount >= 100 ? 0 : 2,
    maximumFractionDigits: amount >= 100 ? 0 : 2,
  }).format(amount);
  return `${info.symbol}${formatted}`;
}
