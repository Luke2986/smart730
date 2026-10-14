import { AlertTriangle, Calendar, Euro, type LucideIcon } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { Badge } from '@/components/ui/badge';
import { useTaxState } from '@/contexts/Smart730Context';
import { formatCurrency } from '@/utils/taxCalculations';
import { SOGLIA_CONFIDENZA } from '@/utils/controlli';
import { cn } from '@/lib/utils';

interface Riga {
  icon: LucideIcon;
  label: string;
  value: string;
  highlight?: boolean;
}

export function CUDataPreview() {
  const { state, cuSelezionata: cu } = useTaxState();
  if (!cu) return null;

  const aggregata = cu.id === 'aggregated';
  const origini = aggregata ? state.cus : [cu];
  const avvisi = origini.flatMap((c) => (c.ui.avvisi ?? []).map((testo) => (aggregata ? `${c.nome}: ${testo}` : testo)));
  const confidenze = origini.map((c) => c.ui.confidenza).filter((v): v is number => typeof v === 'number');
  const confidenza = confidenze.length > 0 ? Math.min(...confidenze) : null;
  const confidenzaBassa = confidenza !== null && confidenza < SOGLIA_CONFIDENZA;

  const { redditi, ritenute, detrazioni, cuneoFiscale } = cu.backend;
  const gruppi: Array<{ titolo: string; righe: Riga[] }> = [
    {
      titolo: 'Redditi',
      righe: [
        { icon: Euro, label: 'Lavoro dipendente', value: formatCurrency(redditi.lavoroDipendente) },
        ...(redditi.pensione > 0 ? [{ icon: Euro, label: 'Pensione', value: formatCurrency(redditi.pensione) }] : []),
        ...(redditi.assimilati > 0 ? [{ icon: Euro, label: 'Altri redditi assimilati', value: formatCurrency(redditi.assimilati) }] : []),
        { icon: Euro, label: 'Totale', value: formatCurrency(redditi.totaleImponibile), highlight: true }
      ]
    },
    {
      titolo: 'Ritenute',
      righe: [
        { icon: Euro, label: 'IRPEF trattenuta', value: formatCurrency(ritenute.irpef) },
        { icon: Euro, label: 'Addizionale regionale', value: formatCurrency(ritenute.addRegionale) },
        { icon: Euro, label: 'Addizionale comunale', value: formatCurrency(ritenute.addComunale) },
        { icon: Euro, label: 'Totale ritenute', value: formatCurrency(ritenute.totaleRitenute), highlight: true }
      ]
    },
    {
      titolo: 'Periodo e cuneo fiscale',
      righe: [
        ...(redditi.lavoroDipendente > 0 ? [{ icon: Calendar, label: 'Giorni di lavoro', value: String(detrazioni.giorniLavorati) }] : []),
        ...(detrazioni.giorniPensione !== undefined ? [{ icon: Calendar, label: 'Giorni di pensione', value: String(detrazioni.giorniPensione) }] : []),
        ...(cuneoFiscale ? [{ icon: Euro, label: 'Somma esente ricevuta in busta paga', value: formatCurrency(cuneoFiscale.sommaErogata) }] : [])
      ]
    }
  ].filter((gruppo) => gruppo.righe.length > 0);

  return (
    <GlassCard variant="glow">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-lg">{aggregata ? 'Totale delle CU' : cu.nome}</h3>
            <p className="text-sm text-muted-foreground">
              Dati letti in automatico: confrontali con la CU prima di continuare
            </p>
          </div>
          {confidenza !== null && (
            <Badge
              variant="outline"
              className={cn(confidenzaBassa ? 'bg-warning/10 text-warning border-warning/30' : 'bg-success/10 text-success border-success/20')}
              title="Confidenza dichiarata dal modello AI che ha letto la CU"
            >
              Lettura AI {Math.round(confidenza)}%
            </Badge>
          )}
        </div>

        {(avvisi.length > 0 || confidenzaBassa) && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 space-y-2">
            <div className="flex items-center gap-2 font-medium text-warning">
              <AlertTriangle className="h-4 w-4" />
              Da controllare sulla CU
            </div>
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
              {confidenzaBassa && <li>La lettura automatica è incerta: ricontrolla tutti gli importi.</li>}
              {avvisi.map((avviso, i) => <li key={i}>{avviso}</li>)}
            </ul>
          </div>
        )}

        {gruppi.map((gruppo) => (
          <div key={gruppo.titolo} className="space-y-3">
            <h4 className="font-medium text-primary-glow flex items-center gap-2">
              <div className="w-1 h-4 bg-primary rounded-full" />
              {gruppo.titolo}
            </h4>
            <div className="space-y-2">
              {gruppo.righe.map((riga) => (
                <div
                  key={riga.label}
                  className={cn(
                    'flex items-center justify-between gap-3 p-3 rounded-lg',
                    riga.highlight ? 'bg-primary/5 border border-primary/20' : 'bg-muted/20'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <riga.icon className={cn('w-4 h-4', riga.highlight ? 'text-primary' : 'text-muted-foreground')} />
                    <span className={cn('text-sm', riga.highlight && 'font-medium')}>{riga.label}</span>
                  </div>
                  <span className={cn('font-mono text-sm', riga.highlight ? 'font-semibold text-primary' : 'text-muted-foreground')}>
                    {riga.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
