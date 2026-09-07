"use client";

import { getCore, useCapability } from "@/lib/data/core";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaActions, MediaSource, MediaState, Track } from "@/lib/types/media";

/** Mac ajanı adresi (ör. ws://192.168.1.20:17705). Boşsa bağlantı kurulmaz, kart görünmez. */


/* ── Tel protokolü — clients/mac-agent/src/protocol.ts ile senkron tutun ── */
interface WireTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationSec: number;
  artworkUrl: string | null;
}
interface WireMediaState {
  track: WireTrack | null;
  playing: boolean;
  positionSec: number;
  volume: number | null;
  source: string;
  outputDevice: string | null;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Yerel (iyimser) değerin, ajan onayı gelene dek korunacağı süre */
const PENDING_MS = 2000;

interface Pending<T> {
  value: T;
  until: number;
}

/**
 * Oynatma konumu, state'i her karede güncellemeden hesaplanır:
 * son senkron noktası + o noktadan bu yana geçen süre.
 * Scrub bar bu fonksiyonu requestAnimationFrame içinde çağırır.
 */
export function playbackPosition(state: MediaState, nowMs = performance.now()): number {
  if (!state.track) return 0;
  const elapsed = state.playing ? (nowMs - state.positionAt) / 1000 : 0;
  return clamp(state.positionSec + elapsed, 0, state.track.durationSec);
}

/* Kapak görseli olmayan parçalar için deterministik gradyan çifti */
const ART_PALETTE: [string, string][] = [
  ["#2e3a68", "#8f5d8f"],
  ["#1f4d43", "#c4923f"],
  ["#26303c", "#5e7f99"],
  ["#4a2c3f", "#c46a5a"],
  ["#3b2d5c", "#7263c9"],
  ["#173f52", "#4fa3a5"],
];

function artColorsFor(id: string): [string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ART_PALETTE[Math.abs(h) % ART_PALETTE.length];
}

const KNOWN_SOURCES: MediaSource[] = ["spotify", "music", "browser", "mpv", "system"];

function trackFromWire(w: WireTrack): Track {
  return { ...w, artColors: artColorsFor(w.id) };
}

const EMPTY: MediaState = {
  track: null,
  playing: false,
  positionSec: 0,
  positionAt: 0,
  volume: null,
  source: "system",
  outputDevice: null,
};

export function useMedia(): {
  data: MediaState;
  stale: boolean;
  actions: MediaActions;
} {
  const [state, setState] = useState<MediaState>(EMPTY);
  // "Bayat" artık bağlantı değil, medya yeteneğini sunan bir cihazın olup olmadığıdır
  const stale = !useCapability("media");
  const stateRef = useRef(state);
  /* Anlık geri bildirim, onay sonra: ajanın bayat yayını yerel değeri ezmesin */
  const pendingVolume = useRef<Pending<number> | null>(null);
  const pendingPlaying = useRef<Pending<boolean> | null>(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /* ── Çekirdek aboneliği: "media" alanı ── */
  useEffect(() => {
    return getCore().watch("media", (payload) => {
      const w = payload as WireMediaState;
      const now = performance.now();
      // Bekleyen yerel değer: sağlayıcı aynı değeri onaylayana ya da süre dolana dek korunur
      const pv = pendingVolume.current;
      const keepVolume = pv !== null && now < pv.until && w.volume !== pv.value;
      if (pv && (w.volume === pv.value || now >= pv.until)) pendingVolume.current = null;
      const pp = pendingPlaying.current;
      const keepPlaying = pp !== null && now < pp.until && w.playing !== pp.value;
      if (pp && (w.playing === pp.value || now >= pp.until)) pendingPlaying.current = null;
      setState((s) => ({
        track: w.track ? trackFromWire(w.track) : null,
        playing: keepPlaying ? s.playing : w.playing,
        // Senkron noktasını kendi saatimizle damgala — makine saatleri
        // arasındaki kayma ağ gecikmesine (ihmal edilebilir) indirgenir
        positionSec: keepPlaying ? s.positionSec : w.positionSec,
        positionAt: keepPlaying ? s.positionAt : now,
        volume: keepVolume ? s.volume : w.volume,
        source: KNOWN_SOURCES.includes(w.source as MediaSource) ? (w.source as MediaSource) : "system",
        outputDevice: w.outputDevice,
      }));
    });
  }, []);

  /** Komut doğrudan cihaza değil, çekirdeğe niyet olarak gider */
  const send = useCallback((action: string, args?: Record<string, unknown>) => {
    void getCore().intent("media", action, args);
  }, []);

  /* Ses adımları art arda gelir; gönderimi hafifçe seyrelt */
  const volumeTimer = useRef<number | undefined>(undefined);
  const sendVolume = useCallback(
    (v: number) => {
      window.clearTimeout(volumeTimer.current);
      volumeTimer.current = window.setTimeout(() => send("setVolume", { value: v }), 120);
    },
    [send]
  );

  const applyVolume = useCallback(
    (value: number) => {
      stateRef.current = { ...stateRef.current, volume: value };
      setState((s) => ({ ...s, volume: value }));
      pendingVolume.current = { value, until: performance.now() + PENDING_MS };
      sendVolume(value);
    },
    [sendVolume]
  );

  const actions: MediaActions = {
    togglePlay: useCallback(() => {
      // Anlık geri bildirim: onay gelene dek (en fazla 2 sn) yerel değer korunur
      const next = !stateRef.current.playing;
      pendingPlaying.current = { value: next, until: performance.now() + PENDING_MS };
      setState((s) => ({
        ...s,
        playing: next,
        positionSec: playbackPosition(s),
        positionAt: performance.now(),
      }));
      send("togglePlay");
    }, [send]),

    next: useCallback(() => send("next"), [send]),

    prev: useCallback(() => {
      // 3 saniyeden sonra "önceki", parçanın başını hedefler
      if (playbackPosition(stateRef.current) > 3) {
        setState((s) => ({ ...s, positionSec: 0, positionAt: performance.now() }));
        send("seekTo", { sec: 0 });
        return;
      }
      send("prev");
    }, [send]),

    seekBy: useCallback(
      (deltaSec: number) => {
        const s = stateRef.current;
        if (!s.track) return;
        const target = clamp(playbackPosition(s) + deltaSec, 0, s.track.durationSec);
        setState((p) => ({ ...p, positionSec: target, positionAt: performance.now() }));
        send("seekTo", { sec: target });
      },
      [send]
    ),

    seekTo: useCallback(
      (sec: number) => {
        setState((s) =>
          s.track
            ? { ...s, positionSec: clamp(sec, 0, s.track.durationSec), positionAt: performance.now() }
            : s
        );
        send("seekTo", { sec });
      },
      [send]
    ),

    setVolume: useCallback((v: number) => applyVolume(Math.round(clamp(v, 0, 100))), [applyVolume]),

    adjustVolume: useCallback(
      (delta: number) => {
        const cur = stateRef.current.volume;
        if (cur === null) return;
        applyVolume(Math.round(clamp(cur + delta, 0, 100)));
      },
      [applyVolume]
    ),
  };

  return { data: state, stale, actions };
}
