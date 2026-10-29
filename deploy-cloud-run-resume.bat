@echo off
setlocal
REM Usar despues de: gcloud auth login
REM y: gcloud auth configure-docker us-central1-docker.pkg.dev

set PROJECT=parchaoo
set REGION=us-central1
set REPO=cloud-run-nutridata
set SERVICE=nutridata
set IMAGE=%REGION%-docker.pkg.dev/%PROJECT%/%REPO%/nutridata:latest

echo === Push imagen (ya construida localmente) ===
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

gcloud run services update-traffic %SERVICE% ^
  --project %PROJECT% ^
  --region %REGION% ^
  --to-latest

gcloud run services describe %SERVICE% --project %PROJECT% --region %REGION% --format="value(status.url)"
endlocal
