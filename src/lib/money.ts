/**
 * Money helpers. Google Ads and our raw tables store money as integer micros
 * (1,000,000 micros = 1 unit of account currency). Convert only here, and
 * format only in the UI layer.
 */
export const MICROS_PER_UNIT = 1_000_000;

export function unitsToMicros(units: number): number {
  if (!Number.isFinite(units)) throw new RangeError(`Invalid amount: ${units}`);
  return Math.round(units * MICROS_PER_UNIT);
}

export function microsToUnits(micros: number | bigint): number {
  return Number(micros) / MICROS_PER_UNIT;
}

export function formatMoney(
  micros: number | bigint,
  currency: string,
  locale = "en-GB",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(microsToUnits(micros));
}
