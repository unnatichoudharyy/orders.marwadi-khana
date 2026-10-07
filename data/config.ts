// ---------------------------------------------------------------------------
// Store configuration — edit these values to make the site your own.
// ---------------------------------------------------------------------------
import type { StoreConfig } from "@/lib/types";

// Google Sheet web-app URL from backend/SETUP.md (looks like
// https://script.google.com/macros/s/AKfy.../exec). Leave "" to use data/menu.ts
// only. Can also be set at build time with NEXT_PUBLIC_BACKEND_URL (e.g. a
// GitHub Actions variable), which is used when this is left "".
const SHEET_URL: string = "";

export const STORE: StoreConfig = {
  name: "Marwadi Khana",
  tagline: "Asli Marwadi mithai, ghee mein bani · pre-orders only",
  city: "Delhi NCR",
  currency: "₹",

  // Orders are sent to this WhatsApp number (country code + number, digits only).
  whatsappNumber: "919999999999",
  phone: "+91 99999 99999",
  email: "orders@marwadikhana.com",

  // UPI ID shown at checkout for "Pay by UPI". Leave "" to hide UPI payment.
  upiId: "marwadikhana@upi",

  // Charges
  minOrder: 299,            // minimum item total for delivery
  deliveryFee: 80,          // flat delivery fee
  freeDeliveryAbove: 1499,  // item total at which delivery is free (0 = never)
  taxRate: 0.05,            // 5% GST on items

  // Promo banner at the top of the menu. Set to null to hide.
  banner: {
    title: "9 days of Navratri Thalis 🪔",
    text: "A different thali for every day of Navratri, from 11 Oct. Each thali is delivered on its day; order it the day before or on the day.",
    cta: "See the thalis",
    category: "navratri-thali"
  },

  // Pre-order delivery slots
  preorderMinDays: 1,       // earliest delivery day: 1 = tomorrow, 2 = day after…
  preorderMaxDays: 7,       // how many days ahead customers can choose
  orderCutoffHour: 18,      // orders placed at/after 6 PM skip one more day
                            // (after 6 PM today → earliest is the day after tomorrow)
  // Items with a fixed delivery day (the Navratri thalis): they can be ordered
  // from this many days before their day, up to the day itself as long as a
  // delivery slot is still at least sameDayPrepHours away.
  thaliOrderDaysBefore: 1,
  sameDayPrepHours: 2,
  openHour: 10,             // first slot starts at 10:00
  closeHour: 21,            // last slot ends at 21:00
  slotHours: 1.5,           // slot length (e.g. 9:00 – 10:30 AM)

  // Where we deliver. An address is accepted when its state / district / city
  // matches one of these names (as written on OpenStreetMap). Anything else
  // shows the "Sorry, we are not currently delivering near your location" popup.
  deliveryAreas: [
    "Delhi", "New Delhi",
    "Gurugram", "Gurgaon",
    "Noida", "Greater Noida", "Gautam Buddha Nagar",
    "Ghaziabad",
    "Faridabad"
  ],
  // Rough Delhi NCR box, only used if the address lookup service is down.
  serviceBox: { north: 28.95, south: 28.25, west: 76.80, east: 77.65 },

  // Map starts here (your kitchen).
  shop: {
    lat: 28.6139,
    lng: 77.2090
  },

  // Inventory backend: the Google Sheet web-app URL from backend/SETUP.md
  // (looks like https://script.google.com/macros/s/AKfy.../exec).
  // When set, the site shows the items, prices and stock from your Sheet and
  // every order reduces the stock there. Set SHEET_URL at the top of this file.
  backendUrl: SHEET_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "",
  lowStockAt: 10,           // show "ONLY N LEFT!" when stock is this or lower
  refreshSeconds: 60        // how often an open page re-checks the stock
};
