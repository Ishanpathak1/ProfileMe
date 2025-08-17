"use client";

import { v4 as uuidv4 } from "uuid";

export type SoundAction =
  | { type: "openUrl"; url: string }
  | { type: "noop" };

export type Mapping = {
  id: string;
  frequencyHz: number;
  label: string;
  action: SoundAction;
  createdAt: number;
  updatedAt: number;
};

export const DEFAULT_MAPPINGS: Mapping[] = [
  {
    id: uuidv4(),
    frequencyHz: 1000,
    label: "MetaMask",
    action: { type: "openUrl", url: "https://metamask.io" },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: uuidv4(),
    frequencyHz: 2000,
    label: "Ledger",
    action: { type: "openUrl", url: "https://www.ledger.com" },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: uuidv4(),
    frequencyHz: 3000,
    label: "ENS",
    action: { type: "openUrl", url: "https://ens.domains" },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

const NS = "sound-actions.v2";

function key(pubkey?: string): string | null {
  if (!pubkey) return null;
  return `${NS}:${pubkey}`;
}

export function loadMappings(pubkey?: string): Mapping[] {
  const storageKey = key(pubkey);
  if (!storageKey) {
    // read-only defaults
    return [...DEFAULT_MAPPINGS];
  }
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
    if (!raw) return [...DEFAULT_MAPPINGS];
    const parsed = JSON.parse(raw) as Mapping[];
    if (!Array.isArray(parsed)) return [...DEFAULT_MAPPINGS];
    return parsed;
  } catch {
    return [...DEFAULT_MAPPINGS];
  }
}

export function saveMappings(pubkey: string, list: Mapping[]): void {
  const storageKey = key(pubkey);
  if (!storageKey) return;
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, JSON.stringify(list));
    }
  } catch {}
}

export function canEdit(attested: boolean): boolean {
  return Boolean(attested);
}

