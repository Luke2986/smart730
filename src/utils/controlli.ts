import type { CUData, Smart730State } from '@/types/tax';
import type { TaxCalculationResult } from './taxCalculations';

export type Sezione = 'cu' | 'sts' | 'riepilogo';

export interface Controllo {
  /** errore: il risultato non è affidabile; avviso: da controllare; nota: informazione sul calcolo. */
  livello: 'errore' | 'avviso' | 'nota';
  testo: string;
  /** Schermata in cui si corregge il dato. */
  sezione?: Sezione;
}

export const cuDiLavoro = (cus: CUData[]) => cus.filter((cu) => cu.backend.redditi.lavoroDipendente > 0);

export function controlliDichiarazione(state: Smart730State, risultato: TaxCalculationResult): Controllo[] {
  if (state.cus.length === 0) {
    return [{ livello: 'errore', testo: 'Nessuna CU inserita: senza redditi non c\'è niente da calcolare.', sezione: 'cu' }];
  }

  const controlli: Controllo[] = [];

  for (const cu of state.cus) {
    for (const avviso of cu.ui.avvisi ?? []) {
      controlli.push({ livello: 'avviso', testo: `${cu.nome}: ${avviso}`, sezione: 'cu' });
    }
  }

  if (cuDiLavoro(state.cus).length > 1 && state.giorniLavoro === null) {
    controlli.push({
      livello: 'avviso',
      testo: 'Hai più CU di lavoro dipendente: indica i giorni di lavoro effettivi (rigo C5). '
        + 'Ora il calcolo somma i giorni delle CU, che è sbagliato se i periodi si sovrappongono.',
      sezione: 'cu'
    });
  }

  const speseSenzaImporto = Object.values(state.spese).filter((spesa) => spesa.importo <= 0).length;
  if (speseSenzaImporto > 0) {
    controlli.push({
      livello: 'avviso',
      testo: speseSenzaImporto === 1
        ? '1 spesa senza importo: non entra nel calcolo.'
        : `${speseSenzaImporto} spese senza importo: non entrano nel calcolo.`,
      sezione: 'sts'
    });
  }

  const validation = risultato.validation;
  if (validation) {
    for (const errore of validation.errors) controlli.push({ livello: 'errore', testo: errore.message });
    for (const avviso of validation.warnings) controlli.push({ livello: 'avviso', testo: avviso.message });
    for (const nota of new Set(validation.suggestions)) controlli.push({ livello: 'nota', testo: nota });
  }

  return controlli;
}
