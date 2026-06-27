// Mock Data and LocalStorage DB implementation

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
  tasting_notes?: string;
  blind_label?: string; // 'A' through 'H'
  revealed: boolean;
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
  }[];
  votes?: {
    voter_name: string;
    match_id: string;
    wine_1_label: string;
    wine_2_label: string;
    slider_value: number;
    notes_wine_1?: string;
    notes_wine_2?: string;
  }[];
}

// Pre-seeded historical sessions from past events
export const HISTORICAL_SESSIONS: HistoricalTasting[] = [
{
  "id": "hist-chard-show",
  "name": "The Chard Show",
  "date": "2025-08-02",
  "winnerName": "California Heritage (Aldi)",
  "winnerPrice": 4.99,
  "winnerBroughtBy": "Guest",
  "winesCount": 8,
  "groupWinner": "California Heritage (Aldi) ($4.99)",
  "secondPlace": "La Belle Angele (Total Wine)",
  "bestValue": "California Heritage (Aldi) ($4.99)",
  "giantKiller": "California Heritage (Aldi) (E, $4.99) beat 2019 Hyde (Auteur) (G, $55.00)",
  "wines": [
    {
      "name": "California Heritage (Aldi)",
      "price": 4.99,
      "submitted_by": "Guest",
      "blind_label": "E",
      "score": 76,
      "wins": 11
    },
    {
      "name": "La Belle Angele (Total Wine)",
      "price": 11.99,
      "submitted_by": "Guest",
      "blind_label": "A",
      "score": 64,
      "wins": 6
    },
    {
      "name": "2019 Hyde (Auteur)",
      "price": 55,
      "submitted_by": "Guest",
      "blind_label": "G",
      "score": 62,
      "wins": 5
    },
    {
      "name": "Toad Hollow 2022 (Total Wine)",
      "price": 12,
      "submitted_by": "Guest",
      "blind_label": "D",
      "score": 62,
      "wins": 5
    },
    {
      "name": "Peaks & Tides (Aldi)",
      "price": 9.99,
      "submitted_by": "Guest",
      "blind_label": "C",
      "score": 62,
      "wins": 5
    },
    {
      "name": "Kirkland Signature Sonoma County (Costco)",
      "price": 7,
      "submitted_by": "Guest",
      "blind_label": "F",
      "score": 60,
      "wins": 4
    },
    {
      "name": "Josh Cellars (Total Wine)",
      "price": 10,
      "submitted_by": "Guest",
      "blind_label": "B",
      "score": 60,
      "wins": 4
    },
    {
      "name": "Butter (Costco)",
      "price": 12.89,
      "submitted_by": "Guest",
      "blind_label": "H",
      "score": 55,
      "wins": 2
    }
  ],
  "votes": [
    {
      "voter_name": "Monica",
      "match_id": "Q1",
      "wine_1_label": "A",
      "wine_2_label": "H",
      "slider_value": 0
    },
    {
      "voter_name": "Monica",
      "match_id": "Q2",
      "wine_1_label": "B",
      "wine_2_label": "G",
      "slider_value": 0
    },
    {
      "voter_name": "Monica",
      "match_id": "Q3",
      "wine_1_label": "D",
      "wine_2_label": "E",
      "slider_value": 0
    },
    {
      "voter_name": "Monica",
      "match_id": "Q4",
      "wine_1_label": "C",
      "wine_2_label": "F",
      "slider_value": 100
    },
    {
      "voter_name": "Monica",
      "match_id": "S1",
      "wine_1_label": "A",
      "wine_2_label": "D",
      "slider_value": 100
    },
    {
      "voter_name": "Monica",
      "match_id": "S2",
      "wine_1_label": "B",
      "wine_2_label": "F",
      "slider_value": 100
    },
    {
      "voter_name": "Monica",
      "match_id": "F",
      "wine_1_label": "D",
      "wine_2_label": "F",
      "slider_value": 100
    },
    {
      "voter_name": "Ben",
      "match_id": "Q1",
      "wine_1_label": "A",
      "wine_2_label": "H",
      "slider_value": 0
    },
    {
      "voter_name": "Ben",
      "match_id": "Q2",
      "wine_1_label": "B",
      "wine_2_label": "G",
      "slider_value": 0
    },
    {
      "voter_name": "Ben",
      "match_id": "Q3",
      "wine_1_label": "D",
      "wine_2_label": "E",
      "slider_value": 100
    },
    {
      "voter_name": "Ben",
      "match_id": "Q4",
      "wine_1_label": "C",
      "wine_2_label": "F",
      "slider_value": 100
    },
    {
      "voter_name": "Ben",
      "match_id": "S1",
      "wine_1_label": "A",
      "wine_2_label": "E",
      "slider_value": 100
    },
    {
      "voter_name": "Ben",
      "match_id": "S2",
      "wine_1_label": "B",
      "wine_2_label": "F",
      "slider_value": 100
    },
    {
      "voter_name": "Ben",
      "match_id": "F",
      "wine_1_label": "E",
      "wine_2_label": "F",
      "slider_value": 0
    },
    {
      "voter_name": "Jack",
      "match_id": "Q1",
      "wine_1_label": "A",
      "wine_2_label": "H",
      "slider_value": 100
    },
    {
      "voter_name": "Jack",
      "match_id": "Q2",
      "wine_1_label": "B",
      "wine_2_label": "G",
      "slider_value": 100
    },
    {
      "voter_name": "Jack",
      "match_id": "Q3",
      "wine_1_label": "D",
      "wine_2_label": "E",
      "slider_value": 0
    },
    {
      "voter_name": "Jack",
      "match_id": "Q4",
      "wine_1_label": "C",
      "wine_2_label": "F",
      "slider_value": 0
    },
    {
      "voter_name": "Jack",
      "match_id": "S1",
      "wine_1_label": "H",
      "wine_2_label": "D",
      "slider_value": 100
    },
    {
      "voter_name": "Jack",
      "match_id": "S2",
      "wine_1_label": "G",
      "wine_2_label": "C",
      "slider_value": 0
    },
    {
      "voter_name": "Jack",
      "match_id": "F",
      "wine_1_label": "D",
      "wine_2_label": "G",
      "slider_value": 0
    },
    {
      "voter_name": "Abby",
      "match_id": "Q1",
      "wine_1_label": "A",
      "wine_2_label": "H",
      "slider_value": 0
    },
    {
      "voter_name": "Abby",
      "match_id": "Q2",
      "wine_1_label": "B",
      "wine_2_label": "G",
      "slider_value": 0
    },
    {
      "voter_name": "Abby",
      "match_id": "Q3",
      "wine_1_label": "D",
      "wine_2_label": "E",
      "slider_value": 100
    },
    {
      "voter_name": "Abby",
      "match_id": "Q4",
      "wine_1_label": "C",
      "wine_2_label": "F",
      "slider_value": 0
    },
    {
      "voter_name": "Abby",
      "match_id": "S1",
      "wine_1_label": "A",
      "wine_2_label": "E",
      "slider_value": 100
    },
    {
      "voter_name": "Abby",
      "match_id": "S2",
      "wine_1_label": "B",
      "wine_2_label": "C",
      "slider_value": 0
    },
    {
      "voter_name": "Abby",
      "match_id": "F",
      "wine_1_label": "E",
      "wine_2_label": "B",
      "slider_value": 0
    },
    {
      "voter_name": "Alexcia",
      "match_id": "Q1",
      "wine_1_label": "A",
      "wine_2_label": "H",
      "slider_value": 100
    },
    {
      "voter_name": "Alexcia",
      "match_id": "Q2",
      "wine_1_label": "B",
      "wine_2_label": "G",
      "slider_value": 100
    },
    {
      "voter_name": "Alexcia",
      "match_id": "Q3",
      "wine_1_label": "D",
      "wine_2_label": "E",
      "slider_value": 100
    },
    {
      "voter_name": "Alexcia",
      "match_id": "Q4",
      "wine_1_label": "C",
      "wine_2_label": "F",
      "slider_value": 0
    },
    {
      "voter_name": "Alexcia",
      "match_id": "S1",
      "wine_1_label": "H",
      "wine_2_label": "E",
      "slider_value": 100
    },
    {
      "voter_name": "Alexcia",
      "match_id": "S2",
      "wine_1_label": "G",
      "wine_2_label": "C",
      "slider_value": 100
    },
    {
      "voter_name": "Alexcia",
      "match_id": "F",
      "wine_1_label": "E",
      "wine_2_label": "C",
      "slider_value": 0
    },
    {
      "voter_name": "David",
      "match_id": "Q1",
      "wine_1_label": "A",
      "wine_2_label": "H",
      "slider_value": 0
    },
    {
      "voter_name": "David",
      "match_id": "Q2",
      "wine_1_label": "B",
      "wine_2_label": "G",
      "slider_value": 100
    },
    {
      "voter_name": "David",
      "match_id": "Q3",
      "wine_1_label": "D",
      "wine_2_label": "E",
      "slider_value": 100
    },
    {
      "voter_name": "David",
      "match_id": "Q4",
      "wine_1_label": "C",
      "wine_2_label": "F",
      "slider_value": 0
    },
    {
      "voter_name": "David",
      "match_id": "S1",
      "wine_1_label": "A",
      "wine_2_label": "E",
      "slider_value": 0
    },
    {
      "voter_name": "David",
      "match_id": "S2",
      "wine_1_label": "G",
      "wine_2_label": "C",
      "slider_value": 0
    },
    {
      "voter_name": "David",
      "match_id": "F",
      "wine_1_label": "A",
      "wine_2_label": "G",
      "slider_value": 0
    }
  ]
},
{
  "id": "hist-pinot-show",
  "name": "The Pinot Show",
  "date": "2025-09-20",
  "winnerName": "Buena Vista Bela's Selection 2021",
  "winnerPrice": 58,
  "winnerBroughtBy": "Guest",
  "winesCount": 8,
  "groupWinner": "Buena Vista Bela's Selection 2021 ($58.00)",
  "secondPlace": "Firesteed Oregon 2022",
  "bestValue": "Firesteed Oregon 2022 ($14.99)",
  "giantKiller": "Firesteed Oregon 2022 (H, $14.99) beat 2023 Illahe Pinot Noir (F, $30.00)",
  "wines": [
    {
      "name": "Buena Vista Bela's Selection 2021",
      "price": 58,
      "submitted_by": "Guest",
      "blind_label": "G",
      "score": 92,
      "wins": 15
    },
    {
      "name": "Firesteed Oregon 2022",
      "price": 14.99,
      "submitted_by": "Guest",
      "blind_label": "H",
      "score": 78,
      "wins": 10
    },
    {
      "name": "Salem Eola-Amity Hills 2023",
      "price": 26,
      "submitted_by": "Guest",
      "blind_label": "D",
      "score": 72,
      "wins": 8
    },
    {
      "name": "Banshee (Costco) ",
      "price": 15.99,
      "submitted_by": "Guest",
      "blind_label": "C",
      "score": 64,
      "wins": 5
    },
    {
      "name": "Maison André Giochot Hautes-Côtes De Nuits",
      "price": 18.99,
      "submitted_by": "Guest",
      "blind_label": "B",
      "score": 58,
      "wins": 3
    },
    {
      "name": "2023 Illahe Pinot Noir Willamette Valley",
      "price": 30,
      "submitted_by": "Guest",
      "blind_label": "F",
      "score": 53,
      "wins": 1
    },
    {
      "name": "Don't Mind If I Do (Aldi)",
      "price": 7.99,
      "submitted_by": "Guest",
      "blind_label": "A",
      "score": 50,
      "wins": 0
    },
    {
      "name": "California Heritage (Aldi)",
      "price": 4.99,
      "submitted_by": "Guest",
      "blind_label": "E",
      "score": 50,
      "wins": 0
    }
  ],
  "votes": [
    {
      "voter_name": "Monica",
      "match_id": "Q1",
      "wine_1_label": "A",
      "wine_2_label": "H",
      "slider_value": 100
    },
    {
      "voter_name": "Monica",
      "match_id": "Q2",
      "wine_1_label": "B",
      "wine_2_label": "G",
      "slider_value": 100
    },
    {
      "voter_name": "Monica",
      "match_id": "Q3",
      "wine_1_label": "D",
      "wine_2_label": "E",
      "slider_value": 0
    },
    {
      "voter_name": "Monica",
      "match_id": "Q4",
      "wine_1_label": "C",
      "wine_2_label": "F",
      "slider_value": 0
    },
    {
      "voter_name": "Monica",
      "match_id": "S1",
      "wine_1_label": "H",
      "wine_2_label": "D",
      "slider_value": 0
    },
    {
      "voter_name": "Monica",
      "match_id": "S2",
      "wine_1_label": "G",
      "wine_2_label": "C",
      "slider_value": 0
    },
    {
      "voter_name": "Monica",
      "match_id": "F",
      "wine_1_label": "H",
      "wine_2_label": "G",
      "slider_value": 100
    },
    {
      "voter_name": "Ben",
      "match_id": "Q1",
      "wine_1_label": "A",
      "wine_2_label": "H",
      "slider_value": 100
    },
    {
      "voter_name": "Ben",
      "match_id": "Q2",
      "wine_1_label": "B",
      "wine_2_label": "G",
      "slider_value": 100
    },
    {
      "voter_name": "Ben",
      "match_id": "Q3",
      "wine_1_label": "D",
      "wine_2_label": "E",
      "slider_value": 0
    },
    {
      "voter_name": "Ben",
      "match_id": "Q4",
      "wine_1_label": "C",
      "wine_2_label": "F",
      "slider_value": 0
    },
    {
      "voter_name": "Ben",
      "match_id": "S1",
      "wine_1_label": "H",
      "wine_2_label": "D",
      "slider_value": 100
    },
    {
      "voter_name": "Ben",
      "match_id": "S2",
      "wine_1_label": "G",
      "wine_2_label": "C",
      "slider_value": 0
    },
    {
      "voter_name": "Ben",
      "match_id": "F",
      "wine_1_label": "D",
      "wine_2_label": "G",
      "slider_value": 100
    },
    {
      "voter_name": "Abby",
      "match_id": "Q1",
      "wine_1_label": "A",
      "wine_2_label": "H",
      "slider_value": 100
    },
    {
      "voter_name": "Abby",
      "match_id": "Q2",
      "wine_1_label": "B",
      "wine_2_label": "G",
      "slider_value": 100
    },
    {
      "voter_name": "Abby",
      "match_id": "Q3",
      "wine_1_label": "D",
      "wine_2_label": "E",
      "slider_value": 0
    },
    {
      "voter_name": "Abby",
      "match_id": "Q4",
      "wine_1_label": "C",
      "wine_2_label": "F",
      "slider_value": 0
    },
    {
      "voter_name": "Abby",
      "match_id": "S1",
      "wine_1_label": "H",
      "wine_2_label": "D",
      "slider_value": 100
    },
    {
      "voter_name": "Abby",
      "match_id": "S2",
      "wine_1_label": "G",
      "wine_2_label": "C",
      "slider_value": 0
    },
    {
      "voter_name": "Abby",
      "match_id": "F",
      "wine_1_label": "D",
      "wine_2_label": "G",
      "slider_value": 100
    },
    {
      "voter_name": "Jack",
      "match_id": "Q1",
      "wine_1_label": "A",
      "wine_2_label": "H",
      "slider_value": 100
    },
    {
      "voter_name": "Jack",
      "match_id": "Q2",
      "wine_1_label": "B",
      "wine_2_label": "G",
      "slider_value": 100
    },
    {
      "voter_name": "Jack",
      "match_id": "Q3",
      "wine_1_label": "D",
      "wine_2_label": "E",
      "slider_value": 0
    },
    {
      "voter_name": "Jack",
      "match_id": "Q4",
      "wine_1_label": "C",
      "wine_2_label": "F",
      "slider_value": 0
    },
    {
      "voter_name": "Jack",
      "match_id": "S1",
      "wine_1_label": "H",
      "wine_2_label": "D",
      "slider_value": 0
    },
    {
      "voter_name": "Jack",
      "match_id": "S2",
      "wine_1_label": "G",
      "wine_2_label": "C",
      "slider_value": 0
    },
    {
      "voter_name": "Jack",
      "match_id": "F",
      "wine_1_label": "H",
      "wine_2_label": "G",
      "slider_value": 100
    },
    {
      "voter_name": "Alexcia",
      "match_id": "Q1",
      "wine_1_label": "A",
      "wine_2_label": "H",
      "slider_value": 100
    },
    {
      "voter_name": "Alexcia",
      "match_id": "Q2",
      "wine_1_label": "B",
      "wine_2_label": "G",
      "slider_value": 100
    },
    {
      "voter_name": "Alexcia",
      "match_id": "Q3",
      "wine_1_label": "D",
      "wine_2_label": "E",
      "slider_value": 0
    },
    {
      "voter_name": "Alexcia",
      "match_id": "Q4",
      "wine_1_label": "C",
      "wine_2_label": "F",
      "slider_value": 0
    },
    {
      "voter_name": "Alexcia",
      "match_id": "S1",
      "wine_1_label": "H",
      "wine_2_label": "D",
      "slider_value": 0
    },
    {
      "voter_name": "Alexcia",
      "match_id": "S2",
      "wine_1_label": "G",
      "wine_2_label": "C",
      "slider_value": 0
    },
    {
      "voter_name": "Alexcia",
      "match_id": "F",
      "wine_1_label": "H",
      "wine_2_label": "G",
      "slider_value": 100
    },
    {
      "voter_name": "David",
      "match_id": "Q1",
      "wine_1_label": "A",
      "wine_2_label": "H",
      "slider_value": 100
    },
    {
      "voter_name": "David",
      "match_id": "Q2",
      "wine_1_label": "B",
      "wine_2_label": "G",
      "slider_value": 0
    },
    {
      "voter_name": "David",
      "match_id": "Q3",
      "wine_1_label": "D",
      "wine_2_label": "E",
      "slider_value": 0
    },
    {
      "voter_name": "David",
      "match_id": "Q4",
      "wine_1_label": "C",
      "wine_2_label": "F",
      "slider_value": 100
    },
    {
      "voter_name": "David",
      "match_id": "S1",
      "wine_1_label": "H",
      "wine_2_label": "D",
      "slider_value": 0
    },
    {
      "voter_name": "David",
      "match_id": "S2",
      "wine_1_label": "B",
      "wine_2_label": "F",
      "slider_value": 0
    },
    {
      "voter_name": "David",
      "match_id": "F",
      "wine_1_label": "H",
      "wine_2_label": "B",
      "slider_value": 100
    }
  ]
},
{
  "id": "hist-rumble-reds",
  "name": "Rumble di Reds",
  "date": "2025-11-15",
  "winnerName": "Scouts Honor",
  "winnerPrice": 35,
  "winnerBroughtBy": "Guest",
  "winesCount": 8,
  "groupWinner": "Scouts Honor ($35.00)",
  "secondPlace": "Apothic Red",
  "bestValue": "Kirkland Signature Red Wine Blend ($4.00)",
  "giantKiller": "Apothic Red (B, $7.39) beat Menagerie of the Barossa (C, $26.00)",
  "wines": [
    {
      "name": "Scouts Honor",
      "price": 35,
      "submitted_by": "Guest",
      "blind_label": "E",
      "score": 75,
      "wins": 9
    },
    {
      "name": "Apothic Red",
      "price": 7.39,
      "submitted_by": "Guest",
      "blind_label": "B",
      "score": 72,
      "wins": 8
    },
    {
      "name": "Beau Vigne Hero 2022",
      "price": 23.7,
      "submitted_by": "Guest",
      "blind_label": "G",
      "score": 69,
      "wins": 7
    },
    {
      "name": "Intermingle Aldi",
      "price": 7.79,
      "submitted_by": "Guest",
      "blind_label": "A",
      "score": 67,
      "wins": 6
    },
    {
      "name": "Nastergal",
      "price": 29,
      "submitted_by": "Guest",
      "blind_label": "F",
      "score": 64,
      "wins": 5
    },
    {
      "name": "Pillars of Hercules",
      "price": 12.99,
      "submitted_by": "Guest",
      "blind_label": "H",
      "score": 58,
      "wins": 3
    },
    {
      "name": "Kirkland Signature Red Wine Blend",
      "price": 4,
      "submitted_by": "Guest",
      "blind_label": "D",
      "score": 58,
      "wins": 3
    },
    {
      "name": "Menagerie of the Barossa",
      "price": 26,
      "submitted_by": "Guest",
      "blind_label": "C",
      "score": 53,
      "wins": 1
    }
  ],
  "votes": [
    {
      "voter_name": "Monica",
      "match_id": "Q1",
      "wine_1_label": "A",
      "wine_2_label": "H",
      "slider_value": 0
    },
    {
      "voter_name": "Monica",
      "match_id": "Q2",
      "wine_1_label": "B",
      "wine_2_label": "G",
      "slider_value": 0
    },
    {
      "voter_name": "Monica",
      "match_id": "Q3",
      "wine_1_label": "D",
      "wine_2_label": "E",
      "slider_value": 100
    },
    {
      "voter_name": "Monica",
      "match_id": "Q4",
      "wine_1_label": "C",
      "wine_2_label": "F",
      "slider_value": 100
    },
    {
      "voter_name": "Monica",
      "match_id": "S1",
      "wine_1_label": "A",
      "wine_2_label": "E",
      "slider_value": 0
    },
    {
      "voter_name": "Monica",
      "match_id": "S2",
      "wine_1_label": "B",
      "wine_2_label": "F",
      "slider_value": 0
    },
    {
      "voter_name": "Monica",
      "match_id": "F",
      "wine_1_label": "A",
      "wine_2_label": "B",
      "slider_value": 0
    },
    {
      "voter_name": "Ben",
      "match_id": "Q1",
      "wine_1_label": "A",
      "wine_2_label": "H",
      "slider_value": 0
    },
    {
      "voter_name": "Ben",
      "match_id": "Q2",
      "wine_1_label": "B",
      "wine_2_label": "G",
      "slider_value": 0
    },
    {
      "voter_name": "Ben",
      "match_id": "Q3",
      "wine_1_label": "D",
      "wine_2_label": "E",
      "slider_value": 100
    },
    {
      "voter_name": "Ben",
      "match_id": "Q4",
      "wine_1_label": "C",
      "wine_2_label": "F",
      "slider_value": 100
    },
    {
      "voter_name": "Ben",
      "match_id": "S1",
      "wine_1_label": "A",
      "wine_2_label": "E",
      "slider_value": 100
    },
    {
      "voter_name": "Ben",
      "match_id": "S2",
      "wine_1_label": "B",
      "wine_2_label": "F",
      "slider_value": 0
    },
    {
      "voter_name": "Ben",
      "match_id": "F",
      "wine_1_label": "E",
      "wine_2_label": "B",
      "slider_value": 100
    },
    {
      "voter_name": "Abby",
      "match_id": "Q1",
      "wine_1_label": "A",
      "wine_2_label": "H",
      "slider_value": 100
    },
    {
      "voter_name": "Abby",
      "match_id": "Q2",
      "wine_1_label": "B",
      "wine_2_label": "G",
      "slider_value": 100
    },
    {
      "voter_name": "Abby",
      "match_id": "Q3",
      "wine_1_label": "D",
      "wine_2_label": "E",
      "slider_value": 0
    },
    {
      "voter_name": "Abby",
      "match_id": "Q4",
      "wine_1_label": "C",
      "wine_2_label": "F",
      "slider_value": 0
    },
    {
      "voter_name": "Abby",
      "match_id": "S1",
      "wine_1_label": "H",
      "wine_2_label": "D",
      "slider_value": 100
    },
    {
      "voter_name": "Abby",
      "match_id": "S2",
      "wine_1_label": "G",
      "wine_2_label": "C",
      "slider_value": 0
    },
    {
      "voter_name": "Abby",
      "match_id": "F",
      "wine_1_label": "D",
      "wine_2_label": "G",
      "slider_value": 100
    },
    {
      "voter_name": "David",
      "match_id": "Q1",
      "wine_1_label": "A",
      "wine_2_label": "H",
      "slider_value": 100
    },
    {
      "voter_name": "David",
      "match_id": "Q2",
      "wine_1_label": "B",
      "wine_2_label": "G",
      "slider_value": 0
    },
    {
      "voter_name": "David",
      "match_id": "Q3",
      "wine_1_label": "D",
      "wine_2_label": "E",
      "slider_value": 0
    },
    {
      "voter_name": "David",
      "match_id": "Q4",
      "wine_1_label": "C",
      "wine_2_label": "F",
      "slider_value": 100
    },
    {
      "voter_name": "David",
      "match_id": "S1",
      "wine_1_label": "H",
      "wine_2_label": "D",
      "slider_value": 0
    },
    {
      "voter_name": "David",
      "match_id": "S2",
      "wine_1_label": "B",
      "wine_2_label": "F",
      "slider_value": 0
    },
    {
      "voter_name": "David",
      "match_id": "F",
      "wine_1_label": "H",
      "wine_2_label": "B",
      "slider_value": 100
    },
    {
      "voter_name": "Jack",
      "match_id": "Q1",
      "wine_1_label": "A",
      "wine_2_label": "H",
      "slider_value": 0
    },
    {
      "voter_name": "Jack",
      "match_id": "Q2",
      "wine_1_label": "B",
      "wine_2_label": "G",
      "slider_value": 100
    },
    {
      "voter_name": "Jack",
      "match_id": "Q3",
      "wine_1_label": "D",
      "wine_2_label": "E",
      "slider_value": 100
    },
    {
      "voter_name": "Jack",
      "match_id": "Q4",
      "wine_1_label": "C",
      "wine_2_label": "F",
      "slider_value": 100
    },
    {
      "voter_name": "Jack",
      "match_id": "S1",
      "wine_1_label": "A",
      "wine_2_label": "E",
      "slider_value": 100
    },
    {
      "voter_name": "Jack",
      "match_id": "S2",
      "wine_1_label": "G",
      "wine_2_label": "F",
      "slider_value": 0
    },
    {
      "voter_name": "Jack",
      "match_id": "F",
      "wine_1_label": "E",
      "wine_2_label": "G",
      "slider_value": 0
    },
    {
      "voter_name": "Alexcia",
      "match_id": "Q1",
      "wine_1_label": "A",
      "wine_2_label": "H",
      "slider_value": 0
    },
    {
      "voter_name": "Alexcia",
      "match_id": "Q2",
      "wine_1_label": "B",
      "wine_2_label": "G",
      "slider_value": 100
    },
    {
      "voter_name": "Alexcia",
      "match_id": "Q3",
      "wine_1_label": "D",
      "wine_2_label": "E",
      "slider_value": 100
    },
    {
      "voter_name": "Alexcia",
      "match_id": "Q4",
      "wine_1_label": "C",
      "wine_2_label": "F",
      "slider_value": 100
    },
    {
      "voter_name": "Alexcia",
      "match_id": "S1",
      "wine_1_label": "A",
      "wine_2_label": "E",
      "slider_value": 100
    },
    {
      "voter_name": "Alexcia",
      "match_id": "S2",
      "wine_1_label": "G",
      "wine_2_label": "F",
      "slider_value": 0
    },
    {
      "voter_name": "Alexcia",
      "match_id": "F",
      "wine_1_label": "E",
      "wine_2_label": "G",
      "slider_value": 0
    }
  ]
},
{
  "id": "hist-carnival-cabernet",
  "name": "Carnival de Cabernet",
  "date": "2026-03-14",
  "winnerName": "One Stone",
  "winnerPrice": 19.99,
  "winnerBroughtBy": "Guest",
  "winesCount": 8,
  "groupWinner": "One Stone ($19.99)",
  "secondPlace": "Vina Alicia",
  "bestValue": "California Heritage Aldi ($4.99)",
  "giantKiller": "One Stone (A, $19.99) beat Silver Oak (E, $90.00)",
  "wines": [
    {
      "name": "One Stone",
      "price": 19.99,
      "submitted_by": "Guest",
      "blind_label": "A",
      "score": 74,
      "wins": 10
    },
    {
      "name": "Vina Alicia",
      "price": 15.99,
      "submitted_by": "Guest",
      "blind_label": "G",
      "score": 67,
      "wins": 7
    },
    {
      "name": "Intermingle Aldi",
      "price": 6.99,
      "submitted_by": "Guest",
      "blind_label": "F",
      "score": 67,
      "wins": 7
    },
    {
      "name": "California Heritage Aldi",
      "price": 4.99,
      "submitted_by": "Guest",
      "blind_label": "D",
      "score": 64,
      "wins": 6
    },
    {
      "name": "Silver Oak",
      "price": 90,
      "submitted_by": "Guest",
      "blind_label": "E",
      "score": 62,
      "wins": 5
    },
    {
      "name": "Wines of Substance Cab",
      "price": 14.99,
      "submitted_by": "Guest",
      "blind_label": "C",
      "score": 62,
      "wins": 5
    },
    {
      "name": "Knorhoek Cabernet Stellenbosch",
      "price": 26.99,
      "submitted_by": "Guest",
      "blind_label": "B",
      "score": 62,
      "wins": 5
    },
    {
      "name": "Method",
      "price": 9.99,
      "submitted_by": "Guest",
      "blind_label": "H",
      "score": 60,
      "wins": 4
    }
  ],
  "votes": [
    {
      "voter_name": "Monica",
      "match_id": "Q1",
      "wine_1_label": "A",
      "wine_2_label": "H",
      "slider_value": 100
    },
    {
      "voter_name": "Monica",
      "match_id": "Q2",
      "wine_1_label": "B",
      "wine_2_label": "G",
      "slider_value": 100
    },
    {
      "voter_name": "Monica",
      "match_id": "Q3",
      "wine_1_label": "D",
      "wine_2_label": "E",
      "slider_value": 0
    },
    {
      "voter_name": "Monica",
      "match_id": "Q4",
      "wine_1_label": "C",
      "wine_2_label": "F",
      "slider_value": 100
    },
    {
      "voter_name": "Monica",
      "match_id": "S1",
      "wine_1_label": "H",
      "wine_2_label": "D",
      "slider_value": 100
    },
    {
      "voter_name": "Monica",
      "match_id": "S2",
      "wine_1_label": "G",
      "wine_2_label": "F",
      "slider_value": 100
    },
    {
      "voter_name": "Monica",
      "match_id": "F",
      "wine_1_label": "D",
      "wine_2_label": "F",
      "slider_value": 0
    },
    {
      "voter_name": "Ben",
      "match_id": "Q1",
      "wine_1_label": "A",
      "wine_2_label": "H",
      "slider_value": 0
    },
    {
      "voter_name": "Ben",
      "match_id": "Q2",
      "wine_1_label": "B",
      "wine_2_label": "G",
      "slider_value": 0
    },
    {
      "voter_name": "Ben",
      "match_id": "Q3",
      "wine_1_label": "D",
      "wine_2_label": "E",
      "slider_value": 0
    },
    {
      "voter_name": "Ben",
      "match_id": "Q4",
      "wine_1_label": "C",
      "wine_2_label": "F",
      "slider_value": 0
    },
    {
      "voter_name": "Ben",
      "match_id": "S1",
      "wine_1_label": "A",
      "wine_2_label": "D",
      "slider_value": 0
    },
    {
      "voter_name": "Ben",
      "match_id": "S2",
      "wine_1_label": "B",
      "wine_2_label": "C",
      "slider_value": 0
    },
    {
      "voter_name": "Ben",
      "match_id": "F",
      "wine_1_label": "A",
      "wine_2_label": "B",
      "slider_value": 0
    },
    {
      "voter_name": "Ryan Wiesen",
      "match_id": "Q1",
      "wine_1_label": "A",
      "wine_2_label": "H",
      "slider_value": 0
    },
    {
      "voter_name": "Ryan Wiesen",
      "match_id": "Q2",
      "wine_1_label": "B",
      "wine_2_label": "G",
      "slider_value": 0
    },
    {
      "voter_name": "Ryan Wiesen",
      "match_id": "Q3",
      "wine_1_label": "D",
      "wine_2_label": "E",
      "slider_value": 0
    },
    {
      "voter_name": "Ryan Wiesen",
      "match_id": "Q4",
      "wine_1_label": "C",
      "wine_2_label": "F",
      "slider_value": 0
    },
    {
      "voter_name": "Ryan Wiesen",
      "match_id": "S1",
      "wine_1_label": "A",
      "wine_2_label": "D",
      "slider_value": 0
    },
    {
      "voter_name": "Ryan Wiesen",
      "match_id": "S2",
      "wine_1_label": "B",
      "wine_2_label": "C",
      "slider_value": 100
    },
    {
      "voter_name": "Ryan Wiesen",
      "match_id": "F",
      "wine_1_label": "A",
      "wine_2_label": "C",
      "slider_value": 100
    },
    {
      "voter_name": "David",
      "match_id": "Q1",
      "wine_1_label": "A",
      "wine_2_label": "H",
      "slider_value": 100
    },
    {
      "voter_name": "David",
      "match_id": "Q2",
      "wine_1_label": "B",
      "wine_2_label": "G",
      "slider_value": 100
    },
    {
      "voter_name": "David",
      "match_id": "Q3",
      "wine_1_label": "D",
      "wine_2_label": "E",
      "slider_value": 100
    },
    {
      "voter_name": "David",
      "match_id": "Q4",
      "wine_1_label": "C",
      "wine_2_label": "F",
      "slider_value": 100
    },
    {
      "voter_name": "David",
      "match_id": "S1",
      "wine_1_label": "H",
      "wine_2_label": "E",
      "slider_value": 0
    },
    {
      "voter_name": "David",
      "match_id": "S2",
      "wine_1_label": "G",
      "wine_2_label": "F",
      "slider_value": 0
    },
    {
      "voter_name": "David",
      "match_id": "F",
      "wine_1_label": "H",
      "wine_2_label": "G",
      "slider_value": 0
    },
    {
      "voter_name": "Abby",
      "match_id": "Q1",
      "wine_1_label": "A",
      "wine_2_label": "H",
      "slider_value": 0
    },
    {
      "voter_name": "Abby",
      "match_id": "Q2",
      "wine_1_label": "B",
      "wine_2_label": "G",
      "slider_value": 0
    },
    {
      "voter_name": "Abby",
      "match_id": "Q3",
      "wine_1_label": "D",
      "wine_2_label": "E",
      "slider_value": 0
    },
    {
      "voter_name": "Abby",
      "match_id": "Q4",
      "wine_1_label": "C",
      "wine_2_label": "F",
      "slider_value": 100
    },
    {
      "voter_name": "Abby",
      "match_id": "S1",
      "wine_1_label": "A",
      "wine_2_label": "D",
      "slider_value": 0
    },
    {
      "voter_name": "Abby",
      "match_id": "S2",
      "wine_1_label": "B",
      "wine_2_label": "F",
      "slider_value": 0
    },
    {
      "voter_name": "Abby",
      "match_id": "F",
      "wine_1_label": "A",
      "wine_2_label": "B",
      "slider_value": 0
    },
    {
      "voter_name": "Alexcia",
      "match_id": "Q1",
      "wine_1_label": "A",
      "wine_2_label": "H",
      "slider_value": 0
    },
    {
      "voter_name": "Alexcia",
      "match_id": "Q2",
      "wine_1_label": "B",
      "wine_2_label": "G",
      "slider_value": 100
    },
    {
      "voter_name": "Alexcia",
      "match_id": "Q3",
      "wine_1_label": "D",
      "wine_2_label": "E",
      "slider_value": 100
    },
    {
      "voter_name": "Alexcia",
      "match_id": "Q4",
      "wine_1_label": "C",
      "wine_2_label": "F",
      "slider_value": 100
    },
    {
      "voter_name": "Alexcia",
      "match_id": "S1",
      "wine_1_label": "A",
      "wine_2_label": "E",
      "slider_value": 100
    },
    {
      "voter_name": "Alexcia",
      "match_id": "S2",
      "wine_1_label": "G",
      "wine_2_label": "F",
      "slider_value": 100
    },
    {
      "voter_name": "Alexcia",
      "match_id": "F",
      "wine_1_label": "E",
      "wine_2_label": "F",
      "slider_value": 100
    },
    {
      "voter_name": "Jack",
      "match_id": "Q1",
      "wine_1_label": "A",
      "wine_2_label": "H",
      "slider_value": 0
    },
    {
      "voter_name": "Jack",
      "match_id": "Q2",
      "wine_1_label": "B",
      "wine_2_label": "G",
      "slider_value": 100
    },
    {
      "voter_name": "Jack",
      "match_id": "Q3",
      "wine_1_label": "D",
      "wine_2_label": "E",
      "slider_value": 100
    },
    {
      "voter_name": "Jack",
      "match_id": "Q4",
      "wine_1_label": "C",
      "wine_2_label": "F",
      "slider_value": 0
    },
    {
      "voter_name": "Jack",
      "match_id": "S1",
      "wine_1_label": "A",
      "wine_2_label": "E",
      "slider_value": 100
    },
    {
      "voter_name": "Jack",
      "match_id": "S2",
      "wine_1_label": "G",
      "wine_2_label": "C",
      "slider_value": 0
    },
    {
      "voter_name": "Jack",
      "match_id": "F",
      "wine_1_label": "E",
      "wine_2_label": "G",
      "slider_value": 100
    }
  ]
},
];
