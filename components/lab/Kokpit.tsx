"use client";

import { useState } from "react";
import Deck from "@/components/kokpit/Deck";
import { APP_HUE, type AppId } from "@/components/kokpit/ids";
import Spine from "@/components/kokpit/Spine";
import type { Gear, LabModel } from "@/lib/kokpit/model";

/** Laboratuvar sarmalayıcısı: üretimdeki güverteyi karşılaştırma için gösterir */
export default function Kokpit({ model, gear }: { model: LabModel; gear: Gear }) {
  const [focus, setFocus] = useState<AppId | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  return (
    <div className={`k4-root g-${gear}`} style={{ ["--k4-hue" as string]: focus ? APP_HUE[focus] : "220 18% 55%" }}>
      <div className="k4-aurora" key={focus ?? "none"} aria-hidden />
      <div className="k4-stage">
        <Spine model={model} />
        <Deck
          model={model}
          focus={gear === "calm" ? null : focus}
          setFocus={setFocus}
          sub={sub}
          setSub={setSub}
        />
      </div>
    </div>
  );
}
