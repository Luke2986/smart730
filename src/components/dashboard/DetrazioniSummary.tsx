import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Receipt, Home, Building2, ChevronRight } from "lucide-react";
import { AnimatedCounter } from "@/components/cu/AnimatedCounter";
import { RiepilogoDetrazioniData } from "@/hooks/useRiepilogoData";

interface DetrazioniSummaryProps {
  data: RiepilogoDetrazioniData;
  onEditSpese?: () => void;
  onEditMutuo?: () => void;
  onEditAffitto?: () => void;
}

export function DetrazioniSummary({ 
  data, 
  onEditSpese, 
  onEditMutuo, 
  onEditAffitto 
}: DetrazioniSummaryProps) {
  const hasDetrazioni = data.totaleDetrazioni > 0;

  return (
    <GlassCard variant="hover">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Oneri Detraibili
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Spese che riducono le tasse
          </p>
        </div>
      </div>

      {!hasDetrazioni ? (
        <div className="text-center py-6 text-muted-foreground">
          <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nessuna detrazione inserita</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Spese Sanitarie */}
          {data.speseSanitarie.count > 0 && (
            <DetrazioneCard
              icon={<Receipt className="h-4 w-4" />}
              title="Spese Sanitarie"
              subtitle={`${data.speseSanitarie.count} spese inserite`}
              importo={data.speseSanitarie.importoTotale}
              detrazione={data.speseSanitarie.detrazioneCalcolata}
              breakdown={[
                data.speseSanitarie.breakdown.mediche.count > 0 && 
                  `Mediche: ${data.speseSanitarie.breakdown.mediche.count} (€${data.speseSanitarie.breakdown.mediche.importo.toLocaleString('it-IT', { useGrouping: 'always' })})`,
                data.speseSanitarie.breakdown.veterinarie.count > 0 && 
                  `Veterinarie: ${data.speseSanitarie.breakdown.veterinarie.count} (€${data.speseSanitarie.breakdown.veterinarie.importo.toLocaleString('it-IT', { useGrouping: 'always' })})`
              ].filter(Boolean) as string[]}
              onEdit={onEditSpese}
            />
          )}

          {/* Interessi Mutuo */}
          {data.mutuo.presente && (
            <DetrazioneCard
              icon={<Home className="h-4 w-4" />}
              title="Interessi Mutuo (E7)"
              subtitle="Prima abitazione"
              importo={data.mutuo.interessiPagati}
              detrazione={data.mutuo.detrazioneCalcolata}
              breakdown={["Detrazione max 19% su €4.000"]}
              onEdit={onEditMutuo}
            />
          )}

          {/* Affitto */}
          {data.affitto.presente && (
            <DetrazioneCard
              icon={<Building2 className="h-4 w-4" />}
              title="Affitto (E71)"
              subtitle={data.affitto.tipoContratto || "Contratto affitto"}
              importo={data.affitto.canoneAnnuo}
              detrazione={data.affitto.detrazioneCalcolata}
              breakdown={["Canone annuo"]}
              onEdit={onEditAffitto}
            />
          )}
        </div>
      )}

      {/* Totale Detrazioni */}
      <div className="border-t border-card-border pt-4 mt-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-muted-foreground">
            Totale Detrazioni
          </div>
          <AnimatedCounter
            value={data.totaleDetrazioni}
            className="text-2xl font-bold text-success"
            prefix="-€ "
            formatter={(val) => val.toLocaleString('it-IT', { useGrouping: 'always', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          />
        </div>
      </div>
    </GlassCard>
  );
}

interface DetrazioneCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  importo: number;
  detrazione: number;
  breakdown?: string[];
  onEdit?: () => void;
}

function DetrazioneCard({ 
  icon, 
  title, 
  subtitle, 
  importo, 
  detrazione, 
  breakdown,
  onEdit 
}: DetrazioneCardProps) {
  return (
    <div className="p-3 rounded-lg bg-secondary-glass border border-card-border hover:bg-card-glass transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2 rounded-lg bg-primary/10">
            {icon}
          </div>
          <div className="flex-1">
            <div className="font-medium text-sm">{title}</div>
            <div className="text-xs text-muted-foreground">{subtitle}</div>
          </div>
        </div>
        {onEdit && (
          <Button variant="ghost" size="sm" onClick={onEdit} className="h-8 w-8 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Breakdown */}
      {breakdown && breakdown.length > 0 && (
        <div className="text-xs text-muted-foreground mb-2 ml-11">
          {breakdown.map((item, idx) => (
            <div key={idx}>• {item}</div>
          ))}
        </div>
      )}

      {/* Importi */}
      <div className="flex items-center justify-between ml-11 mt-2">
        <div className="text-xs text-muted-foreground">
          Spesa: €{importo.toLocaleString('it-IT', { useGrouping: 'always' })}
        </div>
        <div className="text-sm font-semibold text-success">
          Detrazione: €{detrazione.toLocaleString('it-IT', { useGrouping: 'always' })}
        </div>
      </div>
    </div>
  );
}
