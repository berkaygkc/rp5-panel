"use client";

import { useEffect, useState } from "react";
import type { ContainerInfo, ContainerLogs } from "@/lib/types/infra";

const LOGS_POLL_MS = 10_000;
const INFO_POLL_MS = 60_000;

function usePolled<T extends { systemId: string; containerId: string }>(
  path: string,
  systemId: string | null,
  containerId: string | null,
  intervalMs: number
): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!systemId || !containerId) return;
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(`${path}?system=${encodeURIComponent(systemId)}&container=${encodeURIComponent(containerId)}`, { cache: "no-store" });
        const json = (await res.json()) as T & { error?: string };
        if (!alive) return;
        if (!res.ok || json.error) throw new Error(json.error ?? String(res.status));
        setData(json);
        setError(null);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    };
    const t0 = window.setTimeout(() => void tick(), 0);
    const t = window.setInterval(() => void tick(), intervalMs);
    return () => {
      alive = false;
      window.clearTimeout(t0);
      window.clearInterval(t);
    };
  }, [path, systemId, containerId, intervalMs]);
  const fresh = data && data.systemId === systemId && data.containerId === containerId ? data : null;
  return { data: fresh, error };
}

/** Container logları (10 sn) ve docker inspect özeti (60 sn) */
export function useContainerLogs(systemId: string | null, containerId: string | null) {
  return usePolled<ContainerLogs>("/api/infra/logs", systemId, containerId, LOGS_POLL_MS);
}
export function useContainerInfo(systemId: string | null, containerId: string | null) {
  return usePolled<ContainerInfo>("/api/infra/inspect", systemId, containerId, INFO_POLL_MS);
}
