"use client";

import { ReactNode, useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth";

export default function Protected({ children }: { children: ReactNode }) {
  const { isSoundVerified } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (isSoundVerified) return <>{children}</>;
  return (
    <div
      className="section"
      style={{
        background: "#0d1117",
        border: "1px dashed #374151",
        borderRadius: 12,
        padding: 20,
        color: "#9ca3af",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
      title="Verify with sound"
    >
      <span role="img" aria-label="locked" style={{ fontSize: 18 }}>🔒</span>
      <span>Locked — Verify with sound</span>
      {mounted && process.env.NODE_ENV !== "production" && (
        <button
          onClick={() => {
            localStorage.setItem("devBypassSound", "true");
            window.location.reload();
          }}
          style={{
            marginLeft: "auto",
            background: "#374151",
            color: "#e5e7eb",
            border: 0,
            borderRadius: 6,
            padding: "6px 10px",
            cursor: "pointer",
            fontSize: 12,
          }}
          title="Developer bypass: unlock without sound"
        >
          Dev bypass
        </button>
      )}
    </div>
  );
}

