import { runAppleScript } from "./osascript.js";

/** Sistem ses seviyesi (0–100). Otomasyon izni gerektirmez. */
export async function getSystemVolume(): Promise<number | null> {
  const out = await runAppleScript("output volume of (get volume settings)");
  if (out === null) return null;
  const v = parseInt(out, 10);
  return Number.isFinite(v) ? v : null;
}

export async function setSystemVolume(value: number): Promise<void> {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  await runAppleScript(`set volume output volume ${v}`);
}
