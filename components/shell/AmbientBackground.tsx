/**
 * Alan katmanı: nötr parıltılar çok yavaş süzülür (50-75 sn, yalnızca transform),
 * üstlerinde aktif ekranın kimlik rengiyle boyanmış geniş bir aurora durur.
 * Renk gezinmede bir kez değişir; sürekli hareket eden katman nötr kalır, böylece
 * Pi 5'te tek bir compositor işi olarak akar.
 */
export default function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="ambient-blob ambient-blob-1" />
      <div className="ambient-blob ambient-blob-2" />
      <div className="ambient-blob ambient-blob-3" />
      <div className="ambient-wash" />
    </div>
  );
}
