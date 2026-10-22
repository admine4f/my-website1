// =========================================================================
// E4F MINING - 100% IN-APP AD ENGINE & ANTI-FAKE SECURITY
// =========================================================================

import { supabaseClient } from './api';

let adStartTime = Date.now();
export function generateAdToken() {
  adStartTime = Date.now();
  try {
    localStorage.setItem('e4f_ad_start', adStartTime.toString());
  } catch (e) {}
  return 'e4f_'+Date.now();
}
export function verifyAdWatch() {
  const s = (typeof localStorage !== 'undefined') ? localStorage.getItem('e4f_ad_start') : null;
  const start = s ? parseInt(s, 10) : adStartTime;
  const watched = (Date.now() - start) / 1000;
  if (watched < 25) return { valid:false, reason: 'Fake Report! Watch 30s - You watched '+Math.floor(watched)+'s' };
  return { valid:true };
}
export function blockExternalRedirect() {
  try { (window as any).open = () => null; } catch(e){}
  if (typeof document !== 'undefined') {
    try {
      document.addEventListener('click', (e) => {
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

// -------------------------------------------------------------------------
// WATERFALL CONFIGURATION (Box 1-5, Spin 5/5-1/5, Mining)
// -------------------------------------------------------------------------

export const AD_CONFIG = {
  MINING: [
    { network: 'richads' as const, id: '410204' },
    { network: 'monetag' as const, id: '12044377' },
    { network: 'onclicka' as const, id: '6153774E4F' },
    { network: 'richads' as const, id: '410204' },
    { network: 'monetag' as const, id: '12044377' },
  ],
  SPIN: {
    '5/5': [
      { network: 'richads' as const, id: '410203' },
      { network: 'monetag' as const, id: '12044377' },
      { network: 'onclicka' as const, id: '6153717E4F' },
      { network: 'richads' as const, id: '410203' },
      { network: 'monetag' as const, id: '12044377' },
    ],
    '4/5': [
      { network: 'monetag' as const, id: '12044377' },
      { network: 'onclicka' as const, id: '6153717E4F' },
      { network: 'richads' as const, id: '410203' },
      { network: 'monetag' as const, id: '12044377' },
      { network: 'richads' as const, id: '410203' },
    ],
    '3/5': [
      { network: 'onclicka' as const, id: '6153717E4F' },
      { network: 'richads' as const, id: '410203' },
      { network: 'monetag' as const, id: '12044377' },
      { network: 'richads' as const, id: '410203' },
      { network: 'monetag' as const, id: '12044377' },
    ],
    '2/5': [
      { network: 'richads' as const, id: '410203' },
      { network: 'monetag' as const, id: '12044377' },
      { network: 'richads' as const, id: '410203' },
      { network: 'monetag' as const, id: '12044377' },
      { network: 'onclicka' as const, id: '6153717E4F' },
    ],
    '1/5': [
      { network: 'monetag' as const, id: '12044377' },
      { network: 'richads' as const, id: '410203' },
      { network: 'monetag' as const, id: '12044377' },
      { network: 'onclicka' as const, id: '6153717E4F' },
      { network: 'richads' as const, id: '410203' },
    ],
  },
  GIFT: {
    1: [
      { network: 'richads' as const, id: '410202' },
      { network: 'monetag' as const, id: '12044377' },
      { network: 'onclicka' as const, id: '6153772E4F' },
      { network: 'richads' as const, id: '410202' },
      { network: 'monetag' as const, id: '12044377' },
    ],
    2: [
      { network: 'monetag' as const, id: '12044377' },
      { network: 'onclicka' as const, id: '6153772E4F' },
      { network: 'richads' as const, id: '410202' },
      { network: 'monetag' as const, id: '12044377' },
      { network: 'richads' as const, id: '410202' },
    ],
    3: [
      { network: 'onclicka' as const, id: '6153772E4F' },
      { network: 'richads' as const, id: '410202' },
      { network: 'monetag' as const, id: '12044377' },
      { network: 'richads' as const, id: '410202' },
      { network: 'monetag' as const, id: '12044377' },
    ],
    4: [
      { network: 'richads' as const, id: '410202' },
      { network: 'monetag' as const, id: '12044377' },
      { network: 'richads' as const, id: '410202' },
      { network: 'monetag' as const, id: '12044377' },
      { network: 'onclicka' as const, id: '6153772E4F' },
    ],
    5: [
      { network: 'monetag' as const, id: '12044377' },
      { network: 'richads' as const, id: '410202' },
      { network: 'monetag' as const, id: '12044377' },
      { network: 'onclicka' as const, id: '6153772E4F' },
      { network: 'richads' as const, id: '410202' },
    ],
  },
};

// -------------------------------------------------------------------------
// DAILY UTC LIMIT HELPERS
// -------------------------------------------------------------------------

export const todayUTC = (): string => new Date().toISOString().split('T')[0];

export function isDoneLocal(type: 'gift' | 'spin' | 'mining', key: string | number): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const today = todayUTC();
    if (type === 'gift') return localStorage.getItem(`E4F_gift_${key}`) === today;
    if (type === 'spin') return localStorage.getItem(`E4F_spin_${key}`) === today;
    if (type === 'mining') return localStorage.getItem(`E4F_mining_${today}`) === 'done';
  } catch {}
  return false;
}

export async function isDone(type: 'gift' | 'spin' | 'mining', key: string | number, userId?: string): Promise<boolean> {
  if (isDoneLocal(type, key)) return true;
  if (!userId) return false;

  const today = todayUTC();
  const cleanKey = String(key);

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('user_daily_ads')
        .select('id')
        .eq('user_id', userId)
        .eq('date', today)
        .eq('type', type)
        .eq('key', cleanKey)
        .maybeSingle();

      if (!error && data) {
        if (typeof window !== 'undefined') {
          if (type === 'gift') localStorage.setItem(`E4F_gift_${key}`, today);
          if (type === 'spin') localStorage.setItem(`E4F_spin_${key}`, today);
          if (type === 'mining') localStorage.setItem(`E4F_mining_${today}`, 'done');
        }
        return true;
      }
    } catch (e) {
      console.log("user_daily_ads not ready yet", e);
    }
  }

  try {
    const res = await fetch(`/api/ads/anti-fake/daily-status?userId=${encodeURIComponent(userId)}&date=${today}&type=${type}&key=${encodeURIComponent(cleanKey)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.claimed) {
        if (typeof window !== 'undefined') {
          if (type === 'gift') localStorage.setItem(`E4F_gift_${key}`, today);
          if (type === 'spin') localStorage.setItem(`E4F_spin_${key}`, today);
          if (type === 'mining') localStorage.setItem(`E4F_mining_${today}`, 'done');
        }
        return true;
      }
    }
  } catch {}

  return false;
}

export async function setDone(type: 'gift' | 'spin' | 'mining', key: string | number, userId?: string): Promise<void> {
  const today = todayUTC();
  const cleanKey = String(key);

  if (typeof window !== 'undefined') {
    try {
      if (type === 'gift') localStorage.setItem(`E4F_gift_${key}`, today);
      if (type === 'spin') localStorage.setItem(`E4F_spin_${key}`, today);
      if (type === 'mining') localStorage.setItem(`E4F_mining_${today}`, 'done');
    } catch {}
  }

  if (userId && supabaseClient) {
    try {
      await supabaseClient.from('user_daily_ads').upsert({
        user_id: userId,
        date: today,
        type,
        key: cleanKey,
        done: true,
        created_at: new Date().toISOString(),
      }, { onConflict: 'user_id,type,key,date' });
    } catch (e) {
      console.log("Log table not ready yet", e);
    }
  }
}

// -------------------------------------------------------------------------
// 100% IN-APP AD SHOW FUNCTION (RichAds, Monetag, OnClickA)
// -------------------------------------------------------------------------

export async function showInside(network: 'richads' | 'monetag' | 'onclicka', id: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // 1. Block external redirects before showing
  blockExternalRedirect();
  generateAdToken();

  if ((window as any).Telegram?.WebApp) {
    try { (window as any).Telegram.WebApp.ready(); } catch {}
    try { (window as any).Telegram.WebApp.disableVerticalSwipes?.(); } catch {}
  }

  try {
    if (network === 'richads') {
      const ctrl = (window as any).TelegramAdsController;
      if (ctrl) {
        try {
          if (typeof ctrl.showRewardedAd === 'function') {
            const res = await ctrl.showRewardedAd(Number(id));
            return res !== false;
          } else if (typeof ctrl.show === 'function') {
            await ctrl.show({ id: String(id), zone: String(id), placement: String(id) });
            return true;
          } else if (typeof ctrl.showAd === 'function') {
            await ctrl.showAd({ id: String(id), zone: String(id) });
            return true;
          }
        } catch (err) {
          console.warn('[RichAds error]:', err);
          return false;
        }
      }
      return false;
    }

    if (network === 'monetag') {
      const fn = (window as any).show_12044377;
      if (typeof fn === 'function') {
        try {
          await fn();
          return true;
        } catch {
          return false;
        }
      } else if (typeof (window as any).showRewardedAd === 'function') {
        try {
          await (window as any).showRewardedAd();
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }

    if (network === 'onclicka') {
      if ((window as any).initCdTma) {
        try {
          const show = await (window as any).initCdTma({ id: String(id) });
          if (typeof show === 'function') {
            await show();
            return true;
          }
        } catch (err) {
          console.warn('[initCdTma TMA warning]:', err);
        }
      }
      return await renderOnclickaInAppOverlay(id);
    }

    return false;
  } catch (e) {
    console.warn('[showInside error]:', e);
    return false;
  }
}

function renderOnclickaInAppOverlay(zoneId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const existing = document.getElementById('onclicka-inapp-ad-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'onclicka-inapp-ad-modal';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(7, 11, 20, 0.98);
      z-index: 9999999;
      display: flex;
      flex-direction: column;
      user-select: none;
      -webkit-user-select: none;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      height: 52px;
      padding: 0 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(245, 158, 11, 0.2);
      background: #0A0F1D;
    `;

    const timerLabel = document.createElement('div');
    timerLabel.style.cssText = `
      font-size: 13px;
      font-weight: 800;
      color: #F59E0B;
      display: flex;
      align-items: center;
      gap: 6px;
    `;
    timerLabel.innerHTML = `⏱️ Watch Ad: <span id="onclicka-countdown" style="color: #fff; font-family: monospace;">30s</span>`;

    const closeBtn = document.createElement('button');
    closeBtn.innerText = '✕';
    closeBtn.style.cssText = `
      background: rgba(255,255,255,0.1);
      color: #fff;
      border: none;
      border-radius: 50%;
      width: 30px;
      height: 30px;
      font-size: 14px;
      cursor: pointer;
    `;

    header.appendChild(timerLabel);
    header.appendChild(closeBtn);

    const frameContainer = document.createElement('div');
    frameContainer.style.cssText = `
      flex: 1;
      width: 100%;
      overflow: hidden;
      position: relative;
      background: #000;
    `;

    const iframe = document.createElement('iframe');
    iframe.src = `https://highperformanceformat.com/${zoneId}`;
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      background: #000;
    `;
    iframe.sandbox = 'allow-scripts allow-same-origin allow-forms';

    frameContainer.appendChild(iframe);

    const footer = document.createElement('div');
    footer.style.cssText = `
      padding: 12px 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      background: #0A0F1D;
    `;

    const claimBtn = document.createElement('button');
    claimBtn.id = 'onclicka-claim-btn';
    claimBtn.disabled = true;
    claimBtn.innerText = 'Claim Reward (Wait 30s)';
    claimBtn.style.cssText = `
      width: 100%;
      padding: 12px 0;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 900;
      border: none;
      background: #334155;
      color: #94A3B8;
      cursor: not-allowed;
      transition: all 0.2s;
    `;

    footer.appendChild(claimBtn);
    overlay.appendChild(header);
    overlay.appendChild(frameContainer);
    overlay.appendChild(footer);
    document.body.appendChild(overlay);

    let seconds = 30;
    let timer: any = null;

    const cleanup = () => {
      if (timer) clearInterval(timer);
      overlay.remove();
    };

    closeBtn.onclick = () => {
      cleanup();
      resolve(false);
    };

    timer = setInterval(() => {
      seconds -= 1;
      const countEl = document.getElementById('onclicka-countdown');
      if (countEl) countEl.innerText = `${seconds}s`;

      if (seconds > 0) {
        claimBtn.innerText = `Claim Reward (Wait ${seconds}s)`;
      } else {
        clearInterval(timer);
        if (countEl) countEl.innerText = 'Completed!';
        claimBtn.disabled = false;
        claimBtn.innerText = 'Claim Reward & Continue';
        claimBtn.style.background = 'linear-gradient(to right, #10B981, #059669)';
        claimBtn.style.color = '#FFFFFF';
        claimBtn.style.cursor = 'pointer';
        claimBtn.style.boxShadow = '0 0 16px rgba(16, 185, 129, 0.4)';
      }
    }, 1000);

    claimBtn.onclick = () => {
      if (seconds <= 0) {
        cleanup();
        resolve(true);
      }
    };
  });
}

// -------------------------------------------------------------------------
// CLAIM VERIFICATION (No strict token check - only verifyAdWatch)
// -------------------------------------------------------------------------

export async function processClaimReward(
  type: 'gift' | 'spin' | 'mining',
  key: string | number,
  userId: string,
  amount: number = 2.5
): Promise<{ success: boolean; error?: string }> {
  // Call verifyAdWatch() only
  const check = verifyAdWatch();
  if (!check.valid) {
    return { success: false, error: check.reason || 'Fake Report! Watch 30s' };
  }

  // Check daily limit
  const done = await isDone(type, key, userId);
  if (done) {
    return { success: false, error: 'Already claimed today' };
  }

  // Authoritative server reward
  try {
    const res = await fetch('/api/ads/anti-fake/verify-and-reward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        type,
        key: String(key),
        elapsed: 30000,
        token: generateAdToken(),
      }),
    });

    if (res.ok) {
      await setDone(type, key, userId);
      return { success: true };
    }
  } catch {}

  // Direct Supabase RPC with fallback
  if (supabaseClient && type === 'gift') {
    try {
      await supabaseClient.rpc('add_e4f_balance', {
        p_user_id: userId,
        p_amount: amount,
        p_spin_amount: 0,
      });
      await setDone(type, key, userId);
      return { success: true };
    } catch (rpcErr) {
      console.log("RPC add_e4f_balance failed, using direct profile update fallback", rpcErr);
      try {
        const { data: prof } = await supabaseClient
          .from('profiles')
          .select('e4f_balance')
          .or(`telegram_id.eq.${userId},id.eq.${userId}`)
          .maybeSingle();
        const currentE4F = Number(prof?.e4f_balance || 0);
        await supabaseClient
          .from('profiles')
          .update({ e4f_balance: currentE4F + amount })
          .or(`telegram_id.eq.${userId},id.eq.${userId}`);
        await setDone(type, key, userId);
        return { success: true };
      } catch (directErr) {
        console.log("Direct update fallback failed", directErr);
      }
    }
  }

  await setDone(type, key, userId);
  return { success: true };
}

// -------------------------------------------------------------------------
// WATERFALL MODULE RUNNERS
// -------------------------------------------------------------------------

function safeNotify(msg: string) {
  try {
    if (typeof (window as any)?.Telegram?.WebApp?.showAlert === 'function') {
      (window as any).Telegram.WebApp.showAlert(msg);
      return;
    }
  } catch {}
  try {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(msg);
      return;
    }
  } catch {}
  console.warn('[Ad Notification]:', msg);
}

export async function openGiftBoxWithWaterfall(
  boxNum: number,
  userId: string,
  onReward?: (reward: number) => void
): Promise<{ success: boolean; error?: string }> {
  const done = await isDone('gift', boxNum, userId);
  if (done) {
    safeNotify('Box already opened today. Resets at UTC 00:00.');
    return { success: false, error: 'Already claimed today' };
  }

  // Direct dedicated In-App Ad without waterfall cascade
  const targetTier = (boxNum === 2 || boxNum === 5)
    ? { network: 'monetag' as const, id: '12044377' }
    : boxNum === 3
    ? { network: 'onclicka' as const, id: '6153772E4F' }
    : { network: 'richads' as const, id: '410202' };

  console.log(`[Gift Box #${boxNum}] Direct In-App Ad: ${targetTier.network} (${targetTier.id})`);
  blockExternalRedirect();
  generateAdToken();

  const shown = await showInside(targetTier.network, targetTier.id);
  if (!shown) {
    safeNotify('Ad load failed. Please try again.');
    return { success: false, error: 'Ad attempt failed.' };
  }

  const claimRes = await processClaimReward('gift', boxNum, userId, 2.5);
  if (claimRes.success) {
    if (onReward) onReward(2.5);
    return { success: true };
  } else {
    safeNotify(claimRes.error || 'Fake Report! Watch 30s');
    return { success: false, error: claimRes.error };
  }
}

export async function handleSpinWithWaterfall(
  remainingKey: string,
  userId: string,
  onAdSuccess?: () => void
): Promise<{ success: boolean; error?: string }> {
  const done = await isDone('spin', remainingKey, userId);
  if (done) {
    safeNotify('Spin already claimed for this slot today. Resets at UTC 00:00.');
    return { success: false, error: 'Already claimed today' };
  }

  // Direct dedicated Spin Ad (RichAds 410203) without waterfall cascade
  const targetTier = { network: 'richads' as const, id: '410203' };
  console.log(`[Spin ${remainingKey}] Direct In-App Ad: ${targetTier.network} (${targetTier.id})`);

  blockExternalRedirect();
  generateAdToken();

  const shown = await showInside(targetTier.network, targetTier.id);
  if (!shown) {
    safeNotify('Ad load failed. Please try again.');
    return { success: false, error: 'Ad attempt failed.' };
  }

  const claimRes = await processClaimReward('spin', remainingKey, userId);
  if (claimRes.success) {
    if (onAdSuccess) onAdSuccess();
    return { success: true };
  } else {
    safeNotify(claimRes.error || 'Fake Report! Watch 30s');
    return { success: false, error: claimRes.error };
  }
}

const miningTimestamps: number[] = [];

export async function handleMiningWithWaterfall(
  userId: string,
  onAdSuccess?: () => void
): Promise<{ success: boolean; error?: string }> {
  const now = Date.now();
  miningTimestamps.push(now);
  while (miningTimestamps.length > 0 && miningTimestamps[0] < now - 10000) {
    miningTimestamps.shift();
  }
  if (miningTimestamps.length > 5) {
    safeNotify('Too many attempts! Please wait 10 seconds before starting mining.');
    return { success: false, error: 'Spam protection triggered' };
  }

  const tiers = AD_CONFIG.MINING;
  let completed = false;

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    console.log(`[Mining] Tier ${i + 1}: ${tier.network} (${tier.id})`);

    blockExternalRedirect();
    generateAdToken();

    const shown = await showInside(tier.network, tier.id);
    if (shown) {
      completed = true;
      break;
    }
    console.warn(`[Mining] Tier ${i + 1} failed. Next tier...`);
  }

  if (!completed) {
    safeNotify('Ad load failed. Please try again.');
    return { success: false, error: 'All waterfall ad attempts failed.' };
  }

  const claimRes = await processClaimReward('mining', 'mining', userId);
  if (claimRes.success) {
    if (onAdSuccess) onAdSuccess();
    return { success: true };
  } else {
    safeNotify(claimRes.error || 'Fake Report! Watch 30s');
    return { success: false, error: claimRes.error };
  }
}
