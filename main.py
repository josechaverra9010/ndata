from fastapi import FastAPI, HTTPException, Depends, status, Form, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Date, Text, Float, JSON, ForeignKey, Enum, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship, DeclarativeBase
from sqlalchemy.orm.attributes import flag_modified
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, date
import jwt
import os
import json
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import requests
import copy
from storage_utils import storage_manager

# Cargar variables de entorno
load_dotenv()

from sqlalchemy import func, and_

# Helper para generar URLs de avatares
def get_avatar_url(foto_perfil: Optional[str]) -> Optional[str]:
    """
    Convierte el nombre del archivo a URL pública.
    En GCS genera URL firmada fresca (5 min).
    En local retorna /media/filename.
    """
    if not foto_perfil:
        return None
    return storage_manager.get_file_url(foto_perfil)

# Configuración de Base de Datos (PostgreSQL)
DATABASE_URL = os.getenv("DATABASE_URL")
ENV = os.getenv("ENV", "production").strip("'\"").lower()

if not DATABASE_URL:
    DB_USER = os.getenv("MYSQL_USER")
    DB_PASS = os.getenv("MYSQL_PASSWORD")
    DB_HOST = os.getenv("MYSQL_HOST")
    DB_PORT = os.getenv("MYSQL_PORT")
    DB_NAME = os.getenv("MYSQL_DB")
    DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL, pool_recycle=3600, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
class Base(DeclarativeBase):
    pass

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

# Crear carpetas para archivos locales (solo en DEBUG)
# En producción, los archivos se suben a GCS
UPLOAD_DIR = "uploads"
if os.getenv("DEBUG", "False").lower() == "true":
    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR)

app = FastAPI(
    title="NutriData API",
    version="1.0.0",
    docs_url="/docs" if ENV != "production" else None,
    redoc_url="/redoc" if ENV != "production" else None,
    openapi_url="/openapi.json" if ENV != "production" else None,
)

# Montar carpetas estáticas solo en modo DEBUG
if os.getenv("DEBUG", "False").lower() == "true":
    app.mount("/media", StaticFiles(directory="media"), name="media")
    app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    contents = await file.read()
    
    # Guardamos usando nuestro manager híbrido
    # En GCS retorna solo el filename, en local retorna /media/filename
    file_path = await storage_manager.save_file(
        file_content=contents,
        filename=file.filename,
        content_type=file.content_type
    )
    
    # Retornar URL pública (firmada en GCS, local en DEBUG)
    return {"url": get_avatar_url(file_path)}

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
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],  # Métodos específicos
    allow_headers=["Content-Type", "Authorization", "Accept", "X-Requested-With"],  # Headers específicos
    max_age=3600,  # Cache de preflight requests
)

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

# DEPRECATED: Usar get_avatar_url() en su lugar
# def get_absolute_url(relative_path: Optional[str]) -> Optional[str]:
#     """
#     Convertir ruta relativa a URL absoluta usando BASE_URL
#     """
#     if not relative_path:
#         return None
#     
#     # Si ya es una URL completa, devolverla tal cual
#     if relative_path.startswith(('http://', 'https://')):
#         return relative_path
#     
#     # Si es una ruta relativa, agregar BASE_URL
#     # Asegurar que no haya doble slash
#     base = BASE_URL.rstrip('/')
#     path = relative_path if relative_path.startswith('/') else f'/{relative_path}'
#     return f"{base}{path}"

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
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Archivo demasiado grande. Máximo: {MAX_FILE_SIZE / 1024 / 1024}MB"
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

def send_reset_email(to_email: str, reset_token: str, user_name: str):
    """
    Enviar email de recuperación de contraseña
    """
    try:
        # Configuración de Gmail SMTP
        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        sender_email = os.getenv("EMAIL_USER", "tu-email@gmail.com")
        sender_password = os.getenv("EMAIL_PASSWORD", "tu-contraseña-de-aplicacion")
        
        # URL del frontend (ajustar según entorno)
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8080")
        reset_link = f"{frontend_url}/reset-password?token={reset_token}"
        
        # Crear mensaje
        message = MIMEMultipart("alternative")
        message["Subject"] = "Recuperación de Contraseña - NutriData"
        message["From"] = f"NutriData <{sender_email}>"
        message["To"] = to_email
        
        # Contenido HTML del email
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
                .button {{ display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔐 Recuperación de Contraseña</h1>
                </div>
                <div class="content">
                    <p>Hola <strong>{user_name}</strong>,</p>
                    <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en NutriData.</p>
                    <p>Haz clic en el siguiente botón para crear una nueva contraseña:</p>
                    <p style="text-align: center;">
                        <a href="{reset_link}" class="button">Restablecer Contraseña</a>
                    </p>
                    <p>O copia y pega este enlace en tu navegador:</p>
                    <p style="word-break: break-all; background: #e9ecef; padding: 10px; border-radius: 5px;">
                        {reset_link}
                    </p>
                    <p><strong>Este enlace expirará en 1 hora.</strong></p>
                    <p>Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>
                    <p>Saludos,<br>El equipo de NutriData</p>
                </div>
                <div class="footer">
                    <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Adjuntar HTML
        html_part = MIMEText(html_content, "html")
        message.attach(html_part)
        
        # Enviar email
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, to_email, message.as_string())
        
        print(f"✅ Email de recuperación enviado a: {to_email}")
        return True
        
    except Exception as e:
        print(f"❌ Error al enviar email: {str(e)}")
        return False

# ==================== FUNCIÓN DE ENVÍO DE WHATSAPP ====================

def send_whatsapp_notification(phone: str, message: str):
    """
    Enviar notificación vía WhatsApp Cloud API
    """
    try:
        access_token = os.getenv("WHATSAPP_ACCESS_TOKEN")
        phone_id = os.getenv("WHATSAPP_PHONE_ID")
        
        if not access_token or not phone_id:
            print(f"\n{'='*60}")
            print(f"⚠️  CONFIGURACIÓN WHATSAPP INCOMPLETA - LOG DE MENSAJE:")
            print(f"{'='*60}")
            print(f"Para: {phone}")
            print(f"Mensaje: {message}")
            print(f"{'='*60}\n")
            return False

        # Limpiar número de teléfono (solo dígitos)
        clean_phone = "".join(filter(str.isdigit, phone))
        
        # URL de la API de Meta
        url = f"https://graph.facebook.com/v18.0/{phone_id}/messages"
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        # Enviar mensaje de texto simple (o usar plantillas si es producción)
        # Nota: Meta requiere plantillas para iniciar conversaciones, pero enviaremos como texto para desarrollo
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
            print(f"✅ WhatsApp enviado a {phone}")
            return True
        else:
            print(f"❌ Error WhatsApp ({response.status_code}): {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error al enviar WhatsApp: {str(e)}")
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

    created_at = Column(String(50), default=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    updated_at = Column(String(50), default=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"), onupdate=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    
    
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
    
    # Relación con planes asignados
    assigned_plans = relationship("PatientMealPlanDB", back_populates="patient")
    recuerdos_24h = relationship("Recordatorio24hDB", back_populates="patient")

class Recordatorio24hDB(Base):
    __tablename__ = "recordatorios_24h"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), index=True)
    date = Column(Date, default=lambda: datetime.now().date())
    
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

Base.metadata.create_all(bind=engine)

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
Base.metadata.create_all(bind=engine)

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
    status: str  # Ahora incluido
    role: str
    peso_actual: Optional[float]
    peso_objetivo: Optional[float]
    nivel_actividad: Optional[str]
    pal_factor: Optional[float] = None # Nuevo campo
    progreso: int = 0 
    proxima_cita: str = "Sin programar"
    altura: Optional[float] = None
    edad_formateada: Optional[str] = None
    evaluacion_nutricional: Optional[str] = None
    frecuencia_consumo: Optional[List[dict]] = None

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
    description: Optional[str]
    category: str
    prepTime: int
    cookTime: int
    servings: int
    calories: int
    protein: int
    carbs: int
    fat: int
    ingredients: List[str]
    instructions: List[str]
    tags: List[str]
    image: Optional[str]
    isFavorite: bool = False

class RecipeCreate(RecipeBase):
    pass

class RecipeResponse(RecipeBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

# ESQUEMAS PARA MEAL PLANS

class MealPlanCreate(BaseModel):
    name: str
    description: str
    calories: int
    duration: str
    category: str
    color: str = "primary"
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
            "avatar": get_avatar_url(user.foto_perfil)
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
    created_at = Column(DateTime, default=datetime.now)

class MessageDB(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"))
    receiver_id = Column(Integer, ForeignKey("users.id"))
    content = Column(Text)
    timestamp = Column(DateTime, default=datetime.now)
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
    updated_at = Column(DateTime, default=datetime.now)

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
    updated_at = Column(DateTime, default=datetime.now)

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
    created_by: int  # ID del nutricionista que crea la nota

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
    edad_formateada: Optional[str] = None
    metrics: List[dict]
    achievements: List[str]
    notes: List[str]
    
    model_config = ConfigDict(from_attributes=True)

class AdminProfileDB(Base):
    __tablename__ = "admin_profiles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    specialty = Column(String(100), nullable=True)
    license = Column(String(50), nullable=True)
    bio = Column(Text, nullable=True)
    
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
Base.metadata.create_all(bind=engine)

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
Base.metadata.create_all(bind=engine)

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
Base.metadata.create_all(bind=engine)

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
    created_at = Column(String(50), default=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    updated_at = Column(String(50), default=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    resolved_at = Column(String(50), nullable=True)

class FAQDB(Base):
    __tablename__ = "faqs"
    
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(50), nullable=False)  # nutrition, app_usage, plans, billing, general
    question = Column(String(500), nullable=False)
    answer = Column(Text, nullable=False)
    order = Column(Integer, default=0)  # para ordenar las FAQs
    is_active = Column(Boolean, default=True)
    created_at = Column(String(50), default=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    updated_at = Column(String(50), default=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

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
    avatar: Optional[str]
    createdAt: str
    lastLogin: Optional[str]
    
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
    specialty: Optional[str]
    patients: int
    rating: float
    status: str
    avatar: Optional[str]
    joinedAt: str
    organization: Optional[str]
    
    model_config = ConfigDict(from_attributes=True)

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
    
    hoy = datetime.now().date()
    
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

# ==================== ENDPOINTS DE PACIENTES ====================

@app.get("/api/patients", response_model=List[PatientResponse])
def get_patients(db: Session = Depends(get_db)):
    """Obtener todos los pacientes con información completa"""
    patients = db.query(UserDB).filter(UserDB.role == "patient").all()
    
    results = []
    for p in patients:
        progreso_calc = calcular_progreso(p.peso_actual, p.peso_objetivo, p.peso_inicial)
        edad_form = calcular_edad_detallada(p.fecha_nacimiento)
        
        # Obtener próxima cita del plan asignado (si existe)
        proxima_cita = "Sin programar"
        active_plan = db.query(PatientMealPlanDB).filter(
            PatientMealPlanDB.patient_id == p.id,
            PatientMealPlanDB.status == "active"
        ).first()
        
        if active_plan and active_plan.start_date:
            proxima_cita = active_plan.start_date
        
        results.append({
            "id": p.id,
            "nombres": p.nombres,
            "apellidos": p.apellidos,
            "email": p.email,
            "telefono": p.telefono,
            "fecha_nacimiento": p.fecha_nacimiento.strftime("%Y-%m-%d") if p.fecha_nacimiento else None,
            "genero": p.genero,
            "foto_perfil": get_avatar_url(p.foto_perfil),
            "status": p.status or "activo",  # Asegurar que siempre tenga valor
            "role": p.role,
            "peso_actual": p.peso_actual,
            "peso_objetivo": p.peso_objetivo,
            "nivel_actividad": p.nivel_actividad,
            "progreso": progreso_calc,
            "proxima_cita": proxima_cita,
            "altura": p.altura,
            "edad_formateada": edad_form,
            "evaluacion_nutricional": p.evaluacion_nutricional,
            "frecuencia_consumo": p.frecuencia_consumo
        })
    
    return results

@app.post("/api/patients", response_model=PatientResponse)
def create_patient(patient_data: PatientCreateSchema, db: Session = Depends(get_db)):
    """Crear un nuevo paciente"""
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
        status="activo",
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
        frecuencia_consumo=patient_data.frecuencia_consumo
    )
    
    try:
        db.add(new_patient)
        db.commit()
        db.refresh(new_patient)
        
        edad_form = calcular_edad_detallada(new_patient.fecha_nacimiento)

        return {
            "id": new_patient.id,
            "nombres": new_patient.nombres,
            "apellidos": new_patient.apellidos,
            "email": new_patient.email,
            "telefono": new_patient.telefono,
            "fecha_nacimiento": new_patient.fecha_nacimiento.strftime("%Y-%m-%d") if new_patient.fecha_nacimiento else None,
            "genero": new_patient.genero,
            "tipo_documento": new_patient.tipo_documento,
            "numero_documento": new_patient.numero_documento,
            "foto_perfil": get_avatar_url(new_patient.foto_perfil),
            "status": new_patient.status,
            "role": new_patient.role,
            "peso_actual": new_patient.peso_actual,
            "peso_objetivo": new_patient.peso_objetivo,
            "nivel_actividad": new_patient.nivel_actividad,
            "progreso": 0,
            "proxima_cita": "Sin programar",
            "altura": new_patient.altura,
            "edad_formateada": edad_form,
            "evaluacion_nutricional": new_patient.evaluacion_nutricional,
            "frecuencia_consumo": new_patient.frecuencia_consumo
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al crear paciente: {str(e)}")

@app.get("/api/patients/{patient_id}", response_model=PatientResponse)
def get_patient_details(patient_id: int, db: Session = Depends(get_db)):
    """Obtener detalles completos de un paciente"""
    patient = db.query(UserDB).filter(UserDB.id == patient_id, UserDB.role == "patient").first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    progreso_calc = calcular_progreso(patient.peso_actual, patient.peso_objetivo, patient.peso_inicial)
    
    proxima_cita = "Sin programar"
    active_plan = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.patient_id == patient_id,
        PatientMealPlanDB.status == "active"
    ).order_by(PatientMealPlanDB.id.desc()).first()
    
    if active_plan and active_plan.start_date:
        proxima_cita = active_plan.start_date
    
    edad_form = calcular_edad_detallada(patient.fecha_nacimiento)

    return {
        "id": patient.id,
        "nombres": patient.nombres,
        "apellidos": patient.apellidos,
        "email": patient.email,
        "telefono": patient.telefono,
        "fecha_nacimiento": patient.fecha_nacimiento.strftime("%Y-%m-%d") if patient.fecha_nacimiento else None,
        "genero": patient.genero,
        "tipo_documento": patient.tipo_documento,
        "numero_documento": patient.numero_documento,
        "foto_perfil": get_avatar_url(patient.foto_perfil),
        "status": patient.status or "activo",
        "role": patient.role,
        "peso_actual": patient.peso_actual,
        "peso_objetivo": patient.peso_objetivo,
        "nivel_actividad": patient.nivel_actividad,
        "progreso": progreso_calc,
        "proxima_cita": proxima_cita,
        "altura": patient.altura,
        "edad_formateada": edad_form,
        "evaluacion_nutricional": patient.evaluacion_nutricional,
        "frecuencia_consumo": patient.frecuencia_consumo
    }

@app.put("/api/patients/{patient_id}", response_model=PatientResponse)
def update_patient(patient_id: int, patient_data: PatientCreateSchema, db: Session = Depends(get_db)):
    """Actualizar información de un paciente"""
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
    patient.alergias = patient_data.alergias
    patient.preferencias = patient_data.preferencias
    patient.objetivos_salud = patient_data.objetivos_salud
    patient.condiciones_medicas = patient_data.condiciones_medicas
    patient.alimentos_disgusto = patient_data.alimentos_disgusto
    patient.antecedentes_familiares = patient_data.antecedentes_familiares
    patient.evaluacion_nutricional = patient_data.evaluacion_nutricional
    patient.frecuencia_consumo = patient_data.frecuencia_consumo
    
    if patient_data.fecha_nacimiento:
        try:
            patient.fecha_nacimiento = datetime.strptime(patient_data.fecha_nacimiento, "%Y-%m-%d").date()
        except:
            pass
    
    # No actualizar email para evitar duplicados
    # No actualizar contraseña a menos que se provea explícitamente
    
    db.commit()
    db.refresh(patient)
    
    progreso_calc = calcular_progreso(patient.peso_actual, patient.peso_objetivo, patient.peso_inicial)
    
    edad_form = calcular_edad_detallada(patient.fecha_nacimiento)

    return {
        "id": patient.id,
        "nombres": patient.nombres,
        "apellidos": patient.apellidos,
        "email": patient.email,
        "telefono": patient.telefono,
        "fecha_nacimiento": patient.fecha_nacimiento.strftime("%Y-%m-%d") if patient.fecha_nacimiento else None,
        "genero": patient.genero,
        "tipo_documento": patient.tipo_documento,
        "numero_documento": patient.numero_documento,
        "foto_perfil": get_avatar_url(patient.foto_perfil),
        "status": patient.status or "activo",
        "role": patient.role,
        "peso_actual": patient.peso_actual,
        "peso_objetivo": patient.peso_objetivo,
        "nivel_actividad": patient.nivel_actividad,
        "progreso": progreso_calc,
        "proxima_cita": "Sin programar",
        "altura": patient.altura,
        "edad_formateada": edad_form,
        "evaluacion_nutricional": patient.evaluacion_nutricional,
        "frecuencia_consumo": patient.frecuencia_consumo
    }

@app.delete("/api/patients/{patient_id}")
def delete_patient(patient_id: int, db: Session = Depends(get_db)):
    """Eliminar un paciente"""
    patient = db.query(UserDB).filter(UserDB.id == patient_id, UserDB.role == "patient").first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    db.delete(patient)
    db.commit()
    return {"success": True, "message": "Paciente eliminado correctamente"}

# ==================== ENDPOINTS RECORDATORIO 24 HORAS ====================

@app.post("/api/patients/{patient_id}/recalls", response_model=RecallResponse)
def create_patient_recall(patient_id: int, recall_data: RecallCreate, db: Session = Depends(get_db)):
    """Crear un nuevo recordatorio de 24 horas para un paciente"""
    patient = db.query(UserDB).filter(UserDB.id == patient_id, UserDB.role == "patient").first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    recall_date = datetime.now().date()
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
def get_patient_recalls(patient_id: int, db: Session = Depends(get_db)):
    """Obtener el historial de recordatorios de 24 horas de un paciente"""
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

@app.get("/api/patients/stats")
def get_patient_stats(db: Session = Depends(get_db)):
    """Estadísticas de pacientes"""
    total = db.query(UserDB).filter(UserDB.role == "patient").count()
    activos = db.query(UserDB).filter(UserDB.role == "patient", UserDB.status == "activo").count()
    return {
        "total_patients": total,
        "active_now": activos
    }

# ==================== ENDPOINTS EXISTENTES (sin cambios) ====================

@app.post("/api/profile/upload-photo/{email}")
async def upload_photo(email: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    file_extension = file.filename.split(".")[-1]
    file_name = f"profile_{user.id}.{file_extension}"
    
    contents = await file.read()
    
    # Usar storage_manager para guardar (local en DEBUG, GCS en producción)
    file_url = await storage_manager.save_file(
        file_content=contents,
        filename=file_name,
        content_type=file.content_type
    )
    
    if not file_url:
        raise HTTPException(status_code=500, detail="Error al guardar la imagen")

    user.foto_perfil = file_url
    db.commit()

    return {"success": True, "foto_url": user.foto_perfil}


@app.post("/api/register")

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
            "avatar": get_avatar_url(user.foto_perfil)  # URL firmada fresca
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
            frontend_url = os.getenv("FRONTEND_URL", "/")
            reset_link = f"{frontend_url}/reset-password?token={reset_token}"
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


# ==================== DASHBOARD ENDPOINTS ====================

@app.get("/api/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    # 1. Total Pacientes
    total_patients = db.query(UserDB).filter(UserDB.role == "patient").count()
    
    # 2. Total Planes
    total_plans = db.query(MealPlanDB).count()
    
    # 3. Citas de la semana (simulado con total appointments por ahora)
    total_appointments = db.query(AppointmentDB).count()
    
    # 4. Progreso promedio
    # Calcular promedio de todos los pacientes
    patients = db.query(UserDB).filter(UserDB.role == "patient").all()
    total_progreso = 0
    count_progreso = 0
    
    for p in patients:
        prog = calcular_progreso(p.peso_actual, p.peso_objetivo, p.peso_inicial)
        total_progreso += prog
        count_progreso += 1
        
    avg_progress = int(total_progreso / count_progreso) if count_progreso > 0 else 0
    
    return {
        "patients": {
            "total": total_patients,
            "change": "+2% este mes", 
            "change_type": "positive"
        },
        "plans": {
            "total": total_plans,
            "change": "+5% este mes",
            "change_type": "positive"
        },
        "appointments": {
            "total": total_appointments,
            "change": f"{total_appointments} programadas",
            "change_type": "neutral"
        },
        "progress": {
            "average": avg_progress,
            "change": "+1% vs mes anterior",
            "change_type": "positive"
        }
    }

@app.get("/api/dashboard/recent-patients")
def get_recent_patients(limit: int = 5, db: Session = Depends(get_db)):
    # Ordenar por id descendente como proxy de "reciente" ya que created_at es string
    # Lo ideal sería parsear created_at o usar un campo datetime real
    patients = db.query(UserDB).filter(UserDB.role == "patient")\
        .order_by(UserDB.id.desc())\
        .limit(limit)\
        .all()
        
    results = []
    for p in patients:
        # Buscar plan activo
        active_plan = db.query(PatientMealPlanDB).filter(
            PatientMealPlanDB.patient_id == p.id,
            PatientMealPlanDB.status == "active"
        ).first()
        
        plan_name = "Sin plan"
        if active_plan:
            # Cargar nombre del plan
            meal_plan = db.query(MealPlanDB).filter(MealPlanDB.id == active_plan.meal_plan_id).first()
            if meal_plan:
                plan_name = meal_plan.name
        
        results.append({
            "id": p.id,
            "name": f"{p.nombres} {p.apellidos}",
            "avatar": get_avatar_url(p.foto_perfil),
            "email": p.email,
            "plan": plan_name,
            "status": p.status,
            "joined": str(p.created_at).split(" ")[0] if p.created_at else "N/A",
            "registered_at": p.created_at
        })
    
    return results

@app.get("/api/dashboard/upcoming-appointments")
def get_upcoming_appointments(limit: int = 5, db: Session = Depends(get_db)):
    # Obtener citas futuras
    today = datetime.now().date()
    appointments = db.query(AppointmentDB)\
        .filter(AppointmentDB.date >= today)\
        .order_by(AppointmentDB.date.asc(), AppointmentDB.time.asc())\
        .limit(limit)\
        .all()
        
    results = []
    for appt in appointments:
        patient = db.query(UserDB).filter(UserDB.id == appt.patient_id).first()
        avatar = get_avatar_url(patient.foto_perfil) if patient else None
        
        # Formatear fecha para label (ej: "Hoy", "Mañana" o "12 Oct")
        date_obj = appt.date # es date object
        diff = (date_obj - today).days
        
        if diff == 0:
            date_label = "Hoy"
        elif diff == 1:
            date_label = "Mañana"
        else:
            date_label = date_obj.strftime("%d %b")
            
        results.append({
            "id": appt.id,
            "patient_id": appt.patient_id,
            "patient_name": appt.patient_name,
            "patient_avatar": avatar,
            "date": str(appt.date),
            "date_label": date_label,
            "time": appt.time,
            "duration": appt.duration,
            "type": appt.type,
            "status": appt.status,
            "notes": appt.notes,
            "meeting_link": appt.meeting_link
        })
        
    return results

@app.get("/api/dashboard/chart-data")
def get_dashboard_chart_data(db: Session = Depends(get_db)):
    # Generar datos para los últimos 6 meses dinámicamente
    
    # 1. Definir rango de fechas (últimos 6 meses hasta hoy)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=180) # Aproximadamente 6 meses
    
    # 2. Inicializar estructura de datos para los últimos 6 meses
    chart_data = []
    current_month = start_date
    while current_month <= end_date:
        key = current_month.strftime("%Y-%m")
        month_name = current_month.strftime("%b").capitalize() # Ene, Feb, etc. (depende de locale, pero ok)
        
        # Mapeo manual para asegurar nombres en español si locale no está configurado
        meses_es = {
            "Jan": "Ene", "Feb": "Feb", "Mar": "Mar", "Apr": "Abr", "May": "May", "Jun": "Jun",
            "Jul": "Jul", "Aug": "Ago", "Sep": "Sep", "Oct": "Oct", "Nov": "Nov", "Dec": "Dic"
        }
        en_month = current_month.strftime("%b")
        es_month = meses_es.get(en_month, en_month)
        
        chart_data.append({
            "key": key,
            "name": es_month,
            "consultas": 0,
            "planes": 0
        })
        # Avanzar al siguiente mes
        # Truco: sumar 32 días y volver al día 1
        next_month = current_month + timedelta(days=32)
        current_month = next_month.replace(day=1)
    
    # 3. Consultar y agregar Citas (Appointments)
    # AppointmentDB.date es Date
    appointments = db.query(AppointmentDB).filter(
        AppointmentDB.date >= start_date.date(),
        AppointmentDB.date <= end_date.date()
    ).all()
    
    for app in appointments:
        app_key = app.date.strftime("%Y-%m")
        for item in chart_data:
            if item["key"] == app_key:
                item["consultas"] += 1
                break
                
    # 4. Consultar y agregar Planes (MealPlans)
    # MealPlanDB.created_at es String "YYYY-MM-DD HH:MM:SS"
    # Necesitamos filtrar en python o intentar casting. Por seguridad, traemos todo (asumiendo no son millones) 
    # o filtramos crudamente por string si el formato es consistente.
    # El formato es "%Y-%m-%d %H:%M:%S" según UserDB defaults, asumimos igual para MealPlanDB.
    all_plans = db.query(MealPlanDB).all()
    
    for plan in all_plans:
        if plan.created_at:
            try:
                # Parsear string fecha
                # Puede ser solo fecha o fecha hora
                if " " in plan.created_at:
                    plan_date = datetime.strptime(plan.created_at, "%Y-%m-%d %H:%M:%S")
                else:
                    plan_date = datetime.strptime(plan.created_at, "%Y-%m-%d")
                
                if start_date <= plan_date <= end_date:
                    plan_key = plan_date.strftime("%Y-%m")
                    for item in chart_data:
                        if item["key"] == plan_key:
                            item["planes"] += 1
                            break
            except ValueError:
                continue # Ignorar fechas mal formadas

    # Limpiar keys auxiliares
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

@app.get("/api/recipes", response_model=List[RecipeResponse])
def get_recipes(db: Session = Depends(get_db)):
    return db.query(RecipeDB).all()

@app.get("/api/recipes/{recipe_id}", response_model=RecipeResponse)
def get_recipe(recipe_id: int, db: Session = Depends(get_db)):
    recipe = db.query(RecipeDB).filter(RecipeDB.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    return recipe

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
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    image_url = None
    if image:
        filename = f"recipe_{datetime.now().strftime('%Y%m%d%H%M%S')}_{image.filename}"
        contents = await image.read()
        
        # Usar storage_manager para guardar (local en DEBUG, GCS en producción)
        image_url = await storage_manager.save_file(
            file_content=contents,
            filename=filename,
            content_type=image.content_type
        )
        
        if not image_url:
            raise HTTPException(status_code=500, detail="Error al guardar la imagen de la receta")

    # Parse lists from JSON strings
    import json
    try:
        ingredients_list = json.loads(ingredients)
        instructions_list = json.loads(instructions)
        tags_list = json.loads(tags)
    except Exception:
        # Fallback if they are sent as simple strings or comma separated
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
        image=image_url
    )
    db.add(new_recipe)
    db.commit()
    db.refresh(new_recipe)
    return new_recipe

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
    db: Session = Depends(get_db)
):
    recipe = db.query(RecipeDB).filter(RecipeDB.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    
    image_url = recipe.image
    if image:
        filename = f"recipe_{datetime.now().strftime('%Y%m%d%H%M%S')}_{image.filename}"
        contents = await image.read()
        
        # Usar storage_manager para guardar (local en DEBUG, GCS en producción)
        image_url = await storage_manager.save_file(
            file_content=contents,
            filename=filename,
            content_type=image.content_type
        )
        
        if not image_url:
            raise HTTPException(status_code=500, detail="Error al guardar la imagen de la receta")

    import json
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
    return recipe

@app.delete("/api/recipes/{recipe_id}")
def delete_recipe(recipe_id: int, db: Session = Depends(get_db)):
    recipe = db.query(RecipeDB).filter(RecipeDB.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    
    db.delete(recipe)
    db.commit()
    return {"success": True, "message": "Receta eliminada"}

@app.patch("/api/recipes/{recipe_id}/favorite")
def toggle_recipe_favorite(recipe_id: int, db: Session = Depends(get_db)):
    recipe = db.query(RecipeDB).filter(RecipeDB.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    
    recipe.isFavorite = not recipe.isFavorite
    db.commit()
    return {"success": True, "isFavorite": recipe.isFavorite}

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
        created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
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
    Obtener el menú semanal asignado a un plan específico
    """
    weekly_menu = db.query(WeeklyMenuDB).filter(
        WeeklyMenuDB.meal_plan_id == plan_id
    ).first()
    
    if not weekly_menu:
        return None
    
    # Mapear días
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
    
    # Intentar detectar el formato de las 4 semanas
    monday_data = weekly_menu.monday
    if isinstance(monday_data, str):
        try: monday_data = json.loads(monday_data)
        except: monday_data = {}
    
    is_4_week = isinstance(monday_data, list)
    
    if is_4_week:
        # Estructura de 4 semanas
        for week_num in range(1, 5):
            idx = week_num - 1
            for day_key, day_name in days_map.items():
                day_col = getattr(weekly_menu, day_key, [])
                if isinstance(day_col, str):
                    try: day_col = json.loads(day_col)
                    except: day_col = []
                
                meals_list = []
                if isinstance(day_col, list) and len(day_col) > idx:
                    week_content = day_col[idx]
                    if isinstance(week_content, dict) and "meals" in week_content:
                        meals_list = week_content["meals"]
                
                week_data.append({
                    "day": day_name,
                    "week": week_num,
                    "meals": meals_list
                })
    else:
        # Estructura antigua (una sola semana)
        for day_key, day_name in days_map.items():
            day_val = getattr(weekly_menu, day_key, {})
            if isinstance(day_val, str):
                try: day_val = json.loads(day_val)
                except: day_val = {}
            
            meals_list = []
            if isinstance(day_val, dict):
                if "meals" in day_val and isinstance(day_val["meals"], list):
                    meals_list = day_val["meals"]
                else:
                    for m_type, m_data in day_val.items():
                        if isinstance(m_data, dict):
                            m_data["type"] = m_type
                            meals_list.append(m_data)
            
            week_data.append({
                "day": day_name,
                "week": 1,
                "meals": meals_list
            })
    
    return {
        "id": weekly_menu.id,
        "meal_plan_id": weekly_menu.meal_plan_id,
        "week_number": weekly_menu.week_number,
        "is_4_week": is_4_week,
        "week": week_data
    }


@app.put("/api/meal-plans/{plan_id}", response_model=MealPlanResponse)
def update_meal_plan(plan_id: int, plan_data: MealPlanCreate, db: Session = Depends(get_db)):
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
def assign_plan_with_weekly_menu(data: dict, db: Session = Depends(get_db)):
    """
    Asignar plan con menú semanal a un paciente
    """
    patient_id = data.get("patient_id")
    meal_plan_id = data.get("meal_plan_id")
    weekly_menu_id = data.get("weekly_menu_id")
    start_date_str = data.get("start_date")
    
    # 🔍 DEBUG
    print("=" * 60)
    print("📥 DATOS RECIBIDOS EN /api/assign-plan-with-menu:")
    print(f"   patient_id: {patient_id}")
    print(f"   meal_plan_id: {meal_plan_id}")
    print(f"   weekly_menu_id: {weekly_menu_id}")
    print(f"   start_date: {start_date_str}")
    
    # Validaciones
    if not patient_id:
        raise HTTPException(status_code=400, detail="Falta patient_id")
    if not meal_plan_id:
        raise HTTPException(status_code=400, detail="Falta meal_plan_id")
    if not weekly_menu_id:
        raise HTTPException(status_code=400, detail="Falta weekly_menu_id")
    if not start_date_str:
        raise HTTPException(status_code=400, detail="Falta start_date")
    
    # Verificar que el plan existe
    plan = db.query(MealPlanDB).filter(MealPlanDB.id == meal_plan_id).first()
    if not plan:
        print(f"❌ Plan {meal_plan_id} NO encontrado")
        raise HTTPException(status_code=404, detail="Plan nutricional no encontrado")
    print(f"✅ Plan encontrado: {plan.name}")
    
    # Verificar que el paciente existe
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        print(f"❌ Paciente {patient_id} NO encontrado")
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    print(f"✅ Paciente encontrado: {patient.nombres} {patient.apellidos}")
    
    # Verificar que el menú existe
    menu = db.query(WeeklyMenuCompleteDB).filter(
        WeeklyMenuCompleteDB.id == weekly_menu_id
    ).first()
    if not menu:
        print(f"❌ Menú {weekly_menu_id} NO encontrado")
        raise HTTPException(status_code=404, detail="Menú semanal no encontrado")
    print(f"✅ Menú encontrado: {menu.name}")
    
    # Parsear fecha
    try:
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        print(f"✅ Fecha parseada: {start_date}")
    except ValueError:
        print(f"❌ Fecha inválida: {start_date_str}")
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD")
    
    # Desactivar planes anteriores del paciente
    previous_active = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.patient_id == patient_id,
        PatientMealPlanDB.status == "active"
    ).all()
    
    for prev_plan in previous_active:
        prev_plan.status = "paused"
        print(f"⏸️  Plan anterior {prev_plan.id} pausado")
    
    # Crear asignación del plan
    assignment = PatientMealPlanDB(
        patient_id=patient_id,
        meal_plan_id=meal_plan_id,
        assigned_date=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        start_date=start_date_str,
        status="active",
        current_week=1
    )
    db.add(assignment)
    db.flush()  # Para obtener el ID sin hacer commit completo
    print(f"✅ Asignación creada con ID: {assignment.id}")
    
    # Notificar al paciente vía WhatsApp
    if patient.telefono:
        msg = (
            f"🍏 ¡Hola {patient.nombres}! Te hemos asignado un nuevo plan nutricional: *{plan.name}*.\n\n"
            f"📅 Fecha de inicio: {start_date_str}\n"
            f"📝 El nutricionista ha actualizado tu menú semanal.\n\n"
            f"¡Puedes revisarlo ahora en la app!\n"
            f"🔗 http://localhost:8080/patient/my-plan"
        )
        send_whatsapp_notification(patient.telefono, msg)

    
    # Mapear días
    days_map = {
        0: ("monday", "Lunes"),
        1: ("tuesday", "Martes"),
        2: ("wednesday", "Miércoles"),
        3: ("thursday", "Jueves"),
        4: ("friday", "Viernes"),
        5: ("saturday", "Sábado"),
        6: ("sunday", "Domingo")
    }
    
    # Generar comidas diarias (7 días)
    meals_created = 0
    for i in range(7):
        current_date = start_date + timedelta(days=i)
        day_index = current_date.weekday()
        day_col, day_name = days_map[day_index]
        
        print(f"\n📅 Procesando {day_name} ({current_date})...")
        
        # Obtener datos del día
        day_data = getattr(menu, day_col, {})
        
        # Si es string JSON, parsearlo
        if isinstance(day_data, str):
            try:
                import json
                day_data = json.loads(day_data)
                print(f"   ✅ JSON parseado para {day_name}")
            except:
                print(f"   ⚠️  No se pudo parsear JSON para {day_name}")
                day_data = {}
        
        # Asegurarse de que sea un diccionario
        if not isinstance(day_data, dict):
            print(f"   ⚠️  day_data no es dict para {day_name}, usando vacío")
            day_data = {}
        
        # Crear registro diario
        daily = DailyMealAssignmentDB(
            patient_meal_plan_id=assignment.id,
            date=current_date,
            day_of_week=day_name,
            generated_from_menu_id=weekly_menu_id,
            breakfast={},
            morning_snack={},
            lunch={},
            afternoon_snack={},
            dinner={},
            evening_snack={}
        )
        
        # Obtener comidas del día
        meals = day_data.get("meals", []) if isinstance(day_data, dict) else []
        print(f"   📋 Comidas encontradas: {len(meals)}")
        
        # Asignar cada comida al tipo correspondiente
        for meal in meals:
            if not isinstance(meal, dict):
                continue
                
            meal_type = meal.get("type", "").lower()
            print(f"      • {meal_type}: {meal.get('recipe_name', 'Sin nombre')}")
            
            if meal_type == "desayuno":
                daily.breakfast = meal
            elif meal_type == "almuerzo" or meal_type == "snack_am":
                daily.morning_snack = meal
            elif meal_type == "comida" or meal_type == "almuerzo":
                daily.lunch = meal
            elif meal_type == "merienda" or meal_type == "snack_pm":
                daily.afternoon_snack = meal
            elif meal_type == "cena":
                daily.dinner = meal
            elif meal_type == "snack" or meal_type == "snack_noche":
                daily.evening_snack = meal
        
        db.add(daily)
        meals_created += 1
    
    # Commit final
    try:
        db.commit()
        print("\n" + "=" * 60)
        print(f"✅ ASIGNACIÓN EXITOSA")
        print(f"   • Asignación ID: {assignment.id}")
        print(f"   • Días creados: {meals_created}")
        print("=" * 60)
        
        return {
            "success": True,
            "assignment_id": assignment.id,
            "message": "Plan con menú asignado correctamente",
            "days_created": meals_created
        }
    except Exception as e:
        db.rollback()
        print(f"\n❌ ERROR AL HACER COMMIT: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error al guardar: {str(e)}")
    
@app.get("/api/meal-plans/{plan_id}/assigned-menu")
def get_plan_assigned_menu(plan_id: int, db: Session = Depends(get_db)):
    """
    Obtener el menú semanal que está siendo usado por pacientes con este plan
    """
    print(f"\n🔍 Buscando menú para plan {plan_id}...")
    
    # Buscar cualquier asignación activa de este plan
    active_assignment = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.meal_plan_id == plan_id,
        PatientMealPlanDB.status == "active"
    ).first()
    
    if not active_assignment:
        print("   ⚠️  No hay asignaciones activas para este plan")
        return None
    
    print(f"   ✅ Asignación encontrada: ID {active_assignment.id}")
    
    # Buscar el menú usado en las comidas diarias
    daily_assignment = db.query(DailyMealAssignmentDB).filter(
        DailyMealAssignmentDB.patient_meal_plan_id == active_assignment.id,
        DailyMealAssignmentDB.generated_from_menu_id.isnot(None)
    ).first()
    
    if not daily_assignment or not daily_assignment.generated_from_menu_id:
        print("   ⚠️  No se encontró menú generado")
        return None
    
    menu_id = daily_assignment.generated_from_menu_id
    print(f"   ✅ Menú ID encontrado: {menu_id}")
    
    # Obtener el menú completo
    menu = db.query(WeeklyMenuCompleteDB).filter(
        WeeklyMenuCompleteDB.id == menu_id
    ).first()
    
    if not menu:
        print(f"   ❌ Menú {menu_id} no existe en WeeklyMenuCompleteDB")
        return None
    
    print(f"   ✅ Menú encontrado: {menu.name}")
    
    # Mapear días
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
    for day_key, day_name in days_map.items():
        day_meals = getattr(menu, day_key, {})
        
        # Parsear si es string
        if isinstance(day_meals, str):
            import json
            try:
                day_meals = json.loads(day_meals)
            except:
                day_meals = {}
        
        # Extraer comidas
        meals = day_meals.get("meals", []) if isinstance(day_meals, dict) else []
        
        week_data.append({
            "day": day_name,
            "meals": meals
        })
    
    return {
        "id": menu.id,
        "meal_plan_id": plan_id,
        "week_number": 1,
        "week": week_data
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
def assign_plan_to_patient(assignment: AssignPlanSchema, db: Session = Depends(get_db)):
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
        assigned_date=datetime.now().strftime("%Y-%m-%d"),
        start_date=assignment.start_date,
        end_date=assignment.end_date,
        notes=assignment.notes,
        status="active"
    )
    
    db.add(new_assignment)
    db.commit()
    db.refresh(new_assignment)
    
    return new_assignment

@app.get("/api/patients/{patient_id}/meal-plans")
def get_patient_meal_plans(patient_id: int, db: Session = Depends(get_db)):
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
def remove_plan_assignment(assignment_id: int, db: Session = Depends(get_db)):
    assignment = db.query(PatientMealPlanDB).filter(PatientMealPlanDB.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    
    db.delete(assignment)
    db.commit()
    return {"success": True, "message": "Asignación eliminada"}


class AssignmentStatusUpdate(BaseModel):
    status: str

@app.patch("/api/meal-plans/assign/{assignment_id}")
def update_assignment_status(assignment_id: int, status_data: AssignmentStatusUpdate, db: Session = Depends(get_db)):
    """Actualizar estado de una asignación (active, paused, completed)"""
    assignment = db.query(PatientMealPlanDB).filter(PatientMealPlanDB.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
        
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
    db: Session = Depends(get_db)
):
    """
    Obtener todas las citas con filtros opcionales
    - start_date: Fecha inicial (YYYY-MM-DD)
    - end_date: Fecha final (YYYY-MM-DD)
    - status: confirmada, pendiente, cancelada
    """
    query = db.query(AppointmentDB)
    
    if start_date:
        query = query.filter(AppointmentDB.date >= datetime.strptime(start_date, "%Y-%m-%d").date())
    
    if end_date:
        query = query.filter(AppointmentDB.date <= datetime.strptime(end_date, "%Y-%m-%d").date())
    
    if status:
        query = query.filter(AppointmentDB.status == status)
    
    appointments = query.order_by(AppointmentDB.date, AppointmentDB.time).all()
    
    return [
        {
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
            "updated_at": apt.updated_at
        }
        for apt in appointments
    ]

@app.get("/api/appointments/{appointment_id}", response_model=AppointmentResponse)
def get_appointment(appointment_id: int, db: Session = Depends(get_db)):
    """Obtener detalles de una cita específica"""
    appointment = db.query(AppointmentDB).filter(AppointmentDB.id == appointment_id).first()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    
    return {
        "id": appointment.id,
        "patient_id": appointment.patient_id,
        "patient_name": appointment.patient_name,
        "date": appointment.date.strftime("%Y-%m-%d"),
        "time": appointment.time,
        "duration": appointment.duration,
        "type": appointment.type,
        "status": appointment.status,
        "notes": appointment.notes,
        "meeting_link": appointment.meeting_link,
        "created_at": appointment.created_at,
        "updated_at": appointment.updated_at
    }

@app.post("/api/appointments", response_model=AppointmentResponse)
def create_appointment(appointment_data: AppointmentCreate, db: Session = Depends(get_db)):
    """Crear una nueva cita"""
    # Verificar que el paciente existe
    patient = db.query(UserDB).filter(UserDB.id == appointment_data.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    # Convertir la fecha de string a date
    try:
        appointment_date = datetime.strptime(appointment_data.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD")
    
    # Verificar que no haya conflicto de horario
    existing_appointment = db.query(AppointmentDB).filter(
        AppointmentDB.date == appointment_date,
        AppointmentDB.time == appointment_data.time,
        AppointmentDB.status != "cancelada"
    ).first()
    
    if existing_appointment:
        raise HTTPException(
            status_code=400, 
            detail=f"Ya existe una cita programada para {appointment_data.date} a las {appointment_data.time}"
        )
    
    # Crear la cita
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
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
        updated_at=now
    )
    
    try:
        db.add(new_appointment)
        db.commit()
        db.refresh(new_appointment)
        
        # Notificar al paciente vía WhatsApp
        if patient.telefono:
            msg = (
                f"Hola {patient.nombres}, te han asignado una nueva cita en NutriData.\n\n"
                f"📅 Fecha: {appointment_date.strftime('%d/%m/%Y')}\n"
                f"⏰ Hora: {new_appointment.time}\n"
                f"📍 Tipo: {new_appointment.type.capitalize()}\n"
                f"🔗 Link: http://localhost:8080/patient/appointments\n\n"
                f"¡Te esperamos!"
            )
            send_whatsapp_notification(patient.telefono, msg)
        
        return {
            "id": new_appointment.id,
            "patient_id": new_appointment.patient_id,
            "patient_name": new_appointment.patient_name,
            "date": new_appointment.date.strftime("%Y-%m-%d"),
            "time": new_appointment.time,
            "duration": new_appointment.duration,
            "type": new_appointment.type,
            "status": new_appointment.status,
            "notes": new_appointment.notes,
            "meeting_link": new_appointment.meeting_link,
            "created_at": new_appointment.created_at,
            "updated_at": new_appointment.updated_at
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al crear la cita: {str(e)}")

@app.put("/api/appointments/{appointment_id}", response_model=AppointmentResponse)
def update_appointment(
    appointment_id: int,
    appointment_data: AppointmentUpdate,
    db: Session = Depends(get_db)
):
    """Actualizar una cita existente"""
    appointment = db.query(AppointmentDB).filter(AppointmentDB.id == appointment_id).first()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    
    # Actualizar solo los campos proporcionados
    update_data = appointment_data.model_dump(exclude_unset=True)
    
    # Si se actualiza la fecha, convertirla
    if "date" in update_data and update_data["date"]:
        try:
            update_data["date"] = datetime.strptime(update_data["date"], "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha inválido")
    
    # Verificar conflictos si se cambia fecha u hora
    if "date" in update_data or "time" in update_data:
        check_date = update_data.get("date", appointment.date)
        check_time = update_data.get("time", appointment.time)
        
        conflict = db.query(AppointmentDB).filter(
            AppointmentDB.id != appointment_id,
            AppointmentDB.date == check_date,
            AppointmentDB.time == check_time,
            AppointmentDB.status != "cancelada"
        ).first()
        
        if conflict:
            raise HTTPException(
                status_code=400,
                detail="Ya existe una cita en ese horario"
            )
    
    # Aplicar actualizaciones
    for key, value in update_data.items():
        setattr(appointment, key, value)
    
    appointment.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    db.commit()
    db.refresh(appointment)
    
    return {
        "id": appointment.id,
        "patient_id": appointment.patient_id,
        "patient_name": appointment.patient_name,
        "date": appointment.date.strftime("%Y-%m-%d"),
        "time": appointment.time,
        "duration": appointment.duration,
        "type": appointment.type,
        "status": appointment.status,
        "notes": appointment.notes,
        "meeting_link": appointment.meeting_link,
        "created_at": appointment.created_at,
        "updated_at": appointment.updated_at
    }

@app.patch("/api/appointments/{appointment_id}/status")
def update_appointment_status(
    appointment_id: int,
    status_data: AppointmentStatusUpdate,
    db: Session = Depends(get_db)
):
    """Actualizar solo el estado de una cita"""
    appointment = db.query(AppointmentDB).filter(AppointmentDB.id == appointment_id).first()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    
    if status_data.status not in ["confirmada", "pendiente", "cancelada"]:
        raise HTTPException(status_code=400, detail="Estado inválido")
    
    appointment.status = status_data.status
    appointment.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    db.commit()
    
    return {
        "success": True,
        "message": f"Cita {status_data.status}",
        "appointment_id": appointment_id,
        "status": appointment.status
    }

@app.delete("/api/appointments/{appointment_id}")
def delete_appointment(appointment_id: int, db: Session = Depends(get_db)):
    """Eliminar una cita"""
    appointment = db.query(AppointmentDB).filter(AppointmentDB.id == appointment_id).first()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    
    db.delete(appointment)
    db.commit()
    
    return {
        "success": True,
        "message": "Cita eliminada correctamente"
    }

@app.get("/api/appointments/patient/{patient_id}")
def get_patient_appointments(
    patient_id: int,
    include_past: bool = False,
    db: Session = Depends(get_db)
):
    """Obtener todas las citas de un paciente específico"""
    query = db.query(AppointmentDB).filter(AppointmentDB.patient_id == patient_id)
    
    if not include_past:
        query = query.filter(AppointmentDB.date >= datetime.now().date())
    
    appointments = query.order_by(AppointmentDB.date, AppointmentDB.time).all()
    
    return [
        {
            "id": apt.id,
            "patient_id": apt.patient_id,
            "patient_name": apt.patient_name,
            "date": apt.date.strftime("%Y-%m-%d"),
            "time": apt.time,
            "duration": apt.duration,
            "type": apt.type,
            "status": apt.status,
            "notes": apt.notes
        }
        for apt in appointments
    ]

@app.get("/api/appointments/stats/overview")
def get_appointments_stats(db: Session = Depends(get_db)):
    """Estadísticas generales de citas"""
    today = datetime.now().date()
    
    # Citas de hoy
    today_appointments = db.query(AppointmentDB).filter(
        AppointmentDB.date == today
    ).all()
    
    # Citas de esta semana
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    
    week_appointments = db.query(AppointmentDB).filter(
        AppointmentDB.date >= week_start,
        AppointmentDB.date <= week_end
    ).all()
    
    # Citas por estado
    confirmadas = len([a for a in week_appointments if a.status == "confirmada"])
    pendientes = len([a for a in week_appointments if a.status == "pendiente"])
    canceladas = len([a for a in week_appointments if a.status == "cancelada"])
    
    # Próxima cita
    next_appointment = db.query(AppointmentDB).filter(
        AppointmentDB.date >= today,
        AppointmentDB.status != "cancelada"
    ).order_by(AppointmentDB.date, AppointmentDB.time).first()
    
    return {
        "today": {
            "total": len(today_appointments),
            "confirmadas": len([a for a in today_appointments if a.status == "confirmada"]),
            "pendientes": len([a for a in today_appointments if a.status == "pendiente"])
        },
        "week": {
            "total": len(week_appointments),
            "confirmadas": confirmadas,
            "pendientes": pendientes,
            "canceladas": canceladas
        },
        "next_appointment": {
            "patient_name": next_appointment.patient_name if next_appointment else None,
            "date": next_appointment.date.strftime("%Y-%m-%d") if next_appointment else None,
            "time": next_appointment.time if next_appointment else None
        } if next_appointment else None
    }

@app.get("/api/appointments/available-slots/{date}")
def get_available_slots(date: str, db: Session = Depends(get_db)):
    """Obtener horarios disponibles para una fecha específica"""
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido")
    
    # Todos los slots disponibles (de 8:00 a 19:00)
    all_slots = [
        "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
        "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
        "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
        "17:00", "17:30", "18:00", "18:30", "19:00"
    ]
    
    # Obtener citas ocupadas para esa fecha
    occupied_slots = db.query(AppointmentDB).filter(
        AppointmentDB.date == target_date,
        AppointmentDB.status != "cancelada"
    ).all()
    
    occupied_times = [apt.time for apt in occupied_slots]
    
    # Retornar slots disponibles
    available_slots = [slot for slot in all_slots if slot not in occupied_times]
    
    return {
        "date": date,
        "available_slots": available_slots,
        "occupied_slots": occupied_times,
        "total_available": len(available_slots)
    }

def calculate_trend(metrics: List[ProgressMetricDB]) -> str:
    """Calcula la tendencia del peso basándose en las últimas mediciones"""
    if len(metrics) < 2:
        return "stable"
    
    # Tomar las últimas 3 mediciones
    recent_metrics = sorted(metrics, key=lambda x: x.date)[-3:]
    
    if len(recent_metrics) < 2:
        return "stable"
    
    # Calcular la diferencia promedio
    weight_changes = []
    for i in range(1, len(recent_metrics)):
        change = recent_metrics[i].weight - recent_metrics[i-1].weight
        weight_changes.append(change)
    
    avg_change = sum(weight_changes) / len(weight_changes)
    
    # Umbral de 0.3 kg para considerar cambio significativo
    if avg_change > 0.3:
        return "up"
    elif avg_change < -0.3:
        return "down"
    else:
        return "stable"

def calculate_weekly_adherence(patient_id: int, db: Session) -> int:
    """Calcula la adherencia de la semana actual basada en comidas completadas"""
    today = datetime.now().date()
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
    db: Session = Depends(get_db)
):
    """
    Obtener resumen de progreso de todos los pacientes
    - search: Término de búsqueda para filtrar por nombre
    - trend: Filtrar por tendencia (up, down, stable)
    """
    # Obtener todos los pacientes con planes activos
    query = db.query(UserDB).filter(UserDB.role == "patient")
    
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
        adherence = calculate_weekly_adherence(patient.id, db)
        
        last_update = metrics[0].date.strftime("%Y-%m-%d") if metrics else datetime.now().strftime("%Y-%m-%d")
        
        progress_calc = calcular_progreso(current_weight, goal_weight, initial_weight)
        
        # Aplicar filtro de tendencia
        if trend and trend != "all" and trend_value != trend:
            continue
        
        results.append({
            "id": patient.id,
            "name": f"{patient.nombres} {patient.apellidos}",
            "avatar": get_avatar_url(patient.foto_perfil),
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
def get_patient_progress_details(patient_id: int, db: Session = Depends(get_db)):
    """Obtener detalles completos del progreso de un paciente"""
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    # Obtener plan activo
    active_plan_assignment = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.patient_id == patient_id,
        PatientMealPlanDB.status == "active"
    ).first()
    
    plan_name = "Sin plan"
    start_date = datetime.now().strftime("%Y-%m-%d")
    
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
    adherence = calculate_weekly_adherence(patient_id, db)
    
    last_update = metrics[-1].date.strftime("%Y-%m-%d") if metrics else datetime.now().strftime("%Y-%m-%d")
    
    return {
        "id": patient.id,
        "name": f"{patient.nombres} {patient.apellidos}",
        "avatar": get_avatar_url(patient.foto_perfil),
        "plan": plan_name,
        "start_date": start_date,
        "current_weight": current_weight,
        "initial_weight": initial_weight,
        "goal_weight": goal_weight,
        "weekly_adherence": adherence,
        "trend": trend_value,
        "last_update": last_update,
        "metrics": metrics_data,
        "metricsHistory": metrics_data, # Frontend expects both
        "achievements": achievements_list,
        "achievementsList": achievements_list_detailed,
        "notes": notes_list,
        "notesList": notes_list_detailed
    }

@app.post("/api/progress/metrics", response_model=ProgressMetricResponse)
def create_progress_metric(metric_data: ProgressMetricCreate, db: Session = Depends(get_db)):
    """Crear una nueva métrica de progreso para un paciente"""
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
        created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
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
def update_progress_metric(metric_id: int, metric_data: ProgressMetricCreate, db: Session = Depends(get_db)):
    """Actualizar una métrica de progreso por ID"""
    metric = db.query(ProgressMetricDB).filter(ProgressMetricDB.id == metric_id).first()
    if not metric:
        raise HTTPException(status_code=404, detail="Métrica no encontrada")
    
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

@app.get("/api/progress/metrics/{patient_id}", response_model=List[ProgressMetricResponse])
def get_patient_metrics(patient_id: int, db: Session = Depends(get_db)):
    """Obtener todas las métricas de un paciente"""
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
            "notes": m.notes
        }
        for m in metrics
    ]

@app.post("/api/progress/achievements", response_model=AchievementResponse)
def create_achievement(achievement_data: AchievementCreate, db: Session = Depends(get_db)):
    """Crear un nuevo logro para un paciente"""
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

@app.get("/api/progress/achievements/{patient_id}", response_model=List[AchievementResponse])
def get_patient_achievements(patient_id: int, db: Session = Depends(get_db)):
    """Obtener todos los logros de un paciente"""
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
def delete_achievement(achievement_id: int, db: Session = Depends(get_db)):
    """Eliminar un logro"""
    achievement = db.query(AchievementDB).filter(AchievementDB.id == achievement_id).first()
    if not achievement:
        raise HTTPException(status_code=404, detail="Logro no encontrado")
    
    db.delete(achievement)
    db.commit()
    return {"success": True, "message": "Logro eliminado"}

@app.post("/api/progress/notes", response_model=NutritionistNoteResponse)
def create_nutritionist_note(note_data: NutritionistNoteCreate, db: Session = Depends(get_db)):
    """Crear una nueva nota del nutricionista"""
    patient = db.query(UserDB).filter(UserDB.id == note_data.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    author = db.query(UserDB).filter(UserDB.id == note_data.created_by).first()
    if not author:
        raise HTTPException(status_code=404, detail="Autor no encontrado")
    
    new_note = NutritionistNoteDB(
        patient_id=note_data.patient_id,
        note=note_data.note,
        created_by=note_data.created_by,
        created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
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

@app.get("/api/progress/notes/{patient_id}", response_model=List[NutritionistNoteResponse])
def get_patient_notes(patient_id: int, db: Session = Depends(get_db)):
    """Obtener todas las notas del nutricionista para un paciente"""
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
def delete_nutritionist_note(note_id: int, db: Session = Depends(get_db)):
    """Eliminar una nota del nutricionista"""
    note = db.query(NutritionistNoteDB).filter(NutritionistNoteDB.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    
    db.delete(note)
    db.commit()
    return {"success": True, "message": "Nota eliminada"}

@app.get("/api/progress/stats")
def get_progress_stats(db: Session = Depends(get_db)):
    """Obtener estadísticas generales de progreso"""
    # Total de pacientes activos
    total_patients = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.status == "active"
    ).count()
    
    # Adherencia promedio
    all_patients = db.query(UserDB).filter(UserDB.role == "patient").all()
    adherence_values = [calculate_weekly_adherence(p.id, db) for p in all_patients]
    avg_adherence = int(sum(adherence_values) / len(adherence_values)) if adherence_values else 0
    
    # Pacientes en objetivo (adherencia >= 80%)
    patients_on_track = len([a for a in adherence_values if a >= 80])
    
    # Peso total perdido
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

@app.get("/api/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """
    Obtener estadísticas generales del dashboard
    """
    # Pacientes activos
    total_patients = db.query(UserDB).filter(
        UserDB.role == "patient",
        UserDB.status == "activo"
    ).count()
    
    # Para el cambio de pacientes, simplemente mostrar el total
    # Ya que UserDB no tiene created_at
    patients_change = 12  # Valor por defecto
    
    # Planes activos
    active_plans = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.status == "active"
    ).count()
    
    # Citas esta semana
    today = datetime.now().date()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    
    appointments_this_week = db.query(AppointmentDB).filter(
        AppointmentDB.date >= week_start,
        AppointmentDB.date <= week_end
    ).count()
    
    appointments_today = db.query(AppointmentDB).filter(
        AppointmentDB.date == today,
        AppointmentDB.status == "pendiente"
    ).count()
    
    # Progreso promedio
    all_active_patients = db.query(UserDB).filter(
        UserDB.role == "patient",
        UserDB.status == "activo"
    ).all()
    
    progress_values = []
    for patient in all_active_patients:
        if patient.peso_actual and patient.peso_objetivo:
            prog = calcular_progreso(patient.peso_actual, patient.peso_objetivo)
            progress_values.append(prog)
    
    avg_progress = round(sum(progress_values) / len(progress_values)) if progress_values else 78
    
    return {
        "patients": {
            "total": total_patients,
            "change": f"+{patients_change}% este mes",
            "change_type": "positive"
        },
        "plans": {
            "total": active_plans,
            "change": "+8% este mes",
            "change_type": "positive"
        },
        "appointments": {
            "total": appointments_this_week,
            "pending_today": appointments_today,
            "change": f"{appointments_today} pendientes hoy",
            "change_type": "neutral"
        },
        "progress": {
            "average": avg_progress,
            "change": "+5% vs mes anterior",
            "change_type": "positive"
        }
    }

@app.get("/api/dashboard/recent-patients")
def get_recent_patients(limit: int = 5, db: Session = Depends(get_db)):
    """
    Obtener pacientes registrados recientemente
    Nota: Como UserDB no tiene created_at, ordenamos por ID (últimos registrados)
    """
    recent_patients = db.query(UserDB).filter(
        UserDB.role == "patient"
    ).order_by(UserDB.id.desc()).limit(limit).all()
    
    results = []
    for patient in recent_patients:
        # Obtener plan activo
        active_plan = db.query(PatientMealPlanDB).filter(
            PatientMealPlanDB.patient_id == patient.id,
            PatientMealPlanDB.status == "active"
        ).first()
        
        plan_name = "Sin plan asignado"
        if active_plan:
            plan = db.query(MealPlanDB).filter(
                MealPlanDB.id == active_plan.meal_plan_id
            ).first()
            if plan:
                plan_name = plan.name
        
        results.append({
            "id": patient.id,
            "name": f"{patient.nombres} {patient.apellidos}",
            "avatar": get_avatar_url(patient.foto_perfil),
            "email": patient.email,
            "plan": plan_name,
            "status": patient.status,
            "joined": "Reciente",  # Sin fecha exacta
            "registered_at": None
        })
    
    return results
@app.get("/api/dashboard/upcoming-appointments")
def get_upcoming_appointments(limit: int = 5, db: Session = Depends(get_db)):
    """
    Obtener próximas citas programadas
    """
    today = datetime.now().date()
    
    upcoming = db.query(AppointmentDB).filter(
        AppointmentDB.date >= today,
        AppointmentDB.status != "cancelada"
    ).order_by(
        AppointmentDB.date.asc(),
        AppointmentDB.time.asc()
    ).limit(limit).all()
    
    results = []
    for appointment in upcoming:
        # Obtener información del paciente
        patient = db.query(UserDB).filter(UserDB.id == appointment.patient_id).first()
        
        # Calcular si es hoy o mañana
        days_until = (appointment.date - today).days
        if days_until == 0:
            date_label = "Hoy"
        elif days_until == 1:
            date_label = "Mañana"
        else:
            date_label = appointment.date.strftime("%d/%m/%Y")
        
        results.append({
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
            "notes": appointment.notes
        })
    
    return results

@app.get("/api/dashboard/nutrition-chart")
def get_nutrition_chart_data(db: Session = Depends(get_db)):
    """
    Obtener datos para el gráfico de nutrición del dashboard
    Muestra la distribución de macronutrientes promedio
    """
    # Obtener todos los planes activos
    active_assignments = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.status == "active"
    ).all()
    
    # Agrupar por categoría de plan
    category_data = {}
    
    for assignment in active_assignments:
        plan = db.query(MealPlanDB).filter(
            MealPlanDB.id == assignment.meal_plan_id
        ).first()
        
        if plan:
            if plan.category not in category_data:
                category_data[plan.category] = {
                    "count": 0,
                    "total_calories": 0,
                    "total_protein": 0,
                    "total_carbs": 0,
                    "total_fat": 0
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
            results.append({
                "category": category,
                "patients": data["count"],
                "avg_calories": round(data["total_calories"] / data["count"]),
                "avg_protein": round(data["total_protein"] / data["count"]),
                "avg_carbs": round(data["total_carbs"] / data["count"]),
                "avg_fat": round(data["total_fat"] / data["count"])
            })
    
    return results

@app.get("/api/dashboard/weekly-overview")
def get_weekly_overview(db: Session = Depends(get_db)):
    """
    Obtener resumen semanal de actividad
    """
    today = datetime.now().date()
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
def get_top_plans(limit: int = 5, db: Session = Depends(get_db)):
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
def get_activity_feed(limit: int = 10, db: Session = Depends(get_db)):
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
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "icon": "user-plus"
        })
    
    # Citas completadas hoy
    today = datetime.now().date()
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
def get_patient_status_distribution(db: Session = Depends(get_db)):
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
def get_appointments_by_type(db: Session = Depends(get_db)):
    """
    Obtener distribución de citas por tipo (presencial/videollamada)
    """
    today = datetime.now().date()
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
def get_patient_upcoming_appointments(patient_id: int, db: Session = Depends(get_db)):
    """
    Obtener las próximas citas de un paciente específico
    """
    # Verificar que el paciente existe
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    today = datetime.now().date()
    
    # Obtener citas futuras del paciente
    upcoming_appointments = db.query(AppointmentDB).filter(
        AppointmentDB.patient_id == patient_id,
        AppointmentDB.date >= today,
        AppointmentDB.status != "cancelada"
    ).order_by(
        AppointmentDB.date.asc(),
        AppointmentDB.time.asc()
    ).all()
    
    admin = db.query(UserDB).filter(UserDB.role == "admin").first()
    doctor_name = f"{admin.nombres} {admin.apellidos}" if admin else "Dra. María García"
    
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
def get_patient_past_appointments(patient_id: int, limit: int = 10, db: Session = Depends(get_db)):
    """
    Obtener el historial de citas pasadas de un paciente
    """
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    today = datetime.now().date()
    
    # Obtener citas pasadas
    past_appointments = db.query(AppointmentDB).filter(
        AppointmentDB.patient_id == patient_id,
        AppointmentDB.date < today
    ).order_by(
        AppointmentDB.date.desc(),
        AppointmentDB.time.desc()
    ).limit(limit).all()
    
    admin = db.query(UserDB).filter(UserDB.role == "admin").first()
    doctor_name = f"{admin.nombres} {admin.apellidos}" if admin else "Dra. María García"
    
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
            "notes": appointment.notes
        })
    
    return results

@app.get("/api/patients/{patient_id}/nutritionist")
def get_patient_nutritionist(patient_id: int, db: Session = Depends(get_db)):
    """
    Obtener información del nutricionista asignado al paciente
    """
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    # Buscar el primer nutricionista (admin)
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
    
    # Contar pacientes reales
    patients_count = db.query(UserDB).filter(UserDB.role == "patient").count()
    
    return {
        "id": nutritionist_db.id,
        "name": f"{nutritionist_db.nombres} {nutritionist_db.apellidos}",
        "title": "Nutricionista Especializado",
        "verified": True,
        "patients_count": patients_count,
        "photo": get_avatar_url(nutritionist_db.foto_perfil) or "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&h=200&fit=crop&crop=face",
        "phone": nutritionist_db.telefono,
        "email": nutritionist_db.email
    }

@app.post("/api/patients/{patient_id}/appointments/request")
def request_appointment(
    patient_id: int,
    appointment_data: dict,
    db: Session = Depends(get_db)
):
    """
    Solicitar una nueva cita (paciente)
    """
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    # Crear la solicitud de cita con estado pendiente
    try:
        appointment_date = datetime.strptime(appointment_data.get("date"), "%Y-%m-%d").date()
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Formato de fecha inválido")
    
    # Verificar disponibilidad
    existing = db.query(AppointmentDB).filter(
        AppointmentDB.date == appointment_date,
        AppointmentDB.time == appointment_data.get("time"),
        AppointmentDB.status != "cancelada"
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail="El horario seleccionado no está disponible"
        )
    
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    new_appointment = AppointmentDB(
        patient_id=patient_id,
        patient_name=f"{patient.nombres} {patient.apellidos}",
        date=appointment_date,
        time=appointment_data.get("time"),
        duration=appointment_data.get("duration", "30 min"),
        type=appointment_data.get("type", "presencial"),
        status="pendiente",
        notes=appointment_data.get("notes"),
        created_at=now,
        updated_at=now
    )
    
    db.add(new_appointment)
    db.commit()
    db.refresh(new_appointment)
    
    # Notificar al nutricionista (admin) vía WhatsApp
    # Buscar el primer nutricionista (admin/superadmin) con teléfono
    admin = db.query(UserDB).filter(UserDB.role.in_(['admin', 'superadmin']), UserDB.telefono != None).first()
    admin_phone = os.getenv("ADMIN_WHATSAPP_NUMBER")
    
    target_phone = admin.telefono if admin else admin_phone
    
    if target_phone:
        msg = (
            f"🔔 NUEVA SOLICITUD DE CITA\n\n"
            f"Paciente: {patient.nombres} {patient.apellidos}\n"
            f"📅 Fecha: {appointment_date.strftime('%d/%m/%Y')}\n"
            f"⏰ Hora: {new_appointment.time}\n"
            f"📝 Nota: {new_appointment.notes or 'Sin observaciones'}\n\n"
            f"Revisa el panel de administración para confirmarla."
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
    db: Session = Depends(get_db)
):
    """
    Reprogramar una cita existente (paciente)
    """
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
    if appointment.date < datetime.now().date():
        raise HTTPException(
            status_code=400,
            detail="No se pueden reprogramar citas pasadas"
        )
    
    try:
        new_date = datetime.strptime(reschedule_data.get("date"), "%Y-%m-%d").date()
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Formato de fecha inválido")
    
    new_time = reschedule_data.get("time")
    
    # Verificar que el nuevo horario esté disponible
    conflict = db.query(AppointmentDB).filter(
        AppointmentDB.id != appointment_id,
        AppointmentDB.date == new_date,
        AppointmentDB.time == new_time,
        AppointmentDB.status != "cancelada"
    ).first()
    
    if conflict:
        raise HTTPException(
            status_code=400,
            detail="El nuevo horario seleccionado no está disponible"
        )
    
    # Actualizar la cita
    appointment.date = new_date
    appointment.time = new_time
    appointment.status = "pendiente"  # Volver a pendiente para confirmación
    appointment.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
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
    db: Session = Depends(get_db)
):
    """
    Cancelar una cita (paciente)
    """
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
    if appointment.date < datetime.now().date():
        raise HTTPException(
            status_code=400,
            detail="No se pueden cancelar citas pasadas"
        )
    
    # Verificar que no sea una cita muy próxima (opcional, menos de 24 horas)
    hours_until = (datetime.combine(appointment.date, datetime.strptime(appointment.time, "%H:%M").time()) - datetime.now()).total_seconds() / 3600
    
    if hours_until < 24:
        # Aún permitir cancelación pero con advertencia
        pass
    
    appointment.status = "cancelada"
    appointment.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    db.commit()
    
    return {
        "success": True,
        "message": "Cita cancelada exitosamente"
    }

@app.get("/api/patients/{patient_id}/appointments/stats")
def get_patient_appointment_stats(patient_id: int, db: Session = Depends(get_db)):
    """
    Obtener estadísticas de citas del paciente
    """
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    today = datetime.now().date()
    
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
    db: Session = Depends(get_db)
):
    """
    Obtener horarios disponibles para una fecha específica (vista del paciente)
    """
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido")
    
    # No permitir fechas pasadas
    if target_date < datetime.now().date():
        raise HTTPException(status_code=400, detail="No se pueden agendar citas en fechas pasadas")
    
    # Horarios estándar de atención (8:00 AM - 7:00 PM)
    all_slots = []
    for hour in range(8, 19):
        all_slots.append(f"{hour:02d}:00")
        all_slots.append(f"{hour:02d}:30")
    
    # Obtener horarios ocupados
    occupied = db.query(AppointmentDB).filter(
        AppointmentDB.date == target_date,
        AppointmentDB.status != "cancelada"
    ).all()
    
    occupied_times = [apt.time for apt in occupied]
    
    # Filtrar disponibles
    available_slots = []
    now = datetime.now()
    
    for slot in all_slots:
        is_available = slot not in occupied_times
        
        # Si es hoy, no permitir horas pasadas
        if target_date == now.date():
            slot_time = datetime.strptime(slot, "%H:%M").time()
            if slot_time <= now.time():
                is_available = False
        
        available_slots.append({
            "time": slot,
            "available": is_available,
            "formatted": datetime.strptime(slot, "%H:%M").strftime("%I:%M %p")
        })
    
    return {
        "date": date,
        "slots": available_slots,
        "total_available": len([s for s in available_slots if s["available"]])
    }

# ==================== ENDPOINT ADICIONAL PARA DASHBOARD ====================

@app.get("/api/patients/{patient_id}/dashboard/summary")
def get_patient_dashboard_summary(patient_id: int, db: Session = Depends(get_db)):
    """
    Obtener resumen completo del dashboard del paciente
    """
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    today = datetime.now().date()
    
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
            "photo": get_avatar_url(patient.foto_perfil)
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
        "avatar": get_avatar_url(user.foto_perfil)
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
    user.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
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
    
    # Guardar archivo usando storage_manager (local en DEBUG, GCS en producción)
    file_name = f"admin_{user_id}_avatar.{file_extension}"
    file_url = await storage_manager.save_file(
        file_content=contents,
        filename=file_name,
        content_type=file.content_type
    )
    
    if not file_url:
        raise HTTPException(status_code=500, detail="Error al guardar la imagen")
    
    # Actualizar nombre del archivo en BD (no la URL)
    user.foto_perfil = file_url  # Guarda solo filename en GCS, o /media/file en local
    db.commit()
    
    return {
        "success": True,
        "avatar_url": get_avatar_url(user.foto_perfil)  # Retorna URL firmada fresca
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
    user.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
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
def get_billing_info(user_id: int, db: Session = Depends(get_db)):
    """Obtener información de facturación (Mock)"""
    user = db.query(UserDB).filter(
        UserDB.id == user_id,
        UserDB.role.in_(["admin", "superadmin"])
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Administrador no encontrado")
    
    # Datos mock de facturación
    return {
        "plan": {
            "name": "Plan Profesional",
            "description": "Hasta 100 pacientes activos",
            "price": 29,
            "currency": "EUR",
            "billing_cycle": "monthly"
        },
        "payment_method": {
            "type": "card",
            "brand": "VISA",
            "last4": "4242",
            "expiry": "12/25"
        },
        "invoices": [
            {
                "id": 1,
                "date": "2024-12-01",
                "amount": 29.00,
                "status": "paid",
                "invoice_url": "#"
            },
            {
                "id": 2,
                "date": "2024-11-01",
                "amount": 29.00,
                "status": "paid",
                "invoice_url": "#"
            },
            {
                "id": 3,
                "date": "2024-10-01",
                "amount": 29.00,
                "status": "paid",
                "invoice_url": "#"
            }
        ]
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
            "avatar": get_avatar_url(user.foto_perfil)
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
    email_notifications = Column(Integer, default=1)
    slack_notifications = Column(Integer, default=0)
    updated_at = Column(String(50))

# Crear las tablas
Base.metadata.create_all(bind=engine)

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
            "avatar": get_avatar_url(user.foto_perfil)
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
    user.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    db.commit()
    
    return {
        "success": True,
        "message": "Contraseña actualizada correctamente"
    }

# ==================== ENDPOINTS DE CONFIGURACIÓN PARA SUPERADMIN ====================

@app.get("/api/superadmin/settings/{user_id}")
def get_system_settings(user_id: int, db: Session = Depends(get_db)):
    """Obtener configuración del sistema (solo superadmin)"""
    user = db.query(UserDB).filter(
        UserDB.id == user_id,
        UserDB.role == "superadmin"
    ).first()
    
    if not user:
        raise HTTPException(status_code=403, detail="Acceso denegado")
    
    # Obtener o crear configuración del sistema
    settings = db.query(SystemSettingsDB).first()
    
    if not settings:
        settings = SystemSettingsDB(
            site_name="NutriData",
            support_email="soporte@nutridata.com",
            max_users_per_org=100,
            max_patients_per_nutritionist=50,
            enable_registration=1,
            require_email_verification=1,
            enable_two_factor=0,
            maintenance_mode=0,
            email_notifications=1,
            slack_notifications=0,
            updated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return {
        "siteName": settings.site_name,
        "supportEmail": settings.support_email,
        "maxUsersPerOrg": settings.max_users_per_org,
        "maxPatientsPerNutritionist": settings.max_patients_per_nutritionist,
        "enableRegistration": bool(settings.enable_registration),
        "requireEmailVerification": bool(settings.require_email_verification),
        "enableTwoFactor": bool(settings.enable_two_factor),
        "maintenanceMode": bool(settings.maintenance_mode),
        "emailNotifications": bool(settings.email_notifications),
        "slackNotifications": bool(settings.slack_notifications)
    }

@app.put("/api/superadmin/settings/{user_id}")
def update_system_settings(
    user_id: int,
    settings_data: SystemSettingsUpdate,
    db: Session = Depends(get_db)
):
    """Actualizar configuración del sistema (solo superadmin)"""
    user = db.query(UserDB).filter(
        UserDB.id == user_id,
        UserDB.role == "superadmin"
    ).first()
    
    if not user:
        raise HTTPException(status_code=403, detail="Acceso denegado")
    
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
    settings.email_notifications = int(settings_data.emailNotifications)
    settings.slack_notifications = int(settings_data.slackNotifications)
    settings.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    db.commit()
    
    return {
        "success": True,
        "message": "Configuración del sistema actualizada"
    }

# ==================== ENDPOINTS ADICIONALES PARA PORTAL DEL PACIENTE ====================
# Agregar estos endpoints al archivo main.py existente

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
            "avatar": get_avatar_url(user.foto_perfil)
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
    user.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    db.commit()
    
    return {
        "success": True,
        "message": "Contraseña actualizada correctamente"
    }

# ==================== ENDPOINTS DE CONFIGURACIÓN PARA SUPERADMIN ====================

@app.get("/api/superadmin/settings/{user_id}")
def get_system_settings(user_id: int, db: Session = Depends(get_db)):
    """Obtener configuración del sistema (solo superadmin)"""
    user = db.query(UserDB).filter(
        UserDB.id == user_id,
        UserDB.role == "superadmin"
    ).first()
    
    if not user:
        raise HTTPException(status_code=403, detail="Acceso denegado")
    
    # Obtener o crear configuración del sistema
    settings = db.query(SystemSettingsDB).first()
    
    if not settings:
        settings = SystemSettingsDB(
            site_name="NutriData",
            support_email="soporte@nutridata.com",
            max_users_per_org=100,
            max_patients_per_nutritionist=50,
            enable_registration=1,
            require_email_verification=1,
            enable_two_factor=0,
            maintenance_mode=0,
            email_notifications=1,
            slack_notifications=0,
            updated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return {
        "siteName": settings.site_name,
        "supportEmail": settings.support_email,
        "maxUsersPerOrg": settings.max_users_per_org,
        "maxPatientsPerNutritionist": settings.max_patients_per_nutritionist,
        "enableRegistration": bool(settings.enable_registration),
        "requireEmailVerification": bool(settings.require_email_verification),
        "enableTwoFactor": bool(settings.enable_two_factor),
        "maintenanceMode": bool(settings.maintenance_mode),
        "emailNotifications": bool(settings.email_notifications),
        "slackNotifications": bool(settings.slack_notifications)
    }

@app.put("/api/superadmin/settings/{user_id}")
def update_system_settings(
    user_id: int,
    settings_data: SystemSettingsUpdate,
    db: Session = Depends(get_db)
):
    """Actualizar configuración del sistema (solo superadmin)"""
    user = db.query(UserDB).filter(
        UserDB.id == user_id,
        UserDB.role == "superadmin"
    ).first()
    
    if not user:
        raise HTTPException(status_code=403, detail="Acceso denegado")
    
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
    settings.email_notifications = int(settings_data.emailNotifications)
    settings.slack_notifications = int(settings_data.slackNotifications)
    settings.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    db.commit()
    
    return {
        "success": True,
        "message": "Configuración del sistema actualizada"
    }
# ==================== ENDPOINTS ADICIONALES PARA PORTAL DEL PACIENTE ====================



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
    
    today = datetime.now().date()
    
    # 1. Información básica del paciente
    patient_info = {
        "id": patient.id,
        "name": f"{patient.nombres} {patient.apellidos}",
        "email": patient.email,
        "photo": get_avatar_url(patient.foto_perfil),
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
            "date": datetime.now().strftime("%Y-%m-%d"),
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
            "date": datetime.now().strftime("%Y-%m-%d"),
            "meals": [],
            "total_calories": 0,
            "message": "No hay menú configurado para esta semana"
        }
    
    # Determinar el día de la semana
    today = datetime.now()
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
        "completed_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

# ==================== ENDPOINTS DE PROGRESO DEL PACIENTE ====================

@app.get("/api/patient/{patient_id}/progress")
def get_patient_own_progress(patient_id: int, db: Session = Depends(get_db)):
    """
    Obtener el progreso detallado del paciente (vista del paciente)
    """
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
    db: Session = Depends(get_db)
):
    """
    Agregar una nueva métrica de progreso (desde el paciente)
    """
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
        created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
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
        AppointmentDB.date < datetime.now().date(),
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
            "foto_perfil": get_avatar_url(patient.foto_perfil)
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
    db: Session = Depends(get_db)
):
    """Subir foto de perfil del paciente"""
    user = db.query(UserDB).filter(
        UserDB.id == patient_id,
        UserDB.role == "patient"
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
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
    
    # Guardar archivo usando storage_manager (local en DEBUG, GCS en producción)
    file_name = f"patient_{patient_id}_avatar.{file_extension}"
    file_url = await storage_manager.save_file(
        file_content=contents,
        filename=file_name,
        content_type=file.content_type
    )
    
    if not file_url:
        raise HTTPException(status_code=500, detail="Error al guardar la imagen")
    
    # Actualizar nombre del archivo en BD (no la URL)
    user.foto_perfil = file_url  # Guarda solo filename en GCS, o /media/file en local
    db.commit()
    
    return {
        "success": True,
        "foto_url": get_avatar_url(user.foto_perfil)  # Retorna URL firmada fresca
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
    
    patient.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
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
    
    today = datetime.now().date()
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
    
    today = datetime.now().date()
    
    # 1. Obtener comidas del día desde el plan activo
    today_meals = get_patient_today_meals(patient_id, today, db)
    
    # 2. Calcular estadísticas de calorías
    completed_meals = [m for m in today_meals if m["completed"]]
    total_calories_consumed = sum(m["calories"] for m in completed_meals)
    total_calories_target = sum(m["calories"] for m in today_meals)
    
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
    macronutrients = {
        "protein_percentage": 30,
        "carbs_percentage": 45,
        "fat_percentage": 25,
        "protein_grams": 0,
        "carbs_grams": 0,
        "fat_grams": 0
    }
    
    # Obtener plan activo del paciente
    active_plan_assignment = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.patient_id == patient_id,
        PatientMealPlanDB.status == "active"
    ).first()
    
    if active_plan_assignment:
        # Buscar el plan nutricional
        plan = db.query(MealPlanDB).filter(
            MealPlanDB.id == active_plan_assignment.meal_plan_id
        ).first()
        
        if plan:
            # Calcular gramos basados en calorías totales
            # 1g proteína = 4 kcal, 1g carbohidratos = 4 kcal, 1g grasa = 9 kcal
            total_calories = plan.calories or total_calories_target or 2000
            
            protein_calories = total_calories * (macronutrients["protein_percentage"] / 100)
            carbs_calories = total_calories * (macronutrients["carbs_percentage"] / 100)
            fat_calories = total_calories * (macronutrients["fat_percentage"] / 100)
            
            macronutrients["protein_grams"] = round(protein_calories / 4, 1)
            macronutrients["carbs_grams"] = round(carbs_calories / 4, 1)
            macronutrients["fat_grams"] = round(fat_calories / 9, 1)
    
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
    day_of_year = datetime.now().timetuple().tm_yday
    tip_of_day = tips[day_of_year % len(tips)]
    
    return {
        "stats": {
            "altura": patient.altura,
            "peso_actual": patient.peso_actual,
            "edad_formateada": calcular_edad_detallada(patient.fecha_nacimiento),
            "calories": {
                "consumed": total_calories_consumed,
                "target": total_calories_target,
                "percentage": int((total_calories_consumed / total_calories_target * 100)) if total_calories_target > 0 else 0
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
                ["receta", "recipe", "name", "nombre", "descripcion", "description", "titulo", "title"],
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
            ingredients = meal_data.get("ingredients") or []
            instructions = meal_data.get("instructions") or []
            image = meal_data.get("image")
            
            recipe_id = meal_data.get("recipe_id")
            if (not ingredients or not instructions) and recipe_id:
                from sqlalchemy import text
                recipe = db.query(RecipeDB).filter(RecipeDB.id == recipe_id).first()
                if recipe:
                    if not ingredients: ingredients = recipe.ingredients
                    if not instructions: instructions = recipe.instructions
                    if not image: image = recipe.image

            result.append({
                "meal_type": meal_info["id"],
                "name": meal_info["name"],
                "time": meal_info["time"],
                "calories": int(calories) if calories else 0,
                "completed": bool(tracked.completed) if tracked else False,
                "description": str(description),
                "protein": int(protein) if protein else 0,
                "carbs": int(carbs) if carbs else 0,
                "fat": int(fat) if fat else 0,
                "ingredients": list(ingredients) if isinstance(ingredients, list) else [],
                "instructions": list(instructions) if isinstance(instructions, list) else [],
                "image": image,
                "type": meal_info["id"] # Alias for consistency
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
    today = datetime.now().date()
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
    today = datetime.now().date()
    
    water_tracking = db.query(WaterTrackingDB).filter(
        WaterTrackingDB.patient_id == patient_id,
        WaterTrackingDB.date == today
    ).first()
    
    if not water_tracking:
        water_tracking = WaterTrackingDB(
            patient_id=patient_id,
            date=today,
            amount_ml=glass_ml,
            updated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        )
        db.add(water_tracking)
    else:
        water_tracking.amount_ml += glass_ml
        water_tracking.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
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
    today = datetime.now().date()
    
    # Buscar si ya existe registro
    tracking = db.query(MealTrackingDB).filter(
        MealTrackingDB.patient_id == patient_id,
        MealTrackingDB.date == today,
        MealTrackingDB.meal_type == meal_data.meal_type
    ).first()
    
    if tracking:
        tracking.completed = True
        tracking.updated_at = datetime.now()
    else:
        tracking = MealTrackingDB(
            patient_id=patient_id,
            date=today,
            meal_type=meal_data.meal_type,
            completed=True,
            updated_at=datetime.now()
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
    today = datetime.now().date()
    
    tracking = db.query(MealTrackingDB).filter(
        MealTrackingDB.patient_id == patient_id,
        MealTrackingDB.date == today,
        MealTrackingDB.meal_type == meal_data.meal_type
    ).first()
    
    if tracking:
        tracking.completed = False
        tracking.updated_at = datetime.now()
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
    
    # Obtener TODOS los menús semanales del plan
    all_weekly_menus = db.query(WeeklyMenuDB).filter(
        WeeklyMenuDB.meal_plan_id == plan.id
    ).all()
    
    # Si no hay menús (caso raro), retornar vacío
    if not all_weekly_menus:
         return {
            "has_plan": True,
            "plan_name": plan.name,
            "doctor": doctor_name,
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
        "stats": {
            "calories": {"target": plan.calories},
            "protein": {"target": int(plan.calories * (plan.protein_target or 20) / 100 / 4)},
            "carbs": {"target": int(plan.calories * (plan.carbs_target or 50) / 100 / 4)},
            "fat": {"target": int(plan.calories * (plan.fat_target or 30) / 100 / 9)}
        },
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
    
    today = datetime.now().date()
    
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
            created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
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
            created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
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
def get_top_patients_progress(limit: int = 3, db: Session = Depends(get_db)):
    """
    Obtener los pacientes con mejor progreso para el dashboard del admin
    """
    # Obtener todos los pacientes activos
    patients = db.query(UserDB).filter(UserDB.role == "patient").all()
    
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
        
        # Calcular progreso
        peso_inicial = patient.peso_inicial or patient.peso_actual
        peso_actual = patient.peso_actual
        peso_objetivo = patient.peso_objetivo
        
        if not peso_inicial or not peso_actual or not peso_objetivo:
            continue
        
        # Calcular cambio de peso y porcentaje de meta
        peso_cambio = peso_inicial - peso_actual
        meta_total = abs(peso_inicial - peso_objetivo)
        progreso_porcentaje = int((abs(peso_cambio) / meta_total * 100)) if meta_total > 0 else 0
        
        # Limitar a 100%
        progreso_porcentaje = min(progreso_porcentaje, 100)
        
        patient_progress_list.append({
            "id": patient.id,
            "name": f"{patient.nombres} {patient.apellidos}",
            "plan_name": meal_plan.name if meal_plan else "Plan Nutricional",
            "weight_change": round(peso_cambio, 1),
            "progress_percentage": progreso_porcentaje,
            "avatar": get_avatar_url(patient.foto_perfil)
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
    
    meal_date = datetime.strptime(toggle_data.date, "%Y-%m-%d").date() if toggle_data.date else datetime.now().date()
    
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
        meal_tracking.completed_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
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
        meal_tracking.completed_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
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
    
    meal_date = datetime.strptime(food_data.date, "%Y-%m-%d").date() if food_data.date else datetime.now().date()
    
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
            created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
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
    meal_date = datetime.strptime(date, "%Y-%m-%d").date() if date else datetime.now().date()
    
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
    
    meal_date = datetime.strptime(date, "%Y-%m-%d").date() if date else datetime.now().date()
    
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
    """Calcular totales y promedios de un menú semanal"""
    total_calories = 0
    total_protein = 0
    total_carbs = 0
    total_fat = 0
    total_days = len(week_data)
    
    for day in week_data:
        for meal in day.get("meals", []):
            if meal.get("recipe"):
                total_calories += meal.get("calories", 0)
                total_protein += meal.get("protein", 0)
                total_carbs += meal.get("carbs", 0)
                total_fat += meal.get("fat", 0)
    
    return {
        "total_calories": total_calories // total_days if total_days > 0 else 0,
        "avg_protein": total_protein // total_days if total_days > 0 else 0,
        "avg_carbs": total_carbs // total_days if total_days > 0 else 0,
        "avg_fat": total_fat // total_days if total_days > 0 else 0
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
    
    return {
        "id": menu.id,
        "name": menu.name,
        "description": menu.description,
        "category": menu.category,
        "week": week_data,
        "total_calories": menu.total_calories,
        "avg_protein": menu.avg_protein,
        "avg_carbs": menu.avg_carbs,
        "avg_fat": menu.avg_fat,
        "assigned_patients": menu.assigned_patients,
        "is_active": menu.is_active,
        "created_at": menu.created_at
    }

# ==================== ENDPOINTS PARA WEEKLY MENUS ====================

@app.get("/api/weekly-menus")
def get_weekly_menus(
    search: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Obtener todos los menús semanales con filtros opcionales
    """
    query = db.query(WeeklyMenuCompleteDB).filter(WeeklyMenuCompleteDB.is_active == 1)
    
    if search:
        query = query.filter(
            (WeeklyMenuCompleteDB.name.contains(search)) |
            (WeeklyMenuCompleteDB.description.contains(search))
        )
    
    if category:
        query = query.filter(WeeklyMenuCompleteDB.category == category)
    
    menus = query.order_by(WeeklyMenuCompleteDB.created_at.desc()).all()
    
    return [serialize_weekly_menu(menu) for menu in menus]

@app.get("/api/weekly-menus/{menu_id}")
def get_weekly_menu(menu_id: int, db: Session = Depends(get_db)):
    """
    Obtener un menú semanal específico
    """
    menu = db.query(WeeklyMenuCompleteDB).filter(
        WeeklyMenuCompleteDB.id == menu_id
    ).first()
    
    if not menu:
        raise HTTPException(status_code=404, detail="Menú no encontrado")
    
    return serialize_weekly_menu(menu)

@app.post("/api/weekly-menus")
def create_weekly_menu(
    menu_data: WeeklyMenuCompleteCreate,
    db: Session = Depends(get_db)
):
    """
    Crear un nuevo menú semanal
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
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
    
    # Crear el menú
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
        updated_at=now
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
    db: Session = Depends(get_db)
):
    """
    Actualizar un menú semanal existente
    """
    menu = db.query(WeeklyMenuCompleteDB).filter(
        WeeklyMenuCompleteDB.id == menu_id
    ).first()
    
    if not menu:
        raise HTTPException(status_code=404, detail="Menú no encontrado")
    
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
    
    menu.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
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
def delete_weekly_menu(menu_id: int, db: Session = Depends(get_db)):
    """
    Eliminar un menú semanal
    """
    menu = db.query(WeeklyMenuCompleteDB).filter(
        WeeklyMenuCompleteDB.id == menu_id
    ).first()
    
    if not menu:
        raise HTTPException(status_code=404, detail="Menú no encontrado")
    
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
def duplicate_weekly_menu(menu_id: int, db: Session = Depends(get_db)):
    """
    Duplicar un menú semanal
    """
    original = db.query(WeeklyMenuCompleteDB).filter(
        WeeklyMenuCompleteDB.id == menu_id
    ).first()
    
    if not original:
        raise HTTPException(status_code=404, detail="Menú no encontrado")
    
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
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
        updated_at=now
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
    db: Session = Depends(get_db)
):
    """
    Asignar un menú semanal a uno o varios pacientes
    """
    menu = db.query(WeeklyMenuCompleteDB).filter(
        WeeklyMenuCompleteDB.id == assignment_data.menu_id
    ).first()
    
    if not menu:
        raise HTTPException(status_code=404, detail="Menú no encontrado")
    
    # Verificar que todos los pacientes existan
    patients = db.query(UserDB).filter(
        UserDB.id.in_(assignment_data.patient_ids),
        UserDB.role == "patient"
    ).all()
    
    if len(patients) != len(assignment_data.patient_ids):
        raise HTTPException(status_code=404, detail="Uno o más pacientes no encontrados")
    
    # Crear un meal plan temporal basado en el menú semanal
    # (Esto depende de cómo quieras integrar con tu sistema de meal plans)
    
    assigned_count = 0
    errors = []
    
    for patient in patients:
        try:
            # Crear asignación del menú
            # Aquí puedes crear un registro personalizado o usar PatientMealPlanDB
            
            # Opción 1: Crear un meal plan temporal
            temp_plan = MealPlanDB(
                name=menu.name,
                description=menu.description,
                calories=menu.total_calories,
                duration="1 semana",
                category=menu.category,
                color="primary",
                protein_target=menu.avg_protein,
                carbs_target=menu.avg_carbs,
                fat_target=menu.avg_fat,
                meals_per_day=5,
                is_active=1,
                created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            )
            db.add(temp_plan)
            db.flush()
            
            # --- POPULAR WEEKLY MENUS FOR 4 WEEKS ---
            wk_days_map = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
            
            for wk_num in range(1, 5):
                idx = wk_num - 1
                week_data_db = {}
                
                for d_key in wk_days_map:
                    d_col = getattr(menu, d_key, [])
                    d_data = {}
                    
                    if isinstance(d_col, list) and len(d_col) > idx:
                        d_data = d_col[idx]
                    elif isinstance(d_col, dict) and wk_num == 1:
                        d_data = d_col
                    
                    week_data_db[d_key] = d_data
                
                new_weekly_menu = WeeklyMenuDB(
                    meal_plan_id=temp_plan.id,
                    week_number=wk_num,
                    monday=week_data_db["monday"],
                    tuesday=week_data_db["tuesday"],
                    wednesday=week_data_db["wednesday"],
                    thursday=week_data_db["thursday"],
                    friday=week_data_db["friday"],
                    saturday=week_data_db["saturday"],
                    sunday=week_data_db["sunday"],
                    created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                )
                db.add(new_weekly_menu)
            
            # Crear la asignación
            assignment = PatientMealPlanDB(
                patient_id=patient.id,
                meal_plan_id=temp_plan.id,
                assigned_date=datetime.now().strftime("%Y-%m-%d"),
                start_date=assignment_data.start_date,
                current_week=1,
                status="active",
                notes=assignment_data.notes
            )
            db.add(assignment)
            db.flush() # Para tener el ID
            
            # --- GENERAR COMIDAS PARA LAS 4 SEMANAS ---
            start_date_obj = datetime.strptime(assignment_data.start_date, "%Y-%m-%d").date()
            
            # Iterar 28 días (4 semanas)
            for day_offset in range(28):
                current_date = start_date_obj + timedelta(days=day_offset)
                current_week_num = (day_offset // 7) + 1
                weekday_idx = day_offset % 7 # 0=Monday
                
                # Mapear índice a key del modelo
                day_keys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
                day_key = day_keys[weekday_idx]
                
                # Obtener datos del día específico y semana específica
                day_col_data = getattr(menu, day_key, [])
                day_meals_data = {}
                
                if isinstance(day_col_data, list) and len(day_col_data) >= current_week_num:
                    day_meals_data = day_col_data[current_week_num - 1] # Index es week-1
                elif isinstance(day_col_data, dict) and current_week_num == 1:
                    # Soporte legacy
                    day_meals_data = day_col_data
                
                # Crear asignación diaria si hay comidas
                meals_list = day_meals_data.get("meals", [])
                if meals_list:
                    daily_assignment = DailyMealAssignmentDB(
                        patient_meal_plan_id=assignment.id,
                        date=current_date,
                        status="pending"
                    )
                    
                    # Rellenar comidas
                    for meal in meals_list:
                        m_type = meal.get("type", "").lower()
                        if "desayuno" in m_type:
                            daily_assignment.breakfast = meal
                        elif "almuerzo" in m_type:
                            daily_assignment.lunch = meal
                        elif "cena" in m_type:
                            daily_assignment.dinner = meal
                        elif "merienda" in m_type or "snack" in m_type:
                            # Simple lógica para asignar snacks a slots disponibles
                            if not daily_assignment.morning_snack:
                                daily_assignment.morning_snack = meal
                            elif not daily_assignment.afternoon_snack:
                                daily_assignment.afternoon_snack = meal
                            else:
                                daily_assignment.evening_snack = meal

                    db.add(daily_assignment)
            
            assigned_count += 1
            
        except Exception as e:
            errors.append(f"Error al asignar a {patient.nombres}: {str(e)}")
    
    # Actualizar contador de pacientes asignados
    menu.assigned_patients += assigned_count
    
    try:
        db.commit()
        
        return {
            "success": True,
            "message": f"Menú asignado a {assigned_count} pacientes",
            "assigned_count": assigned_count,
            "errors": errors if errors else None
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al asignar menú: {str(e)}")

@app.get("/api/weekly-menus/stats")
def get_weekly_menus_stats(db: Session = Depends(get_db)):
    """
    Obtener estadísticas de menús semanales
    """
    total_menus = db.query(WeeklyMenuCompleteDB).filter(
        WeeklyMenuCompleteDB.is_active == 1
    ).count()
    
    total_assigned = db.query(
        func.sum(WeeklyMenuCompleteDB.assigned_patients)
    ).filter(WeeklyMenuCompleteDB.is_active == 1).scalar() or 0
    
    # Calcular calorías promedio
    avg_calories = db.query(
        func.avg(WeeklyMenuCompleteDB.total_calories)
    ).filter(WeeklyMenuCompleteDB.is_active == 1).scalar() or 0
    
    # Contar recetas únicas utilizadas
    # (Esto es una aproximación, necesitarías una lógica más compleja)
    total_recipes = 0
    menus = db.query(WeeklyMenuCompleteDB).filter(
        WeeklyMenuCompleteDB.is_active == 1
    ).all()
    
    unique_recipes = set()
    for menu in menus:
        for day in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]:
            day_data = getattr(menu, day, {})
            if isinstance(day_data, dict):
                for meal in day_data.get("meals", []):
                    if meal.get("recipe_id"):
                        unique_recipes.add(meal["recipe_id"])
    
    total_recipes = len(unique_recipes)
    
    return {
        "total_menus": total_menus,
        "total_assigned_patients": total_assigned,
        "avg_calories": int(avg_calories),
        "total_recipes_used": total_recipes
    }

@app.get("/api/weekly-menus/categories")
def get_menu_categories(db: Session = Depends(get_db)):
    """
    Obtener todas las categorías de menús disponibles
    """
    categories = db.query(
        WeeklyMenuCompleteDB.category,
        func.count(WeeklyMenuCompleteDB.id).label("count")
    ).filter(
        WeeklyMenuCompleteDB.is_active == 1
    ).group_by(WeeklyMenuCompleteDB.category).all()
    
    return [
        {"name": cat[0], "count": cat[1]}
        for cat in categories
    ]

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
    export_data["export_date"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
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
def change_patient_weekly_menu(patient_id: int, data: dict, db: Session = Depends(get_db)):
    """
    Cambia el menú semanal de un paciente sin perder su progreso
    Mantiene el plan nutricional actual y solo actualiza las comidas diarias
    """
    new_menu_id = data.get("weekly_menu_id")
    start_date_str = data.get("start_date")  # Opcional, default: mañana
    
    # Obtener plan activo del paciente
    active_plan = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.patient_id == patient_id,
        PatientMealPlanDB.status == "active"
    ).order_by(PatientMealPlanDB.id.desc()).first()
    
    if not active_plan:
        raise HTTPException(status_code=404, detail="No hay plan activo para este paciente")
    
    # Obtener nuevo menú
    new_menu = db.query(WeeklyMenuCompleteDB).filter(
        WeeklyMenuCompleteDB.id == new_menu_id
    ).first()
    
    if not new_menu:
        raise HTTPException(status_code=404, detail="Menú no encontrado")
    
    # Determinar fecha de inicio
    if start_date_str:
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
    else:
        start_date = datetime.now().date() + timedelta(days=1)  # Mañana
    
    # Eliminar asignaciones futuras (mantener el historial pasado)
    db.query(DailyMealAssignmentDB).filter(
        DailyMealAssignmentDB.patient_meal_plan_id == active_plan.id,
        DailyMealAssignmentDB.date >= start_date
    ).delete()
    
    # Generar nuevas asignaciones con el nuevo menú
    days_map = {
        0: ("monday", "Lunes"),
        1: ("tuesday", "Martes"),
        2: ("wednesday", "Miércoles"),
        3: ("thursday", "Jueves"),
        4: ("friday", "Viernes"),
        5: ("saturday", "Sábado"),
        6: ("sunday", "Domingo")
    }
    
    # Generar 4 semanas de comidas (28 días)
    for i in range(28):
        current_date = start_date + timedelta(days=i)
        day_index = current_date.weekday()
        day_col, day_name = days_map[day_index]
        
        day_data = getattr(new_menu, day_col, {})
        if isinstance(day_data, str):
            import json
            day_data = json.loads(day_data)
        
        meals = day_data.get("meals", [])
        
        daily = DailyMealAssignmentDB(
            patient_meal_plan_id=active_plan.id,
            date=current_date,
            day_of_week=day_name,
            generated_from_menu_id=new_menu_id
        )
        
        for meal in meals:
            meal_type = meal.get("type", "")
            if meal_type == "desayuno":
                daily.breakfast = meal
            elif meal_type == "almuerzo":
                daily.morning_snack = meal
            elif meal_type == "comida":
                daily.lunch = meal
            elif meal_type == "merienda":
                daily.afternoon_snack = meal
            elif meal_type == "cena":
                daily.dinner = meal
        
        db.add(daily)
    
    db.commit()
    
    return {
        "success": True,
        "message": f"Menú cambiado exitosamente. Inicia el {start_date.strftime('%Y-%m-%d')}",
        "new_menu": {
            "id": new_menu.id,
            "name": new_menu.name,
            "start_date": start_date.strftime("%Y-%m-%d")
        }
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
                "is_current": end >= datetime.now().date()
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

Base.metadata.create_all(bind=engine)

# --- Endpoint para que el Dialog del Front pueda listar los menús ---
@app.get("/api/weekly-menus")
@app.get("/api/weekly-menus-complete")
def get_all_weekly_menus(db: Session = Depends(get_db)):
    """
    Obtener todos los menús semanales completos para el diálogo de asignación
    """
    try:
        menus = db.query(WeeklyMenuCompleteDB).filter(
            WeeklyMenuCompleteDB.is_active == 1
        ).all()
        
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
    db: Session = Depends(get_db)
):
    """
    Vincular un menú semanal completo a un plan nutricional
    """
    menu_id = data.get("weekly_menu_id")
    
    # Verificar que el plan existe
    plan = db.query(MealPlanDB).filter(MealPlanDB.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    
    # Verificar que el menú existe
    menu = db.query(WeeklyMenuCompleteDB).filter(
        WeeklyMenuCompleteDB.id == menu_id
    ).first()
    if not menu:
        raise HTTPException(status_code=404, detail="Menú no encontrado")
    
    # Eliminar menú anterior vinculado (si existe)
    db.query(WeeklyMenuDB).filter(
        WeeklyMenuDB.meal_plan_id == plan_id
    ).delete()
    
    # Crear vínculo en WeeklyMenuDB copiando datos de WeeklyMenuCompleteDB
    new_menu = WeeklyMenuDB(
        meal_plan_id=plan_id,
        week_number=1,
        monday=menu.monday,
        tuesday=menu.tuesday,
        wednesday=menu.wednesday,
        thursday=menu.thursday,
        friday=menu.friday,
        saturday=menu.saturday,
        sunday=menu.sunday
    )
    
    db.add(new_menu)
    db.commit()
    db.refresh(new_menu)
    
    return {
        "success": True,
        "message": "Menú vinculado al plan correctamente",
        "menu_id": new_menu.id
    }
@app.get("/api/superadmin/users", response_model=List[SuperAdminUserResponse])
def superadmin_get_all_users(
    search: Optional[str] = None,
    role: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
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
        results.append({
            "id": user.id,
            "name": f"{user.nombres} {user.apellidos}",
            "email": user.email,
            "role": user.role,
            "status": user.status,
            "avatar": get_avatar_url(user.foto_perfil),
            "createdAt": user.created_at.strftime("%Y-%m-%d") if user.created_at else None,
            "lastLogin": user.updated_at if user.updated_at else None
        })
    
    return results

@app.post("/api/superadmin/users", response_model=SuperAdminUserResponse)
def superadmin_create_user(
    user_data: SuperAdminUserCreate,
    db: Session = Depends(get_db)
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
        created_at=datetime.now()
    )
    
    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        return {
            "id": new_user.id,
            "name": f"{new_user.nombres} {new_user.apellidos}",
            "email": new_user.email,
            "role": new_user.role,
            "status": new_user.status,
            "avatar": get_avatar_url(new_user.foto_perfil),
            "createdAt": new_user.created_at.strftime("%Y-%m-%d"),
            "lastLogin": None
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al crear usuario: {str(e)}")

@app.get("/api/superadmin/users/{user_id}", response_model=SuperAdminUserResponse)
def superadmin_get_user(user_id: int, db: Session = Depends(get_db)):
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
        "avatar": get_avatar_url(user.foto_perfil),
        "createdAt": user.created_at.strftime("%Y-%m-%d") if user.created_at else None,
        "lastLogin": user.updated_at
    }

@app.put("/api/superadmin/users/{user_id}", response_model=SuperAdminUserResponse)
def superadmin_update_user(
    user_id: int,
    user_data: SuperAdminUserUpdate,
    db: Session = Depends(get_db)
):
    """
    Actualizar información de un usuario
    """
    user = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
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
    user.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    try:
        db.commit()
        db.refresh(user)
        
        return {
            "id": user.id,
            "name": f"{user.nombres} {user.apellidos}",
            "email": user.email,
            "role": user.role,
            "status": user.status,
            "avatar": get_avatar_url(user.foto_perfil),
            "createdAt": user.created_at.strftime("%Y-%m-%d") if user.created_at else None,
            "lastLogin": user.updated_at
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al actualizar usuario: {str(e)}")

@app.delete("/api/superadmin/users/{user_id}")
def superadmin_delete_user(user_id: int, db: Session = Depends(get_db)):
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
        db.delete(user)
        db.commit()
        return {"success": True, "message": "Usuario eliminado correctamente"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al eliminar usuario: {str(e)}")

@app.patch("/api/superadmin/users/{user_id}/toggle-status")
def superadmin_toggle_user_status(user_id: int, db: Session = Depends(get_db)):
    """
    Activar/Desactivar un usuario
    """
    user = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Alternar estado
    if user.status == "activo":
        user.status = "inactivo"
    else:
        user.status = "activo"
    
    user.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    try:
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
def superadmin_get_stats(db: Session = Depends(get_db)):
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
    first_day_of_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
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

# ==================== ENDPOINTS SUPERADMIN - NUTRICIONISTAS ====================

@app.get("/api/superadmin/nutritionists", response_model=List[NutritionistResponse])
def superadmin_get_nutritionists(
    search: Optional[str] = None,
    db: Session = Depends(get_db)
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
    
    results = []
    for nutritionist in nutritionists:
        # Obtener perfil extendido
        admin_profile = db.query(AdminProfileDB).filter(
            AdminProfileDB.user_id == nutritionist.id
        ).first()
        
        # Contar pacientes asignados
        patients_count = db.query(PatientMealPlanDB).join(
            MealPlanDB
        ).filter(
            PatientMealPlanDB.status == "active"
        ).count()  # Nota: Aquí necesitarías una relación entre admin y planes
        
        # Por ahora usamos un conteo general, pero deberías ajustar según tu modelo
        # Si tienes una tabla que relacione admins con pacientes
        
        results.append({
            "id": nutritionist.id,
            "name": f"{nutritionist.nombres} {nutritionist.apellidos}",
            "email": nutritionist.email,
            "specialty": admin_profile.specialty if admin_profile else None,
            "patients": patients_count,
            "rating": 4.5,  # Mock - implementar sistema de ratings
            "status": nutritionist.status,
            "avatar": get_avatar_url(nutritionist.foto_perfil),
            "joinedAt": nutritionist.created_at.strftime("%Y-%m-%d") if nutritionist.created_at else None,
            "organization": None  # Mock - implementar si tienes organizaciones
        })
    
    return results

@app.get("/api/superadmin/nutritionists/{nutritionist_id}")
def superadmin_get_nutritionist_details(nutritionist_id: int, db: Session = Depends(get_db)):
    """
    Obtener detalles completos de un nutricionista
    """
    nutritionist = db.query(UserDB).filter(
        UserDB.id == nutritionist_id,
        UserDB.role == "admin"
    ).first()
    
    if not nutritionist:
        raise HTTPException(status_code=404, detail="Nutricionista no encontrado")
    
    # Obtener perfil extendido
    admin_profile = db.query(AdminProfileDB).filter(
        AdminProfileDB.user_id == nutritionist_id
    ).first()
    
    # Contar pacientes activos
    active_patients = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.status == "active"
    ).count()
    
    return {
        "id": nutritionist.id,
        "name": f"{nutritionist.nombres} {nutritionist.apellidos}",
        "email": nutritionist.email,
        "phone": nutritionist.telefono,
        "specialty": admin_profile.specialty if admin_profile else None,
        "license": admin_profile.license if admin_profile else None,
        "bio": admin_profile.bio if admin_profile else None,
        "patients": active_patients,
        "rating": 4.5,
        "status": nutritionist.status,
        "avatar": get_avatar_url(nutritionist.foto_perfil),
        "joinedAt": nutritionist.created_at.strftime("%Y-%m-%d") if nutritionist.created_at else None
    }

@app.post("/api/superadmin/nutritionists/invite")
def superadmin_invite_nutritionist(
    invite_data: dict,
    db: Session = Depends(get_db)
):
    """
    Invitar a un nuevo nutricionista al sistema
    """
    email = invite_data.get("email")
    name = invite_data.get("name")
    specialty = invite_data.get("specialty")
    
    if not email or not name:
        raise HTTPException(status_code=400, detail="Email y nombre son requeridos")
    
    # Verificar si el email ya existe
    existing = db.query(UserDB).filter(UserDB.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    # Separar nombre
    name_parts = name.split(" ", 1)
    nombres = name_parts[0]
    apellidos = name_parts[1] if len(name_parts) > 1 else ""
    
    # Generar contraseña temporal
    temp_password = "Nutri123!"
    hashed_pwd = pwd_context.hash(temp_password)
    
    # Crear usuario admin
    new_admin = UserDB(
        nombres=nombres,
        apellidos=apellidos,
        email=email,
        password=hashed_pwd,
        role="admin",
        status="pendiente",
        created_at=datetime.now()
    )
    
    db.add(new_admin)
    db.flush()
    
    # Crear perfil extendido
    if specialty:
        admin_profile = AdminProfileDB(
            user_id=new_admin.id,
            specialty=specialty
        )
        db.add(admin_profile)
    
    try:
        db.commit()
        
        # Aquí deberías enviar un email de invitación
        # send_invitation_email(email, temp_password)
        
        return {
            "success": True,
            "message": f"Invitación enviada a {email}",
            "temp_password": temp_password  # En producción, no retornar esto
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al crear invitación: {str(e)}")

@app.delete("/api/superadmin/nutritionists/{nutritionist_id}")
def superadmin_delete_nutritionist(nutritionist_id: int, db: Session = Depends(get_db)):
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
    has_active_patients = db.query(PatientMealPlanDB).filter(
        PatientMealPlanDB.status == "active"
    ).first()
    
    if has_active_patients:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar. El nutricionista tiene pacientes activos asignados"
        )
    
    try:
        db.delete(nutritionist)
        db.commit()
        return {"success": True, "message": "Nutricionista eliminado correctamente"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al eliminar: {str(e)}")

# ==================== ENDPOINTS SUPERADMIN - DASHBOARD ====================

@app.get("/api/superadmin/dashboard/overview")
def superadmin_get_dashboard_overview(db: Session = Depends(get_db)):
    """
    Obtener resumen general del dashboard de superadmin
    """
    # Usuarios totales
    total_users = db.query(UserDB).count()
    
    # Nutricionistas
    total_nutritionists = db.query(UserDB).filter(UserDB.role == "admin").count()
    new_nutritionists = db.query(UserDB).filter(
        UserDB.role == "admin",
        UserDB.created_at >= datetime.now().replace(day=1)
    ).count()
    
    # Organizaciones (mock)
    total_organizations = 42
    new_organizations = 3
    
    # Ingresos (mock - implementar cuando tengas sistema de pagos)
    monthly_revenue = 16800
    revenue_growth = 27
    
    # Datos de gráficos
    # Crecimiento de usuarios por mes (últimos 6 meses)
    user_growth = []
    for i in range(5, -1, -1):
        month_start = datetime.now().replace(day=1) - timedelta(days=30*i)
        month_users = db.query(UserDB).filter(
            UserDB.created_at >= month_start,
            UserDB.created_at < month_start + timedelta(days=30)
        ).count()
        
        month_name = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][month_start.month - 1]
        user_growth.append({
            "name": month_name,
            "usuarios": month_users * 20,  # Multiplicador para datos mock
            "ingresos": month_users * 100
        })
    
    # Actividad reciente
    recent_activity = []
    
    # Nuevos registros
    recent_users = db.query(UserDB).order_by(UserDB.created_at.desc()).limit(3).all()
    for user in recent_users:
        activity_type = "user" if user.role == "patient" else "user"
        action = "Nuevo nutricionista registrado" if user.role == "admin" else "Nuevo usuario registrado"
        
        recent_activity.append({
            "id": user.id,
            "action": action,
            "user": f"{user.nombres} {user.apellidos}",
            "time": "Hace pocos minutos",
            "type": activity_type
        })
    
    return {
        "stats": {
            "total_users": {
                "value": total_users,
                "change": "+12.5%",
                "trend": "up"
            },
            "nutritionists": {
                "value": total_nutritionists,
                "change": f"+{new_nutritionists} nuevos",
                "trend": "up"
            },
            "organizations": {
                "value": total_organizations,
                "change": f"+{new_organizations} este mes",
                "trend": "up"
            },
            "revenue": {
                "value": monthly_revenue,
                "change": f"+{revenue_growth}% vs mes anterior",
                "trend": "up"
            }
        },
        "charts": {
            "user_growth": user_growth
        },
        "recent_activity": recent_activity[:5]
    }

@app.get("/api/superadmin/dashboard/activity")
def superadmin_get_activity_feed(limit: int = 10, db: Session = Depends(get_db)):
    """
    Obtener feed de actividad del sistema
    """
    activities = []
    
    # Nuevos usuarios
    recent_users = db.query(UserDB).order_by(UserDB.created_at.desc()).limit(5).all()
    for user in recent_users:
        if user.role == "admin":
            activities.append({
                "id": f"user_{user.id}",
                "action": "Nuevo nutricionista registrado",
                "user": f"{user.nombres} {user.apellidos}",
                "time": "Hace 5 min",
                "type": "user"
            })
        elif user.role == "patient":
            activities.append({
                "id": f"user_{user.id}",
                "action": "Nuevo paciente registrado",
                "user": f"{user.nombres} {user.apellidos}",
                "time": "Hace 15 min",
                "type": "user"
            })
    
    # Planes activados
    recent_plans = db.query(PatientMealPlanDB).order_by(
        PatientMealPlanDB.assigned_date.desc()
    ).limit(3).all()
    
    for plan_assignment in recent_plans:
        patient = db.query(UserDB).filter(UserDB.id == plan_assignment.patient_id).first()
        if patient:
            activities.append({
                "id": f"plan_{plan_assignment.id}",
                "action": "Plan nutricional activado",
                "user": f"{patient.nombres} {patient.apellidos}",
                "time": "Hace 30 min",
                "type": "billing"
            })
    
    return activities[:limit]

# ==================== ENDPOINTS ADICIONALES ====================

@app.get("/api/superadmin/users/export")
def superadmin_export_users(db: Session = Depends(get_db)):
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
    db: Session = Depends(get_db)
):
    """
    Realizar acciones en lote sobre usuarios
    """
    action = action_data.get("action")  # activate, deactivate, delete
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
            
        elif action == "deactivate":
            db.query(UserDB).filter(UserDB.id.in_(user_ids)).update(
                {"status": "inactivo"},
                synchronize_session=False
            )
            affected = len(user_ids)
            
        elif action == "delete":
            # No permitir eliminar superadmins
            db.query(UserDB).filter(
                UserDB.id.in_(user_ids),
                UserDB.role != "superadmin"
            ).delete(synchronize_session=False)
            affected = len(user_ids)
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Acción '{action}' aplicada a {affected} usuarios",
            "affected": affected
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error en acción en lote: {str(e)}")
        

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
    
    if current_user.role in ["admin", "superadmin"]:
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
                "patientAvatar": get_avatar_url(p.foto_perfil),
                "lastMessage": last_msg.content if last_msg else "Iniciar conversación",
                "lastMessageTime": last_msg.timestamp.strftime("%Y-%m-%dT%H:%M:%S") if last_msg else "",
                "unreadCount": unread,
                "isOnline": False
            })
            
    else: 
        admins = db.query(UserDB).filter(UserDB.role.in_(['admin', 'superadmin'])).all()
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
                "patientAvatar": get_avatar_url(admin.foto_perfil),
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
def create_support_ticket(patient_id: int, category: str, subject: str, message: str, priority: str = "normal", db: Session = Depends(get_db)):
    patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    new_ticket = SupportTicketDB(patient_id=patient_id, category=category, subject=subject, message=message, priority=priority, status="open")
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)
    return {"success": True, "message": "Ticket creado exitosamente", "ticket_id": new_ticket.id}

@app.get("/api/patient/{patient_id}/support/tickets")
def get_patient_tickets(patient_id: int, db: Session = Depends(get_db)):
    tickets = db.query(SupportTicketDB).filter(SupportTicketDB.patient_id == patient_id).order_by(SupportTicketDB.created_at.desc()).all()
    return [{"id": t.id, "category": t.category, "subject": t.subject, "message": t.message, "status": t.status, "priority": t.priority, "admin_response": t.admin_response, "created_at": t.created_at, "updated_at": t.updated_at, "resolved_at": t.resolved_at} for t in tickets]

@app.get("/api/support/tickets")
def get_all_tickets(status: str = None, category: str = None, priority: str = None, db: Session = Depends(get_db)):
    query = db.query(SupportTicketDB)
    if status:
        query = query.filter(SupportTicketDB.status == status)
    if category:
        query = query.filter(SupportTicketDB.category == category)
    if priority:
        query = query.filter(SupportTicketDB.priority == priority)
    tickets = query.order_by(SupportTicketDB.created_at.desc()).all()
    result = []
    for t in tickets:
        patient = db.query(UserDB).filter(UserDB.id == t.patient_id).first()
        result.append({"id": t.id, "patient_id": t.patient_id, "patient_name": f"{patient.nombres} {patient.apellidos}" if patient else "Desconocido", "patient_email": patient.email if patient else "", "category": t.category, "subject": t.subject, "message": t.message, "status": t.status, "priority": t.priority, "admin_response": t.admin_response, "created_at": t.created_at, "updated_at": t.updated_at, "resolved_at": t.resolved_at})
    return result

@app.put("/api/support/ticket/{ticket_id}")
def update_support_ticket(ticket_id: int, status: str = None, admin_response: str = None, admin_id: int = None, priority: str = None, db: Session = Depends(get_db)):
    ticket = db.query(SupportTicketDB).filter(SupportTicketDB.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    if status:
        ticket.status = status
        if status in ["resolved", "closed"]:
            ticket.resolved_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if admin_response:
        ticket.admin_response = admin_response
    if admin_id:
        ticket.admin_id = admin_id
    if priority:
        ticket.priority = priority
    ticket.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
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
    faq.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    db.commit()
    return {"success": True, "message": "FAQ actualizada exitosamente"}

@app.delete("/api/support/faq/{faq_id}")
def delete_faq(faq_id: int, db: Session = Depends(get_db)):
    faq = db.query(FAQDB).filter(FAQDB.id == faq_id).first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ no encontrada")
    faq.is_active = False
    faq.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    db.commit()
    return {"success": True, "message": "FAQ eliminada exitosamente"}

if os.path.exists("dist"):
    # 1. Montamos los assets generados por Vite (JS, CSS, Imágenes)
    app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")

    # 2. Ruta raíz para servir el index.html
    @app.get("/")
    async def serve_spa_root():
        return FileResponse("dist/index.html")

    # 3. Ruta "catch-all" para manejar el enrutamiento de React (SPA)
    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        # Si la ruta intenta acceder a la API pero no existe, devolvemos 404 real
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Endpoint API no encontrado")
        
        # Verificamos si es un archivo físico (como robots.txt o un favicon)
        static_file_path = os.path.join("dist", full_path)
        if os.path.isfile(static_file_path):
            return FileResponse(static_file_path)
        
        # Para cualquier otra ruta (como /dashboard), devolvemos el index.html 
        # para que React Router tome el control.
        return FileResponse("dist/index.html")

# Bloque de arranque para producción (Cloud Run, Render, etc.)

if __name__ == "__main__":
    import uvicorn
    # Importante: toma el puerto de la variable de entorno o usa 8000 por defecto
    port = int(os.environ.get("PORT", 8000))
    print(f"Iniciando servidor en el puerto: {port}")
    uvicorn.run("main:app", host="0.0.0.0", port=port)