export type RideHailTier = {
  id: string;
  label: string;
  /** Typical earnings vs base ride-hail pool for this city (client-side estimate). */
  earningsMultiplier: number;
  /** Rough share of drivers on this service vs the whole brand pool (lower ⇒ less tier-internal competition). */
  driverShareEstimate: number;
};

/** Ride-hail brands only (not Uber Eats). Keys must match `selectedPlatforms` labels. */
export const RIDE_HAIL_TIER_CONFIG: Record<string, RideHailTier[]> = {
  "Uber Driver (Rides)": [
    { id: "uber_x", label: "Uber X", earningsMultiplier: 1, driverShareEstimate: 0.72 },
    { id: "uber_xl", label: "Uber XL", earningsMultiplier: 1.12, driverShareEstimate: 0.14 },
    { id: "uber_comfort", label: "Comfort", earningsMultiplier: 1.08, driverShareEstimate: 0.18 },
    { id: "uber_black", label: "Uber Black", earningsMultiplier: 1.48, driverShareEstimate: 0.06 },
  ],
  InDrive: [
    { id: "indrive_city", label: "City rides", earningsMultiplier: 1, driverShareEstimate: 0.8 },
    { id: "indrive_plus", label: "Higher fare routes", earningsMultiplier: 1.12, driverShareEstimate: 0.2 },
  ],
  DiDi: [
    { id: "didi_standard", label: "Standard", earningsMultiplier: 1, driverShareEstimate: 0.82 },
    { id: "didi_priority", label: "Priority", earningsMultiplier: 1.1, driverShareEstimate: 0.18 },
  ],
  "Grab (Food/Rides)": [
    { id: "grab_standard", label: "Standard", earningsMultiplier: 1, driverShareEstimate: 0.8 },
    { id: "grab_plus", label: "Plus", earningsMultiplier: 1.08, driverShareEstimate: 0.2 },
  ],
  "Bolt (Delivery)": [
    { id: "bolt", label: "Bolt", earningsMultiplier: 1, driverShareEstimate: 0.78 },
    { id: "bolt_green", label: "Green", earningsMultiplier: 1.04, driverShareEstimate: 0.15 },
    { id: "bolt_business", label: "Business", earningsMultiplier: 1.32, driverShareEstimate: 0.05 },
  ],
};

export const getRideHailTiers = (platform: string): RideHailTier[] =>
  RIDE_HAIL_TIER_CONFIG[platform] ?? [];

export const isRideHailPlatform = (platform: string): boolean =>
  Boolean(RIDE_HAIL_TIER_CONFIG[platform]);

export type MarketConfig = {
  code: string;
  country: string;
  city: string;
  currency: string;
  locale: string;
  defaultCenter: { lat: number; lng: number };
  primaryPlatforms: string[];
  allPlatforms: string[];
  platformLinks: Record<string, string>;
  defaultSuburbs: string[];
};

export const GLOBAL_DELIVERY_PLATFORMS = [
  "Mr D",
  "Uber Eats",
  "Bolt (Delivery)",
  "Uber Driver (Rides)",
  "DoorDash",
  "Grubhub",
  "InDrive",
  "DiDi",
  "Grab (Food/Rides)",
  "Rappi",
  "Talabat",
  "Other local apps",
];

export const MARKETS: Record<string, MarketConfig> = {
  ZA: {
    code: "ZA",
    country: "South Africa 🇿🇦",
    city: "Johannesburg",
    currency: "ZAR",
    locale: "en-ZA",
    defaultCenter: { lat: -26.2041, lng: 28.0473 },
    primaryPlatforms: ["Mr D", "Uber Eats", "Bolt (Delivery)"],
    allPlatforms: GLOBAL_DELIVERY_PLATFORMS,
    platformLinks: {
      "Mr D": "https://www.mrdfood.com",
      "Uber Eats": "https://www.uber.com/deliver/",
      "Bolt (Delivery)": "https://bolt.eu/food/",
      "Uber Driver (Rides)": "https://www.uber.com/za/en/drive/",
      DoorDash: "https://www.doordash.com/dasher/",
      Grubhub: "https://driver.grubhub.com/",
      InDrive: "https://indrive.com/",
      DiDi: "https://www.didiglobal.com/",
      "Grab (Food/Rides)": "https://www.grab.com/",
      Rappi: "https://www.rappi.com/",
      Talabat: "https://www.talabat.com/",
      "Other local apps": "https://www.google.com",
    },
    defaultSuburbs: ["Sandton", "Rosebank", "Midrand", "Fourways", "Randburg", "Soweto", "Bedfordview", "Johannesburg CBD"],
  },
  ZA_CPT: {
    code: "ZA_CPT",
    country: "South Africa 🇿🇦",
    city: "Cape Town",
    currency: "ZAR",
    locale: "en-ZA",
    defaultCenter: { lat: -33.9249, lng: 18.4241 },
    primaryPlatforms: ["Mr D", "Uber Eats", "Bolt (Delivery)"],
    allPlatforms: GLOBAL_DELIVERY_PLATFORMS,
    platformLinks: {
      "Mr D": "https://www.mrdfood.com",
      "Uber Eats": "https://www.uber.com/za/en/eats/",
      "Bolt (Delivery)": "https://bolt.eu/food/",
      "Uber Driver (Rides)": "https://www.uber.com/za/en/drive/",
      "InDrive": "https://indrive.com/",
      "Other local apps": "https://www.google.com",
    },
    defaultSuburbs: ["Cape Town CBD", "Waterfront", "Sea Point", "Claremont", "Bellville", "Brackenfell"],
  },
  ZA_DBN: {
    code: "ZA_DBN",
    country: "South Africa 🇿🇦",
    city: "Durban",
    currency: "ZAR",
    locale: "en-ZA",
    defaultCenter: { lat: -29.8579, lng: 31.0292 },
    primaryPlatforms: ["Mr D", "Uber Eats", "Bolt (Delivery)"],
    allPlatforms: GLOBAL_DELIVERY_PLATFORMS,
    platformLinks: {
      "Mr D": "https://www.mrdfood.com",
      "Uber Eats": "https://www.uber.com/za/en/eats/",
      "Bolt (Delivery)": "https://bolt.eu/food/",
      "Uber Driver (Rides)": "https://www.uber.com/za/en/drive/",
      "InDrive": "https://indrive.com/",
      "Other local apps": "https://www.google.com",
    },
    defaultSuburbs: ["Durban CBD", "Umhlanga", "Westville", "Pinetown", "Morningside"],
  },
  ZA_PTA: {
    code: "ZA_PTA",
    country: "South Africa 🇿🇦",
    city: "Pretoria",
    currency: "ZAR",
    locale: "en-ZA",
    defaultCenter: { lat: -25.7479, lng: 28.2293 },
    primaryPlatforms: ["Mr D", "Uber Eats", "Bolt (Delivery)"],
    allPlatforms: GLOBAL_DELIVERY_PLATFORMS,
    platformLinks: {
      "Mr D": "https://www.mrdfood.com",
      "Uber Eats": "https://www.uber.com/za/en/eats/",
      "Bolt (Delivery)": "https://bolt.eu/food/",
      "Uber Driver (Rides)": "https://www.uber.com/za/en/drive/",
      "InDrive": "https://indrive.com/",
      "Other local apps": "https://www.google.com",
    },
    defaultSuburbs: ["Pretoria CBD", "Hatfield", "Menlyn", "Centurion", "Brooklyn", "Arcadia"],
  },
  NG: {
    code: "NG",
    country: "Nigeria 🇳🇬",
    city: "Lagos",
    currency: "NGN",
    locale: "en-NG",
    defaultCenter: { lat: 6.5244, lng: 3.3792 },
    primaryPlatforms: ["Bolt (Delivery)", "Glovo", "Chowdeck"],
    allPlatforms: ["Bolt (Delivery)", "Glovo", "Chowdeck", "Uber Eats", "DoorDash", "Other local apps"],
    platformLinks: {
      "Bolt (Delivery)": "https://bolt.eu/food/",
      "Glovo": "https://glovoapp.com/ng/en/lagos/",
      "Chowdeck": "https://chowdeck.com/",
      "Uber Eats": "https://www.uber.com/ng/en/eats/",
      "DoorDash": "https://www.doordash.com/dasher/",
      "Other local apps": "https://www.google.com",
    },
    defaultSuburbs: ["Victoria Island", "Lekki", "Ikeja", "Surulere", "Yaba"],
  },
  KE: {
    code: "KE",
    country: "Kenya 🇰🇪",
    city: "Nairobi",
    currency: "KES",
    locale: "en-KE",
    defaultCenter: { lat: -1.2921, lng: 36.8219 },
    primaryPlatforms: ["Glovo", "Bolt (Delivery)", "Uber Eats"],
    allPlatforms: ["Glovo", "Bolt (Delivery)", "Uber Eats", "Other local apps"],
    platformLinks: {
      "Glovo": "https://glovoapp.com/ke/en/nairobi/",
      "Bolt (Delivery)": "https://bolt.eu/food/",
      "Uber Eats": "https://www.uber.com/ke/en/eats/",
      "Other local apps": "https://www.google.com",
    },
    defaultSuburbs: ["Westlands", "CBD Nairobi", "Kilimani", "Karen", "Parklands"],
  },
  GH: {
    code: "GH",
    country: "Ghana 🇬🇭",
    city: "Accra",
    currency: "GHS",
    locale: "en-GH",
    defaultCenter: { lat: 5.5502, lng: -0.2174 },
    primaryPlatforms: ["Glovo", "Bolt (Delivery)"],
    allPlatforms: ["Glovo", "Bolt (Delivery)", "Uber Eats", "Other local apps"],
    platformLinks: {
      "Glovo": "https://glovoapp.com/gh/en/accra/",
      "Bolt (Delivery)": "https://bolt.eu/food/",
      "Uber Eats": "https://www.uber.com/gh/en/eats/",
      "Other local apps": "https://www.google.com",
    },
    defaultSuburbs: ["Accra CBD", "East Legon", "Osu", "Airport Hills", "Tema"],
  },
  US: {
    code: "US",
    country: "United States 🇺🇸",
    city: "New York",
    currency: "USD",
    locale: "en-US",
    defaultCenter: { lat: 40.7128, lng: -74.006 },
    primaryPlatforms: ["DoorDash", "Uber Eats", "Uber Driver (Rides)"],
    allPlatforms: GLOBAL_DELIVERY_PLATFORMS,
    platformLinks: {
      DoorDash: "https://www.doordash.com/dasher/",
      "Uber Eats": "https://www.uber.com/deliver/",
      "Uber Driver (Rides)": "https://www.uber.com/us/en/drive/",
      Grubhub: "https://driver.grubhub.com/",
      InDrive: "https://indrive.com/",
      DiDi: "https://www.didiglobal.com/",
      "Grab (Food/Rides)": "https://www.grab.com/",
      Rappi: "https://www.rappi.com/",
      Talabat: "https://www.talabat.com/",
      "Other local apps": "https://www.google.com",
    },
    defaultSuburbs: ["Manhattan", "Brooklyn", "Queens"],
  },
  UK: {
    code: "UK",
    country: "United Kingdom 🇬🇧",
    city: "London",
    currency: "GBP",
    locale: "en-GB",
    defaultCenter: { lat: 51.5074, lng: -0.1278 },
    primaryPlatforms: ["Uber Eats", "Uber Driver (Rides)", "Bolt (Delivery)"],
    allPlatforms: GLOBAL_DELIVERY_PLATFORMS,
    platformLinks: {
      "Uber Eats": "https://www.uber.com/gb/en/eats/",
      "Uber Driver (Rides)": "https://www.uber.com/gb/en/drive/",
      "Bolt (Delivery)": "https://bolt.eu/food/",
      DoorDash: "https://www.doordash.com/dasher/",
      Grubhub: "https://driver.grubhub.com/",
      InDrive: "https://indrive.com/",
      DiDi: "https://www.didiglobal.com/",
      "Grab (Food/Rides)": "https://www.grab.com/",
      Rappi: "https://www.rappi.com/",
      Talabat: "https://www.talabat.com/",
      "Other local apps": "https://www.google.com",
    },
    defaultSuburbs: ["Central", "Canary Wharf", "Shoreditch"],
  },
};

export const DEFAULT_MARKET_CODE = "ZA";
/** Stable order for region pickers. */
export const MARKET_CODES = ["ZA", "ZA_CPT", "ZA_DBN", "ZA_PTA", "NG", "KE", "GH", "US", "UK"] as const satisfies readonly (keyof typeof MARKETS)[];
export const getMarketConfig = (code?: string) =>
  MARKETS[code ?? DEFAULT_MARKET_CODE] ?? MARKETS[DEFAULT_MARKET_CODE];

export const formatMoney = (amount: number, marketCode?: string) => {
  const market = getMarketConfig(marketCode);
  return new Intl.NumberFormat(market.locale, {
    style: "currency",
    currency: market.currency,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const getPlatformLink = (platform: string, marketCode?: string) => {
  const market = getMarketConfig(marketCode);
  const direct = market.platformLinks[platform];
  if (direct) return direct;
  return `https://www.google.com/search?q=${encodeURIComponent(`${platform} driver app`)}`;
};
