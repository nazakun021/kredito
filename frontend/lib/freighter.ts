'use client';

declare global {
  interface Window {
    freighterApi?: {
      getPublicKey?: () => Promise<string>;
      requestAccess?: () => Promise<void>;
      signTransaction?: (
        xdr: string,
        options: { networkPassphrase: string }
      ) => Promise<{ signedTxXdr?: string; signedXdr?: string } | string>;
    };
  }
}

const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';

export function isFreighterInstalled() {
  return typeof window !== 'undefined' && Boolean(window.freighterApi);
}

export async function connectFreighter() {
  if (!isFreighterInstalled()) {
    return null;
  }

  await window.freighterApi?.requestAccess?.();
  return window.freighterApi?.getPublicKey?.() ?? null;
}

export async function signWithFreighter(xdr: string) {
  if (!isFreighterInstalled()) {
    throw new Error('Freighter is not installed');
  }

  const result = await window.freighterApi!.signTransaction!(xdr, {
    networkPassphrase: TESTNET_PASSPHRASE,
  });

  if (typeof result === 'string') {
    return result;
  }

  const signed = result.signedTxXdr ?? result.signedXdr;
  if (!signed) {
    throw new Error('Freighter did not return a signed transaction');
  }

  return signed;
}
