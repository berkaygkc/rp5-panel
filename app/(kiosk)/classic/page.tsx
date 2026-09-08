import Shell from "@/components/shell/Shell";
import { ConfigProvider } from "@/lib/config/ConfigContext";

/**
 * Widget panosu ve raylı kabuk — Kokpit'ten önceki arayüz. Karşılaştırma ve
 * geri dönüş için duruyor; kiosk artık kökten Kokpit'i açar.
 */
export default function Classic() {
  return (
    <ConfigProvider>
      <Shell />
    </ConfigProvider>
  );
}
