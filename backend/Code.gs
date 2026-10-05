/**
 * Marwadi Khana: inventory and order backend (Google Apps Script).
 *
 * This script lives inside your Google Sheet. It does two things:
 *   GET  → sends the "Inventory" tab to the website, so the site shows
 *          exactly the items, prices and stock you have in the Sheet.
 *   POST → receives an order from the website, checks there is enough stock,
 *          reduces the stock and adds the order to the "Orders" tab.
 *
 * Setup steps are in backend/SETUP.md.
 */

const INVENTORY_TAB = "Inventory";
const ORDERS_TAB = "Orders";
const INVENTORY_HEADERS = ["id", "name", "category", "description", "price", "stock", "available", "badge", "image", "shelf_life"];
const ORDER_HEADERS = [
  "Placed at", "Order ID", "Status", "Delivery slot", "Name", "Phone", "Email",
  "Address", "Landmark", "Map link", "Items", "Item total", "Delivery", "Tax", "To pay", "Payment", "Notes"
];
const MAX_QTY_PER_ITEM = 50; // refuse obviously bogus orders

// ---------------------------------------------------------------------------
// Website → Sheet
// ---------------------------------------------------------------------------

function doGet() {
  return json_({ ok: true, items: readInventory_().items, updatedAt: new Date().toISOString() });
}

function doPost(e) {
  let order;
  try {
    order = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: "Bad request" });
  }
  if (!order || !order.id || !Array.isArray(order.items) || !order.items.length) {
    return json_({ ok: false, error: "Bad request" });
  }

  // One order at a time, so two customers can't buy the last box together.
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const inv = readInventory_();

    // Ignore a repeated submit of the same order (e.g. a double tap).
    if (orderExists_(order.id)) return json_({ ok: true, duplicate: true });

    // Add up quantities per item (the same item can appear in several sizes).
    const need = {};
    order.items.forEach(function (line) {
      const qty = Math.floor(Number(line.qty));
      if (!line.id || !(qty > 0)) throw new Error("Bad line");
      need[line.id] = (need[line.id] || 0) + qty;
    });

    const problems = [];
    Object.keys(need).forEach(function (id) {
      const item = inv.byId[id];
      if (!item || !item.available) {
        problems.push({ id: id, name: item ? item.name : id, left: 0 });
      } else if (need[id] > MAX_QTY_PER_ITEM) {
        problems.push({ id: id, name: item.name, left: Math.min(MAX_QTY_PER_ITEM, item.stock == null ? MAX_QTY_PER_ITEM : item.stock) });
      } else if (item.stock != null && need[id] > item.stock) {
        problems.push({ id: id, name: item.name, left: item.stock });
      }
    });
    if (problems.length) {
      return json_({ ok: false, error: "stock", problems: problems, items: inv.items });
    }

    // Reduce stock (blank stock = unlimited, left untouched).
    Object.keys(need).forEach(function (id) {
      const item = inv.byId[id];
      if (item.stock != null) inv.sheet.getRange(item.row, inv.col.stock + 1).setValue(item.stock - need[id]);
    });

    appendOrder_(order);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: "Bad request" });
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Sheet helpers
// ---------------------------------------------------------------------------

function readInventory_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(INVENTORY_TAB);
  if (!sheet) throw new Error('No "' + INVENTORY_TAB + '" tab. Run setup first.');
  const values = sheet.getDataRange().getValues();
  const head = values.shift().map(function (h) { return String(h).trim().toLowerCase(); });
  const col = {};
  INVENTORY_HEADERS.forEach(function (h) { col[h] = head.indexOf(h); });

  const items = [];
  const byId = {};
  values.forEach(function (r, i) {
    const id = String(cell_(r, col.id)).trim();
    if (!id) return;
    const stockRaw = cell_(r, col.stock);
    const stock = stockRaw === "" || stockRaw == null ? null : Math.max(0, Math.floor(Number(stockRaw)) || 0);
    const priceRaw = cell_(r, col.price);
    const item = {
      id: id,
      name: String(cell_(r, col.name)).trim(),
      category: String(cell_(r, col.category)).trim(),
      description: String(cell_(r, col.description)).trim(),
      price: priceRaw === "" || priceRaw == null || isNaN(Number(priceRaw)) ? null : Number(priceRaw),
      stock: stock,
      available: isYes_(cell_(r, col.available)),
      badge: String(cell_(r, col.badge)).trim(),
      image: String(cell_(r, col.image)).trim(),
      shelf_life: String(cell_(r, col.shelf_life)).trim()
    };
    items.push(item);
    byId[id] = Object.assign({ row: i + 2 }, item);
  });
  return { sheet: sheet, col: col, items: items, byId: byId };
}

function cell_(row, idx) {
  return idx < 0 ? "" : row[idx];
}

// Blank counts as "yes" so new rows show up unless you untick them.
function isYes_(v) {
  if (v === "" || v == null) return true;
  if (v === true || v === false) return v;
  return !/^(no|n|false|0|off)$/i.test(String(v).trim());
}

function orderExists_(id) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(ORDERS_TAB);
  if (!sheet || sheet.getLastRow() < 2) return false;
  const ids = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues();
  return ids.some(function (r) { return String(r[0]) === String(id); });
}

function appendOrder_(o) {
  let sheet = SpreadsheetApp.getActive().getSheetByName(ORDERS_TAB);
  if (!sheet) {
    sheet = SpreadsheetApp.getActive().insertSheet(ORDERS_TAB);
    sheet.appendRow(ORDER_HEADERS);
    sheet.setFrozenRows(1);
  }
  const c = o.customer || {};
  const a = o.address || {};
  const t = o.totals || {};
  const items = o.items.map(function (i) {
    return i.qty + " × " + i.name + (i.options ? " (" + i.options + ")" : "");
  }).join("\n");
  sheet.appendRow([
    new Date(),
    safe_(o.id), "New", safe_(o.slot), safe_(c.name), safe_(c.phone), safe_(c.email),
    safe_([a.line, a.map].filter(String).join(", ")), safe_(a.landmark),
    a.lat != null ? "https://maps.google.com/?q=" + Number(a.lat) + "," + Number(a.lng) : "",
    safe_(items), num_(t.sub), num_(t.delivery), num_(t.tax), num_(t.total), safe_(o.payment), safe_(o.notes)
  ]);
}

// Customer text must never be treated as a spreadsheet formula.
function safe_(v) {
  const s = String(v == null ? "" : v).slice(0, 2000);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}
function num_(v) {
  const n = Number(v);
  return isFinite(n) ? n : "";
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// One-time setup: run this once from the Apps Script editor (▶ Run → setup).
// It adds the tabs, headers, tick boxes and low-stock colours. Safe to re-run.
// ---------------------------------------------------------------------------

function setup() {
  const ss = SpreadsheetApp.getActive();
  let inv = ss.getSheetByName(INVENTORY_TAB);
  if (!inv) {
    // If you imported inventory-template.csv into the first tab, just rename it.
    const first = ss.getSheets()[0];
    if (first && String(first.getRange(1, 1).getValue()).trim().toLowerCase() === "id") {
      inv = first.setName(INVENTORY_TAB);
    } else {
      inv = ss.insertSheet(INVENTORY_TAB);
    }
  }
  if (inv.getLastRow() === 0) inv.appendRow(INVENTORY_HEADERS);
  inv.setFrozenRows(1);
  inv.getRange(1, 1, 1, INVENTORY_HEADERS.length).setFontWeight("bold").setBackground("#7b1626").setFontColor("#ffffff");

  // Only rows that already have items get tick boxes, so a row you add later
  // with "available" left blank still counts as available.
  const rows = Math.max(inv.getLastRow() - 1, 1);
  const head = inv.getRange(1, 1, 1, inv.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
  const availCol = head.indexOf("available") + 1;
  const stockCol = head.indexOf("stock") + 1;

  if (availCol > 0) {
    const range = inv.getRange(2, availCol, rows, 1);
    // Turn "TRUE"/"FALSE"/"Yes"/"No"/blank into real tick boxes.
    const ids = inv.getRange(2, 1, rows, 1).getValues();
    const vals = range.getValues().map(function (r, i) {
      return [ids[i][0] === "" ? false : isYes_(r[0])];
    });
    range.setValues(vals);
    range.insertCheckboxes();
  }
  if (stockCol > 0) {
    const stockRange = inv.getRange(2, stockCol, rows, 1);
    const letter = columnLetter_(stockCol);
    const rules = inv.getConditionalFormatRules().filter(function (r) {
      return !r.getRanges().some(function (g) { return g.getColumn() === stockCol; });
    });
    rules.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied("=AND($A2<>\"\",ISNUMBER(" + letter + "2)," + letter + "2<=0)")
        .setBackground("#f4c7c3").setFontColor("#a50e0e").setRanges([stockRange]).build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied("=AND($A2<>\"\",ISNUMBER(" + letter + "2)," + letter + "2<=10)")
        .setBackground("#fce8b2").setRanges([stockRange]).build()
    );
    inv.setConditionalFormatRules(rules);
  }
  inv.autoResizeColumns(1, INVENTORY_HEADERS.length);

  let orders = ss.getSheetByName(ORDERS_TAB);
  if (!orders) {
    orders = ss.insertSheet(ORDERS_TAB);
    orders.appendRow(ORDER_HEADERS);
  }
  orders.setFrozenRows(1);
  orders.getRange(1, 1, 1, ORDER_HEADERS.length).setFontWeight("bold").setBackground("#7b1626").setFontColor("#ffffff");
}

function columnLetter_(n) {
  let s = "";
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
