import React from 'react';
import {
  Animated,
  BackHandler,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { BlareOverlay } from './src/components/BlareOverlay';
import { AppTabBar } from './src/components/AppTabBar';
import { ScreenCanvas } from './src/components/ScreenCanvas';
import { useAppStore } from './src/store/useAppStore';
import { useAppTheme } from './src/theme';
import { clearSecureSession, loadSecureSession, saveSecureSession } from './src/services/secure-session';
import { HomeScreen } from './src/screens/Home';
import { ActiveEmergencyScreen } from './src/screens/ActiveEmergency';
import { ContactsScreen } from './src/screens/Contacts';
import { RiskLogScreen } from './src/screens/AlertHistory';
import { ProfileScreen } from './src/screens/Profile';
import { AuthEntryScreen } from './src/screens/Auth/PhoneInput';
import { OtpScreen } from './src/screens/Auth/Otp';
import { OnboardingContactsScreen } from './src/screens/Onboarding/Contacts';
import { OnboardingPermissionsScreen } from './src/screens/Onboarding/Permissions';

const queryClient = new QueryClient();

const ScreenRouter = () => {
  const {
    currentScreen,
    sessionStatus,
    authStatus,
    onboardingComplete,
  } = useAppStore();

  if (sessionStatus === 'active' || sessionStatus === 'soft_alert') {
    return <ActiveEmergencyScreen />;
  }

  if (authStatus === 'unauthenticated') {
    return currentScreen === 'otp' ? <OtpScreen /> : <AuthEntryScreen />;
  }

  if (!onboardingComplete) {
    return currentScreen === 'onboarding-permissions' ? (
      <OnboardingPermissionsScreen />
    ) : (
      <OnboardingContactsScreen />
    );
  }

  switch (currentScreen) {
    case 'contacts':
      return <ContactsScreen />;
    case 'risk-log':
      return <RiskLogScreen />;
    case 'profile':
      return <ProfileScreen />;
    default:
      return <HomeScreen />;
  }
};

const BootSplash = () => {
  const theme = useAppTheme();
  const pulse = React.useRef(new Animated.Value(0)).current;
  const sweep = React.useRef(new Animated.Value(0)).current;
  const wordmark = React.useRef(new Animated.Value(0)).current;
  const subtitle = React.useRef(new Animated.Value(0)).current;
  const shimmer = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ]),
    );

    const sweepLoop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 3600,
        useNativeDriver: true,
      }),
    );

    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );

    pulseLoop.start();
    sweepLoop.start();
    shimmerLoop.start();

    Animated.stagger(180, [
      Animated.timing(wordmark, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(subtitle, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      pulseLoop.stop();
      sweepLoop.stop();
      shimmerLoop.stop();
    };
  }, [pulse, shimmer, subtitle, sweep, wordmark]);

  const outerRingScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.1],
  });
  const innerRingScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.96],
  });
  const outerRingOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.14, 0.34],
  });
  const sweepRotation = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const wordmarkTranslate = wordmark.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
  });
  const subtitleTranslate = subtitle.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });
  const beaconOpacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  return (
    <LinearGradient colors={theme.gradients.appBackground} style={styles.bootWrap}>
      <View style={styles.bootBackdrop}>
        <View style={[styles.bootGlowLarge, { backgroundColor: theme.colors.blueGlow }]} />
        <View style={[styles.bootGlowSmall, { backgroundColor: theme.colors.blue }]} />
      </View>

      <View style={styles.bootCenter}>
        <Animated.View
          style={[
            styles.bootRingOuter,
            {
              borderColor: theme.colors.blueGlow,
              opacity: outerRingOpacity,
              transform: [{ scale: outerRingScale }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.bootRingInner,
            {
              borderColor: theme.colors.borderStrong,
              transform: [{ scale: innerRingScale }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.bootSweep,
            {
              borderTopColor: theme.colors.blueGlow,
              opacity: 0.7,
              transform: [{ rotate: sweepRotation }],
            },
          ]}
        />
        <View
          style={[
            styles.bootCoreShell,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.bootCore,
              {
                backgroundColor: theme.colors.blue,
                opacity: beaconOpacity,
              },
            ]}
          />
        </View>
      </View>

      <Animated.View
        style={[
          styles.bootWordmarkWrap,
          {
            opacity: wordmark,
            transform: [{ translateY: wordmarkTranslate }],
          },
        ]}
      >
        <Text style={[styles.bootEyebrow, { color: theme.colors.blueGlow }]}>LIVE SAFETY GRID</Text>
        <Text style={[styles.bootTitle, { color: theme.colors.text }]}>Sentinel-Watchtower</Text>
      </Animated.View>

      <Animated.Text
        style={[
          styles.bootText,
          {
            color: theme.colors.muted,
            opacity: subtitle,
            transform: [{ translateY: subtitleTranslate }],
          },
        ]}
      >
        Loading your emergency network, role access, and local session state.
      </Animated.Text>
    </LinearGradient>
  );
};

const AppChrome = ({ showBootSplash }: { showBootSplash: boolean }) => {
  const theme = useAppTheme();
  const {
    authStatus,
    onboardingComplete,
    currentScreen,
    screenStack,
    sessionStatus,
    goBack,
    setScreen,
  } = useAppStore();

  const canGoBack =
    sessionStatus !== 'active' &&
    sessionStatus !== 'soft_alert' &&
    screenStack.length > 1 &&
    !['home', 'risk-log', 'contacts', 'profile'].includes(currentScreen);
  const showTabs =
    sessionStatus !== 'active' &&
    sessionStatus !== 'soft_alert' &&
    authStatus === 'authenticated' &&
    onboardingComplete;

  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sessionStatus === 'active' || sessionStatus === 'soft_alert') {
        return true;
      }

      if (canGoBack) {
        goBack();
        return true;
      }

      if (showTabs && currentScreen !== 'home') {
        setScreen('home');
        return true;
      }

      return false;
    });

    return () => subscription.remove();
  }, [canGoBack, currentScreen, goBack, sessionStatus, setScreen, showTabs]);

  if (showBootSplash) {
    return <BootSplash />;
  }

  return (
    <>
      {canGoBack ? (
        <Pressable
          onPress={goBack}
          style={[
            styles.backButton,
            {
              borderColor: theme.colors.borderStrong,
              backgroundColor: theme.colors.surface,
              ...theme.shadow.card,
            },
          ]}
        >
          <Text style={[styles.backText, { color: theme.colors.text }]}>Back</Text>
        </Pressable>
      ) : null}

      <View style={styles.screen}>
        <ScreenRouter />
      </View>

      {showTabs ? <AppTabBar /> : null}
      <AlertTransition />
      <BlareOverlay />
    </>
  );
};

const AlertTransition = () => {
  const theme = useAppTheme();
  const sessionStatus = useAppStore((state) => state.sessionStatus);
  const opacity = React.useRef(new Animated.Value(0)).current;
  const scale = React.useRef(new Animated.Value(0.75)).current;
  const previousStatus = React.useRef(sessionStatus);

  React.useEffect(() => {
    if (previousStatus.current === sessionStatus) {
      return;
    }

    previousStatus.current = sessionStatus;
    opacity.setValue(0.35);
    scale.setValue(0.75);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 2.4,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale, sessionStatus]);

  const backgroundColor =
    sessionStatus === 'active'
      ? theme.colors.red
      : sessionStatus === 'soft_alert'
        ? theme.colors.blue
        : theme.colors.blueGlow;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.transitionWrap,
        {
          opacity,
          transform: [{ scale }],
        },
      ]}
    >
      <View style={[styles.transitionBloom, { backgroundColor }]} />
    </Animated.View>
  );
};

export default function App() {
  const theme = useAppTheme();
  const {
    accessToken,
    refreshToken,
    user,
    hasHydrated,
    hasSecureAuthHydrated,
    markSecureAuthHydrated,
    restoreSecureAuth,
  } = useAppStore((state) => ({
    accessToken: state.accessToken,
    refreshToken: state.refreshToken,
    user: state.user,
    hasHydrated: state.hasHydrated,
    hasSecureAuthHydrated: state.hasSecureAuthHydrated,
    markSecureAuthHydrated: state.setHasSecureAuthHydrated,
    restoreSecureAuth: state.restoreSecureAuth,
  }));
  const [hasPlayedOpeningIntro, setHasPlayedOpeningIntro] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setHasPlayedOpeningIntro(true);
    }, 1700);

    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    let active = true;

    const hydrateSecureAuth = async () => {
      try {
        const session = await loadSecureSession();
        if (active && session?.accessToken && session?.refreshToken) {
          restoreSecureAuth(session);
        }
      } finally {
        if (active) {
          markSecureAuthHydrated(true);
        }
      }
    };

    void hydrateSecureAuth();

    return () => {
      active = false;
    };
  }, [markSecureAuthHydrated, restoreSecureAuth]);

  React.useEffect(() => {
    if (!hasSecureAuthHydrated) {
      return;
    }

    if (accessToken && refreshToken) {
      void saveSecureSession({
        accessToken,
        refreshToken,
        user,
      });
      return;
    }

    void clearSecureSession();
  }, [accessToken, refreshToken, hasSecureAuthHydrated, user]);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
        <ScreenCanvas>
          <View style={{ flex: 1 }}>
            <AppChrome
              showBootSplash={!hasHydrated || !hasSecureAuthHydrated || !hasPlayedOpeningIntro}
            />
          </View>
        </ScreenCanvas>
      </SafeAreaView>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 12,
    left: 16,
    zIndex: 10,
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 13,
    fontWeight: '700',
  },
  transitionWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transitionBloom: {
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  bootWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    overflow: 'hidden',
  },
  bootBackdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bootGlowLarge: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    opacity: 0.12,
    top: 120,
  },
  bootGlowSmall: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.14,
    bottom: 120,
    right: -40,
  },
  bootCenter: {
    width: 182,
    height: 182,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 34,
  },
  bootRingOuter: {
    position: 'absolute',
    width: 182,
    height: 182,
    borderRadius: 91,
    borderWidth: 1.5,
  },
  bootRingInner: {
    position: 'absolute',
    width: 138,
    height: 138,
    borderRadius: 69,
    borderWidth: 1,
  },
  bootSweep: {
    position: 'absolute',
    width: 182,
    height: 182,
    borderRadius: 91,
    borderTopWidth: 3,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
  },
  bootCoreShell: {
    width: 84,
    height: 84,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bootCore: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  bootWordmarkWrap: {
    alignItems: 'center',
    marginBottom: 14,
  },
  bootEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.2,
    marginBottom: 10,
  },
  bootTitle: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  bootText: {
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
});
