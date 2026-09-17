import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { DismissibleNoticeCard } from '../../components/DismissibleNoticeCard';
import { ApiError } from '../../services/api';
import { isEmailValid, requestPasswordReset, resetPassword } from '../../services/auth';
import { useAppStore } from '../../store/useAppStore';
import { useAppTheme } from '../../theme';

export const PasswordRecoveryScreen = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const resetNavigation = useAppStore((state) => state.resetNavigation);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [requested, setRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const requestCode = async () => {
    if (!isEmailValid(email)) return setError('Enter your registered email address.');
    try {
      setLoading(true); setError('');
      await requestPasswordReset(email);
      setRequested(true);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not send a recovery code right now.');
    } finally { setLoading(false); }
  };
  const submit = async () => {
    if (!/^\d{6}$/.test(code.trim())) return setError('Enter the six-digit recovery code.');
    if (password.length < 12 || password.length > 256) return setError('Use a password between 12 and 256 characters.');
    if (password !== confirmation) return setError('Passwords do not match.');
    try {
      setLoading(true); setError('');
      await resetPassword(email, code, password);
      resetNavigation('auth');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not reset your password right now.');
    } finally { setLoading(false); }
  };
  return <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.title}>{requested ? 'Set a new password' : 'Reset your password'}</Text>
        <Text style={styles.subtitle}>{requested ? 'Enter the code sent to your email and choose a new password.' : 'We will send a recovery code if this email belongs to a Sentinel account.'}</Text>
        <TextInput value={email} editable={!requested && !loading} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="you@example.com" placeholderTextColor={theme.colors.muted} style={styles.input} />
        {requested ? <>
          <TextInput value={code} onChangeText={(value) => setCode(value.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} placeholder="Recovery code" placeholderTextColor={theme.colors.muted} style={styles.input} />
          <TextInput value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder="New password (12+ characters)" placeholderTextColor={theme.colors.muted} style={styles.input} />
          <TextInput value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" placeholder="Confirm new password" placeholderTextColor={theme.colors.muted} style={styles.input} />
        </> : null}
        <DismissibleNoticeCard visible={Boolean(error)} title="Password recovery" message={error} onDismiss={() => setError('')} />
        <Pressable disabled={loading} onPress={requested ? submit : requestCode} style={[styles.button, loading && styles.disabled]}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{requested ? 'Reset password' : 'Send recovery code'}</Text>}
        </Pressable>
        <Pressable onPress={() => resetNavigation('auth')} style={styles.back}><Text style={styles.backText}>Back to sign in</Text></Pressable>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  container: { flex: 1 }, content: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { padding: 22, borderRadius: 24, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  title: { color: theme.colors.text, fontSize: 28, fontWeight: '800' }, subtitle: { color: theme.colors.muted, lineHeight: 20, marginTop: 10, marginBottom: 18 },
  input: { color: theme.colors.text, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: theme.colors.backgroundElevated, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, marginTop: 10 },
  button: { minHeight: 52, borderRadius: 14, backgroundColor: theme.colors.blue, justifyContent: 'center', alignItems: 'center', marginTop: 20 }, buttonText: { color: '#fff', fontWeight: '800' }, disabled: { opacity: 0.7 },
  back: { alignItems: 'center', paddingTop: 18 }, backText: { color: theme.colors.muted, fontWeight: '700' },
});
