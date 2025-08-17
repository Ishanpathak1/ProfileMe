import type { Chain } from "viem";
import {
  arbitrum,
  avalanche,
  base,
  mainnet,
  polygon,
  sepolia,
} from "viem/chains";
import { katanaTestnet, zircuitGarfield } from "@/lib/wagmi";

export type ChainMeta = {
  id: number;
  slug: string;
  displayName: string;
  logoPath: string;
  primaryColor: string;
};

export const chainIdToMeta: Record<number, ChainMeta> = {
  [mainnet.id]: {
    id: mainnet.id,
    slug: "ethereum",
    displayName: "Ethereum Mainnet",
    logoPath: "/logos/ethereum.svg",
    primaryColor: "#627EEA",
  },
  [sepolia.id]: {
    id: sepolia.id,
    slug: "sepolia",
    displayName: "Sepolia",
    logoPath: "/logos/sepolia.svg",
    primaryColor: "#7057FF",
  },
  [polygon.id]: {
    id: polygon.id,
    slug: "polygon",
    displayName: "Polygon",
    logoPath: "/logos/polygon.svg",
    primaryColor: "#8247E5",
  },
  [arbitrum.id]: {
    id: arbitrum.id,
    slug: "arbitrum",
    displayName: "Arbitrum",
    logoPath: "/logos/arbitrum.svg",
    primaryColor: "#2D374B",
  },
  [avalanche.id]: {
    id: avalanche.id,
    slug: "avalanche",
    displayName: "Avalanche",
    logoPath: "/logos/avalanche.svg",
    primaryColor: "#E84142",
  },
  [base.id]: {
    id: base.id,
    slug: "base",
    displayName: "Base",
    logoPath: "/logos/base.svg",
    primaryColor: "#0052FF",
  },
  [zircuitGarfield.id]: {
    id: zircuitGarfield.id,
    slug: "zircuit",
    displayName: "Zircuit Garfield Testnet",
    logoPath: "/logos/zircuit.svg",
    primaryColor: "#19E0E0",
  },
  [katanaTestnet.id]: {
    id: katanaTestnet.id,
    slug: "katana",
    displayName: "Katana Tatara Testnet",
    logoPath: "/logos/katana.svg",
    primaryColor: "#37FF8B",
  },
};

export function getChainMeta(chain: Chain): ChainMeta {
  return chainIdToMeta[chain.id] ?? {
    id: chain.id,
    slug: String(chain.id),
    displayName: chain.name,
    logoPath: "/logos/generic.svg",
    primaryColor: "#888888",
  };
}

