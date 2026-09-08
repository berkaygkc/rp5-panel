"use client";

import { useCallback } from "react";
import { usePoll } from "@/lib/data/usePoll";
import type { WeatherState } from "@/lib/os/types";

const EMPTY: WeatherState = {
  available: false, place: "", tempC: 0, feelsC: 0, code: 0, label: "",
  high: 0, low: 0, updatedAt: 0, error: null,
};

/** Hava durumu — panel backend'i üzerinden, on dakikada bir */
export function useWeather(): { data: WeatherState } {
  const load = useCallback(
    () => fetch("/api/weather", { cache: "no-store" }).then((r) => r.json() as Promise<WeatherState>),
    []
  );
  const { data } = usePoll(load, 10 * 60_000);
  return { data: data ?? EMPTY };
}
