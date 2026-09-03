# Official Playwright image — Chromium + all system deps preinstalled (Ubuntu jammy)
FROM mcr.microsoft.com/playwright/python:v1.49.1-jammy

# Add ffmpeg + curl (media) and aria2 (torrent/magnet + fast multi-connection HTTP)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    aria2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Ensure the matching Chromium build is present (image already ships it)
RUN playwright install chromium || true

COPY main.py .

RUN mkdir -p /downloads

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--workers", "1", "--loop", "uvloop", "--http", "httptools"]
