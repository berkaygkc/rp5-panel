/* Seed: writes a starter configuration to the database (existing rows are left untouched). */
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const { PrismaClient } = require("../lib/generated/prisma");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = process.env.PANEL_DATA_DIR ? path.resolve(process.env.PANEL_DATA_DIR) : path.join(ROOT, ".data");
const env = Object.fromEntries(
  fs.existsSync(path.join(ROOT, ".env.local"))
    ? fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; })
    : []
);
fs.mkdirSync(DATA_DIR, { recursive: true });
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${path.join(DATA_DIR, "panel.db")}` }) });

const SETTINGS = {
  "pin.code": "1234",
  "lock.timeoutMs": 2 * 60 * 60 * 1000,
  "theme.default": "dark",
  "rail.defaultRecents": ["claude", "shortcuts"],
  "claude.waitNoticeMs": 3 * 60 * 1000,
  "mail.excludedAddresses": [],
  "mail.maxNoticesPerRefresh": 5,
  "mail.messageLimit": 80,
  "infra.diskWarnPct": 90,
  "infra.pollMs": 10_000,
  "beszel.url": env.BESZEL_URL || "http://localhost:8090",
  "beszel.email": env.BESZEL_EMAIL || "",
  "beszel.password": env.BESZEL_PASSWORD || "",
  "admin.setupDone": false,
};
const SCREENS = [
  { id: "overview", title: "Genel Bakış", tint: "var(--color-blue)", order: 0 },
  { id: "shortcuts", title: "Kısayollar", tint: "var(--color-orange)", order: 1 },
  { id: "claude", title: "Claude", tint: "var(--color-terracotta)", order: 2 },
  { id: "mail", title: "Posta", tint: "var(--color-indigo)", order: 3 },
  { id: "infra", title: "Altyapı", tint: "var(--color-teal)", order: 4 },
];
// Example shortcuts — edit them in the admin panel (/admin → Kısayollar)
const home = os.homedir();
const GROUPS = [
  { id: "projects", title: "Projeler", order: 0, items: [
    { id: "p-web", label: "web-app", sublabel: "VS Code'da aç", feedback: "web-app VS Code'da açıldı", kind: "project", path: path.join(home, "Projects", "web-app"), order: 0 },
    { id: "p-api", label: "api", sublabel: "VS Code'da aç", feedback: "api VS Code'da açıldı", kind: "project", path: path.join(home, "Projects", "api"), order: 1 },
  ]},
  { id: "servers", title: "Sunucular", order: 1, items: [
    { id: "s-prod", label: "Production", sublabel: "deploy@prod.example.com", feedback: "Production için Termius açıldı", kind: "ssh", host: "prod.example.com", port: 22, user: "deploy", order: 0 },
    { id: "s-staging", label: "Staging", sublabel: "staging.example.com:2222", feedback: "Staging için Terminal açıldı", kind: "ssh", host: "staging.example.com", port: 2222, user: "deploy", via: "terminal", order: 1 },
  ]},
];
const RULES = [
  { name: "CI başarısız", order: 0, field: "text", pattern: "run failed|build failed|pipeline failed|deploy failed|başarısız", setSeverity: "urgent", setKind: "ci" },
  { name: "alert@ kutusu", order: 1, field: "account", pattern: "^alert@", setSeverity: "attention" },
  { name: "Sistem hata postası", order: 2, field: "body", pattern: "hata|error|down|kesinti|outage", setSeverity: "attention" },
];

(async () => {
  let n = 0;
  for (const [key, value] of Object.entries(SETTINGS)) {
    const exists = await prisma.setting.findUnique({ where: { key } });
    if (!exists) { await prisma.setting.create({ data: { key, value: JSON.stringify(value) } }); n++; }
  }
  for (const s of SCREENS) if (!(await prisma.screen.findUnique({ where: { id: s.id } }))) { await prisma.screen.create({ data: s }); n++; }
  for (const g of GROUPS) {
    if (!(await prisma.shortcutGroup.findUnique({ where: { id: g.id } }))) {
      await prisma.shortcutGroup.create({ data: { id: g.id, title: g.title, order: g.order, items: { create: g.items } } }); n++;
    }
  }
  if ((await prisma.noticeRule.count()) === 0) { for (const r of RULES) { await prisma.noticeRule.create({ data: r }); n++; } }
  console.log(`seed: ${n} new rows`);
  console.log("settings:", await prisma.setting.count(), "| screens:", await prisma.screen.count(), "| groups:", await prisma.shortcutGroup.count(), "| shortcuts:", await prisma.shortcutItem.count(), "| rules:", await prisma.noticeRule.count());
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
