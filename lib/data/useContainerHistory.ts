"use client";

import { useEffect, useState } from "react";
import type { ContainerHistory } from "@/lib/types/infra";

const POLL_MS = 30_000;

/** Seçili container'ın son ~60 dakikası; seçim değişince sıfırlanır */
export function useContainerHistory(systemId: string | null, name: string | null): {
  history: ContainerHistory | null;
  error: string | null;
} {
  const [history, setHistory] = useState<ContainerHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!systemId || !name) return;
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(
          `/api/infra/history?system=${encodeURIComponent(systemId)}&container=${encodeURIComponent(name)}`,
          { cache: "no-store" }
        );
        const json = (await res.json()) as ContainerHistory & { error?: string };
        if (!alive) return;
        if (!res.ok || json.error) throw new Error(json.error ?? String(res.status));
        setHistory(json);
        setError(null);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    };
    const t0 = window.setTimeout(() => void tick(), 0);
    const t = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      alive = false;
      window.clearTimeout(t0);
      window.clearInterval(t);
    };
  }, [systemId, name]);

  return { history: history && history.systemId === systemId && history.name === name ? history : null, error };
}
