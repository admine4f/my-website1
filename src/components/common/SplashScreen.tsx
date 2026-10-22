import React, { useEffect, useState } from 'react';
import { Shield, Zap, TrendingUp } from 'lucide-react';

interface SplashScreenProps {
  onFinish?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [fade, setFade] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFade(true);
      setTimeout(() => {
        setDismissed(true);
        if (onFinish) onFinish();
      }, 600);
    }, 2400);

    return () => clearTimeout(timer);
  }, [onFinish]);

  if (dismissed) return null;

  return (
    <div
      onClick={() => {
        setFade(true);
        setTimeout(() => {
          setDismissed(true);
          if (onFinish) onFinish();
        }, 300);
      }}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#050811] px-6 py-12 transition-opacity duration-700 cursor-pointer ${
        fade ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background Ambient Lights */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-gradient-to-br from-amber-500/20 via-sky-600/20 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 right-10 w-60 h-60 rounded-full bg-sky-500/10 blur-2xl pointer-events-none" />

      {/* Top Tagline */}
      <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-[11px] font-medium text-slate-300 backdrop-blur-md">
        <Zap className="w-3.5 h-3.5 text-amber-400" />
        <span>Official Telegram Web3 Ecosystem</span>
      </div>

      {/* Center Hero Coin & Brand */}
      <div className="flex flex-col items-center text-center">
        {/* Glowing 3D Coin presentation */}
        <div className="relative mb-6">
          <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-amber-500 via-sky-400 to-amber-300 opacity-40 blur-xl animate-pulse" />
          <div className="relative w-36 h-36 rounded-full p-1 bg-gradient-to-b from-amber-300 via-amber-600 to-slate-900 shadow-[0_0_50px_rgba(245,158,11,0.5)]">
            <img
              src="/e4f_coin.jpg"
              alt="E4F Web3 Coin"
              className="w-full h-full object-cover rounded-full"
            />
          </div>
        </div>

        <h1 className="text-3xl font-black tracking-tight text-white mb-2">
          <span className="bg-gradient-to-r from-amber-300 via-amber-100 to-sky-300 bg-clip-text text-transparent">
            E4F
          </span>{' '}
          <span className="text-slate-100 font-extrabold">Web3 Exchange</span>
        </h1>

        <p className="text-sm font-semibold tracking-widest text-amber-400/90 uppercase mb-4">
          Mine • Earn • Trade • Grow
        </p>

        <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
          Your Global Web3 Exchange & Multi-Asset Spot Trading Gateway
        </p>
      </div>

      {/* Bottom Features & Loading Pulse */}
      <div className="w-full max-w-xs flex flex-col items-center gap-4">
        <div className="grid grid-cols-3 gap-2 w-full text-center">
          <div className="flex flex-col items-center p-2 rounded-xl bg-slate-900/60 border border-slate-800">
            <Shield className="w-4 h-4 text-sky-400 mb-1" />
            <span className="text-[10px] text-slate-300 font-medium">Secured</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-xl bg-slate-900/60 border border-slate-800">
            <Zap className="w-4 h-4 text-amber-400 mb-1" />
            <span className="text-[10px] text-slate-300 font-medium">8h Mining</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-xl bg-slate-900/60 border border-slate-800">
            <TrendingUp className="w-4 h-4 text-emerald-400 mb-1" />
            <span className="text-[10px] text-slate-300 font-medium">Spot Trade</span>
          </div>
        </div>

        <div className="w-full bg-slate-800/80 rounded-full h-1 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-amber-400 via-sky-400 to-amber-300 animate-[pulse_1.5s_infinite] w-3/4 rounded-full" />
        </div>
        <span className="text-[11px] text-slate-400">Loading exchange data... Tap to enter</span>
      </div>
    </div>
  );
};
