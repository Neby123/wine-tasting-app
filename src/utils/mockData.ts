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
}

// Pre-seeded historical sessions from past events
export const HISTORICAL_SESSIONS: HistoricalTasting[] = [
  {
    id: "hist-chard-show",
    name: "The Chard Show",
    date: "2025-08-02",
    winnerName: "California Heritage (Aldi)",
    winnerPrice: 4.99,
    winnerBroughtBy: "Guest",
    winesCount: 8,
    groupWinner: "California Heritage (Aldi) ($4.99)",
    secondPlace: "La Belle Angele (Total Wine)",
    bestValue: "California Heritage (Aldi) ($4.99)",
    giantKiller: "California Heritage (Aldi) (E, $4.99) beat 2019 Hyde (Auteur) (G, $55.00)",
    wines: [
      { name: "California Heritage (Aldi)", price: 4.99, submitted_by: "Guest", blind_label: "E", score: 76, wins: 11 },
      { name: "La Belle Angele (Total Wine)", price: 11.99, submitted_by: "Guest", blind_label: "A", score: 64, wins: 6 },
      { name: "2019 Hyde (Auteur)", price: 55.00, submitted_by: "Guest", blind_label: "G", score: 62, wins: 5 },
      { name: "Toad Hollow 2022 (Total Wine)", price: 12.00, submitted_by: "Guest", blind_label: "D", score: 62, wins: 5 },
      { name: "Peaks & Tides (Aldi)", price: 9.99, submitted_by: "Guest", blind_label: "C", score: 62, wins: 5 },
      { name: "Kirkland Signature Sonoma County (Costco)", price: 7.00, submitted_by: "Guest", blind_label: "F", score: 60, wins: 4 },
      { name: "Josh Cellars (Total Wine)", price: 10.00, submitted_by: "Guest", blind_label: "B", score: 60, wins: 4 },
      { name: "Butter (Costco)", price: 12.89, submitted_by: "Guest", blind_label: "H", score: 55, wins: 2 }
    ]
  },
  {
    id: "hist-pinot-show",
    name: "The Pinot Show",
    date: "2025-09-20",
    winnerName: "Buena Vista Bela's Selection 2021",
    winnerPrice: 58.00,
    winnerBroughtBy: "Guest",
    winesCount: 8,
    groupWinner: "Buena Vista Bela's Selection 2021 ($58.00)",
    secondPlace: "Firesteed Oregon 2022",
    bestValue: "California Heritage (Aldi) ($4.99)",
    giantKiller: "Firesteed Oregon 2022 (H, $14.99) beat 2023 Illahe Pinot Noir (F, $30.00)",
    wines: [
      { name: "Buena Vista Bela's Selection 2021", price: 58.00, submitted_by: "Guest", blind_label: "G", score: 92, wins: 15 },
      { name: "Firesteed Oregon 2022", price: 14.99, submitted_by: "Guest", blind_label: "H", score: 78, wins: 10 },
      { name: "Salem Eola-Amity Hills 2023", price: 26.00, submitted_by: "Guest", blind_label: "D", score: 72, wins: 8 },
      { name: "Banshee (Costco) ", price: 15.99, submitted_by: "Guest", blind_label: "C", score: 64, wins: 5 },
      { name: "Maison André Giochot Hautes-Côtes De Nuits", price: 18.99, submitted_by: "Guest", blind_label: "B", score: 58, wins: 3 },
      { name: "2023 Illahe Pinot Noir Willamette Valley", price: 30.00, submitted_by: "Guest", blind_label: "F", score: 53, wins: 1 },
      { name: "Don't Mind If I Do (Aldi)", price: 7.99, submitted_by: "Guest", blind_label: "A", score: 50, wins: 0 },
      { name: "California Heritage (Aldi)", price: 4.99, submitted_by: "Guest", blind_label: "E", score: 50, wins: 0 }
    ]
  },
  {
    id: "hist-rumble-reds",
    name: "Rumble di Reds",
    date: "2025-11-15",
    winnerName: "Scouts Honor",
    winnerPrice: 35.00,
    winnerBroughtBy: "Guest",
    winesCount: 8,
    groupWinner: "Scouts Honor ($35.00)",
    secondPlace: "Apothic Red",
    bestValue: "Kirkland Signature Red Wine Blend ($4.00)",
    giantKiller: "Apothic Red (B, $7.39) beat Menagerie of the Barossa (C, $26.00)",
    wines: [
      { name: "Scouts Honor", price: 35.00, submitted_by: "Guest", blind_label: "E", score: 75, wins: 9 },
      { name: "Apothic Red", price: 7.39, submitted_by: "Guest", blind_label: "B", score: 72, wins: 8 },
      { name: "Beau Vigne Hero 2022", price: 23.70, submitted_by: "Guest", blind_label: "G", score: 69, wins: 7 },
      { name: "Intermingle Aldi", price: 7.79, submitted_by: "Guest", blind_label: "A", score: 67, wins: 6 },
      { name: "Nastergal", price: 29.00, submitted_by: "Guest", blind_label: "F", score: 64, wins: 5 },
      { name: "Pillars of Hercules", price: 12.99, submitted_by: "Guest", blind_label: "H", score: 58, wins: 3 },
      { name: "Kirkland Signature Red Wine Blend", price: 4.00, submitted_by: "Guest", blind_label: "D", score: 58, wins: 3 },
      { name: "Menagerie of the Barossa", price: 26.00, submitted_by: "Guest", blind_label: "C", score: 53, wins: 1 }
    ]
  },
  {
    id: "hist-carnival-cabernet",
    name: "Carnival de Cabernet",
    date: "2026-03-14",
    winnerName: "One Stone",
    winnerPrice: 19.99,
    winnerBroughtBy: "Guest",
    winesCount: 8,
    groupWinner: "One Stone ($19.99)",
    secondPlace: "Vina Alicia",
    bestValue: "California Heritage Aldi ($4.99)",
    giantKiller: "One Stone (A, $19.99) beat Silver Oak (E, $90.00)",
    wines: [
      { name: "One Stone", price: 19.99, submitted_by: "Guest", blind_label: "A", score: 74, wins: 10 },
      { name: "Vina Alicia", price: 15.99, submitted_by: "Guest", blind_label: "G", score: 67, wins: 7 },
      { name: "Intermingle Aldi", price: 6.99, submitted_by: "Guest", blind_label: "F", score: 67, wins: 7 },
      { name: "California Heritage Aldi", price: 4.99, submitted_by: "Guest", blind_label: "D", score: 64, wins: 6 },
      { name: "Silver Oak", price: 90.00, submitted_by: "Guest", blind_label: "E", score: 62, wins: 5 },
      { name: "Wines of Substance Cab", price: 14.99, submitted_by: "Guest", blind_label: "C", score: 62, wins: 5 },
      { name: "Knorhoek Cabernet Stellenbosch", price: 26.99, submitted_by: "Guest", blind_label: "B", score: 62, wins: 5 },
      { name: "Method", price: 9.99, submitted_by: "Guest", blind_label: "H", score: 60, wins: 4 }
    ]
  }
];

// Helper to interact with LocalStorage
const LS_KEYS = {
  SESSIONS: 'WINE_TASTING_MOCK_SESSIONS',
  WINES: 'WINE_TASTING_MOCK_WINES',
  VOTES: 'WINE_TASTING_MOCK_VOTES',
  HISTORY: 'WINE_TASTING_MOCK_HISTORY'
};

const getFromLS = <T>(key: string, defaultValue: T): T => {
  const data = localStorage.getItem(key);
  if (!data) return defaultValue;
  try {
    return JSON.parse(data) as T;
  } catch {
    return defaultValue;
  }
};

const saveToLS = <T>(key: string, data: T): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Initialize empty or existing tables in LocalStorage
export const initMockDB = () => {
  if (!localStorage.getItem(LS_KEYS.SESSIONS)) {
    saveToLS(LS_KEYS.SESSIONS, [] as WineSession[]);
  }
  if (!localStorage.getItem(LS_KEYS.WINES)) {
    saveToLS(LS_KEYS.WINES, [] as Wine[]);
  }
  if (!localStorage.getItem(LS_KEYS.VOTES)) {
    saveToLS(LS_KEYS.VOTES, [] as Vote[]);
  }
  if (!localStorage.getItem(LS_KEYS.HISTORY)) {
    saveToLS(LS_KEYS.HISTORY, HISTORICAL_SESSIONS);
  }
};

// Client database API for both Mock and Supabase wrappers
export const mockDB = {
  // Session API
  getSessions: (): WineSession[] => {
    return getFromLS<WineSession[]>(LS_KEYS.SESSIONS, []);
  },
  
  getActiveSession: (): WineSession | null => {
    const sessions = getFromLS<WineSession[]>(LS_KEYS.SESSIONS, []);
    return sessions.find(s => s.status !== 'completed') || null;
  },

  createSession: (name: string): WineSession => {
    const sessions = getFromLS<WineSession[]>(LS_KEYS.SESSIONS, []);
    
    // Complete any other active sessions first
    const updatedSessions = sessions.map(s => 
      s.status !== 'completed' ? { ...s, status: 'completed' as const } : s
    );

    const newSession: WineSession = {
      id: 'session-' + Date.now(),
      name,
      date: new Date().toISOString().split('T')[0],
      status: 'setup',
      match_winners: {}
    };

    updatedSessions.push(newSession);
    saveToLS(LS_KEYS.SESSIONS, updatedSessions);
    return newSession;
  },

  updateSessionStatus: (sessionId: string, status: 'setup' | 'tasting' | 'completed'): WineSession | null => {
    const sessions = getFromLS<WineSession[]>(LS_KEYS.SESSIONS, []);
    const sessionIdx = sessions.findIndex(s => s.id === sessionId);
    if (sessionIdx === -1) return null;

    sessions[sessionIdx].status = status;
    saveToLS(LS_KEYS.SESSIONS, sessions);
    return sessions[sessionIdx];
  },

  updateSessionMatchWinners: (sessionId: string, matchWinners: Record<string, string>): WineSession | null => {
    const sessions = getFromLS<WineSession[]>(LS_KEYS.SESSIONS, []);
    const sessionIdx = sessions.findIndex(s => s.id === sessionId);
    if (sessionIdx === -1) return null;

    sessions[sessionIdx].match_winners = matchWinners;
    saveToLS(LS_KEYS.SESSIONS, sessions);
    return sessions[sessionIdx];
  },

  // Wine API
  getWines: (sessionId: string): Wine[] => {
    const wines = getFromLS<Wine[]>(LS_KEYS.WINES, []);
    return wines.filter(w => w.session_id === sessionId);
  },

  addWine: (wine: Omit<Wine, 'id' | 'revealed'>): Wine => {
    const wines = getFromLS<Wine[]>(LS_KEYS.WINES, []);
    const newWine: Wine = {
      ...wine,
      id: 'wine-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      revealed: false
    };
    wines.push(newWine);
    saveToLS(LS_KEYS.WINES, wines);
    return newWine;
  },

  deleteWine: (wineId: string): void => {
    const wines = getFromLS<Wine[]>(LS_KEYS.WINES, []);
    const filtered = wines.filter(w => w.id !== wineId);
    saveToLS(LS_KEYS.WINES, filtered);
  },

  mapAndRevealWines: (sessionId: string, mapping: Record<string, string>): Wine[] => {
    // mapping is blind_label -> wineId, e.g. {"A": "wine-123", "B": "wine-456"}
    // Invert to wineId -> blind_label
    const wineIdToLabel = new Map<string, string>();
    Object.entries(mapping).forEach(([label, wineId]) => {
      wineIdToLabel.set(wineId, label);
    });

    const wines = getFromLS<Wine[]>(LS_KEYS.WINES, []);
    const updated = wines.map(w => {
      if (w.session_id === sessionId) {
        return {
          ...w,
          blind_label: wineIdToLabel.get(w.id),
          revealed: true
        };
      }
      return w;
    });

    saveToLS(LS_KEYS.WINES, updated);
    return updated.filter(w => w.session_id === sessionId);
  },

  // Votes API
  getVotes: (sessionId: string): Vote[] => {
    const votes = getFromLS<Vote[]>(LS_KEYS.VOTES, []);
    return votes.filter(v => v.session_id === sessionId);
  },

  submitVote: (vote: Omit<Vote, 'id'>): Vote => {
    const votes = getFromLS<Vote[]>(LS_KEYS.VOTES, []);
    
    // Check if voter already voted for this match, if so overwrite
    const existingIdx = votes.findIndex(v => 
      v.session_id === vote.session_id && 
      v.voter_name.toLowerCase() === vote.voter_name.toLowerCase() && 
      v.match_id === vote.match_id
    );

    const newVote: Vote = {
      ...vote,
      id: existingIdx !== -1 ? votes[existingIdx].id : 'vote-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7)
    };

    if (existingIdx !== -1) {
      votes[existingIdx] = newVote;
    } else {
      votes.push(newVote);
    }

    saveToLS(LS_KEYS.VOTES, votes);
    return newVote;
  },

  // Archive / Historical Results API
  getHistory: (): HistoricalTasting[] => {
    return getFromLS<HistoricalTasting[]>(LS_KEYS.HISTORY, HISTORICAL_SESSIONS);
  },

  addHistorySession: (session: HistoricalTasting): void => {
    const history = getFromLS<HistoricalTasting[]>(LS_KEYS.HISTORY, HISTORICAL_SESSIONS);
    history.unshift(session); // Add to beginning
    saveToLS(LS_KEYS.HISTORY, history);
  }
};
