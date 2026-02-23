import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { fetchRiskLog, subscribeRiskLogRealtime } from "../api/watchtowerApi";
import { getSupabaseClient } from "../api/supabase";
import {
  colors,
  getDeviceCategory,
  getResponsiveMetrics,
} from "../theme/responsive";

export function RiskLogScreen() {
  const { width, height } = useWindowDimensions();
  const category = getDeviceCategory(width, height);
  const metrics = getResponsiveMetrics(category);

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (mode = "initial") => {
    if (mode === "initial") setIsLoading(true);
    if (mode === "refresh") setIsRefreshing(true);

    try {
      setError("");
      const nextItems = await fetchRiskLog(50);
      setItems(nextItems);
    } catch (loadError) {
      setError(loadError?.message || "Unable to load risk log.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load("initial");
  }, [load]);

  useEffect(() => {
    const unsubscribe = subscribeRiskLogRealtime(() => load("initial"));
    return unsubscribe;
  }, [load]);

  const renderItem = ({ item }) => {
    const title = item?.title || item?.event || item?.type || "Incident";
    const severity = item?.severity || item?.riskLevel || "unknown";
    const status = item?.status || "open";
    const timestamp = item?.createdAt || item?.timestamp || item?.date || "";

    return (
      <View style={[styles.row, { borderRadius: metrics.radius }]}>
        <Text style={[styles.rowTitle, { fontSize: metrics.bodySize }]}>
          {title}
        </Text>
        <Text style={[styles.rowMeta, { fontSize: metrics.bodySize - 2 }]}>
          Severity: {String(severity).toUpperCase()} | Status: {status}
        </Text>
        {Boolean(timestamp) && (
          <Text style={[styles.rowTime, { fontSize: metrics.bodySize - 3 }]}>
            {new Date(timestamp).toLocaleString()}
          </Text>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading risk log...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { padding: metrics.padding }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { fontSize: metrics.titleSize }]}>Risk Log</Text>
        <Text style={styles.sourceText}>
          {getSupabaseClient() ? "Source: Supabase" : "Source: API"}
        </Text>
        <Pressable style={styles.reloadBtn} onPress={() => load("initial")}>
          <Text style={styles.reloadText}>Reload</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={[styles.errorCard, { borderRadius: metrics.radius }]}>
          <Text style={[styles.errorTitle, { fontSize: metrics.bodySize }]}>
            Failed to load risk log
          </Text>
          <Text style={[styles.errorText, { fontSize: metrics.bodySize - 2 }]}>
            {error}
          </Text>
        </View>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(item, index) =>
          String(item?.id || item?.alertId || item?.createdAt || index)
        }
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          items.length === 0 ? styles.listEmpty : null,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => load("refresh")}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <Text style={[styles.emptyText, { fontSize: metrics.bodySize }]}>
            No incidents found.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 15,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  title: {
    color: colors.text,
    fontWeight: "800",
  },
  sourceText: {
    color: colors.muted,
    fontSize: 12,
    marginLeft: 8,
    marginRight: "auto",
  },
  reloadBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reloadText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  errorCard: {
    backgroundColor: "#2a1520",
    borderColor: "#673346",
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    gap: 4,
  },
  errorTitle: {
    color: "#ffd4dc",
    fontWeight: "700",
  },
  errorText: {
    color: "#ffc3d0",
  },
  listContent: {
    gap: 10,
    paddingBottom: 14,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyText: {
    color: colors.muted,
    textAlign: "center",
  },
  row: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 4,
  },
  rowTitle: {
    color: colors.text,
    fontWeight: "700",
  },
  rowMeta: {
    color: colors.muted,
  },
  rowTime: {
    color: "#7ea4d6",
  },
});
