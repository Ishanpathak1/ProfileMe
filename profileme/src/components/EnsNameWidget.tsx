"use client";
import { useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";
import { useAccount, useChainId, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { Address } from "viem";
import { getPrimaryNameForAddress, sanitizeLabel, l2IsAvailable, DEFAULT_L2_REGISTRAR_ADDRESS, getSafeOwnerAddress, isAcceptableLabel } from "@/lib/ens";
import { useAuthStore } from "@/store/auth";

type Suggestion = { label: string; fqdn: string; available: boolean };

export default function EnsNameWidget() {
  const { isSoundVerified } = useAuthStore();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { chains, switchChainAsync } = useSwitchChain();
  const { writeContractAsync, data: txHash } = useWriteContract();
  const { isLoading: isMining, isSuccess: isMined } = useWaitForTransactionReceipt({ hash: txHash });
  const [primary, setPrimary] = useState<string | null>(null);
  const [loadingPrimary, setLoadingPrimary] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [registeredLabel, setRegisteredLabel] = useState<string | null>(null);
  const DISPLAY_ROOT = process.env.NEXT_PUBLIC_ENS_DISPLAY_ROOT || "profile.eth";
  const [reservedLabels, setReservedLabels] = useState<string[]>([]);

  // Load locally reserved labels (labels user has registered before) so we never suggest them again
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("reservedEnsLabels") : null;
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setReservedLabels(arr.filter((x) => typeof x === "string"));
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (isMined) {
      setBusy("");
      if (pendingLabel) {
        setRegisteredLabel(pendingLabel);
        setPendingLabel(null);
        // Persist to local reserved list to avoid suggesting again
        try {
          const clean = sanitizeLabel(pendingLabel);
          setReservedLabels((prev) => {
            const next = Array.from(new Set([...
prev, clean]));
            try { localStorage.setItem("reservedEnsLabels", JSON.stringify(next)); } catch {}
            return next;
          });
        } catch {}
      }
      try {
        const originX = 0.5;
        const originY = 0.3;
        confetti({
          particleCount: 120,
          spread: 70,
          startVelocity: 45,
          ticks: 250,
          origin: { x: originX, y: originY },
          colors: ["#37FF8B", "#2ee57c", "#25cc6f", "#e6e9ef"],
        });
        setTimeout(() => {
          confetti({
            particleCount: 90,
            angle: 120,
            spread: 60,
            startVelocity: 35,
            origin: { x: 0.2, y: 0.35 },
            colors: ["#37FF8B", "#e6e9ef"],
          });
          confetti({
            particleCount: 90,
            angle: 60,
            spread: 60,
            startVelocity: 35,
            origin: { x: 0.8, y: 0.35 },
            colors: ["#37FF8B", "#e6e9ef"],
          });
        }, 200);
      } catch {}
    }
  }, [isMined]);

  useEffect(() => {
    if (!isSoundVerified || !isConnected || !address) {
      setPrimary(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingPrimary(true);
      const name = await getPrimaryNameForAddress(address);
      if (!cancelled) setPrimary(name);
      setLoadingPrimary(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [address, isConnected, isSoundVerified]);

  const hasPrimary = Boolean(primary);

  const canSuggest = useMemo(() => Boolean(isSoundVerified && isConnected && address && !loadingSuggest), [isSoundVerified, isConnected, address, loadingSuggest]);
  const canRegister = useMemo(() => Boolean(isSoundVerified && isConnected && address && !busy && !isMining), [isSoundVerified, isConnected, address, busy, isMining]);
  const isLabelAcceptable = useMemo(() => {
    const clean = sanitizeLabel(selectedLabel).slice(0, 16);
    return Boolean(clean) && isAcceptableLabel(clean);
  }, [selectedLabel]);

  async function getSummaryForAddress(): Promise<string> {
    if (!address) return "";
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        cache: "no-store",
        body: JSON.stringify({ address }),
      });
      const json = await res.json().catch(() => ({} as any));
      return typeof json?.summary === "string" ? json.summary : "";
    } catch {
      return "";
    }
  }

  async function generateSuggestion() {
    if (!isSoundVerified || !canSuggest || !address) return;
    setLoadingSuggest(true);
    try {
      setBusy("Summarizing wallet…");
      const summary = await getSummaryForAddress();
      setBusy("Generating name…");
      const res = await fetch("/api/ens-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, context: summary }),
      });
      const data = (await res.json()) as { suggestions: Suggestion[] };
      const list = data.suggestions || [];
      // Filter out any labels we've already registered locally
      const blocked = new Set(reservedLabels.map((x) => sanitizeLabel(x)));
      const filtered = list.filter((s) => !blocked.has(sanitizeLabel(s.label)));
      setSuggestions(filtered);
      const firstAvailable = filtered.find((s) => s.available);
      if (firstAvailable?.label) {
        setSelectedLabel(firstAvailable.label);
      } else if (filtered[0]?.label) {
        setSelectedLabel(filtered[0].label);
      } else {
        throw new Error("No available suggestions");
      }
      setError("");
    } catch (e: unknown) {
      const err = e as Error | { message?: string } | undefined;
      const msg = (err && ("message" in err) ? (err as { message?: string }).message : undefined) || "Failed to generate name";
      setError(msg);
    } finally {
      setBusy("");
      setLoadingSuggest(false);
    }
  }

  async function ensureBaseSepolia() {
    const target = chains.find((c) => c.id === 84532);
    if (!target) return;
    if (chainId !== target.id) {
      await switchChainAsync({ chainId: target.id });
    }
  }

  async function registerOnL2(label: string) {
    try {
      setError("");
      const clean = sanitizeLabel(label).slice(0, 16);
      if (!clean) throw new Error("Invalid label");
      if (!isAcceptableLabel(clean)) throw new Error("Please choose a more unique, non-generic name");
      setBusy(`Checking availability for ${clean}…`);
      const owner: Address | null = getSafeOwnerAddress(address);
      if (!owner) throw new Error("Invalid wallet address");
      const ok = await l2IsAvailable(clean).catch(() => false);
      if (!ok) throw new Error("Label not available on L2");

      setBusy("Switching to Base Sepolia…");
      await ensureBaseSepolia();

      setBusy("Submitting transaction…");
      setPendingLabel(clean);
      const hash = await writeContractAsync({
        abi: [
          { inputs: [{ name: "label", type: "string" }, { name: "owner", type: "address" }], name: "register", outputs: [], stateMutability: "nonpayable", type: "function" },
        ] as const,
        address: DEFAULT_L2_REGISTRAR_ADDRESS,
        functionName: "register",
        args: [clean, owner],
        chainId: 84532,
      });
      if (!hash) throw new Error("Failed to send tx");
      setBusy("Waiting for confirmation…");
    } catch (e: unknown) {
      const err = e as Error | { message?: string } | undefined;
      setBusy("");
      const msg = (err && ("message" in err) ? (err as { message?: string }).message : undefined) || "Registration failed";
      setError(msg);
    }
  }

  // Auto-generate a suggestion when user connects or address changes
  useEffect(() => {
    if (isSoundVerified && isConnected && address && !selectedLabel && !loadingSuggest) {
      void generateSuggestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSoundVerified, isConnected, address]);

  if (!isSoundVerified) return null;

  return (
    <div className="elevated section" style={{ marginTop: 12, borderRadius: 14, padding: 16 }}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className="m-0 section-title" style={{ fontSize: 16 }}>ENS</h4>
          <div className="text-sm muted">Primary name and quick suggestions</div>
        </div>
        {loadingPrimary ? (
          <span className="text-sm muted">Resolving…</span>
        ) : hasPrimary ? (
          <span className="badge" style={{ background: "rgba(var(--accent-rgb), 0.14)", color: "var(--accent)", padding: "6px 10px", border: "1px solid rgba(var(--accent-rgb), 0.35)" }}>{primary}</span>
        ) : (
          <span className="text-sm muted">No primary name</span>
        )}
      </div>

      <div className="mt-3" />
      <div className="flex items-center gap-2" style={{ marginTop: 6 }}>
        <input
          className="input input-sm"
          placeholder="your-name"
          value={selectedLabel}
          onChange={(e) => setSelectedLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 16))}
        />
        <button
          className="btn btn-sm btn-outline-primary"
          disabled={!canSuggest}
          onClick={() => void generateSuggestion()}
        >
          {loadingSuggest ? "Generating…" : "Suggest"}
        </button>
        <button
          className="btn btn-sm btn-primary"
          disabled={!canRegister || !selectedLabel || !isLabelAcceptable}
          onClick={() => void registerOnL2(selectedLabel)}
        >
          {isMining ? "Confirming…" : busy ? busy : "Register"}
        </button>
      </div>
      {!isLabelAcceptable && selectedLabel && (
        <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>Pick a more unique pseudoword. Avoid common words or character/brand names.</div>
      )}

      {(error || isMined) && (
        <div className="mt-2 text-sm">
          {error ? <div className="text-danger">{error}</div> : null}
          {isMined ? (
            <div className="elevated" style={{ padding: 12, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, color: "var(--accent)" }}>Success!</div>
                <div className="muted">Your subdomain has been registered on L2. It may take a moment to propagate.</div>
                {registeredLabel ? (
                  <div style={{ marginTop: 8 }}>
                    <span className="badge" style={{ backgroundColor: "rgba(var(--accent-rgb), 0.14)", color: "var(--accent)", border: "1px solid rgba(var(--accent-rgb), 0.35)", padding: "6px 10px" }}>
                      {registeredLabel}.{DISPLAY_ROOT}
                    </span>
                  </div>
                ) : null}
              </div>
              <span className="badge" style={{ backgroundColor: "rgba(var(--accent-rgb), 0.14)", color: "var(--accent)", border: "1px solid rgba(var(--accent-rgb), 0.35)", padding: "6px 10px" }}>🎉</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

