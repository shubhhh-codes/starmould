import { Suspense } from "react";
import { PhotoStoragePage } from "@/views/photo-storage-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PhotoStoragePage />
    </Suspense>
  );
}

