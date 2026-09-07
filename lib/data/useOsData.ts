"use client";

import { useDomain } from "@/lib/data/core";
import { useChat } from "@/lib/data/useChat";
import { useClaude } from "@/lib/data/useClaude";
import { useInfra } from "@/lib/data/useInfra";
import { useMail } from "@/lib/data/useMail";
import { useMedia } from "@/lib/data/useMedia";
import { useNotices } from "@/lib/data/useNotices";
import { useNow } from "@/lib/data/useNow";
import { useWeather } from "@/lib/data/useWeather";
import type { OsData } from "@/lib/os/types";

const EMPTY_PRESENCE = { capabilities: [] as string[] };

/**
 * İşletim sisteminin tek veri görüntüsü.
 *
 * Kompozisyon motoru bu görüntüye bakarak neyin ne kadar önemli olduğuna karar
 * verir; widget'lar da aynı görüntüden okur. Tek yerde toplanması, panonun
 * kararlarının test edilebilir olmasını sağlar.
 */
export function useOsData(): OsData {
  const media = useMedia();
  const claude = useClaude({ feed: false });
  const mail = useMail();
  const chat = useChat();
  const infra = useInfra();
  const notices = useNotices();
  const weather = useWeather();
  const now = useNow(1000)?.getTime() ?? 0;
  const presence = useDomain<{ capabilities: string[] }>("presence", EMPTY_PRESENCE);

  return {
    now,
    media: media.data,
    claude: claude.data,
    mail: mail.data,
    chat: chat.data,
    infra: infra.data,
    notices: notices.notices,
    weather: weather.data,
    online: presence.data.capabilities,
  };
}
