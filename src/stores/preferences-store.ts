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
  /** Course the Learn tab and Home follow; null means "first published course". */
  selectedCourseId: string | null;
  setThemePreference: (pref: ThemePreference) => void;
  setSelectedCourseId: (id: string | null) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      themePreference: 'system',
      selectedCourseId: null,
      setThemePreference: (themePreference) => set({ themePreference }),
      setSelectedCourseId: (selectedCourseId) => set({ selectedCourseId }),
    }),
    {
      name: 'qlearn.preferences',
      storage: createJSONStorage(() => Storage),
      partialize: (s) => ({ themePreference: s.themePreference, selectedCourseId: s.selectedCourseId }),
    }
  )
);
