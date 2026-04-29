import { Keypair } from '@stellar/stellar-sdk';
import { networkPassphrase } from './client';

export async function ensureDemoWalletReady(userKeypair: Keypair) {
  if (networkPassphrase !== 'Test SDF Network ; September 2015') {
    return;
  }

  fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(userKeypair.publicKey())}`).catch(
    () => {},
  );
}
