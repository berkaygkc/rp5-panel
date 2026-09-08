import LabHost from "@/components/lab/LabHost";
import { ConfigProvider } from "@/lib/config/ConfigContext";

/**
 * Tasarım laboratuvarı. Kiosk'a dokunmaz: aynı çekirdek verisini okur, aynı
 * cihazda çalışır, ama kabuğu, tipografisi ve paleti kendine aittir.
 */
export default function LabPage() {
  return (
    <ConfigProvider>
      <LabHost />
    </ConfigProvider>
  );
}
