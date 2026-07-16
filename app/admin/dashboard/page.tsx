import type { Metadata } from "next";
import {
  CalendarDays,
  GraduationCap,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { KpiCard } from "@/components/kpi-card";
import { GsapReveal } from "@/components/gsap-reveal";
import { UsersTable, type UserRow } from "@/components/admin/users-table";
import {
  GeofenceManager,
  type GeofenceRow,
} from "@/components/admin/geofence-manager";
import {
  StatusStackedBars,
  type DayStatusDatum,
} from "@/components/charts/status-stacked-bars";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { startOfToday, type AttendanceStatus } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin Dashboard" };

export default async function AdminDashboard() {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();

  // All users (RLS: admin full access).
  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, roll_no, role, created_at")
    .order("role")
    .order("full_name")
    .returns<UserRow[]>();

  const allUsers = users ?? [];
  const studentCount = allUsers.filter((u) => u.role === "student").length;
  const staffCount = allUsers.filter((u) => u.role !== "student").length;

  // Geofences.
  const { data: geofences } = await supabase
    .from("geofences")
    .select("id, room_name, lat, lng, radius_m")
    .order("room_name")
    .returns<GeofenceRow[]>();

  // Sessions today.
  const todayStart = startOfToday();
  const { count: sessionsToday } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .gte("opened_at", todayStart.toISOString());

  // Last 7 days of attendance, aggregated per day by status.
  const weekAgo = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
  const { data: weekRows } = await supabase
    .from("attendance")
    .select("entry_time, status")
    .gte("entry_time", weekAgo.toISOString())
    .returns<{ entry_time: string; status: AttendanceStatus }[]>();

  const days: DayStatusDatum[] = Array.from({ length: 7 }).map((_, i) => {
    const day = new Date(weekAgo.getTime() + i * 24 * 60 * 60 * 1000);
    return {
      label: day.toLocaleDateString([], { weekday: "short", day: "numeric" }),
      present: 0,
      late: 0,
      partial: 0,
    };
  });
  for (const row of weekRows ?? []) {
    const idx = Math.floor(
      (new Date(row.entry_time).getTime() - weekAgo.getTime()) /
        (24 * 60 * 60 * 1000)
    );
    if (idx >= 0 && idx < 7 && row.status !== "absent") {
      days[idx][row.status] += 1;
    }
  }
  const weekTotal = days.reduce((s, d) => s + d.present + d.late + d.partial, 0);

  return (
    <GsapReveal className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Hello, {profile.fullName.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          Institution overview · user &amp; geofence management
        </p>
      </div>

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Students"
          value={String(studentCount)}
          countTo={studentCount}
          sub="Registered accounts"
          icon={<GraduationCap />}
        />
        <KpiCard
          label="Staff"
          value={String(staffCount)}
          countTo={staffCount}
          sub="Faculty + admins"
          icon={<ShieldCheck />}
        />
        <KpiCard
          label="Geofences"
          value={String(geofences?.length ?? 0)}
          countTo={geofences?.length ?? 0}
          sub="Configured classrooms"
          icon={<MapPin />}
        />
        <KpiCard
          label="Sessions today"
          value={String(sessionsToday ?? 0)}
          countTo={sessionsToday ?? 0}
          sub={`${weekTotal} marks this week`}
          icon={<CalendarDays />}
        />
      </div>

      {/* Weekly status chart — only with real data */}
      {weekTotal > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>This week&apos;s attendance</CardTitle>
            <CardDescription>
              Marks per day by status — last 7 days, campus-wide
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StatusStackedBars data={days} />
          </CardContent>
        </Card>
      )}

      {/* Management panels */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Users &amp; roles</CardTitle>
            <CardDescription>
              Promote users to faculty or admin. Your own role is locked.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {allUsers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No users yet — accounts appear here after sign-up.
              </p>
            ) : (
              <UsersTable users={allUsers} currentUserId={profile.id} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Classroom geofences</CardTitle>
            <CardDescription>
              Stand in the classroom and tap “Use my current location” for
              exact coordinates. Map-pin editing arrives in Phase 2.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GeofenceManager geofences={geofences ?? []} />
          </CardContent>
        </Card>
      </div>
    </GsapReveal>
  );
}
