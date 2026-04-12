import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/requireAuth';

// Team email mapping (static — these are role-level distribution addresses)
const TEAM_EMAILS: Record<string, string[]> = {
    marketing: ['mahak@sciastra.com', 'priya@sciastra.com', 'ritika@sciastra.com'],
    sales:     ['sales@sciastra.com'],
    operations:['ops@sciastra.com'],
    academic:  ['academic@sciastra.com'],
    founders:  ['vivek@sciastra.com', 'akhil@sciastra.com'],
};

// Team role → WhatsApp group keywords (matches team_members.role values)
const TEAM_ROLE_MAP: Record<string, string[]> = {
    marketing: ['SMM', 'MARKETING'],
    sales:     ['SALES'],
    operations:['OPS', 'OPERATIONS'],
    academic:  ['ACADEMIC', 'CREATOR'],
    founders:  ['ADMIN'],
};

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function getWhatsAppNumbers(teams: string[]): Promise<string[]> {
    const roles = teams.flatMap(t => TEAM_ROLE_MAP[t] || []);
    if (!roles.length) return [];

    const { data, error } = await supabase
        .from('team_members')
        .select('whatsapp, role')
        .in('role', roles)
        .eq('active', true);

    if (error) {
        console.error('[notify-teams] Failed to fetch WhatsApp numbers from DB:', error);
        return [];
    }

    return (data || [])
        .map((m: any) => m.whatsapp)
        .filter((n: string) => n && n.startsWith('+'));
}

async function getZohoAccessToken(): Promise<string | null> {
    const clientId     = process.env.ZOHO_CLIENT_ID;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET;
    const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) return null;

    try {
        const res = await fetch('https://accounts.zoho.in/oauth/v2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type:    'refresh_token',
                client_id:     clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
            }),
        });
        const data = await res.json();
        return data.access_token || null;
    } catch {
        return null;
    }
}

async function sendZohoMail(to: string[], subject: string, body: string): Promise<'sent' | 'mock' | 'failed'> {
    const accountId   = process.env.ZOHO_ACCOUNT_ID;
    const fromEmail   = process.env.ZOHO_FROM_EMAIL || 'noreply@getlume.com';
    const accessToken = await getZohoAccessToken();

    if (!accessToken || !accountId) return 'mock';

    const payload = {
        fromAddress: fromEmail,
        toAddress:   to.join(','),
        subject,
        content:     body,
        mailFormat:  'html',
    };

    try {
        const res = await fetch(
            `https://mail.zoho.in/api/accounts/${accountId}/messages`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            }
        );
        const data = await res.json();
        return data.status?.code === 200 ? 'sent' : 'failed';
    } catch {
        return 'failed';
    }
}

async function sendWatiMessage(number: string, message: string): Promise<'sent' | 'mock' | 'failed'> {
    const apiKey    = process.env.WATI_API_KEY;
    const accountId = process.env.WATI_ACCOUNT_ID;
    const endpoint  = process.env.WATI_ENDPOINT || `https://live-mt-server.wati.io/${accountId}/api/v1/sendSessionMessage/${number.replace('+', '')}`;

    if (!apiKey) return 'mock';

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageText: message }),
        });
        const data = await res.json();
        return data.result ? 'sent' : 'failed';
    } catch {
        return 'failed';
    }
}

export async function POST(req: Request) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const {
        teams,        // string[] e.g. ['marketing','sales']
        channel,      // 'zoho' | 'wati' | 'both'
        message,      // final composed message string
        subject,      // email subject
        itemTitle,
    } = body;

    // Pull live WhatsApp numbers from team_members table
    const allNumbers = await getWhatsAppNumbers(teams as string[]);

    const results: Record<string, any> = {};

    for (const team of (teams as string[])) {
        const emails = TEAM_EMAILS[team] || [];
        const teamResult: Record<string, string> = {};

        if ((channel === 'zoho' || channel === 'both') && emails.length) {
            const htmlBody = `
                <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;background:#f9fafb;border-radius:12px;">
                    <div style="background:#639922;padding:12px 20px;border-radius:8px;margin-bottom:20px;">
                        <span style="color:white;font-weight:700;font-size:18px;">Lume 📢</span>
                    </div>
                    <p style="font-size:15px;color:#1e293b;">${message.replace(/\n/g, '<br/>')}</p>
                    <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;"/>
                    <p style="font-size:11px;color:#94a3b8;">Sent via Lume · ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                </div>`;
            teamResult.email = await sendZohoMail(emails, subject || `[Lume] ${itemTitle}`, htmlBody);
        }

        results[team] = teamResult;
    }

    // Send WhatsApp to all members from DB (deduplicated across teams)
    if ((channel === 'wati' || channel === 'both') && allNumbers.length) {
        const watiResults = await Promise.all(allNumbers.map(n => sendWatiMessage(n, message)));
        const overallWhatsapp = watiResults.every(r => r === 'sent') ? 'sent'
                              : watiResults.some(r => r === 'mock') ? 'mock' : 'failed';
        for (const team of (teams as string[])) {
            results[team] = { ...(results[team] || {}), whatsapp: overallWhatsapp };
        }
    } else if ((channel === 'wati' || channel === 'both') && allNumbers.length === 0) {
        console.warn('[notify-teams] No active WhatsApp numbers found in team_members for teams:', teams);
    }

    // Log to Supabase
    await supabase.from('notifications').insert({
        id: `notif_${Date.now()}`,
        notificationType: 'team_broadcast',
        recipientName: (teams as string[]).join(', '),
        whatsappNumber: 'Team Blast',
        message: `[${channel.toUpperCase()}] ${message}`,
        taskId: null,
        status: Object.values(results).some((r: any) => r.email === 'failed' || r.whatsapp === 'failed') ? 'Partial Failure' : 'Sent/Mocked',
        timestamp: new Date().toISOString()
    });

    return NextResponse.json({ success: true, results });
}

export async function GET() {
    return NextResponse.json({
        zohoConfigured: !!(process.env.ZOHO_CLIENT_ID && process.env.ZOHO_REFRESH_TOKEN && process.env.ZOHO_ACCOUNT_ID),
        watiConfigured: !!process.env.WATI_API_KEY,
    });
}
