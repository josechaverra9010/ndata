import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
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
 * En fullscreen se renderiza en document.body para no heredar opacity/transform de AOS.
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

  if (fullscreen) {
    const overlay = (
      <div
        className={cn(
          "fixed inset-0 z-[100] flex flex-col bg-background overflow-hidden",
          /* Aísla de AOS / transforms de ancestros */
          "opacity-100 [transform:none]",
          className
        )}
        data-aos-easing=""
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          aria-label="Animación de carga"
          onEnded={handleVideoEnded}
          className="absolute inset-0 h-full w-full object-cover opacity-100"
        >
          <source src="/loading-animation.mp4" type="video/mp4" />
        </video>
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent"
          aria-hidden
        />
        <p className="relative z-10 mt-auto pb-10 text-center text-sm font-medium tracking-wide text-foreground/90 animate-pulse px-4">
          {message}
        </p>
      </div>
    );

    if (typeof document !== "undefined") {
      return createPortal(overlay, document.body);
    }
    return overlay;
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 min-h-[280px]",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        aria-label="Animación de carga"
        onEnded={handleVideoEnded}
        className="mb-6 w-full max-w-md rounded-2xl object-contain shadow-sm"
      >
        <source src="/loading-animation.mp4" type="video/mp4" />
      </video>
      <p className="text-muted-foreground font-medium text-sm tracking-wide animate-pulse">
        {message}
      </p>
    </div>
  );
}
