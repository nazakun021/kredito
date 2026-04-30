// backend/src/config.ts

import { Networks } from '@stellar/stellar-sdk';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalCsv(value: string | undefined, fallback: string[]) {
  if (!value) {
    return fallback;
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

// Validate critical variables first to provide a better error experience
const isProduction = process.env.NODE_ENV === 'production';
const missingVars: string[] = [];
const check = (name: string, fallback?: string) => {
  const val = process.env[name] ?? fallback;
  if (!val) missingVars.push(name);
  return val ?? '';
};

// Check critical ones
check('JWT_SECRET');
check('ISSUER_SECRET_KEY');
check('PHPC_ID', process.env.PHPC_CONTRACT_ID);
check('REGISTRY_ID', process.env.REGISTRY_CONTRACT_ID);
check('LENDING_POOL_ID', process.env.LENDING_POOL_CONTRACT_ID);

if (missingVars.length > 0) {
  const errorMsg = `Missing critical environment variables: ${missingVars.join(', ')}. Please set these in your environment (e.g., Railway Variables).`;
  console.error(`❌ CONFIG ERROR: ${errorMsg}`);
  throw new Error(errorMsg);
}

export const config = {
  port: Number(process.env.PORT || 3001),
  jwtSecret: required('JWT_SECRET'),
  issuerSecretKey: required('ISSUER_SECRET_KEY'),
  adminApiSecret:
    process.env.ADMIN_API_SECRET ??
    (isProduction ? required('ADMIN_API_SECRET') : 'dev_secret_change_me'),
  webAuthSecretKey: required('WEB_AUTH_SECRET_KEY', process.env.ISSUER_SECRET_KEY),
  horizonUrl: required('HORIZON_URL', 'https://horizon-testnet.stellar.org'),
  sorobanRpcUrl: required('SOROBAN_RPC_URL', 'https://soroban-testnet.stellar.org'),
  networkPassphrase: required('NETWORK_PASSPHRASE', Networks.TESTNET),
  homeDomain: required('HOME_DOMAIN', 'localhost'),
  webAuthDomain: required('WEB_AUTH_DOMAIN', 'localhost:3001'),
  corsOrigins: optionalCsv(process.env.CORS_ORIGIN, ['http://localhost:3000']),
  approvalLedgerWindow: Number(process.env.APPROVAL_LEDGER_WINDOW || 500),
  contractIds: {
    phpcToken: required('PHPC_ID', process.env.PHPC_CONTRACT_ID),
    creditRegistry: required('REGISTRY_ID', process.env.REGISTRY_CONTRACT_ID),
    lendingPool: required('LENDING_POOL_ID', process.env.LENDING_POOL_CONTRACT_ID),
  },
} as const;

export const LEDGERS_PER_DAY = 17_280;
export const STROOPS_PER_UNIT = 10_000_000n;
