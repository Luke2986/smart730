import { useRiepilogoData } from "@/hooks/useRiepilogoData";
import { RedditiSummary } from "./RedditiSummary";
import { DetrazioniSummary } from "./DetrazioniSummary";
import { CalcoloFinale } from "./CalcoloFinale";
import { GlassCard } from "@/components/ui/glass-card";
import { AlertCircle } from "lucide-react";
import { FiscalValidationAlert } from "./FiscalValidationAlert";
import { useTaxState } from "@/contexts/Smart730Context";

interface RiepilogoSectionProps {
  onEditCU?: () => void;
  onEditSpese?: () => void;
  onEditMutuo?: () => void;
  onEditAffitto?: () => void;
  onViewDettaglio?: () => void;
}

export function RiepilogoSection({
  onEditCU,
  onEditSpese,
  onEditMutuo,
  onEditAffitto,
  onViewDettaglio
}: RiepilogoSectionProps) {
  const riepilogo = useRiepilogoData();
  const { taxResult } = useTaxState();

  if (!riepilogo.hasData) {
    return (
      <GlassCard>
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">Nessun dato disponibile</h3>
          <p className="text-sm text-muted-foreground">
            Carica almeno una Certificazione Unica (CU) per visualizzare il riepilogo
          </p>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alert Validazione Fiscale */}
      {taxResult.validation && (
        <FiscalValidationAlert validation={taxResult.validation} />
      )}

      {/* Risultato Principale - In alto per massima visibilità */}
      <CalcoloFinale 
        data={riepilogo.calcolo} 
        onViewDettaglio={onViewDettaglio}
      />

      {/* Grid 2 colonne per Redditi e Detrazioni */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RedditiSummary 
          data={riepilogo.redditi} 
          onEdit={onEditCU}
        />
        
        <DetrazioniSummary 
          data={riepilogo.detrazioni}
          onEditSpese={onEditSpese}
          onEditMutuo={onEditMutuo}
          onEditAffitto={onEditAffitto}
        />
      </div>
    </div>
  );
}
