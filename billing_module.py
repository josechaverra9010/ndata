"""
Centro de facturación NutriData: planes, suscripciones, facturas, revenue.
Proveedores: Stripe, PayU, Wompi (Colombia), manual.
"""
from __future__ import annotations

import io
import json
import os
import secrets
import hashlib
import hmac
from datetime import datetime, timedelta, date
from typing import Optional, List, Callable, Any, TYPE_CHECKING

from fastapi import HTTPException, Depends, Body, Request
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, Text, JSON, ForeignKey, func, or_
from sqlalchemy.orm import Session

if TYPE_CHECKING:
    from sqlalchemy.orm import DeclarativeBase

BillingPlanDB = None
SubscriptionDB = None
InvoiceDB = None
PaymentWebhookDB = None

DEFAULT_PLANS = [
    {
        "code": "basic",
        "name": "Básico",
        "billing_unit": "nutritionist",
        "price_monthly_cop": 89000,
        "price_yearly_cop": 890000,
        "max_patients": 30,
        "max_nutritionists": 1,
        "features": ["plans", "recipes", "appointments"],
        "sort_order": 1,
    },
    {
        "code": "pro",
        "name": "Pro",
        "billing_unit": "nutritionist",
        "price_monthly_cop": 189000,
        "price_yearly_cop": 1890000,
        "max_patients": 100,
        "max_nutritionists": 3,
        "features": ["plans", "recipes", "appointments", "analytics", "clinical_colombia"],
        "sort_order": 2,
    },
    {
        "code": "enterprise",
        "name": "Enterprise",
        "billing_unit": "organization",
        "price_monthly_cop": 890000,
        "price_yearly_cop": 8900000,
        "max_patients": 500,
        "max_nutritionists": 25,
        "features": ["all_modules", "organizations", "eps_dashboard", "priority_support"],
        "sort_order": 3,
    },
]

PAYMENT_PROVIDERS = ("stripe", "payu", "wompi", "manual")
SUBSCRIPTION_STATUSES = ("trialing", "active", "past_due", "cancelled", "blocked")
INVOICE_STATUSES = ("draft", "pending", "paid", "overdue", "failed", "void")


class PlanCreateSchema(BaseModel):
    code: str
    name: str
    billing_unit: str = "nutritionist"
    price_monthly_cop: int
    price_yearly_cop: Optional[int] = None
    max_patients: int = 30
    max_nutritionists: int = 1
    features: Optional[List[str]] = None
    is_active: bool = True
    sort_order: int = 0


class PlanUpdateSchema(BaseModel):
    name: Optional[str] = None
    price_monthly_cop: Optional[int] = None
    price_yearly_cop: Optional[int] = None
    max_patients: Optional[int] = None
    max_nutritionists: Optional[int] = None
    features: Optional[List[str]] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class SubscriptionCreateSchema(BaseModel):
    plan_id: int
    subscriber_type: str  # organization | nutritionist
    subscriber_id: int
    billing_cycle: str = "monthly"  # monthly | yearly
    payment_provider: str = "manual"
    status: str = "active"
    trial_days: int = 0


class SubscriptionUpdateSchema(BaseModel):
    plan_id: Optional[int] = None
    status: Optional[str] = None
    payment_provider: Optional[str] = None
    billing_cycle: Optional[str] = None


class InvoiceCreateSchema(BaseModel):
    subscription_id: int
    amount_cop: Optional[int] = None
    due_date: Optional[str] = None
    status: str = "pending"
    notes: Optional[str] = None


class CheckoutSchema(BaseModel):
    subscription_id: int
    provider: str  # stripe | payu | wompi
    invoice_id: Optional[int] = None
    return_url: Optional[str] = None


def register_billing_models(Base):
    global BillingPlanDB, SubscriptionDB, InvoiceDB, PaymentWebhookDB

    class _BillingPlanDB(Base):
        __tablename__ = "billing_plans"
        id = Column(Integer, primary_key=True, index=True)
        code = Column(String(40), unique=True, nullable=False, index=True)
        name = Column(String(120), nullable=False)
        billing_unit = Column(String(20), default="nutritionist")
        price_monthly_cop = Column(Integer, default=0)
        price_yearly_cop = Column(Integer, nullable=True)
        max_patients = Column(Integer, default=30)
        max_nutritionists = Column(Integer, default=1)
        features = Column(JSON, default=list)
        is_active = Column(Integer, default=1)
        sort_order = Column(Integer, default=0)
        created_at = Column(String(50), nullable=True)
        updated_at = Column(String(50), nullable=True)

    class _SubscriptionDB(Base):
        __tablename__ = "billing_subscriptions"
        id = Column(Integer, primary_key=True, index=True)
        plan_id = Column(Integer, ForeignKey("billing_plans.id"), nullable=False)
        subscriber_type = Column(String(20), nullable=False)
        subscriber_id = Column(Integer, nullable=False, index=True)
        status = Column(String(20), default="active")
        billing_cycle = Column(String(20), default="monthly")
        payment_provider = Column(String(20), default="manual")
        external_subscription_id = Column(String(120), nullable=True)
        current_period_start = Column(String(50), nullable=True)
        current_period_end = Column(String(50), nullable=True)
        cancelled_at = Column(String(50), nullable=True)
        blocked_at = Column(String(50), nullable=True)
        mrr_cop = Column(Integer, default=0)
        created_at = Column(String(50), nullable=True)
        updated_at = Column(String(50), nullable=True)

    class _InvoiceDB(Base):
        __tablename__ = "billing_invoices"
        id = Column(Integer, primary_key=True, index=True)
        subscription_id = Column(Integer, ForeignKey("billing_subscriptions.id"), nullable=False)
        invoice_number = Column(String(40), unique=True, nullable=False, index=True)
        amount_cop = Column(Integer, default=0)
        currency = Column(String(10), default="COP")
        status = Column(String(20), default="pending")
        due_date = Column(String(20), nullable=True)
        paid_at = Column(String(50), nullable=True)
        provider_ref = Column(String(120), nullable=True)
        line_items = Column(JSON, default=list)
        notes = Column(Text, nullable=True)
        created_at = Column(String(50), nullable=True)
        updated_at = Column(String(50), nullable=True)

    class _PaymentWebhookDB(Base):
        __tablename__ = "billing_payment_webhooks"
        id = Column(Integer, primary_key=True, index=True)
        provider = Column(String(20), nullable=False)
        event_type = Column(String(80), nullable=True)
        payload = Column(JSON, nullable=True)
        processed = Column(Integer, default=0)
        created_at = Column(String(50), nullable=True)

    BillingPlanDB = _BillingPlanDB
    SubscriptionDB = _SubscriptionDB
    InvoiceDB = _InvoiceDB
    PaymentWebhookDB = _PaymentWebhookDB
    return BillingPlanDB, SubscriptionDB, InvoiceDB, PaymentWebhookDB


def migrate_billing_schema(engine, inspect_fn, text_fn, BillingPlanDB):
    try:
        insp = inspect_fn(engine)
        tables = insp.get_table_names()
        for model in [BillingPlanDB, SubscriptionDB, InvoiceDB, PaymentWebhookDB]:
            if model and model.__tablename__ not in tables:
                model.__table__.create(bind=engine, checkfirst=True)
    except Exception as e:
        print(f"[BILLING] schema migration: {e}")


def _ensure_default_plans(db: Session, now_co: Callable) -> None:
    if db.query(BillingPlanDB).count() > 0:
        return
    ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
    for p in DEFAULT_PLANS:
        db.add(BillingPlanDB(
            code=p["code"],
            name=p["name"],
            billing_unit=p["billing_unit"],
            price_monthly_cop=p["price_monthly_cop"],
            price_yearly_cop=p.get("price_yearly_cop"),
            max_patients=p["max_patients"],
            max_nutritionists=p["max_nutritionists"],
            features=p.get("features", []),
            is_active=1,
            sort_order=p.get("sort_order", 0),
            created_at=ts,
            updated_at=ts,
        ))
    db.commit()


def _plan_mrr(plan, billing_cycle: str) -> int:
    if billing_cycle == "yearly" and plan.price_yearly_cop:
        return int(plan.price_yearly_cop / 12)
    return plan.price_monthly_cop or 0


def _serialize_plan(p) -> dict:
    return {
        "id": p.id,
        "code": p.code,
        "name": p.name,
        "billing_unit": p.billing_unit,
        "price_monthly_cop": p.price_monthly_cop,
        "price_yearly_cop": p.price_yearly_cop,
        "max_patients": p.max_patients,
        "max_nutritionists": p.max_nutritionists,
        "features": p.features or [],
        "is_active": bool(p.is_active),
        "sort_order": p.sort_order or 0,
    }


def _subscriber_name(db: Session, sub, OrganizationDB, UserDB) -> str:
    if sub.subscriber_type == "organization" and OrganizationDB:
        org = db.query(OrganizationDB).filter(OrganizationDB.id == sub.subscriber_id).first()
        return org.name if org else f"Org #{sub.subscriber_id}"
    if sub.subscriber_type == "nutritionist" and UserDB:
        u = db.query(UserDB).filter(UserDB.id == sub.subscriber_id).first()
        if u:
            return f"{u.nombres or ''} {u.apellidos or ''}".strip() or u.email
    return f"{sub.subscriber_type} #{sub.subscriber_id}"


def _serialize_subscription(db: Session, sub, OrganizationDB, UserDB) -> dict:
    plan = db.query(BillingPlanDB).filter(BillingPlanDB.id == sub.plan_id).first()
    return {
        "id": sub.id,
        "plan_id": sub.plan_id,
        "plan_code": plan.code if plan else None,
        "plan_name": plan.name if plan else None,
        "subscriber_type": sub.subscriber_type,
        "subscriber_id": sub.subscriber_id,
        "subscriber_name": _subscriber_name(db, sub, OrganizationDB, UserDB),
        "status": sub.status,
        "billing_cycle": sub.billing_cycle,
        "payment_provider": sub.payment_provider,
        "external_subscription_id": sub.external_subscription_id,
        "current_period_start": sub.current_period_start,
        "current_period_end": sub.current_period_end,
        "cancelled_at": sub.cancelled_at,
        "blocked_at": sub.blocked_at,
        "mrr_cop": sub.mrr_cop or (_plan_mrr(plan, sub.billing_cycle) if plan else 0),
        "created_at": sub.created_at,
    }


def _serialize_invoice(db: Session, inv, OrganizationDB, UserDB) -> dict:
    sub = db.query(SubscriptionDB).filter(SubscriptionDB.id == inv.subscription_id).first()
    return {
        "id": inv.id,
        "subscription_id": inv.subscription_id,
        "invoice_number": inv.invoice_number,
        "amount_cop": inv.amount_cop,
        "currency": inv.currency,
        "status": inv.status,
        "due_date": inv.due_date,
        "paid_at": inv.paid_at,
        "provider_ref": inv.provider_ref,
        "subscriber_name": _subscriber_name(db, sub, OrganizationDB, UserDB) if sub else None,
        "plan_name": _serialize_plan(db.query(BillingPlanDB).filter(BillingPlanDB.id == sub.plan_id).first())["name"] if sub else None,
        "created_at": inv.created_at,
    }


def _next_invoice_number(db: Session) -> str:
    year = date.today().year
    prefix = f"ND-{year}-"
    last = (
        db.query(InvoiceDB)
        .filter(InvoiceDB.invoice_number.like(f"{prefix}%"))
        .order_by(InvoiceDB.id.desc())
        .first()
    )
    n = 1
    if last and last.invoice_number:
        try:
            n = int(last.invoice_number.split("-")[-1]) + 1
        except Exception:
            n = db.query(InvoiceDB).count() + 1
    return f"{prefix}{n:05d}"


def _count_subscriber_usage(
    db: Session, sub, UserDB, OrganizationMemberDB, PatientMealPlanDB
) -> dict:
    patients = 0
    nutritionists = 0
    if sub.subscriber_type == "organization" and OrganizationMemberDB and UserDB:
        members = (
            db.query(OrganizationMemberDB)
            .filter(OrganizationMemberDB.organization_id == sub.subscriber_id, OrganizationMemberDB.status == "activo")
            .all()
        )
        for m in members:
            u = db.query(UserDB).filter(UserDB.id == m.user_id).first()
            if not u:
                continue
            if u.role == "patient":
                patients += 1
            elif u.role == "admin":
                nutritionists += 1
    elif sub.subscriber_type == "nutritionist" and UserDB:
        nutritionists = 1
        patients = db.query(UserDB).filter(
            UserDB.role == "patient",
            UserDB.nutritionist_id == sub.subscriber_id,
        ).count()
    return {"patients": patients, "nutritionists": nutritionists}


def get_active_subscription(db: Session, subscriber_type: str, subscriber_id: int):
    return (
        db.query(SubscriptionDB)
        .filter(
            SubscriptionDB.subscriber_type == subscriber_type,
            SubscriptionDB.subscriber_id == subscriber_id,
            SubscriptionDB.status.in_(("active", "trialing", "past_due")),
        )
        .order_by(SubscriptionDB.id.desc())
        .first()
    )


def enforce_org_quota(db: Session, org_id: int, user_role: str, UserDB, OrganizationMemberDB, PatientMealPlanDB, now_co: Callable = None):
    """Bloqueo automático si excede cuota o está moroso."""
    _now = now_co or (lambda: datetime.now())
    sub = get_active_subscription(db, "organization", org_id)
    if not sub:
        return
    if sub.status == "past_due":
        raise HTTPException(status_code=402, detail="Suscripción en mora. Regularice el pago para continuar.")
    if sub.status == "blocked":
        raise HTTPException(status_code=403, detail="Suscripción bloqueada por exceder límites o impago.")
    plan = db.query(BillingPlanDB).filter(BillingPlanDB.id == sub.plan_id).first()
    if not plan:
        return
    usage = _count_subscriber_usage(db, sub, UserDB, OrganizationMemberDB, PatientMealPlanDB)
    limit_hit = False
    if user_role == "patient" and plan.max_patients and usage["patients"] >= plan.max_patients:
        limit_hit = True
    if user_role == "admin" and plan.max_nutritionists and usage["nutritionists"] >= plan.max_nutritionists:
        limit_hit = True
    if limit_hit:
        sub.status = "blocked"
        sub.blocked_at = _now().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        raise HTTPException(
            status_code=403,
            detail="Cuota del plan excedida. La suscripción fue bloqueada. Contacte soporte o actualice el plan.",
        )


def enforce_nutritionist_quota(db: Session, nutritionist_id: int, UserDB, now_co: Callable = None):
    _now = now_co or (lambda: datetime.now())
    sub = get_active_subscription(db, "nutritionist", nutritionist_id)
    if not sub:
        return
    if sub.status in ("past_due", "blocked"):
        raise HTTPException(status_code=402, detail="Suscripción del nutricionista suspendida o en mora.")
    plan = db.query(BillingPlanDB).filter(BillingPlanDB.id == sub.plan_id).first()
    if not plan:
        return
    count = db.query(UserDB).filter(UserDB.role == "patient", UserDB.nutritionist_id == nutritionist_id).count()
    if plan.max_patients and count >= plan.max_patients:
        sub.status = "blocked"
        sub.blocked_at = _now().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        raise HTTPException(status_code=403, detail="Límite de pacientes del plan alcanzado.")


def _compute_revenue_metrics(db: Session) -> dict:
    subs = db.query(SubscriptionDB).all()
    active = [s for s in subs if s.status in ("active", "trialing")]
    mrr = sum(s.mrr_cop or 0 for s in active)
    arr = mrr * 12

    now = date.today()
    month_start = now.replace(day=1)
    prev_month_end = month_start - timedelta(days=1)
    prev_month_start = prev_month_end.replace(day=1)

    def _parse_d(s):
        if not s:
            return None
        try:
            return datetime.strptime(str(s)[:10], "%Y-%m-%d").date()
        except Exception:
            return None

    active_start = len([s for s in subs if s.status in ("active", "trialing") or (_parse_d(s.created_at) and _parse_d(s.created_at) <= prev_month_end)])
    cancelled_month = len([
        s for s in subs
        if s.cancelled_at and _parse_d(s.cancelled_at) and _parse_d(s.cancelled_at) >= month_start
    ])
    churn_rate = (cancelled_month / active_start * 100) if active_start else 0.0
    arpa = (mrr / len(active)) if active else 0
    monthly_churn = churn_rate / 100 if churn_rate else 0.01
    ltv = int(arpa / monthly_churn) if monthly_churn > 0 else int(arpa * 24)

    overdue = db.query(InvoiceDB).filter(InvoiceDB.status.in_(("overdue", "pending"))).count()
    delinquent_subs = len([s for s in subs if s.status == "past_due"])

    monthly_revenue = []
    ref = month_start
    for i in range(5, -1, -1):
        month_ref = ref
        for _ in range(i):
            month_ref = (month_ref.replace(day=1) - timedelta(days=1)).replace(day=1)
        next_m = (month_ref.replace(day=28) + timedelta(days=4)).replace(day=1)
        start_str = month_ref.strftime("%Y-%m-%d")
        end_str = next_m.strftime("%Y-%m-%d")
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
        monthly_revenue.append({"name": month_ref.strftime("%b"), "ingresos": int(paid or 0)})

    plan_dist = {}
    for s in active:
        plan = db.query(BillingPlanDB).filter(BillingPlanDB.id == s.plan_id).first()
        key = plan.name if plan else "Otro"
        plan_dist[key] = plan_dist.get(key, 0) + 1

    return {
        "mrr_cop": mrr,
        "arr_cop": arr,
        "active_subscriptions": len(active),
        "churn_rate_pct": round(churn_rate, 2),
        "ltv_cop": ltv,
        "arpa_cop": int(arpa),
        "overdue_invoices": overdue,
        "delinquent_subscriptions": delinquent_subs,
        "monthly_revenue_chart": monthly_revenue,
        "plan_distribution": [{"name": k, "value": v} for k, v in plan_dist.items()],
    }


def build_invoice_pdf_bytes(invoice, sub, plan, subscriber_name: str, site_name: str = "NutriData") -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    w, h = A4
    y = h - 50
    c.setFont("Helvetica-Bold", 18)
    c.drawString(50, y, site_name)
    y -= 30
    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, y, f"Factura {invoice.invoice_number}")
    y -= 22
    c.setFont("Helvetica", 11)
    c.drawString(50, y, f"Cliente: {subscriber_name}")
    y -= 16
    c.drawString(50, y, f"Plan: {plan.name if plan else '—'}")
    y -= 16
    c.drawString(50, y, f"Estado: {invoice.status.upper()}")
    y -= 16
    c.drawString(50, y, f"Vencimiento: {invoice.due_date or '—'}")
    y -= 30
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "Concepto")
    c.drawString(350, y, "Valor (COP)")
    y -= 18
    c.setFont("Helvetica", 11)
    c.drawString(50, y, f"Suscripción {plan.name if plan else ''} — {sub.billing_cycle}")
    c.drawString(350, y, f"${invoice.amount_cop:,.0f}")
    y -= 40
    c.setFont("Helvetica-Bold", 13)
    c.drawString(50, y, f"Total: ${invoice.amount_cop:,.0f} COP")
    c.showPage()
    c.save()
    return buffer.getvalue()


def _provider_has_keys(provider: str) -> bool:
    if provider == "wompi":
        return bool(os.getenv("WOMPI_PUBLIC_KEY") and (os.getenv("WOMPI_PRIVATE_KEY") or os.getenv("WOMPI_INTEGRITY_SECRET")))
    if provider == "payu":
        return bool(os.getenv("PAYU_MERCHANT_ID") and os.getenv("PAYU_API_KEY"))
    if provider == "stripe":
        return bool(os.getenv("STRIPE_SECRET_KEY"))
    return False


def _wompi_api_base() -> str:
    env = (os.getenv("WOMPI_ENV") or "test").lower()
    return "https://sandbox.wompi.co/v1" if env in ("test", "sandbox") else "https://production.wompi.co/v1"


def _create_wompi_payment_link(
    amount_cop: int,
    reference: str,
    description: str,
    return_url: str,
) -> Optional[dict]:
    """Crea payment link real vía Wompi API (Colombia)."""
    private_key = os.getenv("WOMPI_PRIVATE_KEY")
    if not private_key:
        return None
    base = _wompi_api_base()
    payload = {
        "name": (description or "NutriData")[:80],
        "description": (description or reference)[:250],
        "single_use": True,
        "collect_shipping": False,
        "amount_in_cents": int(amount_cop) * 100,
        "currency": "COP",
        "reference": reference,
        "redirect_url": return_url or os.getenv("FRONTEND_URL", "http://localhost:8080"),
    }
    try:
        import requests
        resp = requests.post(
            f"{base}/payment_links",
            headers={
                "Authorization": f"Bearer {private_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=25,
        )
        if resp.status_code not in (200, 201):
            print(f"[Wompi] payment_link error {resp.status_code}: {resp.text[:300]}")
            return None
        data = resp.json().get("data") or {}
        url = data.get("permalink") or data.get("url") or data.get("checkout_url")
        if not url:
            return None
        return {
            "checkout_url": url,
            "reference": reference,
            "provider_id": data.get("id"),
            "sandbox": "sandbox" in base,
        }
    except Exception as exc:
        print(f"[Wompi] {exc}")
        return None


def _verify_wompi_webhook(payload: dict, headers: dict) -> bool:
    """Verifica checksum de evento Wompi cuando WOMPI_EVENTS_SECRET está configurado."""
    secret = os.getenv("WOMPI_EVENTS_SECRET") or os.getenv("WOMPI_INTEGRITY_SECRET")
    if not secret:
        return True  # dev sin secret
    sig = headers.get("x-event-checksum") or headers.get("X-Event-Checksum")
    if not sig:
        return False
    event = payload.get("data", {}) if payload.get("event") else payload
    transaction = event.get("transaction") or event
    ref = transaction.get("reference") or payload.get("reference") or ""
    status = transaction.get("status") or payload.get("status") or ""
    amount = transaction.get("amount_in_cents") or payload.get("amount_in_cents") or 0
    currency = transaction.get("currency") or payload.get("currency") or "COP"
    raw = f"{ref}{amount}{currency}{status}{secret}"
    expected = hashlib.sha256(raw.encode()).hexdigest()
    return hmac.compare_digest(expected, sig)


def _provider_checkout_url(
    provider: str,
    subscription_id: int,
    amount_cop: int,
    return_url: str,
    *,
    reference: Optional[str] = None,
    description: str = "Suscripción NutriData",
) -> dict:
    if not _provider_has_keys(provider):
        return {
            "provider": provider,
            "mode": "manual",
            "checkout_url": None,
            "reference": None,
            "sandbox": False,
            "message": (
                "MVP facturación manual: registre el pago en Facturas o marque la factura como pagada. "
                f"Configure las credenciales de {provider} para checkout en línea."
            ),
        }
    ref = reference or f"ND-{subscription_id}-{secrets.token_hex(6)}"
    base = os.getenv("FRONTEND_URL", "http://localhost:8080")
    if provider == "wompi":
        wompi = _create_wompi_payment_link(amount_cop, ref, description, return_url or base)
        if wompi:
            return {
                "provider": "wompi",
                "mode": "online",
                "checkout_url": wompi["checkout_url"],
                "reference": ref,
                "provider_id": wompi.get("provider_id"),
                "sandbox": wompi.get("sandbox", True),
                "message": "Redirigiendo a checkout Wompi",
            }
        return {
            "provider": "wompi",
            "mode": "manual",
            "checkout_url": None,
            "reference": ref,
            "message": "Configure WOMPI_PRIVATE_KEY y WOMPI_PUBLIC_KEY para checkout en línea",
        }
    if provider == "payu":
        return {
            "provider": "payu",
            "checkout_url": f"https://checkout.payulatam.com/ppp-web-gateway-payu/?ref={ref}",
            "reference": ref,
            "sandbox": True,
            "message": "Integración PayU Latam: configure PAYU_MERCHANT_ID",
        }
    if provider == "stripe":
        return {
            "provider": "stripe",
            "checkout_url": f"{base}/superadmin/billing?stripe_session={ref}&sub={subscription_id}",
            "reference": ref,
            "sandbox": not os.getenv("STRIPE_SECRET_KEY"),
            "message": "Configure STRIPE_SECRET_KEY para Checkout Session real",
        }
    raise HTTPException(status_code=400, detail="Proveedor no soportado")


def register_billing_routes(app, deps: dict):
    get_db = deps["get_db"]
    require_superadmin = deps["require_superadmin"]
    get_current_user = deps["get_current_user"]
    require_admin_or_superadmin = deps["require_admin_or_superadmin"]
    UserDB = deps["UserDB"]
    OrganizationDB = deps.get("OrganizationDB")
    OrganizationMemberDB = deps.get("OrganizationMemberDB")
    PatientMealPlanDB = deps.get("PatientMealPlanDB")
    SystemSettingsDB = deps.get("SystemSettingsDB")
    now_co: Callable = deps["now_co"]

    def _site_name(db):
        if SystemSettingsDB:
            s = db.query(SystemSettingsDB).first()
            if s and s.site_name:
                return s.site_name
        return "NutriData"

    @app.get("/api/superadmin/billing/overview")
    def billing_overview(db: Session = Depends(get_db), current_user=Depends(require_superadmin)):
        _ensure_default_plans(db, now_co)
        metrics = _compute_revenue_metrics(db)
        recent_invoices = (
            db.query(InvoiceDB).order_by(InvoiceDB.id.desc()).limit(10).all()
        )
        metrics["recent_invoices"] = [
            _serialize_invoice(db, i, OrganizationDB, UserDB) for i in recent_invoices
        ]
        return metrics

    @app.get("/api/superadmin/billing/plans")
    def list_plans(db: Session = Depends(get_db), current_user=Depends(require_superadmin)):
        _ensure_default_plans(db, now_co)
        rows = db.query(BillingPlanDB).order_by(BillingPlanDB.sort_order.asc()).all()
        return [_serialize_plan(p) for p in rows]

    @app.post("/api/superadmin/billing/plans")
    def create_plan(payload: PlanCreateSchema, db: Session = Depends(get_db), current_user=Depends(require_superadmin)):
        if db.query(BillingPlanDB).filter(BillingPlanDB.code == payload.code.strip().lower()).first():
            raise HTTPException(status_code=400, detail="Código de plan ya existe")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        row = BillingPlanDB(
            code=payload.code.strip().lower(),
            name=payload.name.strip(),
            billing_unit=payload.billing_unit,
            price_monthly_cop=payload.price_monthly_cop,
            price_yearly_cop=payload.price_yearly_cop,
            max_patients=payload.max_patients,
            max_nutritionists=payload.max_nutritionists,
            features=payload.features or [],
            is_active=1 if payload.is_active else 0,
            sort_order=payload.sort_order,
            created_at=ts,
            updated_at=ts,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return _serialize_plan(row)

    @app.put("/api/superadmin/billing/plans/{plan_id}")
    def update_plan(plan_id: int, payload: PlanUpdateSchema, db: Session = Depends(get_db), current_user=Depends(require_superadmin)):
        row = db.query(BillingPlanDB).filter(BillingPlanDB.id == plan_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Plan no encontrado")
        data = payload.model_dump(exclude_unset=True)
        for k, v in data.items():
            if k == "is_active":
                setattr(row, k, 1 if v else 0)
            else:
                setattr(row, k, v)
        row.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        return _serialize_plan(row)

    @app.get("/api/superadmin/billing/subscriptions")
    def list_subscriptions(
        status: Optional[str] = None,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        q = db.query(SubscriptionDB)
        if status and status != "all":
            q = q.filter(SubscriptionDB.status == status)
        rows = q.order_by(SubscriptionDB.id.desc()).all()
        out = []
        for s in rows:
            item = _serialize_subscription(db, s, OrganizationDB, UserDB)
            if OrganizationMemberDB:
                item["usage"] = _count_subscriber_usage(db, s, UserDB, OrganizationMemberDB, PatientMealPlanDB)
            plan = db.query(BillingPlanDB).filter(BillingPlanDB.id == s.plan_id).first()
            if plan:
                item["limits"] = {"max_patients": plan.max_patients, "max_nutritionists": plan.max_nutritionists}
            out.append(item)
        return out

    @app.post("/api/superadmin/billing/subscriptions")
    def create_subscription(payload: SubscriptionCreateSchema, db: Session = Depends(get_db), current_user=Depends(require_superadmin)):
        plan = db.query(BillingPlanDB).filter(BillingPlanDB.id == payload.plan_id).first()
        if not plan:
            raise HTTPException(status_code=404, detail="Plan no encontrado")
        if payload.subscriber_type not in ("organization", "nutritionist"):
            raise HTTPException(status_code=400, detail="subscriber_type inválido")
        if payload.payment_provider not in PAYMENT_PROVIDERS:
            raise HTTPException(status_code=400, detail="Proveedor inválido")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        start = now_co().date()
        end = start + timedelta(days=payload.trial_days or 30)
        if payload.billing_cycle == "yearly":
            end = start + timedelta(days=365)
        status = "trialing" if payload.trial_days else payload.status
        mrr = _plan_mrr(plan, payload.billing_cycle)
        sub = SubscriptionDB(
            plan_id=plan.id,
            subscriber_type=payload.subscriber_type,
            subscriber_id=payload.subscriber_id,
            status=status,
            billing_cycle=payload.billing_cycle,
            payment_provider=payload.payment_provider,
            current_period_start=start.strftime("%Y-%m-%d"),
            current_period_end=end.strftime("%Y-%m-%d"),
            mrr_cop=mrr,
            created_at=ts,
            updated_at=ts,
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)
        if plan.billing_unit == "organization" and OrganizationDB:
            org = db.query(OrganizationDB).filter(OrganizationDB.id == payload.subscriber_id).first()
            if org:
                org.max_patients = plan.max_patients
                org.max_nutritionists = plan.max_nutritionists
                org.updated_at = ts
                db.commit()
        return _serialize_subscription(db, sub, OrganizationDB, UserDB)

    @app.patch("/api/superadmin/billing/subscriptions/{sub_id}")
    def update_subscription(sub_id: int, payload: SubscriptionUpdateSchema, db: Session = Depends(get_db), current_user=Depends(require_superadmin)):
        sub = db.query(SubscriptionDB).filter(SubscriptionDB.id == sub_id).first()
        if not sub:
            raise HTTPException(status_code=404, detail="Suscripción no encontrada")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        if payload.plan_id is not None:
            plan = db.query(BillingPlanDB).filter(BillingPlanDB.id == payload.plan_id).first()
            if not plan:
                raise HTTPException(status_code=404, detail="Plan no encontrado")
            sub.plan_id = plan.id
            sub.mrr_cop = _plan_mrr(plan, sub.billing_cycle or "monthly")
        if payload.status is not None:
            sub.status = payload.status
            if payload.status == "cancelled":
                sub.cancelled_at = ts
            if payload.status == "blocked":
                sub.blocked_at = ts
        if payload.payment_provider is not None:
            sub.payment_provider = payload.payment_provider
        if payload.billing_cycle is not None:
            sub.billing_cycle = payload.billing_cycle
            plan = db.query(BillingPlanDB).filter(BillingPlanDB.id == sub.plan_id).first()
            if plan:
                sub.mrr_cop = _plan_mrr(plan, payload.billing_cycle)
        sub.updated_at = ts
        db.commit()
        return _serialize_subscription(db, sub, OrganizationDB, UserDB)

    @app.get("/api/superadmin/billing/invoices")
    def list_invoices(
        status: Optional[str] = None,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        q = db.query(InvoiceDB)
        if status and status != "all":
            q = q.filter(InvoiceDB.status == status)
        rows = q.order_by(InvoiceDB.id.desc()).limit(200).all()
        return [_serialize_invoice(db, i, OrganizationDB, UserDB) for i in rows]

    @app.get("/api/superadmin/billing/delinquents")
    def list_delinquents(db: Session = Depends(get_db), current_user=Depends(require_superadmin)):
        overdue_invoices = (
            db.query(InvoiceDB)
            .filter(InvoiceDB.status.in_(("overdue", "pending")))
            .order_by(InvoiceDB.due_date.asc())
            .all()
        )
        past_due_subs = (
            db.query(SubscriptionDB)
            .filter(SubscriptionDB.status.in_(("past_due", "blocked")))
            .all()
        )
        today = date.today().isoformat()
        for inv in overdue_invoices:
            if inv.due_date and inv.due_date < today and inv.status == "pending":
                inv.status = "overdue"
        db.commit()
        return {
            "invoices": [_serialize_invoice(db, i, OrganizationDB, UserDB) for i in overdue_invoices],
            "subscriptions": [_serialize_subscription(db, s, OrganizationDB, UserDB) for s in past_due_subs],
        }

    @app.post("/api/superadmin/billing/invoices")
    def create_invoice(payload: InvoiceCreateSchema, db: Session = Depends(get_db), current_user=Depends(require_superadmin)):
        sub = db.query(SubscriptionDB).filter(SubscriptionDB.id == payload.subscription_id).first()
        if not sub:
            raise HTTPException(status_code=404, detail="Suscripción no encontrada")
        plan = db.query(BillingPlanDB).filter(BillingPlanDB.id == sub.plan_id).first()
        amount = payload.amount_cop
        if amount is None and plan:
            amount = plan.price_yearly_cop if sub.billing_cycle == "yearly" else plan.price_monthly_cop
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        due = payload.due_date or (now_co().date() + timedelta(days=15)).strftime("%Y-%m-%d")
        inv = InvoiceDB(
            subscription_id=sub.id,
            invoice_number=_next_invoice_number(db),
            amount_cop=amount or 0,
            status=payload.status,
            due_date=due,
            line_items=[{"description": f"Plan {plan.name if plan else ''}", "amount_cop": amount}],
            notes=payload.notes,
            created_at=ts,
            updated_at=ts,
        )
        db.add(inv)
        db.commit()
        db.refresh(inv)
        return _serialize_invoice(db, inv, OrganizationDB, UserDB)

    @app.patch("/api/superadmin/billing/invoices/{invoice_id}/pay")
    def mark_invoice_paid(invoice_id: int, db: Session = Depends(get_db), current_user=Depends(require_superadmin)):
        inv = db.query(InvoiceDB).filter(InvoiceDB.id == invoice_id).first()
        if not inv:
            raise HTTPException(status_code=404, detail="Factura no encontrada")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        inv.status = "paid"
        inv.paid_at = ts
        inv.updated_at = ts
        sub = db.query(SubscriptionDB).filter(SubscriptionDB.id == inv.subscription_id).first()
        if sub and sub.status in ("past_due", "blocked"):
            sub.status = "active"
            sub.blocked_at = None
            sub.updated_at = ts
        db.commit()
        return _serialize_invoice(db, inv, OrganizationDB, UserDB)

    @app.get("/api/superadmin/billing/invoices/{invoice_id}/pdf")
    def download_invoice_pdf(invoice_id: int, db: Session = Depends(get_db), current_user=Depends(require_superadmin)):
        inv = db.query(InvoiceDB).filter(InvoiceDB.id == invoice_id).first()
        if not inv:
            raise HTTPException(status_code=404, detail="Factura no encontrada")
        sub = db.query(SubscriptionDB).filter(SubscriptionDB.id == inv.subscription_id).first()
        plan = db.query(BillingPlanDB).filter(BillingPlanDB.id == sub.plan_id).first() if sub else None
        name = _subscriber_name(db, sub, OrganizationDB, UserDB) if sub else "Cliente"
        pdf = build_invoice_pdf_bytes(inv, sub, plan, name, _site_name(db))
        return Response(
            content=pdf,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{inv.invoice_number}.pdf"'},
        )

    @app.post("/api/superadmin/billing/checkout")
    def create_checkout(payload: CheckoutSchema, db: Session = Depends(get_db), current_user=Depends(require_superadmin)):
        sub = db.query(SubscriptionDB).filter(SubscriptionDB.id == payload.subscription_id).first()
        if not sub:
            raise HTTPException(status_code=404, detail="Suscripción no encontrada")
        plan = db.query(BillingPlanDB).filter(BillingPlanDB.id == sub.plan_id).first()
        inv = None
        if payload.invoice_id:
            inv = db.query(InvoiceDB).filter(
                InvoiceDB.id == payload.invoice_id,
                InvoiceDB.subscription_id == sub.id,
            ).first()
            if not inv:
                raise HTTPException(status_code=404, detail="Factura no encontrada")
        amount = inv.amount_cop if inv else (
            plan.price_monthly_cop if sub.billing_cycle != "yearly" else (plan.price_yearly_cop or plan.price_monthly_cop * 12)
        )
        ref = inv.invoice_number if inv else f"SUB-{sub.id}-{secrets.token_hex(4)}"
        desc = f"Factura {inv.invoice_number}" if inv else f"Plan {plan.name if plan else sub.id}"
        result = _provider_checkout_url(
            payload.provider,
            sub.id,
            amount,
            payload.return_url or os.getenv("FRONTEND_URL", ""),
            reference=ref,
            description=desc,
        )
        if inv and result.get("reference"):
            inv.provider_ref = str(result["reference"])
            inv.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
            db.commit()
        result["invoice_id"] = inv.id if inv else None
        result["amount_cop"] = amount
        return result

    @app.post("/api/admin/billing/checkout")
    def admin_create_checkout(
        payload: CheckoutSchema,
        db: Session = Depends(get_db),
        current_user=Depends(require_admin_or_superadmin),
    ):
        """Checkout self-service para nutricionista/org admin."""
        sub = db.query(SubscriptionDB).filter(SubscriptionDB.id == payload.subscription_id).first()
        if not sub:
            raise HTTPException(status_code=404, detail="Suscripción no encontrada")
        if current_user.role == "admin":
            allowed = False
            if sub.subscriber_type == "nutritionist" and sub.subscriber_id == current_user.id:
                allowed = True
            if OrganizationMemberDB and sub.subscriber_type == "organization":
                om = db.query(OrganizationMemberDB).filter(
                    OrganizationMemberDB.user_id == current_user.id,
                    OrganizationMemberDB.organization_id == sub.subscriber_id,
                ).first()
                allowed = bool(om)
            if not allowed:
                raise HTTPException(status_code=403, detail="No autorizado para esta suscripción")
        return create_checkout(payload, db, current_user)

    @app.post("/api/webhooks/billing/{provider}")
    async def billing_webhook(
        provider: str,
        request: Request,
        db: Session = Depends(get_db),
    ):
        body = await request.body()
        try:
            payload = json.loads(body.decode("utf-8") or "{}")
        except Exception:
            payload = {}
        if provider not in ("stripe", "payu", "wompi"):
            raise HTTPException(status_code=400, detail="Proveedor desconocido")
        headers = {k.lower(): v for k, v in request.headers.items()}
        if provider == "wompi" and not _verify_wompi_webhook(payload, headers):
            raise HTTPException(status_code=401, detail="Firma Wompi inválida")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.add(PaymentWebhookDB(provider=provider, event_type=payload.get("event") or payload.get("type"), payload=payload, created_at=ts))
        ref = None
        status_ok = False
        if provider == "wompi":
            data = payload.get("data", {}) if payload.get("event") else payload
            txn = data.get("transaction") or data
            ref = txn.get("reference") or payload.get("reference")
            status_ok = (txn.get("status") or "").upper() == "APPROVED"
        else:
            ref = payload.get("reference") or payload.get("id") or payload.get("transaction_id")
            status_ok = payload.get("status") in ("APPROVED", "paid", "success", "approved")
        if ref:
            inv = db.query(InvoiceDB).filter(InvoiceDB.provider_ref == str(ref)).first()
            if not inv:
                inv = db.query(InvoiceDB).filter(InvoiceDB.invoice_number == str(ref)).first()
            if inv and status_ok:
                inv.status = "paid"
                inv.paid_at = ts
                sub = db.query(SubscriptionDB).filter(SubscriptionDB.id == inv.subscription_id).first()
                if sub:
                    sub.status = "active"
                    sub.blocked_at = None
                    sub.external_subscription_id = str(ref)
                    sub.updated_at = ts
        db.commit()
        return {"received": True}

    @app.get("/api/admin/billing/me")
    def admin_billing_me(db: Session = Depends(get_db), current_user=Depends(require_admin_or_superadmin)):
        """Facturación del nutricionista autenticado."""
        sub = get_active_subscription(db, "nutritionist", current_user.id)
        if not sub:
            org_id = None
            if OrganizationMemberDB:
                om = db.query(OrganizationMemberDB).filter(OrganizationMemberDB.user_id == current_user.id).first()
                org_id = om.organization_id if om else None
            if org_id:
                sub = get_active_subscription(db, "organization", org_id)
        if not sub:
            _ensure_default_plans(db, now_co)
            basic = db.query(BillingPlanDB).filter(BillingPlanDB.code == "basic").first()
            return {
                "plan": _serialize_plan(basic) if basic else None,
                "subscription": None,
                "invoices": [],
                "message": "Sin suscripción activa — contacte al administrador",
            }
        plan = db.query(BillingPlanDB).filter(BillingPlanDB.id == sub.plan_id).first()
        invoices = (
            db.query(InvoiceDB)
            .filter(InvoiceDB.subscription_id == sub.id)
            .order_by(InvoiceDB.id.desc())
            .limit(12)
            .all()
        )
        return {
            "plan": _serialize_plan(plan) if plan else None,
            "subscription": _serialize_subscription(db, sub, OrganizationDB, UserDB),
            "invoices": [_serialize_invoice(db, i, OrganizationDB, UserDB) for i in invoices],
        }
