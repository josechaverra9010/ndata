"""
Soporte nivel 2 NutriData: cola global, SLA, asignación, macros, escalamiento.
"""
from __future__ import annotations

import copy
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional, TYPE_CHECKING

from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import Column, ForeignKey, Integer, String, Text, or_
from sqlalchemy.orm import Session

if TYPE_CHECKING:
    from sqlalchemy.orm import DeclarativeBase

SupportMacroDB = None

SLA_FIRST_RESPONSE_HOURS = {
    "low": 48,
    "normal": 24,
    "high": 4,
    "urgent": 1,
}

SLA_TIER_MULTIPLIERS = {
    "enterprise": 0.5,
    "standard": 1.0,
    "basic": 1.5,
}

SLA_TIER_LABELS = {
    "enterprise": "Enterprise",
    "standard": "Standard",
    "basic": "Basic",
}

PRIORITY_LABELS = {
    "low": "Baja",
    "normal": "Normal",
    "high": "Alta",
    "urgent": "Urgente",
}

TICKET_STATUSES = ("open", "in_progress", "resolved", "closed")
TICKET_LEVELS = ("L1", "L2", "L3")

DEFAULT_MACROS = [
    {
        "title": "Saludo inicial",
        "category": "general",
        "body": "Hola {{nombre}}, gracias por contactar a NutriData. Hemos recibido tu solicitud y la estamos revisando.",
    },
    {
        "title": "Solicitud de información",
        "category": "general",
        "body": "Para ayudarte mejor, ¿podrías indicarnos tu correo registrado y una captura del error si aplica?",
    },
    {
        "title": "Cita / agenda",
        "category": "plans",
        "body": "Puedes revisar y reprogramar tus citas desde el panel Paciente → Mis Citas, o contacta a tu nutricionista.",
    },
    {
        "title": "Escalamiento técnico",
        "category": "technical",
        "body": "Hemos escalado tu caso al equipo técnico (Nivel 2). Te responderemos dentro del SLA de tu prioridad.",
    },
    {
        "title": "Cierre resuelto",
        "category": "general",
        "body": "Tu caso ha sido marcado como resuelto. Si necesitas algo más, abre un nuevo ticket. ¡Éxito con tu plan!",
    },
]


class TicketAssignSchema(BaseModel):
    assigned_agent_id: Optional[int] = None


class TicketRespondSchema(BaseModel):
    admin_response: str
    status: Optional[str] = "in_progress"
    use_macro_id: Optional[int] = None


class TicketUpdateSchema(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_agent_id: Optional[int] = None
    admin_response: Optional[str] = None


class MacroCreateSchema(BaseModel):
    title: str
    body: str
    category: str = "general"
    is_active: bool = True


class MacroUpdateSchema(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None


def register_support_models(Base):
    global SupportMacroDB

    class _SupportMacroDB(Base):
        __tablename__ = "support_response_macros"
        id = Column(Integer, primary_key=True, index=True)
        title = Column(String(200), nullable=False)
        body = Column(Text, nullable=False)
        category = Column(String(50), default="general")
        is_active = Column(Integer, default=1)
        created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
        created_at = Column(String(50), nullable=True)
        updated_at = Column(String(50), nullable=True)

    SupportMacroDB = _SupportMacroDB
    return SupportMacroDB


def migrate_support_schema(engine, inspect_fn, text_fn):
    try:
        inspector = inspect_fn(engine)
        tables = inspector.get_table_names()
        if SupportMacroDB is not None and "support_response_macros" not in tables:
            SupportMacroDB.__table__.create(bind=engine, checkfirst=True)
        if "support_tickets" in tables:
            cols = {c["name"] for c in inspector.get_columns("support_tickets")}
            for col_name, col_sql in [
                ("assigned_agent_id", "INTEGER NULL"),
                ("escalated", "INTEGER DEFAULT 0"),
                ("escalated_at", "VARCHAR(50) NULL"),
                ("sla_due_at", "VARCHAR(50) NULL"),
                ("first_response_at", "VARCHAR(50) NULL"),
                ("ticket_level", "VARCHAR(10) DEFAULT 'L1'"),
            ]:
                if col_name not in cols:
                    with engine.begin() as conn:
                        conn.execute(text_fn(f"ALTER TABLE support_tickets ADD COLUMN {col_name} {col_sql}"))
    except Exception as exc:
        print(f"[MIGRATE] support: {exc}")


def resolve_sla_hours(
    priority: str,
    sla_tier: str = "standard",
    custom_hours: Optional[dict] = None,
) -> float:
    base = SLA_FIRST_RESPONSE_HOURS.get(priority, SLA_FIRST_RESPONSE_HOURS["normal"])
    if isinstance(custom_hours, dict) and priority in custom_hours:
        try:
            return max(0.5, float(custom_hours[priority]))
        except (TypeError, ValueError):
            pass
    mult = SLA_TIER_MULTIPLIERS.get(sla_tier or "standard", 1.0)
    return max(0.5, base * mult)


def resolve_ticket_sla_context(
    db: Session,
    patient_id: Optional[int],
    OrganizationMemberDB,
    OrganizationDB,
) -> tuple:
    tier = "standard"
    custom = None
    org_id = None
    org_name = None
    if db and patient_id and OrganizationMemberDB and OrganizationDB:
        om = (
            db.query(OrganizationMemberDB)
            .filter(OrganizationMemberDB.user_id == patient_id)
            .first()
        )
        if om:
            org_id = om.organization_id
            org = db.query(OrganizationDB).filter(OrganizationDB.id == org_id).first()
            if org:
                org_name = org.name
                tier = getattr(org, "sla_tier", None) or "standard"
                custom = getattr(org, "support_sla_hours", None)
    return tier, custom, org_id, org_name


def compute_sla_due(
    priority: str,
    from_dt: datetime,
    sla_tier: str = "standard",
    custom_hours: Optional[dict] = None,
) -> str:
    hours = resolve_sla_hours(priority, sla_tier, custom_hours)
    return (from_dt + timedelta(hours=hours)).strftime("%Y-%m-%d %H:%M:%S")


def _parse_dt(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f"):
        try:
            return datetime.strptime(s[:19], fmt)
        except Exception:
            pass
    return None


def sla_status(ticket, now_co: Callable) -> dict:
    due = _parse_dt(getattr(ticket, "sla_due_at", None))
    first = getattr(ticket, "first_response_at", None)
    now = now_co()
    if first or getattr(ticket, "status", "") in ("resolved", "closed"):
        return {"state": "met", "label": "SLA cumplido", "breached": False}
    if not due:
        return {"state": "unknown", "label": "Sin SLA", "breached": False}
    if now > due:
        return {"state": "breached", "label": "SLA vencido", "breached": True}
    hours_left = (due - now).total_seconds() / 3600
    if hours_left <= 2:
        return {"state": "warning", "label": f"Vence en {int(hours_left * 60)} min", "breached": False}
    return {"state": "ok", "label": f"Vence {due.strftime('%d/%m %H:%M')}", "breached": False}


def serialize_ticket(t, patient, agent, nutritionist, now_co: Callable) -> dict:
    sla = sla_status(t, now_co)
    return {
        "id": t.id,
        "patient_id": t.patient_id,
        "patient_name": f"{patient.nombres} {patient.apellidos}".strip() if patient else "Desconocido",
        "patient_email": patient.email if patient else "",
        "nutritionist_id": getattr(patient, "nutritionist_id", None) if patient else None,
        "nutritionist_name": (
            f"{nutritionist.nombres} {nutritionist.apellidos}".strip() if nutritionist else None
        ),
        "category": t.category,
        "subject": t.subject,
        "message": t.message,
        "status": t.status,
        "priority": t.priority,
        "priority_label": PRIORITY_LABELS.get(t.priority, t.priority),
        "admin_response": t.admin_response,
        "admin_id": t.admin_id,
        "assigned_agent_id": getattr(t, "assigned_agent_id", None),
        "assigned_agent_name": (
            f"{agent.nombres} {agent.apellidos}".strip() if agent else None
        ),
        "escalated": bool(getattr(t, "escalated", 0)),
        "escalated_at": getattr(t, "escalated_at", None),
        "ticket_level": getattr(t, "ticket_level", None) or "L1",
        "sla_due_at": getattr(t, "sla_due_at", None),
        "first_response_at": getattr(t, "first_response_at", None),
        "sla": sla,
        "created_at": t.created_at,
        "updated_at": t.updated_at,
        "resolved_at": t.resolved_at,
    }


def _ensure_default_macros(db: Session, now_co: Callable):
    if SupportMacroDB is None:
        return
    if db.query(SupportMacroDB).count() > 0:
        return
    ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
    for m in DEFAULT_MACROS:
        db.add(
            SupportMacroDB(
                title=m["title"],
                body=m["body"],
                category=m["category"],
                is_active=1,
                created_at=ts,
                updated_at=ts,
            )
        )
    db.commit()


def apply_macro_body(body: str, context: dict) -> str:
    out = body
    for k, v in context.items():
        out = out.replace(f"{{{{{k}}}}}", str(v or ""))
    return out


def register_support_routes(app, deps: dict):
    get_db = deps["get_db"]
    require_superadmin = deps["require_superadmin"]
    require_admin_or_superadmin = deps["require_admin_or_superadmin"]
    get_current_user = deps["get_current_user"]
    UserDB = deps["UserDB"]
    SupportTicketDB = deps["SupportTicketDB"]
    OrganizationDB = deps.get("OrganizationDB")
    OrganizationMemberDB = deps.get("OrganizationMemberDB")
    log_audit = deps.get("log_audit")
    now_co: Callable = deps["now_co"]
    get_nutritionist_patient_ids = deps.get("get_nutritionist_patient_ids")

    def _load_ticket_context(db, ticket):
        patient = db.query(UserDB).filter(UserDB.id == ticket.patient_id).first()
        agent = None
        aid = getattr(ticket, "assigned_agent_id", None) or ticket.admin_id
        if aid:
            agent = db.query(UserDB).filter(UserDB.id == aid).first()
        nutritionist = None
        if patient and getattr(patient, "nutritionist_id", None):
            nutritionist = db.query(UserDB).filter(UserDB.id == patient.nutritionist_id).first()
        return patient, agent, nutritionist

    def _escalate_ticket_to_l2(db, ticket, actor, source: str):
        if getattr(ticket, "escalated", 0):
            raise HTTPException(status_code=400, detail="Ticket ya escalado a L2")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        ticket.escalated = 1
        ticket.escalated_at = ts
        ticket.ticket_level = "L2"
        ticket.priority = "high" if ticket.priority not in ("high", "urgent") else ticket.priority
        tier, custom, _, _ = resolve_ticket_sla_context(
            db, ticket.patient_id, OrganizationMemberDB, OrganizationDB
        )
        ticket.sla_due_at = compute_sla_due(ticket.priority, now_co(), tier, custom)
        ticket.updated_at = ts
        if log_audit:
            log_audit(
                db,
                actor=actor,
                action="escalate",
                entity_type="support_ticket",
                entity_id=ticket.id,
                patient_id=ticket.patient_id,
                summary=f"Ticket #{ticket.id} escalado a L2 ({source})",
                now_co=now_co,
            )
        db.commit()
        return {"success": True, "ticket_level": "L2", "escalated_at": ts}

    def _nutritionist_owns_ticket(db, ticket, user) -> bool:
        if user.role == "superadmin":
            return True
        if user.role != "admin" or not get_nutritionist_patient_ids:
            return False
        pids = get_nutritionist_patient_ids(db, user.id)
        return ticket.patient_id in pids

    @app.post("/api/support/tickets/{ticket_id}/escalate")
    def nutritionist_escalate_ticket(
        ticket_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(require_admin_or_superadmin),
    ):
        """Nutricionista escala ticket a cola L2 centralizada."""
        ticket = db.query(SupportTicketDB).filter(SupportTicketDB.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket no encontrado")
        if not _nutritionist_owns_ticket(db, ticket, current_user):
            raise HTTPException(status_code=403, detail="No autorizado para este ticket")
        return _escalate_ticket_to_l2(db, ticket, current_user, "nutricionista")

    @app.get("/api/support/tickets")
    def get_support_tickets_filtered(
        status: Optional[str] = Query(None),
        category: Optional[str] = Query(None),
        priority: Optional[str] = Query(None),
        db: Session = Depends(get_db),
        current_user=Depends(require_admin_or_superadmin),
    ):
        """Nutricionista: solo sus pacientes. Superadmin: todos (usar /superadmin/support/tickets)."""
        query = db.query(SupportTicketDB)
        if current_user.role == "admin" and get_nutritionist_patient_ids:
            pids = get_nutritionist_patient_ids(db, current_user.id)
            if not pids:
                return []
            query = query.filter(SupportTicketDB.patient_id.in_(pids))
        if status:
            query = query.filter(SupportTicketDB.status == status)
        if category:
            query = query.filter(SupportTicketDB.category == category)
        if priority:
            query = query.filter(SupportTicketDB.priority == priority)
        tickets = query.order_by(SupportTicketDB.created_at.desc()).all()
        result = []
        for t in tickets:
            patient, agent, nutritionist = _load_ticket_context(db, t)
            result.append(serialize_ticket(t, patient, agent, nutritionist, now_co))
        return result

    @app.get("/api/superadmin/support/overview")
    def support_overview(
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        _ensure_default_macros(db, now_co)
        tickets = db.query(SupportTicketDB).filter(
            SupportTicketDB.status.in_(("open", "in_progress"))
        ).all()
        breached = 0
        escalated = 0
        unassigned = 0
        for t in tickets:
            if sla_status(t, now_co).get("breached"):
                breached += 1
            if getattr(t, "escalated", 0):
                escalated += 1
            if not getattr(t, "assigned_agent_id", None):
                unassigned += 1
        agents = (
            db.query(UserDB)
            .filter(UserDB.role.in_(("admin", "superadmin")), UserDB.status == "activo")
            .all()
        )
        return {
            "stats": {
                "open_total": len(tickets),
                "sla_breached": breached,
                "escalated": escalated,
                "unassigned": unassigned,
                "macros_count": db.query(SupportMacroDB).count() if SupportMacroDB else 0,
            },
            "sla_hours": SLA_FIRST_RESPONSE_HOURS,
            "sla_tiers": SLA_TIER_LABELS,
            "sla_tier_multipliers": SLA_TIER_MULTIPLIERS,
            "priority_labels": PRIORITY_LABELS,
            "agents": [
                {"id": a.id, "name": f"{a.nombres} {a.apellidos}".strip() or a.email, "role": a.role}
                for a in agents
            ],
        }

    @app.get("/api/superadmin/support/tickets")
    def superadmin_tickets(
        status: Optional[str] = Query(None),
        priority: Optional[str] = Query(None),
        assigned: Optional[str] = Query(None),
        escalated_only: bool = Query(False),
        sla_breached: bool = Query(False),
        limit: int = Query(100, ge=1, le=500),
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        q = db.query(SupportTicketDB)
        if status:
            q = q.filter(SupportTicketDB.status == status)
        if priority:
            q = q.filter(SupportTicketDB.priority == priority)
        if assigned == "unassigned":
            q = q.filter(or_(SupportTicketDB.assigned_agent_id.is_(None), SupportTicketDB.assigned_agent_id == 0))
        elif assigned == "me":
            q = q.filter(SupportTicketDB.assigned_agent_id == current_user.id)
        elif assigned and assigned.isdigit():
            q = q.filter(SupportTicketDB.assigned_agent_id == int(assigned))
        if escalated_only:
            q = q.filter(SupportTicketDB.escalated == 1)
        rows = q.order_by(SupportTicketDB.created_at.desc()).limit(limit).all()
        result = []
        for t in rows:
            patient, agent, nutritionist = _load_ticket_context(db, t)
            item = serialize_ticket(t, patient, agent, nutritionist, now_co)
            if sla_breached and not item["sla"].get("breached"):
                continue
            result.append(item)
        return {"tickets": result, "count": len(result)}

    @app.patch("/api/superadmin/support/tickets/{ticket_id}")
    def superadmin_update_ticket(
        ticket_id: int,
        payload: TicketUpdateSchema,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        ticket = db.query(SupportTicketDB).filter(SupportTicketDB.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket no encontrado")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        data = payload.model_dump(exclude_unset=True)
        if "status" in data and data["status"] not in TICKET_STATUSES:
            raise HTTPException(status_code=400, detail="Estado inválido")
        if "priority" in data:
            ticket.priority = data["priority"]
            tier, custom, _, _ = resolve_ticket_sla_context(
                db, ticket.patient_id, OrganizationMemberDB, OrganizationDB
            )
            ticket.sla_due_at = compute_sla_due(
                data["priority"],
                _parse_dt(ticket.created_at) or now_co(),
                tier,
                custom,
            )
        if "assigned_agent_id" in data:
            ticket.assigned_agent_id = data["assigned_agent_id"]
            if data["assigned_agent_id"]:
                ticket.ticket_level = "L2"
        if "admin_response" in data and data["admin_response"]:
            ticket.admin_response = data["admin_response"]
            ticket.admin_id = current_user.id
            if not getattr(ticket, "first_response_at", None):
                ticket.first_response_at = ts
        if "status" in data:
            ticket.status = data["status"]
            if data["status"] in ("resolved", "closed"):
                ticket.resolved_at = ts
        ticket.updated_at = ts
        db.commit()
        patient, agent, nutritionist = _load_ticket_context(db, ticket)
        return {"success": True, "ticket": serialize_ticket(ticket, patient, agent, nutritionist, now_co)}

    @app.post("/api/superadmin/support/tickets/{ticket_id}/assign")
    def assign_ticket(
        ticket_id: int,
        payload: TicketAssignSchema,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        ticket = db.query(SupportTicketDB).filter(SupportTicketDB.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket no encontrado")
        ticket.assigned_agent_id = payload.assigned_agent_id
        ticket.ticket_level = "L2" if payload.assigned_agent_id else getattr(ticket, "ticket_level", "L1")
        ticket.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        return {"success": True, "assigned_agent_id": payload.assigned_agent_id}

    @app.post("/api/superadmin/support/tickets/{ticket_id}/respond")
    def respond_ticket(
        ticket_id: int,
        payload: TicketRespondSchema,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        ticket = db.query(SupportTicketDB).filter(SupportTicketDB.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket no encontrado")
        patient, _, _ = _load_ticket_context(db, ticket)
        body = payload.admin_response
        if payload.use_macro_id and SupportMacroDB:
            macro = db.query(SupportMacroDB).filter(SupportMacroDB.id == payload.use_macro_id).first()
            if macro:
                body = apply_macro_body(
                    macro.body,
                    {"nombre": patient.nombres if patient else "", "email": patient.email if patient else ""},
                )
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        ticket.admin_response = body
        ticket.admin_id = current_user.id
        if not getattr(ticket, "first_response_at", None):
            ticket.first_response_at = ts
        if payload.status:
            ticket.status = payload.status
        ticket.updated_at = ts
        db.commit()
        return {"success": True, "admin_response": body}

    @app.post("/api/superadmin/support/tickets/{ticket_id}/escalate")
    def escalate_ticket(
        ticket_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        ticket = db.query(SupportTicketDB).filter(SupportTicketDB.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket no encontrado")
        return _escalate_ticket_to_l2(db, ticket, current_user, "superadmin")

    @app.get("/api/superadmin/support/macros")
    def list_macros(
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        _ensure_default_macros(db, now_co)
        if SupportMacroDB is None:
            return {"macros": []}
        rows = db.query(SupportMacroDB).order_by(SupportMacroDB.category, SupportMacroDB.title).all()
        return {
            "macros": [
                {
                    "id": m.id,
                    "title": m.title,
                    "body": m.body,
                    "category": m.category,
                    "is_active": bool(m.is_active),
                }
                for m in rows
            ]
        }

    @app.post("/api/superadmin/support/macros")
    def create_macro(
        payload: MacroCreateSchema,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if SupportMacroDB is None:
            raise HTTPException(status_code=503, detail="Macros no disponibles")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        row = SupportMacroDB(
            title=payload.title.strip(),
            body=payload.body.strip(),
            category=payload.category,
            is_active=1 if payload.is_active else 0,
            created_by=current_user.id,
            created_at=ts,
            updated_at=ts,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return {"success": True, "id": row.id}

    @app.put("/api/superadmin/support/macros/{macro_id}")
    def update_macro(
        macro_id: int,
        payload: MacroUpdateSchema,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if SupportMacroDB is None:
            raise HTTPException(status_code=503, detail="Macros no disponibles")
        row = db.query(SupportMacroDB).filter(SupportMacroDB.id == macro_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Macro no encontrada")
        data = payload.model_dump(exclude_unset=True)
        for k, v in data.items():
            if k == "is_active":
                setattr(row, k, 1 if v else 0)
            else:
                setattr(row, k, v)
        row.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        return {"success": True}

    @app.delete("/api/superadmin/support/macros/{macro_id}")
    def delete_macro(
        macro_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        row = db.query(SupportMacroDB).filter(SupportMacroDB.id == macro_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Macro no encontrada")
        db.delete(row)
        db.commit()
        return {"success": True}


def on_ticket_created(
    ticket,
    priority: str,
    now_co: Callable,
    db=None,
    OrganizationMemberDB=None,
    OrganizationDB=None,
):
    """Llamar tras crear ticket para fijar SLA según tier de la organización."""
    tier = "standard"
    custom = None
    if db is not None:
        tier, custom, _, _ = resolve_ticket_sla_context(
            db, getattr(ticket, "patient_id", None), OrganizationMemberDB, OrganizationDB
        )
    if hasattr(ticket, "sla_due_at"):
        ticket.sla_due_at = compute_sla_due(priority, now_co(), tier, custom)
    if hasattr(ticket, "ticket_level"):
        ticket.ticket_level = "L1"
