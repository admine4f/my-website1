import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { TopBar } from './components/common/TopBar';
import { BottomNav } from './components/common/BottomNav';
import { SplashScreen } from './components/common/SplashScreen';
import { WelcomeBonusModal } from './components/common/WelcomeBonusModal';

import { HomeView } from './components/home/HomeView';
import { MiningView } from './components/mining/MiningView';
import { MarketView } from './components/market/MarketView';
import { TradeView } from './components/trade/TradeView';
import { WalletView } from './components/wallet/WalletView';

import { DepositModal } from './components/wallet/DepositModal';
import { WithdrawModal } from './components/wallet/WithdrawModal';
import { RewardsCenterModal } from './components/rewards/RewardsCenterModal';
import { TasksModal } from './components/tasks/TasksModal';
import { ReferralModal } from './components/referral/ReferralModal';
import { SupportModal } from './components/support/SupportModal';
import { AdminControlModal } from './components/admin/AdminControlModal';
import { ProfileModal } from './components/common/ProfileModal';
import { SpinWheelModal } from './components/rewards/SpinWheelModal';
import { GiftBoxesModal } from './components/rewards/GiftBoxesModal';
import { AccountCreationModal } from './components/common/AccountCreationModal';

const AppContent: React.FC = () => {
  const {
    activeTab,
    activeModal,
    closeModal,
    toasts,
    removeToast,
    showWelcomeBonus,
    showAccountCreation,
    pendingReferralCode,
    creatingAccount,
    confirmAccountCreation,
    dismissAccountCreation,
  } = useApp();

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 font-sans flex flex-col selection:bg-amber-500 selection:text-slate-950">
      <SplashScreen />

      {/* Main Top Navigation Header */}
      <TopBar />

      {/* Active Tab View */}
      <main className="flex-1 w-full max-w-md mx-auto pb-24">
        {activeTab === 'home' && <HomeView />}
        {activeTab === 'mining' && <MiningView />}
        {activeTab === 'market' && <MarketView />}
        {activeTab === 'trade' && <TradeView />}
        {activeTab === 'wallet' && <WalletView />}
      </main>

      {/* Bottom Sticky Navigation */}
      <BottomNav />

      {/* Referral Onboarding Account Creation Popup */}
      {showAccountCreation && (
        <AccountCreationModal
          referralCode={pendingReferralCode}
          loading={creatingAccount}
          onConfirm={confirmAccountCreation}
          onDismiss={dismissAccountCreation}
        />
      )}

      {/* Global Modals */}
      {(showWelcomeBonus || activeModal === 'WELCOME' || activeModal === 'WELCOME_BONUS') && <WelcomeBonusModal />}
      {activeModal === 'DEPOSIT' && <DepositModal onClose={closeModal} />}
      {activeModal === 'WITHDRAW' && <WithdrawModal onClose={closeModal} />}
      {activeModal === 'REWARDS' && <RewardsCenterModal onClose={closeModal} />}
      {activeModal === 'TASKS' && <TasksModal onClose={closeModal} />}
      {activeModal === 'REFERRAL' && <ReferralModal onClose={closeModal} />}
      {activeModal === 'SUPPORT' && <SupportModal onClose={closeModal} />}
      {activeModal === 'ADMIN' && <AdminControlModal onClose={closeModal} />}
      {activeModal === 'PROFILE' && <ProfileModal onClose={closeModal} />}
      {activeModal === 'GIFT_BOXES' && <GiftBoxesModal onClose={closeModal} />}
      {activeModal === 'SPIN' && <SpinWheelModal onClose={closeModal} />}

      {/* Toast Floating Notification Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-xs pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            onClick={() => removeToast(toast.id)}
            className={`pointer-events-auto p-3.5 rounded-2xl shadow-2xl border text-xs cursor-pointer transition-all animate-in fade-in slide-in-from-top duration-200 ${
              toast.type === 'success'
                ? 'bg-[#0B1E1B] border-emerald-500/50 text-emerald-300'
                : toast.type === 'error'
                ? 'bg-[#251015] border-rose-500/50 text-rose-300'
                : 'bg-[#101A2E] border-sky-500/50 text-sky-300'
            }`}
          >
            <div className="font-bold text-white mb-0.5">{toast.title}</div>
            <div className="text-[11px] opacity-90">{toast.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

declare global {
  interface Window {
    showMonetagInsideTelegram?: () => Promise<boolean>;
    showRichAdsInTelegram?: (richadsId?: string | number) => Promise<boolean>;
    TelegramAdsController?: any;
  }
}

// NOTE: window.showMonetagInsideTelegram and window.showRichAdsInTelegram are defined ONLY in index.html.
// (Previous duplicates here overwrote them and reported success without showing any ad.)

import { initAllTmaAds } from './components/TmaAdManager';
import { blockExternalRedirect } from './services/antiFakeAds';

export default function App() {
  React.useEffect(() => {
    blockExternalRedirect();
    initAllTmaAds();
  }, []);

  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
