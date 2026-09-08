export type ShortcutKind = "project" | "server";

/** Mac ajanının uygulayabildiği gerçek eylemler (clients/mac-agent/src/runner.ts) */
export type ShortcutRun =
  | { kind: "project"; path: string }
  | {
      kind: "ssh";
      host: string;
      port?: number;
      user?: string;
      /**
       * "termius" (varsayılan): ssh:// URL'i ile Termius açılır — Termius
       * kayıtlı kimliği dışarıdan kullanmaya izin vermez, kimlik seçtirir.
       * "terminal": Terminal.app'te `ssh` başlatılır — SSH anahtarı kuruluysa
       * hiçbir şey sormadan bağlanır (tam otomasyon).
       */
      via?: "termius" | "terminal";
    };

export interface ShortcutItem {
  id: string;
  label: string;
  sublabel?: string;
  /** Başarılı çalıştırma sonrası toast metni */
  feedback: string;
  /** Çekirdeğin saydığı son başarılı çalıştırma (ms) ve toplam sayı */
  lastRunAt?: number | null;
  runCount?: number;
  /** Mac ajanında çalışacak gerçek eylem */
  run: ShortcutRun;
}

export interface ShortcutGroup {
  id: string;
  title: string;
  items: ShortcutItem[];
}
