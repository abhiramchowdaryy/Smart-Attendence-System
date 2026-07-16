import type { Metadata } from "next";
import { BookOpenCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { GsapReveal } from "@/components/gsap-reveal";
import { MarksForm } from "@/components/faculty/marks-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Upload Marks" };

interface MarkRow {
  id: string;
  course: string;
  assessment: string;
  score: number;
  max_score: number;
  updated_at: string;
  profiles: { full_name: string; roll_no: string | null } | null;
}

export default async function MarksPage() {
  await requireRole(["faculty", "admin"]);
  const supabase = await createClient();

  const { data: students } = await supabase
    .from("profiles")
    .select("id, full_name, roll_no")
    .eq("role", "student")
    .order("full_name");

  // Course suggestions from past sessions.
  const { data: sessionCourses } = await supabase
    .from("sessions")
    .select("course")
    .order("opened_at", { ascending: false })
    .limit(50);
  const courses = Array.from(
    new Set((sessionCourses ?? []).map((s) => s.course))
  );

  const { data: marks } = await supabase
    .from("marks")
    .select(
      "id, course, assessment, score, max_score, updated_at, profiles!marks_student_id_fkey(full_name, roll_no)"
    )
    .order("updated_at", { ascending: false })
    .limit(30)
    .returns<MarkRow[]>();

  return (
    <GsapReveal className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload Marks</h1>
        <p className="text-sm text-muted-foreground">
          Only faculty and admins can record scores — students see their own
          marks on their dashboard.
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Record a score</CardTitle>
            <CardDescription>
              Saving the same student + course + assessment again updates the
              existing score.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {students && students.length > 0 ? (
              <MarksForm students={students} courses={courses} />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No students registered yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpenCheck className="size-4 text-muted-foreground" aria-hidden="true" />
              Recently recorded
            </CardTitle>
            <CardDescription>Latest 30 entries, newest first.</CardDescription>
          </CardHeader>
          <CardContent>
            {!marks || marks.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No marks recorded yet — they&apos;ll appear here as you save
                them.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="py-2 pr-4 font-medium">Student</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Course</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Assessment</th>
                      <th scope="col" className="py-2 font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marks.map((m) => (
                      <tr key={m.id} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                        <td className="py-2.5 pr-4 font-medium">
                          {m.profiles?.full_name ?? "—"}
                          {m.profiles?.roll_no && (
                            <span className="ml-1 font-mono text-xs text-muted-foreground">
                              {m.profiles.roll_no}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4">{m.course}</td>
                        <td className="py-2.5 pr-4">{m.assessment}</td>
                        <td className="py-2.5 font-mono text-xs">
                          {Number(m.score)}/{Number(m.max_score)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </GsapReveal>
  );
}
