import { API_URL } from "@/config/api";

/** API server origin without the `/api` suffix (e.g. http://localhost:8001). */
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

/**
 * Resolve upload/media URLs to the API server.
 * Handles relative `/uploads/...` paths and legacy absolute URLs on the wrong port.
 */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("blob:")) return url;

  if (url.startsWith("/")) {
    return `${API_ORIGIN}${url}`;
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const parsed = new URL(url);
      if (parsed.pathname.startsWith("/uploads/")) {
        return `${API_ORIGIN}${parsed.pathname}${parsed.search}`;
      }
    } catch {
      return url;
    }
    return url;
  }

  return `${API_ORIGIN}/${url}`;
}
