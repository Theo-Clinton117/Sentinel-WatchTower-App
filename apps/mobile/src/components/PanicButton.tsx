import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../theme';

type Props = {
  disabled?: boolean;
  onPress?: () => void;
};

export const PanicButton = ({ disabled, onPress }: Props) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const ringStyle = {
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.1],
        }),
      },
    ],
    opacity: pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.5, 0.12],
    }),
  };

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.ringOuter, ringStyle]} />
      <Animated.View style={[styles.ringInner, ringStyle]} />
      <Pressable
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
        ]}
      >
        <LinearGradient colors={theme.gradients.primary} style={styles.gradient}>
          <Text style={styles.eyebrow}>Emergency</Text>
          <Text style={styles.label}>PANIC</Text>
          <Text style={styles.caption}>Hold to summon help fast</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    wrap: {
      width: 244,
      height: 244,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringOuter: {
      position: 'absolute',
      width: 244,
      height: 244,
      borderRadius: 122,
      backgroundColor: theme.colors.blueGlow,
    },
    ringInner: {
      position: 'absolute',
      width: 216,
      height: 216,
      borderRadius: 108,
      backgroundColor: theme.colors.blueSoft,
    },
    button: {
      width: 208,
      height: 208,
      borderRadius: 104,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.blueGlow,
      ...theme.shadow.glow,
    },
    gradient: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    pressed: {
      transform: [{ scale: 0.97 }],
    },
    disabled: {
      opacity: 0.45,
    },
    eyebrow: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      opacity: 0.82,
    },
    label: {
      color: theme.colors.text,
      fontSize: 30,
      letterSpacing: 2,
      fontWeight: '800',
    },
    caption: {
      color: theme.colors.text,
      fontSize: 12,
      opacity: 0.82,
    },
  });
