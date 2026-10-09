import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAppTheme } from "../theme";
import { useAppStore } from "../store/useAppStore";
import {
  createCircle,
  acceptCircleInvitation,
  declineCircleInvitation,
  inviteToCircle,
  listCircleMembers,
  listCircles,
  listMyCircleInvitations,
  type Circle,
  type CircleInvitation,
  type CircleMember,
} from "../services/circles";
import {
  cancelJourney,
  checkInJourney,
  confirmJourneyArrival,
  listJourneys,
  startJourney,
  type Journey,
} from "../services/journeys";
import {
  getCurrentLocation,
  startBackgroundTracking,
  startForegroundTracking,
  startJourneyGeofence,
  stopBackgroundTracking,
} from "../services/location";
import {
  getAppPermissionSnapshot,
  requestPermission,
} from "../services/permissions";
import { discardJourneyUpdates } from "../services/journey-sync";
import {
  clearBackgroundJourney,
  saveBackgroundJourney,
} from "../services/background-journey";
import { listRiskZones } from "../services/risk-zones";
const kinds = ["family", "partner", "friends", "work", "children", "custom"];
const Card = ({ children }: { children: React.ReactNode }) => {
  const t = useAppTheme();
  return (
    <View
      style={[
        s.card,
        { backgroundColor: t.colors.surface, borderColor: t.colors.border },
      ]}
    >
      {children}
    </View>
  );
};
export const CircleScreen = () => {
  const t = useAppTheme(),
    [circles, setCircles] = useState<Circle[]>([]),
    [invitations, setInvitations] = useState<CircleInvitation[]>([]),
    [members, setMembers] = useState<CircleMember[]>([]),
    [name, setName] = useState(""),
    [kind, setKind] = useState("family"),
    [inviteEmail, setInviteEmail] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = async () => {
    try {
      const [r, incoming] = await Promise.all([listCircles(), listMyCircleInvitations()]);
      setCircles(r);
      setInvitations(incoming);
      if (!selected && r[0]) setSelected(r[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your Circles.");
    }
  };
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!selected) return;
    void listCircleMembers(selected)
      .then(setMembers)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load members."),
      );
  }, [selected]);
  const create = async () => {
    if (name.trim().length < 2) return;
    setBusy(true);
    try {
      const c = await createCircle({ name: name.trim(), kind });
      setCircles((x) => [c, ...x]);
      setSelected(c.id);
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create Circle.");
    } finally {
      setBusy(false);
    }
  };
  const invite = async () => {
    if (!selected || !inviteEmail.trim()) return;
    setBusy(true);
    try {
      await inviteToCircle(selected, { email: inviteEmail.trim() });
      setInviteEmail("");
      setError("");
      setNotice("Invitation created. It will appear for the Sentinel account using that email.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create invitation.");
    } finally {
      setBusy(false);
    }
  };
  const respondToInvitation = async (invitation: CircleInvitation, accept: boolean) => {
    setBusy(true);
    try {
      if (accept) await acceptCircleInvitation(invitation.id);
      else await declineCircleInvitation(invitation.id);
      await load();
      if (accept) setSelected(invitation.circleId);
      setError("");
      setNotice(accept ? "Invitation accepted." : "Invitation declined.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update invitation.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <ScrollView
      contentContainerStyle={[s.wrap, { backgroundColor: t.colors.background }]}
    >
      <Text style={[s.title, { color: t.colors.text }]}>Your Circle</Text>
      <Text style={[s.copy, { color: t.colors.muted }]}>
        Know they’re safe — without tracking where they are.
      </Text>
      <Card>
        <Text style={[s.label, { color: t.colors.text }]}>
          Create a Safety Circle
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. My family"
          placeholderTextColor={t.colors.muted}
          style={[
            s.input,
            { color: t.colors.text, borderColor: t.colors.border },
          ]}
        />
        <View style={s.chips}>
          {kinds.map((x) => (
            <Pressable
              key={x}
              onPress={() => setKind(x)}
              style={[
                s.chip,
                {
                  borderColor: kind === x ? t.colors.blue : t.colors.border,
                  backgroundColor:
                    kind === x ? t.colors.blueSoft : "transparent",
                },
              ]}
            >
              <Text style={{ color: t.colors.text }}>{x}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => void create()}
          disabled={busy}
          style={[s.primary, { backgroundColor: t.colors.blue }]}
        >
          <Text style={s.primaryText}>
            {busy ? "Creating…" : "Create Circle"}
          </Text>
        </Pressable>
      </Card>
      {circles.map((c) => (
        <Pressable key={c.id} onPress={() => setSelected(c.id)}>
          <Card>
            <Text style={[s.label, { color: t.colors.text }]}>{c.name}</Text>
            <Text style={[s.copy, { color: t.colors.muted }]}>
              {c.memberCount} people · {c.role}
            </Text>
          </Card>
        </Pressable>
      ))}
      {invitations.length ? (
        <Card>
          <Text style={[s.label, { color: t.colors.text }]}>Circle invitations</Text>
          {invitations.map((invitation) => (
            <View key={invitation.id} style={[s.row, { borderTopColor: t.colors.border }]}>
              <View style={s.invitationCopy}>
                <Text style={{ color: t.colors.text, fontWeight: "700" }}>{invitation.circleName}</Text>
                <Text style={{ color: t.colors.muted }}>Invited by {invitation.invitedByName || "a Circle owner"}</Text>
              </View>
              <View style={s.invitationActions}>
                <Pressable disabled={busy} onPress={() => void respondToInvitation(invitation, false)}><Text style={{ color: t.colors.red }}>Decline</Text></Pressable>
                <Pressable disabled={busy} onPress={() => void respondToInvitation(invitation, true)}><Text style={{ color: t.colors.success }}>Accept</Text></Pressable>
              </View>
            </View>
          ))}
        </Card>
      ) : null}
      {notice ? <Text style={{ color: t.colors.success }}>{notice}</Text> : null}
      {selected ? (
        <Card>
          <Text style={[s.label, { color: t.colors.text }]}>
            People in this Circle
          </Text>
          <Text style={[s.copy, { color: t.colors.muted }]}>
            Safety status is shared here. Live location is always private unless
            someone explicitly shares it.
          </Text>
          {circles.find((circle) => circle.id === selected)?.role === "owner" ? <>
            <TextInput value={inviteEmail} onChangeText={setInviteEmail} placeholder="Invite by account email" placeholderTextColor={t.colors.muted} autoCapitalize="none" keyboardType="email-address" style={[s.input, { color: t.colors.text, borderColor: t.colors.border }]} />
            <Pressable accessibilityRole="button" onPress={() => void invite()} disabled={busy || !inviteEmail.trim()} style={[s.secondary, { borderColor: t.colors.blue }]}><Text style={{ color: t.colors.blue }}>{busy ? "Working…" : "Invite to Circle"}</Text></Pressable>
          </> : null}
          {members.map((m) => (
            <View
              key={m.id}
              style={[s.row, { borderTopColor: t.colors.border }]}
            >
              <View>
                <Text style={{ color: t.colors.text, fontWeight: "700" }}>
                  {m.name || m.email || "Circle member"}
                </Text>
                <Text style={{ color: t.colors.muted }}>
                  Safety status unavailable
                </Text>
              </View>
              <Text style={{ color: t.colors.success }}>Safe</Text>
            </View>
          ))}
        </Card>
      ) : null}
      {error ? <Text style={{ color: t.colors.red }}>{error}</Text> : null}
    </ScrollView>
  );
};
export const SafeArrivalScreen = () => {
  const t = useAppTheme(),
    setScreen = useAppStore((x) => x.setScreen),
    setActiveJourney = useAppStore((x) => x.setActiveJourney),
    [journey, setJourney] = useState<Journey | null>(null),
    [destination, setDestination] = useState(""),
    [lat, setLat] = useState(""),
    [lng, setLng] = useState(""),
    [recipient, setRecipient] = useState(""),
    [recipients, setRecipients] = useState<CircleMember[]>([]),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState("");
  useEffect(() => {
    void listJourneys()
      .then((x) =>
        setJourney(
          x.find((j) => j.status === "active") ||
            x.find(
              (j) => j.status === "expired" && Boolean(j.checkInRequestedAt),
            ) ||
            null,
        ),
      )
      .catch(() =>
        setNote(
          "Connection unavailable. Your journey status could not be updated.",
        ),
      );
    void listCircles()
      .then(async (circles) => {
        const groups = await Promise.all(
          circles.map((c) => listCircleMembers(c.id)),
        );
        const own = new Set<string>();
        setRecipients(
          groups
            .flat()
            .filter(
              (m) =>
                m.role !== "owner" &&
                !own.has(m.userId) &&
                (own.add(m.userId), true),
            ),
        );
      })
      .catch(() => setNote("Could not load Circle recipients."));
  }, []);
  const begin = async () => {
    setNote(
      "Sentinel can use your location in the background for this journey. Your Circle cannot automatically see where you are.",
    );
    let p = await getAppPermissionSnapshot();
    if (!p.foregroundLocation.granted) {
      if (!p.foregroundLocation.canAskAgain) {
        setNote(
          "Location is off. You can still use Sentinel; enable it in Settings to use Safe Arrival.",
        );
        return;
      }
      await requestPermission("foregroundLocation");
      p = await getAppPermissionSnapshot();
      if (!p.foregroundLocation.granted) {
        setNote("Location was not enabled. Safe Arrival was not started.");
        return;
      }
    }
    if (!p.backgroundLocation.granted) {
      if (!p.backgroundLocation.canAskAgain) {
        setNote(
          "Background location is off. You can still use Sentinel; enable it in Settings to use Safe Arrival.",
        );
        return;
      }
      await requestPermission("backgroundLocation");
      const q = await getAppPermissionSnapshot();
      if (!q.backgroundLocation.granted) {
        setNote(
          "Background location was not enabled. Safe Arrival was not started.",
        );
        return;
      }
    }
    setBusy(true);
    try {
      const started = await startJourney({
        destinationLabel: destination,
        destinationLat: Number(lat),
        destinationLng: Number(lng),
        recipientUserIds: [recipient],
        durationMinutes: 120,
      });
      setJourney(started);
      setActiveJourney({
        id: started.id,
        destinationLabel: started.destinationLabel,
        status: "active",
      });
      await saveBackgroundJourney({
        id: started.id,
        destinationLabel: started.destinationLabel,
        destinationLat: started.destinationLat,
        destinationLng: started.destinationLng,
      });
      await startForegroundTracking();
      await startBackgroundTracking();
      await startJourneyGeofence({
        lat: started.destinationLat,
        lng: started.destinationLng,
      });
      setNote(
        "Journey active. Your recipient can see the journey state, not your live location.",
      );
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not start Safe Arrival.");
    } finally {
      setBusy(false);
    }
  };
  const arrive = async () => {
    if (!journey) return;
    setBusy(true);
    try {
      const l = await getCurrentLocation();
      await confirmJourneyArrival(journey.id, l);
      await discardJourneyUpdates(journey.id);
      await clearBackgroundJourney();
      setJourney(null);
      setActiveJourney(null);
      await stopBackgroundTracking();
      setNote("You arrived safely. Your selected recipient has been notified.");
    } catch (e) {
      setNote(
        e instanceof Error ? e.message : "Arrival could not be confirmed.",
      );
    } finally {
      setBusy(false);
    }
  };
  const checkIn = async () => {
    if (!journey) return;
    setBusy(true);
    try {
      await checkInJourney(journey.id);
      await discardJourneyUpdates(journey.id);
      await clearBackgroundJourney();
      setJourney(null);
      setActiveJourney(null);
      await stopBackgroundTracking();
      setNote(
        "Check-in received. Your selected recipient has been notified that you are safe.",
      );
    } catch (e) {
      setNote(
        e instanceof Error ? e.message : "Your check-in could not be recorded.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <ScrollView
      contentContainerStyle={[s.wrap, { backgroundColor: t.colors.background }]}
    >
      <Text style={[s.title, { color: t.colors.text }]}>Safe Arrival</Text>
      <Text style={[s.copy, { color: t.colors.muted }]}>
        Let someone know when you arrive — without sharing your route.
      </Text>
      {journey?.status === "expired" ? (
        <Card>
          <Text style={[s.label, { color: t.colors.text }]}>We could not confirm your arrival</Text>
          <Text style={[s.copy, { color: t.colors.muted }]}>If you are safe, check in below. This does not restart location tracking.</Text>
          <Pressable onPress={() => void checkIn()} disabled={busy} style={[s.primary, { backgroundColor: t.colors.blue }]}>
            <Text style={s.primaryText}>{busy ? "Checking in…" : "I’m safe"}</Text>
          </Pressable>
        </Card>
      ) : journey ? (
        <Card>
          <Text style={[s.label, { color: t.colors.text }]}>
            Journey active
          </Text>
          <Text style={[s.copy, { color: t.colors.muted }]}>
            Heading to {journey.destinationLabel}. Location processing:{" "}
            {note.includes("Connection") ? "temporarily offline" : "active"}.
          </Text>
          <Pressable
            onPress={() => void arrive()}
            style={[s.primary, { backgroundColor: t.colors.blue }]}
          >
            <Text style={s.primaryText}>
              {busy ? "Checking…" : "I’ve arrived"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() =>
              void cancelJourney(journey.id).then(async () => {
                await discardJourneyUpdates(journey.id);
                await clearBackgroundJourney();
                setJourney(null);
                setActiveJourney(null);
                await stopBackgroundTracking();
                setNote("Journey cancelled.");
              })
            }
          >
            <Text style={[s.link, { color: t.colors.red }]}>
              Cancel journey
            </Text>
          </Pressable>
        </Card>
      ) : (
        <Card>
          <TextInput
            value={destination}
            onChangeText={setDestination}
            placeholder="Destination name"
            placeholderTextColor={t.colors.muted}
            style={[
              s.input,
              { color: t.colors.text, borderColor: t.colors.border },
            ]}
          />
          <TextInput
            value={lat}
            onChangeText={setLat}
            placeholder="Destination latitude"
            keyboardType="decimal-pad"
            placeholderTextColor={t.colors.muted}
            style={[
              s.input,
              { color: t.colors.text, borderColor: t.colors.border },
            ]}
          />
          <TextInput
            value={lng}
            onChangeText={setLng}
            placeholder="Destination longitude"
            keyboardType="decimal-pad"
            placeholderTextColor={t.colors.muted}
            style={[
              s.input,
              { color: t.colors.text, borderColor: t.colors.border },
            ]}
          />
          <Text style={[s.copy, { color: t.colors.muted }]}>
            Who should know you arrived?
          </Text>
          {recipients.map((m) => (
            <Pressable
              key={m.userId}
              onPress={() => setRecipient(m.userId)}
              style={[
                s.chip,
                {
                  borderColor:
                    recipient === m.userId ? t.colors.blue : t.colors.border,
                  backgroundColor:
                    recipient === m.userId ? t.colors.blueSoft : "transparent",
                },
              ]}
            >
              <Text style={{ color: t.colors.text }}>
                {m.name || m.email || "Circle member"}
              </Text>
            </Pressable>
          ))}
          {!recipients.length ? (
            <Text style={[s.copy, { color: t.colors.muted }]}>
              Create a Circle and invite someone before starting Safe Arrival.
            </Text>
          ) : null}
          <Pressable
            onPress={() => void begin()}
            disabled={busy || !recipient}
            style={[
              s.primary,
              { backgroundColor: t.colors.blue, opacity: recipient ? 1 : 0.55 },
            ]}
          >
            <Text style={s.primaryText}>
              {busy ? "Starting…" : "Start Safe Arrival"}
            </Text>
          </Pressable>
        </Card>
      )}
      {note ? (
        <Text style={[s.copy, { color: t.colors.muted }]}>{note}</Text>
      ) : null}
      <Pressable onPress={() => setScreen("home")}>
        <Text style={[s.link, { color: t.colors.blue }]}>Back to Home</Text>
      </Pressable>
    </ScrollView>
  );
};
export const AroundScreen = () => {
  const t = useAppTheme(),
    [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    void listRiskZones()
      .then((x) => setCount(x.length))
      .catch(() => setCount(null));
  }, []);
  return (
    <ScrollView
      contentContainerStyle={[s.wrap, { backgroundColor: t.colors.background }]}
    >
      <Text style={[s.title, { color: t.colors.text }]}>Around You</Text>
      <Card>
        <Text style={[s.label, { color: t.colors.text }]}>
          {count === null
            ? "Safety information unavailable"
            : count
              ? `${count} relevant safety areas`
              : "No relevant safety information"}
        </Text>
        <Text style={[s.copy, { color: t.colors.muted }]}>
          Sentinel only shows relevant local information when it is available.
          Reports are not treated as confirmed facts without verification.
        </Text>
      </Card>
    </ScrollView>
  );
};
const s = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 110, gap: 12, flexGrow: 1 },
  title: { fontSize: 28, fontWeight: "800" },
  copy: { fontSize: 14, lineHeight: 20 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 },
  label: { fontSize: 17, fontWeight: "800" },
  input: { borderWidth: 1, borderRadius: 12, padding: 13, fontSize: 15 },
  primary: {
    minHeight: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  primaryText: { color: "#fff", fontWeight: "800" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  row: {
    borderTopWidth: 1,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  invitationCopy: { flex: 1, gap: 3 },
  invitationActions: { flexDirection: "row", gap: 14, alignItems: "center" },
  secondary: { borderWidth: 1, borderRadius: 12, padding: 12, alignItems: "center", marginTop: 12 },
  link: { fontWeight: "800", paddingVertical: 12 },
});
