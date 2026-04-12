import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AuthArtPanel } from '../../components/AuthArtPanel';
import { MotionView } from '../../components/MotionView';
import { useAppStore } from '../../store/useAppStore';
import { ApiError } from '../../services/api';
import { createContact, listContacts, TrustedContact } from '../../services/contacts';
import { useAppTheme } from '../../theme';

export const OnboardingContactsScreen = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { pushScreen } = useAppStore();
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [canViewLocation, setCanViewLocation] = useState(true);
  const [canSms, setCanSms] = useState(true);

  useEffect(() => {
    let active = true;

    const loadContacts = async () => {
      try {
        const result = await listContacts();
        if (active) {
          setContacts(result);
          setError('');
        }
      } catch (loadError) {
        if (active) {
          const message =
            loadError instanceof ApiError
              ? loadError.message
              : 'Could not load saved contacts right now.';
          setError(message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadContacts();

    return () => {
      active = false;
    };
  }, []);

  const formValid = useMemo(() => {
    const trimmedPhone = contactPhone.replace(/[^\d+]/g, '');
    return contactName.trim().length >= 2 && trimmedPhone.length >= 8;
  }, [contactName, contactPhone]);

  const handleAddContact = async () => {
    if (!formValid) {
      setError('Add at least a name and a valid phone number before saving a contact.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      const created = await createContact({
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        contactEmail: contactEmail.trim() || undefined,
        priority: contacts.length,
        canViewLocation,
        canSms,
        canCall: true,
        canViewHistory: false,
      });
      setContacts((current) => [...current, created]);
      setContactName('');
      setContactPhone('');
      setContactEmail('');
      setCanViewLocation(true);
      setCanSms(true);
    } catch (saveError) {
      const message =
        saveError instanceof ApiError
          ? saveError.message
          : 'Could not save this contact right now.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <MotionView delay={20}>
        <AuthArtPanel
          eyebrow="Trusted Circle"
          title="Build your first response network."
          caption="These are the people who should receive your location, emergency notice, and follow-up signals first."
          chipA="LOCATION READY"
          chipB="FALLBACK SMS"
        />
      </MotionView>
      <MotionView delay={40}>
        <Text style={styles.title}>Add Trusted Contacts</Text>
        <Text style={styles.subtitle}>
          Add the people who should hear from you first when an emergency alert starts.
        </Text>
      </MotionView>

      <MotionView delay={120} style={[styles.formCard, theme.shadow.card]}>
        <Text style={styles.sectionTitle}>Primary contact</Text>
        <TextInput
          placeholder="Full name"
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
          value={contactName}
          onChangeText={setContactName}
        />
        <TextInput
          placeholder="+2348012345678"
          placeholderTextColor={theme.colors.muted}
          keyboardType="phone-pad"
          style={styles.input}
          value={contactPhone}
          onChangeText={setContactPhone}
        />
        <TextInput
          placeholder="Email address (optional)"
          placeholderTextColor={theme.colors.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
          value={contactEmail}
          onChangeText={setContactEmail}
        />

        <View style={styles.preferenceRow}>
          <View style={styles.preferenceTextWrap}>
            <Text style={styles.preferenceTitle}>Share live location</Text>
            <Text style={styles.preferenceCaption}>Let this contact see your emergency map.</Text>
          </View>
          <Switch
            value={canViewLocation}
            onValueChange={setCanViewLocation}
            trackColor={{ false: theme.colors.border, true: theme.colors.blueGlow }}
            thumbColor={theme.colors.text}
          />
        </View>

        <View style={styles.preferenceRow}>
          <View style={styles.preferenceTextWrap}>
            <Text style={styles.preferenceTitle}>Send SMS fallback</Text>
            <Text style={styles.preferenceCaption}>Use text messaging if push delivery is delayed.</Text>
          </View>
          <Switch
            value={canSms}
            onValueChange={setCanSms}
            trackColor={{ false: theme.colors.border, true: theme.colors.blueGlow }}
            thumbColor={theme.colors.text}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, (!formValid || saving) && styles.buttonDisabled]}
          onPress={handleAddContact}
          disabled={!formValid || saving}
        >
          {saving ? <ActivityIndicator color={theme.colors.text} /> : <Text style={styles.buttonText}>Save Contact</Text>}
        </Pressable>
      </MotionView>

      <MotionView delay={190} style={[styles.listCard, theme.shadow.card]}>
        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Trusted circle</Text>
          {loading ? <ActivityIndicator color={theme.colors.blueGlow} /> : null}
        </View>

        {!loading && contacts.length === 0 ? (
          <Text style={styles.emptyText}>No trusted contacts added yet. Add at least one to make alerts more useful.</Text>
        ) : null}

        {contacts.map((contact, index) => (
          <View key={contact.id || `${contact.contactPhone}-${index}`} style={styles.contactCard}>
            <View style={styles.contactHeader}>
              <Text style={styles.contactName}>{contact.contactName || 'Unnamed contact'}</Text>
              <Text style={styles.contactRank}>#{index + 1}</Text>
            </View>
            <Text style={styles.contactMeta}>{contact.contactPhone || 'No phone number'}</Text>
            {contact.contactEmail ? <Text style={styles.contactMeta}>{contact.contactEmail}</Text> : null}
            <View style={styles.tagRow}>
              {contact.canViewLocation ? <Text style={styles.tag}>Location</Text> : null}
              {contact.canSms ? <Text style={styles.tag}>SMS</Text> : null}
              {contact.canCall ? <Text style={styles.tag}>Call</Text> : null}
            </View>
          </View>
        ))}
      </MotionView>

      <Pressable style={[styles.secondary, theme.shadow.card]} onPress={() => pushScreen('onboarding-permissions')}>
        <Text style={styles.secondaryText}>
          {contacts.length > 0 ? 'Continue to Permissions' : 'Skip for Now'}
        </Text>
      </Pressable>
    </ScrollView>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  title: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 10,
  },
  subtitle: {
    color: theme.colors.muted,
    lineHeight: 20,
    marginBottom: 6,
  },
  formCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  listCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: theme.colors.text,
    backgroundColor: theme.colors.backgroundElevated,
    marginBottom: 12,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: theme.colors.backgroundElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  preferenceTextWrap: {
    flex: 1,
  },
  preferenceTitle: {
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  preferenceCaption: {
    color: theme.colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  error: {
    color: theme.colors.red,
    marginBottom: 12,
    lineHeight: 18,
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
    opacity: 0.65,
  },
  buttonText: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  emptyText: {
    color: theme.colors.muted,
    lineHeight: 19,
  },
  contactCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: theme.colors.backgroundElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 12,
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  contactName: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
  contactRank: {
    color: theme.colors.blueGlow,
    fontWeight: '700',
  },
  contactMeta: {
    color: theme.colors.muted,
    marginTop: 2,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  tag: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: theme.colors.blueSoft,
    borderWidth: 1,
    borderColor: theme.colors.blueGlow,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  secondary: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    marginTop: 2,
  },
  secondaryText: {
    color: theme.colors.text,
    fontWeight: '600',
  },
});
