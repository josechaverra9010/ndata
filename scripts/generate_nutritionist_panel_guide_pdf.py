#!/usr/bin/env python3
"""Genera PDF: Guía del Panel del Nutricionista — NutriData."""
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
OUTPUT = ROOT / "docs" / "Guia-Panel-Nutricionista-NutriData.pdf"

BRAND = colors.HexColor("#7a9b76")
DARK = colors.HexColor("#352d26")
MUTED = colors.HexColor("#6b6159")
LIGHT_BG = colors.HexColor("#f6faf7")


def build_styles():
    base = getSampleStyleSheet()
    styles = {
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
            bulletIndent=0,
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
    return styles


def section(styles, title: str, blocks: list) -> list:
    story = [Paragraph(title, styles["h1"]), HRFlowable(width="100%", thickness=0.5, color=BRAND, spaceAfter=8)]
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
    canvas.drawString(inch, 0.45 * inch, "NutriData — Guía del Panel del Nutricionista")
    canvas.drawRightString(letter[0] - inch, 0.45 * inch, f"Página {doc.page}")
    canvas.restoreState()


def build_story(styles):
    story = []

    # Portada
    story.append(Spacer(1, 1.8 * inch))
    story.append(Paragraph("NutriData", styles["title"]))
    story.append(Paragraph("Guía del Panel del Nutricionista", ParagraphStyle(
        "CoverSub", parent=styles["title"], fontSize=16, textColor=BRAND
    )))
    story.append(Spacer(1, 0.3 * inch))
    story.append(Paragraph(
        f"Documentación de módulos, flujos clínicos y APIs<br/>"
        f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}",
        styles["subtitle"],
    ))
    story.append(Spacer(1, 0.5 * inch))
    story.append(p(styles,
        "Este documento describe en detalle cada sección del panel del nutricionista: "
        "propósito clínico, funcionalidades, endpoints del backend y relación entre módulos."
    ))
    story.append(PageBreak())

    # Índice
    story.append(Paragraph("Índice de contenidos", styles["h1"]))
    story.append(Spacer(1, 8))
    toc_items = [
        "1. Visión general del panel",
        "2. Dashboard",
        "3. Cola de trabajo",
        "4. Pacientes",
        "5. Consulta",
        "6. Intervenciones",
        "7. Recetas",
        "8. Menú semanal",
        "9. Citas",
        "10. Progreso",
        "11. Adherencia",
        "12. Centro avanzado",
        "13. Clínica CO",
        "14. Mensajes",
        "15. Soporte",
        "16. Configuración",
        "17. Módulos backend transversales",
        "18. Flujo clínico recomendado",
    ]
    for item in toc_items:
        story.append(Paragraph(item, styles["toc"]))
    story.append(PageBreak())

    # Visión general
    story.extend(section(styles, "1. Visión general del panel", [
        p(styles,
          "El panel del nutricionista está diseñado como un flujo de trabajo clínico integral. "
          "Permite pasar de la detección de urgencias del día a la atención en consulta, "
          "diseño de planes alimentarios, seguimiento longitudinal y analítica de cohorte."
        ),
        h2(styles, "Flujo operativo"),
        b(styles, "Ver qué es urgente hoy → Dashboard y Cola de trabajo"),
        b(styles, "Gestionar pacientes y atender consultas"),
        b(styles, "Diseñar planes, recetas y menús semanales"),
        b(styles, "Medir progreso individual y adherencia de la cohorte"),
        b(styles, "Herramientas avanzadas: EPS, recordatorios, analítica predictiva, Colombia"),
        b(styles, "Comunicación con pacientes y configuración profesional"),
        h2(styles, "Stack técnico"),
        p(styles,
          "Frontend: React + TypeScript (Vite). Backend: FastAPI (main.py) en puerto 8001. "
          "Módulos especializados: nutritionist_module.py, analytics_module.py, "
          "clinical_module.py, phase4_module.py, platform_module.py."
        ),
    ]))

    # Dashboard
    story.extend(section(styles, "2. Dashboard (/admin)", [
        p(styles, "<b>Propósito:</b> Pantalla de inicio con el estado general de la práctica nutricional."),
        h2(styles, "Qué muestra"),
        b(styles, "KPIs: total pacientes, planes activos, citas (incl. pendientes hoy), progreso promedio"),
        b(styles, "Pacientes recientes y próximas citas"),
        b(styles, "Top pacientes por progreso"),
        b(styles, "Widget resumido de Cola de trabajo"),
        b(styles, "Widget de Pacientes en riesgo"),
        b(styles, "Gráficos nutricionales de la cohorte"),
        h2(styles, "APIs principales"),
        b(styles, "/api/dashboard/stats"),
        b(styles, "/api/dashboard/recent-patients"),
        b(styles, "/api/dashboard/upcoming-appointments"),
        b(styles, "/api/dashboard/top-patients-progress"),
        b(styles, "/api/nutritionist/work-queue"),
        p(styles, "<b>Cuándo usarlo:</b> Al iniciar sesión, para identificar de un vistazo qué requiere atención inmediata."),
    ]))

    # Cola de trabajo
    story.extend(section(styles, "3. Cola de trabajo (/work-queue) — Fase 1", [
        p(styles,
          "<b>Propósito:</b> Lista priorizada y accionable de tareas clínicas pendientes. "
          "Funciona como el inbox operativo del nutricionista."
        ),
        h2(styles, "Categorías detectadas automáticamente"),
        make_table(
            ["Categoría", "Detección", "Acción sugerida"],
            [
                ["Citas hoy", "Pacientes con cita el día actual", "Ir a Consulta"],
                ["Citas sin documentar", "Citas pasadas (7 días) sin notas", "Completar documentación"],
                ["Pacientes en riesgo", "Baja adherencia, sin logs, cambios de peso", "Ver progreso/adherencia"],
                ["Sin plan activo", "Paciente sin plan nutricional", "Asignar plan"],
                ["Plan por vencer", "Plan activo que vence en ≤7 días", "Renovar plan"],
            ],
            col_widths=[1.4 * inch, 2.2 * inch, 1.8 * inch],
        ),
        Spacer(1, 8),
        p(styles, "<b>Backend:</b> nutritionist_module.py → GET /api/nutritionist/work-queue"),
        p(styles, "Los ítems se ordenan por severidad (high → low) y prioridad numérica."),
    ]))

    # Pacientes
    story.append(PageBreak())
    story.extend(section(styles, "4. Pacientes (/patients)", [
        p(styles, "<b>Propósito:</b> CRM clínico — gestión central de la cartera de pacientes."),
        h2(styles, "Funciones principales"),
        b(styles, "Listar, buscar y filtrar pacientes (activo, pendiente, inactivo, archivados)"),
        b(styles, "Crear y editar ficha completa (datos, antecedentes, alergias, objetivos, EPS/org)"),
        b(styles, "Asignar plan nutricional con o sin menú semanal"),
        b(styles, "Asignación masiva de menús por cohorte/EPS/organización (Fase 3)"),
        b(styles, "Historial de planes y comparador entre versiones (Fase 2)"),
        b(styles, "Agendar citas, historial clínico, PDFs firmados (informe nutricional, HC)"),
        b(styles, "Transferir paciente, recalls clínicos, cambios de estado masivos"),
        h2(styles, "APIs clave"),
        b(styles, "CRUD: /api/patients, /api/patients/{id}"),
        b(styles, "Planes: /api/meal-plans/assign, /api/patients/{id}/meal-plans"),
        b(styles, "Bulk menú: /api/nutritionist/menus/bulk-preview, bulk-filters"),
        b(styles, "Comparador: /api/nutritionist/patients/{id}/plans/history|compare"),
        b(styles, "PDFs: /api/patients/{id}/reports/nutrition, clinical-history"),
    ]))

    # Consulta
    story.extend(section(styles, "5. Consulta (/consultation)", [
        p(styles, "<b>Propósito:</b> Flujo de atención en consulta — sala de espera digital."),
        h2(styles, "Flujo de trabajo"),
        b(styles, "1. Cola de consultas: citas de hoy y próximos días (hasta 14)"),
        b(styles, "2. Seleccionar cita → carga prep clínico del paciente"),
        b(styles, "3. Checklist: confirmar asistencia, actualizar peso, revisar menú, agendar cita, nota clínica"),
        b(styles, "4. Acciones rápidas: asignar plan, mensaje, intervención, ver progreso"),
        b(styles, "5. Recordatorios 24h automáticos al entrar (citas del día siguiente)"),
        h2(styles, "Prep clínico incluye"),
        b(styles, "Datos del paciente: peso actual/objetivo, alergias, progreso"),
        b(styles, "Últimas métricas de peso y notas previas"),
        b(styles, "Plan activo asignado"),
        h2(styles, "APIs"),
        b(styles, "/api/consultation/queue"),
        b(styles, "/api/consultation/prep/{appointment_id}"),
        b(styles, "/api/consultation/reminders/send-24h"),
    ]))

    # Intervenciones
    story.extend(section(styles, "6. Intervenciones (/interventions) — Fase 2", [
        p(styles,
          "<b>Propósito:</b> Biblioteca de plantillas clínicas reutilizables para educación y seguimiento."
        ),
        h2(styles, "Tipos de contenido"),
        b(styles, "Recomendaciones nutricionales"),
        b(styles, "Mensajes para enviar al paciente"),
        b(styles, "Metas SMART estructuradas"),
        h2(styles, "Categorías"),
        p(styles, "Obesidad, diabetes, hipertensión, pediatría, gestante, general, entre otras."),
        h2(styles, "Funciones"),
        b(styles, "Plantillas del sistema + propias del nutricionista"),
        b(styles, "CRUD completo: crear, editar, duplicar, eliminar"),
        b(styles, "Aplicar intervención a paciente desde Consulta (InterventionPickerDialog)"),
        b(styles, "Filtros por categoría, tipo y búsqueda por texto"),
        p(styles, "<b>Backend:</b> /api/nutritionist/interventions, /api/nutritionist/interventions/{id}/apply"),
    ]))

    # Recetas y Menú
    story.append(PageBreak())
    story.extend(section(styles, "7. Recetas (/recipes)", [
        p(styles, "<b>Propósito:</b> Catálogo de recetas nutricionales que alimentan los menús semanales."),
        b(styles, "Crear/editar recetas con macros: calorías, proteína, carbos, grasa"),
        b(styles, "Ingredientes, instrucciones, imagen, tiempo de preparación"),
        b(styles, "Favoritos, duplicar, eliminar"),
        b(styles, "Tabla de composición de alimentos integrada (base nutricional)"),
        p(styles, "<b>API:</b> /api/recipes (CRUD completo)"),
    ]))

    story.extend(section(styles, "8. Menú semanal (/weekly-menus)", [
        p(styles, "<b>Propósito:</b> Diseño de menús semanales vinculados a planes nutricionales."),
        b(styles, "Crear planes nutricionales (adulto, pediatría, gestante, deportista, etc.)"),
        b(styles, "Armar menús día a día con slots: desayuno, almuerzo, comida, merienda, cena"),
        b(styles, "Asignar recetas por slot con totales nutricionales"),
        b(styles, "Duplicar menús/planes y asignación masiva a cohortes (Fase 3)"),
        p(styles, "<b>Flujo:</b> Receta → Menú semanal → Plan → Asignar a paciente(s)."),
        p(styles, "<b>APIs:</b> /api/meal-plans, /api/meal-plans/menus, /api/weekly-menus/by-plan/{id}, /api/meal-plans/assign"),
    ]))

    # Citas y Progreso
    story.extend(section(styles, "9. Citas (/appointments)", [
        p(styles, "<b>Propósito:</b> Calendario y gestión de agenda clínica."),
        b(styles, "Vistas: semana, mes, lista"),
        b(styles, "Crear, editar, cancelar citas (presencial, virtual, control, primera vez)"),
        b(styles, "Estados: pendiente, confirmada, completada, cancelada"),
        b(styles, "Slots disponibles por fecha y estadísticas de agenda"),
        b(styles, "Enlace directo a Consulta para atender"),
        p(styles, "<b>APIs:</b> /api/appointments, /api/appointments/available-slots/{date}"),
    ]))

    story.extend(section(styles, "10. Progreso (/progress)", [
        p(styles, "<b>Propósito:</b> Seguimiento individual y longitudinal de cada paciente."),
        b(styles, "Métricas: peso, IMC, grasa corporal, circunferencias"),
        b(styles, "Gráficos de evolución en el tiempo"),
        b(styles, "Log de comidas (adherencia diaria)"),
        b(styles, "Logros del paciente y notas clínicas del nutricionista"),
        b(styles, "Módulo de especialidad según tipo de plan"),
        p(styles, "<b>APIs:</b> /api/progress/patients, /api/progress/metrics, /api/progress/notes, /api/progress/achievements"),
        p(styles, "<b>Diferencia con Adherencia:</b> Progreso = vista individual; Adherencia = vista agregada de cohorte."),
    ]))

    # Adherencia
    story.append(PageBreak())
    story.extend(section(styles, "11. Adherencia (/analytics)", [
        p(styles,
          "<b>Propósito:</b> Centro de adherencia al plan alimentario a nivel de cohorte."
        ),
        h2(styles, "¿Qué es adherencia?"),
        p(styles,
          "Porcentaje de comidas del plan que el paciente registró como completadas en un periodo "
          "(típicamente 7–30 días). Se calcula como: (comidas completadas / comidas totales) × 100."
        ),
        h2(styles, "Funciones"),
        b(styles, "Dashboard con KPIs de cohorte"),
        b(styles, "Tabla de pacientes con % adherencia y comidas completadas/total"),
        b(styles, "Alertas: sin logs, adherencia baja, cambio rápido de peso"),
        b(styles, "Filtros por cohorte, organización, programa EPS"),
        b(styles, "Tendencias semanales de peso por grupo"),
        b(styles, "Exportar CSV/PDF de adherencia firmado"),
        p(styles, "<b>Backend:</b> analytics_module.py → /api/analytics/adherence/dashboard, /export"),
    ]))

    # Centro avanzado
    story.extend(section(styles, "12. Centro avanzado (/clinical-hub) — Fase 4", [
        p(styles, "<b>Propósito:</b> Gestión proactiva, panel EPS y analítica predictiva."),
        h2(styles, "Pestaña Recordatorios"),
        b(styles, "Preview de notificaciones a pacientes (sin logs, baja adherencia, cita mañana)"),
        b(styles, "Tareas sugeridas para el nutricionista (riesgo de abandono alto)"),
        b(styles, "Ejecutar recordatorios automáticos → notificaciones in-app + tareas de seguimiento"),
        b(styles, "Agenda de follow-ups manuales y automáticos"),
        h2(styles, "Pestaña Panel EPS"),
        b(styles, "Agrupa pacientes por programa EPS"),
        b(styles, "Adherencia promedio y pacientes en riesgo por cohorte"),
        h2(styles, "Pestaña Analítica"),
        b(styles, "KPIs clínicos agregados"),
        b(styles, "Predicción de abandono (score 0–100: logs, adherencia, citas, plan activo)"),
        b(styles, "Reporte mensual PDF firmado digitalmente"),
        p(styles, "<b>Backend:</b> phase4_module.py (follow-ups, reminders, EPS dashboard, clinical analytics)"),
    ]))

    # Clínica CO
    story.extend(section(styles, "13. Clínica CO (/clinical)", [
        p(styles, "<b>Propósito:</b> Cumplimiento clínico colombiano (bioquímica, MIPRESS, RIPS)."),
        make_table(
            ["Pestaña", "Función"],
            [
                ["Bioquímicos", "Registrar labs, gráficos, import CSV, alertas de valores anormales"],
                ["MIPRESS", "Sugerencia y prescripción de suplementos según condición"],
                ["Reportes EPS", "Resumen de pacientes con bioquímica/MIPRESS por EPS"],
                ["Export RIPS", "Generación de registros RIPS para facturación/reporte"],
                ["Historia clínica", "Export PDF de HC por paciente"],
            ],
            col_widths=[1.3 * inch, 4.1 * inch],
        ),
        Spacer(1, 8),
        p(styles, "<b>Backend:</b> clinical_module.py"),
    ]))

    # Mensajes, Soporte, Config
    story.extend(section(styles, "14. Mensajes (/messages)", [
        p(styles, "<b>Propósito:</b> Chat nutricionista ↔ paciente dentro de la plataforma."),
        b(styles, "Conversaciones con contador de no leídos"),
        b(styles, "Estados: enviado, entregado, leído"),
        b(styles, "Iniciar chat con paciente nuevo"),
        p(styles, "<b>Uso clínico:</b> Seguimiento entre consultas, motivación, aclaración de dudas del plan."),
    ]))

    story.extend(section(styles, "15. Soporte (/support)", [
        p(styles, "<b>Propósito:</b> Gestión de tickets de soporte enviados por pacientes."),
        b(styles, "Filtrar por estado y categoría (nutrición, app, planes, técnico, facturación)"),
        b(styles, "Responder al paciente y cambiar estado/prioridad"),
    ]))

    story.extend(section(styles, "16. Configuración (/settings)", [
        p(styles, "<b>Propósito:</b> Perfil profesional y preferencias del nutricionista."),
        b(styles, "Perfil: nombre, email, teléfono, especialidad, licencia, bio, foto"),
        b(styles, "Notificaciones: citas, mensajes, alertas de adherencia"),
        b(styles, "Apariencia: tema claro/oscuro"),
        b(styles, "Seguridad: cambio de contraseña"),
        b(styles, "Firma digital PDF: metadatos usados en informes firmados (Fase 3)"),
    ]))

    # Backend transversal
    story.append(PageBreak())
    story.extend(section(styles, "17. Módulos backend transversales", [
        make_table(
            ["Módulo", "Responsabilidad"],
            [
                ["main.py", "CRUD core: pacientes, citas, planes, progreso, dashboard, consulta, recetas, mensajes"],
                ["nutritionist_module.py", "Cola de trabajo, intervenciones, comparador, bulk menú, firma PDF"],
                ["analytics_module.py", "Dashboard de adherencia y exportación"],
                ["clinical_module.py", "Bioquímica, MIPRESS, RIPS, HC Colombia"],
                ["phase4_module.py", "Recordatorios, follow-ups, panel EPS, analítica avanzada"],
                ["platform_module.py", "Organizaciones/EPS (filtros y panel EPS)"],
                ["pdf_utils.py", "Firma digital y código de verificación en PDFs"],
            ],
            col_widths=[1.6 * inch, 3.8 * inch],
        ),
        Spacer(1, 10),
        h2(styles, "Rutas adicionales (no en sidebar)"),
        b(styles, "/meal-plans — gestión directa de planes"),
        b(styles, "/composition-table — tabla de composición de alimentos"),
    ]))

    # Flujo clínico
    story.extend(section(styles, "18. Flujo clínico recomendado", [
        p(styles, "Secuencia operativa sugerida para el día a día del nutricionista:"),
        b(styles, "1. Revisar Dashboard y Cola de trabajo para priorizar"),
        b(styles, "2. Atender citas en Consulta (checklist + documentación)"),
        b(styles, "3. Gestionar pacientes: asignar/renovar planes desde Pacientes"),
        b(styles, "4. Diseñar menús en Recetas + Menú semanal"),
        b(styles, "5. Monitorear evolución en Progreso y cohorte en Adherencia"),
        b(styles, "6. Actuar sobre riesgos en Centro avanzado (recordatorios, abandono)"),
        b(styles, "7. Documentación Colombia en Clínica CO cuando aplique"),
        b(styles, "8. Comunicación continua vía Mensajes"),
        Spacer(1, 8),
        p(styles, "<b>Atajo:</b> Ctrl+K abre la paleta de acciones rápidas para navegar entre módulos."),
    ]))

    story.append(Spacer(1, 24))
    story.append(HRFlowable(width="40%", thickness=0.5, color=BRAND, hAlign="CENTER"))
    story.append(Spacer(1, 8))
    story.append(Paragraph("NutriData — Panel del Nutricionista", styles["footer"]))
    story.append(Paragraph("Documento generado automáticamente desde el repositorio del proyecto.", styles["footer"]))

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
        title="Guía del Panel del Nutricionista — NutriData",
        author="NutriData",
    )
    doc.build(build_story(styles), onFirstPage=add_page_number, onLaterPages=add_page_number)
    print(f"PDF generado: {OUTPUT}")
    print(f"Tamaño: {OUTPUT.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
