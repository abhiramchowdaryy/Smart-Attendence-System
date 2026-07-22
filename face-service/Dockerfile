# DeepFace face-verification service.
# Slim Python base + only the system libs OpenCV/Pillow need at runtime.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    # DeepFace caches its downloaded model weights here; a named volume or the
    # image layer keeps them between restarts so cold starts don't re-download.
    DEEPFACE_HOME=/root/.deepface

# libGL + glib are the runtime deps of opencv-python-headless; the rest keep
# Pillow's image codecs working. Kept minimal to hold the image size down.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Pre-download the model weights into the image so the first request is fast and
# the service works even if the model host is unreachable at runtime. Best-effort
# — the build still succeeds offline; warm-up then happens on first boot.
RUN python -c "import engine; engine.warm_up()" || echo "warm-up skipped at build time"

EXPOSE 8000

# Single worker: the models are memory-heavy and Render's free tier is small.
# Scale with more instances rather than more workers per instance.
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
