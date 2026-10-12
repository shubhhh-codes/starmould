import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/config/env";

export const supabase = createClient(
  env.supabase.url || "https://placeholder.supabase.co",
  env.supabase.anonKey || "placeholder-anon-key"
);
