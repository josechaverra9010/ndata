"""Verificación rápida de módulos NutriData (platform, analytics, clinical)."""
from __future__ import annotations

import os
import sys
import traceback
from typing import Callable, Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient

from main import UserDB, SessionLocal, create_access_token, app


def token_for(role: str) -> tuple[str, Optional[int]]:
    db = SessionLocal()
    user = db.query(UserDB).filter(UserDB.role == role).first()
    if not user:
        db.close()
        return "", None
    tok = create_access_token({"sub": user.email})
    uid = user.id
    db.close()
    return tok, uid


def hdr(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


def check(name: str, fn: Callable[[], tuple[int, str]]) -> bool:
    try:
        status, detail = fn()
        ok = 200 <= status < 300
        mark = "OK" if ok else "FAIL"
        print(f"  [{mark}] {name} -> {status} {detail[:80]}")
        return ok
    except Exception as exc:
        print(f"  [ERR] {name} -> {exc}")
        traceback.print_exc()
        return False


def main() -> int:
    client = TestClient(app, raise_server_exceptions=False)
    admin_tok, admin_id = token_for("admin")
    super_tok, _ = token_for("superadmin")
    db = SessionLocal()
    patient = db.query(UserDB).filter(UserDB.role == "patient").first()
    patient_id = patient.id if patient else None
    db.close()
    patient_tok, _ = token_for("patient")

    if not admin_tok:
        print("ERROR: no hay usuario admin en la BD")
        return 1
    if not super_tok:
        print("WARN: no hay superadmin; se omiten rutas superadmin")
    if not patient_id:
        print("WARN: no hay paciente; se omiten rutas clínicas por paciente")

    results: list[bool] = []

    print("\n=== ANALYTICS MODULE ===")
    results.append(
        check(
            "adherence dashboard",
            lambda: (
                (r := client.get("/api/analytics/adherence/dashboard?days=7", headers=hdr(admin_tok))).status_code,
                r.text,
            ),
        )
    )
    results.append(
        check(
            "adherence export csv",
            lambda: (
                (r := client.get("/api/analytics/adherence/export?format=csv&days=7", headers=hdr(admin_tok))).status_code,
                r.text[:60],
            ),
        )
    )

    print("\n=== PLATFORM MODULE ===")
    if super_tok:
        results.append(
            check(
                "organizations list",
                lambda: (
                    (r := client.get("/api/superadmin/organizations", headers=hdr(super_tok))).status_code,
                    r.text,
                ),
            )
        )
        results.append(
            check(
                "tenant health",
                lambda: (
                    (r := client.get("/api/superadmin/tenant-health", headers=hdr(super_tok))).status_code,
                    r.text,
                ),
            )
        )
        results.append(
            check(
                "audit logs",
                lambda: (
                    (r := client.get("/api/superadmin/audit-logs?limit=5", headers=hdr(super_tok))).status_code,
                    r.text[:120],
                ),
            )
        )
        results.append(
            check(
                "audit settings",
                lambda: (
                    (r := client.get("/api/superadmin/audit-settings", headers=hdr(super_tok))).status_code,
                    r.text[:80],
                ),
            )
        )
        results.append(
            check(
                "nutritionists list",
                lambda: (
                    (r := client.get("/api/superadmin/nutritionists?limit=3", headers=hdr(super_tok))).status_code,
                    r.text[:100],
                ),
            )
        )
        results.append(
            check(
                "license alerts",
                lambda: (
                    (r := client.get("/api/superadmin/nutritionists/license-alerts", headers=hdr(super_tok))).status_code,
                    r.text[:80],
                ),
            )
        )
        results.append(
            check(
                "org branding",
                lambda: (
                    (r := client.get("/api/org/branding", headers=hdr(admin_tok))).status_code,
                    r.text[:80],
                ),
            )
        )
        results.append(
            check(
                "staff roles",
                lambda: (
                    (r := client.get("/api/superadmin/staff-roles", headers=hdr(super_tok))).status_code,
                    r.text[:80],
                ),
            )
        )
    results.append(
        check(
            "admin permissions",
            lambda: (
                (r := client.get("/api/admin/me/permissions", headers=hdr(admin_tok))).status_code,
                r.text,
            ),
        )
    )

    print("\n=== CLINICAL MODULE ===")
    if patient_id:
        results.append(
            check(
                "bioquimicos",
                lambda: (
                    (r := client.get(f"/api/clinical/patients/{patient_id}/bioquimicos", headers=hdr(admin_tok))).status_code,
                    r.text,
                ),
            )
        )
        results.append(
            check(
                "mipress suggest",
                lambda: (
                    (r := client.get(f"/api/clinical/patients/{patient_id}/mipress/suggest", headers=hdr(admin_tok))).status_code,
                    r.text,
                ),
            )
        )
        results.append(
            check(
                "reports eps",
                lambda: (
                    (r := client.get("/api/clinical/reports/eps", headers=hdr(admin_tok))).status_code,
                    r.text,
                ),
            )
        )
        results.append(
            check(
                "export rips",
                lambda: (
                    (r := client.get("/api/clinical/export/rips", headers=hdr(admin_tok))).status_code,
                    r.text[:60],
                ),
            )
        )
        results.append(
            check(
                "export hc",
                lambda: (
                    (r := client.get(f"/api/clinical/export/hc/{patient_id}", headers=hdr(admin_tok))).status_code,
                    r.text[:60],
                ),
            )
        )
        results.append(
            check(
                "specialty patient",
                lambda: (
                    (r := client.get(f"/api/specialty/patient/{patient_id}", headers=hdr(admin_tok))).status_code,
                    r.text,
                ),
            )
        )

    print("\n=== CORE API (muestra) ===")
    core = [
        ("patients list", "/api/patients"),
        ("recipes", "/api/recipes"),
        ("weekly menus", "/api/weekly-menus"),
        ("progress patients", "/api/progress/patients"),
        ("appointments", "/api/appointments"),
    ]
    for label, path in core:
        results.append(
            check(
                label,
                lambda p=path: (
                    (r := client.get(p, headers=hdr(admin_tok))).status_code,
                    r.text,
                ),
            )
        )

    print("\n=== NUTRITIONIST MODULE ===")
    results.append(
        check(
            "work queue",
            lambda: (
                (r := client.get("/api/nutritionist/work-queue", headers=hdr(admin_tok))).status_code,
                r.text[:200],
            ),
        )
    )
    results.append(
        check(
            "interventions list",
            lambda: (
                (r := client.get("/api/nutritionist/interventions", headers=hdr(admin_tok))).status_code,
                r.text[:120],
            ),
        )
    )
    if patient_id:
        results.append(
            check(
                "plan history",
                lambda pid=patient_id: (
                    (r := client.get(f"/api/nutritionist/patients/{pid}/plans/history", headers=hdr(admin_tok))).status_code,
                    r.text[:120],
                ),
            )
        )
    results.append(
        check(
            "bulk menu preview",
            lambda: (
                (r := client.get("/api/nutritionist/menus/bulk-preview", headers=hdr(admin_tok))).status_code,
                r.text[:100],
            ),
        )
    )
    results.append(
        check(
            "pdf signature meta",
            lambda: (
                (r := client.get("/api/nutritionist/pdf-signature?doc_type=plan", headers=hdr(admin_tok))).status_code,
                r.text[:80],
            ),
        )
    )

    print("\n=== CMS ARTICLES ===")
    results.append(check("articles categories", lambda: ((r := client.get("/api/articles/categories")).status_code, r.text[:80])))
    if super_tok:
        results.append(check("superadmin articles list", lambda: ((r := client.get("/api/superadmin/articles", headers=hdr(super_tok))).status_code, r.text[:80])))
        results.append(check("superadmin articles analytics", lambda: ((r := client.get("/api/superadmin/articles/analytics", headers=hdr(super_tok))).status_code, r.text[:80])))
        results.append(check("superadmin article categories", lambda: ((r := client.get("/api/superadmin/article-categories", headers=hdr(super_tok))).status_code, r.text[:80])))
        def _get_one_article():
            r = client.get("/api/superadmin/articles", headers=hdr(super_tok))
            if r.status_code != 200:
                return r.status_code, r.text
            items = r.json()
            if not items:
                return 200, "[] (sin artículos)"
            aid = items[0]["id"]
            r2 = client.get(f"/api/superadmin/articles/{aid}", headers=hdr(super_tok))
            return r2.status_code, r2.text[:80]
        results.append(check("superadmin article by id", _get_one_article))

    print("\n=== GLOBAL RECIPES ===")
    results.append(check("recipes public list", lambda: ((r := client.get("/api/recipes")).status_code, r.text[:80])))
    if super_tok:
        results.append(check("superadmin recipes list", lambda: ((r := client.get("/api/superadmin/recipes", headers=hdr(super_tok))).status_code, r.text[:80])))
        results.append(check("superadmin recipes stats", lambda: ((r := client.get("/api/superadmin/recipes/stats", headers=hdr(super_tok))).status_code, r.text[:80])))

    print("\n=== SUPPORT L2 ===")
    if super_tok:
        results.append(check("support overview", lambda: ((r := client.get("/api/superadmin/support/overview", headers=hdr(super_tok))).status_code, r.text[:80])))

    print("\n=== PLATFORM ANALYTICS ===")
    if super_tok:
        results.append(check("analytics overview", lambda: ((r := client.get("/api/superadmin/analytics/overview", headers=hdr(super_tok))).status_code, r.text[:80])))
        results.append(check("analytics funnel", lambda: ((r := client.get("/api/superadmin/analytics/funnel", headers=hdr(super_tok))).status_code, r.text[:80])))
        results.append(check("analytics cohorts", lambda: ((r := client.get("/api/superadmin/analytics/cohorts", headers=hdr(super_tok))).status_code, r.text[:80])))
        results.append(check("analytics modules", lambda: ((r := client.get("/api/superadmin/analytics/modules", headers=hdr(super_tok))).status_code, r.text[:80])))
        results.append(check("analytics nps", lambda: ((r := client.get("/api/superadmin/analytics/nps", headers=hdr(super_tok))).status_code, r.text[:80])))

    print("\n=== CLINICAL CONTENT ===")
    if super_tok:
        results.append(check("clinical content overview", lambda: ((r := client.get("/api/superadmin/clinical-content/overview", headers=hdr(super_tok))).status_code, r.text[:80])))
        results.append(check("clinical interventions", lambda: ((r := client.get("/api/superadmin/clinical-content/interventions", headers=hdr(super_tok))).status_code, r.text[:80])))
        results.append(check("clinical challenges", lambda: ((r := client.get("/api/superadmin/clinical-content/challenges", headers=hdr(super_tok))).status_code, r.text[:80])))
        results.append(check("clinical substitutions", lambda: ((r := client.get("/api/superadmin/clinical-content/substitutions", headers=hdr(super_tok))).status_code, r.text[:80])))
        results.append(check("clinical prep items", lambda: ((r := client.get("/api/superadmin/clinical-content/prep-items", headers=hdr(super_tok))).status_code, r.text[:80])))

    print("\n=== PLATFORM / CROSSCUTTING ===")
    if super_tok:
        results.append(check("platform overview", lambda: ((r := client.get("/api/superadmin/platform/overview", headers=hdr(super_tok))).status_code, r.text[:80])))
        results.append(check("impersonation logs", lambda: ((r := client.get("/api/superadmin/impersonation/logs", headers=hdr(super_tok))).status_code, r.text[:80])))
        results.append(check("workflows list", lambda: ((r := client.get("/api/superadmin/platform/workflows", headers=hdr(super_tok))).status_code, r.text[:80])))
        results.append(check("release notes public", lambda: ((r := client.get("/api/release-notes?role=patient")).status_code, r.text[:60])))

    print("\n=== INTEGRATIONS ===")
    if super_tok:
        results.append(check("integrations overview", lambda: ((r := client.get("/api/superadmin/integrations/overview", headers=hdr(super_tok))).status_code, r.text[:80])))

    print("\n=== COMPLIANCE ===")
    if super_tok:
        results.append(check("compliance overview", lambda: ((r := client.get("/api/superadmin/compliance/overview", headers=hdr(super_tok))).status_code, r.text[:80])))
        results.append(check("legal public", lambda: ((r := client.get("/api/public/legal/current?doc_type=privacy_policy")).status_code, r.text[:60])))

    print("\n=== OPS / MONITORING ===")
    results.append(check("public health", lambda: ((r := client.get("/api/public/health")).status_code, r.text[:80])))
    if super_tok:
        results.append(check("ops overview", lambda: ((r := client.get("/api/superadmin/ops/overview", headers=hdr(super_tok))).status_code, r.text[:80])))
        results.append(check("ops latency", lambda: ((r := client.get("/api/superadmin/ops/latency", headers=hdr(super_tok))).status_code, r.text[:60])))
        results.append(check("ops offline sync logs", lambda: ((r := client.get("/api/superadmin/ops/offline-sync-logs", headers=hdr(super_tok))).status_code, r.text[:60])))

    print("\n=== FEATURE FLAGS ===")
    if super_tok:
        results.append(check("features overview", lambda: ((r := client.get("/api/superadmin/features", headers=hdr(super_tok))).status_code, r.text[:80])))
        results.append(check("features plans catalog", lambda: ((r := client.get("/api/superadmin/features", headers=hdr(super_tok))).status_code, "catalog" in r.text)))

    print("\n=== BILLING ===")
    if super_tok:
        results.append(check("billing overview", lambda: ((r := client.get("/api/superadmin/billing/overview", headers=hdr(super_tok))).status_code, r.text[:80])))
        results.append(check("billing plans", lambda: ((r := client.get("/api/superadmin/billing/plans", headers=hdr(super_tok))).status_code, r.text[:80])))
        results.append(check("billing subscriptions", lambda: ((r := client.get("/api/superadmin/billing/subscriptions", headers=hdr(super_tok))).status_code, r.text[:80])))
        results.append(check("billing delinquents", lambda: ((r := client.get("/api/superadmin/billing/delinquents", headers=hdr(super_tok))).status_code, r.text[:80])))

    print("\n=== PHASE 4 MODULE ===")
    results.append(check("reminders preview", lambda: ((r := client.get("/api/nutritionist/reminders/preview", headers=hdr(admin_tok))).status_code, r.text[:80])))
    results.append(check("eps dashboard", lambda: ((r := client.get("/api/nutritionist/eps/dashboard", headers=hdr(admin_tok))).status_code, r.text[:80])))
    results.append(check("clinical analytics", lambda: ((r := client.get("/api/nutritionist/analytics/clinical-dashboard", headers=hdr(admin_tok))).status_code, r.text[:80])))
    results.append(check("abandonment risk", lambda: ((r := client.get("/api/nutritionist/analytics/abandonment-risk", headers=hdr(admin_tok))).status_code, r.text[:80])))
    results.append(check("follow-ups list", lambda: ((r := client.get("/api/nutritionist/follow-ups", headers=hdr(admin_tok))).status_code, r.text[:60])))

    print("\n=== PATIENT PHASE 1 ===")
    if patient_id and patient_tok:
        results.append(check("patient adherence", lambda: ((r := client.get(f"/api/patient/{patient_id}/adherence", headers=hdr(patient_tok))).status_code, r.text[:80])))
        results.append(check("patient notifications inbox", lambda: ((r := client.get(f"/api/patient/{patient_id}/notifications/inbox", headers=hdr(patient_tok))).status_code, r.text[:80])))
    else:
        print("  [SKIP] patient phase 1 (sin paciente/token)")

    print("\n=== PATIENT PHASE 2 ===")
    if patient_id and patient_tok:
        results.append(check("patient recommendations", lambda: ((r := client.get(f"/api/patient/{patient_id}/recommendations", headers=hdr(patient_tok))).status_code, r.text[:80])))
        results.append(check("patient shopping list", lambda: ((r := client.get(f"/api/patient/{patient_id}/shopping-list", headers=hdr(patient_tok))).status_code, r.text[:80])))
        results.append(check("patient documents", lambda: ((r := client.get(f"/api/patient/{patient_id}/documents", headers=hdr(patient_tok))).status_code, r.text[:80])))
    else:
        print("  [SKIP] patient phase 2 (sin paciente/token)")

    print("\n=== PATIENT PHASE 3 ===")
    if patient_id and patient_tok:
        results.append(check("patient challenges", lambda: ((r := client.get(f"/api/patient/{patient_id}/challenges", headers=hdr(patient_tok))).status_code, r.text[:80])))
        results.append(check("patient learn", lambda: ((r := client.get(f"/api/patient/{patient_id}/learn", headers=hdr(patient_tok))).status_code, r.text[:80])))
        results.append(check("patient program", lambda: ((r := client.get(f"/api/patient/{patient_id}/program", headers=hdr(patient_tok))).status_code, r.text[:80])))
        results.append(check("patient habits", lambda: ((r := client.get(f"/api/patient/{patient_id}/habits/today", headers=hdr(patient_tok))).status_code, r.text[:80])))
        results.append(check("patient reminder prefs", lambda: ((r := client.get(f"/api/patient/{patient_id}/reminder-preferences", headers=hdr(patient_tok))).status_code, r.text[:80])))
    else:
        print("  [SKIP] patient phase 3 (sin paciente/token)")

    print("\n=== PATIENT PHASE 4 ===")
    if patient_id and patient_tok:
        results.append(check("meal photos", lambda: ((r := client.get(f"/api/patient/{patient_id}/meal-photos", headers=hdr(patient_tok))).status_code, r.text[:80])))
        results.append(check("substitutions popular", lambda: ((r := client.get(f"/api/patient/{patient_id}/substitutions/popular", headers=hdr(patient_tok))).status_code, r.text[:80])))
        results.append(check("wearables today", lambda: ((r := client.get(f"/api/patient/{patient_id}/wearables/today", headers=hdr(patient_tok))).status_code, r.text[:80])))
        results.append(check("substitution suggest", lambda: ((r := client.post(f"/api/patient/{patient_id}/substitutions/suggest", headers=hdr(patient_tok), json={"ingredient": "pollo", "reason": "no_tengo"})).status_code, r.text[:80])))
    else:
        print("  [SKIP] patient phase 4 (sin paciente/token)")

    print("\n=== FASE C — CRECIMIENTO ===")
    if super_tok:
        results.append(check("billing checkout schema", lambda: ((r := client.post("/api/superadmin/billing/checkout", headers=hdr(super_tok), json={"subscription_id": 1, "provider": "wompi"})).status_code in (200, 400, 404), r.status_code)))
        results.append(check("analytics export csv", lambda: ((r := client.get("/api/superadmin/analytics/export", headers=hdr(super_tok))).status_code, r.text[:40])))
        results.append(check("org branding api", lambda: ((r := client.get("/api/org/branding", headers=hdr(super_tok))).status_code, r.text[:60])))
    else:
        print("  [SKIP] fase C (sin superadmin)")

    print("\n=== FASE B — OPERACIONES ===")
    if super_tok:
        results.append(check("features overview", lambda: ((r := client.get("/api/superadmin/features", headers=hdr(super_tok))).status_code, r.text[:80])))
        results.append(check("ops metrics history", lambda: ((r := client.get("/api/superadmin/ops/metrics/history", headers=hdr(super_tok))).status_code, r.text[:80])))
        results.append(check("support macros list", lambda: ((r := client.get("/api/superadmin/support/macros", headers=hdr(super_tok))).status_code, r.text[:80])))
        results.append(check("impersonation logs", lambda: ((r := client.get("/api/superadmin/impersonation/logs", headers=hdr(super_tok))).status_code, r.text[:80])))
        results.append(check("support ticket auth (401)", lambda: ((r := client.post("/api/support/ticket", params={"patient_id": 1, "category": "x", "subject": "x", "message": "x"})).status_code == 401, r.status_code)))
    else:
        print("  [SKIP] fase B ops (sin superadmin)")

    print("\n=== FASE A — AUTH SUPERADMIN ===")
    if super_tok:
        results.append(check("stats requires auth (401)", lambda: ((r := client.get("/api/superadmin/stats")).status_code == 401, r.status_code)))
        results.append(check("users export requires auth (401)", lambda: ((r := client.get("/api/superadmin/users/export")).status_code == 401, r.status_code)))
        results.append(check("stats with token", lambda: ((r := client.get("/api/superadmin/stats", headers=hdr(super_tok))).status_code, r.text[:60])))
        results.append(check("dashboard activity feed", lambda: ((r := client.get("/api/superadmin/dashboard/activity", headers=hdr(super_tok))).status_code, r.text[:80])))
    else:
        print("  [SKIP] fase A auth (sin superadmin)")

    passed = sum(results)
    total = len(results)
    print(f"\n=== RESUMEN: {passed}/{total} OK ===")

    print("\n=== EXTRAS ===")
    extras: list[tuple[str, str, dict]] = [
        ("adherence pdf", "/api/analytics/adherence/export?format=pdf&days=7", hdr(admin_tok)),
    ]
    if super_tok:
        extras.extend([
            ("superadmin overview", "/api/superadmin/dashboard/overview", hdr(super_tok)),
            ("superadmin analytics", "/api/superadmin/dashboard/analytics", hdr(super_tok)),
            ("superadmin tenant-health", "/api/superadmin/tenant-health", hdr(super_tok)),
            ("superadmin tenant-health export", "/api/superadmin/tenant-health/export?format=csv", hdr(super_tok)),
            ("superadmin nutritionists", "/api/superadmin/nutritionists", hdr(super_tok)),
        ])
    if patient_id and patient_tok:
        extras.append(("patient dashboard", f"/api/patient/{patient_id}/dashboard/complete", hdr(patient_tok)))
    elif patient_id:
        extras.append(("patient dashboard", f"/api/patient/{patient_id}/dashboard", hdr(admin_tok)))

    extra_ok = 0
    for label, path, headers in extras:
        r = client.get(path, headers=headers)
        ok = r.status_code < 400
        extra_ok += int(ok)
        ct = (r.headers.get("content-type") or "")[:40]
        mark = "OK" if ok else "FAIL"
        print(f"  [{mark}] {label} -> {r.status_code} ({ct})")

    print(f"\n=== TOTAL FINAL: {passed + extra_ok}/{total + len(extras)} OK ===")
    return 0 if (passed + extra_ok) == (total + len(extras)) else 1


if __name__ == "__main__":
    sys.exit(main())
