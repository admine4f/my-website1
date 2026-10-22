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
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

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

  // System Settings State (dynamic Admin BSC address & deposit toggle)
  const [adminBscAddress, setAdminBscAddress] = useState('0x63562945f7845aa1130a5b1499720b29788c82db');
  const [depositsEnabled, setDepositsEnabled] = useState(false);

  // Deletion Dialog State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInputText, setDeleteInputText] = useState('');
  const [deleting, setDeleting] = useState(false);

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

  const handleVerifyAccount = async (useExternal = false) => {
    if (!user?.id) return;
    if (!depositsEnabled) {
      addToast('Deposits Disabled', 'Account verification deposits are currently turned off.', 'error');
      return;
    }

    setVerifying(true);
    try {
      const txHashToSubmit = useExternal ? externalTxHash.trim() : undefined;
      const res = await api.verifyAccount(user.id, txHashToSubmit);
      
      setVerifySuccessMsg(res.message || 'send success');
      setShowConfirmModal(false);
      addToast('Verification Success', 'send success! Account is now Verified.', 'success');
      await refreshProfile();
      setTimeout(() => {
        setShowVerifyView(false);
        setVerifySuccessMsg('');
      }, 2500);
    } catch (err: any) {
      setShowConfirmModal(false);
      addToast('Verification Failed', err.message || 'Deposit verification failed', 'error');
    } finally {
      setVerifying(false);
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

        {/* VIEW 1: ACCOUNT VERIFICATION SUB-VIEW */}
        {showVerifyView ? (
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

            {/* Verification explanation banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-emerald-500/15 to-amber-500/20 border border-amber-500/40 space-y-2 shadow-lg">
              <div className="flex items-center gap-2 text-amber-300 text-xs font-black uppercase tracking-wide">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>If You are Human please send {depositMinUSDT} usdt & instant back {depositBonusUSDT} usdt.</span>
              </div>
              <p className="text-[11px] text-slate-200 leading-relaxed font-medium">
                Verify your account using your deposited {depositMinUSDT} USDT. Upon confirmation, the {depositMinUSDT} USDT deposit balance is transferred to the official deposit address, and you will instantly receive <span className="text-emerald-400 font-bold font-mono">{depositBonusUSDT} USDT Instant Back</span> upon verification success.
              </p>
              <div className="text-[10px] text-amber-300/90 font-medium bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                ⚠️ Note: This balance cannot be from E4F earnings, trading, internal E4F transfer, or withdrawals. Only balance deposited directly from an external wallet or exchange is valid.
              </div>
            </div>

            {/* Admin Deposit Toggle Notification */}
            {!depositsEnabled && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Deposits are currently disabled.</span>
              </div>
            )}

            {/* Official Destination Address */}
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  Official Deposit Address (Destination)
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-bold">
                  BEP20
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-400 font-bold break-all gap-2">
                <span className="truncate">{adminBscAddress}</span>
                <button
                  onClick={() => copyToClipboard(adminBscAddress, 'adminAddr')}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0"
                  title="Copy Official Address"
                >
                  {copiedAdminAddress ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* User Unique Personal Deposit Address */}
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  Your Unique Deposit Address
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 font-mono font-bold">
                  Personal Unique
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-sky-400 font-bold break-all gap-2">
                <span className="truncate">{user?.depositAddress || adminBscAddress}</span>
                <button
                  onClick={() => copyToClipboard(user?.depositAddress || adminBscAddress, 'userAddr')}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0"
                  title="Copy Your Unique Address"
                >
                  {copiedUserAddress ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              <div className="text-[10px] text-slate-400">
                Each user has a unique personal deposit address. Funds deposited from external wallets or exchanges will be credited to your Deposit Balance.
              </div>
            </div>

            {/* Balances Info Card */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-2xl bg-slate-900/90 border border-amber-500/40">
                <div className="text-[10px] text-amber-400 uppercase font-bold">Deposit Balance</div>
                <div className="text-base font-extrabold text-amber-400 mt-0.5 font-mono">
                  ${((user?.depositBalance || 0)).toFixed(2)} USDT
                </div>
                <div className="text-[9px] text-emerald-400 font-semibold mt-0.5">
                  ✓ Eligible for account verification
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Spot USDT Balance</div>
                <div className="text-base font-extrabold text-slate-300 mt-0.5 font-mono">
                  ${balances.usdt.toFixed(2)}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">
                  E4F Mining / Trade Balance
                </div>
              </div>
            </div>

            {/* Success Message Banner */}
            {verifySuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-center space-y-1 animate-in fade-in">
                <div className="flex items-center justify-center gap-1.5 font-black text-sm uppercase">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{verifySuccessMsg}</span>
                </div>
                <div className="text-[10px] text-emerald-300">
                  Your account is now officially Verified! +{depositBonusUSDT} USDT instant back credited.
                </div>
              </div>
            )}

            {/* Primary Action: Verify with Deposit Balance */}
            {(user?.depositBalance || 0) >= depositMinUSDT ? (
              <div className="space-y-2">
                <button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={verifying || !depositsEnabled}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-slate-950" />
                  <span>Confirm & Send {depositMinUSDT} USDT (Instant Back {depositBonusUSDT} USDT)</span>
                </button>
                <p className="text-[10px] text-center text-slate-400">
                  Deducts {depositMinUSDT.toFixed(2)} USDT from Deposit Balance & sends to official address. Instant {depositBonusUSDT} USDT back.
                </p>
              </div>
            ) : (
              <div className="space-y-3 p-3.5 rounded-2xl bg-slate-900/80 border border-amber-500/30">
                <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>Deposit Balance Required (Min {depositMinUSDT.toFixed(2)} USDT)</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Your current Deposit Balance is <span className="font-mono text-white font-bold">${((user?.depositBalance || 0)).toFixed(2)} USDT</span>. To verify your account, please deposit at least {depositMinUSDT} USDT from an external wallet or exchange into your unique address.
                </p>
                <button
                  onClick={() => {
                    setShowVerifyView(false);
                    onClose();
                    openModal('DEPOSIT');
                  }}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Wallet className="w-4 h-4" />
                  <span>Deposit {depositMinUSDT} USDT to Unique Address</span>
                </button>
              </div>
            )}

            {/* Confirmation Modal */}
            {showConfirmModal && (
              <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="w-full max-w-xs rounded-2xl bg-[#0F172A] border border-emerald-500/40 p-4 space-y-3 shadow-2xl text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h4 className="font-black text-white text-sm">
                    If You are Human please send {depositMinUSDT} usdt & instant back {depositBonusUSDT} usdt.
                  </h4>
                  <div className="text-xs text-slate-300 space-y-1 text-left bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400">
                      Destination Address: <span className="font-mono text-emerald-400 font-bold break-all">{adminBscAddress}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      From: <span className="text-amber-400 font-bold">Deposit Balance ({depositMinUSDT.toFixed(2)} USDT)</span>
                    </div>
                    <div className="text-[10px] text-emerald-400 font-bold">
                      Reward: Instant Back {depositBonusUSDT} USDT to Spot Balance
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleVerifyAccount(false)}
                      disabled={verifying}
                      className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all cursor-pointer"
                    >
                      {verifying ? 'Sending...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setShowConfirmModal(false)}
                      className="py-2 px-3 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
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
                    <span>Verified</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowVerifyView(true)}
                    className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-extrabold flex items-center gap-1 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
                    title="Click to Verify Account"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-slate-950" />
                    <span>Verify Now</span>
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
                  ${balances.usdt.toFixed(2)}
                </div>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <div className="text-[9px] text-slate-400 uppercase font-semibold">Deposit bal</div>
                <div className="text-xs font-extrabold text-amber-400 mt-0.5 font-mono">
                  ${((user?.depositBalance || 0)).toFixed(2)}
                </div>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <div className="text-[9px] text-slate-400 uppercase font-semibold">E4F Pre-List</div>
                <div className="text-xs font-extrabold text-sky-400 mt-0.5 font-mono">
                  {balances.e4f.toFixed(1)} E4F
                </div>
              </div>
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
