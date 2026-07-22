import type { Metadata } from "next";
import { ClipboardCheck, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { GsapReveal } from "@/components/gsap-reveal";
import { StatusPill } from "@/components/status-pill";
import {
  CorrectionForm,
  type CorrectionRecord,
} from "@/components/faculty/correction-form";
import { CorrectionStateBadge } from "@/components/correction-state-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { firstRow, type AttendanceStatus } from "@/lib/utils";

export const metadata: Metadata = { title: "Attendance Corrections" };

interface AttRow {
  id: string;
  status: AttendanceStatus;
  entry_time: string;
  student_id: string;
  sessions: { course: string } | { course: string }[] | null;
  profiles: { full_name: string; roll_no: string | null } | { full_name: string; roll_no: string | null }[] | null;
}

interface CorrectionRow {
  id: string;
  attendance_id: string;
  from_status: AttendanceStatus;
  to_status: AttendanceStatus;
  reason: string;
  state: "pending" | "approved" | "rejected";
  created_at: string;
}

export default async function FacultyCorrections() {
  const me = await requireRole(["faculty", "admin"]);
  const supabase = await createClient();

  const [{ data: att }, { data: mine }] = await Promise.all([
    supabase
      .from("attendance")
      .select(
        "id, status, entry_time, student_id, sessions(course), profiles(full_name, roll_no)"
      )
      .order("entry_time", { ascending: false })
      .limit(80)
      .returns<AttRow[]>(),
    supabase
      .from("attendance_corrections")
      .select(
        "id, attendance_id, from_status, to_status, reason, state, created_at"
      )
      .eq("requested_by", me.id)
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<CorrectionRow[]>(),
  ]);

  const context = new Map<string, { name: string; course: string }>();
  const records: CorrectionRecord[] = (att ?? []).map((a) => {
    const p = firstRow(a.profiles);
    const s = firstRow(a.sessions);
    const name = p?.full_name ?? "Student";
    const course = s?.course ?? "Class";
    context.set(a.id, { name, course });
    const date = new Date(a.entry_time).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
    return {
      id: a.id,
      status: a.status,
      label: `${name}${p?.roll_no ? ` (${p.roll_no})` : ""} · ${course} · ${date} · ${a.status}`,
    };
  });

  const requests = mine ?? [];

  return (
    <GsapReveal className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Attendance Corrections</h1>
        <p className="text-sm text-muted-foreground">
          Faculty can&apos;t edit attendance directly — request a change and an
          admin approves it.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="size-4 text-muted-foreground" aria-hidden="true" />
            Request a correction
          </CardTitle>
          <CardDescription>
            Pick a record, choose the corrected status, and say why. It stays
            pending until an admin approves.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CorrectionForm records={records} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" aria-hidden="true" />
            Your requests
          </CardTitle>
          <CardDescription>The corrections you&apos;ve filed.</CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              You haven&apos;t requested any corrections yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-medium">Record</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Change</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Reason</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Requested</th>
                    <th scope="col" className="py-2 font-medium">State</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((c) => {
                    const ctx = context.get(c.attendance_id);
                    return (
                      <tr
                        key={c.id}
                        className="border-b transition-colors last:border-0 hover:bg-muted/50"
                      >
                        <td className="py-3 pr-4">
                          {ctx ? (
                            <>
                              <div className="font-medium">{ctx.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {ctx.course}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">Record</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-1.5">
                            <StatusPill status={c.from_status} />
                            <span aria-hidden="true" className="text-muted-foreground">→</span>
                            <StatusPill status={c.to_status} />
                          </div>
                        </td>
                        <td className="max-w-[16rem] py-3 pr-4 text-muted-foreground">
                          {c.reason}
                        </td>
                        <td className="py-3 pr-4 text-xs text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="py-3">
                          <CorrectionStateBadge state={c.state} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </GsapReveal>
  );
}
