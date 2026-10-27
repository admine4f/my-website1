// =========================================================================
// 🎯 WATERFALL AD CONFIGURATION (5 TIERS: RichAds -> Monetag -> OnClickA -> RichAds -> Monetag)
// 100% Inside Telegram Mini App • Spin/Box slot #4 = Monetag 12044377 (TADS removed)
// =========================================================================

// Spin 1-5 Waterfall IDs
export let spin_01_richads = '410203';
export let spin_02_monetag = '12044377';
export let spin_03_onclicka = '6153717E4F';
export let spin_04_richads = '12044377';
export let spin_05_monetag = '12044377';

// Gift Box 1-5 Waterfall IDs
export let box_01_richads = '410202';
export let box_02_monetag = '12044377';
export let box_03_onclicka = '6153772E4F';
export let box_04_richads = '12044377';
export let box_05_monetag = '12044377';

// Mining 1-5 Waterfall IDs
export let mining_01_richads = '410204';
export let mining_02_monetag = '12044377';
export let mining_03_onclicka = '6153774E4F';
export let mining_04_richads = '410204';
export let mining_05_monetag = '12044377';

export const RICHADS_PLACEMENTS = ['410202', '410203', '410204', '410260', '410261'];

export interface WaterfallTier {
  index: number;
  provider: 'RichAds' | 'Monetag' | 'OnClickA';
  id: string;
  label: string;
  placementKey?: string;
}

export interface WaterfallResult {
  success: boolean;
  completedTier?: WaterfallTier;
  allFailed?: boolean;
  message?: string;
  error?: string;
}

// Helper: Dynamically fetch & sync updated IDs from Admin Control Panel / Backend / localStorage
export async function syncWaterfallSettings(): Promise<{
  spin: WaterfallTier[];
  box: WaterfallTier[];
}> {
  const cleanId = (v: any) => typeof v === 'string' && !/^(spin|box|mining)_[0-9a-z_]+$/i.test(v.trim()) && v.trim() !== '';

  // 1. Instant check from localStorage
  try {
    if (typeof window !== 'undefined') {
      const local = localStorage.getItem('adGateIds');
      if (local) {
        const p = JSON.parse(local);
        if (cleanId(p.spin_01_richads)) spin_01_richads = p.spin_01_richads;
        if (cleanId(p.spin_02_monetag)) spin_02_monetag = p.spin_02_monetag;
        if (cleanId(p.spin_03_onclicka)) spin_03_onclicka = p.spin_03_onclicka;
        if (cleanId(p.spin_04_richads)) spin_04_richads = p.spin_04_richads;
        if (cleanId(p.spin_05_monetag)) spin_05_monetag = p.spin_05_monetag;

        if (cleanId(p.box_01_richads)) box_01_richads = p.box_01_richads;
        if (cleanId(p.box_02_monetag)) box_02_monetag = p.box_02_monetag;
        if (cleanId(p.box_03_onclicka)) box_03_onclicka = p.box_03_onclicka;
        if (cleanId(p.box_04_richads)) box_04_richads = p.box_04_richads;
        if (cleanId(p.box_05_monetag)) box_05_monetag = p.box_05_monetag;

        if (cleanId(p.mining_01_richads)) mining_01_richads = p.mining_01_richads;
        if (cleanId(p.mining_02_monetag)) mining_02_monetag = p.mining_02_monetag;
        if (cleanId(p.mining_03_onclicka)) mining_03_onclicka = p.mining_03_onclicka;
        if (cleanId(p.mining_04_richads)) mining_04_richads = p.mining_04_richads;
        if (cleanId(p.mining_05_monetag)) mining_05_monetag = p.mining_05_monetag;
      }
    }
  } catch {}

  // 2. Fetch live settings from backend API
  try {
    let res = await fetch('/api/ad-config').catch(() => null);
    if (!res || !res.ok) {
      res = await fetch('/api/system/public-settings').catch(() => null);
    }
    if (res && res.ok) {
      const data = await res.json();
      if (cleanId(data.spin_01_richads)) spin_01_richads = data.spin_01_richads;
      if (cleanId(data.spin_02_monetag)) spin_02_monetag = data.spin_02_monetag;
      if (cleanId(data.spin_03_onclicka)) spin_03_onclicka = data.spin_03_onclicka;
      if (cleanId(data.spin_04_richads)) spin_04_richads = data.spin_04_richads;
      if (cleanId(data.spin_05_monetag)) spin_05_monetag = data.spin_05_monetag;

      if (cleanId(data.box_01_richads)) box_01_richads = data.box_01_richads;
      if (cleanId(data.box_02_monetag)) box_02_monetag = data.box_02_monetag;
      if (cleanId(data.box_03_onclicka)) box_03_onclicka = data.box_03_onclicka;
      if (cleanId(data.box_04_richads)) box_04_richads = data.box_04_richads;
      if (cleanId(data.box_05_monetag)) box_05_monetag = data.box_05_monetag;

      if (cleanId(data.mining_01_richads)) mining_01_richads = data.mining_01_richads;
      if (cleanId(data.mining_02_monetag)) mining_02_monetag = data.mining_02_monetag;
      if (cleanId(data.mining_03_onclicka)) mining_03_onclicka = data.mining_03_onclicka;
      if (cleanId(data.mining_04_richads)) mining_04_richads = data.mining_04_richads;
      if (cleanId(data.mining_05_monetag)) mining_05_monetag = data.mining_05_monetag;
    }
  } catch (e) {
    console.warn('Could not sync waterfall settings from server, using local defaults:', e);
  }

  return {
    spin: getSpinWaterfallTiers(),
    box: getBoxWaterfallTiers(),
  };
}

// Spin 1-5 Dedicated Ads (Waterfall Logic Removed: Each Spin Has Dedicated Ad)
export function getSpinWaterfallTiers(targetSpinNumber?: number): WaterfallTier[] {
  const num = Math.max(1, Math.min(5, Number(targetSpinNumber) || 1));
  const spinMap: Record<number, WaterfallTier> = {
    1: { index: 1, provider: 'RichAds', id: spin_01_richads || '410203', label: 'RichAds (Spin 1)' },
    2: { index: 1, provider: 'Monetag', id: spin_02_monetag || '12044377', label: 'Monetag (Spin 2)' },
    3: { index: 1, provider: 'OnClickA', id: spin_03_onclicka || '6153717E4F', label: 'OnClickA (Spin 3)' },
    4: { index: 1, provider: 'Monetag', id: spin_04_richads || '12044377', label: 'Monetag (Spin 4)' },
    5: { index: 1, provider: 'Monetag', id: spin_05_monetag || '12044377', label: 'Monetag (Spin 5)' },
  };
  return [spinMap[num] || spinMap[1]];
}

// Gift Box 1-5 Dedicated Ads (Waterfall Logic Removed: Box Number = Dedicated Network)
export function getBoxWaterfallTiers(targetBoxNumber?: number): WaterfallTier[] {
  const num = Math.max(1, Math.min(5, Number(targetBoxNumber) || 1));
  const boxMap: Record<number, WaterfallTier> = {
    1: { index: 1, provider: 'RichAds', id: box_01_richads || '410202', label: 'RichAds (Box 1)' },
    2: { index: 1, provider: 'Monetag', id: box_02_monetag || '12044377', label: 'Monetag (Box 2)' },
    3: { index: 1, provider: 'OnClickA', id: box_03_onclicka || '6153772E4F', label: 'OnClickA (Box 3)' },
    4: { index: 1, provider: 'Monetag', id: box_04_richads || '12044377', label: 'Monetag (Box 4)' },
    5: { index: 1, provider: 'Monetag', id: box_05_monetag || '12044377', label: 'Monetag (Box 5)' },
  };
  return [boxMap[num] || boxMap[1]];
}

export function getMiningWaterfallTiers(): WaterfallTier[] {
  return [
    { index: 1, provider: 'RichAds', id: mining_01_richads, label: 'RichAds (Primary)' },
    { index: 2, provider: 'Monetag', id: mining_02_monetag, label: 'Monetag (Tier 2)' },
    { index: 3, provider: 'OnClickA', id: mining_03_onclicka, label: 'OnClickA (Tier 3)' },
    { index: 4, provider: 'RichAds', id: mining_04_richads, label: 'RichAds (Tier 4)' },
    { index: 5, provider: 'Monetag', id: mining_05_monetag, label: 'Monetag (Tier 5)' },
  ];
}

import { ensureMonetagSdkLoaded, showMonetagAd as sdkShowMonetagAd } from './monetagSdk';

export function getRichadsAdUrl(zoneId: string): string {
  const clean = String(zoneId || '410202').trim();
  if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
  return `https://richinfo.co/delivery/site/${clean}`;
}

export function getMonetagAdUrl(zoneId: string): string {
  const clean = String(zoneId || '12044377').trim();
  if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
  return `https://alwingulla.com/88/${clean}`;
}

export function getOnclickaAdUrl(zoneId: string): string {
  const clean = String(zoneId || '6153772').trim();
  if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
  return `https://onclicka.com/delivery/site/${clean}`;
}

export function getProviderAdUrl(provider: 'RichAds' | 'Monetag' | 'OnClickA', zoneId: string): string {
  if (provider === 'RichAds') return getRichadsAdUrl(zoneId);
  if (provider === 'Monetag') return getMonetagAdUrl(zoneId);
  if (provider === 'OnClickA') return getOnclickaAdUrl(zoneId);
  return getMonetagAdUrl(zoneId);
}

/**
 * Opens sponsor ad externally via Telegram WebApp or browser window.
 * Eliminates iframe AccessDenied, ERR_BLOCKED_BY_RESPONSE, and raw code errors.
 */
export function openExternalSponsorAd(url: string) {
  if (!url || typeof window === 'undefined') return;
  // 100% inside Telegram Mini App - external redirect blocked
  console.log('[openExternalSponsorAd] Displayed in-app inside Telegram Mini App:', url);
}

// =========================================================================
// REAL AD HANDLERS (RichAds, Monetag, OnClickA)
// =========================================================================

/**
 * 1. RichAds (Slot 1 & mining slot 4) - plays INSIDE Telegram.
 */
export async function showRichadsAd(
  zoneId: string,
  _timeoutMs: number = 0,
  context?: { actionType?: string; targetId?: number }
): Promise<{ success: boolean; completed: boolean; adUrl: string; reason?: string }> {
  const cleanId = String(zoneId || '410204').trim();

  const adUrl = getRichadsAdUrl(cleanId);
  try {
    const fn = typeof window !== 'undefined' ? (window as any).showRichAdsInTelegram : undefined;
    if (typeof fn !== 'function') return { success: false, completed: false, adUrl, reason: 'RichAds SDK not ready' };
    const ok = await fn(cleanId);
    return ok
      ? { success: true, completed: true, adUrl }
      : { success: false, completed: false, adUrl, reason: (window as any).__e4fRichAdsLast || 'RichAds ad was not completed' };
  } catch (err: any) {
    console.warn('[RichAds Error]:', err);
    return { success: false, completed: false, adUrl, reason: err?.message || 'RichAds failed' };
  }
}

/**
 * 2. Monetag (Slot 2 & 5) - Rewarded Interstitial INSIDE Telegram.
 */
export async function showMonetagAd(
  zoneId: string,
  _timeoutMs: number = 0,
  ymid?: string
): Promise<{ success: boolean; completed: boolean; adUrl: string; reason?: string }> {
  const cleanId = String(zoneId || '12044377').trim();
  const adUrl = getMonetagAdUrl(cleanId);
  try {
    if (typeof window !== 'undefined') {
      if (typeof (window as any).showMonetagInsideTelegram === 'function') {
        const ok = await (window as any).showMonetagInsideTelegram(ymid);
        return ok
          ? { success: true, completed: true, adUrl }
          : { success: false, completed: false, adUrl, reason: 'Monetag ad was not completed' };
      }
      const showFn = (window as any).show_12044377;
      if (typeof showFn === 'function') {
        await (ymid ? showFn({ ymid: String(ymid) }) : showFn());
        return { success: true, completed: true, adUrl };
      }
    }
    return { success: false, completed: false, adUrl, reason: 'Monetag SDK not ready' };
  } catch (err: any) {
    console.warn('[Monetag Error]:', err?.message || err);
    return { success: false, completed: false, adUrl, reason: err?.message || 'Monetag failed' };
  }
}

import { showTmaAdById } from '../components/TmaAdManager';

/**
 * 3. OnClickA (Slot 3) - in-stream TMA rewarded ad INSIDE Telegram.
 */
export async function showOnclickaAd(
  zoneId: string,
  _timeoutMs: number = 0
): Promise<{ success: boolean; completed: boolean; adUrl: string; reason?: string }> {
  const cleanId = String(zoneId || '6153772').trim();
  const adUrl = getOnclickaAdUrl(cleanId);
  try {
    await showTmaAdById(cleanId);
    return { success: true, completed: true, adUrl };
  } catch (err: any) {
    console.warn('[OnClickA ad failed]:', err);
    return { success: false, completed: false, adUrl, reason: err?.message || 'OnClickA failed' };
  }
}

// =========================================================================
// HOUSE AD CONFIGURATION: DEDICATED ADS FOR BOX & SPIN (NO WATERFALL)
// =========================================================================

export const WATERFALL = {
  box1: [
    { network: 'richads', tag: '410202', code: '<script src="https://richinfo.co/richpartners/telegram/js/tg-ob.js?pubId=1025839&appId=9319"></script><script>try{window.TelegramAdsController && window.TelegramAdsController.showRewardedAd(410202);}catch(e){}</script><div style="padding:24px;text-align:center;color:#fff;font-family:sans-serif;"><h3>RichAds In-App Sponsor</h3><p>Zone: 410202</p></div>' },
  ],
  box2: [
    { network: 'monetag', tag: '12044377', code: '<script src="https://libtl.com/sdk.js" data-zone="12044377" data-sdk="show_12044377"></script><script>try{window.show_12044377 && window.show_12044377();}catch(e){}</script><div style="padding:24px;text-align:center;color:#fff;font-family:sans-serif;"><h3>Monetag In-App Sponsor</h3><p>Zone: 12044377</p></div>' },
  ],
  box3: [
    { network: 'onclicka', tag: '6153772E4F', code: '<iframe src="https://highperformanceformat.com/6153772E4F" style="width:100%;height:380px;border:none;"></iframe>' },
  ],
  box4: [
    { network: 'monetag', tag: '12044377', code: '<script src="https://libtl.com/sdk.js" data-zone="12044377" data-sdk="show_12044377"></script><script>try{window.show_12044377 && window.show_12044377();}catch(e){}</script><div style="padding:24px;text-align:center;color:#fff;font-family:sans-serif;"><h3>Monetag In-App Sponsor</h3><p>Zone: 12044377</p></div>' },
  ],
  box5: [
    { network: 'monetag', tag: '12044377', code: '<script src="https://libtl.com/sdk.js" data-zone="12044377" data-sdk="show_12044377"></script><script>try{window.show_12044377 && window.show_12044377();}catch(e){}</script><div style="padding:24px;text-align:center;color:#fff;font-family:sans-serif;"><h3>Monetag In-App Sponsor</h3><p>Zone: 12044377</p></div>' },
  ],
  spin: [
    { network: 'richads', tag: '410203', code: '<script src="https://richinfo.co/richpartners/telegram/js/tg-ob.js?pubId=1025839&appId=9319"></script><script>try{window.TelegramAdsController && window.TelegramAdsController.showRewardedAd(410203);}catch(e){}</script><div style="padding:24px;text-align:center;color:#fff;font-family:sans-serif;"><h3>RichAds In-App Sponsor</h3><p>Zone: 410203</p></div>' },
  ],
  mining: [
    { network: 'richads', tag: '410204', code: '<script src="https://richinfo.co/richpartners/telegram/js/tg-ob.js?pubId=1025839&appId=9319"></script><script>try{window.TelegramAdsController && window.TelegramAdsController.showRewardedAd(410204);}catch(e){}</script><div style="padding:24px;text-align:center;color:#fff;font-family:sans-serif;"><h3>RichAds In-App Sponsor</h3><p>Zone: 410204</p></div>' },
    { network: 'monetag', tag: '12044377', code: '<script src="https://libtl.com/sdk.js" data-zone="12044377" data-sdk="show_12044377"></script><script>try{window.show_12044377 && window.show_12044377();}catch(e){}</script><div style="padding:24px;text-align:center;color:#fff;font-family:sans-serif;"><h3>Monetag In-App Sponsor</h3><p>Zone: 12044377</p></div>' },
    { network: 'onclicka', tag: '6153774E4F', code: '<iframe src="https://highperformanceformat.com/6153774E4F" style="width:100%;height:380px;border:none;"></iframe>' },
    { network: 'richads', tag: '410204', code: '<script src="https://richinfo.co/richpartners/telegram/js/tg-ob.js?pubId=1025839&appId=9319"></script><script>try{window.TelegramAdsController && window.TelegramAdsController.showRewardedAd(410204);}catch(e){}</script><div style="padding:24px;text-align:center;color:#fff;font-family:sans-serif;"><h3>RichAds In-App Sponsor</h3><p>Zone: 410204</p></div>' },
    { network: 'monetag', tag: '12044377', code: '<script src="https://libtl.com/sdk.js" data-zone="12044377" data-sdk="show_12044377"></script><script>try{window.show_12044377 && window.show_12044377();}catch(e){}</script><div style="padding:24px;text-align:center;color:#fff;font-family:sans-serif;"><h3>Monetag In-App Sponsor</h3><p>Zone: 12044377</p></div>' },
  ]
};

export type HouseType = 'box1' | 'box2' | 'box3' | 'box4' | 'box5' | 'spin' | 'mining';

export function getAdForHouse(house: HouseType | string, attempt: number) {
  const list = (WATERFALL as any)[house] || WATERFALL.mining;
  if (house !== 'mining') {
    return list[0];
  }
  return list[attempt % list.length] || list[0];
}
