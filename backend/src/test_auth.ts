import { Keypair, WebAuth, Transaction } from '@stellar/stellar-sdk';

const webAuthSecretKey = 'SC5GCLWB5WUM2O6Z4PZOLZB2SDCEQS5RC3D46LEJLVHUCXIUGOX7HNMS';
const homeDomain = 'kredito-iota.vercel.app';
const webAuthDomain = 'kredito-production.up.railway.app';
const networkPassphrase = 'Public Global Stellar Network ; October 2015';

const webAuthKeypair = Keypair.fromSecret(webAuthSecretKey);
// Deriving a valid public key to pass cryptographic validation checks
const clientKeypair = Keypair.random();
const clientAddress = clientKeypair.publicKey();

console.log('--- SEP-10 Diagnosis Simulation ---');
console.log('Server Public Key:', webAuthKeypair.publicKey());
console.log('Client Public Key:', clientAddress);

try {
  console.log('\nBuilding challenge transaction...');
  const challengeXdr = WebAuth.buildChallengeTx(
    webAuthKeypair,
    clientAddress,
    homeDomain,
    300,
    networkPassphrase,
    webAuthDomain,
  );
  console.log('✅ Challenge built successfully!');
  console.log('Challenge XDR:', challengeXdr);

  console.log('\nSimulating Freighter client signing challenge...');
  // The client signs the challenge tx on the same network passphrase
  const tx = new Transaction(challengeXdr, networkPassphrase);
  tx.sign(clientKeypair);
  const signedChallengeXdr = tx.toXDR();
  console.log('✅ Client signed challenge successfully!');

  console.log('\nReading back challenge transaction (Simulating server side read)...');
  const details = WebAuth.readChallengeTx(
    signedChallengeXdr,
    webAuthKeypair.publicKey(),
    networkPassphrase,
    homeDomain,
    webAuthDomain,
  );
  console.log('✅ Challenge read back successfully!');
  console.log('Read Client Account ID:', details.clientAccountID);

  console.log('\nVerifying challenge transaction signatures on server...');
  WebAuth.verifyChallengeTxSigners(
    signedChallengeXdr,
    webAuthKeypair.publicKey(),
    networkPassphrase,
    [clientAddress],
    homeDomain,
    webAuthDomain,
  );
  console.log('🎉 SUCCESS! SEP-10 Authentication flow works perfectly with these parameters!');
} catch (error) {
  console.error('❌ Diagnostic error:', error);
}
