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
      gap: 4,
      marginHorizontal: 0,
      marginBottom: 0,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 12,
      backgroundColor: theme.isDark ? 'rgba(9,18,34,0.96)' : 'rgba(255,255,255,0.98)',
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    tab: {
      flex: 1,
      minHeight: 62,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      gap: 5,
    },
    pressed: {
      opacity: 0.82,
    },
    label: {
      color: theme.colors.muted,
      fontSize: 11,
      fontWeight: '700',
    },
    labelActive: {
      color: theme.colors.blue,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.04)' : 'transparent',
    },
    iconWrapActive: {
      backgroundColor: theme.isDark ? 'rgba(42,111,255,0.18)' : 'rgba(30,99,255,0.1)',
    },
    activeDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: theme.colors.blue,
      marginTop: 1,
    },
    activeTint: {
      color: theme.colors.blue,
    },
    inactiveTint: {
      color: theme.colors.muted,
    },
  });
