"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, usePoll } from "@/components/admin/ui";

/** İlk kurulum: yönetici parolası yalnızca bir kez belirlenir */
export default function SetupPage() {
  const router = useRouter();
  const check = useCallback(() => api<{ setupDone: boolean }>("/api/admin/setup"), []);
  const { data } = usePoll(check);
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Kurulum zaten yapılmışsa bu sayfanın işi yok
  useEffect(() => {
    if (data?.setupDone) router.replace("/admin/login");
  }, [data, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== again) { setError("Parolalar eşleşmiyor."); return; }
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/setup", { method: "POST", json: { password } });
      router.replace("/admin");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div style={{ width: 412 }}>
        <div className="mb-5 flex items-center gap-2.5">
          <span className="a-mark-badge" style={{ width: 30, height: 30, borderRadius: 8 }}>RP5</span>
          <span>
            <span className="block text-[14px] font-semibold">Konsolu kur</span>
            <span className="a-faint block text-[12px]">Bu tek seferlik bir adım</span>
          </span>
        </div>
        <form onSubmit={submit} className="a-panel" style={{ padding: 20 }}>
          <p className="a-muted mb-4 text-[12.5px]">
            Konsol tek yöneticilidir. Parola scrypt ile karılarak veritabanında saklanır; sonra Güvenlik sayfasından değiştirebilirsiniz.
          </p>
          <div className="flex flex-col gap-4">
            <label className="a-field">
              <span className="a-label">Parola</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="new-password" />
              <span className="a-hint">En az 8 karakter</span>
            </label>
            <label className="a-field">
              <span className="a-label">Parola (tekrar)</span>
              <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" />
            </label>
          </div>
          {error && <p className="mt-3 text-[12.5px]" style={{ color: "var(--a-fault)" }}>{error}</p>}
          <button type="submit" className="a-btn mt-5 w-full" data-variant="primary" disabled={busy || password.length < 8}>
            {busy ? "Kuruluyor" : "Kurulumu tamamla"}
          </button>
        </form>
      </div>
    </div>
  );
}
