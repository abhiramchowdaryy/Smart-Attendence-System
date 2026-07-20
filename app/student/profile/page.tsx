import type { Metadata } from "next";
import {
  CalendarDays,
  Droplets,
  GraduationCap,
  Home,
  IdCard,
  Phone,
  ShieldCheck,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
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

export const metadata: Metadata = { title: "My Profile" };

interface StudentDetails {
  pesu_id: string | null;
  branch: string | null;
  section: string | null;
  dob: string | null;
  blood_group: string | null;
  sslc_pct: number | null;
  puc_pct: number | null;
  father_name: string | null;
  father_phone: string | null;
  mother_name: string | null;
  mother_phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  aadhaar_last4: string | null;
}

/** "—" for anything unset, so empty profiles still render cleanly. */
const show = (v: string | null | undefined) => (v && v.trim() ? v : "—");

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-2.5 last:border-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("text-right text-sm font-medium", mono && "font-mono text-xs")}>
        {value}
      </dd>
    </div>
  );
}

/** Percentage row with a small meter — used for SSLC/PUC. */
function PctRow({ label, pct }: { label: string; pct: number | null }) {
  return (
    <div className="space-y-1.5 py-2.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-xs font-medium tabular-nums">
          {pct !== null ? `${Number(pct)}%` : "—"}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
    </div>
  );
}

export default async function StudentProfile() {
  const profile = await requireRole(["student"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("student_details")
    .select(
      "pesu_id, branch, section, dob, blood_group, sslc_pct, puc_pct, father_name, father_phone, mother_name, mother_phone, address, city, state, pincode, aadhaar_last4"
    )
    .eq("student_id", profile.id)
    .maybeSingle<StudentDetails>();

  const d = data;
  const dob = d?.dob
    ? new Date(d.dob).toLocaleDateString([], {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <GsapReveal className="space-y-6">
      {/* Identity header */}
      <Card className="overflow-hidden">
        <div
          className="h-20 bg-gradient-to-r from-[hsl(var(--pes-navy))] via-[hsl(var(--pes-navy-bright))] to-[hsl(var(--pes-orange))]"
          aria-hidden="true"
        />
        <CardContent className="relative flex flex-wrap items-end gap-4 p-6 pt-0">
          <div
            className="-mt-10 flex size-20 shrink-0 items-center justify-center rounded-2xl border-4 border-card bg-primary font-display text-2xl font-bold text-primary-foreground shadow-pop"
            aria-hidden="true"
          >
            {initials(profile.fullName)}
          </div>
          <div className="min-w-0 flex-1 pt-2">
            <h1 className="truncate text-2xl font-bold">{profile.fullName}</h1>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">{show(profile.rollNo)}</span>
              {d?.pesu_id && (
                <>
                  {" · "}
                  <span className="font-mono">{d.pesu_id}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            {d?.branch && (
              <Badge variant="secondary">
                <GraduationCap className="size-3" aria-hidden="true" />
                {d.branch}
              </Badge>
            )}
            {d?.section && <Badge variant="outline">Section {d.section}</Badge>}
            {d?.blood_group && (
              <Badge variant="absent">
                <Droplets className="size-3" aria-hidden="true" />
                {d.blood_group}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {!d && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Your detailed profile hasn&apos;t been filled in yet — the sections
            below populate once your details are added (via seed or admin).
          </CardContent>
        </Card>
      )}

      {/* Detail cards */}
      <section className="grid items-start gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
              Personal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <Row label="Date of birth" value={dob ?? "—"} />
              <Row label="Blood group" value={show(d?.blood_group)} />
              <Row label="Branch" value={show(d?.branch)} />
              <Row label="Section" value={show(d?.section)} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="size-4 text-muted-foreground" aria-hidden="true" />
              Pre-university
            </CardTitle>
            <CardDescription>Qualifying examination scores</CardDescription>
          </CardHeader>
          <CardContent>
            <PctRow label="SSLC / 10th" pct={d?.sslc_pct ?? null} />
            <PctRow label="PUC / 12th" pct={d?.puc_pct ?? null} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" aria-hidden="true" />
              Family
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <Row label="Father" value={show(d?.father_name)} />
              <Row label="Father's phone" value={show(d?.father_phone)} mono />
              <Row label="Mother" value={show(d?.mother_name)} />
              <Row label="Mother's phone" value={show(d?.mother_phone)} mono />
            </dl>
            {(d?.father_phone || d?.mother_phone) && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="size-3.5" aria-hidden="true" />
                Used for attendance-shortfall alerts (planned).
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="size-4 text-muted-foreground" aria-hidden="true" />
              Address
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <Row label="Street" value={show(d?.address)} />
              <Row label="City" value={show(d?.city)} />
              <Row label="State" value={show(d?.state)} />
              <Row label="PIN code" value={show(d?.pincode)} mono />
            </dl>
          </CardContent>
        </Card>
      </section>

      {/* Identity documents — deliberately minimal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IdCard className="size-4 text-muted-foreground" aria-hidden="true" />
            Identity documents
          </CardTitle>
          <CardDescription>
            Only the last 4 digits of Aadhaar are ever stored — the full
            number never enters this system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl>
            <Row
              label="Aadhaar"
              value={d?.aadhaar_last4 ? `••••-••••-${d.aadhaar_last4}` : "—"}
              mono
            />
          </dl>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Masked by design; visible to you and administrators only.
          </p>
        </CardContent>
      </Card>
    </GsapReveal>
  );
}
