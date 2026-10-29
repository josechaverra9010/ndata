@echo off
setlocal
REM Ejecutar con cuenta Owner/Admin del proyecto parchaoo
REM Uso: grant-cloud-build-access.bat usuario@dominio.com

set PROJECT=parchaoo
set MEMBER=%~1
if "%MEMBER%"=="" (
  echo Uso: grant-cloud-build-access.bat usuario@empresa.com
  exit /b 1
)

echo Proyecto: %PROJECT%  Usuario: %MEMBER%

gcloud services enable cloudbuild.googleapis.com artifactregistry.googleapis.com run.googleapis.com serviceusage.googleapis.com --project %PROJECT%

gcloud projects add-iam-policy-binding %PROJECT% ^
  --member="user:%MEMBER%" ^
  --role="roles/cloudbuild.builds.editor"

gcloud projects add-iam-policy-binding %PROJECT% ^
  --member="user:%MEMBER%" ^
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding %PROJECT% ^
  --member="user:%MEMBER%" ^
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding %PROJECT% ^
  --member="user:%MEMBER%" ^
  --role="roles/serviceusage.serviceUsageConsumer"

echo.
echo Listo. El usuario debe volver a ejecutar: deploy-cloud-build.bat
endlocal
