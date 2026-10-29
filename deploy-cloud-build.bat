@echo off
setlocal

set PROJECT=parchaoo
set REGION=us-central1
set REPO=cloud-run-nutridata
set SERVICE=nutridata
set IMAGE=%REGION%-docker.pkg.dev/%PROJECT%/%REPO%/nutridata:latest

echo === APIs necesarias (ejecutar una vez con cuenta Owner si falla el build) ===
echo gcloud services enable cloudbuild.googleapis.com artifactregistry.googleapis.com run.googleapis.com --project %PROJECT%
echo.

echo === Build en Google Cloud Build ===
echo Usando bucket regional propio (evita parchaoo_cloudbuild bloqueado por politica org)
gcloud builds submit ^
  --project %PROJECT% ^
  --region %REGION% ^
  --default-buckets-behavior=regional-user-owned-bucket ^
  --tag %IMAGE% ^
  .
if errorlevel 1 (
  echo.
  echo [ERROR] Build fallo. Si ves "forbidden" en un bucket:
  echo   1. Pide al admin del proyecto roles: Cloud Build Editor + Artifact Registry Writer
  echo      y permiso serviceusage.services.use en el proyecto %PROJECT%
  echo   2. O usa Docker local: abre Docker Desktop y ejecuta deploy-cloud-run.bat
  echo   3. Admin puede ejecutar: scripts\grant-cloud-build-access.bat TU_EMAIL
  exit /b 1
)

echo === Deploy Cloud Run ===
gcloud run deploy %SERVICE% ^
  --project %PROJECT% ^
  --image %IMAGE% ^
  --platform managed ^
  --region %REGION% ^
  --allow-unauthenticated ^
  --port 8080 ^
  --timeout 300 ^
  --memory 1Gi ^
  --cpu 1 ^
  --cpu-boost

echo.
echo Variables en Cloud Run: DATABASE_URL, SECRET_KEY, ALLOWED_ORIGINS, FRONTEND_URL, BASE_URL, GCS_BUCKET
gcloud run services describe %SERVICE% --project %PROJECT% --region %REGION% --format="value(status.url)"

endlocal
