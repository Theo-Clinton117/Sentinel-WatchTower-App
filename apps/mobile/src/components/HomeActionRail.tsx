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
          <LiquidGlassIconBubble active size={42}>
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
      width: 92,
      borderRadius: 24,
      paddingVertical: 10,
      paddingHorizontal: 10,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      gap: 8,
    },
    item: {
      alignItems: 'center',
      width: '100%',
      paddingVertical: 6,
    },
    label: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: '700',
      textAlign: 'center',
      lineHeight: 14,
    },
    divider: {
      width: 34,
      height: 1,
      backgroundColor: theme.colors.border,
      marginTop: 10,
    },
  });
