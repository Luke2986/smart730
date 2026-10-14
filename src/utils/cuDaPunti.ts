import type { CUData, DomicilioFiscale } from '@/types/tax';
import { ANNO_DICHIARAZIONE, ANNO_IMPOSTA } from '@/utils/annoFiscale';
import { trovaComune } from '@/utils/addizionaliCalculations';

export const CODICI_PUNTO = [1, 2, 3, 4, 5, 6, 7, 21, 22, 26, 27, 29, 121, 122, 718, 719, 721, 725] as const;
export type CodicePunto = (typeof CODICI_PUNTO)[number];
/** Valori dei punti della CU, sezione "Dati fiscali". */
export type PuntiCU = Partial<Record<CodicePunto, number>>;

export type TipoPunto = 'importo' | 'giorni' | 'tipologia';

export interface DefinizionePunto {
  punto: CodicePunto;
  etichetta: string;
  tipo: TipoPunto;
}

export const GRUPPI_PUNTI: { titolo: string; punti: DefinizionePunto[] }[] = [
  {
    titolo: 'Redditi',
    punti: [
      { punto: 1, etichetta: 'Lavoro dipendente a tempo indeterminato', tipo: 'importo' },
      { punto: 2, etichetta: 'Lavoro dipendente a tempo determinato', tipo: 'importo' },
      { punto: 3, etichetta: 'Pensione', tipo: 'importo' },
      { punto: 4, etichetta: 'Altri redditi assimilati', tipo: 'importo' },
      { punto: 5, etichetta: 'Assegni periodici del coniuge', tipo: 'importo' }
    ]
  },
  {
    titolo: 'Giorni',
    punti: [
      { punto: 6, etichetta: 'Giorni di lavoro dipendente', tipo: 'giorni' },
      { punto: 7, etichetta: 'Giorni di pensione', tipo: 'giorni' }
    ]
  },
  {
    titolo: 'Ritenute',
    punti: [
      { punto: 21, etichetta: 'Ritenute IRPEF', tipo: 'importo' },
      { punto: 22, etichetta: 'Addizionale regionale trattenuta', tipo: 'importo' },
      { punto: 26, etichetta: `Acconto addizionale comunale ${ANNO_IMPOSTA}`, tipo: 'importo' },
      { punto: 27, etichetta: `Saldo addizionale comunale ${ANNO_IMPOSTA}`, tipo: 'importo' },
      { punto: 29, etichetta: `Acconto addizionale comunale ${ANNO_DICHIARAZIONE}`, tipo: 'importo' }
    ]
  },
  {
    titolo: 'Acconti IRPEF trattenuti',
    punti: [
      { punto: 121, etichetta: 'Primo acconto', tipo: 'importo' },
      { punto: 122, etichetta: 'Secondo o unico acconto', tipo: 'importo' }
    ]
  },
  {
    titolo: 'Riduzione del cuneo fiscale',
    punti: [
      { punto: 718, etichetta: 'Tipologia reddito', tipo: 'tipologia' },
      { punto: 719, etichetta: 'Reddito di lavoro dipendente', tipo: 'importo' },
      { punto: 721, etichetta: 'Giorni di lavoro', tipo: 'giorni' },
      { punto: 725, etichetta: 'Somma esente erogata', tipo: 'importo' }
    ]
  }
];

export const TIPO_PUNTO = Object.fromEntries(
  GRUPPI_PUNTI.flatMap((g) => g.punti.map((p) => [p.punto, p.tipo]))
) as Record<CodicePunto, TipoPunto>;

const GIORNI_ANNO = 365;
const MAX_SOMMA_ESENTE = 960;

const round2 = (n: number) => Math.round(n * 100) / 100;
const importo = (value?: number) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? round2(value) : 0);

function giorni(value: number | undefined, etichetta: string, avvisi: string[]): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) return undefined;
  if (value < 1 || value > GIORNI_ANNO || !Number.isInteger(value)) {
    avvisi.push(`${etichetta} fuori intervallo (${value}): verifica il dato nella CU.`);
    return undefined;
  }
  return value;
}

export const DOMICILIO_VUOTO: DomicilioFiscale = { comune: '', provincia: '', regione: '', codiceComune: '' };

/** Domicilio dal codice catastale del comune (es. H501), null se il codice non esiste. */
export function domicilioDaCodice(codice: string): DomicilioFiscale | null {
  const comune = trovaComune(codice);
  if (!comune) return null;
  return { comune: comune.nome, provincia: comune.provincia, regione: comune.regione, codiceComune: comune.codice };
}

export interface OpzioniCU {
  id: string;
  nome: string;
  domicilio?: DomicilioFiscale;
  domicilioAcconto?: DomicilioFiscale | null;
}

export function costruisciCU(punti: PuntiCU, { id, nome, domicilio, domicilioAcconto }: OpzioniCU): CUData {
  const avvisi: string[] = [];

  const lavoroDeterminato = importo(punti[2]);
  const lavoroDipendente = round2(importo(punti[1]) + lavoroDeterminato);
  const pensione = importo(punti[3]);
  const assimilati = round2(importo(punti[4]) + importo(punti[5]));
  const totaleImponibile = round2(lavoroDipendente + pensione + assimilati);

  const irpef = importo(punti[21]);
  const addRegionale = importo(punti[22]);
  const addComunaleAcconto = importo(punti[26]);
  const addComunale = round2(addComunaleAcconto + importo(punti[27]));
  const totaleRitenute = round2(irpef + addRegionale + addComunale);

  const primaRata = importo(punti[121]);
  const secondaRata = importo(punti[122]);

  const giorniLavoro = giorni(punti[6], 'Giorni di lavoro (punto 6)', avvisi);
  const giorniLavorati = lavoroDipendente > 0 ? giorniLavoro ?? GIORNI_ANNO : 0;
  const giorniPensione = pensione > 0 ? giorni(punti[7], 'Giorni di pensione (punto 7)', avvisi) : undefined;

  const sommaErogata = importo(punti[725]);
  if (sommaErogata > MAX_SOMMA_ESENTE) {
    avvisi.push(`Somma esente erogata (punto 725) superiore a ${MAX_SOMMA_ESENTE} €: verifica il dato nella CU.`);
  }
  // Senza punto 718 la CU non riporta la riduzione del cuneo e il motore non ricalcola la somma esente.
  const tipologiaCuneo = punti[718];
  const cuneoFiscale = tipologiaCuneo === 1 || tipologiaCuneo === 2
    ? {
        lavoroDipendente: tipologiaCuneo === 1,
        redditoLavoroDipendente: importo(punti[719]),
        giorniLavoro: giorni(punti[721], 'Giorni di lavoro (punto 721)', avvisi) ?? giorniLavorati,
        sommaErogata
      }
    : undefined;

  if (totaleImponibile > 0 && totaleRitenute > totaleImponibile * 0.5) {
    avvisi.push(`Ritenute pari al ${((totaleRitenute / totaleImponibile) * 100).toFixed(1)}% del reddito: verifica i dati inseriti.`);
  }

  return {
    id,
    nome,
    dataCaricamento: new Date(),
    punti: { ...punti },
    backend: {
      redditi: { lavoroDipendente, lavoroTempoDeterminato: lavoroDeterminato, assimilati, pensione, totaleImponibile },
      ritenute: {
        irpef,
        addRegionale,
        addComunale,
        addComunaleAcconto,
        addComunaleAccontoSuccessivo: importo(punti[29]),
        totaleRitenute
      },
      ...(cuneoFiscale && { cuneoFiscale }),
      detrazioni: {
        giorniLavorati,
        ...(giorniPensione !== undefined && { giorniPensione }),
        detrazioneLavoroApplicata: 0,
        detrazioneTeoricaSpettante: 0
      },
      acconti: { primaRata, secondaRata, totaleAcconti: round2(primaRata + secondaRata) },
      creditiPrecedenti: { creditoIrpef: 0, creditoAddRegionale: 0, creditoAddComunale: 0, totaleCreditiRiportati: 0 },
      datiAnagrafici: {
        dataNascita: '',
        domicilioFiscale: domicilio ?? DOMICILIO_VUOTO,
        domicilioFiscaleAcconto: domicilioAcconto ?? null
      }
    },
    ui: { redditiCU: totaleImponibile, statoCalcolo: 'completed', avvisi }
  };
}
