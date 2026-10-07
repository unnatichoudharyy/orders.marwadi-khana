(() => {
  "use strict";

  const S = window.STORE;
  const view = document.getElementById("view");
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
  const money = (n) => S.currency + Math.round(n).toLocaleString("en-IN");
  const plain = (n) => Math.round(n).toLocaleString("en-IN");

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem("mk_" + key); return v == null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem("mk_" + key, JSON.stringify(value)); } catch { /* storage unavailable */ }
    }
  };

  // ---------------------------------------------------------------------------
  // Catalogue: js/menu.js, overlaid with live stock from the Google Sheet
  // ---------------------------------------------------------------------------
  let CATALOG = [];  // [{ id, name, subtitle, items: [...] }]
  let ITEMS = {};    // id -> item
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // Build the menu. Without a Sheet, it's js/menu.js as written. With one, the
  // Sheet decides which items exist (in the Sheet's order) and their name,
  // category, price and stock; js/menu.js still supplies options, emoji and
  // any text the Sheet leaves blank.
  function buildCatalog(inventory) {
    const base = {};
    window.MENU.forEach((c) => c.items.forEach((i) => { base[i.id] = { ...i, category: c.id }; }));

    let cats;
    if (!inventory) {
      cats = window.MENU.map((c) => ({ ...c, items: c.items.map((i) => ({ ...base[i.id] })) }));
    } else {
      cats = window.MENU.map((c) => ({ id: c.id, name: c.name, subtitle: c.subtitle, items: [] }));
      inventory.forEach((row) => {
        const b = base[row.id] || {};
        const catName = row.category || (cats.find((c) => c.id === b.category) || {}).name || "More";
        let cat = cats.find((c) => c.name.toLowerCase() === catName.toLowerCase() || c.id === catName.toLowerCase());
        if (!cat) { cat = { id: slug(catName) || "more", name: catName, items: [] }; cats.push(cat); }
        cat.items.push({
          ...b,
          id: row.id,
          name: row.name || b.name || row.id,
          desc: row.description || b.desc || "",
          price: typeof row.price === "number" ? row.price : (b.price ?? null),
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
    CATALOG = cats.filter((c) => c.items.length);
    ITEMS = {};
    CATALOG.forEach((c) => c.items.forEach((i) => { ITEMS[i.id] = i; }));
  }

  // Photos are shown whole (not cropped), so there's space around them. Fill
  // it with the colour of the photo's own corner so the photo blends in,
  // whether it was shot on white or off-white.
  function matchPhotoBackdrop(img) {
    const box = img.closest(".thumb, .gallery-main");
    if (!box) return;
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 1;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, img.naturalWidth * 0.03, img.naturalHeight * 0.03, 0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      box.style.background = `rgb(${r}, ${g}, ${b})`;
    } catch {
      /* photo from another website that doesn't allow reading it: keep default */
    }
  }
  document.addEventListener("load", (e) => { if (e.target.tagName === "IMG") matchPhotoBackdrop(e.target); }, true);

  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  function itemVisual(item, large) {
    const img = item.images && item.images[0];
    if (img) return `<img src="${esc(img)}" alt="${esc(item.name)}" loading="${large ? "eager" : "lazy"}">`;
    return `<div class="emoji-tile" aria-hidden="true">${item.emoji || "🍬"}</div>`;
  }
  const vegMark = (item) => (item.veg === false ? "" : `<span class="veg-mark" title="Vegetarian"></span>`);
  const badgeClass = (b) => (/vrat/i.test(b) ? "vrat" : /new/i.test(b) ? "new" : "");
  const hasStockLimit = (item) => typeof item.stock === "number";
  const lowStock = (item) => hasStockLimit(item) && item.stock > 0 && item.stock <= S.lowStockAt;
  const soldOutLabel = (item) => (item.unavailable ? "NOT AVAILABLE" : "SOLD OUT");

  // ---------------------------------------------------------------------------
  // Dates, delivery slots and fixed-day items (the Navratri thalis)
  // ---------------------------------------------------------------------------
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const parseDay = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
  const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();
  const fmtDay = (d) => d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const fmtDate = (d) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const sameDayEarliest = () => new Date(Date.now() + S.sameDayPrepHours * 3600000);

  // Delivery slots on one day, e.g. "10:00 – 11:30 AM". Slots starting before
  // `earliest` (same-day orders need prep time) are left out.
  function slotsOn(day, earliest) {
    const hm = (d) => `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}`;
    const ap = (d) => (d.getHours() < 12 ? "AM" : "PM");
    const range = (a, b) => (ap(a) === ap(b) ? `${hm(a)} – ${hm(b)} ${ap(b)}` : `${hm(a)} ${ap(a)} – ${hm(b)} ${ap(b)}`);
    const out = [];
    for (let h = S.openHour; h + S.slotHours <= S.closeHour + 1e-9; h += S.slotHours) {
      const start = new Date(day); start.setHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0);
      if (earliest && start < earliest) continue;
      out.push(range(start, new Date(start.getTime() + S.slotHours * 3600000)));
    }
    return out;
  }

  // For an item delivered on one fixed day: when can it be ordered?
  // "upcoming" before its window opens, "open" from thaliOrderDaysBefore days
  // before until its last same-day slot is too close, then "closed".
  function orderWindow(item) {
    if (!item.deliveryDate) return null;
    const deliver = parseDay(item.deliveryDate);
    const opens = item.orderFrom ? parseDay(item.orderFrom) : addDays(deliver, -S.thaliOrderDaysBefore);
    const today = startOfDay(new Date());
    let status;
    if (today < opens) status = "upcoming";
    else if (today < deliver) status = "open";
    else if (sameDay(today, deliver) && slotsOn(deliver, sameDayEarliest()).length) status = "open";
    else status = "closed";
    return { deliver, opens, status };
  }
  const hasPrice = (item) => typeof item.price === "number";
  // Seasonal items (the thalis) leave the menu after their visibleUntil date.
  const isRetired = (item) => !!item.visibleUntil && startOfDay(new Date()) > parseDay(item.visibleUntil);
  const orderable = (item) => !!item && !isRetired(item) && !item.soldOut && hasPrice(item) && (!item.deliveryDate || orderWindow(item).status === "open");

  // Why an item can't be ordered right now, for buttons ("" if it can).
  function blockedLabel(item, long) {
    if (!hasPrice(item)) return long ? "Price coming soon" : "COMING SOON";
    if (item.soldOut) return long ? (item.unavailable ? "Not available right now" : "Sold out") : soldOutLabel(item);
    const w = orderWindow(item);
    if (w && w.status === "upcoming") return long ? `Orders open on ${fmtDay(w.opens)}` : `OPENS ${fmtDate(w.opens).toUpperCase()}`;
    if (w && w.status === "closed") return long ? "Ordering has closed for this day" : "CLOSED";
    return "";
  }
  function whenNote(item) {
    const w = orderWindow(item);
    if (!w) return "";
    const range = sameDay(w.opens, w.deliver) ? fmtDate(w.deliver) : `${fmtDate(w.opens)}–${fmtDate(w.deliver)}`;
    return `<p class="when">🗓️ Delivered on <b>${esc(fmtDay(w.deliver))}</b> · order ${esc(range)}</p>`;
  }
  const priceHTML = (item, decimals) => (hasPrice(item)
    ? `${plain(item.price)}${decimals ? ".00" : ""}${priceNote(item)}`
    : `<span class="tbd">Price coming soon</span>`);

  // ---------------------------------------------------------------------------
  // Cart state
  // ---------------------------------------------------------------------------
  const state = {
    cart: store.get("cart", []),          // [{ key, id, qty, sel: [[choiceIdx...] per group] }]
    address: store.get("address", null),  // { text, lat, lng }
    customer: store.get("customer", {}),
    collapsed: {},
    filters: { q: "", vrat: false, popular: false, under500: false },
    showSearch: false,
    showFilters: false,
    menuScroll: 0
  };

  // After the menu or stock changes: drop items that are gone or sold out and
  // trim quantities to what's left. Returns messages for anything changed.
  function reconcileCart() {
    const notes = [];
    const used = {};
    state.cart = state.cart.filter((l) => {
      const item = ITEMS[l.id];
      if (!orderable(item)) {
        const w = item && orderWindow(item);
        notes.push(w && w.status === "closed"
          ? `Ordering for ${item.name} has closed, so it was removed from your cart.`
          : `${item ? item.name : "An item"} is no longer available and was removed from your cart.`);
        return false;
      }
      if (hasStockLimit(item)) {
        const left = item.stock - (used[l.id] || 0);
        if (l.qty > left) {
          notes.push(`Only ${item.stock} ${item.name} left, so we updated your cart.`);
          l.qty = left;
        }
      }
      used[l.id] = (used[l.id] || 0) + l.qty;
      return l.qty > 0;
    });
    saveCart();
    return notes;
  }

  // A choice can scale the base price (factor: 0.5 = half a kg) and/or add a
  // fixed amount (price: +50 for gift wrap). Scaling keeps sizes right when
  // you change the per-kg price in the Sheet.
  function unitPrice(item, sel) {
    let factor = 1, extra = 0;
    (item.options || []).forEach((g, gi) => (sel[gi] || []).forEach((ci) => {
      const c = g.choices[ci];
      if (!c) return;
      if (typeof c.factor === "number") factor *= c.factor;
      extra += c.price || 0;
    }));
    return Math.round(item.price * factor) + extra;
  }
  // Cheapest way to buy the item (smallest size), used by the price filter.
  function minPrice(item) {
    let p = item.price;
    (item.options || []).filter((g) => g.required).forEach((g) => {
      p = Math.min(...g.choices.map((c) => Math.round(p * (typeof c.factor === "number" ? c.factor : 1)) + (c.price || 0)));
    });
    return p;
  }
  const shelfLifeNote = (item) =>
    item.shelfLife ? `<p class="shelf">🕒 Shelf life: ${esc(item.shelfLife)}</p>` : "";
  const priceNote = (item) => (item.unit ? `<small class="unit">/ ${esc(item.unit)}</small>` : "");
  function selLabel(item, sel) {
    const parts = [];
    (item.options || []).forEach((g, gi) => (sel[gi] || []).forEach((ci) => parts.push(g.choices[ci].label)));
    // Per-kg items without a size choice: make "2 × Besan Halwa" read as 2 × 1 kg.
    if (!parts.length && item.unit === "kg") parts.push("1 kg");
    return parts.join(", ");
  }
  const lineKey = (id, sel) => id + "|" + JSON.stringify(sel);

  function saveCart() {
    store.set("cart", state.cart);
    const n = state.cart.reduce((a, l) => a + l.qty, 0);
    const badge = $("#cartCount");
    badge.hidden = n === 0;
    badge.textContent = n;
  }
  function bumpCart() {
    const btn = $(".cart-btn");
    btn.classList.remove("bump");
    void btn.offsetWidth;
    btn.classList.add("bump");
  }

  // How many more of this item can go in the cart (Infinity when untracked).
  function roomFor(id) {
    const item = ITEMS[id];
    if (!orderable(item)) return 0;
    return hasStockLimit(item) ? Math.max(0, item.stock - qtyOfItem(id)) : Infinity;
  }

  function addToCart(id, sel, qty = 1) {
    const room = roomFor(id);
    if (room <= 0) {
      toast(ITEMS[id] && blockedLabel(ITEMS[id], true) || `Sorry, no more ${ITEMS[id] ? ITEMS[id].name : "of this item"} left`);
      return null;
    }
    if (qty > room) { toast(`Only ${ITEMS[id].stock} left in stock`); qty = room; }
    const key = lineKey(id, sel);
    const line = state.cart.find((l) => l.key === key);
    if (line) line.qty += qty;
    else state.cart.push({ key, id, sel, qty });
    saveCart();
    bumpCart();
    return key;
  }
  function setQty(key, qty) {
    const line = state.cart.find((l) => l.key === key);
    if (!line) return;
    const item = ITEMS[line.id];
    const max = line.qty + roomFor(line.id);
    if (qty > max) {
      toast(hasStockLimit(item) ? `Only ${item.stock} left in stock` : "Sorry, this item is sold out");
      qty = max;
    }
    line.qty = qty;
    if (line.qty <= 0) state.cart = state.cart.filter((l) => l.key !== key);
    saveCart();
  }
  function qtyOfItem(id) {
    return state.cart.filter((l) => l.id === id).reduce((a, l) => a + l.qty, 0);
  }

  function totals() {
    const sub = state.cart.reduce((a, l) => a + unitPrice(ITEMS[l.id], l.sel) * l.qty, 0);
    const delivery = sub > 0 && !(S.freeDeliveryAbove && sub >= S.freeDeliveryAbove) ? S.deliveryFee : 0;
    const tax = Math.round(sub * S.taxRate);
    const total = sub + delivery + tax;
    const belowMin = sub < S.minOrder;
    return { sub, delivery, tax, total, belowMin };
  }

  // ---------------------------------------------------------------------------
  // Router
  // ---------------------------------------------------------------------------
  let lastPage = null;
  function route() {
    const hash = location.hash.replace(/^#\/?/, "");
    const [page, arg] = hash.split("/");
    const navBtn = $("#navBtn");
    const isMenu = !page;
    navBtn.innerHTML = isMenu
      ? `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/></svg>`
      : `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z"/></svg>`;
    navBtn.setAttribute("aria-label", isMenu ? "Open menu" : "Back");
    if (lastPage === "" && !isMenu) state.menuScroll = window.scrollY;
    lastPage = page || "";
    $("#drawer").hidden = true;
    view.onclick = null;
    view.onkeydown = null;

    if (!catalogReady && page !== "order") return renderLoading();
    if (page !== "order") {
      const notes = reconcileCart();
      if (notes.length) { state.cartNotice = notes.join(" "); if (page !== "cart" && page !== "checkout") toast(notes[0]); }
    }
    if (page === "item" && ITEMS[arg] && !isRetired(ITEMS[arg])) renderItem(ITEMS[arg]);
    else if (page === "cart") renderCart();
    else if (page === "checkout") renderCheckout();
    else if (page === "order") renderDone(arg);
    else renderMenu();
  }

  // The top-left button opens the drawer on the menu and goes "up" one level elsewhere.
  const PARENT = { item: "#/", cart: "#/", checkout: "#/cart", order: "#/" };
  $("#navBtn").addEventListener("click", () => {
    const page = location.hash.replace(/^#\/?/, "").split("/")[0];
    if (!page) openDrawer();
    else location.hash = PARENT[page] || "#/";
  });

  function go(hash) {
    if (location.hash === hash) route();
    else location.hash = hash;
  }

  // ---------------------------------------------------------------------------
  // Menu page
  // ---------------------------------------------------------------------------
  function matches(item) {
    const f = state.filters;
    if (f.q) {
      const q = f.q.toLowerCase();
      if (!(item.name + " " + item.desc).toLowerCase().includes(q)) return false;
    }
    if (f.vrat && !(item.category === "navratri-thali" || /vrat/i.test(item.badge || ""))) return false;
    if (f.popular && !/popular/i.test(item.badge || "")) return false;
    if (f.under500 && (!hasPrice(item) || minPrice(item) >= 500)) return false;
    return true;
  }

  function cardHTML(item) {
    const q = qtyOfItem(item.id);
    const hasOpts = item.options && item.options.length;
    let action;
    const blocked = blockedLabel(item);
    if (blocked) action = `<button class="add" disabled>${blocked}</button>`;
    else if (!hasOpts && q > 0) {
      action = `<div class="stepper" data-stop>
        <button data-dec="${item.id}" aria-label="Remove one">−</button><span>${q}</span><button data-inc="${item.id}" aria-label="Add one"${roomFor(item.id) > 0 ? "" : " disabled"}>+</button>
      </div>`;
    } else action = `<button class="add" data-add="${item.id}">${hasOpts ? "ADD+" : "ADD"}${hasOpts && q ? ` (${q})` : ""}</button>`;

    const w = orderWindow(item);
    const dim = item.soldOut || (w && w.status === "closed");
    return `<article class="item${dim ? " sold" : ""}" data-open="${item.id}" tabindex="0" role="link" aria-label="${esc(item.name)}">
      <div class="thumb">
        ${itemVisual(item)}
        ${lowStock(item) && !item.soldOut ? `<span class="flag">ONLY ${item.stock} LEFT!</span>` : ""}
      </div>
      <div class="info">
        ${item.badge ? `<span class="tag ${badgeClass(item.badge)}">${esc(item.badge)}</span>` : ""}
        <div class="name-row"><h3>${esc(item.name)}</h3>${vegMark(item)}</div>
        <p class="desc">${esc(item.desc)}</p>
        ${shelfLifeNote(item)}
        ${whenNote(item)}
        <div class="buy"><span class="price">${priceHTML(item)}</span>${action}</div>
      </div>
    </article>`;
  }

  function renderMenu() {
    document.title = `${S.name} · Order Mithai Online`;
    const f = state.filters;
    const cats = CATALOG.map((cat) => ({ ...cat, list: cat.items.filter((i) => !isRetired(i) && matches(i)) }))
      .filter((c) => c.list.length);
    const filtering = f.q || f.vrat || f.popular || f.under500;

    view.innerHTML = `
      <div class="toolbar">
        <button class="pill" id="catBtn">Menu</button>
        <span class="spacer"></span>
        <button class="round${state.showSearch ? " on" : ""}" id="searchBtn" aria-label="Search">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M10 2a8 8 0 0 1 6.3 12.9l5.4 5.4-1.4 1.4-5.4-5.4A8 8 0 1 1 10 2Zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z"/></svg>
        </button>
        <button class="round${state.showFilters || filtering ? " on" : ""}" id="filterBtn" aria-label="Filters">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 3h2v5h2v2H4V8h2V3Zm0 9h2v9H6v-9Zm5 3h2v6h-2v-6Zm0-12h2v8h2v2H9v-2h2V3Zm5 0h2v11h2v2h-6v-2h2V3Zm0 15h2v3h-2v-3Z"/></svg>
        </button>
      </div>
      <div class="search-row" ${state.showSearch ? "" : "hidden"}>
        <input id="q" type="search" placeholder="Search kaju katli, ghewar, combos…" value="${esc(f.q)}" autocomplete="off">
      </div>
      <div class="filter-row" ${state.showFilters ? "" : "hidden"}>
        <button class="chip${f.vrat ? " on" : ""}" data-filter="vrat">🪔 Navratri</button>
        <button class="chip${f.popular ? " on" : ""}" data-filter="popular">⭐ Popular</button>
        <button class="chip${f.under500 ? " on" : ""}" data-filter="under500">Under ${S.currency}500</button>
      </div>
      ${S.banner && !filtering && cats.some((c) => c.id === S.banner.category) ? `<section class="banner">
        <h3>${esc(S.banner.title)}</h3><p>${esc(S.banner.text)}</p>
        <button data-jump="${esc(S.banner.category)}">${esc(S.banner.cta)} →</button>
      </section>` : ""}
      ${cats.map((cat) => `
        <section class="category${state.collapsed[cat.id] && !filtering ? " collapsed" : ""}" id="cat-${cat.id}">
          <button class="cat-head" data-toggle="${cat.id}" aria-expanded="${!state.collapsed[cat.id]}">
            <h2>${esc(cat.name)} <small>(${cat.list.length})</small></h2>
            <svg class="chev" viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="m12 8-6 6 1.4 1.4 4.6-4.6 4.6 4.6L18 14z"/></svg>
          </button>
          ${cat.subtitle ? `<p class="cat-sub">${esc(cat.subtitle)}</p>` : ""}
          <div class="items">${cat.list.map(cardHTML).join("")}</div>
        </section>`).join("") || `<p class="empty">No items match your search.</p>`}
      <footer class="site-foot">
        <strong>${esc(S.name)}</strong> · ${esc(S.city)}<br>
        ${esc(S.phone)} · ${esc(S.email)}<br>
        All our mithai is 100% vegetarian. Images are for representation only.
      </footer>
      ${cartBarHTML()}`;

    bindMenu();
    requestAnimationFrame(() => window.scrollTo(0, state.menuScroll));
    if (state.showSearch && f.q) {
      const q = $("#q");
      q.focus();
      q.setSelectionRange(q.value.length, q.value.length);
    }
  }

  function cartBarHTML() {
    const n = state.cart.reduce((a, l) => a + l.qty, 0);
    if (!n) return "";
    return `<a class="cart-bar" href="#/cart"><span>${n} item${n > 1 ? "s" : ""} · ${money(totals().sub)}</span><span>View Cart →</span></a>`;
  }

  function refreshMenuCards(id) {
    $$(`[data-open="${id}"]`).forEach((el) => { el.outerHTML = cardHTML(ITEMS[id]); });
    const bar = $(".cart-bar");
    const html = cartBarHTML();
    if (bar) bar.outerHTML = html || "<span></span>";
    else if (html) view.insertAdjacentHTML("beforeend", html);
  }

  function bindMenu() {
    $("#catBtn").onclick = openCategoryPicker;
    $("#searchBtn").onclick = () => {
      state.showSearch = !state.showSearch;
      if (!state.showSearch) state.filters.q = "";
      state.menuScroll = window.scrollY;
      renderMenu();
      if (state.showSearch) $("#q").focus();
    };
    $("#filterBtn").onclick = () => { state.showFilters = !state.showFilters; state.menuScroll = window.scrollY; renderMenu(); };
    const q = $("#q");
    let t;
    q.oninput = () => {
      clearTimeout(t);
      t = setTimeout(() => { state.filters.q = q.value.trim(); state.menuScroll = 0; renderMenu(); }, 250);
    };

    view.onclick = (e) => {
      const el = e.target.closest("[data-filter],[data-toggle],[data-jump],[data-add],[data-inc],[data-dec],[data-stop],[data-open]");
      if (!el) return;
      const d = el.dataset;
      if (d.filter) {
        state.filters[d.filter] = !state.filters[d.filter];
        state.menuScroll = window.scrollY;
        renderMenu();
      } else if (d.toggle) {
        state.collapsed[d.toggle] = !state.collapsed[d.toggle];
        el.closest(".category").classList.toggle("collapsed");
        el.setAttribute("aria-expanded", !state.collapsed[d.toggle]);
      } else if (d.jump) {
        jumpTo(d.jump);
      } else if (d.add) {
        const item = ITEMS[d.add];
        if (item.options && item.options.length) openItem(item.id);
        else { if (addToCart(item.id, [])) toast(`${item.name} added`); refreshMenuCards(item.id); }
      } else if (d.inc || d.dec) {
        const id = d.inc || d.dec;
        const key = lineKey(id, []);
        const line = state.cart.find((l) => l.key === key);
        setQty(key, (line ? line.qty : 0) + (d.inc ? 1 : -1));
        refreshMenuCards(id);
      } else if (d.stop) {
        /* clicks between stepper buttons shouldn't open the item */
      } else if (d.open) {
        openItem(d.open);
      }
    };
    view.onkeydown = (e) => {
      if (e.key === "Enter" && e.target.dataset && e.target.dataset.open) openItem(e.target.dataset.open);
    };
  }

  function openItem(id) {
    state.menuScroll = window.scrollY;
    location.hash = "#/item/" + id;
  }

  function jumpTo(catId) {
    state.collapsed[catId] = false;
    if (location.hash.replace(/^#\/?/, "")) {
      state.menuScroll = 0;
      location.hash = "#/";
      setTimeout(() => jumpTo(catId), 50);
      return;
    }
    const sec = document.getElementById("cat-" + catId);
    if (!sec) {
      // No such section (e.g. removed from the menu): nothing to jump to.
      if (!CATALOG.some((c) => c.id === catId)) return;
      // The section is hidden by filters — clear them and try once more.
      state.filters = { q: "", vrat: false, popular: false, under500: false };
      renderMenu();
      if (document.getElementById("cat-" + catId)) jumpTo(catId);
      return;
    }
    sec.classList.remove("collapsed");
    sec.scrollIntoView({ behavior: "smooth" });
  }

  function openCategoryPicker() {
    const scrim = document.createElement("div");
    scrim.className = "scrim";
    const pop = document.createElement("div");
    pop.className = "cat-pop";
    pop.setAttribute("role", "menu");
    pop.innerHTML = CATALOG
      .map((c) => ({ ...c, n: c.items.filter((i) => !isRetired(i)).length }))
      .filter((c) => c.n)
      .map((c) => `<button role="menuitem" data-cat="${c.id}"><span>${esc(c.name)}</span><span>${c.n}</span></button>`).join("");
    const close = () => { scrim.remove(); pop.remove(); };
    scrim.onclick = close;
    pop.onclick = (e) => { const b = e.target.closest("[data-cat]"); if (b) { close(); jumpTo(b.dataset.cat); } };
    document.body.append(scrim, pop);
    pop.querySelector("button").focus();
  }

  // ---------------------------------------------------------------------------
  // Item page
  // ---------------------------------------------------------------------------
  function renderItem(item) {
    document.title = `${item.name} · ${S.name}`;
    window.scrollTo(0, 0);
    const groups = item.options || [];
    const sel = groups.map(() => []);
    let qty = 1;
    let addedKey = null;
    let imgIdx = 0;
    const images = item.images || [];

    view.innerHTML = `
      <div class="detail-wrap">
        <div class="gallery">
          <div class="gallery-main" id="galleryMain">${itemVisual(item, true)}</div>
          ${images.length > 1 ? `<div class="thumbs">${images.map((src, i) => `<button data-img="${i}" class="${i ? "" : "on"}"><img src="${esc(src)}" alt=""></button>`).join("")}</div>` : ""}
        </div>
        <div class="detail">
          ${item.badge ? `<span class="tag ${badgeClass(item.badge)}">${esc(item.badge)}</span>` : ""}
          <div class="detail-head">${vegMark(item)}<h1>${esc(item.name)}</h1><span class="price">${priceHTML(item, true)}</span></div>
          ${shelfLifeNote(item)}
          ${whenNote(item)}
          <p class="desc-full">${item.includes ? "" : esc(item.desc)}${lowStock(item) && !item.soldOut ? `<br><strong style="color:var(--danger)">Only ${item.stock} left!</strong>` : ""}${item.soldOut ? `<br><strong style="color:var(--danger)">${item.unavailable ? "Not available right now" : "Sold out"}</strong>` : ""}</p>
          ${item.includes ? `<div class="includes"><h3>What's in the thali</h3><ul>${item.includes.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
          <form id="optForm">
            ${groups.map((g, gi) => `
              <fieldset class="group" data-group="${gi}">
                <legend>${esc(g.name)} <small>(<span data-count="${gi}">0</span>/${g.max || 1})</small>${g.required ? ` <span class="req">*</span>` : ""}</legend>
                ${g.choices.map((c, ci) => `
                  <label class="choice">
                    <input type="${(g.max || 1) === 1 && g.required ? "radio" : "checkbox"}" name="g${gi}" value="${ci}">
                    <span>${esc(c.label)}</span>
                    <em>${typeof c.factor === "number"
                      ? `${S.currency}${plain(Math.round(item.price * c.factor) + (c.price || 0))}`
                      : `${c.price >= 0 ? "+" : "−"} ${plain(Math.abs(c.price))}.00`}</em>
                  </label>`).join("")}
              </fieldset>`).join("")}
          </form>
        </div>
      </div>
      <div class="sticky-foot"><div class="inner" id="itemFoot"></div></div>`;

    const foot = $("#itemFoot");

    function drawFoot() {
      const blocked = blockedLabel(item, true);
      if (blocked) {
        foot.innerHTML = `<button class="btn primary" disabled>${esc(blocked)}</button>`;
        return;
      }
      if (!addedKey && roomFor(item.id) <= 0) {
        foot.innerHTML = `<button class="btn ghost" disabled>All ${item.stock} left are in your cart</button><a class="btn primary" href="#/cart">🛒 Go to cart</a>`;
        return;
      }
      if (addedKey) {
        const line = state.cart.find((l) => l.key === addedKey);
        const q = line ? line.qty : 0;
        foot.innerHTML = `
          <div class="stepper lg"><button data-q="-1" aria-label="Remove one">−</button><span>${q}</span><button data-q="1" aria-label="Add one"${roomFor(item.id) > 0 ? "" : " disabled"}>+</button></div>
          <a class="btn primary" href="#/cart">🛒 Go to cart</a>`;
        return;
      }
      const price = unitPrice(item, sel) * qty;
      foot.innerHTML = `
        <div class="stepper lg"><button data-q="-1" aria-label="Decrease">−</button><span>${qty}</span><button data-q="1" aria-label="Increase">+</button></div>
        <button class="btn primary" id="addBtn">Add to cart · ${money(price)}</button>`;
    }

    foot.onclick = (e) => {
      const stepBtn = e.target.closest("[data-q]");
      if (stepBtn) {
        const d = Number(stepBtn.dataset.q);
        if (addedKey) {
          const line = state.cart.find((l) => l.key === addedKey);
          setQty(addedKey, (line ? line.qty : 0) + d);
          if (!state.cart.find((l) => l.key === addedKey)) { addedKey = null; qty = 1; }
        } else {
          qty = Math.max(1, qty + d);
          const room = roomFor(item.id);
          if (qty > room) { qty = Math.max(1, room); toast(`Only ${item.stock} left in stock`); }
        }
        drawFoot();
        return;
      }
      if (e.target.closest("#addBtn")) {
        const missing = groups.findIndex((g, gi) => g.required && !sel[gi].length);
        $$(".group").forEach((f) => f.classList.remove("invalid"));
        if (missing >= 0) {
          const f = $(`[data-group="${missing}"]`);
          f.classList.add("invalid");
          f.scrollIntoView({ behavior: "smooth", block: "center" });
          toast(`Please choose: ${groups[missing].name}`);
          return;
        }
        addedKey = addToCart(item.id, sel.map((s) => [...s].sort((a, b) => a - b)), qty);
        if (addedKey) toast(`${item.name} added to cart`);
        drawFoot();
      }
    };

    $("#optForm").onchange = (e) => {
      const input = e.target;
      const gi = Number(input.name.slice(1));
      const g = groups[gi];
      const max = g.max || 1;
      const checked = $$(`input[name="g${gi}"]:checked`).map((i) => Number(i.value));
      if (input.type === "checkbox" && checked.length > max) {
        if (max === 1) {
          // Behave like a radio that can be un-ticked.
          $$(`input[name="g${gi}"]`).forEach((i) => { if (i !== input) i.checked = false; });
        } else {
          input.checked = false;
          toast(`You can pick up to ${max}`);
        }
      }
      sel[gi] = $$(`input[name="g${gi}"]:checked`).map((i) => Number(i.value));
      $(`[data-count="${gi}"]`).textContent = sel[gi].length;
      if (sel[gi].length) $(`[data-group="${gi}"]`).classList.remove("invalid");
      addedKey = null;
      qty = 1;
      drawFoot();
    };

    const thumbs = $(".thumbs");
    if (thumbs) thumbs.onclick = (e) => {
      const b = e.target.closest("[data-img]");
      if (!b) return;
      imgIdx = Number(b.dataset.img);
      $("#galleryMain").innerHTML = `<img src="${esc(images[imgIdx])}" alt="${esc(item.name)}">`;
      $$(".thumbs button").forEach((t, i) => t.classList.toggle("on", i === imgIdx));
    };

    drawFoot();
  }

  // ---------------------------------------------------------------------------
  // Cart page
  // ---------------------------------------------------------------------------
  function billHTML(t) {
    return `<div class="bill">
      <div class="row"><span>Item Sub Total</span><span>${money(t.sub)}</span></div>
      <div class="row"><span>Delivery Charges</span><span>${t.delivery ? money(t.delivery) : "FREE"}</span></div>
      <div class="row"><span>Taxes and Charges</span><span>${money(t.tax)}</span></div>
      <div class="row total"><span>To Pay</span><span>${money(t.total)}</span></div>
    </div>`;
  }

  function renderCart() {
    document.title = `Your Order · ${S.name}`;
    // A one-time message, e.g. "some items just ran out".
    const notice = state.cartNotice ? `<p class="notice" role="alert">${esc(state.cartNotice)}</p>` : "";
    state.cartNotice = "";
    if (!state.cart.length) {
      view.innerHTML = `<div class="page"><h1>Your Order</h1>${notice}
        <p class="empty">🪔<br><br>Your cart is empty.<br>Add some mithai to get started.</p>
        <a class="btn primary block" href="#/">Browse menu</a></div>`;
      return;
    }
    const t = totals();
    const freeGap = S.freeDeliveryAbove && t.sub < S.freeDeliveryAbove ? S.freeDeliveryAbove - t.sub : 0;
    const plan = deliveryPlan();

    view.innerHTML = `
      <div class="page">
        <h1>Your Order</h1>
        <p class="sub">Pre-order from ${esc(S.name)} · home delivery in ${esc(S.city)}</p>
        ${notice}
        ${state.cart.map((l) => {
          const item = ITEMS[l.id];
          return `<div class="line">
            <div><div class="nm">${vegMark(item).replace("veg-mark", "veg-mark inline")} ${esc(item.name)}</div>${selLabel(item, l.sel) ? `<div class="opt">${esc(selLabel(item, l.sel))}</div>` : ""}</div>
            <div class="stepper"><button data-key="${esc(l.key)}" data-d="-1" aria-label="Remove one">−</button><span>${l.qty}</span><button data-key="${esc(l.key)}" data-d="1" aria-label="Add one"${roomFor(l.id) > 0 ? "" : " disabled"}>+</button></div>
            <div class="amt">${money(unitPrice(item, l.sel) * l.qty)}</div>
          </div>`;
        }).join("")}
        <p><a href="#/" class="link-btn">+ ADD MORE ITEMS</a></p>
        ${billHTML(t)}
        ${freeGap ? `<p class="note">Add ${money(freeGap)} more for FREE delivery.</p>` : ""}
        ${t.belowMin ? `<p class="note">Minimum order for delivery is ${money(S.minOrder)}.</p>` : ""}
        ${plan.error ? `<p class="notice" role="alert">${esc(plan.error)}</p>`
          : plan.fixed ? `<p class="note thali-note">🍱 This order will be delivered on <b>${esc(fmtDay(plan.fixed))}</b>, your thali's day.</p>` : ""}
      </div>
      <div class="sticky-foot pay-foot"><div class="inner">
        <div class="topay"><span>To Pay</span><span>${money(t.total)}</span></div>
        <button class="btn primary block" id="proceed" ${t.belowMin || plan.error ? "disabled" : ""}>Proceed</button>
      </div></div>`;

    view.onclick = (e) => {
      const b = e.target.closest("[data-key],#proceed");
      if (!b) return;
      if (b.dataset.key) {
        const line = state.cart.find((l) => l.key === b.dataset.key);
        setQty(b.dataset.key, line.qty + Number(b.dataset.d));
        renderCart();
      } else if (b.id === "proceed") {
        if (!state.address || !state.address.ok) openAddress(() => go("#/checkout"));
        else go("#/checkout");
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Checkout page
  // ---------------------------------------------------------------------------
  const pastCutoff = () => new Date().getHours() >= S.orderCutoffHour;
  const hourLabel = (h) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;

  // Which days can this cart be delivered on?
  // Regular items: from tomorrow (or the day after, past the 6 PM cut-off) for
  // preorderMaxDays. A thali: only on its own day. Both together: the thali's
  // day, if the regular items can make it too.
  function regularDays() {
    const today = startOfDay(new Date());
    const minDays = S.preorderMinDays + (pastCutoff() ? 1 : 0);
    const out = [];
    for (let d = minDays; d <= minDays + S.preorderMaxDays - S.preorderMinDays; d++) out.push(addDays(today, d));
    return out;
  }
  function deliveryPlan() {
    const items = state.cart.map((l) => ITEMS[l.id]).filter(Boolean);
    const fixed = [...new Set(items.map((i) => i.deliveryDate).filter(Boolean))];
    const regular = items.filter((i) => !i.deliveryDate);
    const regDays = regularDays();
    if (fixed.length > 1) {
      return { days: [], error: "Each Navratri thali is delivered on its own day, so thalis for different days need separate orders. Please keep one day's thali in your cart." };
    }
    if (fixed.length === 1) {
      const day = parseDay(fixed[0]);
      if (regular.length && !regDays.some((d) => sameDay(d, day))) {
        const names = [...new Set(regular.map((i) => i.name))].join(", ");
        return {
          days: [], fixed: day,
          error: `Your thali is delivered on ${fmtDay(day)}, but ${names} can only be delivered from ${fmtDay(regDays[0])}. Please order them separately.`
        };
      }
      return { days: [day], fixed: day, earliest: sameDay(day, new Date()) ? sameDayEarliest() : null };
    }
    return { days: regDays };
  }

  function buildSlots(plan = deliveryPlan()) {
    return plan.days
      .map((day) => ({ label: fmtDay(day), slots: slotsOn(day, plan.earliest) }))
      .filter((d) => d.slots.length);
  }

  function renderCheckout() {
    document.title = `Checkout · ${S.name}`;
    if (!state.cart.length) return go("#/cart");
    const t = totals();
    if (t.belowMin) return go("#/cart");
    window.scrollTo(0, 0);
    const c = state.customer;
    const plan = deliveryPlan();
    if (plan.error) return go("#/cart");
    const days = buildSlots(plan);

    view.innerHTML = `
      <form class="page" id="checkoutForm" novalidate>
        <div class="field">
          <span class="lbl">Delivery Date &amp; Slot <span class="req">*</span></span>
          ${plan.fixed ? `<p class="hint thali-hint">🍱 Your Navratri thali is delivered on <b>${esc(fmtDay(plan.fixed))}</b>. Pick a time slot.</p>` : `<p class="hint">Pre-orders placed before ${hourLabel(S.orderCutoffHour)} can be delivered ${S.preorderMinDays === 1 ? "the next day" : `in ${S.preorderMinDays} days`}.${pastCutoff() ? ` Today's ${hourLabel(S.orderCutoffHour)} cut-off has passed, so the earliest date is one day later.` : ""}</p>`}
          <div class="two">
            <select id="day" aria-label="Date">${days.map((d, i) => `<option value="${i}">${esc(d.label)}</option>`).join("")}</select>
            <select id="slot" aria-label="Time slot"></select>
          </div>
        </div>
        <div class="field" data-f="name">
          <label for="name">Name <span class="req">*</span></label>
          <input id="name" autocomplete="name" value="${esc(c.name)}" required>
          <div class="err">Please enter your name</div>
        </div>
        <div class="field" data-f="email">
          <label for="email">Email <span class="req">*</span></label>
          <input id="email" type="email" autocomplete="email" value="${esc(c.email)}" required>
          <div class="err">Please enter a valid email</div>
        </div>
        <div class="field" data-f="phone">
          <label for="phone">Mobile Number for Order Notifications <span class="req">*</span></label>
          <div class="phone"><span>+91</span><input id="phone" type="tel" inputmode="numeric" maxlength="10" autocomplete="tel-national" value="${esc(c.phone)}" required></div>
          <div class="err">Please enter a 10-digit mobile number</div>
        </div>
          <div class="field" data-f="address">
            <div class="lbl-row"><span class="lbl">Delivering to <span class="req">*</span> <small>(as on map)</small></span><button type="button" class="link-btn" id="changeAddr">CHANGE</button></div>
            <div class="addr-box${state.address && state.address.ok ? "" : " empty"}" id="addrBox">${state.address && state.address.ok ? esc(state.address.text) : "Tap to pick your delivery location"}</div>
            <div class="err">Please pick your delivery location</div>
          </div>
          <div class="field" data-f="house">
            <label for="house">House No / Apartment <span class="req">*</span></label>
            <input id="house" autocomplete="address-line1" value="${esc(c.house)}" required>
            <div class="err">Please enter your house / flat number</div>
          </div>
          <div class="field">
            <label for="landmark">Nearest Landmark <small>(optional)</small></label>
            <input id="landmark" value="${esc(c.landmark)}">
          </div>
        <div class="field">
          <button type="button" class="toggle-more" id="moreBtn">Add more instructions +</button>
          <textarea id="notes" rows="3" placeholder="Message on box, sugar preference, gate code…" hidden></textarea>
        </div>
        <div class="field">
          <span class="lbl">Payment <span class="req">*</span></span>
          <div class="pay-opts">
            ${S.upiId ? `<label><input type="radio" name="pay" value="UPI" checked> Pay now with UPI (GPay / PhonePe / Paytm)</label>` : ""}
            <label><input type="radio" name="pay" value="COD" ${S.upiId ? "" : "checked"}> Cash / UPI on delivery</label>
          </div>
        </div>
        ${billHTML(t)}
      </form>
      <div class="sticky-foot pay-foot"><div class="inner">
        <div class="topay"><span>To Pay</span><span>${money(t.total)}</span></div>
        <button class="btn primary block" id="payNow" type="submit" form="checkoutForm">${S.upiId ? "Pay Now" : "Place Pre-order"}</button>
      </div></div>`;

    const daySel = $("#day"), slotSel = $("#slot");
    const fillSlots = () => {
      const d = days[Number(daySel.value)];
      slotSel.innerHTML = d ? d.slots.map((s) => `<option>${esc(s)}</option>`).join("") : "";
    };
    daySel.onchange = fillSlots;
    fillSlots();

    $("#phone").oninput = (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10); };
    $("#moreBtn").onclick = (e) => { e.target.hidden = true; const n = $("#notes"); n.hidden = false; n.focus(); };
    const pick = () => openAddress(() => renderCheckout());
    $("#changeAddr").onclick = pick;
    $("#addrBox").onclick = () => { if (!state.address || !state.address.ok) pick(); };

    $("#checkoutForm").onsubmit = (e) => {
      e.preventDefault();
      const v = (id) => ($("#" + id)?.value || "").trim();
      const checks = {
        name: v("name").length >= 2,
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v("email")),
        phone: /^[6-9]\d{9}$/.test(v("phone")),
        address: !!(state.address && state.address.ok),
        house: v("house").length > 0
      };
      let firstBad = null;
      Object.entries(checks).forEach(([k, ok]) => {
        const f = $(`[data-f="${k}"]`);
        if (!f) return;
        f.classList.toggle("bad", !ok);
        if (!ok && !firstBad) firstBad = f;
      });
      if (firstBad) { firstBad.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
      if (!days.length) { toast("No slots available right now. Please call us to order."); return; }
      // The 6 PM cut-off may have passed while the customer was filling the form.
      const chosen = days[Number(daySel.value)].label;
      const chosenSlot = slotSel.value;
      const fresh = buildSlots();
      if (!fresh.some((d) => d.label === chosen && d.slots.includes(chosenSlot))) {
        toast(`The ${hourLabel(S.orderCutoffHour)} cut-off has passed. Please pick a new delivery date.`);
        state.customer = { ...state.customer, name: v("name"), email: v("email"), phone: v("phone"), house: v("house"), landmark: v("landmark") };
        renderCheckout();
        return;
      }

      state.customer = { name: v("name"), email: v("email"), phone: v("phone"), house: v("house"), landmark: v("landmark") };
      store.set("customer", state.customer);
      placeOrder({
        slot: `${days[Number(daySel.value)].label}, ${slotSel.value}`,
        notes: v("notes"),
        payment: $("input[name=pay]:checked").value
      });
    };
  }

  // Send the order to the Sheet, which checks and reduces the stock.
  // Resolves to { ok: true } or { ok: false, problems?, items? }.
  async function sendToBackend(order) {
    const r = await fetch(S.backendUrl, { method: "POST", body: JSON.stringify(order) });
    return r.json();
  }

  async function placeOrder({ slot, notes, payment }) {
    const t = totals();
    // One ID per checkout visit, so a retry after a network hiccup can't
    // create (and charge stock for) the same order twice.
    if (!state.pendingOrderId) {
      const now = new Date();
      state.pendingOrderId = "MK" + now.toISOString().slice(2, 10).replace(/-/g, "") + Math.floor(1000 + Math.random() * 9000);
    }
    const id = state.pendingOrderId;
    const c = state.customer;
    const order = {
      id,
      placedAt: new Date().toISOString(),
      slot,
      payment,
      customer: { name: c.name, email: c.email, phone: "+91" + c.phone },
      address: { line: c.house, landmark: c.landmark, map: state.address.text, lat: state.address.lat, lng: state.address.lng },
      items: state.cart.map((l) => {
        const item = ITEMS[l.id];
        return { id: item.id, name: item.name, options: selLabel(item, l.sel), qty: l.qty, price: unitPrice(item, l.sel) * l.qty };
      }),
      notes,
      totals: { sub: t.sub, delivery: t.delivery, tax: t.tax, total: t.total }
    };

    if (S.backendUrl) {
      const btn = $("#payNow");
      btn.disabled = true;
      btn.textContent = "Placing your order…";
      let res;
      try {
        res = await sendToBackend(order);
      } catch {
        res = null;
      }
      if (!res) {
        btn.disabled = false;
        btn.textContent = S.upiId ? "Pay Now" : "Place Pre-order";
        toast("Couldn't reach our kitchen. Please check your internet and try again.");
        return;
      }
      if (!res.ok) {
        if (Array.isArray(res.items)) applyInventory(res.items);
        const names = (res.problems || []).map((p) => (p.left > 0 ? `${p.name} (only ${p.left} left)` : `${p.name} (sold out)`));
        state.cartNotice = names.length
          ? `Sorry, some items just ran out: ${names.join(", ")}. We've updated your cart. Please check it and place the order again.`
          : "Sorry, we couldn't place your order. Please try again.";
        go("#/cart");
        return;
      }
    }

    const orders = store.get("orders", {});
    orders[id] = order;
    store.set("orders", orders);

    // Our own order used up stock: show the new numbers straight away.
    state.cart = [];
    state.pendingOrderId = null;
    saveCart();
    if (S.backendUrl) refreshInventory();
    go("#/order/" + id);
  }

  function whatsappText(o) {
    const lines = [
      `*New pre-order ${o.id}* — ${S.name}`,
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
      `Email: ${o.customer.email}`
    ];
    lines.push(`Address: ${o.address.line}, ${o.address.map}`);
    if (o.address.landmark) lines.push(`Landmark: ${o.address.landmark}`);
    if (o.address.lat != null) lines.push(`Map: https://maps.google.com/?q=${o.address.lat},${o.address.lng}`);
    if (o.notes) lines.push(`Notes: ${o.notes}`);
    return lines.filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
  }

  function renderDone(id) {
    const o = store.get("orders", {})[id];
    if (!o) return go("#/");
    document.title = `Order ${o.id} · ${S.name}`;
    window.scrollTo(0, 0);
    const wa = `https://wa.me/${S.whatsappNumber}?text=${encodeURIComponent(whatsappText(o))}`;
    const upi = `upi://pay?pa=${encodeURIComponent(S.upiId)}&pn=${encodeURIComponent(S.name)}&am=${o.totals.total}&cu=INR&tn=${encodeURIComponent("Order " + o.id)}`;

    view.innerHTML = `
      <div class="page done">
        <div class="tick" aria-hidden="true">✓</div>
        <h1>Pre-order received!</h1>
        <p class="sub">Order ID <strong>${esc(o.id)}</strong><br>Delivery on ${esc(o.slot)}</p>
        <div class="actions">
          <a class="btn green block" href="${wa}" target="_blank" rel="noopener">Confirm order on WhatsApp</a>
          ${o.payment === "UPI" && S.upiId ? `<a class="btn primary block" href="${upi}">Pay ${money(o.totals.total)} with UPI</a>` : ""}
        </div>
        ${o.payment === "UPI" && S.upiId ? `<div class="upi">On a computer? Pay <strong>${money(o.totals.total)}</strong> to UPI ID <code>${esc(S.upiId)}</code> and mention <code>${esc(o.id)}</code>.</div>` : ""}
        <div class="card">
          <h3>Order summary</h3>
          ${o.items.map((i) => `<div class="bill"><div class="row"><span>${i.qty} × ${esc(i.name)}${i.options ? `<br><small style="color:var(--muted)">${esc(i.options)}</small>` : ""}</span><span>${money(i.price)}</span></div></div>`).join("")}
          <div class="bill"><div class="row total"><span>Total</span><span>${money(o.totals.total)}</span></div></div>
          <p class="sub" style="margin-top:12px">📍 ${esc(o.address.line)}, ${esc(o.address.map)}</p>
        </div>
        <a class="btn ghost block" href="#/">Back to menu</a>
      </div>`;
  }

  // ---------------------------------------------------------------------------
  // Address picker (OpenStreetMap + Leaflet, no API key needed)
  // ---------------------------------------------------------------------------
  const addrDialog = $("#addressDialog");
  const addrInput = $("#addrInput");
  const sugg = $("#addrSuggestions");
  const picked = $("#addrPicked");
  const contBtn = $("#addrContinue");
  let map = null, pending = null, onAddrDone = null, searchTimer, revTimer, searchAbort;

  // Is this place inside our delivery area? Uses the administrative parts of an
  // OpenStreetMap address (state / district / city), not street names, so a
  // "Delhi Road" in another city doesn't count.
  const AREAS = S.deliveryAreas.map((a) => a.toLowerCase());
  function inServiceArea(addr, text) {
    if (addr) {
      const parts = ["state", "state_district", "county", "city", "town", "city_district", "municipality"]
        .map((k) => (addr[k] || "").toLowerCase()).filter(Boolean);
      return parts.some((p) => AREAS.some((a) => p === a || p.includes(a)));
    }
    // No structured address (typed by hand): look for an area name in the text.
    const t = (text || "").toLowerCase();
    return AREAS.some((a) => new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(t));
  }
  // Rough Delhi NCR box, used only when the address lookup itself fails.
  const inServiceBox = (lat, lng) => {
    const b = S.serviceBox;
    return lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;
  };

  const areaDialog = $("#areaDialog");
  function notDelivering() {
    if (!areaDialog.open) areaDialog.showModal();
  }
  areaDialog.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) areaDialog.close(); });

  function setPending(p) {
    pending = p;
    if (!p) picked.textContent = "";
    else if (!p.ok) picked.innerHTML = `<span style="color:var(--danger)">📍 ${esc(p.text)}<br>We only deliver across Delhi NCR &amp; Gurgaon.</span>`;
    else picked.textContent = "📍 " + p.text;
    contBtn.disabled = !p;
    contBtn.classList.toggle("ok", !!(p && p.ok));
  }

  function openAddress(done) {
    onAddrDone = done;
    addrInput.value = "";
    sugg.hidden = true;
    setPending(state.address);
    addrDialog.showModal();
    if (!window.L) {
      // Map library failed to load (offline / blocked): let people type the address instead.
      $(".map-wrap").innerHTML = `<p class="empty">Map unavailable. Type your full address above and press Continue.</p>`;
      addrInput.oninput = () => {
        const text = addrInput.value.trim();
        setPending(text.length > 8 ? { text, lat: null, lng: null, ok: inServiceArea(null, text) } : null);
      };
      return;
    }
    const start = state.address && state.address.ok && state.address.lat != null
      ? [state.address.lat, state.address.lng] : [S.shop.lat, S.shop.lng];
    if (!map) {
      map = L.map("map", { zoomControl: true, attributionControl: true }).setView(start, 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: "© OpenStreetMap"
      }).addTo(map);
      map.on("moveend", () => {
        clearTimeout(revTimer);
        const c = map.getCenter();
        revTimer = setTimeout(() => reverseGeocode(c.lat, c.lng), 450);
      });
    } else {
      map.setView(start, 16);
    }
    setTimeout(() => map.invalidateSize(), 60);
  }

  let revSeq = 0;
  async function reverseGeocode(lat, lng) {
    const seq = ++revSeq;
    picked.textContent = "Finding address…";
    contBtn.disabled = true;
    let p;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${lat}&lon=${lng}`, {
        headers: { "Accept-Language": "en" }
      });
      const j = await r.json();
      p = { text: j.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng, ok: inServiceArea(j.address || {}, "") };
    } catch {
      p = { text: `Pinned location (${lat.toFixed(5)}, ${lng.toFixed(5)})`, lat, lng, ok: inServiceBox(lat, lng) };
    }
    if (seq !== revSeq) return; // a newer map move has started
    setPending(p);
    if (!p.ok) notDelivering();
  }

  addrInput.addEventListener("input", () => {
    if (!window.L) return;
    clearTimeout(searchTimer);
    const q = addrInput.value.trim();
    if (q.length < 3) { sugg.hidden = true; return; }
    searchTimer = setTimeout(async () => {
      if (searchAbort) searchAbort.abort();
      searchAbort = new AbortController();
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=in&q=${encodeURIComponent(q)}`, {
          signal: searchAbort.signal, headers: { "Accept-Language": "en" }
        });
        const list = await r.json();
        sugg.innerHTML = list.length
          ? list.map((p, i) => {
              const [head, ...rest] = p.display_name.split(", ");
              return `<li data-i="${i}"><b>${esc(head)}</b> ${esc(rest.join(", "))}</li>`;
            }).join("")
          : `<li class="muted">No places found. Try a nearby landmark, then move the map.</li>`;
        sugg.hidden = false;
        sugg.onclick = (e) => {
          const li = e.target.closest("[data-i]");
          if (!li) return;
          const p = list[Number(li.dataset.i)];
          sugg.hidden = true;
          addrInput.value = p.display_name;
          map.setView([Number(p.lat), Number(p.lon)], 17);
        };
      } catch (err) {
        if (err.name !== "AbortError") { sugg.innerHTML = `<li class="muted">Search unavailable — move the map to your location.</li>`; sugg.hidden = false; }
      }
    }, 400);
  });

  $("#locateBtn").onclick = () => {
    if (!navigator.geolocation || !map) return toast("Location isn't available on this device");
    toast("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 18),
      () => toast("Couldn't get your location. Please search instead."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  contBtn.onclick = () => {
    if (!pending) return;
    if (!pending.ok) return notDelivering();
    state.address = pending;
    store.set("address", pending);
    addrDialog.close();
    if (onAddrDone) onAddrDone();
  };
  addrDialog.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) addrDialog.close();
    else if (!e.target.closest(".addr-search")) sugg.hidden = true;
  });

  // ---------------------------------------------------------------------------
  // Live inventory from the Google Sheet
  // ---------------------------------------------------------------------------
  let catalogReady = false;
  let inventoryFailed = false;

  function applyInventory(items) {
    buildCatalog(items);
    catalogReady = true;
    store.set("inventory", items);
    const notes = reconcileCart();
    if (notes.length) state.cartNotice = notes.join(" ");
    return notes;
  }

  let refreshing = null;
  function refreshInventory() {
    if (!S.backendUrl) return Promise.resolve();
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const page = location.hash.replace(/^#\/?/, "").split("/");
      const before = JSON.stringify(store.get("inventory", null));
      const itemBefore = page[0] === "item" ? JSON.stringify(ITEMS[page[1]] || null) : "";
      const wasReady = catalogReady;
      try {
        const r = await fetch(S.backendUrl + (S.backendUrl.includes("?") ? "&" : "?") + "t=" + Date.now());
        const j = await r.json();
        if (!j.ok || !Array.isArray(j.items)) throw new Error("bad inventory");
        inventoryFailed = false;
        if (JSON.stringify(j.items) === before && wasReady) return;
        const notes = applyInventory(j.items);
        rerenderAfterStockChange(page, itemBefore, wasReady, notes);
      } catch {
        inventoryFailed = true;
        if (!catalogReady) route(); // show the "couldn't load" message
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  // Redraw whatever the customer is looking at, without losing their place.
  function rerenderAfterStockChange(page, itemBefore, wasReady, notes) {
    const [name, arg] = page;
    if (!wasReady) return route();
    if (!name) { state.menuScroll = window.scrollY; route(); }
    else if (name === "item") { if (JSON.stringify(ITEMS[arg] || null) !== itemBefore) route(); }
    else if (name === "cart") route();
    else if (name === "checkout" && notes.length) go("#/cart");
    if (notes.length && name !== "cart" && name !== "checkout") toast(notes[0]);
  }

  function renderLoading() {
    view.innerHTML = inventoryFailed
      ? `<div class="page"><p class="empty">😕<br><br>We couldn't load today's menu.<br>Please check your internet connection.</p>
          <button class="btn primary block" id="retryMenu">Try again</button></div>`
      : `<div class="page"><p class="empty"><span class="spinner" aria-hidden="true"></span><br>Loading today's menu…</p></div>`;
    const retry = $("#retryMenu");
    if (retry) retry.onclick = () => { inventoryFailed = false; renderLoading(); refreshInventory(); };
  }

  // ---------------------------------------------------------------------------
  // Drawer
  // ---------------------------------------------------------------------------
  const drawer = $("#drawer");
  function openDrawer() { drawer.hidden = false; }
  drawer.addEventListener("click", (e) => {
    const link = e.target.closest("[data-close-drawer]");
    if (e.target === drawer || link) drawer.hidden = true;
    if (link && link.dataset.jump) { e.preventDefault(); jumpTo(link.dataset.jump); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      drawer.hidden = true;
      $$(".scrim, .cat-pop").forEach((n) => n.remove());
    }
  });

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  $("#brand").textContent = S.name;
  $("#drawerBrand").innerHTML = `${esc(S.name)}<small>${esc(S.tagline)}</small>`;
  $("#drawerInfo").innerHTML = `
    <p>🛵 Pre-orders only · home delivery across Delhi NCR &amp; Gurgaon</p>
    <p>🕘 Delivery slots from ${hourLabel(S.openHour)} · order by ${hourLabel(S.orderCutoffHour)} for next-day delivery</p>
    <p>📞 <a href="tel:${esc(S.phone.replace(/\s/g, ""))}">${esc(S.phone)}</a></p>
    <p>💬 <a href="https://wa.me/${esc(S.whatsappNumber)}" target="_blank" rel="noopener">Chat on WhatsApp</a></p>`;

  window.addEventListener("hashchange", route);
  saveCart();

  if (!S.backendUrl) {
    buildCatalog(null);
    catalogReady = true;
    route();
  } else {
    // Show the last stock we saw straight away, then fetch the latest.
    const cached = store.get("inventory", null);
    if (Array.isArray(cached)) {
      buildCatalog(cached);
      catalogReady = true;
    }
    route();
    refreshInventory();
    setInterval(() => { if (!document.hidden) refreshInventory(); }, S.refreshSeconds * 1000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshInventory(); });
  }
})();
