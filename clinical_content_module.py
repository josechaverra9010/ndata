"""
Gestión de contenido clínico NutriData — intervenciones, artículos por condición,
retos Fase 3, sustituciones Fase 4, checklists prep cita.
"""
from __future__ import annotations

import copy
import json
from typing import Any, Callable, Dict, List, Optional, TYPE_CHECKING

from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, Column, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Session

if TYPE_CHECKING:
    from sqlalchemy.orm import DeclarativeBase

ChallengeTemplateDB = None
FoodSubstitutionGroupDB = None
AppointmentPrepTemplateDB = None

# Fallbacks (migrados a DB en primer arranque)
DEFAULT_CHALLENGE_TEMPLATES = [
    {"key": "daily_water", "title": "Hidratación del día", "description": "Bebe al menos 2 litros de agua hoy", "target": 2000, "metric": "water_ml_today", "points": 10, "icon": "droplets", "period": "daily", "sort_order": 1},
    {"key": "week_meals_5", "title": "5 comidas registradas", "description": "Completa al menos 5 comidas esta semana", "target": 5, "metric": "completed_meals_week", "points": 25, "icon": "utensils", "period": "weekly", "sort_order": 2},
    {"key": "week_adherence_70", "title": "Adherencia semanal 70%", "description": "Alcanza al menos 70% de adherencia esta semana", "target": 70, "metric": "week_adherence_pct", "points": 30, "icon": "target", "period": "weekly", "sort_order": 3},
    {"key": "log_weight_week", "title": "Peso de la semana", "description": "Registra tu peso al menos una vez esta semana", "target": 1, "metric": "weight_logs_week", "points": 15, "icon": "scale", "period": "weekly", "sort_order": 4},
    {"key": "streak_3", "title": "Racha de 3 días", "description": "Registra comidas 3 días consecutivos", "target": 3, "metric": "streak_days", "points": 20, "icon": "flame", "period": "rolling", "sort_order": 5},
]

DEFAULT_PREP_ITEMS = [
    {"key": "register_meals", "label": "Registrar comidas de los últimos 3 días", "auto_check_rule": "meals_3d", "sort_order": 1},
    {"key": "update_weight", "label": "Actualizar mi peso esta semana", "auto_check_rule": "weight_7d", "sort_order": 2},
    {"key": "review_menu", "label": "Revisar el menú de la semana", "auto_check_rule": "active_plan", "sort_order": 3},
    {"key": "prepare_questions", "label": "Preparar preguntas para la consulta", "auto_check_rule": None, "sort_order": 4},
    {"key": "confirm_attendance", "label": "Confirmar asistencia a la cita", "auto_check_rule": "confirmed_appt", "sort_order": 5},
]

DEFAULT_SUBSTITUTION_GROUPS = {
    "pollo": {"category": "Proteína magra", "keywords": ["pollo", "pechuga", "muslo"], "alternatives": [
        {"name": "Pechuga de pavo", "portion": "120 g", "reason": "Proteína similar, menos grasa saturada"},
        {"name": "Filete de tilapia", "portion": "130 g", "reason": "Proteína magra, fácil digestión"},
        {"name": "Lomo de cerdo magro", "portion": "110 g", "reason": "Intercambio 1:1 en proteínas"},
        {"name": "Tofu firme", "portion": "150 g", "reason": "Opción vegetal rica en proteína"},
        {"name": "Huevo entero", "portion": "2 unidades", "reason": "Proteína completa de alta calidad"},
    ]},
    "pechuga de pollo": {"category": "Proteína magra", "keywords": ["pechuga"], "alternatives": [
        {"name": "Pechuga de pavo", "portion": "120 g", "reason": "Intercambio directo"},
        {"name": "Merluza o bagre", "portion": "140 g", "reason": "Pescado blanco magro"},
    ]},
    "pescado": {"category": "Proteína magra", "keywords": ["pescado", "tilapia", "salmón", "atún", "merluza"], "alternatives": [
        {"name": "Salmón", "portion": "100 g", "reason": "Grasas saludables omega-3"},
        {"name": "Atún en agua", "portion": "120 g", "reason": "Proteína magra práctica"},
        {"name": "Pechuga de pollo", "portion": "120 g", "reason": "Intercambio clásico de proteína magra"},
    ]},
    "arroz": {"category": "Carbohidrato", "keywords": ["arroz"], "alternatives": [
        {"name": "Quinoa cocida", "portion": "150 g", "reason": "Más proteína y fibra"},
        {"name": "Papa cocida", "portion": "200 g", "reason": "Carbohidrato de absorción moderada"},
        {"name": "Pasta integral", "portion": "140 g cocida", "reason": "Similar energía, más fibra"},
    ]},
    "pasta": {"category": "Carbohidrato", "keywords": ["pasta", "espagueti", "fideos"], "alternatives": [
        {"name": "Arroz integral", "portion": "150 g cocido", "reason": "Mismo grupo de intercambio"},
        {"name": "Cuscús integral", "portion": "140 g", "reason": "Preparación rápida similar"},
    ]},
    "pan": {"category": "Carbohidrato", "keywords": ["pan", "tostada", "arepa"], "alternatives": [
        {"name": "Arepa integral", "portion": "1 unidad", "reason": "Equivalente regional"},
        {"name": "Tortilla de maíz", "portion": "2 unidades", "reason": "Porción similar en carbohidratos"},
    ]},
    "leche": {"category": "Lácteo", "keywords": ["leche", "lácteo"], "alternatives": [
        {"name": "Yogurt natural sin azúcar", "portion": "200 ml", "reason": "Calcio y proteína similares"},
        {"name": "Bebida de soya fortificada", "portion": "200 ml", "reason": "Opción sin lactosa"},
    ]},
    "huevo": {"category": "Proteína", "keywords": ["huevo", "huevos"], "alternatives": [
        {"name": "Claras de huevo", "portion": "3 unidades", "reason": "Proteína sin grasa del huevo"},
        {"name": "Queso cottage", "portion": "100 g", "reason": "Proteína de alta calidad"},
    ]},
    "carne de res": {"category": "Proteína", "keywords": ["carne", "res", "lomo", "cerdo"], "alternatives": [
        {"name": "Lomo de cerdo magro", "portion": "110 g", "reason": "Menos grasa saturada"},
        {"name": "Pechuga de pollo", "portion": "120 g", "reason": "Proteína magra preferida"},
    ]},
    "ensalada": {"category": "Verdura", "keywords": ["ensalada", "verdura"], "alternatives": [
        {"name": "Vegetales al vapor", "portion": "200 g", "reason": "Mismo grupo, diferente preparación"},
        {"name": "Sopa de verduras", "portion": "1 taza", "reason": "Aporta volumen y saciedad"},
    ]},
}

CLINICAL_CONDITIONS = {
    "diabetes": "Diabetes mellitus",
    "obesidad": "Obesidad / sobrepeso",
    "hipertension": "Hipertensión",
    "embarazo": "Embarazo y lactancia",
    "renal": "Enfermedad renal",
    "dislipidemia": "Dislipidemia",
    "general": "General / prevención",
}

INTERVENTION_CATEGORIES = {
    "general": "General",
    "dm2": "Diabetes mellitus 2",
    "hta": "Hipertensión",
    "obesidad": "Obesidad / sobrepeso",
    "embarazo": "Embarazo y lactancia",
    "pediatria": "Pediatría",
    "renal": "Enfermedad renal",
    "dislipidemia": "Dislipidemia",
}

INTERVENTION_CONTENT_TYPES = {
    "recommendation": "Recomendación clínica",
    "message": "Mensaje al paciente",
    "smart_goal": "Meta SMART",
}


class InterventionTemplateSchema(BaseModel):
    title: str
    category: str = "general"
    content_type: str = "recommendation"
    condition_tags: List[str] = Field(default_factory=list)
    body: str
    is_system: bool = True


class InterventionUpdateSchema(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    content_type: Optional[str] = None
    condition_tags: Optional[List[str]] = None
    body: Optional[str] = None
    is_system: Optional[bool] = None


class ChallengeTemplateSchema(BaseModel):
    key: str
    title: str
    description: str
    target: int
    metric: str
    points: int = 10
    icon: str = "award"
    period: str = "weekly"
    sort_order: int = 0
    is_active: bool = True


class ChallengeUpdateSchema(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    target: Optional[int] = None
    metric: Optional[str] = None
    points: Optional[int] = None
    icon: Optional[str] = None
    period: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class SubstitutionGroupSchema(BaseModel):
    ingredient_key: str
    category: str
    alternatives: List[Dict[str, str]]
    keywords: List[str] = Field(default_factory=list)
    sort_order: int = 0
    is_active: bool = True


class SubstitutionUpdateSchema(BaseModel):
    category: Optional[str] = None
    alternatives: Optional[List[Dict[str, str]]] = None
    keywords: Optional[List[str]] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class PrepItemSchema(BaseModel):
    key: str
    label: str
    auto_check_rule: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class PrepItemUpdateSchema(BaseModel):
    label: Optional[str] = None
    auto_check_rule: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class ArticleConditionsUpdateSchema(BaseModel):
    clinical_conditions: List[str] = Field(default_factory=list)


def register_clinical_content_models(Base):
    global ChallengeTemplateDB, FoodSubstitutionGroupDB, AppointmentPrepTemplateDB

    class _ChallengeTemplateDB(Base):
        __tablename__ = "challenge_templates"
        id = Column(Integer, primary_key=True, index=True)
        key = Column(String(60), unique=True, nullable=False, index=True)
        title = Column(String(200), nullable=False)
        description = Column(Text, nullable=True)
        target = Column(Integer, default=1)
        metric = Column(String(60), nullable=False)
        points = Column(Integer, default=10)
        icon = Column(String(40), default="award")
        period = Column(String(20), default="weekly")
        sort_order = Column(Integer, default=0)
        is_active = Column(Integer, default=1)
        created_at = Column(String(50), nullable=True)
        updated_at = Column(String(50), nullable=True)

    class _FoodSubstitutionGroupDB(Base):
        __tablename__ = "food_substitution_groups"
        id = Column(Integer, primary_key=True, index=True)
        ingredient_key = Column(String(120), unique=True, nullable=False, index=True)
        category = Column(String(80), nullable=False)
        alternatives = Column(JSON, default=list)
        keywords = Column(JSON, default=list)
        sort_order = Column(Integer, default=0)
        is_active = Column(Integer, default=1)
        created_at = Column(String(50), nullable=True)
        updated_at = Column(String(50), nullable=True)

    class _AppointmentPrepTemplateDB(Base):
        __tablename__ = "appointment_prep_template_items"
        id = Column(Integer, primary_key=True, index=True)
        key = Column(String(60), unique=True, nullable=False, index=True)
        label = Column(String(300), nullable=False)
        auto_check_rule = Column(String(40), nullable=True)
        sort_order = Column(Integer, default=0)
        is_active = Column(Integer, default=1)
        created_at = Column(String(50), nullable=True)
        updated_at = Column(String(50), nullable=True)

    ChallengeTemplateDB = _ChallengeTemplateDB
    FoodSubstitutionGroupDB = _FoodSubstitutionGroupDB
    AppointmentPrepTemplateDB = _AppointmentPrepTemplateDB
    return ChallengeTemplateDB, FoodSubstitutionGroupDB, AppointmentPrepTemplateDB


def migrate_clinical_content_schema(engine, inspect_fn, text_fn, InterventionTemplateDB=None):
    try:
        inspector = inspect_fn(engine)
        tables = inspector.get_table_names()
        for model in (ChallengeTemplateDB, FoodSubstitutionGroupDB, AppointmentPrepTemplateDB):
            if model is not None and model.__tablename__ not in tables:
                model.__table__.create(bind=engine, checkfirst=True)
        if "articles" in tables:
            cols = {c["name"] for c in inspector.get_columns("articles")}
            if "clinical_conditions" not in cols:
                with engine.begin() as conn:
                    conn.execute(text_fn("ALTER TABLE articles ADD COLUMN clinical_conditions TEXT NULL"))
    except Exception as exc:
        print(f"[MIGRATE] clinical_content: {exc}")


def seed_clinical_content_defaults(db: Session, now_co: Callable, InterventionTemplateDB=None):
    ts = now_co().strftime("%Y-%m-%d %H:%M:%S")

    if ChallengeTemplateDB is not None and db.query(ChallengeTemplateDB).count() == 0:
        for item in DEFAULT_CHALLENGE_TEMPLATES:
            db.add(ChallengeTemplateDB(
                key=item["key"], title=item["title"], description=item["description"],
                target=item["target"], metric=item["metric"], points=item["points"],
                icon=item["icon"], period=item["period"], sort_order=item.get("sort_order", 0),
                is_active=1, created_at=ts, updated_at=ts,
            ))

    if FoodSubstitutionGroupDB is not None and db.query(FoodSubstitutionGroupDB).count() == 0:
        for i, (key, data) in enumerate(DEFAULT_SUBSTITUTION_GROUPS.items()):
            db.add(FoodSubstitutionGroupDB(
                ingredient_key=key, category=data["category"],
                alternatives=data["alternatives"], keywords=data.get("keywords", [key]),
                sort_order=i, is_active=1, created_at=ts, updated_at=ts,
            ))

    if AppointmentPrepTemplateDB is not None and db.query(AppointmentPrepTemplateDB).count() == 0:
        for item in DEFAULT_PREP_ITEMS:
            db.add(AppointmentPrepTemplateDB(
                key=item["key"], label=item["label"],
                auto_check_rule=item.get("auto_check_rule"),
                sort_order=item.get("sort_order", 0), is_active=1,
                created_at=ts, updated_at=ts,
            ))

    if InterventionTemplateDB is not None:
        try:
            from nutritionist_module import _seed_default_interventions
            _seed_default_interventions(db, now_co)
        except Exception:
            existing = db.query(InterventionTemplateDB).filter(InterventionTemplateDB.is_system == 1).count()
            if existing == 0:
                for item in [
                    {"title": "Recordatorio registro de comidas", "category": "general", "content_type": "message", "condition_tags": ["adherencia"], "body": "Hola {paciente}, registra tus comidas esta semana."},
                ]:
                    db.add(InterventionTemplateDB(
                        nutritionist_id=None, title=item["title"], category=item["category"],
                        content_type=item["content_type"], condition_tags=item["condition_tags"],
                        body=item["body"], is_system=1, created_at=ts, updated_at=ts,
                    ))
    db.commit()


def load_challenge_defs(db: Session) -> List[dict]:
    if ChallengeTemplateDB is None:
        return copy.deepcopy(DEFAULT_CHALLENGE_TEMPLATES)
    rows = (
        db.query(ChallengeTemplateDB)
        .filter(ChallengeTemplateDB.is_active == 1)
        .order_by(ChallengeTemplateDB.sort_order.asc(), ChallengeTemplateDB.id.asc())
        .all()
    )
    if not rows:
        return copy.deepcopy(DEFAULT_CHALLENGE_TEMPLATES)
    return [{
        "key": r.key, "title": r.title, "description": r.description or "",
        "target": r.target, "metric": r.metric, "points": r.points,
        "icon": r.icon or "award", "period": r.period or "weekly",
    } for r in rows]


def load_prep_item_defs(db: Session) -> List[dict]:
    if AppointmentPrepTemplateDB is None:
        return copy.deepcopy(DEFAULT_PREP_ITEMS)
    rows = (
        db.query(AppointmentPrepTemplateDB)
        .filter(AppointmentPrepTemplateDB.is_active == 1)
        .order_by(AppointmentPrepTemplateDB.sort_order.asc())
        .all()
    )
    if not rows:
        return [{"key": d["key"], "label": d["label"]} for d in DEFAULT_PREP_ITEMS]
    return [{"key": r.key, "label": r.label, "auto_check_rule": r.auto_check_rule} for r in rows]


def load_substitution_groups(db: Session) -> Dict[str, dict]:
    if FoodSubstitutionGroupDB is None:
        return copy.deepcopy(DEFAULT_SUBSTITUTION_GROUPS)
    rows = (
        db.query(FoodSubstitutionGroupDB)
        .filter(FoodSubstitutionGroupDB.is_active == 1)
        .order_by(FoodSubstitutionGroupDB.sort_order.asc())
        .all()
    )
    if not rows:
        return copy.deepcopy(DEFAULT_SUBSTITUTION_GROUPS)
    result = {}
    for r in rows:
        result[r.ingredient_key] = {
            "category": r.category,
            "alternatives": r.alternatives if isinstance(r.alternatives, list) else [],
            "keywords": r.keywords if isinstance(r.keywords, list) else [r.ingredient_key],
        }
    return result


def register_clinical_content_routes(app, deps: dict):
    get_db = deps["get_db"]
    require_superadmin = deps["require_superadmin"]
    InterventionTemplateDB = deps["InterventionTemplateDB"]
    ArticleDB = deps["ArticleDB"]
    now_co = deps["now_co"]
    log_audit = deps.get("log_audit")

    @app.get("/api/superadmin/clinical-content/overview")
    def clinical_content_overview(
        db: Session = Depends(get_db),
        _=Depends(require_superadmin),
    ):
        seed_clinical_content_defaults(db, now_co, InterventionTemplateDB)
        interventions = db.query(InterventionTemplateDB).filter(InterventionTemplateDB.is_system == 1).count()
        challenges = db.query(ChallengeTemplateDB).filter(ChallengeTemplateDB.is_active == 1).count() if ChallengeTemplateDB else len(DEFAULT_CHALLENGE_TEMPLATES)
        substitutions = db.query(FoodSubstitutionGroupDB).filter(FoodSubstitutionGroupDB.is_active == 1).count() if FoodSubstitutionGroupDB else len(DEFAULT_SUBSTITUTION_GROUPS)
        prep_items = db.query(AppointmentPrepTemplateDB).filter(AppointmentPrepTemplateDB.is_active == 1).count() if AppointmentPrepTemplateDB else len(DEFAULT_PREP_ITEMS)
        edu_articles = db.query(ArticleDB).filter(ArticleDB.is_published == True).count() if ArticleDB else 0
        with_conditions = 0
        if ArticleDB is not None:
            for a in db.query(ArticleDB).all():
                conds = getattr(a, "clinical_conditions", None)
                if conds:
                    if isinstance(conds, str):
                        try:
                            conds = json.loads(conds)
                        except Exception:
                            conds = []
                    if conds:
                        with_conditions += 1
        return {
            "generated_at": now_co().strftime("%Y-%m-%d %H:%M:%S"),
            "counts": {
                "interventions": interventions,
                "challenges": challenges,
                "substitutions": substitutions,
                "prep_items": prep_items,
                "published_articles": edu_articles,
                "articles_with_conditions": with_conditions,
            },
            "conditions": [{"value": k, "label": v} for k, v in CLINICAL_CONDITIONS.items()],
            "intervention_categories": [{"value": k, "label": v} for k, v in INTERVENTION_CATEGORIES.items()],
            "content_types": [{"value": k, "label": v} for k, v in INTERVENTION_CONTENT_TYPES.items()],
        }

    # ── Intervenciones del sistema ──
    @app.get("/api/superadmin/clinical-content/interventions")
    def list_system_interventions(
        category: Optional[str] = None,
        db: Session = Depends(get_db),
        _=Depends(require_superadmin),
    ):
        q = db.query(InterventionTemplateDB).filter(InterventionTemplateDB.is_system == 1)
        if category:
            q = q.filter(InterventionTemplateDB.category == category)
        rows = q.order_by(InterventionTemplateDB.category, InterventionTemplateDB.title).all()
        return [_intervention_row(r) for r in rows]

    @app.post("/api/superadmin/clinical-content/interventions")
    def create_system_intervention(
        body: InterventionTemplateSchema,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        row = InterventionTemplateDB(
            nutritionist_id=None,
            title=body.title.strip(),
            category=body.category,
            content_type=body.content_type,
            condition_tags=body.condition_tags,
            body=body.body.strip(),
            is_system=1 if body.is_system else 0,
            created_at=ts,
            updated_at=ts,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        if log_audit:
            log_audit(db, current_user, "create", "intervention_template", row.id, summary=f"Sistema: {row.title}")
        return _intervention_row(row)

    @app.put("/api/superadmin/clinical-content/interventions/{intervention_id}")
    def update_system_intervention(
        intervention_id: int,
        body: InterventionUpdateSchema,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        row = db.query(InterventionTemplateDB).filter(InterventionTemplateDB.id == intervention_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Plantilla no encontrada")
        if body.title is not None:
            row.title = body.title.strip()
        if body.category is not None:
            row.category = body.category
        if body.content_type is not None:
            row.content_type = body.content_type
        if body.condition_tags is not None:
            row.condition_tags = body.condition_tags
        if body.body is not None:
            row.body = body.body.strip()
        if body.is_system is not None:
            row.is_system = 1 if body.is_system else 0
        row.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        if log_audit:
            log_audit(db, current_user, "update", "intervention_template", row.id, summary=row.title)
        return _intervention_row(row)

    @app.delete("/api/superadmin/clinical-content/interventions/{intervention_id}")
    def delete_system_intervention(
        intervention_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        row = db.query(InterventionTemplateDB).filter(
            InterventionTemplateDB.id == intervention_id,
            InterventionTemplateDB.is_system == 1,
        ).first()
        if not row:
            raise HTTPException(status_code=404, detail="Plantilla no encontrada")
        title = row.title
        db.delete(row)
        db.commit()
        if log_audit:
            log_audit(db, current_user, "delete", "intervention_template", intervention_id, summary=title)
        return {"success": True}

    # ── Retos Fase 3 ──
    @app.get("/api/superadmin/clinical-content/challenges")
    def list_challenge_templates(db: Session = Depends(get_db), _=Depends(require_superadmin)):
        seed_clinical_content_defaults(db, now_co, InterventionTemplateDB)
        rows = db.query(ChallengeTemplateDB).order_by(ChallengeTemplateDB.sort_order).all()
        return [_challenge_row(r) for r in rows]

    @app.post("/api/superadmin/clinical-content/challenges")
    def create_challenge_template(
        body: ChallengeTemplateSchema,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if db.query(ChallengeTemplateDB).filter(ChallengeTemplateDB.key == body.key).first():
            raise HTTPException(status_code=400, detail="Ya existe un reto con esa clave")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        row = ChallengeTemplateDB(
            key=body.key.strip(), title=body.title.strip(), description=body.description,
            target=body.target, metric=body.metric, points=body.points, icon=body.icon,
            period=body.period, sort_order=body.sort_order, is_active=1 if body.is_active else 0,
            created_at=ts, updated_at=ts,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return _challenge_row(row)

    @app.put("/api/superadmin/clinical-content/challenges/{item_id}")
    def update_challenge_template(
        item_id: int,
        body: ChallengeUpdateSchema,
        db: Session = Depends(get_db),
        _=Depends(require_superadmin),
    ):
        row = db.query(ChallengeTemplateDB).filter(ChallengeTemplateDB.id == item_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Reto no encontrado")
        for field in ("title", "description", "metric", "icon", "period"):
            val = getattr(body, field, None)
            if val is not None:
                setattr(row, field, val)
        if body.target is not None:
            row.target = body.target
        if body.points is not None:
            row.points = body.points
        if body.sort_order is not None:
            row.sort_order = body.sort_order
        if body.is_active is not None:
            row.is_active = 1 if body.is_active else 0
        row.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        return _challenge_row(row)

    @app.patch("/api/superadmin/clinical-content/challenges/{item_id}/publish")
    def publish_challenge_template(item_id: int, db: Session = Depends(get_db), _=Depends(require_superadmin)):
        row = db.query(ChallengeTemplateDB).filter(ChallengeTemplateDB.id == item_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Reto no encontrado")
        row.is_active = 1
        row.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        return {"success": True, "published": True, "item": _challenge_row(row)}

    @app.patch("/api/superadmin/clinical-content/substitutions/{item_id}/publish")
    def publish_substitution_group(item_id: int, db: Session = Depends(get_db), _=Depends(require_superadmin)):
        row = db.query(FoodSubstitutionGroupDB).filter(FoodSubstitutionGroupDB.id == item_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Grupo no encontrado")
        row.is_active = 1
        row.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        return {"success": True, "published": True, "item": _substitution_row(row)}

    @app.patch("/api/superadmin/clinical-content/prep-items/{item_id}/publish")
    def publish_prep_item(item_id: int, db: Session = Depends(get_db), _=Depends(require_superadmin)):
        row = db.query(AppointmentPrepTemplateDB).filter(AppointmentPrepTemplateDB.id == item_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Ítem no encontrado")
        row.is_active = 1
        row.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        return {"success": True, "published": True, "item": _prep_row(row)}

    @app.delete("/api/superadmin/clinical-content/challenges/{item_id}")
    def delete_challenge_template(item_id: int, db: Session = Depends(get_db), _=Depends(require_superadmin)):
        row = db.query(ChallengeTemplateDB).filter(ChallengeTemplateDB.id == item_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Reto no encontrado")
        db.delete(row)
        db.commit()
        return {"success": True}

    # ── Sustituciones Fase 4 ──
    @app.get("/api/superadmin/clinical-content/substitutions")
    def list_substitution_groups(db: Session = Depends(get_db), _=Depends(require_superadmin)):
        seed_clinical_content_defaults(db, now_co, InterventionTemplateDB)
        rows = db.query(FoodSubstitutionGroupDB).order_by(FoodSubstitutionGroupDB.sort_order).all()
        return [_substitution_row(r) for r in rows]

    @app.post("/api/superadmin/clinical-content/substitutions")
    def create_substitution_group(
        body: SubstitutionGroupSchema,
        db: Session = Depends(get_db),
        _=Depends(require_superadmin),
    ):
        key = body.ingredient_key.strip().lower()
        if db.query(FoodSubstitutionGroupDB).filter(FoodSubstitutionGroupDB.ingredient_key == key).first():
            raise HTTPException(status_code=400, detail="Ya existe ese ingrediente")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        row = FoodSubstitutionGroupDB(
            ingredient_key=key, category=body.category, alternatives=body.alternatives,
            keywords=body.keywords or [key], sort_order=body.sort_order,
            is_active=1 if body.is_active else 0, created_at=ts, updated_at=ts,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return _substitution_row(row)

    @app.put("/api/superadmin/clinical-content/substitutions/{item_id}")
    def update_substitution_group(
        item_id: int,
        body: SubstitutionUpdateSchema,
        db: Session = Depends(get_db),
        _=Depends(require_superadmin),
    ):
        row = db.query(FoodSubstitutionGroupDB).filter(FoodSubstitutionGroupDB.id == item_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Grupo no encontrado")
        if body.category is not None:
            row.category = body.category
        if body.alternatives is not None:
            row.alternatives = body.alternatives
        if body.keywords is not None:
            row.keywords = body.keywords
        if body.sort_order is not None:
            row.sort_order = body.sort_order
        if body.is_active is not None:
            row.is_active = 1 if body.is_active else 0
        row.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        return _substitution_row(row)

    @app.delete("/api/superadmin/clinical-content/substitutions/{item_id}")
    def delete_substitution_group(item_id: int, db: Session = Depends(get_db), _=Depends(require_superadmin)):
        row = db.query(FoodSubstitutionGroupDB).filter(FoodSubstitutionGroupDB.id == item_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Grupo no encontrado")
        db.delete(row)
        db.commit()
        return {"success": True}

    # ── Checklist prep cita ──
    @app.get("/api/superadmin/clinical-content/prep-items")
    def list_prep_items(db: Session = Depends(get_db), _=Depends(require_superadmin)):
        seed_clinical_content_defaults(db, now_co, InterventionTemplateDB)
        rows = db.query(AppointmentPrepTemplateDB).order_by(AppointmentPrepTemplateDB.sort_order).all()
        return [_prep_row(r) for r in rows]

    @app.post("/api/superadmin/clinical-content/prep-items")
    def create_prep_item(
        body: PrepItemSchema,
        db: Session = Depends(get_db),
        _=Depends(require_superadmin),
    ):
        if db.query(AppointmentPrepTemplateDB).filter(AppointmentPrepTemplateDB.key == body.key).first():
            raise HTTPException(status_code=400, detail="Clave duplicada")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        row = AppointmentPrepTemplateDB(
            key=body.key.strip(), label=body.label.strip(),
            auto_check_rule=body.auto_check_rule, sort_order=body.sort_order,
            is_active=1 if body.is_active else 0, created_at=ts, updated_at=ts,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return _prep_row(row)

    @app.put("/api/superadmin/clinical-content/prep-items/{item_id}")
    def update_prep_item(
        item_id: int,
        body: PrepItemUpdateSchema,
        db: Session = Depends(get_db),
        _=Depends(require_superadmin),
    ):
        row = db.query(AppointmentPrepTemplateDB).filter(AppointmentPrepTemplateDB.id == item_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Ítem no encontrado")
        if body.label is not None:
            row.label = body.label.strip()
        if body.auto_check_rule is not None:
            row.auto_check_rule = body.auto_check_rule or None
        if body.sort_order is not None:
            row.sort_order = body.sort_order
        if body.is_active is not None:
            row.is_active = 1 if body.is_active else 0
        row.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        return _prep_row(row)

    @app.delete("/api/superadmin/clinical-content/prep-items/{item_id}")
    def delete_prep_item(item_id: int, db: Session = Depends(get_db), _=Depends(require_superadmin)):
        row = db.query(AppointmentPrepTemplateDB).filter(AppointmentPrepTemplateDB.id == item_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Ítem no encontrado")
        db.delete(row)
        db.commit()
        return {"success": True}

    # ── Artículos por condición ──
    @app.get("/api/superadmin/clinical-content/articles")
    def list_clinical_articles(
        condition: Optional[str] = None,
        db: Session = Depends(get_db),
        _=Depends(require_superadmin),
    ):
        rows = db.query(ArticleDB).order_by(ArticleDB.updated_at.desc()).all()
        result = []
        for a in rows:
            conds = _parse_conditions(getattr(a, "clinical_conditions", None))
            if condition and condition != "all" and condition not in conds:
                continue
            result.append({
                "id": a.id,
                "title": a.title,
                "slug": a.slug,
                "category": a.category,
                "is_published": bool(a.is_published),
                "clinical_conditions": conds,
                "excerpt": (a.excerpt or "")[:120],
                "updated_at": a.updated_at,
            })
        return result

    @app.patch("/api/superadmin/clinical-content/articles/{article_id}/conditions")
    def update_article_conditions(
        article_id: int,
        body: ArticleConditionsUpdateSchema,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        article = db.query(ArticleDB).filter(ArticleDB.id == article_id).first()
        if not article:
            raise HTTPException(status_code=404, detail="Artículo no encontrado")
        valid = [c for c in body.clinical_conditions if c in CLINICAL_CONDITIONS]
        article.clinical_conditions = valid
        article.updated_at = now_co().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        if log_audit:
            log_audit(db, current_user, "update", "article_conditions", article_id, summary=article.title)
        return {"success": True, "clinical_conditions": valid}


def _parse_conditions(raw) -> List[str]:
    if not raw:
        return []
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    return []


def _intervention_row(r) -> dict:
    tags = r.condition_tags
    if isinstance(tags, str):
        try:
            tags = json.loads(tags)
        except Exception:
            tags = []
    return {
        "id": r.id,
        "title": r.title,
        "category": r.category,
        "content_type": r.content_type,
        "condition_tags": tags or [],
        "body": r.body,
        "is_system": bool(r.is_system),
        "created_at": r.created_at,
        "updated_at": r.updated_at,
    }


def _challenge_row(r) -> dict:
    return {
        "id": r.id, "key": r.key, "title": r.title, "description": r.description,
        "target": r.target, "metric": r.metric, "points": r.points, "icon": r.icon,
        "period": r.period, "sort_order": r.sort_order, "is_active": bool(r.is_active),
    }


def _substitution_row(r) -> dict:
    alts = r.alternatives if isinstance(r.alternatives, list) else []
    kws = r.keywords if isinstance(r.keywords, list) else []
    return {
        "id": r.id, "ingredient_key": r.ingredient_key, "category": r.category,
        "alternatives": alts, "keywords": kws, "sort_order": r.sort_order,
        "is_active": bool(r.is_active),
    }


def _prep_row(r) -> dict:
    return {
        "id": r.id, "key": r.key, "label": r.label,
        "auto_check_rule": r.auto_check_rule, "sort_order": r.sort_order,
        "is_active": bool(r.is_active),
    }
