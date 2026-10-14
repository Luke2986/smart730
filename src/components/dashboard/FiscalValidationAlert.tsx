/**
 * Componente per visualizzare errori e warning di validazione fiscale
 */

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { FiscalValidationResult } from "@/utils/fiscalValidation";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface FiscalValidationAlertProps {
  validation: FiscalValidationResult;
  className?: string;
}

export function FiscalValidationAlert({ validation, className }: FiscalValidationAlertProps) {
  const [isOpen, setIsOpen] = useState(true);
  
  if (validation.isValid && validation.warnings.length === 0 && validation.suggestions.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {/* ERRORI CRITICI */}
      {!validation.isValid && validation.errors.length > 0 && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Errori di Validazione Fiscale</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-2">
              {validation.errors.map((error, idx) => (
                <div key={idx} className="text-sm">
                  <div className="font-semibold">{error.field}:</div>
                  <div>{error.message}</div>
                  <div className="text-xs opacity-80 mt-1">
                    Valore attuale: €{error.value.toFixed(2)} | Max consentito: €{error.threshold.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* WARNING */}
      {validation.warnings.length > 0 && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <Alert variant="default" className="border-amber-500/50 bg-amber-500/5">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <AlertTitle className="text-amber-500">
                  Attenzione: Dati Inusuali Rilevati
                </AlertTitle>
                <AlertDescription>
                  <div className="text-sm text-muted-foreground mt-1">
                    {validation.warnings.length} warning{validation.warnings.length > 1 ? 's' : ''} rilevato
                  </div>
                </AlertDescription>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="ml-2">
                  {isOpen ? 'Nascondi' : 'Mostra'}
                </Button>
              </CollapsibleTrigger>
            </div>
            
            <CollapsibleContent className="mt-3">
              <div className="space-y-3">
                {validation.warnings.map((warning, idx) => (
                  <div key={idx} className="text-sm border-l-2 border-amber-500/30 pl-3">
                    <div className="font-semibold text-amber-500">{warning.field}</div>
                    <div className="text-muted-foreground">{warning.message}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Valore: €{warning.value.toFixed(2)} | Range atteso: {warning.expectedRange}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Alert>
        </Collapsible>
      )}

      {/* SUGGERIMENTI */}
      {validation.suggestions.length > 0 && (
        <Alert className="mt-4 border-blue-500/50 bg-blue-500/5">
          <Info className="h-4 w-4 text-blue-500" />
          <AlertTitle className="text-blue-500">Suggerimenti</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1 text-sm list-disc list-inside">
              {validation.suggestions.map((suggestion, idx) => (
                <li key={idx}>{suggestion}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
