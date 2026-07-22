import type { Metadata } from "next";
import { Inbox, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { GsapReveal } from "@/components/gsap-reveal";
import { StatusPill } from "@/components/status-pill";
import { CorrectionStateBadge } from "@/components/correction-state-badge";
import { CorrectionDecision } from "@/components/admin/correction-decision";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { firstRow, type AttendanceStatus } from "@/lib/utils";

export const metadata: Metadata = { title: "Correction Requests" };

interface PendingRow {
  id: string;
  attendance_id: string;
  from_status: AttendanceStatus;
  to_status: AttendanceStatus;
  reason: string;
  created_at: string;
  requested_by: string;
}
interface DecidedRow {
  id: string;
  attendance_id: string;
  from_status: AttendanceStatus;
  to_status: AttendanceStatus;
  state: "approved" | "rejected";
  decided_at: string | null;
  requested_by: string;
  decided_by: string | null;
}
interface AttCtxRow {
  id: string;
  sessions: { course: string } | { course: string }[] | null;
  profiles: { full_name: string; roll_no: string | null } | { full_name: string; roll_no: string | null }[] | null;
}

export default async function AdminCorrections() {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const [{ data: pending }, { data: decided }] = await Promise.all([
    supabase
      .from("attendance_corrections")
      .select(
        "id, attendance_id, from_status, to_status, reason, created_at, requested_by"
      )
      .eq("state", "pending")
      .order("created_at", { ascending: true })
      .returns<PendingRow[]>(),
    supabase
      .from("attendance_corrections")
      .select(
        "id, attendance_id, from_status, to_status, state, decided_at, requested_by, decided_by"
      )
      .neq("state", "pending")
      .order("decided_at", { ascending: false })
      .limit(20)
      .returns<DecidedRow[]>(),
  ]);

  const all = [...(pending ?? []), ...(decided ?? [])];
  const attIds = [...new Set(all.map((c) => c.attendance_id))];
  const personIds = [
    ...new Set(
      all
        .flatMap((c) => [c.requested_by, "decided_by" in c ? c.decided_by : null])
        .filter((v): v is string => Boolean(v))
    ),
  ];

  const [{ data: attRows }, { data: people }] = await Promise.all([
    attIds.length
      ? supabase
          .from("attendance")
          .select("id, sessions(course), profiles(full_name, roll_no)")
          .in("id", attIds)
          .returns<AttCtxRow[]>()
      : Promise.resolve({ data: [] as AttCtxRow[] }),
    personIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", personIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const attCtx = new Map<string, { name: string; roll: string | null; course: string }>();
  for (const a of attRows ?? []) {
    const p = firstRow(a.profiles);
    const s = firstRow(a.sessions);
    attCtx.set(a.id, {
      name: p?.full_name ?? "Student",
      roll: p?.roll_no ?? null,
      course: s?.course ?? "Class",
    });
  }
  const personName = new Map<string, string>();
  for (const p of people ?? []) personName.set(p.id, p.full_name);

  const pendingRows = pending ?? [];
  const decidedRows = decided ?? [];

  return (
    <GsapReveal className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Correction Requests</h1>
        <p className="text-sm text-muted-foreground">
          Approve or reject faculty requests to change an attendance status.
          Approving updates the record everywhere.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="size-4 text-muted-foreground" aria-hidden="true" />
            Pending
            {pendingRows.length > 0 && (
              <span className="rounded-full bg-status-late/15 px-2 py-0.5 text-xs font-semibold text-status-late">
                {pendingRows.length}
              </span>
            )}
          </CardTitle>
          <CardDescription>Newest at the bottom — clear the queue.</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No pending requests. You&apos;re all caught up.
            </p>
          ) : (
            <ul className="space-y-3">
              {pendingRows.map((c) => {
                const ctx = attCtx.get(c.attendance_id);
                return (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4"
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{ctx?.name ?? "Student"}</span>
                        {ctx?.roll && (
                          <span className="font-mono text-xs text-muted-foreground">
                            {ctx.roll}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          · {ctx?.course}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <StatusPill status={c.from_status} />
                        <span aria-hidden="true" className="text-muted-foreground">→</span>
                        <StatusPill status={c.to_status} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        “{c.reason}” — {personName.get(c.requested_by) ?? "Faculty"}
                      </p>
                    </div>
                    <CorrectionDecision correctionId={c.id} />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" aria-hidden="true" />
            Recently decided
          </CardTitle>
          <CardDescription>The last 20 approvals and rejections.</CardDescription>
        </CardHeader>
        <CardContent>
          {decidedRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No decisions yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-medium">Student</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Change</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Decided by</th>
                    <th scope="col" className="py-2 font-medium">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {decidedRows.map((c) => {
                    const ctx = attCtx.get(c.attendance_id);
                    return (
                      <tr
                        key={c.id}
                        className="border-b transition-colors last:border-0 hover:bg-muted/50"
                      >
                        <td className="py-3 pr-4">
                          <div className="font-medium">{ctx?.name ?? "Student"}</div>
                          <div className="text-xs text-muted-foreground">
                            {ctx?.course}
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-1.5">
                            <StatusPill status={c.from_status} />
                            <span aria-hidden="true" className="text-muted-foreground">→</span>
                            <StatusPill status={c.to_status} />
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {c.decided_by ? personName.get(c.decided_by) ?? "Admin" : "—"}
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
