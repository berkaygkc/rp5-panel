Bir Next.js uygulaması geliştireceğiz. Bu bir **UI prototipi** — hiçbir canlı veri, API entegrasyonu veya gerçek cihaz kontrolü olmayacak. Tüm veri mock. Amaç, tasarımın gerçek donanımda nasıl göründüğünü değerlendirmek.

## Hedef donanım

Bu uygulama masaüstünde değil, çok sıra dışı bir ekranda çalışacak:

- Fiziksel panel: 11.9 inç, 1480×320 piksel, yatay şerit
- CSS viewport: **1973 × 426 piksel, sabit**
- devicePixelRatio: **0.75**
- Kapasitif dokunmatik, klavye ve fare yok
- Ekranın fiziksel köşeleri oval — köşelere kritik içerik veya dokunma hedefi koyma, dış kenarlarda 16px güvenlik payı bırak

Bu ölçü çok geniş ve çok kısa. 426 piksel yükseklik gerçekten az; her ekranı bu kısıta göre tasarla, dikey kaydırma kullanma.

## Teknik kısıtlar

- Responsive tasarım **yapma**. Tek hedef cihaz var, viewport sabit. Breakpoint, media query, akışkan grid yok. `1973×426` için tasarla, gerisini düşünme.
- Geliştirme sırasında tarayıcıda doğru boyutu görebilmem için `app/layout.tsx`'te body'yi `width: 1973px; height: 426px; overflow: hidden` olarak sabitle.
- DPR 0.75 olduğu için 1px'lik hairline border'lar sub-pixel'e düşüp bulanıklaşıyor. Border'ları 2px kullan veya border yerine arka plan tonu farkıyla ayır. 300 ve altı font ağırlıklarından kaçın; 400–600 arası kullan.
- Dokunma hedefleri minimum 48×48 CSS px. Hover state'lerine güvenme — dokunmatik ekranda hover yok. Bunun yerine `:active` ile anlık, belirgin görsel geri bildirim ver.
- Animasyonları minimumda tut. Bu Raspberry Pi 5'in Chromium'unda çalışacak; ağır blur, çoklu shadow, sürekli dönen animasyonlar kare düşürür. Sadece `transform` ve `opacity` animasyonu kullan.

## Stack

- Next.js (App Router), TypeScript, Tailwind CSS
- Dev server portu **3012**
- İkon kütüphanesi kullanabilirsin (lucide-react önerilir)
- Ağır UI kütüphanesi kurma, bileşenleri kendin yaz
- State için React hook'ları yeterli, global state kütüphanesi gerekmiyor

## Mimari — bu kısım önemli

Bu prototip ileride gerçek verilerle çalışan bir sisteme dönüşecek. O geçişin kolay olması için:

**1. Mock veri katmanını tamamen izole et.** `lib/mock/` altında her veri alanı için ayrı dosya. Bileşenler mock'lardan doğrudan import etmesin; `lib/data/` altında hook'lar üzerinden erişsin:

```ts
// lib/data/useInfra.ts
export function useInfra(): { data: InfraState; stale: boolean } { ... }
```

İleride bu hook'ların içi WebSocket'e bağlanacak, bileşenler hiç değişmeyecek. Tip tanımları `lib/types/` altında ayrı dursun.

**2. Mock veriyi canlandır.** Statik JSON sıkıcı ve gerçek görünmüyor. Sayısal değerler birkaç saniyede bir küçük miktarda dalgalansın, sparkline'lar kaysın, saat işlesin, medya çalar ilerlesin. Bunun için ortak bir `useSimulatedValue(base, variance, intervalMs)` hook'u yaz.

**3. Kartlar layout-agnostic olsun.** Her kart kendi genişliğini varsaymasın, parent'tan gelen alanı doldursun. İleride mobil bir layout ekleneceği için bu disiplin baştan kurulmalı.

## Ekran yapısı

Yatay olarak yan yana dizilmiş, birbirleri arasında geçiş yapılan ekranlar. Toplam 6 ekran:

### 1. Genel Bakış (ana ekran)

Sağ veya sol köşede **analog saat** — bu ekranın imza öğesi olacak, çok şık olmalı:
- SVG ile çiz, yaklaşık 200px çapında
- Saniye ibresi `requestAnimationFrame` ile akıcı hareket etsin (saniyede bir zıplama değil, sürekli akış)
- İnce, zarif ibreler; minimal kadran (12 saat işareti, rakam yok veya sadece 12/3/6/9)
- Altında dijital olarak tarih ve gün adı

Ekranın geri kalanında:
- Hava durumu (sıcaklık, durum ikonu, hissedilen, gün içi min/max)
- O günün takvim özeti — sıradaki 2-3 etkinlik, saatleriyle
- Sistem sağlığı özeti: kaç servis çalışıyor, kritik uyarı var mı — tek bakışta anlaşılan bir gösterge
- Küçük bir "bugün" metriği: işlenen belge sayısı gibi tek büyük rakam

### 2. Altyapı

Prod servislerin durumu:
- 6-8 servisin sağlık durumu (yeşil/sarı/kırmızı) — isim, uptime, p95 latency
- Kuyruk derinliği: birkaç kuyruk, mevcut değer + son 30 dakikanın sparkline'ı
- Hata oranı grafiği (son 1 saat)
- Aktif worker sayısı

Sparkline'ları hafif kütüphane veya doğrudan SVG ile çiz.

### 3. Medya

Mac'te çalan müziğin kontrolü (mock):
- Albüm kapağı (placeholder görsel veya renk bloğu)
- Parça adı, sanatçı, albüm
- **Scrub bar** — dokunarak sürüklenebilir, ilerlemeyi `requestAnimationFrame` ile akıcı göster (saniyede bir zıplamasın). Sürüklerken optimistic olarak parmağı takip etsin.
- Görsel bar ince olsun ama dokunma alanı 56px yüksekliğinde olsun
- ±10sn / ±30sn butonları, önceki/oynat-durdur/sonraki
- Ses seviyesi kontrolü
- Kaynak göstergesi (Spotify / tarayıcı / mpv gibi)

### 4. Kısayollar

Dokunmatik buton ızgarası, 3 gruba ayrılmış:
- **Projeler** — dokununca "VSCode'da aç" (6-8 proje adı)
- **Sunucular** — dokununca "SSH bağlan" (5-6 sunucu, yanında durum noktası)
- **Eylemler** — sistem kısayolları (Toplantı modu, Odak modu, Ekran kilidi, Uyku vb.)

Dokununca gerçek bir şey olmayacak ama görsel geri bildirim ver: buton kısa süre "çalıştırılıyor" durumuna geçsin, sonra bir toast göstersin.

### 5. Maliyet

Cloud harcama takibi:
- Bu ayki toplam harcama, geçen aya göre değişim
- Sağlayıcı bazında dağılım (4-5 sağlayıcı, bar veya liste)
- Aylık trend grafiği (son 6 ay)
- Yaklaşan fatura tarihleri
- Bütçe eşiğine ne kadar kalmış göstergesi

### 6. Yedekleme

- 5-6 yedekleme işi: adı, son çalışma zamanı, boyut, durum
- Sonraki çalışma zamanına geri sayım
- Son restore testi tarihi ve sonucu
- Toplam yedek boyutu ve depolama kullanımı

## Navigasyon

- Ekranlar arası **yatay swipe** ile geçiş. Swipe eşiği ekran genişliğinin %20'si, altında kalırsa geri yaylansın.
- Dikey swipe'ı tamamen yoksay — 426px yükseklikte kazara tetiklenmesi çok kolay.
- Alt kenarda ince bir gösterge: aktif ekranı gösteren noktalar veya kısa çizgiler, yanında ekran adı.
- Geçiş animasyonu yatay kayma, 250ms civarı, `transform: translateX` ile.
- Geliştirme kolaylığı için sol/sağ ok tuşlarıyla da geçiş çalışsın.

## PIN kilidi

Uygulama açılışında PIN ekranı gelsin:
- Ortada büyük, dokunmatik için rahat bir sayısal tuş takımı (0-9, sil)
- 4 haneli PIN, girilen hane sayısını gösteren noktalar
- Doğru PIN: `1234` (mock, sabit)
- Yanlış PIN'de kısa bir titreşim animasyonu ve noktaların kırmızıya dönmesi
- Başarılı girişte panele yumuşak geçiş
- 5 dakika dokunulmazsa tekrar kilitlensin (test için bu süreyi ayarlanabilir bir sabit yap)
- Kilit ekranında da saat görünsün — ama küçük ve köşede, dijital

## Tasarım yönü

Koyu tema. Bu ekran masada, monitörün altında, akşamları da açık duracak — parlak beyaz bir arayüz rahatsız eder.

- Arka plan neredeyse siyah ama tam siyah değil (koyu nötr bir ton)
- Yüzeyler arka plandan çok az açık; sınırları border yerine bu ton farkıyla belirt
- Tek bir vurgu rengi seç ve tutarlı kullan. Durum renkleri (yeşil/sarı/kırmızı) ayrı, ve sadece durum için.
- Tipografi hiyerarşisi net olsun: büyük rakamlar gerçekten büyük (48-72px), etiketler küçük ve sönük
- Sayısal veriler için tabular-nums kullan, değer değişince yerinden oynamasın
- Sayılar ve teknik değerler monospace, metin sans-serif — bu kontrast şıklık katar
- Dekoratif öğe ekleme, boşluk bırak. 426 piksellik bir şeridi doldurmaya çalışma; nefes alan bir tasarım kalabalık olandan iyi görünür.

Estetik konusunda kendi yargını kullan, yukarıdakiler kısıt değil yön.

## Çıktı beklentisi

- `npm run dev` ile çalışır durumda (port 3012, package.json'e gömülü)
- Altı ekranın hepsi dolu, gerçekçi mock verilerle
- Türkçe arayüz metinleri
- Kod okunabilir ve genişletilebilir — sonradan yeni ekran eklemek tek dosya + rota kaydı olmalı
- `README.md`'de: nasıl çalıştırılır, ekranlar arası nasıl geçilir, yeni ekran nasıl eklenir, mock veri nerede

Önce proje yapısını ve ekran mimarisini kur, sonra ekranları tek tek doldur. Her ekranı bitirdiğinde kısaca ne yaptığını söyle, ben tarayıcıda bakıp geri bildirim vereyim.
## Yönetim paneli ve veritabanı

- `/admin`: bilgisayardan erişilen tek yöneticili panel; ilk açılışta parola kurulumu, sonra 7 günlük oturum.
- Tüm yapılandırma SQLite'ta (`.data/panel.db`, Prisma): ekranlar, kısayol grupları/öğeleri, bildirim kuralları, Beszel sistem görünümleri, anahtar-değer ayarlar (PIN, kilit süresi, tema, rail yuvaları, Claude bekleme eşiği, posta hariç tutma/sınırlar, altyapı eşikleri, Beszel kimliği).
- Kiosk `/api/config` ile, ajan `/api/agent/config` ile beslenir; gizli değerler dışarı verilmez, PIN sunucuda doğrulanır.
- Panel ilkesi: sessiz kurumsal yüzey, fare öncelikli, kaydet düğmesi kirli durumda etkin, silme iki adımlı onay, her değişiklik kısa bildirimle (toast) doğrulanır.
