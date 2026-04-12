import { useMemo } from 'react';
import { ColorSchemeName, useColorScheme } from 'react-native';
import { ThemePreference, useAppStore } from './store/useAppStore';

type ThemeMode = 'light' | 'dark';

type ThemePalette = {
  background: string;
  backgroundElevated: string;
  surface: string;
  surfaceStrong: string;
  text: string;
  muted: string;
  border: string;
  borderStrong: string;
  blue: string;
  blueGlow: string;
  blueSoft: string;
  red: string;
  success: string;
  tabBar: string;
  overlay: string;
};

const palettes: Record<ThemeMode, ThemePalette> = {
  light: {
    background: '#F4F8FF',
    backgroundElevated: '#FFFFFF',
    surface: 'rgba(255,255,255,0.84)',
    surfaceStrong: '#FFFFFF',
    text: '#10203E',
    muted: '#617291',
    border: '#D6E1F7',
    borderStrong: '#B7CBF2',
    blue: '#1E63FF',
    blueGlow: '#69A2FF',
    blueSoft: '#E2EDFF',
    red: '#FF5E78',
    success: '#2BAE73',
    tabBar: 'rgba(245,248,255,0.92)',
    overlay: 'rgba(12, 29, 66, 0.06)',
  },
  dark: {
    background: '#060B16',
    backgroundElevated: '#091222',
    surface: 'rgba(11,20,39,0.82)',
    surfaceStrong: '#0D1830',
    text: '#EEF4FF',
    muted: '#92A3C4',
    border: '#203250',
    borderStrong: '#35517D',
    blue: '#2A6FFF',
    blueGlow: '#86B9FF',
    blueSoft: '#0E2345',
    red: '#FF6B82',
    success: '#43C98B',
    tabBar: 'rgba(6,11,22,0.94)',
    overlay: 'rgba(125, 168, 255, 0.09)',
  },
};

export type AppTheme = ReturnType<typeof buildTheme>;

function resolveMode(preference: ThemePreference, scheme: ColorSchemeName): ThemeMode {
  if (preference === 'light' || preference === 'dark') {
    return preference;
  }

  return scheme === 'light' ? 'light' : 'dark';
}

export function buildTheme(mode: ThemeMode) {
  const colors = palettes[mode];

  return {
    mode,
    isDark: mode === 'dark',
    colors,
    gradients: {
      appBackground:
        mode === 'dark'
          ? ['#07101F', '#0A1730', '#050914']
          : ['#F8FBFF', '#E8F1FF', '#DCE9FF'],
      hero:
        mode === 'dark'
          ? ['rgba(38,94,255,0.25)', 'rgba(18,38,74,0.65)']
          : ['rgba(105,162,255,0.22)', 'rgba(255,255,255,0.95)'],
      card:
        mode === 'dark'
          ? ['rgba(18,35,69,0.95)', 'rgba(10,19,37,0.85)']
          : ['rgba(255,255,255,0.98)', 'rgba(238,245,255,0.88)'],
      primary:
        mode === 'dark'
          ? ['#3175FF', '#1649C8']
          : ['#3F84FF', '#1E63FF'],
      emergency:
        mode === 'dark'
          ? ['#2A0D1A', '#120714']
          : ['#FFF2F5', '#FFD7E1'],
    },
    radii: {
      xl: 28,
      lg: 22,
      md: 18,
      sm: 14,
      pill: 999,
    },
    shadow: {
      card:
        mode === 'dark'
          ? {
              shadowColor: '#000000',
              shadowOpacity: 0.28,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 12 },
              elevation: 12,
            }
          : {
              shadowColor: '#7CA9FF',
              shadowOpacity: 0.18,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 10 },
              elevation: 8,
            },
      glow: {
        shadowColor: colors.blueGlow,
        shadowOpacity: mode === 'dark' ? 0.28 : 0.22,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 14 },
        elevation: 14,
      },
    },
  };
}

export const theme = buildTheme('dark');

export function useAppTheme() {
  const preference = useAppStore((state) => state.themePreference);
  const scheme = useColorScheme();

  return useMemo(() => buildTheme(resolveMode(preference, scheme)), [preference, scheme]);
}
