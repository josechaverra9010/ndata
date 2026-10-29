import { API_URL } from "@/config/api";

/** API server origin without the `/api` suffix (e.g. http://localhost:8001). */
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

function mediaOrigin(): string {
  if (API_ORIGIN) return API_ORIGIN;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

/**
 * Resolve upload/media URLs to the API server.
 * Handles relative `/uploads/...` paths and legacy absolute URLs on the wrong port.
 */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("blob:")) return url;

  const origin = mediaOrigin();

  if (url.startsWith("/")) {
    return origin ? `${origin}${url}` : url;
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const parsed = new URL(url);
      if (parsed.pathname.startsWith("/uploads/")) {
        return origin ? `${origin}${parsed.pathname}${parsed.search}` : `${parsed.pathname}${parsed.search}`;
      }
      // URLs guardadas como localhost u otro host pero mismo path /uploads
      if (origin && /\/uploads\//i.test(parsed.pathname)) {
        return `${origin}${parsed.pathname}${parsed.search}`;
      }
    } catch {
      return url;
    }
    return url;
  }

  return origin ? `${origin}/${url}` : `/${url}`;
}

/** Helper único para imágenes de recetas/menús (usa misma lógica que avatares). */
export function resolveUploadImageUrl(imagePath: string | null | undefined, fallback?: string): string {
  if (!imagePath?.trim()) {
    return fallback ?? "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400";
  }
  if (imagePath.startsWith("http") && !imagePath.includes("/uploads/")) {
    return imagePath;
  }
  return resolveMediaUrl(imagePath) || fallback || "";
}
