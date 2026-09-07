/**
 * AppleScript kaynağı: Spotify ve Apple Music.
 * Resmi otomasyon API'leri — seek, konum ve (Spotify'da) kapak görseli dahil.
 * Uygulamayı asla kendisi başlatmaz; çalışmıyorsa null döner.
 */
import { runAppleScript } from "../osascript.js";
import type { WireTrack } from "../protocol.js";

export interface SourceSnapshot {
  source: "spotify" | "music";
  track: WireTrack;
  playing: boolean;
  positionSec: number;
  /** Uygulamanın kendi ses seviyesi (0–100) — sistem sesi okunamayan çıkışlarda yedek */
  appVolume?: number;
}

const SEP = "|~|";

/** Türkçe yerel ayarda osascript ondalıkları virgülle döndürür. */
const num = (s: string) => parseFloat(s.replace(",", "."));

/* Notlar:
 * - "is running" denetimi LaunchServices'ten okunur: uygulamayı başlatmaz ve
 *   otomasyon izni gerektirmez (System Events'e gerek yok).
 * - Değişken adları bilerek Türkçe: "st" gibi kısa adlar uygulamaların betik
 *   sözlüklerindeki terimlerle çakışıp -2741 sözdizimi hatası üretebiliyor. */
const guarded = (proc: string, body: string) => `
if application "${proc}" is running then
${body}
else
  return "NOTRUNNING"
end if`;

const spotifyScript = guarded(
  "Spotify",
  `tell application "Spotify"
  try
    set calmaDurumu to player state as text
    set parca to current track
    return calmaDurumu & "${SEP}" & (name of parca) & "${SEP}" & (artist of parca) & "${SEP}" & (album of parca) & "${SEP}" & (duration of parca) & "${SEP}" & (player position) & "${SEP}" & (artwork url of parca) & "${SEP}" & (id of parca) & "${SEP}" & (sound volume)
  on error
    return "NOTRACK"
  end try
end tell`
);

const musicScript = guarded(
  "Music",
  `tell application "Music"
  try
    set calmaDurumu to player state as text
    set parca to current track
    return calmaDurumu & "${SEP}" & (name of parca) & "${SEP}" & (artist of parca) & "${SEP}" & (album of parca) & "${SEP}" & (duration of parca) & "${SEP}" & (player position) & "${SEP}" & (persistent ID of parca) & "${SEP}" & (sound volume)
  on error
    return "NOTRACK"
  end try
end tell`
);

export async function readSpotify(): Promise<SourceSnapshot | null> {
  const out = await runAppleScript(spotifyScript);
  if (!out || out === "NOTRUNNING" || out === "NOTRACK") return null;
  const p = out.split(SEP);
  if (p.length < 9) return null;
  return {
    source: "spotify",
    playing: p[0] === "playing",
    positionSec: num(p[5]) || 0,
    appVolume: Math.round(num(p[8])) || 0,
    track: {
      id: p[7],
      title: p[1],
      artist: p[2],
      album: p[3],
      durationSec: (num(p[4]) || 0) / 1000, // Spotify süreyi ms verir
      artworkUrl: p[6] || null,
    },
  };
}

export async function readMusic(): Promise<SourceSnapshot | null> {
  const out = await runAppleScript(musicScript);
  if (!out || out === "NOTRUNNING" || out === "NOTRACK") return null;
  const p = out.split(SEP);
  if (p.length < 8) return null;
  return {
    source: "music",
    playing: p[0] === "playing",
    positionSec: num(p[5]) || 0,
    appVolume: Math.round(num(p[7])) || 0,
    track: {
      id: p[6],
      title: p[1],
      artist: p[2],
      album: p[3],
      durationSec: num(p[4]) || 0, // Music süreyi saniye verir
      artworkUrl: null,
    },
  };
}

const APP_NAME = { spotify: "Spotify", music: "Music" } as const;

export async function appleScriptCommand(
  source: "spotify" | "music",
  cmd: "togglePlay" | "next" | "prev" | { seekTo: number } | { appVolume: number }
): Promise<void> {
  const app = APP_NAME[source];
  const body =
    typeof cmd === "object"
      ? "seekTo" in cmd
        ? `set player position to ${cmd.seekTo.toFixed(1)}`
        : `set sound volume to ${Math.round(cmd.appVolume)}`
      : { togglePlay: "playpause", next: "next track", prev: "previous track" }[cmd];
  await runAppleScript(`tell application "${app}" to ${body}`);
}
