import { createClient } from "@supabase/supabase-js";
import { getSupabaseBrowserConfig } from "./env";

export function createSupabaseUserServerClient(accessToken: string) {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseBrowserConfig();

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
