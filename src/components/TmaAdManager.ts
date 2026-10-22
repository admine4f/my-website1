// Official OnClickA TMA In-Stream Ad Manager for Telegram Mini Apps

declare global {
  interface Window {
    initCdTma?: (config: { id: string }) => Promise<() => Promise<void>>;
  }
}

export const TMA_SPOTS: Record<string, string> = {
  MINING: "6153774E4F",  // 468588 Bonus - Mining
  GIFTBOX: "6153772E4F", // 468586 TASK - Gift Box
  SPIN: "6153717E4F"     // 468529 Reward - Spin
};

export function getFixedId(id: string | number | undefined): string {
  if (!id) return '';
  const str = String(id).trim();
  if (str === "6153774") return "6153774E4F";
  if (str === "6153772") return "6153772E4F";
  if (str === "6153717") return "6153717E4F";
  return str;
}

let tmaShowMethods: Record<string, () => Promise<void>> = {};

export function initAllTmaAds() {
  if (typeof window === 'undefined' || !window.initCdTma) return;
  Object.entries(TMA_SPOTS).forEach(([key, rawId]) => {
    const id = getFixedId(rawId);
    window.initCdTma!({ id })
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
        const show = await window.initCdTma({ id: spotId });
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
