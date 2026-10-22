import React, { useState } from 'react';
import { X, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

interface WithdrawModalProps {
  onClose: () => void;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({ onClose }) => {
  const { user, balances, refreshProfile, addToast } = useApp();
  const [selectedAsset, setSelectedAsset] = useState('USDT');
  const [network, setNetwork] = useState('TRC20');
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [maxWithdrawalLimit, setMaxWithdrawalLimit] = useState(1000);
  const [minWithdrawalLimit, setMinWithdrawalLimit] = useState(0.1);
  const [withdrawalsEnabled, setWithdrawalsEnabled] = useState(true);
  const [networkSettings, setNetworkSettings] = useState<Record<string, { enabled?: boolean; minAmount: number; maxAmount: number; fee: number }>>({
    TRC20: { enabled: true, minAmount: 1.0, maxAmount: 1000.0, fee: 1.0 },
    BEP20: { enabled: true, minAmount: 1.0, maxAmount: 1000.0, fee: 0.5 },
    TON: { enabled: true, minAmount: 1.0, maxAmount: 1000.0, fee: 0.5 },
  });

  React.useEffect(() => {
    api.getPublicSettings()
      .then(data => {
        if (data.success) {
          if (data.maxWithdrawalLimit) setMaxWithdrawalLimit(data.maxWithdrawalLimit);
          if (data.minWithdrawalLimit !== undefined) setMinWithdrawalLimit(data.minWithdrawalLimit);
          if (data.withdrawalsEnabled !== undefined) setWithdrawalsEnabled(data.withdrawalsEnabled);
          if (data.networkWithdrawSettings) setNetworkSettings(data.networkWithdrawSettings);
        }
      })
      .catch(() => {});
  }, []);

  const currentNetConfig = networkSettings[network] || {
    enabled: true,
    minAmount: minWithdrawalLimit,
    maxAmount: maxWithdrawalLimit,
    fee: 1.0,
  };
  const fee = typeof currentNetConfig.fee === 'number' ? currentNetConfig.fee : 1.0;
  const activeMinLimit = typeof currentNetConfig.minAmount === 'number' ? currentNetConfig.minAmount : minWithdrawalLimit;
  const activeMaxLimit = typeof currentNetConfig.maxAmount === 'number' ? currentNetConfig.maxAmount : maxWithdrawalLimit;

  const numAmount = parseFloat(amount) || 0;
  const totalDeducted = numAmount > 0 ? numAmount + fee : 0;

  const handleMax = () => {
    const maxAllowed = Math.max(0, Math.min(balances.usdt - fee, activeMaxLimit));
    setAmount(maxAllowed > 0 ? maxAllowed.toFixed(2) : '0.00');
  };

  const handleWithdraw = async () => {
    if (!user) return;
    if (!withdrawalsEnabled) {
      addToast('Withdrawal Disabled', 'Open soon', 'error');
      return;
    }

    if (currentNetConfig.enabled === false) {
      addToast('Network Unavailable', `${network} withdrawals are temporarily disabled.`, 'error');
      return;
    }

    if (!address || address.trim().length < 10) {
      addToast('Invalid Address', 'Please provide a valid destination wallet address.', 'error');
      return;
    }

    const cleanAddr = address.trim().toLowerCase();
    const ownBsc = (user.depositAddress || '').toLowerCase();
    const ownTrc = ownBsc ? ('t' + ownBsc.slice(2, 35)).toLowerCase() : '';
    const ownTon = ownBsc ? ('eq' + ownBsc.slice(2, 34)).toLowerCase() : '';
    const adminBsc = '0x63562945f7845aa1130a5b1499720b29788c82db';
    const adminTrc = ('t' + adminBsc.slice(2, 35)).toLowerCase();
    const adminTon = ('eq' + adminBsc.slice(2, 34)).toLowerCase();

    // STRICT ANTI-INTERNAL & ANTI-SAME-APP WITHDRAWAL RULE
    if (
      cleanAddr === ownBsc ||
      cleanAddr === ownTrc ||
      cleanAddr === ownTon ||
      cleanAddr === adminBsc ||
      cleanAddr === adminTrc ||
      cleanAddr === adminTon ||
      cleanAddr.includes('e4f') ||
      cleanAddr.includes('earn4future') ||
      cleanAddr === (user.uid || '').toLowerCase()
    ) {
      addToast(
        'Internal Transfer Blocked',
        'Internal transfers are strictly prohibited. Withdrawals must be sent directly to an external exchange or wallet.',
        'error'
      );
      return;
    }

    if (network === 'TRC20' && !cleanAddr.startsWith('t')) {
      addToast('Invalid TRC20 Address', 'TRC20 addresses must start with "T".', 'error');
      return;
    }
    if (network === 'BEP20' && !cleanAddr.startsWith('0x')) {
      addToast('Invalid BEP20 Address', 'BEP20 addresses must start with "0x".', 'error');
      return;
    }
    if (network === 'TON' && !cleanAddr.startsWith('eq') && !cleanAddr.startsWith('uq') && !cleanAddr.startsWith('0:')) {
      addToast('Invalid TON Address', 'TON addresses must start with "EQ" or "UQ".', 'error');
      return;
    }

    if (numAmount < activeMinLimit) {
      addToast('Amount Too Low', `Minimum withdrawal is ${activeMinLimit} USDT on ${network}.`, 'error');
      return;
    }

    if (numAmount > activeMaxLimit) {
      addToast('Limit Exceeded', `Maximum withdrawal limit is ${activeMaxLimit} USDT on ${network}.`, 'error');
      return;
    }

    if (balances.usdt < numAmount + fee) {
      addToast('Insufficient Balance', `You need ${(numAmount + fee).toFixed(2)} USDT (including ${fee.toFixed(2)} USDT network fee).`, 'error');
      return;
    }

    // Input verified -> Directly execute withdrawal
    executeWithdrawal();
  };

  const executeWithdrawal = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await api.withdraw(user.id, {
        asset: selectedAsset,
        address: address.trim(),
        network,
        amount: numAmount,
      });

      addToast(
        'Withdrawal Submitted',
        `Pending security review: ${numAmount} ${selectedAsset} to ${address.substring(0, 8)}...`,
        'success'
      );
      await refreshProfile();
      onClose();
    } catch (err: any) {
      addToast('Withdrawal Error', err.message || 'Request failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-sm bg-[#0C1324] border border-slate-700 rounded-3xl p-6 text-slate-200 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-lg font-bold text-white mb-1">Withdraw Crypto</h3>
        <p className="text-xs text-slate-400 mb-4">Transfer to external cold wallet or exchange</p>

        {/* Selected Asset */}
        <div className="mb-3">
          <label className="text-[10px] text-slate-400 font-semibold mb-1 block uppercase">Asset</label>
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <span className="font-bold text-xs text-white">USDT (Tether)</span>
            <span className="text-xs text-slate-400 font-mono">
              Available: {balances.usdt.toFixed(2)} USDT
            </span>
          </div>
        </div>

        {/* Network */}
        <div className="mb-3">
          <label className="text-[10px] text-slate-400 font-semibold mb-1 block uppercase">Network</label>
          <div className="grid grid-cols-3 gap-2">
            {['TRC20', 'BEP20', 'TON'].map(n => (
              <button
                key={n}
                onClick={() => setNetwork(n)}
                className={`py-1.5 rounded-lg text-xs font-medium ${
                  network === n
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Destination Address */}
        <div className="mb-3">
          <label className="text-[10px] text-slate-400 font-semibold mb-1 block uppercase">
            Destination Address
          </label>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder={`Enter ${network} wallet address`}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
          />
        </div>

        {/* Amount */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] text-slate-400 font-semibold uppercase">Amount</label>
              <span className="text-[9px] text-amber-400 font-medium">({activeMinLimit} – {activeMaxLimit} USDT)</span>
            </div>
            <button onClick={handleMax} className="text-[10px] text-sky-400 font-bold hover:underline">
              MAX ({Math.max(0, Math.min(balances.usdt - fee, activeMaxLimit)).toFixed(2)})
            </button>
          </div>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
              USDT
            </span>
          </div>
        </div>

        {/* Fee & Final Breakdown */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-1 mb-5">
          <div className="flex justify-between text-slate-400">
            <span>Network Fee ({network}):</span>
            <span className="font-mono">{fee.toFixed(2)} USDT</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Total Deducted:</span>
            <span className="font-mono">{totalDeducted.toFixed(2)} USDT</span>
          </div>
          <div className="flex justify-between font-bold text-white pt-1 border-t border-slate-800">
            <span>You Receive:</span>
            <span className="font-mono text-emerald-400">{numAmount.toFixed(2)} USDT</span>
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleWithdraw}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition-transform"
        >
          {loading ? 'Submitting...' : 'Submit Withdrawal Request'}
        </button>
      </div>
    </div>
  );
};
