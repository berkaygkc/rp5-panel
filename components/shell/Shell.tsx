"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useKioskConfig, useScreens } from "@/lib/config/ConfigContext";
import AmbientBackground from "./AmbientBackground";
import AppMenu from "./AppMenu";
import LockScreen from "./LockScreen";
import Pager from "./Pager";
import SideRail from "./SideRail";
import NoticeIsland from "./NoticeIsland";
import { useNotices } from "@/lib/data/useNotices";

/** Henüz geçmiş yokken rail'de gösterilecek "son kullanılan" ekranlar */
const DEFAULT_RECENTS = ["claude", "shortcuts"];
const RECENTS_KEY = "rp5-recents";


export default function Shell() {
  const SCREENS = useScreens();
  const { lockTimeoutMs: LOCK_TIMEOUT_MS, defaultRecents } = useKioskConfig();
  const clampIndex = useCallback((i: number) => Math.max(0, Math.min(SCREENS.length - 1, i)), [SCREENS.length]);
  const [locked, setLocked] = useState(true);
  const [index, setIndex] = useState(0);
  const [recents, setRecents] = useState<string[]>(DEFAULT_RECENTS);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuOpens, setMenuOpens] = useState(0);
  const indexRef = useRef(index);
  /** Yuva değişimi gerektiğinde hangi ekranın düşeceğini belirleyen kullanım sırası */
  const mru = useRef<string[]>([...DEFAULT_RECENTS]);
  const notices = useNotices();

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  /* ── Son kullanılanlar: kalıcı hafıza (hydration sonrası yüklenir) ── */
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const raw = localStorage.getItem(RECENTS_KEY);
        if (!raw) return;
        const ids = JSON.parse(raw) as unknown;
        if (Array.isArray(ids)) {
          const valid = ids.filter(
            (id): id is string => typeof id === "string" && SCREENS.some((s) => s.id === id)
          );
          if (valid.length) {
            const slots = valid.slice(0, 2);
            setRecents(slots);
            mru.current = [...slots];
          }
        }
      } catch {
        /* depolama kapalı */
      }
    }, 0);
    return () => clearTimeout(t);
  }, [SCREENS]);

  useEffect(() => {
    try {
      localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
    } catch {
      /* depolama kapalı */
    }
  }, [recents]);

  /**
   * Bir ekrana girildiğinde rail yuvalarını güncelle (Genel Bakış hariç).
   * Yuva konumları SABİT: ekran zaten rail'deyse yerinde kalır, yalnızca aktif
   * görünür — dokunulan karo yer değiştirmez. Rail'de olmayan bir ekran
   * girdiğinde en az kullanılan yuvanın yerini alır.
   */
  const visit = useCallback((i: number) => {
    const id = SCREENS[i]?.id;
    if (!id || i === 0) return;
    mru.current = [id, ...mru.current.filter((x) => x !== id)];
    setRecents((slots) => {
      if (slots.includes(id)) return slots;
      const rank = (x: string) => {
        const r = mru.current.indexOf(x);
        return r === -1 ? Infinity : r; // hiç kullanılmamış → önce düşer
      };
      const victim = slots.reduce((worst, x) => (rank(x) > rank(worst) ? x : worst), slots[0]);
      return slots.map((x) => (x === victim ? id : x));
    });
  }, [SCREENS]);

  const go = useCallback(
    (i: number) => {
      const next = clampIndex(i);
      setIndex(next);
      visit(next);
      setMenuOpen(false);
    },
    [visit, clampIndex]
  );

  const toggleMenu = useCallback(() => {
    if (!menuOpen) setMenuOpens((c) => c + 1);
    setMenuOpen(!menuOpen);
  }, [menuOpen]);

  /** Kilitle: menü de kapanır (effect içinde setState yerine tek noktadan) */
  const lock = useCallback(() => {
    setLocked(true);
    setMenuOpen(false);
  }, []);

  // Hareketsizlikte yeniden kilitle
  useEffect(() => {
    if (locked) return;
    let t = window.setTimeout(lock, LOCK_TIMEOUT_MS);
    const reset = () => {
      window.clearTimeout(t);
      t = window.setTimeout(lock, LOCK_TIMEOUT_MS);
    };
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [locked, lock, LOCK_TIMEOUT_MS]);

  // Kiosk: uzun basış/sağ tık menüsü hiçbir yerde açılmasın (basılı tutmayı da bozar)
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    window.addEventListener("contextmenu", block);
    return () => window.removeEventListener("contextmenu", block);
  }, []);

  // Kartlardan ekran geçişi: bileşenler "panel-goto" olayıyla ekran kimliği yollar
  useEffect(() => {
    const onGoto = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const i = SCREENS.findIndex((s) => s.id === id);
      if (i >= 0) go(i);
    };
    window.addEventListener("panel-goto", onGoto);
    return () => window.removeEventListener("panel-goto", onGoto);
  }, [go, SCREENS]);

  // Yönetim paneli varsayılan son kullanılanları değiştirdiyse (kayıtlı geçmiş yoksa) uygula
  useEffect(() => {
    try {
      if (localStorage.getItem(RECENTS_KEY)) return;
    } catch {
      return;
    }
    const valid = defaultRecents.filter((id) => SCREENS.some((s) => s.id === id)).slice(0, 2);
    if (valid.length) {
      const t = setTimeout(() => {
        setRecents(valid);
        mru.current = [...valid];
      }, 0);
      return () => clearTimeout(t);
    }
  }, [defaultRecents, SCREENS]);

  // Kısayollar ekranındaki "Ekran kilidi" eylemi bu olayı yayınlar
  useEffect(() => {
    window.addEventListener("panel-lock", lock);
    return () => window.removeEventListener("panel-lock", lock);
  }, [lock]);

  // Geliştirme kolaylığı: sol/sağ ok tuşları, Esc menüyü kapatır
  useEffect(() => {
    if (locked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(indexRef.current - 1);
      if (e.key === "ArrowRight") go(indexRef.current + 1);
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, go]);

  // Aktif ekranın kimlik rengi tüm kabuğa dağılır: aurora, dock göstergesi, saniye ibresi
  const tint = SCREENS[index]?.tint ?? "var(--color-blue)";

  return (
    <main
      className="relative h-full w-full overflow-hidden bg-night"
      style={{ ["--screen-tint" as string]: tint } as CSSProperties}
    >
      <AmbientBackground />
      {/* Panel, kilit açılırken "materialize" olur: ölçek + opaklık birlikte */}
      <div
        className="relative flex h-full w-full"
        style={{
          transition:
            "transform 550ms var(--ease-out-strong), opacity 550ms var(--ease-out-strong)",
          transform: locked ? "scale(0.96)" : "scale(1)",
          opacity: locked ? 0.4 : 1,
        }}
      >
        <SideRail
          index={index}
          recents={recents}
          menuOpen={menuOpen}
          onSelect={go}
          onMenu={toggleMenu}
          onLock={lock}
        />
        {/* Menü katmanı yalnızca içerik alanını örter; rail görünür kalır */}
        <div className="relative min-h-0 min-w-0 flex-1">
            <Pager index={index} onIndexChange={go} />
            <NoticeIsland
              notices={notices.notices}
              locked={locked}
              onOpen={(screen) => {
                const i = SCREENS.findIndex((s) => s.id === screen);
                if (i >= 0) go(i);
              }}
              onDismiss={notices.dismiss}
            />
            <AppMenu
              open={menuOpen}
              openCount={menuOpens}
              index={index}
              onSelect={go}
              onClose={() => setMenuOpen(false)}
            />
        </div>
      </div>
      {locked && <LockScreen onUnlock={() => setLocked(false)} />}
    </main>
  );
}
