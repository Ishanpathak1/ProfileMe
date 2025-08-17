import { arbitrum, avalanche, base, mainnet, polygon, sepolia } from "viem/chains";

// Map EVM chain IDs to Covalent chain slugs
// Ref: https://www.covalenthq.com/docs/networks/
export function covalentChainName(chainId: number): string | null {
  switch (chainId) {
    case mainnet.id:
      return "eth-mainnet";
    case sepolia.id:
      return "eth-sepolia";
    case polygon.id:
      return "polygon-mainnet";
    case arbitrum.id:
      return "arbitrum-mainnet";
    case avalanche.id:
      return "avalanche-mainnet";
    case base.id:
      return "base-mainnet";
    default:
      return null;
  }
}

