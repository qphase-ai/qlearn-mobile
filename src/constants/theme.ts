import { Platform } from 'react-native';

/**
 * Q-Learn design tokens, ported from the web design system
 * (frontend/src/app/globals.css: HSL tokens converted to hex). They are
 * candidates for a shared `@qlearn/design-tokens` package. Components read
 * colors through `useTheme()`, never as literals.
 */

export interface ThemeColors {
  background: string;
  surface: string;
  elevated: string;
  foreground: string;
  muted: string;
  border: string;
  /** Primary accent ("cyber cyan"). */
  primary: string;
  /** Text/icon color on a solid `primary` fill. */
  onPrimary: string;
  accent: string;
  positive: string;
  success: string;
  warning: string;
  error: string;
  overlay: string;
}

export const Colors: { light: ThemeColors; dark: ThemeColors } = {
  light: {
    background: '#F7F7F7',
    surface: '#FFFFFF',
    elevated: '#FFFFFF',
    foreground: '#171717',
    muted: '#616161',
    border: 'rgba(0,0,0,0.10)',
    primary: '#0C7792',
    onPrimary: '#FFFFFF',
    accent: '#7E22CE',
    positive: '#157F3C',
    success: '#157F3C',
    warning: '#B36205',
    error: '#C52020',
    overlay: 'rgba(0,0,0,0.05)',
  },
  dark: {
    background: '#050505',
    surface: '#0A0A0A',
    elevated: '#121212',
    foreground: '#F5F5F5',
    muted: '#999999',
    border: 'rgba(255,255,255,0.10)',
    primary: '#00EEFF',
    onPrimary: '#050505',
    accent: '#AF24FF',
    positive: '#38FF14',
    success: '#21C45D',
    warning: '#F59F0A',
    error: '#F75555',
    overlay: 'rgba(255,255,255,0.06)',
  },
};

/** Gate fills, identical in both themes (web: "CIRCUIT PALETTE — DO NOT MODIFY"). Phase 5. */
export const GateColors = {
  H: '#8b5cf6',
  X: '#f85149',
  Y: '#f97316',
  Z: '#3fb950',
  S: '#14b8a6',
  T: '#6366f1',
  I: '#6b7280',
  CX: '#3b82f6',
  M: '#00d4ff',
  rotation: '#a855f7',
  U: '#db2777',
  P: '#0891b2',
  SX: '#64748b',
  wire: '#8b8b8b',
  label: '#f5f5f5',
  labelOnLight: '#0d0d0d',
} as const;

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const Radii = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

/** Minimum touch target (Apple HIG 44pt, Material 48dp). */
export const MIN_TOUCH = 44;

export const MonoFont = Platform.select({ ios: 'Menlo', default: 'monospace' });

export const Typography = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  mono: { fontSize: 14, lineHeight: 20, fontWeight: '400', fontFamily: MonoFont },
} as const;

export type TypographyVariant = keyof typeof Typography;
