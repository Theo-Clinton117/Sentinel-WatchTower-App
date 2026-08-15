import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme';
import { AppIcon } from './AppIcon';
import { LiquidGlassIconBubble } from './LiquidGlassIconBubble';

type Action = {
  key: string;
  label: string;
  icon: 'watch' | 'layers' | 'contacts' | 'profile';
  onPress: () => void;
};

type Props = {
  actions: Action[];
};

export const HomeActionRail = ({ actions }: Props) => {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <View style={[styles.wrap, theme.shadow.card]}>
      {actions.map((action, index) => (
        <Pressable key={action.key} onPress={action.onPress} style={styles.item}>
          <LiquidGlassIconBubble active size={46}>
            <AppIcon name={action.icon} color={theme.colors.text} active />
          </LiquidGlassIconBubble>
          <Text style={styles.label}>{action.label}</Text>
          {index < actions.length - 1 ? <View style={styles.divider} /> : null}
        </Pressable>
      ))}
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      top: 18,
      right: 16,
      width: 104,
      borderRadius: 20,
      paddingVertical: 12,
      paddingHorizontal: 10,
      backgroundColor: theme.colors.surfaceStrong,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      gap: 10,
    },
    item: {
      alignItems: 'center',
      width: '100%',
      paddingVertical: 8,
    },
    label: {
      color: theme.colors.text,
      fontSize: 10,
      fontWeight: '800',
      textAlign: 'center',
      lineHeight: 13,
      marginTop: 4,
    },
    divider: {
      width: 38,
      height: 1,
      backgroundColor: theme.colors.border,
      marginTop: 11,
    },
  });
