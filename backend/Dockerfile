FROM python:3.12-slim AS builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --upgrade pip

RUN mkdir -p /app/wheels && \
    pip wheel \
    --no-cache-dir \
    --wheel-dir /app/wheels \
    -r requirements.txt

FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/wheels /tmp/wheels

RUN pip install --no-cache-dir /tmp/wheels/* && \
    rm -rf /tmp/wheels