import { create } from 'zustand';

type Theme = 'neon-blue' | 'cyber-purple' | 'emerald-matrix' | 'sunset-gradient' | 'quantum-prism' | 'cosmic-void';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'cosmic-void',
  setTheme: (theme) => {
    document.documentElement.className = theme;
    set({ theme });
  },
}));
