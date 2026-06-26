import { Wine, Vote } from '../utils/mockData';
import { Trophy, CheckCircle, HelpCircle, Lock } from 'lucide-react';

interface BracketsProps {
  wines: Wine[];
  votes: Vote[];
  voterName: string;
  revealed: boolean;
  matchWinners: Record<string, string>; // match_id -> winner_label ('A'-'H')
  onSelectMatch: (matchId: string, wine1: string, wine2: string) => void;
}

export default function Brackets({
  wines,
  votes,
  voterName,
  revealed,
  matchWinners,
  onSelectMatch
}: BracketsProps) {
  
  // Find wine detail by blind label
  const getWineByLabel = (label: string): Wine | undefined => {
    return wines.find(w => w.blind_label === label);
  };

  const getWineDisplayName = (label: string): string => {
    if (!label) return "TBD";
    if (revealed) {
      const w = getWineByLabel(label);
      return w ? `${w.name} ($${w.price.toFixed(0)})` : `Wine ${label}`;
    }
    return `Wine ${label}`;
  };

  // Check if voter has voted on a match
  const hasVoted = (matchId: string): boolean => {
    return votes.some(v => v.match_id === matchId && v.voter_name.toLowerCase() === voterName.toLowerCase());
  };

  // Define matches
  // Q1: A vs B
  // Q2: C vs D
  // Q3: E vs F
  // Q4: G vs H
  // S1: Winner of Q1 vs Winner of Q2
  // S2: Winner of Q3 vs Winner of Q4
  // F: Winner of S1 vs Winner of S2

  const matches = [
    {
      id: 'Q1',
      round: 'Quarterfinal',
      wine1: 'A',
      wine2: 'B',
      winner: matchWinners['Q1'],
      playable: true
    },
    {
      id: 'Q2',
      round: 'Quarterfinal',
      wine1: 'C',
      wine2: 'D',
      winner: matchWinners['Q2'],
      playable: true
    },
    {
      id: 'Q3',
      round: 'Quarterfinal',
      wine1: 'E',
      wine2: 'F',
      winner: matchWinners['Q3'],
      playable: true
    },
    {
      id: 'Q4',
      round: 'Quarterfinal',
      wine1: 'G',
      wine2: 'H',
      winner: matchWinners['Q4'],
      playable: true
    },
    {
      id: 'S1',
      round: 'Semifinal',
      wine1: matchWinners['Q1'] || '',
      wine2: matchWinners['Q2'] || '',
      winner: matchWinners['S1'],
      playable: !!(matchWinners['Q1'] && matchWinners['Q2'])
    },
    {
      id: 'S2',
      round: 'Semifinal',
      wine1: matchWinners['Q3'] || '',
      wine2: matchWinners['Q4'] || '',
      winner: matchWinners['S2'],
      playable: !!(matchWinners['Q3'] && matchWinners['Q4'])
    },
    {
      id: 'F',
      round: 'Final',
      wine1: matchWinners['S1'] || '',
      wine2: matchWinners['S2'] || '',
      winner: matchWinners['F'],
      playable: !!(matchWinners['S1'] && matchWinners['S2'])
    }
  ];

  const renderMatchNode = (match: typeof matches[0]) => {
    const isVoted = hasVoted(match.id);
    const w1Name = getWineDisplayName(match.wine1);
    const w2Name = getWineDisplayName(match.wine2);

    const isW1Winner = match.winner === match.wine1 && !!match.winner;
    const isW2Winner = match.winner === match.wine2 && !!match.winner;

    const handleClick = () => {
      if (match.playable && match.wine1 && match.wine2) {
        onSelectMatch(match.id, match.wine1, match.wine2);
      }
    };

    return (
      <div 
        key={match.id}
        onClick={handleClick}
        className={`w-72 glass-panel rounded-xl overflow-hidden shadow-md flex flex-col transition-all duration-200 ${
          match.playable 
            ? 'cursor-pointer hover:border-wine-800/80 hover:bg-slate-900/80 hover:shadow-wine-950/10' 
            : 'opacity-50 select-none'
        }`}
      >
        {/* Match Header */}
        <div className="bg-slate-950 px-3 py-1.5 flex justify-between items-center border-b border-slate-800 text-[10px] uppercase font-bold tracking-wider text-slate-500">
          <span>{match.round} - {match.id}</span>
          {match.playable ? (
            isVoted ? (
              <span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Voted</span>
            ) : (
              <span className="text-amber-500 flex items-center gap-1"><HelpCircle className="w-3 h-3 animate-pulse" /> Vote now</span>
            )
          ) : (
            <span className="text-slate-600 flex items-center gap-1"><Lock className="w-3 h-3" /> Locked</span>
          )}
        </div>

        {/* Competitors */}
        <div className="divide-y divide-slate-800/40 text-xs">
          {/* Competitor 1 */}
          <div className={`px-4 py-2.5 flex justify-between items-center ${isW1Winner ? 'bg-wine-950/20' : ''}`}>
            <div className="flex items-center gap-3">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                isW1Winner ? 'bg-wine-700 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {match.wine1 || '?'}
              </span>
              <span className={`font-medium ${
                !match.wine1 
                  ? 'text-slate-600 italic' 
                  : isW1Winner 
                    ? 'text-wine-200 font-bold' 
                    : isW2Winner 
                      ? 'text-slate-500 line-through' 
                      : 'text-slate-350'
              }`}>
                {w1Name}
              </span>
            </div>
            {isW1Winner && <Trophy className="w-3.5 h-3.5 text-gold-400" />}
          </div>

          {/* Competitor 2 */}
          <div className={`px-4 py-2.5 flex justify-between items-center ${isW2Winner ? 'bg-wine-950/20' : ''}`}>
            <div className="flex items-center gap-3">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                isW2Winner ? 'bg-wine-700 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {match.wine2 || '?'}
              </span>
              <span className={`font-medium ${
                !match.wine2 
                  ? 'text-slate-600 italic' 
                  : isW2Winner 
                    ? 'text-wine-200 font-bold' 
                    : isW1Winner 
                      ? 'text-slate-500 line-through' 
                      : 'text-slate-350'
              }`}>
                {w2Name}
              </span>
            </div>
            {isW2Winner && <Trophy className="w-3.5 h-3.5 text-gold-400" />}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <h2 className="text-3xl font-bold font-serif text-wine-100">Tasting Tournament Bracket</h2>
        <p className="text-slate-400 text-sm">
          Click on any unlocked matchup to taste and enter your scores. The bracket will advance in real-time as the host settles each round.
        </p>
      </div>

      {/* Bracket Tree Layout */}
      <div className="flex flex-col lg:flex-row items-center justify-center gap-8 xl:gap-12 min-h-[450px] overflow-x-auto py-6">
        
        {/* Round 1: Quarterfinals */}
        <div className="flex flex-col gap-6">
          <div className="text-center text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-900 pb-2">Quarterfinals</div>
          {renderMatchNode(matches[0])}
          {renderMatchNode(matches[1])}
          {renderMatchNode(matches[2])}
          {renderMatchNode(matches[3])}
        </div>

        {/* Connectors between Q and S */}
        <div className="hidden lg:flex flex-col justify-around h-[580px] -mx-4 z-0 pointer-events-none">
          <div className="flex items-center">
            <div className="bracket-node-connector-y h-[135px] relative">
              <div className={`bracket-node-connector-x w-8 absolute top-0 ${matchWinners['Q1'] ? 'bracket-node-connector-active' : ''}`} />
              <div className={`bracket-node-connector-x w-8 absolute bottom-0 ${matchWinners['Q2'] ? 'bracket-node-connector-active' : ''}`} />
              <div className={`bracket-node-connector-x w-8 absolute top-1/2 ${matchWinners['Q1'] && matchWinners['Q2'] ? 'bracket-node-connector-active' : ''}`} />
            </div>
          </div>
          <div className="flex items-center">
            <div className="bracket-node-connector-y h-[135px] relative">
              <div className={`bracket-node-connector-x w-8 absolute top-0 ${matchWinners['Q3'] ? 'bracket-node-connector-active' : ''}`} />
              <div className={`bracket-node-connector-x w-8 absolute bottom-0 ${matchWinners['Q4'] ? 'bracket-node-connector-active' : ''}`} />
              <div className={`bracket-node-connector-x w-8 absolute top-1/2 ${matchWinners['Q3'] && matchWinners['Q4'] ? 'bracket-node-connector-active' : ''}`} />
            </div>
          </div>
        </div>

        {/* Round 2: Semifinals */}
        <div className="flex flex-col gap-28 lg:gap-36 justify-center">
          <div className="text-center text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-900 pb-2">Semifinals</div>
          {renderMatchNode(matches[4])}
          {renderMatchNode(matches[5])}
        </div>

        {/* Connectors between S and F */}
        <div className="hidden lg:flex flex-col justify-center h-[580px] -mx-4 z-0 pointer-events-none">
          <div className="bracket-node-connector-y h-[215px] relative">
            <div className={`bracket-node-connector-x w-8 absolute top-0 ${matchWinners['S1'] ? 'bracket-node-connector-active' : ''}`} />
            <div className={`bracket-node-connector-x w-8 absolute bottom-0 ${matchWinners['S2'] ? 'bracket-node-connector-active' : ''}`} />
            <div className={`bracket-node-connector-x w-8 absolute top-1/2 ${matchWinners['S1'] && matchWinners['S2'] ? 'bracket-node-connector-active' : ''}`} />
          </div>
        </div>

        {/* Round 3: Finals */}
        <div className="flex flex-col gap-6 justify-center">
          <div className="text-center text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-900 pb-2">Finals (Best in Show)</div>
          {renderMatchNode(matches[6])}
          
          {/* Trophy Room (Final Winner) */}
          {matchWinners['F'] && (
            <div className="mt-8 glass-panel border-gold-600/30 bg-gradient-to-b from-gold-950/20 to-slate-950 rounded-2xl p-6 text-center space-y-3 animate-fade-in max-w-xs mx-auto">
              <Trophy className="w-12 h-12 text-gold-400 mx-auto drop-shadow-[0_0_15px_rgba(212,175,55,0.4)] animate-bounce" />
              <div className="space-y-1">
                <p className="text-[10px] text-gold-300 font-extrabold uppercase tracking-widest">Tournament Champion</p>
                <h4 className="text-xl font-bold text-gold-100 font-serif">
                  Wine {matchWinners['F']}
                </h4>
                <p className="text-xs text-slate-400 font-medium">
                  {getWineDisplayName(matchWinners['F'])}
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
