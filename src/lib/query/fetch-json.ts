import { principalFetch as fetch } from "./principal-fetch";
import { browserPrincipal, principalIsCurrent } from "@/lib/cache/principal";
import { prepareInventoryRetry } from "./inventory-retry";

export async function fetchJson<T>(url: string, init?: RequestInit, principal = browserPrincipal()): Promise<T> {
  if (!principalIsCurrent(principal)) throw new DOMException("Session changed", "AbortError");
  const retry = await prepareInventoryRetry(url, init);
  const res = await fetch(url, retry ? { ...init, headers: retry.headers } : init);
  if (!res.ok) {
    let errorMsg = `Request failed (${res.status})`;
    try {
      const json = await res.json();
      if (json.error) errorMsg = json.error;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }
  const result = await res.json();
  if (!principalIsCurrent(principal)) throw new DOMException("Session changed", "AbortError");
  retry?.complete();
  return result;
}
