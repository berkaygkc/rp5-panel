import { redirect } from "next/navigation";
import { isAdminSession, isSetupDone } from "@/lib/server/admin/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

/** Oturum kapısı: kurulum yoksa /admin/setup, oturum yoksa /admin/login */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  if (!(await isSetupDone())) redirect("/admin/setup");
  if (!(await isAdminSession())) redirect("/admin/login");
  return <AdminShell>{children}</AdminShell>;
}
