import React from 'react';
import { Animated, StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import { useAppTheme } from '../theme';

type Props = {
  width?: number | 'auto' | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export const SkeletonBlock = ({ width = '100%', height = 16, radius = 12, style }: Props) => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const pulse = React.useRef(new Animated.Value(0.65)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.92,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.62,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.block,
        { width, height, borderRadius: radius, opacity: pulse },
        style,
      ]}
    />
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    block: {
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(29,103,255,0.08)',
      overflow: 'hidden',
    },
  });
