import { arbitrum, avalanche, base, mainnet, polygon, sepolia } from "viem/chains";

export type GraphTokenBalance = {
  block_num?: number;
  datetime?: string;
  date?: string;
  contract?: string;
  amount?: string;
  decimals?: number;
  symbol?: string;
  name?: string;
  network_id?: string;
  price_usd?: number;
  value_usd?: number;
};

export function mapTheGraphNetworkToChainId(networkId: string | undefined): number | null {
  switch (networkId) {
    case "mainnet":
    case "ethereum":
    case "eth":
    case "eth-mainnet":
      return mainnet.id;
    case "sepolia":
      return sepolia.id;
    case "matic":
    case "polygon":
    case "matic-mainnet":
      return polygon.id;
    case "arbitrum-one":
    case "arbitrum":
    case "arbitrum-mainnet":
      return arbitrum.id;
    case "avalanche":
    case "avalanche-mainnet":
      return avalanche.id;
    case "base":
    case "base-mainnet":
      return base.id;
    // Not currently in our supported set
    case "bsc":
    case "optimism":
    case "unichain":
    default:
      return null;
  }
}

export function mapChainIdToTheGraphNetworkId(chainId: number): string | null {
  switch (chainId) {
    case mainnet.id:
      return "mainnet";
    case sepolia.id:
      return "sepolia";
    case polygon.id:
      return "matic";
    case arbitrum.id:
      return "arbitrum-one";
    case avalanche.id:
      return "avalanche";
    case base.id:
      return "base";
    default:
      return null;
  }
}

