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
import { preloadTmaAdById } from '../TmaAdManager';
import { blockExternalRedirect, generateAdToken, verifyAdWatch, beginAdRedirectGuard, endAdRedirectGuard } from '../../services/antiFakeAds';
import AdInside from '../AdInside';
import AdWaterfall from '../AdWaterfall';

// =========================================================================
// FINAL AD RULES (Spin / Gift Box / Mining)
//  - Spin N and Gift Box N: only the ad of slot N. If it fails to show: wait 5s, try the SAME ad once more (2 tries),
//    then show Monetag 12044377 as backup.
//  - Monetag: after it was shown, it rests 59s (never called again during that time). Shared by Spin, Gift Box and Mining.
//  - Only one ad flow at a time (global lock).
//  - Mining: 5 ads one after another (step 1 -> 5); the mining session starts when the sequence is finished.
//  - Ad closed midway = no reward. Ad finished = automatic reward.
// =========================================================================
const RETRY_DELAY_SECONDS = 5;
const MONETAG_COOLDOWN_MS = 59000;
const NO_FILL_MS = 4000; // a failure faster than this = "no ad available"; a later failure = "user closed the ad"
const MONETAG_LAST_KEY = 'E4F_monetag_last_shown';
let globalAdBusy = false;
let monetagLastShownMem = 0;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
function monetagCooldownLeftMs(): number {
  let last = monetagLastShownMem;
  try { last = Math.max(last, Number(localStorage.getItem(MONETAG_LAST_KEY) || 0)); } catch {}
  const left = last + MONETAG_COOLDOWN_MS - Date.now();
  return left > 0 ? left : 0;
}
function markMonetagShown() {
  monetagLastShownMem = Date.now();
  try { localStorage.setItem(MONETAG_LAST_KEY, String(monetagLastShownMem)); } catch {}
}
const BACKUP_TIER: any = { provider: 'Monetag', id: '12044377', label: 'Monetag (Backup)' };

function getAdInsideScript(provider: string, zoneId: string | number): string {
  // Static ad-stage panel (same look as before). The REAL ad is played by the network SDK inside the Mini App
  // (overlay), never inside this sandboxed iframe, so no ad script is loaded here.
  const z = String(zoneId || '410202');
  const isRich = provider === 'RichAds' || (provider !== 'Monetag' && provider !== 'OnClickA' && z.startsWith('4102'));
  const isMonetag = provider === 'Monetag';
  const color = isRich ? '#F59E0B' : isMonetag ? '#38BDF8' : '#34D399';
  const name = isRich ? 'RichAds' : isMonetag ? 'Monetag' : 'OnClickA';
  return `<div style="padding: 24px 16px; text-align: center; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="font-size: 16px; font-weight: 800; color: ${color}; margin-bottom: 8px;">Your ad is playing</div>
  <div style="font-size: 12px; color: #94A3B8;">Watch it to the end. Your reward is added automatically.</div>
</div>`;
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
export let SPIN_04_RICHADS = '12044377'; // Slot 4 = Monetag 12044377
export let SPIN_05_MONETAG = '12044377';

export let BOX_01_RICHADS = '410202';
export let BOX_02_MONETAG = '12044377';
export let BOX_03_ONCLICKA = '6153772E4F';
export let BOX_04_RICHADS = '12044377'; // Slot 4 = Monetag 12044377
export let BOX_05_MONETAG = '12044377';

// Mining Waterfall Ad Variables
export let MINING_01_RICHADS = '410204';
export let MINING_02_MONETAG = '12044377';
export let MINING_03_ONCLICKA = '6153774E4F';
export let MINING_04_RICHADS = '410204'; // Default RichAds 410204
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
  const adRunningRef = useRef<boolean>(false);
  const miningNextStepRef = useRef<number>(0);       // Mining: next ad (0-based) of the 5-ad sequence
  const miningCompletedRef = useRef<number>(0);      // Mining: how many ads of the sequence were really completed
  const miningLastShownRef = useRef<WaterfallTier | null>(null);
  const [statusNote, setStatusNote] = useState<string>('');
  const isMiningView = actionType === 'MINING';
  const [miningStep, setMiningStep] = useState<number | null>(null);
  const [initNonce, setInitNonce] = useState<number>(0);
  const watchTicketRef = useRef<string>('');

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

        // Create authoritative backend session. The SERVER decides the slot and the ad network/ids
        // (Mining = 5-step waterfall, Spin / Gift Box = the dedicated ad of this slot).
        const session = await api.createUniversalAdSession(userId, actionType, targetId);
        if (!isMountedRef.current) return;

        if (!session.tiers || session.tiers.length === 0) {
          throw new Error('No ad is configured for this action. Please try again later.');
        }
        const serverTiers: WaterfallTier[] = session.tiers.map((t: any, i: number) => ({
          index: t.index || i + 1,
          provider: t.provider,
          id: String(t.id),
          label: t.label,
        }));
        setTiers(serverTiers);
        setTierIndex(0);
        watchTicketRef.current = '';

        // Warm up OnClickA spots so the ad starts instantly when the user taps "Watch Video Ad"
        try {
          serverTiers.forEach((t: any) => {
            if (t && t.provider === 'OnClickA') preloadTmaAdById(String(t.id));
          });
        } catch {}

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
  }, [userId, actionType, targetId, initNonce]);

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
      if (adRunningRef.current) return; // an ad is playing right now - do not interrupt
      if (actionType !== 'MINING') {
        // Spin / Gift Box: dedicated ad only. Return to READY so the same ad can be retried (no reward without the ad).
        console.log(`[UnifiedRewardedAdModal] Waterfall disabled for ${actionType}. Retrying dedicated ad.`);
        if (timerRef.current) clearInterval(timerRef.current);
        setErrorMsg(null);
        setTierFailReason(null);
        setStep('READY');
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

  // Helper to resume watching from where it was paused (e.g. 25s watched -> remaining 5s)
  const handleResumeWatching = () => {
    setErrorMsg(null);
    handleWatchAdClick();
  };

  // 4. User Clicks "Watch Ad Now"
  // Waterfall Chain for Mining: RichAds -> Monetag -> OnClickA -> RichAds -> Monetag
  // 100% In-App inside Telegram Mini App (NO external Chrome redirect)
  const handleWatchAdClick = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!adSession || tiers.length === 0) return;
    if (adRunningRef.current || isVerifyingRef.current || globalAdBusy) return; // one ad at a time
    adRunningRef.current = true;
    globalAdBusy = true;
    setErrorMsg(null);
    setTierFailReason(null);
    setStatusNote('');

    // External redirects are blocked ONLY while the ad is on screen
    blockExternalRedirect();
    beginAdRedirectGuard();
    generateAdToken();

    // Tell the server the real ad has started (needed for session verification).
    // NOT awaited here: the ad must start immediately inside the user's tap (video with sound needs that).
    hasStartedRef.current = false;
    watchTicketRef.current = '';
    const serverStartPromise: Promise<any> = Promise.resolve(
      api.startAdWatching(adSession.sessionId, adSession.token, userId)
    )
      .then((r: any) => {
        if (r && r.watchTicket) watchTicketRef.current = r.watchTicket;
        return r;
      })
      .catch(() => null);

    setStep('WATCHING');

    const alive = () => isMountedRef.current;
    const isMining = actionType === 'MINING';
    let finalTier: WaterfallTier | null = null;
    let outcome: 'reward' | 'closed' | 'nofill' = 'nofill';

    try {
      // One ad call. A quick failure = "no ad available"; a late failure = "the user closed it midway".
      const showOnce = async (tier: WaterfallTier): Promise<{ ok: boolean; noFill: boolean }> => {
        const t0 = Date.now();
        let ok = false;
        try {
          let r: { success: boolean; reason?: string };
          if (tier.provider === 'RichAds') {
            r = await showRichadsAd(String(tier.id), 8000, { actionType, targetId });
          } else if (tier.provider === 'Monetag') {
            r = await showMonetagAd(String(tier.id), 0, adSession.sessionId);
          } else {
            r = await showOnclickaAd(String(tier.id));
          }
          ok = !!r.success;
          if (!ok) console.warn(`[Ad] ${tier.provider} (${tier.id}) not completed: ${r.reason || 'unknown'}`);
        } catch (err: any) {
          console.warn('[Ad] error:', err);
          ok = false;
        }
        const ms = Date.now() - t0;
        const noFill = !ok && ms < NO_FILL_MS;
        if (tier.provider === 'Monetag' && (ok || !noFill)) markMonetagShown(); // Monetag was shown -> 59s rest
        return { ok, noFill };
      };

      // Monetag must rest 59s after it was shown: wait here (the user sees a countdown), never call it earlier
      const waitMonetagRest = async (): Promise<boolean> => {
        let left = monetagCooldownLeftMs();
        while (left > 0) {
          if (!alive()) return false;
          setStatusNote(`NEXT AD READY IN ${Math.ceil(left / 1000)}S`);
          await sleep(250);
          left = monetagCooldownLeftMs();
        }
        setStatusNote('');
        return alive();
      };

      const attempt = async (tier: WaterfallTier): Promise<{ ok: boolean; noFill: boolean }> => {
        if (tier.provider === 'Monetag' && !(await waitMonetagRest())) return { ok: false, noFill: false };
        return showOnce(tier);
      };

      // Rule: try -> (quick failure) wait 5s -> try the same ad again -> (Spin/Gift only) Monetag backup
      const tryTier = async (
        tier: WaterfallTier,
        allowBackup: boolean,
        allowRetry: boolean = true
      ): Promise<{ status: 'ok' | 'nofill' | 'closed'; shown?: WaterfallTier }> => {
        let r = await attempt(tier);
        if (r.ok) return { status: 'ok', shown: tier };
        if (!r.noFill) return { status: 'closed' };
        if (!allowRetry) return { status: 'nofill' }; // Mining: this network has no ad -> next step

        for (let sec = RETRY_DELAY_SECONDS; sec > 0; sec--) {
          if (!alive()) return { status: 'closed' };
          setStatusNote(`RETRYING IN ${sec}S`);
          await sleep(1000);
        }
        setStatusNote('');
        r = await attempt(tier);
        if (r.ok) return { status: 'ok', shown: tier };
        if (!r.noFill) return { status: 'closed' };

        if (allowBackup && tier.provider !== 'Monetag') {
          // if Monetag is resting (59s), wait here with a visible countdown, then show the backup ad
          if (!(await waitMonetagRest())) return { status: 'closed' };
          setStatusNote('BACKUP AD');
          r = await showOnce(BACKUP_TIER);
          setStatusNote('');
          if (r.ok) return { status: 'ok', shown: BACKUP_TIER as WaterfallTier };
          if (!r.noFill) return { status: 'closed' };
        }
        return { status: 'nofill' };
      };

      if (isMining) {
        // MINING: waterfall 1 -> 5. The first ad that really plays to the end is enough; mining then starts automatically.
        let aborted = false;
        for (let i = miningNextStepRef.current; i < tiers.length; i++) {
          if (!alive()) break;
          setTierIndex(i);
          setMiningStep(i + 1);
          setRenderedAdUrl('');
          const r = await tryTier(tiers[i], false, false);
          if (!alive()) break;
          if (r.status === 'ok') {
            miningCompletedRef.current += 1;
            miningLastShownRef.current = r.shown || tiers[i];
            miningNextStepRef.current = i + 1;
            break; // ONE completed ad is enough: the ad closes and mining starts automatically
          } else if (r.status === 'nofill') {
            miningNextStepRef.current = i + 1; // this network has no ad right now -> continue with the next step
          } else {
            aborted = true; // closed midway -> stop here, the same ad can be watched again
            break;
          }
        }
        if (aborted) outcome = 'closed';
        else if (miningCompletedRef.current >= 1) { outcome = 'reward'; finalTier = miningLastShownRef.current; }
        else outcome = 'nofill';
      } else {
        // SPIN / GIFT BOX: only the dedicated ad of this slot (+ retry and Monetag backup)
        const tier = tiers[tierIndex] || tiers[0];
        const r = await tryTier(tier, true);
        if (r.status === 'ok') { outcome = 'reward'; finalTier = r.shown || tier; }
        else outcome = r.status === 'closed' ? 'closed' : 'nofill';
      }
    } finally {
      adRunningRef.current = false;
      globalAdBusy = false;
      endAdRedirectGuard();
    }

    if (!alive()) return;
    setTierFailReason(null);
    setStatusNote('');

    if (outcome === 'reward' && finalTier) {
      setMiningStep(null);
      // All required ads were really shown -> automatic reward (no waiting time)
      await serverStartPromise; // make sure the server registered the start before the completion call
      if (!watchTicketRef.current) {
        isVerifyingRef.current = false;
        setErrorMsg('Connection problem while starting the ad. Please try again.');
        setStep('ERROR');
        return;
      }
      await handleClaimReward(
        `WATERFALL_${String(finalTier.provider).toUpperCase()}_${finalTier.id}_SDK_COMPLETED`,
        finalTier
      );
    } else if (outcome === 'closed') {
      // Closed midway -> NO reward; the same ad can be started again
      setTierFailReason(
        isMining
          ? 'Ad closed early - no reward. Tap "Watch Video Ad" to try again.'
          : 'Ad closed early - no reward. Tap "Watch Video Ad" to try again.'
      );
      setStep('READY');
    } else {
      // No ad could be shown -> NO reward
      miningNextStepRef.current = 0;
      miningCompletedRef.current = 0;
      miningLastShownRef.current = null;
      setMiningStep(null);
      setStep('ALL_FAILED');
    }
  };

  // 5. Authoritative Backend Verification & Claim
  const handleClaimReward = async (customSignal?: string, tierOverride?: WaterfallTier) => {
    // Reward is based on the ad network completion signal (ad really shown), not on a client timer.

    if (!adSession || isVerifyingRef.current) return;
    isVerifyingRef.current = true;
    try {
      setStep('VERIFYING');
      setErrorMsg(null);

      const currentTier = tierOverride || tiers[tierIndex] || tiers[0];
      const signalToSubmit = customSignal || `WATERFALL_${currentTier?.provider}_${currentTier?.id}_COMPLETED`;

      const verifyRes = await api.completeUniversalAdSession(
        adSession.sessionId,
        adSession.token,
        userId,
        actionType,
        targetId,
        signalToSubmit,
        watchTicketRef.current,
        currentTier?.provider
      );

      if (verifyRes.verified && verifyRes.claimToken) {
        // Record in daily network frequency cap (max 3 per day per network)
        incrementNetworkViewCountToday(userId, currentTier.provider);

        // Log Ad Event in Supabase e4f_ad_events
        const placementName = `${actionType}_${targetId || 1}`;

        setStep('COMPLETED');
        if (isMountedRef.current) {
          onComplete(adSession.sessionId, verifyRes.claimToken);
        }
      } else {
        isVerifyingRef.current = false;
        setErrorMsg('Could not verify the ad. Please try again.');
        setStep('ERROR');
      }
    } catch (err: any) {
      isVerifyingRef.current = false;
      if (!isMountedRef.current) return;
      setStep('ERROR');
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
                Watch Video Ad
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
                {`AD IN PROGRESS • ${statusNote || 'PLEASE WAIT'}${isMiningView && miningStep ? ` • AD ${miningStep}/${tiers.length}` : ''}`}
              </div>
            </div>

            {/* In-App Interactive Ad Creative Showcase Player (NO IFRAME) */}
            <div className="w-full rounded-2xl bg-gradient-to-b from-slate-900 via-[#0A1020] to-slate-950 border border-amber-500/30 p-3.5 space-y-3 shadow-xl">
              {/* Middle: Network label with green dot */}
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  <span>{currentTier?.provider} Real Ad</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px] font-semibold border border-slate-700">
                  Zone: {currentTier?.id || 'Active'}
                </span>
              </div>

              {/* 100% In-App Sandboxed Ad Container - NO EXTERNAL REDIRECT */}
              <div className="w-full rounded-xl overflow-hidden border border-slate-800 bg-black">
                {actionType === 'MINING' ? (
                  <AdInside adScript={getAdInsideScript(currentTier?.provider || 'RichAds', currentTier?.id || '410204')} />
                ) : actionType === 'SPIN' ? (
                  <AdInside adScript={getAdInsideScript(currentTier?.provider || 'RichAds', currentTier?.id || '410203')} />
                ) : (
                  <AdInside adScript={getAdInsideScript(currentTier?.provider || (targetId === 2 || targetId === 5 ? 'Monetag' : targetId === 3 ? 'OnClickA' : 'RichAds'), currentTier?.id || (targetId === 2 || targetId === 5 ? '12044377' : targetId === 3 ? '6153772E4F' : '410202'))} />
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
                    Playing ad...
                  </span>
                </div>

                <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300 animate-pulse`}
                    style={{ width: '100%' }}
                  />
                </div>

                <p className="text-[10px] text-slate-400 text-center pt-0.5">
                  Watch the full ad. Your reward is credited automatically when it ends.
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
                  miningNextStepRef.current = 0;
                  miningCompletedRef.current = 0;
                  miningLastShownRef.current = null;
                  setMiningStep(null);
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
              onClick={() => {
                if (!adSession) {
                  setInitNonce(n => n + 1);
                } else {
                  advanceWaterfall('Ad error occurred');
                }
              }}
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
