export interface WeightTimelinePoint {
  id?: number;
  date: string;
  weight: number;
}

export interface SpecialtyTracking {
  mna_sf?: { answers: Record<string, number>; score?: number; date?: string };
  prenatal_checklist?: Record<string, boolean>;
  alta_hospital_checklist?: Record<string, boolean>;
  hydration_sessions?: {
    id: string;
    date: string;
    phase: 'pre' | 'during' | 'post';
    ml: number;
    notes?: string;
  }[];
  hospital_daily?: { date: string; kcal_target: number; kcal_actual?: number; notes?: string }[];
  deportista_phase?: 'pre' | 'during' | 'post';
}

export interface SpecialtyPayload {
  has_specialty: boolean;
  plan_tipo: string | null;
  plan_tipo_label?: string;
  plan_name?: string;
  fase_1: Record<string, any>;
  patient: {
    id: number;
    fecha_nacimiento?: string | null;
    genero?: string | null;
    altura?: number | null;
    peso_actual?: number | null;
    peso_objetivo?: number | null;
    datos_clinicos?: Record<string, any>;
  };
  weight_timeline: WeightTimelinePoint[];
  tracking: SpecialtyTracking;
}
