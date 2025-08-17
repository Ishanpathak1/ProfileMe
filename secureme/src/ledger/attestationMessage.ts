export function formatAttestationMessage(nonceHex: string): string {
  const clean = nonceHex.startsWith("0x") ? nonceHex : `0x${nonceHex}`;
  return `SecureMe session attestation\nNonce: ${clean}`;
}

