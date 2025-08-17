## Data APIs we actually use (ProfileMe)

This app uses a small set of local Next.js API routes that proxy The Graph Token API with a server-side JWT. Below are the exact routes the UI calls and the query params we use in code.

### Env
```bash
# profileme/.env.local
THEGRAPH_TOKEN_API_JWT=your_graph_token_api_jwt
```

### Local API routes used by the app

- Balances (current per-network token balances)
  - Route: `/api/thegraph/balances/[address]`
  - Query params we pass: `network_id`
  - Usage in code: `MultiChainDashboard` aggregates USD totals per network.

- Historical balances (time-series)
  - Route: `/api/thegraph/historical/balances/[address]`
  - Query params we pass: `network_id`, `interval=daily`, `startTime`, `endTime`, `limit`, `page`
  - Usage in code: `HistoricalBalanceChart` for ETH balance over time; dashboard uses it to infer earliest activity timestamp.

- Transfers (recent/oldest activity)
  - Route: `/api/thegraph/transfers`
  - Query params we pass: `network_id`, `from` or `to`, `orderBy=timestamp`, `orderDirection=desc|asc`, `limit`
  - Usage in code: `MultiChainDashboard` recent activity and fallback for first-seen timestamp.

- OHLC prices (per-token price series)
  - Route: `/api/thegraph/ohlc/prices/evm/[contract]`
  - Query params we pass: `network_id`, `interval=1d|4h|1h|1w`, `startTime`, `endTime`, `limit`, `page`
  - Usage in code: `TokenPriceChart` and `PriceToggleChart` for WETH/WMATIC/WAVAX across networks.

- NFT activities
  - Route: `/api/thegraph/nft/activities`
  - Typical params: `address`, `network_id`, `limit`, `page`
  - Usage in code: `NftActivityList` on the dashboard.

### Notes
- All of the above routes attach `Authorization: Bearer ${THEGRAPH_TOKEN_API_JWT}` on the server and forward query params to upstream.
- We keep `cache: "no-store"` for fresh reads in the app.

### Quick check (curl)
```bash
curl "http://localhost:3000/api/thegraph/balances/0xabcdef...1234?network_id=base"
curl "http://localhost:3000/api/thegraph/historical/balances/0xabcdef...1234?network_id=mainnet&interval=daily&limit=90&page=1"
curl "http://localhost:3000/api/thegraph/transfers?network_id=polygon&from=0xabcdef...1234&orderBy=timestamp&orderDirection=desc&limit=25"
curl "http://localhost:3000/api/thegraph/ohlc/prices/evm/0xTokenContract?network_id=arbitrum-one&interval=1d&limit=90"
curl "http://localhost:3000/api/thegraph/nft/activities?address=0xabcdef...1234&network_id=base&limit=20"
```

