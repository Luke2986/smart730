import { useMemo } from 'react';
import { Trash2, Filter } from 'lucide-react';
import { SpesaSanitaria } from '@/types/tax';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { Badge } from '@/components/ui/badge';
import { formatCurrencyDetailed } from '@/utils/taxCalculations';
import { calcolaDetrazioneSanitarie } from '@/utils/medicalExpenseCalculations';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ExpensesSummaryProps {
  spese: SpesaSanitaria[];
  onRemove: (id: string) => void;
}

export function ExpensesSummary({ spese, onRemove }: ExpensesSummaryProps) {
  const summary = useMemo(() => {
    const calcolo = calcolaDetrazioneSanitarie(spese);
    return {
      mediche: { totale: calcolo.speseMediche, detrazione: calcolo.detrazioneMediche },
      veterinarie: { totale: calcolo.speseVeterinarie, detrazione: calcolo.detrazioneVeterinarie },
      totaleDetrazione: calcolo.totaleDetrazione
    };
  }, [spese]);

  if (spese.length === 0) {
    return (
      <GlassCard>
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Nessuna spesa inserita</p>
          <p className="text-xs mt-2">Importa il CSV del Sistema TS o inserisci le spese a mano</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <GlassCard className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Spese mediche</div>
          <div className="text-2xl font-bold text-green-400">
            {formatCurrencyDetailed(summary.mediche.totale)}
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Detrazione: {formatCurrencyDetailed(summary.mediche.detrazione)}
          </div>
          {summary.mediche.totale > 0 && (
            <div className="text-xs text-warning mt-1">
              (dopo franchigia di €129,11)
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Spese veterinarie</div>
          <div className="text-2xl font-bold text-blue-400">
            {formatCurrencyDetailed(summary.veterinarie.totale)}
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Detrazione: {formatCurrencyDetailed(summary.veterinarie.detrazione)}
          </div>
          {summary.veterinarie.totale > 0 && (
            <div className="text-xs text-warning mt-1">
              (spesa massima €550, franchigia €129,11)
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-4 bg-primary/10 border-primary/30">
          <div className="text-xs text-muted-foreground mb-1">Detrazione totale</div>
          <div className="text-2xl font-bold text-primary">
            {formatCurrencyDetailed(summary.totaleDetrazione)}
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            {spese.length} spese inserite
          </div>
        </GlassCard>
      </div>

      {/* Expenses Table */}
      <GlassCard>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead className="text-right">Importo</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {spese.map((spesa) => (
                <TableRow key={spesa.id} className="group">
                  <TableCell>
                    <Badge 
                      variant="outline"
                      className={spesa.sottotipo === 'mediche' 
                        ? 'bg-green-500/10 text-green-400 border-green-500/30' 
                        : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                      }
                    >
                      {spesa.sottotipo === 'mediche' ? 'Mediche' : 'Veterinarie'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{spesa.descrizione}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrencyDetailed(spesa.importo)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(spesa.id)}
                      aria-label="Elimina spesa"
                      className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </GlassCard>

      {/* Help text */}
      <div className="text-xs text-muted-foreground text-center space-y-1">
        <p>La franchigia di €129,11 si applica sul totale delle spese, non sulla singola spesa.</p>
        <p>Spese veterinarie: si considerano al massimo €550, meno la franchigia.</p>
      </div>
    </div>
  );
}
