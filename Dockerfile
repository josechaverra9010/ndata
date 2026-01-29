# ==========================================
# ETAPA 1: Construcción del Frontend
# ==========================================
FROM node:18-alpine AS build-frontend
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile
# Copiar solo archivos necesarios para el build del frontend
COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY postcss.config.js tailwind.config.ts components.json eslint.config.js ./
COPY public/ ./public/
COPY src/ ./src/
RUN pnpm run build

# ==========================================
# ETAPA 2: Builder de Python (Compilación)
# ==========================================
FROM python:3.11-slim AS python-builder
WORKDIR /app
RUN apt-get update && apt-get install -y gcc libffi-dev
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# ==========================================
# ETAPA 3: Imagen Final (Runtime)
# ==========================================
FROM python:3.11-slim
WORKDIR /app

COPY --from=python-builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Copiar solo archivos necesarios para producción
COPY main.py storage_utils.py ./
COPY requirements.txt ./
COPY uploads/ ./uploads/
COPY --from=build-frontend /app/dist ./dist

# Crear carpetas necesarias para DEBUG mode (se crean vacías)
RUN mkdir -p media

ENV PORT=8080
ENV PYTHONUNBUFFERED=1

CMD ["python", "main.py"]