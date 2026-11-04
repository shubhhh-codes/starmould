"use client";

import { browserPrincipal, principalIsCurrent } from "@/lib/cache/principal";

const paths = new Set(["/api/purchases", "/api/purchase-inward", "/api/challan", "/api/inward", "/api/dispatch"]);
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

/** Failed/unknown outcomes retain the same key across resubmissions and page reloads. */
export async function prepareInventoryRetry(url: string, init?: RequestInit) {
  if (!paths.has(url.split("?")[0]) || init?.method?.toUpperCase() !== "POST") return null;
  const principal = browserPrincipal();
  if (!principal.key) throw new Error("Sign in before creating an inventory document");
  const headers = new Headers(init.headers);
  if (headers.has("Idempotency-Key")) return { headers, complete: () => {} };
  if (typeof init.body !== "string") throw new Error("Inventory document requires JSON");
  const bytes = new TextEncoder().encode(canonical(JSON.parse(init.body)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  if (!principalIsCurrent(principal)) throw new Error("Session changed before document submission");
  const hash = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
  // Permission changes invalidate caches, but must not turn an unknown committed outcome into a new operation.
  const actor = principal.key.split("_", 1)[0];
  const storageKey = `STARMOULD_INVENTORY_RETRY:${actor}:${url}:${hash}`;
  let key = sessionStorage.getItem(storageKey);
  if (!key) {
    key = crypto.randomUUID();
    sessionStorage.setItem(storageKey, key);
  }
  headers.set("Idempotency-Key", key);
  return { headers, complete: () => {
    if (sessionStorage.getItem(storageKey) === key) sessionStorage.removeItem(storageKey);
  } };
}
