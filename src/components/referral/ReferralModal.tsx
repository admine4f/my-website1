import React, { useState } from 'react';
import { X, Copy, Check, Users, Share2, Award, Gift } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

interface ReferralModalProps {
  onClose: () => void;
}

export const ReferralModal: React.FC<ReferralModalProps> = ({ onClose }) => {
  const { user, addToast } = useApp();
  const [copied, setCopied] = useState(false);
  const [referralBonusUSDT, setReferralBonusUSDT] = useState(5);
  const [referralStats, setReferralStats] = useState<{
    totalInvited: number;
    qualified: number;
    active: number;
    totalEarnedUSDT: number;
    history?: any[];
  }>({
    totalInvited: 0,
    qualified: 0,
    active: 0,
    totalEarnedUSDT: 0,
    history: [],
  });

  React.useEffect(() => {
    api.getPublicSettings()
      .then(data => {
        if (data.success && data.referralBonusUSDT !== undefined) {
          setReferralBonusUSDT(data.referralBonusUSDT);
        }
      })
      .catch(() => {});

    if (user?.id) {
      fetch(`/api/referrals/${user.id}`)
        .then(res => res.json())
        .then(data => {
          if (data) {
            setReferralStats({
              totalInvited: data.totalInvited || 0,
              qualified: data.qualified || 0,
              active: data.active || 0,
              totalEarnedUSDT: data.totalEarnedUSDT || 0,
              history: data.history || [],
            });
          }
        })
        .catch(() => {});
    }
  }, [user]);

  const referralCode = user?.referralCode || '';
  const referralLink = referralCode
    ? `https://t.me/E4F_Web3_mining_bot/app?startapp=${referralCode}`
    : 'https://t.me/E4F_Web3_mining_bot/app';

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast('Link Copied', 'Referral invite link copied to clipboard!', 'info');
  };

  const handleTelegramShare = () => {
    const text = encodeURIComponent(
      `🚀 Join E4F Web3 Exchange & Telegram Mini App! Mine E4F tokens, trade spot pairs, and earn instant crypto rewards.${referralCode ? ` Use my VIP invite: ${referralCode}` : ''}`
    );
    const url = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${text}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-sm bg-[#0C1326] border border-slate-700 rounded-3xl p-6 text-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-lg font-black text-white mb-1">
          Referral & Affiliate Network
        </h3>
        <p className="text-xs text-slate-400 mb-3">Invite friends and earn multi-tier crypto commissions</p>

        {/* Network Metrics Cards */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
            <div className="text-[10px] text-slate-400 font-semibold">Total Invited</div>
            <div className="text-sm font-extrabold text-white font-mono">{referralStats.totalInvited}</div>
            <div className="text-[9px] text-slate-500">Friends</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
            <div className="text-[10px] text-slate-400 font-semibold">Active Miners</div>
            <div className="text-sm font-extrabold text-emerald-400 font-mono">{referralStats.active}</div>
            <div className="text-[9px] text-slate-500">Mining</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
            <div className="text-[10px] text-slate-400 font-semibold">Earned</div>
            <div className="text-sm font-extrabold text-amber-400 font-mono">${referralStats.totalEarnedUSDT}</div>
            <div className="text-[9px] text-slate-500">USDT</div>
          </div>
        </div>

        {/* Highlight Card */}
        <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/30 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <Gift className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-white">Direct Bonus: {referralBonusUSDT} USDT / Friend</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-snug">
            Receive +{referralBonusUSDT} USDT once your invited friend starts mining and completes the welcome quest!
          </p>
        </div>

        {/* 3 Tier breakdown (Section 29) */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
            <div className="text-[10px] text-slate-400 font-semibold">Tier 1</div>
            <div className="text-xs font-extrabold text-amber-400 font-mono">10%</div>
            <div className="text-[8px] text-slate-500">Direct</div>
          </div>
          <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
            <div className="text-[10px] text-slate-400 font-semibold">Tier 2</div>
            <div className="text-xs font-extrabold text-sky-400 font-mono">5%</div>
            <div className="text-[8px] text-slate-500">Sub-Tier</div>
          </div>
          <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
            <div className="text-[10px] text-slate-400 font-semibold">Tier 3</div>
            <div className="text-xs font-extrabold text-purple-400 font-mono">2.5%</div>
            <div className="text-[8px] text-slate-500">Extended</div>
          </div>
        </div>

        {/* Referral Code & Link Box */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 mb-3">
          <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
            <span>YOUR VIP REFERRAL CODE</span>
            <span className="font-mono font-bold text-amber-400">{referralCode || '...'}</span>
          </div>
          <div className="text-[11px] font-mono text-slate-300 truncate bg-slate-900 px-2 py-1.5 rounded border border-slate-800">
            {referralLink}
          </div>
        </div>

        {/* 90-Day Referral History Notice */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-3 px-1">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3 text-sky-400" />
            <span>Referral Network Ledger</span>
          </span>
          <span className="text-[9px] text-emerald-400 font-medium">90 Days Retained</span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Link'}</span>
          </button>
          <button
            onClick={handleTelegramShare}
            className="flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black shadow-md shadow-sky-500/20 flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share to Telegram</span>
          </button>
        </div>
      </div>
    </div>
  );
};
