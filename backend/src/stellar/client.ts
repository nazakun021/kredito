import { Horizon, rpc, Keypair, Networks } from '@stellar/stellar-sdk';
import dotenv from 'dotenv';

dotenv.config();

export const networkPassphrase = process.env.NETWORK_PASSPHRASE || Networks.TESTNET;
export const horizonUrl = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';
export const rpcUrl = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';

export const horizonServer = new Horizon.Server(horizonUrl);
export const rpcServer = new rpc.Server(rpcUrl);

if (!process.env.ISSUER_SECRET_KEY) {
  throw new Error('ISSUER_SECRET_KEY not set in environment');
}

export const issuerKeypair = Keypair.fromSecret(process.env.ISSUER_SECRET_KEY);

export const contractIds = {
  phpcToken: process.env.PHPC_CONTRACT_ID || '',
  creditRegistry: process.env.REGISTRY_CONTRACT_ID || '',
  lendingPool: process.env.LENDING_POOL_CONTRACT_ID || '',
};
