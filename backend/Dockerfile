FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
RUN DJANGO_SETTINGS_MODULE=config.settings.prod DJANGO_SECRET_KEY=build-only DJANGO_ALLOWED_HOSTS=localhost \
    python manage.py collectstatic --noinput \
    && useradd --create-home --uid 1000 app \
    && mkdir -p /app/media/private && chown -R app:app /app/media

# Release id (git SHA/tag) for /readiness and Sentry; pass --build-arg RELEASE=$(git rev-parse --short HEAD)
ARG RELEASE=""
ENV RELEASE=${RELEASE}

USER app
EXPOSE 8000
# Healthchecks are defined per service in deploy/docker-compose.prod.yml (celery shares this image).
ENTRYPOINT ["./entrypoint.sh"]
# Workers/threads/timeouts come from gunicorn.conf.py (env-tunable).
CMD ["gunicorn", "config.wsgi:application", "-c", "gunicorn.conf.py"]
