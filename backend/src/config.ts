// backend/src/config.ts

import { Networks } from '@stellar/stellar-sdk';

function required(name: string, fallback?: string) {
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

export const config = {
  port: Number(process.env.PORT || 3001),
  jwtSecret: required('JWT_SECRET'),
  issuerSecretKey: required('ISSUER_SECRET_KEY'),
  adminApiSecret: required('ADMIN_API_SECRET'),
  webAuthSecretKey: required('WEB_AUTH_SECRET_KEY', process.env.ISSUER_SECRET_KEY),
  horizonUrl: required('HORIZON_URL', 'https://horizon-testnet.stellar.org'),
  sorobanRpcUrl: required('SOROBAN_RPC_URL', 'https://soroban-testnet.stellar.org'),
  networkPassphrase: required('NETWORK_PASSPHRASE', Networks.TESTNET),
  homeDomain: required('HOME_DOMAIN', 'localhost'),
  webAuthDomain: required('WEB_AUTH_DOMAIN', 'localhost:3001'),
  corsOrigins: optionalCsv(process.env.CORS_ORIGIN, ['http://localhost:3000']),
  devKnownBorrowers: optionalCsv(process.env.DEV_KNOWN_BORROWERS, []),
  approvalLedgerWindow: Number(process.env.APPROVAL_LEDGER_WINDOW || 500),
  contractIds: {
    phpcToken: required('PHPC_ID', process.env.PHPC_CONTRACT_ID),
    creditRegistry: required('REGISTRY_ID', process.env.REGISTRY_CONTRACT_ID),
    lendingPool: required('LENDING_POOL_ID', process.env.LENDING_POOL_CONTRACT_ID),
  },
} as const;

export const LEDGERS_PER_DAY = 17_280;
export const STROOPS_PER_UNIT = 10_000_000n;
