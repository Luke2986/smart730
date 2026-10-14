import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ANNO_IMPOSTA } from '@/utils/annoFiscale';
import type { CUData } from '@/types/tax';

const GIORNI_ANNO = 365;

interface GiorniLavoroFormProps {
  cus: CUData[];
  giorniLavoro: number | null;
  onChange: (giorni: number | null) => void;
}

/** Rigo C5: con più CU i periodi contemporanei si contano una sola volta, e solo l'utente sa se si sovrappongono. */
export function GiorniLavoroForm({ cus, giorniLavoro, onChange }: GiorniLavoroFormProps) {
  const somma = Math.min(GIORNI_ANNO, cus.reduce((totale, cu) => totale + cu.backend.detrazioni.giorniLavorati, 0));
  const [valore, setValore] = useState(giorniLavoro === null ? '' : String(giorniLavoro));
  const giorni = Number(valore);
  const valido = valore !== '' && Number.isInteger(giorni) && giorni >= 1 && giorni <= GIORNI_ANNO;

  return (
    <GlassCard>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Calendar className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Giorni di lavoro nel {ANNO_IMPOSTA} (rigo C5)</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Le CU riportano in tutto {somma} giorni. Se due rapporti si sono sovrapposti, i giorni in comune si
              contano una volta sola: indica i giorni effettivi, dal calendario.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="giorniLavoro">Giorni effettivi</Label>
            <Input
              id="giorniLavoro"
              type="number"
              inputMode="numeric"
              min={1}
              max={GIORNI_ANNO}
              value={valore}
              onChange={(e) => setValore(e.target.value)}
              placeholder={String(somma)}
              className="w-32"
            />
          </div>
          <Button variant="gradient" disabled={!valido || giorni === giorniLavoro} onClick={() => onChange(giorni)}>
            Applica
          </Button>
          {giorniLavoro !== null && (
            <Button
              variant="glass"
              onClick={() => {
                setValore('');
                onChange(null);
              }}
            >
              Usa la somma delle CU
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {giorniLavoro === null
            ? `Il calcolo usa ora la somma delle CU (${somma} giorni).`
            : `Il calcolo usa ${giorniLavoro} giorni.`}{' '}
          Se un datore di lavoro ha già conguagliato i redditi di un altro rapporto (sezione «redditi erogati da altri
          soggetti» della CU), carica solo la CU del conguaglio: i redditi dell'altra sono già compresi.
        </p>
      </div>
    </GlassCard>
  );
}
