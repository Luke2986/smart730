import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import { AIConfigError, chatCompletion } from '../_shared/ai.ts';

type Mode = 'simple' | 'technical';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface KnowledgeEntry {
  id: string;
  question: string;
  answer_simple: string;
  answer_technical: string;
  sources: unknown;
  priority: number;
}

// Keep in sync with MAX_HISTORY / MAX_MESSAGE_LENGTH in src/components/gaia/GaiaChatPanel.tsx.
const MAX_MESSAGES = 20;
const MAX_USER_LENGTH = 2000;
const MAX_ASSISTANT_LENGTH = 8000;
const KB_LIMIT = 3;

const SYSTEM_PROMPTS: Record<Mode, string> = {
  simple: `Sei GAIA, l'assistente fiscale AI di Smart730. Rispondi in modo SEMPLICE e AMICHEVOLE, come parlassi a una persona non esperta di fisco.

FUNZIONALITÀ SMART730 (COSA POSSIAMO GESTIRE):
✅ Certificazioni Uniche (CU) - anche multiple
✅ Redditi da Titoli di Stato (TS)
✅ Oneri deducibili/detraibili: Interessi mutuo (E7), Affitto (E71 con opzione Giovani)
✅ Scelte 8‰, 5‰ e 2‰ per mille
✅ Inclusione Y1 (familiari a carico)

❌ NON GESTIAMO: E72, studenti fuori sede, casi fiscali particolari/complessi

REGOLE RIGIDE:
- Risposte BREVI: massimo 3-6 frasi
- Linguaggio SEMPLICE: no termini tecnici complessi
- Se chiesto su funzionalità NON supportate, dì chiaramente "Smart730 al momento non gestisce [funzionalità], per casi complessi consulta un commercialista"
- Usa ESEMPI concreti e cifre quando possibile
- Cita SEMPRE le fonti normative alla fine (es: "DM 1924/2024")
- Se non sai, di' "Non ho questa informazione nella mia knowledge base fiscale"

IMPORTANTE: Non inventare informazioni fiscali. Usa SOLO dati dalla knowledge base.`,
  technical: `Sei GAIA, l'assistente fiscale AI di Smart730. Rispondi in modalità TECNICA per professionisti e consulenti fiscali.

FUNZIONALITÀ SMART730 (SCOPE OPERATIVO):
✅ CU (Certificazione Unica) - gestione multi-CU
✅ Redditi da Titoli di Stato
✅ Oneri: E7 (interessi mutuo prima casa), E71 (canoni locazione con agevolazione under 31)
✅ Scelte contributi 8‰, 5‰, 2‰
✅ Y1 (familiari fiscalmente a carico)

❌ FUORI SCOPE: E72, agevolazioni studenti fuori sede, casistiche particolari art. 13 TUIR

REGOLE RIGIDE:
- Terminologia PRECISA: usa termini tecnici corretti (IRPEF, TUIR, art./comma)
- Per funzionalità NON supportate, rispondi: "Casistica fuori scope Smart730. Consigliata assistenza CAF/commercialista"
- Cita articoli di legge, decreti ministeriali, circolari ADE
- Fornisci riferimenti normativi completi
- Specifica scaglioni, aliquote, franchigie con precisione
- Massimo 5-7 frasi per risposta

IMPORTANTE: Massima precisione fiscale. Usa SOLO dati verificati dalla knowledge base.`,
};

function parseMessages(value: unknown): Message[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) return null;

  const messages: Message[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return null;
    const { role, content } = item as Record<string, unknown>;
    if (role !== 'user' && role !== 'assistant') return null;
    const maxLength = role === 'user' ? MAX_USER_LENGTH : MAX_ASSISTANT_LENGTH;
    if (typeof content !== 'string' || content.length === 0 || content.length > maxLength) return null;
    messages.push({ role, content });
  }
  return messages;
}

async function searchKnowledgeBase(client: SupabaseClient, query: string): Promise<KnowledgeEntry[]> {
  // Letters, digits and spaces only: nothing left that PostgREST or LIKE treat as syntax.
  const term = query.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
  if (!term) return [];

  const words = [...new Set(term.toLowerCase().split(' ').filter((w) => w.length > 3))].slice(0, 10);
  const columns = 'id, question, answer_simple, answer_technical, sources, priority';

  const [byQuestion, byKeywords] = await Promise.all([
    client.from('gaia_knowledge_base').select(columns).eq('active', true)
      .ilike('question', `%${term}%`).limit(KB_LIMIT),
    words.length
      ? client.from('gaia_knowledge_base').select(columns).eq('active', true)
        .overlaps('keywords', words).order('priority', { ascending: false }).limit(KB_LIMIT)
      : Promise.resolve({ data: [] as KnowledgeEntry[], error: null }),
  ]);

  if (byQuestion.error || byKeywords.error) {
    console.error('gaia-chat: knowledge base query failed');
  }

  const unique = new Map<string, KnowledgeEntry>();
  for (const entry of [...(byQuestion.data ?? []), ...(byKeywords.data ?? [])] as KnowledgeEntry[]) {
    unique.set(entry.id, entry);
  }
  return [...unique.values()].sort((a, b) => b.priority - a.priority).slice(0, KB_LIMIT);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Richiesta non valida' }, 400);
  }

  const messages = parseMessages(body.messages);
  const mode = body.mode ?? 'simple';
  if (!messages || (mode !== 'simple' && mode !== 'technical')) {
    return json({ error: 'Richiesta non valida' }, 400);
  }

  try {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const entries = await searchKnowledgeBase(auth.client, lastUserMessage);

    const contextInfo = entries.length
      ? '\n\nCONTESTO DALLA KNOWLEDGE BASE:\n' + entries.map((entry) =>
        `Q: ${entry.question}\nA: ${mode === 'simple' ? entry.answer_simple : entry.answer_technical}\nFonti: ${JSON.stringify(entry.sources)}`
      ).join('\n\n')
      : '';

    const response = await chatCompletion({
      messages: [{ role: 'system', content: SYSTEM_PROMPTS[mode] + contextInfo }, ...messages],
      stream: true,
    });

    if (!response.ok) {
      console.error('gaia-chat: AI provider error, status:', response.status);
      if (response.status === 429) {
        return json({ error: 'Troppe richieste, riprova tra poco.' }, 429);
      }
      return json({ error: 'Servizio AI non disponibile' }, 502);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error) {
    if (error instanceof AIConfigError) {
      console.error('gaia-chat: AI provider not configured');
      return json({ error: 'Servizio AI non configurato' }, 500);
    }
    console.error('gaia-chat: unexpected failure:', error instanceof Error ? error.name : 'unknown');
    return json({ error: 'Errore interno' }, 500);
  }
});
