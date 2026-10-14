import { SpesaSanitaria } from '@/types/tax';

/** Spese pronte per l'import: solo quelle con importo positivo. */
export function cleanImportedExpenses(expenses: Partial<SpesaSanitaria>[]): SpesaSanitaria[] {
  return expenses
    .filter((expense): expense is Partial<SpesaSanitaria> & { importo: number } => (expense.importo ?? 0) > 0)
    .map((expense) => ({
      id: `spesa-${crypto.randomUUID()}`,
      tipo: 'sanitarie' as const,
      sottotipo: expense.sottotipo || 'mediche',
      descrizione: expense.descrizione?.trim() || 'Spesa importata da CSV',
      importo: expense.importo,
      detrazione: 0,
      dataInserimento: expense.dataInserimento || new Date(),
      validata: false
    }));
}

const chiave = (spesa: Pick<SpesaSanitaria, 'importo' | 'descrizione' | 'dataInserimento'>) =>
  `${spesa.importo}|${spesa.descrizione}|${new Date(spesa.dataInserimento).toDateString()}`;

/** Toglie le spese già presenti (stesso importo, descrizione e data), per non contarle due volte reimportando il file. */
export function senzaDuplicati(nuove: SpesaSanitaria[], esistenti: SpesaSanitaria[]): SpesaSanitaria[] {
  const presenti = new Set(esistenti.map(chiave));
  return nuove.filter((spesa) => !presenti.has(chiave(spesa)));
}
