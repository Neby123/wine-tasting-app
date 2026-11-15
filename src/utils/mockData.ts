// Shared data types re-exported from src/types/wine.ts plus Saturday Pinot Grigio test fixture

export type {
  WineSession,
  Wine,
  WineEnrichment,
  WishlistItem,
  PerceivedPriceTier,
  BuyAgainIntent,
  Vote,
  HistoricalTasting,
  TastingDraft,
  ToastMessage
} from '../types/wine';

import type { Wine } from '../types/wine';

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
