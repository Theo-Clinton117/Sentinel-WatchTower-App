import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  Globe2,
  KeyRound,
  MapPinned,
  Navigation,
  Plus,
  RefreshCcw,
  Send,
  Shield,
  Users,
} from 'lucide-react-native';
import { EmptyState } from '../components/EmptyState';
import { FeedbackBanner } from '../components/FeedbackBanner';
import { MotionView } from '../components/MotionView';
import { SkeletonBlock } from '../components/Skeleton';
import {
  acceptOrganizationInvitation,
  createOrganizationInvitation,
  createOrganizationLocation,
  listMyOrganizations,
  listOrganizationMembers,
  previewOrganizationRouting,
  registerOrganization,
  type OrganizationInvitation,
  type OrganizationInvitationPayload,
  type OrganizationMember,
  type OrganizationMembersResponse,
  type OrganizationLocation,
  type OrganizationPermissionCode,
  type OrganizationRoutingPreviewResponse,
  type OrganizationWorkspace,
} from '../services/organizations';
import { getCurrentLocation } from '../services/location';
import { useAppTheme } from '../theme';

type NoticeTone = 'info' | 'success' | 'error' | 'warning';

type Notice = {
  tone: NoticeTone;
  title: string;
  message: string;
};

type RegistrationForm = {
  name: string;
  organizationType: string;
  officialEmail: string;
  officialPhone: string;
  physicalAddress: string;
  representativeName: string;
  intendedOperatingJurisdiction: string;
  registrationInfo: string;
  representativeContact: string;
  locationName: string;
  locationType: string;
  locationLat: string;
  locationLng: string;
  locationBoundaryGeojson: string;
};

type InviteForm = {
  inviteeEmail: string;
  inviteePhone: string;
  inviteeUserId: string;
  invitationChannel: string;
  expiresInDays: string;
};

type LocationForm = {
  name: string;
  locationType: string;
  centerLat: string;
  centerLng: string;
  boundaryGeojson: string;
};

type RoutingForm = {
  severity: 'low' | 'medium' | 'high' | 'critical';
  lat: string;
  lng: string;
  organizationId: string;
  title: string;
  locationAccuracyM: string;
};

const ORG_TYPE_OPTIONS = [
  'Community group',
  'Private company',
  'Public agency',
  'Nonprofit',
  'Security team',
];

const LOCATION_TYPE_OPTIONS = [
  'headquarters',
  'office',
  'branch',
  'warehouse',
  'field_team',
  'general',
];

const SEVERITY_OPTIONS: Array<RoutingForm['severity']> = ['low', 'medium', 'high', 'critical'];

function defaultRegistrationForm(): RegistrationForm {
  return {
    name: '',
    organizationType: 'Community group',
    officialEmail: '',
    officialPhone: '',
    physicalAddress: '',
    representativeName: '',
    intendedOperatingJurisdiction: '',
    registrationInfo: '',
    representativeContact: '',
    locationName: '',
    locationType: 'general',
    locationLat: '',
    locationLng: '',
    locationBoundaryGeojson: '',
  };
}

function defaultInviteForm(): InviteForm {
  return {
    inviteeEmail: '',
    inviteePhone: '',
    inviteeUserId: '',
    invitationChannel: 'email',
    expiresInDays: '14',
  };
}

function defaultLocationForm(): LocationForm {
  return {
    name: '',
    locationType: 'general',
    centerLat: '',
    centerLng: '',
    boundaryGeojson: '',
  };
}

function defaultRoutingForm(): RoutingForm {
  return {
    severity: 'medium',
    lat: '',
    lng: '',
    organizationId: '',
    title: '',
    locationAccuracyM: '',
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function parseJsonObject(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }

  return parsed as Record<string, unknown>;
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new Error('Enter a valid number.');
  }

  return parsed;
}

function buildPermissionList(permissions: Partial<Record<OrganizationPermissionCode, boolean>>) {
  return Object.entries(permissions)
    .filter(([, enabled]) => enabled)
    .map(([code]) => code.replaceAll('_', ' '))
    .sort();
}

const Badge = ({
  tone,
  children,
}: {
  tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  children: React.ReactNode;
}) => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const toneStyle =
    tone === 'success'
      ? styles.badgeSuccess
      : tone === 'warning'
        ? styles.badgeWarning
        : tone === 'danger'
          ? styles.badgeDanger
          : tone === 'info'
            ? styles.badgeInfo
            : styles.badgeNeutral;

  return (
    <View style={[styles.badge, toneStyle]}>
      <Text style={styles.badgeText}>{children}</Text>
    </View>
  );
};

export const OrganizationsScreen = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const queryClient = useQueryClient();
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [selectedOrganizationId, setSelectedOrganizationId] = React.useState<string>('');
  const [registrationForm, setRegistrationForm] = React.useState<RegistrationForm>(defaultRegistrationForm);
  const [inviteForm, setInviteForm] = React.useState<InviteForm>(defaultInviteForm);
  const [locationForm, setLocationForm] = React.useState<LocationForm>(defaultLocationForm);
  const [routingForm, setRoutingForm] = React.useState<RoutingForm>(defaultRoutingForm);
  const [acceptToken, setAcceptToken] = React.useState('');
  const [activeSection, setActiveSection] = React.useState<'overview' | 'manage' | 'register' | 'routing'>('overview');

  const organizationsQuery = useQuery<OrganizationWorkspace[]>({
    queryKey: ['organizations'],
    queryFn: listMyOrganizations,
  });
  const organizations = (organizationsQuery.data ?? []) as OrganizationWorkspace[];

  React.useEffect(() => {
    const firstOrganization = organizations[0]?.organization.id;
    if (!selectedOrganizationId && firstOrganization) {
      setSelectedOrganizationId(firstOrganization);
      setRoutingForm((current) => ({ ...current, organizationId: firstOrganization }));
      return;
    }

    if (
      selectedOrganizationId &&
      organizations.length > 0 &&
      !organizations.some((workspace) => workspace.organization.id === selectedOrganizationId)
    ) {
      setSelectedOrganizationId(firstOrganization || '');
      setRoutingForm((current) => ({
        ...current,
        organizationId: firstOrganization || '',
      }));
    }
  }, [organizations, selectedOrganizationId]);

  const selectedWorkspace = React.useMemo(
    () =>
      organizations.find((workspace) => workspace.organization.id === selectedOrganizationId) ||
      organizations[0] ||
      null,
    [organizations, selectedOrganizationId],
  );

  React.useEffect(() => {
    if (selectedWorkspace?.organization.id) {
      setRoutingForm((current) => ({
        ...current,
        organizationId: selectedWorkspace.organization.id,
      }));
    }
  }, [selectedWorkspace?.organization.id]);

  const membersQuery = useQuery<OrganizationMembersResponse>({
    queryKey: ['organization-members', selectedWorkspace?.organization.id],
    queryFn: () => listOrganizationMembers(selectedWorkspace!.organization.id),
    enabled: Boolean(
      selectedWorkspace?.organization.id &&
        selectedWorkspace.membership.permissions.manage_members,
    ),
  });

  const registerMutation = useMutation({
    mutationFn: registerOrganization,
    onSuccess: async (result: Awaited<ReturnType<typeof registerOrganization>>) => {
      setNotice({
        tone: 'success',
        title: 'Organization registered',
        message: `${result.organization.name} is now in your account.`,
      });
      setSelectedOrganizationId(result.organization.id);
      setRegistrationForm(defaultRegistrationForm());
      setLocationForm(defaultLocationForm());
      setRoutingForm((current) => ({
        ...current,
        organizationId: result.organization.id,
      }));
      await queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
    onError: (error: unknown) => {
      setNotice({
        tone: 'error',
        title: 'Registration failed',
        message: getErrorMessage(error),
      });
    },
  });

  const acceptInvitationMutation = useMutation({
    mutationFn: acceptOrganizationInvitation,
    onSuccess: async (result: Awaited<ReturnType<typeof acceptOrganizationInvitation>>) => {
      setNotice({
        tone: 'success',
        title: 'Invitation accepted',
        message: `${result.organization.organization.name} is now available here.`,
      });
      setAcceptToken('');
      setSelectedOrganizationId(result.organization.organization.id);
      await queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
    onError: (error: unknown) => {
      setNotice({
        tone: 'error',
        title: 'Invitation not accepted',
        message: getErrorMessage(error),
      });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (payload: { organizationId: string; invitation: OrganizationInvitationPayload }) =>
      createOrganizationInvitation(payload.organizationId, payload.invitation),
    onSuccess: async (result: Awaited<ReturnType<typeof createOrganizationInvitation>>) => {
      setNotice({
        tone: 'success',
        title: 'Invitation created',
        message: result.invitation.inviteToken
          ? `Token: ${result.invitation.inviteToken}`
          : 'The invitation is ready to send.',
      });
      setInviteForm(defaultInviteForm());
      await queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
    onError: (error: unknown) => {
      setNotice({
        tone: 'error',
        title: 'Invitation failed',
        message: getErrorMessage(error),
      });
    },
  });

  const locationMutation = useMutation({
    mutationFn: async (payload: { organizationId: string; location: Parameters<typeof createOrganizationLocation>[1] }) =>
      createOrganizationLocation(payload.organizationId, payload.location),
    onSuccess: async () => {
      setNotice({
        tone: 'success',
        title: 'Location saved',
        message: 'The organization location is now available for routing.',
      });
      setLocationForm(defaultLocationForm());
      await queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
    onError: (error: unknown) => {
      setNotice({
        tone: 'error',
        title: 'Location not saved',
        message: getErrorMessage(error),
      });
    },
  });

  const routingMutation = useMutation({
    mutationFn: previewOrganizationRouting,
    onSuccess: (result: Awaited<ReturnType<typeof previewOrganizationRouting>>) => {
      setNotice({
        tone: 'info',
        title: 'Routing preview ready',
        message: result.bestMatch
          ? `${result.bestMatch.name} scored ${result.bestMatch.priorityScore.toFixed(2)}.`
          : 'No organization match was strong enough for this point.',
      });
    },
    onError: (error: unknown) => {
      setNotice({
        tone: 'error',
        title: 'Preview failed',
        message: getErrorMessage(error),
      });
    },
  });

  const selectedMembers = React.useMemo(
    () => ((membersQuery.data?.members ?? []) as OrganizationMember[]),
    [membersQuery.data],
  );
  const preview = routingMutation.data as OrganizationRoutingPreviewResponse | undefined;

  const handleRegister = () => {
    try {
      registerMutation.mutate({
        name: registrationForm.name.trim(),
        organizationType: registrationForm.organizationType.trim(),
        officialEmail: registrationForm.officialEmail.trim(),
        officialPhone: registrationForm.officialPhone.trim(),
        physicalAddress: registrationForm.physicalAddress.trim(),
        representativeName: registrationForm.representativeName.trim(),
        intendedOperatingJurisdiction: registrationForm.intendedOperatingJurisdiction.trim(),
        registrationInfo: parseJsonObject(registrationForm.registrationInfo, 'Registration info'),
        representativeContact: parseJsonObject(
          registrationForm.representativeContact,
          'Representative contact',
        ),
        registeredLocations: registrationForm.locationName.trim()
          ? [
              {
                name: registrationForm.locationName.trim(),
                locationType: registrationForm.locationType.trim() || 'general',
                centerLat: parseOptionalNumber(registrationForm.locationLat),
                centerLng: parseOptionalNumber(registrationForm.locationLng),
                boundaryGeojson: parseJsonObject(
                  registrationForm.locationBoundaryGeojson,
                  'Location boundary',
                ),
              },
            ]
          : undefined,
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        title: 'Registration form is incomplete',
        message: getErrorMessage(error),
      });
    }
  };

  const handleInvite = () => {
    const organizationId = selectedWorkspace?.organization.id;
    if (!organizationId) {
      setNotice({
        tone: 'warning',
        title: 'Pick an organization first',
        message: 'Select an organization before creating an invitation.',
      });
      return;
    }

    const inviteeEmail = inviteForm.inviteeEmail.trim();
    const inviteePhone = inviteForm.inviteePhone.trim();
    const inviteeUserId = inviteForm.inviteeUserId.trim();
    if (!inviteeEmail && !inviteePhone && !inviteeUserId) {
      setNotice({
        tone: 'warning',
        title: 'Invitation needs a recipient',
        message: 'Enter an email, phone number, or user id.',
      });
      return;
    }

    inviteMutation.mutate({
      organizationId,
      invitation: {
        inviteeEmail: inviteeEmail || undefined,
        inviteePhone: inviteePhone || undefined,
        inviteeUserId: inviteeUserId || undefined,
        invitationChannel: inviteForm.invitationChannel.trim() || undefined,
        expiresInDays: Number(inviteForm.expiresInDays) || 14,
      },
    });
  };

  const handleAddLocation = () => {
    const organizationId = selectedWorkspace?.organization.id;
    if (!organizationId) {
      setNotice({
        tone: 'warning',
        title: 'Pick an organization first',
        message: 'Select an organization before adding a location.',
      });
      return;
    }

    try {
      const name = locationForm.name.trim();
      if (!name) {
        throw new Error('Location name is required.');
      }

      locationMutation.mutate({
        organizationId,
        location: {
          name,
          locationType: locationForm.locationType.trim() || 'general',
          centerLat: parseOptionalNumber(locationForm.centerLat),
          centerLng: parseOptionalNumber(locationForm.centerLng),
          boundaryGeojson: parseJsonObject(locationForm.boundaryGeojson, 'Location boundary'),
          active: true,
        },
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        title: 'Location form is incomplete',
        message: getErrorMessage(error),
      });
    }
  };

  const handleUseCurrentLocation = async () => {
    try {
      const location = await getCurrentLocation();
      setLocationForm((current) => ({
        ...current,
        centerLat: location.lat.toFixed(6),
        centerLng: location.lng.toFixed(6),
      }));
      setNotice({
        tone: 'success',
        title: 'Current location captured',
        message: 'The GPS fix is precise enough for organization location setup.',
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        title: 'Could not read location',
        message: getErrorMessage(error),
      });
    }
  };

  const handlePreviewRouting = () => {
    try {
      const lat = Number(routingForm.lat);
      const lng = Number(routingForm.lng);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        throw new Error('Latitude must be between -90 and 90.');
      }
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        throw new Error('Longitude must be between -180 and 180.');
      }

      routingMutation.mutate({
        severity: routingForm.severity,
        lat,
        lng,
        organizationId: routingForm.organizationId.trim() || undefined,
        title: routingForm.title.trim() || undefined,
        locationAccuracyM: routingForm.locationAccuracyM.trim()
          ? Number(routingForm.locationAccuracyM)
          : undefined,
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        title: 'Preview form is invalid',
        message: getErrorMessage(error),
      });
    }
  };

  const selectedLocations = selectedWorkspace?.locations || [];
  const selectedJurisdictions = selectedWorkspace?.jurisdictions || [];
  const selectedInvitations = selectedWorkspace?.invitations || [];
  const activePermissions = selectedWorkspace
    ? buildPermissionList(selectedWorkspace.permissions)
    : [];

  const queryError = organizationsQuery.error || membersQuery.error;
  const queryErrorMessage = queryError ? getErrorMessage(queryError) : null;
  const selectedWorkspaceLabel =
    selectedWorkspace?.organization.name ||
    selectedWorkspace?.organization.organizationType ||
    'No organization selected';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <MotionView delay={40}>
        <Text style={styles.title}>Organizations</Text>
        <Text style={styles.subtitle}>
          Manage organizations, memberships, locations, and routing.
        </Text>
        <View style={styles.sectionTabs}>
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'manage', label: 'Manage' },
            { key: 'register', label: 'Register' },
            { key: 'routing', label: 'Routing' },
          ].map((item) => {
            const active = activeSection === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setActiveSection(item.key as typeof activeSection)}
                style={[styles.sectionTab, active && styles.sectionTabActive]}
              >
                <Text style={[styles.sectionTabText, active && styles.sectionTabTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </MotionView>

      <MotionView delay={70} style={[styles.heroStrip, theme.shadow.card]}>
        <View style={styles.heroStripTop}>
          <View style={styles.heroStripCopy}>
            <Text style={styles.heroEyebrow}>Workspace</Text>
            <Text style={styles.heroTitle}>{selectedWorkspaceLabel}</Text>
          </View>
          <View style={styles.heroCountPill}>
            <Text style={styles.heroCountValue}>{organizations.length}</Text>
            <Text style={styles.heroCountLabel}>orgs</Text>
          </View>
        </View>
        <View style={styles.heroMetricRow}>
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricValue}>{selectedLocations.length}</Text>
            <Text style={styles.heroMetricLabel}>Locations</Text>
          </View>
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricValue}>{selectedInvitations.length}</Text>
            <Text style={styles.heroMetricLabel}>Invites</Text>
          </View>
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricValue}>{selectedJurisdictions.length}</Text>
            <Text style={styles.heroMetricLabel}>Jurisdictions</Text>
          </View>
        </View>
      </MotionView>

      {notice ? (
        <MotionView delay={80}>
          <FeedbackBanner tone={notice.tone} title={notice.title} message={notice.message} />
        </MotionView>
      ) : null}

      {queryErrorMessage ? (
        <MotionView delay={90}>
          <FeedbackBanner tone="error" title="Data could not load" message={queryErrorMessage} />
        </MotionView>
      ) : null}

      <MotionView delay={120} style={[styles.card, theme.shadow.card]}>
        <View style={styles.cardHeader}>
          <View style={styles.headerIcon}>
            <Building2 size={20} color={theme.colors.blue} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.cardTitle}>Your organizations</Text>
          </View>
        </View>

        {organizations.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No organizations yet"
            message="Register the first organization or accept an invitation to get started."
          />
        ) : (
          <View style={styles.orgList}>
            {organizations.map((workspace) => {
              const active = workspace.organization.id === selectedWorkspace?.organization.id;

              return (
                <Pressable
                  key={workspace.organization.id}
                  onPress={() => setSelectedOrganizationId(workspace.organization.id)}
                  style={({ pressed }) => [
                    styles.orgRow,
                    active && styles.orgRowActive,
                    pressed && styles.orgRowPressed,
                  ]}
                >
                  <View style={styles.orgRowTop}>
                    <Text style={styles.orgName}>{workspace.organization.name}</Text>
                    {active ? <CheckCircle2 size={16} color={theme.colors.blue} /> : null}
                  </View>
                  <Text style={styles.orgMeta}>
                    {workspace.organization.organizationType} - {workspace.organization.status}
                  </Text>
                  <View style={styles.orgBadges}>
                    <Badge tone="neutral">{workspace.membership.roleCode}</Badge>
                    <Badge tone={workspace.organization.status === 'VERIFIED' ? 'success' : 'warning'}>
                      {workspace.organization.status}
                    </Badge>
                    <Badge tone="neutral">{workspace.locations.length} locations</Badge>
                    <Badge tone="neutral">{workspace.invitations.length} invitations</Badge>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </MotionView>

      <MotionView
        delay={180}
        style={[
          styles.card,
          theme.shadow.card,
          ...(activeSection !== 'register' ? [styles.sectionHidden] : []),
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.headerIcon}>
            <Plus size={20} color={theme.colors.blue} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.cardTitle}>Register organization</Text>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Organization type</Text>
          <View style={styles.chipRow}>
            {ORG_TYPE_OPTIONS.map((option) => {
              const active =
                registrationForm.organizationType.trim().toLowerCase() === option.toLowerCase();

              return (
                <Pressable
                  key={option}
                  onPress={() => setRegistrationForm((current) => ({ ...current, organizationType: option }))}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.fieldGrid}>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}>Organization name</Text>
            <TextInput
              value={registrationForm.name}
              onChangeText={(value) => setRegistrationForm((current) => ({ ...current, name: value }))}
              placeholder="Sentinel Security Group"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />
          </View>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}>Official email</Text>
            <TextInput
              value={registrationForm.officialEmail}
              onChangeText={(value) =>
                setRegistrationForm((current) => ({ ...current, officialEmail: value }))
              }
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="ops@example.com"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.fieldGrid}>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}>Official phone</Text>
            <TextInput
              value={registrationForm.officialPhone}
              onChangeText={(value) =>
                setRegistrationForm((current) => ({ ...current, officialPhone: value }))
              }
              keyboardType="phone-pad"
              placeholder="+234..."
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />
          </View>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}>Representative name</Text>
            <TextInput
              value={registrationForm.representativeName}
              onChangeText={(value) =>
                setRegistrationForm((current) => ({ ...current, representativeName: value }))
              }
              placeholder="Authorized signer"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Physical address</Text>
          <TextInput
            value={registrationForm.physicalAddress}
            onChangeText={(value) =>
              setRegistrationForm((current) => ({ ...current, physicalAddress: value }))
            }
            placeholder="Street address and city"
            placeholderTextColor={theme.colors.muted}
            multiline
            style={[styles.input, styles.textArea]}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Intended operating jurisdiction</Text>
          <TextInput
            value={registrationForm.intendedOperatingJurisdiction}
            onChangeText={(value) =>
              setRegistrationForm((current) => ({
                ...current,
                intendedOperatingJurisdiction: value,
              }))
            }
            placeholder="State, province, or country"
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
          />
        </View>

        <View style={styles.fieldGrid}>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}>Registration info JSON</Text>
            <TextInput
              value={registrationForm.registrationInfo}
              onChangeText={(value) =>
                setRegistrationForm((current) => ({ ...current, registrationInfo: value }))
              }
              placeholder='{"registrationNumber":"..."}'
              placeholderTextColor={theme.colors.muted}
              multiline
              style={[styles.input, styles.textAreaTall]}
            />
          </View>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}>Representative contact JSON</Text>
            <TextInput
              value={registrationForm.representativeContact}
              onChangeText={(value) =>
                setRegistrationForm((current) => ({ ...current, representativeContact: value }))
              }
              placeholder='{"name":"...","phone":"..."}'
              placeholderTextColor={theme.colors.muted}
              multiline
              style={[styles.input, styles.textAreaTall]}
            />
          </View>
        </View>

        <View style={styles.subSection}>
          <Text style={styles.subSectionTitle}>Initial location</Text>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Location name</Text>
            <TextInput
              value={registrationForm.locationName}
              onChangeText={(value) =>
                setRegistrationForm((current) => ({ ...current, locationName: value }))
              }
              placeholder="Headquarters"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Location type</Text>
            <View style={styles.chipRow}>
              {LOCATION_TYPE_OPTIONS.map((option) => {
                const active = registrationForm.locationType === option;

                return (
                  <Pressable
                    key={option}
                    onPress={() =>
                      setRegistrationForm((current) => ({ ...current, locationType: option }))
                    }
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.fieldGrid}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Latitude</Text>
              <TextInput
                value={registrationForm.locationLat}
                onChangeText={(value) =>
                  setRegistrationForm((current) => ({ ...current, locationLat: value }))
                }
                keyboardType="decimal-pad"
                placeholder="6.5244"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Longitude</Text>
              <TextInput
                value={registrationForm.locationLng}
                onChangeText={(value) =>
                  setRegistrationForm((current) => ({ ...current, locationLng: value }))
                }
                keyboardType="decimal-pad"
                placeholder="3.3792"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
              />
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Boundary GeoJSON</Text>
            <TextInput
              value={registrationForm.locationBoundaryGeojson}
              onChangeText={(value) =>
                setRegistrationForm((current) => ({ ...current, locationBoundaryGeojson: value }))
              }
              placeholder='{"type":"Polygon","coordinates":[...]}'
              placeholderTextColor={theme.colors.muted}
              multiline
              style={[styles.input, styles.textAreaTall]}
            />
          </View>
        </View>

        <Pressable
          onPress={handleRegister}
          disabled={registerMutation.isPending}
          style={({ pressed }) => [
            styles.primaryAction,
            pressed && styles.primaryActionPressed,
            registerMutation.isPending && styles.actionDisabled,
          ]}
        >
          <Send size={16} color={theme.colors.text} />
          <Text style={styles.primaryActionText}>
            {registerMutation.isPending ? 'Registering...' : 'Create organization'}
          </Text>
        </Pressable>
      </MotionView>

      <MotionView
        delay={240}
        style={[
          styles.card,
          theme.shadow.card,
          ...(activeSection !== 'register' ? [styles.sectionHidden] : []),
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.headerIcon}>
            <KeyRound size={20} color={theme.colors.blue} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.cardTitle}>Accept invitation</Text>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Invitation token</Text>
          <TextInput
            value={acceptToken}
            onChangeText={setAcceptToken}
            placeholder="Paste invite token here"
            placeholderTextColor={theme.colors.muted}
            autoCapitalize="none"
            style={styles.input}
          />
        </View>

        <Pressable
          onPress={() => acceptToken.trim() && acceptInvitationMutation.mutate(acceptToken.trim())}
          disabled={acceptInvitationMutation.isPending}
          style={({ pressed }) => [
            styles.secondaryAction,
            pressed && styles.secondaryActionPressed,
            acceptInvitationMutation.isPending && styles.actionDisabled,
          ]}
        >
          <ClipboardList size={16} color={theme.colors.text} />
          <Text style={styles.secondaryActionText}>
            {acceptInvitationMutation.isPending ? 'Accepting...' : 'Accept invitation'}
          </Text>
        </Pressable>
      </MotionView>

      {selectedWorkspace ? (
        <MotionView
          delay={280}
          style={[
            styles.card,
            theme.shadow.card,
            ...((activeSection === 'register' || activeSection === 'routing')
              ? [styles.sectionHidden]
              : []),
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.headerIcon}>
              <Shield size={20} color={theme.colors.blue} />
            </View>
          <View style={styles.headerCopy}>
            <Text style={styles.cardTitle}>{selectedWorkspace.organization.name}</Text>
          </View>
        </View>

          <View style={styles.badgeRow}>
            <Badge tone="neutral">{selectedWorkspace.membership.roleCode}</Badge>
            <Badge tone={selectedWorkspace.organization.status === 'VERIFIED' ? 'success' : 'warning'}>
              {selectedWorkspace.organization.status}
            </Badge>
            <Badge tone="info">{selectedLocations.length} locations</Badge>
            <Badge tone="info">{selectedJurisdictions.length} jurisdictions</Badge>
          </View>

          <View style={styles.detailsGrid}>
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Official email</Text>
              <Text style={styles.detailValue}>{selectedWorkspace.organization.officialEmail || 'Not set'}</Text>
            </View>
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Official phone</Text>
              <Text style={styles.detailValue}>{selectedWorkspace.organization.officialPhone || 'Not set'}</Text>
            </View>
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Jurisdiction</Text>
              <Text style={styles.detailValue}>
                {selectedWorkspace.organization.intendedOperatingJurisdiction || 'Not set'}
              </Text>
            </View>
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Active permissions</Text>
              <Text style={styles.detailValue}>
                {activePermissions.length > 0 ? activePermissions.join(', ') : 'None reported'}
              </Text>
            </View>
          </View>
        </MotionView>
      ) : null}

      <MotionView
        delay={320}
        style={[
          styles.card,
          theme.shadow.card,
          ...((activeSection === 'register' || activeSection === 'routing')
            ? [styles.sectionHidden]
            : []),
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.headerIcon}>
            <Users size={20} color={theme.colors.blue} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.cardTitle}>Members</Text>
          </View>
        </View>

        {!selectedWorkspace ? (
          <EmptyState
            icon={Users}
            title="No organization selected"
            message="Select an organization above to inspect the member list."
          />
        ) : selectedWorkspace.membership.permissions.manage_members ? (
          membersQuery.isLoading ? (
            <View style={styles.loadingRow}>
              <SkeletonBlock width="42%" height={12} />
              <SkeletonBlock height={54} />
              <SkeletonBlock height={54} />
            </View>
          ) : selectedMembers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No members yet"
              message="This organization does not have any other members loaded yet."
            />
          ) : (
            <View style={styles.memberList}>
              {selectedMembers.map((member) => (
                <View key={member.id} style={styles.memberRow}>
                  <View style={styles.memberLeft}>
                    <Text style={styles.memberName}>{member.name || member.email || member.phone || member.userId}</Text>
                    <Text style={styles.memberMeta}>
                      {member.roleCode} - {member.status}
                    </Text>
                  </View>
                  <Badge tone={member.status === 'ACTIVE' ? 'success' : 'warning'}>{member.status}</Badge>
                </View>
              ))}
            </View>
          )
        ) : (
          <FeedbackBanner
            tone="warning"
            title="Members are restricted"
            message="Your current role cannot load the member list for this organization."
          />
        )}
      </MotionView>

      <MotionView
        delay={360}
        style={[
          styles.card,
          theme.shadow.card,
          ...((activeSection === 'register' || activeSection === 'routing')
            ? [styles.sectionHidden]
            : []),
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.headerIcon}>
            <Send size={20} color={theme.colors.blue} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.cardTitle}>Invite member</Text>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Recipient channel</Text>
          <View style={styles.chipRow}>
            {['email', 'sms', 'app'].map((channel) => {
              const active = inviteForm.invitationChannel === channel;

              return (
                <Pressable
                  key={channel}
                  onPress={() => setInviteForm((current) => ({ ...current, invitationChannel: channel }))}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {channel.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.fieldGrid}>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              value={inviteForm.inviteeEmail}
              onChangeText={(value) => setInviteForm((current) => ({ ...current, inviteeEmail: value }))}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="invitee@example.com"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />
          </View>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}>Phone</Text>
            <TextInput
              value={inviteForm.inviteePhone}
              onChangeText={(value) => setInviteForm((current) => ({ ...current, inviteePhone: value }))}
              keyboardType="phone-pad"
              placeholder="+234..."
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.fieldGrid}>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}>User id</Text>
            <TextInput
              value={inviteForm.inviteeUserId}
              onChangeText={(value) => setInviteForm((current) => ({ ...current, inviteeUserId: value }))}
              autoCapitalize="none"
              placeholder="Optional user id"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />
          </View>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}>Expires in days</Text>
            <TextInput
              value={inviteForm.expiresInDays}
              onChangeText={(value) => setInviteForm((current) => ({ ...current, expiresInDays: value }))}
              keyboardType="number-pad"
              placeholder="14"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />
          </View>
        </View>

        <Pressable
          onPress={handleInvite}
          disabled={inviteMutation.isPending}
          style={({ pressed }) => [
            styles.secondaryAction,
            pressed && styles.secondaryActionPressed,
            inviteMutation.isPending && styles.actionDisabled,
          ]}
        >
          <Send size={16} color={theme.colors.text} />
          <Text style={styles.secondaryActionText}>
            {inviteMutation.isPending ? 'Creating...' : 'Create invitation'}
          </Text>
        </Pressable>
      </MotionView>

      <MotionView
        delay={400}
        style={[
          styles.card,
          theme.shadow.card,
          ...((activeSection === 'register' || activeSection === 'routing')
            ? [styles.sectionHidden]
            : []),
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.headerIcon}>
            <MapPinned size={20} color={theme.colors.blue} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.cardTitle}>Locations</Text>
          </View>
        </View>

        {selectedLocations.length > 0 ? (
          <View style={styles.locationList}>
            {selectedLocations.map((location: OrganizationLocation) => (
              <View key={location.id} style={styles.locationRow}>
                <View style={styles.memberLeft}>
                  <Text style={styles.memberName}>{location.name}</Text>
                  <Text style={styles.memberMeta}>
                    {location.locationType} - {location.active ? 'active' : 'inactive'}
                  </Text>
                </View>
                <Text style={styles.locationCoords}>
                  {location.centerLat != null && location.centerLng != null
                    ? `${location.centerLat.toFixed(5)}, ${location.centerLng.toFixed(5)}`
                    : 'No center set'}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            icon={MapPinned}
            title="No locations saved"
            message="Add a precise location to improve routing and jurisdiction checks."
          />
        )}

        <View style={styles.subSection}>
          <Text style={styles.subSectionTitle}>Add location</Text>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              value={locationForm.name}
              onChangeText={(value) => setLocationForm((current) => ({ ...current, name: value }))}
              placeholder="Operations hub"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.chipRow}>
              {LOCATION_TYPE_OPTIONS.map((option) => {
                const active = locationForm.locationType === option;

                return (
                  <Pressable
                    key={option}
                    onPress={() => setLocationForm((current) => ({ ...current, locationType: option }))}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.fieldGrid}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Latitude</Text>
              <TextInput
                value={locationForm.centerLat}
                onChangeText={(value) => setLocationForm((current) => ({ ...current, centerLat: value }))}
                keyboardType="decimal-pad"
                placeholder="6.5244"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Longitude</Text>
              <TextInput
                value={locationForm.centerLng}
                onChangeText={(value) => setLocationForm((current) => ({ ...current, centerLng: value }))}
                keyboardType="decimal-pad"
                placeholder="3.3792"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
              />
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Boundary GeoJSON</Text>
            <TextInput
              value={locationForm.boundaryGeojson}
              onChangeText={(value) =>
                setLocationForm((current) => ({ ...current, boundaryGeojson: value }))
              }
              placeholder='{"type":"Polygon","coordinates":[...]}'
              placeholderTextColor={theme.colors.muted}
              multiline
              style={[styles.input, styles.textAreaTall]}
            />
          </View>
          <Pressable onPress={handleUseCurrentLocation} style={styles.inlineAction}>
            <Navigation size={16} color={theme.colors.text} />
            <Text style={styles.inlineActionText}>Use current GPS fix</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={handleAddLocation}
          disabled={locationMutation.isPending}
          style={({ pressed }) => [
            styles.primaryAction,
            pressed && styles.primaryActionPressed,
            locationMutation.isPending && styles.actionDisabled,
          ]}
        >
          <Plus size={16} color={theme.colors.text} />
          <Text style={styles.primaryActionText}>
            {locationMutation.isPending ? 'Saving...' : 'Save location'}
          </Text>
        </Pressable>
      </MotionView>

      <MotionView
        delay={440}
        style={[
          styles.card,
          theme.shadow.card,
          ...(activeSection !== 'routing' ? [styles.sectionHidden] : []),
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.headerIcon}>
            <Globe2 size={20} color={theme.colors.blue} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.cardTitle}>Routing preview</Text>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Severity</Text>
          <View style={styles.chipRow}>
            {SEVERITY_OPTIONS.map((severity) => {
              const active = routingForm.severity === severity;
              return (
                <Pressable
                  key={severity}
                  onPress={() => setRoutingForm((current) => ({ ...current, severity }))}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{severity}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.fieldGrid}>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}>Latitude</Text>
            <TextInput
              value={routingForm.lat}
              onChangeText={(value) => setRoutingForm((current) => ({ ...current, lat: value }))}
              keyboardType="decimal-pad"
              placeholder="6.5244"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />
          </View>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}>Longitude</Text>
            <TextInput
              value={routingForm.lng}
              onChangeText={(value) => setRoutingForm((current) => ({ ...current, lng: value }))}
              keyboardType="decimal-pad"
              placeholder="3.3792"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.fieldGrid}>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}>Organization id</Text>
            <TextInput
              value={routingForm.organizationId}
              onChangeText={(value) => setRoutingForm((current) => ({ ...current, organizationId: value }))}
              autoCapitalize="none"
              placeholder="Optional"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />
          </View>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}>Location accuracy M</Text>
            <TextInput
              value={routingForm.locationAccuracyM}
              onChangeText={(value) =>
                setRoutingForm((current) => ({ ...current, locationAccuracyM: value }))
              }
              keyboardType="decimal-pad"
              placeholder="25"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput
            value={routingForm.title}
            onChangeText={(value) => setRoutingForm((current) => ({ ...current, title: value }))}
            placeholder="Optional alert title"
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
          />
        </View>

        <Pressable
          onPress={handlePreviewRouting}
          disabled={routingMutation.isPending}
          style={({ pressed }) => [
            styles.secondaryAction,
            pressed && styles.secondaryActionPressed,
            routingMutation.isPending && styles.actionDisabled,
          ]}
        >
          <RefreshCcw size={16} color={theme.colors.text} />
          <Text style={styles.secondaryActionText}>
            {routingMutation.isPending ? 'Previewing...' : 'Run preview'}
          </Text>
        </Pressable>

        {preview ? (
          <View style={styles.previewWrap}>
            <Text style={styles.previewTitle}>Preview result</Text>
            <Text style={styles.previewMeta}>
              Dedupe key: {preview.dedupeKey}
            </Text>
            {preview.bestMatch ? (
              <View style={styles.previewMatch}>
                <Text style={styles.previewMatchName}>{preview.bestMatch.name}</Text>
                <Text style={styles.previewMatchMeta}>
                  Score {preview.bestMatch.priorityScore.toFixed(2)} - {preview.bestMatch.roleCode}
                </Text>
                <Text style={styles.previewMatchMeta}>
                  {preview.bestMatch.membershipStatus} - {preview.bestMatch.organizationStatus}
                </Text>
              </View>
            ) : (
              <FeedbackBanner
                tone="warning"
                title="No strong match"
                message="The point did not resolve cleanly to a single organization."
              />
            )}

            {preview.organizations.length > 0 ? (
              <View style={styles.previewList}>
                {preview.organizations.map((organization) => (
                  <View key={organization.organizationId} style={styles.previewRow}>
                    <View style={styles.memberLeft}>
                      <Text style={styles.memberName}>{organization.name}</Text>
                      <Text style={styles.memberMeta}>
                        {organization.roleCode} - {organization.membershipStatus}
                      </Text>
                    </View>
                    <Text style={styles.locationCoords}>{organization.priorityScore.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </MotionView>
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
      paddingHorizontal: 20,
      paddingTop: 28,
      paddingBottom: 132,
    },
    title: {
      color: theme.colors.text,
      fontSize: 28,
      fontWeight: '800',
      marginBottom: 8,
    },
    subtitle: {
      color: theme.colors.muted,
      lineHeight: 20,
      marginBottom: 16,
    },
    sectionTabs: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
      marginBottom: 14,
    },
    sectionTab: {
      minHeight: 36,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,21,38,0.06)',
      backgroundColor: theme.colors.backgroundElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTabActive: {
      backgroundColor: theme.colors.blueSoft,
      borderColor: theme.colors.blue,
    },
    sectionTabText: {
      color: theme.colors.muted,
      fontSize: 12,
      fontWeight: '800',
    },
    sectionTabTextActive: {
      color: theme.colors.text,
    },
    heroStrip: {
      padding: 16,
      borderRadius: 28,
      backgroundColor: theme.isDark ? 'rgba(10,20,35,0.9)' : 'rgba(255,255,255,0.95)',
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,21,38,0.06)',
      marginBottom: 14,
    },
    heroStripTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 12,
    },
    heroStripCopy: {
      flex: 1,
      minWidth: 0,
    },
    heroEyebrow: {
      color: theme.colors.blue,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    heroTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
      lineHeight: 24,
    },
    heroCountPill: {
      minWidth: 54,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 18,
      backgroundColor: theme.colors.blueSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroCountValue: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '900',
      lineHeight: 18,
    },
    heroCountLabel: {
      color: theme.colors.muted,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    heroMetricRow: {
      flexDirection: 'row',
      gap: 10,
    },
    heroMetric: {
      flex: 1,
      minHeight: 54,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,21,38,0.06)',
      backgroundColor: theme.colors.backgroundElevated,
      paddingHorizontal: 12,
      paddingVertical: 10,
      justifyContent: 'center',
    },
    heroMetricValue: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '900',
    },
    heroMetricLabel: {
      color: theme.colors.muted,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: 2,
    },
    sectionHidden: {
      display: 'none',
    },
    card: {
      padding: 16,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,21,38,0.06)',
      backgroundColor: theme.colors.backgroundElevated,
      marginBottom: 14,
    },
    cardHeader: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 14,
    },
    headerIcon: {
      width: 36,
      height: 36,
      borderRadius: 14,
      backgroundColor: theme.colors.blueSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
    },
    cardTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 4,
    },
    cardSubtitle: {
      color: theme.colors.muted,
      lineHeight: 18,
      fontSize: 12,
    },
    orgList: {
      gap: 10,
    },
    orgRow: {
      padding: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,21,38,0.06)',
      backgroundColor: theme.colors.backgroundElevated,
    },
    orgRowActive: {
      borderColor: theme.colors.blueGlow,
      backgroundColor: theme.colors.blueSoft,
    },
    orgRowPressed: {
      opacity: 0.92,
    },
    orgRowTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 4,
    },
    orgName: {
      color: theme.colors.text,
      fontWeight: '800',
      flex: 1,
      minWidth: 0,
    },
    orgMeta: {
      color: theme.colors.muted,
      fontSize: 12,
      lineHeight: 17,
      marginBottom: 10,
    },
    orgBadges: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    field: {
      marginBottom: 12,
    },
    fieldGrid: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12,
    },
    fieldHalf: {
      flex: 1,
      minWidth: 0,
    },
    fieldLabel: {
      color: theme.colors.muted,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 6,
    },
    input: {
      minHeight: 44,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElevated,
      color: theme.colors.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    textArea: {
      minHeight: 72,
      textAlignVertical: 'top',
    },
    textAreaTall: {
      minHeight: 96,
      textAlignVertical: 'top',
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      minHeight: 34,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipActive: {
      backgroundColor: theme.colors.blueSoft,
      borderColor: theme.colors.blueGlow,
    },
    chipText: {
      color: theme.colors.muted,
      fontSize: 12,
      fontWeight: '800',
    },
    chipTextActive: {
      color: theme.colors.text,
    },
    subSection: {
      marginTop: 4,
      marginBottom: 12,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    subSectionTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 12,
    },
    primaryAction: {
      minHeight: 46,
      borderRadius: 18,
      backgroundColor: theme.colors.blue,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 14,
    },
    primaryActionPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.99 }],
    },
    secondaryAction: {
      minHeight: 46,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      backgroundColor: theme.colors.backgroundElevated,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 14,
    },
    secondaryActionPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.99 }],
    },
    actionDisabled: {
      opacity: 0.72,
    },
    primaryActionText: {
      color: theme.colors.text,
      fontWeight: '800',
      fontSize: 13,
    },
    secondaryActionText: {
      color: theme.colors.text,
      fontWeight: '800',
      fontSize: 13,
    },
    inlineAction: {
      minHeight: 42,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElevated,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    inlineActionText: {
      color: theme.colors.text,
      fontWeight: '800',
      fontSize: 13,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 14,
    },
    badge: {
      minHeight: 28,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    badgeNeutral: {
      backgroundColor: theme.colors.backgroundElevated,
      borderColor: theme.colors.border,
    },
    badgeSuccess: {
      backgroundColor: theme.semantic.success.soft,
      borderColor: theme.semantic.success.border,
    },
    badgeWarning: {
      backgroundColor: theme.semantic.warning.soft,
      borderColor: theme.semantic.warning.border,
    },
    badgeDanger: {
      backgroundColor: theme.semantic.danger.soft,
      borderColor: theme.semantic.danger.border,
    },
    badgeInfo: {
      backgroundColor: theme.semantic.info.soft,
      borderColor: theme.semantic.info.border,
    },
    detailsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    detailBlock: {
      width: '48%',
      minWidth: 0,
      padding: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElevated,
    },
    detailLabel: {
      color: theme.colors.muted,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 6,
    },
    detailValue: {
      color: theme.colors.text,
      fontWeight: '600',
      lineHeight: 18,
    },
    loadingRow: {
      gap: 10,
      paddingVertical: 12,
    },
    loadingText: {
      color: theme.colors.muted,
      fontWeight: '700',
    },
    memberList: {
      gap: 10,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,21,38,0.06)',
      backgroundColor: theme.colors.backgroundElevated,
    },
    memberLeft: {
      flex: 1,
      minWidth: 0,
    },
    memberName: {
      color: theme.colors.text,
      fontWeight: '800',
      marginBottom: 3,
    },
    memberMeta: {
      color: theme.colors.muted,
      fontSize: 12,
      lineHeight: 17,
    },
    locationList: {
      gap: 10,
      marginBottom: 12,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,21,38,0.06)',
      backgroundColor: theme.colors.backgroundElevated,
    },
    locationCoords: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '800',
      textAlign: 'right',
      flexShrink: 0,
    },
    previewWrap: {
      marginTop: 14,
      padding: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,21,38,0.06)',
      backgroundColor: theme.colors.backgroundElevated,
    },
    previewTitle: {
      color: theme.colors.text,
      fontWeight: '800',
      marginBottom: 4,
    },
    previewMeta: {
      color: theme.colors.muted,
      fontSize: 12,
      lineHeight: 17,
      marginBottom: 10,
    },
    previewMatch: {
      padding: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(139,184,255,0.28)' : 'rgba(29,103,255,0.18)',
      backgroundColor: theme.colors.blueSoft,
      marginBottom: 12,
    },
    previewMatchName: {
      color: theme.colors.text,
      fontWeight: '800',
      marginBottom: 3,
    },
    previewMatchMeta: {
      color: theme.colors.muted,
      fontSize: 12,
      lineHeight: 17,
    },
    previewList: {
      gap: 8,
    },
    previewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,21,38,0.06)',
    },
  });
