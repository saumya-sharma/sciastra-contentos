import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/requireAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(req: Request) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    try {
        const [itemsResp, teamResp, campaignsResp, notifsResp, channelsResp, ideasResp] = await Promise.all([
            supabase.from('content_items').select('*'),
            supabase.from('team_members').select('*'),
            supabase.from('campaigns').select('*'),
            supabase.from('notifications').select('*'),
            supabase.from('channels').select('*').order('order', { ascending: true }),
            supabase.from('ideas').select('*').order('created_at', { ascending: false }),
        ]);
        return NextResponse.json({
            items: itemsResp.data || [],
            team: teamResp.data || [],
            campaigns: campaignsResp.data || [],
            notifications: notifsResp.data || [],
            channels: channelsResp.data || [],
            ideas: ideasResp.data || [],
            config: { hasWatiKey: !!process.env.WATI_API_KEY }
        });
    } catch(e) {
        return NextResponse.json({ items: [], team: [], campaigns: [], channels: [], ideas: [] });
    }
}

export async function PUT(req: Request) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    
    if (body._action === 'UPDATE_TEAM') {
        const { error } = await supabase.from('team_members').upsert(body.member);
        return NextResponse.json({ success: !error });
    }
    if (body._action === 'CREATE_CAMPAIGN') {
        const { error } = await supabase.from('campaigns').insert(body.campaign);
        return NextResponse.json({ success: !error, campaign: body.campaign });
    }
    if (body._action === 'SAVE_CHANNELS') {
        // Replace all channels with the new set
        await supabase.from('channels').delete().neq('id', '');
        if (body.channels?.length) {
            const { error } = await supabase.from('channels').insert(body.channels);
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true });
    }
    if (body._action === 'UPDATE_IDEA') {
        const { id, ...updates } = body.idea;
        const { error } = await supabase.from('ideas').update(updates).eq('id', id);
        return NextResponse.json({ success: !error });
    }
    
    // Normal edit for content_items
    const { id, _actor, ...changes } = body;
    
    // Fetch current item to append auditLog properly:
    const { data: item } = await supabase.from('content_items').select('auditLog, status, approval').eq('id', id).single();
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    
    let auditLog = Array.isArray(item.auditLog) ? [...item.auditLog] : [];
    
    if (body.status && item.status !== body.status) {
        auditLog.push({ user: _actor || 'System', action: `Moved from ${item.status} to ${body.status}`, timestamp: new Date().toISOString() });
    }
    if (body.approval && item.approval !== body.approval) {
        auditLog.push({ user: _actor || 'System', action: `Changed Approval Status to ${body.approval}`, timestamp: new Date().toISOString() });
    }
    if (!body.status && !body.approval) {
        // generic prop update log not strictly necessary here since UI optimistic log handles it, but let's append anyway
        auditLog.push({ user: _actor || 'System', action: `Updated properties`, timestamp: new Date().toISOString() });
    }
    
    const { error } = await supabase.from('content_items').update({ ...changes, auditLog }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    
    // fetch back updated
    const { data: updated } = await supabase.from('content_items').select('*').eq('id', id).single();
    return NextResponse.json(updated);
}

export async function POST(req: Request) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    if (body._action === 'CREATE_ITEM') {
        const { error } = await supabase.from('content_items').insert(body.item);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, item: body.item });
    }
    if (body._action === 'CREATE_IDEA') {
        const { error, data } = await supabase.from('ideas').insert(body.idea).select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, idea: data });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function DELETE(req: Request) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const table = searchParams.get('table') || 'content_items';
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const allowed = ['content_items', 'ideas', 'campaigns'];
    if (!allowed.includes(table)) return NextResponse.json({ error: 'Invalid table' }, { status: 400 });
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
