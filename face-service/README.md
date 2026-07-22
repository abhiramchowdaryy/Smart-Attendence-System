# PES Smart Attendance — Face Service

A small **FastAPI + [DeepFace](https://github.com/serengil/deepface)**
microservice that does **server-side** face identity verification. It is the
target of the Next.js app's `FACE_SERVICE_URL` seam.

## Why it exists

In the base app the *live* face descriptor is produced in the browser
(`@vladmandic/face-api`) and only the **match decision** is re-checked on the
Next.js server. A sophisticated attacker who can forge WebRTC frames or POST a
hand-crafted descriptor could therefore assert an identity the server never saw
pixels for.

This service closes that hole: the browser sends the **image**, and the
embedding is computed **here, from raw pixels**, under a model the client cannot
influence. Enrolment stores a server-computed embedding; mark-attendance
re-embeds the live frame and compares. The client can no longer assert its own
identity — it can only supply pixels.

```
browser ──image──▶ Next.js server action ──image──▶ this service ──▶ DeepFace
                                                          │
                                              re-embed + distance vs enrolment
                                                          │
                            { verified, distance, threshold } ◀── decision
```

## API

All endpoints are JSON. If `FACE_SERVICE_TOKEN` is set, every endpoint except
`/health` requires the header `X-Face-Service-Token: <token>`.

| Method & path | Body | Returns |
|---|---|---|
| `GET /health` | — | `{ status, model, detector, metric, enforce_detection, auth_required }` |
| `POST /represent` | `{ image }` | `{ embedding: number[], dims, model, detector }` |
| `POST /verify` | `{ image, reference_embedding }` **or** `{ image, reference_image }` | `{ verified, distance, threshold, model, metric, dims }` |

`image` / `reference_image` are a `data:image/jpeg;base64,…` data URL (what a
browser `<canvas>` produces) or a bare base64 string. Exactly one of
`reference_embedding` or `reference_image` must be supplied to `/verify`.

**Status codes:** `400` malformed input · `401` bad/missing token · `422` no
face / multiple faces / model-dimension mismatch · `500` internal (never leaks a
stack trace).

### Examples

```bash
# Health
curl -s http://localhost:8000/health | jq

# Enrol: image → embedding (store this in profiles.face_embedding_server)
curl -s http://localhost:8000/represent \
  -H "X-Face-Service-Token: $FACE_SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"image\":\"$(base64 -w0 selfie.jpg | sed 's/^/data:image\/jpeg;base64,/')\"}" | jq

# Verify a live frame against a stored embedding
curl -s http://localhost:8000/verify \
  -H "X-Face-Service-Token: $FACE_SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"image":"data:image/jpeg;base64,…","reference_embedding":[0.01,…]}' | jq
```

## Configuration

| Env var | Default | Notes |
|---|---|---|
| `FACE_SERVICE_TOKEN` | *(unset)* | Shared secret; when set, required on every call. Match it in the Next.js app. |
| `FACE_MODEL` | `Facenet512` | Any DeepFace model (`ArcFace`, `VGG-Face`, …). |
| `FACE_DETECTOR` | `opencv` | `retinaface`/`mtcnn` are more accurate but heavier. |
| `FACE_DISTANCE_METRIC` | `cosine` | `cosine`, `euclidean`, or `euclidean_l2`. |
| `FACE_ENFORCE_DETECTION` | `true` | Raise `422` when no face is found. |
| `FACE_WARM_ON_STARTUP` | `true` | Load the model at boot so the first request isn't slow. |
| `DEEPFACE_HOME` | `~/.deepface` | Where model weights are cached. |

Thresholds are DeepFace's tuned per-(model, metric) defaults, kept in
`face_logic.THRESHOLDS`.

> **Consistency rule:** the model that produced an enrolment embedding must be
> the model that verifies it — a Facenet512 embedding (512 dims) is meaningless
> to ArcFace. The service returns `422` on a dimension mismatch. If you change
> `FACE_MODEL`, students must re-enrol.

## Run locally

```bash
cd face-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

Then point the Next.js app at it:

```bash
# .env.local in the repo root
FACE_SERVICE_URL=http://localhost:8000
FACE_SERVICE_TOKEN=            # match the service; leave blank if the service has none
```

## Docker

```bash
docker build -t pes-face-service face-service
docker run -p 8000:8000 -e FACE_SERVICE_TOKEN=dev pes-face-service
```

## Deploy to Render (free)

1. Push this repo to GitHub.
2. Render → **New → Blueprint**, pick the repo, set root directory to
   `face-service` (it reads `render.yaml`).
3. Render generates `FACE_SERVICE_TOKEN` — copy it and set the **same** value,
   plus `FACE_SERVICE_URL=https://<your-service>.onrender.com`, in the Next.js
   app's environment (Vercel project settings).
4. The free instance sleeps after 15 min idle, so the first request after a nap
   cold-starts (slow). The `/health` check keeps deploys honest.

## Tests

```bash
cd face-service
python -m unittest discover -s tests          # pure logic — no heavy deps
pip install -r requirements-dev.txt           # to also run the route tests
python -m unittest discover -s tests          # now includes app.py route tests
```

`tests/test_face_logic.py` needs only the standard library; `tests/test_app.py`
monkeypatches the DeepFace engine, so neither test suite loads TensorFlow.
