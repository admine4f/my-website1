import React, { useState } from 'react';
import { X, Copy, Check, QrCode, AlertCircle, ExternalLink, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

interface DepositModalProps {
  onClose: () => void;
}

export const DepositModal: React.FC<DepositModalProps> = ({ onClose }) => {
  const { user, refreshProfile, addToast } = useApp();
  const [selectedAsset, setSelectedAsset] = useState('USDT');
  const [network, setNetwork] = useState('BEP20');
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState('10');
  const [txid, setTxid] = useState('');
  const [senderExchange, setSenderExchange] = useState('Binance');
  const [showTxidForm, setShowTxidForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [depositsEnabled, setDepositsEnabled] = useState(false);
  const [depositMinUSDT, setDepositMinUSDT] = useState(2.0);
  const [depositFirstBonusUSDT, setDepositFirstBonusUSDT] = useState(10.0);

  React.useEffect(() => {
    api.getPublicSettings()
      .then(data => {
        if (data.success) {
          if (data.depositsEnabled !== undefined) setDepositsEnabled(data.depositsEnabled);
          if (typeof data.depositMinUSDT === 'number') {
            setDepositMinUSDT(data.depositMinUSDT);
            setAmount(prev => (parseFloat(prev) < data.depositMinUSDT ? String(data.depositMinUSDT) : prev));
          }
          if (typeof data.depositFirstBonusUSDT === 'number') {
            setDepositFirstBonusUSDT(data.depositFirstBonusUSDT);
          }
        }
      })
      .catch(() => {});
  }, []);

  const uniqueUserBscAddress = user?.depositAddress || '0x63562945f7845aa1130a5b1499720b29788c82db';
  const uniqueUserTrcAddress = 'T' + uniqueUserBscAddress.slice(2, 35);
  const uniqueUserTonAddress = 'EQ' + uniqueUserBscAddress.slice(2, 34);

  const depositAddress =
    network === 'BEP20'
      ? uniqueUserBscAddress
      : network === 'TRC20'
      ? uniqueUserTrcAddress
      : uniqueUserTonAddress;

  const handleCopy = () => {
    navigator.clipboard.writeText(depositAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast('Address Copied', 'Your unique deposit address copied to clipboard.', 'info');
  };

  const handleConfirmExternalDeposit = async () => {
    if (!user) return;
    if (!depositsEnabled) {
      addToast('Deposit Disabled', 'Open soon.', 'error');
      return;
    }
    const amountVal = parseFloat(amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      addToast('Invalid Amount', 'Please enter a valid deposit amount.', 'error');
      return;
    }
    if (selectedAsset === 'USDT' && amountVal < depositMinUSDT) {
      addToast('Below Minimum', `Minimum deposit amount is ${depositMinUSDT} USDT.`, 'error');
      return;
    }

    if (!txid || txid.trim().length < 40) {
      addToast('TXID Required', 'Please enter a valid 64-character external Transaction Hash (TXID) from Binance, Bybit, Trust Wallet, etc.', 'error');
      return;
    }

    const cleanTx = txid.trim().toLowerCase();
    const ownBsc = (user.depositAddress || '').toLowerCase();
    const ownTrc = ownBsc ? ('t' + ownBsc.slice(2, 35)).toLowerCase() : '';
    const ownTon = ownBsc ? ('eq' + ownBsc.slice(2, 34)).toLowerCase() : '';
    const adminBsc = '0x63562945f7845aa1130a5b1499720b29788c82db';
    const adminTrc = ('t' + adminBsc.slice(2, 35)).toLowerCase();
    const adminTon = ('eq' + adminBsc.slice(2, 34)).toLowerCase();

    if (
      cleanTx === ownBsc ||
      cleanTx === ownTrc ||
      cleanTx === ownTon ||
      cleanTx === adminBsc ||
      cleanTx === adminTrc ||
      cleanTx === adminTon ||
      cleanTx === (user.uid || '').toLowerCase() ||
      cleanTx.includes('e4f') ||
      cleanTx.startsWith('tx_') ||
      cleanTx.startsWith('wd_')
    ) {
      addToast(
        'Internal Transfer Blocked',
        'Internal transfers are strictly prohibited. Deposits must originate from an external exchange or wallet.',
        'error'
      );
      return;
    }

    setLoading(true);
    try {
      await api.deposit(user.id, {
        asset: selectedAsset,
        network,
        amount: amountVal,
        txid: txid.trim(),
        senderAddress: senderExchange || 'External Exchange/Wallet',
      });
      addToast('Deposit Submitted', `Your deposit of ${amountVal} ${selectedAsset} (TXID: ${txid.trim().substring(0, 8)}...) has been submitted for verification. Funds will be credited once confirmed.`, 'info');
      await refreshProfile();
      onClose();
    } catch (err: any) {
      addToast('Deposit Verification Failed', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-sm bg-[#0C1324] border border-slate-700 rounded-3xl p-5 text-slate-200 shadow-2xl my-6 max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-lg font-bold text-white mb-0.5">Deposit Crypto</h3>
        <p className="text-[11px] text-slate-400 mb-3">Deposit from external exchange or wallet</p>

        {/* Asset Selector */}
        <div className="mb-2.5">
          <label className="text-[10px] text-slate-400 font-semibold mb-1 block uppercase">Select Asset</label>
          <div className="grid grid-cols-3 gap-2">
            {['USDT', 'BTC', 'ETH'].map(a => (
              <button
                key={a}
                onClick={() => setSelectedAsset(a)}
                className={`py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedAsset === a
                    ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Network Selector */}
        <div className="mb-3">
          <label className="text-[10px] text-slate-400 font-semibold mb-1 block uppercase">Deposit Network</label>
          <div className="grid grid-cols-3 gap-2">
            {['BEP20', 'TRC20', 'TON'].map(n => (
              <button
                key={n}
                onClick={() => setNetwork(n)}
                className={`py-1.5 rounded-lg text-xs font-medium ${
                  network === n
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40 font-bold'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* QR Code Presentation */}
        <div className="flex flex-col items-center rounded-2xl bg-white p-3 mx-auto w-36 h-36 mb-3 shadow-lg">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${depositAddress}`}
            alt="Deposit QR"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Address Container */}
        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 mb-3">
          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
            <span className="text-amber-400 font-semibold">Your External Deposit Address ({network})</span>
            <button onClick={handleCopy} className="text-sky-400 font-bold flex items-center gap-1 active:scale-95 transition-transform">
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <div className="font-mono text-[11px] text-slate-200 break-all select-all">{depositAddress}</div>
        </div>

        {/* How to Deposit Step-by-Step */}
        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[10px] text-slate-400 space-y-1 mb-3">
          <div className="font-bold text-slate-300">How to Deposit:</div>
          <div>1. Copy the address above or scan the QR code.</div>
          <div>2. Open your <b>Binance / Trust Wallet / Bybit / OKX</b> app and choose Withdraw/Send.</div>
          <div>3. Select Network: <b className="text-sky-400">{network}</b></div>
          <div>4. Once sent, submit the external <b>Transaction Hash (TXID)</b> below.</div>
        </div>

        {/* Toggle Form to Submit External Transfer TXID */}
        <div className="mb-3">
          {!showTxidForm ? (
            <button
              onClick={() => setShowTxidForm(true)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-400 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>I have sent crypto from external wallet (Submit TXID)</span>
            </button>
          ) : (
            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">External Deposit Verification</span>
                <button
                  type="button"
                  onClick={() => setShowTxidForm(false)}
                  className="text-[10px] text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-semibold block mb-1">
                  Amount Transferred ({selectedAsset})
                </label>
                <input
                  type="number"
                  step="any"
                  min={depositMinUSDT}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder={`Min ${depositMinUSDT} ${selectedAsset}`}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-semibold block mb-1">
                  External Blockchain Transaction Hash (TXID)
                </label>
                <input
                  type="text"
                  value={txid}
                  onChange={e => setTxid(e.target.value)}
                  placeholder="Paste external TXID from Binance / TrustWallet"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white placeholder-slate-600"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-semibold block mb-1">
                  Sender Wallet / Exchange Name
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {['Binance', 'Trust Wallet', 'Bybit', 'MetaMask'].map(src => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setSenderExchange(src)}
                      className={`py-1 rounded-lg text-[10px] font-medium border truncate ${
                        senderExchange === src
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {src}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleConfirmExternalDeposit}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-slate-950 font-bold text-xs shadow-md cursor-pointer transition-all active:scale-95 disabled:opacity-50 mt-1"
              >
                {loading ? 'Verifying External TXID...' : `Verify & Credit External Deposit (${amount} ${selectedAsset})`}
              </button>
            </div>
          )}
        </div>

        {depositFirstBonusUSDT > 0 && (
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] text-center mb-2">
            🎁 First External Deposit Bonus: Deposit ≥ {depositMinUSDT} USDT from external exchange to automatically receive +{depositFirstBonusUSDT} USDT Spot Bonus!
          </div>
        )}

        <div className="text-[10px] text-slate-500 text-center">
          Minimum deposit: {depositMinUSDT} USDT • Network: {network} • External blockchain verification only
        </div>
      </div>
    </div>
  );
};
