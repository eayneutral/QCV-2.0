import { create } from 'zustand';
import { deriveKey, exportKeyStore, importKeyStore } from '../lib/crypto';

interface User {
  id: string;
  email: string;
}

interface AuthState {
  user: User | null;
  encryptionKey: CryptoKey | null;
  setUser: (user: User | null) => void;
  setEncryptionKey: (key: CryptoKey | null) => void;
  login: (user: User, password?: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  encryptionKey: null,
  setUser: (user) => set({ user }),
  setEncryptionKey: (key) => set({ encryptionKey: key }),
  login: async (user, password, rememberMe = false) => {
    let key: CryptoKey | null = null;
    
    if (password) {
      key = await deriveKey(password, user.email);
    } else {
      // Trying to restore key from local storage for passwordless/remember me
      const savedJwk = localStorage.getItem('qcv_vault_key');
      if (savedJwk) {
        try {
          key = await importKeyStore(savedJwk);
        } catch (e) {
          console.error("Failed to restore saved encryption key");
        }
      }
    }

    if (key && rememberMe) {
      exportKeyStore(key).then(str => localStorage.setItem('qcv_vault_key', str));
    }

    set({ user, encryptionKey: key });
  },
  logout: () => {
    localStorage.removeItem('qcv_vault_key');
    set({ user: null, encryptionKey: null });
  }
}));
