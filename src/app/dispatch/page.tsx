import { Suspense } from "react";
import { DispatchPage } from "@/views/dispatch-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DispatchPage />
    </Suspense>
  );
}
