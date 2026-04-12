import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Verifies the Supabase JWT from the Authorization header.
 * Returns { user } on success, or a NextResponse 401 on failure.
 *
 * Usage in an API route:
 *   const authResult = await requireAuth(req);
 *   if (authResult instanceof NextResponse) return authResult;
 *   const { user } = authResult;
 */
export async function requireAuth(
  req: Request
): Promise<{ user: { id: string; email?: string } } | NextResponse> {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use the service-role client to validate the JWT without RLS interference
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return { user: { id: data.user.id, email: data.user.email } };
}

/**
 * Verifies a static cron secret from the Authorization header.
 * Protects cron endpoints from public invocation.
 *
 * Set CRON_SECRET in your environment variables.
 * Vercel Cron sends it automatically if configured in vercel.json.
 */
export function requireCronSecret(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null; // no secret configured — allow (dev mode)

  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}
