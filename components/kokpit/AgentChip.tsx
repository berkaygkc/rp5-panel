"use client";

import { GitBranch } from "lucide-react";

/**
 * Alt ajan rozeti.
 *
 * Bir oturum arka planda alt ajan çalıştırdığında kendi dökümü büyümeyi
 * bırakır ve panel onu "durmuş" sanırdı. Bu rozet o anı temsil eder: iş
 * duruyor değil, dallanmış. Nabzı atar, çünkü o sırada gerçekten bir şey
 * çalışıyordur.
 */
export function AgentChip({
  count,
  label,
  small = false,
}: {
  count: number;
  /** Çağrının açıklaması — dokunmatik olmayan yüzeylerde ipucu olarak durur */
  label?: string | null;
  small?: boolean;
}) {
  if (count < 1) return null;
  return (
    <span className={`k4-agent ${small ? "sm" : ""}`} title={label ?? undefined} aria-label={`${count} alt ajan çalışıyor`}>
      <GitBranch size={small ? 9 : 11} strokeWidth={2.5} />
      {count > 1 && <b>{count}</b>}
    </span>
  );
}
