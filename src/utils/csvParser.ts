import Papa from 'papaparse';

export type FormatoNumeri = 'IT' | 'EN';
export interface RigaCSV {
  valori: Record<string, string | null>;
  /** Sistema TS: data e fornitore del documento a cui appartiene la riga di dettaglio. */
  documento?: { data: string | null; fornitore: string | null };
}

export interface CSVParseResult {
  /** Valori come testo: la conversione avviene solo sui campi mappati (importo, data). */
  data: RigaCSV[];
  metadata: {
    rows: number;
    columns: number;
    headers: string[];
    delimiter: string;
    /** Formato dei numeri per colonna; null se la colonna non contiene decimali o migliaia riconoscibili. */
    numberFormats: Record<string, FormatoNumeri | null>;
    isHierarchical?: boolean;
    originalRows?: number;
    documentsCount?: number;
  };
}

const togliApici = (value: string) =>
  (value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))
    ? value.slice(1, -1)
    : value;

function leggi(content: string, delimiter?: string) {
  return Papa.parse<Record<string, string | null>>(content, {
    header: true,
    delimiter,
    skipEmptyLines: true,
    dynamicTyping: false,
    delimitersToGuess: [',', '\t', '|', ';', ':'],
    transformHeader: (header) => togliApici(header.trim()),
    transform: (value) => {
      const pulito = togliApici(value.trim());
      return pulito === '' ? null : pulito;
    }
  });
}

const pulisciNumero = (value: string) => value.replace(/[\s€]/g, '');

/**
 * Formato di una colonna: IT se ha decimali con la virgola o migliaia con il punto, EN nel caso opposto.
 * Gli importi in euro hanno al massimo due decimali, quindi "1.234" e "1,234" si leggono come migliaia,
 * a meno che un altro valore della colonna mostri i decimali.
 */
export function rilevaFormatoNumeri(values: Array<string | null | undefined>): FormatoNumeri | null {
  const numeri = values.filter((v): v is string => typeof v === 'string').map(pulisciNumero);
  if (numeri.some((v) => /^-?[\d.]*,\d{1,2}$/.test(v))) return 'IT';
  if (numeri.some((v) => /^-?[\d,]*\.\d{1,2}$/.test(v))) return 'EN';
  if (numeri.some((v) => /^-?\d{1,3}(\.\d{3})+$/.test(v))) return 'IT';
  if (numeri.some((v) => /^-?\d{1,3}(,\d{3})+$/.test(v))) return 'EN';
  return null;
}

/** Importo da testo, o null se il valore non è un numero nel formato indicato. */
export function parseImporto(value: string | null | undefined, formato: FormatoNumeri | null): number | null {
  if (typeof value !== 'string') return null;
  const testo = pulisciNumero(value);
  const valido = formato === 'IT'
    ? /^-?(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/.test(testo)
    : formato === 'EN'
      ? /^-?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/.test(testo)
      : /^-?\d+$/.test(testo);
  if (!valido) return null;

  const normalizzato = formato === 'IT' ? testo.replace(/\./g, '').replace(',', '.') : testo.replace(/,/g, '');
  const numero = Number(normalizzato);
  return Number.isFinite(numero) ? numero : null;
}

function formatiPerColonna(headers: string[], rows: RigaCSV[]): Record<string, FormatoNumeri | null> {
  return Object.fromEntries(headers.map((header) => [header, rilevaFormatoNumeri(rows.map((row) => row.valori[header]))]));
}

export async function parseCSVUniversal(file: File): Promise<CSVParseResult> {
  const content = await file.text();
  const parsed = leggi(content);
  const delimiter = parsed.meta.delimiter || ',';
  const headers = parsed.meta.fields || [];

  if (detectHierarchicalFormat(content, delimiter)) {
    return parseHierarchical(parsed.data, headers, delimiter);
  }

  const data = parsed.data.map((valori) => ({ valori }));
  return {
    data,
    metadata: {
      rows: data.length,
      columns: headers.length,
      headers,
      delimiter,
      numberFormats: formatiPerColonna(headers, data)
    }
  };
}

// Formato gerarchico del Sistema TS: una riga per documento, seguita dalle righe di dettaglio delle voci di spesa.

function detectHierarchicalFormat(content: string, delimiter: string): boolean {
  const lines = content.split('\n').slice(1, 10);
  let righeDettaglio = 0;
  let righePrincipali = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    const leadingEmpty = line.split(delimiter).slice(0, 5).filter((f) => !f || f.trim() === '' || f === "''").length;
    if (leadingEmpty >= 4) righeDettaglio++;
    else if (leadingEmpty <= 1) righePrincipali++;
  }

  return righeDettaglio > 0 && righePrincipali > 0;
}

function parseHierarchical(rows: Array<Record<string, string | null>>, headers: string[], delimiter: string): CSVParseResult {
  const aggregatedRows: RigaCSV[] = [];
  let currentMainRow: Record<string, string | null> | null = null;
  let documentsCount = 0;

  for (const row of rows) {
    if (hasMainRowData(row, headers)) {
      currentMainRow = row;
      documentsCount++;
    } else if (currentMainRow && Object.values(row).some((v) => v !== null)) {
      const valori = { ...currentMainRow };
      for (const [key, value] of Object.entries(row)) {
        if (value !== null) valori[key] = value;
      }
      aggregatedRows.push({
        valori,
        documento: { data: currentMainRow[headers[0]], fornitore: currentMainRow[headers[4]] || currentMainRow[headers[3]] }
      });
    }
  }

  return {
    data: aggregatedRows,
    metadata: {
      rows: aggregatedRows.length,
      columns: headers.length,
      headers,
      delimiter,
      numberFormats: formatiPerColonna(headers, aggregatedRows),
      isHierarchical: true,
      originalRows: rows.length,
      documentsCount
    }
  };
}

function hasMainRowData(row: Record<string, string | null>, headers: string[]): boolean {
  return headers.slice(0, 5).filter((h) => row[h] !== null && row[h] !== undefined).length >= 3;
}
