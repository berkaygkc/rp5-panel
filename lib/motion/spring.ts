/**
 * El yazımı spring animasyonu — Apple'ın damping/response modeliyle.
 * Kütüphane yok: tek değer, rAF üzerinde yarı-örtük Euler entegrasyonu.
 * Mevcut değerden ve mevcut HIZDAN başlar; bu yüzden jest bırakıldığında
 * parmak hızı animasyona dikişsiz aktarılır ve her an kesilebilir.
 */
export interface SpringOptions {
  from: number;
  to: number;
  /** Başlangıç hızı (birim/sn) — jestin bırakma hızı buraya verilir. */
  velocity?: number;
  /** Hedefe yaklaşma süresi (sn). Süre değil; yerleşme süresi parametrelerden doğar. */
  response?: number;
  /** 1.0 = kritik sönümlü (taşma yok). <1 = hafif sekme. */
  dampingRatio?: number;
  onUpdate: (value: number) => void;
  onSettle?: (value: number) => void;
}

export interface SpringHandle {
  /** Animasyonu durdurur ve o anki değeri/hızı döner — kesinti için. */
  stop: () => { value: number; velocity: number };
}

export function springTo({
  from,
  to,
  velocity = 0,
  response = 0.38,
  dampingRatio = 1,
  onUpdate,
  onSettle,
}: SpringOptions): SpringHandle {
  const omega = (2 * Math.PI) / response;
  const stiffness = omega * omega;
  const damping = 2 * dampingRatio * omega;

  let value = from;
  let v = velocity;
  let raf = 0;
  let last = performance.now();

  const tick = (now: number) => {
    // Sekme kaçırmalarında patlamayı önle
    const dt = Math.min((now - last) / 1000, 0.032);
    last = now;

    const accel = stiffness * (to - value) - damping * v;
    v += accel * dt;
    value += v * dt;

    if (Math.abs(v) < 0.05 && Math.abs(to - value) < 0.05) {
      value = to;
      onUpdate(value);
      onSettle?.(value);
      return;
    }
    onUpdate(value);
    raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);

  return {
    stop: () => {
      cancelAnimationFrame(raf);
      return { value, velocity: v };
    },
  };
}

/**
 * Momentum projeksiyonu: bırakma hızından, hareketin doğal duruş noktasını kestirir.
 * Apple'ın Designing Fluid Interfaces örneğindeki üstel sönüm formülü.
 */
export function project(velocityPxPerSec: number, decelerationRate = 0.998): number {
  return ((velocityPxPerSec / 1000) * decelerationRate) / (1 - decelerationRate);
}

/**
 * Rubber-band: sınırın ötesine sürüklendikçe artan direnç.
 * Gerçek nesneler duvara çarpmaz, yavaşlayarak durur.
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
