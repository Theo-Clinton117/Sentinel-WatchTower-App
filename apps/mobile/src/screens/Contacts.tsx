import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {
  createContact,
  deleteContact,
  listContacts,
  searchSentinelUsersByEmail,
  type SentinelUserMatch,
  type TrustedContact,
  updateContact,
} from '../services/contacts';
import {
  loadDeviceContactsWithSentinelMatches,
  type DeviceContactCandidate,
} from '../services/device-contacts';
import { useAppStore } from '../store/useAppStore';
import { useAppTheme } from '../theme';

const watchDurations = [30, 60, 120];

function normalizeEmail(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function normalizePhone(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  const compact = raw.replace(/[^\d+]/g, '');
  if (!compact) {
    return '';
  }

  if (compact.startsWith('+')) {
    return `+${compact.slice(1).replace(/\D/g, '')}`;
  }

  return compact.replace(/\D/g, '');
}

function isValidEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value.trim());
}

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
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [watchNote, setWatchNote] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
  const [savingEntryKey, setSavingEntryKey] = useState<string | null>(null);
  const [showDiscoveryTools, setShowDiscoveryTools] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [canViewLocation, setCanViewLocation] = useState(true);
  const [deviceContacts, setDeviceContacts] = useState<DeviceContactCandidate[]>([]);
  const [loadingDeviceContacts, setLoadingDeviceContacts] = useState(false);
  const [emailSearchQuery, setEmailSearchQuery] = useState('');
  const [emailSearchResults, setEmailSearchResults] = useState<SentinelUserMatch[]>([]);
  const [searchingByEmail, setSearchingByEmail] = useState(false);

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

  const filteredDeviceContacts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return deviceContacts;
    }

    return deviceContacts.filter((contact) =>
      [contact.name, contact.primaryPhone, contact.primaryEmail]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query)),
    );
  }, [deviceContacts, searchQuery]);

  const selectedContact =
    contacts.find((contact) => contact.id === selectedContactId) ||
    filteredContacts[0] ||
    contacts[0] ||
    null;

  useEffect(() => {
    if (!selectedContactId && filteredContacts[0]?.id) {
      setSelectedContactId(filteredContacts[0].id);
    }
  }, [filteredContacts, selectedContactId]);

  const formValid = useMemo(() => {
    const trimmedPhone = normalizePhone(contactPhone);
    const trimmedEmail = contactEmail.trim();
    return contactName.trim().length >= 2 && (trimmedPhone.length >= 8 || isValidEmail(trimmedEmail));
  }, [contactEmail, contactName, contactPhone]);

  const isAlreadyTrusted = (candidate: {
    userId?: string | null;
    email?: string | null;
    phone?: string | null;
  }) => {
    const email = normalizeEmail(candidate.email);
    const phone = normalizePhone(candidate.phone);

    return contacts.some((contact) => {
      if (candidate.userId && contact.contactUserId === candidate.userId) {
        return true;
      }

      return (
        (email && normalizeEmail(contact.contactEmail) === email) ||
        (phone && normalizePhone(contact.contactPhone) === phone)
      );
    });
  };

  const addTrustedContact = async (payload: {
    key: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    contactUserId?: string | null;
  }) => {
    try {
      setSavingEntryKey(payload.key);
      setError('');
      const created = await createContact({
        contactName: payload.name.trim(),
        contactPhone: payload.phone ? normalizePhone(payload.phone) : undefined,
        contactEmail: payload.email?.trim() || undefined,
        contactUserId: payload.contactUserId || undefined,
        status: payload.contactUserId ? 'active' : undefined,
        priority: contacts.length,
        canViewLocation: true,
        canCall: true,
        canSms: true,
        canViewHistory: true,
      });
      setContacts((current) => [...current, created]);
      setSelectedContactId(created.id);
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : 'Could not save contact.');
    } finally {
      setSavingEntryKey(null);
    }
  };

  const resetContactForm = () => {
    setContactName('');
    setContactPhone('');
    setContactEmail('');
    setCanViewLocation(true);
    setEditingContactId(null);
    setShowForm(false);
  };

  const handleEditContact = (contact: TrustedContact) => {
    setEditingContactId(contact.id);
    setContactName(contact.contactName || '');
    setContactPhone(contact.contactPhone || '');
    setContactEmail(contact.contactEmail || '');
    setCanViewLocation(contact.canViewLocation ?? true);
    setShowForm(true);
    setError('');
  };

  const handleDeleteContact = (contact: TrustedContact) => {
    Alert.alert(
      'Remove trusted contact',
      `Remove ${contact.contactName || contact.contactEmail || contact.contactPhone || 'this contact'} from your trusted circle?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingContactId(contact.id);
              setError('');
              await deleteContact(contact.id);
              setContacts((current) => current.filter((item) => item.id !== contact.id));
              if (selectedContactId === contact.id) {
                setSelectedContactId(null);
              }
              if (editingContactId === contact.id) {
                resetContactForm();
              }
            } catch (deleteError) {
              setError(deleteError instanceof ApiError ? deleteError.message : 'Could not remove contact.');
            } finally {
              setDeletingContactId(null);
            }
          },
        },
      ],
    );
  };

  const handleSave = async () => {
    if (!formValid) {
      setError('Add a valid name plus either a phone number or an email before saving.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      const payload = {
        contactName: contactName.trim(),
        contactPhone: normalizePhone(contactPhone) || undefined,
        contactEmail: contactEmail.trim() || undefined,
        canViewLocation,
        canCall: true,
        canSms: true,
        canViewHistory: true,
      };

      if (editingContactId) {
        const updated = await updateContact(editingContactId, payload);
        setContacts((current) =>
          current.map((contact) => (contact.id === updated.id ? updated : contact)),
        );
        setSelectedContactId(updated.id);
      } else {
        const created = await createContact({
          ...payload,
          priority: contacts.length,
        });
        setContacts((current) => [...current, created]);
        setSelectedContactId(created.id);
      }

      resetContactForm();
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : 'Could not save contact.');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadDeviceContacts = async () => {
    try {
      setLoadingDeviceContacts(true);
      setError('');
      const importedContacts = await loadDeviceContactsWithSentinelMatches();
      setDeviceContacts(importedContacts);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : 'Could not access your phone contacts right now.';
      setError(message);
    } finally {
      setLoadingDeviceContacts(false);
    }
  };

  const handleEmailSearch = async () => {
    const query = emailSearchQuery.trim();
    if (!isValidEmail(query) && query.length < 3) {
      setError('Enter an email or enough of it to search Sentinel users.');
      return;
    }

    try {
      setSearchingByEmail(true);
      setError('');
      const result = await searchSentinelUsersByEmail(query);
      setEmailSearchResults(result);
    } catch (searchError) {
      setError(searchError instanceof ApiError ? searchError.message : 'Could not search by email.');
    } finally {
      setSearchingByEmail(false);
    }
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
          Choose the people Sentinel should contact first when you need help or want someone to watch your trip.
        </Text>
      </MotionView>

      <MotionView delay={100} style={[styles.searchCard, theme.shadow.card]}>
        <TextInput
          placeholder="Search your trusted circle and imported contacts"
          placeholderTextColor={theme.colors.muted}
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <Text style={styles.searchHint}>
          Search by name, phone, or email. Keep this list focused on people who will actually respond.
        </Text>
      </MotionView>

      <MotionView delay={150} style={[styles.sectionCard, theme.shadow.card]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trusted circle</Text>
          {loading ? <ActivityIndicator color={theme.colors.blueGlow} /> : null}
        </View>
        {filteredContacts.length === 0 && !loading ? (
          <Text style={styles.emptyText}>No trusted contacts yet. Add one person you would call first in a difficult moment.</Text>
        ) : null}
        {filteredContacts.map((contact) => {
          const active = selectedContactId === contact.id;
          const deleting = deletingContactId === contact.id;
          const badgeLabel = contact.contactUserId
            ? 'On Sentinel'
            : contact.canViewLocation
              ? 'Watch-ready'
              : 'Alert-only';

          return (
            <View key={contact.id} style={[styles.contactCard, active && styles.contactCardActive]}>
              <Pressable onPress={() => setSelectedContactId(contact.id)}>
                <View style={styles.contactRow}>
                  <View style={styles.contactAvatar}>
                    <Text style={styles.contactAvatarText}>
                      {(contact.contactName || contact.contactPhone || '?').slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.contactCopy}>
                    <Text style={styles.contactName}>{contact.contactName || 'Unnamed contact'}</Text>
                    {contact.contactPhone ? <Text style={styles.contactMeta}>{contact.contactPhone}</Text> : null}
                    {contact.contactEmail ? <Text style={styles.contactMeta}>{contact.contactEmail}</Text> : null}
                  </View>
                  <View style={styles.contactBadge}>
                    <Text style={styles.contactBadgeText}>{badgeLabel}</Text>
                  </View>
                </View>
              </Pressable>
              {active ? (
                <View style={styles.contactActionRow}>
                  <Pressable style={styles.contactActionButton} onPress={() => handleEditContact(contact)}>
                    <Text style={styles.contactActionText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.contactActionButton, styles.contactDangerButton]}
                    onPress={() => handleDeleteContact(contact)}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <ActivityIndicator color={theme.colors.text} />
                    ) : (
                      <Text style={styles.contactActionText}>Remove</Text>
                    )}
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </MotionView>

      <MotionView delay={210} style={[styles.sectionCard, theme.shadow.card]}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderCopy}>
            <Text style={styles.sectionTitle}>Find more people</Text>
            <Text style={styles.sectionMeta}>
              Import from your phone or search by email when you want to add more trusted people.
            </Text>
          </View>
          <Pressable
            style={styles.inlineButton}
            onPress={() => setShowDiscoveryTools((value) => !value)}
          >
            <Text style={styles.inlineButtonText}>{showDiscoveryTools ? 'Hide' : 'Open'}</Text>
          </Pressable>
        </View>

        {showDiscoveryTools ? (
          <>
            <View style={styles.discoveryBlock}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderCopy}>
                  <Text style={styles.compactTitle}>Phone contacts</Text>
                  <Text style={styles.compactMeta}>Find people from your phone book and add them faster.</Text>
                </View>
                <Pressable style={styles.inlineButton} onPress={handleLoadDeviceContacts}>
                  {loadingDeviceContacts ? (
                    <ActivityIndicator color={theme.colors.text} />
                  ) : (
                    <Text style={styles.inlineButtonText}>
                      {deviceContacts.length > 0 ? 'Refresh' : 'Load'}
                    </Text>
                  )}
                </Pressable>
              </View>
              {filteredDeviceContacts.length === 0 && !loadingDeviceContacts ? (
                <Text style={styles.emptyText}>
                  {deviceContacts.length === 0
                    ? 'No phone contacts loaded yet.'
                    : 'No imported phone contact matches this search.'}
                </Text>
              ) : null}
              {filteredDeviceContacts.slice(0, 8).map((entry) => {
                const alreadyTrusted = isAlreadyTrusted({
                  userId: entry.sentinelMatch?.userId,
                  email: entry.primaryEmail,
                  phone: entry.primaryPhone,
                });
                const buttonBusy = savingEntryKey === `device:${entry.id}`;

                return (
                  <View key={entry.id} style={styles.directoryRow}>
                    <View style={styles.directoryCopy}>
                      <View style={styles.directoryTitleRow}>
                        <Text style={styles.directoryName}>{entry.name}</Text>
                        <View
                          style={[
                            styles.discoveryBadge,
                            entry.hasSentinel ? styles.discoveryBadgeActive : styles.discoveryBadgeMuted,
                          ]}
                        >
                          <Text style={styles.discoveryBadgeText}>
                            {entry.hasSentinel ? 'On Sentinel' : 'Phone contact'}
                          </Text>
                        </View>
                      </View>
                      {entry.primaryPhone ? <Text style={styles.directoryMeta}>{entry.primaryPhone}</Text> : null}
                      {entry.primaryEmail ? <Text style={styles.directoryMeta}>{entry.primaryEmail}</Text> : null}
                    </View>
                    <Pressable
                      style={[styles.directoryButton, alreadyTrusted && styles.directoryButtonDisabled]}
                      onPress={() =>
                        addTrustedContact({
                          key: `device:${entry.id}`,
                          name: entry.sentinelMatch?.name || entry.name,
                          phone: entry.sentinelMatch?.phone || entry.primaryPhone,
                          email: entry.sentinelMatch?.email || entry.primaryEmail,
                          contactUserId: entry.sentinelMatch?.userId,
                        })
                      }
                      disabled={alreadyTrusted || buttonBusy}
                    >
                      {buttonBusy ? (
                        <ActivityIndicator color={theme.colors.text} />
                      ) : (
                        <Text style={styles.directoryButtonText}>
                          {alreadyTrusted ? 'Added' : 'Add'}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <View style={styles.discoveryBlock}>
              <Text style={styles.compactTitle}>Search by email</Text>
              <View style={styles.emailSearchRow}>
                <TextInput
                  placeholder="name@example.com"
                  placeholderTextColor={theme.colors.muted}
                  style={[styles.searchInput, styles.emailSearchInput]}
                  value={emailSearchQuery}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onChangeText={setEmailSearchQuery}
                />
                <Pressable style={styles.inlineButtonWide} onPress={handleEmailSearch}>
                  {searchingByEmail ? (
                    <ActivityIndicator color={theme.colors.text} />
                  ) : (
                    <Text style={styles.inlineButtonText}>Search</Text>
                  )}
                </Pressable>
              </View>
              {emailSearchResults.map((result) => {
                const alreadyTrusted = isAlreadyTrusted({
                  userId: result.userId,
                  email: result.email,
                  phone: result.phone,
                });
                const buttonBusy = savingEntryKey === `email:${result.userId}`;

                return (
                  <View key={result.userId} style={styles.directoryRow}>
                    <View style={styles.directoryCopy}>
                      <View style={styles.directoryTitleRow}>
                        <Text style={styles.directoryName}>{result.name || result.email || 'Sentinel user'}</Text>
                        <View style={[styles.discoveryBadge, styles.discoveryBadgeActive]}>
                          <Text style={styles.discoveryBadgeText}>On Sentinel</Text>
                        </View>
                      </View>
                      {result.email ? <Text style={styles.directoryMeta}>{result.email}</Text> : null}
                      {result.phone ? <Text style={styles.directoryMeta}>{result.phone}</Text> : null}
                    </View>
                    <Pressable
                      style={[styles.directoryButton, alreadyTrusted && styles.directoryButtonDisabled]}
                      onPress={() =>
                        addTrustedContact({
                          key: `email:${result.userId}`,
                          name: result.name || result.email || 'Sentinel user',
                          phone: result.phone,
                          email: result.email,
                          contactUserId: result.userId,
                        })
                      }
                      disabled={alreadyTrusted || buttonBusy}
                    >
                      {buttonBusy ? (
                        <ActivityIndicator color={theme.colors.text} />
                      ) : (
                        <Text style={styles.directoryButtonText}>
                          {alreadyTrusted ? 'Added' : 'Add'}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}
      </MotionView>

      <MotionView delay={310} style={[styles.sectionCard, theme.shadow.card]}>
        <Text style={styles.sectionTitle}>Watch session</Text>
        <Text style={styles.sectionMeta}>
          Let one trusted contact follow your route for a limited time, such as during a commute, walk, or trip.
        </Text>
        <View style={styles.watchHero}>
          <Text style={styles.watchHeroLabel}>Selected contact</Text>
          <Text style={styles.watchHeroName}>
            {selectedContact
              ? selectedContact.contactName || selectedContact.contactPhone || selectedContact.contactEmail || 'Trusted contact'
              : 'Choose a contact above'}
          </Text>
          <Text style={styles.watchHeroMeta}>
            {activeWatchSession
              ? `Active until ${new Date(activeWatchSession.endsAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
            : 'This ends automatically after the time you choose.'}
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
        <MotionView delay={360} style={[styles.sectionCard, theme.shadow.card]}>
          <Text style={styles.sectionTitle}>
            {editingContactId ? 'Edit trusted contact' : 'Add trusted contact manually'}
          </Text>
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
            placeholder="Email"
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
            value={contactEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setContactEmail}
          />
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleTitle}>Allow live tracking</Text>
            <Text style={styles.toggleNote}>Turn this on if this person can see your route during an alert or watch session.</Text>
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
            {saving ? (
              <ActivityIndicator color={theme.colors.text} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {editingContactId ? 'Save changes' : 'Save Contact'}
              </Text>
            )}
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={resetContactForm}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </MotionView>
      ) : (
        <MotionView delay={360}>
          <Pressable style={[styles.primaryButton, theme.shadow.glow]} onPress={() => setShowForm(true)}>
            <Text style={styles.primaryButtonText}>Add contact manually</Text>
          </Pressable>
        </MotionView>
      )}

      {error ? (
        <MotionView delay={400}>
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
      borderRadius: 8,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 16,
    },
    searchInput: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
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
      borderRadius: 8,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 10,
    },
    sectionHeaderCopy: {
      flex: 1,
      minWidth: 0,
    },
    sectionTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 6,
    },
    compactTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 5,
    },
    compactMeta: {
      color: theme.colors.muted,
      fontSize: 12,
      lineHeight: 17,
    },
    sectionMeta: {
      color: theme.colors.muted,
      lineHeight: 18,
      marginBottom: 14,
    },
    discoveryBlock: {
      paddingTop: 14,
      marginTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    emptyText: {
      color: theme.colors.muted,
      lineHeight: 19,
    },
    contactCard: {
      padding: 14,
      borderRadius: 8,
      backgroundColor: theme.colors.backgroundElevated,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginTop: 10,
    },
    contactActionRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 12,
    },
    contactActionButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.blueGlow,
      backgroundColor: theme.colors.blueSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contactDangerButton: {
      borderColor: theme.colors.red,
      backgroundColor: theme.isDark ? 'rgba(255,94,120,0.16)' : '#FFE9ED',
    },
    contactActionText: {
      color: theme.colors.text,
      fontWeight: '700',
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
      borderRadius: 8,
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
      minWidth: 0,
    },
    contactName: {
      color: theme.colors.text,
      fontWeight: '700',
      marginBottom: 4,
      lineHeight: 20,
      flexShrink: 1,
    },
    contactMeta: {
      color: theme.colors.muted,
      fontSize: 12,
      marginTop: 2,
      lineHeight: 17,
      flexShrink: 1,
    },
    contactBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceStrong,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    contactBadgeText: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 15,
      textAlign: 'center',
    },
    inlineButton: {
      minWidth: 84,
      minHeight: 42,
      paddingHorizontal: 14,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.blueSoft,
      borderWidth: 1,
      borderColor: theme.colors.blueGlow,
    },
    inlineButtonWide: {
      minWidth: 92,
      minHeight: 54,
      paddingHorizontal: 14,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.blueSoft,
      borderWidth: 1,
      borderColor: theme.colors.blueGlow,
    },
    inlineButtonText: {
      color: theme.colors.text,
      fontWeight: '700',
    },
    directoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    directoryCopy: {
      flex: 1,
      minWidth: 0,
    },
    directoryTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
      flexWrap: 'wrap',
    },
    directoryName: {
      color: theme.colors.text,
      fontWeight: '700',
      lineHeight: 20,
      flexShrink: 1,
    },
    directoryMeta: {
      color: theme.colors.muted,
      fontSize: 12,
      marginTop: 2,
      lineHeight: 17,
      flexShrink: 1,
    },
    directoryNote: {
      color: theme.colors.blue,
      fontSize: 12,
      marginTop: 4,
      fontWeight: '700',
    },
    directoryButton: {
      minWidth: 74,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.blueSoft,
      borderWidth: 1,
      borderColor: theme.colors.blueGlow,
    },
    directoryButtonDisabled: {
      opacity: 0.72,
    },
    directoryButtonText: {
      color: theme.colors.text,
      fontWeight: '700',
    },
    discoveryBadge: {
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: 1,
    },
    discoveryBadgeActive: {
      backgroundColor: theme.colors.blueSoft,
      borderColor: theme.colors.blueGlow,
    },
    discoveryBadgeMuted: {
      backgroundColor: theme.colors.backgroundElevated,
      borderColor: theme.colors.border,
    },
    discoveryBadgeText: {
      color: theme.colors.text,
      fontSize: 10,
      fontWeight: '800',
    },
    emailSearchRow: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
      marginBottom: 10,
    },
    emailSearchInput: {
      flex: 1,
    },
    watchHero: {
      padding: 16,
      borderRadius: 8,
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
      borderRadius: 8,
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
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 13,
      color: theme.colors.text,
      backgroundColor: theme.colors.backgroundElevated,
      marginBottom: 12,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
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
      borderRadius: 8,
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
      borderRadius: 8,
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
      borderRadius: 8,
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
