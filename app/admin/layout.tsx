import { requireRole } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole(["admin"]);
  return (
    <AppShell role="admin" userName={profile.fullName}>
      {children}
    </AppShell>
  );
}
