"""
Funcionalidades transversales NutriData:
impersonación auditada, comunicaciones masivas, workflows, API keys partners,
rate limiting por tenant, 2FA superadmin, IP allowlist, reportes programados, release notes.
"""
from __future__ import annotations

import hashlib
import ipaddress
import json
import secrets
import threading
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Callable, Deque, Dict, List, Optional, TYPE_CHECKING

from fastapi import Depends, HTTPException, Header, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, Column, ForeignKey, Integer, JSON, String, Text, func, or_
from sqlalchemy.orm import Session

if TYPE_CHECKING:
    from sqlalchemy.orm import DeclarativeBase

ImpersonationLogDB = None
PartnerApiKeyDB = None
MassCommunicationDB = None
WorkflowRuleDB = None
ScheduledReportDB = None
ReleaseNoteDB = None
SuperadminTotpDB = None
SuperadminIpAllowlistDB = None

_rate_lock = threading.Lock()
_rate_buckets: Dict[str, Deque[float]] = defaultdict(lambda: __import__("collections").deque(maxlen=5000))

DEFAULT_WORKFLOW_RULES = [
    {
        "key": "low_adherence_50",
        "name": "Adherencia baja (<50%)",
        "description": "Notificar nutricionista y crear tarea de seguimiento",
        "trigger_type": "adherence_threshold",
        "config": {"threshold_pct": 50, "period_days": 7},
        "actions": ["notify_nutritionist", "create_follow_up"],
        "is_active": True,
    },
]

DEFAULT_RATE_LIMITS = {
    "default_rpm": 120,
    "upload_rpm": 30,
    "partner_rpm": 60,
    "enabled": True,
}


# ── Schemas ──

class ImpersonateBody(BaseModel):
    reason: str = Field(..., min_length=5, max_length=500)


class MassCommCreateSchema(BaseModel):
    title: str
    subject: str
    body: str
    channel: str = "email"  # email | push | both
    cohort_type: str = "role"  # role | organization | inactive
    cohort_value: str = Field(..., description="patient|admin|org_id|inactive_days")
    dry_run: bool = False


class WorkflowRuleUpdateSchema(BaseModel):
    is_active: Optional[bool] = None
    config: Optional[dict] = None


PARTNER_SCOPES = {
    "aggregates:read": "Métricas agregadas de la organización",
    "organization:read": "Perfil y contrato de la organización",
    "patients:read": "Resumen anonimizado de pacientes",
    "adherence:read": "Adherencia semanal agregada",
    "programs:read": "Programas EPS y módulos habilitados",
}

DEFAULT_PARTNER_SCOPES = ["aggregates:read", "organization:read"]


class ApiKeyCreateSchema(BaseModel):
    name: str
    organization_id: Optional[int] = None
    scopes: List[str] = Field(default_factory=lambda: list(DEFAULT_PARTNER_SCOPES))
    rate_limit_rpm: int = 60
    is_sandbox: bool = False


class RateLimitConfigSchema(BaseModel):
    default_rpm: int = 120
    upload_rpm: int = 30
    partner_rpm: int = 60
    enabled: bool = True


class TotpVerifySchema(BaseModel):
    code: str
    temp_token: Optional[str] = None


class TotpSetupConfirmSchema(BaseModel):
    code: str


class IpAllowlistSchema(BaseModel):
    cidr_or_ip: str
    label: str = ""
    is_active: bool = True


class ScheduledReportSchema(BaseModel):
    name: str
    organization_id: Optional[int] = None
    recipient_emails: List[str]
    report_type: str = "weekly_eps_summary"
    schedule_cron: str = "weekly_monday_8am"
    is_active: bool = True


class ReleaseNoteSchema(BaseModel):
    version: str
    title: str
    body: str
    roles: List[str] = Field(default_factory=lambda: ["all"])
    is_published: bool = True


class ReleaseNoteUpdateSchema(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    roles: Optional[List[str]] = None
    is_published: Optional[bool] = None


def register_crosscutting_models(Base):
    global ImpersonationLogDB, PartnerApiKeyDB, MassCommunicationDB
    global WorkflowRuleDB, ScheduledReportDB, ReleaseNoteDB
    global SuperadminTotpDB, SuperadminIpAllowlistDB

    class _ImpersonationLogDB(Base):
        __tablename__ = "impersonation_logs"
        id = Column(Integer, primary_key=True, index=True)
        impersonator_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
        target_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
        target_role = Column(String(20), nullable=False)
        action = Column(String(20), nullable=False)  # start | end
        reason = Column(Text, nullable=True)
        ip_address = Column(String(64), nullable=True)
        created_at = Column(String(50), nullable=True, index=True)

    class _PartnerApiKeyDB(Base):
        __tablename__ = "partner_api_keys"
        id = Column(Integer, primary_key=True, index=True)
        name = Column(String(200), nullable=False)
        organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
        key_prefix = Column(String(12), nullable=False, index=True)
        key_hash = Column(String(128), nullable=False)
        scopes = Column(JSON, default=list)
        rate_limit_rpm = Column(Integer, default=60)
        is_sandbox = Column(Integer, default=0)
        is_active = Column(Integer, default=1)
        created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
        created_at = Column(String(50), nullable=True)
        last_used_at = Column(String(50), nullable=True)

    class _MassCommunicationDB(Base):
        __tablename__ = "mass_communications"
        id = Column(Integer, primary_key=True, index=True)
        title = Column(String(200), nullable=False)
        subject = Column(String(300), nullable=False)
        body = Column(Text, nullable=False)
        channel = Column(String(20), default="email")
        cohort_type = Column(String(30), nullable=False)
        cohort_value = Column(String(100), nullable=False)
        status = Column(String(20), default="draft")
        recipient_count = Column(Integer, default=0)
        sent_count = Column(Integer, default=0)
        created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
        sent_at = Column(String(50), nullable=True)
        created_at = Column(String(50), nullable=True)

    class _WorkflowRuleDB(Base):
        __tablename__ = "workflow_rules"
        id = Column(Integer, primary_key=True, index=True)
        key = Column(String(60), unique=True, nullable=False)
        name = Column(String(200), nullable=False)
        description = Column(Text, nullable=True)
        trigger_type = Column(String(40), nullable=False)
        config = Column(JSON, default=dict)
        actions = Column(JSON, default=list)
        is_active = Column(Integer, default=1)
        last_run_at = Column(String(50), nullable=True)
        updated_at = Column(String(50), nullable=True)

    class _ScheduledReportDB(Base):
        __tablename__ = "scheduled_reports"
        id = Column(Integer, primary_key=True, index=True)
        name = Column(String(200), nullable=False)
        organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
        recipient_emails = Column(JSON, default=list)
        report_type = Column(String(60), default="weekly_eps_summary")
        schedule_cron = Column(String(60), default="weekly_monday_8am")
        is_active = Column(Integer, default=1)
        last_sent_at = Column(String(50), nullable=True)
        created_at = Column(String(50), nullable=True)

    class _ReleaseNoteDB(Base):
        __tablename__ = "release_notes"
        id = Column(Integer, primary_key=True, index=True)
        version = Column(String(40), nullable=False, index=True)
        title = Column(String(300), nullable=False)
        body = Column(Text, nullable=False)
        roles = Column(JSON, default=lambda: ["all"])
        is_published = Column(Integer, default=1)
        published_at = Column(String(50), nullable=True)
        created_at = Column(String(50), nullable=True)

    class _SuperadminTotpDB(Base):
        __tablename__ = "superadmin_totp"
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
        secret = Column(String(64), nullable=False)
        backup_codes_hash = Column(JSON, default=list)
        is_enabled = Column(Integer, default=0)
        verified_at = Column(String(50), nullable=True)
        created_at = Column(String(50), nullable=True)

    class _SuperadminIpAllowlistDB(Base):
        __tablename__ = "superadmin_ip_allowlist"
        id = Column(Integer, primary_key=True, index=True)
        cidr_or_ip = Column(String(64), nullable=False)
        label = Column(String(200), nullable=True)
        is_active = Column(Integer, default=1)
        created_at = Column(String(50), nullable=True)

    ImpersonationLogDB = _ImpersonationLogDB
    PartnerApiKeyDB = _PartnerApiKeyDB
    MassCommunicationDB = _MassCommunicationDB
    WorkflowRuleDB = _WorkflowRuleDB
    ScheduledReportDB = _ScheduledReportDB
    ReleaseNoteDB = _ReleaseNoteDB
    SuperadminTotpDB = _SuperadminTotpDB
    SuperadminIpAllowlistDB = _SuperadminIpAllowlistDB
    return (
        ImpersonationLogDB,
        PartnerApiKeyDB,
        MassCommunicationDB,
        WorkflowRuleDB,
        ScheduledReportDB,
        ReleaseNoteDB,
        SuperadminTotpDB,
        SuperadminIpAllowlistDB,
    )


def migrate_crosscutting_schema(engine, inspect_fn, text_fn):
    try:
        inspector = inspect_fn(engine)
        tables = inspector.get_table_names()
        for model in (
            ImpersonationLogDB,
            PartnerApiKeyDB,
            MassCommunicationDB,
            WorkflowRuleDB,
            ScheduledReportDB,
            ReleaseNoteDB,
            SuperadminTotpDB,
            SuperadminIpAllowlistDB,
        ):
            if model is not None and model.__tablename__ not in tables:
                model.__table__.create(bind=engine, checkfirst=True)
        if "partner_api_keys" in tables:
            cols = {c["name"] for c in inspector.get_columns("partner_api_keys")}
            if "is_sandbox" not in cols:
                with engine.begin() as conn:
                    conn.execute(text_fn("ALTER TABLE partner_api_keys ADD COLUMN is_sandbox INTEGER DEFAULT 0"))
    except Exception as exc:
        print(f"[MIGRATE] crosscutting: {exc}")


def seed_crosscutting_defaults(db: Session, now_co: Callable):
    ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
    if WorkflowRuleDB is not None and db.query(WorkflowRuleDB).count() == 0:
        for rule in DEFAULT_WORKFLOW_RULES:
            db.add(WorkflowRuleDB(
                key=rule["key"], name=rule["name"], description=rule["description"],
                trigger_type=rule["trigger_type"], config=rule["config"],
                actions=rule["actions"], is_active=1 if rule["is_active"] else 0,
                updated_at=ts,
            ))
    if ReleaseNoteDB is not None and db.query(ReleaseNoteDB).count() == 0:
        db.add(ReleaseNoteDB(
            version="2.0.0",
            title="Plataforma NutriData — módulos transversales",
            body="Nuevo centro de plataforma: impersonación auditada, comunicaciones masivas, workflows de adherencia, API keys para partners, rate limiting, 2FA superadmin, IP allowlist, reportes programados y release notes.",
            roles=["all"],
            is_published=1,
            published_at=ts,
            created_at=ts,
        ))
    db.commit()


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host or "0.0.0.0"
    return "0.0.0.0"


def _ip_allowed(db: Session, ip: str) -> bool:
    if SuperadminIpAllowlistDB is None:
        return True
    rows = db.query(SuperadminIpAllowlistDB).filter(SuperadminIpAllowlistDB.is_active == 1).all()
    if not rows:
        return True
    try:
        addr = ipaddress.ip_address(ip)
    except Exception:
        return False
    for row in rows:
        try:
            if "/" in row.cidr_or_ip:
                if addr in ipaddress.ip_network(row.cidr_or_ip, strict=False):
                    return True
            elif addr == ipaddress.ip_address(row.cidr_or_ip.strip()):
                return True
        except Exception:
            continue
    return False


def check_superadmin_ip(db: Session, request: Request):
    ip = _client_ip(request)
    if not _ip_allowed(db, ip):
        raise HTTPException(status_code=403, detail=f"Acceso superadmin denegado desde IP {ip}")


def _totp_lib():
    try:
        import pyotp
        return pyotp
    except ImportError:
        return None


def superadmin_requires_2fa(db: Session, user_id: int) -> bool:
    if SuperadminTotpDB is None:
        return False
    row = db.query(SuperadminTotpDB).filter(
        SuperadminTotpDB.user_id == user_id,
        SuperadminTotpDB.is_enabled == 1,
    ).first()
    return row is not None


def verify_totp_code(db: Session, user_id: int, code: str) -> bool:
    pyotp = _totp_lib()
    if not pyotp or SuperadminTotpDB is None:
        return True
    row = db.query(SuperadminTotpDB).filter(SuperadminTotpDB.user_id == user_id).first()
    if not row or not row.is_enabled:
        return True
    clean = code.replace(" ", "").strip()
    if len(clean) == 6 and clean.isdigit():
        totp = pyotp.TOTP(row.secret)
        if totp.verify(clean, valid_window=1):
            return True
    # backup codes
    code_hash = hashlib.sha256(clean.encode()).hexdigest()
    backups = row.backup_codes_hash if isinstance(row.backup_codes_hash, list) else []
    if code_hash in backups:
        backups.remove(code_hash)
        row.backup_codes_hash = backups
        db.commit()
        return True
    return False


def _hash_api_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _generate_api_key() -> tuple:
    raw = f"ndp_{secrets.token_urlsafe(32)}"
    prefix = raw[:12]
    return raw, prefix, _hash_api_key(raw)


def _get_rate_config(runtime_config: Optional[dict]) -> dict:
    cfg = dict(DEFAULT_RATE_LIMITS)
    if runtime_config and isinstance(runtime_config.get("rate_limits"), dict):
        cfg.update(runtime_config["rate_limits"])
    return cfg


def check_rate_limit(tenant_key: str, limit_rpm: int) -> bool:
    now = datetime.utcnow().timestamp()
    window_start = now - 60
    with _rate_lock:
        bucket = _rate_buckets[tenant_key]
        while bucket and bucket[0] < window_start:
            bucket.popleft()
        if len(bucket) >= limit_rpm:
            return False
        bucket.append(now)
        return True


def create_rate_limit_middleware(get_db_fn, SystemSettingsDB):
    async def rate_limit_middleware(request: Request, call_next):
        path = request.url.path
        if not path.startswith("/api/"):
            return await call_next(request)
        try:
            db = get_db_fn()
            settings = db.query(SystemSettingsDB).first()
            runtime = getattr(settings, "runtime_config", None) or {}
            cfg = _get_rate_config(runtime if isinstance(runtime, dict) else {})
            db.close()
        except Exception:
            cfg = DEFAULT_RATE_LIMITS
        if not cfg.get("enabled", True):
            return await call_next(request)
        tenant = f"ip:{_client_ip(request)}"
        if "/upload" in path or path.endswith("/photo"):
            limit = cfg.get("upload_rpm", 30)
        elif path.startswith("/api/partner/"):
            limit = cfg.get("partner_rpm", 60)
        else:
            limit = cfg.get("default_rpm", 120)
        if not check_rate_limit(tenant, limit):
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=429, content={"detail": "Rate limit excedido. Intenta en un minuto."})
        return await call_next(request)
    return rate_limit_middleware


def _resolve_cohort(db: Session, UserDB, OrganizationMemberDB, cohort_type: str, cohort_value: str) -> List:
    if cohort_type == "role":
        return db.query(UserDB).filter(UserDB.role == cohort_value, UserDB.status == "activo").all()
    if cohort_type == "organization" and OrganizationMemberDB is not None:
        try:
            org_id = int(cohort_value)
        except Exception:
            return []
        member_ids = [
            m.user_id for m in db.query(OrganizationMemberDB).filter(
                OrganizationMemberDB.organization_id == org_id,
                OrganizationMemberDB.status == "activo",
            ).all()
        ]
        if not member_ids:
            return []
        return db.query(UserDB).filter(UserDB.id.in_(member_ids), UserDB.status == "activo").all()
    if cohort_type == "inactive":
        try:
            days = int(cohort_value)
        except Exception:
            days = 30
        cutoff = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
        return db.query(UserDB).filter(
            UserDB.role == "patient",
            or_(UserDB.updated_at < cutoff, UserDB.updated_at.is_(None)),
        ).all()
    return []


def _send_simple_email(to_email: str, subject: str, body: str, send_email_fn: Callable) -> bool:
    if send_email_fn:
        try:
            return bool(send_email_fn(to_email, subject, body))
        except Exception:
            return False
    return False


def run_adherence_workflow(db: Session, deps: dict) -> dict:
    UserDB = deps["UserDB"]
    MealTrackingDB = deps["MealTrackingDB"]
    FollowUpTaskDB = deps.get("FollowUpTaskDB")
    NotificationDB = deps.get("NotificationDB")
    today_co = deps["today_co"]
    now_co = deps["now_co"]
    calculate_weekly_adherence = deps.get("calculate_weekly_adherence")

    rule = db.query(WorkflowRuleDB).filter(
        WorkflowRuleDB.key == "low_adherence_50",
        WorkflowRuleDB.is_active == 1,
    ).first() if WorkflowRuleDB else None
    if not rule:
        return {"processed": 0, "triggered": 0}

    threshold = (rule.config or {}).get("threshold_pct", 50)
    patients = db.query(UserDB).filter(
        UserDB.role == "patient",
        UserDB.status == "activo",
        UserDB.nutritionist_id.isnot(None),
    ).all()

    triggered = 0
    ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
    today = today_co()
    week_key = today.strftime("%Y-W%W")

    for p in patients:
        adh = calculate_weekly_adherence(p.id, db) if calculate_weekly_adherence else 0
        if adh >= threshold:
            continue
        nutri_id = p.nutritionist_id
        if not nutri_id:
            continue

        existing_task = None
        if FollowUpTaskDB is not None:
            existing_task = db.query(FollowUpTaskDB).filter(
                FollowUpTaskDB.patient_id == p.id,
                FollowUpTaskDB.nutritionist_id == nutri_id,
                FollowUpTaskDB.task_type == "adherence",
                FollowUpTaskDB.status == "pending",
            ).first()
        if not existing_task and FollowUpTaskDB is not None:
            db.add(FollowUpTaskDB(
                nutritionist_id=nutri_id,
                patient_id=p.id,
                task_type="adherence",
                title=f"Adherencia baja — {p.nombres} {p.apellidos}",
                description=f"Adherencia semanal {adh}% (< {threshold}%). Contactar al paciente.",
                due_date=(today + timedelta(days=2)).strftime("%Y-%m-%d"),
                status="pending",
                source=f"workflow:{rule.key}:{week_key}",
                created_at=ts,
            ))
            triggered += 1

        if NotificationDB is not None:
            db.add(NotificationDB(
                user_id=nutri_id,
                type="workflow",
                title="Adherencia baja detectada",
                description=f"{p.nombres} {p.apellidos} tiene adherencia {adh}% esta semana.",
                read=False,
            ))

    if rule:
        rule.last_run_at = ts
    db.commit()
    return {"processed": len(patients), "triggered": triggered, "threshold_pct": threshold}


def verify_partner_api_key(db: Session, raw_key: str) -> Optional[dict]:
    if not raw_key or PartnerApiKeyDB is None:
        return None
    prefix = raw_key[:12] if len(raw_key) >= 12 else raw_key
    row = db.query(PartnerApiKeyDB).filter(
        PartnerApiKeyDB.key_prefix == prefix,
        PartnerApiKeyDB.is_active == 1,
    ).first()
    if not row or row.key_hash != _hash_api_key(raw_key):
        return None
    return {
        "id": row.id,
        "organization_id": row.organization_id,
        "scopes": row.scopes or [],
        "rate_limit_rpm": row.rate_limit_rpm or 60,
        "is_sandbox": bool(getattr(row, "is_sandbox", 0)),
    }


def _require_partner_access(
    db: Session,
    x_api_key: Optional[str],
    required_scope: str,
) -> dict:
    if not x_api_key:
        raise HTTPException(status_code=401, detail="X-API-Key requerida")
    key_info = verify_partner_api_key(db, x_api_key)
    if not key_info:
        raise HTTPException(status_code=401, detail="API key inválida")
    scopes = key_info.get("scopes") or []
    if required_scope not in scopes:
        raise HTTPException(status_code=403, detail=f"Scope insuficiente: se requiere {required_scope}")
    tenant_key = f"partner:{key_info['id']}"
    if not check_rate_limit(tenant_key, key_info.get("rate_limit_rpm", 60)):
        raise HTTPException(status_code=429, detail="Rate limit partner excedido")
    return key_info


def _resolve_partner_org_id(
    db: Session,
    key_info: dict,
    organization_id: Optional[int],
    OrganizationDB,
) -> int:
    org_id = organization_id or key_info.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="organization_id requerido para esta operación")
    bound_org = key_info.get("organization_id")
    if bound_org and int(org_id) != int(bound_org):
        raise HTTPException(status_code=403, detail="API key limitada a otra organización")
    org = db.query(OrganizationDB).filter(OrganizationDB.id == org_id).first() if OrganizationDB else None
    if not org:
        raise HTTPException(status_code=404, detail="Organización no encontrada")
    if key_info.get("is_sandbox") and not bool(getattr(org, "is_sandbox", 0)):
        raise HTTPException(status_code=403, detail="Key sandbox no puede acceder a organización de producción")
    return int(org_id)


def _partner_member_patient_ids(db: Session, org_id: int, OrganizationMemberDB, UserDB) -> list:
    if not OrganizationMemberDB:
        return []
    mids = [
        m.user_id
        for m in db.query(OrganizationMemberDB)
        .filter(OrganizationMemberDB.organization_id == org_id, OrganizationMemberDB.status == "activo")
        .all()
    ]
    if not mids:
        return []
    return [
        u.id
        for u in db.query(UserDB)
        .filter(UserDB.id.in_(mids), UserDB.role == "patient", UserDB.status == "activo")
        .all()
    ]


def _touch_partner_key(db: Session, key_id: int, now_co: Callable):
    row = db.query(PartnerApiKeyDB).filter(PartnerApiKeyDB.id == key_id).first()
    if row:
        row.last_used_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()


def register_crosscutting_routes(app, deps: dict):
    get_db = deps["get_db"]
    require_superadmin = deps["require_superadmin"]
    get_current_user = deps["get_current_user"]
    UserDB = deps["UserDB"]
    OrganizationDB = deps.get("OrganizationDB")
    OrganizationMemberDB = deps.get("OrganizationMemberDB")
    SystemSettingsDB = deps["SystemSettingsDB"]
    FollowUpTaskDB = deps.get("FollowUpTaskDB")
    NotificationDB = deps.get("NotificationDB")
    MealTrackingDB = deps.get("MealTrackingDB")
    log_audit = deps.get("log_audit")
    now_co = deps["now_co"]
    today_co = deps["today_co"]
    SECRET_KEY = deps["SECRET_KEY"]
    ALGORITHM = deps.get("ALGORITHM", "HS256")
    send_generic_email = deps.get("send_generic_email")
    calculate_weekly_adherence = deps.get("calculate_weekly_adherence")
    jwt_encode = deps.get("jwt_encode")
    jwt_decode = deps.get("jwt_decode")

    from fastapi import Request as FastAPIRequest
    from jose import jwt as jose_jwt, JWTError

    def _secure_superadmin(request: FastAPIRequest, db: Session = Depends(get_db), user=Depends(require_superadmin)):
        check_superadmin_ip(db, request)
        return user

    def _create_impersonation_token(target, impersonator, target_role: str):
        payload = {
            "sub": target.email,
            "id": target.id,
            "role": target.role,
            "impersonation": True,
            "impersonator_id": impersonator.id,
            "impersonator_email": impersonator.email,
            "impersonated_role": target_role,
            "exp": datetime.utcnow() + timedelta(hours=2),
        }
        if jwt_encode:
            return jwt_encode(payload)
        return jose_jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    def _log_impersonation(db, impersonator, target, action: str, reason: Optional[str], ip: str):
        if ImpersonationLogDB is None:
            return
        db.add(ImpersonationLogDB(
            impersonator_id=impersonator.id,
            target_user_id=target.id,
            target_role=target.role,
            action=action,
            reason=reason,
            ip_address=ip,
            created_at=now_co().strftime("%Y-%m-%d %H:%M:%S"),
        ))

    @app.get("/api/superadmin/platform/overview")
    def platform_overview(db: Session = Depends(get_db), _=Depends(_secure_superadmin)):
        seed_crosscutting_defaults(db, now_co)
        totp_enabled = db.query(SuperadminTotpDB).filter(SuperadminTotpDB.is_enabled == 1).count() if SuperadminTotpDB else 0
        cutoff = (now_co() - timedelta(days=30)).strftime("%Y-%m-%d %H:%M:%S")
        imp_30d = 0
        if ImpersonationLogDB:
            imp_30d = (
                db.query(ImpersonationLogDB)
                .filter(ImpersonationLogDB.created_at >= cutoff)
                .count()
            )
        return {
            "generated_at": now_co().strftime("%Y-%m-%d %H:%M:%S"),
            "impersonation_logs_30d": imp_30d,
            "api_keys_active": db.query(PartnerApiKeyDB).filter(PartnerApiKeyDB.is_active == 1).count() if PartnerApiKeyDB else 0,
            "campaigns_sent": db.query(MassCommunicationDB).filter(MassCommunicationDB.status == "sent").count() if MassCommunicationDB else 0,
            "workflow_rules_active": db.query(WorkflowRuleDB).filter(WorkflowRuleDB.is_active == 1).count() if WorkflowRuleDB else 0,
            "scheduled_reports": db.query(ScheduledReportDB).filter(ScheduledReportDB.is_active == 1).count() if ScheduledReportDB else 0,
            "release_notes": db.query(ReleaseNoteDB).filter(ReleaseNoteDB.is_published == 1).count() if ReleaseNoteDB else 0,
            "totp_superadmins": totp_enabled,
            "ip_allowlist_entries": db.query(SuperadminIpAllowlistDB).filter(SuperadminIpAllowlistDB.is_active == 1).count() if SuperadminIpAllowlistDB else 0,
        }

    # ── Impersonación ──
    @app.post("/api/superadmin/impersonate/user/{user_id}")
    def impersonate_user(
        user_id: int,
        body: ImpersonateBody,
        request: FastAPIRequest,
        db: Session = Depends(get_db),
        current_user=Depends(_secure_superadmin),
    ):
        target = db.query(UserDB).filter(UserDB.id == user_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        if target.role not in ("admin", "patient"):
            raise HTTPException(status_code=400, detail="Solo nutricionistas o pacientes")
        if target.status != "activo":
            raise HTTPException(status_code=400, detail="Usuario inactivo")
        if target.role == "superadmin":
            raise HTTPException(status_code=403, detail="No se puede impersonar superadmin")

        token = _create_impersonation_token(target, current_user, target.role)
        ip = _client_ip(request)
        _log_impersonation(db, current_user, target, "start", body.reason, ip)
        if log_audit:
            log_audit(
                db,
                actor=current_user,
                action="impersonation_start",
                entity_type=target.role,
                entity_id=target.id,
                summary=f"Impersonación: {target.nombres} {target.apellidos}",
                details={"reason": body.reason, "ip": ip},
                now_co=now_co,
            )
        db.commit()
        redirect = "/admin" if target.role == "admin" else "/patient/dashboard"
        return {
            "success": True,
            "token": token,
            "redirect": redirect,
            "user": {"id": target.id, "name": f"{target.nombres} {target.apellidos}", "email": target.email, "role": target.role, "avatar": target.foto_perfil},
            "impersonator": {"id": current_user.id, "name": f"{current_user.nombres} {current_user.apellidos}"},
        }

    @app.get("/api/superadmin/impersonation/logs")
    def impersonation_logs(limit: int = 50, db: Session = Depends(get_db), _=Depends(_secure_superadmin)):
        if ImpersonationLogDB is None:
            return {"logs": []}
        rows = db.query(ImpersonationLogDB).order_by(ImpersonationLogDB.id.desc()).limit(min(limit, 200)).all()
        logs = []
        for r in rows:
            imp = db.query(UserDB).filter(UserDB.id == r.impersonator_id).first()
            tgt = db.query(UserDB).filter(UserDB.id == r.target_user_id).first()
            logs.append({
                "id": r.id, "action": r.action, "reason": r.reason, "ip_address": r.ip_address,
                "created_at": r.created_at,
                "impersonator": f"{imp.nombres} {imp.apellidos}" if imp else str(r.impersonator_id),
                "target": f"{tgt.nombres} {tgt.apellidos}" if tgt else str(r.target_user_id),
                "target_role": r.target_role,
            })
        return {"logs": logs}

    # ── Comunicaciones masivas ──
    @app.get("/api/superadmin/platform/communications")
    def list_communications(db: Session = Depends(get_db), _=Depends(_secure_superadmin)):
        rows = db.query(MassCommunicationDB).order_by(MassCommunicationDB.id.desc()).limit(50).all()
        return [{"id": r.id, "title": r.title, "channel": r.channel, "cohort_type": r.cohort_type,
                 "cohort_value": r.cohort_value, "status": r.status, "recipient_count": r.recipient_count,
                 "sent_count": r.sent_count, "created_at": r.created_at, "sent_at": r.sent_at} for r in rows]

    @app.post("/api/superadmin/platform/communications")
    def create_communication(
        body: MassCommCreateSchema,
        db: Session = Depends(get_db),
        current_user=Depends(_secure_superadmin),
    ):
        recipients = _resolve_cohort(db, UserDB, OrganizationMemberDB, body.cohort_type, body.cohort_value)
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        if body.dry_run:
            return {"dry_run": True, "recipient_count": len(recipients), "sample_emails": [u.email for u in recipients[:5]]}

        row = MassCommunicationDB(
            title=body.title, subject=body.subject, body=body.body, channel=body.channel,
            cohort_type=body.cohort_type, cohort_value=body.cohort_value,
            status="sending", recipient_count=len(recipients), sent_count=0,
            created_by=current_user.id, created_at=ts,
        )
        db.add(row)
        db.flush()

        sent = 0
        for u in recipients:
            ok = False
            if body.channel in ("email", "both") and u.email:
                ok = _send_simple_email(u.email, body.subject, body.body.replace("{nombre}", u.nombres or ""), send_generic_email)
            if body.channel in ("push", "both") and NotificationDB is not None:
                db.add(NotificationDB(user_id=u.id, type="broadcast", title=body.subject, description=body.body[:500], read=False))
                ok = True
            if ok:
                sent += 1

        row.status = "sent"
        row.sent_count = sent
        row.sent_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        return {"success": True, "id": row.id, "sent_count": sent, "recipient_count": len(recipients)}

    # ── Workflows ──
    @app.get("/api/superadmin/platform/workflows")
    def list_workflows(db: Session = Depends(get_db), _=Depends(_secure_superadmin)):
        seed_crosscutting_defaults(db, now_co)
        rows = db.query(WorkflowRuleDB).order_by(WorkflowRuleDB.id).all()
        return [{"id": r.id, "key": r.key, "name": r.name, "description": r.description,
                 "trigger_type": r.trigger_type, "config": r.config, "actions": r.actions,
                 "is_active": bool(r.is_active), "last_run_at": r.last_run_at} for r in rows]

    @app.put("/api/superadmin/platform/workflows/{rule_id}")
    def update_workflow(rule_id: int, body: WorkflowRuleUpdateSchema, db: Session = Depends(get_db), _=Depends(_secure_superadmin)):
        row = db.query(WorkflowRuleDB).filter(WorkflowRuleDB.id == rule_id).first()
        if not row:
            raise HTTPException(status_code=404)
        if body.is_active is not None:
            row.is_active = 1 if body.is_active else 0
        if body.config is not None:
            row.config = body.config
        row.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        return {"success": True}

    @app.post("/api/superadmin/platform/workflows/run")
    def run_workflows(db: Session = Depends(get_db), _=Depends(_secure_superadmin)):
        result = run_adherence_workflow(db, {**deps, "FollowUpTaskDB": FollowUpTaskDB, "NotificationDB": NotificationDB, "calculate_weekly_adherence": calculate_weekly_adherence})
        return {"success": True, **result}

    # ── API Keys partners ──
    @app.get("/api/superadmin/platform/api-keys")
    def list_api_keys(db: Session = Depends(get_db), _=Depends(_secure_superadmin)):
        rows = db.query(PartnerApiKeyDB).order_by(PartnerApiKeyDB.id.desc()).all()
        org_map = {}
        if OrganizationDB:
            for o in db.query(OrganizationDB).all():
                org_map[o.id] = o.name
        return [{"id": r.id, "name": r.name, "key_prefix": r.key_prefix, "organization_id": r.organization_id,
                 "organization_name": org_map.get(r.organization_id), "scopes": r.scopes,
                 "rate_limit_rpm": r.rate_limit_rpm, "is_active": bool(r.is_active),
                 "is_sandbox": bool(getattr(r, "is_sandbox", 0)),
                 "last_used_at": r.last_used_at, "created_at": r.created_at} for r in rows]

    @app.get("/api/superadmin/platform/partner-scopes")
    def list_partner_scopes(_=Depends(_secure_superadmin)):
        return {"scopes": PARTNER_SCOPES, "defaults": DEFAULT_PARTNER_SCOPES}

    @app.post("/api/superadmin/platform/api-keys")
    def create_api_key(body: ApiKeyCreateSchema, db: Session = Depends(get_db), current_user=Depends(_secure_superadmin)):
        if body.organization_id and OrganizationDB:
            org = db.query(OrganizationDB).filter(OrganizationDB.id == body.organization_id).first()
            if not org:
                raise HTTPException(status_code=404, detail="Organización no encontrada")
        invalid_scopes = [s for s in (body.scopes or []) if s not in PARTNER_SCOPES]
        if invalid_scopes:
            raise HTTPException(status_code=400, detail=f"Scopes inválidos: {', '.join(invalid_scopes)}")
        raw, prefix, key_hash = _generate_api_key()
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        row = PartnerApiKeyDB(
            name=body.name.strip(), organization_id=body.organization_id,
            key_prefix=prefix, key_hash=key_hash, scopes=body.scopes or DEFAULT_PARTNER_SCOPES,
            rate_limit_rpm=body.rate_limit_rpm, is_sandbox=1 if body.is_sandbox else 0,
            is_active=1,
            created_by=current_user.id, created_at=ts,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return {"success": True, "id": row.id, "api_key": raw, "message": "Guarda la clave ahora; no se volverá a mostrar."}

    @app.delete("/api/superadmin/platform/api-keys/{key_id}")
    def revoke_api_key(key_id: int, db: Session = Depends(get_db), _=Depends(_secure_superadmin)):
        row = db.query(PartnerApiKeyDB).filter(PartnerApiKeyDB.id == key_id).first()
        if row:
            row.is_active = 0
            db.commit()
        return {"success": True}

    # ── Rate limits ──
    @app.get("/api/superadmin/platform/rate-limits")
    def get_rate_limits(db: Session = Depends(get_db), _=Depends(_secure_superadmin)):
        settings = db.query(SystemSettingsDB).first()
        runtime = getattr(settings, "runtime_config", None) or {}
        return _get_rate_config(runtime if isinstance(runtime, dict) else {})

    @app.put("/api/superadmin/platform/rate-limits")
    def update_rate_limits(body: RateLimitConfigSchema, db: Session = Depends(get_db), _=Depends(_secure_superadmin)):
        settings = db.query(SystemSettingsDB).first()
        if not settings:
            raise HTTPException(status_code=500, detail="Sin configuración")
        runtime = dict(settings.runtime_config or {})
        runtime["rate_limits"] = body.model_dump()
        settings.runtime_config = runtime
        settings.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        return {"success": True, "rate_limits": body.model_dump()}

    # ── 2FA TOTP ──
    @app.get("/api/superadmin/platform/2fa/status")
    def totp_status(db: Session = Depends(get_db), current_user=Depends(require_superadmin)):
        row = db.query(SuperadminTotpDB).filter(SuperadminTotpDB.user_id == current_user.id).first() if SuperadminTotpDB else None
        return {"enabled": bool(row and row.is_enabled), "verified_at": getattr(row, "verified_at", None)}

    @app.post("/api/superadmin/platform/2fa/setup")
    def totp_setup(db: Session = Depends(get_db), current_user=Depends(require_superadmin)):
        pyotp = _totp_lib()
        if not pyotp:
            raise HTTPException(status_code=503, detail="Instala pyotp: pip install pyotp")
        secret = pyotp.random_base32()
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        backups = [hashlib.sha256(secrets.token_hex(4).encode()).hexdigest() for _ in range(8)]
        row = db.query(SuperadminTotpDB).filter(SuperadminTotpDB.user_id == current_user.id).first()
        if row:
            row.secret = secret
            row.backup_codes_hash = backups
            row.is_enabled = 0
        else:
            db.add(SuperadminTotpDB(user_id=current_user.id, secret=secret, backup_codes_hash=backups, is_enabled=0, created_at=ts))
        db.commit()
        uri = pyotp.TOTP(secret).provisioning_uri(name=current_user.email, issuer_name="NutriData")
        plain_backups = [secrets.token_hex(4) for _ in range(8)]
        row = db.query(SuperadminTotpDB).filter(SuperadminTotpDB.user_id == current_user.id).first()
        row.backup_codes_hash = [hashlib.sha256(c.encode()).hexdigest() for c in plain_backups]
        db.commit()
        return {"secret": secret, "otpauth_uri": uri, "backup_codes": plain_backups}

    @app.post("/api/superadmin/platform/2fa/confirm")
    def totp_confirm(body: TotpSetupConfirmSchema, db: Session = Depends(get_db), current_user=Depends(require_superadmin)):
        if not verify_totp_code(db, current_user.id, body.code):
            raise HTTPException(status_code=400, detail="Código inválido")
        row = db.query(SuperadminTotpDB).filter(SuperadminTotpDB.user_id == current_user.id).first()
        if row:
            row.is_enabled = 1
            row.verified_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
            db.commit()
        return {"success": True, "enabled": True}

    @app.post("/api/auth/2fa/verify")
    def totp_login_verify(body: TotpVerifySchema, db: Session = Depends(get_db)):
        if not body.temp_token:
            raise HTTPException(status_code=400, detail="temp_token requerido")
        try:
            payload = jose_jwt.decode(body.temp_token, SECRET_KEY, algorithms=[ALGORITHM])
        except JWTError:
            raise HTTPException(status_code=401, detail="Token expirado")
        if not payload.get("pending_2fa"):
            raise HTTPException(status_code=400, detail="Token no es de 2FA")
        user = db.query(UserDB).filter(UserDB.id == payload.get("id")).first()
        if not user:
            raise HTTPException(status_code=404)
        if not verify_totp_code(db, user.id, body.code):
            raise HTTPException(status_code=401, detail="Código 2FA inválido")
        full_token = jose_jwt.encode({
            "sub": user.email, "id": user.id, "role": user.role,
            "exp": datetime.utcnow() + timedelta(hours=12),
        }, SECRET_KEY, algorithm=ALGORITHM)
        return {"success": True, "token": full_token, "user": {"id": user.id, "name": f"{user.nombres} {user.apellidos}", "role": user.role, "avatar": user.foto_perfil}}

    # ── IP Allowlist ──
    @app.get("/api/superadmin/platform/ip-allowlist")
    def list_ip_allowlist(db: Session = Depends(get_db), _=Depends(_secure_superadmin)):
        rows = db.query(SuperadminIpAllowlistDB).order_by(SuperadminIpAllowlistDB.id).all()
        return [{"id": r.id, "cidr_or_ip": r.cidr_or_ip, "label": r.label, "is_active": bool(r.is_active)} for r in rows]

    @app.post("/api/superadmin/platform/ip-allowlist")
    def add_ip_allowlist(body: IpAllowlistSchema, db: Session = Depends(get_db), _=Depends(_secure_superadmin)):
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.add(SuperadminIpAllowlistDB(
            cidr_or_ip=body.cidr_or_ip.strip(), label=body.label,
            is_active=1 if body.is_active else 0, created_at=ts,
        ))
        db.commit()
        return {"success": True}

    @app.delete("/api/superadmin/platform/ip-allowlist/{entry_id}")
    def delete_ip_allowlist(entry_id: int, db: Session = Depends(get_db), _=Depends(_secure_superadmin)):
        row = db.query(SuperadminIpAllowlistDB).filter(SuperadminIpAllowlistDB.id == entry_id).first()
        if row:
            db.delete(row)
            db.commit()
        return {"success": True}

    # ── Reportes programados ──
    @app.get("/api/superadmin/platform/scheduled-reports")
    def list_scheduled_reports(db: Session = Depends(get_db), _=Depends(_secure_superadmin)):
        rows = db.query(ScheduledReportDB).order_by(ScheduledReportDB.id.desc()).all()
        return [{"id": r.id, "name": r.name, "organization_id": r.organization_id,
                 "recipient_emails": r.recipient_emails, "report_type": r.report_type,
                 "schedule_cron": r.schedule_cron, "is_active": bool(r.is_active),
                 "last_sent_at": r.last_sent_at} for r in rows]

    @app.post("/api/superadmin/platform/scheduled-reports")
    def create_scheduled_report(body: ScheduledReportSchema, db: Session = Depends(get_db), _=Depends(_secure_superadmin)):
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.add(ScheduledReportDB(
            name=body.name, organization_id=body.organization_id,
            recipient_emails=body.recipient_emails, report_type=body.report_type,
            schedule_cron=body.schedule_cron, is_active=1 if body.is_active else 0,
            created_at=ts,
        ))
        db.commit()
        return {"success": True}

    @app.post("/api/superadmin/platform/scheduled-reports/{report_id}/run")
    def run_scheduled_report(report_id: int, db: Session = Depends(get_db), _=Depends(_secure_superadmin)):
        row = db.query(ScheduledReportDB).filter(ScheduledReportDB.id == report_id).first()
        if not row:
            raise HTTPException(status_code=404)
        patient_count = db.query(UserDB).filter(UserDB.role == "patient").count()
        org_name = "Plataforma"
        if row.organization_id and OrganizationDB:
            org = db.query(OrganizationDB).filter(OrganizationDB.id == row.organization_id).first()
            if org:
                org_name = org.name
        subject = f"Reporte semanal NutriData — {org_name}"
        body_text = f"Resumen semanal {org_name}\nPacientes activos en plataforma: {patient_count}\nGenerado: {now_co().strftime('%Y-%m-%d %H:%M')}"
        emails = row.recipient_emails if isinstance(row.recipient_emails, list) else []
        sent = sum(1 for e in emails if _send_simple_email(e, subject, body_text, send_generic_email))
        row.last_sent_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        return {"success": True, "emails_sent": sent}

    # ── Release notes ──
    @app.get("/api/release-notes")
    def public_release_notes(role: str = Query("all"), db: Session = Depends(get_db)):
        rows = db.query(ReleaseNoteDB).filter(ReleaseNoteDB.is_published == 1).order_by(ReleaseNoteDB.published_at.desc()).limit(20).all()
        out = []
        for r in rows:
            roles = r.roles if isinstance(r.roles, list) else ["all"]
            if role != "all" and "all" not in roles and role not in roles:
                continue
            out.append({"id": r.id, "version": r.version, "title": r.title, "body": r.body,
                        "roles": roles, "published_at": r.published_at})
        return {"notes": out}

    @app.get("/api/superadmin/platform/release-notes")
    def admin_release_notes(db: Session = Depends(get_db), _=Depends(_secure_superadmin)):
        rows = db.query(ReleaseNoteDB).order_by(ReleaseNoteDB.id.desc()).all()
        return [{"id": r.id, "version": r.version, "title": r.title, "body": r.body,
                 "roles": r.roles, "is_published": bool(r.is_published), "published_at": r.published_at} for r in rows]

    @app.post("/api/superadmin/platform/release-notes")
    def create_release_note(body: ReleaseNoteSchema, db: Session = Depends(get_db), _=Depends(_secure_superadmin)):
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.add(ReleaseNoteDB(
            version=body.version, title=body.title, body=body.body, roles=body.roles,
            is_published=1 if body.is_published else 0,
            published_at=ts if body.is_published else None, created_at=ts,
        ))
        db.commit()
        return {"success": True}

    @app.put("/api/superadmin/platform/release-notes/{note_id}")
    def update_release_note(note_id: int, body: ReleaseNoteUpdateSchema, db: Session = Depends(get_db), _=Depends(_secure_superadmin)):
        row = db.query(ReleaseNoteDB).filter(ReleaseNoteDB.id == note_id).first()
        if not row:
            raise HTTPException(status_code=404)
        for f in ("title", "body", "roles"):
            v = getattr(body, f, None)
            if v is not None:
                setattr(row, f, v)
        if body.is_published is not None:
            row.is_published = 1 if body.is_published else 0
            if body.is_published and not row.published_at:
                row.published_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        return {"success": True}

    # ── Partner API v1 (EPS / integradores) ──
    PatientMealPlanDB = deps.get("PatientMealPlanDB")
    MealPlanDB = deps.get("MealPlanDB")
    AppointmentDB = deps.get("AppointmentDB")

    @app.get("/api/partner/v1/aggregates")
    def partner_aggregates(
        organization_id: Optional[int] = None,
        x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
        db: Session = Depends(get_db),
    ):
        key_info = _require_partner_access(db, x_api_key, "aggregates:read")
        org_id = _resolve_partner_org_id(db, key_info, organization_id, OrganizationDB)
        patient_ids = _partner_member_patient_ids(db, org_id, OrganizationMemberDB, UserDB)
        total_patients = len(patient_ids)
        nutritionist_ids = []
        if OrganizationMemberDB:
            nutritionist_ids = [
                m.user_id
                for m in db.query(OrganizationMemberDB)
                .filter(OrganizationMemberDB.organization_id == org_id)
                .all()
            ]
        nutri_q = db.query(UserDB).filter(UserDB.role == "admin", UserDB.status == "activo")
        if nutritionist_ids:
            nutri_q = nutri_q.filter(UserDB.id.in_(nutritionist_ids))
        total_nutritionists = nutri_q.count()
        _touch_partner_key(db, key_info["id"], now_co)
        return {
            "generated_at": now_co().strftime("%Y-%m-%d %H:%M:%S"),
            "organization_id": org_id,
            "environment": "sandbox" if key_info.get("is_sandbox") else "production",
            "aggregates": {
                "active_patients": total_patients,
                "active_nutritionists": total_nutritionists,
            },
        }

    @app.get("/api/partner/v1/organization")
    def partner_organization(
        organization_id: Optional[int] = None,
        x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
        db: Session = Depends(get_db),
    ):
        key_info = _require_partner_access(db, x_api_key, "organization:read")
        org_id = _resolve_partner_org_id(db, key_info, organization_id, OrganizationDB)
        org = db.query(OrganizationDB).filter(OrganizationDB.id == org_id).first()
        _touch_partner_key(db, key_info["id"], now_co)
        return {
            "generated_at": now_co().strftime("%Y-%m-%d %H:%M:%S"),
            "organization": {
                "id": org.id,
                "name": org.name,
                "code": org.code,
                "status": org.status,
                "eps_program": getattr(org, "eps_program", None),
                "sla_tier": getattr(org, "sla_tier", None) or "standard",
                "contract_start": getattr(org, "contract_start", None),
                "contract_end": getattr(org, "contract_end", None),
                "max_patients": getattr(org, "max_patients", None),
                "max_nutritionists": getattr(org, "max_nutritionists", None),
                "is_sandbox": bool(getattr(org, "is_sandbox", 0)),
            },
        }

    @app.get("/api/partner/v1/patients/summary")
    def partner_patients_summary(
        organization_id: Optional[int] = None,
        x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
        db: Session = Depends(get_db),
    ):
        key_info = _require_partner_access(db, x_api_key, "patients:read")
        org_id = _resolve_partner_org_id(db, key_info, organization_id, OrganizationDB)
        patient_ids = _partner_member_patient_ids(db, org_id, OrganizationMemberDB, UserDB)
        since_30 = (today_co() - timedelta(days=30)).strftime("%Y-%m-%d")
        new_30d = 0
        if patient_ids:
            new_30d = (
                db.query(UserDB)
                .filter(UserDB.id.in_(patient_ids), UserDB.created_at >= since_30)
                .count()
            )
        active_30d = 0
        if patient_ids and MealTrackingDB:
            active_30d = (
                db.query(MealTrackingDB.patient_id)
                .filter(MealTrackingDB.patient_id.in_(patient_ids), MealTrackingDB.date >= since_30)
                .distinct()
                .count()
            )
        by_plan: dict = {}
        if patient_ids and PatientMealPlanDB and MealPlanDB:
            for tipo, cnt in (
                db.query(MealPlanDB.tipo, func.count(PatientMealPlanDB.id))
                .join(PatientMealPlanDB, PatientMealPlanDB.meal_plan_id == MealPlanDB.id)
                .filter(
                    PatientMealPlanDB.patient_id.in_(patient_ids),
                    PatientMealPlanDB.status == "active",
                )
                .group_by(MealPlanDB.tipo)
                .all()
            ):
                by_plan[tipo or "adulto"] = cnt
        _touch_partner_key(db, key_info["id"], now_co)
        return {
            "generated_at": now_co().strftime("%Y-%m-%d %H:%M:%S"),
            "organization_id": org_id,
            "summary": {
                "total_active": len(patient_ids),
                "active_last_30d": active_30d,
                "new_last_30d": new_30d,
                "activity_rate_pct": round((active_30d / len(patient_ids)) * 100, 1) if patient_ids else 0,
                "plans_by_type": by_plan,
            },
        }

    @app.get("/api/partner/v1/adherence")
    def partner_adherence(
        organization_id: Optional[int] = None,
        x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
        db: Session = Depends(get_db),
    ):
        key_info = _require_partner_access(db, x_api_key, "adherence:read")
        org_id = _resolve_partner_org_id(db, key_info, organization_id, OrganizationDB)
        patient_ids = _partner_member_patient_ids(db, org_id, OrganizationMemberDB, UserDB)
        scores = []
        buckets = {"excellent": 0, "good": 0, "fair": 0, "poor": 0}
        if patient_ids and calculate_weekly_adherence:
            for pid in patient_ids[:500]:
                try:
                    adh = int(calculate_weekly_adherence(pid, db) or 0)
                except Exception:
                    adh = 0
                scores.append(adh)
                if adh >= 80:
                    buckets["excellent"] += 1
                elif adh >= 60:
                    buckets["good"] += 1
                elif adh >= 40:
                    buckets["fair"] += 1
                else:
                    buckets["poor"] += 1
        avg = round(sum(scores) / len(scores), 1) if scores else 0
        _touch_partner_key(db, key_info["id"], now_co)
        return {
            "generated_at": now_co().strftime("%Y-%m-%d %H:%M:%S"),
            "organization_id": org_id,
            "adherence": {
                "avg_weekly_pct": avg,
                "patients_sampled": len(scores),
                "distribution": buckets,
            },
        }

    @app.get("/api/partner/v1/programs")
    def partner_programs(
        organization_id: Optional[int] = None,
        x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
        db: Session = Depends(get_db),
    ):
        key_info = _require_partner_access(db, x_api_key, "programs:read")
        org_id = _resolve_partner_org_id(db, key_info, organization_id, OrganizationDB)
        org = db.query(OrganizationDB).filter(OrganizationDB.id == org_id).first()
        modules = getattr(org, "enabled_modules", None) or []
        _touch_partner_key(db, key_info["id"], now_co)
        return {
            "generated_at": now_co().strftime("%Y-%m-%d %H:%M:%S"),
            "organization_id": org_id,
            "program": {
                "eps_program": getattr(org, "eps_program", None),
                "benefit_type": getattr(org, "benefit_type", None),
                "benefit_value": getattr(org, "benefit_value", None),
                "enabled_modules": modules if isinstance(modules, list) else [],
                "patient_feature_flags": getattr(org, "patient_feature_flags", None) or {},
            },
        }
