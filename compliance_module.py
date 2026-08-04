"""
Compliance y privacidad Colombia — Ley 1581 / Habeas Data.
Consentimientos, exportación, derecho al olvido, accesos clínicos, políticas legales, brechas.
"""
from __future__ import annotations

import copy
import csv
import io
import json
import secrets
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional, TYPE_CHECKING

from fastapi import Depends, HTTPException, Query, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import Column, ForeignKey, Integer, String, Text, JSON, func, or_
from sqlalchemy.orm import Session

if TYPE_CHECKING:
    from sqlalchemy.orm import DeclarativeBase

PrivacyConsentDB = None
LegalDocumentDB = None
ClinicalAccessLogDB = None
DataDeletionRequestDB = None
SecurityBreachReportDB = None

CONSENT_TYPES = {
    "habeas_data": "Autorización tratamiento datos personales (Ley 1581)",
    "health_sensitive": "Datos sensibles de salud",
    "marketing": "Comunicaciones comerciales",
    "cookies_analytics": "Cookies analíticas",
    "cookies_essential": "Cookies esenciales",
}

LEGAL_DOC_TYPES = {
    "terms": "Términos y condiciones",
    "privacy_policy": "Política de privacidad",
    "cookies_policy": "Política de cookies",
}

DEFAULT_LEGAL_DOCS = [
    {
        "doc_type": "privacy_policy",
        "version": "1.0",
        "title": "Política de privacidad NutriData — Ley 1581",
        "content_md": """# Política de privacidad

NutriData actúa como **Responsable del tratamiento** de datos personales conforme a la **Ley 1581 de 2012** y el Decreto 1377 de 2013 (Habeas Data Colombia).

## Datos que tratamos
- Identificación y contacto (nombre, documento, email, teléfono)
- Datos de salud y nutrición (planes, adherencia, bioquímicos, MIPRESS)
- Datos de uso de la plataforma

## Finalidades
- Prestación del servicio de acompañamiento nutricional
- Cumplimiento de obligaciones legales en salud (RIPS/MIPRESS cuando aplique)
- Mejora del servicio y comunicaciones autorizadas

## Derechos del titular
Acceso, rectificación, actualización, supresión y revocación del consentimiento.

Contacto: soporte@nutridata.com
""",
    },
    {
        "doc_type": "terms",
        "version": "1.0",
        "title": "Términos y condiciones de uso",
        "content_md": """# Términos y condiciones

Al usar NutriData usted acepta estos términos. El servicio es proporcionado por profesionales de nutrición y organizaciones de salud aliadas.

- Usted es responsable de la veracidad de la información suministrada.
- La plataforma no reemplaza consulta médica de urgencias.
- El uso indebido puede resultar en suspensión de cuenta.
""",
    },
    {
        "doc_type": "cookies_policy",
        "version": "1.0",
        "title": "Política de cookies",
        "content_md": """# Política de cookies

Utilizamos cookies esenciales para sesión y autenticación. Con su consentimiento, cookies analíticas para mejorar la experiencia.

Puede gestionar preferencias desde configuración o revocar consentimiento contactando soporte.
""",
    },
]

DELETION_STATUSES = ("pending", "approved", "rejected", "completed", "cancelled")
BREACH_STATUSES = ("open", "investigating", "contained", "closed", "reported_authority")
BREACH_SEVERITIES = ("low", "medium", "high", "critical")


class ConsentCreateSchema(BaseModel):
    user_id: int
    consent_type: str
    granted: bool = True
    policy_version: Optional[str] = "1.0"
    notes: Optional[str] = None


class ConsentRevokeSchema(BaseModel):
    consent_id: int
    reason: Optional[str] = None


class DeletionRequestCreateSchema(BaseModel):
    user_id: int
    reason: Optional[str] = None
    notes: Optional[str] = None


class DeletionProcessSchema(BaseModel):
    action: str = Field(description="approve | reject | complete")
    notes: Optional[str] = None


class LegalDocumentCreateSchema(BaseModel):
    doc_type: str
    version: str
    title: str
    content_md: str
    effective_at: Optional[str] = None


class BreachCreateSchema(BaseModel):
    title: str
    description: str
    severity: str = "medium"
    affected_users_count: int = 0
    discovered_at: Optional[str] = None
    mitigation: Optional[str] = None


class BreachUpdateSchema(BaseModel):
    status: Optional[str] = None
    mitigation: Optional[str] = None
    notified_authorities: Optional[bool] = None
    notified_users: Optional[bool] = None
    affected_users_count: Optional[int] = None


class RetentionSettingsSchema(BaseModel):
    audit_retention_days: int = Field(ge=30, le=3650)
    personal_data_retention_days: int = Field(ge=30, le=3650)


def register_compliance_models(Base):
    global PrivacyConsentDB, LegalDocumentDB, ClinicalAccessLogDB
    global DataDeletionRequestDB, SecurityBreachReportDB

    class _PrivacyConsentDB(Base):
        __tablename__ = "privacy_consents"
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
        consent_type = Column(String(60), nullable=False, index=True)
        granted = Column(Integer, default=1)
        policy_version = Column(String(20), default="1.0")
        ip_address = Column(String(64), nullable=True)
        user_agent = Column(String(300), nullable=True)
        notes = Column(Text, nullable=True)
        created_at = Column(String(50), nullable=True)
        revoked_at = Column(String(50), nullable=True)

    class _LegalDocumentDB(Base):
        __tablename__ = "legal_documents"
        id = Column(Integer, primary_key=True, index=True)
        doc_type = Column(String(40), nullable=False, index=True)
        version = Column(String(20), nullable=False)
        title = Column(String(300), nullable=False)
        content_md = Column(Text, nullable=False)
        is_current = Column(Integer, default=0)
        effective_at = Column(String(50), nullable=True)
        published_at = Column(String(50), nullable=True)
        created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
        created_at = Column(String(50), nullable=True)

    class _ClinicalAccessLogDB(Base):
        __tablename__ = "clinical_access_logs"
        id = Column(Integer, primary_key=True, index=True)
        actor_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
        actor_name = Column(String(200), nullable=True)
        actor_role = Column(String(50), nullable=True)
        patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
        resource_type = Column(String(80), nullable=False, index=True)
        action = Column(String(80), nullable=False)
        endpoint = Column(String(300), nullable=True)
        ip_address = Column(String(64), nullable=True)
        created_at = Column(String(50), nullable=True, index=True)

    class _DataDeletionRequestDB(Base):
        __tablename__ = "data_deletion_requests"
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
        requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
        status = Column(String(20), default="pending", index=True)
        reason = Column(Text, nullable=True)
        notes = Column(Text, nullable=True)
        scheduled_at = Column(String(50), nullable=True)
        completed_at = Column(String(50), nullable=True)
        created_at = Column(String(50), nullable=True)

    class _SecurityBreachReportDB(Base):
        __tablename__ = "security_breach_reports"
        id = Column(Integer, primary_key=True, index=True)
        title = Column(String(300), nullable=False)
        description = Column(Text, nullable=False)
        severity = Column(String(20), default="medium", index=True)
        status = Column(String(30), default="open", index=True)
        affected_users_count = Column(Integer, default=0)
        discovered_at = Column(String(50), nullable=True)
        reported_at = Column(String(50), nullable=True)
        mitigation = Column(Text, nullable=True)
        notified_authorities = Column(Integer, default=0)
        notified_users = Column(Integer, default=0)
        reported_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
        created_at = Column(String(50), nullable=True)
        updated_at = Column(String(50), nullable=True)

    PrivacyConsentDB = _PrivacyConsentDB
    LegalDocumentDB = _LegalDocumentDB
    ClinicalAccessLogDB = _ClinicalAccessLogDB
    DataDeletionRequestDB = _DataDeletionRequestDB
    SecurityBreachReportDB = _SecurityBreachReportDB
    return (
        PrivacyConsentDB,
        LegalDocumentDB,
        ClinicalAccessLogDB,
        DataDeletionRequestDB,
        SecurityBreachReportDB,
    )


def migrate_compliance_schema(engine, inspect_fn, text_fn, LegalDocumentModel):
    try:
        inspector = inspect_fn(engine)
        tables = inspector.get_table_names()
        for model in (
            PrivacyConsentDB,
            LegalDocumentDB,
            ClinicalAccessLogDB,
            DataDeletionRequestDB,
            SecurityBreachReportDB,
        ):
            if model is not None and model.__tablename__ not in tables:
                model.__table__.create(bind=engine, checkfirst=True)
        if "system_settings" in tables:
            cols = {c["name"] for c in inspector.get_columns("system_settings")}
            if "personal_data_retention_days" not in cols:
                with engine.begin() as conn:
                    conn.execute(
                        text_fn(
                            "ALTER TABLE system_settings ADD COLUMN personal_data_retention_days INTEGER DEFAULT 365"
                        )
                    )
    except Exception as exc:
        print(f"[MIGRATE] compliance: {exc}")


def _ensure_default_legal_docs(db: Session, now_co: Callable):
    if LegalDocumentDB is None:
        return
    existing = db.query(LegalDocumentDB).count()
    if existing > 0:
        return
    ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
    for doc in DEFAULT_LEGAL_DOCS:
        db.add(
            LegalDocumentDB(
                doc_type=doc["doc_type"],
                version=doc["version"],
                title=doc["title"],
                content_md=doc["content_md"],
                is_current=1,
                effective_at=ts,
                published_at=ts,
                created_at=ts,
            )
        )
    db.commit()


def log_clinical_access(
    db: Session,
    *,
    actor,
    patient_id: int,
    resource_type: str,
    action: str,
    endpoint: Optional[str] = None,
    ip_address: Optional[str] = None,
    now_co: Callable,
):
    if ClinicalAccessLogDB is None or not patient_id:
        return
    name = f"{getattr(actor, 'nombres', '') or ''} {getattr(actor, 'apellidos', '') or ''}".strip()
    db.add(
        ClinicalAccessLogDB(
            actor_id=getattr(actor, "id", None),
            actor_name=name or getattr(actor, "email", None),
            actor_role=getattr(actor, "role", None),
            patient_id=patient_id,
            resource_type=resource_type,
            action=action,
            endpoint=endpoint,
            ip_address=ip_address,
            created_at=now_co().strftime("%Y-%m-%d %H:%M:%S"),
        )
    )


def _serialize_consent(row) -> dict:
    return {
        "id": row.id,
        "user_id": row.user_id,
        "consent_type": row.consent_type,
        "consent_label": CONSENT_TYPES.get(row.consent_type, row.consent_type),
        "granted": bool(row.granted),
        "policy_version": row.policy_version,
        "ip_address": row.ip_address,
        "created_at": row.created_at,
        "revoked_at": row.revoked_at,
        "active": bool(row.granted) and not row.revoked_at,
    }


def _build_personal_data_export(db: Session, user, deps: dict) -> dict:
    """Exportación Ley 1581 — portabilidad de datos personales."""
    uid = user.id
    MealTrackingDB = deps.get("MealTrackingDB")
    NotificationDB = deps.get("NotificationDB")
    PatientMealPlanDB = deps.get("PatientMealPlanDB")
    ProgressMetricDB = deps.get("ProgressMetricDB")

    profile = {
        "id": user.id,
        "nombres": user.nombres,
        "apellidos": user.apellidos,
        "email": user.email,
        "telefono": user.telefono,
        "tipo_documento": getattr(user, "tipo_documento", None),
        "numero_documento": getattr(user, "numero_documento", None),
        "fecha_nacimiento": str(user.fecha_nacimiento) if getattr(user, "fecha_nacimiento", None) else None,
        "genero": getattr(user, "genero", None),
        "direccion": getattr(user, "direccion", None),
        "role": user.role,
        "status": user.status,
        "created_at": user.created_at,
        "programa_eps": getattr(user, "programa_eps", None),
    }

    health = {
        "altura": getattr(user, "altura", None),
        "peso_inicial": getattr(user, "peso_inicial", None),
        "peso_actual": getattr(user, "peso_actual", None),
        "peso_objetivo": getattr(user, "peso_objetivo", None),
        "alergias": getattr(user, "alergias", None),
        "preferencias": getattr(user, "preferencias", None),
        "objetivos_salud": getattr(user, "objetivos_salud", None),
        "condiciones_medicas": getattr(user, "condiciones_medicas", None),
        "examenes_bioquimicos": getattr(user, "examenes_bioquimicos", None),
        "datos_clinicos": getattr(user, "datos_clinicos", None),
    }

    consents = []
    if PrivacyConsentDB is not None:
        consents = [
            _serialize_consent(c)
            for c in db.query(PrivacyConsentDB).filter(PrivacyConsentDB.user_id == uid).all()
        ]

    meal_logs = []
    if MealTrackingDB is not None:
        rows = (
            db.query(MealTrackingDB)
            .filter(MealTrackingDB.patient_id == uid)
            .order_by(MealTrackingDB.id.desc())
            .limit(500)
            .all()
        )
        meal_logs = [
            {
                "date": str(r.date),
                "meal_type": r.meal_type,
                "completed": bool(getattr(r, "completed", 0)),
            }
            for r in rows
        ]

    notifications = []
    if NotificationDB is not None:
        rows = (
            db.query(NotificationDB)
            .filter(NotificationDB.user_id == uid)
            .order_by(NotificationDB.id.desc())
            .limit(200)
            .all()
        )
        notifications = [
            {"type": r.type, "title": r.title, "description": r.description}
            for r in rows
        ]

    plans = []
    if PatientMealPlanDB is not None:
        rows = db.query(PatientMealPlanDB).filter(PatientMealPlanDB.patient_id == uid).all()
        plans = [{"plan_id": r.plan_id, "status": getattr(r, "status", None)} for r in rows]

    progress = []
    if ProgressMetricDB is not None:
        rows = (
            db.query(ProgressMetricDB)
            .filter(ProgressMetricDB.patient_id == uid)
            .order_by(ProgressMetricDB.id.desc())
            .limit(100)
            .all()
        )
        progress = [
            {
                "date": str(getattr(r, "date", "")),
                "weight": getattr(r, "weight", None),
                "notes": getattr(r, "notes", None),
            }
            for r in rows
        ]

    clinical_access = []
    if ClinicalAccessLogDB is not None:
        rows = (
            db.query(ClinicalAccessLogDB)
            .filter(ClinicalAccessLogDB.patient_id == uid)
            .order_by(ClinicalAccessLogDB.id.desc())
            .limit(100)
            .all()
        )
        clinical_access = [
            {
                "actor_name": r.actor_name,
                "resource_type": r.resource_type,
                "action": r.action,
                "created_at": r.created_at,
            }
            for r in rows
        ]

    return {
        "export_version": 1,
        "legal_basis": "Ley 1581 de 2012 — derecho de acceso y portabilidad",
        "exported_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        "profile": profile,
        "health_data": health,
        "consents": consents,
        "meal_tracking": meal_logs,
        "notifications": notifications,
        "meal_plans": plans,
        "progress_metrics": progress,
        "clinical_access_log": clinical_access,
    }


def _anonymize_user(db: Session, user, now_co: Callable) -> dict:
    """Supresión / derecho al olvido — anonimiza PII conservando ID técnico."""
    token = secrets.token_hex(4)
    user.nombres = "Usuario"
    user.apellidos = "Eliminado"
    user.email = f"deleted_{user.id}_{token}@anonymized.nutridata.local"
    user.telefono = None
    user.direccion = None
    user.tipo_documento = None
    user.numero_documento = f"ANON-{user.id}-{token}"
    user.foto_perfil = None
    user.password = secrets.token_hex(32)
    user.status = "inactivo"
    if hasattr(user, "acompanante_nombre"):
        user.acompanante_nombre = None
        user.acompanante_parentesco = None
        user.acompanante_telefono = None
        user.acompanante_email = None
        user.acompanante_documento = None
        user.acompanante_observaciones = None
    if hasattr(user, "examenes_bioquimicos"):
        user.examenes_bioquimicos = {}
    if hasattr(user, "datos_clinicos"):
        user.datos_clinicos = {"anonymized": True}
    if hasattr(user, "alergias"):
        user.alergias = []
    if hasattr(user, "preferencias"):
        user.preferencias = []
    user.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
    return {"user_id": user.id, "anonymized_email": user.email}


DELETION_STATUS_NOTIFY = {
    "approved": (
        "Solicitud de eliminación aprobada",
        "Tu solicitud de eliminación de datos fue aprobada. Procederemos según los plazos legales (Ley 1581).",
    ),
    "rejected": (
        "Solicitud de eliminación rechazada",
        "Tu solicitud de eliminación no pudo procesarse. Revisa tu correo o contacta soporte si necesitas más información.",
    ),
    "completed": (
        "Eliminación completada",
        "Tu solicitud de eliminación fue completada. Tu cuenta ha sido anonimizada conforme a la Ley 1581.",
    ),
}


def _notify_deletion_status_change(
    db: Session,
    user,
    status: str,
    notes: Optional[str] = None,
    NotificationDB=None,
    send_generic_email=None,
):
    """Notifica al paciente in-app (y email opcional) cuando cambia el estado de eliminación."""
    tpl = DELETION_STATUS_NOTIFY.get(status)
    if not tpl or NotificationDB is None:
        return
    title, description = tpl
    if notes and status == "rejected":
        description = f"{description} Motivo: {notes[:200]}"
    db.add(
        NotificationDB(
            user_id=user.id,
            type="deletion_status",
            title=title,
            description=description,
            read=False,
        )
    )
    if send_generic_email and getattr(user, "email", None):
        try:
            send_generic_email(
                user.email,
                f"NutriData — {title}",
                f"Hola {user.nombres or 'paciente'},\n\n{description}\n\n— Equipo NutriData",
            )
        except Exception:
            pass


def register_compliance_routes(app, deps: dict):
    get_db = deps["get_db"]
    require_superadmin = deps["require_superadmin"]
    get_current_user = deps["get_current_user"]
    UserDB = deps["UserDB"]
    SystemSettingsDB = deps.get("SystemSettingsDB")
    AuditLogDB = deps.get("AuditLogDB")
    log_audit = deps.get("log_audit")
    now_co: Callable = deps["now_co"]
    NotificationDB = deps.get("NotificationDB")
    send_generic_email = deps.get("send_generic_email")

    def _user_label(u) -> str:
        return f"{u.nombres or ''} {u.apellidos or ''}".strip() or u.email or f"#{u.id}"

    @app.get("/api/public/legal/current")
    def public_current_legal(
        doc_type: str = Query(...),
        db: Session = Depends(get_db),
    ):
        if doc_type not in LEGAL_DOC_TYPES:
            raise HTTPException(status_code=400, detail="Tipo de documento inválido")
        if LegalDocumentDB is None:
            raise HTTPException(status_code=503, detail="Documentos legales no disponibles")
        row = (
            db.query(LegalDocumentDB)
            .filter(LegalDocumentDB.doc_type == doc_type, LegalDocumentDB.is_current == 1)
            .order_by(LegalDocumentDB.id.desc())
            .first()
        )
        if not row:
            raise HTTPException(status_code=404, detail="Documento no publicado")
        return {
            "docType": row.doc_type,
            "version": row.version,
            "title": row.title,
            "contentMd": row.content_md,
            "effectiveAt": row.effective_at,
            "publishedAt": row.published_at,
        }

    @app.get("/api/patient/consents")
    def patient_list_consents(
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        if current_user.role != "patient":
            raise HTTPException(status_code=403, detail="Solo pacientes")
        if PrivacyConsentDB is None:
            return {"consents": [], "consent_types": CONSENT_TYPES}
        rows = db.query(PrivacyConsentDB).filter(PrivacyConsentDB.user_id == current_user.id).all()
        return {
            "consents": [_serialize_consent(r) for r in rows],
            "consent_types": CONSENT_TYPES,
        }

    @app.post("/api/patient/consents")
    def patient_grant_consent(
        payload: dict,
        request: Request,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        if current_user.role != "patient":
            raise HTTPException(status_code=403, detail="Solo pacientes")
        if PrivacyConsentDB is None:
            raise HTTPException(status_code=503, detail="Módulo de consentimientos no disponible")
        ctype = payload.get("consent_type")
        if ctype not in CONSENT_TYPES:
            raise HTTPException(status_code=400, detail="Tipo de consentimiento inválido")
        granted = bool(payload.get("granted", True))
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        row = PrivacyConsentDB(
            user_id=current_user.id,
            consent_type=ctype,
            granted=1 if granted else 0,
            policy_version=payload.get("policy_version") or "1.0",
            ip_address=request.client.host if request.client else None,
            user_agent=(request.headers.get("user-agent") or "")[:300],
            created_at=ts,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return {"success": True, "consent": _serialize_consent(row)}

    @app.get("/api/patient/data-export")
    def patient_export_own_data(
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        """Portabilidad Ley 1581 — el paciente descarga sus propios datos."""
        if current_user.role != "patient":
            raise HTTPException(status_code=403, detail="Solo pacientes")
        payload = _build_personal_data_export(db, current_user, deps)
        if log_audit:
            log_audit(
                db,
                actor=current_user,
                action="data_export",
                entity_type="user",
                entity_id=current_user.id,
                patient_id=current_user.id,
                summary=f"Auto-exportación datos — {_user_label(current_user)}",
                details={"self_service": True},
                now_co=now_co,
            )
            db.commit()
        return Response(
            content=json.dumps(payload, ensure_ascii=False, indent=2, default=str),
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="mis-datos-nutridata-{current_user.id}.json"'
            },
        )

    @app.post("/api/patient/deletion-request")
    def patient_request_data_deletion(
        payload: dict,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        """Derecho al olvido — solicitud del titular (Ley 1581)."""
        if current_user.role != "patient":
            raise HTTPException(status_code=403, detail="Solo pacientes")
        if DataDeletionRequestDB is None:
            raise HTTPException(status_code=503, detail="Módulo no disponible")
        reason = (payload.get("reason") or "").strip()
        if not reason:
            raise HTTPException(status_code=400, detail="Indica el motivo de la solicitud")
        pending = (
            db.query(DataDeletionRequestDB)
            .filter(
                DataDeletionRequestDB.user_id == current_user.id,
                DataDeletionRequestDB.status.in_(("pending", "approved")),
            )
            .first()
        )
        if pending:
            raise HTTPException(status_code=400, detail="Ya tienes una solicitud activa")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        row = DataDeletionRequestDB(
            user_id=current_user.id,
            requested_by_id=current_user.id,
            status="pending",
            reason=reason,
            notes="Solicitud self-service paciente",
            created_at=ts,
        )
        db.add(row)
        NotificationDB = deps.get("NotificationDB")
        if NotificationDB is not None:
            superadmins = db.query(UserDB).filter(UserDB.role == "superadmin").all()
            for sa in superadmins:
                db.add(
                    NotificationDB(
                        user_id=sa.id,
                        type="deletion_request",
                        title="Nueva solicitud de eliminación",
                        description=f"{_user_label(current_user)} solicitó eliminar sus datos.",
                    )
                )
        if log_audit:
            log_audit(
                db,
                actor=current_user,
                action="deletion_request",
                entity_type="user",
                entity_id=current_user.id,
                patient_id=current_user.id,
                summary=f"Solicitud eliminación self-service — {_user_label(current_user)}",
                details={"reason": reason},
                now_co=now_co,
            )
        db.commit()
        return {"success": True, "request_id": row.id, "status": "pending"}

    @app.get("/api/patient/deletion-request/status")
    def patient_deletion_request_status(
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        """Estado de la solicitud de eliminación del paciente (Ley 1581)."""
        if current_user.role != "patient":
            raise HTTPException(status_code=403, detail="Solo pacientes")
        if DataDeletionRequestDB is None:
            return {"has_request": False, "request": None}
        row = (
            db.query(DataDeletionRequestDB)
            .filter(DataDeletionRequestDB.user_id == current_user.id)
            .order_by(DataDeletionRequestDB.id.desc())
            .first()
        )
        if not row:
            return {"has_request": False, "request": None}
        return {
            "has_request": True,
            "request": {
                "id": row.id,
                "status": row.status,
                "reason": row.reason,
                "created_at": row.created_at,
                "scheduled_at": getattr(row, "scheduled_at", None),
                "completed_at": getattr(row, "completed_at", None),
            },
        }

    @app.get("/api/superadmin/compliance/overview")
    def compliance_overview(
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        _ensure_default_legal_docs(db, now_co)
        since = (now_co() - timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S")

        active_consents = 0
        if PrivacyConsentDB is not None:
            active_consents = (
                db.query(PrivacyConsentDB)
                .filter(PrivacyConsentDB.granted == 1, PrivacyConsentDB.revoked_at.is_(None))
                .count()
            )

        pending_deletions = 0
        if DataDeletionRequestDB is not None:
            pending_deletions = (
                db.query(DataDeletionRequestDB).filter(DataDeletionRequestDB.status == "pending").count()
            )

        clinical_24h = 0
        if ClinicalAccessLogDB is not None:
            clinical_24h = (
                db.query(ClinicalAccessLogDB).filter(ClinicalAccessLogDB.created_at >= since).count()
            )

        open_breaches = 0
        if SecurityBreachReportDB is not None:
            open_breaches = (
                db.query(SecurityBreachReportDB)
                .filter(SecurityBreachReportDB.status.in_(("open", "investigating")))
                .count()
            )

        legal_versions = {}
        if LegalDocumentDB is not None:
            for dt in LEGAL_DOC_TYPES:
                cur = (
                    db.query(LegalDocumentDB)
                    .filter(LegalDocumentDB.doc_type == dt, LegalDocumentDB.is_current == 1)
                    .first()
                )
                if cur:
                    legal_versions[dt] = {"version": cur.version, "published_at": cur.published_at}

        settings = db.query(SystemSettingsDB).first() if SystemSettingsDB else None
        retention = {
            "audit_retention_days": getattr(settings, "audit_retention_days", 180) if settings else 180,
            "personal_data_retention_days": getattr(settings, "personal_data_retention_days", 365)
            if settings
            else 365,
        }

        return {
            "generated_at": now_co().strftime("%Y-%m-%d %H:%M:%S"),
            "framework": "Ley 1581 de 2012 — Habeas Data Colombia",
            "stats": {
                "active_consents": active_consents,
                "pending_deletion_requests": pending_deletions,
                "clinical_accesses_24h": clinical_24h,
                "open_breach_reports": open_breaches,
            },
            "legal_versions": legal_versions,
            "retention": retention,
            "consent_types": CONSENT_TYPES,
            "legal_doc_types": LEGAL_DOC_TYPES,
        }

    @app.get("/api/superadmin/compliance/consents")
    def list_consents(
        user_id: Optional[int] = Query(None),
        consent_type: Optional[str] = Query(None),
        active_only: bool = Query(False),
        limit: int = Query(100, ge=1, le=500),
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if PrivacyConsentDB is None:
            return {"consents": []}
        q = db.query(PrivacyConsentDB)
        if user_id:
            q = q.filter(PrivacyConsentDB.user_id == user_id)
        if consent_type:
            q = q.filter(PrivacyConsentDB.consent_type == consent_type)
        if active_only:
            q = q.filter(PrivacyConsentDB.granted == 1, PrivacyConsentDB.revoked_at.is_(None))
        rows = q.order_by(PrivacyConsentDB.id.desc()).limit(limit).all()
        user_ids = list({r.user_id for r in rows})
        names = {
            u.id: _user_label(u)
            for u in db.query(UserDB).filter(UserDB.id.in_(user_ids)).all()
        } if user_ids else {}
        return {
            "consents": [
                {**_serialize_consent(r), "user_name": names.get(r.user_id, f"#{r.user_id}")}
                for r in rows
            ]
        }

    @app.post("/api/superadmin/compliance/consents")
    def create_consent(
        payload: ConsentCreateSchema,
        request: Request,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if PrivacyConsentDB is None:
            raise HTTPException(status_code=503, detail="Módulo no disponible")
        if payload.consent_type not in CONSENT_TYPES:
            raise HTTPException(status_code=400, detail="Tipo inválido")
        user = db.query(UserDB).filter(UserDB.id == payload.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        row = PrivacyConsentDB(
            user_id=payload.user_id,
            consent_type=payload.consent_type,
            granted=1 if payload.granted else 0,
            policy_version=payload.policy_version or "1.0",
            ip_address=request.client.host if request.client else None,
            notes=payload.notes,
            created_at=ts,
        )
        db.add(row)
        if log_audit:
            log_audit(
                db,
                actor=current_user,
                action="consent_record",
                entity_type="privacy_consent",
                entity_id=payload.user_id,
                patient_id=payload.user_id if user.role == "patient" else None,
                summary=f"Consentimiento {payload.consent_type} registrado",
                details={"consent_type": payload.consent_type, "granted": payload.granted},
                now_co=now_co,
            )
        db.commit()
        db.refresh(row)
        return {"success": True, "consent": _serialize_consent(row)}

    @app.post("/api/superadmin/compliance/consents/revoke")
    def revoke_consent(
        payload: ConsentRevokeSchema,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if PrivacyConsentDB is None:
            raise HTTPException(status_code=503, detail="Módulo no disponible")
        row = db.query(PrivacyConsentDB).filter(PrivacyConsentDB.id == payload.consent_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Consentimiento no encontrado")
        row.granted = 0
        row.revoked_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        if payload.reason:
            row.notes = (row.notes or "") + f"\nRevocado: {payload.reason}"
        db.commit()
        return {"success": True, "consent": _serialize_consent(row)}

    @app.get("/api/superadmin/compliance/consents/export")
    def export_consents_csv(
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if PrivacyConsentDB is None:
            raise HTTPException(status_code=503, detail="Sin datos")
        rows = db.query(PrivacyConsentDB).order_by(PrivacyConsentDB.id.desc()).limit(5000).all()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            ["id", "user_id", "consent_type", "granted", "policy_version", "created_at", "revoked_at", "ip"]
        )
        for r in rows:
            writer.writerow(
                [r.id, r.user_id, r.consent_type, r.granted, r.policy_version, r.created_at, r.revoked_at, r.ip_address]
            )
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=consentimientos-ley1581.csv"},
        )

    @app.get("/api/superadmin/compliance/data-export/{user_id}")
    def export_user_data(
        user_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        user = db.query(UserDB).filter(UserDB.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        payload = _build_personal_data_export(db, user, deps)
        if log_audit:
            log_audit(
                db,
                actor=current_user,
                action="data_export",
                entity_type="user",
                entity_id=user_id,
                patient_id=user_id if user.role == "patient" else None,
                summary=f"Exportación datos personales — {_user_label(user)}",
                details={"export_version": 1},
                now_co=now_co,
            )
            db.commit()
        return Response(
            content=json.dumps(payload, ensure_ascii=False, indent=2, default=str),
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="datos-personales-{user_id}.json"'
            },
        )

    @app.get("/api/superadmin/compliance/deletion-requests")
    def list_deletion_requests(
        status: Optional[str] = Query(None),
        limit: int = Query(50, ge=1, le=200),
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if DataDeletionRequestDB is None:
            return {"requests": []}
        q = db.query(DataDeletionRequestDB)
        if status:
            q = q.filter(DataDeletionRequestDB.status == status)
        rows = q.order_by(DataDeletionRequestDB.id.desc()).limit(limit).all()
        uids = list({r.user_id for r in rows})
        names = {
            u.id: _user_label(u)
            for u in db.query(UserDB).filter(UserDB.id.in_(uids)).all()
        } if uids else {}
        return {
            "requests": [
                {
                    "id": r.id,
                    "user_id": r.user_id,
                    "user_name": names.get(r.user_id, f"#{r.user_id}"),
                    "status": r.status,
                    "reason": r.reason,
                    "notes": r.notes,
                    "created_at": r.created_at,
                    "completed_at": r.completed_at,
                }
                for r in rows
            ]
        }

    @app.post("/api/superadmin/compliance/deletion-requests")
    def create_deletion_request(
        payload: DeletionRequestCreateSchema,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if DataDeletionRequestDB is None:
            raise HTTPException(status_code=503, detail="Módulo no disponible")
        user = db.query(UserDB).filter(UserDB.id == payload.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        pending = (
            db.query(DataDeletionRequestDB)
            .filter(
                DataDeletionRequestDB.user_id == payload.user_id,
                DataDeletionRequestDB.status.in_(("pending", "approved")),
            )
            .first()
        )
        if pending:
            raise HTTPException(status_code=400, detail="Ya existe solicitud activa")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        row = DataDeletionRequestDB(
            user_id=payload.user_id,
            requested_by_id=current_user.id,
            status="pending",
            reason=payload.reason,
            notes=payload.notes,
            created_at=ts,
        )
        db.add(row)
        if log_audit:
            log_audit(
                db,
                actor=current_user,
                action="deletion_request",
                entity_type="user",
                entity_id=payload.user_id,
                patient_id=payload.user_id if user.role == "patient" else None,
                summary=f"Solicitud derecho al olvido — {_user_label(user)}",
                now_co=now_co,
            )
        db.commit()
        db.refresh(row)
        return {"success": True, "request_id": row.id, "status": row.status}

    @app.post("/api/superadmin/compliance/deletion-requests/{request_id}/process")
    def process_deletion_request(
        request_id: int,
        payload: DeletionProcessSchema,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if DataDeletionRequestDB is None:
            raise HTTPException(status_code=503, detail="Módulo no disponible")
        row = db.query(DataDeletionRequestDB).filter(DataDeletionRequestDB.id == request_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")
        user = db.query(UserDB).filter(UserDB.id == row.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        action = payload.action.lower()

        if action == "reject":
            row.status = "rejected"
            row.notes = (row.notes or "") + f"\nRechazado: {payload.notes or ''}"
        elif action == "approve":
            row.status = "approved"
            row.scheduled_at = ts
        elif action == "complete":
            info = _anonymize_user(db, user, now_co)
            row.status = "completed"
            row.completed_at = ts
            if log_audit:
                log_audit(
                    db,
                    actor=current_user,
                    action="account_anonymized",
                    entity_type="user",
                    entity_id=user.id,
                    patient_id=user.id if user.role == "patient" else None,
                    summary="Cuenta anonimizada — derecho al olvido",
                    details=info,
                    now_co=now_co,
                )
        else:
            raise HTTPException(status_code=400, detail="Acción inválida: approve | reject | complete")

        _notify_deletion_status_change(
            db,
            user,
            row.status,
            notes=payload.notes if action == "reject" else None,
            NotificationDB=NotificationDB,
            send_generic_email=send_generic_email,
        )
        db.commit()
        return {"success": True, "status": row.status, "request_id": row.id}

    @app.get("/api/superadmin/compliance/clinical-access-logs")
    def list_clinical_access_logs(
        patient_id: Optional[int] = Query(None),
        actor_id: Optional[int] = Query(None),
        limit: int = Query(100, ge=1, le=500),
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if ClinicalAccessLogDB is None:
            return {"logs": [], "stats": {}}
        q = db.query(ClinicalAccessLogDB)
        if patient_id:
            q = q.filter(ClinicalAccessLogDB.patient_id == patient_id)
        if actor_id:
            q = q.filter(ClinicalAccessLogDB.actor_id == actor_id)
        rows = q.order_by(ClinicalAccessLogDB.id.desc()).limit(limit).all()
        since = (now_co() - timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S")
        stats = {
            "total_24h": db.query(ClinicalAccessLogDB).filter(ClinicalAccessLogDB.created_at >= since).count(),
            "by_resource": {},
        }
        for res, cnt in (
            db.query(ClinicalAccessLogDB.resource_type, func.count(ClinicalAccessLogDB.id))
            .filter(ClinicalAccessLogDB.created_at >= since)
            .group_by(ClinicalAccessLogDB.resource_type)
            .all()
        ):
            stats["by_resource"][res or "unknown"] = cnt
        return {
            "stats": stats,
            "logs": [
                {
                    "id": r.id,
                    "actor_id": r.actor_id,
                    "actor_name": r.actor_name,
                    "actor_role": r.actor_role,
                    "patient_id": r.patient_id,
                    "resource_type": r.resource_type,
                    "action": r.action,
                    "endpoint": r.endpoint,
                    "ip_address": r.ip_address,
                    "created_at": r.created_at,
                }
                for r in rows
            ],
        }

    @app.get("/api/superadmin/compliance/legal-documents")
    def list_legal_documents(
        doc_type: Optional[str] = Query(None),
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        _ensure_default_legal_docs(db, now_co)
        if LegalDocumentDB is None:
            return {"documents": []}
        q = db.query(LegalDocumentDB)
        if doc_type:
            q = q.filter(LegalDocumentDB.doc_type == doc_type)
        rows = q.order_by(LegalDocumentDB.doc_type, LegalDocumentDB.id.desc()).all()
        return {
            "documents": [
                {
                    "id": d.id,
                    "doc_type": d.doc_type,
                    "doc_label": LEGAL_DOC_TYPES.get(d.doc_type, d.doc_type),
                    "version": d.version,
                    "title": d.title,
                    "content_md": d.content_md,
                    "is_current": bool(d.is_current),
                    "effective_at": d.effective_at,
                    "published_at": d.published_at,
                    "created_at": d.created_at,
                }
                for d in rows
            ]
        }

    @app.post("/api/superadmin/compliance/legal-documents")
    def create_legal_document(
        payload: LegalDocumentCreateSchema,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if LegalDocumentDB is None:
            raise HTTPException(status_code=503, detail="Módulo no disponible")
        if payload.doc_type not in LEGAL_DOC_TYPES:
            raise HTTPException(status_code=400, detail="Tipo inválido")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        row = LegalDocumentDB(
            doc_type=payload.doc_type,
            version=payload.version,
            title=payload.title,
            content_md=payload.content_md,
            is_current=0,
            effective_at=payload.effective_at or ts,
            created_by=current_user.id,
            created_at=ts,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return {"success": True, "id": row.id}

    @app.post("/api/superadmin/compliance/legal-documents/{doc_id}/publish")
    def publish_legal_document(
        doc_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if LegalDocumentDB is None:
            raise HTTPException(status_code=503, detail="Módulo no disponible")
        row = db.query(LegalDocumentDB).filter(LegalDocumentDB.id == doc_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Documento no encontrado")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.query(LegalDocumentDB).filter(
            LegalDocumentDB.doc_type == row.doc_type,
            LegalDocumentDB.is_current == 1,
        ).update({"is_current": 0})
        row.is_current = 1
        row.published_at = ts
        if log_audit:
            log_audit(
                db,
                actor=current_user,
                action="publish",
                entity_type="legal_document",
                entity_id=row.id,
                summary=f"Publicada {LEGAL_DOC_TYPES.get(row.doc_type)} v{row.version}",
                now_co=now_co,
            )
        db.commit()
        return {"success": True, "doc_type": row.doc_type, "version": row.version}

    @app.get("/api/superadmin/compliance/breaches")
    def list_breaches(
        status: Optional[str] = Query(None),
        limit: int = Query(50, ge=1, le=200),
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if SecurityBreachReportDB is None:
            return {"breaches": []}
        q = db.query(SecurityBreachReportDB)
        if status:
            q = q.filter(SecurityBreachReportDB.status == status)
        rows = q.order_by(SecurityBreachReportDB.id.desc()).limit(limit).all()
        return {
            "breaches": [
                {
                    "id": b.id,
                    "title": b.title,
                    "description": b.description,
                    "severity": b.severity,
                    "status": b.status,
                    "affected_users_count": b.affected_users_count,
                    "discovered_at": b.discovered_at,
                    "reported_at": b.reported_at,
                    "mitigation": b.mitigation,
                    "notified_authorities": bool(b.notified_authorities),
                    "notified_users": bool(b.notified_users),
                    "created_at": b.created_at,
                }
                for b in rows
            ]
        }

    @app.post("/api/superadmin/compliance/breaches")
    def create_breach_report(
        payload: BreachCreateSchema,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if SecurityBreachReportDB is None:
            raise HTTPException(status_code=503, detail="Módulo no disponible")
        if payload.severity not in BREACH_SEVERITIES:
            raise HTTPException(status_code=400, detail="Severidad inválida")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        row = SecurityBreachReportDB(
            title=payload.title.strip(),
            description=payload.description.strip(),
            severity=payload.severity,
            status="open",
            affected_users_count=payload.affected_users_count,
            discovered_at=payload.discovered_at or ts,
            mitigation=payload.mitigation,
            reported_by_id=current_user.id,
            created_at=ts,
            updated_at=ts,
        )
        db.add(row)
        if log_audit:
            log_audit(
                db,
                actor=current_user,
                action="breach_report",
                entity_type="security_breach",
                entity_id=None,
                summary=f"Reporte brecha: {payload.title[:80]}",
                details={"severity": payload.severity},
                now_co=now_co,
            )
        db.commit()
        db.refresh(row)
        return {"success": True, "id": row.id}

    @app.patch("/api/superadmin/compliance/breaches/{breach_id}")
    def update_breach_report(
        breach_id: int,
        payload: BreachUpdateSchema,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if SecurityBreachReportDB is None:
            raise HTTPException(status_code=503, detail="Módulo no disponible")
        row = db.query(SecurityBreachReportDB).filter(SecurityBreachReportDB.id == breach_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Reporte no encontrado")
        data = payload.model_dump(exclude_unset=True)
        if "status" in data and data["status"] not in BREACH_STATUSES:
            raise HTTPException(status_code=400, detail="Estado inválido")
        for k, v in data.items():
            if k in ("notified_authorities", "notified_users"):
                setattr(row, k, 1 if v else 0)
            else:
                setattr(row, k, v)
        if data.get("status") == "reported_authority" and not row.reported_at:
            row.reported_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        row.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        return {"success": True}

    @app.put("/api/superadmin/compliance/retention")
    def update_retention_settings(
        payload: RetentionSettingsSchema,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if not SystemSettingsDB:
            raise HTTPException(status_code=503, detail="Settings no disponible")
        settings = db.query(SystemSettingsDB).first()
        if not settings:
            raise HTTPException(status_code=404, detail="Configuración no encontrada")
        settings.audit_retention_days = payload.audit_retention_days
        if hasattr(settings, "personal_data_retention_days"):
            settings.personal_data_retention_days = payload.personal_data_retention_days
        settings.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        return {
            "success": True,
            "audit_retention_days": payload.audit_retention_days,
            "personal_data_retention_days": payload.personal_data_retention_days,
        }
