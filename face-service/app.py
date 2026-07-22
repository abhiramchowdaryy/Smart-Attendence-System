"""FastAPI DeepFace verification service — the target of FACE_SERVICE_URL.

Contract (all JSON):

    GET  /health            → { status, model, detector, metric, ... }
    POST /represent         → { image }                      → { embedding, dims, model }
    POST /verify            → { image, reference_embedding } → { verified, distance, ... }
                              or { image, reference_image }  → { verified, distance, ... }

The Next.js server actions call /represent at enrolment (to store a server-side
embedding) and /verify at mark-attendance (re-embedding the live frame here, so
identity is decided from raw pixels rather than a browser-supplied descriptor).

Auth: if FACE_SERVICE_TOKEN is set, callers must send it as X-Face-Service-Token.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

import config
import engine
from face_logic import (
    ImageDecodeError,
    decode_image_payload,
    is_valid_embedding,
)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("face-service")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    log.info("face-service config: %s", config.summary())
    if config.WARM_ON_STARTUP:
        try:
            engine.warm_up()
            log.info("model warmed up (%s)", config.MODEL_NAME)
        except Exception as exc:  # noqa: BLE001 — warm-up is best-effort
            log.warning("model warm-up skipped: %s", exc)
    yield


app = FastAPI(
    title="PES Smart Attendance — Face Service",
    version="1.0.0",
    description="Server-side DeepFace identity verification (FACE_SERVICE_URL seam).",
    lifespan=lifespan,
)


# ── Auth ─────────────────────────────────────────────────────────────────
def require_token(x_face_service_token: str | None = Header(default=None)) -> None:
    """Reject callers without the shared secret, when one is configured."""
    if not config.SERVICE_TOKEN:
        return  # open mode (local dev)
    if x_face_service_token != config.SERVICE_TOKEN:
        raise HTTPException(status_code=401, detail="invalid or missing service token")


# ── Schemas ──────────────────────────────────────────────────────────────
class RepresentRequest(BaseModel):
    image: str = Field(..., description="data-URL or base64 image of a single face")


class VerifyRequest(BaseModel):
    image: str = Field(..., description="live frame — data-URL or base64")
    reference_embedding: list[float] | None = Field(
        default=None, description="stored enrolment embedding to match against"
    )
    reference_image: str | None = Field(
        default=None, description="alternative: an enrolment image to match against"
    )


# ── Routes ───────────────────────────────────────────────────────────────
@app.get("/health")
def health() -> dict:
    return {"status": "ok", **config.summary()}


@app.post("/represent", dependencies=[Depends(require_token)])
def represent(req: RepresentRequest) -> dict:
    image_bytes = _decode(req.image, field="image")
    try:
        embedding = engine.represent(image_bytes)
    except engine.NoFaceError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except engine.MultipleFacesError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {
        "embedding": embedding,
        "dims": len(embedding),
        "model": config.MODEL_NAME,
        "detector": config.DETECTOR_BACKEND,
    }


@app.post("/verify", dependencies=[Depends(require_token)])
def verify(req: VerifyRequest) -> dict:
    image_bytes = _decode(req.image, field="image")

    has_embedding = req.reference_embedding is not None
    has_image = bool(req.reference_image)
    if has_embedding == has_image:
        raise HTTPException(
            status_code=400,
            detail="provide exactly one of reference_embedding or reference_image",
        )

    try:
        if has_embedding:
            if not is_valid_embedding(req.reference_embedding):
                raise HTTPException(
                    status_code=400, detail="reference_embedding is malformed"
                )
            return engine.verify_against_embedding(
                image_bytes, [float(x) for x in req.reference_embedding]
            )
        ref_bytes = _decode(req.reference_image, field="reference_image")
        return engine.verify_pair(image_bytes, ref_bytes)
    except engine.NoFaceError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except engine.MultipleFacesError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _decode(payload: str, *, field: str) -> bytes:
    try:
        return decode_image_payload(payload)
    except ImageDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"{field}: {exc}") from exc


@app.exception_handler(Exception)
async def unhandled(_request, exc: Exception) -> JSONResponse:
    """Never leak a stack trace to the client; log it, return a clean 500."""
    log.exception("unhandled error: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "internal error"})
