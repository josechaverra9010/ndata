# ---------- Stage 1: build frontend (React/Vite) ----------
FROM node:20-alpine AS frontend
WORKDIR /frontend

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY index.html ./
COPY vite.config.ts tsconfig*.json tailwind.config.* postcss.config.* components.json ./
COPY public ./public
COPY src ./src

# Misma origen que la API dentro del contenedor/Cloud Run
ENV VITE_API_BASE_URL=/api
RUN npm run build


# ---------- Stage 2: backend FastAPI + frontend estático ----------
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080 \
    FRONTEND_DIST=/app/frontend_dist

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    default-libmysqlclient-dev \
    pkg-config \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Backend Python (main + módulos requeridos en runtime)
COPY main.py timezone_co.py pdf_utils.py ./
COPY *_module.py ./

RUN mkdir -p /app/uploads

# Frontend compilado
COPY --from=frontend /frontend/dist /app/frontend_dist

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT:-8080}/api/public/health" || exit 1

CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080} --timeout-keep-alive 5"]
