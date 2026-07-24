import { requireParentView } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireParentView();
  return (
    <AppShell role="parent" userName={profile.fullName}>
      {children}
    </AppShell>
  );
}
