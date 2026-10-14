import { useId, useState } from 'react';
import { MapPin, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { GlassCard } from '@/components/ui/glass-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DomicilioFiscale } from '@/types/tax';
import { ANNO_DICHIARAZIONE, ANNO_IMPOSTA } from '@/utils/annoFiscale';
import {
  type ComuneInfo,
  cercaComuni,
  descriviRegolaComunale,
  trovaComune,
  trovaComunePerNome
} from '@/utils/addizionaliCalculations';

interface DomicilioFiscaleFormProps {
  /** Domicilio al 1° gennaio dell'anno d'imposta */
  domicilio?: DomicilioFiscale | null;
  /** Domicilio al 1° gennaio dell'anno successivo, se diverso */
  domicilioAcconto?: DomicilioFiscale | null;
  onSave: (domicilio: DomicilioFiscale, domicilioAcconto: DomicilioFiscale | null) => void;
}

function riconosci(domicilio?: DomicilioFiscale | null): ComuneInfo | null {
  if (!domicilio) return null;
  if (domicilio.codiceComune) return trovaComune(domicilio.codiceComune);
  if (domicilio.comune) return trovaComunePerNome(domicilio.comune, domicilio.provincia);
  return null;
}

const toDomicilio = (comune: ComuneInfo): DomicilioFiscale => ({
  comune: comune.nome,
  provincia: comune.provincia,
  regione: comune.regione,
  codiceComune: comune.codice
});

const etichetta = (comune: ComuneInfo) => `${comune.nome} (${comune.provincia})`;

function ComuneSearch({ label, value, onChange }: {
  label: string;
  value: ComuneInfo | null;
  onChange: (comune: ComuneInfo | null) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const risultati = cercaComuni(query);

  if (value) {
    return (
      <div className="space-y-1">
        <Label>{label}</Label>
        <div className="flex items-center justify-between gap-2 rounded-lg border border-card-border bg-card-glass px-3 py-2">
          <span className="text-sm font-medium">
            {etichetta(value)} <span className="text-muted-foreground">· {value.regione}</span>
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} aria-label={`Cambia ${label}`}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cerca il comune, es. Roma"
        autoComplete="off"
      />
      {query.trim().length >= 2 && (
        <ul className="max-h-60 overflow-y-auto rounded-lg border border-card-border bg-background" role="listbox">
          {risultati.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">Nessun comune trovato</li>}
          {risultati.map((comune) => (
            <li key={comune.codice}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-secondary-glass"
                onClick={() => {
                  onChange(comune);
                  setQuery('');
                }}
              >
                {etichetta(comune)} <span className="text-muted-foreground">· {comune.regione}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RegoleApplicate({ comune, comuneAcconto }: { comune: ComuneInfo; comuneAcconto: ComuneInfo }) {
  return (
    <ul className="space-y-1 text-sm text-muted-foreground">
      <li>Addizionale regionale {ANNO_IMPOSTA}: {comune.regione}</li>
      <li>
        Addizionale comunale {ANNO_IMPOSTA}: {etichetta(comune)}
        {comune.regola && `, ${descriviRegolaComunale(comune.regola)}`}
      </li>
      <li>
        Acconto comunale {ANNO_DICHIARAZIONE}: {etichetta(comuneAcconto)}
        {comuneAcconto.regola && `, 30% con ${descriviRegolaComunale(comuneAcconto.regola)} (delibera ${ANNO_IMPOSTA})`}
      </li>
    </ul>
  );
}

export function DomicilioFiscaleForm({ domicilio, domicilioAcconto, onSave }: DomicilioFiscaleFormProps) {
  const salvato = riconosci(domicilio);
  const salvatoAcconto = riconosci(domicilioAcconto);
  const [editing, setEditing] = useState(!salvato);
  const [comune, setComune] = useState<ComuneInfo | null>(salvato);
  const [cambio, setCambio] = useState(Boolean(salvatoAcconto && salvatoAcconto.codice !== salvato?.codice));
  const [comuneAcconto, setComuneAcconto] = useState<ComuneInfo | null>(salvatoAcconto);

  const nonRiconosciuto = !salvato && Boolean(domicilio?.comune || domicilio?.codiceComune);
  const canSave = Boolean(comune) && (!cambio || Boolean(comuneAcconto));

  const save = () => {
    if (!comune) return;
    onSave(toDomicilio(comune), cambio && comuneAcconto ? toDomicilio(comuneAcconto) : null);
    setEditing(false);
  };

  return (
    <GlassCard>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Domicilio fiscale</h3>
            <p className="text-sm text-muted-foreground">Decide le aliquote delle addizionali regionale e comunale</p>
          </div>
        </div>
        {!editing && (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="mr-1 h-4 w-4" /> Modifica
          </Button>
        )}
      </div>

      {!editing && salvato && (
        <RegoleApplicate comune={salvato} comuneAcconto={salvatoAcconto ?? salvato} />
      )}

      {editing && (
        <div className="space-y-4">
          {nonRiconosciuto && (
            <p className="text-sm text-warning">
              Il comune letto dalla CU ({domicilio?.comune || domicilio?.codiceComune}) non è stato riconosciuto: cercalo qui sotto.
            </p>
          )}
          <ComuneSearch label={`Comune al 1° gennaio ${ANNO_IMPOSTA}`} value={comune} onChange={setComune} />

          <div className="flex items-start gap-2">
            <Checkbox
              id="cambio-domicilio"
              checked={cambio}
              onCheckedChange={(checked) => setCambio(checked === true)}
            />
            <Label htmlFor="cambio-domicilio" className="text-sm font-normal leading-snug">
              Al 1° gennaio {ANNO_DICHIARAZIONE} il domicilio era in un altro comune
            </Label>
          </div>
          {cambio && (
            <ComuneSearch label={`Comune al 1° gennaio ${ANNO_DICHIARAZIONE}`} value={comuneAcconto} onChange={setComuneAcconto} />
          )}

          <p className="text-xs text-muted-foreground">
            Di solito coincide con la residenza. Il cambio di residenza conta dopo 60 giorni: se è avvenuto dal 3 novembre
            dell'anno prima, al 1° gennaio vale ancora il comune precedente. Lo trovi anche nella CU, nei riquadri del domicilio fiscale.
          </p>

          {comune && (cambio ? comuneAcconto : true) && (
            <RegoleApplicate comune={comune} comuneAcconto={(cambio && comuneAcconto) || comune} />
          )}

          <Button type="button" className="w-full" disabled={!canSave} onClick={save}>
            Salva domicilio
          </Button>
        </div>
      )}
    </GlassCard>
  );
}
