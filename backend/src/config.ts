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

const encryptionKey = required('ENCRYPTION_KEY');
if (!/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
  throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters');
}

export const config = {
  port: Number(process.env.PORT || 3001),
  jwtSecret: required('JWT_SECRET'),
  encryptionKey,
  issuerSecretKey: required('ISSUER_SECRET_KEY'),
  horizonUrl: required('HORIZON_URL', 'https://horizon-testnet.stellar.org'),
  sorobanRpcUrl: required('SOROBAN_RPC_URL', 'https://soroban-testnet.stellar.org'),
  networkPassphrase: required('NETWORK_PASSPHRASE', Networks.TESTNET),
  corsOrigins: optionalCsv(process.env.CORS_ORIGIN, ['http://localhost:3000']),
  contractIds: {
    phpcToken: required('PHPC_ID', process.env.PHPC_CONTRACT_ID),
    creditRegistry: required('REGISTRY_ID', process.env.REGISTRY_CONTRACT_ID),
    lendingPool: required('LENDING_POOL_ID', process.env.LENDING_POOL_CONTRACT_ID),
  },
};

export const LEDGERS_PER_DAY = 17_280;
export const STROOPS_PER_UNIT = 10_000_000n;
