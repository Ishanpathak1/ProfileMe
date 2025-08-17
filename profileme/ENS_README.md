## ENS + Durin + AI Names (Base Sepolia)

This document explains how ProfileMe integrates ENS with Durin L2 subnames on Base Sepolia and how the app uses AI to generate and register friendly, unique names.

### What we built
- **ENS primary name lookup** on L1 Ethereum.
- **AI-assisted label generation** based on a brief wallet summary.
- **L2 subname availability checks** against a Durin Registrar on Base Sepolia.
- **One-click registration** of L2 subnames via Durin on Base Sepolia, then resolving on L1 under your chosen ENS root.


## Components used

- **Durin (ResolverWorks)**: L2 ENS subname architecture and tooling (Registry, Registrar, L1 Resolver, and Gateway). We use a Durin Registry + Registrar on Base Sepolia for fast, cheap subname issuance, while keeping resolution compatible with L1 ENS.
- **Viem + Wagmi + RainbowKit**: wallet connectivity and on-chain reads/writes.
- **OpenAI**: small LLM prompt to generate short, unique pseudoword-style labels.
- **Next.js Route Handlers**: server endpoints for name suggestion and wallet summary prompts.

Relevant code:

```1:123:src/app/api/ens-suggest/route.ts
import { NextRequest } from "next/server";
import OpenAI from "openai";
import { sanitizeLabel, l2IsAvailable, isAcceptableLabel } from "@/lib/ens";

// Deterministic pseudoword generator from wallet address
function pseudoFromWallet(wallet: string, salt: number): string { /* ... */ }

export async function POST(req: NextRequest) {
  // 1) Build prompt with rules
  // 2) Call OpenAI (gpt-4o-mini)
  // 3) Sanitize + filter
  // 4) Check availability via l2IsAvailable(label)
  // 5) Fallback to deterministic pseudowords if needed
}
```

```1:135:src/lib/ens.ts
import { baseSepolia } from "viem/chains";

export const DEFAULT_L2_REGISTRY_ADDRESS = "0x553d621d196e7134aa422669b7613fec1aaf40c9";
export const DEFAULT_L2_REGISTRAR_ADDRESS = "0x87eb838a211e91c8fa9f13c3cd996ab21c3dd935";
export const DEFAULT_L2_RPC_URL = "https://base-sepolia-rpc.publicnode.com";

export async function l2IsAvailable(label: string): Promise<boolean> {
  // Calls Registrar.available(label) on Base Sepolia
}

export function sanitizeLabel(input: string): string { /* ... */ }
export function isAcceptableLabel(label: string): boolean { /* filters common/brand/character words */ }
```

```1:292:src/components/EnsNameWidget.tsx
// UI flow: summarize wallet -> ask AI for names -> check availability -> register on Base Sepolia via Durin Registrar
// Ensures chain switch to Base Sepolia (84532), calls Registrar.register(label, owner)
```


## How Durin is used

Durin lets us mint L2 subnames and resolve them on L1 ENS under an existing name (e.g., `profile.eth`). The high-level steps we followed (via `durin.dev`):

1) Deploy an L2 Registry on Base Sepolia
- Go to `https://durin.dev` and choose the chain (Base Sepolia) and whether you will resolve on ENS L1 (Mainnet/Sepolia).
- Deploy the registry. Note the resulting L2 Registry address.

2) Connect your L1 ENS name to the L2 Registry
- Set your ENS name’s resolver to Durin’s L1 Resolver (`0x8A968aB9eb8C084FBC44c531058Fc9ef945c3D61`).
- Call `setL2Registry()` with the L2 Registry address and chain ID (Base Sepolia: 84532).
- You can do both in `durin.dev` or via the ENS Manager app.

3) Deploy and authorize a Registrar on L2
- Deploy an L2 Registrar contract (Durin’s example or a customized one for pricing/allow lists).
- On the L2 Registry, call `addRegistrar(registrarAddress)` so it can mint subnames.

In this repo, the frontend reads Registrar/Registry addresses from environment variables (with sensible Base Sepolia defaults) and uses the Registrar to check `available(label)` and call `register(label, owner)`.

Durin reference: see `contracts/durin/README.md` in this repo for full details.


## Base Sepolia configuration

- **Chain ID**: 84532
- **Public RPC (default)**: `https://base-sepolia-rpc.publicnode.com`
- We configure Base Sepolia in `src/lib/wagmi.ts` and programmatically switch the user’s wallet when registering a name.

```1:210:src/lib/wagmi.ts
import { baseSepolia } from "wagmi/chains";
// BASE_SEPOLIA RPC is wired via env and falls back to publicnode
// supportedChains includes baseSepolia; switch happens in EnsNameWidget
```


## AI name generation (how it works)

1) We generate a brief wallet overview using `/api/summary` (OpenAI), including chains, balances, and vibe lines.
2) We send that short paragraph to `/api/ens-suggest`, which prompts OpenAI to return 12-20 lowercased, hyphenated, unique pseudoword-style labels with rules:
   - only `[a-z0-9-]`, max 16 chars, no emojis, no brands/characters, avoid common words
3) We sanitize, dedupe, and filter with `isAcceptableLabel()` to remove generic or banned patterns.
4) We check availability on L2 via `Registrar.available(label)` on Base Sepolia.
5) If none are available, we fall back to deterministic pseudowords derived from the wallet address.
6) The UI preselects the first available suggestion.

On successful registration, the subname resolves on L1 ENS underneath your configured root (e.g., `your-label.profile.eth`), thanks to the Durin L1 Resolver pointing to the L2 Registry.


## Environment variables

Create `profileme/.env.local` with the following (example values shown):

```bash
# WalletConnect / RainbowKit
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_walletconnect_project_id

# OpenAI (server preferred); ens-suggest endpoint accepts either
OPENAI_API_KEY=sk-your-server-key
# Optional client-exposed fallback (avoid when possible)
# NEXT_PUBLIC_OPENAI_API_KEY=sk-your-client-key

# Durin L2 on Base Sepolia
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=https://base-sepolia-rpc.publicnode.com
NEXT_PUBLIC_L2_REGISTRY_ADDRESS=0x553d621d196e7134aa422669b7613fec1aaf40c9
NEXT_PUBLIC_L2_REGISTRAR_ADDRESS=0x87eb838a211e91c8fa9f13c3cd996ab21c3dd935

# ENS display root on L1 (the parent name your L2 registry is bound to)
NEXT_PUBLIC_ENS_DISPLAY_ROOT=profile.eth
```

Notes:
- The Registrar/Registry addresses above are defaults shipped in the code for Base Sepolia. Replace them with your own Durin deployment values as needed.
- The app will switch the wallet to Base Sepolia (84532) automatically when registering.


## User flow in the app

1) Connect wallet and pass Sound verification (gates the feature in UI).
2) Click “Suggest” (or auto-trigger on connect):
   - The app calls `/api/summary` to get a short wallet paragraph, then `/api/ens-suggest` to get labels.
   - The server filters and checks availability on the Durin Registrar.
3) Pick a label and press “Register”. The app:
   - Switches network to Base Sepolia.
   - Calls `Registrar.register(label, owner)`.
   - Shows success once mined and stores the label locally to avoid re-suggesting it.


## Troubleshooting

- “Missing OpenAI API key”: set `OPENAI_API_KEY` (server) or `NEXT_PUBLIC_OPENAI_API_KEY`.
- “Label not available on L2”: generate again or choose a different label.
- “Please choose a more unique, non-generic name”: `isAcceptableLabel()` filters common/brand/character words; try a more novel pseudoword.
- Wallet not switching: ensure your wallet supports testnets and Base Sepolia is enabled.
- Names not resolving on L1: verify the L1 name’s resolver is set to the Durin L1 resolver and `setL2Registry()` is configured to your Base Sepolia registry address.


## References

- Durin docs (bundled in this repo): `contracts/durin/README.md`
- ENS docs: `https://docs.ens.domains/`
- Base Sepolia explorer: `https://sepolia.basescan.org`

## Replicate this build

Two paths: quickstart (use our defaults) or full Durin setup with your own registry/registrar.

### A) Quickstart (using the shipped Base Sepolia defaults)
1) Clone the repo and install:
   ```bash
   cd profileme
   npm i
   ```
2) Create `profileme/.env.local` and fill:
   ```bash
   NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_walletconnect_project_id
   OPENAI_API_KEY=sk-your-server-key
   NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=https://base-sepolia-rpc.publicnode.com
   NEXT_PUBLIC_L2_REGISTRY_ADDRESS=0x553d621d196e7134aa422669b7613fec1aaf40c9
   NEXT_PUBLIC_L2_REGISTRAR_ADDRESS=0x87eb838a211e91c8fa9f13c3cd996ab21c3dd935
   NEXT_PUBLIC_ENS_DISPLAY_ROOT=profile.eth
   ```
3) Run the app:
   ```bash
   npm run dev
   ```
4) In the UI, connect your wallet, hit Suggest, then Register. The app switches to Base Sepolia and calls the Registrar.

Notes:
- The default Registry/Registrar are for Base Sepolia test usage. For production or your own namespace, do the full setup below.

### B) Full Durin setup (your own namespace)
1) Acquire or control an L1 ENS name (e.g., `yourbrand.eth`).
2) Go to `https://durin.dev` and deploy an L2 Registry on Base Sepolia. Save the registry address.
3) On L1 for `yourbrand.eth`:
   - Set the resolver to Durin L1 Resolver: `0x8A968aB9eb8C084FBC44c531058Fc9ef945c3D61`.
   - Call `setL2Registry(registryAddress, 84532)`.
4) Deploy an L2 Registrar (Durin example or customized), then authorize it on your L2 Registry with `addRegistrar(registrarAddress)`.
5) Update the frontend env vars:
   ```bash
   NEXT_PUBLIC_L2_REGISTRY_ADDRESS=0xYourL2Registry
   NEXT_PUBLIC_L2_REGISTRAR_ADDRESS=0xYourL2Registrar
   NEXT_PUBLIC_ENS_DISPLAY_ROOT=yourbrand.eth
   ```
6) Start the app and register subnames that resolve as `label.yourbrand.eth` via Durin.

Tips:
- Keep your own allowlists/pricing in a custom Registrar if needed.
- If names don’t resolve, double-check the L1 resolver and `setL2Registry()` configuration.

