"use client";

import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarX2, ScanFace } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth";
import { isValidDescriptor, type FaceDescriptor } from "@/lib/face";
import { FACE_VERIFICATION_ENABLED } from "@/app/student/enroll-face/actions";
import { fetchGpsSettings } from "@/lib/gps-settings";
import { MarkAttendanceClient } from "@/components/attendance/mark-attendance-client";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionError } from "@/components/section-error";
import { PageTitle } from "@/src/page-title";
import { GsapReveal } from "@/components/gsap-reveal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { firstRow } from "@/lib/utils";

export default function MarkAttendancePage() {
  const { profile } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["mark-attendance", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const supabase = createClient();

      // The most recent open session (faculty opens/closes sessions).
      const { data: session } = await supabase
        .from("sessions")
        .select("id, course, opened_at, geofences(room_name, lat, lng, radius_m)")
        .is("closed_at", null)
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!session) return { session: null } as const;

      const fence = firstRow(session.geofences);

      // Is the student's face enrolled? Identity verification needs it.
      const { data: me } = await supabase
        .from("profiles")
        .select("face_embedding")
        .eq("id", profile!.id)
        .maybeSingle();
      const enrolledDescriptor: FaceDescriptor | null = isValidDescriptor(
        me?.face_embedding
      )
        ? me!.face_embedding
        : null;

      // Admin GPS policy: high-accuracy request + the geofence grace.
      const gps = await fetchGpsSettings(supabase);

      // Does this student already have an entry (without exit) for it?
      const { data: existing } = await supabase
        .from("attendance")
        .select("id, exit_time")
        .eq("session_id", session.id)
        .eq("student_id", profile!.id)
        .maybeSingle();

      return { session, fence, enrolledDescriptor, gps, existing } as const;
    },
  });

  if (!profile || isLoading) return <PageSkeleton />;
  if (isError || !data)
    return (
      <SectionError
        error={new Error("Could not load the session.")}
        reset={() => refetch()}
      />
    );

  if (!data.session) {
    return (
      <div className="mx-auto max-w-md">
        <PageTitle title="Mark Attendance" />
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

  const { session, fence, enrolledDescriptor, gps, existing } = data;
  const alreadyDone = existing && existing.exit_time !== null;

  return (
    <GsapReveal className="mx-auto max-w-md space-y-4">
      <PageTitle title="Mark Attendance" />
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
      ) : !fence ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            This session has no geofence configured — ask your administrator
            to assign one.
          </CardContent>
        </Card>
      ) : !enrolledDescriptor && !existing ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <ScanFace className="size-8 text-muted-foreground" aria-hidden="true" />
            <h2 className="font-display text-lg font-semibold">
              Enrol your face first
            </h2>
            <p className="text-sm text-muted-foreground">
              Attendance verifies your identity against an enrolled face. Set
              it up once — it takes a few seconds.
            </p>
            <Link to="/student/enroll-face">
              <Button variant="accent">
                <ScanFace className="size-4" aria-hidden="true" />
                Enrol my face
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <MarkAttendanceClient
          session={{
            id: session.id,
            course: session.course,
            roomName: fence.room_name,
            center: { lat: Number(fence.lat), lng: Number(fence.lng) },
            radiusM: Number(fence.radius_m),
          }}
          openAttendanceId={existing?.id ?? null}
          enrolledDescriptor={enrolledDescriptor}
          highAccuracy={gps.highAccuracy}
          accuracyGraceM={gps.accuracyGraceM}
          serverVerification={FACE_VERIFICATION_ENABLED}
        />
      )}
    </GsapReveal>
  );
}
