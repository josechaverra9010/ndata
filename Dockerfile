# ==========================================
# ETAPA 1: Construcción del Frontend (React + Vite)
# ==========================================
FROM node:18-alpine AS build-frontend
WORKDIR /app

# Habilitamos pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiamos solo los archivos de dependencias de Node
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile

# Copiamos todo el proyecto para compilar el frontend
COPY . .
RUN pnpm run build

# ==========================================
# ETAPA 2: Configuración del Backend y Ejecución
# ==========================================
FROM python:3.11-slim
WORKDIR /app

# Instalamos dependencias del sistema para bcrypt y mysql
RUN apt-get update && apt-get install -y \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiamos y instalamos los requisitos de Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiamos todo el código fuente del backend a la raíz
COPY . .

# Creamos la carpeta de subidas por si no existe
RUN mkdir -p uploads

# Copiamos el build de React generado en la Etapa 1
# Vite genera 'dist', lo movemos a la carpeta que servirá FastAPI
COPY --from=build-frontend /app/dist ./dist

# Variables de entorno
ENV PORT=8080
ENV PYTHONUNBUFFERED=1

# Comando de arranque que activa el bloque if __name__ == "__main__":
CMD ["python", "main.py"]