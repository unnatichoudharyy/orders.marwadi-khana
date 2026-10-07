import { STORE } from "@/data/config";
import type { CartLine, MenuItem, Totals } from "./types";

/**
 * A choice can scale the base price (factor: 0.5 = half a kg) and/or add a
 * fixed amount (price: +50 for gift wrap). Scaling keeps sizes right when
 * the per-kg price changes in the Sheet.
 */
export function unitPrice(item: MenuItem, sel: number[][]): number {
  let factor = 1;
  let extra = 0;
  (item.options || []).forEach((g, gi) =>
    (sel[gi] || []).forEach((ci) => {
      const c = g.choices[ci];
      if (!c) return;
      if (typeof c.factor === "number") factor *= c.factor;
      extra += c.price || 0;
    })
  );
  return Math.round((item.price ?? 0) * factor) + extra;
}

/** Cheapest way to buy the item (smallest size), used by the price filter. */
export function minPrice(item: MenuItem): number {
  let p = item.price ?? 0;
  (item.options || [])
    .filter((g) => g.required)
    .forEach((g) => {
      p = Math.min(...g.choices.map((c) => Math.round(p * (typeof c.factor === "number" ? c.factor : 1)) + (c.price || 0)));
    });
  return p;
}

/** Price shown next to a size choice (scaled) or add-on (+/- amount). */
export function choicePrice(item: MenuItem, c: { price?: number; factor?: number }): number {
  return Math.round((item.price ?? 0) * (c.factor ?? 1)) + (c.price || 0);
}

/** "Box of 8 laddus", "500 g, Festive gift wrap" — and "1 kg" for per-kg items without a size choice. */
export function selLabel(item: MenuItem, sel: number[][]): string {
  const parts: string[] = [];
  (item.options || []).forEach((g, gi) => (sel[gi] || []).forEach((ci) => g.choices[ci] && parts.push(g.choices[ci].label)));
  if (!parts.length && item.unit === "kg") parts.push("1 kg");
  return parts.join(", ");
}

export const lineKey = (id: string, sel: number[][]) => id + "|" + JSON.stringify(sel);

export function totals(cart: CartLine[], items: Record<string, MenuItem>): Totals {
  const sub = cart.reduce((a, l) => (items[l.id] ? a + unitPrice(items[l.id], l.sel) * l.qty : a), 0);
  const delivery = sub > 0 && !(STORE.freeDeliveryAbove && sub >= STORE.freeDeliveryAbove) ? STORE.deliveryFee : 0;
  const tax = Math.round(sub * STORE.taxRate);
  return { sub, delivery, tax, total: sub + delivery + tax, belowMin: sub < STORE.minOrder };
}
