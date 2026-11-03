import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, ExternalLink } from 'lucide-react';
import { api } from '../../services/api';
import { TaskItem } from '../../types';

interface PushWatchCardProps {
  task: TaskItem;
  userId: string;
  // epoch ms until which no new ad may start (30s rest after the last reward)
  cooldownUntil: number;
  addToast: (title: string, msg: string, type?: any) => void;
  onRewarded: (res: any) => void;
}

type Phase = 'idle' | 'waiting' | 'timer' | 'ready' | 'claiming';

// Daily "Watch" task (RichAds push-style). The user taps Watch -> a notification appears ->
// tapping it opens the offer outside Telegram -> when the app is open again the wait time runs
// and the reward can be claimed. Resets every UTC day.
export const PushWatchCard: React.FC<PushWatchCardProps> = ({ task, userId, cooldownUntil, addToast, onRewarded }) => {
  const storeKey = `e4f_push_${userId}_${task.id}`;
  const [phase, setPhase] = useState<Phase>('idle');
  const [token, setToken] = useState<string>('');
  const [startedAt, setStartedAt] = useState<number>(0);
  const [now, setNow] = useState<number>(Date.now());
  const nonce = useRef(0);
  const dur = Math.max(10, Math.min(120, task.durationSeconds || 30));

  // restore a started session (the app may reload after returning from the offer)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw) {
        const o = JSON.parse(raw);
        if (o && o.token && Date.now() - o.startedAt < 30 * 60 * 1000) {
          setToken(o.token);
          setStartedAt(o.startedAt);
          setPhase('timer');
        } else {
          localStorage.removeItem(storeKey);
        }
      }
    } catch {}
  }, [storeKey]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const left = phase === 'timer' ? Math.max(0, Math.ceil(dur - (now - startedAt) / 1000)) : 0;
  useEffect(() => {
    if (phase === 'timer' && left <= 0) setPhase('ready');
  }, [phase, left]);

  const restSec = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  const handleWatch = () => {
    if (phase !== 'idle') return;
    if (restSec > 0) {
      addToast('Please rest', `Next ad is available in ${restSec}s.`, 'info');
      return;
    }
    const ctrl: any = (window as any).TelegramAdsController;
    if (!ctrl || typeof ctrl.triggerNativeNotification !== 'function') {
      addToast('Ad not available', 'No ad is available right now. Please try again later.', 'error');
      return;
    }
    const my = ++nonce.current;
    setPhase('waiting');
    // If the user never taps the notification, return to the Watch button after 2 minutes.
    const giveUp = setTimeout(() => { if (nonce.current === my) setPhase(p => (p === 'waiting' ? 'idle' : p)); }, 120000);
    let p: any;
    try { p = ctrl.triggerNativeNotification(); } catch { p = null; }
    if (!p || typeof p.then !== 'function') {
      clearTimeout(giveUp);
      setPhase('idle');
      addToast('Ad not available', 'No ad is available right now. Please try again later.', 'error');
      return;
    }
    p.then(async () => {
      clearTimeout(giveUp);
      if (nonce.current !== my) return;
      try {
        const r = await api.pushWatchStart(userId, task.id);
        const t0 = Date.now();
        setToken(r.pushToken);
        setStartedAt(t0);
        setPhase('timer');
        try { localStorage.setItem(storeKey, JSON.stringify({ token: r.pushToken, startedAt: t0 })); } catch {}
      } catch (e: any) {
        setPhase('idle');
        addToast('Task', e?.message || 'Could not start. Please try again.', 'error');
      }
    }).catch(() => {
      clearTimeout(giveUp);
      if (nonce.current !== my) return;
      setPhase('idle');
      addToast('Ad not available', 'No ad is available right now. Please try again later.', 'error');
    });
  };

  const handleClaim = async () => {
    if (phase !== 'ready') return;
    setPhase('claiming');
    try {
      const res = await api.pushWatchClaim(userId, task.id, token);
      try { localStorage.removeItem(storeKey); } catch {}
      setPhase('idle');
      setToken('');
      onRewarded(res);
    } catch (e: any) {
      const msg = e?.message || 'Could not claim.';
      addToast('Task Incomplete', msg, 'error');
      if (/expired|start the ad again|Already completed/i.test(msg)) {
        try { localStorage.removeItem(storeKey); } catch {}
        setPhase('idle');
        setToken('');
      } else {
        setPhase('ready');
      }
    }
  };

  return (
    <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2.5 transition-all shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-1.5 font-bold text-xs text-white mb-0.5">
            <span>{task.title}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold uppercase tracking-wider">
              {task.platform || 'WATCH'}
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold uppercase tracking-wider">
              Daily
            </span>
          </div>
          <p className="text-[10px] text-slate-400 leading-snug">{task.description}</p>
        </div>
        <div className="text-[11px] font-extrabold text-amber-400 font-mono shrink-0">
          +{task.rewardAmount} {task.rewardAsset}
        </div>
      </div>

      <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
        <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
          {phase === 'waiting' ? (
            <span className="text-sky-400 font-bold flex items-center gap-1">
              <Clock className="w-3 h-3 animate-pulse" />
              <span>Tap the notification…</span>
            </span>
          ) : phase === 'timer' ? (
            <span className="text-amber-400 font-bold flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Wait {left}s</span>
            </span>
          ) : phase === 'ready' || phase === 'claiming' ? (
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Ready to Claim</span>
            </span>
          ) : restSec > 0 ? (
            <span className="text-amber-400 font-bold flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Rest {restSec}s</span>
            </span>
          ) : (
            <span>Resets daily 00:00 UTC</span>
          )}
        </div>

        {phase === 'ready' || phase === 'claiming' ? (
          <button
            onClick={handleClaim}
            disabled={phase === 'claiming'}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 text-xs font-black shadow-md shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{phase === 'claiming' ? 'Checking...' : 'Claim'}</span>
          </button>
        ) : (
          <button
            onClick={handleWatch}
            disabled={phase !== 'idle' || restSec > 0}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 active:scale-95 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ExternalLink className="w-3 h-3 text-slate-950" />
            <span>Watch ({dur}s)</span>
          </button>
        )}
      </div>
    </div>
  );
};
