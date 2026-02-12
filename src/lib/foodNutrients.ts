export interface NutrientData {
  kcal: number;
  prot: number;
  grasa: number;
  gs: number;
  gm: number;
  gp: number;
  col: number;
  chos: number;
  fd: number;
  calcio?: number;
  p?: number;
  fe?: number;
  na?: number;
  k?: number;
  mg?: number;
  zn?: number;
  cu?: number;
  /** Porción en gramos (según tabla PDF) */
  portion_grams?: number;
  /** Unidad de medida (ej. 1 vaso pequeño, 3 cucharas soperas colmadas) */
  unit_measure?: string;
}

export const FOOD_NUTRIENTS: Record<string, NutrientData> = {
  "Azucares y dulces adultos": {
    "kcal": 89.9,
    "prot": 0.9,
    "grasa": 1.1,
    "gs": 0.63,
    "gm": 0.33,
    "gp": 0.07,
    "col": 2,
    "chos": 19.1,
    "fd": 0.5,
    "calcio": 20,
    "p": 23,
    "fe": 0.3,
    "na": 25,
    "k": 67,
    "mg": 6,
    "zn": 0.16,
    "cu": 0.05,
  },
  "Azucares y dulces niños y niñas": {
    "kcal": 45.1,
    "prot": 0.4,
    "grasa": 0.3,
    "gs": 0.14,
    "gm": 0.1,
    "gp": 0.03,
    "col": 0,
    "chos": 10.2,
    "fd": 0.2,
    "calcio": 8,
    "p": 12,
    "fe": 0.2,
    "na": 11,
    "k": 33,
    "mg": 4,
    "zn": 0.1,
    "cu": 0.2,
  },
  "Arequipe": { "kcal": 110, "prot": 2.2, "grasa": 3.2, "gs": 2.0, "gm": 0.9, "gp": 0.2, "col": 12, "chos": 19.5, "fd": 0, "calcio": 82, "p": 68, "fe": 0.2, "portion_grams": 30, "unit_measure": "1 cucharada sopera colmada" },
  "Azúcar blanca granulada": { "kcal": 49, "prot": 0, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 12.6, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 12, "unit_measure": "1 cucharada sopera rasa" },
  "Bebida achocolatada instantánea con azúcar": { "kcal": 93, "prot": 2.0, "grasa": 0.9, "gs": 0.6, "gm": 0.3, "gp": 0, "col": 2, "chos": 20.0, "fd": 0.8, "calcio": 80, "p": 90, "fe": 0.5, "portion_grams": 240, "unit_measure": "1 vaso" },
  "Bebida de fruta azucarada": { "kcal": 110, "prot": 0.1, "grasa": 0.1, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 27.5, "fd": 0.1, "calcio": 2, "p": 5, "fe": 0.1, "portion_grams": 250, "unit_measure": "1 vaso" },
  "Avena instantánea saborizada": { "kcal": 105, "prot": 3.0, "grasa": 2.0, "gs": 0.4, "gm": 0.7, "gp": 0.7, "col": 0, "chos": 19.0, "fd": 1.5, "calcio": 15, "p": 110, "fe": 1.2, "portion_grams": 40, "unit_measure": "1 sobre" },
  "Barquillos": { "kcal": 115, "prot": 1.2, "grasa": 2.5, "gs": 0.6, "gm": 1.2, "gp": 0.5, "col": 0, "chos": 22.0, "fd": 0.3, "calcio": 15, "p": 25, "fe": 0.3, "portion_grams": 30, "unit_measure": "2 unidades" },
  "Bebida de fruta caja": { "kcal": 95, "prot": 0.1, "grasa": 0.1, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 24.0, "fd": 0.1, "calcio": 2, "p": 5, "fe": 0.1, "portion_grams": 200, "unit_measure": "1 caja" },
  "Bebida de té instantáneo con azúcar": { "kcal": 88, "prot": 0, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 22.0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 240, "unit_measure": "1 vaso" },
  "Bebida de té líquida": { "kcal": 70, "prot": 0, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 17.5, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 250, "unit_measure": "1 vaso" },
  "Bebida malta": { "kcal": 140, "prot": 1.2, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 32.0, "fd": 0.5, "calcio": 10, "p": 35, "fe": 0.2, "portion_grams": 355, "unit_measure": "1 lata" },
  "Bocadillo de guayaba": { "kcal": 105, "prot": 0.3, "grasa": 0.1, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 26.5, "fd": 1.2, "calcio": 8, "p": 6, "fe": 0.2, "portion_grams": 35, "unit_measure": "1 porción" },
  "Brevas almíbar drenadas": { "kcal": 90, "prot": 0.5, "grasa": 0.1, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 23.0, "fd": 1.5, "calcio": 18, "p": 12, "fe": 0.4, "portion_grams": 70, "unit_measure": "4 unidades" },
  "Caramelos": { "kcal": 60, "prot": 0, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 15.0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 15, "unit_measure": "3 unidades" },
  "Cerezas en almíbar": { "kcal": 90, "prot": 0.3, "grasa": 0.1, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 23.0, "fd": 0.5, "calcio": 8, "p": 8, "fe": 0.2, "portion_grams": 70, "unit_measure": "1/2 pocillo" },
  "Chocolatina blanca comercial": { "kcal": 135, "prot": 2.0, "grasa": 7.5, "gs": 4.5, "gm": 2.2, "gp": 0.3, "col": 10, "chos": 16.0, "fd": 0.2, "calcio": 55, "p": 55, "fe": 0.1, "portion_grams": 28, "unit_measure": "1 tableta pequeña" },
  "Chocolatina de leche": { "kcal": 145, "prot": 2.2, "grasa": 8.5, "gs": 5.2, "gm": 2.6, "gp": 0.3, "col": 10, "chos": 16.5, "fd": 1.0, "calcio": 60, "p": 85, "fe": 0.5, "portion_grams": 28, "unit_measure": "1 tableta pequeña" },
  "Ciruelas pasas": { "kcal": 100, "prot": 0.9, "grasa": 0.1, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 26.5, "fd": 2.9, "calcio": 15, "p": 25, "fe": 0.5, "portion_grams": 40, "unit_measure": "5 unidades" },
  "Cocada de panela": { "kcal": 120, "prot": 1.2, "grasa": 4.5, "gs": 3.9, "gm": 0.4, "gp": 0.1, "col": 0, "chos": 20.0, "fd": 0.5, "calcio": 15, "p": 35, "fe": 0.3, "portion_grams": 40, "unit_measure": "1 unidad mediana" },
  "Cóctel de frutas": { "kcal": 95, "prot": 0.4, "grasa": 0.1, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 24.5, "fd": 0.8, "calcio": 6, "p": 8, "fe": 0.2, "portion_grams": 125, "unit_measure": "1/2 pocillo" },
  "Confites duros": { "kcal": 60, "prot": 0, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 15.0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 15, "unit_measure": "3 unidades" },
  "Cucas": { "kcal": 110, "prot": 1.5, "grasa": 2.5, "gs": 0.6, "gm": 1.2, "gp": 0.5, "col": 15, "chos": 20.0, "fd": 0.3, "calcio": 25, "p": 40, "fe": 0.5, "portion_grams": 35, "unit_measure": "2 unidades" },
  "Durazno enlatado": { "kcal": 90, "prot": 0.5, "grasa": 0.1, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 23.0, "fd": 1.2, "calcio": 4, "p": 12, "fe": 0.2, "portion_grams": 125, "unit_measure": "1/2 pocillo" },
  "Gaseosa": { "kcal": 140, "prot": 0, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 39.0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 355, "unit_measure": "1 lata" },
  "Gelatina con azúcar preparada": { "kcal": 80, "prot": 1.6, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 19.0, "fd": 0, "calcio": 2, "p": 2, "fe": 0, "portion_grams": 120, "unit_measure": "1/2 pocillo" },
  "Gelatina de pata": { "kcal": 100, "prot": 2.5, "grasa": 0.2, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 24.0, "fd": 0, "calcio": 5, "p": 8, "fe": 0.1, "portion_grams": 80, "unit_measure": "1 porción" },
  "Gomita tradicional": { "kcal": 70, "prot": 0.8, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 17.0, "fd": 0, "calcio": 5, "p": 2, "fe": 0, "portion_grams": 28, "unit_measure": "5 unidades" },
  "Helado de agua": { "kcal": 85, "prot": 0, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 21.0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 100, "unit_measure": "1 porción" },
  "Helado de vainilla": { "kcal": 145, "prot": 2.5, "grasa": 7.5, "gs": 4.5, "gm": 2.2, "gp": 0.3, "col": 30, "chos": 17.0, "fd": 0, "calcio": 85, "p": 65, "fe": 0.1, "portion_grams": 90, "unit_measure": "1/2 pocillo" },
  "Jarabe de maple": { "kcal": 105, "prot": 0, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 27.0, "fd": 0, "calcio": 20, "p": 2, "fe": 0.2, "portion_grams": 60, "unit_measure": "1/4 pocillo" },
  "Leche condensada": { "kcal": 130, "prot": 3.2, "grasa": 3.5, "gs": 2.2, "gm": 1.0, "gp": 0.1, "col": 35, "chos": 22.0, "fd": 0, "calcio": 105, "p": 95, "fe": 0.1, "portion_grams": 38, "unit_measure": "2 cucharadas soperas" },
  "Masmelos": { "kcal": 90, "prot": 0.6, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 23.0, "fd": 0, "calcio": 2, "p": 2, "fe": 0, "portion_grams": 30, "unit_measure": "4 unidades" },
  "Mermelada": { "kcal": 55, "prot": 0.1, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 14.0, "fd": 0.2, "calcio": 2, "p": 2, "fe": 0, "portion_grams": 20, "unit_measure": "1 cucharada sopera" },
  "Mermelada light": { "kcal": 25, "prot": 0.1, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 6.5, "fd": 0.2, "calcio": 1, "p": 1, "fe": 0, "portion_grams": 20, "unit_measure": "1 cucharada sopera" },
  "Miel de abejas": { "kcal": 64, "prot": 0, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 17.3, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 21, "unit_measure": "1 cucharada sopera" },
  "Panela en polvo": { "kcal": 45, "prot": 0, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 11.5, "fd": 0, "calcio": 30, "p": 5, "fe": 0.3, "portion_grams": 12, "unit_measure": "1 cucharada sopera rasa" },
  "Panelita de arequipe": { "kcal": 120, "prot": 2.5, "grasa": 3.5, "gs": 2.2, "gm": 1.0, "gp": 0.2, "col": 12, "chos": 21.0, "fd": 0, "calcio": 90, "p": 75, "fe": 0.2, "portion_grams": 35, "unit_measure": "1 unidad" },
  "Piña enlatada": { "kcal": 95, "prot": 0.3, "grasa": 0.1, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 24.5, "fd": 0.5, "calcio": 8, "p": 6, "fe": 0.2, "portion_grams": 125, "unit_measure": "1/2 pocillo" },
  "Ponqué cubierto de chocolate comercial": { "kcal": 180, "prot": 2.5, "grasa": 8.0, "gs": 4.5, "gm": 2.5, "gp": 0.5, "col": 25, "chos": 26.0, "fd": 1.0, "calcio": 35, "p": 55, "fe": 0.8, "portion_grams": 55, "unit_measure": "1 porción" },
  "Ponqué mediano tradicional": { "kcal": 150, "prot": 2.5, "grasa": 6.0, "gs": 1.5, "gm": 2.5, "gp": 1.5, "col": 35, "chos": 21.0, "fd": 0.5, "calcio": 45, "p": 65, "fe": 0.6, "portion_grams": 50, "unit_measure": "1 porción" },
  "Postre gelatina-leche": { "kcal": 100, "prot": 2.0, "grasa": 2.5, "gs": 1.5, "gm": 0.7, "gp": 0.2, "col": 15, "chos": 17.0, "fd": 0, "calcio": 60, "p": 50, "fe": 0.1, "portion_grams": 85, "unit_measure": "1 porción" },
  "Carnes cocidas altas en lípidos menores de 2 años": {
    "kcal": 46.8,
    "prot": 6.9,
    "grasa": 2,
    "gs": 0.78,
    "gm": 0.86,
    "gp": 0.31,
    "col": 79,
    "chos": 0.3,
    "fd": 0,
    "calcio": 3,
    "p": 57,
    "fe": 3,
    "na": 62,
    "k": 55,
    "mg": 6,
    "zn": 1.21,
    "cu": 0.25,
  },
  /** Promedio del grupo (sin porción) */
  "Carnes crudas altas en lípidos adultos y niños": {
    "kcal": 138.7,
    "prot": 15.6,
    "grasa": 7.9,
    "gs": 2.51,
    "gm": 3.3,
    "gp": 1.25,
    "col": 137,
    "chos": 1.3,
    "fd": 0,
    "calcio": 37,
    "p": 186,
    "fe": 2.5,
    "na": 101,
    "k": 234,
    "mg": 20,
    "zn": 1.87,
    "cu": 0.47,
  },
  "Alas de pollo carne y piel": {
    "kcal": 186, "prot": 15.4, "grasa": 13.4, "gs": 3.76, "gm": 5.33, "gp": 2.85, "col": 65.0, "chos": 0.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 84, "unit_measure": "2 unidades medianas"
  },
  "Bagre carne y piel": {
    "kcal": 140, "prot": 14.4, "grasa": 8.7, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 0.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 76, "unit_measure": "1 medallón grueso"
  },
  "Callo o panza": {
    "kcal": 98, "prot": 14.6, "grasa": 4.0, "gs": 2.03, "gm": 1.31, "gp": 0.07, "col": 95.0, "chos": 0.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 100, "unit_measure": "1/5 libra"
  },
  "Camarón especies mezcladas": {
    "kcal": 77, "prot": 14.8, "grasa": 1.2, "gs": 0.24, "gm": 0.18, "gp": 0.49, "col": 111.0, "chos": 0.7, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 73, "unit_measure": "6 unidades grandes"
  },
  "Contramuslo de pollo sin hueso y con piel": {
    "kcal": 222, "prot": 18.2, "grasa": 16.1, "gs": 4.56, "gm": 6.59, "gp": 3.48, "col": 88.0, "chos": 0.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 105, "unit_measure": "1 unidad mediana"
  },
  "Hígado de pollo": {
    "kcal": 90, "prot": 13.0, "grasa": 2.8, "gs": 0.94, "gm": 0.68, "gp": 0.46, "col": 316.0, "chos": 2.4, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 72, "unit_measure": "2 unidades medianas"
  },
  "Hígado de res": {
    "kcal": 143, "prot": 20.0, "grasa": 3.9, "gs": 1.5, "gm": 0.51, "gp": 0.84, "col": 354.0, "chos": 5.8, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 100, "unit_measure": "1/5 libra"
  },
  "Langostino especies mezcladas": {
    "kcal": 73, "prot": 15.2, "grasa": 1.0, "gs": 0.15, "gm": 0.16, "gp": 0.28, "col": 108.0, "chos": 0.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 95, "unit_measure": "6 unidades medianas"
  },
  "Lengua de res": {
    "kcal": 224, "prot": 14.9, "grasa": 16.1, "gs": 7.0, "gm": 7.24, "gp": 0.9, "col": 87.0, "chos": 3.7, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 100, "unit_measure": "1/5 libra"
  },
  "Sardina enlatada en salsa de tomate": {
    "kcal": 178, "prot": 16.4, "grasa": 12.0, "gs": 3.09, "gm": 5.54, "gp": 2.43, "col": 61.0, "chos": 0.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 100, "unit_measure": "2 unidades medianas"
  },
  "Carnes magras cocidas menores de 2 años": {
    "kcal": 49.2,
    "prot": 7.8,
    "grasa": 2,
    "gs": 0.52,
    "gm": 0.84,
    "gp": 0.35,
    "col": 21,
    "chos": 0,
    "fd": 0,
    "calcio": 7,
    "p": 74,
    "fe": 0.4,
    "na": 19,
    "k": 108,
    "mg": 8,
    "zn": 0.55,
    "cu": 0.04,
  },
  /** Promedio del grupo (sin porción) */
  "Carnes magras crudas y proteínas texturizada adultos y niños": {
    "kcal": 108.3,
    "prot": 19.1,
    "grasa": 3.1,
    "gs": 0.92,
    "gm": 1.16,
    "gp": 0.53,
    "col": 50,
    "chos": 1,
    "fd": 0.3,
    "calcio": 22,
    "p": 191,
    "fe": 1.5,
    "na": 72,
    "k": 325,
    "mg": 28,
    "zn": 1.81,
    "cu": 0.11,
  },
  "Atún enlatado en agua, sólidos": {
    "kcal": 139, "prot": 30.6, "grasa": 1.0, "gs": 0.28, "gm": 0.19, "gp": 0.41, "col": 36.0, "chos": 0.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 120, "unit_measure": "1 lata"
  },
  "Carne de cabra o chivo": {
    "kcal": 109, "prot": 20.6, "grasa": 2.3, "gs": 0.71, "gm": 1.03, "gp": 0.17, "col": 57.0, "chos": 0.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 100, "unit_measure": "1/5 libra"
  },
  "Carne de cerdo lomo o cañón magro": {
    "kcal": 143, "prot": 21.4, "grasa": 5.7, "gs": 1.95, "gm": 2.56, "gp": 0.61, "col": 59.0, "chos": 0.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 100, "unit_measure": "1/5 libra"
  },
  "Carne de conejo todos los cortes": {
    "kcal": 136, "prot": 20.1, "grasa": 5.6, "gs": 1.66, "gm": 1.5, "gp": 1.08, "col": 57.0, "chos": 0.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 100, "unit_measure": "1/5 libra"
  },
  "Carne de cordero diferentes cortes grasa menor 10%": {
    "kcal": 134, "prot": 20.3, "grasa": 5.3, "gs": 1.88, "gm": 2.11, "gp": 0.48, "col": 65.0, "chos": 0.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 100, "unit_measure": "1/5 libra"
  },
  "Carne de Cuy o cuy": {
    "kcal": 95, "prot": 19.0, "grasa": 1.6, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 0.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 100, "unit_measure": "1/5 libra"
  },
  "Carne de res todos los cortes magra": {
    "kcal": 150, "prot": 21.5, "grasa": 6.5, "gs": 2.32, "gm": 2.61, "gp": 0.24, "col": 59.0, "chos": 0.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 100, "unit_measure": "1/5 libra"
  },
  "Carne de ternera diferentes cortes magra": {
    "kcal": 112, "prot": 20.2, "grasa": 2.9, "gs": 0.86, "gm": 0.92, "gp": 0.3, "col": 83.0, "chos": 0.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 100, "unit_measure": "1/5 libra"
  },
  "Chuleta de cerdo magro": {
    "kcal": 149, "prot": 22.1, "grasa": 6.0, "gs": 2.07, "gm": 2.71, "gp": 0.65, "col": 55.0, "chos": 0.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 100, "unit_measure": "1/5 libra"
  },
  "Contramuslo de pollo, carne sin piel": {
    "kcal": 102, "prot": 16.9, "grasa": 3.4, "gs": 0.86, "gm": 1.04, "gp": 0.83, "col": 71.0, "chos": 0.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 86, "unit_measure": "1 unidad mediana"
  },
  "Muslo de pollo, carne sin piel": {
    "kcal": 90, "prot": 15.1, "grasa": 2.9, "gs": 0.74, "gm": 0.89, "gp": 0.71, "col": 60.0, "chos": 0.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 75, "unit_measure": "1 unidad mediana"
  },
  "Pargo especies mezcladas": {
    "kcal": 100, "prot": 20.5, "grasa": 1.3, "gs": 0.29, "gm": 0.25, "gp": 0.46, "col": 37.0, "chos": 0.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 100, "unit_measure": "1 trozo mediano"
  },
  "Pavo todas las carnes sin piel": {
    "kcal": 119, "prot": 21.8, "grasa": 2.9, "gs": 0.95, "gm": 0.61, "gp": 0.83, "col": 65.0, "chos": 0.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 100, "unit_measure": "1/5 libra"
  },
  "Pechuga de pollo, carne sin piel": {
    "kcal": 88, "prot": 18.5, "grasa": 1.0, "gs": 0.26, "gm": 0.24, "gp": 0.22, "col": 46.0, "chos": 0.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 80, "unit_measure": "1/4 unidad grande"
  },
  "Proteina de soya texturizada hidratada": {
    "kcal": 83, "prot": 14.5, "grasa": 0.1, "gs": 0.01, "gm": 0.02, "gp": 0.05, "col": 0, "chos": 7.8, "fd": 1.4,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 60, "unit_measure": "2 cucharas soperas colmadas"
  },
  "Proteina de trigo texturizada hidratada": {
    "kcal": 78, "prot": 9.5, "grasa": 0.8, "gs": 0.11, "gm": 0.16, "gp": 0.42, "col": 0, "chos": 9.6, "fd": 4.4,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 75, "unit_measure": "3 cucharas soperas colmadas"
  },
  "Salmon rosado, crudo": {
    "kcal": 85, "prot": 14.5, "grasa": 2.6, "gs": 0.41, "gm": 0.68, "gp": 0.99, "col": 38.0, "chos": 0.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 73, "unit_measure": "1 trozo pequeño"
  },
  "Trucha arcoiris": {
    "kcal": 112, "prot": 16.9, "grasa": 4.4, "gs": 1.26, "gm": 1.25, "gp": 1.47, "col": 48.0, "chos": 0.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 81, "unit_measure": "1/2 unidad mediana"
  },
  /** Promedio del grupo (sin porción) */
  "Cereales adultos": {
    "kcal": 93.8,
    "prot": 2.5,
    "grasa": 1,
    "gs": 0.24,
    "gm": 0.32,
    "gp": 0.33,
    "col": 1,
    "chos": 18.7,
    "fd": 1.2,
    "calcio": 19,
    "p": 47,
    "fe": 0.9,
    "na": 82,
    "k": 53,
    "mg": 13,
    "zn": 0.42,
    "cu": 0.05,
  },
  "Almojábana": { "kcal": 89, "prot": 4.0, "grasa": 3.8, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 9.3, "fd": 0, "calcio": 99, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 31, "unit_measure": "1 unidad pequeña" },
  "Arepa delgada de maíz blanco trillado": { "kcal": 104, "prot": 2.1, "grasa": 0.3, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 22.5, "fd": 0, "calcio": 2, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 56, "unit_measure": "1 unidad pequeña" },
  "Arepa redonda de maíz blanco trillado": { "kcal": 90, "prot": 2.1, "grasa": 0.3, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 19.4, "fd": 0, "calcio": 2, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 52, "unit_measure": "1 unidad grande" },
  "Arroz blanco, cocido": { "kcal": 104, "prot": 1.9, "grasa": 0.2, "gs": 0.05, "gm": 0.06, "gp": 0.05, "col": 0, "chos": 22.9, "fd": 0.2, "calcio": 2, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 80, "unit_measure": "6 cucharas soperas colmadas" },
  "Arroz integral, cocido": { "kcal": 91, "prot": 1.9, "grasa": 0.6, "gs": 0.14, "gm": 0.24, "gp": 0.24, "col": 0, "chos": 19.0, "fd": 1.5, "calcio": 8, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 81, "unit_measure": "8 cucharas soperas colmadas" },
  "Arroz parbolizado cocido": { "kcal": 86, "prot": 1.7, "grasa": 0.2, "gs": 0.05, "gm": 0.06, "gp": 0.05, "col": 0, "chos": 18.5, "fd": 0.3, "calcio": 14, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 75, "unit_measure": "5 cucharas soperas colmadas" },
  "Avena en hojuelas fortificada": { "kcal": 89, "prot": 3.7, "grasa": 1.5, "gs": 0.26, "gm": 0.46, "gp": 0.54, "col": 0, "chos": 15.4, "fd": 2.6, "calcio": 13, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 24, "unit_measure": "4 cucharas soperas colmadas" },
  "Cebada perlada cocida": { "kcal": 89, "prot": 1.7, "grasa": 0.3, "gs": 0.06, "gm": 0.04, "gp": 0.15, "col": 0, "chos": 20.3, "fd": 2.7, "calcio": 8, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 72, "unit_measure": "5 cucharas soperas colmadas" },
  "Choco Krispis": { "kcal": 87, "prot": 1.4, "grasa": 0.3, "gs": 0.09, "gm": 0.07, "gp": 0.12, "col": 0, "chos": 19.9, "fd": 0.3, "calcio": 2, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 23, "unit_measure": "2/3 pocillo chocolatero" },
  "Corn Flakes": { "kcal": 91, "prot": 1.7, "grasa": 0.2, "gs": 0.05, "gm": 0.03, "gp": 0.10, "col": 0, "chos": 21.6, "fd": 0.7, "calcio": 1, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 25, "unit_measure": "2/3 pocillo chocolatero" },
  "Cuchuco de cebada": { "kcal": 93, "prot": 2.4, "grasa": 0.2, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 21.0, "fd": 0, "calcio": 10, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 27, "unit_measure": "4 cucharas soperas colmadas" },
  "Espaguetis de arroz, hidratados": { "kcal": 82, "prot": 0.7, "grasa": 0.2, "gs": 0.02, "gm": 0.02, "gp": 0.02, "col": 0, "chos": 18.7, "fd": 0, "calcio": 3, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 75, "unit_measure": "2/3 pocillo chocolatero" },
  "Espaguetis de trigo, cocidos": { "kcal": 92, "prot": 3.1, "grasa": 0.5, "gs": 0.07, "gm": 0.05, "gp": 0.18, "col": 0, "chos": 18.4, "fd": 1.1, "calcio": 5, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 65, "unit_measure": "2/3 pocillo chocolatero" },
  "Froot Loops": { "kcal": 78, "prot": 1.0, "grasa": 0.6, "gs": 0.26, "gm": 0.14, "gp": 0.18, "col": 0, "chos": 17.6, "fd": 0.4, "calcio": 2, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 20, "unit_measure": "2/3 pocillo chocolatero" },
  "Galletas Saltinas": { "kcal": 78, "prot": 1.7, "grasa": 2.1, "gs": 0.53, "gm": 1.16, "gp": 0.30, "col": 0, "chos": 12.9, "fd": 0.5, "calcio": 2, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 24, "unit_measure": "3 tablas" },
  "Harina de arroz blanco": { "kcal": 92, "prot": 1.5, "grasa": 0.4, "gs": 0.10, "gm": 0.11, "gp": 0.10, "col": 0, "chos": 20.0, "fd": 0.6, "calcio": 3, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 25, "unit_measure": "2 cucharas soperas colmadas" },
  "Harina de maíz blanco trillado": { "kcal": 81, "prot": 2.3, "grasa": 0.9, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 18.0, "fd": 0, "calcio": 5, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 25, "unit_measure": "2 cucharas soperas rasas" },
  "Harina de trigo enriquecida": { "kcal": 91, "prot": 2.6, "grasa": 0.3, "gs": 0.04, "gm": 0.02, "gp": 0.10, "col": 0, "chos": 19.1, "fd": 0.7, "calcio": 4, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 25, "unit_measure": "4 cucharas soperas rasas" },
  "Macarrones, cocidos": { "kcal": 90, "prot": 3.1, "grasa": 0.4, "gs": 0.06, "gm": 0.05, "gp": 0.17, "col": 0, "chos": 18.1, "fd": 0.8, "calcio": 4, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 64, "unit_measure": "2/3 pocillo chocolatero" },
  "Maicena (almidón de maíz)": { "kcal": 95, "prot": 0.1, "grasa": 0, "gs": 0, "gm": 0.01, "gp": 0.01, "col": 0, "chos": 22.8, "fd": 0.2, "calcio": 1, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 25, "unit_measure": "4 cucharas soperas rasas" },
  "Maíz pira, crudo": { "kcal": 90, "prot": 2.3, "grasa": 1.0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 19.4, "fd": 0, "calcio": 0, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 27, "unit_measure": "1 cuchara sopera colmada" },
  "Maíz tierno o choclo, amarillo enlatado": { "kcal": 89, "prot": 2.9, "grasa": 1.1, "gs": 0.17, "gm": 0.32, "gp": 0.52, "col": 0, "chos": 20.5, "fd": 2.2, "calcio": 0, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 110, "unit_measure": "8 cucharas soperas colmadas" },
  "Maíz tostado comercial": { "kcal": 77, "prot": 2.0, "grasa": 1.0, "gs": 0.14, "gm": 0.26, "gp": 0.45, "col": 0, "chos": 15.7, "fd": 0.2, "calcio": 0, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 21, "unit_measure": "3 cucharas soperas colmadas" },
  "Mazamorra Antioqueña (maíz cocido)": { "kcal": 108, "prot": 3.3, "grasa": 1.3, "gs": 0.20, "gm": 0.37, "gp": 0.60, "col": 0, "chos": 25.1, "fd": 2.8, "calcio": 0, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 100, "unit_measure": "5 cucharas soperas altas" },
  "Palitos o palitroques": { "kcal": 91, "prot": 2.6, "grasa": 2.1, "gs": 0.31, "gm": 0.79, "gp": 0.80, "col": 0, "chos": 15.0, "fd": 0.7, "calcio": 0, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 22, "unit_measure": "2 unidades" },
  "Pan blanco": { "kcal": 59, "prot": 1.8, "grasa": 0.8, "gs": 0.18, "gm": 0.35, "gp": 0.16, "col": 0, "chos": 10.9, "fd": 0.5, "calcio": 0, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 22, "unit_measure": "1 tajada delgada" },
  "Pan centeno": { "kcal": 91, "prot": 3.0, "grasa": 1.2, "gs": 0.22, "gm": 0.46, "gp": 0.28, "col": 0, "chos": 16.9, "fd": 2.0, "calcio": 0, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 35, "unit_measure": "1 tajada mediana" },
  "Pan de salvado de avena": { "kcal": 90, "prot": 4.0, "grasa": 1.7, "gs": 0.27, "gm": 0.60, "gp": 0.64, "col": 0, "chos": 15.1, "fd": 1.7, "calcio": 0, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 38, "unit_measure": "1 tajada mediana" },
  "Pan integral": { "kcal": 79, "prot": 3.1, "grasa": 1.3, "gs": 0.29, "gm": 0.54, "gp": 0.32, "col": 0, "chos": 14.8, "fd": 2.2, "calcio": 0, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 32, "unit_measure": "1 tajada mediana" },
  "Pan pita o árabe": { "kcal": 69, "prot": 2.3, "grasa": 0.3, "gs": 0.04, "gm": 0.03, "gp": 0.14, "col": 0, "chos": 13.9, "fd": 0.6, "calcio": 0, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 25, "unit_measure": "1/2 unidad pequeña" },
  "Pancake (mezcla preparada con leche entera)": { "kcal": 90, "prot": 2.6, "grasa": 3.9, "gs": 0.85, "gm": 0.99, "gp": 1.78, "col": 24, "chos": 11.3, "fd": 0, "calcio": 0, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 40, "unit_measure": "1 unidad mediana" },
  "Pandequeso": { "kcal": 78, "prot": 2.9, "grasa": 2.0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 12.8, "fd": 0, "calcio": 0, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 28, "unit_measure": "1 unidad pequeña" },
  "Pandeyuca": { "kcal": 69, "prot": 3.2, "grasa": 2.4, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 9.0, "fd": 0, "calcio": 0, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 20, "unit_measure": "2 unidades medianas" },
  "Pasta corta cocida": { "kcal": 92, "prot": 3.1, "grasa": 0.5, "gs": 0.07, "gm": 0.05, "gp": 0.18, "col": 0, "chos": 18.4, "fd": 1.1, "calcio": 0, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 65, "unit_measure": "2/3 pocillo chocolatero" },
  "Seba Seba": { "kcal": 70, "prot": 2.2, "grasa": 1.0, "gs": 0.21, "gm": 0.04, "gp": 0.02, "col": 0, "chos": 13.1, "fd": 0.6, "calcio": 0, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 24, "unit_measure": "3 unidades medianas" },
  "Taco vacío": { "kcal": 122, "prot": 1.9, "grasa": 5.9, "gs": 0.85, "gm": 2.32, "gp": 2.21, "col": 0, "chos": 16.2, "fd": 2.0, "calcio": 0, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 26, "unit_measure": "2 unidades medianas" },
  "Tortilla de maíz": { "kcal": 67, "prot": 1.7, "grasa": 0.8, "gs": 0.10, "gm": 0.20, "gp": 0.34, "col": 0, "chos": 14.0, "fd": 1.6, "calcio": 0, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 30, "unit_measure": "1 unidad pequeña" },
  "Tostada o calado": { "kcal": 94, "prot": 2.9, "grasa": 1.3, "gs": 0.28, "gm": 0.57, "gp": 0.26, "col": 0, "chos": 17.4, "fd": 0.8, "calcio": 0, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 32, "unit_measure": "1 unidad mediana" },
  "Zucaritas": { "kcal": 96, "prot": 1.3, "grasa": 0.1, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 22.6, "fd": 0, "calcio": 0, "p": 47, "fe": 0.9, "na": 82, "k": 53, "mg": 13, "zn": 0.42, "cu": 0.05, "portion_grams": 25, "unit_measure": "2/3 pocillo chocolatero" },
  "Arracacha": { "kcal": 90, "prot": 1, "grasa": 0.1, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 21.4, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 96, "unit_measure": "1 trozo pequeño" },
  "Batata": { "kcal": 105, "prot": 1.7, "grasa": 0.3, "gs": 0.06, "gm": 0.01, "gp": 0.13, "col": 0, "chos": 24.3, "fd": 1.8, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 100, "unit_measure": "1 trozo pequeño" },
  "Chuguas u ollucos": { "kcal": 90, "prot": 2.3, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 20.6, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 155, "unit_measure": "9 unidades grandes" },
  "Cubios": { "kcal": 90, "prot": 2.5, "grasa": 0.2, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 20.3, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 155, "unit_measure": "2 unidades grandes" },
  "Harina de plátano": { "kcal": 87, "prot": 0.9, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 21.0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 24, "unit_measure": "2 cucharas soperas colmadas" },
  "Ñame": { "kcal": 90, "prot": 1.2, "grasa": 0.1, "gs": 0.02, "gm": 0.01, "gp": 0.05, "col": 0, "chos": 21.5, "fd": 3.0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 78, "unit_measure": "1 trozo pequeño" },
  "Papa común": { "kcal": 90, "prot": 1.9, "grasa": 0.1, "gs": 0.02, "gm": 0, "gp": 0.03, "col": 0, "chos": 20.9, "fd": 2.0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 83, "unit_measure": "1 unidad mediana" },
  "Papa criolla": { "kcal": 90, "prot": 2.7, "grasa": 0.1, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 20.2, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 108, "unit_measure": "3 unidades medianas" },
  "Plátano colí o guineo": { "kcal": 99, "prot": 1.5, "grasa": 0.1, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 26.0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 88, "unit_measure": "1 unidad mediana" },
  "Plátano hartón maduro": { "kcal": 90, "prot": 0.7, "grasa": 0.3, "gs": 0.09, "gm": 0.02, "gp": 0.05, "col": 0, "chos": 24.0, "fd": 1.5, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 66, "unit_measure": "1/4 unidad mediana" },
  "Plátano verde": { "kcal": 111, "prot": 0.9, "grasa": 0.2, "gs": 0.11, "gm": 0.02, "gp": 0.05, "col": 0, "chos": 29.5, "fd": 1.8, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 78, "unit_measure": "1/2 unidad mediana" },
  "Yuca blanca": { "kcal": 91, "prot": 0.5, "grasa": 0.1, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 22.0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 62, "unit_measure": "1 trozo mediano" },
  "Raíces, Tubérculos y Plátanos adultos": {
    "kcal": 94, "prot": 1.5, "grasa": 0.1, "gs": 0.06, "gm": 0.01, "gp": 0.06, "col": 0, "chos": 22.6, "fd": 2.0,
    "calcio": 0, "p": 0, "fe": 0, "portion_grams": 94
  },
  "Arracacha (niños)": { "kcal": 66, "prot": 0.7, "grasa": 0.1, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 15.6, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 70, "unit_measure": "1 trozo mediano" },
  "Batata (niños)": { "kcal": 53, "prot": 0.9, "grasa": 0.2, "gs": 0.03, "gm": 0.01, "gp": 0.07, "col": 0, "chos": 12.2, "fd": 0.9, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 50, "unit_measure": "1 trozo muy pequeño" },
  "Chuguas u ollucos (niños)": { "kcal": 68, "prot": 1.8, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 15.7, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 118, "unit_measure": "7 unidades grandes" },
  "Cubios (niños)": { "kcal": 70, "prot": 1.9, "grasa": 0.1, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 15.7, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 120, "unit_measure": "2 unidades medianas" },
  "Harina de plátano (niños)": { "kcal": 58, "prot": 0.6, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 14.0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 16, "unit_measure": "1 cuchara sopera colmada" },
  "Ñame (niños)": { "kcal": 61, "prot": 0.8, "grasa": 0.1, "gs": 0.02, "gm": 0.01, "gp": 0.03, "col": 0, "chos": 14.6, "fd": 2.1, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 53, "unit_measure": "1 trozo muy pequeño" },
  "Papa común (niños)": { "kcal": 76, "prot": 1.6, "grasa": 0.1, "gs": 0.02, "gm": 0.00, "gp": 0.03, "col": 0, "chos": 17.6, "fd": 1.7, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 70, "unit_measure": "1 unidad pequeña" },
  "Papa criolla (niños)": { "kcal": 70, "prot": 2.1, "grasa": 0.1, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 15.7, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 84, "unit_measure": "3 unidades pequeñas" },
  "Plátano colí o guineo (niños)": { "kcal": 50, "prot": 0.7, "grasa": 0.0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 13.0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 44, "unit_measure": "1/2 unidad mediana" },
  "Plátano hartón maduro (niños)": { "kcal": 70, "prot": 0.6, "grasa": 0.2, "gs": 0.07, "gm": 0.02, "gp": 0.04, "col": 0, "chos": 18.5, "fd": 1.2, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 51, "unit_measure": "1/8 unidad mediana" },
  "Plátano verde (niños)": { "kcal": 74, "prot": 0.6, "grasa": 0.1, "gs": 0.07, "gm": 0.02, "gp": 0.04, "col": 0, "chos": 19.7, "fd": 1.2, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 52, "unit_measure": "1/4 unidad mediana" },
  "Yuca blanca (niños)": { "kcal": 58, "prot": 0.3, "grasa": 0.0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 14.2, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 40, "unit_measure": "1 trozo pequeño" },
  "Raíces, tubérculos y plátanos niños y niñas": {
    "kcal": 64, "prot": 1.0, "grasa": 0.1, "gs": 0.04, "gm": 0.01, "gp": 0.04, "col": 0, "chos": 15.5, "fd": 1.4,
    "calcio": 0, "p": 0, "fe": 0, "portion_grams": 58
  },
  "Almojábana (niños)": { "kcal": 69, "prot": 3.1, "grasa": 3.0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 7.2, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 24, "unit_measure": "1 unidad mediana" },
  "Arepa redonda de maíz blanco trillado (niños)": { "kcal": 61, "prot": 1.4, "grasa": 0.2, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 13.1, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 35, "unit_measure": "1 unidad pequeña" },
  "Arroz blanco, cocido (niños)": { "kcal": 68, "prot": 1.2, "grasa": 0.1, "gs": 0.03, "gm": 0.04, "gp": 0.03, "col": 0, "chos": 14.9, "fd": 0.2, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 52, "unit_measure": "4 cucharas soperas colmadas" },
  "Arroz integral, cocido (niños)": { "kcal": 71, "prot": 1.4, "grasa": 0.5, "gs": 0.11, "gm": 0.19, "gp": 0.19, "col": 0, "chos": 14.8, "fd": 1.1, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 63, "unit_measure": "6 cucharas soperas colmadas" },
  "Arroz parbolizado cocido (niños)": { "kcal": 68, "prot": 1.4, "grasa": 0.2, "gs": 0.04, "gm": 0.05, "gp": 0.04, "col": 0, "chos": 14.8, "fd": 0.2, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 60, "unit_measure": "4 cucharas soperas colmadas" },
  "Avena en hojuelas fortificada (niños)": { "kcal": 66, "prot": 2.8, "grasa": 1.1, "gs": 0.19, "gm": 0.35, "gp": 0.40, "col": 0, "chos": 11.5, "fd": 2.0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 18, "unit_measure": "3 cucharas soperas colmadas" },
  "Cebada perlada cocida (niños)": { "kcal": 70, "prot": 1.3, "grasa": 0.2, "gs": 0.05, "gm": 0.03, "gp": 0.12, "col": 0, "chos": 16.1, "fd": 2.2, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 57, "unit_measure": "4 cucharas soperas" },
  "Choco Krispis (niños)": { "kcal": 72, "prot": 1.2, "grasa": 0.2, "gs": 0.08, "gm": 0.06, "gp": 0.10, "col": 0, "chos": 16.4, "fd": 0.2, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 19, "unit_measure": "1/2 pocillo chocolatero" },
  "Corn Flakes (niños)": { "kcal": 66, "prot": 1.2, "grasa": 0.1, "gs": 0.04, "gm": 0.02, "gp": 0.07, "col": 0, "chos": 15.6, "fd": 0.5, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 18, "unit_measure": "1/2 pocillo chocolatero" },
  "Cuchuco de cebada, crudo (niños)": { "kcal": 69, "prot": 1.8, "grasa": 0.1, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 15.6, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 20, "unit_measure": "3 cucharas soperas colmadas" },
  "Espaguetis de arroz, hidratados (niños)": { "kcal": 55, "prot": 0.5, "grasa": 0.1, "gs": 0.01, "gm": 0.01, "gp": 0.01, "col": 0, "chos": 12.5, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 50, "unit_measure": "1/2 pocillo chocolatero" },
  "Espaguetis de trigo, cocidos (niños)": { "kcal": 71, "prot": 2.4, "grasa": 0.4, "gs": 0.05, "gm": 0.04, "gp": 0.14, "col": 0, "chos": 14.2, "fd": 0.9, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 50, "unit_measure": "1/2 pocillo chocolatero" },
  "Froot Loops (niños)": { "kcal": 78, "prot": 1.0, "grasa": 0.6, "gs": 0.26, "gm": 0.14, "gp": 0.18, "col": 0, "chos": 17.6, "fd": 0.4, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 20, "unit_measure": "2/3 pocillo chocolatero" },
  "Galletas Saltinas (niños)": { "kcal": 66, "prot": 1.5, "grasa": 1.1, "gs": 0.47, "gm": 1.03, "gp": 0.27, "col": 0, "chos": 12.4, "fd": 0.5, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 16, "unit_measure": "2 tablas" },
  "Harina de trigo enriquecida (niños)": { "kcal": 66, "prot": 1.9, "grasa": 0.2, "gs": 0.03, "gm": 0.02, "gp": 0.07, "col": 0, "chos": 13.7, "fd": 0.5, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 18, "unit_measure": "3 cucharas soperas colmadas" },
  "Macarrones, cocidos (niños)": { "kcal": 63, "prot": 2.2, "grasa": 0.3, "gs": 0.05, "gm": 0.04, "gp": 0.12, "col": 0, "chos": 12.7, "fd": 0.6, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 45, "unit_measure": "1/2 pocillo chocolatero" },
  "Maicena (almidón de maíz) (niños)": { "kcal": 76, "prot": 0.1, "grasa": 0, "gs": 0, "gm": 0, "gp": 0.01, "col": 0, "chos": 18.3, "fd": 0.2, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 20, "unit_measure": "2 cucharas soperas colmadas" },
  "Maíz pira, crudo (niños)": { "kcal": 70, "prot": 1.8, "grasa": 0.8, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 15.1, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 21, "unit_measure": "1 cuchara sopera colmada" },
  "Maíz tierno o choclo, amarillo enlatado (niños)": { "kcal": 71, "prot": 2.3, "grasa": 0.9, "gs": 0.13, "gm": 0.26, "gp": 0.41, "col": 0, "chos": 16.4, "fd": 1.8, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 88, "unit_measure": "6 cucharas soperas" },
  "Mazamorra Antioqueña (maíz cocido) (niños)": { "kcal": 86, "prot": 2.6, "grasa": 1.0, "gs": 0.16, "gm": 0.30, "gp": 0.48, "col": 0, "chos": 20.1, "fd": 2.2, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 80, "unit_measure": "4 cucharas soperas altas" },
  "Palitos o palitroques (niños)": { "kcal": 66, "prot": 1.9, "grasa": 1.5, "gs": 0.23, "gm": 0.57, "gp": 0.58, "col": 0, "chos": 10.9, "fd": 0.5, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 16, "unit_measure": "1 unidad" },
  "Pan blanco (niños)": { "kcal": 59, "prot": 1.8, "grasa": 0.8, "gs": 0.18, "gm": 0.35, "gp": 0.16, "col": 0, "chos": 10.9, "fd": 0.5, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 22, "unit_measure": "1 tajada delgada" },
  "Pan centeno (niños)": { "kcal": 70, "prot": 2.3, "grasa": 0.9, "gs": 0.17, "gm": 0.35, "gp": 0.22, "col": 0, "chos": 13.0, "fd": 1.6, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 27, "unit_measure": "1 tajada delgada" },
  "Pan de salvado de avena (niños)": { "kcal": 71, "prot": 3.1, "grasa": 1.3, "gs": 0.21, "gm": 0.48, "gp": 0.51, "col": 0, "chos": 11.9, "fd": 1.4, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 30, "unit_measure": "1 tajada delgada" },
  "Pan integral (niños)": { "kcal": 79, "prot": 3.1, "grasa": 1.3, "gs": 0.29, "gm": 0.54, "gp": 0.32, "col": 0, "chos": 14.8, "fd": 2.2, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 32, "unit_measure": "1 tajada mediana" },
  "Pan pita o árabe (niños)": { "kcal": 69, "prot": 2.3, "grasa": 0.3, "gs": 0.04, "gm": 0.03, "gp": 0.14, "col": 0, "chos": 13.9, "fd": 0.6, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 25, "unit_measure": "1/2 unidad pequeña" },
  "Pancake (mezcla preparada con leche entera) (niños)": { "kcal": 68, "prot": 1.9, "grasa": 2.9, "gs": 0.64, "gm": 0.74, "gp": 1.34, "col": 18, "chos": 8.5, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 30, "unit_measure": "1 unidad pequeña" },
  "Pandequeso (niños)": { "kcal": 78, "prot": 2.9, "grasa": 2.0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 12.8, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 28, "unit_measure": "1 unidad pequeña" },
  "Pandeyuca (niños)": { "kcal": 69, "prot": 3.2, "grasa": 2.4, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 9.0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 20, "unit_measure": "2 unidades medianas" },
  "Pasta corta cocida (niños)": { "kcal": 71, "prot": 2.4, "grasa": 0.4, "gs": 0.05, "gm": 0.04, "gp": 0.14, "col": 0, "chos": 14.2, "fd": 0.9, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 50, "unit_measure": "1/2 pocillo chocolatero" },
  "Seba Seba (niños)": { "kcal": 70, "prot": 2.2, "grasa": 1.0, "gs": 0.21, "gm": 0.04, "gp": 0.02, "col": 0, "chos": 13.1, "fd": 0.6, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 24, "unit_measure": "3 unidades medianas" },
  "Taco vacío (niños)": { "kcal": 61, "prot": 0.9, "grasa": 2.9, "gs": 0.42, "gm": 1.16, "gp": 1.10, "col": 0, "chos": 8.1, "fd": 1.0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 13, "unit_measure": "1 unidad" },
  "Tortilla de maíz (niños)": { "kcal": 67, "prot": 1.7, "grasa": 0.8, "gs": 0.10, "gm": 0.20, "gp": 0.34, "col": 0, "chos": 14.0, "fd": 1.6, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 30, "unit_measure": "1 unidad pequeña" },
  "Tostada o calado (niños)": { "kcal": 73, "prot": 2.3, "grasa": 1.0, "gs": 0.22, "gm": 0.44, "gp": 0.21, "col": 0, "chos": 13.6, "fd": 0.6, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 25, "unit_measure": "1 unidad pequeña" },
  "Zucaritas (niños)": { "kcal": 84, "prot": 1.1, "grasa": 0.1, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 19.9, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 22, "unit_measure": "1/3 pocillo chocolatero" },
  "Cereales niños y niñas": {
    "kcal": 70, "prot": 1.9, "grasa": 0.9, "gs": 0.16, "gm": 0.27, "gp": 0.27, "col": 1, "chos": 13.8, "fd": 0.8,
    "calcio": 0, "p": 0, "fe": 0
  },
  "Aceite de ajonjolí": { "kcal": 44, "prot": 0, "grasa": 5.0, "gs": 0.71, "gm": 1.99, "gp": 2.09, "col": 0, "chos": 0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 5, "unit_measure": "1 cuchara tintera" },
  "Aceite de girasol": { "kcal": 44, "prot": 0, "grasa": 5.0, "gs": 0.52, "gm": 0.98, "gp": 3.29, "col": 0, "chos": 0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 5, "unit_measure": "1 cuchara sopera" },
  "Aceite de maíz": { "kcal": 44, "prot": 0, "grasa": 5.0, "gs": 0.64, "gm": 1.21, "gp": 2.94, "col": 0, "chos": 0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 5, "unit_measure": "1 cuchara sopera" },
  "Aceite de soya": { "kcal": 44, "prot": 0, "grasa": 5.0, "gs": 0.72, "gm": 1.17, "gp": 2.90, "col": 0, "chos": 0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 5, "unit_measure": "1 cuchara sopera" },
  "Mayonesa regular comercial": { "kcal": 43, "prot": 0.1, "grasa": 4.8, "gs": 0.71, "gm": 1.36, "gp": 2.48, "col": 4, "chos": 0.2, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 6, "unit_measure": "1 cuchara dulcera rasa" },
  "Salsa Ranch": { "kcal": 44, "prot": 0, "grasa": 4.4, "gs": 0.51, "gm": 1.01, "gp": 2.82, "col": 1, "chos": 1.5, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 11, "unit_measure": "1 cuchara sopera colmada" },
  "Salsa Tartara": { "kcal": 48, "prot": 0, "grasa": 4.8, "gs": 0.80, "gm": 1.20, "gp": 2.80, "col": 4, "chos": 1.6, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 12, "unit_measure": "1 cuchara sopera colmada" },
  "Vinagreta con grasa (Aderezos)": { "kcal": 45, "prot": 0, "grasa": 5.0, "gs": 0.91, "gm": 1.48, "gp": 2.41, "col": 0, "chos": 0.3, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 10, "unit_measure": "1 cuchara sopera" },
  "Aceite de aguacate": { "kcal": 44, "prot": 0.0, "grasa": 5.0, "gs": 0.50, "gm": 3.50, "gp": 0.60, "col": 0, "chos": 0.0, "fd": 0.0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 5, "unit_measure": "1 cuchara sopera" },
  "Aceite de canola": { "kcal": 44, "prot": 0.0, "grasa": 5.0, "gs": 0.36, "gm": 2.95, "gp": 1.48, "col": 0, "chos": 0.0, "fd": 0.0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 5, "unit_measure": "2 cucharas soperas" },
  "Aceite de oliva": { "kcal": 44, "prot": 0.0, "grasa": 5.0, "gs": 0.68, "gm": 3.69, "gp": 0.42, "col": 0, "chos": 0.0, "fd": 0.0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 5, "unit_measure": "1 cuchara sopera" },
  "Aceitunas deshuesadas": { "kcal": 46, "prot": 0.3, "grasa": 4.3, "gs": 0.57, "gm": 3.16, "gp": 0.36, "col": 0, "chos": 2.5, "fd": 1.3, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 40, "unit_measure": "12 unidades medianas" },
  "Aguacate común": { "kcal": 48, "prot": 0.6, "grasa": 4.6, "gs": 0.73, "gm": 2.88, "gp": 0.59, "col": 0, "chos": 2.2, "fd": 1.5, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 30, "unit_measure": "1/8 unidad mediana" },
  "Aguacate Hass": { "kcal": 48, "prot": 0.6, "grasa": 4.6, "gs": 0.73, "gm": 2.88, "gp": 0.59, "col": 0, "chos": 2.2, "fd": 1.5, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 30, "unit_measure": "1/4 unidad mediana" },
  "Mantequilla de Maní": { "kcal": 45, "prot": 2.2, "grasa": 3.2, "gs": 0.64, "gm": 1.60, "gp": 0.90, "col": 0, "chos": 2.6, "fd": 0.3, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 8, "unit_measure": "1 cuchara dulcera colmada" },
  "Margarinas suaves, sin sal": { "kcal": 43, "prot": 0.0, "grasa": 4.8, "gs": 0.83, "gm": 2.24, "gp": 1.54, "col": 0, "chos": 0.1, "fd": 0.0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 6, "unit_measure": "2 cucharas dulceras rasas" },
  "Salsa Pesto": { "kcal": 52, "prot": 0.5, "grasa": 5.0, "gs": 0.68, "gm": 3.68, "gp": 0.42, "col": 0, "chos": 0.7, "fd": 0.2, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 10, "unit_measure": "1 cuchara sopera colmada" },
  "Grasas monoinsaturadas": {
    "kcal": 46, "prot": 0.5, "grasa": 4.6, "gs": 0.63, "gm": 2.95, "gp": 0.77, "col": 0, "chos": 1.1, "fd": 0.5,
    "calcio": 0, "p": 0, "fe": 0
  },
  "Aceite de palma": { "kcal": 44, "prot": 0, "grasa": 5.0, "gs": 2.47, "gm": 1.90, "gp": 0.55, "col": 0, "chos": 0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 5, "unit_measure": "1 cuchara tintera" },
  "Crema agria": { "kcal": 52, "prot": 0.6, "grasa": 5.2, "gs": 3.39, "gm": 1.45, "gp": 0.22, "col": 11, "chos": 0.9, "fd": 0, "calcio": 14, "p": 15, "fe": 0, "portion_grams": 30, "unit_measure": "2 cucharadas soperas" },
  "Crema de leche líquida, espesa entera": { "kcal": 49, "prot": 0.4, "grasa": 5.0, "gs": 2.99, "gm": 1.50, "gp": 0.18, "col": 18, "chos": 0.4, "fd": 0, "calcio": 13, "p": 11, "fe": 0, "portion_grams": 15, "unit_measure": "1 cuchara sopera" },
  "Manteca de cerdo": { "kcal": 45, "prot": 0, "grasa": 5.0, "gs": 1.96, "gm": 2.28, "gp": 0.55, "col": 5, "chos": 0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 5, "unit_measure": "1 cuchara tintera" },
  "Mantequilla sin sal": { "kcal": 45, "prot": 0, "grasa": 5.0, "gs": 2.52, "gm": 1.33, "gp": 0.18, "col": 13, "chos": 0, "fd": 0, "calcio": 1, "p": 2, "fe": 0, "portion_grams": 5, "unit_measure": "1 cuchara tintera" },
  "Queso crema": { "kcal": 51, "prot": 0.9, "grasa": 5.0, "gs": 2.64, "gm": 1.43, "gp": 0.14, "col": 16, "chos": 0.2, "fd": 0, "calcio": 12, "p": 20, "fe": 0, "portion_grams": 15, "unit_measure": "1 cuchara sopera colmada" },
  "Grasas poliinsaturadas": {
    "kcal": 45, "prot": 0, "grasa": 4.9, "gs": 0.69, "gm": 1.30, "gp": 2.71, "col": 1, "chos": 0.4, "fd": 0,
    "calcio": 0, "p": 0, "fe": 0
  },
  "Cereales menores de 2 años": {
    "kcal": 41,
    "prot": 1.3,
    "grasa": 0.6,
    "gs": 0.13,
    "gm": 0.18,
    "gp": 0.21,
    "col": 1,
    "chos": 7.6,
    "fd": 0.5,
    "calcio": 13,
    "p": 23,
    "fe": 0.3,
    "na": 43,
    "k": 24,
    "mg": 6,
    "zn": 0.14,
    "cu": 0.02,
  },
  "Cereales niños": {
    "kcal": 74,
    "prot": 2,
    "grasa": 0.8,
    "gs": 0.2,
    "gm": 0.26,
    "gp": 0.27,
    "col": 1,
    "chos": 14.7,
    "fd": 0.9,
    "calcio": 18,
    "p": 38,
    "fe": 0.8,
    "na": 75,
    "k": 37,
    "mg": 10,
    "zn": 0.36,
    "cu": 0.04,
  },
  "Banano común": { "kcal": 90, "prot": 1.1, "grasa": 0.3, "gs": 0.11, "gm": 0.03, "gp": 0.07, "col": 0, "chos": 23.0, "fd": 2.6, "calcio": 5, "p": 22, "fe": 0.3, "portion_grams": 118, "unit_measure": "1 unidad mediana" },
  "Borojó": { "kcal": 65, "prot": 1.2, "grasa": 0.2, "gs": 0.05, "gm": 0.05, "gp": 0.08, "col": 0, "chos": 15.0, "fd": 2.0, "calcio": 18, "p": 25, "fe": 0.5, "portion_grams": 100, "unit_measure": "1/2 unidad" },
  "Chirimoya": { "kcal": 75, "prot": 1.6, "grasa": 0.7, "gs": 0.11, "gm": 0.19, "gp": 0.27, "col": 0, "chos": 18.0, "fd": 3.0, "calcio": 10, "p": 27, "fe": 0.3, "portion_grams": 120, "unit_measure": "1/2 unidad mediana" },
  "Chontaduro": { "kcal": 186, "prot": 2.3, "grasa": 12.5, "gs": 5.0, "gm": 4.5, "gp": 2.0, "col": 0, "chos": 18.0, "fd": 2.5, "calcio": 19, "p": 88, "fe": 0.5, "portion_grams": 100, "unit_measure": "2 unidades medianas" },
  "Ciruela claudia": { "kcal": 46, "prot": 0.7, "grasa": 0.3, "gs": 0.02, "gm": 0.13, "gp": 0.04, "col": 0, "chos": 11.4, "fd": 1.4, "calcio": 6, "p": 16, "fe": 0.2, "portion_grams": 66, "unit_measure": "2 unidades" },
  "Ciruela común": { "kcal": 46, "prot": 0.7, "grasa": 0.3, "gs": 0.02, "gm": 0.13, "gp": 0.04, "col": 0, "chos": 11.4, "fd": 1.4, "calcio": 6, "p": 16, "fe": 0.2, "portion_grams": 66, "unit_measure": "2 unidades" },
  "Curuba": { "kcal": 29, "prot": 0.4, "grasa": 0.1, "gs": 0.02, "gm": 0.01, "gp": 0.05, "col": 0, "chos": 7.1, "fd": 0.3, "calcio": 2, "p": 12, "fe": 0.2, "portion_grams": 100, "unit_measure": "1 unidad mediana" },
  "Feijoa": { "kcal": 55, "prot": 1.2, "grasa": 0.4, "gs": 0.09, "gm": 0.05, "gp": 0.16, "col": 0, "chos": 13.0, "fd": 6.4, "calcio": 17, "p": 19, "fe": 0.3, "portion_grams": 100, "unit_measure": "2-3 unidades" },
  "Fresas": { "kcal": 32, "prot": 0.7, "grasa": 0.3, "gs": 0.02, "gm": 0.04, "gp": 0.16, "col": 0, "chos": 7.7, "fd": 2.0, "calcio": 16, "p": 24, "fe": 0.4, "portion_grams": 150, "unit_measure": "12 unidades medianas" },
  "Granadilla": { "kcal": 97, "prot": 2.2, "grasa": 0.7, "gs": 0.06, "gm": 0.09, "gp": 0.41, "col": 0, "chos": 23.4, "fd": 10.4, "calcio": 12, "p": 68, "fe": 1.6, "portion_grams": 100, "unit_measure": "1 unidad grande" },
  "Guanabana": { "kcal": 66, "prot": 1.0, "grasa": 0.3, "gs": 0.05, "gm": 0.09, "gp": 0.09, "col": 0, "chos": 16.8, "fd": 3.3, "calcio": 14, "p": 27, "fe": 0.6, "portion_grams": 100, "unit_measure": "1/2 taza pulpa" },
  "Guayaba criolla": { "kcal": 68, "prot": 2.6, "grasa": 1.0, "gs": 0.27, "gm": 0.09, "gp": 0.40, "col": 0, "chos": 14.3, "fd": 5.4, "calcio": 18, "p": 40, "fe": 0.3, "portion_grams": 100, "unit_measure": "1 unidad mediana" },
  "Guayaba manzana": { "kcal": 68, "prot": 2.6, "grasa": 1.0, "gs": 0.27, "gm": 0.09, "gp": 0.40, "col": 0, "chos": 14.3, "fd": 5.4, "calcio": 18, "p": 40, "fe": 0.3, "portion_grams": 100, "unit_measure": "1 unidad mediana" },
  "Higo": { "kcal": 74, "prot": 0.8, "grasa": 0.3, "gs": 0.06, "gm": 0.07, "gp": 0.14, "col": 0, "chos": 19.2, "fd": 2.9, "calcio": 35, "p": 14, "fe": 0.4, "portion_grams": 50, "unit_measure": "1 unidad grande" },
  "Kiwi": { "kcal": 61, "prot": 1.1, "grasa": 0.5, "gs": 0.03, "gm": 0.05, "gp": 0.29, "col": 0, "chos": 14.7, "fd": 3.0, "calcio": 34, "p": 34, "fe": 0.3, "portion_grams": 69, "unit_measure": "1 unidad mediana" },
  "Lulo": { "kcal": 25, "prot": 0.4, "grasa": 0.1, "gs": 0.02, "gm": 0.01, "gp": 0.05, "col": 0, "chos": 6.0, "fd": 0.3, "calcio": 4, "p": 12, "fe": 0.2, "portion_grams": 100, "unit_measure": "1 unidad" },
  "Lulo jugo": { "kcal": 25, "prot": 0.4, "grasa": 0.1, "gs": 0.02, "gm": 0.01, "gp": 0.05, "col": 0, "chos": 6.0, "fd": 0.0, "calcio": 4, "p": 12, "fe": 0.2, "portion_grams": 120, "unit_measure": "1 vaso" },
  "Mango": { "kcal": 60, "prot": 0.8, "grasa": 0.4, "gs": 0.09, "gm": 0.14, "gp": 0.07, "col": 0, "chos": 15.0, "fd": 1.6, "calcio": 11, "p": 14, "fe": 0.2, "portion_grams": 165, "unit_measure": "1/2 unidad mediana" },
  "Manzana con cascara toda variedad": { "kcal": 52, "prot": 0.3, "grasa": 0.2, "gs": 0.03, "gm": 0.01, "gp": 0.05, "col": 0, "chos": 13.8, "fd": 2.4, "calcio": 6, "p": 11, "fe": 0.1, "portion_grams": 182, "unit_measure": "1 unidad mediana" },
  "Maracuyá": { "kcal": 97, "prot": 2.2, "grasa": 0.7, "gs": 0.06, "gm": 0.09, "gp": 0.41, "col": 0, "chos": 23.4, "fd": 10.4, "calcio": 12, "p": 68, "fe": 1.6, "portion_grams": 100, "unit_measure": "2 unidades" },
  "Melón": { "kcal": 34, "prot": 0.8, "grasa": 0.2, "gs": 0.05, "gm": 0.0, "gp": 0.06, "col": 0, "chos": 8.2, "fd": 0.9, "calcio": 9, "p": 15, "fe": 0.2, "portion_grams": 156, "unit_measure": "1 tajada mediana" },
  "Mora": { "kcal": 43, "prot": 1.4, "grasa": 0.5, "gs": 0.01, "gm": 0.05, "gp": 0.28, "col": 0, "chos": 9.6, "fd": 5.3, "calcio": 29, "p": 22, "fe": 0.6, "portion_grams": 100, "unit_measure": "1 pocillo" },
  "Murrapo": { "kcal": 89, "prot": 1.1, "grasa": 0.3, "gs": 0.11, "gm": 0.03, "gp": 0.07, "col": 0, "chos": 22.8, "fd": 2.6, "calcio": 5, "p": 22, "fe": 0.3, "portion_grams": 118, "unit_measure": "1 unidad mediana" },
  "Naranja": { "kcal": 47, "prot": 0.9, "grasa": 0.1, "gs": 0.02, "gm": 0.02, "gp": 0.02, "col": 0, "chos": 11.8, "fd": 2.4, "calcio": 40, "p": 18, "fe": 0.1, "portion_grams": 131, "unit_measure": "1 unidad mediana" },
  "Naranja orlando": { "kcal": 47, "prot": 0.9, "grasa": 0.1, "gs": 0.02, "gm": 0.02, "gp": 0.02, "col": 0, "chos": 11.8, "fd": 2.4, "calcio": 40, "p": 18, "fe": 0.1, "portion_grams": 131, "unit_measure": "1 unidad mediana" },
  "Naranja tangelo": { "kcal": 47, "prot": 0.9, "grasa": 0.1, "gs": 0.02, "gm": 0.02, "gp": 0.02, "col": 0, "chos": 11.8, "fd": 2.4, "calcio": 40, "p": 18, "fe": 0.1, "portion_grams": 131, "unit_measure": "1 unidad mediana" },
  "Naranja valencia": { "kcal": 47, "prot": 0.9, "grasa": 0.1, "gs": 0.02, "gm": 0.02, "gp": 0.02, "col": 0, "chos": 11.8, "fd": 2.4, "calcio": 40, "p": 18, "fe": 0.1, "portion_grams": 131, "unit_measure": "1 unidad mediana" },
  "Papaya": { "kcal": 43, "prot": 0.5, "grasa": 0.3, "gs": 0.08, "gm": 0.08, "gp": 0.06, "col": 0, "chos": 10.8, "fd": 1.7, "calcio": 20, "p": 10, "fe": 0.3, "portion_grams": 140, "unit_measure": "1 taza cubos" },
  "Papayuela": { "kcal": 39, "prot": 0.6, "grasa": 0.1, "gs": 0.03, "gm": 0.02, "gp": 0.04, "col": 0, "chos": 9.5, "fd": 1.8, "calcio": 24, "p": 14, "fe": 0.2, "portion_grams": 100, "unit_measure": "1 unidad mediana" },
  "Pera": { "kcal": 57, "prot": 0.4, "grasa": 0.1, "gs": 0.02, "gm": 0.08, "gp": 0.02, "col": 0, "chos": 15.2, "fd": 3.1, "calcio": 9, "p": 12, "fe": 0.2, "portion_grams": 178, "unit_measure": "1 unidad mediana" },
  "Piña manzana": { "kcal": 50, "prot": 0.5, "grasa": 0.1, "gs": 0.01, "gm": 0.01, "gp": 0.04, "col": 0, "chos": 13.1, "fd": 1.4, "calcio": 13, "p": 8, "fe": 0.3, "portion_grams": 112, "unit_measure": "1 tajada mediana" },
  "Pitahaya": { "kcal": 51, "prot": 1.1, "grasa": 0.4, "gs": 0.0, "gm": 0.0, "gp": 0.19, "col": 0, "chos": 11.0, "fd": 3.0, "calcio": 10, "p": 27, "fe": 0.4, "portion_grams": 100, "unit_measure": "1 unidad mediana" },
  "Sandia Baby": { "kcal": 30, "prot": 0.6, "grasa": 0.2, "gs": 0.02, "gm": 0.04, "gp": 0.05, "col": 0, "chos": 7.6, "fd": 0.4, "calcio": 7, "p": 11, "fe": 0.2, "portion_grams": 154, "unit_measure": "1 tajada" },
  "Tomate árbol común": { "kcal": 49, "prot": 1.0, "grasa": 0.4, "gs": 0.05, "gm": 0.05, "gp": 0.21, "col": 0, "chos": 11.4, "fd": 1.6, "calcio": 5, "p": 26, "fe": 0.4, "portion_grams": 100, "unit_measure": "1 unidad mediana" },
  "Tomate árbol rojo": { "kcal": 49, "prot": 1.0, "grasa": 0.4, "gs": 0.05, "gm": 0.05, "gp": 0.21, "col": 0, "chos": 11.4, "fd": 1.6, "calcio": 5, "p": 26, "fe": 0.4, "portion_grams": 100, "unit_measure": "1 unidad mediana" },
  "Uchuva": { "kcal": 53, "prot": 2.0, "grasa": 0.7, "gs": 0.02, "gm": 0.09, "gp": 0.40, "col": 0, "chos": 11.2, "fd": 4.9, "calcio": 5, "p": 40, "fe": 1.0, "portion_grams": 100, "unit_measure": "1 pocillo" },
  "Zapote sin semilla": { "kcal": 134, "prot": 2.1, "grasa": 0.6, "gs": 0.17, "gm": 0.15, "gp": 0.18, "col": 0, "chos": 32.0, "fd": 2.3, "calcio": 18, "p": 12, "fe": 0.6, "portion_grams": 100, "unit_measure": "1/2 unidad" },
  "Frutas adultos y niños": {
    "kcal": 59.9,
    "prot": 1,
    "grasa": 0.3,
    "gs": 0.06,
    "gm": 0.09,
    "gp": 0.11,
    "col": 0,
    "chos": 13.3,
    "fd": 2.6,
    "calcio": 21,
    "p": 24,
    "fe": 0.5,
    "na": 4,
    "k": 244,
    "mg": 19,
    "zn": 0.14,
    "cu": 0.07,
  },
  "Frutas menores de 2 años": {
    "kcal": 23.7,
    "prot": 0.3,
    "grasa": 0.1,
    "gs": 0.03,
    "gm": 0.02,
    "gp": 0.05,
    "col": 0,
    "chos": 5.4,
    "fd": 1,
    "calcio": 7,
    "p": 7,
    "fe": 0.1,
    "na": 1,
    "k": 99,
    "mg": 6,
    "zn": 0.05,
    "cu": 0.03,
  },
  "Grasas monoinsaturadas adultos y niños": {
    "kcal": 47,
    "prot": 0.4,
    "grasa": 4.6,
    "gs": 0.66,
    "gm": 2.7,
    "gp": 0.96,
    "col": 0,
    "chos": 1,
    "fd": 0.6,
    "calcio": 7,
    "p": 7,
    "fe": 0.2,
    "na": 55,
    "k": 49,
    "mg": 5,
    "zn": 0.07,
    "cu": 0.03,
  },
  "Grasas monoinsaturadas menores de 2 años": {
    "kcal": 27.5,
    "prot": 0.3,
    "grasa": 2.7,
    "gs": 0.37,
    "gm": 1.72,
    "gp": 0.46,
    "col": 0,
    "chos": 0.5,
    "fd": 0.3,
    "calcio": 1,
    "p": 5,
    "fe": 0.1,
    "na": 4,
    "k": 38,
    "mg": 3,
    "zn": 0.04,
    "cu": 0.02,
  },
  "Grasas poliinsaturadas adultos y niños": {
    "kcal": 41.7,
    "prot": 0,
    "grasa": 4.5,
    "gs": 0.67,
    "gm": 1.39,
    "gp": 2.71,
    "col": 1,
    "chos": 0.3,
    "fd": 0,
    "calcio": 1,
    "p": 1,
    "fe": 0,
    "na": 27,
    "k": 2,
    "mg": 0,
    "zn": 0.01,
    "cu": 0,
  },
  "Grasas poliinsaturadas menores de 2 años": {
    "kcal": 27,
    "prot": 0,
    "grasa": 3,
    "gs": 0.39,
    "gm": 0.8,
    "gp": 1.68,
    "col": 0,
    "chos": 0,
    "fd": 0,
    "calcio": 0,
    "p": 0,
    "fe": 0,
    "na": 0,
    "k": 0,
    "mg": 0,
    "zn": 0,
    "cu": 0,
  },
  "Grasas saturadas adultos y niños": {
    "kcal": 45.6,
    "prot": 0.3,
    "grasa": 4.8,
    "gs": 2.66,
    "gm": 1.57,
    "gp": 0.28,
    "col": 10,
    "chos": 0.3,
    "fd": 0,
    "calcio": 8,
    "p": 7,
    "fe": 0,
    "na": 9,
    "k": 10,
    "mg": 1,
    "zn": 0.03,
    "cu": 0,
  },
  "Grasas saturadas menores de 2 años": {
    "kcal": 26.8,
    "prot": 0.2,
    "grasa": 2.8,
    "gs": 1.66,
    "gm": 0.85,
    "gp": 0.14,
    "col": 6,
    "chos": 0.2,
    "fd": 0,
    "calcio": 5,
    "p": 5,
    "fe": 0,
    "na": 6,
    "k": 7,
    "mg": 1,
    "zn": 0.02,
    "cu": 0,
  },
  "Huevo menores de 2 años": {
    "kcal": 52.9,
    "prot": 4.5,
    "grasa": 3.7,
    "gs": 1.15,
    "gm": 1.42,
    "gp": 0.49,
    "col": 180,
    "chos": 0.4,
    "fd": 0,
    "calcio": 19,
    "p": 64,
    "fe": 0.6,
    "na": 46,
    "k": 46,
    "mg": 4,
    "zn": 0.4,
    "cu": 0.01,
  },
  "Leche materna toma/100ml": {
    "kcal": 71.2,
    "prot": 1,
    "grasa": 4.4,
    "gs": 2.01,
    "gm": 1.66,
    "gp": 0.5,
    "col": 14,
    "chos": 6.9,
    "fd": 0,
    "calcio": 32,
    "p": 14,
    "fe": 0,
    "na": 17,
    "k": 51,
    "mg": 3,
    "zn": 0.17,
    "cu": 0.05,
  },
  /** Promedio del grupo Leches descremadas (sin porción) */
  "Leches descremadas frescas y fermentadas": {
    "kcal": 82.3,
    "prot": 9,
    "grasa": 0.7,
    "gs": 0.45,
    "gm": 0.18,
    "gp": 0.03,
    "col": 6,
    "chos": 10,
    "fd": 0,
    "calcio": 256,
    "p": 214,
    "fe": 0.1,
    "na": 101,
    "k": 340,
    "mg": 24,
    "zn": 1.05,
    "cu": 0.02,
  },
  "Leche de vaca descremada en polvo": {
    "kcal": 76,
    "prot": 7.6,
    "grasa": 0.2,
    "gs": 0.11,
    "gm": 0.04,
    "gp": 0.01,
    "col": 4.0,
    "chos": 10.9,
    "fd": 0.0,
    "calcio": 256.0,
    "p": 214.0,
    "fe": 0.1,
    "na": 101.0,
    "k": 340.0,
    "mg": 24.0,
    "zn": 1.05,
    "cu": 0.02,
    "portion_grams": 21,
    "unit_measure": "4 cucharas soperas colmadas"
  },
  "Leche de vaca descremada pasteurizada": {
    "kcal": 70,
    "prot": 6.8,
    "grasa": 0.4,
    "gs": 0.24,
    "gm": 0.1,
    "gp": 0.02,
    "col": 4.0,
    "chos": 9.8,
    "fd": 0.0,
    "calcio": 256.0,
    "p": 214.0,
    "fe": 0.1,
    "na": 101.0,
    "k": 340.0,
    "mg": 24.0,
    "zn": 1.05,
    "cu": 0.02,
    "portion_grams": 200,
    "unit_measure": "1 vaso pequeño"
  },
  "Yogurt de leche descremada": {
    "kcal": 90,
    "prot": 6.0,
    "grasa": 0.0,
    "gs": 0.0,
    "gm": 0.0,
    "gp": 0.0,
    "col": 5.0,
    "chos": 14.5,
    "fd": 0.0,
    "calcio": 256.0,
    "p": 214.0,
    "fe": 0.1,
    "na": 101.0,
    "k": 340.0,
    "mg": 24.0,
    "zn": 1.05,
    "cu": 0.02,
    "portion_grams": 200,
    "unit_measure": "1 vaso pequeño"
  },
  "Yogurt Griego natural": {
    "kcal": 60,
    "prot": 5.0,
    "grasa": 0.0,
    "gs": 0.0,
    "gm": 0.0,
    "gp": 0.0,
    "col": 5.0,
    "chos": 10.0,
    "fd": 0.0,
    "calcio": 256.0,
    "p": 214.0,
    "fe": 0.1,
    "na": 101.0,
    "k": 340.0,
    "mg": 24.0,
    "zn": 1.05,
    "cu": 0.02,
    "portion_grams": 100,
    "unit_measure": "1 vaso pequeño"
  },
  /** Promedio del grupo (sin porción) */
  "Leches enteras frescas y fermentadas": {
    "kcal": 139.1,
    "prot": 6.7,
    "grasa": 6.7,
    "gs": 4.4,
    "gm": 1.95,
    "gp": 0.49,
    "col": 26,
    "chos": 13,
    "fd": 0,
    "calcio": 236,
    "p": 173,
    "fe": 0.2,
    "na": 96,
    "k": 330,
    "mg": 25,
    "zn": 0.89,
    "cu": 0.03,
  },
  "Kamis de leche entera": {
    "kcal": 153,
    "prot": 7.0,
    "grasa": 5.0,
    "gs": 2.0,
    "gm": 0,
    "gp": 0,
    "col": 20.0,
    "chos": 21.3,
    "fd": 0.0,
    "calcio": 212.0,
    "p": 112.0,
    "fe": 0.2,
    "na": 96.0,
    "k": 330.0,
    "mg": 25.0,
    "zn": 0.89,
    "cu": 0.03,
    "portion_grams": 200,
    "unit_measure": "1 vaso pequeño"
  },
  "Leche de cabra cruda": {
    "kcal": 138,
    "prot": 7.2,
    "grasa": 8.2,
    "gs": 5.34,
    "gm": 2.22,
    "gp": 0.3,
    "col": 22.0,
    "chos": 9.0,
    "fd": 0.0,
    "calcio": 268.0,
    "p": 222.0,
    "fe": 0.2,
    "na": 96.0,
    "k": 330.0,
    "mg": 25.0,
    "zn": 0.89,
    "cu": 0.03,
    "portion_grams": 200,
    "unit_measure": "1 vaso pequeño"
  },
  "Leche de vaca entera cruda": {
    "kcal": 120,
    "prot": 6.8,
    "grasa": 6.6,
    "gs": 0,
    "gm": 0,
    "gp": 0,
    "col": 0,
    "chos": 9.2,
    "fd": 0.0,
    "calcio": 240.0,
    "p": 190.0,
    "fe": 0.4,
    "na": 96.0,
    "k": 330.0,
    "mg": 25.0,
    "zn": 0.89,
    "cu": 0.03,
    "portion_grams": 200,
    "unit_measure": "1 vaso pequeño"
  },
  "Leche de vaca entera en polvo": {
    "kcal": 129,
    "prot": 6.8,
    "grasa": 6.9,
    "gs": 4.35,
    "gm": 2.06,
    "gp": 0.17,
    "col": 25.0,
    "chos": 10.0,
    "fd": 0.0,
    "calcio": 237.0,
    "p": 202.0,
    "fe": 0.1,
    "na": 96.0,
    "k": 330.0,
    "mg": 25.0,
    "zn": 0.89,
    "cu": 0.03,
    "portion_grams": 26,
    "unit_measure": "3 cucharas soperas colmadas"
  },
  "Leche de vaca entera pasteurizada": {
    "kcal": 122,
    "prot": 6.6,
    "grasa": 6.6,
    "gs": 4.16,
    "gm": 1.94,
    "gp": 0.24,
    "col": 28.0,
    "chos": 9.4,
    "fd": 0.0,
    "calcio": 238.0,
    "p": 186.0,
    "fe": 0.2,
    "na": 96.0,
    "k": 330.0,
    "mg": 25.0,
    "zn": 0.89,
    "cu": 0.03,
    "portion_grams": 200,
    "unit_measure": "1 vaso pequeño"
  },
  "Yogurt regular de leche entera": {
    "kcal": 140,
    "prot": 6.0,
    "grasa": 4.0,
    "gs": 2.5,
    "gm": 1.78,
    "gp": 0.18,
    "col": 20.0,
    "chos": 21.0,
    "fd": 0.0,
    "calcio": 222.0,
    "p": 128.0,
    "fe": 0.3,
    "na": 96.0,
    "k": 330.0,
    "mg": 25.0,
    "zn": 0.89,
    "cu": 0.03,
    "portion_grams": 200,
    "unit_measure": "1 vaso pequeño"
  },
  /** Promedio del grupo (sin porción) */
  "Leches frescas y fermentadas enteras altas en calorías y azucares": {
    "kcal": 170.7,
    "prot": 6.4,
    "grasa": 5.9,
    "gs": 3.8,
    "gm": 1.91,
    "gp": 0.63,
    "col": 22,
    "chos": 23,
    "fd": 0.4,
    "calcio": 258,
    "p": 169,
    "fe": 0.3,
    "na": 115,
    "k": 334,
    "mg": 27,
    "zn": 1.03,
    "cu": 0.05,
  },
  "Avena con leche de vaca entera comercial": {
    "kcal": 185,
    "prot": 4.8,
    "grasa": 4.5,
    "gs": 2.6,
    "gm": 0,
    "gp": 0,
    "col": 13.0,
    "chos": 32.8,
    "fd": 1.3,
    "calcio": 0,
    "p": 0,
    "fe": 0,
    "na": 0,
    "k": 0,
    "mg": 0,
    "zn": 0,
    "cu": 0,
    "portion_grams": 250,
    "unit_measure": "1 vaso pequeño"
  },
  "Kumis de leche entera azucarado": {
    "kcal": 170,
    "prot": 5.6,
    "grasa": 5.7,
    "gs": 3.4,
    "gm": 0,
    "gp": 0,
    "col": 16.0,
    "chos": 24.0,
    "fd": 1.5,
    "calcio": 0,
    "p": 0,
    "fe": 0,
    "na": 0,
    "k": 0,
    "mg": 0,
    "zn": 0,
    "cu": 0,
    "portion_grams": 200,
    "unit_measure": "1 vaso pequeño"
  },
  "Leche de vaca entera chocolatada": {
    "kcal": 170,
    "prot": 6.0,
    "grasa": 5.4,
    "gs": 3.0,
    "gm": 2.1,
    "gp": 0.3,
    "col": 24.0,
    "chos": 24.5,
    "fd": 1.6,
    "calcio": 0,
    "p": 0,
    "fe": 0,
    "na": 0,
    "k": 0,
    "mg": 0,
    "zn": 0,
    "cu": 0,
    "portion_grams": 200,
    "unit_measure": "1 caja o vaso pequeños"
  },
  "Yogurt de leche entera azucarado": {
    "kcal": 190,
    "prot": 7.0,
    "grasa": 4.6,
    "gs": 2.6,
    "gm": 0,
    "gp": 0,
    "col": 15.0,
    "chos": 27.6,
    "fd": 2.0,
    "calcio": 0,
    "p": 0,
    "fe": 0,
    "na": 0,
    "k": 0,
    "mg": 0,
    "zn": 0,
    "cu": 0,
    "portion_grams": 200,
    "unit_measure": "1 vaso pequeño"
  },
  "Leches frescas, fermentadas y productos lácteos menores de 2 años": {
    "kcal": 50.7,
    "prot": 2.9,
    "grasa": 3.1,
    "gs": 2.01,
    "gm": 0.96,
    "gp": 0.18,
    "col": 12,
    "chos": 2.8,
    "fd": 0,
    "calcio": 93,
    "p": 62,
    "fe": 0.1,
    "na": 57,
    "k": 57,
    "mg": 6,
    "zn": 0.38,
    "cu": 0.01,
  },
  /** Promedio del grupo Leches semidescremadas (sin porción) */
  "Leches semidescremadas frescas y fermentadas": {
    "kcal": 94.5,
    "prot": 5.4,
    "grasa": 2.1,
    "gs": 0.87,
    "gm": 0.54,
    "gp": 0.35,
    "col": 5,
    "chos": 13.5,
    "fd": 0.8,
    "calcio": 153,
    "p": 143,
    "fe": 0.4,
    "na": 72,
    "k": 268,
    "mg": 25,
    "zn": 1.24,
    "cu": 0.06,
  },
  "Avena líquida con leche de vaca descremada": {
    "kcal": 110,
    "prot": 5.0,
    "grasa": 1.5,
    "gs": 0.5,
    "gm": 0,
    "gp": 0,
    "col": 5.0,
    "chos": 19.0,
    "fd": 1.0,
    "calcio": 0,
    "p": 0,
    "fe": 0,
    "na": 0,
    "k": 0,
    "mg": 0,
    "zn": 0,
    "cu": 0,
    "portion_grams": 250,
    "unit_measure": "1 vaso pequeño"
  },
  "Bebida de Soya comercial": {
    "kcal": 100,
    "prot": 7.6,
    "grasa": 2.3,
    "gs": 0.3,
    "gm": 0.66,
    "gp": 1.66,
    "col": 0,
    "chos": 14.3,
    "fd": 2.6,
    "calcio": 0,
    "p": 0,
    "fe": 0,
    "na": 0,
    "k": 0,
    "mg": 0,
    "zn": 0,
    "cu": 0,
    "portion_grams": 200,
    "unit_measure": "1 vaso pequeño"
  },
  "Leche de vaca semidescremada en polvo": {
    "kcal": 106,
    "prot": 7.0,
    "grasa": 3.3,
    "gs": 1.63,
    "gm": 0,
    "gp": 0,
    "col": 12.0,
    "chos": 12.2,
    "fd": 0.0,
    "calcio": 153.0,
    "p": 143.0,
    "fe": 0.4,
    "na": 72.0,
    "k": 268.0,
    "mg": 25.0,
    "zn": 1.24,
    "cu": 0.06,
    "portion_grams": 26,
    "unit_measure": "3 cucharas soperas colmadas"
  },
  "Leche de vaca semidescremada pasteurizada (con o sin lactosa)": {
    "kcal": 90,
    "prot": 6.0,
    "grasa": 3.0,
    "gs": 2.0,
    "gm": 1.12,
    "gp": 0.14,
    "col": 15.0,
    "chos": 10.0,
    "fd": 0.0,
    "calcio": 153.0,
    "p": 143.0,
    "fe": 0.4,
    "na": 72.0,
    "k": 268.0,
    "mg": 25.0,
    "zn": 1.24,
    "cu": 0.06,
    "portion_grams": 200,
    "unit_measure": "1 vaso pequeño"
  },
  "Yogurt de leche entera - Yox": {
    "kcal": 80,
    "prot": 3.0,
    "grasa": 2.0,
    "gs": 1.0,
    "gm": 0,
    "gp": 0,
    "col": 5.0,
    "chos": 14.0,
    "fd": 0.0,
    "calcio": 0,
    "p": 0,
    "fe": 0,
    "na": 0,
    "k": 0,
    "mg": 0,
    "zn": 0,
    "cu": 0,
    "portion_grams": 100,
    "unit_measure": "1 tarro pequeño"
  },
  "Yogurt de leche entera cuchareable": {
    "kcal": 115,
    "prot": 3.0,
    "grasa": 2.5,
    "gs": 1.5,
    "gm": 1.1,
    "gp": 0.1,
    "col": 9.0,
    "chos": 19.7,
    "fd": 1.1,
    "calcio": 0,
    "p": 0,
    "fe": 0,
    "na": 0,
    "k": 0,
    "mg": 0,
    "zn": 0,
    "cu": 0,
    "portion_grams": 140,
    "unit_measure": "1 vaso pequeño"
  },
  /** Promedio total del grupo (sin porción) */
  "Leguminosas adultos": {
    "kcal": 151,
    "prot": 9.0,
    "grasa": 1.8,
    "gs": 0.31,
    "gm": 0.35,
    "gp": 0.96,
    "col": 0,
    "chos": 24.6,
    "fd": 7.4,
    "calcio": 50,
    "p": 167,
    "fe": 3.1,
    "na": 10,
    "k": 534,
    "mg": 62,
    "zn": 1.22,
    "cu": 0.28,
  },
  "Arveja seca cocida": {
    "kcal": 132, "prot": 8.5, "grasa": 0.3, "gs": 0.06, "gm": 0.03, "gp": 0.16, "col": 0, "chos": 24.5, "fd": 8.6,
    "calcio": 50, "p": 167, "fe": 3.1, "na": 10, "k": 534, "mg": 62, "zn": 1.22, "cu": 0.28,
    "portion_grams": 157, "unit_measure": "1 cucharón colmado"
  },
  "Frijol blanquillo con guiso": {
    "kcal": 152, "prot": 9.0, "grasa": 1.1, "gs": 0.28, "gm": 0.17, "gp": 0.61, "col": 0, "chos": 26.2, "fd": 10.4,
    "calcio": 50, "p": 167, "fe": 3.1, "na": 10, "k": 534, "mg": 62, "zn": 1.22, "cu": 0.28,
    "portion_grams": 110, "unit_measure": "1 cucharón colmado"
  },
  "Frijol bola roja con plátano verde": {
    "kcal": 150, "prot": 8.6, "grasa": 1.1, "gs": 0.2, "gm": 0.18, "gp": 0.63, "col": 0, "chos": 26.4, "fd": 7.5,
    "calcio": 50, "p": 167, "fe": 3.1, "na": 10, "k": 534, "mg": 62, "zn": 1.22, "cu": 0.28,
    "portion_grams": 120, "unit_measure": "1 cucharón colmado"
  },
  "Frijol cabecita negra con guiso": {
    "kcal": 149, "prot": 9.1, "grasa": 1.2, "gs": 0.29, "gm": 0.18, "gp": 0.66, "col": 0, "chos": 25.1, "fd": 7.7,
    "calcio": 50, "p": 167, "fe": 3.1, "na": 10, "k": 534, "mg": 62, "zn": 1.22, "cu": 0.28,
    "portion_grams": 130, "unit_measure": "1 cucharón colmado"
  },
  "Frijol caraota con guiso": {
    "kcal": 149, "prot": 9.1, "grasa": 1.2, "gs": 0.29, "gm": 0.18, "gp": 0.66, "col": 0, "chos": 25.1, "fd": 7.7,
    "calcio": 50, "p": 167, "fe": 3.1, "na": 10, "k": 534, "mg": 62, "zn": 1.22, "cu": 0.28,
    "portion_grams": 130, "unit_measure": "1 cucharón colmado"
  },
  "Frijol cargamanto blanco con plátano verde": {
    "kcal": 146, "prot": 7.4, "grasa": 1.0, "gs": 0.21, "gm": 0.23, "gp": 0.5, "col": 0, "chos": 26.7, "fd": 7.9,
    "calcio": 50, "p": 167, "fe": 3.1, "na": 10, "k": 534, "mg": 62, "zn": 1.22, "cu": 0.28,
    "portion_grams": 110, "unit_measure": "1 cucharón colmado"
  },
  "Frijol cargamanto rosado con plátano verde": {
    "kcal": 157, "prot": 8.2, "grasa": 1.0, "gs": 0.23, "gm": 0.17, "gp": 0.52, "col": 0, "chos": 28.6, "fd": 5.0,
    "calcio": 50, "p": 167, "fe": 3.1, "na": 10, "k": 534, "mg": 62, "zn": 1.22, "cu": 0.28,
    "portion_grams": 110, "unit_measure": "1 cucharón colmado"
  },
  "Frijol nima con guiso": {
    "kcal": 149, "prot": 9.3, "grasa": 1.1, "gs": 0.24, "gm": 0.17, "gp": 0.59, "col": 0, "chos": 25.2, "fd": 8.3,
    "calcio": 50, "p": 167, "fe": 3.1, "na": 10, "k": 534, "mg": 62, "zn": 1.22, "cu": 0.28,
    "portion_grams": 130, "unit_measure": "1 cucharón colmado"
  },
  "Frijol verde con plátano verde": {
    "kcal": 150, "prot": 8.6, "grasa": 0.8, "gs": 0.16, "gm": 0.15, "gp": 0.54, "col": 0, "chos": 26.9, "fd": 4.9,
    "calcio": 50, "p": 167, "fe": 3.1, "na": 10, "k": 534, "mg": 62, "zn": 1.22, "cu": 0.28,
    "portion_grams": 100, "unit_measure": "1 cucharón colmado"
  },
  "Frijol zaragoza con guiso": {
    "kcal": 160, "prot": 8.1, "grasa": 2.8, "gs": 0.34, "gm": 0.62, "gp": 1.34, "col": 0, "chos": 25.3, "fd": 6.9,
    "calcio": 50, "p": 167, "fe": 3.1, "na": 10, "k": 534, "mg": 62, "zn": 1.22, "cu": 0.28,
    "portion_grams": 100, "unit_measure": "1 cucharón colmado"
  },
  "Garbanzo con guiso": {
    "kcal": 160, "prot": 8.1, "grasa": 2.8, "gs": 0.34, "gm": 0.62, "gp": 1.34, "col": 0, "chos": 25.3, "fd": 6.9,
    "calcio": 50, "p": 167, "fe": 3.1, "na": 10, "k": 534, "mg": 62, "zn": 1.22, "cu": 0.28,
    "portion_grams": 100, "unit_measure": "1 cucharón colmado"
  },
  "Lenteja con guiso": {
    "kcal": 152, "prot": 9.6, "grasa": 1.1, "gs": 0.19, "gm": 0.22, "gp": 0.58, "col": 0, "chos": 25.7, "fd": 8.6,
    "calcio": 50, "p": 167, "fe": 3.1, "na": 10, "k": 534, "mg": 62, "zn": 1.22, "cu": 0.28,
    "portion_grams": 130, "unit_measure": "1 cucharón colmado"
  },
  "Soya con guiso": {
    "kcal": 158, "prot": 13.5, "grasa": 7.7, "gs": 1.14, "gm": 1.69, "gp": 4.37, "col": 0, "chos": 8.6, "fd": 5.0,
    "calcio": 50, "p": 167, "fe": 3.1, "na": 10, "k": 534, "mg": 62, "zn": 1.22, "cu": 0.28,
    "portion_grams": 90, "unit_measure": "1 cucharón colmado"
  },
  "Leguminosas menores de 2 años": {
    "kcal": 41.5,
    "prot": 2.7,
    "grasa": 0.3,
    "gs": 0.03,
    "gm": 0.05,
    "gp": 0.14,
    "col": 0,
    "chos": 7,
    "fd": 2.2,
    "calcio": 9,
    "p": 48,
    "fe": 0.9,
    "na": 1,
    "k": 113,
    "mg": 13,
    "zn": 0.37,
    "cu": 0.08,
  },
  /** Promedio del grupo Leguminosas niños y niñas (sin porción) */
  "Leguminosas niños": {
    "kcal": 82,
    "prot": 4.9,
    "grasa": 1.0,
    "gs": 0.18,
    "gm": 0.20,
    "gp": 0.56,
    "col": 0,
    "chos": 13.3,
    "fd": 3.9,
    "calcio": 29,
    "p": 92,
    "fe": 1.7,
    "na": 6,
    "k": 290,
    "mg": 34,
    "zn": 0.65,
    "cu": 0.15,
  },
  "Frijol blanquillo con guiso (niños)": {
    "kcal": 83, "prot": 4.9, "grasa": 0.6, "gs": 0.15, "gm": 0.09, "gp": 0.33, "col": 0, "chos": 14.3, "fd": 5.7,
    "calcio": 29, "p": 92, "fe": 1.7, "na": 6, "k": 290, "mg": 34, "zn": 0.65, "cu": 0.15,
    "portion_grams": 60, "unit_measure": "1/2 cucharón"
  },
  "Frijol bola roja con plátano verde (niños)": {
    "kcal": 81, "prot": 4.6, "grasa": 0.6, "gs": 0.11, "gm": 0.10, "gp": 0.34, "col": 0, "chos": 14.3, "fd": 4.1,
    "calcio": 29, "p": 92, "fe": 1.7, "na": 6, "k": 290, "mg": 34, "zn": 0.65, "cu": 0.15,
    "portion_grams": 65, "unit_measure": "1/2 cucharón"
  },
  "Frijol cabecita negra con guiso (niños)": {
    "kcal": 80, "prot": 4.9, "grasa": 0.7, "gs": 0.16, "gm": 0.10, "gp": 0.35, "col": 0, "chos": 13.5, "fd": 4.2,
    "calcio": 29, "p": 92, "fe": 1.7, "na": 6, "k": 290, "mg": 34, "zn": 0.65, "cu": 0.15,
    "portion_grams": 70, "unit_measure": "1/2 cucharón"
  },
  "Frijol caraota con guiso (niños)": {
    "kcal": 80, "prot": 4.9, "grasa": 0.7, "gs": 0.16, "gm": 0.10, "gp": 0.35, "col": 0, "chos": 13.5, "fd": 4.2,
    "calcio": 29, "p": 92, "fe": 1.7, "na": 6, "k": 290, "mg": 34, "zn": 0.65, "cu": 0.15,
    "portion_grams": 70, "unit_measure": "1/2 cucharón"
  },
  "Frijol cargamanto blanco con plátano verde (niños)": {
    "kcal": 80, "prot": 4.0, "grasa": 0.6, "gs": 0.12, "gm": 0.12, "gp": 0.27, "col": 0, "chos": 14.6, "fd": 4.3,
    "calcio": 29, "p": 92, "fe": 1.7, "na": 6, "k": 290, "mg": 34, "zn": 0.65, "cu": 0.15,
    "portion_grams": 60, "unit_measure": "1/2 cucharón"
  },
  "Frijol cargamanto rosado con plátano verde (niños)": {
    "kcal": 86, "prot": 4.5, "grasa": 0.6, "gs": 0.13, "gm": 0.09, "gp": 0.28, "col": 0, "chos": 15.6, "fd": 2.7,
    "calcio": 29, "p": 92, "fe": 1.7, "na": 6, "k": 290, "mg": 34, "zn": 0.65, "cu": 0.15,
    "portion_grams": 60, "unit_measure": "1/2 cucharón"
  },
  "Frijol nima con guiso (niños)": {
    "kcal": 80, "prot": 5.0, "grasa": 0.6, "gs": 0.13, "gm": 0.09, "gp": 0.32, "col": 0, "chos": 13.6, "fd": 4.5,
    "calcio": 29, "p": 92, "fe": 1.7, "na": 6, "k": 290, "mg": 34, "zn": 0.65, "cu": 0.15,
    "portion_grams": 70, "unit_measure": "1/2 cucharón"
  },
  "Frijol verde con plátano verde (niños)": {
    "kcal": 90, "prot": 5.1, "grasa": 0.5, "gs": 0.09, "gm": 0.09, "gp": 0.32, "col": 0, "chos": 16.2, "fd": 2.9,
    "calcio": 29, "p": 92, "fe": 1.7, "na": 6, "k": 290, "mg": 34, "zn": 0.65, "cu": 0.15,
    "portion_grams": 60, "unit_measure": "1/2 cucharón"
  },
  "Frijol zaragoza con guiso (niños)": {
    "kcal": 80, "prot": 4.1, "grasa": 1.4, "gs": 0.17, "gm": 0.31, "gp": 0.67, "col": 0, "chos": 12.7, "fd": 3.5,
    "calcio": 29, "p": 92, "fe": 1.7, "na": 6, "k": 290, "mg": 34, "zn": 0.65, "cu": 0.15,
    "portion_grams": 50, "unit_measure": "1/2 cucharón"
  },
  "Garbanzo con guiso (niños)": {
    "kcal": 80, "prot": 4.1, "grasa": 1.4, "gs": 0.17, "gm": 0.31, "gp": 0.67, "col": 0, "chos": 12.7, "fd": 3.5,
    "calcio": 29, "p": 92, "fe": 1.7, "na": 6, "k": 290, "mg": 34, "zn": 0.65, "cu": 0.15,
    "portion_grams": 50, "unit_measure": "1/2 cucharón"
  },
  "Lenteja con guiso (niños)": {
    "kcal": 82, "prot": 5.2, "grasa": 0.6, "gs": 0.10, "gm": 0.12, "gp": 0.31, "col": 0, "chos": 13.9, "fd": 4.7,
    "calcio": 29, "p": 92, "fe": 1.7, "na": 6, "k": 290, "mg": 34, "zn": 0.65, "cu": 0.15,
    "portion_grams": 70, "unit_measure": "1/2 cucharón"
  },
  "Soya con guiso (niños)": {
    "kcal": 88, "prot": 7.5, "grasa": 4.3, "gs": 0.64, "gm": 0.94, "gp": 2.43, "col": 0, "chos": 4.8, "fd": 2.8,
    "calcio": 29, "p": 92, "fe": 1.7, "na": 6, "k": 290, "mg": 34, "zn": 0.65, "cu": 0.15,
    "portion_grams": 50, "unit_measure": "1/2 cucharón"
  },
  "Nueces adultos y niños": {
    "kcal": 56.4,
    "prot": 1.3,
    "grasa": 4.8,
    "gs": 1.15,
    "gm": 2.44,
    "gp": 0.99,
    "col": 0,
    "chos": 2,
    "fd": 0.7,
    "calcio": 8,
    "p": 34,
    "fe": 0.3,
    "na": 6,
    "k": 55,
    "mg": 16,
    "zn": 0.28,
    "cu": 0.1,
  },
  "Crema de leche Light": { "kcal": 45, "prot": 0, "grasa": 4.5, "gs": 2.70, "gm": 1.35, "gp": 0.41, "col": 81, "chos": 0, "fd": 0, "calcio": 14, "p": 12, "fe": 0, "portion_grams": 27, "unit_measure": "4 cucharadas soperas colmadas" },
  "Margarina line (reducida 25%)": { "kcal": 47, "prot": 0, "grasa": 5.3, "gs": 2.33, "gm": 1.33, "gp": 1.67, "col": 0, "chos": 0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 10, "unit_measure": "1 cuchara dulcera rasa" },
  "Mayonesa Ligth": { "kcal": 44, "prot": 0, "grasa": 4.4, "gs": 0.73, "gm": 0.73, "gp": 2.93, "col": 7, "chos": 0.4, "fd": 0, "calcio": 1, "p": 2, "fe": 0, "portion_grams": 22, "unit_measure": "2 cucharadas soperas altas" },
  "Queso crema light": { "kcal": 45, "prot": 3.6, "grasa": 3.6, "gs": 2.70, "gm": 0.72, "gp": 0.11, "col": 18, "chos": 0.2, "fd": 0, "calcio": 35, "p": 45, "fe": 0, "portion_grams": 27, "unit_measure": "1 cuchara sopera colmada" },
  "Salsa de queso Cheddar": { "kcal": 44, "prot": 0.9, "grasa": 3.5, "gs": 0.91, "gm": 0.90, "gp": 0.60, "col": 2, "chos": 1.1, "fd": 0, "calcio": 28, "p": 22, "fe": 0, "portion_grams": 26, "unit_measure": "1 cuchara sopera colmada" },
  "Productos con reducción de grasa adultos y niños": {
    "kcal": 39.3,
    "prot": 1.3,
    "grasa": 3.3,
    "gs": 1.16,
    "gm": 0.98,
    "gp": 0.89,
    "col": 6,
    "chos": 1.1,
    "fd": 0,
    "calcio": 16,
    "p": 37,
    "fe": 0,
    "na": 125,
    "k": 19,
    "mg": 2,
    "zn": 0.12,
    "cu": 0,
  },
  "Promedio grasas adultos y niños": {
    "kcal": 44.6,
    "prot": 0.3,
    "grasa": 4.6,
    "gs": 1.33,
    "gm": 1.88,
    "gp": 1.32,
    "col": 4,
    "chos": 0.5,
    "fd": 0.2,
    "calcio": 5,
    "p": 5,
    "fe": 0.1,
    "na": 30,
    "k": 20,
    "mg": 2,
    "zn": 0.04,
    "cu": 0.01,
  },
  "Promedio grasas menores de 2 años": {
    "kcal": 26.8,
    "prot": 0.2,
    "grasa": 2.8,
    "gs": 0.81,
    "gm": 1.12,
    "gp": 0.76,
    "col": 2,
    "chos": 0.2,
    "fd": 0.1,
    "calcio": 2,
    "p": 3,
    "fe": 0,
    "na": 3,
    "k": 15,
    "mg": 1,
    "zn": 0.02,
    "cu": 0.01,
  },
  "Promedio harinas adultos": {
    "kcal": 95.4,
    "prot": 2,
    "grasa": 0.6,
    "gs": 0.14,
    "gm": 0.16,
    "gp": 0.19,
    "col": 0,
    "chos": 20.5,
    "fd": 1.5,
    "calcio": 15,
    "p": 43,
    "fe": 0.7,
    "na": 46,
    "k": 214,
    "mg": 17,
    "zn": 0.33,
    "cu": 0.09,
  },
  "Promedio harinas menores de 2 años": {
    "kcal": 39.5,
    "prot": 0.9,
    "grasa": 0.3,
    "gs": 0.08,
    "gm": 0.09,
    "gp": 0.11,
    "col": 0,
    "chos": 8.3,
    "fd": 0.6,
    "calcio": 8,
    "p": 18,
    "fe": 0.2,
    "na": 23,
    "k": 89,
    "mg": 7,
    "zn": 0.11,
    "cu": 0.03,
  },
  "Promedio harinas niños": {
    "kcal": 70.5,
    "prot": 1.5,
    "grasa": 0.5,
    "gs": 0.12,
    "gm": 0.14,
    "gp": 0.15,
    "col": 0,
    "chos": 15,
    "fd": 1.1,
    "calcio": 13,
    "p": 34,
    "fe": 0.6,
    "na": 41,
    "k": 150,
    "mg": 12,
    "zn": 0.26,
    "cu": 0.07,
  },
  "Raíces, tubérculos y plátanos adultos": {
    "kcal": 95.7,
    "prot": 1.4,
    "grasa": 0.1,
    "gs": 0.05,
    "gm": 0.01,
    "gp": 0.06,
    "col": 0,
    "chos": 22.3,
    "fd": 1.9,
    "calcio": 11,
    "p": 40,
    "fe": 0.5,
    "na": 10,
    "k": 376,
    "mg": 20,
    "zn": 0.23,
    "cu": 0.13,
  },
  "Raíces, tubérculos y plátanos menores de 2 años": {
    "kcal": 38,
    "prot": 0.5,
    "grasa": 0,
    "gs": 0.02,
    "gm": 0,
    "gp": 0.02,
    "col": 0,
    "chos": 9,
    "fd": 0.8,
    "calcio": 3,
    "p": 13,
    "fe": 0.2,
    "na": 2,
    "k": 153,
    "mg": 8,
    "zn": 0.07,
    "cu": 0.04,
  },
  "Raíces, tubérculos y plátanos niños": {
    "kcal": 65.7,
    "prot": 1,
    "grasa": 0.1,
    "gs": 0.03,
    "gm": 0.01,
    "gp": 0.04,
    "col": 0,
    "chos": 15.2,
    "fd": 1.3,
    "calcio": 8,
    "p": 29,
    "fe": 0.4,
    "na": 7,
    "k": 264,
    "mg": 14,
    "zn": 0.17,
    "cu": 0.09,
  },
  "Linaza entera": { "kcal": 150, "prot": 5.1, "grasa": 12.0, "gs": 1.0, "gm": 2.1, "gp": 8.0, "col": 0, "chos": 8.1, "fd": 7.6, "calcio": 72, "p": 180, "fe": 2.4, "portion_grams": 28, "unit_measure": "2 cucharadas soperas" },
  "Linaza pulverizada": { "kcal": 150, "prot": 5.1, "grasa": 12.0, "gs": 1.0, "gm": 2.1, "gp": 8.0, "col": 0, "chos": 8.1, "fd": 7.6, "calcio": 72, "p": 180, "fe": 2.4, "portion_grams": 28, "unit_measure": "2 cucharadas soperas" },
  "Semillas de ajonjolí tostado": { "kcal": 160, "prot": 5.0, "grasa": 14.0, "gs": 2.0, "gm": 5.4, "gp": 6.0, "col": 0, "chos": 6.5, "fd": 3.3, "calcio": 277, "p": 179, "fe": 4.2, "portion_grams": 28, "unit_measure": "2 cucharadas soperas" },
  "Semillas de amapola": { "kcal": 147, "prot": 5.0, "grasa": 12.6, "gs": 1.4, "gm": 1.7, "gp": 8.8, "col": 0, "chos": 7.9, "fd": 5.2, "calcio": 403, "p": 242, "fe": 2.8, "portion_grams": 28, "unit_measure": "2 cucharadas soperas" },
  "Semillas de calabaza": { "kcal": 151, "prot": 6.9, "grasa": 12.9, "gs": 2.2, "gm": 3.8, "gp": 5.8, "col": 0, "chos": 4.2, "fd": 1.4, "calcio": 15, "p": 329, "fe": 4.2, "portion_grams": 28, "unit_measure": "2 cucharadas soperas" },
  "Semillas de girasol descortezado": { "kcal": 165, "prot": 5.8, "grasa": 14.4, "gs": 1.5, "gm": 2.7, "gp": 9.2, "col": 0, "chos": 6.8, "fd": 3.9, "calcio": 20, "p": 329, "fe": 2.1, "portion_grams": 28, "unit_measure": "2 cucharadas soperas" },
  "Semillas de soya": { "kcal": 149, "prot": 12.5, "grasa": 8.0, "gs": 1.1, "gm": 1.8, "gp": 4.5, "col": 0, "chos": 8.0, "fd": 4.0, "calcio": 88, "p": 245, "fe": 2.9, "portion_grams": 28, "unit_measure": "2 cucharadas soperas" },
  "Semillas adultos y niños": {
    "kcal": 58.5,
    "prot": 2.3,
    "grasa": 4.1,
    "gs": 0.5,
    "gm": 0.91,
    "gp": 2.48,
    "col": 0,
    "chos": 3.1,
    "fd": 2.1,
    "calcio": 50,
    "p": 74,
    "fe": 0.9,
    "na": 2,
    "k": 78,
    "mg": 37,
    "zn": 0.58,
    "cu": 0.15,
  },
  "Sustitutos": {
    "kcal": 77.1,
    "prot": 5.8,
    "grasa": 5.5,
    "gs": 2.91,
    "gm": 1.94,
    "gp": 0.41,
    "col": 40,
    "chos": 1.1,
    "fd": 0,
    "calcio": 95,
    "p": 85,
    "fe": 1.1,
    "na": 211,
    "k": 52,
    "mg": 6,
    "zn": 0.65,
    "cu": 0.03,
  },
  "Butifarra": {
    "kcal": 70, "prot": 4.0, "grasa": 5.0, "gs": 2.5, "gm": 0, "gp": 0, "col": 15.0, "chos": 2.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 31, "unit_measure": "1 unidad pequeña"
  },
  "Cuajada de leche de vaca": {
    "kcal": 90, "prot": 6.0, "grasa": 7.0, "gs": 5.0, "gm": 1.44, "gp": 0.15, "col": 25.0, "chos": 1.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 30, "unit_measure": "1 tajada pequeña semigruesa"
  },
  "Huevo de gallina crudo": {
    "kcal": 75, "prot": 6.3, "grasa": 5.0, "gs": 1.55, "gm": 1.91, "gp": 0.68, "col": 213.0, "chos": 0.6, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 50, "unit_measure": "1 unidad pequeña"
  },
  "Huevos de codorniz crudo": {
    "kcal": 79, "prot": 6.6, "grasa": 5.6, "gs": 1.78, "gm": 2.16, "gp": 0.66, "col": 422.0, "chos": 0.2, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 50, "unit_measure": "5 unidades pequeñas"
  },
  "Jamón de Cerdo (97% libre de grasa y 25% reducido en sodio)": {
    "kcal": 50, "prot": 5.0, "grasa": 1.5, "gs": 1.0, "gm": 0.5, "gp": 0.5, "col": 20.0, "chos": 5.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 42, "unit_measure": "2 tajadas"
  },
  "Jamón de Pavo": {
    "kcal": 61, "prot": 7.2, "grasa": 2.6, "gs": 0.51, "gm": 1.02, "gp": 0.51, "col": 20.0, "chos": 2.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 46, "unit_measure": "2 tajadas"
  },
  "Morcilla": {
    "kcal": 72, "prot": 8.2, "grasa": 3.9, "gs": 2.1, "gm": 0, "gp": 0, "col": 0, "chos": 0.4, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 45, "unit_measure": "1 trozo pequeño"
  },
  "Mortadela común": {
    "kcal": 70, "prot": 6.0, "grasa": 4.0, "gs": 1.5, "gm": 2.0, "gp": 1.0, "col": 20.0, "chos": 2.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 30, "unit_measure": "2 tajadas"
  },
  "Pepperoni": {
    "kcal": 79, "prot": 3.7, "grasa": 7.0, "gs": 2.37, "gm": 2.74, "gp": 0.54, "col": 17.0, "chos": 0.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 16, "unit_measure": "4 rodajas delgadas"
  },
  "Quesito": {
    "kcal": 83, "prot": 6.5, "grasa": 5.7, "gs": 4.38, "gm": 1.44, "gp": 0.15, "col": 14.0, "chos": 1.5, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 30, "unit_measure": "1 tajada pequeña semigruesa"
  },
  "Queso Americano": {
    "kcal": 79, "prot": 4.0, "grasa": 6.1, "gs": 3.6, "gm": 1.63, "gp": 0.24, "col": 24.0, "chos": 2.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 24, "unit_measure": "1 lonchita"
  },
  "Queso búfala tipo mozzarella fresco graso de pasta hilada": {
    "kcal": 84, "prot": 4.5, "grasa": 7.5, "gs": 3.75, "gm": 3.47, "gp": 0.28, "col": 8.0, "chos": 0.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 30, "unit_measure": "1 tajada gruesa"
  },
  "Queso Campesino (fresco semiduro, graso)": {
    "kcal": 84, "prot": 4.8, "grasa": 7.2, "gs": 4.2, "gm": 2.46, "gp": 0.5, "col": 24.0, "chos": 1.2, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 30, "unit_measure": "1 tajada pequeña semigruesa"
  },
  "Queso Cheddar": {
    "kcal": 81, "prot": 5.0, "grasa": 6.6, "gs": 4.22, "gm": 1.88, "gp": 0.19, "col": 21.0, "chos": 0.3, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 20, "unit_measure": "1 lonchita"
  },
  "Queso Costeño rallado": {
    "kcal": 64, "prot": 4.0, "grasa": 5.2, "gs": 3.12, "gm": 1.72, "gp": 0.33, "col": 20.0, "chos": 0.8, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 20, "unit_measure": "2 cucharas soperas altas"
  },
  "Queso de Cabra": {
    "kcal": 73, "prot": 4.3, "grasa": 6.0, "gs": 4.13, "gm": 1.36, "gp": 0.14, "col": 16.0, "chos": 0.5, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 20, "unit_measure": "1 tajada delgada"
  },
  "Queso fresco de pasta hilada, semiduro, semigraso (Finesse)": {
    "kcal": 70, "prot": 7.0, "grasa": 4.5, "gs": 2.5, "gm": 1.63, "gp": 0.37, "col": 10.0, "chos": 1.0, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 30, "unit_measure": "2 lonchitas"
  },
  "Queso fresco semiduro graso": {
    "kcal": 90, "prot": 5.7, "grasa": 7.1, "gs": 3.87, "gm": 1.77, "gp": 0.33, "col": 21.0, "chos": 0.9, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 30, "unit_measure": "1 tajada pequeña semigruesa"
  },
  "Queso Gouda": {
    "kcal": 71, "prot": 5.0, "grasa": 5.5, "gs": 3.52, "gm": 1.55, "gp": 0.13, "col": 23.0, "chos": 0.4, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 20, "unit_measure": "1 tajada delgada"
  },
  "Queso mozzarella de leche entera de vaca semiduro, semigraso": {
    "kcal": 102, "prot": 7.5, "grasa": 7.6, "gs": 4.45, "gm": 2.21, "gp": 0.24, "col": 27.0, "chos": 0.7, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 34, "unit_measure": "2 lonchitas"
  },
  "Queso Parmesano rallado": {
    "kcal": 63, "prot": 4, "grasa": 3.9, "gs": 2.14, "gm": 0.99, "gp": 0.18, "col": 12, "chos": 1.9, "fd": 0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 14, "unit_measure": "2 cucharas soperas colmadas"
  },
  "Queso Ricotta (de leche semidescremada)": {
    "kcal": 77, "prot": 5.8, "grasa": 5, "gs": 3.17, "gm": 1.68, "gp": 0.15, "col": 26, "chos": 2, "fd": 0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 50, "unit_measure": "2 cucharas soperas altas"
  },
  "Queso sabana (Edam)": {
    "kcal": 79, "prot": 5.5, "grasa": 6.1, "gs": 3.87, "gm": 1.79, "gp": 0.15, "col": 20, "chos": 0.3, "fd": 0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 22, "unit_measure": "1 tajada delgada"
  },
  "Queso Tipo Pera": {
    "kcal": 84, "prot": 7.2, "grasa": 3.6, "gs": 3, "gm": 0.6, "gp": 0, "col": 0, "chos": 4.8, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 36, "unit_measure": "1 unidad pequeña"
  },
  "Salami": {
    "kcal": 82, "prot": 3.1, "grasa": 7.5, "gs": 3.26, "gm": 3.51, "gp": 0.28, "col": 15, "chos": 0.4, "fd": 0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 25, "unit_measure": "5 rodajas delgadas medianas"
  },
  "Salchicha tradicional": {
    "kcal": 67, "prot": 4.9, "grasa": 5.1, "gs": 1.38, "gm": 2.18, "gp": 0.58, "col": 25, "chos": 0, "fd": 0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 25, "unit_measure": "1 unidad mediana"
  },
  "Salchicha vegetariana": {
    "kcal": 95, "prot": 6.8, "grasa": 6.7, "gs": 1.07, "gm": 1.63, "gp": 3.40, "col": 0, "chos": 3.6, "fd": 1,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 37, "unit_measure": "1 unidad mediana"
  },
  "Salchichón cervecero": {
    "kcal": 82, "prot": 6.1, "grasa": 4.1, "gs": 1.36, "gm": 2.04, "gp": 0.68, "col": 20, "chos": 3.4, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 34, "unit_measure": "1 tajada gruesa"
  },
  "Salchichón de pollo": {
    "kcal": 80, "prot": 0, "grasa": 4.8, "gs": 1.60, "gm": 2.40, "gp": 0.80, "col": 32, "chos": 1.6, "fd": 0.0,
    "calcio": 0, "p": 0, "fe": 0, "na": 0, "k": 0, "mg": 0, "zn": 0, "cu": 0,
    "portion_grams": 40, "unit_measure": "1 pieza mediana"
  },
  "Arveja verde": { "kcal": 67, "prot": 4.3, "grasa": 0.2, "gs": 0.04, "gm": 0.02, "gp": 0.10, "col": 0, "chos": 12.5, "fd": 4.4, "calcio": 25, "p": 108, "fe": 1.5, "portion_grams": 80, "unit_measure": "1/2 pocillo cocido" },
  "Auyama": { "kcal": 26, "prot": 1.0, "grasa": 0.1, "gs": 0.02, "gm": 0.01, "gp": 0.05, "col": 0, "chos": 6.5, "fd": 0.5, "calcio": 21, "p": 44, "fe": 0.8, "portion_grams": 100, "unit_measure": "1 pocillo cocido" },
  "Baby carrots": { "kcal": 35, "prot": 0.8, "grasa": 0.2, "gs": 0.03, "gm": 0.01, "gp": 0.09, "col": 0, "chos": 8.2, "fd": 2.3, "calcio": 30, "p": 28, "fe": 0.3, "portion_grams": 85, "unit_measure": "10 unidades" },
  "Brócoli crudo sin hojas, ni tallos": { "kcal": 31, "prot": 2.5, "grasa": 0.4, "gs": 0.04, "gm": 0.02, "gp": 0.18, "col": 0, "chos": 6.0, "fd": 2.4, "calcio": 47, "p": 66, "fe": 0.7, "portion_grams": 91, "unit_measure": "1 pocillo flores" },
  "Cebolla blanca cruda": { "kcal": 40, "prot": 1.1, "grasa": 0.1, "gs": 0.02, "gm": 0.01, "gp": 0.02, "col": 0, "chos": 9.3, "fd": 1.7, "calcio": 23, "p": 29, "fe": 0.2, "portion_grams": 110, "unit_measure": "1 unidad mediana" },
  "Cebolla puerro": { "kcal": 31, "prot": 0.8, "grasa": 0.2, "gs": 0.03, "gm": 0.01, "gp": 0.09, "col": 0, "chos": 7.3, "fd": 0.9, "calcio": 37, "p": 26, "fe": 0.7, "portion_grams": 89, "unit_measure": "1 unidad mediana" },
  "Cebolla roja": { "kcal": 40, "prot": 1.1, "grasa": 0.1, "gs": 0.02, "gm": 0.01, "gp": 0.02, "col": 0, "chos": 9.3, "fd": 1.7, "calcio": 23, "p": 29, "fe": 0.2, "portion_grams": 110, "unit_measure": "1 unidad mediana" },
  "Champiñón tajado": { "kcal": 15, "prot": 2.2, "grasa": 0.2, "gs": 0.03, "gm": 0.0, "gp": 0.11, "col": 0, "chos": 2.3, "fd": 0.7, "calcio": 3, "p": 86, "fe": 0.5, "portion_grams": 70, "unit_measure": "1/2 pocillo" },
  "Champiñones": { "kcal": 15, "prot": 2.2, "grasa": 0.2, "gs": 0.03, "gm": 0.0, "gp": 0.11, "col": 0, "chos": 2.3, "fd": 0.7, "calcio": 3, "p": 86, "fe": 0.5, "portion_grams": 70, "unit_measure": "1/2 pocillo" },
  "Champiñones enlatados": { "kcal": 19, "prot": 1.6, "grasa": 0.3, "gs": 0.05, "gm": 0.0, "gp": 0.14, "col": 0, "chos": 3.3, "fd": 0.8, "calcio": 5, "p": 33, "fe": 0.4, "portion_grams": 70, "unit_measure": "1/2 pocillo escurrido" },
  "Chócolo desgranado": { "kcal": 96, "prot": 3.4, "grasa": 1.5, "gs": 0.20, "gm": 0.37, "gp": 0.60, "col": 0, "chos": 21.0, "fd": 2.4, "calcio": 2, "p": 89, "fe": 0.5, "portion_grams": 82, "unit_measure": "1/2 pocillo" },
  "Cidrayota": { "kcal": 19, "prot": 0.8, "grasa": 0.1, "gs": 0.03, "gm": 0.01, "gp": 0.05, "col": 0, "chos": 4.5, "fd": 1.7, "calcio": 17, "p": 18, "fe": 0.3, "portion_grams": 100, "unit_measure": "1 pocillo cocido" },
  "Coliflor": { "kcal": 25, "prot": 1.9, "grasa": 0.3, "gs": 0.03, "gm": 0.02, "gp": 0.13, "col": 0, "chos": 5.0, "fd": 2.0, "calcio": 22, "p": 44, "fe": 0.4, "portion_grams": 100, "unit_measure": "1 pocillo floretes" },
  "Espárragos enlatados": { "kcal": 19, "prot": 2.1, "grasa": 0.2, "gs": 0.04, "gm": 0.0, "gp": 0.09, "col": 0, "chos": 3.7, "fd": 2.0, "calcio": 21, "p": 54, "fe": 0.8, "portion_grams": 134, "unit_measure": "4 unidades medianas" },
  "Habichuela": { "kcal": 31, "prot": 1.8, "grasa": 0.1, "gs": 0.03, "gm": 0.01, "gp": 0.06, "col": 0, "chos": 7.0, "fd": 2.7, "calcio": 37, "p": 38, "fe": 1.0, "portion_grams": 100, "unit_measure": "1 pocillo cocido" },
  "Habichuelas enlatadas": { "kcal": 28, "prot": 1.6, "grasa": 0.2, "gs": 0.04, "gm": 0.01, "gp": 0.09, "col": 0, "chos": 6.4, "fd": 2.4, "calcio": 44, "p": 29, "fe": 0.9, "portion_grams": 135, "unit_measure": "1 pocillo escurrido" },
  "Palmitos enlatados": { "kcal": 29, "prot": 2.4, "grasa": 0.6, "gs": 0.13, "gm": 0.08, "gp": 0.26, "col": 0, "chos": 4.6, "fd": 2.4, "calcio": 44, "p": 169, "fe": 0.8, "portion_grams": 73, "unit_measure": "4 unidades" },
  "Pepinillos agridulc.": { "kcal": 18, "prot": 0.6, "grasa": 0.2, "gs": 0.03, "gm": 0.01, "gp": 0.07, "col": 0, "chos": 4.2, "fd": 0.3, "calcio": 7, "p": 12, "fe": 0.2, "portion_grams": 65, "unit_measure": "2 unidades medianas" },
  "Pimentón rojo": { "kcal": 20, "prot": 1.0, "grasa": 0.2, "gs": 0.03, "gm": 0.02, "gp": 0.09, "col": 0, "chos": 4.6, "fd": 0.3, "calcio": 10, "p": 20, "fe": 0.3, "portion_grams": 74, "unit_measure": "1/2 unidad mediana" },
  "Rábano con cáscara": { "kcal": 16, "prot": 0.7, "grasa": 0.1, "gs": 0.03, "gm": 0.02, "gp": 0.05, "col": 0, "chos": 3.4, "fd": 1.6, "calcio": 25, "p": 20, "fe": 0.3, "portion_grams": 85, "unit_measure": "4 unidades medianas" },
  "Remolacha, cocida": { "kcal": 44, "prot": 1.7, "grasa": 0.2, "gs": 0.03, "gm": 0.02, "gp": 0.06, "col": 0, "chos": 10.0, "fd": 2.0, "calcio": 16, "p": 38, "fe": 0.8, "portion_grams": 100, "unit_measure": "1/2 pocillo" },
  "Tomate chonto": { "kcal": 18, "prot": 0.9, "grasa": 0.2, "gs": 0.03, "gm": 0.03, "gp": 0.08, "col": 0, "chos": 3.9, "fd": 1.2, "calcio": 10, "p": 24, "fe": 0.3, "portion_grams": 123, "unit_measure": "1 unidad mediana" },
  "Tomate larga vida": { "kcal": 18, "prot": 0.9, "grasa": 0.2, "gs": 0.03, "gm": 0.03, "gp": 0.08, "col": 0, "chos": 3.9, "fd": 1.2, "calcio": 10, "p": 24, "fe": 0.3, "portion_grams": 123, "unit_measure": "1 unidad mediana" },
  "Tomate riñón": { "kcal": 18, "prot": 0.9, "grasa": 0.2, "gs": 0.03, "gm": 0.03, "gp": 0.08, "col": 0, "chos": 3.9, "fd": 1.2, "calcio": 10, "p": 24, "fe": 0.3, "portion_grams": 123, "unit_measure": "1 unidad mediana" },
  "Tomate rojo maduro enlatado": { "kcal": 32, "prot": 1.6, "grasa": 0.3, "gs": 0.04, "gm": 0.04, "gp": 0.13, "col": 0, "chos": 7.0, "fd": 1.5, "calcio": 31, "p": 24, "fe": 1.1, "portion_grams": 120, "unit_measure": "1/2 pocillo" },
  "Zanahoria": { "kcal": 41, "prot": 0.9, "grasa": 0.2, "gs": 0.04, "gm": 0.01, "gp": 0.10, "col": 0, "chos": 9.6, "fd": 2.8, "calcio": 33, "p": 35, "fe": 0.3, "portion_grams": 78, "unit_measure": "1 unidad mediana" },
  "Verduras y hortalizas adultos y niños": {
    "kcal": 29.5,
    "prot": 1.2,
    "grasa": 0.3,
    "gs": 0.05,
    "gm": 0.03,
    "gp": 0.13,
    "col": 0,
    "chos": 5.5,
    "fd": 1.7,
    "calcio": 15,
    "p": 32,
    "fe": 0.7,
    "na": 68,
    "k": 187,
    "mg": 12,
    "zn": 0.29,
    "cu": 0.1,
  },
  "Verduras y hortalizas menores de 2 años": {
    "kcal": 14.5,
    "prot": 0.7,
    "grasa": 0.1,
    "gs": 0.02,
    "gm": 0.01,
    "gp": 0.06,
    "col": 0,
    "chos": 2.7,
    "fd": 0.9,
    "calcio": 9,
    "p": 15,
    "fe": 0.3,
    "na": 8,
    "k": 101,
    "mg": 7,
    "zn": 0.13,
    "cu": 0.04,
  },
  "3D triangulos": { "kcal": 140, "prot": 2.0, "grasa": 7.0, "gs": 1.2, "gm": 2.8, "gp": 2.5, "col": 0, "chos": 18.0, "fd": 1.0, "calcio": 15, "p": 50, "fe": 0.5, "portion_grams": 28, "unit_measure": "1 paquete pequeño" },
  "Boli cheetos": { "kcal": 150, "prot": 2.2, "grasa": 9.0, "gs": 1.5, "gm": 3.2, "gp": 3.8, "col": 0, "chos": 15.0, "fd": 0.8, "calcio": 40, "p": 55, "fe": 0.3, "portion_grams": 28, "unit_measure": "1 paquete pequeño" },
  "Brownie mama-ia arequipe": { "kcal": 180, "prot": 2.5, "grasa": 9.0, "gs": 3.5, "gm": 3.5, "gp": 1.5, "col": 25, "chos": 24.0, "fd": 1.0, "calcio": 45, "p": 65, "fe": 0.8, "portion_grams": 45, "unit_measure": "1 unidad" },
  "Cheese tris": { "kcal": 145, "prot": 2.5, "grasa": 8.0, "gs": 1.2, "gm": 3.0, "gp": 3.2, "col": 0, "chos": 16.0, "fd": 0.8, "calcio": 60, "p": 50, "fe": 0.4, "portion_grams": 28, "unit_measure": "1 paquete pequeño" },
  "Choclitos limón": { "kcal": 135, "prot": 2.0, "grasa": 7.5, "gs": 1.0, "gm": 2.8, "gp": 3.2, "col": 0, "chos": 16.0, "fd": 0.8, "calcio": 15, "p": 45, "fe": 0.3, "portion_grams": 28, "unit_measure": "1 paquete pequeño" },
  "Choco poff": { "kcal": 155, "prot": 2.0, "grasa": 8.5, "gs": 4.0, "gm": 2.5, "gp": 1.5, "col": 5, "chos": 19.0, "fd": 0.5, "calcio": 35, "p": 40, "fe": 0.5, "portion_grams": 28, "unit_measure": "1 paquete pequeño" },
  "Colombineta": { "kcal": 145, "prot": 1.5, "grasa": 6.5, "gs": 3.5, "gm": 2.2, "gp": 0.5, "col": 15, "chos": 21.0, "fd": 0.3, "calcio": 25, "p": 35, "fe": 0.3, "portion_grams": 30, "unit_measure": "1 unidad" },
  "Crispetas comerciales de mantequilla": { "kcal": 155, "prot": 2.2, "grasa": 9.5, "gs": 2.0, "gm": 2.5, "gp": 4.5, "col": 5, "chos": 16.0, "fd": 2.5, "calcio": 5, "p": 55, "fe": 0.5, "portion_grams": 28, "unit_measure": "1 paquete pequeño" },
  "Crispetas comerciales de queso": { "kcal": 150, "prot": 2.5, "grasa": 9.0, "gs": 1.8, "gm": 2.8, "gp": 3.8, "col": 0, "chos": 16.0, "fd": 2.0, "calcio": 80, "p": 60, "fe": 0.4, "portion_grams": 28, "unit_measure": "1 paquete pequeño" },
  "Crispetas comerciales de caramelo": { "kcal": 135, "prot": 1.5, "grasa": 5.0, "gs": 1.0, "gm": 1.5, "gp": 2.0, "col": 0, "chos": 23.0, "fd": 1.5, "calcio": 5, "p": 25, "fe": 0.2, "portion_grams": 28, "unit_measure": "1 paquete pequeño" },
  "Doritos arepitas": { "kcal": 140, "prot": 2.2, "grasa": 7.5, "gs": 1.2, "gm": 2.8, "gp": 3.0, "col": 0, "chos": 17.0, "fd": 1.0, "calcio": 30, "p": 50, "fe": 0.4, "portion_grams": 28, "unit_measure": "1 paquete pequeño" },
  "Doritos mega queso": { "kcal": 150, "prot": 2.5, "grasa": 8.5, "gs": 1.5, "gm": 3.0, "gp": 3.5, "col": 0, "chos": 16.0, "fd": 1.0, "calcio": 70, "p": 55, "fe": 0.4, "portion_grams": 28, "unit_measure": "1 paquete pequeño" },
  "Mini cheetos": { "kcal": 145, "prot": 2.2, "grasa": 8.5, "gs": 1.4, "gm": 3.0, "gp": 3.6, "col": 0, "chos": 15.0, "fd": 0.8, "calcio": 45, "p": 50, "fe": 0.3, "portion_grams": 28, "unit_measure": "1 paquete pequeño" },
  "Mini chips chocolate": { "kcal": 160, "prot": 2.0, "grasa": 9.5, "gs": 4.5, "gm": 2.8, "gp": 1.8, "col": 5, "chos": 18.0, "fd": 0.5, "calcio": 40, "p": 45, "fe": 0.6, "portion_grams": 28, "unit_measure": "1 paquete pequeño" },
  "Mini recreo": { "kcal": 145, "prot": 2.0, "grasa": 7.5, "gs": 3.5, "gm": 2.5, "gp": 1.2, "col": 5, "chos": 19.0, "fd": 0.8, "calcio": 50, "p": 55, "fe": 0.4, "portion_grams": 28, "unit_measure": "1 paquete pequeño" },
  "Palitos margarita": { "kcal": 130, "prot": 2.5, "grasa": 5.5, "gs": 0.8, "gm": 2.0, "gp": 2.2, "col": 0, "chos": 18.0, "fd": 0.8, "calcio": 25, "p": 45, "fe": 0.5, "portion_grams": 28, "unit_measure": "1 puñado" },
  "Papas fritas criollas": { "kcal": 155, "prot": 2.0, "grasa": 10.0, "gs": 1.5, "gm": 3.5, "gp": 4.5, "col": 0, "chos": 15.0, "fd": 1.0, "calcio": 10, "p": 50, "fe": 0.4, "portion_grams": 28, "unit_measure": "1 paquete pequeño" },
  "Papitas limón": { "kcal": 150, "prot": 2.0, "grasa": 9.5, "gs": 1.2, "gm": 3.2, "gp": 4.5, "col": 0, "chos": 15.0, "fd": 1.0, "calcio": 10, "p": 45, "fe": 0.4, "portion_grams": 28, "unit_measure": "1 paquete pequeño" },
  "Papitas pollo": { "kcal": 150, "prot": 2.2, "grasa": 9.5, "gs": 1.2, "gm": 3.2, "gp": 4.5, "col": 0, "chos": 15.0, "fd": 1.0, "calcio": 10, "p": 50, "fe": 0.4, "portion_grams": 28, "unit_measure": "1 paquete pequeño" },
  "Platanitos maduros": { "kcal": 155, "prot": 1.0, "grasa": 9.5, "gs": 1.2, "gm": 2.5, "gp": 5.2, "col": 0, "chos": 18.0, "fd": 1.2, "calcio": 5, "p": 35, "fe": 0.5, "portion_grams": 28, "unit_measure": "1 paquete pequeño" },
  "Plátanos limón": { "kcal": 150, "prot": 1.0, "grasa": 9.0, "gs": 1.0, "gm": 2.5, "gp": 5.0, "col": 0, "chos": 18.0, "fd": 1.0, "calcio": 5, "p": 35, "fe": 0.5, "portion_grams": 28, "unit_measure": "1 paquete pequeño" },
  "Rosquitas": { "kcal": 140, "prot": 2.5, "grasa": 6.0, "gs": 0.8, "gm": 2.2, "gp": 2.5, "col": 0, "chos": 19.0, "fd": 0.8, "calcio": 15, "p": 45, "fe": 0.5, "portion_grams": 28, "unit_measure": "4-5 unidades" },
  "Sapito": { "kcal": 140, "prot": 1.5, "grasa": 6.0, "gs": 2.5, "gm": 2.2, "gp": 1.0, "col": 10, "chos": 21.0, "fd": 0.3, "calcio": 30, "p": 35, "fe": 0.3, "portion_grams": 30, "unit_measure": "1 unidad" },
  "Tosti arepa": { "kcal": 135, "prot": 2.5, "grasa": 6.0, "gs": 1.0, "gm": 2.2, "gp": 2.2, "col": 0, "chos": 18.0, "fd": 0.8, "calcio": 40, "p": 55, "fe": 0.5, "portion_grams": 28, "unit_measure": "1 unidad" },
  "Yogueta": { "kcal": 150, "prot": 2.5, "grasa": 8.0, "gs": 4.0, "gm": 2.5, "gp": 1.2, "col": 15, "chos": 18.0, "fd": 0.5, "calcio": 55, "p": 60, "fe": 0.5, "portion_grams": 28, "unit_measure": "1 paquete pequeño" },
  "Yupis": { "kcal": 145, "prot": 2.2, "grasa": 8.0, "gs": 1.2, "gm": 2.8, "gp": 3.5, "col": 0, "chos": 16.0, "fd": 0.8, "calcio": 35, "p": 50, "fe": 0.4, "portion_grams": 28, "unit_measure": "1 paquete pequeño" },
  "Mecatos adultos y niños": { "kcal": 148, "prot": 2.2, "grasa": 7.8, "gs": 1.8, "gm": 2.6, "gp": 2.9, "col": 5, "chos": 17.5, "fd": 0.8, "calcio": 32, "p": 48, "fe": 0.4, "portion_grams": 28, "unit_measure": "1 porción" },
  "Aguardiente": { "kcal": 125, "prot": 0, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 45, "unit_measure": "1 copa" },
  "Cerveza 3,6 gr %": { "kcal": 145, "prot": 1.2, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 13.0, "fd": 0, "calcio": 14, "p": 50, "fe": 0.1, "portion_grams": 355, "unit_measure": "1 vaso o lata" },
  "Cerveza baja caloría 3,2 gr %": { "kcal": 95, "prot": 0.7, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 5.0, "fd": 0, "calcio": 10, "p": 30, "fe": 0.1, "portion_grams": 355, "unit_measure": "1 vaso o lata" },
  "Chicha 4%": { "kcal": 85, "prot": 0.5, "grasa": 0.1, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 12.0, "fd": 0, "calcio": 5, "p": 15, "fe": 0.1, "portion_grams": 250, "unit_measure": "1 vaso" },
  "Crema de menta 29,8%": { "kcal": 185, "prot": 0, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 22.0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 45, "unit_measure": "1 copa" },
  "Daiquiri 23,2 gr %": { "kcal": 125, "prot": 0.1, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 12.0, "fd": 0, "calcio": 2, "p": 5, "fe": 0, "portion_grams": 90, "unit_measure": "1 copa" },
  "Ginebra 37,9 gr%": { "kcal": 110, "prot": 0, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 45, "unit_measure": "1 copa" },
  "Guarapo 3%": { "kcal": 70, "prot": 0.2, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 10.0, "fd": 0, "calcio": 8, "p": 12, "fe": 0.1, "portion_grams": 250, "unit_measure": "1 vaso" },
  "Licor de café 21,75%": { "kcal": 175, "prot": 0, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 22.0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 45, "unit_measure": "1 copa" },
  "Manhattan 36,9%": { "kcal": 130, "prot": 0, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 2.0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 75, "unit_measure": "1 copa" },
  "Martini 38,4%": { "kcal": 135, "prot": 0, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 0.5, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 75, "unit_measure": "1 copa" },
  "Piña colada 12,3%": { "kcal": 245, "prot": 1.0, "grasa": 5.0, "gs": 4.0, "gm": 0.5, "gp": 0.3, "col": 0, "chos": 32.0, "fd": 0.5, "calcio": 15, "p": 45, "fe": 0.2, "portion_grams": 180, "unit_measure": "1 copa" },
  "Ron 33, 4 gr %": { "kcal": 110, "prot": 0, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 45, "unit_measure": "1 copa" },
  "Tom collins (ginebra 18,9%)": { "kcal": 120, "prot": 0, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 10.0, "fd": 0, "calcio": 2, "p": 5, "fe": 0, "portion_grams": 200, "unit_measure": "1 vaso" },
  "Vino blanco 9,3 gr%": { "kcal": 120, "prot": 0.1, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 4.0, "fd": 0, "calcio": 10, "p": 25, "fe": 0.2, "portion_grams": 150, "unit_measure": "1 copa" },
  "Vino rosado 9,3 gr%": { "kcal": 125, "prot": 0.1, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 4.5, "fd": 0, "calcio": 10, "p": 25, "fe": 0.2, "portion_grams": 150, "unit_measure": "1 copa" },
  "Vino tinto 9,3 gr%": { "kcal": 125, "prot": 0.1, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 4.0, "fd": 0, "calcio": 10, "p": 25, "fe": 0.2, "portion_grams": 150, "unit_measure": "1 copa" },
  "Vodka 33,4 gr%": { "kcal": 110, "prot": 0, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 45, "unit_measure": "1 copa" },
  "Whisky 36 gr%": { "kcal": 120, "prot": 0, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 45, "unit_measure": "1 copa" },
  "Bebidas alcoholicas adultos y niños": { "kcal": 130, "prot": 0.2, "grasa": 0.3, "gs": 0.2, "gm": 0.05, "gp": 0.02, "col": 0, "chos": 5.0, "fd": 0, "calcio": 5, "p": 12, "fe": 0.1, "portion_grams": 100, "unit_measure": "Promedio" },
  "Café instantáneo descafeinado en polvo": { "kcal": 5, "prot": 0.3, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 0, "fd": 0, "calcio": 2, "p": 5, "fe": 0.1, "portion_grams": 2, "unit_measure": "1 cucharadita" },
  "Café instantáneo en polvo": { "kcal": 5, "prot": 0.3, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 0, "fd": 0, "calcio": 2, "p": 5, "fe": 0.1, "portion_grams": 2, "unit_measure": "1 cucharadita" },
  "Gaseosa azúcarada": { "kcal": 140, "prot": 0, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 39.0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 355, "unit_measure": "1 lata" },
  "Gaseosa diferente al tipo cola endulzada con aspartame, sin cafeína": { "kcal": 5, "prot": 0, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 355, "unit_measure": "1 lata" },
  "Gaseosa tipo cola con aspartame, contiene cafeína": { "kcal": 5, "prot": 0, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 355, "unit_measure": "1 lata" },
  "Gatorade": { "kcal": 50, "prot": 0, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 14.0, "fd": 0, "calcio": 2, "p": 25, "fe": 0, "portion_grams": 240, "unit_measure": "1 vaso" },
  "Jugo de naranja": { "kcal": 112, "prot": 1.7, "grasa": 0.5, "gs": 0.1, "gm": 0.1, "gp": 0.1, "col": 0, "chos": 25.8, "fd": 0.5, "calcio": 22, "p": 42, "fe": 0.5, "portion_grams": 248, "unit_measure": "1 vaso" },
  "Malta": { "kcal": 140, "prot": 1.2, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 32.0, "fd": 0.5, "calcio": 10, "p": 35, "fe": 0.2, "portion_grams": 355, "unit_measure": "1 lata" },
  "Squash": { "kcal": 25, "prot": 0, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 6.5, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 250, "unit_measure": "1 vaso preparado" },
  "Té de hiervas": { "kcal": 2, "prot": 0, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 240, "unit_measure": "1 taza" },
  "Té instantáneo en polvo, endulzado con sucralosa": { "kcal": 5, "prot": 0, "grasa": 0, "gs": 0, "gm": 0, "gp": 0, "col": 0, "chos": 0, "fd": 0, "calcio": 0, "p": 0, "fe": 0, "portion_grams": 240, "unit_measure": "1 vaso preparado" },
  "Bebidas no alcoholicas adultos y niños": { "kcal": 55, "prot": 0.3, "grasa": 0.05, "gs": 0.01, "gm": 0.01, "gp": 0.02, "col": 0, "chos": 14.0, "fd": 0.05, "calcio": 4, "p": 12, "fe": 0.1, "portion_grams": 240, "unit_measure": "Promedio" },
  "Almendras tostadas sin sal": { "kcal": 168, "prot": 6.0, "grasa": 14.5, "gs": 1.1, "gm": 9.1, "gp": 3.6, "col": 0, "chos": 6.1, "fd": 3.5, "calcio": 76, "p": 137, "fe": 1.0, "portion_grams": 28, "unit_measure": "22 unidades" },
  "Avellanas tostada sin sal": { "kcal": 183, "prot": 4.3, "grasa": 17.7, "gs": 1.3, "gm": 13.0, "gp": 2.2, "col": 0, "chos": 4.7, "fd": 2.7, "calcio": 32, "p": 82, "fe": 1.3, "portion_grams": 28, "unit_measure": "20 unidades" },
  "Coco deshidratado": { "kcal": 187, "prot": 1.8, "grasa": 18.5, "gs": 16.3, "gm": 0.8, "gp": 0.2, "col": 0, "chos": 6.6, "fd": 4.6, "calcio": 11, "p": 95, "fe": 1.2, "portion_grams": 28, "unit_measure": "1/3 pocillo" },
  "Coco fresco rallado": { "kcal": 99, "prot": 0.9, "grasa": 9.4, "gs": 8.4, "gm": 0.4, "gp": 0.1, "col": 0, "chos": 4.2, "fd": 2.5, "calcio": 6, "p": 53, "fe": 0.7, "portion_grams": 28, "unit_measure": "1/4 pocillo" },
  "Macadamia tostado sin sal": { "kcal": 203, "prot": 2.2, "grasa": 21.5, "gs": 3.4, "gm": 16.7, "gp": 0.4, "col": 0, "chos": 3.9, "fd": 2.4, "calcio": 24, "p": 53, "fe": 1.1, "portion_grams": 28, "unit_measure": "10-12 unidades" },
  "Maní sin sal": { "kcal": 161, "prot": 7.3, "grasa": 14.0, "gs": 2.0, "gm": 7.0, "gp": 4.4, "col": 0, "chos": 4.6, "fd": 2.4, "calcio": 26, "p": 107, "fe": 1.3, "portion_grams": 28, "unit_measure": "28 unidades" },
  "Marañón tostado sin sal": { "kcal": 157, "prot": 5.2, "grasa": 12.4, "gs": 2.2, "gm": 6.7, "gp": 2.2, "col": 0, "chos": 8.6, "fd": 0.9, "calcio": 10, "p": 168, "fe": 1.9, "portion_grams": 28, "unit_measure": "18 unidades" },
  "Mezcla de nueces": { "kcal": 173, "prot": 5.0, "grasa": 16.5, "gs": 2.0, "gm": 8.5, "gp": 5.0, "col": 0, "chos": 5.5, "fd": 2.5, "calcio": 35, "p": 120, "fe": 1.2, "portion_grams": 28, "unit_measure": "1 puñado" },
  "Nuez del Brasil": { "kcal": 186, "prot": 4.1, "grasa": 18.8, "gs": 4.3, "gm": 7.0, "gp": 5.8, "col": 0, "chos": 3.5, "fd": 2.1, "calcio": 45, "p": 206, "fe": 1.2, "portion_grams": 28, "unit_measure": "6 unidades" },
  "Nuez del nogal": { "kcal": 185, "prot": 4.3, "grasa": 18.5, "gs": 1.7, "gm": 2.5, "gp": 13.4, "col": 0, "chos": 3.9, "fd": 1.9, "calcio": 28, "p": 98, "fe": 0.8, "portion_grams": 28, "unit_measure": "14 mitades" },
  "Pacanas tostadas sin sal": { "kcal": 201, "prot": 2.7, "grasa": 21.1, "gs": 1.8, "gm": 11.6, "gp": 6.1, "col": 0, "chos": 3.8, "fd": 2.7, "calcio": 20, "p": 79, "fe": 0.7, "portion_grams": 28, "unit_measure": "19 mitades" },
  "Pistacho crudo sin cáscara": { "kcal": 156, "prot": 5.8, "grasa": 12.6, "gs": 1.5, "gm": 6.9, "gp": 3.8, "col": 0, "chos": 7.8, "fd": 3.0, "calcio": 30, "p": 137, "fe": 1.1, "portion_grams": 28, "unit_measure": "49 unidades" },
  "Pistacho tostado y salado sin cáscara": { "kcal": 161, "prot": 5.9, "grasa": 13.0, "gs": 1.6, "gm": 7.1, "gp": 3.9, "col": 0, "chos": 7.9, "fd": 3.0, "calcio": 31, "p": 140, "fe": 1.2, "portion_grams": 28, "unit_measure": "49 unidades" }
};

/**
 * Grupos de alimentos de la Fase 3 según EVANUT 4.1 (tabla de referencia).
 * Solo estos grupos se muestran en la Fase 3 del plan al crear un plan nutricional.
 * Orden según la tabla de grupos de alimentos (adultos).
 */
export const EVANUT_GRUPOS_ALIMENTOS: string[] = [
  "Leches enteras frescas y fermentadas",
  "Leches semidescremadas frescas y fermentadas",
  "Leches descremadas frescas y fermentadas",
  "Leches frescas y fermentadas enteras altas en calorías y azucares",
  "Sustitutos",
  "Carnes magras crudas y proteínas texturizada adultos y niños",
  "Carnes crudas altas en lípidos adultos y niños",
  "Leguminosas adultos",
  "Cereales adultos",
  "Raíces, tubérculos y plátanos adultos",
  "Promedio harinas adultos",
  "Verduras y hortalizas adultos y niños",
  "Frutas adultos y niños",
  "Nueces adultos y niños",
  "Semillas adultos y niños",
  "Azucares y dulces adultos",
  "Grasas poliinsaturadas adultos y niños",
  "Grasas monoinsaturadas adultos y niños",
  "Grasas saturadas adultos y niños",
  "Promedio grasas adultos y niños",
  "Productos con reducción de grasa adultos y niños",
];

/** Lista de todos los ingredientes del PDF (tabla de composición de alimentos) */
export const FOOD_INGREDIENTS_LIST: string[] = Object.keys(FOOD_NUTRIENTS);

/** Ingredientes del grupo Leche entera fresca y fermentada (tabla PDF) */
const LECHE_ENTERA_FRESCA_INGREDIENTS = new Set([
  "Leches enteras frescas y fermentadas",
  "Kamis de leche entera",
  "Leche de cabra cruda",
  "Leche de vaca entera cruda",
  "Leche de vaca entera en polvo",
  "Leche de vaca entera pasteurizada",
  "Yogurt regular de leche entera",
]);

/** Ingredientes del grupo Leches semidescremadas frescas y fermentadas (tabla PDF) */
const LECHE_SEMIDESCREMADA_FRESCA_INGREDIENTS = new Set([
  "Avena líquida con leche de vaca descremada",
  "Bebida de Soya comercial",
  "Leche de vaca semidescremada en polvo",
  "Leche de vaca semidescremada pasteurizada (con o sin lactosa)",
  "Yogurt de leche entera - Yox",
  "Yogurt de leche entera cuchareable",
  "Leches semidescremadas frescas y fermentadas",
]);

/** Ingredientes del grupo Leches descremadas frescas y fermentadas (tabla PDF) */
const LECHE_DESCREMADA_FRESCA_INGREDIENTS = new Set([
  "Leche de vaca descremada en polvo",
  "Leche de vaca descremada pasteurizada",
  "Yogurt de leche descremada",
  "Yogurt Griego natural",
  "Leches descremadas frescas y fermentadas",
]);

/** Ingredientes del grupo Leches frescas y fermentadas enteras altas en calorías y azúcares (tabla PDF) */
const LECHE_ENTERA_ALTAS_CALORIAS_INGREDIENTS = new Set([
  "Avena con leche de vaca entera comercial",
  "Kumis de leche entera azucarado",
  "Leche de vaca entera chocolatada",
  "Yogurt de leche entera azucarado",
  "Leches frescas y fermentadas enteras altas en calorías y azucares",
]);

/** Ingredientes del grupo Cereales adultos (tabla PDF) */
const CEREALES_ADULTOS_INGREDIENTS = new Set([
  "Almojábana",
  "Arepa delgada de maíz blanco trillado",
  "Arepa redonda de maíz blanco trillado",
  "Arroz blanco, cocido",
  "Arroz integral, cocido",
  "Arroz parbolizado cocido",
  "Avena en hojuelas fortificada",
  "Cebada perlada cocida",
  "Choco Krispis",
  "Corn Flakes",
  "Cuchuco de cebada",
  "Espaguetis de arroz, hidratados",
  "Espaguetis de trigo, cocidos",
  "Froot Loops",
  "Galletas Saltinas",
  "Harina de arroz blanco",
  "Harina de maíz blanco trillado",
  "Harina de trigo enriquecida",
  "Macarrones, cocidos",
  "Maicena (almidón de maíz)",
  "Maíz pira, crudo",
  "Maíz tierno o choclo, amarillo enlatado",
  "Maíz tostado comercial",
  "Mazamorra Antioqueña (maíz cocido)",
  "Palitos o palitroques",
  "Pan blanco",
  "Pan centeno",
  "Pan de salvado de avena",
  "Pan integral",
  "Pan pita o árabe",
  "Pancake (mezcla preparada con leche entera)",
  "Pandequeso",
  "Pandeyuca",
  "Pasta corta cocida",
  "Seba Seba",
  "Taco vacío",
  "Tortilla de maíz",
  "Tostada o calado",
  "Zucaritas",
  "Cereales adultos",
]);

/** Ingredientes del grupo Raíces, Tubérculos y Plátanos adultos (tabla PDF) */
const RAICES_TUBERCULOS_PLATANOS_ADULTOS_INGREDIENTS = new Set([
  "Arracacha",
  "Batata",
  "Chuguas u ollucos",
  "Cubios",
  "Harina de plátano",
  "Ñame",
  "Papa común",
  "Papa criolla",
  "Plátano colí o guineo",
  "Plátano hartón maduro",
  "Plátano verde",
  "Yuca blanca",
  "Raíces, Tubérculos y Plátanos adultos",
]);

/** Ingredientes del grupo Raíces, tubérculos y plátanos niños y niñas (tabla PDF) */
const RAICES_TUBERCULOS_PLATANOS_NINOS_INGREDIENTS = new Set([
  "Arracacha (niños)",
  "Batata (niños)",
  "Chuguas u ollucos (niños)",
  "Cubios (niños)",
  "Harina de plátano (niños)",
  "Ñame (niños)",
  "Papa común (niños)",
  "Papa criolla (niños)",
  "Plátano colí o guineo (niños)",
  "Plátano hartón maduro (niños)",
  "Plátano verde (niños)",
  "Yuca blanca (niños)",
  "Raíces, tubérculos y plátanos niños y niñas",
]);

/** Ingredientes del grupo Cereales niños y niñas (tabla PDF) */
const CEREALES_NINOS_INGREDIENTS = new Set([
  "Almojábana (niños)",
  "Arepa redonda de maíz blanco trillado (niños)",
  "Arroz blanco, cocido (niños)",
  "Arroz integral, cocido (niños)",
  "Arroz parbolizado cocido (niños)",
  "Avena en hojuelas fortificada (niños)",
  "Cebada perlada cocida (niños)",
  "Choco Krispis (niños)",
  "Corn Flakes (niños)",
  "Cuchuco de cebada, crudo (niños)",
  "Espaguetis de arroz, hidratados (niños)",
  "Espaguetis de trigo, cocidos (niños)",
  "Froot Loops (niños)",
  "Galletas Saltinas (niños)",
  "Harina de trigo enriquecida (niños)",
  "Macarrones, cocidos (niños)",
  "Maicena (almidón de maíz) (niños)",
  "Maíz pira, crudo (niños)",
  "Maíz tierno o choclo, amarillo enlatado (niños)",
  "Mazamorra Antioqueña (maíz cocido) (niños)",
  "Palitos o palitroques (niños)",
  "Pan blanco (niños)",
  "Pan centeno (niños)",
  "Pan de salvado de avena (niños)",
  "Pan integral (niños)",
  "Pan pita o árabe (niños)",
  "Pancake (mezcla preparada con leche entera) (niños)",
  "Pandequeso (niños)",
  "Pandeyuca (niños)",
  "Pasta corta cocida (niños)",
  "Seba Seba (niños)",
  "Taco vacío (niños)",
  "Tortilla de maíz (niños)",
  "Tostada o calado (niños)",
  "Zucaritas (niños)",
  "Cereales niños y niñas",
]);

/** Ingredientes del grupo Frutas (tabla PDF) */
const FRUTAS_INGREDIENTS = new Set([
  "Banano común",
  "Borojó",
  "Chirimoya",
  "Chontaduro",
  "Ciruela claudia",
  "Ciruela común",
  "Curuba",
  "Feijoa",
  "Fresas",
  "Granadilla",
  "Guanabana",
  "Guayaba criolla",
  "Guayaba manzana",
  "Higo",
  "Kiwi",
  "Lulo",
  "Lulo jugo",
  "Mango",
  "Manzana con cascara toda variedad",
  "Maracuyá",
  "Melón",
  "Mora",
  "Murrapo",
  "Naranja",
  "Naranja orlando",
  "Naranja tangelo",
  "Naranja valencia",
  "Papaya",
  "Papayuela",
  "Pera",
  "Piña manzana",
  "Pitahaya",
  "Sandia Baby",
  "Tomate árbol común",
  "Tomate árbol rojo",
  "Uchuva",
  "Zapote sin semilla",
  "Frutas adultos y niños",
  "Frutas menores de 2 años",
]);

/** Ingredientes del grupo Productos con reducción de grasa (tabla PDF) */
const PRODUCTOS_REDUCCION_GRASA_INGREDIENTS = new Set([
  "Crema de leche Light",
  "Margarina line (reducida 25%)",
  "Mayonesa Ligth",
  "Queso crema light",
  "Salsa de queso Cheddar",
  "Productos con reducción de grasa adultos y niños",
]);

/** Ingredientes del grupo Grasas saturadas (tabla PDF) */
const GRASAS_SATURADAS_INGREDIENTS = new Set([
  "Aceite de palma",
  "Crema agria",
  "Crema de leche líquida, espesa entera",
  "Manteca de cerdo",
  "Mantequilla sin sal",
  "Queso crema",
  "Grasas saturadas adultos y niños",
  "Grasas saturadas menores de 2 años",
]);

/** Ingredientes del grupo Grasas monoinsaturadas (tabla PDF) */
const GRASAS_MONOINSATURADAS_INGREDIENTS = new Set([
  "Aceite de aguacate",
  "Aceite de canola",
  "Aceite de oliva",
  "Aceitunas deshuesadas",
  "Aguacate común",
  "Aguacate Hass",
  "Mantequilla de Maní",
  "Margarinas suaves, sin sal",
  "Salsa Pesto",
  "Grasas monoinsaturadas adultos y niños",
  "Grasas monoinsaturadas menores de 2 años",
]);

/** Ingredientes del grupo Verduras y hortalizas (tabla PDF) */
const VERDURAS_HORTALIZAS_INGREDIENTS = new Set([
  "Arveja verde",
  "Auyama",
  "Baby carrots",
  "Brócoli crudo sin hojas, ni tallos",
  "Cebolla blanca cruda",
  "Cebolla puerro",
  "Cebolla roja",
  "Champiñón tajado",
  "Champiñones",
  "Champiñones enlatados",
  "Chócolo desgranado",
  "Cidrayota",
  "Coliflor",
  "Espárragos enlatados",
  "Habichuela",
  "Habichuelas enlatadas",
  "Palmitos enlatados",
  "Pepinillos agridulc.",
  "Pimentón rojo",
  "Rábano con cáscara",
  "Remolacha, cocida",
  "Tomate chonto",
  "Tomate larga vida",
  "Tomate riñón",
  "Tomate rojo maduro enlatado",
  "Zanahoria",
  "Verduras y hortalizas adultos y niños",
]);

/** Ingredientes del grupo Nueces (tabla PDF) */
const NUECES_INGREDIENTS = new Set([
  "Almendras tostadas sin sal",
  "Avellanas tostada sin sal",
  "Coco deshidratado",
  "Coco fresco rallado",
  "Macadamia tostado sin sal",
  "Maní sin sal",
  "Marañón tostado sin sal",
  "Mezcla de nueces",
  "Nuez del Brasil",
  "Nuez del nogal",
  "Pacanas tostadas sin sal",
  "Pistacho crudo sin cáscara",
  "Pistacho tostado y salado sin cáscara",
  "Nueces adultos y niños",
]);

/** Ingredientes del grupo Bebidas no alcoholicas (tabla PDF) */
const BEBIDAS_NO_ALCOHOLICAS_INGREDIENTS = new Set([
  "Café instantáneo descafeinado en polvo",
  "Café instantáneo en polvo",
  "Gaseosa azúcarada",
  "Gaseosa diferente al tipo cola endulzada con aspartame, sin cafeína",
  "Gaseosa tipo cola con aspartame, contiene cafeína",
  "Gatorade",
  "Jugo de naranja",
  "Malta",
  "Squash",
  "Té de hiervas",
  "Té instantáneo en polvo, endulzado con sucralosa",
  "Bebidas no alcoholicas adultos y niños",
]);

/** Ingredientes del grupo Bebidas alcoholicas (tabla PDF) */
const BEBIDAS_ALCOHOLICAS_INGREDIENTS = new Set([
  "Aguardiente",
  "Cerveza 3,6 gr %",
  "Cerveza baja caloría 3,2 gr %",
  "Chicha 4%",
  "Crema de menta 29,8%",
  "Daiquiri 23,2 gr %",
  "Ginebra 37,9 gr%",
  "Guarapo 3%",
  "Licor de café 21,75%",
  "Manhattan 36,9%",
  "Martini 38,4%",
  "Piña colada 12,3%",
  "Ron 33, 4 gr %",
  "Tom collins (ginebra 18,9%)",
  "Vino blanco 9,3 gr%",
  "Vino rosado 9,3 gr%",
  "Vino tinto 9,3 gr%",
  "Vodka 33,4 gr%",
  "Whisky 36 gr%",
  "Bebidas alcoholicas adultos y niños",
]);

/** Ingredientes del grupo Mecatos (tabla PDF) */
const MECATOS_INGREDIENTS = new Set([
  "3D triangulos",
  "Boli cheetos",
  "Brownie mama-ia arequipe",
  "Cheese tris",
  "Choclitos limón",
  "Choco poff",
  "Colombineta",
  "Crispetas comerciales de mantequilla",
  "Crispetas comerciales de queso",
  "Crispetas comerciales de caramelo",
  "Doritos arepitas",
  "Doritos mega queso",
  "Mini cheetos",
  "Mini chips chocolate",
  "Mini recreo",
  "Palitos margarita",
  "Papas fritas criollas",
  "Papitas limón",
  "Papitas pollo",
  "Platanitos maduros",
  "Plátanos limón",
  "Rosquitas",
  "Sapito",
  "Tosti arepa",
  "Yogueta",
  "Yupis",
  "Mecatos adultos y niños",
]);

/** Ingredientes del grupo Azúcares y dulces niños y niñas (tabla PDF) */
const AZUCARES_NINOS_INGREDIENTS = new Set([
  "Arequipe",
  "Avena instantánea saborizada",
  "Azúcar blanca granulada",
  "Barquillos",
  "Bebida achocolatada instantánea con azúcar",
  "Bebida de fruta caja",
  "Bebida de té instantáneo con azúcar",
  "Bebida malta",
  "Brevas almíbar drenadas",
  "Caramelos",
  "Ciruelas pasas",
  "Cóctel de frutas",
  "Confites duros",
  "Durazno enlatado",
  "Gaseosa",
  "Gelatina con azúcar preparada",
  "Gelatina de pata",
  "Gomita tradicional",
  "Jarabe de maple",
  "Leche condensada",
  "Masmelos",
  "Mermelada",
  "Mermelada light",
  "Miel de abejas",
  "Panela en polvo",
  "Panelita de arequipe",
  "Piña enlatada",
  "Ponqué mediano tradicional",
  "Postre gelatina-leche",
  "Azucares y dulces niños y niñas",
]);

/** Ingredientes del grupo Azúcares y dulces adultos (tabla PDF) */
const AZUCARES_DULCES_INGREDIENTS = new Set([
  "Arequipe",
  "Azúcar blanca granulada",
  "Bebida achocolatada instantánea con azúcar",
  "Bebida de fruta azucarada",
  "Bebida de té instantáneo con azúcar",
  "Bebida de té líquida",
  "Bebida malta",
  "Bocadillo de guayaba",
  "Brevas almíbar drenadas",
  "Caramelos",
  "Cerezas en almíbar",
  "Chocolatina blanca comercial",
  "Chocolatina de leche",
  "Ciruelas pasas",
  "Cocada de panela",
  "Cóctel de frutas",
  "Confites duros",
  "Cucas",
  "Durazno enlatado",
  "Gaseosa",
  "Gelatina con azúcar preparada",
  "Gelatina de pata",
  "Gomita tradicional",
  "Helado de agua",
  "Helado de vainilla",
  "Jarabe de maple",
  "Leche condensada",
  "Masmelos",
  "Mermelada",
  "Mermelada light",
  "Miel de abejas",
  "Panela en polvo",
  "Panelita de arequipe",
  "Piña enlatada",
  "Ponqué cubierto de chocolate comercial",
  "Ponqué mediano tradicional",
  "Postre gelatina-leche",
  "Azucares y dulces adultos",
]);

/** Ingredientes del grupo Semillas (tabla PDF) */
const SEMILLAS_INGREDIENTS = new Set([
  "Linaza entera",
  "Linaza pulverizada",
  "Semillas de ajonjolí tostado",
  "Semillas de amapola",
  "Semillas de calabaza",
  "Semillas de girasol descortezado",
  "Semillas de soya",
  "Semillas adultos y niños",
]);

/** Ingredientes del grupo Grasas poliinsaturadas (tabla PDF) */
const GRASAS_POLIINSATURADAS_INGREDIENTS = new Set([
  "Aceite de ajonjolí",
  "Aceite de girasol",
  "Aceite de maíz",
  "Aceite de soya",
  "Mayonesa regular comercial",
  "Salsa Ranch",
  "Salsa Tartara",
  "Vinagreta con grasa (Aderezos)",
  "Grasas poliinsaturadas",
]);

/** Ingredientes del grupo Leguminosas niños y niñas (tabla PDF) */
const LEGUMINOSAS_NINOS_INGREDIENTS = new Set([
  "Frijol blanquillo con guiso (niños)",
  "Frijol bola roja con plátano verde (niños)",
  "Frijol cabecita negra con guiso (niños)",
  "Frijol caraota con guiso (niños)",
  "Frijol cargamanto blanco con plátano verde (niños)",
  "Frijol cargamanto rosado con plátano verde (niños)",
  "Frijol nima con guiso (niños)",
  "Frijol verde con plátano verde (niños)",
  "Frijol zaragoza con guiso (niños)",
  "Garbanzo con guiso (niños)",
  "Lenteja con guiso (niños)",
  "Soya con guiso (niños)",
  "Leguminosas niños",
]);

/** Ingredientes del grupo Leguminosas adultos (tabla PDF) */
const LEGUMINOSAS_ADULTOS_INGREDIENTS = new Set([
  "Arveja seca cocida",
  "Frijol blanquillo con guiso",
  "Frijol bola roja con plátano verde",
  "Frijol cabecita negra con guiso",
  "Frijol caraota con guiso",
  "Frijol cargamanto blanco con plátano verde",
  "Frijol cargamanto rosado con plátano verde",
  "Frijol nima con guiso",
  "Frijol verde con plátano verde",
  "Frijol zaragoza con guiso",
  "Garbanzo con guiso",
  "Lenteja con guiso",
  "Soya con guiso",
  "Leguminosas adultos",
]);

/** Ingredientes del grupo Carnes crudas altas en lípidos (tabla PDF) */
const CARNES_ALTAS_LIPIDOS_INGREDIENTS = new Set([
  "Alas de pollo carne y piel",
  "Bagre carne y piel",
  "Callo o panza",
  "Camarón especies mezcladas",
  "Contramuslo de pollo sin hueso y con piel",
  "Hígado de pollo",
  "Hígado de res",
  "Langostino especies mezcladas",
  "Lengua de res",
  "Sardina enlatada en salsa de tomate",
  "Carnes crudas altas en lípidos adultos y niños",
]);

/** Ingredientes del grupo Carnes magras crudas y proteínas texturizadas (tabla PDF) */
const CARNES_MAGRAS_INGREDIENTS = new Set([
  "Atún enlatado en agua, sólidos",
  "Carne de cabra o chivo",
  "Carne de cerdo lomo o cañón magro",
  "Carne de conejo todos los cortes",
  "Carne de cordero diferentes cortes grasa menor 10%",
  "Carne de Cuy o cuy",
  "Carne de res todos los cortes magra",
  "Carne de ternera diferentes cortes magra",
  "Chuleta de cerdo magro",
  "Contramuslo de pollo, carne sin piel",
  "Muslo de pollo, carne sin piel",
  "Pargo especies mezcladas",
  "Pavo todas las carnes sin piel",
  "Pechuga de pollo, carne sin piel",
  "Proteina de soya texturizada hidratada",
  "Proteina de trigo texturizada hidratada",
  "Salmon rosado, crudo",
  "Trucha arcoiris",
  "Carnes magras crudas y proteínas texturizada adultos y niños",
]);

/** Ingredientes del grupo Sustitutos (tabla PDF) */
const SUSTITUTOS_INGREDIENTS = new Set([
  "Butifarra",
  "Cuajada de leche de vaca",
  "Huevo de gallina crudo",
  "Huevos de codorniz crudo",
  "Jamón de Cerdo (97% libre de grasa y 25% reducido en sodio)",
  "Jamón de Pavo",
  "Morcilla",
  "Mortadela común",
  "Pepperoni",
  "Quesito",
  "Queso Americano",
  "Queso búfala tipo mozzarella fresco graso de pasta hilada",
  "Queso Campesino (fresco semiduro, graso)",
  "Queso Cheddar",
  "Queso Costeño rallado",
  "Queso de Cabra",
  "Queso fresco de pasta hilada, semiduro, semigraso (Finesse)",
  "Queso fresco semiduro graso",
  "Queso Gouda",
  "Queso mozzarella de leche entera de vaca semiduro, semigraso",
  "Queso Parmesano rallado",
  "Queso Ricotta (de leche semidescremada)",
  "Queso sabana (Edam)",
  "Queso Tipo Pera",
  "Salami",
  "Salchicha tradicional",
  "Salchicha vegetariana",
  "Salchichón cervecero",
  "Salchichón de pollo",
]);

/** Mapeo de nombre de ingrediente -> grupo para filtrar por categoría */
export function getIngredientGroup(ingredientName: string): string {
  if (LECHE_ENTERA_FRESCA_INGREDIENTS.has(ingredientName)) return "Leche entera fresca y fermentada";
  if (LECHE_SEMIDESCREMADA_FRESCA_INGREDIENTS.has(ingredientName)) return "Leche semidescremada fresca y fermentada";
  if (LECHE_DESCREMADA_FRESCA_INGREDIENTS.has(ingredientName)) return "Leche descremada fresca y fermentada";
  if (LECHE_ENTERA_ALTAS_CALORIAS_INGREDIENTS.has(ingredientName)) return "Leche entera alta en calorías y azúcares";
  if (SUSTITUTOS_INGREDIENTS.has(ingredientName)) return "Sustitutos";
  if (CARNES_MAGRAS_INGREDIENTS.has(ingredientName)) return "Carnes magras crudas y proteínas texturizadas";
  if (CARNES_ALTAS_LIPIDOS_INGREDIENTS.has(ingredientName)) return "Carnes crudas altas en lípidos";
  if (LEGUMINOSAS_ADULTOS_INGREDIENTS.has(ingredientName)) return "Leguminosas adultos";
  if (LEGUMINOSAS_NINOS_INGREDIENTS.has(ingredientName)) return "Leguminosas niños y niñas";
  if (CEREALES_ADULTOS_INGREDIENTS.has(ingredientName)) return "Cereales adultos";
  if (RAICES_TUBERCULOS_PLATANOS_ADULTOS_INGREDIENTS.has(ingredientName)) return "Raíces, Tubérculos y Plátanos adultos";
  if (RAICES_TUBERCULOS_PLATANOS_NINOS_INGREDIENTS.has(ingredientName)) return "Raíces, tubérculos y plátanos niños y niñas";
  if (CEREALES_NINOS_INGREDIENTS.has(ingredientName)) return "Cereales niños y niñas";
  if (FRUTAS_INGREDIENTS.has(ingredientName)) return "Frutas";
  if (VERDURAS_HORTALIZAS_INGREDIENTS.has(ingredientName)) return "Verduras y hortalizas";
  if (NUECES_INGREDIENTS.has(ingredientName)) return "Nueces";
  if (SEMILLAS_INGREDIENTS.has(ingredientName)) return "Semillas";
  if (AZUCARES_NINOS_INGREDIENTS.has(ingredientName)) return "Azúcares y dulces niños y niñas";
  if (AZUCARES_DULCES_INGREDIENTS.has(ingredientName)) return "Azúcares y dulces";
  if (MECATOS_INGREDIENTS.has(ingredientName)) return "Mecatos";
  if (BEBIDAS_ALCOHOLICAS_INGREDIENTS.has(ingredientName)) return "Bebidas alcoholicas";
  if (BEBIDAS_NO_ALCOHOLICAS_INGREDIENTS.has(ingredientName)) return "Bebidas no alcoholicas";
  if (PRODUCTOS_REDUCCION_GRASA_INGREDIENTS.has(ingredientName)) return "Productos con reducción de grasa";
  if (GRASAS_SATURADAS_INGREDIENTS.has(ingredientName)) return "Grasas saturadas";
  if (GRASAS_MONOINSATURADAS_INGREDIENTS.has(ingredientName)) return "Grasas monoinsaturadas";
  if (GRASAS_POLIINSATURADAS_INGREDIENTS.has(ingredientName)) return "Grasas poliinsaturadas";
  return "Otros";
}

/** Grupos disponibles para el selector de ingredientes */
export const FOOD_INGREDIENT_GROUPS: string[] = [
  "Todos",
  "Leche entera fresca y fermentada",
  "Leche semidescremada fresca y fermentada",
  "Leche descremada fresca y fermentada",
  "Leche entera alta en calorías y azúcares",
  "Sustitutos",
  "Carnes magras crudas y proteínas texturizadas",
  "Carnes crudas altas en lípidos",
  "Leguminosas adultos",
  "Leguminosas niños y niñas",
  "Cereales adultos",
  "Raíces, Tubérculos y Plátanos adultos",
  "Raíces, tubérculos y plátanos niños y niñas",
  "Cereales niños y niñas",
  "Frutas",
  "Verduras y hortalizas",
  "Nueces",
  "Semillas",
  "Azúcares y dulces",
  "Azúcares y dulces niños y niñas",
  "Mecatos",
  "Bebidas alcoholicas",
  "Bebidas no alcoholicas",
  "Productos con reducción de grasa",
  "Grasas saturadas",
  "Grasas monoinsaturadas",
  "Grasas poliinsaturadas",
];

/** Grupos visibles en el filtro (sin "Todos"); "Todos" muestra solo ingredientes de estos grupos */
const VISIBLE_GROUPS = new Set(FOOD_INGREDIENT_GROUPS.filter((g) => g !== "Todos"));

/** Ingredientes filtrados por grupo. "Todos" = solo ingredientes de los grupos que están en el filtro */
export function getIngredientsByGroup(group: string): string[] {
  if (group === "Todos") {
    return FOOD_INGREDIENTS_LIST.filter((name) => VISIBLE_GROUPS.has(getIngredientGroup(name)));
  }
  return FOOD_INGREDIENTS_LIST.filter((name) => getIngredientGroup(name) === group);
}

/** Orden de filas para la tabla de composición "Leche entera fresca y fermentada" (incluye Promedio al final) */
export const LECHE_ENTERA_TABLE_ORDER: string[] = [
  "Kamis de leche entera",
  "Leche de cabra cruda",
  "Leche de vaca entera cruda",
  "Leche de vaca entera en polvo",
  "Leche de vaca entera pasteurizada",
  "Yogurt regular de leche entera",
  "Leches enteras frescas y fermentadas", // Promedio
];

/** Filas para la tabla de composición del grupo Leche entera (nombre + datos por porción) */
export interface CompositionTableRow {
  name: string;
  portion_grams?: number;
  unit_measure?: string;
  kcal: number;
  prot: number;
  grasa: number;
  gs: number;
  gm: number;
  gp: number;
  col: number;
  chos: number;
  fd: number;
  calcio: number;
  p: number;
  fe: number;
}


export function getLecheEnteraCompositionRows(): CompositionTableRow[] {
  return LECHE_ENTERA_TABLE_ORDER.map((name) => {
    const data = FOOD_NUTRIENTS[name];
    if (!data) return null;
    return {
      name: name === "Leches enteras frescas y fermentadas" ? "Promedio" : name,
      portion_grams: data.portion_grams,
      unit_measure: data.unit_measure,
      kcal: data.kcal,
      prot: data.prot,
      grasa: data.grasa,
      gs: data.gs,
      gm: data.gm,
      gp: data.gp,
      col: data.col,
      chos: data.chos,
      fd: data.fd,
      calcio: data.calcio ?? 0,
      p: data.p ?? 0,
      fe: data.fe ?? 0,
    };
  }).filter((r) => r !== null) as CompositionTableRow[];
}

/** Orden de filas para la tabla "Leche semidescremada fresca y fermentada" (incluye Promedio al final) */
export const LECHE_SEMIDESCREMADA_TABLE_ORDER: string[] = [
  "Avena líquida con leche de vaca descremada",
  "Bebida de Soya comercial",
  "Leche de vaca semidescremada en polvo",
  "Leche de vaca semidescremada pasteurizada (con o sin lactosa)",
  "Yogurt de leche entera - Yox",
  "Yogurt de leche entera cuchareable",
  "Leches semidescremadas frescas y fermentadas", // Promedio
];

export function getLecheSemidescremadaCompositionRows(): CompositionTableRow[] {
  return LECHE_SEMIDESCREMADA_TABLE_ORDER.map((name) => {
    const data = FOOD_NUTRIENTS[name];
    if (!data) return null;
    return {
      name: name === "Leches semidescremadas frescas y fermentadas" ? "Promedio" : name,
      portion_grams: data.portion_grams,
      unit_measure: data.unit_measure,
      kcal: data.kcal,
      prot: data.prot,
      grasa: data.grasa,
      gs: data.gs,
      gm: data.gm,
      gp: data.gp,
      col: data.col,
      chos: data.chos,
      fd: data.fd,
      calcio: data.calcio ?? 0,
      p: data.p ?? 0,
      fe: data.fe ?? 0,
    };
  }).filter((r) => r !== null) as CompositionTableRow[];
}

/** Orden de filas para la tabla "Leche descremada fresca y fermentada" (incluye Promedio al final) */
export const LECHE_DESCREMADA_TABLE_ORDER: string[] = [
  "Leche de vaca descremada en polvo",
  "Leche de vaca descremada pasteurizada",
  "Yogurt de leche descremada",
  "Yogurt Griego natural",
  "Leches descremadas frescas y fermentadas", // Promedio
];

export function getLecheDescremadaCompositionRows(): CompositionTableRow[] {
  return LECHE_DESCREMADA_TABLE_ORDER.map((name) => {
    const data = FOOD_NUTRIENTS[name];
    if (!data) return null;
    return {
      name: name === "Leches descremadas frescas y fermentadas" ? "Promedio" : name,
      portion_grams: data.portion_grams,
      unit_measure: data.unit_measure,
      kcal: data.kcal,
      prot: data.prot,
      grasa: data.grasa,
      gs: data.gs,
      gm: data.gm,
      gp: data.gp,
      col: data.col,
      chos: data.chos,
      fd: data.fd,
      calcio: data.calcio ?? 0,
      p: data.p ?? 0,
      fe: data.fe ?? 0,
    };
  }).filter((r) => r !== null) as CompositionTableRow[];
}

/** Orden de filas para la tabla "Leche entera alta en calorías y azúcares" (incluye Promedio al final) */
export const LECHE_ENTERA_ALTAS_CALORIAS_TABLE_ORDER: string[] = [
  "Avena con leche de vaca entera comercial",
  "Kumis de leche entera azucarado",
  "Leche de vaca entera chocolatada",
  "Yogurt de leche entera azucarado",
  "Leches frescas y fermentadas enteras altas en calorías y azucares", // Promedio
];

export function getLecheEnteraAltasCaloriasCompositionRows(): CompositionTableRow[] {
  return LECHE_ENTERA_ALTAS_CALORIAS_TABLE_ORDER.map((name) => {
    const data = FOOD_NUTRIENTS[name];
    if (!data) return null;
    return {
      name: name === "Leches frescas y fermentadas enteras altas en calorías y azucares" ? "Promedio" : name,
      portion_grams: data.portion_grams,
      unit_measure: data.unit_measure,
      kcal: data.kcal,
      prot: data.prot,
      grasa: data.grasa,
      gs: data.gs,
      gm: data.gm,
      gp: data.gp,
      col: data.col,
      chos: data.chos,
      fd: data.fd,
      calcio: data.calcio ?? 0,
      p: data.p ?? 0,
      fe: data.fe ?? 0,
    };
  }).filter((r) => r !== null) as CompositionTableRow[];
}

/** Orden de filas para la tabla Sustitutos */
export const SUSTITUTOS_TABLE_ORDER: string[] = [
  "Butifarra",
  "Cuajada de leche de vaca",
  "Huevo de gallina crudo",
  "Huevos de codorniz crudo",
  "Jamón de Cerdo (97% libre de grasa y 25% reducido en sodio)",
  "Jamón de Pavo",
  "Morcilla",
  "Mortadela común",
  "Pepperoni",
  "Quesito",
  "Queso Americano",
  "Queso búfala tipo mozzarella fresco graso de pasta hilada",
  "Queso Campesino (fresco semiduro, graso)",
  "Queso Cheddar",
  "Queso Costeño rallado",
  "Queso de Cabra",
  "Queso fresco de pasta hilada, semiduro, semigraso (Finesse)",
  "Queso fresco semiduro graso",
  "Queso Gouda",
  "Queso mozzarella de leche entera de vaca semiduro, semigraso",
  "Queso Parmesano rallado",
  "Queso Ricotta (de leche semidescremada)",
  "Queso sabana (Edam)",
  "Queso Tipo Pera",
  "Salami",
  "Salchicha tradicional",
  "Salchicha vegetariana",
  "Salchichón cervecero",
  "Salchichón de pollo",
];

export function getSustitutosCompositionRows(): CompositionTableRow[] {
  return SUSTITUTOS_TABLE_ORDER.map((name) => {
    const data = FOOD_NUTRIENTS[name];
    if (!data) return null;
    return {
      name,
      portion_grams: data.portion_grams,
      unit_measure: data.unit_measure,
      kcal: data.kcal,
      prot: data.prot,
      grasa: data.grasa,
      gs: data.gs,
      gm: data.gm,
      gp: data.gp,
      col: data.col,
      chos: data.chos,
      fd: data.fd,
      calcio: data.calcio ?? 0,
      p: data.p ?? 0,
      fe: data.fe ?? 0,
    };
  }).filter((r) => r !== null) as CompositionTableRow[];
}

/** Orden de filas para la tabla Carnes magras crudas y proteínas texturizadas (incluye Promedio al final) */
export const CARNES_MAGRAS_TABLE_ORDER: string[] = [
  "Atún enlatado en agua, sólidos",
  "Carne de cabra o chivo",
  "Carne de cerdo lomo o cañón magro",
  "Carne de conejo todos los cortes",
  "Carne de cordero diferentes cortes grasa menor 10%",
  "Carne de Cuy o cuy",
  "Carne de res todos los cortes magra",
  "Carne de ternera diferentes cortes magra",
  "Chuleta de cerdo magro",
  "Contramuslo de pollo, carne sin piel",
  "Muslo de pollo, carne sin piel",
  "Pargo especies mezcladas",
  "Pavo todas las carnes sin piel",
  "Pechuga de pollo, carne sin piel",
  "Proteina de soya texturizada hidratada",
  "Proteina de trigo texturizada hidratada",
  "Salmon rosado, crudo",
  "Trucha arcoiris",
  "Carnes magras crudas y proteínas texturizada adultos y niños", // Promedio
];

export function getCarnesMagrasCompositionRows(): CompositionTableRow[] {
  return CARNES_MAGRAS_TABLE_ORDER.map((name) => {
    const data = FOOD_NUTRIENTS[name];
    if (!data) return null;
    return {
      name: name === "Carnes magras crudas y proteínas texturizada adultos y niños" ? "Promedio" : name,
      portion_grams: data.portion_grams,
      unit_measure: data.unit_measure,
      kcal: data.kcal,
      prot: data.prot,
      grasa: data.grasa,
      gs: data.gs,
      gm: data.gm,
      gp: data.gp,
      col: data.col,
      chos: data.chos,
      fd: data.fd,
      calcio: data.calcio ?? 0,
      p: data.p ?? 0,
      fe: data.fe ?? 0,
    };
  }).filter((r) => r !== null) as CompositionTableRow[];
}

/** Orden de filas para la tabla Carnes crudas altas en lípidos (incluye Promedio al final) */
export const CARNES_ALTAS_LIPIDOS_TABLE_ORDER: string[] = [
  "Alas de pollo carne y piel",
  "Bagre carne y piel",
  "Callo o panza",
  "Camarón especies mezcladas",
  "Contramuslo de pollo sin hueso y con piel",
  "Hígado de pollo",
  "Hígado de res",
  "Langostino especies mezcladas",
  "Lengua de res",
  "Sardina enlatada en salsa de tomate",
  "Carnes crudas altas en lípidos adultos y niños", // Promedio
];

export function getCarnesAltasLipidosCompositionRows(): CompositionTableRow[] {
  return CARNES_ALTAS_LIPIDOS_TABLE_ORDER.map((name) => {
    const data = FOOD_NUTRIENTS[name];
    if (!data) return null;
    return {
      name: name === "Carnes crudas altas en lípidos adultos y niños" ? "Promedio" : name,
      portion_grams: data.portion_grams,
      unit_measure: data.unit_measure,
      kcal: data.kcal,
      prot: data.prot,
      grasa: data.grasa,
      gs: data.gs,
      gm: data.gm,
      gp: data.gp,
      col: data.col,
      chos: data.chos,
      fd: data.fd,
      calcio: data.calcio ?? 0,
      p: data.p ?? 0,
      fe: data.fe ?? 0,
    };
  }).filter((r) => r !== null) as CompositionTableRow[];
}

/** Orden de filas para la tabla Leguminosas adultos (incluye Promedio al final) */
export const LEGUMINOSAS_ADULTOS_TABLE_ORDER: string[] = [
  "Arveja seca cocida",
  "Frijol blanquillo con guiso",
  "Frijol bola roja con plátano verde",
  "Frijol cabecita negra con guiso",
  "Frijol caraota con guiso",
  "Frijol cargamanto blanco con plátano verde",
  "Frijol cargamanto rosado con plátano verde",
  "Frijol nima con guiso",
  "Frijol verde con plátano verde",
  "Frijol zaragoza con guiso",
  "Garbanzo con guiso",
  "Lenteja con guiso",
  "Soya con guiso",
  "Leguminosas adultos", // Promedio
];

export function getLeguminosasAdultosCompositionRows(): CompositionTableRow[] {
  return LEGUMINOSAS_ADULTOS_TABLE_ORDER.map((name) => {
    const data = FOOD_NUTRIENTS[name];
    if (!data) return null;
    return {
      name: name === "Leguminosas adultos" ? "Promedio" : name,
      portion_grams: data.portion_grams,
      unit_measure: data.unit_measure,
      kcal: data.kcal,
      prot: data.prot,
      grasa: data.grasa,
      gs: data.gs,
      gm: data.gm,
      gp: data.gp,
      col: data.col,
      chos: data.chos,
      fd: data.fd,
      calcio: data.calcio ?? 0,
      p: data.p ?? 0,
      fe: data.fe ?? 0,
    };
  }).filter((r) => r !== null) as CompositionTableRow[];
}

/** Orden de filas para la tabla Leguminosas niños y niñas (incluye Promedio al final) */
export const LEGUMINOSAS_NINOS_TABLE_ORDER: string[] = [
  "Frijol blanquillo con guiso (niños)",
  "Frijol bola roja con plátano verde (niños)",
  "Frijol cabecita negra con guiso (niños)",
  "Frijol caraota con guiso (niños)",
  "Frijol cargamanto blanco con plátano verde (niños)",
  "Frijol cargamanto rosado con plátano verde (niños)",
  "Frijol nima con guiso (niños)",
  "Frijol verde con plátano verde (niños)",
  "Frijol zaragoza con guiso (niños)",
  "Garbanzo con guiso (niños)",
  "Lenteja con guiso (niños)",
  "Soya con guiso (niños)",
  "Leguminosas niños", // Promedio
];

export function getLeguminosasNinosCompositionRows(): CompositionTableRow[] {
  return LEGUMINOSAS_NINOS_TABLE_ORDER.map((name) => {
    const data = FOOD_NUTRIENTS[name];
    if (!data) return null;
    return {
      name: name === "Leguminosas niños" ? "Promedio" : name,
      portion_grams: data.portion_grams,
      unit_measure: data.unit_measure,
      kcal: data.kcal,
      prot: data.prot,
      grasa: data.grasa,
      gs: data.gs,
      gm: data.gm,
      gp: data.gp,
      col: data.col,
      chos: data.chos,
      fd: data.fd,
      calcio: data.calcio ?? 0,
      p: data.p ?? 0,
      fe: data.fe ?? 0,
    };
  }).filter((r) => r !== null) as CompositionTableRow[];
}

/** Orden de filas para la tabla Raíces, tubérculos y plátanos niños y niñas (incluye Promedio al final) */
export const RAICES_TUBERCULOS_PLATANOS_NINOS_TABLE_ORDER: string[] = [
  "Arracacha (niños)",
  "Batata (niños)",
  "Chuguas u ollucos (niños)",
  "Cubios (niños)",
  "Harina de plátano (niños)",
  "Ñame (niños)",
  "Papa común (niños)",
  "Papa criolla (niños)",
  "Plátano colí o guineo (niños)",
  "Plátano hartón maduro (niños)",
  "Plátano verde (niños)",
  "Yuca blanca (niños)",
  "Raíces, tubérculos y plátanos niños y niñas",
];

export function getRaicesTuberculosPlatanosNinosCompositionRows(): CompositionTableRow[] {
  return RAICES_TUBERCULOS_PLATANOS_NINOS_TABLE_ORDER.map((name) => {
    const data = FOOD_NUTRIENTS[name];
    if (!data) return null;
    return {
      name: name === "Raíces, tubérculos y plátanos niños y niñas" ? "Promedio" : name,
      portion_grams: data.portion_grams,
      unit_measure: data.unit_measure,
      kcal: data.kcal,
      prot: data.prot,
      grasa: data.grasa,
      gs: data.gs,
      gm: data.gm,
      gp: data.gp,
      col: data.col,
      chos: data.chos,
      fd: data.fd,
      calcio: data.calcio ?? 0,
      p: data.p ?? 0,
      fe: data.fe ?? 0,
    };
  }).filter((r) => r !== null) as CompositionTableRow[];
}

/** Orden de filas para la tabla Cereales adultos (incluye Promedio al final) */
export const CEREALES_ADULTOS_TABLE_ORDER: string[] = [
  "Almojábana",
  "Arepa delgada de maíz blanco trillado",
  "Arepa redonda de maíz blanco trillado",
  "Arroz blanco, cocido",
  "Arroz integral, cocido",
  "Arroz parbolizado cocido",
  "Avena en hojuelas fortificada",
  "Cebada perlada cocida",
  "Choco Krispis",
  "Corn Flakes",
  "Cuchuco de cebada",
  "Espaguetis de arroz, hidratados",
  "Espaguetis de trigo, cocidos",
  "Froot Loops",
  "Galletas Saltinas",
  "Harina de arroz blanco",
  "Harina de maíz blanco trillado",
  "Harina de trigo enriquecida",
  "Macarrones, cocidos",
  "Maicena (almidón de maíz)",
  "Maíz pira, crudo",
  "Maíz tierno o choclo, amarillo enlatado",
  "Maíz tostado comercial",
  "Mazamorra Antioqueña (maíz cocido)",
  "Palitos o palitroques",
  "Pan blanco",
  "Pan centeno",
  "Pan de salvado de avena",
  "Pan integral",
  "Pan pita o árabe",
  "Pancake (mezcla preparada con leche entera)",
  "Pandequeso",
  "Pandeyuca",
  "Pasta corta cocida",
  "Seba Seba",
  "Taco vacío",
  "Tortilla de maíz",
  "Tostada o calado",
  "Zucaritas",
  "Cereales adultos",
];

export function getCerealesAdultosCompositionRows(): CompositionTableRow[] {
  return CEREALES_ADULTOS_TABLE_ORDER.map((name) => {
    const data = FOOD_NUTRIENTS[name];
    if (!data) return null;
    return {
      name: name === "Cereales adultos" ? "Promedio" : name,
      portion_grams: data.portion_grams,
      unit_measure: data.unit_measure,
      kcal: data.kcal,
      prot: data.prot,
      grasa: data.grasa,
      gs: data.gs,
      gm: data.gm,
      gp: data.gp,
      col: data.col,
      chos: data.chos,
      fd: data.fd,
      calcio: data.calcio ?? 0,
      p: data.p ?? 0,
      fe: data.fe ?? 0,
    };
  }).filter((r) => r !== null) as CompositionTableRow[];
}

/** Orden de filas para la tabla Raíces, Tubérculos y Plátanos adultos (incluye Promedio al final) */
export const RAICES_TUBERCULOS_PLATANOS_ADULTOS_TABLE_ORDER: string[] = [
  "Arracacha",
  "Batata",
  "Chuguas u ollucos",
  "Cubios",
  "Harina de plátano",
  "Ñame",
  "Papa común",
  "Papa criolla",
  "Plátano colí o guineo",
  "Plátano hartón maduro",
  "Plátano verde",
  "Yuca blanca",
  "Raíces, Tubérculos y Plátanos adultos",
];

export function getRaicesTuberculosPlatanosAdultosCompositionRows(): CompositionTableRow[] {
  return RAICES_TUBERCULOS_PLATANOS_ADULTOS_TABLE_ORDER.map((name) => {
    const data = FOOD_NUTRIENTS[name];
    if (!data) return null;
    return {
      name: name === "Raíces, Tubérculos y Plátanos adultos" ? "Promedio" : name,
      portion_grams: data.portion_grams,
      unit_measure: data.unit_measure,
      kcal: data.kcal,
      prot: data.prot,
      grasa: data.grasa,
      gs: data.gs,
      gm: data.gm,
      gp: data.gp,
      col: data.col,
      chos: data.chos,
      fd: data.fd,
      calcio: data.calcio ?? 0,
      p: data.p ?? 0,
      fe: data.fe ?? 0,
    };
  }).filter((r) => r !== null) as CompositionTableRow[];
}

/** Orden de filas para la tabla Cereales niños y niñas (incluye Promedio al final) */
export const CEREALES_NINOS_TABLE_ORDER: string[] = [
  "Almojábana (niños)",
  "Arepa redonda de maíz blanco trillado (niños)",
  "Arroz blanco, cocido (niños)",
  "Arroz integral, cocido (niños)",
  "Arroz parbolizado cocido (niños)",
  "Avena en hojuelas fortificada (niños)",
  "Cebada perlada cocida (niños)",
  "Choco Krispis (niños)",
  "Corn Flakes (niños)",
  "Cuchuco de cebada, crudo (niños)",
  "Espaguetis de arroz, hidratados (niños)",
  "Espaguetis de trigo, cocidos (niños)",
  "Froot Loops (niños)",
  "Galletas Saltinas (niños)",
  "Harina de trigo enriquecida (niños)",
  "Macarrones, cocidos (niños)",
  "Maicena (almidón de maíz) (niños)",
  "Maíz pira, crudo (niños)",
  "Maíz tierno o choclo, amarillo enlatado (niños)",
  "Mazamorra Antioqueña (maíz cocido) (niños)",
  "Palitos o palitroques (niños)",
  "Pan blanco (niños)",
  "Pan centeno (niños)",
  "Pan de salvado de avena (niños)",
  "Pan integral (niños)",
  "Pan pita o árabe (niños)",
  "Pancake (mezcla preparada con leche entera) (niños)",
  "Pandequeso (niños)",
  "Pandeyuca (niños)",
  "Pasta corta cocida (niños)",
  "Seba Seba (niños)",
  "Taco vacío (niños)",
  "Tortilla de maíz (niños)",
  "Tostada o calado (niños)",
  "Zucaritas (niños)",
  "Cereales niños y niñas",
];

export function getCerealesNinosCompositionRows(): CompositionTableRow[] {
  return CEREALES_NINOS_TABLE_ORDER.map((name) => {
    const data = FOOD_NUTRIENTS[name];
    if (!data) return null;
    return {
      name: name === "Cereales niños y niñas" ? "Promedio" : name,
      portion_grams: data.portion_grams,
      unit_measure: data.unit_measure,
      kcal: data.kcal,
      prot: data.prot,
      grasa: data.grasa,
      gs: data.gs,
      gm: data.gm,
      gp: data.gp,
      col: data.col,
      chos: data.chos,
      fd: data.fd,
      calcio: data.calcio ?? 0,
      p: data.p ?? 0,
      fe: data.fe ?? 0,
    };
  }).filter((r) => r !== null) as CompositionTableRow[];
}

/** Orden de filas para la tabla Grasas poliinsaturadas (incluye Promedio al final) */
export const FRUTAS_TABLE_ORDER: string[] = [
  "Banano común",
  "Borojó",
  "Chirimoya",
  "Chontaduro",
  "Ciruela claudia",
  "Ciruela común",
  "Curuba",
  "Feijoa",
  "Fresas",
  "Granadilla",
  "Guanabana",
  "Guayaba criolla",
  "Guayaba manzana",
  "Higo",
  "Kiwi",
  "Lulo",
  "Lulo jugo",
  "Mango",
  "Manzana con cascara toda variedad",
  "Maracuyá",
  "Melón",
  "Mora",
  "Murrapo",
  "Naranja",
  "Naranja orlando",
  "Naranja tangelo",
  "Naranja valencia",
  "Papaya",
  "Papayuela",
  "Pera",
  "Piña manzana",
  "Pitahaya",
  "Sandia Baby",
  "Tomate árbol común",
  "Tomate árbol rojo",
  "Uchuva",
  "Zapote sin semilla",
  "Frutas adultos y niños",
];

export const PRODUCTOS_REDUCCION_GRASA_TABLE_ORDER: string[] = [
  "Crema de leche Light",
  "Margarina line (reducida 25%)",
  "Mayonesa Ligth",
  "Queso crema light",
  "Salsa de queso Cheddar",
  "Productos con reducción de grasa adultos y niños",
];

export const GRASAS_SATURADAS_TABLE_ORDER: string[] = [
  "Aceite de palma",
  "Crema agria",
  "Crema de leche líquida, espesa entera",
  "Manteca de cerdo",
  "Mantequilla sin sal",
  "Queso crema",
  "Grasas saturadas adultos y niños",
];

export const GRASAS_MONOINSATURADAS_TABLE_ORDER: string[] = [
  "Aceite de aguacate",
  "Aceite de canola",
  "Aceite de oliva",
  "Aceitunas deshuesadas",
  "Aguacate común",
  "Aguacate Hass",
  "Mantequilla de Maní",
  "Margarinas suaves, sin sal",
  "Salsa Pesto",
  "Grasas monoinsaturadas adultos y niños",
];

export const VERDURAS_TABLE_ORDER: string[] = [
  "Arveja verde",
  "Auyama",
  "Baby carrots",
  "Brócoli crudo sin hojas, ni tallos",
  "Cebolla blanca cruda",
  "Cebolla puerro",
  "Cebolla roja",
  "Champiñón tajado",
  "Champiñones",
  "Champiñones enlatados",
  "Chócolo desgranado",
  "Cidrayota",
  "Coliflor",
  "Espárragos enlatados",
  "Habichuela",
  "Habichuelas enlatadas",
  "Palmitos enlatados",
  "Pepinillos agridulc.",
  "Pimentón rojo",
  "Rábano con cáscara",
  "Remolacha, cocida",
  "Tomate chonto",
  "Tomate larga vida",
  "Tomate riñón",
  "Tomate rojo maduro enlatado",
  "Zanahoria",
  "Verduras y hortalizas adultos y niños",
];

export const NUECES_TABLE_ORDER: string[] = [
  "Almendras tostadas sin sal",
  "Avellanas tostada sin sal",
  "Coco deshidratado",
  "Coco fresco rallado",
  "Macadamia tostado sin sal",
  "Maní sin sal",
  "Marañón tostado sin sal",
  "Mezcla de nueces",
  "Nuez del Brasil",
  "Nuez del nogal",
  "Pacanas tostadas sin sal",
  "Pistacho crudo sin cáscara",
  "Pistacho tostado y salado sin cáscara",
  "Nueces adultos y niños",
];

export const SEMILLAS_TABLE_ORDER: string[] = [
  "Linaza entera",
  "Linaza pulverizada",
  "Semillas de ajonjolí tostado",
  "Semillas de amapola",
  "Semillas de calabaza",
  "Semillas de girasol descortezado",
  "Semillas de soya",
  "Semillas adultos y niños",
];

export const AZUCARES_DULCES_TABLE_ORDER: string[] = [
  "Arequipe",
  "Azúcar blanca granulada",
  "Bebida achocolatada instantánea con azúcar",
  "Bebida de fruta azucarada",
  "Bebida de té instantáneo con azúcar",
  "Bebida de té líquida",
  "Bebida malta",
  "Bocadillo de guayaba",
  "Brevas almíbar drenadas",
  "Caramelos",
  "Cerezas en almíbar",
  "Chocolatina blanca comercial",
  "Chocolatina de leche",
  "Ciruelas pasas",
  "Cocada de panela",
  "Cóctel de frutas",
  "Confites duros",
  "Cucas",
  "Durazno enlatado",
  "Gaseosa",
  "Gelatina con azúcar preparada",
  "Gelatina de pata",
  "Gomita tradicional",
  "Helado de agua",
  "Helado de vainilla",
  "Jarabe de maple",
  "Leche condensada",
  "Masmelos",
  "Mermelada",
  "Mermelada light",
  "Miel de abejas",
  "Panela en polvo",
  "Panelita de arequipe",
  "Piña enlatada",
  "Ponqué cubierto de chocolate comercial",
  "Ponqué mediano tradicional",
  "Postre gelatina-leche",
  "Azucares y dulces adultos",
];

export const AZUCARES_NINOS_TABLE_ORDER: string[] = [
  "Arequipe",
  "Avena instantánea saborizada",
  "Azúcar blanca granulada",
  "Barquillos",
  "Bebida achocolatada instantánea con azúcar",
  "Bebida de fruta caja",
  "Bebida de té instantáneo con azúcar",
  "Bebida malta",
  "Brevas almíbar drenadas",
  "Caramelos",
  "Ciruelas pasas",
  "Cóctel de frutas",
  "Confites duros",
  "Durazno enlatado",
  "Gaseosa",
  "Gelatina con azúcar preparada",
  "Gelatina de pata",
  "Gomita tradicional",
  "Jarabe de maple",
  "Leche condensada",
  "Masmelos",
  "Mermelada",
  "Mermelada light",
  "Miel de abejas",
  "Panela en polvo",
  "Panelita de arequipe",
  "Piña enlatada",
  "Ponqué mediano tradicional",
  "Postre gelatina-leche",
  "Azucares y dulces niños y niñas",
];

export const MECATOS_TABLE_ORDER: string[] = [
  "3D triangulos",
  "Boli cheetos",
  "Brownie mama-ia arequipe",
  "Cheese tris",
  "Choclitos limón",
  "Choco poff",
  "Colombineta",
  "Crispetas comerciales de mantequilla",
  "Crispetas comerciales de queso",
  "Crispetas comerciales de caramelo",
  "Doritos arepitas",
  "Doritos mega queso",
  "Mini cheetos",
  "Mini chips chocolate",
  "Mini recreo",
  "Palitos margarita",
  "Papas fritas criollas",
  "Papitas limón",
  "Papitas pollo",
  "Platanitos maduros",
  "Plátanos limón",
  "Rosquitas",
  "Sapito",
  "Tosti arepa",
  "Yogueta",
  "Yupis",
  "Mecatos adultos y niños",
];

export const BEBIDAS_ALCOHOLICAS_TABLE_ORDER: string[] = [
  "Aguardiente",
  "Cerveza 3,6 gr %",
  "Cerveza baja caloría 3,2 gr %",
  "Chicha 4%",
  "Crema de menta 29,8%",
  "Daiquiri 23,2 gr %",
  "Ginebra 37,9 gr%",
  "Guarapo 3%",
  "Licor de café 21,75%",
  "Manhattan 36,9%",
  "Martini 38,4%",
  "Piña colada 12,3%",
  "Ron 33, 4 gr %",
  "Tom collins (ginebra 18,9%)",
  "Vino blanco 9,3 gr%",
  "Vino rosado 9,3 gr%",
  "Vino tinto 9,3 gr%",
  "Vodka 33,4 gr%",
  "Whisky 36 gr%",
  "Bebidas alcoholicas adultos y niños",
];

export const BEBIDAS_NO_ALCOHOLICAS_TABLE_ORDER: string[] = [
  "Café instantáneo descafeinado en polvo",
  "Café instantáneo en polvo",
  "Gaseosa azúcarada",
  "Gaseosa diferente al tipo cola endulzada con aspartame, sin cafeína",
  "Gaseosa tipo cola con aspartame, contiene cafeína",
  "Gatorade",
  "Jugo de naranja",
  "Malta",
  "Squash",
  "Té de hiervas",
  "Té instantáneo en polvo, endulzado con sucralosa",
  "Bebidas no alcoholicas adultos y niños",
];

export const GRASAS_POLIINSATURADAS_TABLE_ORDER: string[] = [
  "Aceite de ajonjolí",
  "Aceite de girasol",
  "Aceite de maíz",
  "Aceite de soya",
  "Mayonesa regular comercial",
  "Salsa Ranch",
  "Salsa Tartara",
  "Vinagreta con grasa (Aderezos)",
  "Grasas poliinsaturadas",
];

export function getBebidasNoAlcoholicasCompositionRows(): CompositionTableRow[] {
  return BEBIDAS_NO_ALCOHOLICAS_TABLE_ORDER.map((name) => {
    const data = FOOD_NUTRIENTS[name];
    if (!data) return null;
    return {
      name: name === "Bebidas no alcoholicas adultos y niños" ? "Promedio" : name,
      portion_grams: data.portion_grams,
      unit_measure: data.unit_measure,
      kcal: data.kcal,
      prot: data.prot,
      grasa: data.grasa,
      gs: data.gs,
      gm: data.gm,
      gp: data.gp,
      col: data.col,
      chos: data.chos,
      fd: data.fd,
      calcio: data.calcio ?? 0,
      p: data.p ?? 0,
      fe: data.fe ?? 0,
    };
  }).filter((r) => r !== null) as CompositionTableRow[];
}

export function getBebidasAlcoholicasCompositionRows(): CompositionTableRow[] {
  return BEBIDAS_ALCOHOLICAS_TABLE_ORDER.map((name) => {
    const data = FOOD_NUTRIENTS[name];
    if (!data) return null;
    return {
      name: name === "Bebidas alcoholicas adultos y niños" ? "Promedio" : name,
      portion_grams: data.portion_grams,
      unit_measure: data.unit_measure,
      kcal: data.kcal,
      prot: data.prot,
      grasa: data.grasa,
      gs: data.gs,
      gm: data.gm,
      gp: data.gp,
      col: data.col,
      chos: data.chos,
      fd: data.fd,
      calcio: data.calcio ?? 0,
      p: data.p ?? 0,
      fe: data.fe ?? 0,
    };
  }).filter((r) => r !== null) as CompositionTableRow[];
}

export function getMecatosCompositionRows(): CompositionTableRow[] {
  return MECATOS_TABLE_ORDER.map((name) => {
    const data = FOOD_NUTRIENTS[name];
    if (!data) return null;
    return {
      name: name === "Mecatos adultos y niños" ? "Promedio" : name,
      portion_grams: data.portion_grams,
      unit_measure: data.unit_measure,
      kcal: data.kcal,
      prot: data.prot,
      grasa: data.grasa,
      gs: data.gs,
      gm: data.gm,
      gp: data.gp,
      col: data.col,
      chos: data.chos,
      fd: data.fd,
      calcio: data.calcio ?? 0,
      p: data.p ?? 0,
      fe: data.fe ?? 0,
    };
  }).filter((r) => r !== null) as CompositionTableRow[];
}

export function getAzucaresNinosCompositionRows(): CompositionTableRow[] {
  return AZUCARES_NINOS_TABLE_ORDER.map((name) => {
    const data = FOOD_NUTRIENTS[name];
    if (!data) return null;
    return {
      name: name === "Azucares y dulces niños y niñas" ? "Promedio" : name,
      portion_grams: data.portion_grams,
      unit_measure: data.unit_measure,
      kcal: data.kcal,
      prot: data.prot,
      grasa: data.grasa,
      gs: data.gs,
      gm: data.gm,
      gp: data.gp,
      col: data.col,
      chos: data.chos,
      fd: data.fd,
      calcio: data.calcio ?? 0,
      p: data.p ?? 0,
      fe: data.fe ?? 0,
    };
  }).filter((r) => r !== null) as CompositionTableRow[];
}

export function getAzucaresDulcesCompositionRows(): CompositionTableRow[] {
  return AZUCARES_DULCES_TABLE_ORDER.map((name) => {
    const data = FOOD_NUTRIENTS[name];
    if (!data) return null;
    return {
      name: name === "Azucares y dulces adultos" ? "Promedio" : name,
      portion_grams: data.portion_grams,
      unit_measure: data.unit_measure,
      kcal: data.kcal,
      prot: data.prot,
      grasa: data.grasa,
      gs: data.gs,
      gm: data.gm,
      gp: data.gp,
      col: data.col,
      chos: data.chos,
      fd: data.fd,
      calcio: data.calcio ?? 0,
      p: data.p ?? 0,
      fe: data.fe ?? 0,
    };
  }).filter((r) => r !== null) as CompositionTableRow[];
}

export function getSemillasCompositionRows(): CompositionTableRow[] {
  return SEMILLAS_TABLE_ORDER.map((name) => {
    const data = FOOD_NUTRIENTS[name];
    if (!data) return null;
    return {
      name: name === "Semillas adultos y niños" ? "Promedio" : name,
      portion_grams: data.portion_grams,
      unit_measure: data.unit_measure,
      kcal: data.kcal,
      prot: data.prot,
      grasa: data.grasa,
      gs: data.gs,
      gm: data.gm,
      gp: data.gp,
      col: data.col,
      chos: data.chos,
      fd: data.fd,
      calcio: data.calcio ?? 0,
      p: data.p ?? 0,
      fe: data.fe ?? 0,
    };
  }).filter((r) => r !== null) as CompositionTableRow[];
}

export function getNuecesCompositionRows(): CompositionTableRow[] {
  return NUECES_TABLE_ORDER.map((name) => {
    const data = FOOD_NUTRIENTS[name];
    if (!data) return null;
    return {
      name: name === "Nueces adultos y niños" ? "Promedio" : name,
      portion_grams: data.portion_grams,
      unit_measure: data.unit_measure,
      kcal: data.kcal,
      prot: data.prot,
      grasa: data.grasa,
      gs: data.gs,
      gm: data.gm,
      gp: data.gp,
      col: data.col,
      chos: data.chos,
      fd: data.fd,
      calcio: data.calcio ?? 0,
      p: data.p ?? 0,
      fe: data.fe ?? 0,
    };
  }).filter((r) => r !== null) as CompositionTableRow[];
}

export function getVerdurasCompositionRows(): CompositionTableRow[] {
  return VERDURAS_TABLE_ORDER.map((name) => {
    const data = FOOD_NUTRIENTS[name];
    if (!data) return null;
    return {
      name: name === "Verduras y hortalizas adultos y niños" ? "Promedio" : name,
      portion_grams: data.portion_grams,
      unit_measure: data.unit_measure,
      kcal: data.kcal,
      prot: data.prot,
      grasa: data.grasa,
      gs: data.gs,
      gm: data.gm,
      gp: data.gp,
      col: data.col,
      chos: data.chos,
      fd: data.fd,
      calcio: data.calcio ?? 0,
      p: data.p ?? 0,
      fe: data.fe ?? 0,
    };
  }).filter((r) => r !== null) as CompositionTableRow[];
}

export function getFrutasCompositionRows(): CompositionTableRow[] {
  return FRUTAS_TABLE_ORDER.map((name) => {
    const data = FOOD_NUTRIENTS[name];
    if (!data) return null;
    return {
      name: name === "Frutas adultos y niños" ? "Promedio" : name,
      portion_grams: data.portion_grams,
      unit_measure: data.unit_measure,
      kcal: data.kcal,
      prot: data.prot,
      grasa: data.grasa,
      gs: data.gs,
      gm: data.gm,
      gp: data.gp,
      col: data.col,
      chos: data.chos,
      fd: data.fd,
      calcio: data.calcio ?? 0,
      p: data.p ?? 0,
      fe: data.fe ?? 0,
    };
  }).filter((r) => r !== null) as CompositionTableRow[];
}

export function getProductosReduccionGrasaCompositionRows(): CompositionTableRow[] {
  return PRODUCTOS_REDUCCION_GRASA_TABLE_ORDER.map((name) => {
    const data = FOOD_NUTRIENTS[name];
    if (!data) return null;
    return {
      name: name === "Productos con reducción de grasa adultos y niños" ? "Promedio" : name,
      portion_grams: data.portion_grams,
      unit_measure: data.unit_measure,
      kcal: data.kcal,
      prot: data.prot,
      grasa: data.grasa,
      gs: data.gs,
      gm: data.gm,
      gp: data.gp,
      col: data.col,
      chos: data.chos,
      fd: data.fd,
      calcio: data.calcio ?? 0,
      p: data.p ?? 0,
      fe: data.fe ?? 0,
    };
  }).filter((r) => r !== null) as CompositionTableRow[];
}

export function getGrasasSaturadasCompositionRows(): CompositionTableRow[] {
  return GRASAS_SATURADAS_TABLE_ORDER.map((name) => {
    const data = FOOD_NUTRIENTS[name];
    if (!data) return null;
    return {
      name: name === "Grasas saturadas adultos y niños" ? "Promedio" : name,
      portion_grams: data.portion_grams,
      unit_measure: data.unit_measure,
      kcal: data.kcal,
      prot: data.prot,
      grasa: data.grasa,
      gs: data.gs,
      gm: data.gm,
      gp: data.gp,
      col: data.col,
      chos: data.chos,
      fd: data.fd,
      calcio: data.calcio ?? 0,
      p: data.p ?? 0,
      fe: data.fe ?? 0,
    };
  }).filter((r) => r !== null) as CompositionTableRow[];
}

export function getGrasasMonoinsaturadasCompositionRows(): CompositionTableRow[] {
  return GRASAS_MONOINSATURADAS_TABLE_ORDER.map((name) => {
    const data = FOOD_NUTRIENTS[name];
    if (!data) return null;
    return {
      name: name === "Grasas monoinsaturadas adultos y niños" ? "Promedio" : name,
      portion_grams: data.portion_grams,
      unit_measure: data.unit_measure,
      kcal: data.kcal,
      prot: data.prot,
      grasa: data.grasa,
      gs: data.gs,
      gm: data.gm,
      gp: data.gp,
      col: data.col,
      chos: data.chos,
      fd: data.fd,
      calcio: data.calcio ?? 0,
      p: data.p ?? 0,
      fe: data.fe ?? 0,
    };
  }).filter((r) => r !== null) as CompositionTableRow[];
}

export function getGrasasPoliinsaturadasCompositionRows(): CompositionTableRow[] {
  return GRASAS_POLIINSATURADAS_TABLE_ORDER.map((name) => {
    const data = FOOD_NUTRIENTS[name];
    if (!data) return null;
    return {
      name: name === "Grasas poliinsaturadas" ? "Promedio" : name,
      portion_grams: data.portion_grams,
      unit_measure: data.unit_measure,
      kcal: data.kcal,
      prot: data.prot,
      grasa: data.grasa,
      gs: data.gs,
      gm: data.gm,
      gp: data.gp,
      col: data.col,
      chos: data.chos,
      fd: data.fd,
      calcio: data.calcio ?? 0,
      p: data.p ?? 0,
      fe: data.fe ?? 0,
    };
  }).filter((r) => r !== null) as CompositionTableRow[];
}

/**
 * Busca un ingrediente en FOOD_NUTRIENTS por nombre.
 * La app usa solo los datos de este archivo (foodNutrients.ts).
 * Si los datos en pantalla no coinciden con este archivo, puede ser por:
 * 1) Nombre distinto: la receta/plan usa otro texto (ej. "Arroz: 50g" o "arroz").
 * 2) Caché del navegador: hacer recarga forzada (Ctrl+F5) o reiniciar el servidor de desarrollo.
 * 3) No regenerar foodNutrients.ts desde food_nutrients.json con convert_to_ts.py sin revisar: ese script puede sobrescribir y quitar campos (portion_grams, unit_measure).
 */
export function getCompositionRowForIngredient(name: string): CompositionTableRow | null {
  if (!name || typeof name !== "string") return null;
  const trimmed = name.trim();
  const baseName = trimmed.replace(/\s*:.*$/, "").trim();

  const keys = Object.keys(FOOD_NUTRIENTS);
  const tryKey = (key: string): NutrientData | null => FOOD_NUTRIENTS[key] ?? null;

  let data = tryKey(name) ?? tryKey(trimmed) ?? tryKey(baseName);
  if (!data) {
    const lower = baseName.toLowerCase();
    const found = keys.find((k) => k.toLowerCase() === lower);
    if (found) data = FOOD_NUTRIENTS[found];
  }
  if (!data) return null;

  return {
    name: trimmed,
    portion_grams: data.portion_grams,
    unit_measure: data.unit_measure,
    kcal: data.kcal,
    prot: data.prot,
    grasa: data.grasa,
    gs: data.gs,
    gm: data.gm,
    gp: data.gp,
    col: data.col,
    chos: data.chos,
    fd: data.fd,
    calcio: data.calcio ?? 0,
    p: data.p ?? 0,
    fe: data.fe ?? 0,
  };
}
