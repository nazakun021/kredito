'use client';

import axios from 'axios';
import {
  getAddress,
  getNetwork,
  isConnected,
  requestAccess,
  signTransaction,
} from '@stellar/freighter-api';
import { TESTNET_PASSPHRASE } from './constants';

const authApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/',
  timeout: 15000,
  withCredentials: true,
});

// ─── Phase 1.2 Helpers ──────────────────────────────────────────────────────

/**
 * Checks if the Freighter extension is installed.
 */
export async function checkFreighterInstalled(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  // Fast check window object
  const win = window as unknown as { freighterApi?: unknown; stellar?: { isFreighter?: boolean } };
  if (win.freighterApi || win.stellar?.isFreighter) return true;

  try {
    const result = await isConnected();
    return typeof result === 'boolean' ? result : !!result?.isConnected;
  } catch {
    return false;
  }
}

/**
 * Triggers the "Connection Request" popup and returns the address.
 */
export async function connectWallet(): Promise<{ address: string } | { error: string }> {
  try {
    const result = await requestAccess();
    if (!result || 'error' in result) {
      return { error: (result as { error?: string })?.error || 'User rejected or locked' };
    }
    return { address: result.address };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Silently retrieves the current address if already connected.
 * In v6.x, requestAccess() often handles this, but some versions have getPublicKey or getAddress.
 * We'll try requestAccess as it's the most reliable for current versions.
 */
export async function getConnectedAddress(): Promise<string | null> {
  try {
    const result = await getAddress();
    if (result && 'address' in result && result.address) {
      return result.address;
    }
  } catch {
    // Fall through to permissioned access for older Freighter versions.
  }

  try {
    const result = await requestAccess();
    return result && 'address' in result ? result.address : null;
  } catch {
    return null;
  }
}

/**
 * Returns the current network details.
 */
export async function getWalletNetwork(): Promise<{ network: string; networkPassphrase: string } | null> {
  try {
    const result = await getNetwork();
    if (!result || 'error' in result) return null;
    return {
      network: result.network,
      networkPassphrase: result.networkPassphrase
    };
  } catch {
    return null;
  }
}

/**
 * Signs a transaction XDR.
 */
export async function signTx(xdr: string, address: string): Promise<{ signedXdr: string } | { error: string }> {
  try {
    const result = await signTransaction(xdr, {
      networkPassphrase: TESTNET_PASSPHRASE,
      address, // Freighter API uses 'address' parameter
    });

    if (typeof result === 'string') return { signedXdr: result };
    
    if ('error' in result) {
      return { error: result.error || 'Failed to sign transaction' };
    }
    
    return { signedXdr: result.signedTxXdr };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Legacy / SEP-10 Helpers (Kept for backward compat / session logic) ──────

export async function waitForFreighter(attempts = 15): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    if (await checkFreighterInstalled()) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

export async function loginWithFreighter() {
  const connection = await connectWallet();
  if ('error' in connection) throw new Error(connection.error);

  const publicKey = connection.address;

  const challengeRes = await authApi.post<{ challenge: string }>('auth/challenge', {
    wallet: publicKey,
  });

  const signResult = await signTx(challengeRes.data.challenge, publicKey);
  if ('error' in signResult) throw new Error(signResult.error);

  const loginRes = await authApi.post<{
    wallet: string;
    token: string;
  }>('auth/login', {
    signedChallenge: signResult.signedXdr,
  });

  return loginRes.data;
}
