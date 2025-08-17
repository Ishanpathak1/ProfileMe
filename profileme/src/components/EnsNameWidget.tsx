"use client";
import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { Address } from "viem";
import { getPrimaryNameForAddress, sanitizeLabel, l2IsAvailable, DEFAULT_L2_REGISTRAR_ADDRESS, getSafeOwnerAddress, isAcceptableLabel } from "@/lib/ens";

type Suggestion = { label: string; fqdn: string; available: boolean };

export default function EnsNameWidget() {
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

  useEffect(() => {
    if (isMined) {
      setBusy("");
    }
  }, [isMined]);

  useEffect(() => {
    if (!isConnected || !address) {
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
  }, [address, isConnected]);

  const hasPrimary = Boolean(primary);

  const canSuggest = useMemo(() => Boolean(isConnected && address && !loadingSuggest), [isConnected, address, loadingSuggest]);
  const canRegister = useMemo(() => Boolean(isConnected && address && !busy && !isMining), [isConnected, address, busy, isMining]);
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
    if (!canSuggest || !address) return;
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
      setSuggestions(list);
      const firstAvailable = list.find((s) => s.available);
      if (firstAvailable?.label) {
        setSelectedLabel(firstAvailable.label);
      } else if (list[0]?.label) {
        setSelectedLabel(list[0].label);
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
    if (isConnected && address && !selectedLabel && !loadingSuggest) {
      void generateSuggestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address]);

  return (
    <div className="section" style={{ marginTop: 12 }}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className="m-0" style={{ fontSize: 16 }}>ENS</h4>
          <div className="text-sm muted">Your wallet&apos;s primary name and available suggestions.</div>
        </div>
        {loadingPrimary ? (
          <span className="text-sm">Resolving…</span>
        ) : hasPrimary ? (
          <span className="badge">{primary}</span>
        ) : (
          <span className="text-sm">No primary name</span>
        )}
      </div>

      <div className="mt-3" />
      <div className="flex items-center gap-2">
        <input
          className="input input-sm"
          placeholder="your-name"
          value={selectedLabel}
          onChange={(e) => setSelectedLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 16))}
        />
        <button
          className="btn btn-sm"
          disabled={!canSuggest}
          onClick={() => void generateSuggestion()}
        >
          {loadingSuggest ? "Generating…" : "Suggest name"}
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
        <div className="mt-1 text-xs muted">Pick a more unique pseudoword. Avoid common words or character/brand names.</div>
      )}

      {/* Suggestions are kept in state for possible display/debug, but not shown in the simplified flow */}
      {(error || isMined) && (
        <div className="mt-2 text-sm">
          {error ? <div className="text-danger">{error}</div> : null}
          {isMined ? <div className="text-success">Registration confirmed on L2.</div> : null}
        </div>
      )}
    </div>
  );
}

