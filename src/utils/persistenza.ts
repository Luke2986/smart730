import type { Json } from '@/integrations/supabase/types';
import type { CUData, DetrazioneAffittoData, DetrazioneMutuoData, Smart730State, Spesa } from '@/types/tax';

/**
 * Conversione tra lo stato della dichiarazione e la riga di `tax_declarations`:
 * quadro_c_data contiene le CU e i giorni del rigo C5, quadro_e_data spese, affitto e mutuo.
 */

const VERSIONE = 1;
const GIORNI_ANNO = 365;
const TIPI_SPESA: Spesa['tipo'][] = ['mutuo_e7', 'affitto_e71', 'sanitarie', 'altre'];

export type DatiDichiarazione = Omit<Smart730State, 'selectedCuId'>;

export interface RigaDichiarazione {
  quadro_c_data: Json;
  quadro_e_data: Json;
}

export const DATI_VUOTI: DatiDichiarazione = {
  cus: [],
  giorniLavoro: null,
  spese: {},
  affitto: null,
  mutuo: null
};

export function datiDaStato({ cus, giorniLavoro, spese, affitto, mutuo }: Smart730State): DatiDichiarazione {
  return { cus, giorniLavoro, spese, affitto, mutuo };
}

export function isVuoto(dati: DatiDichiarazione): boolean {
  return dati.cus.length === 0
    && Object.keys(dati.spese).length === 0
    && dati.affitto === null
    && dati.mutuo === null
    && dati.giorniLavoro === null;
}

const toJson = (value: unknown): Json => JSON.parse(JSON.stringify(value)) as Json;

export function versoRiga(dati: DatiDichiarazione): RigaDichiarazione {
  return {
    quadro_c_data: toJson({ versione: VERSIONE, cus: dati.cus, giorniLavoro: dati.giorniLavoro }),
    quadro_e_data: toJson({ versione: VERSIONE, spese: dati.spese, affitto: dati.affitto, mutuo: dati.mutuo })
  };
}

/** Impronta usata per capire se ci sono modifiche da salvare. */
export function impronta(dati: DatiDichiarazione): string {
  return JSON.stringify(versoRiga(dati));
}

type Oggetto = Record<string, unknown>;

const isRecord = (value: unknown): value is Oggetto =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const toDate = (value: unknown): Date => {
  const date = new Date(typeof value === 'string' || typeof value === 'number' ? value : NaN);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

function leggiCU(value: unknown): CUData | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.nome !== 'string') return null;
  const { backend, ui } = value;
  if (!isRecord(backend) || !isRecord(ui)) return null;
  if (!isRecord(backend.redditi) || !isNumber(backend.redditi.totaleImponibile)) return null;
  if (!isRecord(backend.ritenute) || !isRecord(backend.detrazioni) || !isRecord(backend.datiAnagrafici)) return null;
  return { ...(value as unknown as CUData), dataCaricamento: toDate(value.dataCaricamento) };
}

function leggiSpesa(value: unknown): Spesa | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !isNumber(value.importo)) return null;
  if (!TIPI_SPESA.includes(value.tipo as Spesa['tipo'])) return null;
  return { ...(value as unknown as Spesa), dataInserimento: toDate(value.dataInserimento) };
}

function leggiAffitto(value: unknown): DetrazioneAffittoData | null {
  if (!isRecord(value) || !isNumber(value.canoneAnnuo) || !isNumber(value.giorniAffitto)) return null;
  return value as unknown as DetrazioneAffittoData;
}

function leggiMutuo(value: unknown): DetrazioneMutuoData | null {
  if (!isRecord(value) || !isNumber(value.interessiPagati) || !isNumber(value.percentualeIntestazione)) return null;
  return value as unknown as DetrazioneMutuoData;
}

/** Dati salvati, o null se la riga non contiene una dichiarazione leggibile. Le voci non valide vengono scartate. */
export function daRiga(riga: { quadro_c_data: unknown; quadro_e_data: unknown }): DatiDichiarazione | null {
  const quadroC = isRecord(riga.quadro_c_data) ? riga.quadro_c_data : null;
  const quadroE = isRecord(riga.quadro_e_data) ? riga.quadro_e_data : null;
  if (!quadroC && !quadroE) return null;

  const cus = Array.isArray(quadroC?.cus)
    ? quadroC.cus.map(leggiCU).filter((cu): cu is CUData => cu !== null)
    : [];
  const giorni = quadroC?.giorniLavoro;
  const giorniLavoro = isNumber(giorni) && giorni >= 1 && giorni <= GIORNI_ANNO ? Math.round(giorni) : null;

  const spese: Record<string, Spesa> = {};
  if (isRecord(quadroE?.spese)) {
    for (const value of Object.values(quadroE.spese)) {
      const spesa = leggiSpesa(value);
      if (spesa) spese[spesa.id] = spesa;
    }
  }

  return {
    cus,
    giorniLavoro,
    spese,
    affitto: leggiAffitto(quadroE?.affitto),
    mutuo: leggiMutuo(quadroE?.mutuo)
  };
}
