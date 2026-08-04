import { useEffect, useState } from "react";
import { API_URL } from "@/config/api";

export interface OrgBranding {
  organization_id: number;
  name: string;
  logo_url?: string | null;
  primary_color?: string;
  eps_program?: string;
}

export function applyOrgBrandingCss(branding: OrgBranding | null) {
  const root = document.documentElement;
  if (!branding?.primary_color) {
    root.style.removeProperty("--org-brand");
    root.style.removeProperty("--org-brand-foreground");
    return;
  }
  root.style.setProperty("--org-brand", branding.primary_color);
  root.style.setProperty("--org-brand-foreground", "#ffffff");
}

export function useOrgBranding() {
  const [branding, setBranding] = useState<OrgBranding | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    if (!token) return;
    fetch(`${API_URL}/org/branding`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.branding) {
          setBranding(data.branding);
          applyOrgBrandingCss(data.branding);
        }
      })
      .catch(() => {});
    return () => applyOrgBrandingCss(null);
  }, []);

  return { branding };
}
