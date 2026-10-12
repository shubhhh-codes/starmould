/**
 * Application Environment Configuration & Validation
 * Centralizes all environment variables with sensible defaults, type safety, and runtime checks.
 */

interface EnvConfig {
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
    jwtSecret: string;
  };
  app: {
    nodeEnv: "development" | "production" | "test";
    isProduction: boolean;
    isDevelopment: boolean;
    appUrl: string;
    apiUrl: string;
  };
}

const nodeEnv = (process.env.NODE_ENV || "development") as EnvConfig["app"]["nodeEnv"];

export const env: EnvConfig = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    jwtSecret: process.env.SUPABASE_JWT_SECRET || "",
  },
  app: {
    nodeEnv,
    isProduction: nodeEnv === "production",
    isDevelopment: nodeEnv === "development",
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    apiUrl: process.env.NEXT_PUBLIC_API_URL || "/api",
  },
};

/**
 * Validates required environment variables on startup.
 */
export function validateEnv(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!env.supabase.url) missing.push("NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)");
  if (!env.supabase.serviceRoleKey && typeof window === "undefined") {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (missing.length > 0 && env.app.isProduction) {
    console.error(`[Env Error] Missing critical environment variables:\n - ${missing.join("\n - ")}`);
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}
