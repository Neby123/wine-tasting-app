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
  style?: string;
  tasting_notes?: string;
  blind_label?: string; // 'A' through 'H'
  revealed: boolean;
}

export interface WineEnrichment {
  producer?: string;
  varietal?: string;
  region?: string;
  country?: string;
  style?: string;
  estimated_price_usd?: number;
  descriptor?: string;
}

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

export type PerceivedPriceTier = 'cheap' | 'mid' | 'expensive';
export type BuyAgainIntent = 'yes' | 'maybe' | 'no';

export interface Vote {
  id: string;
  session_id: string;
  voter_name: string;
  match_id: string;
  wine_1_label: string;
  wine_2_label: string;
  slider_value: number;
  notes_wine_1?: string;
  notes_wine_2?: string;
  perceived_price_1?: PerceivedPriceTier;
  perceived_price_2?: PerceivedPriceTier;
  buy_again_1?: BuyAgainIntent;
  buy_again_2?: BuyAgainIntent;
  acidity_1?: number;
  acidity_2?: number;
  body_1?: number;
  body_2?: number;
  sweetness_1?: number;
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
    score: number;
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
    perceived_price_1?: PerceivedPriceTier;
    buy_again_1?: BuyAgainIntent;
    acidity_1?: number;
    body_1?: number;
    sweetness_1?: number;
  }[];
}

export interface TastingDraft {
  score: number;
  notes?: string;
  perceivedPrice?: PerceivedPriceTier;
  buyAgain?: BuyAgainIntent;
  acidity?: number;
  body?: number;
  sweetness?: number;
  updatedAt: number;
}

export interface ToastMessage {
  id: string;
  message: string;
  tone: 'success' | 'error' | 'info';
}
