import { describe, expect, it } from 'vitest';
import { DATI_VUOTI, daRiga, impronta, isVuoto, versoRiga, type DatiDichiarazione } from '../persistenza';
import { makeCU, makeSpesa } from './fixtures';

const dati: DatiDichiarazione = {
  cus: [makeCU({ nome: 'a', lavoro: 20000, irpef: 3000 })],
  giorniLavoro: 300,
  spese: { [makeSpesa(500).id]: makeSpesa(500) },
  affitto: { tipoContratto: 'libero', canoneAnnuo: 6000, giorniAffitto: 365, percentuale: 100, etaContribuente: 40 },
  mutuo: { interessiPagati: 1500, percentualeIntestazione: 50, primaAbitazione: true }
};

describe('Persistenza della dichiarazione', () => {
  it('ricostruisce i dati salvati, date comprese', () => {
    const riga = JSON.parse(JSON.stringify(versoRiga(dati)));
    const letti = daRiga(riga);

    expect(letti).toEqual(dati);
    expect(letti?.cus[0].dataCaricamento).toBeInstanceOf(Date);
    expect(Object.values(letti?.spese ?? {})[0].dataInserimento).toBeInstanceOf(Date);
  });

  it('scarta le voci non leggibili', () => {
    const letti = daRiga({
      quadro_c_data: { versione: 1, cus: [{ id: 'x' }, ...dati.cus], giorniLavoro: 400 },
      quadro_e_data: { versione: 1, spese: { rotta: { id: 'rotta', tipo: 'sanitarie', importo: '10' } }, affitto: 'no', mutuo: null }
    });

    expect(letti?.cus).toHaveLength(1);
    expect(letti?.giorniLavoro).toBeNull();
    expect(letti?.spese).toEqual({});
    expect(letti?.affitto).toBeNull();
  });

  it('restituisce null per una riga senza dati', () => {
    expect(daRiga({ quadro_c_data: null, quadro_e_data: null })).toBeNull();
  });

  it('riconosce lo stato vuoto', () => {
    expect(isVuoto(DATI_VUOTI)).toBe(true);
    expect(isVuoto(dati)).toBe(false);
    expect(isVuoto({ ...DATI_VUOTI, giorniLavoro: 200 })).toBe(false);
  });

  it("l'impronta cambia solo se cambiano i dati", () => {
    expect(impronta(dati)).toBe(impronta({ ...dati, cus: [...dati.cus] }));
    expect(impronta(dati)).not.toBe(impronta({ ...dati, giorniLavoro: 301 }));
  });
});
