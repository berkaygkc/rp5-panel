import path from "node:path";
import { defineConfig } from "prisma/config";

// Veritabanı proje kökündeki .data/panel.db — yol mutlak, çalışma dizininden bağımsız
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: `file:${path.join(process.env.PANEL_DATA_DIR ? path.resolve(process.env.PANEL_DATA_DIR) : path.join(process.cwd(), ".data"), "panel.db")}`,
  },
});
