/**
 * Controlli di coerenza sui dati CU e sul risultato.
 * Producono solo segnalazioni: i dati certificati dal sostituto non vengono mai modificati.
 */

import { CUData } from '@/types/tax';

export interface FiscalValidationResult {
  isValid: boolean;
  errors: FiscalValidationError[];
  warnings: FiscalValidationWarning[];
  suggestions: string[];
}

export interface FiscalValidationError {
  field: string;
  message: string;
  value: number;
  threshold: number;
  severity: 'critical' | 'high' | 'medium';
}

export interface FiscalValidationWarning {
  field: string;
  message: string;
  value: number;
  expectedRange: string;
}

const ALIQUOTA_IRPEF_MASSIMA = 0.43;
const ALIQUOTA_REGIONALE_MASSIMA = 0.0333;
const ALIQUOTA_COMUNALE_MASSIMA = 0.009;
const MARGINE = 1.05;

export function validateCUData(cuData: CUData | null): FiscalValidationResult {
  const result: FiscalValidationResult = { isValid: true, errors: [], warnings: [], suggestions: [] };

  if (!cuData) {
    result.isValid = false;
    result.errors.push({
      field: 'cuData',
      message: 'Nessun dato CU disponibile',
      value: 0,
      threshold: 0,
      severity: 'critical'
    });
    return result;
  }

  const reddito = cuData.backend.redditi.totaleImponibile;
  const { irpef, addRegionale, addComunale } = cuData.backend.ritenute;

  if (reddito <= 0) {
    result.isValid = false;
    result.errors.push({
      field: 'redditi.totaleImponibile',
      message: 'Reddito mancante o non valido',
      value: reddito,
      threshold: 0,
      severity: 'critical'
    });
    return result;
  }

  const checks = [
    { field: 'ritenute.irpef', label: 'IRPEF trattenuta (punto 21)', value: irpef, max: reddito * ALIQUOTA_IRPEF_MASSIMA },
    { field: 'ritenute.addRegionale', label: 'Addizionale regionale (punto 22)', value: addRegionale, max: reddito * ALIQUOTA_REGIONALE_MASSIMA },
    { field: 'ritenute.addComunale', label: 'Addizionale comunale (punti 26-27)', value: addComunale, max: reddito * ALIQUOTA_COMUNALE_MASSIMA }
  ];

  for (const check of checks) {
    if (check.value > check.max * MARGINE) {
      result.warnings.push({
        field: check.field,
        message: `${check.label} più alta del massimo teorico: controlla che il valore letto dalla CU sia corretto.`,
        value: check.value,
        expectedRange: `0 € - ${check.max.toFixed(2)} €`
      });
    }
  }

  if (cuData.backend.detrazioni.giorniLavorati > 365) {
    result.warnings.push({
      field: 'detrazioni.giorniLavorati',
      message: 'Giorni di lavoro superiori a 365',
      value: cuData.backend.detrazioni.giorniLavorati,
      expectedRange: '1 - 365'
    });
  }

  if (result.warnings.length > 0) {
    result.suggestions.push('Confronta i valori estratti con la CU originale e correggili se necessario.');
  }

  return result;
}

/** risultatoFinale: positivo = credito, negativo = debito. */
export function validateFiscalResult(
  risultatoFinale: number,
  redditoImponibile: number,
  totaleRitenute: number
): FiscalValidationResult {
  const result: FiscalValidationResult = { isValid: true, errors: [], warnings: [], suggestions: [] };

  if (risultatoFinale > 0 && risultatoFinale > totaleRitenute * 1.1) {
    result.warnings.push({
      field: 'risultatoFinale',
      message: `Credito superiore alle ritenute trattenute (${totaleRitenute.toFixed(2)} €)`,
      value: risultatoFinale,
      expectedRange: `0 € - ${totaleRitenute.toFixed(2)} €`
    });
    result.suggestions.push('Un credito maggiore delle ritenute è possibile solo con detrazioni rimborsabili: verifica i dati inseriti.');
  }

  if (risultatoFinale < 0 && redditoImponibile > 0) {
    const debitoPercent = (Math.abs(risultatoFinale) / redditoImponibile) * 100;
    if (debitoPercent > 20) {
      result.warnings.push({
        field: 'risultatoFinale',
        message: `Debito elevato: ${debitoPercent.toFixed(1)}% del reddito`,
        value: Math.abs(risultatoFinale),
        expectedRange: '0% - 20%'
      });
      result.suggestions.push('Un debito così alto può indicare ritenute lette male dalla CU: ricontrolla il punto 21.');
    }
  }

  return result;
}
