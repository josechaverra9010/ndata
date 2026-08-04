/**
 * Reglas clínicas → sugerencia de suplemento MIPRESS
 * Basado en alteraciones bioquímicas y contexto del paciente
 */

import { MIPRESS_SUPLEMENTOS, type MipressSuplemento } from './mipressSuplementos';
import type { BioquimicosData } from '@/components/shared/BioquimicosForm';
import { flagAbnormalValues } from './bioquimicosHistory';

export interface MipressSuggestion {
  suplemento: MipressSuplemento;
  reason: string;
  priority: 'alta' | 'media' | 'baja';
  categoriaMipress: string;
}

function num(v?: string): number | null {
  if (!v?.trim()) return null;
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function pick(id: string): MipressSuplemento | undefined {
  return MIPRESS_SUPLEMENTOS.find((s) => s.id === id);
}

/** Motor de sugerencias clínicas MIPRESS */
export function suggestMipressSupplements(
  bio: BioquimicosData,
  context?: {
    plan_tipo?: string | null;
    condiciones?: string | null;
    programa_eps?: string | null;
  }
): MipressSuggestion[] {
  const suggestions: MipressSuggestion[] = [];
  const seen = new Set<string>();

  const add = (id: string, reason: string, priority: MipressSuggestion['priority'] = 'media') => {
    if (seen.has(id)) return;
    const s = pick(id);
    if (!s) return;
    seen.add(id);
    suggestions.push({ suplemento: s, reason, priority, categoriaMipress: s.categoria });
  };

  const albumina = num(bio.bio_albumina);
  const creatinina = num(bio.bio_creatinina);
  const glicemia = num(bio.bio_glicemia);
  const hb = num(bio.bio_hb);
  const cond = (context?.condiciones || '').toLowerCase();

  if (albumina != null && albumina < 3.5) {
    add('ensure_clinical', 'Hipoalbuminemia (< 3.5 g/dL) — soporte proteico MIPRESS', 'alta');
    add('peptamen_intense', 'Alternativa peptídica en desnutrición proteica', 'media');
  }

  if (albumina != null && albumina < 3.0) {
    add('impact_peptide', 'Albumina < 3.0 — fórmula inmunomoduladora alta en proteína', 'alta');
  }

  if (creatinina != null && creatinina > 1.5) {
    if (cond.includes('dial') || cond.includes('renal')) {
      add('nepro_ap', 'Insuficiencia renal / diálisis — fórmula renal MIPRESS', 'alta');
      add('fresubin_renal', 'Alternativa prediálisis / renal', 'media');
    } else {
      add('renament', 'Creatinina elevada — fórmula renal prediálisis', 'media');
    }
  }

  if (glicemia != null && glicemia >= 126) {
    add('glucerna_1_5', 'Glicemia en rango diabético — fórmula específica diabetes', 'alta');
    add('diben_drink', 'Alternativa diabetes baja en carbohidratos', 'baja');
  } else if (glicemia != null && glicemia >= 100) {
    add('glucerna_1_0', 'Glicemia alterada — control glucémico', 'media');
  }

  if (hb != null && hb < 12) {
    add('ensure_advance_liq', 'Anemia (Hb baja) — soporte nutricional calórico-proteico', 'media');
  }

  if (cond.includes('hepát') || cond.includes('hepat') || cond.includes('cirrosis')) {
    add('fresubin_hepa_drink', 'Patología hepática — fórmula hepática MIPRESS', 'alta');
  }

  if (cond.includes('epoc') || cond.includes('pulmon') || cond.includes('respirat')) {
    add('pulmocare', 'Enfermedad pulmonar — fórmula pulmonar', 'alta');
  }

  if (context?.plan_tipo === 'geriatrico' || cond.includes('adulto mayor') || cond.includes('geriátr')) {
    add('nutren_senior', 'Paciente geriátrico — fórmula senior alta en proteína', 'media');
    add('ensure_advance_liq', 'Soporte proteico en adulto mayor', 'baja');
  }

  if (context?.plan_tipo === 'hospitalizado') {
    add('nutrison_protein_intense', 'Paciente hospitalizado — alta densidad proteica', 'media');
  }

  if (context?.plan_tipo === 'deportista') {
    add('prowhey', 'Deportista — módulo proteico MIPRESS', 'baja');
  }

  const flags = flagAbnormalValues(bio);
  if (flags.length >= 3 && !seen.size) {
    add('ensure_clinical', `Múltiples alteraciones bioquímicas (${flags.length})`, 'media');
  }

  const order = { alta: 0, media: 1, baja: 2 };
  return suggestions.sort((a, b) => order[a.priority] - order[b.priority]);
}

/** Prescripción estructurada para vincular al plan */
export interface MipressPrescription {
  mipress_id: string;
  mipress_nombre: string;
  mipress_categoria: string;
  mipress_porcion: string;
  porciones_dia: number;
  indicacion: string;
  prescribed_at: string;
  prescribed_by?: number;
}

export function prescriptionFromSuggestion(
  s: MipressSuggestion,
  porcionesDia = 1
): MipressPrescription {
  return {
    mipress_id: s.suplemento.id,
    mipress_nombre: s.suplemento.nombre,
    mipress_categoria: s.suplemento.categoria,
    mipress_porcion: s.suplemento.porcion,
    porciones_dia: porcionesDia,
    indicacion: s.reason,
    prescribed_at: new Date().toISOString().slice(0, 10),
  };
}
