"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  CheckCircle2,
  CircleDashed,
  DoorOpen,
  LoaderCircle,
  XCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FaceCapture, type FaceStatus } from "@/components/attendance/face-capture";
import { SuccessCheck } from "@/components/attendance/success-check";
import { GeofenceIndicator } from "@/components/attendance/geofence-indicator";
import { useGeofence } from "@/hooks/use-geofence";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
}

type Result =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function MarkAttendanceClient({ session, openAttendanceId }: Props) {
  const router = useRouter();
  const geo = useGeofence(session.center, session.radiusM);
  const [face, setFace] = useState<FaceStatus>({ confidence: 0, ok: false });
  const [result, setResult] = useState<Result>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  // ── Exit mode: entry already recorded, waiting for exit ────────────
  if (openAttendanceId) {
    return (
      <div className="space-y-4">
        <p className="rounded-md bg-status-present/10 p-4 text-sm text-status-present-strong">
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
  const ready = face.ok && geoReady && !pending && result.kind !== "success";

  return (
    <EntryView
      ready={ready}
      face={face}
      geo={geo}
      setFace={setFace}
      session={session}
      result={result}
      pending={pending}
      onMark={() => {
        if (geo.status !== "inside") return;
        const { coords, accuracy } = geo;
        startTransition(async () => {
          const res = await markEntry({
            sessionId: session.id,
            lat: coords.lat,
            lng: coords.lng,
            accuracy,
            faceConfidence: face.confidence,
          });
          setResult(
            res.ok
              ? {
                  kind: "success",
                  message:
                    res.status === "late"
                      ? "Entry recorded — marked Late (session opened over 10 min ago)."
                      : "Entry recorded — you're marked Present.",
                }
              : { kind: "error", message: res.error ?? "Something went wrong." }
          );
          // Refresh the server page so it switches into Exit mode.
          if (res.ok) setTimeout(() => router.refresh(), 1600);
        });
      }}
    />
  );
}

/**
 * Live requirements checklist — replaces a single ambiguous waiting
 * line. Both gates are visible at once, so the student always knows
 * exactly which one is still pending.
 */
function ReadinessChecklist({
  faceOk,
  geoOk,
}: {
  faceOk: boolean;
  geoOk: boolean;
}) {
  const items = [
    { ok: faceOk, label: "Face detected" },
    { ok: geoOk, label: "Inside the classroom geofence" },
  ];
  return (
    <ul aria-live="polite" className="space-y-1.5 text-sm">
      {items.map(({ ok, label }) => (
        <li
          key={label}
          className={cn(
            "flex items-center gap-2 font-medium",
            ok ? "text-status-present-strong" : "text-muted-foreground"
          )}
        >
          {ok ? (
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          ) : (
            <CircleDashed
              className="size-4 shrink-0 animate-spin [animation-duration:3s] motion-reduce:animate-none"
              aria-hidden="true"
            />
          )}
          {label}
          <span className="sr-only">{ok ? " — done" : " — waiting"}</span>
        </li>
      ))}
    </ul>
  );
}

function EntryView({
  ready,
  face,
  geo,
  setFace,
  session,
  result,
  pending,
  onMark,
}: {
  ready: boolean;
  face: FaceStatus;
  geo: ReturnType<typeof useGeofence>;
  setFace: (s: FaceStatus) => void;
  session: Props["session"];
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

  return (
    <div className="space-y-4">
      <FaceCapture onStatus={setFace} />
      <GeofenceIndicator state={geo} roomName={session.roomName} />
      <ResultBanner result={result} />
      <ReadinessChecklist faceOk={face.ok} geoOk={geo.status === "inside"} />

      {/* Sticky above the mobile tab bar: the CTA stays in the thumb
          zone even when the camera pushes the page past one screen. */}
      <div className="sticky bottom-[4.5rem] z-10 md:static">
        <Button
          ref={buttonRef}
          size="lg"
          variant="accent"
          className="w-full shadow-pop"
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
      </div>
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
          className="flex flex-col items-center gap-2 rounded-md bg-status-present/10 p-4 text-center text-sm text-status-present-strong"
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
          className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-error"
        >
          <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {result.message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
