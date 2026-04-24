import * as ExpoContacts from 'expo-contacts';
import { discoverSentinelContacts, type SentinelUserMatch } from './contacts';

export type DeviceContactCandidate = {
  id: string;
  name: string;
  primaryPhone?: string | null;
  primaryEmail?: string | null;
  phones: string[];
  emails: string[];
  hasSentinel: boolean;
  sentinelMatch?: SentinelUserMatch | null;
};

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

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function mapDeviceContact(contact: ExpoContacts.ExistingContact): DeviceContactCandidate | null {
  const phones = uniqueValues(
    (contact.phoneNumbers || []).map((entry) => normalizePhone(entry.number)),
  );
  const emails = uniqueValues(
    (contact.emails || []).map((entry) => normalizeEmail(entry.email)),
  );
  const name = contact.name?.trim() || [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();

  if (!name && phones.length === 0 && emails.length === 0) {
    return null;
  }

  return {
    id: contact.id,
    name: name || phones[0] || emails[0] || 'Unnamed contact',
    primaryPhone: phones[0] || null,
    primaryEmail: emails[0] || null,
    phones,
    emails,
    hasSentinel: false,
    sentinelMatch: null,
  };
}

export async function requestDeviceContactsPermission() {
  const existing = await ExpoContacts.getPermissionsAsync();
  if (existing.granted) {
    return existing;
  }

  return ExpoContacts.requestPermissionsAsync();
}

export async function loadDeviceContactsWithSentinelMatches() {
  const permission = await requestDeviceContactsPermission();
  if (!permission.granted) {
    throw new Error('Contacts permission is required.');
  }

  const response = await ExpoContacts.getContactsAsync({
    fields: [
      ExpoContacts.Fields.Name,
      ExpoContacts.Fields.FirstName,
      ExpoContacts.Fields.LastName,
      ExpoContacts.Fields.PhoneNumbers,
      ExpoContacts.Fields.Emails,
    ],
  });

  const deviceContacts = response.data
    .map(mapDeviceContact)
    .filter((contact): contact is DeviceContactCandidate => Boolean(contact));

  if (deviceContacts.length === 0) {
    return [];
  }

  const matches = await discoverSentinelContacts({
    emails: uniqueValues(deviceContacts.flatMap((contact) => contact.emails)),
    phones: uniqueValues(deviceContacts.flatMap((contact) => contact.phones)),
  });

  const emailMatchIndex = new Map<string, SentinelUserMatch>();
  const phoneMatchIndex = new Map<string, SentinelUserMatch>();

  matches.forEach((match) => {
    if (match.matchedEmail) {
      emailMatchIndex.set(normalizeEmail(match.matchedEmail), match);
    }
    if (match.matchedPhone) {
      phoneMatchIndex.set(normalizePhone(match.matchedPhone), match);
    }
  });

  return deviceContacts
    .map((contact) => {
      const sentinelMatch =
        contact.emails.map((email) => emailMatchIndex.get(normalizeEmail(email))).find(Boolean) ||
        contact.phones.map((phone) => phoneMatchIndex.get(normalizePhone(phone))).find(Boolean) ||
        null;

      return {
        ...contact,
        hasSentinel: Boolean(sentinelMatch),
        sentinelMatch,
      };
    })
    .sort((left, right) => {
      if (left.hasSentinel !== right.hasSentinel) {
        return left.hasSentinel ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
}
