import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { isValidDescriptor } from "@/lib/face";
import { FaceEnrollment } from "@/components/face/face-enrollment";
import { GsapReveal } from "@/components/gsap-reveal";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Enrol Face" };

export default async function EnrollFacePage() {
  const profile = await requireRole(["student"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("face_embedding")
    .eq("id", profile.id)
    .maybeSingle();

  const enrolled = isValidDescriptor(data?.face_embedding);

  return (
    <GsapReveal className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Face Enrolment</h1>
        <p className="text-sm text-muted-foreground">
          Register your face once so attendance can verify it&apos;s really you.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
            {enrolled ? "Face enrolled" : "Enrol your face"}
          </CardTitle>
          <CardDescription>
            Your face never leaves your device as an image — only a numeric
            descriptor is stored, and a blink confirms you&apos;re live.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FaceEnrollment alreadyEnrolled={enrolled} />
        </CardContent>
      </Card>
    </GsapReveal>
  );
}
