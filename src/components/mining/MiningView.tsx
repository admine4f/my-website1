import React, { useState, useEffect } from 'react';
import { Pickaxe, Clock, AlertCircle, CheckCircle2, History, Calendar, Shield, Play, Lock, ExternalLink } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MiningCoin3D } from './MiningCoin3D';
import { UnifiedRewardedAdModal } from '../rewards/UnifiedRewardedAdModal';
import { handleMiningWithWaterfall } from '../../services/antiFakeAds';
import { api } from '../../services/api';

export const MiningView: React.FC = () => {
  const { user, balances, activeMiningSession, miningStats, refreshMining, refreshProfile, addToast } = useApp();
  const [showAdModal, setShowAdModal] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [timeLeftSec, setTimeLeftSec] = useState<number>(0);
  const [activeAdSession, setActiveAdSession] = useState<any | null>(null);
  const [adRemainingSeconds, setAdRemainingSeconds] = useState<number>(0);

  // Load history
  useEffect(() => {
    if (user) {
      api.getMiningHistory(user.id).then(res => setHistoryList(res.history)).catch(() => {});
    }
  }, [user, activeMiningSession]);

  // Check and restore active ad session on mount and when mining stats change
  useEffect(() => {
    if (!user) return;

    // Check if miningStats already has activeAdSession
    if (miningStats?.activeAdSession) {
      setActiveAdSession(miningStats.activeAdSession as any);
    } else {
      // Check from server directly to preserve across navigation/remount
      api
        .getActiveAdSession(user.id)
        .then(res => {
          if (res.hasActiveSession && res.session) {
            setActiveAdSession(res.session as any);
          }
        })
        .catch(() => {});
    }
  }, [user, miningStats]);

  // Track active ad verification session timer if active
  useEffect(() => {
    if (!activeAdSession) {
      setAdRemainingSeconds(0);
      return;
    }

    const updateRemaining = () => {
      const serverOffset = (activeAdSession.serverTime || Date.now()) - Date.now();
      const currentServerTime = Date.now() + serverOffset;
      const rem = Math.max(0, Math.ceil((activeAdSession.endsAt - currentServerTime) / 1000));
      setAdRemainingSeconds(rem);
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [activeAdSession]);

  // Server-authoritative timer calculation for active 8-hour mining
  useEffect(() => {
    if (!activeMiningSession || activeMiningSession.status !== 'ACTIVE') {
      setTimeLeftSec(0);
      return;
    }

    const calcTime = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((activeMiningSession.endTime - now) / 1000));
      setTimeLeftSec(remaining);
      if (remaining === 0 && activeMiningSession.status === 'ACTIVE') {
        refreshMining();
      }
    };

    calcTime();
    const interval = setInterval(calcTime, 1000);
    return () => clearInterval(interval);
  }, [activeMiningSession, refreshMining]);

  const formatHoursMinutesSeconds = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const isMiningActive = activeMiningSession?.status === 'ACTIVE' && timeLeftSec > 0;
  const isMiningCompleted = activeMiningSession?.status === 'COMPLETED' || (activeMiningSession?.status === 'ACTIVE' && timeLeftSec === 0);

  // Progress percentage (8 hours = 28800s)
  const totalDuration = activeMiningSession?.durationSeconds || 28800;
  const progressPercent = isMiningActive
    ? Math.min(100, Math.max(0, Math.round(((totalDuration - timeLeftSec) / totalDuration) * 100)))
    : isMiningCompleted
    ? 100
    : 0;

  // Handle Start Mining Button Press
  const handleStartMiningPress = async () => {
    if (!user) return;

    // Check freshest status from server dynamically without app update
    let isAdReq = miningStats?.adRequired ?? true;
    try {
      const pub = await api.getPublicSettings();
      if (pub && pub.rewardedAdRequired !== undefined) {
        isAdReq = pub.rewardedAdRequired;
      }
    } catch {}

    // Check if Mining Ad is ON or OFF in admin control panel
    if (!isAdReq) {
      executeStartMining();
      return;
    }

    // Open 100% In-App Mining Waterfall Ad Modal inside Telegram
    setShowAdModal(true);
  };

  // Called once Ad is verified by server callback
  const handleMiningAdComplete = (adSessionId: string, claimToken: string) => {
    setShowAdModal(false);
    setActiveAdSession(null);
    executeStartMining(adSessionId, claimToken);
  };

  const executeStartMining = async (adSessionId?: string, claimToken?: string) => {
    if (!user) return;
    setLoadingAction(true);
    try {
      const res = await api.startMining(user.id, adSessionId, claimToken);
      if (res.success) {
        addToast('Mining Started!', '8-Hour E4F session is now actively mining.', 'success');
        setActiveAdSession(null);
        await refreshMining();
      }
    } catch (err: any) {
      addToast('Mining Locked', err.message || 'Could not start session', 'error');
    } finally {
      setLoadingAction(false);
    }
  };

  // Handle Manual Claim Reward
  const handleClaimReward = async () => {
    if (!user || !activeMiningSession) return;
    setLoadingAction(true);
    try {
      const res = await api.claimMiningReward(user.id, activeMiningSession.id);
      if (res.success) {
        addToast(
          'Reward Claimed!',
          `+${res.rewardAmount.toFixed(2)} E4F added to your Pre-Listing Balance.`,
          'success'
        );
        await refreshMining();
        await refreshProfile();
      }
    } catch (err: any) {
      addToast('Claim Failed', err.message || 'Reward could not be claimed.', 'error');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-24 pt-2 px-4 max-w-md mx-auto">
      {/* Rewarded Ad Modal with Dynamic Network & Waterfall (RichAds, Monetag, OnClickA) */}
      {showAdModal && user && (
        <UnifiedRewardedAdModal
          userId={user.id}
          actionType="MINING"
          targetId={1}
          durationSeconds={miningStats?.miningAdDurationSeconds || miningStats?.adDurationSeconds || 30}
          title="Start 8-Hour Mining Session"
          description="Complete the rewarded ad to activate your 8-hour continuous E4F cloud mining."
          rewardHint="Active 8-Hour E4F Mining"
          onComplete={handleMiningAdComplete}
          onCancel={() => setShowAdModal(false)}
        />
      )}

      {/* Screen Title & Top Metrics */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-1.5">
            <span className="bg-gradient-to-r from-amber-300 to-sky-300 bg-clip-text text-transparent">
              E4F Mining
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
              Season 1
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Mine E4F daily before Exchange Listing on 28 Feb 2028
          </p>
        </div>

        <button
          onClick={() => setShowHistory(!showHistory)}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex items-center gap-1 text-xs cursor-pointer"
        >
          <History className="w-4 h-4 text-amber-400" />
          <span>History</span>
        </button>
      </div>

      {/* Season 1 Pre-Listing Target Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-amber-950/30 border border-amber-500/30 p-4 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-white tracking-wide uppercase">
              Target Listing Milestone
            </span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
            28 Feb 2028
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-800/80">
          <div>
            <div className="text-[10px] text-slate-400 font-medium">Listing Status</div>
            <div className="text-sm font-extrabold text-amber-400">
              Not Listed Yet
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-400 font-medium">Days Remaining</div>
            <div className="text-base font-extrabold text-sky-400 font-mono">
              {miningStats?.seasonDaysRemaining || 707} Days
            </div>
          </div>
        </div>
      </div>

      {/* Main Mining Stage Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#0F172A] to-[#0A0E1A] border border-slate-800 p-6 shadow-2xl flex flex-col items-center">
        {/* Ambient Top Glow */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-24 bg-amber-500/20 blur-3xl pointer-events-none" />

        {/* 3D Coin Animation */}
        <div className="my-2 relative flex items-center justify-center">
          <MiningCoin3D isActive={isMiningActive} isCompleted={isMiningCompleted} />
        </div>

        {/* Timer & Rate Details */}
        <div className="w-full mt-4 text-center">
          <div className="text-3xl font-black font-mono tracking-tight text-white mb-1">
            {isMiningActive
              ? formatHoursMinutesSeconds(timeLeftSec)
              : isMiningCompleted
              ? '00:00:00'
              : '08:00:00'}
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mb-4">
            <span>Mining Rate:</span>
            <span className="font-bold text-amber-400">
              {miningStats?.miningRatePerHour !== undefined ? miningStats.miningRatePerHour : 0.25} E4F / Hour
            </span>
            {isMiningActive && (
              <>
                <span>•</span>
                <span className="font-semibold text-sky-400">
                  {progressPercent}% Completed
                </span>
              </>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-900 rounded-full h-2.5 p-0.5 border border-slate-800 mb-5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-sky-400 via-amber-400 to-amber-500 h-full rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Active Ad Verification Banner if session in progress */}
          {!isMiningActive && !isMiningCompleted && activeAdSession && (
            <div className="w-full mb-3 p-3 rounded-2xl bg-amber-950/40 border border-amber-500/40 flex items-center justify-between text-left shadow-lg">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30 text-amber-400">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-amber-300">
                    {adRemainingSeconds > 0
                      ? `Mining Locked (${adRemainingSeconds}s left)`
                      : 'Ad 60s Watch Complete'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {adRemainingSeconds > 0
                      ? 'Server 60s ad timer is running'
                      : 'Ready to unlock & start mining'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowAdModal(true)}
                className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
              >
                <span>{adRemainingSeconds > 0 ? 'Resume' : 'Unlock'}</span>
              </button>
            </div>
          )}

          {/* Main Action Button */}
          {isMiningCompleted ? (
            <button
              onClick={handleClaimReward}
              disabled={loadingAction}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5 text-slate-950" />
              <span>CLAIM +{((activeMiningSession?.estimatedReward) || (miningStats?.miningRatePerHour ?? 0.25) * 8).toFixed(2)} E4F REWARD</span>
            </button>
          ) : isMiningActive ? (
            <div className="w-full py-3 px-6 rounded-2xl bg-slate-900/80 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>MINING IN PROGRESS ({formatHoursMinutesSeconds(timeLeftSec)})</span>
            </div>
          ) : activeAdSession && adRemainingSeconds > 0 ? (
            <button
              onClick={() => setShowAdModal(true)}
              className="w-full py-3.5 px-6 rounded-2xl bg-slate-900/90 border border-amber-500/50 hover:border-amber-400 text-amber-300 font-black text-sm shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
            >
              <Lock className="w-5 h-5 text-amber-400" />
              <span>MINING LOCKED ({adRemainingSeconds}s REMAINING)</span>
            </button>
          ) : activeAdSession && adRemainingSeconds === 0 ? (
            <button
              onClick={() => setShowAdModal(true)}
              disabled={loadingAction}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5 text-slate-950" />
              <span>UNLOCK & START 8-HOUR MINING</span>
            </button>
          ) : (
            <button
              onClick={handleStartMiningPress}
              disabled={loadingAction}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
            >
              <Pickaxe className="w-5 h-5 text-slate-950" />
              <span>START 8-HOUR MINING</span>
              {miningStats?.adRequired && (
                <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-950/20 text-slate-950 font-extrabold uppercase">
                  + Ad
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Mining Statistics Grid */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800">
          <div className="text-[10px] text-slate-400 font-semibold mb-1">TODAY'S MINING</div>
          <div className="text-base font-extrabold text-white">
            {miningStats?.todayMiningE4F?.toFixed(2) || '0.00'}
          </div>
          <div className="text-[10px] text-amber-400 font-medium">E4F Earned</div>
        </div>

        <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800">
          <div className="text-[10px] text-slate-400 font-semibold mb-1">ALL-TIME MINED</div>
          <div className="text-base font-extrabold text-emerald-400">
            {miningStats?.totalMiningE4F?.toFixed(2) || '0.00'}
          </div>
          <div className="text-[10px] text-slate-400 font-medium">Total E4F</div>
        </div>

        <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800">
          <div className="text-[10px] text-slate-400 font-semibold mb-1">SESSIONS</div>
          <div className="text-base font-extrabold text-sky-400 font-mono">
            {miningStats?.totalSessionsCompleted || 0}
          </div>
          <div className="text-[10px] text-slate-400 font-medium">Completed</div>
        </div>
      </div>

      {/* Verification Rule Notice Card */}
      <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex items-start gap-3">
        <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <div className="font-bold text-white mb-0.5">Fair Mining Protocol & Ad Security</div>
          E4F mining is protected by server-authoritative ad verification. Client-side clocks, premature claims, and bypass attempts are strictly prevented. You can freely minimize or return to the screen; your timer continues seamlessly.
        </div>
      </div>

      {/* Mining History Drawer */}
      {showHistory && (
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-white uppercase">Completed Sessions</span>
            <span className="text-[10px] text-slate-400">{historyList.length} Total</span>
          </div>

          {historyList.length === 0 ? (
            <p className="text-xs text-slate-500 py-3 text-center">No mining history found yet.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {historyList.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <div>
                      <div className="font-bold text-white">8-Hour Mining</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(item.startTime).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-amber-400">+{item.estimatedReward.toFixed(2)} E4F</div>
                    <div className="text-[10px] text-emerald-400 uppercase font-semibold">
                      {item.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
