import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { API_URL } from "@/config/api";

const SESSION_KEY = "nd_session_id";
const SESSION_START_KEY = "nd_session_start";

function authHeaders() {
  const token = localStorage.getItem("userToken");
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : {};
}

function routeToModule(pathname: string): string | null {
  if (pathname.startsWith("/patient/")) {
    const seg = pathname.split("/")[2] || "dashboard";
    const map: Record<string, string> = {
      dashboard: "dashboard",
      plan: "my_plan",
      "my-plan": "my_plan",
      meals: "meal_tracking",
      tracking: "meal_tracking",
      appointments: "appointments",
      progress: "progress",
      recipes: "recipes",
      habits: "habits",
      learn: "learn",
      challenges: "challenges",
      water: "water",
      help: "support",
      notifications: "notifications",
      program: "program",
    };
    return map[seg] || seg;
  }
  if (pathname.startsWith("/superadmin")) return null;
  const adminMap: Record<string, string> = {
    "/": "dashboard",
    "/patients": "patients",
    "/plans": "plans",
    "/appointments": "appointments",
    "/clinical": "clinical",
    "/clinical-hub": "clinical",
    "/analytics": "analytics",
    "/work-queue": "work_queue",
    "/recipes": "recipes",
    "/weekly-menus": "menus",
    "/messages": "messages",
    "/interventions": "interventions",
    "/consultation": "consultation",
  };
  for (const [prefix, mod] of Object.entries(adminMap)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return mod;
  }
  return "dashboard";
}

async function postTrack(path: string, body: object) {
  try {
    await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
  } catch {
    /* silent */
  }
}

export function usePlatformAnalytics(enabled = true) {
  const location = useLocation();
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled || !localStorage.getItem("userToken")) return;

    let sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = crypto.randomUUID?.() || `s-${Date.now()}`;
      sessionStorage.setItem(SESSION_KEY, sessionId);
      sessionStorage.setItem(SESSION_START_KEY, String(Date.now()));
      postTrack("/analytics/track/session", { session_id: sessionId, action: "start" });
    }

    const moduleKey = routeToModule(location.pathname);
    if (moduleKey) {
      postTrack("/analytics/track/module", { module_key: moduleKey, route: location.pathname });
    }

    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(() => {
      const sid = sessionStorage.getItem(SESSION_KEY);
      const start = Number(sessionStorage.getItem(SESSION_START_KEY) || Date.now());
      const duration = Math.floor((Date.now() - start) / 1000);
      if (sid) {
        postTrack("/analytics/track/session", {
          session_id: sid,
          action: "heartbeat",
          duration_seconds: duration,
        });
      }
    }, 60000);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [location.pathname, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const endSession = () => {
      const sid = sessionStorage.getItem(SESSION_KEY);
      const start = Number(sessionStorage.getItem(SESSION_START_KEY) || Date.now());
      const duration = Math.floor((Date.now() - start) / 1000);
      const token = localStorage.getItem("userToken");
      if (sid && token) {
        fetch(`${API_URL}/analytics/track/session`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sid, action: "end", duration_seconds: duration }),
          keepalive: true,
        }).catch(() => {});
      }
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_START_KEY);
    };
    window.addEventListener("beforeunload", endSession);
    return () => window.removeEventListener("beforeunload", endSession);
  }, [enabled]);
}
