# ==========================================
# ETAPA 1: Construcción del Frontend
# ==========================================
FROM node:18-alpine AS build-frontend
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile
COPY . .
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

COPY main.py .

COPY uploads/ ./uploads/
COPY --from=build-frontend /app/dist ./dist

ENV PORT=8080
ENV PYTHONUNBUFFERED=1

CMD ["python", "main.py"]