// Official OnClickA TMA In-Stream Ad Manager for Telegram Mini Apps

declare global {
  interface Window {
    initCdTma?: (config: { id: string }) => Promise<() => Promise<void>>;
  }
}

// Spot IDs exactly as shown in the OnClickA dashboard "Spot ID" column (plain digits).
// "E4F" in the dashboard is the ad-code NAME prefix ("E4F Reward"), not part of the ID.
export const TMA_SPOTS: Record<string, string> = {
  MINING: "6153774",  // 468588 Bonus - Mining
  GIFTBOX: "6153772", // 468586 TASK - Gift Box
  SPIN: "6153717"     // 468529 Reward - Spin
};

/** Plain numeric Spot ID (any legacy "...E4F" suffix is removed). */
export function getFixedId(id: string | number | undefined): string {
  if (!id) return '';
  return String(id).trim().replace(/E4F$/i, '');
}

/** Try the plain ID first, then the legacy "...E4F" form (in case the network really uses it). */
async function initSpot(base: string): Promise<() => Promise<void>> {
  const withTimeout = (p: Promise<any>) =>
    Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('OnClickA init timeout')), 8000))]);
  let lastErr: any;
  for (const spot of [base, base + 'E4F']) {
    try {
      const show: any = await withTimeout(Promise.resolve(window.initCdTma!({ id: spot })));
      if (typeof show === 'function') return show as () => Promise<void>;
      // Some SDK versions return an object that carries the show function
      if (show && typeof show === 'object') {
        const k = ['show', 'showAd', 'showVideo', 'run', 'play'].find(n => typeof (show as any)[n] === 'function');
        if (k) return () => (show as any)[k]();
      }
      lastErr = new Error(`OnClickA spot ${spot} not ready (the network returned no ad for this Spot ID)`);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('OnClickA init failed');
}

let tmaShowMethods: Record<string, () => Promise<void>> = {};

export function initAllTmaAds() {
  if (typeof window === 'undefined' || !window.initCdTma) return;
  Object.entries(TMA_SPOTS).forEach(([key, rawId]) => {
    const id = getFixedId(rawId);
    initSpot(id)
      .then((show: () => Promise<void>) => {
        tmaShowMethods[key] = show;
        console.log(`TMA ${key} ready: ${id}`);
      })
      .catch((e: any) => console.log(`TMA ${key} error:`, e));
  });
}

export async function showTmaAd(type: 'MINING' | 'GIFTBOX' | 'SPIN' | string): Promise<boolean> {
  // type = MINING, GIFTBOX, SPIN
  const normKey = type.toUpperCase().includes('BOX')
    ? 'GIFTBOX'
    : type.toUpperCase().includes('SPIN')
    ? 'SPIN'
    : 'MINING';

  const showMethod = tmaShowMethods[normKey] || tmaShowMethods[type];
  if (!showMethod) {
    // If not pre-cached, attempt on-demand init if window.initCdTma is available
    if (typeof window !== 'undefined' && window.initCdTma) {
      try {
        const spotId = getFixedId(TMA_SPOTS[normKey] || TMA_SPOTS.MINING);
        const show = await initSpot(spotId);
        tmaShowMethods[normKey] = show;
        await show(); // This plays INSIDE Telegram, not external
        return true;
      } catch (err) {
        console.warn(`[TMA OnClickA on-demand error]:`, err);
        throw new Error("Ad not ready, try waterfall fallback");
      }
    }
    throw new Error("Ad not ready, try waterfall fallback");
  }

  await showMethod(); // This plays INSIDE Telegram, not external
  return true;
}

// ---- OnClickA: exact Spot ID from Admin panel (per-ID cached init) ----
const tmaInitById: Record<string, Promise<() => Promise<void>>> = {};

function getTmaShowById(rawId: string): Promise<() => Promise<void>> {
  const id = getFixedId(rawId);
  if (!id) return Promise.reject(new Error('OnClickA id missing'));
  if (typeof window === 'undefined' || !window.initCdTma) return Promise.reject(new Error('OnClickA SDK not loaded'));
  // Reuse the method already prepared by initAllTmaAds() at app start (avoids initializing the same spot twice)
  for (const k of Object.keys(TMA_SPOTS)) {
    if (getFixedId(TMA_SPOTS[k]) === id && tmaShowMethods[k]) return Promise.resolve(tmaShowMethods[k]);
  }
  if (!tmaInitById[id]) {
    tmaInitById[id] = initSpot(id);
    tmaInitById[id].catch(() => { delete tmaInitById[id]; }); // allow a fresh init next time
  }
  return tmaInitById[id];
}

/** Warm up the spot so the ad can start instantly on the user's tap. Safe to call many times. */
export function preloadTmaAdById(rawId: string): void {
  getTmaShowById(rawId).catch(() => {});
}

/** Show the OnClickA rewarded video INSIDE Telegram. Resolves only when the ad was shown successfully. */
export async function showTmaAdById(rawId: string): Promise<boolean> {
  const show = await getTmaShowById(rawId);
  await show();
  return true;
}
