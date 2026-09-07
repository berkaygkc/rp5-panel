import type { ReactNode } from "react";

/**
 * Birincil yüzey. Şerit ekranda hiyerarşi kutu çizerek değil, yalnızca öne
 * çıkması gereken modüle yüzey vererek kurulur — ikincil modüller alanın
 * üstünde açıkta durur. Bu yüzden Card'ı yalnızca "kahraman" için kullanın.
 */
export function Card({
  title,
  right,
  className = "",
  compact = false,
  children,
}: {
  title?: string;
  right?: ReactNode;
  className?: string;
  /** Daha sıkı iç boşluk (yükseklik kısıtlı kartlar) */
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`surface flex min-h-0 min-w-0 flex-col rounded-[var(--r-lg)] ${compact ? "p-4" : "p-5"} ${className}`}
    >
      {title && (
        <header className="mb-3 flex h-6 shrink-0 items-center justify-between gap-3">
          <h2 className="text-[12.5px] font-medium leading-none tracking-[0.01em] text-dim">{title}</h2>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}
