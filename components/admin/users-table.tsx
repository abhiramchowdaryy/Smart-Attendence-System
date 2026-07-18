"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { setUserRole } from "@/app/admin/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { FormMessage } from "@/components/ui/form-message";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableContainer,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/ui/table";
import type { Role } from "@/lib/utils";

export interface UserRow {
  id: string;
  full_name: string;
  roll_no: string | null;
  role: Role;
  created_at: string;
}

const ROLE_BADGE: Record<Role, "default" | "secondary" | "outline"> = {
  admin: "default",
  faculty: "secondary",
  student: "outline",
};

/**
 * User management table with an inline role editor. The admin's own row
 * is locked (server enforces this too) so they can't lock themselves out.
 */
export function UsersTable({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function changeRole(userId: string, role: Role) {
    setPendingId(userId);
    setError(null);
    startTransition(async () => {
      const res = await setUserRole(userId, role);
      if (res.error) setError(res.error);
      setPendingId(null);
    });
  }

  return (
    <div className="space-y-3">
      {error && <FormMessage tone="error">{error}</FormMessage>}
      {/* Long list scrolls under a pinned header instead of growing the page */}
      <TableContainer className="max-h-96">
        <Table>
          <THead sticky>
            <Th>Name</Th>
            <Th>Roll no</Th>
            <Th>Role</Th>
            <Th className="pr-0">Change role</Th>
          </THead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <Tr key={u.id}>
                  <Td className="font-medium">
                    <span className="flex items-center gap-1.5">
                      {u.full_name}
                      {isSelf && (
                        <span className="text-xs text-muted-foreground">(you)</span>
                      )}
                    </span>
                  </Td>
                  <Td className="font-mono text-xs">{u.roll_no ?? "—"}</Td>
                  <Td>
                    <Badge variant={ROLE_BADGE[u.role]}>
                      {u.role === "admin" && (
                        <ShieldCheck className="size-3" aria-hidden="true" />
                      )}
                      {u.role}
                    </Badge>
                  </Td>
                  <Td className="pr-0">
                    {isSelf ? (
                      <span className="text-xs text-muted-foreground">Locked</span>
                    ) : pendingId === u.id ? (
                      <LoaderCircle
                        className="size-4 animate-spin text-muted-foreground"
                        aria-label="Updating role"
                      />
                    ) : (
                      <Select
                        aria-label={`Change role for ${u.full_name}`}
                        value={u.role}
                        onChange={(e) => changeRole(u.id, e.target.value as Role)}
                        // 44px touch target on phones, denser on desktop
                        className="h-11 w-auto px-2 text-xs md:h-9"
                      >
                        <option value="student">student</option>
                        <option value="faculty">faculty</option>
                        <option value="admin">admin</option>
                      </Select>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </TableContainer>
    </div>
  );
}
