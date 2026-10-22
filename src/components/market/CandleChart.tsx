import React from 'react';
import { CandlestickData } from '../../types';

interface CandleChartProps {
  data: CandlestickData[];
  height?: number;
}

export const CandleChart: React.FC<CandleChartProps> = ({ data, height = 220 }) => {
  if (!data || data.length === 0) {
    return (
      <div
        className="w-full flex items-center justify-center text-xs text-slate-500 bg-slate-950/40 rounded-xl"
        style={{ height }}
      >
        Loading live candlestick feed...
      </div>
    );
  }

  const padding = 20;
  const width = 360; // relative SVG viewBox width
  const chartHeight = height - 40;

  const minPrice = Math.min(...data.map(d => d.low));
  const maxPrice = Math.max(...data.map(d => d.high));
  const priceRange = maxPrice - minPrice || 1;

  const candleWidth = Math.max(3, (width - padding * 2) / data.length - 2);

  const getY = (val: number) => {
    return padding + chartHeight - ((val - minPrice) / priceRange) * chartHeight;
  };

  return (
    <div className="w-full relative overflow-hidden bg-slate-950/60 rounded-xl p-2 border border-slate-800/80">
      {/* Price Scale Indicators */}
      <div className="absolute right-2 top-2 text-[10px] font-mono text-emerald-400 font-bold bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800 z-10">
        ${maxPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div className="absolute right-2 bottom-6 text-[10px] font-mono text-slate-400 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800 z-10">
        ${minPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        preserveAspectRatio="none"
      >
        {/* Horizontal grid lines */}
        <line x1={0} y1={padding} x2={width} y2={padding} stroke="#1e293b" strokeDasharray="3 3" />
        <line x1={0} y1={padding + chartHeight / 2} x2={width} y2={padding + chartHeight / 2} stroke="#1e293b" strokeDasharray="3 3" />
        <line x1={0} y1={padding + chartHeight} x2={width} y2={padding + chartHeight} stroke="#1e293b" strokeDasharray="3 3" />

        {data.map((d, idx) => {
          const x = padding + idx * (candleWidth + 2);
          const isUp = d.close >= d.open;
          const color = isUp ? '#10B981' : '#F43F5E';

          const yHigh = getY(d.high);
          const yLow = getY(d.low);
          const yOpen = getY(d.open);
          const yClose = getY(d.close);

          const candleTop = Math.min(yOpen, yClose);
          const candleHeight = Math.max(2, Math.abs(yOpen - yClose));

          return (
            <g key={d.time || idx}>
              {/* Wick */}
              <line
                x1={x + candleWidth / 2}
                y1={yHigh}
                x2={x + candleWidth / 2}
                y2={yLow}
                stroke={color}
                strokeWidth={1.2}
              />
              {/* Candle Body */}
              <rect
                x={x}
                y={candleTop}
                width={candleWidth}
                height={candleHeight}
                fill={color}
                rx={0.5}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};
