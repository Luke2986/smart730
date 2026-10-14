import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GlassCard } from '@/components/ui/glass-card';
import { Home, Info } from 'lucide-react';
import { calculateDetrazioneAffitto, determinaDetrazioneMigliore, TipoContrattoAffitto } from '@/utils/detrazioniAffitto';
import { useToast } from '@/hooks/use-toast';
import type { DetrazioneAffittoData } from '@/types/tax';

const affittoSchema = z.object({
  tipoContratto: z.enum(['libero', 'concordato', 'giovani_under31']),
  canoneAnnuo: z.number().min(0).max(100000),
  giorniAffitto: z.number().min(1).max(365),
  percentuale: z.number().min(1).max(100),
  etaContribuente: z.number().min(18).max(100)
});

type AffittoFormData = z.infer<typeof affittoSchema>;

interface AffittoFormProps {
  redditoComplessivo: number;
  value: DetrazioneAffittoData | null;
  onSave: (affitto: DetrazioneAffittoData) => void;
}

export function AffittoForm({ redditoComplessivo, value, onSave }: AffittoFormProps) {
  const { toast } = useToast();
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<AffittoFormData>({
    resolver: zodResolver(affittoSchema),
    defaultValues: value ?? {
      tipoContratto: 'libero',
      canoneAnnuo: 0,
      giorniAffitto: 365,
      percentuale: 100,
      etaContribuente: 30
    }
  });

  const formData = watch();
  
  // Calcola detrazione in real-time
  const detrazioneCalcolata = React.useMemo(() => {
    if (!formData.canoneAnnuo || !formData.etaContribuente) return 0;
    
    return calculateDetrazioneAffitto({
      tipoContratto: formData.tipoContratto as TipoContrattoAffitto,
      canoneAnnuo: formData.canoneAnnuo,
      giorniAffitto: formData.giorniAffitto || 365,
      percentuale: formData.percentuale || 100,
      etaContribuente: formData.etaContribuente,
      redditoComplessivo
    });
  }, [formData, redditoComplessivo]);

  // Suggerimento contratto migliore
  const suggerimento = React.useMemo(() => {
    if (!formData.canoneAnnuo || !formData.etaContribuente) return null;
    
    return determinaDetrazioneMigliore(
      formData.canoneAnnuo,
      formData.etaContribuente,
      redditoComplessivo,
      formData.giorniAffitto || 365
    );
  }, [formData, redditoComplessivo]);

  const onSubmit = (data: AffittoFormData) => {
    onSave(data as DetrazioneAffittoData);

    toast({
      title: "Affitto salvato",
      description: `Detrazione di €${detrazioneCalcolata.toFixed(2)} aggiunta al calcolo.`,
    });
  };

  return (
    <GlassCard>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Home className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Detrazione Affitto Abitazione Principale</h3>
          <p className="text-sm text-muted-foreground">Quadro E71 - Contratto locazione</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="tipoContratto">Tipo Contratto</Label>
          <Select 
            value={formData.tipoContratto} 
            onValueChange={(tipo) => setValue('tipoContratto', tipo as TipoContrattoAffitto)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="libero">Contratto Libero (4+4)</SelectItem>
              <SelectItem value="concordato">Contratto Concordato (3+2)</SelectItem>
              <SelectItem value="giovani_under31">Bonus Giovani (20-31 anni)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="canoneAnnuo">Canone Annuo (€)</Label>
          <Input
            id="canoneAnnuo"
            type="number"
            step="0.01"
            {...register('canoneAnnuo', { valueAsNumber: true })}
          />
          {errors.canoneAnnuo && (
            <p className="text-xs text-destructive mt-1">{errors.canoneAnnuo.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="giorniAffitto">Giorni Affitto nell'Anno</Label>
          <Input
            id="giorniAffitto"
            type="number"
            {...register('giorniAffitto', { valueAsNumber: true })}
          />
          {errors.giorniAffitto && (
            <p className="text-xs text-destructive mt-1">{errors.giorniAffitto.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="percentuale">Quota del contratto (%)</Label>
          <Input
            id="percentuale"
            type="number"
            {...register('percentuale', { valueAsNumber: true })}
          />
          {errors.percentuale && (
            <p className="text-xs text-destructive mt-1">{errors.percentuale.message}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            100% se il contratto è intestato solo a te, 50% se siete in due
          </p>
        </div>

        <div>
          <Label htmlFor="etaContribuente">Età Contribuente</Label>
          <Input
            id="etaContribuente"
            type="number"
            {...register('etaContribuente', { valueAsNumber: true })}
          />
          {errors.etaContribuente && (
            <p className="text-xs text-destructive mt-1">{errors.etaContribuente.message}</p>
          )}
        </div>

        {suggerimento?.tipoContratto === 'giovani_under31' && suggerimento.detrazione > detrazioneCalcolata && (
          <div className="bg-warning/10 border border-warning/30 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-warning mt-0.5" />
              <div>
                <div className="font-medium text-sm">Suggerimento</div>
                <div className="text-xs text-muted-foreground mt-1">{suggerimento.suggerimento}</div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-primary/10 p-4 rounded-lg">
          <div className="text-sm text-muted-foreground">Detrazione calcolata</div>
          <div className="text-2xl font-bold text-primary">
            €{detrazioneCalcolata.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Calcolata sul reddito complessivo delle CU caricate (€{redditoComplessivo.toLocaleString('it-IT', { useGrouping: 'always' })}).
          </p>
        </div>

        <Button type="submit" className="w-full">
          Salva Detrazione Affitto
        </Button>
      </form>
    </GlassCard>
  );
}
