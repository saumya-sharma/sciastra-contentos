import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/requireAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function requireAdmin(req: Request): Promise<{ email: string } | NextResponse> {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const SUPER_ADMIN = process.env.SUPER_ADMIN_EMAIL || 'mysaumya38@gmail.com';
    const OFFICE_ADMIN = process.env.OFFICE_ADMIN_EMAIL || 'hello@getlume.com';

    if (auth.user.email === SUPER_ADMIN || auth.user.email === OFFICE_ADMIN) {
        return { email: auth.user.email! };
    }

    const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('email', (auth.user.email || '').toLowerCase())
        .single();

    if (!data || data.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }
    return { email: auth.user.email! };
}

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'mysaumya38@gmail.com';
const OFFICE_ADMIN_EMAIL = process.env.OFFICE_ADMIN_EMAIL || 'hello@getlume.com';

// GET: fetch user role by email, OR list pending invites
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  const action = searchParams.get('action');

  if (action === 'pending_invites') {
    const { data, error } = await supabase
      .from('pending_invites')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ invites: data || [] });
  }

  if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

  // Super admins bypass user_roles table
  if (email === SUPER_ADMIN_EMAIL || email === OFFICE_ADMIN_EMAIL) {
    return NextResponse.json({ role: 'ADMIN', name: '', is_active: true });
  }

  const { data, error } = await supabase
    .from('user_roles')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (error || !data) {
    return NextResponse.json({ role: null, message: 'Access pending approval. Contact hello@getlume.com' });
  }
  if (!data.is_active) {
    return NextResponse.json({ role: null, message: 'Your account has been deactivated. Contact your admin.' });
  }
  return NextResponse.json({ role: data.role, name: data.name, channels: data.channels, is_active: true });
}

// POST: submit access request or admin direct-invite
export async function POST(req: Request) {
  const body = await req.json();

  if (body._action === 'request_access') {
    const { name, email, requestedRole, message } = body;
    const { error } = await supabase.from('pending_invites').upsert({
      name,
      email: email.toLowerCase(),
      requested_role: requestedRole,
      status: 'pending',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (body._action === 'approve_invite') {
    const adminCheck = await requireAdmin(req);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const { inviteId, email, name, role } = body;
    // Send invite email via Supabase Auth admin
    await supabase.auth.admin.inviteUserByEmail(email, {
      data: { name, role },
    });
    // Upsert into user_roles
    await supabase.from('user_roles').upsert({
      email: email.toLowerCase(),
      name,
      role,
      is_active: true,
      channels: [],
    });
    // Remove from pending
    if (inviteId) {
      await supabase.from('pending_invites').delete().eq('id', inviteId);
    }
    return NextResponse.json({ success: true });
  }

  if (body._action === 'reject_invite') {
    const adminCheck = await requireAdmin(req);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const { inviteId } = body;
    const { error } = await supabase.from('pending_invites').delete().eq('id', inviteId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (body._action === 'direct_invite') {
    const adminCheck = await requireAdmin(req);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const { email, name, role } = body;
    await supabase.auth.admin.inviteUserByEmail(email, { data: { name, role } });
    await supabase.from('user_roles').upsert({
      email: email.toLowerCase(),
      name,
      role,
      is_active: true,
      channels: [],
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
