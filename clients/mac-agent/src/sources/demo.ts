/**
 * Demo kaynağı: gerçek uygulamalara dokunmadan uçtan uca test için
 * sentetik bir çalar. `npm run demo` ile etkinleşir.
 */
import type { ClientCommand, WireMediaState, WireTrack } from "../protocol.js";

const TRACKS: WireTrack[] = [
  { id: "d1", title: "Selective Hearing", artist: "Bonobo", album: "Fragments", durationSec: 254, artworkUrl: null },
  { id: "d2", title: "Kong", artist: "Bonobo", album: "Black Sands", durationSec: 297, artworkUrl: null },
  { id: "d3", title: "Openness", artist: "Kiasmos", album: "Blurred EP", durationSec: 341, artworkUrl: null },
];

export class DemoPlayer {
  private index = 0;
  private playing = true;
  private basePos = 30;
  private baseAt = Date.now();
  private volume = 55;

  private position(): number {
    const elapsed = this.playing ? (Date.now() - this.baseAt) / 1000 : 0;
    const dur = TRACKS[this.index].durationSec;
    const pos = this.basePos + elapsed;
    if (pos >= dur) {
      this.index = (this.index + 1) % TRACKS.length;
      this.basePos = 0;
      this.baseAt = Date.now();
      return 0;
    }
    return pos;
  }

  private sync(pos = this.position()) {
    this.basePos = pos;
    this.baseAt = Date.now();
  }

  state(): WireMediaState {
    return {
      track: TRACKS[this.index],
      playing: this.playing,
      positionSec: this.position(),
      volume: this.volume,
      source: "system",
      outputDevice: "Demo Çıkışı",
    };
  }

  command(cmd: ClientCommand) {
    switch (cmd.type) {
      case "togglePlay":
        this.sync();
        this.playing = !this.playing;
        break;
      case "next":
        this.index = (this.index + 1) % TRACKS.length;
        this.sync(0);
        break;
      case "prev":
        this.index = (this.index - 1 + TRACKS.length) % TRACKS.length;
        this.sync(0);
        break;
      case "seekTo":
        this.sync(Math.max(0, Math.min(TRACKS[this.index].durationSec, cmd.sec)));
        break;
      case "setVolume":
        this.volume = Math.max(0, Math.min(100, Math.round(cmd.value)));
        break;
    }
  }
}
