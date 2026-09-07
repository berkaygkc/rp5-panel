# RP5 çekirdeği. HTTP ve /ws aynı portu paylaşır; veritabanı bir birimde durur.
FROM node:20-slim AS deps
WORKDIR /app
# better-sqlite3 yerel derleme ister
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ openssl && rm -rf /var/lib/apt/lists/*
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
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /data && chown -R node:node /data
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/lib/generated ./lib/generated
COPY --from=build /app/prisma ./prisma
COPY package.json prisma.config.ts next.config.ts server.mjs ./
USER node
EXPOSE 3012
VOLUME ["/data"]
CMD ["node", "server.mjs"]
