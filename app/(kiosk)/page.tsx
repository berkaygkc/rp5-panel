import Shell from "@/components/shell/Shell";
import { ConfigProvider } from "@/lib/config/ConfigContext";

export default function Home() {
  return (
    <ConfigProvider>
      <Shell />
    </ConfigProvider>
  );
}
