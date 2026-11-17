"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-fetches the current page's server data every `seconds` while mounted
 * (audit progress, account discovery). Replaces <meta http-equiv="refresh">,
 * which React hoists into <head> and can break client-side navigation.
 */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
