/** Spark Desktop posta tipleri — clients/mac-agent/src/mail/spark.ts ile senkron. */

export interface MailAccount {
  pk: number;
  title: string;
  address: string | null;
  unread: number;
}

export interface MailMessage {
  pk: number;
  accountPk: number;
  fromName: string;
  fromAddress: string;
  subject: string;
  preview: string;
  /** ms */
  receivedAt: number;
  unseen: boolean;
  starred: boolean;
  attachments: number;
}

export interface MailState {
  available: boolean;
  accounts: MailAccount[];
  messages: MailMessage[];
  updatedAt: number;
  error: string | null;
}
