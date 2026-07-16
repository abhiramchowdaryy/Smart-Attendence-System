import { requireRole } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole(["student"]);
  return (
    <AppShell role="student" userName={profile.fullName}>
      {children}
    </AppShell>
  );
}
