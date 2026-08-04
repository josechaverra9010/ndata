"""Configuración global: feature flags, runtime env, mantenimiento, backup."""
from __future__ import annotations

import copy
import json
import os
from typing import Any, Callable, Dict, List, Optional

from fastapi import Body, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

PATIENT_PHASE_KEYS = [
    "patient_phase_1",
    "patient_phase_2",
    "patient_phase_3",
    "patient_phase_4",
]

PATIENT_PHASE_LABELS = {
    "patient_phase_1": "Fase 1 — Adherencia y notificaciones",
    "patient_phase_2": "Fase 2 — Recomendaciones, compras y documentos",
    "patient_phase_3": "Fase 3 — Retos, aprendizaje y hábitos",
    "patient_phase_4": "Fase 4 — Diario fotográfico y sustituciones",
}

DEFAULT_PATIENT_FEATURE_FLAGS = {k: True for k in PATIENT_PHASE_KEYS}

MODULE_FEATURE_KEYS = [
    "clinical_colombia",
    "pwa_offline",
    "wearables",
    "gamification",
    "nutritionist_advanced_hub",
]

ALL_FEATURE_KEYS = PATIENT_PHASE_KEYS + MODULE_FEATURE_KEYS

MODULE_FEATURE_LABELS = {
    "clinical_colombia": "Clínica Colombia (MIPRESS, RIPS)",
    "pwa_offline": "PWA / modo offline",
    "wearables": "Wearables y sincronización",
    "gamification": "Retos y gamificación",
    "nutritionist_advanced_hub": "Centro avanzado nutricionista",
}

FEATURE_CATALOG = [
    {
        "id": "patient_panel",
        "label": "Panel paciente",
        "description": "Fases del panel del paciente (1–4)",
        "flags": [
            {"key": k, "label": PATIENT_PHASE_LABELS[k], "scope": "patient"}
            for k in PATIENT_PHASE_KEYS
        ],
    },
    {
        "id": "clinical",
        "label": "Clínica Colombia",
        "description": "MIPRESS, RIPS, bioquímicos y exportación clínica",
        "flags": [
            {"key": "clinical_colombia", "label": MODULE_FEATURE_LABELS["clinical_colombia"], "scope": "nutritionist"},
        ],
    },
    {
        "id": "pwa",
        "label": "PWA / offline",
        "description": "Instalación PWA y cola de sincronización offline",
        "flags": [
            {"key": "pwa_offline", "label": MODULE_FEATURE_LABELS["pwa_offline"], "scope": "patient"},
        ],
    },
    {
        "id": "wearables",
        "label": "Wearables",
        "description": "Integración de datos de wearables en hábitos",
        "flags": [
            {"key": "wearables", "label": MODULE_FEATURE_LABELS["wearables"], "scope": "patient"},
        ],
    },
    {
        "id": "gamification",
        "label": "Retos / gamificación",
        "description": "Retos, logros y recompensas del paciente",
        "flags": [
            {"key": "gamification", "label": MODULE_FEATURE_LABELS["gamification"], "scope": "patient"},
        ],
    },
    {
        "id": "nutritionist_hub",
        "label": "Centro avanzado",
        "description": "Dashboard clínico avanzado para nutricionistas",
        "flags": [
            {
                "key": "nutritionist_advanced_hub",
                "label": MODULE_FEATURE_LABELS["nutritionist_advanced_hub"],
                "scope": "nutritionist",
            },
        ],
    },
]

PHASE_PATH_HINTS = {
    1: ["/adherence", "/notifications/inbox", "/notifications/read-all"],
    2: ["/recommendations", "/shopping-list", "/documents", "/appointments/", "/prep"],
    3: ["/learn", "/program", "/habits", "/reminder-preferences"],
    4: ["/meal-photos", "/substitutions"],
}

FEATURE_PATH_HINTS = {
    "clinical_colombia": ["/api/clinical/"],
    "nutritionist_advanced_hub": [
        "/api/nutritionist/analytics/clinical-dashboard",
        "/api/nutritionist/analytics/abandonment-risk",
    ],
    "wearables": ["/wearables/"],
    "gamification": ["/challenges"],
    "pwa_offline": ["/offline/sync"],
}

RUNTIME_KEYS = [
    "smtp_host",
    "smtp_port",
    "smtp_user",
    "smtp_password",
    "from_email",
    "base_url",
    "frontend_url",
    "max_upload_mb",
    "allowed_origins",
    "environment",
]

PLATFORM_ENVIRONMENTS = ("production", "staging", "sandbox")

SENSITIVE_RUNTIME_KEYS = {"smtp_password"}

_runtime_cache: Dict[str, Any] = {}


def default_patient_flags() -> dict:
    return dict(DEFAULT_PATIENT_FEATURE_FLAGS)


def default_all_feature_flags() -> dict:
    return {k: True for k in ALL_FEATURE_KEYS}


def default_runtime_config() -> dict:
    return {
        "smtp_host": os.getenv("SMTP_HOST", "smtp.gmail.com"),
        "smtp_port": int(os.getenv("SMTP_PORT", "587") or 587),
        "smtp_user": os.getenv("SMTP_USER", ""),
        "smtp_password": os.getenv("SMTP_PASSWORD", ""),
        "from_email": os.getenv("FROM_EMAIL", os.getenv("SMTP_USER", "")),
        "base_url": os.getenv("BASE_URL", "http://localhost:8001"),
        "frontend_url": os.getenv("FRONTEND_URL", "http://localhost:8080"),
        "max_upload_mb": int(os.getenv("MAX_UPLOAD_MB", "5") or 5),
        "allowed_origins": os.getenv("ALLOWED_ORIGINS", ""),
        "environment": os.getenv("ENVIRONMENT", "production"),
    }


def _parse_json_dict(raw, fallback: dict) -> dict:
    if raw is None:
        return copy.deepcopy(fallback)
    if isinstance(raw, dict):
        out = copy.deepcopy(fallback)
        out.update(raw)
        return out
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                out = copy.deepcopy(fallback)
                out.update(parsed)
                return out
        except Exception:
            pass
    return copy.deepcopy(fallback)


def refresh_runtime_cache(settings_row) -> dict:
    """Actualiza caché en memoria desde system_settings."""
    global _runtime_cache
    base = default_runtime_config()
    if settings_row is not None:
        overrides = _parse_json_dict(getattr(settings_row, "runtime_config", None), {})
        for k in RUNTIME_KEYS:
            if k in overrides and overrides[k] not in (None, ""):
                base[k] = overrides[k]
        base["maintenance_mode"] = bool(getattr(settings_row, "maintenance_mode", 0))
        base["maintenance_message"] = getattr(settings_row, "maintenance_message", None) or ""
        base["feature_flags_global"] = _parse_json_dict(
            getattr(settings_row, "feature_flags_global", None),
            default_all_feature_flags(),
        )
    _runtime_cache = base
    return base


def get_runtime_cache() -> dict:
    if not _runtime_cache:
        return default_runtime_config()
    return _runtime_cache


def get_max_upload_bytes() -> int:
    mb = get_runtime_cache().get("max_upload_mb", 5)
    try:
        return int(float(mb) * 1024 * 1024)
    except (TypeError, ValueError):
        return 5 * 1024 * 1024


def get_email_config() -> dict:
    c = get_runtime_cache()
    return {
        "smtp_host": c.get("smtp_host") or os.getenv("SMTP_HOST", "smtp.gmail.com"),
        "smtp_port": int(c.get("smtp_port") or os.getenv("SMTP_PORT", "587") or 587),
        "smtp_user": c.get("smtp_user") or os.getenv("SMTP_USER", ""),
        "smtp_password": c.get("smtp_password") or os.getenv("SMTP_PASSWORD", ""),
        "from_email": c.get("from_email") or os.getenv("FROM_EMAIL") or c.get("smtp_user") or "",
        "frontend_url": c.get("frontend_url") or os.getenv("FRONTEND_URL", "http://localhost:8080"),
        "base_url": c.get("base_url") or os.getenv("BASE_URL", "http://localhost:8001"),
    }


def mask_runtime_for_api(data: dict) -> dict:
    out = copy.deepcopy(data)
    if out.get("smtp_password"):
        out["smtp_password"] = "********"
        out["smtp_password_set"] = True
    else:
        out["smtp_password_set"] = bool(os.getenv("SMTP_PASSWORD"))
    return out


def _user_organization(db: Session, user_id: int, OrganizationMemberDB, OrganizationDB):
    if not OrganizationMemberDB or not OrganizationDB:
        return None
    row = db.query(OrganizationMemberDB).filter(OrganizationMemberDB.user_id == user_id).first()
    if not row:
        return None
    return db.query(OrganizationDB).filter(OrganizationDB.id == row.organization_id).first()


def _org_feature_overrides(org) -> dict:
    if not org:
        return {}
    return _parse_json_dict(getattr(org, "patient_feature_flags", None), {})


def _global_feature_flags(settings_row) -> dict:
    return _parse_json_dict(
        getattr(settings_row, "feature_flags_global", None) if settings_row else None,
        default_all_feature_flags(),
    )


def _merge_org_enabled_modules(org, merged: dict) -> dict:
    """Compatibilidad con enabled_modules legacy (p. ej. clinical_colombia)."""
    if not org:
        return merged
    raw_modules = getattr(org, "enabled_modules", None)
    modules: List[str] = []
    if isinstance(raw_modules, list):
        modules = [str(m) for m in raw_modules]
    elif isinstance(raw_modules, str):
        try:
            parsed = json.loads(raw_modules)
            if isinstance(parsed, list):
                modules = [str(m) for m in parsed]
        except Exception:
            pass
    overrides = _org_feature_overrides(org)
    if "clinical_colombia" not in overrides and modules:
        merged = copy.deepcopy(merged)
        merged["clinical_colombia"] = "clinical_colombia" in modules
    return merged


def resolve_feature_flags(
    db: Session,
    settings_row,
    OrganizationMemberDB,
    OrganizationDB,
    organization_id: Optional[int] = None,
    user_id: Optional[int] = None,
) -> dict:
    merged = _global_feature_flags(settings_row)
    org = None
    if organization_id and OrganizationDB:
        org = db.query(OrganizationDB).filter(OrganizationDB.id == organization_id).first()
    elif user_id:
        org = _user_organization(db, user_id, OrganizationMemberDB, OrganizationDB)
    if org:
        overrides = _org_feature_overrides(org)
        for k in ALL_FEATURE_KEYS:
            if k in overrides and overrides[k] is not None:
                merged[k] = bool(overrides[k])
        merged = _merge_org_enabled_modules(org, merged)
    return merged


def resolve_patient_feature_flags(
    db: Session, user_id: int, settings_row, OrganizationMemberDB, OrganizationDB
) -> dict:
    return resolve_feature_flags(db, settings_row, OrganizationMemberDB, OrganizationDB, user_id=user_id)


def resolve_nutritionist_feature_flags(
    db: Session, user_id: int, settings_row, OrganizationMemberDB, OrganizationDB
) -> dict:
    return resolve_feature_flags(db, settings_row, OrganizationMemberDB, OrganizationDB, user_id=user_id)


def patient_phase_from_path(path: str) -> Optional[int]:
    for phase, hints in PHASE_PATH_HINTS.items():
        for hint in hints:
            if hint in path:
                return phase
    return None


def check_patient_phase_enabled(
    db: Session, phase: int, user_id: int, settings_row, OrganizationMemberDB, OrganizationDB
) -> bool:
    flags = resolve_patient_feature_flags(db, user_id, settings_row, OrganizationMemberDB, OrganizationDB)
    key = f"patient_phase_{phase}"
    return bool(flags.get(key, True))


def feature_key_from_path(path: str) -> Optional[str]:
    for key, hints in FEATURE_PATH_HINTS.items():
        for hint in hints:
            if hint in path:
                return key
    return None


def check_feature_enabled(
    db: Session,
    feature_key: str,
    user_id: int,
    user_role: str,
    settings_row,
    OrganizationMemberDB,
    OrganizationDB,
) -> bool:
    if user_role == "superadmin":
        return True
    if user_role == "patient":
        flags = resolve_patient_feature_flags(db, user_id, settings_row, OrganizationMemberDB, OrganizationDB)
    elif user_role in ("admin", "nutritionist"):
        flags = resolve_nutritionist_feature_flags(db, user_id, settings_row, OrganizationMemberDB, OrganizationDB)
    else:
        flags = _global_feature_flags(settings_row)
    return bool(flags.get(feature_key, True))


def _sync_org_enabled_modules(org, flags: dict) -> None:
    """Mantiene enabled_modules alineado con clinical_colombia."""
    if "clinical_colombia" not in flags:
        return
    raw = getattr(org, "enabled_modules", None)
    modules: List[str] = []
    if isinstance(raw, list):
        modules = list(raw)
    elif isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                modules = list(parsed)
        except Exception:
            pass
    if flags["clinical_colombia"]:
        if "clinical_colombia" not in modules:
            modules.append("clinical_colombia")
    else:
        modules = [m for m in modules if m != "clinical_colombia"]
    org.enabled_modules = modules


class RuntimeConfigUpdate(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    from_email: Optional[str] = None
    base_url: Optional[str] = None
    frontend_url: Optional[str] = None
    max_upload_mb: Optional[int] = None
    allowed_origins: Optional[str] = None
    environment: Optional[str] = None


class FeatureFlagsUpdate(BaseModel):
    global_flags: Optional[Dict[str, bool]] = None
    organization_id: Optional[int] = None
    organization_flags: Optional[Dict[str, bool]] = None


class GlobalFeaturesUpdate(BaseModel):
    flags: Dict[str, bool]


class OrgFeaturesUpdate(BaseModel):
    flags: Dict[str, Optional[bool]]


class MaintenanceUpdate(BaseModel):
    maintenance_mode: bool
    maintenance_message: Optional[str] = None


def register_config_routes(app, deps: dict):
    get_db = deps["get_db"]
    require_superadmin = deps["require_superadmin"]
    get_current_user = deps["get_current_user"]
    get_current_user_optional = deps.get("get_current_user_optional")
    SystemSettingsDB = deps["SystemSettingsDB"]
    OrganizationDB = deps["OrganizationDB"]
    OrganizationMemberDB = deps["OrganizationMemberDB"]
    UserDB = deps["UserDB"]
    get_or_create_settings: Callable = deps["get_or_create_system_settings"]
    log_audit = deps.get("log_audit")
    now_co: Callable = deps["now_co"]
    SECRET_KEY = deps["SECRET_KEY"]
    ALGORITHM = deps["ALGORITHM"]
    SessionLocal = deps["SessionLocal"]

    from jose import jwt

    def _serialize_full(settings):
        refresh_runtime_cache(settings)
        runtime = mask_runtime_for_api(get_runtime_cache())
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
            "auditRetentionDays": getattr(settings, "audit_retention_days", 180),
            "featureFlagsGlobal": _global_feature_flags(settings),
            "runtimeConfig": runtime,
            "patientPhaseLabels": PATIENT_PHASE_LABELS,
            "moduleFeatureLabels": MODULE_FEATURE_LABELS,
            "featureCatalog": FEATURE_CATALOG,
            "updatedAt": settings.updated_at,
        }

    def _build_backup_payload(db: Session, settings):
        orgs = db.query(OrganizationDB).all()
        return {
            "version": 1,
            "exported_at": now_co().strftime("%Y-%m-%d %H:%M:%S"),
            "system_settings": {
                "site_name": settings.site_name,
                "support_email": settings.support_email,
                "max_users_per_org": settings.max_users_per_org,
                "max_patients_per_nutritionist": settings.max_patients_per_nutritionist,
                "enable_registration": settings.enable_registration,
                "require_email_verification": settings.require_email_verification,
                "enable_two_factor": settings.enable_two_factor,
                "maintenance_mode": settings.maintenance_mode,
                "maintenance_message": getattr(settings, "maintenance_message", None),
                "email_notifications": settings.email_notifications,
                "slack_notifications": settings.slack_notifications,
                "audit_retention_days": getattr(settings, "audit_retention_days", 180),
                "hero_image": settings.hero_image,
                "feature_flags_global": _global_feature_flags(settings),
                "runtime_config": _parse_json_dict(
                    getattr(settings, "runtime_config", None), default_runtime_config()
                ),
            },
            "organizations": [
                {
                    "id": o.id,
                    "code": o.code,
                    "name": o.name,
                    "enabled_modules": getattr(o, "enabled_modules", None),
                    "patient_feature_flags": _parse_json_dict(
                        getattr(o, "patient_feature_flags", None), {}
                    ),
                }
                for o in orgs
            ],
        }

    @app.get("/api/public/platform-status")
    def public_platform_status(db: Session = Depends(get_db)):
        settings = db.query(SystemSettingsDB).first()
        refresh_runtime_cache(settings)
        runtime = get_runtime_cache()
        env = (runtime.get("environment") or os.getenv("ENVIRONMENT", "production")).lower()
        return {
            "maintenanceMode": bool(getattr(settings, "maintenance_mode", 0)) if settings else False,
            "maintenanceMessage": (
                getattr(settings, "maintenance_message", None) or "Plataforma en mantenimiento. Vuelve pronto."
            )
            if settings
            else "",
            "siteName": getattr(settings, "site_name", "NutriData") if settings else "NutriData",
            "environment": env if env in PLATFORM_ENVIRONMENTS else "production",
            "isSandbox": env == "sandbox",
        }

    @app.get("/api/patient/feature-flags")
    def patient_feature_flags(
        db: Session = Depends(get_db),
        current_user: UserDB = Depends(get_current_user),
    ):
        if current_user.role != "patient":
            raise HTTPException(status_code=403, detail="Solo pacientes")
        settings = get_or_create_settings(db)
        flags = resolve_patient_feature_flags(db, current_user.id, settings, OrganizationMemberDB, OrganizationDB)
        return {
            "flags": flags,
            "labels": {**PATIENT_PHASE_LABELS, **MODULE_FEATURE_LABELS},
            "catalog": FEATURE_CATALOG,
        }

    @app.get("/api/nutritionist/feature-flags")
    def nutritionist_feature_flags(
        db: Session = Depends(get_db),
        current_user: UserDB = Depends(get_current_user),
    ):
        if current_user.role not in ("admin", "nutritionist", "superadmin"):
            raise HTTPException(status_code=403, detail="Solo personal clínico")
        settings = get_or_create_settings(db)
        flags = resolve_nutritionist_feature_flags(
            db, current_user.id, settings, OrganizationMemberDB, OrganizationDB
        )
        return {
            "flags": flags,
            "labels": {**PATIENT_PHASE_LABELS, **MODULE_FEATURE_LABELS},
            "catalog": FEATURE_CATALOG,
        }

    @app.get("/api/superadmin/features")
    def get_features_overview(
        db: Session = Depends(get_db),
        current_user: UserDB = Depends(require_superadmin),
    ):
        settings = get_or_create_settings(db)
        global_flags = _global_feature_flags(settings)
        orgs = db.query(OrganizationDB).order_by(OrganizationDB.name).all()
        org_rows = []
        for o in orgs:
            overrides = _org_feature_overrides(o)
            org_rows.append(
                {
                    "id": o.id,
                    "name": o.name,
                    "code": getattr(o, "code", None),
                    "overrideCount": len([k for k in ALL_FEATURE_KEYS if k in overrides]),
                    "enabledModules": getattr(o, "enabled_modules", None) or [],
                }
            )
        return {
            "catalog": FEATURE_CATALOG,
            "globalFlags": global_flags,
            "allKeys": ALL_FEATURE_KEYS,
            "organizations": org_rows,
        }

    @app.put("/api/superadmin/features/global")
    def update_global_features(
        payload: GlobalFeaturesUpdate,
        db: Session = Depends(get_db),
        current_user: UserDB = Depends(require_superadmin),
    ):
        settings = get_or_create_settings(db)
        merged = _global_feature_flags(settings)
        before = dict(merged)
        for k, v in payload.flags.items():
            if k in ALL_FEATURE_KEYS:
                merged[k] = bool(v)
        settings.feature_flags_global = merged
        settings.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        if log_audit:
            log_audit(
                db,
                actor=current_user,
                action="update",
                entity_type="feature_flags",
                summary="Feature flags globales actualizados",
                details={"before": before, "after": merged},
                now_co=now_co,
            )
        db.commit()
        refresh_runtime_cache(settings)
        return {"success": True, "globalFlags": merged}

    @app.get("/api/superadmin/features/organizations/{org_id}")
    def get_org_features(
        org_id: int,
        db: Session = Depends(get_db),
        current_user: UserDB = Depends(require_superadmin),
    ):
        org = db.query(OrganizationDB).filter(OrganizationDB.id == org_id).first()
        if not org:
            raise HTTPException(status_code=404, detail="Organización no encontrada")
        settings = get_or_create_settings(db)
        global_flags = _global_feature_flags(settings)
        org_flags = _org_feature_overrides(org)
        effective = resolve_feature_flags(
            db, settings, OrganizationMemberDB, OrganizationDB, organization_id=org_id
        )
        return {
            "organizationId": org.id,
            "organizationName": org.name,
            "globalFlags": global_flags,
            "organizationOverrides": org_flags,
            "effectiveFlags": effective,
            "enabledModules": getattr(org, "enabled_modules", None) or [],
        }

    @app.put("/api/superadmin/features/organizations/{org_id}")
    def update_org_features(
        org_id: int,
        payload: OrgFeaturesUpdate,
        db: Session = Depends(get_db),
        current_user: UserDB = Depends(require_superadmin),
    ):
        org = db.query(OrganizationDB).filter(OrganizationDB.id == org_id).first()
        if not org:
            raise HTTPException(status_code=404, detail="Organización no encontrada")
        org_flags = _org_feature_overrides(org)
        before = dict(org_flags)
        for k, v in payload.flags.items():
            if k not in ALL_FEATURE_KEYS:
                continue
            if v is None:
                org_flags.pop(k, None)
            else:
                org_flags[k] = bool(v)
        org.patient_feature_flags = org_flags
        _sync_org_enabled_modules(org, org_flags)
        org.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        settings = get_or_create_settings(db)
        settings.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        if log_audit:
            log_audit(
                db,
                actor=current_user,
                action="update",
                entity_type="feature_flags",
                entity_id=org_id,
                organization_id=org_id,
                summary=f"Feature flags org «{org.name}» actualizados",
                details={"before": before, "after": org_flags},
                now_co=now_co,
            )
        db.commit()
        effective = resolve_feature_flags(
            db, settings, OrganizationMemberDB, OrganizationDB, organization_id=org_id
        )
        return {
            "success": True,
            "organizationOverrides": org_flags,
            "effectiveFlags": effective,
        }

    @app.get("/api/superadmin/config")
    def get_full_config(
        db: Session = Depends(get_db),
        current_user: UserDB = Depends(require_superadmin),
    ):
        settings = get_or_create_settings(db)
        return _serialize_full(settings)

    @app.put("/api/superadmin/config/runtime")
    def update_runtime_config(
        payload: RuntimeConfigUpdate,
        db: Session = Depends(get_db),
        current_user: UserDB = Depends(require_superadmin),
    ):
        settings = get_or_create_settings(db)
        current = _parse_json_dict(getattr(settings, "runtime_config", None), default_runtime_config())
        data = payload.model_dump(exclude_unset=True)
        if "smtp_password" in data and data["smtp_password"] in (None, "", "********"):
            data.pop("smtp_password", None)
        current.update({k: v for k, v in data.items() if v is not None})
        settings.runtime_config = current
        settings.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        refresh_runtime_cache(settings)
        return {"success": True, "runtimeConfig": mask_runtime_for_api(get_runtime_cache())}

    @app.put("/api/superadmin/config/feature-flags")
    def update_feature_flags(
        payload: FeatureFlagsUpdate,
        db: Session = Depends(get_db),
        current_user: UserDB = Depends(require_superadmin),
    ):
        settings = get_or_create_settings(db)
        if payload.global_flags is not None:
            merged = _global_feature_flags(settings)
            merged.update({k: bool(v) for k, v in payload.global_flags.items() if k in ALL_FEATURE_KEYS})
            settings.feature_flags_global = merged
        if payload.organization_id is not None and payload.organization_flags is not None:
            org = db.query(OrganizationDB).filter(OrganizationDB.id == payload.organization_id).first()
            if not org:
                raise HTTPException(status_code=404, detail="Organización no encontrada")
            org_flags = _org_feature_overrides(org)
            org_flags.update(
                {k: bool(v) for k, v in payload.organization_flags.items() if k in ALL_FEATURE_KEYS}
            )
            org.patient_feature_flags = org_flags
            _sync_org_enabled_modules(org, org_flags)
            org.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        settings.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        refresh_runtime_cache(settings)
        return {
            "success": True,
            "featureFlagsGlobal": _global_feature_flags(settings),
        }

    @app.put("/api/superadmin/config/maintenance")
    def update_maintenance(
        payload: MaintenanceUpdate,
        db: Session = Depends(get_db),
        current_user: UserDB = Depends(require_superadmin),
    ):
        settings = get_or_create_settings(db)
        settings.maintenance_mode = 1 if payload.maintenance_mode else 0
        if payload.maintenance_message is not None:
            settings.maintenance_message = payload.maintenance_message.strip()
        settings.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        refresh_runtime_cache(settings)
        return {
            "success": True,
            "maintenanceMode": bool(settings.maintenance_mode),
            "maintenanceMessage": settings.maintenance_message or "",
        }

    @app.get("/api/superadmin/config/organizations/{org_id}/feature-flags")
    def get_org_feature_flags(
        org_id: int,
        db: Session = Depends(get_db),
        current_user: UserDB = Depends(require_superadmin),
    ):
        org = db.query(OrganizationDB).filter(OrganizationDB.id == org_id).first()
        if not org:
            raise HTTPException(status_code=404, detail="Organización no encontrada")
        settings = get_or_create_settings(db)
        global_flags = _global_feature_flags(settings)
        org_flags = _org_feature_overrides(org)
        effective = resolve_feature_flags(
            db, settings, OrganizationMemberDB, OrganizationDB, organization_id=org_id
        )
        return {
            "organizationId": org.id,
            "organizationName": org.name,
            "globalFlags": global_flags,
            "organizationOverrides": org_flags,
            "effectiveFlags": effective,
        }

    @app.get("/api/superadmin/config/backup")
    def export_config_backup(
        db: Session = Depends(get_db),
        current_user: UserDB = Depends(require_superadmin),
    ):
        settings = get_or_create_settings(db)
        return _build_backup_payload(db, settings)

    @app.post("/api/superadmin/config/restore")
    def restore_config_backup(
        payload: dict = Body(...),
        db: Session = Depends(get_db),
        current_user: UserDB = Depends(require_superadmin),
    ):
        settings = get_or_create_settings(db)
        sys = payload.get("system_settings") or {}
        for field, attr in [
            ("site_name", "site_name"),
            ("support_email", "support_email"),
            ("max_users_per_org", "max_users_per_org"),
            ("max_patients_per_nutritionist", "max_patients_per_nutritionist"),
            ("enable_registration", "enable_registration"),
            ("require_email_verification", "require_email_verification"),
            ("enable_two_factor", "enable_two_factor"),
            ("maintenance_mode", "maintenance_mode"),
            ("maintenance_message", "maintenance_message"),
            ("email_notifications", "email_notifications"),
            ("slack_notifications", "slack_notifications"),
            ("audit_retention_days", "audit_retention_days"),
            ("hero_image", "hero_image"),
        ]:
            if field in sys and sys[field] is not None:
                setattr(settings, attr, sys[field])
        if "feature_flags_global" in sys:
            settings.feature_flags_global = sys["feature_flags_global"]
        if "runtime_config" in sys:
            rc = sys["runtime_config"]
            if isinstance(rc.get("smtp_password"), str) and rc["smtp_password"] == "********":
                rc.pop("smtp_password", None)
            settings.runtime_config = rc
        settings.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")

        for org_data in payload.get("organizations") or []:
            oid = org_data.get("id")
            if not oid:
                continue
            org = db.query(OrganizationDB).filter(OrganizationDB.id == oid).first()
            if not org:
                continue
            if "enabled_modules" in org_data:
                org.enabled_modules = org_data["enabled_modules"]
            if "patient_feature_flags" in org_data:
                org.patient_feature_flags = org_data["patient_feature_flags"]
            org.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")

        db.commit()
        refresh_runtime_cache(settings)
        return {"success": True, "message": "Configuración restaurada", "config": _serialize_full(settings)}


def create_maintenance_middleware(deps: dict):
    """Factory para middleware de mantenimiento y feature flags por fase."""
    SystemSettingsDB = deps["SystemSettingsDB"]
    UserDB = deps["UserDB"]
    OrganizationMemberDB = deps["OrganizationMemberDB"]
    OrganizationDB = deps["OrganizationDB"]
    SessionLocal = deps["SessionLocal"]
    SECRET_KEY = deps["SECRET_KEY"]
    ALGORITHM = deps["ALGORITHM"]

    from jose import jwt
    from starlette.responses import JSONResponse

    async def middleware(request: Request, call_next):
        path = request.url.path
        if not path.startswith("/api/"):
            return await call_next(request)

        exempt_prefixes = (
            "/api/public/",
            "/api/login",
            "/api/auth/",
            "/login",
            "/token",
            "/api/home/hero",
        )
        if any(path.startswith(p) for p in exempt_prefixes):
            return await call_next(request)

        db = SessionLocal()
        try:
            settings = db.query(SystemSettingsDB).first()
            if settings and getattr(settings, "maintenance_mode", 0):
                allow = path.startswith("/api/superadmin/")
                if not allow:
                    auth = request.headers.get("authorization", "")
                    if auth.lower().startswith("bearer "):
                        token = auth.split(" ", 1)[1]
                        try:
                            data = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                            email = data.get("sub")
                            if email:
                                u = db.query(UserDB).filter(UserDB.email == email).first()
                                if u and u.role == "superadmin":
                                    allow = True
                        except Exception:
                            pass
                if not allow:
                    msg = getattr(settings, "maintenance_message", None) or "Plataforma en mantenimiento"
                    return JSONResponse(
                        status_code=503,
                        content={"detail": msg, "maintenanceMode": True},
                    )

            phase = patient_phase_from_path(path)
            feature_key = feature_key_from_path(path)
            auth = request.headers.get("authorization", "")
            user_id = None
            user_role = None
            if auth.lower().startswith("bearer "):
                try:
                    data = jwt.decode(auth.split(" ", 1)[1], SECRET_KEY, algorithms=[ALGORITHM])
                    email = data.get("sub")
                    u = db.query(UserDB).filter(UserDB.email == email).first()
                    if u:
                        user_id = u.id
                        user_role = u.role
                except Exception:
                    pass

            if phase and "/api/patient/" in path:
                if user_id and user_role == "patient" and not check_patient_phase_enabled(
                    db, phase, user_id, settings, OrganizationMemberDB, OrganizationDB
                ):
                    return JSONResponse(
                        status_code=403,
                        content={"detail": f"Módulo paciente fase {phase} desactivado", "phase": phase},
                    )

            if feature_key and user_id and user_role not in (None, "superadmin"):
                if not check_feature_enabled(
                    db, feature_key, user_id, user_role, settings, OrganizationMemberDB, OrganizationDB
                ):
                    return JSONResponse(
                        status_code=403,
                        content={
                            "detail": f"Módulo '{feature_key}' desactivado",
                            "feature": feature_key,
                        },
                    )
        finally:
            db.close()

        return await call_next(request)

    return middleware
