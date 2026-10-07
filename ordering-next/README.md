# Marwadi Khana: ordering site (Next.js)

The **pre-order website for Marwadi Khana** (halwa, laddus, burfi, Navratri thalis and combos), with home delivery across Delhi NCR and Gurgaon.
It's built with **Next.js 16 + React 19 + TypeScript** and published as a static site. It needs no server, so it can be hosted free on GitHub Pages.

This is a like-for-like port of the earlier plain-HTML site. Before switching, the two were compared on the same customer journeys, and customers see and get the same thing:
- **Rules:** menu, prices and sizes, 6 PM cut-off, Navratri thali windows and mixed-cart rules.
- **Ordering:** stock from the Google Sheet, delivery-area check, checkout, and the WhatsApp/UPI flow.

## What customers can do

1. **Menu**: collapsible sections, a "Menu" jump list, search, and filters (Navratri, popular, under ₹500).
   - Stock comes live from your Google Sheet: "ONLY N LEFT!", **SOLD OUT** and **NOT AVAILABLE**.
   - Navratri thalis show "OPENS …" or "CLOSED" outside their ordering window.
2. **Item page**: photos and dish list. Required choices (weight / box size) and add-ons, with live prices.
3. **Your Order**: quantities, bill (sub total, delivery, GST) and cart rules:
   - one thali day per order;
   - a thali and mithai go together only if both can be delivered that day.
4. **Delivery address**: search, move the map pin, or use current location (OpenStreetMap; no API key).
   - Anywhere outside Delhi NCR / Gurgaon shows "Sorry, we are not currently delivering near your location."
5. **Checkout**:
   - Delivery date and slot from 10 AM. Before 6 PM → next day; after 6 PM → the day after. Thalis only on their day.
   - Contact details, then UPI or cash on delivery.
6. **Order received**: "Confirm order on WhatsApp" (full order text and map link) and "Pay with UPI".

## Where things live

| What | Where |
| --- | --- |
| Shop name, WhatsApp, UPI ID, phone, charges, slots, cut-off, delivery areas | `data/config.ts` |
| Menu: items, prices, sizes, add-ons, photos, shelf life, Navratri thalis | `data/menu.ts` |
| Photos | `public/images/` (refer to them as `images/name.webp`) |
| Colours and layout | `app/globals.css` |
| Google Sheet stock and orders | `backend/` (see `backend/SETUP.md`) |
| Pages | `app/` (`/`, `/item/<id>/`, `/cart/`, `/checkout/`, `/order/?id=…`) |
| Screens | `components/` |
| Business rules (prices, dates, thali windows, cart, delivery area) | `lib/` |
| Tests | `tests/` |

## Run it on your computer

Needs Node.js 22.

```bash
npm install
npm run dev        # http://localhost:3000
```

Checks (the same ones GitHub runs):

```bash
npm run lint
npm run typecheck
npm test           # business rules + Google Sheet script
npm run build      # writes the finished site to out/
```

## Publish it (GitHub Pages)

1. **Turn on Pages:** in the GitHub repo, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
2. **Publish:** push to `main`. The **Deploy to GitHub Pages** workflow runs the checks, builds the site and publishes it. It takes about 2 minutes.
   - It works both at `https://<owner>.github.io/<repo>/` and on a custom domain (the sub-path is detected automatically).

### Use orders.marwadikhana.com

Do the DNS step first. The site isn't reachable on the new address until the DNS points at GitHub.

1. **DNS:** at your domain provider, add a record:

   | Type | Name / Host | Value |
   | --- | --- | --- |
   | CNAME | `orders` | `<owner>.github.io` (the GitHub account or organisation that owns this repo, e.g. `fifthelephant.github.io`) |

2. **Custom domain:** after 10–30 minutes, go to **Settings → Pages → Custom domain**, enter `orders.marwadikhana.com` and click **Save**.
3. **HTTPS:** tick **Enforce HTTPS** once it becomes available.

### Connect the Google Sheet

Follow `backend/SETUP.md`. Then add the Sheet's web-app URL as a repository variable called **`SHEET_URL`** (**Settings → Secrets and variables → Actions → Variables**) and re-run the deploy workflow.
Or paste it into `SHEET_URL` at the top of `data/config.ts`.

## Good to know

- **Saved carts carry over:** customers keep their cart, address and details from the old site (same browser storage keys).
  Old links like `…/#/item/besan-laddu` redirect to the new pages.
- **Items added only in the Google Sheet** (with no entry in `data/menu.ts`) still show on the menu and open at `/item/?id=…`.
  Add them to `data/menu.ts` to give them sizes, emoji and their own page.
- **Time-based parts are worked out in the customer's browser**, so they're always current: the 6 PM cut-off, thali "OPENS / CLOSED", slots and stock.
  The pre-built HTML shows a short "Loading today's menu…" while this happens.
- **Payments** go to your UPI ID by link; check payments against the order ID.
  Automatic payment confirmation (Razorpay/Cashfree) would need a host with a server.
- **Security audit:** `npm audit` reports a warning in a lint tool (`braces`, via `eslint-config-next`).
  It's only used while developing and isn't part of the published site; `npm audit --omit=dev` is clean.
