import { useCallback, useEffect, useRef, useState } from "react";

/** Duración mínima visible de la animación de carga (ms). */
export const LOADING_MIN_DURATION_MS = 2600;

/**
 * Mantiene la pantalla de carga visible hasta que:
 * 1) los datos terminaron de cargar (`isLoading === false`)
 * 2) la animación de video se reprodujo completa al menos una vez
 * 3) pasó el tiempo mínimo configurado
 */
export function useLoadingGate(isLoading: boolean, minDurationMs = LOADING_MIN_DURATION_MS) {
  const [showLoading, setShowLoading] = useState(isLoading);
  const startedAtRef = useRef<number | null>(isLoading ? Date.now() : null);
  const dataReadyRef = useRef(!isLoading);
  const animationDoneRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const tryClose = useCallback(() => {
    if (!dataReadyRef.current || !animationDoneRef.current) return;

    const startedAt = startedAtRef.current ?? Date.now();
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, minDurationMs - elapsed);

    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setShowLoading(false);
      closeTimerRef.current = null;
    }, remaining);
  }, [clearCloseTimer, minDurationMs]);

  const markAnimationComplete = useCallback(() => {
    animationDoneRef.current = true;
    tryClose();
  }, [tryClose]);

  useEffect(() => {
    if (isLoading) {
      clearCloseTimer();
      startedAtRef.current = Date.now();
      dataReadyRef.current = false;
      animationDoneRef.current = false;
      setShowLoading(true);
      return;
    }

    dataReadyRef.current = true;
    tryClose();
  }, [isLoading, clearCloseTimer, tryClose]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  return { showLoading, markAnimationComplete };
}
