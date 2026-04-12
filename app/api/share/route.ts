import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/requireAuth';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// POST — create a share link (auth required)
export async function POST(req: Request) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const { type, label, expiryDays } = await req.json();
    if (!type || !['calendar', 'pipeline'].includes(type)) {
        return NextResponse.json({ error: 'type must be "calendar" or "pipeline"' }, { status: 400 });
    }

    const expiresAt = expiryDays
        ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

    const { data, error } = await supabase
        .from('share_links')
        .insert({
            type,
            label: label || null,
            created_by: auth.user.email || auth.user.id,
            expires_at: expiresAt,
            is_active: true,
        })
        .select('id, token, type, label, expires_at, created_at')
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, link: data });
}

// GET ?token=xxx — public: validate token + return calendar/pipeline data
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const listForUser = searchParams.get('list'); // admin: list active links

    // Admin listing their own share links (auth required)
    if (listForUser === '1') {
        const auth = await requireAuth(req);
        if (auth instanceof NextResponse) return auth;
        const { data, error } = await supabase
            .from('share_links')
            .select('id, token, type, label, expires_at, created_at, created_by, is_active')
            .eq('is_active', true)
            .order('created_at', { ascending: false });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ links: data || [] });
    }

    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

    // Validate the token (RLS: only active links are readable)
    const { data: link, error: linkError } = await supabase
        .from('share_links')
        .select('id, token, type, label, expires_at, is_active')
        .eq('token', token)
        .eq('is_active', true)
        .single();

    if (linkError || !link) {
        return NextResponse.json({ error: 'Link not found or revoked' }, { status: 404 });
    }

    // Check expiry
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
        return NextResponse.json({ error: 'This link has expired' }, { status: 410 });
    }

    // Return public data — content items and channel config
    const [itemsResp] = await Promise.all([
        supabase.from('content_items').select('id, title, type, channel, date, status, scheduledTime, assignees'),
    ]);

    return NextResponse.json({
        meta: {
            type: link.type,
            label: link.label,
            expires_at: link.expires_at,
        },
        items: itemsResp.data || [],
    });
}

// DELETE ?id=xxx — revoke a link (auth + admin required)
export async function DELETE(req: Request) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { error } = await supabase
        .from('share_links')
        .update({ is_active: false })
        .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
