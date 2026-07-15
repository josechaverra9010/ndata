"""
Zona horaria oficial de NutriData: Colombia (America/Bogota, UTC-5, sin DST).
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

TZ_COLOMBIA = ZoneInfo("America/Bogota")
TZ_NAME = "America/Bogota"
TZ_LABEL = "COT"  # Colombia Time


def now_co() -> datetime:
    """Fecha/hora actual en Colombia como datetime naive (para columnas/strings locales)."""
    return datetime.now(TZ_COLOMBIA).replace(tzinfo=None)


def today_co() -> date:
    """Fecha de hoy en Colombia."""
    return datetime.now(TZ_COLOMBIA).date()


def now_co_aware() -> datetime:
    """Fecha/hora actual timezone-aware en America/Bogota."""
    return datetime.now(TZ_COLOMBIA)


def now_co_str(fmt: str = "%Y-%m-%d %H:%M:%S") -> str:
    return now_co().strftime(fmt)


def today_co_str(fmt: str = "%Y-%m-%d") -> str:
    return today_co().strftime(fmt)


def utc_now() -> datetime:
    """UTC aware — usar solo para JWT / tokens."""
    return datetime.now(timezone.utc)
