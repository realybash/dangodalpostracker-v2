/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Transaction, ProviderType } from '../types';
import { formatNaira, getTxEffectiveDate } from '../utils';
import { TrendingUp, Calendar } from 'lucide-react';

interface TrendChartProps {
  transactions: Transaction[];
  terminalFeeRate: number;
  chartStyle?: 'line' | 'bar' | 'area';
}

export function TrendChart({ transactions, chartStyle = 'line' }: TrendChartProps) {
  const [daysCount, setDaysCount] = useState<7 | 15>(7);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Dynamic daily aggregation
  const trendData = useMemo(() => {
    const dates: { label: string; key: string }[] = [];
    const now = new Date();
    
    // Generate buckets for the last X days (in chronological order for line charts)
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dateVal = String(d.getDate()).padStart(2, '0');
      const key = `${year}-${month}-${dateVal}`;
      
      dates.push({ label, key });
    }

    const trendMap = new Map<string, Record<ProviderType, number>>();
    dates.forEach(d => {
      trendMap.set(d.key, { OPay: 0, Moniepoint: 0, PalmPay: 0 });
    });

    // Group profits based on active transaction effective dates (approval date if approved)
    transactions.forEach(tx => {
      const txDate = getTxEffectiveDate(tx);
        
      const year = txDate.getFullYear();
      const month = String(txDate.getMonth() + 1).padStart(2, '0');
      const dateVal = String(txDate.getDate()).padStart(2, '0');
      const key = `${year}-${month}-${dateVal}`;

      if (trendMap.has(key)) {
        const bucket = trendMap.get(key)!;
        bucket[tx.provider] += tx.profit;
      }
    });

    return dates.map(d => {
      const bucket = trendMap.get(d.key)!;
      return {
        date: d.label,
        OPay: Number(bucket.OPay.toFixed(2)),
        Moniepoint: Number(bucket.Moniepoint.toFixed(2)),
        PalmPay: Number(bucket.PalmPay.toFixed(2)),
        Total: Number((bucket.OPay + bucket.Moniepoint + bucket.PalmPay).toFixed(2))
      };
    });
  }, [transactions, daysCount]);

  // Insights computation
  const insights = useMemo(() => {
    let maxDayProfit = 0;
    let maxDayLabel = 'N/A';
    let totalPeriodProfit = 0;
    
    let opaySum = 0;
    let moniepointSum = 0;
    let palmpaySum = 0;

    trendData.forEach(d => {
      const dayTotal = d.OPay + d.Moniepoint + d.PalmPay;
      totalPeriodProfit += dayTotal;
      opaySum += d.OPay;
      moniepointSum += d.Moniepoint;
      palmpaySum += d.PalmPay;

      if (dayTotal > maxDayProfit) {
        maxDayProfit = dayTotal;
        maxDayLabel = d.date;
      }
    });

    let topProviderName = 'Moniepoint';
    let topProviderShare = moniepointSum;

    if (opaySum > topProviderShare) {
      topProviderName = 'OPay';
      topProviderShare = opaySum;
    }
    if (palmpaySum > topProviderShare) {
      topProviderName = 'PalmPay';
      topProviderShare = palmpaySum;
    }

    return {
      maxDayProfit,
      maxDayLabel,
      totalPeriodProfit,
      topProviderName,
      topProviderShare
    };
  }, [trendData]);

  // Native SVG Chart rendering calculations
  const maxValue = useMemo(() => {
    let max = 100;
    trendData.forEach(d => {
      max = Math.max(max, d.OPay, d.Moniepoint, d.PalmPay, d.Total);
    });
    return max * 1.1; // Add headroom
  }, [trendData]);

  const chartHeight = 220;
  const chartWidth = 600;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const getX = (index: number) => {
    if (trendData.length <= 1) return padding.left;
    return padding.left + (index / (trendData.length - 1)) * innerWidth;
  };

  const getY = (val: number) => {
    return padding.top + innerHeight - (val / maxValue) * innerHeight;
  };

  const makeLinePath = (key: 'OPay' | 'Moniepoint' | 'PalmPay' | 'Total') => {
    return trendData
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d[key])}`)
      .join(' ');
  };

  const makeAreaPath = (key: 'OPay' | 'Moniepoint' | 'PalmPay') => {
    const line = makeLinePath(key);
    const lastX = getX(trendData.length - 1);
    const firstX = getX(0);
    const bottomY = getY(0);
    return `${line} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  };

  const activeData = hoveredIndex !== null ? trendData[hoveredIndex] : null;

  return (
    <div className="bg-white border border-neutral-200 rounded-3xl p-5 space-y-5 shadow-sm">
      
      {/* Chart toolbar header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-base font-extrabold text-neutral-800 tracking-tight flex items-center gap-1.5 mt-1">
            <TrendingUp className="w-4.5 h-4.5 text-[#00B87A]" /> Channel Commission Daily Trends
          </h3>
          <p className="text-xs text-neutral-500 mt-1 font-medium">
            Timeline analytics contrasting positive yields in chronological order.
          </p>
        </div>

        {/* Dynamic Selectors */}
        <div className="flex items-center bg-neutral-100 rounded-xl p-1 border border-neutral-200">
          <button
            type="button"
            onClick={() => setDaysCount(7)}
            className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg transition cursor-pointer ${
              daysCount === 7 
                ? 'bg-[#00B87A] text-white shadow-sm' 
                : 'text-neutral-500 hover:text-[#00B87A]'
            }`}
          >
            7 Days
          </button>
          <button
            type="button"
            onClick={() => setDaysCount(15)}
            className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg transition cursor-pointer ${
              daysCount === 15 
                ? 'bg-[#00B87A] text-white shadow-sm' 
                : 'text-neutral-500 hover:text-[#00B87A]'
            }`}
          >
            15 Days
          </button>
        </div>
      </div>

      {/* Grid of highlights & quick summaries */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-2xl space-y-1 shadow-sm">
          <span className="text-[9px] text-neutral-450 font-mono uppercase tracking-widest block font-bold">Period Combined Yield</span>
          <div className="text-lg font-black font-mono text-[#00B87A]">
            {formatNaira(insights.totalPeriodProfit)}
          </div>
          <span className="text-[10px] text-neutral-500 font-medium block">Aggregated profit return</span>
        </div>

        <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-2xl space-y-1 shadow-sm">
          <span className="text-[9px] text-neutral-450 font-mono uppercase tracking-widest block font-bold">Top Performing Operator</span>
          <div className="text-lg font-black font-mono text-neutral-800 flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${
              insights.topProviderName === 'OPay' 
                ? 'bg-[#00B87A]' 
                : insights.topProviderName === 'Moniepoint' 
                ? 'bg-blue-500' 
                : insights.topProviderName === 'PalmPay'
                ? 'bg-orange-500'
                : 'bg-neutral-400'
            }`} />
            {insights.topProviderName}
          </div>
          <span className="text-[10px] text-emerald-600 font-bold block">
            ₦{insights.topProviderShare.toFixed(2)} contribution
          </span>
        </div>

        <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-2xl space-y-1 shadow-sm">
          <span className="text-[9px] text-neutral-450 font-mono uppercase tracking-widest block font-bold">Timeline Record Spike</span>
          <div className="text-lg font-black font-mono text-neutral-800">
            {insights.maxDayLabel}
          </div>
          <span className="text-[10px] text-amber-600 font-bold block">
            Peak Day Profit: {formatNaira(insights.maxDayProfit)}
          </span>
        </div>
      </div>

      {/* High-Performance Native SVG Visualization */}
      <div className="relative w-full pt-2">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto overflow-visible select-none"
        >
          {/* Grid lines & Y Axis */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const val = maxValue * pct;
            const y = getY(val);
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={chartWidth - padding.right}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeDasharray="3 3"
                />
                <text
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-neutral-400 font-mono text-[9px]"
                >
                  ₦{Math.round(val)}
                </text>
              </g>
            );
          })}

          {/* X Axis labels */}
          {trendData.map((d, i) => (
            <text
              key={i}
              x={getX(i)}
              y={chartHeight - 12}
              textAnchor="middle"
              className="fill-neutral-400 font-mono text-[9px]"
            >
              {d.date}
            </text>
          ))}

          {/* Area / Bar / Line Chart options */}
          {chartStyle === 'area' && (
            <>
              <path d={makeAreaPath('OPay')} fill="#00B87A" fillOpacity={0.15} />
              <path d={makeAreaPath('Moniepoint')} fill="#3b82f6" fillOpacity={0.15} />
              <path d={makeAreaPath('PalmPay')} fill="#f97316" fillOpacity={0.15} />
            </>
          )}

          {chartStyle === 'bar' ? (
            trendData.map((d, i) => {
              const groupWidth = (innerWidth / trendData.length) * 0.7;
              const barW = groupWidth / 3;
              const startX = getX(i) - groupWidth / 2;
              return (
                <g key={i}>
                  <rect
                    x={startX}
                    y={getY(d.OPay)}
                    width={barW - 1}
                    height={getY(0) - getY(d.OPay)}
                    fill="#00B87A"
                    rx={2}
                  />
                  <rect
                    x={startX + barW}
                    y={getY(d.Moniepoint)}
                    width={barW - 1}
                    height={getY(0) - getY(d.Moniepoint)}
                    fill="#3b82f6"
                    rx={2}
                  />
                  <rect
                    x={startX + barW * 2}
                    y={getY(d.PalmPay)}
                    width={barW - 1}
                    height={getY(0) - getY(d.PalmPay)}
                    fill="#f97316"
                    rx={2}
                  />
                </g>
              );
            })
          ) : (
            <>
              <path d={makeLinePath('OPay')} fill="none" stroke="#00B87A" strokeWidth={3} />
              <path d={makeLinePath('Moniepoint')} fill="none" stroke="#3b82f6" strokeWidth={3} />
              <path d={makeLinePath('PalmPay')} fill="none" stroke="#f97316" strokeWidth={3} />
              <path d={makeLinePath('Total')} fill="none" stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="4 4" />
            </>
          )}

          {/* Hover interactive overlay */}
          {trendData.map((d, i) => (
            <rect
              key={i}
              x={getX(i) - innerWidth / (trendData.length * 2)}
              y={padding.top}
              width={innerWidth / trendData.length}
              height={innerHeight}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          ))}

          {/* Hover dots */}
          {hoveredIndex !== null && (
            <g>
              <line
                x1={getX(hoveredIndex)}
                y1={padding.top}
                x2={getX(hoveredIndex)}
                y2={chartHeight - padding.bottom}
                stroke="#6b7280"
                strokeDasharray="2 2"
              />
              <circle cx={getX(hoveredIndex)} cy={getY(trendData[hoveredIndex].OPay)} r={5} fill="#00B87A" />
              <circle cx={getX(hoveredIndex)} cy={getY(trendData[hoveredIndex].Moniepoint)} r={5} fill="#3b82f6" />
              <circle cx={getX(hoveredIndex)} cy={getY(trendData[hoveredIndex].PalmPay)} r={5} fill="#f97316" />
            </g>
          )}
        </svg>

        {/* Hover Tooltip Popup */}
        {activeData && (
          <div 
            className="absolute top-2 left-1/2 -translate-x-1/2 bg-neutral-900 text-white p-3 rounded-2xl shadow-xl font-mono text-xs space-y-1.5 select-none border border-neutral-800 z-10 pointer-events-none"
          >
            <p className="text-neutral-300 font-bold border-b border-neutral-800 pb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-500" /> {activeData.date}
            </p>
            <div className="flex justify-between gap-4">
              <span className="text-emerald-400">OPay:</span>
              <span className="font-bold">{formatNaira(activeData.OPay)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-blue-400">Moniepoint:</span>
              <span className="font-bold">{formatNaira(activeData.Moniepoint)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-orange-400">PalmPay:</span>
              <span className="font-bold">{formatNaira(activeData.PalmPay)}</span>
            </div>
            <div className="flex justify-between gap-4 border-t border-neutral-800 pt-1">
              <span className="text-purple-400">Total:</span>
              <span className="font-bold">{formatNaira(activeData.Total)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center items-center gap-4 text-xs font-mono text-neutral-600 pt-1">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#00B87A]" /> OPay Channel
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Moniepoint Blue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> PalmPay Channels
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Combined Net Profit
        </span>
      </div>

    </div>
  );
}
