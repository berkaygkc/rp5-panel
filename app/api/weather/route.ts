import { NextResponse } from "next/server";
import { getSettingSync } from "@/lib/server/config/settings";
import type { WeatherState } from "@/lib/os/types";

export const dynamic = "force-dynamic";

/**
 * Hava durumu — anahtar istemeyen Open-Meteo. Sonuç on dakika önbellekte tutulur;
 * konum yönetim panelinden verilir, verilmediyse widget sessizce yerleşmez.
 */
const TTL_MS = 10 * 60_000;
const g = globalThis as unknown as { __rp5Weather?: { at: number; data: WeatherState } };

const LABELS: Array<[number[], string]> = [
  [[0], "Açık"],
  [[1, 2], "Az bulutlu"],
  [[3], "Bulutlu"],
  [[45, 48], "Sisli"],
  [[51, 53, 55, 56, 57], "Çisenti"],
  [[61, 63, 65, 66, 67, 80, 81, 82], "Yağmurlu"],
  [[71, 73, 75, 77, 85, 86], "Karlı"],
  [[95, 96, 99], "Gök gürültülü"],
];
const labelFor = (code: number) => LABELS.find(([codes]) => codes.includes(code))?.[1] ?? "—";

const EMPTY: WeatherState = {
  available: false, place: "", tempC: 0, feelsC: 0, code: 0, label: "",
  high: 0, low: 0, updatedAt: 0, error: null,
};

export async function GET() {
  const lat = Number(getSettingSync("weather.lat"));
  const lon = Number(getSettingSync("weather.lon"));
  const place = String(getSettingSync("weather.place") || "");
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) {
    return NextResponse.json({ ...EMPTY, error: "Konum tanımlı değil" });
  }
  const cached = g.__rp5Weather;
  if (cached && Date.now() - cached.at < TTL_MS) return NextResponse.json(cached.data);

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as {
      current: { temperature_2m: number; apparent_temperature: number; weather_code: number };
      daily: { temperature_2m_max: number[]; temperature_2m_min: number[] };
    };
    const data: WeatherState = {
      available: true,
      place,
      tempC: Math.round(j.current.temperature_2m),
      feelsC: Math.round(j.current.apparent_temperature),
      code: j.current.weather_code,
      label: labelFor(j.current.weather_code),
      high: Math.round(j.daily.temperature_2m_max[0]),
      low: Math.round(j.daily.temperature_2m_min[0]),
      updatedAt: Date.now(),
      error: null,
    };
    g.__rp5Weather = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ ...EMPTY, place, error: (err as Error).message });
  }
}
