import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthArtPanel } from '../../components/AuthArtPanel';
import { MotionView } from '../../components/MotionView';
import { useAppStore } from '../../store/useAppStore';
import { ApiError } from '../../services/api';
import { isOtpValid, requestOtp, verifyOtp } from '../../services/auth';
import { useAppTheme } from '../../theme';

export const OtpScreen = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const {
    deviceId,
    onboardingComplete,
    otpDevCode,
    otpRequestedAt,
    pendingPhone,
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

  const maskedPhone = useMemo(() => {
    if (!pendingPhone) {
      return '';
    }

    return `${pendingPhone.slice(0, 4)} ${pendingPhone.slice(4, 7)} ${pendingPhone.slice(7)}`;
  }, [pendingPhone]);

  const handleVerify = async () => {
    if (!pendingPhone) {
      setError('Start with your phone number first.');
      return;
    }

    if (!isOtpValid(code)) {
      setError('Enter the 4 to 8 digit verification code.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const result = await verifyOtp(pendingPhone, code.trim(), deviceId);
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
    if (!pendingPhone || remainingSeconds > 0) {
      return;
    }

    try {
      setResending(true);
      setError('');
      const result = await requestOtp(pendingPhone, deviceId);
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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <MotionView delay={20}>
        <AuthArtPanel
          eyebrow="Verification"
          title="Confirm it’s really you."
          caption="One final code keeps the WatchTower session personal, private, and ready for emergencies."
          chipA="ONE-TIME CODE"
          chipB="TRUSTED DEVICE"
        />
      </MotionView>
      <MotionView delay={60} style={[styles.cardWrap, theme.shadow.card]}>
      <LinearGradient colors={theme.gradients.card} style={styles.card}>
        <Text style={styles.eyebrow}>Verify Number</Text>
        <Text style={styles.title}>Enter OTP</Text>
        <Text style={styles.subtitle}>
          {pendingPhone
            ? `We sent a one-time code to ${maskedPhone}.`
            : 'Go back and enter your phone number to continue.'}
        </Text>

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

        {otpDevCode ? <Text style={styles.devHint}>Dev code: {otpDevCode}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color={theme.colors.text} /> : <Text style={styles.buttonText}>Verify</Text>}
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
    </KeyboardAvoidingView>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: 'transparent',
    justifyContent: 'center',
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
    marginBottom: 18,
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
    color: theme.colors.blueGlow,
    fontSize: 13,
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
    paddingVertical: 14,
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
