"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Camera, CameraOff, LoaderCircle, ScanFace } from "lucide-react";
import { cn, FACE_CONFIDENCE_MIN } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

export interface FaceStatus {
  /** Detection confidence 0..1 (0 when no face). */
  confidence: number;
  /** True when confidence has been sustained above threshold. */
  ok: boolean;
}

type CameraState = "starting" | "ready" | "denied" | "no-models";

const DETECT_INTERVAL_MS = 500;
/** Consecutive good detections required — a cheap liveness/stability gate. */
const REQUIRED_STREAK = 3;

/**
 * Live camera preview with in-browser face detection. Phase 1 gates on
 * detection quality only; identity matching arrives with the
 * /api/face/verify seam in Phase 2.
 */
export function FaceCapture({
  onStatus,
}: {
  onStatus: (status: FaceStatus) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scopeRef = useRef<HTMLDivElement>(null);
  const streakRef = useRef(0);
  const [camera, setCamera] = useState<CameraState>("starting");
  const [confidence, setConfidence] = useState(0);
  const [faceOk, setFaceOk] = useState(false);

  // Scan-line sweep while searching for a face (decorative only).
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (camera !== "ready" || faceOk) return;
      gsap.fromTo(
        ".scan-line",
        { top: "8%" },
        {
          top: "88%",
          duration: 2.2,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
        }
      );
    },
    { scope: scopeRef, dependencies: [camera, faceOk] }
  );

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    (async () => {
      try {
        // face-api touches browser globals — import client-side only.
        const faceapi = await import("@vladmandic/face-api");

        try {
          await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        } catch {
          if (!cancelled) setCamera("no-models");
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 } },
          audio: false,
        });
        if (cancelled || !videoRef.current) return;

        videoRef.current.srcObject = stream;
        setCamera("ready");

        const options = new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.4,
        });

        timer = setInterval(async () => {
          const video = videoRef.current;
          if (!video || video.readyState < 2) return;

          const detection = await faceapi.detectSingleFace(video, options);
          const score = detection?.score ?? 0;

          streakRef.current =
            score >= FACE_CONFIDENCE_MIN ? streakRef.current + 1 : 0;
          const ok = streakRef.current >= REQUIRED_STREAK;

          if (!cancelled) {
            setConfidence(score);
            setFaceOk(ok);
            onStatus({ confidence: score, ok });
          }
        }, DETECT_INTERVAL_MS);
      } catch {
        if (!cancelled) setCamera("denied");
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = Math.round(confidence * 100);

  return (
    <div ref={scopeRef} className="space-y-3">
      <div
        className={cn(
          "relative aspect-square w-full overflow-hidden rounded-lg border-4 bg-muted transition-colors duration-300",
          faceOk
            ? "border-status-present"
            : camera === "ready"
              ? "border-status-late animate-pulse-ring"
              : "border-border"
        )}
      >
        {/* Mirrored preview feels natural, like a mirror */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="size-full -scale-x-100 object-cover"
        />

        {camera === "starting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
            <LoaderCircle className="size-8 animate-spin" aria-hidden="true" />
            <p className="text-sm">Starting camera…</p>
          </div>
        )}
        {camera === "denied" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted p-6 text-center text-muted-foreground">
            <CameraOff className="size-8" aria-hidden="true" />
            <p className="text-sm font-medium">Camera unavailable</p>
            <p className="text-xs">
              Allow camera access in your browser settings, then reload.
            </p>
          </div>
        )}
        {camera === "no-models" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted p-6 text-center text-muted-foreground">
            <ScanFace className="size-8" aria-hidden="true" />
            <p className="text-sm font-medium">Face models missing</p>
            <p className="text-xs">
              Run <code className="font-mono">npm run download-models</code>{" "}
              and reload this page.
            </p>
          </div>
        )}

        {/* Face-position guide */}
        {camera === "ready" && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-[12%] rounded-[50%] border-2 border-dashed border-white/50"
          />
        )}

        {/* Scanning sweep while no stable face yet */}
        {camera === "ready" && !faceOk && (
          <span
            aria-hidden="true"
            className="scan-line pointer-events-none absolute left-[10%] right-[10%] top-[8%] h-0.5 rounded-full bg-gradient-to-r from-transparent via-[hsl(var(--pes-orange))] to-transparent"
          />
        )}
      </div>

      <p
        role="status"
        aria-live="polite"
        className={cn(
          "flex items-center gap-2 text-sm font-medium",
          faceOk ? "text-status-present" : "text-muted-foreground"
        )}
      >
        <Camera className="size-4 shrink-0" aria-hidden="true" />
        {camera !== "ready"
          ? "Waiting for camera…"
          : faceOk
            ? `Face detected — quality ${pct}%`
            : confidence > 0
              ? `Hold still… quality ${pct}% (need ${Math.round(FACE_CONFIDENCE_MIN * 100)}%+)`
              : "Position your face inside the oval"}
      </p>
    </div>
  );
}
