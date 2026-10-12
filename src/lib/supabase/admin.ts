import { createClient } from "@supabase/supabase-js";
import { env, validateEnv } from "@/lib/config/env";

validateEnv();

const supabaseUrl = env.supabase.url;
const supabaseServiceKey = env.supabase.serviceRoleKey;

export const supabaseAdmin = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseServiceKey || "invalid-key", {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

