"use client";
import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Address } from "viem";

export default function HistoricalBalanceChart({ address, networkId = "mainnet" }: { address: Address; networkId?: string }) {
  const [data, setData] = useState<Array<{ date: string; value: number }>>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const url = `/api/thegraph/historical/balances/${address}?network_id=${encodeURIComponent(networkId)}&interval=daily&startTime=0&endTime=9999999999&limit=90&page=1`;
        const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
        if (!res.ok) {
          setData([]);
          return;
        }
        const json: any = await res.json().catch(() => null);
        const arr: any[] = Array.isArray(json?.data) ? json.data : [];
        const ethRows = arr.filter((it) => (it?.contract || "").toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
        const points = ethRows.map((it) => ({ date: String(it.datetime), value: typeof it.close === "number" ? it.close : 0 }));
        if (!cancelled) setData(points);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [address, networkId]);

  const hasData = useMemo(() => (data || []).length > 1, [data]);
  if (!hasData && !loading) return null;

  return (
    <div className="rounded-xl p-4 section elevated">
      <div className="text-xs opacity-70 mb-2">ETH Balance (daily)</div>
      <div style={{ width: "100%", height: 160 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <XAxis dataKey="date" hide tick={false} />
            <YAxis hide tick={false} domain={[0, 'dataMax']} />
            <Tooltip formatter={(v: number) => `${v.toFixed(6)} ETH`} labelFormatter={(l) => new Date(l).toLocaleDateString()} />
            <Line type="monotone" dataKey="value" stroke="#5b9dff" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

