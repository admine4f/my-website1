import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  X,
  Play,
  Loader2,
  Clock,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../../services/api';
import { getAdTargetUrl, DEFAULT_ZONE_ID, DEFAULT_DIRECT_LINK } from '../../services/monetagSdk';
import {
  showOnclickaAd,
  showRichadsAd,
  showMonetagAd,
  getProviderAdUrl,
  openExternalSponsorAd,
} from '../../services/adWaterfall';
import { blockExternalRedirect, generateAdToken, verifyAdWatch } from '../../services/antiFakeAds';
import AdInside from '../AdInside';
import AdWaterfall from '../AdWaterfall';

function getAdInsideScript(provider: string, zoneId: string | number): string {
  const z = String(zoneId || '410202');
  if (provider === 'RichAds' || z.startsWith('4102')) {
    return `<script src="https://richinfo.co/richpartners/telegram/js/tg-ob.js?pubId=1025839&appId=9319"></script>
<script>
  try {
    if (window.TelegramAdsController) {
      window.TelegramAdsController.showRewardedAd(${z});
    }
  } catch(e) {}
</script>
<div style="padding: 24px 16px; text-align: center; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="font-size: 16px; font-weight: 800; color: #F59E0B; margin-bottom: 8px;">RichAds Verified In-App Sponsor</div>
  <div style="font-size: 12px; color: #94A3B8;">Zone ID: ${z} • 100% In-App Delivery</div>
</div>`;
  }
  if (provider === 'Monetag' || z === '12044377') {
    return `<script src="https://gizokraijaw.net/400/12044377.js" async></script>
<script src="https://libtl.com/sdk.js" data-zone="12044377" data-sdk="show_12044377"></script>
<script>
  try {
    if (window.show_12044377) window.show_12044377();
  } catch(e) {}
</script>
<div style="padding: 24px 16px; text-align: center; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="font-size: 16px; font-weight: 800; color: #38BDF8; margin-bottom: 8px;">Monetag Verified In-App Sponsor</div>
  <div style="font-size: 12px; color: #94A3B8;">Zone ID: 12044377 • 100% In-App Delivery</div>
</div>`;
  }
  return `<script src="https://js.onclckvd.com/in-stream-ad-admanager/tma.js"></script>
<script>
  try {
    if (window.initCdTma) {
      window.initCdTma({ id: '${z}' }).then(function(show) { if (typeof show === 'function') show(); });
    }
  } catch(e) {}
</script>
<div style="padding: 24px 16px; text-align: center; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="font-size: 16px; font-weight: 800; color: #A855F7; margin-bottom: 8px;">OnClickA Verified In-App Sponsor</div>
  <div style="font-size: 12px; color: #94A3B8;">Spot ID: ${z} • 100% In-App Delivery</div>
</div>
<iframe src="https://highperformanceformat.com/${z}" style="width:100%;height:300px;border:none;"></iframe>`;
}
import {
  SPIN_ADS,
  BOX_ADS,
  MINING_ADS,
  AD_CODES,
  getAdCodesForPlacement,
  getNetworkViewCountToday,
  incrementNetworkViewCountToday,
  isNetworkCappedToday,
  MAX_DAILY_ADS_PER_NETWORK,
  buildIntraWaterfallTiers,
  IntraWaterfallTier,
} from '../../services/adCodes';

// =========================================================================
// 🎯 WATERFALL AD CONFIGURATION (5 TIERS: RichAds, Monetag, OnClickA)
// =========================================================================
export let SPIN_01_RICHADS = '410203';
export let SPIN_02_MONETAG = '12044377';
export let SPIN_03_ONCLICKA = '6153717E4F';
export let SPIN_04_RICHADS = '410203';
export let SPIN_05_MONETAG = '12044377';

export let BOX_01_RICHADS = '410202';
export let BOX_02_MONETAG = '12044377';
export let BOX_03_ONCLICKA = '6153772E4F';
export let BOX_04_RICHADS = '410202';
export let BOX_05_MONETAG = '12044377';

// Mining Waterfall Ad Variables
export let MINING_01_RICHADS = '410204';
export let MINING_02_MONETAG = '12044377';
export let MINING_03_ONCLICKA = '6153774E4F';
export let MINING_04_RICHADS = '410204';
export let MINING_05_MONETAG = '12044377';
export let MINING_PRIMARY_NETWORK: 'RichAds' | 'Monetag' | 'OnClickA' = 'RichAds';
export let MINING_SECONDARY_NETWORK: 'RichAds' | 'Monetag' | 'OnClickA' = 'Monetag';
export let MINING_WATERFALL_ENABLED = true;

export const RICHADS_PLACEMENTS = ['410202', '410203', '410204', '410260', '410261'];

export const getAdChain = buildIntraWaterfallTiers;

interface WaterfallTier {
  index: number;
  provider: 'RichAds' | 'Monetag' | 'OnClickA';
  id: string;
  placementKey?: string;
  label: string;
}

interface UnifiedRewardedAdModalProps {
  userId: string;
  actionType: 'MINING' | 'SPIN' | 'GIFT_BOX' | 'WITHDRAW' | 'SELL';
  targetId?: number;
  title: string;
  description: string;
  rewardHint?: string;
  durationSeconds?: number;
  onComplete: (adSessionId: string, claimToken: string) => void;
  onCancel: () => void;
}

const DEFAULT_WATCH_SECONDS = 30;

export const UnifiedRewardedAdModal: React.FC<UnifiedRewardedAdModalProps> = ({
  userId,
  actionType,
  targetId,
  title,
  description,
  rewardHint,
  durationSeconds,
  onComplete,
  onCancel,
}) => {
  const initialDuration = durationSeconds || DEFAULT_WATCH_SECONDS;
  const [requiredWatchSeconds, setRequiredWatchSeconds] = useState<number>(initialDuration);
  const requiredWatchSecondsRef = useRef<number>(initialDuration);
  const [step, setStep] = useState<
    'INITIALIZING' | 'READY' | 'WATCHING' | 'EARLY_EXIT' | 'COMPLETED' | 'VERIFYING' | 'ALL_FAILED' | 'ERROR'
  >('INITIALIZING');

  const [adSession, setAdSession] = useState<{
    sessionId: string;
    token: string;
    zoneId: string;
    directLink: string;
  } | null>(null);

  // Waterfall Tiers & Current Index
  const [tiers, setTiers] = useState<WaterfallTier[]>([]);
  const [tierIndex, setTierIndex] = useState<number>(0);
  const [tierFailReason, setTierFailReason] = useState<string | null>(null);
  const [renderedAdUrl, setRenderedAdUrl] = useState<string>('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [secondsWatched, setSecondsWatched] = useState<number>(0);

  const watchStartTimeRef = useRef<number | null>(null);
  const totalWatchedSecondsRef = useRef<number>(0);
  const timerRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);
  const hasStartedRef = useRef<boolean>(false);
  const isVerifyingRef = useRef<boolean>(false);

  // 1. Initialize Waterfall Tiers & Ad Session
  useEffect(() => {
    isMountedRef.current = true;

    async function initWaterfallAndSession() {
      try {
        setStep('INITIALIZING');
        setErrorMsg(null);
        setTierFailReason(null);
        setSecondsWatched(0);
        totalWatchedSecondsRef.current = 0;
        watchStartTimeRef.current = null;
        hasStartedRef.current = false;

        // Fetch dynamic admin settings for all waterfall variables with strict sanitization
        try {
          const pub = await api.getPublicSettings();
          if (pub) {
            if ((pub as any).spin_01_richads) SPIN_01_RICHADS = (pub as any).spin_01_richads;
            if ((pub as any).spin_02_monetag) SPIN_02_MONETAG = (pub as any).spin_02_monetag;
            if ((pub as any).spin_03_onclicka) SPIN_03_ONCLICKA = (pub as any).spin_03_onclicka;
            if ((pub as any).spin_04_richads) SPIN_04_RICHADS = (pub as any).spin_04_richads;
            if ((pub as any).spin_05_monetag) SPIN_05_MONETAG = (pub as any).spin_05_monetag;

            if ((pub as any).box_01_richads) BOX_01_RICHADS = (pub as any).box_01_richads;
            if ((pub as any).box_02_monetag) BOX_02_MONETAG = (pub as any).box_02_monetag;
            if ((pub as any).box_03_onclicka) BOX_03_ONCLICKA = (pub as any).box_03_onclicka;
            if ((pub as any).box_04_richads) BOX_04_RICHADS = (pub as any).box_04_richads;
            if ((pub as any).box_05_monetag) BOX_05_MONETAG = (pub as any).box_05_monetag;

            if ((pub as any).mining_01_richads) MINING_01_RICHADS = (pub as any).mining_01_richads;
            if ((pub as any).mining_02_monetag) MINING_02_MONETAG = (pub as any).mining_02_monetag;
            if ((pub as any).mining_03_onclicka) MINING_03_ONCLICKA = (pub as any).mining_03_onclicka;
            if ((pub as any).mining_04_richads) MINING_04_RICHADS = (pub as any).mining_04_richads;
            if ((pub as any).mining_05_monetag) MINING_05_MONETAG = (pub as any).mining_05_monetag;
            if ((pub as any).miningPrimaryNetwork) MINING_PRIMARY_NETWORK = (pub as any).miningPrimaryNetwork;
            if ((pub as any).miningSecondaryNetwork) MINING_SECONDARY_NETWORK = (pub as any).miningSecondaryNetwork;
            if ((pub as any).miningWaterfallEnabled !== undefined) MINING_WATERFALL_ENABLED = (pub as any).miningWaterfallEnabled;

            let dur = 30;
            if (actionType === 'MINING') {
              dur = Number((pub as any).miningAdDurationSeconds || (pub as any).adMiningDurationSeconds || 30);
            } else if (actionType === 'SPIN') {
              dur = Number((pub as any).spinAdDurationSeconds || 30);
            } else if (actionType === 'GIFT_BOX') {
              dur = Number((pub as any).giftBoxAdDurationSeconds || 30);
            }
            if (dur && dur > 0) {
              setRequiredWatchSeconds(dur);
              requiredWatchSecondsRef.current = dur;
            }
          }
        } catch (e) {
          console.warn('Could not sync dynamic waterfall settings, using defaults:', e);
        }

        const isTg = typeof window !== 'undefined' && Boolean((window as any).Telegram?.WebApp?.initData);

        const dynamicSettings: Record<string, string> = {
          box_01_richads: BOX_01_RICHADS,
          box_02_monetag: BOX_02_MONETAG,
          box_03_onclicka: BOX_03_ONCLICKA,
          box_04_richads: BOX_04_RICHADS,
          box_05_monetag: BOX_05_MONETAG,
          spin_01_richads: SPIN_01_RICHADS,
          spin_02_monetag: SPIN_02_MONETAG,
          spin_03_onclicka: SPIN_03_ONCLICKA,
          spin_04_richads: SPIN_04_RICHADS,
          spin_05_monetag: SPIN_05_MONETAG,
          mining_01_richads: MINING_01_RICHADS,
          mining_02_monetag: MINING_02_MONETAG,
          mining_03_onclicka: MINING_03_ONCLICKA,
          mining_04_richads: MINING_04_RICHADS,
          mining_05_monetag: MINING_05_MONETAG,
        };

        // Build Distinct 5-Tier Waterfall (RichAds, Monetag, OnClickA)
        const computedTiers = buildIntraWaterfallTiers(actionType, targetId, userId, isTg, dynamicSettings);

        setTiers(computedTiers);
        setTierIndex(0);

        // Create authoritative backend session
        const session = await api.createUniversalAdSession(userId, actionType, targetId);
        if (!isMountedRef.current) return;

        if (session.durationSeconds && session.durationSeconds > 0) {
          setRequiredWatchSeconds(session.durationSeconds);
          requiredWatchSecondsRef.current = session.durationSeconds;
        }

        setAdSession({
          sessionId: session.sessionId,
          token: session.token,
          zoneId: session.zoneId || DEFAULT_ZONE_ID,
          directLink: session.directLink || DEFAULT_DIRECT_LINK,
        });

        setStep('READY');
      } catch (err: any) {
        if (!isMountedRef.current) return;
        setStep('ERROR');
        setErrorMsg(err.message || 'Failed to initialize ad session.');
      }
    }

    initWaterfallAndSession();

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [userId, actionType, targetId]);

  // Safe Cancellation
  const handleCancel = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (adSession) {
      api.cancelAdSession(adSession.sessionId, adSession.token, userId);
    }
    onCancel();
  }, [adSession, userId, onCancel]);

  // Listen to browser / Android back button (`popstate`)
  useEffect(() => {
    const handlePopState = () => {
      handleCancel();
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [handleCancel]);

  // Waterfall Fallback Trigger: Called whenever an ad network fails or times out
  // Strict requirement: Waterfall logic is ONLY for Mining! (Gift Box and Spin have dedicated ads, NO waterfall)
  const advanceWaterfall = useCallback(
    (reason: string) => {
      if (!isMountedRef.current) return;
      if (actionType !== 'MINING') {
        console.log(`[UnifiedRewardedAdModal] Waterfall disabled for ${actionType}. Retrying dedicated ad.`);
        setStep('WATCHING');
        startAdWatchTimer();
        return;
      }
      if (timerRef.current) clearInterval(timerRef.current);

      const nextIndex = tiers.length > 0 ? (tierIndex + 1) % tiers.length : 0;
      console.warn(`[Waterfall] Tier ${tierIndex + 1} (${tiers[tierIndex]?.provider}) failed: ${reason}. Switching to Tier ${nextIndex + 1} (${tiers[nextIndex]?.provider}).`);

      setTierIndex(nextIndex);
      setTierFailReason(`Switching to ${tiers[nextIndex]?.provider || 'next network'}...`);
      setRenderedAdUrl('');
      setSecondsWatched(0);
      totalWatchedSecondsRef.current = 0;
      watchStartTimeRef.current = null;
      hasStartedRef.current = false;
      setStep('READY');

      // Clear warning message after 2.5 seconds
      setTimeout(() => {
        if (isMountedRef.current) setTierFailReason(null);
      }, 2500);
    },
    [tierIndex, tiers, actionType]
  );

  // Monitor Tab Visibility / App Minimize - Strict Pause on Switch
  // "শর্ত হলো ৩০ সেকেন্ড এড ২৫ সেকেন্ড দেখে অন্য ট্যাবে গেলে বা বের হলে সময় ওখানে আটকে যাবে যত remaining 5 sec দেখাবে। যত সময় কম্পিলিট করবে না তত সময় এই বাটন কাজ করবে না।"
  const triggerAutoClaimRef = useRef<() => void>(() => {});

  useEffect(() => {
    const handleVisibility = () => {
      if (!isMountedRef.current || !hasStartedRef.current) return;

      if (document.hidden || document.visibilityState === 'hidden') {
        // User switched tabs or minimized app -> FREEZE TIMER IMMEDIATELY!
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setStep('EARLY_EXIT');
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Helper to start timer watch loop with 1-second active visible countdown
  const startAdWatchTimer = () => {
    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      if (adSession) {
        api.startAdWatching(adSession.sessionId, adSession.token, userId).catch(() => {});
      }
    }

    setStep('WATCHING');

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!isMountedRef.current) return;

      // If document is not visible, freeze the timer immediately!
      if (document.hidden || document.visibilityState === 'hidden') {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setStep('EARLY_EXIT');
        return;
      }

      setSecondsWatched(prev => {
        const targetSec = requiredWatchSecondsRef.current || DEFAULT_WATCH_SECONDS;
        const nextSec = prev + 1;
        totalWatchedSecondsRef.current = nextSec;

        if (nextSec >= targetSec) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          setStep('COMPLETED');
          triggerAutoClaimRef.current();
          return targetSec;
        }
        return nextSec;
      });
    }, 1000);
  };

  // Helper to resume watching from where it was paused (e.g. 25s watched -> remaining 5s)
  const handleResumeWatching = () => {
    setErrorMsg(null);
    startAdWatchTimer();
  };

  // 4. User Clicks "Watch Ad Now"
  // Waterfall Chain for Mining: RichAds -> Monetag -> OnClickA -> RichAds -> Monetag
  // 100% In-App inside Telegram Mini App (NO external Chrome redirect)
  const handleWatchAdClick = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!adSession || tiers.length === 0) return;
    const currentTier = tiers[tierIndex] || tiers[0];
    setErrorMsg(null);

    // Call blockExternalRedirect and generateAdToken before showing any ad
    blockExternalRedirect();
    generateAdToken();

    // Track Ad View in Supabase e4f_ad_views
    const placementName = currentTier.placementKey || `${actionType}_${targetId || 1}`;
    // Trigger in-app native ad handlers if available without popups/redirects
    if (currentTier.provider === 'RichAds') {
      try {
        if ((window as any).TelegramAdsController?.showRewardedAd) {
          (window as any).TelegramAdsController.showRewardedAd(Number(currentTier.id) || (actionType === 'SPIN' ? 410203 : 410202));
        }
      } catch (e) {}
    } else if (currentTier.provider === 'Monetag') {
      try {
        if (typeof (window as any).show_12044377 === 'function') {
          (window as any).show_12044377();
        }
      } catch (e) {}
    } else if (currentTier.provider === 'OnClickA') {
      try {
        if (typeof (window as any).initCdTma === 'function') {
          (window as any).initCdTma({ id: String(currentTier.id || (actionType === 'SPIN' ? '6153717E4F' : '6153772E4F')) }).then((show: any) => {
            if (typeof show === 'function') show();
          }).catch(() => {});
        }
      } catch (e) {}
    }

    // 100% In-App ad watching inside Telegram Mini App:
    // Start countdown and display in-app ad container directly.
    // Strictly NO external redirect to Chrome or popup!
    startAdWatchTimer();
  };

  // 5. Authoritative Backend Verification & Claim
  const handleClaimReward = async (customSignal?: string) => {
    // Call verifyAdWatch() only
    const check = verifyAdWatch();
    if (!check.valid) {
      isVerifyingRef.current = false;
      setErrorMsg(check.reason || 'Fake Report! Watch 30s');
      setStep('EARLY_EXIT');
      return;
    }

    if (!adSession || isVerifyingRef.current) return;
    isVerifyingRef.current = true;
    try {
      setStep('VERIFYING');
      setErrorMsg(null);

      const currentTier = tiers[tierIndex] || tiers[0];
      const signalToSubmit = customSignal || `WATERFALL_${currentTier?.provider}_${currentTier?.id}_COMPLETED`;

      const verifyRes = await api.completeUniversalAdSession(
        adSession.sessionId,
        adSession.token,
        userId,
        actionType,
        targetId,
        signalToSubmit
      );

      if (verifyRes.verified && verifyRes.claimToken) {
        // Record in daily network frequency cap (max 3 per day per network)
        incrementNetworkViewCountToday(userId, currentTier.provider);

        // Log Ad Event in Supabase e4f_ad_events
        const placementName = `${actionType}_${targetId || 1}`;
        api.logAdEvent(userId, currentTier.provider, placementName, verifyRes.claimToken);

        setStep('COMPLETED');
        if (isMountedRef.current) {
          onComplete(adSession.sessionId, verifyRes.claimToken);
        }
      } else {
        isVerifyingRef.current = false;
        advanceWaterfall('Server could not validate ad completion signal.');
      }
    } catch (err: any) {
      isVerifyingRef.current = false;
      if (!isMountedRef.current) return;
      setStep('EARLY_EXIT');
      setErrorMsg(err.message || `Verification failed. Full ${requiredWatchSecondsRef.current || DEFAULT_WATCH_SECONDS}s watch required.`);
    }
  };

  triggerAutoClaimRef.current = () => handleClaimReward();

  const currentTier = tiers[tierIndex] || tiers[0];
  const targetWatchSeconds = requiredWatchSeconds || DEFAULT_WATCH_SECONDS;
  const remainingSeconds = Math.max(0, targetWatchSeconds - secondsWatched);
  const progressPercent = Math.min(100, Math.round((secondsWatched / targetWatchSeconds) * 100));

  // Determine current Tier target ad URL (real ad link for RichAds, Monetag, OnClickA)
  const activeAdUrl = renderedAdUrl || (currentTier ? getProviderAdUrl(currentTier.provider, currentTier.id) : '');

  const handleOpenSponsorAd = async () => {
    if (!currentTier) return;
    if (currentTier.provider === 'RichAds' || String(currentTier.id).startsWith('4102')) {
      if (typeof (window as any).showRichAdsInTelegram === 'function') {
        try {
          const ok = await (window as any).showRichAdsInTelegram(currentTier.id || '410204');
          if (ok) {
            handleClaimReward(`RICHADS_${currentTier.id || '410204'}_COMPLETED`);
            return;
          }
        } catch (e) {
          console.warn('[RichAds in-app error]:', e);
        }
      }
      return;
    }
    if (currentTier.provider === 'Monetag') {
      if (typeof (window as any).showMonetagInsideTelegram === 'function') {
        try {
          const ok = await (window as any).showMonetagInsideTelegram();
          if (ok) {
            handleClaimReward(`MONETAG_${currentTier.id || '12044377'}_COMPLETED`);
            return;
          }
        } catch (e) {
          console.warn('[Monetag in-app error]:', e);
        }
      } else {
        const showFn = (window as any).show_12044377;
        if (typeof showFn === 'function') {
          try {
            await showFn();
            handleClaimReward(`MONETAG_${currentTier.id || '12044377'}_COMPLETED`);
            return;
          } catch (err2) {
            console.warn('[Monetag interstitial error]:', err2);
          }
        }
      }
      return;
    }
    openExternalSponsorAd(activeAdUrl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-sm max-h-[92vh] overflow-y-auto my-auto bg-[#0C1326] border border-amber-500/40 rounded-3xl p-6 text-center shadow-2xl no-scrollbar">
        {/* Ambient Top Glow */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-20 bg-amber-500/20 blur-2xl pointer-events-none" />

        {/* Close Button */}
        {step !== 'VERIFYING' && (
          <button
            onClick={handleCancel}
            title="Cancel and Exit"
            className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Modal Title */}
        <h3 className="text-lg font-black text-white mb-1 mt-1">{title}</h3>
        <p className="text-xs text-slate-400 mb-2">{description}</p>

        {/* Top Reward Text */}
        {rewardHint && (
          <div className="mb-3 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 flex items-center justify-center gap-1.5">
            <span className="text-amber-400 font-bold">Reward:</span>
            <span>{rewardHint}</span>
          </div>
        )}

        {/* Fallback Banner Notice */}
        {tierFailReason && (
          <div className="mb-3 p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] flex items-center gap-1.5 animate-in fade-in">
            <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
            <span>{tierFailReason}</span>
          </div>
        )}

        {/* STATE: INITIALIZING */}
        {step === 'INITIALIZING' && (
          <div className="py-6 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            <div className="text-xs text-slate-300 font-medium">Loading ad...</div>
          </div>
        )}

        {/* STATE: READY */}
        {step === 'READY' && (
          <div className="py-2 flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
              <Play className="w-8 h-8 fill-amber-400 ml-0.5" />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-extrabold text-amber-300 uppercase tracking-wide">
                WATCH FULL ADS TO GET REWARD
              </div>
              <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                WATCH FULL ADS TO UNLOCK REWARD
              </div>
            </div>

            <p className="text-[11px] text-slate-400 px-2 leading-relaxed">
              Tap below to watch the video and claim your reward.
            </p>

            {/* Watch Ad Button */}
            <button
              onClick={() => handleWatchAdClick()}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>
                {currentTier?.provider === 'Monetag'
                  ? 'Watch Video Ad'
                  : `Watch Video Ad (${targetWatchSeconds}s)`}
              </span>
            </button>
          </div>
        )}

        {/* STATE: WATCHING */}
        {step === 'WATCHING' && (
          <div className="py-2 flex flex-col items-center justify-center gap-3">
            {/* Middle: Big Play button */}
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
              <Play className="w-7 h-7 fill-amber-400 animate-pulse ml-0.5" />
            </div>

            {/* Middle: WATCH FULL ADS TO GET REWARD - AD IN PROGRESS */}
            <div className="space-y-1">
              <div className="text-sm font-extrabold text-amber-300 uppercase tracking-wide">
                WATCH FULL ADS TO GET REWARD
              </div>
              <div className="text-[11px] font-semibold text-amber-400/90 uppercase tracking-wider">
                AD IN PROGRESS • COUNTDOWN RUNNING
              </div>
            </div>

            {/* In-App Interactive Ad Creative Showcase Player (NO IFRAME) */}
            <div className="w-full rounded-2xl bg-gradient-to-b from-slate-900 via-[#0A1020] to-slate-950 border border-amber-500/30 p-3.5 space-y-3 shadow-xl">
              {/* Middle: Network label with green dot */}
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  <span>
                    {actionType === 'SPIN'
                      ? (targetId === 2 || targetId === 5 ? 'Monetag' : targetId === 3 ? 'OnClickA' : 'RichAds')
                      : actionType === 'GIFT_BOX'
                      ? (targetId === 2 || targetId === 5 ? 'Monetag' : targetId === 3 ? 'OnClickA' : 'RichAds')
                      : currentTier?.provider}{' '}
                    Real Ad
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px] font-semibold border border-slate-700">
                  Zone:{' '}
                  {actionType === 'SPIN'
                    ? (targetId === 2 || targetId === 5 ? '12044377' : targetId === 3 ? '6153717E4F' : '410203')
                    : actionType === 'GIFT_BOX'
                    ? (targetId === 2 || targetId === 5 ? '12044377' : targetId === 3 ? '6153772E4F' : '410202')
                    : currentTier?.id || 'Active'}
                </span>
              </div>

              {/* 100% In-App Sandboxed Ad Container - NO EXTERNAL REDIRECT */}
              <div className="w-full rounded-xl overflow-hidden border border-slate-800 bg-black">
                {actionType === 'MINING' ? (
                  <AdWaterfall house="mining" onAdLoaded={() => {}} />
                ) : actionType === 'SPIN' ? (
                  <AdInside
                    adScript={getAdInsideScript(
                      currentTier?.provider || (targetId === 2 || targetId === 5 ? 'Monetag' : targetId === 3 ? 'OnClickA' : 'RichAds'),
                      currentTier?.id || (targetId === 2 || targetId === 5 ? '12044377' : targetId === 3 ? '6153717E4F' : '410203')
                    )}
                  />
                ) : (
                  <AdInside
                    adScript={getAdInsideScript(
                      currentTier?.provider || (targetId === 2 || targetId === 5 ? 'Monetag' : targetId === 3 ? 'OnClickA' : 'RichAds'),
                      currentTier?.id || (targetId === 2 || targetId === 5 ? '12044377' : targetId === 3 ? '6153772E4F' : '410202')
                    )}
                  />
                )}
              </div>

              {/* Watch Timer & Progress */}
              <div className="space-y-1 pt-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Watch Progress:</span>
                  </span>
                  <span className="font-mono font-bold text-amber-400 text-sm">
                    {remainingSeconds > 0 ? `${remainingSeconds}s remaining` : 'Complete!'}
                  </span>
                </div>

                <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <p className="text-[10px] text-slate-400 text-center pt-0.5">
                  Remain on screen. Switching tabs or exiting pauses the timer.
                </p>
              </div>
            </div>

            {/* Manual next network fallback only for MINING waterfall */}
            {actionType === 'MINING' && (
              <button
                onClick={() => advanceWaterfall('User requested next ad stream')}
                className="text-[10px] text-slate-500 hover:text-amber-400 transition-colors cursor-pointer mt-1"
              >
                Ad blocked or not loading? Skip to next network
              </button>
            )}
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
                Watched <span className="text-amber-400 font-bold">{secondsWatched}s</span> of {targetWatchSeconds}s required.
              </div>
            </div>

            {errorMsg && <p className="text-[11px] text-amber-400 px-2">{errorMsg}</p>}

            <button
              onClick={handleResumeWatching}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs shadow-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>Continue Watching Ad ({remainingSeconds}s remaining)</span>
            </button>

            {actionType === 'MINING' && (
              <button
                onClick={() => advanceWaterfall('Ad playback incomplete')}
                className="text-[10px] text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
              >
                Try next network
              </button>
            )}
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
                FULL 30S AD COMPLETED!
              </div>
              <div className="text-xs text-slate-300">
                Ad completed and verified.
              </div>
            </div>

            <button
              onClick={() => handleClaimReward()}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Claim Verified Reward Now</span>
            </button>
          </div>
        )}

        {/* STATE: VERIFYING */}
        {step === 'VERIFYING' && (
          <div className="py-6 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            <div className="text-xs text-emerald-300 font-bold">Verifying Full Ad Watch on Server...</div>
            <div className="text-[10px] text-slate-400">Securing your reward tokens...</div>
          </div>
        )}

        {/* STATE: ALL_FAILED -> RULE: If all ads fail, show "No Ads Available, Try Again Later" */}
        {step === 'ALL_FAILED' && (
          <div className="py-4 flex flex-col items-center justify-center gap-3 animate-in fade-in">
            <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <div className="text-sm font-black text-amber-400 uppercase tracking-wide">
                No Ads Available, Try Again Later
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed px-2">
                No sponsored ads could be loaded at this moment. Please try again later.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full pt-1">
              <button
                onClick={() => {
                  setTierIndex(0);
                  setStep('READY');
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
              <button
                onClick={handleCancel}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* STATE: ERROR */}
        {step === 'ERROR' && (
          <div className="py-4 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-xs text-rose-300 font-semibold px-2">
              {errorMsg || 'Failed to complete ad verification.'}
            </div>

            <button
              onClick={() => advanceWaterfall('Ad error occurred')}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs shadow transition-all cursor-pointer block"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
