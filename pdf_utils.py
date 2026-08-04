"""Utilidades compartidas para firma digital en PDFs NutriData."""
from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Callable, Optional, Tuple

from reportlab.lib import colors
from reportlab.pdfgen import canvas


def make_verification_code(user_id: int, doc_type: str, generated_at: datetime) -> str:
    raw = f"{user_id}:{doc_type}:{generated_at.strftime('%Y-%m-%dT%H:%M:%S')}:nutridata"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12].upper()


def get_nutritionist_signatory(db, user, AdminProfileDB) -> Tuple[str, Optional[str], Optional[str]]:
    """Retorna (nombre, TO/licencia, especialidad)."""
    if not user:
        return "Sistema NutriData", None, None
    name = f"{getattr(user, 'nombres', '') or ''} {getattr(user, 'apellidos', '') or ''}".strip()
    license_to = None
    specialty = None
    if AdminProfileDB is not None:
        prof = db.query(AdminProfileDB).filter(AdminProfileDB.user_id == user.id).first()
        if prof:
            license_to = getattr(prof, "license", None)
            specialty = getattr(prof, "specialty", None)
    return name or "Nutricionista", license_to, specialty


def draw_pdf_signature_block(
    p: canvas.Canvas,
    *,
    x: float,
    y: float,
    width: float,
    nutritionist_name: str,
    license_to: Optional[str] = None,
    specialty: Optional[str] = None,
    generated_at: str,
    verification_code: str,
    doc_label: str = "Documento clínico",
) -> float:
    """
    Dibuja bloque de firma digital. Retorna nueva coordenada Y (debajo del bloque).
    """
    box_h = 72
    p.setStrokeColor(colors.HexColor("#7a9b76"))
    p.setFillColor(colors.HexColor("#f6faf7"))
    p.setLineWidth(0.8)
    p.roundRect(x, y - box_h, width, box_h, 4, stroke=1, fill=1)

    p.setFillColor(colors.HexColor("#352d26"))
    p.setFont("Helvetica-Bold", 9)
    p.drawString(x + 10, y - 16, "Firma digital del profesional")

    p.setFont("Helvetica", 8)
    p.setFillColor(colors.HexColor("#6b6159"))
    p.drawString(x + 10, y - 30, f"{doc_label} · Generado: {generated_at}")

    p.setFillColor(colors.HexColor("#352d26"))
    p.setFont("Helvetica-Bold", 10)
    p.drawString(x + 10, y - 46, nutritionist_name)
    meta = "Nutricionista Dietista"
    if specialty:
        meta = specialty
    if license_to:
        meta += f" · TO: {license_to}"
    p.setFont("Helvetica", 8)
    p.setFillColor(colors.HexColor("#6b6159"))
    p.drawString(x + 10, y - 58, meta)

    p.setFont("Helvetica-Bold", 7)
    p.setFillColor(colors.HexColor("#7a9b76"))
    p.drawRightString(x + width - 10, y - 20, "VERIFICACIÓN")
    p.setFont("Helvetica", 8)
    p.setFillColor(colors.HexColor("#352d26"))
    p.drawRightString(x + width - 10, y - 32, verification_code)
    p.setFont("Helvetica", 6)
    p.setFillColor(colors.HexColor("#6b6159"))
    p.drawRightString(x + width - 10, y - 42, "Código de autenticidad")

    return y - box_h - 8


def draw_pdf_footer_line(
    p: canvas.Canvas,
    *,
    left: float,
    right: float,
    y: float,
    nutritionist_name: str,
    license_to: Optional[str] = None,
    generated_at: str,
    verification_code: str,
):
    p.setFont("Helvetica", 8)
    p.setFillColor(colors.HexColor("#6b6159"))
    p.line(left, y + 10, right, y + 10)
    footer = f"Firmado digitalmente por {nutritionist_name}"
    if license_to:
        footer += f" · TO: {license_to}"
    footer += f" · {generated_at} · Verificación: {verification_code}"
    p.drawString(left, y, footer[:120])
    p.drawRightString(right, y, "NutriData ©")
