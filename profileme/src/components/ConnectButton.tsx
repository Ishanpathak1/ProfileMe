"use client";
import { ConnectButton as RKConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

export function ConnectButton() {
  useAccount();

  return (
    <RKConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const connected = mounted && account && chain;
        return (
          <div
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            {!connected ? (
              <button
                onClick={openConnectModal}
                type="button"
                className="btn btn-sm"
                style={{
                  background: "#37FF8B",
                  color: "#0B0C2A",
                  border: 0,
                  borderRadius: 10,
                  padding: "8px 12px",
                  fontWeight: 600,
                }}
              >
                Connect Wallet
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={openChainModal}
                  type="button"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "rgba(55,255,139,0.12)",
                    border: "1px solid rgba(55,255,139,0.35)",
                    color: "#37FF8B",
                    padding: "6px 10px",
                    borderRadius: 8,
                  }}
                >
                  {chain?.hasIcon && chain?.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={chain?.name ?? "chain"}
                      src={chain.iconUrl}
                      width={16}
                      height={16}
                      style={{ borderRadius: 4 }}
                    />
                  ) : null}
                  <span style={{ fontSize: 12 }}>{chain?.name}</span>
                </button>

                <button
                  onClick={openAccountModal}
                  type="button"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "#37FF8B",
                    color: "#0B0C2A",
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: 0,
                    fontWeight: 600,
                  }}
                >
                  <span>{account?.ensName || account?.displayName}</span>
                </button>
              </div>
            )}
          </div>
        );
      }}
    </RKConnectButton.Custom>
  );
}

