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
  /** 128-d identity descriptor. Null for landmark-only detections. */
  descriptor: Float32Array | null;
  /** Six landmark points of each eye (for blink liveness). */
  leftEye: Point[];
  rightEye: Point[];
}

const toPoints = (pts: { x: number; y: number }[]): Point[] =>
  pts.map((p) => ({ x: p.x, y: p.y }));

function detectorOptions(faceapi: FaceApi) {
  return new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.4,
  });
}

/**
 * Detect the single most prominent face with landmarks only — no identity
 * descriptor. This skips the expensive recognition net, so the blink loop
 * can run several times faster and actually sample the brief closed phase
 * of a blink. Returns null when no face is found.
 */
export async function detectFaceLandmarks(
  faceapi: FaceApi,
  video: HTMLVideoElement
): Promise<FaceReading | null> {
  const result = await faceapi
    .detectSingleFace(video, detectorOptions(faceapi))
    .withFaceLandmarks();

  if (!result) return null;

  return {
    score: result.detection.score,
    descriptor: null,
    leftEye: toPoints(result.landmarks.getLeftEye()),
    rightEye: toPoints(result.landmarks.getRightEye()),
  };
}

/**
 * Detect the single most prominent face with landmarks + descriptor.
 * Returns null when no face is found. Heavier than {@link detectFaceLandmarks};
 * use it only once liveness has passed and identity is needed.
 */
export async function detectFace(
  faceapi: FaceApi,
  video: HTMLVideoElement
): Promise<FaceReading | null> {
  const result = await faceapi
    .detectSingleFace(video, detectorOptions(faceapi))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!result) return null;

  return {
    score: result.detection.score,
    descriptor: result.descriptor,
    leftEye: toPoints(result.landmarks.getLeftEye()),
    rightEye: toPoints(result.landmarks.getRightEye()),
  };
}
