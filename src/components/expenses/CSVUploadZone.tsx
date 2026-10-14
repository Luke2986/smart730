import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileSpreadsheet, Upload, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { parseCSVUniversal, CSVParseResult } from '@/utils/csvParser';

interface CSVUploadZoneProps {
  onParsed: (result: CSVParseResult) => void;
  className?: string;
}

export function CSVUploadZone({ onParsed, className = '' }: CSVUploadZoneProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const result = await parseCSVUniversal(file);
      
      if (result.data.length === 0) {
        setError('Il file CSV è vuoto o non è stato possibile parsarlo');
        return;
      }

      onParsed(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel parsing del CSV');
    } finally {
      setIsUploading(false);
    }
  }, [onParsed]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
      'text/plain': ['.csv']
    },
    maxFiles: 1,
    disabled: isUploading
  });

  return (
    <div className={className}>
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${isDragActive 
            ? 'border-primary bg-primary/5' 
            : 'border-border hover:border-primary/50'
          }
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center gap-4">
          {isUploading ? (
            <div className="animate-spin">
              <FileSpreadsheet className="h-12 w-12 text-primary" />
            </div>
          ) : (
            <Upload className="h-12 w-12 text-muted-foreground" />
          )}
          
          <div>
            <p className="text-lg font-medium">
              {isUploading ? 'Analisi in corso...' : 'Carica file CSV'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {isDragActive
                ? 'Rilascia il file qui'
                : 'Trascina un file CSV o clicca per selezionare'}
            </p>
          </div>

          {!isUploading && (
            <Button variant="outline" size="sm" type="button">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Seleziona CSV
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mt-4 text-xs text-muted-foreground space-y-1">
        <p>✓ Supporto automatico per delimitatori: virgola, punto e virgola, tab</p>
        <p>✓ Riconoscimento automatico formato numeri (IT/EN)</p>
        <p>✓ Conversione automatica date</p>
      </div>
    </div>
  );
}
