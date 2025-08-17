"use client";
import { useMemo } from "react";
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from "recharts";

type Slice = { name: string; value: number; color: string };

export function PortfolioOverview({
  totalsByChain,
  height = 180,
}: {
  totalsByChain: Array<{ chainName: string; usdTotal: number; color: string }>;
  height?: number;
}) {
  const data: Slice[] = useMemo(
    () =>
      totalsByChain
        .filter((t) => t.usdTotal > 0)
        .map((t) => ({ name: t.chainName, value: t.usdTotal, color: t.color })),
    [totalsByChain]
  );

  if (data.length === 0) return null;

  return (
    <div className="rounded-xl p-5 elevated section">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs opacity-70">Overview</div>
          <div className="text-lg font-semibold">Portfolio Allocation</div>
        </div>
      </div>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <PieChart>
            {(() => {
              const innerR = Math.max(24, Math.floor(height * 0.28));
              const outerR = Math.max(innerR + 12, Math.floor(height * 0.42));
              return (
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={innerR}
                  outerRadius={outerR}
                  paddingAngle={1}
                >
                  {data.map((entry, index) => (
                    <Cell key={`slice-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              );
            })()}
            <Tooltip formatter={(v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default PortfolioOverview;

