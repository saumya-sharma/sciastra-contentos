import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/requireAuth';
import { sendNotification } from '@/lib/notify';

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

    // Trigger A: Status change
    if (body.status && item.status !== body.status) {
        const smmName = updated.assignees?.smm;
        if (smmName) {
            const { data: smmData } = await supabase.from('team_members').select('email').ilike('name', `${smmName}%`).limit(1).single();
            if (smmData?.email) {
                await sendNotification({
                    to: smmData.email,
                    subject: `Content update: ${updated.title || 'Untitled'}`,
                    title: `${updated.title || 'Untitled'} moved to ${body.status}`,
                    body: `${_actor || 'System'} moved this to ${body.status} on ${new Date().toLocaleDateString()}`,
                    ctaText: "View in Lume →",
                    ctaUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://app.getlume.com'
                });
            }
        }
    }

    // Trigger E: Approval needed
    if (body.approval === 'Ready to Publish' && item.approval !== 'Ready to Publish') {
        const { data: adminData } = await supabase.from('user_roles').select('email').eq('role', 'ADMIN').eq('is_active', true);
        const adminEmails = (adminData || []).map(a => a.email).filter(Boolean);
        if (adminEmails.length > 0) {
            await sendNotification({
                to: adminEmails,
                subject: `Ready for approval: ${updated.title || 'Untitled'}`,
                title: `${updated.title || 'Untitled'} needs your approval`,
                body: `${updated.assignees?.smm || 'The team'} has marked this ready. Review and approve to publish.`,
                ctaText: "Review now →",
                ctaUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://app.getlume.com'
            });
        }
    }

    return NextResponse.json(updated);
}

export async function POST(req: Request) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    if (body._action === 'CREATE_ITEM') {
        const { error } = await supabase.from('content_items').insert(body.item);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Trigger B: New Assignee
        const smmName = body.item.assignees?.smm || body.item.assignees?.editor;
        if (smmName) {
            const { data: smmData } = await supabase.from('team_members').select('email').ilike('name', `${smmName}%`).limit(1).single();
            if (smmData?.email) {
                await sendNotification({
                    to: smmData.email,
                    subject: "New content assigned to you",
                    title: `You've been assigned: ${body.item.title || 'Untitled'}`,
                    body: `${body._actor || 'Admin'} assigned you to work on ${body.item.title || 'Untitled'} for ${body.item.channel || 'Lume'}. Due: ${body.item.date || 'TBD'}`,
                    ctaText: "Open in Lume →",
                    ctaUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://app.getlume.com'
                });
            }
        }

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
