// TypeScript schemas for Smart730 tax system
import type { PuntiCU } from '@/utils/cuDaPunti';

export interface CUBackendData {
  redditi: {
    lavoroDipendente: number;      // Punti 1 + 2 CU
    lavoroTempoDeterminato?: number; // Punto 2 CU, già compreso in lavoroDipendente
    assimilati: number;            // Calcoli interni
    pensione: number;              // Calcoli interni
    totaleImponibile: number;      // Base calcoli
  };
  ritenute: {
    irpef: number;                 // Punto 21 CU - IRPEF già trattenuta
    addRegionale: number;          // Punto 22 CU - Addizionale regionale già trattenuta
    addComunale: number;           // Punto 23-24 CU - Addizionale comunale già trattenuta
    addComunaleAcconto: number;    // Punto 26 CU - acconto comunale dell'anno d'imposta, compreso in addComunale
    addComunaleAccontoSuccessivo?: number; // Punto 29 CU - acconto comunale dell'anno successivo già trattenuto
    totaleRitenute: number;        // Somma automatica
  };
  /**
   * Riduzione del cuneo fiscale (L. 207/2024, art. 1 c. 4-6), CU punti 718-725.
   * Assente se la CU non riporta la sezione: in quel caso la somma esente non viene ricalcolata.
   */
  cuneoFiscale?: {
    lavoroDipendente: boolean;     // Punto 718 = 1: presente reddito di lavoro dipendente (art. 49 TUIR, escluse pensioni)
    redditoLavoroDipendente: number; // Punto 719
    giorniLavoro: number;          // Punto 721
    sommaErogata: number;          // Punto 725 - somma esente erogata in busta paga
  };
  detrazioni: {
    giorniLavorati: number;        // Punto 6 CU - Per calcolo proporzionale
    giorniPensione?: number;       // Punto 7 CU
    detrazioneLavoroApplicata: number; // Già calcolata dal sostituto
    detrazioneTeoricaSpettante: number; // Da calcolare
  };
  // NUOVI CAMPI OBBLIGATORI per calcolo corretto
  acconti: {
    primaRata: number;             // Punto 121 CU - Acconto IRPEF prima rata
    secondaRata: number;           // Punto 122 CU - Acconto IRPEF seconda rata
    totaleAcconti: number;         // Somma acconti versati
  };
  creditiPrecedenti: {
    creditoIrpef: number;          // Credito IRPEF della dichiarazione precedente
    creditoAddRegionale: number;   // Credito addizionale regionale
    creditoAddComunale: number;    // Credito addizionale comunale
    totaleCreditiRiportati: number;  // Somma crediti da sottrarre
  };
  datiAnagrafici: {
    dataNascita: string;           // Per calcolo età (bonus giovani under 31)
    /** Domicilio al 1° gennaio dell'anno d'imposta: addizionale regionale e comunale a saldo. */
    domicilioFiscale: DomicilioFiscale;
    /** Domicilio al 1° gennaio dell'anno successivo, se diverso: acconto addizionale comunale. */
    domicilioFiscaleAcconto?: DomicilioFiscale | null;
  };
}

export interface DomicilioFiscale {
  comune: string;
  provincia: string;               // Sigla provincia
  regione: string;
  codiceComune: string;            // Codice catastale (es. H501), chiave delle aliquote comunali
}

export interface CUUIData {
  redditiCU: number;              // Somma per dashboard
  statoCalcolo: 'idle' | 'in_progress' | 'completed' | 'error';
  /** Valori mancanti o incoerenti segnalati durante la lettura della CU. */
  avvisi?: string[];
}

export interface CUData {
  id: string;              // ID univoco del CU
  nome: string;            // Nome visualizzato (es: "CU Azienda X")
  dataCaricamento: Date;   // Data di caricamento
  /** Punti inseriti o letti dal PDF: servono a modificare la CU. */
  punti?: PuntiCU;
  backend: CUBackendData;
  ui: CUUIData;
}

export interface Spesa {
  id: string;
  tipo: 'mutuo_e7' | 'affitto_e71' | 'sanitarie' | 'altre';
  descrizione: string;
  importo: number;
  detrazione: number;
  dataInserimento: Date;
  validata: boolean;
}

export interface SpesaSanitaria extends Spesa {
  tipo: 'sanitarie';
  sottotipo: 'mediche' | 'veterinarie';
  franchigia?: number; // 129,11€ per mediche
}

/** Rigo E71: la detrazione dipende dal reddito complessivo e la calcola il motore. */
export interface DetrazioneAffittoData {
  tipoContratto: 'libero' | 'concordato' | 'giovani_under31';
  canoneAnnuo: number;
  giorniAffitto: number;
  percentuale: number;
  etaContribuente: number;
}

/** Rigo E7: interessi totali del mutuo e quota del contribuente. */
export interface DetrazioneMutuoData {
  interessiPagati: number;
  percentualeIntestazione: number;
  primaAbitazione: boolean;
}

export interface Smart730State {
  cus: CUData[];
  /** CU mostrata nel dettaglio: id di una CU, 'aggregated' o null. */
  selectedCuId: string | null;
  /** Rigo C5: giorni di lavoro complessivi indicati dall'utente quando le CU sono più di una. */
  giorniLavoro: number | null;
  spese: Record<string, Spesa>;
  affitto: DetrazioneAffittoData | null;
  mutuo: DetrazioneMutuoData | null;
}
