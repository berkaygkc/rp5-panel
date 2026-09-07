"use client";

import { useCallback, useEffect, useRef } from "react";
import { SWIPE_THRESHOLD_RATIO } from "@/lib/config";
import { project, rubberband, springTo, type SpringHandle } from "@/lib/motion/spring";
import { useScreens } from "@/lib/config/ConfigContext";

interface Gesture {
  pointerId: number;
  startX: number;
  startY: number;
  /** İlk 12px hareketten sonra kilitlenir; dikeyse jest tamamen yok sayılır. */
  axis: "h" | "v" | null;
  /** Jest başladığı andaki track konumu */
  baseX: number;
  /** Hız hesabı için son hareket örnekleri */
  samples: { t: number; x: number }[];
}


/**
 * Ekranlar arası yatay kaydırma. Konum React state'i değil, doğrudan
 * transform ile sürülür; bırakınca parmak hızı spring'e devredilir,
 * momentum projeksiyonu hedef sayfayı seçer. Her an kesilebilir.
 */
export default function Pager({
  index,
  onIndexChange,
}: {
  index: number;
  onIndexChange: (i: number) => void;
}) {
  const SCREENS = useScreens();
  const viewportRef = useRef<HTMLDivElement>(null);
  /** Sayfa genişliği ölçülür, varsayılmaz: aynı kod şeritte de telefonda da çalışır */
  const pageW = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const xRef = useRef(0);
  const springRef = useRef<SpringHandle | null>(null);
  const targetRef = useRef(0);
  const gesture = useRef<Gesture | null>(null);
  const dragged = useRef(false);
  const reducedMotion = useRef(false);

  const setX = (x: number) => {
    xRef.current = x;
    if (trackRef.current) {
      trackRef.current.style.transform = `translate3d(${x}px, 0, 0)`;
    }
  };

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  /* Genişlik değişince (ekran döndü, pencere yeniden boyutlandı) konum korunur */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w < 1) return;
      pageW.current = w;
      // Ölçü değiştiyse mevcut sayfayı yeniden hizala
      const target = -index * w;
      targetRef.current = target;
      setX(target);
    };
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, [SCREENS.length, index]);

  const animateTo = useCallback((target: number, velocity = 0) => {
    const prev = springRef.current?.stop();
    targetRef.current = target;
    springRef.current = springTo({
      from: prev?.value ?? xRef.current,
      velocity: velocity || prev?.velocity || 0,
      to: target,
      response: reducedMotion.current ? 0.15 : 0.38,
      dampingRatio: 1,
      onUpdate: setX,
      onSettle: () => (springRef.current = null),
    });
  }, []);

  // Dış kaynaklı index değişimi (rail, klavye): mevcut konumdan spring'le git
  useEffect(() => {
    const target = -index * pageW.current;
    if (target !== targetRef.current) animateTo(target);
  }, [index, animateTo]);

  useEffect(() => () => void springRef.current?.stop(), []);

  const onPointerDown = (e: React.PointerEvent) => {
    // Scrub bar gibi kendi sürüklemesini yöneten öğeler swipe başlatmaz
    if ((e.target as HTMLElement).closest("[data-no-swipe]")) return;
    // Uçuştaki animasyonu yakala — kesinti, beklemek değil
    const prev = springRef.current?.stop();
    springRef.current = null;
    if (prev) xRef.current = prev.value;
    gesture.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      axis: null,
      baseX: xRef.current,
      samples: [{ t: e.timeStamp, x: e.clientX }],
    };
    dragged.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || e.pointerId !== g.pointerId) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;

    if (g.axis === null) {
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      g.axis = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      if (g.axis === "h") {
        dragged.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
    }
    if (g.axis !== "h") return; // dikey hareket tamamen yok sayılır

    g.samples.push({ t: e.timeStamp, x: e.clientX });
    if (g.samples.length > 5) g.samples.shift();

    // 1:1 takip + kenarlarda rubber-band
    const w = pageW.current || 1;
    const minX = -(SCREENS.length - 1) * w;
    let x = g.baseX + dx;
    if (x > 0) x = rubberband(x, w);
    else if (x < minX) x = minX + rubberband(x - minX, w);
    setX(x);
  };

  const endGesture = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || e.pointerId !== g.pointerId) return;
    gesture.current = null;
    // Bırakma sonrası tıklamayı yutan bayrak, click akışından SONRA temizlenir
    setTimeout(() => (dragged.current = false), 0);
    if (g.axis !== "h") return;

    // Bırakma hızı (px/sn) — son örneklerden
    const first = g.samples[0];
    const last = g.samples[g.samples.length - 1];
    const dt = last.t - first.t;
    const velocity = dt > 0 ? ((last.x - first.x) / dt) * 1000 : 0;

    // Momentum projeksiyonu hedef sayfayı seçer; tek jest en fazla bir sayfa atlar
    const w = pageW.current || 1;
    const projected = xRef.current + project(velocity);
    let target = Math.round(-projected / w);
    target = Math.max(index - 1, Math.min(index + 1, target));
    target = Math.max(0, Math.min(SCREENS.length - 1, target));

    // Projeksiyon yerinde sayıyorsa eşik kuralı: %20'den uzun sürükleme sayfa değiştirir
    const dx = e.clientX - g.startX;
    if (target === index && Math.abs(dx) > w * SWIPE_THRESHOLD_RATIO) {
      target = Math.max(0, Math.min(SCREENS.length - 1, index + (dx < 0 ? 1 : -1)));
    }

    animateTo(-target * w, velocity);
    if (target !== index) onIndexChange(target);
  };

  // Sürükleme sonrası bırakma anındaki tıklamayı yut
  const onClickCapture = (e: React.MouseEvent) => {
    if (dragged.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div
      ref={viewportRef}
      className="relative h-full flex-1 overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onClickCapture={onClickCapture}
    >
      {/* transform'un tek sahibi ref'tir (spring/jest yazar) — React prop'u
          index değişiminde üzerine yazıp kare atlatmasın diye buraya konmaz.
          İlk render'da index 0 olduğundan başlangıç konumu zaten doğrudur. */}
      <div ref={trackRef} className="flex h-full w-full will-change-transform">
        {SCREENS.map((s) => (
          <div key={s.id} className="h-full w-full shrink-0">
            <s.component />
          </div>
        ))}
      </div>
    </div>
  );
}
