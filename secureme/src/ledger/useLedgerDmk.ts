"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dmkClient, type LedgerDeviceInfo } from "./dmk";

type HookState = {
  supported: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  device: LedgerDeviceInfo | null;
  error: string | null;
};

export function useLedgerDmk() {
  const [state, setState] = useState<HookState>(() => ({
    supported: false,
    isConnecting: false,
    isConnected: false,
    device: null,
    error: null,
  }));

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      const supported = await dmkClient.isSupported();
      if (!mountedRef.current) return;
      setState((s) => ({ ...s, supported }));
      const current = dmkClient.getCurrentDevice();
      if (current) {
        setState((s) => ({ ...s, isConnected: true, device: current }));
      }
    })();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const offConnected = dmkClient.on("connected", (device: LedgerDeviceInfo) => {
      if (!mountedRef.current) return;
      setState((s) => ({ ...s, isConnecting: false, isConnected: true, device, error: null }));
    });
    const offDisconnected = dmkClient.on("disconnected", () => {
      if (!mountedRef.current) return;
      setState((s) => ({ ...s, isConnected: false, device: null }));
    });
    const offError = dmkClient.on("error", (payload: any) => {
      if (!mountedRef.current) return;
      const msg = (payload && (payload.message || payload.name)) || String(payload);
      setState((s) => ({ ...s, isConnecting: false, error: msg }));
    });
    return () => {
      offConnected();
      offDisconnected();
      offError();
    };
  }, []);

  const connect = useCallback(async () => {
    const supported = await dmkClient.isSupported();
    if (!supported) {
      setState((s) => ({ ...s, error: "Ledger over WebHID/WebUSB not supported by this browser. Try Chrome." }));
      return;
    }
    setState((s) => ({ ...s, isConnecting: true, error: null }));
    try {
      const info = await dmkClient.requestDevice();
      await dmkClient.open(info?.id);
      // 'connected' event will update state.
    } catch (e: any) {
      const msg = (e && (e.message || e.name)) || String(e);
      setState((s) => ({ ...s, isConnecting: false, error: msg }));
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await dmkClient.close();
    } catch {}
  }, []);

  return useMemo(() => ({
    supported: state.supported,
    isConnecting: state.isConnecting,
    isConnected: state.isConnected,
    device: state.device,
    error: state.error,
    connect,
    disconnect,
  }), [state, connect, disconnect]);
}

export type { LedgerDeviceInfo } from "./dmk";

