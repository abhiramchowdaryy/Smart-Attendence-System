// Browser-only face-api wrapper. Keeps the dynamic import + model loading
// in one place so components stay declarative. Nothing here runs on the
// server (face-api touches window/DOM), so import it only from client
// components. The pure math lives in lib/face.ts.

import type { Point } from "@/lib/face";

type FaceApi = typeof import("@vladmandic/face-api");

let faceapiPromise: Promise<FaceApi> | null = null;
let modelsPromise: Promise<void> | null = null;

/** Load face-api and the three model nets once; subsequent calls reuse it. */
export async function loadFaceModels(): Promise<FaceApi> {
  if (!faceapiPromise) faceapiPromise = import("@vladmandic/face-api");
  const faceapi = await faceapiPromise;
  if (!modelsPromise) {
    modelsPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
      faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
      faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
    ]).then(() => undefined);
  }
  await modelsPromise;
  return faceapi;
}

export interface FaceReading {
  /** Detection confidence 0..1. */
  score: number;
  /** 128-d identity descriptor. */
  descriptor: Float32Array;
  /** Six landmark points of each eye (for blink liveness). */
  leftEye: Point[];
  rightEye: Point[];
}

const toPoints = (pts: { x: number; y: number }[]): Point[] =>
  pts.map((p) => ({ x: p.x, y: p.y }));

/**
 * Outcome of one detection pass.
 *  - "none": no face in frame.
 *  - "multiple": more than one face — rejected, so a bystander (or a phone
 *    held up next to the real person) cannot be enrolled or matched.
 *  - "ok": exactly one face, with its landmarks + descriptor.
 */
export type DetectResult =
  | { kind: "none" }
  | { kind: "multiple"; count: number }
  | { kind: "ok"; reading: FaceReading };

/**
 * Detect ALL faces (with landmarks + descriptors) and collapse to a single
 * outcome. We use detectAllFaces rather than detectSingleFace precisely so
 * we can *see* when more than one face is present and reject it — the PDF's
 * "reject multiple faces in front of the camera" rule. With one face the
 * cost is the same as a single-face pass.
 */
export async function detectFaces(
  faceapi: FaceApi,
  video: HTMLVideoElement
): Promise<DetectResult> {
  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.4,
  });
  const results = await faceapi
    .detectAllFaces(video, options)
    .withFaceLandmarks()
    .withFaceDescriptors();

  if (results.length === 0) return { kind: "none" };
  if (results.length > 1) return { kind: "multiple", count: results.length };

  const r = results[0];
  return {
    kind: "ok",
    reading: {
      score: r.detection.score,
      descriptor: r.descriptor,
      leftEye: toPoints(r.landmarks.getLeftEye()),
      rightEye: toPoints(r.landmarks.getRightEye()),
    },
  };
}
