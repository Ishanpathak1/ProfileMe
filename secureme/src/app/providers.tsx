"use client";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import { Toaster } from "react-hot-toast";

const queryClient = new QueryClient();

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
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

