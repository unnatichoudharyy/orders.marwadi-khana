import { hasPrice, orderWindow, orderable } from "./schedule";
import type { CartLine, MenuItem } from "./types";

export const hasStockLimit = (item: MenuItem): item is MenuItem & { stock: number } => typeof item.stock === "number";

export const qtyOfItem = (cart: CartLine[], id: string) => cart.filter((l) => l.id === id).reduce((a, l) => a + l.qty, 0);

/** How many more of this item can go in the cart (Infinity when stock isn't tracked). */
export function roomFor(cart: CartLine[], items: Record<string, MenuItem>, id: string, now: Date): number {
  const item: MenuItem | undefined = items[id];
  if (!item || !orderable(item, now)) return 0;
  return hasStockLimit(item) ? Math.max(0, item.stock - qtyOfItem(cart, id)) : Infinity;
}

/**
 * After the menu, stock or date changes: drop items that are gone, sold out or
 * past their ordering window, and trim quantities to what's left.
 * Returns the new cart and a message for anything that changed.
 */
export function reconcileCart(cart: CartLine[], items: Record<string, MenuItem>, now: Date): { cart: CartLine[]; notes: string[] } {
  const notes: string[] = [];
  const used: Record<string, number> = {};
  const next: CartLine[] = [];
  for (const l of cart) {
    const item: MenuItem | undefined = items[l.id];
    if (!item || !orderable(item, now)) {
      const w = item && orderWindow(item, now);
      notes.push(
        w && w.status === "closed"
          ? `Ordering for ${item.name} has closed, so it was removed from your cart.`
          : `${item ? item.name : "An item"} is no longer available and was removed from your cart.`
      );
      continue;
    }
    let qty = l.qty;
    if (hasStockLimit(item)) {
      const left = item.stock - (used[l.id] || 0);
      if (qty > left) {
        notes.push(`Only ${item.stock} ${item.name} left, so we updated your cart.`);
        qty = left;
      }
    }
    used[l.id] = (used[l.id] || 0) + qty;
    if (qty > 0) next.push(qty === l.qty ? l : { ...l, qty });
  }
  return { cart: next, notes };
}

export { hasPrice };
