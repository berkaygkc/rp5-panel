"use client";

import type { AppId } from "./ids";

/**
 * Panel başlığının arkasındaki imza görsel.
 *
 * Stok fotoğraf değil, her uygulamanın kendi konusundan türeyen bir çizim:
 * Claude'da ışıyan bir kıvılcım, altyapıda bağlı düğümler, postada üst üste
 * binmiş zarflar, sohbette baloncuklar, kısayollarda tuş takımı. Hepsi tek
 * renkten (uygulamanın `--hue` değeri) beslenir, bu yüzden güverte altı ayrı
 * resim değil tek bir görsel dil gibi okunur. Medyada gerçek albüm kapağı
 * kullanılır — orada zaten bir resim vardır.
 */
export default function PanelArt({ app, artwork }: { app: AppId; artwork?: string | null }) {
  if (app === "media" && artwork) {
    return (
      <span className="k4-hero" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- dış kaynak kapak */}
        <img className="k4-hero-img" src={artwork} alt="" />
        <span className="k4-hero-fade" />
      </span>
    );
  }
  return (
    <span className="k4-hero" aria-hidden>
      <svg viewBox="0 0 320 110" preserveAspectRatio="xMidYMid slice" className="k4-hero-svg">
        <defs>
          <linearGradient id={`g-${app}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--hue) / 0.55)" />
            <stop offset="100%" stopColor="hsl(var(--hue) / 0.05)" />
          </linearGradient>
        </defs>
        {app === "claude" && <Claude />}
        {app === "infra" && <Infra />}
        {app === "mail" && <Mail />}
        {app === "chat" && <Chat />}
        {app === "media" && <Media />}
        {app === "shortcuts" && <Shortcuts />}
      </svg>
      <span className="k4-hero-fade" />
    </span>
  );
}

const S = { stroke: "hsl(var(--hue) / 0.5)", fill: "none", strokeWidth: 1.2 } as const;

/** Kıvılcımdan yayılan halkalar — bir şey düşünüyor */
function Claude() {
  return (
    <g>
      {[26, 46, 66, 86, 106].map((r, i) => (
        <circle key={r} cx={252} cy={26} r={r} {...S} strokeOpacity={0.42 - i * 0.06} />
      ))}
      <g transform="translate(252 26)">
        {[0, 45, 90, 135].map((a) => (
          <line key={a} x1={-13} y1={0} x2={13} y2={0} transform={`rotate(${a})`} stroke="hsl(var(--hue))" strokeWidth={2.4} strokeLinecap="round" opacity={0.85} />
        ))}
      </g>
    </g>
  );
}

/** Birbirine bağlı düğümler — filo */
function Infra() {
  const nodes = [
    [214, 26],
    [252, 52],
    [290, 24],
    [232, 80],
    [286, 78],
  ] as const;
  return (
    <g>
      {nodes.map(([x, y], i) =>
        nodes.slice(i + 1).map(([x2, y2], j) => (
          <line key={`${i}-${j}`} x1={x} y1={y} x2={x2} y2={y2} {...S} strokeOpacity={0.22} />
        ))
      )}
      {nodes.map(([x, y], i) => (
        <rect key={i} x={x - 9} y={y - 6} width={18} height={12} rx={3} fill="url(#g-infra)" stroke="hsl(var(--hue) / 0.6)" strokeWidth={1} />
      ))}
    </g>
  );
}

/** Üst üste binmiş zarflar */
function Mail() {
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${210 + i * 26} ${16 + i * 16}) rotate(${-8 + i * 6})`}>
          <rect width={78} height={54} rx={7} fill="url(#g-mail)" stroke="hsl(var(--hue) / 0.55)" strokeWidth={1} />
          <path d="M0 8 L39 34 L78 8" {...S} strokeOpacity={0.6} />
        </g>
      ))}
    </g>
  );
}

/** Konuşma baloncukları */
function Chat() {
  return (
    <g>
      <path d="M196 20h72a12 12 0 0 1 12 12v26a12 12 0 0 1-12 12h-46l-16 14v-14h-10a12 12 0 0 1-12-12V32a12 12 0 0 1 12-12z" fill="url(#g-chat)" stroke="hsl(var(--hue) / 0.5)" strokeWidth={1} />
      <path d="M258 52h48a10 10 0 0 1 10 10v20a10 10 0 0 1-10 10h-30l-14 12V92h-4a10 10 0 0 1-10-10V62a10 10 0 0 1 10-10z" fill="url(#g-chat)" stroke="hsl(var(--hue) / 0.6)" strokeWidth={1} />
    </g>
  );
}

/** Plak ve dalga */
function Media() {
  return (
    <g>
      {[14, 26, 38, 50].map((r, i) => (
        <circle key={r} cx={264} cy={54} r={r} {...S} strokeOpacity={0.5 - i * 0.09} />
      ))}
      <circle cx={264} cy={54} r={5} fill="hsl(var(--hue) / 0.8)" />
      {/* Yükseklikler yuvarlanır: sunucu ve tarayıcı aynı ondalığı yazsın */}
      {Array.from({ length: 14 }).map((_, i) => {
        const h = Math.round(8 + 26 * Math.abs(Math.sin(i * 0.8)));
        return <rect key={i} x={186 + i * 6} y={54 - h / 2} width={2.4} height={h} rx={1.2} fill="hsl(var(--hue) / 0.4)" />;
      })}
    </g>
  );
}

/** Tuş takımı ve şimşek */
function Shortcuts() {
  return (
    <g>
      {Array.from({ length: 9 }).map((_, i) => (
        <rect
          key={i}
          x={216 + (i % 3) * 30}
          y={16 + Math.floor(i / 3) * 30}
          width={24}
          height={24}
          rx={6}
          fill="url(#g-shortcuts)"
          stroke="hsl(var(--hue) / 0.45)"
          strokeWidth={1}
        />
      ))}
      <path d="M268 12 L252 54 h16 l-8 40 26-48h-17l9-34z" fill="hsl(var(--hue) / 0.75)" />
    </g>
  );
}
