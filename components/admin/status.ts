/** Yönetim konsolunun canlı sağlık özeti (/api/admin/status) */
export interface AdminStatus {
  agent: boolean;
  beszel: boolean;
  infra: { configured: boolean; systems: number; down: number; error: string | null };
  chat: {
    chatwoot: { configured: boolean; error: string | null; items: number };
    mattermost: { configured: boolean; error: string | null; items: number };
    updatedAt: number;
  };
  notices: number;
  counts: { screens: number; shortcuts: number; rules: number };
  node: string;
  uptimeSec: number;
}
