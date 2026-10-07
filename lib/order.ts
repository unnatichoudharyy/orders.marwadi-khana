import { STORE } from "@/data/config";
import { money } from "./format";
import type { InventoryRow, Order } from "./types";

/** The WhatsApp message sent to the shop for an order. */
export function whatsappText(o: Order): string {
  const lines = [
    `*New pre-order ${o.id}* — ${STORE.name}`,
    `Delivery on ${o.slot}`,
    "",
    ...o.items.map((i) => `• ${i.qty} × ${i.name}${i.options ? ` (${i.options})` : ""} — ${money(i.price)}`),
    "",
    `Sub total: ${money(o.totals.sub)}`,
    `Delivery: ${o.totals.delivery ? money(o.totals.delivery) : "FREE"}`,
    `Taxes: ${money(o.totals.tax)}`,
    `*To pay: ${money(o.totals.total)}* (${o.payment === "UPI" ? "UPI" : "Cash/UPI on delivery"})`,
    "",
    `Name: ${o.customer.name}`,
    `Phone: ${o.customer.phone}`,
    `Email: ${o.customer.email}`,
    `Address: ${o.address.line}, ${o.address.map}`
  ];
  if (o.address.landmark) lines.push(`Landmark: ${o.address.landmark}`);
  if (o.address.lat != null) lines.push(`Map: https://maps.google.com/?q=${o.address.lat},${o.address.lng}`);
  if (o.notes) lines.push(`Notes: ${o.notes}`);
  return lines.filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
}

export const whatsappLink = (o: Order) => `https://wa.me/${STORE.whatsappNumber}?text=${encodeURIComponent(whatsappText(o))}`;

export const upiLink = (o: Order) =>
  `upi://pay?pa=${encodeURIComponent(STORE.upiId)}&pn=${encodeURIComponent(STORE.name)}&am=${o.totals.total}&cu=INR&tn=${encodeURIComponent("Order " + o.id)}`;

export const newOrderId = (now = new Date()) =>
  "MK" + now.toISOString().slice(2, 10).replace(/-/g, "") + Math.floor(1000 + Math.random() * 9000);

// ---------------------------------------------------------------------------
// Google Sheet backend (backend/Code.gs)
// ---------------------------------------------------------------------------

export interface BackendResult {
  ok: boolean;
  error?: string;
  duplicate?: boolean;
  problems?: { id: string; name: string; left: number }[];
  items?: InventoryRow[];
}

/** Send the order to the Sheet, which checks and reduces the stock. */
export async function sendOrder(order: Order): Promise<BackendResult> {
  // text/plain body keeps this a "simple" request (no CORS preflight to Apps Script).
  const r = await fetch(STORE.backendUrl, { method: "POST", body: JSON.stringify(order) });
  return r.json();
}

export async function fetchInventory(): Promise<InventoryRow[]> {
  const url = STORE.backendUrl + (STORE.backendUrl.includes("?") ? "&" : "?") + "t=" + Date.now();
  const r = await fetch(url);
  const j = await r.json();
  if (!j.ok || !Array.isArray(j.items)) throw new Error("bad inventory");
  return j.items;
}
