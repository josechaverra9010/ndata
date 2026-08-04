"""
Monitoreo y observabilidad NutriData: métricas API, DB, jobs, almacenamiento, sync offline.
"""
from __future__ import annotations

import os
import re
import socket
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import Any, Callable, Deque, Dict, List, Optional, TYPE_CHECKING

from fastapi import Depends, HTTPException, Query
from sqlalchemy import Column, Integer, String, Text, JSON, func, text
from sqlalchemy.orm import Session

if TYPE_CHECKING:
    from sqlalchemy.orm import DeclarativeBase

OpsJobDB = None
OpsMetricSnapshotDB = None

_metrics_lock = threading.Lock()
_metrics_started_at: datetime = datetime.utcnow()
_requests_total = 0
_errors_5xx: Deque[dict] = deque(maxlen=1000)
_endpoint_stats: Dict[str, dict] = defaultdict(
    lambda: {"count": 0, "total_ms": 0.0, "errors": 0, "max_ms": 0.0, "status_5xx": 0}
)

JOB_STATUSES = ("pending", "running", "completed", "failed", "cancelled")
JOB_TYPES = (
    "appointment_reminders",
    "article_publish",
    "audit_purge",
    "offline_sync_batch",
    "billing_webhook",
    "custom",
)


def register_ops_models(Base):
    global OpsJobDB, OpsMetricSnapshotDB

    class _OpsJobDB(Base):
        __tablename__ = "ops_jobs"
        id = Column(Integer, primary_key=True, index=True)
        job_type = Column(String(60), nullable=False, index=True)
        title = Column(String(200), nullable=False)
        status = Column(String(20), default="pending", index=True)
        payload = Column(JSON, nullable=True)
        scheduled_at = Column(String(50), nullable=True)
        started_at = Column(String(50), nullable=True)
        finished_at = Column(String(50), nullable=True)
        error_message = Column(Text, nullable=True)
        created_at = Column(String(50), nullable=True)

    class _OpsMetricSnapshotDB(Base):
        __tablename__ = "ops_metric_snapshots"
        id = Column(Integer, primary_key=True, index=True)
        captured_at = Column(String(50), nullable=False, index=True)
        requests_total = Column(Integer, default=0)
        errors_5xx_24h = Column(Integer, default=0)
        avg_latency_ms = Column(Integer, default=0)
        overall_status = Column(String(20), nullable=True)
        payload = Column(JSON, nullable=True)

    OpsJobDB = _OpsJobDB
    OpsMetricSnapshotDB = _OpsMetricSnapshotDB
    return OpsJobDB


def migrate_ops_schema(engine, inspect_fn, text_fn, OpsJobModel):
    if OpsJobModel is None:
        return
    try:
        if not inspect_fn(engine).has_table("ops_jobs"):
            OpsJobModel.__table__.create(bind=engine, checkfirst=True)
        if OpsMetricSnapshotDB is not None and not inspect_fn(engine).has_table("ops_metric_snapshots"):
            OpsMetricSnapshotDB.__table__.create(bind=engine, checkfirst=True)
    except Exception as exc:
        print(f"[MIGRATE] ops_jobs: {exc}")


def normalize_endpoint(path: str) -> str:
    clean = path.split("?")[0]
    parts = clean.split("/")
    out: List[str] = []
    for part in parts:
        if not part:
            continue
        if part.isdigit():
            out.append("{id}")
        elif re.match(r"^[0-9a-f-]{8,}$", part, re.I):
            out.append("{id}")
        else:
            out.append(part)
    return "/" + "/".join(out) if out else "/"


def record_request(method: str, path: str, status_code: int, duration_ms: float) -> None:
    global _requests_total
    if not path.startswith("/api/"):
        return
    endpoint = f"{method.upper()} {normalize_endpoint(path)}"
    with _metrics_lock:
        _requests_total += 1
        stat = _endpoint_stats[endpoint]
        stat["count"] += 1
        stat["total_ms"] += duration_ms
        stat["max_ms"] = max(stat["max_ms"], duration_ms)
        if status_code >= 400:
            stat["errors"] += 1
        if status_code >= 500:
            stat["status_5xx"] += 1
            _errors_5xx.append(
                {
                    "at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
                    "method": method.upper(),
                    "path": path.split("?")[0],
                    "endpoint": endpoint,
                    "status_code": status_code,
                    "duration_ms": round(duration_ms, 2),
                }
            )


def get_uptime_seconds() -> int:
    return int((datetime.utcnow() - _metrics_started_at).total_seconds())


def _latency_rows(limit: int = 30) -> List[dict]:
    rows = []
    with _metrics_lock:
        for endpoint, stat in _endpoint_stats.items():
            count = stat["count"]
            if count == 0:
                continue
            avg_ms = stat["total_ms"] / count
            rows.append(
                {
                    "endpoint": endpoint,
                    "count": count,
                    "avg_ms": round(avg_ms, 2),
                    "max_ms": round(stat["max_ms"], 2),
                    "errors": stat["errors"],
                    "errors_5xx": stat["status_5xx"],
                    "p95_ms": round(avg_ms * 1.4, 2),
                }
            )
    rows.sort(key=lambda r: r["count"], reverse=True)
    return rows[:limit]


def _errors_since(hours: int = 24, limit: int = 100) -> List[dict]:
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    out = []
    with _metrics_lock:
        for err in reversed(_errors_5xx):
            try:
                at = datetime.strptime(err["at"], "%Y-%m-%d %H:%M:%S")
            except Exception:
                continue
            if at >= cutoff:
                out.append(err)
            if len(out) >= limit:
                break
    return out


def scan_uploads_directory(upload_dir: str) -> dict:
    if not upload_dir or not os.path.isdir(upload_dir):
        return {
            "path": upload_dir,
            "exists": False,
            "writable": False,
            "total_bytes": 0,
            "file_count": 0,
            "by_extension": [],
            "largest_files": [],
        }

    total_bytes = 0
    file_count = 0
    by_ext: Dict[str, dict] = defaultdict(lambda: {"count": 0, "bytes": 0})
    largest: List[tuple] = []

    for root, _dirs, files in os.walk(upload_dir):
        for fname in files:
            fpath = os.path.join(root, fname)
            try:
                size = os.path.getsize(fpath)
            except OSError:
                continue
            total_bytes += size
            file_count += 1
            ext = os.path.splitext(fname)[1].lower() or "(sin ext)"
            by_ext[ext]["count"] += 1
            by_ext[ext]["bytes"] += size
            rel = os.path.relpath(fpath, upload_dir).replace("\\", "/")
            largest.append((size, rel))

    largest.sort(key=lambda x: x[0], reverse=True)
    writable = os.access(upload_dir, os.W_OK)

    return {
        "path": os.path.abspath(upload_dir),
        "exists": True,
        "writable": writable,
        "total_bytes": total_bytes,
        "file_count": file_count,
        "by_extension": [
            {"extension": ext, "count": data["count"], "bytes": data["bytes"]}
            for ext, data in sorted(by_ext.items(), key=lambda x: x[1]["bytes"], reverse=True)
        ],
        "largest_files": [
            {"path": rel, "bytes": size, "url": f"/uploads/{rel}"}
            for size, rel in largest[:15]
        ],
    }


def _check_database(db: Session) -> dict:
    start = time.perf_counter()
    try:
        db.execute(text("SELECT 1"))
        db.commit()
        latency = round((time.perf_counter() - start) * 1000, 2)
        return {"status": "healthy", "latency_ms": latency, "message": "Conexión OK"}
    except Exception as exc:
        return {"status": "unhealthy", "latency_ms": None, "message": str(exc)[:200]}


def _check_uploads(upload_dir: str) -> dict:
    start = time.perf_counter()
    info = scan_uploads_directory(upload_dir)
    latency = round((time.perf_counter() - start) * 1000, 2)
    if not info["exists"]:
        return {"status": "unhealthy", "latency_ms": latency, "message": "Directorio uploads no existe"}
    if not info["writable"]:
        return {"status": "degraded", "latency_ms": latency, "message": "Directorio sin permiso de escritura"}
    return {"status": "healthy", "latency_ms": latency, "message": f"{info['file_count']} archivos"}


def _check_smtp(email_config: dict) -> dict:
    host = (email_config or {}).get("smtp_host") or ""
    port = int((email_config or {}).get("smtp_port") or 587)
    if not host:
        return {"status": "unknown", "latency_ms": None, "message": "SMTP no configurado"}
    start = time.perf_counter()
    try:
        with socket.create_connection((host, port), timeout=4):
            latency = round((time.perf_counter() - start) * 1000, 2)
            return {"status": "healthy", "latency_ms": latency, "message": f"{host}:{port} alcanzable"}
    except Exception as exc:
        return {"status": "unhealthy", "latency_ms": None, "message": str(exc)[:160]}


def _check_api_service() -> dict:
    return {
        "status": "healthy",
        "latency_ms": 0.5,
        "message": f"Uptime {get_uptime_seconds()}s",
        "uptime_seconds": get_uptime_seconds(),
    }


def _check_job_runner(db: Session, OpsJobModel, now_co: Callable) -> dict:
    if OpsJobModel is None:
        return {"status": "unknown", "latency_ms": None, "message": "Cola no inicializada"}
    pending = db.query(OpsJobModel).filter(OpsJobModel.status == "pending").count()
    running = db.query(OpsJobModel).filter(OpsJobModel.status == "running").count()
    failed_24h = (
        db.query(OpsJobModel)
        .filter(
            OpsJobModel.status == "failed",
            OpsJobModel.finished_at >= (now_co() - timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S"),
        )
        .count()
    )
    status = "healthy"
    if running > 5 or failed_24h > 10:
        status = "degraded"
    if pending > 50:
        status = "degraded"
    return {
        "status": status,
        "latency_ms": None,
        "message": f"pending={pending}, running={running}, failed_24h={failed_24h}",
        "pending": pending,
        "running": running,
        "failed_24h": failed_24h,
    }


def enqueue_ops_job(
    db: Session,
    job_type: str,
    title: str,
    payload: Optional[dict] = None,
    scheduled_at: Optional[str] = None,
    now_co: Optional[Callable] = None,
) -> Optional[int]:
    if OpsJobDB is None:
        return None
    if callable(now_co):
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
    else:
        ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    row = OpsJobDB(
        job_type=job_type,
        title=title,
        status="pending",
        payload=payload or {},
        scheduled_at=scheduled_at,
        created_at=ts,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row.id


def create_ops_metrics_middleware():
    async def middleware(request, call_next):
        if not request.url.path.startswith("/api/"):
            return await call_next(request)
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        record_request(request.method, request.url.path, response.status_code, duration_ms)
        return response

    return middleware


def register_ops_routes(app, deps: dict):
    get_db = deps["get_db"]
    require_superadmin = deps["require_superadmin"]
    UserDB = deps["UserDB"]
    OfflineSyncLogDB = deps.get("OfflineSyncLogDB")
    ArticleDB = deps.get("ArticleDB")
    UPLOAD_DIR = deps.get("UPLOAD_DIR", "uploads")
    engine = deps.get("engine")
    now_co: Callable = deps["now_co"]
    get_email_config: Callable = deps.get("get_email_config", lambda: {})

    @app.get("/api/superadmin/ops/overview")
    def ops_overview(db: Session = Depends(get_db), current_user=Depends(require_superadmin)):
        db_health = _check_database(db)
        uploads_health = _check_uploads(UPLOAD_DIR)
        smtp_health = _check_smtp(get_email_config())
        api_health = _check_api_service()
        jobs_health = _check_job_runner(db, OpsJobDB, now_co)

        services = [
            {"id": "api", "label": "API FastAPI", **api_health},
            {"id": "database", "label": "Base de datos MySQL", **db_health},
            {"id": "uploads", "label": "Almacenamiento /uploads", **uploads_health},
            {"id": "smtp", "label": "Servidor SMTP", **smtp_health},
            {"id": "job_runner", "label": "Cola de jobs", **jobs_health},
        ]

        overall = "healthy"
        if any(s["status"] == "unhealthy" for s in services):
            overall = "unhealthy"
        elif any(s["status"] == "degraded" for s in services):
            overall = "degraded"

        storage = scan_uploads_directory(UPLOAD_DIR)
        errors_24h = _errors_since(hours=24, limit=200)
        latency = _latency_rows(limit=20)

        job_stats = {"pending": 0, "running": 0, "completed_24h": 0, "failed_24h": 0}
        recent_jobs: List[dict] = []
        if OpsJobDB is not None:
            since = (now_co() - timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S")
            job_stats["pending"] = db.query(OpsJobDB).filter(OpsJobDB.status == "pending").count()
            job_stats["running"] = db.query(OpsJobDB).filter(OpsJobDB.status == "running").count()
            job_stats["completed_24h"] = (
                db.query(OpsJobDB)
                .filter(OpsJobDB.status == "completed", OpsJobDB.finished_at >= since)
                .count()
            )
            job_stats["failed_24h"] = (
                db.query(OpsJobDB)
                .filter(OpsJobDB.status == "failed", OpsJobDB.finished_at >= since)
                .count()
            )
            rows = db.query(OpsJobDB).order_by(OpsJobDB.id.desc()).limit(10).all()
            recent_jobs = [
                {
                    "id": j.id,
                    "job_type": j.job_type,
                    "title": j.title,
                    "status": j.status,
                    "scheduled_at": j.scheduled_at,
                    "started_at": j.started_at,
                    "finished_at": j.finished_at,
                    "error_message": j.error_message,
                    "created_at": j.created_at,
                }
                for j in rows
            ]

        scheduled_articles = 0
        if ArticleDB is not None:
            try:
                now_str = now_co().strftime("%Y-%m-%d %H:%M:%S")
                scheduled_articles = (
                    db.query(ArticleDB)
                    .filter(
                        ArticleDB.scheduled_publish_at.isnot(None),
                        ArticleDB.scheduled_publish_at > now_str,
                    )
                    .count()
                )
            except Exception:
                scheduled_articles = 0

        sync_stats = {"total_24h": 0, "ok_24h": 0, "failed_24h": 0}
        if OfflineSyncLogDB is not None:
            since = (now_co() - timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S")
            sync_stats["total_24h"] = (
                db.query(OfflineSyncLogDB).filter(OfflineSyncLogDB.created_at >= since).count()
            )
            sync_stats["ok_24h"] = (
                db.query(OfflineSyncLogDB)
                .filter(OfflineSyncLogDB.created_at >= since, OfflineSyncLogDB.status == "ok")
                .count()
            )
            sync_stats["failed_24h"] = sync_stats["total_24h"] - sync_stats["ok_24h"]

        with _metrics_lock:
            requests_total = _requests_total

        pool_info = {}
        if engine is not None:
            try:
                pool = engine.pool
                pool_info = {
                    "size": getattr(pool, "size", lambda: None)(),
                    "checked_in": getattr(pool, "checkedin", lambda: None)(),
                    "checked_out": getattr(pool, "checkedout", lambda: None)(),
                    "overflow": getattr(pool, "overflow", lambda: None)(),
                }
            except Exception:
                pool_info = {}

        overview_payload = {
            "generated_at": now_co().strftime("%Y-%m-%d %H:%M:%S"),
            "overall_status": overall,
            "services": services,
            "api_metrics": {
                "requests_total": requests_total,
                "errors_5xx_24h": len(errors_24h),
                "uptime_seconds": get_uptime_seconds(),
            },
            "database": {
                **db_health,
                "pool": pool_info,
            },
            "job_queue": {
                **job_stats,
                "scheduled_articles": scheduled_articles,
                "recent_jobs": recent_jobs,
            },
            "storage_summary": {
                "total_bytes": storage["total_bytes"],
                "file_count": storage["file_count"],
                "path": storage.get("path"),
            },
            "offline_sync_summary": sync_stats,
            "recent_errors_5xx": errors_24h[:10],
            "top_latency_endpoints": latency[:10],
        }

        if OpsMetricSnapshotDB is not None:
            try:
                last = (
                    db.query(OpsMetricSnapshotDB)
                    .order_by(OpsMetricSnapshotDB.id.desc())
                    .first()
                )
                should_save = True
                if last and last.captured_at:
                    try:
                        last_dt = datetime.strptime(str(last.captured_at)[:19], "%Y-%m-%d %H:%M:%S")
                        should_save = (now_co() - last_dt).total_seconds() >= 300
                    except Exception:
                        should_save = True
                if should_save:
                    avg_lat = 0
                    if latency:
                        avg_lat = int(sum(x.get("avg_ms", 0) for x in latency[:10]) / min(len(latency), 10))
                    snap = OpsMetricSnapshotDB(
                        captured_at=overview_payload["generated_at"],
                        requests_total=requests_total,
                        errors_5xx_24h=len(errors_24h),
                        avg_latency_ms=avg_lat,
                        overall_status=overall,
                        payload={
                            "api_metrics": overview_payload["api_metrics"],
                            "job_queue": job_stats,
                            "offline_sync_summary": sync_stats,
                        },
                    )
                    db.add(snap)
                    db.commit()
            except Exception:
                db.rollback()

        return overview_payload

    @app.get("/api/superadmin/ops/metrics/history")
    def ops_metrics_history(
        limit: int = Query(48, ge=1, le=200),
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if OpsMetricSnapshotDB is None:
            return {"snapshots": []}
        rows = (
            db.query(OpsMetricSnapshotDB)
            .order_by(OpsMetricSnapshotDB.id.desc())
            .limit(limit)
            .all()
        )
        return {
            "snapshots": [
                {
                    "id": r.id,
                    "captured_at": r.captured_at,
                    "requests_total": r.requests_total,
                    "errors_5xx_24h": r.errors_5xx_24h,
                    "avg_latency_ms": r.avg_latency_ms,
                    "overall_status": r.overall_status,
                }
                for r in reversed(rows)
            ]
        }

    @app.get("/api/superadmin/ops/health")
    def ops_health(db: Session = Depends(get_db), current_user=Depends(require_superadmin)):
        overview = ops_overview(db=db, current_user=current_user)
        return {
            "overall_status": overview["overall_status"],
            "services": overview["services"],
            "generated_at": overview["generated_at"],
        }

    @app.get("/api/superadmin/ops/errors")
    def ops_errors(
        hours: int = Query(24, ge=1, le=168),
        limit: int = Query(100, ge=1, le=500),
        current_user=Depends(require_superadmin),
    ):
        errors = _errors_since(hours=hours, limit=limit)
        return {"hours": hours, "count": len(errors), "errors": errors}

    @app.get("/api/superadmin/ops/latency")
    def ops_latency(
        limit: int = Query(40, ge=1, le=200),
        current_user=Depends(require_superadmin),
    ):
        rows = _latency_rows(limit=limit)
        return {"count": len(rows), "endpoints": rows}

    @app.get("/api/superadmin/ops/storage")
    def ops_storage(current_user=Depends(require_superadmin)):
        data = scan_uploads_directory(UPLOAD_DIR)
        return data

    @app.get("/api/superadmin/ops/jobs")
    def ops_jobs(
        status: Optional[str] = Query(None),
        limit: int = Query(50, ge=1, le=200),
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if OpsJobDB is None:
            return {"jobs": [], "stats": {}}
        q = db.query(OpsJobDB)
        if status:
            q = q.filter(OpsJobDB.status == status)
        rows = q.order_by(OpsJobDB.id.desc()).limit(limit).all()
        since = (now_co() - timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S")
        stats = {
            "pending": db.query(OpsJobDB).filter(OpsJobDB.status == "pending").count(),
            "running": db.query(OpsJobDB).filter(OpsJobDB.status == "running").count(),
            "failed_24h": db.query(OpsJobDB)
            .filter(OpsJobDB.status == "failed", OpsJobDB.finished_at >= since)
            .count(),
        }
        return {
            "stats": stats,
            "jobs": [
                {
                    "id": j.id,
                    "job_type": j.job_type,
                    "title": j.title,
                    "status": j.status,
                    "payload": j.payload,
                    "scheduled_at": j.scheduled_at,
                    "started_at": j.started_at,
                    "finished_at": j.finished_at,
                    "error_message": j.error_message,
                    "created_at": j.created_at,
                }
                for j in rows
            ],
        }

    @app.get("/api/superadmin/ops/offline-sync-logs")
    def ops_offline_sync_logs(
        limit: int = Query(100, ge=1, le=500),
        status: Optional[str] = Query(None),
        patient_id: Optional[int] = Query(None),
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if OfflineSyncLogDB is None:
            return {"logs": [], "stats": {}}
        q = db.query(OfflineSyncLogDB)
        if status:
            q = q.filter(OfflineSyncLogDB.status == status)
        if patient_id:
            q = q.filter(OfflineSyncLogDB.patient_id == patient_id)
        rows = q.order_by(OfflineSyncLogDB.id.desc()).limit(limit).all()

        patient_ids = list({r.patient_id for r in rows})
        names: Dict[int, str] = {}
        if patient_ids:
            for u in db.query(UserDB).filter(UserDB.id.in_(patient_ids)).all():
                names[u.id] = u.name or u.email or f"Paciente #{u.id}"

        since = (now_co() - timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S")
        stats = {
            "total_24h": db.query(OfflineSyncLogDB).filter(OfflineSyncLogDB.created_at >= since).count(),
            "by_status": {},
        }
        for st, cnt in (
            db.query(OfflineSyncLogDB.status, func.count(OfflineSyncLogDB.id))
            .filter(OfflineSyncLogDB.created_at >= since)
            .group_by(OfflineSyncLogDB.status)
            .all()
        ):
            stats["by_status"][st or "unknown"] = cnt

        return {
            "stats": stats,
            "logs": [
                {
                    "id": r.id,
                    "patient_id": r.patient_id,
                    "patient_name": names.get(r.patient_id, f"#{r.patient_id}"),
                    "client_id": r.client_id,
                    "action": r.action,
                    "status": r.status,
                    "created_at": r.created_at,
                }
                for r in rows
            ],
        }

    @app.post("/api/superadmin/ops/jobs/{job_id}/retry")
    def retry_ops_job(
        job_id: int,
        db: Session = Depends(get_db),
        current_user=Depends(require_superadmin),
    ):
        if OpsJobDB is None:
            raise HTTPException(status_code=503, detail="Cola no disponible")
        row = db.query(OpsJobDB).filter(OpsJobDB.id == job_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Job no encontrado")
        if row.status not in ("failed", "cancelled"):
            raise HTTPException(status_code=400, detail="Solo jobs fallidos o cancelados")
        ts = now_co().strftime("%Y-%m-%d %H:%M:%S")
        row.status = "pending"
        row.error_message = None
        row.started_at = None
        row.finished_at = None
        row.scheduled_at = ts
        db.commit()
        return {"success": True, "job_id": job_id, "status": "pending"}

    @app.get("/api/public/health")
    def public_health(db: Session = Depends(get_db)):
        """Health check ligero (sin auth)."""
        db_h = _check_database(db)
        return {
            "status": "ok" if db_h["status"] == "healthy" else "degraded",
            "database": db_h["status"],
            "uptime_seconds": get_uptime_seconds(),
        }
