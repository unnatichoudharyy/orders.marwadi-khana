"use client";

// Small building blocks shared by several pages.

import { asset, money, plain } from "@/lib/format";
import { fmtDate, fmtDay, orderWindow, sameDay } from "@/lib/schedule";
import type { MenuItem, Totals } from "@/lib/types";

/**
 * Photos are shown whole (not cropped), so there's space around them. Fill it
 * with the colour of the photo's own corner so the photo blends in, whether
 * it was shot on white or off-white.
 */
function matchBackdrop(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  const box = img.closest<HTMLElement>(".thumb, .gallery-main");
  if (!box) return;
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0, img.naturalWidth * 0.03, img.naturalHeight * 0.03, 0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    box.style.background = `rgb(${r}, ${g}, ${b})`;
  } catch {
    /* photo from another website that doesn't allow reading it: keep default */
  }
}

export function Photo({ src, alt, eager }: { src: string; alt: string; eager?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element -- static export: plain <img>, no image optimizer
  return <img src={asset(src)} alt={alt} loading={eager ? "eager" : "lazy"} onLoad={matchBackdrop} />;
}

export function ItemVisual({ item, large }: { item: MenuItem; large?: boolean }) {
  const img = item.images && item.images[0];
  if (img) return <Photo src={img} alt={item.name} eager={large} />;
  return <div className="emoji-tile" aria-hidden="true">{item.emoji || "🍬"}</div>;
}

export const VegMark = ({ item, inline }: { item: MenuItem; inline?: boolean }) =>
  item.veg === false ? null : <span className={`veg-mark${inline ? " inline" : ""}`} title="Vegetarian" />;

export const badgeClass = (b: string) => (/vrat/i.test(b) ? "vrat" : /new/i.test(b) ? "new" : "");

export function Badge({ item }: { item: MenuItem }) {
  return item.badge ? <span className={`tag ${badgeClass(item.badge)}`}>{item.badge}</span> : null;
}

export function Price({ item, decimals }: { item: MenuItem; decimals?: boolean }) {
  if (typeof item.price !== "number") return <span className="tbd">Price coming soon</span>;
  return (
    <>
      {plain(item.price)}{decimals ? ".00" : ""}
      {item.unit ? <small className="unit">/ {item.unit}</small> : null}
    </>
  );
}

export function ShelfLife({ item }: { item: MenuItem }) {
  return item.shelfLife ? <p className="shelf">🕒 Shelf life: {item.shelfLife}</p> : null;
}

export function WhenNote({ item, now }: { item: MenuItem; now: Date }) {
  const w = orderWindow(item, now);
  if (!w) return null;
  const range = sameDay(w.opens, w.deliver) ? fmtDate(w.deliver) : `${fmtDate(w.opens)}–${fmtDate(w.deliver)}`;
  return (
    <p className="when">
      🗓️ Delivered on <b>{fmtDay(w.deliver)}</b> · order {range}
    </p>
  );
}

export function Bill({ t }: { t: Totals }) {
  return (
    <div className="bill">
      <div className="row"><span>Item Sub Total</span><span>{money(t.sub)}</span></div>
      <div className="row"><span>Delivery Charges</span><span>{t.delivery ? money(t.delivery) : "FREE"}</span></div>
      <div className="row"><span>Taxes and Charges</span><span>{money(t.tax)}</span></div>
      <div className="row total"><span>To Pay</span><span>{money(t.total)}</span></div>
    </div>
  );
}

export function Loading({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  return failed ? (
    <div className="page">
      <p className="empty">😕<br /><br />We couldn&apos;t load today&apos;s menu.<br />Please check your internet connection.</p>
      <button className="btn primary block" id="retryMenu" onClick={onRetry}>Try again</button>
    </div>
  ) : (
    <div className="page">
      <p className="empty"><span className="spinner" aria-hidden="true" /><br />Loading today&apos;s menu…</p>
    </div>
  );
}

export const MenuIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" /></svg>
);
export const BackIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z" /></svg>
);
export const CartIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM5.2 4H2V2h4.6l.9 2H22l-3.4 8.6a2 2 0 0 1-1.9 1.4H8.1l-1 2H19v2H4l2.6-4.9L5.2 4Z" /></svg>
);
