"use client";
import Link from "next/link";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

const sponsors = [
  { src: "/logos/ethereum.svg", alt: "Ethereum" },
  { src: "/logos/polygon.svg", alt: "Polygon" },
  { src: "/logos/base.svg", alt: "Base" },
  { src: "/logos/arbitrum.svg", alt: "Arbitrum" },
  { src: "/logos/avalanche.svg", alt: "Avalanche" },
  { src: "/logos/sepolia.svg", alt: "Sepolia" },
  { src: "/logos/zircuit.svg", alt: "Zircuit" },
];

export default function Home() {
  return (
    <div className="px-6 py-10 max-w-7xl mx-auto" style={{ minHeight: "100vh" }}>
      {/* Header */}
      <div className="section" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/window.svg" alt="ProfileMe" width={28} height={28} style={{ opacity: 0.9 }} />
          <span className="section-title" style={{ fontSize: 18, fontWeight: 800 }}>ProfileMe</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/app" className="btn btn-primary">Launch App</Link>
        </div>
      </div>

      {/* Hero */}
      <div className="section" style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "center", marginTop: 24 }}>
        <div style={{ flex: "1 1 520px", minWidth: 280 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, padding: "4px 10px", borderRadius: 999, background: "rgba(55,255,139,0.1)", border: "1px solid rgba(55,255,139,0.25)", marginBottom: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--accent)" }} />
            <span style={{ fontWeight: 700, color: "var(--accent)" }}>AI</span>
            <span className="muted">ENS Names • Wallet Overviews</span>
          </div>
          <motion.h1
            initial="hidden"
            animate="show"
            transition={{ duration: 0.6, ease: "easeOut" }}
            variants={fadeUp}
            style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.1, margin: 0 }}
            className="section-title"
          >
            Ultrasound-based Authentication for Web3
          </motion.h1>
          <motion.p
            initial="hidden"
            animate="show"
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            variants={fadeUp}
            className="muted"
            style={{ marginTop: 12, fontSize: 16 }}
          >
            Log in with high-frequency sound from your device. Real-time portfolio and activity from The Graph. ENS-powered <span style={{ color: "var(--accent)", fontWeight: 700 }}>AI</span> names and playful <span style={{ color: "var(--accent)", fontWeight: 700 }}>AI</span> wallet overviews — all in one sleek dashboard.
          </motion.p>
          <motion.div
            initial="hidden"
            animate="show"
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            variants={fadeUp}
            style={{ display: "flex", gap: 12, marginTop: 18 }}
          >
            <Link href="/app" className="btn btn-primary">Get Started</Link>
            <Link href="/soundactions" className="btn btn-outline-primary">See Sound Login</Link>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="muted"
            style={{ fontSize: 13, marginTop: 12 }}
          >
            Backed by onchain data with resilient fallbacks. Works across top EVM networks.
          </motion.div>
          {/* Powered by strip */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14, flexWrap: "wrap" }}
          >
            <span className="muted" style={{ fontSize: 12 }}>Powered by</span>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <IconENS size={16} />
              <span style={{ fontSize: 12 }}>ENS</span>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <IconGraph size={16} />
              <span style={{ fontSize: 12 }}>The Graph</span>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <IconLedger size={16} />
              <span style={{ fontSize: 12 }}>Ledger</span>
            </div>
          </motion.div>
        </div>
        <div style={{ flex: "1 1 380px", minWidth: 280 }}>
          <AnimatedPreview />
        </div>
      </div>

      {/* Sponsors / Networks */}
      <div className="section" style={{ marginTop: 28 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>Supported networks</div>
        <div style={{ position: "relative", overflow: "hidden", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", padding: 10 }}>
          <motion.div
            style={{ display: "flex", alignItems: "center", gap: 28, padding: "6px 10px", width: "max-content" }}
            animate={{ x: [0, -600] }}
            transition={{ repeat: Infinity, repeatType: "loop", duration: 22, ease: "linear" }}
          >
            {[...sponsors, ...sponsors].map((s, i) => (
              <img key={i} src={s.src} alt={s.alt} height={22} style={{ height: 22, opacity: 0.9 }} />
            ))}
          </motion.div>
        </div>
      </div>

      {/* Features */}
      <div className="section" style={{ marginTop: 28 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>
          <FeatureCard
            title="Ultrasound Sign-in"
            description="Verify presence with inaudible audio from your device. No seed phrases."
            badge="Sound Auth"
          />
          <FeatureCard
            title="Real-time Data"
            description="Balances, transfers, NFTs and prices streamed from The Graph."
            badge="The Graph"
          />
          <FeatureCard
            title="ENS AI Names"
            description="Generate friendly ENS-style names backed by AI for your addresses."
            badge="ENS + AI"
          />
          <FeatureCard
            title="AI Wallet Overview"
            description="A funny, human-readable summary of your onchain activity."
            badge="LLM"
          />
        </div>
      </div>

      {/* Spotlight: ENS, The Graph, Ledger */}
      <div className="section" style={{ marginTop: 28 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
          <h3 className="section-title" style={{ margin: 0 }}>Spotlight</h3>
          <div className="muted" style={{ fontSize: 13 }}>Core technologies that power ProfileMe</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
          <SpotlightCard
            icon={<IconENS size={22} />}
            title="ENS + AI"
            description="We resolve ENS and generate AI-enhanced human names for addresses. Easy to read, easy to share."
            cta="ENS docs"
            href="https://docs.ens.domains/"
          />
          <SpotlightCard
            icon={<IconGraph size={22} />}
            title="The Graph"
            description="Real-time balances, NFTs, prices and activities via The Graph. Reliable, scalable, fast."
            cta="The Graph"
            href="https://thegraph.com/"
          />
          <SpotlightCard
            icon={<IconLedger size={22} />}
            title="Ledger"
            description="Device-first security workflows. Built with Ledger tooling for a secure UX future."
            cta="Ledger DMK"
            href="https://developers.ledger.com/"
          />
        </div>
      </div>

      {/* CTA */}
      <div className="section" style={{ marginTop: 32, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h3 className="section-title" style={{ margin: 0 }}>Start exploring your onchain identity</h3>
          <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>Connect, detect, and let AI narrate your wallet.</div>
        </div>
        <Link href="/app" className="btn btn-primary">Launch App</Link>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 28, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="muted" style={{ fontSize: 12 }}>© {new Date().getFullYear()} ProfileMe</div>
        <div className="muted" style={{ fontSize: 12 }}>Built with RainbowKit, Wagmi, The Graph and OpenAI</div>
      </div>
    </div>
  );
}

function FeatureCard({ title, description, badge }: { title: string; description: string; badge: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="elevated"
      style={{ borderRadius: 14, padding: 16, minHeight: 140 }}
    >
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, padding: "4px 8px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 10 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--accent)" }} />
        {badge}
      </div>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div className="muted" style={{ fontSize: 14 }}>{description}</div>
    </motion.div>
  );
}

function AnimatedPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className="elevated"
      style={{ borderRadius: 16, padding: 16, position: "relative", overflow: "hidden" }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        style={{
          height: 220,
          borderRadius: 12,
          background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
          border: "1px solid rgba(255,255,255,0.08)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Pulsing rings to suggest ultrasound */}
        <motion.div
          style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}
          initial={false}
          animate={{}}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              style={{
                position: "absolute",
                width: 40,
                height: 40,
                borderRadius: 9999,
                border: "2px solid rgba(55,255,139,0.55)",
                boxShadow: "0 0 30px rgba(55,255,139,0.25)",
              }}
              animate={{ scale: [1, 2.6], opacity: [0.9, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.6, ease: "easeOut" }}
            />
          ))}
        </motion.div>

        {/* Floating tiles representing widgets */}
        <motion.div style={{ position: "absolute", left: 14, top: 14, right: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="elevated"
              style={{ height: 64, borderRadius: 10, background: "rgba(255,255,255,0.04)" }}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.05 }}
              whileHover={{ y: -2 }}
            />
          ))}
        </motion.div>
      </motion.div>

      {/* AI highlight chip */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 12, padding: "6px 10px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, background: "rgba(55,255,139,0.08)" }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--accent)" }} />
        <span style={{ fontWeight: 700, color: "var(--accent)" }}>AI</span>
        <span className="muted">ENS Names + Wallet Overviews</span>
      </motion.div>
    </motion.div>
  );
}

function SpotlightCard({ icon, title, description, cta, href }: { icon: JSX.Element; title: string; description: string; cta?: string; href?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="elevated"
      style={{ borderRadius: 16, padding: 18, minHeight: 160 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: 10, background: "rgba(55,255,139,0.1)", border: "1px solid rgba(55,255,139,0.25)" }}>{icon}</div>
        <div style={{ fontWeight: 700 }}>{title}</div>
      </div>
      <div className="muted" style={{ fontSize: 14, lineHeight: 1.4 }}>{description}</div>
      {href && (
        <div style={{ marginTop: 12 }}>
          <a className="btn btn-outline-primary" href={href} target="_blank" rel="noreferrer">
            {cta || "Learn more"}
          </a>
        </div>
      )}
    </motion.div>
  );
}

function IconENS({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2l5.5 5.5-3.2 3.2L12 8.4l-2.3 2.3-3.2-3.2L12 2z" fill="url(#g1)" opacity="0.9"/>
      <path d="M12 22l-5.5-5.5 3.2-3.2L12 15.6l2.3-2.3 3.2 3.2L12 22z" fill="url(#g2)" opacity="0.9"/>
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="24" y2="24"><stop stopColor="#37FF8B"/><stop offset="1" stopColor="#2ee57c"/></linearGradient>
        <linearGradient id="g2" x1="24" y1="24" x2="0" y2="0"><stop stopColor="#37FF8B"/><stop offset="1" stopColor="#2ee57c"/></linearGradient>
      </defs>
    </svg>
  );
}

function IconGraph({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="11" cy="11" r="6" stroke="rgba(55,255,139,0.9)" strokeWidth="2" />
      <circle cx="18" cy="6" r="2" fill="rgba(55,255,139,0.9)" />
      <path d="M16 16l4 4" stroke="rgba(55,255,139,0.9)" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function IconLedger({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="8" height="8" rx="2" fill="rgba(55,255,139,0.15)" stroke="rgba(55,255,139,0.9)"/>
      <rect x="13" y="3" width="8" height="4" rx="2" fill="rgba(55,255,139,0.15)" stroke="rgba(55,255,139,0.9)"/>
      <rect x="13" y="9" width="8" height="12" rx="2" fill="rgba(55,255,139,0.15)" stroke="rgba(55,255,139,0.9)"/>
      <rect x="3" y="13" width="8" height="8" rx="2" fill="rgba(55,255,139,0.15)" stroke="rgba(55,255,139,0.9)"/>
    </svg>
  );
}
