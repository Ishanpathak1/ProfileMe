import { NextResponse } from "next/server";

function getGraphJwt(): string | null {
  return (
    process.env.THEGRAPH_TOKEN_API_JWT ||
    process.env.THEGRAPH_TOKEN ||
    process.env.GRAPH_TOKEN_API_JWT ||
    process.env.NEXT_PUBLIC_THEGRAPH_TOKEN_API_JWT ||
    null
  );
}

export async function GET(req: Request) {
  const token = getGraphJwt();
  if (!token) {
    return NextResponse.json({ error: "Server not configured with THEGRAPH_TOKEN_API_JWT" }, { status: 500 });
  }
  const url = new URL(req.url);
  const qs = url.searchParams;
  const upstream = new URL("https://token-api.thegraph.com/transfers/evm");
  qs.forEach((v, k) => upstream.searchParams.set(k, v));
  // Ensure defaults for ordering by oldest first when caller wants account age
  if (!upstream.searchParams.get("orderBy")) upstream.searchParams.set("orderBy", "timestamp");
  if (!upstream.searchParams.get("orderDirection")) upstream.searchParams.set("orderDirection", "asc");
  if (!upstream.searchParams.get("limit")) upstream.searchParams.set("limit", "1");
  try {
    const res = await fetch(upstream.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    const status = res.status;
    const data = await res.json().catch(() => ({ error: "Invalid JSON from upstream" }));
    return NextResponse.json(data, { status });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Upstream request failed" }, { status: 502 });
  }
}

