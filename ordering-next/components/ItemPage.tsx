"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { STORE } from "@/data/config";
import { money, plain } from "@/lib/format";
import { choicePrice, unitPrice } from "@/lib/pricing";
import { blockedLabel, isRetired } from "@/lib/schedule";
import { Badge, ItemVisual, Loading, Photo, Price, ShelfLife, VegMark, WhenNote } from "./bits";
import type { MenuItem } from "@/lib/types";
import { useShop } from "./ShopProvider";

export default function ItemPage({ id }: { id: string }) {
  const { ready, inventoryFailed, retryInventory, catalog, now } = useShop();
  const router = useRouter();
  const item = catalog.items[id];

  useEffect(() => { window.scrollTo(0, 0); }, []);
  useEffect(() => { if (item) document.title = `${item.name} · ${STORE.name}`; }, [item]);
  // Unknown or retired item (e.g. an old link to a thali after Navratri) → menu.
  useEffect(() => {
    if (ready && (!item || isRetired(item, now))) router.replace("/");
  }, [ready, item, now, router]);

  if (!ready) return <Loading failed={inventoryFailed} onRetry={retryInventory} />;
  if (!item || isRetired(item, now)) return null;
  return <ItemDetail key={item.id} item={item} />;
}

function ItemDetail({ item }: { item: MenuItem }) {
  const { now, cart, roomFor, addToCart, setQty, toast } = useShop();
  const groups = item.options || [];

  const [sel, setSel] = useState<number[][]>(() => groups.map(() => []));
  const [qty, setQtyLocal] = useState(1);
  const [addedKey, setAddedKey] = useState<string | null>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [invalid, setInvalid] = useState<number | null>(null);
  const groupRefs = useRef<(HTMLFieldSetElement | null)[]>([]);

  const images = item.images || [];
  const blocked = blockedLabel(item, now, true);
  const lowStock = typeof item.stock === "number" && item.stock > 0 && item.stock <= STORE.lowStockAt;
  const addedLine = addedKey ? cart.find((l) => l.key === addedKey) : undefined;

  function onChoice(gi: number, ci: number, checked: boolean) {
    const g = groups[gi];
    const max = g.max || 1;
    const radio = max === 1 && g.required;
    let next: number[];
    if (radio) next = [ci];
    else if (!checked) next = sel[gi].filter((x) => x !== ci);
    else if (max === 1) next = [ci]; // behaves like a radio that can be un-ticked
    else if (sel[gi].length >= max) { toast(`You can pick up to ${max}`); return; }
    else next = [...sel[gi], ci];
    setSel(sel.map((s, i) => (i === gi ? next : s)));
    if (next.length && invalid === gi) setInvalid(null);
    setAddedKey(null);
    setQtyLocal(1);
  }

  function step(d: number) {
    if (addedKey) {
      const line = cart.find((l) => l.key === addedKey);
      const nextQty = (line ? line.qty : 0) + d;
      setQty(addedKey, nextQty);
      if (nextQty <= 0) { setAddedKey(null); setQtyLocal(1); }
      return;
    }
    let n = Math.max(1, qty + d);
    const room = roomFor(item.id);
    if (n > room) { n = Math.max(1, room); toast(`Only ${item.stock} left in stock`); }
    setQtyLocal(n);
  }

  function add() {
    const missing = groups.findIndex((g, gi) => g.required && !sel[gi].length);
    if (missing >= 0) {
      setInvalid(missing);
      groupRefs.current[missing]?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast(`Please choose: ${groups[missing].name}`);
      return;
    }
    const key = addToCart(item.id, sel.map((s) => [...s].sort((a, b) => a - b)), qty);
    if (key) { toast(`${item.name} added to cart`); setAddedKey(key); }
  }

  let foot: React.ReactNode;
  if (blocked) {
    foot = <button className="btn primary" disabled>{blocked}</button>;
  } else if (addedKey && addedLine) {
    foot = (
      <>
        <div className="stepper lg">
          <button data-q="-1" aria-label="Remove one" onClick={() => step(-1)}>−</button>
          <span>{addedLine.qty}</span>
          <button data-q="1" aria-label="Add one" disabled={roomFor(item.id) <= 0} onClick={() => step(1)}>+</button>
        </div>
        <Link className="btn primary" href="/cart/">🛒 Go to cart</Link>
      </>
    );
  } else if (roomFor(item.id) <= 0) {
    foot = (
      <>
        <button className="btn ghost" disabled>All {item.stock} left are in your cart</button>
        <Link className="btn primary" href="/cart/">🛒 Go to cart</Link>
      </>
    );
  } else {
    foot = (
      <>
        <div className="stepper lg">
          <button data-q="-1" aria-label="Decrease" onClick={() => step(-1)}>−</button>
          <span>{qty}</span>
          <button data-q="1" aria-label="Increase" onClick={() => step(1)}>+</button>
        </div>
        <button className="btn primary" id="addBtn" onClick={add}>Add to cart · {money(unitPrice(item, sel) * qty)}</button>
      </>
    );
  }

  return (
    <>
      <div className="detail-wrap">
        <div className="gallery">
          <div className="gallery-main" id="galleryMain">
            {images.length ? <Photo key={imgIdx} src={images[imgIdx]} alt={item.name} eager /> : <ItemVisual item={item} large />}
          </div>
          {images.length > 1 ? (
            <div className="thumbs">
              {images.map((src, i) => (
                <button key={src} data-img={i} className={i === imgIdx ? "on" : ""} onClick={() => setImgIdx(i)}>
                  <Photo src={src} alt="" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="detail">
          <Badge item={item} />
          <div className="detail-head"><VegMark item={item} /><h1>{item.name}</h1><span className="price"><Price item={item} decimals /></span></div>
          <ShelfLife item={item} />
          <WhenNote item={item} now={now} />
          <p className="desc-full">
            {item.includes ? "" : item.desc}
            {lowStock && !item.soldOut ? <><br /><strong style={{ color: "var(--danger)" }}>Only {item.stock} left!</strong></> : null}
            {item.soldOut ? <><br /><strong style={{ color: "var(--danger)" }}>{item.unavailable ? "Not available right now" : "Sold out"}</strong></> : null}
          </p>
          {item.includes ? (
            <div className="includes">
              <h3>What&apos;s in the thali</h3>
              <ul>{item.includes.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          ) : null}
          <form id="optForm" onSubmit={(e) => e.preventDefault()}>
            {groups.map((g, gi) => (
              <fieldset key={g.name} className={`group${invalid === gi ? " invalid" : ""}`} data-group={gi} ref={(el) => { groupRefs.current[gi] = el; }}>
                <legend>
                  {g.name} <small>(<span data-count={gi}>{(sel[gi] || []).length}</span>/{g.max || 1})</small>
                  {g.required ? <> <span className="req">*</span></> : null}
                </legend>
                {g.choices.map((c, ci) => (
                  <label key={c.label} className="choice">
                    <input
                      type={(g.max || 1) === 1 && g.required ? "radio" : "checkbox"}
                      name={`g${gi}`}
                      value={ci}
                      checked={(sel[gi] || []).includes(ci)}
                      onChange={(e) => onChoice(gi, ci, e.target.checked)}
                    />
                    <span>{c.label}</span>
                    <em>
                      {typeof c.factor === "number"
                        ? `${STORE.currency}${plain(choicePrice(item, c))}`
                        : `${(c.price ?? 0) >= 0 ? "+" : "−"} ${plain(Math.abs(c.price ?? 0))}.00`}
                    </em>
                  </label>
                ))}
              </fieldset>
            ))}
          </form>
        </div>
      </div>
      <div className="sticky-foot"><div className="inner" id="itemFoot">{foot}</div></div>
    </>
  );
}
