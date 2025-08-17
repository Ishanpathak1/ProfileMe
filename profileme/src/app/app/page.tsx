"use client";
import { useEffect, useState } from "react";
import { ConnectButton } from "@/components/ConnectButton";
import { NetworkPrompt } from "@/components/NetworkPrompt";
import dynamic from "next/dynamic";
import Protected from "@/components/Protected";
// Removed Play card from home; detection-only on home
import SoundDetectCard from "@/features/sound-login/SoundDetectCard";
const MultiChainDashboard = dynamic(() => import("@/components/MultiChainDashboard"), { ssr: false });
const EnsNameWidget = dynamic(() => import("@/components/EnsNameWidget"), { ssr: false });

export default function AppHome() {
  const [devBypass, setDevBypass] = useState<string | null>(null);
  useEffect(() => {
    try {
      setDevBypass(typeof window !== "undefined" ? localStorage.getItem("devBypassSound") : null);
    } catch {
      setDevBypass(null);
    }
  }, []);
  return (
    <div className="px-6 py-5 max-w-7xl mx-auto" style={{ minHeight: "100vh" }}>
      <div className="flex items-center justify-between mb-6 section">
        <div>
          <h3 className="m-0 text-xl section-title">ProfileMe — Multi-Chain Dashboard</h3>
          <div className="text-sm muted">Track balances and activity across chains. WalletConnect + Infura with resilient fallbacks.</div>
        </div>
        <ConnectButton />
      </div>
      <NetworkPrompt />
      {process.env.NODE_ENV !== "production" && devBypass !== null && (
        <div className="section" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>Dev bypass is {devBypass === "true" ? "ON" : "OFF"}</span>
          <button
            onClick={() => {
              const next = devBypass === "true" ? "false" : "true";
              try { localStorage.setItem("devBypassSound", next); } catch {}
              setDevBypass(next);
              window.location.reload();
            }}
            style={{
              background: "var(--accent)",
              color: "#0a0e18",
              border: 0,
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            Toggle dev bypass
          </button>
          <button
            onClick={() => { try { localStorage.removeItem("devBypassSound"); } catch {}; window.location.reload(); }}
            style={{
              background: "#374151",
              color: "#e5e7eb",
              border: 0,
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            Clear
          </button>
        </div>
      )}
      <div className="section" style={{ marginBottom: 12 }}>
        <SoundDetectCard />
      </div>
      <Protected>
        <div className="section">
          <MultiChainDashboard />
        </div>
      </Protected>
      <EnsNameWidget />
    </div>
  );
}

