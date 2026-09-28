import { Link } from 'react-router-dom';

const Index = () => {
  return (
    <div className="min-h-screen bg-[#0a0a1a] flex flex-col items-center justify-center p-4 overflow-hidden relative" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Floating emojis in background */}
      <div className="absolute inset-0 pointer-events-none opacity-20 text-4xl select-none" aria-hidden="true">
        <div className="absolute top-[10%] left-[10%] animate-[bounce_8s_infinite]">🇮🇳</div>
        <div className="absolute top-[20%] right-[15%] animate-[bounce_7s_infinite_1s]">🇺🇸</div>
        <div className="absolute bottom-[20%] left-[20%] animate-[bounce_6s_infinite_2s]">🇯🇵</div>
        <div className="absolute bottom-[15%] right-[25%] animate-[bounce_9s_infinite_0.5s]">🇧🇷</div>
        <div className="absolute top-[40%] left-[5%] animate-[bounce_10s_infinite_1.5s]">🇬🇧</div>
        <div className="absolute top-[60%] right-[5%] animate-[bounce_8s_infinite_2.5s]">🇩🇪</div>
      </div>
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(96,165,250,0.08) 0%, transparent 70%)' }} />
      </div>

      <div className="text-center space-y-10 z-10">
        <div className="space-y-4">
          <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
            🏳️ Flag Battle
          </h1>
          <p className="text-white/40 text-lg max-w-md mx-auto">
            100 country flags bounce inside a spinning arena. Last flag standing wins.
          </p>
        </div>

        <Link
          to="/battle"
          className="inline-block bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white font-black text-2xl px-16 py-6 rounded-3xl shadow-[0_0_50px_rgba(96,165,250,0.4)] hover:shadow-[0_0_80px_rgba(96,165,250,0.6)] transition-all transform hover:scale-110 active:scale-95 group relative overflow-hidden"
        >
          <span className="absolute inset-0 w-full h-full bg-white/20 -skew-x-12 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></span>
          <span className="relative flex items-center gap-3">
            <span className="text-3xl">▶</span> ENTER ARENA
          </span>
        </Link>

        <div className="pt-8">
          <div className="text-white/20 text-xs uppercase tracking-[0.3em] mb-4">How it Works</div>
          <div className="flex flex-col sm:flex-row justify-center gap-6 max-w-3xl mx-auto text-left">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex-1">
              <div className="text-2xl mb-2">🔮</div>
              <h3 className="text-white font-bold mb-1">1. Predict</h3>
              <p className="text-white/50 text-sm">Pick your top 3 champion countries before the battle begins.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex-1">
              <div className="text-2xl mb-2">⚔️</div>
              <h3 className="text-white font-bold mb-1">2. Survive</h3>
              <p className="text-white/50 text-sm">Watch 100 flags bounce in the arena. Fall into the red gap and you're out!</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex-1">
              <div className="text-2xl mb-2">⚡</div>
              <h3 className="text-white font-bold mb-1">3. Boost</h3>
              <p className="text-white/50 text-sm">Use your 3 boosts to save your champion from the brink of elimination.</p>
            </div>
          </div>
        </div>
        
        {/* Simple features text */}
        <div className="absolute bottom-6 left-0 right-0 text-center text-white/30 text-xs font-medium tracking-widest uppercase flex justify-center gap-8">
          <span>100 Flags</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">Pure Physics</span>
          <span className="hidden sm:inline">•</span>
          <span>1 Winner</span>
        </div>
      </div>
    </div>
  );
};

export default Index;
