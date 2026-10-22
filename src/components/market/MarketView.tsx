import React, { useState, useEffect } from 'react';
import { Search, Star, TrendingUp, TrendingDown, ArrowLeftRight, Clock, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { MarketAsset, CandlestickData } from '../../types';
import { CandleChart } from './CandleChart';

export const MarketView: React.FC = () => {
  const { setActiveTab } = useApp();
  const [assets, setAssets] = useState<MarketAsset[]>([]);
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'USDT' | 'GAINERS' | 'FAVORITES'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<MarketAsset | null>(null);
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '1h' | '4h' | '1d'>('15m');
  const [klines, setKlines] = useState<CandlestickData[]>([]);

  useEffect(() => {
    api
      .getMarketAssets()
      .then(res => {
        setAssets(res.assets);
        if (!selectedAsset && res.assets.length > 1) {
          // default select BTC/USDT for chart preview
          setSelectedAsset(res.assets[1]);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch candlestick data when asset or timeframe changes
  useEffect(() => {
    if (!selectedAsset || !selectedAsset.isListed) {
      setKlines([]);
      return;
    }

    api
      .getKlines(selectedAsset.symbol, timeframe)
      .then(res => {
        setKlines(res.klines);
      })
      .catch(() => {});
  }, [selectedAsset, timeframe]);

  const filteredAssets = assets.filter(a => {
    const matchesSearch =
      a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeCategory === 'GAINERS') {
      return (a.priceChangePercent24h || 0) > 0;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-4 pb-24 pt-2 px-4 max-w-md mx-auto">
      {/* Header & Search */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-white">
            Markets & Quotes
          </h2>
          <p className="text-xs text-slate-400">
            Real-time multi-asset spot trading quotes
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search coin or pair (e.g. BTC, ETH, E4F)"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
        />
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {(['ALL', 'USDT', 'GAINERS'] as const).map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              activeCategory === cat
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Selected Asset Chart View */}
      {selectedAsset && (
        <div className="p-4 rounded-2xl bg-gradient-to-b from-[#0F172E] to-[#0A0F1D] border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <img
                src={selectedAsset.icon}
                alt={selectedAsset.name}
                className="w-8 h-8 rounded-full p-0.5 bg-slate-800"
              />
              <div>
                <div className="font-extrabold text-sm text-white flex items-center gap-1.5">
                  <span>{selectedAsset.symbol}</span>
                  {!selectedAsset.isListed && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                      PRE-LISTING
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400">{selectedAsset.name}</div>
              </div>
            </div>

            {selectedAsset.isListed ? (
              <div className="text-right">
                <div className="text-base font-black font-mono text-white">
                  ${selectedAsset.price?.toLocaleString()}
                </div>
                <div
                  className={`text-xs font-bold flex items-center justify-end gap-0.5 ${
                    (selectedAsset.priceChangePercent24h || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {(selectedAsset.priceChangePercent24h || 0) >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {(selectedAsset.priceChangePercent24h || 0) >= 0 ? '+' : ''}
                    {selectedAsset.priceChangePercent24h?.toFixed(2)}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-right">
                <div className="text-xs font-bold text-amber-400">NOT LISTED YET</div>
                <div className="text-[10px] text-slate-400 font-mono">Price: —</div>
              </div>
            )}
          </div>

          {/* If E4F (Pre-Listing Rule - Section 6) */}
          {!selectedAsset.isListed ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center my-3">
              <AlertCircle className="w-6 h-6 text-amber-400 mx-auto mb-1.5" />
              <div className="text-xs font-bold text-amber-300 mb-1">
                E4F Token Pre-Listing Phase
              </div>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed mb-2">
                E4F market charts, order books, and live pricing will unlock on official listing
                (Planned Milestone: 28 February 2028).
              </p>
              <button
                onClick={() => setActiveTab('mining')}
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-md"
              >
                Mine E4F Now
              </button>
            </div>
          ) : (
            <>
              {/* Timeframe Switcher */}
              <div className="flex items-center justify-between border-y border-slate-800/80 py-1.5 my-2.5">
                <div className="flex items-center gap-1">
                  {(['1m', '5m', '15m', '1h', '4h', '1d'] as const).map(tf => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition-colors ${
                        timeframe === tf ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tf.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  24h Vol: {selectedAsset.volume24h?.toLocaleString()}
                </div>
              </div>

              {/* Real Interactive Candlestick Chart */}
              <CandleChart data={klines} height={200} />

              {/* Trade CTA */}
              <button
                onClick={() => setActiveTab('trade')}
                className="w-full mt-3 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-lg shadow-sky-500/20 flex items-center justify-center gap-1.5 transition-transform active:scale-95"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Trade {selectedAsset.symbol}</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Asset List */}
      <div className="rounded-2xl p-3 bg-slate-900/60 border border-slate-800 space-y-1.5">
        <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
          <span>Asset / Pair</span>
          <span>Price / 24h Change</span>
        </div>

        {filteredAssets.map(asset => (
          <div
            key={asset.symbol}
            onClick={() => setSelectedAsset(asset)}
            className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
              selectedAsset?.symbol === asset.symbol
                ? 'bg-slate-800/90 border-amber-500/40 shadow-sm'
                : 'bg-slate-900/80 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <img
                src={asset.icon}
                alt={asset.name}
                className="w-8 h-8 rounded-full object-cover p-0.5 bg-slate-800"
              />
              <div>
                <div className="font-bold text-xs text-white flex items-center gap-1">
                  <span>{asset.symbol}</span>
                  {!asset.isListed && (
                    <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300">
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
  );
};
