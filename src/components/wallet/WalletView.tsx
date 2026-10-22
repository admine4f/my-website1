import React, { useState, useEffect } from 'react';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, History, Shield, AlertCircle, Filter } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api, formatCoinBalance } from '../../services/api';
import { TransactionRecord, WithdrawalRecord } from '../../types';

export const WalletView: React.FC = () => {
  const { user, balances, openModal, addToast } = useApp();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [filterSource, setFilterSource] = useState<string>('ALL');
  const [depositsEnabled, setDepositsEnabled] = useState<boolean>(false);
  const [withdrawalsEnabled, setWithdrawalsEnabled] = useState<boolean>(true);

  useEffect(() => {
    if (user) {
      api
        .getProfile(user.id)
        .then(res => {
          if (res.recentTransactions) setTransactions(res.recentTransactions);
        })
        .catch(() => {});

      api
        .getWithdrawals(user.id)
        .then(res => {
          if (Array.isArray(res)) setWithdrawals(res);
        })
        .catch(() => {});
    }
    // Fetch public settings for deposit & withdraw switch states
    api.getPublicSettings()
      .then(data => {
        if (data.success) {
          if (data.depositsEnabled !== undefined) setDepositsEnabled(data.depositsEnabled);
          if (data.withdrawalsEnabled !== undefined) setWithdrawalsEnabled(data.withdrawalsEnabled);
        }
      })
      .catch(() => {});
  }, [user]);

  const handleDepositClick = () => {
    if (!depositsEnabled) {
      addToast('Deposit Disabled', 'Open soon.', 'info');
      return;
    }
    openModal('DEPOSIT');
  };

  const handleWithdrawClick = () => {
    if (!withdrawalsEnabled) {
      addToast('Withdrawal Disabled', 'Open soon', 'info');
      return;
    }
    openModal('WITHDRAW');
  };

  const [marketPrices, setMarketPrices] = useState<Record<string, number>>({
    BTC: 81650.0,
    ETH: 2430.5,
    SOL: 103.8,
    BNB: 729.3,
  });

  useEffect(() => {
    api.getMarketAssets().then(res => {
      if (res && Array.isArray(res.assets)) {
        const pMap: Record<string, number> = {};
        for (const a of res.assets) {
          if (a.price) pMap[a.baseAsset] = a.price;
        }
        setMarketPrices(prev => ({ ...prev, ...pMap }));
      }
    }).catch(() => {});
  }, []);

  const btcPrice = marketPrices['BTC'] || 81650.0;
  const ethPrice = marketPrices['ETH'] || 2430.5;
  const solPrice = marketPrices['SOL'] || 103.8;
  const bnbPrice = marketPrices['BNB'] || 729.3;

  // Exact coin USD calculations matching individual cards:
  const usdtVal = Number((balances.usdt || 0).toFixed(2));
  const depositVal = Number(((user?.depositBalance || 0)).toFixed(2));
  const e4fVal = 0; // E4F is unlisted, no fiat valuation until official 2028 listing
  const btcVal = Number(((balances.btc || 0) * btcPrice).toFixed(2));
  const ethVal = Number(((balances.eth || 0) * ethPrice).toFixed(2));
  const solVal = Number(((balances.sol || 0) * solPrice).toFixed(2));
  const bnbVal = Number(((balances.bnb || 0) * bnbPrice).toFixed(2));

  // Total Spot calculation: exact mathematical sum of liquid assets (E4F is unlisted)
  const totalSpotUSD = (usdtVal + depositVal + btcVal + ethVal + solVal + bnbVal).toFixed(2);

  const filteredTxs = transactions.filter(t => {
    if (filterSource === 'ALL') return true;
    if (filterSource === 'TRADES') return t.source.includes('TRADE') || t.source.includes('SPOT');
    if (filterSource === 'DEPOSITS') return t.source.includes('DEPOSIT');
    if (filterSource === 'WITHDRAWALS') return t.source.includes('WITHDRAWAL');
    if (filterSource === 'REFERRALS') return t.source.includes('REFERRAL');
    if (filterSource === 'MINING') return t.source.includes('MINING');
    if (filterSource === 'TASKS') return t.source.includes('TASK');
    if (filterSource === 'REWARDS') return t.source.includes('SPIN') || t.source.includes('GIFT') || t.source.includes('CHECKIN') || t.source.includes('BONUS');
    return true;
  });

  return (
    <div className="flex flex-col gap-4 pb-24 pt-2 px-4 max-w-md mx-auto">
      {/* Wallet Header & Total Balance */}
      <div className="relative rounded-3xl p-5 bg-gradient-to-br from-[#0F182F] via-[#0D1426] to-[#070B14] border border-slate-800 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-400">
            Spot Wallet Total Assets
          </span>
        </div>

        <div className="mb-4">
          <div className="text-3xl font-black font-mono tracking-tight text-white flex items-baseline gap-1.5">
            <span>${totalSpotUSD}</span>
            <span className="text-xs font-semibold text-slate-400">USDT</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Available spot liquidity ready for trades
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handleDepositClick}
            className={`py-2.5 rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5 active:scale-95 transition-all ${
              depositsEnabled
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 shadow-amber-500/20'
                : 'bg-slate-800/80 text-slate-400 border border-slate-700/60'
            }`}
            title={!depositsEnabled ? 'Open soon.' : 'Deposit'}
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Deposit</span>
            {!depositsEnabled && <span className="text-[9px] px-1 py-0.2 bg-amber-500/20 text-amber-400 rounded">Soon</span>}
          </button>
          <button
            onClick={handleWithdrawClick}
            className={`py-2.5 rounded-xl border text-xs font-bold shadow-md flex items-center justify-center gap-1.5 active:scale-95 transition-all ${
              withdrawalsEnabled
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                : 'bg-slate-800/50 border-slate-700/50 text-slate-400'
            }`}
            title={!withdrawalsEnabled ? 'Open soon' : 'Withdraw'}
          >
            <ArrowUpRight className={`w-4 h-4 ${withdrawalsEnabled ? 'text-sky-400' : 'text-slate-500'}`} />
            <span>Withdraw</span>
            {!withdrawalsEnabled && <span className="text-[9px] px-1 py-0.2 bg-slate-700 text-slate-400 rounded">Open soon</span>}
          </button>
          <button
            onClick={() => {
              const el = document.getElementById('transaction-ledger');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
              setFilterSource('ALL');
            }}
            className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold shadow-md flex items-center justify-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
          >
            <History className="w-4 h-4 text-emerald-400" />
            <span>History</span>
          </button>
        </div>
      </div>

      {/* Crypto Balances List */}
      <div className="rounded-2xl p-4 bg-slate-900/70 border border-slate-800 space-y-2">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
          Asset Balances
        </h3>

        {/* 1. USDT Card */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-bold text-emerald-400 text-sm">
              ₮
            </div>
            <div>
              <div className="font-bold text-xs text-white">USDT</div>
              <div className="text-[10px] text-slate-400">Tether USD (Spot)</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm font-bold text-white">
              {balances.usdt.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              ≈ ${balances.usdt.toFixed(2)}
            </div>
          </div>
        </div>

        {/* 2. Deposit Balance Card */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-bold text-amber-400 text-sm">
              $
            </div>
            <div>
              <div className="font-bold text-xs text-white">Deposit Balance</div>
              <div className="text-[10px] text-slate-400">External Verification Deposit</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm font-bold text-amber-400">
              {((user?.depositBalance || 0)).toFixed(2)} USDT
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              ≈ ${((user?.depositBalance || 0)).toFixed(2)}
            </div>
          </div>
        </div>

        {/* 2. E4F Pre-Listing Rule Card (Section 6 & 36) */}
        <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 to-sky-400 shadow-md">
              <img
                src="/e4f_coin.jpg"
                alt="E4F"
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                <span>E4F</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold">
                  PRE-LISTING
                </span>
              </div>
              <div className="text-[10px] text-amber-400/90 font-medium">
                Status: NOT LISTED YET
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm font-bold text-amber-300">
              {balances.e4f.toFixed(2)} E4F
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Unlisted | Price: —
            </div>
          </div>
        </div>

        {/* 3. BTC Card */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=040"
              alt="BTC"
              className="w-8 h-8 rounded-full p-0.5 bg-slate-900"
            />
            <div>
              <div className="font-bold text-xs text-white">BTC</div>
              <div className="text-[10px] text-slate-400">Bitcoin</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm font-bold text-white">
              {formatCoinBalance(balances.btc, 6)}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              ≈ ${btcVal.toFixed(2)}
            </div>
          </div>
        </div>

        {/* 4. ETH Card */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=040"
              alt="ETH"
              className="w-8 h-8 rounded-full p-0.5 bg-slate-900"
            />
            <div>
              <div className="font-bold text-xs text-white">ETH</div>
              <div className="text-[10px] text-slate-400">Ethereum</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm font-bold text-white">
              {formatCoinBalance(balances.eth, 6)}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              ≈ ${ethVal.toFixed(2)}
            </div>
          </div>
        </div>

        {/* 5. SOL Card */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="https://cryptologos.cc/logos/solana-sol-logo.svg?v=040"
              alt="SOL"
              className="w-8 h-8 rounded-full p-0.5 bg-slate-900"
            />
            <div>
              <div className="font-bold text-xs text-white">SOL</div>
              <div className="text-[10px] text-slate-400">Solana</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm font-bold text-white">
              {formatCoinBalance(balances.sol, 4)}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              ≈ ${solVal.toFixed(2)}
            </div>
          </div>
        </div>

        {/* 6. BNB Card */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="https://cryptologos.cc/logos/bnb-bnb-logo.svg?v=040"
              alt="BNB"
              className="w-8 h-8 rounded-full p-0.5 bg-slate-900"
            />
            <div>
              <div className="font-bold text-xs text-white">BNB</div>
              <div className="text-[10px] text-slate-400">BNB Chain</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm font-bold text-white">
              {formatCoinBalance(balances.bnb, 4)}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              ≈ ${bnbVal.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Immutable Transaction Ledger (Section 39, 55) */}
      <div id="transaction-ledger" className="rounded-2xl p-4 bg-slate-900/70 border border-slate-800 scroll-mt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <History className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Transaction Ledger
            </h3>
          </div>
          <span className="text-[10px] text-slate-500">Append-Only</span>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-2">
          {['ALL', 'TRADES', 'DEPOSITS', 'WITHDRAWALS', 'REFERRALS', 'MINING', 'TASKS', 'REWARDS'].map(f => (
            <button
              key={f}
              onClick={() => setFilterSource(f)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors whitespace-nowrap ${
                filterSource === f
                  ? 'bg-sky-500 text-slate-950 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {filterSource === 'WITHDRAWALS' && withdrawals.length > 0 ? (
          <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
            {withdrawals.map(w => {
              const isSuccess = w.status.toLowerCase() === 'success' || w.status.toLowerCase() === 'completed';
              const isRejected = w.status.toLowerCase() === 'rejected' || w.status.toLowerCase() === 'failed';
              return (
                <div
                  key={w.id}
                  className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span>Withdrawal</span>
                      {w.wallet_address && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({w.wallet_address.substring(0, 6)}...{w.wallet_address.substring(w.wallet_address.length - 4)})
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {w.created_at ? new Date(w.created_at).toLocaleString() : 'Recent'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-rose-400">
                      -{Number(w.amount).toFixed(2)} {w.currency}
                    </div>
                    <span
                      className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase ${
                        isSuccess
                          ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                          : isRejected
                          ? 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                          : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                      }`}
                    >
                      {isSuccess ? 'SUCCESS' : isRejected ? 'REJECTED' : 'PENDING'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : filteredTxs.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500">
            No transaction records found for this filter.
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
            {filteredTxs.map(tx => (
              <div
                key={tx.id}
                className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-white flex items-center gap-1">
                    <span>{tx.source.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {new Date(tx.timestamp).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`font-mono font-bold ${
                      tx.direction === 'IN' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {tx.direction === 'IN' ? '+' : '-'}
                    {tx.amount.toFixed(2)} {tx.asset}
                  </div>
                  <span
                    className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full ${
                      tx.status === 'COMPLETED'
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : 'text-amber-400 bg-amber-500/10'
                    }`}
                  >
                    {tx.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
