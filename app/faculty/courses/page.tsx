import type { Metadata } from "next";
import Link from "next/link";
import { BookMarked, Pencil, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { CourseForm } from "@/components/faculty/course-form";
import {
  EnrollmentManager,
  type StudentOption,
} from "@/components/faculty/enrollment-manager";
import { GsapReveal } from "@/components/gsap-reveal";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Courses" };

interface CourseRow {
  code: string;
  name: string;
  credits: number;
  semester: string;
}

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; edit?: string }>;
}) {
  await requireRole(["faculty", "admin"]);
  const supabase = await createClient();
  const { course, edit } = await searchParams;

  const [{ data: courseRows }, { data: studentRows }, { data: enrollmentRows }] =
    await Promise.all([
      supabase
        .from("courses")
        .select("code, name, credits, semester")
        .order("semester")
        .order("name")
        .returns<CourseRow[]>(),
      supabase
        .from("profiles")
        .select("id, full_name, roll_no")
        .eq("role", "student")
        .order("full_name")
        .returns<StudentOption[]>(),
      supabase
        .from("enrollments")
        .select("course_code, student_id, active"),
    ]);

  const courses = courseRows ?? [];
  const students = studentRows ?? [];
  const enrollments = enrollmentRows ?? [];

  const activeByCourse = new Map<string, string[]>();
  for (const e of enrollments) {
    if (!e.active) continue;
    const list = activeByCourse.get(e.course_code);
    if (list) list.push(e.student_id);
    else activeByCourse.set(e.course_code, [e.student_id]);
  }

  const selectedCode =
    course && courses.some((c) => c.code === course)
      ? course
      : courses[0]?.code ?? null;
  const selected = courses.find((c) => c.code === selectedCode) ?? null;
  const editing = edit ? courses.find((c) => c.code === edit) ?? null : null;

  return (
    <GsapReveal className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Courses &amp; Enrolment</h1>
        <p className="text-sm text-muted-foreground">
          Maintain the course catalogue and each course&apos;s student roster.
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* Catalogue + create/edit */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookMarked className="size-4 text-muted-foreground" aria-hidden="true" />
                Course catalogue
              </CardTitle>
              <CardDescription>
                Tap a code to manage its roster; the pencil edits details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {courses.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No courses yet — add the first one below.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th scope="col" className="py-2 pr-4 font-medium">Course</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Sem</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Credits</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Enrolled</th>
                        <th scope="col" className="py-2 font-medium">
                          <span className="sr-only">Edit</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {courses.map((c) => (
                        <tr
                          key={c.code}
                          className={cn(
                            "border-b transition-colors last:border-0 hover:bg-muted/50",
                            c.code === selectedCode && "bg-primary/5"
                          )}
                        >
                          <td className="py-2.5 pr-4">
                            <Link
                              href={`/faculty/courses?course=${encodeURIComponent(c.code)}`}
                              className="block"
                            >
                              <span className="font-medium">{c.name}</span>
                              <span className="block font-mono text-xs text-muted-foreground">
                                {c.code}
                              </span>
                            </Link>
                          </td>
                          <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                            {c.semester}
                          </td>
                          <td className="py-2.5 pr-4 font-mono text-xs tabular-nums">
                            {Number(c.credits)}
                          </td>
                          <td className="py-2.5 pr-4 font-mono text-xs tabular-nums">
                            {(activeByCourse.get(c.code) ?? []).length}
                          </td>
                          <td className="py-2.5 text-right">
                            <Link
                              href={`/faculty/courses?course=${encodeURIComponent(selectedCode ?? c.code)}&edit=${encodeURIComponent(c.code)}`}
                              aria-label={`Edit ${c.name}`}
                              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              <Pencil className="size-3.5" aria-hidden="true" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{editing ? `Edit ${editing.code}` : "Add a course"}</CardTitle>
              <CardDescription>
                {editing
                  ? "Update the name, credits or semester — the code stays."
                  : "Backfilled placeholder courses can be fixed here too: enter the same code with the real details."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CourseForm editing={editing} />
            </CardContent>
          </Card>
        </div>

        {/* Roster */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="size-4 text-muted-foreground" aria-hidden="true" />
              Roster
              {selected && (
                <Badge variant="secondary" className="font-mono">
                  {selected.code}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {selected
                ? `Students enrolled in ${selected.name} (${selected.semester}). Unchecking deactivates — history is kept.`
                : "Add a course first, then manage its roster here."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selected ? (
              <EnrollmentManager
                key={selected.code}
                courseCode={selected.code}
                students={students}
                enrolledIds={activeByCourse.get(selected.code) ?? []}
              />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No course selected.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </GsapReveal>
  );
}
