import { FOOD_INGREDIENTS_LIST } from "@/lib/foodNutrients";

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Empareja nombres libres de IA con el catálogo NutriData. */
export function matchIngredientToCatalog(rawName: string): string | null {
  const q = normalize(rawName);
  if (!q) return null;

  // Exacto
  for (const name of FOOD_INGREDIENTS_LIST) {
    if (normalize(name) === q) return name;
  }

  // Contiene (catálogo contiene query o viceversa)
  let best: { name: string; score: number } | null = null;
  const qTokens = q.split(" ").filter((t) => t.length > 2);

  for (const name of FOOD_INGREDIENTS_LIST) {
    const n = normalize(name);
    if (n.includes(q) || q.includes(n)) {
      const score = Math.min(n.length, q.length) / Math.max(n.length, q.length);
      if (!best || score > best.score) best = { name, score };
      continue;
    }
    if (qTokens.length) {
      const hits = qTokens.filter((t) => n.includes(t)).length;
      if (hits >= Math.min(2, qTokens.length)) {
        const score = hits / qTokens.length;
        if (!best || score > best.score) best = { name, score };
      }
    }
  }

  return best && best.score >= 0.45 ? best.name : null;
}

export type AiIngredientIn = {
  name: string;
  grams?: number | null;
  note?: string;
};

export function matchAiIngredients(ingredients: AiIngredientIn[]): {
  matched: string[];
  unmatched: AiIngredientIn[];
} {
  const matched: string[] = [];
  const unmatched: AiIngredientIn[] = [];
  const seen = new Set<string>();

  for (const ing of ingredients || []) {
    const hit = matchIngredientToCatalog(ing.name);
    if (hit) {
      if (!seen.has(hit)) {
        seen.add(hit);
        matched.push(hit);
      }
    } else {
      unmatched.push(ing);
    }
  }
  return { matched, unmatched };
}
