"use client";

import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import { useNow } from "@/lib/data/useNow";
import AmbientBackground from "./AmbientBackground";
import { TactileButton } from "@/components/ui/TactileButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

type Stage = "idle" | "error" | "success";

/** iOS telefon tuş takımı gibi: rakamın altında harf grubu */
const KEYS: { digit: string; letters: string }[] = [
  { digit: "1", letters: "" },
  { digit: "2", letters: "ABC" },
  { digit: "3", letters: "DEF" },
  { digit: "4", letters: "GHI" },
  { digit: "5", letters: "JKL" },
  { digit: "6", letters: "MNO" },
  { digit: "7", letters: "PQRS" },
  { digit: "8", letters: "TUV" },
  { digit: "9", letters: "WXYZ" },
];

/** Numpad tuşu: paylaşılan dokunsal düğme, tam boy */
function Key({ onPress, ariaLabel, children }: { onPress: () => void; ariaLabel?: string; children: React.ReactNode }) {
  return (
    <TactileButton onPress={onPress} ariaLabel={ariaLabel} className="h-full w-full flex-col rounded-[20px]">
      {children}
    </TactileButton>
  );
}

/**
 * Kilit ekranı: solda dev saat + PIN noktaları, sağda tam boy numpad.
 * Dokunma geri bildirimi üç katmanlı: tuş parlar + küçülür, dolan nokta
 * yaylanarak büyür, yanlış girişte noktalar kızarır ve sarsılır.
 */
export default function LockScreen({
  onUnlock,
  pending = 0,
}: {
  onUnlock: () => void;
  /** Kilitliyken bekleyen bildirim sayısı — içerik gösterilmez, yalnızca sayı */
  pending?: number;
}) {
  const [pin, setPin] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const now = useNow(1000);

  const press = (d: string) => {
    if (stage !== "idle" || pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length < 4) return;

    // PIN sunucuda doğrulanır (yönetim panelinden değiştirilebilir; kiosk JS'inde yoktur)
    void fetch("/api/unlock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin: next }),
    })
      .then((r) => r.json() as Promise<{ ok: boolean }>)
      .then((r) => {
        if (r.ok) {
          setStage("success");
          setTimeout(onUnlock, 420);
        } else {
          setStage("error");
          setTimeout(() => {
            setPin("");
            setStage("idle");
          }, 650);
        }
      })
      .catch(() => {
        setStage("error");
        setTimeout(() => {
          setPin("");
          setStage("idle");
        }, 650);
      });
  };

  const erase = () => {
    if (stage !== "idle") return;
    setPin((p) => p.slice(0, -1));
  };

  // Geliştirme kolaylığı: fiziksel klavyeden de girilebilir.
  // Dep dizisi yok: işleyici her render'da güncel pin/stage ile yeniden bağlanır.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      if (e.key === "Backspace") erase();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const dotStyle = (i: number) => {
    if (stage === "error") return { background: "var(--color-err)" };
    if (i < pin.length) {
      return {
        background: stage === "success" ? "var(--color-blue)" : "var(--color-ink)",
      };
    }
    return { background: "var(--color-raised)" };
  };

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-stretch overflow-hidden bg-night lg:flex-row"
      style={{
        transition: "opacity 450ms var(--ease-out-strong), transform 450ms var(--ease-out-strong)",
        ...(stage === "success"
          ? { opacity: 0, transform: "scale(1.04)", pointerEvents: "none" as const }
          : { opacity: 1, transform: "scale(1)" }),
      }}
    >
      <AmbientBackground />
      <ThemeToggle className="absolute right-6 top-5 z-10" />

      {/* Sol: kimlik bloğu — sola yaslı, aradaki boşluğu aurora doldurur */}
      <div className="relative flex flex-1 flex-col justify-center px-8 pt-10 lg:pl-24 lg:pr-0 lg:pt-0">
        <div className="text-[16px] font-medium text-dim">
          {now
            ? now.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })
            : " "}
        </div>
        <div className="mt-2 text-[76px] font-semibold leading-[0.86] tracking-[-0.05em] tabular-nums sm:text-[104px] lg:text-[124px]">
          {now
            ? now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
            : "--:--"}
        </div>

        {pending > 0 && (
          <div className="mt-3 flex items-center gap-2 text-[13px] font-medium text-dim">
            <span className="h-1.5 w-1.5 rounded-full bg-warn" />
            {pending} bildirim bekliyor
          </div>
        )}

        {/* Noktalar — yanlış girişte sarsılır, dolarken pop yapar */}
        <div className="mt-7 flex items-center gap-5 lg:mt-10">
          <div
            key={stage === "error" ? "shake" : "still"}
            className={`flex gap-4 ${stage === "error" ? "animate-pin-shake" : ""}`}
          >
            {[0, 1, 2, 3].map((i) => (
              <span
                key={`${i}-${i < pin.length}`}
                className={`h-3 w-3 rounded-full transition-colors duration-150 ${
                  i === pin.length - 1 && stage === "idle" ? "animate-dot-pop" : ""
                }`}
                style={dotStyle(i)}
              />
            ))}
          </div>
          <div className="text-[13px] font-medium text-faint">Kilidi açmak için PIN girin</div>
        </div>
      </div>

      {/* Sağ: tam boy numpad */}
      <div
        className="kiosk-lock-keys relative flex min-h-0 w-full flex-1 flex-col p-6 lg:w-[520px] lg:flex-none lg:py-6 lg:pl-10 lg:pr-14"
        style={{ borderLeft: "1px solid var(--hairline)" }}
      >
        <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-4 gap-2.5">
          {KEYS.map((k) => (
            <Key key={k.digit} onPress={() => press(k.digit)}>
              <span className="text-[30px] font-medium leading-none tabular-nums">
                {k.digit}
              </span>
              <span className="mt-1 h-[10px] text-[10px] font-semibold tracking-[0.18em] text-faint">
                {k.letters}
              </span>
            </Key>
          ))}
          <span />
          <Key onPress={() => press("0")}>
            <span className="text-[30px] font-medium leading-none tabular-nums">0</span>
            <span className="mt-1 h-[10px]" />
          </Key>
          <Key onPress={erase} ariaLabel="Sil">
            <Delete size={26} strokeWidth={2} className="text-dim" />
          </Key>
        </div>
      </div>
    </div>
  );
}
