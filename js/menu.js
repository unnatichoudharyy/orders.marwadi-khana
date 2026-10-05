// ---------------------------------------------------------------------------
// Menu data — add, remove or edit categories and items here.
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
//   shelfLife optional, e.g. "7 days" — shown on the card and item page
// ---------------------------------------------------------------------------

const WEIGHT = (half, kg) => ({
  name: "Select weight", required: true, max: 1, choices: [
    { label: "250 g", price: 0 },
    { label: "500 g", price: half },
    { label: "1 kg", price: kg }
  ]
});

// Laddus are priced per kg; a 1 kg box holds about 24, so each box is priced
// by its share of a kg (box of 4 = 4/24 of the per-kg price).
// Halwa and burfi are priced per kg; 500 g is half the per-kg price.
const KG_WEIGHT = {
  name: "Select weight", required: true, max: 1, choices: [
    { label: "500 g", factor: 0.5 },
    { label: "1 kg", factor: 1 }
  ]
};

const LADDU_BOX = {
  name: "Select box", required: true, max: 1, choices: [
    { label: "Box of 4 laddus (≈ 170 g)", factor: 4 / 24 },
    { label: "Box of 8 laddus (≈ 330 g)", factor: 8 / 24 },
    { label: "Box of 12 laddus (≈ 500 g)", factor: 12 / 24 },
    { label: "Box of 24 laddus (≈ 1 kg)", factor: 1 }
  ]
};

const GIFTING = {
  name: "Add-ons", required: false, max: 3, choices: [
    { label: "Festive gift wrap", price: 50 },
    { label: "Greeting card with your message", price: 30 },
    { label: "Silver-foil (varq) finish", price: 60 }
  ]
};

window.MENU = [
  {
    id: "navratri",
    name: "Navratri Specials",
    subtitle: "Vrat-friendly · no grains, onion or garlic · made with sendha namak",
    items: [
      {
        id: "singhara-barfi",
        name: "Singhare ki Barfi",
        desc: "Water-chestnut flour slow-roasted in desi ghee with khoya and cardamom. Perfect for the vrat.",
        price: 220, veg: true, emoji: "🟫", badge: "VRAT FRIENDLY", stock: 8,
        options: [WEIGHT(200, 600)]
      },
      {
        id: "rajgira-laddoo",
        name: "Rajgira Laddoo",
        desc: "Puffed amaranth bound with jaggery and ghee. Light, crunchy and vrat-safe.",
        price: 180, veg: true, emoji: "🟡", badge: "VRAT FRIENDLY",
        options: [WEIGHT(160, 500)]
      },
      {
        id: "makhana-kheer",
        name: "Kesar Makhana Kheer",
        desc: "Roasted fox nuts simmered in full-cream milk with saffron and dry fruits. 400 ml tub.",
        price: 249, veg: true, emoji: "🥣", badge: "POPULAR"
      },
      {
        id: "sabudana-vada",
        name: "Sabudana Vada (6 pcs)",
        desc: "Crisp sago and potato vadas with peanuts, served with vrat-wali hari chutney.",
        price: 199, veg: true, emoji: "🧆"
      },
      {
        id: "kuttu-pakode",
        name: "Kuttu Aloo Pakode",
        desc: "Buckwheat-batter potato fritters fried in groundnut oil. 250 g.",
        price: 169, veg: true, emoji: "🥔"
      },
      {
        id: "vrat-namkeen",
        name: "Vrat Aloo Lachha Namkeen",
        desc: "Crunchy potato sticks with peanuts, kishmish and sendha namak.",
        price: 149, veg: true, emoji: "🥜",
        options: [WEIGHT(130, 400)]
      },
      {
        id: "lauki-halwa",
        name: "Lauki ka Halwa",
        desc: "Bottle gourd cooked in milk and ghee, topped with pista. 500 g box.",
        price: 299, veg: true, emoji: "🟢", stock: 5
      }
    ]
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
