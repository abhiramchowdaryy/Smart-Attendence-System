"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, LoaderCircle, ScanFace, ShieldCheck, XCircle } from "lucide-react";
import { BiometricScanner, type ScanStatus } from "@/components/face/biometric-scanner";
import { Button } from "@/components/ui/button";
import { enrollFace } from "@/app/student/enroll-face/actions";

type Result =
  | { kind: "idle" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export function FaceEnrollment({
  alreadyEnrolled,
  serverVerification = false,
}: {
  alreadyEnrolled: boolean;
  /** When true, FACE_SERVICE_URL is set: capture a still and send it so the
   *  server can compute and store a DeepFace embedding. */
  serverVerification?: boolean;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ScanStatus | null>(null);
  const [result, setResult] = useState<Result>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  const canSave =
    status?.phase === "ready" &&
    status.descriptor !== null &&
    // With server verification on, the still is required — don't enable Save
    // until we actually have one captured.
    (!serverVerification || status.imageDataUrl !== null) &&
    !pending &&
    result.kind !== "success";

  function save() {
    const descriptor = status?.descriptor;
    if (!descriptor) return;
    startTransition(async () => {
      const res = await enrollFace({
        descriptor,
        image: serverVerification ? status?.imageDataUrl : null,
      });
      if (res.ok) {
        setResult({ kind: "success" });
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["enroll-face"] });
          queryClient.invalidateQueries({ queryKey: ["mark-attendance"] });
        }, 1600);
      } else {
        setResult({ kind: "error", message: res.error ?? "Enrolment failed." });
      }
    });
  }

  if (result.kind === "success") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg bg-status-present/10 p-8 text-center">
        <CheckCircle2 className="size-10 text-status-present" aria-hidden="true" />
        <p className="font-display text-lg font-semibold text-status-present">
          Face enrolled
        </p>
        <p className="text-sm text-muted-foreground">
          You can now mark attendance with face verification.
        </p>
      </div>
    );
  }

  // Enrolment is first-write-only server-side, so when a face already
  // exists there is nothing this screen can do — don't open the camera at
  // all. Starting a face-api detection loop whose result can only be
  // rejected would burn CPU and battery and prompt for camera permission
  // for no reason.
  if (alreadyEnrolled) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg bg-muted p-8 text-center">
        <ShieldCheck className="size-10 text-status-present" aria-hidden="true" />
        <p className="font-display text-lg font-semibold">Face already enrolled</p>
        <p className="text-sm text-muted-foreground">
          Your face is registered and used to verify attendance. To replace it
          — a poor original capture, or a change in appearance — ask an admin
          to reset your enrolment from the admin dashboard, then enrol again.
        </p>
        <p className="text-xs text-muted-foreground">
          Resets are staff-only on purpose: it&apos;s what stops someone else
          re-registering their face on your account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BiometricScanner
        mode="enroll"
        captureImage={serverVerification}
        onStatus={setStatus}
      />

      {result.kind === "error" && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {result.message}
        </p>
      )}

      <Button
        size="lg"
        variant="accent"
        className="w-full"
        disabled={!canSave}
        onClick={save}
      >
        {pending ? (
          <>
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Saving…
          </>
        ) : (
          <>
            <ScanFace className="size-4" aria-hidden="true" />
            Save my face
          </>
        )}
      </Button>

      {!canSave && (
        <p className="text-center text-xs text-muted-foreground">
          Blink once, then hold still until the frame turns green.
        </p>
      )}
    </div>
  );
}
