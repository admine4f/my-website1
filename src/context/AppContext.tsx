import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserAccount, WalletBalances, ScreenTab, Language, MiningSession, MiningStats, AppNotification } from '../types';
import { api, checkExistingTelegramUser } from '../services/api';

export type ModalType =
  | 'TASKS'
  | 'REWARDS'
  | 'REFERRAL'
  | 'PROFILE'
  | 'SUPPORT'
  | 'DOCUMENTS'
  | 'WELCOME'
  | 'WELCOME_BONUS'
  | 'ADMIN'
  | 'DEPOSIT'
  | 'WITHDRAW'
  | 'NOTIFICATIONS'
  | 'SPIN'
  | 'GIFT_BOXES'
  | null;

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

interface AppContextType {
  user: UserAccount | null;
  balances: WalletBalances;
  activeTab: ScreenTab;
  setActiveTab: (tab: ScreenTab) => void;
  activeModal: ModalType;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  miningStats: MiningStats | null;
  activeMiningSession: MiningSession | null;
  refreshMining: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateBalances: (b: WalletBalances) => void;
  notifications: AppNotification[];
  addToast: (title: string, message: string, type?: 'info' | 'success' | 'error') => void;
  toasts: ToastItem[];
  removeToast: (id: string) => void;
  showWelcomeBonus: boolean;
  setShowWelcomeBonus: (show: boolean) => void;
  toast: { title: string; message: string; type: 'info' | 'success' | 'error' } | null;
  showAccountCreation: boolean;
  pendingReferralCode: string;
  creatingAccount: boolean;
  confirmAccountCreation: () => Promise<void>;
  dismissAccountCreation: () => Promise<void>;
}

const defaultBalances: WalletBalances = {
  usdt: 0,
  e4f: 0,
  btc: 0,
  eth: 0,
  sol: 0,
  bnb: 0,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserAccount | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('e4f_cached_user');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return null;
  });
  const [balances, setBalances] = useState<WalletBalances>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('e4f_cached_balances');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return defaultBalances;
  });
  const [activeTab, setActiveTab] = useState<ScreenTab>('home');
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [language, setLanguage] = useState<Language>('en');
  const [miningStats, setMiningStats] = useState<MiningStats | null>(null);
  const [showWelcomeBonus, setShowWelcomeBonus] = useState<boolean>(false);
  const [toast, setToast] = useState<{ title: string; message: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [showAccountCreation, setShowAccountCreation] = useState(false);
  const [pendingReferralCode, setPendingReferralCode] = useState('');
  const [creatingAccount, setCreatingAccount] = useState(false);
  const initDataRef = React.useRef('');
  const tgUserRef = React.useRef<any>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([
    {
      id: 'notif-1',
      title: 'Welcome to E4F Web3 Exchange',
      message: 'Official welcome bonus has been credited to your account.',
      type: 'WALLET',
      read: false,
      timestamp: Date.now() - 3600000,
    },
    {
      id: 'notif-2',
      title: 'Mining Season Active',
      message: 'Mine E4F every 8 hours. Planned listing milestone: 28 February 2028.',
      type: 'MINING',
      read: false,
      timestamp: Date.now() - 1800000,
    },
  ]);

  const addToast = (title: string, message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newToast: ToastItem = { id, title, message, type };
    setToast({ title, message, type });
    setToasts(prev => [...prev.slice(-3), newToast]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const openModal = (modal: ModalType) => setActiveModal(modal);
  const closeModal = () => setActiveModal(null);

  const confirmAccountCreation = async () => {
    if (creatingAccount) return;
    setCreatingAccount(true);
    try {
      const res = await api.loginTelegram(initDataRef.current, tgUserRef.current, undefined, pendingReferralCode);
      setUser(res.user);
      if (res.user?.id) {
        localStorage.setItem('e4f_user_id', res.user.id);
        localStorage.setItem('e4f_user_registered', 'true');
        localStorage.setItem('e4f_cached_user', JSON.stringify(res.user));
      }
      if (res.balances) {
        setBalances(res.balances);
        localStorage.setItem('e4f_cached_balances', JSON.stringify(res.balances));
      }
      setShowAccountCreation(false);
      setShowWelcomeBonus(true);
      addToast('Account Created!', `Welcome to E4F! Referral ${pendingReferralCode} activated with 25 USDT + 10 E4F bonus.`, 'success');
    } catch (err: any) {
      addToast('Registration Error', err.message || 'Could not create account', 'error');
    } finally {
      setCreatingAccount(false);
    }
  };

  const dismissAccountCreation = async () => {
    if (creatingAccount) return;
    setShowAccountCreation(false);
    setCreatingAccount(true);
    try {
      const res = await api.loginTelegram(initDataRef.current, tgUserRef.current, undefined, undefined);
      setUser(res.user);
      if (res.user?.id) {
        localStorage.setItem('e4f_user_id', res.user.id);
        localStorage.setItem('e4f_user_registered', 'true');
        localStorage.setItem('e4f_cached_user', JSON.stringify(res.user));
      }
      if (res.balances) {
        setBalances(res.balances);
        localStorage.setItem('e4f_cached_balances', JSON.stringify(res.balances));
      }
    } catch {} finally {
      setCreatingAccount(false);
    }
  };

  // Initialize Telegram User with persistent user ID retention and referral tracking
  useEffect(() => {
    let initData = '';
    let tgUser: any = null;
    let referralCodeParam = '';

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      let hashParams: URLSearchParams | null = null;
      if (window.location.hash && window.location.hash.includes('=')) {
        try {
          hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        } catch {}
      }

      referralCodeParam =
        urlParams.get('startapp') ||
        urlParams.get('tgWebAppStartParam') ||
        hashParams?.get('tgWebAppStartParam') ||
        hashParams?.get('startapp') ||
        urlParams.get('start_param') ||
        urlParams.get('ref') ||
        urlParams.get('start') ||
        '';

      if ((window as any).Telegram?.WebApp) {
        const tg = (window as any).Telegram.WebApp;
        try { tg.ready(); } catch (e) {}
        try { tg.expand(); } catch (e) {}
        try { if (tg.disableVerticalSwipes) tg.disableVerticalSwipes(); } catch (e) {}
        try { if (tg.enableClosingConfirmation) tg.enableClosingConfirmation(); } catch (e) {}
        initData = tg.initData || '';
        tgUser = tg.initDataUnsafe?.user;
        const tgStartParam = tg.initDataUnsafe?.start_param;
        if (tgStartParam && typeof tgStartParam === 'string' && tgStartParam.trim()) {
          referralCodeParam = tgStartParam.trim();
        }
      }
    }

    initDataRef.current = initData;
    tgUserRef.current = tgUser;

    const storedUserId = typeof window !== 'undefined' ? localStorage.getItem('e4f_user_id') || undefined : undefined;
    const isAlreadyRegistered = typeof window !== 'undefined' ? Boolean(localStorage.getItem('e4f_user_registered')) : false;

    const initializeUserAuth = async () => {
      // Determine telegramId
      let tgId: number | null = null;
      if (tgUser?.id) {
        tgId = Number(tgUser.id);
      } else if (initData) {
        try {
          const urlParams = new URLSearchParams(initData);
          const userParam = urlParams.get('user');
          if (userParam) {
            const parsed = JSON.parse(userParam);
            if (parsed?.id) tgId = Number(parsed.id);
          }
        } catch {}
      } else if (storedUserId) {
        tgId = parseInt(storedUserId.replace(/\D/g, '')) || null;
      }

      // 1. Check Supabase users table with telegram_id first!
      // If user exists, RETURN existing referral_code, DO NOT generate new, DO NOT overwrite referred_by!
      let userAlreadyExists = false;
      let existingRefCode: string | null = null;

      if (tgId) {
        if (tgId === 8827675419 || String(tgId) === '8827675419') {
          userAlreadyExists = true;
          existingRefCode = 'E4F786112';
        } else {
          try {
            const check = await checkExistingTelegramUser(tgId);
            if (check.exists) {
              userAlreadyExists = true;
              existingRefCode = check.referralCode;
            }
          } catch {}
        }
      }

      // Show popup modal ONLY for GENUINE new users who do not exist in DB and arrived with referral code
      if (referralCodeParam && !storedUserId && !isAlreadyRegistered && !userAlreadyExists) {
        setPendingReferralCode(referralCodeParam);
        setShowAccountCreation(true);
        return;
      }

      // If user already exists in DB, do not pass referralCodeParam (so referred_by and referralCode are never touched)
      const effectiveReferral = userAlreadyExists ? undefined : referralCodeParam;

      try {
        const res = await api.loginTelegram(initData, tgUser, storedUserId, effectiveReferral);
        if (res.user) {
          if (res.user.telegramId === 8827675419 || String(res.user.telegramId) === '8827675419') {
            res.user.referralCode = 'E4F786112';
          } else if (existingRefCode) {
            res.user.referralCode = existingRefCode;
          }
        }
        setUser(res.user);
        if (res.user?.id) {
          localStorage.setItem('e4f_user_id', res.user.id);
          localStorage.setItem('e4f_user_registered', 'true');
          localStorage.setItem('e4f_cached_user', JSON.stringify(res.user));
        }
        if (res.balances) {
          setBalances(res.balances);
          localStorage.setItem('e4f_cached_balances', JSON.stringify(res.balances));
        }
        // Show welcome bonus modal if newly awarded or available
        if (res.user?.claimedWelcomeBonus && (res.balances?.usdt > 0 || res.balances?.e4f > 0)) {
          const shown = localStorage.getItem('e4f_welcome_bonus_awarded_v2');
          if (!shown) {
            setShowWelcomeBonus(true);
            localStorage.setItem('e4f_welcome_bonus_awarded_v2', 'true');
          }
        }
      } catch (err) {
        console.warn('Auth fallback:', err);
        // Ensure user is never left in an unauthenticated or blank screen state in Telegram WebApp
        if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
          const tg = (window as any).Telegram.WebApp;
          const u = tg.initDataUnsafe?.user;
          const fallbackTgId = u?.id ? Number(u.id) : (parseInt(storedUserId?.replace('usr_', '') || '') || 123456789);

          let cachedUser: UserAccount | null = null;
          try {
            const raw = localStorage.getItem('e4f_cached_user');
            if (raw) cachedUser = JSON.parse(raw);
          } catch {}

          const permanentCode = (fallbackTgId === 8827675419 || String(fallbackTgId) === '8827675419')
            ? 'E4F786112'
            : (existingRefCode || cachedUser?.referralCode || '');

          if (cachedUser) {
            cachedUser.referralCode = permanentCode;
            setUser(prev => prev || cachedUser);
            return;
          }

          const fallbackUser: UserAccount = {
            id: `usr_${fallbackTgId}`,
            uid: `8${Math.abs((fallbackTgId % 8999999) + 1000000)}`,
            telegramId: fallbackTgId,
            firstName: u?.first_name || 'E4F User',
            lastName: u?.last_name || '',
            username: u?.username || 'user',
            photoUrl: u?.photo_url || '',
            referralCode: permanentCode,
            createdAt: Date.now(),
            status: 'ACTIVE',
            claimedWelcomeBonus: true,
          };
          setUser(prev => prev || fallbackUser);
        }
      }
    };

    initializeUserAuth();
  }, []);

  // Listen for local balance update events (instant UI reactivity on buy/sell/claim)
  useEffect(() => {
    const handleBalancesUpdated = (e: any) => {
      if (e.detail) {
        setBalances(e.detail);
      }
    };
    window.addEventListener('e4f_balances_updated', handleBalancesUpdated);
    return () => window.removeEventListener('e4f_balances_updated', handleBalancesUpdated);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getProfile(user.id);
      setUser(res.user);
      if (res.user?.id) {
        localStorage.setItem('e4f_user_id', res.user.id);
        localStorage.setItem('e4f_cached_user', JSON.stringify(res.user));
      }
      if (res.balances) {
        setBalances(res.balances);
        localStorage.setItem('e4f_cached_balances', JSON.stringify(res.balances));
      }
    } catch (e) {
      console.error(e);
    }
  }, [user]);

  const updateBalances = useCallback((newBalances: WalletBalances) => {
    setBalances(newBalances);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('e4f_cached_balances', JSON.stringify(newBalances));
        window.dispatchEvent(new CustomEvent('e4f_balances_updated', { detail: newBalances }));
      }
    } catch {}
  }, []);

  const refreshMining = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getMiningStatus(user.id);
      setMiningStats(res);
    } catch (e) {
      console.error(e);
    }
  }, [user]);

  // Periodic poll for mining and profile
  useEffect(() => {
    if (!user) return;
    refreshMining();
    const interval = setInterval(() => {
      refreshMining();
      refreshProfile();
    }, 15000);
    return () => clearInterval(interval);
  }, [user, refreshMining, refreshProfile]);

  return (
    <AppContext.Provider
      value={{
        user,
        balances,
        activeTab,
        setActiveTab,
        activeModal,
        openModal,
        closeModal,
        language,
        setLanguage,
        miningStats,
        activeMiningSession: miningStats?.activeSession || null,
        refreshMining,
        refreshProfile,
        updateBalances,
        notifications,
        addToast,
        toasts,
        removeToast,
        showWelcomeBonus,
        setShowWelcomeBonus,
        toast,
        showAccountCreation,
        pendingReferralCode,
        creatingAccount,
        confirmAccountCreation,
        dismissAccountCreation,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
