"use client";

import { useEffect, useState } from "react";
import type { InfraState } from "@/lib/types/infra";

const POLL_MS = 15_000;
const EMPTY: InfraState = { configured: false, systems: [], updatedAt: 0, error: null };

/** Altyapı verisi — panelin kendi backend'inden (Beszel izleyicisi) 15 sn'de bir */
export function useInfra(): { data: InfraState; stale: boolean } {
  const [data, setData] = useState<InfraState>(EMPTY);
  const [stale, setStale] = useState(true);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/infra", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as InfraState;
        if (!alive) return;
        setData(json);
        setStale(false);
      } catch {
        if (alive) setStale(true);
      }
    };
    void tick();
    const t = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  return { data, stale };
}
