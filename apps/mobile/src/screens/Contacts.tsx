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
import { MotionView } from '../components/MotionView';
import { ApiError } from '../services/api';
import { createContact, listContacts, TrustedContact } from '../services/contacts';
import { useAppStore } from '../store/useAppStore';
import { useAppTheme } from '../theme';

const directorySeed = [
  { id: 'directory-1', name: 'Ada Nwosu', phone: '+2348011112233', email: 'ada@sentinel.app' },
  { id: 'directory-2', name: 'Kunle Adebayo', phone: '+2348095550101', email: 'kunle@sentinel.app' },
  { id: 'directory-3', name: 'Maya Eze', phone: '+2348034447777', email: 'maya@sentinel.app' },
  { id: 'directory-4', name: 'Tari Briggs', phone: '+2348069182200', email: 'tari@sentinel.app' },
];

const watchDurations = [30, 60, 120];

export const ContactsScreen = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const {
    activeWatchSession,
    endWatchSession,
    startWatchSession,
  } = useAppStore();
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [watchNote, setWatchNote] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [canViewLocation, setCanViewLocation] = useState(true);

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
          setError(loadError instanceof ApiError ? loadError.message : 'Could not load contacts.');
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

  const formValid = useMemo(
    () => contactName.trim().length >= 2 && contactPhone.trim().length >= 8,
    [contactName, contactPhone],
  );

  const filteredContacts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return contacts;
    }

    return contacts.filter((contact) =>
      [contact.contactName, contact.contactPhone, contact.contactEmail]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query)),
    );
  }, [contacts, searchQuery]);

  const directoryResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return directorySeed.slice(0, 3);
    }

    return directorySeed.filter((entry) =>
      [entry.name, entry.phone, entry.email].some((value) => value.toLowerCase().includes(query)),
    );
  }, [searchQuery]);

  const selectedContact =
    contacts.find((contact) => contact.id === selectedContactId) || filteredContacts[0] || contacts[0] || null;

  useEffect(() => {
    if (!selectedContactId && filteredContacts[0]?.id) {
      setSelectedContactId(filteredContacts[0].id);
    }
  }, [filteredContacts, selectedContactId]);

  const handleSave = async () => {
    if (!formValid) {
      setError('Add a valid name and phone number before saving.');
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
        canCall: true,
        canSms: true,
        canViewHistory: true,
      });
      setContacts((current) => [...current, created]);
      setSelectedContactId(created.id);
      setContactName('');
      setContactPhone('');
      setContactEmail('');
      setCanViewLocation(true);
      setShowForm(false);
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : 'Could not save contact.');
    } finally {
      setSaving(false);
    }
  };

  const handleDirectoryAdd = (entry: (typeof directorySeed)[number]) => {
    setShowForm(true);
    setContactName(entry.name);
    setContactPhone(entry.phone);
    setContactEmail(entry.email);
    setError('');
  };

  const handleStartWatchSession = () => {
    if (!selectedContact) {
      setError('Choose a trusted contact before starting a watch session.');
      return;
    }

    startWatchSession({
      contactId: selectedContact.id,
      contactName: selectedContact.contactName || selectedContact.contactPhone || 'Trusted contact',
      contactPhone: selectedContact.contactPhone,
      durationMinutes: selectedDuration,
      note: watchNote.trim() || null,
    });
    setWatchNote('');
    setError('');
  };

  const activeWatchMatchesSelected = activeWatchSession?.contactId === selectedContact?.id;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <MotionView delay={40}>
        <Text style={styles.title}>Contacts</Text>
        <Text style={styles.subtitle}>
          Search your circle, add new people, and hand someone a timed watch session when you want extra cover.
        </Text>
      </MotionView>

      <MotionView delay={100} style={[styles.searchCard, theme.shadow.card]}>
        <TextInput
          placeholder="Search your contacts or discover someone by name"
          placeholderTextColor={theme.colors.muted}
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <Text style={styles.searchHint}>Results include your trusted circle and suggested people to add.</Text>
      </MotionView>

      <MotionView delay={150} style={[styles.sectionCard, theme.shadow.card]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trusted circle</Text>
          {loading ? <ActivityIndicator color={theme.colors.blueGlow} /> : null}
        </View>
        {filteredContacts.length === 0 && !loading ? (
          <Text style={styles.emptyText}>No contact matches yet. Add one below or pick from the suggested list.</Text>
        ) : null}
        {filteredContacts.map((contact) => {
          const active = selectedContactId === contact.id;

          return (
            <Pressable
              key={contact.id}
              onPress={() => setSelectedContactId(contact.id)}
              style={[styles.contactCard, active && styles.contactCardActive]}
            >
              <View style={styles.contactRow}>
                <View style={styles.contactAvatar}>
                  <Text style={styles.contactAvatarText}>
                    {(contact.contactName || contact.contactPhone || '?').slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.contactCopy}>
                  <Text style={styles.contactName}>{contact.contactName || 'Unnamed contact'}</Text>
                  <Text style={styles.contactMeta}>{contact.contactPhone || 'No phone number'}</Text>
                  {contact.contactEmail ? <Text style={styles.contactMeta}>{contact.contactEmail}</Text> : null}
                </View>
                <View style={styles.contactBadge}>
                  <Text style={styles.contactBadgeText}>
                    {contact.canViewLocation ? 'Watch-ready' : 'Alert-only'}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </MotionView>

      <MotionView delay={210} style={[styles.sectionCard, theme.shadow.card]}>
        <Text style={styles.sectionTitle}>Suggested people</Text>
        <Text style={styles.sectionMeta}>Use search to find a match, then add them into your circle.</Text>
        {directoryResults.map((entry) => (
          <View key={entry.id} style={styles.directoryRow}>
            <View style={styles.directoryCopy}>
              <Text style={styles.directoryName}>{entry.name}</Text>
              <Text style={styles.directoryMeta}>{entry.phone}</Text>
            </View>
            <Pressable style={styles.directoryButton} onPress={() => handleDirectoryAdd(entry)}>
              <Text style={styles.directoryButtonText}>Add</Text>
            </Pressable>
          </View>
        ))}
      </MotionView>

      <MotionView delay={260} style={[styles.sectionCard, theme.shadow.card]}>
        <Text style={styles.sectionTitle}>Watch session</Text>
        <Text style={styles.sectionMeta}>
          Give a trusted contact temporary permission to track your movements while you commute or travel.
        </Text>
        <View style={styles.watchHero}>
          <Text style={styles.watchHeroLabel}>Selected contact</Text>
          <Text style={styles.watchHeroName}>
            {selectedContact
              ? selectedContact.contactName || selectedContact.contactPhone || 'Trusted contact'
              : 'Choose a contact above'}
          </Text>
          <Text style={styles.watchHeroMeta}>
            {activeWatchSession
              ? `Active until ${new Date(activeWatchSession.endsAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
              : 'The session ends automatically after the duration you choose.'}
          </Text>
        </View>
        <View style={styles.durationRow}>
          {watchDurations.map((minutes) => {
            const active = selectedDuration === minutes;

            return (
              <Pressable
                key={minutes}
                onPress={() => setSelectedDuration(minutes)}
                style={[styles.durationChip, active && styles.durationChipActive]}
              >
                <Text style={[styles.durationText, active && styles.durationTextActive]}>{minutes} min</Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          placeholder="Optional note, like destination or route"
          placeholderTextColor={theme.colors.muted}
          style={styles.noteInput}
          value={watchNote}
          onChangeText={setWatchNote}
        />
        {activeWatchSession ? (
          <Pressable style={[styles.secondaryButton, theme.shadow.card]} onPress={endWatchSession}>
            <Text style={styles.secondaryButtonText}>
              {activeWatchMatchesSelected ? 'End current watch session' : 'End active watch session'}
            </Text>
          </Pressable>
        ) : null}
        <Pressable style={[styles.primaryButton, theme.shadow.glow]} onPress={handleStartWatchSession}>
          <Text style={styles.primaryButtonText}>Start watch session</Text>
        </Pressable>
      </MotionView>

      {showForm ? (
        <MotionView delay={320} style={[styles.sectionCard, theme.shadow.card]}>
          <Text style={styles.sectionTitle}>Add trusted contact</Text>
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
            placeholder="Email (optional)"
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
            value={contactEmail}
            onChangeText={setContactEmail}
          />
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleTitle}>Allow live tracking</Text>
              <Text style={styles.toggleNote}>Turn this on if this person can join watch sessions.</Text>
            </View>
            <Switch
              value={canViewLocation}
              onValueChange={setCanViewLocation}
              trackColor={{ false: theme.colors.border, true: theme.colors.blueGlow }}
              thumbColor={theme.colors.text}
            />
          </View>
          <Pressable
            style={[styles.primaryButton, (!formValid || saving) && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={!formValid || saving}
          >
            {saving ? <ActivityIndicator color={theme.colors.text} /> : <Text style={styles.primaryButtonText}>Save Contact</Text>}
          </Pressable>
        </MotionView>
      ) : (
        <MotionView delay={320}>
          <Pressable style={[styles.primaryButton, theme.shadow.glow]} onPress={() => setShowForm(true)}>
            <Text style={styles.primaryButtonText}>Add contact manually</Text>
          </Pressable>
        </MotionView>
      )}

      {error ? (
        <MotionView delay={360}>
          <Text style={styles.error}>{error}</Text>
        </MotionView>
      ) : null}
    </ScrollView>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    content: {
      padding: 20,
      paddingBottom: 120,
    },
    title: {
      color: theme.colors.text,
      fontSize: 28,
      fontWeight: '800',
      marginBottom: 10,
    },
    subtitle: {
      color: theme.colors.muted,
      lineHeight: 20,
      marginBottom: 16,
    },
    searchCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 24,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 16,
    },
    searchInput: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 14,
      color: theme.colors.text,
      backgroundColor: theme.colors.backgroundElevated,
    },
    searchHint: {
      color: theme.colors.muted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 10,
    },
    sectionCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 24,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    sectionTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 6,
    },
    sectionMeta: {
      color: theme.colors.muted,
      lineHeight: 18,
      marginBottom: 14,
    },
    emptyText: {
      color: theme.colors.muted,
      lineHeight: 19,
    },
    contactCard: {
      padding: 14,
      borderRadius: 18,
      backgroundColor: theme.colors.backgroundElevated,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginTop: 10,
    },
    contactCardActive: {
      borderColor: theme.colors.blueGlow,
      backgroundColor: theme.colors.blueSoft,
    },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    contactAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceStrong,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
    },
    contactAvatarText: {
      color: theme.colors.text,
      fontWeight: '800',
      fontSize: 16,
    },
    contactCopy: {
      flex: 1,
    },
    contactName: {
      color: theme.colors.text,
      fontWeight: '700',
      marginBottom: 4,
    },
    contactMeta: {
      color: theme.colors.muted,
      fontSize: 12,
      marginTop: 2,
    },
    contactBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: theme.colors.surfaceStrong,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    contactBadgeText: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: '700',
    },
    directoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    directoryCopy: {
      flex: 1,
      paddingRight: 12,
    },
    directoryName: {
      color: theme.colors.text,
      fontWeight: '700',
      marginBottom: 4,
    },
    directoryMeta: {
      color: theme.colors.muted,
      fontSize: 12,
    },
    directoryButton: {
      minWidth: 70,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 14,
      alignItems: 'center',
      backgroundColor: theme.colors.blueSoft,
      borderWidth: 1,
      borderColor: theme.colors.blueGlow,
    },
    directoryButtonText: {
      color: theme.colors.text,
      fontWeight: '700',
    },
    watchHero: {
      padding: 16,
      borderRadius: 18,
      backgroundColor: theme.colors.backgroundElevated,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 14,
    },
    watchHeroLabel: {
      color: theme.colors.blue,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 6,
    },
    watchHeroName: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 4,
    },
    watchHeroMeta: {
      color: theme.colors.muted,
      fontSize: 12,
      lineHeight: 17,
    },
    durationRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
      flexWrap: 'wrap',
    },
    durationChip: {
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElevated,
    },
    durationChipActive: {
      backgroundColor: theme.colors.blueSoft,
      borderColor: theme.colors.blueGlow,
    },
    durationText: {
      color: theme.colors.muted,
      fontWeight: '700',
    },
    durationTextActive: {
      color: theme.colors.text,
    },
    noteInput: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 13,
      color: theme.colors.text,
      backgroundColor: theme.colors.backgroundElevated,
      marginBottom: 12,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 13,
      color: theme.colors.text,
      backgroundColor: theme.colors.backgroundElevated,
      marginTop: 12,
    },
    toggleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      alignItems: 'center',
      marginTop: 12,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElevated,
    },
    toggleCopy: {
      flex: 1,
    },
    toggleTitle: {
      color: theme.colors.text,
      fontWeight: '700',
      marginBottom: 4,
    },
    toggleNote: {
      color: theme.colors.muted,
      fontSize: 12,
      lineHeight: 17,
    },
    primaryButton: {
      minHeight: 52,
      paddingHorizontal: 16,
      borderRadius: 16,
      backgroundColor: theme.colors.blue,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 6,
    },
    primaryButtonText: {
      color: theme.colors.text,
      fontWeight: '700',
    },
    secondaryButton: {
      minHeight: 48,
      paddingHorizontal: 16,
      borderRadius: 16,
      backgroundColor: theme.colors.surfaceStrong,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    secondaryButtonText: {
      color: theme.colors.text,
      fontWeight: '700',
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    error: {
      color: theme.colors.red,
      lineHeight: 18,
      marginBottom: 8,
    },
  });
