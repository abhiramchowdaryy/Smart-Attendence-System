"use client";

import { useQuery } from "@tanstack/react-query";
import { Satellite } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionError } from "@/components/section-error";
import { PageTitle } from "@/src/page-title";
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

export default function AdminSettings() {
  const { profile } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-settings", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const supabase = createClient();
      const settings = await fetchGpsSettings(supabase);
      return { settings };
    },
  });

  if (!profile || isLoading) return <PageSkeleton />;
  if (isError || !data)
    return (
      <SectionError
        error={new Error("Could not load GPS settings.")}
        reset={() => refetch()}
      />
    );

  const settings = data.settings;

  return (
    <GsapReveal className="mx-auto max-w-2xl space-y-6">
      <PageTitle title="GPS Settings" />
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
