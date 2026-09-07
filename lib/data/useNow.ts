"use client";

import { useEffect, useState } from "react";

/**
 * Dijital saatler için canlı zaman. SSR ile hydration uyuşmazlığını önlemek
 * için mount öncesi null döner.
 */
export function useNow(intervalMs = 1000): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    const first = setTimeout(update, 0); // ilk değer hydration'dan hemen sonra
    const id = setInterval(update, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [intervalMs]);

  return now;
}
