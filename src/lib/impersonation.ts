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

export async function startImpersonation(nutritionistId: number, reason?: string): Promise<boolean> {
  return startUserImpersonation(nutritionistId, reason);
}

export async function startUserImpersonation(userId: number, reason?: string): Promise<boolean> {
  const token = localStorage.getItem("userToken");
  const userData = localStorage.getItem("userData");
  if (!token || !userData) return false;

  const finalReason = (reason || "").trim();
  if (finalReason.length < 5) return false;

  const res = await fetch(`${API_URL}/superadmin/impersonate/user/${userId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ reason: finalReason }),
  });
  if (!res.ok) return false;

  const data = await res.json();
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
  window.location.href = data.redirect || (data.user.role === "patient" ? "/patient/dashboard" : "/admin");
  return true;
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
