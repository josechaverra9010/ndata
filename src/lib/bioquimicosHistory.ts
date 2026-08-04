/**
 * Historial de exámenes bioquímicos — estructura extendida sobre examenes_bioquimicos JSON
 */

import {
  BIO_ALL_ROWS,
  BIO_VALUE_KEYS,
  emptyBioquimicos,
  normalizeBioquimicos,
  type BioquimicosData,
  type BioValueKey,
} from '@/components/shared/BioquimicosForm';

export interface BioquimicosHistoryEntry {
  id: string;
  fecha: string;
  source: 'manual' | 'csv' | 'import';
  values: BioquimicosData;
  imported_at?: string;
  notes?: string;
}

export interface BioquimicosStorage {
  current: BioquimicosData;
  history: BioquimicosHistoryEntry[];
}

/** Aliases CSV → campo interno (minúsculas, sin acentos) */
const CSV_ALIASES: Record<string, BioValueKey | 'fecha'> = {
  fecha: 'fecha',
  date: 'fecha',
  bio_fecha_examenes: 'fecha',
  hb: 'bio_hb',
  hemoglobina: 'bio_hb',
  hto: 'bio_hto',
  hematocrito: 'bio_hto',
  vcm: 'bio_vcm',
  hcm: 'bio_hcm',
  ferritina: 'bio_ferritina',
  glicemia: 'bio_glicemia',
  glucosa: 'bio_glicemia',
  bun: 'bio_bun',
  creatinina: 'bio_creatinina',
  creat: 'bio_creatinina',
  nitrogeno_ureico: 'bio_nitrogeno_ureico',
  ureico: 'bio_nitrogeno_ureico',
  albumina: 'bio_albumina',
  proteinas_totales: 'bio_proteinas_totales',
  proteinas: 'bio_proteinas_totales',
  leucocitos: 'bio_leucocitos',
  linfocitos: 'bio_linfocitos',
  hdl: 'bio_hdl',
  vldl: 'bio_vldl',
  ldl: 'bio_ldl',
  tg: 'bio_tg',
  trigliceridos: 'bio_tg',
  ct: 'bio_ct',
  colesterol_total: 'bio_ct',
};

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_');
}

export function parseBioquimicosStorage(
  raw?: Partial<BioquimicosData> | BioquimicosStorage | Record<string, unknown> | null
): BioquimicosStorage {
  if (!raw || typeof raw !== 'object') {
    return { current: emptyBioquimicos(), history: [] };
  }
  if ('history' in raw && Array.isArray((raw as BioquimicosStorage).history)) {
    const stored = raw as BioquimicosStorage;
    return {
      current: normalizeBioquimicos(stored.current),
      history: (stored.history || []).map((h) => ({
        ...h,
        values: normalizeBioquimicos(h.values),
      })),
    };
  }
  const current = normalizeBioquimicos(raw as Partial<BioquimicosData>);
  const hasData = BIO_VALUE_KEYS.some((k) => current[k]?.trim()) || current.bio_fecha_examenes;
  if (!hasData) return { current: emptyBioquimicos(), history: [] };
  return { current, history: [] };
}

export function storageToLegacyPayload(storage: BioquimicosStorage): BioquimicosStorage {
  return storage;
}

/** Parsea CSV con header; soporta múltiples filas (historial) */
export function parseBioquimicosCsv(csvText: string): BioquimicosHistoryEntry[] {
  const lines = csvText
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (lines.length < 2) return [];

  const delim = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  const headers = lines[0].split(delim).map(normalizeHeader);
  const entries: BioquimicosHistoryEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delim);
    const values = emptyBioquimicos();
    let fecha = '';

    headers.forEach((h, idx) => {
      const val = (cols[idx] || '').trim();
      if (!val) return;
      const mapped = CSV_ALIASES[h];
      if (mapped === 'fecha') fecha = val;
      else if (mapped) values[mapped] = val;
    });

    if (!fecha) fecha = new Date().toISOString().slice(0, 10);

    const hasAny = BIO_VALUE_KEYS.some((k) => values[k]?.trim());
    if (!hasAny) continue;

    values.bio_fecha_examenes = fecha;
    entries.push({
      id: `csv-${Date.now()}-${i}`,
      fecha,
      source: 'csv',
      values,
      imported_at: new Date().toISOString(),
    });
  }
  return entries;
}

export function addHistoryEntry(
  storage: BioquimicosStorage,
  entry: Omit<BioquimicosHistoryEntry, 'id'> & { id?: string }
): BioquimicosStorage {
  const newEntry: BioquimicosHistoryEntry = {
    ...entry,
    id: entry.id || `bio-${Date.now()}`,
    values: normalizeBioquimicos(entry.values),
  };
  const history = [...storage.history, newEntry].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );
  return {
    current: newEntry.values,
    history,
  };
}

export function getBioTrend(
  storage: BioquimicosStorage,
  key: BioValueKey
): { fecha: string; value: number }[] {
  const points: { fecha: string; value: number }[] = [];
  for (const h of [...storage.history].reverse()) {
    const v = parseFloat(h.values[key] || '');
    if (Number.isFinite(v)) points.push({ fecha: h.fecha, value: v });
  }
  const cur = parseFloat(storage.current[key] || '');
  if (Number.isFinite(cur) && storage.current.bio_fecha_examenes) {
    points.push({ fecha: storage.current.bio_fecha_examenes, value: cur });
  }
  return points;
}

export function flagAbnormalValues(values: BioquimicosData): { key: BioValueKey; label: string; value: string; flag: string }[] {
  const flags: { key: BioValueKey; label: string; value: string; flag: string }[] = [];
  const rules: Partial<Record<BioValueKey, { low?: number; high?: number; label: string }>> = {
    bio_hb: { low: 12, high: 16, label: 'Hb' },
    bio_albumina: { low: 3.5, high: 5, label: 'Albúmina' },
    bio_glicemia: { low: 70, high: 100, label: 'Glicemia' },
    bio_creatinina: { low: 0.6, high: 1.2, label: 'Creatinina' },
    bio_ldl: { high: 100, label: 'LDL' },
    bio_tg: { high: 150, label: 'TG' },
    bio_hdl: { low: 40, label: 'HDL' },
  };

  for (const [key, rule] of Object.entries(rules) as [BioValueKey, typeof rules[BioValueKey]][]) {
    const raw = values[key];
    if (!raw?.trim()) continue;
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) continue;
    if (rule?.low != null && n < rule.low) flags.push({ key, label: rule.label, value: raw, flag: 'Bajo' });
    if (rule?.high != null && n > rule.high) flags.push({ key, label: rule.label, value: raw, flag: 'Alto' });
  }
  return flags;
}

export const BIO_CSV_TEMPLATE = [
  'fecha,hb,hto,glicemia,creatinina,albumina,ldl,hdl,tg,ct',
  '2025-01-15,13.2,39,92,0.9,3.8,110,45,120,180',
  '2025-04-20,12.8,38,98,1.0,3.5,115,42,135,190',
].join('\n');
