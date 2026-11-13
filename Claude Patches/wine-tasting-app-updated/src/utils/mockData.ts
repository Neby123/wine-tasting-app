// Shared data types and Saturday Pinot Grigio preset lineup

export interface WineSession {
  id: string;
  name: string;
  date: string;
  status: 'setup' | 'tasting' | 'completed';
  match_winners: Record<string, string>; // match_id -> winner_label
}

export interface Wine {
  id: string;
  session_id: string;
  submitted_by: string;
  name: string;
  producer?: string;
  vintage?: string;
  price: number;
  varietal?: string;
  region?: string;
  country?: string;
  style?: string; // e.g. 'Red - Full-bodied', 'Rosé', 'Sparkling'
  tasting_notes?: string;
  blind_label?: string; // 'A' through 'H'
  revealed: boolean;
}

// Result returned by the wine enrichment edge function (auto-fill)
export interface WineEnrichment {
  producer?: string;
  varietal?: string;
  region?: string;
  country?: string;
  style?: string;
  estimated_price_usd?: number; // rough guide only — confirm against what you paid
  descriptor?: string;          // one-line style summary
}

// Personal "buy again" wishlist entry
export interface WishlistItem {
  id: string;
  voter_name: string;
  wine_name: string;
  producer?: string;
  vintage?: string;
  varietal?: string;
  region?: string;
  price?: number;
  source_session_id?: string;
  source_history_id?: string;
  note?: string;
  created_at?: string;
}

export interface Vote {
  id: string;
  session_id: string;
  voter_name: string;
  match_id: string; // 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7' (Final)
  wine_1_label: string;
  wine_2_label: string;
  slider_value: number; // 0 to 100 (0 = 100% Wine 1, 100 = 100% Wine 2)
  notes_wine_1?: string;
  notes_wine_2?: string;
  // High-Yield Sensory & Value Metrics (1-3)
  perceived_price_1?: 'cheap' | 'mid' | 'expensive';
  perceived_price_2?: 'cheap' | 'mid' | 'expensive';
  buy_again_1?: 'yes' | 'maybe' | 'no';
  buy_again_2?: 'yes' | 'maybe' | 'no';
  acidity_1?: number; // 1-5 (Soft -> Tart)
  acidity_2?: number;
  body_1?: number;    // 1-5 (Light -> Full)
  body_2?: number;
  sweetness_1?: number; // 1-5 (Bone Dry -> Sweet)
  sweetness_2?: number;
}

export interface HistoricalTasting {
  id: string;
  name: string;
  date: string;
  winnerName: string;
  winnerPrice: number;
  winnerBroughtBy: string;
  winesCount: number;
  groupWinner: string;
  secondPlace: string;
  bestValue: string;
  giantKiller?: string;
  wines: {
    name: string;
    price: number;
    submitted_by: string;
    blind_label?: string;
    score: number; // Appreciation Index (0-100)
    wins: number;
    varietal?: string;
    region?: string;
    country?: string;
    style?: string;
  }[];
  votes?: {
    voter_name: string;
    match_id: string;
    wine_1_label: string;
    wine_2_label: string;
    slider_value: number;
    notes_wine_1?: string;
    notes_wine_2?: string;
    perceived_price_1?: 'cheap' | 'mid' | 'expensive';
    buy_again_1?: 'yes' | 'maybe' | 'no';
    acidity_1?: number;
    body_1?: number;
    sweetness_1?: number;
  }[];
}

// Pre-seeded historical sessions from past events
export const SATURDAY_GRIGIO_LINEUP: Omit<Wine, 'id' | 'session_id' | 'revealed'>[] = [
  {
    submitted_by: 'Ben & Monica',
    name: 'Winking Owl California Pinot Grigio',
    producer: 'Winking Owl (Aldi)',
    vintage: 'NV',
    price: 3.49,
    varietal: 'Pinot Grigio / Colombard',
    region: 'California',
    country: 'USA',
    style: 'White - Crisp',
    tasting_notes: 'Light, crisp California blend of Pinot Grigio and Colombard (11% ABV) with green apple, white peach, and citrus zest.'
  },
  {
    submitted_by: 'Ben & Monica',
    name: 'Kirkland Signature Friuli Grave Pinot Grigio',
    producer: 'Kirkland Signature',
    vintage: '2025',
    price: 5.99,
    varietal: 'Pinot Grigio',
    region: 'Friuli Grave DOC',
    country: 'Italy',
    style: 'White - Crisp',
    tasting_notes: 'Northern Italian Friuli Grave D.O.C. Pinot Grigio; crisp pear, lemon blossom, and clean alluvial minerality.'
  },
  {
    submitted_by: 'Ben & Monica',
    name: 'Specially Selected Alto Adige Pinot Grigio',
    producer: 'Specially Selected (Aldi)',
    vintage: '2024',
    price: 8.99,
    varietal: 'Pinot Grigio',
    region: 'Alto Adige DOC',
    country: 'Italy',
    style: 'White - Crisp',
    tasting_notes: 'Alpine Northern Italian Alto Adige D.O.C. Pinot Grigio; vibrant acidity, Bartlett pear, white stone fruit, and flinty finish.'
  },
  {
    submitted_by: 'Ben & Monica',
    name: 'Salt Wine Company Pinot Gris',
    producer: 'Salt Wine Company',
    vintage: '2023',
    price: 19.99,
    varietal: 'Pinot Gris',
    region: 'Willamette Valley, Oregon',
    country: 'USA',
    style: 'White - Crisp',
    tasting_notes: 'Willamette Valley Oregon Pinot Gris with bright orchard fruit, Meyer lemon, Asian pear, and a lively, saline-tinged finish.'
  },
  {
    submitted_by: 'Ben & Monica',
    name: 'Scarpetta Friuli Pinot Grigio',
    producer: 'Scarpetta',
    vintage: '2025',
    price: 17.99,
    varietal: 'Pinot Grigio',
    region: 'Friuli DOC',
    country: 'Italy',
    style: 'White - Crisp',
    tasting_notes: 'Friuli D.O.C. Pinot Grigio grown in gravel and marl soils; white peach, crushed gravel, melon, and bright citrus acidity.'
  },
  {
    submitted_by: 'Ben & Monica',
    name: 'The Eyrie Vineyards Estate Pinot Gris',
    producer: 'The Eyrie Vineyards',
    vintage: '2023',
    price: 32.99,
    varietal: 'Pinot Gris',
    region: 'Dundee Hills, Willamette Valley',
    country: 'USA',
    style: 'White - Rich',
    tasting_notes: "Benchmark Oregon Estate Pinot Gris from America's pioneering Pinot Gris producer; sur-lie aged with baked apple, quince, and savory depth."
  }
];
