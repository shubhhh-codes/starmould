"use client";

import { browserPrincipal, onPrincipalChange, principalIsCurrent } from "@/lib/cache/principal";

const requests = new Set<AbortController>();
onPrincipalChange(() => {
  for (const request of requests) request.abort();
  requests.clear();
});
const sessionChanged = () => new DOMException("Session changed while request was pending", "AbortError");

/** Both pending network requests and body consumption belong to the initiating principal. */
export async function principalFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof window === "undefined") return globalThis.fetch(input, init);
  const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
  if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/api/auth/") || url.pathname.startsWith("/api/logs/")) return globalThis.fetch(input, init);
  const principal = browserPrincipal();
  if (!principal.key) return globalThis.fetch(input, init);
  const controller = new AbortController();
  requests.add(controller);
  const signals = [controller.signal, init?.signal, input instanceof Request ? input.signal : undefined].filter(Boolean) as AbortSignal[];
  try {
    const response = await globalThis.fetch(input, { ...init, signal: AbortSignal.any(signals) });
    if (!principalIsCurrent(principal)) throw sessionChanged();
    for (const method of ["json", "text", "blob", "arrayBuffer", "formData"] as const) {
      const consume = response[method].bind(response);
      Object.defineProperty(response, method, { value: async () => {
        try {
          if (!principalIsCurrent(principal)) throw sessionChanged();
          const result = await consume();
          if (!principalIsCurrent(principal)) throw sessionChanged();
          return result;
        } finally { requests.delete(controller); }
      } });
    }
    return response;
  } catch (error) {
    controller.abort();
    requests.delete(controller);
    throw error;
  }
}
