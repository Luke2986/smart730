import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { GlassCard } from '@/components/ui/glass-card';
import { Building2, AlertTriangle } from 'lucide-react';
import { calculateDetrazioneMutuo } from '@/utils/detrazioniMutuo';
import { useToast } from '@/hooks/use-toast';
import type { DetrazioneMutuoData } from '@/types/tax';
import { ANNO_IMPOSTA } from '@/utils/annoFiscale';

const mutuoSchema = z.object({
  interessiPagati: z.number().min(0).max(50000),
  percentualeIntestazione: z.number().min(1).max(100),
  primaAbitazione: z.boolean()
});

type MutuoFormData = z.infer<typeof mutuoSchema>;

interface MutuoFormProps {
  value: DetrazioneMutuoData | null;
  onSave: (mutuo: DetrazioneMutuoData) => void;
}

export function MutuoForm({ value, onSave }: MutuoFormProps) {
  const { toast } = useToast();
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<MutuoFormData>({
    resolver: zodResolver(mutuoSchema),
    defaultValues: value ?? {
      interessiPagati: 0,
      percentualeIntestazione: 100,
      primaAbitazione: true
    }
  });

  const formData = watch();
  
  // Calcola detrazione in real-time
  const detrazioneCalcolata = React.useMemo(() => {
    if (!formData.interessiPagati) return 0;
    
    return calculateDetrazioneMutuo({
      interessiPagati: formData.interessiPagati,
      percentualeIntestazione: formData.percentualeIntestazione,
      primaAbitazione: formData.primaAbitazione
    });
  }, [formData]);

  const onSubmit = (data: MutuoFormData) => {
    if (!data.primaAbitazione) {
      toast({
        title: "Mutuo non detraibile",
        description: "Solo i mutui per acquisto prima casa sono detraibili.",
        variant: "destructive"
      });
      return;
    }

    onSave(data as DetrazioneMutuoData);

    toast({
      title: "Mutuo salvato",
      description: `Detrazione di €${detrazioneCalcolata.toFixed(2)} aggiunta al calcolo.`,
    });
  };

  return (
    <GlassCard>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Detrazione Interessi Mutuo Prima Casa</h3>
          <p className="text-sm text-muted-foreground">Quadro E7 - Max €4.000 detraibili</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="interessiPagati">Interessi Passivi Pagati (€)</Label>
          <Input
            id="interessiPagati"
            type="number"
            step="0.01"
            {...register('interessiPagati', { valueAsNumber: true })}
          />
          {errors.interessiPagati && (
            <p className="text-xs text-destructive mt-1">{errors.interessiPagati.message}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Interessi totali del mutuo pagati nel {ANNO_IMPOSTA}, come da certificazione della banca
          </p>
        </div>

        <div>
          <Label htmlFor="percentualeIntestazione">Percentuale Intestazione (%)</Label>
          <Input
            id="percentualeIntestazione"
            type="number"
            {...register('percentualeIntestazione', { valueAsNumber: true })}
          />
          {errors.percentualeIntestazione && (
            <p className="text-xs text-destructive mt-1">{errors.percentualeIntestazione.message}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            100% se intestato solo a te, 50% se cointestato
          </p>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="primaAbitazione">Prima Abitazione</Label>
          <Switch
            id="primaAbitazione"
            checked={formData.primaAbitazione}
            onCheckedChange={(checked) => setValue('primaAbitazione', checked)}
          />
        </div>

        {!formData.primaAbitazione && (
          <div className="bg-warning/10 border border-warning/30 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
              <div>
                <div className="font-medium text-sm">Attenzione</div>
                <div className="text-xs text-muted-foreground mt-1">Solo i mutui per acquisto prima casa sono detraibili</div>
              </div>
            </div>
          </div>
        )}

        {formData.interessiPagati > 4000 && (
          <div className="bg-warning/10 border border-warning/30 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
              <div>
                <div className="font-medium text-sm">Limite massimo</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Il limite di €4.000 vale per l'intero mutuo, poi si applica la tua quota.
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-primary/10 p-4 rounded-lg">
          <div className="text-sm text-muted-foreground">Detrazione 19%</div>
          <div className="text-2xl font-bold text-primary">€{detrazioneCalcolata.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Si sottrae dall'imposta: se l'imposta non basta, la parte in eccesso si perde.
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={!formData.primaAbitazione}>
          Salva Detrazione Mutuo
        </Button>
      </form>
    </GlassCard>
  );
}
