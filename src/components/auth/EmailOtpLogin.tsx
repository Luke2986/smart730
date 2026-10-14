import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const CODE_LENGTH = 6;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Si è verificato un errore. Riprova.';
}

export function EmailOtpLogin() {
  const { sendCode, verifyCode } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);

  const handleSendCode = async (event?: FormEvent) => {
    event?.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      toast({ title: 'Email non valida', variant: 'destructive' });
      return;
    }

    setPending(true);
    try {
      await sendCode(normalizedEmail);
      setEmail(normalizedEmail);
      setCode('');
      setStep('code');
      toast({ title: 'Codice inviato', description: `Controlla la casella ${normalizedEmail}.` });
    } catch (error) {
      toast({ title: 'Invio non riuscito', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setPending(false);
    }
  };

  const handleVerify = async (event?: FormEvent) => {
    event?.preventDefault();
    if (code.length !== CODE_LENGTH) return;

    setPending(true);
    try {
      await verifyCode(email, code);
      toast({ title: 'Accesso effettuato' });
    } catch (error) {
      toast({ title: 'Codice non valido', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setPending(false);
    }
  };

  if (step === 'email') {
    return (
      <form onSubmit={handleSendCode} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="nome@esempio.it"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
          />
        </div>
        <Button type="submit" variant="gradient" disabled={pending || !email}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Invia codice
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerify} className="space-y-4">
      <div className="space-y-2">
        <Label>Codice ricevuto via email</Label>
        <p className="text-xs text-muted-foreground">Inviato a {email}</p>
        <InputOTP maxLength={CODE_LENGTH} value={code} onChange={setCode} disabled={pending}>
          <InputOTPGroup>
            {Array.from({ length: CODE_LENGTH }, (_, i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="gradient" disabled={pending || code.length !== CODE_LENGTH}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Accedi
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={() => handleSendCode()}>
          Invia di nuovo
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={() => setStep('email')}>
          Cambia email
        </Button>
      </div>
    </form>
  );
}
