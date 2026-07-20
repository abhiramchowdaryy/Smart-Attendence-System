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
 * Detect the single most prominent face with landmarks + descriptor.
 * Returns null when no face is found.
 */
export async function detectFace(
  faceapi: FaceApi,
  video: HTMLVideoElement
): Promise<FaceReading | null> {
  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.4,
  });
  const result = await faceapi
    .detectSingleFace(video, options)
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
