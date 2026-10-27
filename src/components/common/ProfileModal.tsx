import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Trash2,
  Key,
  Share2,
  Edit2,
  CheckCircle2,
  ArrowLeft,
  Wallet,
  ExternalLink,
  Sliders,
  FileText,
  Lock,
  Compass,
  RefreshCw,
  EyeOff,
  Eye,
  Info,
  Vibrate,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { LEGAL_DOCS, LEGAL_ORDER, LegalKey } from './LegalDocs';

interface ProfileModalProps {
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ onClose }) => {
  const { user, balances, addToast, refreshProfile, openModal } = useApp();

  // Copy States
  const [copiedUid, setCopiedUid] = useState(false);
  const [copiedRefLink, setCopiedRefLink] = useState(false);
  const [copiedAdminAddress, setCopiedAdminAddress] = useState(false);
  const [copiedUserAddress, setCopiedUserAddress] = useState(false);

  // Username Editing State
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState(user?.username || '');
  const [savingUsername, setSavingUsername] = useState(false);

  // Verification View State
  const [showVerifyView, setShowVerifyView] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [verifySuccessMsg, setVerifySuccessMsg] = useState('');
  const [externalTxHash, setExternalTxHash] = useState('');
  const [trustedStreak, setTrustedStreak] = useState(0);

  // Trusted Miner progress (120 consecutive mining days)
  useEffect(() => {
    if (!showVerifyView || !user?.id) return;
    api.getTrustedMinerStatus(user.id).then((r) => setTrustedStreak(r.streakDays || 0)).catch(() => {});
  }, [showVerifyView, user?.id]);

  // System Settings State (dynamic Admin BSC address & deposit toggle)
  const [adminBscAddress, setAdminBscAddress] = useState('0x63562945f7845aa1130a5b1499720b29788c82db');
  const [depositsEnabled, setDepositsEnabled] = useState(false);

  // Deletion Dialog State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInputText, setDeleteInputText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // ---- Settings (saved on this device only) ----
  const readPref = (key: string, fallback: boolean) => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v === '1';
    } catch { return fallback; }
  };
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hapticOn, setHapticOn] = useState<boolean>(() => readPref('e4f_pref_haptic', true));
  const [hideBalances, setHideBalances] = useState<boolean>(() => readPref('e4f_pref_hide_balances', false));
  const [legalKey, setLegalKey] = useState<LegalKey | null>(null);
  const [appVersion, setAppVersion] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const savePref = (key: string, value: boolean) => {
    try { localStorage.setItem(key, value ? '1' : '0'); } catch {}
  };
  const buzz = () => {
    if (!hapticOn) return;
    try { (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light'); } catch {}
  };
  const toggleHaptic = () => {
    const next = !hapticOn;
    setHapticOn(next);
    savePref('e4f_pref_haptic', next);
    if (next) { try { (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light'); } catch {} }
  };
  const toggleHideBalances = () => {
    const next = !hideBalances;
    setHideBalances(next);
    savePref('e4f_pref_hide_balances', next);
    buzz();
  };
  const handleRefreshData = async () => {
    setRefreshing(true);
    try {
      await refreshProfile();
      addToast('Refreshed', 'Your latest data has been loaded', 'success');
    } catch {
      addToast('Refresh Failed', 'Could not refresh now, please try again', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  // App version (from the published build.txt) shown in Settings
  useEffect(() => {
    if (!settingsOpen || appVersion) return;
    fetch('/build.txt', { cache: 'no-store' })
      .then(r => (r.ok ? r.text() : ''))
      .then(t => setAppVersion((t || '').split('|')[0].trim()))
      .catch(() => {});
  }, [settingsOpen, appVersion]);

  const displayUid = user?.uid || (user?.id ? `E4F${user.id.slice(-6).toUpperCase()}` : 'E4F894102');
  const referralCode = user?.referralCode || '';
  const referralLink = referralCode
    ? `https://t.me/E4F_Web3_mining_bot/app?startapp=${referralCode}`
    : 'https://t.me/E4F_Web3_mining_bot/app';

  const isDefaultOrTelegram = !user?.firstName || user.firstName === 'Telegram User' || user.firstName.toLowerCase() === 'user';
  const displayName = isDefaultOrTelegram ? 'E4F User' : `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`;
  const displayInitial = isDefaultOrTelegram ? 'E' : displayName.charAt(0).toUpperCase();

  const [depositMinUSDT, setDepositMinUSDT] = useState<number>(2.0);
  const [depositBonusUSDT, setDepositBonusUSDT] = useState<number>(10.0);

  useEffect(() => {
    // Fetch live system settings so admin changes reflect without app update
    api.getPublicSettings()
      .then(res => {
        if (res.bscDepositAddress) setAdminBscAddress(res.bscDepositAddress);
        if (typeof res.depositsEnabled === 'boolean') setDepositsEnabled(res.depositsEnabled);
        if (typeof res.depositMinUSDT === 'number') setDepositMinUSDT(res.depositMinUSDT);
        if (typeof res.depositFirstBonusUSDT === 'number') setDepositBonusUSDT(res.depositFirstBonusUSDT);
      })
      .catch(err => {
        console.warn('Could not fetch public settings:', err);
      });
  }, []);

  const copyToClipboard = (text: string, type: 'uid' | 'reflink' | 'adminAddr' | 'userAddr') => {
    navigator.clipboard?.writeText(text);
    if (type === 'uid') {
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
      addToast('Copied', 'UID copied to clipboard', 'info');
    } else if (type === 'reflink') {
      setCopiedRefLink(true);
      setTimeout(() => setCopiedRefLink(false), 2000);
      addToast('Copied', 'Referral link copied to clipboard', 'success');
    } else if (type === 'userAddr') {
      setCopiedUserAddress(true);
      setTimeout(() => setCopiedUserAddress(false), 2000);
      addToast('Copied', 'Your unique deposit address copied', 'info');
    } else {
      setCopiedAdminAddress(true);
      setTimeout(() => setCopiedAdminAddress(false), 2000);
      addToast('Copied', 'Official deposit address copied', 'info');
    }
  };

  const handleShareReferral = async () => {
    const shareText = `Join E4F Web3 Exchange! Use my referral code ${referralCode} to get a Welcome Bonus and start daily mining.`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'E4F Web3 Exchange',
          text: shareText,
          url: referralLink,
        });
        return;
      } catch (e) {
        // User cancelled or share failed, fallback to telegram
      }
    }
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`;
    window.open(tgUrl, '_blank');
  };

  const handleSaveUsername = async () => {
    if (!user?.id) return;
    const trimmed = usernameInput.trim().replace(/^@/, '');
    if (trimmed.length < 3) {
      addToast('Invalid Username', 'Username must be at least 3 characters', 'error');
      return;
    }
    setSavingUsername(true);
    try {
      const res = await api.updateUsername(user.id, trimmed);
      addToast('Username Updated', res.message || 'Username changed successfully', 'success');
      await refreshProfile();
      setIsEditingUsername(false);
    } catch (err: any) {
      addToast('Update Failed', err.message || 'Could not update username', 'error');
    } finally {
      setSavingUsername(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteInputText.trim() !== 'DELETE') {
      addToast('Verification Failed', 'Please type DELETE in capital letters to confirm', 'error');
      return;
    }
    if (!user?.id) return;

    setDeleting(true);
    try {
      const res = await api.deleteAccount(user.id, deleteInputText);
      addToast('Account Deleted', res.message || 'Your account and records have been purged', 'info');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      addToast('Deletion Failed', err.message || 'Could not delete account', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-sm bg-[#0C1222] border border-slate-800 rounded-3xl p-5 text-slate-200 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800/80 text-slate-400 hover:text-white transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* VIEW 0: LEGAL / INFO DOCUMENT */}
        {legalKey ? (
          <div className="space-y-3 animate-in fade-in">
            <div className="flex items-center gap-2 pr-8">
              <button
                onClick={() => { setLegalKey(null); buzz(); }}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h3 className="text-base font-extrabold text-white">{LEGAL_DOCS[legalKey].title}</h3>
                <p className="text-[10px] text-slate-400">Updated {LEGAL_DOCS[legalKey].updated}</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">{LEGAL_DOCS[legalKey].intro}</p>
            {LEGAL_DOCS[legalKey].sections.map((sec, i) => (
              <div key={i} className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-1.5">
                <h4 className="text-xs font-extrabold text-amber-400">{sec.h}</h4>
                {sec.p?.map((t, j) => (
                  <p key={j} className="text-[11px] text-slate-300 leading-relaxed">{t}</p>
                ))}
                {sec.li && (
                  <ul className="list-disc pl-4 space-y-1">
                    {sec.li.map((t, j) => (
                      <li key={j} className="text-[11px] text-slate-300 leading-relaxed">{t}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        ) : showVerifyView ? (
          <div className="space-y-4 animate-in fade-in">
            {/* Header */}
            <div className="flex items-center gap-2 pr-8">
              <button
                onClick={() => setShowVerifyView(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h3 className="text-base font-extrabold text-white">Account Verification</h3>
                <p className="text-[10px] text-slate-400">Zero ID Card / No KYC Required</p>
              </div>
            </div>

            {/* Trusted Miner explanation + progress */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-emerald-500/15 to-amber-500/20 border border-amber-500/40 space-y-3 shadow-lg">
              <div className="flex items-center gap-2 text-amber-300 text-xs font-black uppercase tracking-wide">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>Mine 120 days in a row to become a Trusted Miner</span>
              </div>
              <p className="text-[11px] text-slate-200 leading-relaxed font-medium">
                No ID card, no KYC and no deposit. Mine at least once every day (UTC time). After 120 days in a row your profile automatically shows ✅ Trusted Miner, which means you are a verified user and not a robot. If you miss a day, the count starts again.
              </p>
              <div>
                <div className="flex justify-between text-[11px] font-bold mb-1">
                  <span className="text-slate-300">Your streak</span>
                  <span className="text-emerald-400">{Math.min(trustedStreak, 120)} / 120 days</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all"
                    style={{ width: `${Math.min(100, (trustedStreak / 120) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {user?.isVerified && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>✅ Trusted Miner - your account is verified.</span>
              </div>
            )}
          </div>
        ) : (
          /* VIEW 2: PRIMARY PROFILE VIEW */
          <div className="space-y-4">
            {/* User Avatar & Info */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 via-amber-300 to-sky-400 p-0.5 shadow-[0_0_15px_rgba(245,158,11,0.25)] shrink-0">
                  <div className="w-full h-full rounded-[14px] bg-[#070B14] flex items-center justify-center text-base font-extrabold text-amber-400 uppercase">
                    {displayInitial}
                  </div>
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">
                    {displayName}
                  </h3>

                  {/* Username Display or Edit Input */}
                  {!isEditingUsername ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-slate-400 font-medium">
                        @{user?.username || 'user'}
                      </span>
                      <button
                        onClick={() => {
                          setUsernameInput(user?.username || '');
                          setIsEditingUsername(true);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-amber-400 transition-colors"
                        title="Change Username"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        type="text"
                        value={usernameInput}
                        onChange={e => setUsernameInput(e.target.value)}
                        placeholder="new_username"
                        className="px-2 py-0.5 rounded-lg bg-slate-950 border border-amber-500/40 text-xs text-white font-mono w-28"
                      />
                      <button
                        onClick={handleSaveUsername}
                        disabled={savingUsername}
                        className="px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-[10px] hover:bg-amber-400"
                      >
                        {savingUsername ? '...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setIsEditingUsername(false)}
                        className="px-1.5 py-0.5 rounded-lg bg-slate-800 text-slate-400 text-[10px]"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Verification Status Badge */}
              <div>
                {user?.isVerified ? (
                  <div className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1 shadow-sm">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Trusted Miner</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowVerifyView(true)}
                    className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-extrabold flex items-center gap-1 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
                    title="Mine 120 days in a row to get verified"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-slate-950" />
                    <span>Get Verified</span>
                  </button>
                )}
              </div>
            </div>

            {/* Server Assigned UID Card */}
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>Account UID</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 font-bold border border-sky-500/20 font-mono">
                  UID #{displayUid}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-sm text-sky-400 font-bold">
                <span>{displayUid}</span>
                <button
                  onClick={() => copyToClipboard(displayUid, 'uid')}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                  title="Copy UID"
                >
                  {copiedUid ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Unique Referral Link Card (Copy & Share) */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-[#0A1020] border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-bold flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Unique Referral Link</span>
                </span>
                <span className="font-mono text-[10px] text-amber-400 font-bold">
                  Code: {referralCode}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 truncate">
                {referralLink}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <button
                  onClick={() => copyToClipboard(referralLink, 'reflink')}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  {copiedRefLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-amber-400" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleShareReferral}
                  className="py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-slate-950" />
                  <span>Share</span>
                </button>
              </div>
            </div>

            {/* Wallet Balances Summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <div className="text-[9px] text-slate-400 uppercase font-semibold">Spot USDT</div>
                <div className="text-xs font-extrabold text-emerald-400 mt-0.5 font-mono">
                  {hideBalances ? '••••' : `$${balances.usdt.toFixed(2)}`}
                </div>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <div className="text-[9px] text-slate-400 uppercase font-semibold">Deposit bal</div>
                <div className="text-xs font-extrabold text-amber-400 mt-0.5 font-mono">
                  {hideBalances ? '••••' : `$${((user?.depositBalance || 0)).toFixed(2)}`}
                </div>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <div className="text-[9px] text-slate-400 uppercase font-semibold">E4F Pre-List</div>
                <div className="text-xs font-extrabold text-sky-400 mt-0.5 font-mono">
                  {hideBalances ? '••••' : `${balances.e4f.toFixed(1)} E4F`}
                </div>
              </div>
            </div>


            {/* Settings & Info */}
            <div className="rounded-2xl bg-slate-900/70 border border-slate-800/80 overflow-hidden">
              <button
                onClick={() => { setSettingsOpen(v => !v); buzz(); }}
                className="w-full flex items-center justify-between p-3 text-xs font-bold text-slate-200 hover:bg-slate-800/50 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <span>Settings</span>
                </span>
                <span className="text-slate-500 text-[10px]">{settingsOpen ? 'Hide' : 'Show'}</span>
              </button>

              {settingsOpen && (
                <div className="p-3 pt-0 space-y-2 animate-in fade-in">
                  {/* Haptic */}
                  <button
                    onClick={toggleHaptic}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-200 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Vibrate className="w-3.5 h-3.5 text-sky-400" />
                      <span>Vibration feedback</span>
                    </span>
                    <span className={hapticOn ? 'text-emerald-400 font-bold' : 'text-slate-500 font-bold'}>
                      {hapticOn ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  {/* Hide balances */}
                  <button
                    onClick={toggleHideBalances}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-200 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      {hideBalances ? <EyeOff className="w-3.5 h-3.5 text-sky-400" /> : <Eye className="w-3.5 h-3.5 text-sky-400" />}
                      <span>Hide balances in profile</span>
                    </span>
                    <span className={hideBalances ? 'text-emerald-400 font-bold' : 'text-slate-500 font-bold'}>
                      {hideBalances ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  {/* Refresh data */}
                  <button
                    onClick={handleRefreshData}
                    disabled={refreshing}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-200 disabled:opacity-60 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${refreshing ? 'animate-spin' : ''}`} />
                      <span>Refresh my data</span>
                    </span>
                    <span className="text-slate-500 font-bold">{refreshing ? '...' : 'Tap'}</span>
                  </button>

                  {/* Legal & info */}
                  <div className="grid grid-cols-3 gap-2 pt-0.5">
                    {LEGAL_ORDER.map(k => (
                      <button
                        key={k}
                        onClick={() => { setLegalKey(k); buzz(); }}
                        className="py-2 px-1 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[10px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer"
                      >
                        {k === 'privacy' ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : k === 'whitepaper' ? <FileText className="w-3.5 h-3.5 text-amber-400" /> : <Compass className="w-3.5 h-3.5 text-amber-400" />}
                        <span>{LEGAL_DOCS[k].title}</span>
                      </button>
                    ))}
                  </div>

                  <div className="flex items-start gap-1.5 text-[10px] text-slate-500 leading-relaxed pt-1">
                    <Info className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>
                      Ads are optional and play inside the app. You are rewarded only after an ad finishes, never for clicking.
                      {appVersion ? ` Version: ${appVersion}` : ''}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Account Deletion */}
            <div className="pt-2 border-t border-slate-800/80">
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-1.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete Account & Purge Data</span>
                </button>
              ) : (
                <div className="p-3 rounded-2xl bg-rose-950/40 border border-rose-500/30 space-y-2 animate-in fade-in">
                  <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Confirm Permanent Deletion</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    This action is irreversible. All your wallet balances, mining sessions, and task records will be
                    permanently erased.
                  </p>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      Type <span className="text-rose-400 font-bold font-mono">DELETE</span> to confirm:
                    </label>
                    <input
                      type="text"
                      value={deleteInputText}
                      onChange={e => setDeleteInputText(e.target.value)}
                      placeholder="DELETE"
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-rose-500/40 text-xs text-white placeholder-slate-600 font-mono text-center"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleting || deleteInputText.trim() !== 'DELETE'}
                      className="flex-1 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs transition-colors cursor-pointer"
                    >
                      {deleting ? 'Deleting...' : 'Confirm Purge'}
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteInputText('');
                      }}
                      className="py-1.5 px-3 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
