import comunaliJson from '@/data/addizionali/comunali.json';
import { PROVINCE_REGIONE, REGIONI, type RegolaRegionale, type Scaglioni } from '@/data/addizionali/regionali';
import type { CUBackendData, DomicilioFiscale } from '@/types/tax';
import { ANNO_DICHIARAZIONE } from './annoFiscale';

/**
 * Addizionali regionale e comunale all'IRPEF.
 * - Dovute solo se l'IRPEF al netto delle detrazioni supera 10 € (art. 50 D.Lgs. 446/1997, art. 1 D.Lgs. 360/1998;
 *   circolare di liquidazione 730, par. 19.24.1).
 * - Regione e comune: domicilio fiscale al 1° gennaio dell'anno d'imposta.
 * - Acconto comunale: 30% dell'addizionale calcolata con l'aliquota deliberata per l'anno d'imposta dal comune del
 *   domicilio al 1° gennaio dell'anno successivo (art. 8, c. 2, D.Lgs. 175/2014; circolare 730, par. 19.24.9).
 * - Soglia di esenzione comunale: sotto la soglia non si paga, sopra si paga su tutto il reddito.
 */

/** Regola comunale compatta generata da scripts/build-addizionali-comunali.mjs. */
export interface RegolaComunale {
  /** Aliquota unica (%) */
  a?: number;
  /** Scaglioni progressivi */
  s?: Scaglioni;
  /** Soglia di esenzione */
  e?: number;
  /** Esenzioni particolari non calcolabili (tipo di reddito, ISEE, nucleo familiare) */
  x?: string[];
  /** Regola da verificare sulla delibera: non viene applicata */
  v?: string;
}

interface ComunaliData {
  anno: number;
  regole: RegolaComunale[];
  comuni: Record<string, [nome: string, provincia: string, regola: number]>;
}

const COMUNALI = comunaliJson as unknown as ComunaliData;

export const PERCENTUALE_ACCONTO_ADD_COMUNALE = 0.3;
const SOGLIA_IRPEF_ADDIZIONALI = 10;

export interface ComuneInfo {
  codice: string;
  nome: string;
  provincia: string;
  regione: string;
  /** Regola deliberata per l'anno d'imposta: vale per il saldo e per l'acconto dell'anno successivo. */
  regola: RegolaComunale | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'")
    .replace(/[-\s]+/g, ' ')
    .trim()
    .toLowerCase();
}

function toComuneInfo(codice: string): ComuneInfo | null {
  const entry = COMUNALI.comuni[codice];
  if (!entry) return null;
  const [nome, provincia, regola] = entry;
  return {
    codice,
    nome,
    provincia,
    regione: REGIONI[PROVINCE_REGIONE[provincia]]?.nome ?? '',
    regola: COMUNALI.regole[regola] ?? null
  };
}

export function trovaComune(codice: string): ComuneInfo | null {
  return toComuneInfo(codice.trim().toUpperCase());
}

/** Comune per nome (e provincia, se indicata). Restituisce null se il nome è ambiguo. */
export function trovaComunePerNome(nome: string, provincia = ''): ComuneInfo | null {
  const target = normalize(nome);
  const sigla = provincia.trim().toUpperCase();
  const matches = Object.entries(COMUNALI.comuni).filter(
    ([, [n, p]]) => normalize(n) === target && (!sigla || p === sigla)
  );
  return matches.length === 1 ? toComuneInfo(matches[0][0]) : null;
}

/** Ricerca per nome: prima i comuni che iniziano con il testo, poi quelli che lo contengono. */
export function cercaComuni(testo: string, limite = 8): ComuneInfo[] {
  const query = normalize(testo);
  if (query.length < 2) return [];
  const starts: string[] = [];
  const contains: string[] = [];
  for (const [codice, [nome]] of Object.entries(COMUNALI.comuni)) {
    const n = normalize(nome);
    if (n.startsWith(query)) starts.push(codice);
    else if (n.includes(query)) contains.push(codice);
  }
  const byName = (a: string, b: string) => COMUNALI.comuni[a][0].localeCompare(COMUNALI.comuni[b][0], 'it');
  return [...starts.sort(byName), ...contains.sort(byName)]
    .slice(0, limite)
    .map((codice) => toComuneInfo(codice) as ComuneInfo);
}

export function trovaRegione(nomeOProvincia: string): RegolaRegionale | null {
  const key = normalize(nomeOProvincia).replace(/^(regione|provincia autonoma( di)?)\s+/, '');
  return REGIONI[key] ?? REGIONI[PROVINCE_REGIONE[nomeOProvincia.trim().toUpperCase()]] ?? null;
}

export function applicaScaglioni(reddito: number, scaglioni: Scaglioni): number {
  let imposta = 0;
  let inizio = 0;
  for (const [fine, aliquota] of scaglioni) {
    const limite = fine ?? Infinity;
    if (reddito > inizio) imposta += ((Math.min(reddito, limite) - inizio) * aliquota) / 100;
    inizio = limite;
  }
  return imposta;
}

export function calcolaAddizionaleRegionale(reddito: number, regola: RegolaRegionale): number {
  if (reddito <= 0 || (regola.esenzione !== undefined && reddito <= regola.esenzione)) return 0;
  const lorda = regola.aliquotaRidotta && reddito <= regola.aliquotaRidotta.finoA
    ? (reddito * regola.aliquotaRidotta.aliquota) / 100
    : applicaScaglioni(reddito, regola.scaglioni);
  const detrazione = regola.detrazione?.(reddito) ?? 0;
  return round2(Math.max(0, lorda - detrazione));
}

export function calcolaAddizionaleComunale(reddito: number, regola: RegolaComunale): number {
  if (reddito <= 0 || (regola.e !== undefined && reddito <= regola.e)) return 0;
  const imposta = regola.s ? applicaScaglioni(reddito, regola.s) : (reddito * (regola.a ?? 0)) / 100;
  return round2(imposta);
}

export function descriviRegolaComunale(regola: RegolaComunale): string {
  const aliquote = regola.s
    ? `aliquote ${regola.s.map(([, a]) => `${a.toLocaleString('it-IT')}%`).join(' / ')} per scaglioni`
    : `aliquota ${(regola.a ?? 0).toLocaleString('it-IT')}%`;
  const esenzione = regola.e ? `, esenzione fino a ${regola.e.toLocaleString('it-IT', { useGrouping: 'always' })} €` : '';
  return `${aliquote}${esenzione}`;
}

export interface AddizionaliDovute {
  /** null = non calcolabile: il motore usa quanto trattenuto in CU */
  regionale: number | null;
  comunale: number | null;
  /** Acconto lordo (30%) per l'anno successivo, prima di togliere quanto già trattenuto in CU */
  accontoComunale: number | null;
  comune: ComuneInfo | null;
  comuneAcconto: ComuneInfo | null;
  regione: RegolaRegionale | null;
  warnings: string[];
}

const isCompilato = (domicilio?: DomicilioFiscale | null) =>
  Boolean(domicilio?.codiceComune?.trim() || domicilio?.comune?.trim());

function risolviComune(domicilio?: DomicilioFiscale | null): ComuneInfo | null {
  if (!domicilio) return null;
  if (domicilio.codiceComune?.trim()) return trovaComune(domicilio.codiceComune);
  if (domicilio.comune?.trim()) return trovaComunePerNome(domicilio.comune, domicilio.provincia);
  return null;
}

export function calcolaAddizionaliDovute(
  reddito: number,
  irpefNetta: number,
  datiAnagrafici?: CUBackendData['datiAnagrafici']
): AddizionaliDovute {
  const warnings: string[] = [];
  const domicilio = datiAnagrafici?.domicilioFiscale;
  const comune = risolviComune(domicilio);
  const domicilioAcconto = datiAnagrafici?.domicilioFiscaleAcconto;
  const comuneAcconto = isCompilato(domicilioAcconto) ? risolviComune(domicilioAcconto) : comune;
  const regione = comune
    ? trovaRegione(comune.provincia)
    : domicilio?.regione?.trim() ? trovaRegione(domicilio.regione) : null;

  if (irpefNetta <= SOGLIA_IRPEF_ADDIZIONALI) {
    warnings.push(`IRPEF netta non superiore a ${SOGLIA_IRPEF_ADDIZIONALI} €: le addizionali regionale e comunale non sono dovute.`);
    return { regionale: 0, comunale: 0, accontoComunale: 0, comune, comuneAcconto, regione, warnings };
  }

  if (!comune) {
    warnings.push(
      isCompilato(domicilio)
        ? `Comune del domicilio fiscale non riconosciuto (${domicilio.comune || domicilio.codiceComune}): addizionale comunale considerata pari a quella trattenuta in CU.`
        : 'Domicilio fiscale non indicato: le addizionali sono considerate pari a quelle già trattenute in CU.'
    );
  }
  if (isCompilato(domicilioAcconto) && !comuneAcconto) {
    warnings.push(`Comune del domicilio al 1/1/${ANNO_DICHIARAZIONE} non riconosciuto (${domicilioAcconto.comune || domicilioAcconto.codiceComune}): acconto comunale calcolato sulle trattenute in CU.`);
  }
  if (!regione && comune) {
    warnings.push('Regione del domicilio fiscale non riconosciuta: addizionale regionale considerata pari a quella trattenuta in CU.');
  }
  if (regione?.agevolazioniNonCalcolate) {
    warnings.push(`${regione.nome}: non è considerata la ${regione.agevolazioniNonCalcolate}.`);
  }

  const daVerificare = new Set<string>();
  const regolaComunale = (info: ComuneInfo | null): RegolaComunale | null => {
    if (!info?.regola) return null;
    if (info.regola.v) {
      if (!daVerificare.has(info.codice)) {
        daVerificare.add(info.codice);
        warnings.push(`${info.nome}: aliquote comunali da verificare sulla delibera (${info.regola.v}).`);
      }
      return null;
    }
    return info.regola;
  };

  const saldo = regolaComunale(comune);
  const acconto = regolaComunale(comuneAcconto);
  const esenzioniParticolari = [...new Set([...(saldo?.x ?? []), ...(acconto?.x ?? [])])];
  if (esenzioniParticolari.length > 0) {
    warnings.push(
      `Il comune prevede esenzioni particolari non calcolate (${esenzioniParticolari.join('; ')}). ` +
      'Se ne hai diritto vanno indicate nel rigo F7.'
    );
  }

  return {
    regionale: regione ? calcolaAddizionaleRegionale(reddito, regione) : null,
    comunale: saldo ? calcolaAddizionaleComunale(reddito, saldo) : null,
    accontoComunale: acconto ? round2(calcolaAddizionaleComunale(reddito, acconto) * PERCENTUALE_ACCONTO_ADD_COMUNALE) : null,
    comune,
    comuneAcconto,
    regione,
    warnings
  };
}
