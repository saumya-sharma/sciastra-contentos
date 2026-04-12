import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Team email mapping
const TEAM_EMAILS: Record<string, string[]> = {
    marketing: ['mahak@sciastra.com', 'priya@sciastra.com', 'ritika@sciastra.com'],
    sales:     ['sales@sciastra.com'],
    operations:['ops@sciastra.com'],
    academic:  ['academic@sciastra.com'],
    founders:  ['vivek@sciastra.com', 'akhil@sciastra.com'],
};

// Team WhatsApp numbers (pulled from db.json team data at runtime, these are fallbacks)
const TEAM_WHATSAPP: Record<string, string[]> = {
    marketing: ['+919000000001', '+919000000002', '+919000000003'],
    sales:     ['+919000000004'],
    operations:['+919000000005'],
    academic:  ['+919000000006'],
    founders:  ['+919000000007', '+919000000008'],
};

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
    const accountId  = process.env.ZOHO_ACCOUNT_ID;
    const fromEmail  = process.env.ZOHO_FROM_EMAIL || 'noreply@sciastra.com';
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
    const body = await req.json();
    const {
        teams,           // string[] e.g. ['marketing','sales']
        channel,         // 'zoho' | 'wati' | 'both'
        message,         // final composed message string
        subject,         // email subject
        itemTitle,
        itemChannel,
        scheduledDate,
    } = body;

    const results: Record<string, any> = {};

    for (const team of (teams as string[])) {
        const emails   = TEAM_EMAILS[team]  || [];
        const numbers  = TEAM_WHATSAPP[team] || [];

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

        if ((channel === 'wati' || channel === 'both') && numbers.length) {
            const watiResults = await Promise.all(numbers.map(n => sendWatiMessage(n, message)));
            teamResult.whatsapp = watiResults.every(r => r === 'sent') ? 'sent'
                                : watiResults.some(r => r === 'mock') ? 'mock' : 'failed';
        }

        results[team] = teamResult;
    }

    // Log to Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.from('notifications').insert({
            id: `notif_${Date.now()}`,
            notificationType: 'team_broadcast',
            recipientName: teams.join(', '),
            whatsappNumber: 'Team Blast',
            message: `[${channel.toUpperCase()}] ${message}`,
            taskId: null,
            status: Object.values(results).some((r: any) => r.email === 'failed' || r.whatsapp === 'failed') ? 'Partial Failure' : 'Sent/Mocked',
            timestamp: new Date().toISOString()
        });
    }

    return NextResponse.json({ success: true, results });
}

export async function GET() {
    // Returns config status so UI can show enabled/disabled states
    return NextResponse.json({
        zohoConfigured: !!(process.env.ZOHO_CLIENT_ID && process.env.ZOHO_REFRESH_TOKEN && process.env.ZOHO_ACCOUNT_ID),
        watiConfigured: !!process.env.WATI_API_KEY,
    });
}
