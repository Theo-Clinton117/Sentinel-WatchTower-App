import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Screen, useAppStore } from '../store/useAppStore';
import { MotionView } from './MotionView';
import { useAppTheme } from '../theme';
import { AppIcon } from './AppIcon';
import { LiquidGlassIconBubble } from './LiquidGlassIconBubble';

const tabs: Array<{ key: Screen; label: string }> = [
  { key: 'home', label: 'Home' },
  { key: 'risk-log', label: 'Risk Log' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'profile', label: 'Profile' },
];

export const AppTabBar = () => {
  const theme = useAppTheme();
  const { currentScreen, setScreen } = useAppStore();
  const styles = createStyles(theme);

  return (
    <MotionView style={[styles.wrap, theme.shadow.card]} delay={120}>
      {tabs.map((tab) => {
        const active = currentScreen === tab.key;

        return (
          <Pressable
            key={tab.key}
            onPress={() => setScreen(tab.key)}
            style={[styles.tab, active && styles.tabActive]}
          >
            <LiquidGlassIconBubble active={active}>
              <AppIcon
                name={tab.key as 'home' | 'risk-log' | 'contacts' | 'profile'}
                color={active ? theme.colors.text : theme.colors.muted}
                active={active}
              />
            </LiquidGlassIconBubble>
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </MotionView>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      gap: 8,
      marginHorizontal: 10,
      marginBottom: 10,
      paddingHorizontal: 10,
      paddingTop: 8,
      paddingBottom: 10,
      backgroundColor: theme.colors.tabBar,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 24,
    },
    tab: {
      flex: 1,
      minHeight: 64,
      borderRadius: 16,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
      gap: 6,
    },
    tabActive: {
      backgroundColor: theme.isDark ? 'rgba(31, 62, 110, 0.34)' : 'rgba(219, 235, 255, 0.82)',
      borderColor: theme.colors.blueGlow,
    },
    label: {
      color: theme.colors.muted,
      fontSize: 11,
      fontWeight: '700',
    },
    labelActive: {
      color: theme.colors.text,
    },
  });
