# Smart730

Web app open source per stimare il **730/2026** (redditi 2025). Legge le Certificazioni Uniche e le spese sanitarie e calcola il risultato con le regole del modello. Alla fine produce un prospetto da stampare, da confrontare con la precompilata o da portare al CAF.

Funziona tutta nel browser: niente account, niente server, niente database.

**Cosa fa**

- Legge il PDF delle CU di lavoro dipendente e pensione e compila i valori dei punti della sezione "Dati fiscali". I valori si controllano e si correggono in un form, oppure si inseriscono a mano.
- Importa le spese sanitarie dal CSV del Sistema Tessera Sanitaria o le fa inserire a mano.
- Calcola le detrazioni per spese sanitarie e veterinarie (E1, E8-E10), interessi del mutuo prima casa (E7) e affitto dell'abitazione principale (E71).
- Calcola IRPEF, detrazioni, cuneo fiscale, addizionali regionale e comunale dal domicilio fiscale, saldo e acconti.
- Mostra gli avvisi sui dati e un prospetto stampabile, con le istruzioni per presentare il 730.

**Cosa non fa**

- Non invia la dichiarazione e non firma nulla: il risultato è una stima.
- Non gestisce familiari a carico, redditi diversi da lavoro dipendente e pensione, oneri diversi da quelli elencati sopra, crediti della dichiarazione precedente.

Non è un servizio dell'Agenzia delle Entrate. Per i casi dubbi rivolgiti a un CAF o a un professionista.

## Privacy

- I PDF delle CU e i CSV delle spese vengono letti nel browser ([pdf.js](https://mozilla.github.io/pdf.js/) per i PDF) e non vengono caricati da nessuna parte.
- I dati restano solo nella memoria della pagina: niente cookie, localStorage o database. Chiudendo o ricaricando la pagina spariscono, e il tasto "Cancella tutto" nell'ultima schermata li cancella subito.
- Nessun sistema di analytics o tracciamento. Sul deploy Vercel la Content Security Policy (`connect-src 'self'`) impedisce alla pagina di inviare dati ad altri siti.

## Lettura della CU

Il PDF viene letto senza intelligenza artificiale: l'app estrae il testo con pdf.js e associa ogni importo al numero del punto più vicino (in alto o a sinistra nel riquadro). I codici catastali prima dei dati fiscali danno il domicilio fiscale.

I modelli di CU dei diversi sostituti d'imposta non sono tutti uguali e la lettura può sbagliare o saltare dei valori: il form segna i campi letti dal PDF e vanno confrontati con la CU. I PDF scansionati (immagini) non hanno testo e si compilano a mano.

La logica è in `src/utils/cuPdf.ts` (lettura del testo) e `src/utils/cuDaPunti.ts` (dai punti ai dati usati nel calcolo), con i test in `src/utils/__tests__/`.

## Sviluppo

Serve Node.js 20+.

```bash
npm install
npm run dev     # http://localhost:8080
npm test        # test del motore di calcolo e della lettura della CU
npm run build   # versione statica in dist/
```

Non servono variabili d'ambiente né chiavi. `dist/` si pubblica su qualsiasi hosting di siti statici: su Vercel basta importare il repository (preset Vite), `vercel.json` gestisce il routing e gli header di sicurezza.

## Aggiornare l'anno fiscale

L'anno è definito in `src/utils/annoFiscale.ts`; scaglioni, detrazioni e soglie sono in `src/utils/taxCalculations.ts`, i punti della CU in `src/utils/cuDaPunti.ts`.

Aliquote delle addizionali dell'anno d'imposta:

- **Regionali**: `src/data/addizionali/regionali.ts`, trascritte dall'elenco MEF. Le agevolazioni particolari sono scritte a mano perché nell'elenco compaiono come testo.
- **Comunali**: `src/data/addizionali/comunali.json`, generato dall'elenco MEF dell'addizionale comunale ([download](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/download/tabella.htm)):

```bash
node scripts/build-addizionali-comunali.mjs Add_comunale_irpef2025.csv
```

Anche l'acconto dell'anno successivo usa l'aliquota deliberata per l'anno d'imposta, applicata dal comune del domicilio al 1° gennaio dell'anno successivo (art. 8, c. 2, D.Lgs. 175/2014). Lo script segnala con `[verifica]` i comuni con scaglioni scritti in modo non standard: per quelli l'app non ricalcola l'addizionale e usa quanto trattenuto in CU.

## Licenza

[MIT](LICENSE). Il software è fornito senza garanzie: verifica sempre il risultato prima di presentare la dichiarazione.
