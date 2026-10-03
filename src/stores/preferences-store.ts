import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Genuine client state only: device-local UI preferences. Server data
 * belongs in TanStack Query, and auth tokens belong in SecureStore.
 */

export type ThemePreference = 'system' | 'light' | 'dark';

interface PreferencesState {
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      themePreference: 'system',
      setThemePreference: (themePreference) => set({ themePreference }),
    }),
    {
      name: 'qlearn.preferences',
      storage: createJSONStorage(() => Storage),
      partialize: (s) => ({ themePreference: s.themePreference }),
    }
  )
);
