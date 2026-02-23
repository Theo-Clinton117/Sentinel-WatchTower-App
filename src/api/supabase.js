import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
const RISK_LOG_TABLE = process.env.EXPO_PUBLIC_RISK_LOG_TABLE || "alerts";
const RISK_LOG_ORDER_COLUMN =
  process.env.EXPO_PUBLIC_RISK_LOG_ORDER_COLUMN || "created_at";

let supabase = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export function getSupabaseClient() {
  return supabase;
}

export function getRiskLogConfig() {
  return {
    table: RISK_LOG_TABLE,
    orderColumn: RISK_LOG_ORDER_COLUMN,
  };
}
