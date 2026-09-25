import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseServiceKey) {
  if (process.env.NODE_ENV === "production") {
    console.error("CRITICAL: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from environment.");
  }
}

export const supabaseAdmin = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseServiceKey || "invalid-key", {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

