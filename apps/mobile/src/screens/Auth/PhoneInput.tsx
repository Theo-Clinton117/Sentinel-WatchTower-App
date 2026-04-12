import React, { useMemo, useState } from 'react';
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
import { isPhoneValid, normalizePhoneInput, requestOtp } from '../../services/auth';
import { useAppTheme } from '../../theme';

export const PhoneInputScreen = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { pendingPhone, deviceId, setPendingPhone, markOtpRequested, pushScreen } = useAppStore();
  const [phone, setPhone] = useState(pendingPhone);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const normalizedPhone = useMemo(() => normalizePhoneInput(phone), [phone]);

  const handleSendOtp = async () => {
    if (!isPhoneValid(normalizedPhone)) {
      setError('Enter a valid phone number with country code, for example +2348012345678.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const result = await requestOtp(normalizedPhone, deviceId);
      setPendingPhone(result.phone || normalizedPhone);
      markOtpRequested({
        requestedAt: Date.now(),
        devCode: result.devCode,
      });
      pushScreen('otp');
    } catch (requestError) {
      const message =
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not send OTP right now. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <MotionView delay={20}>
        <AuthArtPanel
          eyebrow="Secure Entry"
          title="Know where safety begins."
          caption="A trusted number unlocks your network, your emergency tools, and your live protection flow."
          chipA="BLUE SHIELD"
          chipB="OTP SIGN-IN"
        />
      </MotionView>
      <MotionView delay={60} style={[styles.cardWrap, theme.shadow.card]}>
      <LinearGradient colors={theme.gradients.card} style={styles.card}>
        <Text style={styles.eyebrow}>Secure Sign In</Text>
        <Text style={styles.title}>Enter Phone Number</Text>
        <Text style={styles.subtitle}>
          We’ll send a one-time code to verify your number before you continue.
        </Text>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="phone-pad"
          placeholder="+2348012345678"
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
          value={phone}
          onChangeText={(value) => {
            setPhone(value);
            if (error) {
              setError('');
            }
          }}
        />

        <Text style={styles.helper}>
          We use your phone number to identify your account and alert device.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSendOtp}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color={theme.colors.text} /> : <Text style={styles.buttonText}>Send OTP</Text>}
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
    fontSize: 16,
    backgroundColor: theme.colors.backgroundElevated,
  },
  helper: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
    marginBottom: 12,
  },
  error: {
    color: theme.colors.red,
    marginBottom: 12,
    lineHeight: 19,
  },
  button: {
    backgroundColor: theme.colors.blue,
    padding: 14,
    borderRadius: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
    ...theme.shadow.glow,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: theme.colors.text,
    fontWeight: '600',
    fontSize: 15,
  },
});
