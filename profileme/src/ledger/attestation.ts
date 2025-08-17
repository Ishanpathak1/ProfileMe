"use client";

import { dmkClient } from "./dmk";
import { bytesToHex, hexToBytes, isHex, recoverPublicKey, hashMessage, keccak256 } from "viem";
import { formatAttestationMessage } from "./attestationMessage";

export type LedgerAttestation = {
  pubkey: string;     // hex (uncompressed 0x04...)
  signature: string;  // of session nonce (EIP-191 personal_sign)
  issuedAt: number;   // timestamp
  expiresAt: number;  // timestamp
};

export const SESSION_NONCE_KEY = "ledger-session-nonce";
export const SESSION_ATTEST_KEY = "ledger-session-attestation";

function nowMs(): number {
  return Date.now();
}

function loadAttestationFromStorage(): LedgerAttestation | null {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(SESSION_ATTEST_KEY) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LedgerAttestation;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveAttestationToStorage(att: LedgerAttestation): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SESSION_ATTEST_KEY, JSON.stringify(att));
    }
  } catch {}
}

function getStoredNonce(): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(SESSION_NONCE_KEY) : null;
  } catch {
    return null;
  }
}

function storeNonce(nonceHex: string): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SESSION_NONCE_KEY, nonceHex);
    }
  } catch {}
}

function generateNonceHex(bytesLength = 32): string {
  const buf = new Uint8Array(bytesLength);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  return bytesToHex(buf);
}

function isExpired(att: LedgerAttestation): boolean {
  return nowMs() >= att.expiresAt;
}

export function getCurrentAttestation(): LedgerAttestation | null {
  const att = loadAttestationFromStorage();
  if (!att) return null;
  if (isExpired(att)) return null;
  return att;
}

export function clearAttestation(): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SESSION_NONCE_KEY);
      window.localStorage.removeItem(SESSION_ATTEST_KEY);
    }
  } catch {}
}

export async function ensureAttestation(): Promise<LedgerAttestation> {
  const existing = getCurrentAttestation();
  if (existing) return existing;

  // Generate or reuse a session nonce
  let nonceHex = getStoredNonce();
  if (!nonceHex || !isHex(nonceHex)) {
    nonceHex = generateNonceHex(32);
    storeNonce(nonceHex);
  }

  // Request public key and signature from Ledger
  const pubkey = await dmkClient.getAttestedPublicKey();
  const signature = await dmkClient.signNonce(nonceHex);

  // Verify locally: recover pubkey from signature of the message
  // We used personal_sign, so hash must be EIP-191 prefixed hash of message bytes
  const message = formatAttestationMessage(nonceHex);
  const hash = hashMessage(message);
  const recovered = await recoverPublicKey({ hash, signature });

  // Debug log
  try {
    // eslint-disable-next-line no-console
    console.debug("[Attestation] recovered pubkey:", recovered, "ledger pubkey:", pubkey);
  } catch {}

  if (!recovered || recovered.toLowerCase() !== pubkey.toLowerCase()) {
    // Fallback: compare derived addresses instead of raw pubkeys
    try {
      const a1 = publicKeyToEthAddress(recovered);
      const a2 = publicKeyToEthAddress(pubkey);
      if (a1.toLowerCase() !== a2.toLowerCase()) {
        throw new Error("mismatch");
      }
    } catch {
      throw new Error("Ledger signature did not match reported public key");
    }
  }

  const issuedAt = nowMs();
  const expiresAt = issuedAt + 60 * 60 * 1000; // 1 hour

  const att: LedgerAttestation = { pubkey, signature, issuedAt, expiresAt };
  saveAttestationToStorage(att);
  return att;
}

function publicKeyToEthAddress(pubkey: string): string {
  let hex = pubkey.toLowerCase();
  if (!hex.startsWith("0x")) hex = `0x${hex}`;
  const body = hex.slice(2);
  // Expect uncompressed pubkey 0x04 || X(32) || Y(32)
  if (body.length === 130 && body.startsWith("04")) {
    const rs = `0x${body.slice(2)}` as `0x${string}`;
    const hashed = keccak256(rs);
    return `0x${hashed.slice(-40)}`;
  }
  throw new Error("Unsupported public key format");
}

