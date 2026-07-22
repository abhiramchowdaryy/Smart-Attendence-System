"""Pure verification math and input handling for the DeepFace service.

Everything here is framework-free (no FastAPI, no DeepFace, no numpy) so it
unit-tests with the standard library alone — the same discipline the Next.js
side uses for ``lib/face.ts``. The heavy model inference lives in ``engine.py``;
this module owns the parts that decide *whether two embeddings are the same
person* and *whether an incoming payload is well-formed*, which is exactly the
logic a reviewer needs to trust.
"""

from __future__ import annotations

import base64
import binascii
import math
import re
from typing import Sequence

# ── Distance thresholds ──────────────────────────────────────────────────
# DeepFace's own tuned decision thresholds, per (model, metric). Kept here as
# a plain table rather than imported from deepface so the match decision is
# version-independent and testable without the library. Values mirror
# deepface.modules.verification.find_threshold defaults. Lower distance = more
# similar; a distance at or below the threshold is a match.
THRESHOLDS: dict[str, dict[str, float]] = {
    "VGG-Face": {"cosine": 0.68, "euclidean": 1.17, "euclidean_l2": 1.17},
    "Facenet": {"cosine": 0.40, "euclidean": 10.0, "euclidean_l2": 0.80},
    "Facenet512": {"cosine": 0.30, "euclidean": 23.56, "euclidean_l2": 1.04},
    "ArcFace": {"cosine": 0.68, "euclidean": 4.15, "euclidean_l2": 1.13},
    "SFace": {"cosine": 0.593, "euclidean": 10.734, "euclidean_l2": 1.055},
    "Dlib": {"cosine": 0.07, "euclidean": 0.6, "euclidean_l2": 0.4},
    "OpenFace": {"cosine": 0.10, "euclidean": 0.55, "euclidean_l2": 0.55},
    "DeepFace": {"cosine": 0.23, "euclidean": 64.0, "euclidean_l2": 0.64},
    "GhostFaceNet": {"cosine": 0.65, "euclidean": 35.71, "euclidean_l2": 1.10},
}

# Conservative fallbacks if an unknown model/metric pairing is requested.
_FALLBACK_THRESHOLD = {"cosine": 0.40, "euclidean": 10.0, "euclidean_l2": 0.80}

VALID_METRICS = ("cosine", "euclidean", "euclidean_l2")


def find_threshold(model_name: str, metric: str) -> float:
    """Match-decision threshold for a (model, metric) pair, with a safe default."""
    return THRESHOLDS.get(model_name, {}).get(
        metric, _FALLBACK_THRESHOLD.get(metric, 0.40)
    )


# ── Vector math ──────────────────────────────────────────────────────────


def _as_floats(v: Sequence[float]) -> list[float]:
    return [float(x) for x in v]


def l2_normalize(v: Sequence[float]) -> list[float]:
    """Unit-length copy of ``v``; a zero vector is returned unchanged."""
    vec = _as_floats(v)
    norm = math.sqrt(sum(x * x for x in vec))
    if norm == 0:
        return vec
    return [x / norm for x in vec]


def cosine_distance(a: Sequence[float], b: Sequence[float]) -> float:
    """1 − cosine similarity. 0 = identical direction, 2 = opposite."""
    av, bv = _as_floats(a), _as_floats(b)
    if len(av) != len(bv):
        raise ValueError(f"embedding length mismatch: {len(av)} vs {len(bv)}")
    dot = sum(x * y for x, y in zip(av, bv))
    na = math.sqrt(sum(x * x for x in av))
    nb = math.sqrt(sum(y * y for y in bv))
    if na == 0 or nb == 0:
        return 1.0
    return 1.0 - dot / (na * nb)


def euclidean_distance(a: Sequence[float], b: Sequence[float]) -> float:
    """L2 distance between two equal-length vectors."""
    av, bv = _as_floats(a), _as_floats(b)
    if len(av) != len(bv):
        raise ValueError(f"embedding length mismatch: {len(av)} vs {len(bv)}")
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(av, bv)))


def find_distance(a: Sequence[float], b: Sequence[float], metric: str) -> float:
    """Distance under the named metric (matches DeepFace's metric names)."""
    if metric == "cosine":
        return cosine_distance(a, b)
    if metric == "euclidean":
        return euclidean_distance(a, b)
    if metric == "euclidean_l2":
        return euclidean_distance(l2_normalize(a), l2_normalize(b))
    raise ValueError(f"unknown distance metric: {metric!r}")


def is_verified(distance: float, threshold: float) -> bool:
    """True when two faces are close enough to be the same person."""
    return distance <= threshold


# ── Embedding validation ─────────────────────────────────────────────────


def is_valid_embedding(value: object) -> bool:
    """A usable embedding: a non-empty list of finite numbers."""
    return (
        isinstance(value, (list, tuple))
        and len(value) > 0
        and all(
            isinstance(x, (int, float))
            and not isinstance(x, bool)
            and math.isfinite(float(x))
            for x in value
        )
    )


# ── Image payload decoding ───────────────────────────────────────────────

# A generous cap: a 640px selfie JPEG is well under 1 MB even base64-inflated.
# This is the last line of defence against a client posting a huge payload to
# exhaust memory before the model ever runs.
MAX_IMAGE_BYTES = 6 * 1024 * 1024  # 6 MB decoded

_DATA_URL_RE = re.compile(
    r"^data:(?P<mime>image/[a-zA-Z0-9.+-]+)?(?P<b64>;base64)?,(?P<data>.*)$",
    re.DOTALL,
)

_ALLOWED_MIME = {"image/jpeg", "image/jpg", "image/png", "image/webp"}


class ImageDecodeError(ValueError):
    """Raised when an image payload is missing, malformed, or too large."""


def decode_image_payload(payload: object) -> bytes:
    """Decode a data-URL or bare base64 string to raw image bytes.

    Accepts ``data:image/jpeg;base64,<...>`` (what the browser canvas produces)
    or a bare base64 string. Rejects anything that isn't a plausible image so
    the caller never hands garbage to the model. Pure: no PIL/numpy, so the
    size and format guards are unit-testable without image libraries.
    """
    if not isinstance(payload, str) or not payload.strip():
        raise ImageDecodeError("image payload is empty")

    raw = payload.strip()
    match = _DATA_URL_RE.match(raw)
    if match:
        mime = (match.group("mime") or "image/jpeg").lower()
        if mime not in _ALLOWED_MIME:
            raise ImageDecodeError(f"unsupported image type: {mime}")
        if not match.group("b64"):
            raise ImageDecodeError("only base64 data URLs are supported")
        b64 = match.group("data")
    else:
        # Bare base64 (no data-URL prefix). Strip any incidental whitespace.
        b64 = raw

    b64 = re.sub(r"\s+", "", b64)
    if not b64:
        raise ImageDecodeError("image payload has no data")

    # Reject before decoding if the base64 is implausibly large.
    if len(b64) > MAX_IMAGE_BYTES * 4 // 3 + 4:
        raise ImageDecodeError("image payload too large")

    try:
        data = base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ImageDecodeError("image payload is not valid base64") from exc

    if len(data) < 100:
        raise ImageDecodeError("image payload too small to be a photo")
    if len(data) > MAX_IMAGE_BYTES:
        raise ImageDecodeError("image payload too large")
    return data


def build_verify_result(
    *,
    distance: float,
    model_name: str,
    metric: str,
    threshold: float | None = None,
) -> dict:
    """Assemble the /verify response body from a computed distance."""
    thr = find_threshold(model_name, metric) if threshold is None else threshold
    return {
        "verified": is_verified(distance, thr),
        "distance": round(distance, 6),
        "threshold": round(thr, 6),
        "model": model_name,
        "metric": metric,
    }
