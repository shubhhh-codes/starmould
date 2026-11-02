import { Suspense } from "react";
import { PurchaseInwardPage } from "@/views/purchase-inward-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PurchaseInwardPage />
    </Suspense>
  );
}
