"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-renders the admin page every 30 seconds, so the numbers stay live during the event.
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
