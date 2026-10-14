/**
 * Addizionale regionale IRPEF, anno d'imposta 2025.
 * Fonti: MEF - Dipartimento delle Finanze, elenco delle addizionali regionali 2025 (file addreg2025.csv),
 * e circolare di liquidazione del 730/2026 (Allegato C, par. 19.24.3) per i casi particolari.
 * Per Molise e Provincia di Trento vale l'ultima pubblicazione dell'anno.
 * Aliquote in percentuale; scaglioni come [limite superiore, aliquota], l'ultimo senza limite.
 */

export type Scaglioni = Array<[number | null, number]>;

export interface RegolaRegionale {
  nome: string;
  scaglioni: Scaglioni;
  /** Reddito fino a questa soglia: si applica un'unica aliquota su tutto il reddito. */
  aliquotaRidotta?: { finoA: number; aliquota: number };
  /** Reddito fino a questa soglia: addizionale non dovuta. */
  esenzione?: number;
  /** Detrazione dall'addizionale, che non può diventare negativa. */
  detrazione?: (reddito: number) => number;
  /** Agevolazioni che dipendono da dati non raccolti (figli a carico, disabilità). */
  agevolazioniNonCalcolate?: string;
}

const QUATTRO_SCAGLIONI = (a: number, b: number, c: number, d: number): Scaglioni => [
  [15000, a],
  [28000, b],
  [50000, c],
  [null, d]
];

export const REGIONI: Record<string, RegolaRegionale> = {
  abruzzo: { nome: 'Abruzzo', scaglioni: [[28000, 1.67], [50000, 2.87], [null, 3.33]] },
  basilicata: { nome: 'Basilicata', scaglioni: [[null, 1.23]] },
  bolzano: {
    nome: 'Provincia autonoma di Bolzano',
    scaglioni: [[50000, 1.23], [null, 1.73]],
    detrazione: (reddito) =>
      (reddito <= 90000 ? 430.5 : 0) + (reddito > 50000 ? Math.min(125, (125 * (reddito - 50000)) / 25000) : 0),
    agevolazioniNonCalcolate: 'detrazione di 340 € per ogni figlio a carico (reddito fino a 90.000 €)'
  },
  calabria: { nome: 'Calabria', scaglioni: [[null, 1.73]] },
  campania: {
    nome: 'Campania',
    scaglioni: QUATTRO_SCAGLIONI(1.73, 2.96, 3.2, 3.33),
    agevolazioniNonCalcolate: 'detrazioni per figli a carico (reddito fino a 28.000 €)'
  },
  'emilia romagna': { nome: 'Emilia-Romagna', scaglioni: QUATTRO_SCAGLIONI(1.33, 1.93, 2.93, 3.33) },
  'friuli venezia giulia': {
    nome: 'Friuli Venezia Giulia',
    scaglioni: [[null, 1.23]],
    aliquotaRidotta: { finoA: 15000, aliquota: 0.7 }
  },
  lazio: {
    nome: 'Lazio',
    scaglioni: [[15000, 1.73], [null, 3.33]],
    // L.R. 22/2024: fino a 28.000 € non si applica la maggiorazione dell'1,60%; da 28.001 a 35.000 € detrazione di 60 €.
    aliquotaRidotta: { finoA: 28000, aliquota: 1.73 },
    detrazione: (reddito) => (reddito > 28000 && reddito <= 35000 ? 60 : 0)
  },
  liguria: {
    nome: 'Liguria',
    scaglioni: [[28000, 1.23], [50000, 3.18], [null, 3.23]],
    agevolazioniNonCalcolate: 'detrazione per almeno due figli a carico (reddito fino a 28.000 €)'
  },
  lombardia: { nome: 'Lombardia', scaglioni: QUATTRO_SCAGLIONI(1.23, 1.58, 1.72, 1.73) },
  marche: {
    nome: 'Marche',
    scaglioni: QUATTRO_SCAGLIONI(1.23, 1.53, 1.7, 1.73),
    agevolazioniNonCalcolate: 'aliquota dell’1,23% con figli disabili a carico (reddito fino a 50.000 €)'
  },
  molise: { nome: 'Molise', scaglioni: QUATTRO_SCAGLIONI(2.03, 2.23, 3.63, 3.63) },
  piemonte: {
    nome: 'Piemonte',
    scaglioni: QUATTRO_SCAGLIONI(1.62, 2.13, 2.75, 3.33),
    agevolazioniNonCalcolate: 'detrazioni per più di tre figli o figli disabili a carico'
  },
  puglia: {
    nome: 'Puglia',
    scaglioni: QUATTRO_SCAGLIONI(1.33, 1.43, 1.63, 1.85),
    agevolazioniNonCalcolate: 'detrazioni per più di tre figli o figli disabili a carico'
  },
  sardegna: {
    nome: 'Sardegna',
    scaglioni: [[null, 1.23]],
    agevolazioniNonCalcolate: 'detrazione di 200 € per ogni figlio minorenne a carico (reddito fino a 50.000 €)'
  },
  sicilia: { nome: 'Sicilia', scaglioni: [[null, 1.23]] },
  toscana: { nome: 'Toscana', scaglioni: QUATTRO_SCAGLIONI(1.42, 1.43, 3.32, 3.33) },
  trento: {
    nome: 'Provincia autonoma di Trento',
    scaglioni: [[50000, 1.23], [null, 1.73]],
    // Deduzione di 30.000 € per redditi fino a 30.000 €: l'imponibile si azzera.
    esenzione: 30000,
    agevolazioniNonCalcolate: 'detrazione di 246 € per ogni figlio a carico (reddito fino a 50.000 €)'
  },
  umbria: {
    nome: 'Umbria',
    scaglioni: QUATTRO_SCAGLIONI(1.73, 3.02, 3.12, 3.33),
    // L.R. 2/2025: fino a 28.000 € non si applicano le maggiorazioni; da 28.001 a 50.000 € detrazione di 150 €.
    aliquotaRidotta: { finoA: 28000, aliquota: 1.23 },
    detrazione: (reddito) => (reddito > 28000 && reddito <= 50000 ? 150 : 0)
  },
  "valle d'aosta": {
    nome: "Valle d'Aosta",
    scaglioni: [[null, 1.23]],
    esenzione: 15000
  },
  veneto: {
    nome: 'Veneto',
    scaglioni: [[null, 1.23]],
    agevolazioniNonCalcolate: 'aliquota dello 0,9% per disabili o con familiare disabile a carico (reddito fino a 50.000 €)'
  }
};

/** Sigla provincia → chiave di REGIONI. */
export const PROVINCE_REGIONE: Record<string, string> = {
  CH: 'abruzzo', AQ: 'abruzzo', PE: 'abruzzo', TE: 'abruzzo',
  MT: 'basilicata', PZ: 'basilicata',
  BZ: 'bolzano',
  CZ: 'calabria', CS: 'calabria', KR: 'calabria', RC: 'calabria', VV: 'calabria',
  AV: 'campania', BN: 'campania', CE: 'campania', NA: 'campania', SA: 'campania',
  BO: 'emilia romagna', FE: 'emilia romagna', FC: 'emilia romagna', MO: 'emilia romagna', PR: 'emilia romagna',
  PC: 'emilia romagna', RA: 'emilia romagna', RE: 'emilia romagna', RN: 'emilia romagna',
  GO: 'friuli venezia giulia', PN: 'friuli venezia giulia', TS: 'friuli venezia giulia', UD: 'friuli venezia giulia',
  FR: 'lazio', LT: 'lazio', RI: 'lazio', RM: 'lazio', VT: 'lazio',
  GE: 'liguria', IM: 'liguria', SP: 'liguria', SV: 'liguria',
  BG: 'lombardia', BS: 'lombardia', CO: 'lombardia', CR: 'lombardia', LC: 'lombardia', LO: 'lombardia',
  MN: 'lombardia', MI: 'lombardia', MB: 'lombardia', PV: 'lombardia', SO: 'lombardia', VA: 'lombardia',
  AN: 'marche', AP: 'marche', FM: 'marche', MC: 'marche', PU: 'marche',
  CB: 'molise', IS: 'molise',
  AL: 'piemonte', AT: 'piemonte', BI: 'piemonte', CN: 'piemonte', NO: 'piemonte', TO: 'piemonte',
  VB: 'piemonte', VC: 'piemonte',
  BA: 'puglia', BT: 'puglia', BR: 'puglia', FG: 'puglia', LE: 'puglia', TA: 'puglia',
  CA: 'sardegna', NU: 'sardegna', OR: 'sardegna', SS: 'sardegna', SU: 'sardegna',
  AG: 'sicilia', CL: 'sicilia', CT: 'sicilia', EN: 'sicilia', ME: 'sicilia', PA: 'sicilia', RG: 'sicilia',
  SR: 'sicilia', TP: 'sicilia',
  AR: 'toscana', FI: 'toscana', GR: 'toscana', LI: 'toscana', LU: 'toscana', MS: 'toscana', PI: 'toscana',
  PT: 'toscana', PO: 'toscana', SI: 'toscana',
  TN: 'trento',
  PG: 'umbria', TR: 'umbria',
  AO: "valle d'aosta",
  BL: 'veneto', PD: 'veneto', RO: 'veneto', TV: 'veneto', VE: 'veneto', VR: 'veneto', VI: 'veneto'
};
