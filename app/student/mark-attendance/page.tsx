import type { Metadata } from "next";
import { CalendarX2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { MarkAttendanceClient } from "@/components/attendance/mark-attendance-client";
import { GsapReveal } from "@/components/gsap-reveal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { firstRow } from "@/lib/utils";

export const metadata: Metadata = { title: "Mark Attendance" };

export default async function MarkAttendancePage() {
  const profile = await requireRole(["student"]);
  const supabase = await createClient();

  // The most recent open session (faculty opens/closes sessions).
  const { data: session } = await supabase
    .from("sessions")
    .select("id, course, opened_at, geofences(room_name, lat, lng, radius_m)")
    .is("closed_at", null)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    return (
      <div className="mx-auto max-w-md">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <CalendarX2 className="size-8 text-muted-foreground" aria-hidden="true" />
            <h1 className="font-display text-lg font-semibold">
              No open session right now
            </h1>
            <p className="text-sm text-muted-foreground">
              Attendance can only be marked while your faculty has a class
              session open. Check back when your class starts.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fence = firstRow(session.geofences);

  // Does this student already have an entry (without exit) for it?
  const { data: existing } = await supabase
    .from("attendance")
    .select("id, exit_time")
    .eq("session_id", session.id)
    .eq("student_id", profile.id)
    .maybeSingle();

  const alreadyDone = existing && existing.exit_time !== null;

  return (
    <GsapReveal className="mx-auto max-w-md space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Mark Attendance</h1>
        <Badge variant="secondary" className="font-mono">
          {session.course}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Session opened{" "}
        {new Date(session.opened_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
        {fence && <> · Room “{fence.room_name}”</>}
      </p>

      {alreadyDone ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Entry and exit are both recorded for this session — you&apos;re
            all set. See your dashboard for the details.
          </CardContent>
        </Card>
      ) : fence ? (
        <MarkAttendanceClient
          session={{
            id: session.id,
            course: session.course,
            roomName: fence.room_name,
            center: { lat: Number(fence.lat), lng: Number(fence.lng) },
            radiusM: Number(fence.radius_m),
          }}
          openAttendanceId={existing?.id ?? null}
        />
      ) : (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            This session has no geofence configured — ask your administrator
            to assign one.
          </CardContent>
        </Card>
      )}
    </GsapReveal>
  );
}
