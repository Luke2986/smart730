import { useCallback, useState, type FormEvent } from 'react';
import { useDropzone } from 'react-dropzone';
import { AlertCircle, CheckCircle2, FileText, Loader2, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTaxState } from '@/contexts/Smart730Context';
import type { CUData, DomicilioFiscale } from '@/types/tax';
import { costruisciCU, domicilioDaCodice, GRUPPI_PUNTI, type CodicePunto, type DefinizionePunto, type PuntiCU } from '@/utils/cuDaPunti';
import { ErroreLetturaPdf, leggiCU } from '@/utils/cuPdf';
import { parseImporto, rilevaFormatoNumeri } from '@/utils/csvParser';
import { cn } from '@/lib/utils';

const GIORNI_ANNO = 365;
const NESSUNA_TIPOLOGIA = 'nessuna';
const PUNTI_REDDITO: CodicePunto[] = [1, 2, 3, 4, 5];

type Valori = Partial<Record<CodicePunto, string>>;

const formatoImporto = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' });

function testoDaPunti(punti: PuntiCU): Valori {
  const valori: Valori = {};
  for (const { punti: definizioni } of GRUPPI_PUNTI) {
    for (const { punto, tipo } of definizioni) {
      const valore = punti[punto];
      if (valore === undefined) continue;
      valori[punto] = tipo === 'importo' ? formatoImporto.format(valore) : String(valore);
    }
  }
  return valori;
}

/** Valore del campo, undefined se vuoto, null se non valido. */
function leggiCampo(testo: string | undefined, { tipo }: DefinizionePunto): number | undefined | null {
  const valore = testo?.trim() ?? '';
  if (valore === '') return undefined;
  if (tipo === 'importo') {
    const numero = parseImporto(valore, rilevaFormatoNumeri([valore]));
    return numero !== null && numero >= 0 ? numero : null;
  }
  if (tipo === 'giorni') {
    const giorni = /^\d+$/.test(valore) ? Number(valore) : NaN;
    return giorni >= 0 && giorni <= GIORNI_ANNO ? giorni : null;
  }
  return valore === '1' || valore === '2' ? Number(valore) : null;
}

interface CUFormProps {
  /** CU da modificare; senza, il form ne crea una nuova. */
  cu?: CUData;
  onSalvata: () => void;
  onAnnulla?: () => void;
}

export function CUForm({ cu, onSalvata, onAnnulla }: CUFormProps) {
  const { state, addCU, aggiornaCU } = useTaxState();
  const [nome, setNome] = useState(cu?.nome ?? `CU ${state.cus.length + 1}`);
  const [valori, setValori] = useState<Valori>(() => testoDaPunti(cu?.punti ?? {}));
  const [letti, setLetti] = useState<Valori>({});
  const [domicilio, setDomicilio] = useState<{ anno?: DomicilioFiscale; acconto?: DomicilioFiscale | null }>({
    anno: cu?.backend.datiAnagrafici.domicilioFiscale,
    acconto: cu?.backend.datiAnagrafici.domicilioFiscaleAcconto
  });
  const [lettura, setLettura] = useState<{ stato: 'idle' | 'in_corso' | 'fatta' | 'errore'; messaggio?: string; avviso?: string }>({
    stato: 'idle'
  });

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setLettura({ stato: 'in_corso' });
    try {
      const { punti, codiciComune, ripetuti } = await leggiCU(file);
      const testi = testoDaPunti(punti);
      const trovati = Object.keys(testi).length;
      setValori(testi);
      setLetti(testi);
      const [anno, acconto] = codiciComune.map(domicilioDaCodice);
      setDomicilio({ anno: anno ?? undefined, acconto: acconto ?? null });
      setLettura(
        trovati === 0
          ? { stato: 'errore', messaggio: 'Non ho trovato valori leggibili in questo PDF: inseriscili a mano copiandoli dalla CU.' }
          : {
              stato: 'fatta',
              messaggio: `Letti ${trovati} valori dal PDF. La lettura automatica può sbagliare: confrontali uno per uno con la CU.`,
              avviso: ripetuti.length > 0
                ? `I punti ${ripetuti.join(', ')} compaiono più volte con valori diversi: ho usato il primo, controllali.`
                : undefined
            }
      );
    } catch (error) {
      setLettura({
        stato: 'errore',
        messaggio: error instanceof ErroreLetturaPdf ? error.message : 'Non riesco a leggere questo PDF: inserisci i valori a mano.'
      });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: lettura.stato === 'in_corso'
  });

  const campi = GRUPPI_PUNTI.flatMap((g) => g.punti);
  const letture = new Map(campi.map((def) => [def.punto, leggiCampo(valori[def.punto], def)]));
  const nonValidi = campi.filter((def) => letture.get(def.punto) === null);
  const conReddito = PUNTI_REDDITO.some((punto) => (letture.get(punto) ?? 0) > 0);

  const salva = (event: FormEvent) => {
    event.preventDefault();
    if (nonValidi.length > 0 || !conReddito) return;
    const punti: PuntiCU = {};
    for (const [punto, valore] of letture) {
      if (typeof valore === 'number') punti[punto] = valore;
    }
    const nuova = costruisciCU(punti, {
      id: cu?.id ?? `cu-${crypto.randomUUID()}`,
      nome: nome.trim() || 'CU',
      domicilio: domicilio.anno,
      domicilioAcconto: domicilio.acconto
    });
    if (cu) aggiornaCU({ ...nuova, dataCaricamento: cu.dataCaricamento });
    else addCU(nuova);
    onSalvata();
  };

  const imposta = (punto: CodicePunto, testo: string) => setValori((v) => ({ ...v, [punto]: testo }));

  return (
    <GlassCard>
      <form onSubmit={salva} className="space-y-6" noValidate>
        <div>
          <h3 className="font-semibold text-lg">{cu ? `Modifica ${cu.nome}` : 'Nuova CU'}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Carica il PDF per compilare i campi in automatico, oppure copia i valori dalla sezione "Dati fiscali" della CU.
            I campi vuoti valgono zero.
          </p>
        </div>

        <div
          {...getRootProps()}
          className={cn(
            'rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors',
            isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
            lettura.stato === 'in_corso' && 'opacity-60 cursor-wait'
          )}
        >
          <input {...getInputProps()} aria-label="PDF della CU" />
          <div className="flex flex-col items-center gap-2">
            {lettura.stato === 'in_corso'
              ? <Loader2 className="h-8 w-8 text-primary animate-spin" />
              : <FileText className="h-8 w-8 text-muted-foreground" />}
            <p className="font-medium">
              {lettura.stato === 'in_corso' ? 'Lettura in corso…' : isDragActive ? 'Rilascia il PDF qui' : 'Trascina il PDF della CU o clicca per sceglierlo'}
            </p>
            <p className="text-xs text-muted-foreground">
              <ShieldCheck className="inline h-3 w-3 mr-1 -mt-0.5 text-success" />
              Il file viene letto in questo browser e non viene inviato a nessuno
            </p>
          </div>
        </div>

        {lettura.stato === 'fatta' && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              {lettura.messaggio}
              {lettura.avviso && <span className="block mt-1 text-warning">{lettura.avviso}</span>}
            </AlertDescription>
          </Alert>
        )}
        {lettura.stato === 'errore' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{lettura.messaggio}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="cu-nome">Nome (datore di lavoro o ente)</Label>
          <Input id="cu-nome" value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} />
        </div>

        {GRUPPI_PUNTI.map((gruppo) => (
          <fieldset key={gruppo.titolo} className="space-y-3">
            <legend className="font-medium text-primary-glow flex items-center gap-2 mb-3">
              <span className="w-1 h-4 bg-primary rounded-full" />
              {gruppo.titolo}
            </legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {gruppo.punti.map((def) => {
                const id = `punto-${def.punto}`;
                const testo = valori[def.punto] ?? '';
                const daPdf = letti[def.punto] !== undefined && letti[def.punto] === testo;
                const errato = letture.get(def.punto) === null;
                return (
                  <div key={def.punto} className="space-y-1.5">
                    <Label htmlFor={id} className="flex flex-wrap items-baseline gap-x-2 leading-snug">
                      <span className="font-mono text-xs text-muted-foreground">Punto {def.punto}</span>
                      <span>{def.etichetta}</span>
                      {daPdf && <span className="text-xs text-primary">letto dal PDF</span>}
                    </Label>
                    {def.tipo === 'tipologia' ? (
                      <Select value={testo || NESSUNA_TIPOLOGIA} onValueChange={(v) => imposta(def.punto, v === NESSUNA_TIPOLOGIA ? '' : v)}>
                        <SelectTrigger id={id}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NESSUNA_TIPOLOGIA}>Non compilato</SelectItem>
                          <SelectItem value="1">1</SelectItem>
                          <SelectItem value="2">2</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={id}
                        inputMode={def.tipo === 'importo' ? 'decimal' : 'numeric'}
                        placeholder={def.tipo === 'importo' ? '0,00' : '0'}
                        value={testo}
                        onChange={(e) => imposta(def.punto, e.target.value)}
                        aria-invalid={errato}
                        className={cn('font-mono', errato && 'border-destructive')}
                      />
                    )}
                    {errato && (
                      <p className="text-xs text-destructive">
                        {def.tipo === 'giorni' ? `Numero di giorni da 0 a ${GIORNI_ANNO}` : 'Importo non valido, ad esempio 12.345,67'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}

        {!conReddito && nonValidi.length === 0 && (
          <p className="text-sm text-muted-foreground">Indica almeno un reddito (punti 1-5) per salvare la CU.</p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="gradient" disabled={nonValidi.length > 0 || !conReddito}>
            {cu ? 'Salva modifiche' : 'Aggiungi CU'}
          </Button>
          {onAnnulla && (
            <Button type="button" variant="outline" onClick={onAnnulla}>
              Annulla
            </Button>
          )}
        </div>
      </form>
    </GlassCard>
  );
}
