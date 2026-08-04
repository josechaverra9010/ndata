"""
Marketplace de integraciones NutriData: WhatsApp, calendarios, wearables, EPS, webhooks salientes.
"""
from __future__ import annotations

import copy
import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional, TYPE_CHECKING

import requests
from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import Column, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import Session

if TYPE_CHECKING:
    from sqlalchemy.orm import DeclarativeBase

IntegrationConnectionDB = None
OutgoingWebhookDB = None
WebhookDeliveryLogDB = None

SENSITIVE_CONFIG_KEYS = {
    "access_token",
    "client_secret",
    "api_key",
    "secret",
    "refresh_token",
    "webhook_secret",
    "password",
}

WEBHOOK_EVENTS = {
    "patient.created": "Nuevo paciente registrado",
    "appointment.created": "Nueva cita agendada",
    "appointment.reminder": "Recordatorio de cita enviado",
    "adherence.low": "Adherencia baja detectada",
}

INTEGRATION_CATALOG = [
    {
        "key": "whatsapp_business",
        "category": "messaging",
        "name": "WhatsApp Business",
        "description": "Recordatorios de citas, adherencia y mensajes transaccionales vía Cloud API.",
        "config_fields": [
            {"key": "access_token", "label": "Access Token", "type": "secret", "required": True},
            {"key": "phone_id", "label": "Phone Number ID", "type": "text", "required": True},
            {"key": "template_name", "label": "Plantilla (producción)", "type": "text", "required": False},
        ],
        "docs_url": "https://developers.facebook.com/docs/whatsapp/cloud-api",
    },
    {
        "key": "google_calendar",
        "category": "calendar",
        "name": "Google Calendar",
        "description": "Sincroniza citas NutriData con calendario Google del nutricionista.",
        "config_fields": [
            {"key": "client_id", "label": "Client ID OAuth", "type": "text", "required": True},
            {"key": "client_secret", "label": "Client Secret", "type": "secret", "required": True},
            {"key": "refresh_token", "label": "Refresh Token", "type": "secret", "required": False},
            {"key": "calendar_id", "label": "Calendar ID", "type": "text", "required": False},
        ],
    },
    {
        "key": "outlook_calendar",
        "category": "calendar",
        "name": "Microsoft Outlook / 365",
        "description": "Sincronización bidireccional de citas con Outlook Calendar.",
        "config_fields": [
            {"key": "tenant_id", "label": "Tenant ID", "type": "text", "required": True},
            {"key": "client_id", "label": "Application ID", "type": "text", "required": True},
            {"key": "client_secret", "label": "Client Secret", "type": "secret", "required": True},
        ],
    },
    {
        "key": "fitbit",
        "category": "wearables",
        "name": "Fitbit",
        "description": "Importa pasos y minutos activos al panel de hábitos del paciente.",
        "config_fields": [
            {"key": "client_id", "label": "Client ID", "type": "text", "required": True},
            {"key": "client_secret", "label": "Client Secret", "type": "secret", "required": True},
        ],
    },
    {
        "key": "apple_health",
        "category": "wearables",
        "name": "Apple Health",
        "description": "Sync vía app móvil / HealthKit (requiere PWA o app nativa del paciente).",
        "config_fields": [
            {"key": "bundle_id", "label": "Bundle ID iOS", "type": "text", "required": False},
            {"key": "enabled", "label": "Habilitado en app", "type": "boolean", "required": False},
        ],
    },
    {
        "key": "google_fit",
        "category": "wearables",
        "name": "Google Fit",
        "description": "Sincroniza actividad física desde Google Fit / Health Connect.",
        "config_fields": [
            {"key": "client_id", "label": "OAuth Client ID", "type": "text", "required": True},
            {"key": "client_secret", "label": "Client Secret", "type": "secret", "required": True},
        ],
    },
    {
        "key": "eps_api",
        "category": "eps",
        "name": "EPS / API externa",
        "description": "Conector genérico para EPS, aseguradoras o sistemas clínicos externos (Colombia).",
        "config_fields": [
            {"key": "base_url", "label": "URL base API", "type": "text", "required": True},
            {"key": "api_key", "label": "API Key", "type": "secret", "required": True},
            {"key": "eps_code", "label": "Código EPS / NIT", "type": "text", "required": False},
            {"key": "program_code", "label": "Programa / contrato", "type": "text", "required": False},
        ],
    },
]


class ConnectionUpsertSchema(BaseModel):
    integration_key: str
    organization_id: Optional[int] = None
    label: Optional[str] = None
    config: Dict[str, Any] = Field(default_factory=dict)
    is_enabled: bool = True


class WebhookCreateSchema(BaseModel):
    name: str
    url: str
    events: List[str]
    secret: Optional[str] = None
    organization_id: Optional[int] = None
    headers: Optional[Dict[str, str]] = None
    is_enabled: bool = True


class WebhookUpdateSchema(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    events: Optional[List[str]] = None
    secret: Optional[str] = None
    is_enabled: Optional[bool] = None
    headers: Optional[Dict[str, str]] = None


def register_integrations_models(Base):
    global IntegrationConnectionDB, OutgoingWebhookDB, WebhookDeliveryLogDB

    class _IntegrationConnectionDB(Base):
        __tablename__ = "integration_connections"
        id = Column(Integer, primary_key=True, index=True)
        integration_key = Column(String(60), nullable=False, index=True)
        organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
        label = Column(String(200), nullable=True)
        config = Column(JSON, nullable=True)
        is_enabled = Column(Integer, default=1)
        status = Column(String(30), default="disconnected")
        last_test_at = Column(String(50), nullable=True)
        last_error = Column(Text, nullable=True)
        created_at = Column(String(50), nullable=True)
        updated_at = Column(String(50), nullable=True)

    class _OutgoingWebhookDB(Base):
        __tablename__ = "outgoing_webhooks"
        id = Column(Integer, primary_key=True, index=True)
        name = Column(String(200), nullable=False)
        url = Column(String(500), nullable=False)
        secret = Column(String(200), nullable=True)
        events = Column(JSON, nullable=False)
        organization_id = Column(Integer, nullable=True, index=True)
        headers = Column(JSON, nullable=True)
        is_enabled = Column(Integer, default=1)
        created_at = Column(String(50), nullable=True)
        updated_at = Column(String(50), nullable=True)

    class _WebhookDeliveryLogDB(Base):
        __tablename__ = "webhook_delivery_logs"
        id = Column(Integer, primary_key=True, index=True)
        webhook_id = Column(Integer, ForeignKey("outgoing_webhooks.id"), nullable=False, index=True)
        event_type = Column(String(60), nullable=False, index=True)
        payload = Column(JSON, nullable=True)
        status_code = Column(Integer, nullable=True)
        response_body = Column(Text, nullable=True)
        success = Column(Integer, default=0)
        duration_ms = Column(Integer, nullable=True)
        attempted_at = Column(String(50), nullable=True)

    IntegrationConnectionDB = _IntegrationConnectionDB
    OutgoingWebhookDB = _OutgoingWebhookDB
    WebhookDeliveryLogDB = _WebhookDeliveryLogDB
    return IntegrationConnectionDB, OutgoingWebhookDB, WebhookDeliveryLogDB


def migrate_integrations_schema(engine, inspect_fn, text_fn):
    try:
        inspector = inspect_fn(engine)
        tables = inspector.get_table_names()
        for model in (IntegrationConnectionDB, OutgoingWebhookDB, WebhookDeliveryLogDB):
            if model is not None and model.__tablename__ not in tables:
                model.__table__.create(bind=engine, checkfirst=True)
    except Exception as exc:
        print(f"[MIGRATE] integrations: {exc}")


def _catalog_item(key: str) -> Optional[dict]:
    for item in INTEGRATION_CATALOG:
        if item["key"] == key:
            return item
    return None


def mask_config(config: Optional[dict]) -> dict:
    if not config:
        return {}
    out = copy.deepcopy(config)
    for k in out:
        if k in SENSITIVE_CONFIG_KEYS and out[k]:
            out[k] = "********"
            out[f"{k}_set"] = True
    return out


def merge_config(existing: Optional[dict], incoming: dict) -> dict:
    base = copy.deepcopy(existing or {})
    for k, v in incoming.items():
        if isinstance(v, str) and v in ("", "********"):
            continue
        base[k] = v
    return base


def resolve_whatsapp_credentials(db: Session, organization_id: Optional[int] = None) -> dict:
    """Prioridad: conexión DB habilitada → variables de entorno."""
    token, phone_id = None, None
    if IntegrationConnectionDB is not None:
        q = db.query(IntegrationConnectionDB).filter(
            IntegrationConnectionDB.integration_key == "whatsapp_business",
            IntegrationConnectionDB.is_enabled == 1,
        )
        if organization_id:
            row = q.filter(IntegrationConnectionDB.organization_id == organization_id).first()
            if not row:
                row = q.filter(IntegrationConnectionDB.organization_id.is_(None)).first()
        else:
            row = q.filter(IntegrationConnectionDB.organization_id.is_(None)).first()
        if row and isinstance(row.config, dict):
            token = row.config.get("access_token") or token
            phone_id = row.config.get("phone_id") or phone_id
    return {
        "access_token": token or os.getenv("WHATSAPP_ACCESS_TOKEN", ""),
        "phone_id": phone_id or os.getenv("WHATSAPP_PHONE_ID", ""),
    }


def send_whatsapp_message(phone: str, message: str, db: Session, organization_id: Optional[int] = None) -> bool:
    creds = resolve_whatsapp_credentials(db, organization_id)
    access_token = creds.get("access_token")
    phone_id = creds.get("phone_id")
    if not access_token or not phone_id:
        print(f"[WhatsApp stub] Para {phone}: {message[:80]}...")
        return False
    clean_phone = "".join(filter(str.isdigit, phone))
    url = f"https://graph.facebook.com/v18.0/{phone_id}/messages"
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": clean_phone,
        "type": "text",
        "text": {"body": message},
    }
    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=15)
        return resp.status_code == 200
    except Exception as exc:
        print(f"[WhatsApp] {exc}")
        return False


def _google_access_token(config: dict) -> Optional[str]:
    refresh_token = config.get("refresh_token")
    client_id = config.get("client_id") or os.getenv("GOOGLE_CLIENT_ID")
    client_secret = config.get("client_secret") or os.getenv("GOOGLE_CLIENT_SECRET")
    if not refresh_token or not client_id or not client_secret:
        return None
    try:
        resp = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
            timeout=15,
        )
        if resp.status_code == 200:
            return resp.json().get("access_token")
    except Exception as exc:
        print(f"[Google Calendar] token: {exc}")
    return None


def _parse_duration_minutes(duration: Optional[str]) -> int:
    if not duration:
        return 45
    try:
        if "h" in str(duration).lower():
            parts = str(duration).lower().replace("min", "").split("h")
            hours = int(parts[0].strip() or 0)
            mins = int(parts[1].strip() or 0) if len(parts) > 1 else 0
            return max(15, hours * 60 + mins)
    except Exception:
        pass
    try:
        return max(15, int("".join(filter(str.isdigit, str(duration))) or 45))
    except Exception:
        return 45


def sync_appointment_to_google_calendar(
    db: Session,
    appointment: dict,
    *,
    organization_id: Optional[int] = None,
    nutritionist_id: Optional[int] = None,
) -> dict:
    """Sincroniza cita a Google Calendar si hay conexión activa (one-way)."""
    if IntegrationConnectionDB is None:
        return {"synced": False, "reason": "no_module"}
    q = db.query(IntegrationConnectionDB).filter(
        IntegrationConnectionDB.integration_key == "google_calendar",
        IntegrationConnectionDB.is_enabled == 1,
    )
    conn = None
    if organization_id:
        conn = q.filter(IntegrationConnectionDB.organization_id == organization_id).first()
    if not conn:
        conn = q.filter(IntegrationConnectionDB.organization_id.is_(None)).first()
    if not conn or not isinstance(conn.config, dict):
        return {"synced": False, "reason": "no_connection"}
    access = _google_access_token(conn.config)
    if not access:
        return {"synced": False, "reason": "no_token"}
    calendar_id = conn.config.get("calendar_id") or "primary"
    date_str = appointment.get("date")
    time_str = appointment.get("time") or "09:00"
    mins = _parse_duration_minutes(appointment.get("duration"))
    try:
        start_dt = datetime.strptime(f"{date_str} {time_str[:5]}", "%Y-%m-%d %H:%M")
        end_dt = start_dt + timedelta(minutes=mins)
    except Exception:
        return {"synced": False, "reason": "bad_datetime"}
    event = {
        "summary": f"NutriData — {appointment.get('patient_name', 'Paciente')}",
        "description": appointment.get("notes") or "Cita agendada desde NutriData",
        "start": {"dateTime": start_dt.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": "America/Bogota"},
        "end": {"dateTime": end_dt.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": "America/Bogota"},
    }
    try:
        resp = requests.post(
            f"https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events",
            headers={"Authorization": f"Bearer {access}", "Content-Type": "application/json"},
            json=event,
            timeout=20,
        )
        if resp.status_code in (200, 201):
            data = resp.json()
            return {"synced": True, "event_id": data.get("id"), "html_link": data.get("htmlLink")}
        print(f"[Google Calendar] {resp.status_code}: {resp.text[:200]}")
    except Exception as exc:
        print(f"[Google Calendar] sync: {exc}")
    return {"synced": False, "reason": "api_error"}


def _webhook_signature(secret: str, body: bytes) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def dispatch_webhook_event(
    db: Session,
    event_type: str,
    payload: dict,
    now_co: Callable,
    organization_id: Optional[int] = None,
) -> List[dict]:
    """Dispara webhooks salientes suscritos al evento."""
    if OutgoingWebhookDB is None:
        return []
    q = db.query(OutgoingWebhookDB).filter(OutgoingWebhookDB.is_enabled == 1)
    hooks = q.all()
    results = []
    envelope = {
        "event": event_type,
        "timestamp": now_co().strftime("%Y-%m-%d %H:%M:%S"),
        "data": payload,
    }
    body_bytes = json.dumps(envelope, default=str).encode("utf-8")

    for hook in hooks:
        events = hook.events if isinstance(hook.events, list) else []
        if event_type not in events:
            continue
        if organization_id and hook.organization_id and hook.organization_id != organization_id:
            continue
        headers = {"Content-Type": "application/json", "User-Agent": "NutriData-Webhooks/1.0"}
        if isinstance(hook.headers, dict):
            headers.update({str(k): str(v) for k, v in hook.headers.items()})
        secret = hook.secret or ""
        if secret:
            headers["X-NutriData-Signature"] = _webhook_signature(secret, body_bytes)
        start = datetime.utcnow()
        status_code = None
        response_text = ""
        success = False
        try:
            resp = requests.post(hook.url, data=body_bytes, headers=headers, timeout=12)
            status_code = resp.status_code
            response_text = (resp.text or "")[:2000]
            success = 200 <= resp.status_code < 300
        except Exception as exc:
            response_text = str(exc)[:500]
        duration_ms = int((datetime.utcnow() - start).total_seconds() * 1000)
        if WebhookDeliveryLogDB is not None:
            db.add(
                WebhookDeliveryLogDB(
                    webhook_id=hook.id,
                    event_type=event_type,
                    payload=envelope,
                    status_code=status_code,
                    response_body=response_text,
                    success=1 if success else 0,
                    duration_ms=duration_ms,
                    attempted_at=now_co().strftime("%Y-%m-%d %H:%M:%S"),
                )
            )
        results.append({"webhook_id": hook.id, "success": success, "status_code": status_code})
    if results:
        db.commit()
    return results


def _test_integration(integration_key: str, config: dict) -> tuple:
    if integration_key == "whatsapp_business":
        token = config.get("access_token") or os.getenv("WHATSAPP_ACCESS_TOKEN")
        phone_id = config.get("phone_id") or os.getenv("WHATSAPP_PHONE_ID")
        if not token or not phone_id:
            return False, "Faltan access_token o phone_id"
        url = f"https://graph.facebook.com/v18.0/{phone_id}"
        try:
            r = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=10)
            if r.status_code == 200:
                return True, "Conexión WhatsApp OK"
            return False, f"HTTP {r.status_code}: {r.text[:200]}"
        except Exception as exc:
            return False, str(exc)

    if integration_key in ("google_calendar", "outlook_calendar"):
        if config.get("client_id") and (config.get("client_secret") or config.get("refresh_token")):
            return True, "Credenciales OAuth presentes — complete flujo OAuth en producción"
        return False, "Configure client_id y client_secret"

    if integration_key in ("fitbit", "google_fit"):
        if config.get("client_id") and config.get("client_secret"):
            return True, "Credenciales OAuth wearables configuradas"
        return False, "Faltan client_id / client_secret"

    if integration_key == "apple_health":
        return True, "Apple Health se activa desde app paciente (HealthKit)"

    if integration_key == "eps_api":
        base = config.get("base_url", "").rstrip("/")
        if not base:
            return False, "URL base requerida"
        try:
            r = requests.get(base, timeout=8)
            return True, f"Endpoint alcanzable (HTTP {r.status_code})"
        except Exception as exc:
            return False, str(exc)

    return False, "Integración desconocida"


def register_integrations_routes(app, deps: dict):
    get_db = deps["get_db"]
    require_superadmin = deps["require_superadmin"]
    OrganizationDB = deps.get("OrganizationDB")
    now_co: Callable = deps["now_co"]

    def _serialize_connection(row) -> dict:
        cat = _catalog_item(row.integration_key) or {}
        return {
            "id": row.id,
            "integration_key": row.integration_key,
            "name": cat.get("name", row.integration_key),
            "category": cat.get("category"),
            "organization_id": row.organization_id,
            "label": row.label,
            "config": mask_config(row.config if isinstance(row.config, dict) else {}),
            "is_enabled": bool(row.is_enabled),
            "status": row.status,
            "last_test_at": row.last_test_at,
            "last_error": row.last_error,
            "updated_at": row.updated_at,
        }

    @app.get("/api/superadmin/integrations/overview")
    def integrations_overview(db: Session = Depends(get_db), current_user=Depends(require_superadmin)):
        connections = []
        if IntegrationConnectionDB is not None:
            connections = [_serialize_connection(c) for c in db.query(IntegrationConnectionDB).all()]

        conn_by_key = {c["integration_key"]: c for c in connections if c.get("is_enabled")}
        catalog = []
        for item in INTEGRATION_CATALOG:
            conn = conn_by_key.get(item["key"])
            env_fallback = {}
            if item["key"] == "whatsapp_business":
                env_fallback = {
                    "env_configured": bool(os.getenv("WHATSAPP_ACCESS_TOKEN") and os.getenv("WHATSAPP_PHONE_ID")),
                }
            catalog.append(
                {
                    **item,
                    "connected": conn is not None,
                    "status": conn["status"] if conn else ("env" if env_fallback.get("env_configured") else "disconnected"),
                    "connection_id": conn["id"] if conn else None,
                    **env_fallback,
                }
            )

        webhook_count = 0
        deliveries_24h = 0
        if OutgoingWebhookDB is not None:
            webhook_count = db.query(OutgoingWebhookDB).filter(OutgoingWebhookDB.is_enabled == 1).count()
        if WebhookDeliveryLogDB is not None:
            since = (now_co() - timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S")
            deliveries_24h = db.query(WebhookDeliveryLogDB).filter(WebhookDeliveryLogDB.attempted_at >= since).count()

        return {
            "catalog": catalog,
            "webhook_events": WEBHOOK_EVENTS,
            "connections": connections,
            "stats": {
                "connected_integrations": len([c for c in catalog if c.get("connected") or c.get("status") == "env"]),
                "active_webhooks": webhook_count,
                "deliveries_24h": deliveries_24h,
            },
        }

    @app.get("/api/superadmin/integrations/connections")
    def list_connections(
        integration_key: Optional[str] = Query(None),
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if IntegrationConnectionDB is None:
            return {"connections": []}
        q = db.query(IntegrationConnectionDB)
        if integration_key:
            q = q.filter(IntegrationConnectionDB.integration_key == integration_key)
        return {"connections": [_serialize_connection(c) for c in q.order_by(IntegrationConnectionDB.id.desc()).all()]}

    @app.post("/api/superadmin/integrations/connections")
    def upsert_connection(
        payload: ConnectionUpsertSchema,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if IntegrationConnectionDB is None:
            raise HTTPException(status_code=503, detail="Módulo no disponible")
        if not _catalog_item(payload.integration_key):
            raise HTTPException(status_code=400, detail="Integración no válida")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        row = (
            db.query(IntegrationConnectionDB)
            .filter(
                IntegrationConnectionDB.integration_key == payload.integration_key,
                IntegrationConnectionDB.organization_id == payload.organization_id,
            )
            .first()
        )
        if row:
            row.config = merge_config(row.config if isinstance(row.config, dict) else {}, payload.config)
            row.is_enabled = 1 if payload.is_enabled else 0
            row.label = payload.label or row.label
            row.updated_at = ts
        else:
            row = IntegrationConnectionDB(
                integration_key=payload.integration_key,
                organization_id=payload.organization_id,
                label=payload.label or _catalog_item(payload.integration_key)["name"],
                config=payload.config,
                is_enabled=1 if payload.is_enabled else 0,
                status="configured",
                created_at=ts,
                updated_at=ts,
            )
            db.add(row)
        db.commit()
        db.refresh(row)
        return {"success": True, "connection": _serialize_connection(row)}

    @app.post("/api/superadmin/integrations/connections/{connection_id}/test")
    def test_connection(
        connection_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if IntegrationConnectionDB is None:
            raise HTTPException(status_code=503, detail="Módulo no disponible")
        row = db.query(IntegrationConnectionDB).filter(IntegrationConnectionDB.id == connection_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Conexión no encontrada")
        cfg = row.config if isinstance(row.config, dict) else {}
        ok, msg = _test_integration(row.integration_key, cfg)
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        row.last_test_at = ts
        row.status = "connected" if ok else "error"
        row.last_error = None if ok else msg
        row.updated_at = ts
        db.commit()
        return {"success": ok, "message": msg, "status": row.status}

    @app.get("/api/superadmin/integrations/webhooks")
    def list_webhooks(db: Session = Depends(get_db), current_user=Depends(require_superadmin)):
        if OutgoingWebhookDB is None:
            return {"webhooks": []}
        rows = db.query(OutgoingWebhookDB).order_by(OutgoingWebhookDB.id.desc()).all()
        return {
            "webhooks": [
                {
                    "id": w.id,
                    "name": w.name,
                    "url": w.url,
                    "events": w.events or [],
                    "is_enabled": bool(w.is_enabled),
                    "organization_id": w.organization_id,
                    "has_secret": bool(w.secret),
                    "created_at": w.created_at,
                }
                for w in rows
            ],
            "events": WEBHOOK_EVENTS,
        }

    @app.post("/api/superadmin/integrations/webhooks")
    def create_webhook(
        payload: WebhookCreateSchema,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if OutgoingWebhookDB is None:
            raise HTTPException(status_code=503, detail="Módulo no disponible")
        invalid = [e for e in payload.events if e not in WEBHOOK_EVENTS]
        if invalid:
            raise HTTPException(status_code=400, detail=f"Eventos inválidos: {invalid}")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        secret = payload.secret or secrets.token_hex(24)
        row = OutgoingWebhookDB(
            name=payload.name.strip(),
            url=payload.url.strip(),
            secret=secret,
            events=payload.events,
            organization_id=payload.organization_id,
            headers=payload.headers or {},
            is_enabled=1 if payload.is_enabled else 0,
            created_at=ts,
            updated_at=ts,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return {"success": True, "id": row.id, "secret": secret}

    @app.patch("/api/superadmin/integrations/webhooks/{webhook_id}")
    def update_webhook(
        webhook_id: int,
        payload: WebhookUpdateSchema,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if OutgoingWebhookDB is None:
            raise HTTPException(status_code=503, detail="Módulo no disponible")
        row = db.query(OutgoingWebhookDB).filter(OutgoingWebhookDB.id == webhook_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Webhook no encontrado")
        data = payload.model_dump(exclude_unset=True)
        if "events" in data:
            invalid = [e for e in data["events"] if e not in WEBHOOK_EVENTS]
            if invalid:
                raise HTTPException(status_code=400, detail=f"Eventos inválidos: {invalid}")
        for k, v in data.items():
            if k == "is_enabled":
                setattr(row, k, 1 if v else 0)
            elif k == "secret" and v in (None, "", "********"):
                continue
            else:
                setattr(row, k, v)
        row.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        return {"success": True}

    @app.delete("/api/superadmin/integrations/webhooks/{webhook_id}")
    def delete_webhook(
        webhook_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        row = db.query(OutgoingWebhookDB).filter(OutgoingWebhookDB.id == webhook_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Webhook no encontrado")
        db.delete(row)
        db.commit()
        return {"success": True}

    @app.get("/api/superadmin/integrations/webhooks/{webhook_id}/deliveries")
    def webhook_deliveries(
        webhook_id: int,
        limit: int = Query(50, ge=1, le=200),
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if WebhookDeliveryLogDB is None:
            return {"deliveries": []}
        rows = (
            db.query(WebhookDeliveryLogDB)
            .filter(WebhookDeliveryLogDB.webhook_id == webhook_id)
            .order_by(WebhookDeliveryLogDB.id.desc())
            .limit(limit)
            .all()
        )
        return {
            "deliveries": [
                {
                    "id": d.id,
                    "event_type": d.event_type,
                    "success": bool(d.success),
                    "status_code": d.status_code,
                    "duration_ms": d.duration_ms,
                    "attempted_at": d.attempted_at,
                    "response_body": (d.response_body or "")[:300],
                }
                for d in rows
            ]
        }

    @app.post("/api/superadmin/integrations/webhooks/{webhook_id}/test")
    def test_webhook(
        webhook_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        row = db.query(OutgoingWebhookDB).filter(OutgoingWebhookDB.id == webhook_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Webhook no encontrado")
        events = row.events if isinstance(row.events, list) else ["patient.created"]
        event = events[0] if events else "patient.created"
        results = dispatch_webhook_event(
            db,
            event,
            {"test": True, "webhook_id": webhook_id, "message": "Evento de prueba NutriData"},
            now_co=now_co,
            organization_id=row.organization_id,
        )
        ok = any(r.get("success") for r in results)
        return {"success": ok, "results": results}
