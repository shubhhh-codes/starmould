"use client";

import React, { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function ProgressListener() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname, searchParams]);

  if (!isNavigating) return null;
  return <div className="top-progress-bar" aria-hidden="true" />;
}

export function TopProgressBar() {
  return (
    <Suspense fallback={null}>
      <ProgressListener />
    </Suspense>
  );
}

