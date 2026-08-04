"""
Módulo de plataforma NutriData: organizaciones, sedes, auditoría, roles granulares.
Se registra desde main.py con register_platform().
"""
from __future__ import annotations

from datetime import datetime, timedelta, date
from typing import Optional, List, Callable, Any, TYPE_CHECKING

from fastapi import HTTPException, Depends, status
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr
from sqlalchemy import Column, Integer, String, Text, JSON, ForeignKey, or_, func
from sqlalchemy.orm import Session

if TYPE_CHECKING:
    from sqlalchemy.orm import DeclarativeBase

# ---------------------------------------------------------------------------
# Roles granulares
# ---------------------------------------------------------------------------

STAFF_ROLES = {
    "nutritionist": {
        "label": "Nutricionista",
        "permissions": [
            "patients", "plans", "appointments", "clinical", "messages",
            "analytics", "progress", "recipes", "menus", "consultation",
        ],
    },
    "clinical_assistant": {
        "label": "Asistente clínico",
        "permissions": ["appointments"],
    },
    "senior_nutritionist": {
        "label": "Nutricionista senior",
        "permissions": [
            "patients", "plans", "appointments", "clinical", "messages",
            "analytics", "progress", "recipes", "menus", "consultation", "transfers",
        ],
    },
    "org_admin": {
        "label": "Admin organización (EPS)",
        "permissions": ["patients_org", "appointments", "analytics", "reports", "progress"],
    },
}

MODULE_LABELS = {
    "appointments": "Citas",
    "meal_tracking": "Seguimiento alimentario",
    "clinical_colombia": "Clínica Colombia",
    "specialty_plans": "Planes por especialidad",
    "analytics": "Adherencia / Analytics",
    "organizations": "Organizaciones",
}

DEFAULT_ENABLED_MODULES = list(MODULE_LABELS.keys())

PLAN_TIPO_LABELS = {
    "adulto": "Adulto",
    "pediatria": "Pediatría",
    "gestante": "Gestante",
    "gestante_adolescente": "Gestante adolescente",
    "hospitalizado": "Hospitalizado",
    "deportista": "Deportista",
    "geriatria": "Geriatría",
}


class OrganizationCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    status: str = "activo"
    benefit_type: str = "personalizado"
    benefit_value: Optional[str] = None
    benefit_description: Optional[str] = None
    eps_program: Optional[str] = None
    max_patients: Optional[int] = None
    max_nutritionists: Optional[int] = None
    enabled_modules: Optional[List[str]] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    contract_start: Optional[str] = None
    contract_end: Optional[str] = None
    sla_tier: str = "standard"
    support_sla_hours: Optional[dict] = None
    is_sandbox: bool = False


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    benefit_type: Optional[str] = None
    benefit_value: Optional[str] = None
    benefit_description: Optional[str] = None
    eps_program: Optional[str] = None
    max_patients: Optional[int] = None
    max_nutritionists: Optional[int] = None
    enabled_modules: Optional[List[str]] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    contract_start: Optional[str] = None
    contract_end: Optional[str] = None
    sla_tier: Optional[str] = None
    support_sla_hours: Optional[dict] = None
    is_sandbox: Optional[bool] = None


class BenefitCodeCreate(BaseModel):
    code: str
    label: Optional[str] = None
    benefit_type: str = "personalizado"
    benefit_value: Optional[str] = None
    benefit_description: Optional[str] = None
    max_uses: Optional[int] = None
    expires_at: Optional[str] = None
    status: str = "activo"


class BenefitCodeUpdate(BaseModel):
    label: Optional[str] = None
    benefit_type: Optional[str] = None
    benefit_value: Optional[str] = None
    benefit_description: Optional[str] = None
    max_uses: Optional[int] = None
    expires_at: Optional[str] = None
    status: Optional[str] = None


class OrgJoinBody(BaseModel):
    code: str


class OrgMemberAdd(BaseModel):
    user_id: int
    site_id: Optional[int] = None
    member_role: str = "member"
    notes: Optional[str] = None


class SiteCreate(BaseModel):
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    status: str = "activo"


class SiteUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None


class StaffRoleUpdate(BaseModel):
    staff_role: str
    organization_id: Optional[int] = None
    site_id: Optional[int] = None


class PatientTransferBody(BaseModel):
    patient_ids: List[int]
    target_nutritionist_id: int
    reason: Optional[str] = None


class AuditSettingsUpdate(BaseModel):
    retention_days: int


AUDIT_RETENTION_OPTIONS = [90, 180, 365]
SENSITIVE_ACTIONS = {"role_change", "transfer", "delete"}
MASS_TRANSFER_THRESHOLD = 5

SLA_TIER_LABELS = {
    "enterprise": "Enterprise (SLA acelerado)",
    "standard": "Standard",
    "basic": "Basic (SLA extendido)",
}

# Model refs set at register time
OrganizationDB = None
OrganizationMemberDB = None
OrganizationSiteDB = None
OrganizationBenefitCodeDB = None
AuditLogDB = None


def register_platform_models(Base):
    """Define tablas de plataforma sobre el mismo Base de main.py."""

    class _OrganizationDB(Base):
        __tablename__ = "organizations"
        id = Column(Integer, primary_key=True, index=True)
        name = Column(String(200), nullable=False)
        email = Column(String(100), nullable=True)
        phone = Column(String(30), nullable=True)
        code = Column(String(40), unique=True, nullable=False, index=True)
        description = Column(Text, nullable=True)
        status = Column(String(20), default="activo")
        benefit_type = Column(String(40), default="personalizado")
        benefit_value = Column(String(50), nullable=True)
        benefit_description = Column(Text, nullable=True)
        eps_program = Column(String(120), nullable=True)
        max_patients = Column(Integer, nullable=True)
        max_nutritionists = Column(Integer, nullable=True)
        enabled_modules = Column(JSON, nullable=True)
        patient_feature_flags = Column(JSON, nullable=True)
        logo_url = Column(String(500), nullable=True)
        primary_color = Column(String(20), nullable=True)
        contract_start = Column(String(20), nullable=True)
        contract_end = Column(String(20), nullable=True)
        sla_tier = Column(String(20), default="standard")
        support_sla_hours = Column(JSON, nullable=True)
        is_sandbox = Column(Integer, default=0)
        created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
        created_at = Column(String(50), nullable=True)
        updated_at = Column(String(50), nullable=True)

    class _OrganizationBenefitCodeDB(Base):
        __tablename__ = "organization_benefit_codes"
        id = Column(Integer, primary_key=True, index=True)
        organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
        code = Column(String(40), unique=True, nullable=False, index=True)
        label = Column(String(200), nullable=True)
        benefit_type = Column(String(40), default="personalizado")
        benefit_value = Column(String(50), nullable=True)
        benefit_description = Column(Text, nullable=True)
        max_uses = Column(Integer, nullable=True)
        uses_count = Column(Integer, default=0)
        expires_at = Column(String(50), nullable=True)
        status = Column(String(20), default="activo")
        created_at = Column(String(50), nullable=True)
        updated_at = Column(String(50), nullable=True)

    class _OrganizationSiteDB(Base):
        __tablename__ = "organization_sites"
        id = Column(Integer, primary_key=True, index=True)
        organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
        name = Column(String(200), nullable=False)
        address = Column(Text, nullable=True)
        city = Column(String(100), nullable=True)
        phone = Column(String(30), nullable=True)
        status = Column(String(20), default="activo")
        created_at = Column(String(50), nullable=True)
        updated_at = Column(String(50), nullable=True)

    class _OrganizationMemberDB(Base):
        __tablename__ = "organization_members"
        id = Column(Integer, primary_key=True, index=True)
        organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
        user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
        site_id = Column(Integer, ForeignKey("organization_sites.id"), nullable=True, index=True)
        member_role = Column(String(50), default="member")
        status = Column(String(20), default="activo")
        joined_at = Column(String(50), nullable=True)
        notes = Column(Text, nullable=True)

    class _AuditLogDB(Base):
        __tablename__ = "audit_logs"
        id = Column(Integer, primary_key=True, index=True)
        actor_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
        actor_name = Column(String(200), nullable=True)
        actor_role = Column(String(50), nullable=True)
        action = Column(String(80), nullable=False, index=True)
        entity_type = Column(String(80), nullable=False, index=True)
        entity_id = Column(Integer, nullable=True, index=True)
        patient_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
        organization_id = Column(Integer, nullable=True, index=True)
        summary = Column(String(500), nullable=True)
        details = Column(JSON, nullable=True)
        ip_address = Column(String(64), nullable=True)
        created_at = Column(String(50), nullable=True, index=True)

    global OrganizationDB, OrganizationMemberDB, OrganizationSiteDB, OrganizationBenefitCodeDB, AuditLogDB
    OrganizationDB = _OrganizationDB
    OrganizationMemberDB = _OrganizationMemberDB
    OrganizationSiteDB = _OrganizationSiteDB
    OrganizationBenefitCodeDB = _OrganizationBenefitCodeDB
    AuditLogDB = _AuditLogDB
    return OrganizationDB, OrganizationMemberDB, OrganizationSiteDB, AuditLogDB


def ensure_platform_schema(engine, inspect_fn, text_fn, AdminProfileDB):
    """Migraciones ligeras para columnas de roles y sedes."""
    try:
        inspector = inspect_fn(engine)
        tables = inspector.get_table_names()
        if "admin_profiles" in tables:
            cols = {c["name"] for c in inspector.get_columns("admin_profiles")}
            for col_name, col_sql in [
                ("staff_role", "VARCHAR(50) DEFAULT 'nutritionist'"),
                ("organization_id", "INTEGER NULL"),
                ("site_id", "INTEGER NULL"),
            ]:
                if col_name not in cols:
                    with engine.begin() as conn:
                        conn.execute(text_fn(f"ALTER TABLE admin_profiles ADD COLUMN {col_name} {col_sql}"))
        if "organization_members" in tables:
            cols = {c["name"] for c in inspector.get_columns("organization_members")}
            for col_name, col_sql in [
                ("site_id", "INTEGER NULL"),
                ("member_role", "VARCHAR(50) DEFAULT 'member'"),
            ]:
                if col_name not in cols:
                    with engine.begin() as conn:
                        conn.execute(text_fn(f"ALTER TABLE organization_members ADD COLUMN {col_name} {col_sql}"))
        if "organizations" in tables:
            cols = {c["name"] for c in inspector.get_columns("organizations")}
            for col_name, col_sql in [
                ("eps_program", "VARCHAR(120) NULL"),
                ("max_patients", "INTEGER NULL"),
                ("max_nutritionists", "INTEGER NULL"),
                ("enabled_modules", "JSON NULL"),
                ("patient_feature_flags", "JSON NULL"),
                ("logo_url", "VARCHAR(500) NULL"),
                ("primary_color", "VARCHAR(20) NULL"),
                ("contract_start", "VARCHAR(20) NULL"),
                ("contract_end", "VARCHAR(20) NULL"),
                ("sla_tier", "VARCHAR(20) DEFAULT 'standard'"),
                ("support_sla_hours", "JSON NULL"),
                ("is_sandbox", "INTEGER DEFAULT 0"),
            ]:
                if col_name not in cols:
                    with engine.begin() as conn:
                        conn.execute(text_fn(f"ALTER TABLE organizations ADD COLUMN {col_name} {col_sql}"))
        tables = inspector.get_table_names()
        if "organization_benefit_codes" not in tables and OrganizationBenefitCodeDB is not None:
            OrganizationBenefitCodeDB.__table__.create(bind=engine, checkfirst=True)
    except Exception as e:
        print(f"[PLATFORM] schema migration skipped: {e}")


def get_staff_role(db: Session, user, AdminProfileDB) -> str:
    if not user or user.role != "admin":
        return "superadmin" if user and user.role == "superadmin" else "unknown"
    prof = db.query(AdminProfileDB).filter(AdminProfileDB.user_id == user.id).first()
    role = getattr(prof, "staff_role", None) if prof else None
    return role or "nutritionist"


def staff_has_permission(role: str, permission: str) -> bool:
    if role == "superadmin":
        return True
    cfg = STAFF_ROLES.get(role, STAFF_ROLES["nutritionist"])
    return permission in cfg.get("permissions", [])


def get_user_organization_id(db: Session, user_id: int) -> Optional[int]:
    if OrganizationMemberDB is None:
        return None
    m = (
        db.query(OrganizationMemberDB)
        .filter(OrganizationMemberDB.user_id == user_id, OrganizationMemberDB.status == "activo")
        .first()
    )
    return m.organization_id if m else None


def patient_in_organization(db: Session, patient_id: int, organization_id: int) -> bool:
    if OrganizationMemberDB is None:
        return False
    m = (
        db.query(OrganizationMemberDB)
        .filter(
            OrganizationMemberDB.user_id == patient_id,
            OrganizationMemberDB.organization_id == organization_id,
            OrganizationMemberDB.status == "activo",
        )
        .first()
    )
    return m is not None


def log_audit(
    db: Session,
    *,
    actor,
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    patient_id: Optional[int] = None,
    organization_id: Optional[int] = None,
    summary: Optional[str] = None,
    details: Optional[dict] = None,
    now_co: Callable,
):
    if AuditLogDB is None or actor is None:
        return
    if action == "delete" and entity_type in ("patient", "user"):
        patient_id = None
    name = f"{getattr(actor, 'nombres', '') or ''} {getattr(actor, 'apellidos', '') or ''}".strip()
    row = AuditLogDB(
        actor_id=actor.id,
        actor_name=name or getattr(actor, "email", None),
        actor_role=getattr(actor, "role", None),
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        patient_id=patient_id,
        organization_id=organization_id,
        summary=summary,
        details=details or {},
        created_at=now_co().strftime("%Y-%m-%d %H:%M:%S"),
    )
    db.add(row)


def _extract_diff(details: Optional[dict]) -> Optional[dict]:
    """Extrae before/after para cambios sensibles."""
    if not details or not isinstance(details, dict):
        return None
    before = details.get("before")
    after = details.get("after")
    if before is None and after is None:
        if "staff_role" in details:
            return {"before": {}, "after": {"staff_role": details.get("staff_role")}}
        return None
    return {"before": before, "after": after}


def _audit_is_sensitive(row) -> bool:
    if row.action in SENSITIVE_ACTIONS:
        return True
    details = row.details if isinstance(row.details, dict) else {}
    return "before" in details or "after" in details


def _serialize_audit_row(row, *, include_diff: bool = True) -> dict:
    data = {
        "id": row.id,
        "actor_id": row.actor_id,
        "actor_name": row.actor_name,
        "actor_role": row.actor_role,
        "action": row.action,
        "entity_type": row.entity_type,
        "entity_id": row.entity_id,
        "patient_id": row.patient_id,
        "organization_id": row.organization_id,
        "summary": row.summary,
        "details": row.details,
        "created_at": row.created_at,
        "is_sensitive": _audit_is_sensitive(row),
    }
    if include_diff:
        data["diff"] = _extract_diff(row.details if isinstance(row.details, dict) else None)
    return data


def _compute_audit_alerts(rows) -> list:
    """Alertas: transferencias masivas, eliminaciones, cambios rol superadmin."""
    alerts: list = []
    seen: set = set()

    transfer_buckets: dict = {}
    for row in rows:
        if row.action != "transfer":
            continue
        hour_key = (row.actor_id, (row.created_at or "")[:13])
        transfer_buckets.setdefault(hour_key, []).append(row)

    for bucket in transfer_buckets.values():
        if len(bucket) < MASS_TRANSFER_THRESHOLD:
            continue
        first = bucket[0]
        alert_id = f"mass_transfer:{first.actor_id}:{(first.created_at or '')[:13]}"
        if alert_id in seen:
            continue
        seen.add(alert_id)
        alerts.append({
            "id": alert_id,
            "type": "mass_transfer",
            "severity": "high",
            "title": "Transferencias masivas",
            "message": (
                f"{len(bucket)} pacientes transferidos por {first.actor_name or 'Desconocido'} "
                f"en aprox. 1 hora"
            ),
            "actor_id": first.actor_id,
            "actor_name": first.actor_name,
            "count": len(bucket),
            "created_at": first.created_at,
            "log_ids": [r.id for r in bucket[:20]],
        })

    for row in rows:
        if row.action == "delete" and row.entity_type in ("patient", "user", "organization"):
            alert_id = f"deletion:{row.id}"
            if alert_id in seen:
                continue
            seen.add(alert_id)
            entity_labels = {"patient": "paciente", "user": "usuario", "organization": "organización"}
            alerts.append({
                "id": alert_id,
                "type": "deletion",
                "severity": "high",
                "title": f"Eliminación de {entity_labels.get(row.entity_type, row.entity_type)}",
                "message": row.summary or f"Eliminación registrada (#{row.id})",
                "actor_id": row.actor_id,
                "actor_name": row.actor_name,
                "entity_type": row.entity_type,
                "entity_id": row.entity_id,
                "created_at": row.created_at,
                "log_id": row.id,
            })

        if row.action in ("role_change", "update"):
            details = row.details if isinstance(row.details, dict) else {}
            before = details.get("before") or {}
            after = details.get("after") or {}
            before_role = before.get("role") or before.get("staff_role")
            after_role = after.get("role") or after.get("staff_role") or details.get("staff_role")
            if before_role != "superadmin" and after_role != "superadmin":
                continue
            alert_id = f"superadmin_role:{row.id}"
            if alert_id in seen:
                continue
            seen.add(alert_id)
            alerts.append({
                "id": alert_id,
                "type": "superadmin_role_change",
                "severity": "critical",
                "title": "Cambio de rol superadmin",
                "message": row.summary or f"Rol superadmin modificado (#{row.id})",
                "actor_id": row.actor_id,
                "actor_name": row.actor_name,
                "before_role": before_role,
                "after_role": after_role,
                "created_at": row.created_at,
                "log_id": row.id,
            })

    alerts.sort(key=lambda a: a.get("created_at") or "", reverse=True)
    return alerts[:30]


def _get_system_settings_row(db: Session, SystemSettingsDB):
    row = db.query(SystemSettingsDB).first()
    if not row:
        row = SystemSettingsDB(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _get_audit_retention_days(db: Session, SystemSettingsDB) -> int:
    row = _get_system_settings_row(db, SystemSettingsDB)
    days = getattr(row, "audit_retention_days", None) or 180
    try:
        days = int(days)
    except (TypeError, ValueError):
        days = 180
    return days if days in AUDIT_RETENTION_OPTIONS else 180


def _purge_audit_logs(db: Session, retention_days: int) -> int:
    cutoff = (datetime.utcnow() - timedelta(days=retention_days)).strftime("%Y-%m-%d %H:%M:%S")
    deleted = (
        db.query(AuditLogDB)
        .filter(AuditLogDB.created_at < cutoff)
        .delete(synchronize_session=False)
    )
    db.commit()
    return deleted


def _benefit_label(org) -> str:
    bt = org.benefit_type or "personalizado"
    if bt == "descuento" and org.benefit_value:
        return f"Descuento {org.benefit_value}%"
    if bt == "cita_prioridad":
        return "Cita prioritaria"
    if bt == "consulta_gratis":
        return "Consulta gratuita"
    return org.benefit_description or "Beneficio personalizado"


def _benefit_code_label(row) -> str:
    bt = row.benefit_type or "personalizado"
    if bt == "descuento" and row.benefit_value:
        return f"Descuento {row.benefit_value}%"
    if bt == "cita_prioridad":
        return "Cita prioritaria"
    if bt == "consulta_gratis":
        return "Consulta gratuita"
    return row.benefit_description or row.label or "Beneficio"


def _parse_enabled_modules(raw) -> List[str]:
    if isinstance(raw, list) and raw:
        return [m for m in raw if m in MODULE_LABELS]
    return list(DEFAULT_ENABLED_MODULES)


def _org_contract_payload(org, counts: dict) -> dict:
    max_p = getattr(org, "max_patients", None)
    max_n = getattr(org, "max_nutritionists", None)
    patients = counts.get("patients_count") or 0
    nutritionists = counts.get("nutritionists_count") or 0
    return {
        "max_patients": max_p,
        "max_nutritionists": max_n,
        "patients_used": patients,
        "nutritionists_used": nutritionists,
        "patients_remaining": (max_p - patients) if max_p is not None else None,
        "nutritionists_remaining": (max_n - nutritionists) if max_n is not None else None,
        "enabled_modules": _parse_enabled_modules(getattr(org, "enabled_modules", None)),
        "patient_feature_flags": getattr(org, "patient_feature_flags", None) or {},
        "module_labels": MODULE_LABELS,
        "contract_start": getattr(org, "contract_start", None),
        "contract_end": getattr(org, "contract_end", None),
        "sla_tier": getattr(org, "sla_tier", None) or "standard",
        "sla_tier_label": SLA_TIER_LABELS.get(getattr(org, "sla_tier", None) or "standard", "Standard"),
        "support_sla_hours": getattr(org, "support_sla_hours", None) or {},
        "is_sandbox": bool(getattr(org, "is_sandbox", 0)),
        "logo_url": getattr(org, "logo_url", None),
        "primary_color": getattr(org, "primary_color", None),
    }


def _check_org_member_limit(db: Session, org_id: int, user, UserDB, PatientMealPlanDB) -> None:
    org = db.query(OrganizationDB).filter(OrganizationDB.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organización no encontrada")
    if org.status != "activo":
        raise HTTPException(status_code=400, detail="Organización inactiva")
    contract_start = getattr(org, "contract_start", None)
    if contract_start:
        try:
            if date.today() < datetime.strptime(str(contract_start)[:10], "%Y-%m-%d").date():
                raise HTTPException(status_code=400, detail="Contrato de la organización aún no inicia")
        except HTTPException:
            raise
        except Exception:
            pass
    contract_end = getattr(org, "contract_end", None)
    if contract_end:
        try:
            if date.today() > datetime.strptime(str(contract_end)[:10], "%Y-%m-%d").date():
                raise HTTPException(status_code=400, detail="Contrato de la organización vencido")
        except HTTPException:
            raise
        except Exception:
            pass
    counts = _org_counts(db, org_id, UserDB, PatientMealPlanDB)
    if user.role == "patient" and getattr(org, "max_patients", None) is not None:
        if counts["patients_count"] >= org.max_patients:
            raise HTTPException(status_code=400, detail="La organización alcanzó el límite de pacientes")
    if user.role == "admin" and getattr(org, "max_nutritionists", None) is not None:
        if counts["nutritionists_count"] >= org.max_nutritionists:
            raise HTTPException(status_code=400, detail="La organización alcanzó el límite de nutricionistas")
    try:
        from billing_module import enforce_org_quota
        enforce_org_quota(db, org_id, user.role, UserDB, OrganizationMemberDB, PatientMealPlanDB)
    except HTTPException:
        raise
    except Exception:
        pass


def _serialize_benefit_code(row, org_name: Optional[str] = None) -> dict:
    remaining = None
    if row.max_uses is not None:
        remaining = max(0, row.max_uses - (row.uses_count or 0))
    expired = False
    if row.expires_at:
        try:
            expired = date.today() > datetime.strptime(str(row.expires_at)[:10], "%Y-%m-%d").date()
        except Exception:
            expired = False
    return {
        "id": row.id,
        "organization_id": row.organization_id,
        "organization_name": org_name,
        "code": row.code,
        "label": row.label,
        "benefit_type": row.benefit_type,
        "benefit_value": row.benefit_value,
        "benefit_description": row.benefit_description,
        "benefit_label": _benefit_code_label(row),
        "max_uses": row.max_uses,
        "uses_count": row.uses_count or 0,
        "uses_remaining": remaining,
        "expires_at": row.expires_at,
        "is_expired": expired,
        "status": row.status,
        "created_at": row.created_at,
    }


def _resolve_join_code(db: Session, code: str):
    """Resuelve código de org o código de beneficio. Retorna (org, benefit_code|None)."""
    normalized = (code or "").strip().upper()
    if not normalized:
        raise HTTPException(status_code=400, detail="Código requerido")
    bc = (
        db.query(OrganizationBenefitCodeDB)
        .filter(OrganizationBenefitCodeDB.code == normalized)
        .first()
    )
    if bc:
        if bc.status != "activo":
            raise HTTPException(status_code=400, detail="Código de beneficio inactivo")
        if bc.expires_at:
            try:
                if date.today() > datetime.strptime(str(bc.expires_at)[:10], "%Y-%m-%d").date():
                    raise HTTPException(status_code=400, detail="Código de beneficio expirado")
            except HTTPException:
                raise
            except Exception:
                pass
        if bc.max_uses is not None and (bc.uses_count or 0) >= bc.max_uses:
            raise HTTPException(status_code=400, detail="Código de beneficio agotado")
        org = db.query(OrganizationDB).filter(OrganizationDB.id == bc.organization_id).first()
        if not org:
            raise HTTPException(status_code=404, detail="Organización no encontrada")
        return org, bc
    org = db.query(OrganizationDB).filter(OrganizationDB.code == normalized).first()
    if not org:
        raise HTTPException(status_code=404, detail="Código no válido")
    return org, None


def _org_counts(db: Session, org_id: int, UserDB, PatientMealPlanDB) -> dict:
    member_rows = (
        db.query(OrganizationMemberDB)
        .filter(OrganizationMemberDB.organization_id == org_id, OrganizationMemberDB.status == "activo")
        .all()
    )
    user_ids = [m.user_id for m in member_rows]
    patients = (
        db.query(UserDB)
        .filter(UserDB.id.in_(user_ids), UserDB.role == "patient")
        .count()
        if user_ids
        else 0
    )
    nutritionists = (
        db.query(UserDB)
        .filter(UserDB.id.in_(user_ids), UserDB.role == "admin")
        .count()
        if user_ids
        else 0
    )
    sites = db.query(OrganizationSiteDB).filter(OrganizationSiteDB.organization_id == org_id).count()
    active_plans = 0
    if user_ids:
        active_plans = (
            db.query(PatientMealPlanDB)
            .filter(PatientMealPlanDB.patient_id.in_(user_ids), PatientMealPlanDB.status == "active")
            .count()
        )
    return {
        "members_count": len(member_rows),
        "patients_count": patients,
        "nutritionists_count": nutritionists,
        "sites_count": sites,
        "active_plans": active_plans,
    }


def _month_start(d: date) -> date:
    return d.replace(day=1)


def _prev_month_start(d: date) -> date:
    first = _month_start(d)
    return (first - timedelta(days=1)).replace(day=1)


def _users_created_since(db: Session, UserDB, since_str: str, role: Optional[str] = None) -> int:
    q = db.query(UserDB).filter(UserDB.created_at >= since_str)
    if role:
        q = q.filter(UserDB.role == role)
    return q.count()


def _active_patient_ids(
    db: Session,
    MealTrackingDB,
    AppointmentDB,
    since: date,
    until: Optional[date] = None,
) -> set:
    meal_q = db.query(MealTrackingDB.patient_id).filter(MealTrackingDB.date >= since)
    appt_q = db.query(AppointmentDB.patient_id).filter(AppointmentDB.date >= since)
    if until is not None:
        meal_q = meal_q.filter(MealTrackingDB.date < until)
        appt_q = appt_q.filter(AppointmentDB.date < until)
    ids = {r[0] for r in meal_q.distinct().all() if r[0]}
    ids.update(r[0] for r in appt_q.distinct().all() if r[0])
    return ids


def _adherence_pct_for_patients(
    db: Session,
    MealTrackingDB,
    patient_ids: list,
    week_start: date,
    week_end: date,
) -> int:
    if not patient_ids:
        return 0
    total = (
        db.query(MealTrackingDB)
        .filter(
            MealTrackingDB.patient_id.in_(patient_ids),
            MealTrackingDB.date >= week_start,
            MealTrackingDB.date <= week_end,
        )
        .count()
    )
    completed = (
        db.query(MealTrackingDB)
        .filter(
            MealTrackingDB.patient_id.in_(patient_ids),
            MealTrackingDB.date >= week_start,
            MealTrackingDB.date <= week_end,
            MealTrackingDB.completed == 1,
        )
        .count()
    )
    return int((completed / total) * 100) if total else 0


def _pct_change_label(current: float, previous: float) -> dict:
    if previous == 0:
        change_pct = 100.0 if current > 0 else 0.0
    else:
        change_pct = ((current - previous) / previous) * 100
    trend = "up" if change_pct > 0 else ("down" if change_pct < 0 else "flat")
    sign = "+" if change_pct > 0 else ""
    return {
        "current": current,
        "previous": previous,
        "change_pct": round(change_pct, 1),
        "change_label": f"{sign}{change_pct:.1f}% vs mes anterior",
        "trend": trend,
    }


def _org_patient_ids(db: Session, org_id: int, UserDB) -> list:
    rows = (
        db.query(OrganizationMemberDB.user_id)
        .join(UserDB, UserDB.id == OrganizationMemberDB.user_id)
        .filter(
            OrganizationMemberDB.organization_id == org_id,
            OrganizationMemberDB.status == "activo",
            UserDB.role == "patient",
        )
        .all()
    )
    return [r[0] for r in rows]


def _last_meal_date(db: Session, patient_id: int, MealTrackingDB) -> Optional[date]:
    row = (
        db.query(MealTrackingDB.date)
        .filter(MealTrackingDB.patient_id == patient_id)
        .order_by(MealTrackingDB.date.desc())
        .first()
    )
    return row[0] if row else None


def _patient_adherence_7d(db: Session, patient_id: int, MealTrackingDB, today: date) -> int:
    start = today - timedelta(days=6)
    base = db.query(MealTrackingDB).filter(
        MealTrackingDB.patient_id == patient_id,
        MealTrackingDB.date >= start,
        MealTrackingDB.date <= today,
    )
    total = base.count()
    done = base.filter(MealTrackingDB.completed == 1).count()
    return int((done / total) * 100) if total else 0


def _abandonment_score_patient(
    patient,
    db: Session,
    today: date,
    MealTrackingDB,
    AppointmentDB,
    PatientMealPlanDB,
) -> dict:
    """Misma lógica que phase4_module._abandonment_score."""
    factors = []
    score = 0
    last_log = _last_meal_date(db, patient.id, MealTrackingDB)
    days_without = (today - last_log).days if last_log else 999
    if days_without >= 5:
        score += 35
        factors.append(f"Sin logs hace {days_without} días")
    elif days_without >= 3:
        score += 20
        factors.append(f"Sin logs hace {days_without} días")

    adherence = _patient_adherence_7d(db, patient.id, MealTrackingDB, today)
    if adherence < 40:
        score += 30
        factors.append(f"Adherencia muy baja ({adherence}%)")
    elif adherence < 60:
        score += 15
        factors.append(f"Adherencia baja ({adherence}%)")

    last_apt = (
        db.query(AppointmentDB)
        .filter(AppointmentDB.patient_id == patient.id, AppointmentDB.status != "cancelada")
        .order_by(AppointmentDB.date.desc())
        .first()
    )
    if last_apt:
        days_since_apt = (today - last_apt.date).days
        if days_since_apt > 45:
            score += 20
            factors.append(f"Sin cita reciente ({days_since_apt} días)")
    else:
        score += 15
        factors.append("Sin citas registradas")

    active = (
        db.query(PatientMealPlanDB)
        .filter(PatientMealPlanDB.patient_id == patient.id, PatientMealPlanDB.status == "active")
        .first()
    )
    if not active:
        score += 20
        factors.append("Sin plan activo")

    score = min(100, score)
    level = "high" if score >= 60 else "medium" if score >= 35 else "low"
    return {
        "score": score,
        "level": level,
        "factors": factors,
        "adherence_pct": adherence,
        "days_without_logs": days_without if days_without < 999 else None,
    }


def _compute_health_score(
    activity_pct: int,
    adherence_pct: int,
    appointments_per_patient: float,
    logs_per_patient: float,
) -> dict:
    appts_score = min(100, int(appointments_per_patient * 40))
    logs_score = min(100, int(logs_per_patient * 3))
    total = int(
        0.30 * activity_pct
        + 0.30 * adherence_pct
        + 0.20 * appts_score
        + 0.20 * logs_score
    )
    return {
        "health_score": min(100, max(0, total)),
        "activity_score": activity_pct,
        "adherence_score": adherence_pct,
        "appointments_score": appts_score,
        "meal_logs_score": logs_score,
    }


def _org_cities(db: Session, org_id: int) -> list:
    rows = (
        db.query(OrganizationSiteDB.city)
        .filter(
            OrganizationSiteDB.organization_id == org_id,
            OrganizationSiteDB.city.isnot(None),
            OrganizationSiteDB.city != "",
        )
        .distinct()
        .all()
    )
    return sorted({r[0] for r in rows if r[0]})


def _patient_matches_plan_filter(
    db: Session,
    patient_ids: list,
    plan_type: Optional[str],
    PatientMealPlanDB,
    MealPlanDB,
) -> list:
    if not plan_type or not patient_ids:
        return patient_ids
    matched = (
        db.query(PatientMealPlanDB.patient_id)
        .join(MealPlanDB, MealPlanDB.id == PatientMealPlanDB.meal_plan_id)
        .filter(
            PatientMealPlanDB.patient_id.in_(patient_ids),
            PatientMealPlanDB.status == "active",
            MealPlanDB.tipo == plan_type,
        )
        .distinct()
        .all()
    )
    return [r[0] for r in matched]


def register_platform_routes(app, deps: dict):
    """Registra endpoints superadmin de plataforma."""
    get_db = deps["get_db"]
    require_superadmin = deps["require_superadmin"]
    require_admin_or_superadmin = deps["require_admin_or_superadmin"]
    get_current_user = deps["get_current_user"]
    UserDB = deps["UserDB"]
    AdminProfileDB = deps["AdminProfileDB"]
    MealPlanDB = deps["MealPlanDB"]
    PatientMealPlanDB = deps["PatientMealPlanDB"]
    AppointmentDB = deps["AppointmentDB"]
    MealTrackingDB = deps["MealTrackingDB"]
    SystemSettingsDB = deps.get("SystemSettingsDB")
    now_co = deps["now_co"]
    today_co = deps["today_co"]
    pwd_context = deps.get("pwd_context")

    def _serialize_org(db: Session, org, include_members: bool = False):
        counts = _org_counts(db, org.id, UserDB, PatientMealPlanDB)
        data = {
            "id": org.id,
            "name": org.name,
            "email": org.email,
            "phone": org.phone,
            "code": org.code,
            "description": org.description,
            "status": org.status,
            "benefit_type": org.benefit_type,
            "benefit_value": org.benefit_value,
            "benefit_description": org.benefit_description,
            "benefit_label": _benefit_label(org),
            "eps_program": org.eps_program,
            "created_at": org.created_at,
            **counts,
            **_org_contract_payload(org, counts),
        }
        if include_members:
            members = []
            rows = (
                db.query(OrganizationMemberDB)
                .filter(OrganizationMemberDB.organization_id == org.id)
                .all()
            )
            for m in rows:
                u = db.query(UserDB).filter(UserDB.id == m.user_id).first()
                if not u:
                    continue
                site = None
                if m.site_id:
                    s = db.query(OrganizationSiteDB).filter(OrganizationSiteDB.id == m.site_id).first()
                    site = s.name if s else None
                members.append({
                    "membership_id": m.id,
                    "user_id": u.id,
                    "name": f"{u.nombres} {u.apellidos}",
                    "email": u.email,
                    "role": u.role,
                    "member_role": m.member_role,
                    "site_id": m.site_id,
                    "site_name": site,
                    "status": m.status,
                    "joined_at": m.joined_at,
                })
            data["members"] = members
        return data

    # --- Organizaciones CRUD ---
    @app.get("/api/superadmin/organizations")
    def list_organizations(
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        orgs = db.query(OrganizationDB).order_by(OrganizationDB.name.asc()).all()
        return [_serialize_org(db, o) for o in orgs]

    @app.post("/api/superadmin/organizations")
    def create_organization(
        payload: OrganizationCreate,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        import secrets
        code = (payload.code or "").strip() or secrets.token_hex(4).upper()
        if db.query(OrganizationDB).filter(OrganizationDB.code == code).first():
            raise HTTPException(status_code=400, detail="Código de organización ya existe")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        org = OrganizationDB(
            name=payload.name.strip(),
            email=payload.email,
            phone=payload.phone,
            code=code,
            description=payload.description,
            status=payload.status,
            benefit_type=payload.benefit_type,
            benefit_value=payload.benefit_value,
            benefit_description=payload.benefit_description,
            eps_program=payload.eps_program,
            max_patients=payload.max_patients,
            max_nutritionists=payload.max_nutritionists,
            enabled_modules=payload.enabled_modules or DEFAULT_ENABLED_MODULES,
            logo_url=payload.logo_url,
            primary_color=payload.primary_color,
            contract_start=payload.contract_start,
            contract_end=payload.contract_end,
            sla_tier=payload.sla_tier or "standard",
            support_sla_hours=payload.support_sla_hours,
            is_sandbox=1 if payload.is_sandbox else 0,
            created_by_id=current_user.id,
            created_at=ts,
            updated_at=ts,
        )
        db.add(org)
        db.commit()
        db.refresh(org)
        log_audit(db, actor=current_user, action="create", entity_type="organization", entity_id=org.id,
                  organization_id=org.id, summary=f"Organización creada: {org.name}", now_co=now_co)
        db.commit()
        return _serialize_org(db, org)

    @app.get("/api/superadmin/organizations/contract-alerts")
    def organization_contract_alerts(
        days_ahead: int = 60,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        today = date.today()
        alerts = []
        for org in db.query(OrganizationDB).order_by(OrganizationDB.name.asc()).all():
            end_raw = getattr(org, "contract_end", None)
            start_raw = getattr(org, "contract_start", None)
            if end_raw:
                try:
                    end_date = datetime.strptime(str(end_raw)[:10], "%Y-%m-%d").date()
                    days_left = (end_date - today).days
                    if days_left < 0:
                        alerts.append({
                            "organization_id": org.id,
                            "organization_name": org.name,
                            "type": "expired",
                            "severity": "critical",
                            "message": "Contrato vencido",
                            "contract_end": end_raw,
                            "days_left": days_left,
                        })
                    elif days_left <= days_ahead:
                        sev = "high" if days_left <= 30 else "medium"
                        alerts.append({
                            "organization_id": org.id,
                            "organization_name": org.name,
                            "type": "expiring",
                            "severity": sev,
                            "message": f"Contrato vence en {days_left} días",
                            "contract_end": end_raw,
                            "days_left": days_left,
                        })
                except Exception:
                    pass
            if start_raw:
                try:
                    start_date = datetime.strptime(str(start_raw)[:10], "%Y-%m-%d").date()
                    if start_date > today:
                        alerts.append({
                            "organization_id": org.id,
                            "organization_name": org.name,
                            "type": "not_started",
                            "severity": "low",
                            "message": f"Contrato inicia en {(start_date - today).days} días",
                            "contract_start": start_raw,
                            "days_until_start": (start_date - today).days,
                        })
                except Exception:
                    pass
        alerts.sort(
            key=lambda a: (
                {"critical": 0, "high": 1, "medium": 2, "low": 3}.get(a["severity"], 9),
                a.get("days_left", 999),
            )
        )
        return {
            "generated_at": now_co().strftime("%Y-%m-%d %H:%M:%S"),
            "days_ahead": days_ahead,
            "total": len(alerts),
            "alerts": alerts,
        }

    @app.get("/api/superadmin/organizations/{org_id}")
    def get_organization(
        org_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        org = db.query(OrganizationDB).filter(OrganizationDB.id == org_id).first()
        if not org:
            raise HTTPException(status_code=404, detail="Organización no encontrada")
        return _serialize_org(db, org, include_members=True)

    @app.put("/api/superadmin/organizations/{org_id}")
    def update_organization(
        org_id: int,
        payload: OrganizationUpdate,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        org = db.query(OrganizationDB).filter(OrganizationDB.id == org_id).first()
        if not org:
            raise HTTPException(status_code=404, detail="Organización no encontrada")
        for field, val in payload.model_dump(exclude_unset=True).items():
            if val is not None and field != "code":
                if field == "enabled_modules":
                    setattr(org, field, val)
                elif field == "is_sandbox":
                    setattr(org, field, 1 if val else 0)
                elif isinstance(val, str):
                    setattr(org, field, val.strip())
                else:
                    setattr(org, field, val)
        if payload.code:
            existing = db.query(OrganizationDB).filter(OrganizationDB.code == payload.code, OrganizationDB.id != org_id).first()
            if existing:
                raise HTTPException(status_code=400, detail="Código ya en uso")
            org.code = payload.code.strip()
        org.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        log_audit(db, actor=current_user, action="update", entity_type="organization", entity_id=org.id,
                  organization_id=org.id, summary=f"Organización actualizada: {org.name}", now_co=now_co)
        db.commit()
        return _serialize_org(db, org)

    @app.delete("/api/superadmin/organizations/{org_id}")
    def delete_organization(
        org_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        org = db.query(OrganizationDB).filter(OrganizationDB.id == org_id).first()
        if not org:
            raise HTTPException(status_code=404, detail="Organización no encontrada")
        org_snapshot = {
            "id": org.id,
            "name": org.name,
            "code": org.code,
            "status": org.status,
            "eps_program": org.eps_program,
        }
        db.query(OrganizationMemberDB).filter(OrganizationMemberDB.organization_id == org_id).delete()
        db.query(OrganizationSiteDB).filter(OrganizationSiteDB.organization_id == org_id).delete()
        name = org.name
        db.delete(org)
        db.commit()
        log_audit(
            db,
            actor=current_user,
            action="delete",
            entity_type="organization",
            entity_id=org_id,
            organization_id=org_id,
            summary=f"Organización eliminada: {name}",
            details={"before": org_snapshot, "after": None},
            now_co=now_co,
        )
        db.commit()
        return {"success": True}

    @app.post("/api/superadmin/organizations/{org_id}/members")
    def add_org_member(
        org_id: int,
        payload: OrgMemberAdd,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        org = db.query(OrganizationDB).filter(OrganizationDB.id == org_id).first()
        if not org:
            raise HTTPException(status_code=404, detail="Organización no encontrada")
        user = db.query(UserDB).filter(UserDB.id == payload.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        _check_org_member_limit(db, org_id, user, UserDB, PatientMealPlanDB)
        existing = db.query(OrganizationMemberDB).filter(OrganizationMemberDB.user_id == payload.user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="El usuario ya pertenece a una organización")
        m = OrganizationMemberDB(
            organization_id=org_id,
            user_id=payload.user_id,
            site_id=payload.site_id,
            member_role=payload.member_role,
            status="activo",
            joined_at=now_co().strftime("%Y-%m-%d %H:%M:%S"),
            notes=payload.notes,
        )
        db.add(m)
        db.commit()
        return {"success": True, "membership_id": m.id}

    @app.delete("/api/superadmin/organizations/{org_id}/members/{user_id}")
    def remove_org_member(
        org_id: int,
        user_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        m = (
            db.query(OrganizationMemberDB)
            .filter(OrganizationMemberDB.organization_id == org_id, OrganizationMemberDB.user_id == user_id)
            .first()
        )
        if not m:
            raise HTTPException(status_code=404, detail="Miembro no encontrado")
        db.delete(m)
        db.commit()
        return {"success": True}

    # --- Sedes multi-sede ---
    @app.get("/api/superadmin/organizations/{org_id}/sites")
    def list_sites(
        org_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        sites = db.query(OrganizationSiteDB).filter(OrganizationSiteDB.organization_id == org_id).all()
        result = []
        for s in sites:
            nutri_count = (
                db.query(OrganizationMemberDB)
                .join(UserDB, UserDB.id == OrganizationMemberDB.user_id)
                .filter(
                    OrganizationMemberDB.site_id == s.id,
                    OrganizationMemberDB.status == "activo",
                    UserDB.role == "admin",
                )
                .count()
            )
            result.append({
                "id": s.id,
                "organization_id": s.organization_id,
                "name": s.name,
                "address": s.address,
                "city": s.city,
                "phone": s.phone,
                "status": s.status,
                "nutritionists_count": nutri_count,
                "created_at": s.created_at,
            })
        return result

    @app.post("/api/superadmin/organizations/{org_id}/sites")
    def create_site(
        org_id: int,
        payload: SiteCreate,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        site = OrganizationSiteDB(
            organization_id=org_id,
            name=payload.name.strip(),
            address=payload.address,
            city=payload.city,
            phone=payload.phone,
            status=payload.status,
            created_at=ts,
            updated_at=ts,
        )
        db.add(site)
        db.commit()
        db.refresh(site)
        return {"id": site.id, "name": site.name}

    @app.put("/api/superadmin/organizations/{org_id}/sites/{site_id}")
    def update_site(
        org_id: int,
        site_id: int,
        payload: SiteUpdate,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        site = (
            db.query(OrganizationSiteDB)
            .filter(OrganizationSiteDB.id == site_id, OrganizationSiteDB.organization_id == org_id)
            .first()
        )
        if not site:
            raise HTTPException(status_code=404, detail="Sede no encontrada")
        for field, val in payload.model_dump(exclude_unset=True).items():
            if val is not None:
                setattr(site, field, val.strip() if isinstance(val, str) else val)
        site.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        return {"success": True}

    @app.delete("/api/superadmin/organizations/{org_id}/sites/{site_id}")
    def delete_site(
        org_id: int,
        site_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        site = (
            db.query(OrganizationSiteDB)
            .filter(OrganizationSiteDB.id == site_id, OrganizationSiteDB.organization_id == org_id)
            .first()
        )
        if not site:
            raise HTTPException(status_code=404, detail="Sede no encontrada")
        db.query(OrganizationMemberDB).filter(OrganizationMemberDB.site_id == site_id).update({"site_id": None})
        db.delete(site)
        db.commit()
        return {"success": True}

    # --- Códigos de beneficio ---
    @app.get("/api/superadmin/organizations/{org_id}/benefit-codes")
    def list_benefit_codes(
        org_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        org = db.query(OrganizationDB).filter(OrganizationDB.id == org_id).first()
        if not org:
            raise HTTPException(status_code=404, detail="Organización no encontrada")
        rows = (
            db.query(OrganizationBenefitCodeDB)
            .filter(OrganizationBenefitCodeDB.organization_id == org_id)
            .order_by(OrganizationBenefitCodeDB.id.desc())
            .all()
        )
        return [_serialize_benefit_code(r, org.name) for r in rows]

    @app.post("/api/superadmin/organizations/{org_id}/benefit-codes")
    def create_benefit_code(
        org_id: int,
        payload: BenefitCodeCreate,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        org = db.query(OrganizationDB).filter(OrganizationDB.id == org_id).first()
        if not org:
            raise HTTPException(status_code=404, detail="Organización no encontrada")
        code = payload.code.strip().upper()
        if db.query(OrganizationBenefitCodeDB).filter(OrganizationBenefitCodeDB.code == code).first():
            raise HTTPException(status_code=400, detail="Código ya existe")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        row = OrganizationBenefitCodeDB(
            organization_id=org_id,
            code=code,
            label=payload.label,
            benefit_type=payload.benefit_type,
            benefit_value=payload.benefit_value,
            benefit_description=payload.benefit_description,
            max_uses=payload.max_uses,
            uses_count=0,
            expires_at=payload.expires_at,
            status=payload.status,
            created_at=ts,
            updated_at=ts,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        log_audit(
            db, actor=current_user, action="create", entity_type="benefit_code",
            entity_id=row.id, organization_id=org_id,
            summary=f"Código beneficio creado: {code} ({org.name})",
            now_co=now_co,
        )
        db.commit()
        return _serialize_benefit_code(row, org.name)

    @app.put("/api/superadmin/organizations/{org_id}/benefit-codes/{code_id}")
    def update_benefit_code(
        org_id: int,
        code_id: int,
        payload: BenefitCodeUpdate,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        row = (
            db.query(OrganizationBenefitCodeDB)
            .filter(OrganizationBenefitCodeDB.id == code_id, OrganizationBenefitCodeDB.organization_id == org_id)
            .first()
        )
        if not row:
            raise HTTPException(status_code=404, detail="Código no encontrado")
        for field, val in payload.model_dump(exclude_unset=True).items():
            if val is not None:
                setattr(row, field, val)
        row.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        org = db.query(OrganizationDB).filter(OrganizationDB.id == org_id).first()
        return _serialize_benefit_code(row, org.name if org else None)

    @app.delete("/api/superadmin/organizations/{org_id}/benefit-codes/{code_id}")
    def delete_benefit_code(
        org_id: int,
        code_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        row = (
            db.query(OrganizationBenefitCodeDB)
            .filter(OrganizationBenefitCodeDB.id == code_id, OrganizationBenefitCodeDB.organization_id == org_id)
            .first()
        )
        if not row:
            raise HTTPException(status_code=404, detail="Código no encontrado")
        db.delete(row)
        db.commit()
        return {"success": True}

    def _require_org_admin_access(db: Session, current_user, organization_id: Optional[int] = None) -> int:
        if current_user.role == "superadmin":
            if not organization_id:
                raise HTTPException(status_code=400, detail="organization_id requerido para superadmin")
            return organization_id
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="No autorizado")
        role = get_staff_role(db, current_user, AdminProfileDB)
        if role != "org_admin":
            raise HTTPException(status_code=403, detail="Solo admin EPS puede acceder")
        org_id = get_user_organization_id(db, current_user.id)
        if not org_id:
            raise HTTPException(status_code=403, detail="Sin organización asignada")
        if organization_id and organization_id != org_id:
            raise HTTPException(status_code=403, detail="Organización no permitida")
        return org_id

    @app.get("/api/org/branding")
    def get_org_branding(
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        org_id = None
        if current_user.role == "patient":
            org_id = get_user_organization_id(db, current_user.id)
        elif current_user.role == "admin":
            org_id = get_user_organization_id(db, current_user.id)
            if not org_id:
                prof = db.query(AdminProfileDB).filter(AdminProfileDB.user_id == current_user.id).first()
                org_id = getattr(prof, "organization_id", None) if prof else None
        if not org_id:
            return {"branding": None}
        org = db.query(OrganizationDB).filter(OrganizationDB.id == org_id).first()
        if not org:
            return {"branding": None}
        return {
            "branding": {
                "organization_id": org.id,
                "name": org.name,
                "logo_url": getattr(org, "logo_url", None),
                "primary_color": getattr(org, "primary_color", None) or "#6366f1",
                "eps_program": org.eps_program,
            }
        }

    @app.get("/api/org/dashboard")
    def org_eps_dashboard(
        organization_id: Optional[int] = None,
        db: Session = Depends(get_db),
        current_user=Depends(require_admin_or_superadmin),
    ):
        org_id = _require_org_admin_access(db, current_user, organization_id)
        org = db.query(OrganizationDB).filter(OrganizationDB.id == org_id).first()
        if not org:
            raise HTTPException(status_code=404, detail="Organización no encontrada")

        health = _build_tenant_health_payload(db, organization_id=org_id)
        org_row = health["organizations"][0] if health.get("organizations") else None
        patient_ids = _org_patient_ids(db, org_id, UserDB)
        today = today_co()
        month_start = today.replace(day=1)
        month_str = month_start.strftime("%Y-%m-%d")

        appts_month = 0
        if patient_ids:
            appts_month = (
                db.query(AppointmentDB)
                .filter(AppointmentDB.patient_id.in_(patient_ids), AppointmentDB.date >= month_str)
                .count()
            )

        recent_patients = []
        if patient_ids:
            for u in (
                db.query(UserDB)
                .filter(UserDB.id.in_(patient_ids))
                .order_by(UserDB.created_at.desc())
                .limit(5)
                .all()
            ):
                recent_patients.append({
                    "id": u.id,
                    "name": f"{u.nombres} {u.apellidos}",
                    "email": u.email,
                    "joined": u.created_at,
                })

        upcoming = []
        if patient_ids:
            appt_rows = (
                db.query(AppointmentDB)
                .filter(
                    AppointmentDB.patient_id.in_(patient_ids),
                    AppointmentDB.date >= today.strftime("%Y-%m-%d"),
                    AppointmentDB.status != "cancelada",
                )
                .order_by(AppointmentDB.date.asc(), AppointmentDB.time.asc())
                .limit(8)
                .all()
            )
            for a in appt_rows:
                p = db.query(UserDB).filter(UserDB.id == a.patient_id).first()
                upcoming.append({
                    "id": a.id,
                    "patient_name": f"{p.nombres} {p.apellidos}" if p else "Paciente",
                    "date": a.date,
                    "time": a.time,
                    "type": a.type,
                    "status": a.status,
                })

        counts = _org_counts(db, org_id, UserDB, PatientMealPlanDB)
        benefit_codes = [
            _serialize_benefit_code(r, org.name)
            for r in db.query(OrganizationBenefitCodeDB)
            .filter(OrganizationBenefitCodeDB.organization_id == org_id)
            .order_by(OrganizationBenefitCodeDB.id.desc())
            .limit(10)
            .all()
        ]

        return {
            "generated_at": now_co().strftime("%Y-%m-%d %H:%M:%S"),
            "organization": _serialize_org(db, org),
            "summary": health.get("summary", {}),
            "org_metrics": org_row,
            "kpis": {
                "patients": counts["patients_count"],
                "nutritionists": counts["nutritionists_count"],
                "sites": counts["sites_count"],
                "active_plans": counts["active_plans"],
                "appointments_month": appts_month,
                "health_score": org_row.get("health_score") if org_row else 0,
                "adherence_score": org_row.get("adherence_score") if org_row else 0,
            },
            "recent_patients": recent_patients,
            "upcoming_appointments": upcoming,
            "benefit_codes": benefit_codes,
            "module_usage": health.get("module_usage", {}),
        }

    # --- Paciente: afiliación organización ---
    @app.get("/api/organizations/me")
    def get_my_organization(
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        if current_user.role != "patient":
            raise HTTPException(status_code=403, detail="Solo pacientes")
        org_id = get_user_organization_id(db, current_user.id)
        if not org_id:
            return {"organization": None}
        org = db.query(OrganizationDB).filter(OrganizationDB.id == org_id).first()
        if not org:
            return {"organization": None}
        counts = _org_counts(db, org.id, UserDB, PatientMealPlanDB)
        return {
            "organization": {
                "id": org.id,
                "name": org.name,
                "code": org.code,
                "benefit_label": _benefit_label(org),
                "benefit_type": org.benefit_type,
                "benefit_value": org.benefit_value,
                "eps_program": org.eps_program,
                "logo_url": getattr(org, "logo_url", None),
                "primary_color": getattr(org, "primary_color", None),
                **_org_contract_payload(org, counts),
            }
        }

    @app.post("/api/organizations/join")
    def join_organization(
        payload: OrgJoinBody,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        if current_user.role != "patient":
            raise HTTPException(status_code=403, detail="Solo pacientes pueden afiliarse")
        existing = db.query(OrganizationMemberDB).filter(OrganizationMemberDB.user_id == current_user.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Ya perteneces a una organización")
        org, benefit_code = _resolve_join_code(db, payload.code)
        if org.status != "activo":
            raise HTTPException(status_code=400, detail="Organización inactiva")
        _check_org_member_limit(db, org.id, current_user, UserDB, PatientMealPlanDB)
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.add(OrganizationMemberDB(
            organization_id=org.id,
            user_id=current_user.id,
            member_role="member",
            status="activo",
            joined_at=ts,
            notes=f"benefit_code:{benefit_code.code}" if benefit_code else "org_code",
        ))
        if benefit_code:
            benefit_code.uses_count = (benefit_code.uses_count or 0) + 1
            benefit_code.updated_at = ts
        if getattr(org, "eps_program", None):
            current_user.programa_eps = org.eps_program
        db.commit()
        counts = _org_counts(db, org.id, UserDB, PatientMealPlanDB)
        benefit_label = _benefit_code_label(benefit_code) if benefit_code else _benefit_label(org)
        return {
            "success": True,
            "message": f"Afiliado a {org.name}",
            "organization": {
                "id": org.id,
                "name": org.name,
                "code": org.code,
                "benefit_label": benefit_label,
                "benefit_type": benefit_code.benefit_type if benefit_code else org.benefit_type,
                "logo_url": getattr(org, "logo_url", None),
                "primary_color": getattr(org, "primary_color", None),
                **_org_contract_payload(org, counts),
            },
        }

    @app.delete("/api/organizations/me")
    def leave_organization(
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        if current_user.role != "patient":
            raise HTTPException(status_code=403, detail="Solo pacientes")
        m = db.query(OrganizationMemberDB).filter(OrganizationMemberDB.user_id == current_user.id).first()
        if not m:
            raise HTTPException(status_code=404, detail="No perteneces a ninguna organización")
        db.delete(m)
        db.commit()
        return {"success": True, "message": "Saliste de la organización"}

    # --- Dashboard analytics (KPIs, heatmap, alertas, MOM) ---
    @app.get("/api/superadmin/dashboard/analytics")
    def superadmin_dashboard_analytics(
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        today = today_co()
        since_7 = today - timedelta(days=7)
        since_30 = today - timedelta(days=30)
        since_60 = today - timedelta(days=60)

        this_month = _month_start(today)
        prev_month = _prev_month_start(today)
        this_month_str = this_month.strftime("%Y-%m-%d")
        prev_month_str = prev_month.strftime("%Y-%m-%d")

        all_patient_ids = [
            r[0]
            for r in db.query(UserDB.id)
            .filter(UserDB.role == "patient", UserDB.status == "activo")
            .all()
        ]

        active_7 = _active_patient_ids(db, MealTrackingDB, AppointmentDB, since_7)
        active_30 = _active_patient_ids(db, MealTrackingDB, AppointmentDB, since_30)
        prev_period_active = _active_patient_ids(db, MealTrackingDB, AppointmentDB, since_60, since_30)
        churned_ids = prev_period_active - active_30
        churn_rate = round((len(churned_ids) / len(prev_period_active)) * 100, 1) if prev_period_active else 0.0

        new_regs_this = _users_created_since(db, UserDB, this_month_str)
        new_regs_prev = (
            db.query(UserDB)
            .filter(UserDB.created_at >= prev_month_str, UserDB.created_at < this_month_str)
            .count()
        )
        new_patients_this = (
            db.query(UserDB)
            .filter(UserDB.role == "patient", UserDB.created_at >= this_month_str)
            .count()
        )
        new_patients_prev = (
            db.query(UserDB)
            .filter(
                UserDB.role == "patient",
                UserDB.created_at >= prev_month_str,
                UserDB.created_at < this_month_str,
            )
            .count()
        )

        week_start = today - timedelta(days=today.weekday())
        prev_week_start = week_start - timedelta(days=7)
        prev_week_end = week_start - timedelta(days=1)

        adherence_this_week = _adherence_pct_for_patients(
            db, MealTrackingDB, all_patient_ids, week_start, today
        )
        adherence_prev_week = _adherence_pct_for_patients(
            db, MealTrackingDB, all_patient_ids, prev_week_start, prev_week_end
        )
        adherence_drop_pp = adherence_prev_week - adherence_this_week

        # Mapa de calor por organización/EPS
        heatmap = []
        max_activity = 1
        org_rows_raw = []
        for org in db.query(OrganizationDB).order_by(OrganizationDB.name.asc()).all():
            counts = _org_counts(db, org.id, UserDB, PatientMealPlanDB)
            patient_ids = _org_patient_ids(db, org.id, UserDB)
            active_org_30 = len(
                _active_patient_ids(db, MealTrackingDB, AppointmentDB, since_30) & set(patient_ids)
            )
            patients_n = counts["patients_count"] or 0
            activity_score = int((active_org_30 / patients_n) * 100) if patients_n else 0
            org_adherence = _adherence_pct_for_patients(
                db, MealTrackingDB, patient_ids, week_start, today
            )
            max_activity = max(max_activity, activity_score)
            org_rows_raw.append({
                "org_id": org.id,
                "name": org.name,
                "code": org.code,
                "eps_program": org.eps_program,
                "status": org.status,
                "patients": patients_n,
                "nutritionists": counts["nutritionists_count"],
                "active_patients_30d": active_org_30,
                "activity_score": activity_score,
                "adherence_pct": org_adherence,
            })

        for row in org_rows_raw:
            intensity = round(row["activity_score"] / max(max_activity, 1), 2)
            heatmap.append({**row, "intensity": intensity})

        # Alertas críticas
        alerts = []
        for row in org_rows_raw:
            if row["patients"] > 0 and row["nutritionists"] == 0:
                alerts.append({
                    "severity": "critical",
                    "type": "no_nutritionist",
                    "title": "Organización sin nutricionista",
                    "message": f"{row['name']} tiene {row['patients']} paciente(s) sin nutricionista asignado en la org.",
                    "org_id": row["org_id"],
                    "org_name": row["name"],
                })
            elif row["status"] == "activo" and row["patients"] == 0 and row["nutritionists"] == 0:
                alerts.append({
                    "severity": "warning",
                    "type": "empty_org",
                    "title": "Organización vacía",
                    "message": f"{row['name']} no tiene pacientes ni nutricionistas activos.",
                    "org_id": row["org_id"],
                    "org_name": row["name"],
                })

        unassigned_patients = (
            db.query(UserDB)
            .filter(
                UserDB.role == "patient",
                UserDB.status == "activo",
                UserDB.nutritionist_id.is_(None),
            )
            .count()
        )
        if unassigned_patients > 0:
            alerts.append({
                "severity": "warning",
                "type": "unassigned_patients",
                "title": "Pacientes sin nutricionista",
                "message": f"{unassigned_patients} paciente(s) activo(s) sin nutricionista asignado.",
                "count": unassigned_patients,
            })

        if adherence_drop_pp >= 5:
            alerts.append({
                "severity": "critical",
                "type": "adherence_drop",
                "title": "Caída de adherencia global",
                "message": (
                    f"La adherencia bajó {adherence_drop_pp} pp "
                    f"({adherence_prev_week}% → {adherence_this_week}%) respecto a la semana anterior."
                ),
                "previous_pct": adherence_prev_week,
                "current_pct": adherence_this_week,
            })
        elif adherence_this_week < 50 and all_patient_ids:
            alerts.append({
                "severity": "warning",
                "type": "low_adherence",
                "title": "Adherencia global baja",
                "message": f"Adherencia semanal global en {adherence_this_week}% (meta recomendada ≥ 70%).",
                "current_pct": adherence_this_week,
            })

        inactive_orgs = [r for r in org_rows_raw if r["status"] == "activo" and r["patients"] == 0]
        if len(inactive_orgs) >= 3:
            alerts.append({
                "severity": "info",
                "type": "orgs_no_patients",
                "title": "Organizaciones sin pacientes",
                "message": f"{len(inactive_orgs)} organización(es) activa(s) sin pacientes registrados.",
                "count": len(inactive_orgs),
            })

        # Comparativa mes vs mes (MOM)
        active_30_prev_window = len(
            _active_patient_ids(db, MealTrackingDB, AppointmentDB, since_60, since_30)
        )
        mom = {
            "new_registrations": _pct_change_label(new_regs_this, new_regs_prev),
            "new_patients": _pct_change_label(new_patients_this, new_patients_prev),
            "active_patients_30d": _pct_change_label(len(active_30), active_30_prev_window),
            "total_users": _pct_change_label(
                _users_created_since(db, UserDB, this_month_str),
                db.query(UserDB)
                .filter(UserDB.created_at >= prev_month_str, UserDB.created_at < this_month_str)
                .count(),
            ),
        }

        # Serie mensual real (6 meses) para gráficos
        monthly_series = []
        for i in range(5, -1, -1):
            ref = this_month
            for _ in range(i):
                ref = _prev_month_start(ref)
            next_m = (ref.replace(day=28) + timedelta(days=4)).replace(day=1)
            ref_str = ref.strftime("%Y-%m-%d")
            next_str = next_m.strftime("%Y-%m-%d")
            regs = (
                db.query(UserDB)
                .filter(UserDB.created_at >= ref_str, UserDB.created_at < next_str)
                .count()
            )
            month_names = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
            monthly_series.append({
                "name": month_names[ref.month - 1],
                "year": ref.year,
                "registrations": regs,
                "patients": (
                    db.query(UserDB)
                    .filter(
                        UserDB.role == "patient",
                        UserDB.created_at >= ref_str,
                        UserDB.created_at < next_str,
                    )
                    .count()
                ),
            })

        total_orgs = db.query(OrganizationDB).count()
        orgs_this = (
            db.query(OrganizationDB)
            .filter(OrganizationDB.created_at >= this_month_str)
            .count()
            if hasattr(OrganizationDB, "created_at")
            else 0
        )

        return {
            "generated_at": now_co().strftime("%Y-%m-%d %H:%M:%S"),
            "kpis": {
                "active_users_7d": {
                    "value": len(active_7),
                    "label": "Pacientes activos (7 días)",
                    "description": "Con registro de comidas o cita en los últimos 7 días",
                },
                "active_users_30d": {
                    "value": len(active_30),
                    "label": "Pacientes activos (30 días)",
                    "description": "Con actividad en los últimos 30 días",
                },
                "new_registrations_month": {
                    "value": new_regs_this,
                    "label": "Nuevos registros (mes)",
                    "mom": mom["new_registrations"],
                },
                "patient_churn": {
                    "value": len(churned_ids),
                    "rate_pct": churn_rate,
                    "label": "Churn pacientes (30 días)",
                    "description": "Activos hace 30-60 días sin actividad en los últimos 30 días",
                },
                "global_adherence_week": {
                    "value": adherence_this_week,
                    "previous_week": adherence_prev_week,
                    "change_pp": adherence_this_week - adherence_prev_week,
                    "label": "Adherencia global (semana)",
                },
            },
            "mom_comparison": mom,
            "org_heatmap": heatmap,
            "critical_alerts": alerts,
            "charts": {
                "monthly_registrations": monthly_series,
            },
            "summary": {
                "total_users": db.query(UserDB).count(),
                "total_patients": len(all_patient_ids),
                "total_nutritionists": db.query(UserDB).filter(UserDB.role == "admin").count(),
                "total_organizations": total_orgs,
                "new_orgs_this_month": orgs_this,
            },
        }

    # --- Panel salud del tenant ---
    def _build_tenant_health_payload(
        db: Session,
        eps_program: Optional[str] = None,
        city: Optional[str] = None,
        plan_type: Optional[str] = None,
        organization_id: Optional[int] = None,
    ) -> dict:
        today = today_co()
        month_start = today.replace(day=1)
        since_30 = today - timedelta(days=30)
        week_start = today - timedelta(days=today.weekday())

        active_nutritionists = db.query(UserDB).filter(UserDB.role == "admin", UserDB.status == "activo").count()
        total_orgs_all = db.query(OrganizationDB).count()

        org_query = db.query(OrganizationDB).order_by(OrganizationDB.name.asc())
        if organization_id:
            org_query = org_query.filter(OrganizationDB.id == organization_id)
        if eps_program:
            org_query = org_query.filter(OrganizationDB.eps_program.ilike(f"%{eps_program}%"))

        org_list = org_query.all()
        if city:
            city_lower = city.strip().lower()
            org_list = [
                o for o in org_list
                if any(c.lower().find(city_lower) >= 0 for c in _org_cities(db, o.id))
            ]

        org_rows = []
        all_filtered_patient_ids: list = []
        total_at_risk = 0
        total_high_risk = 0
        abandonment_scores: list = []

        for org in org_list:
            counts = _org_counts(db, org.id, UserDB, PatientMealPlanDB)
            patient_ids = _org_patient_ids(db, org.id, UserDB)
            if plan_type:
                patient_ids = _patient_matches_plan_filter(
                    db, patient_ids, plan_type, PatientMealPlanDB, MealPlanDB
                )
            if plan_type and not patient_ids and counts["patients_count"] > 0:
                continue

            patients_n = len(patient_ids) if plan_type else counts["patients_count"]
            all_filtered_patient_ids.extend(patient_ids)

            active_set = _active_patient_ids(db, MealTrackingDB, AppointmentDB, since_30)
            active_org_30 = len(active_set & set(patient_ids))
            activity_pct = int((active_org_30 / patients_n) * 100) if patients_n else 0

            adherence_pct = _adherence_pct_for_patients(
                db, MealTrackingDB, patient_ids, week_start, today
            )

            appts_month = 0
            if patient_ids:
                appts_month = (
                    db.query(AppointmentDB)
                    .filter(
                        AppointmentDB.patient_id.in_(patient_ids),
                        AppointmentDB.date >= month_start,
                        AppointmentDB.status != "cancelada",
                    )
                    .count()
                )
            meal_logs_30d = 0
            if patient_ids:
                meal_logs_30d = (
                    db.query(MealTrackingDB)
                    .filter(
                        MealTrackingDB.patient_id.in_(patient_ids),
                        MealTrackingDB.date >= since_30,
                    )
                    .count()
                )

            appts_per_patient = appts_month / patients_n if patients_n else 0
            logs_per_patient = meal_logs_30d / patients_n if patients_n else 0
            health = _compute_health_score(activity_pct, adherence_pct, appts_per_patient, logs_per_patient)

            org_abandonment = []
            at_risk = 0
            high_risk = 0
            for pid in patient_ids:
                patient = db.query(UserDB).filter(UserDB.id == pid).first()
                if not patient:
                    continue
                risk = _abandonment_score_patient(
                    patient, db, today, MealTrackingDB, AppointmentDB, PatientMealPlanDB
                )
                org_abandonment.append(risk["score"])
                if risk["score"] >= 35:
                    at_risk += 1
                if risk["score"] >= 60:
                    high_risk += 1

            avg_abandonment = (
                round(sum(org_abandonment) / len(org_abandonment), 1) if org_abandonment else 0
            )
            total_at_risk += at_risk
            total_high_risk += high_risk
            abandonment_scores.extend(org_abandonment)

            dominant_plans: dict = {}
            if patient_ids:
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
                    dominant_plans[tipo or "adulto"] = cnt

            org_rows.append({
                "id": org.id,
                "name": org.name,
                "code": org.code,
                "status": org.status,
                "eps_program": org.eps_program,
                "cities": _org_cities(db, org.id),
                "patients_count": patients_n,
                "nutritionists_count": counts["nutritionists_count"],
                "sites_count": counts["sites_count"],
                "active_plans": counts["active_plans"],
                "active_patients_30d": active_org_30,
                "appointments_month": appts_month,
                "meal_logs_30d": meal_logs_30d,
                "dominant_plans": dominant_plans,
                **health,
                "abandonment": {
                    "avg_score": avg_abandonment,
                    "patients_at_risk": at_risk,
                    "patients_high_risk": high_risk,
                    "risk_rate_pct": round((at_risk / patients_n) * 100, 1) if patients_n else 0,
                },
            })

        filtered_patient_ids_unique = list(set(all_filtered_patient_ids))
        if not org_list and not organization_id:
            filtered_patient_ids_unique = [
                r[0]
                for r in db.query(UserDB.id)
                .filter(UserDB.role == "patient", UserDB.status == "activo")
                .all()
            ]

        total_patients = len(filtered_patient_ids_unique) if (eps_program or city or plan_type or organization_id) else (
            db.query(UserDB).filter(UserDB.role == "patient", UserDB.status == "activo").count()
        )

        appointments_month = (
            db.query(AppointmentDB)
            .filter(AppointmentDB.date >= month_start, AppointmentDB.status != "cancelada")
            .count()
        )
        if filtered_patient_ids_unique and (eps_program or city or plan_type or organization_id):
            appointments_month = (
                db.query(AppointmentDB)
                .filter(
                    AppointmentDB.patient_id.in_(filtered_patient_ids_unique),
                    AppointmentDB.date >= month_start,
                    AppointmentDB.status != "cancelada",
                )
                .count()
            )

        meal_logs = db.query(MealTrackingDB).filter(MealTrackingDB.date >= since_30).count()
        patients_tracking = (
            db.query(MealTrackingDB.patient_id).filter(MealTrackingDB.date >= since_30).distinct().count()
        )
        patients_clinical = (
            db.query(UserDB)
            .filter(UserDB.role == "patient", UserDB.examenes_bioquimicos.isnot(None))
            .count()
        )
        specialty_counts = {}
        for tipo, cnt in (
            db.query(MealPlanDB.tipo, func.count(MealPlanDB.id))
            .filter(MealPlanDB.tipo.isnot(None), MealPlanDB.tipo != "adulto")
            .group_by(MealPlanDB.tipo)
            .all()
        ):
            specialty_counts[tipo or "adulto"] = cnt

        sites = []
        site_query = db.query(OrganizationSiteDB)
        if organization_id:
            site_query = site_query.filter(OrganizationSiteDB.organization_id == organization_id)
        if city:
            site_query = site_query.filter(OrganizationSiteDB.city.ilike(f"%{city}%"))
        org_ids_filtered = {o.id for o in org_list}

        for s in site_query.all():
            if org_ids_filtered and s.organization_id not in org_ids_filtered:
                continue
            org = db.query(OrganizationDB).filter(OrganizationDB.id == s.organization_id).first()
            nutris = (
                db.query(OrganizationMemberDB)
                .join(UserDB, UserDB.id == OrganizationMemberDB.user_id)
                .filter(
                    OrganizationMemberDB.site_id == s.id,
                    UserDB.role == "admin",
                    OrganizationMemberDB.status == "activo",
                )
                .all()
            )
            sites.append({
                "id": s.id,
                "name": s.name,
                "organization": org.name if org else None,
                "organization_id": s.organization_id,
                "city": s.city,
                "nutritionists_count": len(nutris),
            })

        staff_breakdown = {}
        for role_key in STAFF_ROLES:
            staff_breakdown[role_key] = {
                "label": STAFF_ROLES[role_key]["label"],
                "count": db.query(AdminProfileDB).filter(AdminProfileDB.staff_role == role_key).count()
                if hasattr(AdminProfileDB, "staff_role")
                else (active_nutritionists if role_key == "nutritionist" else 0),
            }

        avg_health = (
            round(sum(o["health_score"] for o in org_rows) / len(org_rows), 1) if org_rows else 0
        )
        platform_abandonment = (
            round(sum(abandonment_scores) / len(abandonment_scores), 1) if abandonment_scores else 0
        )

        eps_options = sorted({
            o.eps_program for o in db.query(OrganizationDB).all()
            if o.eps_program
        })
        city_options = sorted({
            s.city for s in db.query(OrganizationSiteDB).all()
            if s.city
        })

        return {
            "generated_at": now_co().strftime("%Y-%m-%d %H:%M:%S"),
            "filters_applied": {
                "eps_program": eps_program,
                "city": city,
                "plan_type": plan_type,
                "organization_id": organization_id,
            },
            "filter_options": {
                "eps_programs": eps_options,
                "cities": city_options,
                "plan_types": [{"value": k, "label": v} for k, v in PLAN_TIPO_LABELS.items()],
                "organizations": [
                    {"id": o.id, "name": o.name}
                    for o in db.query(OrganizationDB).order_by(OrganizationDB.name.asc()).all()
                ],
            },
            "summary": {
                "active_nutritionists": active_nutritionists,
                "total_patients": total_patients,
                "total_organizations": len(org_rows) if (eps_program or city or plan_type) else total_orgs_all,
                "appointments_this_month": appointments_month,
                "total_sites": len(sites),
                "avg_health_score": avg_health,
                "platform_abandonment_score": platform_abandonment,
                "patients_at_risk": total_at_risk,
                "patients_high_risk": total_high_risk,
            },
            "organizations": org_rows,
            "module_usage": {
                "appointments": {"events_30d": appointments_month, "label": MODULE_LABELS["appointments"]},
                "meal_tracking": {
                    "patients_active_30d": patients_tracking,
                    "logs_30d": meal_logs,
                    "label": MODULE_LABELS["meal_tracking"],
                },
                "clinical_colombia": {
                    "patients_with_labs": patients_clinical,
                    "label": MODULE_LABELS["clinical_colombia"],
                },
                "specialty_plans": {"by_type": specialty_counts, "label": MODULE_LABELS["specialty_plans"]},
            },
            "sites": sites,
            "staff_roles": staff_breakdown,
        }

    def _tenant_health_export_csv(payload: dict) -> str:
        import csv
        from io import StringIO

        output = StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Organización", "Código", "EPS/Programa", "Ciudades", "Pacientes", "Nutricionistas",
            "Score salud", "Actividad %", "Adherencia %", "Citas mes", "Logs comidas 30d",
            "Abandono prom.", "En riesgo", "Alto riesgo", "Tasa riesgo %",
        ])
        for o in payload["organizations"]:
            writer.writerow([
                o["name"],
                o.get("code", ""),
                o.get("eps_program") or "",
                "; ".join(o.get("cities") or []),
                o["patients_count"],
                o["nutritionists_count"],
                o["health_score"],
                o["activity_score"],
                o["adherence_score"],
                o.get("appointments_month", 0),
                o.get("meal_logs_30d", 0),
                o["abandonment"]["avg_score"],
                o["abandonment"]["patients_at_risk"],
                o["abandonment"]["patients_high_risk"],
                o["abandonment"]["risk_rate_pct"],
            ])
        return output.getvalue()

    def _tenant_health_export_pdf(payload: dict) -> bytes:
        from io import BytesIO
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        from reportlab.lib import colors

        buffer = BytesIO()
        width, height = A4
        c = canvas.Canvas(buffer, pagesize=A4)
        primary = colors.HexColor("#7a9b76")
        y = height - 50
        c.setFillColor(primary)
        c.setFont("Helvetica-Bold", 16)
        c.drawString(50, y, "NutriData — Salud del tenant")
        y -= 22
        c.setFillColor(colors.black)
        c.setFont("Helvetica", 9)
        s = payload["summary"]
        f = payload.get("filters_applied") or {}
        filt_parts = [f"{k}={v}" for k, v in f.items() if v]
        c.drawString(50, y, f"Generado: {payload['generated_at']}" + (f" | Filtros: {', '.join(filt_parts)}" if filt_parts else ""))
        y -= 16
        c.drawString(
            50, y,
            f"Orgs: {s['total_organizations']} | Pacientes: {s['total_patients']} | "
            f"Salud prom: {s['avg_health_score']} | Abandono prom: {s['platform_abandonment_score']} | "
            f"En riesgo: {s['patients_at_risk']}",
        )
        y -= 24
        c.setFont("Helvetica-Bold", 8)
        c.drawString(50, y, "Organización")
        c.drawString(200, y, "Salud")
        c.drawString(240, y, "Adher.")
        c.drawString(280, y, "Abandono")
        c.drawString(340, y, "Riesgo")
        y -= 12
        c.setFont("Helvetica", 8)
        for o in payload["organizations"]:
            if y < 60:
                c.showPage()
                y = height - 50
            c.drawString(50, y, str(o["name"])[:22])
            c.drawString(200, y, str(o["health_score"]))
            c.drawString(240, y, f"{o['adherence_score']}%")
            c.drawString(280, y, str(o["abandonment"]["avg_score"]))
            c.drawString(340, y, f"{o['abandonment']['patients_at_risk']}/{o['patients_count']}")
            y -= 11
        c.save()
        buffer.seek(0)
        return buffer.getvalue()

    def _parse_org_date(raw: Optional[str]) -> Optional[date]:
        if not raw:
            return None
        try:
            return datetime.strptime(str(raw)[:10], "%Y-%m-%d").date()
        except Exception:
            return None

    def _compute_org_churn_risk(org, health_row: Optional[dict], subscription_status: Optional[str]) -> dict:
        score = 0
        factors: list = []
        today = date.today()
        end_date = _parse_org_date(getattr(org, "contract_end", None))
        if end_date:
            days_left = (end_date - today).days
            if days_left <= 0:
                score += 35
                factors.append("Contrato vencido")
            elif days_left <= 30:
                score += 25
                factors.append(f"Contrato vence en {days_left} días")
            elif days_left <= 90:
                score += 10
                factors.append(f"Contrato vence en {days_left} días")
        if subscription_status == "past_due":
            score += 30
            factors.append("Suscripción en mora")
        elif subscription_status == "cancelled":
            score += 40
            factors.append("Suscripción cancelada")
        elif subscription_status == "blocked":
            score += 35
            factors.append("Suscripción bloqueada")
        if health_row:
            if health_row.get("activity_score", 100) < 40:
                score += 15
                factors.append("Baja actividad de pacientes")
            if health_row.get("adherence_score", 100) < 50:
                score += 10
                factors.append("Baja adherencia promedio")
            ab = health_row.get("abandonment") or {}
            if ab.get("risk_rate_pct", 0) > 40:
                score += 15
                factors.append("Alto índice de abandono")
            if health_row.get("health_score", 100) < 50:
                score += 10
                factors.append("Score de salud bajo")
        if org.status != "activo":
            score += 20
            factors.append("Organización inactiva")
        score = min(100, score)
        level = "critical" if score >= 70 else "high" if score >= 50 else "medium" if score >= 30 else "low"
        return {
            "churn_risk_score": score,
            "churn_risk_level": level,
            "churn_factors": factors,
        }

    @app.get("/api/superadmin/tenant-health/churn-risk")
    def tenant_health_churn_risk(
        eps_program: Optional[str] = None,
        city: Optional[str] = None,
        plan_type: Optional[str] = None,
        organization_id: Optional[int] = None,
        min_score: int = 0,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        health = _build_tenant_health_payload(
            db,
            eps_program=eps_program,
            city=city,
            plan_type=plan_type,
            organization_id=organization_id,
        )
        health_by_id = {o["id"]: o for o in health.get("organizations", [])}
        SubscriptionDB = None
        try:
            from billing_module import SubscriptionDB as _SubDB
            SubscriptionDB = _SubDB
        except Exception:
            pass
        sub_status_by_org: dict = {}
        if SubscriptionDB is not None:
            for sub in (
                db.query(SubscriptionDB)
                .filter(
                    SubscriptionDB.subscriber_type == "organization",
                    SubscriptionDB.status.in_(("active", "trialing", "past_due", "cancelled", "blocked")),
                )
                .order_by(SubscriptionDB.id.desc())
                .all()
            ):
                oid = getattr(sub, "subscriber_id", None)
                if oid and oid not in sub_status_by_org:
                    sub_status_by_org[oid] = sub.status
        org_query = db.query(OrganizationDB).order_by(OrganizationDB.name.asc())
        if organization_id:
            org_query = org_query.filter(OrganizationDB.id == organization_id)
        if eps_program:
            org_query = org_query.filter(OrganizationDB.eps_program.ilike(f"%{eps_program}%"))
        org_list = org_query.all()
        if city:
            city_lower = city.strip().lower()
            org_list = [
                o for o in org_list
                if any(c.lower().find(city_lower) >= 0 for c in _org_cities(db, o.id))
            ]
        rows = []
        for org in org_list:
            hr = health_by_id.get(org.id)
            if plan_type and not hr:
                continue
            risk = _compute_org_churn_risk(org, hr, sub_status_by_org.get(org.id))
            if risk["churn_risk_score"] < min_score:
                continue
            rows.append({
                "id": org.id,
                "name": org.name,
                "code": org.code,
                "eps_program": org.eps_program,
                "status": org.status,
                "sla_tier": getattr(org, "sla_tier", None) or "standard",
                "contract_end": getattr(org, "contract_end", None),
                "subscription_status": sub_status_by_org.get(org.id),
                "patients_count": hr.get("patients_count", 0) if hr else 0,
                "health_score": hr.get("health_score") if hr else None,
                **risk,
            })
        rows.sort(key=lambda r: r["churn_risk_score"], reverse=True)
        level_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for r in rows:
            level_counts[r["churn_risk_level"]] = level_counts.get(r["churn_risk_level"], 0) + 1
        return {
            "generated_at": now_co().strftime("%Y-%m-%d %H:%M:%S"),
            "filters_applied": health.get("filters_applied"),
            "summary": {
                "organizations_scored": len(rows),
                "avg_churn_risk_score": round(sum(r["churn_risk_score"] for r in rows) / len(rows), 1) if rows else 0,
                "by_level": level_counts,
            },
            "organizations": rows,
        }

    @app.get("/api/superadmin/tenant-health")
    def tenant_health(
        eps_program: Optional[str] = None,
        city: Optional[str] = None,
        plan_type: Optional[str] = None,
        organization_id: Optional[int] = None,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        return _build_tenant_health_payload(
            db,
            eps_program=eps_program,
            city=city,
            plan_type=plan_type,
            organization_id=organization_id,
        )

    @app.get("/api/superadmin/tenant-health/export")
    def tenant_health_export(
        format: str = "csv",
        eps_program: Optional[str] = None,
        city: Optional[str] = None,
        plan_type: Optional[str] = None,
        organization_id: Optional[int] = None,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        payload = _build_tenant_health_payload(
            db,
            eps_program=eps_program,
            city=city,
            plan_type=plan_type,
            organization_id=organization_id,
        )
        fmt = (format or "csv").lower()
        if fmt == "pdf":
            pdf_bytes = _tenant_health_export_pdf(payload)
            fname = f"tenant-health-{now_co().strftime('%Y%m%d')}.pdf"
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="{fname}"'},
            )
        csv_text = _tenant_health_export_csv(payload)
        fname = f"tenant-health-{now_co().strftime('%Y%m%d')}.csv"
        return Response(
            content="\ufeff" + csv_text,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{fname}"'},
        )

    # --- Auditoría ---
    @app.get("/api/superadmin/audit-logs")
    def list_audit_logs(
        entity_type: Optional[str] = None,
        action: Optional[str] = None,
        patient_id: Optional[int] = None,
        actor_id: Optional[int] = None,
        actor: Optional[str] = None,
        organization_id: Optional[int] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 150,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        q = db.query(AuditLogDB).order_by(AuditLogDB.id.desc())
        if entity_type and entity_type != "all":
            q = q.filter(AuditLogDB.entity_type == entity_type)
        if action and action != "all":
            q = q.filter(AuditLogDB.action == action)
        if patient_id:
            q = q.filter(AuditLogDB.patient_id == patient_id)
        if actor_id:
            q = q.filter(AuditLogDB.actor_id == actor_id)
        if organization_id:
            q = q.filter(AuditLogDB.organization_id == organization_id)
        if date_from:
            q = q.filter(AuditLogDB.created_at >= f"{date_from} 00:00:00")
        if date_to:
            q = q.filter(AuditLogDB.created_at <= f"{date_to} 23:59:59")
        if actor:
            like = f"%{actor.strip()}%"
            q = q.filter(or_(AuditLogDB.actor_name.ilike(like), AuditLogDB.actor_role.ilike(like)))
        if search:
            like = f"%{search.strip()}%"
            q = q.filter(or_(AuditLogDB.summary.ilike(like), AuditLogDB.actor_name.ilike(like)))

        rows = q.limit(min(limit, 500)).all()
        retention_days = _get_audit_retention_days(db, SystemSettingsDB) if SystemSettingsDB else 180

        actor_rows = (
            db.query(AuditLogDB.actor_id, AuditLogDB.actor_name)
            .filter(AuditLogDB.actor_id.isnot(None))
            .distinct()
            .order_by(AuditLogDB.actor_name.asc())
            .limit(200)
            .all()
        )
        action_rows = db.query(AuditLogDB.action).distinct().order_by(AuditLogDB.action.asc()).all()
        entity_rows = db.query(AuditLogDB.entity_type).distinct().order_by(AuditLogDB.entity_type.asc()).all()

        alert_source = (
            db.query(AuditLogDB)
            .order_by(AuditLogDB.id.desc())
            .limit(500)
            .all()
        )

        return {
            "generated_at": now_co().strftime("%Y-%m-%d %H:%M:%S"),
            "retention_days": retention_days,
            "retention_options": AUDIT_RETENTION_OPTIONS,
            "total": len(rows),
            "filter_options": {
                "actions": [r[0] for r in action_rows if r[0]],
                "entity_types": [r[0] for r in entity_rows if r[0]],
                "actors": [
                    {"id": aid, "name": aname or f"Usuario #{aid}"}
                    for aid, aname in actor_rows
                    if aid
                ],
            },
            "alerts": _compute_audit_alerts(alert_source),
            "logs": [_serialize_audit_row(r) for r in rows],
        }

    @app.get("/api/superadmin/audit-settings")
    def get_audit_settings(
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        retention_days = _get_audit_retention_days(db, SystemSettingsDB) if SystemSettingsDB else 180
        oldest = db.query(func.min(AuditLogDB.created_at)).scalar()
        total = db.query(AuditLogDB).count()
        return {
            "retention_days": retention_days,
            "retention_options": AUDIT_RETENTION_OPTIONS,
            "oldest_log_at": oldest,
            "total_logs": total,
        }

    @app.put("/api/superadmin/audit-settings")
    def update_audit_settings(
        payload: AuditSettingsUpdate,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if payload.retention_days not in AUDIT_RETENTION_OPTIONS:
            raise HTTPException(status_code=400, detail="Retención debe ser 90, 180 o 365 días")
        if not SystemSettingsDB:
            raise HTTPException(status_code=500, detail="Configuración del sistema no disponible")
        row = _get_system_settings_row(db, SystemSettingsDB)
        old_days = getattr(row, "audit_retention_days", None) or 180
        row.audit_retention_days = payload.retention_days
        row.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        log_audit(
            db,
            actor=current_user,
            action="update",
            entity_type="audit_settings",
            summary=f"Retención de auditoría: {old_days} → {payload.retention_days} días",
            details={"before": {"retention_days": old_days}, "after": {"retention_days": payload.retention_days}},
            now_co=now_co,
        )
        db.commit()
        return {"success": True, "retention_days": payload.retention_days}

    @app.post("/api/superadmin/audit-logs/purge")
    def purge_audit_logs(
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        retention_days = _get_audit_retention_days(db, SystemSettingsDB) if SystemSettingsDB else 180
        deleted = _purge_audit_logs(db, retention_days)
        log_audit(
            db,
            actor=current_user,
            action="delete",
            entity_type="audit_logs",
            summary=f"Purge de auditoría: {deleted} registros (> {retention_days} días)",
            details={"deleted_count": deleted, "retention_days": retention_days},
            now_co=now_co,
        )
        db.commit()
        return {"success": True, "deleted": deleted, "retention_days": retention_days}

    # --- Roles granulares ---
    @app.get("/api/superadmin/staff-roles")
    def list_staff_roles(current_user=Depends(require_superadmin)):
        return [{"value": k, "label": v["label"], "permissions": v["permissions"]} for k, v in STAFF_ROLES.items()]

    @app.patch("/api/superadmin/nutritionists/{nutritionist_id}/staff-role")
    def update_staff_role(
        nutritionist_id: int,
        payload: StaffRoleUpdate,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if payload.staff_role not in STAFF_ROLES:
            raise HTTPException(status_code=400, detail="Rol inválido")
        user = db.query(UserDB).filter(UserDB.id == nutritionist_id, UserDB.role == "admin").first()
        if not user:
            raise HTTPException(status_code=404, detail="Nutricionista no encontrado")
        prof = db.query(AdminProfileDB).filter(AdminProfileDB.user_id == nutritionist_id).first()
        before_state = {
            "staff_role": getattr(prof, "staff_role", None) if prof else None,
            "organization_id": getattr(prof, "organization_id", None) if prof else None,
            "site_id": getattr(prof, "site_id", None) if prof else None,
        }
        if not prof:
            prof = AdminProfileDB(user_id=nutritionist_id)
            db.add(prof)
        if hasattr(prof, "staff_role"):
            prof.staff_role = payload.staff_role
        if hasattr(prof, "organization_id"):
            prof.organization_id = payload.organization_id
        if hasattr(prof, "site_id"):
            prof.site_id = payload.site_id
        db.commit()
        after_state = {
            "staff_role": payload.staff_role,
            "organization_id": payload.organization_id,
            "site_id": payload.site_id,
        }
        log_audit(
            db, actor=current_user, action="role_change", entity_type="staff",
            entity_id=nutritionist_id,
            summary=f"Rol cambiado a {payload.staff_role} para {user.nombres} {user.apellidos}",
            details={"before": before_state, "after": after_state},
            now_co=now_co,
        )
        db.commit()
        return {"success": True, "staff_role": payload.staff_role}

    @app.get("/api/admin/me/permissions")
    def my_permissions(
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        role = get_staff_role(db, current_user, AdminProfileDB)
        perms = STAFF_ROLES.get(role, {}).get("permissions", [])
        org_id = get_user_organization_id(db, current_user.id) if current_user.role == "admin" else None
        prof = db.query(AdminProfileDB).filter(AdminProfileDB.user_id == current_user.id).first()
        return {
            "staff_role": role,
            "staff_role_label": STAFF_ROLES.get(role, {}).get("label", role),
            "permissions": perms if current_user.role != "superadmin" else ["*"],
            "organization_id": getattr(prof, "organization_id", None) or org_id,
            "site_id": getattr(prof, "site_id", None) if prof else None,
        }

    # --- Transferencia de pacientes (senior / superadmin) ---
    @app.post("/api/superadmin/patients/transfer")
    def transfer_patients(
        payload: PatientTransferBody,
        db: Session = Depends(get_db),
        current_user=Depends(require_admin_or_superadmin),
    ):
        role = get_staff_role(db, current_user, AdminProfileDB)
        if current_user.role != "superadmin" and not staff_has_permission(role, "transfers"):
            raise HTTPException(status_code=403, detail="No tienes permiso para transferir pacientes")
        target = db.query(UserDB).filter(UserDB.id == payload.target_nutritionist_id, UserDB.role == "admin").first()
        if not target:
            raise HTTPException(status_code=404, detail="Nutricionista destino no encontrado")
        transferred = 0
        for pid in payload.patient_ids:
            patient = db.query(UserDB).filter(UserDB.id == pid, UserDB.role == "patient").first()
            if not patient:
                continue
            if current_user.role == "admin" and patient.nutritionist_id != current_user.id:
                continue
            old_nutri = patient.nutritionist_id
            patient.nutritionist_id = target.id
            transferred += 1
            log_audit(
                db, actor=current_user, action="transfer", entity_type="patient",
                entity_id=pid, patient_id=pid,
                summary=f"Paciente transferido a {target.nombres} {target.apellidos}",
                details={
                    "before": {"nutritionist_id": old_nutri},
                    "after": {"nutritionist_id": target.id},
                    "from_nutritionist_id": old_nutri,
                    "to_nutritionist_id": target.id,
                    "reason": payload.reason,
                },
                now_co=now_co,
            )
        db.commit()
        return {
            "success": True,
            "transferred": transferred,
            "target_nutritionist": f"{target.nombres} {target.apellidos}",
        }


def enhanced_authorize_patient_access(
    patient_id: int,
    current_user,
    db: Session,
    UserDB,
    AdminProfileDB,
    original_fn: Callable,
):
    """Extiende authorize_patient_access con roles granulares."""
    if current_user.role == "superadmin":
        return
    if current_user.role == "admin":
        role = get_staff_role(db, current_user, AdminProfileDB)
        if role == "clinical_assistant":
            raise HTTPException(status_code=403, detail="Los asistentes clínicos solo gestionan citas")
        if role == "org_admin":
            org_id = get_user_organization_id(db, current_user.id)
            if not org_id or not patient_in_organization(db, patient_id, org_id):
                raise HTTPException(status_code=403, detail="Paciente fuera de su organización EPS")
            return
    return original_fn(patient_id, current_user, db)


def require_staff_permission(permission: str, get_db, get_current_user, AdminProfileDB):
    """Dependency factory para exigir permiso granular."""

    def _dep(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
        if current_user.role == "superadmin":
            return current_user
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="No autorizado")
        role = get_staff_role(db, current_user, AdminProfileDB)
        if not staff_has_permission(role, permission):
            raise HTTPException(
                status_code=403,
                detail=f"Tu rol ({STAFF_ROLES.get(role, {}).get('label', role)}) no incluye: {permission}",
            )
        return current_user

    return _dep
