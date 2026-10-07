// Shared types for the menu, cart, orders and settings.

export interface Choice {
  label: string;
  /** Added to the price (e.g. +50 for gift wrap). */
  price?: number;
  /** Scales the base price (e.g. 0.5 for 500 g of a per-kg item). */
  factor?: number;
}

export interface OptionGroup {
  name: string;
  /** Customer must pick at least one. */
  required?: boolean;
  /** How many can be picked (default 1). */
  max?: number;
  choices: Choice[];
}

export interface MenuItem {
  id: string;
  name: string;
  desc: string;
  /** Base price in rupees; null shows "Price coming soon". */
  price: number | null;
  veg?: boolean;
  /** Photo URLs; the first is the thumbnail. */
  images?: string[];
  emoji?: string;
  badge?: string;
  /** Shows "ONLY N LEFT!" when at or below lowStockAt. null = unlimited. */
  stock?: number | null;
  soldOut?: boolean;
  /** Switched off in the Sheet (shows NOT AVAILABLE). */
  unavailable?: boolean;
  options?: OptionGroup[];
  /** Shown after the price, e.g. "kg" → "1,500 / kg". */
  unit?: string;
  shelfLife?: string;
  /** "YYYY-MM-DD": delivered only on this day (Navratri thalis). */
  deliveryDate?: string;
  /** "YYYY-MM-DD": with deliveryDate, first day it can be ordered. */
  orderFrom?: string;
  /** "YYYY-MM-DD": hidden from the day after. */
  visibleUntil?: string;
  /** Dish list shown on the item page. */
  includes?: string[];
  /** Category id (filled in when the catalogue is built). */
  category?: string;
}

export interface Category {
  id: string;
  name: string;
  subtitle?: string;
  items: MenuItem[];
}

/** One row of the Google Sheet's Inventory tab, as sent by backend/Code.gs. */
export interface InventoryRow {
  id: string;
  name?: string;
  category?: string;
  description?: string;
  price?: number | null;
  stock?: number | null;
  available?: boolean;
  badge?: string;
  image?: string;
  shelf_life?: string;
}

export interface CartLine {
  key: string;
  id: string;
  /** Picked choice indexes, per option group. */
  sel: number[][];
  qty: number;
}

export interface Address {
  text: string;
  lat: number | null;
  lng: number | null;
  /** Inside the delivery area. */
  ok: boolean;
}

export interface Customer {
  name?: string;
  email?: string;
  phone?: string;
  house?: string;
  landmark?: string;
}

export interface Totals {
  sub: number;
  delivery: number;
  tax: number;
  total: number;
  belowMin: boolean;
}

export interface Order {
  id: string;
  placedAt: string;
  slot: string;
  payment: "UPI" | "COD";
  customer: { name: string; email: string; phone: string };
  address: { line: string; landmark?: string; map: string; lat: number | null; lng: number | null };
  items: { id: string; name: string; options: string; qty: number; price: number }[];
  notes: string;
  totals: { sub: number; delivery: number; tax: number; total: number };
}

export interface StoreConfig {
  name: string;
  tagline: string;
  city: string;
  currency: string;
  whatsappNumber: string;
  phone: string;
  email: string;
  upiId: string;
  minOrder: number;
  deliveryFee: number;
  freeDeliveryAbove: number;
  taxRate: number;
  banner: { title: string; text: string; cta: string; category: string } | null;
  preorderMinDays: number;
  preorderMaxDays: number;
  orderCutoffHour: number;
  thaliOrderDaysBefore: number;
  sameDayPrepHours: number;
  openHour: number;
  closeHour: number;
  slotHours: number;
  deliveryAreas: string[];
  serviceBox: { north: number; south: number; west: number; east: number };
  shop: { lat: number; lng: number };
  backendUrl: string;
  lowStockAt: number;
  refreshSeconds: number;
}
