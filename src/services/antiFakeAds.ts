// =========================================================================
// E4F - AD HELPERS (client side)
// The browser NEVER decides rewards, daily limits or balances. Everything that is worth money is
// verified and stored on the server (see /api/ads/session/* and the spin / gift box / mining routes).
// This file only keeps the in-app redirect guard so ads can never open an external page.
// =========================================================================

let adStartTime = Date.now();
export function generateAdToken() {
  adStartTime = Date.now();
  return 'e4f_' + adStartTime;
}
export function verifyAdWatch() {
  return { valid: true, watchedSeconds: Math.floor((Date.now() - adStartTime) / 1000) };
}

// Redirect guard: external navigation is blocked ONLY while an ad is playing.
// (Old version replaced window.open with a dead function for the whole session, which broke ad SDKs and other links.)
let adGuardDepth = 0;
let adGuardInstalled = false;
export function beginAdRedirectGuard() { adGuardDepth++; }
export function endAdRedirectGuard() { adGuardDepth = Math.max(0, adGuardDepth - 1); }
export function blockExternalRedirect() {
  if (adGuardInstalled || typeof window === 'undefined') return;
  adGuardInstalled = true;
  try {
    const origOpen = window.open.bind(window);
    (window as any).open = (...args: any[]) => {
      if (adGuardDepth > 0) { console.warn('[AdGuard] blocked window.open during ad'); return null; }
      return (origOpen as any)(...args);
    };
  } catch (e) {}
  try {
    const wa = (window as any).Telegram?.WebApp;
    if (wa) {
      ['openLink', 'openTelegramLink'].forEach((fnName) => {
        const orig = wa[fnName];
        if (typeof orig === 'function') {
          wa[fnName] = function (...a: any[]) {
            if (adGuardDepth > 0) { console.warn('[AdGuard] blocked ' + fnName + ' during ad'); return; }
            return orig.apply(wa, a);
          };
        }
      });
    }
  } catch (e) {}
  if (typeof document !== 'undefined') {
    try {
      document.addEventListener('click', (e) => {
        if (adGuardDepth <= 0) return;
        const el = e.target as HTMLElement;
        const a = el?.closest ? (el.closest('a') as HTMLAnchorElement) : null;
        if (a && a.target === '_blank') {
          e.preventDefault();
          a.setAttribute('target', '_self');
        }
      }, true);
    } catch (e) {}
  }
}


export const todayUTC = (): string => new Date().toISOString().split('T')[0];

// Daily "done" marks are cached in localStorage by UTC date (resets automatically at UTC 00:00).
// The server stays the authoritative counter; this only makes the UI instant and survives reloads.
const doneKey = (type: string, key: string | number, userId?: string) => `E4F_done_${userId || 'u'}_${type}_${key}`;
export async function isDone(type: 'gift' | 'spin' | 'mining', key: string | number, userId?: string): Promise<boolean> {
  try { return localStorage.getItem(doneKey(type, key, userId)) === todayUTC(); } catch { return false; }
}
export async function setDone(type: 'gift' | 'spin' | 'mining', key: string | number, userId?: string): Promise<void> {
  try { localStorage.setItem(doneKey(type, key, userId), todayUTC()); } catch { /* storage unavailable */ }
}
