"use client";
import { useEffect, useMemo, useState } from "react";

export default function NftActivityList({ networkId = "mainnet" }: { networkId?: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const url = `/api/thegraph/nft/activities?network_id=${encodeURIComponent(networkId)}&startTime=0&endTime=9999999999&orderBy=timestamp&orderDirection=desc&limit=10&page=1`;
        const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
        if (!res.ok) { setItems([]); return; }
        const json: any = await res.json().catch(() => null);
        const arr: any[] = Array.isArray(json?.data) ? json.data : [];
        if (!cancelled) setItems(arr);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [networkId]);

  const trimmed = useMemo(() => (items || []).slice(0, 6), [items]);
  if (trimmed.length === 0 && !loading) return null;

  return (
    <div className="rounded-xl p-4 section elevated">
      <div className="text-xs opacity-70 mb-2">Recent NFT Activity (mainnet)</div>
      <div className="space-y-2">
        {trimmed.map((it, idx) => {
          const type = String(it["@type"] || it.type || "");
          const when = it.timestamp ? new Date(it.timestamp.replace(" ", "T") + "Z").toLocaleString() : "";
          const short = (s: string) => (s && s.length > 10 ? `${s.slice(0,6)}…${s.slice(-4)}` : s);
          return (
            <div key={idx} className="text-xs flex items-center justify-between">
              <span className="opacity-70 mr-2">{when}</span>
              <span className="font-semibold mr-2">{type}</span>
              <span className="font-mono mr-2">{short(it.contract || "")}</span>
              {it.token_id ? <span className="opacity-80">#{String(it.token_id)}</span> : null}
            </div>
          );
        })}
        {loading ? <div className="text-xs opacity-70">Loading…</div> : null}
      </div>
    </div>
  );
}

