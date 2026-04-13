import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/requireAuth';
import { sendNotification } from '@/lib/notify';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(req: Request) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    try {
        const body = await req.json();
        const { teams, itemDetails, message } = body;
        if (!teams || !teams.length) {
            return NextResponse.json({ error: 'No teams provided' }, { status: 400 });
        }

        // We pull active team members
        const { data, error } = await supabase
            .from('team_members')
            .select('email, role')
            .eq('active', true);

        if (error) {
            console.error('[notify-teams] Failed to fetch emails:', error);
            return NextResponse.json({ error: 'DB Fetch Failed' }, { status: 500 });
        }

        const allEmails = (data || [])
            .map((m: any) => m.email)
            .filter((e: string) => e?.includes('@'));

        if (allEmails.length > 0) {
           await sendNotification({
               to: allEmails,
               subject: `Team Mention: ${itemDetails?.title || 'System Notification'}`,
               title: `New Team Ping`,
               body: message,
               ctaText: "Open in Lume →",
               ctaUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://app.getlume.com'
           });
        }

        return NextResponse.json({
            success: true,
            summary: {
                totalEmailsSent: allEmails.length
            }
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function GET(req: Request) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    
    return NextResponse.json({
        zohoConfigured: false,
        watiConfigured: false,
        resendConfigured: true
    });
}
