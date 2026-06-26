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
    date: "2025-05-15",
    winnerName: "Kendall-Jackson Vintner's Reserve",
    winnerPrice: 16.99,
    winnerBroughtBy: "Dave & Barb",
    winesCount: 8,
    groupWinner: "Kendall-Jackson Vintner's Reserve ($16.99)",
    secondPlace: "Rombauer Carneros Chardonnay ($42.00)",
    bestValue: "Kendall-Jackson Vintner's Reserve ($16.99)",
    giantKiller: "Kendall-Jackson Vintner's Reserve ($16.99) beat Cakebread Cellars ($49.99)",
    wines: [
      { name: "Kendall-Jackson Vintner's Reserve", price: 16.99, submitted_by: "Dave & Barb", score: 88, wins: 3 },
      { name: "Rombauer Carneros Chardonnay", price: 42.00, submitted_by: "John & Susan", score: 82, wins: 2 },
      { name: "Cakebread Cellars Chardonnay", price: 49.99, submitted_by: "Host (Mark & Emily)", score: 76, wins: 1 },
      { name: "La Crema Sonoma Coast Chardonnay", price: 21.99, submitted_by: "Jim & Chloe", score: 74, wins: 1 },
      { name: "J. Lohr Riverstone Chardonnay", price: 12.99, submitted_by: "Dave & Barb", score: 68, wins: 0 },
      { name: "Bogle Chardonnay", price: 9.99, submitted_by: "Jim & Chloe", score: 65, wins: 0 },
      { name: "Butter Chardonnay", price: 15.99, submitted_by: "John & Susan", score: 60, wins: 0 },
      { name: "Far Niente Chardonnay", price: 79.99, submitted_by: "Host (Mark & Emily)", score: 58, wins: 0 }
    ]
  },
  {
    id: "hist-pinot-show",
    name: "The Pinot Show",
    date: "2025-09-12",
    winnerName: "Meiomi Pinot Noir",
    winnerPrice: 20.99,
    winnerBroughtBy: "Jim & Chloe",
    winesCount: 8,
    groupWinner: "Meiomi Pinot Noir ($20.99)",
    secondPlace: "Belle Glos Las Alturas",
    bestValue: "Meiomi Pinot Noir ($20.99)",
    giantKiller: "Meiomi Pinot Noir ($20.99) beat Flowers Sonoma Coast ($54.99)",
    wines: [
      { name: "Meiomi Pinot Noir", price: 20.99, submitted_by: "Jim & Chloe", score: 86, wins: 3 },
      { name: "Belle Glos Las Alturas Pinot Noir", price: 44.99, submitted_by: "Dave & Barb", score: 81, wins: 2 },
      { name: "Decoy California Pinot Noir", price: 18.99, submitted_by: "John & Susan", score: 75, wins: 1 },
      { name: "Flowers Sonoma Coast Pinot Noir", price: 54.99, submitted_by: "Host (Mark & Emily)", score: 73, wins: 1 },
      { name: "Acrobat Oregon Pinot Noir", price: 15.99, submitted_by: "Jim & Chloe", score: 69, wins: 0 },
      { name: "La Crema Monterey Pinot Noir", price: 19.99, submitted_by: "John & Susan", score: 67, wins: 0 },
      { name: "Erath Resplendent Pinot Noir", price: 17.99, submitted_by: "Dave & Barb", score: 62, wins: 0 },
      { name: "Kosta Browne Russian River", price: 119.99, submitted_by: "Host (Mark & Emily)", score: 55, wins: 0 }
    ]
  },
  {
    id: "hist-rumble-reds",
    name: "Rumble di Reds",
    date: "2025-11-20",
    winnerName: "The Prisoner Red Blend",
    winnerPrice: 48.99,
    winnerBroughtBy: "John & Susan",
    winesCount: 8,
    groupWinner: "The Prisoner Red Blend ($48.99)",
    secondPlace: "Apothic Red Blend",
    bestValue: "Apothic Red Blend ($10.99)",
    giantKiller: "Apothic Red Blend ($10.99) beat Orin Swift 8 Years in the Desert ($45.99)",
    wines: [
      { name: "The Prisoner Red Blend", price: 48.99, submitted_by: "John & Susan", score: 89, wins: 3 },
      { name: "Apothic Red Blend", price: 10.99, submitted_by: "Dave & Barb", score: 84, wins: 2 },
      { name: "Orin Swift 8 Years in the Desert", price: 45.99, submitted_by: "Host (Mark & Emily)", score: 79, wins: 1 },
      { name: "Conundrum Red Blend", price: 19.99, submitted_by: "Jim & Chloe", score: 78, wins: 1 },
      { name: "Menage a Trois Red", price: 9.99, submitted_by: "Jim & Chloe", score: 70, wins: 0 },
      { name: "19 Crimes Red Blend", price: 11.99, submitted_by: "Dave & Barb", score: 67, wins: 0 },
      { name: "Unshackled Red Blend by Prisoner", price: 24.99, submitted_by: "John & Susan", score: 64, wins: 0 },
      { name: "Justin Isosceles", price: 74.99, submitted_by: "Host (Mark & Emily)", score: 61, wins: 0 }
    ]
  },
  {
    id: "hist-carnival-cabernet",
    name: "Carnival de Cabernet",
    date: "2026-02-14",
    winnerName: "Austin Hope Cabernet Sauvignon",
    winnerPrice: 56.00,
    winnerBroughtBy: "Host (Mark & Emily)",
    winesCount: 8,
    groupWinner: "Austin Hope Cabernet Sauvignon ($56.00)",
    secondPlace: "J. Lohr Seven Oaks Cabernet",
    bestValue: "J. Lohr Seven Oaks Cabernet ($14.99)",
    giantKiller: "J. Lohr Seven Oaks Cabernet ($14.99) beat Silver Oak Alexander Valley ($85.00)",
    wines: [
      { name: "Austin Hope Cabernet Sauvignon", price: 56.00, submitted_by: "Host (Mark & Emily)", score: 92, wins: 3 },
      { name: "J. Lohr Seven Oaks Cabernet Sauvignon", price: 14.99, submitted_by: "Dave & Barb", score: 83, wins: 2 },
      { name: "Decoy Cabernet Sauvignon", price: 19.99, submitted_by: "Jim & Chloe", score: 78, wins: 1 },
      { name: "Silver Oak Alexander Valley Cabernet", price: 85.00, submitted_by: "John & Susan", score: 77, wins: 1 },
      { name: "Josh Cellars Cabernet Sauvignon", price: 13.99, submitted_by: "Dave & Barb", score: 71, wins: 0 },
      { name: "Caymus Napa Valley Cabernet", price: 89.99, submitted_by: "John & Susan", score: 68, wins: 0 },
      { name: "Avalon Cabernet Sauvignon", price: 10.99, submitted_by: "Jim & Chloe", score: 65, wins: 0 },
      { name: "Stags' Leap Winery Cabernet", price: 59.99, submitted_by: "Host (Mark & Emily)", score: 60, wins: 0 }
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
