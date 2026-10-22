import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Play,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../services/api';
import { TaskItem } from '../../types';

interface TaskTimerModalProps {
  task: TaskItem;
  userId: string;
  onComplete: () => void;
  onClose: () => void;
}

interface StoredTaskTimer {
  taskId: string;
  accumulatedSeconds: number;
  durationSeconds: number;
  lastUpdated: number;
  isCompleted: boolean;
}

const getStorageKey = (userId: string, taskId: string) => `task_timer_${userId}_${taskId}`;

export const TaskTimerModal: React.FC<TaskTimerModalProps> = ({
  task,
  userId,
  onComplete,
  onClose,
}) => {
  const durationSeconds = Math.max(5, task.durationSeconds || 30);
  const targetUrl = task.actionUrl || task.url || '#';
  const isVideoPlatform = ['YOUTUBE', 'TIKTOK', 'VIDEO'].includes((task.platform || '').toUpperCase());
  const actionNoun = isVideoPlatform ? 'Watch' : 'Visit';

  // Modal lifecycle steps
  const [step, setStep] = useState<'READY' | 'WATCHING' | 'EARLY_EXIT' | 'COMPLETED' | 'VERIFYING'>('READY');
  const [secondsWatched, setSecondsWatched] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const accumulatedSecondsRef = useRef<number>(0);
  const currentBurstStartTimeRef = useRef<number | null>(null);
  const timerRef = useRef<any>(null);
  const openedWindowRef = useRef<Window | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const hasStartedRef = useRef<boolean>(false);
  const isClaimingRef = useRef<boolean>(false);

  // Helper to persist timer state in localStorage
  const saveProgress = useCallback(
    (accumulated: number, completed = false) => {
      try {
        const payload: StoredTaskTimer = {
          taskId: task.id,
          accumulatedSeconds: accumulated,
          durationSeconds,
          lastUpdated: Date.now(),
          isCompleted: completed,
        };
        localStorage.setItem(getStorageKey(userId, task.id), JSON.stringify(payload));
      } catch (err) {
        console.warn('Could not save task timer to localStorage:', err);
      }
    },
    [userId, task.id, durationSeconds]
  );

  // 1. Initialize from localStorage
  useEffect(() => {
    isMountedRef.current = true;
    try {
      const raw = localStorage.getItem(getStorageKey(userId, task.id));
      if (raw) {
        const parsed: StoredTaskTimer = JSON.parse(raw);
        if (parsed && typeof parsed.accumulatedSeconds === 'number') {
          const acc = Math.min(durationSeconds, Math.max(0, parsed.accumulatedSeconds));
          accumulatedSecondsRef.current = acc;
          setSecondsWatched(acc);

          if (acc >= durationSeconds || parsed.isCompleted) {
            setStep('COMPLETED');
            return;
          } else if (acc > 0) {
            // Previously started and paused early
            hasStartedRef.current = true;
            setStep('EARLY_EXIT');
            return;
          }
        }
      }
    } catch (err) {
      console.warn('Could not load task timer from localStorage:', err);
    }

    setStep('READY');

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [userId, task.id, durationSeconds]);

  // 2. Visibility change & Focus event listener (smooth synchronization, freeze if user returns early)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!isMountedRef.current || !hasStartedRef.current || !currentBurstStartTimeRef.current) return;

      if (document.visibilityState === 'visible') {
        const burstElapsed = Math.floor((Date.now() - currentBurstStartTimeRef.current) / 1000);
        const accumulated = Math.min(durationSeconds, accumulatedSecondsRef.current + burstElapsed);
        setSecondsWatched(accumulated);
        saveProgress(accumulated, accumulated >= durationSeconds);

        if (accumulated >= durationSeconds) {
          accumulatedSecondsRef.current = durationSeconds;
          currentBurstStartTimeRef.current = null;
          if (timerRef.current) clearInterval(timerRef.current);
          setStep('COMPLETED');
        } else {
          // User returned before completing full duration (e.g. 10s of 30s)
          // Stop timer right here, freeze time, show remaining seconds, require user to continue!
          accumulatedSecondsRef.current = accumulated;
          currentBurstStartTimeRef.current = null;
          if (timerRef.current) clearInterval(timerRef.current);
          setStep('EARLY_EXIT');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [durationSeconds, saveProgress]);

  // 3. User clicks "Visit / Watch" or "Continue"
  const handleStartOrResume = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    hasStartedRef.current = true;

    // Open target link in NEW TAB (no iframe, prevents CSP / X-Frame-Options blocking)
    let newWin: Window | null = null;
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.openLink) {
      try {
        (window as any).Telegram.WebApp.openLink(targetUrl);
      } catch {
        newWin = window.open(targetUrl, '_blank');
      }
    } else {
      newWin = window.open(targetUrl, '_blank');
    }
    openedWindowRef.current = newWin;

    const now = Date.now();
    currentBurstStartTimeRef.current = now;

    // Notify backend
    api.startTaskTimer(userId, task.id, accumulatedSecondsRef.current).catch(console.warn);

    setStep('WATCHING');

    // Run active progress tick
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!currentBurstStartTimeRef.current || !isMountedRef.current) return;

      const currentBurst = Math.floor((Date.now() - currentBurstStartTimeRef.current) / 1000);
      const total = Math.min(durationSeconds, accumulatedSecondsRef.current + currentBurst);
      setSecondsWatched(total);

      if (total >= durationSeconds) {
        clearInterval(timerRef.current);
        accumulatedSecondsRef.current = durationSeconds;
        currentBurstStartTimeRef.current = null;
        saveProgress(durationSeconds, true);
        setStep('COMPLETED');
      }
    }, 500);
  };

  // 4. Claim Reward once completed
  const handleClaimReward = async () => {
    if (isClaimingRef.current) return;
    isClaimingRef.current = true;
    setStep('VERIFYING');
    setErrorMsg(null);

    try {
      const res = await api.verifyTaskTimer(userId, task.id, accumulatedSecondsRef.current);
      if (res.success) {
        try {
          localStorage.removeItem(getStorageKey(userId, task.id));
        } catch {
          // Ignore storage clean err
        }
        onComplete();
        onClose();
      } else {
        throw new Error(res.error || 'Verification failed');
      }
    } catch (err: any) {
      isClaimingRef.current = false;
      if (!isMountedRef.current) return;
      setStep('EARLY_EXIT');
      setErrorMsg(err.message || `Verification incomplete. Full ${durationSeconds}s required.`);
    }
  };

  const remainingSeconds = Math.max(0, durationSeconds - secondsWatched);
  const progressPercent = Math.min(100, Math.round((secondsWatched / durationSeconds) * 100));

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-sm bg-[#0C1326] border border-amber-500/40 rounded-3xl p-6 text-center shadow-2xl overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-20 bg-amber-500/20 blur-2xl pointer-events-none" />

        {/* Close Button */}
        {step !== 'VERIFYING' && (
          <button
            onClick={() => {
              if (timerRef.current) clearInterval(timerRef.current);
              if (currentBurstStartTimeRef.current) {
                const burst = Math.floor((Date.now() - currentBurstStartTimeRef.current) / 1000);
                const total = Math.min(durationSeconds, accumulatedSecondsRef.current + burst);
                accumulatedSecondsRef.current = total;
                saveProgress(total, total >= durationSeconds);
              }
              onClose();
            }}
            title="Close"
            className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Modal Category Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-500/30 text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-2">
          <span>{task.platform || 'TASK'}</span>
          <span>•</span>
          <span>{durationSeconds}s Timer Verification</span>
        </div>

        {/* Modal Title & Description */}
        <h3 className="text-lg font-black text-white mb-1">{task.title}</h3>
        <p className="text-xs text-slate-400 mb-2 leading-relaxed">{task.description}</p>

        {/* Reward Hint Box */}
        <div className="mb-4 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-center justify-center gap-1.5">
          <span className="text-amber-400 font-bold">Reward:</span>
          <span className="font-mono font-extrabold text-amber-300">
            +{task.rewardAmount} {task.rewardAsset}
          </span>
        </div>

        {/* STATE: READY */}
        {step === 'READY' && (
          <div className="py-2 flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
              <Play className="w-8 h-8 fill-amber-400 ml-0.5" />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-extrabold text-amber-300 uppercase tracking-wide">
                {actionNoun.toUpperCase()} FULL {durationSeconds}S TO GET REWARD
              </div>
              <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                COMPLETE TIMER TO EARN REWARD
              </div>
            </div>

            <p className="text-[11px] text-slate-400 px-2 leading-relaxed">
              Tap below to open in a new tab. Remain on the page for the full {durationSeconds} seconds to unlock your reward.
            </p>

            <button
              onClick={handleStartOrResume}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>
                Start {actionNoun} ({durationSeconds}s)
              </span>
            </button>
          </div>
        )}

        {/* STATE: WATCHING */}
        {step === 'WATCHING' && (
          <div className="py-2 flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
              <Play className="w-7 h-7 fill-amber-400 animate-pulse ml-0.5" />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-extrabold text-amber-300 uppercase tracking-wide">
                {actionNoun.toUpperCase()} IN PROGRESS
              </div>
              <div className="text-[11px] font-semibold text-amber-400/90 uppercase tracking-wider">
                COUNTDOWN RUNNING • PLEASE WAIT
              </div>
            </div>

            {/* Live Watch Timer Card */}
            <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-2 mt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>{actionNoun} Time:</span>
                </span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {remainingSeconds > 0 ? `${remainingSeconds}s remaining` : `${durationSeconds}s Completed!`}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <p className="text-[10px] text-slate-400 pt-1">
                Timer runs automatically. Stay on the tab or view here until completed.
              </p>
            </div>

            {/* Re-open / Return to Page button */}
            <button
              onClick={handleStartOrResume}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700 active:scale-95"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Return to {actionNoun} Tab</span>
            </button>
          </div>
        )}

        {/* STATE: EARLY_EXIT */}
        {step === 'EARLY_EXIT' && (
          <div className="py-2 flex flex-col items-center justify-center gap-3 animate-in fade-in">
            {/* Amber icon with glow - matches Screenshot 1 */}
            <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mx-auto shadow-inner">
              <Clock className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-extrabold text-amber-300 uppercase tracking-wide">
                TASK {actionNoun.toUpperCase()} PAUSED
              </div>
              <div className="text-[11px] font-semibold text-slate-300">
                Watched <span className="text-amber-400 font-bold">{secondsWatched}s</span> of {durationSeconds}s required.
              </div>
            </div>

            {errorMsg && <p className="text-[11px] text-amber-400 px-2">{errorMsg}</p>}

            {/* Prominent Resume Button - matches Screenshot 1 */}
            <button
              onClick={handleStartOrResume}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs shadow-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>
                Continue {actionNoun} ({remainingSeconds}s remaining)
              </span>
            </button>

            <p className="text-[10px] text-slate-500 pt-1">
              Time is paused. Click above to continue watching until completed.
            </p>
          </div>
        )}

        {/* STATE: COMPLETED */}
        {step === 'COMPLETED' && (
          <div className="py-2 flex flex-col items-center justify-center gap-3 animate-in fade-in">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto shadow-inner">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-extrabold text-emerald-300 uppercase tracking-wide">
                {actionNoun.toUpperCase()} COMPLETED!
              </div>
              <div className="text-[11px] font-semibold text-slate-300">
                You completed the full {durationSeconds}s {actionNoun.toLowerCase()}. Reward is now unlocked!
              </div>
            </div>

            <button
              onClick={handleClaimReward}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-slate-950" />
              <span>
                Claim +{task.rewardAmount} {task.rewardAsset} Reward
              </span>
            </button>
          </div>
        )}

        {/* STATE: VERIFYING */}
        {step === 'VERIFYING' && (
          <div className="py-6 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            <div className="text-xs text-slate-300 font-medium">Verifying and crediting reward...</div>
          </div>
        )}
      </div>
    </div>
  );
};
