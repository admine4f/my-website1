/**
 * Official Rewarded Ad SDK Service
 * Handles Monetag dynamically created script and window.showMonetagAd()
 * Clean, single-execution to prevent mobile Chrome "Pop-up blocked" warnings.
 */

declare global {
  interface Window {
    show_88?: (zoneId?: string) => Promise<void>;
    show_tag?: (zoneId?: string) => Promise<void>;
    show_12044377?: any;
    showMonetagInsideTelegram?: () => Promise<boolean>;
    showRichAdsInTelegram?: (richadsId?: string | number) => Promise<boolean>;
    showMonetagAd?: (zoneId?: string) => Promise<boolean>;
    Telegram?: any;
    TelegramAdsController?: any;
  }
}

export const DEFAULT_ZONE_ID = '12044377';
export const DEFAULT_APP_ID = '3534792';
export const DEFAULT_DIRECT_LINK = 'https://alwingulla.com/88/12044377';

/**
 * Dynamically creates Monetag script element and appends to document body
 */
export function loadMonetagScript(zoneId: string = DEFAULT_ZONE_ID): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);

    const cleanZone = String(zoneId || DEFAULT_ZONE_ID).trim();

    // Check if official function already exists on window
    if (
      typeof (window as any)[`show_${cleanZone}`] === 'function' ||
      typeof window.show_12044377 === 'function' ||
      typeof window.show_88 === 'function'
    ) {
      return resolve(true);
    }

    const existingScript = document.querySelector(`script[src*="alwingulla.com"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      setTimeout(() => resolve(true), 1200);
      return;
    }

    try {
      const script = document.createElement('script');
      script.src = 'https://alwingulla.com/88/tag.min.js';
      script.setAttribute('data-zone', cleanZone);
      script.setAttribute('data-cfasync', 'false');
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
      setTimeout(() => resolve(true), 1500);
    } catch {
      resolve(false);
    }
  });
}

export const ensureMonetagSdkLoaded = loadMonetagScript;

/**
 * Official Monetag Rewarded Ad trigger:
 * 100% INSIDE Telegram Mini App. Calls window.showMonetagInsideTelegram() or show_12044377('pop')
 */
export async function showMonetagAd(zoneId: string = DEFAULT_ZONE_ID): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const cleanZone = String(zoneId || DEFAULT_ZONE_ID).trim();

  if (typeof window.showMonetagInsideTelegram === 'function') {
    try {
      const res = await window.showMonetagInsideTelegram();
      return Boolean(res);
    } catch (err) {
      console.warn('[showMonetagInsideTelegram error]:', err);
    }
  }

  const showFn =
    window.show_12044377 ||
    (window as any)[`show_${cleanZone}`] ||
    window.show_88;

  if (typeof showFn === 'function') {
    try {
      const res = showFn();
      if (res && typeof res.then === 'function') {
        await res;
      }
      return true;
    } catch (err) {
      console.warn('[Monetag SDK Error]:', err);
      return false;
    }
  }

  return false;
}

// Bind to window.showMonetagAd for global availability
if (typeof window !== 'undefined') {
  window.showMonetagAd = showMonetagAd;
}

/**
 * Returns the effective ad URL for the given zone or direct link
 */
export function getAdTargetUrl(directLink?: string, zoneId: string = DEFAULT_ZONE_ID): string {
  if (directLink && directLink.trim().length > 0) return directLink.trim();
  const clean = String(zoneId || DEFAULT_ZONE_ID).trim();
  return `https://libtl.com/sdk.js?zone=${clean}`;
}

/**
 * Opens the ad directly via Monetag In-App function. Never opens outside Telegram.
 */
export function openAdDirectly(_directLink?: string, zoneId: string = DEFAULT_ZONE_ID): boolean {
  const cleanId = String(zoneId || DEFAULT_ZONE_ID).trim();

  if (typeof window !== 'undefined') {
    if (typeof window.showMonetagInsideTelegram === 'function') {
      window.showMonetagInsideTelegram().catch(() => {});
      return true;
    }
    if (typeof window.showMonetagAd === 'function') {
      window.showMonetagAd(cleanId).catch(() => {});
      return true;
    }
    if (typeof window.show_12044377 === 'function') {
      try {
        window.show_12044377();
      } catch {}
      return true;
    }
  }

  return true;
}
