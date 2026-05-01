import { describe, expect, it, vi } from 'vitest';
import { signTx } from './freighter';

vi.mock('@stellar/freighter-api', () => ({
  signTransaction: vi.fn(async (xdr, options) => {
    // Implementation uses networkPassphrase
    if (options?.networkPassphrase) {
      return { signedTxXdr: 'signed-xdr-content' };
    }
    return { error: 'User declined' };
  }),
  getAddress: vi.fn(),
  getNetwork: vi.fn(),
  isConnected: vi.fn(),
  requestAccess: vi.fn(),
}));

describe('Freighter API', () => {
  it('signTx returns { signedXdr } on success', async () => {
    const result = await signTx('unsigned-xdr', 'G123', 'Test Net');
    expect(result).toHaveProperty('signedXdr');
    expect((result as { signedXdr: string }).signedXdr).toBe('signed-xdr-content');
  });
});
