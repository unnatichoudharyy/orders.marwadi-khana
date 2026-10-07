# Connect your Google Sheet (inventory backend)

Once this is set up, the website reads its menu from a Google Sheet:

- **The site shows exactly the items in your Sheet**, with the names, prices and categories you type there.
- **Low stock:** when stock is 10 or less, the item shows "ONLY 7 LEFT!".
- **Sold out or unticked:** when stock reaches 0 the item shows **SOLD OUT**. If you untick *available*, it shows **NOT AVAILABLE**. Either way it greyed out and can't be ordered.
- **Every order is checked against the stock.** If it goes through, the stock goes down and the order is added to an **Orders** tab.
- **Pages already open update within about a minute** of a change in the Sheet.

It takes about 10 minutes and only needs your Google account.

---

## 1. Create the Sheet

1. Go to **https://sheets.new**. A blank Google Sheet opens. Name it *Marwadi Khana Inventory*.
2. Download [`inventory-template.csv`](inventory-template.csv) from this folder on GitHub (open it, then click **Download raw file**).
3. In the Sheet: **File → Import → Upload**, choose the file, pick **Replace current sheet**, and click **Import data**.

You now have one row per item.

## 2. Add the script

1. In the Sheet: **Extensions → Apps Script**. A code editor opens in a new tab.
2. Delete everything in the editor. Then paste in all of [`Code.gs`](Code.gs) from this folder.
3. Click the 💾 **Save** icon.

## 3. Run setup once

1. At the top of the editor, make sure the function dropdown says **setup**, then click **▶ Run**.
2. Google asks for permission. Click **Review permissions** and pick your account.
   You'll see *"Google hasn't verified this app"*. That's expected, because you wrote this script yourself.
   Click **Advanced → Go to … (unsafe) → Allow**.
3. Go back to the Sheet. The tab is now called **Inventory**, with tick boxes in the *available* column and colour-coded stock. There is also a new **Orders** tab.

## 4. Publish it as a web app

1. In the Apps Script tab: **Deploy → New deployment**.
2. Click the ⚙️ next to *Select type* and choose **Web app**.
3. Set **Execute as: Me** and **Who has access: Anyone**. The website needs to read it without signing in.
4. Click **Deploy** and copy the **Web app URL**. It ends in `/exec`.

## 5. Tell the website

Either:
- **GitHub (no code change):** in the repo, go to **Settings → Secrets and variables → Actions → Variables → New repository variable**. Name it `SHEET_URL`, paste the URL as the value, then re-run the **Deploy to GitHub Pages** workflow (Actions tab → Run workflow).
- **Or in code:** paste the URL into `SHEET_URL` at the top of `data/config.ts`, then commit and push.

Done 🎉

---

## Day-to-day: editing the Inventory tab

| Column | What it does |
| --- | --- |
| **id** | Short unique name, e.g. `kaju-katli`. Don't change it once an item is live. It links the row to the item's sizes, add-ons and emoji in `data/menu.ts`. |
| **name** | Name shown on the site. |
| **category** | Section on the menu, e.g. *Navratri Specials*. Type a new name and a new section appears. |
| **description** | Text under the name. Leave blank to use the one in `data/menu.ts`. |
| **price** | Starting price in ₹ (for the smallest size). |
| **stock** | How many you can still sell. 10 or less shows "ONLY N LEFT!". **0 = SOLD OUT**. **Blank = unlimited**. |
| **available** | Untick to switch an item off (it shows NOT AVAILABLE). |
| **badge** | Optional label: `POPULAR`, `NEW`, `VRAT FRIENDLY`… |
| **shelf_life** | Optional, e.g. `7 days`. Shown as "🕒 Shelf life: 7 days" on the item. |
| **image** | Optional photo link, e.g. `images/besan-halwa-jar.webp` or a full https link. For several photos (shown as a gallery on the item page), separate them with commas. |

- **Add an item:** add a new row. Items with sizes or add-ons (like weights) also need an entry with the same `id` in `data/menu.ts`. Items without one are sold as a single unit and don't get their own item page.
- **Remove an item completely:** delete its row.
- **Stock is counted per item, not per size:** an order of 2 × 500 g and 1 × 1 kg Kaju Katli uses 3 from Kaju Katli's stock.
- **Orders tab:** each order is a new row with status *New*. You can change the status yourself (*Confirmed*, *Delivered*…). The website doesn't read this tab.

## Changing the script later

If you paste in a newer `Code.gs`, publish the change: **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.
The URL stays the same, so the website doesn't need changing.

## Good to know

- **Only one order is processed at a time,** so two customers can't both buy the last box.
- **The Sheet does the final stock check when an order is placed.** If an item ran out in the meantime, the customer is told and their cart is updated.
- **Totals in the Orders tab come from the customer's browser.** As always, match the payment you receive against the order ID before dispatching.
- **The web-app link is public** (the website has to read it). Anyone who finds it could see your item list and stock, or send fake orders that use up stock. If stock suddenly drops with no matching WhatsApp messages or payments, check the Orders tab and correct the numbers.
