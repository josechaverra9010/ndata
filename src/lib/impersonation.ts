import { API_URL } from "@/config/api";

const ORIGINAL_TOKEN_KEY = "impersonationOriginalToken";
const ORIGINAL_USER_KEY = "impersonationOriginalUser";
const IMPERSONATOR_KEY = "impersonationMeta";

export interface ImpersonationMeta {
  impersonatorName: string;
  targetName: string;
  startedAt: string;
}

export function isImpersonating(): boolean {
  return Boolean(sessionStorage.getItem(ORIGINAL_TOKEN_KEY));
}

export function getImpersonationMeta(): ImpersonationMeta | null {
  const raw = sessionStorage.getItem(IMPERSONATOR_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseApiDetail(data: unknown): string {
  if (!data || typeof data !== "object") return "Error en la solicitud";
  const detail = (data as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        typeof item === "object" && item && "msg" in item
          ? String((item as { msg: string }).msg)
          : String(item)
      )
      .join(", ");
  }
  return "Error en la solicitud";
}

export type ImpersonationStartResult =
  | { ok: true }
  | { ok: false; error: string };

export async function startImpersonation(
  nutritionistId: number,
  reason?: string
): Promise<ImpersonationStartResult> {
  return startUserImpersonation(nutritionistId, reason);
}

export async function startUserImpersonation(
  userId: number,
  reason?: string
): Promise<ImpersonationStartResult> {
  const numericId = Number(userId);
  if (!Number.isFinite(numericId) || numericId < 1) {
    return { ok: false, error: "ID de usuario no válido." };
  }

  const token = localStorage.getItem("userToken");
  const userData = localStorage.getItem("userData");
  if (!token || !userData) {
    return { ok: false, error: "Sesión no válida. Vuelve a iniciar sesión." };
  }

  const finalReason = (reason || "").trim();
  if (finalReason.length < 3) {
    return {
      ok: false,
      error: "El motivo debe tener al menos 3 caracteres (queda en auditoría).",
    };
  }

  const res = await fetch(`${API_URL}/superadmin/impersonate/user/${numericId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ reason: finalReason }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    let message = parseApiDetail(data);
    if (res.status === 422) {
      if (!message || message === "Error en la solicitud") {
        message =
          "Solicitud rechazada (422). Indica un motivo de al menos 3 caracteres o recarga la página e inténtalo de nuevo.";
      }
    }
    if (res.status === 403) {
      if (!message || message === "Error en la solicitud") {
        message = "No tienes permiso para impersonar (sesión o rol incorrecto).";
      }
      if (message.includes("superadmin")) {
        message = "No se puede usar «Ver como» con cuentas superadmin.";
      }
      if (message.includes("denegado desde IP") || message.includes("allowlist")) {
        message +=
          " Si configuraste IP allowlist en Plataforma, añade tu IP actual o desactiva la restricción en el servidor.";
      }
    }
    return { ok: false, error: message };
  }

  sessionStorage.setItem(ORIGINAL_TOKEN_KEY, token);
  sessionStorage.setItem(ORIGINAL_USER_KEY, userData);
  sessionStorage.setItem(
    IMPERSONATOR_KEY,
    JSON.stringify({
      impersonatorName: data.impersonator?.name || "Superadmin",
      targetName: data.user?.name || "Usuario",
      startedAt: new Date().toISOString(),
    })
  );

  localStorage.setItem("userToken", data.token);
  localStorage.setItem(
    "userData",
    JSON.stringify({
      id: String(data.user.id),
      name: data.user.name,
      email: data.user.email,
      role: data.user.role,
      avatar: data.user.avatar,
      createdAt: new Date().toISOString(),
    })
  );
  window.dispatchEvent(new Event("userUpdated"));
  const fallbackRedirect =
    data.user.role === "patient" ? "/patient" : "/admin";
  const redirect =
    typeof data.redirect === "string" && data.redirect.length > 0
      ? data.redirect.replace(/\/patient\/dashboard\/?$/, "/patient")
      : fallbackRedirect;
  window.location.href = redirect;
  return { ok: true };
}

export async function endImpersonation(): Promise<void> {
  const currentToken = localStorage.getItem("userToken");
  if (currentToken) {
    try {
      await fetch(`${API_URL}/superadmin/impersonation/end`, {
        method: "POST",
        headers: { Authorization: `Bearer ${currentToken}` },
      });
    } catch {
      /* restore session anyway */
    }
  }

  const originalToken = sessionStorage.getItem(ORIGINAL_TOKEN_KEY);
  const originalUser = sessionStorage.getItem(ORIGINAL_USER_KEY);
  sessionStorage.removeItem(ORIGINAL_TOKEN_KEY);
  sessionStorage.removeItem(ORIGINAL_USER_KEY);
  sessionStorage.removeItem(IMPERSONATOR_KEY);

  if (originalToken) localStorage.setItem("userToken", originalToken);
  if (originalUser) localStorage.setItem("userData", originalUser);
  window.dispatchEvent(new Event("userUpdated"));
  window.location.href = "/superadmin/platform";
}
