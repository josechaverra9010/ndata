import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Variables numéricas de laboratorio (sin notas ni análisis). */
export const BIO_VALUE_KEYS = [
  "bio_hb",
  "bio_hto",
  "bio_vcm",
  "bio_hcm",
  "bio_ferritina",
  "bio_glicemia",
  "bio_bun",
  "bio_creatinina",
  "bio_nitrogeno_ureico",
  "bio_albumina",
  "bio_proteinas_totales",
  "bio_leucocitos",
  "bio_linfocitos",
  "bio_hdl",
  "bio_vldl",
  "bio_ldl",
  "bio_tg",
  "bio_ct",
] as const;

export type BioValueKey = (typeof BIO_VALUE_KEYS)[number];
export type BioAnalisisKey = `${BioValueKey}_analisis`;

export type BioquimicosData = {
  [K in BioValueKey]: string;
} & {
  [K in BioAnalisisKey]: string;
} & {
  bioquimicos: string;
  /** Análisis general (legacy / opcional) */
  bio_analisis: string;
  /** Fecha en que se realizaron los exámenes */
  bio_fecha_examenes: string;
};

export type BioRow = {
  key: BioValueKey;
  analisisKey: BioAnalisisKey;
  label: string;
};

function analisisKeyFor(key: BioValueKey): BioAnalisisKey {
  return `${key}_analisis` as BioAnalisisKey;
}

export const emptyBioquimicos = (): BioquimicosData => {
  const base = {
    bioquimicos: "",
    bio_analisis: "",
    bio_fecha_examenes: "",
  } as BioquimicosData;
  for (const key of BIO_VALUE_KEYS) {
    base[key] = "";
    base[analisisKeyFor(key)] = "";
  }
  return base;
};

export const BIO_HEMOGRAMA: BioRow[] = [
  { key: "bio_hb", analisisKey: "bio_hb_analisis", label: "Hb (g/dL)" },
  { key: "bio_hto", analisisKey: "bio_hto_analisis", label: "Hto (%)" },
  { key: "bio_vcm", analisisKey: "bio_vcm_analisis", label: "VCM (FL)" },
  { key: "bio_hcm", analisisKey: "bio_hcm_analisis", label: "HCM (pcg)" },
  { key: "bio_ferritina", analisisKey: "bio_ferritina_analisis", label: "Ferritina" },
];

export const BIO_OTROS: BioRow[] = [
  { key: "bio_glicemia", analisisKey: "bio_glicemia_analisis", label: "Glicemia (mg/dl)" },
  { key: "bio_bun", analisisKey: "bio_bun_analisis", label: "BUN" },
  { key: "bio_creatinina", analisisKey: "bio_creatinina_analisis", label: "Creatinina" },
  { key: "bio_nitrogeno_ureico", analisisKey: "bio_nitrogeno_ureico_analisis", label: "Nitrógeno ureico" },
  { key: "bio_albumina", analisisKey: "bio_albumina_analisis", label: "Albúmina" },
  { key: "bio_proteinas_totales", analisisKey: "bio_proteinas_totales_analisis", label: "Proteínas totales" },
  { key: "bio_leucocitos", analisisKey: "bio_leucocitos_analisis", label: "Leucocitos" },
  { key: "bio_linfocitos", analisisKey: "bio_linfocitos_analisis", label: "Linfocitos" },
];

export const BIO_LIPIDOS: BioRow[] = [
  { key: "bio_hdl", analisisKey: "bio_hdl_analisis", label: "HDL (mg/dL)" },
  { key: "bio_vldl", analisisKey: "bio_vldl_analisis", label: "VLDL (mg/dL)" },
  { key: "bio_ldl", analisisKey: "bio_ldl_analisis", label: "LDL (mg/dL)" },
  { key: "bio_tg", analisisKey: "bio_tg_analisis", label: "TG (mg/dL)" },
  { key: "bio_ct", analisisKey: "bio_ct_analisis", label: "CT (mg/dL)" },
];

export const BIO_ALL_ROWS: BioRow[] = [...BIO_HEMOGRAMA, ...BIO_OTROS, ...BIO_LIPIDOS];

export function normalizeBioquimicos(raw?: Partial<BioquimicosData> | Record<string, any> | null): BioquimicosData {
  const base = emptyBioquimicos();
  if (!raw || typeof raw !== "object") return base;
  (Object.keys(base) as (keyof BioquimicosData)[]).forEach((key) => {
    const val = (raw as any)[key];
    base[key] = val == null ? "" : String(val);
  });
  return base;
}

function BioTable({
  title,
  rows,
  value,
  onChange,
  disabled,
}: {
  title: string;
  rows: BioRow[];
  value: BioquimicosData;
  onChange: (key: keyof BioquimicosData, next: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="bg-muted/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground">
        {title}
      </div>
      <div className="divide-y">
        {rows.map(({ key, analisisKey, label }) => (
          <div key={key} className="px-3 py-2 space-y-1.5">
            <div className="grid grid-cols-[1fr_100px] sm:grid-cols-[1fr_120px] items-center gap-2">
              <span className="text-sm text-foreground font-medium">{label}</span>
              <Input
                value={value[key] || ""}
                onChange={(e) => onChange(key, e.target.value)}
                className="h-8 text-sm"
                inputMode="decimal"
                placeholder="Valor"
                disabled={disabled}
              />
            </div>
            <Input
              value={value[analisisKey] || ""}
              onChange={(e) => onChange(analisisKey, e.target.value)}
              className="h-8 text-xs"
              placeholder={`Análisis de ${label}…`}
              disabled={disabled}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface BioquimicosFormProps {
  value: BioquimicosData;
  onChange: (next: BioquimicosData) => void;
  disabled?: boolean;
  showNotes?: boolean;
}

export function BioquimicosForm({
  value,
  onChange,
  disabled,
  showNotes = true,
}: BioquimicosFormProps) {
  const setField = (key: keyof BioquimicosData, next: string) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-xs text-muted-foreground flex-1">
          Ingresa el valor de cada variable y su análisis / interpretación debajo.
        </p>
        <div className="space-y-1.5 w-full sm:w-56 shrink-0">
          <Label className="text-xs text-muted-foreground">Fecha de los exámenes</Label>
          <Input
            type="date"
            value={value.bio_fecha_examenes || ""}
            onChange={(e) => setField("bio_fecha_examenes", e.target.value)}
            disabled={disabled}
            className="h-9"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <BioTable
          title="Hemograma y otros"
          rows={BIO_HEMOGRAMA}
          value={value}
          onChange={setField}
          disabled={disabled}
        />
        <BioTable title="Otros" rows={BIO_OTROS} value={value} onChange={setField} disabled={disabled} />
        <BioTable
          title="Perfil lipídico"
          rows={BIO_LIPIDOS}
          value={value}
          onChange={setField}
          disabled={disabled}
        />
      </div>
      {showNotes && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Observaciones / otros resultados</Label>
          <Textarea
            rows={2}
            value={value.bioquimicos}
            onChange={(e) => setField("bioquimicos", e.target.value)}
            disabled={disabled}
            placeholder="Notas adicionales (opcional)"
          />
        </div>
      )}
    </div>
  );
}
