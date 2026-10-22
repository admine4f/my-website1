import React from 'react';
import { Gift, CheckCircle2, ArrowRight, ShieldCheck, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const WelcomeBonusModal: React.FC = () => {
  const { showWelcomeBonus, setShowWelcomeBonus, setActiveTab, balances, activeModal, closeModal } = useApp();

  const isVisible = showWelcomeBonus || activeModal === 'WELCOME' || activeModal === 'WELCOME_BONUS';
  if (!isVisible) return null;

  const handleClose = () => {
    setShowWelcomeBonus(false);
    if (activeModal === 'WELCOME' || activeModal === 'WELCOME_BONUS') {
      closeModal();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-sm bg-gradient-to-b from-[#111A30] to-[#090E1D] border border-amber-500/40 rounded-3xl p-6 text-center shadow-[0_0_50px_rgba(245,158,11,0.25)]">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
        {/* Glow & Badge */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-600 p-0.5 shadow-lg shadow-amber-500/30 flex items-center justify-center mb-4">
          <div className="w-full h-full bg-slate-950 rounded-2xl flex items-center justify-center">
            <Gift className="w-8 h-8 text-amber-400 animate-bounce" />
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          Verified Telegram Account
        </div>

        <h3 className="text-xl font-bold text-white mb-1">
          Welcome Bonus Credited!
        </h3>
        <p className="text-xs text-slate-400 mb-5 leading-relaxed">
          Your initial account funding has been authorized by the backend server ledger.
        </p>

        {/* Dual Reward Cards */}
        <div className="grid grid-cols-2 gap-3 mb-5 text-left">
          {/* USDT */}
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-emerald-500/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-emerald-400">SPOT WALLET</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-extrabold text-white">{balances.usdt.toFixed(2)}</div>
            <div className="text-[10px] text-slate-400">USDT Available</div>
          </div>

          {/* E4F */}
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-amber-500/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-amber-400">PRE-LISTING</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-extrabold text-white">{balances.e4f.toFixed(2)}</div>
            <div className="text-[10px] text-slate-400">E4F Balance</div>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800 text-left text-[11px] text-slate-400 space-y-1 mb-5">
          <div className="flex items-center justify-between text-slate-300">
            <span>• USDT Destination:</span>
            <span className="font-semibold text-emerald-400">Spot Available</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span>• E4F Price Status:</span>
            <span className="font-semibold text-amber-400">Not Listed Yet (—)</span>
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              handleClose();
              setActiveTab('mining');
            }}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95"
          >
            <span>Start 8-Hour Mining</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleClose}
            className="w-full py-2.5 text-xs text-slate-400 hover:text-slate-200"
          >
            Continue to Exchange Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
