#!/bin/sh
# Konteyner açılışı: şema veritabanına uygulanır, sonra çekirdek başlar.
#
# `prisma db push` yinelenebilir — şema zaten uygunsa hiçbir şeye dokunmaz,
# değiştiyse günceller. Böylece imaj yükseltildiğinde elle adım kalmaz.
set -e

# Konteynerin içinde "localhost" konteynerin kendisidir. Mac'te (ya da host'ta)
# çalışan bir servise işaret eden adresler host.docker.internal'a çevrilir —
# aksi halde .env.local'daki adresler burada ECONNREFUSED verir.
for var in BESZEL_URL; do
  eval "value=\$$var"
  case "$value" in
    *localhost*|*127.0.0.1*)
      rewritten=$(printf '%s' "$value" | sed -e 's/localhost/host.docker.internal/g' -e 's/127\.0\.0\.1/host.docker.internal/g')
      export "$var=$rewritten"
      echo "[giriş] $var → $rewritten (host'a yönlendirildi)"
      ;;
  esac
done

echo "[giriş] şema uygulanıyor → $PANEL_DATA_DIR"
npx prisma db push 2>&1 | sed 's/^/[prisma] /'

# Veritabanı yeni oluştuysa varsayılanları tohumla (ekranlar, kısayollar…)
if [ ! -f "$PANEL_DATA_DIR/.seeded" ]; then
  if node prisma/seed.cjs 2>&1 | sed 's/^/[tohum] /'; then
    touch "$PANEL_DATA_DIR/.seeded"
  else
    echo "[tohum] atlandı (veri zaten var olabilir)"
  fi
fi

echo "[giriş] çekirdek başlıyor"
exec node server.mjs
