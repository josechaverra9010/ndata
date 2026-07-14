import { useState, useEffect, useRef, useCallback } from "react";
import { getNutriDataTextPoints, type TextPoint } from "@/lib/nutridataTextPoints";

const PARTICLE_SIZE = 2.2;
const DURATION_MS = 3200;
const STAGGER_MS = 1600;
/** Tras formarse la palabra, cuánto esperar antes de activar el efecto magnético (ms) */
const INTERACTIVE_DELAY_MS = 400;
/** Radio en % dentro del cual el cursor atrae los puntos */
const MAGNET_RADIUS_PCT = 18;
/** Radio del anillo alrededor del cursor en % */
const RING_RADIUS_PCT = 10;
/** Suavizado del movimiento (0–1) */
const LERP_SPEED = 0.08;
/** Variación del anillo (onda) */
const WAVE_SPEED = 0.003;
const WAVE_AMPLITUDE = 1.2;

function randomPoint(): TextPoint {
  return {
    x: Math.random() * 100,
    y: Math.random() * 100,
  };
}

function dist(a: TextPoint, b: TextPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function NutriDataParticles({ className = "" }: { className?: string }) {
  const [positions, setPositions] = useState<TextPoint[]>([]);
  const [ready, setReady] = useState(false);
  const [useStagger, setUseStagger] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const targetsRef = useRef<TextPoint[]>([]);
  const countRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef<TextPoint | null>(null);
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    if (countRef.current > 0) return;
    countRef.current = 1;

    const targets = getNutriDataTextPoints();
    if (targets.length === 0) {
      setPositions(Array(120).fill(0).map(randomPoint));
      setReady(true);
      return;
    }

    targetsRef.current = targets;
    setPositions(targets.map(() => randomPoint()));
    setReady(true);
    setUseStagger(true);

    const t = setTimeout(() => {
      setPositions([...targetsRef.current]);
      const t2 = setTimeout(() => setInteractive(true), INTERACTIVE_DELAY_MS);
      return () => clearTimeout(t2);
    }, 400);

    return () => clearTimeout(t);
  }, []);

  const mouseToPercent = useCallback((clientX: number, clientY: number): TextPoint | null => {
    const el = containerRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * 100,
      y: ((clientY - r.top) / r.height) * 100,
    };
  }, []);

  useEffect(() => {
    if (!interactive || positions.length === 0) return;

    const onMove = (e: MouseEvent) => {
      const p = mouseToPercent(e.clientX, e.clientY);
      mouseRef.current = p;
    };
    window.addEventListener("mousemove", onMove);

    const targets = targetsRef.current;
    const tick = (now: number) => {
      timeRef.current = now;
      rafRef.current = requestAnimationFrame(tick);
      const mouse = mouseRef.current;
      setPositions((prev) => {
        if (prev.length !== targets.length) return prev;
        const next = prev.map((p, i) => {
          const rest = targets[i];
          if (!mouse) {
            return {
              x: rest.x + (p.x - rest.x) * (1 - LERP_SPEED),
              y: rest.y + (p.y - rest.y) * (1 - LERP_SPEED),
            };
          }
          const d = dist(p, mouse);
          if (d < MAGNET_RADIUS_PCT) {
            const angle = Math.atan2(p.y - mouse.y, p.x - mouse.x);
            const wave = Math.sin(now * WAVE_SPEED + i * 0.2) * WAVE_AMPLITUDE;
            const r = RING_RADIUS_PCT + wave;
            const targetX = mouse.x + r * Math.cos(angle);
            const targetY = mouse.y + r * Math.sin(angle);
            return {
              x: p.x + (targetX - p.x) * LERP_SPEED,
              y: p.y + (targetY - p.y) * LERP_SPEED,
            };
          }
          return {
            x: p.x + (rest.x - p.x) * LERP_SPEED,
            y: p.y + (rest.y - p.y) * LERP_SPEED,
          };
        });
        return next;
      });
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [interactive, mouseToPercent, positions.length]);

  if (!ready || positions.length === 0) {
    return (
      <div className={`absolute inset-0 pointer-events-none ${className}`} aria-hidden />
    );
  }

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden ${className}`}
      style={{ pointerEvents: "none" }}
      aria-hidden
    >
      {positions.map((p, i) => {
        const delay = useStagger ? (i / positions.length) * STAGGER_MS : 0;
        const isInteractive = interactive;
        return (
          <span
            key={i}
            className="absolute rounded-full bg-primary/55"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: PARTICLE_SIZE,
              height: PARTICLE_SIZE,
              transform: "translate(-50%, -50%)",
              transition: isInteractive
                ? "none"
                : `left ${DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms,
                           top ${DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
            }}
          />
        );
      })}
    </div>
  );
}
