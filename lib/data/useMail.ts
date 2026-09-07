"use client";

import { useDomain } from "@/lib/data/core";
import type { MailState } from "@/lib/types/mail";

const EMPTY: MailState = {
  available: false,
  accounts: [],
  messages: [],
  updatedAt: 0,
  error: null,
};

/**
 * Spark Desktop posta kutusu. Sağlayıcı yerel SQLite'ı salt okunur sorgular ve
 * sonucu çekirdeğe yayınlar; yüzey yalnızca "mail" alanına abone olur.
 */
export function useMail(): { data: MailState; stale: boolean } {
  return useDomain<MailState>("mail", EMPTY);
}
