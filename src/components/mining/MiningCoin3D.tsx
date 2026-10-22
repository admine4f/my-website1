import React from 'react';
import { Flame, CheckCircle, Zap } from 'lucide-react';

interface MiningCoin3DProps {
  isActive: boolean;
  isCompleted: boolean;
  onClick?: () => void;
}

export const MiningCoin3D: React.FC<MiningCoin3DProps> = ({ isActive, isCompleted, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="relative flex flex-col items-center justify-center cursor-pointer select-none py-6"
    >
      {/* Outer Multi-layered Flame Aura Glow */}
      <div
        className={`absolute -inset-6 rounded-full transition-all duration-700 pointer-events-none ${
          isActive
            ? 'bg-gradient-to-tr from-red-600/35 via-orange-500/40 to-amber-400/35 blur-3xl opacity-90 animate-pulse'
            : isCompleted
            ? 'bg-emerald-500/20 blur-2xl opacity-60'
            : 'bg-orange-500/20 blur-2xl opacity-40'
        }`}
      />

      {/* Burning Ring of Fire Container */}
      <div
        className={`relative w-52 h-52 sm:w-60 sm:h-60 rounded-full flex items-center justify-center p-3 transition-all duration-500 ${
          isActive
            ? 'fire-ring-glow ring-2 ring-orange-500 shadow-[0_0_40px_rgba(249,115,22,0.6)]'
            : isCompleted
            ? 'ring-2 ring-emerald-400/70 shadow-[0_0_30px_rgba(16,185,129,0.4)]'
            : 'ring-2 ring-orange-500/60 shadow-[0_0_25px_rgba(249,115,22,0.35)]'
        }`}
      >
        {/* Animated Fiery Orbit Ring 1 (Dashed flame orbit) */}
        <div
          className={`absolute inset-0 rounded-full border-2 border-dashed transition-all pointer-events-none ${
            isActive
              ? 'border-orange-400/80 animate-[spin_8s_linear_infinite]'
              : 'border-orange-500/50 animate-[spin_16s_linear_infinite]'
          }`}
        />

        {/* Animated Fiery Orbit Ring 2 (Dotted flame orbit) */}
        <div
          className={`absolute -inset-1.5 rounded-full border-2 border-dotted transition-all pointer-events-none ${
            isActive
              ? 'border-yellow-300/70 animate-[spin_14s_linear_infinite_reverse]'
              : 'border-amber-400/40 animate-[spin_24s_linear_infinite_reverse]'
          }`}
        />

        {/* Blazing Flame Sheen Gradient Ring */}
        <div
          className="absolute -inset-2 rounded-full pointer-events-none opacity-40 animate-[spin_20s_linear_infinite]"
          style={{
            background: 'conic-gradient(from 0deg, transparent, rgba(249,115,22,0.6), rgba(234,179,8,0.7), transparent, rgba(239,68,68,0.6), transparent)',
          }}
        />

        {/* 3D Coin: NO BLACK BORDER (scaled to pure gold rim) - Continuous Circular Spin inside Ring of Fire */}
        <div className="relative w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center">
          <div
            className={`relative w-full h-full rounded-full shadow-2xl ${
              isActive ? 'animate-coin-spin-active' : 'animate-coin-spin-normal'
            }`}
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Front Face: Upright E4F (Black border completely eliminated with scale-[1.16]) */}
            <div
              className="absolute inset-0 rounded-full overflow-hidden shadow-2xl ring-2 ring-amber-400/90"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            >
              <img
                src="/e4f_coin.jpg"
                alt="E4F Mining Coin Front"
                className="w-full h-full object-cover scale-[1.16] rounded-full select-none pointer-events-none"
              />
              {/* Radiant Metallic Sheen across coin face */}
              {isActive && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-full">
                  <div className="w-[60%] h-full bg-gradient-to-r from-transparent via-white/40 to-transparent blur-sm animate-gleam" />
                </div>
              )}
            </div>

            {/* Back Face: Identical Upright E4F (Rotated 180deg so as coin spins 360, it is NEVER mirrored or backwards!) */}
            <div
              className="absolute inset-0 rounded-full overflow-hidden shadow-2xl ring-2 ring-amber-400/90"
              style={{
                transform: 'rotateY(180deg)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            >
              <img
                src="/e4f_coin.jpg"
                alt="E4F Mining Coin Back"
                className="w-full h-full object-cover scale-[1.16] rounded-full select-none pointer-events-none"
              />
              {/* Radiant Metallic Sheen across coin face */}
              {isActive && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-full">
                  <div className="w-[60%] h-full bg-gradient-to-r from-transparent via-white/40 to-transparent blur-sm animate-gleam" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Status Floating Tag */}
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap z-10">
          {isActive ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/95 border border-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.6)] text-[11px] font-bold text-amber-300">
              <Zap className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
              <span>MINING ACTIVE (8H)</span>
            </div>
          ) : isCompleted ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/95 border border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.5)] text-[11px] font-bold text-emerald-300">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>MINING COMPLETED</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/95 border border-orange-500/70 shadow-[0_0_15px_rgba(249,115,22,0.4)] text-[11px] font-bold text-orange-300">
              <Flame className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
              <span>MINING READY</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
