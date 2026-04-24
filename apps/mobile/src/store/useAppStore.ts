import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Screen =
  | 'home'
  | 'auth'
  | 'otp'
  | 'onboarding-contacts'
  | 'onboarding-permissions'
  | 'risk-log'
  | 'contacts'
  | 'profile'
  | 'profile-personal-info'
  | 'profile-family'
  | 'profile-safety'
  | 'profile-login-security'
  | 'profile-privacy'
  | 'profile-home-address'
  | 'profile-work-address'
  | 'subscription'
  | 'support'
  | 'about'
  | 'reviewer-dashboard'
  | 'settings';

type SessionStatus = 'idle' | 'monitoring' | 'soft_alert' | 'active';
type AuthStatus = 'unauthenticated' | 'authenticated';
export type ThemePreference = 'system' | 'light' | 'dark';
export type AuthFlow = 'login' | 'signup';

export type AppUser = {
  id: string;
  phone?: string | null;
  name?: string | null;
  email?: string | null;
  status?: string | null;
  roles?: string[];
  reviewerRequest?: {
    id: string;
    status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
    motivation?: string | null;
    adminNote?: string | null;
    requestedAt?: string | null;
    reviewedAt?: string | null;
  } | null;
  credibility?: {
    score: number;
    ratingTier: 'high' | 'mid' | 'low';
    restrictionLevel:
      | 'none'
      | 'warning'
      | 'temporary_restriction'
      | 'shadow_restriction'
      | 'ban';
    restrictionExpiresAt?: string | null;
    warningCount: number;
    totalReportsCount: number;
    confirmedTrueReportsCount: number;
    likelyTrueReportsCount: number;
    inconclusiveReportsCount: number;
    falseReportsCount: number;
    maliciousReportsCount: number;
    corroboratedReportsCount: number;
    qualityScoreAverage: number;
    lastReportedAt?: string | null;
    lastScoredAt?: string | null;
  } | null;
};

export type EmergencyLocation = {
  id?: string;
  sessionId?: string;
  userId?: string;
  lat: number;
  lng: number;
  accuracyM?: number | null;
  source?: string | null;
  recordedAt?: string;
  createdAt?: string;
};

export type EmergencySession = {
  alertId: string;
  sessionId: string;
  status?: string;
  triggerSource?: string | null;
  startedAt?: string | null;
  escalationLevel?: number | null;
  alertStatus?: string | null;
  alertStage?: string | null;
  riskScore?: number | null;
  cancelExpiresAt?: string | null;
  riskSnapshot?: Record<string, unknown> | null;
  detectionSummary?: string[] | null;
};

export type EmergencyHistoryItem = EmergencySession & {
  endedAt?: string | null;
  locationCount: number;
};

export type WatchSession = {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone?: string | null;
  startedAt: string;
  endsAt: string;
  durationMinutes: number;
  note?: string | null;
  status: 'active' | 'ended';
};

export type SavedPlaceKey = 'home' | 'work';

export type SavedPlace = {
  addressLine: string;
  note?: string | null;
  source: 'manual' | 'live_location';
  updatedAt: string;
};

type AppState = {
  currentScreen: Screen;
  screenStack: Screen[];
  sessionStatus: SessionStatus;
  authStatus: AuthStatus;
  onboardingComplete: boolean;
  themePreference: ThemePreference;
  pendingEmail: string;
  pendingName: string;
  authFlow: AuthFlow;
  deviceId: string;
  otpRequestedAt: number | null;
  otpDevCode: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  user: AppUser | null;
  activeSession: EmergencySession | null;
  activeWatchSession: WatchSession | null;
  sidebarOpen: boolean;
  emergencyLocations: EmergencyLocation[];
  lastKnownLocation: EmergencyLocation | null;
  savedPlaces: Record<SavedPlaceKey, SavedPlace | null>;
  sessionHistory: EmergencyHistoryItem[];
  watchSessionHistory: WatchSession[];
  hasHydrated: boolean;
  hasSecureAuthHydrated: boolean;
  setScreen: (screen: Screen) => void;
  pushScreen: (screen: Screen) => void;
  resetNavigation: (screen: Screen) => void;
  goBack: () => void;
  setSessionStatus: (status: SessionStatus) => void;
  setAuthStatus: (status: AuthStatus) => void;
  setOnboardingComplete: (value: boolean) => void;
  setThemePreference: (value: ThemePreference) => void;
  setPendingAuth: (payload: { email: string; name?: string | null; mode: AuthFlow }) => void;
  markOtpRequested: (payload: { requestedAt: number; devCode?: string | null }) => void;
  setAuthSession: (payload: {
    accessToken: string;
    refreshToken: string;
    user: AppUser;
  }) => void;
  setUser: (user: AppUser | null) => void;
  setActiveSession: (session: EmergencySession) => void;
  updateActiveSession: (patch: Partial<EmergencySession>) => void;
  startWatchSession: (payload: {
    contactId: string;
    contactName: string;
    contactPhone?: string | null;
    durationMinutes: number;
    note?: string | null;
  }) => WatchSession;
  endWatchSession: () => void;
  setSidebarOpen: (value: boolean) => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  setEmergencyLocations: (locations: EmergencyLocation[]) => void;
  appendEmergencyLocations: (locations: EmergencyLocation[]) => void;
  setLastKnownLocation: (location: EmergencyLocation | null) => void;
  setSavedPlace: (key: SavedPlaceKey, place: SavedPlace) => void;
  clearSavedPlace: (key: SavedPlaceKey) => void;
  clearEmergencySession: () => void;
  clearAuthSession: () => void;
  setHasHydrated: (value: boolean) => void;
  setHasSecureAuthHydrated: (value: boolean) => void;
  restoreSecureAuth: (payload: {
    accessToken: string;
    refreshToken: string;
    user: AppUser | null;
  }) => void;
};

const rootScreens: Screen[] = ['home', 'risk-log', 'contacts', 'profile'];

const isRootScreen = (screen: Screen) => rootScreens.includes(screen);
const defaultDeviceId = `expo-${Platform.OS}-sentinel`;
const MAX_ACTIVE_LOCATIONS = 250;

const getLocationTimestamp = (location: EmergencyLocation) =>
  new Date(location.recordedAt || location.createdAt || 0).getTime();

const getSessionStatusFromStage = (stage?: string | null, status?: string | null): SessionStatus => {
  if (status && status !== 'active') {
    return 'idle';
  }

  switch ((stage || '').toLowerCase()) {
    case 'monitoring':
    case 'suspicious':
      return 'monitoring';
    case 'soft_alert':
      return 'soft_alert';
    case 'high_alert':
    case 'critical':
      return 'active';
    default:
      return status === 'active' ? 'active' : 'idle';
  }
};

const locationIdentity = (location: EmergencyLocation) =>
  location.id ||
  `${location.recordedAt || ''}:${location.lat.toFixed(6)}:${location.lng.toFixed(6)}:${location.source || ''}`;

const sortAndTrimLocations = (locations: EmergencyLocation[]) =>
  locations
    .sort((left, right) => getLocationTimestamp(left) - getLocationTimestamp(right))
    .slice(-MAX_ACTIVE_LOCATIONS);

const mergeLocations = (current: EmergencyLocation[], incoming: EmergencyLocation[]) => {
  if (incoming.length === 0) {
    return current;
  }

  if (current.length === 0) {
    const deduped = new Map<string, EmergencyLocation>();
    incoming.forEach((location) => {
      deduped.set(locationIdentity(location), location);
    });
    return sortAndTrimLocations(Array.from(deduped.values()));
  }

  const merged = [...current];
  const indexByIdentity = new Map<string, number>();
  current.forEach((location, index) => {
    indexByIdentity.set(locationIdentity(location), index);
  });

  const latestCurrentTimestamp = getLocationTimestamp(current[current.length - 1]);
  let needsSort = false;

  incoming.forEach((location) => {
    const identity = locationIdentity(location);
    const existingIndex = indexByIdentity.get(identity);

    if (existingIndex !== undefined) {
      merged[existingIndex] = location;
      return;
    }

    if (getLocationTimestamp(location) < latestCurrentTimestamp) {
      needsSort = true;
    }

    indexByIdentity.set(identity, merged.length);
    merged.push(location);
  });

  const trimmed = merged.slice(-MAX_ACTIVE_LOCATIONS);
  return needsSort ? sortAndTrimLocations(trimmed) : trimmed;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentScreen: 'auth',
      screenStack: ['auth'],
      sessionStatus: 'idle',
      authStatus: 'unauthenticated',
      onboardingComplete: false,
      themePreference: 'system',
      pendingEmail: '',
      pendingName: '',
      authFlow: 'signup',
      deviceId: defaultDeviceId,
      otpRequestedAt: null,
      otpDevCode: null,
      accessToken: null,
      refreshToken: null,
      user: null,
      activeSession: null,
      activeWatchSession: null,
      sidebarOpen: false,
      emergencyLocations: [],
      lastKnownLocation: null,
      savedPlaces: {
        home: null,
        work: null,
      },
      sessionHistory: [],
      watchSessionHistory: [],
      hasHydrated: false,
      hasSecureAuthHydrated: false,
      setScreen: (screen) =>
        set((state) => {
          if (state.currentScreen === screen) {
            return state;
          }

          if (isRootScreen(screen)) {
            return {
              currentScreen: screen,
              screenStack: [screen],
            };
          }

          const nextStack = [...state.screenStack];
          nextStack[nextStack.length - 1] = screen;

          return {
            currentScreen: screen,
            screenStack: nextStack,
          };
        }),
      pushScreen: (screen) =>
        set((state) => ({
          currentScreen: screen,
          screenStack: [...state.screenStack, screen],
        })),
      resetNavigation: (screen) =>
        set({
          currentScreen: screen,
          screenStack: [screen],
        }),
      goBack: () =>
        set((state) => {
          if (state.screenStack.length <= 1) {
            return state;
          }

          const nextStack = state.screenStack.slice(0, -1);
          return {
            currentScreen: nextStack[nextStack.length - 1],
            screenStack: nextStack,
          };
        }),
      setSessionStatus: (status) => set({ sessionStatus: status }),
      setAuthStatus: (status) => set({ authStatus: status }),
      setOnboardingComplete: (value) => set({ onboardingComplete: value }),
      setThemePreference: (value) => set({ themePreference: value }),
      setPendingAuth: ({ email, name, mode }) =>
        set({
          pendingEmail: email,
          pendingName: name ?? '',
          authFlow: mode,
        }),
      markOtpRequested: ({ requestedAt, devCode }) =>
        set({
          otpRequestedAt: requestedAt,
          otpDevCode: devCode ?? null,
        }),
      setAuthSession: ({ accessToken, refreshToken, user }) =>
        set({
          accessToken,
          refreshToken,
          user,
          authStatus: 'authenticated',
          otpDevCode: null,
        }),
      setUser: (user) => set({ user }),
      setActiveSession: (session) =>
        set({
          activeSession: session,
          sessionStatus: getSessionStatusFromStage(session.alertStage, session.status || session.alertStatus),
        }),
      updateActiveSession: (patch) =>
        set((state) => {
          if (!state.activeSession) {
            return state;
          }

          const nextSession = {
            ...state.activeSession,
            ...patch,
          };

          return {
            activeSession: nextSession,
            sessionStatus: getSessionStatusFromStage(nextSession.alertStage, nextSession.status || nextSession.alertStatus),
          };
        }),
      startWatchSession: ({ contactId, contactName, contactPhone, durationMinutes, note }) => {
        const startedAt = new Date().toISOString();
        const endsAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
        const watchSession: WatchSession = {
          id: `watch-${Date.now()}`,
          contactId,
          contactName,
          contactPhone: contactPhone ?? null,
          startedAt,
          endsAt,
          durationMinutes,
          note: note ?? null,
          status: 'active',
        };

        set({
          activeWatchSession: watchSession,
        });

        return watchSession;
      },
      endWatchSession: () =>
        set((state) => ({
          activeWatchSession: null,
          watchSessionHistory: state.activeWatchSession
            ? [
                {
                  ...state.activeWatchSession,
                  status: 'ended' as const,
                },
                ...state.watchSessionHistory.filter(
                  (item) => item.id !== state.activeWatchSession?.id,
                ),
              ].slice(0, 20)
            : state.watchSessionHistory,
        })),
      setSidebarOpen: (value) => set({ sidebarOpen: value }),
      openSidebar: () => set({ sidebarOpen: true }),
      closeSidebar: () => set({ sidebarOpen: false }),
      setEmergencyLocations: (locations) =>
        set({
          emergencyLocations: mergeLocations([], locations),
          lastKnownLocation: locations.length > 0 ? locations[locations.length - 1] : null,
        }),
      appendEmergencyLocations: (locations) =>
        set((state) => {
          const merged = mergeLocations(state.emergencyLocations, locations);
          return {
            emergencyLocations: merged,
            lastKnownLocation: merged.length > 0 ? merged[merged.length - 1] : state.lastKnownLocation,
          };
        }),
      setLastKnownLocation: (location) =>
        set((state) => ({
          lastKnownLocation: location,
          emergencyLocations: location && state.activeSession
            ? mergeLocations(state.emergencyLocations, [location])
            : state.emergencyLocations,
        })),
      setSavedPlace: (key, place) =>
        set((state) => ({
          savedPlaces: {
            ...state.savedPlaces,
            [key]: place,
          },
        })),
      clearSavedPlace: (key) =>
        set((state) => ({
          savedPlaces: {
            ...state.savedPlaces,
            [key]: null,
          },
        })),
      clearEmergencySession: () =>
        set((state) => ({
          activeSession: null,
          emergencyLocations: [],
          lastKnownLocation: null,
          sessionStatus: 'idle',
          sessionHistory: state.activeSession
            ? [
                {
                  ...state.activeSession,
                  endedAt: new Date().toISOString(),
                  locationCount: state.emergencyLocations.length,
                },
                ...state.sessionHistory.filter(
                  (item) => item.sessionId !== state.activeSession?.sessionId,
                ),
              ].slice(0, 20)
            : state.sessionHistory,
        })),
      clearAuthSession: () =>
        set((state) => ({
          accessToken: null,
          refreshToken: null,
          user: null,
          pendingEmail: '',
          pendingName: '',
          authFlow: 'signup',
          otpRequestedAt: null,
          otpDevCode: null,
          authStatus: 'unauthenticated',
          onboardingComplete: false,
          themePreference: state.themePreference,
          sessionStatus: 'idle',
          activeSession: null,
          activeWatchSession: null,
          sidebarOpen: false,
          emergencyLocations: [],
          lastKnownLocation: null,
          savedPlaces: {
            home: null,
            work: null,
          },
          sessionHistory: [],
          watchSessionHistory: [],
          currentScreen: 'auth',
          screenStack: ['auth'],
        })),
      setHasHydrated: (value) => set({ hasHydrated: value }),
      setHasSecureAuthHydrated: (value) => set({ hasSecureAuthHydrated: value }),
      restoreSecureAuth: ({ accessToken, refreshToken, user }) =>
        set({
          accessToken,
          refreshToken,
          user,
          authStatus: 'authenticated',
        }),
    }),
    {
      name: 'sentinel-mobile-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        currentScreen: state.currentScreen,
        screenStack: state.screenStack,
        sessionStatus: state.sessionStatus,
        authStatus: state.authStatus,
        onboardingComplete: state.onboardingComplete,
        themePreference: state.themePreference,
        pendingEmail: state.pendingEmail,
        pendingName: state.pendingName,
        authFlow: state.authFlow,
        deviceId: state.deviceId,
        otpRequestedAt: state.otpRequestedAt,
        otpDevCode: state.otpDevCode,
        savedPlaces: state.savedPlaces,
        activeSession: state.activeSession,
        activeWatchSession: state.activeWatchSession,
        sessionHistory: state.sessionHistory,
        watchSessionHistory: state.watchSessionHistory,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
