"use client";
import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart } from "recharts";

type Props = {
  contract: string;
  networkId?: string; // default mainnet
  // Accept both friendly and API formats
  interval?: "hourly" | "4-hours" | "daily" | "weekly" | "1h" | "4h" | "1d" | "1w";
  title?: string;
};

type OhlcvPoint = {
  datetime: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
};

export default function TokenPriceChart({ contract, networkId = "mainnet", interval = "daily", title }: Props) {
  const [data, setData] = useState<Array<{ date: string; close: number; high: number; low: number; open: number; volume?: number }>>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const intervalMap: Record<string, "1h" | "4h" | "1d" | "1w"> = {
          hourly: "1h",
          "4-hours": "4h",
          daily: "1d",
          weekly: "1w",
          "1h": "1h",
          "4h": "4h",
          "1d": "1d",
          "1w": "1w",
        };
        const apiInterval = intervalMap[interval] ?? "1d";
        const params = new URLSearchParams({
          network_id: networkId,
          interval: apiInterval,
          startTime: "0",
          endTime: "9999999999",
          limit: "200",
          page: "1",
        });
        const url = `/api/thegraph/ohlc/prices/evm/${contract}?${params.toString()}`;
        const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setData([]);
          return;
        }
        const json: any = await res.json().catch(() => null);
        const arr: any[] = Array.isArray(json?.data) ? json.data : [];
        const points = arr.map((it: any): OhlcvPoint => ({
          datetime: String(it?.datetime ?? it?.time ?? ""),
          open: typeof it?.open === "number" ? it.open : undefined,
          high: typeof it?.high === "number" ? it.high : undefined,
          low: typeof it?.low === "number" ? it.low : undefined,
          close: typeof it?.close === "number" ? it.close : undefined,
          volume: typeof it?.volume === "number" ? it.volume : undefined,
        }));
        let cleaned = points
          .filter((p) => typeof p.close === "number" && Number.isFinite(p.close!))
          .map((p) => ({
            date: p.datetime,
            close: p.close as number,
            high: typeof p.high === "number" ? p.high : p.close as number,
            low: typeof p.low === "number" ? p.low : p.close as number,
            open: typeof p.open === "number" ? p.open : p.close as number,
            volume: p.volume,
          }));
        // Heuristic: Some price feeds return cents (x100). If values are very large, scale down by 100.
        const maxClose = cleaned.reduce((m, r) => (r.close > m ? r.close : m), 0);
        const scaleDiv = maxClose > 10000 ? 100 : 1;
        if (scaleDiv !== 1) {
          cleaned = cleaned.map((r) => ({
            ...r,
            close: r.close / scaleDiv,
            high: r.high / scaleDiv,
            low: r.low / scaleDiv,
            open: r.open / scaleDiv,
          }));
        }
        if (!cancelled) setData(cleaned);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [contract, networkId, interval]);

  const hasData = useMemo(() => (data || []).length > 1, [data]);
  if (!hasData && loading) {
    return (
      <div className="rounded-xl p-4 section elevated">
        <div className="text-xs opacity-70 mb-2">{title || "Token Price (close)"}</div>
        <div style={{ width: "100%", height: 160 }} className="skeleton" />
      </div>
    );
  }
  if (!hasData && !loading) return null;

  return (
    <div className="rounded-xl p-4 section elevated">
      <div className="text-xs opacity-70 mb-2">{title || "Token Price (close)"}</div>
      <div style={{ width: "100%", height: 160 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <XAxis dataKey="date" hide tick={false} />
            <YAxis hide tick={false} domain={["dataMin", "dataMax"]} />
            <Tooltip formatter={(v: number) => `$${(v as number).toFixed(4)}`} labelFormatter={(l) => new Date(l).toLocaleString()} />
            <Area type="monotone" dataKey="close" stroke="#7bd88f" fill="#7bd88f22" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

