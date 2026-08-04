import { ReactNode, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { PatientSidebar } from "@/components/patient/PatientSidebar";
import { PatientHeader } from "@/components/patient/PatientHeader";
import { PatientBottomNav } from "@/components/patient/PatientBottomNav";
import { LoadingScreen } from "@/components/LoadingScreen";
import { OfflineBanner } from "@/components/patient/OfflineBanner";
import { InstallPwaPrompt } from "@/components/patient/InstallPwaPrompt";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { useAuth } from "@/hooks/useAuth";
import { usePlatformAnalytics } from "@/hooks/usePlatformAnalytics";
import { NpsSurveyPrompt } from "@/components/patient/NpsSurveyPrompt";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { useOrgBranding } from "@/hooks/useOrgBranding";

interface PatientLayoutProps {
  children: ReactNode;
}

export function PatientLayout({ children }: PatientLayoutProps) {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const isFirstRouteRef = useRef(true);
  const [routeTransition, setRouteTransition] = useState(false);
  const { user } = useAuth();
  const { online, pending, syncing, sync } = useOfflineQueue(user?.id);

  usePlatformAnalytics(!!user);
  useOrgBranding();

  useEffect(() => {
    if (isFirstRouteRef.current) {
      isFirstRouteRef.current = false;
      prevPathRef.current = location.pathname;
      return;
    }
    if (location.pathname !== prevPathRef.current) {
      prevPathRef.current = location.pathname;
      setRouteTransition(true);
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      {routeTransition && (
        <LoadingScreen
          fullscreen
          message="Cargando módulo"
          onAnimationComplete={() => setRouteTransition(false)}
        />
      )}
      <PatientSidebar />
      <div className="lg:ml-64">
        <ImpersonationBanner />
        <PatientHeader />
        <main className="p-4 pb-20 lg:p-6 lg:pb-6 space-y-4">
          <OfflineBanner online={online} pending={pending} syncing={syncing} onSync={sync} />
          {children}
        </main>
      </div>
      <PatientBottomNav />
      <InstallPwaPrompt />
      <NpsSurveyPrompt />
    </div>
  );
}
