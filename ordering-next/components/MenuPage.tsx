"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { STORE } from "@/data/config";
import { money } from "@/lib/format";
import { itemHref } from "@/lib/catalog";
import { isFiltering, matches } from "@/lib/filters";
import { lineKey, totals } from "@/lib/pricing";
import { blockedLabel, isRetired, orderWindow } from "@/lib/schedule";
import type { MenuItem } from "@/lib/types";
import { Badge, ItemVisual, Loading, Price, ShelfLife, VegMark, WhenNote } from "./bits";
import { useShop } from "./ShopProvider";

const lowStock = (item: MenuItem) => typeof item.stock === "number" && item.stock > 0 && item.stock <= STORE.lowStockAt;

function ItemCard({ item, openItem }: { item: MenuItem; openItem: (id: string) => void }) {
  const { now, qtyOf, roomFor, addToCart, setQty, toast, cart } = useShop();
  const q = qtyOf(item.id);
  const hasOpts = !!(item.options && item.options.length);
  const blocked = blockedLabel(item, now);
  const w = orderWindow(item, now);
  const dim = item.soldOut || (w && w.status === "closed");
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  let action: React.ReactNode;
  if (blocked) action = <button className="add" disabled>{blocked}</button>;
  else if (!hasOpts && q > 0) {
    const key = lineKey(item.id, []);
    const line = cart.find((l) => l.key === key);
    action = (
      <div className="stepper" onClick={stop}>
        <button data-dec={item.id} aria-label="Remove one" onClick={() => setQty(key, (line ? line.qty : 0) - 1)}>−</button>
        <span>{q}</span>
        <button data-inc={item.id} aria-label="Add one" disabled={roomFor(item.id) <= 0} onClick={() => setQty(key, (line ? line.qty : 0) + 1)}>+</button>
      </div>
    );
  } else {
    action = (
      <button
        className="add"
        data-add={item.id}
        onClick={(e) => {
          stop(e);
          if (hasOpts) openItem(item.id);
          else if (addToCart(item.id, [])) toast(`${item.name} added`);
        }}
      >
        {hasOpts ? "ADD+" : "ADD"}{hasOpts && q ? ` (${q})` : ""}
      </button>
    );
  }

  return (
    <article
      className={`item${dim ? " sold" : ""}`}
      data-open={item.id}
      tabIndex={0}
      role="link"
      aria-label={item.name}
      onClick={() => openItem(item.id)}
      onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) openItem(item.id); }}
    >
      <div className="thumb">
        <ItemVisual item={item} />
        {lowStock(item) && !item.soldOut ? <span className="flag">ONLY {item.stock} LEFT!</span> : null}
      </div>
      <div className="info">
        <Badge item={item} />
        <div className="name-row"><h3>{item.name}</h3><VegMark item={item} /></div>
        <p className="desc">{item.desc}</p>
        <ShelfLife item={item} />
        <WhenNote item={item} now={now} />
        <div className="buy"><span className="price"><Price item={item} /></span>{action}</div>
      </div>
    </article>
  );
}

function CategoryPicker({ onClose }: { onClose: () => void }) {
  const { catalog, now, jumpTo } = useShop();
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const cats = catalog.categories
    .map((c) => ({ ...c, n: c.items.filter((i) => !isRetired(i, now)).length }))
    .filter((c) => c.n);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="cat-pop" role="menu">
        {cats.map((c, i) => (
          <button key={c.id} ref={i === 0 ? first : undefined} role="menuitem" data-cat={c.id} onClick={() => { onClose(); jumpTo(c.id); }}>
            <span>{c.name}</span><span>{c.n}</span>
          </button>
        ))}
      </div>
    </>
  );
}

export default function MenuPage() {
  const shop = useShop();
  const { ready, inventoryFailed, retryInventory, catalog, now, filters: f, setFilters, searchText: q, setSearchText: setQ,
    collapsed, setCollapsed, showSearch, setShowSearch, showFilters, setShowFilters, getMenuScroll, saveMenuScroll,
    takePendingJump, jumpTick, cart, cartCount } = shop;
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { document.title = `${STORE.name} · Order Mithai Online`; }, []);

  // Remember how far down the menu the customer was, and go back there.
  useEffect(() => {
    if (!ready) return;
    const y = getMenuScroll();
    requestAnimationFrame(() => window.scrollTo(0, y));
    const onScroll = () => saveMenuScroll(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [ready, getMenuScroll, saveMenuScroll]);

  // Search: wait for typing to pause.
  useEffect(() => {
    const t = setTimeout(() => {
      if (q.trim() !== f.q) { setFilters((x) => ({ ...x, q: q.trim() })); window.scrollTo(0, 0); }
    }, 250);
    return () => clearTimeout(t);
  }, [q, f.q, setFilters]);

  // Jump to a category (from the Menu button, banner or drawer). jumpTo() has
  // already cleared any filters hiding it, so here we only scroll.
  useEffect(() => {
    if (!ready) return;
    const id = takePendingJump();
    if (id) document.getElementById("cat-" + id)?.scrollIntoView({ behavior: "smooth" });
  }, [jumpTick, ready, takePendingJump]);

  if (!ready) return <Loading failed={inventoryFailed} onRetry={retryInventory} />;

  const openItem = (id: string) => { saveMenuScroll(window.scrollY); router.push(itemHref(id)); };
  const cats = catalog.categories
    .map((cat) => ({ ...cat, list: cat.items.filter((i) => !isRetired(i, now) && matches(i, f)) }))
    .filter((c) => c.list.length);
  const filtering = isFiltering(f);
  const toggleFilter = (k: "vrat" | "popular" | "under500") => setFilters((x) => ({ ...x, [k]: !x[k] }));
  const banner = STORE.banner;

  return (
    <>
      <div className="toolbar">
        <button className="pill" id="catBtn" onClick={() => setPickerOpen(true)}>Menu</button>
        <span className="spacer" />
        <button
          className={`round${showSearch ? " on" : ""}`}
          id="searchBtn"
          aria-label="Search"
          onClick={() => {
            const next = !showSearch;
            setShowSearch(next);
            if (!next) { setQ(""); setFilters((x) => ({ ...x, q: "" })); }
            else setTimeout(() => searchRef.current?.focus(), 0);
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M10 2a8 8 0 0 1 6.3 12.9l5.4 5.4-1.4 1.4-5.4-5.4A8 8 0 1 1 10 2Zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z" /></svg>
        </button>
        <button className={`round${showFilters || filtering ? " on" : ""}`} id="filterBtn" aria-label="Filters" onClick={() => setShowFilters(!showFilters)}>
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 3h2v5h2v2H4V8h2V3Zm0 9h2v9H6v-9Zm5 3h2v6h-2v-6Zm0-12h2v8h2v2H9v-2h2V3Zm5 0h2v11h2v2h-6v-2h2V3Zm0 15h2v3h-2v-3Z" /></svg>
        </button>
      </div>
      <div className="search-row" hidden={!showSearch}>
        <input ref={searchRef} id="q" type="search" placeholder="Search halwa, laddu, thali…" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      </div>
      <div className="filter-row" hidden={!showFilters}>
        <button className={`chip${f.vrat ? " on" : ""}`} data-filter="vrat" onClick={() => toggleFilter("vrat")}>🪔 Navratri</button>
        <button className={`chip${f.popular ? " on" : ""}`} data-filter="popular" onClick={() => toggleFilter("popular")}>⭐ Popular</button>
        <button className={`chip${f.under500 ? " on" : ""}`} data-filter="under500" onClick={() => toggleFilter("under500")}>Under {STORE.currency}500</button>
      </div>

      {banner && !filtering && cats.some((c) => c.id === banner.category) ? (
        <section className="banner">
          <h3>{banner.title}</h3>
          <p>{banner.text}</p>
          <button data-jump={banner.category} onClick={() => shop.jumpTo(banner.category)}>{banner.cta} →</button>
        </section>
      ) : null}

      {cats.length ? cats.map((cat) => {
        const isCollapsed = !!collapsed[cat.id] && !filtering;
        return (
          <section key={cat.id} className={`category${isCollapsed ? " collapsed" : ""}`} id={`cat-${cat.id}`}>
            <button className="cat-head" data-toggle={cat.id} aria-expanded={!collapsed[cat.id]} onClick={() => setCollapsed((c) => ({ ...c, [cat.id]: !c[cat.id] }))}>
              <h2>{cat.name} <small>({cat.list.length})</small></h2>
              <svg className="chev" viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="m12 8-6 6 1.4 1.4 4.6-4.6 4.6 4.6L18 14z" /></svg>
            </button>
            {cat.subtitle ? <p className="cat-sub">{cat.subtitle}</p> : null}
            <div className="items">{cat.list.map((item) => <ItemCard key={item.id} item={item} openItem={openItem} />)}</div>
          </section>
        );
      }) : <p className="empty">No items match your search.</p>}

      <footer className="site-foot">
        <strong>{STORE.name}</strong> · {STORE.city}<br />
        {STORE.phone} · {STORE.email}<br />
        All our mithai is 100% vegetarian. Images are for representation only.
      </footer>

      {cartCount ? (
        <Link className="cart-bar" href="/cart/">
          <span>{cartCount} item{cartCount > 1 ? "s" : ""} · {money(totals(cart, catalog.items).sub)}</span>
          <span>View Cart →</span>
        </Link>
      ) : null}

      {pickerOpen ? <CategoryPicker onClose={() => setPickerOpen(false)} /> : null}
    </>
  );
}
