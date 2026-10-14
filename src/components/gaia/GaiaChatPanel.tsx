import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  id: string;
}

type Mode = 'simple' | 'technical';

// Must match the server-side limits in supabase/functions/gaia-chat.
const MAX_HISTORY = 20;
const MAX_MESSAGE_LENGTH = 2000;

const WELCOME_MESSAGE: Message = {
  role: 'assistant',
  content: 'Ciao! Sono GAIA, la tua assistente fiscale AI. Posso aiutarti con domande sul 730, detrazioni, spese deducibili e molto altro. Come posso aiutarti oggi?',
  id: 'welcome'
};

export const GaiaChatPanel: React.FC = () => {
  // In memoria: la conversazione sparisce quando l'utente esce o ricarica la pagina.
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('simple');
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = (instant = false) => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ 
        behavior: instant ? 'auto' : 'smooth',
        block: 'end'
      });
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Instant scroll on mount
    scrollToBottom(true);
  }, []);

  const handleNewConversation = () => {
    setMessages([WELCOME_MESSAGE]);
    setInput('');
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      id: Date.now().toString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Sessione scaduta: accedi di nuovo');
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/gaia-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            messages: [...messages, userMessage]
              .slice(-MAX_HISTORY)
              .map(m => ({ role: m.role, content: m.content })),
            mode
          }),
        }
      );

      if (!response.ok || !response.body) {
        throw new Error('Errore nella risposta del server');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      const assistantId = (Date.now() + 1).toString();

      setMessages(prev => [...prev, { role: 'assistant', content: '', id: assistantId }]);

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => 
                prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m)
              );
              // Scroll during streaming
              scrollToBottom();
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      setIsLoading(false);

    } catch (error) {
      console.error('Error in GAIA chat:', error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore. Riprova.",
        variant: "destructive",
      });
      setMessages(prev => prev.slice(0, -1));
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Mode Toggle */}
      <div className="flex gap-2 p-3 border-b border-border/50 flex-shrink-0">
        <Button
          variant={mode === 'simple' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('simple')}
          className="flex-1"
        >
          <Sparkles className="h-3 w-3 mr-1" />
          Semplice
        </Button>
        <Button
          variant={mode === 'technical' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('technical')}
          className="flex-1"
        >
          Tecnico
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNewConversation}
          className="px-2"
          title="Nuova conversazione"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 min-h-0 chat-scrollbar"
      >
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-3 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-card/90 border border-border text-foreground shadow-sm'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
              </div>
            </div>
          ))}
          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-card/90 border border-border rounded-2xl p-3 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border/50 flex-shrink-0">
        <div className="flex gap-2">
          <Textarea
            maxLength={MAX_MESSAGE_LENGTH}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Chiedi qualcosa sul 730..."
            className="min-h-[60px] resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-[60px] w-[60px] shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
