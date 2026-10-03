import { useColorScheme } from 'react-native';

import { Colors, type ThemeColors } from '@/constants/theme';
import { usePreferencesStore } from '@/stores/preferences-store';

export type ColorScheme = 'light' | 'dark';

/** Resolve the user's preference against the OS setting. */
export function resolveScheme(
  preference: 'system' | 'light' | 'dark',
  system: string | null | undefined
): ColorScheme {
  if (preference !== 'system') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

export function useColorSchemeName(): ColorScheme {
  const system = useColorScheme();
  const preference = usePreferencesStore((s) => s.themePreference);
  return resolveScheme(preference, system);
}

export function useTheme(): ThemeColors {
  return Colors[useColorSchemeName()];
}
