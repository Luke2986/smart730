import { CUData, Spesa, SpesaSanitaria, DetrazioneAffittoData, DetrazioneMutuoData } from '@/types/tax';
import { PERCENTUALE_ACCONTO_ADD_COMUNALE, calcolaAddizionaliDovute } from './addizionaliCalculations';
import { validateCUData, validateFiscalResult, type FiscalValidationResult } from './fiscalValidation';
import { calcolaDetrazioneSanitarie } from './medicalExpenseCalculations';
import { calculateDetrazioneMutuo } from './detrazioniMutuo';
import { calculateDetrazioneAffitto } from './detrazioniAffitto';

/**
 * Motore di calcolo del 730/2026 (anno d'imposta 2025).
 * Regole: istruzioni ufficiali 730/2026, tabelle 6-8 (detrazioni), e circolare di liquidazione del 730/2026
 * (Allegato C: rigo C14 per il cuneo fiscale, par. 19.24 per le addizionali, par. 19.26 per saldi e acconti).
 */

export interface CalculationInput {
  cu: CUData | null;
  spese: Record<string, Spesa>;
  mutuo?: DetrazioneMutuoData | null;
  affitto?: DetrazioneAffittoData | null;
}

export interface AccontoIRPEF {
  totale: number;
  primaRata: number;
  secondaRata: number;
}

export interface TaxCalculationResult {
  irpefLorda: number;
  /** Detrazioni per tipo di reddito: lavoro dipendente + pensione + altri assimilati */
  detrazioneLavoro: number;
  detrazioniRedditi: { lavoro: number; pensione: number; assimilati: number };
  /** Ulteriore detrazione per lavoro dipendente con reddito oltre 20.000 e fino a 40.000 € (rigo 34 del 730-3) */
  ulterioreDetrazione: number;
  /** Somma esente per lavoro dipendente fino a 20.000 €; null se la CU non riporta i punti 724-725 */
  sommaEsente: { spettante: number; erogata: number } | null;
  /** Detrazioni per oneri (quadro E) */
  detrazioniSpese: number;
  /** riduzione: oneri al 19% (escluse sanitarie e mutuo) ridotti oltre 120.000 € di reddito (art. 15 c. 3-bis TUIR) */
  detrazioniOneri: { sanitarie: number; mutuo: number; affitto: number; riduzione: number };
  irpefNetta: number;
  addRegionaleDovuta: number;
  addComunaleDovuta: number;
  addComunaleSaldo: number;
  accontoAddComunale: number;
  imposteTotaliDovute: number;
  /** IRPEF + addizionali già trattenute dal sostituto */
  ritenuteVersate: number;
  addizionaliTrattenute: number;
  accreditiPrecedenti: number;
  accontoIRPEF: AccontoIRPEF;
  /** Positivo = rimborso, negativo = da versare. Comprende i saldi dell'anno d'imposta e gli acconti dell'anno successivo. */
  risultatoFinale: number;
  warnings: string[];
  validation?: FiscalValidationResult;
  breakdown: {
    reddito: number;
    scaglioni: Array<{
      scaglione: string;
      imponibile: number;
      aliquota: number;
      imposta: number;
    }>;
  };
  /** Importi positivi = a debito, negativi = a credito (convenzione del 730-3) */
  liquidazione: {
    differenzaIRPEF: number;
    /** Somma esente erogata meno spettante: positiva = da restituire, negativa = da ricevere (righi 66-67 del 730-3) */
    sommaEsente: number;
    saldoIRPEF: number;
    saldoAddRegionale: number;
    saldoAddComunale: number;
    accontoAddComunale: number;
    accontoIRPEF: number;
    totaleSaldi: number;
    totaleAcconti: number;
    totaleDaVersare: number;
  };
}

const GIORNI_ANNO = 365;
const SOGLIA_ACCONTO_IRPEF = 52;
const SOGLIA_RATA_UNICA_ACCONTO = 257.52;
const PERCENTUALE_PRIMA_RATA = 0.4;
const SOGLIA_MINIMA_RIMBORSO_TRATTENUTA = 12;
const SOGLIA_RIDUZIONE_ONERI = 120000;
const SOGLIA_RIORDINO_ONERI = 75000;
const SOGLIA_SOMMA_ESENTE = 20000;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
// Tabelle 6-8, nota 2: i rapporti si assumono nelle prime 4 cifre decimali.
const ratio4 = (n: number) => Math.trunc(n * 10000) / 10000;
const clampDays = (n: number, max = GIORNI_ANNO) => Math.min(Math.max(n, 0), max);
const zeroSottoSoglia = (n: number) => (Math.abs(n) <= SOGLIA_MINIMA_RIMBORSO_TRATTENUTA ? 0 : n);

export const IRPEF_BRACKETS = [
  { min: 0, max: 28000, rate: 0.23 },
  { min: 28000, max: 50000, rate: 0.35 },
  { min: 50000, max: Infinity, rate: 0.43 }
] as const;

export function calculateIRPEFByBrackets(redditoImponibile: number): number {
  return round2(getIRPEFBreakdown(redditoImponibile).reduce((sum, s) => sum + s.imponibile * s.aliquota, 0));
}

export function getIRPEFBreakdown(redditoImponibile: number): TaxCalculationResult['breakdown']['scaglioni'] {
  if (redditoImponibile <= 0) return [];

  return IRPEF_BRACKETS.flatMap((bracket) => {
    const imponibile = Math.min(redditoImponibile, bracket.max) - bracket.min;
    if (imponibile <= 0) return [];
    return [{
      scaglione: bracket.max === Infinity
        ? `oltre €${bracket.min.toLocaleString('it-IT', { useGrouping: 'always' })}`
        : `€${bracket.min.toLocaleString('it-IT', { useGrouping: 'always' })} - €${bracket.max.toLocaleString('it-IT', { useGrouping: 'always' })}`,
      imponibile: round2(imponibile),
      aliquota: bracket.rate,
      imposta: round2(imponibile * bracket.rate)
    }];
  });
}

/** Tabella 6: lavoro dipendente e assimilati (sez. I quadro C), rapportata ai giorni di lavoro. */
export function calcolaDetrazioneLavoro(
  redditoComplessivo: number,
  giorni: number = GIORNI_ANNO,
  tempoDeterminato = false
): number {
  const g = clampDays(giorni);
  if (g === 0) return 0;

  const r = redditoComplessivo;
  let base = 0;
  if (r <= 15000) base = 1955;
  else if (r <= 28000) base = 1910 + 1190 * ratio4((28000 - r) / 13000);
  else if (r <= 50000) base = 1910 * ratio4((50000 - r) / 22000);

  let detrazione = base * g / GIORNI_ANNO;
  if (r <= 15000) detrazione = Math.max(detrazione, tempoDeterminato ? 1380 : 690);
  if (r > 25000 && r <= 35000) detrazione += 65;
  return round2(detrazione);
}

/** Tabella 7: pensione, rapportata ai giorni di pensione. */
export function calcolaDetrazionePensione(redditoComplessivo: number, giorni: number = GIORNI_ANNO): number {
  const g = clampDays(giorni);
  if (g === 0) return 0;

  const r = redditoComplessivo;
  let base = 0;
  if (r <= 8500) base = 1955;
  else if (r <= 28000) base = 700 + 1255 * ratio4((28000 - r) / 19500);
  else if (r <= 50000) base = 700 * ratio4((50000 - r) / 22000);

  let detrazione = base * g / GIORNI_ANNO;
  if (r <= 8500) detrazione = Math.max(detrazione, 713);
  if (r > 25000 && r <= 29000) detrazione += 50;
  return round2(detrazione);
}

/** Tabella 8: altri redditi assimilati (sez. II quadro C), non rapportata al periodo. */
export function calcolaDetrazioneAltriAssimilati(redditoComplessivo: number): number {
  const r = redditoComplessivo;
  let detrazione = 0;
  if (r <= 5500) detrazione = 1265;
  else if (r <= 28000) detrazione = 500 + 765 * ratio4((28000 - r) / 22500);
  else if (r <= 50000) detrazione = 500 * ratio4((50000 - r) / 22000);

  if (r > 11000 && r <= 17000) detrazione += 50;
  return round2(detrazione);
}

export function calcolaDetrazioniRedditi(cu: CUData): {
  lavoro: number;
  pensione: number;
  assimilati: number;
  warnings: string[];
} {
  const { lavoroDipendente, lavoroTempoDeterminato = 0, pensione, assimilati, totaleImponibile } = cu.backend.redditi;
  const warnings: string[] = [];

  const soloTempoDeterminato = lavoroDipendente > 0 && lavoroTempoDeterminato >= lavoroDipendente;
  if (lavoroTempoDeterminato > 0 && !soloTempoDeterminato && totaleImponibile <= 15000) {
    warnings.push('Lavoro a tempo determinato e indeterminato nello stesso anno: è applicata la detrazione minima di 690 €.');
  }

  const giorniLavoro = lavoroDipendente > 0
    ? clampDays(cu.backend.detrazioni.giorniLavorati || GIORNI_ANNO)
    : 0;

  // Lavoro e pensione non sono cumulabili per lo stesso periodo: i giorni sommati non superano 365.
  const giorniPensioneMax = GIORNI_ANNO - giorniLavoro;
  const giorniPensioneDichiarati = cu.backend.detrazioni.giorniPensione ?? giorniPensioneMax;
  const giorniPensione = pensione > 0 ? clampDays(giorniPensioneDichiarati, giorniPensioneMax) : 0;
  if (pensione > 0 && lavoroDipendente > 0) {
    warnings.push('Redditi di lavoro e di pensione nello stesso anno: verifica che i giorni di lavoro e di pensione siano corretti.');
  }

  let detrazioneAssimilati = 0;
  if (assimilati > 0) {
    if (lavoroDipendente > 0 || pensione > 0) {
      warnings.push('Altri redditi assimilati insieme a lavoro o pensione: la relativa detrazione non è calcolata.');
    } else {
      detrazioneAssimilati = calcolaDetrazioneAltriAssimilati(totaleImponibile);
    }
  }

  return {
    lavoro: lavoroDipendente > 0 ? calcolaDetrazioneLavoro(totaleImponibile, giorniLavoro, soloTempoDeterminato) : 0,
    pensione: pensione > 0 ? calcolaDetrazionePensione(totaleImponibile, giorniPensione) : 0,
    assimilati: detrazioneAssimilati,
    warnings
  };
}

/** Ulteriore detrazione (L. 207/2024, art. 1 c. 6): reddito complessivo oltre 20.000 e fino a 40.000 €, rapportata ai giorni. */
export function calcolaUlterioreDetrazione(redditoComplessivo: number, giorni: number = GIORNI_ANNO): number {
  const r = redditoComplessivo;
  if (r <= SOGLIA_SOMMA_ESENTE || r > 40000) return 0;
  const base = r <= 32000 ? 1000 : (1000 * (40000 - r)) / 8000;
  return round2((base * clampDays(giorni)) / GIORNI_ANNO);
}

/**
 * Somma esente (L. 207/2024, art. 1 c. 4-5): reddito complessivo fino a 20.000 €.
 * La percentuale dipende dal reddito di lavoro dipendente rapportato all'anno e si applica a quello effettivo.
 */
export function calcolaSommaEsente(redditoComplessivo: number, redditoLavoro: number, giorni: number = GIORNI_ANNO): number {
  const g = clampDays(giorni);
  if (redditoComplessivo > SOGLIA_SOMMA_ESENTE || redditoLavoro <= 0 || g === 0) return 0;
  const redditoAnnuo = (redditoLavoro * GIORNI_ANNO) / g;
  const percentuale = redditoAnnuo <= 8500 ? 0.071 : redditoAnnuo <= 15000 ? 0.053 : 0.048;
  return round2(redditoLavoro * percentuale);
}

/** Cuneo fiscale del lavoro dipendente (rigo C14): spetta per il lavoro dipendente, escluse le pensioni. */
export function calcolaCuneoFiscale(cu: CUData): {
  ulterioreDetrazione: number;
  sommaEsente: TaxCalculationResult['sommaEsente'];
  warnings: string[];
} {
  const { redditi, detrazioni, cuneoFiscale } = cu.backend;
  const reddito = redditi.totaleImponibile;
  const warnings: string[] = [];
  const haLavoroDipendente = cuneoFiscale ? cuneoFiscale.lavoroDipendente : redditi.lavoroDipendente > 0;
  const giorni = cuneoFiscale?.giorniLavoro || detrazioni.giorniLavorati || GIORNI_ANNO;
  const redditoLavoro = cuneoFiscale?.redditoLavoroDipendente || redditi.lavoroDipendente;

  const ulterioreDetrazione = haLavoroDipendente ? calcolaUlterioreDetrazione(reddito, giorni) : 0;

  if (!cuneoFiscale) {
    if (haLavoroDipendente && reddito <= SOGLIA_SOMMA_ESENTE) {
      warnings.push('La CU non riporta la somma esente per redditi fino a 20.000 € (punti 724-725): non è ricalcolata.');
    }
    return { ulterioreDetrazione, sommaEsente: null, warnings };
  }

  const spettante = haLavoroDipendente ? calcolaSommaEsente(reddito, redditoLavoro, giorni) : 0;
  const erogata = cuneoFiscale.sommaErogata || 0;
  const differenza = round2(spettante - erogata);
  if (differenza > 0) {
    warnings.push(`Somma esente non erogata in busta paga: ${formatCurrencyDetailed(differenza)} riconosciuti in dichiarazione.`);
  } else if (differenza < 0) {
    warnings.push(`Somma esente erogata in busta paga ma non spettante: ${formatCurrencyDetailed(-differenza)} vengono recuperati.`);
  }
  return { ulterioreDetrazione, sommaEsente: { spettante, erogata }, warnings };
}

export function calcolaAccontoIRPEF(differenzaIRPEF: number): AccontoIRPEF {
  if (differenzaIRPEF < SOGLIA_ACCONTO_IRPEF) {
    return { totale: 0, primaRata: 0, secondaRata: 0 };
  }

  const totale = round2(differenzaIRPEF);
  if (totale < SOGLIA_RATA_UNICA_ACCONTO) {
    return { totale, primaRata: 0, secondaRata: totale };
  }

  const primaRata = round2(totale * PERCENTUALE_PRIMA_RATA);
  return { totale, primaRata, secondaRata: round2(totale - primaRata) };
}

function emptyResult(): TaxCalculationResult {
  return {
    irpefLorda: 0,
    detrazioneLavoro: 0,
    detrazioniRedditi: { lavoro: 0, pensione: 0, assimilati: 0 },
    ulterioreDetrazione: 0,
    sommaEsente: null,
    detrazioniSpese: 0,
    detrazioniOneri: { sanitarie: 0, mutuo: 0, affitto: 0, riduzione: 0 },
    irpefNetta: 0,
    addRegionaleDovuta: 0,
    addComunaleDovuta: 0,
    addComunaleSaldo: 0,
    accontoAddComunale: 0,
    imposteTotaliDovute: 0,
    ritenuteVersate: 0,
    addizionaliTrattenute: 0,
    accreditiPrecedenti: 0,
    accontoIRPEF: { totale: 0, primaRata: 0, secondaRata: 0 },
    risultatoFinale: 0,
    warnings: [],
    breakdown: { reddito: 0, scaglioni: [] },
    liquidazione: {
      differenzaIRPEF: 0,
      sommaEsente: 0,
      saldoIRPEF: 0,
      saldoAddRegionale: 0,
      saldoAddComunale: 0,
      accontoAddComunale: 0,
      accontoIRPEF: 0,
      totaleSaldi: 0,
      totaleAcconti: 0,
      totaleDaVersare: 0
    }
  };
}

export function calculateCompleteTaxResult({ cu, spese, mutuo, affitto }: CalculationInput): TaxCalculationResult {
  if (!cu) return emptyResult();

  const { redditi, ritenute, acconti, creditiPrecedenti, datiAnagrafici } = cu.backend;
  const reddito = redditi.totaleImponibile;
  const warnings: string[] = [];

  // IRPEF
  const irpefLorda = calculateIRPEFByBrackets(reddito);
  const detrazioniRedditi = calcolaDetrazioniRedditi(cu);
  warnings.push(...detrazioniRedditi.warnings);
  const detrazioneLavoro = round2(detrazioniRedditi.lavoro + detrazioniRedditi.pensione + detrazioniRedditi.assimilati);
  const cuneo = calcolaCuneoFiscale(cu);
  warnings.push(...cuneo.warnings);
  const { ulterioreDetrazione } = cuneo;

  const speseSanitarie = Object.values(spese).filter((s): s is SpesaSanitaria => s.tipo === 'sanitarie');
  const sanitarie = calcolaDetrazioneSanitarie(speseSanitarie);
  const detrazioneMutuo = mutuo ? calculateDetrazioneMutuo(mutuo) : 0;
  const detrazioneAffitto = affitto ? calculateDetrazioneAffitto({ ...affitto, redditoComplessivo: reddito }) : 0;
  // Art. 15 c. 3-bis TUIR: oltre 120.000 € la detrazione decresce fino ad annullarsi a 240.000 €.
  // Restano intere le spese sanitarie e gli interessi del mutuo; le veterinarie sono un onere distinto e si riducono.
  const riduzioneOneri = reddito > SOGLIA_RIDUZIONE_ONERI
    ? round2(sanitarie.detrazioneVeterinarie * Math.min(1, (reddito - SOGLIA_RIDUZIONE_ONERI) / SOGLIA_RIDUZIONE_ONERI))
    : 0;
  if (riduzioneOneri > 0) {
    warnings.push(`Reddito oltre 120.000 €: la detrazione per le spese veterinarie è ridotta di ${formatCurrencyDetailed(riduzioneOneri)}.`);
  }
  if (reddito > SOGLIA_RIORDINO_ONERI && detrazioneMutuo > 0) {
    warnings.push(
      'Reddito oltre 75.000 €: se il mutuo è stato stipulato dal 2025 gli interessi rientrano nel limite agli oneri detraibili (art. 16-ter TUIR), non calcolato.'
    );
  }
  const detrazioniOneri = {
    sanitarie: sanitarie.totaleDetrazione,
    mutuo: detrazioneMutuo,
    affitto: detrazioneAffitto,
    riduzione: riduzioneOneri
  };
  const detrazioniSpese = round2(sanitarie.totaleDetrazione + detrazioneMutuo + detrazioneAffitto - riduzioneOneri);

  const irpefNetta = round2(Math.max(0, irpefLorda - detrazioneLavoro - ulterioreDetrazione - detrazioniSpese));
  if (detrazioniOneri.affitto > 0 && irpefLorda < detrazioneLavoro + ulterioreDetrazione + detrazioniSpese) {
    warnings.push("Imposta incapiente: l'eventuale detrazione per affitto non utilizzata può spettare come rimborso, verificala con un CAF.");
  }

  const ritenuteIrpef = ritenute.irpef || 0;
  const accontiVersati = acconti?.totaleAcconti || 0;
  const creditiRiportati = creditiPrecedenti?.totaleCreditiRiportati || 0;
  const differenzaIRPEF = round2(irpefNetta - ritenuteIrpef);
  const conguaglioSommaEsente = cuneo.sommaEsente ? round2(cuneo.sommaEsente.erogata - cuneo.sommaEsente.spettante) : 0;
  const saldoIRPEF = zeroSottoSoglia(round2(differenzaIRPEF - accontiVersati - creditiRiportati + conguaglioSommaEsente));
  const accontoIRPEF = calcolaAccontoIRPEF(differenzaIRPEF);

  // Addizionali
  const addRegTrattenuta = ritenute.addRegionale || 0;
  const addComTrattenuta = ritenute.addComunale || 0;
  const addizionali = calcolaAddizionaliDovute(reddito, irpefNetta, datiAnagrafici);
  warnings.push(...addizionali.warnings);
  const addRegionaleDovuta = addizionali.regionale ?? addRegTrattenuta;
  const addComunaleDovuta = addizionali.comunale ?? addComTrattenuta;
  const accontoAddComunaleLordo = addizionali.accontoComunale
    ?? round2(addComunaleDovuta * PERCENTUALE_ACCONTO_ADD_COMUNALE);

  const saldoAddRegionale = zeroSottoSoglia(round2(addRegionaleDovuta - addRegTrattenuta));
  const saldoAddComunale = zeroSottoSoglia(round2(addComunaleDovuta - addComTrattenuta));
  const accontoAddComunale = zeroSottoSoglia(round2(Math.max(
    0,
    accontoAddComunaleLordo - (ritenute.addComunaleAccontoSuccessivo || 0)
  )));

  // Liquidazione
  const totaleSaldi = round2(saldoIRPEF + saldoAddRegionale + saldoAddComunale);
  const totaleAcconti = round2(accontoIRPEF.totale + accontoAddComunale);
  const totaleDaVersare = round2(totaleSaldi + totaleAcconti);
  const risultatoFinale = round2(-totaleDaVersare);

  const addizionaliTrattenute = round2(addRegTrattenuta + addComTrattenuta);
  const ritenuteVersate = round2(ritenuteIrpef + addizionaliTrattenute);

  const cuValidation = validateCUData(cu);
  const resultValidation = validateFiscalResult(risultatoFinale, reddito, ritenuteVersate);

  return {
    irpefLorda,
    detrazioneLavoro,
    detrazioniRedditi: {
      lavoro: detrazioniRedditi.lavoro,
      pensione: detrazioniRedditi.pensione,
      assimilati: detrazioniRedditi.assimilati
    },
    ulterioreDetrazione,
    sommaEsente: cuneo.sommaEsente,
    detrazioniSpese,
    detrazioniOneri,
    irpefNetta,
    addRegionaleDovuta,
    addComunaleDovuta,
    addComunaleSaldo: saldoAddComunale,
    accontoAddComunale,
    imposteTotaliDovute: round2(irpefNetta + addRegionaleDovuta + addComunaleDovuta),
    ritenuteVersate,
    addizionaliTrattenute,
    accreditiPrecedenti: round2(accontiVersati + creditiRiportati),
    accontoIRPEF,
    risultatoFinale,
    warnings,
    validation: {
      isValid: cuValidation.isValid && resultValidation.isValid,
      errors: [...cuValidation.errors, ...resultValidation.errors],
      warnings: [...cuValidation.warnings, ...resultValidation.warnings],
      suggestions: [...warnings, ...cuValidation.suggestions, ...resultValidation.suggestions]
    },
    breakdown: {
      reddito,
      scaglioni: getIRPEFBreakdown(reddito)
    },
    liquidazione: {
      differenzaIRPEF,
      sommaEsente: conguaglioSommaEsente,
      saldoIRPEF,
      saldoAddRegionale,
      saldoAddComunale,
      accontoAddComunale,
      accontoIRPEF: accontoIRPEF.totale,
      totaleSaldi,
      totaleAcconti,
      totaleDaVersare
    }
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    useGrouping: 'always',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatCurrencyDetailed(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    useGrouping: 'always',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}
