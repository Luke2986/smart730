import { describe, expect, it } from 'vitest';
import { parseCSVUniversal, parseImporto, rilevaFormatoNumeri } from '../csvParser';
import { autoMapCSVColumns, mapCSVRowToExpense } from '../csvMapping';
import { cleanImportedExpenses, senzaDuplicati } from '../csvValidation';

const csv = (content: string) => parseCSVUniversal(new File([content], 'spese.csv', { type: 'text/csv' }));

async function importa(content: string) {
  const result = await csv(content);
  const mapping = autoMapCSVColumns(result.metadata.headers);
  return result.data.map((row) => mapCSVRowToExpense(row, mapping, result.metadata.numberFormats));
}

describe('Formato dei numeri nel CSV', () => {
  it.each([
    [['12,50', '3'], 'IT'],
    [['1.234,56'], 'IT'],
    [['1.234'], 'IT'],
    [['12.50', '1,234.00'], 'EN'],
    [['1,234'], 'EN'],
    [['10', '25'], null]
  ])('%j → %s', (values, formato) => {
    expect(rilevaFormatoNumeri(values)).toBe(formato);
  });

  it('converte gli importi nel formato della colonna', () => {
    expect(parseImporto('1.234,56', 'IT')).toBe(1234.56);
    expect(parseImporto('1,234.56', 'EN')).toBe(1234.56);
    expect(parseImporto('€ 45,00', 'IT')).toBe(45);
    expect(parseImporto('1', null)).toBe(1);
    expect(parseImporto('12,5', 'EN')).toBeNull();
    expect(parseImporto('abc', 'IT')).toBeNull();
  });
});

describe('Import CSV delle spese', () => {
  it('rileva il formato per colonna, senza confondere codici e importi', async () => {
    const spese = await importa(
      'Data;Descrizione;Codice;Importo\n' +
      '10/03/2025;Farmacia;01234567890;1\n' +
      '11/03/2025;Visita;00012;1.200,50\n'
    );
    expect(spese.map((s) => s.importo)).toEqual([1, 1200.5]);
  });

  it('legge importi con il punto decimale', async () => {
    const spese = await importa('date,description,amount\n2025-05-02,Dentista,80.00\n2025-05-03,Farmacia,12.5\n');
    expect(spese.map((s) => s.importo)).toEqual([80, 12.5]);
    expect(spese[0].dataInserimento).toEqual(new Date(2025, 4, 2));
  });

  it('non reimporta le spese già presenti', async () => {
    const prima = cleanImportedExpenses(await importa('Data;Descrizione;Importo\n10/03/2025;Farmacia;12,00\n'));
    const seconda = cleanImportedExpenses(await importa(
      'Data;Descrizione;Importo\n10/03/2025;Farmacia;12,00\n12/03/2025;Visita;90,00\n'
    ));
    expect(senzaDuplicati(seconda, prima).map((s) => s.descrizione)).toEqual(['Visita']);
  });
});
