"""Thin wrapper around DeepFace — the only module that imports the heavy deps.

Isolating the model calls here keeps ``face_logic.py`` pure and lets the app and
its tests import the decision logic without pulling in TensorFlow. DeepFace,
numpy and OpenCV are imported lazily so ``import engine`` is cheap and a machine
without the models installed can still run the pure test suite.
"""

from __future__ import annotations

import io
import threading

import config
from face_logic import find_distance, is_valid_embedding

# DeepFace is not thread-safe during its first model build; serialise the very
# first inference so two concurrent requests can't race the lazy model load.
_model_lock = threading.Lock()
_warmed = False


class NoFaceError(ValueError):
    """Raised when the detector finds no face in the supplied image."""


class MultipleFacesError(ValueError):
    """Raised when more than one face is present — identity would be ambiguous."""


def _decode_to_array(image_bytes: bytes):
    """Bytes → RGB numpy array DeepFace can consume, via Pillow."""
    import numpy as np
    from PIL import Image

    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as exc:  # noqa: BLE001 — Pillow raises a grab-bag of errors
        raise ValueError("could not decode image bytes as an image") from exc
    return np.asarray(img)


def represent(image_bytes: bytes) -> list[float]:
    """Return the face embedding for the single face in ``image_bytes``.

    Raises NoFaceError / MultipleFacesError so the caller can return a precise,
    actionable message instead of a generic 500.
    """
    from deepface import DeepFace

    arr = _decode_to_array(image_bytes)

    with _model_lock:
        faces = DeepFace.represent(
            img_path=arr,
            model_name=config.MODEL_NAME,
            detector_backend=config.DETECTOR_BACKEND,
            enforce_detection=config.ENFORCE_DETECTION,
            align=True,
        )

    # DeepFace returns one dict per detected face. Attendance demands exactly
    # one: zero is a spoof/framing failure, more than one is ambiguous identity.
    if not faces:
        raise NoFaceError("no face detected in the image")
    if len(faces) > 1:
        raise MultipleFacesError(
            f"{len(faces)} faces detected — frame a single face"
        )

    embedding = faces[0].get("embedding")
    if not is_valid_embedding(embedding):
        raise ValueError("model returned an invalid embedding")
    return [float(x) for x in embedding]


def verify_against_embedding(
    image_bytes: bytes, reference_embedding: list[float]
) -> dict:
    """Verify the face in ``image_bytes`` against a stored reference embedding.

    This is the authoritative server-side path: the incoming *image* is
    re-embedded here, so a forged client-side descriptor can't assert identity.
    """
    from face_logic import build_verify_result

    live = represent(image_bytes)
    if len(live) != len(reference_embedding):
        raise ValueError(
            "reference embedding was produced by a different model "
            f"({len(reference_embedding)} dims vs live {len(live)})"
        )
    distance = find_distance(live, reference_embedding, config.DISTANCE_METRIC)
    result = build_verify_result(
        distance=distance,
        model_name=config.MODEL_NAME,
        metric=config.DISTANCE_METRIC,
    )
    result["dims"] = len(live)
    return result


def verify_pair(image_a: bytes, image_b: bytes) -> dict:
    """Verify two images are the same person (both re-embedded server-side)."""
    from face_logic import build_verify_result

    emb_a = represent(image_a)
    emb_b = represent(image_b)
    distance = find_distance(emb_a, emb_b, config.DISTANCE_METRIC)
    result = build_verify_result(
        distance=distance,
        model_name=config.MODEL_NAME,
        metric=config.DISTANCE_METRIC,
    )
    result["dims"] = len(emb_a)
    return result


def warm_up() -> None:
    """Build the model once so the first real request isn't paying for it.

    Runs a represent() on a tiny synthetic image with detection disabled, which
    forces the model weights to load without needing a real face.
    """
    global _warmed
    if _warmed:
        return
    import numpy as np
    from deepface import DeepFace

    blank = np.zeros((160, 160, 3), dtype=np.uint8)
    with _model_lock:
        DeepFace.represent(
            img_path=blank,
            model_name=config.MODEL_NAME,
            detector_backend="skip",  # no detection — we only want the weights loaded
            enforce_detection=False,
            align=False,
        )
    _warmed = True
