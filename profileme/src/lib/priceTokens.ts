export type PriceToggleOption = {
  key: string; // unique key for UI
  label: string; // short label for toggle
  title: string; // chart title
  networkId: string; // The Graph network_id
  contract: string; // wrapped native token contract
};

// Wrapped native tokens for popular EVM mainnets
// Note: Using wrapped native tokens for native price (e.g., WETH/WMATIC/WAVAX)
export const PRICE_TOGGLE_OPTIONS: PriceToggleOption[] = [
  {
    key: "eth",
    label: "ETH",
    title: "ETH Price (close)",
    networkId: "mainnet",
    contract: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH (Ethereum)
  },
  {
    key: "eth-arb",
    label: "ARB ETH",
    title: "ETH on Arbitrum (close)",
    networkId: "arbitrum-one",
    contract: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH (Arbitrum One)
  },
  {
    key: "eth-base",
    label: "Base ETH",
    title: "ETH on Base (close)",
    networkId: "base",
    contract: "0x4200000000000000000000000000000000000006", // WETH (Base)
  },
  {
    key: "matic",
    label: "MATIC",
    title: "MATIC Price (close)",
    networkId: "matic",
    contract: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC (Polygon PoS)
  },
  {
    key: "avax",
    label: "AVAX",
    title: "AVAX Price (close)",
    networkId: "avalanche",
    contract: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", // WAVAX (Avalanche C-Chain)
  },
];

