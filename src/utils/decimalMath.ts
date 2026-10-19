/**
 * Decimal-Safe Financial Arithmetic Engine
 * Uses scaled integer arithmetic (BigInt at 10^4 internal scale) with standard
 * commercial ROUND_HALF_UP rounding to eliminate IEEE-754 floating-point drift.
 */

const SCALE_4 = 10000n;
const SCALE_2 = 100n;

/**
 * Parse a number or numeric string into a scaled BigInt (scale = 10^4)
 * with HALF_UP rounding at the 4th decimal place.
 */
export function toScaled4(value: number | string | null | undefined): bigint {
  if (value === null || value === undefined || value === '') return 0n;
  const num = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
  if (!Number.isFinite(num)) return 0n;

  // Convert via fixed string with 6 decimals to avoid binary float representation artifacts
  const sign = num < 0 ? -1n : 1n;
  const absStr = Math.abs(num).toFixed(6);
  const [intPart, fracPart = '000000'] = absStr.split('.');
  const paddedFrac = (fracPart + '000000').slice(0, 6);
  const first4 = BigInt(paddedFrac.slice(0, 4));
  const fifthDigit = Number(paddedFrac[4] || '0');
  const roundedFrac = fifthDigit >= 5 ? first4 + 1n : first4;
  const scaled = BigInt(intPart) * SCALE_4 + roundedFrac;
  return sign * scaled;
}

/**
 * Convert a scaled-4 BigInt back to a standard number rounded to 2 decimal places (ROUND_HALF_UP).
 */
export function fromScaled4To2(scaled: bigint): number {
  const sign = scaled < 0n ? -1n : 1n;
  const abs = scaled < 0n ? -scaled : scaled;
  // Divide by 100 with half-up rounding to get scale 2
  const quotient = (abs + 50n) / 100n;
  const result = Number(sign * quotient) / 100;
  return Object.is(result, -0) ? 0 : result;
}

/**
 * Convert a scaled-4 BigInt back to a standard number rounded to 4 decimal places.
 */
export function fromScaled4(scaled: bigint): number {
  const result = Number(scaled) / 10000;
  return Object.is(result, -0) ? 0 : result;
}

/**
 * Round any number or string to 2 decimal places using exact commercial ROUND_HALF_UP.
 */
export function round2(value: number | string | null | undefined): number {
  return fromScaled4To2(toScaled4(value));
}

/**
 * Round any number or string to 1 decimal place using commercial ROUND_HALF_UP.
 */
export function round1(value: number | string | null | undefined): number {
  const scaled = toScaled4(value);
  const sign = scaled < 0n ? -1n : 1n;
  const abs = scaled < 0n ? -scaled : scaled;
  const quotient = (abs + 500n) / 1000n;
  const result = Number(sign * quotient) / 10;
  return Object.is(result, -0) ? 0 : result;
}

/**
 * Round any number or string to 4 decimal places using commercial ROUND_HALF_UP.
 */
export function round4(value: number | string | null | undefined): number {
  return fromScaled4(toScaled4(value));
}

export function decAdd(a: number | string | null | undefined, b: number | string | null | undefined): number {
  return fromScaled4(toScaled4(a) + toScaled4(b));
}

export function decSub(a: number | string | null | undefined, b: number | string | null | undefined): number {
  return fromScaled4(toScaled4(a) - toScaled4(b));
}

export function decMul(a: number | string | null | undefined, b: number | string | null | undefined): number {
  const sa = toScaled4(a);
  const sb = toScaled4(b);
  const prod = sa * sb;
  const sign = prod < 0n ? -1n : 1n;
  const abs = prod < 0n ? -prod : prod;
  const scaled = sign * ((abs + 5000n) / SCALE_4);
  return fromScaled4(scaled);
}

export function decDiv(
  numerator: number | string | null | undefined,
  denominator: number | string | null | undefined
): number {
  const sNum = toScaled4(numerator);
  const sDen = toScaled4(denominator);
  if (sDen === 0n) return 0;
  const sign = (sNum < 0n) !== (sDen < 0n) ? -1n : 1n;
  const absNum = sNum < 0n ? -sNum : sNum;
  const absDen = sDen < 0n ? -sDen : sDen;
  const quotient = (absNum * SCALE_4 + absDen / 2n) / absDen;
  return fromScaled4(sign * quotient);
}

/**
 * Calculate discounted line item total:
 * subtotal = quantity * unitPrice
 * discountAmount = subtotal * (discountPct / 100)
 * total = subtotal - discountAmount
 */
export function calcDiscountedLine(
  quantity: number | string | null | undefined,
  unitPrice: number | string | null | undefined,
  discountPct: number | string | null | undefined = 0
): { subtotal: number; discountAmount: number; totalAmount: number } {
  const qty = toScaled4(quantity);
  const price = toScaled4(unitPrice);
  const disc = toScaled4(discountPct);

  // subtotal in scale 4
  const rawSub = qty * price;
  const subSign = rawSub < 0n ? -1n : 1n;
  const subAbs = rawSub < 0n ? -rawSub : rawSub;
  const subtotalScaled = subSign * ((subAbs + 5000n) / SCALE_4);

  // discountAmount = subtotal * disc / 100
  const rawDisc = subtotalScaled * disc;
  const discSign = rawDisc < 0n ? -1n : 1n;
  const discAbs = rawDisc < 0n ? -rawDisc : rawDisc;
  const divisor = SCALE_4 * SCALE_2; // 1,000,000n
  const discAmountScaled = discSign * ((discAbs + divisor / 2n) / divisor);

  const totalScaled = subtotalScaled - discAmountScaled;

  return {
    subtotal: fromScaled4To2(subtotalScaled),
    discountAmount: fromScaled4To2(discAmountScaled),
    totalAmount: Math.max(0, fromScaled4To2(totalScaled))
  };
}

/**
 * Calculate percentage change: ((newVal - oldVal) / oldVal) * 100
 */
export function calcPctChange(
  oldVal: number | string | null | undefined,
  newVal: number | string | null | undefined,
  decimals: 1 | 2 = 2
): number {
  const sOld = toScaled4(oldVal);
  const sNew = toScaled4(newVal);
  if (sOld <= 0n) return 0;
  const diff = sNew - sOld;
  const pct = decDiv(fromScaled4(diff * 100n), fromScaled4(sOld));
  return decimals === 1 ? round1(pct) : round2(pct);
}
