import React from 'react';
import { Gift, UserPlus, Sparkles, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';

interface AccountCreationModalProps {
  referralCode: string;
  referrerName?: string;
  loading?: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

export const AccountCreationModal: React.FC<AccountCreationModalProps> = ({
  referralCode,
  referrerName,
  loading = false,
  onConfirm,
  onDismiss,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl bg-[#0B111E] border border-amber-500/30 p-6 shadow-2xl shadow-amber-500/10 text-center relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-48 bg-gradient-to-b from-amber-500/20 to-transparent rounded-full blur-2xl pointer-events-none" />

        {/* Header Icon */}
        <div className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 p-0.5 shadow-lg shadow-amber-500/30 mb-4 flex items-center justify-center">
          <div className="w-full h-full rounded-2xl bg-slate-950 flex items-center justify-center">
            <Gift className="w-8 h-8 text-amber-400 animate-pulse" />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-lg font-black text-white tracking-wide mb-1">
          Create E4F Account
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          You have been invited to join E4F Web3 Exchange!
        </p>

        {/* Referral Card */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-3 mb-4 text-left">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Referral Invitation</span>
            <span className="text-emerald-400 flex items-center gap-1 font-bold">
              <CheckCircle2 className="w-3 h-3" /> Valid Code
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-base font-black text-amber-400 tracking-wider">
              {referralCode}
            </span>
            {referrerName && (
              <span className="text-[11px] text-slate-300">
                Invited by <strong className="text-white">{referrerName}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Welcome Benefits Highlights */}
        <div className="rounded-2xl bg-gradient-to-b from-amber-500/10 to-transparent border border-amber-500/20 p-3.5 mb-5 text-left space-y-2">
          <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Guaranteed Registration Bonus</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-200">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Spot Wallet Bonus
              </span>
              <span className="font-mono font-bold text-emerald-400">+25.00 USDT</span>
            </div>
            <div className="flex items-center justify-between text-slate-200">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Pre-Listing Tokens
              </span>
              <span className="font-mono font-bold text-amber-400">+10.00 E4F</span>
            </div>
            <div className="flex items-center justify-between text-slate-200">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                Daily Cloud Mining
              </span>
              <span className="font-mono font-bold text-sky-400">8-Hour Pool</span>
            </div>
          </div>
        </div>

        {/* Security & Verification Note */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 mb-4">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-500/70" />
          <span>1 Account per Telegram User. Multi-account fraud prevention active.</span>
        </div>

        {/* Actions */}
        <div className="space-y-2.5">
          <button
            onClick={onConfirm}
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 transition-transform active:scale-98 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>{loading ? 'Creating Account...' : 'Create Account'}</span>
            {!loading && <ArrowRight className="w-4 h-4 ml-0.5" />}
          </button>

          <button
            onClick={onDismiss}
            disabled={loading}
            className="w-full py-2 text-xs text-slate-400 hover:text-slate-300 disabled:opacity-50 transition-colors cursor-pointer text-center"
          >
            Continue without referral
          </button>
        </div>
      </div>
    </div>
  );
};
