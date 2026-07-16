import { requireRole } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function FacultyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole(["faculty", "admin"]);
  return (
    <AppShell role="faculty" userName={profile.fullName}>
      {children}
    </AppShell>
  );
}
