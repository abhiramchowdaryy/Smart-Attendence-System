import type { Metadata } from "next";
import { Building2, CalendarOff } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { GsapReveal } from "@/components/gsap-reveal";
import {
  DepartmentManager,
  type DepartmentRow,
} from "@/components/admin/department-manager";
import {
  HolidayManager,
  type HolidayRow,
} from "@/components/admin/holiday-manager";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Institution" };

export default async function AdminInstitution() {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: departments }, { data: holidays }] = await Promise.all([
    supabase
      .from("departments")
      .select("id, code, name")
      .order("code")
      .returns<DepartmentRow[]>(),
    supabase
      .from("holidays")
      .select("id, day, name")
      .gte("day", today)
      .order("day")
      .returns<HolidayRow[]>(),
  ]);

  return (
    <GsapReveal className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Institution</h1>
        <p className="text-sm text-muted-foreground">
          Manage departments and the holiday calendar.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-4 text-muted-foreground" aria-hidden="true" />
              Departments
            </CardTitle>
            <CardDescription>
              The academic departments students and courses belong to.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DepartmentManager departments={departments ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarOff className="size-4 text-muted-foreground" aria-hidden="true" />
              Holidays
            </CardTitle>
            <CardDescription>
              Upcoming non-instructional days. Past dates are hidden.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HolidayManager holidays={holidays ?? []} />
          </CardContent>
        </Card>
      </div>
    </GsapReveal>
  );
}
