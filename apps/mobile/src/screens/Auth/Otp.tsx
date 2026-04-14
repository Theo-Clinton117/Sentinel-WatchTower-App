import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotionView } from '../../components/MotionView';
import { ApiError } from '../../services/api';
import { isOtpValid, requestOtp, verifyOtp } from '../../services/auth';
import { useAppStore } from '../../store/useAppStore';
import { useAppTheme } from '../../theme';

const maskEmail = (email: string) => {
  const [localPart = '', domain = ''] = email.split('@');

  if (!localPart || !domain) {
    return email;
  }

  if (localPart.length <= 2) {
    return `${localPart[0] || ''}***@${domain}`;
  }

  return `${localPart.slice(0, 2)}***${localPart.slice(-1)}@${domain}`;
};

export const OtpScreen = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const {
    deviceId,
    onboardingComplete,
    otpDevCode,
    otpRequestedAt,
    pendingEmail,
    pendingName,
    authFlow,
    markOtpRequested,
    resetNavigation,
    setAuthSession,
  } = useAppStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!otpRequestedAt) {
      setRemainingSeconds(0);
      return;
    }

    const updateCountdown = () => {
      const nextValue = Math.max(0, 30 - Math.floor((Date.now() - otpRequestedAt) / 1000));
      setRemainingSeconds(nextValue);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [otpRequestedAt]);

  const maskedEmail = useMemo(() => maskEmail(pendingEmail), [pendingEmail]);

  const handleVerify = async () => {
    if (!pendingEmail) {
      setError('Start with your email address first.');
      return;
    }

    if (!isOtpValid(code)) {
      setError('Enter the 4 to 8 digit verification code.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const result = await verifyOtp(
        {
          email: pendingEmail,
          name: authFlow === 'signup' ? pendingName : undefined,
          mode: authFlow,
          code: code.trim(),
        },
        deviceId,
      );
      setAuthSession({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      });
      resetNavigation(onboardingComplete ? 'home' : 'onboarding-contacts');
    } catch (verifyError) {
      const message =
        verifyError instanceof ApiError
          ? verifyError.message
          : 'Verification failed. Please check the code and try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!pendingEmail || remainingSeconds > 0) {
      return;
    }

    try {
      setResending(true);
      setError('');
      const result = await requestOtp(
        {
          email: pendingEmail,
          name: authFlow === 'signup' ? pendingName : undefined,
          mode: authFlow,
        },
        deviceId,
      );
      markOtpRequested({
        requestedAt: Date.now(),
        devCode: result.devCode,
      });
    } catch (resendError) {
      const message =
        resendError instanceof ApiError
          ? resendError.message
          : 'Could not resend the code right now.';
      setError(message);
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <MotionView delay={20} style={styles.heroBlock}>
          <Text style={styles.eyebrow}>
            {authFlow === 'signup' ? 'Complete Sign Up' : 'Complete Log In'}
          </Text>
          <Text style={styles.title}>Enter your code</Text>
          <Text style={styles.subtitle}>
            {pendingEmail
              ? `We sent a verification code to ${maskedEmail}.`
              : 'Go back and enter your email address to continue.'}
          </Text>
        </MotionView>

        <MotionView delay={60} style={[styles.cardWrap, theme.shadow.card]}>
          <LinearGradient colors={theme.gradients.card} style={styles.card}>
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>4 to 8 digits</Text>
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Verification code</Text>
              <TextInput
                keyboardType="number-pad"
                placeholder="123456"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
                value={code}
                onChangeText={(value) => {
                  setCode(value.replace(/[^\d]/g, ''));
                  if (error) {
                    setError('');
                  }
                }}
                maxLength={8}
              />
            </View>

            {otpDevCode ? <Text style={styles.devHint}>Dev code: {otpDevCode}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.text} />
              ) : (
                <Text style={styles.buttonText}>Verify and continue</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.secondary}
              onPress={handleResend}
              disabled={resending || remainingSeconds > 0}
            >
              <Text style={styles.secondaryText}>
                {resending
                  ? 'Sending...'
                  : remainingSeconds > 0
                    ? `Resend in ${remainingSeconds}s`
                    : 'Resend code'}
              </Text>
            </Pressable>
          </LinearGradient>
        </MotionView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    scroll: {
      flex: 1,
    },
    content: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingTop: 40,
      paddingBottom: 32,
    },
    heroBlock: {
      marginBottom: 18,
    },
    cardWrap: {
      borderRadius: 28,
      overflow: 'hidden',
    },
    card: {
      borderRadius: 28,
      padding: 22,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    badgeRow: {
      marginBottom: 16,
    },
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: theme.colors.blueSoft,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
    },
    badgeText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '700',
    },
    eyebrow: {
      color: theme.colors.blueGlow,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 10,
    },
    title: {
      color: theme.colors.text,
      fontSize: 28,
      fontWeight: '800',
    },
    subtitle: {
      color: theme.colors.muted,
      lineHeight: 20,
      marginTop: 10,
      marginBottom: 4,
      maxWidth: 420,
    },
    fieldBlock: {
      marginTop: 2,
    },
    label: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 14,
      color: theme.colors.text,
      fontSize: 22,
      letterSpacing: 8,
      textAlign: 'center',
      backgroundColor: theme.colors.backgroundElevated,
    },
    devHint: {
      marginTop: 12,
      color: theme.colors.muted,
      fontSize: 12,
    },
    error: {
      marginTop: 12,
      color: theme.colors.red,
      lineHeight: 19,
    },
    button: {
      backgroundColor: theme.colors.blue,
      padding: 14,
      borderRadius: 16,
      alignItems: 'center',
      minHeight: 52,
      justifyContent: 'center',
      marginTop: 16,
      ...theme.shadow.glow,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    secondary: {
      paddingTop: 16,
      alignItems: 'center',
    },
    buttonText: {
      color: theme.colors.text,
      fontWeight: '600',
      fontSize: 15,
    },
    secondaryText: {
      color: theme.colors.muted,
      fontWeight: '600',
    },
  });
