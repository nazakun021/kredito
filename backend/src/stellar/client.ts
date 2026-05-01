// backend/src/stellar/client.ts

import { Horizon, rpc, Keypair, Networks } from '@stellar/stellar-sdk';
import { config } from '../config';

// P3-10: Redundant dotenv.config() removed (already called in index.ts)

export const networkPassphrase = config.networkPassphrase || Networks.TESTNET;
export const horizonUrl = config.horizonUrl;
export const rpcUrl = config.rpcUrl;

export const horizonServer = new Horizon.Server(horizonUrl, {
  allowHttp: horizonUrl.startsWith('http://'),
});
export const rpcServer = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });

export const issuerKeypair = Keypair.fromSecret(config.issuerSecretKey);

export const contractIds = config.contractIds;
