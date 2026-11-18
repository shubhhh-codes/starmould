import { ExportRequestV1, ExportScope } from "./contracts";
import { appStore } from "@/lib/state/store";

export interface TriggerExportOptions extends Omit<ExportRequestV1, "version" | "scope"> {
  scope?: ExportScope;
}

export async function triggerFileExport(options: TriggerExportOptions): Promise<boolean> {
  const formatName = options.format.toUpperCase();
  const loadingToastId = `export-${Date.now()}`;

  appStore.addToast({
    type: "info",
    message: `Preparing ${formatName} export...`,
  });

  try {
    const payload: ExportRequestV1 = {
      version: 1,
      scope: options.scope || "filtered",
      ...options,
    };

    const res = await fetch("/api/exports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.error || `Export failed with HTTP ${res.status}`);
    }

    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition");
    let filename = `export_${Date.now()}.${options.format}`;
    if (disposition && disposition.includes("filename=")) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    appStore.addToast({
      type: "success",
      message: `${formatName} export ready for download.`,
    });
    return true;
  } catch (err: any) {
    console.error("Export error:", err);
    appStore.addToast({
      type: "error",
      message: err?.message || "Failed to generate export file",
    });
    return false;
  }
}
