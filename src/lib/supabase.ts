import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
export const isConfigured = Boolean(url && key && /^https?:\/\//.test(url));
export const supabase = isConfigured ? createClient(url!, key!) : null;
