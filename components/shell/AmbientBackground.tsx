/**
 * Hafif hareketli gece zemini: üç büyük radyal parıltı, çok yavaş (50-75 sn)
 * transform döngüleriyle süzülür. Yalnızca transform animasyonu — compositor
 * katmanında çalışır, Pi 5'te kare düşürmez. prefers-reduced-motion'da durur.
 */
export default function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="ambient-blob ambient-blob-1" />
      <div className="ambient-blob ambient-blob-2" />
      <div className="ambient-blob ambient-blob-3" />
    </div>
  );
}
