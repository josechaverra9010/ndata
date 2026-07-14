/**
 * Puntos 2D que forman la palabra "NutriData" (muestreo desde canvas).
 * Coordenadas en porcentaje 0-100 del área del texto.
 * Compartido por NutriDataParticles y Antigravity.
 */
const CANVAS_W = 500;
const CANVAS_H = 140;
const SAMPLE_STEP = 3;

export type TextPoint = { x: number; y: number };

let cachedPoints: TextPoint[] | null = null;

export function getNutriDataTextPoints(): TextPoint[] {
  if (cachedPoints) return cachedPoints;

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
  const points: TextPoint[] = [];

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

  cachedPoints = points;
  return points;
}
