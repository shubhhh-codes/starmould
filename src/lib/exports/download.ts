import { ExportRequestV1 } from "./contracts";
import { appStore } from "@/lib/state/store";

export interface TriggerExportOptions extends Omit<ExportRequestV1, "version"> {}

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
      const errorMsg = errorJson?.error || `Export failed with status ${res.status}`;
      appStore.addToast({
        type: "error",
        message: errorMsg,
      });
      return false;
    }

    // Extract filename from header or build fallback
    const disposition = res.headers.get("Content-Disposition") || "";
    let filename = `Export_${new Date().toISOString().slice(0, 10)}.${options.format}`;
    const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1];
    }

    const blob = await res.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    }, 1500);

    const count = res.headers.get("X-Export-Count");
    appStore.addToast({
      type: "success",
      message: `${formatName} download ready (${count || "all"} rows).`,
    });

    return true;
  } catch (err: any) {
    appStore.addToast({
      type: "error",
      message: err?.message || "Network error while downloading export.",
    });
    return false;
  }
}
