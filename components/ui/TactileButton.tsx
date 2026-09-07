"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Dokunsal düğme — tam basış döngüsü:
 * parmak değince ANINDA küçülür ve parlar (pointer-down),
 * bırakılınca hafif taşmayla yaylanarak toparlanır (key-bounce),
 * hızlı art arda basışta yeni basış süren sekmeyi keser.
 * `onHold` verilirse basılı tutmak eylemi tekrarlar (ses/ileri-geri gibi).
 */
export function TactileButton({
  onPress,
  onHold,
  variant = "glass",
  disabled = false,
  ariaLabel,
  className = "",
  children,
}: {
  onPress: () => void;
  /** Basılı tutulunca tekrarlanacak eylem (400 ms sonra her 120 ms) */
  onHold?: () => void;
  variant?: "glass" | "solid";
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  const [pressed, setPressed] = useState(false);
  const [bouncing, setBouncing] = useState(false);
  const holdTimer = useRef<number | undefined>(undefined);
  const holdInterval = useRef<number | undefined>(undefined);
  const repeated = useRef(false);

  const stopHold = () => {
    window.clearTimeout(holdTimer.current);
    window.clearInterval(holdInterval.current);
  };
  useEffect(() => stopHold, []);

  const release = () => {
    stopHold();
    if (!pressed) return;
    setPressed(false);
    setBouncing(true);
  };

  const solid = variant === "solid";

  return (
    <button
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={() => {
        // Basılı tutma zaten adım attıysa bırakıştaki tıklama fazladan saymasın
        if (repeated.current) {
          repeated.current = false;
          return;
        }
        onPress();
      }}
      onPointerDown={() => {
        if (disabled) return;
        setBouncing(false);
        setPressed(true);
        repeated.current = false;
        if (onHold) {
          holdTimer.current = window.setTimeout(() => {
            holdInterval.current = window.setInterval(() => {
              repeated.current = true;
              onHold();
            }, 120);
          }, 400);
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onAnimationEnd={() => setBouncing(false)}
      className={`flex items-center justify-center disabled:opacity-40 ${
        bouncing ? "animate-key-bounce" : ""
      } ${className}`}
      style={{
        background: solid
          ? pressed
            ? "color-mix(in srgb, var(--color-ink) 78%, var(--color-night))"
            : "var(--color-ink)"
          : pressed
            ? "var(--color-pressed)"
            : "linear-gradient(180deg, var(--card-top), var(--card-bottom))",
        color: solid ? "var(--color-night)" : undefined,
        boxShadow: solid
          ? undefined
          : "inset 0 2px 0 var(--card-highlight), inset 0 0 0 1px var(--card-ring), var(--card-shadow)",
        transform: pressed ? "scale(0.93)" : undefined,
        transition:
          "transform 80ms var(--ease-out-strong), background-color 120ms var(--ease-out-strong)",
      }}
    >
      {children}
    </button>
  );
}
