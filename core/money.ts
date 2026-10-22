import { z } from "zod";

/**
 * Money is stored as whole kobo (₦1 = 100 kobo), never as floating-point naira.
 *
 * Why: 0.1 + 0.2 !== 0.3 in JavaScript. Interest and instalment maths on
 * floats drifts by fractions of a kobo, and those drifts add up across a book
 * of loans and break reconciliation. Integers don't drift.
 */
export const Kobo = z.number().int().nonnegative().brand<"Kobo">();
export type Kobo = z.infer<typeof Kobo>;

/** Strictly positive amount, e.g. a loan principal. */
export const PositiveKobo = z.number().int().positive().brand<"Kobo">();

/** Convert whole naira to kobo. `naira(20_000)` is ₦20,000. */
export function naira(amount: number): Kobo {
  return Kobo.parse(Math.round(amount * 100));
}

/** Format kobo for display: `formatNaira(naira(1500))` → "₦1,500.00". */
export function formatNaira(kobo: Kobo): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(kobo / 100);
}
