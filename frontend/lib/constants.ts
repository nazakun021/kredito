// frontend/lib/constants.ts

export const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
export const MAINNET_PASSPHRASE = "Public Global Stellar Network ; October 2015";

export const REQUIRED_NETWORK =
  process.env.NEXT_PUBLIC_NETWORK?.toUpperCase() ?? "PUBLIC";

export const FRIENDLY_NETWORK_NAME =
  REQUIRED_NETWORK === 'PUBLIC' ? 'Mainnet' : 'Testnet';

export const NETWORK_PASSPHRASE =
  REQUIRED_NETWORK === 'PUBLIC' ? MAINNET_PASSPHRASE : TESTNET_PASSPHRASE;

export const XLM_SAC_ID = 
  REQUIRED_NETWORK === 'PUBLIC'
    ? "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA"
    : "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

export const XLM_STROOP_FACTOR = 10_000_000;

export const xlmToStroops = (xlm: number | string) => 
  Math.floor(Number(xlm) * XLM_STROOP_FACTOR);

export const stroopsToXlm = (stroops: number | string) => 
  Number(stroops) / XLM_STROOP_FACTOR;
