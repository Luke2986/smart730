import { describe, expect, it } from 'vitest';
import { leggiPuntiCU, type TestoPdf } from '../cuPdf';

// Disposizioni sintetiche del testo di una CU: coordinate in punti, y dall'alto.
const t = (str: string, x: number, y: number, h = 9, pagina = 1): TestoPdf => ({
  str, x, y, h, w: str.length * h * 0.5, pagina
});
const etichetta = (n: number, x: number, y: number, pagina = 1) => t(String(n), x, y, 5, pagina);

describe('Lettura dei punti della CU dal testo del PDF', () => {
  it('modello a riquadri: etichette piccole in alto a sinistra, valori sotto', () => {
    const { punti } = leggiPuntiCU([
      t('DATI FISCALI', 200, 60, 10),
      etichetta(1, 20, 100), etichetta(2, 120, 100), etichetta(3, 220, 100), etichetta(10, 320, 100),
      t('20.000,00', 70, 112), t('1.500,50', 250, 112), t('999,99', 370, 112),
      etichetta(6, 20, 140), etichetta(7, 120, 140), etichetta(8, 220, 140),
      t('365', 90, 152), t('01/01/2025', 230, 152),
      etichetta(21, 20, 180), etichetta(22, 120, 180),
      t('4.000,00', 70, 192), t('300,00', 180, 192),
      etichetta(718, 20, 220), etichetta(719, 120, 220),
      t('1', 100, 232), t('20.000,00', 160, 232)
    ]);

    expect(punti).toEqual({ 1: 20000, 3: 1500.5, 6: 365, 21: 4000, 22: 300, 718: 1, 719: 20000 });
  });

  it('modello a elenco: numero e descrizione nello stesso frammento, valore a destra', () => {
    const { punti } = leggiPuntiCU([
      t('DATI FISCALI', 200, 60),
      t('1 Redditi di lavoro dipendente e assimilati (art. 49)', 20, 100), t('25.000,00', 450, 100),
      t('6 Numero di giorni di lavoro dipendente', 20, 115), t('300', 470, 115),
      t('21 Ritenute Irpef', 20, 130), t('€ 5.000,00', 440, 130),
      t('22 Addizionale regionale all\'Irpef', 20, 145), t('412,34', 460, 145)
    ]);

    expect(punti).toEqual({ 1: 25000, 6: 300, 21: 5000, 22: 412.34 });
  });

  it('etichetta e valore nello stesso frammento', () => {
    const { punti } = leggiPuntiCU([t('DATI FISCALI', 200, 60), t('1 18.000,00', 20, 100), t('6 200', 20, 115)]);
    expect(punti).toEqual({ 1: 18000, 6: 200 });
  });

  it('legge solo la sezione dei dati fiscali e i codici comune prima di essa', () => {
    const lettura = leggiPuntiCU([
      t('DATI ANAGRAFICI', 200, 40, 10),
      t('H501', 300, 80), t('Z999', 300, 90), t('F205', 300, 100), t('H501', 300, 110),
      etichetta(1, 20, 120), t('7.777,77', 70, 132),
      t('DATI FISCALI', 200, 160, 10),
      etichetta(1, 20, 200), t('20.000,00', 70, 212),
      t('DATI PREVIDENZIALI ED ASSISTENZIALI INPS', 150, 60, 10, 2),
      etichetta(1, 20, 100, 2), t('22.222,22', 70, 112, 9, 2)
    ]);

    expect(lettura.punti).toEqual({ 1: 20000 });
    expect(lettura.codiciComune).toEqual(['H501', 'F205']);
  });

  it('segnala i punti ripetuti con valori diversi e tiene il primo', () => {
    const lettura = leggiPuntiCU([
      t('DATI FISCALI', 200, 60, 10),
      etichetta(21, 20, 100), t('4.000,00', 70, 112),
      etichetta(21, 20, 300), t('4.100,00', 70, 312)
    ]);

    expect(lettura.punti).toEqual({ 21: 4000 });
    expect(lettura.ripetuti).toEqual([21]);
  });

  it('ignora gli importi scritti in piccolo nelle descrizioni e i valori fuori intervallo', () => {
    const { punti } = leggiPuntiCU([
      t('DATI FISCALI', 200, 60, 10),
      etichetta(725, 20, 100), t('fino a 960,00 euro', 30, 106, 5), t('480,00', 80, 116),
      etichetta(718, 120, 100), t('3', 160, 116),
      etichetta(6, 220, 100), t('400', 260, 116)
    ]);

    expect(punti).toEqual({ 725: 480 });
  });

  it('senza intestazione legge tutto il documento', () => {
    expect(leggiPuntiCU([etichetta(3, 20, 100), t('12.000,00', 70, 112)]).punti).toEqual({ 3: 12000 });
  });
});
