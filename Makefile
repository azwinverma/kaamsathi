# KaamSathi developer commands. `make help` lists them.
BACKEND := backend
PY      := $(BACKEND)/.venv/bin/python
MANAGE  := cd $(BACKEND) && .venv/bin/python manage.py
COMPOSE := docker compose

.PHONY: help env up down logs db seed seed-docker setup backend-setup web-setup \
        dev-backend dev-web dev-worker translations test test-backend test-web lint fmt check

help:
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-16s %s\n", $$1, $$2}'

env: ## Create .env from .env.example (keeps an existing one)
	@test -f .env || cp .env.example .env

up: env ## Full stack in Docker: postgres 5433, redis 6380, backend 8000, workers, web 3000
	$(COMPOSE) up -d --build

down: ## Stop the Docker stack
	$(COMPOSE) down

logs: ## Tail Docker logs
	$(COMPOSE) logs -f --tail=100

db: ## Only Postgres + Redis (for running backend/web locally)
	$(COMPOSE) up -d db redis

seed: ## Reference + demo data into the Docker backend (falls back to local venv)
	@if $(COMPOSE) ps --status running backend 2>/dev/null | grep -q backend; then \
		$(COMPOSE) exec backend python manage.py seed_demo; \
	else \
		$(MANAGE) seed_demo; \
	fi

setup: env backend-setup web-setup ## Local toolchains: Python venv + pnpm install

backend-setup:
	test -d $(BACKEND)/.venv || python3.13 -m venv $(BACKEND)/.venv
	$(BACKEND)/.venv/bin/pip install -r $(BACKEND)/requirements-dev.txt

web-setup:
	cd web && pnpm install

dev-backend: db ## Django dev server on :8000 against Docker Postgres/Redis
	$(MANAGE) migrate && $(MANAGE) runserver 0.0.0.0:8000

dev-worker: ## Celery worker + beat (only needed with CELERY_TASK_ALWAYS_EAGER=false)
	cd $(BACKEND) && .venv/bin/celery -A config worker -B -l info

dev-web: ## Next.js dev server on :3000
	cd web && pnpm dev

translations: ## Refresh backend Nepali catalog (needs GNU gettext: brew install gettext)
	cd $(BACKEND) && PATH="/opt/homebrew/opt/gettext/bin:$$PATH" .venv/bin/python manage.py makemessages -l ne --ignore=.venv --ignore=tests --no-location
	@echo "Translate new entries in backend/locale/ne/LC_MESSAGES/django.po, then:"
	cd $(BACKEND) && PATH="/opt/homebrew/opt/gettext/bin:$$PATH" .venv/bin/python manage.py compilemessages -l ne --ignore=.venv

test: test-backend test-web ## All tests

test-backend:
	cd $(BACKEND) && .venv/bin/pytest -q

test-web:
	cd web && pnpm test

lint: ## Linters and type checks
	cd $(BACKEND) && .venv/bin/ruff check . && .venv/bin/ruff format --check .
	cd web && pnpm lint && pnpm typecheck && pnpm messages:check
	cd mobile && flutter analyze

fmt: ## Auto-format backend and web
	cd $(BACKEND) && .venv/bin/ruff format . && .venv/bin/ruff check --fix .
	cd web && pnpm format

check: lint test ## Everything CI runs
