"use client";
import { useMemo } from "react";
import { useAccount, useReadContract } from "wagmi";
import { KATANA_CHAIN_ID } from "@/lib/wagmi";
import { formatUnits } from "viem";

const TOKEN_ADDRESS = "0x2dca96907fde857dd3d816880a0df407eeb2d2f2" as `0x${string}`;

const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

export function YieldAssetBalance() {
  const { address, isConnected } = useAccount();

  const { data: decimalsData } = useReadContract({
    abi: erc20Abi,
    address: TOKEN_ADDRESS,
    functionName: "decimals",
    chainId: KATANA_CHAIN_ID,
  });

  const { data: balanceData, isLoading: balanceLoading, refetch } = useReadContract({
    abi: erc20Abi,
    address: TOKEN_ADDRESS,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: KATANA_CHAIN_ID,
    query: { enabled: Boolean(address) },
  });

  const formatted = useMemo(() => {
    if (balanceData == null || decimalsData == null) return null;
    try {
      return formatUnits(balanceData as bigint, decimalsData as number);
    } catch {
      return null;
    }
  }, [balanceData, decimalsData]);

  return (
    <div className="card mb-3 elevated section" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
      <div className="card-body d-flex justify-content-between align-items-center" style={{ background: "transparent" }}>
        <div>
          <span className="badge me-2" style={{ background: "rgba(91,157,255,0.2)", color: "#5b9dff" }}>Yield Asset</span>
          <span className="text-muted muted">vbUSDT Balance</span>
        </div>
        <div className="d-flex align-items-center gap-2">
          {!isConnected && <span className="text-muted">Connect wallet</span>}
          {isConnected && balanceLoading && <span className="text-muted">Loading...</span>}
          {isConnected && !balanceLoading && (
            <span className="fw-bold" style={{ color: "#5b9dff" }}>
              {formatted ?? "0"} vbUSDT
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default YieldAssetBalance;

