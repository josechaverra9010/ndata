"""
Almacenamiento de archivos subidos: disco local + Google Cloud Storage (opcional).

En Cloud Run el disco es efímero; define GCS_BUCKET para persistir fotos y otros uploads.

Variables de entorno:
  GCS_BUCKET   — nombre del bucket (ej. parchaoo-nutridata-uploads)
  GCS_PREFIX   — prefijo opcional dentro del bucket (ej. prod)
"""
from __future__ import annotations

import mimetypes
import os
from typing import List, Optional, Tuple
from urllib.parse import unquote

GCS_BUCKET = os.getenv("GCS_BUCKET", "").strip() or os.getenv("GS_BUCKET_NAME", "").strip()
GCS_PREFIX = os.getenv("GCS_PREFIX", "").strip().strip("/")

_gcs_client = None
_gcs_import_error: Optional[str] = None


def gcs_enabled() -> bool:
    return bool(GCS_BUCKET)


def storage_status() -> dict:
    return {
        "gcs_bucket": GCS_BUCKET or None,
        "gcs_prefix": GCS_PREFIX or None,
        "gcs_active": gcs_enabled() and _gcs_client is not None,
        "gcs_error": _gcs_import_error,
    }


def _safe_basename(file_name: str) -> Optional[str]:
    """Nombre de archivo seguro (permite espacios; bloquea traversal)."""
    if not file_name:
        return None
    decoded = unquote(str(file_name).strip())
    base = os.path.basename(decoded.replace("\\", "/"))
    if not base or base in (".", ".."):
        return None
    if ".." in base or "/" in base or "\\" in base or "\0" in base:
        return None
    return base


def _client_path(file_name: str) -> str:
    return f"/uploads/{file_name}"


def _object_key(file_name: str, upload_dir: str = "uploads") -> str:
    rel = f"{upload_dir.strip('/')}/{file_name}".replace("\\", "/")
    if GCS_PREFIX:
        return f"{GCS_PREFIX}/{rel}"
    return rel


def _gcs_object_key_candidates(file_name: str, upload_dir: str = "uploads") -> List[str]:
    """
    Rutas posibles en el bucket (nuevo código usa uploads/; legacy Django en raíz).
    """
    rel_upload = f"{upload_dir.strip('/')}/{file_name}".replace("\\", "/")
    rel_root = file_name.replace("\\", "/")
    raw: List[str] = []
    if GCS_PREFIX:
        raw.append(f"{GCS_PREFIX}/{rel_upload}")
        raw.append(f"{GCS_PREFIX}/{rel_root}")
    raw.append(rel_upload)
    raw.append(rel_root)
    seen = set()
    out: List[str] = []
    for key in raw:
        if key not in seen:
            seen.add(key)
            out.append(key)
    return out


def _get_gcs_client():
    global _gcs_client, _gcs_import_error
    if not gcs_enabled():
        return None
    if _gcs_client is not None:
        return _gcs_client
    try:
        from google.cloud import storage  # type: ignore

        _gcs_client = storage.Client()
        _gcs_import_error = None
        return _gcs_client
    except Exception as exc:
        _gcs_import_error = str(exc)
        print(f"[media_storage] GCS no disponible: {exc}")
        return None


def _upload_to_gcs(file_name: str, data: bytes, content_type: Optional[str], upload_dir: str) -> bool:
    client = _get_gcs_client()
    if not client:
        return False
    try:
        bucket = client.bucket(GCS_BUCKET)
        blob = bucket.blob(_object_key(file_name, upload_dir))
        ct = content_type or mimetypes.guess_type(file_name)[0] or "application/octet-stream"
        blob.upload_from_string(data, content_type=ct)
        return True
    except Exception as exc:
        print(f"[media_storage] Error subiendo a GCS ({file_name}): {exc}")
        return False


def _read_from_gcs(file_name: str, upload_dir: str = "uploads") -> Optional[Tuple[bytes, str]]:
    client = _get_gcs_client()
    if not client:
        return None
    try:
        bucket = client.bucket(GCS_BUCKET)
        for key in _gcs_object_key_candidates(file_name, upload_dir):
            blob = bucket.blob(key)
            if not blob.exists():
                continue
            data = blob.download_as_bytes()
            ct = blob.content_type or mimetypes.guess_type(file_name)[0] or "application/octet-stream"
            return data, ct
        return None
    except Exception as exc:
        print(f"[media_storage] Error leyendo GCS ({file_name}): {exc}")
        return None


def persist_upload_bytes(
    file_name: str,
    data: bytes,
    content_type: Optional[str] = None,
    upload_dir: str = "uploads",
) -> str:
    """
    Guarda en disco local y replica en GCS si GCS_BUCKET está configurado.
    Devuelve ruta pública relativa /uploads/{file_name}.
    """
    safe = _safe_basename(file_name)
    if not safe:
        raise ValueError("Nombre de archivo no válido")

    os.makedirs(upload_dir, exist_ok=True)
    local_path = os.path.join(upload_dir, safe)
    with open(local_path, "wb") as handle:
        handle.write(data)

    if gcs_enabled():
        _upload_to_gcs(safe, data, content_type, upload_dir)
        # Compat: réplica en raíz del bucket (legacy) si el nombre no coincide con uploads/
        try:
            client = _get_gcs_client()
            if client:
                bucket = client.bucket(GCS_BUCKET)
                root_key = f"{GCS_PREFIX}/{safe}" if GCS_PREFIX else safe
                ct = content_type or mimetypes.guess_type(safe)[0] or "application/octet-stream"
                bucket.blob(root_key).upload_from_string(data, content_type=ct)
        except Exception as exc:
            print(f"[media_storage] Aviso: no se replicó en raíz GCS ({safe}): {exc}")

    return _client_path(safe)


def public_url_for_upload(file_name: str, upload_dir: str = "uploads") -> Optional[str]:
    """
    URL pública directa al objeto en GCS (bucket público o CDN delante).
    GCS_PUBLIC_BASE_URL: base opcional (ej. https://storage.googleapis.com/mi-bucket/prod).
    GCS_USE_PUBLIC_URL=1: usa storage.googleapis.com/{bucket}/{key}.
    """
    safe = _safe_basename(file_name)
    if not safe or not gcs_enabled():
        return None
    key = _object_key(safe, upload_dir)
    custom = os.getenv("GCS_PUBLIC_BASE_URL", "").strip().rstrip("/")
    if custom:
        return f"{custom}/{key}"
    if os.getenv("GCS_USE_PUBLIC_URL", "").strip().lower() in ("1", "true", "yes"):
        return f"https://storage.googleapis.com/{GCS_BUCKET}/{key}"
    return None


def read_upload_file(
    file_name: str,
    upload_dir: str = "uploads",
) -> Optional[Tuple[bytes, str]]:
    """Lee bytes desde disco local o GCS."""
    safe = _safe_basename(file_name)
    if not safe:
        return None

    local_path = os.path.join(upload_dir, safe)
    if os.path.isfile(local_path):
        with open(local_path, "rb") as handle:
            data = handle.read()
        ct = mimetypes.guess_type(safe)[0] or "application/octet-stream"
        return data, ct

    return _read_from_gcs(safe, upload_dir)


def init_storage() -> None:
    """Llamar al arranque: inicializa cliente GCS si aplica."""
    if gcs_enabled():
        print(f"[media_storage] GCS bucket={GCS_BUCKET} prefix={GCS_PREFIX or '(none)'}")
        _get_gcs_client()
    else:
        print("[media_storage] Solo almacenamiento local (define GCS_BUCKET en Cloud Run para persistencia)")
