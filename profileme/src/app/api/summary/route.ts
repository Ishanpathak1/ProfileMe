import { NextResponse } from "next/server";

type SummaryPayload = {
  address?: string;
  totalUsd?: number;
  topChains?: Array<{ name: string; usdTotal: number }>;
  activeChains?: number;
  totalTxs?: number;
  earliestActivityTs?: number | null;
};

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const body = (await req.json().catch(() => null)) as SummaryPayload | null;
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const {
      address,
      totalUsd = 0,
      topChains = [],
      activeChains = 0,
      totalTxs = 0,
      earliestActivityTs,
    } = body;

    const topList = topChains
      .slice(0, 5)
      .map((c) => `${c.name} ($${Number(c.usdTotal || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })})`)
      .join(", ");

    const since = (() => {
      if (!earliestActivityTs || typeof earliestActivityTs !== "number") return null;
      try {
        const d = new Date(earliestActivityTs * 1000);
        if (Number.isNaN(d.getTime())) return null;
        return d.toLocaleDateString();
      } catch {
        return null;
      }
    })();

    const userHandle = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "this wallet";

    const sys = [
      "You are a witty, friendly crypto portfolio narrator.",
      "Tone: funny, cool, personal, but concise. Avoid emojis.",
      "Audience: the wallet owner. No financial advice.",
      "Keep it to a single short paragraph (60-120 words).",
    ].join(" \n");

    const user = [
      `Wallet: ${userHandle}`,
      `Total estimated portfolio: $${Number(totalUsd || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      `Active chains: ${activeChains}`,
      `Total recent txs: ${totalTxs}`,
      topList ? `Top chains by value: ${topList}` : null,
      since ? `First on-chain activity seen since: ${since}` : null,
    ]
      .filter(Boolean)
      .join(" \n");

    // Lazy import to keep edge/runtime size small
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.8,
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content:
            user +
            "\n\nWrite one fun, cool, personal paragraph summarizing what this says about the user’s multi-chain vibe. End with a playful nudge (no emojis).",
        },
      ],
    });

    const text = completion.choices?.[0]?.message?.content?.trim() || "Couldn’t generate summary right now.";
    return NextResponse.json({ summary: text });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to generate summary" }, { status: 500 });
  }
}

