"use client";

import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth";
import { isValidDescriptor } from "@/lib/face";
import { FACE_VERIFICATION_ENABLED } from "@/app/student/enroll-face/actions";
import { FaceEnrollment } from "@/components/face/face-enrollment";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionError } from "@/components/section-error";
import { PageTitle } from "@/src/page-title";
import { GsapReveal } from "@/components/gsap-reveal";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function EnrollFacePage() {
  const { profile } = useAuth();
  const serverVerification = FACE_VERIFICATION_ENABLED;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["enroll-face", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("face_embedding")
        .eq("id", profile!.id)
        .maybeSingle();
      return { enrolled: isValidDescriptor(data?.face_embedding) };
    },
  });

  if (!profile || isLoading) return <PageSkeleton />;
  if (isError || !data)
    return (
      <SectionError
        error={new Error("Could not load your enrolment status.")}
        reset={() => refetch()}
      />
    );

  const enrolled = data.enrolled;

  return (
    <GsapReveal className="mx-auto max-w-md space-y-4">
      <PageTitle title="Enrol Face" />
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
            {serverVerification
              ? "A blink confirms you're live. Your photo is sent once to verify identity server-side — only a numeric embedding is stored, never the image."
              : "Your face never leaves your device as an image — only a numeric descriptor is stored, and a blink confirms you're live."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FaceEnrollment
            alreadyEnrolled={enrolled}
            serverVerification={serverVerification}
          />
        </CardContent>
      </Card>
    </GsapReveal>
  );
}
