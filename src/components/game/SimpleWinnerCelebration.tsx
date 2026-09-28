import React, { useEffect, useState } from 'react';
import { Country } from '@/data/countries_complete';

interface SimpleWinnerCelebrationProps {
  winner: Country;
  onRestart: () => void;
  eliminatedCount: number;
  predictions?: string[];
  eliminatedFlags?: Country[];
}

export const SimpleWinnerCelebration: React.FC<SimpleWinnerCelebrationProps> = ({
  winner,
  onRestart,
  eliminatedCount,
  predictions = [],
  eliminatedFlags = []
}) => {
  const [show, setShow] = useState(false);
  const [confetti, setConfetti] = useState<{ id: number; x: number; delay: number; color: string; size: number }[]>([]);

  useEffect(() => {
    setTimeout(() => setShow(true), 100);

    const pieces = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 2,
      color: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'][Math.floor(Math.random() * 8)],
      size: 4 + Math.random() * 8,
    }));
    setConfetti(pieces);

    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(`${winner.name} wins the battle!`);
      u.volume = 0.7;
      u.rate = 0.9;
      setTimeout(() => speechSynthesis.speak(u), 600);
    }
  }, [winner]);

  // Determine ranks of predictions
  const getRank = (code: string) => {
    if (!code) return null;
    if (winner.code === code) return 1;
    const index = eliminatedFlags.findIndex(f => f.code === code);
    if (index !== -1) return index + 2; // index 0 is rank 2, index 1 is rank 3...
    return null;
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-auto"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>

      {/* Confetti */}
      {confetti.map(p => (
        <div key={p.id} className="absolute top-0 pointer-events-none"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            backgroundColor: p.color,
            animation: `confettiDrop 3s ease-in ${p.delay}s both`,
          }} />
      ))}

      {/* Winner card */}
      <div className={`transition-all duration-700 ${show ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
        <div className="text-center space-y-6 max-w-2xl mx-4 bg-[#121629] p-8 rounded-3xl border border-white/20 shadow-2xl">
          <div className="text-6xl animate-bounce">👑</div>

          <div className="relative inline-block">
            <div className="absolute -inset-4 bg-yellow-500/20 rounded-2xl blur-xl animate-pulse" />
            <img
              src={`https://flagcdn.com/w320/${winner.code.toLowerCase()}.png`}
              alt={winner.name}
              className="relative w-48 h-28 object-cover rounded-xl border-2 border-yellow-400/50 shadow-2xl mx-auto"
            />
          </div>

          <div>
            <div className="text-4xl font-black text-white mb-1">
              {winner.emoji} {winner.name}
            </div>
            <div className="text-yellow-400 font-bold text-xl uppercase tracking-wider">
              Champion!
            </div>
            <div className="text-white/50 text-sm mt-2">
              Survived against <span className="text-white font-bold">{eliminatedCount}</span> competitors
            </div>
          </div>

          {/* Predictions Results section */}
          {predictions.some(p => p) && (
            <div className="mt-8 bg-white/5 rounded-2xl p-4 text-left border border-white/10">
              <h3 className="text-white/70 font-bold text-sm uppercase tracking-widest mb-3">Your Predictions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {predictions.map((p, idx) => {
                  if (!p) return null;
                  const rank = getRank(p);
                  const isWinner = rank === 1;
                  const isTop10 = rank !== null && rank <= 10;
                  
                  return (
                    <div key={idx} className={`p-3 rounded-xl border ${isWinner ? 'bg-yellow-500/20 border-yellow-500/50' : isTop10 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}>
                      <div className="text-xs text-white/50 mb-1">Pick #{idx + 1}</div>
                      <div className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                        <img src={`https://flagcdn.com/w40/${p.toLowerCase()}.png`} className="w-6 h-4 object-cover rounded-sm" />
                        <span className="truncate">{p}</span>
                      </div>
                      <div className={`text-sm font-bold ${isWinner ? 'text-yellow-400' : isTop10 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {rank ? `Rank #${rank}` : 'Unknown'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={onRestart}
            className="w-full mt-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-lg px-8 py-4 rounded-xl shadow-[0_0_20px_rgba(96,165,250,0.3)] transition-all transform active:scale-95"
          >
            🔄 Play Again
          </button>
        </div>
      </div>

      <style>{`
        @keyframes confettiDrop {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
};