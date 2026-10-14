import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Calculator, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { AnimatedCounter } from "@/components/cu/AnimatedCounter";
import { RiepilogoCalcoloFinale } from "@/hooks/useRiepilogoData";
import { cn } from "@/lib/utils";
import { ANNO_DICHIARAZIONE, ANNO_IMPOSTA } from "@/utils/annoFiscale";

interface CalcoloFinaleProps {
  data: RiepilogoCalcoloFinale;
  onViewDettaglio?: () => void;
}

export function CalcoloFinale({ data, onViewDettaglio }: CalcoloFinaleProps) {
  const isCredito = data.tipo === 'credito';
  const isDebito = data.tipo === 'debito';
  const risultatoAbs = Math.abs(data.risultatoFinale);

  return (
    <GlassCard variant="glow" className="relative overflow-hidden">
      {/* Background gradient basato sul risultato */}
      <div className={cn(
        "absolute inset-0 opacity-5 pointer-events-none",
        isCredito && "bg-gradient-to-br from-success to-transparent",
        isDebito && "bg-gradient-to-br from-destructive to-transparent"
      )} />

      <div className="relative">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Risultato Fiscale
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Prospetto di liquidazione (730-3)
            </p>
          </div>
          {onViewDettaglio && (
            <Button variant="ghost" size="sm" onClick={onViewDettaglio}>
              Dettaglio
            </Button>
          )}
        </div>

        {/* Risultato principale */}
        <div className="text-center py-6 mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            {isCredito && <TrendingUp className="h-6 w-6 text-success" />}
            {isDebito && <TrendingDown className="h-6 w-6 text-destructive" />}
            {!isCredito && !isDebito && <Minus className="h-6 w-6 text-muted-foreground" />}
            <div className={cn(
              "text-sm font-semibold uppercase tracking-wide",
              isCredito && "text-success",
              isDebito && "text-destructive",
              !isCredito && !isDebito && "text-muted-foreground"
            )}>
              {isCredito ? "A tuo favore" : isDebito ? "Da versare" : "In pareggio"}
            </div>
          </div>
          
          <AnimatedCounter
            value={risultatoAbs}
            className={cn(
              "text-5xl font-bold",
              isCredito && "text-success",
              isDebito && "text-destructive",
              !isCredito && !isDebito && "text-muted-foreground"
            )}
            prefix="€ "
            formatter={euro}
          />

          {isCredito && (
            <p className="text-xs text-muted-foreground mt-2">
              Rimborso in busta paga, sulla pensione o dall'Agenzia delle Entrate
            </p>
          )}
          {isDebito && (
            <p className="text-xs text-muted-foreground mt-2">
              Saldo {ANNO_IMPOSTA} più acconti {ANNO_DICHIARAZIONE}
            </p>
          )}
        </div>

        <div className="space-y-2 border-t border-card-border pt-4">
          <CalcoloRow label="Reddito complessivo" value={data.redditoImponibile} />
          <CalcoloRow label="IRPEF lorda" value={data.irpefLorda} indent />
          <CalcoloRow label="Detrazioni per lavoro o pensione" value={-data.detrazioniReddito} indent />
          {data.ulterioreDetrazione > 0 && (
            <CalcoloRow label="Ulteriore detrazione (taglio del cuneo fiscale)" value={-data.ulterioreDetrazione} indent />
          )}
          {data.detrazioniOneri > 0 && (
            <CalcoloRow label="Detrazioni per spese (quadro E)" value={-data.detrazioniOneri} indent />
          )}
          <CalcoloRow label="IRPEF netta" value={data.irpefNetta} semibold />
          <CalcoloRow label="IRPEF trattenuta in CU" value={-data.ritenuteIrpef} indent />
          {data.accontiECrediti > 0 && (
            <CalcoloRow label={`Acconti ${ANNO_IMPOSTA} e crediti già versati`} value={-data.accontiECrediti} indent />
          )}
          {data.conguaglioSommaEsente !== 0 && (
            <CalcoloRow
              label={data.conguaglioSommaEsente < 0 ? "Somma esente non ricevuta in busta paga" : "Somma esente non spettante"}
              hint="Taglio del cuneo fiscale per redditi fino a 20.000 €"
              value={data.conguaglioSommaEsente}
              signed
              indent
            />
          )}

          <SectionTitle>{`Saldo ${ANNO_IMPOSTA}`}</SectionTitle>
          <CalcoloRow label="IRPEF" value={data.saldoIRPEF} signed indent />
          <CalcoloRow label="Addizionale regionale" value={data.saldoAddRegionale} signed indent />
          <CalcoloRow label="Addizionale comunale" value={data.saldoAddComunale} signed indent />

          <SectionTitle>{`Acconti ${ANNO_DICHIARAZIONE}`}</SectionTitle>
          <CalcoloRow
            label="IRPEF"
            hint={accontoHint(data)}
            value={data.accontoIRPEF.totale}
            signed
            indent
          />
          <CalcoloRow label="Addizionale comunale" value={data.accontoAddComunale} signed indent />

          <div className="border-t-2 border-primary/20 my-2" />
          <CalcoloRow
            label={isCredito ? "Totale a credito" : "Totale da versare"}
            value={risultatoAbs}
            variant={isCredito ? "success" : isDebito ? "error" : "default"}
            semibold
            large
          />
          <p className="text-xs text-muted-foreground pt-1">
            Saldo e acconti sono trattenuti in busta paga o sulla pensione, oppure si versano con F24.
            Importi fino a 12 € per singola imposta non si versano e non si rimborsano.
          </p>
        </div>
      </div>
    </GlassCard>
  );
}

const euro = (val: number) => val.toLocaleString('it-IT', { useGrouping: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function accontoHint(data: RiepilogoCalcoloFinale): string | undefined {
  const { primaRata, secondaRata, totale } = data.accontoIRPEF;
  if (totale === 0) return undefined;
  if (primaRata === 0) return 'Rata unica a novembre';
  return `Luglio € ${euro(primaRata)} · novembre € ${euro(secondaRata)}`;
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div className="pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  );
}

interface CalcoloRowProps {
  label: string;
  value: number;
  hint?: string;
  /** Saldo o acconto: positivo = a debito, negativo = a credito */
  signed?: boolean;
  variant?: 'default' | 'success' | 'error';
  indent?: boolean;
  semibold?: boolean;
  large?: boolean;
}

function CalcoloRow({
  label,
  value,
  hint,
  signed = false,
  variant = 'default',
  indent = false,
  semibold = false,
  large = false
}: CalcoloRowProps) {
  const tone = signed ? (value < 0 ? 'success' : value > 0 ? 'error' : 'default') : variant;
  const prefix = signed
    ? (value < 0 ? "credito € " : "€ ")
    : (value < 0 ? "-€ " : "€ ");

  return (
    <div className={cn(
      "flex items-center justify-between gap-4 text-sm",
      indent && "pl-4"
    )}>
      <div className={cn(
        "text-muted-foreground",
        semibold && "font-semibold",
        large && "text-base"
      )}>
        {label}
        {hint && <div className="text-xs opacity-80">{hint}</div>}
      </div>
      <AnimatedCounter
        value={Math.abs(value)}
        className={cn(
          "shrink-0 tabular-nums",
          semibold && "font-semibold",
          large && "text-lg",
          tone === 'success' && "text-success",
          tone === 'error' && "text-destructive"
        )}
        prefix={prefix}
        formatter={euro}
      />
    </div>
  );
}
