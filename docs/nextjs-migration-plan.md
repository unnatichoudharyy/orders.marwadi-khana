# Migrating Marwadi Khana to Next.js + React

Status: **plan only — nothing migrated yet.** The live site keeps running on the
current plain HTML/CSS/JS code until the new version passes every check below.

## 1. Where we are today

| Part | Size | What it does | Migration impact |
| --- | --- | --- | --- |
| `js/app.js` | 1,324 lines, 51 functions | Router, menu, item page, cart, checkout, address map, stock sync, thali schedule | **Rewrite** as React components + plain logic modules |
| `js/menu.js` | 285 lines | Items, sizes, add-ons, thalis | Move to typed `data/menu.ts` (content unchanged) |
| `js/config.js` | 72 lines | Shop settings | Move to typed `data/config.ts` |
| `css/style.css` | 411 lines | Maroon theme, layout | Reuse as-is first (global CSS), tidy later |
| `index.html` | 86 lines | Page shell, dialogs | Becomes `app/layout.tsx` + components |
| `backend/Code.gs` | 249 lines | Google Sheet stock + orders | **No change** (runs on Google, not on the website) |
| `images/` | 22 photos | Product photos | Move to `public/images/` |

The site is hosted on **GitHub Pages**, which only serves static files (no server).

## 2. Target setup

- **Next.js 16 (App Router) + React 19 + TypeScript**
- **Static export** (`output: "export"`) so it can stay on GitHub Pages for free, with
  `basePath: "/orders.marwadi-khana"` and `images.unoptimized: true`.
  - Deployed by a GitHub Actions workflow: Pages source changes from
    "Deploy from a branch" to "GitHub Actions".
- Google Sheet backend stays exactly as it is.
- Later (optional): moving to a host with a server (Netlify, or Vercel **Pro** —
  Vercel's free plan is for non-commercial use only) would unlock server
  routes for Razorpay payments, an admin page, etc.

### Page mapping

| Today (hash URL) | Next.js route | Notes |
| --- | --- | --- |
| `#/` | `/` | Menu |
| `#/item/besan-laddu` | `/item/[id]` | Pre-built for every item via `generateStaticParams` |
| `#/cart` | `/cart` | |
| `#/checkout` | `/checkout` | |
| `#/order/MK…` | `/order?id=MK…` | Order lives in the browser, so it can't be pre-built per ID |

A small script on `/` redirects old `#/…` links (e.g. shared on WhatsApp) to the new URLs.

### Code layout

```
app/            layout.tsx, page.tsx (menu), item/[id]/page.tsx, cart/, checkout/, order/
components/     ItemCard, CategoryPicker, Filters, Banner, OptionGroups, Stepper,
                CartLines, Bill, CheckoutForm, SlotPicker, AddressDialog (Leaflet),
                AreaPopup, Drawer, Toast
lib/            pricing.ts (unit price, sizes, totals), schedule.ts (6 PM cut-off,
                slots, thali windows, delivery plan), area.ts (Delhi NCR check),
                catalog.ts (menu + Sheet merge), whatsapp.ts, backend.ts
store/          cart + address + customer (React context, saved to localStorage
                under the same "mk_*" keys so existing carts survive)
data/           config.ts, menu.ts
public/images/  photos
```

## 3. Phases and effort

| # | Phase | Effort |
| --- | --- | --- |
| 0 | Turn today's checks into an automated Playwright suite (menu, sizes, cart, 6 PM cut-off, thali windows, mixed carts, delivery area popup, stock sync, WhatsApp text) to compare old vs new | 3–4 h |
| 1 | Scaffold Next.js + TypeScript, static export, basePath, GitHub Actions deploy | 2–3 h |
| 2 | Port the business rules into `lib/` as pure functions + unit tests (Vitest) | 5–6 h |
| 3 | Cart/address/customer store with the same localStorage keys | 2–3 h |
| 4 | Pages and components: menu, item, cart, checkout, order, drawer, toast | 8–10 h |
| 5 | Address picker with react-leaflet (browser-only), search, area popup | 3–4 h |
| 6 | Google Sheet stock sync, order submit, cart reconcile | 3 h |
| 7 | Parity run of the Phase 0 suite on both versions, phone testing, Lighthouse | 4–5 h |
| 8 | Cut-over: switch Pages to GitHub Actions; keep the old version tagged for rollback | 1 h |
| | **Total** | **≈ 31–39 h** (3–5 working days including your review) |

## 4. Risks and what it takes to handle them

| Risk | Impact | How we handle it | Extra effort |
| --- | --- | --- | --- |
| **Switching during Navratri (7–19 Oct)** — the site is live and taking thali orders | A broken deploy loses orders on the busiest days | Build on a separate branch; cut over **after 19 Oct**, only once Phase 7 passes; rollback = point Pages back to the old branch | none (timing) |
| **GitHub Pages can't run a server** | No SSR/API routes; wrong `basePath` → blank pages, missing CSS/images | Static export + `basePath`; test the exported build under the real path before cut-over | 1–2 h |
| **Time-based rules render at build time** (6 PM cut-off, thali "OPENS/CLOSED", slots) | Static HTML is built once, so dates would be stale or flash/mismatch on load (hydration errors) | Compute all date/stock-dependent UI on the client only; test with a fake clock | 2–3 h |
| **Behaviour regressions** in the many rules (thali windows, mixed carts, 500 g pricing, stock limits, delivery area) | Wrong prices or dates reach customers | Port rules as pure functions with unit tests; Playwright parity suite from Phase 0 | included |
| **Existing links and carts** | Shared `#/item/…` links break; saved carts lost | Same `mk_*` storage keys; hash-to-path redirect on `/` | ~1 h |
| **Leaflet map needs the browser** | Build crashes ("window is not defined") | Load the map component with `dynamic(..., { ssr: false })` | ~1 h |
| **Heavier JavaScript** | React + Next add roughly 90–120 KB; slightly slower first load on low-end phones | Keep most UI simple, check Lighthouse on a throttled phone profile | 1–2 h |
| **Build step from now on** | Editing `menu.js` no longer goes live instantly; each push runs a 1–2 min build; dependencies need updates | GitHub Actions builds automatically; Dependabot for updates | ongoing, small |
| **Hosting choice** | Vercel's free tier isn't for commercial use | Stay on GitHub Pages (static) or use Netlify; Vercel Pro (~$20/month) only if needed | decision |
| **Google Sheet backend** | Low — unchanged | Same requests (text/plain POST, GET with cache-buster) | none |

## 5. What the migration does and doesn't change for customers

- **Same:** menu, prices, photos, thali schedule, checkout, WhatsApp/UPI flow, Google Sheet.
- **Better for future work:** cleaner components, TypeScript catches mistakes, each item page gets its own real URL (good for sharing and Google search), and a clear path to Razorpay payments and an admin page.
- **Not automatically better:** speed and looks stay about the same; the main gain is maintainability.

## 6. Recommendation

1. Don't touch the live site during Navratri.
2. Start Phases 0–6 now on a separate branch (e.g. `nextjs-migration`) — the live site keeps running from the current branch.
3. Cut over after 19 Oct, once the parity suite is green.
