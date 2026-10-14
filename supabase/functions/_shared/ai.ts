// Any OpenAI-compatible Chat Completions endpoint works (Gemini, OpenAI, OpenRouter, ...).
// Configure with the Edge Function secrets AI_API_KEY, AI_BASE_URL, AI_MODEL.
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
const DEFAULT_MODEL = 'gemini-2.5-flash';

export class AIConfigError extends Error {}

export function chatCompletion(body: Record<string, unknown>): Promise<Response> {
  const apiKey = Deno.env.get('AI_API_KEY');
  if (!apiKey) {
    throw new AIConfigError('AI_API_KEY is not configured');
  }

  const baseUrl = (Deno.env.get('AI_BASE_URL') || DEFAULT_BASE_URL).replace(/\/+$/, '');

  return fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: Deno.env.get('AI_MODEL') || DEFAULT_MODEL, ...body }),
  });
}
