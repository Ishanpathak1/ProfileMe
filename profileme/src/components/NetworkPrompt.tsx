"use client";
import { useAccount, useChainId } from "wagmi";
import { useEffect, useState } from "react";
import { supportedChains } from "@/lib/wagmi";

export function NetworkPrompt() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isConnected) {
      setShow(false);
      return;
    }
    const isKnown = supportedChains.some((c) => c.id === chainId);
    setShow(!isKnown);
  }, [isConnected, chainId]);

  if (!show) return null;

  return (
    <div className="katana-modal-backdrop">
      <div className="katana-modal">
        <h5>Unsupported network</h5>
        <p>Please switch to one of the supported chains in your wallet to continue.</p>
        <button className="katana-btn" onClick={() => setShow(false)}>Dismiss</button>
      </div>
    </div>
  );
}

