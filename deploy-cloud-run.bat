@echo off
setlocal

set PROJECT=parchaoo
set REGION=us-central1
set REPO=cloud-run-nutridata
set SERVICE=nutridata
set IMAGE=%REGION%-docker.pkg.dev/%PROJECT%/%REPO%/nutridata:latest

echo === Build imagen ===
docker buildx build --load -t %IMAGE% .
if errorlevel 1 exit /b 1

echo === Push a Artifact Registry ===
docker push %IMAGE%
if errorlevel 1 exit /b 1

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

echo === Enrutar trafico a la revision nueva ===
gcloud run services update-traffic %SERVICE% ^
  --project %PROJECT% ^
  --region %REGION% ^
  --to-latest

echo.
echo NOTA: Este deploy NO borra variables de entorno existentes en Cloud Run.
echo Si faltan, configuralas en la consola o con gcloud run services update:
echo   DATABASE_URL, SECRET_KEY, ALLOWED_ORIGINS, FRONTEND_URL, BASE_URL
echo   GCS_BUCKET=nombre-del-bucket  (fotos de perfil persistentes; IAM Storage Object Admin en la SA de Cloud Run)
echo   GCS_PREFIX=prod  (opcional)
echo.
gcloud run services describe %SERVICE% --region %REGION% --format="value(status.url)"

endlocal
