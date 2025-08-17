ProfileMe Contracts

SingleUserSoundRegistry (active)

This repository deploys and uses `SingleUserSoundRegistry` on Zircuit Garfield Testnet (chain id 48898). The contract stores a single user's `bytes32` sound hash and exposes:

- `soundHashOf(address) -> bytes32`: read the stored hash (returns zero for other addresses)
- `setSoundHash(bytes32)`: owner-only update

Setup

1. Create `.env` in this folder:

```
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
DEMO_USER_ADDRESS=0xUserWalletForDemo
DEMO_SOUND_HASH=0xYour32ByteHexHash
```

2. Install dependencies:

```
npm i
```

Deploy

Use Hardhat to deploy the registry with the values from `.env`:

```
npx hardhat run scripts/deploySingleUserSoundRegistry.js --network zircuitGarfield
```

Frontend configuration

Copy the printed contract address and set it in the frontend `profileme/.env.local` as:

```
NEXT_PUBLIC_SOUND_REGISTRY=0xDeployedRegistryAddress
```

