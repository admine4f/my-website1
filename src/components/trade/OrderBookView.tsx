import React from 'react';
import { OrderBook } from '../../types';

interface OrderBookViewProps {
  orderBook: OrderBook | null;
  onSelectPrice?: (price: number) => void;
}

export const OrderBookView: React.FC<OrderBookViewProps> = ({ orderBook, onSelectPrice }) => {
  if (!orderBook) {
    return (
      <div className="p-3 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl">
        Loading order book...
      </div>
    );
  }

  const maxTotal = Math.max(
    ...orderBook.bids.map(b => b.total),
    ...orderBook.asks.map(a => a.total),
    1
  );

  return (
    <div className="flex flex-col text-[11px] font-mono select-none bg-slate-950/60 rounded-xl p-2.5 border border-slate-800/80">
      {/* Table Header */}
      <div className="flex justify-between text-[10px] text-slate-500 font-semibold mb-1 px-1">
        <span>Price (USDT)</span>
        <span>Amount</span>
        <span>Total</span>
      </div>

      {/* Asks (Red) - Sellers */}
      <div className="flex flex-col-reverse gap-0.5 mb-1.5">
        {orderBook.asks.slice(-5).map((ask, idx) => {
          const depthPercent = Math.min(100, Math.round((ask.total / maxTotal) * 100));
          return (
            <div
              key={idx}
              onClick={() => onSelectPrice && onSelectPrice(ask.price)}
              className="relative flex justify-between items-center px-1 py-0.5 rounded hover:bg-slate-800/50 cursor-pointer overflow-hidden"
            >
              <div
                className="absolute right-0 top-0 bottom-0 bg-rose-500/10 pointer-events-none"
                style={{ width: `${depthPercent}%` }}
              />
              <span className="text-rose-400 font-semibold z-10">{ask.price.toFixed(2)}</span>
              <span className="text-slate-300 z-10">{ask.amount.toFixed(4)}</span>
              <span className="text-slate-500 z-10">{ask.total.toFixed(4)}</span>
            </div>
          );
        })}
      </div>

      {/* Spread & Last Price Bar */}
      <div className="flex items-center justify-between py-1 px-1 my-0.5 border-y border-slate-800/80 bg-slate-900/50 rounded">
        <span className="text-xs font-bold text-white">${orderBook.lastPrice.toLocaleString()}</span>
        <span className="text-[10px] text-slate-400">Spread: {orderBook.spread}</span>
      </div>

      {/* Bids (Green) - Buyers */}
      <div className="flex flex-col gap-0.5 mt-1.5">
        {orderBook.bids.slice(0, 5).map((bid, idx) => {
          const depthPercent = Math.min(100, Math.round((bid.total / maxTotal) * 100));
          return (
            <div
              key={idx}
              onClick={() => onSelectPrice && onSelectPrice(bid.price)}
              className="relative flex justify-between items-center px-1 py-0.5 rounded hover:bg-slate-800/50 cursor-pointer overflow-hidden"
            >
              <div
                className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 pointer-events-none"
                style={{ width: `${depthPercent}%` }}
              />
              <span className="text-emerald-400 font-semibold z-10">{bid.price.toFixed(2)}</span>
              <span className="text-slate-300 z-10">{bid.amount.toFixed(4)}</span>
              <span className="text-slate-500 z-10">{bid.total.toFixed(4)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
