import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { shallow } from 'zustand/shallow';
import { Screen, useAppStore } from '../store/useAppStore';
import { MotionView } from './MotionView';
import { useAppTheme } from '../theme';
import { AppIcon } from './AppIcon';

const tabs: Array<{ key: Screen; label: string }> = [
  { key: 'home', label: 'Location' },
  { key: 'risk-log', label: 'History' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'profile', label: 'Account' },
];

export const AppTabBar = () => {
  const theme = useAppTheme();
  const { currentScreen, setScreen } = useAppStore(
    (state) => ({
      currentScreen: state.currentScreen,
      setScreen: state.setScreen,
    }),
    shallow,
  );
  const styles = createStyles(theme);

  return (
    <MotionView style={[styles.wrap, theme.shadow.card]} delay={120}>
      {tabs.map((tab) => {
        const active = currentScreen === tab.key;

        return (
          <Pressable
            key={tab.key}
            onPress={() => setScreen(tab.key)}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            accessibilityRole="tab"
            accessibilityLabel={`${tab.label} tab`}
            accessibilityState={{ selected: active }}
          >
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <AppIcon
                name={tab.key === 'home' ? 'location' : (tab.key as 'risk-log' | 'contacts' | 'profile')}
                color={active ? styles.activeTint.color : styles.inactiveTint.color}
                active={active}
              />
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
            {active ? <View style={styles.activeDot} /> : null}
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
      gap: 6,
      marginHorizontal: 16,
      marginBottom: 4,
      paddingHorizontal: 8,
      paddingVertical: 8,
      backgroundColor: theme.isDark ? 'rgba(12,21,38,0.9)' : 'rgba(255,255,255,0.92)',
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,21,38,0.06)',
      borderRadius: 28,
      overflow: 'hidden',
    },
    tab: {
      flex: 1,
      minHeight: 58,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
      gap: 4,
    },
    pressed: {
      opacity: 0.82,
    },
    label: {
      color: theme.colors.muted,
      fontSize: 10,
      fontWeight: '800',
      lineHeight: 13,
      textAlign: 'center',
      flexShrink: 1,
    },
    labelActive: {
      color: theme.colors.blue,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(31,102,255,0.06)',
    },
    iconWrapActive: {
      backgroundColor: theme.isDark ? 'rgba(42,115,255,0.22)' : 'rgba(31,102,255,0.12)',
    },
    activeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.blue,
      marginTop: 0,
    },
    activeTint: {
      color: theme.colors.blue,
    },
    inactiveTint: {
      color: theme.colors.muted,
    },
  });
