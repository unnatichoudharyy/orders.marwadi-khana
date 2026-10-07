"use client";

// The parts around every page: top bar, side drawer and toast messages.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { STORE } from "@/data/config";
import { hourLabel } from "@/lib/format";
import { isRetired } from "@/lib/schedule";
import { BackIcon, CartIcon, MenuIcon } from "./bits";
import { pageOf, useShop } from "./ShopProvider";

// The top-left button opens the drawer on the menu and goes "up" one level elsewhere.
const PARENT: Record<string, string> = { item: "/", cart: "/", checkout: "/cart/", order: "/" };

export function TopBar() {
  const { cartCount, bump, setDrawerOpen } = useShop();
  const router = useRouter();
  const page = pageOf(usePathname());
  const isMenu = !page;
  return (
    <header className="topbar">
      <button
        className="icon-btn"
        id="navBtn"
        aria-label={isMenu ? "Open menu" : "Back"}
        onClick={() => (isMenu ? setDrawerOpen(true) : router.push(PARENT[page] || "/"))}
      >
        {isMenu ? <MenuIcon /> : <BackIcon />}
      </button>
      <Link href="/" className="brand" id="brand">{STORE.name}</Link>
      <Link href="/cart/" className={`icon-btn cart-btn${bump ? " bump" : ""}`} aria-label="Cart">
        <CartIcon />
        <span className="badge" id="cartCount" key={bump} hidden={cartCount === 0}>{cartCount}</span>
      </Link>
    </header>
  );
}

export function Drawer() {
  const { drawerOpen, setDrawerOpen, catalog, now, jumpTo } = useShop();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawerOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setDrawerOpen]);
  if (!drawerOpen) return null;
  // Category shortcuts come from the live menu, so they never point at a removed section.
  const cats = catalog.categories.filter((c) => c.items.some((i) => !isRetired(i, now)));
  return (
    <div className="drawer" id="drawer" onClick={(e) => { if (e.target === e.currentTarget) setDrawerOpen(false); }}>
      <div className="drawer-panel" role="dialog" aria-label="Store information">
        <button className="icon-btn drawer-close" aria-label="Close" onClick={() => setDrawerOpen(false)}>✕</button>
        <div className="drawer-brand" id="drawerBrand">{STORE.name}<small>{STORE.tagline}</small></div>
        <nav className="drawer-links">
          <Link href="/" onClick={() => setDrawerOpen(false)}>Menu</Link>
          <Link href="/cart/" onClick={() => setDrawerOpen(false)}>Your Order</Link>
          {cats.map((c) => (
            <a key={c.id} href="#" onClick={(e) => { e.preventDefault(); jumpTo(c.id); }}>{c.name}</a>
          ))}
        </nav>
        <div className="drawer-info" id="drawerInfo">
          <p>🛵 Pre-orders only · home delivery across Delhi NCR &amp; Gurgaon</p>
          <p>🕘 Delivery slots from {hourLabel(STORE.openHour)} · order by {hourLabel(STORE.orderCutoffHour)} for next-day delivery</p>
          <p>📞 <a href={`tel:${STORE.phone.replace(/\s/g, "")}`}>{STORE.phone}</a></p>
          <p>💬 <a href={`https://wa.me/${STORE.whatsappNumber}`} target="_blank" rel="noopener">Chat on WhatsApp</a></p>
        </div>
      </div>
    </div>
  );
}

export function Toast() {
  const { toastState } = useShop();
  return toastState.n ? <ToastMessage key={toastState.n} msg={toastState.msg} /> : <div className="toast" id="toast" role="status" aria-live="polite" />;
}

function ToastMessage({ msg }: { msg: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShow(true));
    const t = setTimeout(() => setShow(false), 2200);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, []);
  return <div className={`toast${show ? " show" : ""}`} id="toast" role="status" aria-live="polite">{msg}</div>;
}
