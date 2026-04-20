import { create } from 'zustand';

type Theme = 'neon-blue' | 'cyber-purple' | 'emerald-matrix' | 'sunset-gradient' | 'quantum-prism';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'quantum-prism',
  setTheme: (theme) => {
    document.documentElement.className = theme;
    set({ theme });
  },
}));
