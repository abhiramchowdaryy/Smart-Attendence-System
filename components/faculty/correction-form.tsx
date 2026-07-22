"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  requestCorrection,
  type CorrectionFormState,
} from "@/app/faculty/corrections/actions";
import type { AttendanceStatus } from "@/lib/utils";

const INITIAL: CorrectionFormState = {};

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late entry",
  absent: "Absent",
  partial: "Partial (left early)",
};

export interface CorrectionRecord {
  id: string;
  label: string;
  status: AttendanceStatus;
}

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Faculty form to propose a status change on one attendance record. */
export function CorrectionForm({ records }: { records: CorrectionRecord[] }) {
  const [state, action, pending] = useActionState(requestCorrection, INITIAL);
  const [selectedId, setSelectedId] = useState("");

  const current = records.find((r) => r.id === selectedId)?.status ?? null;
  // Offer only statuses different from the record's current one.
  const options = useMemo(
    () =>
      (Object.keys(STATUS_LABEL) as AttendanceStatus[]).filter(
        (s) => s !== current
      ),
    [current]
  );

  if (records.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No attendance records yet to correct. They appear here once students
        have marked attendance.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="attendanceId">Attendance record</Label>
        <select
          id="attendanceId"
          name="attendanceId"
          required
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className={selectClass}
        >
          <option value="" disabled>
            Choose a student's record…
          </option>
          {records.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="toStatus">Change status to</Label>
          <select
            id="toStatus"
            name="toStatus"
            required
            defaultValue=""
            className={selectClass}
            disabled={!selectedId}
          >
            <option value="" disabled>
              {selectedId ? "New status…" : "Pick a record first"}
            </option>
            {options.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reason">Reason</Label>
          <Input
            id="reason"
            name="reason"
            type="text"
            placeholder="e.g. Camera failed; marked present manually"
            required
          />
        </div>
      </div>

      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}
      {state.message && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-md bg-status-present/10 p-3 text-sm text-status-present"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={pending || !selectedId}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Requesting…
          </>
        ) : (
          <>
            <PencilLine className="size-4" aria-hidden="true" />
            Request correction
          </>
        )}
      </Button>
    </form>
  );
}
