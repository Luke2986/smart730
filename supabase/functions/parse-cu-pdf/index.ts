import "https://deno.land/x/xhr@0.1.0/mod.ts";
import * as pdfjsLib from 'npm:pdfjs-dist@4.0.379';
import { corsHeaders, json } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import { AIConfigError, chatCompletion } from '../_shared/ai.ts';

const BUCKET = 'cu-documents';
const MAX_PATH_LENGTH = 512;
// Certificazione Unica 2026, redditi 2025 (deve corrispondere a src/utils/annoFiscale.ts).
const ANNO_IMPOSTA = 2025;
const ANNO_SUCCESSIVO = ANNO_IMPOSTA + 1;
const MAX_SOMMA_ESENTE = 960;
const MAX_AI_WARNINGS = 10;
const MAX_WARNING_LENGTH = 300;

interface ExtractedCU {
  lavoroIndeterminato?: number;
  lavoroDeterminato?: number;
  pensione?: number;
  altriAssimilati?: number;
  assegniConiuge?: number;
  giorniLavoro?: number;
  giorniPensione?: number;
  irpef?: number;
  addRegionale?: number;
  addComunaleAcconto?: number;
  addComunaleSaldo?: number;
  addComunaleAccontoSuccessivo?: number;
  accontoIrpefPrimaRata?: number;
  accontoIrpefSecondaRata?: number;
  cuneoTipologia?: number;
  cuneoRedditoLavoro?: number;
  cuneoGiorni?: number;
  sommaEsenteErogata?: number;
  domicilioComune?: string;
  domicilioProvincia?: string;
  domicilioCodice?: string;
  domicilioAccontoComune?: string;
  domicilioAccontoProvincia?: string;
  domicilioAccontoCodice?: string;
  confidenceScore?: number;
  warnings?: string[];
}

class UpstreamError extends Error {}

async function extractTextFromPDF(pdfData: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

const SYSTEM_PROMPT = `Sei un esperto nell'analisi della Certificazione Unica ${ANNO_SUCCESSIVO} (redditi ${ANNO_IMPOSTA}), parte "Dati fiscali".

Estrai SOLO i seguenti punti numerati, con il valore esatto riportato nel documento:
- Punto 1: redditi di lavoro dipendente e assimilati a tempo indeterminato
- Punto 2: redditi di lavoro dipendente e assimilati a tempo determinato
- Punto 3: redditi di pensione
- Punto 4: altri redditi assimilati a lavoro dipendente
- Punto 5: assegni periodici corrisposti dal coniuge
- Punto 6: numero di giorni di lavoro dipendente
- Punto 7: numero di giorni di pensione
- Punto 21: ritenute IRPEF
- Punto 22: addizionale regionale all'IRPEF
- Punto 26: acconto ${ANNO_IMPOSTA} addizionale comunale all'IRPEF
- Punto 27: saldo ${ANNO_IMPOSTA} addizionale comunale all'IRPEF
- Punto 29: acconto ${ANNO_SUCCESSIVO} addizionale comunale all'IRPEF
- Punto 121: prima rata di acconto IRPEF trattenuta (730/${ANNO_IMPOSTA})
- Punto 122: seconda o unica rata di acconto IRPEF trattenuta (730/${ANNO_IMPOSTA})
- Punto 718: codice tipologia della riduzione della pressione fiscale (1 o 2)
- Punto 719: reddito di lavoro dipendente per la riduzione della pressione fiscale
- Punto 721: numero di giorni di lavoro dipendente per la riduzione della pressione fiscale
- Punto 725: somma che non concorre alla formazione del reddito erogata (NON il punto 726, riconosciuta ma non erogata)

Dai dati anagrafici del percipiente estrai anche il domicilio fiscale:
- riquadro "Domicilio fiscale all'1/1/${ANNO_IMPOSTA}": comune, sigla provincia, codice comune (codice catastale, es. H501)
- riquadro "Domicilio fiscale all'1/1/${ANNO_SUCCESSIVO}": comune, sigla provincia, codice comune
Se un riquadro è vuoto restituisci stringhe vuote.

Formato: gli importi sono in formato italiano (16.683,48). Restituiscili come numeri (16683.48).
Se la CU contiene più moduli per lo stesso punto, somma i valori.
Se un punto è assente o vuoto restituisci 0: non stimare e non inventare valori.
Se un valore ti sembra incoerente riportalo comunque com'è e aggiungi una nota in "warnings".`;

const POINT = (n: string, label: string) => ({ type: "number", description: `Punto ${n}: ${label}. 0 se assente.` });
const TEXT = (description: string) => ({ type: "string", description: `${description}. Stringa vuota se assente.` });

const DOMICILIO_FIELDS = [
  "domicilioComune", "domicilioProvincia", "domicilioCodice",
  "domicilioAccontoComune", "domicilioAccontoProvincia", "domicilioAccontoCodice"
];

const EXTRACT_TOOL = {
  type: "function",
  function: {
    name: "extract_cu_data",
    description: `Estrae i punti numerati della parte Dati fiscali della Certificazione Unica ${ANNO_SUCCESSIVO}`,
    parameters: {
      type: "object",
      properties: {
        lavoroIndeterminato: POINT("1", "redditi di lavoro dipendente a tempo indeterminato"),
        lavoroDeterminato: POINT("2", "redditi di lavoro dipendente a tempo determinato"),
        pensione: POINT("3", "redditi di pensione"),
        altriAssimilati: POINT("4", "altri redditi assimilati a lavoro dipendente"),
        assegniConiuge: POINT("5", "assegni periodici corrisposti dal coniuge"),
        giorniLavoro: POINT("6", "giorni di lavoro dipendente"),
        giorniPensione: POINT("7", "giorni di pensione"),
        irpef: POINT("21", "ritenute IRPEF"),
        addRegionale: POINT("22", "addizionale regionale trattenuta"),
        addComunaleAcconto: POINT("26", `acconto ${ANNO_IMPOSTA} addizionale comunale`),
        addComunaleSaldo: POINT("27", `saldo ${ANNO_IMPOSTA} addizionale comunale`),
        addComunaleAccontoSuccessivo: POINT("29", `acconto ${ANNO_SUCCESSIVO} addizionale comunale`),
        accontoIrpefPrimaRata: POINT("121", "prima rata acconto IRPEF trattenuta"),
        accontoIrpefSecondaRata: POINT("122", "seconda o unica rata acconto IRPEF trattenuta"),
        cuneoTipologia: POINT("718", "codice tipologia riduzione pressione fiscale, 1 o 2"),
        cuneoRedditoLavoro: POINT("719", "reddito di lavoro dipendente per la riduzione della pressione fiscale"),
        cuneoGiorni: POINT("721", "giorni di lavoro dipendente per la riduzione della pressione fiscale"),
        sommaEsenteErogata: POINT("725", "somma che non concorre al reddito erogata"),
        domicilioComune: TEXT(`Comune del domicilio fiscale all'1/1/${ANNO_IMPOSTA}`),
        domicilioProvincia: TEXT(`Sigla provincia del domicilio fiscale all'1/1/${ANNO_IMPOSTA}`),
        domicilioCodice: TEXT(`Codice comune (catastale) del domicilio fiscale all'1/1/${ANNO_IMPOSTA}`),
        domicilioAccontoComune: TEXT(`Comune del domicilio fiscale all'1/1/${ANNO_SUCCESSIVO}`),
        domicilioAccontoProvincia: TEXT(`Sigla provincia del domicilio fiscale all'1/1/${ANNO_SUCCESSIVO}`),
        domicilioAccontoCodice: TEXT(`Codice comune (catastale) del domicilio fiscale all'1/1/${ANNO_SUCCESSIVO}`),
        confidenceScore: { type: "number", description: "Confidenza nell'estrazione, da 0 a 100." },
        warnings: { type: "array", items: { type: "string" }, description: "Valori mancanti o incoerenti." }
      },
      required: [
        "lavoroIndeterminato", "lavoroDeterminato", "pensione", "altriAssimilati", "assegniConiuge",
        "giorniLavoro", "giorniPensione", "irpef", "addRegionale",
        "addComunaleAcconto", "addComunaleSaldo", "addComunaleAccontoSuccessivo",
        "accontoIrpefPrimaRata", "accontoIrpefSecondaRata",
        "cuneoTipologia", "cuneoRedditoLavoro", "cuneoGiorni", "sommaEsenteErogata",
        ...DOMICILIO_FIELDS, "confidenceScore"
      ],
      additionalProperties: false
    }
  }
};

async function extractWithAI(pdfText: string): Promise<ExtractedCU> {
  const response = await chatCompletion({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Analizza questa Certificazione Unica e estrai i dati fiscali seguendo ESATTAMENTE la struttura dei punti indicati:\n\n${pdfText}` }
    ],
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "function", function: { name: "extract_cu_data" } }
  });

  if (!response.ok) {
    console.error('AI provider error, status:', response.status);
    throw new UpstreamError(`AI provider responded ${response.status}`);
  }

  const result = await response.json();
  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    throw new UpstreamError('AI response contains no tool call');
  }

  return JSON.parse(toolCall.function.arguments) as ExtractedCU;
}

const GIORNI_ANNO = 365;

const round2 = (n: number) => Math.round(n * 100) / 100;
const amount = (value?: number) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? round2(value) : 0);

function days(value: number | undefined, label: string, warnings: string[]): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) return undefined;
  if (value < 1 || value > GIORNI_ANNO) {
    warnings.push(`${label} fuori intervallo (${value}): verifica il dato nella CU.`);
    return undefined;
  }
  return Math.round(value);
}

const clean = (value: unknown, pattern: RegExp, maxLength: number) => {
  const text = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return text.length <= maxLength && pattern.test(text) ? text : '';
};

function domicilio(comune?: string, provincia?: string, codice?: string) {
  return {
    comune: clean(comune, /^[A-Z][A-Z' .\-À-Ü]*$/, 80),
    provincia: clean(provincia, /^[A-Z]{2}$/, 2),
    regione: '',
    codiceComune: clean(codice, /^[A-Z]\d{3}$/, 4)
  };
}

function buildCUData(extracted: ExtractedCU) {
  const warnings = (Array.isArray(extracted.warnings) ? extracted.warnings : [])
    .filter((w): w is string => typeof w === 'string' && w.trim() !== '')
    .slice(0, MAX_AI_WARNINGS)
    .map((w) => w.trim().slice(0, MAX_WARNING_LENGTH));

  const lavoroDeterminato = amount(extracted.lavoroDeterminato);
  const lavoroDipendente = round2(amount(extracted.lavoroIndeterminato) + lavoroDeterminato);
  const pensione = amount(extracted.pensione);
  const assimilati = round2(amount(extracted.altriAssimilati) + amount(extracted.assegniConiuge));
  const totaleImponibile = round2(lavoroDipendente + pensione + assimilati);

  const irpef = amount(extracted.irpef);
  const addRegionale = amount(extracted.addRegionale);
  const addComunaleAcconto = amount(extracted.addComunaleAcconto);
  const addComunale = round2(addComunaleAcconto + amount(extracted.addComunaleSaldo));
  const totaleRitenute = round2(irpef + addRegionale + addComunale);

  const primaRata = amount(extracted.accontoIrpefPrimaRata);
  const secondaRata = amount(extracted.accontoIrpefSecondaRata);

  let giorniLavorati = 0;
  if (lavoroDipendente > 0) {
    giorniLavorati = days(extracted.giorniLavoro, 'Giorni di lavoro (punto 6)', warnings) ?? GIORNI_ANNO;
  }
  const giorniPensione = pensione > 0
    ? days(extracted.giorniPensione, 'Giorni di pensione (punto 7)', warnings)
    : undefined;

  // Punto 718 assente: la CU non riporta la riduzione del cuneo fiscale e il motore non ricalcola la somma esente.
  const tipologiaCuneo = extracted.cuneoTipologia;
  const sommaErogata = amount(extracted.sommaEsenteErogata);
  if (sommaErogata > MAX_SOMMA_ESENTE) {
    warnings.push(`Somma esente erogata (punto 725) superiore a ${MAX_SOMMA_ESENTE} €: verifica il dato nella CU.`);
  }
  const cuneoFiscale = tipologiaCuneo === 1 || tipologiaCuneo === 2
    ? {
        lavoroDipendente: tipologiaCuneo === 1,
        redditoLavoroDipendente: amount(extracted.cuneoRedditoLavoro),
        giorniLavoro: days(extracted.cuneoGiorni, 'Giorni di lavoro (punto 721)', warnings) ?? giorniLavorati,
        sommaErogata
      }
    : undefined;

  const domicilioAnno = domicilio(extracted.domicilioComune, extracted.domicilioProvincia, extracted.domicilioCodice);
  const domicilioAcconto = domicilio(
    extracted.domicilioAccontoComune, extracted.domicilioAccontoProvincia, extracted.domicilioAccontoCodice
  );
  const cambioDomicilio = (domicilioAcconto.codiceComune || domicilioAcconto.comune)
    && (domicilioAcconto.codiceComune !== domicilioAnno.codiceComune || domicilioAcconto.comune !== domicilioAnno.comune);

  const confidenza = typeof extracted.confidenceScore === 'number' && Number.isFinite(extracted.confidenceScore)
    ? Math.min(100, Math.max(0, Math.round(extracted.confidenceScore)))
    : undefined;

  if (totaleImponibile > 0 && totaleRitenute > totaleImponibile * 0.5) {
    warnings.push(`Ritenute pari al ${((totaleRitenute / totaleImponibile) * 100).toFixed(1)}% del reddito: verifica i dati estratti.`);
  }

  const data = {
    backend: {
      redditi: {
        lavoroDipendente,
        lavoroTempoDeterminato: lavoroDeterminato,
        assimilati,
        pensione,
        totaleImponibile
      },
      ritenute: {
        irpef,
        addRegionale,
        addComunale,
        addComunaleAcconto,
        addComunaleAccontoSuccessivo: amount(extracted.addComunaleAccontoSuccessivo),
        totaleRitenute
      },
      ...(cuneoFiscale && { cuneoFiscale }),
      detrazioni: {
        giorniLavorati,
        ...(giorniPensione !== undefined && { giorniPensione }),
        detrazioneLavoroApplicata: 0,
        detrazioneTeoricaSpettante: 0
      },
      acconti: { primaRata, secondaRata, totaleAcconti: round2(primaRata + secondaRata) },
      creditiPrecedenti: {
        creditoIrpef: 0,
        creditoAddRegionale: 0,
        creditoAddComunale: 0,
        totaleCreditiRiportati: 0
      },
      datiAnagrafici: {
        dataNascita: '',
        domicilioFiscale: domicilioAnno,
        domicilioFiscaleAcconto: cambioDomicilio ? domicilioAcconto : null
      }
    },
    ui: {
      redditiCU: totaleImponibile,
      statoCalcolo: 'completed' as const,
      avvisi: warnings,
      ...(confidenza !== undefined && { confidenza })
    }
  };

  return { data, warnings };
}

function isOwnedPath(filePath: unknown, userId: string): filePath is string {
  return typeof filePath === 'string'
    && filePath.length <= MAX_PATH_LENGTH
    && filePath.startsWith(`${userId}/`)
    && !filePath.includes('..');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { client, user } = auth;

  let filePath: unknown;
  try {
    ({ filePath } = await req.json());
  } catch {
    return json({ error: 'Richiesta non valida' }, 400);
  }

  if (!isOwnedPath(filePath, user.id)) {
    return json({ error: 'Accesso al file non consentito' }, 403);
  }

  try {
    const { data: fileData, error: downloadError } = await client.storage.from(BUCKET).download(filePath);
    if (downloadError || !fileData) {
      return json({ error: 'File non trovato' }, 404);
    }

    const pdfText = await extractTextFromPDF(await fileData.arrayBuffer());
    const extracted = await extractWithAI(pdfText);
    const { data, warnings } = buildCUData(extracted);

    return json({ success: true, data, warnings });
  } catch (error) {
    if (error instanceof AIConfigError) {
      console.error('parse-cu-pdf: AI provider not configured');
      return json({ error: 'Servizio AI non configurato' }, 500);
    }
    if (error instanceof UpstreamError) {
      console.error('parse-cu-pdf: upstream failure:', error.message);
      return json({ error: 'Estrazione dati non riuscita, riprova' }, 502);
    }
    console.error('parse-cu-pdf: unexpected failure:', error instanceof Error ? error.name : 'unknown');
    return json({ error: 'Errore interno' }, 500);
  } finally {
    const { error: removeError } = await client.storage.from(BUCKET).remove([filePath]);
    if (removeError) {
      console.error('parse-cu-pdf: cleanup failed:', removeError.message);
    }
  }
});
