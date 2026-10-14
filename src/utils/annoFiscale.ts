/** Modello 730/2026: redditi dell'anno 2025. */
export const ANNO_IMPOSTA = 2025;
/** Anno di presentazione del 730, degli acconti e del domicilio per l'acconto comunale. */
export const ANNO_DICHIARAZIONE = ANNO_IMPOSTA + 1;

/** Sabato e domenica slittano al lunedì; le festività infrasettimanali non sono considerate. */
function primoGiornoLavorativo(giorno: Date): Date {
  const data = new Date(giorno);
  while (data.getDay() === 0 || data.getDay() === 6) data.setDate(data.getDate() + 1);
  return data;
}

/** Termini ordinari di presentazione: 730 entro il 30 settembre, Redditi PF online entro il 31 ottobre. */
export const SCADENZA_730 = primoGiornoLavorativo(new Date(ANNO_DICHIARAZIONE, 8, 30));
export const SCADENZA_REDDITI_PF = primoGiornoLavorativo(new Date(ANNO_DICHIARAZIONE, 9, 31));

/** Vero dal giorno successivo alla scadenza. */
export const scaduto = (scadenza: Date, oggi = new Date()) =>
  oggi.getTime() >= new Date(scadenza.getFullYear(), scadenza.getMonth(), scadenza.getDate() + 1).getTime();
