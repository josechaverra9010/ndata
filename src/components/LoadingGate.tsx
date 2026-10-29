import { ReactNode, useEffect } from "react";
import AOS from "aos";
import { LoadingScreen } from "@/components/LoadingScreen";
import { LOADING_MIN_DURATION_MS, useLoadingGate } from "@/hooks/useLoadingGate";

interface LoadingGateProps {
  loading: boolean;
  message?: string;
  children: ReactNode;
  className?: string;
  minDurationMs?: number;
}

/**
 * No muestra el contenido hasta que los datos cargaron
 * y la animación de carga se reprodujo por completo.
 */
export function LoadingGate({
  loading,
  message = "Cargando",
  children,
  className,
  minDurationMs = LOADING_MIN_DURATION_MS,
}: LoadingGateProps) {
  const { showLoading, markAnimationComplete } = useLoadingGate(loading, minDurationMs);

  useEffect(() => {
    if (showLoading) return;
    const t = window.setTimeout(() => {
      try {
        AOS.refresh();
      } catch {
        /* AOS puede no estar listo aún */
      }
    }, 60);
    return () => window.clearTimeout(t);
  }, [showLoading]);

  if (showLoading) {
    return (
      <LoadingScreen
        fullscreen
        message={message}
        /* No pasar min-h del contenido: rompe el overlay fullscreen */
        onAnimationComplete={markAnimationComplete}
        minDurationMs={minDurationMs}
      />
    );
  }

  if (className) {
    return <div className={className}>{children}</div>;
  }
  return <>{children}</>;
}
