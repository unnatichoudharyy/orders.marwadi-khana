// backend/Code.gs: the Google Sheet script that serves stock and records orders.
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { createGas } = require("./helpers/fake-gas.cjs");
const CSV = path.join(__dirname, "../backend/inventory-template.csv");

function setupSheet(tab = "Inventory") {
  const g = createGas(CSV, tab);
  g.ctx.setup();
  const inv = g.sheets.Inventory.data as unknown[][];
  const h = inv[0] as string[];
  return {
    g,
    set: (id: string, col: string, v: unknown) => { (inv.find((r) => r[0] === id) as unknown[])[h.indexOf(col)] = v; },
    get: () => JSON.parse(g.ctx.doGet({}).content),
    item: (id: string) => JSON.parse(g.ctx.doGet({}).content).items.find((i: { id: string }) => i.id === id),
    post: (o: unknown) => JSON.parse(g.ctx.doPost({ postData: { contents: JSON.stringify(o) } }).content)
  };
}
const order = (id: string, items: unknown[]) => ({
  id, slot: "Sat", payment: "UPI",
  customer: { name: '=HYPERLINK("x")', phone: "+919876543210", email: "a@b.c" },
  address: { line: "Flat 1", map: "Gurugram", lat: 28.4, lng: 77 },
  items, totals: { sub: 1, delivery: 80, tax: 1, total: 82 }, notes: ""
});

describe("Google Sheet script", () => {
  it("serves every row of the template", () => {
    const s = setupSheet();
    const rows = require("node:fs").readFileSync(CSV, "utf8").trim().split("\n").length - 1;
    expect(s.get().items).toHaveLength(rows);
    expect(s.item("kalakand")).toMatchObject({ price: 1800, shelf_life: "3–4 days", available: true });
  });

  it("reduces stock across sizes, once per order ID", () => {
    const s = setupSheet();
    s.set("besan-laddu", "stock", 8);
    expect(s.post(order("MK1", [{ id: "besan-laddu", name: "BL", qty: 5 }, { id: "besan-laddu", name: "BL", qty: 3 }]))).toEqual({ ok: true });
    expect(s.item("besan-laddu").stock).toBe(0);
    expect(s.post(order("MK1", [{ id: "atta-laddu", name: "AL", qty: 2 }])).duplicate).toBe(true);
    expect(s.item("atta-laddu").stock).toBe(25);
  });

  it("refuses sold-out, too many, unknown and unticked items without partial changes", () => {
    const s = setupSheet();
    s.set("besan-laddu", "stock", 0);
    const r = s.post(order("MK2", [{ id: "besan-laddu", name: "BL", qty: 1 }, { id: "atta-laddu", name: "AL", qty: 26 }, { id: "nope", name: "X", qty: 1 }]));
    expect(r.ok).toBe(false);
    expect(r.problems.map((p: { id: string; left: number }) => [p.id, p.left])).toEqual([["besan-laddu", 0], ["atta-laddu", 25], ["nope", 0]]);
    expect(s.item("atta-laddu").stock).toBe(25);
    s.set("kalakand", "available", false);
    expect(s.post(order("MK3", [{ id: "kalakand", name: "K", qty: 1 }])).ok).toBe(false);
  });

  it("treats blank stock as unlimited and rejects bad requests", () => {
    const s = setupSheet();
    s.set("besan-burfi", "stock", "");
    expect(s.post(order("MK4", [{ id: "besan-burfi", name: "BB", qty: 40 }])).ok).toBe(true);
    expect(s.item("besan-burfi").stock).toBeNull();
    expect(JSON.parse(s.g.ctx.doPost({ postData: { contents: "nope" } }).content).ok).toBe(false);
    expect(s.post(order("MK5", [{ id: "besan-burfi", qty: -2 }])).ok).toBe(false);
    expect(s.post(order("MK6", [{ id: "besan-burfi", qty: 51 }])).ok).toBe(false);
  });

  it("logs orders without letting customer text become formulas", () => {
    const s = setupSheet();
    s.post(order("MK7", [{ id: "besan-burfi", name: "BB", qty: 1 }]));
    const orders = s.g.sheets.Orders.data;
    expect(orders[1][1]).toBe("MK7");
    expect(orders[1][4]).toBe('\'=HYPERLINK("x")');
  });

  it("setup renames an imported first tab to Inventory", () => {
    const { g } = setupSheet("Sheet1");
    expect(Object.keys(g.sheets)).toEqual(["Inventory", "Orders"]);
  });
});
