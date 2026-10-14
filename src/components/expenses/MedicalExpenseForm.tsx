import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from '@/hooks/use-toast';
import { SpesaSanitaria } from '@/types/tax';

const formSchema = z.object({
  data: z.string().min(1, "La data è obbligatoria"),
  descrizione: z.string().min(3, "Inserisci una descrizione valida").max(200),
  importo: z.number().min(0.01, "L'importo deve essere maggiore di 0").max(50000),
  sottotipo: z.enum(['mediche', 'veterinarie'])
});

type FormValues = z.infer<typeof formSchema>;

interface MedicalExpenseFormProps {
  onAdd: (spesa: Omit<SpesaSanitaria, 'id' | 'dataInserimento' | 'validata'>) => void;
}

export function MedicalExpenseForm({ onAdd }: MedicalExpenseFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      data: new Date().toISOString().split('T')[0],
      descrizione: '',
      importo: 0,
      sottotipo: 'mediche'
    }
  });

  const [calculatedDetraction, setCalculatedDetraction] = useState(0);

  const watchImporto = form.watch('importo');
  const watchSottotipo = form.watch('sottotipo');

  // Real-time calculation
  useState(() => {
    const calculateDetraction = () => {
      const importo = watchImporto || 0;
      const sottotipo = watchSottotipo;

      if (sottotipo === 'mediche') {
        // For mediche: 19% without franchise (franchise applied on total)
        setCalculatedDetraction(importo * 0.19);
      } else {
        // For veterinarie: 19% capped at 550€
        const base = Math.min(importo, 550);
        setCalculatedDetraction(base * 0.19);
      }
    };

    calculateDetraction();
  });

  const onSubmit = (values: FormValues) => {
    const spesa: Omit<SpesaSanitaria, 'id' | 'dataInserimento' | 'validata'> = {
      tipo: 'sanitarie',
      sottotipo: values.sottotipo,
      descrizione: values.descrizione,
      importo: values.importo,
      detrazione: values.sottotipo === 'mediche' ? values.importo * 0.19 : Math.min(values.importo, 550) * 0.19,
      franchigia: values.sottotipo === 'mediche' ? 129.11 : undefined
    };

    onAdd(spesa);
    
    toast({
      title: "Spesa aggiunta",
      description: `${values.descrizione} aggiunta con successo`
    });

    form.reset({
      data: new Date().toISOString().split('T')[0],
      descrizione: '',
      importo: 0,
      sottotipo: values.sottotipo
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="data"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sottotipo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo spesa</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="mediche">Spese mediche</SelectItem>
                    <SelectItem value="veterinarie">Spese veterinarie</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="descrizione"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrizione</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Es: Visita specialistica, Farmaci, Veterinario..." 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="importo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Importo</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  step="0.01"
                  placeholder="0.00"
                  {...field}
                  onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                />
              </FormControl>
              <FormMessage />
              {calculatedDetraction > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Detrazione stimata: €{calculatedDetraction.toFixed(2)}
                  {watchSottotipo === 'veterinarie' && watchImporto > 550 && (
                    <span className="text-warning ml-1">(max €550 per veterinarie)</span>
                  )}
                </p>
              )}
            </FormItem>
          )}
        />

        <Button type="submit" variant="gradient" className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Aggiungi spesa
        </Button>
      </form>
    </Form>
  );
}
