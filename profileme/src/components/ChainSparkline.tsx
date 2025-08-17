"use client";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

export function ChainSparkline({
  color,
  series,
}: {
  color: string;
  series: Array<{ x: number; y: number }>;
}) {
  const data = series.map((p) => ({ x: p.x, y: p.y }));
  if (data.length === 0) return null;
  return (
    <div style={{ width: "100%", height: 60 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 6, left: 0, right: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.8} />
              <stop offset="100%" stopColor={color} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <Area dataKey="y" stroke={color} fill="url(#spark)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ChainSparkline;

