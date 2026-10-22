// =====================================================================
// E4F Web3 Exchange - Server-Side Telegram Authentication & Supabase RPC
// File: lib/telegramAuth.js
// CRITICAL SECURITY: This module is STRICTLY server-side only.
// It uses SUPABASE_SERVICE_ROLE_KEY and TELEGRAM_BOT_TOKEN to verify
// WebApp signatures and safely provision/restore users without balance loss.
// =====================================================================

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';

let supabaseAdminClient = null;

/**
 * Returns the authoritative Supabase Service Role client.
 * Strictly server-side only; fails if credentials are missing in production.
 */
export function getSupabaseAdmin() {
  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      throw new Error(
        '[Security Exception] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured on the server. ' +
        'In-memory fallback has been disabled to prevent wallet balance loss.'
      );
    }
    return null;
  }

  supabaseAdminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  return supabaseAdminClient;
}

/**
 * Cryptographically verifies Telegram WebApp initData HMAC-SHA256 signature.
 * NEVER trusts unverified client-provided user IDs.
 *
 * @param {string} initData - The raw window.Telegram.WebApp.initData query string
 * @param {string} [tokenOverride] - Optional bot token override (defaults to TELEGRAM_BOT_TOKEN)
 * @returns {{ valid: boolean, user?: any, error?: string, startParam?: string }}
 */
export function verifyTelegramInitData(initData, tokenOverride) {
  try {
    const token = tokenOverride || TELEGRAM_BOT_TOKEN;
    if (!token) {
      return { valid: false, error: 'TELEGRAM_BOT_TOKEN is not configured on the server' };
    }

    if (!initData || typeof initData !== 'string' || !initData.trim()) {
      return { valid: false, error: 'initData string is required' };
    }

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) {
      return { valid: false, error: 'Missing hash parameter in initData' };
    }

    const authDateStr = params.get('auth_date');
    if (authDateStr) {
      const authDate = parseInt(authDateStr, 10);
      const nowSec = Math.floor(Date.now() / 1000);
      // Reject if older than 24 hours or in the future
      if (!isNaN(authDate) && (nowSec - authDate > 86400 || authDate - nowSec > 300)) {
        return { valid: false, error: 'Telegram authentication timestamp expired' };
      }
    }

    params.delete('hash');
    const sortedKeys = Array.from(params.keys()).sort();
    const dataCheckString = sortedKeys.map(k => `${k}=${params.get(k)}`).join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const hashBuf = Buffer.from(hash, 'utf-8');
    const calcBuf = Buffer.from(calculatedHash, 'utf-8');
    if (hashBuf.length !== calcBuf.length || !crypto.timingSafeEqual(hashBuf, calcBuf)) {
      return { valid: false, error: 'Cryptographic signature mismatch (HMAC-SHA256)' };
    }

    const userParam = params.get('user');
    const user = userParam ? JSON.parse(userParam) : null;
    const startParam = params.get('start_param') || params.get('start') || params.get('ref') || null;

    return { valid: true, user, startParam };
  } catch (err) {
    return { valid: false, error: err.message || 'Verification exception' };
  }
}

/**
 * Authenticates or restores a user in Supabase via the get_or_restore_user RPC.
 * Validates initData cryptographically first so p_telegram_id cannot be spoofed.
 *
 * @param {Object} options
 * @param {string} options.initData - Telegram WebApp raw initData
 * @param {string} [options.deviceHash] - Client device identifier for 24h bonus lock
 * @param {string} [options.referralCode] - Optional referral code
 * @returns {Promise<Object>} The authenticated user and wallet balances
 */
export async function authenticateAndRestoreUser({ initData, deviceHash, referralCode }) {
  const verified = verifyTelegramInitData(initData);
  if (!verified.valid || !verified.user || !verified.user.id) {
    throw new Error(`Authentication failed: ${verified.error || 'Invalid Telegram credentials'}`);
  }

  const tgUser = verified.user;
  const client = getSupabaseAdmin();
  if (!client) {
    throw new Error('[Database Exception] Supabase client is not available. Memory fallback is disabled.');
  }

  const effectiveReferral = referralCode || verified.startParam || null;

  // Check if user already exists in users or wallets table with immutable telegram_id
  let passReferral = effectiveReferral;
  try {
    const { data: existingUser } = await client
      .from('users')
      .select('referral_code, referred_by')
      .eq('telegram_id', tgUser.id)
      .maybeSingle();

    const { data: existingWallet } = await client
      .from('wallets')
      .select('telegram_id')
      .eq('telegram_id', tgUser.id)
      .maybeSingle();

    if (existingUser || existingWallet) {
      // Existing user: never overwrite referral_code or referred_by
      passReferral = null;
    }
  } catch {}

  // Execute atomic PostgreSQL RPC with BIGINT telegram_id and concurrency lock
  const { data, error } = await client.rpc('get_or_restore_user', {
    p_telegram_id: tgUser.id, // Supabase maps JS number or string to BIGINT
    p_first_name: tgUser.first_name || 'E4F User',
    p_last_name: tgUser.last_name || '',
    p_username: tgUser.username || '',
    p_photo_url: tgUser.photo_url || '',
    p_referral_code: passReferral,
    p_device_hash: deviceHash || null,
  });

  if (error) {
    console.error('[Supabase RPC Error] get_or_restore_user failed:', error);
    throw new Error(`Failed to restore user: ${error.message}`);
  }

  if (data?.user && (tgUser.id === 8827675419 || String(tgUser.id) === '8827675419')) {
    data.user.referralCode = 'E4F786112';
  }

  return data;
}

export default {
  getSupabaseAdmin,
  verifyTelegramInitData,
  authenticateAndRestoreUser,
};
