import { FileText, Trash2, Eye, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { Badge } from '@/components/ui/badge';
import { CUData } from '@/types/tax';
import { formatCurrency } from '@/utils/taxCalculations';

interface CUListProps {
  cus: CUData[];
  selectedId: string | null;
  aggregatedCu: CUData | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onAddNew: () => void;
}

export function CUList({ cus, selectedId, aggregatedCu, onSelect, onRemove, onAddNew }: CUListProps) {
  if (cus.length === 0) {
    return (
      <GlassCard className="text-center p-8">
        <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground mb-4">Nessun CU caricato</p>
        <Button variant="gradient" onClick={onAddNew}>
          <Plus className="h-4 w-4 mr-2" />
          Carica primo CU
        </Button>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header con totale */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">CU Caricati ({cus.length})</h3>
          <p className="text-xs text-muted-foreground">
            Clicca per visualizzare dettagli
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onAddNew}>
          <Plus className="h-3 w-3 mr-1" />
          Aggiungi CU
        </Button>
      </div>

      {/* Lista CU individuali */}
      {cus.map((cu, index) => (
        <div key={cu.id} onClick={() => onSelect(cu.id)}>
          <GlassCard
            variant={cu.id === selectedId ? 'glow' : 'default'}
            className={`cursor-pointer transition-all hover:shadow-glow ${
              cu.id === selectedId ? 'border-primary' : ''
            }`}
          >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{cu.nome}</p>
                  {cu.id === selectedId && (
                    <Badge variant="outline" className="text-xs">Selezionato</Badge>
                  )}
                  {(cu.ui.avvisi?.length ?? 0) > 0 && (
                    <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">
                      Da controllare
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span>Reddito: {formatCurrency(cu.backend.redditi.totaleImponibile)}</span>
                  <span>•</span>
                  <span>IRPEF: {formatCurrency(cu.backend.ritenute.irpef)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(cu.id);
                }}
              >
                <Eye className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Rimuovere "${cu.nome}"?`)) {
                    onRemove(cu.id);
                  }
                }}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          </div>
        </GlassCard>
        </div>
      ))}

      {/* CU Aggregato (sempre mostrato se ci sono 2+ CU) */}
      {cus.length > 1 && aggregatedCu && (
        <div onClick={() => onSelect('aggregated')}>
          <GlassCard
            variant={selectedId === 'aggregated' ? 'glow' : 'default'}
            className={`cursor-pointer transition-all hover:shadow-glow border-2 ${
              selectedId === 'aggregated' ? 'border-success' : 'border-success/30'
            }`}
          >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <FileText className="h-4 w-4 text-success" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-success">Totale Aggregato</p>
                <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                  {cus.length} CU
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                <span>Reddito: {formatCurrency(aggregatedCu.backend.redditi.totaleImponibile)}</span>
                <span>•</span>
                <span>IRPEF: {formatCurrency(aggregatedCu.backend.ritenute.irpef)}</span>
              </div>
            </div>
          </div>
        </GlassCard>
        </div>
      )}
    </div>
  );
}
