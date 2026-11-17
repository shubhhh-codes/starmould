import React from "react";
import { createRoot } from "react-dom/client";
import { DatabaseBackupPanel } from "@/components/backup/database-backup-panel";
import { setBrowserPrincipal } from "@/lib/cache/principal";
setBrowserPrincipal("backup_admin_fixture");
const fixture = { posts: [] as string[], mode: "ready", paused: false, complete: false };
Object.assign(window, { backupFixture: fixture });
window.fetch = async (input, init) => {
  if (init?.method === "POST") {
    fixture.posts.push(new Headers(init.headers).get("Idempotency-Key") || "");
    return Response.json({ job: { id: "manual/7/test", status: "queued" } }, { status: 202 });
  }
  if (init?.method === "PATCH") { fixture.paused = JSON.parse(String(init.body)).paused; return Response.json({ paused: fixture.paused }); }
  return Response.json({ configured: fixture.mode !== "unconfigured", paused: fixture.paused,
    workerHealthy: fixture.mode !== "offline", jobs: fixture.mode === "unconfigured" ? [] : [{
      id: "2026-11-17/morning", kind: "scheduled", source: fixture.complete ? "fallback" : "github",
      status: fixture.complete ? "completed" : "running", scheduled_at: "2026-11-17T04:35:00Z",
      captured_at: fixture.complete ? "2026-11-17T04:55:00Z" : null,
    }] });
};
createRoot(document.getElementById("root")!).render(<main className="min-h-screen bg-slate-100 p-3 sm:p-8"><DatabaseBackupPanel /></main>);
