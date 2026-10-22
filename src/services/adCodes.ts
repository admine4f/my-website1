// =========================================================================
// E4F FINAL AD CODES - 5 WATERFALL SLOTS (RichAds, Monetag, OnClickA)
// 5-Slot Waterfall Architecture: RichAds -> Monetag -> OnClickA -> RichAds -> Monetag
// =========================================================================

export interface AdUnitConfig {
  richads_1: string;
  monetag_1: string;
  onclicka: string;
  richads_2: string;
  monetag_2: string;
}

export const SPIN_ADS: Record<string, AdUnitConfig> = {
  spin_01: { richads_1: "410203", monetag_1: "12044377", onclicka: "6153717E4F", richads_2: "410203", monetag_2: "12044377" },
  spin_02: { richads_1: "410203", monetag_1: "12044377", onclicka: "6153717E4F", richads_2: "410203", monetag_2: "12044377" },
  spin_03: { richads_1: "410203", monetag_1: "12044377", onclicka: "6153717E4F", richads_2: "410203", monetag_2: "12044377" },
  spin_04: { richads_1: "410203", monetag_1: "12044377", onclicka: "6153717E4F", richads_2: "410203", monetag_2: "12044377" },
  spin_05: { richads_1: "410203", monetag_1: "12044377", onclicka: "6153717E4F", richads_2: "410203", monetag_2: "12044377" }
};

export const BOX_ADS: Record<string, AdUnitConfig> = {
  box_01: { richads_1: "410202", monetag_1: "12044377", onclicka: "6153772E4F", richads_2: "410202", monetag_2: "12044377" },
  box_02: { richads_1: "410202", monetag_1: "12044377", onclicka: "6153772E4F", richads_2: "410202", monetag_2: "12044377" },
  box_03: { richads_1: "410202", monetag_1: "12044377", onclicka: "6153772E4F", richads_2: "410202", monetag_2: "12044377" },
  box_04: { richads_1: "410202", monetag_1: "12044377", onclicka: "6153772E4F", richads_2: "410202", monetag_2: "12044377" },
  box_05: { richads_1: "410202", monetag_1: "12044377", onclicka: "6153772E4F", richads_2: "410202", monetag_2: "12044377" }
};

export const MINING_ADS: Record<string, AdUnitConfig> = {
  mining: { richads_1: "410204", monetag_1: "12044377", onclicka: "6153774E4F", richads_2: "410204", monetag_2: "12044377" }
};

// Backward-compatible AD_CODES mapping
export const AD_CODES: Record<string, {
  monetag_zone: string;
  onclicka_zone: string;
  richads_zone: string;
}> = {
  mining: {
    monetag_zone: MINING_ADS.mining.monetag_1,
    onclicka_zone: MINING_ADS.mining.onclicka,
    richads_zone: MINING_ADS.mining.richads_1,
  },
  spin_01: { monetag_zone: SPIN_ADS.spin_01.monetag_1, onclicka_zone: SPIN_ADS.spin_01.onclicka, richads_zone: SPIN_ADS.spin_01.richads_1 },
  spin_02: { monetag_zone: SPIN_ADS.spin_02.monetag_1, onclicka_zone: SPIN_ADS.spin_02.onclicka, richads_zone: SPIN_ADS.spin_02.richads_1 },
  spin_03: { monetag_zone: SPIN_ADS.spin_03.monetag_1, onclicka_zone: SPIN_ADS.spin_03.onclicka, richads_zone: SPIN_ADS.spin_03.richads_1 },
  spin_04: { monetag_zone: SPIN_ADS.spin_04.monetag_1, onclicka_zone: SPIN_ADS.spin_04.onclicka, richads_zone: SPIN_ADS.spin_04.richads_1 },
  spin_05: { monetag_zone: SPIN_ADS.spin_05.monetag_1, onclicka_zone: SPIN_ADS.spin_05.onclicka, richads_zone: SPIN_ADS.spin_05.richads_1 },
  box_01: { monetag_zone: BOX_ADS.box_01.monetag_1, onclicka_zone: BOX_ADS.box_01.onclicka, richads_zone: BOX_ADS.box_01.richads_1 },
  box_02: { monetag_zone: BOX_ADS.box_02.monetag_1, onclicka_zone: BOX_ADS.box_02.onclicka, richads_zone: BOX_ADS.box_02.richads_1 },
  box_03: { monetag_zone: BOX_ADS.box_03.monetag_1, onclicka_zone: BOX_ADS.box_03.onclicka, richads_zone: BOX_ADS.box_03.richads_1 },
  box_04: { monetag_zone: BOX_ADS.box_04.monetag_1, onclicka_zone: BOX_ADS.box_04.onclicka, richads_zone: BOX_ADS.box_04.richads_1 },
  box_05: { monetag_zone: BOX_ADS.box_05.monetag_1, onclicka_zone: BOX_ADS.box_05.onclicka, richads_zone: BOX_ADS.box_05.richads_1 }
};

export function sanitizeAdZoneId(rawId: any, fallbackId: string): string {
  if (!rawId || typeof rawId !== 'string') return fallbackId;
  const trimmed = rawId.trim();
  if (/^(spin|box|mining)_[0-9a-z_]+$/i.test(trimmed)) {
    return fallbackId;
  }
  return trimmed || fallbackId;
}

export interface AdPlacementConfig {
  monetag_zone: string;
  onclicka_zone: string;
  richads_zone: string;
}

export function getAdCodesForPlacement(
  actionType: 'MINING' | 'SPIN' | 'GIFT_BOX',
  targetId?: number
): AdPlacementConfig {
  const num = Math.max(1, Math.min(5, Number(targetId) || 1));
  const padIndex = String(num).padStart(2, '0');

  if (actionType === 'MINING') {
    return AD_CODES.mining;
  } else if (actionType === 'SPIN') {
    return AD_CODES[`spin_${padIndex}`] || AD_CODES.spin_01;
  } else if (actionType === 'GIFT_BOX') {
    return AD_CODES[`box_${padIndex}`] || AD_CODES.box_01;
  }
  return AD_CODES.mining;
}

// =========================================================================
// 🛡️ DAILY NETWORK FREQUENCY CAPPING
// =========================================================================

export const MAX_DAILY_ADS_PER_NETWORK = 3;

export function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

export function getNetworkViewCountToday(userId: string, network: string): number {
  if (typeof window === 'undefined' || !userId) return 0;
  try {
    const today = getTodayKey();
    const raw = localStorage.getItem(`e4f_ad_cap_${userId}_${today}`);
    if (!raw) return 0;
    const counts = JSON.parse(raw);
    return Number(counts[network] || 0);
  } catch {
    return 0;
  }
}

export function incrementNetworkViewCountToday(userId: string, network: string): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const today = getTodayKey();
    const key = `e4f_ad_cap_${userId}_${today}`;
    const raw = localStorage.getItem(key);
    const counts: Record<string, number> = raw ? JSON.parse(raw) : {};
    counts[network] = (Number(counts[network]) || 0) + 1;
    localStorage.setItem(key, JSON.stringify(counts));
  } catch {}
}

export function isNetworkCappedToday(_userId: string, _network: string): boolean {
  // Infinite looping to ensure ads always load
  return false;
}

// =========================================================================
// 🚀 INTRA-FALLBACK WATERFALL BUILDER (5 Tiers: RichAds -> Monetag -> OnClickA -> RichAds -> Monetag)
// =========================================================================

export interface IntraWaterfallTier {
  index: number;
  provider: 'RichAds' | 'Monetag' | 'OnClickA';
  id: string;
  placementKey: string;
  label: string;
}

/**
 * 5 Active Waterfall Tiers per Slot with Box-Specific Primary Network:
 * Box 1 -> Slot 1: RichAds (410202) -> Monetag -> OnClickA -> RichAds -> Monetag
 * Box 2 -> Slot 2: Monetag (12044377) -> OnClickA -> RichAds -> Monetag -> RichAds
 * Box 3 -> Slot 3: OnClickA (6153772) -> RichAds -> Monetag -> RichAds -> Monetag
 * Box 4 -> Slot 4: RichAds (410202) -> Monetag -> RichAds -> Monetag -> OnClickA
 * Box 5 -> Slot 5: Monetag (12044377) -> RichAds -> Monetag -> OnClickA -> RichAds
 */
export function buildIntraWaterfallTiers(
  actionType: 'MINING' | 'SPIN' | 'GIFT_BOX' | 'WITHDRAW' | 'SELL',
  targetId: number | undefined,
  _userId: string,
  _isTelegram: boolean = true,
  dynamicSettings?: Record<string, string>
): IntraWaterfallTier[] {
  const num = Math.max(1, Math.min(5, Number(targetId) || 1));
  const startIndex = num - 1;

  if (actionType === 'GIFT_BOX') {
    const boxMap: Record<number, IntraWaterfallTier> = {
      1: { index: 1, provider: 'RichAds', id: dynamicSettings?.box_01_richads || '410202', placementKey: 'box_01', label: 'RichAds (Box 1)' },
      2: { index: 1, provider: 'Monetag', id: dynamicSettings?.box_02_monetag || '12044377', placementKey: 'box_02', label: 'Monetag (Box 2)' },
      3: { index: 1, provider: 'OnClickA', id: dynamicSettings?.box_03_onclicka || '6153772E4F', placementKey: 'box_03', label: 'OnClickA (Box 3)' },
      4: { index: 1, provider: 'RichAds', id: dynamicSettings?.box_04_richads || '410202', placementKey: 'box_04', label: 'RichAds (Box 4)' },
      5: { index: 1, provider: 'Monetag', id: dynamicSettings?.box_05_monetag || '12044377', placementKey: 'box_05', label: 'Monetag (Box 5)' },
    };
    return [boxMap[num] || boxMap[1]];
  }

  if (actionType === 'SPIN') {
    const spinMap: Record<number, IntraWaterfallTier> = {
      1: { index: 1, provider: 'RichAds', id: dynamicSettings?.spin_01_richads || '410203', placementKey: 'spin_01', label: 'RichAds (Spin 1)' },
      2: { index: 1, provider: 'Monetag', id: dynamicSettings?.spin_02_monetag || '12044377', placementKey: 'spin_02', label: 'Monetag (Spin 2)' },
      3: { index: 1, provider: 'OnClickA', id: dynamicSettings?.spin_03_onclicka || '6153717E4F', placementKey: 'spin_03', label: 'OnClickA (Spin 3)' },
      4: { index: 1, provider: 'RichAds', id: dynamicSettings?.spin_04_richads || '410203', placementKey: 'spin_04', label: 'RichAds (Spin 4)' },
      5: { index: 1, provider: 'Monetag', id: dynamicSettings?.spin_05_monetag || '12044377', placementKey: 'spin_05', label: 'Monetag (Spin 5)' },
    };
    return [spinMap[num] || spinMap[1]];
  }

  // Mining / Withdraw / Sell
  const mining01 = dynamicSettings?.mining_01_richads || MINING_ADS.mining.richads_1 || '410204';
  const mining02 = dynamicSettings?.mining_02_monetag || MINING_ADS.mining.monetag_1 || '12044377';
  const mining03 = dynamicSettings?.mining_03_onclicka || MINING_ADS.mining.onclicka || '6153774E4F';
  const mining04 = dynamicSettings?.mining_04_richads || MINING_ADS.mining.richads_2 || '410204';
  const mining05 = dynamicSettings?.mining_05_monetag || MINING_ADS.mining.monetag_2 || '12044377';

  return [
    { index: 1, provider: 'RichAds', id: mining01, placementKey: 'mining_01', label: 'RichAds (Primary)' },
    { index: 2, provider: 'Monetag', id: mining02, placementKey: 'mining_02', label: 'Monetag (Tier 2)' },
    { index: 3, provider: 'OnClickA', id: mining03, placementKey: 'mining_03', label: 'OnClickA (Tier 3)' },
    { index: 4, provider: 'RichAds', id: mining04, placementKey: 'mining_04', label: 'RichAds (Tier 4)' },
    { index: 5, provider: 'Monetag', id: mining05, placementKey: 'mining_05', label: 'Monetag (Tier 5)' },
  ];
}
