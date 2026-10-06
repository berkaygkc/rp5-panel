"use client";

/**
 * Alt ajan rozeti.
 *
 * Bir oturum arka planda alt ajan çalıştırdığında kendi dökümü büyümeyi
 * bırakır ve panel onu "durmuş" sanırdı. Bu rozet o anı temsil eder: iş
 * duruyor değil, dallanmış. Nabzı atar, çünkü o sırada gerçekten bir şey
 * çalışıyordur.
 *
 * Üstünde yalnızca çalışan alt ajan sayısı yazar. Şerit iki metre öteden
 * okunuyor; oraya sığan bir simge o uzaklıkta leke olmaktan öteye geçmiyordu,
 * rakam ise geçiyor.
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
    <span
      className={`k4-agent ${small ? "sm" : ""}`}
      title={label ?? undefined}
      aria-label={`${count} alt ajan çalışıyor`}
    >
      {count}
    </span>
  );
}
