# Smart730

Web app open source per stimare il **730/2026** (redditi 2025). Legge le Certificazioni Uniche, importa le spese sanitarie e calcola il risultato con le regole del modello. Alla fine produce un prospetto da stampare, da confrontare con la precompilata o da portare al CAF.

**Cosa fa**

- Legge le CU di lavoro dipendente e pensione (estrazione con AI) e segnala i valori da ricontrollare.
- Importa le spese sanitarie dal CSV del Sistema Tessera Sanitaria o le fa inserire a mano.
- Calcola le detrazioni per spese sanitarie e veterinarie (E1, E8-E10), interessi del mutuo prima casa (E7) e affitto dell'abitazione principale (E71).
- Calcola IRPEF, detrazioni, cuneo fiscale, addizionali regionale e comunale dal domicilio fiscale, saldo e acconti.
- Mostra gli avvisi sui dati e un prospetto stampabile, con le istruzioni per presentare il 730.

**Cosa non fa**

- Non invia la dichiarazione e non firma nulla: il risultato è una stima.
- Non gestisce familiari a carico, redditi diversi da lavoro dipendente e pensione, oneri diversi da quelli elencati sopra, crediti della dichiarazione precedente.

Non è un servizio dell'Agenzia delle Entrate. Per i casi dubbi rivolgiti a un CAF o a un professionista.

## Privacy

Il repository non contiene chiavi né dati: chi installa l'app usa il proprio progetto Supabase e la propria chiave AI.

- **Senza accesso** si possono compilare spese, mutuo e affitto: i dati restano nella pagina e spariscono quando la chiudi.
- **Con accesso** (email e codice monouso) la dichiarazione viene salvata nel database Supabase dell'installazione, visibile solo all'utente (policy RLS). "Elimina i miei dati" nel profilo cancella tutto.
- **CU**: il PDF viene caricato in una cartella privata, il testo viene inviato al provider AI configurato per l'estrazione e il file viene cancellato subito dopo, anche in caso di errore.
- **CSV delle spese**: viene letto nel browser, non viene caricato sul server.
- **Chat GAIA**: i messaggi vengono inviati al provider AI e non vengono salvati.
- Nessun sistema di analytics o tracciamento.

## Installazione

Servono Node.js 20+, un progetto [Supabase](https://supabase.com) (va bene il piano gratuito) e una chiave di un provider AI con API compatibile OpenAI (default: Google Gemini).

### 1. Database

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

`db push` applica `supabase/migrations/`: tabella delle dichiarazioni con RLS, bucket privato per le CU, knowledge base di GAIA.

### 2. Edge Functions

```bash
npx supabase functions deploy parse-cu-pdf
npx supabase functions deploy gaia-chat
npx supabase secrets set AI_API_KEY=<la-tua-chiave>
```

| Secret | Obbligatorio | Default |
|--------|--------------|---------|
| `AI_API_KEY` | sì | — |
| `AI_BASE_URL` | no | `https://generativelanguage.googleapis.com/v1beta/openai` (Gemini) |
| `AI_MODEL` | no | `gemini-2.5-flash` |

Per un altro provider cambia base URL e modello, ad esempio OpenAI: `AI_BASE_URL=https://api.openai.com/v1`.

### 3. Accesso con codice email

Dashboard → Authentication:

- **Email Templates**: nei template *Confirm signup* e *Magic Link* inserisci il codice con `{{ .Token }}` (modello in `supabase/templates/otp.html`).
- **URL Configuration**: Site URL = indirizzo dell'app (in sviluppo `http://localhost:8080`).
- Lo SMTP integrato di Supabase invia poche email l'ora e solo agli indirizzi del team del progetto: in produzione configura uno SMTP tuo.

### 4. App

```bash
cp .env.example .env   # URL e publishable key del progetto Supabase
npm install
npm run dev            # http://localhost:8080
```

`npm test` esegue i test del motore di calcolo, `npm run build` crea la versione statica in `dist/`, pubblicabile su qualsiasi hosting di siti statici.

## Aggiornare l'anno fiscale

L'anno è definito in `src/utils/annoFiscale.ts`; scaglioni, detrazioni e soglie sono in `src/utils/taxCalculations.ts`, con i test in `src/utils/__tests__/`.

Aliquote delle addizionali dell'anno d'imposta:

- **Regionali**: `src/data/addizionali/regionali.ts`, trascritte dall'elenco MEF. Le agevolazioni particolari sono scritte a mano perché nell'elenco compaiono come testo.
- **Comunali**: `src/data/addizionali/comunali.json`, generato dall'elenco MEF dell'addizionale comunale ([download](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/download/tabella.htm)):

```bash
node scripts/build-addizionali-comunali.mjs Add_comunale_irpef2025.csv
```

Anche l'acconto dell'anno successivo usa l'aliquota deliberata per l'anno d'imposta, applicata dal comune del domicilio al 1° gennaio dell'anno successivo (art. 8, c. 2, D.Lgs. 175/2014). Lo script segnala con `[verifica]` i comuni con scaglioni scritti in modo non standard: per quelli l'app non ricalcola l'addizionale e usa quanto trattenuto in CU.

## Licenza

[MIT](LICENSE). Il software è fornito senza garanzie: verifica sempre il risultato prima di presentare la dichiarazione.
