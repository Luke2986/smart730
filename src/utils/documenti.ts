import { ANNO_IMPOSTA } from './annoFiscale';
import type { Smart730State } from '@/types/tax';

export type TipoDocumenti = 'cu' | 'sanitarie' | 'mutuo' | 'affitto';

/** Documenti da tenere per il CAF o per un controllo: l'app non li carica, li elenca. */
export const DOCUMENTI_DA_CONSERVARE: Record<TipoDocumenti, { titolo: string; voci: string[] }> = {
  cu: {
    titolo: 'Redditi',
    voci: [`Le Certificazioni Uniche dei redditi ${ANNO_IMPOSTA}, una per ogni datore di lavoro o ente pensionistico`]
  },
  sanitarie: {
    titolo: 'Spese sanitarie (rigo E1)',
    voci: [
      'Scontrini parlanti e fatture intestati a te, con il codice fiscale',
      'Prova del pagamento tracciabile (carta, bancomat, bonifico) per le prestazioni sanitarie private',
      'Per i dispositivi medici: la marcatura CE indicata sullo scontrino o sulla confezione'
    ]
  },
  mutuo: {
    titolo: 'Interessi del mutuo (rigo E7)',
    voci: [
      `Certificazione della banca con gli interessi pagati nel ${ANNO_IMPOSTA}`,
      "Contratto di mutuo e atto di acquisto dell'immobile",
      "Se serve, autocertificazione che l'immobile è la tua abitazione principale"
    ]
  },
  affitto: {
    titolo: 'Affitto (rigo E71)',
    voci: [
      'Contratto di locazione registrato',
      `Ricevute o bonifici del canone pagato nel ${ANNO_IMPOSTA}`,
      "Autocertificazione che l'immobile è la tua abitazione principale"
    ]
  }
};

export function documentiPerDichiarazione(state: Smart730State): TipoDocumenti[] {
  const tipi: TipoDocumenti[] = ['cu'];
  if (Object.values(state.spese).some((spesa) => spesa.tipo === 'sanitarie')) tipi.push('sanitarie');
  if (state.mutuo) tipi.push('mutuo');
  if (state.affitto) tipi.push('affitto');
  return tipi;
}
