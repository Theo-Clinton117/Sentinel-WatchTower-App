import { apiFetch } from "./client";
import { getRiskLogConfig, getSupabaseClient } from "./supabase";

export async function sendAlert({ latitude, longitude, source = "mobile-app" }) {
  return apiFetch("/api/alerts", {
    method: "POST",
    body: JSON.stringify({
      latitude,
      longitude,
      source,
      createdAt: new Date().toISOString(),
    }),
  });
}

export async function fetchRiskLog(limit = 30) {
  const supabase = getSupabaseClient();

  if (supabase) {
    const { table, orderColumn } = getRiskLogConfig();
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(orderColumn, { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message || "Supabase query failed.");
    return data || [];
  }

  const payload = await apiFetch(`/api/risk-log?limit=${limit}`);

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;

  return [];
}

export function subscribeRiskLogRealtime(onChange) {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  const { table } = getRiskLogConfig();
  const channel = supabase
    .channel(`risk-log-${table}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      () => onChange?.()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
