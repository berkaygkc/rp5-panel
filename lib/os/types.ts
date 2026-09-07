import type { ComponentType } from "react";
import type { RailIconProps } from "@/components/icons/RailIcons";
import type { ClaudeState } from "@/lib/types/claude";
import type { ChatState } from "@/lib/types/chat";
import type { InfraState } from "@/lib/types/infra";
import type { MailState } from "@/lib/types/mail";
import type { MediaState } from "@/lib/types/media";
import type { Notice } from "@/lib/notices/types";

/**
 * Widget sözleşmesi.
 *
 * Bu panel artık bir uygulama koleksiyonu değil, widget çalıştıran küçük bir
 * işletim sistemi. Uygulamalar kendi widget'larını bildirir; hangisinin nerede
 * ve ne büyüklükte duracağına kompozisyon motoru karar verir.
 */

/** Izgara hücresi cinsinden boyutlar. Her widget en az 1x1 uygulamak zorundadır. */
export type WidgetSize = "1x1" | "2x1" | "1x2" | "2x2" | "4x2";

export interface GridSize {
  cols: number;
  rows: number;
}

/** Ekran sınıfı — ızgara buradan türer, widget'lar aynı kalır */
export type SurfaceClass = "strip" | "desktop" | "tablet" | "phone";

/** Motorun karar verirken baktığı canlı veri */
export interface OsData {
  now: number;
  media: MediaState;
  claude: ClaudeState;
  mail: MailState;
  chat: ChatState;
  infra: InfraState;
  notices: Notice[];
  weather: WeatherState;
  /** Çekirdeğe bağlı sağlayıcıların sunduğu yetenekler */
  online: string[];
}

export interface WeatherState {
  available: boolean;
  place: string;
  tempC: number;
  feelsC: number;
  code: number;
  label: string;
  high: number;
  low: number;
  updatedAt: number;
  error: string | null;
}

export interface WidgetProps {
  size: WidgetSize;
  data: OsData;
}

export interface WidgetDef {
  /** "media.nowPlaying" gibi; uygulama kimliğiyle başlar */
  id: string;
  appId: string;
  title: string;
  /** Desteklenen boyutlar, büyükten küçüğe. Son eleman 1x1 olmalıdır. */
  sizes: WidgetSize[];
  /** Kullanıcının verdiği temel önem, 0..100 */
  priority: number;
  /**
   * Veriye bakarak 0..100 aciliyet üretir. 0 dönerse widget hiç yerleşmez —
   * "çalan yok" ise medya widget'ı yer kaplamaz.
   */
  urgency: (data: OsData) => number;
  /** Boşluk dolduran, veriye bağlı olmayan widget (saat, hava durumu) */
  filler?: boolean;
  component: ComponentType<WidgetProps>;
}

export interface AppDef {
  id: string;
  name: string;
  icon: ComponentType<RailIconProps>;
  tint: string;
  /** Tam ekran görünümü; widget'a dokununca buraya gidilir */
  screen?: ComponentType;
  widgets: WidgetDef[];
}

/** Veritabanından gelen, kullanıcının ayarladığı hâli */
export interface WidgetConfig {
  id: string;
  enabled: boolean;
  priority: number;
  /** İzin verilen boyutlar; boşsa widget'ın kendi listesi geçerli */
  sizes: WidgetSize[];
  /** Sabit yuva: verilirse motor buraya yerleştirir ve kimse devremez */
  pinned: { col: number; row: number; size: WidgetSize } | null;
}

export interface Placement {
  widgetId: string;
  size: WidgetSize;
  col: number;
  row: number;
  w: number;
  h: number;
  score: number;
  pinned: boolean;
}

export const SIZE_DIMS: Record<WidgetSize, { w: number; h: number }> = {
  "1x1": { w: 1, h: 1 },
  "2x1": { w: 2, h: 1 },
  "1x2": { w: 1, h: 2 },
  "2x2": { w: 2, h: 2 },
  "4x2": { w: 4, h: 2 },
};

export const sizeArea = (s: WidgetSize) => SIZE_DIMS[s].w * SIZE_DIMS[s].h;
