/**
 * Canlı ajan: kaynakları yoklar, tek bir WireMediaState'e indirger,
 * komutları aktif kaynağa yönlendirir.
 * Öncelik: çalan kaynak kazanır (Spotify > Music > MediaRemote);
 * kimse çalmıyorsa parçası olan ilk kaynak gösterilir.
 *
 * Ses: önce sistem sesi; okunamıyorsa (bazı HDMI/DP çıkışları desteklemez)
 * aktif uygulamanın kendi ses ayarına düşülür; o da yoksa null yayınlanır
 * ve panel ses kontrolünü gizler.
 */
import { appleScriptCommand, readMusic, readSpotify, type SourceSnapshot } from "./sources/applescript.js";
import { mediaRemoteCommand, readMediaRemote, type SystemSnapshot } from "./sources/mediaremote.js";
import { getSystemVolume, setSystemVolume } from "./volume.js";
import type { ClientCommand, WireMediaState, WireSource } from "./protocol.js";

type Snapshot = SourceSnapshot | SystemSnapshot;
/** Parça geçişinde kaynak birkaç sn boş dönebilir; son parça bu süre tutulur */
const TRACK_GRACE_MS = 10_000;
type VolumeMode = "system" | "spotify" | "music" | null;
/** Kısayol ve Claude komutları index.ts'te ele alınır, buraya ulaşmaz. */
type MediaCommand = Exclude<
  ClientCommand,
  { type: "run" | "claudeSubscribe" | "claudeFeed" | "mailSubscribe" }
>;

export class LiveAgent {
  private activeSource: WireSource = "system";
  private volumeMode: VolumeMode = null;
  /** Ses komutundan hemen sonra okunan bayat değer paneldeki iyimser değeri ezmesin */
  private volumeOverride: { value: number; until: number } | null = null;
  private lastPick: Snapshot | null = null;
  private lastPickAt = 0;

  async read(): Promise<WireMediaState> {
    // Üç katman da her turda okunur: duraklatılmış Spotify, çalan bir
    // tarayıcı sekmesini gölgelememeli — "çalan kazanır" ancak böyle işler.
    const [spotify, music, mediaRemote, systemVolume] = await Promise.all([
      readSpotify(),
      readMusic(),
      readMediaRemote(),
      getSystemVolume(),
    ]);

    const candidates: Snapshot[] = [spotify, music, mediaRemote].filter(
      (s): s is Snapshot => s !== null
    );

    let pick: Snapshot | null = candidates.find((c) => c.playing) ?? candidates[0] ?? null;
    if (pick) {
      this.lastPick = pick;
      this.lastPickAt = Date.now();
    } else if (this.lastPick && Date.now() - this.lastPickAt < TRACK_GRACE_MS) {
      // Yükleme boşluğu: son parçayı duraklatılmış gibi göster, kart kaybolmasın
      pick = { ...this.lastPick, playing: false };
    } else {
      this.lastPick = null;
    }
    this.activeSource = pick?.source ?? "system";

    let volume: number | null;
    const override = this.volumeOverride && this.volumeOverride.until > Date.now() ? this.volumeOverride : null;
    if (systemVolume !== null) {
      this.volumeMode = "system";
      volume = systemVolume;
    } else if (pick && (pick.source === "spotify" || pick.source === "music")) {
      this.volumeMode = pick.source;
      volume = (pick as SourceSnapshot).appVolume ?? null;
      if (volume === null) this.volumeMode = null;
    } else {
      this.volumeMode = null;
      volume = null;
    }

    if (override && volume !== null) volume = override.value;

    return {
      track: pick?.track ?? null,
      playing: pick?.playing ?? false,
      positionSec: pick?.positionSec ?? 0,
      volume,
      source: this.activeSource,
      outputDevice: null,
    };
  }

  async command(cmd: MediaCommand): Promise<void> {
    if (cmd.type === "setVolume") {
      const value = Math.max(0, Math.min(100, Math.round(cmd.value)));
      this.volumeOverride = { value, until: Date.now() + 2000 };
      if (this.volumeMode === "system") await setSystemVolume(cmd.value);
      else if (this.volumeMode === "spotify" || this.volumeMode === "music") {
        await appleScriptCommand(this.volumeMode, { appVolume: cmd.value });
      }
      return;
    }

    const src = this.activeSource;
    if (src === "spotify" || src === "music") {
      await appleScriptCommand(src, cmd.type === "seekTo" ? { seekTo: cmd.sec } : cmd.type);
      return;
    }
    // MediaRemote: media-control kuruluysa seek dahil hepsi çalışır
    await mediaRemoteCommand(cmd.type === "seekTo" ? { seekTo: cmd.sec } : cmd.type);
  }
}
