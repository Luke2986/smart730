import { CUData, DomicilioFiscale } from '@/types/tax';

const GIORNI_ANNO = 365;

const sum = (cus: CUData[], pick: (cu: CUData) => number | undefined) =>
  cus.reduce((total, cu) => total + (pick(cu) || 0), 0);

/**
 * Somma più CU in un unico CU aggregato.
 * Giorni di lavoro (rigo C5 col. 1 e rigo C14 col. 8): i periodi contemporanei si contano una
 * sola volta, quindi la somma delle CU è solo un'approssimazione (con tetto a 365). Se l'utente
 * indica i giorni effettivi, valgono quelli. Giorni di pensione: somma con tetto a 365.
 * Cuneo fiscale: sommato solo se tutte le CU lo riportano, altrimenti la somma erogata non è nota.
 * Dati anagrafici: quelli del primo CU con il domicilio fiscale compilato.
 */
export function calculateAggregatedCU(cus: CUData[], giorniLavoro: number | null = null): CUData | null {
  if (cus.length === 0) return null;
  if (cus.length === 1) return cus[0];

  const giorniIndicati = giorniLavoro === null ? null : Math.min(GIORNI_ANNO, Math.max(1, Math.round(giorniLavoro)));

  const hasGiorniPensione = cus.some((cu) => cu.backend.detrazioni.giorniPensione !== undefined);
  const totaleImponibile = sum(cus, (cu) => cu.backend.redditi.totaleImponibile);
  const conCuneo = cus.every((cu) => cu.backend.cuneoFiscale);

  return {
    id: 'aggregated',
    nome: `Totale ${cus.length} CU`,
    dataCaricamento: new Date(),
    backend: {
      redditi: {
        lavoroDipendente: sum(cus, (cu) => cu.backend.redditi.lavoroDipendente),
        lavoroTempoDeterminato: sum(cus, (cu) => cu.backend.redditi.lavoroTempoDeterminato),
        assimilati: sum(cus, (cu) => cu.backend.redditi.assimilati),
        pensione: sum(cus, (cu) => cu.backend.redditi.pensione),
        totaleImponibile
      },
      ritenute: {
        irpef: sum(cus, (cu) => cu.backend.ritenute.irpef),
        addRegionale: sum(cus, (cu) => cu.backend.ritenute.addRegionale),
        addComunale: sum(cus, (cu) => cu.backend.ritenute.addComunale),
        addComunaleAcconto: sum(cus, (cu) => cu.backend.ritenute.addComunaleAcconto),
        addComunaleAccontoSuccessivo: sum(cus, (cu) => cu.backend.ritenute.addComunaleAccontoSuccessivo),
        totaleRitenute: sum(cus, (cu) => cu.backend.ritenute.totaleRitenute)
      },
      ...(conCuneo && {
        cuneoFiscale: {
          lavoroDipendente: cus.some((cu) => cu.backend.cuneoFiscale?.lavoroDipendente),
          redditoLavoroDipendente: sum(cus, (cu) => cu.backend.cuneoFiscale?.redditoLavoroDipendente),
          giorniLavoro: giorniIndicati ?? Math.min(GIORNI_ANNO, sum(cus, (cu) => cu.backend.cuneoFiscale?.giorniLavoro)),
          sommaErogata: sum(cus, (cu) => cu.backend.cuneoFiscale?.sommaErogata)
        }
      }),
      detrazioni: {
        giorniLavorati: giorniIndicati ?? Math.min(
          GIORNI_ANNO,
          sum(cus, (cu) => (cu.backend.redditi.lavoroDipendente > 0 ? cu.backend.detrazioni.giorniLavorati : 0))
        ),
        ...(hasGiorniPensione && {
          giorniPensione: Math.min(GIORNI_ANNO, sum(cus, (cu) => cu.backend.detrazioni.giorniPensione))
        }),
        detrazioneLavoroApplicata: sum(cus, (cu) => cu.backend.detrazioni.detrazioneLavoroApplicata),
        detrazioneTeoricaSpettante: sum(cus, (cu) => cu.backend.detrazioni.detrazioneTeoricaSpettante)
      },
      acconti: {
        primaRata: sum(cus, (cu) => cu.backend.acconti?.primaRata),
        secondaRata: sum(cus, (cu) => cu.backend.acconti?.secondaRata),
        totaleAcconti: sum(cus, (cu) => cu.backend.acconti?.totaleAcconti)
      },
      creditiPrecedenti: {
        creditoIrpef: sum(cus, (cu) => cu.backend.creditiPrecedenti?.creditoIrpef),
        creditoAddRegionale: sum(cus, (cu) => cu.backend.creditiPrecedenti?.creditoAddRegionale),
        creditoAddComunale: sum(cus, (cu) => cu.backend.creditiPrecedenti?.creditoAddComunale),
        totaleCreditiRiportati: sum(cus, (cu) => cu.backend.creditiPrecedenti?.totaleCreditiRiportati)
      },
      datiAnagrafici: (cus.find((cu) => cu.backend.datiAnagrafici?.domicilioFiscale?.codiceComune) ?? cus[0]).backend.datiAnagrafici
    },
    ui: {
      redditiCU: totaleImponibile,
      statoCalcolo: 'completed'
    }
  };
}

/** Domicilio fiscale indicato dall'utente: vale per tutti i CU, che riguardano la stessa persona. */
export function conDomicilio(cu: CUData, domicilio: DomicilioFiscale, domicilioAcconto: DomicilioFiscale | null): CUData {
  return {
    ...cu,
    backend: {
      ...cu.backend,
      datiAnagrafici: { ...cu.backend.datiAnagrafici, domicilioFiscale: domicilio, domicilioFiscaleAcconto: domicilioAcconto }
    }
  };
}
