// backend/src/config.ts

import { StrKey } from '@stellar/stellar-sdk';

const missingVars: string[] = [];

function check(name: string): string {
  const value = process.env[name];
  if (!value) {
    missingVars.push(name);
    return '';
  }
  return value;
}

// Check all critical variables at module load
check('JWT_SECRET');
check('ISSUER_SECRET_KEY');
check('ADMIN_API_SECRET');
check('WEB_AUTH_SECRET_KEY');
check('PHPC_ID');
check('REGISTRY_ID');
check('LENDING_POOL_ID');

if (missingVars.length > 0) {
  // In dev/test we might want to see all missing vars at once
  if (process.env.NODE_ENV !== 'test') {
    console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
    console.error('Please check your .env file.');
  }
}

const isProduction = process.env.NODE_ENV === 'production';

// P2-7: Removed redundant required() calls. Using process.env directly now that check() has verified them.
export const config = {
  port: Number(process.env.PORT || 3001),
  jwtSecret: process.env.JWT_SECRET!,
  issuerSecretKey: process.env.ISSUER_SECRET_KEY!,
  adminApiSecret: process.env.ADMIN_API_SECRET!,
  webAuthSecretKey: process.env.WEB_AUTH_SECRET_KEY!,
  
  contractIds: {
    phpcToken: process.env.PHPC_ID!,
    creditRegistry: process.env.REGISTRY_ID!,
    lendingPool: process.env.LENDING_POOL_ID!,
  },

  stellarNetwork: process.env.STELLAR_NETWORK || 'TESTNET',
  rpcUrl: process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
  horizonUrl: process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org',
  networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
  
  homeDomain: process.env.HOME_DOMAIN || 'kredito.finance',
  webAuthDomain: process.env.WEB_AUTH_DOMAIN || 'api.kredito.finance',
  
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  
  approvalLedgerWindow: Number(process.env.APPROVAL_LEDGER_WINDOW || 100), // ~10 minutes
  explorerUrl: process.env.STELLAR_EXPLORER_URL || 'https://stellar.expert/explorer/testnet',
};

// Derived constants
export const LEDGERS_PER_DAY = 17280; // Assuming 5s ledger close time
export const STROOPS_PER_UNIT = 10_000_000n;

// Validate issuer key if present
if (config.issuerSecretKey && !StrKey.isValidEd25519SecretSeed(config.issuerSecretKey)) {
  throw new Error('Invalid ISSUER_SECRET_KEY');
}

if (config.webAuthSecretKey && !StrKey.isValidEd25519SecretSeed(config.webAuthSecretKey)) {
  throw new Error('Invalid WEB_AUTH_SECRET_KEY');
}
