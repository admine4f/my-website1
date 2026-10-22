import React, { useEffect, useState } from 'react';

// =========================================================================
// 🎯 TADS INSIDE-TELEGRAM AD GATE ENGINE
// 100% Inside Telegram Mini App • No External Redirect • No Waterfall
// Slot #4 Replacement for RichAds (Widget ID: 12823)
// =========================================================================

export interface AdGateConfig {
  mining_01_richads: string;
  mining_02_monetag: string;
  mining_03_onclicka: string;
  mining_04_richads: string;
  mining_05_monetag: string;
  spin_01_richads: string;
  spin_02_monetag: string;
  spin_03_onclicka: string;
  spin_04_richads: string;
  spin_05_monetag: string;
  box_01_richads: string;
  box_02_monetag: string;
  box_03_onclicka: string;
  box_04_richads: string;
  box_05_monetag: string;
  miningAdDuration: number;
  spinAdDuration: number;
  giftBoxAdDuration: number;
}

export const DEFAULT_AD_GATE_CONFIG: AdGateConfig = {
  mining_01_richads: '410204',
  mining_02_monetag: '12044377',
  mining_03_onclicka: '6153774E4F',
  mining_04_richads: '12823', // Default set to TADS 12823
  mining_05_monetag: '12044377',
  spin_01_richads: '410203',
  spin_02_monetag: '12044377',
  spin_03_onclicka: '6153717E4F',
  spin_04_richads: '12823', // Default set to TADS 12823
  spin_05_monetag: '12044377',
  box_01_richads: '410202',
  box_02_monetag: '12044377',
  box_03_onclicka: '6153772E4F',
  box_04_richads: '12823', // Default set to TADS 12823
  box_05_monetag: '12044377',
  miningAdDuration: 30,
  spinAdDuration: 30,
  giftBoxAdDuration: 30,
};

/**
 * Check if the given ad ID is for TADS:
 * "if (adId === '12823' || adId.length === 5 && adId.startsWith('12'))"
 */
export function isTadsAd(adId?: string | number): boolean {
  if (!adId) return false;
  const s = String(adId).trim();
  return s === '12823' || (s.length === 5 && s.startsWith('12'));
}

/**
 * Fetch latest Ad IDs & Durations with Instant Live Update:
 * Reads from localStorage key "adGateIds" and syncs with /api/ad-config or /api/system/public-settings.
 */
export function getStoredAdGateConfig(): AdGateConfig {
  if (typeof window === 'undefined') return DEFAULT_AD_GATE_CONFIG;
  try {
    const raw = localStorage.getItem('adGateIds');
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_AD_GATE_CONFIG, ...parsed };
    }
  } catch {}
  return DEFAULT_AD_GATE_CONFIG;
}

export async function fetchLiveAdGateConfig(): Promise<AdGateConfig> {
  const current = getStoredAdGateConfig();
  if (typeof window === 'undefined') return current;

  try {
    // Try /api/ad-config first
    let res = await fetch('/api/ad-config').catch(() => null);
    if (!res || !res.ok) {
      res = await fetch('/api/system/public-settings').catch(() => null);
    }

    if (res && res.ok) {
      const data = await res.json();
      const clean = (v: any, fallback: string) =>
        typeof v === 'string' && v.trim() && !/^(spin|box|mining)_[0-9a-z_]+$/i.test(v.trim()) ? v.trim() : fallback;

      const merged: AdGateConfig = {
        mining_01_richads: clean(data.mining_01_richads, current.mining_01_richads),
        mining_02_monetag: clean(data.mining_02_monetag, current.mining_02_monetag),
        mining_03_onclicka: clean(data.mining_03_onclicka, current.mining_03_onclicka),
        mining_04_richads: clean(data.mining_04_richads, current.mining_04_richads),
        mining_05_monetag: clean(data.mining_05_monetag, current.mining_05_monetag),
        spin_01_richads: clean(data.spin_01_richads, current.spin_01_richads),
        spin_02_monetag: clean(data.spin_02_monetag, current.spin_02_monetag),
        spin_03_onclicka: clean(data.spin_03_onclicka, current.spin_03_onclicka),
        spin_04_richads: clean(data.spin_04_richads, current.spin_04_richads),
        spin_05_monetag: clean(data.spin_05_monetag, current.spin_05_monetag),
        box_01_richads: clean(data.box_01_richads, current.box_01_richads),
        box_02_monetag: clean(data.box_02_monetag, current.box_02_monetag),
        box_03_onclicka: clean(data.box_03_onclicka, current.box_03_onclicka),
        box_04_richads: clean(data.box_04_richads, current.box_04_richads),
        box_05_monetag: clean(data.box_05_monetag, current.box_05_monetag),
        miningAdDuration: Number(data.miningAdDuration || data.miningAdDurationSeconds || data.adMiningDurationSeconds || current.miningAdDuration || 30),
        spinAdDuration: Number(data.spinAdDuration || data.spinAdDurationSeconds || current.spinAdDuration || 30),
        giftBoxAdDuration: Number(data.giftBoxAdDuration || data.giftBoxAdDurationSeconds || current.giftBoxAdDuration || 30),
      };

      try {
        localStorage.setItem('adGateIds', JSON.stringify(merged));
      } catch {}
      return merged;
    }
  } catch (e) {
    console.warn('[AdGate] Failed to fetch live config, using cached:', e);
  }

  return current;
}

/**
 * Get configured duration for specific ad gate:
 * First checks Admin input in DOM if present, then localStorage, fallback 30s.
 */
export function getDurationForAction(type: 'MINING' | 'SPIN' | 'GIFT_BOX'): number {
  if (typeof document !== 'undefined') {
    if (type === 'MINING') {
      const el = document.getElementById('custom_mining_duration') as HTMLInputElement | null;
      if (el && el.value) {
        const val = parseInt(el.value, 10);
        if (val > 0) return val;
      }
    } else if (type === 'SPIN') {
      const el = document.getElementById('custom_spin_duration') as HTMLInputElement | null;
      if (el && el.value) {
        const val = parseInt(el.value, 10);
        if (val > 0) return val;
      }
    } else if (type === 'GIFT_BOX') {
      const el = document.getElementById('custom_gift_duration') as HTMLInputElement | null;
      if (el && el.value) {
        const val = parseInt(el.value, 10);
        if (val > 0) return val;
      }
    }
  }

  const cfg = getStoredAdGateConfig();
  if (type === 'MINING') return cfg.miningAdDuration || 30;
  if (type === 'SPIN') return cfg.spinAdDuration || 30;
  return cfg.giftBoxAdDuration || 30;
}

// =========================================================================
// TADS OVERLAY RUNNER (100% Inside Telegram Mini App)
// =========================================================================

export interface ShowTadsOptions {
  containerId: string;
  widgetId: string;
  durationSeconds: number;
  title: string;
  actionName: string;
}

export function showTadsOverlay(options: ShowTadsOptions): Promise<boolean> {
  const { containerId, widgetId, durationSeconds, title, actionName } = options;

  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(true);
      return;
    }

    // Clean up any existing overlay
    const oldOverlay = document.getElementById('tads-ad-gate-overlay');
    if (oldOverlay) oldOverlay.remove();

    // 1. Root Modal Overlay
    const overlay = document.createElement('div');
    overlay.id = 'tads-ad-gate-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(7, 11, 20, 0.96);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      z-index: 99999999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 16px;
      box-sizing: border-box;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #F1F5F9;
      user-select: none;
      -webkit-user-select: none;
    `;

    // 2. Card Container
    const card = document.createElement('div');
    card.style.cssText = `
      width: 100%;
      max-width: 380px;
      max-height: 92vh;
      background: #0C1326;
      border: 1px solid rgba(245, 158, 11, 0.4);
      border-radius: 24px;
      padding: 20px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(245, 158, 11, 0.15);
      position: relative;
      overflow-y: auto;
      box-sizing: border-box;
    `;

    // Top Header with Title and Disabled Close Button
    const topBar = document.createElement('div');
    topBar.style.cssText = `
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    `;

    const titleEl = document.createElement('div');
    titleEl.style.cssText = `
      font-size: 13px;
      font-weight: 800;
      color: #F8FAFC;
      display: flex;
      align-items: center;
      gap: 6px;
    `;
    titleEl.innerHTML = `<span>🛡️</span> <span>${title}</span>`;

    const closeBtn = document.createElement('button');
    closeBtn.id = 'tads-close-button';
    closeBtn.innerText = '✕';
    closeBtn.disabled = true;
    closeBtn.title = 'Watch ad to the end to close';
    closeBtn.style.cssText = `
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #94A3B8;
      font-size: 13px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: not-allowed;
      opacity: 0.4;
      transition: all 0.2s;
    `;

    topBar.appendChild(titleEl);
    topBar.appendChild(closeBtn);

    // Countdown Timer Banner
    const timerBanner = document.createElement('div');
    timerBanner.id = 'tads-countdown-banner';
    timerBanner.style.cssText = `
      width: 100%;
      padding: 10px 14px;
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.05));
      border: 1px solid rgba(245, 158, 11, 0.35);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
      box-sizing: border-box;
    `;

    const timerLabel = document.createElement('div');
    timerLabel.style.cssText = `
      font-size: 12px;
      font-weight: 800;
      color: #F59E0B;
      display: flex;
      align-items: center;
      gap: 6px;
    `;
    timerLabel.innerHTML = `<span>⏱️</span> <span id="tads-timer-text">Ad Gate: ${durationSeconds}s Watch Time</span>`;

    const badge = document.createElement('div');
    badge.style.cssText = `
      font-size: 10px;
      font-weight: 700;
      color: #38BDF8;
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.3);
      padding: 2px 8px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;
    badge.innerText = 'TADS INSIDE';

    timerBanner.appendChild(timerLabel);
    timerBanner.appendChild(badge);

    // Progress bar
    const progressTrack = document.createElement('div');
    progressTrack.style.cssText = `
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 9999px;
      overflow: hidden;
      margin-bottom: 14px;
    `;
    const progressBar = document.createElement('div');
    progressBar.id = 'tads-progress-fill';
    progressBar.style.cssText = `
      width: 0%;
      height: 100%;
      background: linear-gradient(to right, #F59E0B, #10B981);
      transition: width 1s linear;
    `;
    progressTrack.appendChild(progressBar);

    // Ad Placement Container: specific id requested by user
    const adContainer = document.createElement('div');
    adContainer.id = containerId;
    adContainer.style.cssText = `
      width: 100%;
      min-height: 250px;
      background: rgba(0, 0, 0, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
      margin-bottom: 14px;
      padding: 8px;
      box-sizing: border-box;
    `;

    // Inner placeholder while widget renders
    const adPlaceholder = document.createElement('div');
    adPlaceholder.id = 'tads-ad-placeholder';
    adPlaceholder.style.cssText = `
      text-align: center;
      padding: 20px 10px;
      color: #94A3B8;
      font-size: 11px;
    `;
    adPlaceholder.innerHTML = `
      <div style="font-size: 24px; margin-bottom: 8px;">📡</div>
      <div style="font-weight: 700; color: #F8FAFC; margin-bottom: 4px;">TADS In-App Ad Stream</div>
      <div>Loading widget #${widgetId}...</div>
    `;
    adContainer.appendChild(adPlaceholder);

    // Action Confirmation Button (Starts Disabled, enabled on finish)
    const actionBtn = document.createElement('button');
    actionBtn.id = 'tads-action-btn';
    actionBtn.disabled = true;
    actionBtn.innerText = `Please wait ${durationSeconds}s...`;
    actionBtn.style.cssText = `
      width: 100%;
      padding: 12px 0;
      border-radius: 14px;
      font-size: 13px;
      font-weight: 800;
      border: none;
      background: #334155;
      color: #94A3B8;
      cursor: not-allowed;
      transition: all 0.25s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    `;

    card.appendChild(topBar);
    card.appendChild(timerBanner);
    card.appendChild(progressTrack);
    card.appendChild(adContainer);
    card.appendChild(actionBtn);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    let secondsLeft = Math.max(1, durationSeconds);
    let isFinished = false;
    let timer: any = null;

    const cleanup = () => {
      if (timer) clearInterval(timer);
      overlay.remove();
    };

    const finishSuccess = () => {
      if (isFinished) return;
      isFinished = true;
      cleanup();
      resolve(true);
    };

    // Callback if ad not found: "If ad not found (onAdsNotFound), close and still start mining"
    (window as any).onAdsNotFound = () => {
      console.warn(`[TADS] onAdsNotFound invoked for widget ${widgetId}. Closing overlay and continuing action.`);
      finishSuccess();
    };

    // Load TADS widget script dynamically: https://w.tads.me/widget/{widgetId}.js
    const scriptId = `tads-widget-script-${widgetId}`;
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://w.tads.me/widget/${widgetId}.js`;
      script.async = true;
      script.onerror = () => {
        console.warn(`[TADS] Primary widget script 404/failed, falling back to universal widget.js`);
        // Fallback to universal script
        const fallbackScript = document.createElement('script');
        fallbackScript.src = 'https://w.tads.me/widget.js';
        fallbackScript.async = true;
        fallbackScript.onload = () => {
          try {
            if ((window as any).tads?.ads?.init) {
              (window as any).tads.ads.init({
                widgetId,
                onAdsNotFound: (window as any).onAdsNotFound,
              });
            }
          } catch (e) {
            console.warn('[TADS] Init fallback warning:', e);
          }
        };
        document.body.appendChild(fallbackScript);
      };
      document.body.appendChild(script);
    }

    // Timer Interval
    timer = setInterval(() => {
      secondsLeft -= 1;
      const timerText = document.getElementById('tads-timer-text');
      const progressFill = document.getElementById('tads-progress-fill');
      const actionBtnEl = document.getElementById('tads-action-btn') as HTMLButtonElement | null;
      const closeBtnEl = document.getElementById('tads-close-button') as HTMLButtonElement | null;

      const elapsed = durationSeconds - secondsLeft;
      const pct = Math.min(100, Math.round((elapsed / durationSeconds) * 100));

      if (progressFill) progressFill.style.width = `${pct}%`;

      if (secondsLeft > 0) {
        if (timerText) timerText.innerText = `Ad Gate: ${secondsLeft}s Watch Time`;
        if (actionBtnEl) actionBtnEl.innerText = `Please wait ${secondsLeft}s...`;
      } else {
        clearInterval(timer);
        if (timerText) timerText.innerText = 'Completed! Reward Unlocked';
        if (progressFill) progressFill.style.width = '100%';

        if (closeBtnEl) {
          closeBtnEl.disabled = false;
          closeBtnEl.style.cursor = 'pointer';
          closeBtnEl.style.opacity = '1';
          closeBtnEl.style.color = '#F8FAFC';
          closeBtnEl.onclick = finishSuccess;
        }

        if (actionBtnEl) {
          actionBtnEl.disabled = false;
          actionBtnEl.innerText = `✓ Continue to ${actionName}`;
          actionBtnEl.style.background = 'linear-gradient(to right, #10B981, #059669)';
          actionBtnEl.style.color = '#FFFFFF';
          actionBtnEl.style.cursor = 'pointer';
          actionBtnEl.style.boxShadow = '0 0 16px rgba(16, 185, 129, 0.4)';
          actionBtnEl.onclick = finishSuccess;
        }

        // Auto close after brief 500ms delay if user doesn't tap button
        setTimeout(() => {
          finishSuccess();
        }, 600);
      }
    }, 1000);
  });
}

// =========================================================================
// 🎯 ONE UNIVERSAL FUNCTION: showTadsAd(type, boxNumber, onComplete)
// =========================================================================

/**
 * 3. Make ONE universal function showTadsAd(type, boxNumber, onComplete)
 */
export function showTadsAd(
  type: 'mining' | 'spin' | 'gift' | string,
  boxNumber?: number | string | null,
  onComplete?: () => void
): void {
  // Create inside-app overlay
  let containerId = 'tads-12823-' + type;
  if (boxNumber) containerId += '-' + boxNumber;

  const existing = document.getElementById('tads-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tads-modal-overlay';
  overlay.setAttribute(
    'style',
    'position:fixed;inset:0;background:rgba(0,0,0,0.98);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;'
  );
  overlay.innerHTML = `
    <div style="background:white;border-radius:12px;padding:10px;min-width:300px;min-height:250px;display:flex;align-items:center;justify-content:center;">
      <div id="${containerId}"></div>
    </div>
    <p id="tads-countdown" style="color:white;margin-top:20px;font-size:20px;font-weight:bold;">30s</p>
    <p style="color:gray;margin-top:5px;">Ad from TADS - Box #4</p>
  `;
  document.body.appendChild(overlay);

  // Show TADS Ad
  try {
    if ((window as any).tads && (window as any).tads.show) {
      (window as any).tads.show('12823', containerId);
    } else if ((window as any).tadsWidget) {
      (window as any).tadsWidget('12823', containerId);
    } else if ((window as any).tads && (window as any).tads.ads?.init) {
      (window as any).tads.ads.init({ widgetId: '12823', containerId });
    }
  } catch (e) {
    console.log('TADS loading', e);
  }

  // Countdown Timer - read duration from Admin inputs
  let duration = 30;
  if (type === 'mining') duration = parseInt((document.getElementById('custom_mining_duration') as HTMLInputElement)?.value || '30');
  if (type === 'spin') duration = parseInt((document.getElementById('custom_spin_duration') as HTMLInputElement)?.value || '30');
  if (type === 'gift') duration = parseInt((document.getElementById('custom_gift_duration') as HTMLInputElement)?.value || '30');

  let timeLeft = isNaN(duration) || duration <= 0 ? 30 : duration;
  const countdownEl = document.getElementById('tads-countdown');
  let isDone = false;

  const finish = () => {
    if (isDone) return;
    isDone = true;
    if (timer) clearInterval(timer);
    overlay.remove();
    if (onComplete) onComplete();
  };

  const timer = setInterval(() => {
    timeLeft--;
    if (countdownEl) countdownEl.innerText = timeLeft + 's - Please Wait';
    if (timeLeft <= 0) {
      finish();
    }
  }, 1000);

  // If ad not found after 5s, still allow to continue after timer
  setTimeout(() => {
    if (!document.getElementById(containerId)?.innerHTML) {
      console.log('TADS ad not found, but timer will continue');
    }
  }, 5000);

  // Callback safety if onAdsNotFound occurs
  (window as any).onAdsNotFound = () => {
    console.log('[TADS] onAdsNotFound invoked');
  };
}

/**
 * Helper to fetch latest Slot ID from localStorage or settings
 */
export function getAdId(key: string): string {
  if (typeof window === 'undefined') return '12823';
  const cleanKey = key.toLowerCase().replace(/[^a-z0-9_]/g, '');
  try {
    const raw = localStorage.getItem('adGateIds');
    if (raw) {
      const data = JSON.parse(raw);
      if (cleanKey === 'mining_04' || cleanKey === 'mining_04_richads') {
        return String(data.mining_04_richads || data.mining_04 || '12823');
      }
      if (cleanKey === 'spin_04' || cleanKey === 'spin_04_richads') {
        return String(data.spin_04_richads || data.spin_04 || '12823');
      }
      if (cleanKey === 'box_04' || cleanKey === 'box_04_richads') {
        return String(data.box_04_richads || data.box_04 || '12823');
      }
      if (data[cleanKey]) return String(data[cleanKey]);
      if (data[`${cleanKey}_richads`]) return String(data[`${cleanKey}_richads`]);
    }
  } catch {}

  if (cleanKey === 'mining_04' || cleanKey === 'mining_04_richads') return '12823';
  if (cleanKey === 'spin_04' || cleanKey === 'spin_04_richads') return '12823';
  if (cleanKey === 'box_04' || cleanKey === 'box_04_richads') return '12823';

  return '12823';
}

// =========================================================================
// 🎯 3 FUNCTIONS REQUESTED FOR MiningButton.tsx, SpinWheel.tsx, GiftBox.tsx
// =========================================================================

/**
 * 1. For Mining: showMiningTadsAd()
 */
export function showMiningTadsAd(onComplete?: () => void): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    showTadsAd('mining', null, () => {
      if (onComplete) onComplete();
      resolve(true);
    });
  });
}

/**
 * 2. For Spin: showSpinTadsAd()
 */
export function showSpinTadsAd(onComplete?: () => void): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    showTadsAd('spin', null, () => {
      if (onComplete) onComplete();
      resolve(true);
    });
  });
}

/**
 * 3. For Gift Box (Box 1-5): showGiftTadsAd(boxNumber)
 */
export function showGiftTadsAd(boxNumber: number, onComplete?: () => void): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    showTadsAd('gift', boxNumber, () => {
      if (onComplete) onComplete();
      resolve(true);
    });
  });
}

/**
 * Context router to automatically trigger the appropriate Tads function
 */
export async function showTadsAdByContext(
  _widgetId: string,
  actionType?: string,
  targetId?: number
): Promise<boolean> {
  if (actionType === 'SPIN') {
    return showSpinTadsAd();
  }
  if (actionType === 'GIFT_BOX') {
    return showGiftTadsAd(targetId || 1);
  }
  return showMiningTadsAd();
}

// React Component Wrapper for AdGate
export const AdGate: React.FC<{
  isOpen: boolean;
  actionType: 'MINING' | 'SPIN' | 'GIFT_BOX';
  targetId?: number;
  onSuccess: () => void;
  onClose: () => void;
}> = ({ isOpen, actionType, targetId, onSuccess, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    const run = async () => {
      let ok = false;
      if (actionType === 'MINING') {
        ok = await showMiningTadsAd();
      } else if (actionType === 'SPIN') {
        ok = await showSpinTadsAd();
      } else {
        ok = await showGiftTadsAd(targetId || 1);
      }
      if (active) {
        if (ok) onSuccess();
        else onClose();
      }
    };
    run();

    return () => {
      active = false;
    };
  }, [isOpen, actionType, targetId, onSuccess, onClose]);

  return null;
};

export default AdGate;
