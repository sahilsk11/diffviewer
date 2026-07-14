# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS frontend

WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig*.json vite.config.ts components.json ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM ghcr.io/astral-sh/uv:0.8.3 AS uv

FROM python:3.12.11-slim-bookworm AS runtime

ARG CODEX_VERSION=0.125.0
ARG VCS_REF=unknown

LABEL org.opencontainers.image.source="https://github.com/sahilsk11/diffviewer" \
      org.opencontainers.image.revision="${VCS_REF}"

# Generated insights call the Codex CLI. Copying the pinned Node runtime keeps
# that application dependency inside the image instead of requiring it on the host.
COPY --from=frontend /usr/local /usr/local
COPY --from=uv /uv /uvx /bin/
RUN npm install --global "@openai/codex@${CODEX_VERSION}" \
    && groupadd --gid 10001 diffviewer \
    && useradd --uid 10001 --gid diffviewer --create-home diffviewer \
    && mkdir -p /app /data \
    && chown diffviewer:diffviewer /data

WORKDIR /app/backend
COPY README.md /app/README.md
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend/src ./src
RUN uv sync --frozen --no-dev
COPY --from=frontend /build/dist /app/dist

ENV PATH="/app/backend/.venv/bin:${PATH}" \
    PYTHONUNBUFFERED=1 \
    DIFFVIEWER_DB_PATH=/data/diffviewer.sqlite3

USER diffviewer
EXPOSE 8000
VOLUME ["/data"]

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=2)"]

CMD ["uvicorn", "diffviewer_api.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
