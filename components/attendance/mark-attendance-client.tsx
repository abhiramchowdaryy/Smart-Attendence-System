"use client";

import { useRef, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { CheckCircle2, DoorOpen, LoaderCircle, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BiometricScanner,
  type ScanStatus,
} from "@/components/face/biometric-scanner";
import { SuccessCheck } from "@/components/attendance/success-check";
import { GeofenceIndicator } from "@/components/attendance/geofence-indicator";
import { useGeofence } from "@/hooks/use-geofence";
import { Button } from "@/components/ui/button";
import { markEntry, markExit } from "@/app/student/mark-attendance/actions";

gsap.registerPlugin(useGSAP);

interface Props {
  session: {
    id: string;
    course: string;
    roomName: string;
    center: { lat: number; lng: number };
    radiusM: number;
  };
  /** Existing open attendance record (entry made, no exit yet), if any. */
  openAttendanceId: string | null;
  /** The student's enrolled 128-d descriptor, for live identity match. */
  enrolledDescriptor: number[] | null;
  /** Admin GPS policy: request high-accuracy geolocation. */
  highAccuracy: boolean;
  /** Admin GPS policy: metres of GPS-drift grace beyond the radius. Mirrors
   *  the server so the chip/button match markEntry's decision. */
  accuracyGraceM: number;
  /** FACE_SERVICE_URL is set: capture a still and verify server-side. */
  serverVerification?: boolean;
}

type Result =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function MarkAttendanceClient({
  session,
  openAttendanceId,
  enrolledDescriptor,
  highAccuracy,
  accuracyGraceM,
  serverVerification = false,
}: Props) {
  const queryClient = useQueryClient();
  const geo = useGeofence(
    session.center,
    session.radiusM,
    highAccuracy,
    accuracyGraceM
  );
  const [scan, setScan] = useState<ScanStatus | null>(null);
  const [result, setResult] = useState<Result>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  // ── Exit mode: entry already recorded, waiting for exit ────────────
  if (openAttendanceId) {
    return (
      <div className="space-y-4">
        <p className="rounded-md bg-status-present/10 p-4 text-sm text-status-present">
          <CheckCircle2 className="mr-2 inline size-4" aria-hidden="true" />
          Entry recorded for <strong>{session.course}</strong>. Tap below when
          you leave the classroom to log your exit and total duration.
        </p>
        <ResultBanner result={result} />
        <Button
          size="lg"
          variant="outline"
          className="w-full"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await markExit(openAttendanceId);
              setResult(
                res.ok
                  ? { kind: "success", message: "Exit recorded — see your dashboard for the duration." }
                  : { kind: "error", message: res.error ?? "Something went wrong." }
              );
            })
          }
        >
          {pending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <DoorOpen className="size-4" aria-hidden="true" />
          )}
          {pending ? "Recording exit…" : "Mark Exit"}
        </Button>
      </div>
    );
  }

  // ── Entry mode ──────────────────────────────────────────────────────
  const geoReady = geo.status === "inside";
  const faceReady =
    scan?.phase === "ready" &&
    scan.descriptor !== null &&
    // With server verification on, the still is required for the mark to pass.
    (!serverVerification || scan.imageDataUrl !== null);
  const ready = faceReady && geoReady && !pending && result.kind !== "success";

  return (
    <EntryView
      ready={ready}
      scan={scan}
      geo={geo}
      setScan={setScan}
      session={session}
      enrolledDescriptor={enrolledDescriptor}
      serverVerification={serverVerification}
      result={result}
      pending={pending}
      onMark={() => {
        if (geo.status !== "inside") return;
        const descriptor = scan?.descriptor;
        if (!descriptor) return;
        const { coords, accuracy } = geo;
        startTransition(async () => {
          const res = await markEntry({
            sessionId: session.id,
            lat: coords.lat,
            lng: coords.lng,
            accuracy,
            faceConfidence: scan?.score ?? 0,
            descriptor,
            image: serverVerification ? scan?.imageDataUrl : null,
          });
          setResult(
            res.ok
              ? {
                  kind: "success",
                  message:
                    res.status === "late"
                      ? `Entry recorded — marked Late (session opened over ${res.lateAfterMin ?? 10} min ago).`
                      : "Entry recorded — you're marked Present.",
                }
              : { kind: "error", message: res.error ?? "Something went wrong." }
          );
          if (res.ok)
            setTimeout(() => {
              queryClient.invalidateQueries({ queryKey: ["mark-attendance"] });
              queryClient.invalidateQueries({ queryKey: ["student-dashboard"] });
            }, 1600);
        });
      }}
    />
  );
}

function EntryView({
  ready,
  scan,
  geo,
  setScan,
  session,
  enrolledDescriptor,
  serverVerification,
  result,
  pending,
  onMark,
}: {
  ready: boolean;
  scan: ScanStatus | null;
  geo: ReturnType<typeof useGeofence>;
  setScan: (s: ScanStatus) => void;
  session: Props["session"];
  enrolledDescriptor: number[] | null;
  serverVerification: boolean;
  result: Result;
  pending: boolean;
  onMark: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  // A single attention pulse the moment both gates pass.
  useGSAP(() => {
    if (!ready || !buttonRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(
      buttonRef.current,
      { scale: 1 },
      { scale: 1.03, duration: 0.16, yoyo: true, repeat: 1, ease: "power2.inOut" }
    );
  }, [ready]);

  const faceReady = scan?.phase === "ready";

  return (
    <div className="space-y-4">
      <BiometricScanner
        mode="verify"
        targetDescriptor={enrolledDescriptor}
        captureImage={serverVerification}
        onStatus={setScan}
      />
      <GeofenceIndicator state={geo} roomName={session.roomName} />
      <ResultBanner result={result} />

      <Button
        ref={buttonRef}
        size="lg"
        variant="accent"
        className="w-full"
        disabled={!ready}
        onClick={onMark}
      >
        {pending ? (
          <>
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Verifying &amp; marking…
          </>
        ) : (
          <>
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Mark Entry
          </>
        )}
      </Button>

      {!ready && result.kind !== "success" && (
        <p className="text-center text-xs text-muted-foreground">
          {!faceReady && geo.status !== "inside"
            ? "Waiting for face verification and location…"
            : !faceReady
              ? "Complete the face + blink check above…"
              : "Waiting for you to be inside the geofence…"}
        </p>
      )}
    </div>
  );
}

function ResultBanner({ result }: { result: Result }) {
  return (
    <AnimatePresence>
      {result.kind === "success" && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="flex flex-col items-center gap-2 rounded-md bg-status-present/10 p-4 text-center text-sm text-status-present"
        >
          <SuccessCheck />
          {result.message}
        </motion.div>
      )}
      {result.kind === "error" && (
        <motion.p
          role="alert"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {result.message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
