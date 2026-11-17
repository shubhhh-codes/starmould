"use client";

import { browserPrincipal, principalIsCurrent } from "@/lib/cache/principal";
import { createClientId, payloadSha256 } from "@/lib/browser-crypto";

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
  const hash = await payloadSha256(canonical(JSON.parse(init.body)));
  if (!principalIsCurrent(principal)) throw new Error("Session changed before document submission");
  // Permission changes invalidate caches, but must not turn an unknown committed outcome into a new operation.
  const actor = principal.key.split("_", 1)[0];
  const storageKey = `STARMOULD_INVENTORY_RETRY:${actor}:${url}:${hash}`;
  let key = sessionStorage.getItem(storageKey);
  if (!key) {
    key = createClientId();
    sessionStorage.setItem(storageKey, key);
  }
  headers.set("Idempotency-Key", key);
  return { headers, complete: () => {
    if (sessionStorage.getItem(storageKey) === key) sessionStorage.removeItem(storageKey);
  } };
}
