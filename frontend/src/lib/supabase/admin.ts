import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://tvfqhdhxwnpkhhrvxvfi.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseServiceKey) {
  console.warn("WARNING: SUPABASE_SERVICE_ROLE_KEY is not defined in environment.");
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || "dummy-key", {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

