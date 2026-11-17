import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { MovementPhotoUploader, type UploadedPhoto } from "@/components/photos/movement-photo-uploader";
import { prepareInventoryRetry } from "@/lib/query/inventory-retry";
import { setBrowserPrincipal } from "@/lib/cache/principal";

setBrowserPrincipal("7_5_http_fixture");
const fixture = { uploads: [] as Record<string, string>[] };
Object.assign(window, { httpUploadFixture: fixture });
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  if (String(input) !== "/api/photos/upload") return originalFetch(input, init);
  const form = init?.body as FormData;
  fixture.uploads.push(Object.fromEntries(["photoBatchId", "clientUploadId", "draftId", "eventId"].map(key => [key, String(form.get(key))])));
  return Response.json({ photo: {
    id: 99, photo_batch_id: form.get("photoBatchId"), original_filename: "HTTP test photo.png",
    file_size_bytes: 100, movement_type: "purchase_inward", server_uploaded_at: "2026-11-16T10:15:12Z",
  } });
};
function Preview() {
  const [count, setCount] = useState(0);
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const save = async () => {
    try {
      const retry = await prepareInventoryRetry("/api/inward", { method: "POST", body: JSON.stringify({ challanid: 17, photoIds: [99] }) });
      setKey(retry?.headers.get("Idempotency-Key") || "");
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
  };
  return <main className="mx-auto max-w-3xl p-6"><h1>HTTP photo upload compatibility</h1>
    <MovementPhotoUploader movementType="purchase_inward" onPhotosChange={(photos: UploadedPhoto[]) => setCount(photos.length)} />
    <p id="uploaded-count">Uploaded: {count}</p><button id="test-retry" type="button" onClick={() => void save()}>Check save retry</button>
    <p id="retry-key">{key}</p>{error && <p role="alert">{error}</p>}
  </main>;
}
createRoot(document.getElementById("root")!).render(<Preview />);
