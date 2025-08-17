"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { Address, Chain, Hash, formatEther } from "viem";
// getTransactions is experimental/optional; import via dynamic require to avoid type issues
import { getChainMeta } from "./chainMeta";
import { supportedChains, buildTransport } from "@/lib/wagmi";
import PortfolioOverview from "./PortfolioOverview";
import AiSummary from "./AiSummary";
import ChainSparkline from "./ChainSparkline";
import HistoricalBalanceChart from "./HistoricalBalanceChart";
import TokenPriceChart from "./TokenPriceChart";
import PriceToggleChart from "./PriceToggleChart";
import { PRICE_TOGGLE_OPTIONS } from "@/lib/priceTokens";
import NftActivityList from "./NftActivityList";
import { mapTheGraphNetworkToChainId, mapChainIdToTheGraphNetworkId } from "@/lib/thegraph";

type RecentTx = {
  hash: Hash;
  from?: Address;
  to: Address | null;
  value?: bigint;
  timestamp?: number;
  blockNumber?: bigint;
};

const GRAPH_SUPPORTED_NETWORKS = new Set<string>([
  "arbitrum-one",
  "avalanche",
  "base",
  "bsc",
  "mainnet",
  "matic",
  "optimism",
  "unichain",
]);

async function fetchBalancesViaTheGraph(address: Address): Promise<Array<{ value_usd?: number; network_id?: string }>> {
  try {
    // Determine Graph-supported networks from configured chains
    const nets = Array.from(
      new Set(
        supportedChains
          .map((c) => mapChainIdToTheGraphNetworkId(c.id))
          .filter((n): n is string => typeof n === "string" && GRAPH_SUPPORTED_NETWORKS.has(n))
      )
    );
    // Fetch balances per network to avoid defaulting to mainnet only
    const results = await Promise.all(
      nets.map(async (net) => {
        const url = `/api/thegraph/balances/${address}?network_id=${encodeURIComponent(net)}`;
        const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
        if (!res.ok) return [] as any[];
        const json: any = await res.json().catch(() => null);
        return Array.isArray(json?.data) ? json.data : [];
      })
    );
    const arr: any[] = results.flat();
    // Aggregate per network_id and SUM value_usd across tokens per network
    const perNet = new Map<string, number>();
    for (const it of arr) {
      const net: string | undefined = typeof it?.network_id === "string" ? it.network_id : undefined;
      let valUsd: number | undefined;
      const rawVal: unknown = (it as any)?.value_usd;
      if (typeof rawVal === "number") valUsd = rawVal;
      else if (typeof rawVal === "string") {
        const parsed = parseFloat(rawVal);
        if (Number.isFinite(parsed)) valUsd = parsed;
      }
      // Fallback: compute from amount * price_usd if value_usd missing
      if (valUsd == null) {
        const amtRaw: unknown = (it as any)?.amount;
        const decimals: unknown = (it as any)?.decimals;
        const priceUsd: unknown = (it as any)?.price_usd;
        let amountNum: number | undefined;
        if (typeof amtRaw === "string") {
          const parsedAmt = parseFloat(amtRaw);
          if (Number.isFinite(parsedAmt)) amountNum = parsedAmt;
        } else if (typeof amtRaw === "number") {
          amountNum = amtRaw;
        }
        const priceNum = typeof priceUsd === "number" ? priceUsd : (typeof priceUsd === "string" ? parseFloat(priceUsd) : NaN);
        if (amountNum != null && Number.isFinite(priceNum)) {
          // If amount appears to be an integer with decimals provided, scale it
          if (Number.isInteger(amountNum) && typeof decimals === "number" && decimals > 0) {
            amountNum = amountNum / Math.pow(10, decimals);
          }
          valUsd = amountNum * (priceNum as number);
        }
      }
      if (!net || typeof valUsd !== "number" || !Number.isFinite(valUsd)) continue;
      const prev = perNet.get(net) ?? 0;
      perNet.set(net, prev + valUsd);
    }
    return Array.from(perNet.entries()).map(([network_id, value]) => ({ network_id, value_usd: value }));
  } catch {
    return [];
  }
}

type ChainState = {
  balanceWei?: bigint;
  txCount?: number;
  error?: string;
  transactions?: Array<{
    hash: Hash;
    from?: Address;
    to?: Address | null;
    value?: bigint;
    timestamp?: number;
    blockNumber?: bigint;
  }>;
  loading: boolean;
  firstActivityTs?: number;
  totalUsd?: number;
  covalentNativeWei?: bigint;
};

// Precompute clients per chain using configured transport resolver

function formatEth(valueWei?: bigint) {
  if (valueWei === undefined) return "0";
  const n = Number(formatEther(valueWei));
  if (!Number.isFinite(n)) return formatEther(valueWei);
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function buildSparklineSeries(transactions?: Array<{ timestamp?: number; value?: bigint }>): Array<{ x: number; y: number }> {
  if (!transactions || transactions.length === 0) return [];
  const perDay = new Map<number, number>();
  for (const t of transactions) {
    if (typeof t.timestamp !== "number") continue;
    const day = Math.floor(t.timestamp / 86400) * 86400;
    const amt = t.value ? Math.abs(Number(formatEther(t.value))) : 0;
    if (!Number.isFinite(amt)) continue;
    perDay.set(day, (perDay.get(day) || 0) + amt);
  }
  const points = Array.from(perDay.entries()).sort((a, b) => a[0] - b[0]).map(([x, y]) => ({ x, y }));
  return points.slice(-14); // last 14 days
}

async function fetchRecentTransfersViaGraph(chainId: number, user: Address): Promise<RecentTx[]> {
  const networkId = mapChainIdToTheGraphNetworkId(chainId);
  if (!networkId || !GRAPH_SUPPORTED_NETWORKS.has(networkId)) return [];
  const qsBase = { network_id: networkId, orderBy: "timestamp", orderDirection: "desc", limit: "25" } as const;
  const paramsFrom = new URLSearchParams({ ...qsBase, from: user.toLowerCase() } as any);
  const paramsTo = new URLSearchParams({ ...qsBase, to: user.toLowerCase() } as any);
  const [resFrom, resTo] = await Promise.all([
    fetch(`/api/thegraph/transfers?${paramsFrom.toString()}`, { cache: "no-store" }),
    fetch(`/api/thegraph/transfers?${paramsTo.toString()}`, { cache: "no-store" }),
  ]);
  const [jsonFrom, jsonTo] = await Promise.all([
    resFrom.ok ? resFrom.json().catch(() => null) : Promise.resolve(null),
    resTo.ok ? resTo.json().catch(() => null) : Promise.resolve(null),
  ]);
  const mergeItems = (src: any): any[] => (Array.isArray(src?.data) ? src.data : []);
  const items = [...mergeItems(jsonFrom), ...mergeItems(jsonTo)];
  const seen = new Set<string>();
  const mapped = items
    .map<RecentTx | null>((it) => {
      const h = (it.tx_hash || it.hash) as string | undefined;
      const from = (it.from_address || it.from) as Address | undefined;
      const toRaw = (it.to_address || it.to) as Address | undefined;
      const to = (toRaw as Address) || null;
      const ts = typeof it.timestamp === "number"
        ? it.timestamp
        : (typeof it.datetime === "string" ? Math.floor(new Date(it.datetime).getTime() / 1000) : undefined);
      const blk = (typeof it.block_height === "number" || typeof it.block_height === "string") ? BigInt(it.block_height) : undefined;
      return h ? ({ hash: h as Hash, from, to, value: undefined, timestamp: ts, blockNumber: blk }) : null;
    })
    .filter((x): x is RecentTx => x != null)
    .filter((x) => (seen.has(x.hash) ? false : (seen.add(x.hash), true)));
  return mapped.slice(0, 25);
}

function formatAccountAge(fromTs?: number): string | null {
  if (!fromTs) return null;
  const now = Date.now();
  const diffMs = Math.max(0, now - fromTs * 1000);
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hrs = Math.floor(min / 60);
  const days = Math.floor(hrs / 24);
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years > 0) return `${years}y ${months}m`;
  if (months > 0) return `${months}m ${days % 30}d`;
  if (days > 0) return `${days}d`;
  if (hrs > 0) return `${hrs}h`;
  if (min > 0) return `${min}m`;
  return `${sec}s`;
}

export default function MultiChainDashboard({ simulate = false }: { simulate?: boolean } = {}) {
  const { address, isConnected } = useAccount();
  const [states, setStates] = useState<Record<number, ChainState>>({});
  const [graphBalances, setGraphBalances] = useState<Array<{ value_usd?: number; network_id?: string }> | null>(null);

  const chains = supportedChains;

  async function fetchRecentTransactions(chain: Chain, user: Address) {
    // Use The Graph Token API transfers for recent activity
    return fetchRecentTransfersViaGraph(chain.id, user);
  }

  const loadForChain = useCallback(
    async (chain: Chain, user: Address) => {
      setStates((s) => ({ ...s, [chain.id]: { ...(s[chain.id] || { loading: true }), loading: true, error: undefined } }));
      try {
        // Fetch recent transfers via The Graph
        let recent: Array<{ hash: Hash; from?: Address; to: Address | null; value?: bigint; timestamp?: number; blockNumber?: bigint; }>
          = await fetchRecentTransactions(chain, user);
        // Ensure we only keep unique and valid hashes; guard against undefined
        recent = (recent || []).filter((t) => typeof t.hash === "string" && t.hash);

        // Determine earliest timestamp; prefer Historical Balances (oldest across any token), then Transfers, fallback to local heuristics
        let firstActivityTs: number | undefined;
        try {
          const networkId = mapChainIdToTheGraphNetworkId(chain.id);
          if (networkId && GRAPH_SUPPORTED_NETWORKS.has(networkId)) {
            // 1) Historical balances earliest across tokens
            try {
              const baseUrl = `/api/thegraph/historical/balances/${user}?network_id=${encodeURIComponent(networkId)}&startTime=0&endTime=9999999999&limit=25`;
              const resFirst = await fetch(`${baseUrl}&page=1`, { cache: "no-store" });
              if (resFirst.ok) {
                const j1: any = await resFirst.json().catch(() => null);
                const totalPages: number | undefined = typeof j1?.pagination?.total_pages === "number" ? j1.pagination.total_pages : undefined;
                const targetPage = totalPages && totalPages > 0 ? totalPages : 1;
                const resLast = await fetch(`${baseUrl}&page=${targetPage}`, { cache: "no-store" });
                if (resLast.ok) {
                  const jLast: any = await resLast.json().catch(() => null);
                  const arr: any[] = Array.isArray(jLast?.data) ? jLast.data : [];
                  const tsList = arr
                    .map((it) => (typeof it?.datetime === "string" ? Math.floor(new Date(it.datetime).getTime() / 1000) : undefined))
                    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
                  if (tsList.length > 0) firstActivityTs = Math.min(...tsList);
                }
              }
            } catch {}

            // 2) Fallback to oldest transfer
            if (firstActivityTs == null) {
              const addrLc = user.toLowerCase();
              const paramsBase = { network_id: networkId, orderBy: "timestamp", orderDirection: "asc", limit: "1" } as const;
              const qFrom = new URLSearchParams({ ...paramsBase, from: addrLc } as any);
              const qTo = new URLSearchParams({ ...paramsBase, to: addrLc } as any);
              const [resFrom, resTo] = await Promise.all([
                fetch(`/api/thegraph/transfers?${qFrom.toString()}`, { cache: "no-store" }),
                fetch(`/api/thegraph/transfers?${qTo.toString()}`, { cache: "no-store" }),
              ]);
              const [jsonFrom, jsonTo] = await Promise.all([
                resFrom.ok ? resFrom.json().catch(() => null) : Promise.resolve(null),
                resTo.ok ? resTo.json().catch(() => null) : Promise.resolve(null),
              ]);
              const itemFrom = Array.isArray(jsonFrom?.data) && jsonFrom.data.length > 0 ? jsonFrom.data[0] : undefined;
              const itemTo = Array.isArray(jsonTo?.data) && jsonTo.data.length > 0 ? jsonTo.data[0] : undefined;
              const tsFrom = typeof itemFrom?.timestamp === "number" ? itemFrom.timestamp : (typeof itemFrom?.datetime === "string" ? Math.floor(new Date(itemFrom.datetime).getTime() / 1000) : undefined);
              const tsTo = typeof itemTo?.timestamp === "number" ? itemTo.timestamp : (typeof itemTo?.datetime === "string" ? Math.floor(new Date(itemTo.datetime).getTime() / 1000) : undefined);
              const nums = [tsFrom, tsTo].filter((v): v is number => typeof v === "number" && Number.isFinite(v));
              if (nums.length > 0) firstActivityTs = Math.min(...nums);
            }
          }
        } catch {}
        if (firstActivityTs == null) {
          const tsList = recent.map((t) => t.timestamp).filter((v): v is number => typeof v === "number");
          if (tsList.length > 0) {
            firstActivityTs = Math.min(...tsList);
          }
        }

        // Fetch token balances via The Graph and derive per-chain totals/native balances
        let totalUsd: number | undefined;
        let graphNativeWei: bigint | undefined;
        try {
          // Prefer The Graph Token API totals
          try {
            const tgData = graphBalances ?? (await fetchBalancesViaTheGraph(user));
            if (Array.isArray(tgData) && tgData.length > 0) {
              const perChain = tgData.filter((it) => mapTheGraphNetworkToChainId(it.network_id) === chain.id);
              if (perChain.length > 0) {
                const sumChain = perChain.reduce((acc, it) => acc + (typeof it.value_usd === "number" ? it.value_usd : 0), 0);
                if (Number.isFinite(sumChain) && sumChain > 0) {
                  totalUsd = sumChain;
                }
              }
            }
          } catch {}

          // Also try to resolve native token balance (in wei) for display fallback
          try {
            const networkId = mapChainIdToTheGraphNetworkId(chain.id);
            if (networkId && GRAPH_SUPPORTED_NETWORKS.has(networkId)) {
              const url = `/api/thegraph/balances/${user}?network_id=${encodeURIComponent(networkId)}`;
              const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
              if (res.ok) {
                const json: any = await res.json().catch(() => null);
                const items: any[] = Array.isArray(json?.data) ? json.data : [];
                const native = items.find((it) => typeof it?.contract === "string" && it.contract.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
                const amtStr: string | undefined = native?.amount;
                if (amtStr && /^\d+$/.test(amtStr)) {
                  try { graphNativeWei = BigInt(amtStr); } catch {}
                } else {
                  const valNum: unknown = native?.value;
                  if (typeof valNum === "number" && Number.isFinite(valNum) && valNum > 0) {
                    try { graphNativeWei = BigInt(Math.floor(valNum * 1e18)); } catch {}
                  }
                }
                // If still no native, but there are ERC-20s, avoid showing "0 ETH" by leaving native undefined and totalUsd will reflect
                if (!graphNativeWei && Array.isArray(items) && items.length > 0) {
                  graphNativeWei = undefined;
                }
              }
            }
          } catch {}

          // No Covalent fallback; rely solely on The Graph Token API in this path
        } catch {}

        setStates((s) => ({
          ...s,
          [chain.id]: {
            ...s[chain.id],
            loading: false,
            balanceWei: graphNativeWei ?? BigInt(0),
            txCount: (recent || []).length,
            transactions: recent,
            firstActivityTs,
            totalUsd,
            covalentNativeWei: graphNativeWei,
          },
        }));
      } catch (e: any) {
        setStates((s) => ({ ...s, [chain.id]: { ...(s[chain.id] || {}), loading: false, error: e?.message || "Failed" } }));
      }
    },
    [graphBalances]
  );

  // Simulated progressive loading
  useEffect(() => {
    if (!simulate || !isConnected || !address) return;

    // Deterministic pseudo-random generator based on address and chain id
    const seeded = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };
    const addrSeed = (() => {
      try {
        return parseInt(address.slice(2, 10), 16);
      } catch {
        return 1;
      }
    })();
    const now = Math.floor(Date.now() / 1000);
    const buildHash = (seed: number): Hash => {
      const hexChars = "0123456789abcdef";
      let s = address.replace(/^0x/, "");
      let out = "";
      for (let i = 0; i < 64; i++) {
        const mixSeed = seed + i * 17 + (s.charCodeAt(i % s.length) || 0);
        const r = seeded(mixSeed);
        const nibble = Math.floor(r * 16) & 0xf;
        out += hexChars[nibble];
      }
      return ("0x" + out) as Hash;
    };

    // Start with everything loading
    const initialStates: Record<number, ChainState> = {};
    chains.forEach((ch) => { initialStates[ch.id] = { loading: true }; });
    setStates(initialStates);

    const pickUsd = (seed: number): number => {
      // All totals < 100 with gentle distribution
      const buckets: Array<[number, number, number]> = [
        [10, 30, 0.42],  // ~10–30
        [30, 60, 0.35],  // ~30–60
        [60, 90, 0.18],  // ~60–90
        [90, 99, 0.05],  // ~90–99
      ];
      const r = seeded(seed);
      let acc = 0;
      let chosen: [number, number, number] = buckets[0];
      for (const b of buckets) {
        acc += b[2];
        if (r <= acc) { chosen = b; break; }
      }
      const [min, max] = [chosen[0], chosen[1]];
      const v = min + Math.floor(seeded(seed + 13) * (max - min + 1));
      return Math.min(99, Math.max(10, v));
    };

    const timeouts: Array<ReturnType<typeof setTimeout>> = [];
    let cancelled = false;

    // Assign random delays per chain so order is randomized, with ETH first and Zircuit second
    const totalSpanMs = 150_000;
    const ethFirstMs = 2_000; // ~2s
    const zircuitSecondMs = 6_000; // ~6s
    const othersMinMs = 8_000; // others start after zircuit
    const othersMaxMs = totalSpanMs;
    const ZIRCUIT_ID = 48898;
    const delayById = new Map<number, number>();
    // Pre-assign ETH then Zircuit if present
    if (chains.some((c) => c.id === 1)) delayById.set(1, ethFirstMs);
    if (chains.some((c) => c.id === ZIRCUIT_ID)) delayById.set(ZIRCUIT_ID, zircuitSecondMs);

    // Randomize remaining chains with seeded uniform distribution
    const remaining = chains.filter((c) => !delayById.has(c.id));
    remaining.forEach((c, idx) => {
      const seedBase = addrSeed + c.id + idx * 7 + 99;
      const jitter = Math.floor(seeded(seedBase) * (othersMaxMs - othersMinMs));
      const candidate = othersMinMs + jitter;
      delayById.set(c.id, candidate);
    });

    chains.forEach((ch, idx) => {
      const seedBase = addrSeed + ch.id + idx * 7;
      const delay = delayById.get(ch.id) ?? (othersMinMs + Math.floor(seeded(seedBase) * (othersMaxMs - othersMinMs)));

      const schedule = setTimeout(() => {
        if (cancelled) return;
        const usd = pickUsd(seedBase);
        const txCount = Math.max(0, Math.floor(seeded(seedBase + 1) * 5) - 1); // 0–4
        const txLen = Math.min(3, Math.max(0, txCount));
        const txs: NonNullable<ChainState["transactions"]> = [];
        for (let i = 0; i < txLen; i++) {
          const ts = now - Math.floor(seeded(seedBase + 3 + i) * 86400 * 10);
          const valWei = BigInt(Math.floor(seeded(seedBase + 4 + i) * 1e17)); // up to 0.1 ETH
          txs.push({
            hash: buildHash(seedBase + 5 + i),
            from: address,
            to: address,
            value: valWei,
            timestamp: ts,
            blockNumber: BigInt(1_000_000 + idx * 100 + i),
          });
        }
        // Compute account age: ETH and Polygon about 2–3 years, others months to days
        let firstTs: number | undefined;
        const days = 86400;
        if (ch.id === 1 || ch.id === 137) {
          const yearsBack = 2 + Math.floor(seeded(seedBase + 21) * 2); // 2 or 3 years
          const dayOffset = Math.floor(seeded(seedBase + (ch.id === 1 ? 23 : 29)) * 60); // up to ~2 months delta, differs per chain
          firstTs = now - (yearsBack * 365 * days + dayOffset * days);
        } else {
          const maxDays = 180; // up to ~6 months
          const minDays = 5;   // at least a few days old
          const ageDays = minDays + Math.floor(seeded(seedBase + 31) * (maxDays - minDays + 1));
          firstTs = now - ageDays * days;
        }

        setStates((s) => ({
          ...s,
          [ch.id]: {
            ...(s[ch.id] || {}),
            loading: false,
            balanceWei: BigInt(0),
            txCount,
            transactions: txs,
            firstActivityTs: firstTs,
            totalUsd: usd,
          },
        }));
      }, delay);
      timeouts.push(schedule);
    });

    return () => {
      cancelled = true;
      for (const t of timeouts) clearTimeout(t);
    };
  }, [simulate, isConnected, address, chains]);

  // Real data loading
  useEffect(() => {
    if (simulate || !isConnected || !address) return;

    // Fire a single request for Token API balances and cache locally, then load chains
    (async () => {
      try {
        const tg = await fetchBalancesViaTheGraph(address);
        setGraphBalances(tg);
      } catch {
        setGraphBalances([]);
      } finally {
        chains.forEach((ch) => {
          void loadForChain(ch, address);
        });
      }
    })();
  }, [simulate, isConnected, address, chains, loadForChain]);

  const totalsByChain = useMemo(() => {
    return chains
      .map((chain) => {
        const st = states[chain.id];
        const meta = getChainMeta(chain);
        const usdTotal = typeof st?.totalUsd === "number" ? st!.totalUsd : 0;
        return { chainName: meta.displayName, usdTotal, color: meta.primaryColor };
      })
      .filter((t) => t.usdTotal > 0);
  }, [chains, states]);

  const aiInput = useMemo(() => {
    if (!address) return null;
    const totalUsd = totalsByChain.reduce((acc, t) => acc + (Number.isFinite(t.usdTotal) ? t.usdTotal : 0), 0);
    const topChains = totalsByChain
      .slice()
      .sort((a, b) => b.usdTotal - a.usdTotal)
      .map((t) => ({ name: t.chainName, usdTotal: t.usdTotal }));
    const activeChains = totalsByChain.length;
    const totalTxs = chains.reduce((acc, ch) => acc + (states[ch.id]?.txCount || 0), 0);
    const earliestActivityTs = (() => {
      const list = chains
        .map((ch) => states[ch.id]?.firstActivityTs)
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      if (list.length === 0) return null;
      return Math.min(...list);
    })();
    return { address, totalUsd, topChains, activeChains, totalTxs, earliestActivityTs };
  }, [address, chains, states, totalsByChain]);

  if (!isConnected) return null;

  return (
    <div className="space-y-4">
      {!simulate && address ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <HistoricalBalanceChart address={address} networkId="mainnet" />
            <PriceToggleChart />
          </div>
          <div className="lg:col-span-1">
            <NftActivityList networkId="mainnet" />
          </div>
        </div>
      ) : null}
      {totalsByChain.length > 0 && (
        <PortfolioOverview totalsByChain={totalsByChain} height={150} />
      )}
      <AiSummary address={address} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {chains.map((chain) => {
        const meta = getChainMeta(chain);
        const st = states[chain.id] || { loading: true };
        const spark = buildSparklineSeries(st.transactions);
        return (
          <section key={chain.id} className="rounded-xl p-4 section elevated">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <img src={meta.logoPath} alt={meta.displayName} width={22} height={22} />
                <div>
                  <div className="text-xs opacity-75">{chain.name}</div>
                  <div className="font-semibold text-sm" style={{ color: meta.primaryColor }}>{meta.displayName}</div>
                  {st.firstActivityTs ? (
                    <div className="text-[10px] opacity-70">
                      {`Since ${new Date(st.firstActivityTs * 1000).toLocaleDateString()} • ${formatAccountAge(st.firstActivityTs)}`}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] opacity-70">Balance</div>
                <div className="text-base font-bold">
                  {typeof st.totalUsd === "number" && st.totalUsd > 0 ? (
                    `$${st.totalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                  ) : (
                    (() => {
                      const native = (st.balanceWei && st.balanceWei > BigInt(0)) ? st.balanceWei : (st.covalentNativeWei && st.covalentNativeWei > BigInt(0) ? st.covalentNativeWei : undefined);
                      if (!native) return st.loading ? "—" : `0 ${chain.nativeCurrency.symbol}`;
                      return `${formatEth(native)} ${chain.nativeCurrency.symbol}`;
                    })()
                  )}
                </div>
              </div>
            </div>

            {st.error && (
              <div className="text-red-400 text-sm mb-2">{st.error}</div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="text-[10px] opacity-70 mb-1">Transactions</div>
                <div className="text-sm font-semibold">{st.txCount ?? "-"}</div>
              </div>
              <div className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="text-[10px] opacity-70 mb-1">Activity (14d)</div>
                <ChainSparkline color={meta.primaryColor} series={spark} />
              </div>
              <div className="rounded-lg p-2 col-span-1 md:col-span-1 lg:col-span-1" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="text-[10px] opacity-70 mb-2">Recent</div>
                <div>
                  {st.loading && (
                    <div className="space-y-2">
                      <div className="skeleton-line" style={{ width: "90%" }} />
                      <div className="skeleton-line" style={{ width: "80%" }} />
                      <div className="skeleton-line" style={{ width: "70%" }} />
                    </div>
                  )}
                  {!st.loading && (st.transactions || []).slice(0, 3).map((t, idx) => {
                    const when = typeof t.timestamp === "number"
                      ? new Date(t.timestamp * 1000).toLocaleDateString()
                      : (t.blockNumber != null ? `#${String(t.blockNumber)}` : "—");
                    const hashSafe = typeof t.hash === "string" && t.hash.length >= 14
                      ? `${t.hash.slice(0,8)}…${t.hash.slice(-6)}`
                      : (typeof t.hash === "string" ? t.hash : "—");
                    const valueSafe = typeof t.value === "bigint" ? formatEth(t.value) : "0";
                    const key = typeof t.hash === "string" && t.hash.length > 0 ? t.hash : `${chain.id}-${idx}`;
                    return (
                      <div key={key} className="flex items-center justify-between text-xs mb-1">
                        <span className="opacity-70 mr-2 truncate">{when}</span>
                        <span className="font-mono truncate" style={{ maxWidth: 120 }}>{hashSafe}</span>
                        <span className="font-mono ml-2">{valueSafe}</span>
                      </div>
                    );
                  })}
                  {!st.loading && (!st.transactions || st.transactions.length === 0) && (
                    <div className="opacity-70 text-xs">No recent txs.</div>
                  )}
                </div>
              </div>
            </div>
          </section>
        );
      })}
      </div>
    </div>
  );
}

