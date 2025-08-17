"use client";

import { useCallback, useState } from "react";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { zircuitGarfield } from "@/lib/wagmi";
import { soundRegistryAbi, soundRegistryAddress } from "./abi";
import toast from "react-hot-toast";

async function playFromHash(hash: string): Promise<void> {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  try {
    // Ensure the context is active (iOS/Safari often starts suspended until user gesture)
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    const master = ctx.createGain();
    master.gain.value = 0.6; // boost volume for noisy environments
    master.connect(ctx.destination);

    const hex = hash.startsWith("0x") ? hash.slice(2) : hash;
    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      const pair = hex.slice(i, i + 2);
      if (pair.length === 2) bytes.push(parseInt(pair, 16));
    }
    const vals = bytes.length ? bytes : [0x2, 0x3, 0x0, 0x4];

    // High-frequency carriers tuned for mobile mics: 16 bins from 12kHz to 15kHz in 200Hz steps
    const carriers: number[] = Array.from({ length: 16 }, (_, i) => 12000 + i * 200);
    const tones = 4; // emit first 4 nibbles
    const spacing = 0.35;
    const dur = 0.3;
    const now = ctx.currentTime;
    for (let i = 0; i < tones; i++) {
      const byte = vals[i] ?? 0;
      const nibble = byte & 0x0f;
      const freq = carriers[nibble];
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, now + i * spacing);
      env.gain.linearRampToValueAtTime(0.5, now + i * spacing + 0.02);
      env.gain.linearRampToValueAtTime(0.0001, now + i * spacing + dur);
      osc.connect(env);
      env.connect(master);
      const start = now + i * spacing;
      const end = start + dur + 0.02;
      osc.start(start);
      osc.stop(end);
    }
    await new Promise((r) => setTimeout(r, Math.ceil((tones * spacing + 0.5) * 1000)));
  } finally {
    try { await ctx.close(); } catch {}
  }
}

export default function SoundPlayCard() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [isPlaying, setIsPlaying] = useState(false);

  const canUse = isConnected && chainId === zircuitGarfield.id && !!soundRegistryAddress;

  const { data: onchainHash, refetch, isFetching } = useReadContract({
    address: soundRegistryAddress,
    abi: soundRegistryAbi,
    functionName: "soundHashOf",
    args: address ? [address] : undefined,
    chainId: zircuitGarfield.id,
    query: { enabled: Boolean(address && soundRegistryAddress) },
  });

  const handlePlay = useCallback(async () => {
    if (!isConnected) {
      toast.error("Connect your wallet first");
      return;
    }
    if (chainId !== zircuitGarfield.id) {
      toast.error("Switch to Zircuit Garfield");
      return;
    }
    if (!soundRegistryAddress) {
      toast.error("Set NEXT_PUBLIC_SOUND_REGISTRY");
      return;
    }
    try {
      setIsPlaying(true);
      const { data: chainHash } = await refetch();
      if (!chainHash || (chainHash as string).toLowerCase() ===
        "0x0000000000000000000000000000000000000000000000000000000000000000") {
        toast.error("No hash set for this wallet");
        return;
      }
      await playFromHash(chainHash as string);
      toast.success("Playing login sound");
    } catch {
      toast.error("Playback failed");
    } finally {
      setIsPlaying(false);
    }
  }, [chainId, isConnected, refetch]);

  return (
    <div className="section elevated" style={{ borderRadius: 12, padding: 16 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <h4 className="m-0 section-title" style={{ fontSize: 16, fontWeight: 700 }}>Emit Login Sound</h4>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={handlePlay}
          disabled={!canUse || isPlaying}
          className="btn btn-primary"
          title={!isConnected ? "Connect wallet" : chainId !== zircuitGarfield.id ? "Switch to Zircuit Garfield" : "Play login sound"}
        >
          {isPlaying ? "Playing…" : "🔊 Play login sound"}
        </button>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          {!isConnected && <span>Connect wallet</span>}
          {isConnected && chainId !== zircuitGarfield.id && <span>Switch to Zircuit Garfield</span>}
          {isConnected && chainId === zircuitGarfield.id && !soundRegistryAddress && <span>Set NEXT_PUBLIC_SOUND_REGISTRY</span>}
        </div>
      </div>
      {onchainHash && (
        <div style={{ marginTop: 10, fontSize: 12 }} className="muted">
          On-chain hash: <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{String(onchainHash).slice(0, 10)}…</span>
        </div>
      )}
    </div>
  );
}

