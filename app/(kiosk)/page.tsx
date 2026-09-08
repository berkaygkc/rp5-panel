import KokpitShell from "@/components/kokpit/KokpitShell";
import { ConfigProvider } from "@/lib/config/ConfigContext";

export default function Home() {
  return (
    <ConfigProvider>
      <KokpitShell />
    </ConfigProvider>
  );
}
