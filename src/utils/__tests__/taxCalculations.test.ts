import { describe, expect, it } from 'vitest';
import {
  calcolaAccontoIRPEF,
  calcolaCuneoFiscale,
  calcolaDetrazioneAltriAssimilati,
  calcolaDetrazioneLavoro,
  calcolaDetrazionePensione,
  calcolaDetrazioniRedditi,
  calcolaSommaEsente,
  calcolaUlterioreDetrazione,
  calculateCompleteTaxResult,
  calculateIRPEFByBrackets
} from '../taxCalculations';
import { calculateAggregatedCU } from '../cuAggregation';
import { makeCU, makeSpesa } from './fixtures';

describe('IRPEF lorda 2025 (23% / 35% / 43%)', () => {
  it.each([
    [0, 0],
    [20000, 4600],
    [30000, 7140],
    [60000, 18440]
  ])('reddito %d → %d', (reddito, attesa) => {
    expect(calculateIRPEFByBrackets(reddito)).toBe(attesa);
  });
});

describe('Detrazione lavoro dipendente (tabella 6)', () => {
  it.each([
    [10000, 365, 1955],
    [20000, 365, 2642.21],
    [25000, 365, 2184.53],
    [25001, 365, 2249.41],
    [30000, 365, 1801.19],
    [39000, 365, 955],
    [60000, 365, 0]
  ])('reddito %d, %d giorni → %d', (reddito, giorni, attesa) => {
    expect(calcolaDetrazioneLavoro(reddito, giorni)).toBeCloseTo(attesa, 2);
  });

  it('applica il minimo di 690 € sotto i 15.000 € anche per pochi giorni', () => {
    expect(calcolaDetrazioneLavoro(10000, 100)).toBe(690);
  });

  it('applica il minimo di 1.380 € al solo tempo determinato', () => {
    expect(calcolaDetrazioneLavoro(10000, 100, true)).toBe(1380);
    expect(calcolaDetrazioneLavoro(10000, 300, true)).toBeCloseTo(1606.85, 2);
  });

  it('usa il minimo di 1.380 € solo se tutto il lavoro è a tempo determinato', () => {
    const determinato = calcolaDetrazioniRedditi(makeCU({ lavoro: 8000, lavoroDeterminato: 8000, giorniLavorati: 90 }));
    expect(determinato.lavoro).toBe(1380);

    const misto = calcolaDetrazioniRedditi(makeCU({ lavoro: 8000, lavoroDeterminato: 3000, giorniLavorati: 90 }));
    expect(misto.lavoro).toBe(690);
    expect(misto.warnings.length).toBeGreaterThan(0);
  });

  it('rapporta ai giorni e poi aggiunge i 65 €', () => {
    expect(calcolaDetrazioneLavoro(30000, 182)).toBeCloseTo(930.72, 2);
  });
});

describe('Detrazione pensione (tabella 7)', () => {
  it.each([
    [8000, 365, 1955],
    [8000, 30, 713],
    [20000, 365, 1214.8],
    [27000, 365, 814.26],
    [39000, 365, 350]
  ])('reddito %d, %d giorni → %d', (reddito, giorni, attesa) => {
    expect(calcolaDetrazionePensione(reddito, giorni)).toBeCloseTo(attesa, 2);
  });
});

describe('Detrazione altri assimilati (tabella 8)', () => {
  it.each([
    [5000, 1265],
    [12000, 1093.99],
    [39000, 250]
  ])('reddito %d → %d', (reddito, attesa) => {
    expect(calcolaDetrazioneAltriAssimilati(reddito)).toBeCloseTo(attesa, 2);
  });
});

describe('Detrazioni per tipo di reddito', () => {
  it('calcola la pensione da sola su 365 giorni', () => {
    const result = calcolaDetrazioniRedditi(makeCU({ pensione: 20000 }));
    expect(result.lavoro).toBe(0);
    expect(result.pensione).toBeCloseTo(1214.8, 2);
  });

  it('con lavoro e pensione divide i 365 giorni senza sovrapporli', () => {
    const result = calcolaDetrazioniRedditi(makeCU({ lavoro: 20000, pensione: 10000, giorniLavorati: 200 }));
    expect(result.lavoro).toBeCloseTo(1016.34, 2);
    expect(result.pensione).toBeCloseTo(287.64, 2);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('usa il reddito complessivo, non solo il lavoro dipendente', () => {
    const soloLavoro = calcolaDetrazioniRedditi(makeCU({ lavoro: 20000 }));
    const conAssimilati = calcolaDetrazioniRedditi(makeCU({ lavoro: 20000, assimilati: 10000 }));
    expect(conAssimilati.lavoro).toBeLessThan(soloLavoro.lavoro);
    expect(conAssimilati.assimilati).toBe(0);
    expect(conAssimilati.warnings.length).toBeGreaterThan(0);
  });
});

describe('Cuneo fiscale 2025 (L. 207/2024, art. 1 c. 4-6)', () => {
  it.each([
    [20000, 365, 0],
    [20001, 365, 1000],
    [32000, 365, 1000],
    [36000, 365, 500],
    [40000, 365, 0],
    [30000, 182, 498.63]
  ])('ulteriore detrazione: reddito %d, %d giorni → %d', (reddito, giorni, attesa) => {
    expect(calcolaUlterioreDetrazione(reddito, giorni)).toBe(attesa);
  });

  it.each([
    [8000, 8000, 365, 568],
    [12000, 12000, 365, 636],
    [18000, 18000, 365, 864],
    [20000, 20000, 365, 960],
    [20001, 20001, 365, 0]
  ])('somma esente: reddito %d, lavoro %d, %d giorni → %d', (reddito, lavoro, giorni, attesa) => {
    expect(calcolaSommaEsente(reddito, lavoro, giorni)).toBe(attesa);
  });

  it("sceglie la percentuale sul reddito rapportato all'anno e la applica a quello effettivo", () => {
    expect(calcolaSommaEsente(6000, 6000, 182)).toBe(318);
  });

  it('non spetta ai pensionati né a chi non ha lavoro dipendente (punto 718 = 2)', () => {
    expect(calcolaCuneoFiscale(makeCU({ pensione: 30000 })).ulterioreDetrazione).toBe(0);
    const collaboratore = calcolaCuneoFiscale(makeCU({ lavoro: 15000, cuneo: { sommaErogata: 0, lavoroDipendente: false } }));
    expect(collaboratore.sommaEsente).toEqual({ spettante: 0, erogata: 0 });
  });

  it('senza i punti 724-725 non ricalcola la somma esente e lo segnala', () => {
    const result = calcolaCuneoFiscale(makeCU({ lavoro: 12000 }));
    expect(result.sommaEsente).toBeNull();
    expect(result.warnings.some((w) => w.includes('724-725'))).toBe(true);
  });

  describe('esempi della circolare AdE 4/E del 16/5/2025, par. 1.2', () => {
    it('esempio 1: 2.000 € di lavoro in 62 giorni, reddito complessivo 6.000 € → 106 €', () => {
      const cu = makeCU({ lavoro: 2000, assimilati: 4000, giorniLavorati: 62, cuneo: { sommaErogata: 106 } });
      expect(calcolaCuneoFiscale(cu).sommaEsente).toEqual({ spettante: 106, erogata: 106 });
    });

    it('esempio 2: due rapporti (62 + 30 giorni, 3.000 €) → 159 €, riconosciuti in dichiarazione se non erogati', () => {
      const cu = calculateAggregatedCU([
        makeCU({ nome: 'a', lavoro: 2000, giorniLavorati: 62, cuneo: { sommaErogata: 0 } }),
        makeCU({ nome: 'b', lavoro: 1000, assimilati: 3000, giorniLavorati: 30, cuneo: { sommaErogata: 0 } })
      ])!;
      const result = calcolaCuneoFiscale(cu);
      expect(result.sommaEsente).toEqual({ spettante: 159, erogata: 0 });
      expect(calculateCompleteTaxResult({ cu, spese: {} }).liquidazione.sommaEsente).toBe(-159);
    });
  });
});

describe('Acconto IRPEF 2026', () => {
  it.each([
    [50, { totale: 0, primaRata: 0, secondaRata: 0 }],
    [51.99, { totale: 0, primaRata: 0, secondaRata: 0 }],
    [52, { totale: 52, primaRata: 0, secondaRata: 52 }],
    [200, { totale: 200, primaRata: 0, secondaRata: 200 }],
    [1000, { totale: 1000, primaRata: 400, secondaRata: 600 }],
    [-300, { totale: 0, primaRata: 0, secondaRata: 0 }]
  ])('differenza %d', (differenza, attesa) => {
    expect(calcolaAccontoIRPEF(differenza)).toEqual(attesa);
  });
});

describe('Liquidazione completa', () => {
  it("non conta le addizionali trattenute come credito IRPEF e applica l'ulteriore detrazione", () => {
    const result = calculateCompleteTaxResult({
      cu: makeCU({ lavoro: 23000, irpef: 1300, addRegionale: 350, addComunale: 180 }),
      spese: {}
    });

    expect(result.irpefLorda).toBeCloseTo(5290, 2);
    expect(result.detrazioneLavoro).toBeCloseTo(2367.67, 2);
    expect(result.ulterioreDetrazione).toBe(1000);
    expect(result.irpefNetta).toBeCloseTo(1922.33, 2);
    expect(result.liquidazione.saldoIRPEF).toBeCloseTo(622.33, 2);
    expect(result.liquidazione.saldoAddRegionale).toBe(0);
    expect(result.liquidazione.saldoAddComunale).toBe(0);
    expect(result.accontoIRPEF).toEqual({ totale: 622.33, primaRata: 248.93, secondaRata: 373.4 });
    expect(result.accontoAddComunale).toBeCloseTo(54, 2);
    expect(result.risultatoFinale).toBeCloseTo(-1298.66, 2);
  });

  it('usa sempre le ritenute reali della CU, anche sopra il 25% del reddito', () => {
    const cu = makeCU({ lavoro: 50000, irpef: 14140, addRegionale: 865, addComunale: 400, addComunaleAccontoSuccessivo: 120 });
    const result = calculateCompleteTaxResult({ cu, spese: {} });

    expect(result.ritenuteVersate).toBe(15405);
    expect(result.liquidazione.differenzaIRPEF).toBe(0);
    expect(result.accontoIRPEF.totale).toBe(0);
    expect(result.risultatoFinale).toBe(0);
  });

  it('riconosce la somma esente non erogata in busta paga', () => {
    const result = calculateCompleteTaxResult({
      cu: makeCU({ lavoro: 12000, irpef: 805, cuneo: { sommaErogata: 0 } }),
      spese: {}
    });

    expect(result.irpefNetta).toBe(805);
    expect(result.sommaEsente).toEqual({ spettante: 636, erogata: 0 });
    expect(result.liquidazione.sommaEsente).toBe(-636);
    expect(result.liquidazione.saldoIRPEF).toBe(-636);
    expect(result.risultatoFinale).toBe(636);
  });

  it('conferma la somma esente erogata correttamente', () => {
    const result = calculateCompleteTaxResult({
      cu: makeCU({ lavoro: 12000, irpef: 805, cuneo: { sommaErogata: 636 } }),
      spese: {}
    });
    expect(result.liquidazione.sommaEsente).toBe(0);
    expect(result.risultatoFinale).toBe(0);
  });

  it('recupera la somma esente erogata se il reddito supera 20.000 €', () => {
    const result = calculateCompleteTaxResult({
      cu: makeCU({ lavoro: 25000, irpef: 2565.47, cuneo: { sommaErogata: 500 } }),
      spese: {}
    });

    expect(result.irpefNetta).toBeCloseTo(2565.47, 2);
    expect(result.liquidazione.differenzaIRPEF).toBe(0);
    expect(result.liquidazione.saldoIRPEF).toBe(500);
    expect(result.accontoIRPEF.totale).toBe(0);
    expect(result.risultatoFinale).toBe(-500);
  });

  it('include le spese sanitarie inserite nel calcolo', () => {
    const cu = makeCU({ lavoro: 50000, irpef: 14140, addRegionale: 865, addComunale: 400, addComunaleAccontoSuccessivo: 120 });
    const spesa = makeSpesa(1129.11);
    const result = calculateCompleteTaxResult({ cu, spese: { [spesa.id]: spesa } });

    expect(result.detrazioniSpese).toBeCloseTo(190, 2);
    expect(result.liquidazione.saldoIRPEF).toBeCloseTo(-190, 2);
    expect(result.risultatoFinale).toBeCloseTo(190, 2);
  });

  it('calcola mutuo e affitto dai dati inseriti con il reddito della CU', () => {
    const result = calculateCompleteTaxResult({
      cu: makeCU({ lavoro: 15000, irpef: 1495 }),
      spese: {},
      mutuo: { interessiPagati: 2000, percentualeIntestazione: 100, primaAbitazione: true },
      affitto: { tipoContratto: 'libero', canoneAnnuo: 6000, giorniAffitto: 365, percentuale: 100, etaContribuente: 40 }
    });

    expect(result.detrazioniOneri).toEqual({ sanitarie: 0, mutuo: 380, affitto: 300, riduzione: 0 });
    expect(result.irpefNetta).toBe(815);
    expect(result.risultatoFinale).toBe(680);
  });

  it('non riconosce la detrazione giovani oltre 15.493,71 € di reddito', () => {
    const result = calculateCompleteTaxResult({
      cu: makeCU({ lavoro: 20000, irpef: 2000 }),
      spese: {},
      affitto: { tipoContratto: 'giovani_under31', canoneAnnuo: 6000, giorniAffitto: 365, percentuale: 100, etaContribuente: 25 }
    });
    expect(result.detrazioniOneri.affitto).toBe(0);
  });

  it('non applica più il taglio di 260 € sopra 50.000 € (valeva solo per il 2024)', () => {
    const mediche = makeSpesa(1129.11);
    const veterinarie = makeSpesa(600, 'veterinarie');
    const result = calculateCompleteTaxResult({
      cu: makeCU({ lavoro: 60000, irpef: 18440 }),
      spese: { [mediche.id]: mediche, [veterinarie.id]: veterinarie },
      mutuo: { interessiPagati: 4000, percentualeIntestazione: 100, primaAbitazione: true }
    });

    expect(result.detrazioniOneri).toEqual({ sanitarie: 269.97, mutuo: 760, affitto: 0, riduzione: 0 });
    expect(result.detrazioniSpese).toBeCloseTo(1029.97, 2);
  });

  it('oltre 120.000 € riduce le spese veterinarie, non sanitarie e mutuo', () => {
    const mediche = makeSpesa(1129.11);
    const veterinarie = makeSpesa(600, 'veterinarie');
    const result = calculateCompleteTaxResult({
      cu: makeCU({ lavoro: 150000, irpef: 57140 }),
      spese: { [mediche.id]: mediche, [veterinarie.id]: veterinarie },
      mutuo: { interessiPagati: 4000, percentualeIntestazione: 100, primaAbitazione: true }
    });

    expect(result.detrazioniOneri).toEqual({ sanitarie: 269.97, mutuo: 760, affitto: 0, riduzione: 19.99 });
    expect(result.detrazioniSpese).toBeCloseTo(1009.98, 2);
    expect(result.warnings.some((w) => w.includes('120.000'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('16-ter'))).toBe(true);
  });

  it('con il domicilio ricalcola le addizionali e restituisce quelle trattenute in eccesso', () => {
    const cu = makeCU({ lavoro: 30000, irpef: 4338.81, addRegionale: 600, addComunale: 240, codiceComune: 'G273' });
    const result = calculateCompleteTaxResult({ cu, spese: {} });

    expect(result.addRegionaleDovuta).toBe(369);
    expect(result.liquidazione.saldoAddRegionale).toBe(-231);
    expect(result.addComunaleDovuta).toBe(304.2);
    expect(result.liquidazione.saldoAddComunale).toBe(64.2);
    expect(result.accontoAddComunale).toBe(91.26);
  });

  it('riconosce il comune anche solo dal nome', () => {
    const cu = makeCU({ lavoro: 30000, irpef: 4338.81, addRegionale: 369, addComunale: 304.2, comune: 'Palermo' });
    expect(calculateCompleteTaxResult({ cu, spese: {} }).liquidazione.saldoAddComunale).toBe(0);
  });

  it("senza IRPEF netta rimborsa tutte le addizionali trattenute", () => {
    const cu = makeCU({ lavoro: 8000, irpef: 0, addRegionale: 98.4, addComunale: 64, codiceComune: 'H501' });
    const result = calculateCompleteTaxResult({ cu, spese: {} });

    expect(result.irpefNetta).toBe(0);
    expect(result.liquidazione.saldoAddRegionale).toBe(-98.4);
    expect(result.liquidazione.saldoAddComunale).toBe(-64);
    expect(result.accontoAddComunale).toBe(0);
    expect(result.risultatoFinale).toBe(162.4);
  });

  it("calcola l'acconto comunale con il comune al 1/1/2026 e toglie quello già trattenuto", () => {
    const cu = makeCU({
      lavoro: 30000, irpef: 4338.81, addRegionale: 699, addComunale: 270, addComunaleAccontoSuccessivo: 50,
      codiceComune: 'H501', codiceComuneAcconto: 'F205'
    });
    const result = calculateCompleteTaxResult({ cu, spese: {} });

    expect(result.liquidazione.saldoAddRegionale).toBe(0);
    expect(result.liquidazione.saldoAddComunale).toBe(0);
    expect(result.accontoAddComunale).toBe(22);
  });

  it('non rimborsa né trattiene importi fino a 12 €', () => {
    const cu = makeCU({ lavoro: 50000, irpef: 14130, addRegionale: 865, addComunale: 400, addComunaleAccontoSuccessivo: 120 });
    const result = calculateCompleteTaxResult({ cu, spese: {} });

    expect(result.liquidazione.differenzaIRPEF).toBe(10);
    expect(result.liquidazione.saldoIRPEF).toBe(0);
    expect(result.risultatoFinale).toBe(0);
  });

  it('segnala quando il domicilio fiscale manca', () => {
    const result = calculateCompleteTaxResult({ cu: makeCU({ lavoro: 30000, irpef: 5000 }), spese: {} });
    expect(result.warnings.some((w) => w.includes('Domicilio fiscale'))).toBe(true);
  });
});
