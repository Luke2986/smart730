import { FileText } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { DOCUMENTI_DA_CONSERVARE, type TipoDocumenti } from '@/utils/documenti';

export function DocumentiDaConservare({ tipo }: { tipo: TipoDocumenti }) {
  const { titolo, voci } = DOCUMENTI_DA_CONSERVARE[tipo];
  return (
    <GlassCard>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold">Documenti da conservare: {titolo}</h3>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
            {voci.map((voce) => <li key={voce}>{voce}</li>)}
          </ul>
          <p className="text-xs text-muted-foreground">
            Non serve caricarli qui. Tienili per il CAF o per un eventuale controllo dell'Agenzia delle Entrate.
          </p>
        </div>
      </div>
    </GlassCard>
  );
}
