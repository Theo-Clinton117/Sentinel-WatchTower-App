import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { DismissibleNoticeCard } from '../../components/DismissibleNoticeCard';
import { ApiError } from '../../services/api';
import { setInitialPassword } from '../../services/auth';
import { useAppStore } from '../../store/useAppStore';
import { useAppTheme } from '../../theme';

export const SetPasswordScreen = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { onboardingComplete, resetNavigation, setUser, user } = useAppStore();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (password.length < 12 || password.length > 256) {
      setError('Use a password between 12 and 256 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      await setInitialPassword(password);
      setUser(user ? { ...user, hasPassword: true } : user);
      resetNavigation(onboardingComplete ? 'home' : 'onboarding-contacts');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not set your password right now.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Account security</Text>
          <Text style={styles.title}>Set your password</Text>
          <Text style={styles.subtitle}>You are signed in. Create a password now so you can use email and password next time.</Text>
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput value={password} onChangeText={setPassword} secureTextEntry={!visible} autoComplete="new-password" textContentType="newPassword" style={styles.input} placeholder="At least 12 characters" placeholderTextColor={theme.colors.muted} />
            <Pressable style={styles.visibility} onPress={() => setVisible((value) => !value)}><Text style={styles.visibilityText}>{visible ? 'Hide' : 'Show'}</Text></Pressable>
          </View>
          <Text style={styles.requirement}>Use 12–256 characters. Passphrases and spaces are allowed.</Text>
          <Text style={styles.label}>Confirm password</Text>
          <TextInput value={confirmation} onChangeText={setConfirmation} secureTextEntry={!visible} autoComplete="new-password" textContentType="newPassword" style={styles.input} placeholder="Re-enter password" placeholderTextColor={theme.colors.muted} />
          <DismissibleNoticeCard visible={Boolean(error)} title="Password not set" message={error} onDismiss={() => setError('')} />
          <Pressable style={[styles.button, saving && styles.disabled]} onPress={submit} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save password</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  container: { flex: 1 }, content: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { padding: 22, borderRadius: 24, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  eyebrow: { color: theme.colors.blue, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  title: { color: theme.colors.text, fontSize: 28, fontWeight: '800' }, subtitle: { color: theme.colors.muted, lineHeight: 20, marginTop: 10, marginBottom: 22 },
  label: { color: theme.colors.text, fontWeight: '700', marginBottom: 8, marginTop: 14 },
  input: { flex: 1, color: theme.colors.text, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: theme.colors.backgroundElevated, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border },
  passwordRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  visibility: { minHeight: 48, paddingHorizontal: 12, borderRadius: 12, backgroundColor: theme.colors.blueSoft, justifyContent: 'center' }, visibilityText: { color: theme.colors.text, fontWeight: '800' },
  requirement: { color: theme.colors.muted, fontSize: 12, lineHeight: 17, marginTop: 7 },
  button: { minHeight: 52, borderRadius: 14, backgroundColor: theme.colors.blue, justifyContent: 'center', alignItems: 'center', marginTop: 22 }, buttonText: { color: '#fff', fontWeight: '800' }, disabled: { opacity: 0.7 },
});
