/**
 * Catálogo de suplementación nutricional MIPRESS.
 * Valores por porción según ficha; rangos se toman en punto medio.
 * Fuente: Suplementación Nutricional - Mipress.
 */

export type MipressSuplemento = {
  id: string;
  nombre: string;
  codigo: string;
  categoria: string;
  porcion: string;
  kcal: number;
  prot: number;
  chos: number;
  grasa: number;
  fd: number;
  gs: number;
  gm: number;
  gp: number;
};

export const MIPRESS_SUPLEMENTOS: MipressSuplemento[] = [
  { id: "abound", nombre: "Abound", codigo: "1201", categoria: "1201 – Aminoácidos libres", porcion: "24 g (1 sobre)", kcal: 89, prot: 14.8, chos: 6.5, grasa: 0.02, fd: 0, gs: 0.02, gm: 0, gp: 0 },
  { id: "argitein", nombre: "ArgiTein", codigo: "1201", categoria: "1201 – Aminoácidos libres", porcion: "15 g (1 sobre)", kcal: 35, prot: 9.5, chos: 0, grasa: 0, fd: 0, gs: 0, gm: 0, gp: 0 },
  { id: "l_arginina_nm", nombre: "L-Arginina NM", codigo: "1201", categoria: "1201 – Aminoácidos libres", porcion: "7 g (neutro) / 7,84 g (naranja)", kcal: 29.5, prot: 7, chos: 0.42, grasa: 0, fd: 0, gs: 0, gm: 0, gp: 0 },
  { id: "l_citrulina_nm", nombre: "L-Citrulina NM", codigo: "1201", categoria: "1201 – Aminoácidos libres", porcion: "3 g (1 sobre)", kcal: 12, prot: 3, chos: 0, grasa: 0, fd: 0, gs: 0, gm: 0, gp: 0 },
  { id: "l_ornitina_nm", nombre: "L-Ornitina NM", codigo: "1201", categoria: "1201 – Aminoácidos libres", porcion: "3 g (1 sobre)", kcal: 12, prot: 3, chos: 0, grasa: 0, fd: 0, gs: 0, gm: 0, gp: 0 },
  { id: "pku_express_25", nombre: "PKU Express 25 g", codigo: "1201", categoria: "1201 – Aminoácidos libres", porcion: "25 g", kcal: 79, prot: 15, chos: 3.5, grasa: 0.55, fd: 0, gs: 0.18, gm: 0, gp: 0 },
  { id: "pku_express_34", nombre: "PKU Express 34 g", codigo: "1201", categoria: "1201 – Aminoácidos libres", porcion: "34 g", kcal: 107, prot: 20, chos: 4.8, grasa: 0.75, fd: 0, gs: 0.24, gm: 0, gp: 0 },
  { id: "peptamen_previo_1_0", nombre: "Peptamen previo 1.0", codigo: "1301", categoria: "1301 – Proteína hidrolizada basada en péptidos", porcion: "250 ml", kcal: 250, prot: 10, chos: 32, grasa: 10, fd: 1, gs: 7, gm: 2, gp: 1 },
  { id: "prosource_no_carb", nombre: "Prosource NO CARB", codigo: "1301", categoria: "1301 – Proteína hidrolizada basada en péptidos", porcion: "30 ml (1 fl. oz.)", kcal: 60, prot: 15, chos: 0, grasa: 0, fd: 0, gs: 0, gm: 0, gp: 0 },
  { id: "survimed_opd_hn", nombre: "Survimed OPD HN", codigo: "1301", categoria: "1301 – Proteína hidrolizada basada en péptidos", porcion: "100 ml", kcal: 133, prot: 6.7, chos: 14.3, grasa: 2.8, fd: 0.1, gs: 1.5, gm: 0.7, gp: 0.6 },
  { id: "vital_1_5", nombre: "Vital 1.5", codigo: "1301", categoria: "1301 – Proteína hidrolizada basada en péptidos", porcion: "250 ml", kcal: 375, prot: 16, chos: 47, grasa: 15, fd: 3, gs: 1.5, gm: 9, gp: 4.5 },
  { id: "nutrison_advanced_peptisorb", nombre: "Nutrison Advanced Peptisorb", codigo: "1302", categoria: "1302 – Proteína parcialmente hidrolizada", porcion: "100 ml", kcal: 100, prot: 4, chos: 17.5, grasa: 1.7, fd: 0, gs: 1, gm: 0.2, gp: 0.5 },
  { id: "diben_1_5_hp", nombre: "Diben 1.5 Kcal HP", codigo: "1401", categoria: "1401 – Diabetes, baja en carbohidratos", porcion: "100 ml", kcal: 150, prot: 7.5, chos: 13, grasa: 7, fd: 2.3, gs: 1.8, gm: 3.7, gp: 1.5 },
  { id: "diben_drink", nombre: "Diben Drink", codigo: "1401", categoria: "1401 – Diabetes, baja en carbohidratos", porcion: "200 ml", kcal: 300, prot: 20, chos: 24, grasa: 12, fd: 4.6, gs: 3.6, gm: 6.2, gp: 2.2 },
  { id: "enterex_db_cal", nombre: "Enterex DB – CAL", codigo: "1401", categoria: "1401 – Diabetes, baja en carbohidratos", porcion: "237 ml", kcal: 240, prot: 12, chos: 27, grasa: 9, fd: 4, gs: 0.5, gm: 6.3, gp: 1.6 },
  { id: "glucerna_1_0", nombre: "Glucerna 1.0", codigo: "1401", categoria: "1401 – Diabetes, baja en carbohidratos", porcion: "237 ml", kcal: 200, prot: 10, chos: 26, grasa: 7, fd: 3, gs: 1, gm: 4, gp: 2 },
  { id: "glucerna_1_5", nombre: "Glucerna 1.5 KCAL/ML", codigo: "1401", categoria: "1401 – Diabetes, baja en carbohidratos", porcion: "100 ml", kcal: 150, prot: 7.9, chos: 13.05, grasa: 7.5, fd: 1.55, gs: 2, gm: 4, gp: 1.5 },
  { id: "glucerna_1_6", nombre: "Glucerna 1.6 KCAL", codigo: "1401", categoria: "1401 – Diabetes, baja en carbohidratos", porcion: "100 ml", kcal: 160, prot: 8, chos: 14, grasa: 7.2, fd: 1.6, gs: 2, gm: 3.8, gp: 1.4 },
  { id: "glytrol", nombre: "Glytrol", codigo: "1401", categoria: "1401 – Diabetes, baja en carbohidratos", porcion: "250 ml", kcal: 250, prot: 11, chos: 25, grasa: 10, fd: 4, gs: 3, gm: 5, gp: 2 },
  { id: "procrill_dm", nombre: "Procrill DM", codigo: "1401", categoria: "1401 – Diabetes, baja en carbohidratos", porcion: "56 g polvo (200 ml preparado)", kcal: 230, prot: 15, chos: 19.6, grasa: 10, fd: 1, gs: 1.42, gm: 6, gp: 2.24 },
  { id: "monogen", nombre: "Monogen", codigo: "1405", categoria: "1405 – Estrés metabólico", porcion: "200 ml", kcal: 300, prot: 12, chos: 36, grasa: 12, fd: 0, gs: 10, gm: 1, gp: 1 },
  { id: "new_whey_figi", nombre: "New Whey Figi", codigo: "1405", categoria: "1405 – Estrés metabólico", porcion: "225 ml preparado", kcal: 404, prot: 15, chos: 45, grasa: 18, fd: 4, gs: 3, gm: 9, gp: 6 },
  { id: "perative", nombre: "Perative", codigo: "1405", categoria: "1405 – Estrés metabólico", porcion: "237 ml", kcal: 355, prot: 15, chos: 47, grasa: 13, fd: 3, gs: 2, gm: 7, gp: 4 },
  { id: "pirot", nombre: "Pirot", codigo: "1405", categoria: "1405 – Estrés metabólico", porcion: "200 ml", kcal: 300, prot: 12, chos: 36, grasa: 12, fd: 0, gs: 10, gm: 1, gp: 1 },
  { id: "prowhey_critical_care", nombre: "Prowhey critical care", codigo: "1405", categoria: "1405 – Estrés metabólico", porcion: "84 g polvo (180 ml preparado)", kcal: 360, prot: 19, chos: 39, grasa: 14, fd: 1.3, gs: 2.1, gm: 9.4, gp: 2.4 },
  { id: "enterex_hepatic", nombre: "Enterex hepatic", codigo: "1406", categoria: "1406 – Hepática", porcion: "237 ml", kcal: 250, prot: 13, chos: 27, grasa: 8, fd: 3, gs: 1, gm: 5, gp: 2 },
  { id: "fresubin_hepa_drink", nombre: "Fresubin Hepa Drink", codigo: "1406", categoria: "1406 – Hepática", porcion: "200 ml", kcal: 400, prot: 20, chos: 36, grasa: 16, fd: 3, gs: 3, gm: 9, gp: 4 },
  { id: "hepament", nombre: "Hepament", codigo: "1406", categoria: "1406 – Hepática", porcion: "237 ml", kcal: 250, prot: 13, chos: 27, grasa: 8, fd: 3, gs: 1, gm: 5, gp: 2 },
  { id: "hepatic_nm", nombre: "Hepatic NM", codigo: "1406", categoria: "1406 – Hepática", porcion: "237 ml", kcal: 250, prot: 13, chos: 27, grasa: 8, fd: 3, gs: 1, gm: 5, gp: 2 },
  { id: "impact_peptide", nombre: "Impact peptide", codigo: "1407", categoria: "1407 – Inmunomoduladoras", porcion: "237 ml", kcal: 355, prot: 18, chos: 45, grasa: 13, fd: 3, gs: 2, gm: 7, gp: 4 },
  { id: "inmunex_plus", nombre: "Inmunex Plus", codigo: "1407", categoria: "1407 – Inmunomoduladoras", porcion: "237 ml", kcal: 250, prot: 12, chos: 28, grasa: 8, fd: 3, gs: 1.5, gm: 4, gp: 2.5 },
  { id: "reconvan", nombre: "Reconvan", codigo: "1407", categoria: "1407 – Inmunomoduladoras", porcion: "237 ml", kcal: 250, prot: 13, chos: 27, grasa: 8, fd: 3, gs: 1, gm: 5, gp: 2 },
  { id: "nutren_pulmonary", nombre: "Nutren Pulmonary", codigo: "1408", categoria: "1408 – Pulmonar", porcion: "250 ml", kcal: 250, prot: 13, chos: 28, grasa: 8, fd: 3, gs: 1.5, gm: 4, gp: 2.5 },
  { id: "prowhey_epoc", nombre: "Prowhey EPOC", codigo: "1408", categoria: "1408 – Pulmonar", porcion: "84 g polvo (180 ml preparado)", kcal: 360, prot: 18, chos: 39, grasa: 14, fd: 1.3, gs: 2.1, gm: 9.4, gp: 2.4 },
  { id: "prowhey_neumo", nombre: "Prowhey Neumo", codigo: "1408", categoria: "1408 – Pulmonar", porcion: "84 g polvo (180 ml preparado)", kcal: 360, prot: 18, chos: 39, grasa: 14, fd: 1.3, gs: 2.1, gm: 9.4, gp: 2.4 },
  { id: "pulmocare", nombre: "Pulmocare", codigo: "1408", categoria: "1408 – Pulmonar", porcion: "237 ml", kcal: 355, prot: 13, chos: 19, grasa: 27, fd: 0, gs: 3, gm: 17, gp: 7 },
  { id: "enbrace_drink_renal", nombre: "Enbrace Drink Renal", codigo: "1409", categoria: "1409 – Renal diálisis", porcion: "200 ml", kcal: 400, prot: 20, chos: 36, grasa: 16, fd: 3, gs: 3, gm: 9, gp: 4 },
  { id: "ensoy_dyal_1_5", nombre: "Ensoy Dyal + 1.5", codigo: "1409", categoria: "1409 – Renal diálisis", porcion: "200 ml", kcal: 300, prot: 15, chos: 36, grasa: 10, fd: 2, gs: 2, gm: 6, gp: 2 },
  { id: "nepro_ap", nombre: "Nepro AP", codigo: "1409", categoria: "1409 – Renal diálisis", porcion: "237 ml", kcal: 425, prot: 19, chos: 45, grasa: 21, fd: 3, gs: 4, gm: 12, gp: 5 },
  { id: "prowhey_trr", nombre: "Prowhey TRR", codigo: "1409", categoria: "1409 – Renal diálisis", porcion: "84 g polvo (180 ml preparado)", kcal: 360, prot: 19, chos: 39, grasa: 14, fd: 1.3, gs: 2.1, gm: 9.4, gp: 2.4 },
  { id: "renoral", nombre: "Renoral", codigo: "1409", categoria: "1409 – Renal diálisis", porcion: "150 ml", kcal: 54, prot: 12.8, chos: 0.3, grasa: 0.15, fd: 0.4, gs: 0, gm: 0, gp: 0 },
  { id: "fresubin_renal", nombre: "Fresubin Renal", codigo: "1410", categoria: "1410 – Renal prediálisis", porcion: "200 ml", kcal: 400, prot: 20, chos: 36, grasa: 16, fd: 3, gs: 3, gm: 9, gp: 4 },
  { id: "nepro_bp", nombre: "Nepro BP", codigo: "1410", categoria: "1410 – Renal prediálisis", porcion: "237 ml", kcal: 420, prot: 19, chos: 45, grasa: 21, fd: 3, gs: 4, gm: 12, gp: 5 },
  { id: "prowhey_renal_cronico", nombre: "Prowhey Renal Crónico", codigo: "1410", categoria: "1410 – Renal prediálisis", porcion: "84 g polvo (180 ml preparado)", kcal: 360, prot: 19, chos: 39, grasa: 14, fd: 1.3, gs: 2.1, gm: 9.4, gp: 2.4 },
  { id: "renament", nombre: "Renament", codigo: "1410", categoria: "1410 – Renal prediálisis", porcion: "237 ml", kcal: 250, prot: 10, chos: 28, grasa: 8, fd: 3, gs: 1.5, gm: 5, gp: 2 },
  { id: "ketocal_2_5_1", nombre: "Ketocal 2.5:1", codigo: "1411", categoria: "1411 – Enfermedades del sistema nervioso", porcion: "237 ml", kcal: 475, prot: 12, chos: 8, grasa: 45, fd: 0, gs: 0, gm: 0, gp: 0 },
  { id: "ketocompleto", nombre: "Ketocompleto", codigo: "1411", categoria: "1411 – Enfermedades del sistema nervioso", porcion: "200 ml", kcal: 400, prot: 10, chos: 8, grasa: 38, fd: 0, gs: 0, gm: 0, gp: 0 },
  { id: "ketolance", nombre: "Ketolance", codigo: "1411", categoria: "1411 – Enfermedades del sistema nervioso", porcion: "200 ml", kcal: 300, prot: 7, chos: 4, grasa: 28, fd: 2, gs: 0, gm: 0, gp: 0 },
  { id: "ketovie_3_1", nombre: "Ketovie 3:1", codigo: "1411", categoria: "1411 – Enfermedades del sistema nervioso", porcion: "237 ml", kcal: 450, prot: 10, chos: 8, grasa: 42, fd: 2, gs: 0, gm: 0, gp: 0 },
  { id: "ketovie_4_1", nombre: "Ketovie 4:1", codigo: "1411", categoria: "1411 – Enfermedades del sistema nervioso", porcion: "237 ml", kcal: 470, prot: 9, chos: 6, grasa: 44, fd: 2, gs: 0, gm: 0, gp: 0 },
  { id: "ketovolve_mkd", nombre: "Ketovolve MKD", codigo: "1411", categoria: "1411 – Enfermedades del sistema nervioso", porcion: "237 ml", kcal: 450, prot: 10, chos: 7, grasa: 42, fd: 2, gs: 0, gm: 0, gp: 0 },
  { id: "alemforte_ap", nombre: "Alemforte AP", codigo: "1501", categoria: "1501 – Alta en proteína", porcion: "200 ml", kcal: 300, prot: 15, chos: 36, grasa: 10, fd: 2, gs: 2, gm: 6, gp: 2 },
  { id: "bns_life", nombre: "BNS Life", codigo: "1501", categoria: "1501 – Alta en proteína", porcion: "porción", kcal: 400, prot: 15, chos: 37.5, grasa: 16.5, fd: 4, gs: 0, gm: 0, gp: 0 },
  { id: "cik_3", nombre: "CIK-3", codigo: "1501", categoria: "1501 – Alta en proteína", porcion: "200 ml", kcal: 300, prot: 12, chos: 35, grasa: 10, fd: 2, gs: 2, gm: 6, gp: 2 },
  { id: "ensure_advance_liq", nombre: "Ensure Advance", codigo: "1501", categoria: "1501 – Alta en proteína", porcion: "230 ml", kcal: 350, prot: 20, chos: 45, grasa: 11, fd: 3, gs: 2, gm: 6, gp: 3 },
  { id: "ensure_clinical_1_5_lpc", nombre: "Ensure clinical 1.5 LPC", codigo: "1501", categoria: "1501 – Alta en proteína", porcion: "200 ml", kcal: 300, prot: 13, chos: 36, grasa: 10, fd: 3, gs: 2, gm: 6, gp: 2 },
  { id: "ensure_clinical", nombre: "Ensure clinical", codigo: "1501", categoria: "1501 – Alta en proteína", porcion: "200 ml", kcal: 300, prot: 13, chos: 36, grasa: 10, fd: 3, gs: 2, gm: 6, gp: 2 },
  { id: "enteres_protical", nombre: "Enteres protical", codigo: "1501", categoria: "1501 – Alta en proteína", porcion: "200 ml", kcal: 300, prot: 15, chos: 35, grasa: 9, fd: 2, gs: 2, gm: 5, gp: 2 },
  { id: "fortisip_advanced", nombre: "Fortisip Advanced", codigo: "1501", categoria: "1501 – Alta en proteína", porcion: "200 ml", kcal: 400, prot: 20, chos: 45, grasa: 15, fd: 5, gs: 3, gm: 9, gp: 3 },
  { id: "fortisip_compact_protein", nombre: "Fortisip compact protein", codigo: "1501", categoria: "1501 – Alta en proteína", porcion: "125 ml", kcal: 300, prot: 18, chos: 24, grasa: 11, fd: 0, gs: 2, gm: 6, gp: 3 },
  { id: "impact", nombre: "Impact", codigo: "1501", categoria: "1501 – Alta en proteína", porcion: "237 ml", kcal: 355, prot: 18, chos: 45, grasa: 13, fd: 3, gs: 2, gm: 7, gp: 4 },
  { id: "newear_hipro", nombre: "Newear Hipro", codigo: "1501", categoria: "1501 – Alta en proteína", porcion: "200 ml", kcal: 300, prot: 20, chos: 30, grasa: 8, fd: 2, gs: 1.5, gm: 5, gp: 1.5 },
  { id: "novasource_gc_1_5", nombre: "Novasource GC 1.5", codigo: "1501", categoria: "1501 – Alta en proteína", porcion: "200 ml", kcal: 300, prot: 16, chos: 36, grasa: 10, fd: 3, gs: 2, gm: 6, gp: 2 },
  { id: "novasource_proline", nombre: "Novasource Proline", codigo: "1501", categoria: "1501 – Alta en proteína", porcion: "200 ml", kcal: 300, prot: 20, chos: 30, grasa: 8, fd: 2, gs: 1.5, gm: 5, gp: 1.5 },
  { id: "nutren_senior", nombre: "Nutren senior", codigo: "1501", categoria: "1501 – Alta en proteína", porcion: "200 ml", kcal: 250, prot: 13, chos: 28, grasa: 7, fd: 3, gs: 1.5, gm: 4, gp: 1.5 },
  { id: "nutrise_polymeric", nombre: "Nutrise Polymeric", codigo: "1501", categoria: "1501 – Alta en proteína", porcion: "200 ml", kcal: 300, prot: 12, chos: 36, grasa: 9, fd: 3, gs: 2, gm: 5, gp: 2 },
  { id: "nutrison_advanced_diason_energy_hp", nombre: "Nutrison Advanced Diason Energy HP", codigo: "1501", categoria: "1501 – Alta en proteína", porcion: "200 ml", kcal: 300, prot: 15, chos: 34, grasa: 11, fd: 3, gs: 2, gm: 7, gp: 2 },
  { id: "nutrison_protein_intense", nombre: "Nutrison Protein Intense", codigo: "1501", categoria: "1501 – Alta en proteína", porcion: "200 ml", kcal: 400, prot: 20, chos: 45, grasa: 15, fd: 0, gs: 3, gm: 9, gp: 3 },
  { id: "peptamen_intense", nombre: "Peptamen Intense", codigo: "1501", categoria: "1501 – Alta en proteína", porcion: "200 ml", kcal: 400, prot: 20, chos: 45, grasa: 15, fd: 0, gs: 3, gm: 8, gp: 4 },
  { id: "prosure", nombre: "Prosure", codigo: "1501", categoria: "1501 – Alta en proteína", porcion: "240 ml", kcal: 350, prot: 16, chos: 45, grasa: 11, fd: 3, gs: 2, gm: 6, gp: 3 },
  { id: "prowhey_net", nombre: "Prowhey NET", codigo: "1501", categoria: "1501 – Alta en proteína", porcion: "porción", kcal: 247, prot: 12.6, chos: 27, grasa: 9.7, fd: 3.2, gs: 1.1, gm: 5.8, gp: 2.7 },
  { id: "prowhey_oncare", nombre: "Prowhey ONCARE", codigo: "1501", categoria: "1501 – Alta en proteína", porcion: "porción", kcal: 230, prot: 19, chos: 19, grasa: 8.7, fd: 0.5, gs: 1.2, gm: 5, gp: 2.2 },
  { id: "wipro_sm", nombre: "Wipro-SM", codigo: "1501", categoria: "1501 – Alta en proteína", porcion: "200 ml", kcal: 300, prot: 15, chos: 35, grasa: 9, fd: 2, gs: 2, gm: 5, gp: 2 },
  { id: "enbrace_standard_fibre", nombre: "Enbrace Standard fibre", codigo: "1502", categoria: "1502 – Con fibra", porcion: "200 ml", kcal: 300, prot: 12, chos: 36, grasa: 9, fd: 3, gs: 2, gm: 5, gp: 2 },
  { id: "jevity", nombre: "Jevity", codigo: "1502", categoria: "1502 – Con fibra", porcion: "237 ml", kcal: 250, prot: 10, chos: 36, grasa: 7, fd: 3, gs: 1.5, gm: 4, gp: 1.5 },
  { id: "enbrace_drink_2_0", nombre: "Enbrace Drink 2.0 kcal fibre", codigo: "1503", categoria: "1503 – Densidad calórica (1 a 2 kcal/ml)", porcion: "200 ml", kcal: 400, prot: 18, chos: 44, grasa: 16, fd: 4, gs: 3, gm: 9, gp: 4 },
  { id: "enbrace_energy_hp", nombre: "Enbrace energy HP", codigo: "1503", categoria: "1503 – Densidad calórica (1 a 2 kcal/ml)", porcion: "200 ml", kcal: 300, prot: 15, chos: 34, grasa: 10, fd: 3, gs: 2, gm: 6, gp: 2 },
  { id: "enbrace_s", nombre: "Enbrace S", codigo: "1503", categoria: "1503 – Densidad calórica (1 a 2 kcal/ml)", porcion: "200 ml", kcal: 300, prot: 12, chos: 36, grasa: 9, fd: 2, gs: 2, gm: 5, gp: 2 },
  { id: "enbrace_standard", nombre: "Enbrace Standard", codigo: "1503", categoria: "1503 – Densidad calórica (1 a 2 kcal/ml)", porcion: "200 ml", kcal: 300, prot: 12, chos: 36, grasa: 9, fd: 0, gs: 2, gm: 5, gp: 2 },
  { id: "ensoy_recover", nombre: "Ensoy Recover +", codigo: "1503", categoria: "1503 – Densidad calórica (1 a 2 kcal/ml)", porcion: "200 ml", kcal: 300, prot: 15, chos: 36, grasa: 9, fd: 2, gs: 2, gm: 5, gp: 2 },
  { id: "ensure_compact", nombre: "Ensure compact", codigo: "1503", categoria: "1503 – Densidad calórica (1 a 2 kcal/ml)", porcion: "125 ml", kcal: 300, prot: 13, chos: 36, grasa: 9, fd: 0, gs: 2, gm: 5, gp: 2 },
  { id: "ensure_plus_hn", nombre: "Ensure plus HN", codigo: "1503", categoria: "1503 – Densidad calórica (1 a 2 kcal/ml)", porcion: "237 ml", kcal: 350, prot: 13, chos: 50, grasa: 11, fd: 0, gs: 2, gm: 6, gp: 3 },
  { id: "ensure_twocal", nombre: "Ensure Twocal", codigo: "1503", categoria: "1503 – Densidad calórica (1 a 2 kcal/ml)", porcion: "237 ml", kcal: 475, prot: 19, chos: 50, grasa: 19, fd: 0, gs: 4, gm: 10, gp: 5 },
  { id: "fresubin_2_kcal_drink", nombre: "Fresubin 2 kcal Drink", codigo: "1503", categoria: "1503 – Densidad calórica (1 a 2 kcal/ml)", porcion: "200 ml", kcal: 400, prot: 20, chos: 36, grasa: 16, fd: 0, gs: 3, gm: 9, gp: 4 },
  { id: "fresubin_2_kcal_hp", nombre: "Fresubin 2 Kcal HP", codigo: "1503", categoria: "1503 – Densidad calórica (1 a 2 kcal/ml)", porcion: "200 ml", kcal: 400, prot: 20, chos: 36, grasa: 16, fd: 0, gs: 3, gm: 9, gp: 4 },
  { id: "fresubin_hp_energy", nombre: "Fresubin HP energy", codigo: "1503", categoria: "1503 – Densidad calórica (1 a 2 kcal/ml)", porcion: "200 ml", kcal: 300, prot: 20, chos: 26, grasa: 11, fd: 0, gs: 2, gm: 6, gp: 3 },
  { id: "keto_volve", nombre: "Keto Volve", codigo: "1503", categoria: "1503 – Densidad calórica (1 a 2 kcal/ml)", porcion: "porción", kcal: 450, prot: 10, chos: 7, grasa: 42, fd: 2, gs: 0, gm: 0, gp: 0 },
  { id: "ketocal_4_1", nombre: "Ketocal 4:1", codigo: "1503", categoria: "1503 – Densidad calórica (1 a 2 kcal/ml)", porcion: "237 ml", kcal: 470, prot: 9, chos: 6, grasa: 44, fd: 2, gs: 0, gm: 0, gp: 0 },
  { id: "nutren_1_5", nombre: "Nutren 1.5", codigo: "1503", categoria: "1503 – Densidad calórica (1 a 2 kcal/ml)", porcion: "200 ml", kcal: 300, prot: 12, chos: 36, grasa: 10, fd: 0, gs: 2, gm: 6, gp: 2 },
  { id: "prowhey_kalori", nombre: "Prowhey kalori", codigo: "1503", categoria: "1503 – Densidad calórica (1 a 2 kcal/ml)", porcion: "porción", kcal: 360, prot: 18, chos: 39, grasa: 14, fd: 1.3, gs: 3, gm: 7, gp: 4 },
  { id: "prowhey_oncare_plus", nombre: "Prowhey Oncare Plus", codigo: "1503", categoria: "1503 – Densidad calórica (1 a 2 kcal/ml)", porcion: "porción", kcal: 360, prot: 20, chos: 39, grasa: 14, fd: 1.3, gs: 3, gm: 7, gp: 4 },
  { id: "scadishake_mix", nombre: "Scadishake Mix", codigo: "1503", categoria: "1503 – Densidad calórica (1 a 2 kcal/ml)", porcion: "porción", kcal: 508.5, prot: 4.45, chos: 62, grasa: 25.5, fd: 0, gs: 9, gm: 7, gp: 8.5 },
  { id: "supportan_drink", nombre: "Supportan Drink", codigo: "1503", categoria: "1503 – Densidad calórica (1 a 2 kcal/ml)", porcion: "200 ml", kcal: 300, prot: 20, chos: 11, grasa: 18, fd: 3, gs: 3, gm: 9, gp: 6 },
  { id: "ensure_advance_polvo", nombre: "Ensure advance (polvo)", codigo: "1504", categoria: "1504 – Estándar", porcion: "230 ml", kcal: 350, prot: 20, chos: 45, grasa: 11, fd: 3, gs: 2, gm: 6, gp: 3 },
  { id: "ensure", nombre: "Ensure", codigo: "1504", categoria: "1504 – Estándar", porcion: "237 ml", kcal: 220, prot: 9, chos: 32, grasa: 6, fd: 1, gs: 1, gm: 3, gp: 2 },
  { id: "fresubin_original", nombre: "Fresubin original", codigo: "1504", categoria: "1504 – Estándar", porcion: "200 ml", kcal: 300, prot: 11, chos: 37, grasa: 11, fd: 0, gs: 2, gm: 6, gp: 3 },
  { id: "neweat_standard", nombre: "Neweat Standard", codigo: "1504", categoria: "1504 – Estándar", porcion: "200 ml", kcal: 300, prot: 12, chos: 36, grasa: 9, fd: 0, gs: 2, gm: 5, gp: 2 },
  { id: "nutrison_1_0", nombre: "Nutrison 1.0", codigo: "1504", categoria: "1504 – Estándar", porcion: "1000 ml", kcal: 1000, prot: 40, chos: 134, grasa: 35, fd: 0, gs: 7, gm: 20, gp: 8 },
  { id: "osmolite_hn_1_2", nombre: "Osmolite HN 1.2", codigo: "1504", categoria: "1504 – Estándar", porcion: "237 ml", kcal: 285, prot: 13, chos: 34, grasa: 11, fd: 0, gs: 2, gm: 6, gp: 3 },
  { id: "aa_esencial_nm", nombre: "AA Esencial NM", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "porción", kcal: 36, prot: 9, chos: 0, grasa: 0, fd: 0, gs: 0, gm: 0, gp: 0 },
  { id: "aa_mezcla_nm", nombre: "AA Mezcla NM", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "porción", kcal: 36, prot: 9, chos: 0, grasa: 0, fd: 0, gs: 0, gm: 0, gp: 0 },
  { id: "abintra", nombre: "Abintra", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "27 g", kcal: 36, prot: 3, chos: 6, grasa: 0, fd: 0, gs: 0, gm: 0, gp: 0 },
  { id: "advance_nm", nombre: "Advance NM", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "200 ml", kcal: 300, prot: 20, chos: 36, grasa: 9, fd: 0, gs: 2, gm: 5, gp: 2 },
  { id: "argiment_at", nombre: "Argiment AT", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "15 g polvo + 150 ml agua", kcal: 60, prot: 7, chos: 7, grasa: 0, fd: 0, gs: 0, gm: 0, gp: 0 },
  { id: "argiment", nombre: "Argiment", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "15 g polvo + 150 ml agua", kcal: 60, prot: 7, chos: 7, grasa: 0, fd: 0, gs: 0, gm: 0, gp: 0 },
  { id: "argiprot", nombre: "Argiprot", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "15 g polvo + 150 ml agua", kcal: 60, prot: 7, chos: 7, grasa: 0, fd: 0, gs: 0, gm: 0, gp: 0 },
  { id: "bns_proteina_whey", nombre: "BNS proteína Whey", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "200 ml", kcal: 300, prot: 20, chos: 35, grasa: 8, fd: 0, gs: 2, gm: 4, gp: 2 },
  { id: "btrust", nombre: "Btrust", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "1 scoop (34 g)", kcal: 120, prot: 24, chos: 4, grasa: 2, fd: 3, gs: 1, gm: 1, gp: 0.5 },
  { id: "ensoy_proteina", nombre: "Ensoy proteína +", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "200 ml", kcal: 300, prot: 20, chos: 36, grasa: 9, fd: 0, gs: 2, gm: 5, gp: 2 },
  { id: "fortisip_compact_protein_mod", nombre: "Fortisip Compact Protein", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "125 ml", kcal: 300, prot: 18, chos: 36, grasa: 11, fd: 0, gs: 2, gm: 6, gp: 3 },
  { id: "glutament", nombre: "Glutament", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "1 sobre (10,3 g)", kcal: 36, prot: 10, chos: 0, grasa: 0, fd: 0, gs: 0, gm: 0, gp: 0 },
  { id: "glutapak_10", nombre: "Glutapak 10", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "1 sobre (10 g)", kcal: 40, prot: 10, chos: 0, grasa: 0, fd: 0, gs: 0, gm: 0, gp: 0 },
  { id: "glycosade", nombre: "Glycosade", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "50 g polvo", kcal: 190, prot: 0, chos: 46, grasa: 0, fd: 0, gs: 0, gm: 0, gp: 0 },
  { id: "kanso_mct_oil", nombre: "Kanso MCT OIL 100%", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "10 ml", kcal: 90, prot: 0, chos: 0, grasa: 10, fd: 0, gs: 10, gm: 0, gp: 0 },
  { id: "leusyn_pro", nombre: "Leusyn-PRO", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "5,97 g polvo", kcal: 22, prot: 5.5, chos: 0, grasa: 0, fd: 0, gs: 0, gm: 0, gp: 0 },
  { id: "master_prot", nombre: "Master PROT", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "15 g polvo + 100 ml agua", kcal: 52, prot: 7.5, chos: 1, grasa: 0, fd: 0, gs: 0, gm: 0, gp: 0 },
  { id: "mct_nm", nombre: "MCT NM", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "10 ml", kcal: 90, prot: 0, chos: 0, grasa: 10, fd: 0, gs: 10, gm: 0, gp: 0 },
  { id: "new_whey_bari", nombre: "New Whey Bari", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "200 ml", kcal: 300, prot: 20, chos: 35, grasa: 8, fd: 0, gs: 2, gm: 4, gp: 2 },
  { id: "nutrisite_hmb", nombre: "Nutrisite By Medsite HMB", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "200 ml", kcal: 300, prot: 20, chos: 36, grasa: 9, fd: 0, gs: 2, gm: 5, gp: 2 },
  { id: "procrill", nombre: "procrill", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "56 g polvo + 200 ml agua", kcal: 230, prot: 15, chos: 19.6, grasa: 10, fd: 1, gs: 2, gm: 5, gp: 3 },
  { id: "proteina_nm", nombre: "Proteína NM", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "200 ml", kcal: 300, prot: 20, chos: 36, grasa: 9, fd: 0, gs: 2, gm: 5, gp: 2 },
  { id: "proteinex", nombre: "proteinex", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "5,6 g polvo", kcal: 20, prot: 5, chos: 0, grasa: 0, fd: 0, gs: 0, gm: 0, gp: 0 },
  { id: "proteplus_nm", nombre: "Proteplus NM", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "200 ml", kcal: 300, prot: 20, chos: 36, grasa: 9, fd: 0, gs: 2, gm: 5, gp: 2 },
  { id: "prowhey_bariatric", nombre: "Prowhey Bariatric", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "200 ml", kcal: 300, prot: 20, chos: 35, grasa: 8, fd: 0, gs: 2, gm: 4, gp: 2 },
  { id: "prowhey_plus", nombre: "Prowhey PLUS", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "84 g polvo + 180 ml agua", kcal: 360, prot: 20, chos: 39, grasa: 14, fd: 1.3, gs: 3, gm: 7, gp: 4 },
  { id: "prowhey", nombre: "Prowhey", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "84 g polvo + 180 ml agua", kcal: 360, prot: 19, chos: 39, grasa: 14, fd: 1.3, gs: 3, gm: 7, gp: 4 },
  { id: "wipro_90", nombre: "Wipro-90", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "84 g polvo + 180 ml agua", kcal: 360, prot: 20, chos: 39, grasa: 14, fd: 1.3, gs: 3, gm: 7, gp: 4 },
  { id: "wipi", nombre: "Wipi", codigo: "1601", categoria: "1601 – Módulos de proteína, carbohidratos y lípidos", porcion: "84 g polvo + 180 ml agua", kcal: 360, prot: 20, chos: 39, grasa: 14, fd: 1.3, gs: 3, gm: 7, gp: 4 },
];

export const MIPRESS_CATEGORIAS: string[] = Array.from(
  new Set(MIPRESS_SUPLEMENTOS.map((s) => s.categoria))
);

export function getMipressSuplementoById(id?: string | null): MipressSuplemento | undefined {
  if (!id) return undefined;
  return MIPRESS_SUPLEMENTOS.find((s) => s.id === id);
}

export function filterMipressSuplementos(categoria?: string | null, query?: string | null): MipressSuplemento[] {
  const q = (query || "").trim().toLowerCase();
  return MIPRESS_SUPLEMENTOS.filter((s) => {
    if (categoria && s.categoria !== categoria) return false;
    if (!q) return true;
    return (
      s.nombre.toLowerCase().includes(q) ||
      s.codigo.includes(q) ||
      s.categoria.toLowerCase().includes(q)
    );
  });
}
