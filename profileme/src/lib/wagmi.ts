import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import type { Chain } from "wagmi/chains";
import { Transport, fallback, http } from "viem";
import { arbitrum, avalanche, base, baseSepolia, mainnet, polygon, sepolia } from "wagmi/chains";

export const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID;

if (!projectId) {
  throw new Error(
    "Missing NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID. Set it in your .env.local."
  );
}

// Read Infura key from env (supports both server and client exposure)
const infuraKey =
  process.env.NEXT_PUBLIC_MY_INFURA_KEY ||
  process.env.MY_INFURA_KEY ||
  process.env.NEXT_PUBLIC_INFURA_KEY ||
  process.env.INFURA_KEY ||
  "";

// Optional per-chain custom RPCs (browser-safe)
const ETHEREUM_RPC = process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL || process.env.ETHEREUM_RPC_URL || "";
const SEPOLIA_RPC = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || process.env.SEPOLIA_RPC_URL || "";
const POLYGON_RPC = process.env.NEXT_PUBLIC_POLYGON_RPC_URL || process.env.POLYGON_RPC_URL || "";
const ARBITRUM_RPC = process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC_URL || "";
const AVALANCHE_RPC = process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL || process.env.AVALANCHE_RPC_URL || "";
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC_URL || process.env.BASE_RPC_URL || "";
const BASE_SEPOLIA_RPC =
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ||
  process.env.BASE_SEPOLIA_RPC_URL ||
  "https://base-sepolia-rpc.publicnode.com";

// Katana Tatara Testnet chain config (RPC via env; we avoid wrong defaults)
const katanaRpcUrl = process.env.NEXT_PUBLIC_KATANA_RPC_URL || process.env.KATANA_RPC_URL || "";
const katanaExplorerUrl = process.env.NEXT_PUBLIC_KATANA_EXPLORER_URL || process.env.KATANA_EXPLORER_URL || "";

export const KATANA_CHAIN_ID = 129399;

export const katanaTestnet: Chain = {
  id: KATANA_CHAIN_ID,
  name: "Katana Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: katanaRpcUrl ? [katanaRpcUrl] : [] },
    public: { http: katanaRpcUrl ? [katanaRpcUrl] : [] },
  },
  blockExplorers: {
    default: {
      name: "Explorer",
      url: katanaExplorerUrl || "",
    },
  },
  testnet: true,
};

// Zircuit Garfield Testnet chain config
export const zircuitGarfield: Chain = {
  id: 48898,
  name: "Zircuit Garfield Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://zircuit-garfield-testnet.drpc.org"] },
    public: { http: ["https://zircuit-garfield-testnet.drpc.org"] },
  },
  blockExplorers: {
    default: {
      name: "Zircuit Garfield Explorer",
      url: "https://explorer.garfield-testnet.zircuit.com",
    },
  },
  testnet: true,
};

// Build a list of supported chains
export const supportedChains: Chain[] = [
  mainnet,
  sepolia,
  polygon,
  arbitrum,
  avalanche,
  base,
  baseSepolia,
  zircuitGarfield,
  // Include Katana only if we have an RPC to avoid wrong defaults
  ...(katanaRpcUrl ? [katanaTestnet] as Chain[] : []),
];

function infuraUrlForChain(chain: Chain): string | null {
  if (!infuraKey) return null;
  switch (chain.id) {
    case mainnet.id:
      return `https://mainnet.infura.io/v3/${infuraKey}`;
    case sepolia.id:
      return `https://sepolia.infura.io/v3/${infuraKey}`;
    case polygon.id:
      return `https://polygon-mainnet.infura.io/v3/${infuraKey}`;
    case arbitrum.id:
      return `https://arbitrum-mainnet.infura.io/v3/${infuraKey}`;
    case avalanche.id:
      return `https://avalanche-mainnet.infura.io/v3/${infuraKey}`;
    case base.id:
      return `https://base-mainnet.infura.io/v3/${infuraKey}`;
    case baseSepolia.id:
      return null; // use explicit/public RPCs for testnets
    default:
      return null;
  }
}

export function buildTransport(chain: Chain): Transport {
  const candidates: ReturnType<typeof http>[] = [];
  // Highest priority: explicit custom RPCs supplied via env
  switch (chain.id) {
    case mainnet.id:
      if (ETHEREUM_RPC) candidates.push(http(ETHEREUM_RPC));
      break;
    case sepolia.id:
      if (SEPOLIA_RPC) candidates.push(http(SEPOLIA_RPC));
      break;
    case polygon.id:
      if (POLYGON_RPC) candidates.push(http(POLYGON_RPC));
      break;
    case arbitrum.id:
      if (ARBITRUM_RPC) candidates.push(http(ARBITRUM_RPC));
      break;
    case avalanche.id:
      if (AVALANCHE_RPC) candidates.push(http(AVALANCHE_RPC));
      break;
    case base.id:
      if (BASE_RPC) candidates.push(http(BASE_RPC));
      break;
    case baseSepolia.id:
      if (BASE_SEPOLIA_RPC) candidates.push(http(BASE_SEPOLIA_RPC));
      break;
  }
  const infuraUrl = infuraUrlForChain(chain);
  if (infuraUrl) {
    candidates.push(http(infuraUrl));
  }
  // Prefer chain default, then public URLs
  const defaults = chain.rpcUrls?.default?.http ?? [];
  const publics = chain.rpcUrls?.public?.http ?? [];
  for (const url of [...defaults, ...publics]) {
    candidates.push(http(url));
  }
  // Special-case explicit fallbacks if provided via env for customs
  if (chain.id === zircuitGarfield.id) {
    candidates.push(http("https://zircuit-garfield-testnet.drpc.org"));
  }
  if (chain.id === katanaTestnet.id && katanaRpcUrl) {
    candidates.push(http(katanaRpcUrl));
  }
  // Extra known public RPCs that generally support browser CORS
  switch (chain.id) {
    case mainnet.id:
      candidates.push(http("https://cloudflare-eth.com"));
      break;
    case sepolia.id:
      candidates.push(http("https://rpc.sepolia.org"));
      break;
    case polygon.id:
      candidates.push(http("https://polygon-rpc.com"));
      break;
    case arbitrum.id:
      candidates.push(http("https://arb1.arbitrum.io/rpc"));
      break;
    case avalanche.id:
      candidates.push(http("https://api.avax.network/ext/bc/C/rpc"));
      break;
    case base.id:
      candidates.push(http("https://mainnet.base.org"));
      break;
    case baseSepolia.id:
      candidates.push(http("https://base-sepolia-rpc.publicnode.com"));
      break;
  }
  return candidates.length > 1 ? fallback(candidates) : candidates[0] ?? http("https://cloudflare-eth.com");
}

export const wagmiConfig = getDefaultConfig({
  appName: "ProfileMe",
  projectId,
  chains: supportedChains,
  ssr: false,
  // Prevent eager auto-connect to avoid wallet throwing errors when user not ready
  autoConnect: false,
  transports: Object.fromEntries(supportedChains.map((c) => [c.id, buildTransport(c)])),
});

export async function switchToKatana(): Promise<void> {
  const ethereum = (typeof window !== "undefined" ? ((window as unknown) as { ethereum?: { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum : undefined);
  if (!ethereum || !ethereum.request) {
    throw new Error("No injected wallet found");
  }
  await ethereum.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: "0x1f977", // 129399 in hex
        chainName: "Katana Testnet",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: [katanaRpcUrl],
        blockExplorerUrls: [katanaExplorerUrl],
      },
    ],
  });
}

