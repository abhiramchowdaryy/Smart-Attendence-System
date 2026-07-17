import type { Metadata } from "next";
import { Satellite } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { fetchGpsSettings } from "@/lib/gps-settings";
import { GpsSettingsForm } from "@/components/admin/gps-settings-form";
import { GsapReveal } from "@/components/gsap-reveal";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "GPS Settings" };

export default async function AdminSettings() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const settings = await fetchGpsSettings(supabase);

  return (
    <GsapReveal className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">GPS Settings</h1>
        <p className="text-sm text-muted-foreground">
          Institution-wide location policy for attendance marking.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Satellite className="size-4 text-muted-foreground" aria-hidden="true" />
            Geofence &amp; timing policy
          </CardTitle>
          <CardDescription>
            These values apply to every session. The mark-attendance server
            action reads them on each entry, so changes take effect
            immediately — no redeploy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GpsSettingsForm settings={settings} />
        </CardContent>
      </Card>
    </GsapReveal>
  );
}
