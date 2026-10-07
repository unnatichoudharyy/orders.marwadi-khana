"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { STORE } from "@/data/config";
import { hourLabel, money } from "@/lib/format";
import { sendOrder } from "@/lib/order";
import { selLabel, totals, unitPrice } from "@/lib/pricing";
import { buildSlots, deliveryPlan, fmtDay, pastCutoff } from "@/lib/schedule";
import { save, load } from "@/lib/storage";
import type { Order } from "@/lib/types";
import { Bill, Loading } from "./bits";
import { useShop } from "./ShopProvider";

type Field = "name" | "email" | "phone" | "address" | "house";

export default function CheckoutPage() {
  const { ready, inventoryFailed, retryInventory } = useShop();
  useEffect(() => { document.title = `Checkout · ${STORE.name}`; window.scrollTo(0, 0); }, []);
  if (!ready) return <Loading failed={inventoryFailed} onRetry={retryInventory} />;
  return <CheckoutForm />;
}

function CheckoutForm() {
  const shop = useShop();
  const { cart, catalog, now: shopNow, address, openAddress, customer, setCustomer,
    toast, applyInventory, setCartNotice, clearCart, refreshInventory, checkoutOrderId, resetCheckoutOrderId } = shop;
  const router = useRouter();

  // Starts from the details saved last time.
  const [form, setForm] = useState(() => ({
    name: customer.name || "", email: customer.email || "", phone: customer.phone || "",
    house: customer.house || "", landmark: customer.landmark || "", notes: ""
  }));
  const [showNotes, setShowNotes] = useState(false);
  const [payment, setPayment] = useState<"UPI" | "COD">(STORE.upiId ? "UPI" : "COD");
  const [dayIdx, setDayIdx] = useState(0);
  const [slot, setSlot] = useState("");
  const [bad, setBad] = useState<Partial<Record<Field, boolean>>>({});
  const [placing, setPlacing] = useState(false);
  // Bumped when the cut-off passes mid-checkout, so dates refresh straight away.
  const [nowOverride, setNowOverride] = useState<Date | null>(null);
  const now = nowOverride && nowOverride > shopNow ? nowOverride : shopNow;
  const fieldRefs = useRef<Partial<Record<Field, HTMLDivElement | null>>>({});

  const t = totals(cart, catalog.items);
  const plan = useMemo(() => deliveryPlan(cart, catalog.items, now), [cart, catalog.items, now]);
  const days = useMemo(() => buildSlots(plan), [plan]);

  // Nothing to check out (or a cart that can't go as one order) → back to the cart.
  useEffect(() => {
    if (placing) return;
    if (!cart.length || t.belowMin || plan.error) router.replace("/cart/");
  }, [placing, cart.length, t.belowMin, plan.error, router]);

  if (!cart.length || t.belowMin || plan.error) return null;

  // The chosen day/slot, kept valid as slots change (e.g. same-day slots expiring).
  const dayI = dayIdx < days.length ? dayIdx : 0;
  const day = days[dayI];
  const slotV = day && day.slots.includes(slot) ? slot : day ? day.slots[0] : "";

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: k === "phone" ? e.target.value.replace(/\D/g, "").slice(0, 10) : e.target.value }));
  const pick = () => openAddress();
  const v = (k: keyof typeof form) => form[k].trim();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const checks: Record<Field, boolean> = {
      name: v("name").length >= 2,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v("email")),
      phone: /^[6-9]\d{9}$/.test(v("phone")),
      address: !!(address && address.ok),
      house: v("house").length > 0
    };
    const badNow = Object.fromEntries(Object.entries(checks).map(([k, ok]) => [k, !ok])) as Record<Field, boolean>;
    setBad(badNow);
    const firstBad = (Object.keys(checks) as Field[]).find((k) => !checks[k]);
    if (firstBad) { fieldRefs.current[firstBad]?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    if (!days.length) { toast("No slots available right now. Please call us to order."); return; }

    // The 6 PM cut-off (or a same-day slot) may have passed while the form was being filled.
    const chosen = days[dayI];
    const fresh = buildSlots(deliveryPlan(cart, catalog.items, new Date()));
    if (!fresh.some((d) => d.label === chosen.label && d.slots.includes(slotV))) {
      toast(`The ${hourLabel(STORE.orderCutoffHour)} cut-off has passed. Please pick a new delivery date.`);
      shop.setCustomer({ ...customer, name: v("name"), email: v("email"), phone: v("phone"), house: v("house"), landmark: v("landmark") });
      setNowOverride(new Date());
      setDayIdx(0);
      return;
    }

    const c = { name: v("name"), email: v("email"), phone: v("phone"), house: v("house"), landmark: v("landmark") };
    setCustomer(c);

    // One ID per checkout visit, so a retry after a network hiccup can't create the same order twice.
    const id = checkoutOrderId();
    const order: Order = {
      id,
      placedAt: new Date().toISOString(),
      slot: `${chosen.label}, ${slotV}`,
      payment,
      customer: { name: c.name, email: c.email, phone: "+91" + c.phone },
      address: { line: c.house, landmark: c.landmark, map: address!.text, lat: address!.lat, lng: address!.lng },
      items: cart.map((l) => {
        const item = catalog.items[l.id];
        return { id: item.id, name: item.name, options: selLabel(item, l.sel), qty: l.qty, price: unitPrice(item, l.sel) * l.qty };
      }),
      notes: v("notes"),
      totals: { sub: t.sub, delivery: t.delivery, tax: t.tax, total: t.total }
    };

    if (STORE.backendUrl) {
      setPlacing(true);
      let res = null;
      try { res = await sendOrder(order); } catch { res = null; }
      if (!res) {
        setPlacing(false);
        toast("Couldn't reach our kitchen. Please check your internet and try again.");
        return;
      }
      if (!res.ok) {
        setPlacing(false);
        if (Array.isArray(res.items)) applyInventory(res.items);
        const names = (res.problems || []).map((p) => (p.left > 0 ? `${p.name} (only ${p.left} left)` : `${p.name} (sold out)`));
        setCartNotice(names.length
          ? `Sorry, some items just ran out: ${names.join(", ")}. We've updated your cart. Please check it and place the order again.`
          : "Sorry, we couldn't place your order. Please try again.");
        router.push("/cart/");
        return;
      }
    }

    setPlacing(true);
    const orders = load<Record<string, Order>>("orders", {});
    orders[id] = order;
    save("orders", orders);
    clearCart();
    resetCheckoutOrderId();
    if (STORE.backendUrl) refreshInventory(); // our own order used up stock
    router.push(`/order/?id=${encodeURIComponent(id)}`);
  }

  const payLabel = placing && STORE.backendUrl ? "Placing your order…" : STORE.upiId ? "Pay Now" : "Place Pre-order";

  return (
    <>
      <form className="page" id="checkoutForm" noValidate onSubmit={submit}>
        <div className="field">
          <span className="lbl">Delivery Date &amp; Slot <span className="req">*</span></span>
          {plan.fixed ? (
            <p className="hint thali-hint">🍱 Your Navratri thali is delivered on <b>{fmtDay(plan.fixed)}</b>. Pick a time slot.</p>
          ) : (
            <p className="hint">
              Pre-orders placed before {hourLabel(STORE.orderCutoffHour)} can be delivered {STORE.preorderMinDays === 1 ? "the next day" : `in ${STORE.preorderMinDays} days`}.
              {pastCutoff(now) ? ` Today's ${hourLabel(STORE.orderCutoffHour)} cut-off has passed, so the earliest date is one day later.` : ""}
            </p>
          )}
          <div className="two">
            <select id="day" aria-label="Date" value={dayI} onChange={(e) => { setDayIdx(Number(e.target.value)); setSlot(""); }}>
              {days.map((d, i) => <option key={d.label} value={i}>{d.label}</option>)}
            </select>
            <select id="slot" aria-label="Time slot" value={slotV} onChange={(e) => setSlot(e.target.value)}>
              {(day ? day.slots : []).map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className={`field${bad.name ? " bad" : ""}`} data-f="name" ref={(el) => { fieldRefs.current.name = el; }}>
          <label htmlFor="name">Name <span className="req">*</span></label>
          <input id="name" autoComplete="name" value={form.name} onChange={set("name")} required />
          <div className="err">Please enter your name</div>
        </div>
        <div className={`field${bad.email ? " bad" : ""}`} data-f="email" ref={(el) => { fieldRefs.current.email = el; }}>
          <label htmlFor="email">Email <span className="req">*</span></label>
          <input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} required />
          <div className="err">Please enter a valid email</div>
        </div>
        <div className={`field${bad.phone ? " bad" : ""}`} data-f="phone" ref={(el) => { fieldRefs.current.phone = el; }}>
          <label htmlFor="phone">Mobile Number for Order Notifications <span className="req">*</span></label>
          <div className="phone"><span>+91</span><input id="phone" type="tel" inputMode="numeric" maxLength={10} autoComplete="tel-national" value={form.phone} onChange={set("phone")} required /></div>
          <div className="err">Please enter a 10-digit mobile number</div>
        </div>
        <div className={`field${bad.address ? " bad" : ""}`} data-f="address" ref={(el) => { fieldRefs.current.address = el; }}>
          <div className="lbl-row">
            <span className="lbl">Delivering to <span className="req">*</span> <small>(as on map)</small></span>
            <button type="button" className="link-btn" id="changeAddr" onClick={pick}>CHANGE</button>
          </div>
          <div className={`addr-box${address && address.ok ? "" : " empty"}`} id="addrBox" onClick={() => { if (!address || !address.ok) pick(); }}>
            {address && address.ok ? address.text : "Tap to pick your delivery location"}
          </div>
          <div className="err">Please pick your delivery location</div>
        </div>
        <div className={`field${bad.house ? " bad" : ""}`} data-f="house" ref={(el) => { fieldRefs.current.house = el; }}>
          <label htmlFor="house">House No / Apartment <span className="req">*</span></label>
          <input id="house" autoComplete="address-line1" value={form.house} onChange={set("house")} required />
          <div className="err">Please enter your house / flat number</div>
        </div>
        <div className="field">
          <label htmlFor="landmark">Nearest Landmark <small>(optional)</small></label>
          <input id="landmark" value={form.landmark} onChange={set("landmark")} />
        </div>
        <div className="field">
          {showNotes ? (
            <textarea id="notes" rows={3} placeholder="Message on box, sugar preference, gate code…" value={form.notes} onChange={set("notes")} autoFocus />
          ) : (
            <button type="button" className="toggle-more" id="moreBtn" onClick={() => setShowNotes(true)}>Add more instructions +</button>
          )}
        </div>
        <div className="field">
          <span className="lbl">Payment <span className="req">*</span></span>
          <div className="pay-opts">
            {STORE.upiId ? (
              <label><input type="radio" name="pay" value="UPI" checked={payment === "UPI"} onChange={() => setPayment("UPI")} /> Pay now with UPI (GPay / PhonePe / Paytm)</label>
            ) : null}
            <label><input type="radio" name="pay" value="COD" checked={payment === "COD"} onChange={() => setPayment("COD")} /> Cash / UPI on delivery</label>
          </div>
        </div>
        <Bill t={t} />
      </form>
      <div className="sticky-foot pay-foot">
        <div className="inner">
          <div className="topay"><span>To Pay</span><span>{money(t.total)}</span></div>
          <button className="btn primary block" id="payNow" type="submit" form="checkoutForm" disabled={placing}>{payLabel}</button>
        </div>
      </div>
    </>
  );
}
