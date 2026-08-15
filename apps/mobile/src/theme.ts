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

type SemanticTone = {
  solid: string;
  soft: string;
  border: string;
  text: string;
};

type GradientColors = readonly [string, string, ...string[]];

function gradient(...colors: GradientColors): GradientColors {
  return colors;
}

const palettes: Record<ThemeMode, ThemePalette> = {
  light: {
    background: '#F3F6FB',
    backgroundElevated: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceStrong: '#F7FAFE',
    text: '#0B1424',
    muted: '#5A6880',
    border: '#D7E1EF',
    borderStrong: '#B8C7DA',
    blue: '#1D67FF',
    blueGlow: '#78AFFF',
    blueSoft: '#E7F0FF',
    red: '#F24F6A',
    success: '#2BAE73',
    tabBar: 'rgba(248,250,253,0.92)',
    overlay: 'rgba(10, 20, 36, 0.07)',
  },
  dark: {
    background: '#070B12',
    backgroundElevated: '#0A1322',
    surface: '#0D1729',
    surfaceStrong: '#111F35',
    text: '#EEF4FF',
    muted: '#90A2C2',
    border: '#22344F',
    borderStrong: '#38557F',
    blue: '#2A73FF',
    blueGlow: '#8BB8FF',
    blueSoft: '#102647',
    red: '#FF6984',
    success: '#43C98B',
    tabBar: 'rgba(7,11,18,0.92)',
    overlay: 'rgba(125, 168, 255, 0.11)',
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
  const semantic = {
    info: {
      solid: colors.blue,
      soft: mode === 'dark' ? 'rgba(42,115,255,0.18)' : '#E7F0FF',
      border: mode === 'dark' ? 'rgba(42,115,255,0.28)' : 'rgba(29,103,255,0.18)',
      text: colors.blue,
    },
    success: {
      solid: colors.success,
      soft: mode === 'dark' ? 'rgba(67,201,139,0.16)' : '#E6F7EF',
      border: mode === 'dark' ? 'rgba(67,201,139,0.26)' : 'rgba(43,174,115,0.18)',
      text: colors.success,
    },
    warning: {
      solid: '#D9821F',
      soft: mode === 'dark' ? 'rgba(217,130,31,0.16)' : '#FFF4E5',
      border: mode === 'dark' ? 'rgba(217,130,31,0.26)' : 'rgba(217,130,31,0.18)',
      text: '#D9821F',
    },
    danger: {
      solid: colors.red,
      soft: mode === 'dark' ? 'rgba(255,105,132,0.16)' : '#FFE9ED',
      border: mode === 'dark' ? 'rgba(255,105,132,0.26)' : 'rgba(242,79,106,0.18)',
      text: colors.red,
    },
  } satisfies Record<'info' | 'success' | 'warning' | 'danger', SemanticTone>;

  return {
    mode,
    isDark: mode === 'dark',
    colors,
    semantic,
    gradients: {
      appBackground:
        mode === 'dark'
          ? gradient('#060A11', '#08101D', '#060A11')
          : gradient('#F3F6FB', '#EEF4FF', '#F7FAFE'),
      hero:
        mode === 'dark'
          ? gradient('rgba(38,94,255,0.32)', 'rgba(18,38,74,0.72)')
          : gradient('rgba(114,175,255,0.24)', 'rgba(255,255,255,0.96)'),
      card:
        mode === 'dark'
          ? gradient('rgba(16,30,58,0.96)', 'rgba(9,18,34,0.88)')
          : gradient('rgba(255,255,255,0.98)', 'rgba(239,245,255,0.9)'),
      primary:
        mode === 'dark'
          ? gradient('#347CFF', '#1649C8')
          : gradient('#458AFF', '#1D67FF'),
      emergency:
        mode === 'dark'
          ? gradient('#2A0D1A', '#120714')
          : gradient('#FFF2F5', '#FFD7E1'),
    },
    radii: {
      xl: 36,
      lg: 28,
      md: 22,
      sm: 16,
      pill: 999,
    },
    shadow: {
      card:
          mode === 'dark'
          ? {
              shadowColor: '#000000',
              shadowOpacity: 0.18,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 4,
            }
          : {
              shadowColor: '#000000',
              shadowOpacity: 0.06,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 3,
            },
      glow: {
        shadowColor: colors.blueGlow,
        shadowOpacity: mode === 'dark' ? 0.16 : 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
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
