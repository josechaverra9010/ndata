#!/usr/bin/env python3
"""Genera PDF: Guía del Panel Superadmin — NutriData."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "docs" / "Guia-Panel-Superadmin-NutriData.pdf"

BRAND = colors.HexColor("#7a9b76")
DARK = colors.HexColor("#352d26")
MUTED = colors.HexColor("#6b6159")
LIGHT_BG = colors.HexColor("#f6faf7")


def build_styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "Title",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=22,
            textColor=DARK,
            spaceAfter=6,
            alignment=TA_CENTER,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=11,
            textColor=MUTED,
            alignment=TA_CENTER,
            spaceAfter=20,
        ),
        "h1": ParagraphStyle(
            "H1",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=14,
            textColor=BRAND,
            spaceBefore=14,
            spaceAfter=8,
        ),
        "h2": ParagraphStyle(
            "H2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11,
            textColor=DARK,
            spaceBefore=10,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9.5,
            textColor=DARK,
            leading=13,
            alignment=TA_JUSTIFY,
            spaceAfter=6,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9.5,
            textColor=DARK,
            leading=13,
            leftIndent=14,
            spaceAfter=3,
        ),
        "footer": ParagraphStyle(
            "Footer",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            textColor=MUTED,
            alignment=TA_CENTER,
        ),
        "toc": ParagraphStyle(
            "TOC",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=DARK,
            spaceAfter=4,
            leftIndent=8,
        ),
    }


def section(styles, title: str, blocks: list) -> list:
    story = [
        Paragraph(title, styles["h1"]),
        HRFlowable(width="100%", thickness=0.5, color=BRAND, spaceAfter=8),
    ]
    story.extend(blocks)
    story.append(Spacer(1, 6))
    return story


def p(styles, text: str):
    return Paragraph(text, styles["body"])


def b(styles, text: str):
    return Paragraph(f"• {text}", styles["bullet"])


def h2(styles, text: str):
    return Paragraph(text, styles["h2"])


def make_table(headers: list[str], rows: list[list[str]], col_widths=None):
    data = [headers] + rows
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), BRAND),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 9),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 1), (-1, -1), 8.5),
                ("TEXTCOLOR", (0, 1), (-1, -1), DARK),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d4ddd2")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return t


def add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(inch, 0.45 * inch, "NutriData — Guía del Panel Superadmin")
    canvas.drawRightString(letter[0] - inch, 0.45 * inch, f"Página {doc.page}")
    canvas.restoreState()


def build_story(styles):
    story = []

    # Portada
    story.append(Spacer(1, 1.6 * inch))
    story.append(Paragraph("NutriData", styles["title"]))
    story.append(
        Paragraph(
            "Guía del Panel Superadmin",
            ParagraphStyle("CoverSub", parent=styles["title"], fontSize=16, textColor=BRAND),
        )
    )
    story.append(Spacer(1, 0.25 * inch))
    story.append(
        Paragraph(
            f"Control de plataforma, tenants EPS, compliance y operaciones<br/>"
            f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}",
            styles["subtitle"],
        )
    )
    story.append(
        p(
            styles,
            "Este documento describe cada sección del panel superadmin: propósito operativo, "
            "funcionalidades clave, flujos de trabajo y referencias técnicas para equipos internos "
            "y onboarding de clientes enterprise (EPS, clínicas, hospitales).",
        )
    )
    story.append(PageBreak())

    # Índice
    story.append(Paragraph("Índice de contenidos", styles["h1"]))
    story.append(Spacer(1, 8))
    for item in [
        "1. Acceso y requisitos",
        "2. Mapa del menú",
        "3. Dashboard",
        "4. Salud tenant",
        "5. Auditoría",
        "6. Usuarios y nutricionistas",
        "7. Organizaciones (tenants)",
        "8. Facturación",
        "9. Módulos / Feature flags",
        "10. Ops y monitoreo",
        "11. Compliance Colombia (Ley 1581)",
        "12. Integraciones",
        "13. Soporte L2",
        "14. Analítica de plataforma",
        "15. Contenido clínico global",
        "16. Plataforma enterprise",
        "17. Configuración del sistema",
        "18. Contenido y marketing",
        "19. Flujos operativos frecuentes",
        "20. Seguridad y checklist diario",
    ]:
        story.append(Paragraph(item, styles["toc"]))
    story.append(PageBreak())

    story.extend(
        section(
            styles,
            "1. Acceso y requisitos",
            [
                p(styles, "<b>Rol requerido:</b> superadmin"),
                p(styles, "<b>Ruta base:</b> /superadmin"),
                p(styles, "<b>Backend:</b> FastAPI en puerto 8001 — python -m uvicorn main:app --reload --port 8001"),
                p(styles, "<b>Frontend:</b> Vite en puerto 8080"),
                h2(styles, "Quién usa este panel"),
                b(styles, "Equipo interno NutriData (operaciones, soporte L2, producto)"),
                b(styles, "Administradores de plataforma en contratos enterprise"),
                b(styles, "No es accesible para nutricionistas ni pacientes"),
            ],
        )
    )

    story.extend(
        section(
            styles,
            "2. Mapa del menú",
            [
                make_table(
                    ["Sección", "Ruta", "Propósito"],
                    [
                        ["Dashboard", "/superadmin", "KPIs, MRR, alertas"],
                        ["Salud tenant", "/superadmin/tenant-health", "Score y churn por org"],
                        ["Auditoría", "/superadmin/audit", "Log de acciones sensibles"],
                        ["Usuarios", "/superadmin/users", "Cuentas globales"],
                        ["Nutricionistas", "/superadmin/nutritionists", "Admins clínicos"],
                        ["Recetas", "/superadmin/recipes", "Biblioteca global"],
                        ["Artículos Home", "/superadmin/articles", "CMS landing"],
                        ["Organizaciones", "/superadmin/organizations", "Tenants EPS"],
                        ["Facturación", "/superadmin/billing", "MRR, planes, morosos"],
                        ["Módulos / Flags", "/superadmin/features", "Features por org"],
                        ["Ops", "/superadmin/ops", "Latencia, errores, jobs"],
                        ["Compliance CO", "/superadmin/compliance", "Ley 1581"],
                        ["Integraciones", "/superadmin/integrations", "WhatsApp, Wompi, EPS"],
                        ["Soporte L2", "/superadmin/support", "Cola centralizada"],
                        ["Analítica", "/superadmin/analytics", "Embudo, NPS, CSV"],
                        ["Contenido clínico", "/superadmin/clinical-content", "CMS clínico"],
                        ["Plataforma", "/superadmin/platform", "API partners, 2FA"],
                        ["Configuración", "/superadmin/settings", "Ajustes globales"],
                    ],
                    col_widths=[1.35 * inch, 1.85 * inch, 2.3 * inch],
                ),
            ],
        )
    )

    story.append(PageBreak())

    story.extend(
        section(
            styles,
            "3. Dashboard (/superadmin)",
            [
                p(styles, "<b>Propósito:</b> Vista ejecutiva con métricas reales desde la base de datos."),
                h2(styles, "KPIs principales"),
                b(styles, "Usuarios activos 7d y 30d"),
                b(styles, "Registros nuevos del mes (comparación MoM)"),
                b(styles, "Churn de pacientes (% del cohorte previo)"),
                b(styles, "Adherencia global semanal vs semana anterior"),
                b(styles, "MRR e ingresos (desde billing_module)"),
                h2(styles, "Visualizaciones"),
                b(styles, "Heatmap por organización: actividad, adherencia, pacientes"),
                b(styles, "Alertas críticas y accesos rápidos a otras secciones"),
                p(styles, "<b>Cuándo usarlo:</b> Revisión diaria, reuniones comerciales, detección de orgs inactivas."),
            ],
        )
    )

    story.extend(
        section(
            styles,
            "4. Salud tenant (/superadmin/tenant-health)",
            [
                p(styles, "<b>Propósito:</b> Salud operativa por tenant (EPS, ciudad, tipo de plan)."),
                h2(styles, "Métricas por organización"),
                b(styles, "Score de salud 0–100 (actividad, adherencia, citas, logs)"),
                b(styles, "Índice de abandono y pacientes en riesgo"),
                b(styles, "Predicción de churn 0–100 con factores explicativos"),
                h2(styles, "Acciones"),
                b(styles, "Filtros: EPS/programa, ciudad, plan, organización"),
                b(styles, "Export CSV o PDF para QBR con clientes"),
            ],
        )
    )

    story.extend(
        section(
            styles,
            "5. Auditoría (/superadmin/audit)",
            [
                p(styles, "<b>Propósito:</b> Trazabilidad de acciones sensibles en toda la plataforma."),
                b(styles, "Creación, modificación, eliminación de entidades"),
                b(styles, "Transferencias de pacientes y cambios de rol"),
                b(styles, "Impersonación (inicio/fin) y escalamientos de soporte"),
                b(styles, "Cambios en feature flags"),
                h2(styles, "Alertas automáticas"),
                b(styles, "Transferencias masivas, eliminaciones, cambios de rol superadmin"),
            ],
        )
    )

    story.append(PageBreak())

    story.extend(
        section(
            styles,
            "6. Usuarios y nutricionistas",
            [
                h2(styles, "Usuarios (/superadmin/users)"),
                b(styles, "Buscar, filtrar, activar/desactivar cuentas"),
                b(styles, "Acciones masivas: activar, desactivar, export CSV, reasignar org"),
                b(styles, "Notificar por email a un usuario"),
                b(styles, "Impersonar (motivo ≥ 5 caracteres → queda en auditoría)"),
                h2(styles, "Nutricionistas (/superadmin/nutritionists)"),
                b(styles, "CRUD de admins clínicos (rol admin)"),
                b(styles, "Ver pacientes asignados, activar/desactivar"),
                b(styles, "Impersonar para soporte técnico"),
                b(styles, "Eliminar solo si no tiene pacientes asignados"),
            ],
        )
    )

    story.extend(
        section(
            styles,
            "7. Organizaciones (/superadmin/organizations)",
            [
                p(styles, "<b>Propósito:</b> Gestión multi-tenant — cada EPS, clínica o empresa."),
                h2(styles, "Configuración por org"),
                b(styles, "Código de afiliación, programa EPS, límites de pacientes/nutricionistas"),
                b(styles, "Contrato: inicio, fin, tier SLA (enterprise / standard / basic)"),
                b(styles, "Flag sandbox (solo keys partner de prueba)"),
                b(styles, "Módulos habilitados y white-label (logo, color primario)"),
                b(styles, "Códigos de beneficio, sedes y miembros"),
                h2(styles, "Alertas de contrato"),
                p(styles, "API: GET /api/superadmin/organizations/contract-alerts — vencimientos próximos."),
            ],
        )
    )

    story.extend(
        section(
            styles,
            "8. Facturación (/superadmin/billing)",
            [
                p(styles, "<b>Propósito:</b> Monetización B2B de la plataforma."),
                make_table(
                    ["Pestaña", "Contenido"],
                    [
                        ["Revenue", "MRR, ARR, churn, LTV, gráfico mensual"],
                        ["Planes", "Catálogo de planes de suscripción"],
                        ["Suscripciones", "Estado por org (active, past_due, cancelled…)"],
                        ["Facturas", "Emitidas y pagadas"],
                        ["Morosos", "Suscripciones en mora o bloqueadas"],
                    ],
                    col_widths=[1.2 * inch, 4.2 * inch],
                ),
                Spacer(1, 6),
                p(styles, "<b>Integración Wompi:</b> checkout, payment links, webhook /api/webhooks/billing/wompi"),
            ],
        )
    )

    story.append(PageBreak())

    story.extend(
        section(
            styles,
            "9. Módulos / Feature flags (/superadmin/features)",
            [
                p(styles, "<b>Propósito:</b> Activar/desactivar funcionalidades por org sin redeploy."),
                make_table(
                    ["Flag", "Efecto"],
                    [
                        ["Fases 1–4 paciente", "Adherencia, recomendaciones, aprendizaje, diario"],
                        ["Clínica Colombia", "MIPRESS, RIPS, módulo clínico"],
                        ["Gamificación", "Retos y logros"],
                        ["PWA / offline", "Modo offline paciente"],
                        ["Centro avanzado", "Hub clínico, analytics avanzados"],
                    ],
                    col_widths=[1.5 * inch, 3.9 * inch],
                ),
                Spacer(1, 6),
                p(styles, "Dos niveles: global (toda la plataforma) y override por organización."),
                p(styles, "Los menús de paciente/nutricionista se actualizan al volver a la pestaña del navegador."),
            ],
        )
    )

    story.extend(
        section(
            styles,
            "10. Ops y monitoreo (/superadmin/ops)",
            [
                b(styles, "Latencia por endpoint"),
                b(styles, "Errores 5xx en las últimas 24 horas"),
                b(styles, "Jobs en background"),
                b(styles, "Sync offline (PWA)"),
                b(styles, "Uso de almacenamiento"),
                b(styles, "Historial de métricas: /api/superadmin/ops/metrics/history"),
            ],
        )
    )

    story.extend(
        section(
            styles,
            "11. Compliance Colombia (/superadmin/compliance)",
            [
                p(styles, "<b>Propósito:</b> Ley 1581 / Habeas Data — requisito para contratos EPS/hospital."),
                make_table(
                    ["Pestaña", "Función"],
                    [
                        ["Habeas Data", "Registrar y exportar consentimientos"],
                        ["Export / olvido", "Export JSON; procesar eliminación (approve/reject/complete)"],
                        ["Accesos clínicos", "Quién accedió a qué dato clínico"],
                        ["Políticas", "T&C, privacidad, cookies (versionado)"],
                        ["Brechas", "Registro de incidentes de seguridad"],
                    ],
                    col_widths=[1.3 * inch, 4.1 * inch],
                ),
                Spacer(1, 6),
                p(styles, "Self-service paciente: export y solicitud de eliminación en Configuración → Privacidad."),
                p(styles, "Al cambiar estado de eliminación: notificación in-app + email (si SMTP configurado)."),
            ],
        )
    )

    story.append(PageBreak())

    story.extend(
        section(
            styles,
            "12. Integraciones (/superadmin/integrations)",
            [
                b(styles, "Catálogo: WhatsApp Business, Google Calendar, Wompi, PayU, Stripe, EPS API"),
                b(styles, "Configuración por integración (credenciales, estado)"),
                b(styles, "Webhooks salientes hacia sistemas externos"),
            ],
        )
    )

    story.extend(
        section(
            styles,
            "13. Soporte L2 (/superadmin/support)",
            [
                p(styles, "<b>Propósito:</b> Cola centralizada — tickets escalados desde nutricionistas."),
                b(styles, "Ver todos los tickets (no silo por nutricionista)"),
                b(styles, "Asignar agente, responder, cambiar prioridad"),
                b(styles, "Escalar manualmente a L2"),
                b(styles, "SLA según tier de la org del paciente"),
                b(styles, "Macros de respuesta reutilizables"),
                p(styles, "Nutricionista escala desde /support con botón «Escalar L2»."),
            ],
        )
    )

    story.extend(
        section(
            styles,
            "14. Analítica (/superadmin/analytics)",
            [
                b(styles, "Embudo de conversión"),
                b(styles, "Cohortes de retención"),
                b(styles, "Uso por módulo"),
                b(styles, "Sesiones activas"),
                b(styles, "NPS"),
                b(styles, "Export CSV (30 días): /api/superadmin/analytics/export"),
            ],
        )
    )

    story.extend(
        section(
            styles,
            "15. Contenido clínico (/superadmin/clinical-content)",
            [
                b(styles, "Plantillas de intervención"),
                b(styles, "Artículos por condición clínica"),
                b(styles, "Retos (Fase 3) con workflow de publicación"),
                b(styles, "Sustituciones alimentarias (Fase 4)"),
                b(styles, "Prep de cita"),
            ],
        )
    )

    story.append(PageBreak())

    story.extend(
        section(
            styles,
            "16. Plataforma enterprise (/superadmin/platform)",
            [
                make_table(
                    ["Pestaña", "Función"],
                    [
                        ["Impersonación", "Log de sesiones impersonadas (30 días)"],
                        ["Comunicaciones", "Email masivo por cohorte (rol, org, inactivos)"],
                        ["Workflows", "Ej.: adherencia < 50% → tarea + notificación"],
                        ["API Partners", "Keys EPS con scopes, org binding, sandbox"],
                        ["Seguridad", "Rate limits, 2FA TOTP, IP allowlist"],
                        ["Reportes", "Reportes programados EPS (semanal)"],
                        ["Release notes", "Novedades por versión y rol"],
                    ],
                    col_widths=[1.3 * inch, 4.1 * inch],
                ),
                Spacer(1, 8),
                h2(styles, "API Partner EPS (header X-API-Key)"),
                b(styles, "GET /api/partner/v1/aggregates"),
                b(styles, "GET /api/partner/v1/organization"),
                b(styles, "GET /api/partner/v1/patients/summary"),
                b(styles, "GET /api/partner/v1/adherence"),
                b(styles, "GET /api/partner/v1/programs"),
            ],
        )
    )

    story.extend(
        section(
            styles,
            "17. Configuración (/superadmin/settings)",
            [
                b(styles, "Perfil superadmin, avatar, imagen hero del home"),
                b(styles, "Nombre del sitio, email soporte, límites globales"),
                b(styles, "Registro, verificación email, 2FA global"),
                h2(styles, "Pestañas técnicas"),
                b(styles, "Variables: SMTP, URLs, entorno (production/staging/sandbox), CORS"),
                b(styles, "Módulos: enlace a /superadmin/features"),
                b(styles, "Mantenimiento: bloquea acceso excepto superadmin"),
                b(styles, "Backup: export/import JSON de toda la configuración"),
            ],
        )
    )

    story.extend(
        section(
            styles,
            "18. Contenido y marketing",
            [
                make_table(
                    ["Pantalla", "Gestiona"],
                    [
                        ["Artículos Home", "Blog/landing público (/articles)"],
                        ["Biblioteca recetas", "Recetas globales para nutricionistas"],
                        ["Config → Hero", "Imagen principal del home"],
                    ],
                    col_widths=[1.5 * inch, 3.9 * inch],
                ),
            ],
        )
    )

    story.append(PageBreak())

    story.extend(
        section(
            styles,
            "19. Flujos operativos frecuentes",
            [
                h2(styles, "Soporte técnico a nutricionista"),
                b(styles, "1. Nutricionistas → Impersonar (motivo obligatorio)"),
                b(styles, "2. Reproducir problema en su sesión"),
                b(styles, "3. Revisar log en Plataforma → Impersonación o Auditoría"),
                b(styles, "4. Cerrar sesión impersonada desde banner rojo"),
                h2(styles, "Ticket complejo de paciente"),
                b(styles, "1. Nutricionista responde en /support"),
                b(styles, "2. Si no resuelve → Escalar L2"),
                b(styles, "3. Superadmin toma en Soporte L2 con macros y SLA"),
                h2(styles, "Onboarding nueva EPS"),
                b(styles, "1. Organizaciones → crear tenant + contrato + SLA tier"),
                b(styles, "2. Módulos / Flags → activar módulos del contrato"),
                b(styles, "3. Facturación → suscripción + plan"),
                b(styles, "4. Plataforma → API key partner (si aplica)"),
                b(styles, "5. Integraciones → WhatsApp / Calendar según contrato"),
                h2(styles, "Auditoría pre-contrato EPS"),
                b(styles, "1. Compliance CO → políticas publicadas"),
                b(styles, "2. Auditoría → trazabilidad de accesos"),
                b(styles, "3. Salud tenant → export PDF para el cliente"),
            ],
        )
    )

    story.extend(
        section(
            styles,
            "20. Seguridad y checklist diario",
            [
                h2(styles, "Seguridad"),
                b(styles, "Solo rol superadmin accede a estas rutas"),
                b(styles, "2FA TOTP recomendado: Plataforma → Seguridad"),
                b(styles, "IP allowlist opcional (lista vacía = todas las IPs)"),
                b(styles, "Modo mantenimiento: solo superadmin entra"),
                b(styles, "Impersonación y cambios críticos quedan en auditoría"),
                h2(styles, "Checklist diario sugerido"),
                b(styles, "1. Dashboard — MRR, alertas, churn"),
                b(styles, "2. Soporte L2 — tickets SLA vencido o sin asignar"),
                b(styles, "3. Salud tenant — orgs con churn risk alto"),
                b(styles, "4. Compliance — solicitudes de eliminación pendientes"),
                b(styles, "5. Ops — picos de errores 5xx"),
            ],
        )
    )

    story.append(Spacer(1, 24))
    story.append(HRFlowable(width="40%", thickness=0.5, color=BRAND, hAlign="CENTER"))
    story.append(Spacer(1, 8))
    story.append(Paragraph("NutriData — Panel Superadmin", styles["footer"]))
    story.append(
        Paragraph(
            "Documento generado automáticamente. Regenerar: python scripts/generate_superadmin_panel_guide_pdf.py",
            styles["footer"],
        )
    )

    return story


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    styles = build_styles()
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=letter,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.65 * inch,
        title="Guía del Panel Superadmin — NutriData",
        author="NutriData",
    )
    doc.build(build_story(styles), onFirstPage=add_page_number, onLaterPages=add_page_number)
    print(f"PDF generado: {OUTPUT}")
    print(f"Tamaño: {OUTPUT.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
