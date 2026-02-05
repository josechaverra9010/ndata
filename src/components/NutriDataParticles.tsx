import { useState, useEffect, useRef } from "react";

const CANVAS_W = 500;
const CANVAS_H = 140;
const SAMPLE_STEP = 3;
const PARTICLE_SIZE = 2.2;
const DURATION_MS = 3200;
const STAGGER_MS = 1600;

type Point = { x: number; y: number };

function getTextPoints(): Point[] {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];

  ctx.fillStyle = "#000";
  ctx.font = "bold 90px Outfit, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("NutriData", CANVAS_W / 2, CANVAS_H / 2);

  const data = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
  const points: Point[] = [];

  for (let y = 0; y < CANVAS_H; y += SAMPLE_STEP) {
    for (let x = 0; x < CANVAS_W; x += SAMPLE_STEP) {
      const i = (y * CANVAS_W + x) * 4;
      if (data.data[i + 3] > 80) {
        points.push({
          x: (x / CANVAS_W) * 100,
          y: (y / CANVAS_H) * 100,
        });
      }
    }
  }

  return points;
}

function randomPoint(): Point {
  return {
    x: Math.random() * 100,
    y: Math.random() * 100,
  };
}

export function NutriDataParticles({ className = "" }: { className?: string }) {
  const [positions, setPositions] = useState<Point[]>([]);
  const [ready, setReady] = useState(false);
  const [useStagger, setUseStagger] = useState(false);
  const targetsRef = useRef<Point[]>([]);
  const countRef = useRef(0);

  useEffect(() => {
    if (countRef.current > 0) return;
    countRef.current = 1;

    const targets = getTextPoints();
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
    }, 400);

    return () => clearTimeout(t);
  }, []);

  if (!ready || positions.length === 0) {
    return (
      <div className={`absolute inset-0 pointer-events-none ${className}`} aria-hidden />
    );
  }

  return (
    <div
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      aria-hidden
    >
      {positions.map((p, i) => {
        const delay = useStagger ? (i / positions.length) * STAGGER_MS : 0;
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
              transition: `left ${DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms,
                           top ${DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
            }}
          />
        );
      })}
    </div>
  );
}
