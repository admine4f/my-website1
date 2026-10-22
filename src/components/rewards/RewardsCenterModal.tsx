import React, { useState, useEffect } from 'react';
import { X, Calendar, CheckCircle2, Flame, Clock, Lock, Gift } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { DailyCheckInState } from '../../types';

interface RewardsCenterModalProps {
  onClose: () => void;
}

export const RewardsCenterModal: React.FC<RewardsCenterModalProps> = ({ onClose }) => {
  const { user, refreshProfile, addToast } = useApp();
  const [checkInState, setCheckInState] = useState<DailyCheckInState | null>(null);
  const [claimingCheckIn, setClaimingCheckIn] = useState(false);
  const [timeUntilReset, setTimeUntilReset] = useState<string>('');

  // Live countdown to next 00:00 UTC reset
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
      const diffMs = Math.max(0, tomorrow.getTime() - now.getTime());
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
      setTimeUntilReset(
        `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user) {
      api
        .getDailyCheckIn(user.id)
        .then(res => setCheckInState(res))
        .catch(() => {});
    }
  }, [user]);

  const streakDays = checkInState?.currentStreak || 0;
  const todayClaimed = Boolean(checkInState?.todayClaimed);

  // 7-day sequential claim: Day 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7
  const nextDayToClaim = (streakDays % 7) + 1;

  const rewards = checkInState?.rewards || [
    { day: 1, asset: 'USDT', amount: 0.01 },
    { day: 2, asset: 'USDT', amount: 0.02 },
    { day: 3, asset: 'USDT', amount: 0.03 },
    { day: 4, asset: 'E4F', amount: 3.0 },
    { day: 5, asset: 'E4F', amount: 5.0 },
    { day: 6, asset: 'USDT', amount: 0.05 },
    { day: 7, asset: 'USDT', amount: 0.07 },
  ];

  const todayReward = rewards.find(r => r.day === nextDayToClaim) || rewards[0];

  // Active claimed days in the current 7-day cycle
  const activeClaimedDays = todayClaimed
    ? Array.from({ length: streakDays }, (_, i) => i + 1)
    : (streakDays === 7 ? [] : Array.from({ length: streakDays }, (_, i) => i + 1));

  const handleClaimDaily = async () => {
    if (!user || claimingCheckIn || todayClaimed) return;
    setClaimingCheckIn(true);

    const prevSnapshot = checkInState;
    const optimisticDay = nextDayToClaim;
    const optimisticTodayReward = todayReward;

    // ⚡ Optimistic UI: Immediately update the modal state & trigger celebration toast
    setCheckInState(prev => ({
      ...prev,
      currentStreak: optimisticDay,
      todayClaimed: true,
      claimedDays: Array.from({ length: optimisticDay }, (_, i) => i + 1),
      rewards: prev?.rewards || rewards,
      lastCheckInDate: new Date().toISOString().split('T')[0],
      nextDayToClaim: (optimisticDay % 7) + 1,
    }));

    addToast(
      'Daily Check-in Claimed!',
      `Day ${optimisticDay} reward: +${optimisticTodayReward.amount} ${optimisticTodayReward.asset}!`,
      'success'
    );

    try {
      const res = await api.claimDailyCheckIn(user.id);
      if (res.success) {
        const streak = res.streak || res.current_day || optimisticDay;
        setCheckInState(prev => ({
          ...prev,
          currentStreak: streak,
          todayClaimed: true,
          claimedDays: res.claimedDays || Array.from({ length: streak }, (_, i) => i + 1),
          rewards: prev?.rewards || rewards,
          lastCheckInDate: res.lastCheckInDate || new Date().toISOString().split('T')[0],
          nextDayToClaim: res.nextDayToClaim || ((streak % 7) + 1),
        }));
        refreshProfile().catch(() => {});
      }
    } catch (err: any) {
      // Rollback to previous state if backend returns error
      setCheckInState(prevSnapshot);
      addToast('Check-in Notice', err.message || 'Already claimed today', 'error');
    } finally {
      setClaimingCheckIn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-sm bg-[#0C1426] border border-slate-700/80 rounded-3xl p-6 text-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Glow ambient background */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-black text-white leading-tight">Daily check in</h3>
            <p className="text-[11px] text-slate-400">7-Day consecutive rewards: 7 days, 7 claims</p>
          </div>
        </div>

        {/* Streak Stats Banner */}
        <div className="my-3 p-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-sky-500/10 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Streak Progress</div>
              <div className="text-sm font-black text-white font-mono">
                {todayClaimed ? `${streakDays} of 7 Days Claimed` : `Day ${nextDayToClaim} of 7 Ready`}
              </div>
            </div>
          </div>
          <div className="text-right">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                todayClaimed
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
              }`}
            >
              {todayClaimed ? `✓ Claimed Today` : `Ready: Day ${nextDayToClaim}`}
            </span>
            {todayClaimed && timeUntilReset && (
              <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                Next in {timeUntilReset}
              </div>
            )}
          </div>
        </div>

        {/* 7-Day Daily Check-in Streak Grid */}
        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 mb-4">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Gift className="w-3.5 h-3.5 text-amber-400" />
              <span>7-Day Reward Calendar</span>
            </span>
            <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3 text-amber-400" />
              <span>Resets 00:00 UTC</span>
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 mb-3.5">
            {rewards.map(r => {
              const isClaimed = activeClaimedDays.includes(r.day);
              const isToday = !todayClaimed && r.day === nextDayToClaim;

              return (
                <div
                  key={r.day}
                  className={`p-1.5 rounded-xl text-center border transition-all relative ${
                    isClaimed
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-sm'
                      : isToday
                      ? 'bg-amber-500/25 border-amber-400 text-amber-300 ring-2 ring-amber-400/50 scale-105 shadow-md shadow-amber-500/20'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-400'
                  }`}
                >
                  <div className="text-[9px] font-bold uppercase tracking-tight flex items-center justify-center gap-0.5">
                    {isClaimed ? (
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                    ) : isToday ? (
                      <Flame className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                    ) : (
                      <Lock className="w-2 h-2 text-slate-600 shrink-0" />
                    )}
                    <span>D{r.day}</span>
                  </div>
                  <div className="text-[10px] font-black mt-0.5 font-mono truncate">
                    {r.amount}
                  </div>
                  <div
                    className={`text-[8px] font-bold ${
                      r.asset === 'USDT' ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {r.asset}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Claim Button */}
          <button
            onClick={handleClaimDaily}
            disabled={claimingCheckIn || todayClaimed}
            className={`w-full py-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-lg ${
              todayClaimed
                ? 'bg-slate-800/80 text-slate-400 border border-slate-700/50 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 text-slate-950 shadow-amber-500/25 ring-1 ring-amber-300/30'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {claimingCheckIn
                ? `Claiming Day ${nextDayToClaim}...`
                : todayClaimed
                ? streakDays === 7
                  ? `✓ 7-Day Cycle Complete! (Next in ${timeUntilReset || 'Tomorrow'})`
                  : `✓ Day ${streakDays} Claimed (Next in ${timeUntilReset || 'Tomorrow'})`
                : `Claim Day ${nextDayToClaim} Reward (+${todayReward.amount} ${todayReward.asset})`}
            </span>
          </button>
        </div>

        {/* Footer info note */}
        <p className="text-[10px] text-slate-400 text-center leading-relaxed">
          Claim each day to receive all 7 rewards in sequence (Day 1 through Day 7). After Day 7 is claimed, the next cycle smoothly restarts!
        </p>
      </div>
    </div>
  );
};
