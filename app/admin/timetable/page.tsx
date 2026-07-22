import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { GsapReveal } from "@/components/gsap-reveal";
import {
  TimetableManager,
  type CourseOption,
} from "@/components/admin/timetable-manager";
import { firstRow } from "@/lib/utils";
import type { TimetableSlot } from "@/lib/timetable";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Timetable" };

interface RawSlot {
  id: string;
  course_code: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  section: string | null;
  courses: { name: string } | { name: string }[] | null;
}

export default async function AdminTimetable() {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const [{ data: rawSlots }, { data: courseRows }] = await Promise.all([
    supabase
      .from("timetable")
      .select(
        "id, course_code, day_of_week, start_time, end_time, section, courses(name)"
      )
      .order("day_of_week")
      .order("start_time")
      .returns<RawSlot[]>(),
    supabase
      .from("courses")
      .select("code, name")
      .order("name")
      .returns<CourseOption[]>(),
  ]);

  const slots: TimetableSlot[] = (rawSlots ?? []).map((s) => ({
    id: s.id,
    course_code: s.course_code,
    course_name: firstRow(s.courses)?.name ?? s.course_code,
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time,
    section: s.section,
  }));

  return (
    <GsapReveal className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Timetable</h1>
        <p className="text-sm text-muted-foreground">
          The weekly class schedule. Everyone signed in can view it; only
          admins edit.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
            Weekly schedule
          </CardTitle>
          <CardDescription>
            Monday to Saturday. Add a class with its course, day and time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {courseRows && courseRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Create courses first — then you can schedule them here.
            </p>
          ) : (
            <TimetableManager slots={slots} courses={courseRows ?? []} />
          )}
        </CardContent>
      </Card>
    </GsapReveal>
  );
}
