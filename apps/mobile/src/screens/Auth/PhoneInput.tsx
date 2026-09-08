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
import { DismissibleNoticeCard } from '../../components/DismissibleNoticeCard';
import { ApiError } from '../../services/api';
import {
  AuthFlow,
  isEmailValid,
  isPhoneValid,
  normalizeEmailInput,
  normalizePhoneInput,
  requestOtp,
} from '../../services/auth';
import { useAppStore } from '../../store/useAppStore';
import { useAppTheme } from '../../theme';

export const AuthEntryScreen = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const {
    authFlow,
    pendingEmail,
    pendingPhone,
    pendingName,
    deviceId,
    setPendingAuth,
    markOtpRequested,
    pushScreen,
    enableDevTestMode,
  } =
    useAppStore();
  const [mode, setMode] = useState<AuthFlow>(authFlow);
  const [contactMethod, setContactMethod] = useState<'email' | 'phone'>(
    pendingPhone ? 'phone' : 'email',
  );
  const [name, setName] = useState(pendingName);
  const [email, setEmail] = useState(pendingEmail);
  const [phone, setPhone] = useState(pendingPhone);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const normalizedEmail = useMemo(() => normalizeEmailInput(email), [email]);
  const normalizedPhone = useMemo(() => normalizePhoneInput(phone), [phone]);
  const isSignup = mode === 'signup';

  const handleModeChange = (nextMode: AuthFlow) => {
    setMode(nextMode);
    setError('');
  };

  const handleSendOtp = async () => {
    const trimmedName = name.trim();

    if (isSignup && trimmedName.length < 2) {
      setError('Enter your full name.');
      return;
    }

    const isEmail = contactMethod === 'email';

    if (isEmail && !isEmailValid(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    if (!isEmail && !isPhoneValid(normalizedPhone)) {
      setError('Enter a valid phone number.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const result = await requestOtp(
        {
          email: isEmail ? normalizedEmail : undefined,
          phone: isEmail ? undefined : normalizedPhone,
          name: isSignup ? trimmedName : undefined,
          mode,
        },
        deviceId,
      );

      setPendingAuth({
        email: isEmail ? result.email || normalizedEmail : null,
        phone: isEmail ? null : result.phone || normalizedPhone,
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
          : 'Could not send a code right now. Please try again.';
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
          <Text style={styles.title}>{isSignup ? 'Create your account' : 'Welcome back'}</Text>
          <Text style={styles.subtitle}>
            {isSignup
              ? 'Create your account with email or phone.'
              : 'Use email or phone to continue.'}
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
            <View style={styles.contactSwitcher}>
              {(['email', 'phone'] as const).map((option) => {
                const active = contactMethod === option;

                return (
                  <Pressable
                    key={option}
                    onPress={() => {
                      setContactMethod(option);
                      setError('');
                    }}
                    style={[styles.contactChip, active && styles.contactChipActive]}
                  >
                    <Text style={[styles.contactChipText, active && styles.contactChipTextActive]}>
                      {option === 'email' ? 'Email' : 'Phone'}
                    </Text>
                  </Pressable>
                );
              })}
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

            {contactMethod === 'email' ? (
              <View style={[styles.fieldBlock, isSignup && styles.inputSpaced]}>
                <Text style={styles.label}>Email address</Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                  value={email}
                  textContentType="emailAddress"
                  onChangeText={(value) => {
                    setEmail(value);
                    if (error) {
                      setError('');
                    }
                  }}
                />
              </View>
            ) : (
              <View style={[styles.fieldBlock, isSignup && styles.inputSpaced]}>
                <Text style={styles.label}>Phone number</Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="tel"
                  keyboardType="phone-pad"
                  placeholder="+2348012345678"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                  value={phone}
                  textContentType="telephoneNumber"
                  onChangeText={(value) => {
                    setPhone(value);
                    if (error) {
                      setError('');
                    }
                  }}
                />
              </View>
            )}

            <DismissibleNoticeCard
              visible={Boolean(error)}
              title="Action needed"
              message={error}
              onDismiss={() => setError('')}
            />

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

            {__DEV__ &&
            process.env.EXPO_PUBLIC_APP_ENV !== 'production' &&
            process.env.EXPO_PUBLIC_ENABLE_DEV_TEST_SESSION !== 'false' ? (
              <Pressable
                onPress={enableDevTestMode}
                style={styles.testerAction}
              >
                <Text style={styles.testerText}>Use developer tester</Text>
              </Pressable>
            ) : null}
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
      paddingTop: 28,
      paddingBottom: 28,
    },
    heroBlock: {
      marginBottom: 20,
    },
    cardWrap: {
      borderRadius: 24,
      overflow: 'hidden',
    },
    card: {
      borderRadius: 24,
      padding: 22,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modeSwitcher: {
      flexDirection: 'row',
      gap: 10,
      padding: 6,
      borderRadius: 18,
      backgroundColor: theme.colors.backgroundElevated,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 18,
    },
    contactSwitcher: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    contactChip: {
      flex: 1,
      minHeight: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.backgroundElevated,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    contactChipActive: {
      backgroundColor: theme.colors.blueSoft,
      borderColor: theme.colors.blueGlow,
    },
    contactChipText: {
      color: theme.colors.muted,
      fontSize: 13,
      fontWeight: '700',
    },
    contactChipTextActive: {
      color: theme.colors.text,
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
      padding: 15,
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
      fontWeight: '800',
      fontSize: 15,
      textAlign: 'center',
    },
    secondaryAction: {
      paddingTop: 16,
      alignItems: 'center',
    },
    secondaryText: {
      color: theme.colors.muted,
      fontWeight: '700',
    },
    testerAction: {
      alignItems: 'center',
      paddingTop: 18,
    },
    testerText: {
      color: theme.colors.blueGlow,
      fontWeight: '800',
    },
  });
