// frontend/lib/constants.ts

export const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
export const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";

export const REQUIRED_NETWORK =
  process.env.NEXT_PUBLIC_NETWORK?.toUpperCase() ?? "PUBLIC";

export const XLM_SAC_ID = 
  REQUIRED_NETWORK === 'PUBLIC'
    ? "CAS3J7GYLGXGR6AK3JSZOT6S4R4N64XUBOYI356G4RCHZNV6E6T56XF2"
    : "CDLZCB3MDGSIXPAA7CHBCYSTN7Z4S3YAV76A57XSTCO6N62E2GMRGRS4";

export const XLM_STROOP_FACTOR = 10_000_000;

export const xlmToStroops = (xlm: number | string) => 
  Math.floor(Number(xlm) * XLM_STROOP_FACTOR);

export const stroopsToXlm = (stroops: number | string) => 
  Number(stroops) / XLM_STROOP_FACTOR;
