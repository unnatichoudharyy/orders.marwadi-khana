"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { STORE } from "@/data/config";
import { money } from "@/lib/format";
import { upiLink, whatsappLink } from "@/lib/order";
import { load } from "@/lib/storage";
import type { Order } from "@/lib/types";

/** "Pre-order received" page. Orders live in the customer's browser, so the ID comes from ?id=. */
export default function OrderPage() {
  const id = useSearchParams().get("id") || "";
  const router = useRouter();
  // useSearchParams makes this part render only in the browser (inside <Suspense>),
  // so it's safe to read the saved order straight away.
  const [order] = useState<Order | null>(() => (typeof window === "undefined" ? null : load<Record<string, Order>>("orders", {})[id] || null));

  useEffect(() => {
    if (!order) router.replace("/");
    else { document.title = `Order ${order.id} · ${STORE.name}`; window.scrollTo(0, 0); }
  }, [order, router]);

  if (!order) return null;
  const o = order;
  const upi = o.payment === "UPI" && STORE.upiId;

  return (
    <div className="page done">
      <div className="tick" aria-hidden="true">✓</div>
      <h1>Pre-order received!</h1>
      <p className="sub">Order ID <strong>{o.id}</strong><br />Delivery on {o.slot}</p>
      <div className="actions">
        <a className="btn green block" href={whatsappLink(o)} target="_blank" rel="noopener">Confirm order on WhatsApp</a>
        {upi ? <a className="btn primary block" href={upiLink(o)}>Pay {money(o.totals.total)} with UPI</a> : null}
      </div>
      {upi ? (
        <div className="upi">On a computer? Pay <strong>{money(o.totals.total)}</strong> to UPI ID <code>{STORE.upiId}</code> and mention <code>{o.id}</code>.</div>
      ) : null}
      <div className="card">
        <h3>Order summary</h3>
        {o.items.map((i, n) => (
          <div className="bill" key={n}>
            <div className="row">
              <span>{i.qty} × {i.name}{i.options ? <><br /><small style={{ color: "var(--muted)" }}>{i.options}</small></> : null}</span>
              <span>{money(i.price)}</span>
            </div>
          </div>
        ))}
        <div className="bill"><div className="row total"><span>Total</span><span>{money(o.totals.total)}</span></div></div>
        <p className="sub" style={{ marginTop: 12 }}>📍 {o.address.line}, {o.address.map}</p>
      </div>
      <Link className="btn ghost block" href="/">Back to menu</Link>
    </div>
  );
}
