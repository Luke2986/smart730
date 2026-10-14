/**
 * Calcolo Detrazioni Affitto Abitazione Principale (Quadro E71)
 * Conforme a normativa fiscale italiana
 */

export type TipoContrattoAffitto = 'libero' | 'concordato' | 'giovani_under31';

export interface DetrazioneAffittoInput {
  tipoContratto: TipoContrattoAffitto;
  canoneAnnuo: number;
  giorniAffitto: number;
  etaContribuente: number;
  redditoComplessivo: number;
  /** Quota del contratto intestata al contribuente (colonna 3 del rigo E71) */
  percentuale?: number;
}

// Soglie reddito per detrazioni affitto
const SOGLIA_REDDITO_BASSA = 15493.71;
const SOGLIA_REDDITO_MEDIA = 30987.41;

// Detrazioni contratto libero
const DETRAZIONE_LIBERO_BASSA = 300;
const DETRAZIONE_LIBERO_MEDIA = 150;

// Detrazioni contratto concordato
const DETRAZIONE_CONCORDATO_BASSA = 495.80;
const DETRAZIONE_CONCORDATO_MEDIA = 247.90;

// Bonus giovani (20-31 anni non compiuti)
const BONUS_GIOVANI_MIN = 991.60;
const BONUS_GIOVANI_MAX = 2000;
const BONUS_GIOVANI_PERC = 0.20; // 20% del canone

/**
 * Calcola detrazione affitto abitazione principale
 * @param data - Dati contratto affitto
 * @returns Importo detrazione spettante
 */
export function calculateDetrazioneAffitto(data: DetrazioneAffittoInput): number {
  const { tipoContratto, canoneAnnuo, giorniAffitto, etaContribuente, redditoComplessivo, percentuale = 100 } = data;
  
  // Validazione input
  if (canoneAnnuo <= 0 || giorniAffitto <= 0 || percentuale <= 0) return 0;
  
  // Fattore proporzionale giorni (se affitto < 365 giorni)
  const fattoreProporzionale = Math.min(giorniAffitto / 365, 1);
  
  let detrazioneBase = 0;
  
  switch (tipoContratto) {
    case 'libero':
      // Contratto libero (4+4)
      if (redditoComplessivo <= SOGLIA_REDDITO_BASSA) {
        detrazioneBase = DETRAZIONE_LIBERO_BASSA;
      } else if (redditoComplessivo <= SOGLIA_REDDITO_MEDIA) {
        detrazioneBase = DETRAZIONE_LIBERO_MEDIA;
      }
      break;
      
    case 'concordato':
      // Contratto concordato (3+2)
      if (redditoComplessivo <= SOGLIA_REDDITO_BASSA) {
        detrazioneBase = DETRAZIONE_CONCORDATO_BASSA;
      } else if (redditoComplessivo <= SOGLIA_REDDITO_MEDIA) {
        detrazioneBase = DETRAZIONE_CONCORDATO_MEDIA;
      }
      break;
      
    case 'giovani_under31':
      // Giovani 20-31 anni non compiuti, solo con reddito complessivo fino a 15.493,71 €
      if (etaContribuente >= 20 && etaContribuente < 31 && redditoComplessivo <= SOGLIA_REDDITO_BASSA) {
        // 20% del canone annuo pagato
        const detrazione20Perc = canoneAnnuo * BONUS_GIOVANI_PERC;
        // Min 991,60€, Max 2.000€
        detrazioneBase = Math.max(
          BONUS_GIOVANI_MIN,
          Math.min(detrazione20Perc, BONUS_GIOVANI_MAX)
        );
      }
      break;
  }
  
  const detrazioneFinale = detrazioneBase * fattoreProporzionale * (Math.min(percentuale, 100) / 100);
  
  return Math.round(detrazioneFinale * 100) / 100;
}

/**
 * Calcola età contribuente da data di nascita
 * @param dataNascita - Data nascita in formato ISO (YYYY-MM-DD)
 * @param annoRiferimento - Anno fiscale (default: anno corrente - 1)
 * @returns Età al 31/12 dell'anno di riferimento
 */
export function calcolaEtaContribuente(
  dataNascita: string,
  annoRiferimento?: number
): number {
  const anno = annoRiferimento || new Date().getFullYear() - 1;
  const nascita = new Date(dataNascita);
  const fineAnno = new Date(anno, 11, 31); // 31 dicembre anno riferimento
  
  let eta = fineAnno.getFullYear() - nascita.getFullYear();
  const meseNascita = nascita.getMonth();
  const giornoNascita = nascita.getDate();
  
  // Verifica se compleanno già passato al 31/12
  if (meseNascita > 11 || (meseNascita === 11 && giornoNascita > 31)) {
    eta--;
  }
  
  return eta;
}

/**
 * Determina detrazione migliore per il contribuente
 * @param canoneAnnuo - Canone annuo pagato
 * @param etaContribuente - Età al 31/12
 * @param redditoComplessivo - Reddito complessivo
 * @param giorniAffitto - Giorni affitto nell'anno
 * @returns Oggetto con tipo contratto migliore e importo detrazione
 */
export function determinaDetrazioneMigliore(
  canoneAnnuo: number,
  etaContribuente: number,
  redditoComplessivo: number,
  giorniAffitto: number = 365
): {
  tipoContratto: TipoContrattoAffitto;
  detrazione: number;
  suggerimento: string;
} {
  const opzioni: Array<{
    tipo: TipoContrattoAffitto;
    detrazione: number;
  }> = [];
  
  // Calcola detrazione per ogni tipo contratto applicabile
  const libero = calculateDetrazioneAffitto({
    tipoContratto: 'libero',
    canoneAnnuo,
    giorniAffitto,
    etaContribuente,
    redditoComplessivo
  });
  if (libero > 0) {
    opzioni.push({ tipo: 'libero', detrazione: libero });
  }
  
  const concordato = calculateDetrazioneAffitto({
    tipoContratto: 'concordato',
    canoneAnnuo,
    giorniAffitto,
    etaContribuente,
    redditoComplessivo
  });
  if (concordato > 0) {
    opzioni.push({ tipo: 'concordato', detrazione: concordato });
  }
  
  // Bonus giovani solo se età compresa tra 20 e 30 anni
  if (etaContribuente >= 20 && etaContribuente < 31) {
    const giovani = calculateDetrazioneAffitto({
      tipoContratto: 'giovani_under31',
      canoneAnnuo,
      giorniAffitto,
      etaContribuente,
      redditoComplessivo
    });
    if (giovani > 0) {
      opzioni.push({ tipo: 'giovani_under31', detrazione: giovani });
    }
  }
  
  // Trova opzione migliore
  const migliore = opzioni.reduce((prev, curr) => 
    curr.detrazione > prev.detrazione ? curr : prev
  , { tipo: 'libero' as TipoContrattoAffitto, detrazione: 0 });
  
  // Genera suggerimento
  let suggerimento = '';
  if (migliore.tipo === 'giovani_under31') {
    suggerimento = 'Bonus giovani under 31 più vantaggioso - Detrazione rimborsabile anche oltre capienza IRPEF';
  } else if (migliore.tipo === 'concordato') {
    suggerimento = 'Contratto concordato più vantaggioso per il tuo reddito';
  } else {
    suggerimento = 'Contratto libero applicabile per il tuo reddito';
  }
  
  return {
    tipoContratto: migliore.tipo,
    detrazione: migliore.detrazione,
    suggerimento
  };
}

/**
 * Valida dati affitto
 */
export function validateAffittoData(data: DetrazioneAffittoInput): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (data.canoneAnnuo <= 0) {
    errors.push('Canone annuo deve essere maggiore di 0');
  }
  
  if (data.giorniAffitto <= 0 || data.giorniAffitto > 365) {
    errors.push('Giorni affitto deve essere tra 1 e 365');
  }
  
  if (data.etaContribuente < 18) {
    errors.push('Età contribuente deve essere almeno 18 anni');
  }
  
  if (data.redditoComplessivo < 0) {
    errors.push('Reddito complessivo non può essere negativo');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
