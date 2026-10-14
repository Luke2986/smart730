import { describe, expect, it } from 'vitest';
import { controlliDichiarazione } from '../controlli';
import { calculateCompleteTaxResult } from '../taxCalculations';
import { DATI_VUOTI } from '../persistenza';
import type { Smart730State } from '@/types/tax';
import { makeCU, makeSpesa } from './fixtures';

const stato = (parziale: Partial<Smart730State>): Smart730State => ({ ...DATI_VUOTI, selectedCuId: null, ...parziale });
const controlli = (s: Smart730State) =>
  controlliDichiarazione(s, calculateCompleteTaxResult({ cu: s.cus[0] ?? null, spese: s.spese }));

describe('Controlli prima della presentazione', () => {
  it('blocca senza CU', () => {
    expect(controlli(stato({}))).toEqual([expect.objectContaining({ livello: 'errore', sezione: 'cu' })]);
  });

  it('segnala lettura incerta e avvisi della CU', () => {
    const cu = makeCU({ nome: 'Azienda', lavoro: 20000, irpef: 3000 });
    cu.ui = { ...cu.ui, confidenza: 60, avvisi: ['Punto 21 non leggibile'] };
    const testi = controlli(stato({ cus: [cu] })).filter((c) => c.sezione === 'cu').map((c) => c.testo);

    expect(testi).toEqual([
      expect.stringContaining('lettura automatica incerta (60%)'),
      'Azienda: Punto 21 non leggibile'
    ]);
  });

  it('chiede i giorni del rigo C5 con più CU di lavoro', () => {
    const cus = [makeCU({ nome: 'a', lavoro: 10000 }), makeCU({ nome: 'b', lavoro: 8000 })];
    const rigoC5 = (s: Smart730State) => controlli(s).some((c) => c.testo.includes('rigo C5'));

    expect(rigoC5(stato({ cus }))).toBe(true);
    expect(rigoC5(stato({ cus, giorniLavoro: 300 }))).toBe(false);
  });

  it('segnala le spese senza importo', () => {
    const spesa = makeSpesa(0);
    const risultato = controlli(stato({ cus: [makeCU({ lavoro: 20000 })], spese: { [spesa.id]: spesa } }));
    expect(risultato).toContainEqual({ livello: 'avviso', testo: '1 spesa senza importo: non entra nel calcolo.', sezione: 'sts' });
  });
});
