# RP5 çekirdeği. HTTP ve /ws aynı portu paylaşır; veritabanı bir birimde durur.
#
# Ajan bu imajın içinde değildir ve olamaz: medya, kısayollar, posta ve Claude
# oturumları macOS'un AppleScript/MediaRemote arayüzlerinden okunur. Ajan Mac'te
# launchd ile çalışır (scripts/agent), çekirdeğe dışarıdan bağlanır.

FROM node:20-slim AS deps
WORKDIR /app
# better-sqlite3 yerel derleme ister
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ openssl \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

FROM node:20-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PANEL_DATA_DIR=/data
ENV PORT=3012
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /data && chown -R node:node /data
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/lib/generated ./lib/generated
COPY --from=build /app/prisma ./prisma
COPY package.json prisma.config.ts next.config.ts server.mjs ./
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
USER node
EXPOSE 3012
VOLUME ["/data"]

# Sağlık: çekirdek yapılandırmayı verebiliyorsa ayaktadır. Node 20'nin kendi
# fetch'i kullanılır, imaja curl eklemeye gerek yok.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3012)+'/api/config').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
