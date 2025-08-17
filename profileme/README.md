## ProfileMe — Web3 Profile and On‑chain Sound Login (Zircuit Garfield)

Tech Stack: Next.js (React + TypeScript), Wagmi, RainbowKit, Viem, Tailwind, Recharts

ProfileMe is a demo frontend showcasing:

- Sound Login: reads a user’s on‑chain sound hash from `SingleUserSoundRegistry` on Zircuit Garfield Testnet and enables simple actions in the UI.
- Multi‑chain widgets: basic charts, balances, and NFT activity with The Graph-powered API routes.
- ENS utilities: display root and L2 registry helpers.
- AI helpers: OpenAI-backed summary endpoints for profile data.
- Optional Ledger DMK integration.

Zircuit is the AI-powered blockchain for secure, automated finance. Zircuit Garfield is the public testnet.

### Prerequisites

- Node.js 18+ (Node 20 LTS recommended)
- npm
- EVM wallet (e.g., MetaMask)

### Environment

Create `.env.local` in the `profileme` folder. Include only the keys below (no values are provided here).

Required (core app):

```
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID
NEXT_PUBLIC_SOUND_REGISTRY
```

Server-side AI (used by API routes):

```
OPENAI_API_KEY
OPENAI_MODEL
NEXT_PUBLIC_OPENAI_API_KEY
```

The Graph (used by API routes; any one valid token works, multiple fallbacks supported):

```
THEGRAPH_TOKEN_API_JWT
THEGRAPH_TOKEN
GRAPH_TOKEN_API_JWT
NEXT_PUBLIC_THEGRAPH_TOKEN_API_JWT
```

RPCs and Provider Keys (optional overrides and fallbacks):

```
NEXT_PUBLIC_MY_INFURA_KEY
MY_INFURA_KEY
NEXT_PUBLIC_INFURA_KEY
INFURA_KEY
NEXT_PUBLIC_ETHEREUM_RPC_URL
ETHEREUM_RPC_URL
NEXT_PUBLIC_SEPOLIA_RPC_URL
SEPOLIA_RPC_URL
NEXT_PUBLIC_POLYGON_RPC_URL
POLYGON_RPC_URL
NEXT_PUBLIC_ARBITRUM_RPC_URL
ARBITRUM_RPC_URL
NEXT_PUBLIC_AVALANCHE_RPC_URL
AVALANCHE_RPC_URL
NEXT_PUBLIC_BASE_RPC_URL
BASE_RPC_URL
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL
BASE_SEPOLIA_RPC_URL
NEXT_PUBLIC_KATANA_RPC_URL
KATANA_RPC_URL
NEXT_PUBLIC_KATANA_EXPLORER_URL
KATANA_EXPLORER_URL
```

Display/UX tweaks (optional):

```
NEXT_PUBLIC_ENS_DISPLAY_ROOT
NEXT_PUBLIC_SOUND_BYPASS
```

Note: `NEXT_PUBLIC_SOUND_REGISTRY` must be set to the address of the deployed `SingleUserSoundRegistry`. See the contracts section below.

### Zircuit Garfield Testnet

- Chain ID: 48898 (0xbf02)
- RPC: https://zircuit-garfield-testnet.drpc.org
- Explorer: https://explorer.garfield-testnet.zircuit.com

### Install and Run

```
npm i
npm run dev
```

The app runs at `http://localhost:3000`.

### Using the App

1. Connect your wallet (RainbowKit) and switch to Zircuit Garfield Testnet.
2. Ensure `NEXT_PUBLIC_SOUND_REGISTRY` is configured and the contract is deployed.
3. Try the sound login demo flows under the UI sections (e.g., Sound Detect/Play, Test Sound page).

### API Routes (server side)

- `app/api/ens-suggest/route.ts` — uses OpenAI
- `app/api/summary/route.ts` — uses OpenAI
- `app/api/thegraph/*` — uses The Graph tokens for balances, transfers, NFT activity, and OHLC prices

Set the corresponding keys in `.env.local` (see Environment section) for these routes to function.

### Contracts

This frontend integrates with `SingleUserSoundRegistry` on Zircuit Garfield Testnet. To deploy it and obtain the address:

- Follow `../contracts/README.md` to deploy the registry.
- After deployment, set `NEXT_PUBLIC_SOUND_REGISTRY` in `profileme/.env.local`.

### Additional Docs

- `ENS_README.md` — ENS helpers and usage
- `GRAPH_README.md` — The Graph endpoints and expected tokens
- `LEDGER_README.md` — Ledger DMK integration notes
