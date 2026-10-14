import React, { useState } from 'react';
import { MessageCircle, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GaiaChatPanel } from './GaiaChatPanel';

export const GaiaWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white z-50 animate-in fade-in slide-in-from-bottom-4 duration-300"
          aria-label="Apri GAIA Assistant"
        >
          <div className="relative">
            <MessageCircle className="h-6 w-6" />
            <Sparkles className="h-3 w-3 absolute -top-1 -right-1 text-yellow-300 animate-pulse" />
          </div>
        </Button>
      )}

      {/* Resta montato da chiuso: la conversazione vive solo in memoria. */}
      <div className={isOpen ? "fixed bottom-6 right-6 w-[400px] h-[600px] max-w-[calc(100vw-3rem)] max-h-[calc(100vh-3rem)] z-50 animate-in fade-in slide-in-from-bottom-8 duration-300" : "hidden"}>
        <div className="h-full flex flex-col shadow-2xl rounded-2xl overflow-hidden bg-background/95 backdrop-blur-xl border border-border">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-purple-600/10 to-purple-700/10">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">GAIA</h3>
                <p className="text-xs text-muted-foreground">Assistente Fiscale AI</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 hover:bg-destructive/10"
              aria-label="Chiudi GAIA"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Chat Content */}
          <GaiaChatPanel />
        </div>
      </div>
    </>
  );
};
