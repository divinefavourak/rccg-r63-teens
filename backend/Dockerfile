# The API image. One image runs the web server, the Celery worker and Celery
# beat; deploy/docker-compose.yml picks which by overriding the command.
#
#   docker compose -f deploy/docker-compose.yml build
#
# See docs/ops/11-vps-deployment.md.

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# libmagic is what python-magic wraps (it checks uploaded receipts are what
# their extension says). Everything else in requirements.txt ships as a wheel.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libmagic1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Requirements first, so a code-only change reuses the installed layer.
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Static files are baked into the image. collectstatic imports the settings,
# which need a SECRET_KEY to exist; this one is never used to sign anything.
# With no DATABASE_URL the settings fall back to SQLite, so nothing connects.
RUN SECRET_KEY=collectstatic-only DEBUG=False python manage.py collectstatic --no-input

# /beat holds Celery beat's schedule file. It is created here, owned by app,
# because a named volume mounted on it takes its ownership from the image.
RUN useradd --create-home --uid 1000 app \
    && chmod +x release.sh \
    && mkdir /beat \
    && chown -R app:app /app /beat
USER app

# The commit this image was built from, so Sentry ties each error to a
# release (deploy: `SENTRY_RELEASE=$(git rev-parse --short HEAD) dc build`).
# Last, so a new commit only changes this layer and nothing above is rebuilt.
ARG SENTRY_RELEASE=
ENV SENTRY_RELEASE=${SENTRY_RELEASE}

EXPOSE 8000

# gthread: a slow client downloading a large response (the Bible pack) holds a
# thread, not a whole worker process. 2 workers x 4 threads suits a small VPS.
CMD ["gunicorn", "backend.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--worker-class", "gthread", "--workers", "2", "--threads", "4", \
     "--timeout", "60", \
     "--access-logfile", "-"]
