import { describe, expect, it } from 'vitest';
import comunali from '@/data/addizionali/comunali.json';
import { PROVINCE_REGIONE, REGIONI } from '@/data/addizionali/regionali';
import {
  calcolaAddizionaleComunale,
  calcolaAddizionaleRegionale,
  calcolaAddizionaliDovute,
  cercaComuni,
  trovaComune,
  trovaComunePerNome,
  trovaRegione
} from '../addizionaliCalculations';

const regionale = (regione: string, reddito: number) => calcolaAddizionaleRegionale(reddito, REGIONI[regione]);
const comunale = (codice: string, reddito: number) => calcolaAddizionaleComunale(reddito, trovaComune(codice)!.regola!);

describe('Addizionale regionale 2025', () => {
  it.each([
    ['lombardia', 30000, 424.3],
    ['molise', 20000, 416],
    ['sicilia', 30000, 369],
    ['abruzzo', 30000, 525],
    ['emilia romagna', 30000, 509]
  ])('%s, reddito %d → %d', (regione, reddito, attesa) => {
    expect(regionale(regione, reddito)).toBe(attesa);
  });

  it.each([
    [25000, 432.5],
    [28000, 484.4],
    [30000, 699],
    [40000, 1092]
  ])('Lazio: 1,73% fino a 28.000 €, poi scaglioni, detrazione 60 € da 28.001 a 35.000 € (reddito %d → %d)', (reddito, attesa) => {
    expect(regionale('lazio', reddito)).toBe(attesa);
  });

  it.each([
    [28000, 344.4],
    [30000, 564.5],
    [60000, 1671.5]
  ])('Umbria: 1,23% fino a 28.000 €, poi scaglioni, detrazione 150 € da 28.001 a 50.000 € (reddito %d → %d)', (reddito, attesa) => {
    expect(regionale('umbria', reddito)).toBe(attesa);
  });

  it('Friuli Venezia Giulia: 0,70% fino a 15.000 €, oltre 1,23% su tutto il reddito', () => {
    expect(regionale('friuli venezia giulia', 15000)).toBe(105);
    expect(regionale('friuli venezia giulia', 30000)).toBe(369);
  });

  it("Valle d'Aosta e Trento: esenzione sotto soglia, poi tutto il reddito", () => {
    expect(regionale("valle d'aosta", 15000)).toBe(0);
    expect(regionale("valle d'aosta", 20000)).toBe(246);
    expect(regionale('trento', 30000)).toBe(0);
    expect(regionale('trento', 40000)).toBe(492);
    expect(regionale('trento', 60000)).toBe(788);
  });

  it.each([
    [30000, 0],
    [40000, 61.5],
    [60000, 307.5],
    [80000, 578.5],
    [100000, 1355]
  ])('Bolzano: detrazione 430,50 € fino a 90.000 €, più quella oltre 50.000 € (reddito %d → %d)', (reddito, attesa) => {
    expect(regionale('bolzano', reddito)).toBe(attesa);
  });

  it.each(['Emilia-Romagna', 'emilia romagna', 'Friuli-Venezia Giulia', "Valle d'Aosta", 'SICILIA', 'Regione Lazio', 'Provincia autonoma di Trento', 'RM'])(
    'riconosce "%s"',
    (nome) => {
      expect(trovaRegione(nome)).not.toBeNull();
    }
  );

  it('associa una regione a ogni provincia degli elenchi comunali', () => {
    const province = new Set(Object.values(comunali.comuni).map(([, provincia]) => provincia as string));
    const senzaRegione = [...province].filter((p) => !REGIONI[PROVINCE_REGIONE[p]]);
    expect(senzaRegione).toEqual([]);
  });
});

describe('Addizionale comunale 2025', () => {
  it('soglia di esenzione: sotto non si paga, sopra si paga su tutto il reddito', () => {
    expect(comunale('H501', 14000)).toBe(0);
    expect(comunale('H501', 14001)).toBe(126.01);
    expect(comunale('H501', 30000)).toBe(270);
    expect(comunale('F205', 23000)).toBe(0);
    expect(comunale('F205', 30000)).toBe(240);
  });

  it('applica gli scaglioni del comune', () => {
    expect(comunale('L219', 30000)).toBe(246);
    expect(comunale('M435', 20000)).toBe(0);
    expect(comunale('M435', 30000)).toBe(98);
  });

  it('trova i comuni per codice, nome e ricerca', () => {
    expect(trovaComune('h501')).toMatchObject({ nome: 'ROMA', provincia: 'RM', regione: 'Lazio' });
    expect(trovaComunePerNome('Roma')?.codice).toBe('H501');
    expect(trovaComunePerNome('Samone')).toBeNull();
    expect(trovaComunePerNome('Samone', 'TN')?.codice).toBe('H754');
    expect(cercaComuni('roma')[0].codice).toBe('H501');
    expect(cercaComuni('r')).toEqual([]);
  });
});

describe('Addizionali dovute dal domicilio', () => {
  const domicilio = (codiceComune: string, codiceComuneAcconto = '') => ({
    dataNascita: '',
    domicilioFiscale: { comune: '', provincia: '', regione: '', codiceComune },
    domicilioFiscaleAcconto: codiceComuneAcconto ? { comune: '', provincia: '', regione: '', codiceComune: codiceComuneAcconto } : null
  });

  it("non sono dovute se l'IRPEF netta non supera 10 €", () => {
    expect(calcolaAddizionaliDovute(8000, 0, domicilio('H501'))).toMatchObject({ regionale: 0, comunale: 0, accontoComunale: 0 });
    expect(calcolaAddizionaliDovute(20000, 10, domicilio('H501'))).toMatchObject({ regionale: 0, comunale: 0, accontoComunale: 0 });
    expect(calcolaAddizionaliDovute(20000, 10.01, domicilio('H501')).regionale).toBeGreaterThan(0);
  });

  it("usa il comune al 1/1/2026 per l'acconto", () => {
    const result = calcolaAddizionaliDovute(30000, 5000, domicilio('H501', 'F205'));
    expect(result.regionale).toBe(699);
    expect(result.comunale).toBe(270);
    expect(result.accontoComunale).toBe(72);
  });

  it('non applica le delibere inapplicabili per l\'anno e lo segnala una volta sola', () => {
    const result = calcolaAddizionaliDovute(30000, 5000, domicilio('G703'));
    expect(result.comunale).toBeNull();
    expect(result.accontoComunale).toBeNull();
    expect(result.warnings.filter((w) => w.includes('verificare'))).toHaveLength(1);
  });

  it('segnala le esenzioni comunali particolari (rigo F7)', () => {
    const result = calcolaAddizionaliDovute(30000, 5000, domicilio('A024'));
    expect(result.comunale).toBe(240);
    expect(result.warnings.some((w) => w.includes('F7'))).toBe(true);
  });

  it('segnala un comune non riconosciuto', () => {
    const result = calcolaAddizionaliDovute(30000, 5000, domicilio('Z999'));
    expect(result.comunale).toBeNull();
    expect(result.regionale).toBeNull();
    expect(result.warnings.some((w) => w.includes('non riconosciuto'))).toBe(true);
  });
});
