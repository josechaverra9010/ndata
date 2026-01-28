import os
import shutil
import logging
from datetime import timedelta
from google.cloud import storage
from google.auth import default, impersonated_credentials
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

logger = logging.getLogger(__name__)

class HybridStorage:
    def __init__(self):
        self.debug = os.getenv("DEBUG", "False").lower() == "true"
        self.bucket_name = os.getenv("GS_BUCKET_NAME")
        self.project_id = os.getenv("GS_PROJECT_ID", "parchaoo")
        self.service_account = os.getenv("GS_SERVICE_ACCOUNT_EMAIL")
        self.media_path = "media" # Carpeta local
        # URLs firmadas válidas por 5 minutos (como Django: querystring_auth + expiration)
        self.url_expiration = timedelta(seconds=300)
        
        # Credenciales y cliente
        self.credentials = None
        self.client = None
        
        if not self.debug:
            self._initialize_gcs()

        # Crear carpeta media local si no existe
        if self.debug and not os.path.exists(self.media_path):
            os.makedirs(self.media_path)
            logger.info("[STORAGE] Modo LOCAL: Archivos se guardan en carpeta 'media/'")

    def _initialize_gcs(self):
        """Inicializar credenciales y cliente de GCS"""
        try:
            source_credentials, project = default()
            
            # En desarrollo, usar credenciales directas sin impersonación
            # Solo usar impersonación en producción si está configurado
            use_impersonation = os.getenv("GCS_USE_IMPERSONATION", "False").lower() == "true"
            
            if self.service_account and use_impersonation:
                # Usar credenciales impersonadas (solo en producción)
                try:
                    self.credentials = impersonated_credentials.Credentials(
                        source_credentials=source_credentials,
                        target_principal=self.service_account,
                        target_scopes=["https://www.googleapis.com/auth/devstorage.full_control"],
                        lifetime=3600,
                    )
                    logger.info(f"[GCS] Credenciales Impersonadas activas para: {self.service_account}")
                except Exception as imp_error:
                    logger.warning(f"[GCS] No se pudo impersonar service account: {imp_error}")
                    logger.info("[GCS] Usando credenciales por defecto de Google Cloud")
                    self.credentials = source_credentials
            else:
                # Usar credenciales por defecto
                self.credentials = source_credentials
                logger.info("[GCS] Usando credenciales por defecto de Google Cloud")
            
            # Crear cliente con las credenciales
            self.client = storage.Client(
                project=self.project_id, 
                credentials=self.credentials
            )
            
            if self.bucket_name:
                logger.info(f"[STORAGE] Modo PRODUCCION: Archivos se guardan en Google Cloud Storage (bucket: {self.bucket_name})")
            else:
                logger.warning("[GCS] GS_BUCKET_NAME no configurado")
                
        except Exception as e:
            logger.warning(f"[GCS] No se detectaron credenciales de GCP: {e}")
            logger.info("   -> Esto es normal durante el 'docker build'.")
            self.credentials = None
            self.client = None

    def _generate_signed_url(self, blob):
        """
        Genera una URL firmada temporal para acceso público a archivo privado.
        Similar a querystring_auth=True en Django.
        
        Si no se pueden generar URLs firmadas (ej: usando credenciales de usuario),
        retorna la URL pública del blob.
        """
        try:
            # Generar URL firmada válida por el tiempo configurado
            signed_url = blob.generate_signed_url(
                version="v4",
                expiration=self.url_expiration,
                method="GET",
                credentials=self.credentials
            )
            return signed_url
        except Exception as e:
            logger.warning(f"[GCS] No se pudo generar URL firmada: {e}")
            logger.info(f"[GCS] Usando URL pública. Para URLs firmadas, usa service account key.")
            # Fallback a URL pública
            return blob.public_url

    async def save_file(self, file_content, filename, content_type):
        """
        Guarda el archivo en Local (media/) si DEBUG=True
        Guarda en GCS si DEBUG=False
        
        IMPORTANTE: En producción (GCS), retorna solo el NOMBRE del archivo,
        NO la URL firmada. Las URLs firmadas se generan dinámicamente al leer.
        """
        if self.debug or not self.client:
            # --- MODO LOCAL ---
            file_path = os.path.join(self.media_path, filename)
            with open(file_path, "wb") as buffer:
                buffer.write(file_content)
            logger.info(f"[LOCAL] Archivo guardado: {file_path}")
            return f"/media/{filename}"
        else:
            # --- MODO PRODUCCIÓN (GCS) ---
            try:
                bucket = self.client.bucket(self.bucket_name)
                blob = bucket.blob(filename)
                
                # Subir archivo
                blob.upload_from_string(file_content, content_type=content_type)
                
                logger.info(f"[GCS] Archivo subido: gs://{self.bucket_name}/{filename}")
                
                # IMPORTANTE: Retornar solo el nombre del archivo
                # La URL firmada se generará dinámicamente cuando se necesite
                return filename
                
            except Exception as e:
                logger.error(f"[GCS] Error subiendo archivo: {e}")
                return None
    
    def get_file_url(self, filename):
        """
        Genera URL pública para acceder al archivo.
        
        - En modo LOCAL: retorna URL relativa /media/filename
        - En modo GCS: genera URL firmada temporal (5 minutos)
        
        Esta función se llama cada vez que se necesita mostrar el archivo,
        para que las URLs firmadas siempre estén frescas.
        """
        if not filename:
            return None
            
        if self.debug or not self.client:
            # Modo local - si ya tiene /media/, retornar tal cual
            if filename.startswith("/media/"):
                return filename
            return f"/media/{filename}"
        else:
            # Modo GCS - generar URL firmada fresca
            try:
                bucket = self.client.bucket(self.bucket_name)
                blob = bucket.blob(filename)
                
                # Generar URL firmada temporal
                signed_url = self._generate_signed_url(blob)
                return signed_url
                
            except Exception as e:
                logger.error(f"[GCS] Error generando URL para {filename}: {e}")
                # Fallback a URL pública
                return f"https://storage.googleapis.com/{self.bucket_name}/{filename}"

# Instancia global
storage_manager = HybridStorage()