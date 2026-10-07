// Business rules: prices, sizes, the 6 PM cut-off, Navratri thali windows,
// mixed carts, stock limits, delivery area and the Google Sheet merge.
import { describe, expect, it } from "vitest";
import { inServiceArea, inServiceBox } from "@/lib/area";
import { reconcileCart, roomFor } from "@/lib/cart";
import { buildCatalog } from "@/lib/catalog";
import { matches, NO_FILTERS } from "@/lib/filters";
import { whatsappText } from "@/lib/order";
import { lineKey, minPrice, selLabel, totals, unitPrice } from "@/lib/pricing";
import { blockedLabel, buildSlots, deliveryPlan, orderWindow, slotsOn } from "@/lib/schedule";
import type { CartLine, Order } from "@/lib/types";

const at = (s: string) => new Date(s + "+05:30");
const { items } = buildCatalog(null);
const line = (id: string, sel: number[][] = [], qty = 1): CartLine => ({ key: lineKey(id, sel), id, sel, qty });

describe("prices and sizes", () => {
  it("prices laddu boxes as a share of the per-kg price", () => {
    const l = items["dry-fruit-laddu"];
    expect([0, 1, 2, 3].map((i) => unitPrice(l, [[i]]))).toEqual([417, 833, 1250, 2500]);
  });
  it("prices 500 g at half the per-kg price", () => {
    expect(unitPrice(items["kalakand"], [[0]])).toBe(900);
    expect(unitPrice(items["walnut-halwa"], [[1]])).toBe(3000);
  });
  it("labels per-kg items without a size as 1 kg", () => {
    expect(selLabel({ ...items["besan-halwa"], options: undefined }, [])).toBe("1 kg");
    expect(selLabel(items["besan-laddu"], [[1]])).toBe("Box of 8 laddus (≈ 330 g)");
  });
  it("uses the cheapest size for the price filter", () => {
    expect(minPrice(items["besan-laddu"])).toBe(250);
    expect(matches(items["besan-laddu"], { ...NO_FILTERS, under500: true })).toBe(true);
    expect(matches(items["walnut-halwa"], { ...NO_FILTERS, under500: true })).toBe(false);
  });
  it("adds delivery below ₹1,499 and 5% GST", () => {
    expect(totals([line("walnut-halwa-jar")], items)).toEqual({ sub: 800, delivery: 80, tax: 40, total: 920, belowMin: false });
    expect(totals([line("besan-halwa", [[1]])], items).delivery).toBe(0);
  });
});

describe("delivery dates and slots", () => {
  it("offers 10 AM – 8:30 PM slots", () => {
    expect(slotsOn(at("2026-10-12T00:00:00"))).toEqual(["10:00 – 11:30 AM", "11:30 AM – 1:00 PM", "1:00 – 2:30 PM", "2:30 – 4:00 PM", "4:00 – 5:30 PM", "5:30 – 7:00 PM", "7:00 – 8:30 PM"]);
  });
  it("delivers next day before 6 PM, day after from 6 PM", () => {
    const cart = [line("besan-halwa", [[1]])];
    expect(buildSlots(deliveryPlan(cart, items, at("2026-10-12T17:59:00")))[0].label).toBe("Tue, 13 Oct");
    expect(buildSlots(deliveryPlan(cart, items, at("2026-10-12T18:00:00")))[0].label).toBe("Wed, 14 Oct");
  });
});

describe("Navratri thalis", () => {
  const d1 = items["navratri-thali-day-1"], d2 = items["navratri-thali-day-2"];
  it("opens Day 1 from 7 Oct and Day 2 the day before its day", () => {
    expect(blockedLabel(d1, at("2026-10-07T12:00:00"))).toBe("");
    expect(blockedLabel(d2, at("2026-10-07T12:00:00"))).toBe("OPENS 11 OCT");
    expect(blockedLabel(d2, at("2026-10-11T09:00:00"))).toBe("");
  });
  it("closes on the day once no slot is 2 hours away", () => {
    expect(orderWindow(d1, at("2026-10-11T16:59:00"))!.status).toBe("open");
    expect(orderWindow(d1, at("2026-10-11T17:01:00"))!.status).toBe("closed");
  });
  it("only offers same-day slots at least 2 hours away", () => {
    const plan = deliveryPlan([line(d1.id)], items, at("2026-10-11T10:00:00"));
    expect(buildSlots(plan)[0].slots[0]).toBe("1:00 – 2:30 PM");
  });
  it("won't mix thalis for different days", () => {
    expect(deliveryPlan([line(d1.id), line(d2.id)], items, at("2026-10-11T10:00:00")).error).toMatch(/separate orders/);
  });
  it("sends a thali + mithai on the thali's day only if the mithai can make it", () => {
    const cart = [line(d1.id), line("besan-laddu", [[3]])];
    expect(deliveryPlan(cart, items, at("2026-10-10T14:00:00")).error).toBeUndefined();
    expect(deliveryPlan(cart, items, at("2026-10-10T19:00:00")).error).toMatch(/order them separately/);
  });
  it("removes a closed thali from the cart with a message", () => {
    const r = reconcileCart([line(d1.id), line("besan-laddu", [[0]])], items, at("2026-10-11T20:00:00"));
    expect(r.cart.map((l) => l.id)).toEqual(["besan-laddu"]);
    expect(r.notes[0]).toMatch(/has closed/);
  });
});

describe("Google Sheet stock", () => {
  const sheet = buildCatalog([
    { id: "besan-laddu", category: "Laddus (Per Kg)", price: 1500, stock: 3, available: true },
    { id: "kalakand", category: "Burfi (Per Kg)", price: 1800, stock: 10, available: false },
    { id: "kesar-peda", name: "Kesar Peda", category: "Peda", price: 300, stock: null, available: true }
  ]);
  it("shows only Sheet items, keeping sizes from the menu and adding new sections", () => {
    expect(Object.keys(sheet.items)).toEqual(["besan-laddu", "kalakand", "kesar-peda"]);
    expect(sheet.items["besan-laddu"].options?.[0].choices).toHaveLength(4);
    expect(sheet.categories.map((c) => c.name)).toContain("Peda");
  });
  it("blocks unticked items and caps quantities at stock (across sizes)", () => {
    const now = at("2026-10-12T12:00:00");
    expect(blockedLabel(sheet.items["kalakand"], now)).toBe("NOT AVAILABLE");
    const cart = [line("besan-laddu", [[0]], 2), line("besan-laddu", [[3]], 2)];
    expect(roomFor(cart, sheet.items, "besan-laddu", now)).toBe(0);
    const r = reconcileCart(cart, sheet.items, now);
    expect(r.cart.map((l) => l.qty)).toEqual([2, 1]);
  });
});

describe("delivery area", () => {
  it("accepts Delhi NCR / Gurgaon by district, not by street name", () => {
    expect(inServiceArea({ city: "Gurugram", state: "Haryana" })).toBe(true);
    expect(inServiceArea({ road: "Delhi Road", city: "Meerut", state: "Uttar Pradesh" })).toBe(false);
    expect(inServiceArea({ city: "Bengaluru", state: "Karnataka" })).toBe(false);
    expect(inServiceArea(null, "Flat 2, Sector 56, Gurgaon")).toBe(true);
    expect(inServiceBox(28.42, 77.07)).toBe(true);
  });
});

describe("WhatsApp order message", () => {
  it("lists items, totals, address and a map link", () => {
    const o: Order = {
      id: "MK1", placedAt: "", slot: "Sun, 11 Oct, 1:00 – 2:30 PM", payment: "UPI",
      customer: { name: "A", email: "a@b.c", phone: "+919876543210" },
      address: { line: "Flat 1", landmark: "", map: "Gurugram", lat: 28.4, lng: 77 },
      items: [{ id: "x", name: "Navratri Thali · Day 1", options: "", qty: 2, price: 1500 }],
      notes: "", totals: { sub: 1500, delivery: 0, tax: 75, total: 1575 }
    };
    const t = whatsappText(o);
    expect(t).toContain("• 2 × Navratri Thali · Day 1 — ₹1,500");
    expect(t).toContain("*To pay: ₹1,575* (UPI)");
    expect(t).toContain("Map: https://maps.google.com/?q=28.4,77");
  });
});
