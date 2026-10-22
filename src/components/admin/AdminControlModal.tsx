import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Megaphone,
  ShieldAlert,
  Check,
  Lock,
  Radio,
  FileCheck,
  Users,
  Coins,
  Trash2,
  RefreshCw,
  ExternalLink,
  Clock,
  Layers,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Upload,
  Image as ImageIcon,
  Gift,
  ArrowUpRight,
  ArrowDownLeft,
  Zap,
  Calendar,
  Wallet,
  Pickaxe,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

interface AdminControlModalProps {
  onClose: () => void;
}

type AdminTab = 'OVERVIEW' | 'ADS' | 'REWARDS' | 'DEPOSITS' | 'WITHDRAWALS' | 'BONUSES' | 'NOTICES' | 'TASKS' | 'SUBMISSIONS' | 'USERS';

export const AdminControlModal: React.FC<AdminControlModalProps> = ({ onClose }) => {
  const { user, miningStats, refreshMining, addToast } = useApp();

  // Authentication State (Confidential Password - Auto-logout on exit)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const [authError, setAuthError] = useState('');
  const [authenticating, setAuthenticating] = useState(false);

  // Active Admin Tab
  const [activeTab, setActiveTab] = useState<AdminTab>('OVERVIEW');

  // Dashboard Stats
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Ad Settings
  const [adRequired, setAdRequired] = useState(miningStats?.adRequired ?? true);
  const [adDuration, setAdDuration] = useState(60);
  const [spinAdDuration, setSpinAdDuration] = useState(30);
  const [giftBoxAdDuration, setGiftBoxAdDuration] = useState(30);
  const [adProvider, setAdProvider] = useState<'ADSTERRA' | 'MONETAG' | 'SIMULATOR'>('ADSTERRA');
  const [adsterraLink, setAdsterraLink] = useState('https://beta.publishers.adsterra.com/direct-link-demo');
  const [monetagLink, setMonetagLink] = useState('https://monetag.com/direct-link-demo');
  const [monetagZoneId, setMonetagZoneId] = useState('12044377');
  const [monetagTelegramSdkEnabled, setMonetagTelegramSdkEnabled] = useState(true);

  // 10 Waterfall Ad Variables for Spin & Gift Box
  const [spin01Richads, setSpin01Richads] = useState('410203');
  const [spin02Monetag, setSpin02Monetag] = useState('12044377');
  const [spin03Onclicka, setSpin03Onclicka] = useState('6153717E4F');
  const [spin04Richads, setSpin04Richads] = useState('410203');
  const [spin05Monetag, setSpin05Monetag] = useState('12044377');

  const [box01Richads, setBox01Richads] = useState('410202');
  const [box02Monetag, setBox02Monetag] = useState('12044377');
  const [box03Onclicka, setBox03Onclicka] = useState('6153772E4F');
  const [box04Richads, setBox04Richads] = useState('410202');
  const [box05Monetag, setBox05Monetag] = useState('12044377');

  // Mining Ad Network & Waterfall Gate Settings (Real-Time Admin Control)
  const [miningPrimaryNetwork, setMiningPrimaryNetwork] = useState<'Monetag' | 'OnClickA' | 'RichAds'>('RichAds');
  const [miningSecondaryNetwork, setMiningSecondaryNetwork] = useState<'Monetag' | 'OnClickA' | 'RichAds'>('Monetag');
  const [miningWaterfallEnabled, setMiningWaterfallEnabled] = useState(true);
  const [mining01Richads, setMining01Richads] = useState('410204');
  const [mining02Monetag, setMining02Monetag] = useState('12044377');
  const [mining03Onclicka, setMining03Onclicka] = useState('6153774E4F');
  const [mining04Richads, setMining04Richads] = useState('410204');
  const [mining05Monetag, setMining05Monetag] = useState('12044377');
  // Hourly Mining Rate (E4F / Hour) - Dynamic Real-Time Admin Control
  const [miningRatePerHour, setMiningRatePerHour] = useState<number>(miningStats?.miningRatePerHour ?? 0.25);

  // Rewards & Wheel Spin Settings
  const [rewardSpinMaxDaily, setRewardSpinMaxDaily] = useState(5);
  const [rewardSpinAdRequired, setRewardSpinAdRequired] = useState(true);
  const [spinPrizes, setSpinPrizes] = useState<any[]>([
    { id: 0, label: '0.25 E4F', asset: 'E4F', amount: 0.25, color: '#3B82F6' },
    { id: 1, label: '0.50 USDT', asset: 'USDT', amount: 0.50, color: '#10B981' },
    { id: 2, label: '1.00 E4F', asset: 'E4F', amount: 1.00, color: '#EAB308' },
    { id: 3, label: '0.10 USDT', asset: 'USDT', amount: 0.10, color: '#6366F1' },
    { id: 4, label: '2.50 E4F', asset: 'E4F', amount: 2.50, color: '#EC4899' },
    { id: 5, label: '1.00 USDT', asset: 'USDT', amount: 1.00, color: '#14B8A6' },
    { id: 6, label: '5.00 E4F', asset: 'E4F', amount: 5.00, color: '#F97316' },
    { id: 7, label: '2.00 USDT', asset: 'USDT', amount: 2.00, color: '#8B5CF6' },
  ]);

  // Mystery Gift Boxes Settings
  const [giftBoxMaxDaily, setGiftBoxMaxDaily] = useState(5);
  const [giftBoxAdRequired, setGiftBoxAdRequired] = useState(true);
  const [giftBoxesList, setGiftBoxesList] = useState<any[]>([
    { id: 1, boxNumber: 1, name: 'Bronze Mystery Chest', rewardAsset: 'E4F', rewardAmount: 0.5, color: '#CD7F32' },
    { id: 2, boxNumber: 2, name: 'Silver Crypto Cache', rewardAsset: 'USDT', rewardAmount: 0.25, color: '#94A3B8' },
    { id: 3, boxNumber: 3, name: 'Gold Bullion Vault', rewardAsset: 'E4F', rewardAmount: 1.5, color: '#F59E0B' },
    { id: 4, boxNumber: 4, name: 'Platinum Reward Coffer', rewardAsset: 'USDT', rewardAmount: 0.75, color: '#E2E8F0' },
    { id: 5, boxNumber: 5, name: 'Diamond Jackpot Trunk', rewardAsset: 'E4F', rewardAmount: 3.0, color: '#38BDF8' },
  ]);

  // Daily Check-in Streak Settings (Day 1 to 7, Configurable E4F / USDT)
  const [dailyCheckInList, setDailyCheckInList] = useState<Array<{ day: number; asset: 'E4F' | 'USDT'; amount: number }>>([
    { day: 1, asset: 'USDT', amount: 0.01 },
    { day: 2, asset: 'USDT', amount: 0.02 },
    { day: 3, asset: 'USDT', amount: 0.03 },
    { day: 4, asset: 'E4F', amount: 3.0 },
    { day: 5, asset: 'E4F', amount: 5.0 },
    { day: 6, asset: 'USDT', amount: 0.05 },
    { day: 7, asset: 'USDT', amount: 0.07 },
  ]);

  // Deposit Settings
  const [depositsEnabled, setDepositsEnabled] = useState(true);
  const [depositMinUSDT, setDepositMinUSDT] = useState(2.0);
  const [depositFirstBonusUSDT, setDepositFirstBonusUSDT] = useState(10.0);
  const [depositMinInput, setDepositMinInput] = useState('2');
  const [depositBonusInput, setDepositBonusInput] = useState('10');
  const [bscDepositAddress, setBscDepositAddress] = useState('0x63562945f7845aa1130a5b1499720b29788c82db');

  // Withdrawal Settings & Verification Management
  const [withdrawalsEnabled, setWithdrawalsEnabled] = useState(true);
  const [maxWithdrawalLimit, setMaxWithdrawalLimit] = useState(1000);
  const [minWithdrawalLimit, setMinWithdrawalLimit] = useState(0.1);
  const [withdrawalFee, setWithdrawalFee] = useState(1.0);
  const [selectedAdminNetwork, setSelectedAdminNetwork] = useState<'TRC20' | 'BEP20' | 'TON'>('TRC20');
  const [networkWithdrawSettings, setNetworkWithdrawSettings] = useState<Record<string, {
    enabled: boolean;
    minAmount: number;
    maxAmount: number;
    fee: number;
  }>>({
    TRC20: { enabled: true, minAmount: 1.0, maxAmount: 1000.0, fee: 1.0 },
    BEP20: { enabled: true, minAmount: 1.0, maxAmount: 1000.0, fee: 0.5 },
    TON: { enabled: true, minAmount: 1.0, maxAmount: 1000.0, fee: 0.5 },
  });
  const [netInputs, setNetInputs] = useState<Record<string, { minAmount: string; maxAmount: string; fee: string }>>({
    TRC20: { minAmount: '1.0', maxAmount: '1000', fee: '1.0' },
    BEP20: { minAmount: '1.0', maxAmount: '1000', fee: '0.5' },
    TON: { minAmount: '1.0', maxAmount: '1000', fee: '0.5' },
  });
  const [withdrawalList, setWithdrawalList] = useState<any[]>([]);
  const [withdrawalFilter, setWithdrawalFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED' | 'REJECTED'>('PENDING');
  const [processingWithdrawalId, setProcessingWithdrawalId] = useState<string | null>(null);

  // Bonus & Mining Boost Tier Configurations
  const [welcomeBonusUSDT, setWelcomeBonusUSDT] = useState(1.0);
  const [welcomeBonusE4F, setWelcomeBonusE4F] = useState(5.0);
  const [referralBonusUSDT, setReferralBonusUSDT] = useState(0.5);
  const [referralMiningBoostTiers, setReferralMiningBoostTiers] = useState<any[]>([
    { minReferrals: 1, boostPercentage: 5 },
    { minReferrals: 3, boostPercentage: 10 },
    { minReferrals: 5, boostPercentage: 20 },
    { minReferrals: 10, boostPercentage: 50 },
    { minReferrals: 25, boostPercentage: 100 },
  ]);

  // Notice Board Form & List
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [annTitle, setAnnTitle] = useState('');
  const [annDesc, setAnnDesc] = useState('');
  const [annCtaText, setAnnCtaText] = useState('Check Details');
  const [annCtaUrl, setAnnCtaUrl] = useState('#mining');
  const [annImage, setAnnImage] = useState('');

  // Tasks Management Form & List
  const [taskList, setTaskList] = useState<any[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPlatform, setNewTaskPlatform] = useState<string>('WEBSITE');
  const [customPlatformName, setCustomPlatformName] = useState<string>('');
  const [newTaskUrl, setNewTaskUrl] = useState('https://');
  const [newTaskAsset, setNewTaskAsset] = useState<'E4F' | 'USDT'>('USDT');
  const [newTaskReward, setNewTaskReward] = useState('1.00');
  const [newTaskMethod, setNewTaskMethod] = useState<'AUTO' | 'MANUAL' | 'TIMER'>('TIMER');
  const [newTaskTimerSec, setNewTaskTimerSec] = useState('30');

  // Task Submissions Review Queue
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [previewScreenshotUrl, setPreviewScreenshotUrl] = useState<string | null>(null);

  // Users List
  const [userList, setUserList] = useState<any[]>([]);

  // Deposits List & Queue
  const [depositsList, setDepositsList] = useState<any[]>([]);
  const [processingDepositId, setProcessingDepositId] = useState<string | null>(null);

  // Retention cleanup status
  const [cleaningRetention, setCleaningRetention] = useState(false);

  // Auto-restore admin session if token exists or if user is verified Telegram admin (8827675419)
  useEffect(() => {
    const isTgAdmin =
      user?.telegramId === 8827675419 ||
      String(user?.telegramId) === '8827675419' ||
      (typeof window !== 'undefined' && Number((window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id) === 8827675419);

    if (isTgAdmin && !isAuthenticated) {
      setAuthenticating(true);
      api.adminLogin('8827675419')
        .then(res => {
          if (res.success) {
            setIsAuthenticated(true);
            if (res.token) {
              try { localStorage.setItem('e4f_admin_token', res.token); } catch {}
            }
            loadAdminData();
          }
        })
        .catch(() => {})
        .finally(() => {
          setAuthenticating(false);
        });
      return;
    }

    const existingToken = typeof window !== 'undefined' ? localStorage.getItem('e4f_admin_token') : null;
    if (existingToken && !isAuthenticated) {
      setAuthenticating(true);
      api.getAdminDashboard()
        .then(() => {
          setIsAuthenticated(true);
        })
        .catch(() => {
          try { localStorage.removeItem('e4f_admin_token'); } catch {}
        })
        .finally(() => {
          setAuthenticating(false);
        });
    }
  }, [user]);

  // Auto-load data if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadAdminData(adminKey);
    }
  }, [isAuthenticated]);

  // Verify Confidential Password via Server
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPassword = (adminPassword || '').trim();
    if (!cleanPassword) return;
    setAuthenticating(true);
    setAuthError('');
    try {
      const res = await api.adminLogin(cleanPassword);
      if (res.success) {
        setIsAuthenticated(true);
        const resolvedKey = res.key || '';
        if (resolvedKey) setAdminKey(resolvedKey);
        try {
          if (res.token) {
            localStorage.setItem('e4f_admin_token', res.token);
          }
        } catch {}
        setAdminPassword('');
        loadAdminData(resolvedKey || adminKey);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Incorrect Admin Security Password');
    } finally {
      setAuthenticating(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAdminPassword('');
    try {
      localStorage.removeItem('e4f_admin_token');
      localStorage.removeItem('e4f_admin_key');
      sessionStorage.removeItem('e4f_admin_token');
      sessionStorage.removeItem('e4f_admin_key');
    } catch {}
  };

  const handleClose = () => {
    handleLogout();
    onClose();
  };

  // Auto-logout whenever leaving or exiting the admin panel
  useEffect(() => {
    return () => {
      try {
        localStorage.removeItem('e4f_admin_token');
        localStorage.removeItem('e4f_admin_key');
        sessionStorage.removeItem('e4f_admin_token');
        sessionStorage.removeItem('e4f_admin_key');
      } catch {}
    };
  }, []);

  const loadAdminData = async (keyToUse = adminKey) => {
    setLoading(true);
    try {
      const [dash, anns, tasks, subs, users, withdrawalsRes, depositsRes] = await Promise.all([
        api.getAdminDashboard(keyToUse),
        api.getAdminAnnouncements(keyToUse),
        api.getAdminTasks(keyToUse),
        api.getAdminTaskSubmissions(keyToUse),
        api.getAdminUsers(keyToUse),
        api.getAdminWithdrawals(keyToUse).catch(() => ({ withdrawals: [] })),
        api.getAdminDeposits(keyToUse).catch(() => ({ deposits: [] })),
      ]);
      setDashboardData(dash);
      if (depositsRes?.deposits && Array.isArray(depositsRes.deposits)) {
        setDepositsList(depositsRes.deposits);
      }
      if (dash?.systemSettings) {
        setAdRequired(dash.systemSettings.rewardedAdRequired ?? true);
        if (dash.systemSettings.miningAdDurationSeconds !== undefined) {
          setAdDuration(dash.systemSettings.miningAdDurationSeconds);
        } else if (dash.systemSettings.adMiningDurationSeconds !== undefined) {
          setAdDuration(dash.systemSettings.adMiningDurationSeconds);
        }
        if (dash.systemSettings.spinAdDurationSeconds !== undefined) {
          setSpinAdDuration(dash.systemSettings.spinAdDurationSeconds);
        }
        if (dash.systemSettings.giftBoxAdDurationSeconds !== undefined) {
          setGiftBoxAdDuration(dash.systemSettings.giftBoxAdDurationSeconds);
        }
        setAdProvider(dash.systemSettings.adProvider || 'ADSTERRA');
        if (dash.systemSettings.adsterraDirectLink) setAdsterraLink(dash.systemSettings.adsterraDirectLink);
        if (dash.systemSettings.monetagDirectLink) setMonetagLink(dash.systemSettings.monetagDirectLink);
        if (dash.systemSettings.monetagZoneId) setMonetagZoneId(dash.systemSettings.monetagZoneId);
        if (dash.systemSettings.monetagTelegramSdkEnabled !== undefined) setMonetagTelegramSdkEnabled(dash.systemSettings.monetagTelegramSdkEnabled);
        if (dash.systemSettings.rewardSpinMaxDaily !== undefined) setRewardSpinMaxDaily(dash.systemSettings.rewardSpinMaxDaily);
        if (dash.systemSettings.rewardSpinAdRequired !== undefined) setRewardSpinAdRequired(dash.systemSettings.rewardSpinAdRequired);
        if (dash.systemSettings.spinWheelPrizes && dash.systemSettings.spinWheelPrizes.length > 0) {
          setSpinPrizes(dash.systemSettings.spinWheelPrizes);
        }
        if (dash.systemSettings.giftBoxMaxDaily !== undefined) setGiftBoxMaxDaily(dash.systemSettings.giftBoxMaxDaily);
        if (dash.systemSettings.giftBoxAdRequired !== undefined) setGiftBoxAdRequired(dash.systemSettings.giftBoxAdRequired);
        if (dash.systemSettings.giftBoxesConfig && dash.systemSettings.giftBoxesConfig.length > 0) {
          setGiftBoxesList(dash.systemSettings.giftBoxesConfig);
        }
        if (dash.systemSettings.dailyCheckInRewards && dash.systemSettings.dailyCheckInRewards.length > 0) {
          setDailyCheckInList(dash.systemSettings.dailyCheckInRewards);
        }
        setDepositsEnabled(dash.systemSettings.depositsEnabled ?? true);
        const loadedMin = dash.systemSettings.depositMinUSDT ?? 2.0;
        const loadedBonus = dash.systemSettings.depositFirstBonusUSDT ?? 10.0;
        setDepositMinUSDT(loadedMin);
        setDepositFirstBonusUSDT(loadedBonus);
        setDepositMinInput(String(loadedMin));
        setDepositBonusInput(String(loadedBonus));
        if (dash.systemSettings.bscDepositAddress) setBscDepositAddress(dash.systemSettings.bscDepositAddress);

        // Withdrawal, Welcome bonus, and referral boost settings
        if (dash.systemSettings.withdrawalsEnabled !== undefined) setWithdrawalsEnabled(dash.systemSettings.withdrawalsEnabled);
        if (dash.systemSettings.maxWithdrawalLimit !== undefined) setMaxWithdrawalLimit(dash.systemSettings.maxWithdrawalLimit);
        if (dash.systemSettings.minWithdrawalLimit !== undefined) setMinWithdrawalLimit(dash.systemSettings.minWithdrawalLimit);
        if (dash.systemSettings.withdrawalFee !== undefined) setWithdrawalFee(dash.systemSettings.withdrawalFee);
        if (dash.systemSettings.networkWithdrawSettings) {
          const nw = dash.systemSettings.networkWithdrawSettings;
          setNetworkWithdrawSettings(nw);
          setNetInputs({
            TRC20: {
              minAmount: String(nw.TRC20?.minAmount ?? 1.0),
              maxAmount: String(nw.TRC20?.maxAmount ?? 1000),
              fee: String(nw.TRC20?.fee ?? 1.0),
            },
            BEP20: {
              minAmount: String(nw.BEP20?.minAmount ?? 1.0),
              maxAmount: String(nw.BEP20?.maxAmount ?? 1000),
              fee: String(nw.BEP20?.fee ?? 0.5),
            },
            TON: {
              minAmount: String(nw.TON?.minAmount ?? 1.0),
              maxAmount: String(nw.TON?.maxAmount ?? 1000),
              fee: String(nw.TON?.fee ?? 0.5),
            },
          });
        }
        if (dash.systemSettings.welcomeBonusUSDT !== undefined) setWelcomeBonusUSDT(dash.systemSettings.welcomeBonusUSDT);
        if (dash.systemSettings.welcomeBonusE4F !== undefined) setWelcomeBonusE4F(dash.systemSettings.welcomeBonusE4F);
        if (dash.systemSettings.referralMiningBoostTiers && dash.systemSettings.referralMiningBoostTiers.length > 0) {
          setReferralMiningBoostTiers(dash.systemSettings.referralMiningBoostTiers);
        }

        // Waterfall Ad Variables with strict real-ID sanitization
        const sanitizeAdminAdId = (val: any, fallback: string) => {
          if (!val || typeof val !== 'string') return fallback;
          const t = val.trim();
          if (/^(spin|box|mining)_[0-9a-z_]+$/i.test(t)) return fallback;
          if (t === '6153774') return '6153774E4F';
          if (t === '6153772') return '6153772E4F';
          if (t === '6153717') return '6153717E4F';
          return t || fallback;
        };

        setSpin01Richads(sanitizeAdminAdId(dash.systemSettings.spin_01_richads, '410203'));
        setSpin02Monetag(sanitizeAdminAdId(dash.systemSettings.spin_02_monetag, '12044377'));
        setSpin03Onclicka(sanitizeAdminAdId(dash.systemSettings.spin_03_onclicka, '6153717E4F'));
        setSpin04Richads(sanitizeAdminAdId(dash.systemSettings.spin_04_richads, '410203'));
        setSpin05Monetag(sanitizeAdminAdId(dash.systemSettings.spin_05_monetag, '12044377'));

        setBox01Richads(sanitizeAdminAdId(dash.systemSettings.box_01_richads, '410202'));
        setBox02Monetag(sanitizeAdminAdId(dash.systemSettings.box_02_monetag, '12044377'));
        setBox03Onclicka(sanitizeAdminAdId(dash.systemSettings.box_03_onclicka, '6153772E4F'));
        setBox04Richads(sanitizeAdminAdId(dash.systemSettings.box_04_richads, '410202'));
        setBox05Monetag(sanitizeAdminAdId(dash.systemSettings.box_05_monetag, '12044377'));

        // Mining Waterfall Gate Settings
        if (dash.systemSettings.miningPrimaryNetwork === 'Monetag' || dash.systemSettings.miningPrimaryNetwork === 'OnClickA' || dash.systemSettings.miningPrimaryNetwork === 'RichAds') {
          setMiningPrimaryNetwork(dash.systemSettings.miningPrimaryNetwork);
        } else {
          setMiningPrimaryNetwork('RichAds');
        }
        if (dash.systemSettings.miningSecondaryNetwork === 'Monetag' || dash.systemSettings.miningSecondaryNetwork === 'OnClickA' || dash.systemSettings.miningSecondaryNetwork === 'RichAds') {
          setMiningSecondaryNetwork(dash.systemSettings.miningSecondaryNetwork);
        } else {
          setMiningSecondaryNetwork('Monetag');
        }
        if (dash.systemSettings.miningWaterfallEnabled !== undefined) setMiningWaterfallEnabled(dash.systemSettings.miningWaterfallEnabled);
        setMining01Richads(sanitizeAdminAdId(dash.systemSettings.mining_01_richads, '410204'));
        setMining02Monetag(sanitizeAdminAdId(dash.systemSettings.mining_02_monetag, '12044377'));
        setMining03Onclicka(sanitizeAdminAdId(dash.systemSettings.mining_03_onclicka, '6153774E4F'));
        setMining04Richads(sanitizeAdminAdId(dash.systemSettings.mining_04_richads, '410204'));
        setMining05Monetag(sanitizeAdminAdId(dash.systemSettings.mining_05_monetag, '12044377'));
        if (dash.systemSettings.miningRatePerHour !== undefined) setMiningRatePerHour(dash.systemSettings.miningRatePerHour);
      }
      if (anns?.announcements) setAnnouncements(anns.announcements);
      if (tasks?.tasks) setTaskList(tasks.tasks);
      if (subs?.submissions) setSubmissions(subs.submissions);
      if (users?.users) setUserList(users.users);
      if (withdrawalsRes?.withdrawals) setWithdrawalList(withdrawalsRes.withdrawals);
    } catch (err: any) {
      addToast('Data Sync Issue', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Save Ad Settings
  const handleSaveAdSettings = async () => {
    setLoading(true);
    try {
      const cleanAdId = (val: string, fallback: string) => {
        if (!val || typeof val !== 'string') return fallback;
        const t = val.trim();
        if (/^(spin|box|mining)_[0-9a-z_]+$/i.test(t)) return fallback;
        return t || fallback;
      };

      await api.updateAdminSettings({
        rewardedAdRequired: adRequired,
        adProvider: miningPrimaryNetwork,
        adMiningDurationSeconds: Number(adDuration),
        miningAdDurationSeconds: Number(adDuration),
        spinAdDurationSeconds: Number(spinAdDuration),
        giftBoxAdDurationSeconds: Number(giftBoxAdDuration),
        adsterraDirectLink: adsterraLink,
        monetagDirectLink: '',
        monetagZoneId: cleanAdId(monetagZoneId, '12044377'),
        monetagTelegramSdkEnabled,
        spin_01_richads: cleanAdId(spin01Richads, '410203'),
        spin_02_monetag: cleanAdId(spin02Monetag, '12044377'),
        spin_03_onclicka: cleanAdId(spin03Onclicka, '6153717E4F'),
        spin_04_richads: cleanAdId(spin04Richads, '410203'),
        spin_05_monetag: cleanAdId(spin05Monetag, '12044377'),
        box_01_richads: cleanAdId(box01Richads, '410202'),
        box_02_monetag: cleanAdId(box02Monetag, '12044377'),
        box_03_onclicka: cleanAdId(box03Onclicka, '6153772E4F'),
        box_04_richads: cleanAdId(box04Richads, '410202'),
        box_05_monetag: cleanAdId(box05Monetag, '12044377'),
        // Mining Waterfall Gate Settings
        miningPrimaryNetwork,
        miningSecondaryNetwork,
        miningWaterfallEnabled,
        mining_01_richads: cleanAdId(mining01Richads, '410204'),
        mining_02_monetag: cleanAdId(mining02Monetag, '12044377'),
        mining_03_onclicka: cleanAdId(mining03Onclicka, '6153774E4F'),
        mining_04_richads: cleanAdId(mining04Richads, '410204'),
        mining_05_monetag: cleanAdId(mining05Monetag, '12044377'),
        miningRatePerHour: Number(miningRatePerHour),
      }, adminKey);
      addToast('Saved', 'Mining rate, ad network, durations & waterfall settings updated live!', 'success');
      await refreshMining();
    } catch (err: any) {
      addToast('Save Failed', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Save Reward Settings (Spins, Mystery Gift Boxes & Monetag SDK)
  const handleSaveRewardSettings = async () => {
    setLoading(true);
    try {
      await api.updateAdminSettings({
        monetagZoneId,
        monetagTelegramSdkEnabled,
        spinAdDurationSeconds: Number(spinAdDuration),
        giftBoxAdDurationSeconds: Number(giftBoxAdDuration),
        rewardSpinMaxDaily: Number(rewardSpinMaxDaily),
        rewardSpinAdRequired,
        spinWheelPrizes: spinPrizes,
        giftBoxMaxDaily: Number(giftBoxMaxDaily),
        giftBoxAdRequired,
        giftBoxesConfig: giftBoxesList,
        dailyCheckInRewards: dailyCheckInList.map((item, idx) => ({
          day: item.day || idx + 1,
          asset: item.asset,
          amount: Math.round(Math.max(0.0001, Number(item.amount) || 0.01) * 10000) / 10000,
        })),
      }, adminKey);
      addToast('Saved', 'Daily Check-In, Spin & Box reward settings and durations saved successfully', 'success');
      loadAdminData();
    } catch (err: any) {
      addToast('Save Failed', err.message || 'Could not update reward settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Save Deposit Settings
  const handleSaveDepositSettings = async () => {
    setLoading(true);
    try {
      const rawMin = parseFloat(depositMinInput);
      const rawBonus = parseFloat(depositBonusInput);
      const finalMin = isNaN(rawMin) || rawMin < 2.0 ? 2.0 : Math.round(rawMin * 100) / 100;
      const finalBonus = isNaN(rawBonus) || rawBonus < 0 ? 0 : Math.round(rawBonus * 100) / 100;

      setDepositMinUSDT(finalMin);
      setDepositFirstBonusUSDT(finalBonus);
      setDepositMinInput(String(finalMin));
      setDepositBonusInput(String(finalBonus));

      await api.updateAdminSettings({
        depositsEnabled,
        depositMinUSDT: finalMin,
        depositFirstBonusUSDT: finalBonus,
        bscDepositAddress,
      }, adminKey);
      addToast('Saved', `Deposit rules updated live: Min ${finalMin} USDT, Bonus ${finalBonus} USDT`, 'success');
      await loadAdminData();
    } catch (err: any) {
      addToast('Save Failed', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Apply currently selected network limits to all networks
  const handleApplyToAllNetworks = () => {
    const cur = netInputs[selectedAdminNetwork];
    setNetInputs({
      TRC20: { ...cur },
      BEP20: { ...cur },
      TON: { ...cur },
    });
    setNetworkWithdrawSettings(prev => ({
      TRC20: { ...prev.TRC20, minAmount: parseFloat(cur.minAmount) || 0.1, maxAmount: parseFloat(cur.maxAmount) || 1000, fee: parseFloat(cur.fee) || 0 },
      BEP20: { ...prev.BEP20, minAmount: parseFloat(cur.minAmount) || 0.1, maxAmount: parseFloat(cur.maxAmount) || 1000, fee: parseFloat(cur.fee) || 0 },
      TON: { ...prev.TON, minAmount: parseFloat(cur.minAmount) || 0.1, maxAmount: parseFloat(cur.maxAmount) || 1000, fee: parseFloat(cur.fee) || 0 },
    }));
    addToast('Preset Applied', `Copied ${selectedAdminNetwork} limits & fee to TRC20, BEP20, and TON. Click Save to persist.`, 'info');
  };

  // Save Withdrawal Settings
  const handleSaveWithdrawalSettings = async () => {
    setLoading(true);
    try {
      const updatedNets: Record<string, { enabled: boolean; minAmount: number; maxAmount: number; fee: number }> = {};
      const networks: Array<'TRC20' | 'BEP20' | 'TON'> = ['TRC20', 'BEP20', 'TON'];

      for (const net of networks) {
        const rawMin = parseFloat(netInputs[net]?.minAmount ?? String(networkWithdrawSettings[net]?.minAmount ?? 0.1)) || 0.1;
        const rawMax = parseFloat(netInputs[net]?.maxAmount ?? String(networkWithdrawSettings[net]?.maxAmount ?? 1000)) || 1000;
        const rawFee = parseFloat(netInputs[net]?.fee ?? String(networkWithdrawSettings[net]?.fee ?? 1.0)) || 0;

        const clampedMin = Math.round(Math.max(0.1, Math.min(5000, rawMin)) * 100) / 100;
        const clampedMax = Math.round(Math.max(0.1, Math.min(5000, rawMax)) * 100) / 100;
        const clampedFee = Math.round(Math.max(0, Math.min(500, rawFee)) * 100) / 100;

        if (clampedMin > clampedMax) {
          addToast('Invalid Limits', `For ${net}: Minimum limit (${clampedMin}) cannot exceed Maximum limit (${clampedMax}).`, 'error');
          setLoading(false);
          return;
        }

        updatedNets[net] = {
          enabled: networkWithdrawSettings[net]?.enabled !== false,
          minAmount: clampedMin,
          maxAmount: clampedMax,
          fee: clampedFee,
        };
      }

      setNetworkWithdrawSettings(updatedNets);
      setMaxWithdrawalLimit(updatedNets[selectedAdminNetwork].maxAmount);
      setMinWithdrawalLimit(updatedNets[selectedAdminNetwork].minAmount);
      setWithdrawalFee(updatedNets[selectedAdminNetwork].fee);

      await api.updateAdminSettings({
        withdrawalsEnabled,
        maxWithdrawalLimit: updatedNets[selectedAdminNetwork].maxAmount,
        minWithdrawalLimit: updatedNets[selectedAdminNetwork].minAmount,
        withdrawalFee: updatedNets[selectedAdminNetwork].fee,
        networkWithdrawSettings: updatedNets,
      }, adminKey);

      addToast('Saved Successfully', 'Withdrawal limits and network fees updated live without app update.', 'success');
    } catch (err: any) {
      addToast('Save Failed', err.message || 'Error saving settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Review Withdrawal (Approve or Reject)
  const handleReviewWithdrawal = async (withdrawalId: string, decision: 'APPROVE' | 'REJECT') => {
    setProcessingWithdrawalId(withdrawalId);
    try {
      await api.reviewAdminWithdrawal(withdrawalId, decision, undefined, adminKey);
      addToast(
        decision === 'APPROVE' ? 'Withdrawal Approved' : 'Withdrawal Rejected',
        decision === 'APPROVE'
          ? 'Transaction marked COMPLETED and balance finalized.'
          : 'Transaction marked REJECTED and funds refunded to user spot balance.',
        decision === 'APPROVE' ? 'success' : 'info'
      );
      await loadAdminData();
    } catch (err: any) {
      addToast('Review Failed', err.message || 'Error updating withdrawal', 'error');
    } finally {
      setProcessingWithdrawalId(null);
    }
  };

  // Review Deposit (Approve or Reject)
  const handleReviewDeposit = async (depositId: string, decision: 'APPROVE' | 'REJECT') => {
    setProcessingDepositId(depositId);
    try {
      await api.reviewAdminDeposit(depositId, decision, undefined, adminKey);
      addToast(
        decision === 'APPROVE' ? 'Deposit Approved & Credited' : 'Deposit Rejected',
        decision === 'APPROVE'
          ? 'Deposit confirmed, verified on ledger, and funds credited to user wallet.'
          : 'Deposit submission marked REJECTED.',
        decision === 'APPROVE' ? 'success' : 'info'
      );
      await loadAdminData();
    } catch (err: any) {
      addToast('Review Failed', err.message || 'Error reviewing deposit', 'error');
    } finally {
      setProcessingDepositId(null);
    }
  };

  // Save Bonus & Referral Mining Boost Tier Settings
  const handleSaveBonusAndBoostSettings = async () => {
    setLoading(true);
    try {
      await api.updateAdminSettings({
        welcomeBonusUSDT: Number(welcomeBonusUSDT),
        welcomeBonusE4F: Number(welcomeBonusE4F),
        referralBonusUSDT: Number(referralBonusUSDT),
        referralMiningBoostTiers,
        miningRatePerHour: Number(miningRatePerHour),
      }, adminKey);
      addToast('Saved', 'Welcome bonus, referral rewards & mining boost tiers updated without app update!', 'success');
      await loadAdminData();
    } catch (err: any) {
      addToast('Save Failed', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Image File Selection for Notice Board
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      addToast('Image Too Large', 'Maximum image size is 2MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setAnnImage(event.target.result as string);
        addToast('Image Selected', 'Notice image loaded (600x300 recommended)', 'info');
      }
    };
    reader.readAsDataURL(file);
  };

  // Publish Announcement
  const handlePublishNotice = async () => {
    if (!annTitle || !annDesc) {
      addToast('Missing Details', 'Title and description are required', 'error');
      return;
    }
    setLoading(true);
    try {
      await api.createAnnouncement({
        title: annTitle,
        description: annDesc,
        ctaText: annCtaText || 'Check Details',
        ctaUrl: annCtaUrl || '#mining',
        imageUrl: annImage || undefined,
      }, adminKey);
      addToast('Notice Live', 'Announcement published to user feeds', 'success');
      setAnnTitle('');
      setAnnDesc('');
      setAnnImage('');
      const anns = await api.getAdminAnnouncements(adminKey);
      if (anns?.announcements) setAnnouncements(anns.announcements);
    } catch (err: any) {
      addToast('Publish Failed', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Delete Announcement
  const handleDeleteNotice = async (id: string) => {
    try {
      await api.deleteAnnouncement(id, adminKey);
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      addToast('Notice Removed', 'Announcement deleted', 'info');
    } catch (err: any) {
      addToast('Delete Failed', err.message, 'error');
    }
  };

  // Create Dynamic Task with Custom Platform
  const handleCreateTask = async () => {
    if (!newTaskTitle || !newTaskDesc) {
      addToast('Missing Info', 'Task title and description are required', 'error');
      return;
    }
    const resolvedPlatform = (newTaskPlatform === 'CUSTOM' ? customPlatformName.trim() : newTaskPlatform) || 'CUSTOM';
    setLoading(true);
    try {
      await api.createAdminTask({
        title: newTaskTitle,
        description: newTaskDesc,
        platform: resolvedPlatform,
        url: newTaskUrl,
        rewardAsset: newTaskAsset,
        rewardAmount: parseFloat(newTaskReward) || 1.0,
        verificationMethod: newTaskMethod,
        durationSeconds: newTaskMethod === 'TIMER' ? Math.max(5, parseInt(newTaskTimerSec) || 30) : undefined,
      }, adminKey);
      addToast('Task Active', `New dynamic task published under ${resolvedPlatform}`, 'success');
      setNewTaskTitle('');
      setNewTaskDesc('');
      setCustomPlatformName('');
      const tasks = await api.getAdminTasks(adminKey);
      if (tasks?.tasks) setTaskList(tasks.tasks);
    } catch (err: any) {
      addToast('Task Failed', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Delete Task
  const handleDeleteTask = async (id: string) => {
    try {
      await api.deleteAdminTask(id, adminKey);
      setTaskList(prev => prev.filter(t => t.id !== id));
      addToast('Task Removed', 'Task deleted', 'info');
    } catch (err: any) {
      addToast('Delete Failed', err.message, 'error');
    }
  };

  // Review Task Submission
  const handleReviewSubmission = async (submissionId: string, decision: 'APPROVE' | 'REJECT') => {
    setReviewingId(submissionId);
    try {
      await api.reviewTaskSubmission(submissionId, decision, decision === 'APPROVE' ? 'Verified by Admin' : 'Insufficient proof submitted', adminKey);
      setSubmissions(prev =>
        prev.map(s => (s.id === submissionId ? { ...s, status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED' } : s))
      );
      addToast(
        decision === 'APPROVE' ? 'Submission Approved' : 'Submission Rejected',
        decision === 'APPROVE' ? 'Reward credited to user wallet' : 'Proof rejected',
        decision === 'APPROVE' ? 'success' : 'info'
      );
    } catch (err: any) {
      addToast('Review Failed', err.message, 'error');
    } finally {
      setReviewingId(null);
    }
  };

  // Toggle User Status
  const handleToggleUserStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await api.updateAdminUserStatus(userId, newStatus, adminKey);
      setUserList(prev => prev.map(u => (u.id === userId ? { ...u, status: newStatus } : u)));
      addToast('User Updated', `User status changed to ${newStatus}`, 'info');
    } catch (err: any) {
      addToast('Update Failed', err.message, 'error');
    }
  };

  // 30-Day Retention Cleanup
  const handleRunRetentionCleanup = async () => {
    setCleaningRetention(true);
    try {
      const res = await api.cleanupRetention(adminKey);
      addToast('Retention Executed', res.message, 'success');
      loadAdminData();
    } catch (err: any) {
      addToast('Cleanup Failed', err.message, 'error');
    } finally {
      setCleaningRetention(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#0A0F1D] border border-amber-500/40 rounded-3xl p-5 text-slate-200 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Sliders className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">Admin Mission Control</h3>
              <p className="text-[10px] text-slate-400">Server-Authoritative Exchange Operations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                type="button"
                onClick={handleLogout}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 font-semibold transition-colors cursor-pointer"
                title="Log out of admin session"
              >
                Log Out
              </button>
            )}
            <button
              onClick={handleClose}
              className="p-1.5 rounded-full bg-slate-800/80 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {!isAuthenticated ? (
          // Server-Auth Lock Screen
          <form onSubmit={handleLogin} className="flex-1 py-6 px-4 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
              <Lock className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-white mb-1">Restricted Access</h4>
            <p className="text-xs text-slate-400 max-w-xs mb-3">
              Enter Administrator Password to access authoritative controls.
            </p>
            {authError && (
              <div className="w-full max-w-xs mb-4 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <div className="w-full max-w-xs space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block text-left mb-1">
                  Administrator Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    placeholder="Enter confidential password"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono tracking-wider"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={authenticating || !adminPassword}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-lg transition-all cursor-pointer"
              >
                {authenticating ? 'Authenticating...' : 'Unlock Admin Panel'}
              </button>
            </div>
          </form>
        ) : (
          // Authenticated Dashboard
          <div className="flex-1 flex flex-col min-h-0 pt-3">
            {/* Nav Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-2 border-b border-slate-800/80 no-scrollbar text-xs font-semibold">
              {[
                { id: 'OVERVIEW', label: 'Overview', icon: Layers },
                { id: 'WITHDRAWALS', label: `Withdrawals (${withdrawalList.filter(w => w.status === 'PENDING').length})`, icon: ArrowUpRight },
                { id: 'DEPOSITS', label: 'Deposits', icon: ArrowDownLeft },
                { id: 'BONUSES', label: 'Bonus & Boost', icon: Zap },
                { id: 'ADS', label: 'Ad Gate', icon: Radio },
                { id: 'REWARDS', label: 'Spins & Gifts', icon: Gift },
                { id: 'NOTICES', label: 'Notices', icon: Megaphone },
                { id: 'TASKS', label: 'Tasks', icon: Sliders },
                { id: 'SUBMISSIONS', label: `Proofs (${submissions.filter(s => s.status === 'SUBMITTED').length})`, icon: FileCheck },
                { id: 'USERS', label: `Users (${userList.length})`, icon: Users },
              ].map(tab => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as AdminTab)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                      active
                        ? 'bg-amber-500 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Scrollable View Container */}
            <div className="flex-1 overflow-y-auto pt-3 pr-1 space-y-4 text-xs no-scrollbar">
              {/* 1. OVERVIEW */}
              {activeTab === 'OVERVIEW' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Registered Users</div>
                      <div className="text-base font-extrabold text-white mt-1">
                        {dashboardData?.totalUsers ?? userList.length}
                      </div>
                      <div className="text-[10px] text-emerald-400 mt-0.5 flex items-center justify-between">
                        <span>{dashboardData?.activeUsers ?? userList.filter(u => u.status === 'ACTIVE').length} Active</span>
                        <span className="text-amber-400 font-medium">({dashboardData?.activeMiners ?? 0} mining)</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Pending Proofs</div>
                      <div className="text-base font-extrabold text-amber-400 mt-1">
                        {submissions.filter(s => s.status === 'SUBMITTED').length}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Awaiting review</div>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">E4F Distributed</div>
                      <div className="text-base font-extrabold text-sky-400 mt-1">
                        {dashboardData?.totalE4FDistributed ?? 0} E4F
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Mined & Task pool</div>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">USDT Distributed</div>
                      <div className="text-base font-extrabold text-emerald-400 mt-1">
                        ${dashboardData?.totalUSDTDistributed ?? 0}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Spot balances credited</div>
                    </div>
                  </div>

                  {/* 90-Day Retention Policy */}
                  <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-emerald-400" />
                        <span>90-Day History Retention Policy</span>
                      </div>
                      <button
                        onClick={handleRunRetentionCleanup}
                        disabled={cleaningRetention}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold transition-all flex items-center gap-1"
                      >
                        <RefreshCw className={`w-3 h-3 ${cleaningRetention ? 'animate-spin' : ''}`} />
                        <span>Run 90D Purge</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      All trade, withdraw, deposit, referral, and transaction history is strictly preserved for 90 days. Records older than 90 days are sequentially and progressively purged.
                    </p>
                  </div>
                </div>
              )}

              {/* 2. AD GATE SETTINGS */}
              {activeTab === 'ADS' && (
                <div className="space-y-3 p-1">
                  {/* ⛏️ MINING BUTTON AD NETWORK & WATERFALL GATE SETTINGS */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-amber-500/40 shadow-xl space-y-4">
                    {/* Header + Master On/Off Toggle */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div>
                        <div className="font-extrabold text-white text-sm flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                          <span>⛏️ Mining Button Ad Network & Waterfall Gate</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Configure which ad network loads on Mining button click without app updates.
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          adRequired ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {adRequired ? 'AD GATE ON' : 'AD GATE OFF'}
                        </span>
                        <button
                          onClick={() => setAdRequired(!adRequired)}
                          className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                            adRequired ? 'bg-amber-500' : 'bg-slate-700'
                          }`}
                          title="Toggle Mining Ad Requirement"
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-slate-950 transition-transform absolute top-1 ${
                              adRequired ? 'right-1' : 'left-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* ⛏️ Hourly Mining Rate Controller */}
                    <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-amber-500/30 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                        <div>
                          <div className="font-extrabold text-white text-xs flex items-center gap-1.5">
                            <Pickaxe className="w-4 h-4 text-amber-400" />
                            <span>Hourly Mining Rate (E4F / Hour)</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Set how much E4F users mine per hour. Changes apply live without app updates.
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-mono font-black text-amber-400">
                            {miningRatePerHour} E4F / hr
                          </div>
                          <div className="text-[9px] text-slate-400">
                            {(miningRatePerHour * 8).toFixed(2)} E4F / 8h Session
                          </div>
                        </div>
                      </div>

                      {/* Quick Presets */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-400 font-semibold uppercase block">
                          Quick Presets (E4F / Hour)
                        </label>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {[0.10, 0.25, 0.50, 1.00, 2.00, 5.00].map(val => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setMiningRatePerHour(val)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                                Number(miningRatePerHour) === val
                                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md font-black scale-105'
                                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                              }`}
                            >
                              {val.toFixed(2)} E4F
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Custom Value Input */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-semibold uppercase block">
                          Custom Mining Rate (Any Desired Value)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="any"
                            min="0.001"
                            value={miningRatePerHour}
                            onChange={e => setMiningRatePerHour(parseFloat(e.target.value) || 0)}
                            className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-amber-300 font-mono font-bold focus:border-amber-400 focus:outline-none"
                            placeholder="e.g. 0.25, 0.50, 1.5, 3"
                          />
                          <span className="text-xs font-bold text-slate-400 shrink-0">E4F / Hour</span>
                        </div>
                      </div>
                    </div>

                    {/* Primary Ad Network Selector */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                          <span>1. Primary Ad Network (Shown First)</span>
                        </label>
                        <span className="text-[10px] text-slate-400">Current: <span className="font-bold text-white font-mono">{miningPrimaryNetwork}</span></span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['RichAds', 'Monetag', 'OnClickA'] as const).map(net => (
                          <button
                            key={net}
                            onClick={() => {
                              setMiningPrimaryNetwork(net);
                              if (miningSecondaryNetwork === net) {
                                const others = (['RichAds', 'Monetag', 'OnClickA'] as const).filter(n => n !== net);
                                setMiningSecondaryNetwork(others[0]);
                              }
                            }}
                            className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all text-center ${
                              miningPrimaryNetwork === net
                                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20 font-black scale-[1.02]'
                                : 'bg-slate-950/80 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            {net}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Secondary Ad Network Selector (Fallback 1) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold text-sky-300 uppercase tracking-wide flex items-center gap-1.5">
                          <span>2. Secondary Ad Network (Fallback)</span>
                        </label>
                        <span className="text-[10px] text-slate-400">Fallback: <span className="font-bold text-white font-mono">{miningSecondaryNetwork}</span></span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['RichAds', 'Monetag', 'OnClickA'] as const).map(net => (
                          <button
                            key={net}
                            onClick={() => {
                              setMiningSecondaryNetwork(net);
                              if (miningPrimaryNetwork === net) {
                                const others = (['RichAds', 'Monetag', 'OnClickA'] as const).filter(n => n !== net);
                                setMiningPrimaryNetwork(others[0]);
                              }
                            }}
                            className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all text-center ${
                              miningSecondaryNetwork === net
                                ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-slate-950 shadow-md shadow-sky-500/20 font-black scale-[1.02]'
                                : 'bg-slate-950/80 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            {net}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Waterfall Fallback Mode Toggle */}
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>🌊 Waterfall Auto-Fallback Mode</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                            miningWaterfallEnabled ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {miningWaterfallEnabled ? 'ENABLED' : 'DISABLED'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 max-w-sm">
                          If Primary ad fails to show, automatically fallback to Secondary ad (and remaining networks in the 5-network waterfall chain: RichAds → Monetag → OnClickA → RichAds → Monetag).
                        </p>
                      </div>
                      <button
                        onClick={() => setMiningWaterfallEnabled(!miningWaterfallEnabled)}
                        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                          miningWaterfallEnabled ? 'bg-sky-500' : 'bg-slate-700'
                        }`}
                        title="Toggle Waterfall Fallback"
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-slate-950 transition-transform absolute top-1 ${
                            miningWaterfallEnabled ? 'right-1' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Mining 5 Ad Network IDs / Direct URLs */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="text-xs font-bold text-amber-400 uppercase tracking-wide flex items-center justify-between">
                        <span>🔧 Mining Ad Network IDs / Direct Links (5 Networks)</span>
                        <span className="text-[9px] text-slate-500 lowercase">no app update needed</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                            1. RichAds Zone ID / Link (mining_01_richads)
                          </label>
                          <input
                            type="text"
                            value={mining01Richads}
                            onChange={e => setMining01Richads(e.target.value)}
                            placeholder="e.g. 410204"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                            2. Monetag Zone ID / Direct Link (mining_02_monetag)
                          </label>
                          <input
                            type="text"
                            value={mining02Monetag}
                            onChange={e => setMining02Monetag(e.target.value)}
                            placeholder="e.g. 12044377"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                            3. OnClickA Zone ID / Link (mining_03_onclicka)
                          </label>
                          <input
                            type="text"
                            value={mining03Onclicka}
                            onChange={e => setMining03Onclicka(e.target.value)}
                            placeholder="e.g. 6153774E4F"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                            4. RichAds Zone ID / Link (mining_04_richads)
                          </label>
                          <input
                            type="text"
                            value={mining04Richads}
                            onChange={e => setMining04Richads(e.target.value)}
                            placeholder="e.g. 410204"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                            5. Monetag Zone ID / Direct Link (mining_05_monetag)
                          </label>
                          <input
                            type="text"
                            value={mining05Monetag}
                            onChange={e => setMining05Monetag(e.target.value)}
                            placeholder="e.g. 12044377"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Mining Button Ad Watch Duration (Seconds) */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            <span>⏱️ Mining Button Ad Watch Duration (Seconds)</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Set how many seconds users must watch the ad when clicking the Mining button. Live instant update.
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono font-black text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                            {adDuration}s Watch Time
                          </span>
                        </div>
                      </div>

                      {/* Quick Presets */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <span className="text-[9px] text-slate-500 font-semibold uppercase mr-1">Presets:</span>
                        {[5, 10, 15, 20, 30, 45, 60, 90].map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setAdDuration(s)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                              Number(adDuration) === s
                                ? 'bg-amber-500 text-slate-950 font-black scale-105 shadow-sm'
                                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {s}s
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold uppercase block mb-1">
                            Custom Mining Ad Duration (Seconds)
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="5"
                              max="600"
                              value={adDuration}
                              onChange={e => setAdDuration(Math.max(5, parseInt(e.target.value) || 5))}
                              className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-amber-300 font-mono font-bold focus:border-amber-400 focus:outline-none"
                              placeholder="e.g. 60"
                            />
                            <span className="text-xs font-bold text-slate-400 shrink-0">Seconds</span>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold uppercase block mb-1">
                            Monetag Direct Link URL
                          </label>
                          <input
                            type="text"
                            value={monetagLink}
                            onChange={e => setMonetagLink(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white font-mono focus:border-amber-400 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveAdSettings}
                      disabled={loading}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
                    >
                      <Layers className="w-4 h-4" />
                      <span>Save Mining Rate, Ad Network & Waterfall Settings (Instant Live)</span>
                    </button>
                  </div>

                  {/* 🎯 WATERFALL AD CONFIGURATION CARD (10 VARIABLES) */}
                  <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-amber-500/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-extrabold text-white text-sm flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                          <span>Direct In-App Ad Settings (Spin & Gift Box 1–5)</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Configure dedicated in-app Ad Zone IDs for Spin and each individual Gift Box. 100% Inside Telegram with no waterfall cascade.
                        </div>
                      </div>
                    </div>

                    {/* SPIN DIRECT ADS SECTION */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wide">
                        <span>🎡 Spin Wheel Dedicated Ad IDs</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                            1. RichAds ID (spin_01_richads)
                          </label>
                          <input
                            type="text"
                            value={spin01Richads}
                            onChange={e => setSpin01Richads(e.target.value)}
                            placeholder="e.g. 410203"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                            2. Monetag ID (spin_02_monetag)
                          </label>
                          <input
                            type="text"
                            value={spin02Monetag}
                            onChange={e => setSpin02Monetag(e.target.value)}
                            placeholder="e.g. 12044377"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                            3. OnClickA ID (spin_03_onclicka)
                          </label>
                          <input
                            type="text"
                            value={spin03Onclicka}
                            onChange={e => setSpin03Onclicka(e.target.value)}
                            placeholder="e.g. 6153717E4F"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                            4. RichAds ID (spin_04_richads)
                          </label>
                          <input
                            type="text"
                            value={spin04Richads}
                            onChange={e => setSpin04Richads(e.target.value)}
                            placeholder="e.g. 410203"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                            5. Monetag ID (spin_05_monetag)
                          </label>
                          <input
                            type="text"
                            value={spin05Monetag}
                            onChange={e => setSpin05Monetag(e.target.value)}
                            placeholder="e.g. 12044377"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                          />
                        </div>

                        {/* Spin Ad Duration Controller */}
                        <div className="md:col-span-2 pt-2 border-t border-slate-800/80">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] text-amber-300 font-bold uppercase flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>🎡 Spin Wheel Ad Watch Duration (Seconds)</span>
                            </label>
                            <span className="text-[10px] font-mono font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                              {spinAdDuration}s Watch Time
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                            <span className="text-[9px] text-slate-500 uppercase font-semibold">Presets:</span>
                            {[5, 10, 15, 20, 30, 45, 60].map(s => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setSpinAdDuration(s)}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                                  Number(spinAdDuration) === s
                                    ? 'bg-amber-500 text-slate-950 font-black'
                                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                                }`}
                              >
                                {s}s
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="5"
                              max="300"
                              value={spinAdDuration}
                              onChange={e => setSpinAdDuration(Math.max(5, parseInt(e.target.value) || 5))}
                              className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-amber-300 font-mono font-bold focus:border-amber-400 focus:outline-none"
                              placeholder="e.g. 30"
                            />
                            <span className="text-xs font-bold text-slate-400 shrink-0">Seconds</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* GIFT BOX DEDICATED ADS SECTION */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="text-xs font-bold text-sky-400 flex items-center gap-1.5 uppercase tracking-wide">
                        <span>🎁 Gift Box 1–5 Dedicated Ad IDs (Each Box Shows Its Own Ad)</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                            Box #1 RichAds ID (box_01_richads)
                          </label>
                          <input
                            type="text"
                            value={box01Richads}
                            onChange={e => setBox01Richads(e.target.value)}
                            placeholder="e.g. 410202"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                            Box #2 Monetag ID (box_02_monetag)
                          </label>
                          <input
                            type="text"
                            value={box02Monetag}
                            onChange={e => setBox02Monetag(e.target.value)}
                            placeholder="e.g. 12044377"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                            Box #3 OnClickA ID (box_03_onclicka)
                          </label>
                          <input
                            type="text"
                            value={box03Onclicka}
                            onChange={e => setBox03Onclicka(e.target.value)}
                            placeholder="e.g. 6153772E4F"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                            Box #4 RichAds ID (box_04_richads)
                          </label>
                          <input
                            type="text"
                            value={box04Richads}
                            onChange={e => setBox04Richads(e.target.value)}
                            placeholder="e.g. 410202"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                            Box #5 Monetag ID (box_05_monetag)
                          </label>
                          <input
                            type="text"
                            value={box05Monetag}
                            onChange={e => setBox05Monetag(e.target.value)}
                            placeholder="e.g. 12044377"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                          />
                        </div>

                        {/* Gift Box Ad Duration Controller */}
                        <div className="md:col-span-2 pt-2 border-t border-slate-800/80">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] text-sky-300 font-bold uppercase flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-sky-400" />
                              <span>🎁 Gift Box Ad Watch Duration (Seconds)</span>
                            </label>
                            <span className="text-[10px] font-mono font-bold text-sky-400 px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30">
                              {giftBoxAdDuration}s Watch Time
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                            <span className="text-[9px] text-slate-500 uppercase font-semibold">Presets:</span>
                            {[5, 10, 15, 20, 30, 45, 60].map(s => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setGiftBoxAdDuration(s)}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                                  Number(giftBoxAdDuration) === s
                                    ? 'bg-sky-500 text-slate-950 font-black'
                                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                                }`}
                              >
                                {s}s
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="5"
                              max="300"
                              value={giftBoxAdDuration}
                              onChange={e => setGiftBoxAdDuration(Math.max(5, parseInt(e.target.value) || 5))}
                              className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-sky-300 font-mono font-bold focus:border-sky-400 focus:outline-none"
                              placeholder="e.g. 30"
                            />
                            <span className="text-xs font-bold text-slate-400 shrink-0">Seconds</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveAdSettings}
                      disabled={loading}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {loading ? 'Saving...' : 'Save Ad IDs & Durations (Instant Live Update)'}
                    </button>
                  </div>
                </div>
              )}

              {/* REWARDS & MYSTERY BOXES TAB */}
              {activeTab === 'REWARDS' && (
                <div className="space-y-4 p-1">
                  {/* Monetag SDK & Zone Settings */}
                  <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          <span>Monetag Telegram Rewarded SDK</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Official Telegram Mini App Rewarded Interstitial SDK (App ID 3534792, Zone 12044377)
                        </div>
                      </div>
                      <button
                        onClick={() => setMonetagTelegramSdkEnabled(!monetagTelegramSdkEnabled)}
                        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                          monetagTelegramSdkEnabled ? 'bg-amber-500' : 'bg-slate-700'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-slate-950 transition-transform absolute top-1 ${
                            monetagTelegramSdkEnabled ? 'right-1' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold uppercase block mb-1">
                        Monetag Zone ID
                      </label>
                      <input
                        type="text"
                        value={monetagZoneId}
                        onChange={e => setMonetagZoneId(e.target.value)}
                        placeholder="12044377"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  {/* 5 Daily Lucky Spins Configuration */}
                  <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <div>
                        <div className="font-bold text-white">Spin & Win Lucky Wheel Configuration</div>
                        <div className="text-[10px] text-slate-400">Configure 5 daily spins and 8 prize amounts</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-semibold">Ad Gate</span>
                        <button
                          onClick={() => setRewardSpinAdRequired(!rewardSpinAdRequired)}
                          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                            rewardSpinAdRequired ? 'bg-amber-500' : 'bg-slate-700'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-slate-950 transition-transform absolute top-1 ${
                              rewardSpinAdRequired ? 'right-1' : 'left-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 font-semibold uppercase block mb-1">
                          Daily Spin Limit per User
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={rewardSpinMaxDaily}
                          onChange={e => setRewardSpinMaxDaily(Math.max(1, parseInt(e.target.value) || 5))}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] text-amber-300 font-semibold uppercase block">
                            Spin Ad Watch Duration (Seconds)
                          </label>
                          <span className="text-[10px] font-mono text-amber-400 font-bold">{spinAdDuration}s</span>
                        </div>
                        <input
                          type="number"
                          min="5"
                          max="300"
                          value={spinAdDuration}
                          onChange={e => setSpinAdDuration(Math.max(5, parseInt(e.target.value) || 5))}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-amber-300 font-mono font-bold focus:border-amber-400 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold uppercase block mb-2">
                        Wheel Prize Segments (8 Slices)
                      </label>
                      <div className="space-y-2">
                        {spinPrizes.map((p, idx) => (
                          <div key={p.id ?? idx} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2 text-xs">
                            <span className="w-5 text-center font-bold text-amber-400 text-[10px]">#{idx + 1}</span>
                            <div className="flex-1">
                              <input
                                type="text"
                                value={p.label}
                                onChange={e => {
                                  const updated = [...spinPrizes];
                                  updated[idx] = { ...updated[idx], label: e.target.value };
                                  setSpinPrizes(updated);
                                }}
                                placeholder="Label (e.g. 0.25 E4F)"
                                className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                              />
                            </div>
                            <div className="w-20">
                              <select
                                value={p.asset}
                                onChange={e => {
                                  const updated = [...spinPrizes];
                                  const asset = e.target.value as 'E4F' | 'USDT';
                                  updated[idx] = {
                                    ...updated[idx],
                                    asset,
                                    label: `${updated[idx].amount} ${asset}`,
                                  };
                                  setSpinPrizes(updated);
                                }}
                                className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white cursor-pointer"
                              >
                                <option value="E4F">E4F</option>
                                <option value="USDT">USDT</option>
                              </select>
                            </div>
                            <div className="w-20">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={p.amount}
                                onChange={e => {
                                  const updated = [...spinPrizes];
                                  const amount = parseFloat(e.target.value) || 0;
                                  updated[idx] = {
                                    ...updated[idx],
                                    amount,
                                    label: `${amount} ${updated[idx].asset}`,
                                  };
                                  setSpinPrizes(updated);
                                }}
                                className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 5 Mystery Gift Boxes Configuration */}
                  <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <div>
                        <div className="font-bold text-white">5 Mystery Gift Boxes Configuration</div>
                        <div className="text-[10px] text-slate-400">Configure reward amounts and assets per mystery box</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-semibold">Ad Gate</span>
                        <button
                          onClick={() => setGiftBoxAdRequired(!giftBoxAdRequired)}
                          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                            giftBoxAdRequired ? 'bg-amber-500' : 'bg-slate-700'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-slate-950 transition-transform absolute top-1 ${
                              giftBoxAdRequired ? 'right-1' : 'left-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 font-semibold uppercase block mb-1">
                          Daily Gift Box Limit per User
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={giftBoxMaxDaily}
                          onChange={e => setGiftBoxMaxDaily(Math.max(1, parseInt(e.target.value) || 5))}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] text-sky-300 font-semibold uppercase block">
                            Gift Box Ad Watch Duration (Seconds)
                          </label>
                          <span className="text-[10px] font-mono text-sky-400 font-bold">{giftBoxAdDuration}s</span>
                        </div>
                        <input
                          type="number"
                          min="5"
                          max="300"
                          value={giftBoxAdDuration}
                          onChange={e => setGiftBoxAdDuration(Math.max(5, parseInt(e.target.value) || 5))}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-sky-300 font-mono font-bold focus:border-sky-400 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold uppercase block mb-2">
                        Mystery Boxes (1 to 5)
                      </label>
                      <div className="space-y-2">
                        {giftBoxesList.map((box, idx) => (
                          <div key={box.id ?? idx} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2 text-xs">
                            <span className="w-10 text-center font-bold text-sky-400 text-[10px]">Box {box.boxNumber || idx + 1}</span>
                            <div className="flex-1">
                              <input
                                type="text"
                                value={box.name}
                                onChange={e => {
                                  const updated = [...giftBoxesList];
                                  updated[idx] = { ...updated[idx], name: e.target.value };
                                  setGiftBoxesList(updated);
                                }}
                                placeholder="Box Name"
                                className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                              />
                            </div>
                            <div className="w-20">
                              <select
                                value={box.rewardAsset}
                                onChange={e => {
                                  const updated = [...giftBoxesList];
                                  updated[idx] = { ...updated[idx], rewardAsset: e.target.value as 'E4F' | 'USDT' };
                                  setGiftBoxesList(updated);
                                }}
                                className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white cursor-pointer"
                              >
                                <option value="E4F">E4F</option>
                                <option value="USDT">USDT</option>
                              </select>
                            </div>
                            <div className="w-20">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={box.rewardAmount}
                                onChange={e => {
                                  const updated = [...giftBoxesList];
                                  updated[idx] = { ...updated[idx], rewardAmount: parseFloat(e.target.value) || 0 };
                                  setGiftBoxesList(updated);
                                }}
                                className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={handleSaveRewardSettings}
                      disabled={loading}
                      className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer"
                    >
                      Save Mystery Boxes Configuration
                    </button>
                  </div>

                  {/* Daily Check-In Streak Configuration (Day 1 to 7) */}
                  <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-amber-400" />
                          <span>Daily Check-In Rewards Configuration (Day 1–7)</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Set streak rewards per day (E4F / USDT, min 0.001 to 5.0)
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold font-mono">
                        Active
                      </span>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold uppercase block mb-2">
                        7-Day Consecutive Rewards (Custom E4F / USDT per Day)
                      </label>
                      <div className="space-y-2">
                        {dailyCheckInList.map((item, idx) => (
                          <div key={item.day ?? idx + 1} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2 text-xs">
                            <span className="w-16 text-center font-bold text-amber-400 text-[11px] font-mono">
                              Day {item.day || idx + 1}
                            </span>
                            <div className="w-24">
                              <select
                                value={item.asset}
                                onChange={e => {
                                  const updated = [...dailyCheckInList];
                                  updated[idx] = { ...updated[idx], asset: e.target.value as 'E4F' | 'USDT' };
                                  setDailyCheckInList(updated);
                                }}
                                className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white cursor-pointer font-semibold"
                              >
                                <option value="USDT">USDT</option>
                                <option value="E4F">E4F</option>
                              </select>
                            </div>
                            <div className="flex-1">
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.001"
                                  min="0.0001"
                                  value={item.amount === 0 ? '' : item.amount}
                                  onChange={e => {
                                    const updated = [...dailyCheckInList];
                                    const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                    updated[idx] = {
                                      ...updated[idx],
                                      amount: isNaN(val) ? 0 : val,
                                    };
                                    setDailyCheckInList(updated);
                                  }}
                                  onBlur={() => {
                                    const updated = [...dailyCheckInList];
                                    const val = parseFloat(String(item.amount));
                                    updated[idx] = {
                                      ...updated[idx],
                                      amount: isNaN(val) || val <= 0 ? 0.01 : Math.round(val * 10000) / 10000,
                                    };
                                    setDailyCheckInList(updated);
                                  }}
                                  className="w-full px-2 py-1 pr-12 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                                  placeholder="Reward amount (e.g. 0.01 or 3)"
                                />
                                <span className="absolute right-2 top-1 text-[10px] text-slate-400 font-mono pointer-events-none">
                                  {item.asset}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={handleSaveRewardSettings}
                      disabled={loading}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>Save Daily Check-In & Rewards Settings</span>
                    </button>

                    {/* Admin Test Controls for 7-Day Daily Check-in */}
                    <div className="pt-2 border-t border-slate-800/80">
                      <div className="text-[10px] text-slate-400 font-bold uppercase mb-1.5 flex items-center justify-between">
                        <span>Check-In Test Controls (Current User)</span>
                        <span className="text-[9px] text-amber-400 font-mono">UID: {user?.uid || user?.id}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!user) return;
                            try {
                              const res = await api.advanceUserDailyCheckIn(user.id, adminKey);
                              addToast('Date Advanced', res.message || 'Ready for next day claim!', 'success');
                            } catch (e: any) {
                              addToast('Error', e.message, 'error');
                            }
                          }}
                          className="px-2 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 hover:bg-sky-500/25 text-sky-300 text-[10px] font-bold cursor-pointer transition-colors text-center"
                        >
                          Advance 1 Day (Test Claim)
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!user) return;
                            try {
                              const res = await api.resetUserDailyCheckIn(user.id, adminKey);
                              addToast('Check-In Reset', res.message || 'Reset to Day 0', 'success');
                            } catch (e: any) {
                              addToast('Error', e.message, 'error');
                            }
                          }}
                          className="px-2 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 hover:bg-rose-500/25 text-rose-300 text-[10px] font-bold cursor-pointer transition-colors text-center"
                        >
                          Reset to Day 0
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. DEPOSIT SETTINGS */}
              {activeTab === 'DEPOSITS' && (
                <div className="space-y-3 p-1">
                  <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <Wallet className="w-4 h-4 text-emerald-400" />
                          <span>Deposit Rules & Gateway Configuration</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Configure minimum deposit and bonus live without app update
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold ${depositsEnabled ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {depositsEnabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                        <button
                          onClick={() => setDepositsEnabled(!depositsEnabled)}
                          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                            depositsEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-slate-950 transition-transform absolute top-1 ${
                              depositsEnabled ? 'right-1' : 'left-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Minimum Deposit Amount (USDT) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] text-slate-400 font-semibold uppercase block">
                          Minimum Deposit Amount (USDT)
                        </label>
                        <span className="text-[10px] text-emerald-400 font-mono font-bold">
                          Active: {depositMinUSDT} USDT
                        </span>
                      </div>

                      {/* Quick Presets */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-slate-500 font-semibold">Quick Set:</span>
                        {['2', '3', '4', '5', '10', '20'].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => {
                              setDepositMinInput(val);
                              setDepositMinUSDT(parseFloat(val) || 2.0);
                            }}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer ${
                              depositMinInput === val
                                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                            }`}
                          >
                            {val} USDT
                          </button>
                        ))}
                      </div>

                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          min="2"
                          value={depositMinInput}
                          onChange={e => {
                            setDepositMinInput(e.target.value);
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val >= 2.0) {
                              setDepositMinUSDT(Math.round(val * 100) / 100);
                            }
                          }}
                          onBlur={() => {
                            const val = parseFloat(depositMinInput);
                            if (!isNaN(val) && val >= 2.0) {
                              setDepositMinUSDT(Math.round(val * 100) / 100);
                            } else {
                              setDepositMinInput('2');
                              setDepositMinUSDT(2.0);
                            }
                          }}
                          className="w-full px-3 py-2 pr-16 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                          placeholder="e.g. 2, 3, 4, 5, etc."
                        />
                        <span className="absolute right-3 top-2 text-xs font-bold text-slate-500 font-mono pointer-events-none">
                          USDT
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Default starts from 2 USDT. Set 2, 3, 4, or any custom value without app update.
                      </div>
                    </div>

                    {/* First Qualifying Deposit Bonus (USDT) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] text-slate-400 font-semibold uppercase block">
                          First Qualifying Deposit Bonus (USDT)
                        </label>
                        <span className="text-[10px] text-amber-400 font-mono font-bold">
                          Active: {depositFirstBonusUSDT} USDT
                        </span>
                      </div>

                      {/* Quick Presets */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-slate-500 font-semibold">Quick Set:</span>
                        {['0', '1', '2', '3', '4', '5', '10', '15', '20'].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => {
                              setDepositBonusInput(val);
                              setDepositFirstBonusUSDT(parseFloat(val) || 0);
                            }}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer ${
                              depositBonusInput === val
                                ? 'bg-amber-500 text-slate-950 shadow-sm'
                                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                            }`}
                          >
                            {val} USDT
                          </button>
                        ))}
                      </div>

                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={depositBonusInput}
                          onChange={e => {
                            setDepositBonusInput(e.target.value);
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val >= 0) {
                              setDepositFirstBonusUSDT(Math.round(val * 100) / 100);
                            }
                          }}
                          onBlur={() => {
                            const val = parseFloat(depositBonusInput);
                            if (!isNaN(val) && val >= 0) {
                              setDepositFirstBonusUSDT(Math.round(val * 100) / 100);
                            } else {
                              setDepositBonusInput('0');
                              setDepositFirstBonusUSDT(0);
                            }
                          }}
                          className="w-full px-3 py-2 pr-16 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                          placeholder="e.g. 0, 1, 2, 3, 4, 5, etc."
                        />
                        <span className="absolute right-3 top-2 text-xs font-bold text-slate-500 font-mono pointer-events-none">
                          USDT
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 block">
                        Awarded on user's first qualifying deposit & returned upon account verification. Set custom 2, 3, 4 or whatever desired.
                      </span>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold uppercase block mb-1">
                        Official BSC Deposit Address
                      </label>
                      <input
                        type="text"
                        value={bscDepositAddress}
                        onChange={e => setBscDepositAddress(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                      />
                    </div>

                    <button
                      onClick={handleSaveDepositSettings}
                      disabled={loading}
                      className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>Save Deposit Settings</span>
                    </button>
                  </div>

                  {/* Deposits Verification Queue */}
                  <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="font-bold text-white text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>External Deposit Submissions Queue ({depositsList.length})</span>
                      </div>
                      <button
                        onClick={() => loadAdminData()}
                        className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        title="Refresh"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>

                    {depositsList.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-500">
                        No external deposits submitted yet.
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-80 overflow-y-auto no-scrollbar">
                        {depositsList.map((dep: any) => {
                          const isPending = (dep.status || '').toUpperCase() === 'PENDING';
                          const isVerified = (dep.status || '').toUpperCase() === 'VERIFIED';
                          return (
                            <div
                              key={dep.id}
                              className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs"
                            >
                              <div className="flex items-center justify-between">
                                <div className="font-bold text-white flex items-center gap-1.5">
                                  <span className="font-mono text-emerald-400">+{dep.amount} {dep.asset || 'USDT'}</span>
                                  <span className="text-[10px] text-slate-400 uppercase font-mono">({dep.network})</span>
                                </div>
                                <span
                                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                    isPending
                                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                      : isVerified
                                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                      : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                  }`}
                                >
                                  {dep.status}
                                </span>
                              </div>

                              <div className="text-[11px] text-slate-400 font-mono break-all bg-slate-900/60 p-1.5 rounded-lg border border-slate-800/80">
                                <span className="text-slate-500 select-none">TXID: </span>{dep.txid}
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-slate-400">
                                <span>User: {dep.user_id}</span>
                                <span>{dep.created_at ? new Date(dep.created_at).toLocaleString() : 'Recent'}</span>
                              </div>

                              {isPending && (
                                <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                                  <button
                                    onClick={() => handleReviewDeposit(dep.id, 'APPROVE')}
                                    disabled={processingDepositId === dep.id}
                                    className="flex-1 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Verify & Credit Balance</span>
                                  </button>
                                  <button
                                    onClick={() => handleReviewDeposit(dep.id, 'REJECT')}
                                    disabled={processingDepositId === dep.id}
                                    className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold text-[11px] transition-colors cursor-pointer"
                                  >
                                    <span>Reject</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* WITHDRAWALS VERIFICATION & MANAGEMENT TAB */}
              {activeTab === 'WITHDRAWALS' && (
                <div className="space-y-4 p-1">
                  {/* Master Switch & Limit Card */}
                  <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                    {/* Master Switch */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <ArrowUpRight className="w-4 h-4 text-sky-400" />
                          <span>Withdrawal Switch & Security Limits</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {withdrawalsEnabled
                            ? 'Withdrawals are currently ACTIVE for users'
                            : 'Disabled: Users see "Open soon"'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold ${withdrawalsEnabled ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {withdrawalsEnabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                        <button
                          onClick={() => setWithdrawalsEnabled(!withdrawalsEnabled)}
                          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                            withdrawalsEnabled ? 'bg-sky-500' : 'bg-slate-700'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-slate-950 transition-transform absolute top-1 ${
                              withdrawalsEnabled ? 'right-1' : 'left-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Network Selection Bar */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] text-slate-400 font-semibold uppercase block">
                          Select Network to Configure (TRC20 / BEP20 / TON)
                        </label>
                        <span className="text-[10px] text-amber-400 font-mono">Real-time update without app release</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {(['TRC20', 'BEP20', 'TON'] as const).map(net => {
                          const isSel = selectedAdminNetwork === net;
                          const netCfg = networkWithdrawSettings[net] || { minAmount: 1, maxAmount: 1000, fee: 1, enabled: true };
                          return (
                            <button
                              key={net}
                              type="button"
                              onClick={() => setSelectedAdminNetwork(net)}
                              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                isSel
                                  ? 'bg-sky-500/15 border-sky-500 text-white shadow-md shadow-sky-500/10'
                                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-xs">{net}</span>
                                <span className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${netCfg.enabled !== false ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                  {netCfg.enabled !== false ? 'ACTIVE' : 'OFF'}
                                </span>
                              </div>
                              <div className="text-[9px] text-slate-400">
                                Fee: <strong className="text-white">{netCfg.fee} USDT</strong>
                              </div>
                              <div className="text-[9px] text-slate-400">
                                {netCfg.minAmount} – {netCfg.maxAmount} USDT
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Selected Network Detailed Parameters */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                        <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                          <span>{selectedAdminNetwork} Network Parameters</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">Status:</span>
                          <button
                            type="button"
                            onClick={() => {
                              const curState = networkWithdrawSettings[selectedAdminNetwork]?.enabled !== false;
                              setNetworkWithdrawSettings(prev => ({
                                ...prev,
                                [selectedAdminNetwork]: {
                                  ...prev[selectedAdminNetwork],
                                  enabled: !curState,
                                },
                              }));
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                              networkWithdrawSettings[selectedAdminNetwork]?.enabled !== false
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                            }`}
                          >
                            {networkWithdrawSettings[selectedAdminNetwork]?.enabled !== false ? 'ENABLED' : 'DISABLED'}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {/* Minimum Withdrawal Limit */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] text-slate-400 font-semibold uppercase block">
                              Min Withdrawal (USDT)
                            </label>
                            <span className="text-[9px] text-slate-500 font-mono">0.1 – 5000</span>
                          </div>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="5000"
                            value={netInputs[selectedAdminNetwork]?.minAmount ?? '1.0'}
                            onChange={e => {
                              const v = e.target.value;
                              setNetInputs(prev => ({
                                ...prev,
                                [selectedAdminNetwork]: { ...prev[selectedAdminNetwork], minAmount: v },
                              }));
                            }}
                            onBlur={() => {
                              const val = Math.max(0.1, Math.min(5000, parseFloat(netInputs[selectedAdminNetwork]?.minAmount) || 0.1));
                              setNetInputs(prev => ({
                                ...prev,
                                [selectedAdminNetwork]: { ...prev[selectedAdminNetwork], minAmount: String(val) },
                              }));
                              setNetworkWithdrawSettings(prev => ({
                                ...prev,
                                [selectedAdminNetwork]: { ...prev[selectedAdminNetwork], minAmount: val },
                              }));
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono focus:border-sky-500 outline-none"
                            placeholder="0.1"
                          />
                          <span className="text-[9px] text-slate-500 block mt-0.5">Min amount (from 0.1)</span>
                        </div>

                        {/* Maximum Withdrawal Limit */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] text-slate-400 font-semibold uppercase block">
                              Max Withdrawal (USDT)
                            </label>
                            <span className="text-[9px] text-slate-500 font-mono">0.1 – 5000</span>
                          </div>
                          <input
                            type="number"
                            step="1"
                            min="0.1"
                            max="5000"
                            value={netInputs[selectedAdminNetwork]?.maxAmount ?? '1000'}
                            onChange={e => {
                              const v = e.target.value;
                              setNetInputs(prev => ({
                                ...prev,
                                [selectedAdminNetwork]: { ...prev[selectedAdminNetwork], maxAmount: v },
                              }));
                            }}
                            onBlur={() => {
                              const val = Math.max(0.1, Math.min(5000, parseFloat(netInputs[selectedAdminNetwork]?.maxAmount) || 1000));
                              setNetInputs(prev => ({
                                ...prev,
                                [selectedAdminNetwork]: { ...prev[selectedAdminNetwork], maxAmount: String(val) },
                              }));
                              setNetworkWithdrawSettings(prev => ({
                                ...prev,
                                [selectedAdminNetwork]: { ...prev[selectedAdminNetwork], maxAmount: val },
                              }));
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono focus:border-sky-500 outline-none"
                            placeholder="1000"
                          />
                          <span className="text-[9px] text-slate-500 block mt-0.5">Max cap (up to 5000)</span>
                        </div>

                        {/* Withdrawal Fee */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] text-slate-400 font-semibold uppercase block">
                              Withdraw Fee (USDT)
                            </label>
                            <span className="text-[9px] text-slate-500 font-mono">≥ 0</span>
                          </div>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="500"
                            value={netInputs[selectedAdminNetwork]?.fee ?? '1.0'}
                            onChange={e => {
                              const v = e.target.value;
                              setNetInputs(prev => ({
                                ...prev,
                                [selectedAdminNetwork]: { ...prev[selectedAdminNetwork], fee: v },
                              }));
                            }}
                            onBlur={() => {
                              const val = Math.max(0, Math.min(500, parseFloat(netInputs[selectedAdminNetwork]?.fee) || 0));
                              setNetInputs(prev => ({
                                ...prev,
                                [selectedAdminNetwork]: { ...prev[selectedAdminNetwork], fee: String(val) },
                              }));
                              setNetworkWithdrawSettings(prev => ({
                                ...prev,
                                [selectedAdminNetwork]: { ...prev[selectedAdminNetwork], fee: val },
                              }));
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono focus:border-sky-500 outline-none"
                            placeholder="1.0"
                          />
                          <span className="text-[9px] text-slate-500 block mt-0.5">Deducted network gas fee</span>
                        </div>
                      </div>

                      {/* Quick Apply to all networks */}
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={handleApplyToAllNetworks}
                          className="text-[10px] text-sky-400 hover:text-sky-300 font-medium underline cursor-pointer"
                        >
                          Apply these limits & fee to all networks (TRC20, BEP20, TON)
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveWithdrawalSettings}
                      disabled={loading}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                    >
                      {loading ? 'Saving Settings...' : 'Save Withdrawal Limits, Fees & Switch (Instant)'}
                    </button>
                  </div>

                  {/* Filter Pills & Stats Header */}
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-white text-xs flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-amber-400" />
                      <span>Pending & Historical Withdrawals</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {(['PENDING', 'ALL', 'COMPLETED', 'REJECTED'] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => setWithdrawalFilter(f)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                            withdrawalFilter === f
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          {f} {f === 'PENDING' && `(${withdrawalList.filter(w => w.status === 'PENDING').length})`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Withdrawal Request Cards */}
                  <div className="space-y-3">
                    {withdrawalList
                      .filter(tx => (withdrawalFilter === 'ALL' ? true : tx.status === withdrawalFilter))
                      .length === 0 ? (
                      <div className="p-8 text-center text-slate-500 rounded-2xl bg-slate-900/40 border border-slate-800 text-xs">
                        No {withdrawalFilter.toLowerCase()} withdrawal requests found.
                      </div>
                    ) : (
                      withdrawalList
                        .filter(tx => (withdrawalFilter === 'ALL' ? true : tx.status === withdrawalFilter))
                        .map(tx => (
                          <div
                            key={tx.id}
                            className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5 shadow-sm"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="font-bold text-white text-xs flex items-center gap-1.5">
                                  <span>{tx.userName || 'User'}</span>
                                  <span className="px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[9px] font-mono">
                                    UID: {tx.userUid || tx.userId}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {new Date(tx.timestamp).toLocaleString()}
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-sm font-black font-mono text-amber-400">
                                  {tx.amount} {tx.asset}
                                </div>
                                <span
                                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                    tx.status === 'PENDING'
                                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                                      : tx.status === 'COMPLETED'
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                  }`}
                                >
                                  {tx.status}
                                </span>
                              </div>
                            </div>

                            {/* Verification Data: Network, Destination Address, User Total Deposits */}
                            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] space-y-1.5 font-mono">
                              <div className="flex justify-between items-center text-slate-400">
                                <span>Network:</span>
                                <span className="text-sky-400 font-bold px-1.5 py-0.2 rounded bg-sky-500/10 border border-sky-500/20">
                                  {tx.network || 'TRC20'}
                                </span>
                              </div>

                              <div className="flex justify-between items-center text-slate-400">
                                <span>Destination Address:</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-white select-all break-all text-[10px]">
                                    {tx.address || 'N/A'}
                                  </span>
                                  {tx.address && (
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(tx.address);
                                        addToast('Copied', 'Address copied to clipboard', 'info');
                                      }}
                                      className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-sky-400 text-[9px] rounded font-sans cursor-pointer"
                                    >
                                      Copy
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="flex justify-between items-center text-slate-400 pt-1 border-t border-slate-800/80">
                                <span>User Spot USDT / Deposit Bal:</span>
                                <span className="text-slate-200">
                                  ${(tx.userSpotUsdt ?? 0).toFixed(2)} / ${(tx.userDepositBalance ?? 0).toFixed(2)}
                                </span>
                              </div>

                              <div className="flex justify-between items-center text-slate-400">
                                <span>Verified Total Deposits:</span>
                                <span className="text-emerald-400 font-bold">
                                  ${(tx.userTotalDeposited ?? tx.userDepositTotal ?? 0).toFixed(2)} USDT
                                </span>
                              </div>
                            </div>

                            {tx.note && (
                              <div className="text-[10px] text-slate-400 italic">
                                Note: {tx.note}
                              </div>
                            )}

                            {/* Action Buttons for Pending Request */}
                            {tx.status === 'PENDING' && (
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  onClick={() => handleReviewWithdrawal(tx.id, 'APPROVE')}
                                  disabled={processingWithdrawalId === tx.id}
                                  className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{processingWithdrawalId === tx.id ? 'Processing...' : 'Approve & Finalize'}</span>
                                </button>
                                <button
                                  onClick={() => handleReviewWithdrawal(tx.id, 'REJECT')}
                                  disabled={processingWithdrawalId === tx.id}
                                  className="flex-1 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 disabled:opacity-50 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Reject & Refund</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}

              {/* BONUSES & MINING BOOST TIERS TAB */}
              {activeTab === 'BONUSES' && (
                <div className="space-y-4 p-1">
                  {/* Welcome Bonus Configuration */}
                  <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                    <div className="border-b border-slate-800 pb-2">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <Gift className="w-4 h-4 text-amber-400" />
                        <span>New User Registration Welcome Bonus</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Credited once immediately upon signup to the user's spot balance without requiring app updates
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-400 font-semibold uppercase block">
                          Welcome Bonus USDT
                        </label>
                        <div className="flex items-center gap-1 flex-wrap">
                          {['1', '2', '3', '4', '5', '10', '25'].map(val => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setWelcomeBonusUSDT(parseFloat(val) || 0)}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all cursor-pointer ${
                                welcomeBonusUSDT === parseFloat(val)
                                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={welcomeBonusUSDT}
                          onChange={e => setWelcomeBonusUSDT(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                          placeholder="e.g. 1.00, 2, 3, 4"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-400 font-semibold uppercase block">
                          Welcome Bonus E4F
                        </label>
                        <div className="flex items-center gap-1 flex-wrap">
                          {['5', '10', '20', '50'].map(val => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setWelcomeBonusE4F(parseFloat(val) || 0)}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all cursor-pointer ${
                                welcomeBonusE4F === parseFloat(val)
                                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={welcomeBonusE4F}
                          onChange={e => setWelcomeBonusE4F(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                          placeholder="e.g. 5.00, 10"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Referral Bonus Configuration */}
                  <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                    <div className="border-b border-slate-800 pb-2">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-sky-400" />
                        <span>Referral Invitation Bonus</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Amount awarded to referrer when their invited friend signs up
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 font-semibold uppercase block">
                        Referrer Bonus Amount (USDT)
                      </label>
                      <div className="flex items-center gap-1 flex-wrap">
                        {['0.5', '1', '2', '3', '4', '5'].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setReferralBonusUSDT(parseFloat(val) || 0)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all cursor-pointer ${
                              referralBonusUSDT === parseFloat(val)
                                ? 'bg-amber-500 text-slate-950 shadow-sm'
                                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {val} USDT
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={referralBonusUSDT}
                        onChange={e => setReferralBonusUSDT(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                        placeholder="e.g. 0.50, 1, 2, 3"
                      />
                    </div>
                  </div>

                  {/* Hourly Mining Rate Configuration */}
                  <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-amber-500/30 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <Pickaxe className="w-4 h-4 text-amber-400" />
                          <span>Base Hourly Mining Rate (E4F / Hour)</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Set the base rate per hour for 8-hour mining sessions. Admin can customize to any value without app updates.
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-mono font-black text-amber-400">
                          {miningRatePerHour} E4F / hr
                        </div>
                        <div className="text-[9px] text-slate-400">
                          {(miningRatePerHour * 8).toFixed(2)} E4F / 8h Session
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 font-semibold uppercase block">
                        Quick Preset Rates (E4F / Hour)
                      </label>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {[0.10, 0.25, 0.50, 1.00, 2.00, 5.00].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setMiningRatePerHour(val)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                              Number(miningRatePerHour) === val
                                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {val.toFixed(2)} E4F
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          step="any"
                          min="0.001"
                          value={miningRatePerHour}
                          onChange={e => setMiningRatePerHour(parseFloat(e.target.value) || 0)}
                          className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono font-bold"
                          placeholder="e.g. 0.25, 0.50, 1.00, 2.50"
                        />
                        <span className="text-xs font-bold text-slate-400 shrink-0">E4F / Hour</span>
                      </div>
                    </div>
                  </div>

                  {/* Referral Mining Boost Tiers */}
                  <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <Zap className="w-4 h-4 text-amber-400" />
                          <span>Custom Mining Boost Tiers (% Boost by Referrals)</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          How many referrals unlock what % boost for the miner
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setReferralMiningBoostTiers([
                            ...referralMiningBoostTiers,
                            { minReferrals: (referralMiningBoostTiers[referralMiningBoostTiers.length - 1]?.minReferrals || 0) + 5, boostPercentage: 25 },
                          ]);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold cursor-pointer"
                      >
                        + Add Tier
                      </button>
                    </div>

                    <div className="space-y-2">
                      {referralMiningBoostTiers.map((tier, idx) => (
                        <div key={idx} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2 text-xs">
                          <span className="w-16 font-bold text-slate-400 text-[10px]">Tier {idx + 1}:</span>
                          <div className="flex-1 flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400">Min Referrals:</span>
                            <input
                              type="number"
                              min="1"
                              value={tier.minReferrals}
                              onChange={e => {
                                const updated = [...referralMiningBoostTiers];
                                updated[idx] = { ...updated[idx], minReferrals: parseInt(e.target.value) || 0 };
                                setReferralMiningBoostTiers(updated);
                              }}
                              className="w-16 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white text-center font-mono"
                            />
                          </div>
                          <div className="flex-1 flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400">Boost:</span>
                            <input
                              type="number"
                              min="0"
                              value={tier.boostPercentage}
                              onChange={e => {
                                const updated = [...referralMiningBoostTiers];
                                updated[idx] = { ...updated[idx], boostPercentage: parseFloat(e.target.value) || 0 };
                                setReferralMiningBoostTiers(updated);
                              }}
                              className="w-16 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-emerald-400 font-bold text-center font-mono"
                            />
                            <span className="text-[10px] font-bold text-emerald-400">%</span>
                          </div>
                          <button
                            onClick={() => {
                              const updated = referralMiningBoostTiers.filter((_, i) => i !== idx);
                              setReferralMiningBoostTiers(updated);
                            }}
                            className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                            title="Remove tier"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleSaveBonusAndBoostSettings}
                      disabled={loading}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer"
                    >
                      Save Welcome, Referral & Mining Boost Settings
                    </button>
                  </div>
                </div>
              )}

              {/* 4. NOTICE BOARD */}
              {activeTab === 'NOTICES' && (
                <div className="space-y-4 p-1">
                  {/* Create Notice */}
                  <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <Megaphone className="w-4 h-4 text-sky-400" />
                      <span>Post New Notice</span>
                    </div>

                    <input
                      type="text"
                      value={annTitle}
                      onChange={e => setAnnTitle(e.target.value)}
                      placeholder="Notice Headline"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                    />

                    <textarea
                      value={annDesc}
                      onChange={e => setAnnDesc(e.target.value)}
                      placeholder="Detailed notice body (rotates on home slider and ticker)"
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                    />

                    {/* Notice Board Image Upload & Sizing Guidance */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-sky-400 flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>Notice Board Side Image</span>
                        </label>
                        <span className="text-[10px] text-amber-400/90 font-medium">
                          Size: 600×300 px (Max 2MB)
                        </span>
                      </div>

                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Recommended size: <strong className="text-slate-200">600 × 300 px</strong> (or 16:9 / 1:1 ratio). This image appears on the right side of the Notice Board banner.
                      </p>

                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-300 text-xs font-semibold flex items-center gap-1.5 transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Choose Image File</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageFileChange}
                            className="hidden"
                          />
                        </label>

                        <input
                          type="text"
                          value={annImage}
                          onChange={e => setAnnImage(e.target.value)}
                          placeholder="Or paste Image URL / Data URI"
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 font-mono truncate focus:border-sky-500 focus:outline-none"
                        />
                      </div>

                      {annImage && (
                        <div className="flex items-center gap-2.5 pt-1">
                          <div className="w-14 h-14 rounded-lg overflow-hidden border border-sky-500/50 bg-slate-900 shrink-0">
                            <img
                              src={annImage}
                              alt="Preview"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] text-emerald-400 font-bold block">✓ Image ready to attach</span>
                            <span className="text-[9px] text-slate-400 truncate block">Will be shown beside the notice</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAnnImage('')}
                            className="p-1 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs flex items-center gap-1"
                            title="Remove image"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="text-[10px]">Remove</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={annCtaText}
                        onChange={e => setAnnCtaText(e.target.value)}
                        placeholder="Button Text"
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                      />
                      <input
                        type="text"
                        value={annCtaUrl}
                        onChange={e => setAnnCtaUrl(e.target.value)}
                        placeholder="CTA Link (#mining, etc.)"
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                      />
                    </div>

                    <button
                      onClick={handlePublishNotice}
                      disabled={loading}
                      className="w-full py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-all shadow cursor-pointer"
                    >
                      Publish Announcement
                    </button>
                  </div>

                  {/* Existing Notices */}
                  <div className="space-y-2">
                    <div className="font-bold text-slate-400 uppercase text-[10px]">Active Announcements</div>
                    {announcements.map(ann => (
                      <div
                        key={ann.id}
                        className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start justify-between gap-2.5"
                      >
                        <div className="flex-1">
                          <div className="font-bold text-white text-xs">{ann.title}</div>
                          <div className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{ann.description}</div>
                          {ann.ctaText && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-slate-800 text-[10px] text-sky-400">
                              {ann.ctaText} → {ann.ctaUrl}
                            </span>
                          )}
                        </div>

                        {ann.imageUrl && (
                          <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 shrink-0">
                            <img
                              src={ann.imageUrl}
                              alt={ann.title}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}

                        <button
                          onClick={() => handleDeleteNotice(ann.id)}
                          className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 shrink-0"
                          title="Delete notice"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. DYNAMIC TASKS */}
              {activeTab === 'TASKS' && (
                <div className="space-y-4 p-1">
                  {/* Create Task Form */}
                  <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-amber-400" />
                      <span>Add Dynamic Task</span>
                    </div>

                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={e => setNewTaskTitle(e.target.value)}
                      placeholder="Task Title (e.g., Read Official Whitepaper)"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    />

                    <input
                      type="text"
                      value={newTaskDesc}
                      onChange={e => setNewTaskDesc(e.target.value)}
                      placeholder="Instructions / requirements"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Platform</label>
                        <select
                          value={newTaskPlatform}
                          onChange={e => setNewTaskPlatform(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-amber-400 focus:outline-none"
                        >
                          <option value="WEBSITE">Website (Timer)</option>
                          <option value="TELEGRAM">Telegram</option>
                          <option value="TWITTER">X / Twitter</option>
                          <option value="YOUTUBE">YouTube</option>
                          <option value="FACEBOOK">Facebook</option>
                          <option value="INSTAGRAM">Instagram</option>
                          <option value="TIKTOK">TikTok</option>
                          <option value="DISCORD">Discord</option>
                          <option value="COMMUNITY">Community</option>
                          <option value="CUSTOM">Custom Platform...</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Verification</label>
                        <select
                          value={newTaskMethod}
                          onChange={e => setNewTaskMethod(e.target.value as any)}
                          className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-amber-400 focus:outline-none"
                        >
                          <option value="TIMER">Server Timer (30s+)</option>
                          <option value="MANUAL">Manual Proof Review</option>
                          <option value="AUTO">Auto-Verified</option>
                        </select>
                      </div>
                    </div>

                    {/* Custom Platform Name Input when CUSTOM is selected */}
                    {newTaskPlatform === 'CUSTOM' && (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
                        <label className="text-[10px] font-bold text-amber-300 block">
                          Custom Platform Name
                        </label>
                        <input
                          type="text"
                          value={customPlatformName}
                          onChange={e => setCustomPlatformName(e.target.value)}
                          placeholder="e.g. Medium, Reddit, CoinMarketCap, Google Play..."
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                        />
                      </div>
                    )}

                    <input
                      type="text"
                      value={newTaskUrl}
                      onChange={e => setNewTaskUrl(e.target.value)}
                      placeholder="Target Link (https://...)"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                    />

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Reward Asset</label>
                        <select
                          value={newTaskAsset}
                          onChange={e => setNewTaskAsset(e.target.value as any)}
                          className="w-full px-2 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                        >
                          <option value="USDT">USDT Spot</option>
                          <option value="E4F">E4F Pre-Listing</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Amount</label>
                        <input
                          type="number"
                          step="0.1"
                          value={newTaskReward}
                          onChange={e => setNewTaskReward(e.target.value)}
                          className="w-full px-2 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                        />
                      </div>

                      {newTaskMethod === 'TIMER' && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] text-amber-300 font-bold block">Timer (Seconds)</label>
                            <span className="text-[9px] font-mono text-amber-400 font-bold">{newTaskTimerSec}s</span>
                          </div>
                          <div className="flex items-center gap-1 mb-1">
                            {[15, 30, 60, 120, 300].map(s => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setNewTaskTimerSec(String(s))}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all cursor-pointer ${
                                  parseInt(newTaskTimerSec) === s
                                    ? 'bg-amber-500 text-slate-950 font-black'
                                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                                }`}
                              >
                                {s === 300 ? '5m' : `${s}s`}
                              </button>
                            ))}
                          </div>
                          <input
                            type="number"
                            min="5"
                            max="3600"
                            value={newTaskTimerSec}
                            onChange={e => setNewTaskTimerSec(e.target.value)}
                            className="w-full px-2 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-amber-300 font-mono font-bold focus:border-amber-400 focus:outline-none"
                            placeholder="e.g. 300"
                          />
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleCreateTask}
                      disabled={loading}
                      className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow cursor-pointer"
                    >
                      Publish Task
                    </button>
                  </div>

                  {/* Active Tasks List */}
                  <div className="space-y-2">
                    <div className="font-bold text-slate-400 uppercase text-[10px]">Active Tasks ({taskList.length})</div>
                    {taskList.map(task => (
                      <div
                        key={task.id}
                        className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start justify-between gap-2"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-white text-xs">{task.title}</span>
                            <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold text-[9px] uppercase tracking-wider">
                              {task.platform}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{task.description}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                              +{task.rewardAmount} {task.rewardAsset}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {task.verificationMethod} {task.durationSeconds ? `(${task.durationSeconds}s)` : ''}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 shrink-0"
                          title="Delete task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 6. PROOF SUBMISSIONS QUEUE */}
              {activeTab === 'SUBMISSIONS' && (
                <div className="space-y-3 p-1">
                  <div className="font-bold text-slate-400 uppercase text-[10px]">
                    User Proof Review Queue ({submissions.length})
                  </div>
                  {submissions.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-500">
                      No proofs pending review
                    </div>
                  ) : (
                    submissions.map(sub => (
                      <div
                        key={sub.id}
                        className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-white text-xs">{sub.taskTitle}</div>
                            <div className="text-[10px] text-slate-400">
                              User UID: <span className="font-mono text-sky-400">{sub.userUid || sub.userId}</span> • Reward:{' '}
                              <span className="font-bold text-amber-400">+{sub.rewardAmount} {sub.rewardAsset}</span>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              sub.status === 'APPROVED'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : sub.status === 'REJECTED'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {sub.status}
                          </span>
                        </div>

                        {/* Proof Details */}
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2.5 text-xs">
                          {/* Username / Profile Link / Post Link */}
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                              Username / Link Proof:
                            </span>
                            {sub.usernameOrLink || sub.proof ? (
                              <div className="font-mono text-cyan-400 text-xs break-all flex items-center gap-1.5 mt-0.5">
                                <span>{sub.usernameOrLink || sub.proof}</span>
                                {(sub.usernameOrLink || sub.proof).startsWith('http') && (
                                  <a
                                    href={sub.usernameOrLink || sub.proof}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-500 italic">None</span>
                            )}
                          </div>

                          {/* Screenshot Proof */}
                          {sub.screenshot && (
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                                Screenshot Proof:
                              </span>
                              <div className="flex items-center gap-3">
                                <img
                                  src={sub.screenshot}
                                  alt="Screenshot proof"
                                  onClick={() => setPreviewScreenshotUrl(sub.screenshot)}
                                  className="w-20 h-20 object-cover rounded-xl border border-slate-700 cursor-pointer hover:border-cyan-400 transition-all shadow"
                                />
                                <button
                                  type="button"
                                  onClick={() => setPreviewScreenshotUrl(sub.screenshot)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-bold border border-slate-700 cursor-pointer flex items-center gap-1"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View Screenshot</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Optional User Description */}
                          {sub.description && (
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                                User Description / Notes:
                              </span>
                              <div className="text-slate-300 text-xs italic bg-slate-900/60 p-2 rounded-lg border border-slate-800 mt-0.5">
                                "{sub.description}"
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        {sub.status === 'SUBMITTED' && (
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => handleReviewSubmission(sub.id, 'APPROVE')}
                              disabled={reviewingId === sub.id}
                              className="flex-1 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1 transition-all"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve & Credit</span>
                            </button>
                            <button
                              onClick={() => handleReviewSubmission(sub.id, 'REJECT')}
                              disabled={reviewingId === sub.id}
                              className="flex-1 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-xs flex items-center justify-center gap-1 transition-all"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 7. USERS */}
              {activeTab === 'USERS' && (
                <div className="space-y-3 p-1">
                  <div className="font-bold text-slate-400 uppercase text-[10px]">
                    Registered Users & UIDs ({userList.length})
                  </div>
                  {userList.map(u => (
                    <div
                      key={u.id}
                      className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-bold text-white text-xs flex items-center gap-2">
                          <span>{u.firstName === 'Telegram User' || !u.firstName ? 'E4F User' : u.firstName} {u.lastName || ''}</span>
                          <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-mono">
                            UID: {u.uid || u.id}
                          </span>
                          {u.isVerified ? (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold">
                              ✓ Verified
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[9px] font-bold">
                              Unverified
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                          Spot: ${(u.balances?.usdt ?? 0).toFixed(2)} | Deposit: ${(u.depositBalance ?? 0).toFixed(2)} USDT | {(u.balances?.e4f ?? 0).toFixed(2)} E4F | Refers: {u.referralsCount ?? 0}
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggleUserStatus(u.id, u.status)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-rose-500/20 hover:text-rose-400'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-emerald-500/20 hover:text-emerald-400'
                        }`}
                      >
                        {u.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal: Full Size Screenshot Proof Viewer */}
        {previewScreenshotUrl && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="relative max-w-lg w-full bg-[#0C1326] border border-cyan-500/40 rounded-3xl p-5 flex flex-col items-center shadow-2xl">
              <button
                onClick={() => setPreviewScreenshotUrl(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="text-xs font-bold text-cyan-400 mb-3 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4" />
                <span>Submitted Screenshot Proof</span>
              </div>
              <div className="w-full max-h-[75vh] overflow-auto rounded-2xl bg-black flex items-center justify-center p-2 border border-slate-800">
                <img
                  src={previewScreenshotUrl}
                  alt="Full proof preview"
                  className="max-h-[70vh] w-auto max-w-full object-contain rounded-xl"
                />
              </div>
              <button
                onClick={() => setPreviewScreenshotUrl(null)}
                className="mt-3 px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
