"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLabModel } from "./data";
import Ufuk from "./Ufuk";
import Pano from "./Pano";
import Konsol from "./Konsol";

export type LabDesign = "ufuk" | "pano" | "konsol";
export type Gear = "calm" | "work";

const DESIGNS: { id: LabDesign; key: string; name: string; sub: string }[] = [
  { id: "ufuk", key: "1", name: "Ufuk", sub: "tek çizgi, zaman ekseni" },
  { id: "pano", key: "2", name: "Pano", sub: "tek kuyruk, split-flap" },
  { id: "konsol", key: "3", name: "Konsol", sub: "işlenmiş ön panel" },
];

const STORE = "rp5-lab-design";
/** Bu kadar süre dokunulmazsa ve ortalık sakinse ekran sakin vitese düşer */
const CALM_AFTER_MS = 25_000;

export default function LabHost() {
  const model = useLabModel();
  const [design, setDesign] = useState<LabDesign>("ufuk");
  const [override, setOverride] = useState<Gear | null>(null);
  const [touchedAt, setTouchedAt] = useState(0);
  const [ready, setReady] = useState(false);
  const bootRef = useRef(false);

  // Açılışta: adresteki ?d= varsa o, yoksa en son seçilen
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    const q = new URLSearchParams(window.location.search).get("d") as LabDesign | null;
    let next: LabDesign | null = q && DESIGNS.some((d) => d.id === q) ? q : null;
    if (!next) {
      try {
        const saved = localStorage.getItem(STORE) as LabDesign | null;
        if (saved && DESIGNS.some((d) => d.id === saved)) next = saved;
      } catch {
        /* depolama kapalı */
      }
    }
    if (next) setDesign(next);
    // ?g=calm|work — vitesi sabitlemek için (ekran görüntüsü ve karşılaştırma)
    const g = new URLSearchParams(window.location.search).get("g");
    if (g === "calm" || g === "work") setOverride(g);
    setReady(true);
  }, []);

  const choose = useCallback((d: LabDesign) => {
    setDesign(d);
    setTouchedAt(Date.now());
    try {
      localStorage.setItem(STORE, d);
    } catch {
      /* depolama kapalı */
    }
  }, []);

  // Klavye: 1/2/3 yön değiştirir, boşluk vitesi zorlar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const hit = DESIGNS.find((d) => d.key === e.key);
      if (hit) choose(hit.id);
      if (e.code === "Space") {
        e.preventDefault();
        setOverride((o) => (o === "work" ? "calm" : o === "calm" ? null : "work"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose]);

  // Dokunuş vitesi çalışmaya alır; sonra kendi kendine sakinleşir
  useEffect(() => {
    const wake = () => setTouchedAt(Date.now());
    window.addEventListener("pointerdown", wake);
    return () => window.removeEventListener("pointerdown", wake);
  }, []);

  const busy = model.criticals > 0 || model.waiting > 0;
  const awake = model.os.now - touchedAt < CALM_AFTER_MS;
  const gear: Gear = override ?? (busy || awake ? "work" : "calm");

  if (!ready) return <div className="lab-boot" />;

  return (
    <div className={`lab-root d-${design} g-${gear}`}>
      {design === "ufuk" && <Ufuk model={model} gear={gear} />}
      {design === "pano" && <Pano model={model} gear={gear} />}
      {design === "konsol" && <Konsol model={model} gear={gear} />}

      {/* Seçici bilerek hiçbir tasarım diline ait değil: karşılaştırmayı bozmasın */}
      <nav className="lab-switch" aria-label="Tasarım yönü">
        {DESIGNS.map((d) => (
          <button
            key={d.id}
            onClick={() => choose(d.id)}
            className={d.id === design ? "on" : ""}
            title={d.sub}
          >
            <span className="k">{d.key}</span>
            {d.name}
          </button>
        ))}
        <span className="sep" />
        <button
          onClick={() => setOverride((o) => (o === "work" ? "calm" : o === "calm" ? null : "work"))}
          className="gear"
          title="Sakin / çalışma vitesi"
        >
          {override === null ? "oto" : override === "calm" ? "sakin" : "çalışma"}
        </button>
      </nav>
    </div>
  );
}
