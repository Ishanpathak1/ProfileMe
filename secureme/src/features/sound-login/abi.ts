export const soundRegistryAbi = [
  {
    type: "function",
    name: "soundHashOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bytes32" }],
  },
] as const;

export const soundRegistryAddress = (process.env
  .NEXT_PUBLIC_SOUND_REGISTRY ||
  "") as `0x${string}`;

