import { NextRequest } from "next/server";
import OpenAI from "openai";
import { sanitizeLabel, l2IsAvailable, isAcceptableLabel } from "@/lib/ens";

// acceptability is shared from lib via isAcceptableLabel

// Deterministic pseudoword generator from wallet address
function pseudoFromWallet(wallet: string, salt: number): string {
  const addr = String(wallet || "0x").replace(/^0x/i, "");
  const consonants = ["b","c","d","f","g","h","j","k","l","m","n","p","q","r","s","t","v","w","x","y","z"];
  const vowels = ["a","e","i","o","u","y"];
  let value = 0;
  for (let i = 0; i < addr.length; i++) {
    const ch = addr.charCodeAt(i);
    value = (value * 33 + ch + salt) >>> 0;
  }
  const syllables: string[] = [];
  const syllableCount = 2 + (value % 2); // 2-3 syllables
  for (let i = 0; i < syllableCount; i++) {
    value = (value * 1103515245 + 12345) >>> 0;
    const c1 = consonants[value % consonants.length];
    value = (value * 1103515245 + 12345) >>> 0;
    const v = vowels[value % vowels.length];
    value = (value * 1103515245 + 12345) >>> 0;
    const c2 = consonants[value % consonants.length];
    syllables.push(c1 + v + (value % 3 === 0 ? c2 : ""));
  }
  let word = syllables.join("");
  if (word.length > 12) word = word.slice(0, 12);
  return sanitizeLabel(word);
}

function generateFallbackCandidates(wallet: string, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const a = pseudoFromWallet(wallet, i + 17);
    const b = pseudoFromWallet(wallet, i + 137);
    const joinHyphen = (i % 3) === 0; // sometimes hyphenate
    const candidate = joinHyphen ? sanitizeLabel(`${a}-${b}`) : a;
    if (candidate && isLabelAcceptable(candidate)) out.push(candidate);
  }
  return Array.from(new Set(out)).slice(0, count);
}

type SuggestBody = {
  wallet: string;
  context?: string;
};

export async function POST(req: NextRequest) {
  try {
    const { wallet, context }: SuggestBody = await req.json();
    if (!wallet || typeof wallet !== "string") {
      return new Response(JSON.stringify({ error: "Missing wallet" }), { status: 400 });
    }

    const openaiKey = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "Missing OpenAI API key" }), { status: 500 });
    }

    const openai = new OpenAI({ apiKey: openaiKey });
    const prompt = `From the following persona paragraph, propose 12 highly unique, invented usernames that feel like human handles.
Rules:
- Only lowercase letters and hyphens
- Max 16 characters
- No spaces, no emojis, no brand names, no pop-culture/character names, no dictionary word + dictionary word combos
- Favor pseudowords/blends/syllabic constructs (e.g., 'velora-nex', 'quorix', 'zenoko', 'mavuro', 'talven', 'soryn')
- Avoid common words like 'happy', 'boss', 'baby', 'crypto', 'eth', 'bitcoin', etc.
- Must not be two obvious real words hyphenated
Persona paragraph: ${context ?? "n/a"}
Return ONLY a JSON array of strings.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a naming assistant. Output pure JSON array only." },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
    });

    const raw = response.choices?.[0]?.message?.content ?? "[]";
    let labels: string[] = [];
    try {
      labels = JSON.parse(raw);
    } catch {
      labels = [];
    }
    if (!Array.isArray(labels)) labels = [];

    // Sanitize, filter, and dedupe
    const unique = Array.from(new Set(labels.map((x) => sanitizeLabel(String(x)).slice(0, 16))))
      .filter((x) => Boolean(x) && isAcceptableLabel(String(x)))
      .slice(0, 20);

    // Check availability on L2 registrar
    const checked = await Promise.all(
      unique.map(async (label) => {
        const available = await l2IsAvailable(label).catch(() => false);
        return { label, fqdn: `${label}.l2`, available };
      })
    );

    let results = checked;

    // If none available, construct deterministic pseudoword fallbacks from the wallet and try again
    if (!results.some((r) => r.available)) {
      const fb = generateFallbackCandidates(wallet, 30);
      for (const label of fb) {
        const available = await l2IsAvailable(label).catch(() => false);
        results.push({ label, fqdn: `${label}.l2`, available });
        if (available) break;
      }
    }

    return Response.json({ suggestions: results });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), { status: 500 });
  }
}

