import { useCallback, useState, useRef, useEffect } from "react";

export interface ClickSparkProps {
  sparkColor?: string;
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  duration?: number;
  children: React.ReactNode;
}

interface Spark {
  id: number;
  x: number;
  y: number;
  endX: number;
  endY: number;
  active: boolean;
}

export default function ClickSpark({
  sparkColor = "#fff",
  sparkSize = 5,
  sparkRadius = 200,
  sparkCount = 8,
  duration = 400,
  children,
}: ClickSparkProps) {
  const [sparks, setSparks] = useState<Spark[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const nextIdRef = useRef(0);

  const createSparks = useCallback(
    (clientX: number, clientY: number) => {
      const newSparks: Spark[] = [];
      for (let i = 0; i < sparkCount; i++) {
        const angle = (Math.PI * 2 * i) / sparkCount + Math.random() * 0.5;
        const distance = sparkRadius * (0.6 + Math.random() * 0.4);
        newSparks.push({
          id: nextIdRef.current++,
          x: clientX,
          y: clientY,
          endX: clientX + Math.cos(angle) * distance,
          endY: clientY + Math.sin(angle) * distance,
          active: false,
        });
      }
      setSparks((prev) => [...prev, ...newSparks]);
    },
    [sparkCount, sparkRadius]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      createSparks(e.clientX, e.clientY);
    },
    [createSparks]
  );

  useEffect(() => {
    const inactive = sparks.filter((s) => !s.active);
    if (inactive.length === 0) return;
    const idsToActivate = new Set(inactive.map((s) => s.id));
    const frame = requestAnimationFrame(() => {
      setSparks((prev) =>
        prev.map((s) => (idsToActivate.has(s.id) ? { ...s, active: true } : s))
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [sparks.length]);

  useEffect(() => {
    if (sparks.length === 0) return;
    const toRemove = sparks.map((s) => s.id);
    const t = setTimeout(() => {
      setSparks((prev) => prev.filter((s) => !toRemove.includes(s.id)));
    }, duration);
    return () => clearTimeout(t);
  }, [sparks, duration]);

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className="relative min-h-full"
      style={{ cursor: "inherit" }}
    >
      {children}
      <div
        className="pointer-events-none fixed inset-0 z-[9999]"
        aria-hidden
      >
        {sparks.map((spark) => (
          <div
            key={spark.id}
            className="absolute rounded-full"
            style={{
              left: spark.x,
              top: spark.y,
              width: sparkSize,
              height: sparkSize,
              marginLeft: -sparkSize / 2,
              marginTop: -sparkSize / 2,
              backgroundColor: sparkColor,
              boxShadow: `0 0 ${sparkSize * 2}px ${sparkColor}`,
              transform: spark.active
                ? `translate(${spark.endX - spark.x}px, ${spark.endY - spark.y}px)`
                : "translate(0, 0)",
              opacity: spark.active ? 0 : 1,
              transition: `transform ${duration}ms ease-out, opacity ${duration}ms ease-out`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
