import { useMemo } from 'react';
import { useTaxState } from '@/contexts/Smart730Context';
import type { AccontoIRPEF } from '@/utils/taxCalculations';
import { SpesaSanitaria } from '@/types/tax';
import { calcolaDetrazioneSanitarie } from '@/utils/medicalExpenseCalculations';

export interface RiepilogoRedditiData {
  cus: Array<{
    id: string;
    nome: string;
    importo: number;
  }>;
  totaleRedditi: number;
  altriRedditi: number; // TS/F24 (futuro)
}

export interface RiepilogoDetrazioniData {
  speseSanitarie: {
    count: number;
    importoTotale: number;
    detrazioneCalcolata: number;
    breakdown: {
      mediche: { count: number; importo: number; detrazione: number };
      veterinarie: { count: number; importo: number; detrazione: number };
    };
  };
  mutuo: {
    presente: boolean;
    interessiPagati: number;
    detrazioneCalcolata: number;
  };
  affitto: {
    presente: boolean;
    canoneAnnuo: number;
    detrazioneCalcolata: number;
    tipoContratto?: string;
  };
  totaleDetrazioni: number;
}

/** Importi di saldo e acconto: positivi = a debito, negativi = a credito (come nel 730-3). */
export interface RiepilogoCalcoloFinale {
  redditoImponibile: number;
  irpefLorda: number;
  detrazioniReddito: number;
  ulterioreDetrazione: number;
  detrazioniOneri: number;
  irpefNetta: number;
  ritenuteIrpef: number;
  accontiECrediti: number;
  /** Somma esente erogata meno spettante: positiva = da restituire, negativa = da ricevere */
  conguaglioSommaEsente: number;
  saldoIRPEF: number;
  saldoAddRegionale: number;
  saldoAddComunale: number;
  accontoIRPEF: AccontoIRPEF;
  accontoAddComunale: number;
  /** Positivo = rimborso, negativo = da versare */
  risultatoFinale: number;
  tipo: 'credito' | 'debito' | 'pareggio';
}

export interface RiepilogoCompleto {
  redditi: RiepilogoRedditiData;
  detrazioni: RiepilogoDetrazioniData;
  calcolo: RiepilogoCalcoloFinale;
  hasData: boolean;
}

export function useRiepilogoData(): RiepilogoCompleto {
  const { state, aggregatedCu, taxResult: risultato } = useTaxState();

  return useMemo(() => {
    const hasCUData = aggregatedCu !== null;
    const taxResult = hasCUData ? risultato : null;

    const cus = state.cus;
    const totaleDaTuttiCU = cus.reduce((sum, cu) => sum + cu.backend.redditi.totaleImponibile, 0);

    const redditiData: RiepilogoRedditiData = {
      cus: cus.map(cu => ({
        id: cu.id,
        nome: cu.nome,
        importo: cu.backend.redditi.totaleImponibile
      })),
      totaleRedditi: totaleDaTuttiCU,
      altriRedditi: 0 // TODO: implementare TS/F24
    };

    // DETRAZIONI
    const speseSanitarie = Object.values(state.spese).filter((s): s is SpesaSanitaria => s.tipo === 'sanitarie');
    const sanitarie = calcolaDetrazioneSanitarie(speseSanitarie);
    const oneri = taxResult?.detrazioniOneri;

    const detrazioniData: RiepilogoDetrazioniData = {
      speseSanitarie: {
        count: speseSanitarie.length,
        importoTotale: sanitarie.speseMediche + sanitarie.speseVeterinarie,
        detrazioneCalcolata: sanitarie.totaleDetrazione,
        breakdown: {
          mediche: {
            count: speseSanitarie.filter(s => s.sottotipo === 'mediche').length,
            importo: sanitarie.speseMediche,
            detrazione: sanitarie.detrazioneMediche
          },
          veterinarie: {
            count: speseSanitarie.filter(s => s.sottotipo === 'veterinarie').length,
            importo: sanitarie.speseVeterinarie,
            detrazione: sanitarie.detrazioneVeterinarie
          }
        }
      },
      mutuo: {
        presente: state.mutuo !== null,
        interessiPagati: state.mutuo?.interessiPagati || 0,
        detrazioneCalcolata: oneri?.mutuo ?? 0
      },
      affitto: {
        presente: state.affitto !== null,
        canoneAnnuo: state.affitto?.canoneAnnuo || 0,
        detrazioneCalcolata: oneri?.affitto ?? 0,
        tipoContratto: state.affitto?.tipoContratto
      },
      totaleDetrazioni: taxResult?.detrazioniSpese ?? sanitarie.totaleDetrazione
    };

    // CALCOLO FINALE
    const calcoloFinale: RiepilogoCalcoloFinale = taxResult && aggregatedCu
      ? {
          redditoImponibile: taxResult.breakdown.reddito,
          irpefLorda: taxResult.irpefLorda,
          detrazioniReddito: taxResult.detrazioneLavoro,
          ulterioreDetrazione: taxResult.ulterioreDetrazione,
          detrazioniOneri: taxResult.detrazioniSpese,
          irpefNetta: taxResult.irpefNetta,
          ritenuteIrpef: aggregatedCu.backend.ritenute.irpef || 0,
          accontiECrediti: taxResult.accreditiPrecedenti,
          conguaglioSommaEsente: taxResult.liquidazione.sommaEsente,
          saldoIRPEF: taxResult.liquidazione.saldoIRPEF,
          saldoAddRegionale: taxResult.liquidazione.saldoAddRegionale,
          saldoAddComunale: taxResult.liquidazione.saldoAddComunale,
          accontoIRPEF: taxResult.accontoIRPEF,
          accontoAddComunale: taxResult.accontoAddComunale,
          risultatoFinale: taxResult.risultatoFinale,
          tipo: taxResult.risultatoFinale > 0 ? 'credito' : taxResult.risultatoFinale < 0 ? 'debito' : 'pareggio'
        }
      : {
          redditoImponibile: 0,
          irpefLorda: 0,
          detrazioniReddito: 0,
          ulterioreDetrazione: 0,
          detrazioniOneri: 0,
          irpefNetta: 0,
          ritenuteIrpef: 0,
          accontiECrediti: 0,
          conguaglioSommaEsente: 0,
          saldoIRPEF: 0,
          saldoAddRegionale: 0,
          saldoAddComunale: 0,
          accontoIRPEF: { totale: 0, primaRata: 0, secondaRata: 0 },
          accontoAddComunale: 0,
          risultatoFinale: 0,
          tipo: 'pareggio'
        };

    return {
      redditi: redditiData,
      detrazioni: detrazioniData,
      calcolo: calcoloFinale,
      hasData: hasCUData
    };
  }, [state.cus, state.spese, state.mutuo, state.affitto, aggregatedCu, risultato]);
}
