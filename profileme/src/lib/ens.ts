import { Address, Hex, createPublicClient, getAddress, http, isAddress, namehash, zeroAddress } from "viem";
import { baseSepolia, mainnet } from "viem/chains";

// ENS Registry (mainnet)
export const ENS_REGISTRY_ADDRESS: Address = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

const ENS_REGISTRY_ABI = [
  {
    constant: true,
    inputs: [{ name: "node", type: "bytes32" }],
    name: "owner",
    outputs: [{ name: "", type: "address" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [{ name: "node", type: "bytes32" }],
    name: "resolver",
    outputs: [{ name: "", type: "address" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
];

const DEFAULT_MAINNET_RPC = process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL || process.env.ETHEREUM_RPC_URL || "https://cloudflare-eth.com";

export function getMainnetClient() {
  return createPublicClient({ chain: mainnet, transport: http(DEFAULT_MAINNET_RPC) });
}

export async function isNameRegistered(name: string): Promise<boolean> {
  const client = getMainnetClient();
  const node: Hex = namehash(name);
  const owner = (await client.readContract({
    address: ENS_REGISTRY_ADDRESS,
    abi: ENS_REGISTRY_ABI,
    functionName: "owner",
    args: [node],
  })) as Address;
  return owner !== zeroAddress;
}

// L2 Registrar helpers (Base Sepolia defaults)
export type L2RegistrarConfig = {
  chain?: typeof baseSepolia;
  registryAddress: Address; // L2Registry
  registrarAddress: Address; // L2Registrar
  rpcUrl?: string; // override
};

export const DEFAULT_L2_REGISTRY_ADDRESS: Address = (process.env.NEXT_PUBLIC_L2_REGISTRY_ADDRESS || "0x553d621d196e7134aa422669b7613fec1aaf40c9") as Address;
export const DEFAULT_L2_REGISTRAR_ADDRESS: Address = (process.env.NEXT_PUBLIC_L2_REGISTRAR_ADDRESS || "0x87eb838a211e91c8fa9f13c3cd996ab21c3dd935") as Address;
export const DEFAULT_L2_RPC_URL = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL || "https://base-sepolia-rpc.publicnode.com";

const L2_REGISTRAR_ABI = [
  { inputs: [{ name: "label", type: "string" }], name: "available", outputs: [{ name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "label", type: "string" }, { name: "owner", type: "address" }], name: "register", outputs: [], stateMutability: "nonpayable", type: "function" },
] as const;

type L2Client = ReturnType<typeof createPublicClient>;

export function getL2Client(cfg?: Pick<L2RegistrarConfig, "rpcUrl" | "chain">): L2Client {
  const rpc = cfg?.rpcUrl || DEFAULT_L2_RPC_URL;
  const chain = cfg?.chain || baseSepolia;
  return createPublicClient({ chain, transport: http(rpc) }) as unknown as L2Client;
}

export async function l2IsAvailable(label: string, cfg?: Partial<L2RegistrarConfig>): Promise<boolean> {
  const client = getL2Client({ rpcUrl: cfg?.rpcUrl, chain: cfg?.chain });
  const registrar = (cfg?.registrarAddress || DEFAULT_L2_REGISTRAR_ADDRESS) as Address;
  const result = await client.readContract({ address: registrar, abi: L2_REGISTRAR_ABI as unknown as any, functionName: "available", args: [label] });
  return Boolean(result);
}

export function getSafeOwnerAddress(addr?: string | null): Address | null {
  try {
    if (!addr || typeof addr !== "string") return null;
    if (!isAddress(addr)) return null;
    return getAddress(addr);
  } catch {
    return null;
  }
}

export async function getPrimaryNameForAddress(address: string): Promise<string | null> {
  const client = getMainnetClient();
  try {
    const checksummed = isAddress(address) ? getAddress(address) : (address as Address);
    const name = await client.getEnsName({ address: checksummed });
    return name ?? null;
  } catch {
    return null;
  }
}

export async function getAddressForName(name: string): Promise<Address | null> {
  const client = getMainnetClient();
  try {
    const addr = await client.getEnsAddress({ name });
    return addr ?? null;
  } catch {
    return null;
  }
}

export function sanitizeLabel(input: string): string {
  const lower = input.toLowerCase().trim();
  const cleaned = lower.replace(/[^a-z0-9-]/g, "-").replace(/--+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 30);
}

// Shared label acceptability check to avoid generic/common or banned names
const COMMON_WORDS = new Set<string>([
  "happy","sad","cool","hot","cold","fast","slow","smart","dumb","boss","baby","king","queen","rock","paper","scissor","ghost","nova","echo","zen","aura","pulse","vibe","crypto","bitcoin","ethereum","eth","btc","doge","pepe","anon","mancer","wizard","ninja","samurai","warrior","hero","grumpy","angry","sun","moon","star","cloud","rain","storm","fire","ice","wind","earth","water"
]);
const BANNED_SUBSTRINGS = [
  "elon","vitalik","satoshi","musk","tesla","apple","google","microsoft","amazon","nvidia",
  "spiderman","batman","superman","harry","potter","gandalf","frodo","anakin","skywalker","thor","loki","ironman","naruto","goku","mario","zelda"
];

export function isAcceptableLabel(label: string): boolean {
  const tokens = label.split("-").filter(Boolean);
  for (const t of tokens) {
    if (t.length >= 3 && COMMON_WORDS.has(t)) return false;
  }
  for (const banned of BANNED_SUBSTRINGS) {
    if (label.includes(banned)) return false;
  }
  return true;
}

