"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { zircuitGarfield } from "@/lib/wagmi";
import { soundRegistryAbi, soundRegistryAddress } from "./abi";
import toast from "react-hot-toast";
import { useAuthStore } from "@/store/auth";
import { keccak256 } from "viem";

// Capture ~1s of audio, show a live waveform, and return 64-band binary fingerprint bytes
async function captureWithVisualization(durationMs: number, canvas: HTMLCanvasElement | null): Promise<Uint8Array> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 4096;
  analyser.smoothingTimeConstant = 0.0;
  source.connect(analyser);

  const bins = analyser.frequencyBinCount;
  const accum = new Float64Array(bins);
  const freqBuf = new Uint8Array(bins);
  const timeBuf = new Uint8Array(analyser.fftSize);

  let rafId = 0;
  const startedAt = performance.now();
  const ctx = canvas ? canvas.getContext("2d") : null;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  if (canvas && ctx) {
    const w = canvas.clientWidth * dpr;
    const h = canvas.clientHeight * dpr;
    canvas.width = w; canvas.height = h;
    ctx.scale(dpr, dpr);
  }

  await new Promise<void>((resolve) => {
    function draw() {
      analyser.getByteFrequencyData(freqBuf);
      for (let i = 0; i < bins; i++) accum[i] += freqBuf[i];
      if (ctx && canvas) {
        analyser.getByteTimeDomainData(timeBuf);
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        ctx.clearRect(0, 0, width, height);
        // background grid line
        ctx.fillStyle = "#0b1220";
        ctx.fillRect(0, 0, width, height);
        // waveform
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 2;
        ctx.beginPath();
        const slice = Math.floor(timeBuf.length / width) || 1;
        for (let x = 0; x < width; x++) {
          const idx = x * slice;
          const v = timeBuf[idx] / 128.0; // 0..2
          const y = (v * height) / 2;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      if (performance.now() - startedAt >= durationMs) { resolve(); return; }
      rafId = requestAnimationFrame(draw);
    }
    rafId = requestAnimationFrame(draw);
  });

  try { cancelAnimationFrame(rafId); } catch {}
  try { stream.getTracks().forEach((t) => t.stop()); await audioContext.close(); } catch {}

  // Build fingerprint
  let frames = Math.max(Math.round((durationMs / 16)), 1); // approx frames used, only for safety divider
  for (let i = 0; i < bins; i++) accum[i] = accum[i] / frames;
  // Detect four high-frequency carriers in 12k–15kHz range with 200Hz steps (better for mobile mics)
  const sampleRate = audioContext.sampleRate;
  const binHz = sampleRate / (2 * bins);
  const carriers: number[] = Array.from({ length: 16 }, (_, i) => 12000 + i * 200);
  function powerAtFreq(targetHz: number): number {
    const binIndex = Math.round(targetHz / binHz);
    let sum = 0;
    let count = 0;
    for (let k = -2; k <= 2; k++) {
      const idx = Math.min(Math.max(binIndex + k, 0), bins - 1);
      sum += accum[idx];
      count++;
    }
    return sum / Math.max(count, 1);
  }
  // Slide over the window to find top-4 bursts (simplified: just pick top 4 by power)
  const powers = carriers.map((hz) => powerAtFreq(hz));
  const top4 = [...powers]
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p - a.p)
    .slice(0, 4)
    .map((x) => x.i);
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 4; i++) {
    const nibble = top4[i] ?? 0;
    if (i < 2) bytes[0] |= nibble << ((1 - i) * 4); // pack into first byte
    else bytes[1] |= nibble << ((3 - i) * 4);
  }
  return bytes;
}

export default function SoundDetectCard() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { setSoundVerified } = useAuthStore();
  const [isListening, setIsListening] = useState(false);
  const [hasMicAccess, setHasMicAccess] = useState(false);
  const [isRequestingMic, setIsRequestingMic] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const canUse = isConnected && chainId === zircuitGarfield.id && !!soundRegistryAddress;

  const { refetch } = useReadContract({
    address: soundRegistryAddress,
    abi: soundRegistryAbi,
    functionName: "soundHashOf",
    args: address ? [address] : undefined,
    chainId: zircuitGarfield.id,
    query: { enabled: false },
  });

  const requestMicAccess = useCallback(async () => {
    try {
      setIsRequestingMic(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Close immediately; we only needed the permission grant
      try { stream.getTracks().forEach((t) => t.stop()); } catch {}
      setHasMicAccess(true);
      toast.success("Microphone enabled");
    } catch (e: any) {
      if (e?.name === "NotAllowedError") {
        toast.error("Microphone blocked. Allow mic access in browser settings.");
      } else if (e?.name === "NotFoundError") {
        toast.error("No microphone found");
      } else {
        toast.error("Cannot access microphone");
      }
      setHasMicAccess(false);
    } finally {
      setIsRequestingMic(false);
    }
  }, []);

  useEffect(() => {
    // Best-effort Permissions API (not supported on all iOS versions)
    // If unsupported, user will use the Enable Microphone button
    const check = async () => {
      try {
        // @ts-expect-error: permissions may be undefined on Safari
        const status = await navigator.permissions?.query({ name: "microphone" as PermissionName });
        if (status && (status.state === "granted" || status.state === "prompt")) {
          setHasMicAccess(status.state === "granted");
        }
      } catch {}
    };
    check();
  }, []);

  const handleListen = useCallback(async () => {
    if (!isConnected) { toast.error("Connect your wallet"); return; }
    if (chainId !== zircuitGarfield.id) { toast.error("Switch to Zircuit Garfield"); return; }
    if (!soundRegistryAddress) { toast.error("Set NEXT_PUBLIC_SOUND_REGISTRY"); return; }
    if (!hasMicAccess) { await requestMicAccess(); if (!hasMicAccess) return; }
    try {
      setIsListening(true);
      const { data: chainHash } = await refetch();
      if (!chainHash || (chainHash as string).toLowerCase() ===
        "0x0000000000000000000000000000000000000000000000000000000000000000") {
        toast.error("No hash set for this wallet"); return;
      }
      const bytes = await captureWithVisualization(5000, canvasRef.current);
      // Decode detected nibble indices from packed bytes (n0|n1 in byte0, n2|n3 in byte1)
      const detected = [
        (bytes[0] >> 4) & 0x0f,
        bytes[0] & 0x0f,
        (bytes[1] >> 4) & 0x0f,
        bytes[1] & 0x0f,
      ];
      // Expected nibble indices from on-chain hash (low nibble of first 4 bytes)
      const hex = (chainHash as string).startsWith("0x") ? (chainHash as string).slice(2) : (chainHash as string);
      const expectedRaw = [
        parseInt(hex.slice(0, 2), 16) & 0x0f,
        parseInt(hex.slice(2, 4), 16) & 0x0f,
        parseInt(hex.slice(4, 6), 16) & 0x0f,
        parseInt(hex.slice(6, 8), 16) & 0x0f,
      ];
      // Less strict matching: accept if at least 3 of expected appear in detected within ±1 bin tolerance
      const used = [false, false, false, false];
      let matches = 0;
      for (const exp of expectedRaw) {
        let foundIndex = -1;
        for (let i = 0; i < detected.length; i++) {
          if (used[i]) continue;
          const d = detected[i];
          if (d === exp || d === exp - 1 || d === exp + 1) {
            foundIndex = i;
            break;
          }
        }
        if (foundIndex !== -1) {
          used[foundIndex] = true;
          matches++;
        }
      }
      if (matches >= 3) {
        setSoundVerified(true);
        toast.success("Sound verified — logged in");
      } else {
        toast.error("Sound mismatch — try again");
      }
    } catch (e: any) {
      if (e?.name === "NotAllowedError") toast.error("Microphone blocked");
      else toast.error("Audio error");
    } finally {
      setIsListening(false);
    }
  }, [chainId, hasMicAccess, isConnected, refetch, requestMicAccess, setSoundVerified]);

  const [devBypass, setDevBypass] = useState<string | null>(null);
  useEffect(() => {
    try { setDevBypass(typeof window !== "undefined" ? localStorage.getItem("devBypassSound") : null); } catch { setDevBypass(null); }
  }, []);

  return (
    <div className="section" style={{ background: "#0d1117", border: "1px solid #1f2a37", borderRadius: 12, padding: 16, color: "#d1d5db" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <h4 className="m-0" style={{ fontSize: 16, fontWeight: 600, color: "#e5e7eb" }}>Detect & Login</h4>
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
          onClick={handleListen}
          disabled={!canUse || isListening}
          style={{
            background: isListening ? "#374151" : "#10b981",
            color: "#081318",
            border: 0,
            borderRadius: 8,
            padding: "10px 14px",
            cursor: !canUse || isListening ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
          title={!isConnected ? "Connect wallet" : chainId !== zircuitGarfield.id ? "Switch to Zircuit Garfield" : "🎧 Listen & verify"}
        >
          {isListening ? "Listening…" : "🎧 Listen & verify"}
        </button>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          {!isConnected && <span>Connect wallet</span>}
          {isConnected && chainId !== zircuitGarfield.id && <span>Switch to Zircuit Garfield</span>}
          {isConnected && chainId === zircuitGarfield.id && !soundRegistryAddress && <span>Set NEXT_PUBLIC_SOUND_REGISTRY</span>}
        </div>
      </div>
      {!hasMicAccess && (
        <div style={{ marginTop: 10, padding: 10, border: "1px dashed #374151", borderRadius: 8, color: "#9ca3af" }}>
          <div style={{ marginBottom: 8 }}>Microphone permission required (on iPhone: tap “Allow” when prompted).</div>
          <button
            onClick={requestMicAccess}
            disabled={isRequestingMic}
            style={{
              background: isRequestingMic ? "#374151" : "#1f6feb",
              color: "#0b1020",
              border: 0,
              borderRadius: 6,
              padding: "8px 12px",
              cursor: isRequestingMic ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {isRequestingMic ? "Requesting…" : "Enable microphone"}
          </button>
          <div style={{ marginTop: 6, fontSize: 12 }}>
            Tip: On iOS, the site must be served over HTTPS or localhost to access the mic. Use an HTTPS tunnel (e.g., ngrok) when testing on phone.
          </div>
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>Audio input</div>
        <div style={{
          background: "#0b1220",
          border: "1px solid #1f2a37",
          borderRadius: 8,
          padding: 8,
        }}>
          <canvas ref={canvasRef} style={{ width: "100%", height: 60, display: "block" }} />
          {isListening
            ? <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>Listening ~5s… bring the phone near the laptop speaker</div>
            : <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>Idle — tap "Enable microphone" then "Listen & verify"</div>}
        </div>
      </div>
    </div>
  );
}

