import { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useTaxState } from '@/contexts/Smart730Context';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/utils/taxCalculations';
import type { CUData } from '@/types/tax';

interface CUUploadZoneProps {
  onUploadComplete?: () => void;
  className?: string;
}

type UploadStatus = 'idle' | 'uploading' | 'parsing' | 'success' | 'error';
type ParsedCU = Pick<CUData, 'backend' | 'ui'>;

export function CUUploadZone({ onUploadComplete, className }: CUUploadZoneProps) {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  
  const { toast } = useToast();
  const { addCU } = useTaxState();
  const { user } = useAuth();

  const validateFile = (file: File): boolean => {
    if (file.type !== 'application/pdf') {
      toast({
        title: "Formato non supportato",
        description: "Carica solo file PDF della Certificazione Unica.",
        variant: "destructive",
      });
      return false;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast({
        title: "File troppo grande",
        description: "Il file deve essere inferiore a 10MB.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const uploadFile = async (file: File, userId: string): Promise<string> => {
    const { data, error } = await supabase.storage
      .from('cu-documents')
      .upload(`${userId}/${crypto.randomUUID()}.pdf`, file, { contentType: 'application/pdf', upsert: false });

    if (error || !data?.path) {
      throw new Error('Caricamento del file non riuscito, riprova.');
    }
    return data.path;
  };

  const parseUploadedFile = async (filePath: string): Promise<ParsedCU> => {
    const { data, error } = await supabase.functions.invoke('parse-cu-pdf', { body: { filePath } });
    if (error || !data?.data) {
      throw new Error('Lettura della CU non riuscita, riprova.');
    }
    return data.data as ParsedCU;
  };

  const handleFile = useCallback(async (file: File) => {
    if (!validateFile(file)) return;

    setUploadedFile(file);
    setStatus('uploading');
    setProgress(0);
    let timer: ReturnType<typeof setInterval> | undefined;
    const avanza = (passo: number, intervallo: number) => {
      clearInterval(timer);
      timer = setInterval(() => setProgress((prev) => Math.min(prev + Math.random() * passo, 90)), intervallo);
    };

    try {
      if (!user) {
        throw new Error('Accedi con la tua email per caricare la CU.');
      }

      avanza(10, 100);
      const filePath = await uploadFile(file, user.id);

      setStatus('parsing');
      setProgress(0);
      avanza(15, 200);
      const parsed = await parseUploadedFile(filePath);
      setProgress(100);

      const cuData: CUData = {
        ...parsed,
        id: `cu-${crypto.randomUUID()}`,
        nome: file.name.replace(/\.pdf$/i, '') || 'CU',
        dataCaricamento: new Date()
      };
      addCU(cuData);
      setStatus('success');

      const avvisi = cuData.ui.avvisi?.length ?? 0;
      toast({
        title: 'CU letta',
        description: avvisi > 0
          ? `Reddito ${formatCurrency(cuData.backend.redditi.totaleImponibile)}. ${avvisi === 1 ? '1 valore' : `${avvisi} valori`} da controllare.`
          : `Reddito ${formatCurrency(cuData.backend.redditi.totaleImponibile)}. Confronta i dati con la CU.`,
      });

      onUploadComplete?.();
    } catch (error) {
      setStatus('error');
      toast({
        title: "Errore durante l'elaborazione",
        description: error instanceof Error ? error.message : 'Si è verificato un errore imprevisto.',
        variant: 'destructive',
      });
    } finally {
      clearInterval(timer);
    }
  }, [toast, addCU, onUploadComplete, user]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: useCallback((acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        handleFile(acceptedFiles[0]);
      }
    }, [handleFile]),
    accept: {
      'application/pdf': ['.pdf']
    },
    disabled: status === 'uploading' || status === 'parsing'
  });

  const retry = () => {
    setStatus('idle');
    setUploadedFile(null);
    setProgress(0);
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'uploading':
      case 'parsing':
        return <Loader2 className="w-8 h-8 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle className="w-8 h-8 text-success" />;
      case 'error':
        return <AlertCircle className="w-8 h-8 text-destructive" />;
      default:
        return <Upload className="w-8 h-8 text-muted-foreground" />;
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'uploading':
        return 'Caricamento in corso...';
      case 'parsing':
        return 'Estrazione dati CU...';
      case 'success':
        return 'Dati estratti con successo!';
      case 'error':
        return 'Errore durante l\'elaborazione';
      default:
        return 'Trascina il PDF della CU qui o clicca per selezionare';
    }
  };

  return (
    <GlassCard className={cn("relative w-full", className)}>
      {/* AI Parser Info */}
      <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
        <div className="flex items-center gap-2 text-primary">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 9a1 1 0 012 0v4a1 1 0 11-2 0V9zm1-4a1 1 0 100 2 1 1 0 000-2z" />
          </svg>
          <span className="text-sm font-medium">Lettura automatica con AI</span>
        </div>
        <p className="text-xs text-primary/80 mt-1">
          Il testo della CU viene inviato al servizio AI configurato su questa installazione per estrarre gli importi.
          Il PDF viene cancellato subito dopo la lettura; i dati estratti restano salvati nel tuo account.
        </p>
      </div>
      
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Upload Certificazione Unica
        </h3>
        <p className="text-sm text-muted-foreground">
          Carica il tuo file PDF della Certificazione Unica per iniziare
        </p>
      </div>

      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer",
          isDragActive 
            ? "border-primary bg-primary/5 scale-[1.02]" 
            : "border-glass-border hover:border-primary/50",
          status === 'success' && "border-success bg-success/5",
          status === 'error' && "border-destructive bg-destructive/5"
        )}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center space-y-4">
          {getStatusIcon()}
          
          <div className="space-y-2">
            <p className="text-lg font-medium">
              {getStatusMessage()}
            </p>
            
            {uploadedFile && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="w-4 h-4" />
                <span>{uploadedFile.name}</span>
                <span>({(uploadedFile.size / 1024 / 1024).toFixed(1)} MB)</span>
              </div>
            )}

            {(status === 'uploading' || status === 'parsing') && (
              <div className="w-full max-w-xs mx-auto">
                <div className="bg-muted rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-primary h-full transition-all duration-300 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.round(progress)}%
                </p>
              </div>
            )}

            {status === 'idle' && (
              <p className="text-sm text-muted-foreground">
                Supportiamo solo file PDF. Dimensione massima: 10MB
              </p>
            )}
          </div>

          {status === 'idle' && (
            <Button 
              variant="gradient" 
              className="mt-4 shadow-glow"
              type="button"
            >
              Seleziona file CU
            </Button>
          )}

          {status === 'error' && (
            <Button 
              variant="gradient" 
              className="mt-4"
              onClick={retry}
              type="button"
            >
              Riprova
            </Button>
          )}
        </div>
      </div>
    </GlassCard>
  );
}