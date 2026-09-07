"use client";

import { useCallback, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Button, Empty, Field, Panel, Skeleton, Status, Switch, Tag, ago, api, loadSettings, saveSettings, usePoll, useToast } from "@/components/admin/ui";
import { KIND_LABEL, type ChatSourceState, type ChatState } from "@/lib/types/chat";

interface CwForm { url: string; token: string; accountId: string }
interface MmForm { url: string; token: string; login: string; password: string }
interface Behaviour { pollSec: number; noticeAssigned: boolean; noticeMentions: boolean; includeChannels: boolean }
interface CwTest { ok: boolean; error?: string; profile?: { name: string; email: string }; accounts?: Array<{ id: number; name: string; role: string }>; accountId?: number; counts?: { mine: number; waiting: number; mentions: number } }
interface MmTest { ok: boolean; error?: string; me?: string; username?: string; teams?: string[]; tokenSource?: "token" | "login"; unread?: { mentions: number; channels: number; dms: number } }

/** Sayaçları kiosk'taki adlarıyla yazar; ham anahtar göstermez */
const COUNT_LABEL: Record<string, string> = {
  mine: "bana atanan", waiting: "yanıt bekleyen", mentions: "bahsetme",
  dms: "doğrudan mesaj", channels: "okunmamış kanal", teams: "takım",
};
const summarise = (counts: Record<string, number>) =>
  Object.entries(counts)
    .filter(([k]) => COUNT_LABEL[k])
    .map(([k, v]) => `${v} ${COUNT_LABEL[k]}`)
    .join(" · ");

function SourceState({ state }: { state?: ChatSourceState }) {
  if (!state?.configured) return <Status>bağlı değil</Status>;
  if (state.error) return <Status tone="fault">{state.error}</Status>;
  return <Status tone="ok">{state.me ?? "bağlı"} · {state.items.length} öğe · {ago(state.updatedAt)}</Status>;
}

export default function ChatAdminPage() {
  const loadForms = useCallback(
    () =>
      loadSettings().then((s) => ({
        cw: { url: String(s["chatwoot.url"] ?? ""), token: String(s["chatwoot.token"] ?? ""), accountId: Number(s["chatwoot.accountId"]) ? String(s["chatwoot.accountId"]) : "" },
        mm: { url: String(s["mattermost.url"] ?? ""), token: String(s["mattermost.token"] ?? ""), login: String(s["mattermost.login"] ?? ""), password: String(s["mattermost.password"] ?? "") },
        beh: {
          pollSec: Math.round(Number(s["chat.pollMs"] ?? 30000) / 1000),
          noticeAssigned: s["chat.noticeAssigned"] !== false,
          noticeMentions: s["chat.noticeMentions"] !== false,
          includeChannels: s["chat.includeChannels"] === true,
        } as Behaviour,
      })),
    []
  );
  const loadStatus = useCallback(() => api<ChatState>("/api/admin/chat/status"), []);
  const settings = usePoll(loadForms);
  const status = usePoll(loadStatus, 10_000);
  const [cw, setCw] = useState<CwForm | null>(null);
  const [mm, setMm] = useState<MmForm | null>(null);
  const [beh, setBeh] = useState<Behaviour | null>(null);
  const [cwTest, setCwTest] = useState<CwTest | null>(null);
  const [mmTest, setMmTest] = useState<MmTest | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  const c = cw ?? settings.data?.cw ?? null;
  const m = mm ?? settings.data?.mm ?? null;
  const b = beh ?? settings.data?.beh ?? null;
  const cwDirty = cw !== null && JSON.stringify(cw) !== JSON.stringify(settings.data?.cw);
  const mmDirty = mm !== null && JSON.stringify(mm) !== JSON.stringify(settings.data?.mm);
  const behDirty = beh !== null && JSON.stringify(beh) !== JSON.stringify(settings.data?.beh);

  const poll = () => api<ChatState>("/api/admin/chat/status", { method: "POST" }).then(() => status.refresh());
  const refreshNow = async () => {
    setBusy("poll");
    try { await poll(); toast.ok("Kaynaklar yeniden yoklandı"); }
    catch (e) { toast.fail((e as Error).message); }
    finally { setBusy(null); }
  };
  const save = async (key: string, values: Record<string, unknown>, ok: string, clear: () => void) => {
    setBusy(key);
    try { await saveSettings(values); clear(); settings.refresh(); toast.ok(ok); setTimeout(() => void poll().catch(() => null), 600); }
    catch (e) { toast.fail((e as Error).message); }
    finally { setBusy(null); }
  };

  return (
    <>
      <header className="a-head">
        <div>
          <h1 className="a-title">Sohbet</h1>
          <p className="a-sub">
            Chatwoot’taki müşteri sohbetleri ve Mattermost’taki ekip mesajları kiosk’ta tek listede toplanır. Panel iki sisteme de yalnızca okumak için bağlanır; hiçbir mesaj yazmaz, hiçbir şeyi okundu işaretlemez.
          </p>
        </div>
        <Button onClick={() => void refreshNow()} disabled={busy === "poll"}><RefreshCw size={14} /> Şimdi yokla</Button>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <Panel
          title="Chatwoot"
          desc="Yalnızca size atanmış açık sohbetler ve bahsetmeler"
          actions={<SourceState state={status.data?.chatwoot} />}
          footer={
            <>
              <Button size="sm" disabled={busy === "cw-test" || !c?.url} onClick={() => { setBusy("cw-test"); api<CwTest>("/api/admin/chat/test", { method: "POST", json: { source: "chatwoot", ...c } }).then(setCwTest).catch((e: Error) => setCwTest({ ok: false, error: e.message })).finally(() => setBusy(null)); }}>
                {busy === "cw-test" ? "Deneniyor" : "Bağlantıyı dene"}
              </Button>
              <Button size="sm" variant="primary" disabled={!cwDirty || busy === "cw"} onClick={() => c && void save("cw", { "chatwoot.url": c.url, "chatwoot.token": c.token, "chatwoot.accountId": Number(c.accountId) || 0 }, "Chatwoot bağlantısı kaydedildi", () => setCw(null))}>Kaydet</Button>
            </>
          }
        >
          {!c ? <Skeleton h={150} /> : (
            <div className="flex flex-col gap-4">
              <Field label="Adres"><input type="url" className="a-mono" value={c.url} onChange={(e) => setCw({ ...c, url: e.target.value })} placeholder="https://chat.ornek.com" /></Field>
              <Field label="Erişim anahtarı" hint="Profil Ayarları → Erişim Anahtarı"><input type="password" autoComplete="off" value={c.token} onChange={(e) => setCw({ ...c, token: e.target.value })} /></Field>
              <Field label="Hesap kimliği" hint="Boş bırakırsanız kullanıcının ilk hesabı kullanılır">
                <input type="number" min={0} value={c.accountId} onChange={(e) => setCw({ ...c, accountId: e.target.value })} placeholder="otomatik" style={{ width: 140 }} />
              </Field>
              {cwTest && (
                <div className="rounded-[7px] p-3" style={{ background: "var(--a-sunken)", border: "1px solid var(--a-line)" }}>
                  <Status tone={cwTest.ok ? "ok" : "fault"}>{cwTest.ok ? `${cwTest.profile?.name} olarak bağlandı, hesap ${cwTest.accountId}` : `Bağlanılamadı: ${cwTest.error}`}</Status>
                  {cwTest.ok && (
                    <div className="a-muted mt-2 flex flex-col gap-1 pl-4 text-[12px]">
                      <span>Hesaplar: {cwTest.accounts?.map((a) => `${a.id} ${a.name}`).join(", ")}</span>
                      <span>Bana atanan {cwTest.counts?.mine}, yanıt bekleyen {cwTest.counts?.waiting}, bahsetme {cwTest.counts?.mentions}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Panel>

        <Panel
          title="Mattermost"
          desc="Bahsetmeler, doğrudan ve grup mesajları"
          actions={<SourceState state={status.data?.mattermost} />}
          footer={
            <>
              <Button size="sm" disabled={busy === "mm-test" || !m?.url} onClick={() => { setBusy("mm-test"); api<MmTest>("/api/admin/chat/test", { method: "POST", json: { source: "mattermost", ...m } }).then(setMmTest).catch((e: Error) => setMmTest({ ok: false, error: e.message })).finally(() => setBusy(null)); }}>
                {busy === "mm-test" ? "Deneniyor" : "Bağlantıyı dene"}
              </Button>
              <Button size="sm" variant="primary" disabled={!mmDirty || busy === "mm"} onClick={() => m && void save("mm", { "mattermost.url": m.url, "mattermost.token": m.token, "mattermost.login": m.login, "mattermost.password": m.password }, "Mattermost bağlantısı kaydedildi", () => setMm(null))}>Kaydet</Button>
            </>
          }
        >
          {!m ? <Skeleton h={150} /> : (
            <div className="flex flex-col gap-4">
              <Field label="Adres"><input type="url" className="a-mono" value={m.url} onChange={(e) => setMm({ ...m, url: e.target.value })} placeholder="https://chat.ornek.com" /></Field>
              <Field label="Kişisel erişim anahtarı" hint="Profil → Güvenlik → Kişisel Erişim Anahtarları"><input type="password" autoComplete="off" value={m.token} onChange={(e) => setMm({ ...m, token: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="ya da kullanıcı adı"><input value={m.login} onChange={(e) => setMm({ ...m, login: e.target.value })} autoComplete="off" /></Field>
                <Field label="Parola"><input type="password" value={m.password} onChange={(e) => setMm({ ...m, password: e.target.value })} autoComplete="new-password" /></Field>
              </div>
              {mmTest && (
                <div className="rounded-[7px] p-3" style={{ background: "var(--a-sunken)", border: "1px solid var(--a-line)" }}>
                  <Status tone={mmTest.ok ? "ok" : "fault"}>{mmTest.ok ? `${mmTest.me} olarak bağlandı (${mmTest.tokenSource === "login" ? "parolayla" : "anahtarla"})` : `Bağlanılamadı: ${mmTest.error}`}</Status>
                  {mmTest.ok && (
                    <div className="a-muted mt-2 flex flex-col gap-1 pl-4 text-[12px]">
                      <span>Takımlar: {mmTest.teams?.join(", ") || "yok"}</span>
                      <span>{mmTest.unread?.mentions} bahsetme, {mmTest.unread?.dms} doğrudan mesaj, {mmTest.unread?.channels} okunmamış kanal</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title="Ne zaman uyarılayım"
        desc="Bu durumlar kiosk’un Dynamic Island’ına dikkat bildirimi olarak düşer."
        flush
        footer={<><span className="a-muted">Kiosk’ta kapattığınız bir bildirim, içeriği değişmedikçe yeniden çalmaz.</span><Button size="sm" variant="primary" disabled={!behDirty || busy === "beh"} onClick={() => b && void save("beh", { "chat.pollMs": b.pollSec * 1000, "chat.noticeAssigned": b.noticeAssigned, "chat.noticeMentions": b.noticeMentions, "chat.includeChannels": b.includeChannels }, "Bildirim davranışı kaydedildi", () => setBeh(null))}>Kaydet</Button></>}
      >
        {!b ? <div className="p-4"><Skeleton h={100} /></div> : (
          <div className="a-rows">
            <div className="a-row">
              <div className="a-row-text">
                <div className="a-row-title">Bana atanmış sohbette okunmamış müşteri mesajı</div>
                <div className="a-row-desc">Chatwoot’ta size atanmış bir sohbete müşteri yazdığında bildirir.</div>
              </div>
              <div className="a-row-control"><Switch checked={b.noticeAssigned} onChange={(v) => setBeh({ ...b, noticeAssigned: v })} label={undefined} /></div>
            </div>
            <div className="a-row">
              <div className="a-row-text">
                <div className="a-row-title">Mattermost bahsetme ve doğrudan mesaj</div>
                <div className="a-row-desc">Biri sizi andığında ya da size özel mesaj yazdığında bildirir.</div>
              </div>
              <div className="a-row-control"><Switch checked={b.noticeMentions} onChange={(v) => setBeh({ ...b, noticeMentions: v })} label={undefined} /></div>
            </div>
            <div className="a-row">
              <div className="a-row-text">
                <div className="a-row-title">Okunmamış kanalları da listele</div>
                <div className="a-row-desc">Sizi anmayan kanallar da kiosk listesine girer. Yoğun sunucularda gürültülü olabilir.</div>
              </div>
              <div className="a-row-control"><Switch checked={b.includeChannels} onChange={(v) => setBeh({ ...b, includeChannels: v })} label={undefined} /></div>
            </div>
            <div className="a-row">
              <div className="a-row-text">
                <div className="a-row-title">Yoklama aralığı</div>
                <div className="a-row-desc">İki sistemin de ne sıklıkla sorgulanacağı. En az 10 saniye.</div>
              </div>
              <div className="a-row-control">
                <input type="number" min={10} value={b.pollSec} onChange={(e) => setBeh({ ...b, pollSec: Number(e.target.value) })} style={{ width: 80 }} aria-label="Yoklama aralığı, saniye" />
                <span className="a-muted">saniye</span>
              </div>
            </div>
          </div>
        )}
      </Panel>

      <Panel className="mt-4" title="Şu an kiosk’ta ne var" desc={status.data ? `Son yoklama ${ago(status.data.updatedAt)}. Kiosk aynı listeyi 10 saniyede bir alır.` : undefined} flush>
        {status.loading ? (
          <div className="flex flex-col gap-3 p-4"><Skeleton /><Skeleton /></div>
        ) : (
          <div className="grid grid-cols-2">
            {(["chatwoot", "mattermost"] as const).map((src, idx) => {
              const st = status.data?.[src];
              return (
                <div key={src} style={idx === 0 ? { borderRight: "1px solid var(--a-line)" } : undefined}>
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--a-line-soft)" }}>
                    <span style={{ fontWeight: 600 }}>{src === "chatwoot" ? "Chatwoot" : "Mattermost"}</span>
                    <span className="a-faint text-[12px]">{st ? summarise(st.counts) : ""}</span>
                  </div>
                  {!st?.configured ? <Empty>Bağlı değil.</Empty>
                    : st.error ? <Empty><span style={{ color: "var(--a-fault)" }}>{st.error}</span></Empty>
                    : st.items.length === 0 ? <Empty>Bakılması gereken bir şey yok.</Empty>
                    : (
                      <div className="a-rows">
                        {st.items.slice(0, 6).map((i) => (
                          <div key={i.id} className="a-row" style={{ padding: "10px 16px" }}>
                            <div className="a-row-text">
                              <div className="flex items-center gap-2">
                                <Tag tone={i.mentions > 0 ? "fault" : i.unread > 0 ? "warn" : undefined}>{KIND_LABEL[i.kind]}</Tag>
                                <span className="a-row-title truncate">{i.title}</span>
                              </div>
                              <div className="a-row-desc truncate">{i.preview}</div>
                            </div>
                            <div className="a-row-control">
                              <span className="a-faint a-num text-[12px]">{i.mentions > 0 ? `@${i.mentions}` : i.unread > 0 ? i.unread : ""}</span>
                              <a href={i.url} target="_blank" rel="noreferrer" className="a-btn" data-size="icon" data-variant="ghost" title="Kaynağında aç"><ExternalLink size={14} /></a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel className="mt-4" title="Erişim bilgileri nasıl alınır">
        <div className="a-prose grid grid-cols-2 gap-x-10 gap-y-7">
          <section>
            <h3>Chatwoot erişim anahtarı</h3>
            <ol>
              <li>Chatwoot’a kendi ajan kullanıcınızla girin. Anahtar bu kullanıcı adına okur, “bana atanan” listesi ona göre gelir.</li>
              <li>Sol alttaki profil resmi, sonra <b>Profil Ayarları</b>.</li>
              <li>Sayfanın altındaki <b>Erişim Anahtarı</b> bölümünden anahtarı kopyalayın.</li>
              <li>Hesap kimliği tarayıcı adresindeki <code>/app/accounts/7/</code> parçasındaki sayıdır. Boş bırakırsanız ilk hesabınız kullanılır.</li>
            </ol>
            <p>Yönetici yetkisi gerekmez. Panel yalnızca bu kullanıcıya atanmış açık sohbetleri okur; atanmamış kuyruk hiç sorgulanmaz.</p>
          </section>
          <section>
            <h3>Mattermost erişim anahtarı</h3>
            <ol>
              <li>Sol üstteki profil resmi, sonra <b>Profil</b>, <b>Güvenlik</b>, <b>Kişisel Erişim Anahtarları</b>, “Anahtar oluştur”. Oluşan anahtarı hemen kopyalayın; bir daha gösterilmez.</li>
              <li>Bu bölüm yoksa sunucuda kapalıdır. <b>Sistem Konsolu</b>, <b>Entegrasyonlar</b>, <b>Entegrasyon Yönetimi</b> altından açılır; sonra <b>Kullanıcılar</b> ekranından ilgili kullanıcıya izin verilir.</li>
              <li>Anahtar istemiyorsanız kullanıcı adı ve parola girin. Panel oturum açar ve oturum düştüğünde kendisi yeniler. LDAP ya da SSO hesaplarında parola girişi çalışmayabilir.</li>
            </ol>
            <p>Sayaçlar kanal üyeliğinden okunur; üye olduğunuz tüm takımlar taranır.</p>
          </section>
          <section>
            <h3>Panel ne okuyor</h3>
            <ul>
              <li><b>Chatwoot:</b> yalnızca size atanmış açık sohbetler, okunmamış sayıları ve bekleme süreleri, bahsetme bildirimleri, gelen kutusu adları ve seçtiğiniz sohbetin mesajları.</li>
              <li><b>Mattermost:</b> takımlar, kanal üyelikleri, doğrudan ve grup mesajları, listelenen kanalların son mesajı ve seçtiğiniz kanalın son kırk mesajı.</li>
            </ul>
          </section>
          <section>
            <h3>Güvenlik</h3>
            <ul>
              <li>Anahtarlar ve parola sunucudaki veritabanında durur, kiosk’a hiçbir zaman gönderilmez. Kiosk yalnızca özetlenmiş listeyi görür.</li>
              <li>Bu bildirimlerin türü <code>chat</code>’tir; önemini ve hedef ekranını Kurallar sayfasından değiştirebilirsiniz.</li>
              <li>Anahtarı iptal etmek isterseniz ilgili sistemin kendi arayüzünden silin; panel bir sonraki yoklamada hata gösterir.</li>
            </ul>
          </section>
        </div>
      </Panel>
    </>
  );
}
