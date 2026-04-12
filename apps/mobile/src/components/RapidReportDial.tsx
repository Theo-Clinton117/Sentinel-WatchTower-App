import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  type GestureResponderEvent,
  type PanResponderGestureState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  RAPID_ALERT_SEVERITIES,
  RAPID_ALERT_TAGS,
  type RapidAlertSeverity,
  type RapidAlertTag,
} from '../constants/rapid-alerts';
import { useAppTheme } from '../theme';

type Props = {
  disabled?: boolean;
  loading?: boolean;
  selectedTag: RapidAlertTag;
  onSelectTag: (tag: RapidAlertTag) => void;
  onSubmit: (severity: RapidAlertSeverity) => void;
};

const ACTIVATION_DISTANCE = 38;

function getSeverityFromGesture(dx: number, dy: number): RapidAlertSeverity | null {
  const horizontal = Math.abs(dx);
  const vertical = Math.abs(dy);

  if (Math.max(horizontal, vertical) < ACTIVATION_DISTANCE) {
    return null;
  }

  if (vertical >= horizontal) {
    return dy < 0 ? 'critical' : 'medium';
  }

  return dx > 0 ? 'high' : 'low';
}

export const RapidReportDial = ({
  disabled,
  loading,
  selectedTag,
  onSelectTag,
  onSubmit,
}: Props) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const pulse = useRef(new Animated.Value(0)).current;
  const dragX = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const [activeSeverity, setActiveSeverity] = useState<RapidAlertSeverity | null>(null);
  const [holding, setHolding] = useState(false);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const resetDrag = () => {
    Animated.parallel([
      Animated.spring(dragX, {
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.spring(dragY, {
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
    setHolding(false);
    setActiveSeverity(null);
  };

  const handleRelease = (
    _event: GestureResponderEvent,
    gestureState: PanResponderGestureState,
  ) => {
    const severity = getSeverityFromGesture(gestureState.dx, gestureState.dy);
    resetDrag();

    if (severity && !disabled && !loading) {
      onSubmit(severity);
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled && !loading,
        onMoveShouldSetPanResponder: () => !disabled && !loading,
        onPanResponderGrant: () => {
          setHolding(true);
        },
        onPanResponderMove: (_event, gestureState) => {
          dragX.setValue(gestureState.dx * 0.35);
          dragY.setValue(gestureState.dy * 0.35);
          setActiveSeverity(getSeverityFromGesture(gestureState.dx, gestureState.dy));
        },
        onPanResponderRelease: handleRelease,
        onPanResponderTerminate: handleRelease,
      }),
    [disabled, dragX, dragY, loading],
  );

  const ringStyle = {
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.08],
        }),
      },
    ],
    opacity: pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.45, 0.12],
    }),
  };

  const centerSeverity = activeSeverity ? RAPID_ALERT_SEVERITIES[activeSeverity] : null;

  return (
    <View style={styles.container}>
      <View style={styles.dialWrap}>
        <View style={styles.axisLabelTop}>
          <SeverityMarker severity="critical" activeSeverity={activeSeverity} />
        </View>
        <View style={styles.axisLabelRight}>
          <SeverityMarker severity="high" activeSeverity={activeSeverity} />
        </View>
        <View style={styles.axisLabelBottom}>
          <SeverityMarker severity="medium" activeSeverity={activeSeverity} />
        </View>
        <View style={styles.axisLabelLeft}>
          <SeverityMarker severity="low" activeSeverity={activeSeverity} />
        </View>

        <Animated.View style={[styles.ringOuter, ringStyle, { backgroundColor: theme.colors.blueGlow }]} />
        <Animated.View style={[styles.ringInner, ringStyle, { backgroundColor: theme.colors.blueSoft }]} />

        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.touchWrap,
            {
              transform: [{ translateX: dragX }, { translateY: dragY }],
            },
          ]}
        >
          <Pressable
            disabled={disabled || loading}
            style={[styles.button, (disabled || loading) && styles.buttonDisabled]}
          >
            <LinearGradient
              colors={
                centerSeverity
                  ? [centerSeverity.color, centerSeverity.accent]
                  : [theme.colors.blue, theme.colors.blueGlow]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradient}
            >
              <Text style={styles.eyebrow}>{holding ? 'Slide and release' : 'Hold to report'}</Text>
              <Text style={styles.label}>{centerSeverity ? centerSeverity.label : 'REPORT'}</Text>
              <Text style={styles.caption}>
                {loading
                  ? 'Sending alert...'
                  : centerSeverity
                    ? centerSeverity.description
                    : 'Up critical  •  Right high  •  Down medium  •  Left low'}
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>

      <View style={styles.tagRow}>
        {RAPID_ALERT_TAGS.map((tag) => {
          const active = selectedTag === tag.id;
          return (
            <Pressable
              key={tag.id}
              onPress={() => onSelectTag(tag.id)}
              style={[
                styles.tagChip,
                active && styles.tagChipActive,
                { borderColor: active ? theme.colors.blueGlow : theme.colors.border },
              ]}
            >
              <Text style={[styles.tagText, active && styles.tagTextActive]}>{tag.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const SeverityMarker = ({
  severity,
  activeSeverity,
}: {
  severity: RapidAlertSeverity;
  activeSeverity: RapidAlertSeverity | null;
}) => {
  const theme = useAppTheme();
  const entry = RAPID_ALERT_SEVERITIES[severity];
  const isActive = activeSeverity === severity;

  return (
    <View
      style={{
        alignItems: 'center',
        opacity: activeSeverity && !isActive ? 0.45 : 1,
      }}
    >
      <Text
        style={{
          color: isActive ? entry.color : theme.colors.text,
          fontSize: 12,
          fontWeight: '800',
          textTransform: 'uppercase',
          letterSpacing: 0.8,
        }}
      >
        {entry.label}
      </Text>
      <Text
        style={{
          color: isActive ? entry.color : theme.colors.muted,
          fontSize: 11,
          marginTop: 2,
        }}
      >
        {entry.shortLabel}
      </Text>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      gap: 18,
    },
    dialWrap: {
      width: 312,
      height: 312,
      alignItems: 'center',
      justifyContent: 'center',
    },
    axisLabelTop: {
      position: 'absolute',
      top: 6,
      alignItems: 'center',
    },
    axisLabelRight: {
      position: 'absolute',
      right: -2,
      alignItems: 'center',
    },
    axisLabelBottom: {
      position: 'absolute',
      bottom: 6,
      alignItems: 'center',
    },
    axisLabelLeft: {
      position: 'absolute',
      left: 2,
      alignItems: 'center',
    },
    ringOuter: {
      position: 'absolute',
      width: 300,
      height: 300,
      borderRadius: 150,
    },
    ringInner: {
      position: 'absolute',
      width: 264,
      height: 264,
      borderRadius: 132,
    },
    touchWrap: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    button: {
      width: 206,
      height: 206,
      borderRadius: 103,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      ...theme.shadow.glow,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    gradient: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      gap: 8,
    },
    eyebrow: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      opacity: 0.88,
    },
    label: {
      color: theme.colors.text,
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: 1,
    },
    caption: {
      color: theme.colors.text,
      fontSize: 12,
      lineHeight: 17,
      opacity: 0.88,
      textAlign: 'center',
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      justifyContent: 'center',
    },
    tagChip: {
      minHeight: 38,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      backgroundColor: theme.colors.backgroundElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tagChipActive: {
      backgroundColor: theme.colors.blueSoft,
    },
    tagText: {
      color: theme.colors.muted,
      fontSize: 12,
      fontWeight: '700',
    },
    tagTextActive: {
      color: theme.colors.text,
    },
  });
