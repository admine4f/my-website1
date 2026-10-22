import React, { useState, useEffect } from 'react';
import { ArrowUpDown, AlertCircle, CheckCircle2, History, ChevronDown, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api, formatCoinBalance } from '../../services/api';
import { OrderBook, SpotOrder } from '../../types';
import { OrderBookView } from './OrderBookView';

export const TradeView: React.FC = () => {
  const { user, balances, refreshProfile, updateBalances, addToast, language } = useApp();
  const [selectedPair, setSelectedPair] = useState<string>('BTC/USDT');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [priceInput, setPriceInput] = useState<string>('81650.00');
  const [amountInput, setAmountInput] = useState<string>('0.001');
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [orders, setOrders] = useState<SpotOrder[]>([]);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [activeTabSub, setActiveTabSub] = useState<'BOOK' | 'ORDERS'>('BOOK');
  const [showConfirmSellModal, setShowConfirmSellModal] = useState(false);

  const pairs = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'E4F/USDT'];

  // Sync default price when pair switches
  useEffect(() => {
    let defaultPrice = '81650.00';
    if (selectedPair.includes('ETH')) defaultPrice = '2430.50';
    else if (selectedPair.includes('SOL')) defaultPrice = '103.80';
    else if (selectedPair.includes('BNB')) defaultPrice = '729.30';
    else if (selectedPair.includes('E4F')) defaultPrice = '';
    if (orderType === 'MARKET') {
      setPriceInput(defaultPrice);
    }
  }, [selectedPair, orderType]);

  // Load Order Book & Orders
  useEffect(() => {
    if (selectedPair.startsWith('E4F')) {
      setOrderBook(null);
      return;
    }

    const loadData = () => {
      api
        .getOrderBook(selectedPair)
        .then(res => {
          setOrderBook(res);
          if (orderType === 'MARKET') {
            setPriceInput(res.lastPrice.toString());
          }
        })
        .catch(() => {});
    };

    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [selectedPair, orderType]);

  useEffect(() => {
    if (user) {
      api
        .getOrders(user.id)
        .then(res => setOrders(res.orders))
        .catch(() => {});
    }
  }, [user]);

  // Determine available balance
  const baseSymbol = selectedPair.split('/')[0].toLowerCase();
  let availableCoin = 0;
  if (baseSymbol === 'btc') availableCoin = balances.btc;
  if (baseSymbol === 'eth') availableCoin = balances.eth;
  if (baseSymbol === 'sol') availableCoin = balances.sol;
  if (baseSymbol === 'bnb') availableCoin = balances.bnb;
  if (baseSymbol === 'e4f') availableCoin = balances.e4f;

  const availableUSDT = balances.usdt;

  const handlePercentage = (pct: number) => {
    if (selectedPair.startsWith('E4F')) return;
    const currentPrice = parseFloat(priceInput) || orderBook?.lastPrice || 1;

    if (side === 'BUY') {
      const usdtToSpend = availableUSDT * (pct / 100);
      const calculatedAmt = (usdtToSpend / currentPrice).toFixed(4);
      setAmountInput(calculatedAmt);
    } else {
      const coinToSell = (availableCoin * (pct / 100)).toFixed(4);
      setAmountInput(coinToSell);
    }
  };

  const executePlaceOrder = async () => {
    if (!user) return;
    const amt = parseFloat(amountInput);
    const prc = parseFloat(priceInput);

    setLoadingOrder(true);
    try {
      const res = await api.placeOrder(user.id, {
        pair: selectedPair,
        side,
        type: orderType,
        price: prc,
        amount: amt,
      });

      if (res.success) {
        if (res.balances) {
          updateBalances(res.balances);
        }
        addToast(
          'Order Executed!',
          `Filled ${side} ${amt} ${selectedPair.split('/')[0]} @ $${res.order.price.toFixed(2)}`,
          'success'
        );
        await refreshProfile();
        const updated = await api.getOrders(user.id);
        setOrders(updated.orders);
      }
    } catch (err: any) {
      addToast('Order Rejected', err.message || 'Could not execute trade', 'error');
    } finally {
      setLoadingOrder(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!user) return;
    if (selectedPair.startsWith('E4F')) {
      addToast('Trading Unavailable', 'E4F is not listed yet. Pre-listing phase active.', 'error');
      return;
    }

    const amt = parseFloat(amountInput);
    const prc = parseFloat(priceInput);

    if (isNaN(amt) || amt <= 0) {
      addToast('Invalid Amount', 'Please enter a valid order amount.', 'error');
      return;
    }

    if (side === 'SELL') {
      if (amt > availableCoin) {
        addToast('Insufficient Balance', `You only have ${availableCoin} ${selectedPair.split('/')[0]} available to sell.`, 'error');
        return;
      }
      // Open Confirm Sell Dialog
      setShowConfirmSellModal(true);
      return;
    }

    // BUY order executes directly
    executePlaceOrder();
  };

  const totalCost = (parseFloat(priceInput || '0') * parseFloat(amountInput || '0')).toFixed(2);

  return (
    <div className="flex flex-col gap-3 pb-24 pt-2 px-4 max-w-md mx-auto">
      {/* Pair Header & Selector */}
      <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2">
          <select
            value={selectedPair}
            onChange={e => setSelectedPair(e.target.value)}
            className="bg-transparent font-black text-sm text-white focus:outline-none cursor-pointer"
          >
            {pairs.map(p => (
              <option key={p} value={p} className="bg-slate-900 text-white">
                {p} {p.startsWith('E4F') ? '(Pre-Listing)' : ''}
              </option>
            ))}
          </select>
          {selectedPair.startsWith('E4F') ? (
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">
              UNLISTED
            </span>
          ) : (
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
              SPOT
            </span>
          )}
        </div>

        {orderBook && !selectedPair.startsWith('E4F') && (
          <div className="text-right">
            <span className="font-mono text-xs font-bold text-emerald-400 block">
              ${orderBook.lastPrice.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Bal: <strong className="text-white">{formatCoinBalance(availableCoin, baseSymbol === 'btc' || baseSymbol === 'eth' ? 6 : 4)}</strong> {selectedPair.split('/')[0]}
            </span>
          </div>
        )}
      </div>

      {/* If E4F Guard Notice (Section 6, 33, 72) */}
      {selectedPair.startsWith('E4F') ? (
        <div className="p-6 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">E4F Spot Trading Not Available Yet</h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
            In compliance with pre-listing rules, E4F does not have an active market price, order
            book, or Buy/Sell mechanism. Real trading infrastructure will unlock on official listing.
          </p>
          <div className="text-xs font-mono font-semibold text-amber-300">
            Your Balance: {balances.e4f.toFixed(2)} E4F (Price: —)
          </div>
          <div className="pt-2">
            <button
              onClick={() => setSelectedPair('BTC/USDT')}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
            >
              Switch to BTC/USDT Spot
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Main Trading Area (Order Form + Order Book) */}
          <div className="grid grid-cols-2 gap-3">
            {/* Left: Trade Controls */}
            <div className="flex flex-col gap-2.5">
              {/* Buy / Sell Toggles */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
                <button
                  onClick={() => setSide('BUY')}
                  className={`py-1.5 text-xs font-black rounded-lg transition-all ${
                    side === 'BUY'
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Buy
                </button>
                <button
                  onClick={() => setSide('SELL')}
                  className={`py-1.5 text-xs font-black rounded-lg transition-all ${
                    side === 'SELL'
                      ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sell
                </button>
              </div>

              {/* Order Type: Market / Limit */}
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => setOrderType('MARKET')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                    orderType === 'MARKET' ? 'bg-slate-800 text-sky-400' : 'text-slate-500'
                  }`}
                >
                  Market
                </button>
                <button
                  onClick={() => setOrderType('LIMIT')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                    orderType === 'LIMIT' ? 'bg-slate-800 text-sky-400' : 'text-slate-500'
                  }`}
                >
                  Limit
                </button>
              </div>

              {/* Price Field */}
              <div>
                <label className="text-[10px] text-slate-500 font-semibold mb-1 block">Price</label>
                <div className="relative">
                  <input
                    type="number"
                    disabled={orderType === 'MARKET'}
                    value={priceInput}
                    onChange={e => setPriceInput(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-sky-500 disabled:opacity-60"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">
                    USDT
                  </span>
                </div>
              </div>

              {/* Amount Field */}
              <div>
                <label className="text-[10px] text-slate-500 font-semibold mb-1 block">Amount</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.0001"
                    value={amountInput}
                    onChange={e => setAmountInput(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">
                    {selectedPair.split('/')[0]}
                  </span>
                </div>
              </div>

              {/* Percentage Buttons (25%, 50%, 75%, 100%) */}
              <div className="grid grid-cols-4 gap-1">
                {[25, 50, 75, 100].map(pct => (
                  <button
                    key={pct}
                    onClick={() => handlePercentage(pct)}
                    className="py-1 rounded bg-slate-850 hover:bg-slate-800 border border-slate-800 text-[10px] font-mono text-slate-400 hover:text-white"
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              {/* Available & Total Info */}
              <div className="text-[10px] text-slate-400 space-y-1 pt-1.5 pb-1 px-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex justify-between items-center">
                  <span>Available USDT:</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {availableUSDT.toFixed(2)} USDT
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>{selectedPair.split('/')[0]} Balance:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {formatCoinBalance(availableCoin, baseSymbol === 'btc' || baseSymbol === 'eth' ? 6 : 4)} {selectedPair.split('/')[0]}
                  </span>
                </div>
                <div className="flex justify-between items-center font-semibold pt-1 border-t border-slate-800/60">
                  <span>Total Cost:</span>
                  <span className="font-mono text-amber-400">${totalCost} USDT</span>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handlePlaceOrder}
                disabled={loadingOrder}
                className={`w-full py-2.5 rounded-xl font-black text-xs transition-transform active:scale-95 shadow-md ${
                  side === 'BUY'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                    : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20'
                }`}
              >
                {loadingOrder ? 'Executing...' : `${side} ${selectedPair.split('/')[0]}`}
              </button>
            </div>

            {/* Right: Live Order Book */}
            <div className="flex flex-col">
              <div className="text-[11px] font-bold text-slate-400 mb-1">Live Order Book</div>
              <OrderBookView
                orderBook={orderBook}
                onSelectPrice={p => setPriceInput(p.toString())}
              />
            </div>
          </div>

          {/* Open Orders & Trade History */}
          <div className="rounded-2xl p-3 bg-slate-900/70 border border-slate-800 mt-2">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                My Trade Executions
              </h4>
              <span className="text-[10px] text-slate-500">{orders.length} orders</span>
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-500">
                No active or historical orders for this session.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto no-scrollbar">
                {orders.map(o => (
                  <div
                    key={o.id}
                    className="p-2 rounded-xl bg-slate-950/50 border border-slate-800 text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-bold">
                        <span
                          className={o.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}
                        >
                          {o.side}
                        </span>
                        <span className="text-white">{o.pair}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(o.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-slate-200">
                        {o.amount} @ ${o.price.toFixed(2)}
                      </div>
                      <span className="text-[9px] font-semibold text-emerald-400">
                        {o.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Confirm Sell Modal */}
      {showConfirmSellModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-sm bg-[#0C1324] border border-slate-700 rounded-3xl p-6 text-slate-200 shadow-2xl space-y-4">
            <button
              onClick={() => setShowConfirmSellModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-lg font-black text-white">Confirm Sell Order</h3>
              <p className="text-xs text-slate-400 mt-0.5">Review your order details before executing</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-400">
                <span>Trading Pair:</span>
                <span className="font-bold text-white">{selectedPair}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Selling Amount:</span>
                <span className="font-mono font-bold text-rose-400">{amountInput} {selectedPair.split('/')[0]}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Execution Price:</span>
                <span className="font-mono font-bold text-slate-200">${parseFloat(priceInput).toFixed(2)} USDT</span>
              </div>
              <div className="flex justify-between items-center font-bold text-white pt-2 border-t border-slate-800">
                <span>Estimated Return:</span>
                <span className="font-mono text-emerald-400 text-sm">${totalCost} USDT</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl">
              Please review your order details carefully before executing this sell trade.
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setShowConfirmSellModal(false)}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirmSellModal(false);
                  executePlaceOrder();
                }}
                className="py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 text-white font-black text-xs shadow-lg shadow-rose-500/20 active:scale-95 transition-transform"
              >
                Confirm Sell
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
