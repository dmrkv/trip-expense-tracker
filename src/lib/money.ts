/** Currencies that historically use 0 minor digits (no fractional unit). */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'JPY',
  'KRW',
  'VND',
  'CLP',
  'ISK',
  'XOF',
  'XAF',
  'XPF',
  'BIF',
  'DJF',
  'GNF',
  'PYG',
  'RWF',
  'UGX',
  'VUV',
  'KMF',
]);

/** Currencies that use 3 minor digits. */
const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);

export function fractionDigits(currency: string): number {
  const code = currency.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3;
  return 2;
}

/** Convert a string like "12.34" → integer minor units (1234). */
export function parseToMinor(input: string, currency: string): number {
  const digits = fractionDigits(currency);
  const trimmed = input.replace(/[\s,]/g, (m) => (m === ',' ? '.' : '')).trim();
  if (!trimmed) return 0;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * Math.pow(10, digits));
}

/** Format integer minor units to a localized currency string. */
export function formatMoney(amountMinor: number, currency: string, locale?: string): string {
  const digits = fractionDigits(currency);
  const major = amountMinor / Math.pow(10, digits);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(major);
  } catch {
    return `${major.toFixed(digits)} ${currency}`;
  }
}

/** Plain numeric formatting without a currency symbol — for input editors. */
export function formatMinorNumeric(amountMinor: number, currency: string): string {
  const digits = fractionDigits(currency);
  return (amountMinor / Math.pow(10, digits)).toFixed(digits);
}
