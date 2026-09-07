/**
 * MediaRemote kaynağı — en iyi çaba, evrensel "şu an çalıyor" katmanı.
 * Sistemde kurulu bir yardımcı CLI arar (öncelik sırasıyla):
 *   1. media-control  (mediaremote-adapter yaklaşımı, macOS 15.4+ ile uyumlu)
 *   2. nowplaying-cli (eski MediaRemote yolu, macOS < 15.4)
 * Hiçbiri yoksa katman sessizce devre dışı kalır. Seek desteklenmez.
 */
import { execFile } from "node:child_process";
import { cleanEnv } from "../env.js";
import type { SourceSnapshot } from "./applescript.js";
import type { WireTrack } from "../protocol.js";

type Binary = { kind: "media-control" | "nowplaying-cli"; path: string };

let cached: Binary | null | undefined;

function which(name: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile("which", [name], (err, stdout) => resolve(err ? null : stdout.trim() || null));
  });
}

async function detect(): Promise<Binary | null> {
  if (cached !== undefined) return cached;
  const mc = await which("media-control");
  if (mc) return (cached = { kind: "media-control", path: mc });
  const np = await which("nowplaying-cli");
  if (np) return (cached = { kind: "nowplaying-cli", path: np });
  return (cached = null);
}

function run(path: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(path, args, { timeout: 3000, env: cleanEnv() }, (err, stdout) =>
      resolve(err ? null : stdout.trim())
    );
  });
}

export interface SystemSnapshot extends Omit<SourceSnapshot, "source"> {
  source: "system" | "browser";
}

const BROWSER_BUNDLE = /browser|chrome|safari|firefox|arc|edge|opera|vivaldi/i;

export async function readMediaRemote(): Promise<SystemSnapshot | null> {
  const bin = await detect();
  if (!bin) return null;

  if (bin.kind === "media-control") {
    const out = await run(bin.path, ["get"]);
    if (!out) return null;
    try {
      const j = JSON.parse(out) as Record<string, unknown>;
      const title = (j.title as string) ?? "";
      if (!title) return null;
      const duration = Number(j.duration ?? j.durationSec ?? 0);
      const playing =
        typeof j.playing === "boolean" ? j.playing : Number(j.playbackRate ?? 0) > 0;
      // "elapsedTime", "timestamp" anındaki konumdur — şu ana taşı,
      // yoksa panelde dakika donmuş görünür
      let elapsed = Number(j.elapsedTime ?? j.elapsed ?? 0);
      const ts = typeof j.timestamp === "string" ? Date.parse(j.timestamp) : NaN;
      if (playing && Number.isFinite(ts)) {
        const rate = Number(j.playbackRate ?? 1) || 1;
        elapsed += ((Date.now() - ts) / 1000) * rate;
      }
      if (duration > 0) elapsed = Math.max(0, Math.min(duration, elapsed));
      const bundle = (j.bundleIdentifier as string) ?? "";
      // Kapak, base64 olarak gelir — panel doğrudan data URI gösterebilir
      const artworkUrl =
        typeof j.artworkData === "string" && j.artworkData.length > 0
          ? `data:${(j.artworkMimeType as string) || "image/jpeg"};base64,${j.artworkData}`
          : null;
      const track: WireTrack = {
        id: (j.contentItemIdentifier as string) || `mr-${title}-${(j.artist as string) ?? ""}`,
        title,
        artist: (j.artist as string) ?? "",
        album: (j.album as string) ?? "",
        durationSec: duration,
        artworkUrl,
      };
      return {
        source: BROWSER_BUNDLE.test(bundle) ? "browser" : "system",
        track,
        playing,
        positionSec: elapsed,
      };
    } catch {
      return null;
    }
  }

  // nowplaying-cli: istenen alanları satır satır döndürür, eksikler "null"
  const out = await run(bin.path, [
    "get",
    "title",
    "artist",
    "album",
    "duration",
    "elapsedTime",
    "playbackRate",
  ]);
  if (!out) return null;
  const [title, artist, album, duration, elapsed, rate] = out.split("\n");
  if (!title || title === "null") return null;
  return {
    source: "system",
    playing: parseFloat(rate ?? "0") > 0,
    positionSec: parseFloat(elapsed ?? "0") || 0,
    track: {
      id: `mr-${title}-${artist ?? ""}`,
      title,
      artist: artist === "null" ? "" : (artist ?? ""),
      album: album === "null" ? "" : (album ?? ""),
      durationSec: parseFloat(duration ?? "0") || 0,
      artworkUrl: null,
    },
  };
}

export async function mediaRemoteCommand(
  cmd: "togglePlay" | "next" | "prev" | { seekTo: number }
): Promise<void> {
  const bin = await detect();
  if (!bin) return;

  if (typeof cmd === "object") {
    // Seek yalnızca media-control'de var
    if (bin.kind === "media-control") await run(bin.path, ["seek", cmd.seekTo.toFixed(1)]);
    return;
  }

  const args =
    bin.kind === "media-control"
      ? { togglePlay: "toggle-play-pause", next: "next-track", prev: "previous-track" }
      : { togglePlay: "togglePlayPause", next: "next", prev: "previous" };
  await run(bin.path, [args[cmd]]);
}
