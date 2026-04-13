import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendNotification } from '@/lib/notify';

// Securing the cron so it can't just be pinged externally blindly
// Normally Vercel passes a Cron Auth header
const CRON_SECRET = process.env.CRON_SECRET || 'lume-cron-secret';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}` && process.env.NODE_ENV !== 'development') {
        // Return 401 if unauthorized in production
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 1. Fetch Admin Emails
        const { data: admins, error: adminErr } = await supabase
            .from('user_roles')
            .select('email')
            .eq('role', 'ADMIN')
            .eq('is_active', true);

        if (adminErr || !admins || admins.length === 0) {
            return NextResponse.json({ message: 'No admins found to notify.' });
        }

        const adminEmails = admins.map(a => a.email).filter(Boolean);

        // 2. Fetch all items
        const { data: items, error: itemsErr } = await supabase
            .from('content_items')
            .select('title, status, date, assignees, created_at');

        if (itemsErr) throw itemsErr;

        // Calculations
        const now = new Date();
        const startOfThisWeek = new Date(now);
        const dayOfWeek = now.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startOfThisWeek.setDate(now.getDate() - daysToMonday);
        startOfThisWeek.setHours(0, 0, 0, 0);

        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(now.getDate() - 7);

        // a. Published last 7 days
        const publishedLast7Days = (items || []).filter(i => {
            if (i.status !== 'Published') return false;
            const updatedDate = i.date ? new Date(i.date) : new Date(i.created_at);
            return updatedDate >= oneWeekAgo && updatedDate <= now;
        });

        const publishedTitlesHtml = publishedLast7Days.map(i => `<li>${i.title || 'Untitled'}</li>`).join('');

        // b. This week planned
        const thisWeekPlanned = (items || []).filter(i => {
            if (i.status === 'Published') return false;
            const dueDate = i.date ? new Date(i.date) : null;
            return dueDate && dueDate >= startOfThisWeek && dueDate < new Date(startOfThisWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
        });

        // c. Overdue
        const overdueItems = (items || []).filter(i => {
            if (i.status === 'Published') return false;
            const dueDate = i.date ? new Date(i.date) : null;
            return dueDate && dueDate < startOfThisWeek;
        });
        
        const overdueTitlesHtml = overdueItems.length > 0 
            ? overdueItems.map(i => `<li>${i.title} (Due: ${i.date})</li>`).join('')
            : 'None';

        // d. Top performer
        const performerCounts: Record<string, number> = {};
        publishedLast7Days.forEach(i => {
            const smm = i.assignees?.smm;
            if (smm) {
                performerCounts[smm] = (performerCounts[smm] || 0) + 1;
            }
        });
        
        let topPerformer = 'N/A';
        let topCount = 0;
        for (const [smm, count] of Object.entries(performerCounts)) {
            if (count > topCount) {
                topCount = count;
                topPerformer = smm;
            }
        }

        // Construct HTML Body Segment
        const bodyContent = `
            <h3>Overview</h3>
            <p><strong>Published Last 7 Days:</strong> ${publishedLast7Days.length}</p>
            <ul>${publishedTitlesHtml}</ul>

            <br/>
            <p><strong>Planned This Week:</strong> ${thisWeekPlanned.length} items</p>
            <p><strong>Top Performer:</strong> ${topPerformer} (${topCount} items)</p>

            <br/>
            <p><strong>Overdue Action Required:</strong> ${overdueItems.length} items</p>
            <ul>${overdueTitlesHtml}</ul>
        `;

        await sendNotification({
            to: adminEmails,
            subject: `Lume Weekly — ${now.toLocaleDateString()}`,
            title: `Your content team this week`,
            body: bodyContent,
            ctaText: "Open Lume Pipeline →",
            ctaUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://app.getlume.com'
        });

        return NextResponse.json({ success: true, message: `Digest sent to ${adminEmails.length} admins` });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
