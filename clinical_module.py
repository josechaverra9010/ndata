"""Módulo clínico Colombia: bioquímicos, MIPRESS, exportación."""
from __future__ import annotations

import csv
import io
import uuid
from typing import Optional

from fastapi import Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified


PLAN_TIPO_LABELS = {
    "adulto": "Adulto",
    "pediatria": "Pediatría",
    "gestante": "Gestante",
    "gestante_adolescente": "Gestante adolescente",
    "hospitalizado": "Hospitalizado",
    "geriatrico": "Geriátrico",
    "deportista": "Deportista",
}


def _empty_bio_storage():
    return {"current": {}, "history": []}


def _parse_bio_storage(raw) -> dict:
    if not raw or not isinstance(raw, dict):
        return _empty_bio_storage()
    if "history" in raw and isinstance(raw.get("history"), list):
        return {"current": raw.get("current") or {}, "history": raw.get("history") or []}
    return {"current": raw, "history": []}


def _get_datos_clinicos(patient) -> dict:
    dc = getattr(patient, "datos_clinicos", None)
    return dc if isinstance(dc, dict) else {}


def _set_datos_clinicos(patient, data: dict):
    if hasattr(patient, "datos_clinicos"):
        patient.datos_clinicos = data
        flag_modified(patient, "datos_clinicos")


class BioEntryBody(BaseModel):
    values: dict
    fecha: Optional[str] = None
    notes: Optional[str] = None


class BioCsvImportBody(BaseModel):
    csv_text: str
    set_as_current: bool = True


class MipressPrescribeBody(BaseModel):
    mipress_id: str
    porciones_dia: float = 1
    indicacion: Optional[str] = None


class TrackingPatch(BaseModel):
    specialty_tracking: dict


def register_clinical_routes(app, deps: dict):
    get_db = deps["get_db"]
    require_admin_or_superadmin = deps["require_admin_or_superadmin"]
    authorize_patient_access = deps["authorize_patient_access"]
    UserDB = deps["UserDB"]
    PatientMealPlanDB = deps["PatientMealPlanDB"]
    MealPlanDB = deps["MealPlanDB"]
    OrganizationMemberDB = deps.get("OrganizationMemberDB")
    now_co = deps["now_co"]
    today_co = deps["today_co"]
    log_clinical_access_fn = deps.get("log_clinical_access")

    def _track_clinical(db, patient_id: int, resource_type: str, action: str, endpoint: str, current_user):
        try:
            fn = log_clinical_access_fn
            if fn is None:
                from compliance_module import log_clinical_access as fn
            fn(
                db,
                actor=current_user,
                patient_id=patient_id,
                resource_type=resource_type,
                action=action,
                endpoint=endpoint,
                now_co=now_co,
            )
        except Exception:
            pass

    def _patient_scope(db, current_user, programa_eps=None, organization_id=None):
        q = db.query(UserDB).filter(UserDB.role == "patient", UserDB.status == "activo")
        if current_user.role == "admin":
            q = q.filter(UserDB.nutritionist_id == current_user.id)
        if programa_eps and hasattr(UserDB, "programa_eps"):
            q = q.filter(UserDB.programa_eps.ilike(f"%{programa_eps.strip()}%"))
        if organization_id and OrganizationMemberDB:
            ids = [
                m.user_id
                for m in db.query(OrganizationMemberDB)
                .filter(OrganizationMemberDB.organization_id == organization_id, OrganizationMemberDB.status == "activo")
                .all()
            ]
            q = q.filter(UserDB.id.in_(ids)) if ids else q.filter(UserDB.id == -1)
        return q.all()

    @app.get("/api/clinical/patients/{patient_id}/bioquimicos")
    def get_bioquimicos(patient_id: int, db: Session = Depends(get_db), current_user=Depends(require_admin_or_superadmin)):
        authorize_patient_access(patient_id, current_user, db)
        _track_clinical(db, patient_id, "bioquimicos", "read", f"/api/clinical/patients/{patient_id}/bioquimicos", current_user)
        patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Paciente no encontrado")
        return _parse_bio_storage(patient.examenes_bioquimicos)

    @app.post("/api/clinical/patients/{patient_id}/bioquimicos/entry")
    def add_bio_entry(patient_id: int, body: BioEntryBody, db: Session = Depends(get_db), current_user=Depends(require_admin_or_superadmin)):
        authorize_patient_access(patient_id, current_user, db)
        patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
        storage = _parse_bio_storage(patient.examenes_bioquimicos)
        entry = {
            "id": str(uuid.uuid4()),
            "fecha": body.fecha or today_co().strftime("%Y-%m-%d"),
            "source": "manual",
            "values": body.values,
            "imported_at": now_co().strftime("%Y-%m-%d %H:%M:%S"),
            "notes": body.notes,
        }
        storage["history"].insert(0, entry)
        storage["current"] = body.values
        patient.examenes_bioquimicos = storage
        flag_modified(patient, "examenes_bioquimicos")
        _track_clinical(db, patient_id, "bioquimicos", "write", f"/api/clinical/patients/{patient_id}/bioquimicos/entry", current_user)
        db.commit()
        return {"storage": storage}

    @app.post("/api/clinical/patients/{patient_id}/bioquimicos/import-csv")
    def import_bio_csv(patient_id: int, body: BioCsvImportBody, db: Session = Depends(get_db), current_user=Depends(require_admin_or_superadmin)):
        authorize_patient_access(patient_id, current_user, db)
        patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
        reader = csv.DictReader(io.StringIO(body.csv_text.strip()))
        storage = _parse_bio_storage(patient.examenes_bioquimicos)
        imported = 0
        for row in reader:
            values = {k: v for k, v in row.items() if v not in (None, "")}
            if not values:
                continue
            entry = {
                "id": str(uuid.uuid4()),
                "fecha": values.get("fecha") or values.get("bio_fecha_examenes") or today_co().strftime("%Y-%m-%d"),
                "source": "csv",
                "values": values,
                "imported_at": now_co().strftime("%Y-%m-%d %H:%M:%S"),
            }
            storage["history"].insert(0, entry)
            if body.set_as_current:
                storage["current"] = values
            imported += 1
        patient.examenes_bioquimicos = storage
        flag_modified(patient, "examenes_bioquimicos")
        _track_clinical(db, patient_id, "bioquimicos", "import", f"/api/clinical/patients/{patient_id}/bioquimicos/import-csv", current_user)
        db.commit()
        return {"storage": storage, "imported": imported}

    @app.get("/api/clinical/patients/{patient_id}/mipress/suggest")
    def mipress_suggest(patient_id: int, db: Session = Depends(get_db), current_user=Depends(require_admin_or_superadmin)):
        authorize_patient_access(patient_id, current_user, db)
        _track_clinical(db, patient_id, "mipress", "read", f"/api/clinical/patients/{patient_id}/mipress/suggest", current_user)
        patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
        return {"current_prescription": _get_datos_clinicos(patient).get("mipress_prescription")}

    @app.post("/api/clinical/patients/{patient_id}/mipress/prescribe")
    def mipress_prescribe(patient_id: int, body: MipressPrescribeBody, db: Session = Depends(get_db), current_user=Depends(require_admin_or_superadmin)):
        authorize_patient_access(patient_id, current_user, db)
        patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
        dc = _get_datos_clinicos(patient)
        rx = {
            "mipress_id": body.mipress_id,
            "porciones_dia": body.porciones_dia,
            "indicacion": body.indicacion,
            "prescribed_at": now_co().strftime("%Y-%m-%d %H:%M:%S"),
            "prescribed_by": current_user.id,
        }
        dc["mipress_prescription"] = rx
        _set_datos_clinicos(patient, dc)
        _track_clinical(db, patient_id, "mipress", "prescribe", f"/api/clinical/patients/{patient_id}/mipress/prescribe", current_user)
        db.commit()
        return {"prescription": rx}

    @app.get("/api/clinical/reports/eps")
    def eps_report(programa_eps: Optional[str] = None, organization_id: Optional[int] = None, db: Session = Depends(get_db), current_user=Depends(require_admin_or_superadmin)):
        patients = _patient_scope(db, current_user, programa_eps, organization_id)
        rows, by_eps, with_bio, with_rx = [], {}, 0, 0
        for p in patients:
            bio = _parse_bio_storage(p.examenes_bioquimicos)
            has_bio = bool(bio.get("current"))
            has_rx = bool(_get_datos_clinicos(p).get("mipress_prescription"))
            with_bio += int(has_bio)
            with_rx += int(has_rx)
            eps = getattr(p, "programa_eps", None) or "Sin EPS"
            by_eps[eps] = by_eps.get(eps, 0) + 1
            rows.append({
                "id": p.id, "name": f"{p.nombres} {p.apellidos}",
                "programa_eps": getattr(p, "programa_eps", None),
                "has_bio": has_bio, "has_mipress_rx": has_rx,
                "last_bio_date": bio["history"][0]["fecha"] if bio.get("history") else None,
            })
        return {
            "summary": {
                "total_patients": len(rows), "with_bioquimicos": with_bio,
                "with_mipress_rx": with_rx,
                "by_eps": [{"eps": k, "count": v} for k, v in sorted(by_eps.items())],
            },
            "patients": rows,
        }

    @app.get("/api/clinical/export/rips")
    def export_rips(programa_eps: Optional[str] = None, organization_id: Optional[int] = None, db: Session = Depends(get_db), current_user=Depends(require_admin_or_superadmin)):
        patients = _patient_scope(db, current_user, programa_eps, organization_id)
        for p in patients:
            _track_clinical(db, p.id, "rips", "export", "/api/clinical/export/rips", current_user)
        db.commit()
        records = [{
            "tipo_documento": p.tipo_documento or "CC",
            "numero_documento": p.numero_documento or "",
            "nombres": p.nombres, "apellidos": p.apellidos,
            "programa_eps": getattr(p, "programa_eps", None),
            "fecha_consulta": today_co().strftime("%Y-%m-%d"),
            "codigo_servicio": "890206", "diagnostico": "Z71.3",
        } for p in patients]
        return {"generated_at": now_co().isoformat(), "records": records, "count": len(records)}

    @app.get("/api/clinical/export/hc/{patient_id}")
    def export_hc(patient_id: int, db: Session = Depends(get_db), current_user=Depends(require_admin_or_superadmin)):
        authorize_patient_access(patient_id, current_user, db)
        _track_clinical(db, patient_id, "historia_clinica", "export", f"/api/clinical/export/hc/{patient_id}", current_user)
        patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
        active = db.query(PatientMealPlanDB).filter(PatientMealPlanDB.patient_id == patient_id, PatientMealPlanDB.status == "active").first()
        plan = db.query(MealPlanDB).filter(MealPlanDB.id == active.meal_plan_id).first() if active else None
        db.commit()
        return {
            "patient": {"id": patient.id, "nombres": patient.nombres, "apellidos": patient.apellidos, "programa_eps": getattr(patient, "programa_eps", None)},
            "plan": plan.name if plan else None,
            "bioquimicos": _parse_bio_storage(patient.examenes_bioquimicos),
            "datos_clinicos": _get_datos_clinicos(patient),
            "exported_at": now_co().strftime("%Y-%m-%d %H:%M:%S"),
        }


def register_specialty_routes(app, deps: dict):
    get_db = deps["get_db"]
    require_admin_or_superadmin = deps["require_admin_or_superadmin"]
    authorize_patient_access = deps["authorize_patient_access"]
    UserDB = deps["UserDB"]
    PatientMealPlanDB = deps["PatientMealPlanDB"]
    MealPlanDB = deps["MealPlanDB"]
    ProgressMetricDB = deps["ProgressMetricDB"]

    @app.get("/api/specialty/patient/{patient_id}")
    def get_specialty_patient(patient_id: int, db: Session = Depends(get_db), current_user=Depends(require_admin_or_superadmin)):
        authorize_patient_access(patient_id, current_user, db)
        patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
        active = db.query(PatientMealPlanDB).filter(PatientMealPlanDB.patient_id == patient_id, PatientMealPlanDB.status == "active").first()
        plan, plan_tipo = None, "adulto"
        if active:
            plan = db.query(MealPlanDB).filter(MealPlanDB.id == active.meal_plan_id).first()
            plan_tipo = getattr(plan, "tipo", None) or "adulto"
        dc = getattr(patient, "datos_clinicos", None) or {}
        if not isinstance(dc, dict):
            dc = {}
        metrics = db.query(ProgressMetricDB).filter(ProgressMetricDB.patient_id == patient_id).order_by(ProgressMetricDB.date.asc()).all()
        timeline = [{"id": m.id, "date": m.date.strftime("%Y-%m-%d"), "weight": m.weight} for m in metrics if m.weight]
        has_specialty = plan_tipo != "adulto"
        return {
            "has_specialty": has_specialty,
            "plan_tipo": plan_tipo if has_specialty else None,
            "plan_tipo_label": PLAN_TIPO_LABELS.get(plan_tipo, plan_tipo),
            "plan_name": plan.name if plan else None,
            "fase_1": (plan.fase_1 if plan and plan.fase_1 else {}) or {},
            "patient": {
                "id": patient.id,
                "fecha_nacimiento": patient.fecha_nacimiento.isoformat() if patient.fecha_nacimiento else None,
                "genero": patient.genero, "altura": patient.altura,
                "peso_actual": patient.peso_actual, "peso_objetivo": patient.peso_objetivo,
                "datos_clinicos": dc,
            },
            "weight_timeline": timeline,
            "tracking": dc.get("specialty_tracking") or {},
        }

    @app.patch("/api/specialty/patient/{patient_id}/tracking")
    def patch_specialty_tracking(patient_id: int, body: TrackingPatch, db: Session = Depends(get_db), current_user=Depends(require_admin_or_superadmin)):
        authorize_patient_access(patient_id, current_user, db)
        patient = db.query(UserDB).filter(UserDB.id == patient_id).first()
        dc = getattr(patient, "datos_clinicos", None) or {}
        if not isinstance(dc, dict):
            dc = {}
        dc["specialty_tracking"] = body.specialty_tracking
        if hasattr(patient, "datos_clinicos"):
            patient.datos_clinicos = dc
            flag_modified(patient, "datos_clinicos")
        db.commit()
        return {"tracking": body.specialty_tracking}
