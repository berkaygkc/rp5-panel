import type { NextConfig } from "next";

/**
 * Geliştirme sunucusuna LAN'dan (Pi) erişim: Next 16 yalnızca listelenen
 * origin'lere /_next varlıklarını verir; joker yalnızca "*.alan" biçiminde
 * çalışır, "192.168.*" çalışmaz. Bu yüzden ev alt ağının tamamı açıkça
 * üretilir — Mac'in IP'si DHCP ile değişse de panel LAN'dan yüklenir.
 * Alt ağ PANEL_LAN_SUBNET ile seçilir (varsayılan 192.168.1). Pi için kalıcı
 * adres yine de Mac'in Bonjour adıdır: http://<mac-adı>.local:3012
 */
const subnet = (process.env.PANEL_LAN_SUBNET ?? "192.168.1").replace(/\.$/, "");
const homeSubnet = Array.from({ length: 253 }, (_, i) => `${subnet}.${i + 2}`);

const nextConfig: NextConfig = {
  // Kiosk ekranında geliştirme rozeti görünmesin
  devIndicators: false,
  allowedDevOrigins: [...homeSubnet, "*.local"],
  // better-sqlite3 yerel modül: sunucu paketine dahil edilmesin, Node require ile yüklensin
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3", "@prisma/client"],
};

export default nextConfig;
