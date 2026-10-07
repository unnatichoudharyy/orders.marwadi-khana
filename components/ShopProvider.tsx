"use client";

// All shared state lives here: the menu (with live stock from the Google
// Sheet), the cart, the customer's address and details, toasts, and a few
// bits of menu UI state that should survive moving between pages.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { STORE } from "@/data/config";
import { buildCatalog, itemHref, type Catalog } from "@/lib/catalog";
import { hasStockLimit, qtyOfItem, reconcileCart, roomFor as roomForPure } from "@/lib/cart";
import { isFiltering, matches, NO_FILTERS, type Filters } from "@/lib/filters";
import { fetchInventory, newOrderId } from "@/lib/order";
import { lineKey } from "@/lib/pricing";
import { blockedLabel, isRetired } from "@/lib/schedule";
import { load, save } from "@/lib/storage";
import type { Address, CartLine, Customer, InventoryRow } from "@/lib/types";

export { NO_FILTERS, type Filters };

/** First path segment: "" (menu), "item", "cart", "checkout", "order". */
export const pageOf = (pathname: string | null) => (pathname || "/").replace(/^\/+|\/+$/g, "").split("/")[0] || "";

interface ShopContext {
  ready: boolean;
  inventoryFailed: boolean;
  retryInventory: () => void;
  now: Date;
  catalog: Catalog;
  cart: CartLine[];
  cartCount: number;
  bump: number;
  qtyOf: (id: string) => number;
  roomFor: (id: string) => number;
  addToCart: (id: string, sel: number[][], qty?: number) => string | null;
  setQty: (key: string, qty: number) => void;
  clearCart: () => void;
  address: Address | null;
  setAddress: (a: Address) => void;
  customer: Customer;
  setCustomer: (c: Customer) => void;
  cartNotice: string;
  setCartNotice: (s: string) => void;
  applyInventory: (rows: InventoryRow[]) => string[];
  refreshInventory: () => Promise<void>;
  toast: (msg: string) => void;
  toastState: { msg: string; n: number };
  // address picker
  addressOpen: boolean;
  openAddress: (onDone?: () => void) => void;
  closeAddress: (picked?: boolean) => void;
  // drawer
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  // menu UI state kept across pages
  filters: Filters;
  setFilters: (f: Filters | ((f: Filters) => Filters)) => void;
  /** What's typed in the search box (applied to filters.q after a short pause). */
  searchText: string;
  setSearchText: (s: string) => void;
  collapsed: Record<string, boolean>;
  setCollapsed: (f: (c: Record<string, boolean>) => Record<string, boolean>) => void;
  showSearch: boolean;
  setShowSearch: (v: boolean) => void;
  showFilters: boolean;
  setShowFilters: (v: boolean) => void;
  getMenuScroll: () => number;
  saveMenuScroll: (y: number) => void;
  /** Category the menu should scroll to next (read once). */
  takePendingJump: () => string | null;
  jumpTick: number;
  jumpTo: (catId: string) => void;
  /** One order ID per checkout visit, so a retried submit can't create a duplicate order. */
  checkoutOrderId: () => string;
  resetCheckoutOrderId: () => void;
}

const Ctx = createContext<ShopContext | null>(null);

export function useShop(): ShopContext {
  const c = useContext(Ctx);
  if (!c) throw new Error("useShop must be used inside <ShopProvider>");
  return c;
}

const EMPTY_CATALOG: Catalog = { categories: [], items: {} };

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const page = pageOf(pathname);

  const [ready, setReady] = useState(false);
  const [inventoryFailed, setInventoryFailed] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [catalog, setCatalog] = useState<Catalog>(EMPTY_CATALOG);
  const [cart, setCartState] = useState<CartLine[]>([]);
  const [address, setAddressState] = useState<Address | null>(null);
  const [customer, setCustomerState] = useState<Customer>({});
  const [cartNotice, setCartNotice] = useState("");
  const [bump, setBump] = useState(0);
  const [toastState, setToastState] = useState({ msg: "", n: 0 });
  const [addressOpen, setAddressOpen] = useState(false);
  // The drawer belongs to the page it was opened on, so it's closed after any navigation.
  const [drawer, setDrawer] = useState({ open: false, page: "" });
  const drawerOpen = drawer.open && drawer.page === page;
  const setDrawerOpen = useCallback((open: boolean) => setDrawer({ open, page }), [page]);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [searchText, setSearchText] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [jumpTick, setJumpTick] = useState(0);

  // Refs mirror state so actions can read/update it synchronously.
  const cartRef = useRef<CartLine[]>([]);
  const catalogRef = useRef<Catalog>(EMPTY_CATALOG);
  const loadedRef = useRef(false);
  const addrDoneRef = useRef<(() => void) | undefined>(undefined);
  const menuScroll = useRef(0);
  const pendingJump = useRef<string | null>(null);
  const pendingOrderId = useRef<string | null>(null);
  const prevPage = useRef<string | null>(null);
  const refreshing = useRef<Promise<void> | null>(null);

  const toast = useCallback((msg: string) => setToastState((t) => ({ msg, n: t.n + 1 })), []);

  const commitCart = useCallback((next: CartLine[]) => {
    cartRef.current = next;
    setCartState(next);
    save("cart", next);
  }, []);

  const setCatalogBoth = useCallback((c: Catalog) => {
    catalogRef.current = c;
    setCatalog(c);
  }, []);

  /** Apply fresh stock from the Sheet: rebuild the menu and fix the cart. */
  const applyInventory = useCallback((rows: InventoryRow[]) => {
    const c = buildCatalog(rows);
    setCatalogBoth(c);
    save("inventory", rows);
    const { cart: next, notes } = reconcileCart(cartRef.current, c.items, new Date());
    commitCart(next);
    if (notes.length) setCartNotice((n) => [n, ...notes].filter(Boolean).join(" "));
    setReady(true);
    return notes;
  }, [commitCart, setCatalogBoth]);

  const refreshInventory = useCallback((): Promise<void> => {
    if (!STORE.backendUrl) return Promise.resolve();
    if (refreshing.current) return refreshing.current;
    refreshing.current = (async () => {
      const before = JSON.stringify(load<InventoryRow[] | null>("inventory", null));
      try {
        const rows = await fetchInventory();
        setInventoryFailed(false);
        if (JSON.stringify(rows) === before && catalogRef.current.categories.length) return;
        const notes = applyInventory(rows);
        const p = pageOf(window.location.pathname.replace(process.env.NEXT_PUBLIC_BASE_PATH || "", ""));
        if (notes.length) {
          if (p === "checkout") router.push("/cart/");
          else if (p !== "cart") toast(notes[0]);
        }
      } catch {
        setInventoryFailed(true);
      } finally {
        refreshing.current = null;
      }
    })();
    return refreshing.current;
  }, [applyInventory, router, toast]);

  // ---- Start-up: read saved data, build the menu, start stock sync --------
  useEffect(() => {
    // Old links like ".../#/item/besan-laddu" (shared before the switch) → new pages.
    const h = window.location.hash;
    if (h.startsWith("#/")) {
      const path = h.slice(1).replace(/\/?$/, "/");
      const item = path.match(/^\/item\/([^/]+)\/$/);
      router.replace(item ? itemHref(decodeURIComponent(item[1])) : path.replace(/^\/order\/([^/]+)\/$/, "/order/?id=$1"));
    }

    cartRef.current = load<CartLine[]>("cart", []);
    setCartState(cartRef.current);
    setAddressState(load<Address | null>("address", null));
    setCustomerState(load<Customer>("customer", {}));
    loadedRef.current = true;

    if (!STORE.backendUrl) {
      setCatalogBoth(buildCatalog(null));
      setReady(true);
      return;
    }
    const cached = load<InventoryRow[] | null>("inventory", null);
    if (Array.isArray(cached)) {
      setCatalogBoth(buildCatalog(cached));
      setReady(true);
    }
    refreshInventory();
    const iv = setInterval(() => { if (!document.hidden) refreshInventory(); }, STORE.refreshSeconds * 1000);
    const onVis = () => { if (!document.hidden) refreshInventory(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep "OPENS / CLOSED" and slots current while the page stays open.
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(iv);
  }, []);

  // ---- Every page change: re-check the cart --------------------------------
  // Thali windows close and stock changes over time, so each page change
  // re-syncs the cart with the clock and the menu (an external system).
  useEffect(() => {
    if (!ready) return;
    const leftCart = prevPage.current === "cart" && page !== "cart";
    prevPage.current = page;
    if (page === "order") return;
    const t = new Date();
    setNow(t); // eslint-disable-line react-hooks/set-state-in-effect -- re-sync with the clock on navigation
    const { cart: next, notes } = reconcileCart(cartRef.current, catalogRef.current.items, t);
    if (next !== cartRef.current && (next.length !== cartRef.current.length || notes.length)) commitCart(next);
    if (leftCart) setCartNotice("");
    if (notes.length) {
      setCartNotice((n) => [leftCart ? "" : n, ...notes].filter(Boolean).join(" "));
      if (page !== "cart" && page !== "checkout") toast(notes[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, ready]);

  // ---- Cart actions -------------------------------------------------------
  const roomFor = useCallback(
    (id: string) => roomForPure(cartRef.current, catalogRef.current.items, id, new Date()),
    []
  );

  const addToCart = useCallback((id: string, sel: number[][], qty = 1): string | null => {
    const items = catalogRef.current.items;
    const item = items[id];
    const room = roomFor(id);
    if (room <= 0) {
      toast((item && blockedLabel(item, new Date(), true)) || `Sorry, no more ${item ? item.name : "of this item"} left`);
      return null;
    }
    if (qty > room) {
      toast(`Only ${item.stock} left in stock`);
      qty = room;
    }
    const key = lineKey(id, sel);
    const cur = cartRef.current;
    const next = cur.some((l) => l.key === key)
      ? cur.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l))
      : [...cur, { key, id, sel, qty }];
    commitCart(next);
    setBump((b) => b + 1);
    return key;
  }, [commitCart, roomFor, toast]);

  const setQty = useCallback((key: string, qty: number) => {
    const cur = cartRef.current;
    const line = cur.find((l) => l.key === key);
    if (!line) return;
    const item = catalogRef.current.items[line.id];
    const max = line.qty + roomFor(line.id);
    if (qty > max) {
      toast(item && hasStockLimit(item) ? `Only ${item.stock} left in stock` : "Sorry, this item is sold out");
      qty = max;
    }
    commitCart(qty <= 0 ? cur.filter((l) => l.key !== key) : cur.map((l) => (l.key === key ? { ...l, qty } : l)));
  }, [commitCart, roomFor, toast]);

  const clearCart = useCallback(() => commitCart([]), [commitCart]);

  const setAddress = useCallback((a: Address) => { setAddressState(a); save("address", a); }, []);
  const setCustomer = useCallback((c: Customer) => { setCustomerState(c); save("customer", c); }, []);

  const openAddress = useCallback((onDone?: () => void) => {
    addrDoneRef.current = onDone;
    setAddressOpen(true);
  }, []);
  const closeAddress = useCallback((picked?: boolean) => {
    setAddressOpen(false);
    const done = addrDoneRef.current;
    addrDoneRef.current = undefined;
    if (picked && done) done();
  }, []);

  const jumpTo = useCallback((catId: string) => {
    setCollapsed((c) => ({ ...c, [catId]: false }));
    // If the search/filters hide that whole section, clear them so it shows.
    const cat = catalogRef.current.categories.find((c) => c.id === catId);
    const t = new Date();
    if (cat && isFiltering(filters) && !cat.items.some((i) => !isRetired(i, t) && matches(i, filters))) {
      setFilters(NO_FILTERS);
      setSearchText("");
    }
    pendingJump.current = catId;
    setDrawer({ open: false, page: "" });
    if (pageOf(window.location.pathname.replace(process.env.NEXT_PUBLIC_BASE_PATH || "", "")) !== "") {
      menuScroll.current = 0;
      router.push("/");
    }
    setJumpTick((n) => n + 1);
  }, [router, filters]);

  const getMenuScroll = useCallback(() => menuScroll.current, []);
  const saveMenuScroll = useCallback((y: number) => { menuScroll.current = y; }, []);
  const takePendingJump = useCallback(() => { const id = pendingJump.current; pendingJump.current = null; return id; }, []);
  const checkoutOrderId = useCallback(() => (pendingOrderId.current ||= newOrderId()), []);
  const resetCheckoutOrderId = useCallback(() => { pendingOrderId.current = null; }, []);

  const retryInventory = useCallback(() => { setInventoryFailed(false); refreshInventory(); }, [refreshInventory]);

  const value = useMemo<ShopContext>(() => ({
    ready, inventoryFailed, retryInventory, now, catalog, cart,
    cartCount: cart.reduce((a, l) => a + l.qty, 0), bump,
    qtyOf: (id) => qtyOfItem(cart, id), roomFor, addToCart, setQty, clearCart,
    address, setAddress, customer, setCustomer, cartNotice, setCartNotice,
    applyInventory, refreshInventory, toast, toastState,
    addressOpen, openAddress, closeAddress, drawerOpen, setDrawerOpen,
    filters, setFilters, searchText, setSearchText, collapsed, setCollapsed, showSearch, setShowSearch, showFilters, setShowFilters,
    getMenuScroll, saveMenuScroll, takePendingJump, jumpTick, jumpTo, checkoutOrderId, resetCheckoutOrderId
  }), [ready, inventoryFailed, retryInventory, now, catalog, cart, bump, roomFor, addToCart, setQty, clearCart,
    address, setAddress, customer, setCustomer, cartNotice, applyInventory, refreshInventory, toast, toastState,
    addressOpen, openAddress, closeAddress, drawerOpen, setDrawerOpen, filters, searchText, collapsed, showSearch, showFilters,
    getMenuScroll, saveMenuScroll, takePendingJump, jumpTick, jumpTo, checkoutOrderId, resetCheckoutOrderId]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
