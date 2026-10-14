import { GlassCard } from "@/components/ui/glass-card";
import { InfoBox } from "@/components/ui/info-box";
import { Button } from "@/components/ui/button";
import { FileText, Plus } from "lucide-react";
import { AnimatedCounter } from "@/components/cu/AnimatedCounter";
import { RiepilogoRedditiData } from "@/hooks/useRiepilogoData";

interface RedditiSummaryProps {
  data: RiepilogoRedditiData;
  onEdit?: () => void;
}

export function RedditiSummary({ data, onEdit }: RedditiSummaryProps) {
  return (
    <GlassCard variant="hover">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Redditi
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Certificazioni Uniche caricate
          </p>
        </div>
        {onEdit && (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Modifica
          </Button>
        )}
      </div>

      {/* Lista CU individuali */}
      <div className="space-y-3 mb-4">
        {data.cus.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nessun CU caricato</p>
          </div>
        ) : (
          data.cus.map((cu) => (
            <div
              key={cu.id}
              className="flex items-center justify-between p-3 rounded-lg bg-secondary-glass border border-card-border"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="font-medium text-sm">{cu.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    Certificazione Unica
                  </div>
                </div>
              </div>
              <div className="text-right">
                <AnimatedCounter
                  value={cu.importo}
                  className="text-sm font-semibold"
                  prefix="€ "
                  formatter={(val) => val.toLocaleString('it-IT', { useGrouping: 'always', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Totale aggregato */}
      <div className="border-t border-card-border pt-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-muted-foreground">
              Totale Redditi da CU
            </div>
            {data.cus.length > 1 && (
              <div className="text-xs text-muted-foreground mt-1">
                Aggregato da {data.cus.length} CU
              </div>
            )}
          </div>
          <AnimatedCounter
            value={data.totaleRedditi}
            className="text-2xl font-bold text-primary"
            prefix="€ "
            formatter={(val) => val.toLocaleString('it-IT', { useGrouping: 'always', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          />
        </div>
      </div>

      {/* Altri redditi (placeholder futuro) */}
      {data.altriRedditi > 0 && (
        <div className="mt-4 pt-4 border-t border-card-border">
          <InfoBox
            label="Altri redditi (TS/F24)"
            value={
              <AnimatedCounter
                value={data.altriRedditi}
                prefix="€ "
                formatter={(val) => val.toLocaleString('it-IT', { useGrouping: 'always' })}
              />
            }
          />
        </div>
      )}
    </GlassCard>
  );
}
