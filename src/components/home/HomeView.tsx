import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, ArrowUpRight, TrendingUp, Pickaxe, ChevronRight, Clock, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AnnouncementSlider } from './AnnouncementSlider';
import { QuickActions } from './QuickActions';
import { api } from '../../services/api';
import { MarketAsset, TransactionRecord } from '../../types';

export const HomeView: React.FC = () => {
  const { user, balances, setActiveTab, openModal, activeMiningSession, miningStats, addToast } = useApp();
  const [hideBalances, setHideBalances] = useState(false);
  const [marketAssets, setMarketAssets] = useState<MarketAsset[]>([]);
  const [recentTxs, setRecentTxs] = useState<TransactionRecord[]>([]);
  const [timeLeftStr, setTimeLeftStr] = useState<string>('08:00:00');
  const [depositsEnabled, setDepositsEnabled] = useState(false);
  const [withdrawalsEnabled, setWithdrawalsEnabled] = useState(true);

  // Load assets and recent transactions & public settings
  useEffect(() => {
    api.getMarketAssets().then(res => setMarketAssets(res.assets.slice(0, 4))).catch(() => {});
    if (user) {
      api.getProfile(user.id).then(res => {
        if (res.recentTransactions) setRecentTxs(res.recentTransactions.slice(0, 5));
      }).catch(() => {});
    }
    api.getPublicSettings()
      .then(data => {
        if (data.success) {
          if (data.depositsEnabled !== undefined) setDepositsEnabled(data.depositsEnabled);
          if (data.withdrawalsEnabled !== undefined) setWithdrawalsEnabled(data.withdrawalsEnabled);
        }
      })
      .catch(() => {});
  }, [user]);

  // Active mining countdown
  useEffect(() => {
    if (!activeMiningSession || activeMiningSession.status !== 'ACTIVE') return;

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, activeMiningSession.endTime - now);
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeftStr(
        `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeMiningSession]);

  // Calculate Spot Assets in USDT with live market prices (BTC, ETH, SOL, BNB, USDT, Deposit Balance, E4F)
  const btcPrice = marketAssets.find(a => a.baseAsset === 'BTC')?.price || 81650.0;
  const ethPrice = marketAssets.find(a => a.baseAsset === 'ETH')?.price || 2430.5;
  const solPrice = marketAssets.find(a => a.baseAsset === 'SOL')?.price || 103.8;
  const bnbPrice = marketAssets.find(a => a.baseAsset === 'BNB')?.price || 729.3;
  const usdtVal = Number((balances.usdt || 0).toFixed(2));
  const depositVal = Number(((user?.depositBalance || 0)).toFixed(2));
  const e4fVal = 0; // E4F is unlisted, excluded from liquid spot valuation
  const btcVal = Number(((balances.btc || 0) * btcPrice).toFixed(2));
  const ethVal = Number(((balances.eth || 0) * ethPrice).toFixed(2));
  const solVal = Number(((balances.sol || 0) * solPrice).toFixed(2));
  const bnbVal = Number(((balances.bnb || 0) * bnbPrice).toFixed(2));
  const totalSpotUSDT = (usdtVal + depositVal + btcVal + ethVal + solVal + bnbVal).toFixed(2);

  return (
    <div className="flex flex-col gap-4 pb-20 pt-2 px-4 max-w-md mx-auto">
      {/* Total Spot Assets Card */}
      <div className="relative rounded-3xl p-5 bg-gradient-to-br from-[#0F172E] via-[#0E1528] to-[#0A0E1A] border border-slate-800 shadow-xl overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">
              Total Spot Balance
            </span>
            <button
              onClick={() => setHideBalances(!hideBalances)}
              className="text-slate-400 hover:text-slate-200"
            >
              {hideBalances ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
            +2.48% (24h)
          </span>
        </div>

        {/* Large Balance Figure */}
        <div className="mb-4">
          <div className="text-3xl font-black tracking-tight text-white flex items-baseline gap-1.5">
            <span>{hideBalances ? '••••••' : `$${totalSpotUSDT}`}</span>
            <span className="text-xs font-semibold text-slate-400">USDT</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Spot Trading Ready Assets
          </div>
        </div>

        {/* E4F Pre-Listing Rule Banner (Section 6) */}
        <div className="rounded-2xl p-3 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/30 flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 to-amber-600 flex-shrink-0 shadow-md">
              <img
                src="/e4f_coin.jpg"
                alt="E4F Token"
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-white">
                  {hideBalances ? '••••' : `${balances.e4f.toFixed(2)} E4F`}
                </span>
                <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-[9px] font-bold text-amber-300">
                  PRE-LISTING
                </span>
              </div>
              <div className="text-[10px] text-slate-400">
                Price: <span className="font-mono text-slate-300">—</span> | Value:{' '}
                <span className="font-mono text-slate-300">—</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
              Listing: 2028
            </div>
            <div className="text-[9px] text-amber-400/90 font-medium">Not Listed Yet</div>
          </div>
        </div>

        {/* Deposit / Withdraw / Transfer Fast Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => {
              if (!depositsEnabled) {
                addToast('Deposit Disabled', 'Open soon.', 'info');
                return;
              }
              openModal('DEPOSIT');
            }}
            className={`py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              depositsEnabled
                ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 text-amber-300'
                : 'bg-slate-800/40 border-slate-700/40 text-slate-400'
            }`}
            title={!depositsEnabled ? 'Open soon.' : 'Deposit'}
          >
            <span>Deposit</span>
            {!depositsEnabled && <span className="text-[9px] px-1 py-0.2 bg-amber-500/20 text-amber-400 rounded">Soon</span>}
          </button>
          <button
            onClick={() => {
              if (!withdrawalsEnabled) {
                addToast('Withdrawal Disabled', 'Open soon', 'info');
                return;
              }
              openModal('WITHDRAW');
            }}
            className={`py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              withdrawalsEnabled
                ? 'bg-slate-800 hover:bg-slate-700/80 border-slate-700 text-slate-200'
                : 'bg-slate-800/40 border-slate-700/40 text-slate-400'
            }`}
            title={!withdrawalsEnabled ? 'Open soon' : 'Withdraw'}
          >
            <span>Withdraw</span>
            {!withdrawalsEnabled && <span className="text-[9px] px-1 py-0.2 bg-slate-700 text-slate-400 rounded">Open soon</span>}
          </button>
          <button
            onClick={() => setActiveTab('trade')}
            className="py-2.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
          >
            <span>Trade</span>
          </button>
        </div>
      </div>

      {/* Announcements Slider (Section 13) */}
      <AnnouncementSlider />

      {/* E4F Mining Preview Widget (Section 14) */}
      <div className="rounded-2xl p-4 bg-gradient-to-r from-[#0E1528] via-[#101A33] to-[#0A0F1F] border border-amber-500/30 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
              E4F Mining Engine
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            {miningStats?.miningRatePerHour !== undefined ? miningStats.miningRatePerHour : 0.25} E4F / hr (8h)
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* 3D Coin mini rotating preview */}
            <div className="relative w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 via-sky-400 to-amber-600 flex-shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
              <img
                src="/e4f_coin.jpg"
                alt="E4F Mining"
                className={`w-full h-full object-cover rounded-full ${
                  activeMiningSession?.status === 'ACTIVE' ? 'animate-spin-3d' : ''
                }`}
              />
            </div>

            <div>
              <div className="text-sm font-extrabold text-white">
                {activeMiningSession?.status === 'ACTIVE'
                  ? 'Mining in Progress'
                  : activeMiningSession?.status === 'COMPLETED'
                  ? 'Session Completed'
                  : 'Mining Ready'}
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3 text-sky-400" />
                <span className="font-mono text-sky-300 font-semibold">
                  {activeMiningSession?.status === 'ACTIVE' ? timeLeftStr : '8h Session Duration'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('mining')}
            className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/20 flex items-center gap-1 active:scale-95 transition-transform"
          >
            <span>
              {activeMiningSession?.status === 'ACTIVE'
                ? 'View Session'
                : activeMiningSession?.status === 'COMPLETED'
                ? 'Claim Reward'
                : 'Start Mining'}
            </span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Actions (Section 15) */}
      <QuickActions />

      {/* Live Spot Markets Preview (Section 8, 32) */}
      <div className="rounded-2xl p-4 bg-slate-900/60 border border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Live Spot Markets
            </h3>
          </div>
          <button
            onClick={() => setActiveTab('market')}
            className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-0.5"
          >
            <span>View All</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <div className="space-y-2">
          {marketAssets.map(asset => (
            <div
              key={asset.symbol}
              onClick={() => {
                if (asset.isListed) setActiveTab('trade');
              }}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <img
                  src={asset.icon}
                  alt={asset.name}
                  className="w-7 h-7 rounded-full object-cover bg-slate-800 p-0.5"
                />
                <div>
                  <div className="font-bold text-xs text-white flex items-center gap-1">
                    <span>{asset.symbol}</span>
                    {!asset.isListed && (
                      <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-normal">
                        Pre-Listing
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400">{asset.name}</div>
                </div>
              </div>

              <div className="text-right">
                {asset.isListed ? (
                  <>
                    <div className="font-mono text-xs font-bold text-white">
                      ${asset.price?.toLocaleString()}
                    </div>
                    <div
                      className={`text-[10px] font-semibold ${
                        (asset.priceChangePercent24h || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {(asset.priceChangePercent24h || 0) >= 0 ? '+' : ''}
                      {asset.priceChangePercent24h?.toFixed(2)}%
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs font-bold text-amber-400">NOT LISTED YET</div>
                    <div className="text-[10px] text-slate-400 font-mono">Price: —</div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Ledger Activity (Section 16, 39) */}
      <div className="rounded-2xl p-4 bg-slate-900/60 border border-slate-800 mb-2">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Recent Transaction Ledger
          </h3>
          <button
            onClick={() => setActiveTab('wallet')}
            className="text-xs font-semibold text-sky-400 hover:text-sky-300"
          >
            History
          </button>
        </div>

        {recentTxs.length === 0 ? (
          <div className="text-center py-4 text-xs text-slate-500">
            No transactions recorded yet.
          </div>
        ) : (
          <div className="space-y-2">
            {recentTxs.map(tx => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-200">
                    {tx.source.replace(/_/g, ' ')}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div
                  className={`font-mono font-bold ${
                    tx.direction === 'IN' ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {tx.direction === 'IN' ? '+' : '-'}
                  {tx.amount.toFixed(2)} {tx.asset}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
