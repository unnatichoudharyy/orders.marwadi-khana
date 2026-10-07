import { minPrice } from "./pricing";
import { hasPrice } from "./schedule";
import type { MenuItem } from "./types";

export interface Filters { q: string; vrat: boolean; popular: boolean; under500: boolean }
export const NO_FILTERS: Filters = { q: "", vrat: false, popular: false, under500: false };

export const isFiltering = (f: Filters) => !!(f.q || f.vrat || f.popular || f.under500);

/** Does an item pass the search box and the filter chips? */
export function matches(item: MenuItem, f: Filters): boolean {
  if (f.q) {
    const q = f.q.toLowerCase();
    if (!(item.name + " " + item.desc).toLowerCase().includes(q)) return false;
  }
  if (f.vrat && !(item.category === "navratri-thali" || /vrat/i.test(item.badge || ""))) return false;
  if (f.popular && !/popular/i.test(item.badge || "")) return false;
  if (f.under500 && (!hasPrice(item) || minPrice(item) >= 500)) return false;
  return true;
}
