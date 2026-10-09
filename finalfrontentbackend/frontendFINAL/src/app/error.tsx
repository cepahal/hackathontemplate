"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main-content" className="mx-auto flex w-full max-w-xl flex-1 items-center px-4 py-16">
      <ErrorState
        className="w-full"
        message="This page failed to load. Try again, or come back in a moment."
        onRetry={reset}
      />
    </main>
  );
}
