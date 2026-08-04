from fastapi import FastAPI, HTTPException, Depends, status, Form, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Date, Text, Float, JSON, ForeignKey, Enum, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship, DeclarativeBase
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import inspect, text
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, ConfigDict, field_validator
from typing import Optional, List
from datetime import datetime, timedelta
import jwt
import os
import json
from fastapi import UploadFile, File
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from urllib.parse import quote
import requests
import copy

# Cargar variables de entorno
load_dotenv()
from datetime import datetime, timedelta, date
from timezone_co import now_co, today_co, now_co_str, today_co_str, TZ_LABEL
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy import func, and_, or_
import io
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.utils import ImageReader

# Configuración de Base de Datos (PostgreSQL)
DATABASE_URL = os.getenv("DATABASE_URL")

# Si no hay DATABASE_URL en el entorno, usar una por defecto para MySQL
if not DATABASE_URL:
    DATABASE_URL = "mysql+pymysql://root@localhost/ndata"

# Render a veces proporciona URLs que empiezan con 'postgres://', pero SQLAlchemy requiere 'postgresql://'
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Evitar que el arranque cuelgue indefinidamente si la DB no responde (Cloud Run)
_engine_kwargs = {
    "pool_pre_ping": True,
    "pool_recycle": 300,
}
if DATABASE_URL.startswith("mysql"):
    _engine_kwargs["connect_args"] = {"connect_timeout": 8}
elif DATABASE_URL.startswith("postgresql"):
    _engine_kwargs["connect_args"] = {"connect_timeout": 8}

engine = create_engine(DATABASE_URL, **_engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
class Base(DeclarativeBase):
    pass

def safe_create_all():
    """Crea tablas sin tumbar el arranque si la DB no está lista."""
    global _DB_AVAILABLE
    if _DB_AVAILABLE is False:
        return
    try:
        Base.metadata.create_all(bind=engine)
        _DB_AVAILABLE = True
    except Exception as e:
        _DB_AVAILABLE = False
        print(f"[DB] create_all skipped: {e}")

_DB_AVAILABLE = None  # None=unknown, True=ok, False=unreachable

def ensure_schema_migrations():
    global _DB_AVAILABLE
    if _DB_AVAILABLE is False:
        return
    try:
        inspector = inspect(engine)

        if "users" in inspector.get_table_names():
            cols = {c["name"] for c in inspector.get_columns("users")}
            if "nutritionist_id" not in cols:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE users ADD COLUMN nutritionist_id INTEGER NULL"))
            for col_name, col_sql in [
                ("acompanante_nombre", "VARCHAR(150) NULL"),
                ("acompanante_parentesco", "VARCHAR(80) NULL"),
                ("acompanante_telefono", "VARCHAR(30) NULL"),
                ("acompanante_email", "VARCHAR(100) NULL"),
                ("acompanante_documento", "VARCHAR(50) NULL"),
                ("acompanante_observaciones", "TEXT NULL"),
                ("examenes_bioquimicos", "JSON NULL"),
                ("programa_eps", "TEXT NULL"),
                ("datos_clinicos", "JSON NULL"),
                ("deleted_at", "VARCHAR(50) NULL"),
            ]:
                if col_name not in cols:
                    with engine.begin() as conn:
                        conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_sql}"))
                    cols.add(col_name)
        if "meal_plans" in inspector.get_table_names():
            cols = {c["name"] for c in inspector.get_columns("meal_plans")}
            if "tipo" not in cols:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE meal_plans ADD COLUMN tipo VARCHAR(50) DEFAULT 'adulto'"))
        _DB_AVAILABLE = True
    except Exception as e:
        # En Cloud Run sin Cloud SQL / DATABASE_URL correcta, no bloquear el puerto
        _DB_AVAILABLE = False
        print(f"[MIGRATE] Schema migration skipped at import: {e}")

# Las migraciones se ejecutan en @app.on_event("startup") para no bloquear el puerto en Cloud Run.

# Seguridad
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# SECRET_KEY debe estar en variables de entorno en producción
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    # Solo para desarrollo - CAMBIAR en producción
    import warnings
    warnings.warn("Using default SECRET_KEY - NOT SECURE FOR PRODUCTION!", UserWarning)
    SECRET_KEY = "DEVELOPMENT_KEY_CHANGE_IN_PRODUCTION"

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Crear carpeta para fotos si no existe
UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)
app = FastAPI(docs_url=None, redoc_url=None)


@app.on_event("startup")
def set_colombia_timezone_context():
    """Documenta timezone y ejecuta bootstrap de DB tras abrir el puerto."""
    print(f"[TZ] NutriData timezone: America/Bogota (COT) | now={now_co_str()}")
    _run_database_bootstrap()


# URL base para las fotos (usar variable de entorno o localhost por defecto)
BASE_URL = os.getenv("BASE_URL", "http://localhost:8001")

# Define los orígenes permitidos explícitamente
origins = [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# Añadir orígenes desde variables de entorno (separados por comas)
env_origins = os.getenv("ALLOWED_ORIGINS")
if env_origins:
    origins.extend(env_origins.split(","))

# También permitir cualquier subdominio de render.com si es necesario
# origins.append("https://*.render.com") 

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    """Asegura que las respuestas de error incluyan cabeceras CORS."""
    origin = request.headers.get("origin", "") if hasattr(request, "headers") else ""
    headers = {}
    if origin and origin in origins:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail}, headers=headers)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc: Exception):
    """Captura excepciones no controladas y asegura cabeceras CORS para que el cliente reciba la respuesta."""
    # Log simple del error (no incluir stacktrace en producción)
    try:
        print(f"Unhandled exception: {str(exc)}")
    except Exception:
        pass

    origin = request.headers.get("origin", "") if hasattr(request, "headers") else ""
    headers = {}
    if origin and origin in origins:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"

    return JSONResponse(status_code=500, content={"detail": "Internal server error"}, headers=headers)


# Asegurar CORS en todas las respuestas (incl. 404) para que el cliente pueda leer el error
@app.middleware("http")
async def ensure_cors_on_response(request, call_next):
    response = await call_next(request)
    origin = request.headers.get("origin")
    if origin and origin in origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

# Middleware de seguridad para agregar headers HTTP seguros
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    # Prevenir MIME type sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    # Prevenir clickjacking
    response.headers["X-Frame-Options"] = "DENY"
    # Protección XSS (legacy, pero útil para navegadores antiguos)
    response.headers["X-XSS-Protection"] = "1; mode=block"
    # Forzar HTTPS en producción (comentar en desarrollo local)
    if os.getenv("ENVIRONMENT") == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    # Content Security Policy básica
    response.headers["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'"
    return response

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Montar la carpeta para que las fotos sean accesibles vía URL
# Montar la carpeta para que las fotos sean accesibles vía URL
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ==================== FUNCIONES DE SEGURIDAD ====================

import html
import re

def sanitize_string(text: str, max_length: int = 1000) -> str:
    """
    Sanitizar texto para prevenir XSS y otros ataques de inyección
    """
    if not text:
        return ""
    
    # Limitar longitud
    text = str(text)[:max_length]
    
    # Escapar HTML
    text = html.escape(text)
    
    # Remover caracteres potencialmente peligrosos
    text = re.sub(r'[<>]', '', text)
    
    return text.strip()

def get_absolute_url(relative_path: Optional[str]) -> Optional[str]:
    """
    Convertir ruta relativa a URL absoluta usando BASE_URL
    """
    if not relative_path:
        return None
    
    # Si ya es una URL completa, devolverla tal cual
    if relative_path.startswith(('http://', 'https://')):
        return relative_path
    
    # Si es una ruta relativa, agregar BASE_URL
    # Asegurar que no haya doble slash
    base = BASE_URL.rstrip('/')
    path = relative_path if relative_path.startswith('/') else f'/{relative_path}'
    return f"{base}{path}"

def sanitize_filename(filename: str) -> str:
    """
    Sanitizar nombres de archivo para prevenir path traversal
    """
    if not filename:
        return "unnamed"
    
    # Remover path separators y caracteres peligrosos
    filename = os.path.basename(filename)
    filename = re.sub(r'[^\w\s.-]', '', filename)
    filename = re.sub(r'\.\.+', '.', filename)  # Prevenir ../ attacks
    
    return filename[:255]  # Limitar longitud

# Configuración de validación de archivos
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

async def validate_upload_file(file: UploadFile, allowed_extensions: set = ALLOWED_IMAGE_EXTENSIONS) -> UploadFile:
    """
    Validar archivo subido para prevenir ataques
    """
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No se proporcionó archivo")
    
    # Validar extensión
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de archivo no permitido. Permitidos: {', '.join(allowed_extensions)}"
        )
    
    # Leer contenido para validar tamaño
    contents = await file.read()
    try:
        from config_module import get_max_upload_bytes
        max_size = get_max_upload_bytes()
    except Exception:
        max_size = MAX_FILE_SIZE
    if len(contents) > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"Archivo demasiado grande. Máximo: {max_size / 1024 / 1024:.1f}MB"
        )
    
    # Volver al inicio del archivo para que pueda ser leído nuevamente
    await file.seek(0)
    
    return file

def validate_password_strength(password: str) -> bool:
    """
    Validar que la contraseña cumple requisitos mínimos de seguridad
    """
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres")
    
    if not re.search(r'[A-Z]', password):
        raise HTTPException(status_code=400, detail="La contraseña debe contener al menos una mayúscula")
    
    if not re.search(r'[a-z]', password):
        raise HTTPException(status_code=400, detail="La contraseña debe contener al menos una minúscula")
    
    if not re.search(r'\d', password):
        raise HTTPException(status_code=400, detail="La contraseña debe contener al menos un número")
    
    return True


# ==================== FUNCIÓN DE ENVÍO DE EMAIL ====================
# Colores y estilos alineados con la identidad NutriData (index.css / tailwind)
# Primary: verde #7a9b76, fondo crema #faf5f0, texto #352d26, acento #c9a96a

def _email_styles():
    """Estilos base de los correos (identidad NutriData)."""
    return """
        body { margin: 0; padding: 0; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; line-height: 1.6; color: #352d26; background: #f0ebe5; }
        .wrapper { max-width: 600px; margin: 0 auto; padding: 24px 16px; }
        .card { background: #faf5f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(53, 45, 38, 0.08); }
        .brand { background: linear-gradient(135deg, #7a9b76 0%, #85a881 100%); padding: 28px 24px; text-align: center; }
        .brand img { max-height: 44px; width: auto; display: inline-block; }
        .brand-title { color: #ffffff; font-size: 22px; font-weight: 700; margin: 12px 0 0 0; letter-spacing: -0.02em; }
        .content { padding: 32px 28px; color: #352d26; }
        .content p { margin: 0 0 16px 0; font-size: 15px; }
        .content .lead { font-size: 16px; color: #352d26; }
        .btn { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #7a9b76 0%, #85a881 100%); color: #ffffff !important; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; margin: 8px 0 20px 0; box-shadow: 0 2px 8px rgba(122, 155, 118, 0.35); }
        .btn:hover { opacity: 0.95; }
        .muted { color: #6b6159; font-size: 14px; }
        .footer { text-align: center; padding: 20px 24px; color: #6b6159; font-size: 12px; border-top: 1px solid #ddd5cc; background: #faf5f0; }
        .link-fallback { word-break: break-all; background: #ede8e3; padding: 12px 14px; border-radius: 8px; font-size: 13px; color: #6b6159; margin: 12px 0; }
        .highlight { background: rgba(122, 155, 118, 0.12); padding: 2px 6px; border-radius: 4px; }
    """


def _email_layout(inner_body: str, title: str, frontend_url: str):
    """Estructura HTML común: logo, marca, contenido, pie."""
    logo_url = os.getenv("EMAIL_LOGO_URL", "https://utridata.com/logo-light.png")
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>{_email_styles()}</style>
</head>
<body>
    <div class="wrapper">
        <div class="card">
            <div class="brand">
                <img src="{logo_url}" alt="NutriData" width="160" height="44" />
                <p class="brand-title">NutriData</p>
            </div>
            <div class="content">
                {inner_body}
            </div>
            <div class="footer">
                <p style="margin:0;">Este es un correo automático. No respondas a este mensaje.</p>
                <p style="margin:8px 0 0 0;"><a href="{frontend_url}" style="color:#7a9b76;text-decoration:none;">Ir a la plataforma</a></p>
            </div>
        </div>
    </div>
</body>
</html>"""


def _smtp_settings() -> dict:
    try:
        from config_module import get_email_config
        return get_email_config()
    except Exception:
        return {
            "smtp_host": os.getenv("SMTP_HOST", "smtp.gmail.com"),
            "smtp_port": int(os.getenv("SMTP_PORT", "587") or 587),
            "smtp_user": os.getenv("SMTP_USER", ""),
            "smtp_password": os.getenv("SMTP_PASSWORD", ""),
            "from_email": os.getenv("FROM_EMAIL") or os.getenv("SMTP_USER", "tu-email@gmail.com"),
            "frontend_url": os.getenv("FRONTEND_URL", "http://localhost:8080"),
            "base_url": os.getenv("BASE_URL", "http://localhost:8001"),
        }


def send_reset_email(to_email: str, reset_token: str, user_name: str):
    """
    Enviar email de recuperación de contraseña (estilo NutriData).
    """
    try:
        cfg = _smtp_settings()
        smtp_server = cfg["smtp_host"]
        smtp_port = int(cfg["smtp_port"])
        sender_email = cfg["from_email"]
        sender_password = cfg["smtp_password"]
        frontend_url = str(cfg["frontend_url"]).rstrip("/")
        reset_link = f"{frontend_url}/reset-password?token={quote(reset_token, safe='')}"

        message = MIMEMultipart("alternative")
        message["Subject"] = "Recuperación de Contraseña - NutriData"
        message["From"] = f"NutriData <{sender_email}>"
        message["To"] = to_email

        inner = f"""
                <p class="lead">Hola <strong>{user_name}</strong>,</p>
                <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en NutriData.</p>
                <p>Haz clic en el botón para crear una nueva contraseña:</p>
                <p style="text-align: center;">
                    <a href="{reset_link}" class="btn">Restablecer contraseña</a>
                </p>
                <p class="muted">O copia y pega este enlace en tu navegador:</p>
                <p class="link-fallback">{reset_link}</p>
                <p><strong>Este enlace expirará en 1 hora.</strong></p>
                <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
                <p>Saludos,<br><strong>El equipo de NutriData</strong></p>
                """
        html_content = _email_layout(inner, "Recuperación de Contraseña", frontend_url)
        html_part = MIMEText(html_content, "html")
        message.attach(html_part)

        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, to_email, message.as_string())

        print(f"✅ Email de recuperación enviado a: {to_email}")
        return True
    except Exception as e:
        print(f"❌ Error al enviar email: {str(e)}")
        return False


def send_generic_email(to_email: str, subject: str, body: str) -> bool:
    """Email genérico para comunicaciones masivas y reportes programados."""
    try:
        cfg = _smtp_settings()
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = f"NutriData <{cfg['from_email']}>"
        message["To"] = to_email
        frontend_url = str(cfg.get("frontend_url", "http://localhost:8080")).rstrip("/")
        html = _email_layout(f"<p style='white-space:pre-wrap'>{body}</p>", subject, frontend_url)
        message.attach(MIMEText(html, "html"))
        with smtplib.SMTP(cfg["smtp_host"], int(cfg["smtp_port"])) as server:
            server.starttls()
            server.login(cfg["from_email"], cfg["smtp_password"])
            server.sendmail(cfg["from_email"], to_email, message.as_string())
        return True
    except Exception as e:
        print(f"❌ send_generic_email: {e}")
        return False


def send_plan_assignment_email(to_email: str, patient_name: str, plan_name: str, start_date: str):
    """
    Enviar email al paciente cuando se le asigna un plan nutricional (estilo NutriData).
    """
    try:
        cfg = _smtp_settings()
        smtp_server = cfg["smtp_host"]
        smtp_port = int(cfg["smtp_port"])
        sender_email = cfg["from_email"]
        sender_password = cfg["smtp_password"]
        frontend_url = cfg["frontend_url"]
        plan_link = f"{str(frontend_url).rstrip('/')}/patient/my-plan"

        message = MIMEMultipart("alternative")
        message["Subject"] = "Te han asignado un plan nutricional - NutriData"
        message["From"] = f"NutriData <{sender_email}>"
        message["To"] = to_email

        inner = f"""
                <p class="lead">Hola <strong>{patient_name}</strong>,</p>
                <p>Tu nutricionista te ha asignado un nuevo plan nutricional: <span class="highlight"><strong>{plan_name}</strong></span>.</p>
                <p><strong>Fecha de inicio:</strong> {start_date}</p>
                <p>Revisa tu plan y menú en la aplicación:</p>
                <p style="text-align: center;">
                    <a href="{plan_link}" class="btn">Ver mi plan</a>
                </p>
                <p>Saludos,<br><strong>El equipo de NutriData</strong></p>
                """
        html_content = _email_layout(inner, "Plan nutricional asignado", frontend_url)
        html_part = MIMEText(html_content, "html")
        message.attach(html_part)

        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, to_email, message.as_string())

        print(f"✅ Email de asignación de plan enviado a: {to_email}")
        return True
    except Exception as e:
        print(f"❌ Error al enviar email de asignación: {str(e)}")
        return False


def send_nutritionist_invite_email(to_email: str, name: str, registration_link: str):
    """
    Enviar email al nutricionista con el enlace para completar su registro (estilo NutriData).
    """
    try:
        cfg = _smtp_settings()
        smtp_server = cfg["smtp_host"]
        smtp_port = int(cfg["smtp_port"])
        sender_email = cfg["from_email"]
        sender_password = cfg["smtp_password"]
        frontend_url = cfg["frontend_url"]

        message = MIMEMultipart("alternative")
        message["Subject"] = "Completa tu registro en NutriData"
        message["From"] = f"NutriData <{sender_email}>"
        message["To"] = to_email

        inner = f"""
                <p class="lead">Hola <strong>{name}</strong>,</p>
                <p>Has sido agregado/a como nutricionista en la plataforma NutriData.</p>
                <p>Para activar tu cuenta, haz clic en el botón y elige una contraseña:</p>
                <p style="text-align: center;">
                    <a href="{registration_link}" class="btn">Completar registro</a>
                </p>
                <p class="muted">O copia y pega este enlace en tu navegador:</p>
                <p class="link-fallback">{registration_link}</p>
                <p><strong>Este enlace es válido por 7 días.</strong></p>
                <p>Después podrás iniciar sesión con tu correo y la contraseña que elijas.</p>
                <p>Saludos,<br><strong>El equipo de NutriData</strong></p>
                """
        html_content = _email_layout(inner, "Registro de nutricionista", frontend_url)
        html_part = MIMEText(html_content, "html")
        message.attach(html_part)

        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, to_email, message.as_string())

        print(f"✅ Email de invitación de nutricionista enviado a: {to_email}")
        return True
    except Exception as e:
        print(f"❌ Error al enviar email de invitación: {str(e)}")
        return False


# ==================== FUNCIÓN DE ENVÍO DE WHATSAPP ====================

def send_whatsapp_notification(phone: str, message: str, db: Session = None, organization_id: int = None):
    """
    Enviar notificación vía WhatsApp Cloud API.
    Prioriza conexión de integrations_module (por org) y cae a variables de entorno.
    """
    if db is not None:
        try:
            from integrations_module import send_whatsapp_message
            sent = send_whatsapp_message(phone, message, db, organization_id)
            if sent:
                return True
        except Exception as exc:
            print(f"[WhatsApp] integrations_module: {exc}")

    try:
        access_token = os.getenv("WHATSAPP_ACCESS_TOKEN")
        phone_id = os.getenv("WHATSAPP_PHONE_ID")
        
        if not access_token or not phone_id:
            print(f"\n{'='*60}")
            print("WARN: WhatsApp config incomplete - message log:")
            print(f"{'='*60}")
            print(f"Para: {phone}")
            try:
                print(f"Mensaje: {message}")
            except Exception:
                print("Mensaje: [contenido no imprimible en esta consola]")
            print(f"{'='*60}\n")
            return False

        clean_phone = "".join(filter(str.isdigit, phone))
        url = f"https://graph.facebook.com/v18.0/{phone_id}/messages"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": clean_phone,
            "type": "text",
            "text": {
                "body": message
            }
        }
        
        response = requests.post(url, headers=headers, json=payload)
        
        if response.status_code == 200:
            print(f"[OK] WhatsApp enviado a {phone}")
            return True
        else:
            print(f"[ERR] Error WhatsApp ({response.status_code}): {response.text}")
            return False
            
    except Exception as e:
        print(f"[ERR] Error al enviar WhatsApp: {str(e)}")
        return False



# ==================== MODELOS DE BASE DE DATOS ====================

class UserDB(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    nombres = Column(String(100))
    apellidos = Column(String(100))
    email = Column(String(100), unique=True)
    password = Column(String(255))
    role = Column(Enum('superadmin', 'admin', 'patient'), default="patient")
    status = Column(Enum('activo', 'pendiente', 'inactivo'), default='activo')

    created_at = Column(String(50), default=lambda: now_co().strftime("%Y-%m-%d %H:%M:%S"))
    updated_at = Column(String(50), default=lambda: now_co().strftime("%Y-%m-%d %H:%M:%S"), onupdate=lambda: now_co().strftime("%Y-%m-%d %H:%M:%S"))
    
    
    telefono = Column(String(20))
    fecha_nacimiento = Column(Date)
    genero = Column(String(20))
    direccion = Column(Text)
    tipo_documento = Column(String(20))
    numero_documento = Column(String(50), unique=True)
    foto_perfil = Column(String(255), nullable=True)
    
    altura = Column(Float, nullable=True)
    peso_inicial = Column(Float, nullable=True)
    peso_actual = Column(Float, nullable=True)
    peso_objetivo = Column(Float, nullable=True)
    nivel_actividad = Column(String(50), nullable=True)
    pal_factor = Column(Float, nullable=True) # Factor de actividad física manual
    alergias = Column(JSON, default=[]) 
    preferencias = Column(JSON, default=[])
    objetivos_salud = Column(Text, nullable=True)
    condiciones_medicas = Column(Text, nullable=True)
    alimentos_disgusto = Column(Text, nullable=True)
    antecedentes_familiares = Column(Text, nullable=True)
    evaluacion_nutricional = Column(Text, nullable=True)
    frecuencia_consumo = Column(JSON, nullable=True)

    # Acompañante / cuidador (opcional)
    acompanante_nombre = Column(String(150), nullable=True)
    acompanante_parentesco = Column(String(80), nullable=True)
    acompanante_telefono = Column(String(30), nullable=True)
    acompanante_email = Column(String(100), nullable=True)
    acompanante_documento = Column(String(50), nullable=True)
    acompanante_observaciones = Column(Text, nullable=True)
    examenes_bioquimicos = Column(JSON, nullable=True)
    programa_eps = Column(Text, nullable=True)
    datos_clinicos = Column(JSON, nullable=True)

    nutritionist_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    deleted_at = Column(String(50), nullable=True, index=True)

    nutritionist = relationship("UserDB", foreign_keys=[nutritionist_id], remote_side=[id])
    
    # Relación con planes asignados
    assigned_plans = relationship("PatientMealPlanDB", back_populates="patient")
    recuerdos_24h = relationship("Recordatorio24hDB", back_populates="patient")

class Recordatorio24hDB(Base):
    __tablename__ = "recordatorios_24h"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), index=True)
    date = Column(Date, default=lambda: today_co())
    
    desayuno = Column(Text, nullable=True)
    media_manana = Column(Text, nullable=True)
    almuerzo = Column(Text, nullable=True)
    media_tarde = Column(Text, nullable=True)
    cena = Column(Text, nullable=True)
    snack_nocturno = Column(Text, nullable=True)
    observaciones = Column(Text, nullable=True)
    
    patient = relationship("UserDB", back_populates="recuerdos_24h")

class RecipeDB(Base):
    __tablename__ = "recipes"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text)
    category = Column(String(50))
    prepTime = Column(Integer, default=0)
    cookTime = Column(Integer, default=0)
    servings = Column(Integer, default=1)
    calories = Column(Integer, default=0)
    protein = Column(Integer, default=0)
    carbs = Column(Integer, default=0)
    fat = Column(Integer, default=0)
    ingredients = Column(JSON, default=[])
    instructions = Column(JSON, default=[])
    tags = Column(JSON, default=[])
    image = Column(String(255), nullable=True)
    isFavorite = Column(Integer, default=0)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_public = Column(Integer, default=0)  # 0=privada, 1=pública. Solo superadmin puede cambiar.
    approval_status = Column(String(20), default="draft")  # draft | pending | approved | rejected
    is_system = Column(Integer, default=0)  # 1 = biblioteca global del sistema
    source_recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=True)
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(String(50), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    submitted_at = Column(String(50), nullable=True)
    created_at = Column(String(50), nullable=True)
    updated_at = Column(String(50), nullable=True)


class RecipeShareDB(Base):
    """Recetas privadas compartidas con nutricionistas específicos."""
    __tablename__ = "recipe_shares"
    recipe_id = Column(Integer, ForeignKey("recipes.id"), primary_key=True)
    nutritionist_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    created_at = Column(String(50), nullable=True)

# NUEVOS MODELOS PARA MEAL PLANS

class MealPlanDB(Base):
    __tablename__ = "meal_plans"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text)
    calories = Column(Integer, nullable=False)
    duration = Column(String(50))
    category = Column(String(50))
    color = Column(String(20), default="primary")
    # Tipo de plan: adulto, pediatria, gestante, gestante_adolescente, hospitalizado, deportista
    tipo = Column(String(50), default="adulto")
    
    protein_target = Column(Integer)
    carbs_target = Column(Integer)
    fat_target = Column(Integer)
    
    meals_per_day = Column(Integer, default=3)
    is_active = Column(Integer, default=1)
    created_at = Column(String(50))
    
    # Campos para las 4 fases del plan nutricional
    fase_1 = Column(JSON, nullable=True)  # Requerimiento Energético y Peso Saludable
    fase_2 = Column(JSON, nullable=True)  # Fórmula Sintética de Consumo y Planeada
    fase_3 = Column(JSON, nullable=True)  # Fórmula Sintética Desarrollada
    fase_4 = Column(JSON, nullable=True)  # Minuta Patrón
    
    weekly_menus = relationship("WeeklyMenuDB", back_populates="meal_plan", cascade="all, delete-orphan")
    assigned_patients = relationship("PatientMealPlanDB", back_populates="meal_plan")

class WeeklyMenuDB(Base):
    __tablename__ = "weekly_menus"
    id = Column(Integer, primary_key=True, index=True)
    meal_plan_id = Column(Integer, ForeignKey("meal_plans.id"))
    week_number = Column(Integer)
    
    monday = Column(JSON, default={})
    tuesday = Column(JSON, default={})
    wednesday = Column(JSON, default={})
    thursday = Column(JSON, default={})
    friday = Column(JSON, default={})
    saturday = Column(JSON, default={})
    sunday = Column(JSON, default={})
    
    meal_plan = relationship("MealPlanDB", back_populates="weekly_menus")

class PatientMealPlanDB(Base):
    __tablename__ = "patient_meal_plans"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"))
    meal_plan_id = Column(Integer, ForeignKey("meal_plans.id"))
    
    assigned_date = Column(String(50))
    start_date = Column(String(50))
    end_date = Column(String(50), nullable=True)
    current_week = Column(Integer, default=1)
    
    status = Column(String(20), default="active")
    notes = Column(Text, nullable=True)
    
    patient = relationship("UserDB", back_populates="assigned_plans")
    meal_plan = relationship("MealPlanDB", back_populates="assigned_patients")

safe_create_all()

class DailyMealAssignmentDB(Base):
    __tablename__ = "daily_meal_assignments"
    id = Column(Integer, primary_key=True, index=True)
    patient_meal_plan_id = Column(Integer, ForeignKey("patient_meal_plans.id"))
    date = Column(Date, nullable=False)
    day_of_week = Column(String(20))
    
    breakfast = Column(JSON, default={})
    morning_snack = Column(JSON, default={})
    lunch = Column(JSON, default={})
    afternoon_snack = Column(JSON, default={})
    dinner = Column(JSON, default={})
    evening_snack = Column(JSON, default={})
    
    generated_from_menu_id = Column(Integer, nullable=True)


# Actualizar tablas
safe_create_all()

# Migración: añadir created_by_id a recipes y weekly_menus_complete si no existe
def _add_created_by_columns():
    if _DB_AVAILABLE is False:
        return
    from sqlalchemy import text
    for table, col in [("recipes", "created_by_id"), ("weekly_menus_complete", "created_by_id")]:
        try:
            with engine.connect() as conn:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} INTEGER"))
                conn.commit()
        except Exception:
            pass  # Columna ya existe

def _add_recipe_is_public():
    if _DB_AVAILABLE is False:
        return
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE recipes ADD COLUMN is_public INTEGER DEFAULT 0"))
            conn.commit()
    except Exception:
        pass  # Columna ya existe

_add_created_by_columns()
_add_recipe_is_public()


def _add_recipe_moderation_columns():
    if _DB_AVAILABLE is False:
        return
    from sqlalchemy import text, inspect as sa_inspect
    try:
        insp = sa_inspect(engine)
        if "recipes" not in insp.get_table_names():
            return
        cols = {c["name"] for c in insp.get_columns("recipes")}
        migrations = [
            ("approval_status", "VARCHAR(20) DEFAULT 'draft'"),
            ("is_system", "INTEGER DEFAULT 0"),
            ("source_recipe_id", "INTEGER NULL"),
            ("reviewed_by_id", "INTEGER NULL"),
            ("reviewed_at", "VARCHAR(50) NULL"),
            ("rejection_reason", "TEXT NULL"),
            ("submitted_at", "VARCHAR(50) NULL"),
            ("created_at", "VARCHAR(50) NULL"),
            ("updated_at", "VARCHAR(50) NULL"),
        ]
        for col, sql in migrations:
            if col not in cols:
                with engine.connect() as conn:
                    conn.execute(text(f"ALTER TABLE recipes ADD COLUMN {col} {sql}"))
                    conn.commit()
        if "recipe_shares" not in insp.get_table_names():
            RecipeShareDB.__table__.create(bind=engine, checkfirst=True)
        # Backfill estados de moderación para recetas existentes
        with engine.begin() as conn:
            conn.execute(text(
                "UPDATE recipes SET approval_status = 'approved' "
                "WHERE is_public = 1 AND (approval_status IS NULL OR approval_status = '' OR approval_status = 'draft')"
            ))
            conn.execute(text(
                "UPDATE recipes SET approval_status = 'draft' "
                "WHERE (is_public IS NULL OR is_public = 0) AND (approval_status IS NULL OR approval_status = '')"
            ))
    except Exception as e:
        print(f"[MIGRATE] recipe moderation: {e}")


_add_recipe_moderation_columns()

# ==================== ESQUEMAS PYDANTIC ====================

class UserCreate(BaseModel):
    nombres: str
    apellidos: str
    email: EmailStr
    password: str

class PatientCreateSchema(BaseModel):
    nombres: str
    apellidos: str
    email: EmailStr
    telefono: Optional[str] = None
    fecha_nacimiento: Optional[str] = None
    genero: Optional[str] = None
    direccion: Optional[str] = None
    tipo_documento: Optional[str] = None
    numero_documento: Optional[str] = None
    password: Optional[str] = None
    
    # Datos físicos y de salud
    altura: Optional[float] = None
    peso_inicial: Optional[float] = None
    peso_actual: Optional[float] = None
    peso_objetivo: Optional[float] = None
    nivel_actividad: Optional[str] = None
    pal_factor: Optional[float] = None # Nuevo campo
    alergias: List[str] = []
    preferencias: List[str] = []
    objetivos_salud: Optional[str] = None
    condiciones_medicas: Optional[str] = None
    alimentos_disgusto: Optional[str] = None
    antecedentes_familiares: Optional[str] = None
    evaluacion_nutricional: Optional[str] = None
    frecuencia_consumo: Optional[List[dict]] = None
    status: Optional[str] = "activo"
    # Acompañante (opcional)
    acompanante_nombre: Optional[str] = None
    acompanante_parentesco: Optional[str] = None
    acompanante_telefono: Optional[str] = None
    acompanante_email: Optional[str] = None
    acompanante_documento: Optional[str] = None
    acompanante_observaciones: Optional[str] = None
    examenes_bioquimicos: Optional[dict] = None

    nutritionist_id: Optional[int] = None

class LoginSchema(BaseModel):
    email: str
    password: str

class ForgotPasswordSchema(BaseModel):
    email: EmailStr

class ProfileUpdateSchema(BaseModel):
    nombres: str
    apellidos: str
    telefono: Optional[str] = None
    email: str
    fecha_nacimiento: Optional[str] = None
    genero: Optional[str] = None
    direccion: Optional[str] = None
    tipo_documento: Optional[str] = None
    numero_documento: Optional[str] = None
    altura: Optional[float] = None
    peso_actual: Optional[float] = None
    peso_objetivo: Optional[float] = None
    nivel_actividad: Optional[str] = None
    pal_factor: Optional[float] = None # Nuevo campo
    alergias: List[str] = []
    preferencias: List[str] = []
    objetivos_salud: Optional[str] = None
    condiciones_medicas: Optional[str] = None
    alimentos_disgusto: Optional[str] = None
    antecedentes_familiares: Optional[str] = None
    evaluacion_nutricional: Optional[str] = None
    frecuencia_consumo: Optional[List[dict]] = None
    acompanante_nombre: Optional[str] = None
    acompanante_parentesco: Optional[str] = None
    acompanante_telefono: Optional[str] = None
    acompanante_email: Optional[str] = None
    acompanante_documento: Optional[str] = None
    acompanante_observaciones: Optional[str] = None
    examenes_bioquimicos: Optional[dict] = None

class PatientResponse(BaseModel):
    id: int
    nombres: str
    apellidos: str
    email: str
    telefono: Optional[str]
    fecha_nacimiento: Optional[str] = None
    genero: Optional[str] = None
    tipo_documento: Optional[str] = None
    numero_documento: Optional[str] = None
    foto_perfil: Optional[str]
    status: str
    role: str
    peso_actual: Optional[float]
    peso_objetivo: Optional[float]
    nivel_actividad: Optional[str]
    pal_factor: Optional[float] = None
    progreso: int = 0 
    proxima_cita: str = "Sin cita"
    altura: Optional[float] = None
    direccion: Optional[str] = None
    alergias: List[str] = []
    preferencias: List[str] = []
    objetivos_salud: Optional[str] = None
    condiciones_medicas: Optional[str] = None
    alimentos_disgusto: Optional[str] = None
    antecedentes_familiares: Optional[str] = None
    edad_formateada: Optional[str] = None
    evaluacion_nutricional: Optional[str] = None
    frecuencia_consumo: Optional[List[dict]] = None
    nutritionist_id: Optional[int] = None
    tiene_plan_activo: Optional[bool] = None
    plan_activo: Optional[str] = None
    acompanante_nombre: Optional[str] = None
    acompanante_parentesco: Optional[str] = None
    acompanante_telefono: Optional[str] = None
    acompanante_email: Optional[str] = None
    acompanante_documento: Optional[str] = None
    acompanante_observaciones: Optional[str] = None
    examenes_bioquimicos: Optional[dict] = None
    deleted_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class RecallCreate(BaseModel):
    desayuno: Optional[str] = None
    media_manana: Optional[str] = None
    almuerzo: Optional[str] = None
    media_tarde: Optional[str] = None
    cena: Optional[str] = None
    snack_nocturno: Optional[str] = None
    observaciones: Optional[str] = None
    date: Optional[Any] = None # Can be str from front or date from DB

class RecallResponse(RecallCreate):
    id: int
    patient_id: int
    
    model_config = ConfigDict(from_attributes=True)

class MetricCreate(BaseModel):
    patient_id: int
    date: str
    weight: float
    body_fat: Optional[float] = None
    muscle: Optional[float] = None
    water: Optional[float] = None
    notes: Optional[str] = None


class NoteCreate(BaseModel):
    patient_id: int
    note: str
    created_by: int

class RecipeBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    prepTime: int = 0
    cookTime: int = 0
    servings: int = 1
    calories: int = 0
    protein: int = 0
    carbs: int = 0
    fat: int = 0
    ingredients: List[str] = []
    instructions: List[str] = []
    tags: List[str] = []
    image: Optional[str] = None
    isFavorite: bool = False

    @field_validator("ingredients", "instructions", "tags", mode="before")
    @classmethod
    def ensure_list(cls, v):
        if v is None:
            return []
        if isinstance(v, (list, tuple)):
            return list(v)
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                return list(parsed) if isinstance(parsed, (list, tuple)) else []
            except (json.JSONDecodeError, TypeError):
                return []
        return []

class RecipeCreate(RecipeBase):
    pass

class RecipeResponse(RecipeBase):
    id: int
    is_public: bool = False
    created_by_id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

# ESQUEMAS PARA MEAL PLANS

class MealPlanCreate(BaseModel):
    name: str
    description: str
    calories: int
    duration: str
    category: str
    color: str = "primary"
    tipo: str = "adulto"  # adulto, pediatria, gestante, gestante_adolescente, hospitalizado, deportista
    protein_target: Optional[int] = 0
    carbs_target: Optional[int] = 0
    fat_target: Optional[int] = 0
    meals_per_day: int = 3
    fase_1: Optional[dict] = None
    fase_2: Optional[dict] = None
    fase_3: Optional[dict] = None
    fase_4: Optional[dict] = None

class MealPlanResponse(BaseModel):
    id: int
    name: str
    description: str
    calories: int
    duration: str
    category: str
    color: str
    tipo: Optional[str] = "adulto"
    protein_target: Optional[int]
    carbs_target: Optional[int]
    fat_target: Optional[int]
    meals_per_day: int
    is_active: int
    created_at: Optional[str]
    patients: int = 0
    fase_1: Optional[dict] = None
    fase_2: Optional[dict] = None
    fase_3: Optional[dict] = None
    fase_4: Optional[dict] = None
    
    model_config = ConfigDict(from_attributes=True)

class WeeklyMenuCreate(BaseModel):
    meal_plan_id: int
    week_number: int
    monday: dict = {}
    tuesday: dict = {}
    wednesday: dict = {}
    thursday: dict = {}
    friday: dict = {}
    saturday: dict = {}
    sunday: dict = {}

class WeeklyMenuResponse(BaseModel):
    id: int
    meal_plan_id: int
    week_number: int
    monday: dict
    tuesday: dict
    wednesday: dict
    thursday: dict
    friday: dict
    saturday: dict
    sunday: dict
    
    model_config = ConfigDict(from_attributes=True)

class AssignPlanSchema(BaseModel):
    patient_id: int
    meal_plan_id: int
    start_date: str
    end_date: Optional[str] = None
    notes: Optional[str] = None

class PatientMealPlanResponse(BaseModel):
    id: int
    patient_id: int
    meal_plan_id: int
    assigned_date: str
    start_date: str
    end_date: Optional[str]
    current_week: int
    status: str
    notes: Optional[str]
    
    model_config = ConfigDict(from_attributes=True)

# Agregar al archivo main.py existente

# ==================== MODELOS ADICIONALES PARA CITAS ====================

class AppointmentDB(Base):
    __tablename__ = "appointments"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"))
    patient_name = Column(String(200))
    date = Column(Date, nullable=False)
    time = Column(String(10), nullable=False)
    duration = Column(String(20), default="30 min")
    type = Column(Enum('presencial', 'videollamada'), default='presencial')
    status = Column(Enum('confirmada', 'pendiente', 'cancelada'), default='pendiente')
    notes = Column(Text, nullable=True)
    meeting_link = Column(String(500), nullable=True)
    created_at = Column(String(50))
    updated_at = Column(String(50))
    
    # Relación con paciente
    patient = relationship("UserDB", foreign_keys=[patient_id])

# ==================== ESQUEMAS PYDANTIC PARA CITAS ====================

class AppointmentCreate(BaseModel):
    patient_id: Optional[int] = None
    patient_name: Optional[str] = None
    date: str  # Formato: YYYY-MM-DD
    time: str  # Formato: HH:MM
    duration: str = "30 min"
    type: str = "presencial"  # presencial o videollamada
    notes: Optional[str] = None

class AppointmentUpdate(BaseModel):
    patient_name: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    duration: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    meeting_link: Optional[str] = None

class AppointmentResponse(BaseModel):
    id: int
    patient_id: int
    patient_name: str
    date: str
    time: str
    duration: str
    type: str
    status: str
    notes: Optional[str] = None
    meeting_link: Optional[str] = None
    created_at: str
    
    model_config = ConfigDict(from_attributes=True)


class NutritionistInfo(BaseModel):
    id: int
    name: str
    title: str
    verified: bool
    patients_count: int
    photo: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class AppointmentStatusUpdate(BaseModel):
    status: str  # confirmada, pendiente, cancelada

# ==================== AUTH & SECURITY ====================
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt

ACCESS_TOKEN_EXPIRE_MINUTES = 43200 # 30 days
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception
        
    user = db.query(UserDB).filter(UserDB.email == token_data.email).first()
    if user is None:
        raise credentials_exception
    return user

def get_current_user_optional(token: Optional[str] = Depends(oauth2_scheme_optional), db: Session = Depends(get_db)):
    """Devuelve el usuario si hay token válido; si no, None (no lanza 401)."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            return None
        user = db.query(UserDB).filter(UserDB.email == email).first()
        return user
    except JWTError:
        return None

def require_admin_or_superadmin(current_user: UserDB = Depends(get_current_user)):
    if current_user.role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    return current_user


def require_superadmin(current_user: UserDB = Depends(get_current_user)):
    if current_user.role != "superadmin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo el superadmin puede realizar esta acción")
    return current_user


def authorize_patient_access(patient_id: int, current_user: UserDB, db: Session):
    if current_user.role == "admin":
        role = get_staff_role(db, current_user, AdminProfileDB)
        if role == "clinical_assistant":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Los asistentes clínicos solo gestionan citas")
        if role == "org_admin":
            from platform_module import get_user_organization_id, patient_in_organization
            org_id = get_user_organization_id(db, current_user.id)
            if not org_id:
                raise HTTPException(status_code=403, detail="Admin org sin organización asignada")
            if not patient_in_organization(db, patient_id, org_id):
                raise HTTPException(status_code=403, detail="Paciente fuera de su organización EPS")
            return

    if current_user.role == "patient":
        if current_user.id != patient_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
        return

    if current_user.role in ["admin", "superadmin"]:
        if current_user.role == "superadmin":
            return

        patient = db.query(UserDB).filter(UserDB.id == patient_id, UserDB.role == "patient").first()
        if not patient:
            raise HTTPException(status_code=404, detail="Paciente no encontrado")
        if patient.nutritionist_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
        return

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")


STANDARD_APPOINTMENT_SLOTS = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
    "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
    "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
    "17:00", "17:30", "18:00", "18:30", "19:00",
]


def parse_duration_minutes(duration: Optional[str]) -> int:
    if not duration:
        return 30
    digits = "".join(c for c in str(duration) if c.isdigit())
    try:
        return int(digits) if digits else 30
    except ValueError:
        return 30


def time_to_minutes(time_str: str) -> int:
    parts = str(time_str).strip().split(":")
    hours = int(parts[0])
    minutes = int(parts[1]) if len(parts) > 1 else 0
    return hours * 60 + minutes


def appointment_time_range(time_str: str, duration: Optional[str]):
    start = time_to_minutes(time_str)
    end = start + parse_duration_minutes(duration)
    return start, end


def ranges_overlap(start1: int, end1: int, start2: int, end2: int) -> bool:
    return start1 < end2 and start2 < end1


def get_nutritionist_patient_ids(db: Session, nutritionist_id: int) -> List[int]:
    return [
        row.id
        for row in db.query(UserDB.id)
        .filter(UserDB.role == "patient", UserDB.nutritionist_id == nutritionist_id)
        .all()
    ]


def scope_appointments_query_for_user(query, current_user: UserDB, db: Session):
    """Admin solo ve citas de sus pacientes; superadmin ve todas."""
    if current_user.role == "admin":
        patient_ids = get_nutritionist_patient_ids(db, current_user.id)
        if not patient_ids:
            return query.filter(AppointmentDB.id == -1)
        return query.filter(AppointmentDB.patient_id.in_(patient_ids))
    return query


def resolve_conflict_nutritionist_id(
    current_user: UserDB,
    patient: Optional[UserDB] = None,
) -> Optional[int]:
    """Ámbito de calendario para detectar solapes (por nutricionista)."""
    if current_user.role == "admin":
        return current_user.id
    if patient and patient.nutritionist_id:
        return patient.nutritionist_id
    return None


def has_appointment_time_conflict(
    db: Session,
    appointment_date,
    time_str: str,
    duration: Optional[str],
    *,
    exclude_id: Optional[int] = None,
    nutritionist_id: Optional[int] = None,
) -> bool:
    query = db.query(AppointmentDB).filter(
        AppointmentDB.date == appointment_date,
        AppointmentDB.status != "cancelada",
    )
    if exclude_id is not None:
        query = query.filter(AppointmentDB.id != exclude_id)
    if nutritionist_id is not None:
        patient_ids = get_nutritionist_patient_ids(db, nutritionist_id)
        if not patient_ids:
            return False
        query = query.filter(AppointmentDB.patient_id.in_(patient_ids))

    new_start, new_end = appointment_time_range(time_str, duration)
    for apt in query.all():
        existing_start, existing_end = appointment_time_range(apt.time, apt.duration)
        if ranges_overlap(new_start, new_end, existing_start, existing_end):
            return True
    return False


def authorize_appointment_access(appointment: AppointmentDB, current_user: UserDB, db: Session):
    authorize_patient_access(appointment.patient_id, current_user, db)


def appointment_to_response(apt: AppointmentDB) -> dict:
    return {
        "id": apt.id,
        "patient_id": apt.patient_id,
        "patient_name": apt.patient_name,
        "date": apt.date.strftime("%Y-%m-%d"),
        "time": apt.time,
        "duration": apt.duration,
        "type": apt.type,
        "status": apt.status,
        "notes": apt.notes,
        "meeting_link": apt.meeting_link,
        "created_at": apt.created_at,
        "updated_at": apt.updated_at,
    }


def compute_available_slots_for_date(
    db: Session,
    target_date,
    duration: Optional[str] = "30 min",
    nutritionist_id: Optional[int] = None,
) -> Tuple[List[str], List[str]]:
    occupied_query = db.query(AppointmentDB).filter(
        AppointmentDB.date == target_date,
        AppointmentDB.status != "cancelada",
    )
    if nutritionist_id is not None:
        patient_ids = get_nutritionist_patient_ids(db, nutritionist_id)
        if not patient_ids:
            occupied = []
        else:
            occupied = occupied_query.filter(AppointmentDB.patient_id.in_(patient_ids)).all()
    else:
        occupied = occupied_query.all()

    occupied_times = sorted({apt.time for apt in occupied})
    now = now_co()
    available: List[str] = []

    for slot in STANDARD_APPOINTMENT_SLOTS:
        if target_date == now.date():
            slot_time = datetime.strptime(slot, "%H:%M").time()
            if slot_time <= now.time():
                continue

        new_start, new_end = appointment_time_range(slot, duration)
        conflicts = False
        for apt in occupied:
            existing_start, existing_end = appointment_time_range(apt.time, apt.duration)
            if ranges_overlap(new_start, new_end, existing_start, existing_end):
                conflicts = True
                break
        if not conflicts:
            available.append(slot)

    return available, occupied_times

@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": user.email,
            "id": user.id,
            "role": user.role,
            "profile_complete": True # Assuming true for now or fetch from user
        },
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/login")
def login(request: LoginSchema, db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.email == request.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if not verify_password(request.password, user.password):
        raise HTTPException(status_code=400, detail="Contraseña incorrecta")

    if user.role == "superadmin" and superadmin_requires_2fa(db, user.id):
        temp_token = jwt.encode({
            "sub": user.email,
            "id": user.id,
            "role": user.role,
            "pending_2fa": True,
            "exp": datetime.utcnow() + timedelta(minutes=10),
        }, SECRET_KEY, algorithm="HS256")
        return {
            "success": True,
            "requires_2fa": True,
            "temp_token": temp_token,
            "user": {"id": user.id, "name": f"{user.nombres} {user.apellidos}", "role": user.role, "email": user.email},
        }
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": user.email,
            "id": user.id,
            "role": user.role,
            "profile_complete": True 
        },
        expires_delta=access_token_expires
    )
    
    return {
        "success": True,
        "token": access_token,
        "user": {
            "id": user.id,
            "name": f"{user.nombres} {user.apellidos}",
            "email": user.email,
            "role": user.role,
            "altura": user.altura,
            "peso_actual": user.peso_actual,
            "avatar": get_absolute_url(user.foto_perfil)
        },
        "profile_complete": True
    }

class ProgressMetricDB(Base):
    __tablename__ = "progress_metrics"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"))
    date = Column(Date, nullable=False)
    weight = Column(Float, nullable=False)
    body_fat = Column(Float, nullable=True)
    muscle = Column(Float, nullable=True)
    water = Column(Float, nullable=True)
    # Nuevas medidas
    waist = Column(Float, nullable=True)
    hip = Column(Float, nullable=True)
    chest = Column(Float, nullable=True)
    arm = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(String(50))
    
    patient = relationship("UserDB", foreign_keys=[patient_id])

class AchievementDB(Base):
    __tablename__ = "achievements"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    achieved_date = Column(Date, nullable=False)
    icon = Column(String(50), default="award")
    
    patient = relationship("UserDB", foreign_keys=[patient_id])

class NutritionistNoteDB(Base):
    __tablename__ = "nutritionist_notes"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"))
    note = Column(Text, nullable=False)
    created_at = Column(String(50))
    created_by = Column(Integer, ForeignKey("users.id"))
    
    patient = relationship("UserDB", foreign_keys=[patient_id])
    author = relationship("UserDB", foreign_keys=[created_by])

class NotificationDB(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    type = Column(String(50)) # appointment, message, progress
    title = Column(String(255))
    description = Column(Text)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=now_co)

class MessageDB(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"))
    receiver_id = Column(Integer, ForeignKey("users.id"))
    content = Column(Text)
    timestamp = Column(DateTime, default=now_co)
    read = Column(Boolean, default=False)
    type = Column(String(20), default="text")

class NotificationCreate(BaseModel):
    user_id: int
    type: str
    title: str
    description: str

# ==================== Tracking Models ====================
class WaterTrackingDB(Base):
    __tablename__ = "water_tracking"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"))
    date = Column(Date)
    amount_ml = Column(Integer, default=0)
    target_ml = Column(Integer, default=2500)
    updated_at = Column(DateTime, default=now_co)

class MealTrackingDB(Base):
    __tablename__ = "meal_tracking"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"))
    date = Column(Date)
    meal_type = Column(String(50)) # breakfast, lunch, etc.
    meal_name = Column(String(100))
    calories = Column(Integer, default=0)
    completed = Column(Integer, default=0)
    completed_at = Column(String(50), nullable=True)
    created_at = Column(String(50))
    updated_at = Column(DateTime, default=now_co)

class MealFoodItemDB(Base):
    __tablename__ = "meal_food_items"
    id = Column(Integer, primary_key=True, index=True)
    meal_tracking_id = Column(Integer, ForeignKey("meal_tracking.id"))
    name = Column(String(100))
    portion_size = Column(String(100))
    calories = Column(Integer)
    protein = Column(Float)
    carbs = Column(Float)
    fat = Column(Float)
    checked = Column(Integer, default=0)
    order_index = Column(Integer)

class WaterTrackingAdd(BaseModel):
    glass_ml: int = 250

class MealTrackingUpdate(BaseModel):
    meal_type: str
    date: str
    description: Optional[str] = None

class MessageCreate(BaseModel):
    receiver_id: int
    content: str
    type: str = "text"

# ==================== ESQUEMAS PYDANTIC PARA PROGRESS ====================

class ProgressMetricCreate(BaseModel):
    patient_id: int
    date: str  # YYYY-MM-DD
    weight: float
    body_fat: Optional[float] = None
    muscle: Optional[float] = None
    water: Optional[float] = None
    waist: Optional[float] = None
    hip: Optional[float] = None
    chest: Optional[float] = None
    arm: Optional[float] = None
    notes: Optional[str] = None

class ProgressMetricResponse(BaseModel):
    id: int
    patient_id: int
    date: str
    weight: float
    body_fat: Optional[float]
    muscle: Optional[float]
    water: Optional[float]
    waist: Optional[float]
    hip: Optional[float]
    chest: Optional[float]
    arm: Optional[float]
    notes: Optional[str]
    
    model_config = ConfigDict(from_attributes=True)

class AchievementCreate(BaseModel):
    patient_id: int
    title: str
    description: Optional[str] = None
    achieved_date: str  # YYYY-MM-DD
    icon: str = "award"

class AchievementResponse(BaseModel):
    id: int
    patient_id: int
    title: str
    description: Optional[str]
    achieved_date: str
    icon: str
    
    model_config = ConfigDict(from_attributes=True)

class NutritionistNoteCreate(BaseModel):
    patient_id: int
    note: str
    created_by: Optional[int] = None  # Si no se envía, se usa el usuario autenticado

class NutritionistNoteUpdate(BaseModel):
    note: str

class AchievementUpdate(BaseModel):
    title: str
    description: Optional[str] = None
    achieved_date: str  # YYYY-MM-DD
    icon: Optional[str] = None

class NutritionistNoteResponse(BaseModel):
    id: int
    patient_id: int
    note: str
    created_at: str
    created_by: int
    author_name: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class PatientProgressSummary(BaseModel):
    id: int
    name: str
    avatar: Optional[str]
    plan: str
    plan_id: Optional[int]
    start_date: str
    current_weight: float
    initial_weight: float
    goal_weight: float
    weekly_adherence: int
    trend: str  # "up", "down", "stable"
    last_update: str
    progress_percentage: int
    edad_formateada: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class PatientProgressDetails(BaseModel):
    id: int
    name: str
    avatar: Optional[str]
    plan: str
    start_date: str
    current_weight: float
    initial_weight: float
    goal_weight: float
    weekly_adherence: int
    trend: str
    last_update: str
    progress_percentage: int = 0
    edad_formateada: Optional[str] = None
    metrics: List[dict]
    metricsHistory: Optional[List[dict]] = None
    achievements: List[str]
    achievementsList: Optional[List[dict]] = None
    notes: List[str]
    notesList: Optional[List[dict]] = None

    model_config = ConfigDict(from_attributes=True)

class AdminProfileDB(Base):
    __tablename__ = "admin_profiles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    specialty = Column(String(100), nullable=True)
    license = Column(String(50), nullable=True)
    license_expiry = Column(String(20), nullable=True)
    bio = Column(Text, nullable=True)
    staff_role = Column(String(50), default="nutritionist")
    organization_id = Column(Integer, nullable=True)
    site_id = Column(Integer, nullable=True)
    invited_at = Column(String(50), nullable=True)
    invite_expires_at = Column(String(50), nullable=True)
    
    # Relación con usuario
    user = relationship("UserDB", foreign_keys=[user_id])

class AdminNotificationSettingsDB(Base):
    __tablename__ = "admin_notification_settings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    email_appointments = Column(Integer, default=1)
    email_messages = Column(Integer, default=1)
    email_marketing = Column(Integer, default=0)
    push_appointments = Column(Integer, default=1)
    push_messages = Column(Integer, default=1)
    sms_reminders = Column(Integer, default=1)
    
    user = relationship("UserDB", foreign_keys=[user_id])

class AdminAppearanceSettingsDB(Base):
    __tablename__ = "admin_appearance_settings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    theme = Column(String(20), default="light")
    language = Column(String(10), default="es")
    date_format = Column(String(20), default="dd/MM/yyyy")
    time_format = Column(String(10), default="24h")
    
    user = relationship("UserDB", foreign_keys=[user_id])

# Crear las tablas
safe_create_all()

# ==================== ESQUEMAS PYDANTIC PARA CONFIGURACIÓN ====================

class AdminProfileUpdate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    specialty: Optional[str] = None
    license: Optional[str] = None
    bio: Optional[str] = None
    address: Optional[str] = None

class AdminProfileResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str]
    specialty: Optional[str]
    license: Optional[str]
    bio: Optional[str]
    address: Optional[str]
    avatar: Optional[str]
    
    model_config = ConfigDict(from_attributes=True)

class NotificationSettingsUpdate(BaseModel):
    emailAppointments: bool
    emailMessages: bool
    emailMarketing: bool
    pushAppointments: bool
    pushMessages: bool
    smsReminders: bool

class NotificationSettingsResponse(BaseModel):
    emailAppointments: bool
    emailMessages: bool
    emailMarketing: bool
    pushAppointments: bool
    pushMessages: bool
    smsReminders: bool
    
    model_config = ConfigDict(from_attributes=True)

class AppearanceSettingsUpdate(BaseModel):
    theme: str
    language: str
    dateFormat: str
    timeFormat: str

class AppearanceSettingsResponse(BaseModel):
    theme: str
    language: str
    dateFormat: str
    timeFormat: str
    
    model_config = ConfigDict(from_attributes=True)

class PasswordChangeSchema(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

# Crear las tablas
safe_create_all()

# ==================== ESQUEMAS PYDANTIC ====================

class MealTrackingCreate(BaseModel):
    patient_id: int
    date: str
    meal_type: str
    meal_name: str
    calories: int
    protein: Optional[int] = 0
    carbs: Optional[int] = 0
    fat: Optional[int] = 0

class MealTrackingResponse(BaseModel):
    id: int
    patient_id: int
    date: str
    meal_type: str
    meal_name: str
    calories: int
    completed: bool
    completed_at: Optional[str]
    
    model_config = ConfigDict(from_attributes=True)

class WaterTrackingUpdate(BaseModel):
    amount_ml: int

class DailyMeal(BaseModel):
    name: str
    time: str
    calories: int
    completed: bool
    description: str
    protein: Optional[int] = 0
    carbs: Optional[int] = 0
    fat: Optional[int] = 0

class CustomFoodDB(Base):
    __tablename__ = "custom_foods"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String(255), nullable=False)
    portion_size = Column(String(100))
    calories = Column(Integer, default=0)
    protein = Column(Integer, default=0)
    carbs = Column(Integer, default=0)
    fat = Column(Integer, default=0)
    created_at = Column(String(50))
    
    patient = relationship("UserDB", foreign_keys=[patient_id])

# Crear las tablas
safe_create_all()

# ==================== ESQUEMAS PYDANTIC ====================

class FoodItemCreate(BaseModel):
    name: str
    portion_size: str
    calories: int
    protein: Optional[int] = 0
    carbs: Optional[int] = 0
    fat: Optional[int] = 0

class FoodItemResponse(BaseModel):
    name: str
    portion_size: str
    calories: int
    protein: int
    carbs: int
    fat: int
    checked: bool
    
    model_config = ConfigDict(from_attributes=True)

class MealDetailResponse(BaseModel):
    id: int
    name: str
    icon: str
    time: str
    completed: bool
    foods: List[FoodItemResponse]
    total_calories: int
    total_protein: int
    total_carbs: int
    total_fat: int

class AddFoodToMealRequest(BaseModel):
    meal_type: str
    date: Optional[str] = None
    food: FoodItemCreate

class ToggleFoodRequest(BaseModel):
    meal_type: str
    food_name: str
    date: Optional[str] = None

class MealLogRequest(BaseModel):
    meal_type: str
    date: str

class WeeklyMenuCompleteDB(Base):
    """Modelo extendido para menús semanales completos"""
    __tablename__ = "weekly_menus_complete"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    
    # Días de la semana con estructura JSON completa
    monday = Column(JSON, default={})
    tuesday = Column(JSON, default={})
    wednesday = Column(JSON, default={})
    thursday = Column(JSON, default={})
    friday = Column(JSON, default={})
    saturday = Column(JSON, default={})
    sunday = Column(JSON, default={})
    
    # Metadatos
    total_calories = Column(Integer, default=0)
    avg_protein = Column(Integer, default=0)
    avg_carbs = Column(Integer, default=0)
    avg_fat = Column(Integer, default=0)
    assigned_patients = Column(Integer, default=0)
    is_active = Column(Integer, default=1)
    created_at = Column(String(50))
    updated_at = Column(String(50))
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

# ==================== SUPPORT TICKET MODEL ====================

class SupportTicketDB(Base):
    __tablename__ = "support_tickets"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category = Column(String(50), nullable=False)  # technical, nutrition, billing, other
    subject = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String(20), default="open")  # open, in_progress, resolved, closed
    priority = Column(String(20), default="normal")  # low, normal, high
    admin_response = Column(Text, nullable=True)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # quien respondió
    assigned_agent_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    escalated = Column(Integer, default=0)
    escalated_at = Column(String(50), nullable=True)
    sla_due_at = Column(String(50), nullable=True)
    first_response_at = Column(String(50), nullable=True)
    ticket_level = Column(String(10), default="L1")
    created_at = Column(String(50), default=lambda: now_co().strftime("%Y-%m-%d %H:%M:%S"))
    updated_at = Column(String(50), default=lambda: now_co().strftime("%Y-%m-%d %H:%M:%S"))
    resolved_at = Column(String(50), nullable=True)

class FAQDB(Base):
    __tablename__ = "faqs"
    
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(50), nullable=False)  # nutrition, app_usage, plans, billing, general
    question = Column(String(500), nullable=False)
    answer = Column(Text, nullable=False)
    order = Column(Integer, default=0)  # para ordenar las FAQs
    is_active = Column(Boolean, default=True)
    created_at = Column(String(50), default=lambda: now_co().strftime("%Y-%m-%d %H:%M:%S"))
    updated_at = Column(String(50), default=lambda: now_co().strftime("%Y-%m-%d %H:%M:%S"))


class ArticleDB(Base):
    """Artículos del home público, publicados por el superadmin."""
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    slug = Column(String(280), unique=True, nullable=True, index=True)
    excerpt = Column(Text, nullable=True)
    content = Column(Text, nullable=False)
    category = Column(String(80), default="Nutrición")
    author = Column(String(150), nullable=True)
    image = Column(String(500), nullable=True)
    meta_description = Column(String(320), nullable=True)
    og_image = Column(String(500), nullable=True)
    is_published = Column(Boolean, default=False)
    published_at = Column(String(50), nullable=True)
    scheduled_publish_at = Column(String(50), nullable=True)
    view_count = Column(Integer, default=0)
    clinical_conditions = Column(JSON, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(String(50), default=lambda: now_co().strftime("%Y-%m-%d %H:%M:%S"))
    updated_at = Column(String(50), default=lambda: now_co().strftime("%Y-%m-%d %H:%M:%S"))


class ArticleCategoryDB(Base):
    """Categorías gestionables para el CMS de artículos."""
    __tablename__ = "article_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(80), unique=True, nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(String(50), default=lambda: now_co().strftime("%Y-%m-%d %H:%M:%S"))
    updated_at = Column(String(50), default=lambda: now_co().strftime("%Y-%m-%d %H:%M:%S"))


from platform_module import (
    register_platform_models,
    register_platform_routes,
    ensure_platform_schema,
    log_audit,
    get_staff_role,
    staff_has_permission,
    enhanced_authorize_patient_access,
)

from nutritionist_module import (
    register_nutritionist_models,
    ensure_nutritionist_schema,
    register_nutritionist_routes,
)
from phase4_module import register_phase4_models, register_phase4_routes
from patient_phase1_module import register_patient_phase1_routes
from patient_phase2_module import (
    register_patient_phase2_models,
    ensure_patient_phase2_schema,
    register_patient_phase2_routes,
)
from patient_phase3_module import (
    register_patient_phase3_models,
    ensure_patient_phase3_schema,
    register_patient_phase3_routes,
)
from patient_phase4_module import (
    register_patient_phase4_models,
    ensure_patient_phase4_schema,
    register_patient_phase4_routes,
)
from billing_module import (
    register_billing_models,
    migrate_billing_schema,
    register_billing_routes,
    enforce_org_quota,
    enforce_nutritionist_quota,
)
from ops_module import (
    register_ops_models,
    migrate_ops_schema,
    register_ops_routes,
    create_ops_metrics_middleware,
    enqueue_ops_job,
)
from compliance_module import (
    register_compliance_models,
    migrate_compliance_schema,
    register_compliance_routes,
    log_clinical_access,
)
from integrations_module import (
    register_integrations_models,
    migrate_integrations_schema,
    register_integrations_routes,
    dispatch_webhook_event,
)
from support_module import (
    register_support_models,
    migrate_support_schema,
    register_support_routes,
    on_ticket_created,
)
from platform_analytics_module import (
    register_platform_analytics_models,
    migrate_platform_analytics_schema,
    register_platform_analytics_routes,
)
from clinical_content_module import (
    register_clinical_content_models,
    migrate_clinical_content_schema,
    register_clinical_content_routes,
    seed_clinical_content_defaults,
    load_challenge_defs,
    load_prep_item_defs,
    load_substitution_groups,
)
from crosscutting_module import (
    register_crosscutting_models,
    migrate_crosscutting_schema,
    register_crosscutting_routes,
    seed_crosscutting_defaults,
    create_rate_limit_middleware,
    superadmin_requires_2fa,
    verify_totp_code,
)

OrganizationDB, OrganizationMemberDB, OrganizationSiteDB, AuditLogDB = register_platform_models(Base)
InterventionTemplateDB = register_nutritionist_models(Base)
FollowUpTaskDB = register_phase4_models(Base)
PatientInterventionDB, AppointmentPrepChecklistDB = register_patient_phase2_models(Base)
PatientChallengeClaimDB, PatientHabitLogDB, PatientReminderPrefsDB = register_patient_phase3_models(Base)
MealPhotoDB, WearableSnapshotDB, OfflineSyncLogDB = register_patient_phase4_models(Base)
BillingPlanDB, SubscriptionDB, InvoiceDB, PaymentWebhookDB = register_billing_models(Base)
OpsJobDB = register_ops_models(Base)
(
    PrivacyConsentDB,
    LegalDocumentDB,
    ClinicalAccessLogDB,
    DataDeletionRequestDB,
    SecurityBreachReportDB,
) = register_compliance_models(Base)
IntegrationConnectionDB, OutgoingWebhookDB, WebhookDeliveryLogDB = register_integrations_models(Base)
SupportMacroDB = register_support_models(Base)
PlatformModuleUsageDB, PlatformAppSessionDB, NpsSurveyDB = register_platform_analytics_models(Base)
ChallengeTemplateDB, FoodSubstitutionGroupDB, AppointmentPrepTemplateDB = register_clinical_content_models(Base)
(
    ImpersonationLogDB,
    PartnerApiKeyDB,
    MassCommunicationDB,
    WorkflowRuleDB,
    ScheduledReportDB,
    ReleaseNoteDB,
    SuperadminTotpDB,
    SuperadminIpAllowlistDB,
) = register_crosscutting_models(Base)


def _run_database_bootstrap():
    """Migraciones y seeds — diferido para arranque rápido en Cloud Run."""
    global _DB_AVAILABLE
    if os.getenv("K_SERVICE") and not os.getenv("DATABASE_URL"):
        _DB_AVAILABLE = False
        print("[DB] Cloud Run sin DATABASE_URL — bootstrap omitido")
        return
    try:
        ensure_schema_migrations()
        ensure_platform_schema(engine, inspect, text, None)
        ensure_nutritionist_schema(engine, inspect, text)
        ensure_patient_phase2_schema(engine, inspect, text)
        ensure_patient_phase3_schema(engine, inspect, text)
        ensure_patient_phase4_schema(engine, inspect, text)
        migrate_billing_schema(engine, inspect, text, BillingPlanDB)
        migrate_ops_schema(engine, inspect, text, OpsJobDB)
        migrate_compliance_schema(engine, inspect, text, LegalDocumentDB)
        migrate_integrations_schema(engine, inspect, text)
        migrate_support_schema(engine, inspect, text)
        migrate_platform_analytics_schema(engine, inspect, text)
        migrate_clinical_content_schema(engine, inspect, text, InterventionTemplateDB)
        migrate_crosscutting_schema(engine, inspect, text)
        safe_create_all()
        boot_db = SessionLocal()
        try:
            boot_settings = boot_db.query(SystemSettingsDB).first()
            refresh_runtime_cache(boot_settings)
            seed_clinical_content_defaults(boot_db, now_co, InterventionTemplateDB)
            seed_crosscutting_defaults(boot_db, now_co)
        finally:
            boot_db.close()
        print("[DB] Bootstrap completado")
    except Exception as e:
        _DB_AVAILABLE = False
        print(f"[DB] Bootstrap falló (modo degradado): {e}")


# ==================== ESQUEMAS PYDANTIC ====================

class MealSlotCreate(BaseModel):
    type: str  # desayuno, almuerzo, comida, merienda, cena
    recipe_id: Optional[int] = None
    recipe_name: Optional[str] = None
    calories: int = 0
    protein: int = 0
    carbs: int = 0
    fat: int = 0
    time: str
    notes: Optional[str] = None
    image: Optional[str] = None

class DayMenuCreate(BaseModel):
    day: str  # Lunes, Martes, etc.
    week: Optional[int] = 1  # 1-4
    meals: List[MealSlotCreate]

class WeeklyMenuCompleteCreate(BaseModel):
    name: str
    description: str
    category: str
    week: List[DayMenuCreate]

class WeeklyMenuCompleteUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    week: Optional[List[DayMenuCreate]] = None

class WeeklyMenuCompleteResponse(BaseModel):
    id: int
    name: str
    description: str
    category: str
    week: List[dict]
    total_calories: int
    avg_protein: int
    avg_carbs: int
    avg_fat: int
    assigned_patients: int
    is_active: int
    created_at: str
    
    model_config = ConfigDict(from_attributes=True)

class AssignWeeklyMenuSchema(BaseModel):
    patient_ids: List[int]
    menu_id: int
    start_date: str
    notes: Optional[str] = None


class BulkPatientStatusSchema(BaseModel):
    patient_ids: List[int]
    status: str  # activo | pendiente | inactivo


class SuperAdminUserCreate(BaseModel):
    name: str
    email: EmailStr
    role: str  # patient, admin, superadmin
    phone: Optional[str] = None
    password: Optional[str] = None

class SuperAdminUserUpdate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    role: str
    status: str

class SuperAdminUserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    status: str
    avatar: Optional[str] = None
    createdAt: str
    lastLogin: Optional[str] = None
    nutritionist_name: Optional[str] = None
    organization_name: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class SuperAdminStatsResponse(BaseModel):
    total_users: int
    total_patients: int
    total_admins: int
    total_superadmins: int
    active_users: int
    pending_users: int
    inactive_users: int
    new_users_this_month: int

class NutritionistResponse(BaseModel):
    id: int
    name: str
    email: str
    specialty: Optional[str] = None
    patients: int
    rating: float
    status: str
    avatar: Optional[str] = None
    joinedAt: str
    organization: Optional[str] = None
    organization_id: Optional[int] = None
    staff_role: Optional[str] = None
    license: Optional[str] = None
    license_expiry: Optional[str] = None
    license_alert: Optional[str] = None
    invite_expires_at: Optional[str] = None
    onboarding: Optional[dict] = None
    
    model_config = ConfigDict(from_attributes=True)


class NutritionistProfileUpdate(BaseModel):
    specialty: Optional[str] = None
    license: Optional[str] = None
    license_expiry: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    organization_id: Optional[int] = None
    site_id: Optional[int] = None
    staff_role: Optional[str] = None

# ==================== FUNCIONES AUXILIARES ====================

def check_profile_complete(user: UserDB) -> bool:
    required_fields = [
        user.altura, 
        user.peso_actual, 
        user.nivel_actividad,
        user.alergias,
        user.preferencias
    ]
    if any(f is None for f in required_fields[:3]):
        return False
    return True

def calcular_edad_detallada(fecha_nacimiento: Optional[date]) -> str:
    """
    Calcula la edad en años y días.
    """
    if not fecha_nacimiento:
        return "Edad no registrada"
    
    hoy = today_co()
    
    # Calcular años
    años = hoy.year - fecha_nacimiento.year
    if (hoy.month, hoy.day) < (fecha_nacimiento.month, fecha_nacimiento.day):
        años -= 1
        
    # Calcular días desde el último cumpleaños
    # Primero buscamos el cumpleaños más reciente
    try:
        ultimo_cumple = date(hoy.year, fecha_nacimiento.month, fecha_nacimiento.day)
        if ultimo_cumple > hoy:
             ultimo_cumple = date(hoy.year - 1, fecha_nacimiento.month, fecha_nacimiento.day)
    except ValueError:
        # Manejo especial para años bisiestos (29 feb)
        ultimo_cumple = date(hoy.year, 3, 1) if hoy.month >= 3 else date(hoy.year - 1, 3, 1)
        
    dias = (hoy - ultimo_cumple).days
    
    parts = []
    if años == 1:
        parts.append("1 año")
    elif años > 1:
        parts.append(f"{años} años")
        
    if dias == 1:
        parts.append("1 día")
    elif dias > 0 or not parts:
        parts.append(f"{dias} días")
        
    return ", ".join(parts)

def get_frequency_label(freq_id: Optional[str]) -> str:
    """Convierte id de frecuencia a etiqueta legible (alineado con el front)."""
    if not freq_id:
        return "No registrado"
    if freq_id == "never":
        return "Nunca o casi nunca"
    if freq_id.startswith("month_"):
        return f"Al mes: {freq_id.split('_')[1]}"
    if freq_id.startswith("week_"):
        return f"A la semana: {freq_id.split('_')[1]}"
    if freq_id.startswith("day_"):
        val = freq_id.split("_")[1]
        return f"Al día: {'≥ 6' if val == '6' else val}"
    return str(freq_id)

def calcular_progreso(peso_actual: Optional[float], peso_objetivo: Optional[float], peso_inicial: Optional[float] = None) -> int:
    """Calcula el progreso del paciente basado en peso actual vs objetivo, usando el inicial como base"""
    if peso_actual is None or peso_objetivo is None:
        return 0
    
    # Si no hay peso inicial, no podemos calcular progreso relativo, 
    # usamos el peso actual como inicial (progreso 0%) o la lógica antigua
    if peso_inicial is None or peso_inicial == peso_objetivo:
        if not peso_actual or not peso_objetivo or peso_objetivo == 0:
            return 0
        if peso_objetivo < peso_actual:
            progreso = ((peso_actual - peso_objetivo) / peso_actual) * 100
        else:
            progreso = (peso_actual / peso_objetivo) * 100
        return min(100, max(0, int(progreso)))

    # Lógica de progreso relativo al punto de partida
    total_a_recorrer = abs(peso_inicial - peso_objetivo)
    if total_a_recorrer == 0:
        return 100 if peso_actual == peso_objetivo else 0
    
    distancia_recorrida = abs(peso_inicial - peso_actual)
    
    # Verificar que el movimiento sea en la dirección correcta
    # Si es pérdida de peso
    if peso_objetivo < peso_inicial:
        if peso_actual > peso_inicial: # Está ganando peso en lugar de perder
            return 0
        achieved = peso_inicial - peso_actual
        total_needed = peso_inicial - peso_objetivo
    # Si es ganancia de peso
    else:
        if peso_actual < peso_inicial: # Está perdiendo peso en lugar de ganar
            return 0
        achieved = peso_actual - peso_inicial
        total_needed = peso_objetivo - peso_inicial
        
    progreso = (achieved / total_needed) * 100
    return min(100, max(0, int(progreso)))


def build_nutrition_report_bytes(patient_id: int, db: Session, current_user: UserDB = None):
    """Construye el PDF detallado del informe nutricional y devuelve (bytes, filename)."""
    from pdf_utils import draw_pdf_signature_block, get_nutritionist_signatory, make_verification_code

    patient = db.query(UserDB).filter(UserDB.id == patient_id, UserDB.role == "patient").first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    nutritionist = current_user if current_user and current_user.role in ("admin", "superadmin") else None
    if nutritionist is None and getattr(patient, 'nutritionist_id', None):
        nutritionist = db.query(UserDB).filter(UserDB.id == patient.nutritionist_id).first()

    recent_metrics = db.query(ProgressMetricDB).filter(ProgressMetricDB.patient_id == patient_id).order_by(ProgressMetricDB.date.desc()).limit(6).all()

    buffer = io.BytesIO()
    width, height = A4
    p = canvas.Canvas(buffer, pagesize=A4)

    primary = colors.HexColor('#7a9b76')
    cream = colors.HexColor('#faf5f0')
    text_color = colors.HexColor('#352d26')
    accent = colors.HexColor('#c9a96a')

    header_h = 100
    p.setFillColor(primary)
    p.rect(0, height - header_h, width, header_h, stroke=0, fill=1)
    p.setFillColor(colors.white)
    p.setFont("Helvetica-Bold", 20)
    p.drawString(50, height - 48, "NutriData — Informe Nutricional Profesional")
    p.setFont("Helvetica", 9)
    p.drawString(50, height - 66, f"Generado: {now_co().strftime('%Y-%m-%d %H:%M COT')}")

    card_x = 40
    card_w = width - 80
    card_h = 76
    card_y = height - header_h - 20 - card_h
    p.setFillColor(cream)
    p.roundRect(card_x, card_y, card_w, card_h, 6, stroke=1, fill=1)
    p.setStrokeColor(colors.HexColor('#e0d9d0'))
    p.setFillColor(text_color)
    p.setFont("Helvetica-Bold", 14)
    p.drawString(card_x + 12, card_y + card_h - 20, f"{patient.nombres or ''} {patient.apellidos or ''}".strip() or "Paciente")
    p.setFont("Helvetica", 10)
    dob = ""
    if patient.fecha_nacimiento:
        try:
            dob = patient.fecha_nacimiento.strftime("%d/%m/%Y")
        except Exception:
            dob = str(patient.fecha_nacimiento)
    edad_str = calcular_edad_detallada(patient.fecha_nacimiento)
    p.drawString(card_x + 12, card_y + card_h - 36, f"Email: {patient.email or '—'}  ·  Teléfono: {patient.telefono or '—'}")
    p.drawString(card_x + 12, card_y + card_h - 52, f"Fecha de nacimiento: {dob or '—'}  ·  Edad: {edad_str}  ·  Género: {(patient.genero or '—').capitalize()}")

    left_x = card_x + 6
    left_y = card_y - 28
    p.setFont("Helvetica-Bold", 12)
    p.setFillColor(primary)
    p.drawString(left_x, left_y, "Medidas y estado antropométrico")
    p.setFillColor(text_color)
    left_y -= 6
    p.setStrokeColor(accent)
    p.setLineWidth(0.5)
    p.line(left_x, left_y, left_x + 220, left_y)
    left_y -= 18
    bmi = None
    try:
        if patient.peso_actual and patient.altura:
            h_m = (patient.altura / 100)
            bmi = round(patient.peso_actual / (h_m * h_m), 2)
    except Exception:
        bmi = None
    peso_act = patient.peso_actual if patient.peso_actual is not None else "—"
    peso_obj = patient.peso_objetivo if patient.peso_objetivo is not None else "—"
    alt = patient.altura if patient.altura is not None else "—"
    imc_str = str(bmi) if bmi is not None else "N/A"
    medidas_line = f"Peso actual: {peso_act} kg  ·  Peso objetivo: {peso_obj} kg  ·  Altura: {alt} cm  ·  IMC: {imc_str}"
    p.setFont("Helvetica", 10)
    p.drawString(left_x, left_y, medidas_line)
    left_y -= 22

    prog = calcular_progreso(patient.peso_actual, patient.peso_objetivo, getattr(patient, "peso_inicial", None))
    p.setFont("Helvetica-Bold", 11)
    p.setFillColor(text_color)
    p.drawString(left_x, left_y, "Progreso hacia objetivo de peso")
    left_y -= 14
    bar_x = left_x
    bar_w = 240
    bar_h = 10
    p.setFillColor(colors.HexColor('#e6e6e6'))
    p.rect(bar_x, left_y - 6, bar_w, bar_h, fill=1, stroke=0)
    p.setFillColor(primary)
    fill_w = max(0, min(bar_w, (prog or 0) / 100 * bar_w))
    p.rect(bar_x, left_y - 6, fill_w, bar_h, fill=1, stroke=0)
    p.setFillColor(text_color)
    p.setFont("Helvetica", 9)
    p.drawString(bar_x + bar_w + 8, left_y - 4, f"{prog}%")

    eval_block_y = left_y - 60
    if eval_block_y < 140:
        p.showPage()
        eval_block_y = height - 72
    p.setFont("Helvetica-Bold", 12)
    p.setFillColor(primary)
    p.drawString(50, eval_block_y, "Evaluación nutricional")
    p.setFillColor(text_color)
    eval_block_y -= 6
    p.setStrokeColor(accent)
    p.line(50, eval_block_y, 250, eval_block_y)
    eval_block_y -= 18
    p.setFont("Helvetica", 10)
    eval_text = (patient.evaluacion_nutricional or "No se ha registrado una evaluación.").strip()
    for paragraph in eval_text.split('\n'):
        for i in range(0, len(paragraph), 100):
            if eval_block_y < 80:
                p.showPage()
                eval_block_y = height - 72
            p.drawString(50, eval_block_y, paragraph[i:i+100])
            eval_block_y -= 14

    metrics_section_y = eval_block_y - 28
    if metrics_section_y < 180:
        p.showPage()
        metrics_section_y = height - 72
    table_w = 360
    table_x = 50
    p.setFont("Helvetica-Bold", 12)
    p.setFillColor(primary)
    p.drawString(table_x, metrics_section_y, "Métricas recientes")
    p.setFillColor(text_color)
    header_y = metrics_section_y - 20
    p.setFont("Helvetica-Bold", 9)
    cols = ["Fecha", "Peso (kg)", "Grasa (%)", "Músculo (kg)", "Cintura (cm)"]
    col_x = [table_x + 4, table_x + 72, table_x + 132, table_x + 202, table_x + 272]
    p.setFillColor(primary)
    p.rect(table_x, header_y - 4, table_w, 18, fill=1, stroke=1)
    p.setStrokeColor(colors.HexColor("#5a7d56"))
    p.setFillColor(colors.white)
    for i, c in enumerate(cols):
        p.drawString(col_x[i], header_y + 2, c)
    p.setFillColor(text_color)
    row_y = header_y - 16
    p.setFont("Helvetica", 9)
    if recent_metrics:
        for m in recent_metrics:
            date_str = m.date.strftime("%d/%m/%Y") if getattr(m, "date", None) else ""
            p.drawString(col_x[0], row_y, date_str[:10] if len(date_str) > 10 else date_str)
            p.drawString(col_x[1], row_y, f"{m.weight:.1f}" if m.weight is not None else "—")
            p.drawString(col_x[2], row_y, f"{m.body_fat:.1f}" if m.body_fat is not None else "—")
            p.drawString(col_x[3], row_y, f"{m.muscle:.1f}" if m.muscle is not None else "—")
            p.drawString(col_x[4], row_y, f"{m.waist:.1f}" if m.waist is not None else "—")
            row_y -= 15
            if row_y < 120:
                break
    else:
        p.drawString(col_x[0], row_y, "No hay métricas registradas")
    metrics_bottom_y = row_y - 10

    # Menú semanal semana a semana (plan activo) — con estilos y porciones/gramos
    menu_section_y = metrics_bottom_y - 28
    active_plan = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.patient_id == patient_id,
        PatientMealPlanDB.status == "active"
    ).order_by(PatientMealPlanDB.id.desc()).first()
    days_map = [
        ("monday", "Lunes"), ("tuesday", "Martes"), ("wednesday", "Miércoles"),
        ("thursday", "Jueves"), ("friday", "Viernes"), ("saturday", "Sábado"), ("sunday", "Domingo")
    ]

    def _meal_portion_grams(m):
        """Extrae porción y gramos de un item de comida (dict)."""
        if not isinstance(m, dict):
            return "", ""
        portion = m.get("portion") or m.get("portions") or m.get("portion_size") or ""
        if portion is not None:
            portion = str(portion).strip()
        ing_list = m.get("ingredients") or []
        grams_parts = []
        if isinstance(ing_list, list):
            for ing in ing_list:
                if isinstance(ing, dict):
                    p = ing.get("portion") or ing.get("portion_size") or ""
                    if p:
                        grams_parts.append(str(p).strip())
                elif isinstance(ing, str) and ":" in ing:
                    part = ing.split(":")[-1].strip()
                    if part:
                        grams_parts.append(part)
        grams_str = ", ".join(grams_parts)[:40] if grams_parts else ""
        return portion, grams_str

    if active_plan:
        weekly_menus = db.query(WeeklyMenuDB).filter(
            WeeklyMenuDB.meal_plan_id == active_plan.meal_plan_id
        ).order_by(WeeklyMenuDB.week_number).all()
        plan_name = ""
        plan_obj = db.query(MealPlanDB).filter(MealPlanDB.id == active_plan.meal_plan_id).first()
        if plan_obj:
            plan_name = getattr(plan_obj, "name", None) or "Plan"
        for wm in weekly_menus:
            if menu_section_y < 220:
                p.showPage()
                menu_section_y = height - 72
            # Título con línea decorativa (mismo estilo que otras secciones)
            p.setFont("Helvetica-Bold", 12)
            p.setFillColor(primary)
            p.drawString(50, menu_section_y, f"Menú semanal — Semana {wm.week_number}" + (f" ({plan_name})" if plan_name else ""))
            p.setFillColor(text_color)
            menu_section_y -= 6
            p.setStrokeColor(accent)
            p.setLineWidth(0.8)
            p.line(50, menu_section_y, 200, menu_section_y)
            menu_section_y -= 20
            # Encabezado de tabla
            col_dia_w = 52
            col_comida_w = 180
            col_porcion_w = 55
            col_gramos_w = 120
            table_x = 50
            header_y = menu_section_y
            p.setFont("Helvetica-Bold", 9)
            p.setFillColor(primary)
            p.rect(table_x, header_y - 4, col_dia_w + col_comida_w + col_porcion_w + col_gramos_w, 14, fill=1, stroke=1)
            p.setStrokeColor(colors.HexColor("#5a7d56"))
            p.setFillColor(colors.white)
            p.drawString(table_x + 2, header_y + 2, "Día")
            p.drawString(table_x + col_dia_w + 4, header_y + 2, "Comida")
            p.drawString(table_x + col_dia_w + col_comida_w + 4, header_y + 2, "Porción")
            p.drawString(table_x + col_dia_w + col_comida_w + col_porcion_w + 4, header_y + 2, "Gramos")
            p.setFillColor(text_color)
            row_y = header_y - 14
            p.setFont("Helvetica", 9)
            week_idx = max(0, (wm.week_number or 1) - 1)
            row_parity = 0
            for day_key, day_name in days_map:
                day_val = getattr(wm, day_key, None)
                if isinstance(day_val, str):
                    try:
                        day_val = json.loads(day_val)
                    except Exception:
                        day_val = {}
                if isinstance(day_val, list) and len(day_val) > week_idx:
                    day_val = day_val[week_idx] if isinstance(day_val[week_idx], dict) else {}
                elif not isinstance(day_val, dict):
                    day_val = {}
                meals_list = day_val.get("meals", []) if isinstance(day_val, dict) else []
                if not meals_list:
                    # Fila vacía: fondo suave acorde a la paleta (crema)
                    bg = cream if not row_parity else colors.HexColor("#f1ebe3")
                    p.setFillColor(bg)
                    p.rect(table_x, row_y - 2, col_dia_w + col_comida_w + col_porcion_w + col_gramos_w, 12, fill=1, stroke=0)
                    p.setFillColor(text_color)
                    p.drawString(table_x + 2, row_y + 2, day_name)
                    p.drawString(table_x + col_dia_w + 4, row_y + 2, "—")
                    row_y -= 12
                    row_parity = 1 - row_parity
                    if row_y < 90:
                        p.showPage()
                        row_y = height - 72
                    continue
                for idx, m in enumerate(meals_list if isinstance(meals_list, list) else []):
                    name = "—"
                    portion_str = ""
                    grams_str = ""
                    if isinstance(m, dict):
                        name = (m.get("recipe_name") or m.get("name") or m.get("type") or "—")[:38]
                        portion_str, grams_str = _meal_portion_grams(m)
                        portion_str = str(portion_str)[:12]
                    # Fondo alterno suave en tonos crema para mantener identidad visual
                    if row_parity:
                        p.setFillColor(colors.HexColor("#f3eee5"))
                        p.rect(table_x, row_y - 2, col_dia_w + col_comida_w + col_porcion_w + col_gramos_w, 12, fill=1, stroke=0)
                    p.setFillColor(text_color)
                    day_cell = day_name if idx == 0 else ""
                    p.drawString(table_x + 2, row_y + 2, day_cell)
                    p.drawString(table_x + col_dia_w + 4, row_y + 2, name)
                    p.drawString(table_x + col_dia_w + col_comida_w + 4, row_y + 2, portion_str)
                    p.drawString(table_x + col_dia_w + col_comida_w + col_porcion_w + 4, row_y + 2, grams_str[:28])
                    row_y -= 12
                    row_parity = 1 - row_parity
                    if row_y < 90:
                        p.showPage()
                        row_y = height - 72
            menu_section_y = row_y - 16
    else:
        if menu_section_y < 180:
            p.showPage()
            menu_section_y = height - 72
        p.setFont("Helvetica-Bold", 12)
        p.setFillColor(primary)
        p.drawString(50, menu_section_y, "Menú semanal")
        p.setFillColor(text_color)
        menu_section_y -= 6
        p.setStrokeColor(accent)
        p.line(50, menu_section_y, 180, menu_section_y)
        menu_section_y -= 18
        p.setFont("Helvetica", 10)
        p.drawString(50, menu_section_y, "El paciente no tiene un plan activo asignado.")
        menu_section_y -= 20
    menu_bottom_y = menu_section_y

    notes_y = menu_bottom_y - 24
    note_obj = db.query(NutritionistNoteDB).filter(NutritionistNoteDB.patient_id == patient_id).order_by(NutritionistNoteDB.created_at.desc()).first()
    if note_obj:
        nutritionist_note = note_obj.note
        if notes_y < 120:
            p.showPage()
            notes_y = height - 72
        p.setFont("Helvetica-Bold", 11)
        p.setFillColor(text_color)
        p.drawString(50, notes_y, "Nota del nutricionista")
        notes_y -= 6
        p.setStrokeColor(accent)
        p.line(50, notes_y, 200, notes_y)
        notes_y -= 16
        p.setFont("Helvetica", 10)
        for i in range(0, len(nutritionist_note), 100):
            if notes_y < 80:
                p.showPage()
                notes_y = height - 72
            p.drawString(50, notes_y, nutritionist_note[i:i+100])
            notes_y -= 14

    footer_y = 90
    generated_at_dt = now_co()
    generated_at = generated_at_dt.strftime("%Y-%m-%d %H:%M COT")
    signatory_id = nutritionist.id if nutritionist else 0
    verification_code = make_verification_code(signatory_id, "nutrition_report", generated_at_dt)
    nutri_name, license_to, specialty = get_nutritionist_signatory(db, nutritionist, AdminProfileDB)

    if footer_y < 100:
        p.showPage()
        footer_y = height - 120
    draw_pdf_signature_block(
        p,
        x=50,
        y=footer_y,
        width=width - 100,
        nutritionist_name=nutri_name,
        license_to=license_to,
        specialty=specialty,
        generated_at=generated_at,
        verification_code=verification_code,
        doc_label="Informe nutricional",
    )

    p.save()

    buffer.seek(0)
    pdf_bytes = buffer.getvalue()
    safe_name = (f"{patient.nombres or ''}_{patient.apellidos or ''}".strip() or "paciente").replace(" ", "_")
    date_str = now_co().strftime("%Y-%m-%d")
    filename = f"informe_nutricional_{safe_name}_{date_str}.pdf"
    return pdf_bytes, filename


def _pdf_wrap_lines(text: str, max_chars: int = 95):
    """Divide texto en líneas para canvas PDF (simple)."""
    if not text:
        return []
    lines = []
    for paragraph in str(text).replace("\r\n", "\n").split("\n"):
        paragraph = paragraph.strip()
        if not paragraph:
            lines.append("")
            continue
        while len(paragraph) > max_chars:
            cut = paragraph.rfind(" ", 0, max_chars)
            if cut < 20:
                cut = max_chars
            lines.append(paragraph[:cut].strip())
            paragraph = paragraph[cut:].strip()
        if paragraph:
            lines.append(paragraph)
    return lines


def build_clinical_history_pdf_bytes(patient_id: int, data: dict, current_user: UserDB, db: Session):
    """PDF Historia Clínica Nutricional (formato EVANUT / Word) con firma digital."""
    from pdf_utils import draw_pdf_signature_block, get_nutritionist_signatory, make_verification_code

    patient = db.query(UserDB).filter(UserDB.id == patient_id, UserDB.role == "patient").first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    nutritionist = current_user if current_user and current_user.role in ("admin", "superadmin") else None
    if nutritionist is None and getattr(patient, "nutritionist_id", None):
        nutritionist = db.query(UserDB).filter(UserDB.id == patient.nutritionist_id).first()

    nutri_name, license_to, specialty = get_nutritionist_signatory(db, nutritionist, AdminProfileDB)
    generated_at_dt = now_co()
    generated_at = generated_at_dt.strftime("%Y-%m-%d %H:%M COT")
    signatory_id = nutritionist.id if nutritionist else 0
    verification_code = make_verification_code(signatory_id, "clinical_history", generated_at_dt)

    buffer = io.BytesIO()
    width, height = A4
    p = canvas.Canvas(buffer, pagesize=A4)
    primary = colors.HexColor("#7a9b76")
    text_color = colors.HexColor("#352d26")
    muted = colors.HexColor("#6b6159")
    left = 45
    right = width - 45
    y = height - 50

    def draw_footer():
        p.setFont("Helvetica", 8)
        p.setFillColor(muted)
        footer = f"Firmado digitalmente por {nutri_name}"
        if license_to:
            footer += f" · TO: {license_to}"
        footer += f" · {generated_at} · Verificación: {verification_code}"
        p.drawString(left, 28, footer[:115])
        p.drawRightString(right, 28, "Historia Clínica Nutricional · NutriData")
        p.line(left, 38, right, 38)

    def new_page():
        nonlocal y
        draw_footer()
        p.showPage()
        y = height - 50

    def ensure(space=60):
        nonlocal y
        if y < space:
            new_page()

    def heading(title: str):
        nonlocal y
        ensure(70)
        y -= 8
        p.setFillColor(primary)
        p.setFont("Helvetica-Bold", 12)
        p.drawString(left, y, title.upper())
        y -= 6
        p.setStrokeColor(primary)
        p.setLineWidth(1)
        p.line(left, y, right, y)
        y -= 14
        p.setFillColor(text_color)

    def label_value(label: str, value: str, bold_label=True):
        nonlocal y
        ensure(40)
        p.setFont("Helvetica-Bold" if bold_label else "Helvetica", 9)
        p.setFillColor(text_color)
        p.drawString(left, y, f"{label}:")
        p.setFont("Helvetica", 9)
        val = (value or "—").strip() if value is not None else "—"
        # mismo renglón si cabe
        label_w = p.stringWidth(f"{label}: ", "Helvetica-Bold", 9)
        first_max = max(20, int((right - left - label_w) / 5.2))
        lines = _pdf_wrap_lines(val, first_max if first_max < 90 else 90)
        if not lines:
            lines = ["—"]
        p.drawString(left + label_w + 4, y, lines[0])
        y -= 14
        for line in lines[1:]:
            ensure(30)
            p.drawString(left + 8, y, line)
            y -= 12

    def block(label: str, value: str):
        nonlocal y
        ensure(50)
        p.setFont("Helvetica-Bold", 9)
        p.setFillColor(text_color)
        p.drawString(left, y, f"{label}:")
        y -= 14
        p.setFont("Helvetica", 9)
        for line in _pdf_wrap_lines(value or "—", 100) or ["—"]:
            ensure(30)
            p.drawString(left + 6, y, line)
            y -= 12
        y -= 6

    def checks(items):
        nonlocal y
        ensure(30)
        p.setFont("Helvetica", 9)
        p.setFillColor(text_color)
        parts = []
        for label, on in items:
            parts.append(f"[{'X' if on else ' '}] {label}")
        text = "   ".join(parts)
        for line in _pdf_wrap_lines(text, 100) or [text]:
            ensure(28)
            p.drawString(left + 6, y, line)
            y -= 12

    # Header
    # Header
    logo_path = os.getenv("PDF_LOGO_URL", "https://utridata.com/logo-light.png") # Usar variable de entorno o URL por defecto
    try:
        logo = ImageReader(logo_path)
        logo_width = 120
        logo_height = 33
        logo_x = left
        logo_y = height - 50 - logo_height / 2
        p.drawImage(logo, logo_x, logo_y, width=logo_width, height=logo_height, mask='auto')
        
        p.setFillColor(primary)
        p.setFont("Helvetica-Bold", 16)
        p.drawCentredString(width / 2, height - 40, "HISTORIA CLÍNICA NUTRICIONAL")
        p.setFont("Helvetica", 9)
        p.drawCentredString(width / 2, height - 55, f"NutriData  ·  Fecha documento: {data.get('fecha') or now_co().strftime('%Y-%m-%d')}")
        y = height - 80
    except Exception:
        # Fallback a encabezado de texto si la imagen no carga
        p.setFillColor(primary)
        p.rect(0, height - 62, width, 62, stroke=0, fill=1)
        p.setFillColor(colors.white)
        p.setFont("Helvetica-Bold", 16)
        p.drawString(left, height - 32, "FORMATO HISTORIA CLÍNICA NUTRICIONAL")
        p.setFont("Helvetica", 9)
        p.drawString(left, height - 48, f"NutriData  ·  Fecha documento: {data.get('fecha') or now_co().strftime('%Y-%m-%d')}")
        heading("Información general")
    label_value("Nº historia nutricional", str(data.get("numero_historia") or ""))
    label_value("Nombre", str(data.get("nombre") or f"{patient.nombres or ''} {patient.apellidos or ''}".strip()))
    label_value("Fecha de nacimiento", str(data.get("fecha_nacimiento") or ""))
    label_value("Edad", str(data.get("edad") or ""))
    label_value("Cuidador", str(data.get("cuidador") or ""))
    label_value("Teléfono fijo", str(data.get("telefono_fijo") or ""))
    label_value("Celular", str(data.get("celular") or patient.telefono or ""))
    label_value("E-mail", str(data.get("email") or patient.email or ""))
    label_value("Nivel educativo", str(data.get("nivel_educativo") or ""))
    label_value("Estrato socioeconómico", str(data.get("estrato") or ""))
    label_value("Seguridad social", str(data.get("seguridad_social") or ""))
    label_value("Programa PyP", str(data.get("programa_pyp") or ""))
    label_value("Nivel de actividad física", str(data.get("nivel_actividad") or patient.nivel_actividad or ""))

    heading("Información de salud")
    block("Motivo de consulta", str(data.get("motivo_consulta") or ""))
    block("Enfermedad actual", str(data.get("enfermedad_actual") or ""))
    block("Antecedentes personales", str(data.get("antecedentes_personales") or ""))
    block("Signos y síntomas", str(data.get("signos_sintomas") or ""))
    checks([
        ("Constipación", bool(data.get("constipacion"))),
        ("Diarrea", bool(data.get("diarrea"))),
        ("Vómito", bool(data.get("vomito"))),
        ("Reflujo", bool(data.get("reflujo"))),
    ])
    label_value("Otros", str(data.get("otros_sintomas") or ""))
    block("Antecedentes familiares", str(data.get("antecedentes_familiares") or ""))
    checks([
        ("Diabetes", bool(data.get("fam_diabetes"))),
        ("Cardiovascular", bool(data.get("fam_cardiovascular"))),
        ("Hipertensión", bool(data.get("fam_hipertension"))),
        ("Obesidad", bool(data.get("fam_obesidad"))),
    ])
    label_value("Otros familiares", str(data.get("fam_otros") or ""))

    heading("Medicamentos / suplementos")
    block("Consumo actual", str(data.get("medicamentos") or "No reporta."))

    heading("Datos bioquímicos")

    def bio_section(title: str, items):
        nonlocal y
        ensure(50)
        p.setFont("Helvetica-Bold", 10)
        p.setFillColor(primary)
        p.drawString(left, y, title)
        y -= 14
        p.setFillColor(text_color)
        col_gap = 8
        col_w = (right - left - col_gap) / 2
        # pares de filas en 2 columnas visuales: label | valor
        for label, key in items:
            ensure(28)
            val = str(data.get(key) or "").strip() or "—"
            # caja-label
            p.setStrokeColor(colors.HexColor("#d6d3d1"))
            p.setLineWidth(0.5)
            row_h = 16
            p.rect(left, y - 4, col_w * 0.62, row_h, stroke=1, fill=0)
            p.rect(left + col_w * 0.62, y - 4, col_w * 0.38, row_h, stroke=1, fill=0)
            p.setFont("Helvetica", 8)
            p.setFillColor(text_color)
            p.drawString(left + 4, y + 1, label)
            p.drawRightString(left + col_w - 4, y + 1, val)
            y -= 18
        y -= 6

    bio_section("Hemograma y otros", [
        ("Hb (g/dL)", "bio_hb"),
        ("Hto (%)", "bio_hto"),
        ("VCM (FL)", "bio_vcm"),
        ("HCM (pcg)", "bio_hcm"),
        ("Ferritina", "bio_ferritina"),
    ])
    bio_section("Otros", [
        ("Glicemia (mg/dl)", "bio_glicemia"),
        ("BUN", "bio_bun"),
        ("Creatinina", "bio_creatinina"),
        ("Nitrógeno ureico", "bio_nitrogeno_ureico"),
        ("Albúmina", "bio_albumina"),
        ("Proteínas totales", "bio_proteinas_totales"),
        ("Leucocitos", "bio_leucocitos"),
        ("Linfocitos", "bio_linfocitos"),
    ])
    bio_section("Perfil lipídico", [
        ("HDL (mg/dL)", "bio_hdl"),
        ("VLDL (mg/dL)", "bio_vldl"),
        ("LDL (mg/dL)", "bio_ldl"),
        ("TG (mg/dL)", "bio_tg"),
        ("CT (mg/dL)", "bio_ct"),
    ])
    if str(data.get("bioquimicos") or "").strip():
        block("Observaciones / otros resultados", str(data.get("bioquimicos") or ""))

    heading("Información antropométrica")
    label_value("Peso (kg)", str(data.get("peso") or ""))
    label_value("Talla (cm)", str(data.get("talla") or ""))
    label_value("IMC", str(data.get("imc") or ""))
    label_value("Perímetro cefálico", str(data.get("perimetro_cefalico") or ""))
    label_value("Perímetro braquial", str(data.get("perimetro_braquial") or ""))
    label_value("Perímetro de cintura", str(data.get("perimetro_cintura") or ""))
    label_value("Pliegue tricipital", str(data.get("pliegue_tricipital") or ""))
    label_value("Pliegue subescapular", str(data.get("pliegue_subescapular") or ""))
    block("Clasificación antropométrica", str(data.get("clasificacion_antropometrica") or ""))
    block("Observaciones", str(data.get("observaciones_antro") or ""))

    heading("Información alimentaria")
    block("Preferencias", str(data.get("preferencias") or ""))
    block("Rechazos", str(data.get("rechazos") or ""))
    block("Intolerancias", str(data.get("intolerancias") or ""))
    block("Recordatorio 24 horas", str(data.get("recordatorio_24h") or ""))
    block("Análisis cuantitativo de consumo", str(data.get("analisis_cuantitativo") or ""))
    block("Evaluación consumo de alimentos", str(data.get("evaluacion_consumo") or ""))
    block("Factores de riesgo", str(data.get("factores_riesgo") or ""))

    heading("Diagnóstico nutricional PES")
    block("Diagnóstico", str(data.get("diagnostico_pes") or ""))

    heading("Tratamiento nutricional")
    block("Objetivos", str(data.get("objetivos") or ""))
    block("Tipo de dieta y características", str(data.get("tipo_dieta") or ""))
    block("Determinación de requerimientos", str(data.get("determinacion_requerimientos") or ""))
    block("Fórmula sintética inicial", str(data.get("formula_sintetica_inicial") or ""))
    block("Fórmula desarrollada", str(data.get("formula_desarrollada") or ""))
    block("Fórmula sintética final", str(data.get("formula_sintetica_final") or ""))
    block("Minuta patrón", str(data.get("minuta_patron") or ""))
    block("Ejemplo de menú", str(data.get("ejemplo_menu") or ""))
    block("Recomendaciones", str(data.get("recomendaciones") or ""))
    block("Plan de educación nutricional", str(data.get("plan_educacion") or ""))

    heading("Seguimiento")
    label_value("Próxima cita en (días)", str(data.get("proxima_cita_dias") or ""))
    label_value("Fecha próxima cita", str(data.get("proxima_cita_fecha") or ""))
    block("Criterios a evaluar", str(data.get("criterios_seguimiento") or ""))
    block("Nota resumida", str(data.get("nota_resumida") or ""))

    # Firma digital ampliada
    ensure(120)
    y -= 12
    draw_pdf_signature_block(
        p,
        x=left,
        y=y,
        width=right - left,
        nutritionist_name=nutri_name,
        license_to=license_to,
        specialty=specialty,
        generated_at=generated_at,
        verification_code=verification_code,
        doc_label="Historia clínica nutricional",
    )

    draw_footer()
    p.save()
    buffer.seek(0)
    pdf_bytes = buffer.getvalue()
    safe_name = (f"{patient.nombres or ''}_{patient.apellidos or ''}".strip() or "paciente").replace(" ", "_")
    date_str = now_co().strftime("%Y-%m-%d")
    filename = f"historia_clinica_{safe_name}_{date_str}.pdf"
    return pdf_bytes, filename


# ==================== ENDPOINTS DE PACIENTES ====================

def _patient_next_appointment_label(db: Session, patient_id: int) -> str:
    """Próxima cita real (agenda), no start_date del plan."""
    today = today_co()
    next_apt = (
        db.query(AppointmentDB)
        .filter(
            AppointmentDB.patient_id == patient_id,
            AppointmentDB.date >= today,
            AppointmentDB.status != "cancelada",
        )
        .order_by(AppointmentDB.date.asc(), AppointmentDB.time.asc())
        .first()
    )
    if not next_apt:
        return "Sin cita"
    return f"{next_apt.date.strftime('%Y-%m-%d')} {next_apt.time}"


def _patient_to_response_dict(p: UserDB, db: Session) -> dict:
    progreso_calc = calcular_progreso(p.peso_actual, p.peso_objetivo, p.peso_inicial)
    edad_form = calcular_edad_detallada(p.fecha_nacimiento)
    active_plan = (
        db.query(PatientMealPlanDB)
        .filter(PatientMealPlanDB.patient_id == p.id, PatientMealPlanDB.status == "active")
        .first()
    )
    plan_name = None
    if active_plan:
        meal = db.query(MealPlanDB).filter(MealPlanDB.id == active_plan.meal_plan_id).first()
        plan_name = meal.name if meal else "Plan activo"
    return {
        "id": p.id,
        "nombres": p.nombres,
        "apellidos": p.apellidos,
        "email": p.email,
        "telefono": p.telefono,
        "fecha_nacimiento": p.fecha_nacimiento.strftime("%Y-%m-%d") if p.fecha_nacimiento else None,
        "genero": p.genero,
        "direccion": p.direccion,
        "tipo_documento": p.tipo_documento,
        "numero_documento": p.numero_documento,
        "foto_perfil": p.foto_perfil,
        "status": p.status or "activo",
        "role": p.role,
        "peso_actual": p.peso_actual,
        "peso_objetivo": p.peso_objetivo,
        "nivel_actividad": p.nivel_actividad,
        "pal_factor": p.pal_factor,
        "alergias": p.alergias or [],
        "preferencias": p.preferencias or [],
        "objetivos_salud": p.objetivos_salud,
        "condiciones_medicas": p.condiciones_medicas,
        "alimentos_disgusto": p.alimentos_disgusto,
        "antecedentes_familiares": p.antecedentes_familiares,
        "progreso": progreso_calc,
        "proxima_cita": _patient_next_appointment_label(db, p.id),
        "altura": p.altura,
        "edad_formateada": edad_form,
        "evaluacion_nutricional": p.evaluacion_nutricional,
        "frecuencia_consumo": p.frecuencia_consumo,
        "nutritionist_id": p.nutritionist_id,
        "tiene_plan_activo": bool(active_plan),
        "plan_activo": plan_name,
        "acompanante_nombre": getattr(p, "acompanante_nombre", None),
        "acompanante_parentesco": getattr(p, "acompanante_parentesco", None),
        "acompanante_telefono": getattr(p, "acompanante_telefono", None),
        "acompanante_email": getattr(p, "acompanante_email", None),
        "acompanante_documento": getattr(p, "acompanante_documento", None),
        "acompanante_observaciones": getattr(p, "acompanante_observaciones", None),
        "examenes_bioquimicos": getattr(p, "examenes_bioquimicos", None) or {},
        "deleted_at": getattr(p, "deleted_at", None),
    }


def _patients_base_query(db: Session, current_user: UserDB, trash: bool = False):
    query = db.query(UserDB).filter(UserDB.role == "patient")
    if current_user.role == "admin":
        query = query.filter(UserDB.nutritionist_id == current_user.id)
    if trash:
        query = query.filter(UserDB.deleted_at.isnot(None))
    else:
        query = query.filter(or_(UserDB.deleted_at.is_(None), UserDB.deleted_at == ""))
    return query


def _hard_delete_patient(db: Session, patient: UserDB, current_user: UserDB):
    """Elimina definitivamente un paciente y sus dependencias."""
    patient_id = patient.id
    patient_name = f"{patient.nombres} {patient.apellidos}"
    patient_snapshot = {
        "id": patient.id,
        "name": patient_name,
        "email": patient.email,
        "nutritionist_id": patient.nutritionist_id,
    }
    log_audit(
        db,
        actor=current_user,
        action="delete",
        entity_type="patient",
        entity_id=patient_id,
        patient_id=None,
        summary=f"Paciente eliminado definitivamente: {patient_name}",
        details={"before": patient_snapshot, "after": None},
        now_co=now_co,
    )
    db.flush()
    _delete_patient_related_data(db, patient_id)
    _prepare_patient_user_deletion(db, patient_id)
    db.delete(patient)


def _safe_delete_rows(db: Session, model, column: str, value: int):
    if model is None:
        return
    try:
        db.query(model).filter(getattr(model, column) == value).delete(synchronize_session=False)
    except Exception:
        pass


def _delete_patient_related_data(db: Session, patient_id: int):
    """Limpia dependencias antes de borrar el usuario paciente."""
    _safe_delete_rows(db, AppointmentPrepChecklistDB, "patient_id", patient_id)
    _safe_delete_rows(db, FollowUpTaskDB, "patient_id", patient_id)
    _safe_delete_rows(db, PatientInterventionDB, "patient_id", patient_id)
    _safe_delete_rows(db, PatientChallengeClaimDB, "patient_id", patient_id)
    _safe_delete_rows(db, PatientHabitLogDB, "patient_id", patient_id)
    _safe_delete_rows(db, PatientReminderPrefsDB, "patient_id", patient_id)
    _safe_delete_rows(db, MealPhotoDB, "patient_id", patient_id)
    _safe_delete_rows(db, WearableSnapshotDB, "patient_id", patient_id)
    _safe_delete_rows(db, OfflineSyncLogDB, "patient_id", patient_id)
    _safe_delete_rows(db, ClinicalAccessLogDB, "patient_id", patient_id)
    _safe_delete_rows(db, DataDeletionRequestDB, "user_id", patient_id)
    _safe_delete_rows(db, PrivacyConsentDB, "user_id", patient_id)
    _safe_delete_rows(db, PlatformModuleUsageDB, "user_id", patient_id)
    _safe_delete_rows(db, PlatformAppSessionDB, "user_id", patient_id)
    _safe_delete_rows(db, NpsSurveyDB, "user_id", patient_id)
    if ImpersonationLogDB is not None:
        try:
            db.query(ImpersonationLogDB).filter(
                or_(
                    ImpersonationLogDB.target_user_id == patient_id,
                    ImpersonationLogDB.impersonator_id == patient_id,
                )
            ).delete(synchronize_session=False)
        except Exception:
            pass

    assignment_ids = [
        a.id
        for a in db.query(PatientMealPlanDB.id)
        .filter(PatientMealPlanDB.patient_id == patient_id)
        .all()
    ]
    if assignment_ids:
        db.query(DailyMealAssignmentDB).filter(
            DailyMealAssignmentDB.patient_meal_plan_id.in_(assignment_ids)
        ).delete(synchronize_session=False)

    db.query(PatientMealPlanDB).filter(PatientMealPlanDB.patient_id == patient_id).delete(
        synchronize_session=False
    )
    db.query(AppointmentDB).filter(AppointmentDB.patient_id == patient_id).delete(
        synchronize_session=False
    )
    db.query(Recordatorio24hDB).filter(Recordatorio24hDB.patient_id == patient_id).delete(
        synchronize_session=False
    )
    db.query(ProgressMetricDB).filter(ProgressMetricDB.patient_id == patient_id).delete(
        synchronize_session=False
    )
    db.query(AchievementDB).filter(AchievementDB.patient_id == patient_id).delete(
        synchronize_session=False
    )
    db.query(NutritionistNoteDB).filter(NutritionistNoteDB.patient_id == patient_id).delete(
        synchronize_session=False
    )
    db.query(NotificationDB).filter(NotificationDB.user_id == patient_id).delete(
        synchronize_session=False
    )
    db.query(MessageDB).filter(
        or_(MessageDB.sender_id == patient_id, MessageDB.receiver_id == patient_id)
    ).delete(synchronize_session=False)

    meal_ids = [
        m.id
        for m in db.query(MealTrackingDB.id).filter(MealTrackingDB.patient_id == patient_id).all()
    ]
    if meal_ids:
        try:
            db.query(MealFoodItemDB).filter(MealFoodItemDB.meal_tracking_id.in_(meal_ids)).delete(
                synchronize_session=False
            )
        except Exception:
            pass
    db.query(MealTrackingDB).filter(MealTrackingDB.patient_id == patient_id).delete(
        synchronize_session=False
    )
    try:
        db.query(WaterTrackingDB).filter(WaterTrackingDB.patient_id == patient_id).delete(
            synchronize_session=False
        )
    except Exception:
        pass
    try:
        db.query(SupportTicketDB).filter(SupportTicketDB.patient_id == patient_id).delete(
            synchronize_session=False
        )
    except Exception:
        pass
    try:
        db.query(PatientNotificationSettingsDB).filter(
            PatientNotificationSettingsDB.user_id == patient_id
        ).delete(synchronize_session=False)
    except Exception:
        pass
    try:
        db.query(PatientAppearanceSettingsDB).filter(
            PatientAppearanceSettingsDB.user_id == patient_id
        ).delete(synchronize_session=False)
    except Exception:
        pass


def _prepare_patient_user_deletion(db: Session, patient_id: int):
    """Desvincula audit_logs y aplica flush antes de DELETE en users."""
    try:
        db.execute(
            text("UPDATE audit_logs SET patient_id = NULL WHERE patient_id = :pid"),
            {"pid": patient_id},
        )
    except Exception:
        if AuditLogDB is not None:
            db.query(AuditLogDB).filter(AuditLogDB.patient_id == patient_id).update(
                {AuditLogDB.patient_id: None},
                synchronize_session=False,
            )
    db.flush()

@app.get("/api/patients", response_model=List[PatientResponse])
def get_patients(
    trash: bool = False,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin)
):
    """Obtener pacientes activos o en papelera (?trash=true)."""
    patients = _patients_base_query(db, current_user, trash=trash).all()
    return [_patient_to_response_dict(p, db) for p in patients]


@app.get("/api/patients/stats")
def get_patient_stats(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin)
):
    """Estadísticas de pacientes (scoped). Debe ir antes de /{patient_id}."""
    active_query = _patients_base_query(db, current_user, trash=False)
    trash_query = _patients_base_query(db, current_user, trash=True)

    total = active_query.count()
    activos = active_query.filter(UserDB.status == "activo").count()
    pendientes = active_query.filter(UserDB.status == "pendiente").count()
    inactivos = active_query.filter(UserDB.status == "inactivo").count()
    trash_count = trash_query.count()
    return {
        "total_patients": total,
        "active_now": activos,
        "pending": pendientes,
        "inactive": inactivos,
        "trash": trash_count,
    }


@app.patch("/api/patients/bulk-status")
def bulk_update_patient_status(
    payload: BulkPatientStatusSchema,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """Cambiar estado de varios pacientes a la vez."""
    if payload.status not in ("activo", "pendiente", "inactivo"):
        raise HTTPException(status_code=400, detail="Estado inválido")
    if not payload.patient_ids:
        raise HTTPException(status_code=400, detail="Sin pacientes seleccionados")

    updated = 0
    for pid in payload.patient_ids:
        authorize_patient_access(pid, current_user, db)
        patient = db.query(UserDB).filter(UserDB.id == pid, UserDB.role == "patient").first()
        if not patient:
            continue
        patient.status = payload.status
        updated += 1
    db.commit()
    return {"success": True, "updated": updated, "status": payload.status}


@app.get("/api/consultation/queue")
def get_consultation_queue(
    days: int = 3,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """Cola de próximas consultas para el flujo de atención."""
    today = today_co()
    end = today + timedelta(days=max(0, min(days, 14)))
    query = db.query(AppointmentDB).filter(
        AppointmentDB.date >= today,
        AppointmentDB.date <= end,
        AppointmentDB.status != "cancelada",
    )
    if current_user.role == "admin":
        my_ids = [
            r.id
            for r in db.query(UserDB.id)
            .filter(UserDB.role == "patient", UserDB.nutritionist_id == current_user.id)
            .all()
        ]
        if not my_ids:
            return []
        query = query.filter(AppointmentDB.patient_id.in_(my_ids))

    appointments = query.order_by(AppointmentDB.date.asc(), AppointmentDB.time.asc()).limit(30).all()
    results = []
    for apt in appointments:
        patient = db.query(UserDB).filter(UserDB.id == apt.patient_id).first()
        if not patient:
            continue
        last_metric = (
            db.query(ProgressMetricDB)
            .filter(ProgressMetricDB.patient_id == patient.id)
            .order_by(ProgressMetricDB.date.desc(), ProgressMetricDB.id.desc())
            .first()
        )
        active_plan = (
            db.query(PatientMealPlanDB)
            .filter(
                PatientMealPlanDB.patient_id == patient.id,
                PatientMealPlanDB.status == "active",
            )
            .first()
        )
        plan_name = None
        if active_plan:
            plan = db.query(MealPlanDB).filter(MealPlanDB.id == active_plan.meal_plan_id).first()
            plan_name = plan.name if plan else "Plan activo"

        days_until = (apt.date - today).days
        if days_until == 0:
            date_label = "Hoy"
        elif days_until == 1:
            date_label = "Mañana"
        else:
            date_label = apt.date.strftime("%d/%m/%Y")

        last_weight_date = None
        if last_metric is not None and getattr(last_metric, "date", None) is not None:
            d = last_metric.date
            last_weight_date = d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d)[:10]

        results.append(
            {
                "appointment_id": apt.id,
                "date": apt.date.strftime("%Y-%m-%d"),
                "date_label": date_label,
                "time": apt.time,
                "duration": apt.duration,
                "type": apt.type,
                "status": apt.status,
                "notes": apt.notes,
                "patient": {
                    "id": patient.id,
                    "nombres": patient.nombres,
                    "apellidos": patient.apellidos,
                    "name": f"{patient.nombres} {patient.apellidos}",
                    "foto_perfil": patient.foto_perfil,
                    "email": patient.email,
                    "telefono": patient.telefono,
                    "alergias": patient.alergias or [],
                    "peso_actual": patient.peso_actual,
                    "peso_objetivo": patient.peso_objetivo,
                    "progreso": calcular_progreso(
                        patient.peso_actual, patient.peso_objetivo, patient.peso_inicial
                    ),
                },
                "last_weight": last_metric.weight if last_metric else patient.peso_actual,
                "last_weight_date": last_weight_date,
                "tiene_plan_activo": bool(active_plan),
                "plan_activo": plan_name,
            }
        )
    return results


@app.get("/api/consultation/prep/{appointment_id}")
def get_consultation_prep(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """Paquete completo para conducir una consulta."""
    apt = db.query(AppointmentDB).filter(AppointmentDB.id == appointment_id).first()
    if not apt:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    authorize_appointment_access(apt, current_user, db)
    patient = db.query(UserDB).filter(UserDB.id == apt.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    last_metrics = (
        db.query(ProgressMetricDB)
        .filter(ProgressMetricDB.patient_id == patient.id)
        .order_by(ProgressMetricDB.date.desc(), ProgressMetricDB.id.desc())
        .limit(5)
        .all()
    )
    notes = (
        db.query(NutritionistNoteDB)
        .filter(NutritionistNoteDB.patient_id == patient.id)
        .order_by(NutritionistNoteDB.created_at.desc())
        .limit(5)
        .all()
    )
    active_plan = (
        db.query(PatientMealPlanDB)
        .filter(
            PatientMealPlanDB.patient_id == patient.id,
            PatientMealPlanDB.status == "active",
        )
        .first()
    )
    plan_name = None
    if active_plan:
        plan = db.query(MealPlanDB).filter(MealPlanDB.id == active_plan.meal_plan_id).first()
        plan_name = plan.name if plan else "Plan activo"

    def _metric_dict(m):
        d = m.date
        date_str = d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d)[:10]
        return {
            "id": m.id,
            "date": date_str,
            "weight": m.weight,
            "notes": m.notes,
        }

    today_str = today_co().strftime("%Y-%m-%d")
    return {
        "appointment": appointment_to_response(apt),
        "patient": _patient_to_response_dict(patient, db),
        "last_metrics": [_metric_dict(m) for m in last_metrics],
        "notes": [
            {
                "id": n.id,
                "note": n.note,
                "created_at": n.created_at,
                "created_by": n.created_by,
            }
            for n in notes
        ],
        "plan_activo": plan_name,
        "tiene_plan_activo": bool(active_plan),
        "checklist_defaults": {
            "confirm_attendance": apt.status == "confirmada",
            "update_weight": bool(last_metrics) and _metric_dict(last_metrics[0])["date"] == today_str,
            "review_menu": bool(active_plan),
            "schedule_next": False,
            "add_note": False,
        },
    }


@app.post("/api/consultation/reminders/send-24h")
def send_appointment_reminders_24h(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """Notificaciones in-app (+ WhatsApp best-effort) para citas de mañana."""
    tomorrow = today_co() + timedelta(days=1)
    query = db.query(AppointmentDB).filter(
        AppointmentDB.date == tomorrow,
        AppointmentDB.status != "cancelada",
    )
    if current_user.role == "admin":
        my_ids = [
            r.id
            for r in db.query(UserDB.id)
            .filter(UserDB.role == "patient", UserDB.nutritionist_id == current_user.id)
            .all()
        ]
        if not my_ids:
            return {"success": True, "sent": 0, "skipped": 0}
        query = query.filter(AppointmentDB.patient_id.in_(my_ids))

    appointments = query.all()
    sent = 0
    skipped = 0
    title = f"Recordatorio de cita ({tomorrow.strftime('%d/%m')})"

    for apt in appointments:
        patient = db.query(UserDB).filter(UserDB.id == apt.patient_id).first()
        if not patient:
            skipped += 1
            continue

        desc_admin = f"[cita:{apt.id}] {patient.nombres} {patient.apellidos} mañana a las {apt.time}."
        already = (
            db.query(NotificationDB)
            .filter(
                NotificationDB.user_id == current_user.id,
                NotificationDB.type == "appointment_reminder",
                NotificationDB.description.contains(f"[cita:{apt.id}]"),
            )
            .first()
        )
        if already:
            skipped += 1
        else:
            db.add(
                NotificationDB(
                    user_id=current_user.id,
                    type="appointment_reminder",
                    title=title,
                    description=desc_admin,
                )
            )
            sent += 1

        already_p = (
            db.query(NotificationDB)
            .filter(
                NotificationDB.user_id == patient.id,
                NotificationDB.type == "appointment_reminder",
                NotificationDB.description.contains(f"[cita:{apt.id}]"),
            )
            .first()
        )
        if not already_p:
            db.add(
                NotificationDB(
                    user_id=patient.id,
                    type="appointment_reminder",
                    title="Recordatorio: cita mañana",
                    description=f"[cita:{apt.id}] Tu cita es mañana a las {apt.time}.",
                )
            )
            sent += 1
            if patient.telefono:
                try:
                    send_whatsapp_notification(
                        patient.telefono,
                        f"Hola {patient.nombres}, te recordamos tu cita mañana a las {apt.time} en NutriData.",
                        db=db,
                    )
                except Exception:
                    pass
        else:
            skipped += 1

    db.commit()
    try:
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        job_id = enqueue_ops_job(
            db,
            "appointment_reminders",
            f"Recordatorios citas {tomorrow.strftime('%Y-%m-%d')}",
            {"sent": sent, "skipped": skipped, "date": tomorrow.strftime("%Y-%m-%d")},
            now_co=now_co,
        )
        if job_id and OpsJobDB is not None:
            job_row = db.query(OpsJobDB).filter(OpsJobDB.id == job_id).first()
            if job_row:
                job_row.status = "completed"
                job_row.started_at = ts
                job_row.finished_at = ts
                db.commit()
    except Exception:
        pass
    try:
        dispatch_webhook_event(
            db,
            "appointment.reminder",
            {"sent": sent, "skipped": skipped, "date": tomorrow.strftime("%Y-%m-%d")},
            now_co=now_co,
        )
    except Exception:
        pass
    return {
        "success": True,
        "sent": sent,
        "skipped": skipped,
        "date": tomorrow.strftime("%Y-%m-%d"),
    }


@app.get("/api/patients/{patient_id}/reports/nutrition")
def generate_nutrition_report(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """
    Generar un informe nutricional más detallado y con estilos alineados a la identidad.
    Incluye: encabezado con marca, resumen del paciente, métricas recientes, IMC, progreso
    y la evaluación nutricional. Devuelve PDF como StreamingResponse.
    """
    # Reusar la función que construye el PDF y devuelve bytes + filename
    authorize_patient_access(patient_id, current_user, db)
    pdf_bytes, filename = build_nutrition_report_bytes(patient_id, db, current_user)
    return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=\"{filename}\""})


@app.post("/api/patients/{patient_id}/reports/nutrition/send")
def send_nutrition_report_email(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Genera el PDF de informe y lo envía por email al paciente."""
    authorize_patient_access(patient_id, current_user, db)

    patient = db.query(UserDB).filter(UserDB.id == patient_id, UserDB.role == "patient").first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    if not patient.email:
        raise HTTPException(status_code=400, detail="El paciente no tiene email registrado")

    # Generar el mismo PDF detallado que se usa para la descarga
    pdf_bytes, filename = build_nutrition_report_bytes(patient_id, db, current_user)

    # Preparar y enviar email con adjunto
    smtp_server = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    sender_email = os.getenv("FROM_EMAIL") or os.getenv("SMTP_USER", "no-reply@example.com")
    sender_password = os.getenv("SMTP_PASSWORD", "")

    msg = MIMEMultipart()
    msg["Subject"] = f"Informe nutricional - {patient.nombres} {patient.apellidos}"
    msg["From"] = sender_email
    msg["To"] = patient.email

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8080")
    inner = f"<p>Hola {patient.nombres},</p><p>Adjuntamos tu informe nutricional generado desde NutriData.</p><p>Saludos,<br/>NutriData</p>"
    html_content = _email_layout(inner, "Informe Nutricional", frontend_url)
    msg.attach(MIMEText(html_content, "html"))

    attachment = MIMEApplication(pdf_bytes, Name=filename)
    attachment['Content-Disposition'] = f'attachment; filename="{filename}"'
    msg.attach(attachment)

    try:
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            if sender_password:
                server.login(sender_email, sender_password)
            server.sendmail(sender_email, [patient.email], msg.as_string())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error enviando email: {str(e)}")

    return {"message": "Informe enviado por email"}


@app.post("/api/patients/{patient_id}/reports/clinical-history")
def generate_clinical_history_report(
    patient_id: int,
    body: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Genera PDF de Historia Clínica Nutricional a partir del formulario del modal."""
    authorize_patient_access(patient_id, current_user, db)
    data = body or {}
    pdf_bytes, filename = build_clinical_history_pdf_bytes(patient_id, data, current_user, db)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@app.post("/api/patients", response_model=PatientResponse)
def create_patient(
    patient_data: PatientCreateSchema,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin)
):
    """Crear un nuevo paciente"""
    if current_user.role == "admin":
        try:
            enforce_nutritionist_quota(db, current_user.id, UserDB, now_co)
        except HTTPException:
            raise
        except Exception:
            pass
    # Verificar si el email ya existe
    existing_patient = db.query(UserDB).filter(UserDB.email == patient_data.email).first()
    if existing_patient:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    # Generar contraseña por defecto si no se provee
    password = patient_data.password if patient_data.password else "password123"
    hashed_pwd = pwd_context.hash(password)
    
    # Convertir fecha de nacimiento si viene como string
    fecha_nac = None
    if patient_data.fecha_nacimiento:
        try:
            fecha_nac = datetime.strptime(patient_data.fecha_nacimiento, "%Y-%m-%d").date()
        except:
            pass
    
    new_patient = UserDB(
        nombres=patient_data.nombres,
        apellidos=patient_data.apellidos,
        email=patient_data.email,
        telefono=patient_data.telefono,
        fecha_nacimiento=fecha_nac,
        genero=patient_data.genero,
        direccion=patient_data.direccion,
        password=hashed_pwd,
        tipo_documento=patient_data.tipo_documento,
        numero_documento=patient_data.numero_documento,
        role="patient",
        status=(patient_data.status if patient_data.status in ("activo", "pendiente", "inactivo") else "activo"),
        # Nuevos campos
        altura=patient_data.altura,
        peso_inicial=patient_data.peso_inicial if patient_data.peso_inicial is not None else patient_data.peso_actual,
        peso_actual=patient_data.peso_actual,
        peso_objetivo=patient_data.peso_objetivo,
        nivel_actividad=patient_data.nivel_actividad,
        alergias=patient_data.alergias,
        preferencias=patient_data.preferencias,
        objetivos_salud=patient_data.objetivos_salud,
        condiciones_medicas=patient_data.condiciones_medicas,
        alimentos_disgusto=patient_data.alimentos_disgusto,
        antecedentes_familiares=patient_data.antecedentes_familiares,
        evaluacion_nutricional=patient_data.evaluacion_nutricional,
        frecuencia_consumo=patient_data.frecuencia_consumo,
        acompanante_nombre=(patient_data.acompanante_nombre or None),
        acompanante_parentesco=(patient_data.acompanante_parentesco or None),
        acompanante_telefono=(patient_data.acompanante_telefono or None),
        acompanante_email=(patient_data.acompanante_email or None),
        acompanante_documento=(patient_data.acompanante_documento or None),
        acompanante_observaciones=(patient_data.acompanante_observaciones or None),
        examenes_bioquimicos=(patient_data.examenes_bioquimicos or None),
    )

    if current_user.role == "admin":
        new_patient.nutritionist_id = current_user.id
    else:
        if patient_data.nutritionist_id is not None:
            nutritionist = db.query(UserDB).filter(UserDB.id == patient_data.nutritionist_id, UserDB.role == "admin").first()
            if not nutritionist:
                raise HTTPException(status_code=400, detail="Nutricionista inválido")
            new_patient.nutritionist_id = nutritionist.id
    
    try:
        db.add(new_patient)
        db.commit()
        db.refresh(new_patient)
        try:
            dispatch_webhook_event(
                db,
                "patient.created",
                {
                    "patient_id": new_patient.id,
                    "email": new_patient.email,
                    "nombres": new_patient.nombres,
                    "apellidos": new_patient.apellidos,
                    "nutritionist_id": new_patient.nutritionist_id,
                },
                now_co=now_co,
            )
        except Exception:
            pass

        edad_form = calcular_edad_detallada(new_patient.fecha_nacimiento)

        return _patient_to_response_dict(new_patient, db)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al crear paciente: {str(e)}")

@app.get("/api/patients/{patient_id}", response_model=PatientResponse)
def get_patient_details(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Obtener detalles completos de un paciente"""
    authorize_patient_access(patient_id, current_user, db)
    patient = db.query(UserDB).filter(UserDB.id == patient_id, UserDB.role == "patient").first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    return _patient_to_response_dict(patient, db)

@app.put("/api/patients/{patient_id}", response_model=PatientResponse)
def update_patient(
    patient_id: int,
    patient_data: PatientCreateSchema,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin)
):
    """Actualizar información de un paciente"""
    authorize_patient_access(patient_id, current_user, db)
    patient = db.query(UserDB).filter(UserDB.id == patient_id, UserDB.role == "patient").first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    patient.nombres = patient_data.nombres
    patient.apellidos = patient_data.apellidos
    patient.telefono = patient_data.telefono
    patient.genero = patient_data.genero
    patient.direccion = patient_data.direccion
    patient.tipo_documento = patient_data.tipo_documento
    patient.numero_documento = patient_data.numero_documento
    
    # Nuevos campos
    patient.altura = patient_data.altura
    patient.peso_actual = patient_data.peso_actual
    patient.peso_objetivo = patient_data.peso_objetivo
    patient.nivel_actividad = patient_data.nivel_actividad
    patient.pal_factor = patient_data.pal_factor
    patient.alergias = patient_data.alergias
    patient.preferencias = patient_data.preferencias
    patient.objetivos_salud = patient_data.objetivos_salud
    patient.condiciones_medicas = patient_data.condiciones_medicas
    patient.alimentos_disgusto = patient_data.alimentos_disgusto
    patient.antecedentes_familiares = patient_data.antecedentes_familiares
    patient.evaluacion_nutricional = patient_data.evaluacion_nutricional
    patient.frecuencia_consumo = patient_data.frecuencia_consumo
    patient.acompanante_nombre = patient_data.acompanante_nombre or None
    patient.acompanante_parentesco = patient_data.acompanante_parentesco or None
    patient.acompanante_telefono = patient_data.acompanante_telefono or None
    patient.acompanante_email = patient_data.acompanante_email or None
    patient.acompanante_documento = patient_data.acompanante_documento or None
    patient.acompanante_observaciones = patient_data.acompanante_observaciones or None
    patient.examenes_bioquimicos = patient_data.examenes_bioquimicos or None
    if patient_data.status in ("activo", "pendiente", "inactivo"):
        patient.status = patient_data.status
    
    if patient_data.fecha_nacimiento:
        try:
            patient.fecha_nacimiento = datetime.strptime(patient_data.fecha_nacimiento, "%Y-%m-%d").date()
        except:
            pass
    
    # No actualizar email para evitar duplicados
    # No actualizar contraseña a menos que se provea explícitamente
    if patient_data.password:
        patient.password = pwd_context.hash(patient_data.password)
    
    db.commit()
    db.refresh(patient)

    log_audit(
        db, actor=current_user, action="update", entity_type="clinical_history",
        entity_id=patient_id, patient_id=patient_id,
        summary=f"Historia clínica / ficha actualizada: {patient.nombres} {patient.apellidos}",
        details={"fields_updated": "patient_profile"},
        now_co=now_co,
    )
    db.commit()
    
    return _patient_to_response_dict(patient, db)

@app.delete("/api/patients/{patient_id}")
def soft_delete_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin)
):
    """Mover paciente a la papelera (soft delete)."""
    authorize_patient_access(patient_id, current_user, db)
    patient = db.query(UserDB).filter(UserDB.id == patient_id, UserDB.role == "patient").first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    if getattr(patient, "deleted_at", None):
        raise HTTPException(status_code=400, detail="El paciente ya está en la papelera")

    patient_name = f"{patient.nombres} {patient.apellidos}"
    deleted_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
    previous_status = patient.status
    patient.deleted_at = deleted_at
    patient.status = "inactivo"
    patient.updated_at = deleted_at

    log_audit(
        db,
        actor=current_user,
        action="update",
        entity_type="patient",
        entity_id=patient_id,
        patient_id=patient_id,
        summary=f"Paciente movido a papelera: {patient_name}",
        details={
            "before": {"status": previous_status, "deleted_at": None},
            "after": {"status": "inactivo", "deleted_at": deleted_at},
        },
        now_co=now_co,
    )
    db.commit()
    return {"success": True, "message": "Paciente movido a la papelera"}


@app.post("/api/patients/{patient_id}/restore")
def restore_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin)
):
    """Recuperar paciente desde la papelera."""
    authorize_patient_access(patient_id, current_user, db)
    patient = db.query(UserDB).filter(UserDB.id == patient_id, UserDB.role == "patient").first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    if not getattr(patient, "deleted_at", None):
        raise HTTPException(status_code=400, detail="El paciente no está en la papelera")

    patient_name = f"{patient.nombres} {patient.apellidos}"
    previous_deleted_at = patient.deleted_at
    patient.deleted_at = None
    if patient.status == "inactivo":
        patient.status = "activo"
    patient.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")

    log_audit(
        db,
        actor=current_user,
        action="update",
        entity_type="patient",
        entity_id=patient_id,
        patient_id=patient_id,
        summary=f"Paciente recuperado de papelera: {patient_name}",
        details={
            "before": {"deleted_at": previous_deleted_at},
            "after": {"deleted_at": None, "status": patient.status},
        },
        now_co=now_co,
    )
    db.commit()
    return {"success": True, "message": "Paciente recuperado correctamente"}


@app.delete("/api/patients/{patient_id}/permanent")
def permanent_delete_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin)
):
    """Eliminar definitivamente un paciente que está en la papelera."""
    authorize_patient_access(patient_id, current_user, db)
    patient = db.query(UserDB).filter(UserDB.id == patient_id, UserDB.role == "patient").first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    if not getattr(patient, "deleted_at", None):
        raise HTTPException(
            status_code=400,
            detail="El paciente debe estar en la papelera antes de eliminarlo definitivamente",
        )

    try:
        _hard_delete_patient(db, patient, current_user)
        db.commit()
        return {"success": True, "message": "Paciente eliminado definitivamente"}
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo eliminar el paciente: tiene datos relacionados en el sistema. Contacta soporte si persiste.",
        )

# ==================== ENDPOINTS RECORDATORIO 24 HORAS ====================

@app.post("/api/patients/{patient_id}/recalls", response_model=RecallResponse)
def create_patient_recall(
    patient_id: int,
    recall_data: RecallCreate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Crear un nuevo recordatorio de 24 horas para un paciente"""
    authorize_patient_access(patient_id, current_user, db)
    patient = db.query(UserDB).filter(UserDB.id == patient_id, UserDB.role == "patient").first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    recall_date = today_co()
    if recall_data.date:
        try:
            recall_date = datetime.strptime(recall_data.date, "%Y-%m-%d").date()
        except:
            pass

    new_recall = Recordatorio24hDB(
        patient_id=patient_id,
        date=recall_date,
        desayuno=recall_data.desayuno,
        media_manana=recall_data.media_manana,
        almuerzo=recall_data.almuerzo,
        media_tarde=recall_data.media_tarde,
        cena=recall_data.cena,
        snack_nocturno=recall_data.snack_nocturno,
        observaciones=recall_data.observaciones
    )
    
    db.add(new_recall)
    db.commit()
    db.refresh(new_recall)
    
    # Asegurar que la fecha sea string para el response
    response_dict = {
        "id": new_recall.id,
        "patient_id": new_recall.patient_id,
        "date": str(new_recall.date) if new_recall.date else None,
        "desayuno": new_recall.desayuno,
        "media_manana": new_recall.media_manana,
        "almuerzo": new_recall.almuerzo,
        "media_tarde": new_recall.media_tarde,
        "cena": new_recall.cena,
        "snack_nocturno": new_recall.snack_nocturno,
        "observaciones": new_recall.observaciones
    }
    return response_dict

@app.get("/api/patients/{patient_id}/recalls", response_model=List[RecallResponse])
def get_patient_recalls(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Obtener el historial de recordatorios de 24 horas de un paciente"""
    authorize_patient_access(patient_id, current_user, db)
    recalls = db.query(Recordatorio24hDB).filter(Recordatorio24hDB.patient_id == patient_id).order_by(Recordatorio24hDB.date.desc()).all()
    
    # Convertir fechas a string
    results = []
    for r in recalls:
        results.append({
            "id": r.id,
            "patient_id": r.patient_id,
            "date": str(r.date) if r.date else None,
            "desayuno": r.desayuno,
            "media_manana": r.media_manana,
            "almuerzo": r.almuerzo,
            "media_tarde": r.media_tarde,
            "cena": r.cena,
            "snack_nocturno": r.snack_nocturno,
            "observaciones": r.observaciones
        })
    return results

# ==================== ENDPOINTS EXISTENTES (sin cambios) ====================

@app.post("/api/profile/upload-photo/{email}")
async def upload_photo(email: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    file_extension = file.filename.split(".")[-1]
    file_name = f"profile_{user.id}.{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, file_name)

    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    user.foto_perfil = f"{BASE_URL}/uploads/{file_name}"
    db.commit()

    return {"success": True, "foto_url": user.foto_perfil}


@app.post("/api/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    hashed_pwd = pwd_context.hash(user.password)
    new_user = UserDB(
        nombres=user.nombres,
        apellidos=user.apellidos,
        email=user.email,
        password=hashed_pwd
    )
    try:
        db.add(new_user)
        db.commit()
        return {"success": True, "message": "Usuario registrado"}
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="El email ya está registrado")

@app.post("/api/login")
def login(data: LoginSchema, db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.email == data.email).first()
    if not user or not pwd_context.verify(data.password, user.password):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
    
    is_complete = check_profile_complete(user)

    if user.role == "superadmin" and superadmin_requires_2fa(db, user.id):
        temp_token = jwt.encode({
            "sub": user.email,
            "id": user.id,
            "role": user.role,
            "pending_2fa": True,
            "exp": datetime.utcnow() + timedelta(minutes=10),
        }, SECRET_KEY, algorithm="HS256")
        return {
            "success": True,
            "requires_2fa": True,
            "temp_token": temp_token,
            "user": {"id": user.id, "name": f"{user.nombres} {user.apellidos}", "role": user.role},
        }
    
    token = jwt.encode({
        "sub": user.email,
        "id": user.id, 
        "role": user.role,
        "profile_complete": is_complete
    }, SECRET_KEY, algorithm="HS256")
    
    return {
        "success": True,
        "token": token,
        "profile_complete": is_complete,
        "user": {
            "id": user.id,
            "name": f"{user.nombres} {user.apellidos}",
            "role": user.role,
            "altura": user.altura,
            "peso_actual": user.peso_actual,
            "avatar": user.foto_perfil
        }
    }

@app.post("/api/forgot-password")
def forgot_password(data: ForgotPasswordSchema, db: Session = Depends(get_db)):
    """Solicitar recuperación de contraseña"""
    user = db.query(UserDB).filter(UserDB.email == data.email).first()
    
    # Por seguridad, siempre retornamos éxito aunque el email no exista
    if user:
        # Generar token de reseteo (válido por 1 hora)
        reset_token = jwt.encode({
            "user_id": user.id,
            "email": user.email,
            "exp": datetime.utcnow() + timedelta(hours=1),
            "type": "password_reset"
        }, SECRET_KEY, algorithm="HS256")
        
        # Enviar email de recuperación
        user_name = f"{user.nombres} {user.apellidos}"
        email_sent = send_reset_email(user.email, reset_token, user_name)
        
        # También imprimir en consola para desarrollo
        if email_sent:
            print(f"\n{'='*60}")
            print(f"✅ EMAIL ENVIADO EXITOSAMENTE")
            print(f"{'='*60}")
            print(f"Destinatario: {user.email}")
            print(f"Usuario: {user_name}")
            print(f"{'='*60}\n")
        else:
            # Si falla el envío, imprimir el link en consola como fallback
            frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8080").rstrip("/")
            reset_link = f"{frontend_url}/reset-password?token={quote(reset_token, safe='')}"
            print(f"\n{'='*60}")
            print(f"⚠️  ERROR AL ENVIAR EMAIL - LINK DE RESPALDO")
            print(f"{'='*60}")
            print(f"Usuario: {user_name}")
            print(f"Email: {user.email}")
            print(f"Link de reseteo: {reset_link}")
            print(f"{'='*60}\n")
    
    return {
        "success": True, 
        "message": "Si el correo existe, recibirás instrucciones para restablecer tu contraseña"
    }

@app.post("/api/reset-password")
def reset_password(data: dict, db: Session = Depends(get_db)):
    """Restablecer contraseña con token"""
    token = data.get("token")
    new_password = data.get("new_password")
    
    if not token or not new_password:
        raise HTTPException(status_code=400, detail="Token y nueva contraseña son requeridos")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")
    
    try:
        # Verificar y decodificar el token
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        
        # Verificar que sea un token de reseteo de contraseña
        if payload.get("type") != "password_reset":
            raise HTTPException(status_code=400, detail="Token inválido")
        
        user_id = payload.get("user_id")
        user = db.query(UserDB).filter(UserDB.id == user_id).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        # Actualizar contraseña
        user.password = pwd_context.hash(new_password)
        db.commit()
        
        print(f"\n✅ Contraseña actualizada exitosamente para: {user.email}\n")
        
        return {
            "success": True,
            "message": "Contraseña actualizada correctamente"
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="El token ha expirado. Solicita un nuevo enlace de recuperación")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Token inválido")


@app.get("/api/auth/validate-invite")
def validate_invite_token(token: str, db: Session = Depends(get_db)):
    """
    Validar token de invitación de nutricionista. Devuelve nombre y email para mostrar en el formulario de registro.
    No requiere autenticación.
    """
    if not token or not token.strip():
        raise HTTPException(status_code=400, detail="Token requerido")
    try:
        payload = jwt.decode(token.strip(), SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") != "nutritionist_invite":
            raise HTTPException(status_code=400, detail="Token inválido")
        user_id = payload.get("user_id")
        user = db.query(UserDB).filter(UserDB.id == user_id, UserDB.role == "admin").first()
        if not user:
            raise HTTPException(status_code=404, detail="Invitación no encontrada")
        if user.status != "pendiente":
            raise HTTPException(status_code=400, detail="Esta invitación ya fue utilizada")
        return {
            "valid": True,
            "email": user.email,
            "name": f"{user.nombres or ''} {user.apellidos or ''}".strip() or user.email
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="El enlace ha expirado. Pide un nuevo enlace al administrador.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Enlace inválido")


@app.post("/api/auth/complete-invite")
def complete_invite_registration(
    body: dict,
    db: Session = Depends(get_db)
):
    """
    Completar registro de nutricionista invitado: establecer contraseña,
    número de TO (tarjeta profesional) y activar cuenta.
    No requiere autenticación.
    """
    token = body.get("token")
    password = body.get("password")
    numero_to = (body.get("numero_to") or body.get("license") or "").strip()
    if not token or not password:
        raise HTTPException(status_code=400, detail="Token y contraseña son requeridos")
    if not numero_to:
        raise HTTPException(status_code=400, detail="El número de TO (tarjeta profesional) es requerido")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")
    try:
        payload = jwt.decode(token.strip(), SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") != "nutritionist_invite":
            raise HTTPException(status_code=400, detail="Token inválido")
        user_id = payload.get("user_id")
        user = db.query(UserDB).filter(UserDB.id == user_id, UserDB.role == "admin").first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        if user.status != "pendiente":
            raise HTTPException(status_code=400, detail="Esta invitación ya fue utilizada")
        user.password = pwd_context.hash(password)
        user.status = "activo"

        admin_profile = db.query(AdminProfileDB).filter(AdminProfileDB.user_id == user.id).first()
        if not admin_profile:
            admin_profile = AdminProfileDB(user_id=user.id, license=numero_to)
            db.add(admin_profile)
        else:
            admin_profile.license = numero_to

        db.commit()
        return {"success": True, "message": "Cuenta activada. Ya puedes iniciar sesión."}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="El enlace ha expirado. Pide un nuevo enlace al administrador.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Enlace inválido")


# ==================== DASHBOARD ENDPOINTS ====================
# Nota: stats, recent-patients, upcoming-appointments están definidos más abajo
# con get_current_user para filtrar por nutricionista (solo sus pacientes).

@app.get("/api/dashboard/chart-data")
def get_dashboard_chart_data(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """Datos para el gráfico de actividad. Si es admin, solo consultas y asignaciones de sus pacientes."""
    end_date = now_co()
    start_date = end_date - timedelta(days=180)
    
    my_patient_ids = []
    if current_user.role == "admin":
        my_patient_ids = [r.id for r in db.query(UserDB.id).filter(
            UserDB.role == "patient",
            UserDB.nutritionist_id == current_user.id
        ).all()]
    
    chart_data = []
    current_month = start_date
    while current_month <= end_date:
        key = current_month.strftime("%Y-%m")
        meses_es = {
            "Jan": "Ene", "Feb": "Feb", "Mar": "Mar", "Apr": "Abr", "May": "May", "Jun": "Jun",
            "Jul": "Jul", "Aug": "Ago", "Sep": "Sep", "Oct": "Oct", "Nov": "Nov", "Dec": "Dic"
        }
        en_month = current_month.strftime("%b")
        es_month = meses_es.get(en_month, en_month)
        chart_data.append({"key": key, "name": es_month, "consultas": 0, "planes": 0})
        next_month = current_month + timedelta(days=32)
        current_month = next_month.replace(day=1)
    
    # Citas: solo de pacientes del nutricionista si es admin
    q_app = db.query(AppointmentDB).filter(
        AppointmentDB.date >= start_date.date(),
        AppointmentDB.date <= end_date.date()
    )
    if current_user.role == "admin":
        if not my_patient_ids:
            appointments = []
        else:
            q_app = q_app.filter(AppointmentDB.patient_id.in_(my_patient_ids))
            appointments = q_app.all()
    else:
        appointments = q_app.all()
    
    for app in appointments:
        app_key = app.date.strftime("%Y-%m")
        for item in chart_data:
            if item["key"] == app_key:
                item["consultas"] += 1
                break
    
    # Planes: si es admin, contar asignaciones a sus pacientes (PatientMealPlanDB); si no, planes creados
    if current_user.role == "admin" and my_patient_ids:
        assignments = db.query(PatientMealPlanDB).filter(
            PatientMealPlanDB.patient_id.in_(my_patient_ids)
        ).all()
        for a in assignments:
            dt = None
            if getattr(a, "assigned_date", None):
                try:
                    dt = datetime.strptime(str(a.assigned_date)[:10], "%Y-%m-%d")
                except ValueError:
                    pass
            if not dt and getattr(a, "start_date", None):
                try:
                    dt = datetime.strptime(str(a.start_date)[:10], "%Y-%m-%d")
                except ValueError:
                    pass
            if dt and start_date <= dt <= end_date:
                plan_key = dt.strftime("%Y-%m")
                for item in chart_data:
                    if item["key"] == plan_key:
                        item["planes"] += 1
                        break
    else:
        all_plans = db.query(MealPlanDB).all()
        for plan in all_plans:
            if plan.created_at:
                try:
                    plan_date = datetime.strptime(plan.created_at[:10], "%Y-%m-%d") if len(plan.created_at or "") >= 10 else None
                    if plan_date and start_date <= plan_date <= end_date:
                        plan_key = plan_date.strftime("%Y-%m")
                        for item in chart_data:
                            if item["key"] == plan_key:
                                item["planes"] += 1
                                break
                except (ValueError, TypeError):
                    continue

    for item in chart_data:
        del item["key"]
    return chart_data


@app.get("/api/profile/{email}")
def get_profile(email: str, db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Convertir a dict para agregar edad_formateada
    user_data = {c.name: getattr(user, c.name) for c in user.__table__.columns}
    # Asegurar que fechas sean string
    if user.fecha_nacimiento:
        user_data["fecha_nacimiento"] = user.fecha_nacimiento.strftime("%Y-%m-%d")
    
    user_data["edad_formateada"] = calcular_edad_detallada(user.fecha_nacimiento)
    return user_data

@app.put("/api/profile/update")
def update_profile(data: ProfileUpdateSchema, db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.email == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    user.nombres = data.nombres
    user.apellidos = data.apellidos
    user.telefono = data.telefono
    user.genero = data.genero
    user.direccion = data.direccion
    user.altura = data.altura
    user.peso_actual = data.peso_actual
    user.peso_objetivo = data.peso_objetivo
    user.nivel_actividad = data.nivel_actividad
    user.alergias = data.alergias
    user.preferencias = data.preferencias
    user.objetivos_salud = data.objetivos_salud
    user.condiciones_medicas = data.condiciones_medicas
    user.alimentos_disgusto = data.alimentos_disgusto
    
    if data.fecha_nacimiento:
        user.fecha_nacimiento = data.fecha_nacimiento

    db.commit()
    
    return {
        "success": True, 
        "profile_complete": check_profile_complete(user)
    }

# ==================== ENDPOINTS DE RECETAS ====================

def _recipe_to_response(recipe: RecipeDB) -> dict:
    """Convierte RecipeDB a dict asegurando ingredients e instructions como listas de strings."""
    def item_to_str(item, text_keys=None):
        """Convierte un item (string, dict, etc.) a string. text_keys para ingredientes/instrucciones."""
        if item is None:
            return ""
        if isinstance(item, str):
            return item.strip()
        if isinstance(item, (int, float, bool)):
            return str(item)
        if isinstance(item, dict):
            # Caso especial: ingredientes con nombre y porción (ej. {"name": "Arroz", "portion": "50g"})
            name_val = item.get("name")
            portion_val = item.get("portion")
            if name_val is not None and portion_val:
                combined = f"{name_val}: {portion_val}".strip()
                if combined:
                    return combined

            keys = text_keys or ["ingredient", "Ingredient", "name", "text", "title", "item", "step", "Step", "instruction", "Instruction"]
            for k in keys:
                if k in item and item[k] is not None:
                    s = str(item[k]).strip()
                    if s:
                        return s
            return ""
        return str(item).strip()

    def to_list(val, text_keys=None):
        if val is None:
            return []
        if isinstance(val, (list, tuple)):
            out = []
            for item in val:
                s = item_to_str(item, text_keys)
                if s:
                    # Si el string tiene varias líneas o comas, expandir
                    if "\n" in s:
                        out.extend(x.strip() for x in s.split("\n") if x.strip())
                    elif "," in s and not s.strip().startswith("["):
                        out.extend(x.strip() for x in s.split(",") if x.strip())
                    else:
                        out.append(s)
            return out
        if isinstance(val, str):
            val = val.strip()
            if not val:
                return []
            try:
                p = json.loads(val)
                if isinstance(p, (list, tuple)):
                    return to_list(p, text_keys)
                if isinstance(p, (str, int, float, bool)):
                    return [str(p)]
                if isinstance(p, dict):
                    s = item_to_str(p, text_keys)
                    return [s] if s else []
                return []
            except (json.JSONDecodeError, TypeError):
                if "\n" in val:
                    return [x.strip() for x in val.split("\n") if x.strip()]
                if "," in val:
                    return [x.strip() for x in val.split(",") if x.strip()]
                return [val]
        return []

    ing_keys = ["ingredient", "Ingredient", "name", "text", "title", "item"]
    inst_keys = ["step", "Step", "instruction", "Instruction", "name", "text", "title"]
    data = {
        "id": recipe.id,
        "name": recipe.name,
        "description": recipe.description or "",
        "category": recipe.category or "",
        "prepTime": getattr(recipe, "prepTime", 0) or 0,
        "cookTime": getattr(recipe, "cookTime", 0) or 0,
        "servings": recipe.servings or 1,
        "calories": recipe.calories or 0,
        "protein": recipe.protein or 0,
        "carbs": recipe.carbs or 0,
        "fat": recipe.fat or 0,
        "ingredients": to_list(recipe.ingredients, ing_keys),
        "instructions": to_list(recipe.instructions, inst_keys),
        "tags": to_list(getattr(recipe, "tags", None)),
        "image": recipe.image,
        "isFavorite": bool(getattr(recipe, "isFavorite", 0)),
        "is_public": bool(getattr(recipe, "is_public", 0)),
        "created_by_id": getattr(recipe, "created_by_id", None),
        "approval_status": getattr(recipe, "approval_status", None) or "draft",
        "is_system": bool(getattr(recipe, "is_system", 0)),
        "source_recipe_id": getattr(recipe, "source_recipe_id", None),
        "reviewed_by_id": getattr(recipe, "reviewed_by_id", None),
        "reviewed_at": getattr(recipe, "reviewed_at", None),
        "rejection_reason": getattr(recipe, "rejection_reason", None),
        "submitted_at": getattr(recipe, "submitted_at", None),
        "created_at": getattr(recipe, "created_at", None),
        "updated_at": getattr(recipe, "updated_at", None),
    }
    return data


_FOOD_NUTRIENTS_CACHE: Optional[dict] = None


def _load_food_nutrients() -> dict:
    global _FOOD_NUTRIENTS_CACHE
    if _FOOD_NUTRIENTS_CACHE is not None:
        return _FOOD_NUTRIENTS_CACHE
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "food_nutrients.json")
    try:
        with open(path, "r", encoding="utf-8") as f:
            _FOOD_NUTRIENTS_CACHE = json.load(f)
    except Exception:
        _FOOD_NUTRIENTS_CACHE = {}
    return _FOOD_NUTRIENTS_CACHE


def _normalize_ingredient_name(name: str) -> str:
    s = (name or "").strip()
    if ":" in s:
        s = s.split(":")[0].strip()
    return s.lower()


def _lookup_food_nutrient(ingredient_name: str) -> Optional[dict]:
    nutrients = _load_food_nutrients()
    if not nutrients:
        return None
    base = _normalize_ingredient_name(ingredient_name)
    if not base:
        return None
    if base in {k.lower(): k for k in nutrients}:
        for k in nutrients:
            if k.lower() == base:
                return nutrients[k]
    for k, v in nutrients.items():
        if base in k.lower() or k.lower() in base:
            return v
    return None


def _recipe_nutrition_quality_report(recipe: RecipeDB) -> dict:
    """Compara macros declarados vs. calculados desde ingredientes (tabla EVANUT)."""
    ing_keys = ["ingredient", "Ingredient", "name", "text", "title", "item"]
    ingredients = _recipe_to_response(recipe)["ingredients"]
    computed = {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0}
    matched = []
    unmatched = []
    for ing in ingredients:
        row = _lookup_food_nutrient(ing)
        if row:
            computed["calories"] += float(row.get("kcal", 0) or 0)
            computed["protein"] += float(row.get("prot", 0) or 0)
            computed["carbs"] += float(row.get("chos", 0) or 0)
            computed["fat"] += float(row.get("grasa", 0) or 0)
            matched.append(ing)
        else:
            unmatched.append(ing)

    servings = max(recipe.servings or 1, 1)
    declared = {
        "calories": float(recipe.calories or 0),
        "protein": float(recipe.protein or 0),
        "carbs": float(recipe.carbs or 0),
        "fat": float(recipe.fat or 0),
    }
    per_serving = {k: round(v / servings, 1) for k, v in computed.items()}
    variance = {}
    issues = []
    for key in ("calories", "protein", "carbs", "fat"):
        d = declared[key]
        c = computed[key]
        if c > 0:
            pct = abs(d - c) / c * 100
        elif d > 0:
            pct = 100.0
        else:
            pct = 0.0
        variance[key] = round(pct, 1)
        if pct > 25:
            issues.append(f"Diferencia >25% en {key}: declarado {d}, calculado {round(c, 1)}")

    if not ingredients:
        issues.append("Sin ingredientes registrados")
    elif len(unmatched) > 0:
        issues.append(f"{len(unmatched)} ingrediente(s) sin match en tabla nutricional")
    if (recipe.calories or 0) > 1200:
        issues.append("Calorías totales muy altas (>1200 kcal por receta)")
    if (recipe.protein or 0) == 0 and len(matched) > 2:
        issues.append("Proteína declarada en 0 con varios ingredientes")

    macro_sum = (declared["protein"] * 4 + declared["carbs"] * 4 + declared["fat"] * 9)
    macro_ok = True
    if declared["calories"] > 0 and macro_sum > 0:
        macro_ratio = abs(macro_sum - declared["calories"]) / declared["calories"] * 100
        if macro_ratio > 20:
            macro_ok = False
            issues.append(f"Inconsistencia macro-calorías ({round(macro_ratio, 1)}% de diferencia)")

    avg_var = sum(variance.values()) / max(len(variance), 1)
    score = max(0, min(100, int(100 - avg_var * 0.6 - len(unmatched) * 5 - len(issues) * 3)))
    if score >= 85:
        grade = "excelente"
    elif score >= 70:
        grade = "buena"
    elif score >= 50:
        grade = "regular"
    else:
        grade = "baja"

    return {
        "score": score,
        "grade": grade,
        "declared": declared,
        "computed_total": {k: round(v, 1) for k, v in computed.items()},
        "computed_per_serving": per_serving,
        "variance_pct": variance,
        "issues": issues,
        "matched_ingredients": len(matched),
        "total_ingredients": len(ingredients),
        "unmatched_ingredients": unmatched[:20],
        "macro_balance_ok": macro_ok,
        "servings": servings,
    }


def _count_recipe_in_structure(obj, recipe_id: int) -> int:
    count = 0
    if isinstance(obj, dict):
        rid = obj.get("recipe_id")
        try:
            if rid is not None and int(rid) == recipe_id:
                count += 1
        except (TypeError, ValueError):
            pass
        for value in obj.values():
            count += _count_recipe_in_structure(value, recipe_id)
    elif isinstance(obj, list):
        for item in obj:
            count += _count_recipe_in_structure(item, recipe_id)
    elif isinstance(obj, str):
        try:
            count += _count_recipe_in_structure(json.loads(obj), recipe_id)
        except Exception:
            pass
    return count


def _recipe_usage_stats(db: Session, recipe_id: int) -> dict:
    menu_ids = set()
    total_slots = 0
    day_cols = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    for menu in db.query(WeeklyMenuCompleteDB).all():
        hits = 0
        for col in day_cols:
            hits += _count_recipe_in_structure(getattr(menu, col, None), recipe_id)
        if hits:
            menu_ids.add(menu.id)
            total_slots += hits

    legacy_menu_ids = set()
    for menu in db.query(WeeklyMenuDB).all():
        hits = 0
        for col in day_cols:
            hits += _count_recipe_in_structure(getattr(menu, col, None), recipe_id)
        if hits:
            legacy_menu_ids.add(menu.id)
            total_slots += hits

    assignment_count = 0
    slot_cols = ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner", "evening_snack"]
    for row in db.query(DailyMealAssignmentDB).all():
        hits = sum(_count_recipe_in_structure(getattr(row, c, None), recipe_id) for c in slot_cols)
        if hits:
            assignment_count += 1
            total_slots += hits

    patient_ids = set()
    for pmp in db.query(PatientMealPlanDB).filter(PatientMealPlanDB.status == "active").all():
        plan = db.query(MealPlanDB).filter(MealPlanDB.id == pmp.meal_plan_id).first()
        if not plan:
            continue
        for wm in db.query(WeeklyMenuDB).filter(WeeklyMenuDB.meal_plan_id == plan.id).all():
            for col in day_cols:
                if _count_recipe_in_structure(getattr(wm, col, None), recipe_id):
                    patient_ids.add(pmp.patient_id)
                    break

    return {
        "menu_count": len(menu_ids),
        "legacy_menu_count": len(legacy_menu_ids),
        "daily_assignment_days": assignment_count,
        "total_slot_usages": total_slots,
        "active_patient_count": len(patient_ids),
    }


def _recipe_share_nutritionist_ids(db: Session, recipe_id: int) -> list:
    rows = db.query(RecipeShareDB).filter(RecipeShareDB.recipe_id == recipe_id).all()
    return [r.nutritionist_id for r in rows]


def _recipe_shared_with(db: Session, recipe_id: int) -> list:
    rows = db.query(RecipeShareDB).filter(RecipeShareDB.recipe_id == recipe_id).all()
    out = []
    for row in rows:
        u = db.query(UserDB).filter(UserDB.id == row.nutritionist_id).first()
        if u:
            out.append({
                "id": u.id,
                "name": f"{u.nombres or ''} {u.apellidos or ''}".strip() or u.email,
                "email": u.email,
            })
    return out


def _enrich_recipe_superadmin(db: Session, recipe: RecipeDB, include_usage: bool = False, include_quality: bool = False) -> dict:
    out = _recipe_to_response(recipe)
    creator = db.query(UserDB).filter(UserDB.id == recipe.created_by_id).first() if recipe.created_by_id else None
    out["created_by_name"] = (f"{creator.nombres or ''} {creator.apellidos or ''}".strip() or creator.email) if creator else None
    out["shared_nutritionist_ids"] = _recipe_share_nutritionist_ids(db, recipe.id)
    out["shared_with"] = _recipe_shared_with(db, recipe.id)
    if include_usage:
        out["usage"] = _recipe_usage_stats(db, recipe.id)
    if include_quality:
        out["quality_report"] = _recipe_nutrition_quality_report(recipe)
    return out


def _collect_recipe_ids_from_structure(obj, out: set):
    """Extrae recipe_id de menús / comidas anidados."""
    if isinstance(obj, dict):
        if obj.get("recipe_id") is not None:
            try:
                out.add(int(obj["recipe_id"]))
            except (TypeError, ValueError):
                pass
        for value in obj.values():
            _collect_recipe_ids_from_structure(value, out)
    elif isinstance(obj, list):
        for item in obj:
            _collect_recipe_ids_from_structure(item, out)
    elif isinstance(obj, str):
        try:
            parsed = json.loads(obj)
            _collect_recipe_ids_from_structure(parsed, out)
        except Exception:
            pass


def _patient_plan_recipe_ids(db: Session, patient_id: int) -> set:
    """IDs de recetas usadas en el plan activo del paciente."""
    ids: set = set()
    active = (
        db.query(PatientMealPlanDB)
        .filter(
            PatientMealPlanDB.patient_id == patient_id,
            PatientMealPlanDB.status == "active",
        )
        .order_by(PatientMealPlanDB.id.desc())
        .first()
    )
    if not active:
        return ids

    weekly_menus = db.query(WeeklyMenuDB).filter(
        WeeklyMenuDB.meal_plan_id == active.meal_plan_id
    ).all()
    for wm in weekly_menus:
        for day_key in ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"):
            _collect_recipe_ids_from_structure(getattr(wm, day_key, None), ids)

    dailies = db.query(DailyMealAssignmentDB).filter(
        DailyMealAssignmentDB.patient_meal_plan_id == active.id
    ).all()
    for daily in dailies:
        for slot in (
            daily.breakfast,
            daily.morning_snack,
            daily.lunch,
            daily.afternoon_snack,
            daily.dinner,
            daily.evening_snack,
        ):
            _collect_recipe_ids_from_structure(slot, ids)
    return ids


def _recipe_query_for_user(db: Session, current_user: Optional[UserDB]):
    """Query de recetas según rol:
    - superadmin: ve todas
    - admin/nutricionista: las que él creó + públicas aprobadas + sistema + compartidas
    - patient: públicas aprobadas + las de su plan activo + sistema
    - sin usuario: solo públicas aprobadas + sistema
    """
    q = db.query(RecipeDB)
    role = getattr(current_user, "role", None) if current_user else None
    if role == "superadmin":
        pass
    elif role == "admin":
        shared_ids = [
            r.recipe_id
            for r in db.query(RecipeShareDB).filter(RecipeShareDB.nutritionist_id == current_user.id).all()
        ]
        filters = [
            RecipeDB.created_by_id == current_user.id,
            (RecipeDB.is_public == 1) & (RecipeDB.approval_status == "approved"),
            RecipeDB.is_system == 1,
        ]
        if shared_ids:
            filters.append(RecipeDB.id.in_(shared_ids))
        q = q.filter(or_(*filters))
    elif role == "patient" and current_user:
        plan_ids = _patient_plan_recipe_ids(db, current_user.id)
        pub = (RecipeDB.is_public == 1) & (RecipeDB.approval_status == "approved")
        if plan_ids:
            q = q.filter(or_(pub, RecipeDB.is_system == 1, RecipeDB.id.in_(list(plan_ids))))
        else:
            q = q.filter(or_(pub, RecipeDB.is_system == 1))
    else:
        q = q.filter(
            or_(
                (RecipeDB.is_public == 1) & (RecipeDB.approval_status == "approved"),
                RecipeDB.is_system == 1,
            )
        )
    return q


def _authorize_recipe_view(recipe: RecipeDB, current_user: Optional[UserDB], db: Session):
    """Puede ver: superadmin, dueño, pública aprobada, sistema, compartida, o paciente con receta en plan."""
    role = getattr(current_user, "role", None) if current_user else None
    if role == "superadmin":
        return
    if bool(getattr(recipe, "is_system", 0)):
        return
    if role == "admin" and current_user:
        if recipe.created_by_id == current_user.id:
            return
        if bool(getattr(recipe, "is_public", 0)) and getattr(recipe, "approval_status", "draft") == "approved":
            return
        shared = db.query(RecipeShareDB).filter(
            RecipeShareDB.recipe_id == recipe.id,
            RecipeShareDB.nutritionist_id == current_user.id,
        ).first()
        if shared:
            return
        raise HTTPException(status_code=403, detail="No autorizado a ver esta receta")
    if role == "patient" and current_user:
        if bool(getattr(recipe, "is_public", 0)) and getattr(recipe, "approval_status", "draft") == "approved":
            return
        if recipe.id in _patient_plan_recipe_ids(db, current_user.id):
            return
        raise HTTPException(status_code=403, detail="Receta privada")
    if bool(getattr(recipe, "is_public", 0)) and getattr(recipe, "approval_status", "draft") == "approved":
        return
    raise HTTPException(status_code=403, detail="Receta privada")


def _authorize_recipe_modify(recipe: RecipeDB, current_user: UserDB):
    """Solo dueño o superadmin pueden editar/borrar/favoritar."""
    role = getattr(current_user, "role", None)
    if role == "superadmin":
        return
    if role == "admin" and recipe.created_by_id == current_user.id:
        return
    raise HTTPException(status_code=403, detail="Solo el propietario puede modificar esta receta")


def _authorize_recipe_access(recipe: RecipeDB, current_user: UserDB):
    """Compat: acceso de modificación (propietario)."""
    _authorize_recipe_modify(recipe, current_user)


async def _save_recipe_image(image: Optional[UploadFile]) -> Optional[str]:
    if not image or not getattr(image, "filename", None):
        return None
    await validate_upload_file(image)
    safe_name = sanitize_filename(image.filename)
    filename = f"{now_co().strftime('%Y%m%d%H%M%S')}_{safe_name}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    with open(file_path, "wb") as buffer:
        import shutil
        shutil.copyfileobj(image.file, buffer)
    return f"/uploads/{filename}"


@app.get("/api/recipes")
def get_recipes(
    db: Session = Depends(get_db),
    current_user: Optional[UserDB] = Depends(get_current_user_optional)
):
    query = _recipe_query_for_user(db, current_user)
    recipes = query.order_by(RecipeDB.id.desc()).all()
    shared_ids = set()
    if current_user and getattr(current_user, "role", None) == "admin":
        shared_ids = {
            r.recipe_id
            for r in db.query(RecipeShareDB).filter(RecipeShareDB.nutritionist_id == current_user.id).all()
        }
    out = []
    for r in recipes:
        item = _recipe_to_response(r)
        if shared_ids and r.id in shared_ids and r.created_by_id != current_user.id:
            item["shared_with_me"] = True
        out.append(item)
    return out

@app.get("/api/recipes/{recipe_id}")
def get_recipe(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[UserDB] = Depends(get_current_user_optional)
):
    recipe = db.query(RecipeDB).filter(RecipeDB.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    _authorize_recipe_view(recipe, current_user, db)
    return _recipe_to_response(recipe)

@app.post("/api/recipes", response_model=RecipeResponse)
async def create_recipe(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    category: str = Form(...),
    prepTime: int = Form(...),
    cookTime: int = Form(...),
    servings: int = Form(...),
    calories: int = Form(...),
    protein: int = Form(...),
    carbs: int = Form(...),
    fat: int = Form(...),
    ingredients: str = Form(...),  # JSON string
    instructions: str = Form(...), # JSON string
    tags: str = Form(...),         # JSON string
    isFavorite: bool = Form(False),
    existing_image: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    if category in (None, "", "null", "undefined"):
        category = "Platos principales"

    image_url = await _save_recipe_image(image)
    if not image_url and existing_image:
        # Permitir copiar URL al duplicar (solo rutas /uploads o http)
        if existing_image.startswith("/uploads/") or existing_image.startswith("http"):
            image_url = existing_image

    try:
        ingredients_list = json.loads(ingredients)
        instructions_list = json.loads(instructions)
        tags_list = json.loads(tags)
    except Exception:
        ingredients_list = [i.strip() for i in ingredients.split("\n") if i.strip()]
        instructions_list = [i.strip() for i in instructions.split("\n") if i.strip()]
        tags_list = [t.strip() for t in tags.split(",") if t.strip()]

    new_recipe = RecipeDB(
        name=name,
        description=description,
        category=category,
        prepTime=prepTime,
        cookTime=cookTime,
        servings=servings,
        calories=calories,
        protein=protein,
        carbs=carbs,
        fat=fat,
        ingredients=ingredients_list,
        instructions=instructions_list,
        tags=tags_list,
        isFavorite=1 if isFavorite else 0,
        image=image_url,
        created_by_id=current_user.id,
        is_public=0,
        approval_status="draft",
        is_system=0,
        created_at=now_co().strftime("%Y-%m-%d %H:%M:%S"),
        updated_at=now_co().strftime("%Y-%m-%d %H:%M:%S"),
    )
    db.add(new_recipe)
    db.commit()
    db.refresh(new_recipe)
    return _recipe_to_response(new_recipe)

@app.put("/api/recipes/{recipe_id}", response_model=RecipeResponse)
async def update_recipe(
    recipe_id: int,
    name: str = Form(...),
    description: Optional[str] = Form(None),
    category: str = Form(...),
    prepTime: int = Form(...),
    cookTime: int = Form(...),
    servings: int = Form(...),
    calories: int = Form(...),
    protein: int = Form(...),
    carbs: int = Form(...),
    fat: int = Form(...),
    ingredients: str = Form(...),
    instructions: str = Form(...),
    tags: str = Form(...),
    isFavorite: bool = Form(False),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    recipe = db.query(RecipeDB).filter(RecipeDB.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    _authorize_recipe_modify(recipe, current_user)

    if category in (None, "", "null", "undefined"):
        category = recipe.category or "Platos principales"

    image_url = recipe.image
    uploaded = await _save_recipe_image(image)
    if uploaded:
        image_url = uploaded

    try:
        ingredients_list = json.loads(ingredients)
        instructions_list = json.loads(instructions)
        tags_list = json.loads(tags)
    except Exception:
        ingredients_list = [i.strip() for i in ingredients.split("\n") if i.strip()]
        instructions_list = [i.strip() for i in instructions.split("\n") if i.strip()]
        tags_list = [t.strip() for t in tags.split(",") if t.strip()]

    recipe.name = name
    recipe.description = description
    recipe.category = category
    recipe.prepTime = prepTime
    recipe.cookTime = cookTime
    recipe.servings = servings
    recipe.calories = calories
    recipe.protein = protein
    recipe.carbs = carbs
    recipe.fat = fat
    recipe.ingredients = ingredients_list
    recipe.instructions = instructions_list
    recipe.tags = tags_list
    recipe.isFavorite = 1 if isFavorite else 0
    recipe.image = image_url

    db.commit()
    db.refresh(recipe)
    return _recipe_to_response(recipe)

@app.delete("/api/recipes/{recipe_id}")
def delete_recipe(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    recipe = db.query(RecipeDB).filter(RecipeDB.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    _authorize_recipe_modify(recipe, current_user)
    db.delete(recipe)
    db.commit()
    return {"success": True, "message": "Receta eliminada"}

@app.patch("/api/recipes/{recipe_id}/favorite")
def toggle_recipe_favorite(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    recipe = db.query(RecipeDB).filter(RecipeDB.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    _authorize_recipe_modify(recipe, current_user)
    recipe.isFavorite = 0 if recipe.isFavorite else 1
    db.commit()
    return {"success": True, "isFavorite": bool(recipe.isFavorite)}


@app.post("/api/recipes/{recipe_id}/submit-for-review")
def submit_recipe_for_review(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """Nutricionista envía receta a moderación del superadmin."""
    recipe = db.query(RecipeDB).filter(RecipeDB.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    _authorize_recipe_modify(recipe, current_user)
    if getattr(recipe, "is_system", 0):
        raise HTTPException(status_code=400, detail="Las recetas del sistema no requieren moderación")
    status = getattr(recipe, "approval_status", "draft") or "draft"
    if status == "approved":
        raise HTTPException(status_code=400, detail="La receta ya está aprobada")
    if status == "pending":
        raise HTTPException(status_code=400, detail="La receta ya está en revisión")
    now = now_co().strftime("%Y-%m-%d %H:%M:%S")
    recipe.approval_status = "pending"
    recipe.submitted_at = now
    recipe.updated_at = now
    recipe.rejection_reason = None
    db.commit()
    db.refresh(recipe)
    out = _recipe_to_response(recipe)
    out["quality_report"] = _recipe_nutrition_quality_report(recipe)
    return {"success": True, "message": "Receta enviada a moderación", "recipe": out}

# ==================== ENDPOINTS PARA MEAL PLANS ====================

@app.get("/api/meal-plans", response_model=List[MealPlanResponse])
def get_meal_plans(db: Session = Depends(get_db)):
    plans = db.query(MealPlanDB).filter(MealPlanDB.is_active == 1).all()
    
    results = []
    for plan in plans:
        patient_count = db.query(PatientMealPlanDB).filter(
            PatientMealPlanDB.meal_plan_id == plan.id,
            PatientMealPlanDB.status == "active"
        ).count()
        
        plan_dict = {
            "id": plan.id,
            "name": plan.name,
            "description": plan.description,
            "calories": plan.calories,
            "duration": plan.duration,
            "category": plan.category,
            "color": plan.color,
            "tipo": getattr(plan, "tipo", None) or "adulto",
            "protein_target": plan.protein_target,
            "carbs_target": plan.carbs_target,
            "fat_target": plan.fat_target,
            "meals_per_day": plan.meals_per_day,
            "is_active": plan.is_active,
            "created_at": plan.created_at,
            "patients": patient_count
        }
        
        # Incluir las fases si existen
        if plan.fase_1:
            plan_dict["fase_1"] = plan.fase_1
        if plan.fase_2:
            plan_dict["fase_2"] = plan.fase_2
        if plan.fase_3:
            plan_dict["fase_3"] = plan.fase_3
        if plan.fase_4:
            plan_dict["fase_4"] = plan.fase_4
        
        results.append(plan_dict)
    
    return results

@app.post("/api/meal-plans", response_model=MealPlanResponse)
def create_meal_plan(plan: MealPlanCreate, db: Session = Depends(get_db)):
    plan_data = plan.model_dump()
    
    # Extraer las fases del plan_data
    fase_1 = plan_data.pop("fase_1", None)
    fase_2 = plan_data.pop("fase_2", None)
    fase_3 = plan_data.pop("fase_3", None)
    fase_4 = plan_data.pop("fase_4", None)
    
    new_plan = MealPlanDB(
        **plan_data,
        fase_1=fase_1,
        fase_2=fase_2,
        fase_3=fase_3,
        fase_4=fase_4,
        created_at=now_co().strftime("%Y-%m-%d %H:%M:%S")
    )
    db.add(new_plan)
    db.commit()
    db.refresh(new_plan)
    
    return {
        **new_plan.__dict__,
        "patients": 0
    }

@app.get("/api/meal-plans/{plan_id}", response_model=MealPlanResponse)
def get_meal_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(MealPlanDB).filter(MealPlanDB.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    
    patient_count = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.meal_plan_id == plan_id,
        PatientMealPlanDB.status == "active"
    ).count()
    
    # Buscar menú semanal asignado (del modelo WeeklyMenuDB)
    weekly_menu = db.query(WeeklyMenuDB).filter(
        WeeklyMenuDB.meal_plan_id == plan_id
    ).first()
    
    menu_info = None
    if weekly_menu:
        menu_info = {
            "id": weekly_menu.id,
            "week_number": weekly_menu.week_number,
            "has_menu": True
        }
    
    result = {
        **plan.__dict__,
        "patients": patient_count,
        "menu": menu_info
    }
    
    # Incluir las fases en la respuesta
    if plan.fase_1:
        result["fase_1"] = plan.fase_1
    if plan.fase_2:
        result["fase_2"] = plan.fase_2
    if plan.fase_3:
        result["fase_3"] = plan.fase_3
    if plan.fase_4:
        result["fase_4"] = plan.fase_4
    
    return result
@app.get("/api/weekly-menus/by-plan/{plan_id}")
def get_menu_by_plan(plan_id: int, db: Session = Depends(get_db)):
    """
    Obtener el menú semanal asignado a un plan específico (1 o 4 semanas).
    """
    weekly_menus = (
        db.query(WeeklyMenuDB)
        .filter(WeeklyMenuDB.meal_plan_id == plan_id)
        .order_by(WeeklyMenuDB.week_number.asc())
        .all()
    )

    if not weekly_menus:
        return None

    days_map = {
        "monday": "Lunes",
        "tuesday": "Martes",
        "wednesday": "Miércoles",
        "thursday": "Jueves",
        "friday": "Viernes",
        "saturday": "Sábado",
        "sunday": "Domingo",
    }

    week_data = []
    first_monday = parse_menu_json_maybe(weekly_menus[0].monday)
    multi_row = len(weekly_menus) > 1
    legacy_list = isinstance(first_monday, list)

    if multi_row or not legacy_list:
        for wm in weekly_menus:
            week_num = wm.week_number or 1
            for day_key, day_name in days_map.items():
                day_val = parse_menu_json_maybe(getattr(wm, day_key, {}) or {})
                meals_list = []
                if isinstance(day_val, list):
                    idx = max(0, week_num - 1)
                    week_content = day_val[idx] if idx < len(day_val) else (day_val[0] if day_val else {})
                    meals_list = extract_day_meals_list(week_content) if isinstance(week_content, dict) else []
                elif isinstance(day_val, dict):
                    if "meals" in day_val and isinstance(day_val["meals"], list):
                        meals_list = day_val["meals"]
                    else:
                        for m_type, m_data in day_val.items():
                            if isinstance(m_data, dict):
                                item = dict(m_data)
                                item.setdefault("type", m_type)
                                meals_list.append(item)
                week_data.append({"day": day_name, "week": week_num, "meals": meals_list})
    else:
        weekly_menu = weekly_menus[0]
        for week_num in range(1, 5):
            idx = week_num - 1
            for day_key, day_name in days_map.items():
                day_col = parse_menu_json_maybe(getattr(weekly_menu, day_key, []) or [])
                meals_list = []
                if isinstance(day_col, list) and len(day_col) > idx:
                    week_content = day_col[idx]
                    if isinstance(week_content, dict) and "meals" in week_content:
                        meals_list = week_content["meals"]
                week_data.append({"day": day_name, "week": week_num, "meals": meals_list})

    weeks_present = {d["week"] for d in week_data}
    if weeks_present == {1}:
        week1 = [d for d in week_data if d["week"] == 1]
        for w in range(2, 5):
            for day in week1:
                week_data.append({**day, "week": w, "meals": list(day.get("meals") or [])})

    return {
        "id": weekly_menus[0].id,
        "meal_plan_id": plan_id,
        "week_number": len({d["week"] for d in week_data}),
        "is_4_week": len({d["week"] for d in week_data}) > 1,
        "week": week_data,
    }


@app.put("/api/meal-plans/{plan_id}", response_model=MealPlanResponse)
def update_meal_plan(
    plan_id: int,
    plan_data: MealPlanCreate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    if current_user.role == "admin":
        role = get_staff_role(db, current_user, AdminProfileDB)
        if not staff_has_permission(role, "plans"):
            raise HTTPException(status_code=403, detail="Sin permiso para modificar planes")
    plan = db.query(MealPlanDB).filter(MealPlanDB.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    
    # Extraer las fases del plan_data
    plan_dict = plan_data.model_dump()
    fase_1 = plan_dict.pop("fase_1", None)
    fase_2 = plan_dict.pop("fase_2", None)
    fase_3 = plan_dict.pop("fase_3", None)
    fase_4 = plan_dict.pop("fase_4", None)
    
    # Actualizar campos normales
    for key, value in plan_dict.items():
        setattr(plan, key, value)
    
    # Actualizar fases si se proporcionan
    if fase_1 is not None:
        plan.fase_1 = fase_1
    if fase_2 is not None:
        plan.fase_2 = fase_2
    if fase_3 is not None:
        plan.fase_3 = fase_3
    if fase_4 is not None:
        plan.fase_4 = fase_4
    
    db.commit()
    db.refresh(plan)

    if current_user and current_user.role in ("admin", "superadmin"):
        log_audit(
            db, actor=current_user, action="update", entity_type="meal_plan",
            entity_id=plan_id, summary=f"Plan modificado: {plan.name}",
            details={"calories": plan.calories, "tipo": getattr(plan, "tipo", None)},
            now_co=now_co,
        )
        db.commit()
    
    patient_count = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.meal_plan_id == plan_id,
        PatientMealPlanDB.status == "active"
    ).count()
    
    return {
        **plan.__dict__,
        "patients": patient_count
    }

@app.delete("/api/meal-plans/{plan_id}")
def delete_meal_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(MealPlanDB).filter(MealPlanDB.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    
    assigned_patients = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.meal_plan_id == plan_id,
        PatientMealPlanDB.status == "active"
    ).count()
    
    if assigned_patients > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"No se puede eliminar. Hay {assigned_patients} pacientes asignados a este plan"
        )
    
    db.delete(plan)
    db.commit()
    return {"success": True, "message": "Plan eliminado correctamente"}

@app.post("/api/assign-plan-with-menu")
def assign_plan_with_weekly_menu(
    data: dict,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """
    Asignar plan con menú semanal a un paciente.
    Soporta plantillas de 4 semanas, crea WeeklyMenuDB y 28 días de comidas.
    """
    patient_id = data.get("patient_id")
    meal_plan_id = data.get("meal_plan_id")
    weekly_menu_id = data.get("weekly_menu_id")
    start_date_str = data.get("start_date")

    if not patient_id:
        raise HTTPException(status_code=400, detail="Falta patient_id")
    if not meal_plan_id:
        raise HTTPException(status_code=400, detail="Falta meal_plan_id")
    if not weekly_menu_id:
        raise HTTPException(status_code=400, detail="Falta weekly_menu_id")
    if not start_date_str:
        raise HTTPException(status_code=400, detail="Falta start_date")

    authorize_patient_access(int(patient_id), current_user, db)

    plan = db.query(MealPlanDB).filter(MealPlanDB.id == meal_plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan nutricional no encontrado")

    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    menu = db.query(WeeklyMenuCompleteDB).filter(
        WeeklyMenuCompleteDB.id == weekly_menu_id
    ).first()
    if not menu:
        raise HTTPException(status_code=404, detail="Menú semanal no encontrado")
    _authorize_menu_access(menu, current_user)

    try:
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD")

    previous_active = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.patient_id == patient_id,
        PatientMealPlanDB.status == "active",
    ).all()
    for prev_plan in previous_active:
        prev_plan.status = "paused"

    # Vincular las 4 semanas de la plantilla al plan (para Mi Plan del paciente)
    copy_complete_menu_weeks_to_plan(db, plan.id, menu)

    assignment = PatientMealPlanDB(
        patient_id=patient_id,
        meal_plan_id=meal_plan_id,
        assigned_date=now_co().strftime("%Y-%m-%d %H:%M:%S"),
        start_date=start_date_str,
        status="active",
        current_week=1,
    )
    db.add(assignment)
    db.flush()

    if patient.telefono:
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8080").rstrip("/")
        msg = (
            f"🍏 ¡Hola {patient.nombres}! Te hemos asignado un nuevo plan nutricional: *{plan.name}*.\n\n"
            f"📅 Fecha de inicio: {start_date_str}\n"
            f"📝 El nutricionista ha actualizado tu menú semanal.\n\n"
            f"¡Puedes revisarlo ahora en la app!\n"
            f"🔗 {frontend_url}/patient/my-plan"
        )
        send_whatsapp_notification(patient.telefono, msg, db=db)

    if patient.email:
        patient_name = f"{patient.nombres or ''} {patient.apellidos or ''}".strip() or "Paciente"
        send_plan_assignment_email(patient.email, patient_name, plan.name, start_date_str)

    meals_created = generate_daily_assignments_from_complete_menu(
        db, assignment.id, menu, start_date, days=28
    )

    menu.assigned_patients = (menu.assigned_patients or 0) + 1

    try:
        db.commit()
        return {
            "success": True,
            "assignment_id": assignment.id,
            "message": "Plan con menú asignado correctamente",
            "days_created": meals_created,
            "weeks_linked": 4,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al guardar: {str(e)}")


@app.get("/api/meal-plans/{plan_id}/assigned-menu")
def get_plan_assigned_menu(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """
    Obtener el menú semanal vinculado al plan (WeeklyMenuDB o plantilla usada en asignaciones).
    """
    plan_menus = (
        db.query(WeeklyMenuDB)
        .filter(WeeklyMenuDB.meal_plan_id == plan_id)
        .order_by(WeeklyMenuDB.week_number.asc())
        .all()
    )
    if plan_menus:
        week_data = []
        for wm in plan_menus:
            week_num = wm.week_number or 1
            for day_key, day_name in WEEKLY_MENU_DAY_NAMES.items():
                day_raw = parse_menu_json_maybe(getattr(wm, day_key, {}) or {})
                if isinstance(day_raw, list):
                    idx = max(0, week_num - 1)
                    day_raw = day_raw[idx] if idx < len(day_raw) else (day_raw[0] if day_raw else {})
                meals = extract_day_meals_list(day_raw) if isinstance(day_raw, dict) else []
                if isinstance(day_raw, dict) and not meals:
                    # formato ya mapeado por tipo
                    for key in ("desayuno", "almuerzo", "comida", "merienda", "cena", "breakfast", "lunch", "dinner"):
                        if key in day_raw and isinstance(day_raw[key], dict):
                            meal_obj = dict(day_raw[key])
                            meal_obj.setdefault("type", key)
                            meals.append(meal_obj)
                week_data.append({"day": day_name, "week": week_num, "meals": meals})
        return {
            "id": plan_menus[0].id,
            "meal_plan_id": plan_id,
            "week_number": len(plan_menus),
            "week": week_data,
            "source": "plan_weekly_menus",
        }

    active_assignment = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.meal_plan_id == plan_id,
        PatientMealPlanDB.status == "active",
    ).first()

    if not active_assignment:
        return None

    daily_assignment = db.query(DailyMealAssignmentDB).filter(
        DailyMealAssignmentDB.patient_meal_plan_id == active_assignment.id,
        DailyMealAssignmentDB.generated_from_menu_id.isnot(None),
    ).first()

    if not daily_assignment or not daily_assignment.generated_from_menu_id:
        return None

    menu = db.query(WeeklyMenuCompleteDB).filter(
        WeeklyMenuCompleteDB.id == daily_assignment.generated_from_menu_id
    ).first()
    if not menu:
        return None

    week_data = []
    for week_num in range(1, 5):
        week_data.extend(build_week_payload_from_complete_menu(menu, week_num))

    return {
        "id": menu.id,
        "meal_plan_id": plan_id,
        "week_number": 4,
        "week": week_data,
        "source": "complete_template",
    }
    
@app.get("/api/patient/{patient_id}/daily-meals")
def get_patient_daily_meals(patient_id: int, date: str, db: Session = Depends(get_db)):
    target_date = datetime.strptime(date, "%Y-%m-%d").date()
    
    active_plan = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.patient_id == patient_id,
        PatientMealPlanDB.status == "active"
    ).order_by(PatientMealPlanDB.id.desc()).first()
    
    if not active_plan:
        return {"meals": []}
    
    daily = db.query(DailyMealAssignmentDB).filter(
        DailyMealAssignmentDB.patient_meal_plan_id == active_plan.id,
        DailyMealAssignmentDB.date == target_date
    ).first()
    
    if not daily:
        return {"meals": []}
    
    meals_list = []
    meal_types = [
        ("breakfast", "Desayuno", "07:00"),
        ("morning_snack", "Snack AM", "10:00"),
        ("lunch", "Almuerzo", "13:00"),
        ("afternoon_snack", "Snack PM", "16:00"),
        ("dinner", "Cena", "19:00")
    ]
    
    for field, label, default_time in meal_types:
        meal_data = getattr(daily, field, {})
        if meal_data and meal_data != {}:
            meals_list.append({
                "type": field,
                "name": meal_data.get("recipe_name", label),
                "time": meal_data.get("time", default_time),
                "calories": meal_data.get("calories", 0),
                "protein": meal_data.get("protein", 0),
                "carbs": meal_data.get("carbs", 0),
                "fat": meal_data.get("fat", 0),
                "image": meal_data.get("image")
            })
    
    return {"meals": meals_list}

@app.get("/api/meal-plans/{plan_id}/menus", response_model=List[WeeklyMenuResponse])
def get_weekly_menus(plan_id: int, db: Session = Depends(get_db)):
    menus = db.query(WeeklyMenuDB).filter(WeeklyMenuDB.meal_plan_id == plan_id).all()
    return menus

@app.post("/api/meal-plans/menus", response_model=WeeklyMenuResponse)
def create_weekly_menu(menu: WeeklyMenuCreate, db: Session = Depends(get_db)):
    new_menu = WeeklyMenuDB(**menu.model_dump())
    db.add(new_menu)
    db.commit()
    db.refresh(new_menu)
    return new_menu

@app.put("/api/meal-plans/menus/{menu_id}", response_model=WeeklyMenuResponse)
def update_weekly_menu(menu_id: int, menu_data: WeeklyMenuCreate, db: Session = Depends(get_db)):
    menu = db.query(WeeklyMenuDB).filter(WeeklyMenuDB.id == menu_id).first()
    if not menu:
        raise HTTPException(status_code=404, detail="Menú no encontrado")
    
    for key, value in menu_data.model_dump().items():
        setattr(menu, key, value)
    
    db.commit()
    db.refresh(menu)
    return menu

@app.post("/api/meal-plans/assign", response_model=PatientMealPlanResponse)
def assign_plan_to_patient(
    assignment: AssignPlanSchema,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    authorize_patient_access(assignment.patient_id, current_user, db)
    patient = db.query(UserDB).filter(UserDB.id == assignment.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    plan = db.query(MealPlanDB).filter(MealPlanDB.id == assignment.meal_plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    
    db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.patient_id == assignment.patient_id,
        PatientMealPlanDB.status == "active"
    ).update({"status": "paused"})
    
    new_assignment = PatientMealPlanDB(
        patient_id=assignment.patient_id,
        meal_plan_id=assignment.meal_plan_id,
        assigned_date=now_co().strftime("%Y-%m-%d"),
        start_date=assignment.start_date,
        end_date=assignment.end_date,
        notes=assignment.notes,
        status="active"
    )
    
    db.add(new_assignment)
    db.commit()
    db.refresh(new_assignment)

    # Notificar al paciente por correo
    if patient.email:
        patient_name = f"{patient.nombres or ''} {patient.apellidos or ''}".strip() or "Paciente"
        start_date_str = str(assignment.start_date) if assignment.start_date else ""
        send_plan_assignment_email(patient.email, patient_name, plan.name, start_date_str)

    return new_assignment

@app.get("/api/patients/{patient_id}/meal-plans")
def get_patient_meal_plans(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    authorize_patient_access(patient_id, current_user, db)
    assignments = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.patient_id == patient_id
    ).all()
    
    results = []
    for assignment in assignments:
        plan = db.query(MealPlanDB).filter(MealPlanDB.id == assignment.meal_plan_id).first()
        results.append({
            "assignment": assignment,
            "plan": plan
        })
    
    return results

@app.delete("/api/meal-plans/assign/{assignment_id}")
def remove_plan_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    assignment = db.query(PatientMealPlanDB).filter(PatientMealPlanDB.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    authorize_patient_access(assignment.patient_id, current_user, db)

    db.delete(assignment)
    db.commit()
    return {"success": True, "message": "Asignación eliminada"}


class AssignmentStatusUpdate(BaseModel):
    status: str

@app.patch("/api/meal-plans/assign/{assignment_id}")
def update_assignment_status(
    assignment_id: int,
    status_data: AssignmentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """Actualizar estado de una asignación (active, paused, completed)"""
    assignment = db.query(PatientMealPlanDB).filter(PatientMealPlanDB.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    authorize_patient_access(assignment.patient_id, current_user, db)
        
    assignment.status = status_data.status
    db.commit()
    db.refresh(assignment)
    return assignment

@app.get("/api/meal-plans/stats")
def get_meal_plan_stats(db: Session = Depends(get_db)):
    total_plans = db.query(MealPlanDB).filter(MealPlanDB.is_active == 1).count()
    total_assignments = db.query(PatientMealPlanDB).filter(PatientMealPlanDB.status == "active").count()
    
    popular_plans = db.query(
        MealPlanDB.name,
        func.count(PatientMealPlanDB.id).label("count")
    ).join(
        PatientMealPlanDB, MealPlanDB.id == PatientMealPlanDB.meal_plan_id
    ).filter(
        PatientMealPlanDB.status == "active"
    ).group_by(MealPlanDB.name).order_by(func.count(PatientMealPlanDB.id).desc()).limit(5).all()
    
    return {
        "total_plans": total_plans,
        "active_assignments": total_assignments,
        "popular_plans": [{"name": p[0], "patients": p[1]} for p in popular_plans]
    }

@app.get("/api/appointments", response_model=List[AppointmentResponse])
def get_appointments(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """
    Obtener citas con filtros opcionales.
    Admin: solo pacientes asignados. Superadmin: todas.
    """
    query = scope_appointments_query_for_user(db.query(AppointmentDB), current_user, db)

    if start_date:
        query = query.filter(AppointmentDB.date >= datetime.strptime(start_date, "%Y-%m-%d").date())

    if end_date:
        query = query.filter(AppointmentDB.date <= datetime.strptime(end_date, "%Y-%m-%d").date())

    if status:
        query = query.filter(AppointmentDB.status == status)

    appointments = query.order_by(AppointmentDB.date, AppointmentDB.time).all()
    return [appointment_to_response(apt) for apt in appointments]


@app.get("/api/appointments/stats/overview")
def get_appointments_stats(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """Estadísticas generales de citas (alcance del nutricionista)."""
    today = today_co()

    today_query = scope_appointments_query_for_user(
        db.query(AppointmentDB).filter(AppointmentDB.date == today),
        current_user,
        db,
    )
    today_appointments = today_query.all()

    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    week_query = scope_appointments_query_for_user(
        db.query(AppointmentDB).filter(
            AppointmentDB.date >= week_start,
            AppointmentDB.date <= week_end,
        ),
        current_user,
        db,
    )
    week_appointments = week_query.all()

    confirmadas = len([a for a in week_appointments if a.status == "confirmada"])
    pendientes = len([a for a in week_appointments if a.status == "pendiente"])
    canceladas = len([a for a in week_appointments if a.status == "cancelada"])

    next_query = scope_appointments_query_for_user(
        db.query(AppointmentDB).filter(
            AppointmentDB.date >= today,
            AppointmentDB.status != "cancelada",
        ),
        current_user,
        db,
    )
    next_appointment = next_query.order_by(AppointmentDB.date, AppointmentDB.time).first()

    return {
        "today": {
            "total": len(today_appointments),
            "confirmadas": len([a for a in today_appointments if a.status == "confirmada"]),
            "pendientes": len([a for a in today_appointments if a.status == "pendiente"]),
        },
        "week": {
            "total": len(week_appointments),
            "confirmadas": confirmadas,
            "pendientes": pendientes,
            "canceladas": canceladas,
        },
        "next_appointment": {
            "patient_name": next_appointment.patient_name if next_appointment else None,
            "date": next_appointment.date.strftime("%Y-%m-%d") if next_appointment else None,
            "time": next_appointment.time if next_appointment else None,
        }
        if next_appointment
        else None,
    }


@app.get("/api/appointments/available-slots/{date}")
def get_available_slots(
    date: str,
    duration: Optional[str] = "30 min",
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """Obtener horarios disponibles para una fecha (considerando duración y solapes)."""
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido")

    nutritionist_id = current_user.id if current_user.role == "admin" else None
    available_slots, occupied_times = compute_available_slots_for_date(
        db,
        target_date,
        duration=duration or "30 min",
        nutritionist_id=nutritionist_id,
    )

    return {
        "date": date,
        "available_slots": available_slots,
        "occupied_slots": occupied_times,
        "total_available": len(available_slots),
    }


@app.get("/api/appointments/patient/{patient_id}")
def get_patient_appointments(
    patient_id: int,
    include_past: bool = False,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Obtener todas las citas de un paciente específico"""
    authorize_patient_access(patient_id, current_user, db)
    query = db.query(AppointmentDB).filter(AppointmentDB.patient_id == patient_id)

    if not include_past:
        query = query.filter(AppointmentDB.date >= today_co())

    appointments = query.order_by(AppointmentDB.date, AppointmentDB.time).all()
    return [appointment_to_response(apt) for apt in appointments]


@app.get("/api/appointments/{appointment_id}", response_model=AppointmentResponse)
def get_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Obtener detalles de una cita específica"""
    appointment = db.query(AppointmentDB).filter(AppointmentDB.id == appointment_id).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    authorize_appointment_access(appointment, current_user, db)
    return appointment_to_response(appointment)


@app.post("/api/appointments", response_model=AppointmentResponse)
def create_appointment(
    appointment_data: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """Crear una nueva cita"""
    authorize_patient_access(appointment_data.patient_id, current_user, db)
    patient = db.query(UserDB).filter(UserDB.id == appointment_data.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    try:
        appointment_date = datetime.strptime(appointment_data.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD")

    nutritionist_id = resolve_conflict_nutritionist_id(current_user, patient)
    if has_appointment_time_conflict(
        db,
        appointment_date,
        appointment_data.time,
        appointment_data.duration,
        nutritionist_id=nutritionist_id,
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Ya existe una cita que se solapa con {appointment_data.date} a las {appointment_data.time}",
        )

    now = now_co().strftime("%Y-%m-%d %H:%M:%S")
    new_appointment = AppointmentDB(
        patient_id=appointment_data.patient_id,
        patient_name=appointment_data.patient_name,
        date=appointment_date,
        time=appointment_data.time,
        duration=appointment_data.duration,
        type=appointment_data.type,
        status="pendiente",
        notes=appointment_data.notes,
        created_at=now,
        updated_at=now,
    )

    try:
        db.add(new_appointment)
        db.commit()
        db.refresh(new_appointment)

        try:
            dispatch_webhook_event(
                db,
                "appointment.created",
                {
                    "appointment_id": new_appointment.id,
                    "patient_id": new_appointment.patient_id,
                    "date": appointment_date.strftime("%Y-%m-%d"),
                    "time": new_appointment.time,
                    "type": new_appointment.type,
                    "status": new_appointment.status,
                },
                now_co=now_co,
            )
        except Exception:
            pass

        if patient.telefono:
            try:
                frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8080").rstrip("/")
                msg = (
                    f"Hola {patient.nombres}, te han asignado una nueva cita en NutriData.\n\n"
                    f"Fecha: {appointment_date.strftime('%d/%m/%Y')}\n"
                    f"Hora: {new_appointment.time}\n"
                    f"Tipo: {new_appointment.type.capitalize()}\n"
                    f"Link: {frontend_url}/patient/appointments\n\n"
                    f"Te esperamos!"
                )
                org_id = None
                try:
                    from platform_module import get_user_organization_id
                    org_id = get_user_organization_id(db, patient.id)
                except Exception:
                    pass
                send_whatsapp_notification(patient.telefono, msg, db=db, organization_id=org_id)
            except Exception as notify_err:
                print(f"[WARN] WhatsApp notify failed: {notify_err}")

        try:
            from integrations_module import sync_appointment_to_google_calendar
            org_id = None
            try:
                from platform_module import get_user_organization_id
                org_id = get_user_organization_id(db, patient.id)
            except Exception:
                pass
            sync_appointment_to_google_calendar(
                db,
                {
                    "id": new_appointment.id,
                    "patient_name": new_appointment.patient_name,
                    "date": appointment_date.strftime("%Y-%m-%d"),
                    "time": new_appointment.time,
                    "duration": new_appointment.duration,
                    "notes": new_appointment.notes,
                    "type": new_appointment.type,
                },
                organization_id=org_id,
                nutritionist_id=nutritionist_id,
            )
        except Exception as cal_err:
            print(f"[WARN] Calendar sync: {cal_err}")

        return appointment_to_response(new_appointment)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al crear la cita: {str(e)}")


@app.put("/api/appointments/{appointment_id}", response_model=AppointmentResponse)
def update_appointment(
    appointment_id: int,
    appointment_data: AppointmentUpdate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """Actualizar una cita existente"""
    appointment = db.query(AppointmentDB).filter(AppointmentDB.id == appointment_id).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    authorize_appointment_access(appointment, current_user, db)

    update_data = appointment_data.model_dump(exclude_unset=True)

    if "date" in update_data and update_data["date"]:
        try:
            update_data["date"] = datetime.strptime(update_data["date"], "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha inválido")

    if any(k in update_data for k in ("date", "time", "duration")):
        check_date = update_data.get("date", appointment.date)
        check_time = update_data.get("time", appointment.time)
        check_duration = update_data.get("duration", appointment.duration)
        patient = db.query(UserDB).filter(UserDB.id == appointment.patient_id).first()
        nutritionist_id = resolve_conflict_nutritionist_id(current_user, patient)

        if has_appointment_time_conflict(
            db,
            check_date,
            check_time,
            check_duration,
            exclude_id=appointment_id,
            nutritionist_id=nutritionist_id,
        ):
            raise HTTPException(status_code=400, detail="Ya existe una cita que se solapa con ese horario")

    for key, value in update_data.items():
        setattr(appointment, key, value)

    appointment.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")

    db.commit()
    db.refresh(appointment)
    return appointment_to_response(appointment)


@app.patch("/api/appointments/{appointment_id}/status")
def update_appointment_status(
    appointment_id: int,
    status_data: AppointmentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """Actualizar solo el estado de una cita"""
    appointment = db.query(AppointmentDB).filter(AppointmentDB.id == appointment_id).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    authorize_appointment_access(appointment, current_user, db)

    if status_data.status not in ["confirmada", "pendiente", "cancelada"]:
        raise HTTPException(status_code=400, detail="Estado inválido")

    appointment.status = status_data.status
    appointment.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")

    db.commit()

    return {
        "success": True,
        "message": f"Cita {status_data.status}",
        "appointment_id": appointment_id,
        "status": appointment.status,
    }


@app.delete("/api/appointments/{appointment_id}")
def delete_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """Eliminar una cita"""
    appointment = db.query(AppointmentDB).filter(AppointmentDB.id == appointment_id).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    authorize_appointment_access(appointment, current_user, db)

    db.delete(appointment)
    db.commit()

    return {
        "success": True,
        "message": "Cita eliminada correctamente",
    }

def calculate_trend(metrics: List[ProgressMetricDB]) -> str:
    """Calcula la tendencia del peso basándose en las últimas mediciones.
    up = subió de peso (Subiendo), down = bajó de peso (Bajando).
    """
    if len(metrics) < 2:
        return "stable"
    # Obtener las 3 mediciones más recientes y ordenarlas de más antigua a más reciente
    by_date_id = sorted(metrics, key=lambda x: (x.date, x.id or 0))
    last_three = by_date_id[-3:]
    recent_metrics = sorted(last_three, key=lambda x: (x.date, x.id or 0))
    if len(recent_metrics) < 2:
        return "stable"
    # Diferencia = peso más reciente - peso anterior (positivo = subió de peso)
    weight_changes = [
        recent_metrics[i].weight - recent_metrics[i - 1].weight
        for i in range(1, len(recent_metrics))
    ]
    avg_change = sum(weight_changes) / len(weight_changes)
    if avg_change > 0.3:
        return "up"
    if avg_change < -0.3:
        return "down"
    return "stable"

def calculate_weekly_adherence(patient_id: int, db: Session) -> int:
    """Calcula la adherencia de la semana actual basada en comidas completadas"""
    today = today_co()
    # Inicio de la semana (Lunes)
    week_start = today - timedelta(days=today.weekday())
    
    total_meals = db.query(MealTrackingDB).filter(
        MealTrackingDB.patient_id == patient_id,
        MealTrackingDB.date >= week_start,
        MealTrackingDB.date <= today
    ).count()
    
    completed_meals = db.query(MealTrackingDB).filter(
        MealTrackingDB.patient_id == patient_id,
        MealTrackingDB.date >= week_start,
        MealTrackingDB.date <= today,
        MealTrackingDB.completed == True
    ).count()
    
    if total_meals == 0:
        return 0
    
    return int((completed_meals / total_meals) * 100)

def get_initial_weight(patient_id: int, db: Session) -> Optional[float]:
    """Obtiene el peso inicial del paciente (primera medición)"""
    first_metric = db.query(ProgressMetricDB).filter(
        ProgressMetricDB.patient_id == patient_id
    ).order_by(ProgressMetricDB.date.asc(), ProgressMetricDB.id.asc()).first()
    
    if first_metric:
        return first_metric.weight
    
    # Si no hay métricas, usar el peso actual del perfil
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    return patient.peso_actual if patient else None

# ==================== ENDPOINTS PARA PROGRESS TRACKING ====================

@app.get("/api/progress/patients", response_model=List[PatientProgressSummary])
def get_patients_progress(
    search: Optional[str] = None,
    trend: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """
    Obtener resumen de progreso de pacientes.
    Si el usuario es admin (nutricionista), solo sus pacientes asignados.
    """
    query = db.query(UserDB).filter(UserDB.role == "patient")
    if current_user.role == "admin":
        query = query.filter(UserDB.nutritionist_id == current_user.id)
    
    if search:
        query = query.filter(
            (UserDB.nombres.contains(search)) | 
            (UserDB.apellidos.contains(search))
        )
    
    patients = query.all()
    
    results = []
    for patient in patients:
        # Obtener plan activo
        active_plan_assignment = db.query(PatientMealPlanDB).filter(
            PatientMealPlanDB.patient_id == patient.id,
            PatientMealPlanDB.status == "active"
        ).first()
        
        if not active_plan_assignment:
            continue
        
        plan = db.query(MealPlanDB).filter(
            MealPlanDB.id == active_plan_assignment.meal_plan_id
        ).first()
        
        # Obtener métricas del paciente
        metrics = db.query(ProgressMetricDB).filter(
            ProgressMetricDB.patient_id == patient.id
        ).order_by(ProgressMetricDB.date.desc(), ProgressMetricDB.id.desc()).all()
        
        # Calcular valores (priorizar peso_actual del perfil)
        current_weight = patient.peso_actual or (metrics[0].weight if metrics else 0)
        initial_weight = get_initial_weight(patient.id, db) or current_weight
        goal_weight = patient.peso_objetivo or current_weight
        
        trend_value = calculate_trend(metrics)
        # Si el perfil tiene peso actual distinto a la última métrica, usar esa comparación para la tendencia
        if metrics and patient.peso_actual is not None and abs(patient.peso_actual - metrics[0].weight) >= 0.3:
            trend_value = "up" if patient.peso_actual > metrics[0].weight else "down"
        adherence = calculate_weekly_adherence(patient.id, db)
        
        last_update = metrics[0].date.strftime("%Y-%m-%d") if metrics else now_co().strftime("%Y-%m-%d")
        
        progress_calc = calcular_progreso(current_weight, goal_weight, initial_weight)
        
        # Aplicar filtro de tendencia
        if trend and trend != "all" and trend_value != trend:
            continue
        
        results.append({
            "id": patient.id,
            "name": f"{patient.nombres} {patient.apellidos}",
            "avatar": patient.foto_perfil,
            "plan": plan.name if plan else "Sin plan",
            "plan_id": plan.id if plan else None,
            "start_date": active_plan_assignment.start_date,
            "current_weight": current_weight,
            "initial_weight": initial_weight,
            "goal_weight": goal_weight,
            "weekly_adherence": adherence,
            "trend": trend_value,
            "last_update": last_update,
            "progress_percentage": progress_calc
        })
    
    return results

@app.get("/api/progress/patients/{patient_id}", response_model=PatientProgressDetails)
def get_patient_progress_details(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Obtener detalles completos del progreso de un paciente"""
    authorize_patient_access(patient_id, current_user, db)
    
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    # Obtener plan activo
    active_plan_assignment = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.patient_id == patient_id,
        PatientMealPlanDB.status == "active"
    ).first()
    
    plan_name = "Sin plan"
    start_date = now_co().strftime("%Y-%m-%d")
    
    if active_plan_assignment:
        plan = db.query(MealPlanDB).filter(
            MealPlanDB.id == active_plan_assignment.meal_plan_id
        ).first()
        if plan:
            plan_name = plan.name
        start_date = active_plan_assignment.start_date
    
    # Obtener métricas
    metrics = db.query(ProgressMetricDB).filter(
        ProgressMetricDB.patient_id == patient_id
    ).order_by(ProgressMetricDB.date.asc(), ProgressMetricDB.id.asc()).all()
    
    metrics_data = [
        {
            "id": m.id,
            "date": m.date.strftime("%Y-%m-%d"),
            "weight": m.weight,
            "body_fat": m.body_fat,
            "muscle": m.muscle,
            "water": m.water,
            "waist": m.waist,
            "hip": m.hip,
            "chest": m.chest,
            "arm": m.arm,
            "notes": m.notes
        }
        for m in metrics
    ]
    
    # Obtener logros
    achievements = db.query(AchievementDB).filter(
        AchievementDB.patient_id == patient_id
    ).order_by(AchievementDB.achieved_date.desc()).all()
    
    achievements_list = [a.title for a in achievements]
    achievements_list_detailed = [
        {
            "id": a.id,
            "title": a.title,
            "description": a.description,
            "date": a.achieved_date.strftime("%Y-%m-%d")
        }
        for a in achievements
    ]
    
    # Obtener notas del nutricionista
    notes = db.query(NutritionistNoteDB).filter(
        NutritionistNoteDB.patient_id == patient_id
    ).order_by(NutritionistNoteDB.created_at.desc()).all()
    
    notes_list = [n.note for n in notes]
    notes_list_detailed = [
        {
            "id": n.id,
            "content": n.note,
            "date": n.created_at[:10] if n.created_at else ""
        }
        for n in notes
    ]
    
    # Calcular valores (priorizar peso_actual del perfil como fuente de verdad)
    current_weight = patient.peso_actual or (metrics[-1].weight if metrics else 0)
    initial_weight = get_initial_weight(patient_id, db) or current_weight
    goal_weight = patient.peso_objetivo or current_weight
    
    trend_value = calculate_trend(metrics)
    # Si el perfil tiene peso actual distinto a la última métrica, tendencia por comparación directa
    if metrics and patient.peso_actual is not None and abs(patient.peso_actual - metrics[-1].weight) >= 0.3:
        trend_value = "up" if patient.peso_actual > metrics[-1].weight else "down"
    adherence = calculate_weekly_adherence(patient_id, db)
    last_update = metrics[-1].date.strftime("%Y-%m-%d") if metrics else now_co().strftime("%Y-%m-%d")
    progress_percentage = calcular_progreso(current_weight, goal_weight, initial_weight)

    return {
        "id": patient.id,
        "name": f"{patient.nombres} {patient.apellidos}",
        "avatar": patient.foto_perfil,
        "plan": plan_name,
        "start_date": start_date,
        "current_weight": current_weight,
        "initial_weight": initial_weight,
        "goal_weight": goal_weight,
        "weekly_adherence": adherence,
        "trend": trend_value,
        "last_update": last_update,
        "progress_percentage": progress_percentage,
        "metrics": metrics_data,
        "metricsHistory": metrics_data,
        "achievements": achievements_list,
        "achievementsList": achievements_list_detailed,
        "notes": notes_list,
        "notesList": notes_list_detailed
    }

@app.post("/api/progress/metrics", response_model=ProgressMetricResponse)
def create_progress_metric(
    metric_data: ProgressMetricCreate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Crear una nueva métrica de progreso para un paciente"""
    authorize_patient_access(metric_data.patient_id, current_user, db)
    patient = db.query(UserDB).filter(UserDB.id == metric_data.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    try:
        metric_date = datetime.strptime(metric_data.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido")
    
    
    # Crear nueva métrica (siempre, para historial detallado)
    new_metric = ProgressMetricDB(
        patient_id=metric_data.patient_id,
        date=metric_date,
        weight=metric_data.weight,
        body_fat=metric_data.body_fat,
        muscle=metric_data.muscle,
        water=metric_data.water,
        waist=metric_data.waist,
        hip=metric_data.hip,
        chest=metric_data.chest,
        arm=metric_data.arm,
        notes=metric_data.notes,
        created_at=now_co().strftime("%Y-%m-%d %H:%M:%S")
    )
    
    db.add(new_metric)
    db.commit()
    db.refresh(new_metric)
    
    # Actualizar el peso actual del paciente
    patient.peso_actual = metric_data.weight
    
    # Si no tiene peso inicial, establecerlo
    if patient.peso_inicial is None:
        patient.peso_inicial = metric_data.weight
        
    db.commit()
    
    return {
        "id": new_metric.id,
        "patient_id": new_metric.patient_id,
        "date": new_metric.date.strftime("%Y-%m-%d"),
        "weight": new_metric.weight,
        "body_fat": new_metric.body_fat,
        "muscle": new_metric.muscle,
        "water": new_metric.water,
        "waist": new_metric.waist,
        "hip": new_metric.hip,
        "chest": new_metric.chest,
        "arm": new_metric.arm,
        "notes": new_metric.notes
    }

@app.put("/api/progress/metrics/{metric_id}", response_model=ProgressMetricResponse)
def update_progress_metric(
    metric_id: int,
    metric_data: ProgressMetricCreate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Actualizar una métrica de progreso por ID"""
    metric = db.query(ProgressMetricDB).filter(ProgressMetricDB.id == metric_id).first()
    if not metric:
        raise HTTPException(status_code=404, detail="Métrica no encontrada")
    authorize_patient_access(metric.patient_id, current_user, db)
    
    try:
        metric_date = datetime.strptime(metric_data.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido")

    metric.date = metric_date
    metric.weight = metric_data.weight
    metric.body_fat = metric_data.body_fat
    metric.muscle = metric_data.muscle
    metric.water = metric_data.water
    metric.waist = metric_data.waist
    metric.hip = metric_data.hip
    metric.chest = metric_data.chest
    metric.arm = metric_data.arm
    metric.notes = metric_data.notes
    
    # Si es la métrica más reciente, actualizar el peso actual del paciente
    latest_metric = db.query(ProgressMetricDB).filter(
        ProgressMetricDB.patient_id == metric.patient_id
    ).order_by(ProgressMetricDB.date.desc(), ProgressMetricDB.id.desc()).first()
    
    if latest_metric and latest_metric.id == metric.id:
        patient = db.query(UserDB).filter(UserDB.id == metric.patient_id).first()
        if patient:
            patient.peso_actual = metric.weight
    
    db.commit()
    db.refresh(metric)
    
    return {
        "id": metric.id,
        "patient_id": metric.patient_id,
        "date": metric.date.strftime("%Y-%m-%d"),
        "weight": metric.weight,
        "body_fat": metric.body_fat,
        "muscle": metric.muscle,
        "water": metric.water,
        "waist": metric.waist,
        "hip": metric.hip,
        "chest": metric.chest,
        "arm": metric.arm,
        "notes": metric.notes
    }

@app.delete("/api/progress/metrics/{metric_id}")
def delete_progress_metric(
    metric_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Eliminar una métrica de progreso y sincronizar peso_actual del paciente"""
    metric = db.query(ProgressMetricDB).filter(ProgressMetricDB.id == metric_id).first()
    if not metric:
        raise HTTPException(status_code=404, detail="Métrica no encontrada")
    authorize_patient_access(metric.patient_id, current_user, db)

    patient_id = metric.patient_id
    db.delete(metric)
    db.flush()

    # Recalcular peso_actual con la métrica más reciente restante
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if patient:
        latest_metric = db.query(ProgressMetricDB).filter(
            ProgressMetricDB.patient_id == patient_id
        ).order_by(ProgressMetricDB.date.desc(), ProgressMetricDB.id.desc()).first()
        if latest_metric:
            patient.peso_actual = latest_metric.weight
        else:
            # Sin métricas: volver a peso inicial si existe
            patient.peso_actual = patient.peso_inicial

    db.commit()
    return {"success": True, "message": "Métrica eliminada"}

@app.get("/api/progress/metrics/{patient_id}", response_model=List[ProgressMetricResponse])
def get_patient_metrics(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Obtener todas las métricas de un paciente"""
    authorize_patient_access(patient_id, current_user, db)
    metrics = db.query(ProgressMetricDB).filter(
        ProgressMetricDB.patient_id == patient_id
    ).order_by(ProgressMetricDB.date.asc()).all()
    
    return [
        {
            "id": m.id,
            "patient_id": m.patient_id,
            "date": m.date.strftime("%Y-%m-%d"),
            "weight": m.weight,
            "body_fat": m.body_fat,
            "muscle": m.muscle,
            "water": m.water,
            "waist": m.waist,
            "hip": m.hip,
            "chest": m.chest,
            "arm": m.arm,
            "notes": m.notes
        }
        for m in metrics
    ]

@app.post("/api/progress/achievements", response_model=AchievementResponse)
def create_achievement(
    achievement_data: AchievementCreate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Crear un nuevo logro para un paciente"""
    authorize_patient_access(achievement_data.patient_id, current_user, db)
    patient = db.query(UserDB).filter(UserDB.id == achievement_data.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    try:
        achieved_date = datetime.strptime(achievement_data.achieved_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido")
    
    new_achievement = AchievementDB(
        patient_id=achievement_data.patient_id,
        title=achievement_data.title,
        description=achievement_data.description,
        achieved_date=achieved_date,
        icon=achievement_data.icon
    )
    
    db.add(new_achievement)
    db.commit()
    db.refresh(new_achievement)
    
    return {
        "id": new_achievement.id,
        "patient_id": new_achievement.patient_id,
        "title": new_achievement.title,
        "description": new_achievement.description,
        "achieved_date": new_achievement.achieved_date.strftime("%Y-%m-%d"),
        "icon": new_achievement.icon
    }

@app.put("/api/progress/achievements/{achievement_id}", response_model=AchievementResponse)
def update_achievement(
    achievement_id: int,
    achievement_data: AchievementUpdate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Actualizar un logro existente"""
    achievement = db.query(AchievementDB).filter(AchievementDB.id == achievement_id).first()
    if not achievement:
        raise HTTPException(status_code=404, detail="Logro no encontrado")
    authorize_patient_access(achievement.patient_id, current_user, db)

    try:
        achieved_date = datetime.strptime(achievement_data.achieved_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido")

    achievement.title = achievement_data.title
    achievement.description = achievement_data.description
    achievement.achieved_date = achieved_date
    if achievement_data.icon:
        achievement.icon = achievement_data.icon

    db.commit()
    db.refresh(achievement)

    return {
        "id": achievement.id,
        "patient_id": achievement.patient_id,
        "title": achievement.title,
        "description": achievement.description,
        "achieved_date": achievement.achieved_date.strftime("%Y-%m-%d"),
        "icon": achievement.icon
    }

@app.get("/api/progress/achievements/{patient_id}", response_model=List[AchievementResponse])
def get_patient_achievements(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Obtener todos los logros de un paciente"""
    authorize_patient_access(patient_id, current_user, db)
    achievements = db.query(AchievementDB).filter(
        AchievementDB.patient_id == patient_id
    ).order_by(AchievementDB.achieved_date.desc()).all()
    
    return [
        {
            "id": a.id,
            "patient_id": a.patient_id,
            "title": a.title,
            "description": a.description,
            "achieved_date": a.achieved_date.strftime("%Y-%m-%d"),
            "icon": a.icon
        }
        for a in achievements
    ]

@app.delete("/api/progress/achievements/{achievement_id}")
def delete_achievement(
    achievement_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Eliminar un logro"""
    achievement = db.query(AchievementDB).filter(AchievementDB.id == achievement_id).first()
    if not achievement:
        raise HTTPException(status_code=404, detail="Logro no encontrado")
    authorize_patient_access(achievement.patient_id, current_user, db)
    db.delete(achievement)
    db.commit()
    return {"success": True, "message": "Logro eliminado"}

@app.post("/api/progress/notes", response_model=NutritionistNoteResponse)
def create_nutritionist_note(
    note_data: NutritionistNoteCreate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Crear una nueva nota del nutricionista"""
    authorize_patient_access(note_data.patient_id, current_user, db)
    patient = db.query(UserDB).filter(UserDB.id == note_data.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    author_id = note_data.created_by or current_user.id
    author = db.query(UserDB).filter(UserDB.id == author_id).first()
    if not author:
        raise HTTPException(status_code=404, detail="Autor no encontrado")
    
    new_note = NutritionistNoteDB(
        patient_id=note_data.patient_id,
        note=note_data.note,
        created_by=author_id,
        created_at=now_co().strftime("%Y-%m-%d %H:%M:%S")
    )
    
    db.add(new_note)
    db.commit()
    db.refresh(new_note)
    
    return {
        "id": new_note.id,
        "patient_id": new_note.patient_id,
        "note": new_note.note,
        "created_at": new_note.created_at,
        "created_by": new_note.created_by,
        "author_name": f"{author.nombres} {author.apellidos}"
    }

@app.put("/api/progress/notes/{note_id}", response_model=NutritionistNoteResponse)
def update_nutritionist_note(
    note_id: int,
    note_data: NutritionistNoteUpdate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Actualizar una nota del nutricionista"""
    note = db.query(NutritionistNoteDB).filter(NutritionistNoteDB.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    authorize_patient_access(note.patient_id, current_user, db)

    note.note = note_data.note
    db.commit()
    db.refresh(note)

    author = db.query(UserDB).filter(UserDB.id == note.created_by).first()
    author_name = f"{author.nombres} {author.apellidos}" if author else "Desconocido"

    return {
        "id": note.id,
        "patient_id": note.patient_id,
        "note": note.note,
        "created_at": note.created_at,
        "created_by": note.created_by,
        "author_name": author_name
    }

@app.get("/api/progress/notes/{patient_id}", response_model=List[NutritionistNoteResponse])
def get_patient_notes(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Obtener todas las notas del nutricionista para un paciente"""
    authorize_patient_access(patient_id, current_user, db)
    notes = db.query(NutritionistNoteDB).filter(
        NutritionistNoteDB.patient_id == patient_id
    ).order_by(NutritionistNoteDB.created_at.desc()).all()
    
    results = []
    for note in notes:
        author = db.query(UserDB).filter(UserDB.id == note.created_by).first()
        author_name = f"{author.nombres} {author.apellidos}" if author else "Desconocido"
        
        results.append({
            "id": note.id,
            "patient_id": note.patient_id,
            "note": note.note,
            "created_at": note.created_at,
            "created_by": note.created_by,
            "author_name": author_name
        })
    
    return results

@app.delete("/api/progress/notes/{note_id}")
def delete_nutritionist_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Eliminar una nota del nutricionista"""
    note = db.query(NutritionistNoteDB).filter(NutritionistNoteDB.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    authorize_patient_access(note.patient_id, current_user, db)
    db.delete(note)
    db.commit()
    return {"success": True, "message": "Nota eliminada"}

@app.get("/api/progress/stats")
def get_progress_stats(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Obtener estadísticas de progreso. Si es admin, solo de sus pacientes."""
    if current_user.role == "admin":
        my_patient_ids = [r.id for r in db.query(UserDB.id).filter(
            UserDB.role == "patient",
            UserDB.nutritionist_id == current_user.id
        ).all()]
        if not my_patient_ids:
            return {
                "total_patients": 0,
                "avg_adherence": 0,
                "patients_on_track": 0,
                "total_weight_lost": 0
            }
        total_patients = db.query(PatientMealPlanDB).filter(
            PatientMealPlanDB.status == "active",
            PatientMealPlanDB.patient_id.in_(my_patient_ids)
        ).count()
        all_patients = db.query(UserDB).filter(UserDB.id.in_(my_patient_ids)).all()
    else:
        total_patients = db.query(PatientMealPlanDB).filter(
            PatientMealPlanDB.status == "active"
        ).count()
        all_patients = db.query(UserDB).filter(UserDB.role == "patient").all()
    
    adherence_values = [calculate_weekly_adherence(p.id, db) for p in all_patients]
    avg_adherence = int(sum(adherence_values) / len(adherence_values)) if adherence_values else 0
    patients_on_track = len([a for a in adherence_values if a >= 80])
    total_weight_lost = 0
    for patient in all_patients:
        initial_weight = get_initial_weight(patient.id, db)
        if initial_weight and patient.peso_actual:
            weight_diff = initial_weight - patient.peso_actual
            if weight_diff > 0:  # Solo contar pérdida de peso
                total_weight_lost += weight_diff
    
    return {
        "total_patients": total_patients,
        "avg_adherence": avg_adherence,
        "patients_on_track": patients_on_track,
        "total_weight_lost": round(total_weight_lost, 1)
    }

def _parse_user_created_date(value) -> Optional[date]:
    if not value:
        return None
    try:
        text = str(value)[:10]
        return datetime.strptime(text, "%Y-%m-%d").date()
    except Exception:
        return None


def _relative_joined_label(created_at) -> str:
    created = _parse_user_created_date(created_at)
    if not created:
        return "Reciente"
    days = (today_co() - created).days
    if days <= 0:
        return "Hoy"
    if days == 1:
        return "Ayer"
    if days < 7:
        return f"Hace {days} días"
    if days < 30:
        weeks = max(1, days // 7)
        return f"Hace {weeks} sem."
    return created.strftime("%d/%m/%Y")


def _count_change_meta(current: int, previous: int, unit_label: str = "") -> tuple:
    """Devuelve (change_text, change_type) a partir de conteos reales."""
    delta = current - previous
    if previous <= 0:
        if current <= 0:
            text = "Sin cambios"
            ctype = "neutral"
        else:
            suffix = f" {unit_label}".rstrip()
            text = f"+{current}{suffix} este período"
            ctype = "positive"
    else:
        pct = round((delta / previous) * 100)
        sign = "+" if pct > 0 else ""
        text = f"{sign}{pct}% vs período anterior"
        ctype = "positive" if pct > 0 else ("negative" if pct < 0 else "neutral")
    return text, ctype


def _month_bounds(ref: date):
    start = ref.replace(day=1)
    if start.month == 12:
        nxt = start.replace(year=start.year + 1, month=1, day=1)
    else:
        nxt = start.replace(month=start.month + 1, day=1)
    return start, nxt


@app.get("/api/dashboard/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """
    Estadísticas reales del dashboard.
    Admin: solo pacientes asignados. Superadmin: global.
    """
    patient_base = [UserDB.role == "patient"]
    if current_user.role == "admin":
        patient_base.append(UserDB.nutritionist_id == current_user.id)

    active_filter = patient_base + [UserDB.status == "activo"]
    total_patients = db.query(UserDB).filter(*active_filter).count()

    my_patient_ids = [
        r.id
        for r in db.query(UserDB.id).filter(*patient_base).all()
    ]

    # Nuevos pacientes por mes (created_at) — cuentas reales
    today = today_co()
    this_month_start, next_month_start = _month_bounds(today)
    prev_month_end = this_month_start - timedelta(days=1)
    prev_month_start, _ = _month_bounds(prev_month_end)

    patients_this_month = 0
    patients_prev_month = 0
    for p in db.query(UserDB).filter(*patient_base).all():
        created = _parse_user_created_date(getattr(p, "created_at", None))
        if not created:
            continue
        if this_month_start <= created < next_month_start:
            patients_this_month += 1
        elif prev_month_start <= created < this_month_start:
            patients_prev_month += 1
    patients_change, patients_change_type = _count_change_meta(
        patients_this_month, patients_prev_month, "nuevos"
    )

    # Planes activos + asignaciones por mes
    if my_patient_ids:
        active_plans = (
            db.query(PatientMealPlanDB)
            .filter(
                PatientMealPlanDB.status == "active",
                PatientMealPlanDB.patient_id.in_(my_patient_ids),
            )
            .count()
        )
        plan_rows = (
            db.query(PatientMealPlanDB)
            .filter(PatientMealPlanDB.patient_id.in_(my_patient_ids))
            .all()
        )
    else:
        active_plans = 0
        plan_rows = []

    plans_this_month = 0
    plans_prev_month = 0
    for a in plan_rows:
        raw = getattr(a, "assigned_date", None) or getattr(a, "start_date", None)
        ad = _parse_user_created_date(raw)
        if not ad:
            continue
        if this_month_start <= ad < next_month_start:
            plans_this_month += 1
        elif prev_month_start <= ad < this_month_start:
            plans_prev_month += 1
    plans_change, plans_change_type = _count_change_meta(plans_this_month, plans_prev_month, "nuevos")

    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    prev_week_start = week_start - timedelta(days=7)
    prev_week_end = week_start - timedelta(days=1)

    apt_q = db.query(AppointmentDB)
    if current_user.role == "admin":
        if not my_patient_ids:
            appointments_this_week = 0
            appointments_prev_week = 0
            appointments_today = 0
        else:
            apt_q = apt_q.filter(AppointmentDB.patient_id.in_(my_patient_ids))
            appointments_this_week = apt_q.filter(
                AppointmentDB.date >= week_start,
                AppointmentDB.date <= week_end,
                AppointmentDB.status != "cancelada",
            ).count()
            appointments_prev_week = (
                db.query(AppointmentDB)
                .filter(
                    AppointmentDB.patient_id.in_(my_patient_ids),
                    AppointmentDB.date >= prev_week_start,
                    AppointmentDB.date <= prev_week_end,
                    AppointmentDB.status != "cancelada",
                )
                .count()
            )
            appointments_today = (
                db.query(AppointmentDB)
                .filter(
                    AppointmentDB.patient_id.in_(my_patient_ids),
                    AppointmentDB.date == today,
                    AppointmentDB.status.in_(["pendiente", "confirmada"]),
                )
                .count()
            )
    else:
        appointments_this_week = apt_q.filter(
            AppointmentDB.date >= week_start,
            AppointmentDB.date <= week_end,
            AppointmentDB.status != "cancelada",
        ).count()
        appointments_prev_week = (
            db.query(AppointmentDB)
            .filter(
                AppointmentDB.date >= prev_week_start,
                AppointmentDB.date <= prev_week_end,
                AppointmentDB.status != "cancelada",
            )
            .count()
        )
        appointments_today = (
            db.query(AppointmentDB)
            .filter(
                AppointmentDB.date == today,
                AppointmentDB.status.in_(["pendiente", "confirmada"]),
            )
            .count()
        )

    week_change, week_change_type = _count_change_meta(
        appointments_this_week, appointments_prev_week
    )
    appointments_change = f"{appointments_today} hoy · {week_change}"
    appointments_change_type = "neutral" if appointments_today == 0 else week_change_type

    all_active_patients = db.query(UserDB).filter(*active_filter).all()
    progress_values = []
    for patient in all_active_patients:
        if patient.peso_actual is not None and patient.peso_objetivo is not None:
            prog = calcular_progreso(
                patient.peso_actual, patient.peso_objetivo, patient.peso_inicial
            )
            progress_values.append(prog)

    avg_progress = round(sum(progress_values) / len(progress_values)) if progress_values else 0
    if progress_values:
        on_track = sum(1 for p in progress_values if p >= 50)
        progress_change = f"{on_track}/{len(progress_values)} con >=50%"
        progress_change_type = "positive" if on_track >= len(progress_values) / 2 else "neutral"
    else:
        progress_change = "Sin datos de peso"
        progress_change_type = "neutral"

    return {
        "patients": {
            "total": total_patients,
            "change": patients_change,
            "change_type": patients_change_type,
            "new_this_month": patients_this_month,
        },
        "plans": {
            "total": active_plans,
            "change": plans_change,
            "change_type": plans_change_type,
            "new_this_month": plans_this_month,
        },
        "appointments": {
            "total": appointments_this_week,
            "pending_today": appointments_today,
            "change": appointments_change,
            "change_type": appointments_change_type,
        },
        "progress": {
            "average": avg_progress,
            "change": progress_change,
            "change_type": progress_change_type,
            "patients_with_data": len(progress_values),
        },
    }


@app.get("/api/dashboard/recent-patients")
def get_recent_patients(
    limit: int = 5,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """
    Obtener pacientes registrados recientemente.
    Si el usuario es admin (nutricionista), solo sus pacientes asignados.
    """
    query = db.query(UserDB).filter(UserDB.role == "patient")
    if current_user.role == "admin":
        query = query.filter(UserDB.nutritionist_id == current_user.id)
    recent_patients = query.order_by(UserDB.id.desc()).limit(limit).all()

    results = []
    for patient in recent_patients:
        active_plan = (
            db.query(PatientMealPlanDB)
            .filter(
                PatientMealPlanDB.patient_id == patient.id,
                PatientMealPlanDB.status == "active",
            )
            .first()
        )

        plan_name = "Sin plan asignado"
        if active_plan:
            plan = db.query(MealPlanDB).filter(MealPlanDB.id == active_plan.meal_plan_id).first()
            if plan:
                plan_name = plan.name

        created_raw = getattr(patient, "created_at", None)
        created_date = _parse_user_created_date(created_raw)

        results.append(
            {
                "id": patient.id,
                "name": f"{patient.nombres} {patient.apellidos}",
                "nombres": patient.nombres,
                "apellidos": patient.apellidos,
                "avatar": patient.foto_perfil,
                "foto_perfil": patient.foto_perfil,
                "email": patient.email,
                "telefono": patient.telefono,
                "plan": plan_name,
                "status": patient.status or "activo",
                "joined": _relative_joined_label(created_raw),
                "registered_at": created_date.strftime("%Y-%m-%d") if created_date else None,
                "peso_actual": patient.peso_actual,
                "peso_objetivo": patient.peso_objetivo,
                "nivel_actividad": patient.nivel_actividad,
                "progreso": calcular_progreso(
                    patient.peso_actual, patient.peso_objetivo, patient.peso_inicial
                ),
                "proxima_cita": _patient_next_appointment_label(db, patient.id),
                "altura": patient.altura,
                "edad_formateada": calcular_edad_detallada(patient.fecha_nacimiento),
                "evaluacion_nutricional": patient.evaluacion_nutricional,
                "frecuencia_consumo": patient.frecuencia_consumo,
                "alergias": patient.alergias or [],
                "preferencias": patient.preferencias or [],
                "objetivos_salud": patient.objetivos_salud,
                "condiciones_medicas": patient.condiciones_medicas,
                "alimentos_disgusto": patient.alimentos_disgusto,
                "antecedentes_familiares": patient.antecedentes_familiares,
                "acompanante_nombre": getattr(patient, "acompanante_nombre", None),
                "acompanante_parentesco": getattr(patient, "acompanante_parentesco", None),
                "acompanante_telefono": getattr(patient, "acompanante_telefono", None),
                "acompanante_email": getattr(patient, "acompanante_email", None),
                "acompanante_documento": getattr(patient, "acompanante_documento", None),
                "acompanante_observaciones": getattr(patient, "acompanante_observaciones", None),
                "examenes_bioquimicos": getattr(patient, "examenes_bioquimicos", None) or {},
                "role": patient.role,
            }
        )

    return results


@app.get("/api/dashboard/upcoming-appointments")
def get_upcoming_appointments(
    limit: int = 5,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """
    Obtener próximas citas programadas.
    Si el usuario es admin (nutricionista), solo citas de sus pacientes asignados.
    """
    today = today_co()
    query = db.query(AppointmentDB).filter(
        AppointmentDB.date >= today,
        AppointmentDB.status != "cancelada",
    )
    if current_user.role == "admin":
        my_patient_ids = [
            r.id
            for r in db.query(UserDB.id)
            .filter(UserDB.role == "patient", UserDB.nutritionist_id == current_user.id)
            .all()
        ]
        if not my_patient_ids:
            return []
        query = query.filter(AppointmentDB.patient_id.in_(my_patient_ids))
    upcoming = query.order_by(AppointmentDB.date.asc(), AppointmentDB.time.asc()).limit(limit).all()

    results = []
    for appointment in upcoming:
        patient = db.query(UserDB).filter(UserDB.id == appointment.patient_id).first()

        days_until = (appointment.date - today).days
        if days_until == 0:
            date_label = "Hoy"
        elif days_until == 1:
            date_label = "Mañana"
        else:
            date_label = appointment.date.strftime("%d/%m/%Y")

        results.append(
            {
                "id": appointment.id,
                "patient_id": appointment.patient_id,
                "patient_name": appointment.patient_name,
                "patient_avatar": patient.foto_perfil if patient else None,
                "date": appointment.date.strftime("%Y-%m-%d"),
                "date_label": date_label,
                "time": appointment.time,
                "duration": appointment.duration,
                "type": appointment.type,
                "status": appointment.status,
                "notes": appointment.notes,
                "meeting_link": appointment.meeting_link,
            }
        )

    return results


@app.get("/api/dashboard/nutrition-chart")
def get_nutrition_chart_data(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """
    Obtener datos para el gráfico de nutrición del dashboard
    Muestra la distribución de macronutrientes promedio
    """
    # Obtener todos los planes activos
    active_q = db.query(PatientMealPlanDB).filter(PatientMealPlanDB.status == "active")
    if current_user.role == "admin":
        my_patient_ids = [
            r.id
            for r in db.query(UserDB.id)
            .filter(UserDB.role == "patient", UserDB.nutritionist_id == current_user.id)
            .all()
        ]
        if not my_patient_ids:
            return []
        active_q = active_q.filter(PatientMealPlanDB.patient_id.in_(my_patient_ids))
    active_assignments = active_q.all()

    # Agrupar por categoría de plan
    category_data = {}

    for assignment in active_assignments:
        plan = db.query(MealPlanDB).filter(MealPlanDB.id == assignment.meal_plan_id).first()

        if plan:
            if plan.category not in category_data:
                category_data[plan.category] = {
                    "count": 0,
                    "total_calories": 0,
                    "total_protein": 0,
                    "total_carbs": 0,
                    "total_fat": 0,
                }

            category_data[plan.category]["count"] += 1
            category_data[plan.category]["total_calories"] += plan.calories
            category_data[plan.category]["total_protein"] += plan.protein_target or 0
            category_data[plan.category]["total_carbs"] += plan.carbs_target or 0
            category_data[plan.category]["total_fat"] += plan.fat_target or 0

    # Calcular promedios
    results = []
    for category, data in category_data.items():
        if data["count"] > 0:
            results.append(
                {
                    "category": category,
                    "patients": data["count"],
                    "avg_calories": round(data["total_calories"] / data["count"]),
                    "avg_protein": round(data["total_protein"] / data["count"]),
                    "avg_carbs": round(data["total_carbs"] / data["count"]),
                    "avg_fat": round(data["total_fat"] / data["count"]),
                }
            )

    return results


@app.get("/api/dashboard/weekly-overview")
def get_weekly_overview(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """
    Obtener resumen semanal de actividad
    """
    today = today_co()
    week_start = today - timedelta(days=today.weekday())
    
    weekly_data = []
    
    for i in range(7):
        day = week_start + timedelta(days=i)
        day_name = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][i]
        
        # Citas del día
        appointments = db.query(AppointmentDB).filter(
            AppointmentDB.date == day
        ).count()
        
        # Nuevos pacientes del día
        new_patients = db.query(UserDB).filter(
            UserDB.role == "patient",
            func.date(UserDB.created_at) == day
        ).count()
        
        # Métricas registradas del día
        metrics = db.query(ProgressMetricDB).filter(
            ProgressMetricDB.date == day
        ).count()
        
        weekly_data.append({
            "day": day_name,
            "date": day.strftime("%Y-%m-%d"),
            "appointments": appointments,
            "new_patients": new_patients,
            "metrics": metrics,
            "is_today": day == today
        })
    
    return weekly_data

@app.get("/api/dashboard/top-plans")
def get_top_plans(
    limit: int = 5,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """
    Obtener los planes más populares
    """
    popular_plans = db.query(
        MealPlanDB.id,
        MealPlanDB.name,
        MealPlanDB.category,
        MealPlanDB.color,
        func.count(PatientMealPlanDB.id).label("patient_count")
    ).join(
        PatientMealPlanDB,
        MealPlanDB.id == PatientMealPlanDB.meal_plan_id
    ).filter(
        PatientMealPlanDB.status == "active"
    ).group_by(
        MealPlanDB.id
    ).order_by(
        func.count(PatientMealPlanDB.id).desc()
    ).limit(limit).all()
    
    results = []
    for plan in popular_plans:
        results.append({
            "id": plan.id,
            "name": plan.name,
            "category": plan.category,
            "color": plan.color,
            "patients": plan.patient_count
        })
    
    return results

@app.get("/api/dashboard/activity-feed")
def get_activity_feed(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """
    Obtener feed de actividad reciente
    """
    activities = []
    
    # Nuevos pacientes (últimos 5 por ID, ya que no hay created_at)
    recent_patients = db.query(UserDB).filter(
        UserDB.role == "patient"
    ).order_by(UserDB.id.desc()).limit(5).all()
    
    for patient in recent_patients:
        activities.append({
            "type": "new_patient",
            "title": "Nuevo paciente registrado",
            "description": f"{patient.nombres} {patient.apellidos} se unió a la plataforma",
            "timestamp": now_co().strftime("%Y-%m-%d %H:%M:%S"),
            "icon": "user-plus"
        })
    
    # Citas completadas hoy
    today = today_co()
    completed_appointments = db.query(AppointmentDB).filter(
        AppointmentDB.date == today,
        AppointmentDB.status == "confirmada"
    ).order_by(AppointmentDB.time.desc()).limit(5).all()
    
    for apt in completed_appointments:
        activities.append({
            "type": "appointment_completed",
            "title": "Cita completada",
            "description": f"Consulta con {apt.patient_name}",
            "timestamp": f"{apt.date.strftime('%Y-%m-%d')} {apt.time}",
            "icon": "check-circle"
        })
    
    # Planes asignados recientes
    recent_assignments = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.status == "active"
    ).order_by(PatientMealPlanDB.id.desc()).limit(5).all()
    
    for assignment in recent_assignments:
        patient = db.query(UserDB).filter(UserDB.id == assignment.patient_id).first()
        plan = db.query(MealPlanDB).filter(MealPlanDB.id == assignment.meal_plan_id).first()
        
        if patient and plan:
            activities.append({
                "type": "plan_assigned",
                "title": "Plan nutricional asignado",
                "description": f"{plan.name} asignado a {patient.nombres} {patient.apellidos}",
                "timestamp": assignment.assigned_date,
                "icon": "clipboard"
            })
    
    # Ordenar por timestamp y limitar
    activities.sort(key=lambda x: x["timestamp"], reverse=True)
    
    return activities[:limit]
@app.get("/api/dashboard/patient-status-distribution")
def get_patient_status_distribution(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """
    Obtener distribución de pacientes por estado
    """
    status_counts = db.query(
        UserDB.status,
        func.count(UserDB.id).label("count")
    ).filter(
        UserDB.role == "patient"
    ).group_by(UserDB.status).all()
    
    total = sum([s.count for s in status_counts])
    
    results = []
    for status in status_counts:
        percentage = round((status.count / total) * 100) if total > 0 else 0
        results.append({
            "status": status.status,
            "count": status.count,
            "percentage": percentage
        })
    
    return results

@app.get("/api/dashboard/appointments-by-type")
def get_appointments_by_type(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """
    Obtener distribución de citas por tipo (presencial/videollamada)
    """
    today = today_co()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    
    type_counts = db.query(
        AppointmentDB.type,
        func.count(AppointmentDB.id).label("count")
    ).filter(
        AppointmentDB.date >= week_start,
        AppointmentDB.date <= week_end
    ).group_by(AppointmentDB.type).all()
    
    results = []
    for type_count in type_counts:
        results.append({
            "type": type_count.type,
            "count": type_count.count
        })
    
    return results
@app.get("/api/patients/{patient_id}/appointments/upcoming")
def get_patient_upcoming_appointments(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """
    Obtener las próximas citas de un paciente específico
    """
    authorize_patient_access(patient_id, current_user, db)
    
    today = today_co()
    
    # Obtener citas futuras del paciente
    upcoming_appointments = db.query(AppointmentDB).filter(
        AppointmentDB.patient_id == patient_id,
        AppointmentDB.date >= today,
        AppointmentDB.status != "cancelada"
    ).order_by(
        AppointmentDB.date.asc(),
        AppointmentDB.time.asc()
    ).all()
    
    nutritionist_db = db.query(UserDB).filter(UserDB.id == current_user.id).first() if current_user.role == "admin" else None
    if not nutritionist_db:
        patient = db.query(UserDB).filter(UserDB.id == patient_id, UserDB.role == "patient").first()
        if patient and patient.nutritionist_id:
            nutritionist_db = db.query(UserDB).filter(UserDB.id == patient.nutritionist_id, UserDB.role == "admin").first()

    doctor_name = f"{nutritionist_db.nombres} {nutritionist_db.apellidos}" if nutritionist_db else "Dra. María García"
    
    results = []
    for appointment in upcoming_appointments:
        title = "Videollamada" if appointment.type == "videollamada" else "Consulta Presencial"
        results.append({
            "id": appointment.id,
            "date": appointment.date.strftime("%d %b %Y"),
            "time": appointment.time,
            "doctor": doctor_name,
            "type": title,
            "duration": appointment.duration,
            "mode": "video" if appointment.type == "videollamada" else "presencial",
            "status": "confirmed" if appointment.status == "confirmada" else "pending",
            "notes": appointment.notes,
            "meeting_link": appointment.meeting_link if appointment.type == "videollamada" else None
        })
    
    return results

@app.get("/api/patients/{patient_id}/appointments/past")
def get_patient_past_appointments(
    patient_id: int,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """
    Obtener el historial de citas pasadas de un paciente
    """
    authorize_patient_access(patient_id, current_user, db)
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    today = today_co()
    
    # Obtener citas pasadas
    past_appointments = db.query(AppointmentDB).filter(
        AppointmentDB.patient_id == patient_id,
        AppointmentDB.date < today
    ).order_by(
        AppointmentDB.date.desc(),
        AppointmentDB.time.desc()
    ).limit(limit).all()
    
    nutritionist_db = db.query(UserDB).filter(UserDB.id == current_user.id).first() if current_user.role == "admin" else None
    if not nutritionist_db:
        if patient and patient.nutritionist_id:
            nutritionist_db = db.query(UserDB).filter(UserDB.id == patient.nutritionist_id, UserDB.role == "admin").first()

    doctor_name = f"{nutritionist_db.nombres} {nutritionist_db.apellidos}" if nutritionist_db else "Dra. María García"
    
    results = []
    for appointment in past_appointments:
        title = "Videollamada" if appointment.type == "videollamada" else "Consulta Presencial"
        results.append({
            "id": appointment.id,
            "date": appointment.date.strftime("%d %b %Y"),
            "time": appointment.time,
            "duration": appointment.duration,
            "doctor": doctor_name,
            "type": title,
            "mode": "video" if appointment.type == "videollamada" else "presencial",
            "status": appointment.status,
            "notes": appointment.notes
        })
    
    return results

@app.get("/api/patients/{patient_id}/nutritionist")
def get_patient_nutritionist(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """
    Obtener información del nutricionista asignado al paciente
    """
    authorize_patient_access(patient_id, current_user, db)
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    nutritionist_db = None
    if patient.nutritionist_id:
        nutritionist_db = db.query(UserDB).filter(UserDB.id == patient.nutritionist_id, UserDB.role == "admin").first()
    if not nutritionist_db:
        nutritionist_db = db.query(UserDB).filter(UserDB.role == "admin").first()
    
    if not nutritionist_db:
        # Fallback si no hay admin
        return {
            "id": 1,
            "name": "Dra. María García",
            "title": "Nutricionista Clínica",
            "verified": True,
            "patients_count": 500,
            "photo": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&h=200&fit=crop&crop=face",
            "phone": "+34 612 345 678",
            "email": "maria.garcia@clinica.com"
        }
    
    # Contar pacientes reales del nutricionista
    patients_count = db.query(UserDB).filter(UserDB.role == "patient", UserDB.nutritionist_id == nutritionist_db.id).count()
    
    return {
        "id": nutritionist_db.id,
        "name": f"{nutritionist_db.nombres} {nutritionist_db.apellidos}",
        "title": "Nutricionista Especializado",
        "verified": True,
        "patients_count": patients_count,
        "photo": nutritionist_db.foto_perfil or "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&h=200&fit=crop&crop=face",
        "phone": nutritionist_db.telefono,
        "email": nutritionist_db.email
    }

@app.post("/api/patients/{patient_id}/appointments/request")
def request_appointment(
    patient_id: int,
    appointment_data: dict,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """
    Solicitar una nueva cita (paciente)
    """
    authorize_patient_access(patient_id, current_user, db)
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    # Crear la solicitud de cita con estado pendiente
    try:
        appointment_date = datetime.strptime(appointment_data.get("date"), "%Y-%m-%d").date()
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Formato de fecha inválido")
    
    duration = appointment_data.get("duration", "30 min")
    time_str = appointment_data.get("time")
    if not time_str:
        raise HTTPException(status_code=400, detail="La hora es requerida")

    nutritionist_id = patient.nutritionist_id
    if has_appointment_time_conflict(
        db,
        appointment_date,
        time_str,
        duration,
        nutritionist_id=nutritionist_id,
    ):
        raise HTTPException(
            status_code=400,
            detail="El horario seleccionado no está disponible"
        )
    
    now = now_co().strftime("%Y-%m-%d %H:%M:%S")
    
    new_appointment = AppointmentDB(
        patient_id=patient_id,
        patient_name=f"{patient.nombres} {patient.apellidos}",
        date=appointment_date,
        time=time_str,
        duration=duration,
        type=appointment_data.get("type", "presencial"),
        status="pendiente",
        notes=appointment_data.get("notes"),
        created_at=now,
        updated_at=now
    )
    
    db.add(new_appointment)
    db.commit()
    db.refresh(new_appointment)
    
    # Notificar al nutricionista asignado (fallback: primer admin / env)
    nutritionist = None
    if patient.nutritionist_id:
        nutritionist = db.query(UserDB).filter(
            UserDB.id == patient.nutritionist_id,
            UserDB.role.in_(["admin", "superadmin"]),
        ).first()
    if not nutritionist:
        nutritionist = db.query(UserDB).filter(
            UserDB.role.in_(["admin", "superadmin"]),
            UserDB.telefono != None,
        ).first()

    target_phone = (nutritionist.telefono if nutritionist else None) or os.getenv("ADMIN_WHATSAPP_NUMBER")
    
    if target_phone:
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8080").rstrip("/")
        msg = (
            f"🔔 NUEVA SOLICITUD DE CITA\n\n"
            f"Paciente: {patient.nombres} {patient.apellidos}\n"
            f"📅 Fecha: {appointment_date.strftime('%d/%m/%Y')}\n"
            f"⏰ Hora: {new_appointment.time}\n"
            f"📝 Nota: {new_appointment.notes or 'Sin observaciones'}\n\n"
            f"Revisa el panel: {frontend_url}/appointments"
        )
        send_whatsapp_notification(target_phone, msg)

    
    return {
        "success": True,
        "message": "Solicitud de cita enviada. Recibirás confirmación pronto.",
        "appointment": {
            "id": new_appointment.id,
            "date": new_appointment.date.strftime("%Y-%m-%d"),
            "time": new_appointment.time,
            "status": new_appointment.status
        }
    }

@app.patch("/api/patients/{patient_id}/appointments/{appointment_id}/reschedule")
def reschedule_appointment(
    patient_id: int,
    appointment_id: int,
    reschedule_data: dict,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """
    Reprogramar una cita existente (paciente)
    """
    authorize_patient_access(patient_id, current_user, db)
    # Verificar que la cita existe y pertenece al paciente
    appointment = db.query(AppointmentDB).filter(
        AppointmentDB.id == appointment_id,
        AppointmentDB.patient_id == patient_id
    ).first()
    
    if not appointment:
        raise HTTPException(
            status_code=404,
            detail="Cita no encontrada o no pertenece a este paciente"
        )
    
    # No permitir reprogramar citas ya completadas
    if appointment.date < today_co():
        raise HTTPException(
            status_code=400,
            detail="No se pueden reprogramar citas pasadas"
        )
    
    try:
        new_date = datetime.strptime(reschedule_data.get("date"), "%Y-%m-%d").date()
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Formato de fecha inválido")
    
    new_time = reschedule_data.get("time")
    if not new_time:
        raise HTTPException(status_code=400, detail="La hora es requerida")

    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    
    # Verificar que el nuevo horario esté disponible (solape por duración)
    if has_appointment_time_conflict(
        db,
        new_date,
        new_time,
        appointment.duration,
        exclude_id=appointment_id,
        nutritionist_id=patient.nutritionist_id if patient else None,
    ):
        raise HTTPException(
            status_code=400,
            detail="El nuevo horario seleccionado no está disponible"
        )
    
    # Actualizar la cita
    appointment.date = new_date
    appointment.time = new_time
    appointment.status = "pendiente"  # Volver a pendiente para confirmación
    appointment.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
    
    db.commit()
    db.refresh(appointment)
    
    return {
        "success": True,
        "message": "Cita reprogramada exitosamente",
        "appointment": {
            "id": appointment.id,
            "date": appointment.date.strftime("%Y-%m-%d"),
            "time": appointment.time,
            "status": appointment.status
        }
    }

@app.delete("/api/patients/{patient_id}/appointments/{appointment_id}/cancel")
def cancel_appointment_patient(
    patient_id: int,
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """
    Cancelar una cita (paciente)
    """
    authorize_patient_access(patient_id, current_user, db)
    appointment = db.query(AppointmentDB).filter(
        AppointmentDB.id == appointment_id,
        AppointmentDB.patient_id == patient_id
    ).first()
    
    if not appointment:
        raise HTTPException(
            status_code=404,
            detail="Cita no encontrada o no pertenece a este paciente"
        )
    
    # Verificar que la cita no sea en el pasado
    if appointment.date < today_co():
        raise HTTPException(
            status_code=400,
            detail="No se pueden cancelar citas pasadas"
        )
    
    # Verificar que no sea una cita muy próxima (opcional, menos de 24 horas)
    hours_until = (datetime.combine(appointment.date, datetime.strptime(appointment.time, "%H:%M").time()) - now_co()).total_seconds() / 3600
    
    if hours_until < 24:
        # Aún permitir cancelación pero con advertencia
        pass
    
    appointment.status = "cancelada"
    appointment.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
    
    db.commit()
    
    return {
        "success": True,
        "message": "Cita cancelada exitosamente"
    }

@app.get("/api/patients/{patient_id}/appointments/stats")
def get_patient_appointment_stats(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """
    Obtener estadísticas de citas del paciente
    """
    authorize_patient_access(patient_id, current_user, db)
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    today = today_co()
    
    # Total de citas
    total_appointments = db.query(AppointmentDB).filter(
        AppointmentDB.patient_id == patient_id
    ).count()
    
    # Citas completadas (pasadas y no canceladas)
    completed = db.query(AppointmentDB).filter(
        AppointmentDB.patient_id == patient_id,
        AppointmentDB.date < today,
        AppointmentDB.status != "cancelada"
    ).count()
    
    # Próximas citas
    upcoming = db.query(AppointmentDB).filter(
        AppointmentDB.patient_id == patient_id,
        AppointmentDB.date >= today,
        AppointmentDB.status != "cancelada"
    ).count()
    
    # Citas canceladas
    cancelled = db.query(AppointmentDB).filter(
        AppointmentDB.patient_id == patient_id,
        AppointmentDB.status == "cancelada"
    ).count()
    
    # Próxima cita
    next_appointment = db.query(AppointmentDB).filter(
        AppointmentDB.patient_id == patient_id,
        AppointmentDB.date >= today,
        AppointmentDB.status != "cancelada"
    ).order_by(AppointmentDB.date.asc(), AppointmentDB.time.asc()).first()
    
    next_appointment_info = None
    if next_appointment:
        next_appointment_info = {
            "date": next_appointment.date.strftime("%d %b %Y"),
            "time": next_appointment.time,
            "type": next_appointment.notes or "Consulta de seguimiento",
            "mode": "video" if next_appointment.type == "videollamada" else "presencial",
            "meeting_link": next_appointment.meeting_link if next_appointment.type == "videollamada" else None
        }
    
    return {
        "total": total_appointments,
        "completed": completed,
        "upcoming": upcoming,
        "cancelled": cancelled,
        "next_appointment": next_appointment_info
    }

@app.get("/api/patients/{patient_id}/available-times")
def get_available_times_for_patient(
    patient_id: int,
    date: str,
    duration: Optional[str] = "30 min",
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """
    Obtener horarios disponibles para una fecha específica (vista del paciente)
    """
    authorize_patient_access(patient_id, current_user, db)
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido")
    
    # No permitir fechas pasadas
    if target_date < today_co():
        raise HTTPException(status_code=400, detail="No se pueden agendar citas en fechas pasadas")
    
    available_slots_list, _occupied = compute_available_slots_for_date(
        db,
        target_date,
        duration=duration or "30 min",
        nutritionist_id=patient.nutritionist_id,
    )
    available_set = set(available_slots_list)
    
    available_slots = []
    for slot in STANDARD_APPOINTMENT_SLOTS:
        is_available = slot in available_set
        available_slots.append({
            "time": slot,
            "available": is_available,
            "formatted": datetime.strptime(slot, "%H:%M").strftime("%I:%M %p")
        })
    
    return {
        "date": date,
        "slots": available_slots,
        "total_available": len(available_slots_list)
    }

# ==================== ENDPOINT ADICIONAL PARA DASHBOARD ====================

@app.get("/api/patients/{patient_id}/dashboard/summary")
def get_patient_dashboard_summary(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """
    Obtener resumen completo del dashboard del paciente
    """
    authorize_patient_access(patient_id, current_user, db)
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    today = today_co()
    
    # Próxima cita
    next_appointment = db.query(AppointmentDB).filter(
        AppointmentDB.patient_id == patient_id,
        AppointmentDB.date >= today,
        AppointmentDB.status != "cancelada"
    ).order_by(AppointmentDB.date.asc(), AppointmentDB.time.asc()).first()
    
    # Plan activo
    active_plan = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.patient_id == patient_id,
        PatientMealPlanDB.status == "active"
    ).order_by(PatientMealPlanDB.id.desc()).first()
    
    plan_info = None
    if active_plan:
        plan = db.query(MealPlanDB).filter(MealPlanDB.id == active_plan.meal_plan_id).first()
        if plan:
            plan_info = {
                "name": plan.name,
                "calories": plan.calories,
                "start_date": active_plan.start_date,
                "current_week": active_plan.current_week
            }
    
    # Progreso reciente
    recent_metric = db.query(ProgressMetricDB).filter(
        ProgressMetricDB.patient_id == patient_id
    ).order_by(ProgressMetricDB.date.desc()).first()
    
    progress_info = None
    if recent_metric:
        initial_weight = get_initial_weight(patient_id, db)
        current_weight = patient.peso_actual or recent_metric.weight
        progress_info = {
            "current_weight": current_weight,
            "initial_weight": initial_weight,
            "goal_weight": patient.peso_objetivo,
            "last_update": recent_metric.date.strftime("%Y-%m-%d"),
            "progress_percentage": calcular_progreso(current_weight, patient.peso_objetivo, patient.peso_inicial or initial_weight)
        }
    
    return {
        "patient_info": {
            "id": patient.id,
            "name": f"{patient.nombres} {patient.apellidos}",
            "email": patient.email,
            "photo": get_absolute_url(patient.foto_perfil)
        },
        "next_appointment": {
            "date": next_appointment.date.strftime("%d %b %Y") if next_appointment else None,
            "time": next_appointment.time if next_appointment else None,
            "type": next_appointment.type if next_appointment else None
        } if next_appointment else None,
        "active_plan": plan_info,
        "progress": progress_info
    }

@app.get("/api/admin/profile/{user_id}", response_model=AdminProfileResponse)
def get_admin_profile(user_id: int, db: Session = Depends(get_db)):
    """Obtener perfil del administrador"""
    user = db.query(UserDB).filter(
        UserDB.id == user_id,
        UserDB.role.in_(["admin", "superadmin"])
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Administrador no encontrado")
    
    # Obtener perfil extendido
    admin_profile = db.query(AdminProfileDB).filter(
        AdminProfileDB.user_id == user_id
    ).first()
    
    return {
        "id": user.id,
        "name": f"{user.nombres} {user.apellidos}",
        "email": user.email,
        "phone": user.telefono,
        "specialty": admin_profile.specialty if admin_profile else None,
        "license": admin_profile.license if admin_profile else None,
        "bio": admin_profile.bio if admin_profile else None,
        "address": user.direccion,
        "avatar": user.foto_perfil
    }

@app.put("/api/admin/profile/{user_id}")
def update_admin_profile(
    user_id: int, 
    profile_data: AdminProfileUpdate, 
    db: Session = Depends(get_db)
):
    """Actualizar perfil del administrador"""
    user = db.query(UserDB).filter(
        UserDB.id == user_id,
        UserDB.role.in_(["admin", "superadmin"])
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Administrador no encontrado")
    
    # Separar nombre completo
    name_parts = profile_data.name.split(" ", 1)
    user.nombres = name_parts[0]
    user.apellidos = name_parts[1] if len(name_parts) > 1 else ""
    
    # Verificar si el email ya existe (si cambió)
    if profile_data.email != user.email:
        existing_user = db.query(UserDB).filter(
            UserDB.email == profile_data.email,
            UserDB.id != user_id
        ).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="El email ya está en uso")
        user.email = profile_data.email
    
    user.telefono = profile_data.phone
    user.direccion = profile_data.address
    user.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
    
    # Obtener o crear perfil extendido
    admin_profile = db.query(AdminProfileDB).filter(
        AdminProfileDB.user_id == user_id
    ).first()
    
    if not admin_profile:
        admin_profile = AdminProfileDB(
            user_id=user_id,
            specialty=profile_data.specialty,
            license=profile_data.license,
            bio=profile_data.bio
        )
        db.add(admin_profile)
    else:
        admin_profile.specialty = profile_data.specialty
        admin_profile.license = profile_data.license
        admin_profile.bio = profile_data.bio
    
    try:
        db.commit()
        db.refresh(user)
        return {
            "success": True,
            "message": "Perfil actualizado correctamente"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al actualizar perfil: {str(e)}")

@app.post("/api/admin/profile/{user_id}/upload-avatar")
async def upload_admin_avatar(
    user_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Subir foto de perfil del administrador"""
    user = db.query(UserDB).filter(
        UserDB.id == user_id,
        UserDB.role.in_(["admin", "superadmin"])
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Administrador no encontrado")
    
    # Validar tipo de archivo
    allowed_extensions = ["jpg", "jpeg", "png", "gif"]
    file_extension = file.filename.split(".")[-1].lower()
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail="Formato de archivo no válido. Use JPG, PNG o GIF"
        )
    
    # Validar tamaño (máximo 2MB)
    contents = await file.read()
    if len(contents) > 2 * 1024 * 1024:  # 2MB
        raise HTTPException(
            status_code=400,
            detail="El archivo es demasiado grande. Máximo 2MB"
        )
    
    # Guardar archivo
    file_name = f"admin_{user_id}_avatar.{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, file_name)
    
    with open(file_path, "wb") as buffer:
        buffer.write(contents)
    
    # Actualizar URL de foto
    user.foto_perfil = f"/uploads/{file_name}"
    db.commit()
    
    return {
        "success": True,
        "avatar_url": get_absolute_url(user.foto_perfil)
    }

@app.post("/api/admin/profile/{user_id}/change-password")
def change_admin_password(
    user_id: int,
    password_data: PasswordChangeSchema,
    db: Session = Depends(get_db)
):
    """Cambiar contraseña del administrador"""
    user = db.query(UserDB).filter(
        UserDB.id == user_id,
        UserDB.role.in_(["admin", "superadmin"])
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Administrador no encontrado")
    
    # Verificar contraseña actual
    if not pwd_context.verify(password_data.current_password, user.password):
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
    
    # Verificar que las contraseñas nuevas coincidan
    if password_data.new_password != password_data.confirm_password:
        raise HTTPException(status_code=400, detail="Las contraseñas no coinciden")
    
    # Validar longitud de nueva contraseña
    if len(password_data.new_password) < 6:
        raise HTTPException(
            status_code=400, 
            detail="La contraseña debe tener al menos 6 caracteres"
        )
    
    # Actualizar contraseña
    user.password = pwd_context.hash(password_data.new_password)
    user.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
    
    db.commit()
    
    return {
        "success": True,
        "message": "Contraseña actualizada correctamente"
    }

@app.get("/api/admin/notifications/{user_id}", response_model=NotificationSettingsResponse)
def get_notification_settings(user_id: int, db: Session = Depends(get_db)):
    """Obtener configuración de notificaciones"""
    user = db.query(UserDB).filter(
        UserDB.id == user_id,
        UserDB.role.in_(["admin", "superadmin"])
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Administrador no encontrado")
    
    # Obtener o crear configuración
    settings = db.query(AdminNotificationSettingsDB).filter(
        AdminNotificationSettingsDB.user_id == user_id
    ).first()
    
    if not settings:
        # Crear configuración por defecto
        settings = AdminNotificationSettingsDB(
            user_id=user_id,
            email_appointments=1,
            email_messages=1,
            email_marketing=0,
            push_appointments=1,
            push_messages=1,
            sms_reminders=1
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return {
        "emailAppointments": bool(settings.email_appointments),
        "emailMessages": bool(settings.email_messages),
        "emailMarketing": bool(settings.email_marketing),
        "pushAppointments": bool(settings.push_appointments),
        "pushMessages": bool(settings.push_messages),
        "smsReminders": bool(settings.sms_reminders)
    }

@app.put("/api/admin/notifications/{user_id}")
def update_notification_settings(
    user_id: int,
    settings_data: NotificationSettingsUpdate,
    db: Session = Depends(get_db)
):
    """Actualizar configuración de notificaciones"""
    user = db.query(UserDB).filter(
        UserDB.id == user_id,
        UserDB.role.in_(["admin", "superadmin"])
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Administrador no encontrado")
    
    settings = db.query(AdminNotificationSettingsDB).filter(
        AdminNotificationSettingsDB.user_id == user_id
    ).first()
    
    if not settings:
        settings = AdminNotificationSettingsDB(user_id=user_id)
        db.add(settings)
    
    settings.email_appointments = int(settings_data.emailAppointments)
    settings.email_messages = int(settings_data.emailMessages)
    settings.email_marketing = int(settings_data.emailMarketing)
    settings.push_appointments = int(settings_data.pushAppointments)
    settings.push_messages = int(settings_data.pushMessages)
    settings.sms_reminders = int(settings_data.smsReminders)
    
    db.commit()
    
    return {
        "success": True,
        "message": "Preferencias de notificaciones guardadas"
    }

@app.get("/api/admin/appearance/{user_id}", response_model=AppearanceSettingsResponse)
def get_appearance_settings(user_id: int, db: Session = Depends(get_db)):
    """Obtener configuración de apariencia"""
    user = db.query(UserDB).filter(
        UserDB.id == user_id,
        UserDB.role.in_(["admin", "superadmin"])
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Administrador no encontrado")
    
    settings = db.query(AdminAppearanceSettingsDB).filter(
        AdminAppearanceSettingsDB.user_id == user_id
    ).first()
    
    if not settings:
        # Crear configuración por defecto
        settings = AdminAppearanceSettingsDB(
            user_id=user_id,
            theme="light",
            language="es",
            date_format="dd/MM/yyyy",
            time_format="24h"
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return {
        "theme": settings.theme,
        "language": settings.language,
        "dateFormat": settings.date_format,
        "timeFormat": settings.time_format
    }

@app.put("/api/admin/appearance/{user_id}")
def update_appearance_settings(
    user_id: int,
    settings_data: AppearanceSettingsUpdate,
    db: Session = Depends(get_db)
):
    """Actualizar configuración de apariencia"""
    user = db.query(UserDB).filter(
        UserDB.id == user_id,
        UserDB.role.in_(["admin", "superadmin"])
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Administrador no encontrado")
    
    settings = db.query(AdminAppearanceSettingsDB).filter(
        AdminAppearanceSettingsDB.user_id == user_id
    ).first()
    
    if not settings:
        settings = AdminAppearanceSettingsDB(user_id=user_id)
        db.add(settings)
    
    # Validar valores
    valid_themes = ["light", "dark", "system"]
    valid_languages = ["es", "en", "pt"]
    valid_date_formats = ["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"]
    valid_time_formats = ["24h", "12h"]
    
    if settings_data.theme not in valid_themes:
        raise HTTPException(status_code=400, detail="Tema no válido")
    if settings_data.language not in valid_languages:
        raise HTTPException(status_code=400, detail="Idioma no válido")
    if settings_data.dateFormat not in valid_date_formats:
        raise HTTPException(status_code=400, detail="Formato de fecha no válido")
    if settings_data.timeFormat not in valid_time_formats:
        raise HTTPException(status_code=400, detail="Formato de hora no válido")
    
    settings.theme = settings_data.theme
    settings.language = settings_data.language
    settings.date_format = settings_data.dateFormat
    settings.time_format = settings_data.timeFormat
    
    db.commit()
    
    return {
        "success": True,
        "message": "Preferencias de apariencia guardadas"
    }

@app.get("/api/admin/billing/{user_id}")
def get_billing_info_legacy(user_id: int, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    """Redirige a facturación real del nutricionista autenticado."""
    if current_user.id != user_id and current_user.role != "superadmin":
        raise HTTPException(status_code=403, detail="No autorizado")
    target = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    from billing_module import get_active_subscription, _ensure_default_plans, _serialize_plan, _serialize_subscription, _serialize_invoice
    _ensure_default_plans(db, now_co)
    sub = get_active_subscription(db, "nutritionist", user_id)
    if not sub and OrganizationMemberDB:
        om = db.query(OrganizationMemberDB).filter(OrganizationMemberDB.user_id == user_id).first()
        if om:
            sub = get_active_subscription(db, "organization", om.organization_id)
    plan = db.query(BillingPlanDB).filter(BillingPlanDB.id == sub.plan_id).first() if sub else db.query(BillingPlanDB).filter(BillingPlanDB.code == "basic").first()
    invoices = db.query(InvoiceDB).filter(InvoiceDB.subscription_id == sub.id).order_by(InvoiceDB.id.desc()).limit(12).all() if sub else []
    return {
        "plan": {
            "name": plan.name if plan else "Sin plan",
            "description": f"Hasta {plan.max_patients if plan else 0} pacientes",
            "price": (plan.price_monthly_cop or 0) / 1000 if plan else 0,
            "currency": "COP",
            "billing_cycle": sub.billing_cycle if sub else "monthly",
        },
        "payment_method": {"type": sub.payment_provider if sub else "manual", "brand": (sub.payment_provider or "").upper(), "last4": "****"},
        "invoices": [
            {
                "id": i.id,
                "date": (i.paid_at or i.created_at or "")[:10],
                "amount": i.amount_cop,
                "status": i.status,
                "invoice_url": f"/api/superadmin/billing/invoices/{i.id}/pdf",
            }
            for i in invoices
        ],
    }

@app.get("/api/admin/settings/complete/{user_id}")
def get_complete_settings(user_id: int, db: Session = Depends(get_db)):
    """Obtener toda la configuración del administrador en una sola llamada"""
    user = db.query(UserDB).filter(
        UserDB.id == user_id,
        UserDB.role.in_(["admin", "superadmin"])
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Administrador no encontrado")
    
    # Obtener perfil
    admin_profile = db.query(AdminProfileDB).filter(
        AdminProfileDB.user_id == user_id
    ).first()
    
    # Obtener notificaciones
    notifications = db.query(AdminNotificationSettingsDB).filter(
        AdminNotificationSettingsDB.user_id == user_id
    ).first()
    
    # Obtener apariencia
    appearance = db.query(AdminAppearanceSettingsDB).filter(
        AdminAppearanceSettingsDB.user_id == user_id
    ).first()
    
    return {
        "profile": {
            "id": user.id,
            "name": f"{user.nombres} {user.apellidos}",
            "email": user.email,
            "phone": user.telefono,
            "specialty": admin_profile.specialty if admin_profile else None,
            "license": admin_profile.license if admin_profile else None,
            "bio": admin_profile.bio if admin_profile else None,
            "address": user.direccion,
            "avatar": user.foto_perfil
        },
        "notifications": {
            "emailAppointments": bool(notifications.email_appointments) if notifications else True,
            "emailMessages": bool(notifications.email_messages) if notifications else True,
            "emailMarketing": bool(notifications.email_marketing) if notifications else False,
            "pushAppointments": bool(notifications.push_appointments) if notifications else True,
            "pushMessages": bool(notifications.push_messages) if notifications else True,
            "smsReminders": bool(notifications.sms_reminders) if notifications else True
        },
        "appearance": {
            "theme": appearance.theme if appearance else "light",
            "language": appearance.language if appearance else "es",
            "dateFormat": appearance.date_format if appearance else "dd/MM/yyyy",
            "timeFormat": appearance.time_format if appearance else "24h"
        }
    }

# ==================== ENDPOINTS DE CONFIGURACIÓN PARA PACIENTES ====================

# Modelos de base de datos para configuración de pacientes
class PatientNotificationSettingsDB(Base):
    __tablename__ = "patient_notification_settings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    email_reminders = Column(Integer, default=1)
    push_meals = Column(Integer, default=1)
    push_appointments = Column(Integer, default=1)
    sms_reminders = Column(Integer, default=0)
    weekly_report = Column(Integer, default=1)
    tips = Column(Integer, default=1)
    
    user = relationship("UserDB", foreign_keys=[user_id])

class PatientAppearanceSettingsDB(Base):
    __tablename__ = "patient_appearance_settings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    theme = Column(String(20), default="light")
    language = Column(String(10), default="es")
    units = Column(String(20), default="metric")
    date_format = Column(String(20), default="dd-mm-yyyy")
    
    user = relationship("UserDB", foreign_keys=[user_id])

# Modelo para configuración del sistema (superadmin)
DEFAULT_HERO_IMAGE = "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=2000&q=80"


class SystemSettingsDB(Base):
    __tablename__ = "system_settings"
    id = Column(Integer, primary_key=True, index=True)
    
    site_name = Column(String(100), default="NutriData")
    support_email = Column(String(100), default="soporte@nutridata.com")
    max_users_per_org = Column(Integer, default=100)
    max_patients_per_nutritionist = Column(Integer, default=50)
    enable_registration = Column(Integer, default=1)
    require_email_verification = Column(Integer, default=1)
    enable_two_factor = Column(Integer, default=0)
    maintenance_mode = Column(Integer, default=0)
    maintenance_message = Column(Text, nullable=True)
    feature_flags_global = Column(JSON, nullable=True)
    runtime_config = Column(JSON, nullable=True)
    email_notifications = Column(Integer, default=1)
    slack_notifications = Column(Integer, default=0)
    hero_image = Column(String(500), nullable=True)
    audit_retention_days = Column(Integer, default=180)
    personal_data_retention_days = Column(Integer, default=365)
    updated_at = Column(String(50))

# Crear las tablas
safe_create_all()

# Migración: columna hero_image en system_settings
try:
    if _DB_AVAILABLE is not False:
        _inspector = inspect(engine)
        if "system_settings" in _inspector.get_table_names():
            _cols = {c["name"] for c in _inspector.get_columns("system_settings")}
            if "hero_image" not in _cols:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE system_settings ADD COLUMN hero_image VARCHAR(500) NULL"))
except Exception as _mig_err:
    print(f"[MIGRATE] system_settings.hero_image: {_mig_err}")

# Migración: columna audit_retention_days en system_settings
try:
    if _DB_AVAILABLE is not False:
        _inspector = inspect(engine)
        if "system_settings" in _inspector.get_table_names():
            _cols = {c["name"] for c in _inspector.get_columns("system_settings")}
            if "audit_retention_days" not in _cols:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE system_settings ADD COLUMN audit_retention_days INTEGER DEFAULT 180"))
except Exception as _mig_err:
    print(f"[MIGRATE] system_settings.audit_retention_days: {_mig_err}")

# Migración: personal_data_retention_days
try:
    if _DB_AVAILABLE is not False:
        _inspector = inspect(engine)
        if "system_settings" in _inspector.get_table_names():
            _cols = {c["name"] for c in _inspector.get_columns("system_settings")}
            if "personal_data_retention_days" not in _cols:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE system_settings ADD COLUMN personal_data_retention_days INTEGER DEFAULT 365"))
except Exception as _mig_err:
    print(f"[MIGRATE] system_settings.personal_data_retention_days: {_mig_err}")

# Migración: configuración avanzada (flags, runtime, mantenimiento)
try:
    if _DB_AVAILABLE is not False:
        _inspector = inspect(engine)
        if "system_settings" in _inspector.get_table_names():
            _cols = {c["name"] for c in _inspector.get_columns("system_settings")}
            for _col, _sql in [
                ("maintenance_message", "TEXT NULL"),
                ("feature_flags_global", "JSON NULL"),
                ("runtime_config", "JSON NULL"),
            ]:
                if _col not in _cols:
                    with engine.begin() as conn:
                        conn.execute(text(f"ALTER TABLE system_settings ADD COLUMN {_col} {_sql}"))
except Exception as _mig_err:
    print(f"[MIGRATE] system_settings config: {_mig_err}")

# Migración: columnas admin_profiles (licencia, invitación)
try:
    if _DB_AVAILABLE is not False:
        _inspector = inspect(engine)
        if "admin_profiles" in _inspector.get_table_names():
            _cols = {c["name"] for c in _inspector.get_columns("admin_profiles")}
            for _col, _sql in [
                ("license_expiry", "VARCHAR(20) NULL"),
                ("invited_at", "VARCHAR(50) NULL"),
                ("invite_expires_at", "VARCHAR(50) NULL"),
            ]:
                if _col not in _cols:
                    with engine.begin() as conn:
                        conn.execute(text(f"ALTER TABLE admin_profiles ADD COLUMN {_col} {_sql}"))
except Exception as _mig_err:
    print(f"[MIGRATE] admin_profiles license/invite: {_mig_err}")

# Migración: CMS artículos (SEO, programación, analytics) + categorías
try:
    if _DB_AVAILABLE is not False:
        _inspector = inspect(engine)
        if "articles" in _inspector.get_table_names():
            _cols = {c["name"] for c in _inspector.get_columns("articles")}
            for _col, _sql in [
                ("slug", "VARCHAR(280) NULL"),
                ("meta_description", "VARCHAR(320) NULL"),
                ("og_image", "VARCHAR(500) NULL"),
                ("scheduled_publish_at", "VARCHAR(50) NULL"),
                ("view_count", "INTEGER DEFAULT 0"),
            ]:
                if _col not in _cols:
                    with engine.begin() as conn:
                        conn.execute(text(f"ALTER TABLE articles ADD COLUMN {_col} {_sql}"))
        if "article_categories" not in _inspector.get_table_names():
            ArticleCategoryDB.__table__.create(bind=engine, checkfirst=True)
except Exception as _mig_err:
    print(f"[MIGRATE] articles/cms: {_mig_err}")

# Esquemas Pydantic para pacientes
class PatientNotificationSettingsUpdate(BaseModel):
    emailReminders: bool
    pushMeals: bool
    pushAppointments: bool
    smsReminders: bool
    weeklyReport: bool
    tips: bool

class PatientAppearanceSettingsUpdate(BaseModel):
    theme: str
    language: str
    units: str
    dateFormat: str

# Esquemas para superadmin
class SystemSettingsUpdate(BaseModel):
    siteName: str
    supportEmail: str
    maxUsersPerOrg: int
    maxPatientsPerNutritionist: int
    enableRegistration: bool
    requireEmailVerification: bool
    enableTwoFactor: bool
    maintenanceMode: bool
    maintenanceMessage: Optional[str] = None
    emailNotifications: bool
    slackNotifications: bool

@app.get("/api/patient/settings/{user_id}")
def get_patient_settings(user_id: int, db: Session = Depends(get_db)):
    """Obtener toda la configuración del paciente"""
    user = db.query(UserDB).filter(
        UserDB.id == user_id,
        UserDB.role == "patient"
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    # Obtener o crear notificaciones
    notifications = db.query(PatientNotificationSettingsDB).filter(
        PatientNotificationSettingsDB.user_id == user_id
    ).first()
    
    if not notifications:
        notifications = PatientNotificationSettingsDB(
            user_id=user_id,
            email_reminders=1,
            push_meals=1,
            push_appointments=1,
            sms_reminders=0,
            weekly_report=1,
            tips=1
        )
        db.add(notifications)
        db.commit()
        db.refresh(notifications)
    
    # Obtener o crear apariencia
    appearance = db.query(PatientAppearanceSettingsDB).filter(
        PatientAppearanceSettingsDB.user_id == user_id
    ).first()
    
    if not appearance:
        appearance = PatientAppearanceSettingsDB(
            user_id=user_id,
            theme="light",
            language="es",
            units="metric",
            date_format="dd-mm-yyyy"
        )
        db.add(appearance)
        db.commit()
        db.refresh(appearance)
    
    return {
        "profile": {
            "id": user.id,
            "name": f"{user.nombres} {user.apellidos}",
            "email": user.email,
            "phone": user.telefono,
            "avatar": user.foto_perfil
        },
        "notifications": {
            "emailReminders": bool(notifications.email_reminders),
            "pushMeals": bool(notifications.push_meals),
            "pushAppointments": bool(notifications.push_appointments),
            "smsReminders": bool(notifications.sms_reminders),
            "weeklyReport": bool(notifications.weekly_report),
            "tips": bool(notifications.tips)
        },
        "appearance": {
            "theme": appearance.theme,
            "language": appearance.language,
            "units": appearance.units,
            "dateFormat": appearance.date_format
        }
    }

@app.put("/api/patient/notifications/{user_id}")
def update_patient_notifications(
    user_id: int,
    settings_data: PatientNotificationSettingsUpdate,
    db: Session = Depends(get_db)
):
    """Actualizar configuración de notificaciones del paciente"""
    user = db.query(UserDB).filter(
        UserDB.id == user_id,
        UserDB.role == "patient"
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    settings = db.query(PatientNotificationSettingsDB).filter(
        PatientNotificationSettingsDB.user_id == user_id
    ).first()
    
    if not settings:
        settings = PatientNotificationSettingsDB(user_id=user_id)
        db.add(settings)
    
    settings.email_reminders = int(settings_data.emailReminders)
    settings.push_meals = int(settings_data.pushMeals)
    settings.push_appointments = int(settings_data.pushAppointments)
    settings.sms_reminders = int(settings_data.smsReminders)
    settings.weekly_report = int(settings_data.weeklyReport)
    settings.tips = int(settings_data.tips)
    
    db.commit()
    
    return {
        "success": True,
        "message": "Preferencias de notificaciones guardadas"
    }

@app.put("/api/patient/appearance/{user_id}")
def update_patient_appearance(
    user_id: int,
    settings_data: PatientAppearanceSettingsUpdate,
    db: Session = Depends(get_db)
):
    """Actualizar configuración de apariencia del paciente"""
    user = db.query(UserDB).filter(
        UserDB.id == user_id,
        UserDB.role == "patient"
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    settings = db.query(PatientAppearanceSettingsDB).filter(
        PatientAppearanceSettingsDB.user_id == user_id
    ).first()
    
    if not settings:
        settings = PatientAppearanceSettingsDB(user_id=user_id)
        db.add(settings)
    
    settings.theme = settings_data.theme
    settings.language = settings_data.language
    settings.units = settings_data.units
    settings.date_format = settings_data.dateFormat
    
    db.commit()
    
    return {
        "success": True,
        "message": "Preferencias de apariencia guardadas"
    }

@app.post("/api/patient/profile/{user_id}/change-password")
def change_patient_password(
    user_id: int,
    password_data: PasswordChangeSchema,
    db: Session = Depends(get_db)
):
    """Cambiar contraseña del paciente"""
    user = db.query(UserDB).filter(
        UserDB.id == user_id,
        UserDB.role == "patient"
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    # Verificar contraseña actual
    if not pwd_context.verify(password_data.current_password, user.password):
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
    
    # Verificar que las contraseñas nuevas coincidan
    if password_data.new_password != password_data.confirm_password:
        raise HTTPException(status_code=400, detail="Las contraseñas no coinciden")
    
    # Validar longitud de nueva contraseña
    if len(password_data.new_password) < 6:
        raise HTTPException(
            status_code=400,
            detail="La contraseña debe tener al menos 6 caracteres"
        )
    
    # Actualizar contraseña
    user.password = pwd_context.hash(password_data.new_password)
    user.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
    
    db.commit()
    
    return {
        "success": True,
        "message": "Contraseña actualizada correctamente"
    }

# ==================== ENDPOINTS DE CONFIGURACIÓN PARA SUPERADMIN ====================

def _resolve_media_url(path: Optional[str], fallback: str = "") -> str:
    if not path:
        return fallback
    if path.startswith("http://") or path.startswith("https://"):
        return path
    if path.startswith("/uploads/"):
        return f"{BASE_URL.rstrip('/')}{path}"
    return path


def _get_or_create_system_settings(db: Session) -> SystemSettingsDB:
    settings = db.query(SystemSettingsDB).first()
    if settings:
        return settings
    settings = SystemSettingsDB(
        site_name="NutriData",
        support_email="soporte@nutridata.com",
        max_users_per_org=100,
        max_patients_per_nutritionist=50,
        enable_registration=1,
        require_email_verification=1,
        enable_two_factor=0,
        maintenance_mode=0,
        maintenance_message="Estamos realizando mejoras. Vuelve en unos minutos.",
        feature_flags_global={
            "patient_phase_1": True,
            "patient_phase_2": True,
            "patient_phase_3": True,
            "patient_phase_4": True,
            "clinical_colombia": True,
            "pwa_offline": True,
            "wearables": True,
            "gamification": True,
            "nutritionist_advanced_hub": True,
        },
        runtime_config=None,
        email_notifications=1,
        slack_notifications=0,
        hero_image=DEFAULT_HERO_IMAGE,
        updated_at=now_co().strftime("%Y-%m-%d %H:%M:%S"),
    )
    db.add(settings)
    db.commit()
    db.refresh(settings)
    try:
        from config_module import refresh_runtime_cache
        refresh_runtime_cache(settings)
    except Exception:
        pass
    return settings


@app.get("/api/home/hero")
def get_public_home_hero(db: Session = Depends(get_db)):
    """Imagen del hero del home público."""
    settings = db.query(SystemSettingsDB).first()
    raw = (settings.hero_image if settings and settings.hero_image else None) or DEFAULT_HERO_IMAGE
    return {"heroImage": _resolve_media_url(raw, DEFAULT_HERO_IMAGE)}


@app.put("/api/superadmin/home/hero")
async def update_home_hero(
    image_url: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    """Actualizar imagen del hero del home (URL o archivo)."""
    settings = _get_or_create_system_settings(db)

    saved = await _save_recipe_image(image)
    if saved:
        settings.hero_image = saved
    elif image_url is not None:
        cleaned = image_url.strip()
        settings.hero_image = cleaned or DEFAULT_HERO_IMAGE
    else:
        raise HTTPException(status_code=400, detail="Envía una imagen o una URL")

    settings.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
    db.commit()
    db.refresh(settings)
    return {
        "success": True,
        "heroImage": _resolve_media_url(settings.hero_image, DEFAULT_HERO_IMAGE),
        "message": "Imagen del hero actualizada",
    }


@app.get("/api/superadmin/settings/{user_id}")
def get_system_settings(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    """Obtener configuración del sistema (solo superadmin autenticado)."""
    _ = user_id  # compatibilidad con rutas existentes del frontend
    settings = _get_or_create_system_settings(db)
    
    return {
        "siteName": settings.site_name,
        "supportEmail": settings.support_email,
        "maxUsersPerOrg": settings.max_users_per_org,
        "maxPatientsPerNutritionist": settings.max_patients_per_nutritionist,
        "enableRegistration": bool(settings.enable_registration),
        "requireEmailVerification": bool(settings.require_email_verification),
        "enableTwoFactor": bool(settings.enable_two_factor),
        "maintenanceMode": bool(settings.maintenance_mode),
        "maintenanceMessage": getattr(settings, "maintenance_message", None) or "",
        "emailNotifications": bool(settings.email_notifications),
        "slackNotifications": bool(settings.slack_notifications),
        "heroImage": _resolve_media_url(settings.hero_image, DEFAULT_HERO_IMAGE),
    }

@app.put("/api/superadmin/settings/{user_id}")
def update_system_settings(
    user_id: int,
    settings_data: SystemSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    """Actualizar configuración del sistema (solo superadmin autenticado)."""
    _ = user_id
    settings = db.query(SystemSettingsDB).first()
    
    if not settings:
        settings = SystemSettingsDB()
        db.add(settings)
    
    settings.site_name = settings_data.siteName
    settings.support_email = settings_data.supportEmail
    settings.max_users_per_org = settings_data.maxUsersPerOrg
    settings.max_patients_per_nutritionist = settings_data.maxPatientsPerNutritionist
    settings.enable_registration = int(settings_data.enableRegistration)
    settings.require_email_verification = int(settings_data.requireEmailVerification)
    settings.enable_two_factor = int(settings_data.enableTwoFactor)
    settings.maintenance_mode = int(settings_data.maintenanceMode)
    if settings_data.maintenanceMessage is not None:
        settings.maintenance_message = settings_data.maintenanceMessage.strip()
    settings.email_notifications = int(settings_data.emailNotifications)
    settings.slack_notifications = int(settings_data.slackNotifications)
    settings.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
    
    db.commit()
    try:
        from config_module import refresh_runtime_cache
        refresh_runtime_cache(settings)
    except Exception:
        pass
    
    return {
        "success": True,
        "message": "Configuración del sistema actualizada"
    }

# ==================== ENDPOINTS ADICIONALES PARA PORTAL DEL PACIENTE ====================
# Agregar estos endpoints al archivo main.py existente

from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import HTTPException, Depends
from sqlalchemy.orm import Session

# ==================== ENDPOINTS DE DASHBOARD DEL PACIENTE ====================

@app.get("/api/patient/{patient_id}/dashboard")
def get_patient_dashboard(patient_id: int, db: Session = Depends(get_db)):
    """
    Obtener datos completos del dashboard del paciente
    """
    # Verificar que el paciente existe
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    today = today_co()
    
    # 1. Información básica del paciente
    patient_info = {
        "id": patient.id,
        "name": f"{patient.nombres} {patient.apellidos}",
        "email": patient.email,
        "photo": get_absolute_url(patient.foto_perfil),
        "phone": patient.telefono
    }
    
    # 2. Próxima cita
    next_appointment = db.query(AppointmentDB).filter(
        AppointmentDB.patient_id == patient_id,
        AppointmentDB.date >= today,
        AppointmentDB.status != "cancelada"
    ).order_by(AppointmentDB.date.asc(), AppointmentDB.time.asc()).first()
    
    next_appointment_data = None
    if next_appointment:
        days_until = (next_appointment.date - today).days
        if days_until == 0:
            date_label = "Hoy"
        elif days_until == 1:
            date_label = "Mañana"
        else:
            date_label = next_appointment.date.strftime("%d %b %Y")
        
        next_appointment_data = {
            "id": next_appointment.id,
            "date": next_appointment.date.strftime("%d %b %Y"),
            "date_label": date_label,
            "time": next_appointment.time,
            "doctor": "Dra. María García",
            "type": next_appointment.notes or "Consulta de seguimiento",
            "mode": "video" if next_appointment.type == "videollamada" else "presencial",
            "status": "confirmed" if next_appointment.status == "confirmada" else "pending"
        }
    
    # 3. Plan activo
    active_plan = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.patient_id == patient_id,
        PatientMealPlanDB.status == "active"
    ).order_by(PatientMealPlanDB.id.desc()).first()
    
    plan_data = None
    if active_plan:
        plan = db.query(MealPlanDB).filter(MealPlanDB.id == active_plan.meal_plan_id).first()
        if plan:
            # Calcular días transcurridos
            start_date = datetime.strptime(active_plan.start_date, "%Y-%m-%d").date()
            days_elapsed = (today - start_date).days
            
            plan_data = {
                "id": plan.id,
                "name": plan.name,
                "description": plan.description,
                "calories": plan.calories,
                "start_date": active_plan.start_date,
                "current_week": active_plan.current_week,
                "days_elapsed": max(0, days_elapsed),
                "protein": plan.protein_target,
                "carbs": plan.carbs_target,
                "fat": plan.fat_target
            }
    
    # 4. Progreso reciente
    recent_metrics = db.query(ProgressMetricDB).filter(
        ProgressMetricDB.patient_id == patient_id
    ).order_by(ProgressMetricDB.date.desc(), ProgressMetricDB.id.desc()).limit(7).all()
    
    progress_data = None
    if recent_metrics:
        current_metric = recent_metrics[0]
        initial_weight = get_initial_weight(patient_id, db) or current_metric.weight
        goal_weight = patient.peso_objetivo or current_metric.weight
        
        # Calcular tendencia
        trend = calculate_trend(recent_metrics)
        
        # Calcular progreso
        if goal_weight < initial_weight:  # Pérdida de peso
            weight_lost = initial_weight - current_metric.weight
            total_to_lose = initial_weight - goal_weight
            progress_percentage = int((weight_lost / total_to_lose) * 100) if total_to_lose > 0 else 0
        else:  # Ganancia de peso
            weight_gained = current_metric.weight - initial_weight
            total_to_gain = goal_weight - initial_weight
            progress_percentage = int((weight_gained / total_to_gain) * 100) if total_to_gain > 0 else 0
        
        progress_percentage = min(100, max(0, progress_percentage))
        
        progress_data = {
            "current_weight": patient.peso_actual or current_metric.weight,
            "initial_weight": initial_weight,
            "goal_weight": goal_weight,
            "last_update": current_metric.date.strftime("%Y-%m-%d"),
            "progress_percentage": progress_percentage,
            "trend": trend,
            "weight_change": round(current_metric.weight - initial_weight, 1),
            "body_fat": current_metric.body_fat,
            "muscle": current_metric.muscle
        }
    
    # 5. Estadísticas de comidas (mock - puedes implementar esto según tu lógica)
    meals_stats = {
        "today": {
            "completed": 3,
            "total": 6,
            "calories_consumed": 1200,
            "calories_target": plan_data["calories"] if plan_data else 2000
        },
        "week": {
            "adherence": calculate_weekly_adherence(patient_id, db)
        }
    }
    
    # 6. Logros recientes
    recent_achievements = db.query(AchievementDB).filter(
        AchievementDB.patient_id == patient_id
    ).order_by(AchievementDB.achieved_date.desc()).limit(3).all()
    
    achievements_data = [
        {
            "id": a.id,
            "title": a.title,
            "description": a.description,
            "date": a.achieved_date.strftime("%d %b %Y"),
            "icon": a.icon
        }
        for a in recent_achievements
    ]
    
    return {
        "patient": patient_info,
        "next_appointment": next_appointment_data,
        "active_plan": plan_data,
        "progress": progress_data,
        "meals": meals_stats,
        "achievements": achievements_data
    }

# ==================== ENDPOINTS DE COMIDAS ====================

@app.get("/api/patient/{patient_id}/meals/today")
def get_today_meals(patient_id: int, db: Session = Depends(get_db)):
    """
    Obtener las comidas del día actual según el plan del paciente
    """
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    # Obtener plan activo
    active_plan = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.patient_id == patient_id,
        PatientMealPlanDB.status == "active"
    ).order_by(PatientMealPlanDB.id.desc()).first()
    
    if not active_plan:
        return {
            "date": now_co().strftime("%Y-%m-%d"),
            "meals": [],
            "total_calories": 0,
            "message": "No tienes un plan activo asignado"
        }
    
    # Obtener el plan completo
    plan = db.query(MealPlanDB).filter(MealPlanDB.id == active_plan.meal_plan_id).first()
    
    # Obtener el menú de la semana actual
    current_week = active_plan.current_week
    weekly_menu = db.query(WeeklyMenuDB).filter(
        WeeklyMenuDB.meal_plan_id == plan.id,
        WeeklyMenuDB.week_number == current_week
    ).first()
    
    if not weekly_menu:
        return {
            "date": now_co().strftime("%Y-%m-%d"),
            "meals": [],
            "total_calories": 0,
            "message": "No hay menú configurado para esta semana"
        }
    
    # Determinar el día de la semana
    today = now_co()
    day_name = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][today.weekday()]
    
    # Obtener las comidas del día
    day_menu = getattr(weekly_menu, day_name, {})
    
    # Estructura de comidas del día
    meal_times = [
        {"id": "breakfast", "name": "Desayuno", "time": "08:00", "icon": "sun"},
        {"id": "morning_snack", "name": "Snack AM", "time": "10:30", "icon": "apple"},
        {"id": "lunch", "name": "Almuerzo", "time": "13:00", "icon": "utensils"},
        {"id": "afternoon_snack", "name": "Snack PM", "time": "16:00", "icon": "cookie"},
        {"id": "dinner", "name": "Cena", "time": "19:00", "icon": "moon"},
        {"id": "evening_snack", "name": "Snack Noche", "time": "21:00", "icon": "coffee"}
    ]
    
    meals = []
    total_calories = 0
    
    for meal_time in meal_times:
        meal_data = day_menu.get(meal_time["id"], {})
        
        if meal_data:
            calories = meal_data.get("calorias", 0)
            total_calories += calories
            
            meals.append({
                "id": meal_time["id"],
                "name": meal_time["name"],
                "time": meal_time["time"],
                "icon": meal_time["icon"],
                "recipe": meal_data.get("receta", "No asignado"),
                "calories": calories,
                "protein": meal_data.get("proteina", 0),
                "carbs": meal_data.get("carbohidratos", 0),
                "fat": meal_data.get("grasas", 0),
                "completed": False,  # Esto podría venir de una tabla de seguimiento
                "image": meal_data.get("imagen", None)
            })
    
    return {
        "date": today.strftime("%Y-%m-%d"),
        "day_name": ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"][today.weekday()],
        "meals": meals,
        "total_calories": total_calories,
        "target_calories": plan.calories,
        "progress_percentage": int((total_calories / plan.calories) * 100) if plan.calories > 0 else 0
    }

@app.get("/api/patient/{patient_id}/meals/week")
def get_week_meals(patient_id: int, week_offset: int = 0, db: Session = Depends(get_db)):
    """
    Obtener las comidas de toda la semana
    week_offset: 0 = semana actual, -1 = semana anterior, 1 = semana siguiente
    """
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    # Obtener plan activo
    active_plan = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.patient_id == patient_id,
        PatientMealPlanDB.status == "active"
    ).order_by(PatientMealPlanDB.id.desc()).first()
    
    if not active_plan:
        raise HTTPException(status_code=404, detail="No tienes un plan activo")
    
    plan = db.query(MealPlanDB).filter(MealPlanDB.id == active_plan.meal_plan_id).first()
    
    # Calcular la semana a mostrar
    target_week = active_plan.current_week + week_offset
    
    weekly_menu = db.query(WeeklyMenuDB).filter(
        WeeklyMenuDB.meal_plan_id == plan.id,
        WeeklyMenuDB.week_number == target_week
    ).first()
    
    if not weekly_menu:
        raise HTTPException(status_code=404, detail="No hay menú para esta semana")
    
    # Construir la respuesta con todos los días
    days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    day_names = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
    
    week_data = []
    
    for i, day in enumerate(days):
        day_menu = getattr(weekly_menu, day, {})
        
        day_calories = sum([
            day_menu.get("breakfast", {}).get("calorias", 0),
            day_menu.get("morning_snack", {}).get("calorias", 0),
            day_menu.get("lunch", {}).get("calorias", 0),
            day_menu.get("afternoon_snack", {}).get("calorias", 0),
            day_menu.get("dinner", {}).get("calorias", 0),
            day_menu.get("evening_snack", {}).get("calorias", 0)
        ])
        
        week_data.append({
            "day": day_names[i],
            "day_key": day,
            "total_calories": day_calories,
            "meals": day_menu
        })
    
    return {
        "week_number": target_week,
        "plan_name": plan.name,
        "days": week_data,
        "target_calories": plan.calories
    }

@app.post("/api/patient/{patient_id}/meals/{meal_id}/complete")
def complete_meal_legacy_1(patient_id: int, meal_id: str, db: Session = Depends(get_db)):
    """
    Marcar una comida como completada
    Nota: Necesitarías crear una tabla meal_tracking para esto
    """
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    # Aquí implementarías la lógica para guardar el seguimiento
    # Por ahora, retornamos éxito
    
    return {
        "success": True,
        "message": "Comida marcada como completada",
        "meal_id": meal_id,
        "completed_at": now_co().strftime("%Y-%m-%d %H:%M:%S")
    }

# ==================== ENDPOINTS DE PROGRESO DEL PACIENTE ====================

@app.get("/api/patient/{patient_id}/progress")
def get_patient_own_progress(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """
    Obtener el progreso detallado del paciente (vista del paciente)
    """
    authorize_patient_access(patient_id, current_user, db)
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    # Obtener todas las métricas
    all_metrics = db.query(ProgressMetricDB).filter(
        ProgressMetricDB.patient_id == patient_id
    ).order_by(ProgressMetricDB.date.asc(), ProgressMetricDB.id.asc()).all()
    
    if not all_metrics:
        return {
            "has_data": False,
            "message": "Aún no tienes registros de progreso"
        }
    
    # Datos actuales
    current_metric = all_metrics[-1]
    initial_weight = all_metrics[0].weight
    goal_weight = patient.peso_objetivo or current_metric.weight
    
    # Calcular progreso hacia la meta basándose en peso_inicial del usuario si existe
    baseline_weight = patient.peso_inicial if patient.peso_inicial is not None else initial_weight
    
    # Peso para resúmenes (priorizar peso_actual del perfil)
    summary_weight = patient.peso_actual or current_metric.weight
    
    # Calcular cambios (siempre contra el inicial absoluto)
    weight_change = summary_weight - initial_weight
    
    # Calcular progreso hacia la meta
    progress_percentage = calcular_progreso(summary_weight, goal_weight, baseline_weight)
    
    # Preparar datos para gráficos
    chart_data = {
        "weight": [
            {
                "date": m.date.strftime("%d/%m"),
                "value": m.weight,
                "full_date": m.date.strftime("%Y-%m-%d")
            }
            for m in all_metrics
        ],
        "body_composition": [
            {
                "date": m.date.strftime("%d/%m"),
                "body_fat": m.body_fat or 0,
                "muscle": m.muscle or 0,
                "water": m.water or 0,
                "waist": m.waist or 0,
                "hip": m.hip or 0,
                "chest": m.chest or 0,
                "arm": m.arm or 0
            }
            for m in all_metrics if m.body_fat is not None or m.waist is not None
        ]
    }
    
    # Logros
    achievements = db.query(AchievementDB).filter(
        AchievementDB.patient_id == patient_id
    ).order_by(AchievementDB.achieved_date.desc()).all()
    
    achievements_list = [
        {
            "id": a.id,
            "title": a.title,
            "description": a.description,
            "date": a.achieved_date.strftime("%d %b %Y"),
            "icon": a.icon
        }
        for a in achievements
    ]
    
    # Tendencia reciente (últimas 4 semanas)
    recent_metrics = all_metrics[-4:] if len(all_metrics) >= 4 else all_metrics
    trend = calculate_trend(recent_metrics)
    
    return {
        "has_data": True,
        "summary": {
            "current_weight": patient.peso_actual or current_metric.weight,
            "initial_weight": initial_weight,
            "goal_weight": goal_weight,
            "weight_change": round(weight_change, 1),
            "progress_percentage": progress_percentage,
            "trend": trend,
            "edad_formateada": calcular_edad_detallada(patient.fecha_nacimiento),
            "last_update": current_metric.date.strftime("%d %b %Y")
        },
        "body_composition": {
            "body_fat": current_metric.body_fat,
            "muscle": current_metric.muscle,
            "water": current_metric.water,
            "waist": current_metric.waist,
            "hip": current_metric.hip,
            "chest": current_metric.chest,
            "arm": current_metric.arm
        },
        "charts": chart_data,
        "achievements": achievements_list,
        "metrics_count": len(all_metrics),
        "tracking_days": (all_metrics[-1].date - all_metrics[0].date).days
    }

@app.post("/api/patient/{patient_id}/progress/add")
def add_progress_metric_patient(
    patient_id: int,
    metric_data: ProgressMetricCreate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """
    Agregar una nueva métrica de progreso (desde el paciente)
    """
    authorize_patient_access(patient_id, current_user, db)
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    # Asegurarse de que el patient_id coincida
    if metric_data.patient_id != patient_id:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    try:
        metric_date = datetime.strptime(metric_data.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido")
    
    
    # Crear nueva métrica (siempre, para historial detallado)
    new_metric = ProgressMetricDB(
        patient_id=patient_id,
        date=metric_date,
        weight=metric_data.weight,
        body_fat=metric_data.body_fat,
        muscle=metric_data.muscle,
        water=metric_data.water,
        waist=metric_data.waist,
        hip=metric_data.hip,
        chest=metric_data.chest,
        arm=metric_data.arm,
        notes=metric_data.notes,
        created_at=now_co().strftime("%Y-%m-%d %H:%M:%S")
    )
    
    db.add(new_metric)
    
    # Actualizar peso actual del paciente
    patient.peso_actual = metric_data.weight
    
    db.commit()
    db.refresh(new_metric)
    
    # RE-SINCRO: Asegurar que el peso actual del paciente esté actualizado tras agregar métrica (vista paciente)
    patient.peso_actual = metric_data.weight
    db.commit()
    
    return {
        "success": True,
        "message": "Métrica registrada correctamente",
        "metric": {
            "id": new_metric.id,
            "date": new_metric.date.strftime("%Y-%m-%d"),
            "weight": new_metric.weight
        }
    }

# ==================== ENDPOINTS DEL PERFIL DEL PACIENTE ====================

@app.get("/api/patient/{patient_id}/profile/complete")
def get_patient_complete_profile(patient_id: int, db: Session = Depends(get_db)):
    """
    Obtener perfil completo del paciente con toda la información
    """
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    # Plan activo
    active_plan = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.patient_id == patient_id,
        PatientMealPlanDB.status == "active"
    ).order_by(PatientMealPlanDB.id.desc()).first()
    
    plan_name = "Sin plan asignado"
    if active_plan:
        plan = db.query(MealPlanDB).filter(MealPlanDB.id == active_plan.meal_plan_id).first()
        if plan:
            plan_name = plan.name
    
    # Estadísticas
    total_appointments = db.query(AppointmentDB).filter(
        AppointmentDB.patient_id == patient_id
    ).count()
    
    completed_appointments = db.query(AppointmentDB).filter(
        AppointmentDB.patient_id == patient_id,
        AppointmentDB.date < today_co(),
        AppointmentDB.status != "cancelada"
    ).count()
    
    total_metrics = db.query(ProgressMetricDB).filter(
        ProgressMetricDB.patient_id == patient_id
    ).count()
    
    achievements_count = db.query(AchievementDB).filter(
        AchievementDB.patient_id == patient_id
    ).count()
    
    return {
        "personal_info": {
            "id": patient.id,
            "nombres": patient.nombres,
            "apellidos": patient.apellidos,
            "email": patient.email,
            "telefono": patient.telefono,
            "fecha_nacimiento": patient.fecha_nacimiento.strftime("%Y-%m-%d") if patient.fecha_nacimiento else None,
            "edad_formateada": calcular_edad_detallada(patient.fecha_nacimiento),
            "genero": patient.genero,
            "direccion": patient.direccion,
            "foto_perfil": patient.foto_perfil
        },
        "health_info": {
            "altura": patient.altura,
            "peso_actual": patient.peso_actual,
            "peso_objetivo": patient.peso_objetivo,
            "nivel_actividad": patient.nivel_actividad,
            "alergias": patient.alergias or [],
            "preferencias": patient.preferencias or [],
            "objetivos_salud": patient.objetivos_salud,
            "condiciones_medicas": patient.condiciones_medicas,
            "alimentos_disgusto": patient.alimentos_disgusto
        },
        "plan_info": {
            "plan_actual": plan_name,
            "status": patient.status
        },
        "statistics": {
            "total_appointments": total_appointments,
            "completed_appointments": completed_appointments,
            "tracking_days": total_metrics,
            "achievements": achievements_count
        }
    }

@app.post("/api/patient/{patient_id}/upload-avatar")
async def upload_patient_avatar(
    patient_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Subir foto de perfil del paciente (admin dueño o el propio paciente)."""
    authorize_patient_access(patient_id, current_user, db)
    user = db.query(UserDB).filter(
        UserDB.id == patient_id,
        UserDB.role == "patient"
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    await validate_upload_file(file)
    safe = sanitize_filename(file.filename or "avatar.jpg")
    ext = os.path.splitext(safe)[1].lower() or ".jpg"
    file_name = f"patient_{patient_id}_avatar{ext}"
    file_path = os.path.join(UPLOAD_DIR, file_name)

    contents = await file.read()
    with open(file_path, "wb") as buffer:
        buffer.write(contents)
    
    user.foto_perfil = f"/uploads/{file_name}"
    db.commit()
    
    return {
        "success": True,
        "foto_url": get_absolute_url(user.foto_perfil)
    }

@app.put("/api/patient/{patient_id}/profile/update")
def update_patient_own_profile(
    patient_id: int,
    profile_data: ProfileUpdateSchema,
    db: Session = Depends(get_db)
):
    """
    Actualizar perfil del paciente (por el mismo paciente)
    """
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    # Actualizar datos
    patient.nombres = profile_data.nombres
    patient.apellidos = profile_data.apellidos
    patient.telefono = profile_data.telefono
    patient.genero = profile_data.genero
    patient.direccion = profile_data.direccion
    patient.altura = profile_data.altura
    patient.peso_actual = profile_data.peso_actual
    patient.peso_objetivo = profile_data.peso_objetivo
    patient.nivel_actividad = profile_data.nivel_actividad
    patient.alergias = profile_data.alergias
    patient.preferencias = profile_data.preferencias
    patient.objetivos_salud = profile_data.objetivos_salud
    patient.condiciones_medicas = profile_data.condiciones_medicas
    patient.alimentos_disgusto = profile_data.alimentos_disgusto
    
    if profile_data.fecha_nacimiento:
        try:
            patient.fecha_nacimiento = datetime.strptime(profile_data.fecha_nacimiento, "%Y-%m-%d").date()
        except:
            pass
    
    patient.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
    
    db.commit()
    
    return {
        "success": True,
        "message": "Perfil actualizado correctamente"
    }

# ==================== ENDPOINT DE NOTIFICACIONES ====================

@app.get("/api/patient/{patient_id}/notifications")
def get_patient_notifications(patient_id: int, db: Session = Depends(get_db)):
    """
    Obtener notificaciones del paciente
    """
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    today = today_co()
    notifications = []
    
    # Notificación de próxima cita
    next_appointment = db.query(AppointmentDB).filter(
        AppointmentDB.patient_id == patient_id,
        AppointmentDB.date >= today,
        AppointmentDB.status != "cancelada"
    ).order_by(AppointmentDB.date.asc()).first()
    
    if next_appointment:
        days_until = (next_appointment.date - today).days
        if days_until <= 2:
            notifications.append({
                "id": f"apt_{next_appointment.id}",
                "type": "appointment",
                "title": "Próxima cita" if days_until > 0 else "Cita hoy",
                "message": f"Tienes una cita {next_appointment.date.strftime('%d %b')} a las {next_appointment.time}",
                "date": next_appointment.date.strftime("%Y-%m-%d"),
                "priority": "high" if days_until == 0 else "medium",
                "read": False
            })
    
    # Notificación de actualizar peso
    last_metric = db.query(ProgressMetricDB).filter(
        ProgressMetricDB.patient_id == patient_id
    ).order_by(ProgressMetricDB.date.desc()).first()
    
    if last_metric:
        days_since = (today - last_metric.date).days
        if days_since >= 7:
            notifications.append({
                "id": "weight_reminder",
                "type": "reminder",
                "title": "Registra tu peso",
                "message": f"Han pasado {days_since} días desde tu último registro",
                "date": today.strftime("%Y-%m-%d"),
                "priority": "medium",
                "read": False
            })
    
    return {
        "count": len(notifications),
        "notifications": notifications
    }

# ==================== FUNCIONES AUXILIARES ADICIONALES ====================

def calculate_daily_calories_consumed(patient_id: int, date: str, db: Session) -> int:
    """
    Calcular las calorías consumidas en un día específico
    Nota: Necesitarías una tabla de seguimiento de comidas para esto
    """
    # Mock por ahora
    return 0

def get_meal_plan_weekly_menu(plan_id: int, week: int, db: Session):
    """
    Obtener el menú semanal de un plan específico
    """
    return db.query(WeeklyMenuDB).filter(
        WeeklyMenuDB.meal_plan_id == plan_id,
        WeeklyMenuDB.week_number == week
    ).first()

@app.get("/api/patient/{patient_id}/dashboard/complete")
def get_patient_dashboard_complete(patient_id: int, db: Session = Depends(get_db)):
    """
    Endpoint principal del dashboard con toda la información necesaria
    """
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    today = today_co()
    
    # 1. Obtener comidas del día desde el plan activo
    today_meals = get_patient_today_meals(patient_id, today, db)
    
    # 2. Calcular estadísticas de calorías
    completed_meals = [m for m in today_meals if m["completed"]]
    total_calories_consumed = sum(m["calories"] for m in completed_meals)
    total_calories_from_today_meals = sum(m["calories"] for m in today_meals)
    
    # Obtener plan activo para meta de calorías y macronutrientes
    active_plan_assignment = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.patient_id == patient_id,
        PatientMealPlanDB.status == "active"
    ).first()
    plan = None
    if active_plan_assignment:
        plan = db.query(MealPlanDB).filter(
            MealPlanDB.id == active_plan_assignment.meal_plan_id
        ).first()
    
    # Meta diaria: priorizar plan.calories para que siempre haya meta cuando hay plan
    daily_calorie_target = 0
    if plan and (plan.calories or 0) > 0:
        daily_calorie_target = plan.calories
    elif total_calories_from_today_meals > 0:
        daily_calorie_target = total_calories_from_today_meals
    
    # 3. Seguimiento de agua
    water_tracking = db.query(WaterTrackingDB).filter(
        WaterTrackingDB.patient_id == patient_id,
        WaterTrackingDB.date == today
    ).first()
    
    water_consumed = water_tracking.amount_ml if water_tracking else 0
    water_target = water_tracking.target_ml if water_tracking else 2500
    
    # 4. Progreso semanal
    week_start = today - timedelta(days=today.weekday())
    week_progress = []
    day_names = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
    
    for i in range(7):
        day_date = week_start + timedelta(days=i)
        
        # Obtener comidas del plan para este día
        plan_meals = get_patient_today_meals(patient_id, day_date, db)
        num_plan_meals = len(plan_meals)
        
        # Verificar si se completaron todas las comidas del día
        day_meals = db.query(MealTrackingDB).filter(
            MealTrackingDB.patient_id == patient_id,
            MealTrackingDB.date == day_date
        ).all()
        
        completed = False
        if num_plan_meals > 0:
            completed_count = sum(1 for m in day_meals if m.completed)
            completed = completed_count >= num_plan_meals
        
        week_progress.append({
            "day": day_names[i],
            "date": day_date.strftime("%Y-%m-%d"),
            "completed": completed
        })
    
    # 5. Próxima cita
    next_appointment = db.query(AppointmentDB).filter(
        AppointmentDB.patient_id == patient_id,
        AppointmentDB.date >= today,
        AppointmentDB.status != "cancelada"
    ).order_by(AppointmentDB.date.asc(), AppointmentDB.time.asc()).first()
    
    # 6. Calcular distribución de macronutrientes del plan activo
    total_calories_for_macros = daily_calorie_target or 2000
    macronutrients = {
        "protein_percentage": 30,
        "carbs_percentage": 45,
        "fat_percentage": 25,
        "protein_grams": 0,
        "carbs_grams": 0,
        "fat_grams": 0
    }
    
    if plan:
        # Usar objetivos del plan si existen (protein_target, carbs_target, fat_target)
        p_g = (plan.protein_target or 0)
        c_g = (plan.carbs_target or 0)
        f_g = (plan.fat_target or 0)
        if p_g or c_g or f_g:
            macronutrients["protein_grams"] = round(p_g, 1)
            macronutrients["carbs_grams"] = round(c_g, 1)
            macronutrients["fat_grams"] = round(f_g, 1)
            # Calcular porcentajes desde gramos (1g prot=4kcal, 1g cho=4kcal, 1g grasa=9kcal)
            total_kcal = p_g * 4 + c_g * 4 + f_g * 9
            if total_kcal > 0:
                macronutrients["protein_percentage"] = round((p_g * 4 / total_kcal) * 100)
                macronutrients["carbs_percentage"] = round((c_g * 4 / total_kcal) * 100)
                macronutrients["fat_percentage"] = round((f_g * 9 / total_kcal) * 100)
        else:
            # Fallback: usar fase_2 si existe
            fase_2 = (plan.fase_2 or {}) if isinstance(plan.fase_2, dict) else {}
            pct_prot = int(fase_2.get("proteinas_amdr_f2") or fase_2.get("proteinas_amdr") or 30)
            pct_cho = int(fase_2.get("cho_amdr_f2") or fase_2.get("cho_amdr") or 45)
            pct_fat = int(fase_2.get("grasas_gs_amdr") or 25)
            if pct_prot or pct_cho or pct_fat:
                macronutrients["protein_percentage"] = pct_prot
                macronutrients["carbs_percentage"] = pct_cho
                macronutrients["fat_percentage"] = pct_fat
            total_calories_for_macros = plan.calories or daily_calorie_target or 2000
            protein_cal = total_calories_for_macros * (macronutrients["protein_percentage"] / 100)
            carbs_cal = total_calories_for_macros * (macronutrients["carbs_percentage"] / 100)
            fat_cal = total_calories_for_macros * (macronutrients["fat_percentage"] / 100)
            macronutrients["protein_grams"] = round(protein_cal / 4, 1)
            macronutrients["carbs_grams"] = round(carbs_cal / 4, 1)
            macronutrients["fat_grams"] = round(fat_cal / 9, 1)
    else:
        # Sin plan: mostrar distribución por defecto (30/45/25) con gramos para 2000 kcal
        total_calories_for_macros = 2000
        protein_cal = total_calories_for_macros * 0.30
        carbs_cal = total_calories_for_macros * 0.45
        fat_cal = total_calories_for_macros * 0.25
        macronutrients["protein_grams"] = round(protein_cal / 4, 1)
        macronutrients["carbs_grams"] = round(carbs_cal / 4, 1)
        macronutrients["fat_grams"] = round(fat_cal / 9, 1)
    
    next_appointment_data = None
    if next_appointment:
        # Intentar obtener el nombre real del nutricionista (admin)
        nutritionist = db.query(UserDB).filter(UserDB.role == "admin").first()
        doctor_name = f"{nutritionist.nombres} {nutritionist.apellidos}" if nutritionist else "Nutricionista"
        
        next_appointment_data = {
            "doctor": doctor_name,
            "type": next_appointment.type.capitalize() if next_appointment.type else "Consulta",
            "date": next_appointment.date.strftime("%d %b"),
            "time": next_appointment.time,
            "status": next_appointment.status
        }
    
    # 6. Calcular meta semanal (adherencia)
    weekly_adherence = calculate_weekly_adherence(patient_id, db)
    previous_week_adherence = calculate_previous_week_adherence(patient_id, db)
    adherence_change = weekly_adherence - previous_week_adherence
    
    # 7. Consejo del día (rotativo)
    tips = [
        "Recuerda masticar bien los alimentos. Una buena masticación mejora la digestión y te ayuda a sentirte satisfecho más rápido.",
        "Mantén tu hidratación. Beber agua antes de las comidas puede ayudarte a controlar las porciones.",
        "Incluye proteína en cada comida. Te ayudará a mantener la masa muscular y sentirte satisfecho por más tiempo.",
        "Planifica tus comidas con anticipación. Esto te ayudará a tomar mejores decisiones nutricionales.",
        "Descansa bien. El sueño de calidad es esencial para el control del peso y la salud metabólica.",
        "Muévete más. Incluso pequeñas caminatas durante el día suman para tu salud general.",
        "Come con atención plena. Evita distracciones y disfruta cada bocado conscientemente."
    ]
    day_of_year = now_co().timetuple().tm_yday
    tip_of_day = tips[day_of_year % len(tips)]
    
    return {
        "stats": {
            "altura": patient.altura,
            "peso_actual": patient.peso_actual,
            "edad_formateada": calcular_edad_detallada(patient.fecha_nacimiento),
            "calories": {
                "consumed": total_calories_consumed,
                "target": daily_calorie_target,
                "percentage": int((total_calories_consumed / daily_calorie_target * 100)) if daily_calorie_target > 0 else 0
            },
            "water": {
                "consumed_ml": water_consumed,
                "consumed_liters": round(water_consumed / 1000, 1),
                "target_ml": water_target,
                "target_liters": round(water_target / 1000, 1),
                "percentage": int((water_consumed / water_target * 100)) if water_target > 0 else 0
            },
            "meals": {
                "completed": len(completed_meals),
                "total": len(today_meals),
                "percentage": int((len(completed_meals) / len(today_meals) * 100)) if today_meals else 0
            },
            "weekly_goal": {
                "percentage": weekly_adherence,
                "change": adherence_change,
                "trend": "up" if adherence_change > 0 else "down" if adherence_change < 0 else "stable"
            },
            "macronutrients": macronutrients
        },
        "today_meals": today_meals,
        "week_progress": week_progress,
        "next_appointment": next_appointment_data,
        "tip_of_day": tip_of_day
    }

# ==================== FUNCIONES AUXILIARES ====================

def get_custom_portions_for_day(week_idx: int, day_name: str, plan_metadata: Dict) -> Dict:
    """
    Obtener mapeo de {comida_tipo: {ingrediente: gramos}} de fase_4
    """
    if not plan_metadata or not isinstance(plan_metadata, dict):
        return {}
    
    fase_4 = plan_metadata.get("fase_4")
    if not fase_4 or not isinstance(fase_4, dict):
        return {}
        
    ingredientes_f4 = fase_4.get("ingredientes_f4")
    if not ingredientes_f4 or not isinstance(ingredientes_f4, dict):
        return {}
        
    day_mapping = {
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6,
        "lunes": 0, "martes": 1, "miercoles": 2, "jueves": 3, "viernes": 4, "sabado": 5, "domingo": 6
    }
    
    base_day_idx = day_mapping.get(day_name.lower(), 0)
    global_day_idx = ((week_idx - 1) * 7) + base_day_idx
    
    return ingredientes_f4.get(str(global_day_idx)) or ingredientes_f4.get(global_day_idx) or {}

def apply_custom_ingredients(day_meals: List[Dict], week_idx: int, day_name: str, plan_metadata: Dict):
    """
    Sobrescribir los ingredientes de las comidas con los valores personalizados de fase_4
    """
    if not plan_metadata or not isinstance(plan_metadata, dict):
        return day_meals
    
    fase_4 = plan_metadata.get("fase_4")
    if not fase_4 or not isinstance(fase_4, dict):
        return day_meals
        
    ingredientes_f4 = fase_4.get("ingredientes_f4")
    if not ingredientes_f4 or not isinstance(ingredientes_f4, dict):
        return day_meals
        
    # Calcular el índice del día global (0-27)
    # the frontend uses indices 0-27 for ingredientes_f4
    day_mapping = {
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6,
        "lunes": 0, "martes": 1, "miercoles": 2, "jueves": 3, "viernes": 4, "sabado": 5, "domingo": 6
    }
    
    base_day_idx = day_mapping.get(day_name.lower(), 0)
    global_day_idx = ((week_idx - 1) * 7) + base_day_idx
    
    # Obtener personalizaciones para este día
    # Note: Keys in JSON might be strings
    day_custom = ingredientes_f4.get(str(global_day_idx)) or ingredientes_f4.get(global_day_idx)
    if not day_custom:
        return day_meals
        
    for meal_idx, meal in enumerate(day_meals):
        # Intentar obtener por Tipo (nuevo) o por Índice (retrocompatibilidad)
        meal_type = meal.get("meal_type") or meal.get("type") or meal.get("id")
        meal_custom = None
        
        if meal_type:
            meal_type_str = str(meal_type).lower()
            # Mapeo de búsqueda bidireccional ES/EN
            key_aliases = {
                "breakfast": ["breakfast", "desayuno"],
                "desayuno": ["breakfast", "desayuno"],
                "morning_snack": ["morning_snack", "snack_am", "media_manana", "merienda_manana", "almuerzo"],
                "snack_am": ["morning_snack", "snack_am", "media_manana", "merienda_manana", "almuerzo"],
                "media_manana": ["morning_snack", "snack_am", "media_manana", "merienda_manana", "almuerzo"],
                "lunch": ["lunch", "comida", "almuerzo_principal"],
                "comida": ["lunch", "comida", "almuerzo_principal"],
                "afternoon_snack": ["afternoon_snack", "snack_pm", "media_tarde", "merienda_tarde", "merienda"],
                "snack_pm": ["afternoon_snack", "snack_pm", "media_tarde", "merienda_tarde", "merienda"],
                "media_tarde": ["afternoon_snack", "snack_pm", "media_tarde", "merienda_tarde", "merienda"],
                "dinner": ["dinner", "cena"],
                "cena": ["dinner", "cena"]
            }
            
            search_keys = key_aliases.get(meal_type_str, [meal_type_str])
            for sk in search_keys:
                meal_custom = day_custom.get(sk)
                if meal_custom:
                    break
            
        if not meal_custom:
            meal_custom = day_custom.get(str(meal_idx)) or day_custom.get(meal_idx)
            
        if meal_custom:
            # 1. Hidratar la lista de ingredientes (AHORA COMO OBJETOS para MyPlan.tsx)
            current_ingredients = meal.get("ingredients") or []
            new_ingredients = []
            
            # Mergear gramos personalizados en la lista existente
            for ing in current_ingredients:
                # Si ya es un objeto, extraer nombre
                if isinstance(ing, dict):
                    ing_base = ing.get("name", "")
                else:
                    # Extraer solo el nombre base si ya tiene ":" (evitar duplicados de "ing: 50g: 50g")
                    ing_base = str(ing).split(":")[0].strip()
                
                grams = None
                # Buscar coincidencia insensible a mayúsculas
                for custom_name, custom_grams in meal_custom.items():
                    if str(ing_base).lower() == str(custom_name).lower():
                        grams = custom_grams
                        break
                
                if grams and str(grams).strip() != "":
                    # Asegurar formato "Xg"
                    portion_str = str(grams)
                    if not any(unit in portion_str.lower() for unit in ["g", "gr", "oz", "ml", "und", "unid"]):
                        portion_str = f"{portion_str}g"
                    new_ingredients.append({"name": ing_base, "portion": portion_str})
                else:
                    # Si no tiene gramos, enviar solo el nombre (o vacío, para ocultar badge)
                    new_ingredients.append({"name": ing_base, "portion": ""})
            
            # Agregar ingredientes extra de fase 4 que no estaban en la receta
            for custom_name, custom_grams in meal_custom.items():
                already_in = False
                for existing in new_ingredients:
                    if str(custom_name).lower() == str(existing.get("name", "")).lower():
                        already_in = True
                        break
                
                if not already_in and custom_grams and str(custom_grams).strip() != "":
                    portion_str = str(custom_grams)
                    if not any(unit in portion_str.lower() for unit in ["g", "gr", "oz", "ml", "und", "unid"]):
                        portion_str = f"{portion_str}g"
                    new_ingredients.append({"name": custom_name, "portion": portion_str})
            
            if new_ingredients:
                meal["ingredients"] = new_ingredients

            # 2. Actualizar objetos estructurados (para Dashboard y Seguimiento)
            if "foods" in meal and isinstance(meal["foods"], list):
                for food in meal["foods"]:
                    food_name = food.get("name")
                    if food_name:
                        grams = None
                        for custom_name, custom_grams in meal_custom.items():
                            if str(food_name).lower() == str(custom_name).lower():
                                grams = custom_grams
                                break
                        
                        if grams and str(grams).strip() != "":
                            food["portion"] = f"{grams}g"
                            if "portion_size" in food:
                                food["portion_size"] = f"{grams}g"
                
    return day_meals

def get_patient_today_meals(patient_id: int, date: datetime.date, db: Session) -> List[Dict]:
    """
    Obtener las comidas del día actual del paciente desde su plan
    """
    # Obtener plan activo
    active_plan = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.patient_id == patient_id,
        PatientMealPlanDB.status == "active"
    ).order_by(PatientMealPlanDB.id.desc()).first()
    
    if not active_plan:
        return []
    
    # Obtener el menú semanal
    plan = db.query(MealPlanDB).filter(MealPlanDB.id == active_plan.meal_plan_id).first()
    weekly_menu = db.query(WeeklyMenuDB).filter(
        WeeklyMenuDB.meal_plan_id == plan.id,
        WeeklyMenuDB.week_number == active_plan.current_week
    ).first()
    
    if not weekly_menu:
        # Fallback a semana 1 si no hay menú específico para esta semana
        weekly_menu = db.query(WeeklyMenuDB).filter(
            WeeklyMenuDB.meal_plan_id == plan.id,
            WeeklyMenuDB.week_number == 1
        ).first()
    
    if not weekly_menu:
        return []
    
    # Determinar el día de la semana
    day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    day_name = day_names[date.weekday()]
    day_raw = getattr(weekly_menu, day_name, {})
    if day_raw is None:
        day_raw = {}
    
    # Asegurarse de que el menú del día sea un dict (a veces viene como JSON string)
    if isinstance(day_raw, str):
        try:
            day_menu = json.loads(day_raw)
        except:
            day_menu = {}
    else:
        day_menu = day_raw

    # NUEVO: Si los datos vienen como una lista (posiblemente de semanas)
    if isinstance(day_menu, list):
        week_num = (active_plan.current_week if active_plan else 1) or 1
        idx = max(0, week_num - 1)
        if len(day_menu) > idx:
            day_menu = day_menu[idx]
        elif len(day_menu) > 0:
            day_menu = day_menu[0]
        else:
            day_menu = {}

    # NUEVO: Si los datos vienen como una lista de "meals" (formato del Admin Panel)
    if isinstance(day_menu, dict) and "meals" in day_menu and isinstance(day_menu["meals"], list):
        new_day_menu = {}
        type_to_standard = {
            "desayuno": "breakfast", "breakfast": "breakfast",
            "snack_am": "morning_snack", "morning_snack": "morning_snack", "media_manana": "morning_snack", "merienda_manana": "morning_snack",
            "almuerzo": "lunch", "comida": "lunch", "lunch": "lunch",
            "snack_pm": "afternoon_snack", "afternoon_snack": "afternoon_snack", "media_tarde": "afternoon_snack", "merienda": "afternoon_snack", "merienda_tarde": "afternoon_snack",
            "cena": "dinner", "dinner": "dinner",
        }
        for m in day_menu["meals"]:
            if not isinstance(m, dict):
                continue
            t = (m.get("type") or m.get("meal_type") or "").strip().lower()
            if not t:
                continue
            new_day_menu[t] = m
            standard = type_to_standard.get(t)
            if standard and standard != t:
                new_day_menu[standard] = m
        day_menu = new_day_menu

    # Estructura de comidas
    meal_structure = [
        {"id": "breakfast", "name": "Desayuno", "time": "8:00 AM"},
        {"id": "morning_snack", "name": "Snack AM", "time": "10:30 AM"},
        {"id": "lunch", "name": "Almuerzo", "time": "1:00 PM"},
        {"id": "afternoon_snack", "name": "Snack PM", "time": "4:00 PM"},
        {"id": "dinner", "name": "Cena", "time": "7:30 PM"},
    ]
    
    # Mapeo de búsqueda para llaves en diferentes idiomas/formatos
    key_mapping = {
        "breakfast": ["breakfast", "desayuno"],
        "morning_snack": ["morning_snack", "snack_am", "media_manana", "merienda_manana", "almuerzo"],
        "lunch": ["lunch", "comida"],
        "afternoon_snack": ["afternoon_snack", "snack_pm", "media_tarde", "merienda_tarde", "merienda"],
        "dinner": ["dinner", "cena"]
    }

    # Obtener seguimiento de comidas del día
    tracked_meals = db.query(MealTrackingDB).filter(
        MealTrackingDB.patient_id == patient_id,
        MealTrackingDB.date == date
    ).all()
    
    tracked_dict = {m.meal_type: m for m in tracked_meals}
    
    result = []
    for meal_info in meal_structure:
        # Buscar la comida usando el mapeo de llaves
        meal_data = None
        possible_keys = key_mapping.get(meal_info["id"], [meal_info["id"]])
        
        for pk in possible_keys:
            if pk in day_menu:
                meal_data = day_menu[pk]
                break
        
        tracked = tracked_dict.get(meal_info["id"])
        
        if meal_data:
            # Función auxiliar para obtener un valor de múltiples campos posibles
            def get_field_value(data, field_names, default=None):
                """Busca un valor en múltiples nombres de campo posibles"""
                if not isinstance(data, dict):
                    return default
                for field in field_names:
                    value = data.get(field)
                    if value is not None and value != "":
                        return value
                return default
            
            # Extraer descripción con múltiples variaciones de nombres de campo
            description = get_field_value(
                meal_data,
                ["receta", "recipe", "recipe_name", "name", "nombre", "descripcion", "description", "titulo", "title"],
                meal_info["name"]  # Usar el nombre del tipo de comida como fallback
            )
            
            # Extraer calorías
            calories = get_field_value(
                meal_data,
                ["calorias", "calories", "kcal", "energia"],
                0
            )
            
            # Extraer proteínas
            protein = get_field_value(
                meal_data,
                ["proteina", "protein", "proteinas", "proteins"],
                0
            )
            
            # Extraer carbohidratos
            carbs = get_field_value(
                meal_data,
                ["carbohidratos", "carbs", "carbohydrates", "hidratos"],
                0
            )
            
            # Extraer grasas
            fat = get_field_value(
                meal_data,
                ["grasas", "fat", "fats", "lipidos"],
                0
            )
            
            # Fallback para ingredientes e instrucciones si no están en el JSON (retrocompatibilidad)
            ingredients = get_field_value(meal_data, ["ingredients", "ingredientes"], None) or []
            instructions = get_field_value(meal_data, ["instructions", "instrucciones", "steps", "pasos"], None) or []
            image = get_field_value(meal_data, ["image", "imagen", "image_url"], None)

            recipe_id_raw = meal_data.get("recipe_id") or meal_data.get("id_receta") or meal_data.get("recipeId") or meal_data.get("id")
            if recipe_id_raw is None and isinstance(meal_data.get("recipe"), dict):
                recipe_id_raw = meal_data["recipe"].get("id") or meal_data["recipe"].get("recipe_id")
            try:
                recipe_id = int(recipe_id_raw) if recipe_id_raw is not None and str(recipe_id_raw).strip() != "" else None
            except (TypeError, ValueError):
                recipe_id = None
            recipe = None
            if recipe_id:
                recipe = db.query(RecipeDB).filter(RecipeDB.id == recipe_id).first()
            if not recipe and description and str(description).strip() and str(description) != meal_info["name"]:
                recipe = db.query(RecipeDB).filter(RecipeDB.name == str(description).strip()).first()
                if recipe:
                    recipe_id = recipe.id
            if recipe:
                recipe_dict = _recipe_to_response(recipe)
                if not ingredients:
                    ingredients = recipe_dict.get("ingredients") or []
                if not instructions:
                    instructions = recipe_dict.get("instructions") or []
                if not image:
                    image = recipe_dict.get("image")
                if not description or description == meal_info["name"]:
                    description = recipe_dict.get("name") or description
                if not calories and recipe_dict.get("calories"):
                    calories = recipe_dict.get("calories")
                if not protein and recipe_dict.get("protein") is not None:
                    protein = recipe_dict.get("protein")
                if not carbs and recipe_dict.get("carbs") is not None:
                    carbs = recipe_dict.get("carbs")
                if not fat and recipe_dict.get("fat") is not None:
                    fat = recipe_dict.get("fat")

            # Normalizar ingredientes/instrucciones a lista (por si vienen como JSON string del menú)
            if not isinstance(ingredients, (list, tuple)):
                if isinstance(ingredients, str):
                    try:
                        ingredients = json.loads(ingredients) if ingredients.strip() else []
                    except (json.JSONDecodeError, TypeError):
                        ingredients = [ingredients] if ingredients.strip() else []
                else:
                    ingredients = []
            if not isinstance(instructions, (list, tuple)):
                if isinstance(instructions, str):
                    try:
                        instructions = json.loads(instructions) if instructions.strip() else []
                    except (json.JSONDecodeError, TypeError):
                        instructions = [instructions] if instructions.strip() else []
                else:
                    instructions = []

            result.append({
                "meal_type": meal_info["id"],
                "name": meal_info["name"],
                "time": meal_info["time"],
                "calories": int(calories) if calories else 0,
                "completed": bool(tracked.completed) if tracked else False,
                "description": str(description),
                "receta": str(description),
                "food": str(description),
                "meal": meal_info["name"],
                "protein": int(protein) if protein else 0,
                "carbs": int(carbs) if carbs else 0,
                "fat": int(fat) if fat else 0,
                "ingredients": list(ingredients) if isinstance(ingredients, (list, tuple)) else [],
                "instructions": list(instructions) if isinstance(instructions, (list, tuple)) else [],
                "image": image,
                "type": meal_info["id"],
                "recipe_id": recipe_id,
            })
    
    # Aplicar ingredientes personalizados si existen en fase_4
    plan_metadata = {"fase_4": plan.fase_4 if plan else {}}
    week_num = active_plan.current_week if active_plan else 1
    
    # Hidratar con porciones (actualiza ingredients y foods in-place)
    apply_custom_ingredients(result, week_num, day_name, plan_metadata)
    
    return result

def calculate_previous_week_adherence(patient_id: int, db: Session) -> int:
    """
    Calcular la adherencia de la semana anterior
    """
    today = today_co()
    prev_week_start = today - timedelta(days=today.weekday() + 7)
    prev_week_end = prev_week_start + timedelta(days=6)
    
    total_meals = db.query(MealTrackingDB).filter(
        MealTrackingDB.patient_id == patient_id,
        MealTrackingDB.date >= prev_week_start,
        MealTrackingDB.date <= prev_week_end
    ).count()
    
    completed_meals = db.query(MealTrackingDB).filter(
        MealTrackingDB.patient_id == patient_id,
        MealTrackingDB.date >= prev_week_start,
        MealTrackingDB.date <= prev_week_end,
        MealTrackingDB.completed == 1
    ).count()
    
    if total_meals == 0:
        return 0
    
    return int((completed_meals / total_meals) * 100)

# Los endpoints de seguimiento de comidas y agua se han unificado abajo


@app.post("/api/patient/{patient_id}/water/add")
def add_water_glass(
    patient_id: int,
    glass_ml: int = 250,
    db: Session = Depends(get_db)
):
    """
    Agregar un vaso de agua (250ml por defecto)
    """
    today = today_co()
    
    water_tracking = db.query(WaterTrackingDB).filter(
        WaterTrackingDB.patient_id == patient_id,
        WaterTrackingDB.date == today
    ).first()
    
    if not water_tracking:
        water_tracking = WaterTrackingDB(
            patient_id=patient_id,
            date=today,
            amount_ml=glass_ml,
            updated_at=now_co().strftime("%Y-%m-%d %H:%M:%S")
        )
        db.add(water_tracking)
    else:
        water_tracking.amount_ml += glass_ml
        water_tracking.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
    
    db.commit()
    db.refresh(water_tracking)
    
    return {
        "success": True,
        "amount_ml": water_tracking.amount_ml,
        "amount_liters": round(water_tracking.amount_ml / 1000, 1),
        "target_ml": water_tracking.target_ml,
        "percentage": int((water_tracking.amount_ml / water_tracking.target_ml) * 100)
    }

@app.post("/api/patient/{patient_id}/meals/complete")
def complete_meal_legacy_2(
    patient_id: int,
    meal_data: MealTrackingUpdate,
    db: Session = Depends(get_db)
):
    """Marcar una comida como completada"""
    today = today_co()
    
    # Buscar si ya existe registro
    tracking = db.query(MealTrackingDB).filter(
        MealTrackingDB.patient_id == patient_id,
        MealTrackingDB.date == today,
        MealTrackingDB.meal_type == meal_data.meal_type
    ).first()
    
    if tracking:
        tracking.completed = True
        tracking.updated_at = now_co()
    else:
        tracking = MealTrackingDB(
            patient_id=patient_id,
            date=today,
            meal_type=meal_data.meal_type,
            completed=True,
            updated_at=now_co()
        )
        db.add(tracking)
        
    db.commit()
    return {"success": True}

@app.post("/api/patient/{patient_id}/meals/uncomplete")
def uncomplete_meal_legacy(
    patient_id: int,
    meal_data: MealTrackingUpdate,
    db: Session = Depends(get_db)
):
    """Desmarcar una comida"""
    today = today_co()
    
    tracking = db.query(MealTrackingDB).filter(
        MealTrackingDB.patient_id == patient_id,
        MealTrackingDB.date == today,
        MealTrackingDB.meal_type == meal_data.meal_type
    ).first()
    
    if tracking:
        tracking.completed = False
        tracking.updated_at = now_co()
        db.commit()
        
    return {"success": True}

# ==================== ENDPOINT DE TIPS ====================

@app.get("/api/patient/tips/random")
def get_random_tip():
    """
    Obtener un consejo aleatorio
    """
    tips = [
        {
            "title": "💡 Consejo del día",
            "content": "Recuerda masticar bien los alimentos. Una buena masticación mejora la digestión y te ayuda a sentirte satisfecho más rápido."
        },
        {
            "title": "💧 Hidratación",
            "content": "Mantén tu hidratación. Beber agua antes de las comidas puede ayudarte a controlar las porciones."
        },
        {
            "title": "🍗 Proteína",
            "content": "Incluye proteína en cada comida. Te ayudará a mantener la masa muscular y sentirte satisfecho por más tiempo."
        },
        {
            "title": "📋 Planificación",
            "content": "Planifica tus comidas con anticipación. Esto te ayudará a tomar mejores decisiones nutricionales."
        },
        {
            "title": "😴 Descanso",
            "content": "Descansa bien. El sueño de calidad es esencial para el control del peso y la salud metabólica."
        },
        {
            "title": "🚶 Movimiento",
            "content": "Muévete más. Incluso pequeñas caminatas durante el día suman para tu salud general."
        },
        {
            "title": "🧘 Mindfulness",
            "content": "Come con atención plena. Evita distracciones y disfruta cada bocado conscientemente."
        }
    ]
    
    import random
    return random.choice(tips)

@app.get("/api/patient/{patient_id}/plan/weekly")
def get_patient_weekly_plan(patient_id: int, db: Session = Depends(get_db)):
    """
    Obtener el plan semanal completo del paciente
    """
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
        
    # Obtener plan activo (el más reciente)
    active_assignment = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.patient_id == patient_id,
        PatientMealPlanDB.status == "active"
    ).order_by(PatientMealPlanDB.id.desc()).first()
    
    if not active_assignment:
        return {
            "has_plan": False,
            "message": "No tienes un plan activo asignado"
        }
    
    full_plan_by_week = {}
    
    plan = db.query(MealPlanDB).filter(MealPlanDB.id == active_assignment.meal_plan_id).first()
    
    # Obtener nutricionista (needed for doctor_name used later)
    nutritionist = db.query(UserDB).filter(UserDB.role == "admin").first()
    doctor_name = f"{nutritionist.nombres} {nutritionist.apellidos}" if nutritionist else "Nutricionista"
    
    # Calcular metas de calorías y macros desde el plan (para devolver stats siempre)
    target_calories = plan.calories or 0
    target_protein_g = plan.protein_target if (plan.protein_target is not None and plan.protein_target > 0) else None
    target_carbs_g = plan.carbs_target if (plan.carbs_target is not None and plan.carbs_target > 0) else None
    target_fat_g = plan.fat_target if (plan.fat_target is not None and plan.fat_target > 0) else None
    
    # Parse fase_2 and fase_1 if they are JSON strings
    fase_2 = plan.fase_2
    if isinstance(fase_2, str):
        try:
            fase_2 = json.loads(fase_2)
        except:
            fase_2 = {}
    elif not isinstance(fase_2, dict):
        fase_2 = {}
    
    fase_1 = plan.fase_1
    if isinstance(fase_1, str):
        try:
            fase_1 = json.loads(fase_1)
        except:
            fase_1 = {}
    elif not isinstance(fase_1, dict):
        fase_1 = {}
    
    # Log for debugging (can be removed later)
    print(f"[DEBUG] Plan ID: {plan.id}, Name: {plan.name}")
    print(f"[DEBUG] Direct fields - calories: {plan.calories}, protein: {plan.protein_target}, carbs: {plan.carbs_target}, fat: {plan.fat_target}")
    print(f"[DEBUG] fase_2 keys: {list(fase_2.keys()) if fase_2 else 'None'}")
    print(f"[DEBUG] fase_1 keys: {list(fase_1.keys()) if fase_1 else 'None'}")
    
    # Extract from fase_2 or fase_1 if direct fields are not available
    if target_calories <= 0 or (target_protein_g is None and target_carbs_g is None and target_fat_g is None):
        if target_calories <= 0:
            try:
                # Try multiple possible field names
                cal_value = (
                    fase_2.get("total_calorias") or 
                    fase_2.get("calorias_totales") or
                    fase_2.get("total_calorias_f2") or
                    fase_1.get("requerimiento_energetico") or
                    fase_1.get("calorias_totales") or
                    0
                )
                target_calories = int(float(cal_value) if cal_value else 0)
                print(f"[DEBUG] Extracted calories from fase: {target_calories}")
            except (TypeError, ValueError) as e:
                print(f"[DEBUG] Error extracting calories: {e}")
                target_calories = 0
        
        if target_protein_g is None:
            try:
                prot_value = (
                    fase_2.get("proteinas_gramos_f2") or 
                    fase_2.get("proteinas_gramos") or
                    fase_2.get("proteina_gramos") or
                    0
                )
                target_protein_g = int(float(prot_value) if prot_value else 0)
                print(f"[DEBUG] Extracted protein from fase: {target_protein_g}")
            except (TypeError, ValueError) as e:
                print(f"[DEBUG] Error extracting protein: {e}")
                target_protein_g = 0
        
        if target_carbs_g is None:
            try:
                carbs_value = (
                    fase_2.get("cho_gramos_f2") or 
                    fase_2.get("cho_gramos") or
                    fase_2.get("carbohidratos_gramos") or
                    0
                )
                target_carbs_g = int(float(carbs_value) if carbs_value else 0)
                print(f"[DEBUG] Extracted carbs from fase: {target_carbs_g}")
            except (TypeError, ValueError) as e:
                print(f"[DEBUG] Error extracting carbs: {e}")
                target_carbs_g = 0
        
        if target_fat_g is None:
            try:
                fat_value = (
                    fase_2.get("grasas_gramos_f2") or 
                    fase_2.get("grasas_gramos") or
                    fase_2.get("grasa_gramos") or
                    0
                )
                target_fat_g = int(float(fat_value) if fat_value else 0)
                print(f"[DEBUG] Extracted fat from fase: {target_fat_g}")
            except (TypeError, ValueError) as e:
                print(f"[DEBUG] Error extracting fat: {e}")
                target_fat_g = 0
    
    # Final fallback: calculate from calories if still None or 0
    if target_protein_g is None or target_protein_g == 0:
        target_protein_g = int(target_calories * 0.20 / 4) if target_calories else 0
        print(f"[DEBUG] Using calculated protein: {target_protein_g}")
    if target_carbs_g is None or target_carbs_g == 0:
        target_carbs_g = int(target_calories * 0.50 / 4) if target_calories else 0
        print(f"[DEBUG] Using calculated carbs: {target_carbs_g}")
    if target_fat_g is None or target_fat_g == 0:
        target_fat_g = int(target_calories * 0.30 / 9) if target_calories else 0
        print(f"[DEBUG] Using calculated fat: {target_fat_g}")
    
    print(f"[DEBUG] Final values - calories: {target_calories}, protein: {target_protein_g}g, carbs: {target_carbs_g}g, fat: {target_fat_g}g")

    
    def _plan_stats():
        return {
            "calories": {"target": target_calories},
            "protein": {"target": target_protein_g},
            "carbs": {"target": target_carbs_g},
            "fat": {"target": target_fat_g}
        }
    
    # Obtener TODOS los menús semanales del plan
    all_weekly_menus = db.query(WeeklyMenuDB).filter(
        WeeklyMenuDB.meal_plan_id == plan.id
    ).all()
    
    # Si no hay menús (caso raro), retornar con stats para que las tarjetas muestren datos
    if not all_weekly_menus:
         return {
            "has_plan": True,
            "plan_name": plan.name,
            "doctor": doctor_name,
            "start_date": active_assignment.start_date,
            "duration": getattr(plan, "duration", None),
            "current_week": getattr(active_assignment, "current_week", 1),
            "stats": _plan_stats(),
            "message": "Tu nutricionista aún no ha cargado el menú para esta semana."
        }

    day_map = {
        "monday": "lunes",
        "tuesday": "martes",
        "wednesday": "miercoles",
        "thursday": "jueves",
        "friday": "viernes",
        "saturday": "sabado",
        "sunday": "domingo"
    }

    meal_structure = [
        {"id": "breakfast", "name": "Desayuno", "time": "8:00 AM"},
        {"id": "morning_snack", "name": "Snack AM", "time": "10:30 AM"},
        {"id": "lunch", "name": "Almuerzo", "time": "1:00 PM"},
        {"id": "afternoon_snack", "name": "Snack PM", "time": "4:00 PM"},
        {"id": "dinner", "name": "Cena", "time": "7:30 PM"},
    ]

    # Mapeo de búsqueda para llaves en diferentes idiomas/formatos
    key_mapping = {
        "breakfast": ["breakfast", "desayuno"],
        "morning_snack": ["morning_snack", "snack_am", "media_manana", "merienda_manana", "almuerzo"],
        "lunch": ["lunch", "comida"],
        "afternoon_snack": ["afternoon_snack", "snack_pm", "media_tarde", "merienda_tarde", "merienda"],
        "dinner": ["dinner", "cena"]
    }

    # Procesar cada semana
    for menu_item in all_weekly_menus:
        week_num = menu_item.week_number or 1 # Default a 1 si es null
        week_days_data = {}
        
        for db_day, display_day in day_map.items():
            day_raw = getattr(menu_item, db_day, {})
            if day_raw is None:
                day_raw = {}
                
            # Parsear si es string (puede ser simple o doble encoding)
            if isinstance(day_raw, str):
                try:
                    day_raw = json.loads(day_raw)
                except:
                    day_raw = {}
                    
            # Si sigue siendo string (doble encoding), intentar de nuevo
            if isinstance(day_raw, str):
                try:
                    day_raw = json.loads(day_raw)
                except:
                    day_raw = {}

            day_data = day_raw
                
            # NUEVO: Si los datos vienen como una lista de "meals" (formato del Admin Panel)
            # Primero ver si es una lista de semanas (nueva estructura)
            if isinstance(day_data, list):
                # Es una lista de semanas, necesitamos la semana actual
                # menu_item.week_number ya nos dice qué semana es este registro (1, 2, 3 o 4)
                # Pero la columna puede tener TODAS las semanas si se guardó mal, o solo una
                
                # En el nuevo modelo, cada WeeklyMenuDB es una semana específica (1..4)
                # Pero la columna JSON podría tener la lista completa de 4 semanas si viene del create
                
                # Vamos a asumir que si es lista, intentamos sacar el índice correspondiente
                idx = (menu_item.week_number - 1) if menu_item.week_number else 0
                if len(day_data) > idx:
                    day_data = day_data[idx]
                elif len(day_data) > 0:
                    day_data = day_data[0] # Fallback
                else:
                    day_data = {}

            if isinstance(day_data, dict) and "meals" in day_data and isinstance(day_data["meals"], list):
                new_day_data = {}
                for m in day_data["meals"]:
                    if isinstance(m, dict) and "type" in m:
                        # Guardamos todo el objeto de la comida
                        new_day_data[m["type"]] = m
                day_data = new_day_data
    
            day_meals = []
            for ms in meal_structure:
                meal_data = None
                possible_keys = key_mapping.get(ms["id"], [ms["id"]])
                
                for pk in possible_keys:
                    if pk in day_data:
                        meal_data = day_data[pk]
                        break
                
                # Procesar datos de la comida (igual que antes)
                if meal_data:
                    if isinstance(meal_data, str):
                        try:
                            extracted_data = json.loads(meal_data)
                            if not isinstance(extracted_data, dict):
                                extracted_data = {"receta": str(extracted_data)}
                        except:
                            extracted_data = {"receta": meal_data}
                    else:
                        extracted_data = meal_data
    
                    food_name = extracted_data.get("receta") or extracted_data.get("name") or extracted_data.get("recipe_name") or "No asignado"
                    ingredients = extracted_data.get("ingredients") or []
                    instructions = extracted_data.get("instructions") or []
                    image = extracted_data.get("image")
                    
                    recipe_id = extracted_data.get("recipe_id") or extracted_data.get("id")
                    if (not ingredients or not instructions) and recipe_id:
                        recipe = db.query(RecipeDB).filter(RecipeDB.id == recipe_id).first()
                        if recipe:
                            if not ingredients: ingredients = recipe.ingredients
                            if not instructions: instructions = recipe.instructions
                            if not image: image = recipe.image
    
                    day_meals.append({
                        "meal": ms["name"],
                        "food": food_name,
                        "calories": extracted_data.get("calorias") or extracted_data.get("calories") or 0,
                        "time": extracted_data.get("time") or ms["time"],
                        "ingredients": ingredients,
                        "instructions": instructions,
                        "image": image,
                        "type": ms["id"]
                    })
            
            week_days_data[display_day] = day_meals
            
        full_plan_by_week[week_num] = week_days_data

    # Asegurar que siempre haya 4 semanas. Si hay menos, repetir las existentes en ciclo.
    if full_plan_by_week:
        available_weeks = sorted(full_plan_by_week.keys())
        for w in range(1, 5):
            if w not in full_plan_by_week:
                # Usar módulo para ciclar entre las semanas disponibles
                source_week = available_weeks[(w - 1) % len(available_weeks)]
                # IMPORTANTE: Usar deepcopy para evitar que cambios en una semana afecten a otras
                full_plan_by_week[w] = copy.deepcopy(full_plan_by_week[source_week])
    
    # Aplicar ingredientes personalizados de fase_4 a todas las semanas y días
    plan_metadata = {"fase_4": plan.fase_4 if plan else {}}
    for w_idx, week_data in full_plan_by_week.items():
        for display_day, meals in week_data.items():
            # week_data[display_day] es una lista de comidas que se modifica in-place
            apply_custom_ingredients(meals, w_idx, display_day, plan_metadata)

    # Mantener compatibilidad con frontend actual enviando la semana actual en 'week_plan'
    current_week_data = full_plan_by_week.get(active_assignment.current_week, {})
    if not current_week_data and 1 in full_plan_by_week:
         current_week_data = full_plan_by_week[1]

    return {
        "has_plan": True,
        "plan_name": plan.name,
        "doctor": doctor_name,
        "start_date": active_assignment.start_date,
        "duration": plan.duration,
        "current_week": active_assignment.current_week,
        "stats": _plan_stats(),
        "week_plan": current_week_data, # Legacy support
        "all_weeks": full_plan_by_week # New full data
    }

@app.get("/api/patient/{patient_id}/meals/today/detailed")
def get_patient_meals_detailed(patient_id: int, db: Session = Depends(get_db)):
    """
    Obtener todas las comidas del día con detalles completos de alimentos
    """
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    today = today_co()
    
    # Obtener plan activo
    active_plan = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.patient_id == patient_id,
        PatientMealPlanDB.status == "active"
    ).order_by(PatientMealPlanDB.id.desc()).first()
    
    if not active_plan:
        return {
            "meals": [],
            "summary": {
                "calories": {"consumed": 0, "target": 0},
                "protein": {"consumed": 0, "target": 0},
                "carbs": {"consumed": 0, "target": 0},
                "fat": {"consumed": 0, "target": 0}
            },
            "message": "No tienes un plan activo asignado"
        }
    
    # Obtener el plan y su menú
    plan = db.query(MealPlanDB).filter(MealPlanDB.id == active_plan.meal_plan_id).first()
    weekly_menu = db.query(WeeklyMenuDB).filter(
        WeeklyMenuDB.meal_plan_id == plan.id,
        WeeklyMenuDB.week_number == active_plan.current_week
    ).first()
    
    if not weekly_menu:
        # Fallback a semana 1 si no hay menú específico para esta semana
        weekly_menu = db.query(WeeklyMenuDB).filter(
            WeeklyMenuDB.meal_plan_id == plan.id,
            WeeklyMenuDB.week_number == 1
        ).first()
    
    if not weekly_menu:
        return {
            "meals": [],
            "summary": {
                "calories": {"consumed": 0, "target": plan.calories},
                "protein": {"consumed": 0, "target": plan.protein_target},
                "carbs": {"consumed": 0, "target": plan.carbs_target},
                "fat": {"consumed": 0, "target": plan.fat_target}
            },
            "message": "No hay menú configurado para esta semana"
        }
    
    # AUTO-INICIALIZACIÓN: Si no hay registros de comida para hoy, crearlos
    existing_any = db.query(MealTrackingDB).filter(
        MealTrackingDB.patient_id == patient_id,
        MealTrackingDB.date == today
    ).first()
    
    if not existing_any:
        _internal_initialize_meals(patient_id, today, db, active_plan, weekly_menu)
    
    # Determinar día de la semana
    day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    day_name = day_names[today.weekday()]
    day_menu = getattr(weekly_menu, day_name, {})
    
    # Estructura de comidas
    meal_structure = [
        {"id": "breakfast", "name": "Desayuno", "icon": "Coffee", "time": "8:00 AM"},
        {"id": "morning_snack", "name": "Snack Mañana", "icon": "Apple", "time": "10:30 AM"},
        {"id": "lunch", "name": "Almuerzo", "icon": "Sun", "time": "1:00 PM"},
        {"id": "afternoon_snack", "name": "Snack Tarde", "icon": "Sandwich", "time": "4:00 PM"},
        {"id": "dinner", "name": "Cena", "icon": "Moon", "time": "7:30 PM"},
    ]
    
    # Mapeo de búsqueda para llaves en diferentes idiomas/formatos
    key_mapping = {
        "breakfast": ["breakfast", "desayuno"],
        "morning_snack": ["morning_snack", "snack_am", "media_manana", "merienda_manana", "almuerzo"],
        "lunch": ["lunch", "comida"],
        "afternoon_snack": ["afternoon_snack", "snack_pm", "media_tarde", "merienda_tarde", "merienda"],
        "dinner": ["dinner", "cena"]
    }
    
    # NUEVO: Si los datos vienen como una lista (posiblemente de semanas)
    if isinstance(day_menu, list):
        idx = (active_plan.current_week - 1) if active_plan else 0
        if len(day_menu) > idx:
            day_menu = day_menu[idx]
        elif len(day_menu) > 0:
            day_menu = day_menu[0]
        else:
            day_menu = {}

    # NUEVO: Si los datos vienen como una lista de "meals" (formato del Admin Panel)
    # y day_menu contiene esa lista, necesitamos transformarla primero o buscar en ella
    if isinstance(day_menu, dict) and "meals" in day_menu and isinstance(day_menu["meals"], list):
        new_day_menu = {}
        for m in day_menu["meals"]:
            if isinstance(m, dict) and "type" in m:
                new_day_menu[m["type"]] = m
        day_menu = new_day_menu
    
    meals_response = []
    total_consumed = {"calories": 0, "protein": 0, "carbs": 0, "fat": 0}
    
    for meal_info in meal_structure:
        # Buscar la comida usando el mapeo de llaves
        meal_data = None
        possible_keys = key_mapping.get(meal_info["id"], [meal_info["id"]])
        
        for pk in possible_keys:
            if pk in day_menu:
                meal_data = day_menu[pk]
                break
        
        # Si no hay datos para esta comida en el plan, saltar
        if not meal_data:
            continue
        
        # Si meal_data es un string (no debería pasar si day_menu fue parsed, pero por seguridad)
        if isinstance(meal_data, str):
            try:
                meal_data = json.loads(meal_data)
            except:
                meal_data = {"receta": meal_data}

        # Obtener tracking de esta comida
        meal_tracking = db.query(MealTrackingDB).filter(
            MealTrackingDB.patient_id == patient_id,
            MealTrackingDB.date == today,
            MealTrackingDB.meal_type == meal_info["id"]
        ).first()
        
        # Obtener alimentos de esta comida
        food_items = []
        if meal_tracking:
            db_food_items = db.query(MealFoodItemDB).filter(
                MealFoodItemDB.meal_tracking_id == meal_tracking.id
            ).order_by(MealFoodItemDB.order_index).all()
            
            for food in db_food_items:
                food_items.append({
                    "name": food.name,
                    "portion": food.portion_size,
                    "calories": food.calories,
                    "protein": food.protein,
                    "carbs": food.carbs,
                    "fat": food.fat,
                    "checked": bool(food.checked)
                })
                
                # Si está marcado, sumar a totales consumidos
                if food.checked:
                    total_consumed["calories"] += food.calories
                    total_consumed["protein"] += food.protein
                    total_consumed["carbs"] += food.carbs
                    total_consumed["fat"] += food.fat
        else:
            # Si no hay tracking, crear alimentos desde el menú del plan
            food_items = generate_default_foods_for_meal(meal_info["id"], meal_data)
        
        # Calcular totales de la comida
        meal_totals = {
            "calories": sum(f["calories"] for f in food_items),
            "protein": sum(f["protein"] for f in food_items),
            "carbs": sum(f["carbs"] for f in food_items),
            "fat": sum(f["fat"] for f in food_items)
        }
        
        meals_response.append({
            "id": meal_info["id"],
            "name": meal_info["name"], # "Desayuno"
            "icon": meal_info["icon"],
            "time": meal_info["time"],
            "completed": (meal_tracking.completed == 1) if meal_tracking else False,
            "foods": food_items,
            "total_calories": meal_totals["calories"],
            "total_protein": meal_totals["protein"],
            "total_carbs": meal_totals["carbs"],
            "total_fat": meal_totals["fat"],
            "type": meal_info["id"], # Necesario para consistencia
            # Campos adicionales para el modal del Dashboard
            "description": meal_data.get("receta") or meal_data.get("name") or meal_info["name"],
            "ingredients": [f"{f['name']}: {f['portion']}" if f.get('portion') else f['name'] for f in food_items],
            "instructions": meal_data.get("instructions") or []
        })
    
    # Aplicar ingredientes y porciones personalizadas de fase_4
    plan_metadata = {"fase_4": plan.fase_4 if plan else {}}
    week_num = active_plan.current_week if active_plan else 1
    
    # Hidratar lista de comidas (actualiza ingredients y foods.portion in-place)
    apply_custom_ingredients(meals_response, week_num, day_name, plan_metadata)
    
    # Calcular totales objetivos del plan
    target_protein = plan.protein_target or 0
    target_carbs = plan.carbs_target or 0
    target_fat = plan.fat_target or 0
    
    return {
        "meals": meals_response,
        "summary": {
            "calories": {
                "consumed": total_consumed["calories"],
                "target": plan.calories
            },
            "protein": {
                "consumed": total_consumed["protein"],
                "target": target_protein
            },
            "carbs": {
                "consumed": total_consumed["carbs"],
                "target": target_carbs
            },
            "fat": {
                "consumed": total_consumed["fat"],
                "target": target_fat
            }
        }
    }

# ==================== FUNCIONES AUXILIARES ====================

def generate_default_foods_for_meal(meal_type: str, meal_data: dict) -> List[dict]:
    """
    Generar alimentos por defecto para una comida.
    Prioriza el nombre de la receta del plan si está disponible.
    """
    # Intentar obtener información (Soporte formato Admin Panel)
    plan_recipe = meal_data.get("receta") or meal_data.get("name") or meal_data.get("recipe_name")
    plan_calories = meal_data.get("calorias") or meal_data.get("calories") or 0
    
    if plan_recipe:
        # Si tenemos una receta del plan, la usamos como el alimento principal
        # Intentamos estimar macros básicos si no están presentes (opcional)
        return [{
            "checked": False,
            "name": plan_recipe,
            "portion": "1 porción",
            "calories": plan_calories,
            "protein": meal_data.get("proteina") or meal_data.get("protein") or 0,
            "carbs": meal_data.get("carbohidratos") or meal_data.get("carbs") or 0,
            "fat": meal_data.get("grasas") or meal_data.get("fat") or 0
        }]

    # Fallback a ejemplos si no hay nada en el plan
    default_foods = {
        "breakfast": [
            {"name": "Avena con leche", "portion": "1 taza", "calories": 200, "protein": 8, "carbs": 35, "fat": 4},
            {"name": "Banana", "portion": "1 unidad", "calories": 105, "protein": 1, "carbs": 27, "fat": 0},
        ],
        "morning_snack": [
            {"name": "Manzana", "portion": "1 unidad", "calories": 95, "protein": 0, "carbs": 25, "fat": 0},
        ],
        "lunch": [
            {"name": "Pechuga de pollo", "portion": "150g", "calories": 250, "protein": 45, "carbs": 0, "fat": 7},
            {"name": "Arroz integral", "portion": "1/2 taza", "calories": 110, "protein": 2, "carbs": 23, "fat": 1},
        ],
        "afternoon_snack": [
            {"name": "Yogurt griego", "portion": "150g", "calories": 120, "protein": 15, "carbs": 8, "fat": 2},
        ],
        "dinner": [
            {"name": "Pescado a la plancha", "portion": "150g", "calories": 220, "protein": 35, "carbs": 0, "fat": 8},
            {"name": "Ensalada verde", "portion": "1 plato", "calories": 50, "protein": 2, "carbs": 10, "fat": 0},
        ],
    }
    
    foods = default_foods.get(meal_type, [{"name": "Comida equilibrada", "portion": "1 porción", "calories": 300, "protein": 20, "carbs": 30, "fat": 10}])
    return [{"checked": False, **food} for food in foods]

def initialize_single_meal_from_plan(patient_id: int, date: datetime.date, meal_type: str, db: Session):
    """
    Inicializa una sola comida desde el plan si no existe
    """
    # Obtener plan activo
    active_plan = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.patient_id == patient_id,
        PatientMealPlanDB.status == "active"
    ).order_by(PatientMealPlanDB.id.desc()).first()
    
    if not active_plan:
        return None
        
    plan = db.query(MealPlanDB).filter(MealPlanDB.id == active_plan.meal_plan_id).first()
    weekly_menu = db.query(WeeklyMenuDB).filter(
        WeeklyMenuDB.meal_plan_id == plan.id,
        WeeklyMenuDB.week_number == active_plan.current_week
    ).first()
    
    if not weekly_menu:
        return None
        
    day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    day_name = day_names[date.weekday()]
    day_raw = getattr(weekly_menu, day_name, {})
    if day_raw is None:
        day_raw = {}
    
    if isinstance(day_raw, str):
        try:
            day_menu = json.loads(day_raw)
        except:
            day_menu = {}
    else:
        day_menu = day_raw

    # NUEVO: Si los datos vienen como una lista (posiblemente de semanas)
    if isinstance(day_menu, list):
        idx = (active_plan.current_week - 1) if active_plan else 0
        if len(day_menu) > idx:
            day_menu = day_menu[idx]
        elif len(day_menu) > 0:
            day_menu = day_menu[0]
        else:
            day_menu = {}

    # NUEVO: Si los datos vienen como una lista de "meals" (formato del Admin Panel)
    if isinstance(day_menu, dict) and "meals" in day_menu and isinstance(day_menu["meals"], list):
        new_day_menu = {}
        for m in day_menu["meals"]:
            if isinstance(m, dict) and "type" in m:
                new_day_menu[m["type"]] = m
        day_menu = new_day_menu
        
    key_mapping = {
        "breakfast": ["breakfast", "desayuno"],
        "desayuno": ["breakfast", "desayuno"],
        "morning_snack": ["morning_snack", "snack_am", "media_manana", "merienda_manana", "almuerzo"],
        "snack_am": ["morning_snack", "snack_am", "media_manana", "merienda_manana", "almuerzo"],
        "media_manana": ["morning_snack", "snack_am", "media_manana", "merienda_manana", "almuerzo"],
        "lunch": ["lunch", "comida", "almuerzo_principal"],
        "comida": ["lunch", "comida", "almuerzo_principal"],
        "afternoon_snack": ["afternoon_snack", "snack_pm", "media_tarde", "merienda_tarde", "merienda"],
        "snack_pm": ["afternoon_snack", "snack_pm", "media_tarde", "merienda_tarde", "merienda"],
        "media_tarde": ["afternoon_snack", "snack_pm", "media_tarde", "merienda_tarde", "merienda"],
        "dinner": ["dinner", "cena"],
        "cena": ["dinner", "cena"]
    }
    
    meal_data = None
    possible_keys = key_mapping.get(meal_type, [meal_type])
    
    for pk in possible_keys:
        if pk in day_menu:
            meal_data = day_menu[pk]
            break
            
    if meal_data:
        # Convertir datos
        if isinstance(meal_data, str):
            try:
                extract = json.loads(meal_data)
                if isinstance(extract, dict):
                    meal_data = extract
                else:
                    meal_data = {"receta": meal_data}
            except:
                meal_data = {"receta": meal_data}

        tracking = MealTrackingDB(
            patient_id=patient_id,
            date=date,
            meal_type=meal_type,
            meal_name=f"Comida {meal_type}",
            calories=0,
            completed=0,
            created_at=now_co().strftime("%Y-%m-%d %H:%M:%S")
        )
        db.add(tracking)
        db.flush()
        
        # Obtener personalizaciones de porciones (gramos)
        plan = db.query(MealPlanDB).filter(MealPlanDB.id == active_plan.meal_plan_id).first()
        plan_metadata = {"fase_4": plan.fase_4 if plan else {}}
        day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        day_name = day_names[date.weekday()]
        custom_portions = get_custom_portions_for_day(active_plan.current_week, day_name, plan_metadata)
        
        # Retro-compatibilidad: Encontrar el índice de esta comida en la lista del plan
        # para que coincida con la lógica de Card 0, 1...
        meal_idx = 0
        found_idx = -1
        day_names_en = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        day_name_en = day_names_en[date.weekday()]
        day_r = getattr(weekly_menu, day_name_en, {})
        # ... logic skipped here since we iterate in the same order as get_patient_today_meals
        
        # MEJOR: Intentar por TIPO y si no, por ÍNDICE sugerido
        meal_custom = custom_portions.get(str(meal_type)) or custom_portions.get(meal_type)
        # Nota: En initialize_single_meal_from_plan no tenemos el idx fácil, usaremos type mayormente

        foods = generate_default_foods_for_meal(meal_type, meal_data)
        for i, food in enumerate(foods):
            food_name = food["name"]
            # Si hay una porción personalizada en fase_4, usarla
            final_portion = food["portion"]
            if meal_custom and food_name in meal_custom:
                grams = meal_custom[food_name]
                if grams and str(grams).strip() != "":
                    final_portion = f"{grams}g"

            db.add(MealFoodItemDB(
                meal_tracking_id=tracking.id,
                name=food_name,
                portion_size=final_portion,
                calories=food["calories"],
                protein=food["protein"],
                carbs=food["carbs"],
                fat=food["fat"],
                checked=0,
                order_index=i
            ))
            
        db.commit()
        return tracking
        
    return None

def _internal_initialize_meals(patient_id: int, meal_date: date, db: Session, active_plan, weekly_menu):
    """
    Lógica interna compartida para inicializar comidas
    """
    day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    day_name = day_names[meal_date.weekday()]
    day_raw = getattr(weekly_menu, day_name, {}) if weekly_menu else {}
    if day_raw is None:
        day_raw = {}
    
    if isinstance(day_raw, str):
        try:
            day_menu = json.loads(day_raw)
        except:
            day_menu = {}
    else:
        day_menu = day_raw

    # NUEVO: Si los datos vienen como una lista (posiblemente de semanas)
    if isinstance(day_menu, list):
        idx = (active_plan.current_week - 1) if active_plan else 0
        if len(day_menu) > idx:
            day_menu = day_menu[idx]
        elif len(day_menu) > 0:
            day_menu = day_menu[0]
        else:
            day_menu = {}

    # NUEVO: Si los datos vienen como una lista de "meals" (formato del Admin Panel)
    if isinstance(day_menu, dict) and "meals" in day_menu and isinstance(day_menu["meals"], list):
        new_day_menu = {}
        for m in day_menu["meals"]:
            if isinstance(m, dict) and "type" in m:
                new_day_menu[m["type"]] = m
        day_menu = new_day_menu
    
    meal_structure = [
        {"id": "breakfast", "name": "Desayuno"},
        {"id": "morning_snack", "name": "Snack AM"},
        {"id": "lunch", "name": "Almuerzo"},
        {"id": "afternoon_snack", "name": "Snack PM"},
        {"id": "dinner", "name": "Cena"},
    ]
    
    # Mapeo de búsqueda para llaves en diferentes idiomas/formatos
    key_mapping = {
        "breakfast": ["breakfast", "desayuno"],
        "desayuno": ["breakfast", "desayuno"],
        "morning_snack": ["morning_snack", "snack_am", "media_manana", "merienda_manana", "almuerzo"],
        "snack_am": ["morning_snack", "snack_am", "media_manana", "merienda_manana", "almuerzo"],
        "media_manana": ["morning_snack", "snack_am", "media_manana", "merienda_manana", "almuerzo"],
        "lunch": ["lunch", "comida", "almuerzo_principal"],
        "comida": ["lunch", "comida", "almuerzo_principal"],
        "afternoon_snack": ["afternoon_snack", "snack_pm", "media_tarde", "merienda_tarde", "merienda"],
        "snack_pm": ["afternoon_snack", "snack_pm", "media_tarde", "merienda_tarde", "merienda"],
        "media_tarde": ["afternoon_snack", "snack_pm", "media_tarde", "merienda_tarde", "merienda"],
        "dinner": ["dinner", "cena"],
        "cena": ["dinner", "cena"]
    }
    
    for meal_info in meal_structure:
        # Buscar la comida usando el mapeo de llaves
        meal_data = None
        possible_keys = key_mapping.get(meal_info["id"], [meal_info["id"]])
        
        for pk in possible_keys:
            if pk in day_menu:
                meal_data = day_menu[pk]
                break
        
        if not meal_data:
            continue

        if isinstance(meal_data, str):
            try:
                meal_data = json.loads(meal_data)
            except:
                meal_data = {"receta": meal_data}

        # Crear tracking de comida
        meal_tracking = MealTrackingDB(
            patient_id=patient_id,
            date=meal_date,
            meal_type=meal_info["id"],
            meal_name=meal_info["name"],
            calories=meal_data.get("calorias") or 0,
            completed=0,
            created_at=now_co().strftime("%Y-%m-%d %H:%M:%S")
        )
        db.add(meal_tracking)
        db.flush()
        
        # Obtener personalizaciones de porciones para este día/comida
        plan_metadata = {"fase_4": active_plan.meal_plan.fase_4 if active_plan and active_plan.meal_plan else {}}
        custom_portions = get_custom_portions_for_day(active_plan.current_week, day_name, plan_metadata)
        
        # Intentar por tipo (ej. "breakfast") o por el índice real de card
        meal_custom = custom_portions.get(str(meal_info["id"])) or custom_portions.get(meal_info["id"])
        if not meal_custom:
            # Fallback al índice en el que estamos procesando (asumiendo orden estándar)
            # Contar cuántas comidas hemos procesado hasta ahora para este día
            current_meal_count = db.query(MealTrackingDB).filter(
                MealTrackingDB.patient_id == patient_id,
                MealTrackingDB.date == meal_date
            ).count()
            meal_custom = custom_portions.get(str(current_meal_count)) or custom_portions.get(current_meal_count) or {}
        else:
             meal_custom = meal_custom or {}

        # Agregar alimentos basados en el plan
        foods = generate_default_foods_for_meal(meal_info["id"], meal_data)
        for idx, food in enumerate(foods):
            food_name = food["name"]
            # Si hay una porción personalizada en fase_4, usarla
            final_portion = food.get("portion") or food.get("portion_size") or "1 porción"
            if food_name in meal_custom:
                grams = meal_custom[food_name]
                if grams and str(grams).strip() != "":
                    final_portion = f"{grams}g"

            food_item = MealFoodItemDB(
                meal_tracking_id=meal_tracking.id,
                name=food_name,
                portion_size=final_portion,
                calories=food["calories"],
                protein=food.get("protein") or 0,
                carbs=food.get("carbs") or 0,
                fat=food.get("fat") or 0,
                checked=0,
                order_index=idx
            )
            db.add(food_item)
    
    db.commit()
    return True

@app.get("/api/dashboard/top-patients-progress")
def get_top_patients_progress(
    limit: int = 3,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """
    Obtener los pacientes con mejor progreso para el dashboard del admin.
    Si el usuario es admin (nutricionista), solo sus pacientes asignados.
    """
    query = db.query(UserDB).filter(UserDB.role == "patient")
    if current_user.role == "admin":
        query = query.filter(UserDB.nutritionist_id == current_user.id)
    patients = query.all()
    
    patient_progress_list = []
    
    for patient in patients:
        # Obtener plan activo
        active_plan = db.query(PatientMealPlanDB).filter(
            PatientMealPlanDB.patient_id == patient.id,
            PatientMealPlanDB.status == "active"
        ).first()
        
        if not active_plan:
            continue
        
        # Obtener plan nutricional
        meal_plan = db.query(MealPlanDB).filter(
            MealPlanDB.id == active_plan.meal_plan_id
        ).first()
        
        # Calcular progreso (dirección correcta: perder vs ganar)
        peso_inicial = patient.peso_inicial or patient.peso_actual
        peso_actual = patient.peso_actual
        peso_objetivo = patient.peso_objetivo
        
        if peso_inicial is None or peso_actual is None or peso_objetivo is None:
            continue
        
        # Cambio de peso: positivo = subió, negativo = bajó (para mostrar +21 kg / -85 kg)
        peso_cambio = peso_actual - peso_inicial
        # Porcentaje de meta usando la misma lógica que el resto (solo cuenta si va en la dirección correcta)
        progreso_porcentaje = calcular_progreso(peso_actual, peso_objetivo, peso_inicial)
        
        patient_progress_list.append({
            "id": patient.id,
            "name": f"{patient.nombres} {patient.apellidos}",
            "plan_name": meal_plan.name if meal_plan else "Plan Nutricional",
            "weight_change": round(peso_cambio, 1),
            "progress_percentage": progreso_porcentaje,
            "progress_pct": progreso_porcentaje,
            "progreso": progreso_porcentaje,
            "avatar": get_absolute_url(patient.foto_perfil)
        })
    
    # Ordenar por progreso descendente y tomar los top N
    patient_progress_list.sort(key=lambda x: x["progress_percentage"], reverse=True)
    top_patients = patient_progress_list[:limit]
    
    return top_patients

# ==================== ENDPOINTS DE ACCIONES ====================

@app.post("/api/patient/{patient_id}/meals/food/toggle")
def toggle_food_item(
    patient_id: int,
    toggle_data: ToggleFoodRequest,
    db: Session = Depends(get_db)
):
    """
    Marcar/desmarcar un alimento específico dentro de una comida
    """
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    meal_date = datetime.strptime(toggle_data.date, "%Y-%m-%d").date() if toggle_data.date else today_co()
    
    # Buscar el tracking de la comida
    meal_tracking = db.query(MealTrackingDB).filter(
        MealTrackingDB.patient_id == patient_id,
        MealTrackingDB.date == meal_date,
        MealTrackingDB.meal_type == toggle_data.meal_type
    ).first()
    
    if not meal_tracking:
        # Intentar inicializar si falta
        meal_tracking = initialize_single_meal_from_plan(patient_id, meal_date, toggle_data.meal_type, db)
        
    if not meal_tracking:
        raise HTTPException(status_code=404, detail="Comida no encontrada")
    
    # Buscar el alimento
    food_item = db.query(MealFoodItemDB).filter(
        MealFoodItemDB.meal_tracking_id == meal_tracking.id,
        MealFoodItemDB.name == toggle_data.food_name
    ).first()
    
    if not food_item:
        raise HTTPException(status_code=404, detail="Alimento no encontrado")
    
    # Toggle checked
    food_item.checked = 1 if food_item.checked == 0 else 0
    
    # Verificar si todos los alimentos están marcados
    all_foods = db.query(MealFoodItemDB).filter(
        MealFoodItemDB.meal_tracking_id == meal_tracking.id
    ).all()
    
    all_checked = all(f.checked == 1 for f in all_foods)
    
    # Actualizar estado de la comida
    if all_checked:
        meal_tracking.completed = 1
        meal_tracking.completed_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
    else:
        meal_tracking.completed = 0
        meal_tracking.completed_at = None
    
    db.commit()
    
    return {
        "success": True,
        "food_name": food_item.name,
        "checked": bool(food_item.checked),
        "meal_completed": all_checked
    }

@app.post("/api/tracking/meal-toggle/{patient_id}/{action}")
def toggle_meal_status(
    patient_id: int,
    action: str, # complete or uncomplete
    data: MealLogRequest,
    db: Session = Depends(get_db)
):
    """Marcar/desmarcar una comida completa de forma unificada"""
    meal_date = datetime.strptime(data.date, "%Y-%m-%d").date()
    
    meal_tracking = db.query(MealTrackingDB).filter(
        MealTrackingDB.patient_id == patient_id,
        MealTrackingDB.date == meal_date,
        MealTrackingDB.meal_type == data.meal_type
    ).first()
    
    if action == "complete":
        if not meal_tracking:
            meal_tracking = initialize_single_meal_from_plan(patient_id, meal_date, data.meal_type, db)
            
        if not meal_tracking:
            raise HTTPException(status_code=404, detail="Comida no encontrada")
        
        meal_tracking.completed = 1
        meal_tracking.completed_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        
        db.query(MealFoodItemDB).filter(
            MealFoodItemDB.meal_tracking_id == meal_tracking.id
        ).update({"checked": 1})
        
        db.commit()
        return {"success": True, "message": "Comida completada"}
        
    elif action == "uncomplete":
        if not meal_tracking:
            return {"success": True, "message": "Comida desmarcada"}
        
        meal_tracking.completed = 0
        meal_tracking.completed_at = None
        
        db.query(MealFoodItemDB).filter(
            MealFoodItemDB.meal_tracking_id == meal_tracking.id
        ).update({"checked": 0})
        
        db.commit()
        return {"success": True, "message": "Comida desmarcada"}
    
    else:
        raise HTTPException(status_code=400, detail="Acción no válida")

@app.post("/api/patient/{patient_id}/meals/food/add")
def add_food_to_meal(
    patient_id: int,
    food_data: AddFoodToMealRequest,
    db: Session = Depends(get_db)
):
    """
    Agregar un alimento personalizado a una comida
    """
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    meal_date = datetime.strptime(food_data.date, "%Y-%m-%d").date() if food_data.date else today_co()
    
    # Buscar o crear el tracking de la comida
    meal_tracking = db.query(MealTrackingDB).filter(
        MealTrackingDB.patient_id == patient_id,
        MealTrackingDB.date == meal_date,
        MealTrackingDB.meal_type == food_data.meal_type
    ).first()
    
    if not meal_tracking:
        meal_tracking = MealTrackingDB(
            patient_id=patient_id,
            date=meal_date,
            meal_type=food_data.meal_type,
            meal_name=f"Comida {food_data.meal_type}",
            calories=0,
            completed=0,
            created_at=now_co().strftime("%Y-%m-%d %H:%M:%S")
        )
        db.add(meal_tracking)
        db.flush()
    
    # Obtener el índice de orden más alto
    max_order = db.query(func.max(MealFoodItemDB.order_index)).filter(
        MealFoodItemDB.meal_tracking_id == meal_tracking.id
    ).scalar() or 0
    
    # Crear el nuevo alimento
    new_food = MealFoodItemDB(
        meal_tracking_id=meal_tracking.id,
        name=food_data.food.name,
        portion_size=food_data.food.portion_size,
        calories=food_data.food.calories,
        protein=food_data.food.protein,
        carbs=food_data.food.carbs,
        fat=food_data.food.fat,
        checked=0,
        order_index=max_order + 1
    )
    
    db.add(new_food)
    db.commit()
    db.refresh(new_food)
    
    return {
        "success": True,
        "message": "Alimento agregado correctamente",
        "food": {
            "name": new_food.name,
            "portion_size": new_food.portion_size,
            "calories": new_food.calories,
            "protein": new_food.protein,
            "carbs": new_food.carbs,
            "fat": new_food.fat
        }
    }

@app.delete("/api/patient/{patient_id}/meals/food/remove")
def remove_food_from_meal(
    patient_id: int,
    meal_type: str,
    food_name: str,
    date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Eliminar un alimento de una comida
    """
    meal_date = datetime.strptime(date, "%Y-%m-%d").date() if date else today_co()
    
    # Buscar el tracking de la comida
    meal_tracking = db.query(MealTrackingDB).filter(
        MealTrackingDB.patient_id == patient_id,
        MealTrackingDB.date == meal_date,
        MealTrackingDB.meal_type == meal_type
    ).first()
    
    if not meal_tracking:
        raise HTTPException(status_code=404, detail="Comida no encontrada")
    
    # Buscar y eliminar el alimento
    food_item = db.query(MealFoodItemDB).filter(
        MealFoodItemDB.meal_tracking_id == meal_tracking.id,
        MealFoodItemDB.name == food_name
    ).first()
    
    if not food_item:
        raise HTTPException(status_code=404, detail="Alimento no encontrado")
    
    db.delete(food_item)
    db.commit()
    
    return {
        "success": True,
        "message": "Alimento eliminado correctamente"
    }

@app.post("/api/patient/{patient_id}/meals/initialize")
def initialize_meals_for_day(
    patient_id: int,
    date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Inicializar las comidas del día con los alimentos del plan
    """
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    meal_date = datetime.strptime(date, "%Y-%m-%d").date() if date else today_co()
    
    # Verificar si ya existen comidas para este día
    existing = db.query(MealTrackingDB).filter(
        MealTrackingDB.patient_id == patient_id,
        MealTrackingDB.date == meal_date
    ).first()
    
    if existing:
        return {
            "success": False,
            "message": "Las comidas de este día ya están inicializadas"
        }
    
    # Obtener plan activo
    active_plan = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.patient_id == patient_id,
        PatientMealPlanDB.status == "active"
    ).order_by(PatientMealPlanDB.id.desc()).first()
    
    if not active_plan:
        raise HTTPException(status_code=404, detail="No tienes un plan activo")
    
    # Obtener el menú semanal
    plan = db.query(MealPlanDB).filter(MealPlanDB.id == active_plan.meal_plan_id).first()
    weekly_menu = db.query(WeeklyMenuDB).filter(
        WeeklyMenuDB.meal_plan_id == plan.id,
        WeeklyMenuDB.week_number == active_plan.current_week
    ).first()
    
    _internal_initialize_meals(patient_id, meal_date, db, active_plan, weekly_menu)
    
    return {
        "success": True,
        "message": "Comidas inicializadas correctamente basadas en tu plan"
    }

@app.get("/api/patient/{patient_id}/meals/search")
def search_foods(
    patient_id: int,
    query: str,
    db: Session = Depends(get_db)
):
    """
    Buscar alimentos (personalizados o de una base de datos)
    """
    # Buscar en alimentos personalizados del paciente
    custom_foods = db.query(CustomFoodDB).filter(
        CustomFoodDB.patient_id == patient_id,
        CustomFoodDB.name.contains(query)
    ).limit(10).all()
    
    results = [
        {
            "name": food.name,
            "portion_size": food.portion_size,
            "calories": food.calories,
            "protein": food.protein,
            "carbs": food.carbs,
            "fat": food.fat,
            "custom": True
        }
        for food in custom_foods
    ]
    
    return {
        "results": results,
        "query": query
    }

def calculate_weekly_totals(week_data: List[dict]) -> dict:
    """Calcular totales y promedios de un menú semanal (kcal/día = promedio por día con comidas)."""
    total_calories = 0
    total_protein = 0
    total_carbs = 0
    total_fat = 0
    days_with_meals = 0
    
    for day in week_data:
        day_calories = 0
        day_protein = 0
        day_carbs = 0
        day_fat = 0
        for meal in day.get("meals", []):
            # Considerar comida si tiene receta (recipe, recipe_id, recipe_name) o calorías
            has_recipe = meal.get("recipe") or meal.get("recipe_id") or meal.get("recipe_name")
            if has_recipe or meal.get("calories", 0) > 0:
                day_calories += meal.get("calories", 0)
                day_protein += meal.get("protein", 0)
                day_carbs += meal.get("carbs", 0)
                day_fat += meal.get("fat", 0)
        if day_calories > 0 or day_protein > 0 or day_carbs > 0 or day_fat > 0:
            days_with_meals += 1
            total_calories += day_calories
            total_protein += day_protein
            total_carbs += day_carbs
            total_fat += day_fat
    
    n = days_with_meals if days_with_meals > 0 else 1
    return {
        "total_calories": total_calories // n,
        "avg_protein": total_protein // n,
        "avg_carbs": total_carbs // n,
        "avg_fat": total_fat // n
    }

def serialize_weekly_menu(menu: WeeklyMenuCompleteDB) -> dict:
    """Serializar un menú semanal completo"""
    days_map = {
        "monday": "Lunes",
        "tuesday": "Martes",
        "wednesday": "Miércoles",
        "thursday": "Jueves",
        "friday": "Viernes",
        "saturday": "Sábado",
        "sunday": "Domingo"
    }
    
    week_data = []
    
    # Detectar si es estructura antigua (dict) o nueva (list)
    # Detectar si es estructura antigua (dict) o nueva (list)
    # Primero intentar parsear si es string
    monday_data = menu.monday
    if isinstance(monday_data, str):
        try:
            monday_data = json.loads(monday_data)
        except:
            monday_data = {}
            
    is_new_structure = isinstance(monday_data, list)
    
    if is_new_structure:
        # Estructura nueva: listas de 4 semanas
        for week_num in range(1, 5):
            idx = week_num - 1
            for day_key, day_name in days_map.items():
                day_col = getattr(menu, day_key, [])
                
                # Parsear si es string
                if isinstance(day_col, str):
                    try:
                        day_col = json.loads(day_col)
                    except:
                        day_col = []

                # Asegurar que existe data para esa semana
                day_meals = {}
                if isinstance(day_col, list) and len(day_col) > idx:
                    day_meals = day_col[idx]
                elif isinstance(day_col, dict): 
                    # Fallback por si acaso
                    day_meals = day_col
                
                week_data.append({
                    "day": day_name,
                    "week": week_num,
                    "meals": day_meals.get("meals", []) if isinstance(day_meals, dict) else []
                })
    else:
        # Estructura antigua: un solo dict por día
        for day_key, day_name in days_map.items():
            day_meals = getattr(menu, day_key, {})
            # Parsear si es string
            if isinstance(day_meals, str):
                try:
                    day_meals = json.loads(day_meals)
                except:
                    day_meals = {}

            week_data.append({
                "day": day_name,
                "week": 1,
                "meals": day_meals.get("meals", []) if isinstance(day_meals, dict) else []
            })
    
    # Recalcular totales desde week_data para que kcal/día salga siempre correcto
    computed = calculate_weekly_totals(week_data)
    
    return {
        "id": menu.id,
        "name": menu.name,
        "description": menu.description,
        "category": menu.category,
        "week": week_data,
        "total_calories": computed["total_calories"],
        "avg_protein": computed["avg_protein"],
        "avg_carbs": computed["avg_carbs"],
        "avg_fat": computed["avg_fat"],
        "assigned_patients": menu.assigned_patients,
        "is_active": menu.is_active,
        "created_at": menu.created_at
    }


WEEKLY_MENU_DAY_KEYS = [
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
]
WEEKLY_MENU_DAY_NAMES = {
    "monday": "Lunes",
    "tuesday": "Martes",
    "wednesday": "Miércoles",
    "thursday": "Jueves",
    "friday": "Viernes",
    "saturday": "Sábado",
    "sunday": "Domingo",
}


def parse_menu_json_maybe(value):
    if value is None:
        return {}
    parsed = value
    if isinstance(parsed, str):
        try:
            parsed = json.loads(parsed)
        except Exception:
            return {}
    if isinstance(parsed, str):
        try:
            parsed = json.loads(parsed)
        except Exception:
            return {}
    return parsed


def get_complete_menu_day_for_week(menu: WeeklyMenuCompleteDB, day_key: str, week_num: int) -> dict:
    """Obtiene el dict del día para la semana 1..4 (soporta lista de 4 semanas o dict legacy)."""
    raw = parse_menu_json_maybe(getattr(menu, day_key, None))
    idx = max(1, min(4, int(week_num or 1))) - 1
    if isinstance(raw, list):
        if idx < len(raw) and isinstance(raw[idx], dict):
            return raw[idx]
        if raw and isinstance(raw[0], dict):
            return raw[0]
        return {"meals": []}
    if isinstance(raw, dict):
        return raw
    return {"meals": []}


def extract_day_meals_list(day_data) -> list:
    if not isinstance(day_data, dict):
        return []
    meals = day_data.get("meals", [])
    return meals if isinstance(meals, list) else []


def apply_meals_to_daily_assignment(daily: DailyMealAssignmentDB, meals: list):
    """
    Mapeo alineado con mealSchedule.ts:
    desayuno, almuerzo=Snack#1, comida=Almuerzo, merienda=Snack#2, cena.
    """
    for meal in meals:
        if not isinstance(meal, dict):
            continue
        meal_type = str(meal.get("type", "")).lower().strip()
        if meal_type in ("desayuno", "breakfast"):
            daily.breakfast = meal
        elif meal_type in ("almuerzo", "morning_snack", "snack_am", "media_manana", "media_mañana"):
            daily.morning_snack = meal
        elif meal_type in ("comida", "lunch", "almuerzo_principal"):
            daily.lunch = meal
        elif meal_type in ("merienda", "afternoon_snack", "snack_pm", "media_tarde"):
            daily.afternoon_snack = meal
        elif meal_type in ("cena", "dinner"):
            daily.dinner = meal
        elif meal_type in ("snack", "snack_noche", "evening_snack"):
            daily.evening_snack = meal


def copy_complete_menu_weeks_to_plan(db: Session, plan_id: int, menu: WeeklyMenuCompleteDB) -> int:
    """Reemplaza WeeklyMenuDB del plan con 4 semanas expandidas desde la plantilla."""
    db.query(WeeklyMenuDB).filter(WeeklyMenuDB.meal_plan_id == plan_id).delete()
    created = 0
    for week_num in range(1, 5):
        day_payload = {
            day_key: get_complete_menu_day_for_week(menu, day_key, week_num)
            for day_key in WEEKLY_MENU_DAY_KEYS
        }
        db.add(
            WeeklyMenuDB(
                meal_plan_id=plan_id,
                week_number=week_num,
                monday=day_payload["monday"],
                tuesday=day_payload["tuesday"],
                wednesday=day_payload["wednesday"],
                thursday=day_payload["thursday"],
                friday=day_payload["friday"],
                saturday=day_payload["saturday"],
                sunday=day_payload["sunday"],
            )
        )
        created += 1
    return created


def generate_daily_assignments_from_complete_menu(
    db: Session,
    assignment_id: int,
    menu: WeeklyMenuCompleteDB,
    start_date,
    *,
    days: int = 28,
) -> int:
    """Genera comidas diarias (por defecto 28 días / 4 semanas) desde plantilla."""
    created = 0
    for i in range(days):
        current_date = start_date + timedelta(days=i)
        week_num = ((i // 7) % 4) + 1
        day_key = WEEKLY_MENU_DAY_KEYS[current_date.weekday()]
        day_name = WEEKLY_MENU_DAY_NAMES[day_key]
        day_data = get_complete_menu_day_for_week(menu, day_key, week_num)
        meals = extract_day_meals_list(day_data)

        daily = DailyMealAssignmentDB(
            patient_meal_plan_id=assignment_id,
            date=current_date,
            day_of_week=day_name,
            generated_from_menu_id=menu.id,
            breakfast={},
            morning_snack={},
            lunch={},
            afternoon_snack={},
            dinner={},
            evening_snack={},
        )
        apply_meals_to_daily_assignment(daily, meals)
        db.add(daily)
        created += 1
    return created


def build_week_payload_from_complete_menu(menu: WeeklyMenuCompleteDB, week_num: int = 1) -> list:
    week_data = []
    for day_key, day_name in WEEKLY_MENU_DAY_NAMES.items():
        day_meals = get_complete_menu_day_for_week(menu, day_key, week_num)
        week_data.append(
            {
                "day": day_name,
                "week": week_num,
                "meals": extract_day_meals_list(day_meals),
            }
        )
    return week_data

# ==================== ENDPOINTS PARA WEEKLY MENUS ====================

def _menu_query_for_user(db: Session, current_user: Optional[UserDB]):
    """Query de menús: si es admin solo los creados por él; superadmin/sin usuario ven todos."""
    q = db.query(WeeklyMenuCompleteDB).filter(WeeklyMenuCompleteDB.is_active == 1)
    if current_user and getattr(current_user, "role", None) == "admin":
        q = q.filter(WeeklyMenuCompleteDB.created_by_id == current_user.id)
    return q

def _authorize_menu_access(menu: WeeklyMenuCompleteDB, current_user: UserDB):
    """Si es admin solo puede acceder a menús creados por él; superadmin puede todo."""
    if getattr(current_user, "role", None) == "admin":
        if menu.created_by_id is not None and menu.created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="No autorizado a modificar este menú")

@app.get("/api/weekly-menus")
def get_weekly_menus(
    search: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[UserDB] = Depends(get_current_user_optional)
):
    """
    Obtener todos los menús semanales con filtros opcionales
    """
    query = _menu_query_for_user(db, current_user)
    
    if search:
        query = query.filter(
            (WeeklyMenuCompleteDB.name.contains(search)) |
            (WeeklyMenuCompleteDB.description.contains(search))
        )
    
    if category:
        query = query.filter(WeeklyMenuCompleteDB.category == category)
    
    menus = query.order_by(WeeklyMenuCompleteDB.created_at.desc()).all()
    
    return [serialize_weekly_menu(menu) for menu in menus]


@app.get("/api/weekly-menus/stats")
def get_weekly_menus_stats(
    db: Session = Depends(get_db),
    current_user: Optional[UserDB] = Depends(get_current_user_optional),
):
    """Estadísticas de menús semanales (scoped al nutricionista si es admin)."""
    query = _menu_query_for_user(db, current_user)
    menus = query.all()
    total_menus = len(menus)
    total_assigned = sum((m.assigned_patients or 0) for m in menus)
    avg_calories = (
        int(sum((m.total_calories or 0) for m in menus) / total_menus) if total_menus else 0
    )

    unique_recipes = set()
    for menu in menus:
        for day in WEEKLY_MENU_DAY_KEYS:
            for week_num in range(1, 5):
                day_data = get_complete_menu_day_for_week(menu, day, week_num)
                for meal in extract_day_meals_list(day_data):
                    if meal.get("recipe_id"):
                        unique_recipes.add(meal["recipe_id"])

    return {
        "total_menus": total_menus,
        "total_assigned_patients": total_assigned,
        "avg_calories": avg_calories,
        "total_recipes_used": len(unique_recipes),
    }


@app.get("/api/weekly-menus/categories")
def get_menu_categories(
    db: Session = Depends(get_db),
    current_user: Optional[UserDB] = Depends(get_current_user_optional),
):
    """Categorías de menús disponibles (scoped)."""
    menus = _menu_query_for_user(db, current_user).all()
    counts: Dict[str, int] = {}
    for menu in menus:
        cat = menu.category or "Sin categoría"
        counts[cat] = counts.get(cat, 0) + 1
    return [{"name": name, "count": count} for name, count in sorted(counts.items())]


@app.get("/api/weekly-menus/{menu_id}")
def get_weekly_menu(
    menu_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[UserDB] = Depends(get_current_user_optional)
):
    """
    Obtener un menú semanal específico
    """
    menu = db.query(WeeklyMenuCompleteDB).filter(
        WeeklyMenuCompleteDB.id == menu_id
    ).first()
    
    if not menu:
        raise HTTPException(status_code=404, detail="Menú no encontrado")
    if current_user and getattr(current_user, "role", None) == "admin":
        if menu.created_by_id is not None and menu.created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="No autorizado a ver este menú")
    
    return serialize_weekly_menu(menu)

@app.post("/api/weekly-menus")
def create_weekly_menu(
    menu_data: WeeklyMenuCompleteCreate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """
    Crear un nuevo menú semanal
    """
    now = now_co().strftime("%Y-%m-%d %H:%M:%S")
    
    # Mapear días en español a inglés
    days_map = {
        "Lunes": "monday",
        "Martes": "tuesday",
        "Miércoles": "wednesday",
        "Jueves": "thursday",
        "Viernes": "friday",
        "Sábado": "saturday",
        "Domingo": "sunday"
    }
    
    # Preparar datos de la semana
    # Inicializar estructura de listas para 4 semanas
    week_dict = {
        "monday": [{}, {}, {}, {}],
        "tuesday": [{}, {}, {}, {}],
        "wednesday": [{}, {}, {}, {}],
        "thursday": [{}, {}, {}, {}],
        "friday": [{}, {}, {}, {}],
        "saturday": [{}, {}, {}, {}],
        "sunday": [{}, {}, {}, {}]
    }
    
    for day_data in menu_data.week:
        day_key = days_map.get(day_data.day)
        week_idx = (day_data.week - 1) if day_data.week else 0
        
        if day_key and 0 <= week_idx < 4:
            week_dict[day_key][week_idx] = {
                "meals": [meal.model_dump() for meal in day_data.meals]
            }
    
    # Calcular totales
    totals = calculate_weekly_totals([
        {"meals": [m.model_dump() for m in d.meals]} 
        for d in menu_data.week
    ])
    
    creator_id = current_user.id if getattr(current_user, "role", None) in ("admin", "superadmin") else None
    new_menu = WeeklyMenuCompleteDB(
        name=menu_data.name,
        description=menu_data.description,
        category=menu_data.category,
        monday=week_dict.get("monday", {}),
        tuesday=week_dict.get("tuesday", {}),
        wednesday=week_dict.get("wednesday", {}),
        thursday=week_dict.get("thursday", {}),
        friday=week_dict.get("friday", {}),
        saturday=week_dict.get("saturday", {}),
        sunday=week_dict.get("sunday", {}),
        total_calories=totals["total_calories"],
        avg_protein=totals["avg_protein"],
        avg_carbs=totals["avg_carbs"],
        avg_fat=totals["avg_fat"],
        assigned_patients=0,
        is_active=1,
        created_at=now,
        updated_at=now,
        created_by_id=creator_id
    )
    
    try:
        db.add(new_menu)
        db.commit()
        db.refresh(new_menu)
        
        return {
            "success": True,
            "message": "Menú semanal creado correctamente",
            "menu": serialize_weekly_menu(new_menu)
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al crear menú: {str(e)}")

@app.put("/api/weekly-menus/{menu_id}")
def update_weekly_menu(
    menu_id: int,
    menu_data: WeeklyMenuCompleteUpdate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """
    Actualizar un menú semanal existente
    """
    menu = db.query(WeeklyMenuCompleteDB).filter(
        WeeklyMenuCompleteDB.id == menu_id
    ).first()
    
    if not menu:
        raise HTTPException(status_code=404, detail="Menú no encontrado")
    _authorize_menu_access(menu, current_user)
    
    # Actualizar campos básicos
    if menu_data.name:
        menu.name = menu_data.name
    if menu_data.description:
        menu.description = menu_data.description
    if menu_data.category:
        menu.category = menu_data.category
    
    # Actualizar semana si se proporciona
    if menu_data.week:
        days_map = {
            "Lunes": "monday",
            "Martes": "tuesday",
            "Miércoles": "wednesday",
            "Jueves": "thursday",
            "Viernes": "friday",
            "Sábado": "saturday",
            "Domingo": "sunday"
        }
        
        # Inicializar si no existen como listas
        for dk in days_map.values():
            curr = getattr(menu, dk)
            if not isinstance(curr, list):
                setattr(menu, dk, [curr or {}, {}, {}, {}])

        for day_data in menu_data.week:
            day_key = days_map.get(day_data.day)
            week_idx = (day_data.week - 1) if day_data.week else 0
            
            if day_key and 0 <= week_idx < 4:
                # Obtener lista actual
                current_list = getattr(menu, day_key)
                # Asegurar longitud
                while len(current_list) < 4:
                    current_list.append({})
                    
                current_list[week_idx] = {
                    "meals": [meal.model_dump() for meal in day_data.meals]
                }
                # SQLAlchemy necesita detectar cambio en JSON
                flag_modified(menu, day_key)
        
        # Recalcular totales
        totals = calculate_weekly_totals([
            {"meals": [m.model_dump() for m in d.meals]} 
            for d in menu_data.week
        ])
        
        menu.total_calories = totals["total_calories"]
        menu.avg_protein = totals["avg_protein"]
        menu.avg_carbs = totals["avg_carbs"]
        menu.avg_fat = totals["avg_fat"]
    
    menu.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
    
    try:
        db.commit()
        db.refresh(menu)
        
        return {
            "success": True,
            "message": "Menú actualizado correctamente",
            "menu": serialize_weekly_menu(menu)
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al actualizar menú: {str(e)}")

@app.delete("/api/weekly-menus/{menu_id}")
def delete_weekly_menu(
    menu_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """
    Eliminar un menú semanal
    """
    menu = db.query(WeeklyMenuCompleteDB).filter(
        WeeklyMenuCompleteDB.id == menu_id
    ).first()
    
    if not menu:
        raise HTTPException(status_code=404, detail="Menú no encontrado")
    _authorize_menu_access(menu, current_user)
    
    # Verificar si tiene pacientes asignados
    if menu.assigned_patients > 0:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar. Hay {menu.assigned_patients} pacientes asignados"
        )
    
    try:
        db.delete(menu)
        db.commit()
        
        return {
            "success": True,
            "message": "Menú eliminado correctamente"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al eliminar menú: {str(e)}")

@app.post("/api/weekly-menus/{menu_id}/duplicate")
def duplicate_weekly_menu(
    menu_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """
    Duplicar un menú semanal
    """
    original = db.query(WeeklyMenuCompleteDB).filter(
        WeeklyMenuCompleteDB.id == menu_id
    ).first()
    
    if not original:
        raise HTTPException(status_code=404, detail="Menú no encontrado")
    _authorize_menu_access(original, current_user)
    
    now = now_co().strftime("%Y-%m-%d %H:%M:%S")
    
    creator_id = current_user.id if getattr(current_user, "role", None) in ("admin", "superadmin") else None
    duplicate = WeeklyMenuCompleteDB(
        name=f"{original.name} (Copia)",
        description=original.description,
        category=original.category,
        monday=original.monday,
        tuesday=original.tuesday,
        wednesday=original.wednesday,
        thursday=original.thursday,
        friday=original.friday,
        saturday=original.saturday,
        sunday=original.sunday,
        total_calories=original.total_calories,
        avg_protein=original.avg_protein,
        avg_carbs=original.avg_carbs,
        avg_fat=original.avg_fat,
        assigned_patients=0,
        is_active=1,
        created_at=now,
        updated_at=now,
        created_by_id=creator_id
    )
    
    try:
        db.add(duplicate)
        db.commit()
        db.refresh(duplicate)
        
        return {
            "success": True,
            "message": "Menú duplicado correctamente",
            "menu": serialize_weekly_menu(duplicate)
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al duplicar menú: {str(e)}")

@app.post("/api/weekly-menus/assign")
def assign_weekly_menu(
    assignment_data: AssignWeeklyMenuSchema,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """
    Asignar un menú semanal a uno o varios pacientes (crea plan temporal + 4 semanas).
    """
    menu = db.query(WeeklyMenuCompleteDB).filter(
        WeeklyMenuCompleteDB.id == assignment_data.menu_id
    ).first()

    if not menu:
        raise HTTPException(status_code=404, detail="Menú no encontrado")
    _authorize_menu_access(menu, current_user)

    patients = db.query(UserDB).filter(
        UserDB.id.in_(assignment_data.patient_ids),
        UserDB.role == "patient",
    ).all()

    if len(patients) != len(assignment_data.patient_ids):
        raise HTTPException(status_code=404, detail="Uno o más pacientes no encontrados")

    for patient in patients:
        authorize_patient_access(patient.id, current_user, db)

    assigned_count = 0
    errors = []

    try:
        start_date_obj = datetime.strptime(assignment_data.start_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD")

    for patient in patients:
        try:
            # Pausar planes activos previos
            previous_active = db.query(PatientMealPlanDB).filter(
                PatientMealPlanDB.patient_id == patient.id,
                PatientMealPlanDB.status == "active",
            ).all()
            for prev in previous_active:
                prev.status = "paused"

            temp_plan = MealPlanDB(
                name=menu.name,
                description=menu.description,
                calories=menu.total_calories,
                duration="4 semanas",
                category=menu.category,
                color="primary",
                protein_target=menu.avg_protein,
                carbs_target=menu.avg_carbs,
                fat_target=menu.avg_fat,
                meals_per_day=5,
                is_active=1,
                created_at=now_co().strftime("%Y-%m-%d %H:%M:%S"),
            )
            db.add(temp_plan)
            db.flush()

            copy_complete_menu_weeks_to_plan(db, temp_plan.id, menu)

            assignment = PatientMealPlanDB(
                patient_id=patient.id,
                meal_plan_id=temp_plan.id,
                assigned_date=now_co().strftime("%Y-%m-%d"),
                start_date=assignment_data.start_date,
                current_week=1,
                status="active",
                notes=assignment_data.notes,
            )
            db.add(assignment)
            db.flush()

            generate_daily_assignments_from_complete_menu(
                db, assignment.id, menu, start_date_obj, days=28
            )
            assigned_count += 1
        except Exception as e:
            errors.append(f"Error al asignar a {patient.nombres}: {str(e)}")

    menu.assigned_patients = (menu.assigned_patients or 0) + assigned_count

    try:
        db.commit()
        return {
            "success": True,
            "message": f"Menú asignado a {assigned_count} pacientes",
            "assigned_count": assigned_count,
            "errors": errors if errors else None,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al asignar menú: {str(e)}")

# ==================== ENDPOINTS PARA EXPORTAR/COMPARTIR ====================

@app.get("/api/weekly-menus/{menu_id}/export")
def export_weekly_menu(menu_id: int, db: Session = Depends(get_db)):
    """
    Exportar un menú semanal (retorna JSON estructurado para PDF o impresión)
    """
    menu = db.query(WeeklyMenuCompleteDB).filter(
        WeeklyMenuCompleteDB.id == menu_id
    ).first()
    
    if not menu:
        raise HTTPException(status_code=404, detail="Menú no encontrado")
    
    export_data = serialize_weekly_menu(menu)
    
    # Agregar información adicional para exportación
    export_data["export_date"] = now_co().strftime("%Y-%m-%d %H:%M:%S")
    export_data["export_format"] = "pdf"
    
    return export_data

@app.post("/api/weekly-menus/{menu_id}/share")
def share_weekly_menu(
    menu_id: int,
    share_with: List[str],  # Lista de emails
    db: Session = Depends(get_db)
):
    """
    Compartir un menú semanal (placeholder para funcionalidad de compartir)
    """
    menu = db.query(WeeklyMenuCompleteDB).filter(
        WeeklyMenuCompleteDB.id == menu_id
    ).first()
    
    if not menu:
        raise HTTPException(status_code=404, detail="Menú no encontrado")
    
    # Aquí implementarías la lógica de compartir
    # Por ahora retornamos success
    
    return {
        "success": True,
        "message": f"Menú compartido con {len(share_with)} personas",
        "shared_with": share_with
    }

# Agregar al main.py

@app.post("/api/patient/{patient_id}/change-weekly-menu")
def change_patient_weekly_menu(
    patient_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """
    Cambia el menú semanal de un paciente sin perder su progreso pasado.
    Actualiza WeeklyMenuDB del plan y regenera comidas futuras (28 días).
    """
    authorize_patient_access(patient_id, current_user, db)
    new_menu_id = data.get("weekly_menu_id")
    start_date_str = data.get("start_date")

    if not new_menu_id:
        raise HTTPException(status_code=400, detail="Falta weekly_menu_id")

    active_plan = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.patient_id == patient_id,
        PatientMealPlanDB.status == "active",
    ).order_by(PatientMealPlanDB.id.desc()).first()

    if not active_plan:
        raise HTTPException(status_code=404, detail="No hay plan activo para este paciente")

    new_menu = db.query(WeeklyMenuCompleteDB).filter(
        WeeklyMenuCompleteDB.id == new_menu_id
    ).first()
    if not new_menu:
        raise HTTPException(status_code=404, detail="Menú no encontrado")

    if current_user.role in ("admin", "superadmin"):
        _authorize_menu_access(new_menu, current_user)

    if start_date_str:
        try:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha inválido")
    else:
        start_date = today_co() + timedelta(days=1)

    db.query(DailyMealAssignmentDB).filter(
        DailyMealAssignmentDB.patient_meal_plan_id == active_plan.id,
        DailyMealAssignmentDB.date >= start_date,
    ).delete()

    copy_complete_menu_weeks_to_plan(db, active_plan.meal_plan_id, new_menu)
    days_created = generate_daily_assignments_from_complete_menu(
        db, active_plan.id, new_menu, start_date, days=28
    )
    active_plan.current_week = 1

    db.commit()

    return {
        "success": True,
        "message": f"Menú cambiado exitosamente. Inicia el {start_date.strftime('%Y-%m-%d')}",
        "days_created": days_created,
        "new_menu": {
            "id": new_menu.id,
            "name": new_menu.name,
            "start_date": start_date.strftime("%Y-%m-%d"),
        },
    }

@app.get("/api/patient/{patient_id}/menu-history")
def get_patient_menu_history(patient_id: int, db: Session = Depends(get_db)):
    """
    Obtiene el historial de menús del paciente
    """
    active_plan = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.patient_id == patient_id,
        PatientMealPlanDB.status == "active"
    ).order_by(PatientMealPlanDB.id.desc()).first()
    
    if not active_plan:
        return {"history": []}
    
    # Obtener menús únicos usados
    menus_used = db.query(
        DailyMealAssignmentDB.generated_from_menu_id,
        func.min(DailyMealAssignmentDB.date).label("start_date"),
        func.max(DailyMealAssignmentDB.date).label("end_date")
    ).filter(
        DailyMealAssignmentDB.patient_meal_plan_id == active_plan.id,
        DailyMealAssignmentDB.generated_from_menu_id.isnot(None)
    ).group_by(
        DailyMealAssignmentDB.generated_from_menu_id
    ).all()
    
    history = []
    for menu_id, start, end in menus_used:
        menu = db.query(WeeklyMenuCompleteDB).filter(
            WeeklyMenuCompleteDB.id == menu_id
        ).first()
        
        if menu:
            history.append({
                "menu_id": menu.id,
                "menu_name": menu.name,
                "start_date": start.strftime("%Y-%m-%d"),
                "end_date": end.strftime("%Y-%m-%d"),
                "is_current": end >= today_co()
            })
    
    return {"history": history}
@app.get("/api/meal-plans", response_model=List[Dict[str, Any]])
def get_all_meal_plans(db: Session = Depends(get_db)):
    """Trae todos los planes y calcula cuántos pacientes tiene cada uno"""
    plans = db.query(MealPlanDB).all()
    
    result = []
    for plan in plans:
        # Contamos pacientes activos para que el front no se quede vacío
        patient_count = db.query(PatientMealPlanDB).filter(
            PatientMealPlanDB.meal_plan_id == plan.id,
            PatientMealPlanDB.status == "active"
        ).count()
        
        # Convertimos a diccionario y añadimos el conteo que pide tu interfaz
        plan_dict = {
            "id": plan.id,
            "name": plan.name,
            "description": plan.description,
            "calories": plan.calories,
            "duration": plan.duration,
            "category": plan.category,
            "color": plan.color,
            "protein_target": plan.protein_target,
            "carbs_target": plan.carbs_target,
            "fat_target": plan.fat_target,
            "meals_per_day": plan.meals_per_day,
            "is_active": plan.is_active,
            "created_at": plan.created_at,
            "patients": patient_count  # <-- Esto es vital para tu front
        }
        result.append(plan_dict)
    return result

@app.delete("/api/meal-plans/{plan_id}")
def delete_meal_plan(plan_id: int, db: Session = Depends(get_db)):
    """Borra un plan si no tiene gente asignada"""
    plan = db.query(MealPlanDB).filter(MealPlanDB.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado, manit@")
    
    # Seguridad: No borrar si hay pacientes
    has_patients = db.query(PatientMealPlanDB).filter(PatientMealPlanDB.meal_plan_id == plan_id).first()
    if has_patients:
        raise HTTPException(status_code=400, detail="El plan tiene pacientes, no se puede borrar")

    db.delete(plan)
    db.commit()
    return {"message": "Plan borrado, parche"}
# ==================== CREAR TABLA EN LA BASE DE DATOS ====================
# Ejecutar esto después de agregar el código

safe_create_all()

# --- Endpoint para que el Dialog del Front pueda listar los menús ---
@app.get("/api/weekly-menus-complete")
def get_all_weekly_menus(
    db: Session = Depends(get_db),
    current_user: Optional[UserDB] = Depends(get_current_user_optional)
):
    """
    Obtener todos los menús semanales completos para el diálogo de asignación
    """
    try:
        query = _menu_query_for_user(db, current_user)
        menus = query.all()
        
        result = []
        for menu in menus:
            result.append({
                "id": menu.id,
                "name": menu.name,
                "description": menu.description,
                "category": menu.category,
                "total_calories": menu.total_calories,
                "avg_protein": menu.avg_protein,
                "avg_carbs": menu.avg_carbs,
                "avg_fat": menu.avg_fat,
                "assigned_patients": menu.assigned_patients
            })
        
        return result
        
    except Exception as e:
        print(f"❌ ERROR EN /api/weekly-menus-complete:")
        print(f"Tipo: {type(e).__name__}")
        print(f"Mensaje: {str(e)}")
        import traceback
        traceback.print_exc()
        
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener menús: {str(e)}"
        )

@app.post("/api/meal-plans/{plan_id}/assign-menu")
def assign_menu_to_plan(
    plan_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin_or_superadmin),
):
    """
    Vincular un menú semanal completo (4 semanas) a un plan nutricional.
    """
    menu_id = data.get("weekly_menu_id")
    if not menu_id:
        raise HTTPException(status_code=400, detail="Falta weekly_menu_id")

    plan = db.query(MealPlanDB).filter(MealPlanDB.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")

    menu = db.query(WeeklyMenuCompleteDB).filter(
        WeeklyMenuCompleteDB.id == menu_id
    ).first()
    if not menu:
        raise HTTPException(status_code=404, detail="Menú no encontrado")
    _authorize_menu_access(menu, current_user)

    weeks_linked = copy_complete_menu_weeks_to_plan(db, plan_id, menu)
    db.commit()

    return {
        "success": True,
        "message": "Menú vinculado al plan correctamente",
        "weeks_linked": weeks_linked,
        "template_menu_id": menu.id,
    }
def _relative_time_es(ts: Optional[str]) -> str:
    """Formato relativo en español desde timestamp YYYY-MM-DD HH:MM:SS."""
    if not ts:
        return "—"
    try:
        dt = datetime.strptime(str(ts)[:19], "%Y-%m-%d %H:%M:%S")
    except Exception:
        return str(ts)[:16]
    delta = now_co() - dt
    sec = int(delta.total_seconds())
    if sec < 60:
        return "Hace un momento"
    if sec < 3600:
        m = sec // 60
        return f"Hace {m} min"
    if sec < 86400:
        h = sec // 3600
        return f"Hace {h} h"
    d = sec // 86400
    return f"Hace {d} d"


def _monthly_invoice_revenue(db: Session, month_start: date, month_end: date) -> int:
    """Suma facturas pagadas en un rango de fechas (paid_at)."""
    start_str = month_start.strftime("%Y-%m-%d")
    end_str = month_end.strftime("%Y-%m-%d")
    paid = (
        db.query(func.coalesce(func.sum(InvoiceDB.amount_cop), 0))
        .filter(
            InvoiceDB.status == "paid",
            InvoiceDB.paid_at.isnot(None),
            InvoiceDB.paid_at >= start_str,
            InvoiceDB.paid_at < end_str,
        )
        .scalar()
    )
    return int(paid or 0)


def _billing_mrr_snapshot(db: Session) -> dict:
    """MRR y serie mensual desde suscripciones/facturas reales."""
    try:
        from billing_module import _compute_revenue_metrics
        metrics = _compute_revenue_metrics(db)
        return {
            "mrr_cop": metrics.get("mrr_cop", 0),
            "monthly_chart": metrics.get("monthly_revenue_chart", []),
        }
    except Exception:
        subs = db.query(SubscriptionDB).filter(SubscriptionDB.status.in_(("active", "trialing"))).all()
        mrr = sum(getattr(s, "mrr_cop", 0) or 0 for s in subs)
        return {"mrr_cop": mrr, "monthly_chart": []}


def _build_activity_feed(db: Session, limit: int = 10) -> list:
    """Feed de actividad desde audit logs y eventos recientes del sistema."""
    activities = []
    if AuditLogDB is not None:
        logs = (
            db.query(AuditLogDB)
            .order_by(AuditLogDB.created_at.desc())
            .limit(limit)
            .all()
        )
        for log in logs:
            activities.append({
                "id": f"audit_{log.id}",
                "action": log.summary or f"{log.action} · {log.entity_type}",
                "user": log.actor_name or "Sistema",
                "time": _relative_time_es(log.created_at),
                "timestamp": log.created_at or "",
                "type": log.entity_type or "audit",
            })
    if len(activities) < limit:
        remaining = limit - len(activities)
        recent_users = db.query(UserDB).order_by(UserDB.created_at.desc()).limit(remaining).all()
        for user in recent_users:
            action = (
                "Nuevo nutricionista registrado"
                if user.role == "admin"
                else "Nuevo paciente registrado"
                if user.role == "patient"
                else "Nuevo usuario registrado"
            )
            ts = (
                user.created_at.strftime("%Y-%m-%d %H:%M:%S")
                if hasattr(user.created_at, "strftime")
                else str(user.created_at or "")
            )
            activities.append({
                "id": f"user_{user.id}",
                "action": action,
                "user": f"{user.nombres} {user.apellidos}",
                "time": _relative_time_es(ts),
                "timestamp": ts,
                "type": "user",
            })
    return activities[:limit]


@app.get("/api/superadmin/users", response_model=List[SuperAdminUserResponse])
def superadmin_get_all_users(
    search: Optional[str] = None,
    role: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    """
    Obtener todos los usuarios del sistema con filtros opcionales
    """
    query = db.query(UserDB)
    
    # Aplicar filtros
    if search:
        query = query.filter(
            (UserDB.nombres.contains(search)) |
            (UserDB.apellidos.contains(search)) |
            (UserDB.email.contains(search))
        )
    
    if role and role != "all":
        query = query.filter(UserDB.role == role)
    
    if status and status != "all":
        query = query.filter(UserDB.status == status)
    
    users = query.order_by(UserDB.created_at.desc()).all()
    
    results = []
    for user in users:
        nutritionist_name = None
        organization_name = None
        if user.role == "patient" and user.nutritionist_id:
            nutri = db.query(UserDB).filter(UserDB.id == user.nutritionist_id).first()
            if nutri:
                nutritionist_name = f"{nutri.nombres} {nutri.apellidos}"
        if user.role == "admin" and OrganizationMemberDB is not None:
            om = db.query(OrganizationMemberDB).filter(OrganizationMemberDB.user_id == user.id).first()
            if om:
                org = db.query(OrganizationDB).filter(OrganizationDB.id == om.organization_id).first()
                organization_name = org.name if org else None
        row = {
            "id": user.id,
            "name": f"{user.nombres} {user.apellidos}",
            "email": user.email,
            "role": user.role,
            "status": user.status,
            "avatar": user.foto_perfil,
            "createdAt": user.created_at.strftime("%Y-%m-%d") if user.created_at else None,
            "lastLogin": user.updated_at if user.updated_at else None,
        }
        if nutritionist_name:
            row["nutritionist_name"] = nutritionist_name
        if organization_name:
            row["organization_name"] = organization_name
        results.append(row)
    
    return results

@app.post("/api/superadmin/users", response_model=SuperAdminUserResponse)
def superadmin_create_user(
    user_data: SuperAdminUserCreate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    """
    Crear un nuevo usuario desde el panel de superadmin
    """
    # Verificar si el email ya existe
    existing = db.query(UserDB).filter(UserDB.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    # Separar nombre completo
    name_parts = user_data.name.split(" ", 1)
    nombres = name_parts[0]
    apellidos = name_parts[1] if len(name_parts) > 1 else ""
    
    # Generar contraseña por defecto si no se provee
    password = user_data.password if user_data.password else "Welcome123!"
    hashed_pwd = pwd_context.hash(password)
    
    # Crear usuario
    new_user = UserDB(
        nombres=nombres,
        apellidos=apellidos,
        email=user_data.email,
        telefono=user_data.phone,
        password=hashed_pwd,
        role=user_data.role,
        status="activo",
        created_at=now_co()
    )
    
    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        log_audit(
            db,
            actor=current_user,
            action="create",
            entity_type="user",
            entity_id=new_user.id,
            summary=f"Usuario creado: {new_user.nombres} {new_user.apellidos} ({new_user.role})",
            details={"email": new_user.email, "role": new_user.role},
            now_co=now_co,
        )
        db.add(
            NotificationDB(
                user_id=new_user.id,
                type="welcome",
                title="Bienvenido a NutriData",
                description="Tu cuenta fue creada por el administrador de la plataforma.",
            )
        )
        db.commit()
        
        return {
            "id": new_user.id,
            "name": f"{new_user.nombres} {new_user.apellidos}",
            "email": new_user.email,
            "role": new_user.role,
            "status": new_user.status,
            "avatar": new_user.foto_perfil,
            "createdAt": new_user.created_at.strftime("%Y-%m-%d"),
            "lastLogin": None
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al crear usuario: {str(e)}")

@app.get("/api/superadmin/users/{user_id}", response_model=SuperAdminUserResponse)
def superadmin_get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    """
    Obtener detalles de un usuario específico
    """
    user = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    return {
        "id": user.id,
        "name": f"{user.nombres} {user.apellidos}",
        "email": user.email,
        "role": user.role,
        "status": user.status,
        "avatar": user.foto_perfil,
        "createdAt": user.created_at.strftime("%Y-%m-%d") if user.created_at else None,
        "lastLogin": user.updated_at
    }

@app.put("/api/superadmin/users/{user_id}", response_model=SuperAdminUserResponse)
def superadmin_update_user(
    user_id: int,
    user_data: SuperAdminUserUpdate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    """
    Actualizar información de un usuario
    """
    user = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    old_role = user.role
    old_status = user.status
    # Verificar si el email cambió y ya existe
    if user_data.email != user.email:
        existing = db.query(UserDB).filter(
            UserDB.email == user_data.email,
            UserDB.id != user_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="El email ya está en uso")
    
    # Separar nombre completo
    name_parts = user_data.name.split(" ", 1)
    user.nombres = name_parts[0]
    user.apellidos = name_parts[1] if len(name_parts) > 1 else ""
    
    user.email = user_data.email
    user.telefono = user_data.phone
    user.role = user_data.role
    user.status = user_data.status
    user.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
    
    try:
        db.commit()
        db.refresh(user)

        if old_role != user.role or old_status != user.status:
            log_audit(
                db,
                actor=current_user,
                action="role_change" if old_role != user.role else "update",
                entity_type="user",
                entity_id=user.id,
                summary=(
                    f"Rol cambiado a {user.role}: {user.nombres} {user.apellidos}"
                    if old_role != user.role
                    else f"Estado cambiado a {user.status}: {user.nombres} {user.apellidos}"
                ),
                details={
                    "before": {"role": old_role, "status": old_status},
                    "after": {"role": user.role, "status": user.status},
                },
                now_co=now_co,
            )
            db.commit()
        
        return {
            "id": user.id,
            "name": f"{user.nombres} {user.apellidos}",
            "email": user.email,
            "role": user.role,
            "status": user.status,
            "avatar": user.foto_perfil,
            "createdAt": user.created_at.strftime("%Y-%m-%d") if user.created_at else None,
            "lastLogin": user.updated_at
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al actualizar usuario: {str(e)}")

@app.delete("/api/superadmin/users/{user_id}")
def superadmin_delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    """
    Eliminar un usuario del sistema
    """
    user = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # No permitir eliminar superadmins
    if user.role == "superadmin":
        raise HTTPException(
            status_code=403,
            detail="No se puede eliminar usuarios con rol superadmin"
        )
    
    try:
        snapshot = {
            "id": user.id,
            "name": f"{user.nombres} {user.apellidos}",
            "email": user.email,
            "role": user.role,
            "status": user.status,
        }
        db.delete(user)
        log_audit(
            db,
            actor=current_user,
            action="delete",
            entity_type="user",
            entity_id=user_id,
            summary=f"Usuario eliminado: {snapshot['name']} ({snapshot['role']})",
            details={"before": snapshot, "after": None},
            now_co=now_co,
        )
        db.commit()
        return {"success": True, "message": "Usuario eliminado correctamente"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al eliminar usuario: {str(e)}")

@app.patch("/api/superadmin/users/{user_id}/toggle-status")
def superadmin_toggle_user_status(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    """
    Activar/Desactivar un usuario
    """
    user = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Alternar estado
    old_status = user.status
    if user.status == "activo":
        user.status = "inactivo"
    else:
        user.status = "activo"
    
    user.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
    
    try:
        log_audit(
            db,
            actor=current_user,
            action="update",
            entity_type="user",
            entity_id=user.id,
            summary=f"Estado cambiado {old_status} → {user.status}: {user.nombres} {user.apellidos}",
            details={"before": {"status": old_status}, "after": {"status": user.status}},
            now_co=now_co,
        )
        db.add(
            NotificationDB(
                user_id=user.id,
                type="account_status",
                title="Estado de cuenta actualizado",
                description=f"Tu cuenta ahora está {user.status}.",
            )
        )
        db.commit()
        return {
            "success": True,
            "message": f"Usuario {user.status}",
            "status": user.status
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al cambiar estado: {str(e)}")

@app.get("/api/superadmin/stats", response_model=SuperAdminStatsResponse)
def superadmin_get_stats(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    """
    Obtener estadísticas generales del sistema
    """
    # Total de usuarios por rol
    total_users = db.query(UserDB).count()
    total_patients = db.query(UserDB).filter(UserDB.role == "patient").count()
    total_admins = db.query(UserDB).filter(UserDB.role == "admin").count()
    total_superadmins = db.query(UserDB).filter(UserDB.role == "superadmin").count()
    
    # Total por estado
    active_users = db.query(UserDB).filter(UserDB.status == "activo").count()
    pending_users = db.query(UserDB).filter(UserDB.status == "pendiente").count()
    inactive_users = db.query(UserDB).filter(UserDB.status == "inactivo").count()
    
    # Nuevos usuarios este mes
    first_day_of_month = now_co().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    new_users_this_month = db.query(UserDB).filter(
        UserDB.created_at >= first_day_of_month
    ).count()
    
    return {
        "total_users": total_users,
        "total_patients": total_patients,
        "total_admins": total_admins,
        "total_superadmins": total_superadmins,
        "active_users": active_users,
        "pending_users": pending_users,
        "inactive_users": inactive_users,
        "new_users_this_month": new_users_this_month
    }


@app.get("/api/superadmin/recipes")
def superadmin_get_all_recipes(
    status: Optional[str] = None,
    include_usage: bool = False,
    include_quality: bool = False,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    """Biblioteca global de recetas con moderación, calidad y uso."""
    q = db.query(RecipeDB)
    if status and status.lower() not in ("all", "todas", ""):
        q = q.filter(RecipeDB.approval_status == status.lower())
    recipes = q.order_by(RecipeDB.id.desc()).all()
    return [
        _enrich_recipe_superadmin(db, r, include_usage=include_usage, include_quality=include_quality)
        for r in recipes
    ]


@app.get("/api/superadmin/recipes/stats")
def superadmin_recipes_usage_stats(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    """Estadísticas de uso de recetas en menús."""
    recipes = db.query(RecipeDB).all()
    rows = []
    for r in recipes:
        usage = _recipe_usage_stats(db, r.id)
        if usage["total_slot_usages"] > 0 or bool(getattr(r, "is_public", 0)):
            rows.append({
                "id": r.id,
                "name": r.name,
                "is_public": bool(getattr(r, "is_public", 0)),
                "is_system": bool(getattr(r, "is_system", 0)),
                "approval_status": getattr(r, "approval_status", "draft"),
                **usage,
            })
    rows.sort(key=lambda x: x["total_slot_usages"], reverse=True)
    return {
        "total_recipes": len(recipes),
        "public_recipes": sum(1 for r in recipes if getattr(r, "is_public", 0)),
        "system_recipes": sum(1 for r in recipes if getattr(r, "is_system", 0)),
        "pending_moderation": sum(1 for r in recipes if getattr(r, "approval_status", "") == "pending"),
        "top_by_usage": rows[:25],
    }


@app.get("/api/superadmin/recipes/{recipe_id}")
def superadmin_get_recipe(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    recipe = db.query(RecipeDB).filter(RecipeDB.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    return _enrich_recipe_superadmin(db, recipe, include_usage=True, include_quality=True)


@app.get("/api/superadmin/recipes/{recipe_id}/quality-report")
def superadmin_recipe_quality_report(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    recipe = db.query(RecipeDB).filter(RecipeDB.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    return _recipe_nutrition_quality_report(recipe)


@app.get("/api/superadmin/recipes/{recipe_id}/usage")
def superadmin_recipe_usage(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    recipe = db.query(RecipeDB).filter(RecipeDB.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    return _recipe_usage_stats(db, recipe_id)


@app.patch("/api/superadmin/recipes/{recipe_id}/approve")
def superadmin_approve_recipe(
    recipe_id: int,
    body: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    recipe = db.query(RecipeDB).filter(RecipeDB.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    now = now_co().strftime("%Y-%m-%d %H:%M:%S")
    make_public = body.get("is_public", True)
    recipe.approval_status = "approved"
    recipe.is_public = 1 if make_public else 0
    recipe.reviewed_by_id = current_user.id
    recipe.reviewed_at = now
    recipe.rejection_reason = None
    recipe.updated_at = now
    db.commit()
    db.refresh(recipe)
    return {
        "success": True,
        "message": "Receta aprobada",
        "recipe": _enrich_recipe_superadmin(db, recipe, include_quality=True),
    }


@app.patch("/api/superadmin/recipes/{recipe_id}/reject")
def superadmin_reject_recipe(
    recipe_id: int,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    reason = (body.get("reason") or body.get("rejection_reason") or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Indica el motivo del rechazo")
    recipe = db.query(RecipeDB).filter(RecipeDB.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    now = now_co().strftime("%Y-%m-%d %H:%M:%S")
    recipe.approval_status = "rejected"
    recipe.is_public = 0
    recipe.reviewed_by_id = current_user.id
    recipe.reviewed_at = now
    recipe.rejection_reason = reason
    recipe.updated_at = now
    db.commit()
    db.refresh(recipe)
    return {
        "success": True,
        "message": "Receta rechazada",
        "recipe": _enrich_recipe_superadmin(db, recipe),
    }


@app.post("/api/superadmin/recipes/{recipe_id}/duplicate-to-library")
def superadmin_duplicate_recipe_to_library(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    """Duplica receta a la biblioteca global del sistema."""
    source = db.query(RecipeDB).filter(RecipeDB.id == recipe_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    now = now_co().strftime("%Y-%m-%d %H:%M:%S")
    base_name = source.name or "Receta"
    if not base_name.endswith("(Biblioteca)"):
        base_name = f"{base_name} (Biblioteca)"
    clone = RecipeDB(
        name=base_name,
        description=source.description,
        category=source.category,
        prepTime=source.prepTime,
        cookTime=source.cookTime,
        servings=source.servings,
        calories=source.calories,
        protein=source.protein,
        carbs=source.carbs,
        fat=source.fat,
        ingredients=source.ingredients,
        instructions=source.instructions,
        tags=source.tags,
        image=source.image,
        isFavorite=0,
        created_by_id=current_user.id,
        is_public=1,
        approval_status="approved",
        is_system=1,
        source_recipe_id=source.id,
        created_at=now,
        updated_at=now,
    )
    db.add(clone)
    db.commit()
    db.refresh(clone)
    return {
        "success": True,
        "message": "Receta duplicada en biblioteca del sistema",
        "recipe": _enrich_recipe_superadmin(db, clone, include_quality=True),
        "source_recipe_id": source.id,
    }


@app.put("/api/superadmin/recipes/{recipe_id}/shares")
def superadmin_update_recipe_shares(
    recipe_id: int,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    recipe = db.query(RecipeDB).filter(RecipeDB.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    ids = body.get("nutritionist_ids") or []
    if not isinstance(ids, list):
        raise HTTPException(status_code=400, detail="nutritionist_ids debe ser una lista")
    clean_ids = []
    for x in ids:
        try:
            clean_ids.append(int(x))
        except (TypeError, ValueError):
            pass
    unique_ids = list(set(clean_ids))
    if unique_ids:
        valid_rows = (
            db.query(UserDB.id)
            .filter(UserDB.id.in_(unique_ids), UserDB.role == "admin")
            .all()
        )
        valid_ids = {row[0] for row in valid_rows}
        invalid = sorted(set(unique_ids) - valid_ids)
        if invalid:
            raise HTTPException(
                status_code=400,
                detail=f"IDs inválidos o no son nutricionistas (role=admin): {invalid}",
            )
    else:
        valid_ids = set()
    db.query(RecipeShareDB).filter(RecipeShareDB.recipe_id == recipe_id).delete()
    ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
    for nid in valid_ids:
        db.add(RecipeShareDB(recipe_id=recipe_id, nutritionist_id=nid, created_at=ts))
    log_audit(
        db,
        actor=current_user,
        action="update",
        entity_type="recipe",
        entity_id=recipe_id,
        summary=f"Receta «{recipe.name}» compartida con {len(valid_ids)} nutricionista(s)",
        details={"nutritionist_ids": sorted(valid_ids), "recipe_id": recipe_id},
        now_co=now_co,
    )
    for nid in valid_ids:
        db.add(
            NotificationDB(
                user_id=nid,
                type="recipe_share",
                title="Receta compartida contigo",
                description=f"Se compartió la receta «{recipe.name}» en tu biblioteca.",
            )
        )
    db.commit()
    enriched = _enrich_recipe_superadmin(db, recipe)
    return {
        "success": True,
        "message": "Compartidos actualizados",
        "recipe": enriched,
        "shared_nutritionist_ids": enriched["shared_nutritionist_ids"],
        "shared_with": enriched["shared_with"],
    }


@app.patch("/api/superadmin/recipes/{recipe_id}/visibility")
def superadmin_toggle_recipe_visibility(
    recipe_id: int,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    is_public = body.get("is_public", False)
    recipe = db.query(RecipeDB).filter(RecipeDB.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    now = now_co().strftime("%Y-%m-%d %H:%M:%S")
    recipe.is_public = 1 if is_public else 0
    if is_public and getattr(recipe, "approval_status", "draft") in ("draft", "pending", "rejected"):
        recipe.approval_status = "approved"
        recipe.reviewed_by_id = current_user.id
        recipe.reviewed_at = now
        recipe.rejection_reason = None
    recipe.updated_at = now
    db.commit()
    db.refresh(recipe)
    return _enrich_recipe_superadmin(db, recipe)


# ==================== HELPERS NUTRICIONISTAS / STAFF ====================

def _license_alert_status(expiry: Optional[str]) -> Optional[str]:
    if not expiry:
        return None
    try:
        exp_date = datetime.strptime(str(expiry)[:10], "%Y-%m-%d").date()
        days = (exp_date - date.today()).days
        if days < 0:
            return "expired"
        if days <= 30:
            return "expiring_soon"
        return "valid"
    except Exception:
        return None


def _nutritionist_onboarding(db: Session, nutritionist_id: int) -> dict:
    user = db.query(UserDB).filter(UserDB.id == nutritionist_id).first()
    prof = db.query(AdminProfileDB).filter(AdminProfileDB.user_id == nutritionist_id).first()
    profile_ok = bool(
        prof
        and prof.license
        and prof.specialty
        and user
        and user.telefono
    )
    patients_count = db.query(UserDB).filter(
        UserDB.role == "patient",
        UserDB.nutritionist_id == nutritionist_id,
    ).count()
    patient_ids = [
        row[0]
        for row in db.query(UserDB.id).filter(
            UserDB.role == "patient",
            UserDB.nutritionist_id == nutritionist_id,
        ).all()
    ]
    plans_count = 0
    if patient_ids:
        plans_count = db.query(PatientMealPlanDB).filter(
            PatientMealPlanDB.patient_id.in_(patient_ids)
        ).count()
    steps = [
        {"key": "profile", "label": "Perfil completo (TO, especialidad, teléfono)", "done": profile_ok},
        {"key": "first_patient", "label": "Primer paciente registrado", "done": patients_count > 0},
        {"key": "first_plan", "label": "Primer plan asignado", "done": plans_count > 0},
    ]
    completed = sum(1 for s in steps if s["done"])
    return {
        "steps": steps,
        "completed": completed,
        "total": len(steps),
        "percent": round(completed / len(steps) * 100) if steps else 0,
        "is_complete": completed == len(steps),
    }


def _serialize_nutritionist_row(db: Session, nutritionist) -> dict:
    admin_profile = db.query(AdminProfileDB).filter(
        AdminProfileDB.user_id == nutritionist.id
    ).first()
    patients_count = db.query(UserDB).filter(
        UserDB.role == "patient",
        UserDB.nutritionist_id == nutritionist.id,
    ).count()
    org_name = None
    org_id = None
    staff_role = (
        admin_profile.staff_role
        if admin_profile and getattr(admin_profile, "staff_role", None)
        else "nutritionist"
    )
    if admin_profile and getattr(admin_profile, "organization_id", None):
        org_id = admin_profile.organization_id
    if OrganizationMemberDB is not None:
        om = db.query(OrganizationMemberDB).filter(
            OrganizationMemberDB.user_id == nutritionist.id
        ).first()
        if om:
            org_id = org_id or om.organization_id
            org = db.query(OrganizationDB).filter(OrganizationDB.id == om.organization_id).first()
            org_name = org.name if org else None
    license_expiry = getattr(admin_profile, "license_expiry", None) if admin_profile else None
    return {
        "id": nutritionist.id,
        "name": f"{nutritionist.nombres} {nutritionist.apellidos}",
        "email": nutritionist.email,
        "specialty": admin_profile.specialty if admin_profile else None,
        "license": admin_profile.license if admin_profile else None,
        "license_expiry": license_expiry,
        "license_alert": _license_alert_status(license_expiry),
        "invite_expires_at": getattr(admin_profile, "invite_expires_at", None) if admin_profile else None,
        "patients": patients_count,
        "rating": 4.5,
        "status": nutritionist.status,
        "avatar": nutritionist.foto_perfil,
        "joinedAt": nutritionist.created_at if isinstance(nutritionist.created_at, str) else (
            nutritionist.created_at.strftime("%Y-%m-%d") if nutritionist.created_at else None
        ),
        "organization": org_name,
        "organization_id": org_id,
        "staff_role": staff_role,
        "onboarding": _nutritionist_onboarding(db, nutritionist.id),
    }


def _upsert_nutritionist_org(db: Session, user_id: int, organization_id: int, site_id: Optional[int] = None):
    if OrganizationMemberDB is None:
        return
    existing = db.query(OrganizationMemberDB).filter(OrganizationMemberDB.user_id == user_id).first()
    ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
    if existing:
        existing.organization_id = organization_id
        if site_id is not None:
            existing.site_id = site_id
    else:
        db.add(OrganizationMemberDB(
            organization_id=organization_id,
            user_id=user_id,
            site_id=site_id,
            member_role="member",
            status="activo",
            joined_at=ts,
        ))
    prof = db.query(AdminProfileDB).filter(AdminProfileDB.user_id == user_id).first()
    if not prof:
        prof = AdminProfileDB(user_id=user_id)
        db.add(prof)
    prof.organization_id = organization_id
    if site_id is not None:
        prof.site_id = site_id


def _create_nutritionist_invite_token(user_id: int, email: str, days: int = 7) -> tuple:
    expires = datetime.utcnow() + timedelta(days=days)
    invite_token = jwt.encode(
        {
            "user_id": user_id,
            "email": email,
            "type": "nutritionist_invite",
            "exp": expires,
        },
        SECRET_KEY,
        algorithm="HS256",
    )
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    link = f"{frontend_url}/register-nutritionist?token={quote(invite_token, safe='')}"
    return invite_token, link, expires.strftime("%Y-%m-%d %H:%M:%S")


# ==================== ENDPOINTS SUPERADMIN - NUTRICIONISTAS ====================

@app.get("/api/superadmin/nutritionists", response_model=List[NutritionistResponse])
def superadmin_get_nutritionists(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    """
    Obtener todos los nutricionistas (admins) del sistema
    """
    query = db.query(UserDB).filter(UserDB.role == "admin")
    
    if search:
        query = query.filter(
            (UserDB.nombres.contains(search)) |
            (UserDB.apellidos.contains(search)) |
            (UserDB.email.contains(search))
        )
    
    nutritionists = query.order_by(UserDB.created_at.desc()).all()
    return [_serialize_nutritionist_row(db, n) for n in nutritionists]


@app.get("/api/superadmin/nutritionists/license-alerts")
def superadmin_nutritionist_license_alerts(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    """Alertas de licencia TO vencida o por vencer (30 días)."""
    rows = db.query(UserDB, AdminProfileDB).join(
        AdminProfileDB, AdminProfileDB.user_id == UserDB.id
    ).filter(UserDB.role == "admin", UserDB.status == "activo").all()
    alerts = []
    for user, prof in rows:
        alert = _license_alert_status(getattr(prof, "license_expiry", None))
        if alert in ("expired", "expiring_soon"):
            alerts.append({
                "nutritionist_id": user.id,
                "name": f"{user.nombres} {user.apellidos}",
                "email": user.email,
                "license": prof.license,
                "license_expiry": prof.license_expiry,
                "alert": alert,
            })
    alerts.sort(key=lambda a: (0 if a["alert"] == "expired" else 1, a.get("license_expiry") or ""))
    return {"alerts": alerts, "total": len(alerts)}


@app.get("/api/superadmin/nutritionists/{nutritionist_id}")
def superadmin_get_nutritionist_details(
    nutritionist_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    """
    Obtener detalles completos de un nutricionista
    """
    nutritionist = db.query(UserDB).filter(
        UserDB.id == nutritionist_id,
        UserDB.role == "admin"
    ).first()
    
    if not nutritionist:
        raise HTTPException(status_code=404, detail="Nutricionista no encontrado")
    
    base = _serialize_nutritionist_row(db, nutritionist)
    admin_profile = db.query(AdminProfileDB).filter(
        AdminProfileDB.user_id == nutritionist_id
    ).first()
    base.update({
        "phone": nutritionist.telefono,
        "bio": admin_profile.bio if admin_profile else None,
    })
    return base

@app.put("/api/superadmin/nutritionists/{nutritionist_id}/profile")
def superadmin_update_nutritionist_profile(
    nutritionist_id: int,
    payload: NutritionistProfileUpdate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    nutritionist = db.query(UserDB).filter(
        UserDB.id == nutritionist_id,
        UserDB.role == "admin",
    ).first()
    if not nutritionist:
        raise HTTPException(status_code=404, detail="Nutricionista no encontrado")

    prof = db.query(AdminProfileDB).filter(AdminProfileDB.user_id == nutritionist_id).first()
    if not prof:
        prof = AdminProfileDB(user_id=nutritionist_id)
        db.add(prof)

    before = {
        "license": prof.license,
        "license_expiry": getattr(prof, "license_expiry", None),
        "specialty": prof.specialty,
        "organization_id": getattr(prof, "organization_id", None),
        "staff_role": getattr(prof, "staff_role", None),
    }

    if payload.phone is not None:
        nutritionist.telefono = payload.phone
    if payload.specialty is not None:
        prof.specialty = payload.specialty
    if payload.license is not None:
        prof.license = payload.license
    if payload.license_expiry is not None:
        prof.license_expiry = payload.license_expiry
    if payload.bio is not None:
        prof.bio = payload.bio
    if payload.staff_role is not None:
        prof.staff_role = payload.staff_role
    if payload.organization_id is not None:
        _upsert_nutritionist_org(db, nutritionist_id, payload.organization_id, payload.site_id)

    nutritionist.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
    db.commit()

    after = {
        "license": prof.license,
        "license_expiry": getattr(prof, "license_expiry", None),
        "specialty": prof.specialty,
        "organization_id": getattr(prof, "organization_id", None),
        "staff_role": getattr(prof, "staff_role", None),
    }
    log_audit(
        db,
        actor=current_user,
        action="update",
        entity_type="staff",
        entity_id=nutritionist_id,
        summary=f"Perfil nutricionista actualizado: {nutritionist.nombres} {nutritionist.apellidos}",
        details={"before": before, "after": after},
        now_co=now_co,
    )
    db.commit()
    return {"success": True, "nutritionist": _serialize_nutritionist_row(db, nutritionist)}


@app.post("/api/superadmin/nutritionists/{nutritionist_id}/impersonate")
def superadmin_impersonate_nutritionist(
    nutritionist_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    """Deprecated: usar POST /api/superadmin/impersonate/user/{user_id}"""
    raise HTTPException(
        status_code=410,
        detail="Endpoint obsoleto. Use POST /api/superadmin/impersonate/user/{user_id} con motivo en el body.",
    )


@app.post("/api/superadmin/impersonation/end")
def superadmin_end_impersonation(
    request: Request,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=400, detail="Token inválido")
    if not payload.get("impersonation"):
        raise HTTPException(status_code=400, detail="No hay sesión de impersonación activa")

    impersonator = db.query(UserDB).filter(UserDB.id == payload.get("impersonator_id")).first()
    target = db.query(UserDB).filter(UserDB.email == payload.get("sub")).first()
    if impersonator and target:
        if ImpersonationLogDB is not None:
            ip = request.client.host if request.client else None
            db.add(
                ImpersonationLogDB(
                    impersonator_id=impersonator.id,
                    target_user_id=target.id,
                    target_role=target.role,
                    action="end",
                    reason=None,
                    ip_address=ip,
                    created_at=now_co().strftime("%Y-%m-%d %H:%M:%S"),
                )
            )
        log_audit(
            db,
            actor=impersonator,
            action="impersonation_end",
            entity_type=target.role,
            entity_id=target.id,
            summary=f"Impersonación finalizada: {target.nombres} {target.apellidos}",
            details={
                "target_id": target.id,
                "impersonator_id": impersonator.id,
            },
            now_co=now_co,
        )
        db.commit()
    return {"success": True}


@app.post("/api/superadmin/nutritionists/{nutritionist_id}/resend-invite")
def superadmin_resend_nutritionist_invite(
    nutritionist_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    user = db.query(UserDB).filter(
        UserDB.id == nutritionist_id,
        UserDB.role == "admin",
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Nutricionista no encontrado")
    if user.status != "pendiente":
        raise HTTPException(status_code=400, detail="Solo se puede reenviar invitación a cuentas pendientes")

    _, registration_link, expires_at = _create_nutritionist_invite_token(user.id, user.email)
    prof = db.query(AdminProfileDB).filter(AdminProfileDB.user_id == user.id).first()
    if not prof:
        prof = AdminProfileDB(user_id=user.id)
        db.add(prof)
    ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
    prof.invited_at = ts
    prof.invite_expires_at = expires_at
    db.commit()

    email_sent = send_nutritionist_invite_email(
        to_email=user.email,
        name=f"{user.nombres} {user.apellidos}".strip() or user.email,
        registration_link=registration_link,
    )
    log_audit(
        db,
        actor=current_user,
        action="update",
        entity_type="staff",
        entity_id=user.id,
        summary=f"Invitación reenviada: {user.email}",
        details={"invite_expires_at": expires_at, "email_sent": email_sent},
        now_co=now_co,
    )
    db.commit()
    return {
        "success": True,
        "registration_link": registration_link,
        "invite_expires_at": expires_at,
        "email_sent": email_sent,
        "message": "Invitación reenviada" if email_sent else "Enlace regenerado; comparte manualmente",
    }

@app.post("/api/superadmin/nutritionists/invite")
def superadmin_invite_nutritionist(
    invite_data: dict,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """
    Agregar nutricionista, generar enlace de registro y enviar correo al nutricionista
    con dicho enlace para que complete su registro. También se devuelve el enlace por si
    el superadmin quiere copiarlo o el correo no llegara.
    """
    if current_user.role != "superadmin":
        raise HTTPException(status_code=403, detail="Solo el superadmin puede invitar nutricionistas")
    email = invite_data.get("email")
    name = invite_data.get("name")
    specialty = invite_data.get("specialty")
    
    if not email or not name:
        raise HTTPException(status_code=400, detail="Email y nombre son requeridos")
    
    existing = db.query(UserDB).filter(UserDB.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    name_parts = name.split(" ", 1)
    nombres = name_parts[0]
    apellidos = name_parts[1] if len(name_parts) > 1 else ""
    
    # Contraseña imposible de adivinar hasta que complete el registro (no se envía por email)
    import secrets
    temp_password = secrets.token_urlsafe(32)
    hashed_pwd = pwd_context.hash(temp_password)
    
    new_admin = UserDB(
        nombres=nombres,
        apellidos=apellidos,
        email=email,
        password=hashed_pwd,
        role="admin",
        status="pendiente",
        created_at=now_co()
    )
    
    db.add(new_admin)
    db.flush()
    
    if specialty:
        admin_profile = AdminProfileDB(
            user_id=new_admin.id,
            specialty=specialty
        )
        db.add(admin_profile)
    
    try:
        db.commit()
        db.refresh(new_admin)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al crear invitación: {str(e)}")
    
    _, registration_link, expires_at = _create_nutritionist_invite_token(new_admin.id, new_admin.email)
    prof = db.query(AdminProfileDB).filter(AdminProfileDB.user_id == new_admin.id).first()
    if not prof:
        prof = AdminProfileDB(user_id=new_admin.id)
        db.add(prof)
    ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
    prof.invited_at = ts
    prof.invite_expires_at = expires_at
    db.commit()
    
    email_sent = send_nutritionist_invite_email(
        to_email=email,
        name=f"{nombres} {apellidos}".strip() or email,
        registration_link=registration_link
    )

    log_audit(
        db,
        actor=current_user,
        action="create",
        entity_type="staff",
        entity_id=new_admin.id,
        summary=f"Invitación nutricionista: {email}",
        details={"invite_expires_at": expires_at, "email_sent": email_sent},
        now_co=now_co,
    )
    db.commit()
    
    return {
        "success": True,
        "message": "Nutricionista agregado. Se ha enviado un correo con el enlace de registro." if email_sent else "Nutricionista agregado. No se pudo enviar el correo; comparte el enlace manualmente.",
        "registration_link": registration_link,
        "invite_expires_at": expires_at,
        "email": email,
        "name": f"{nombres} {apellidos}".strip(),
        "email_sent": email_sent
    }

@app.delete("/api/superadmin/nutritionists/{nutritionist_id}")
def superadmin_delete_nutritionist(
    nutritionist_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    """
    Eliminar un nutricionista del sistema
    """
    nutritionist = db.query(UserDB).filter(
        UserDB.id == nutritionist_id,
        UserDB.role == "admin"
    ).first()
    
    if not nutritionist:
        raise HTTPException(status_code=404, detail="Nutricionista no encontrado")
    
    # Verificar si tiene pacientes asignados
    patient_ids = [
        row[0]
        for row in db.query(UserDB.id).filter(
            UserDB.role == "patient",
            UserDB.nutritionist_id == nutritionist_id,
        ).all()
    ]
    has_active_patients = False
    if patient_ids:
        has_active_patients = (
            db.query(PatientMealPlanDB)
            .filter(
                PatientMealPlanDB.patient_id.in_(patient_ids),
                PatientMealPlanDB.status == "active",
            )
            .first()
            is not None
        )
    
    if has_active_patients:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar. El nutricionista tiene pacientes activos asignados"
        )
    
    try:
        snapshot = {
            "id": nutritionist.id,
            "name": f"{nutritionist.nombres} {nutritionist.apellidos}",
            "email": nutritionist.email,
        }
        db.delete(nutritionist)
        log_audit(
            db,
            actor=current_user,
            action="delete",
            entity_type="staff",
            entity_id=nutritionist_id,
            summary=f"Nutricionista eliminado: {snapshot['name']}",
            details={"before": snapshot},
            now_co=now_co,
        )
        db.commit()
        return {"success": True, "message": "Nutricionista eliminado correctamente"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al eliminar: {str(e)}")

# ==================== ENDPOINTS SUPERADMIN - DASHBOARD ====================

@app.get("/api/superadmin/dashboard/overview")
def superadmin_get_dashboard_overview(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    """
    Obtener resumen general del dashboard de superadmin (datos reales).
    """
    from platform_module import OrganizationDB

    today = today_co()
    this_month_str = today.replace(day=1).strftime("%Y-%m-%d")
    prev_month = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
    prev_month_str = prev_month.strftime("%Y-%m-%d")

    total_users = db.query(UserDB).count()
    users_prev_month = (
        db.query(UserDB)
        .filter(UserDB.created_at >= prev_month_str, UserDB.created_at < this_month_str)
        .count()
    )
    users_this_month = db.query(UserDB).filter(UserDB.created_at >= this_month_str).count()
    user_change = (
        f"+{((users_this_month - users_prev_month) / users_prev_month * 100):.1f}%"
        if users_prev_month
        else f"+{users_this_month} nuevos"
    )

    total_nutritionists = db.query(UserDB).filter(UserDB.role == "admin").count()
    new_nutritionists = db.query(UserDB).filter(
        UserDB.role == "admin",
        UserDB.created_at >= this_month_str,
    ).count()

    total_organizations = 0
    new_organizations = 0
    if OrganizationDB is not None:
        total_organizations = db.query(OrganizationDB).count()
        new_organizations = (
            db.query(OrganizationDB)
            .filter(OrganizationDB.created_at >= this_month_str)
            .count()
            if hasattr(OrganizationDB, "created_at")
            else 0
        )

    month_names = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    billing_snap = _billing_mrr_snapshot(db)
    user_growth = []
    ref = today.replace(day=1)
    for i in range(5, -1, -1):
        month_ref = ref
        for _ in range(i):
            month_ref = (month_ref.replace(day=1) - timedelta(days=1)).replace(day=1)
        next_m = (month_ref.replace(day=28) + timedelta(days=4)).replace(day=1)
        ref_str = month_ref.strftime("%Y-%m-%d")
        next_str = next_m.strftime("%Y-%m-%d")
        month_users = (
            db.query(UserDB)
            .filter(UserDB.created_at >= ref_str, UserDB.created_at < next_str)
            .count()
        )
        month_revenue = _monthly_invoice_revenue(db, month_ref, next_m)
        user_growth.append({
            "name": month_names[month_ref.month - 1],
            "usuarios": month_users,
            "ingresos": month_revenue,
        })

    mrr_cop = billing_snap.get("mrr_cop", 0)
    this_month_start = today.replace(day=1)
    next_month = (this_month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
    revenue_this_month = _monthly_invoice_revenue(db, this_month_start, next_month)
    revenue_prev_month = _monthly_invoice_revenue(db, prev_month, this_month_start)
    revenue_trend = "up" if revenue_this_month >= revenue_prev_month else "down"
    if revenue_prev_month:
        rev_pct = ((revenue_this_month - revenue_prev_month) / revenue_prev_month) * 100
        revenue_change = f"{rev_pct:+.1f}% vs mes anterior"
    else:
        revenue_change = f"${revenue_this_month:,} COP este mes" if revenue_this_month else "Sin pagos registrados"

    recent_activity = _build_activity_feed(db, limit=5)

    return {
        "stats": {
            "total_users": {
                "value": total_users,
                "change": user_change,
                "trend": "up" if users_this_month >= users_prev_month else "down",
            },
            "nutritionists": {
                "value": total_nutritionists,
                "change": f"+{new_nutritionists} este mes",
                "trend": "up",
            },
            "organizations": {
                "value": total_organizations,
                "change": f"+{new_organizations} este mes",
                "trend": "up",
            },
            "revenue": {
                "value": mrr_cop,
                "change": revenue_change,
                "trend": revenue_trend,
                "monthly_collected_cop": revenue_this_month,
            },
        },
        "charts": {
            "user_growth": user_growth,
            "monthly_revenue": billing_snap.get("monthly_chart") or [
                {"name": row["name"], "ingresos": row["ingresos"]} for row in user_growth
            ],
        },
        "recent_activity": recent_activity,
    }

@app.get("/api/superadmin/dashboard/activity")
def superadmin_get_activity_feed(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    """Feed de actividad del sistema (audit logs + eventos recientes)."""
    return _build_activity_feed(db, limit=min(limit, 50))

# ==================== ENDPOINTS ADICIONALES ====================

@app.get("/api/superadmin/users/export")
def superadmin_export_users(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    """
    Exportar lista de usuarios (CSV o JSON)
    """
    users = db.query(UserDB).all()
    
    export_data = []
    for user in users:
        export_data.append({
            "ID": user.id,
            "Nombre": f"{user.nombres} {user.apellidos}",
            "Email": user.email,
            "Teléfono": user.telefono,
            "Rol": user.role,
            "Estado": user.status,
            "Fecha Registro": user.created_at.strftime("%Y-%m-%d") if user.created_at else ""
        })
    
    return {
        "success": True,
        "data": export_data,
        "total": len(export_data)
    }

@app.post("/api/superadmin/users/bulk-action")
def superadmin_bulk_user_action(
    action_data: dict,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    """
    Realizar acciones en lote sobre usuarios
    """
    action = action_data.get("action")  # activate, deactivate, delete, reassign_org
    user_ids = action_data.get("user_ids", [])
    
    if not action or not user_ids:
        raise HTTPException(status_code=400, detail="Acción e IDs son requeridos")
    
    affected = 0
    
    try:
        if action == "activate":
            db.query(UserDB).filter(UserDB.id.in_(user_ids)).update(
                {"status": "activo"},
                synchronize_session=False
            )
            affected = len(user_ids)
            log_audit(
                db,
                actor=current_user,
                action="update",
                entity_type="user",
                summary=f"Activación masiva de {affected} usuario(s)",
                details={"action": action, "user_ids": user_ids},
                now_co=now_co,
            )
            
        elif action == "deactivate":
            db.query(UserDB).filter(UserDB.id.in_(user_ids)).update(
                {"status": "inactivo"},
                synchronize_session=False
            )
            affected = len(user_ids)
            log_audit(
                db,
                actor=current_user,
                action="update",
                entity_type="user",
                summary=f"Desactivación masiva de {affected} usuario(s)",
                details={"action": action, "user_ids": user_ids},
                now_co=now_co,
            )
            
        elif action == "delete":
            affected = db.query(UserDB).filter(
                UserDB.id.in_(user_ids),
                UserDB.role != "superadmin"
            ).delete(synchronize_session=False)
            log_audit(
                db,
                actor=current_user,
                action="delete",
                entity_type="user",
                summary=f"Eliminación masiva de {affected} usuario(s)",
                details={"action": action, "user_ids": user_ids},
                now_co=now_co,
            )

        elif action == "reassign_org":
            org_id = action_data.get("organization_id")
            if not org_id:
                raise HTTPException(status_code=400, detail="organization_id requerido")
            org = db.query(OrganizationDB).filter(OrganizationDB.id == org_id).first()
            if not org:
                raise HTTPException(status_code=404, detail="Organización no encontrada")
            site_id = action_data.get("site_id")
            for uid in user_ids:
                user = db.query(UserDB).filter(UserDB.id == uid, UserDB.role == "admin").first()
                if not user:
                    continue
                _upsert_nutritionist_org(db, uid, org_id, site_id)
                affected += 1
            log_audit(
                db,
                actor=current_user,
                action="update",
                entity_type="organization",
                entity_id=org_id,
                organization_id=org_id,
                summary=f"Reasignación masiva de {affected} nutricionistas a {org.name}",
                details={"user_ids": user_ids, "organization_id": org_id},
                now_co=now_co,
            )
        else:
            raise HTTPException(status_code=400, detail=f"Acción no soportada: {action}")
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Acción '{action}' aplicada a {affected} usuarios",
            "affected": affected
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error en acción en lote: {str(e)}")


@app.post("/api/superadmin/users/{user_id}/notify")
def superadmin_notify_user(
    user_id: int,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    """Enviar notificación in-app y/o email a un usuario."""
    user = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    subject = (body.get("subject") or "Mensaje de NutriData").strip()
    message = (body.get("message") or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="El mensaje es requerido")

    send_email = body.get("send_email", True)
    send_in_app = body.get("send_in_app", True)
    email_sent = False

    if send_in_app:
        db.add(
            NotificationDB(
                user_id=user.id,
                type="admin_message",
                title=subject,
                description=message,
            )
        )

    if send_email and user.email:
        email_sent = send_generic_email(user.email, subject, message)

    log_audit(
        db,
        actor=current_user,
        action="notify",
        entity_type="user",
        entity_id=user.id,
        summary=f"Notificación enviada a {user.nombres} {user.apellidos}",
        details={"subject": subject, "email_sent": email_sent, "send_in_app": send_in_app},
        now_co=now_co,
    )
    db.commit()

    return {
        "success": True,
        "email_sent": email_sent,
        "in_app": send_in_app,
        "message": "Notificación enviada" if email_sent or send_in_app else "No se pudo entregar la notificación",
    }

        
# ==================== Endpoints for Notifications ====================
@app.get("/api/notifications")
def get_notifications(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Obtener notificaciones del usuario actual"""
    notifications = db.query(NotificationDB).filter(
        NotificationDB.user_id == current_user.id
    ).order_by(NotificationDB.created_at.desc()).all()
    
    return [{
        "id": n.id,
        "type": n.type,
        "title": n.title,
        "description": n.description,
        "time": n.created_at.strftime("%Y-%m-%d %H:%M"), # Simplificado
        "read": n.read
    } for n in notifications]

@app.post("/api/notifications")
def create_notification(noti: NotificationCreate, db: Session = Depends(get_db)):
    """Crear nueva notificación (interno o admin)"""
    new_opt = NotificationDB(
        user_id=noti.user_id,
        type=noti.type,
        title=noti.title,
        description=noti.description
    )
    db.add(new_opt)
    db.commit()
    db.refresh(new_opt)
    return {"success": True, "id": new_opt.id}

@app.put("/api/notifications/{id}/read")
def mark_notification_read(id: int, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    """Marcar notificación como leída"""
    notification = db.query(NotificationDB).filter(
        NotificationDB.id == id,
        NotificationDB.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
        
    notification.read = True
    db.commit()
    return {"success": True}

@app.put("/api/notifications/read-all")
def mark_all_notifications_read(db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    """Marcar todas las notificaciones como leídas"""
    db.query(NotificationDB).filter(
        NotificationDB.user_id == current_user.id,
        NotificationDB.read == False
    ).update({NotificationDB.read: True}, synchronize_session=False)
    
    db.commit()
    return {"success": True}
    
@app.delete("/api/notifications/{id}")
def delete_notification(id: int, db: Session = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    """Eliminar notificación"""
    notification = db.query(NotificationDB).filter(
        NotificationDB.id == id,
        NotificationDB.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
        
    db.delete(notification)
    db.commit()
    return {"success": True}





# ==================== Endpoints for Messaging ====================

@app.get("/api/messages/conversations")
def get_conversations(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    conversations = []
    
    if current_user.role == "admin":
        # Nutricionista: solo sus pacientes asignados
        patients = db.query(UserDB).filter(
            UserDB.role == "patient",
            UserDB.nutritionist_id == current_user.id
        ).all()
        for p in patients:
            last_msg = db.query(MessageDB).filter(
                ((MessageDB.sender_id == current_user.id) & (MessageDB.receiver_id == p.id)) |
                ((MessageDB.sender_id == p.id) & (MessageDB.receiver_id == current_user.id))
            ).order_by(MessageDB.timestamp.desc()).first()
            
            unread = db.query(MessageDB).filter(
                MessageDB.sender_id == p.id,
                MessageDB.receiver_id == current_user.id,
                MessageDB.read == False
            ).count()
            
            conversations.append({
                "id": p.id,
                "patientName": f"{p.nombres} {p.apellidos}",
                "patientAvatar": p.foto_perfil,
                "lastMessage": last_msg.content if last_msg else "Iniciar conversación",
                "lastMessageTime": last_msg.timestamp.strftime("%Y-%m-%dT%H:%M:%S") if last_msg else "",
                "unreadCount": unread,
                "isOnline": False
            })
    elif current_user.role == "superadmin":
        # Superadmin: ve todos los pacientes (opcional)
        patients = db.query(UserDB).filter(UserDB.role == "patient").all()
        for p in patients:
            last_msg = db.query(MessageDB).filter(
                ((MessageDB.sender_id == current_user.id) & (MessageDB.receiver_id == p.id)) |
                ((MessageDB.sender_id == p.id) & (MessageDB.receiver_id == current_user.id))
            ).order_by(MessageDB.timestamp.desc()).first()
            
            unread = db.query(MessageDB).filter(
                MessageDB.sender_id == p.id,
                MessageDB.receiver_id == current_user.id,
                MessageDB.read == False
            ).count()
            
            conversations.append({
                "id": p.id,
                "patientName": f"{p.nombres} {p.apellidos}",
                "patientAvatar": p.foto_perfil,
                "lastMessage": last_msg.content if last_msg else "Iniciar conversación",
                "lastMessageTime": last_msg.timestamp.strftime("%Y-%m-%dT%H:%M:%S") if last_msg else "",
                "unreadCount": unread,
                "isOnline": False
            })
            
    else:
        # Paciente: solo su nutricionista asignado
        admins = []
        if current_user.nutritionist_id:
            admin = db.query(UserDB).filter(
                UserDB.id == current_user.nutritionist_id,
                UserDB.role.in_(['admin', 'superadmin'])
            ).first()
            if admin:
                admins = [admin]
        for admin in admins:
             last_msg = db.query(MessageDB).filter(
                ((MessageDB.sender_id == current_user.id) & (MessageDB.receiver_id == admin.id)) |
                ((MessageDB.sender_id == admin.id) & (MessageDB.receiver_id == current_user.id))
            ).order_by(MessageDB.timestamp.desc()).first()

             unread = db.query(MessageDB).filter(
                MessageDB.sender_id == admin.id,
                MessageDB.receiver_id == current_user.id,
                MessageDB.read == False
             ).count()
             
             conversations.append({
                "id": admin.id,
                "patientName": f"{admin.nombres} {admin.apellidos}",
                "patientAvatar": admin.foto_perfil,
                "lastMessage": last_msg.content if last_msg else "Consultar al especialista",
                "lastMessageTime": last_msg.timestamp.strftime("%Y-%m-%dT%H:%M:%S") if last_msg else "",
                "unreadCount": unread,
                "isOnline": False
             })
             
    return conversations

@app.get("/api/messages/{other_user_id}")
def get_messages(
    other_user_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    # Solo permitir chat con el interlocutor correcto
    other = db.query(UserDB).filter(UserDB.id == other_user_id).first()
    if not other:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if current_user.role == "admin":
        if other.role != "patient" or other.nutritionist_id != current_user.id:
            raise HTTPException(status_code=403, detail="No puedes acceder a esta conversación")
    elif current_user.role == "patient":
        if other_user_id != current_user.nutritionist_id:
            raise HTTPException(status_code=403, detail="No puedes acceder a esta conversación")
    # superadmin puede ver cualquier conversación

    messages = db.query(MessageDB).filter(
        ((MessageDB.sender_id == current_user.id) & (MessageDB.receiver_id == other_user_id)) |
        ((MessageDB.sender_id == other_user_id) & (MessageDB.receiver_id == current_user.id))
    ).order_by(MessageDB.timestamp.asc()).all()
    
    db.query(MessageDB).filter(
        MessageDB.sender_id == other_user_id,
        MessageDB.receiver_id == current_user.id,
        MessageDB.read == False
    ).update({MessageDB.read: True}, synchronize_session=False)
    db.commit()
    
    return [{
        "id": str(m.id),
        "content": m.content,
        "sender": "me" if m.sender_id == current_user.id else "other",
        "sender_role": "admin" if current_user.role != "patient" and m.sender_id == current_user.id else "patient", 
        "timestamp": m.timestamp.strftime("%Y-%m-%dT%H:%M:%S"),
        "status": "read" if m.read else "sent",
        "type": m.type
    } for m in messages]

@app.post("/api/messages")
def send_message(
    msg: MessageCreate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    receiver = db.query(UserDB).filter(UserDB.id == msg.receiver_id).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    # Restricción: nutricionista solo con sus pacientes; paciente solo con su nutricionista
    if current_user.role == "admin":
        if receiver.role != "patient" or receiver.nutritionist_id != current_user.id:
            raise HTTPException(status_code=403, detail="No puedes enviar mensajes a este usuario")
    elif current_user.role == "patient":
        if msg.receiver_id != current_user.nutritionist_id:
            raise HTTPException(status_code=403, detail="No puedes enviar mensajes a este usuario")

    new_msg = MessageDB(
        sender_id=current_user.id,
        receiver_id=msg.receiver_id,
        content=msg.content,
        type=msg.type
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)
    
    return {"success": True, "id": new_msg.id, "timestamp": new_msg.timestamp.strftime("%Y-%m-%dT%H:%M:%S")}


@app.get("/api/debug/patient/{patient_id}/plan-raw")
def debug_patient_plan(patient_id: int, db: Session = Depends(get_db)):
    active_plan = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.patient_id == patient_id,
        PatientMealPlanDB.status == "active"
    ).order_by(PatientMealPlanDB.id.desc()).first()
    
    if not active_plan:
        return {"error": "No active plan found"}
        
    plan = db.query(MealPlanDB).filter(MealPlanDB.id == active_plan.meal_plan_id).first()
    weekly_menu = db.query(WeeklyMenuDB).filter(
        WeeklyMenuDB.meal_plan_id == plan.id,
        WeeklyMenuDB.week_number == active_plan.current_week
    ).first()
    
    if not weekly_menu:
        return {"error": "No weekly menu found"}
        
    return {
        "active_plan": {
            "id": active_plan.id,
            "week": active_plan.current_week,
            "status": active_plan.status
        },
        "weekly_menu": {
            "id": weekly_menu.id,
            "monday": weekly_menu.monday,
            "tuesday": weekly_menu.tuesday,
            "wednesday": weekly_menu.wednesday,
            "thursday": weekly_menu.thursday,
            "friday": weekly_menu.friday,
            "saturday": weekly_menu.saturday,
        }
    }


# ==================== SUPPORT & HELP ENDPOINTS ====================

@app.post("/api/support/ticket")
def create_support_ticket(
    patient_id: int,
    category: str,
    subject: str,
    message: str,
    priority: str = "normal",
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    if current_user.role != "patient" or current_user.id != patient_id:
        raise HTTPException(status_code=403, detail="Solo puedes crear tickets para tu propia cuenta")
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    new_ticket = SupportTicketDB(patient_id=patient_id, category=category, subject=subject, message=message, priority=priority, status="open")
    on_ticket_created(new_ticket, priority, now_co, db=db, OrganizationMemberDB=OrganizationMemberDB, OrganizationDB=OrganizationDB)
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)
    return {"success": True, "message": "Ticket creado exitosamente", "ticket_id": new_ticket.id}

@app.get("/api/patient/{patient_id}/support/tickets")
def get_patient_tickets(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    if current_user.role == "patient" and current_user.id != patient_id:
        raise HTTPException(status_code=403, detail="No autorizado")
    if current_user.role == "admin":
        patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
        if not patient or patient.nutritionist_id != current_user.id:
            raise HTTPException(status_code=403, detail="No autorizado")
    elif current_user.role not in ("superadmin", "patient"):
        raise HTTPException(status_code=403, detail="No autorizado")
    tickets = db.query(SupportTicketDB).filter(SupportTicketDB.patient_id == patient_id).order_by(SupportTicketDB.created_at.desc()).all()
    return [{"id": t.id, "category": t.category, "subject": t.subject, "message": t.message, "status": t.status, "priority": t.priority, "admin_response": t.admin_response, "created_at": t.created_at, "updated_at": t.updated_at, "resolved_at": t.resolved_at} for t in tickets]

# GET /api/support/tickets → support_module (filtro por nutricionista)

@app.put("/api/support/ticket/{ticket_id}")
def update_support_ticket(ticket_id: int, status: str = None, admin_response: str = None, admin_id: int = None, priority: str = None, db: Session = Depends(get_db), current_user: UserDB = Depends(require_admin_or_superadmin)):
    ticket = db.query(SupportTicketDB).filter(SupportTicketDB.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    if current_user.role == "admin":
        patient = db.query(UserDB).filter(UserDB.id == ticket.patient_id).first()
        if not patient or patient.nutritionist_id != current_user.id:
            raise HTTPException(status_code=403, detail="No autorizado")
    ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
    if status:
        ticket.status = status
        if status in ["resolved", "closed"]:
            ticket.resolved_at = ts
    if admin_response:
        ticket.admin_response = admin_response
        ticket.admin_id = current_user.id
        if hasattr(ticket, "first_response_at") and not ticket.first_response_at:
            ticket.first_response_at = ts
    if admin_id:
        ticket.admin_id = admin_id
    if priority:
        ticket.priority = priority
        if hasattr(ticket, "sla_due_at"):
            from support_module import compute_sla_due, _parse_dt
            ticket.sla_due_at = compute_sla_due(priority, _parse_dt(ticket.created_at) or now_co())
    ticket.updated_at = ts
    db.commit()
    return {"success": True, "message": "Ticket actualizado exitosamente"}

@app.get("/api/support/faqs")
def get_faqs(category: str = None, db: Session = Depends(get_db)):
    query = db.query(FAQDB).filter(FAQDB.is_active == True)
    if category:
        query = query.filter(FAQDB.category == category)
    faqs = query.order_by(FAQDB.order.asc(), FAQDB.id.asc()).all()
    return [{"id": f.id, "category": f.category, "question": f.question, "answer": f.answer, "order": f.order} for f in faqs]

@app.post("/api/support/faq")
def create_faq(category: str, question: str, answer: str, order: int = 0, db: Session = Depends(get_db)):
    new_faq = FAQDB(category=category, question=question, answer=answer, order=order)
    db.add(new_faq)
    db.commit()
    db.refresh(new_faq)
    return {"success": True, "message": "FAQ creada exitosamente", "faq_id": new_faq.id}

@app.put("/api/support/faq/{faq_id}")
def update_faq(faq_id: int, category: str = None, question: str = None, answer: str = None, order: int = None, is_active: bool = None, db: Session = Depends(get_db)):
    faq = db.query(FAQDB).filter(FAQDB.id == faq_id).first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ no encontrada")
    if category is not None: faq.category = category
    if question is not None: faq.question = question
    if answer is not None: faq.answer = answer
    if order is not None: faq.order = order
    if is_active is not None: faq.is_active = is_active
    faq.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
    db.commit()
    return {"success": True, "message": "FAQ actualizada exitosamente"}

@app.delete("/api/support/faq/{faq_id}")
def delete_faq(faq_id: int, db: Session = Depends(get_db)):
    faq = db.query(FAQDB).filter(FAQDB.id == faq_id).first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ no encontrada")
    faq.is_active = False
    faq.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
    db.commit()
    return {"success": True, "message": "FAQ eliminada exitosamente"}


# ==================== ARTICLES (HOME PÚBLICO / SUPERADMIN) ====================

DEFAULT_ARTICLE_IMAGE = "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1200&q=80"


class ArticleCategoryCreateSchema(BaseModel):
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class ArticleCategoryUpdateSchema(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class ArticleCreateSchema(BaseModel):
    title: str
    excerpt: Optional[str] = None
    content: str
    category: Optional[str] = "Nutrición"
    author: Optional[str] = None
    image: Optional[str] = None
    slug: Optional[str] = None
    meta_description: Optional[str] = None
    og_image: Optional[str] = None
    is_published: bool = False
    scheduled_publish_at: Optional[str] = None


class ArticleUpdateSchema(BaseModel):
    title: Optional[str] = None
    excerpt: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    author: Optional[str] = None
    image: Optional[str] = None
    slug: Optional[str] = None
    meta_description: Optional[str] = None
    og_image: Optional[str] = None
    is_published: Optional[bool] = None
    scheduled_publish_at: Optional[str] = None


def _slugify_article(text_value: str) -> str:
    import unicodedata
    s = unicodedata.normalize("NFKD", (text_value or "").strip().lower())
    s = s.encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:240] or "articulo"


def _unique_article_slug(db: Session, base: str, exclude_id: Optional[int] = None) -> str:
    slug = _slugify_article(base)
    candidate = slug
    n = 2
    while True:
        q = db.query(ArticleDB).filter(ArticleDB.slug == candidate)
        if exclude_id:
            q = q.filter(ArticleDB.id != exclude_id)
        if not q.first():
            return candidate
        candidate = f"{slug}-{n}"
        n += 1


def _promote_scheduled_articles(db: Session) -> None:
    """Publica artículos cuya fecha programada ya pasó."""
    now_str = now_co().strftime("%Y-%m-%d %H:%M:%S")
    rows = (
        db.query(ArticleDB)
        .filter(
            ArticleDB.scheduled_publish_at.isnot(None),
            ArticleDB.scheduled_publish_at <= now_str,
            ArticleDB.is_published == False,
        )
        .all()
    )
    if not rows:
        return
    for article in rows:
        article.is_published = True
        article.published_at = article.scheduled_publish_at or now_str
        article.scheduled_publish_at = None
        article.updated_at = now_str
    db.commit()


def _published_articles_query(db: Session):
    _promote_scheduled_articles(db)
    now_str = now_co().strftime("%Y-%m-%d %H:%M:%S")
    return db.query(ArticleDB).filter(
        ArticleDB.is_published == True,
        or_(
            ArticleDB.scheduled_publish_at.is_(None),
            ArticleDB.scheduled_publish_at <= now_str,
        ),
    )


def _article_publish_status(article: ArticleDB) -> str:
    if article.is_published:
        sched = getattr(article, "scheduled_publish_at", None)
        if sched:
            try:
                if sched > now_co().strftime("%Y-%m-%d %H:%M:%S"):
                    return "scheduled"
            except Exception:
                pass
        return "published"
    if getattr(article, "scheduled_publish_at", None):
        return "scheduled"
    return "draft"


def _resolve_article_image(image: Optional[str]) -> str:
    if not image:
        return DEFAULT_ARTICLE_IMAGE
    if image.startswith("http://") or image.startswith("https://"):
        return image
    if image.startswith("/uploads/"):
        return f"{BASE_URL.rstrip('/')}{image}"
    return image


def _article_to_dict(article: ArticleDB, include_content: bool = True) -> dict:
    date_source = article.published_at or article.created_at or ""
    og = getattr(article, "og_image", None) or article.image
    data = {
        "id": article.id,
        "title": article.title,
        "slug": getattr(article, "slug", None),
        "excerpt": article.excerpt or "",
        "category": article.category or "Nutrición",
        "author": article.author or "NutriData",
        "image": _resolve_article_image(article.image),
        "og_image": _resolve_article_image(og),
        "meta_description": getattr(article, "meta_description", None) or (article.excerpt or "")[:320],
        "is_published": bool(article.is_published),
        "publish_status": _article_publish_status(article),
        "published_at": article.published_at,
        "scheduled_publish_at": getattr(article, "scheduled_publish_at", None),
        "view_count": getattr(article, "view_count", 0) or 0,
        "created_at": article.created_at,
        "updated_at": article.updated_at,
        "date": date_source[:10] if date_source else None,
        "created_by_id": article.created_by_id,
    }
    if include_content:
        data["content"] = article.content or ""
    return data


def _increment_article_views(db: Session, article: ArticleDB) -> None:
    article.view_count = (getattr(article, "view_count", 0) or 0) + 1
    db.commit()


def _apply_article_schedule(article: ArticleDB, is_published: bool, scheduled_publish_at: Optional[str]) -> None:
    now = now_co().strftime("%Y-%m-%d %H:%M:%S")
    sched = (scheduled_publish_at or "").strip() or None
    if sched and sched > now:
        article.is_published = False
        article.scheduled_publish_at = sched
        return
    if is_published:
        article.is_published = True
        article.scheduled_publish_at = None
        if not article.published_at:
            article.published_at = sched or now
    else:
        article.is_published = False
        if sched:
            article.scheduled_publish_at = sched
        else:
            article.scheduled_publish_at = None


def _serialize_category(cat: ArticleCategoryDB) -> dict:
    return {
        "id": cat.id,
        "name": cat.name,
        "slug": cat.slug,
        "description": cat.description,
        "sort_order": cat.sort_order or 0,
        "is_active": bool(cat.is_active),
        "created_at": cat.created_at,
        "updated_at": cat.updated_at,
    }


def _backfill_article_slugs(db: Session) -> None:
    """Genera slugs para artículos existentes sin slug."""
    rows = (
        db.query(ArticleDB)
        .filter(or_(ArticleDB.slug.is_(None), ArticleDB.slug == ""))
        .limit(200)
        .all()
    )
    if not rows:
        return
    ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
    for article in rows:
        article.slug = _unique_article_slug(db, article.title or f"articulo-{article.id}", exclude_id=article.id)
        article.updated_at = ts
    db.commit()


def _ensure_default_article_categories(db: Session) -> None:
    if db.query(ArticleCategoryDB).count() > 0:
        return
    defaults = [
        ("Nutrición", "nutricion"),
        ("Consejos", "consejos"),
        ("Salud", "salud"),
        ("Planificación", "planificacion"),
        ("Fitness", "fitness"),
        ("Recetas", "recetas"),
        ("Noticias", "noticias"),
    ]
    ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
    for i, (name, slug) in enumerate(defaults):
        db.add(ArticleCategoryDB(
            name=name, slug=slug, sort_order=i, is_active=True, created_at=ts, updated_at=ts
        ))
    db.commit()


@app.get("/api/articles/categories")
def list_public_article_categories(db: Session = Depends(get_db)):
    _ensure_default_article_categories(db)
    rows = (
        db.query(ArticleCategoryDB)
        .filter(ArticleCategoryDB.is_active == True)
        .order_by(ArticleCategoryDB.sort_order.asc(), ArticleCategoryDB.name.asc())
        .all()
    )
    return [_serialize_category(c) for c in rows]


@app.get("/api/articles")
def list_published_articles(
    search: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 24,
    db: Session = Depends(get_db),
):
    """Artículos publicados visibles en el home público (sin auth)."""
    _backfill_article_slugs(db)
    query = _published_articles_query(db)
    if category and category.lower() not in ("todas", "all", ""):
        query = query.filter(ArticleDB.category == category)
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                ArticleDB.title.like(like),
                ArticleDB.excerpt.like(like),
                ArticleDB.content.like(like),
                ArticleDB.category.like(like),
            )
        )
    articles = (
        query.order_by(ArticleDB.published_at.desc(), ArticleDB.id.desc())
        .limit(max(1, min(limit, 100)))
        .all()
    )
    return [_article_to_dict(a, include_content=False) for a in articles]


@app.get("/api/articles/by-slug/{slug}")
def get_published_article_by_slug(slug: str, db: Session = Depends(get_db)):
    _promote_scheduled_articles(db)
    article = (
        _published_articles_query(db)
        .filter(ArticleDB.slug == slug.strip().lower())
        .first()
    )
    if not article:
        raise HTTPException(status_code=404, detail="Artículo no encontrado")
    _increment_article_views(db, article)
    related = (
        _published_articles_query(db)
        .filter(ArticleDB.id != article.id)
        .order_by(ArticleDB.published_at.desc(), ArticleDB.id.desc())
        .limit(2)
        .all()
    )
    payload = _article_to_dict(article, include_content=True)
    payload["related"] = [_article_to_dict(r, include_content=False) for r in related]
    return payload


@app.get("/api/articles/{article_id}")
def get_published_article(article_id: int, db: Session = Depends(get_db)):
    article = _published_articles_query(db).filter(ArticleDB.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Artículo no encontrado")
    _increment_article_views(db, article)
    related = (
        _published_articles_query(db)
        .filter(ArticleDB.id != article_id)
        .order_by(ArticleDB.published_at.desc(), ArticleDB.id.desc())
        .limit(2)
        .all()
    )
    payload = _article_to_dict(article, include_content=True)
    payload["related"] = [_article_to_dict(r, include_content=False) for r in related]
    return payload


@app.get("/api/superadmin/articles")
def superadmin_list_articles(
    include_content: bool = False,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    _backfill_article_slugs(db)
    articles = db.query(ArticleDB).order_by(ArticleDB.id.desc()).all()
    return [_article_to_dict(a, include_content=include_content) for a in articles]


@app.get("/api/superadmin/articles/analytics")
def superadmin_articles_analytics(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    articles = db.query(ArticleDB).order_by(ArticleDB.view_count.desc()).all()
    total_views = sum(getattr(a, "view_count", 0) or 0 for a in articles)
    return {
        "total_views": total_views,
        "total_articles": len(articles),
        "published": sum(1 for a in articles if a.is_published),
        "scheduled": sum(1 for a in articles if _article_publish_status(a) == "scheduled"),
        "top_articles": [
            {
                "id": a.id,
                "title": a.title,
                "slug": getattr(a, "slug", None),
                "view_count": getattr(a, "view_count", 0) or 0,
                "is_published": bool(a.is_published),
                "published_at": a.published_at,
            }
            for a in articles[:20]
        ],
    }


@app.get("/api/superadmin/articles/{article_id}")
def superadmin_get_article(
    article_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    article = db.query(ArticleDB).filter(ArticleDB.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Artículo no encontrado")
    return _article_to_dict(article, include_content=True)


@app.get("/api/superadmin/article-categories")
def superadmin_list_article_categories(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    _ensure_default_article_categories(db)
    rows = db.query(ArticleCategoryDB).order_by(ArticleCategoryDB.sort_order.asc()).all()
    return [_serialize_category(c) for c in rows]


@app.post("/api/superadmin/article-categories")
def superadmin_create_article_category(
    payload: ArticleCategoryCreateSchema,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nombre requerido")
    if db.query(ArticleCategoryDB).filter(ArticleCategoryDB.name == name).first():
        raise HTTPException(status_code=400, detail="Categoría ya existe")
    slug = _slugify_article(payload.slug or name)
    if db.query(ArticleCategoryDB).filter(ArticleCategoryDB.slug == slug).first():
        slug = f"{slug}-{db.query(ArticleCategoryDB).count() + 1}"
    ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
    row = ArticleCategoryDB(
        name=name,
        slug=slug,
        description=payload.description,
        sort_order=payload.sort_order,
        is_active=payload.is_active,
        created_at=ts,
        updated_at=ts,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize_category(row)


@app.put("/api/superadmin/article-categories/{category_id}")
def superadmin_update_article_category(
    category_id: int,
    payload: ArticleCategoryUpdateSchema,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    row = db.query(ArticleCategoryDB).filter(ArticleCategoryDB.id == category_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    if payload.name is not None:
        row.name = payload.name.strip()
    if payload.slug is not None:
        row.slug = _slugify_article(payload.slug)
    if payload.description is not None:
        row.description = payload.description
    if payload.sort_order is not None:
        row.sort_order = payload.sort_order
    if payload.is_active is not None:
        row.is_active = payload.is_active
    row.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
    db.commit()
    return _serialize_category(row)


@app.delete("/api/superadmin/article-categories/{category_id}")
def superadmin_delete_article_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    row = db.query(ArticleCategoryDB).filter(ArticleCategoryDB.id == category_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    in_use = db.query(ArticleDB).filter(ArticleDB.category == row.name).count()
    if in_use:
        raise HTTPException(status_code=400, detail=f"Categoría en uso por {in_use} artículo(s)")
    db.delete(row)
    db.commit()
    return {"success": True}


@app.post("/api/superadmin/articles")
async def superadmin_create_article(
    title: str = Form(...),
    content: str = Form(...),
    excerpt: Optional[str] = Form(None),
    category: Optional[str] = Form("Nutrición"),
    author: Optional[str] = Form(None),
    image_url: Optional[str] = Form(None),
    og_image_url: Optional[str] = Form(None),
    slug: Optional[str] = Form(None),
    meta_description: Optional[str] = Form(None),
    is_published: bool = Form(False),
    scheduled_publish_at: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    og_image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    now = now_co().strftime("%Y-%m-%d %H:%M:%S")
    saved_image = await _save_recipe_image(image)
    saved_og = await _save_recipe_image(og_image)
    image_value = saved_image or (image_url.strip() if image_url else None)
    og_value = saved_og or (og_image_url.strip() if og_image_url else None) or image_value

    article = ArticleDB(
        title=title.strip(),
        slug=_unique_article_slug(db, slug or title.strip()),
        excerpt=(excerpt or "").strip() or None,
        content=content.strip(),
        category=(category or "Nutrición").strip(),
        author=(author or f"{current_user.nombres} {current_user.apellidos}".strip() or "NutriData"),
        image=image_value,
        meta_description=(meta_description or "").strip() or None,
        og_image=og_value,
        is_published=False,
        published_at=None,
        scheduled_publish_at=None,
        view_count=0,
        created_by_id=current_user.id,
        created_at=now,
        updated_at=now,
    )
    _apply_article_schedule(article, bool(is_published), scheduled_publish_at)
    db.add(article)
    db.commit()
    db.refresh(article)
    return {"success": True, "article": _article_to_dict(article)}


@app.put("/api/superadmin/articles/{article_id}")
async def superadmin_update_article(
    article_id: int,
    title: Optional[str] = Form(None),
    content: Optional[str] = Form(None),
    excerpt: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    author: Optional[str] = Form(None),
    image_url: Optional[str] = Form(None),
    og_image_url: Optional[str] = Form(None),
    slug: Optional[str] = Form(None),
    meta_description: Optional[str] = Form(None),
    is_published: Optional[bool] = Form(None),
    scheduled_publish_at: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    og_image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    article = db.query(ArticleDB).filter(ArticleDB.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Artículo no encontrado")

    if title is not None:
        article.title = title.strip()
        if slug is None:
            article.slug = _unique_article_slug(db, article.title, exclude_id=article.id)
    if slug is not None and slug.strip():
        article.slug = _unique_article_slug(db, slug.strip(), exclude_id=article.id)
    if content is not None:
        article.content = content.strip()
    if excerpt is not None:
        article.excerpt = excerpt.strip() or None
    if category is not None:
        article.category = category.strip() or "Nutrición"
    if author is not None:
        article.author = author.strip() or article.author
    if meta_description is not None:
        article.meta_description = meta_description.strip() or None
    if image_url is not None and image_url.strip():
        article.image = image_url.strip()
    if og_image_url is not None and og_image_url.strip():
        article.og_image = og_image_url.strip()

    saved_image = await _save_recipe_image(image)
    if saved_image:
        article.image = saved_image
    saved_og = await _save_recipe_image(og_image)
    if saved_og:
        article.og_image = saved_og

    if is_published is not None or scheduled_publish_at is not None:
        _apply_article_schedule(
            article,
            bool(is_published) if is_published is not None else bool(article.is_published),
            scheduled_publish_at if scheduled_publish_at is not None else getattr(article, "scheduled_publish_at", None),
        )

    article.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
    db.commit()
    db.refresh(article)
    return {"success": True, "article": _article_to_dict(article)}


@app.patch("/api/superadmin/articles/{article_id}/publish")
def superadmin_toggle_publish_article(
    article_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    article = db.query(ArticleDB).filter(ArticleDB.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Artículo no encontrado")
    publish = bool(payload.get("is_published", not article.is_published))
    scheduled = payload.get("scheduled_publish_at")
    _apply_article_schedule(article, publish, scheduled)
    article.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
    db.commit()
    db.refresh(article)
    return {"success": True, "article": _article_to_dict(article)}


@app.delete("/api/superadmin/articles/{article_id}")
def superadmin_delete_article(
    article_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_superadmin),
):
    article = db.query(ArticleDB).filter(ArticleDB.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Artículo no encontrado")
    db.delete(article)
    db.commit()
    return {"success": True, "message": "Artículo eliminado"}


# ==================== PLATAFORMA: ORGS, AUDITORÍA, ROLES, TENANT HEALTH ====================
register_platform_routes(app, {
    "get_db": get_db,
    "require_superadmin": require_superadmin,
    "require_admin_or_superadmin": require_admin_or_superadmin,
    "get_current_user": get_current_user,
    "UserDB": UserDB,
    "AdminProfileDB": AdminProfileDB,
    "MealPlanDB": MealPlanDB,
    "PatientMealPlanDB": PatientMealPlanDB,
    "AppointmentDB": AppointmentDB,
    "MealTrackingDB": MealTrackingDB,
    "SystemSettingsDB": SystemSettingsDB,
    "now_co": now_co,
    "today_co": today_co,
    "pwd_context": pwd_context,
})

from analytics_module import register_analytics_routes

register_analytics_routes(app, {
    "get_db": get_db,
    "get_current_user": get_current_user,
    "UserDB": UserDB,
    "MealPlanDB": MealPlanDB,
    "PatientMealPlanDB": PatientMealPlanDB,
    "MealTrackingDB": MealTrackingDB,
    "ProgressMetricDB": ProgressMetricDB,
    "OrganizationDB": OrganizationDB,
    "OrganizationMemberDB": OrganizationMemberDB,
    "AdminProfileDB": AdminProfileDB,
    "get_initial_weight": get_initial_weight,
    "today_co": today_co,
    "now_co": now_co,
})

from clinical_module import register_clinical_routes, register_specialty_routes

register_clinical_routes(app, {
    "get_db": get_db,
    "get_current_user": get_current_user,
    "require_admin_or_superadmin": require_admin_or_superadmin,
    "authorize_patient_access": authorize_patient_access,
    "UserDB": UserDB,
    "PatientMealPlanDB": PatientMealPlanDB,
    "MealPlanDB": MealPlanDB,
    "OrganizationMemberDB": OrganizationMemberDB,
    "now_co": now_co,
    "today_co": today_co,
})

register_specialty_routes(app, {
    "get_db": get_db,
    "require_admin_or_superadmin": require_admin_or_superadmin,
    "authorize_patient_access": authorize_patient_access,
    "UserDB": UserDB,
    "PatientMealPlanDB": PatientMealPlanDB,
    "MealPlanDB": MealPlanDB,
    "ProgressMetricDB": ProgressMetricDB,
})

register_nutritionist_routes(app, {
    "get_db": get_db,
    "get_current_user": get_current_user,
    "authorize_patient_access": authorize_patient_access,
    "UserDB": UserDB,
    "MealPlanDB": MealPlanDB,
    "PatientMealPlanDB": PatientMealPlanDB,
    "MealTrackingDB": MealTrackingDB,
    "ProgressMetricDB": ProgressMetricDB,
    "AppointmentDB": AppointmentDB,
    "NutritionistNoteDB": NutritionistNoteDB,
    "OrganizationDB": OrganizationDB,
    "OrganizationMemberDB": OrganizationMemberDB,
    "AdminProfileDB": AdminProfileDB,
    "today_co": today_co,
    "now_co": now_co,
})

register_phase4_routes(app, {
    "get_db": get_db,
    "get_current_user": get_current_user,
    "authorize_patient_access": authorize_patient_access,
    "UserDB": UserDB,
    "MealPlanDB": MealPlanDB,
    "PatientMealPlanDB": PatientMealPlanDB,
    "MealTrackingDB": MealTrackingDB,
    "ProgressMetricDB": ProgressMetricDB,
    "AppointmentDB": AppointmentDB,
    "NotificationDB": NotificationDB,
    "OrganizationMemberDB": OrganizationMemberDB,
    "AdminProfileDB": AdminProfileDB,
    "today_co": today_co,
    "now_co": now_co,
})

register_patient_phase1_routes(app, {
    "get_db": get_db,
    "get_current_user": get_current_user,
    "authorize_patient_access": authorize_patient_access,
    "UserDB": UserDB,
    "MealPlanDB": MealPlanDB,
    "PatientMealPlanDB": PatientMealPlanDB,
    "MealTrackingDB": MealTrackingDB,
    "ProgressMetricDB": ProgressMetricDB,
    "AppointmentDB": AppointmentDB,
    "NotificationDB": NotificationDB,
    "today_co": today_co,
    "now_co": now_co,
    "calculate_weekly_adherence": calculate_weekly_adherence,
    "calculate_previous_week_adherence": calculate_previous_week_adherence,
})

register_patient_phase2_routes(app, {
    "get_db": get_db,
    "get_current_user": get_current_user,
    "authorize_patient_access": authorize_patient_access,
    "UserDB": UserDB,
    "MealPlanDB": MealPlanDB,
    "PatientMealPlanDB": PatientMealPlanDB,
    "MealTrackingDB": MealTrackingDB,
    "ProgressMetricDB": ProgressMetricDB,
    "AppointmentDB": AppointmentDB,
    "WeeklyMenuDB": WeeklyMenuDB,
    "RecipeDB": RecipeDB,
    "NotificationDB": NotificationDB,
    "InterventionTemplateDB": InterventionTemplateDB,
    "build_nutrition_report_bytes": build_nutrition_report_bytes,
    "UPLOAD_DIR": UPLOAD_DIR,
    "sanitize_filename": sanitize_filename,
    "validate_upload_file": validate_upload_file,
    "today_co": today_co,
    "now_co": now_co,
    "load_prep_item_defs": load_prep_item_defs,
})

register_patient_phase3_routes(app, {
    "get_db": get_db,
    "get_current_user": get_current_user,
    "authorize_patient_access": authorize_patient_access,
    "UserDB": UserDB,
    "MealPlanDB": MealPlanDB,
    "PatientMealPlanDB": PatientMealPlanDB,
    "MealTrackingDB": MealTrackingDB,
    "ProgressMetricDB": ProgressMetricDB,
    "AppointmentDB": AppointmentDB,
    "WaterTrackingDB": WaterTrackingDB,
    "AchievementDB": AchievementDB,
    "ArticleDB": ArticleDB,
    "NotificationDB": NotificationDB,
    "OrganizationDB": OrganizationDB,
    "OrganizationMemberDB": OrganizationMemberDB,
    "calculate_weekly_adherence": calculate_weekly_adherence,
    "send_whatsapp_notification": send_whatsapp_notification,
    "today_co": today_co,
    "now_co": now_co,
    "load_challenge_defs": load_challenge_defs,
})

register_patient_phase4_routes(app, {
    "get_db": get_db,
    "get_current_user": get_current_user,
    "authorize_patient_access": authorize_patient_access,
    "UserDB": UserDB,
    "MealTrackingDB": MealTrackingDB,
    "WaterTrackingDB": WaterTrackingDB,
    "RecipeDB": RecipeDB,
    "PatientHabitLogDB": PatientHabitLogDB,
    "UPLOAD_DIR": UPLOAD_DIR,
    "sanitize_filename": sanitize_filename,
    "validate_upload_file": validate_upload_file,
    "today_co": today_co,
    "now_co": now_co,
    "load_substitution_groups": load_substitution_groups,
})


from config_module import register_config_routes, create_maintenance_middleware, refresh_runtime_cache, get_email_config

_config_deps = {
    "get_db": get_db,
    "require_superadmin": require_superadmin,
    "get_current_user": get_current_user,
    "get_current_user_optional": get_current_user_optional,
    "SystemSettingsDB": SystemSettingsDB,
    "OrganizationDB": OrganizationDB,
    "OrganizationMemberDB": OrganizationMemberDB,
    "UserDB": UserDB,
    "get_or_create_system_settings": _get_or_create_system_settings,
    "now_co": now_co,
    "SECRET_KEY": SECRET_KEY,
    "ALGORITHM": ALGORITHM,
    "SessionLocal": SessionLocal,
    "log_audit": log_audit,
}
register_config_routes(app, _config_deps)
app.middleware("http")(create_maintenance_middleware(_config_deps))

register_billing_routes(app, {
    "get_db": get_db,
    "require_superadmin": require_superadmin,
    "get_current_user": get_current_user,
    "require_admin_or_superadmin": require_admin_or_superadmin,
    "UserDB": UserDB,
    "OrganizationDB": OrganizationDB,
    "OrganizationMemberDB": OrganizationMemberDB,
    "PatientMealPlanDB": PatientMealPlanDB,
    "SystemSettingsDB": SystemSettingsDB,
    "now_co": now_co,
})

register_ops_routes(app, {
    "get_db": get_db,
    "require_superadmin": require_superadmin,
    "UserDB": UserDB,
    "OfflineSyncLogDB": OfflineSyncLogDB,
    "ArticleDB": ArticleDB,
    "UPLOAD_DIR": UPLOAD_DIR,
    "engine": engine,
    "now_co": now_co,
    "get_email_config": get_email_config,
})
app.middleware("http")(create_ops_metrics_middleware())

register_compliance_routes(app, {
    "get_db": get_db,
    "require_superadmin": require_superadmin,
    "get_current_user": get_current_user,
    "UserDB": UserDB,
    "SystemSettingsDB": SystemSettingsDB,
    "AuditLogDB": AuditLogDB,
    "log_audit": log_audit,
    "MealTrackingDB": MealTrackingDB,
    "NotificationDB": NotificationDB,
    "PatientMealPlanDB": PatientMealPlanDB,
    "ProgressMetricDB": ProgressMetricDB,
    "now_co": now_co,
    "send_generic_email": send_generic_email,
})

register_integrations_routes(app, {
    "get_db": get_db,
    "require_superadmin": require_superadmin,
    "OrganizationDB": OrganizationDB,
    "now_co": now_co,
})

register_support_routes(app, {
    "get_db": get_db,
    "require_superadmin": require_superadmin,
    "require_admin_or_superadmin": require_admin_or_superadmin,
    "get_current_user": get_current_user,
    "UserDB": UserDB,
    "SupportTicketDB": SupportTicketDB,
    "OrganizationDB": OrganizationDB,
    "OrganizationMemberDB": OrganizationMemberDB,
    "log_audit": log_audit,
    "now_co": now_co,
    "get_nutritionist_patient_ids": get_nutritionist_patient_ids,
})

register_platform_analytics_routes(app, {
    "get_db": get_db,
    "require_superadmin": require_superadmin,
    "get_current_user": get_current_user,
    "UserDB": UserDB,
    "PatientMealPlanDB": PatientMealPlanDB,
    "MealTrackingDB": MealTrackingDB,
    "AppointmentDB": AppointmentDB,
    "ProgressMetricDB": ProgressMetricDB,
    "PatientHabitLogDB": PatientHabitLogDB,
    "WaterTrackingDB": WaterTrackingDB,
    "SupportTicketDB": SupportTicketDB,
    "NutritionistNoteDB": NutritionistNoteDB,
    "PlatformModuleUsageDB": PlatformModuleUsageDB,
    "PlatformAppSessionDB": PlatformAppSessionDB,
    "NpsSurveyDB": NpsSurveyDB,
    "now_co": now_co,
    "today_co": today_co,
})

register_clinical_content_routes(app, {
    "get_db": get_db,
    "require_superadmin": require_superadmin,
    "InterventionTemplateDB": InterventionTemplateDB,
    "ArticleDB": ArticleDB,
    "now_co": now_co,
    "log_audit": log_audit,
})

register_crosscutting_routes(app, {
    "get_db": get_db,
    "require_superadmin": require_superadmin,
    "get_current_user": get_current_user,
    "UserDB": UserDB,
    "OrganizationDB": OrganizationDB,
    "OrganizationMemberDB": OrganizationMemberDB,
    "SystemSettingsDB": SystemSettingsDB,
    "FollowUpTaskDB": FollowUpTaskDB,
    "NotificationDB": NotificationDB,
    "MealTrackingDB": MealTrackingDB,
    "PatientMealPlanDB": PatientMealPlanDB,
    "MealPlanDB": MealPlanDB,
    "AppointmentDB": AppointmentDB,
    "log_audit": log_audit,
    "now_co": now_co,
    "today_co": today_co,
    "SECRET_KEY": SECRET_KEY,
    "ALGORITHM": ALGORITHM,
    "send_generic_email": send_generic_email,
    "calculate_weekly_adherence": calculate_weekly_adherence,
})

app.middleware("http")(create_rate_limit_middleware(get_db, SystemSettingsDB))

# Bootstrap DB en startup (_run_database_bootstrap)


# ==================== FRONTEND SPA (mismo contenedor) ====================
FRONTEND_DIST = os.getenv(
    "FRONTEND_DIST",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend_dist"),
)

if os.path.isdir(FRONTEND_DIST):
    _assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.isdir(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="frontend-assets")

    @app.get("/")
    async def serve_frontend_root():
        index_path = os.path.join(FRONTEND_DIST, "index.html")
        if not os.path.isfile(index_path):
            raise HTTPException(status_code=404, detail="Frontend no encontrado")
        return FileResponse(index_path)

    @app.get("/{full_path:path}")
    async def serve_frontend_spa(full_path: str):
        # No interceptar API ni uploads
        if full_path.startswith("api/") or full_path.startswith("uploads/") or full_path.startswith("assets/"):
            raise HTTPException(status_code=404, detail="Not Found")

        candidate = os.path.join(FRONTEND_DIST, full_path)
        # Evitar path traversal
        frontend_real = os.path.realpath(FRONTEND_DIST)
        candidate_real = os.path.realpath(candidate)
        if candidate_real.startswith(frontend_real) and os.path.isfile(candidate_real):
            return FileResponse(candidate_real)

        index_path = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.isfile(index_path):
            return FileResponse(index_path)
        raise HTTPException(status_code=404, detail="Frontend no encontrado")


if __name__ == "__main__":
    import uvicorn
    # Create tables if they don't exist
    safe_create_all()
    uvicorn.run(app, host="0.0.0.0", port=8000)
