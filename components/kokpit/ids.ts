/** Güvertedeki uygulamalar — kimlik, ad ve renk tek yerde */
export type AppId = "claude" | "infra" | "mail" | "chat" | "media" | "shortcuts";

export const APP_IDS: AppId[] = ["claude", "infra", "mail", "chat", "media", "shortcuts"];

export const APP_HUE: Record<AppId, string> = {
  claude: "22 92% 62%",
  infra: "190 95% 55%",
  mail: "248 90% 68%",
  chat: "150 75% 50%",
  media: "330 85% 62%",
  shortcuts: "38 96% 58%",
};

export const APP_NAME: Record<AppId, string> = {
  claude: "Claude",
  infra: "Altyapı",
  mail: "Posta",
  chat: "Sohbet",
  media: "Medya",
  shortcuts: "Kısayollar",
};

/** Plan limiti rengi: %85 üstü kırmızı, %60 üstü kehribar, altı uygulamanın rengi */
export const limitColor = (p: number) =>
  p >= 85 ? "var(--k4-red)" : p >= 60 ? "var(--k4-amber)" : "hsl(var(--hue))";
