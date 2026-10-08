# KaamSathi developer commands. `make help` lists them.
BACKEND := backend
# Local API port. Override when 8000 is taken, e.g. `make dev-backend API_PORT=8001`
# (then set API_BASE_URL=http://localhost:8001/api/v1 in web/.env.local).
API_PORT ?= 8000
PY      := $(BACKEND)/.venv/bin/python
MANAGE  := cd $(BACKEND) && .venv/bin/python manage.py
COMPOSE := docker compose

.PHONY: help env up down logs db seed seed-docker setup backend-setup web-setup \
        dev-backend dev-web dev-worker translations test test-backend test-web lint fmt check \
        deploy-config deploy-up deploy-down deploy-logs deploy-ps backup-now backup-list restore

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

dev-backend: db ## Django dev server on :$(API_PORT) (default 8000) against Docker Postgres/Redis
	@if lsof -nP -iTCP:$(API_PORT) -sTCP:LISTEN >/dev/null 2>&1; then \
		echo "Port $(API_PORT) is already in use (another project?). Pick a free one: make dev-backend API_PORT=$$(( $(API_PORT) + 1 ))"; exit 1; fi
	cd $(BACKEND) && .venv/bin/python manage.py migrate && .venv/bin/python manage.py runserver 0.0.0.0:$(API_PORT)

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

# ---------------------------------------------------------------- production (deploy/)
# ENV_FILE=deploy/.env.staging PROJECT=kaamsathi-staging make deploy-up   → staging on the same compose file
ENV_FILE ?= deploy/.env.prod
PROJECT  ?= kaamsathi
RELEASE  ?= $(shell git rev-parse --short HEAD 2>/dev/null)
PROD     := RELEASE=$(RELEASE) PROJECT=$(PROJECT) $(COMPOSE) --env-file $(ENV_FILE) -f deploy/docker-compose.prod.yml -p $(PROJECT)

deploy-config: ## Validate + print the production compose config
	@test -f $(ENV_FILE) || { echo "Missing $(ENV_FILE) — copy deploy/.env.prod.example"; exit 1; }
	$(PROD) config --quiet && echo "compose config OK"

deploy-up: deploy-config ## Build and (re)start the production stack (migrations run on backend start)
	$(PROD) up -d --build --remove-orphans
	$(PROD) ps

deploy-down: ## Stop the production stack (volumes are kept)
	$(PROD) down

deploy-logs: ## Tail production logs (S=backend to filter one service)
	$(PROD) logs -f --tail=200 $(S)

deploy-ps: ## Production container status + health
	$(PROD) ps

backup-now: ## Run a database (+media) backup immediately
	$(PROD) exec backup /usr/local/bin/backup.sh

backup-list: ## List backups in the backup volume
	$(PROD) exec backup ls -lh /backups

restore: ## Restore DB from FILE=/backups/db-....sql.gz[.gpg] (DESTRUCTIVE; asks for confirmation)
	@test -n "$(FILE)" || { echo "usage: make restore FILE=/backups/db-<db>-<stamp>.sql.gz[.gpg]"; exit 1; }
	@echo "This will STOP the app and OVERWRITE database '$(PROJECT)' from $(FILE)."
	@printf "Type the project name ($(PROJECT)) to continue: "; read ans; [ "$$ans" = "$(PROJECT)" ] || { echo "aborted"; exit 1; }
	$(PROD) stop web backend celery-worker celery-beat
	$(PROD) exec backup /usr/local/bin/backup.sh
	$(PROD) exec backup /usr/local/bin/restore.sh $(FILE)
	$(PROD) up -d backend celery-worker celery-beat web
