import { create } from 'zustand';
import { deriveKey } from '../lib/crypto';

interface User {
  id: string;
  email: string;
}

interface AuthState {
  user: User | null;
  encryptionKey: CryptoKey | null;
  setUser: (user: User | null) => void;
  setEncryptionKey: (key: CryptoKey | null) => void;
  login: (user: User, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  encryptionKey: null,
  setUser: (user) => set({ user }),
  setEncryptionKey: (key) => set({ encryptionKey: key }),
  login: async (user, password) => {
    // Derive AES key from password with email as salt
    const key = await deriveKey(password, user.email);
    set({ user, encryptionKey: key });
  },
  logout: () => {
    set({ user: null, encryptionKey: null });
  }
}));
