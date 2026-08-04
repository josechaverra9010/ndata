#!/usr/bin/env python3
"""Genera PDF: Guía del Panel del Paciente — NutriData."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
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
OUTPUT = ROOT / "docs" / "Guia-Panel-Paciente-NutriData.pdf"

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
    canvas.drawString(inch, 0.45 * inch, "NutriData — Guía del Panel del Paciente")
    canvas.drawRightString(letter[0] - inch, 0.45 * inch, f"Página {doc.page}")
    canvas.restoreState()


def build_story(styles):
    story = []

    # Portada
    story.append(Spacer(1, 1.8 * inch))
    story.append(Paragraph("NutriData", styles["title"]))
    story.append(
        Paragraph(
            "Guía del Panel del Paciente",
            ParagraphStyle("CoverSub", parent=styles["title"], fontSize=16, textColor=BRAND),
        )
    )
    story.append(Spacer(1, 0.3 * inch))
    story.append(
        Paragraph(
            f"Manual de uso para pacientes — módulos, flujos y funciones<br/>"
            f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}",
            styles["subtitle"],
        )
    )
    story.append(Spacer(1, 0.5 * inch))
    story.append(
        p(
            styles,
            "Este documento explica cada sección del panel del paciente: qué puede hacer, "
            "cómo usarla en el día a día y cómo se conecta con el seguimiento del nutricionista.",
        )
    )
    story.append(PageBreak())

    # Índice
    story.append(Paragraph("Índice de contenidos", styles["h1"]))
    story.append(Spacer(1, 8))
    toc_items = [
        "1. Visión general del panel",
        "2. Mi Dashboard",
        "3. Mis Comidas",
        "4. Mi Plan Nutricional",
        "5. Mi Adherencia",
        "6. Notificaciones",
        "7. Recomendaciones",
        "8. Lista de Compras",
        "9. Mis Documentos",
        "10. Retos y Logros",
        "11. Aprender",
        "12. Bienestar (hábitos y wearables)",
        "13. Mi Programa EPS",
        "14. Diario Fotográfico",
        "15. Sustituciones inteligentes",
        "16. Recetas",
        "17. Mi Progreso",
        "18. Mis Citas",
        "19. Mensajes",
        "20. Mi Perfil",
        "21. Configuración",
        "22. Ayuda y soporte",
        "23. App móvil (PWA) y modo offline",
        "24. Módulos backend",
        "25. Rutina diaria recomendada",
    ]
    for item in toc_items:
        story.append(Paragraph(item, styles["toc"]))
    story.append(PageBreak())

    # 1. Visión general
    story.extend(
        section(
            styles,
            "1. Visión general del panel",
            [
                p(
                    styles,
                    "El panel del paciente es la aplicación personal de NutriData. Permite seguir "
                    "el plan nutricional asignado por el profesional, registrar comidas, ver progreso, "
                    "recibir recomendaciones, prepararse para citas y comunicarse con el nutricionista.",
                ),
                h2(styles, "Acceso"),
                b(styles, "URL: iniciar sesión con rol <b>patient</b> → redirección automática a /patient"),
                b(styles, "Navegación: menú lateral (escritorio) o menú inferior (móvil)"),
                b(styles, "Cabecera: avatar, notificaciones rápidas y acceso a perfil"),
                h2(styles, "Flujo diario sugerido"),
                b(styles, "Revisar el Dashboard al abrir la app"),
                b(styles, "Registrar comidas del día en Mis Comidas"),
                b(styles, "Consultar el menú en Mi Plan Nutricional"),
                b(styles, "Revisar notificaciones y mensajes del nutricionista"),
                h2(styles, "Fases implementadas"),
                make_table(
                    ["Fase", "Módulos principales"],
                    [
                        ["Fase 1", "Adherencia, centro de notificaciones"],
                        ["Fase 2", "Recomendaciones, lista de compras, documentos, prep cita, adjuntos"],
                        ["Fase 3", "Retos, educación, programa EPS, hábitos, recordatorios"],
                        ["Fase 4", "Diario fotográfico, sustituciones, wearables, PWA/offline"],
                    ],
                    col_widths=[1.0 * inch, 4.4 * inch],
                ),
            ],
        )
    )

    # 2. Dashboard
    story.extend(
        section(
            styles,
            "2. Mi Dashboard (/patient)",
            [
                p(styles, "<b>Propósito:</b> Pantalla de inicio con resumen del día y accesos rápidos."),
                h2(styles, "Qué muestra"),
                b(styles, "Calorías consumidas vs. meta del plan"),
                b(styles, "Agua: vasos/litros consumidos y progreso"),
                b(styles, "Comidas completadas del día"),
                b(styles, "Macronutrientes (proteína, carbohidratos, grasa)"),
                b(styles, "Próxima cita y plan activo"),
                b(styles, "Tarjetas de acceso rápido a módulos (adherencia, retos, aprender, etc.)"),
                b(styles, "Comidas del día con estado completado/pendiente"),
                h2(styles, "Acciones"),
                b(styles, "Marcar comidas como completadas"),
                b(styles, "Agregar/quitar alimentos del registro diario"),
                b(styles, "Registrar vasos de agua"),
                b(styles, "Abrir detalle de cada comida"),
                p(styles, "<b>API:</b> GET /api/patient/{id}/dashboard/complete"),
            ],
        )
    )

    # 3. Mis Comidas
    story.extend(
        section(
            styles,
            "3. Mis Comidas (/patient/meals)",
            [
                p(
                    styles,
                    "<b>Propósito:</b> Registro detallado de alimentos por comida del día "
                    "(desayuno, almuerzo, comida, merienda, cena).",
                ),
                h2(styles, "Funciones"),
                b(styles, "Ver comidas del día con horarios y calorías"),
                b(styles, "Marcar comida completa o incompleta"),
                b(styles, "Agregar alimentos personalizados al registro"),
                b(styles, "Eliminar alimentos registrados"),
                b(styles, "Inicializar tracking del día si aún no existe"),
                h2(styles, "APIs"),
                b(styles, "GET /api/patient/{id}/meals/today/detailed"),
                b(styles, "POST /api/patient/{id}/meals/food/add | toggle | remove"),
                b(styles, "POST /api/patient/{id}/meals/initialize"),
                p(
                    styles,
                    "<b>Consejo:</b> Registrar las comidas aquí mejora tu adherencia visible "
                    "para el nutricionista y desbloquea retos semanales.",
                ),
            ],
        )
    )

    # 4. Mi Plan
    story.append(PageBreak())
    story.extend(
        section(
            styles,
            "4. Mi Plan Nutricional (/patient/my-plan)",
            [
                p(
                    styles,
                    "<b>Propósito:</b> Visualizar el plan alimentario activo asignado por tu nutricionista.",
                ),
                h2(styles, "Qué incluye"),
                b(styles, "Menú semanal día por día"),
                b(styles, "Comidas por slot: desayuno, almuerzo, comida, merienda, cena"),
                b(styles, "Recetas, porciones e intercambios alimentarios"),
                b(styles, "Totales de calorías y macronutrientes por día"),
                b(styles, "Lista de intercambios (ExchangeList) según el plan"),
                p(styles, "<b>API:</b> GET /api/patient/{id}/plan/weekly"),
                p(
                    styles,
                    "<b>Nota:</b> El plan lo diseña y asigna el nutricionista; el paciente lo consulta "
                    "y lo usa como guía diaria.",
                ),
            ],
        )
    )

    # 5. Adherencia
    story.extend(
        section(
            styles,
            "5. Mi Adherencia (/patient/adherence) — Fase 1",
            [
                p(
                    styles,
                    "<b>Propósito:</b> Medir qué tan bien sigues tu plan alimentario.",
                ),
                h2(styles, "Indicadores"),
                b(styles, "Adherencia de hoy y de la semana (%)"),
                b(styles, "Comparación con la semana anterior (tendencia ↑ ↓ →)"),
                b(styles, "Gráfico de barras de los últimos 7 días"),
                b(styles, "Nivel: excelente, bueno, regular, bajo"),
                b(styles, "Días sin registro de comidas"),
                b(styles, "Siguiente acción sugerida (ej. ir a Mis Comidas)"),
                b(styles, "Tips personalizados según tu nivel"),
                p(
                    styles,
                    "<b>Fórmula:</b> (comidas completadas ÷ comidas totales) × 100 en el periodo.",
                ),
                p(styles, "<b>API:</b> GET /api/patient/{id}/adherence"),
            ],
        )
    )

    # 6. Notificaciones
    story.extend(
        section(
            styles,
            "6. Notificaciones (/patient/notifications) — Fase 1",
            [
                p(
                    styles,
                    "<b>Propósito:</b> Centro unificado de alertas y recordatorios.",
                ),
                h2(styles, "Tipos de notificación"),
                b(styles, "Recordatorio de cita (24 h antes)"),
                b(styles, "Registra tus comidas (sin logs recientes)"),
                b(styles, "Adherencia baja"),
                b(styles, "Mensajes del nutricionista"),
                b(styles, "Recomendaciones e intervenciones nuevas"),
                h2(styles, "Funciones"),
                b(styles, "Filtrar: todas / no leídas"),
                b(styles, "Marcar como leída individual o todas"),
                b(styles, "Navegar al módulo relacionado desde la notificación"),
                p(styles, "<b>APIs:</b> GET /api/patient/{id}/notifications/inbox, POST .../read, .../read-all"),
            ],
        )
    )

    # 7-9 Fase 2
    story.append(PageBreak())
    story.extend(
        section(
            styles,
            "7. Recomendaciones (/patient/recommendations) — Fase 2",
            [
                p(
                    styles,
                    "<b>Propósito:</b> Recibir orientación clínica enviada por el nutricionista "
                    "(intervenciones, metas SMART, mensajes educativos).",
                ),
                b(styles, "Lista de recomendaciones con fecha y estado leído/no leído"),
                b(styles, "Detalle expandible de cada recomendación"),
                b(styles, "Marcar como leída o marcar todas"),
                p(
                    styles,
                    "<b>Origen:</b> El nutricionista envía intervenciones desde su panel "
                    "(InterventionPickerDialog → POST /api/nutritionist/interventions/{id}/deliver).",
                ),
                p(styles, "<b>API:</b> GET /api/patient/{id}/recommendations"),
            ],
        )
    )

    story.extend(
        section(
            styles,
            "8. Lista de Compras (/patient/shopping-list) — Fase 2",
            [
                p(
                    styles,
                    "<b>Propósito:</b> Lista de ingredientes generada automáticamente desde tu menú semanal.",
                ),
                h2(styles, "Funciones"),
                b(styles, "Ingredientes agrupados por categoría (verduras, proteínas, lácteos, etc.)"),
                b(styles, "Marcar ítems como comprados (persistido en localStorage)"),
                b(styles, "Regenerar lista desde el menú actual"),
                p(styles, "<b>API:</b> GET /api/patient/{id}/shopping-list"),
            ],
        )
    )

    story.extend(
        section(
            styles,
            "9. Mis Documentos (/patient/documents) — Fase 2",
            [
                p(
                    styles,
                    "<b>Propósito:</b> Acceder a informes y documentos clínicos compartidos.",
                ),
                b(styles, "Informes nutricionales en PDF"),
                b(styles, "Historias clínicas exportadas"),
                b(styles, "Descarga directa de archivos"),
                p(styles, "<b>API:</b> GET /api/patient/{id}/documents"),
            ],
        )
    )

    # 10-13 Fase 3
    story.append(PageBreak())
    story.extend(
        section(
            styles,
            "10. Retos y Logros (/patient/challenges) — Fase 3",
            [
                p(
                    styles,
                    "<b>Propósito:</b> Gamificación para mantener motivación y hábitos saludables.",
                ),
                make_table(
                    ["Reto", "Meta", "Puntos"],
                    [
                        ["Hidratación del día", "2 L de agua", "10"],
                        ["5 comidas registradas", "Esta semana", "25"],
                        ["Adherencia 70%", "Semanal", "30"],
                        ["Peso de la semana", "1 registro", "15"],
                        ["Racha de 3 días", "Comidas consecutivas", "20"],
                    ],
                    col_widths=[2.0 * inch, 2.0 * inch, 1.4 * inch],
                ),
                Spacer(1, 8),
                b(styles, "Ver progreso de cada reto y reclamar puntos al completarlo"),
                b(styles, "Total de puntos acumulados visible en la pantalla"),
                p(styles, "<b>APIs:</b> GET /api/patient/{id}/challenges, POST .../challenges/{key}/claim"),
            ],
        )
    )

    story.extend(
        section(
            styles,
            "11. Aprender (/patient/learn) — Fase 3",
            [
                p(
                    styles,
                    "<b>Propósito:</b> Educación nutricional personalizada según tu condición de salud.",
                ),
                b(styles, "Artículos filtrados por condición (diabetes, obesidad, HTA, embarazo, etc.)"),
                b(styles, "Búsqueda por texto"),
                b(styles, "Lectura de artículo completo con contenido enriquecido"),
                b(styles, "Artículos generales si no hay condición específica"),
                p(styles, "<b>APIs:</b> GET /api/patient/{id}/learn, GET .../learn/{article_id}"),
            ],
        )
    )

    story.extend(
        section(
            styles,
            "12. Bienestar (/patient/habits) — Fase 3",
            [
                p(
                    styles,
                    "<b>Propósito:</b> Registro diario de hábitos de salud y sincronización con wearables.",
                ),
                h2(styles, "Hábitos registrables"),
                b(styles, "Agua (vasos / ml)"),
                b(styles, "Sueño (horas)"),
                b(styles, "Ejercicio (minutos)"),
                b(styles, "Estado de ánimo"),
                b(styles, "Notas del día"),
                h2(styles, "Wearables (Fase 4)"),
                b(styles, "Pasos, calorías activas, frecuencia cardíaca"),
                b(styles, "Registro manual o snapshot del día"),
                p(styles, "<b>APIs:</b> GET/PUT /api/patient/{id}/habits/today, GET/PUT .../wearables/today"),
            ],
        )
    )

    story.extend(
        section(
            styles,
            "13. Mi Programa (/patient/program) — Fase 3",
            [
                p(
                    styles,
                    "<b>Propósito:</b> Información de tu programa EPS u organización de salud.",
                ),
                b(styles, "Nombre del programa y organización"),
                b(styles, "Beneficios incluidos (consultas, seguimiento, etc.)"),
                b(styles, "Estadísticas: citas completadas, días de seguimiento, logros"),
                b(styles, "Acceso rápido a citas y progreso"),
                p(styles, "<b>API:</b> GET /api/patient/{id}/program"),
            ],
        )
    )

    # 14-15 Fase 4
    story.append(PageBreak())
    story.extend(
        section(
            styles,
            "14. Diario Fotográfico (/patient/food-diary) — Fase 4",
            [
                p(
                    styles,
                    "<b>Propósito:</b> Registrar visualmente lo que comes para seguimiento más rico.",
                ),
                b(styles, "Subir foto por comida (cámara o galería)"),
                b(styles, "Asociar foto a tipo de comida y nota opcional"),
                b(styles, "Galería de los últimos 30 días"),
                b(styles, "Eliminar fotos propias"),
                p(
                    styles,
                    "<b>APIs:</b> GET /api/patient/{id}/meal-photos, "
                    "POST .../meal-photos/upload, DELETE .../meal-photos/{id}",
                ),
            ],
        )
    )

    story.extend(
        section(
            styles,
            "15. Sustituciones inteligentes (/patient/substitutions) — Fase 4",
            [
                p(
                    styles,
                    "<b>Propósito:</b> Encontrar alternativas nutricionales cuando no tienes un ingrediente.",
                ),
                b(styles, "Buscar por ingrediente (pollo, arroz, leche, etc.)"),
                b(styles, "Motivo: no tengo, alergia, preferencia, presupuesto"),
                b(styles, "Alternativas con porción equivalente y razón clínica"),
                b(styles, "Sustituciones populares precargadas"),
                p(
                    styles,
                    "<b>APIs:</b> GET /api/patient/{id}/substitutions/popular, "
                    "POST .../substitutions/suggest",
                ),
            ],
        )
    )

    # 16-19
    story.extend(
        section(
            styles,
            "16. Recetas (/patient/recipes)",
            [
                p(styles, "<b>Propósito:</b> Explorar recetas del catálogo nutricional."),
                b(styles, "Buscar y filtrar recetas"),
                b(styles, "Ver ingredientes, instrucciones, macros y tiempo"),
                b(styles, "Recetas vinculadas al plan y menú semanal"),
                p(styles, "<b>API:</b> GET /api/recipes (lectura)"),
            ],
        )
    )

    story.extend(
        section(
            styles,
            "17. Mi Progreso (/patient/progress)",
            [
                p(
                    styles,
                    "<b>Propósito:</b> Seguimiento longitudinal de métricas corporales.",
                ),
                b(styles, "Gráficos de peso, IMC, grasa corporal, circunferencias"),
                b(styles, "Registrar nuevas mediciones"),
                b(styles, "Comparar peso actual vs. inicial y meta"),
                b(styles, "Logros desbloqueados"),
                p(styles, "<b>APIs:</b> GET /api/patient/{id}/progress, POST .../progress/add"),
            ],
        )
    )

    story.append(PageBreak())
    story.extend(
        section(
            styles,
            "18. Mis Citas (/patient/appointments)",
            [
                p(styles, "<b>Propósito:</b> Gestionar consultas con el nutricionista."),
                h2(styles, "Funciones"),
                b(styles, "Ver citas próximas e historial"),
                b(styles, "Solicitar nueva cita (fecha, hora, modalidad)"),
                b(styles, "Cancelar o reprogramar citas pendientes"),
                b(styles, "Enlace de videollamada cuando aplique"),
                h2(styles, "Prep pre-cita (Fase 2) — AppointmentPrepPanel"),
                b(styles, "Checklist: registrar comidas, actualizar peso, revisar menú"),
                b(styles, "Preparar preguntas y confirmar asistencia"),
                b(styles, "Notas personales para la consulta"),
                p(
                    styles,
                    "<b>APIs:</b> /api/patient/{id}/appointments, "
                    "GET/PUT /api/patient/{id}/appointments/{id}/prep-checklist",
                ),
            ],
        )
    )

    story.extend(
        section(
            styles,
            "19. Mensajes (/patient/messages)",
            [
                p(
                    styles,
                    "<b>Propósito:</b> Chat directo con tu nutricionista.",
                ),
                b(styles, "Lista de conversaciones"),
                b(styles, "Enviar y recibir mensajes de texto"),
                b(styles, "Adjuntar archivos: imágenes, PDF, documentos (Fase 2)"),
                b(styles, "Estados: enviado, entregado, leído"),
                b(styles, "Contador de mensajes no leídos en cabecera"),
                p(styles, "<b>API:</b> /api/messages/conversations, /api/messages/send"),
            ],
        )
    )

    # 20-23
    story.extend(
        section(
            styles,
            "20. Mi Perfil (/patient/profile)",
            [
                p(styles, "<b>Propósito:</b> Datos personales y clínicos del paciente."),
                b(styles, "Información básica: nombre, email, teléfono, foto"),
                b(styles, "Antropometría: altura, peso actual, peso objetivo"),
                b(styles, "Alergias, preferencias dietéticas, nivel de actividad"),
                b(styles, "Recordatorio 24 h y frecuencia de consumo de alimentos"),
                b(styles, "Subir foto de perfil"),
                p(
                    styles,
                    "<b>APIs:</b> GET /api/patient/{id}/profile, "
                    "PUT .../profile/update, POST .../upload-avatar",
                ),
            ],
        )
    )

    story.extend(
        section(
            styles,
            "21. Configuración (/patient/settings)",
            [
                p(styles, "<b>Propósito:</b> Preferencias de la app y cuenta."),
                h2(styles, "Secciones"),
                b(styles, "Notificaciones: email, push de comidas/citas, SMS, reporte semanal"),
                b(styles, "Recordatorios de comidas por horario (Fase 3)"),
                b(styles, "Apariencia: tema claro/oscuro, idioma, unidades"),
                b(styles, "Seguridad: cambio de contraseña"),
                b(styles, "Organización/EPS: código de beneficio corporativo"),
                p(styles, "<b>APIs:</b> GET/PUT /api/patient/{id}/reminder-preferences, /api/organizations/me"),
            ],
        )
    )

    story.extend(
        section(
            styles,
            "22. Ayuda y soporte (/patient/help)",
            [
                p(styles, "<b>Propósito:</b> Resolver dudas y contactar soporte."),
                b(styles, "Preguntas frecuentes (FAQs) por categoría"),
                b(styles, "Búsqueda en FAQs"),
                b(styles, "Crear ticket de soporte (nutrición, app, planes, técnico, facturación)"),
                b(styles, "Ver historial de tickets y respuestas del equipo"),
                p(
                    styles,
                    "<b>APIs:</b> GET /api/support/faqs, POST /api/support/ticket, "
                    "GET /api/patient/{id}/support/tickets",
                ),
            ],
        )
    )

    story.append(PageBreak())
    story.extend(
        section(
            styles,
            "23. App móvil (PWA) y modo offline — Fase 4",
            [
                p(
                    styles,
                    "<b>Propósito:</b> Usar NutriData como app instalable en el celular, incluso sin conexión.",
                ),
                h2(styles, "Instalación PWA"),
                b(styles, "Banner InstallPwaPrompt invita a instalar en pantalla de inicio"),
                b(styles, "Manifest: public/manifest.webmanifest"),
                b(styles, "Service Worker: public/sw.js (caché de assets estáticos)"),
                h2(styles, "Modo offline"),
                b(styles, "OfflineBanner avisa cuando no hay conexión"),
                b(styles, "useOfflineQueue: encola acciones (comidas, hábitos) y sincroniza al reconectar"),
                b(styles, "Log de sincronización en backend (offline_sync_logs)"),
                p(
                    styles,
                    "<b>Consejo:</b> Instala la app para recibir mejor experiencia móvil y "
                    "registrar comidas aunque pierdas señal momentáneamente.",
                ),
            ],
        )
    )

    # 24. Backend
    story.extend(
        section(
            styles,
            "24. Módulos backend del panel paciente",
            [
                make_table(
                    ["Módulo", "Responsabilidad"],
                    [
                        ["main.py", "Auth, perfil, dashboard, comidas, citas, progreso, mensajes, plan semanal"],
                        ["patient_phase1_module.py", "Adherencia, inbox de notificaciones"],
                        ["patient_phase2_module.py", "Recomendaciones, compras, documentos, prep cita, adjuntos"],
                        ["patient_phase3_module.py", "Retos, educación, programa EPS, hábitos, recordatorios"],
                        ["patient_phase4_module.py", "Diario fotográfico, sustituciones, wearables, sync offline"],
                    ],
                    col_widths=[1.8 * inch, 3.6 * inch],
                ),
                Spacer(1, 10),
                p(
                    styles,
                    "<b>API base:</b> http://localhost:8001/api (configurable vía VITE_API_BASE_URL). "
                    "<b>Autenticación:</b> JWT Bearer token en header Authorization.",
                ),
            ],
        )
    )

    # 25. Rutina
    story.extend(
        section(
            styles,
            "25. Rutina diaria recomendada para el paciente",
            [
                p(styles, "Secuencia sugerida para sacar el máximo provecho del panel:"),
                b(styles, "1. Abrir Dashboard → revisar calorías, agua y comidas pendientes"),
                b(styles, "2. Registrar comidas en Mis Comidas a lo largo del día"),
                b(styles, "3. Consultar Mi Plan si tienes duda sobre qué comer"),
                b(styles, "4. Usar Sustituciones si te falta un ingrediente"),
                b(styles, "5. Revisar Recomendaciones y Mensajes del nutricionista"),
                b(styles, "6. Completar hábitos en Bienestar (agua, sueño, ejercicio)"),
                b(styles, "7. Reclamar retos completados en Retos y Logros"),
                b(styles, "8. Antes de una cita: completar checklist en Mis Citas"),
                b(styles, "9. Registrar peso semanal en Mi Progreso"),
                b(styles, "10. Revisar Adherencia los domingos para planificar la semana"),
                Spacer(1, 8),
                p(
                    styles,
                    "<b>Recuerda:</b> Cuanto más registres, mejor podrá acompañarte tu nutricionista. "
                    "La adherencia y el progreso son visibles para el profesional en su panel.",
                ),
            ],
        )
    )

    story.append(Spacer(1, 24))
    story.append(HRFlowable(width="40%", thickness=0.5, color=BRAND, hAlign="CENTER"))
    story.append(Spacer(1, 8))
    story.append(Paragraph("NutriData — Panel del Paciente", styles["footer"]))
    story.append(
        Paragraph(
            "Documento generado automáticamente desde el repositorio del proyecto.",
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
        title="Guía del Panel del Paciente — NutriData",
        author="NutriData",
    )
    doc.build(build_story(styles), onFirstPage=add_page_number, onLaterPages=add_page_number)
    print(f"PDF generado: {OUTPUT}")
    print(f"Tamaño: {OUTPUT.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
