import { CODICI_PUNTO, TIPO_PUNTO, type CodicePunto, type PuntiCU } from '@/utils/cuDaPunti';
import { trovaComune } from '@/utils/addizionaliCalculations';

/** Frammento di testo del PDF; x e y in punti, y dall'alto della pagina, sulla linea di base. */
export interface TestoPdf {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
  pagina: number;
}

export interface LetturaCU {
  punti: PuntiCU;
  /** Codici catastali trovati prima dei dati fiscali, in ordine di lettura: domicilio al 1° gennaio dell'anno d'imposta e dell'anno dopo. */
  codiciComune: string[];
  /** Punti trovati più volte con valori diversi: vale il primo. */
  ripetuti: CodicePunto[];
}

const MAX_PAGINE = 30;
export const MAX_DIMENSIONE_PDF = 10 * 1024 * 1024;

export class ErroreLetturaPdf extends Error {}

export async function estraiTestoPdf(file: File): Promise<TestoPdf[]> {
  const [pdfjs, { default: workerSrc }] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: pdfjs.VerbosityLevel.ERRORS
  });
  try {
    const doc = await task.promise;
    const testi: TestoPdf[] = [];
    for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGINE); n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      for (const item of content.items) {
        if (!('str' in item) || item.str.trim() === '') continue;
        const [, b, , d, e, f] = item.transform as number[];
        const [x, y] = viewport.convertToViewportPoint(e, f);
        testi.push({ str: item.str, x, y, w: item.width, h: item.height || Math.hypot(b, d), pagina: n });
      }
    }
    return testi;
  } catch (error) {
    const nome = error instanceof Error ? error.name : '';
    if (nome === 'PasswordException') throw new ErroreLetturaPdf('Il PDF è protetto da password.');
    if (nome === 'InvalidPDFException') throw new ErroreLetturaPdf('Il file non è un PDF valido.');
    throw error;
  } finally {
    await task.destroy();
  }
}

/** Legge il PDF nel browser: il file non lascia il dispositivo. */
export async function leggiCU(file: File): Promise<LetturaCU> {
  if (file.size > MAX_DIMENSIONE_PDF) throw new ErroreLetturaPdf('Il file supera i 10 MB.');
  const testi = await estraiTestoPdf(file);
  if (testi.length === 0) {
    throw new ErroreLetturaPdf('Il PDF non contiene testo (forse è una scansione): inserisci i valori a mano.');
  }
  return leggiPuntiCU(testi);
}

// --- Lettura dei punti dalla disposizione del testo ---

const IMPORTO = /^€?(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})€?$/;
const INTERO = /^\d{1,3}$/;
const CODICE_COMUNE = /^[A-Z]\d{3}$/;
const STESSA_RIGA = 2;
const MAX_DISTANZA_VERTICALE = 30;

interface Token {
  testo: string;
  x: number;
  y: number;
  w: number;
  h: number;
  pagina: number;
  /** Posizione nel frammento: 0 se è il primo token. */
  indice: number;
  /** Numero di token del frammento. */
  totale: number;
  /** Primo token del frammento. */
  primo: string;
}

const PUNTI = new Set<number>(CODICI_PUNTO);

function tokenizza(testi: TestoPdf[]): Token[] {
  const tokens: Token[] = [];
  for (const t of testi) {
    const parti = [...t.str.matchAll(/\S+/g)];
    const lunghezza = t.str.length || 1;
    const primo = parti[0]?.[0] ?? '';
    parti.forEach((parte, indice) => {
      const inizio = parte.index ?? 0;
      tokens.push({
        testo: parte[0],
        x: t.x + (t.w * inizio) / lunghezza,
        y: t.y,
        w: (t.w * parte[0].length) / lunghezza,
        h: t.h,
        pagina: t.pagina,
        indice,
        totale: parti.length,
        primo
      });
    });
  }
  return tokens.sort((a, b) => a.pagina - b.pagina || a.y - b.y || a.x - b.x);
}

const prima = (a: { pagina: number; y: number }, b: { pagina: number; y: number }) =>
  a.pagina < b.pagina || (a.pagina === b.pagina && a.y < b.y - STESSA_RIGA);

/** Righe di intestazione (testo breve) che contengono una delle parole cercate. */
function intestazioni(tokens: Token[], parola: string): Array<{ pagina: number; y: number }> {
  const righe: Array<{ pagina: number; y: number; tokens: Token[] }> = [];
  for (const t of tokens) {
    const riga = righe.find((r) => r.pagina === t.pagina && Math.abs(r.y - t.y) <= STESSA_RIGA);
    if (riga) riga.tokens.push(t);
    else righe.push({ pagina: t.pagina, y: t.y, tokens: [t] });
  }
  return righe.filter((r) => {
    const testo = [...r.tokens].sort((a, b) => a.x - b.x).map((t) => t.testo).join('').toUpperCase();
    return testo.length <= 60 && testo.includes(parola);
  });
}

const valoreImporto = (testo: string) => {
  const m = IMPORTO.exec(testo);
  return m ? Number(`${m[1].replace(/\./g, '')}.${m[2]}`) : null;
};

const mediana = (valori: number[]) => {
  const ordinati = [...valori].sort((a, b) => a - b);
  return ordinati[Math.floor(ordinati.length / 2)];
};

/**
 * Nella CU ogni valore sta nel riquadro del suo punto: il numero del punto è in alto a sinistra
 * (oppure a sinistra sulla stessa riga, nei modelli a elenco). Per ogni valore cerca l'etichetta
 * più vicina sopra o a sinistra, nella stessa colonna.
 */
export function leggiPuntiCU(testi: TestoPdf[]): LetturaCU {
  const tutti = tokenizza(testi);

  const inizio = intestazioni(tutti, 'DATIFISCALI')[0];
  const fine = inizio && intestazioni(tutti, 'DATIPREVIDENZIALI').find((r) => prima(inizio, r));
  const tokens = tutti.filter((t) => (!inizio || !prima(t, inizio)) && (!fine || prima(t, fine)));

  const codiciComune = [
    ...new Set(
      tutti
        .filter((t) => (!inizio || prima(t, inizio)) && CODICE_COMUNE.test(t.testo) && trovaComune(t.testo))
        .map((t) => t.testo)
    )
  ].slice(0, 2);

  const importi = tokens.filter((t) => valoreImporto(t.testo) !== null);
  const altezzaImporti = importi.length > 0 ? mediana(importi.map((t) => t.h)) : 0;
  const piccolo = (t: Token) => altezzaImporti > 0 && t.h < altezzaImporti * 0.8;

  const etichettaCandidata = (t: Token) => t.indice === 0 && INTERO.test(t.testo) && Number(t.testo) > 0;
  // Se le etichette sono scritte più piccole degli importi, un intero a grandezza piena è un valore (giorni, tipologia).
  const etichetteSeparate = tokens.some((t) => etichettaCandidata(t) && piccolo(t));
  const interoIsolato = (t: Token) => t.totale === 1 && INTERO.test(t.testo);

  // Modello a elenco: "6 Numero di giorni ... 365", il numero isolato in fondo alla riga di un'etichetta descritta.
  const inRigaDescritta = (t: Token) => tokens.some((e) =>
    e.pagina === t.pagina && Math.abs(e.y - t.y) <= STESSA_RIGA && e.x < t.x && etichettaCandidata(e) && e.totale > 1
  );
  const valoreIsolato = (t: Token) => interoIsolato(t) && (etichetteSeparate ? !piccolo(t) : inRigaDescritta(t));
  const etichette = tokens.filter((t) => etichettaCandidata(t) && !valoreIsolato(t));
  const valoriInteri = tokens.filter((t) =>
    INTERO.test(t.testo) && (t.indice === 1 ? t.totale === 2 && INTERO.test(t.primo) : valoreIsolato(t))
  );
  const valori = [...importi.filter((t) => !piccolo(t)), ...valoriInteri];

  const punti: PuntiCU = {};
  const ripetuti = new Set<CodicePunto>();

  for (const valore of valori) {
    const etichetta = etichettaDi(valore, etichette);
    if (!etichetta) continue;
    const numero = Number(etichetta.testo);
    if (!PUNTI.has(numero)) continue;
    const punto = numero as CodicePunto;

    const importo = valoreImporto(valore.testo);
    const intero = INTERO.test(valore.testo) ? Number(valore.testo) : null;
    const tipo = TIPO_PUNTO[punto];
    const letto =
      tipo === 'importo' ? importo
      : tipo === 'giorni' ? (intero !== null && intero >= 1 && intero <= 366 ? intero : null)
      : intero === 1 || intero === 2 ? intero : null;
    if (letto === null) continue;

    if (punti[punto] === undefined) punti[punto] = letto;
    else if (punti[punto] !== letto) ripetuti.add(punto);
  }

  return { punti, codiciComune, ripetuti: [...ripetuti].sort((a, b) => a - b) };
}

function etichettaDi(valore: Token, etichette: Token[]): Token | null {
  let migliore: Token | null = null;
  let distanzaMigliore = Infinity;
  for (const e of etichette) {
    if (e === valore || e.pagina !== valore.pagina) continue;
    const dy = valore.y - e.y;
    if (dy < -STESSA_RIGA || dy > MAX_DISTANZA_VERTICALE) continue;
    const stessaRiga = Math.abs(dy) <= STESSA_RIGA;
    const aSinistra = stessaRiga ? e.x + e.w <= valore.x + 1 : e.x < valore.x + valore.w - 1;
    if (!aSinistra) continue;

    const distanza = Math.max(dy, 0);
    if (distanza < distanzaMigliore - STESSA_RIGA || (Math.abs(distanza - distanzaMigliore) <= STESSA_RIGA && migliore && e.x > migliore.x)) {
      migliore = e;
      distanzaMigliore = Math.min(distanza, distanzaMigliore);
    }
  }
  return migliore;
}
