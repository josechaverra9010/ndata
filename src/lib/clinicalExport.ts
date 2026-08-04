/**
 * Exportación RIPS simplificada y resumen HC compatible
 * Referencia: Resolución 2275 de 2023 (estructura básica US + AC)
 */

export interface RipsExportOptions {
  prestador_nit?: string;
  prestador_nombre?: string;
  codigo_eps?: string;
  nombre_eps?: string;
}

export interface RipsPatientInput {
  id: number;
  tipo_documento?: string | null;
  numero_documento?: string | null;
  nombres: string;
  apellidos: string;
  fecha_nacimiento?: string | null;
  genero?: string | null;
  programa_eps?: string | null;
  direccion?: string | null;
  telefono?: string | null;
}

export interface RipsConsultationInput {
  id: number;
  patient_id: number;
  date: string;
  type?: string;
  status?: string;
  notes?: string | null;
}

const DOC_TYPE_RIPS: Record<string, string> = {
  cc: 'CC',
  cedula: 'CC',
  ti: 'TI',
  ce: 'CE',
  pasaporte: 'PA',
  rc: 'RC',
};

/** CUPS consulta nutrición / dietética */
export const CUPS_NUTRICION = '890201';

export function buildRipsPayload(
  patients: RipsPatientInput[],
  consultations: RipsConsultationInput[],
  opts: RipsExportOptions = {}
) {
  const stamp = new Date().toISOString();
  return {
    metadata: {
      formato: 'RIPS-NutriData-v1',
      resolucion_referencia: '2275 de 2023 (estructura simplificada)',
      fecha_generacion: stamp,
      prestador: {
        nit: opts.prestador_nit || '',
        nombre: opts.prestador_nombre || 'NutriData',
      },
      eps: {
        codigo: opts.codigo_eps || '',
        nombre: opts.nombre_eps || opts.codigo_eps || '',
      },
    },
    usuarios: patients.map((p) => ({
      tipoIdentificacion: DOC_TYPE_RIPS[(p.tipo_documento || 'cc').toLowerCase()] || 'CC',
      numIdentificacion: p.numero_documento || String(p.id),
      codEntidadAdministradora: opts.codigo_eps || p.programa_eps || '',
      tipoUsuario: '01',
      primerApellido: p.apellidos.split(' ')[0] || p.apellidos,
      segundoApellido: p.apellidos.split(' ').slice(1).join(' ') || '',
      primerNombre: p.nombres.split(' ')[0] || p.nombres,
      segundoNombre: p.nombres.split(' ').slice(1).join(' ') || '',
      fechaNacimiento: p.fecha_nacimiento || '',
      codSexo: (p.genero || '').toLowerCase().startsWith('m') || (p.genero || '').toLowerCase() === 'hombre' ? 'M' : 'F',
      codPaisResidencia: '170',
      codMunicipioResidencia: '',
      zonaTerritorialResidencia: 'U',
      incapacidad: 'NO',
    })),
    consultas: consultations.map((c) => {
      const pat = patients.find((p) => p.id === c.patient_id);
      return {
        codPrestador: opts.prestador_nit || '',
        fechaInicioAtencion: `${c.date} 08:00`,
        numAutorizacion: '',
        codConsulta: CUPS_NUTRICION,
        modalidadGrupoServicio: '01',
        grupoServicios: '01',
        codServicio: '356',
        finalidadTecnologiaSalud: '12',
        causaMotivoAtencion: '38',
        codDiagnosticoPrincipal: 'Z718',
        codDiagnosticoRelacionado1: '',
        tipoDiagnosticoPrincipal: '2',
        numDocumentoIdentificacion: pat?.numero_documento || String(c.patient_id),
        tipoDocumentoIdentificacion: DOC_TYPE_RIPS[(pat?.tipo_documento || 'cc').toLowerCase()] || 'CC',
        vrServicio: 0,
        conceptoRecaudo: '05',
        valorPagoModerador: 0,
        numFEVPagoModerador: '',
        observaciones: c.notes || `Consulta nutrición — ${c.type || 'presencial'}`,
      };
    }),
  };
}

export function buildClinicalHistoryExport(patient: Record<string, unknown>, appointments: RipsConsultationInput[]) {
  return {
    formato: 'HC-NutriData-v1',
    compatible_con: 'Historias clínicas / interoperabilidad básica',
    fecha_exportacion: new Date().toISOString(),
    paciente: {
      identificacion: patient.numero_documento,
      tipo_documento: patient.tipo_documento,
      nombres: patient.nombres,
      apellidos: patient.apellidos,
      fecha_nacimiento: patient.fecha_nacimiento,
      genero: patient.genero,
      eps_programa: patient.programa_eps,
      telefono: patient.telefono,
      direccion: patient.direccion,
    },
    antropometria: {
      peso_actual: patient.peso_actual,
      peso_objetivo: patient.peso_objetivo,
      altura: patient.altura,
    },
    examenes_bioquimicos: patient.examenes_bioquimicos,
    datos_clinicos: patient.datos_clinicos,
    condiciones_medicas: patient.condiciones_medicas,
    citas_nutricion: appointments,
  };
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(content: string, filename: string) {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** RIPS usuarios + consultas como CSV plano (2 hojas simuladas en un zip-like concat) */
export function ripsToCsvFlat(rips: ReturnType<typeof buildRipsPayload>): string {
  const usHeaders = Object.keys(rips.usuarios[0] || {}).join(',');
  const usRows = rips.usuarios.map((u) => Object.values(u).map((v) => `"${v}"`).join(','));
  const acHeaders = Object.keys(rips.consultas[0] || {}).join(',');
  const acRows = rips.consultas.map((c) => Object.values(c).map((v) => `"${v}"`).join(','));
  return [
    '# US - Usuarios',
    usHeaders,
    ...usRows,
    '',
    '# AC - Consultas',
    acHeaders,
    ...acRows,
  ].join('\n');
}
