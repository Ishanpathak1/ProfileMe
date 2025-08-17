"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { zircuitGarfield } from "@/lib/wagmi";
import { soundRegistryAbi, soundRegistryAddress } from "./abi";
import toast from "react-hot-toast";
import { useAuthStore } from "@/store/auth";

async function playFromHash(hash: string): Promise<void> {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  try {
    const gain = ctx.createGain();
    gain.gain.value = 0.08;
    gain.connect(ctx.destination);

    const bytes = Array.from(new Uint8Array(
      hash.startsWith("0x")
        ? [...hash.slice(2)].reduce((acc: number[], _, i, arr) => {
            if (i % 2 === 0) acc.push(parseInt(arr[i] + arr[i + 1], 16));
            return acc;
          }, [])
        : []
    ));

    // Fallback if parsing fails
    const vals = bytes.length ? bytes : [100, 150, 200, 250, 50, 80];

    const tones = 4;
    const now = ctx.currentTime;
    for (let i = 0; i < tones; i++) {
      const v = vals[i] ?? (50 * (i + 1));
      const freq = 220 + (v % 48) * 20; // 220Hz → ~1180Hz
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      const start = now + i * 0.25;
      const end = start + 0.22;
      osc.start(start);
      osc.stop(end);
    }
    // Let the last tone finish
    await new Promise((r) => setTimeout(r, (tones * 250) + 50));
  } finally {
    try { await ctx.close(); } catch {}
  }
}

export default function SoundLoginCard() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { isSoundVerified, setSoundVerified } = useAuthStore();

  const [isPlaying, setIsPlaying] = useState(false);

  const canUseFeature = isConnected && chainId === zircuitGarfield.id && !!soundRegistryAddress;

  const { data: onchainHash, refetch } = useReadContract({
    address: soundRegistryAddress,
    abi: soundRegistryAbi,
    functionName: "soundHashOf",
    args: address ? [address] : undefined,
    chainId: zircuitGarfield.id,
    query: { enabled: Boolean(address && soundRegistryAddress) },
  });

  const handleVerify = useCallback(async () => {
    if (!isConnected) {
      toast.error("Connect your wallet first");
      return;
    }
    if (chainId !== zircuitGarfield.id) {
      toast.error("Switch to Zircuit Garfield");
      return;
    }
    if (!soundRegistryAddress) {
      toast.error("Registry not configured");
      return;
    }
    try {
      setIsPlaying(true);
      const { data: chainHash } = await refetch();
      if (!chainHash || chainHash === "0x0000000000000000000000000000000000000000000000000000000000000000") {
        toast.error("No hash set for this wallet");
        return;
      }
      await playFromHash(chainHash as string);
      setSoundVerified(true);
      toast.success("Sound played — verified");
    } catch {
      toast.error("Playback failed");
    } finally {
      setIsPlaying(false);
    }
  }, [chainId, isConnected, refetch, setSoundVerified]);

  const [devBypass, setDevBypass] = useState<string | null>(null);
  useEffect(() => {
    try { setDevBypass(typeof window !== "undefined" ? localStorage.getItem("devBypassSound") : null); } catch { setDevBypass(null); }
  }, []);

  return (
    <div
      className="section"
      style={{
        background: "#0d1117",
        border: "1px solid #1f2a37",
        borderRadius: 12,
        padding: 16,
        color: "#d1d5db",
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <h4 className="m-0" style={{ fontSize: 16, fontWeight: 600, color: "#e5e7eb" }}>Sound Login</h4>
        {isSoundVerified && <span style={{ color: "#34d399", fontWeight: 600 }}>✅ Sound verified</span>}
      </div>
      {process.env.NODE_ENV !== "production" && devBypass !== null && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>Dev bypass is {devBypass === "true" ? "ON" : "OFF"}</span>
          <button
            onClick={() => {
              const next = devBypass === "true" ? "false" : "true";
              try { localStorage.setItem("devBypassSound", next); } catch {}
              setDevBypass(next);
              setSoundVerified(next === "true");
            }}
            style={{
              background: "#374151",
              color: "#e5e7eb",
              border: 0,
              borderRadius: 6,
              padding: "4px 8px",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Toggle bypass
          </button>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={handleVerify}
          disabled={!canUseFeature || isPlaying}
          style={{
            background: isPlaying ? "#374151" : "#1f6feb",
            color: "#0b1020",
            border: 0,
            borderRadius: 8,
            padding: "10px 14px",
            cursor: !canUseFeature || isPlaying ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
          title={!isConnected ? "Connect wallet" : chainId !== zircuitGarfield.id ? "Switch to Zircuit Garfield" : "🎤 Verify with sound"}
        >
          {isPlaying ? "Playing…" : "🔊 Play & verify"}
        </button>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          {!isConnected && <span>Connect wallet to verify</span>}
          {isConnected && chainId !== zircuitGarfield.id && <span>Switch to Zircuit Garfield</span>}
          {isConnected && chainId === zircuitGarfield.id && !soundRegistryAddress && <span>Set NEXT_PUBLIC_SOUND_REGISTRY</span>}
        </div>
      </div>
      {onchainHash && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#9ca3af" }}>
          On-chain hash: <span style={{ color: "#93c5fd", fontFamily: "var(--font-mono)" }}>{String(onchainHash).slice(0, 10)}…</span>
        </div>
      )}
    </div>
  );
}



