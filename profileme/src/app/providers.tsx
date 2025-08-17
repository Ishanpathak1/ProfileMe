"use client";
import { useEffect } from "react";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "@/store/auth";

const queryClient = new QueryClient();

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setSoundVerified } = useAuthStore();

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      const p = url.searchParams.get("devBypass");
      if (p === null) return;
      const on = p === "1" || p === "true";
      localStorage.setItem("devBypassSound", on ? "true" : "false");
      setSoundVerified(on);
      url.searchParams.delete("devBypass");
      window.history.replaceState({}, document.title, url.toString());
    } catch {}
  }, [setSoundVerified]);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#5b9dff",
            accentColorForeground: "#0a0e18",
            borderRadius: "medium",
            overlayBlur: "small",
          })}
        >
          {children}
          <Toaster position="bottom-center" toastOptions={{ duration: 3000 }} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

