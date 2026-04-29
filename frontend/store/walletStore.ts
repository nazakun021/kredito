import { create } from 'zustand';
import { 
  checkFreighterInstalled, 
  connectWallet, 
  getConnectedAddress, 
  getWalletNetwork 
} from '../lib/freighter';
import { REQUIRED_NETWORK } from '../lib/constants';
import { toast } from 'sonner';

interface WalletState {
  isConnected: boolean;
  publicKey: string | null;
  network: string | null;
  networkPassphrase: string | null;
  isConnecting: boolean;
  connectionError: string | null;

  connect: () => Promise<void>;
  disconnect: () => void;
  restoreSession: () => Promise<void>;
}

export const useWalletStore = create<WalletState>((set) => ({
  isConnected: false,
  publicKey: null,
  network: null,
  networkPassphrase: null,
  isConnecting: false,
  connectionError: null,

  connect: async () => {
    set({ isConnecting: true, connectionError: null });

    try {
      const installed = await checkFreighterInstalled();
      if (!installed) {
        const error = 'Please install the Freighter extension to connect.';
        set({ isConnecting: false, connectionError: error });
        toast.error(error);
        return;
      }

      const connection = await connectWallet();
      if ('error' in connection) {
        const error = connection.error.includes('User rejected') 
          ? 'Connection cancelled. Please try again.' 
          : connection.error;
        set({ isConnecting: false, connectionError: error });
        toast.error(error);
        return;
      }

      const networkDetails = await getWalletNetwork();
      if (!networkDetails) {
        const error = 'Failed to retrieve network details.';
        set({ isConnecting: false, connectionError: error });
        toast.error(error);
        return;
      }

      if (networkDetails.network !== REQUIRED_NETWORK) {
        const error = `Switch Freighter to ${REQUIRED_NETWORK} to continue.`;
        set({
          isConnected: true,
          publicKey: connection.address,
          network: networkDetails.network,
          networkPassphrase: networkDetails.networkPassphrase,
          isConnecting: false,
          connectionError: error
        });
        toast.warning(error);
        return;
      }

      set({
        isConnected: true,
        publicKey: connection.address,
        network: networkDetails.network,
        networkPassphrase: networkDetails.networkPassphrase,
        isConnecting: false,
        connectionError: null
      });
      localStorage.setItem('kredito_wallet_connected', 'true');
      toast.success('Wallet connected');
    } catch (err: unknown) {
      set({ 
        isConnecting: false, 
        connectionError: err instanceof Error ? err.message : 'An unexpected error occurred.' 
      });
    }
  },

  disconnect: () => {
    set({
      isConnected: false,
      publicKey: null,
      network: null,
      networkPassphrase: null,
      isConnecting: false,
      connectionError: null
    });
    localStorage.removeItem('kredito_wallet_connected');
  },

  restoreSession: async () => {
    if (typeof window === 'undefined') return;
    
    const wasConnected = localStorage.getItem('kredito_wallet_connected');
    if (!wasConnected) return;

    try {
      const address = await getConnectedAddress();
      if (address) {
        const networkDetails = await getWalletNetwork();
        set({
          isConnected: true,
          publicKey: address,
          network: networkDetails?.network || null,
          networkPassphrase: networkDetails?.networkPassphrase || null,
          connectionError: networkDetails?.network !== REQUIRED_NETWORK 
            ? `Switch Freighter to ${REQUIRED_NETWORK} to continue.` 
            : null
        });
      } else {
        // If we thought we were connected but can't get address, clear it
        localStorage.removeItem('kredito_wallet_connected');
      }
    } catch (err) {
      console.error('Failed to restore wallet session:', err);
    }
  }
}));
