"""Runtime configuration for the face service, read once from the environment.

Every knob has a sensible free-tier default so the service boots with no env
set at all. Defaults are chosen for a CPU-only box (Render free tier): a strong
but not enormous model, and a detector that trades a little accuracy for not
needing GPU-class compute.
"""

from __future__ import annotations

import os

from face_logic import VALID_METRICS


def _clean(name: str, default: str) -> str:
    value = os.getenv(name, default).strip()
    return value or default


# The FaceNet-512 model is a good CPU-friendly accuracy/size balance. Override
# with FACE_MODEL (e.g. "ArcFace", "VGG-Face") if you have the headroom.
MODEL_NAME = _clean("FACE_MODEL", "Facenet512")

# opencv is the lightest detector and needs no extra model download; retinaface
# / mtcnn are more accurate but heavier. Kept configurable for deployments that
# can afford it.
DETECTOR_BACKEND = _clean("FACE_DETECTOR", "opencv")

DISTANCE_METRIC = _clean("FACE_DISTANCE_METRIC", "cosine")
if DISTANCE_METRIC not in VALID_METRICS:
    DISTANCE_METRIC = "cosine"

# When true, DeepFace raises if it can't find a face — the correct behaviour for
# attendance (a frame with no face must not silently pass). Set to "false" only
# for debugging.
ENFORCE_DETECTION = _clean("FACE_ENFORCE_DETECTION", "true").lower() != "false"

# Optional shared secret. When set, callers must send it as X-Face-Service-Token.
# The Next.js app sends the same value from its FACE_SERVICE_TOKEN env var. Leave
# unset only for local development.
SERVICE_TOKEN = os.getenv("FACE_SERVICE_TOKEN", "").strip()

# Optional model warm-up at startup so the first real request isn't slow. On the
# smallest instances the cold model load can take 30–60s; warming it during boot
# keeps p99 latency sane at the cost of a slower start.
WARM_ON_STARTUP = _clean("FACE_WARM_ON_STARTUP", "true").lower() != "false"


def summary() -> dict:
    """Non-secret config, safe to expose on /health."""
    return {
        "model": MODEL_NAME,
        "detector": DETECTOR_BACKEND,
        "metric": DISTANCE_METRIC,
        "enforce_detection": ENFORCE_DETECTION,
        "auth_required": bool(SERVICE_TOKEN),
    }
