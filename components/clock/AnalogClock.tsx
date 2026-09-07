"use client";

import { useEffect, useId, useRef } from "react";

/**
 * Genel Bakış'ın imza öğesi — yüksek saatçilik kadranı:
 * güneş patlaması (sunburst) zemin, chemin-de-fer dakika halkası,
 * metalik aplike endeksler, faturalı dauphine ibreler, mavi çelik saniye.
 *
 * Performans: kadran ve ibreler AYRI SVG katmanlarıdır — statik kadran bir kez
 * rasterize edilir, her karede yalnızca ibre katmanı yeniden çizilir (Pi 5 dostu).
 * İbreler rAF içinde doğrudan attribute ile döndürülür; React render'ı yoktur.
 */
export default function AnalogClock({
  size = 280,
  tint = "var(--color-blue)",
}: {
  size?: number;
  tint?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const hourRef = useRef<SVGGElement>(null);
  const minuteRef = useRef<SVGGElement>(null);
  const secondRef = useRef<SVGGElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = new Date();
      const s = now.getSeconds() + now.getMilliseconds() / 1000;
      const m = now.getMinutes() + s / 60;
      const h = (now.getHours() % 12) + m / 60;
      secondRef.current?.setAttribute("transform", `rotate(${s * 6} 100 100)`);
      minuteRef.current?.setAttribute("transform", `rotate(${m * 6} 100 100)`);
      hourRef.current?.setAttribute("transform", `rotate(${h * 30} 100 100)`);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const id = (name: string) => `${uid}-${name}`;

  return (
    // maxHeight: alan daralınca kadran orantılı küçülür (SVG letterbox)
    <div className="relative shrink-0" style={{ width: size, height: size, maxHeight: "100%", maxWidth: "100%" }}>
      {/* Katman 1: statik kadran */}
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id={id("bezel")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--dial-bezel-a)" />
            <stop offset="45%" stopColor="var(--dial-bezel-b)" />
            <stop offset="100%" stopColor="var(--dial-bezel-c)" />
          </linearGradient>
          <radialGradient id={id("dial")} cx="50%" cy="40%" r="78%">
            <stop offset="0%" stopColor="var(--dial-face-a)" />
            <stop offset="55%" stopColor="var(--dial-face-b)" />
            <stop offset="100%" stopColor="var(--dial-face-c)" />
          </radialGradient>
          <linearGradient id={id("baton")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--baton-a)" />
            <stop offset="45%" stopColor="var(--baton-b)" />
            <stop offset="55%" stopColor="var(--baton-c)" />
            <stop offset="100%" stopColor="var(--baton-d)" />
          </linearGradient>
        </defs>

        {/* Kasa ve bezel */}
        <circle cx={100} cy={100} r={99} fill={`url(#${id("bezel")})`} />
        <circle cx={100} cy={100} r={95.5} fill="var(--dial-gap)" />
        <circle cx={100} cy={100} r={93.5} fill={`url(#${id("dial")})`} />

        {/* Güneş patlaması zemin dokusu */}
        <g stroke="var(--dial-ray)" strokeWidth={0.7}>
          {Array.from({ length: 72 }, (_, i) => (
            <line
              key={i}
              x1={100}
              y1={16}
              x2={100}
              y2={92}
              transform={`rotate(${i * 5} 100 100)`}
            />
          ))}
        </g>

        {/* Rehaut halkası */}
        <circle cx={100} cy={100} r={85} fill="none" stroke="var(--dial-rehaut)" strokeWidth={1} />

        {/* Chemin de fer dakika halkası */}
        {Array.from({ length: 60 }, (_, i) => {
          const five = i % 5 === 0;
          return (
            <line
              key={i}
              x1={100}
              y1={7.5}
              x2={100}
              y2={five ? 13 : 10.8}
              stroke={five ? "var(--dial-tick-major)" : "var(--dial-tick)"}
              strokeWidth={five ? 1.7 : 0.8}
              strokeLinecap="round"
              transform={`rotate(${i * 6} 100 100)`}
            />
          );
        })}

        {/* Aplike metalik endeksler — 12'de çift baton */}
        {Array.from({ length: 12 }, (_, i) =>
          i === 0 ? (
            <g key={i}>
              <rect x={95.7} y={15} width={2.9} height={11.5} rx={1.1} fill={`url(#${id("baton")})`} />
              <rect x={101.4} y={15} width={2.9} height={11.5} rx={1.1} fill={`url(#${id("baton")})`} />
            </g>
          ) : (
            <rect
              key={i}
              x={98.55}
              y={15}
              width={2.9}
              height={11.5}
              rx={1.1}
              fill={`url(#${id("baton")})`}
              transform={`rotate(${i * 30} 100 100)`}
            />
          )
        )}

        {/* Marka ve yıl — manufaktür detayı */}
        <text
          x={100}
          y={52}
          textAnchor="middle"
          fontSize={7}
          fontWeight={600}
          letterSpacing={3}
          fill="var(--dial-text)"
          style={{ fontFamily: "var(--font-clock)" }}
        >
          RP5
        </text>
        <text
          x={100}
          y={162}
          textAnchor="middle"
          fontSize={4.6}
          fontWeight={500}
          letterSpacing={2.2}
          fill="var(--dial-text-faint)"
          style={{ fontFamily: "var(--font-clock)" }}
        >
          1973
        </text>
      </svg>

      {/* Katman 2: ibreler — her karede yalnızca bu katman çizilir */}
      <svg
        viewBox="0 0 200 200"
        className="absolute inset-0 h-full w-full"
        style={{ willChange: "transform", transform: "translateZ(0)" }}
        aria-hidden
      >
        <defs>
          <linearGradient id={id("hand-l")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--hand-l-a)" />
            <stop offset="100%" stopColor="var(--hand-l-b)" />
          </linearGradient>
          <linearGradient id={id("hand-r")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--hand-r-a)" />
            <stop offset="100%" stopColor="var(--hand-r-b)" />
          </linearGradient>
          <radialGradient id={id("cap")} cx="35%" cy="35%" r="80%">
            <stop offset="0%" stopColor="var(--cap-a)" />
            <stop offset="55%" stopColor="var(--cap-b)" />
            <stop offset="100%" stopColor="var(--cap-c)" />
          </radialGradient>
        </defs>

        {/* Akrep — faturalı dauphine: sol yüz aydınlık, sağ yüz gölgede */}
        <g ref={hourRef}>
          <polygon points="100,46 96.4,101 100,106" fill={`url(#${id("hand-l")})`} />
          <polygon points="100,46 103.6,101 100,106" fill={`url(#${id("hand-r")})`} />
        </g>

        {/* Yelkovan */}
        <g ref={minuteRef}>
          <polygon points="100,19 97.2,101 100,106" fill={`url(#${id("hand-l")})`} />
          <polygon points="100,19 102.8,101 100,106" fill={`url(#${id("hand-r")})`} />
        </g>

        {/* Saniye — mavi çelik, karşı ağırlıklı */}
        <g ref={secondRef}>
          <line x1={100} y1={114} x2={100} y2={11.5} stroke={tint} strokeWidth={1.3} strokeLinecap="round" />
          <circle cx={100} cy={114} r={3.4} fill={tint} />
        </g>

        {/* Cilalı merkez kapak */}
        <circle cx={100} cy={100} r={4.8} fill={`url(#${id("cap")})`} />
        <circle cx={100} cy={100} r={1.5} fill="var(--cap-hole)" />
      </svg>
    </div>
  );
}
