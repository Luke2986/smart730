/**
 * Calcolo Detrazioni Interessi Mutuo Prima Casa (Quadro E7)
 * Conforme a normativa fiscale italiana
 */

export interface DetrazioneMutuoInput {
  interessiPagati: number;           // Interessi passivi pagati nell'anno
  percentualeIntestazione: number;   // Percentuale proprietà (100, 50, 33, etc.)
  primaAbitazione: boolean;          // Solo prima casa detraibile
  oneriAccessori?: number;           // Oneri accessori detraibili (facoltativo)
}

// Costanti normativa
const MAX_INTERESSI_DETRAIBILI = 4000;  // Limite €4.000 per contribuente
const ALIQUOTA_DETRAZIONE = 0.19;        // 19% degli interessi

/**
 * Calcola detrazione interessi mutuo prima casa
 * @param data - Dati mutuo e interessi pagati
 * @returns Importo detrazione spettante (19% su max €4.000)
 */
export function calculateDetrazioneMutuo(data: DetrazioneMutuoInput): number {
  const { interessiPagati, percentualeIntestazione, primaAbitazione, oneriAccessori = 0 } = data;
  
  // Solo prima abitazione è detraibile
  if (!primaAbitazione) return 0;
  
  // Validazione input
  if (interessiPagati <= 0 || percentualeIntestazione <= 0) return 0;
  
  // Il limite di 4.000 € vale sul totale del mutuo; ogni cointestatario detrae la sua quota.
  const interessiDetraibili = Math.min(interessiPagati + oneriAccessori, MAX_INTERESSI_DETRAIBILI)
    * (Math.min(percentualeIntestazione, 100) / 100);

  // Calcola detrazione 19%
  const detrazione = interessiDetraibili * ALIQUOTA_DETRAZIONE;
  
  return Math.round(detrazione * 100) / 100;
}

/**
 * Calcola quota interessi di competenza per comproprietà
 * @param interessiPagati - Totale interessi pagati
 * @param percentualeIntestazione - Percentuale proprietà
 * @returns Quota di competenza del contribuente
 */
export function calcolaQuotaCompetenza(
  interessiPagati: number,
  percentualeIntestazione: number
): number {
  if (interessiPagati <= 0 || percentualeIntestazione <= 0) return 0;
  
  const quota = interessiPagati * (percentualeIntestazione / 100);
  return Math.round(quota * 100) / 100;
}

/**
 * Verifica se mutuo è detraibile
 * @param primaAbitazione - Flag prima casa
 * @param dataStipula - Data stipula mutuo (ISO string)
 * @returns Oggetto con flag detraibilità e messaggio
 */
export function verificaDetraibilitaMutuo(
  primaAbitazione: boolean,
  dataStipula: string
): {
  detraibile: boolean;
  messaggio: string;
} {
  if (!primaAbitazione) {
    return {
      detraibile: false,
      messaggio: 'Solo i mutui per acquisto prima casa sono detraibili'
    };
  }
  
  // Verifica data stipula (mutui post 1993 sempre detraibili)
  const stipula = new Date(dataStipula);
  const limiteData = new Date('1993-01-01');
  
  if (stipula < limiteData) {
    return {
      detraibile: false,
      messaggio: 'Mutui stipulati prima del 1993 non sono detraibili'
    };
  }
  
  return {
    detraibile: true,
    messaggio: 'Mutuo detraibile - Prima casa e stipula post 1993'
  };
}

/**
 * Calcola risparmio fiscale effettivo da detrazione mutuo
 * @param detrazione - Importo detrazione
 * @param irpefLorda - IRPEF lorda dovuta
 * @returns Risparmio effettivo (considerando capienza IRPEF)
 */
export function calcolaRisparmioEffettivo(
  detrazione: number,
  irpefLorda: number
): {
  detrazioneApplicabile: number;
  detrazionePersa: number;
  risparmioPercentuale: number;
} {
  if (detrazione <= 0 || irpefLorda <= 0) {
    return {
      detrazioneApplicabile: 0,
      detrazionePersa: 0,
      risparmioPercentuale: 0
    };
  }
  
  // Detrazione non può superare IRPEF lorda (no incapienza)
  const detrazioneApplicabile = Math.min(detrazione, irpefLorda);
  const detrazionePersa = Math.max(0, detrazione - irpefLorda);
  const risparmioPercentuale = irpefLorda > 0 
    ? (detrazioneApplicabile / irpefLorda) * 100 
    : 0;
  
  return {
    detrazioneApplicabile: Math.round(detrazioneApplicabile * 100) / 100,
    detrazionePersa: Math.round(detrazionePersa * 100) / 100,
    risparmioPercentuale: Math.round(risparmioPercentuale * 100) / 100
  };
}

/**
 * Suggerisce ripartizione ottimale per coniugi
 * @param interessiPagati - Totale interessi pagati
 * @param irpefConiuge1 - IRPEF lorda coniuge 1
 * @param irpefConiuge2 - IRPEF lorda coniuge 2
 * @returns Suggerimento ripartizione percentuali
 */
export function suggerisciRipartizione(
  interessiPagati: number,
  irpefConiuge1: number,
  irpefConiuge2: number
): {
  percentualeConiuge1: number;
  percentualeConiuge2: number;
  detrazioneMax: number;
  suggerimento: string;
} {
  // Calcola detrazione teorica massima (19% su €4.000 per persona = €760)
  const detrazioneMaxPerPersona = MAX_INTERESSI_DETRAIBILI * ALIQUOTA_DETRAZIONE;
  
  // Se interessi alti, conviene 50/50 per sfruttare doppio limite
  if (interessiPagati >= MAX_INTERESSI_DETRAIBILI * 2) {
    return {
      percentualeConiuge1: 50,
      percentualeConiuge2: 50,
      detrazioneMax: detrazioneMaxPerPersona * 2,
      suggerimento: '50% ciascuno - Massimizza detrazioni sfruttando doppio limite €4.000'
    };
  }
  
  // Se uno ha IRPEF insufficiente, conviene spostare all'altro
  if (irpefConiuge1 < detrazioneMaxPerPersona && irpefConiuge2 >= detrazioneMaxPerPersona) {
    return {
      percentualeConiuge1: 0,
      percentualeConiuge2: 100,
      detrazioneMax: Math.min(interessiPagati * ALIQUOTA_DETRAZIONE, detrazioneMaxPerPersona),
      suggerimento: '100% al coniuge 2 - Ha capienza IRPEF maggiore'
    };
  }
  
  if (irpefConiuge2 < detrazioneMaxPerPersona && irpefConiuge1 >= detrazioneMaxPerPersona) {
    return {
      percentualeConiuge1: 100,
      percentualeConiuge2: 0,
      detrazioneMax: Math.min(interessiPagati * ALIQUOTA_DETRAZIONE, detrazioneMaxPerPersona),
      suggerimento: '100% al coniuge 1 - Ha capienza IRPEF maggiore'
    };
  }
  
  // Default: 50/50
  return {
    percentualeConiuge1: 50,
    percentualeConiuge2: 50,
    detrazioneMax: Math.min(interessiPagati * ALIQUOTA_DETRAZIONE, detrazioneMaxPerPersona * 2),
    suggerimento: '50% ciascuno - Entrambi hanno capienza IRPEF sufficiente'
  };
}

/**
 * Valida dati mutuo
 */
export function validateMutuoData(data: DetrazioneMutuoInput): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (data.interessiPagati <= 0) {
    errors.push('Interessi pagati devono essere maggiori di 0');
  }
  
  if (data.percentualeIntestazione <= 0 || data.percentualeIntestazione > 100) {
    errors.push('Percentuale intestazione deve essere tra 1 e 100');
  }
  
  if (!data.primaAbitazione) {
    warnings.push('Solo mutui per prima abitazione sono detraibili');
  }
  
  if (data.interessiPagati > MAX_INTERESSI_DETRAIBILI) {
    warnings.push(`Interessi oltre €${MAX_INTERESSI_DETRAIBILI.toLocaleString('it-IT', { useGrouping: 'always' })} non sono detraibili`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
