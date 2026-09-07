import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "node:path";
import { PrismaClient } from "@/lib/generated/prisma";

/**
 * Tek PrismaClient — dev'de HMR boyunca globalThis üzerinde korunur.
 * Veritabanı: .data/panel.db (git dışı). Sürücü: better-sqlite3 (senkron, hızlı).
 */
/** Veri dizini: PANEL_DATA_DIR ya da proje kökündeki .data */
export const DATA_DIR = process.env.PANEL_DATA_DIR ? path.resolve(process.env.PANEL_DATA_DIR) : path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "panel.db");

const g = globalThis as unknown as { __rp5Prisma?: PrismaClient };

export function db(): PrismaClient {
  if (!g.__rp5Prisma) {
    const adapter = new PrismaBetterSqlite3({ url: `file:${DB_PATH}` });
    g.__rp5Prisma = new PrismaClient({ adapter });
  }
  return g.__rp5Prisma;
}
