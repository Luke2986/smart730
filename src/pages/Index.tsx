import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle, CircleAlert, Info, Printer, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { InfoBox } from "@/components/ui/info-box";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useTaxState } from "@/contexts/Smart730Context";
import { RiepilogoSection } from "@/components/dashboard/RiepilogoSection";
import { CUForm } from "@/components/cu/CUForm";
import { CUDataPreview } from "@/components/cu/CUDataPreview";
import { CUList } from "@/components/cu/CUList";
import { GiorniLavoroForm } from "@/components/cu/GiorniLavoroForm";
import { MedicalExpenseForm } from "@/components/expenses/MedicalExpenseForm";
import { ExpensesSummary } from "@/components/expenses/ExpensesSummary";
import { CSVUploadZone } from "@/components/expenses/CSVUploadZone";
import { MutuoForm } from "@/components/expenses/MutuoForm";
import { DomicilioFiscaleForm } from "@/components/cu/DomicilioFiscaleForm";
import { AffittoForm } from "@/components/expenses/AffittoForm";
import { DocumentiDaConservare } from "@/components/documents/DocumentiDaConservare";
import { Prospetto } from "@/components/presentazione/Prospetto";
import { toast } from "@/hooks/use-toast";
import { SpesaSanitaria } from "@/types/tax";
import { CSVParseResult } from "@/utils/csvParser";
import { autoMapCSVColumns, mapCSVRowToExpense } from "@/utils/csvMapping";
import { cleanImportedExpenses, senzaDuplicati } from "@/utils/csvValidation";
import { controlliDichiarazione, cuDiLavoro, type Controllo, type Sezione } from "@/utils/controlli";
import { ANNO_DICHIARAZIONE, ANNO_IMPOSTA, SCADENZA_730, SCADENZA_REDDITI_PF, scaduto } from "@/utils/annoFiscale";
import { cn } from "@/lib/utils";

type Screen =
  | "welcome" | "cu" | "sts" | "mutuo" | "affitto"
  | "riepilogo" | "verifica" | "presentazione";

const NAV: Array<{ screen: Screen; label: string }> = [
  { screen: "welcome", label: "Inizio" },
  { screen: "cu", label: "CU" },
  { screen: "sts", label: "Spese sanitarie" },
  { screen: "mutuo", label: "Mutuo" },
  { screen: "affitto", label: "Affitto" },
  { screen: "riepilogo", label: "Riepilogo" },
  { screen: "verifica", label: "Verifica" },
  { screen: "presentazione", label: "Presentazione" },
];

const steps = ["Compilazione", "Riepilogo", "Verifica", "Presentazione"];

function stepIndexFromScreen(s: Screen) {
  if (s === "riepilogo") return 1;
  if (s === "verifica") return 2;
  if (s === "presentazione") return 3;
  return 0;
}

/** Casi che il calcolo non gestisce: vanno aggiunti nella precompilata o dal CAF. */
const LIMITI = [
  "Familiari a carico (coniuge, figli, altri familiari)",
  "Redditi diversi da lavoro dipendente e pensione: fabbricati, terreni, lavoro autonomo occasionale, redditi di capitale",
  "Oneri diversi da spese sanitarie, interessi del mutuo prima casa e affitto: ad esempio istruzione, sport, assicurazioni, previdenza complementare, bonus edilizi, affitto per studenti fuori sede (E72)",
  "Crediti ed eccedenze della dichiarazione precedente (quadro F)",
  "Scelte per l'8, il 5 e il 2 per mille: si indicano quando presenti la dichiarazione",
];

const formatData = (data: Date) => data.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });

export default function Smart730() {
  const [screen, setScreen] = useState<Screen>("welcome");

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [screen]);

  return (
    <div className="min-h-screen bg-gradient-background text-foreground print:min-h-0 print:bg-white">
      <header className="sticky top-0 z-10 border-b border-glass-border bg-glass-bg backdrop-blur-xl print:hidden">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="shrink-0 whitespace-nowrap text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Smart 730
            </div>
            <div className="flex items-center gap-1.5 text-right text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-success" />
              <span>I dati restano in questa pagina</span>
            </div>
          </div>
          <nav className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 text-xs" aria-label="Sezioni">
            {NAV.map((item) => (
              <Button
                key={item.screen}
                onClick={() => setScreen(item.screen)}
                variant="nav"
                size="sm"
                aria-current={screen === item.screen ? "page" : undefined}
                className={cn("shrink-0 whitespace-nowrap text-xs", screen === item.screen && "text-primary")}
              >
                {item.label}
              </Button>
            ))}
          </nav>
          <div className="mt-4">
            <GlobalStepper current={stepIndexFromScreen(screen)} steps={steps} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8 print:max-w-none print:p-0">
        {screen === "welcome" && <Welcome onNext={() => setScreen("cu")} />}
        {screen === "cu" && <CU onNext={() => setScreen("sts")} />}
        {screen === "sts" && <TS onNext={() => setScreen("mutuo")} />}
        {screen === "mutuo" && <Mutuo onNext={() => setScreen("affitto")} />}
        {screen === "affitto" && <Affitto onNext={() => setScreen("riepilogo")} />}
        {screen === "riepilogo" && <Riepilogo onNext={() => setScreen("verifica")} />}
        {screen === "verifica" && <Verifica onNext={() => setScreen("presentazione")} onGo={setScreen} />}
        {screen === "presentazione" && <Presentazione onGo={setScreen} />}
      </main>
    </div>
  );
}

function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <SectionTitle
          title="Benvenuto"
          subtitle={`Stima del 730/${ANNO_DICHIARAZIONE} sui redditi ${ANNO_IMPOSTA}, con le regole ufficiali del modello`}
        />
        <GlassCard variant="hover">
          <div className="text-sm space-y-4">
            <div>
              <div className="mb-2 font-semibold text-primary-glow">Cosa fa</div>
              <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                <li>Legge le tue CU di lavoro dipendente e pensione, direttamente nel browser</li>
                <li>Importa le spese sanitarie dal CSV del Sistema Tessera Sanitaria o le inserisci a mano</li>
                <li>Calcola le detrazioni per interessi del mutuo prima casa (E7) e affitto (E71)</li>
                <li>Ti dà un prospetto stampabile da confrontare con la precompilata o da portare al CAF</li>
              </ul>
            </div>
            <div>
              <div className="mb-2 font-semibold text-warning">Cosa non fa</div>
              <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                <li>Non invia la dichiarazione e non firma nulla per te</li>
                <li>Non gestisce familiari a carico, altri tipi di reddito e gli oneri diversi da quelli sopra</li>
              </ul>
            </div>
          </div>
        </GlassCard>
        <GlassCard>
          <div className="flex items-start gap-3 text-sm">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            <div className="space-y-1">
              <div className="font-semibold">Niente account, niente server</div>
              <p className="text-muted-foreground">
                Tutto avviene in questa pagina: i PDF e i CSV vengono letti dal tuo browser e non vengono inviati a
                nessuno. Non salviamo nulla: quando chiudi o ricarichi la pagina i dati spariscono. Alla fine puoi
                anche cancellarli con un tasto.
              </p>
            </div>
          </div>
        </GlassCard>
        <Button onClick={onNext} variant="gradient" size="lg" className="shadow-glow">
          Inizia
        </Button>
      </div>
      <AsideNote
        title="Ti servono"
        items={["Le CU dei redditi " + ANNO_IMPOSTA, "Il CSV delle spese sanitarie, se ne hai", "Certificazione interessi del mutuo o contratto d'affitto"]}
      />
    </div>
  );
}

function CU({ onNext }: { onNext: () => void }) {
  const { state, aggregatedCu, cuSelezionata, removeCU, selectCU, setGiorniLavoro } = useTaxState();
  // null: nessun form aperto; "nuova": aggiunta; altrimenti id della CU in modifica.
  const [form, setForm] = useState<string | null>(null);
  const hasCUs = state.cus.length > 0;
  const cuLavoro = cuDiLavoro(state.cus);
  const inModifica = form && form !== "nuova" ? state.cus.find((cu) => cu.id === form) : undefined;
  const formAperto = !hasCUs || form !== null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <SectionTitle
          title="Certificazione Unica (CU)"
          subtitle="Aggiungi una CU per ogni datore di lavoro o ente pensionistico"
        />

        {hasCUs && (
          <CUList
            cus={state.cus}
            selectedId={cuSelezionata?.id ?? null}
            aggregatedCu={aggregatedCu}
            onSelect={selectCU}
            onRemove={(id) => {
              removeCU(id);
              if (form === id) setForm(null);
            }}
            onAddNew={() => setForm("nuova")}
          />
        )}

        {cuLavoro.length > 1 && (
          <GiorniLavoroForm
            key={String(state.giorniLavoro)}
            cus={cuLavoro}
            giorniLavoro={state.giorniLavoro}
            onChange={setGiorniLavoro}
          />
        )}

        {formAperto && (
          <CUForm
            key={form ?? "prima"}
            cu={inModifica}
            onSalvata={() => setForm(null)}
            onAnnulla={hasCUs ? () => setForm(null) : undefined}
          />
        )}

        {cuSelezionata && !formAperto && <CUDataPreview onModifica={setForm} />}

        <Button onClick={onNext} variant="gradient" size="lg" disabled={!hasCUs || formAperto} className="shadow-glow">
          Continua
        </Button>
      </div>

      <AsideNote
        title="Come funziona"
        items={[
          "Il PDF viene letto nel browser, senza intelligenza artificiale e senza inviarlo a nessuno",
          "La lettura automatica può sbagliare: confronta ogni valore con la sezione \"Dati fiscali\" della CU",
          "Se il PDF è una scansione, copia i valori a mano",
          "Se hai cambiato lavoro o hai anche una pensione, aggiungi tutte le CU: il calcolo usa il totale",
        ]}
      />
    </div>
  );
}

function TS({ onNext }: { onNext: () => void }) {
  const { state, addSpese, removeSpesa } = useTaxState();
  const spese = Object.values(state.spese).filter((s): s is SpesaSanitaria => s.tipo === 'sanitarie');

  const handleAddSpesa = (spesaData: Omit<SpesaSanitaria, 'id' | 'dataInserimento' | 'validata'>) => {
    addSpese([{ ...spesaData, id: `spesa-${crypto.randomUUID()}`, dataInserimento: new Date(), validata: false }]);
  };

  const handleCSVParsed = (result: CSVParseResult) => {
    const mapping = autoMapCSVColumns(result.metadata.headers);
    const lette = cleanImportedExpenses(
      result.data.map((row) => mapCSVRowToExpense(row, mapping, result.metadata.numberFormats))
    );
    const nuove = senzaDuplicati(lette, spese);
    const ignorate = result.data.length - lette.length;
    const giaPresenti = lette.length - nuove.length;

    if (nuove.length === 0) {
      toast({
        variant: lette.length === 0 ? "destructive" : "default",
        title: lette.length === 0 ? "Nessuna spesa valida" : "Spese già importate",
        description: lette.length === 0
          ? "Il file non contiene importi leggibili."
          : "Tutte le spese del file sono già presenti.",
      });
      return;
    }

    addSpese(nuove);
    const dettagli = [
      giaPresenti > 0 && `${giaPresenti} già presenti`,
      ignorate > 0 && `${ignorate} righe senza importo valido ignorate`,
    ].filter(Boolean);
    toast({
      title: "CSV importato",
      description: `${nuove.length} spese aggiunte${dettagli.length > 0 ? ` (${dettagli.join(", ")})` : ""}.`,
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <SectionTitle title="Spese sanitarie" subtitle="Importa il CSV o inserisci le spese a mano" />

        <GlassCard>
          <h3 className="text-sm font-semibold mb-2">Importa da CSV</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Puoi scaricare l'elenco delle tue spese in CSV dal sito del Sistema Tessera Sanitaria. Il file viene letto
            in questa pagina, senza caricarlo sul server.
          </p>
          <CSVUploadZone onParsed={handleCSVParsed} />
        </GlassCard>

        <GlassCard>
          <h3 className="text-sm font-semibold mb-4">Inserimento manuale</h3>
          <MedicalExpenseForm onAdd={handleAddSpesa} />
        </GlassCard>

        <DocumentiDaConservare tipo="sanitarie" />

        <NextButton onNext={onNext} label="Continua" />
      </div>

      <div className="space-y-6">
        <SectionTitle title="Riepilogo" subtitle="Totali e detrazioni" />
        <ExpensesSummary spese={spese} onRemove={removeSpesa} />
      </div>
    </div>
  );
}

function Mutuo({ onNext }: { onNext: () => void }) {
  const { state, setMutuo } = useTaxState();
  const [hasMutuo, setHasMutuo] = useState(state.mutuo !== null);

  const handleToggle = (enabled: boolean) => {
    setHasMutuo(enabled);
    if (!enabled) setMutuo(null);
  };

  return (
    <ScreenShell title="Interessi mutuo E7" subtitle="Solo caso semplice, acquisto prima casa">
      <GlassCard>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">Hai un mutuo per la prima casa?</h3>
            <p className="text-sm text-muted-foreground">
              Attiva questa opzione solo se hai un mutuo contratto per l'acquisto dell'abitazione principale
            </p>
          </div>
          <Switch checked={hasMutuo} onCheckedChange={handleToggle} aria-label="Mutuo prima casa" />
        </div>

        {!hasMutuo && (
          <div className="mt-4">
            <InfoBox label="Nessun mutuo prima casa" value="Puoi procedere direttamente al prossimo passaggio" variant="success" />
          </div>
        )}
      </GlassCard>

      {hasMutuo && (
        <>
          <MutuoForm value={state.mutuo} onSave={setMutuo} />
          <GlassCard>
            <div className="text-sm text-muted-foreground">
              Includi interessi passivi, oneri accessori e quote di rivalutazione. Esclusi i premi delle polizze.
            </div>
          </GlassCard>
          <DocumentiDaConservare tipo="mutuo" />
        </>
      )}

      <Button onClick={onNext} variant="gradient" size="lg" disabled={hasMutuo && !state.mutuo} className="w-full">
        Avanti
      </Button>
    </ScreenShell>
  );
}

function Affitto({ onNext }: { onNext: () => void }) {
  const { state, setAffitto, aggregatedCu } = useTaxState();
  const [hasAffitto, setHasAffitto] = useState(state.affitto !== null);
  const redditoComplessivo = aggregatedCu?.backend.redditi.totaleImponibile ?? 0;

  const handleToggle = (enabled: boolean) => {
    setHasAffitto(enabled);
    if (!enabled) setAffitto(null);
  };

  return (
    <ScreenShell title="Affitto E71" subtitle="Contratto 4+4 o 3+2 e opzione giovani">
      <GlassCard>
        <div className="text-sm text-muted-foreground">
          Non gestiamo l'affitto per studenti fuori sede (E72) e i casi particolari.
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">Hai un contratto di affitto?</h3>
            <p className="text-sm text-muted-foreground">
              Attiva questa opzione solo se paghi un canone di locazione per la tua abitazione principale
            </p>
          </div>
          <Switch checked={hasAffitto} onCheckedChange={handleToggle} aria-label="Contratto di affitto" />
        </div>

        {!hasAffitto && (
          <div className="mt-4">
            <InfoBox label="Nessun affitto" value="Puoi procedere direttamente al prossimo passaggio" variant="success" />
          </div>
        )}
      </GlassCard>

      {hasAffitto && (
        <>
          {redditoComplessivo === 0 && (
            <InfoBox
              label="Carica prima la CU"
              value="La detrazione per l'affitto dipende dal reddito complessivo"
              variant="warning"
            />
          )}
          <AffittoForm redditoComplessivo={redditoComplessivo} value={state.affitto} onSave={setAffitto} />
          <GlassCard>
            <div className="text-sm text-muted-foreground">
              Giovani: tra 20 e 31 anni non compiuti, reddito fino a 15.493,71 €, casa diversa da quella dei genitori, primi 4 anni del contratto.
            </div>
          </GlassCard>
          <DocumentiDaConservare tipo="affitto" />
        </>
      )}

      <Button onClick={onNext} variant="gradient" size="lg" disabled={hasAffitto && !state.affitto} className="w-full">
        Vai al riepilogo
      </Button>
    </ScreenShell>
  );
}

function Riepilogo({ onNext }: { onNext: () => void }) {
  const { aggregatedCu, setDomicilio } = useTaxState();
  const datiAnagrafici = aggregatedCu?.backend.datiAnagrafici;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <SectionTitle
          title="Riepilogo"
          subtitle="Redditi, detrazioni e risultato stimato della tua dichiarazione"
        />

        {datiAnagrafici && (
          <DomicilioFiscaleForm
            key={`${datiAnagrafici.domicilioFiscale?.codiceComune}-${datiAnagrafici.domicilioFiscaleAcconto?.codiceComune ?? ''}`}
            domicilio={datiAnagrafici.domicilioFiscale}
            domicilioAcconto={datiAnagrafici.domicilioFiscaleAcconto}
            onSave={setDomicilio}
          />
        )}

        <RiepilogoSection />

        <Button onClick={onNext} variant="gradient" size="lg" className="shadow-glow w-full">
          Vai alla verifica
        </Button>
      </div>

      <AsideNote
        title="Prossimi passi"
        items={[
          "Controlla gli avvisi nella verifica",
          "Stampa il prospetto",
          "Presenta il 730 con la precompilata o al CAF",
        ]}
      />
    </div>
  );
}

const SEZIONE_SCHERMATA: Record<Sezione, Screen> = { cu: "cu", sts: "sts", riepilogo: "riepilogo" };

function Verifica({ onNext, onGo }: { onNext: () => void; onGo: (screen: Screen) => void }) {
  const { state, taxResult } = useTaxState();
  const controlli = useMemo(() => controlliDichiarazione(state, taxResult), [state, taxResult]);
  const errori = controlli.filter((c) => c.livello === "errore");
  const avvisi = controlli.filter((c) => c.livello === "avviso");
  const note = controlli.filter((c) => c.livello === "nota");

  return (
    <ScreenShell
      title="Verifica"
      subtitle="Controlli sui dati inseriti e note sul calcolo"
      aside={["Correggi gli errori prima di usare il prospetto", "Gli avvisi indicano dati da confrontare con i documenti"]}
    >
      <GlassCard>
        {errori.length === 0 && avvisi.length === 0 ? (
          <div className="flex items-center gap-2 text-success">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Nessun problema nei dati inseriti</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">
              {[
                errori.length > 0 && `${errori.length} ${errori.length === 1 ? "errore" : "errori"}`,
                avvisi.length > 0 && `${avvisi.length} ${avvisi.length === 1 ? "avviso" : "avvisi"}`,
              ].filter(Boolean).join(" e ")}
            </span>
          </div>
        )}
      </GlassCard>

      <ListaControlli titolo="Da correggere" controlli={errori} onGo={onGo} />
      <ListaControlli titolo="Da controllare" controlli={avvisi} onGo={onGo} />
      <ListaControlli titolo="Note sul calcolo" controlli={note} onGo={onGo} />

      <GlassCard>
        <h3 className="font-semibold mb-2">Cosa il calcolo non considera</h3>
        <p className="text-sm text-muted-foreground mb-2">
          Se ti riguarda, il risultato reale sarà diverso: aggiungi questi dati nella precompilata o chiedi al CAF.
        </p>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          {LIMITI.map((limite) => <li key={limite}>{limite}</li>)}
        </ul>
      </GlassCard>

      <Button onClick={onNext} variant="gradient" size="lg" disabled={state.cus.length === 0} className="shadow-glow">
        Vai alla presentazione
      </Button>
    </ScreenShell>
  );
}

const STILE_CONTROLLO: Record<Controllo["livello"], { icon: typeof Info; className: string }> = {
  errore: { icon: CircleAlert, className: "text-destructive" },
  avviso: { icon: AlertTriangle, className: "text-warning" },
  nota: { icon: Info, className: "text-muted-foreground" },
};

function ListaControlli({ titolo, controlli, onGo }: { titolo: string; controlli: Controllo[]; onGo: (screen: Screen) => void }) {
  if (controlli.length === 0) return null;

  return (
    <GlassCard>
      <h3 className="font-semibold mb-3">{titolo}</h3>
      <ul className="space-y-3">
        {controlli.map((controllo, i) => {
          const { icon: Icon, className } = STILE_CONTROLLO[controllo.livello];
          return (
            <li key={i} className="flex items-start gap-3 text-sm">
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", className)} />
              <span className="flex-1 text-muted-foreground">{controllo.testo}</span>
              {controllo.sezione && (
                <Button variant="glass" size="sm" className="shrink-0" onClick={() => onGo(SEZIONE_SCHERMATA[controllo.sezione!])}>
                  Correggi
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </GlassCard>
  );
}

function Presentazione({ onGo }: { onGo: (screen: Screen) => void }) {
  const { aggregatedCu, cancellaTutto } = useTaxState();

  const cancella = () => {
    cancellaTutto();
    onGo("welcome");
    toast({ title: "Dati cancellati", description: "CU, spese, mutuo e affitto sono stati cancellati da questa pagina." });
  };

  if (!aggregatedCu) {
    return (
      <ScreenShell title="Presentazione" subtitle="Il prospetto da stampare e come presentare il 730">
        <GlassCard>
          <p className="text-sm text-muted-foreground mb-4">Carica almeno una CU per ottenere il prospetto.</p>
          <Button variant="gradient" onClick={() => onGo("cu")}>Vai alle CU</Button>
        </GlassCard>
      </ScreenShell>
    );
  }

  const fuoriTermine730 = scaduto(SCADENZA_730);
  const fuoriTermineRedditi = scaduto(SCADENZA_REDDITI_PF);

  return (
    <div className="space-y-6">
      <div className="space-y-6 print:hidden">
        <SectionTitle title="Presentazione" subtitle="Il prospetto da stampare e come presentare la dichiarazione" />

        {fuoriTermine730 && (
          <GlassCard className="border-warning/40 bg-warning/10">
            <div className="flex items-start gap-3 text-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div className="space-y-2">
                <p className="font-medium">
                  Il termine per il 730/{ANNO_DICHIARAZIONE} è scaduto il {formatData(SCADENZA_730)}.
                </p>
                <p className="text-muted-foreground">
                  {fuoriTermineRedditi
                    ? `Anche il termine del modello Redditi PF (${formatData(SCADENZA_REDDITI_PF)}) è passato: entro 90 giorni si può ancora presentare una dichiarazione tardiva, con una sanzione. Rivolgiti a un CAF o a un professionista.`
                    : `Puoi ancora presentare il modello Redditi PF online entro il ${formatData(SCADENZA_REDDITI_PF)}. Con il Redditi PF non c'è il conguaglio in busta paga: il debito si versa con F24 e il credito lo rimborsa l'Agenzia o si usa in compensazione. Le imposte sono le stesse, ma il prospetto resta una stima.`}
                </p>
              </div>
            </div>
          </GlassCard>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="gradient" onClick={() => window.print()} className="shadow-glow">
            <Printer className="h-4 w-4 mr-2" />
            Stampa o salva in PDF
          </Button>
          <span className="text-xs text-muted-foreground">Per il PDF scegli «Salva come PDF» nella finestra di stampa.</span>
        </div>
      </div>

      <Prospetto />

      <div className="space-y-4 print:hidden">
        <h3 className="text-lg font-semibold">Come presentare il 730</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <ModoPresentazione titolo="Da solo, con la precompilata">
            Accedi all'area riservata dell'Agenzia delle Entrate con SPID, CIE o CNS e apri il 730 precompilato.
            Confronta i quadri con il prospetto, aggiungi quello che manca e invia. Se accetti la precompilata senza
            modifiche, l'Agenzia non fa controlli documentali sui dati che ha fornito.
          </ModoPresentazione>
          <ModoPresentazione titolo="Al CAF o da un professionista">
            Porta il prospetto e i documenti da conservare: il CAF controlla i dati, appone il visto di conformità e
            invia la dichiarazione. Di solito il servizio è a pagamento.
          </ModoPresentazione>
          <ModoPresentazione titolo="Tramite il datore di lavoro">
            Alcuni datori di lavoro e enti pensionistici offrono l'assistenza fiscale diretta: chiedi all'ufficio del
            personale se è previsto.
          </ModoPresentazione>
        </div>
        <GlassCard>
          <p className="text-sm text-muted-foreground">
            Con il 730 il rimborso o la trattenuta arrivano nella prima busta paga o rata di pensione utile dopo la
            presentazione. Se non hai un sostituto d'imposta, il rimborso lo paga l'Agenzia delle Entrate e il debito si
            versa con F24.
          </p>
        </GlassCard>

        <GlassCard>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-semibold">Hai finito?</h3>
              <p className="text-sm text-muted-foreground">
                I dati non sono salvati da nessuna parte e spariscono chiudendo la pagina. Puoi cancellarli subito.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Cancella tutto
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancellare tutti i dati?</AlertDialogTitle>
                  <AlertDialogDescription>
                    CU, spese, mutuo e affitto inseriti verranno cancellati da questa pagina. Stampa o salva il prospetto
                    prima, se ti serve.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction onClick={cancella} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Cancella tutto
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function ModoPresentazione({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <GlassCard>
      <h4 className="font-semibold mb-2">{titolo}</h4>
      <p className="text-sm text-muted-foreground">{children}</p>
    </GlassCard>
  );
}

// UI Components
function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function GlobalStepper({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-sm">
        {steps.map((s, i) => (
          <div key={s} className="flex-1 flex items-center">
            <div className={`
              rounded-full px-3 py-1 text-xs font-medium transition-all duration-300
              ${i <= current
                ? "bg-gradient-primary text-primary-foreground shadow-glow-sm"
                : "bg-card-glass text-muted-foreground border border-card-border backdrop-blur-sm"
              }
            `}>
              {i + 1}
            </div>
            <div className="ml-3 mr-3 hidden sm:block text-xs">{s}</div>
            {i < steps.length - 1 && (
              <div className={`
                h-px flex-1 transition-all duration-300
                ${i < current ? "bg-primary" : "bg-card-border"}
              `} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenShell({
  title,
  subtitle,
  aside = ["Compila con calma", "Puoi tornare indietro in ogni momento"],
  children,
}: {
  title: string;
  subtitle?: string;
  aside?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <SectionTitle title={title} subtitle={subtitle} />
        {children}
      </div>
      <AsideNote title="Consigli" items={aside} />
    </div>
  );
}

function AsideNote({ title, items }: { title: string; items: string[] }) {
  return (
    <aside className="space-y-4">
      <GlassCard>
        <div className="text-sm font-medium text-muted-foreground mb-3">{title}</div>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          {items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      </GlassCard>
    </aside>
  );
}

function NextButton({ onNext, label = "Continua" }: { onNext: () => void; label?: string }) {
  return (
    <Button onClick={onNext} variant="gradient" size="lg" className="shadow-glow">
      {label}
    </Button>
  );
}
