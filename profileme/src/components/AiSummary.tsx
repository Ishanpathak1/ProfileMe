"use client";
import { useEffect, useMemo, useState } from "react";

export default function AiSummary({ address }: { address?: string }) {
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [requestKey, setRequestKey] = useState<number>(0);
  const hasAddress = useMemo(() => typeof address === "string" && address.length > 0, [address]);

  const funFacts = useMemo(() => {
    const addr = address || "";
    if (!addr || !/^0x[0-9a-fA-F]{4,}$/.test(addr)) return [] as string[];
    const hex = addr.replace(/^0x/i, "");
    const lower = hex.toLowerCase();

    const countOccurrences = (s: string, re: RegExp) => (s.match(re) || []).length;
    const countZeros = countOccurrences(lower, /0/g);
    const leadingZeros = (lower.match(/^0+/)?.[0].length || 0);
    const trailingZeros = (lower.match(/0+$/)?.[0].length || 0);
    let maxZeroStreak = 0, current = 0;
    for (const ch of lower) {
      if (ch === "0") { current++; maxZeroStreak = Math.max(maxZeroStreak, current); } else { current = 0; }
    }

    let longestRun = 1, runChar = lower[0] || "";
    current = 1;
    for (let i = 1; i < lower.length; i++) {
      if (lower[i] === lower[i - 1]) { current++; if (current > longestRun) { longestRun = current; runChar = lower[i]; } }
      else { current = 1; }
    }

    const uniqueChars = new Set(lower.split("")).size;
    const caps = countOccurrences(addr.slice(2), /[A-F]/g);

    const words = ["dead", "beef", "cafe", "babe", "face", "fade", "feed", "f00d", "c0de", "c0ffee"];
    const spotted = words.filter((w) => lower.includes(w));

    const freq: Record<string, number> = {};
    for (const ch of lower) freq[ch] = (freq[ch] || 0) + 1;
    const len = lower.length;
    const entropy = Object.values(freq).reduce((h, n) => {
      const p = n / len; return h - p * Math.log2(p);
    }, 0);

    const facts: string[] = [];
    facts.push(`Zeros: ${countZeros} total (longest streak ${maxZeroStreak}${leadingZeros || trailingZeros ? `, ${leadingZeros} leading / ${trailingZeros} trailing` : ""}).`);
    facts.push(`Unique hex symbols: ${uniqueChars}/16; longest same-character run: ${longestRun}${runChar ? ` ('${runChar}')` : ""}.`);
    facts.push(`Checksum spice: ${caps} uppercase A–F letters.`);
    facts.push(`Entropy: ${entropy.toFixed(2)} bits/char — ${entropy > 3.6 ? "pretty random" : entropy > 3.0 ? "mixed" : "quite patterned"}.`);
    if (spotted.length > 0) facts.push(`Easter eggs spotted: ${spotted.join(", ")}.`);
    return facts;
  }, [address]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!hasAddress) return;
      setLoading(true);
      try {
        try { console.debug("[AiSummary] POST /api/summary start", { address }); } catch {}
        const res = await fetch("/api/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          cache: "no-store",
          body: JSON.stringify({ address }),
        });
        const json = await res.json().catch(() => ({}));
        const serverText = typeof json?.summary === "string" ? json.summary : "";
        if (!cancelled) {
          setError(res.ok ? "" : (typeof json?.error === "string" ? json.error : `Request failed (${res.status})`));
          setText(serverText);
        }
        try { console.debug("[AiSummary] POST /api/summary done", { ok: res.ok, status: res.status, hasText: !!serverText }); } catch {}
      } catch {
        if (!cancelled) { setText(""); setError("Network error while fetching summary"); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [hasAddress, address, requestKey]);

  return (
    <div className="rounded-xl p-5 elevated section">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-xs opacity-70">AI Insight</div>
          <div className="text-lg font-semibold">Your Multi-Chain Vibe Check</div>
        </div>
      </div>
      <div className="text-sm" style={{ minHeight: 40 }}>
        {!hasAddress && <span className="opacity-70">Connect a wallet to generate your summary.</span>}
        {loading && (
          <div>
            <div className="opacity-70 text-xs mb-1">Fetching your AI summary — meanwhile, some address fun facts:</div>
            <ul className="list-disc list-inside m-0 p-0" style={{ lineHeight: 1.5 }}>
              {funFacts.slice(0, 4).map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        )}
        {!loading && text && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{text}</p>}
        {!loading && hasAddress && !text && (
          <div>
            <div className="opacity-70 text-xs mb-1">Summary unavailable right now{error ? ` — ${error}` : ""}. Here are some address fun facts:</div>
            <ul className="list-disc list-inside m-0 p-0" style={{ lineHeight: 1.5 }}>
              {funFacts.slice(0, 4).map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
            <button className="mt-2 text-xs underline" onClick={() => setRequestKey((k) => k + 1)}>Try again</button>
          </div>
        )}
      </div>
    </div>
  );
}

