import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldCheck, CheckCircle2, AlertTriangle, X, Play, Loader2, Clock, ExternalLink } from 'lucide-react';
import { api } from '../../services/api';
import { getAdTargetUrl, DEFAULT_ZONE_ID, DEFAULT_DIRECT_LINK } from '../../services/monetagSdk';
import { blockExternalRedirect, generateAdToken, verifyAdWatch } from '../../services/antiFakeAds';
import AdInside from '../AdInside';
import AdWaterfall from '../AdWaterfall';

function getMiningAdScript(provider?: string, zoneId?: string | number): string {
  const z = String(zoneId || '410204');
  if (provider === 'RichAds' || z.startsWith('4102')) {
    return `<script src="https://richinfo.co/richpartners/telegram/js/tg-ob.js?pubId=1025839&appId=9319"></script>
<script>
  try {
    if (window.TelegramAdsController) window.TelegramAdsController.showRewardedAd(${z});
  } catch(e) {}
</script>
<div style="padding: 24px 16px; text-align: center; color: #fff; font-family: sans-serif;">
  <div style="font-size: 16px; font-weight: 800; color: #F59E0B; margin-bottom: 8px;">RichAds In-App Mining Sponsor</div>
  <div style="font-size: 12px; color: #94A3B8;">Zone ID: ${z} • 100% In-App</div>
</div>`;
  }
  if (provider === 'Monetag' || z === '12044377') {
    return `<script src="//gizokraijaw.net/400/12044377.js" async></script>
<script src="https://libtl.com/sdk.js" data-zone="12044377" data-sdk="show_12044377"></script>
<script>
  try {
    if (window.show_12044377) window.show_12044377();
  } catch(e) {}
</script>
<div style="padding: 24px 16px; text-align: center; color: #fff; font-family: sans-serif;">
  <div style="font-size: 16px; font-weight: 800; color: #38BDF8; margin-bottom: 8px;">Monetag In-App Mining Sponsor</div>
  <div style="font-size: 12px; color: #94A3B8;">Zone ID: 12044377 • 100% In-App</div>
</div>`;
  }
  return `<iframe src="https://highperformanceformat.com/${z}" style="width:100%;height:380px;border:none;"></iframe>`;
}

declare global {
  interface Window {
    showMonetagInsideTelegram?: () => Promise<boolean>;
    showRichAdsInTelegram?: (richadsId?: string | number) => Promise<boolean>;
    show_12044377?: any;
    TelegramAdsController?: any;
  }
}

export interface AdSessionData {
  sessionId: string;
  token: string;
  startedAt: number;
  endsAt: number;
  durationSeconds: number;
  remainingSeconds: number;
  serverTime: number;
  canVerify?: boolean;
  verified?: boolean;
  provider?: string;
  zoneId?: string;
  directLink?: string;
}

interface RewardedAdModalProps {
  userId: string;
  providerName?: string;
  durationSeconds?: number;
  initialSessionData?: AdSessionData | null;
  onAdVerified: (adSessionId: string) => void;
  onCancel: () => void;
}

const REQUIRED_MINING_SECONDS = 60;

export const RewardedAdModal: React.FC<RewardedAdModalProps> = ({
  userId,
  providerName = 'MONETAG',
  durationSeconds = REQUIRED_MINING_SECONDS,
  initialSessionData,
  onAdVerified,
  onCancel,
}) => {
  const [step, setStep] = useState<'READY' | 'WATCHING' | 'EARLY_EXIT' | 'COMPLETED' | 'VERIFYING' | 'FAILED'>('READY');
  const [sessionData, setSessionData] = useState<AdSessionData | null>(initialSessionData || null);
  const [secondsWatched, setSecondsWatched] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Accumulated seconds watched across multiple opens (if user returns early and continues)
  const totalWatchedSecondsRef = useRef<number>(0);
  // Current watch burst start time
  const currentBurstStartTimeRef = useRef<number | null>(null);
  const timerRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);
  const hasStartedRef = useRef<boolean>(false);
  const isVerifyingRef = useRef<boolean>(false);

  // Initialize session on mount
  useEffect(() => {
    isMountedRef.current = true;
    if (!initialSessionData) {
      api
        .createAdSession(userId)
        .then((data: any) => {
          if (!isMountedRef.current) return;
          setSessionData(data);
        })
        .catch((err: any) => {
          if (!isMountedRef.current) return;
          setErrorMsg(err.message || 'Failed to initialize mining ad session.');
          setStep('FAILED');
        });
    }

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [userId, initialSessionData]);

  // Safe Cancel on Back Button or 'X'
  const handleCancel = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (sessionData) {
      api.cancelAdSession(sessionData.sessionId, sessionData.token, userId);
    }
    onCancel();
  }, [sessionData, userId, onCancel]);

  // Listen to browser / Android back button
  useEffect(() => {
    const handlePopState = () => {
      handleCancel();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [handleCancel]);

  // Forward declaration of triggerAutoVerify to be used in timer & visibility handler
  const triggerAutoVerifyRef = useRef<() => void>(() => {});

  // Monitor visibility (when user returns from the ad tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!hasStartedRef.current || !currentBurstStartTimeRef.current) return;

      if (document.visibilityState === 'visible') {
        const currentBurstElapsed = Math.floor((Date.now() - currentBurstStartTimeRef.current) / 1000);
        const accumulated = Math.min(
          REQUIRED_MINING_SECONDS,
          totalWatchedSecondsRef.current + currentBurstElapsed
        );
        setSecondsWatched(accumulated);

        if (accumulated >= REQUIRED_MINING_SECONDS) {
          totalWatchedSecondsRef.current = REQUIRED_MINING_SECONDS;
          currentBurstStartTimeRef.current = null;
          if (timerRef.current) clearInterval(timerRef.current);
          setStep('COMPLETED');
          triggerAutoVerifyRef.current();
        } else {
          totalWatchedSecondsRef.current = accumulated;
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
  }, []);

  // User Clicks "Watch Ad Now" or "Continue Watching"
  const handleAdClick = (e?: React.MouseEvent) => {
    if (!sessionData) return;
    setErrorMsg(null);

    // Block external redirects & initialize token
    blockExternalRedirect();
    generateAdToken();

    const now = Date.now();
    currentBurstStartTimeRef.current = now;

    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      api.startAdWatching(sessionData.sessionId, sessionData.token, userId).catch(console.warn);
      if (sessionData.provider === 'RichAds' || String(sessionData.zoneId).startsWith('4102')) {
        if (typeof window !== 'undefined' && typeof window.showRichAdsInTelegram === 'function') {
          window.showRichAdsInTelegram(sessionData.zoneId || '410204').then((success: boolean) => {
            if (success) {
              totalWatchedSecondsRef.current = REQUIRED_MINING_SECONDS;
              setSecondsWatched(REQUIRED_MINING_SECONDS);
              if (timerRef.current) clearInterval(timerRef.current);
              setStep('COMPLETED');
              triggerAutoVerifyRef.current();
            }
          });
        }
      } else if (typeof window !== 'undefined' && typeof window.showMonetagInsideTelegram === 'function') {
        window.showMonetagInsideTelegram().then((success: boolean) => {
          if (success) {
            totalWatchedSecondsRef.current = REQUIRED_MINING_SECONDS;
            setSecondsWatched(REQUIRED_MINING_SECONDS);
            if (timerRef.current) clearInterval(timerRef.current);
            setStep('COMPLETED');
            triggerAutoVerifyRef.current();
          }
        }).catch(() => {});
      }
    }

    setStep('WATCHING');

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!currentBurstStartTimeRef.current || !isMountedRef.current) return;

      const currentBurst = Math.floor((Date.now() - currentBurstStartTimeRef.current) / 1000);
      const total = Math.min(
        REQUIRED_MINING_SECONDS,
        totalWatchedSecondsRef.current + currentBurst
      );
      setSecondsWatched(total);

      if (total >= REQUIRED_MINING_SECONDS) {
        clearInterval(timerRef.current);
        totalWatchedSecondsRef.current = REQUIRED_MINING_SECONDS;
        setStep('COMPLETED');
        // Auto-verify and start mining immediately
        triggerAutoVerifyRef.current();
      }
    }, 500);
  };

  // Verify and unlock mining
  const handleVerify = async () => {
    const check = verifyAdWatch();
    if (!check.valid) {
      isVerifyingRef.current = false;
      setStep('EARLY_EXIT');
      setErrorMsg(check.reason || 'Fake Report! Watch 30s');
      return;
    }

    if (!sessionData || isVerifyingRef.current) return;
    isVerifyingRef.current = true;
    setStep('VERIFYING');
    setErrorMsg(null);

    try {
      const res = await api.verifyAdSession(sessionData.sessionId, sessionData.token, userId);
      if (res.verified) {
        setStep('COMPLETED');
        setTimeout(() => {
          if (isMountedRef.current) {
            onAdVerified(sessionData.sessionId);
          }
        }, 600);
      } else {
        isVerifyingRef.current = false;
        setStep('FAILED');
        setErrorMsg('Ad completion could not be verified by server.');
      }
    } catch (err: any) {
      isVerifyingRef.current = false;
      if (!isMountedRef.current) return;
      setStep('EARLY_EXIT');
      setErrorMsg(err.message || 'Server could not verify 60-second ad completion. Please complete remaining time.');
    }
  };

  // Assign to ref for auto-trigger
  triggerAutoVerifyRef.current = handleVerify;

  const adUrl = sessionData
    ? getAdTargetUrl(sessionData.directLink, sessionData.zoneId || DEFAULT_ZONE_ID)
    : DEFAULT_DIRECT_LINK;

  const remainingSeconds = Math.max(0, REQUIRED_MINING_SECONDS - secondsWatched);
  const progressPercent = Math.min(100, Math.round((secondsWatched / REQUIRED_MINING_SECONDS) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-sm bg-[#0B1120] border border-amber-500/40 rounded-3xl p-6 text-center shadow-2xl overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-20 bg-amber-500/20 blur-2xl pointer-events-none" />

        {/* Close Button: Cancels session */}
        {step !== 'VERIFYING' && (
          <button
            onClick={handleCancel}
            title="Cancel and Exit"
            className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <h3 className="text-lg font-black text-white mb-1 mt-1">Unlock 8-Hour Mining</h3>
        <p className="text-xs text-slate-400 mb-3">
          Watch the sponsored ad for 60 seconds to activate your mining power.
        </p>

        {/* STATE: READY */}
        {step === 'READY' && (
          <div className="py-2 flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-extrabold text-amber-300 uppercase tracking-wide">
                WATCH FULL ADS TO GET REWARD
              </div>
              <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                WATCH FULL ADS TO UNLOCK MINING
              </div>
            </div>

            <p className="text-[11px] text-slate-400 px-2 leading-relaxed">
              Tap below to open the sponsored ad. You must watch for 60 seconds to unlock mining.
            </p>

            <a
              href={adUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleAdClick}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>Watch Ad Now (60s)</span>
            </a>
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
                WATCH FULL ADS TO GET REWARD
              </div>
              <div className="text-[11px] font-semibold text-amber-400/90 uppercase tracking-wider">
                MINING AD IN PROGRESS • COUNTDOWN RUNNING
              </div>
            </div>

            <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-2 mt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Mining Ad Timer:</span>
                </span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {remainingSeconds > 0 ? `${remainingSeconds}s remaining` : '60s Completed!'}
                </span>
              </div>

              <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <p className="text-[10px] text-slate-400 pt-1">
                Please remain on the sponsored ad. You can also view progress here.
              </p>
            </div>

            {/* 100% In-App Sandboxed Ad Container - NO EXTERNAL REDIRECT */}
            <div className="w-full rounded-xl overflow-hidden border border-slate-800 bg-black mt-2">
              <AdWaterfall house="mining" onAdLoaded={() => {}} />
            </div>
          </div>
        )}

        {/* STATE: EARLY_EXIT */}
        {step === 'EARLY_EXIT' && (
          <div className="py-2 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Clock className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-extrabold text-amber-300 uppercase tracking-wide">
                AD WATCH PAUSED
              </div>
              <div className="text-[11px] font-semibold text-slate-300">
                Watched <span className="text-amber-400 font-bold">{secondsWatched}s</span> of 60s required.
              </div>
            </div>

            {errorMsg && (
              <p className="text-[11px] text-amber-400 px-2">{errorMsg}</p>
            )}

            <a
              href={adUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleAdClick}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs shadow-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>Continue Watching Ad ({remainingSeconds}s remaining)</span>
            </a>
          </div>
        )}

        {/* STATE: COMPLETED */}
        {step === 'COMPLETED' && (
          <div className="py-2 flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-extrabold text-emerald-400 uppercase tracking-wide">
                FULL 60S AD COMPLETED!
              </div>
              <div className="text-xs text-slate-300">
                Starting 8-Hour E4F mining session automatically...
              </div>
            </div>

            <button
              onClick={handleVerify}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Activating Mining Session...</span>
            </button>
          </div>
        )}

        {/* STATE: VERIFYING */}
        {step === 'VERIFYING' && (
          <div className="py-6 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            <div className="text-xs text-emerald-300 font-bold">Verifying Full 60s Ad on Server...</div>
            <div className="text-[10px] text-slate-400">Activating your mining node...</div>
          </div>
        )}

        {/* STATE: FAILED */}
        {step === 'FAILED' && (
          <div className="py-4 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-xs text-rose-300 font-semibold px-2">
              {errorMsg || 'Ad verification failed.'}
            </div>

            <a
              href={adUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleAdClick}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs shadow transition-all cursor-pointer block"
            >
              Watch 60s Ad Again
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
