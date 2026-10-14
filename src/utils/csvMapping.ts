import { SpesaSanitaria } from '@/types/tax';
import { parseImporto, type FormatoNumeri, type RigaCSV } from './csvParser';

export interface ColumnMapping {
  csvColumn: string;
  targetField: keyof SpesaSanitaria | null;
  confidence: 'high' | 'medium' | 'low';
}

// Auto-mapping intelligente CSV → SpesaSanitaria
export function autoMapCSVColumns(headers: string[]): ColumnMapping[] {
  return headers.map(header => {
    const normalized = header.toLowerCase().trim();

    // Data (Sistema TS: "Data emissione")
    if (/^(data|date|datum)/i.test(normalized) || /emissione/i.test(normalized)) {
      return { csvColumn: header, targetField: 'dataInserimento', confidence: 'high' };
    }

    // Descrizione (Sistema TS: "Denominazione" o "Emesso da")
    if (/descrizione|description|desc|causale|oggetto|denominazione|emesso\s+da/i.test(normalized)) {
      return { csvColumn: header, targetField: 'descrizione', confidence: 'high' };
    }

    // Importo (Sistema TS: "Importo (in euro)" prioritario su "Importo totale")
    // Match esatto per header specifici Sistema TS
    if (header === 'Importo (in euro)' || header === 'importo (in euro)') {
      return { csvColumn: header, targetField: 'importo', confidence: 'high' };
    }
    if (/importo\s*\(/i.test(normalized) && !/totale/i.test(normalized)) {
      return { csvColumn: header, targetField: 'importo', confidence: 'high' };
    }
    if (/^importo$/i.test(normalized)) {
      return { csvColumn: header, targetField: 'importo', confidence: 'high' };
    }
    if (/importo|amount|spesa|costo|prezzo|euro/i.test(normalized) && !/totale/i.test(normalized)) {
      return { csvColumn: header, targetField: 'importo', confidence: 'medium' };
    }

    // Tipo/Sottotipo (Sistema TS: "Tipo spesa")
    if (/tipo\s+spesa|tipo|type|categoria|category/i.test(normalized)) {
      return { csvColumn: header, targetField: 'sottotipo', confidence: 'high' };
    }

    // Non mappato
    return { csvColumn: header, targetField: null, confidence: 'low' };
  });
}

/** Converte una riga del CSV in spesa. L'importo usa il formato dei numeri della sua colonna. */
export function mapCSVRowToExpense(
  row: RigaCSV,
  mapping: ColumnMapping[],
  formati: Record<string, FormatoNumeri | null>,
  defaultSottotipo: 'mediche' | 'veterinarie' = 'mediche'
): Partial<SpesaSanitaria> {
  const expense: Partial<SpesaSanitaria> = {
    tipo: 'sanitarie',
    sottotipo: defaultSottotipo,
    validata: false
  };
  const { valori, documento } = row;

  if (documento) {
    expense.dataInserimento = parseDate(documento.data);
    const provider = documento.fornitore || '';
    const tipoSpesa = findTipoSpesaValue(valori, mapping);

    if (tipoSpesa) {
      // Sistema TS: "FC - Farmaco" → "Farmaco"
      const cleanType = tipoSpesa.replace(/^[A-Z]{2}\s*-\s*/, '');
      expense.descrizione = provider ? `${provider} - ${cleanType}` : cleanType;
    } else {
      expense.descrizione = provider || 'Spesa sanitaria';
    }
  }

  // A parità di campo vince la colonna riconosciuta con più sicurezza.
  const ordine = { high: 0, medium: 1, low: 2 };
  for (const map of [...mapping].sort((a, b) => ordine[a.confidence] - ordine[b.confidence])) {
    const value = valori[map.csvColumn];
    if (!map.targetField || !value) continue;

    switch (map.targetField) {
      case 'dataInserimento':
        if (!expense.dataInserimento) expense.dataInserimento = parseDate(value);
        break;
      case 'descrizione':
        if (!expense.descrizione) expense.descrizione = value;
        break;
      case 'importo': {
        const importo = parseImporto(value, formati[map.csvColumn] ?? null);
        if (importo !== null && importo > 0 && expense.importo === undefined) expense.importo = importo;
        break;
      }
      case 'sottotipo': {
        const normalized = value.toLowerCase();
        if (normalized.includes('vet') || normalized.includes('animale')) {
          expense.sottotipo = 'veterinarie';
        } else if (normalized.includes('med') || normalized.includes('sanit') || normalized.includes('farmaco')) {
          expense.sottotipo = 'mediche';
        }
        break;
      }
    }
  }

  return expense;
}

function findTipoSpesaValue(valori: Record<string, string | null>, mapping: ColumnMapping[]): string | null {
  const tipoSpesaMap = mapping.find(m =>
    m.csvColumn.toLowerCase().includes('tipo') &&
    m.csvColumn.toLowerCase().includes('spesa')
  );
  return tipoSpesaMap ? valori[tipoSpesaMap.csvColumn] : null;
}

/** Date ISO (YYYY-MM-DD) o italiane (DD/MM/YYYY, DD-MM-YYYY); oggi se il valore non è leggibile. */
function parseDate(value: string | null): Date {
  if (!value) return new Date();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const it = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(value);
  if (it) return new Date(Number(it[3]), Number(it[2]) - 1, Number(it[1]));
  return new Date();
}
