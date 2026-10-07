# Marwadi Khana: online ordering site

A mobile-first **pre-order** website for Marwadi Khana (mithai, Navratri specials and combos).
It is home delivery only, across Delhi NCR and Gurgaon.
It uses plain HTML, CSS and JavaScript, with no build step and no server.
You manage the menu and stock in a **Google Sheet** (see [backend/SETUP.md](backend/SETUP.md)).

## What customers can do

1. **Menu**: browse collapsible categories. The **Menu** button jumps to a category. Customers can search and filter (vrat friendly, popular, under ₹500). Cards show "ONLY N LEFT!" when stock is low, and are greyed out as SOLD OUT or NOT AVAILABLE when they can't be ordered. Stock comes live from your Google Sheet.
2. **Item page**: pick a required option (weight, type, number of kanyas) and optional add-ons (gift wrap, card…) with live pricing. After adding, the button changes to **Go to cart**.
3. **Your Order**: change quantities and see the bill (sub total, delivery charges, GST, to pay).
4. **Delivery address**: search a place, move the map pin, or use current location. The map uses OpenStreetMap, so no API key is needed.
   An address outside Delhi NCR / Gurgaon shows a popup: *"Sorry, we are not currently delivering near your location."*
5. **Checkout**: pick a delivery date and time slot (from 10 AM). Orders placed before 6 PM can be delivered the next day; after 6 PM the earliest date is the day after tomorrow. Enter name, email, mobile, house no., landmark and instructions. Choose UPI or cash on delivery.
6. **Order received**: shows the order ID and summary. A **Confirm order on WhatsApp** button sends the full order (items, address, Google Maps link) to your WhatsApp number. A **Pay with UPI** button opens GPay/PhonePe/Paytm with the amount filled in.

## Make it yours

| What | Where |
| --- | --- |
| Shop name, WhatsApp number, UPI ID, phone, where the map starts | `js/config.js` |
| Delivery fee, free-delivery limit, minimum order, GST | `js/config.js` |
| Areas you deliver to (`deliveryAreas`) | `js/config.js` |
| The Navratri banner | `js/config.js` |
| Earliest and latest pre-order day, 6 PM order cut-off, slot timings (from 10 AM) | `js/config.js` |
| Which items are on sale, names, prices, categories, **stock**, available on/off | your Google Sheet ([backend/SETUP.md](backend/SETUP.md)) |
| Sizes/weights, add-ons, emoji for each item | `js/menu.js` |
| Google Sheet link (`backendUrl`) and the low-stock number (`lowStockAt`) | `js/config.js` |
| Colours (maroon theme) and fonts | top of `css/style.css` |

### Adding photos
Put photos in an `images/` folder and list them on the item in `js/menu.js`:

```js
images: ["images/besan-laddu.webp", "images/besan-laddu-box.jpg"],
```

The first photo shows on the menu card. The item page shows all of them with thumbnails.
Items without photos show their emoji on a coloured tile.

### Inventory and orders in a Google Sheet
Follow [backend/SETUP.md](backend/SETUP.md) once (about 10 minutes). After that:
- **Shop window:** the Sheet's **Inventory** tab decides what's on sale.
- **Stock goes down automatically** with every order.
- **Order log:** each order is added to the **Orders** tab.

Until `backendUrl` is set, the site uses the items in `js/menu.js` as-is.

## Run it locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Put it online (free)
- **GitHub Pages**: repo **Settings → Pages → Deploy from a branch**, pick the branch and `/ (root)`.
- **Netlify / Vercel**: drag and drop the folder, or connect the repo. There is nothing to build.

## Navratri thalis
The **Navratri Thalis** section lists one thali per day of Navratri. All 9 are always visible, but:
- **Delivery:** each thali is delivered only on its own day (Day 1 on 11 Oct … Day 9 on 19 Oct).
- **Ordering:** each thali can be ordered the day before or on the day itself. On the day, only slots at least 2 hours away are offered. Outside that window its button reads "OPENS …" or "CLOSED".
- **Mixed carts:** a cart can't mix thalis for different days. A thali plus mithai goes out together on the thali's day, if the mithai can be delivered that day.
- **Price:** set the price in the Sheet's price column (or `THALI_PRICE` in `js/menu.js`). Until then the thalis show "Price coming soon" and can't be ordered.
- **Dates and window:** change the dates with `NAVRATRI_DAY_1` in `js/menu.js`, and the window with `thaliOrderDaysBefore` / `sameDayPrepHours` in `js/config.js`.

## Delivery area
`deliveryAreas` in `js/config.js` lists the places you deliver to:
Delhi, New Delhi, Gurugram/Gurgaon, Noida, Greater Noida, Ghaziabad and Faridabad.
The site checks the state, district and city of the address the customer picks, so a street called "Delhi Road" in another city doesn't count.
To deliver only to Delhi and Gurgaon, remove the Noida, Ghaziabad and Faridabad lines.

## Things to know
- **Payments**: UPI links go straight to your UPI ID, so check the payment against the order ID.
  To take card/UPI payments automatically you would need a gateway such as Razorpay or Cashfree, plus a small server.
- **Order records**: orders reach you on WhatsApp. Once the Sheet is connected, they also go into its Orders tab.
- **Address search** uses OpenStreetMap's free Nominatim service. That's fine for a small shop.
  If you get a lot of traffic, switch to a paid geocoding provider.
