"use client";

import { useActionState, useState, useTransition } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  LoaderCircle,
  Plus,
  Trash2,
} from "lucide-react";
import {
  addDepartment,
  deleteDepartment,
  type InstitutionState,
} from "@/app/admin/institution/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: InstitutionState = {};

export interface DepartmentRow {
  id: string;
  code: string;
  name: string;
}

export function DepartmentManager({
  departments,
}: {
  departments: DepartmentRow[];
}) {
  const [state, action, pending] = useActionState(addDepartment, INITIAL);
  const [delError, setDelError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function remove(id: string) {
    setDelError(null);
    setDeletingId(id);
    startTransition(async () => {
      const res = await deleteDepartment(id);
      if (res.error) setDelError(res.error);
      setDeletingId(null);
    });
  }

  return (
    <div className="space-y-5">
      {departments.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No departments yet — add your first below.
        </p>
      ) : (
        <ul className="space-y-2">
          {departments.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-3 rounded-md border bg-card p-3 text-sm transition-colors hover:bg-muted/50"
            >
              <Building2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{d.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{d.code}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete department ${d.code}`}
                disabled={deletingId === d.id}
                onClick={() => remove(d.id)}
              >
                {deletingId === d.id ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {delError && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {delError}
        </p>
      )}

      <form action={action} className="space-y-4 rounded-md border border-dashed p-4">
        <p className="text-sm font-medium">Add a department</p>
        <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
          <div className="space-y-2">
            <Label htmlFor="dept-code">Code</Label>
            <Input id="dept-code" name="code" placeholder="CSE" autoCapitalize="characters" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dept-name">Name</Label>
            <Input id="dept-name" name="name" placeholder="Computer Science & Engineering" required />
          </div>
        </div>

        {state.error && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {state.error}
          </p>
        )}
        {state.message && (
          <p role="status" className="flex items-start gap-2 rounded-md bg-status-present/10 p-3 text-sm text-status-present">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {state.message}
          </p>
        )}

        <Button type="submit" disabled={pending}>
          {pending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          {pending ? "Saving…" : "Add department"}
        </Button>
      </form>
    </div>
  );
}
