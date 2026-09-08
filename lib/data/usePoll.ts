"use client";

import { useEffect, useState } from "react";

/** Basit yoklama: panel backend'inden düzenli okuma (kiosk tarafı) */
export function usePoll<T>(load: () => Promise<T>, intervalMs: number): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = () =>
      load().then(
        (d) => { if (alive) { setData(d); setError(null); } },
        (e: Error) => { if (alive) setError(e.message); }
      );
    void tick();
    const t = setInterval(() => void tick(), intervalMs);
    return () => { alive = false; clearInterval(t); };
  }, [load, intervalMs]);

  return { data, error };
}
