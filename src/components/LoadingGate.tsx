import { ReactNode } from "react";
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

  if (showLoading) {
    return (
      <LoadingScreen
        message={message}
        className={className}
        onAnimationComplete={markAnimationComplete}
        minDurationMs={minDurationMs}
      />
    );
  }

  return <>{children}</>;
}
