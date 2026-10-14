import { CUData, SpesaSanitaria } from '@/types/tax';

interface CUOptions {
  lavoro?: number;
  lavoroDeterminato?: number;
  pensione?: number;
  assimilati?: number;
  irpef?: number;
  addRegionale?: number;
  addComunale?: number;
  addComunaleAccontoSuccessivo?: number;
  giorniLavorati?: number;
  giorniPensione?: number;
  accontiVersati?: number;
  regione?: string;
  comune?: string;
  codiceComune?: string;
  codiceComuneAcconto?: string;
  /** Punti 718-725 della CU: somma esente erogata (e reddito/giorni se diversi dal lavoro dipendente) */
  cuneo?: { sommaErogata: number; redditoLavoro?: number; giorni?: number; lavoroDipendente?: boolean };
  nome?: string;
}

export function makeCU(options: CUOptions = {}): CUData {
  const lavoro = options.lavoro ?? 0;
  const pensione = options.pensione ?? 0;
  const assimilati = options.assimilati ?? 0;
  const irpef = options.irpef ?? 0;
  const addRegionale = options.addRegionale ?? 0;
  const addComunale = options.addComunale ?? 0;

  return {
    id: options.nome ?? 'cu',
    nome: options.nome ?? 'CU',
    dataCaricamento: new Date('2026-04-01'),
    backend: {
      redditi: {
        lavoroDipendente: lavoro,
        lavoroTempoDeterminato: options.lavoroDeterminato,
        assimilati,
        pensione,
        totaleImponibile: lavoro + pensione + assimilati
      },
      ritenute: {
        irpef,
        addRegionale,
        addComunale,
        addComunaleAcconto: 0,
        addComunaleAccontoSuccessivo: options.addComunaleAccontoSuccessivo,
        totaleRitenute: irpef + addRegionale + addComunale
      },
      ...(options.cuneo && {
        cuneoFiscale: {
          lavoroDipendente: options.cuneo.lavoroDipendente ?? lavoro > 0,
          redditoLavoroDipendente: options.cuneo.redditoLavoro ?? lavoro,
          giorniLavoro: options.cuneo.giorni ?? options.giorniLavorati ?? 365,
          sommaErogata: options.cuneo.sommaErogata
        }
      }),
      detrazioni: {
        giorniLavorati: options.giorniLavorati ?? 365,
        giorniPensione: options.giorniPensione,
        detrazioneLavoroApplicata: 0,
        detrazioneTeoricaSpettante: 0
      },
      acconti: { primaRata: 0, secondaRata: 0, totaleAcconti: options.accontiVersati ?? 0 },
      creditiPrecedenti: {
        creditoIrpef: 0,
        creditoAddRegionale: 0,
        creditoAddComunale: 0,
        totaleCreditiRiportati: 0
      },
      datiAnagrafici: {
        dataNascita: '',
        domicilioFiscale: {
          comune: options.comune ?? '',
          provincia: '',
          regione: options.regione ?? '',
          codiceComune: options.codiceComune ?? ''
        },
        domicilioFiscaleAcconto: options.codiceComuneAcconto
          ? { comune: '', provincia: '', regione: '', codiceComune: options.codiceComuneAcconto }
          : null
      }
    },
    ui: { redditiCU: lavoro + pensione + assimilati, statoCalcolo: 'completed' }
  };
}

export function makeSpesa(importo: number, sottotipo: 'mediche' | 'veterinarie' = 'mediche'): SpesaSanitaria {
  return {
    id: `spesa-${sottotipo}-${importo}`,
    tipo: 'sanitarie',
    sottotipo,
    descrizione: 'Spesa di prova',
    importo,
    detrazione: 0,
    dataInserimento: new Date('2025-06-01'),
    validata: false
  };
}
