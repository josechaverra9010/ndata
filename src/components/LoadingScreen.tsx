import { useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { LOADING_MIN_DURATION_MS } from "@/hooks/useLoadingGate";

interface LoadingScreenProps {
  message?: string;
  className?: string;
  /** Pantalla completa (transiciones entre módulos). */
  fullscreen?: boolean;
  /** Se invoca cuando el video terminó y cumplió el tiempo mínimo. */
  onAnimationComplete?: () => void;
  minDurationMs?: number;
}

/**
 * Pantalla de carga con animación en video (una reproducción completa por montaje).
 */
export function LoadingScreen({
  message = "Cargando",
  className,
  fullscreen = false,
  onAnimationComplete,
  minDurationMs = LOADING_MIN_DURATION_MS,
}: LoadingScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const startedAtRef = useRef(Date.now());
  const videoDoneRef = useRef(false);
  const notifiedRef = useRef(false);

  const notifyComplete = useCallback(() => {
    if (notifiedRef.current || !onAnimationComplete) return;
    if (!videoDoneRef.current) return;

    const elapsed = Date.now() - startedAtRef.current;
    const remaining = Math.max(0, minDurationMs - elapsed);

    notifiedRef.current = true;
    window.setTimeout(onAnimationComplete, remaining);
  }, [minDurationMs, onAnimationComplete]);

  useEffect(() => {
    startedAtRef.current = Date.now();
    videoDoneRef.current = false;
    notifiedRef.current = false;

    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      void video.play().catch(() => {
        videoDoneRef.current = true;
      });
    }

    const fallback = window.setTimeout(() => {
      videoDoneRef.current = true;
      notifyComplete();
    }, minDurationMs + 1200);

    return () => window.clearTimeout(fallback);
  }, [minDurationMs, notifyComplete]);

  useEffect(() => {
    if (!videoDoneRef.current) return;
    notifyComplete();
  }, [notifyComplete]);

  const handleVideoEnded = () => {
    videoDoneRef.current = true;
    notifyComplete();
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4",
        fullscreen ? "fixed inset-0 z-[100] bg-background" : "min-h-[280px]",
        className
      )}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        aria-label="Animación de carga"
        onEnded={handleVideoEnded}
        className="mb-6 w-48 max-w-[70vw] rounded-2xl object-contain shadow-sm"
      >
        <source src="/loading-animation.mp4" type="video/mp4" />
      </video>
      <p className="text-muted-foreground font-medium text-sm tracking-wide animate-pulse">
        {message}
      </p>
    </div>
  );
}
