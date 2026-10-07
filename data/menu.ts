import type { Category, MenuItem, OptionGroup } from "@/lib/types";

// ---------------------------------------------------------------------------
// Menu data — add, remove or edit categories and items here.
// (Field reference: see lib/types.ts.)
//
// Category: { id, name, subtitle?, items: [...] }
// Item fields:
//   id        unique string (used in the URL, keep it simple)
//   name      display name
//   desc      description
//   price     base price in rupees
//   veg       true for veg (all mithai here is veg) — shows the green dot
//   images    optional list of photo URLs, e.g. ["images/kaju-katli.jpg"]
//             (first one is the thumbnail; the item page shows a gallery)
//   emoji     shown on a coloured tile when there is no photo
//   badge     optional "POPULAR", "NEW", "VRAT FRIENDLY", ...
//   stock     optional number — shows "ONLY N LEFT!" when 10 or fewer
//   soldOut   optional true
//   options   optional list of option groups:
//             { name, required, max, choices: [{ label, price }] }
//             required: customer must pick one; max: how many can be picked
//             price on a choice is added to the base price;
//             factor on a choice scales it (e.g. factor: 0.5 for half a kg)
//   unit      optional, shown after the price: "kg" → "1,500 / kg"
//   deliveryDate  optional "YYYY-MM-DD": item is delivered only on that day
//             and can be ordered only shortly before (see config)
//   orderFrom optional "YYYY-MM-DD": with deliveryDate, first day it can be ordered
//   visibleUntil optional "YYYY-MM-DD": item is hidden from the day after
//   includes  optional list shown on the item page ("What's in it")
//   shelfLife optional, e.g. "7 days" — shown on the card and item page
// ---------------------------------------------------------------------------

// Laddus are priced per kg; a 1 kg box holds about 24, so each box is priced
// by its share of a kg (box of 4 = 4/24 of the per-kg price).
// Halwa and burfi are priced per kg; 500 g is half the per-kg price.
const KG_WEIGHT: OptionGroup = {
  name: "Select weight", required: true, max: 1, choices: [
    { label: "500 g", factor: 0.5 },
    { label: "1 kg", factor: 1 }
  ]
};

const LADDU_BOX: OptionGroup = {
  name: "Select box", required: true, max: 1, choices: [
    { label: "Box of 4 laddus (≈ 170 g)", factor: 4 / 24 },
    { label: "Box of 8 laddus (≈ 330 g)", factor: 8 / 24 },
    { label: "Box of 12 laddus (≈ 500 g)", factor: 12 / 24 },
    { label: "Box of 24 laddus (≈ 1 kg)", factor: 1 }
  ]
};

const GIFTING: OptionGroup = {
  name: "Add-ons", required: false, max: 3, choices: [
    { label: "Festive gift wrap", price: 50 },
    { label: "Greeting card with your message", price: 30 },
    { label: "Silver-foil (varq) finish", price: 60 }
  ]
};

// ---------------------------------------------------------------------------
// Navratri thalis: one thali per day of Navratri. Each is delivered only on
// its own day, and can be ordered the day before or on the day itself
// (see thaliOrderDaysBefore in data/config.ts) — except Day 1, open from
// DAY_1_ORDERS_OPEN. All nine stay on the menu until THALIS_SHOWN_UNTIL.
// ---------------------------------------------------------------------------
const NAVRATRI_DAY_1 = "2026-10-11";   // date of Day 1 (YYYY-MM-DD)
const DAY_1_ORDERS_OPEN = "2026-10-07"; // Day 1 can be pre-ordered from this date
const THALIS_SHOWN_UNTIL = "2026-10-19"; // the section disappears after this date
const THALI_PRICE: number | null = 750;               // ₹ per thali (null shows "Price coming soon")

// Photo for each day's thali (days without one show the 🍱 emoji).
const THALI_PHOTOS: Record<number, string> = {
  1: "images/navratri-thali-day-1.webp",
  2: "images/navratri-thali-day-2.webp",
  3: "images/navratri-thali-day-3.webp",
  4: "images/navratri-thali-day-4.webp",
  5: "images/navratri-thali-day-5.webp"
};

function navratriThali(day: number, name: string, includes: string[]): MenuItem {
  const d = new Date(NAVRATRI_DAY_1 + "T00:00:00");
  d.setDate(d.getDate() + day - 1);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    id: `navratri-thali-day-${day}`,
    name,
    desc: includes.join(" · "),
    includes,
    price: THALI_PRICE,
    deliveryDate: iso,
    // Days 2–9 open the day before their delivery day; Day 1 opens early.
    orderFrom: day === 1 ? DAY_1_ORDERS_OPEN : undefined,
    visibleUntil: THALIS_SHOWN_UNTIL,
    images: THALI_PHOTOS[day] ? [THALI_PHOTOS[day]] : undefined,
    veg: true,
    emoji: "🍱"
  };
}

const NAVRATRI_THALIS = [
  navratriThali(1, "Navratri Thali · Day 1", [
    "Akhrot Arbi Tikki – 2",
    "Aloo Anar Chaat",
    "Paneer Mircha Sabji",
    "Dahi Wali Arbi",
    "Kuttu Puri – 5",
    "Makhana Kheer",
    "Sabudana Papad – 1",
    "Green Chutney + Mukhwas"
  ]),
  navratriThali(2, "Navratri Thali · Day 2", [
    "Kaccha Kela Tikki – 2",
    "Shakarkandi Chaat",
    "Angoor Makhana Sabji",
    "Aloo Tamatar Sabji",
    "Kuttu Paratha – 3",
    "Aloo Halwa",
    "Sabudana Papad – 1",
    "Green Chutney + Mukhwas"
  ]),
  navratriThali(3, "Navratri Thali · Day 3", [
    "Sabudana Tikki – 2",
    "Fruit & Anar Chaat",
    "Kele Kofta Curry",
    "Paneer Makhana Sabji",
    "Kuttu Puri – 5",
    "Nariyal Laddu – 1",
    "Sabudana Papad – 1",
    "Green Chutney + Mukhwas"
  ]),
  navratriThali(4, "Navratri Thali · Day 4", [
    "Kacche Kele Badam Tikki – 2",
    "Aloo Anar Raita",
    "Sukhi Arbi",
    "Dahi Wale Aloo",
    "Kuttu Paratha – 3",
    "Sabudana Kheer",
    "Sabudana Papad – 1",
    "Green Chutney + Mukhwas"
  ]),
  navratriThali(5, "Navratri Thali · Day 5", [
    "Arbi Walnut Tikki – 2",
    "Shakarkandi Chaat",
    "Paneer Mircha Sabji",
    "Vrat Wale Aloo Tamatar",
    "Kuttu Puri – 5",
    "Aloo Ka Halwa",
    "Sabudana Papad – 1",
    "Green Chutney + Mukhwas"
  ]),
  navratriThali(6, "Navratri Thali · Day 6", [
    "Sabudana Khichdi",
    "Fruit Chaat",
    "Dahi Wale Aloo",
    "Hari Chutney Paneer",
    "Kuttu Paratha – 3",
    "Nariyal Laddu – 1",
    "Sabudana Papad – 1",
    "Green Chutney + Mukhwas"
  ]),
  navratriThali(7, "Navratri Thali · Day 7", [
    "Kacche Kele Ka Kofta – 2",
    "Aloo Anar Raita",
    "Makhana Kaju Curry",
    "Sukhi Arbi",
    "Kuttu Puri – 5",
    "Samak Rice Kheer",
    "Sabudana Papad – 1",
    "Green Chutney + Mukhwas"
  ]),
  navratriThali(8, "Navratri Thali · Day 8", [
    "Kaccha Kela Peanut Tikki – 2",
    "Shakarkandi Anar Chaat",
    "Paneer Anardana Sabji",
    "Dahi Wale Aloo",
    "Kuttu Paratha – 3",
    "Nariyal Burfi – 1",
    "Sabudana Papad – 1",
    "Green Chutney + Mukhwas"
  ]),
  navratriThali(9, "Navratri Thali · Day 9 (Navratri Finale) 🌸", [
    "Kala Chana",
    "Jhol Ke Aloo",
    "Poori",
    "Chawal Ki Kheer",
    "Sooji Halwa",
    "Sabudana Papad – 1",
    "Green Chutney + Mukhwas"
  ])
];

export const MENU: Category[] = [
  {
    id: "navratri-thali",
    name: "Navratri Thalis",
    subtitle: "A different thali for each day of Navratri, delivered only on its day · order the day before or on the day",
    items: NAVRATRI_THALIS
  },
  {
    id: "halwa",
    name: "Halwa (Per Kg)",
    items: [
      { id: "besan-halwa", images: ["images/besan-halwa.webp"], name: "Besan Halwa", desc: "Classic besan halwa. Priced per kg.", shelfLife: "5 days", price: 1500, unit: "kg", veg: true, emoji: "🟨", options: [KG_WEIGHT] },
      { id: "moong-dal-halwa", images: ["images/moong-dal-halwa.webp"], name: "Moong Dal Halwa", desc: "Traditional moong dal halwa. Priced per kg.", shelfLife: "5 days", price: 1500, unit: "kg", veg: true, emoji: "🟧", badge: "POPULAR", options: [KG_WEIGHT] },
      { id: "badam-halwa", images: ["images/badam-halwa.webp"], name: "Badam Halwa", desc: "Rich almond halwa. Priced per kg.", shelfLife: "7 days", price: 2500, unit: "kg", veg: true, emoji: "🌰", options: [KG_WEIGHT] },
      { id: "walnut-halwa", images: ["images/walnut-halwa.webp"], name: "Walnut Halwa", desc: "Walnut halwa. Priced per kg.", shelfLife: "7 days", price: 3000, unit: "kg", veg: true, emoji: "🟤", options: [KG_WEIGHT] }
    ]
  },
  {
    id: "halwa-jars",
    name: "Halwa Jars (300 g)",
    subtitle: "Our halwas in a 300 g jar, easy to gift",
    items: [
      { id: "besan-halwa-jar", images: ["images/besan-halwa-jar.webp"], name: "Besan Halwa Jar (300 g)", desc: "Besan halwa in a 300 g jar.", shelfLife: "5 days", price: 425, unit: "jar", veg: true, emoji: "🫙" },
      { id: "moong-dal-halwa-jar", images: ["images/moong-dal-halwa-jar.webp"], name: "Moong Dal Halwa Jar (300 g)", desc: "Moong dal halwa in a 300 g jar.", shelfLife: "5 days", price: 425, unit: "jar", veg: true, emoji: "🫙" },
      { id: "badam-halwa-jar", images: ["images/badam-halwa-jar.webp"], name: "Badam Halwa Jar (300 g)", desc: "Badam halwa in a 300 g jar.", shelfLife: "7 days", price: 675, unit: "jar", veg: true, emoji: "🫙" },
      { id: "walnut-halwa-jar", images: ["images/walnut-halwa-jar.webp"], name: "Walnut Halwa Jar (300 g)", desc: "Walnut halwa in a 300 g jar.", shelfLife: "7 days", price: 800, unit: "jar", veg: true, emoji: "🫙" }
    ]
  },
  {
    id: "laddus",
    name: "Laddus (Per Kg)",
    subtitle: "Boxes of 4, 8, 12 or 24 laddus · a 1 kg box has about 24 laddus",
    items: [
      { id: "besan-laddu", images: ["images/besan-laddu.webp"], name: "Besan Laddu", desc: "Classic besan laddu.", shelfLife: "15 days", price: 1500, unit: "kg", veg: true, emoji: "🟡", badge: "POPULAR", options: [LADDU_BOX] },
      { id: "atta-laddu", images: ["images/atta-laddu.webp"], name: "Atta Laddu", desc: "Whole-wheat atta laddu.", shelfLife: "15 days", price: 1500, unit: "kg", veg: true, emoji: "🟤", options: [LADDU_BOX] },
      { id: "nariyal-laddu", images: ["images/nariyal-laddu.webp"], name: "Nariyal Laddu", desc: "Coconut laddu.", shelfLife: "7 days", price: 1500, unit: "kg", veg: true, emoji: "🥥", options: [LADDU_BOX] },
      { id: "moti-boondi-laddu", images: ["images/moti-boondi-laddu.webp"], name: "Moti Boondi Laddu", desc: "Moti boondi laddu.", shelfLife: "3 days", price: 1500, unit: "kg", veg: true, emoji: "🟠", options: [LADDU_BOX] },
      { id: "assorted-laddu-box", images: ["images/assorted-laddu-box.webp"], name: "Assorted Laddu Box", desc: "A mix of our laddus in one box.", shelfLife: "7 days", price: 1600, unit: "kg", veg: true, emoji: "🎁", options: [LADDU_BOX] },
      { id: "dry-fruit-laddu", images: ["images/dry-fruit-laddu.webp"], name: "Dry Fruit Laddu", desc: "Dry fruit laddu.", shelfLife: "15 days", price: 2500, unit: "kg", veg: true, emoji: "🌰", options: [LADDU_BOX] }
    ]
  },
  {
    id: "burfi",
    name: "Burfi (Per Kg)",
    items: [
      { id: "besan-burfi", images: ["images/besan-burfi.webp"], name: "Besan Burfi", desc: "Besan burfi. Priced per kg.", shelfLife: "7 days", price: 1500, unit: "kg", veg: true, emoji: "🟨", options: [KG_WEIGHT] },
      { id: "moong-dal-burfi", images: ["images/moong-dal-burfi.webp"], name: "Moong Dal Burfi", desc: "Moong dal burfi. Priced per kg.", shelfLife: "7 days", price: 1500, unit: "kg", veg: true, emoji: "🟧", options: [KG_WEIGHT] },
      { id: "kalakand", images: ["images/kalakand.webp"], name: "Kalakand", desc: "Milk-based kalakand. Priced per kg.", shelfLife: "3–4 days", price: 1800, unit: "kg", veg: true, emoji: "⬜", badge: "POPULAR", options: [KG_WEIGHT] },
      { id: "mango-kalakand", name: "Mango Kalakand", desc: "Kalakand with mango. Priced per kg.", price: 2000, unit: "kg", veg: true, emoji: "🥭", badge: "NEW" }
    ]
  },
  {
    id: "combos",
    name: "Combos & Gift Boxes",
    subtitle: "Ready to gift: packed in our festive Marwadi Khana box",
    items: [
      {
        id: "navratri-vrat-combo",
        name: "Navratri Vrat Combo",
        desc: "Singhare ki Barfi 250 g + Rajgira Laddoo 250 g + Vrat Namkeen 250 g + Makhana Kheer 400 ml.",
        price: 749, veg: true, emoji: "🪔", badge: "VRAT FRIENDLY", stock: 9
      },
      {
        id: "kanya-pujan-box",
        name: "Kanya Pujan Prasad Box",
        desc: "Halwa, kala chana and puri prasad for Ashtami and Navami. Choose how many kanyas.",
        price: 899, veg: true, emoji: "🙏", badge: "POPULAR",
        options: [
          { name: "Number of kanyas", required: true, max: 1, choices: [
            { label: "9 kanyas", price: 0 },
            { label: "11 kanyas", price: 200 },
            { label: "21 kanyas", price: 900 }
          ] },
          { name: "Add-ons", required: false, max: 2, choices: [
            { label: "Chunri + bangles set (per kanya)", price: 450 },
            { label: "Return gift pouches", price: 350 }
          ] }
        ]
      },
      {
        id: "marwadi-sampler",
        name: "Marwadi Mithai Sampler",
        desc: "Besan Laddu (box of 8), Moong Dal Halwa jar (300 g) and Kalakand (250 g).",
        price: 1199, veg: true, emoji: "🎁", badge: "POPULAR",
        options: [GIFTING]
      },
      {
        id: "dussehra-hamper",
        name: "Festive Halwa & Laddu Hamper",
        desc: "Badam Halwa jar, Walnut Halwa jar and a box of 12 Dry Fruit Laddus in a gift basket.",
        price: 2499, veg: true, emoji: "🧺", badge: "NEW",
        options: [GIFTING]
      }
    ]
  }
];
