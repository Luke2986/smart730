import { describe, expect, it } from 'vitest';
import { calculateAggregatedCU } from '../cuAggregation';
import { calcolaDetrazioneSanitarie } from '../medicalExpenseCalculations';
import { validateCUData, validateFiscalResult } from '../fiscalValidation';
import { calculateDetrazioneMutuo } from '../detrazioniMutuo';
import { calculateDetrazioneAffitto } from '../detrazioniAffitto';
import { makeCU, makeSpesa } from './fixtures';

describe('Aggregazione di più CU', () => {
  it('somma i giorni di rapporti consecutivi', () => {
    const cu = calculateAggregatedCU([
      makeCU({ nome: 'a', lavoro: 12000, giorniLavorati: 180 }),
      makeCU({ nome: 'b', lavoro: 13000, giorniLavorati: 185 })
    ]);
    expect(cu?.backend.detrazioni.giorniLavorati).toBe(365);
    expect(cu?.backend.redditi.totaleImponibile).toBe(25000);
  });

  it('non supera 365 giorni con rapporti in parallelo', () => {
    const cu = calculateAggregatedCU([
      makeCU({ nome: 'a', lavoro: 12000 }),
      makeCU({ nome: 'b', lavoro: 13000 })
    ]);
    expect(cu?.backend.detrazioni.giorniLavorati).toBe(365);
  });

  it('ignora i giorni di lavoro delle CU senza reddito di lavoro', () => {
    const cu = calculateAggregatedCU([
      makeCU({ nome: 'pensione', pensione: 9000, giorniLavorati: 365 }),
      makeCU({ nome: 'lavoro', lavoro: 10000, giorniLavorati: 100 })
    ]);
    expect(cu?.backend.detrazioni.giorniLavorati).toBe(100);
  });

  it('include ogni CU, qualunque sia il nome del file', () => {
    const cu = calculateAggregatedCU([
      makeCU({ nome: 'Testa_Srl.pdf', lavoro: 10000 }),
      makeCU({ nome: 'CU_prova_demo.pdf', lavoro: 5000 })
    ]);
    expect(cu?.backend.redditi.totaleImponibile).toBe(15000);
  });

  it("somma l'acconto comunale dell'anno successivo già trattenuto", () => {
    const cu = calculateAggregatedCU([
      makeCU({ nome: 'a', lavoro: 10000, addComunaleAccontoSuccessivo: 20 }),
      makeCU({ nome: 'b', lavoro: 10000, addComunaleAccontoSuccessivo: 15 })
    ]);
    expect(cu?.backend.ritenute.addComunaleAccontoSuccessivo).toBe(35);
  });

  it('somma il cuneo fiscale solo se tutte le CU lo riportano', () => {
    const entrambe = calculateAggregatedCU([
      makeCU({ nome: 'a', lavoro: 6000, giorniLavorati: 150, cuneo: { sommaErogata: 300 } }),
      makeCU({ nome: 'b', lavoro: 6000, giorniLavorati: 250, cuneo: { sommaErogata: 200 } })
    ]);
    expect(entrambe?.backend.cuneoFiscale).toEqual({
      lavoroDipendente: true,
      redditoLavoroDipendente: 12000,
      giorniLavoro: 365,
      sommaErogata: 500
    });

    const una = calculateAggregatedCU([
      makeCU({ nome: 'a', lavoro: 6000, cuneo: { sommaErogata: 300 } }),
      makeCU({ nome: 'b', lavoro: 6000 })
    ]);
    expect(una?.backend.cuneoFiscale).toBeUndefined();
  });

  it("usa i giorni del rigo C5 indicati dall'utente al posto della somma", () => {
    const cus = [
      makeCU({ nome: 'a', lavoro: 6000, giorniLavorati: 200, cuneo: { sommaErogata: 300 } }),
      makeCU({ nome: 'b', lavoro: 6000, giorniLavorati: 200, cuneo: { sommaErogata: 200 } })
    ];
    expect(calculateAggregatedCU(cus)?.backend.detrazioni.giorniLavorati).toBe(365);

    const cu = calculateAggregatedCU(cus, 250);
    expect(cu?.backend.detrazioni.giorniLavorati).toBe(250);
    expect(cu?.backend.cuneoFiscale?.giorniLavoro).toBe(250);
  });

  it('ignora i giorni indicati con una sola CU', () => {
    const cu = calculateAggregatedCU([makeCU({ lavoro: 6000, giorniLavorati: 120 })], 300);
    expect(cu?.backend.detrazioni.giorniLavorati).toBe(120);
  });
});

describe('Spese sanitarie e veterinarie', () => {
  it('applica la franchigia di 129,11 € alle spese mediche', () => {
    expect(calcolaDetrazioneSanitarie([makeSpesa(1129.11)]).detrazioneMediche).toBe(190);
    expect(calcolaDetrazioneSanitarie([makeSpesa(100)]).detrazioneMediche).toBe(0);
  });

  it.each([
    [100, 0],
    [600, 79.97],
    [3000, 79.97]
  ])('veterinarie %d € → %d €', (importo, attesa) => {
    expect(calcolaDetrazioneSanitarie([makeSpesa(importo, 'veterinarie')]).detrazioneVeterinarie).toBe(attesa);
  });
});

describe('Mutuo prima casa (rigo E7)', () => {
  it.each([
    [3000, 100, 570],
    [6000, 100, 760],
    [6000, 50, 380],
    [3000, 50, 285]
  ])('interessi %d €, quota %d%% → %d €', (interessi, quota, attesa) => {
    expect(calculateDetrazioneMutuo({ interessiPagati: interessi, percentualeIntestazione: quota, primaAbitazione: true })).toBe(attesa);
  });

  it('non spetta se non è abitazione principale', () => {
    expect(calculateDetrazioneMutuo({ interessiPagati: 3000, percentualeIntestazione: 100, primaAbitazione: false })).toBe(0);
  });
});

describe('Affitto abitazione principale (rigo E71)', () => {
  const base = { canoneAnnuo: 6000, giorniAffitto: 365, etaContribuente: 40, percentuale: 100 };

  it.each([
    ['libero', 15000, 300],
    ['libero', 20000, 150],
    ['libero', 40000, 0],
    ['concordato', 15000, 495.8],
    ['concordato', 20000, 247.9]
  ] as const)('%s, reddito %d → %d €', (tipoContratto, redditoComplessivo, attesa) => {
    expect(calculateDetrazioneAffitto({ ...base, tipoContratto, redditoComplessivo })).toBe(attesa);
  });

  it.each([
    [3000, 991.6],
    [6000, 1200],
    [12000, 2000]
  ])('giovani, canone %d € → %d €', (canoneAnnuo, attesa) => {
    expect(calculateDetrazioneAffitto({ ...base, tipoContratto: 'giovani_under31', canoneAnnuo, etaContribuente: 25, redditoComplessivo: 12000 })).toBe(attesa);
  });

  it('rapporta a giorni e quota del contratto', () => {
    expect(calculateDetrazioneAffitto({ ...base, tipoContratto: 'libero', redditoComplessivo: 15000, percentuale: 50 })).toBe(150);
    expect(calculateDetrazioneAffitto({ ...base, tipoContratto: 'libero', redditoComplessivo: 15000, giorniAffitto: 73 })).toBe(60);
  });
});

describe('Validazione', () => {
  it('non blocca ritenute alte ma realistiche', () => {
    const result = validateCUData(makeCU({ lavoro: 50000, irpef: 14140, addRegionale: 865, addComunale: 400 }));
    expect(result.isValid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('segnala ritenute oltre il massimo teorico senza modificarle', () => {
    const cu = makeCU({ lavoro: 20000, irpef: 15000 });
    const result = validateCUData(cu);
    expect(result.warnings.some((w) => w.field === 'ritenute.irpef')).toBe(true);
    expect(cu.backend.ritenute.irpef).toBe(15000);
  });

  it('interpreta il risultato positivo come credito', () => {
    expect(validateFiscalResult(5000, 30000, 1000).warnings).toHaveLength(1);
    expect(validateFiscalResult(-9000, 30000, 1000).warnings).toHaveLength(1);
    expect(validateFiscalResult(500, 30000, 1000).warnings).toHaveLength(0);
  });
});
