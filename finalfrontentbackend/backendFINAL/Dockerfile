# syntax=docker/dockerfile:1
# Production image for the FastAPI backend (Railway, Render, Fly, any container host).
# Contains no secrets: every credential is read from environment variables at runtime.
#
#   docker build -t hackathon-backend .
#   docker run --rm -p 8000:8000 --env-file .env hackathon-backend
#   curl http://localhost:8000/api/v1/health

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app

RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin appuser
USER appuser

# PORT is injected by Railway/Render; 8000 is the local default. Override ENVIRONMENT=development
# to re-enable /api/v1/docs. WEB_CONCURRENCY > 1 multiplies the in-memory per-user rate limit.
ENV ENVIRONMENT=production \
    PORT=8000 \
    WEB_CONCURRENCY=1

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import os, urllib.request as u; u.urlopen('http://127.0.0.1:%s/api/v1/health' % os.environ.get('PORT', '8000'), timeout=4)"

# Shell form only to expand $PORT; `exec` makes uvicorn PID 1 so it receives SIGTERM.
# --proxy-headers: platforms terminate TLS at their proxy and forward X-Forwarded-*.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port \"$PORT\" --workers \"$WEB_CONCURRENCY\" --proxy-headers --forwarded-allow-ips='*' --no-server-header"]
