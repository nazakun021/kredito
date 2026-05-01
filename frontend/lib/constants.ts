// frontend/lib/constants.ts

export const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
export const REQUIRED_NETWORK =
  process.env.NEXT_PUBLIC_NETWORK?.toUpperCase() ?? "TESTNET";
