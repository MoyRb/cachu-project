import { SupabaseClient, createClient } from "@supabase/supabase-js";

let cachedAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  if (!supabaseUrl) {
    throw new Error("Server misconfigured: missing NEXT_PUBLIC_SUPABASE_URL");
  }

  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!serviceRoleKey) {
    throw new Error("Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY");
  }

  if (!cachedAdmin) {
    cachedAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  return cachedAdmin;
}
