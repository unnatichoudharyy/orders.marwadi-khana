import { MENU } from "@/data/menu";
import { slug } from "./format";
import type { Category, InventoryRow, MenuItem } from "./types";

/** Items with a pre-built page at /item/<id>/ (everything in data/menu.ts). */
const STATIC_ITEM_IDS = new Set(MENU.flatMap((c) => c.items.map((i) => i.id)));

/** Link to an item's page. Items added only in the Google Sheet use /item/?id=… */
export const itemHref = (id: string) =>
  STATIC_ITEM_IDS.has(id) ? `/item/${id}/` : `/item/?id=${encodeURIComponent(id)}`;

export interface Catalog {
  categories: Category[];
  items: Record<string, MenuItem>;
}

/**
 * Build the menu. Without a Sheet, it's data/menu.ts as written. With one,
 * the Sheet decides which items exist (in the Sheet's order) and their name,
 * category, price and stock; data/menu.ts still supplies sizes, emoji and any
 * text the Sheet leaves blank.
 */
export function buildCatalog(inventory: InventoryRow[] | null): Catalog {
  const base: Record<string, MenuItem> = {};
  MENU.forEach((c) => c.items.forEach((i) => { base[i.id] = { ...i, category: c.id }; }));

  let cats: Category[];
  if (!inventory) {
    cats = MENU.map((c) => ({ ...c, items: c.items.map((i) => ({ ...base[i.id] })) }));
  } else {
    cats = MENU.map((c) => ({ id: c.id, name: c.name, subtitle: c.subtitle, items: [] }));
    inventory.forEach((row) => {
      const b: Partial<MenuItem> = base[row.id] || {};
      const catName = row.category || cats.find((c) => c.id === b.category)?.name || "More";
      let cat = cats.find((c) => c.name.toLowerCase() === catName.toLowerCase() || c.id === catName.toLowerCase());
      if (!cat) {
        cat = { id: slug(catName) || "more", name: catName, items: [] };
        cats.push(cat);
      }
      cat.items.push({
        ...b,
        id: row.id,
        name: row.name || b.name || row.id,
        desc: row.description || b.desc || "",
        price: typeof row.price === "number" ? row.price : b.price ?? null,
        badge: row.badge || b.badge || "",
        shelfLife: row.shelf_life || b.shelfLife || "",
        // The Sheet's image column can hold one link or several, separated by commas.
        images: row.image ? row.image.split(/[\s,]+/).filter(Boolean) : b.images,
        emoji: b.emoji || "🍬",
        stock: typeof row.stock === "number" ? row.stock : null,
        soldOut: row.available === false || row.stock === 0,
        unavailable: row.available === false,
        category: cat.id
      });
    });
  }
  const categories = cats.filter((c) => c.items.length);
  const items: Record<string, MenuItem> = {};
  categories.forEach((c) => c.items.forEach((i) => { items[i.id] = i; }));
  return { categories, items };
}
