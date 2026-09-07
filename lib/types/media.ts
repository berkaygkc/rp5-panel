export type MediaSource = "spotify" | "music" | "browser" | "mpv" | "system";

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationSec: number;
  /** Kapak görseli yoksa kullanılan, parça kimliğinden türeyen gradyan çifti */
  artColors: [string, string];
  /** Gerçek kapak görseli (Spotify URL'i veya MediaRemote data-URI'si) */
  artworkUrl?: string | null;
}

export interface MediaState {
  /** Hiçbir şey çalmıyorsa null */
  track: Track | null;
  playing: boolean;
  /** Son senkron noktasındaki konum (sn). Akıcı gösterim için positionAt ile birlikte kullanılır. */
  positionSec: number;
  /** positionSec'in alındığı an (performance.now() ms). */
  positionAt: number;
  /** 0–100; ses kontrolü mümkün değilse null (arayüz kontrolü devre dışı bırakır) */
  volume: number | null;
  source: MediaSource;
  outputDevice: string | null;
}

export interface MediaActions {
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seekBy: (deltaSec: number) => void;
  seekTo: (sec: number) => void;
  setVolume: (v: number) => void;
  /** Güncel değerden göreli adım — basılı tutmada her tekrar yeni değerden hesaplanır */
  adjustVolume: (delta: number) => void;
}
