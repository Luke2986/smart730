import { describe, expect, it } from 'vitest';
import { costruisciCU, domicilioDaCodice } from '../cuDaPunti';
import { calculateCompleteTaxResult } from '../taxCalculations';
import { makeCU } from './fixtures';

const opzioni = { id: 'cu-1', nome: 'Azienda' };

describe('CU dai punti della sezione Dati fiscali', () => {
  it('somma redditi, ritenute e acconti', () => {
    const cu = costruisciCU(
      { 1: 18000, 2: 2000, 3: 0, 4: 300, 5: 200, 6: 300, 21: 3500, 22: 350, 26: 40, 27: 100, 29: 45, 121: 100, 122: 150 },
      opzioni
    );
    const { redditi, ritenute, acconti, detrazioni } = cu.backend;

    expect(redditi).toEqual({ lavoroDipendente: 20000, lavoroTempoDeterminato: 2000, assimilati: 500, pensione: 0, totaleImponibile: 20500 });
    expect(ritenute).toEqual({
      irpef: 3500, addRegionale: 350, addComunale: 140, addComunaleAcconto: 40, addComunaleAccontoSuccessivo: 45, totaleRitenute: 3990
    });
    expect(acconti).toEqual({ primaRata: 100, secondaRata: 150, totaleAcconti: 250 });
    expect(detrazioni.giorniLavorati).toBe(300);
    expect(cu.ui).toEqual({ redditiCU: 20500, statoCalcolo: 'completed', avvisi: [] });
    expect(cu.punti?.[1]).toBe(18000);
  });

  it('dà lo stesso risultato di una CU equivalente', () => {
    const daPunti = costruisciCU({ 1: 28000, 21: 5200, 22: 480, 27: 190 }, opzioni);
    const attesa = makeCU({ lavoro: 28000, irpef: 5200, addRegionale: 480, addComunale: 190 });

    expect(calculateCompleteTaxResult({ cu: daPunti, spese: {} })).toEqual(calculateCompleteTaxResult({ cu: attesa, spese: {} }));
  });

  it('giorni: 365 se mancano, avviso se fuori intervallo, pensione solo con reddito di pensione', () => {
    expect(costruisciCU({ 1: 10000 }, opzioni).backend.detrazioni.giorniLavorati).toBe(365);
    expect(costruisciCU({ 3: 10000 }, opzioni).backend.detrazioni.giorniLavorati).toBe(0);

    const fuori = costruisciCU({ 1: 10000, 6: 400, 7: 100 }, opzioni);
    expect(fuori.backend.detrazioni.giorniLavorati).toBe(365);
    expect(fuori.backend.detrazioni.giorniPensione).toBeUndefined();
    expect(fuori.ui.avvisi).toEqual(['Giorni di lavoro (punto 6) fuori intervallo (400): verifica il dato nella CU.']);

    expect(costruisciCU({ 3: 10000, 7: 200 }, opzioni).backend.detrazioni.giorniPensione).toBe(200);
  });

  it('cuneo fiscale solo con il punto 718', () => {
    expect(costruisciCU({ 1: 20000, 725: 500 }, opzioni).backend.cuneoFiscale).toBeUndefined();

    const cu = costruisciCU({ 1: 20000, 6: 200, 718: 1, 719: 20000, 725: 1000 }, opzioni);
    expect(cu.backend.cuneoFiscale).toEqual({ lavoroDipendente: true, redditoLavoroDipendente: 20000, giorniLavoro: 200, sommaErogata: 1000 });
    expect(cu.ui.avvisi).toEqual(['Somma esente erogata (punto 725) superiore a 960 €: verifica il dato nella CU.']);

    expect(costruisciCU({ 4: 9000, 718: 2, 721: 100 }, opzioni).backend.cuneoFiscale?.lavoroDipendente).toBe(false);
  });

  it('avvisa se le ritenute superano metà del reddito', () => {
    expect(costruisciCU({ 1: 10000, 21: 6000 }, opzioni).ui.avvisi).toEqual([
      'Ritenute pari al 60.0% del reddito: verifica i dati inseriti.'
    ]);
  });

  it('ignora valori negativi o non numerici e arrotonda ai centesimi', () => {
    const cu = costruisciCU({ 1: 1000.005, 2: -50, 21: Number.NaN }, opzioni);
    expect(cu.backend.redditi.lavoroDipendente).toBe(1000.01);
    expect(cu.backend.ritenute.irpef).toBe(0);
  });

  it('domicilio dal codice catastale', () => {
    expect(domicilioDaCodice('h501')).toEqual(expect.objectContaining({ comune: 'ROMA', provincia: 'RM', codiceComune: 'H501' }));
    expect(domicilioDaCodice('Z999')).toBeNull();

    const domicilio = domicilioDaCodice('F205')!;
    const cu = costruisciCU({ 1: 10000 }, { ...opzioni, domicilio });
    expect(cu.backend.datiAnagrafici.domicilioFiscale).toBe(domicilio);
    expect(cu.backend.datiAnagrafici.domicilioFiscaleAcconto).toBeNull();
  });
});
