import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, ExternalLink } from 'lucide-react';
import { api } from '../../services/api';
import { TaskItem } from '../../types';

interface CooldownVisitCardProps {
  task: TaskItem;
  userId: string;
  // epoch ms when the next visit is allowed (0 = now)
  availableAt: number;
  addToast: (title: string, msg: string, type?: any) => void;
  onRewarded: (res: any) => void;
}

type Phase = 'idle' | 'timer' | 'ready' | 'claiming' | 'starting';

function fmt(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// Direct-link visit task: the user opens the link, waits the set time, then claims. It comes back after a cooldown.
export const CooldownVisitCard: React.FC<CooldownVisitCardProps> = ({ task, userId, availableAt, addToast, onRewarded }) => {
  const storeKey = `e4f_visit_${userId}_${task.id}`;
  const [phase, setPhase] = useState<Phase>('idle');
  const [token, setToken] = useState('');
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const dur = Math.max(5, Math.min(600, task.durationSeconds || 15));

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

  const waitSec = Math.max(0, Math.ceil((availableAt - now) / 1000));

  const openLink = (url: string) => {
    try {
      if ((window as any).Telegram?.WebApp?.openLink) {
        (window as any).Telegram.WebApp.openLink(url);
        return;
      }
    } catch {}
    try { window.open(url, '_blank'); } catch {}
  };

  const handleVisit = async () => {
    if (phase !== 'idle' || waitSec > 0) return;
    setPhase('starting');
    try {
      const r = await api.visitStart(userId, task.id);
      const t0 = Date.now();
      setToken(r.visitToken);
      setStartedAt(t0);
      setPhase('timer');
      try { localStorage.setItem(storeKey, JSON.stringify({ token: r.visitToken, startedAt: t0 })); } catch {}
      openLink(task.url);
    } catch (e: any) {
      setPhase('idle');
      addToast('Task', e?.message || 'Could not start. Please try again.', 'error');
    }
  };

  const handleClaim = async () => {
    if (phase !== 'ready') return;
    setPhase('claiming');
    try {
      const res = await api.visitClaim(userId, task.id, token);
      try { localStorage.removeItem(storeKey); } catch {}
      setPhase('idle');
      setToken('');
      onRewarded(res);
    } catch (e: any) {
      const msg = e?.message || 'Could not claim.';
      addToast('Task Incomplete', msg, 'error');
      if (/expired|start the visit again|already rewarded|limit|wait before/i.test(msg)) {
        try { localStorage.removeItem(storeKey); } catch {}
        setPhase('idle');
        setToken('');
      } else {
        setPhase('ready');
      }
    }
  };

  const perUser = Number(task.perUserDaily) || 0;

  return (
    <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2.5 transition-all shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-1.5 font-bold text-xs text-white mb-0.5">
            <span>{task.title}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold uppercase tracking-wider">
              {task.platform || 'WEBSITE'}
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
          {phase === 'timer' ? (
            <span className="text-amber-400 font-bold flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Wait {left}s</span>
            </span>
          ) : phase === 'ready' || phase === 'claiming' ? (
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Ready to Claim</span>
            </span>
          ) : waitSec > 0 ? (
            <span className="text-amber-400 font-bold flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Available in {fmt(waitSec)}</span>
            </span>
          ) : (
            <span>{task.dailyVisit || perUser === 1 ? 'Resets daily 00:00 UTC' : perUser > 0 ? `Today ${Math.min(task.visitsToday || 0, perUser)}/${perUser}` : 'Available'}</span>
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
            onClick={handleVisit}
            disabled={phase !== 'idle' || waitSec > 0}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 active:scale-95 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ExternalLink className="w-3 h-3 text-slate-950" />
            <span>Visit ({dur}s)</span>
          </button>
        )}
      </div>
    </div>
  );
};
