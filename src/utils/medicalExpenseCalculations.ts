import { SpesaSanitaria } from '@/types/tax';

export interface CalcoloSpeseSanitarie {
  speseMediche: number;
  detrazioneMediche: number;
  speseVeterinarie: number;
  detrazioneVeterinarie: number;
  totaleDetrazione: number;
  franchigiaApplicata: number;
}

const FRANCHIGIA = 129.11;
const TETTO_SPESE_VETERINARIE = 550;
const ALIQUOTA = 0.19;

/**
 * Detrazione 19% (istruzioni 730/2026, righi E1 e codice 29):
 * - spese mediche: sulla parte che supera 129,11 €
 * - spese veterinarie: spesa massima 550 €, detrazione sulla parte che supera 129,11 €
 */
export function calcolaDetrazioneSanitarie(spese: SpesaSanitaria[]): CalcoloSpeseSanitarie {
  const mediche = spese.filter(s => s.sottotipo === 'mediche');
  const veterinarie = spese.filter(s => s.sottotipo === 'veterinarie');

  const totaleMediche = mediche.reduce((sum, s) => sum + s.importo, 0);
  const totaleVeterinarie = veterinarie.reduce((sum, s) => sum + s.importo, 0);

  const franchigiaApplicata = FRANCHIGIA;
  const detrazioneMediche = Math.max(0, totaleMediche - FRANCHIGIA) * ALIQUOTA;
  const detrazioneVeterinarie = Math.max(0, Math.min(totaleVeterinarie, TETTO_SPESE_VETERINARIE) - FRANCHIGIA) * ALIQUOTA;

  return {
    speseMediche: Math.round(totaleMediche * 100) / 100,
    detrazioneMediche: Math.round(detrazioneMediche * 100) / 100,
    speseVeterinarie: Math.round(totaleVeterinarie * 100) / 100,
    detrazioneVeterinarie: Math.round(detrazioneVeterinarie * 100) / 100,
    totaleDetrazione: Math.round((detrazioneMediche + detrazioneVeterinarie) * 100) / 100,
    franchigiaApplicata
  };
}

/**
 * Validate medical expenses
 */
export function validateSpeseSanitarie(spese: SpesaSanitaria[]): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  spese.forEach(spesa => {
    // Check for unreasonably high amounts
    if (spesa.importo > 10000) {
      warnings.push(`${spesa.descrizione}: importo molto alto (€${spesa.importo}), verifica correttezza`);
    }

    // Check for negative amounts
    if (spesa.importo <= 0) {
      errors.push(`${spesa.descrizione}: l'importo deve essere maggiore di zero`);
    }

    // Check description
    if (!spesa.descrizione || spesa.descrizione.length < 3) {
      errors.push(`Spesa ${spesa.id}: descrizione troppo breve o mancante`);
    }
  });

  // Warn if veterinary expenses exceed cap
  const totaleVeterinarie = spese
    .filter(s => s.sottotipo === 'veterinarie')
    .reduce((sum, s) => sum + s.importo, 0);

  if (totaleVeterinarie > 550) {
    warnings.push(`Le spese veterinarie superano il limite di €550 (totale: €${totaleVeterinarie}). La detrazione sarà calcolata su €550.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
