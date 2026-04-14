import React, { useMemo, useState } from 'react';
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
import { AuthFlow, isEmailValid, normalizeEmailInput, requestOtp } from '../../services/auth';
import { useAppStore } from '../../store/useAppStore';
import { useAppTheme } from '../../theme';

export const AuthEntryScreen = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { authFlow, pendingEmail, pendingName, deviceId, setPendingAuth, markOtpRequested, pushScreen } =
    useAppStore();
  const [mode, setMode] = useState<AuthFlow>(authFlow);
  const [name, setName] = useState(pendingName);
  const [email, setEmail] = useState(pendingEmail);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const normalizedEmail = useMemo(() => normalizeEmailInput(email), [email]);
  const isSignup = mode === 'signup';

  const handleModeChange = (nextMode: AuthFlow) => {
    setMode(nextMode);
    setError('');
  };

  const handleSendOtp = async () => {
    const trimmedName = name.trim();

    if (isSignup && trimmedName.length < 2) {
      setError('Enter your name so we can set up your account.');
      return;
    }

    if (!isEmailValid(normalizedEmail)) {
      setError('Enter a valid email address to receive your verification code.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const result = await requestOtp(
        {
          email: normalizedEmail,
          name: isSignup ? trimmedName : undefined,
          mode,
        },
        deviceId,
      );

      setPendingAuth({
        email: result.email || normalizedEmail,
        name: trimmedName,
        mode: result.mode || mode,
      });
      markOtpRequested({
        requestedAt: Date.now(),
        devCode: result.devCode,
      });
      pushScreen('otp');
    } catch (requestError) {
      const message =
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not send the verification code right now. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
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
          <Text style={styles.eyebrow}>Secure Access</Text>
          <Text style={styles.title}>{isSignup ? 'Create your account' : 'Welcome back'}</Text>
          <Text style={styles.subtitle}>
            {isSignup
              ? 'Start with your name and email. We will send a one-time code to finish setup.'
              : 'Enter the email linked to your account and we will send a fresh verification code.'}
          </Text>
        </MotionView>

        <MotionView delay={60} style={[styles.cardWrap, theme.shadow.card]}>
          <LinearGradient colors={theme.gradients.card} style={styles.card}>
            <View style={styles.modeSwitcher}>
              {(['login', 'signup'] as AuthFlow[]).map((option) => {
                const active = mode === option;

                return (
                  <Pressable
                    key={option}
                    onPress={() => handleModeChange(option)}
                    style={[styles.modeChip, active && styles.modeChipActive]}
                  >
                    <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>
                      {option === 'login' ? 'Log In' : 'Sign Up'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Email verification</Text>
              </View>
            </View>

            {isSignup ? (
              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Full name</Text>
                <TextInput
                  autoCapitalize="words"
                  autoCorrect={false}
                  placeholder="Jane Doe"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                  value={name}
                  onChangeText={(value) => {
                    setName(value);
                    if (error) {
                      setError('');
                    }
                  }}
                />
              </View>
            ) : null}

            <View style={[styles.fieldBlock, isSignup && styles.inputSpaced]}>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  if (error) {
                    setError('');
                  }
                }}
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSendOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.text} />
              ) : (
                <Text style={styles.buttonText}>Continue</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => handleModeChange(isSignup ? 'login' : 'signup')}
              style={styles.secondaryAction}
            >
              <Text style={styles.secondaryText}>
                {isSignup ? 'Already have an account? Log In' : 'Need an account? Sign Up'}
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
    modeSwitcher: {
      flexDirection: 'row',
      gap: 10,
      padding: 6,
      borderRadius: 20,
      backgroundColor: theme.colors.backgroundElevated,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 18,
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
    modeChip: {
      flex: 1,
      minHeight: 46,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modeChipActive: {
      backgroundColor: theme.colors.blueSoft,
      borderWidth: 1,
      borderColor: theme.colors.blueGlow,
    },
    modeChipText: {
      color: theme.colors.muted,
      fontSize: 14,
      fontWeight: '700',
    },
    modeChipTextActive: {
      color: theme.colors.text,
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
      fontSize: 16,
      backgroundColor: theme.colors.backgroundElevated,
    },
    inputSpaced: {
      marginTop: 14,
    },
    error: {
      color: theme.colors.red,
      marginTop: 14,
      marginBottom: 4,
      lineHeight: 19,
    },
    button: {
      backgroundColor: theme.colors.blue,
      padding: 14,
      borderRadius: 16,
      alignItems: 'center',
      minHeight: 52,
      justifyContent: 'center',
      marginTop: 18,
      ...theme.shadow.glow,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    buttonText: {
      color: theme.colors.text,
      fontWeight: '600',
      fontSize: 15,
      textAlign: 'center',
    },
    secondaryAction: {
      paddingTop: 16,
      alignItems: 'center',
    },
    secondaryText: {
      color: theme.colors.muted,
      fontWeight: '600',
    },
  });
