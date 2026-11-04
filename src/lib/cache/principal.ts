"use client";

let principal: string | null = null;
let generation = 0;

if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem("starmould_user_session");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.id && parsed.permissions_version) {
        principal = `${parsed.id}_${parsed.role_id ?? 0}_${parsed.permissions_version}`;
      }
    }
  } catch {
    // Ignore parse errors on boot
  }
}
const listeners = new Set<() => void>();
export function onPrincipalChange(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function browserPrincipal() { return { key: principal, generation }; }
export function setBrowserPrincipal(key: string | null) {
  if (principal === key) return;
  principal = key;
  generation++;
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") window.dispatchEvent(new Event("starmould:principal-changed"));
}
export function principalIsCurrent(snapshot: ReturnType<typeof browserPrincipal>) {
  return snapshot.key !== null && snapshot.key === principal && snapshot.generation === generation;
}
