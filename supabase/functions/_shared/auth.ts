import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';
import { json } from './cors.ts';

export interface AuthenticatedRequest {
  client: SupabaseClient;
  user: User;
}

/**
 * Resolves the calling user from the request JWT. The returned client acts as
 * that user, so Storage and table RLS policies apply to every call made with it.
 * The anon key alone is a valid JWT but has no user, so it is rejected here.
 */
export async function requireUser(req: Request): Promise<AuthenticatedRequest | Response> {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!token) {
    return json({ error: 'Non autenticato' }, 401);
  }

  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) {
    return json({ error: 'Non autenticato' }, 401);
  }

  return { client, user };
}
