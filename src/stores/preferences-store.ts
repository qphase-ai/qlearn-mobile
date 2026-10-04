import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Genuine client state only: device-local UI preferences. Server data
 * belongs in TanStack Query, and auth tokens belong in SecureStore.
 */

export type ThemePreference = 'system' | 'light' | 'dark';

/** Daily study reminder (local notification). The OS schedule follows this. */
export interface ReminderPreference {
  enabled: boolean;
  hour: number;
  minute: number;
}

export const DEFAULT_REMINDER: ReminderPreference = { enabled: false, hour: 19, minute: 0 };

interface PreferencesState {
  themePreference: ThemePreference;
  /** Course the Learn tab and Home follow; null means "first published course". */
  selectedCourseId: string | null;
  reminder: ReminderPreference;
  /**
   * Not persisted: notifications are blocked at the OS level, so the reminder
   * card shows how to turn them on in Settings. Set by reminders.ts.
   */
  reminderBlocked: boolean;
  setThemePreference: (pref: ThemePreference) => void;
  setSelectedCourseId: (id: string | null) => void;
  /** Use features/notifications/reminders.ts, which keeps the OS schedule in step. */
  setReminder: (reminder: ReminderPreference) => void;
  setReminderBlocked: (blocked: boolean) => void;
}

// Settles when the first restore from kv ends, whether it succeeded or failed
// (zustand's `onFinishHydration` only fires on success).
let markLoaded: () => void = () => undefined;
const loaded = new Promise<void>((resolve) => {
  markLoaded = resolve;
});

/** Resolves once the persisted preferences have been read, or failed to be. */
export function whenPreferencesLoaded(): Promise<void> {
  return loaded;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      themePreference: 'system',
      selectedCourseId: null,
      reminder: DEFAULT_REMINDER,
      reminderBlocked: false,
      setThemePreference: (themePreference) => set({ themePreference }),
      setSelectedCourseId: (selectedCourseId) => set({ selectedCourseId }),
      setReminder: (reminder) => set({ reminder }),
      setReminderBlocked: (reminderBlocked) => set({ reminderBlocked }),
    }),
    {
      name: 'qlearn.preferences',
      storage: createJSONStorage(() => Storage),
      // The returned callback runs after the restore, with an error if it failed.
      onRehydrateStorage: () => () => markLoaded(),
      partialize: (s) => ({
        themePreference: s.themePreference,
        selectedCourseId: s.selectedCourseId,
        reminder: s.reminder,
      }),
    }
  )
);
