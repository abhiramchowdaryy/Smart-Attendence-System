"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Eye,
  LoaderCircle,
  ScanFace,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { cn, FACE_CONFIDENCE_MIN } from "@/lib/utils";
import {
  BLINK_EAR_THRESHOLD,
  blinkRatio,
  euclideanDistance,
  isFaceMatch,
  matchConfidence,
  serializeDescriptor,
} from "@/lib/face";
import { loadFaceModels, detectFace } from "@/lib/face-client";

/** EAR above this = eye open (hysteresis above the closed threshold). */
const OPEN_EAR = 0.28;
const DETECT_INTERVAL_MS = 350;

export type ScanPhase =
  | "loading"
  | "no-models"
  | "denied"
  | "searching"
  | "blink"
  | "no-match"
  | "ready";

export interface ScanStatus {
  phase: ScanPhase;
  /** Detection quality 0..1. */
  score: number;
  /** Blink liveness satisfied. */
  liveness: boolean;
  /** Verify mode: distance to the enrolled descriptor. */
  distance: number | null;
  /** Verify mode: whether the live face matches the enrolled one. */
  matched: boolean | null;
  /** Latest usable descriptor (serialized), once quality + liveness pass. */
  descriptor: number[] | null;
}

const IDLE: ScanStatus = {
  phase: "loading",
  score: 0,
  liveness: false,
  distance: null,
  matched: null,
  descriptor: null,
};

/**
 * Live biometric capture. Requires a blink (anti-spoof liveness) before it
 * will accept a face, then either captures the descriptor (enroll) or
 * matches it against an enrolled one (verify). Status is reported upward;
 * the parent owns the resulting action (save / mark).
 */
export function BiometricScanner({
  mode,
  targetDescriptor,
  onStatus,
}: {
  mode: "enroll" | "verify";
  /** Required in verify mode: the enrolled 128-d descriptor. */
  targetDescriptor?: number[] | null;
  onStatus?: (status: ScanStatus) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const blink = useRef({ sawOpen: false, sawClosed: false, done: false });
  const [status, setStatus] = useState<ScanStatus>(IDLE);

  // Keep the latest callback without restarting the camera effect.
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  const targetRef = useRef(targetDescriptor);
  targetRef.current = targetDescriptor;

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function publish(next: ScanStatus) {
      if (cancelled) return;
      setStatus(next);
      onStatusRef.current?.(next);
    }

    (async () => {
      let faceapi;
      try {
        faceapi = await loadFaceModels();
      } catch {
        publish({ ...IDLE, phase: "no-models" });
        return;
      }
      if (cancelled) return;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 } },
          audio: false,
        });
      } catch {
        publish({ ...IDLE, phase: "denied" });
        return;
      }
      if (cancelled || !videoRef.current) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }
      videoRef.current.srcObject = stream;
      publish({ ...IDLE, phase: "searching" });

      // Self-scheduling loop rather than setInterval. A single detection
      // pass (detector + landmarks + descriptor) can exceed the interval on
      // a mid-range phone; with setInterval those passes overlap, queue up,
      // and pin the main thread — the classic symptom is a scanner that
      // gets progressively jankier the longer it runs and never recovers.
      // Scheduling the next tick only after the previous one settles keeps
      // CPU bounded no matter how slow an individual pass is.
      const tick = async () => {
        if (cancelled) return;
        const video = videoRef.current;
        if (!video || video.readyState < 2) {
          timer = setTimeout(tick, DETECT_INTERVAL_MS);
          return;
        }

        let reading: Awaited<ReturnType<typeof detectFace>> = null;
        try {
          reading = await detectFace(faceapi, video);
        } catch {
          // A transient decode/inference failure should not kill the loop;
          // treat it as "no face this frame" and keep scanning.
          reading = null;
        }
        if (cancelled) return;

        publishReading(reading);
        if (!cancelled) timer = setTimeout(tick, DETECT_INTERVAL_MS);
      };

      function publishReading(reading: Awaited<ReturnType<typeof detectFace>>) {
        if (!reading) {
          blink.current = { sawOpen: false, sawClosed: false, done: false };
          publish({
            phase: "searching",
            score: 0,
            liveness: false,
            distance: null,
            matched: null,
            descriptor: null,
          });
          return;
        }

        // ── Blink liveness state machine ──────────────────────────
        const ear = blinkRatio(reading.leftEye, reading.rightEye);
        const b = blink.current;
        if (ear > OPEN_EAR) {
          b.sawOpen = true;
          if (b.sawClosed) b.done = true;
        } else if (b.sawOpen && ear < BLINK_EAR_THRESHOLD) {
          b.sawClosed = true;
        }
        const liveness = b.done;

        if (!liveness) {
          publish({
            phase: "blink",
            score: reading.score,
            liveness: false,
            distance: null,
            matched: null,
            descriptor: null,
          });
          return;
        }

        // ── Post-liveness: quality gate, then capture / match ─────
        const serialized = serializeDescriptor(reading.descriptor);
        const qualityOk = reading.score >= FACE_CONFIDENCE_MIN;

        if (mode === "verify") {
          const target = targetRef.current;
          if (!target) {
            publish({
              phase: "no-match",
              score: reading.score,
              liveness: true,
              distance: null,
              matched: false,
              descriptor: serialized,
            });
            return;
          }
          const distance = euclideanDistance(reading.descriptor, target);
          const matched = isFaceMatch(distance);
          publish({
            phase: matched && qualityOk ? "ready" : "no-match",
            score: reading.score,
            liveness: true,
            distance,
            matched,
            descriptor: serialized,
          });
          return;
        }

        // enroll
        publish({
          phase: qualityOk ? "ready" : "blink",
          score: reading.score,
          liveness: true,
          distance: null,
          matched: null,
          descriptor: qualityOk ? serialized : null,
        });
      }

      void tick();
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      // Detach the stream so the element releases its last decoded frame;
      // without this the camera indicator can linger on some browsers.
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [mode]);

  return <ScannerView status={status} mode={mode} videoRef={videoRef} />;
}

function ScannerView({
  status,
  mode,
  videoRef,
}: {
  status: ScanStatus;
  mode: "enroll" | "verify";
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  const pct = Math.round(status.score * 100);
  const borderTone =
    status.phase === "ready"
      ? "border-status-present"
      : status.phase === "no-match"
        ? "border-status-absent"
        : status.phase === "blink"
          ? "border-status-late animate-pulse-ring"
          : "border-border";

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "relative aspect-square w-full overflow-hidden rounded-lg border-4 bg-muted transition-colors duration-300",
          borderTone
        )}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="size-full -scale-x-100 object-cover"
        />

        {status.phase === "loading" && (
          <Overlay>
            <LoaderCircle className="size-8 animate-spin" aria-hidden="true" />
            <p className="text-sm">Loading face models…</p>
          </Overlay>
        )}
        {status.phase === "denied" && (
          <Overlay>
            <CameraOff className="size-8" aria-hidden="true" />
            <p className="text-sm font-medium">Camera unavailable</p>
            <p className="text-xs">Allow camera access, then reload.</p>
          </Overlay>
        )}
        {status.phase === "no-models" && (
          <Overlay>
            <ScanFace className="size-8" aria-hidden="true" />
            <p className="text-sm font-medium">Face models missing</p>
            <p className="text-xs">
              Run <code className="font-mono">npm run download-models</code>.
            </p>
          </Overlay>
        )}

        {/* Position guide */}
        {status.phase !== "loading" &&
          status.phase !== "denied" &&
          status.phase !== "no-models" && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-[12%] rounded-[50%] border-2 border-dashed border-white/50"
            />
          )}

        {/* Blink prompt */}
        {status.phase === "blink" && !status.liveness && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <span className="flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-sm font-medium text-white">
              <Eye className="size-4" aria-hidden="true" />
              Blink once to confirm you&apos;re live
            </span>
          </div>
        )}
      </div>

      <StatusLine status={status} mode={mode} pct={pct} />
    </div>
  );
}

function StatusLine({
  status,
  mode,
  pct,
}: {
  status: ScanStatus;
  mode: "enroll" | "verify";
  pct: number;
}) {
  let Icon = Camera;
  let tone = "text-muted-foreground";
  let text: string;

  switch (status.phase) {
    case "loading":
    case "denied":
    case "no-models":
      text = "Preparing camera…";
      break;
    case "searching":
      text = "Position your face inside the oval";
      break;
    case "blink":
      Icon = Eye;
      text = status.liveness
        ? `Hold still… quality ${pct}% (need ${Math.round(FACE_CONFIDENCE_MIN * 100)}%+)`
        : "Waiting for a blink…";
      break;
    case "no-match":
      Icon = ShieldAlert;
      tone = "text-status-absent";
      text =
        status.matched === false && status.distance !== null
          ? `Face doesn't match your enrolment (${Math.round(matchConfidence(status.distance) * 100)}% similar)`
          : "No enrolled face to match — enrol first";
      break;
    case "ready":
      Icon = ShieldCheck;
      tone = "text-status-present";
      text =
        mode === "verify"
          ? `Identity verified (${Math.round(matchConfidence(status.distance ?? 0) * 100)}% match) — live`
          : `Face captured — quality ${pct}%, live`;
      break;
  }

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-2 text-sm font-medium", tone)}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {text}
    </p>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted p-6 text-center text-muted-foreground">
      {children}
    </div>
  );
}
