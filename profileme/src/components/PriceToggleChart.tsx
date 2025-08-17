"use client";
import { useMemo, useState } from "react";
import TokenPriceChart from "./TokenPriceChart";
import { PRICE_TOGGLE_OPTIONS } from "@/lib/priceTokens";

export default function PriceToggleChart() {
  const options = PRICE_TOGGLE_OPTIONS;
  const [activeKey, setActiveKey] = useState<string>(options[0].key);
  const active = useMemo(() => options.find((o) => o.key === activeKey) || options[0], [activeKey, options]);

  return (
    <div className="rounded-xl p-4 section elevated">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs" style={{ color: "var(--foreground)" }}>Select Network</div>
        <div className="flex items-center gap-1">
          {options.map((o) => (
            <button
              key={o.key}
              className={`btn btn-xs ${activeKey === o.key ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setActiveKey(o.key)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <TokenPriceChart
        key={active.key}
        contract={active.contract}
        networkId={active.networkId}
        interval="daily"
        title={active.title}
      />
    </div>
  );
}

